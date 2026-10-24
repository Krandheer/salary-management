# Design Brief: ACME Salary Management

Status: greenfield, **default values chosen without developer interview. Review before proceeding.**
Stack: React 19 + Vite + TS, shadcn/ui (Radix base, Tailwind CSS v4), lucide-react icons, sonner toasts, react-hook-form, native `<input type="date">` via shadcn `Input`. Fonts via `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono`.
Persona: one HR Manager, desktop/tablet (>=768px, no phone layout). Light theme only (no `.dark` block).

**Personality:** calm, trustworthy, data-dense enterprise HR. Numbers are the hero; chrome stays quiet. Sharp-ish shape language, thin borders instead of shadows, no gradients.

## Tokens (`web/src/index.css`)

```css
@import "tailwindcss";
@import "@fontsource/ibm-plex-sans/400.css"; /* also 500, 600 */
@import "@fontsource/ibm-plex-mono/400.css";

:root {
  --radius: 0.25rem;
  --background: #F6F7F8;  --foreground: #1B2229;
  --card: #FFFFFF;        --card-foreground: #1B2229;
  --popover: #FFFFFF;     --popover-foreground: #1B2229;
  --primary: #0B6E6E;     --primary-foreground: #FFFFFF;   /* 6.0:1 on white */
  --secondary: #ECEEF0;   --secondary-foreground: #1B2229;
  --muted: #ECEEF0;       --muted-foreground: #55606B;     /* 6.3:1 on white */
  --accent: #E6F4F3;      --accent-foreground: #074848;    /* teal-50 hover/active fill */
  --destructive: #B42318; --destructive-foreground: #FFFFFF;
  --border: #D9DEE3;      --input: #D9DEE3;  --ring: #0B6E6E;

  /* semantic: tint bg + text pairs, each >=4.5:1; always shown with icon + label */
  --status-active-bg: #E3F4E8;     --status-active-fg: #14632E;
  --status-inactive-bg: #ECEEF0;   --status-inactive-fg: #454F59;
  --import-create-bg: #E4EFFB;     --import-create-fg: #124C8F;
  --import-update-bg: #FFF1D6;     --import-update-fg: #7A4B00;
  --import-unchanged-bg: #ECEEF0;  --import-unchanged-fg: #454F59;
  --import-error-bg: #FDE7E7;      --import-error-fg: #9B1C1C;
}

@theme inline {
  --font-sans: "IBM Plex Sans", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;
  --color-background: var(--background);  --color-foreground: var(--foreground);
  --color-card: var(--card);              --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);        --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);        --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);    --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);            --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);          --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);  --color-input: var(--input);  --color-ring: var(--ring);
  --color-status-active-bg: var(--status-active-bg); /* ...one --color-* per semantic var */
  --radius-sm: calc(var(--radius) - 2px);  /* 2px: badges */
  --radius-md: var(--radius);              /* 4px: inputs, buttons */
  --radius-lg: calc(var(--radius) + 4px);  /* 8px: cards, dialogs */
}

@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground font-sans text-sm; }
  td, input, .stat { font-variant-numeric: tabular-nums; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
}
```

- Single family for headings and body; weight carries hierarchy (600 headings). h1 24/1.25, h2 20/1.3, h3 16/1.35; body and table cells 14/1.5; captions 12. `font-mono` for IDs only.
- Spacing: Tailwind 4px scale. Page padding `p-6`; section gap `gap-6`; form field gap `gap-4`; toolbar gap `gap-3`.
- Palette split about 60% neutral surface, 30% borders/secondary surfaces, 10% teal (primary buttons, active nav, focus ring). Cards use `border`, no shadow; shadow only on dialogs (`shadow-md`).
- Use tokens (`bg-primary`, `text-muted-foreground`), never hardcoded hex in components.
- Focus: rely on shadcn `focus-visible:ring-[3px] focus-visible:ring-ring/50` (plus `border-ring`) styles; never add `outline-none` without the ring. Transitions 150ms.

## Semantic colors (icon + text label, never color alone)

| Meaning | Vars | lucide icon |
|---|---|---|
| Active | `status-active` | CircleCheck |
| Inactive | `status-inactive` | MinusCircle |
| Import: create | `import-create` | Plus |
| Import: update | `import-update` | Pencil |
| Import: unchanged | `import-unchanged` | Equal |
| Error | `import-error` | CircleAlert |

Render with shadcn `Badge variant="outline"` plus `bg-[var(--...-bg)]`-style utilities via the `--color-*` mappings. Destructive actions use `Button variant="destructive"` (white text on `--destructive`, 6.5:1).

## App shell (hand-built, no shadcn `sidebar`)

