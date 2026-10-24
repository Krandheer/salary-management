# Plan: ACME Salary Management

- **Spec:** [`docs/specs/salary-management-spec.md`](../specs/salary-management-spec.md) (reviewed)
- **Design brief:** `.claude/DESIGN.md`
- **Context:** `.claude/bee-context.local.md`
- **HEAD at planning:** `6016788ec6ec4009c266d4a4ea783db501fcb2a3`
- **Process tier:** full · **Risk:** MODERATE (highest-impact surface: bulk import, Slices 11–12)

---

## Plan-global header

### Stack (decided and version-checked against npm on 2026-10-24)

| Concern | Choice | Why |
|---|---|---|
| Runtime | **Node 24 LTS** (`v24.22.1`). `.nvmrc` = `24`. `engines.node` = `>=24` | Vite 8, Vitest 5 and better-sqlite3 13 all need Node ≥ 22.12. The local machine has 22.2.0, which is too old. |
| Language | **TypeScript `~6.0.3`** (not 7.x) | `typescript-eslint@8.72` supports TS `<6.1`, so TS 7 would break linting. |
| Monorepo | npm workspaces: `contracts/`, `server/`, `web/` | One install, one lockfile, and API types shared without duplication. |
| HTTP | **Express `^5.3`**, `@types/express@^5` | Express 5 forwards rejected promises from async handlers to the error middleware, so no wrapper is needed. |
| DB | **SQLite** via **better-sqlite3 `^13`** | Synchronous API and simple, reliable transactions, which suit all-or-nothing import. `:memory:` DBs make tests fast and repeatable. Single-user tool. |
| ORM | **drizzle-orm `0.45.4`** (the `latest` dist-tag; the 1.0 line is still an RC, so avoid it) with the `drizzle-orm/better-sqlite3` driver. **drizzle-kit `0.31.11`** generates migrations. | Developer decision. Gives a type-safe schema and queries, and SQL-like builders that stay readable. Migrations are generated as plain SQL files and committed. |
| Excel | **exceljs `4.4.0`** | Reads and writes `.xlsx` from a buffer, with date and number cell types. |
| Upload | **multer `^2.5`** (`memoryStorage`, `limits.fileSize` = 10 MB, `files` = 1) | Standard Express multipart handling. |
| Seed data | **@faker-js/faker `^10`**, seeded with per-locale instances | Realistic names for each country, and output is repeatable. |
| Server dev/run | **tsx `^4`** for `dev`, `start` and `seed`. `tsc --noEmit` only type-checks | No build step for the server, so no `.js` import-suffix noise. |
| UI | **React 19** + **Vite 8** + `@vitejs/plugin-react@^6` | The brief asks for React. A SPA served by Express in production makes one deployable unit. |
| Components | **shadcn/ui** (CLI `shadcn@4.22.1`, base **Radix** via `radix-ui@^1.8`, preset **Nova** → `style: "radix-nova"`) on **Tailwind CSS `^4.3`** (`@tailwindcss/vite`), `lucide-react` icons, `sonner` toasts | Developer decision. The components are copied into `web/src/components/ui/` as source we own. They are accessible because they're built on Radix, and theming uses CSS variables. |
| Forms | **react-hook-form `^7.91`** (no schema resolver) | Handles form state only. Rules stay on the server, and server `fieldErrors` are applied with `setError`. |
| Dates in forms | Native `<Input type="date">` with `min`/`max` | The value is already `YYYY-MM-DD`, it's keyboard- and screen-reader-friendly, and it needs no date-picker dependency. |
| Data fetching | **@tanstack/react-query 5** | Caching, query-key invalidation after changes, and loading and error states. |
| Routing | **react-router `^7.18`** (library mode: `createBrowserRouter` + `RouterProvider` from `react-router`) | v8 needs Node ≥ 22.22 and brings new APIs. The v7 data-router API is stable and well known. |
| Tests | **Vitest 5**: `node` environment for the server, `jsdom` for web. **supertest 7** for HTTP. **@testing-library/react 16**, `user-event 14`, `jest-dom 7` | Fast and isolated. One runner everywhere. |
| Lint/format | ESLint 10 flat config + `typescript-eslint@8.72` + `eslint-plugin-react-hooks@7`, Prettier 3 | |
| CI | GitHub Actions: Node 24, `npm ci` → `lint` → `typecheck` → `test` | |

