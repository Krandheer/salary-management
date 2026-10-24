# Discovery: ACME Salary Management

> **How to read this document.** Part 1 is the one-page requirements document: goal, users, scope, and what we are deliberately leaving out, with reasons. Part 2 holds the supporting detail: delivery slices with acceptance criteria, assumptions, and open questions.

---

# Part 1 — Requirements (one page)

## Why
ACME's HR team manages salary data for **10,000 employees across multiple countries in Excel**. That is tedious. Records are hard to find, edits are easy to get wrong, and simple questions like "what do we pay engineers in India?" mean building a filter or formula by hand every time. The HR Manager needs one place to keep salary data accurate and to answer questions about how the organisation pays people.

## Who
- **Primary user: the HR Manager.** Keeps employee salary records up to date and is the person asked "how do we pay people?" by leadership.
- **Who benefits:** leadership and finance, who get faster and more consistent answers about pay. Employees benefit too, because their records are more accurate.

## Problem Statement
The HR Manager cannot reliably maintain salary records for 10,000 people across several countries and currencies in a spreadsheet, and cannot quickly answer basic questions about pay. We want a web tool that makes keeping records accurate effortless and puts the most common pay questions one click away.

## Goal & Success Criteria
- The HR Manager can find any employee and see their current salary in a few seconds, without opening a spreadsheet.
- The HR Manager can add, update and remove salary records in the browser. Common mistakes (missing fields, zero or negative salary, unknown country) are caught before anything is saved.
- The HR Manager can see every salary change an employee has had, and when it took effect.
- Removing an employee never loses data. Former employees can be found and restored.
- The HR Manager can move existing Excel data into the tool, and get data back out to Excel, without retyping anything.
- The HR Manager can answer *"What are the minimum, maximum and average salaries in country X?"* and *"What is the average salary for job title Y in country X?"* in under a minute, with no formulas.
- The tool stays responsive with the full 10,000-employee dataset loaded.
- Anyone reviewing the project can load realistic data with one seed command and see all of the above working.

## Scope & Features (in priority order)
1. **Browse employees:** a paginated list of current employees showing name, job title, department, country, and salary in local currency.
2. **Search & filter:** search by name. Filter by country, department and job title.
3. **Manage employees:** add and edit an employee and their salary, with validation.
4. **Salary history:** every salary change is kept with its effective date and an optional reason. The employee's page shows the full history, newest first.
5. **Remove & restore (soft delete):** removing an employee marks them as *left* with an exit date instead of deleting them. Former employees are hidden from the list and the insights by default, can be viewed with a filter, and can be restored.
6. **Country pay insights:** for each country, the headcount and the minimum, maximum, average (mean) and median salary, in that country's currency.
7. **Job-title pay insights within a country:** the same statistics for each job title in a selected country.
8. **Organisation-wide comparison:** headcount and average salary by country and by department, converted to one reference currency (US dollars) using a fixed, dated table of exchange rates that is clearly labelled as approximate.
9. **Excel export:** download the current (filtered) employee list as an `.xlsx` file in the same column layout the import accepts.
10. **Excel import:** upload an `.xlsx` file in a downloadable template layout. Show a preview of rows to be created, rows to be updated and any errors before anything is saved. Import all rows or none.

**Employee record:** employee ID (assigned automatically), full name, work email (unique), job title, department, country, currency (set from the country), current annual base salary (in local currency), employment type (full-time / part-time / contractor), hire date, status (active / left), exit date (when left).

**Salary history entry:** amount, currency, effective date, reason (optional, e.g. "Annual review", "Promotion"). The current salary is the entry with the latest effective date.

<!-- -------- bee-comment -------- -->
> **@developer**: add salary history, add excel import/export, for employee add soft delete feature
> **@bee**: Added all three to scope (features 4, 5, 9, 10) and removed them from Out of Scope. Defaults I chose, which you can change:
> - **History:** every salary change, from the edit form or an import, adds an entry. Effective dates can be backdated but cannot be in the future or before the hire date. Insights still use current salary only.
> - **Soft delete:** an employee is marked *left* with an exit date. The record is kept, hidden from the list and insights by default, and can be restored. Emails stay unique across current and former employees, so a rehire is a restore.
> - **Import:** uses a fixed template. Rows are matched to existing employees by work email: new emails create employees, existing emails update them, and a salary change adds a history entry. A preview runs first, then everything is saved or nothing is. Export uses the same columns, so data can go out and come back.
>
> I also added Slices 5, 6, 10 and 11, put the leftover limits (future-dated raises, partial imports, CSV/Google Sheets, permanent deletion) in Out of Scope, and raised import as the main data-integrity risk.
> - [ ] mark as resolved
<!-- -------- /bee-comment -------- -->

