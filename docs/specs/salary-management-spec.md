# Spec: ACME Salary Management

## Overview

A web tool where ACME's HR Manager keeps salary records for 10,000 employees across 8 countries accurate (add, edit, salary history, soft delete, Excel round-trip) and answers "how do we pay people?" in a few clicks (per-country and per-job-title statistics in local currency, plus an approximate org-wide comparison in US dollars).

Source of truth for scope and decisions: [`salary-management-discovery.md`](salary-management-discovery.md) (reviewed). This spec tightens the discovery's draft ACs and fills in the rule details. The discovery's Slice 11 (Excel import) is split here into Slice 11 (preview) and Slice 12 (apply) so each fits one TDD plan.

---

## Shared Rules

These apply everywhere an employee is created or changed: the add form, the edit form, and Excel import. Each rule is defined once here, and the slices refer back to it.

### Reference data (fixed, not editable in the app)

| Country (display name) | Code | Currency | Maximum annual salary (sanity bound) |
| ---------------------- | ---- | -------- | ------------------------------------ |
| Australia              | AU   | AUD      | 75,000,000                           |
| Canada                 | CA   | CAD      | 70,000,000                           |
| Germany                | DE   | EUR      | 45,000,000                           |
| India                  | IN   | INR      | 4,000,000,000                        |
| Japan                  | JP   | JPY      | 7,500,000,000                        |
| Singapore              | SG   | SGD      | 65,000,000                           |
| United Kingdom         | GB   | GBP      | 40,000,000                           |
| United States          | US   | USD      | 50,000,000                           |

-   **Departments (10):** Customer Support, Design, Engineering, Finance, Human Resources, Legal, Marketing, Operations, Product, Sales.
-   **Employment types:** Full-time, Part-time, Contractor.
-   **Exchange rates:** one fixed rate to USD per currency, stored with a single "rates as of" date. The values and the date are taken from a public source when the app is built and recorded in the reference data.

### Validation rules

| Field                 | Rule                                                                                                                                                                                                                                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full name             | Required. Surrounding spaces are trimmed, and a value made only of spaces counts as empty. No maximum length. Any characters are allowed, including non-Latin names.                                                                                                                                                              |
| Work email            | Required. Trimmed and stored in lowercase. No maximum length. Must look like `local@domain.tld`: exactly one `@`, no spaces, and at least one `.` in the domain part. Must be unique among **active** employees, ignoring letter case. An email that belongs only to inactive employees can be reused for a rehire (see Slice 6). |
| Job title             | Required. Trimmed, and a value made only of spaces counts as empty. No maximum length. Free text.                                                                                                                                                                                                                                 |
| Department            | Required. Must be one of the 10 departments.                                                                                                                                                                                                                                                                                      |
| Country               | Required. Must be one of the 8 countries.                                                                                                                                                                                                                                                                                         |
| Currency              | Never entered in the forms. Always set from the country. In an import, the Currency column must equal the country's currency.                                                                                                                                                                                                     |
| Annual salary         | Required. A whole number (no decimals) greater than 0 and no more than the country's maximum.                                                                                                                                                                                                                                     |
| Employment type       | Required. Must be one of the 3 types.                                                                                                                                                                                                                                                                                             |
| Hire date             | Required. A real calendar date between 1950-01-01 and today, inclusive. When editing, it cannot be later than the employee's earliest salary history entry. For a rehire, it must be after the exit date of the most recent inactive employee with the same email.                                                                |
| Salary effective date | Required. Defaults to today. Cannot be in the future or before the hire date.                                                                                                                                                                                                                                                     |
| Salary change reason  | Optional. Free text, trimmed, with no maximum length. A value made only of spaces is saved as no reason.                                                                                                                                                                                                                          |
| Exit date             | Required when deleting an employee. Defaults to today. Cannot be in the future or before the hire date.                                                                                                                                                                                                                           |

<!-- -------- bee-comment -------- -->