**Library facts already settled (the executor doesn't need to look them up):**
- **Express 5 routing:**
  - A bare `'*'` route path throws. Serve the SPA fallback as a final `app.use` middleware for non-`/api` GET requests.
  - `req.query` is read-only.
  - The default query parser is "simple" (flat strings).
- **Drizzle with better-sqlite3** (checked in the installed `0.45.4` type definitions and source):
  - **Setup:** `drizzle({ client: sqlite, schema })` returns `BetterSQLite3Database<typeof schema>`, and the raw handle is `db.$client`.
  - **Queries are synchronous:** finish them with `.all()`, `.get()` or `.run()`.
  - **Transactions:** `db.transaction((tx) => T, { behavior? })` is **synchronous**. It wraps better-sqlite3's native `client.transaction`, so any statement on the same connection inside the callback, through `db` or `tx`, is part of the transaction. A throw rolls back. The callback must not be `async`.
  - **Indexes and constraints:** the third argument of `sqliteTable` is `(t) => [ ... ]`. Partial unique index: `uniqueIndex('ux_employees_active_email').on(t.email).where(sql\`${t.status} = 'active'\`)`. Composite index: `index('ix_…').on(t.a, t.b)`. Check constraint: `check('name', sql\`…\`)`. Foreign key: `integer('employee_id').notNull().references(() => employees.id)`.
  - **Column types:** `integer('amount')` maps to a JS `number` by default (SQLite INTEGER is 64-bit). `text('status', { enum: ['active','inactive'] })` gives a typed union.
  - **The view:** declare it as `sqliteView('current_salaries', { employeeId: integer('employee_id'), amount: integer('amount'), currency: text('currency') }).existing()`, and create it in a **custom migration** (`drizzle-kit generate --custom --name current_salaries_view`). Its SQL (the window function) is written once in that migration file.
  - **Migrations:** `migrate(db, { migrationsFolder })` from `drizzle-orm/better-sqlite3/migrator` is synchronous and tracks what's applied in `__drizzle_migrations`. `drizzle.config.ts` sets `{ dialect: 'sqlite', schema: './src/db/schema.ts', out: './drizzle' }`.
  - **Parameterisation:** Drizzle operators (`eq`, `and`, `asc`, `desc`, `count`, `min`) and `sql\`…${value}…\`` both bind values as parameters. `sql.raw()` does not, so it must never receive user input.
- **shadcn/ui** (checked by running the CLI in a scratch Vite app on 2026-10-24):
  - **Prerequisites before init:** Tailwind v4 + `@tailwindcss/vite`, `src/index.css` beginning with `@import "tailwindcss";`, `compilerOptions.baseUrl` and `paths: { "@/*": ["./src/*"] }` in both `tsconfig.json` and `tsconfig.app.json`, and `resolve.alias['@']` in `vite.config.ts`.
  - **Non-interactive init** (run in `web/`): `npx shadcn@4.22.1 init -t vite -b radix -p nova --no-monorepo -y`. Without `-p` it **stops at an interactive preset prompt**.
  - **What init generates:** `components.json` (`style: "radix-nova"`, `baseColor: "neutral"`, `iconLibrary: "lucide"`, `aliases` `@/components`, `@/lib/utils`, `@/components/ui`). `src/lib/utils.ts` re-exports `cn` from the **`cn`** package, which is shadcn's own. `src/index.css` gets `@import "tw-animate-css"`, `@import "shadcn/tailwind.css"`, a `:root` block of CSS variables, and `@theme inline`.
  - **Init also installs** the Geist font. Replace it with IBM Plex per the design brief.
  - **Add components:** `npx shadcn@4.22.1 add button input label select switch table badge alert alert-dialog tabs textarea card skeleton separator sonner field -y`.
  - **Form building blocks:** `field.tsx` exports `Field`, `FieldLabel`, `FieldDescription`, `FieldError`, `FieldGroup`, `FieldSet`, `FieldLegend`, `FieldContent`.
  - **Toasts:** the generated `sonner.tsx` imports `next-themes`. The app is light-only, so edit it to pass `theme="light"`, then remove the `next-themes` dependency (YAGNI).
- **Radix under jsdom:** in `web/test/setup.ts`, stub `ResizeObserver`, `window.matchMedia`, `Element.prototype.scrollIntoView`, `hasPointerCapture` and `releasePointerCapture`. Without these, Radix Select, Switch and Dialog throw or don't open in tests. Open a Select with `user.click(trigger)`, then pick the option by role `option`.
- **Vitest 5:**
  - `clearMocks` defaults to `true`.
  - Config files are not looked up in parent directories, so each workspace has its own `vitest.config.ts` and the root scripts call `npm run test --workspaces`.
  - Don't define `test.projects`.
  - `vi.mock` must be at module top level.
- **exceljs `cell.value` can be:** `null`, `number`, `string`, `boolean`, `Date` (date cells, at UTC midnight), `{ richText: [{ text }] }`, `{ text, hyperlink }` (Excel often turns typed emails into this), `{ formula, result }`, or `{ error }`.
  - A number in a cell not formatted as a date stays a number.
  - `workbook.xlsx.load(buffer)` rejects on non-zip input.
- **multer 2:** an oversize file raises `MulterError` with `code === 'LIMIT_FILE_SIZE'`.
- **better-sqlite3:**
  - `db.transaction(fn)` returns a function. A throw inside it rolls back.
  - Integers come back as JS `number`, which is safe up to 2^53. The largest possible sum is 20,000 × 7.5e9 = 1.5e14, well within that.
  - SQLite `INTEGER` is 64-bit, which covers the INR and JPY maximums.
  - Partial unique indexes (`... WHERE status = 'active'`) are supported.

**Exchange rates (resolved now, not left to the build):**
- **Source:** ECB euro reference rates, `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml`, dated **2026-10-23**. Units per 1 EUR: USD 1.1193, JPY 175.51, GBP 0.83728, INR 106.2720, CAD 1.5665, AUD 1.5939, SGD 1.4310.
- Store these values verbatim, plus the date and the source URL, in `reference/`. Derive `toUsd[c] = USD_per_EUR / c_per_EUR`, with EUR = 1.1193 and USD = 1.
- Approximate results: GBP ≈ 1.336829, CAD ≈ 0.714523, AUD ≈ 0.702240, SGD ≈ 0.782180, INR ≈ 0.010532, JPY ≈ 0.006377.

### Architecture & dependency direction

A **modular monolith with feature modules**. The modules come from the spec. Inside each server module there are four layers, and every dependency points inward:

```
routes (HTTP: parse request → call service → shape response)
   ↓
service (orchestration, transactions, uniqueness/rehire checks)
   ↓                  ↓
domain (pure: validation, classification, statistics; imports only reference/ and shared/)
repository (Drizzle queries against better-sqlite3)
```

- **Module dependencies** (one way only):
  - `reference/` depends on nothing.
  - `employees/` depends on `reference/` and `shared/`.
  - `insights/` and `spreadsheet/` depend on `employees/`, `reference/` and `shared/`.
  - `seed/` depends on `reference/` and `db/`.
  - Nothing depends on `seed/`, apart from `main.ts` for seed-on-empty.
- **No repository interfaces or factories (YAGNI).** Each repository has one implementation. Services take concrete repositories through constructor arguments. Tests use real in-memory SQLite, not mocks: it's fast, it's real, and we don't mock what we own.
- **Read models are the contract types.** Repository read methods return `EmployeeSummary`, `EmployeeDetail` and the other types from `@acme/contracts` directly. There's no separate DTO mapping layer. Writes go through domain validation first.
- **The composition root is `server/src/app.ts`.** `createApp({ db, clock })` builds the repositories, services and routers. `main.ts` loads config, opens the DB, migrates, optionally seeds, and listens.
- **Validation lives only on the server.** The web forms send what the user typed and show `fieldErrors` from the 400 response next to each field, via react-hook-form's `setError(field, { type: 'server', message })`, rendered with shadcn's `FieldError`. The client duplicates no rule (DRY: one source for every rule).
- **Transactions:** services wrap multi-step writes in `db.transaction(() => { ... })`. Repositories keep using the injected `db` inside the callback, which is safe because better-sqlite3's transaction covers the whole connection. There's no executor-passing ceremony.
- **"Today"** always comes from `Clock.today()`, an ISO date in the configured `APP_TIMEZONE` (default `UTC`). The web gets the server's date from `GET /api/reference` → `today`, so date-picker defaults and limits agree with the server.

### Repository layout

```
package.json  .nvmrc  tsconfig.base.json  eslint.config.js  .prettierrc  .github/workflows/ci.yml
contracts/   @acme/contracts: types only, exports "./src/index.ts" (no build)
server/      src/{main,app,config}.ts, src/shared/, src/db/ (schema, database, migrate), drizzle/ (generated migrations),
             drizzle.config.ts, src/reference/, src/employees/,
             src/insights/, src/spreadsheet/, src/seed/; test/ (helpers); perf/ (perf suite)
web/         src/{main,App,routes}.tsx, src/index.css (Tailwind + shadcn tokens), src/components/ui/ (shadcn, vendored),
             src/lib/utils.ts, src/api/, src/shared/, src/features/{employees,insights,spreadsheet}/; components.json;
             test/{setup.ts,render.tsx}
docs/        requirements, specs, plans, architecture.md (Slice 13), ai-usage.md
```

### Shared lexicon & naming

These come from the context file and the spec. Use them exactly.

- **Types:**
  - The contract types: `EmployeeSummary`, `EmployeeDetail`, `SalaryHistoryEntry`, `LinkedEmployment`, `ImportPreview`, `ReferenceData`, `EmployeeListPage`, `CountryInsight`, `JobTitleInsight`, `OrganisationComparison`.
  - Request bodies: `CreateEmployeeRequest`, `UpdateEmployeeRequest` (which carries `salaryChange`).
  - `EmployeeStatus = 'active' | 'inactive'`.
  - `IsoDate` (a `YYYY-MM-DD` string).
- **Field names:** `fullName`, `email`, `jobTitle`, `department`, `country` (an ISO code such as `IN`), `currency`, `annualSalary` (request), `currentSalary` (read), `employmentType`, `hireDate`, `exitDate`, `status`, `salaryHistory`, `linkedEmployments`, `effectiveDate`, `reason`, `recordedAt`.
- **`fieldErrors` keys** match request field paths: `fullName`, `email`, `jobTitle`, `department`, `country`, `annualSalary`, `employmentType`, `hireDate`, `salaryChange.amount`, `salaryChange.effectiveDate`, `salaryChange.reason`, `exitDate`.
- **Error codes:** `VALIDATION_FAILED` (400), `INVALID_QUERY` (400), `EMAIL_TAKEN` (409), `EMPLOYEE_INACTIVE` (409, used both for editing and for deleting an inactive employee), `NOT_FOUND` (404), `INVALID_FILE` / `FILE_TOO_LARGE` / `TOO_MANY_ROWS` / `NO_DATA_ROWS` / `HEADER_MISMATCH` (400, file-level), `IMPORT_REJECTED` (422, body carries `ImportPreview`), `IMPORT_NOT_APPLIED` (500).
- **Error body:** `{ error: { code, message, fieldErrors?, preview? } }`.
- **Domain errors** live in `server/src/shared/errors.ts`: `ValidationError(fieldErrors)`, `InvalidQueryError`, `EmailTakenError`, `EmployeeInactiveError`, `NotFoundError`, `ImportFileError(code)`, `ImportRejectedError(preview)`, `ImportNotAppliedError`. One `errorHandler` middleware maps them to HTTP. Anything unknown → 500 with a generic message, logged.
- **Normalised keys:**
  - `normalizeKey(text) = trim + toLowerCase`, in `server/src/shared/text.ts`. It's used for `name_key`, `job_title_key`, email storage and every case/space-insensitive match.
  - `trimToNull(text)` turns a reason made only of spaces into `null`.
- **Naming style:**
  - Files are `camelCase.ts`, React components `PascalCase.tsx`. Functions are verb-first, booleans start with `is`/`has`.
  - SQL columns are `snake_case`. Drizzle column properties are camelCase (`fullName: text('full_name')`), so no hand-written row mappers are needed beyond shaping contract types.
  - Tests are named by behaviour (`it('shows "No employees yet" when there are no employees')`).

### Database schema (Drizzle schema in `server/src/db/schema.ts`; migrations generated into `server/drizzle/` in Slice 1a; later slices add no migrations)

- `0000_*.sql` is generated by `drizzle-kit generate` from the schema: the tables, indexes and check constraints.
- `0001_current_salaries_view.sql` is a custom migration containing `CREATE VIEW current_salaries AS …`.
- Drizzle table names: `employees` and `salaryHistory` (`sqliteTable('salary_history', …)`). Column properties are camelCase and map to snake_case column names, e.g. `fullName: text('full_name')`. The view is `currentSalaries`.
- The shape below is the target DDL that the generated SQL must produce:

```
employees(
  id INTEGER PRIMARY KEY AUTOINCREMENT, full_name TEXT NOT NULL, name_key TEXT NOT NULL,
  email TEXT NOT NULL, job_title TEXT NOT NULL, job_title_key TEXT NOT NULL,
  department TEXT NOT NULL, country_code TEXT NOT NULL, employment_type TEXT NOT NULL,
  hire_date TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('active','inactive')),
  exit_date TEXT NULL, created_at TEXT NOT NULL,
  CHECK ((status = 'inactive') = (exit_date IS NOT NULL)))
UNIQUE INDEX ux_employees_active_email ON employees(email) WHERE status = 'active'
INDEX ix_employees_status_name   ON employees(status, name_key, id)
INDEX ix_employees_email         ON employees(email)
INDEX ix_employees_status_country ON employees(status, country_code, job_title_key)
salary_history(
  id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL REFERENCES employees(id),
  amount INTEGER NOT NULL CHECK (amount > 0), currency TEXT NOT NULL,
  effective_date TEXT NOT NULL, reason TEXT NULL, recorded_at TEXT NOT NULL)
INDEX ix_salary_history_employee ON salary_history(employee_id, effective_date DESC, id DESC)
VIEW current_salaries: one row per employee_id (amount, currency), the latest effective_date, ties → highest id
                       (ROW_NUMBER() OVER (PARTITION BY employee_id ORDER BY effective_date DESC, id DESC) = 1)
```

- **The current-salary rule lives in one place:** the `current_salaries` view (custom migration). Repository history queries order by the same `effective_date DESC, id DESC`, exported as one constant (`SALARY_HISTORY_ORDER = [desc(salaryHistory.effectiveDate), desc(salaryHistory.id)]`) in `employeeRepository.ts`. "Recorded later" means a higher `id`, because insertion order is monotonic. `recorded_at` is for display only.
- **Currency is not stored on `employees`.** It is always `currencyFor(country_code)` from `reference/`. Every `salary_history` row stores its own currency, so the history keeps currencies from before a country change.
- **"Unique among active" is enforced by the database itself,** through the partial unique index. The service still checks first, so it can return a friendly `EMAIL_TAKEN`.

### Testing conventions (all slices)

- **Server unit tests:** pure domain functions (validation, list-query parsing, statistics, job-title labels, import row parsing and classification, seed generation). File: `server/src/<module>/<name>.test.ts`, next to the source.
- **Server integration tests:** HTTP via supertest against `createTestApp({ today })` (`server/test/testApp.ts`), which gives a fresh in-memory DB, migrations, and `fixedClock(today)`. Builders are in `server/test/builders.ts` (`aCreateEmployeeRequest(overrides)` and `insertEmployee(db, overrides)` for fast direct setup). File: `server/src/<module>/<module>Routes.test.ts`.
- **Web component tests:** RTL + user-event via `renderWithProviders` (`web/test/render.tsx`: QueryClientProvider with `retry: false` + MemoryRouter + `<Toaster />`). They stub our own `web/src/api/*` functions with `vi.mock`. File: next to the component, `*.test.tsx`.
- **Performance ACs** live in a separate suite, `server/perf/*.perf.test.ts`, run with `npm run test:perf`. It is **not** part of `npm test`, so the default suite stays fast and repeatable as the brief requires. Each perf test seeds 10,000 employees into an in-memory DB using the real seed generator, then asserts on wall-clock time.
- No test depends on the system clock, network, run order or a shared DB.

### Tier rationale & distribution

Tiers follow difficulty and consequence. The two import slices, where one file can change thousands of records, get `best`. Standard feature work gets `excellent`. Simple aggregation that composes code already built gets `fast`.

**Distribution:** 2 best · 11 excellent · 1 fast (14 slice entries: spec Slice 1 is split into 1a/1b, plus delivery Slice 13).

**Hard floors:**
- **Slice 1a** (migrations).
- **Slice 2** (security: user-controlled input turned into SQL).
- **Slices 11 and 12** (security: an untrusted uploaded file is parsed and its data saved).

**Commits:** each slice ends with one conventional commit, e.g. `feat(employees): browse employees list (slice 1b)`. Scaffolding is `chore(...)`, and docs are `docs(...)`.

---

## Slice 1a: Walking skeleton: workspace, schema, reference data, seed

- **Spec ref:** Slice 1, the seed ACs (4): seed creates 10,000 active employees across all 8 countries and 10 departments; each has 1–4 history entries, the first on the hire date and all between the hire date and today; every salary is within the configured range for its country and title; re-running the seed gives the same 10,000 with no duplicates.
- **Design intent:**
  - Stand up the monorepo, tooling, DB schema and reference data.
  - Build a deterministic seed whose generation is a pure function, separate from writing to the DB.
  - No HTTP list endpoint yet; that's 1b. Only `GET /api/reference` here, to prove the server wiring end to end.

**Structure:**
- **Root files:**
  - `package.json` with workspaces `["contracts","server","web"]` and scripts: `dev` (server + web concurrently via `npm run dev -w server & npm run dev -w web`, or `concurrently@^9`), `build` (`npm run build -w web`), `start` (`npm run start -w server`), `seed`, `test`, `test:perf`, `lint`, `typecheck`, `format`.
  - `.nvmrc`, `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes: false`, `module: ESNext`, `moduleResolution: bundler`, `verbatimModuleSyntax`, `noEmit`), `eslint.config.js`, `.prettierrc`, `.github/workflows/ci.yml`.
  - Only `web/` is scaffolded as a placeholder, with `package.json` and an empty `src/main.tsx`, so the workspaces install. Its real setup is 1b.
- **`contracts/src/index.ts`:** `IsoDate`, `EmployeeStatus`, `CountryCode`, `CurrencyCode`, `ReferenceData { countries: {code,name,currency,maxAnnualSalary}[], departments: string[], employmentTypes: string[], exchangeRates: { asOf: IsoDate, source: string, toUsd: Record<CurrencyCode, number> }, today: IsoDate }`, `ApiErrorBody`.
- **`server/src/shared/clock.ts`:** `interface Clock { today(): IsoDate; now(): string }`, `systemClock(timeZone: string): Clock`, `fixedClock(today: IsoDate): Clock`.
- **`server/src/shared/text.ts`:** `normalizeKey(value: string): string`, `trimToNull(value: string | null | undefined): string | null`.
- **`server/src/shared/dates.ts`:** `isIsoDate(value: unknown): value is IsoDate` (real calendar date), `isAfter(a, b)`, `isOnOrBefore(a, b)`. These compare as ISO strings.
- **`server/src/shared/errors.ts`:** the domain error classes listed in the header. This slice only exercises `NotFoundError`.
- **`server/src/shared/errorHandler.ts`:** `errorHandler(logger): ErrorRequestHandler`, plus `notFoundHandler` for unknown `/api` routes.
- **`server/src/config.ts`:** `loadConfig(env: NodeJS.ProcessEnv): AppConfig { port, databasePath, timeZone, seedOnEmpty, webDistPath }`. Defaults: port `3000`, `./data/salary.db`, `UTC`, `false`, `../web/dist`.
- **`server/src/db/schema.ts`:** the Drizzle tables `employees` and `salaryHistory`, with indexes and checks as in the header, plus the `currentSalaries` view declared `.existing()`. Exports the inferred types `EmployeeRow = typeof employees.$inferSelect`, `NewEmployeeRow`, `SalaryHistoryRow`, `NewSalaryHistoryRow`.
- **`server/src/db/database.ts`:** `type AppDatabase = BetterSQLite3Database<typeof schema>`, `openDatabase(path: string): AppDatabase`. It creates the better-sqlite3 client and sets the pragmas `journal_mode = WAL` (file DBs only) and `foreign_keys = ON`, then `drizzle({ client, schema })`.
- **`server/src/db/migrate.ts`:** `runMigrations(db: AppDatabase): void`. It calls Drizzle's `migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })`, where `MIGRATIONS_FOLDER` is resolved from `import.meta.dirname` to `server/drizzle`.
- **`server/drizzle.config.ts`:** `defineConfig({ dialect: 'sqlite', schema: './src/db/schema.ts', out: './drizzle' })`.
- **`server/drizzle/`:** the generated `0000_*.sql` + `meta/` and the custom `0001_current_salaries_view.sql`, all committed. Add a server script `db:generate` (`drizzle-kit generate`).
- **`server/src/reference/referenceData.ts`:**
  - Constants: `COUNTRIES` (code, name, currency, maxAnnualSalary as in the spec table), `DEPARTMENTS`, `EMPLOYMENT_TYPES`, `ECB_RATES_PER_EUR`, `RATES_AS_OF = '2026-10-23'`, `RATES_SOURCE`.
  - Functions: `findCountry(code: string)`, `findCountryByName(name: string)` (case- and space-insensitive), `currencyFor(code: CountryCode): CurrencyCode`, `toUsdRates(): Record<CurrencyCode, number>`, `buildReferenceData(today: IsoDate): ReferenceData`.