## Deliberately Out of Scope (and why)
| Left out | Why |
|---|---|
| **Login, user accounts, roles** | There is one persona, the HR Manager, and the demo uses only synthetic seeded data. Building auth properly is a project of its own and would add nothing to the pay questions we were asked to answer. It is the first thing to add before any real data goes in. |
| **Future-dated salary changes (scheduled raises)** | History records changes that have already taken effect. Scheduling raises in advance means "current salary" depends on today's date and needs a background job. That complexity isn't needed to answer how the organisation pays people today. |
| **Full audit log (who changed what, every field)** | Without login there is no "who". Salary history covers the change HR cares about most. A field-level audit log comes with auth. |
| **Partial imports, CSV, Google Sheets, free-form column mapping** | All-or-nothing imports against one fixed template keep the data consistent and the behaviour predictable. HR fixes the flagged rows and uploads again. Other formats and column mapping can come later if a real file needs them. |
| **Live currency exchange rates** | A fixed, dated rate table is enough for approximate comparisons across countries, and it keeps results predictable and testable. A live rates feed adds an outside dependency and makes numbers change from day to day. |
| **Payroll, tax, deductions, payslips, compliance** | That is payroll software, a different product with legal requirements in every country. This tool records pay. It does not pay people. |
| **Bonuses, equity, benefits, allowances** | Base salary answers the questions in the brief. Total compensation multiplies the data model and the statistics. |
| **Approval workflows (e.g. raise requests)** | These need multiple roles and auth, and there is one user. |
| **Pay-equity analysis by gender or other demographics** | This needs sensitive personal data and careful legal and ethical framing. It is valuable, but it is a deliberate decision of its own and should not be bolted on. |
| **Org chart / reporting lines, performance data** | Not needed to answer how the organisation pays people. |
| **Permanent deletion & data-retention rules** | Removal is always soft, so a mistake never loses data. Purging records after a legal retention period differs by country and needs a policy decision first. |
| **Leaver workflows (exit reasons, final pay, offboarding)** | The tool records that someone left and when. Everything else about leaving belongs in HR or payroll processes. |

---

# Part 2 — Supporting Detail

## Hypotheses
- **H1:** The pay questions that matter most are per-country (local currency) and per-job-title within a country. This scopes IN features 6–7 as the core insights.
- **H2:** Comparing countries with a fixed, dated exchange-rate table is "good enough" for the HR Manager, provided it is clearly labelled approximate. This scopes IN feature 8 and OUT live rates. If rejected, feature 8 drops to local-currency-only views.
- **H3:** The HR Manager needs to see how an employee's pay got to where it is (raises, promotions), not just the current number. This scopes IN salary history. Insights still use current salary only.
- **H7:** HR keeps working partly in Excel during and after migration, so data must round-trip: export → edit → import. This scopes IN import and export with one shared template.
- **H8:** Removing an employee by mistake must be recoverable, and pay records of people who left still matter. This scopes IN soft delete with restore.
- **H4:** Each country uses exactly one currency, so currency is set from the country and never entered separately.
- **H5:** Job titles are free text. Insights group titles that differ only in letter case or surrounding spaces ("Software Engineer" and " software engineer"). Departments and countries come from fixed lists.
- **H6:** A single unauthenticated HR Manager user is acceptable for a demo that uses only synthetic data.

## Milestone Map

### Slice 1: Browse employees (walking skeleton)
Thinnest end-to-end path: seeded database → backend → UI list.
- [ ] Seed command creates 10,000 employees with realistic names, job titles, departments, countries and salaries.
- [ ] Each seeded employee has between 1 and 4 salary history entries, with effective dates between their hire date and today.
- [ ] Running the seed command twice still leaves exactly 10,000 employees.
- [ ] Employee list shows name, job title, department, country, and salary formatted in the employee's local currency.
- [ ] Employee list shows 25 employees per page, plus the total employee count.
- [ ] HR Manager can move to the next and previous pages.
- [ ] Employee list is sorted by name A–Z by default.
- [ ] Shows a "no employees yet" message when there are no employees.
- [ ] Shows an error message when the employee list fails to load.
- [ ] First page appears within 1 second with 10,000 employees loaded.

