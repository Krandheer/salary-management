# ACME Salary Management — Requirements

> One-page requirements, written before building. The full discovery (hypotheses, acceptance criteria per slice, risks) is in [`specs/salary-management-discovery.md`](specs/salary-management-discovery.md).

## Goal
ACME's HR team manages salary data for **10,000 employees across 8 countries in Excel**. Records are hard to find, edits are easy to get wrong, and every pay question needs a hand-built formula. We are building a web app that lets the **HR Manager** keep salary records accurate and answer *how the organisation pays people* in a few clicks.

## Success criteria
- Find any employee and see their current salary in seconds. Pages stay responsive with all 10,000 employees loaded.
- Add, edit and delete records in the browser, with invalid data rejected before it is saved.
- See every salary change an employee has had. Deleting never loses data.
- Answer *"min / max / average salary in country X?"* and *"average salary for job title Y in country X?"* in under a minute.
- Move data from Excel into the app and back out again without retyping.
- One seed command loads 10,000 realistic employees.

## Scope & features (in priority order)
1. **Browse:** paginated employee list, 25 per page, with salary in local currency.
2. **Search & filter:** by name, country, department and job title.
3. **Add & edit employees:** with validation. Currency is set from the country.
4. **Salary history:** every change is kept with an effective date and an optional reason.
5. **Soft delete & rehire:** "delete" marks an employee *inactive* with an exit date. Inactive records are hidden by default, kept read-only, and never restored. A returning employee is added as a new record, linked to their earlier one, so each period of employment keeps a clean salary history.
6. **Country insights:** headcount, min, max, mean and median salary per country, in local currency.
7. **Job-title insights:** the same statistics per job title within a country.
8. **Org-wide comparison:** average salary by country and by department in USD, using a fixed, dated exchange-rate table labelled as approximate.
9. **Excel export:** the filtered list as `.xlsx`, in the same layout the import accepts.
10. **Excel import:** `.xlsx` in a fixed template, matched to employees by email. A preview shows rows to create, update and fix. All rows are saved or none.

**Stack:** Node.js + TypeScript + Express, a relational database, and a React/Next.js UI.

## Deliberately left out (and why)
| Left out | Why |
|---|---|
| Login, accounts, roles | One persona and synthetic data only. Doing auth well is a project of its own and doesn't help answer pay questions. It is the first thing to add before real data goes in. |
| Payroll, tax, payslips, compliance | That is payroll software, with legal rules in every country. This app records pay. It doesn't pay people. |
| Bonuses, equity, benefits | Base salary answers the questions asked. Total compensation multiplies the data model and the statistics. |
| Live exchange rates | A fixed, dated table keeps figures predictable and testable, with no outside dependency. |
| Scheduled (future-dated) raises | Would make "current salary" depend on the date and need a background job. History covers changes that have already happened. |
| Field-level audit log | Without login there is no "who changed it". Salary history covers the change that matters most. |
| Partial imports, CSV, column mapping | All-or-nothing against one template keeps the data consistent. HR fixes the flagged rows and uploads again. |
| Approval workflows | Need multiple roles. There is one user. |
| Pay-equity analysis by demographics | Needs sensitive personal data and legal framing. It deserves its own decision, not a bolt-on. |
| Permanent deletion, retention rules, offboarding | Soft delete means a mistake never loses data. Retention rules vary by country and need a policy decision first. |
| Org chart, performance data | Not needed to answer how the organisation pays people. |
