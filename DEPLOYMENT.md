# Deployment

Target: a Mac mini running the app as a background service, reached from the
outside through your own URL via a bastion / reverse proxy.

---

## ⚠️ Read this before exposing it

**The app has no authentication.** There is no login, no user accounts, no
permission model. Anyone who can reach the URL can read the roster, see every
person's availability, and change or delete the schedule.

That is fine behind a bastion **only if the bastion itself authenticates the
request**. Before pointing a public hostname at this:

- Terminate TLS at the proxy and require auth there — SSO, Cloudflare Access,
  Tailscale, mTLS, or at minimum HTTP basic auth.
- Never expose the Node port directly to the internet.
- Keep the app bound to loopback (below) so the proxy is the only way in.

If you'd rather the app handled its own login, say so — it's a real feature,
not a config flag, and it isn't built yet.

---

## Prerequisites

- Node.js 20 or newer (`node -v`)
- Git
- The repo cloned somewhere stable, e.g. `/Users/Shared/school-schedule-selection`

`better-sqlite3` is a native module and compiles on install. If `npm ci` fails
to build it, install Xcode command line tools: `xcode-select --install`.

## First deploy

```bash
git clone git@github.com:AV4TAr/school-schedule-selection.git
cd school-schedule-selection
npm ci
npm run build
```

Test it in the foreground before installing the service:

```bash
HOSTNAME=127.0.0.1 PORT=3000 npm start
```

Visit `http://127.0.0.1:3000`. On first run the app creates `data/schedule.db`,
applies migrations and seeds the roster.

**`HOSTNAME=127.0.0.1` matters.** It binds to loopback only, so the app is
unreachable from the network except through the proxy running on the same
machine. Without it, Next.js listens on all interfaces.

## Run it as a service

`deploy/com.school.schedule.plist` is a launchd template. Install it per-user
(no root needed, runs on login and restarts on crash):

```bash
# Edit the paths inside the plist first — it ships with placeholders.
cp deploy/com.school.schedule.plist ~/Library/LaunchAgents/
launchctl load  ~/Library/LaunchAgents/com.school.schedule.plist
launchctl start com.school.schedule
```

Check on it:

```bash
launchctl list | grep school.schedule      # PID and last exit code
tail -f /Users/Shared/school-schedule-selection/logs/stdout.log
tail -f /Users/Shared/school-schedule-selection/logs/stderr.log
```

Stop or remove:

```bash
launchctl stop   com.school.schedule
launchctl unload ~/Library/LaunchAgents/com.school.schedule.plist
```

A user LaunchAgent only runs while that user is logged in. For a Mac mini that
should stay up headless, either enable automatic login for that account, or
install the plist to `/Library/LaunchDaemons` as root and add `UserName` to it.

## Reverse proxy

The app speaks plain HTTP on `127.0.0.1:3000`. Proxy to it and forward the
usual headers:

```nginx
location / {
    proxy_pass         http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_set_header   Upgrade           $http_upgrade;
    proxy_set_header   Connection        "upgrade";
}
```

The app doesn't generate absolute URLs or set cookies, so it works under a
subpath or a bare hostname without extra configuration.

## The database

Everything lives in one SQLite file: `data/schedule.db` (plus `-wal` and `-shm`
alongside it while running). It is gitignored — it holds real staff data.

`DATABASE_PATH` overrides the location if you'd rather keep it outside the repo:

```bash
DATABASE_PATH=/Users/Shared/schedule-data/schedule.db npm start
```

### Backups

Copying the `.db` file while the app is running gives you a torn copy. Use
SQLite's own backup, which is safe against a live writer:

```bash
sqlite3 data/schedule.db ".backup '/Users/Shared/backups/schedule-$(date +%F).db'"
```

A daily LaunchAgent or a cron line is enough — the file is tiny. Keep a few
weeks; a bad edit is far more likely than disk failure, and the in-app undo
only goes back five steps.

### Restoring

Stop the service, replace `data/schedule.db`, delete any stale `-wal`/`-shm`
files next to it, start again.

## Upgrading

```bash
launchctl stop com.school.schedule
git pull
npm ci
npm run build
launchctl start com.school.schedule
```

Migrations apply automatically on the first request after start. **Back up
first** — migrations are not reversible.

## Health check

There is no dedicated health endpoint. `GET /` returns 200 with the schedule
page and touches the database, which makes it an adequate liveness probe:

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/
```

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `SQLITE_BUSY` / `database is locked` | Two processes on the same file — a stray `npm run dev` alongside the service. Only one should run. |
| `Cannot find module ... better-sqlite3.node` | Native module built for a different Node version. `npm rebuild better-sqlite3`, or `rm -rf node_modules && npm ci`. |
| Service flaps in `launchctl list` (non-zero exit) | Read `logs/stderr.log`. Usually a wrong `WorkingDirectory` or Node not on the plist's `PATH`. |
| Page loads unstyled | `npm run build` wasn't rerun after pulling. |
| Blank schedule after upgrade | Expected if the seed ran against a fresh database — check `DATABASE_PATH` points at the real file. |