- **`server/src/reference/referenceRoutes.ts`:** `referenceRouter(clock: Clock): Router`, serving `GET /api/reference`.
- **`server/src/app.ts`:** `createApp(deps: { db: AppDatabase; clock: Clock }): Express`, which mounts the routers, then `notFoundHandler`, then `errorHandler`. Static serving of the web build and the SPA fallback come in Slice 13.
- **`server/src/main.ts`:** loadConfig → openDatabase → runMigrations → if `seedOnEmpty` and there are no employees, seed → createApp → listen.
- **`server/src/seed/seedCatalogue.ts`:** constants only.
  - `JOB_CATALOGUE`: for each department, 3–5 titles, each with a US-baseline USD band `[min, max]`. Example: Engineering → Software Engineer [95k, 160k], Senior Software Engineer [140k, 210k], Engineering Manager [170k, 250k].
  - `COUNTRY_WEIGHTS`: US .30, IN .20, GB .12, DE .10, CA .08, AU .07, SG .07, JP .06.
  - `COUNTRY_PAY_FACTORS`: US 1.0, GB .75, DE .80, CA .80, AU .85, SG .80, JP .70, IN .25.
  - `SEED_RANDOM_SEED = 20261024`.
- **`server/src/seed/generateEmployees.ts`:**
  - `generateSeedEmployees(options: { count: number; randomSeed: number; today: IsoDate }): SeedEmployee[]`. Pure and deterministic.
  - `salaryBandFor(countryCode, title): { min: number; max: number }`: local currency, converted with `toUsdRates` and rounded to the nearest 100.
  - `SeedEmployee { fullName, email, jobTitle, department, countryCode, employmentType, hireDate, salaryHistory: { amount, effectiveDate, reason }[] }`.
- **`server/src/seed/seedDatabase.ts`:** `replaceAllEmployees(db: AppDatabase, employees: SeedEmployee[], recordedAt: string): void`. Runs as one `db.transaction`:
  - delete from `salaryHistory`, then from `employees`;
  - reset `sqlite_sequence` with `db.run(sql\`DELETE FROM sqlite_sequence WHERE name IN ('employees','salary_history')\`)`;
  - insert with `db.insert(employees).values(chunk).run()` in chunks of 500, with **explicit ids** (`index + 1`) so the history rows can reference them without a lookup, then history in chunks of 1,000.
- **`server/src/seed/runSeed.ts`:** the CLI entry. loadConfig → openDatabase → runMigrations → generate → replace → log the count.
- **`server/test/testApp.ts`:** `createTestDb(): AppDatabase` (`:memory:`, migrated), `createTestApp(options?: { today?: IsoDate }): { app, db, clock }`. A test that needs raw SQL (for example the Slice 12 trigger) uses `db.$client.exec(...)`.

**Collaborators:**
- `main` and `runSeed` → `db`, `seed`, `reference`.
- `seed` → `reference` (currencies, rates) and faker.
- `referenceRoutes` → `reference`, `Clock`.
- Nothing in `reference/` imports anything.

**Control flow:**
- **`generateSeedEmployees`:**
  - For each index in `0..count-1`, pick the country by weighted draw. The first 18 employees are assigned round-robin so that all 8 countries and all 10 departments are guaranteed to appear.
  - Pick the department, then the title.
  - Take the name from that country's faker locale (`fakerEN_US`, `fakerEN_GB`, `fakerDE`, `fakerEN_IN`, `fakerJA`, `fakerEN_CA`, `fakerEN_AU`, and `fakerEN` for SG). Each locale instance is seeded from `randomSeed` plus a fixed offset.
  - Build the email as `<slug(first)>.<slug(last)>.<index+1>@acme.example`. When a slug is empty (for example kanji names), use `employee.<index+1>@acme.example`.
  - Hire date: within the last 15 years, and ≤ today.
  - History: 1–4 entries. The first is on the hire date with reason "Starting salary" and an amount in the lower half of the band. Later entries are raises of 3–12% at increasing dates ≤ today, capped at the band maximum, with reasons "Annual review" or "Promotion".
- **`replaceAllEmployees`:** one transaction. Any throw rolls back everything.
- **Generating migrations:** write `schema.ts` → `npm run db:generate -w server` → generate the custom view migration with `npx drizzle-kit generate --custom --name current_salaries_view` and fill in its `CREATE VIEW` SQL → commit `server/drizzle/`. Never hand-edit the generated `0000_*.sql`.

**Test strategy (all new files):**
- `server/src/seed/generateEmployees.test.ts` (unit), covering all 4 seed ACs on a pure generated set (`count: 10_000`, fixed seed, `today: '2026-10-24'`):
  - the same seed gives deep-equal output;
  - all countries and departments are covered;
  - history count is 1–4, the first entry is on the hire date, and all dates are within [hire, today];
  - every amount is within `salaryBandFor` and ≤ the country maximum;
  - emails are unique.
- `server/src/seed/seedDatabase.test.ts` (integration, in-memory DB): running `replaceAllEmployees` twice gives exactly N employees, with the same emails both times and no duplicates.
- `server/src/db/migrate.test.ts` (integration):
  - `runMigrations` applied twice is a no-op;
  - the partial unique index rejects two **active** rows with the same email but allows active + inactive;
  - the `current_salaries` view picks the latest effective date, and on a same-day tie the higher id.
- `server/src/reference/referenceData.test.ts` (unit): `currencyFor` for all 8 countries; `findCountryByName(' india ')` → IN; `toUsd.USD === 1`, `toUsd.EUR === 1.1193`; GBP ≈ 1.336829 (`toBeCloseTo`, 6 dp).
- `server/src/reference/referenceRoutes.test.ts` (integration): `GET /api/reference` returns 8 countries, 10 departments, 3 employment types, rates with `asOf` 2026-10-23, and `today` from the fixed clock.

**Standards:**
- `clean-code: SRP`: generation (pure) is separate from persistence.
- `clean-code: constants over magic values`: all reference and catalogue values are named constants.
- `architecture-patterns: dependency direction`: `reference/` has no imports.
- `tdd-practices: test isolation`: no system clock, a fixed seed.

**Build-agent tier:** `excellent` · **FLOORED (migrations) — floor tier ≥ excellent.**

**Quality checks:**
- `npm ci && npm run lint && npm run typecheck && npm test` passes from a clean clone on Node 24.
- No module under `server/src/reference/` imports from any other `server/src` module (architecture-patterns).
- No call to `new Date()`, `Date.now()` or `Math.random()` inside `generateEmployees.ts` or any domain file. Time comes from the `Clock` or `today` parameter, and randomness from the seeded faker (tdd-practices: determinism).
- The schema contains the partial unique index on active email, and the `current_salaries` view migration is the only SQL definition of the current-salary rule (clean-code: DRY).
- `server/drizzle/` matches `schema.ts`: running `drizzle-kit generate` again produces "No schema changes". Migrations are append-only, and `runMigrations` is idempotent (migrations floor).
- Only `server/src/db/` and repositories import `drizzle-orm`. Domain files never do (architecture-patterns).
- The CI workflow runs lint, typecheck and test on Node 24.

---

## Slice 1b: Browse employees: list API and UI

- **Spec ref:** Slice 1, the list ACs (8): name/title/department/country/salary in the shared format; 25 per page with total and "Page X of Y"; next and previous paging; disabled controls on the first and last page; sorted by name A–Z ignoring case, ties broken by ID; "No employees yet"; an error message with retry; first page < 1 s at 10k.
- **Design intent:**
  - The thinnest end-to-end read path: the employee repository's list query, the HTTP endpoint, and a React page.
  - Set up the web app shell (theme, providers, routing, API client, state views) that every later UI slice reuses.

**Structure:**
- **`contracts/src/index.ts` (add):** `EmployeeSummary { id: number; fullName; jobTitle; department; country: CountryCode; currency: CurrencyCode; currentSalary: number; status: EmployeeStatus; exitDate: IsoDate | null }`, `EmployeeListPage { items: EmployeeSummary[]; page; pageSize; total; totalPages }`, `PAGE_SIZE = 25` (exported const).
- **`server/src/employees/employeeListQuery.ts`:** `EmployeeListQuery { page: number; status: EmployeeStatus }` (search and filters are added in Slice 2), `parseEmployeeListQuery(raw: Record<string, unknown>): EmployeeListQuery`, which throws `InvalidQueryError`.
- **`server/src/employees/employeeRepository.ts`:** `class EmployeeRepository { constructor(db: AppDatabase); listPage(query: EmployeeListQuery, pageSize: number): EmployeeListPage }`, plus the row mapper `toEmployeeSummary(row)`. The `SALARY_HISTORY_ORDER` constant also lives here.
- **`server/src/employees/employeeService.ts`:** `class EmployeeService { constructor(repository: EmployeeRepository, clock: Clock); listEmployees(query: EmployeeListQuery): EmployeeListPage }`.
- **`server/src/employees/employeeRoutes.ts`:** `employeeRouter(service: EmployeeService): Router`, serving `GET /api/employees`.
- **Web setup:**
  - `web/vite.config.ts`: react plugin, dev proxy `/api` → `http://localhost:3000`.
  - `web/vitest.config.ts`: jsdom, `setupFiles: ['./test/setup.ts']`.
  - **Tailwind + shadcn setup** in this order, following the library facts in the header:
    1. install `tailwindcss` and `@tailwindcss/vite`;
    2. add the `@/*` alias to both tsconfigs and to `vite.config.ts`;
    3. run `npx shadcn@4.22.1 init -t vite -b radix -p nova --no-monorepo -y` in `web/`;
    4. run `npx shadcn@4.22.1 add …` (the full component list);
    5. replace Geist with `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono`;
    6. put the design brief's `:root` tokens and the `@theme inline` mapping in `web/src/index.css`;
    7. make `sonner.tsx` light-only and drop `next-themes`.
  - Generated `web/src/components/ui/*` files are vendored source. They're excluded from lint rules that would force rewrites (`eslint.config.js` ignores `web/src/components/ui/**`), and they're only edited deliberately.
  - `web/index.html`, `web/src/main.tsx` (imports `index.css`; providers: QueryClientProvider, RouterProvider, `<Toaster />`).
  - `web/src/App.tsx`: `AppLayout`, a hand-built shell (56px header and 220px sidebar `<nav>` of `NavLink`s with lucide icons, using `aria-current="page"` for the active item; no shadcn `sidebar` block) with the nav (Employees, Insights, Import / Export). The last two are placeholder routes until their slices.
  - `web/src/routes.tsx`: `createAppRouter()` with routes `/` → redirect to `/employees`, and `/employees`.