### Slice 2: Search & filter
- [ ] Typing part of a name shows only employees whose name contains that text, ignoring letter case.
- [ ] Filtering by country shows only employees in that country.
- [ ] Filtering by department shows only employees in that department.
- [ ] Filtering by job title shows only employees with that job title.
- [ ] Search and filters can be combined, and the total count reflects the combined result.
- [ ] Changing a search or filter returns to page 1.
- [ ] Shows a "no matching employees" message when nothing matches.
- [ ] Clearing all filters shows the full list again.

### Slice 3: Add an employee
- [ ] HR Manager can add an employee with all required fields, and the new employee appears in the list.
- [ ] A new employee's starting salary is recorded as their first salary history entry, effective from the hire date.
- [ ] Currency is filled in automatically from the chosen country.
- [ ] Shows an error for each required field left empty.
- [ ] Shows an error when salary is zero, negative, or not a number.
- [ ] Shows an error when the email is already used by another employee.
- [ ] Shows an error when the hire date is in the future.
- [ ] Nothing is saved when any field is invalid.

### Slice 4: Edit an employee / update salary
- [ ] HR Manager can open an employee and see all of their current details.
- [ ] HR Manager can change an employee's salary, and the list shows the new amount.
- [ ] HR Manager can change any other field of an employee.
- [ ] Changing an employee's country updates their currency to that country's currency.
- [ ] The validation rules from Slice 3 apply to edits.
- [ ] Shows a "not found" message when opening an employee who no longer exists.

### Slice 5: Salary history
- [ ] The employee's page shows every salary history entry with amount, currency, effective date and reason, newest first.
- [ ] Changing an employee's salary adds a new history entry, and the old entry stays.
- [ ] HR Manager can set the effective date of a salary change, which defaults to today.
- [ ] HR Manager can add an optional reason to a salary change.
- [ ] The current salary shown in the list is the entry with the latest effective date.
- [ ] Shows an error when the effective date is in the future.
- [ ] Shows an error when the effective date is before the employee's hire date.
- [ ] Editing fields other than salary does not add a history entry.
- [ ] After a country change, the next salary entry is recorded in the new country's currency, and earlier entries keep their original currency.

### Slice 6: Remove & restore an employee (soft delete)
- [ ] HR Manager is asked to confirm, and to give an exit date, before an employee is removed.
- [ ] After confirming, the employee no longer appears in the default list or in any insight.
- [ ] Cancelling the confirmation leaves the employee unchanged.
- [ ] A "Show former employees" filter lists removed employees with their exit date.
- [ ] A former employee's page still shows all of their details and salary history.
- [ ] HR Manager can restore a former employee, who then appears in the list and insights again.
- [ ] Shows an error when the exit date is before the hire date.
- [ ] Shows an error when adding a new employee with the email of a former employee, and suggests restoring them instead.
- [ ] Shows a "not found" message when removing an employee who no longer exists.

### Slice 7: Country pay insights
- [ ] Insights page lists each country with its headcount.
- [ ] For each country, shows minimum, maximum, mean and median annual salary in that country's currency.
- [ ] Median for an even number of employees is the average of the two middle salaries.
- [ ] Figures reflect adds, edits and removals as soon as they are made.
- [ ] Countries with no employees are not listed.
- [ ] Former employees are not counted.

### Slice 8: Job-title insights within a country
- [ ] HR Manager can select a country and see every job title in it with its headcount.
- [ ] For each job title, shows minimum, maximum, mean and median salary in the country's currency.
- [ ] Job titles that differ only in letter case or surrounding spaces are grouped together.
- [ ] A job title held by one employee shows that employee's salary as min, max, mean and median.
- [ ] Shows a "no employees in this country" message when the selected country has none.

### Slice 9: Organisation-wide comparison (reference currency)
- [ ] Shows headcount and average salary per country converted to US dollars.
- [ ] Shows headcount and average salary per department across all countries in US dollars.
- [ ] Shows the date of the exchange rates used, with a note that converted figures are approximate.
- [ ] Converted amounts are rounded to whole US dollars.

