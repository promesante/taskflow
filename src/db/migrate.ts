import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { db, sqlite } from './index';

/**
 * Migration runner — applies every generated SQL migration in ./drizzle to the
 * SQLite database, creating the `users` table on a fresh DB (AD-3).
 *
 * Migrations are generated from `schema.ts` via `npm run db:generate`
 * (drizzle-kit), then applied here. Run with `npm run db:migrate`.
 */
migrate(db, { migrationsFolder: './drizzle' });
sqlite.close();

console.log('Migrations applied.');
