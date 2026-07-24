import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import * as schema from './schema';

/**
 * Shared SQLite connection + Drizzle client (AD-3: better-sqlite3 driver only).
 *
 * Every later Backend query imports `db` from here — this is the single
 * connection point for the whole app. DATABASE_URL is a filesystem path to the
 * SQLite file; it defaults to `taskflow.db` at the repo root for local dev.
 * (The `.env` file itself is owned by the Integrator sub-unit.)
 */
const databaseUrl = process.env.DATABASE_URL ?? 'taskflow.db';

export const sqlite = new Database(databaseUrl);

// WAL improves concurrent read/write behavior for the local dev server.
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
