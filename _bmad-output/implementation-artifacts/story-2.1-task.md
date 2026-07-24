---
story: "2.1"
title: Create Task
epic: "Epic 2 — Task Board"
frs: [FR3]
capability: CAP-3
wave: 1 of 5 (Scrum Master — this artifact)
sources:
  - ../planning-artifacts/epics.md (Story 2.1; Epic 2 overview + Stories 2.2–2.5 for sequencing context)
  - ../planning-artifacts/architecture/architecture-bmad-teams-2-2026-07-19/ARCHITECTURE-SPINE.md
  - ../../CLAUDE.md (ownership table, Database Schema — `tasks` table shape)
  - ../../epics-to-agents-handoff.md (dispatch process)
  - ./story-1.1-task.md, ./story-1.2-task.md (sibling task sheets — format reference; Epic 1 authors the shared files this story extends)
---

# Story 2.1 — Create Task · Wave Task Sheet

## 1. User Story & Acceptance Criteria (verbatim from epics.md)

As an authenticated user,
I want to create a task with a title and optional description,
So that I can start tracking work I need to do.

**Acceptance Criteria:**

**Given** a valid title (description optional)
**When** I submit the create-task form
**Then** a task is created with status `todo`, appended to the end of that column with a gap-based `order` (AD-5)
**And** the response matches the canonical Task DTO (AD-11)

**Given** an empty or missing title
**When** I submit the form
**Then** the request is rejected with `400` and no task is created

**Given** the description field is left blank
**When** the task is created
**Then** `description` is stored and returned as `null`, never `""` (AD-11)

> Scope note: Story 2.1 is **Create Task only**. `GET /api/tasks` (view, Story 2.2), `PATCH /api/tasks/:id/move` (Story 2.3), `PATCH /api/tasks/:id` (Story 2.4), and `DELETE /api/tasks/:id` (Story 2.5) are **out of scope** here — but this story is the first to lay the `tasks` table, `routes/tasks.ts`, `middleware/auth.ts`, and `useTaskBoard.ts` that those later stories extend.

## 2. Per-Directory Sub-Units (classified against CLAUDE.md ownership table)

### DB sub-unit — `src/db/` (DB Engineer) — **required this story**

First story to touch `src/db/` since Story 1.1's Wave 2. It **EXTENDS** the existing schema; it does **not** re-author it.
- `schema.ts` — **ADD a second table `tasks`** alongside the existing `users` table (which is untouched). Per CLAUDE.md's Database Schema section: `id` (int PK autoincrement), `title` (text, not null), `description` (text, **nullable** — AD-11 canonicalizes empty → `null`), `status` (text, not null; one of `todo`/`in_progress`/`done`), `userId` (int, **FK → users.id**), `order` (int, not null — gap-based position within column, AD-5), `createdAt` (timestamp, default now), `updatedAt` (timestamp, default now). Export `Task` / `NewTask` inferred types alongside the existing `User` / `NewUser`.
- **New migration** — generate `drizzle/0001_*.sql` via `npm run db:generate` (drizzle-kit) for the new `tasks` table, then it is applied by the existing runner. The migration SQL lands in `./drizzle/` at repo root and `drizzle.config.ts` sits at root — precedent set by Story 1.1 Wave 2 (`drizzle/0000_*.sql`): the DB Engineer manages `./drizzle` + `drizzle.config.ts` as part of the DB sub-unit even though they sit outside `src/db/` in the physical tree.
- **No change to `src/db/index.ts`** — the connection is generic (`import * as schema`), so the new table is picked up automatically. Confirmed against the current file.
- **No change to `src/db/migrate.ts`** — it is a generic runner (`migrate(db, { migrationsFolder: './drizzle' })`), table-agnostic. It applies the new migration with no edit.
- Out of scope: `seed.ts` (no task seed data required by this story), any change to the `users` table.
- **Bound by:** AD-3 (better-sqlite3 driver), AD-9 (if any insert helper is wrapped in `db.transaction`, the callback stays synchronous — though a single-row insert needs no transaction). AD-11's `description` nullability is expressed at the schema level here (column is nullable). AD-1 throughout.

### Backend sub-unit — `src/api/` (Backend Dev)