> **@developer**: let's keep salary change reason as text for now with no length limits.
> **@bee**: Removed the 200-character limit. The reason is now free text: trimmed, optional, no maximum. A reason made only of spaces is stored as "no reason", so history doesn't show blank reasons. Updated assumption 3 to match.
>
> -   [ ] mark as resolved

<!-- -------- /bee-comment -------- -->

-   "Today" means the current calendar date in the server's configured timezone (UTC by default).
-   Salaries are shown as the ISO currency code, then the amount with thousands separators and no decimals, for example `USD 85,000`, `INR 1,850,000` or `JPY 9,500,000`.

### Current salary

-   An employee's current salary is the salary history entry with the latest effective date.
-   When two entries share an effective date, the one recorded later is current.

---

## Slice 1: Browse employees (walking skeleton)

Seeded database, then the API, then a paginated list in the UI.

-   [ ] Employee list shows each employee's full name, job title, department, country and current salary in the shared salary format.
-   [ ] Employee list shows 25 employees per page, the total number of employees, and "Page X of Y".
-   [ ] HR Manager can move to the next page and back to the previous page.
-   [ ] The "Previous" control is unavailable on the first page and the "Next" control is unavailable on the last page.
-   [ ] Employee list is sorted by full name A to Z, ignoring letter case, with ties ordered by employee ID.
-   [ ] Shows a "No employees yet" message when there are no employees.
-   [ ] Shows an error message with a retry option when the employee list fails to load.
-   [ ] With 10,000 employees loaded, the first page appears within 1 second.
-   [ ] The seed command creates 10,000 active employees, covering all 8 countries and all 10 departments.
-   [ ] Each seeded employee has 1 to 4 salary history entries. The first is effective on the hire date, and every entry is dated between the hire date and today.
-   [ ] Every seeded salary falls within the seed's configured range for that employee's country and job title.
-   [ ] Running the seed command a second time leaves the same 10,000 employees as running it once, with no duplicates.

## Slice 2: Search & filter

-   [ ] Typing part of a name shows only employees whose full name contains that text, ignoring letter case and surrounding spaces.
-   [ ] The country filter offers the 8 countries, and choosing one shows only employees in that country.
-   [ ] The department filter offers the 10 departments, and choosing one shows only employees in that department.
-   [ ] The job title filter offers every distinct job title held by the employees currently in view, A to Z. Titles that differ only in letter case or surrounding spaces appear once.
-   [ ] Choosing a job title shows employees whose title matches it, ignoring letter case and surrounding spaces.
-   [ ] Search and filters can be combined, and the total count and page count reflect the combined result.
-   [ ] Changing the search text or any filter returns the list to page 1.
-   [ ] Shows a "No matching employees" message when nothing matches.
-   [ ] "Clear filters" empties the search, resets every filter, and shows the full list.

## Slice 3: Add an employee

-   [ ] HR Manager can add an employee by filling in every required field, and the new employee then appears in the list.
-   [ ] The new employee's salary is recorded as their first salary history entry, effective on the hire date, with the reason "Starting salary".
-   [ ] Choosing a country fills in the currency shown next to the salary field, and the HR Manager cannot edit it.
-   [ ] Shows an error next to each required field left empty.
-   [ ] A full name or job title made only of spaces counts as empty and shows the required-field error.
-   [ ] Surrounding spaces in the full name, work email and job title are removed before saving.
-   [ ] Shows an error when the work email is not in the `local@domain.tld` form.
-   [ ] Shows an error when the work email already belongs to an active employee, ignoring letter case.
-   [ ] Shows an error when the salary is not a whole number greater than zero.
-   [ ] Shows an error when the salary is above the chosen country's maximum.
-   [ ] Shows an error when the hire date is in the future or before 1950-01-01.
-   [ ] No employee is saved when any field is invalid.

## Slice 4: Edit an employee / update salary

