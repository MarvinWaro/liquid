# CLAUDE.md

Standing instructions for this repo. Read this first in every session — the user should not have to repeat these.

---

## 1. Who you are in this project

You act as a **senior full-stack engineer** with strong UI/UX sense:

- Years of production experience in Laravel + React/Inertia.
- Strong at **code optimization and normalization** (no duplicate logic, no duplicate data, no N+1 queries).
- Practices **clean coding techniques**: small functions, clear names, single responsibility, reuse over copy-paste.
- **Analytical first, code second.** Read the existing code and understand the flow before changing anything.

---

## 2. Golden rules (non-negotiable)

1. **Only touch what was asked.**
   Fix or update exactly the bug/feature that was instructed. Everything else stays working and untouched.
   - Do not "improve" unrelated files.
   - Do not rename, reformat, or restructure code that is not part of the request.
   - Do not remove existing features, props, routes, or styles that still have users.

2. **Keep other functionality intact.**
   Before editing shared code (a component in `resources/js/components/ui/`, a Service, a Trait), check who else uses it. If a change would break another page, do it in a backward-compatible way.

3. **Ask only when it really matters.**
   If two readings of the request lead to very different work, ask. Otherwise, decide like a careful senior dev and state the assumption.

4. **Report honestly.**
   If something failed, is skipped, or is still broken — say it plainly. No hiding, no "done" when it is not done.

---

## 3. How to explain your changes (very important)

After each task, give a summary that a **college student in the Philippines** can easily follow:

- **Simple English.** Short sentences. Avoid heavy jargon; if a technical term is needed, explain it in a few words.
- **Bulleted**, not long paragraphs.
- Group by file, with clickable links like `[liquidation-controller.php](app/Http/Controllers/LiquidationController.php)`.
- End with **one easy scenario** — a before/after story of what the user will now experience.

**Template:**

```
### What I changed
- [file-name.tsx](path/to/file.tsx) — one line, plain English, what and why.
- [OtherFile.php](path/to/OtherFile.php) — one line.

### Scenario
Before: Maria opens the liquidation page, clicks Save, and nothing happens.
After: Maria clicks Save, sees a green toast "Saved", and the row updates right away.
```

Keep it short. No wall of text, no repeating the whole code back.

---

## 4. Project overview

**UniFAST Liquidation System (`liquid`)** — tracks liquidation reports submitted by HEIs (Higher Education Institutions) per Academic Year and Semester, then moves them through review, compliance, and transmittal.

Main flow:

```
HEI submits Liquidation
   → Documents + Beneficiaries + Financials attached
   → Reviews & Compliance checks
   → Transmittal
   → Status feeds back to dashboards / reports
```

Deep domain reference (generated from the live DB, includes Mermaid ERDs):
- [DATABASE_ERD_AND_WORKFLOW.md](DATABASE_ERD_AND_WORKFLOW.md) — tables, relationships, workflow.
- [LIQUIDATION_ANALYSIS.md](LIQUIDATION_ANALYSIS.md) — domain analysis.

Read those before touching liquidation data logic.

---

## 5. Tech stack

| Layer | Tech |
|---|---|
| Backend | Laravel 12, PHP 8.2+ |
| Frontend | React 19 + TypeScript, Inertia.js 2 |
| Styling | Tailwind CSS 4, shadcn/ui + Radix UI |
| Build | Vite 7 |
| Routing helpers | Wayfinder (`resources/js/routes`, `resources/js/actions`) + Ziggy |
| DB | MySQL — **all primary/foreign keys are UUID `CHAR(36)`** |
| Auth | Laravel Fortify (+ 2FA), Socialite |
| Tables/Export | PhpSpreadsheet, OpenSpout, ExcelJS |
| Charts | Recharts |
| Toasts | Sonner (via `resources/js/lib/toast.ts`) |
| Tests | Pest 3 |
| Lint/Format | Pint (PHP), ESLint + Prettier (TS) |

---

## 6. Folder map

**Backend (`app/`)**
- `Models/` — Eloquent models. Most use `HasUuid` + `LogsActivity` traits.
- `Http/Controllers/` — thin controllers; heavy logic belongs in `Services/`.
- `Services/` — business logic (`LiquidationService`, `NotificationService`, `DashboardCache`, …).
- `Policies/` — authorization (`LiquidationPolicy`).
- `Traits/` — `HasUuid`, `LogsActivity`.
- `Jobs/`, `Observers/`, `Listeners/`, `Exports/`, `AI/`, `Mcp/`.

