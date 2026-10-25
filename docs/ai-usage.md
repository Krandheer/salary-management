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

### 11. Generate the execution plan

```
/bee:planner
```

**AI output:** `docs/plans/salary-management-plan.md`, a step-by-step plan for building each slice.

-   **Codebase scan:** a sub-agent scanned the (greenfield) repo and pulled the naming vocabulary from the spec.
-   **UI design brief:** a sub-agent drafted one (`.claude/DESIGN.md`).
-   **Stack checked against npm:** the AI ran `npm view` for current versions and peer dependencies instead of relying on memory. Two version choices came out of that:
    -   **TypeScript 6.0 instead of 7:** `typescript-eslint` only supports TypeScript below 6.1.
    -   **Node 24 LTS:** Vite 8, Vitest 5 and better-sqlite3 13 all need Node ≥ 22.12, and my machine had 22.2.
-   **Exchange rates** came from the European Central Bank reference rates (2026-10-23), not invented.
-   **Plan structure:** 14 slices. Each lists its structure, function signatures, control-flow outline, test strategy and quality checks. Model tiers are assigned by risk: the import slices get the strongest model. Mandatory security review is marked on the slices touching migrations, SQL built from user input, and the uploaded file.

### 12. Change the stack: Drizzle ORM and shadcn/ui

```
I update the node, and can you use drizzle orm instead of raw sql, and also can be use shadcn for ui, and yes keep updating ai-usage.md
```

**My decisions:**

-   **Drizzle ORM** instead of hand-written SQL, for a type-safe schema, generated migrations and typed queries.
-   **shadcn/ui** (Radix + Tailwind CSS v4) instead of Mantine as the component library.

**AI output:** the plan revised for both. Before rewriting it, the AI checked the libraries' installed type definitions and ran the shadcn CLI in a scratch Vite app, so the plan uses verified APIs:

-   Drizzle's better-sqlite3 transactions are synchronous.
-   Partial unique indexes are written as `uniqueIndex().on().where(sql…)`.
-   The current-salary view is created in a custom migration and queried as a typed `.existing()` view.

The design brief was also rewritten for shadcn/Tailwind tokens. It flagged that the shell's default `node` was still 22.2.0, although Node 24 is installed through nvm. Running `nvm alias default 24` fixes that.

### 13. Approve the plan

```
node default 24 is done, I reviewed the plan you can mark it review, plz update the ai usage log
```

**My decisions:** I reviewed the revised plan (Drizzle and shadcn/ui), approved it, and set Node 24 as my default runtime.

**AI output:** confirmed the nvm default alias is `24` and a fresh login shell resolves Node v24.22.1. It noticed that the agent's own shell, captured when the session started, still resolved 22.2.0, and flagged that before the build. It then marked the plan `[x] Reviewed` and updated this log.

---

## Phase 4: Build

### 14. Build the plan, test-first

```
/bee:plan-implementer but we have to write test first and have to increment build and commit
```

(followed by: `incremental i meant`)

**My decisions:**

-   **Strict test-first.** Every slice starts with failing tests, confirmed red before any production code.
-   **Two commits per slice,** so the history shows test-first: `test(...)` (red), then `feat(...)` (green).
-   **Commit straight to `main`.**

**AI output:**

-   The build runs one slice-builder agent per slice, in plan order, each on the model tier the plan assigned.
-   It flagged that the root `package.json` had an accidental dependency named `24` (from `npm i 24`), which Slice 1a replaces.
-   It noted that the session shell still resolved Node 22, so every build command is prefixed with Node 24's path.

**How the build ran:**

-   **One agent per slice:** each slice was built by a fresh agent on the model the plan assigned, in plan order.
-   **Commits per slice:** an optional `chore`, then `test(...)(slice N, red)`, then `feat(...)(slice N)`.
-   **Shared notes:** builders handed context to each other through a shared notes file (gitignored).
-   **Independent re-check:** after each slice the orchestrator re-ran lint, typecheck and the full test suite itself, rather than trusting the builder's report.