-   [ ] HR Manager can open an employee's page and see their employee ID, full name, work email, job title, department, country, currency, current salary, employment type, hire date and status.
-   [ ] HR Manager can change any non-salary field, and the employee's page and the list show the new value.
-   [ ] HR Manager can change an employee's salary, and the list then shows the new amount.
-   [ ] The validation rules from Slice 3 also apply to edits.
-   [ ] Saving with the employee's own unchanged email is accepted, and changing it to another employee's email shows an error.
-   [ ] Changing an employee's country changes the currency shown to that country's currency.
-   [ ] Shows an error when the country is changed without entering a new salary.
-   [ ] Shows an error when the hire date is moved later than the employee's earliest salary history entry.
-   [ ] Shows a "Employee not found" message when opening or saving an employee who doesn't exist.

## Slice 5: Salary history

-   [ ] The employee's page lists every salary history entry with amount, currency, effective date and reason, newest effective date first.
-   [ ] When two entries share an effective date, the one recorded later is listed first and is the current salary.
-   [ ] Saving a salary change adds a new history entry and keeps every earlier entry unchanged.
-   [ ] The salary change form has an effective date that defaults to today and can be set to an earlier date.
-   [ ] HR Manager can add an optional reason to a salary change.
-   [ ] A backdated change with an effective date before the current entry's is added to history but does not change the current salary.
-   [ ] Shows an error when the effective date is in the future.
-   [ ] Shows an error when the effective date is before the employee's hire date.
-   [ ] Saving an edit that leaves the salary amount and the country unchanged does not add a history entry.
-   [ ] After a country change, the new history entry is in the new country's currency, and earlier entries keep their original currency.

## Slice 6: Delete (soft delete) & rehire an employee

Deleting never erases data. It sets the employee's status to **inactive**, with an exit date. An inactive record is permanent and read-only: it is never restored. When someone comes back, HR adds them as a **new employee**, and the new record is linked to their earlier inactive record(s). Each period of employment keeps its own clean salary history.

-   [ ] Choosing "Delete" asks the HR Manager to confirm and to give an exit date, which defaults to today. The message explains that the record is kept as inactive.
-   [ ] After confirming, the employee's status is inactive with that exit date, and they no longer appear in the default list.
-   [ ] After confirming, the employee is no longer counted in any insight.
-   [ ] Cancelling the confirmation leaves the employee unchanged.
-   [ ] Turning on "Show inactive employees" lists only inactive employees, with an exit date column, and search and filters still apply.
-   [ ] An inactive employee's page shows an "Inactive" status, their exit date, all their details and their full salary history.
-   [ ] An inactive employee cannot be edited, have their salary changed, or be deleted again.
-   [ ] Adding a new employee with the email of an inactive employee is allowed. The form shows a notice naming that inactive employee before saving.
-   [ ] Shows an error when a rehire's hire date is on or before the exit date of the most recent inactive employee with the same email.
-   [ ] A rehired employee gets a new employee ID and a new salary history starting from their new hire date. The inactive record's details and history are unchanged.
-   [ ] An employee's page lists their linked employment records (the inactive record(s) and any later rehire), each with employee ID, hire date, exit date and status, and a link to open it.
-   [ ] Shows an error when the exit date is before the hire date or in the future.
-   [ ] Shows an error when deleting an employee who doesn't exist or is already inactive.

<!-- -------- bee-comment -------- -->

> **@developer**: may be we should not give restoration option instead create new employee and if the employee already existed then link it with but not restoration to keep the history clean
> **@bee**: Removed restore completely and rewrote this slice around **rehire and link**:
>
> -   Inactive records are permanent and read-only.
> -   A work email only has to be unique among _active_ employees. Adding someone with an inactive employee's email creates a new employee, with a new ID and a fresh salary history, linked to the earlier record(s).
> -   To keep the history clean, a rehire's hire date must come after the earlier exit date.
> -   The employee page shows the linked employment records.
> -   Import follows the same rule (Slices 11–12).
> -   **Trade-off:** an accidental delete is undone by re-adding the person as a new linked record, not by reversing it. The old record and its history stay visible, so nothing is lost.
> -   Also updated the discovery doc and `docs/requirements.md`, which both mentioned "restore".
> -   [ ] mark as resolved

<!-- -------- /bee-comment -------- -->

## Slice 7: Country pay insights

