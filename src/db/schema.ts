import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * users — account records for TaskFlow.
 *
 * Story 1.1 (User Registration) owns this table. The `tasks` table arrives in a
 * later story. `password` holds a bcrypt hash (never a plaintext password) and is
 * never returned over the API (AD-13).
 */
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * tasks — Kanban cards owned by a user (Story 2.1, Create Task).
 *
 * `description` is nullable: a blank description is canonicalized to `null`
 * end-to-end, never `""` (AD-11). `status` is constrained to the three fixed
 * columns. `order` is a plain not-null integer holding the gap-based position
 * within a column — the assignment logic (spacing of 1000, midpoint on move)
 * lives in the Backend sub-unit (AD-5); the schema only guarantees the column
 * exists. `userId` is a real foreign key to `users.id`, enforced because
 * `foreign_keys = ON` is set on the connection (see ./index.ts).
 */
export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status', { enum: ['todo', 'in_progress', 'done'] }).notNull(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  order: integer('order').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
