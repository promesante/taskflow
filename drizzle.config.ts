import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit config — drives `npm run db:generate` (SQL migration generation
 * from src/db/schema.ts into ./drizzle). SQLite dialect, better-sqlite3 driver
 * (AD-3). DATABASE_URL defaults to the local dev DB file.
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'taskflow.db',
  },
});