- **`web/src/api/http.ts`:** `class ApiError extends Error { status; code; fieldErrors?; body }`, `requestJson<T>(path: string, init?: RequestInit): Promise<T>`, `buildQueryString(params: Record<string, string | number | boolean | undefined>): string`.
- **`web/src/api/employees.ts`:** `fetchEmployeePage(params: EmployeeListParams): Promise<EmployeeListPage>`, `useEmployeePage(params)` (React Query, `placeholderData: keepPreviousData`).
- **`web/src/api/reference.ts`:** `fetchReference()` and `useReference()` (`staleTime: Infinity`).
- **`web/src/api/queryKeys.ts`:** `queryKeys = { employees: { all, page(params), detail(id), jobTitles(params) }, insights: { all, ... }, reference }`.
- **`web/src/shared/format.ts`:** `formatSalary(amount: number, currency: CurrencyCode): string` → `"USD 85,000"` (en-US grouping, no decimals). This is the single display format. Also `formatDate(iso: IsoDate): string` (shows `YYYY-MM-DD` as is).
- **`web/src/shared/StateViews.tsx`:** `LoadingState`, `EmptyState({ title, description? })`, `ErrorState({ message, onRetry })`.
- **`web/src/features/employees/`:**
  - `EmployeeListPage.tsx`: owns the page and filter state.
  - `EmployeeTable.tsx` (`{ employees: EmployeeSummary[] }`): salary right-aligned with tabular numbers.
  - `PaginationBar.tsx` (`{ page, totalPages, total, onPageChange }`): "Page X of Y", "Previous" and "Next", each disabled at its end.
- **`web/test/setup.ts`** and **`web/test/render.tsx`:** `renderWithProviders(ui, { route? })`.

**Collaborators:** routes → service → repository. The web page → `api/employees` → `http`.

**Control flow:**
- **`parseEmployeeListQuery`:**
  - `page` missing → 1.
  - `page` not a positive integer → `InvalidQueryError`.
  - `status` missing → `active`; anything other than `active`/`inactive` → `InvalidQueryError`.
- **`listPage`:**
  - `db.select({ total: count() }).from(employees).where(eq(employees.status, status)).get()`.
  - Then select the page: `.innerJoin(currentSalaries, eq(currentSalaries.employeeId, employees.id))`, `.orderBy(asc(employees.nameKey), asc(employees.id))`, `.limit(pageSize).offset((page - 1) * pageSize).all()`.
  - `totalPages = max(1, ceil(total / pageSize))`.
  - A page past the end returns empty `items`.
  - All values go through Drizzle operators, so they're bound parameters.
- **`EmployeeListPage` UI:**
  - The query is loading and has no data → `LoadingState`.
  - Error → `ErrorState`, whose retry calls `refetch`.
  - `total === 0` with no filters → `EmptyState("No employees yet")`.
  - Otherwise → table + pagination.

**Test strategy (new files):**
- `server/src/employees/employeeListQuery.test.ts` (unit): defaults; invalid page (`0`, `-1`, `abc`, `1.5`) → `INVALID_QUERY`; invalid status.
- `server/src/employees/employeeRoutes.test.ts` (integration, created here and extended in later slices). Uses `insertEmployee` builders.
  - Page size 25, the total, and totalPages across 26 employees.
  - The order is case-insensitive (`"alice"` before `"Bob"`), and ties are ordered by id.
  - `currentSalary` and `currency` come from the latest history entry.
  - An empty DB → `{ items: [], total: 0, totalPages: 1 }`.
  - A bad query → 400 `INVALID_QUERY`.
- `server/perf/employeeList.perf.test.ts`: with 10k seeded, `GET /api/employees?page=1` responds in < 1000 ms. Add `server/vitest.perf.config.ts`, which includes only `perf/**`.
- `web/src/shared/format.test.ts` (unit): `formatSalary(85000,'USD')` → `"USD 85,000"`; INR 1,850,000; JPY 9,500,000.
- `web/src/features/employees/EmployeeListPage.test.tsx` (component, `api/employees` mocked):
  - renders rows with formatted salaries;
  - "Page 1 of 2", with "Previous" disabled on page 1 and "Next" disabled on the last page;
  - clicking "Next" requests page 2;
  - "No employees yet" when total is 0;
  - the error state shows a retry button, and clicking it fetches again.

**Standards:**
- `clean-code: one level of abstraction`: the page component composes `EmployeeTable` and `PaginationBar` and doesn't render raw rows inline.
- `clean-code: errors at boundaries`: the query is parsed in routes and the service assumes it is valid.
- `tdd-practices: behaviour-based naming`.

**Build-agent tier:** `excellent`

**Quality checks:**
- `employeeRepository.ts` builds every query with Drizzle's query builder or the `sql` tag with `${}` placeholders. `sql.raw()` is never called with a value derived from a request.
- `formatSalary` is the only place in `web/src` that formats a salary for display (clean-code: DRY).
- The route handler contains no SQL and no business rules. It parses, delegates and responds (architecture-patterns: thin controller).
- All interactive controls in the list are native elements or shadcn/Radix controls, reachable by keyboard with a visible focus ring (spec cross-cutting).
- The perf test passes via `npm run test:perf` and isn't included in `npm test`.

---

## Slice 2: Search & filter

- **Spec ref:** Slice 2 (9 ACs).
- **Design intent:**
  - Extend `EmployeeListQuery` with search, country, department and job title.
  - Add the job-title options endpoint.
  - Job-title normalisation and the display-label rule are defined here, once, and Slice 8 reuses them.

**Structure:**
- **`contracts`:** `EmployeeListParams { search?; country?; department?; jobTitle?; status?; page? }`, `JobTitleOptions { jobTitles: string[] }`.
- **`employeeListQuery.ts`:**
  - Extend to `EmployeeListQuery { page; status; searchKey: string | null; country: CountryCode | null; department: string | null; jobTitleKey: string | null }`.
  - Add `parseEmployeeFilters(raw)`, which the export (Slice 10) and the job-titles endpoint reuse. `parseEmployeeListQuery` = `parseEmployeeFilters` + page.
- **`server/src/employees/jobTitles.ts`:** `pickDisplayTitle(spellings: readonly string[]): string` (the most common trimmed spelling, ties → first by `localeCompare(…, 'en')`), `compareTitles(a: string, b: string): number`.
- **`employeeRepository.ts`:**
  - `buildFilterConditions(filters: EmployeeFilters): SQL | undefined`, an exported helper that `and(...)`s Drizzle conditions.
  - `listPage` now uses it.
  - `listJobTitleSpellings(filters): { jobTitleKey: string; jobTitle: string }[]`.
- **`employeeService.ts`:** `listJobTitleOptions(filters): string[]`, which groups by key, maps each group through `pickDisplayTitle` and sorts with `compareTitles`.
- **`employeeRoutes.ts`:** `GET /api/employees/job-titles`.
- **Web:**
  - `web/src/features/employees/EmployeeFilters.tsx` (`{ value: EmployeeFiltersValue; onChange; onClear; reference: ReferenceData; jobTitleOptions: string[] }`): a search `TextInput`, three `Select`s, and "Clear filters".
  - `api/employees.ts` adds `fetchJobTitleOptions` and `useJobTitleOptions`.
  - `EmployeeListPage` holds the filter state, debounces search by 300 ms (`useDebouncedValue(value, delayMs)` in `web/src/shared/useDebouncedValue.ts`, a small `useEffect` + `setTimeout` hook), resets the page to 1 on any filter change, and shows `EmptyState("No matching employees")` when filters are active and the total is 0.

**Collaborators:** as in 1b. `jobTitles.ts` is pure, with no imports outside `shared/`.

**Control flow:**
- **`parseEmployeeFilters`:**
  - `search` → `normalizeKey`; empty → null.
  - `country` must be a known code, or → `InvalidQueryError`.
  - `department` must be one of `DEPARTMENTS`, or → `InvalidQueryError`.
  - `jobTitle` → `normalizeKey`; empty → null.
- **`buildFilterConditions`:** always `eq(employees.status, status)`. Then, for each non-null filter, add a condition:
  - search → `sql\`instr(${employees.nameKey}, ${searchKey}) > 0\``. This avoids escaping LIKE wildcards and matches any letter case.
  - country → `eq(employees.countryCode, …)`.
  - department → `eq(employees.department, …)`.
  - job title → `eq(employees.jobTitleKey, …)`.
- **Job-title options:** the same filters except `jobTitle` itself (status, search, country, department).

**Test strategy:**
- Extend `employeeListQuery.test.ts`: unknown country or department → `INVALID_QUERY`; search trimmed and lower-cased; an empty string → null.
- New `server/src/employees/jobTitles.test.ts` (unit): the majority spelling wins; a tie → A–Z first; trimmed variants are grouped.
- Extend `employeeRoutes.test.ts`:
  - search case-insensitive and partial (`"ANA"` matches "Diana");
  - search containing `%` and `_` is treated literally;
  - each filter works alone and in combination, and the total and totalPages reflect the combination;
  - job-title filter `" software engineer "` matches "Software Engineer";
  - `/job-titles` returns each title once, A–Z, limited to the filtered set.
- New `web/src/features/employees/EmployeeFilters.test.tsx`, and extend `EmployeeListPage.test.tsx`:
  - the filters offer 8 countries and 10 departments;
  - changing a filter requests page 1;
  - "No matching employees" appears;
  - "Clear filters" resets everything and requests the unfiltered list.

**Standards:**
- `clean-code: DRY`: `parseEmployeeFilters` and `buildFilterConditions` are the single filter definition, reused by export.
- `clean-code: small functions`.
- `clean-code: fail fast`: unknown filter values are rejected at the boundary.

**Build-agent tier:** `excellent` · **FLOORED (security: user input turned into SQL) — floor tier ≥ excellent.**

**Quality checks:**
- `buildFilterConditions` uses only Drizzle operators and `sql` with `${}` placeholders. No `sql.raw()`, and no string concatenation of user input (security floor).
- A test proves a search for `%` doesn't match every row (security floor).
- `pickDisplayTitle` and `normalizeKey` are the only implementations of title grouping. No other module case-folds titles itself (clean-code: DRY).
- Filter UI controls each have a visible label (spec cross-cutting).

---

## Slice 3: Add an employee

- **Spec ref:** Slice 3 (11 ACs).
- **Design intent:**
  - Introduce the **shared validation rules** as pure functions. The edit form, the import and the rehire slice all reuse them.
  - Add the create endpoint and the add form.
  - The rehire path (an email that only inactive employees have) is covered in Slice 6. Here, an email used by an active employee → `EMAIL_TAKEN`, and the service is structured so Slice 6 only adds a branch.

**Structure:**
- **`contracts`:** `CreateEmployeeRequest { fullName; email; jobTitle; department; country; annualSalary; employmentType; hireDate }`. The values are `unknown`-tolerant on the server, so they are typed as strings/numbers on the client. Also `EmployeeDetail` (summary + `email`, `employmentType`, `hireDate`, `salaryHistory: SalaryHistoryEntry[]`, `linkedEmployments: LinkedEmployment[]`), `SalaryHistoryEntry`, `LinkedEmployment`, and `FieldErrors = Record<string, string>`.
- **`server/src/employees/employeeValidation.ts`:**
  - `EmployeeFields { fullName; email; jobTitle; department; countryCode; employmentType; hireDate; annualSalary }`: normalised and valid.
  - `validateEmployeeFields(input: Record<string, unknown>, context: { today: IsoDate }): { ok: true; fields: EmployeeFields } | { ok: false; fieldErrors: FieldErrors }`.
  - The rule helpers are all exported for import reuse: `validateFullName`, `validateEmail`, `validateJobTitle`, `validateDepartment`, `validateCountry`, `validateEmploymentType`, `validateHireDate(value, today)`, `validateAnnualSalary(value, countryCode)`. Each returns `string | null`, the error message.
  - `isWellFormedEmail(value: string): boolean`.