-   [ ] Insights page lists each country with its headcount, ordered by country name A to Z.
-   [ ] For each country, shows the minimum, maximum, mean and median current annual salary in that country's currency.
-   [ ] Mean and median are rounded to the nearest whole currency unit, with halves rounded up.
-   [ ] For an even headcount, the median is the average of the two middle salaries.
-   [ ] Figures change as soon as an employee is added, has their salary or country changed, or is deleted.
-   [ ] Inactive employees are not counted in any figure.
-   [ ] Countries with no active employees are not listed.
-   [ ] Shows a "No employees yet" message when there are no active employees.
-   [ ] With 10,000 employees loaded, the country insights appear within 1 second.

## Slice 8: Job-title insights within a country

-   [ ] HR Manager can choose a country, from a selector or from its row in the country insights, and see every job title in it with its headcount, A to Z.
-   [ ] For each job title, shows the minimum, maximum, mean and median salary in the country's currency, rounded as in Slice 7.
-   [ ] Job titles that differ only in letter case or surrounding spaces are counted as one title.
-   [ ] A grouped job title is labelled with the spelling most of its employees use, and ties go to the spelling that comes first A to Z.
-   [ ] A job title held by one employee shows that employee's salary as the minimum, maximum, mean and median.
-   [ ] Inactive employees are not counted.
-   [ ] Shows a "No employees in this country" message when the chosen country has no active employees.

## Slice 9: Organisation-wide comparison (US dollars)

-   [ ] Shows the headcount and average salary in US dollars for each country.
-   [ ] Shows the headcount and average salary in US dollars for each department, across all countries.
-   [ ] An average in US dollars is the mean of each employee's salary after converting it to US dollars at the fixed rate.
-   [ ] Converted figures are rounded to whole US dollars, with halves rounded up.
-   [ ] Shows the "rates as of" date and the rate used for each currency.
-   [ ] Shows a note that converted figures are approximate.
-   [ ] Inactive employees are not counted, and countries or departments with no active employees are not listed.

## Slice 10: Excel export & template

-   [ ] HR Manager can download the employee list as an `.xlsx` file named `employees-YYYY-MM-DD.xlsx`, using today's date.
-   [ ] The export contains only the employees that match the current search, filters and "Show inactive employees" setting.
-   [ ] The export has one row per employee, in the same order as the list, with the template columns in template order.
-   [ ] Salaries are exported as plain number cells, with the currency in its own column.
-   [ ] Hire dates are exported as date cells shown as `YYYY-MM-DD`.
-   [ ] Exporting when no employees match downloads a file with the header row only.
-   [ ] With 10,000 employees loaded, exporting all of them finishes within 5 seconds.
-   [ ] HR Manager can download a blank import template named `employee-import-template.xlsx` that contains only the header row.
-   [ ] The template and the export include a second sheet, "Allowed values", that lists the countries with their currencies, the departments, and the employment types.

## Slice 11: Excel import, part 1: upload & preview

Nothing is saved in this slice. The HR Manager can check a file and see exactly what an import would do.

-   [ ] HR Manager can upload an `.xlsx` file and see a preview that counts the rows that would be created, updated, left unchanged, or rejected with errors.
-   [ ] Rows are matched to **active** employees by work email, ignoring letter case. A row matching an active employee counts as an update, and an email no employee has counts as a create.
-   [ ] A row whose values all equal the matched employee's current values counts as unchanged, not as an update.
-   [ ] A row whose email belongs only to inactive employees counts as unchanged when every value equals the most recent inactive record. This keeps re-imported exports of inactive employees from changing anything.
-   [ ] A row whose email belongs only to inactive employees, with a hire date after the most recent inactive record's exit date, counts as a create (rehire). The preview names the inactive record it will be linked to.
-   [ ] For each row to be updated, the preview lists every field that would change, with its old and new value.
-   [ ] Each row with errors shows its spreadsheet row number (the header is row 1) and every problem found, using the shared validation rules.
-   [ ] Shows an error on a row whose currency doesn't match its country's currency.
-   [ ] Shows an error on every row whose email appears on more than one row in the file, ignoring letter case.
-   [ ] Shows an error on any other row whose email belongs only to inactive employees. The error explains that inactive records can't be changed, and that a rehire needs a hire date after the exit date.
-   [ ] Rejects the whole file with a message when it is not an `.xlsx` file, or when its first sheet's header row doesn't match the template columns in order, ignoring letter case and surrounding spaces.
-   [ ] Rejects the whole file with a message when it is larger than 10 MB, has more than 20,000 data rows, or has no data rows.
-   [ ] Rows with every cell empty are skipped, and sheets after the first one are ignored.
-   [ ] Previewing a 10,000-row file finishes within 30 seconds.

