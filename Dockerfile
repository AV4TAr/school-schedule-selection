# ── Builder stage ─────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# better-sqlite3 is a native module and needs a C++ toolchain to compile.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

WORKDIR /app

RUN useradd --create-home --shell /bin/bash schedule

# serverExternalPackages keeps better-sqlite3 as a real require() (see
# next.config.ts), so the compiled native module travels with node_modules
# rather than being traced into the build output.
COPY --from=builder --chown=schedule:schedule /app/package*.json ./
COPY --from=builder --chown=schedule:schedule /app/node_modules ./node_modules
COPY --from=builder --chown=schedule:schedule /app/.next ./.next
COPY --from=builder --chown=schedule:schedule /app/public ./public
COPY --from=builder --chown=schedule:schedule /app/next.config.ts ./
COPY --from=builder --chown=schedule:schedule /app/drizzle ./drizzle

# DATABASE_PATH points here; ensureDatabase() creates the file and applies
# migrations on first request if it doesn't already exist.
RUN mkdir -p /app/data && chown schedule:schedule /app/data

USER schedule

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "start"]