- **`employeeRepository.ts`:** `findActiveIdByEmail(email): number | null`, `insertEmployee(fields: EmployeeFields, recordedAt: string): number`, which inserts the employee and the first history entry (reason "Starting salary", effective on the hire date, currency from `currencyFor`). `getDetail(id): EmployeeDetail | null` returns the history ordered by `SALARY_HISTORY_ORDER`. `linkedEmployments` is `[]` until Slice 6.
- **`employeeService.ts`:** `createEmployee(input: Record<string, unknown>): EmployeeDetail`, `getEmployee(id: number): EmployeeDetail`. The latter throws `NotFoundError`.
- **`employeeRoutes.ts`:** `POST /api/employees` → 201, and `GET /api/employees/:id` (`:id` must be a positive integer, otherwise 404).
- **Web:**
  - `web/src/features/employees/EmployeeForm.tsx` (`{ mode: 'create' | 'edit'; initialValues; reference; onSubmit(values): Promise<void>; submitting; serverErrors?: FieldErrors }`). It uses react-hook-form `useForm<EmployeeFormValues>()`; shadcn `Field` + `FieldLabel` + `Input` for the text fields; Radix-based `Select` through react-hook-form's `Controller` for department, country and employment type; a salary `Input` (`inputMode="numeric"`, sent as the raw string so the server's whole-number rule decides) with the currency code shown read-only next to it, derived from the chosen country; and `Input type="date"` for hire date (`max` = reference `today`).
  - It applies `serverErrors` with `setError(field, { type: 'server', message })` and renders them with `FieldError`. Inputs get `aria-invalid` and `aria-describedby` for their error.
  - `web/src/features/employees/employeeFormValues.ts`: `EmployeeFormValues`, `toCreateRequest(values)`, `toUpdateRequest(initial, values)` (changed fields only).
  - `AddEmployeePage.tsx` (route `/employees/new`): on 400 → pass `fieldErrors` as `serverErrors`; on 409 `EMAIL_TAKEN` → an error on the email field; on success → invalidate `employees.all` and `insights.all`, show a `toast.success`, and navigate to `/employees/:id`.
  - A minimal `EmployeeDetailPage.tsx` (route `/employees/:id`) showing the details, so "appears in the list" and the redirect can be verified. Slice 4 extends it.
  - `api/employees.ts` adds `createEmployee` and `fetchEmployee`/`useEmployee`.
  - An "Add employee" button goes on the list page.

**Collaborators:** routes → service → (`employeeValidation`, repository). Validation imports only `reference/` and `shared/`.

**Control flow:**
- **`validateEmployeeFields`:** run every field rule and collect **all** errors, without stopping at the first failure. If any error exists → `{ ok: false }`. Otherwise return normalised fields: names and titles trimmed, email trimmed and lower-cased.
- **Salary rule:** missing → required. Not an integer (a number with a fraction, or digit-free text) → "whole number". ≤ 0 → error. > `findCountry(countryCode).maxAnnualSalary` → error. The maximum check is skipped if the country itself is invalid.
- **Hire date:** not `isIsoDate` → error. < `1950-01-01` or > today → error.
- **`createEmployee`:** validate → errors → `ValidationError`. `findActiveIdByEmail` hit → `EmailTakenError` (Slice 6 adds the inactive branch before insert) → `insertEmployee` → `getDetail`.

**Test strategy:**
- New `server/src/employees/employeeValidation.test.ts` (unit, table-driven per rule):
  - required fields;
  - whitespace-only → required;
  - trimming;
  - email formats (valid; missing `@`; two `@`; a space; no dot in the domain);
  - salary 0, −1, 1.5, `"abc"`, exactly the maximum (accepted), maximum + 1;
  - hire date in the future, 1949-12-31, 1950-01-01 (accepted), today (accepted), `2026-02-30` (invalid);
  - unknown department, country or employment type.
- Extend `employeeRoutes.test.ts`:
  - POST valid → 201, and the employee then appears in `GET /api/employees`;
  - one history entry, "Starting salary", effective on the hire date, currency from the country;
  - invalid → 400 with `fieldErrors` for every bad field and nothing inserted (count unchanged);
  - duplicate active email with different letter case → 409 `EMAIL_TAKEN`;
  - `GET /api/employees/999` → 404.
- New `web/src/features/employees/AddEmployeePage.test.tsx` (api mocked):
  - the currency shown follows the chosen country and isn't editable;
  - server `fieldErrors` appear as text next to the fields;
  - a 409 shows the email error;
  - success navigates to the detail page.

**Standards:**
- `clean-code: SRP` (one validator per rule).
- `clean-code: errors at boundaries`.
- `clean-code: domain-specific errors`.
- `tdd-practices: boundary tests` (maximum, maximum + 1, 1950-01-01).

**Build-agent tier:** `excellent`

**Quality checks:**
- `employeeValidation.ts` imports nothing from `express`, `better-sqlite3` or any repository (architecture-patterns: pure domain).
- There are no length checks on text fields anywhere (spec decision).
- `web/src` contains no validation rule (no `rules`/`required` options on `register`). All rule messages shown come from server `fieldErrors` (DRY).
- A 400 response never leaves a partial row (an integration test asserts the count is unchanged).

---

## Slice 4: Edit an employee / update salary

- **Spec ref:** Slice 4 (9 ACs).
- **Design intent:**
  - `PATCH` merges the changed fields onto the stored record and re-validates the merged result with the **same** rules.
  - It refuses a country change without a new salary.
  - It refuses a hire date later than the earliest history entry.
  - The salary-change entry itself, with its effective date and reason, is built here as the minimal path, an amount with effective date today. Slice 5 adds effective-date and reason handling and the no-op rule.

**Structure:**
- **`contracts`:** `UpdateEmployeeRequest { fullName?; email?; jobTitle?; department?; country?; employmentType?; hireDate?; salaryChange?: { amount; effectiveDate?; reason? } }`.
- **`employeeValidation.ts`:** add `validateEmployeeUpdate(current: EmployeeFields, patch: Record<string, unknown>, context: { today; earliestSalaryDate: IsoDate; currentSalary: number }): { ok: true; fields: EmployeeFields; salaryChange: ValidSalaryChange | null } | { ok: false; fieldErrors }`.
- **`employeeRepository.ts`:**
  - `getEditableState(id): { fields: EmployeeFields; status: EmployeeStatus; earliestSalaryDate: IsoDate; currentSalary: number; currentCurrency: CurrencyCode } | null`.
  - `findActiveIdByEmailExcluding(email, id): number | null`.
  - `updateEmployeeFields(id, fields)`, which also refreshes `name_key` and `job_title_key`.
  - `insertSalaryEntry(employeeId, entry: { amount; currency; effectiveDate; reason: string | null }, recordedAt)`.
- **`employeeService.ts`:** `updateEmployee(id: number, patch: Record<string, unknown>): EmployeeDetail`. It runs in one `db.transaction`.
- **`employeeRoutes.ts`:** `PATCH /api/employees/:id`.
- **Web:**
  - `EditEmployeePage.tsx` (route `/employees/:id/edit`) reuses `EmployeeForm` in `mode: 'edit'`, prefilled from `useEmployee`.
  - It adds a "Change salary" section: an `Input` (`inputMode="numeric"`) for the new amount, empty by default. The effective date and reason come in Slice 5.
  - Changing the country updates the displayed currency.
  - On submit, send only the changed fields, plus `salaryChange` when an amount is entered.
  - 404 → `EmptyState("Employee not found")`.
  - Extend `EmployeeDetailPage` with all the fields the AC lists (ID, name, email, title, department, country, currency, current salary, employment type, hire date, status) and an "Edit" button.

**Control flow:**
- **`updateEmployee`:**
  - Load state → missing → `NotFoundError`. (`status === 'inactive'` → `EmployeeInactiveError` is added in Slice 6. Write the guard now, because the status column exists.)
  - `validateEmployeeUpdate`:
    - merge the patch onto the current fields;
    - run `validateEmployeeFields` on the merged fields, passing the new salary when one is given and otherwise the current salary, so the maximum is checked against the merged country;
    - country changed and no `salaryChange.amount` → `fieldErrors['salaryChange.amount']`;
    - merged hire date > `earliestSalaryDate` → `fieldErrors.hireDate`.
  - Email changed → `findActiveIdByEmailExcluding` hit → `EmailTakenError`. Keeping your own email is fine.
  - Then update the fields, and insert a salary entry when `salaryChange` is present, in the currency of the merged country.
  - Return `getDetail`.

**Test strategy:**
- Extend `employeeValidation.test.ts`:
  - the merged result is re-validated;
  - a country change without a salary is an error;
  - a hire date after the earliest entry is an error, and equal to it is accepted;
  - a salary above the **new** country's maximum is an error.
- Extend `employeeRoutes.test.ts`:
  - PATCH title → reflected in detail and list;
  - PATCH salary → the list shows the new amount;
  - own email unchanged → 200, and another active employee's email → 409;
  - country change with a salary → the currency changes; without one → 400 `salaryChange.amount`;
  - an unknown id → 404 for both GET and PATCH;
  - an invalid patch changes nothing.
- New `web/src/features/employees/EditEmployeePage.test.tsx`:
  - prefilled values;
  - changing country shows the new currency;
  - the submitted payload contains only the changed fields;
  - "Employee not found" on 404.

**Standards:**
- `clean-code: DRY` (edit reuses `validateEmployeeFields`).
- `clean-code: least surprise` (`getEmployee` has no side effects).
- `clean-code: one level of abstraction` in `updateEmployee`.

**Build-agent tier:** `excellent`

**Quality checks:**
- Updates and the salary entry are written inside one transaction. The test "invalid patch changes nothing" passes.
- `validateEmployeeUpdate` calls `validateEmployeeFields` rather than re-implementing any field rule (clean-code: DRY).
- `EmployeeForm` is shared by the add and edit pages, with no copy-pasted form (clean-code: DRY).

---

## Slice 5: Salary history

- **Spec ref:** Slice 5 (10 ACs).
- **Design intent:**
  - Complete salary-change semantics: effective date (defaults to today, can be backdated), optional reason, and the no-op rule.
  - Show the full history on the detail page.
  - The current-salary rule is already in the view. This slice proves its tie-break and backdating behaviour end to end.

**Structure:**
- **`employeeValidation.ts`:** `validateSalaryChange(input: unknown, context: { today; hireDate: IsoDate; countryCode }): { ok: true; change: ValidSalaryChange } | { ok: false; fieldErrors }`, where `ValidSalaryChange { amount; effectiveDate; reason: string | null }`. `validateEmployeeUpdate` now delegates to it.
- **`employeeService.updateEmployee`:** apply the no-op rule. If the amount equals the current salary **and** the country is unchanged, insert no entry.
- **Web:**
  - `web/src/features/employees/SalaryHistoryTable.tsx` (`{ entries: SalaryHistoryEntry[] }`): amount (formatted), currency, effective date, and reason ("—" when null). The entries arrive already ordered.
  - The edit page's "Change salary" section adds an `Input type="date"` effective date (default = reference `today`, `max` = today, `min` = hire date) and a shadcn `Textarea` reason with no length limit.
  - The detail page shows `SalaryHistoryTable` and marks the current row with a "Current" badge, which is the first entry.

**Control flow:**
- **`validateSalaryChange`:**
  - the amount uses `validateAnnualSalary`;
  - `effectiveDate` missing → today; not an ISO date, > today, or < hire date → error under `salaryChange.effectiveDate`;
  - reason → `trimToNull`.
- **The hire date for this check** is the merged hire date.

**Test strategy:**
- Extend `employeeValidation.test.ts`: effective date default; future → error; before the hire date → error; equal to the hire date → accepted; a whitespace-only reason → null; a long reason (10,000 characters) → accepted.
- Extend `employeeRoutes.test.ts`:
  - a change adds an entry and earlier entries are unchanged;
  - the history is newest first;
  - **same-day tie:** two entries on the same date → the later one is current and listed first;
  - **backdated:** an entry before the current one is added but the list's `currentSalary` is unchanged;
  - same amount and same country → no entry added;
  - after a country change → the new entry has the new currency and old entries keep theirs.
- New `web/src/features/employees/SalaryHistoryTable.test.tsx` (renders rows, "—" for no reason, "Current" on the first row). Extend `EditEmployeePage.test.tsx`: the effective date defaults to the server's today, and the payload includes `salaryChange.effectiveDate` and `reason`.

**Standards:** `tdd-practices: edge cases` (tie, backdating, boundaries), `clean-code: SRP`.

**Build-agent tier:** `excellent`