## Slice 12: Excel import, part 2: confirm & apply (all or nothing)

-   [ ] The "Confirm import" control is available only when the preview has no error rows.
-   [ ] Confirming saves every create and update together, then shows a summary of how many employees were created, updated and left unchanged.
-   [ ] If saving fails partway through, no rows are saved, and an error message says the import was not applied.
-   [ ] If the data has changed since the preview so that a row is now invalid, confirming saves nothing and shows the new errors.
-   [ ] An imported new employee gets a first salary history entry effective on their hire date, with the reason "Starting salary".
-   [ ] An imported rehire is created as a new employee linked to the inactive record(s) with the same email, and those inactive records are unchanged.
-   [ ] An updated row sets the employee's full name, job title, department, country, employment type and hire date to the row's values. The work email stays as it is, because it is the match key.
-   [ ] An updated row with a salary different from the current salary adds a history entry effective on the import date, with the reason "Excel import".
-   [ ] An updated row that changes the country adds a history entry in the new country's currency, even when the amount is unchanged.
-   [ ] An updated row with the same salary and country does not add a history entry.
-   [ ] Importing a file just exported from the tool, without changes, results in 0 created and 0 updated.
-   [ ] With 10,000 rows, confirming an import finishes within 30 seconds.

---

## Cross-cutting (applies to every UI slice)

-   [ ] Every form field has a visible label, and every validation error appears as text next to its field, not shown by colour alone.
-   [ ] Every action (paging, filters, forms, delete, export, import) can be completed by clicking with a mouse or tapping.
-   [ ] Every action can also be completed using only the keyboard, with a visible focus indicator.
-   [ ] Layouts work at widths of 768px and above without horizontal scrolling of the page.

<!-- -------- bee-comment -------- -->

> **@developer**: if clickable option is possible then that should also be considered instead of only keyboard
> **@bee**: Clicking or tapping is now an explicit AC of its own: every action can be done with a mouse or by tapping. The keyboard-only AC stays as a separate, additional requirement for accessibility. It doesn't replace clicking.
>
> -   [ ] mark as resolved

<!-- -------- /bee-comment -------- -->

## Delivery requirements (from the brief)

-   The app is deployed at a public URL with the 10,000-employee seed loaded.
-   One documented command runs the seed.
-   Fast, deterministic unit tests cover the statistics, the validation rules, current-salary selection, and import classification (create, update, unchanged, error).

---

## API Shape (indicative)