`POST /api/tasks` **only** — the first route in a **NEW** `routes/tasks.ts` (does **not** touch `routes/auth.ts`).
- `routes/tasks.ts` — **NEW file.** `POST /api/tasks`: read the authenticated user from `req.userId` (set by the auth middleware — never re-decode the token, AD-7). Validate `title` present/non-empty → else `400` (`fail(...)`). Canonicalize `description` to `null` when blank/absent (AD-11). Compute the new `order` **gap-based** per AD-5: append to the end of the user's `todo` column — `order` = (current max `order` among the user's `todo` tasks) + 1000, or 1000 when the column is empty (list-boundary rule). Insert with `status: 'todo'`, return `{ data: <canonical Task DTO> }` (AD-11: camelCase, `createdAt`/`updatedAt` as ISO 8601 strings, `description: string | null`). Query Drizzle directly, no service layer (AD-6).
- `middleware/auth.ts` — **NEW file, first authored here.** Story 2.1 is the **first story with a protected route**; Story 1.1 (register) and Story 1.2 (login) are both public, so neither needed it. This is **not a gap that should have been built earlier** — AD-7 pins a *single* `middleware/auth.ts`, and the correct authoring point is the first story that actually has a protected route, which is this one. It verifies the `Authorization: Bearer <token>` via `lib/jwt.ts` (`jose`), sets `req.userId: number` on success, and returns `401` (`fail(...)`) on missing/invalid/expired token (AD-7, AD-8 taxonomy).
- **REUSES (does not create):** `lib/respond.ts` (`ok`/`fail` envelope, AD-8), `lib/jwt.ts` (`jose` verify helper, AD-7), and `index.ts` (Express bootstrap) — all authored by **Story 1.1's Backend wave**. Story 2.1 Backend **edits `index.ts`** to mount the new tasks router alongside the existing auth router.
- **Cross-story gate:** cannot dispatch until **Story 1.1's Backend wave (Wave 3) has merged to main** — `lib/respond.ts`, `lib/jwt.ts`, and `index.ts` do not exist until then (on main today only `src/db/` exists; see §3). Independent of Story 1.2's Backend wave — Story 1.2 edits `auth.ts` only, which this story never touches.
- Does **NOT** reuse anything task-ordering-related — AD-5's gap-based ordering logic is **new to this story** (Story 2.1 is the first `tasks` writer).
- Out of scope: `GET /api/tasks`, `PATCH /api/tasks/:id`, `PATCH /api/tasks/:id/move`, `DELETE /api/tasks/:id` (Stories 2.2–2.5), any change to `routes/auth.ts`.
- **Bound by:** AD-5 (gap-based `order`, append at column end), AD-6 (Drizzle direct, no service layer), AD-7 (`middleware/auth.ts` sets `req.userId`; verify via `lib/jwt.ts`), AD-8 (`respond.ts` envelope; `400` empty title, `401` bad/missing auth; `422` never used), AD-11 (canonical Task DTO out, `description` → `null`, create body `{ title: string, description?: string | null }`). AD-9 only if an insert is wrapped in a transaction.

### Frontend sub-unit — `src/client/` incl. `lib/api.ts` (Frontend Dev)