**Quality checks:**
- No code outside the `current_salaries` view and `SALARY_HISTORY_ORDER` decides which entry is current (clean-code: DRY, spec risk "current salary drifting from history").
- Integration tests cover both the same-day tie and the backdated entry.
- History rows are never updated or deleted by any code path. Only inserts (spec out of scope: editing history).

---

## Slice 6: Delete (soft delete) & rehire

- **Spec ref:** Slice 6 (13 ACs).
- **Design intent:**
  - Soft delete sets the status to inactive with an exit date. Inactive records are read-only.
  - A rehire is a normal create with an email that only inactive employees have. The new record links to them by email; there's no foreign key.
  - **The rehire hire-date rule is one pure function**, reused by Slice 11.

**Structure:**
- **`contracts`:** `EmailCheckResult { activeEmployeeId: number | null; inactiveEmployees: LinkedEmployment[] }`.
- **`employeeValidation.ts`:**
  - `validateExitDate(value: unknown, context: { today; hireDate }): string | null`.
  - `validateRehireHireDate(hireDate: IsoDate, latestInactiveExitDate: IsoDate | null): string | null`. Returns an error when the hire date is ≤ that exit date.
- **`employeeRepository.ts`:**
  - `deactivate(id, exitDate)`.
  - `findInactiveByEmail(email): LinkedEmployment[]`, ordered by `exit_date DESC, id DESC` (the first is "most recent").
  - `listLinkedEmployments(email, excludeId): LinkedEmployment[]`, ordered newest hire first.
  - `getDetail` now fills `linkedEmployments`.
- **`employeeService.ts`:**
  - `deleteEmployee(id: number, exitDate: unknown): EmployeeDetail`.
  - `checkEmail(email: string): EmailCheckResult`.
  - `createEmployee` gains the rehire branch.
- **`employeeRoutes.ts`:** `DELETE /api/employees/:id?exitDate=` and `GET /api/employees/email-check?email=`.
- **Web:**
  - `DeleteEmployeeDialog.tsx` (`{ employee: EmployeeDetail; today: IsoDate; open; onOpenChange; onDeleted }`), built on shadcn `AlertDialog`: a confirmation message explaining that the record is kept as inactive; exit date `DateInput` (default today); `AlertDialogCancel` gets focus by default (`onOpenAutoFocus` focuses it), as the design brief says; the exit date is an `Input type="date"`; "Delete" is the confirm action.
  - `LinkedEmploymentsList.tsx` (`{ items: LinkedEmployment[] }`): ID, hire, exit, status badge, and a link to each record.
  - `StatusBadge.tsx` in `web/src/shared/`: Active or Inactive, with an icon and text, not colour alone.
  - The detail page:
    - inactive → "Inactive" badge, exit date, and **no** Edit, Delete or Change-salary controls;
    - active → a "Delete" button.
  - The list page adds a "Show inactive employees" shadcn `Switch` with a `Label`, which sends `status=inactive`, resets to page 1 and shows an Exit date column.
  - The add page calls `checkEmail` on email blur and shows a shadcn `Alert` naming the inactive employee, with the notice that saving creates a new linked record.
  - `api/employees.ts` adds `deleteEmployee` and `checkEmail`.

**Control flow:**
- **`deleteEmployee`:** not found → 404. Inactive → `EmployeeInactiveError`. Invalid exit date (missing → today, future, or before the hire date) → `ValidationError{exitDate}` → `deactivate` → detail.
- **`createEmployee`:**
  - validate;
  - active email → `EmailTakenError`;
  - otherwise `findInactiveByEmail` → if any, `validateRehireHireDate(fields.hireDate, latest.exitDate)` → error → `ValidationError{hireDate}`;
  - insert. Linking is implicit through the shared email.
- **`updateEmployee`:** the inactive guard → `EmployeeInactiveError` (409).

**Test strategy:**
- Extend `employeeValidation.test.ts`: exit-date rules; rehire hire date equal to the exit date → error, the next day → accepted.
- Extend `employeeRoutes.test.ts`:
  - DELETE → status inactive and the exit date set; gone from the default list; present in `status=inactive`, where search and filters still apply;
  - DELETE again → 409; PATCH on inactive → 409; DELETE with an unknown id → 404; a future exit date → 400;
  - create with an inactive employee's email:
    - a hire date after the exit date → 201, a new id, a fresh history, and both records list each other in `linkedEmployments`;
    - the inactive record is otherwise unchanged;
    - a hire date on or before the exit date → 400 `hireDate`;
  - `email-check` returns the active id or the inactive list.
- New `web/src/features/employees/DeleteEmployeeDialog.test.tsx` (default exit date; Cancel leaves the record untouched; Delete calls the API). Extend `EmployeeDetailPage.test.tsx` (inactive hides the controls; linked employments render with links) and `AddEmployeePage.test.tsx` (the rehire notice appears after email blur).

**Standards:** `clean-code: domain-specific errors`, `clean-code: DRY` (`validateRehireHireDate` is shared with import), `tdd-practices: boundary tests`.

**Build-agent tier:** `excellent`

**Quality checks:**
- No endpoint or code path sets an inactive employee back to active (spec: no restore).
- No `db.delete(employees)` or `db.delete(salaryHistory)` call exists outside `seed/` (soft delete only).
- `validateRehireHireDate` is the only implementation of the rehire rule (DRY). Slice 11 must import it.
- Status is shown with text plus an icon, never by colour alone (spec cross-cutting).

---

## Slice 7: Country pay insights

- **Spec ref:** Slice 7 (9 ACs).
- **Design intent:**
  - Pure statistics functions with integer-safe half-up rounding.
  - One repository read of active current salaries. The service groups by country.
  - The Insights page shell with tabs, where Slices 8 and 9 add their tabs.

**Structure:**
- **`contracts`:** `SalaryStats { headcount; min; max; mean; median }`, `CountryInsight = SalaryStats & { country: CountryCode; countryName: string; currency: CurrencyCode }`, `CountryInsights { countries: CountryInsight[] }`.
- **`server/src/insights/statistics.ts`:**
  - `summarizeSalaries(amounts: readonly number[]): SalaryStats`. A precondition: non-empty, otherwise `RangeError`.
  - `meanRoundedHalfUp(amounts: readonly number[]): number`.
  - `medianRoundedHalfUp(sortedAmounts: readonly number[]): number`.
- **`employeeRepository.ts`:** `listActiveCurrentSalaries(): ActiveSalaryRow[]` with `{ countryCode; department; jobTitle; jobTitleKey; amount; currency }` for every **active** employee (`JOIN current_salaries`). One query, reused by Slices 8 and 9.
- **`server/src/insights/insightsService.ts`:** `class InsightsService { constructor(employees: EmployeeRepository); countryInsights(): CountryInsights }`.
- **`server/src/insights/insightsRoutes.ts`:** `insightsRouter(service): Router`, serving `GET /api/insights/countries`.
- **Web:**
  - `web/src/features/insights/InsightsPage.tsx` (route `/insights`): shadcn `Tabs` with "By country", "By job title" and "Organisation". The last two are placeholders until Slices 8 and 9.
  - `CountryInsightsTable.tsx` (`{ rows: CountryInsight[]; onSelectCountry(code) }`): amounts via `formatSalary`, right-aligned. A row action, "View job titles", goes to the job-title tab, which Slice 8 wires up.
  - `api/insights.ts`: `useCountryInsights()` with `staleTime: 0`. Mutations invalidate `insights.all`; adding to that set is required for Slices 3–6.

**Control flow:**
- **`summarizeSalaries`:** sort ascending (copy) → min = first, max = last → mean and median with half-up rounding.
- **Rounding uses integer-only arithmetic:** no float division before rounding. An even count averages the two middle values, then rounds half up.
- **`countryInsights`:** group rows by `countryCode` (groups exist only for countries that have actives) → summarize → sort by country name A–Z.

**Test strategy:**
- New `server/src/insights/statistics.test.ts` (unit):
  - an odd count;
  - an even count (median = average of the middle two);
  - half-up rounding of the mean (`[1, 2]` → 2) and of the median (`[1, 2]` → 2; `[1, 4]` → 3);
  - a single value → all equal;
  - large INR values with no precision loss (`[4_000_000_000, 3_999_999_999]`);
  - unsorted input;
  - empty input → throws.
- New `server/src/insights/insightsRoutes.test.ts` (integration):
  - per-country figures match hand-computed ones;
  - inactive employees are excluded;
  - countries with no actives are absent;
  - the figures change after a create, a salary change, a country change and a delete;
  - an empty DB → `countries: []`.
- New `server/perf/insights.perf.test.ts`: < 1000 ms at 10k.
- New `web/src/features/insights/InsightsPage.test.tsx`: the table renders formatted figures, and "No employees yet" shows when empty.

**Standards:**
- `clean-code: pure functions` (statistics has no imports).
- `tdd-practices: meaningful assertions` (hand-computed expected values).
- `architecture-patterns: insights → employees` (one-way).

**Build-agent tier:** `excellent`

**Quality checks:**
- `statistics.ts` imports nothing.
- No floating-point division happens before a mean or median is rounded (spec risk: wrong statistics).
- `employees/` imports nothing from `insights/` (architecture-patterns).
- Every create, update and delete success handler in `web/src` invalidates both `employees.all` and `insights.all`.

---

## Slice 8: Job-title insights within a country

- **Spec ref:** Slice 8 (7 ACs).
- **Design intent:** group the same active-salary rows by `jobTitleKey` within one country, label each group with `pickDisplayTitle` (Slice 2), and summarize each with `summarizeSalaries` (Slice 7). No new rules.

**Structure:**
- **`contracts`:** `JobTitleInsight = SalaryStats & { jobTitle: string }` and `CountryJobTitleInsights { country; countryName; currency; jobTitles: JobTitleInsight[] }`.
- **`insightsService.ts`:** `jobTitleInsights(countryCode: CountryCode): CountryJobTitleInsights`. Unknown code → `NotFoundError`. A known code with no actives → `jobTitles: []`.
- **`insightsRoutes.ts`:** `GET /api/insights/countries/:code/job-titles`.
- **Web:**
  - `JobTitleInsightsTable.tsx` (`{ data: CountryJobTitleInsights }`).
  - The "By job title" tab has a country `Select` (default: the country picked from the country tab, otherwise the first A–Z).
  - Empty → `EmptyState("No employees in this country")`.
  - `api/insights.ts` adds `useJobTitleInsights(code)`.

**Control flow:** filter rows by country → group by `jobTitleKey` → for each group, label = `pickDisplayTitle(group spellings)` and stats = `summarizeSalaries(amounts)` → sort by label with `compareTitles`.

**Test strategy:**
- Extend `insightsRoutes.test.ts`:
  - "Software Engineer", " software engineer" and "SOFTWARE ENGINEER" are grouped, with the majority label;
  - one employee → min = max = mean = median;
  - inactive employees are excluded;
  - a country with no actives → empty list;
  - an unknown code → 404.
- Extend `InsightsPage.test.tsx`: choosing a country shows its titles; "No employees in this country" appears.

**Standards:** `clean-code: DRY` (reuses `pickDisplayTitle` and `summarizeSalaries`), `clean-code: fewest elements`.

**Build-agent tier:** `excellent`

**Quality checks:**
- `insightsService.ts` contains no case-folding or title-normalisation of its own. It uses `jobTitleKey` and `pickDisplayTitle` (DRY).
- The rounding behaviour is identical to Slice 7, because the same function is called.

---

## Slice 9: Organisation-wide comparison (US dollars)

- **Spec ref:** Slice 9 (7 ACs).
- **Design intent:** convert each active employee's current salary to USD with `toUsdRates()`, then average by country and by department. It just composes pieces that already exist.

**Structure:**
- **`contracts`:** `OrganisationComparison { referenceCurrency: 'USD'; ratesAsOf: IsoDate; ratesSource: string; toUsd: Record<CurrencyCode, number>; byCountry: { country; countryName; headcount; averageSalaryUsd }[]; byDepartment: { department; headcount; averageSalaryUsd }[] }`.
- **`server/src/insights/currencyConversion.ts`:** `averageInUsd(amounts: readonly { amount: number; currency: CurrencyCode }[], toUsd: Record<CurrencyCode, number>): number`, rounded to whole USD with `Math.round`, which is half-up for positive values.
- **`insightsService.ts`:** `organisationComparison(): OrganisationComparison`.
- **`insightsRoutes.ts`:** `GET /api/insights/organisation`.
- **Web:** `OrganisationComparison.tsx`: two tables (by country, by department) in `USD`; a rates table showing each currency's rate to 6 decimal places; and an "as of 2026-10-23" note with an approximate-figures `Alert`.