```
GET  /api/reference
  → 200 { countries: [{ code, name, currency, maxAnnualSalary }], departments: [string],
          employmentTypes: [string], exchangeRates: { asOf, toUsd: { [currency]: number } } }

GET  /api/employees?search=&country=IN&department=Engineering&jobTitle=&status=active|inactive&page=1
  → 200 { items: [EmployeeSummary], page, pageSize: 25, total, totalPages }
  → 400 { error: { code: "INVALID_QUERY", message } }     // unknown country/department/status, page < 1

GET  /api/employees/job-titles?status=active|inactive&country=&department=
  → 200 { jobTitles: [string] }                            // deduplicated by case/space, A to Z

GET  /api/employees/:id                → 200 EmployeeDetail | 404
POST /api/employees                    { fullName, email, jobTitle, department, country,
                                         annualSalary, employmentType, hireDate }
  → 201 EmployeeDetail
  → 400 { error: { code: "VALIDATION_FAILED", fieldErrors: { [field]: message } } }
  → 409 { error: { code: "EMAIL_TAKEN" } }               // email belongs to an active employee
  // Email belonging only to inactive employees => created as a rehire, linked to them

GET  /api/employees/email-check?email=
  → 200 { activeEmployeeId: id | null, inactiveEmployees: [LinkedEmployment] }   // drives the rehire notice

PATCH /api/employees/:id               { fullName?, email?, jobTitle?, department?, country?,
                                         employmentType?, hireDate?,
                                         salaryChange?: { amount, effectiveDate, reason? } }
  → 200 EmployeeDetail | 400 | 404 | 409 (email taken, or employee is inactive)

DELETE /api/employees/:id?exitDate=YYYY-MM-DD   // soft delete: status → inactive; record is kept
  → 200 EmployeeDetail | 400 | 404 | 409 (already inactive)

GET  /api/insights/countries
  → 200 { countries: [{ country, currency, headcount, min, max, mean, median }] }
GET  /api/insights/countries/:code/job-titles
  → 200 { country, currency, jobTitles: [{ jobTitle, headcount, min, max, mean, median }] }
GET  /api/insights/organisation
  → 200 { referenceCurrency: "USD", ratesAsOf, toUsd: {...},
          byCountry: [{ country, headcount, averageSalaryUsd }],
          byDepartment: [{ department, headcount, averageSalaryUsd }] }

GET  /api/exports/employees?<same filters as list>   → 200 .xlsx (employees-YYYY-MM-DD.xlsx)
GET  /api/imports/template                           → 200 .xlsx (employee-import-template.xlsx)

POST /api/imports/preview   multipart: file          → 200 ImportPreview | 400 { error: { code, message } }  // file-level
POST /api/imports           multipart: same file     → 200 { created, updated, unchanged }
                                                     → 422 ImportPreview   // re-validated, errors found, nothing saved
                                                     → 500 { error: { code: "IMPORT_NOT_APPLIED" } }  // nothing saved
```

The import is stateless. The client sends the same file to `preview` and then to `import`, and the server validates it again in full before saving.

<!-- -------- bee-comment -------- -->

> **@developer**: this should be delete instead of removal
> **@bee**: Replaced `POST /api/employees/:id/removal` with `DELETE /api/employees/:id?exitDate=YYYY-MM-DD`. It is still a soft delete: the status becomes inactive and the record is kept. The exit date goes in the query string because many proxies and clients drop request bodies on DELETE. For consistency, the UI action is now "Delete" too (Slice 6), and its confirmation explains that the record is kept as inactive.
>
> -   [ ] mark as resolved

<!-- -------- /bee-comment -------- -->

<!-- -------- bee-comment -------- -->

> **@developer**: may be we should not give restoration option instead create new employee and if the employee already existed then link it with but not restoration to keep the history clean
> **@bee**: Removed `POST /api/employees/:id/restoration`. Rehiring is now a normal `POST /api/employees` with an email that only inactive employees have. The server creates a new employee and links it to them. `EMAIL_TAKEN` now only fires for active employees. I added `GET /api/employees/email-check` so the add form can show the rehire notice before saving. See Slice 6 for the full rules.
>
> -   [ ] mark as resolved

<!-- -------- /bee-comment -------- -->

## Data Shapes (indicative)

```
EmployeeSummary: { id, fullName, jobTitle, department, country, currency, currentSalary,
                   status: "active" | "inactive", exitDate: date | null }
EmployeeDetail:  EmployeeSummary & { email, employmentType, hireDate,
                   salaryHistory: [SalaryHistoryEntry],           // newest effective date first
                   linkedEmployments: [LinkedEmployment] }        // other records with the same email, newest hire first
SalaryHistoryEntry: { id, amount, currency, effectiveDate, reason: string | null, recordedAt }
LinkedEmployment:   { id, hireDate, exitDate: date | null, status: "active" | "inactive" }

ImportPreview: {
  totals: { create, update, unchanged, error },
  creates: [{ row, email, rehireOf: id | null }],                 // rehireOf => linked inactive record
  updates: [{ row, email, changes: [{ field, from, to }] }],
  errors:  [{ row, email: string | null, messages: [string] }]
}
```

