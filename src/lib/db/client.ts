import "server-only";

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

type Db = BetterSQLite3Database<typeof schema>;

let instance: Db | null = null;

/**
 * Opens the database on first use rather than at module load. Next.js evaluates
 * page modules in several parallel workers while building, and connecting
 * eagerly made them race each other for the write lock.
 */
export function getDb(): Db {
  if (instance) return instance;

  // `DATABASE_PATH` lets tests and scripts point at a scratch file or ":memory:".
  const dbPath =
    process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "schedule.db");
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const sqlite = new Database(dbPath);
  // Wait rather than fail outright if another process holds the lock.
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  instance = drizzle(sqlite, { schema });
  return instance;
}

/**
 * Lazy stand-in for the Drizzle instance, so call sites can keep using `db.…`
 * without forcing a connection when the module is merely imported.
 */
export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