**Control flow:** for each group (country, department): convert every amount → the mean of the converted values → round once at the end. Sort countries by name and departments A–Z. Groups with no actives are skipped.

**Test strategy:**
- New `server/src/insights/currencyConversion.test.ts` (unit): mixed currencies with known rates; rounding happens once at the end, not per employee.
- Extend `insightsRoutes.test.ts`: the response includes `ratesAsOf`, the rates and both groupings; inactive employees are excluded; empty groups are not listed.
- Extend `InsightsPage.test.tsx`: the approximate note and the rates date render.

**Standards:** `clean-code: fewest elements`, `clean-code: constants` (rates come only from `reference/`).

**Build-agent tier:** `fast`

**Quality checks:**
- No exchange-rate number literal appears outside `reference/referenceData.ts`.
- The conversion rounds once per group average, never per employee (spec AC).

---

## Slice 10: Excel export & template

- **Spec ref:** Slice 10 (9 ACs).
- **Design intent:**
  - One `TEMPLATE_COLUMNS` definition drives the export, the template and (later) import header checks.
  - The export reuses `parseEmployeeFilters` and `buildFilterConditions`, so it exactly matches the list.

**Structure:**
- **`server/src/spreadsheet/templateColumns.ts`:** `TEMPLATE_COLUMNS: readonly { header: string; key: TemplateField; width: number }[]` in spec order, `TemplateField = 'fullName' | 'email' | 'jobTitle' | 'department' | 'country' | 'currency' | 'annualSalary' | 'employmentType' | 'hireDate'`, and `ALLOWED_VALUES_SHEET = 'Allowed values'`.
- **`server/src/spreadsheet/workbookWriter.ts`:**
  - `buildEmployeesWorkbook(rows: ExportRow[]): Promise<Buffer>`.
  - `buildTemplateWorkbook(): Promise<Buffer>`.
  - `addAllowedValuesSheet(workbook)`, private: country + currency, departments, employment types.
  - `ExportRow { fullName; email; jobTitle; department; countryName; currency; annualSalary; employmentType; hireDate }`.
- **`employeeRepository.ts`:** `listForExport(filters: EmployeeFilters): ExportRow[]`. Same filter clause and order as `listPage`, no limit, country name resolved through `reference/`.
- **`server/src/spreadsheet/exportService.ts`:** `class ExportService { constructor(employees: EmployeeRepository, clock: Clock); exportEmployees(filters): Promise<{ fileName: string; content: Buffer }>; template(): Promise<{ fileName; content }> }`. The file names are `employees-${today}.xlsx` and `employee-import-template.xlsx`.
- **`server/src/spreadsheet/spreadsheetRoutes.ts`:** `spreadsheetRouter(deps): Router`, serving `GET /api/exports/employees` (same query parameters as the list, minus `page`) and `GET /api/imports/template`. Both send `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` and `Content-Disposition: attachment; filename="..."`.
- **Web:** `web/src/features/spreadsheet/ImportExportPage.tsx` (route `/import-export`). The download is a plain `<a href>` whose URL is built with `buildQueryString`, so the browser handles the attachment. It has a "Download template" link and an "Export current list" link. The list page also gets an "Export" button that uses the current filters.

**Control flow:** parse filters (an invalid filter → 400) → rows → workbook. The header row comes from `TEMPLATE_COLUMNS`. Salary cells are numbers with `numFmt '0'`. Hire date cells are `Date` values at UTC midnight with `numFmt 'yyyy-mm-dd'`. Zero rows → a header-only sheet.

**Test strategy:**
- New `server/src/spreadsheet/workbookWriter.test.ts` (unit; read back with exceljs):
  - the headers are in template order;
  - salary is a number cell; hire date is a date cell formatted `yyyy-mm-dd`;
  - the "Allowed values" sheet has the 8 countries with currencies, 10 departments and 3 types;
  - the template has the header row only.
- New `server/src/spreadsheet/spreadsheetRoutes.test.ts` (integration):
  - the export respects search, filters and `status=inactive`;
  - rows are in the same order as the list;
  - the file name uses the clock's today;
  - an empty match gives a header only;
  - the template endpoint's file name.
- New `server/perf/export.perf.test.ts`: all 10k exported in < 5000 ms.
- New `web/src/features/spreadsheet/ImportExportPage.test.tsx`: the download links point to the right URLs.

**Standards:** `clean-code: DRY` (`TEMPLATE_COLUMNS` and the filter clause), `clean-code: SRP` (the writer has no DB access).

**Build-agent tier:** `excellent`

**Quality checks:**
- Template headers are written in exactly one place (`templateColumns.ts`) and read from there by the writer, and in Slice 11 by the reader.
- The export uses `parseEmployeeFilters` and `buildFilterConditions`, with no second filter implementation.
- `workbookWriter.ts` doesn't import any repository or Express (architecture-patterns).

---

## Slice 11: Excel import, part 1: upload & preview (saves nothing)

- **Spec ref:** Slice 11 (14 ACs).
- **Design intent:** three pure stages, then one read-only service call:
  1. **read the file:** bytes → raw cell values; file-level rejections;
  2. **parse each row:** raw cells → candidate fields and row errors, via the shared validators;
  3. **classify:** rows + a snapshot of existing employees → `ImportPlan` (preview + the operations to perform).

  Slice 12 reuses all three unchanged.

**Structure:**
- **`contracts`:** `ImportPreview { totals: { create; update; unchanged; error }; creates: { row; email; rehireOf: number | null }[]; updates: { row; email; changes: { field: string; from: string; to: string }[] }[]; errors: { row; email: string | null; messages: string[] }[] }`. Here `field` is the template column header, e.g. "Annual Salary".
- **`server/src/spreadsheet/workbookReader.ts`:**
  - `readImportFile(content: Buffer, fileName: string): Promise<RawImportRow[]>`. Throws `ImportFileError` with `INVALID_FILE`, `HEADER_MISMATCH`, `TOO_MANY_ROWS` or `NO_DATA_ROWS`.
  - `readCellValue(value: ExcelJS.CellValue): string | number | Date | null`. It handles richText, hyperlink, formula result, error → null, and boolean → string.
  - `RawImportRow { rowNumber: number; cells: (string | number | Date | null)[] }`.
  - The constants `MAX_IMPORT_ROWS = 20_000` and `MAX_IMPORT_BYTES = 10 * 1024 * 1024`. The latter is also used by multer.
- **`server/src/spreadsheet/importRowParser.ts`:**
  - `parseImportRow(raw: RawImportRow, today: IsoDate): ParsedImportRow`.
  - `ParsedImportRow = { rowNumber; email: string | null; outcome: { ok: true; fields: EmployeeFields } | { ok: false; messages: string[] } }`.
  - Private cell converters: `toText`, `toWholeNumber` (a number cell holding an integer, or text of digits only), `toIsoDate` (a Date cell → `toISOString().slice(0,10)`, or `YYYY-MM-DD` text).
- **`server/src/spreadsheet/importClassifier.ts`:**
  - `classifyImportRows(rows: ParsedImportRow[], existing: ImportSnapshot): ImportPlan`.
  - `ImportSnapshot = Map<string /* email */, { active: ExistingEmployee | null; latestInactive: ExistingEmployee | null }>`.
  - `ExistingEmployee { id; fields: EmployeeFields; currentCurrency; earliestSalaryDate; exitDate: IsoDate | null }`. Here `fields.annualSalary` is the current salary.
  - `ImportPlan { preview: ImportPreview; operations: ImportOperation[] }`.
  - `ImportOperation = { kind: 'create'; fields; rehireOf: number | null } | { kind: 'update'; employeeId; fields; salaryChange: { amount; currency } | null }`.
  - `diffFields(existing: ExistingEmployee, incoming: EmployeeFields): { field; from; to }[]`. It compares by template column, with the salary and hire date shown as plain strings.
- **`employeeRepository.ts`:** `loadImportSnapshot(): ImportSnapshot`. One query over all employees, joined with `current_salaries` and `MIN(effective_date)`, then assembled in memory. For each email it keeps the active record and the inactive record with the latest exit date.
- **`server/src/spreadsheet/importService.ts`:** `class ImportService { constructor(db: AppDatabase, employees: EmployeeRepository, clock: Clock); preview(content: Buffer, fileName: string): Promise<ImportPreview> }`.
- **`spreadsheetRoutes.ts`:** `POST /api/imports/preview` (multer `single('file')`, `memoryStorage`, `limits: { fileSize: MAX_IMPORT_BYTES, files: 1 }`). A missing file → `ImportFileError('INVALID_FILE')`.
- **`errorHandler`:** map `MulterError` `LIMIT_FILE_SIZE` → 400 `FILE_TOO_LARGE`.
- **Web:**
  - On `ImportExportPage`, an `Input type="file"` (`accept=".xlsx"`) with a `Label` → "Preview import" → `ImportPreviewView.tsx` (`{ preview: ImportPreview }`).
  - The preview shows count badges (Create, Update, Unchanged, Error, each with an icon and label), then sections for Updates (row, email, a field-by-field from → to list), Errors (row, email, messages) and Creates (row, email, a "Rehire — linked to #id" note).
  - Each section is paginated client-side at 50 rows, so 10k rows render quickly.
  - File-level errors → a destructive `Alert` with the server message.
  - The chosen `File` object is kept in state for Slice 12.
  - `api/imports.ts`: `previewImport(file: File): Promise<ImportPreview>` (multipart `FormData`, without setting `Content-Type` manually).

**Control flow:**
- **`readImportFile`:**
  - the name doesn't end in `.xlsx` (any letter case) → `INVALID_FILE`;
  - `workbook.xlsx.load` rejects → `INVALID_FILE`;
  - first worksheet: the header row 1 values are normalised with `normalizeKey` and must equal the `TEMPLATE_COLUMNS` headers, in order, or → `HEADER_MISMATCH`;
  - for rows 2..last: read the 9 cells; skip a row whose cells are all empty;
  - over 20,000 → `TOO_MANY_ROWS`; zero → `NO_DATA_ROWS`;
  - other sheets are ignored.
- **`parseImportRow`:**
  - Convert the cells. A conversion failure adds a message prefixed with the column header.
  - Map the Country display name → code via `findCountryByName`. Department and employment type are matched ignoring case and spaces against the reference values, then stored in their canonical spelling.
  - Currency ≠ `currencyFor(code)` → a message.
  - Then run `validateEmployeeFields` (shared). Its `fieldErrors` become messages prefixed with the column header.
- **`classifyImportRows`:**
  1. Count emails across all parseable rows. Every row with an email that appears more than once → an error, "Duplicate email in file".
  2. For each remaining row:
     - **Parse errors** → error.
     - **`active` match:**
       - all fields equal → unchanged;
       - otherwise check the hire date against `earliestSalaryDate` (> → error);
       - otherwise update, with `salaryChange` when the amount differs from the current salary **or** the country changed, in the currency of the incoming country.
     - **Only `latestInactive`:**
       - fields equal → unchanged;
       - `validateRehireHireDate` passes → create with `rehireOf` = that id;
       - otherwise error: "Employee #id is inactive and can't be changed; a rehire needs a hire date after their exit date (YYYY-MM-DD)".
     - **No match** → create.
  3. Totals are computed from the classified rows.
- **`ImportService.preview`:** read → parse every row → `loadImportSnapshot` → classify → return the `preview`. **No writes.**

**Test strategy (new files; this is the most heavily tested slice):**
- `server/src/spreadsheet/workbookReader.test.ts` (unit, building workbooks in memory with exceljs):
  - a wrong extension; non-zip bytes;
  - header mismatch (a wrong order or a missing column); headers with different case and spaces → accepted;
  - 20,001 rows → `TOO_MANY_ROWS`; header only → `NO_DATA_ROWS`;
  - blank rows skipped; the second sheet ignored;
  - `readCellValue` handles richText, hyperlink email, formula result and error cells.