CSS grid: `<header>` fixed 56px (`h-14`, ACME wordmark left, page title context); `<nav aria-label="Primary">` 220px (`w-[220px]`) left sidebar, always visible at >=768px; `<main>` max-width 1280px (`max-w-[1280px]`), left-aligned. Nav items (lucide, 16px): **Employees** (Users), **Insights** (BarChart3), **Import / Export** (FileSpreadsheet). Active item: `aria-current="page"`, styled via `aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground` plus a 3px left bar in `bg-primary`. Skip-to-content link first in tab order.

## Page layouts and components

- **Employees list:** h1 + primary `Button` "Add employee" (right). Sticky toolbar: `Input` + `Label` "Search name"; Country, Department, Job title as `Select`; "Show inactive employees" `Switch` with `Label`; "Clear filters" `Button variant="ghost"`; "Export .xlsx" `Button variant="outline"` far right. Result line "10,000 employees". `Table` (Name, Job title, Department, Country, Salary; Exit date when inactive shown). Footer pagination built from `Button variant="outline"`: "Page X of Y", labelled Previous/Next, disabled at ends. Row click and name link open detail.
- **Employee detail:** breadcrumb back; header = name (h1) + `Badge` status + `Button`s Edit, Change salary, Delete (disabled with explanation and read-only note when inactive). 8/4 grid: left = details `dl` and Salary history `Table` (newest first, current row `Badge` "Current"); right = `Card` "Linked employments" (ID, hire date, exit date, status, "Open" link). `Separator` between header and body.
- **Add/Edit form:** react-hook-form, single column, max 560px, `fieldset`/`legend` groups (Identity, Role, Pay). Salary `Input` with read-only currency prefix derived from country. Rehire notice = `Alert` (info) naming the inactive record. Salary change in a dialog: amount `Input`, effective date `Input type="date"`, reason `Textarea`. Actions bottom-left: `Button` "Save", `Button variant="ghost"` "Cancel".
- **Delete confirmation:** `AlertDialog`, max-w 440, title "Delete employee?", text that the record is kept as inactive, "Exit date" `Input type="date"` (default today), `AlertDialogCancel` "Cancel" (receives initial focus via `autoFocus`/`onOpenAutoFocus`) and `AlertDialogAction` "Delete" with destructive styling. Focus trapped, Esc closes.
- **Insights:** `Tabs`: "By country", "By job title", "Organisation (USD)". `Table`s with Headcount, Min, Max, Mean, Median. Country row has "View job titles" link; job-title tab has Country `Select`. USD tab: two tables (country, department), rates table, persistent `Alert` "Converted figures are approximate" with "rates as of" date.
- **Import / Export:** two `Card`s. Import: `Input type="file"` with `Label` "Excel file (.xlsx)", then Preview: four count tiles (Create, Update, Unchanged, Errors; semantic badges), then `Tabs` per group. Updates: row #, email, from -> to mini `Table`. Errors: "Row N", email, bullet messages. "Confirm import" disabled while errors > 0, with helper text. Success = persistent `Alert`.

## Table conventions

shadcn `Table` with sticky header (`sticky top-0 bg-card`), `hover:bg-muted/50` rows, row borders; cell `px-3 py-2`, rows ~40px; header 12px semibold `text-muted-foreground`. No horizontal page scroll at 768px: truncate with ellipsis + `title`; Name column gets flex priority. Salary and stat cells and their headers right-aligned (`text-right tabular-nums`), format `USD 85,000` (code, then amount, no decimals). Text left-aligned; dates `YYYY-MM-DD`. Controls min 36px high (dense desktop tool).

## States

- **Loading:** `Skeleton` rows matching table shape (25), `aria-busy`; buttons show a lucide `Loader2` spinner and are disabled.
- **Empty:** short centered message in `Card` plus one action ("No employees yet" + Add employee; "No matching employees" + Clear filters; "No employees in this country").
- **Error:** inline `Alert variant="destructive"` with plain message and "Retry" button; API field errors set via react-hook-form `setError`. Transient feedback via sonner `<Toaster position="top-right" />`: success auto-closes 5s, errors persistent (`duration: Infinity`).

## Forms and validation

Visible `Label` above every field (never placeholder-only); required marked `*` plus visually hidden "(required)". Errors: red text with `CircleAlert` icon below the field, linked via `aria-describedby`, `aria-invalid` on the input (shadcn styles the red border/ring). Validate on blur and submit (`mode: "onBlur"`); on failure focus first invalid field (`shouldFocusError`). Nothing saves while invalid. Dates are native `type="date"` inputs (ISO value `YYYY-MM-DD`).

## Defaults to confirm

1. Teal #0B6E6E, IBM Plex Sans/Mono, 4px radius (no mood interview).
2. Light theme only; no dark tokens.
3. Left sidebar nav; Insights as tabs on one page.
4. 36-40px row/control height, below the 44px touch guideline (dense desktop tool).
5. Hex semantic tints above and `--destructive` #B42318.
6. Native date input (browser-dependent look) instead of a calendar popover.
7. Cancel is focused by default in the delete dialog.

[ ] Reviewed