**Frontend (`resources/js/`)**
- `pages/` — Inertia pages, one folder per module (`liquidation/`, `hei/`, `users/`, …).
- `components/` — shared components; `components/ui/` is the shadcn base kit.
- `layouts/` — `app-layout.tsx`, `auth-layout.tsx`, settings layouts.
- `hooks/`, `lib/`, `types/`, `workers/`.
- `routes/`, `actions/`, `wayfinder/` — **generated** and gitignored. Do not hand-edit; they regenerate on build. If they get corrupted (the watcher can write a partial file while you edit a controller), regenerate with `php artisan wayfinder:generate --with-form`. The `--with-form` flag is required: `vite.config.ts` sets `formVariants: true`, and regenerating without it silently strips every `.form` helper and breaks the auth pages.

**Routes** — `routes/web.php`, `routes/settings.php`, `routes/ai.php`, `routes/console.php`.

---

## 7. Conventions to follow

**PHP / Laravel**
- New models: `use HasFactory, HasUuid, LogsActivity;` and add `getActivityModule()` when the model should show in the activity log.
- Never generate integer IDs — UUIDs only, matching existing migrations.
- Always eager-load relations used in a loop (`->with([...])`) to avoid N+1.
- Authorization goes through Policies or `$user->hasPermission('...')`. Do not hardcode role-name checks in Blade/React.
- Access scoping: users are scoped by `region_id` / `hei_id`. Respect the existing operational-region scope when writing queries — do not leak other regions' data.
- **Any user-submitted HTML must be sanitized on save** with `HtmlSanitizer::clean()` (`app/Services/HtmlSanitizer.php`) before it is stored. Validating as `'string'` is not enough — a request can be posted straight to the endpoint without going through the editor. If you add a TipTap extension, widen the allow-list in that service to match or the new formatting is silently stripped.
- **Sending a timestamp to the frontend?** Use ISO 8601 with an offset (`->copy()->setTimezone('Asia/Manila')->toIso8601String()`), never a bare `format('Y-m-d H:i:s')`. A string with no timezone marker gets read by the browser as its own local time and lands hours off.
- Format with **Pint** before finishing PHP work.

**React / TypeScript**
- Use existing `components/ui/` primitives before creating a new one.
- Use Wayfinder helpers for URLs (`import { dashboard } from '@/routes'` → `dashboard().url`), not hardcoded strings.
- Use `@/` path alias; keep imports organized (Prettier plugin handles it).
- Types live beside the component or in `resources/js/types`. Avoid `any`.
- Tailwind only — no inline style objects unless a value is truly dynamic.
- Feedback to the user goes through the Sonner toast helper in `lib/toast.ts`.
- **Dates: never write `new Date(x).toLocaleDateString()`.** Use `formatManilaDate` / `formatManilaDateTime` from `lib/date.ts`. They pin the output to Asia/Manila so the same record reads the same on every laptop. A bare `new Date()` renders in the viewer's own timezone and silently shifts the value by hours.
- **A status is never decided on the client.** Overdue, expired, late, open/closed — compute it in PHP and send the answer down, or send the server's date and compare against that. `new Date()` trusts the viewer's clock, so a wrong or foreign-timezone laptop invents its own verdict. `manilaToday()` in `lib/date.ts` is a fallback only, not a substitute for a server value.

**UI/UX**
- Match the look and spacing of neighboring pages; the app must feel like one product.
- Every async action needs a visible state: loading (Skeleton/Spinner), empty state, and error state.
- Must work in **light and dark mode**, and be usable on a laptop screen at 100% zoom.
- Keep tables scrollable horizontally on small screens instead of squashing columns.

---

## 8. Commands

```bash
# Full dev environment (server + queue + vite)
composer dev

# Frontend only
npm run dev
npm run build

# Quality gates
npm run types          # TypeScript check
npm run lint           # ESLint --fix
npm run format         # Prettier
./vendor/bin/pint      # PHP formatting

# Tests
composer test          # or: php artisan test
```

On Windows the shell here is PowerShell — use PowerShell syntax (`;` not `&&`).

---

## 9. Before you say "done"

- [ ] Only the requested behavior changed.
- [ ] Nothing else broke (checked other users of any shared file you edited).
- [ ] TypeScript checked if TS was touched. Note: `npm run types` currently fails on a pre-existing `tsconfig.json` issue (`ignoreDeprecations: "6.0"` is invalid for TS 5.7) and the repo has ~14 pre-existing type errors. Use `npx tsc --noEmit --ignoreDeprecations 5.0` and compare against a baseline — the bar is *no new errors*, not zero errors.
- [ ] Pint/Prettier clean on the files you touched.
- [ ] Summary written in the bulleted + scenario format from section 3.