### Slice 10: Excel export
- [ ] HR Manager can download the employee list as an `.xlsx` file.
- [ ] The export contains only the employees matching the current search and filters.
- [ ] The export has one row per employee, with the same columns, in the same order, as the import template.
- [ ] Salaries are exported as plain numbers, with currency in its own column.
- [ ] Exporting all 10,000 employees finishes within 5 seconds.
- [ ] HR Manager can download a blank import template with the column headers only.

### Slice 11: Excel import
- [ ] HR Manager can upload an `.xlsx` file in the template layout.
- [ ] Before saving anything, a preview shows how many employees will be created, how many updated, and how many rows have errors.
- [ ] Rows are matched to existing employees by work email. A new email creates an employee, and an existing email updates that employee.
- [ ] Each row with an error shows its row number and what is wrong, using the same validation rules as the add form.
- [ ] When any row has an error, the import cannot be confirmed and nothing is saved.
- [ ] After the HR Manager confirms a valid import, all rows are saved together, and a summary shows the counts created and updated.
- [ ] An imported salary that differs from the employee's current salary adds a salary history entry effective on the import date.
- [ ] Shows an error when the file is not an `.xlsx` file, or its column headers don't match the template.
- [ ] Shows an error when the same email appears on more than one row.
- [ ] A file exported from the tool can be imported again unchanged, and nothing is created or updated.
- [ ] Importing 10,000 rows completes within 30 seconds.

## Module Structure
*(Greenfield project)*
- `employees/` owns Employee, EmploymentType, EmployeeStatus (active/left), SalaryHistoryEntry, employee validation, salary change rules, soft delete/restore, search/filter/pagination. Depends on: `reference/`
- `reference/` owns Country, Currency, Department, ExchangeRate (fixed reference data). Depends on: (none)
- `insights/` owns SalaryStatistics (min/max/mean/median), country and job-title breakdowns, reference-currency comparison. Depends on: `employees/`, `reference/`
- `spreadsheet/` owns the import/export template, Excel file reading and writing, import preview (create/update/error rows) and all-or-nothing apply. Depends on: `employees/`, `reference/`
- `seed/` owns realistic synthetic data generation for 10,000 employees with salary history. Depends on: `employees/`, `reference/`

## Assumptions & Defaults (accepted unless changed)
- 8 supported countries, each with one currency: US/USD, UK/GBP, India/INR, Germany/EUR, Canada/CAD, Australia/AUD, Singapore/SGD, Japan/JPY.
- Salary is **annual base salary in local currency**.
- Statistics within a country are always in local currency. Only Slice 9 converts currencies.
- Statistics are the mean and the median. The median is included because averages get skewed by a few high earners.
- Seeded salaries follow realistic ranges per country and job title, so the insights look meaningful in the demo.

## Risk
**Moderate.** Salary data is sensitive personal information, but this is an internal tool with one user, and the demo uses synthetic data only. The main risks are:
- **Wrong statistics.** Mitigated by deterministic unit tests on the statistics module.
- **Slow pages at 10k rows.** Mitigated by paginating and filtering on the server, plus the 1-second load criterion above.
- **Bulk import corrupting data.** This is the highest-impact risk, because one file can change thousands of records. Mitigated by the preview, all-or-nothing saving, sharing the add form's validation rules, rejecting duplicate emails within a file, and the round-trip AC (re-importing an export changes nothing).
- **Current salary drifting from history.** Mitigated by treating the latest history entry as the single source of truth, with tests on backdated and same-day changes.

## Decisions (confirmed 2026-10-24)
- **Backend:** Node.js + TypeScript + Express, with a relational database as the brief requires. The specific database, the frontend framework (React or Next.js, per the brief) and the component library are left for the architecture/planning stage.
- **Reference currency:** US dollars, for the organisation-wide comparison (Slice 9).
- **Countries:** the 8 listed under Assumptions (US, UK, India, Germany, Canada, Australia, Singapore, Japan), each with one currency.
- **Departments:** a fixed list, not editable by the HR Manager.
- **Page size:** fixed at 25 employees per page.
- **Removal through import:** not supported. Employees are marked as *left* only in the UI.
- **Effective date of imported salary changes:** the import date. The file does not carry an effective date.

## Open Questions
None blocking. Technical choices beyond the backend stack are decided at the architecture stage.

## Revised Assessment
Size: EPIC
Greenfield: yes

[x] Reviewed