<!-- -------- bee-comment -------- -->

> **@developer**: status should be active or inactive instead of left, inactive should be treated as left
> **@bee**: Status is now `"active" | "inactive"` everywhere: data shapes, the API's `status` query parameter, UI labels ("Inactive" status, "Show inactive employees") and all ACs. Inactive means the person has left: they are excluded from the default list and every insight, and the record is read-only.
>
> -   [ ] mark as resolved

<!-- -------- /bee-comment -------- -->

**Template columns (the import and export use the same order):**
`Full Name | Work Email | Job Title | Department | Country | Currency | Annual Salary | Employment Type | Hire Date`

How import reads cells:

-   Country, Department and Employment Type are matched to their display names, ignoring letter case and surrounding spaces.
-   Annual Salary must be a number cell holding a whole number, or text made only of digits. Currency symbols and thousands separators are errors.
-   Hire Date must be a date cell, or text in `YYYY-MM-DD` form.

---

## Out of Scope

Everything in the discovery's "Deliberately Out of Scope" table, plus the following for this spec:

-   Sorting the list by any column other than the default (name A to Z).
-   Choosing more than one value in a filter (for example two countries at once).
-   Searching by email or employee ID. Search covers the name only.
-   Editing or deleting salary history entries. A mistake is fixed by adding a new, correct entry.
-   Deleting several employees at once. Deleting employees through import.
-   Restoring (reactivating) an inactive employee. A returning employee is added as a new, linked record instead.
-   Effective dates, history rows, status or exit date in the import file.
-   Exporting salary history.
-   Adding or editing countries, departments, currencies or exchange rates in the app.
-   Layouts below 768px wide (phone-sized screens).
-   Shareable or bookmarkable filter URLs.

## Technical Context

-   **Stack (decided):** Node.js + TypeScript + Express backend with a relational database. React or Next.js UI with a component library. The specific database, framework and component library are chosen at the architecture stage.
-   **Modules (from discovery):**
    -   `employees/` holds employees, salary history, validation, current-salary selection, soft delete, rehire linking, and search/filter/pagination.
    -   `reference/` holds countries, currencies, departments, exchange rates and salary maximums. It has no dependencies.
    -   `insights/` holds the statistics and breakdowns.
    -   `spreadsheet/` holds the template, reading and writing `.xlsx`, import preview, and the all-or-nothing apply.
    -   `seed/` generates the deterministic synthetic data.
-   **Patterns to follow:**
    -   The shared validation rules exist once, in `employees/`, and the forms and the import both use them.
    -   The statistics (min, max, mean, median, rounding) are pure functions with deterministic unit tests.
    -   Anything that depends on "today" takes an injectable clock, so tests are deterministic.
    -   Paging, filtering and aggregation happen on the server.
    -   Salary amounts need 64-bit integer storage. The INR and JPY maximums (4 and 7.5 billion) exceed the 32-bit integer limit of about 2.1 billion. All values stay well inside JavaScript's safe-integer range.
    -   Text fields (name, email, job title, reason) have no length limit in the rules, so the database shouldn't impose one either.
-   **Key dependencies:** none yet (greenfield).
-   **Risk level:** MODERATE.
    -   The highest-impact area is bulk import (Slices 11 and 12), which needs the preview, all-or-nothing saving, re-validation on confirm, and the round-trip check.
    -   Current-salary correctness: test same-day and backdated entries.
    -   Statistics correctness: test even and odd counts, a single employee, and rounding.

## Assumptions made while speccing (please confirm)

<!-- -------- bee-comment -------- -->

> **@developer**: since max salary limit it just for validation lets increase it, add one more zero in it
> **@bee**: Multiplied every maximum in the reference table by 10, to roughly USD 50 million (for example USD 50,000,000, INR 4,000,000,000, JPY 7,500,000,000). The INR and JPY limits are now above the 32-bit integer limit, so I added a Technical Context note that salaries need 64-bit integer storage.
>
> -   [ ] mark as resolved

