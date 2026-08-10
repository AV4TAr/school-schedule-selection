# School Supervision Schedule

A local web app for building the weekly supervision rota: enter who is available
when, define the shifts that need covering, and let the solver produce the best
possible schedule — then adjust it by hand.

English by default, with a Spanish toggle in the header.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

The database is a single SQLite file at `data/schedule.db`. It is created,
migrated and seeded automatically on first run, and is gitignored — it holds
your real data, not fixtures.

```bash
npm test             # solver tests
npm run typecheck
npm run lint
npm run build && npm start   # production mode
npm run db:generate  # regenerate migrations after editing src/lib/db/schema.ts
```

## Pages

| Page | What it does |
| --- | --- |
| **Schedule** | Generates the week, flags coverage gaps, shows hours per person. Click a name to 🔒 lock them into a shift; locked assignments are kept on the next generate. |
| **Staff** | People and their availability windows. |
| **Shifts** | The slots needing supervision: day, times, minimum and preferred headcount. |
| **Settings** | The hard rules (max wait between shifts, tolerated overlap) and the solver's priorities. |
| **Print view** | A clean by-shift and by-person grid for printing or sharing. |

## How the solver works

Times are stored as minutes since midnight, so a schedule is a recurring weekly
template with no dates or timezones involved.

**Hard constraints** — never violated:

- A shift is only offered to someone if a *single* availability window covers it
  end to end.
- Nobody waits more than `maxGapMinutes` (default 45) between two of their own
  shifts.
- Nobody works two shifts that overlap by more than `maxOverlapMinutes`
  (default 5). That tolerance exists so two shifts sharing a boundary — like an
  8:00–8:45 and an 8:40–9:20 at the same post — can be worked back to back.
- No shift is ever staffed above its preferred headcount.

**Soft objectives**, in strict priority order:

1. Don't fall below a shift's minimum headcount.
2. Reach the preferred headcount.
3. Even out weekly hours between people.
4. Minimise time spent waiting between shifts.
5. Give people a day off.

The weights in Settings are tiered by orders of magnitude so the ranking can't
invert — no amount of fairness buys away a body on a short shift.

The search runs in three phases: enumerate every feasible pattern for each
weekday independently, collapse patterns that produce identical hours-per-person
(only the cheapest survives), then combine the days with branch and bound. For a
team this size the result is provably optimal and takes a couple of milliseconds.
`maxSearchMs` only exists so a much larger roster can't hang the UI.

## What the current data says

The seeded roster is the school's real one, and it has three structural problems
that no scheduling tool can solve — they need a change in availability:

- **Monday lunch (11:40–13:15) cannot be staffed.** It needs 3 people and only
  Noriko and Teresa are available. It shows permanently as *Understaffed*.
- **Arrival (8:00–8:45) can never reach 2 people.** Only Noriko can open
  Mon/Tue/Thu. On Friday both Noriko and Jeanette are free at 8:00, but lunch
  that day needs all three available people, and whoever takes the second
  arrival slot has no legal way to bridge the morning under the 45-minute rule.
- **Hours cannot be evened out.** Noriko is the only person who can work before
  9:00, and the gap rule then keeps her there all morning. The best achievable
  split is roughly Noriko 13.5h, Heather 7.9h, Teresa 7.9h, Jeanette 6.1h —
  Jeanette's ceiling is 6.1h given her availability.

The single change that fixes the most: **someone other than Noriko being able to
start at 8:00**. Widen one person's window on the Staff page and hit Generate to
see the effect immediately — that what-if is the fastest way to have the
conversation with the team.

## Changing the data

Nothing about the school is hard-coded in behaviour. People, availability,
shifts, headcounts and rules are all editable in the UI. `src/lib/db/seed-data.ts`
only supplies the starting contents of a brand-new database.
