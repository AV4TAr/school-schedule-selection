# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev                              # dev server on :3000
npm test                                 # vitest, all tests
npx vitest run src/lib/solver.test.ts    # one file
npx vitest run -t "honours a pinned"     # one test by name
npm run typecheck                        # tsc --noEmit
npm run lint                             # eslint
npm run build                            # production build
npm run db:generate                      # regenerate drizzle/ after editing schema.ts
npm run db:seed                          # migrate + seed if empty (idempotent)
npm run db:seed -- --reset --generate    # wipe, reseed, solve a schedule
npm run design:build                     # rebuild design-system/dist previews
```

`DATABASE_PATH` overrides the SQLite location (`:memory:` works) — useful for
scripts that must not touch `data/schedule.db`.

## Architecture

A weekly supervision rota builder. Times are **minutes since midnight**
throughout; there are no dates or timezones anywhere. A schedule is a recurring
weekly template, not calendar events.

### The three layers

**`src/lib/solver.ts`** is the heart and is pure — no DB, no React. It takes
people, availability, shifts, pins and settings, and returns assignments. Three
phases: enumerate feasible patterns per weekday independently (days only couple
through the weekly objective), collapse patterns with identical
minutes-per-person vectors keeping the cheapest, then combine days with branch
and bound. Exact and sub-millisecond at this scale; `maxSearchMs` is only a
guard against a much larger roster.

Hard constraints live in the enumeration (availability, `maxGapMinutes`,
`maxOverlapMinutes`, never exceeding `requiredIdeal`). Everything else is a
weighted cost. **The weights in `DEFAULT_WEIGHTS` are tiered by orders of
magnitude on purpose** — understaffing must always dominate fairness and idle
time. Changing their relative scale changes which schedule wins, so adjust with
care and re-run the tests.

`requiredMin` vs `requiredIdeal` is the load-bearing distinction: falling below
`requiredMin` costs 10× more than falling below `requiredIdeal`. That is how the
solver knows a shift that genuinely needs 3 people outranks one where fewer is
acceptable.

**`src/lib/analyze.ts`** recomputes coverage and workload from *stored*
assignments. The solver reports the same figures for the plan it just made, but
a saved schedule drifts once shifts or availability are edited underneath it, so
the UI always renders from this rather than from solver output. It also detects
assignments that no longer fit availability (`conflicts`).

**`src/lib/db/`** — Drizzle over better-sqlite3, single file at
`data/schedule.db`. `client.ts` exports `db` as a **lazy Proxy**: the connection
opens on first property access, not at module load, because Next.js evaluates
page modules in parallel build workers that otherwise race for the write lock.
`bootstrap.ts` runs migrations and seeds on first use; every query in
`queries.ts` calls `ensureDatabase()` first.

The Shifts screen groups shifts by `(name, start, end)` and edits the whole
group at once, with weekday toggles (`updateShiftGroup`, `setShiftWeekday`,
`deleteShiftGroup`). The per-shift actions still exist and still work; the
grouped ones are what the UI uses.

### Data flow

Server components in `src/app/*/page.tsx` read synchronously via `queries.ts`
and pass plain data to client components in `src/components/`. All mutations are
server actions in `src/app/actions.ts`, each ending in `revalidatePath("/", "layout")`.
Every page is `dynamic = "force-dynamic"`.

Pinned assignments are the manual-override mechanism: `generateSchedule` reads
the pinned rows back out and feeds them to the solver as constraints, so user
locks survive regeneration. Pins the solver cannot honour come back in
`droppedPins` rather than being silently applied or dropped.

### One definition of availability

`src/lib/availability.ts` holds `coveringWindow` / `isAvailable` /
`preferenceFor`. The solver, `analyze.ts` and the manual-assignment action all
call it. It was duplicated in three places before; if they drift, the screen
contradicts the solver and a manual edit can smuggle in something the solver
would never produce. Add call sites, never copies.

`analyze.ts` also reports `violations` — gap and overlap breaches that only a
manual edit can create. The solver cannot produce them, so their presence always
means someone overrode something.

### Preferences vs. availability

`AvailabilityWindow.preference` is `preferred | neutral | avoid`. **Inability to
work is the absence of a window, never a preference value** — that separation is
what stops a soft signal from ever being traded into an impossible assignment.
Preserve it if you extend the model.

Preference is priced per minute worked (`weights.preferred`, `weights.avoid`) so
a long disliked shift costs more than a short one, and both sit far below the
understaffing weights. A preference is a tie-breaker, not a veto: the tests lock
in that Teresa disliking Tuesdays does *not* shift her hours onto the already
overloaded Noriko.

When several windows cover a shift, `coveringWindow` picks the most positive
one. `analyze.ts` duplicates that rule for stored assignments — change both
together or the screen will disagree with the solver.

### Theming

`src/styles/tokens.css` declares light and dark together via `light-dark()`;
which branch applies is decided by `color-scheme`, driven by `data-theme` on
`<html>` (absent/`light` → light, `dark` → dark, `system` → follow the OS).
Default is **light**. Lightning CSS downlevels `light-dark()` into a custom-
property switch that keeps those semantics — verify in the built CSS, not by
grepping for `light-dark` in the output.

`THEME_INIT_SCRIPT` is inlined in `<head>` to stamp the attribute before first
paint. Without it a dark-theme user gets a flash of light on every navigation.

### Undo

`src/lib/db/undo.ts`. Each mutating action calls `pushUndo({ key, params })`
first, which snapshots **all** mutable tables into `undo_stack` (capped at 5).
Undoing restores the snapshot wholesale rather than applying a per-action
inverse — the dataset is a few kilobytes, and this stays correct when one action
touches several tables. Restore preserves explicit row ids so assignments and
pins keep pointing at the same rows.

Two rules: `undoLast` must never call `pushUndo` (undo would undo itself), and
any **new mutating action must call `pushUndo`** or it becomes silently
un-undoable. Labels are stored as a key plus params, never a finished sentence,
so they translate at render time.

### i18n

English is the source of truth in `src/lib/i18n/dictionaries.ts`: its shape
defines the `Dictionary` type, so a missing Spanish key is a compile error. Add
strings to **both** objects. Locale lives in localStorage and is read through
`useSyncExternalStore` so SSR and hydration agree on the default before swapping
to the stored preference — do not replace this with `useState` + `useEffect`,
the lint rule and hydration both object.

`formatTime` is locale-dependent: English renders 12-hour, Spanish 24-hour.

The `Dictionary` type recurses to any depth, so nested groups like
`undo.actions` are checked too.

### Design system

`design-system/build.mjs` emits preview pages that **inline `tokens.css` and
`components.css` verbatim** — the same files the app ships — so a preview cannot
drift from the product. That is why the primitives in `components.css` are plain
CSS rather than `@apply`: the previews have no Tailwind. They stay inside
`@layer components` so Tailwind utilities still win for one-off overrides
(`class="field w-48"`); check that layer order survives if you touch the CSS
entry point. Rebuild and re-publish with DesignSync after changing tokens.

### Seed data

`src/lib/db/seed-data.ts` holds the school's real roster and shifts, but only as
the initial contents of a fresh database. Nothing about it is hard-coded in
behaviour — all of it is editable in the UI. The solver tests build their
fixtures from it, so editing it will move test expectations.

## Known-unsolvable constraints in the current data

These are properties of the roster, not bugs. Tests assert them, so a change
here means the data changed:

- Monday lunch needs 3 people and only 2 are ever available — permanently critical.
- Arrival can never reach 2 people on any day, including Friday.
- Noriko is the only person available before 9:00, which forces her to ~13.5h
  while Jeanette's ceiling is ~6.1h. Hours cannot be evened out further.