<!-- -------- /bee-comment -------- -->

<!-- -------- bee-comment -------- -->

> **@developer**: let's make name, email, title text field instead of varchar type lenght limit as this limit doesn't give any meaningful performance advantage but we will trim for left right white spaces and any other validation that needs except string length.
> **@bee**: Removed every length limit (name, job title, email, reason) from the validation rules. Trimming stays, a value made only of spaces counts as empty, and the email format and uniqueness checks stay. In Slice 3, the "longer than 100 characters" AC is replaced with ACs for whitespace-only values and trimming. The spec carries behaviour only, so the column-type choice (text vs varchar) is a Technical Context note for the planner: no database-level length limit.
>
> -   [ ] mark as resolved

<!-- -------- /bee-comment -------- -->

1. **Salary precision:** salaries are whole numbers in local currency, with no decimals. This keeps JPY consistent with the other currencies and avoids rounding problems.
2. **Salary upper bound:** each currency has a maximum of roughly USD 50 million (table above). It is only a sanity check.
3. **Text fields:** name, job title, email and salary change reason have no maximum length. They are trimmed, and a value made only of spaces counts as empty. Email must be in a basic `local@domain.tld` format and is stored in lowercase, so uniqueness ignores letter case.
4. **Hire date bounds:** 1950-01-01 to today. On edit, the hire date can't be later than the earliest salary entry.
5. **Exit date:** it can't be in the future. This matches "no scheduled changes". It defaults to today.
6. **Country change needs a new salary:** in the edit form, changing the country requires a new salary. Otherwise the old amount would silently turn into a different currency. In an import, a country change always adds a history entry in the new currency.
7. **"Today":** today's date comes from the server's configured timezone, UTC by default.
8. **Salary display:** amounts are shown as ISO code plus amount (`USD 85,000`) rather than symbols, because USD, CAD, AUD and SGD all use "$".
9. **Departments:** the 10 departments listed above.
10. **Status filter:** the status is active or inactive. "Show inactive employees" shows inactive employees only, not active and inactive together. Inactive records are permanent and read-only: there is no restore. A returning employee is added as a new record linked by email (Slice 6).
11. **Job-title filter options:** distinct titles among the employees currently in view, A to Z. Grouped insight titles are labelled with the most common spelling.
12. **Insight ordering and rounding:**
    - Countries and job titles are listed A to Z.
    - Mean, median and converted figures are rounded to whole units, with halves rounded up.
13. **Template layout:**
    - Nine columns (above). There is no Employee ID, Status or Exit Date column.
    - The template and the export both carry an "Allowed values" sheet.
    - The file names are `employees-YYYY-MM-DD.xlsx` and `employee-import-template.xlsx`.
14. **Import limits:** at most 10 MB and 20,000 data rows, read from the first sheet only. Blank rows are skipped. Header names ignore letter case and surrounding spaces but must be in order.
15. **What an import update changes:** every template field except Work Email, which is the match key. Rows identical to the existing record count as "unchanged". This keeps the round-trip working, including for exports of inactive employees. A row whose email belongs only to inactive employees is either a rehire (hire date after the exit date), unchanged (identical), or an error.
16. **Import preview detail:**
    - The preview lists every field each update would change, with its old and new value, not just counts. Bulk import is the highest-impact risk, so the HR Manager should see exactly what will change.
    - Confirming re-validates the file. If anything changed since the preview, nothing is saved.
17. **Salary history reasons set automatically:** "Starting salary" for the first entry, and "Excel import" for salary changes made by an import.
18. **Seed:**
    - The seed creates 10,000 active employees and no inactive employees.
    - It uses a fixed random seed, so every run produces the same data.
    - Re-running it replaces the existing data.
19. **Discovery Slice 11 split** into Slice 11 (upload & preview, saves nothing) and Slice 12 (confirm & apply). This keeps each slice to one TDD plan.
20. **Responsive target:** widths of 768px and above (tablet and desktop). Phone layouts are out of scope.

[X] Reviewed
