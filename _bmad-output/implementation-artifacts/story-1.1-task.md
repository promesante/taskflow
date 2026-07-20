---
story: "1.1"
title: User Registration
epic: "Epic 1 — Account & Access"
frs: [FR1]
capability: CAP-1
wave: 1 of 5 (Scrum Master — this artifact)
sources:
  - ../planning-artifacts/epics.md (Story 1.1)
  - ../planning-artifacts/architecture/architecture-bmad-teams-2-2026-07-19/ARCHITECTURE-SPINE.md
  - ../../CLAUDE.md (ownership table)
  - ../../epics-to-agents-handoff.md (dispatch process)
---

# Story 1.1 — User Registration · Wave Task Sheet

## 1. User Story & Acceptance Criteria (verbatim from epics.md)

As a new user,
I want to register for an account with my email, password, and name,
So that I can access TaskFlow and start managing my tasks.

**Acceptance Criteria:**

**Given** a visitor submits a unique, valid email, a password, and a name
**When** they submit the registration form
**Then** a new user account is created with the password hashed via bcrypt (≥10 salt rounds)
**And** they receive `{data: {token, user: {id, email, name}}}` and are immediately authenticated — no separate login step

**Given** a visitor submits an email that is already registered
**When** they submit the registration form
**Then** the request is rejected with `409` and a clear `{error}` message
**And** no duplicate account is created

**Given** a visitor omits a required field (email/password/name) or submits an invalid email format
**When** they submit the registration form
**Then** the request is rejected with `400` and a descriptive `{error}` message
**And** no account is created

**Given** a successful registration
**When** the response is received by the client
**Then** the JWT is stored under the `taskflow_token` key and the user lands on the task board

## 2. Per-Directory Sub-Units (classified against CLAUDE.md ownership table)

### DB sub-unit — `src/db/` (DB Engineer)
First-ever story touching `src/db/`, so it also lays the DB foundation.
- `schema.ts` — `users` table only: `id` (int PK autoincrement), `email` (text, unique, not null), `password` (text, not null — bcrypt hash), `name` (text, not null), `createdAt` (timestamp, default now). No `tasks` table this story.
- `index.ts` — DB connection + Drizzle client export (better-sqlite3 driver), the shared foundation every later Backend query imports.
- `migrate.ts` — migration runner that creates the `users` table.
- Out of scope here: `tasks` table, `seed.ts` task data.
- **Bound by:** AD-3 (better-sqlite3 driver), AD-9 (any `db.transaction` callback stays synchronous). AD-1 ownership throughout.

### Backend sub-unit — `src/api/` (Backend Dev)
First-ever story touching `src/api/`, so it bootstraps the Express app + shared helpers.
- `index.ts` — Express app entry point / bootstrap; CORS restricted to `http://localhost:5173`; JSON body parsing; mount auth router.
- `routes/auth.ts` — `POST /api/auth/register` **only** (login is Story 1.2). Validate required fields + email format (→ `400`), reject duplicate email (→ `409`), bcrypt-hash password (≥10 salt rounds), insert user, sign JWT, return `{data: {token, user: {id, email, name}}}`. Query Drizzle directly (no service layer). `password` never in the response.
- `lib/jwt.ts` — `jose`-only sign/verify helpers; 7-day expiry. Shared foundation for all auth (this story is the first to need it).
- `lib/respond.ts` — shared response-envelope helper `ok(data)` / `fail(error)`; `error` always a plain string. Shared foundation.
- Out of scope here: `POST /api/auth/login`, `routes/tasks.ts`, `middleware/auth.ts` (no protected route in this story — register is public; middleware arrives when the first protected route does).
- **Bound by:** AD-6 (route calls Drizzle directly, no service/repo layer), AD-7 (`jose`-only sign/verify via `lib/jwt.ts`), AD-8 (`respond.ts` envelope; fixed status taxonomy — `400` validation, `409` duplicate email; `422` never used), AD-13 (canonical Auth/User response DTO `{data:{token,user:{id,email,name}}}`, `password` excluded). AD-9 if the insert is wrapped in a transaction. **Not** bound by AD-11/AD-5/AD-4 (Task/board-specific).