A minimal **create-task form**, wired through the shared board hook.
- `hooks/useTaskBoard.ts` — **NEW file, first authored here, against the full pinned AD-4 signature.** **Reasoned call (documented, not guessed):** Story 2.1 authors `useTaskBoard.ts` with the *complete* AD-4 signature but implements **only `createTask`**; `tasksByStatus` (initialized empty), `isLoading`, `updateTask`, `moveTask`, `deleteTask` are present-but-deferred stubs matching the pinned types exactly. Rationale: AD-4's rule is explicit — *"the first story that needs it creates it against this pinned signature; every later story that touches the same file is sequenced within its wave."* Story 2.1 is the first story needing any board mutation (`createTask` is part of the hook), so it is the **single authoring sub-unit** for this file. The two alternatives are worse: (a) having the create form call `api.ts`'s `createTask()` directly and hold no hook would force the form to bypass the hook and later be refactored when Story 2.2 authors `useTaskBoard`, reintroducing exactly the divergence AD-4 exists to prevent; (b) deferring authorship to Story 2.2 leaves this story's form with no compliant seam to consume. Constraint on later stories: 2.2 fills `tasksByStatus`/`isLoading` (the `GET` fetch), 2.3 `moveTask`, 2.4 `updateTask`, 2.5 `deleteTask` — each **edits bodies only, never the signature**.
- `lib/api.ts` — **EXTENDS** (does not create): add a `createTask(title, description)` call that `POST`s to `/api/tasks` and unwraps through the one shared response-parsing function (AD-8). Remains the **sole reader** of `taskflow_token` (attaches `Authorization: Bearer <token>`, AD-10). Authored by Story 1.1's Frontend wave.
- Create-task UI component — **NEW.** A functional component (title input + optional description; client-side required-`title` check mirroring the server's `400`) whose submit calls `useTaskBoard().createTask(...)`. (CLAUDE.md's tree names `TaskBoard.tsx`; the full board render is Story 2.2, so Story 2.1 adds only the minimal creation surface — a `CreateTaskForm` or the create affordance of `TaskBoard.tsx`. Either is acceptable provided it consumes `createTask` **through the hook**, never `api.ts` directly.)
- **REUSES (does not edit):** `hooks/useAuth.ts` for the authenticated session — the create call is authorized via the token `api.ts` already reads; no change to `useAuth.ts` is expected.
- **Cross-story gate:** cannot dispatch until **Story 1.1's Frontend wave (Wave 4) has merged to main** — `lib/api.ts` (and `useAuth.ts`) do not exist until then. Independent of Story 1.2's Frontend wave (which edits `useAuth.ts`/`api.ts` for `login`; Story 2.1 adds a *new* `createTask` alongside — but to avoid same-file contention on `api.ts`, sequence after Epic 1's Frontend work on that file has settled; see §3).
- Out of scope: board rendering (`KanbanColumn.tsx`, `TaskCard.tsx`, `tasksByStatus` population — Story 2.2), drag-and-drop (2.3), edit/delete UI (2.4/2.5), `LoginForm.tsx`/`RegisterForm.tsx` (Epic 1).
- **Bound by:** AD-4 (author `useTaskBoard.ts` against the pinned signature; the form consumes task state/actions only through it), AD-8 (`api.ts` unwraps via the one shared function), AD-10 (`api.ts` sole reader of `taskflow_token`), AD-11 (client `Task` type + create body match the canonical DTO). **Not** bound by AD-5's *client-side* re-sort concern (Story 2.1 renders no list) — but the `order` it receives is server-authoritative.

### Integrator sub-unit — `tests/`, `.env` (Integrator)

- `tests/tasks.test.ts` — **NEW file**, creation coverage only: happy path (valid title, optional description → task created `status: 'todo'`, gap-based `order`, response is the canonical Task DTO with no `password`/foreign fields); empty/missing title → `400`, no row created; blank description → stored and returned as `null`, never `""` (AD-11); unauthenticated `POST /api/tasks` → `401` (exercises the new `middleware/auth.ts`).
- `tests/setup.ts` — **REUSES** the existing harness (DB init/teardown + authenticated-request helper). **May extend** it *only* if a task-specific fixture proves necessary — but the existing authenticated-request helper (create user → token) plus a direct `POST /api/tasks` is expected to suffice, so no new fixture is anticipated. Flag if one is added.
- `.env` — **no new keys.** `JWT_SECRET`, `PORT`, `DATABASE_URL` already cover this story (auth + DB path); Create Task introduces no new configuration. Flag only if a task-specific key emerges (none expected).
- **Cross-story gate:** cannot dispatch until **Story 1.1's Integrator wave (Wave 5) has merged to main** — `tests/setup.ts` and `.env` do not exist until then. Independent of Story 1.2's Integrator wave (which extends `auth.test.ts`; Story 2.1 creates a *separate* `tasks.test.ts`).
- Out of scope: `auth.test.ts`, any view/move/edit/delete coverage (Stories 2.2–2.5).
- **Bound by:** AD-12 (import shared `setup.ts`; no hand-rolled DB reset/login), AD-8 (assert envelope + `400`/`401` status codes), AD-11 (assert canonical Task DTO; `description` `null` not `""`), AD-5 (assert the appended `order` is gap-based). AD-2 gating.

## 3. Five-Wave Dispatch Plan (this story, in order)

All 5 waves apply (unlike Story 1.2, which had no DB wave). Each wave is one Task; each wave's diff must pass `bmad-code-review` **and** land its own PR before the next wave dispatches (AD-2, handoff Step 4).

| Wave | Role | Directory | Sub-unit | Depends on (this story) | Cross-story gate (must be merged to main first) |
|---|---|---|---|---|---|
| 1 | Scrum Master | `_bmad-output/implementation-artifacts/` | This task sheet | — | — |
| 2 | DB Engineer | `src/db/` (+ `./drizzle`) | Add `tasks` table + migration | Wave 1 | **Only the `users` table (Story 1.1 Wave 2 — already merged).** No dependency on Epic 1 Backend/Frontend/Integrator waves. |
| 3 | Backend Dev | `src/api/` | `POST /api/tasks` (new `routes/tasks.ts`), new `middleware/auth.ts`, mount in `index.ts` | Wave 2 (`tasks` schema) | **Story 1.1 Wave 3 (Backend)** — needs `index.ts`, `lib/respond.ts`, `lib/jwt.ts`. |
| 4 | Frontend Dev | `src/client/` | new `useTaskBoard.ts` (pinned signature, `createTask` only), extend `api.ts`, create-task form | Wave 3 (endpoint) | **Story 1.1 Wave 4 (Frontend)** — needs `api.ts`, `useAuth.ts`. |
| 5 | Integrator | `tests/`, `.env` | new `tasks.test.ts`, reuse `setup.ts` | Wave 4 (endpoint + `api.ts`) | **Story 1.1 Wave 5 (Integrator)** — needs `setup.ts`, `.env`. |

### Does Story 2.1 block on all of Epic 1 finishing? No — reason per sub-unit.

The prompt's key question, answered precisely (not "the whole story is blocked on Epic 1"):

- **DB sub-unit (Wave 2) — unblocked by Epic 1 beyond Story 1.1 Wave 2.** The `tasks` table's only external reference is `userId → users.id`. The `users` table already exists on main (Story 1.1 Wave 2, commit `809f706`). The schema references **no** route, component, or test, so it has **zero** dependency on Epic 1's Backend (1.1 W3 / 1.2 W2), Frontend (1.1 W4 / 1.2 W3), or Integrator (1.1 W5 / 1.2 W4) waves. It shares `schema.ts` with Story 1.1's DB sub-unit (same-file), but that is **already merged**, so there is no live contention. **Wave 2 can dispatch as soon as this task sheet (Wave 1) lands** — gated only on the `users` table existing, which it does.
- **Backend / Frontend / Integrator sub-units (Waves 3/4/5) — each gated on the *corresponding* Story 1.1 wave**, because they extend/reuse files Epic 1 authors (see the cross-story file table below), **not** on all of Epic 1 nor on Story 1.2. Story 1.2 edits `auth.ts` / `useAuth.ts` / `api.ts` / `auth.test.ts`; Story 2.1 creates `tasks.ts` / `tasks.test.ts` and adds `createTask` to `api.ts`. The only shared-file overlap with Epic 1 is **`api.ts`** (both Story 1.2 W3 and Story 2.1 W4 add a function to it) and **`index.ts`** (Story 1.1 W3 authors, Story 2.1 W3 mounts the tasks router) — sequence Story 2.1's Frontend/Backend waves after Epic 1's work on those two files has merged to avoid same-file contention (AD-4 single-authoring + handoff same-directory-parallelism guidance).

**Net:** on `main` today only `src/db/` exists. Story 2.1's **DB wave can proceed immediately**; its Backend/Frontend/Integrator waves are held until Story 1.1's matching waves (W3/W4/W5) merge. Story 2.1 is **not** monolithically blocked on Epic 1 completing.

### Cross-story same-file dependency table (which files Epic 1 authors vs. Story 2.1 touches)

| File | Authored by | Status on main today | Story 2.1 touches it in… | Nature |
|---|---|---|---|---|
| `src/db/schema.ts` | Story 1.1 W2 (DB) | **merged** | Wave 2 | **extend** — add `tasks` table |
| `src/db/migrate.ts`, `src/db/index.ts` | Story 1.1 W2 (DB) | merged | — | **no edit** (generic) |
| `./drizzle/*.sql`, `drizzle.config.ts` | Story 1.1 W2 (DB) | merged | Wave 2 | **new migration** `0001_*` |
| `src/api/index.ts` | Story 1.1 W3 (Backend) | not merged | Wave 3 | **edit** — mount tasks router |
| `src/api/lib/respond.ts`, `src/api/lib/jwt.ts` | Story 1.1 W3 (Backend) | not merged | Wave 3 | **reuse** — must exist |
| `src/api/middleware/auth.ts` | **Story 2.1 W3** (first author) | does not exist | Wave 3 | **NEW** — first protected route |
| `src/api/routes/tasks.ts` | **Story 2.1 W3** (first author) | does not exist | Wave 3 | **NEW** |
| `src/client/lib/api.ts` | Story 1.1 W4 (Frontend) | not merged | Wave 4 | **extend** — add `createTask` |
| `src/client/hooks/useAuth.ts` | Story 1.1 W4 (Frontend) | not merged | Wave 4 | **reuse** — no edit expected |
| `src/client/hooks/useTaskBoard.ts` | **Story 2.1 W4** (first author) | does not exist | Wave 4 | **NEW** — pinned AD-4 signature |
| create-task component | **Story 2.1 W4** (first author) | does not exist | Wave 4 | **NEW** |
| `tests/setup.ts` | Story 1.1 W5 (Integrator) | not merged | Wave 5 | **reuse** (extend only if needed) |
| `tests/tasks.test.ts` | **Story 2.1 W5** (first author) | does not exist | Wave 5 | **NEW** |
| `.env` | Story 1.1 W5 (Integrator) | not merged | Wave 5 | **reuse** — no new keys |

## 4. AD Binding Index (which ADs apply to Create Task, and which deliberately do not)

Per the Capability→Architecture map, **CAP-3 Create task is governed by AD-5, AD-6, AD-8, AD-11**. Add the substrate/process ADs each sub-unit sits on.

| Sub-unit | Binding ADs | Deliberately NOT bound |
|---|---|---|
| DB (`src/db/`) | AD-3 (better-sqlite3), AD-9 (sync txn callback *if* used), AD-11 (nullable `description` column) (+ AD-1) | AD-4 (Frontend hook), AD-6/AD-7/AD-8 (Backend), AD-13 (Auth DTO) |
| Backend (`src/api/`) | AD-5 (gap-based append `order`), AD-6 (Drizzle direct), AD-7 (`middleware/auth.ts` → `req.userId`, verify via `jwt.ts`), AD-8 (`respond.ts` envelope; `400`/`401`), AD-11 (Task DTO out, `description`→`null`, create body) (AD-9 if insert wrapped in txn) | AD-13 (Auth DTO — this route issues no token), AD-4 (Frontend hook), AD-10 (client token storage) |
| Frontend (`src/client/`) | AD-4 (author `useTaskBoard.ts` at pinned signature; form consumes via it), AD-8 (`api.ts` one shared unwrap), AD-10 (`api.ts` sole token reader), AD-11 (client Task type + create body) | AD-5 client re-sort (renders no list this story), AD-13 (Auth DTO), AD-6/AD-7 (Backend) |
| Integrator (`tests/`, `.env`) | AD-12 (shared `setup.ts`), AD-8 (envelope + `400`/`401`), AD-11 (canonical Task DTO; `description` `null`), AD-5 (gap-based `order` assertion) | AD-13 (Auth DTO — covered by `auth.test.ts`), AD-4 (hook internals) |
| Process (all waves) | AD-1 (ownership), AD-2 (wave-gated + per-wave PR) | — |

### Why AD-11 + AD-5 are the load-bearing ADs for this story
AD-11 pins the two failure-prone details the AC calls out explicitly: the response must be the **exact** canonical Task DTO (camelCase, ISO 8601 dates, `description: string | null`), and a blank description must be `null` **end-to-end** — stored `null`, returned `null`, never `""`. AD-5 pins the third: a new task is **appended** to the `todo` column with a **gap-based** `order` (max existing `order` + 1000, or 1000 at boundary), establishing the ordering discipline that Stories 2.2 (server-authoritative sort) and 2.3 (move/reindex) build on. AD-7 is load-bearing for the *substrate*: Story 2.1 is where the single `middleware/auth.ts` is first authored, since it is the first protected route in the app.
