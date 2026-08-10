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

### Data flow

Server components in `src/app/*/page.tsx` read synchronously via `queries.ts`
and pass plain data to client components in `src/components/`. All mutations are
server actions in `src/app/actions.ts`, each ending in `revalidatePath("/", "layout")`.
Every page is `dynamic = "force-dynamic"`.

Pinned assignments are the manual-override mechanism: `generateSchedule` reads
the pinned rows back out and feeds them to the solver as constraints, so user
locks survive regeneration. Pins the solver cannot honour come back in
`droppedPins` rather than being silently applied or dropped.

### i18n

English is the source of truth in `src/lib/i18n/dictionaries.ts`: its shape
defines the `Dictionary` type, so a missing Spanish key is a compile error. Add
strings to **both** objects. Locale lives in localStorage and is read through
`useSyncExternalStore` so SSR and hydration agree on the default before swapping
to the stored preference — do not replace this with `useState` + `useEffect`,
the lint rule and hydration both object.

`formatTime` is locale-dependent: English renders 12-hour, Spanish 24-hour.

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