**Which model built which slice** (this matches each commit's `Co-Authored-By` trailer):

| Slice | What | Model tier → model |
|---|---|---|
| 1a | Workspace, schema, reference data, seed | excellent → Sonnet |
| 1b | Employee list API + UI shell | excellent → Sonnet |
| 2 | Search & filter | excellent → Sonnet |
| 3 | Add an employee, shared validation | excellent → Sonnet |
| 4 | Edit / update salary | excellent → Sonnet |
| 5 | Salary history | excellent → Sonnet |
| 6 | Soft delete & rehire | excellent → Sonnet |
| 7 | Country insights | excellent → Sonnet |
| 8 | Job-title insights | excellent → Sonnet |
| 9 | Org-wide USD comparison | fast → Haiku |
| 10 | Excel export & template | excellent → Sonnet |
| 11 | Import preview | best → Opus |
| 12 | Import apply (all or nothing) | best → Opus |
| 13 | Production serving, Docker, docs | excellent → Sonnet |
| Review fixes 1, 2, 5 | Data integrity, upload memory/XML hardening | best → Opus |
| Review fixes 3, 4 | Server refactors, web + test fixes | excellent → Sonnet |

The planning, orchestration and all review passes ran on Opus.

**A correction in the history:** in Slice 7 the red commit (`ddabb51`) encoded a wrong expected mean (`2,000,001`). The correct value is `2,000,000`, because the mean is 2,000,000.25, which rounds half-up to 2,000,000. The feat commit (`238fd93`) corrected the test, and its message doesn't say so. The implementation was right; the test-first expectation was wrong.

**A false start on Node:** the build shell kept resolving Node 22, so every build command was prefixed with Node 24's path rather than restarting the session.

## Phase 5: Review, fix, verify

### 15. End-of-spec review (automatic, part of `/bee:plan-implementer`)

Five review agents ran in parallel over the whole diff:

-   overall correctness and security, with a mandatory security pass over migrations, SQL built from user input, and the uploaded file;
-   module coupling;
-   test quality;
-   clean code;
-   commit-history practices.

The reviewers wrote probe scripts and reproduced bugs, not just read code. They found:

-   **HIGH: currency mismatch.** A backdated salary change made together with a country change left the current salary in the old currency. That corrupted insights and broke the export → import round trip.
-   **HIGH: one upload could exhaust memory.** A file under 10 MB unzipped to 95 MB, and the Excel library's in-memory model then reached about 1.5 GB of RSS, which would kill the planned 512 MB host.
-   **MED: rehire rule gaps.** The rule wasn't enforced on edits or import updates, and re-importing an inactive export could overwrite a rehired employee.
-   **MED: the flaky web test, root-caused.** A "Clear filters" assertion raced a React Query refetch, plus a stale debounced request. The orchestrator had seen the test fail twice but couldn't reproduce it in about 30 reruns.
-   **MED: a module cycle**, `employees` ↔ `spreadsheet`.
-   **MED: duplication and oversized files.** Grouping helpers, column mapping and date rules were duplicated, and the validation and repository files were too large.
-   **LOW: smaller gaps.** Country codes were shown instead of names, the rehire notice didn't name the person, some 404 tests would pass without the feature, and keyboard tests were missing for the cross-cutting ACs.

### 16. Fix batches (each test-first: a `test(...)(review fix, red)` commit, then `fix(...)`)

1.  **Current-salary currency and rehire rule.** A new append-only migration exposes the current salary's effective date, so a backdated change during a country move is rejected. The rehire rule now applies on edits and imports, and a row identical to any stored record counts as unchanged. The spec was updated to match (`28a6bb2`).
2.  **Upload memory.** The AI first checked exceljs's own streaming reader and found it mis-reads rich text and formula results. It also found that a row-count pre-scan doesn't bound memory. So it wrote a small streaming reader over jszip + saxes that reads only the parts the import needs, with tests checking it matches exceljs cell by cell. The unzipped limit dropped from 100 MB to 24 MB. Results: the 380k-row probe went from 1.43 GB to 106 MB, and a normal 20k-row file from 352 MB to 141 MB.
3.  **Behaviour-preserving refactors**, five commits:
    -   neutral read models in `employees/`, plus a lint rule that enforces module direction;
    -   one `groupBy`;
    -   single sources for the column mapping, the history rule and the "Starting salary" reason;
    -   the validation file split into focused rule files.
4.  **Web and test fixes:**
    -   "Clear filters" applies immediately;
    -   fake-timer debounce tests;
    -   country names in the UI, and the rehire notice now names the person;
    -   stronger 404 assertions;
    -   keyboard-only and visible-label tests;
    -   a 768px layout fix.
5.  **XML and zip hardening, found by re-review.** The reviewer re-ran its probes and found a 25 KB file of deeply nested XML still crashed Node. Fixes: caps on XML depth, attributes, shared strings, columns, zip entries, sheets, relationships and style records. Every crafted file now returns 400 in under about 0.6 s with a 256 MB heap.

### 17. Connect browser automation

```
can you connect browser automation tool as well to check screen
```

**AI output:** connected Claude in Chrome. The browser-verifier agent then drove the running production build through every slice's UI ACs and the cross-cutting checks:

-   pagination, filters, add, edit, history, delete, rehire notice, insights tabs and the import UI;
-   a visible focus ring, and no app console errors;
-   no horizontal scroll at 768px on four pages.

The orchestrator then checked the successful rehire path directly against the API, since the browser couldn't with today's dates. It also found and fixed perf tests being silently skipped by a fixture timeout when files ran in parallel (`5657dba`).

**Final state:**

| Check | Result |
|---|---|
| Server tests | 578 |
| Web tests | 144 |
| Perf tests | 11, all passing |
| Lint, typecheck, production build | green |
| Spec acceptance criteria | all ticked |

**Not done:** the Docker image has never been built, because the daemon wasn't running. The deploy itself is left to me.

### 18. Fix the Docker build and deploy on Render's free plan

I pasted the failing `docker build` output (the `npm ci --omit=dev ...` step exited with code 1) and asked whether Render would be free to deploy.

**AI output:**

-   **Found the real cause.** It reproduced the build with `--progress=plain` to see npm's actual error: npm ran an implicit `node-gyp rebuild` for better-sqlite3, and the slim image has no Python or compiler. This also showed that the earlier review's claim ("no install script, prebuilds are enough") was only half right. The prebuilds are bundled, but npm still tried to compile.
-   **Fixed it.** Both `npm ci` steps now pass `--ignore-scripts`. Before relying on that, it checked that the package bundles Linux prebuilds and that the lockfile marks no install script for it.
-   **Verified the image under the free tier's memory limit.** With `docker run --memory=512m` the container was healthy and seeded 10,000 employees on boot (about 213 MB). It served the UI and the API, and an export → import preview round trip through the container showed 10,000 unchanged rows at about 245 MB.
-   **Switched `render.yaml` to `plan: free`.** It checked Render's free-tier docs: there's no persistent disk, a service spins down after 15 minutes idle, and cold starts take about a minute. So the free deploy re-seeds demo data on every boot, and the README explains this trade-off.

### 19. Deployed

```
deployed https://acme-salary-management-t0zm.onrender.com/employees
```

**My action:** I deployed the Render Blueprint on the free plan.

**AI output:** it smoke-tested the live site.

-   **Health and routing:** `/api/health` returned 200, `/employees` served the app, and unknown `/api` paths returned a JSON 404.
-   **Data:** the API reported 10,000 seeded employees, and country insights took about 0.9 s.
-   **Browser:** a Chrome check showed the list page rendering with country names and formatted salaries, and no console errors.
-   **README:** it added the live URL, with a note about the free plan's cold starts and data resets.

### 20. Edit and Delete were hard to find

```
how to delete employee I couldn't find them and how to edit as well, clicking on employee name should take me to employee page having these options
```

**AI output:** it confirmed a real gap. Edit, Change salary and Delete were only on the employee's page, and nothing in the list linked to that page.

-   **Test first:** a red commit added list tests saying each name links to `/employees/:id` and can be reached with the keyboard.
-   **Fix:** each name in the list is now a link to the employee's page.
-   **Lesson:** the earlier browser check opened employee pages by typing their URLs, so it never noticed the missing link. Browser checks should follow the links a user would click.

### 21. Mermaid diagram failed to render on GitHub

I pasted GitHub's "Unable to render rich display" parse error for `docs/architecture.md`.

**AI output:** in Mermaid a `;` ends a statement, so the import sequence diagram's message "Confirm disabled; fix the file and preview again" was split in two. It replaced the `;` with a comma, checked no other diagram contains one, and rendered both diagrams with `mermaid-cli` to confirm they parse.
