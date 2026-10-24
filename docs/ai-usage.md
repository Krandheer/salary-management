# AI Usage Log

How AI tools were used to build this project: the prompts I gave, what the AI produced, and the decisions I made or changed along the way.

## Tools

-   **Claude Code** (model: Claude Opus 5.5), the agentic coding CLI.
-   **Bee plugin** (v0.6.0), a spec-driven workflow for Claude Code. Each phase (discovery, spec, plan, build) produces a document I review before moving on. I request changes with inline `@bee` comments, and nothing proceeds until I mark the doc `[x] Reviewed`.

## Why this workflow

Ambiguous requirements are the main reason AI-generated code misses the mark. So I started with requirements discovery and a reviewed PRD, then a spec with testable acceptance criteria, before any code. Every AI-produced document goes through my review gate.

---

## Phase 1: Discovery & requirements

### 1. Start discovery

```
/bee:discover Salary management web app for ACME's HR manager: 10,000 employees across multiple countries, currently managed in Excel. HR must manage salary data and answer questions about how the org pays people.
```

**AI output:** a discovery PRD (`docs/specs/salary-management-discovery.md`).

-   **Part 1** is a one-page requirements section: goal, persona, prioritised features, and out of scope with reasons.
-   **Part 2** has hypotheses, 8 vertical slices with acceptance criteria, a module structure, risks and open questions.

The AI proposed defaults for my review: current salary only, no auth, currency set from the country, 8 countries, a fixed department list, 25 rows per page, and hard delete.

### 2. Review pass

```
check
```

Bee re-read the doc and found no annotations yet.

### 3. Scope change via inline review comment

I added this `@bee` annotation in the PRD:

```
@bee add salary history, add excel import/export, for employee add soft delete feature
```

**My decision:** I overrode three of the AI's "out of scope" defaults. Salary history, Excel import/export and soft delete are core to how an HR team really works: migrating off Excel, tracking raises, and not losing leavers' records.

**AI output:** added features 4, 5, 9 and 10 and 3 new slices, for 11 in total. It also:

-   Set defaults for the new features: backdated but never future-dated salary changes, emails unique across current and former employees, imports matched by email with a preview and all-or-nothing save, and export in the same layout as import.
-   Moved the leftover limits (scheduled raises, partial imports, permanent deletion) into out of scope.
-   Flagged bulk import as the highest data-integrity risk.

### 4. Stack + defaults confirmed

```
backend stack will nodejs typescript + express, i'm happy with your default as well
```

**My decisions:**

-   Node.js + TypeScript + Express backend.
-   I accepted the remaining defaults: USD as the reference currency, 8 countries, a fixed department list, page size 25, no removal via import, and an import date as the effective date for imported salary changes.

**AI output:** recorded these in a "Decisions" section and left no blocking open questions.

### 5. Approve

```
check
```

(after I marked `[x] Reviewed` in the PRD)

**AI output:** discovery marked complete.

### 6. One-page requirements doc + next-step advice

```
I have already done git init and make few commits as well, for 4. yes let's generate one separate docs named as requirement doc of 1 page, then tell me which will be best command bee:spec-writer or bee:sdd
```

**AI output:**

-   `docs/requirements.md`: a standalone one-page requirements doc covering goal, success criteria, features, stack, and what's left out and why.
-   A recommendation to use `/bee:spec-writer` → `/bee:planner` → `/bee:plan-implementer` rather than `/bee:sdd`. That chain writes tests before code, commits once per slice, and leaves a written plan as a design artifact.

### 7. Repo hygiene + this log

```
I will commit myself, can you can setup the .gitignore as well
```

**AI output:** this file and a Node.js `.gitignore`. The `.gitignore` excludes Bee's local workflow state file, which tracks per-developer progress and isn't a project artifact.

---

## Phase 2: Spec

### 8. Generate the spec

```
/bee:spec-writer
```

**AI output:** `docs/specs/salary-management-spec.md`, built from the reviewed discovery doc.

-   **Shared rules**, defined once and used by the add form, the edit form and import: reference data, validation rules, salary display format, and how the current salary is chosen.
-   **12 vertical slices**, with 7–12 testable acceptance criteria each. The AI split Excel import into "preview (saves nothing)" and "confirm & apply (all or nothing)" so each fits one plan.
-   Cross-cutting accessibility ACs, indicative API and data shapes, the template layout, an extended out-of-scope list, and technical guidance: pure statistics functions, an injectable clock, and paging and aggregation on the server.
-   20 new assumptions, listed for my confirmation.

### 9. Spec review: 7 inline comments

```
check
```

I added these `@bee` annotations in the spec:

```
@bee let's keep salary change reason as text for now with no length limits.
@bee if clickable option is possible then that should also be considered instead of only keyboard
@bee this should be delete instead of removal
@bee may be we should not give restoration option instead create new employee and if the employee already existed then link it with but not restoration to keep the history clean
@bee status should be active or inactive instead of left, inactive should be treated as left
@bee since max salary limit it just for validation lets increase it, add one more zero in it
@bee let's make name, email, title text field instead of varchar type lenght limit as this limit doesn't give any meaningful performance advantage but we will trim for left right white spaces and any other validation that needs except string length.
```

**My decisions:**

-   **No restore of deleted employees.** The AI had proposed restoring inactive records. I replaced that with *rehire as a new employee linked to the earlier record*, so each period of employment keeps a clean, separate salary history.
-   **Status `active` / `inactive`** instead of `left`, and the REST verb `DELETE` for the soft delete.
-   **No arbitrary length limits** on text fields. They don't give a meaningful performance or product benefit. Trimming and format checks stay.
-   **Looser salary maximums** (10×). They are only a typo check.
-   **Pointer and touch input** stated explicitly as an AC, alongside keyboard accessibility.

**AI output:**

-   Applied every change and left a comment card beside each one explaining the edit.
-   Rewrote Slice 6 around rehire and linking:
    -   email unique among *active* employees only
    -   the rehire's hire date must be after the earlier exit date
    -   linked employment records shown on the employee page
    -   import rows for inactive emails classified as unchanged, rehire or error
-   Flagged the trade-off: an accidental delete is fixed by re-adding the person, not by undoing it.
-   Flagged a consequence of my salary change: the INR and JPY maximums (4–7.5 billion) exceed 32-bit integers, so salaries need 64-bit storage. Added this as a technical note for the planner.
-   Kept `docs/requirements.md` and the discovery doc consistent with the new decisions.

### 10. Approve the spec

```
yes update ai-usage.md and check
```

(after I marked `[x] Reviewed` in the spec)

**AI output:** this log updated, and the spec marked as confirmed.

---

## Phase 3: Plan

_(next: `/bee:planner`)_
