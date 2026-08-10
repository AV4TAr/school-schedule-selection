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
```

### Database scripts

```bash
npm run db:seed                 # seed only if the database is empty (safe, idempotent)
npm run db:seed -- --generate   # ...and solve the first schedule so the app opens with one
npm run db:seed -- --reset      # WIPE everything and reseed from src/lib/db/seed-data.ts
npm run db:generate             # regenerate migrations after editing src/lib/db/schema.ts
```

Migrations always run first, so `npm run db:seed` is also how you bring an
existing database up to date without starting the app. `--reset` is destructive
and is not covered by the in-app undo.

## Pages

| Page | What it does |
| --- | --- |
| **Schedule** | Generates the week, flags coverage gaps, shows hours per person. Add or remove people by hand, and 🔒 lock anyone so the next generate keeps them. |
| **Staff** | People, their availability windows, and how they feel about each one. |
| **Shifts** | The slots needing supervision: times, headcount, and which weekdays they run on. |
| **Settings** | The hard rules (max wait between shifts, tolerated overlap) and the solver's priorities. |
| **Print view** | A clean by-shift and by-person grid for printing or sharing. |

Across every page: a **light/dark/system** theme toggle (light by default) and
**undo** for the last five actions — the ↶ button in the header, or ⌘Z / Ctrl+Z.
Undo works by restoring a full snapshot taken before each change, so it reverses
any action, including a whole schedule regeneration.

### Editing by hand

Every cell has a **+ Add someone**, which lists only the people whose
availability covers that shift — manual control does not extend to breaking a
hard rule. Anyone added by hand is locked automatically, since you just made a
decision the next Generate must not quietly discard. Hover a name to remove it,
or click it to toggle the lock.

You *can* overstaff a shift by hand even though the solver never will, and you
can create a wait longer than the maximum. Those show up as **rule warnings**
above the grid rather than being blocked — an override should be visible, not
silent.

### The Generate button

**Generate / Regenerate** re-solves the whole week from scratch: it reads the
current people, availability, shifts and settings, feeds any 🔒 locked
assignments back in as hard constraints, then **replaces every assignment** with
the result. Locks survive; everything else is recomputed.

It is the only thing that pushes a change into the schedule — editing someone's
availability does not reshuffle the week on its own. The solver is
deterministic, so pressing it twice on unchanged data gives the identical
schedule, and one press is always undoable.

## How the solver works

Times are stored as minutes since midnight, so a schedule is a recurring weekly
template with no dates or timezones involved.

### Hard rules vs. preferences

These are two different things, and the difference is deliberate:

- **Cannot work** is the *absence* of an availability window. It is a hard
  constraint — no weight, no trade-off, the solver simply cannot use that time.
- **Preference** is a property *of* a window: `prefers`, `can work`, or
  `rather not`. It is soft. It breaks ties and nudges the schedule, but it never
  overrides coverage, and it will not be allowed to wreck a fair split of hours.

So marking every hour as "rather not" changes nothing about who *can* be
scheduled — to rule a time out, remove the window.

Preferences attach to a whole window. To express "I can work 9–1:15 but would
rather not do recess", split it into two windows. If windows on the same day
overlap, the most positive preference wins and the Staff page says so.

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
6. Honour preferred hours and stay out of disliked ones.

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

## Deploying

See [DEPLOYMENT.md](DEPLOYMENT.md) for running it as a service on a Mac mini
behind a reverse proxy. **Read the warning at the top first** — the app has no
authentication, so the proxy has to provide it.

## Changing the data

Nothing about the school is hard-coded in behaviour. People, availability,
shifts, headcounts and rules are all editable in the UI. `src/lib/db/seed-data.ts`
only supplies the starting contents of a brand-new database.