- `server/src/spreadsheet/importRowParser.test.ts` (unit):
  - salary `"85000"` text → accepted; `"85,000"` → error; `85000.5` → error;
  - a hire date as a Date cell → ISO; as text `2024-01-31` → accepted; as a number → error;
  - a currency that doesn't match the country → error;
  - country, department and type matched ignoring case;
  - shared validation errors are prefixed with the column header;
  - row numbers count the header as row 1.
- `server/src/spreadsheet/importClassifier.test.ts` (unit, a pure snapshot built in the test):
  - new email → create;
  - an active match with changes → update with the exact `changes` list;
  - identical → unchanged;
  - a salary change → `salaryChange`; a country change with the same amount → `salaryChange` in the new currency;
  - the hire date after the earliest entry → error;
  - duplicate emails → every one of those rows is an error;
  - inactive identical → unchanged; inactive with a later hire date → create with `rehireOf`; inactive otherwise → error;
  - an email in different letter case still matches.
- Extend `spreadsheetRoutes.test.ts` (integration):
  - `POST /api/imports/preview` with a generated file → the expected preview, and **the DB row counts don't change**;
  - an oversize file (> 10 MB buffer) → 400 `FILE_TOO_LARGE`;
  - no file → 400 `INVALID_FILE`;
  - **round trip:** export → preview → `create: 0, update: 0, error: 0`, for both the active and the inactive exports.
- New `server/perf/importPreview.perf.test.ts`: previewing a 10,000-row file finishes in < 30,000 ms.
- New `web/src/features/spreadsheet/ImportPreviewView.test.tsx`: the counts render; update changes show from → to; errors show row numbers; the 50-row pagination works. Extend `ImportExportPage.test.tsx`: a file-level error shows an alert.

**Standards:**
- `clean-code: SRP` (reader / parser / classifier are separate).
- `clean-code: DRY` (reuses `validateEmployeeFields`, `validateRehireHireDate`, `normalizeKey`, `TEMPLATE_COLUMNS`).
- `architecture-patterns: pure domain` (the parser and classifier have no I/O).
- `tdd-practices: high-risk depth` (failure modes, boundaries, round trip).

**Build-agent tier:** `best` · **FLOORED (security: untrusted file upload parsed into data) — floor tier ≥ excellent.**

**Quality checks:**
- `importRowParser.ts` and `importClassifier.ts` import nothing from `express`, `better-sqlite3`, `exceljs` or any repository (architecture-patterns: pure).
- `ImportService.preview` performs no write. An integration test asserts the row counts are unchanged (spec: "nothing is saved").
- Upload size is limited by multer at 10 MB **before** parsing, and the row count is checked before any per-row work (security floor: resource limits).
- Every row error message includes the column header and comes from the shared validators, never from duplicated rule text (DRY).
- The round-trip test (export → preview → 0 created, 0 updated) is in the default `npm test` suite.

---

## Slice 12: Excel import, part 2: confirm & apply (all or nothing)

- **Spec ref:** Slice 12 (12 ACs).
- **Design intent:**
  - Re-run the exact preview pipeline **inside one SQLite transaction**. If anything is invalid now, throw (which rolls back) and return the new preview.
  - Otherwise apply every operation. Any unexpected failure rolls back everything.
  - There's no server-side preview state: the client sends the file again.

**Structure:**
- **`contracts`:** `ImportResult { created; updated; unchanged }`.
- **`importService.ts`:** add `apply(content: Buffer, fileName: string): Promise<ImportResult>`, plus private `applyOperations(operations: ImportOperation[], recordedAt: string, today: IsoDate): void`.
- **`employeeRepository.ts`:** reuse `insertEmployee` (which writes the "Starting salary" entry), `updateEmployeeFields` and `insertSalaryEntry` from earlier slices. **No new queries** beyond what those slices defined.
- **`spreadsheetRoutes.ts`:** `POST /api/imports` (same multer config) → 200 `ImportResult`. `ImportRejectedError` → 422 `{ error: { code: 'IMPORT_REJECTED', preview } }`. `ImportNotAppliedError` → 500 `IMPORT_NOT_APPLIED`.
- **Web:**
  - In `ImportPreviewView`, a "Confirm import" `Button` is enabled only when `preview.totals.error === 0`.
  - Confirming calls `confirmImport(file)`:
    - success → a summary `Alert` with the created, updated and unchanged counts; invalidate `employees.all` and `insights.all`;
    - 422 → replace the preview with the returned one and show a notice that the data changed since the preview;
    - 500 → an error `Alert` saying the import was not applied.
  - `api/imports.ts` adds `confirmImport`.

**Control flow:**
- **`apply`:**
  - Read and parse outside the transaction. This is CPU-only and file-level errors are thrown as before.
  - Then `db.transaction(() => { ... })()`:
    - `loadImportSnapshot` → classify;
    - `preview.totals.error > 0` → throw `ImportRejectedError(preview)`;
    - `applyOperations`:
      - create → `insertEmployee`, so a rehire gets its own fresh history;
      - update → `updateEmployeeFields`, then `insertSalaryEntry` with reason "Excel import", effective today, when `salaryChange` is set.
  - Catch anything that isn't a domain error → `ImportNotAppliedError`, logging the cause.
  - Return the counts.
- **Inactive records are never modified:** the classifier never emits an update for them.

**Test strategy:**
- Extend `spreadsheetRoutes.test.ts` (integration):
  - a valid file → the counts, and the rows exist afterwards;
  - creates get "Starting salary" on their hire date;
  - a salary change adds an "Excel import" entry effective on the clock's today;
  - a country change with the same amount adds an entry in the new currency;
  - the same salary and country add no entry;
  - the email is never changed;
  - a rehire row creates a new linked record and the inactive record is untouched;
  - a file with an error row → 422 with the preview, and nothing saved;
  - **data changed since the preview:** preview, then make one row invalid by creating a conflicting active employee directly in the DB, then confirm → 422 with the new error, and nothing saved;
  - **failure partway through:** create a `TEMP TRIGGER` in the test DB via `db.$client.exec(...)` that does `RAISE(ABORT)` on insert of one specific email in the middle of the file → 500 `IMPORT_NOT_APPLIED`, and the employee and history counts are identical to before;
  - **round trip:** export → apply → `{ created: 0, updated: 0 }`.
- New `server/perf/importApply.perf.test.ts`: applying a 10,000-row create file finishes in < 30,000 ms.
- Extend `ImportPreviewView.test.tsx`: Confirm is disabled when there are errors; the success summary; a 422 replaces the preview; the 500 message.

**Standards:**
- `clean-code: errors are expected` (domain errors are distinct from unexpected ones).
- `clean-code: don't swallow errors` (the cause is logged, then wrapped).
- `tdd-practices: data integrity under failure` (the trigger-based rollback test).

**Build-agent tier:** `best` · **FLOORED (security: untrusted uploaded data is saved) — floor tier ≥ excellent.**

**Quality checks:**
- Classification and every write happen inside a single `db.transaction` call. No write happens outside it.
- The rollback test uses a real SQLite trigger, not a mocked repository, and asserts the counts before and after are identical (data integrity).
- `apply` calls the same `readImportFile`, `parseImportRow` and `classifyImportRows` as `preview`, with no forked logic (DRY; "re-validated in full").
- No code path updates a row whose status is `inactive`.

---

## Slice 13: Delivery: production serving, deployment, docs

- **Spec ref:** "Delivery requirements (from the brief)": deployed at a public URL with the seed loaded, one documented seed command, and the fast unit tests (already true). Plus the brief's artifacts: an architecture diagram, trade-offs and performance considerations.
- **Design intent:** a single container serves the API and the built SPA, migrates on boot, and seeds when the DB is empty. Write up the architecture and its trade-offs for reviewers.

**Structure:**
- **`server/src/app.ts`:** add `serveWebApp(app, webDistPath)`:
  - `express.static(webDistPath)`;
  - a final middleware that, for `GET` requests not under `/api` that accept HTML, sends `index.html`. This avoids Express 5 wildcard path syntax.
  - It is enabled only when the directory exists.
- **`server/src/shared/healthRoutes.ts`:** `GET /api/health` → `{ status: 'ok' }`, for the host's health check.
- **`Dockerfile`** (multi-stage, `node:24-slim`):
  - deps stage: `npm ci`;
  - build stage: `npm run build -w web`;
  - runtime stage: production deps + `server/` + `contracts/` + `web/dist`;
  - `ENV DATABASE_PATH=/data/salary.db SEED_ON_EMPTY=true`, `EXPOSE 3000`, `CMD ["npm","run","start","-w","server"]`.
- **`.dockerignore`.**
- **`render.yaml`:** a Render Blueprint for a Docker web service with health check path `/api/health`.
- **`README.md`:** what the app is; prerequisites (Node 24, `nvm use`); `npm ci`, `npm run seed`, `npm run dev`, `npm test`, `npm run test:perf`; environment variables; deployment; a link to the docs.
- **`docs/architecture.md`:**
  - a Mermaid diagram of the modules and layers, and of the import preview → apply flow;
  - key decisions and trade-offs: SQLite vs Postgres, no ORM, validation only on the server, rehire-instead-of-restore, a stateless re-uploaded import, perf tests kept separate;
  - performance considerations: indexes, server-side paging and aggregation, the 10k in-memory statistics, transaction batching for seed and import;
  - what would change for production with real data: auth first, Postgres, audit log.

**Control flow:** boot → migrate → if `SEED_ON_EMPTY` and `count(employees) = 0`, seed → listen. This makes a fresh or ephemeral disk self-heal with demo data.

**Test strategy:**
- Extend `server/src/app.test.ts` (new, integration):
  - `GET /api/health` → 200;
  - with a temporary `webDistPath` containing `index.html`: `GET /employees/5` → the HTML; `GET /api/unknown` → 404 JSON (not HTML).
- New `server/src/main.test.ts` is **not** needed; seed-on-empty is covered by testing the extracted `seedIfEmpty(db, clock): boolean` in `server/src/seed/seedDatabase.test.ts` (it seeds when empty and does nothing when there's data).

**Standards:** `clean-code: least surprise` (unknown API routes never return HTML), `ai-ergonomics: docs` (the README and architecture doc let a reader or an LLM orient quickly).

**Build-agent tier:** `excellent`

**Quality checks:**
- `docker build .` succeeds, and the container serves `/api/health` and the SPA on port 3000 (an environment-specific check at implement time: skip it if Docker isn't available and say so).
- The README's commands work as written from a clean clone on Node 24.
- `docs/architecture.md` contains at least one Mermaid diagram and a trade-offs section.
- No secrets or account-specific values are committed in `render.yaml`.

**Environment-specific, left to implement time:** which hosting account to deploy to (Render is the default; Railway and Fly.io also work with the Dockerfile), and whether a persistent disk is attached. The deploy itself is done by the developer.

---

## End-of-spec review

Runs once over the whole diff after all slices.

| Agent | Tier | Why |
|---|---|---|
| `reviewer` | `best` | Always runs. It must include an explicit **security pass over the floored surfaces**: Slice 2 Drizzle condition building (no `sql.raw` with user input), Slices 11–12 upload parsing, size and row limits, transactional apply, and Slice 1a migrations. |
| `review-coupling` | `excellent` | **Mandatory** (slices are floored). It verifies the one-way module graph `reference ← employees ← insights/spreadsheet` and that the domain doesn't depend on adapters. |
| `review-tests` | `excellent` | Tests are a headline assessment criterion: behaviour-based names, no vanity tests, determinism (clock and seed), and the round-trip and rollback tests. |
| `review-code-quality` | `excellent` | Clean code is graded: SRP across reader/parser/classifier, DRY of the shared rules, function size. |
| `review-team-practices` | `fast` | The commit history is graded ("incremental commits"). It checks per-slice conventional commits with meaningful messages. |

Skipped:
- `review-behavioral`: a new repo has no churn history to analyse.
- `review-org-standards`: there's no CLAUDE.md.
- `review-ai-ergonomics`: optional. The architecture doc and README cover it.

**Browser verification:** run once at the end of the spec across the UI acceptance criteria for Slices 1–12. That is plan-implementer's job.

---

## Escalation Log

_(Appended by `/bee:plan-implementer`: one-way tier bumps, with reasons.)_

[x] Reviewed