### Frontend sub-unit — `src/client/` incl. `lib/api.ts` (Frontend Dev)
- `components/RegisterForm.tsx` — functional component; email/password/name fields; client-side required-field check; submit calls the api-client register function; on success routes user to the task board; renders the `{error}` string on `400`/`409`.
- `hooks/useAuth.ts` — auth state; **sole writer** of `taskflow_token` in `localStorage` (sets on register success). Destructures `{token, user}` from the register response.
- `lib/api.ts` — register call function + the one shared response-unwrap function; **sole reader** of `taskflow_token` (attaches `Authorization: Bearer <token>`). Created here as the first story to need it.
- Out of scope here: `LoginForm.tsx` (Story 1.2), any board/task components, `useTaskBoard.ts`.
- **Bound by:** AD-8 (`api.ts` unwraps every response through one shared function), AD-10 (token at `taskflow_token`; `useAuth` sole writer, `api.ts` sole reader), AD-13 (`useAuth` destructures `{token, user}` identically to how login later will). **Not** bound by AD-4 — that is board-specific (`useTaskBoard`); registration never touches board state.

### Integrator sub-unit — `tests/`, `.env` (Integrator)
First-ever story touching `tests/`, so it lays the harness foundation.
- `tests/setup.ts` — shared test harness: test DB init/teardown + an authenticated-request helper. Shared foundation every later test imports.
- `tests/auth.test.ts` — registration coverage against a real endpoint: happy path (user created, bcrypt-hashed, `{data:{token,user}}` returned, no `password` leaked); duplicate email → `409`, no duplicate row; missing field / invalid email → `400`, no row created.
- `.env` — `JWT_SECRET`, `PORT`, `DATABASE_URL`.
- Out of scope here: `tasks.test.ts`, login coverage.
- **Bound by:** AD-12 (all tests import shared `setup.ts`; no hand-rolled DB reset/login), AD-8 (assert envelope shape + status codes), AD-13 (assert canonical Auth DTO, `password` absent). AD-2 gating.

## 3. Five-Wave Dispatch Plan (this story, in order)

Each wave is one Task within the Story. Each wave's diff must pass `bmad-code-review` **and** land its own PR before the next wave is dispatched (hard gate — epics-to-agents-handoff.md Step 4, AD-2).

| Wave | Role | Directory | Sub-unit | Depends on | Gate |
|---|---|---|---|---|---|
| 1 | Scrum Master | `_bmad-output/implementation-artifacts/` | This task sheet | — | review + PR |
| 2 | DB Engineer | `src/db/` | `users` schema + `index.ts` foundation + `migrate.ts` | Wave 1 | review + PR |
| 3 | Backend Dev | `src/api/` | `POST /api/auth/register`, `index.ts`, `lib/jwt.ts`, `lib/respond.ts` | Wave 2 (schema) | review + PR |
| 4 | Frontend Dev | `src/client/` | `RegisterForm.tsx`, `useAuth.ts`, `lib/api.ts` | Wave 3 (endpoint) | review + PR |
| 5 | Integrator | `tests/`, `.env` | `setup.ts` foundation, `auth.test.ts` | Wave 4 (endpoint + api.ts) | review + PR |

Notes:
- Story 1.1 has **no pure-UI Frontend sub-unit** that could run parallel with Wave 3 — `RegisterForm` consumes the register endpoint, so it must wait for Wave 4.
- Waves run sequentially; the ownership partition (AD-1) guarantees no file conflicts, the wave ordering handles the logical dependencies (Backend needs schema, Frontend needs endpoint, Integrator needs both endpoint and `api.ts`).

## 4. AD Binding Index (which ADs apply to registration, and which deliberately do not)

Per Capability→Architecture map, CAP-1 Register is governed by **AD-7, AD-8, AD-10, AD-13**; add the substrate ADs each sub-unit sits on.

| Sub-unit | Binding ADs | Deliberately NOT bound |
|---|---|---|
| DB (`src/db/`) | AD-3, AD-9 (+ AD-1) | AD-5, AD-11 (Task-only) |
| Backend (`src/api/`) | AD-6, AD-7, AD-8, AD-13 (AD-9 if insert wrapped in txn) | AD-11 (Task DTO), AD-5 (ordering), AD-4 (board hook) |
| Frontend (`src/client/`) | AD-8, AD-10, AD-13 | **AD-4 — board-specific (`useTaskBoard`); registration touches no board state** |
| Integrator (`tests/`, `.env`) | AD-12, AD-8, AD-13 | AD-11, AD-5 (Task-only) |
| Process (all waves) | AD-1, AD-2 | — |
