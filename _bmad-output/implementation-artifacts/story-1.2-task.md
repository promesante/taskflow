---
story: "1.2"
title: User Login
epic: "Epic 1 — Account & Access"
frs: [FR2]
capability: CAP-2
wave: 1 of 4 (Scrum Master — this artifact; no DB wave this story)
sources:
  - ../planning-artifacts/epics.md (Story 1.2)
  - ../planning-artifacts/architecture/architecture-bmad-teams-2-2026-07-19/ARCHITECTURE-SPINE.md
  - ../../CLAUDE.md (ownership table)
  - ../../epics-to-agents-handoff.md (dispatch process)
  - ./story-1.1-task.md (sibling story — Story 1.2 extends the files it created)
---

# Story 1.2 — User Login · Wave Task Sheet

## 1. User Story & Acceptance Criteria (verbatim from epics.md)

As a returning user,
I want to log in with my email and password,
So that I can access my existing tasks.

**Acceptance Criteria:**

**Given** a registered user submits the correct email and password
**When** they submit the login form
**Then** they receive `{data: {token, user: {id, email, name}}}` — the same shape as registration
**And** land on the task board

**Given** a user submits an incorrect password or an unregistered email
**When** they submit the login form
**Then** the request is rejected with `401` and a generic error message that doesn't reveal whether the email exists
**And** no token is issued

**Given** a successful login
**When** the response is received
**Then** the JWT is stored under `taskflow_token`, replacing any previous token

## 2. Per-Directory Sub-Units (classified against CLAUDE.md ownership table)

### DB sub-unit — `src/db/` (DB Engineer)
**NONE. This story has no DB sub-unit.** Story 1.2 needs **no new schema or migration work** — the `users` table (`id`, `email` unique, `password` bcrypt hash, `name`, `createdAt`) already exists from Story 1.1's Wave 2. Login only *reads* that table (lookup by email, compare bcrypt hash); it adds no columns, tables, or migrations. The DB wave is therefore **skipped entirely** for this story.

### Backend sub-unit — `src/api/` (Backend Dev)
`POST /api/auth/login` **only**.
- **EXTENDS** the existing `routes/auth.ts` — adds a `login` handler *alongside* the `register` handler Story 1.1 created. Does not recreate the file or the register handler.
- **REUSES** the existing `lib/jwt.ts` (sign helper, 7-day expiry — same as register) and `lib/respond.ts` (`ok`/`fail` envelope). Does **not** recreate either.
- Logic: validate required fields (email/password present) → look up user by email → bcrypt-compare submitted password against stored hash → on success sign JWT and return `{data:{token,user:{id,email,name}}}`; on either unknown email **or** bad password return **`401` with a single generic message** (`fail(...)`) that does not reveal whether the email exists. `password` never in the response. Query Drizzle directly (no service layer).
- **Dispatch gate (cross-story):** cannot be dispatched until **Story 1.1's Backend wave (Wave 3) has actually merged to main**, since it edits the same file (`routes/auth.ts`) and depends on `lib/jwt.ts` / `lib/respond.ts` existing.
- Out of scope: any change to the register handler, `routes/tasks.ts`, `middleware/auth.ts`, `index.ts` (router already mounted by Story 1.1).

### Frontend sub-unit — `src/client/` incl. `lib/api.ts` (Frontend Dev)
- `components/LoginForm.tsx` — **NEW** functional component; email/password fields; client-side required-field check; submit calls the api-client `login` function; on success routes user to the task board; renders the generic `{error}` string on `401`.
- **EXTENDS** `hooks/useAuth.ts` — adds a `login` function *alongside* the existing `register`. Remains the **sole writer** of `taskflow_token`; on login success it sets the token, **replacing any previous token** (AC line 3). Destructures `{token, user}` from the login response identically to register.
- **EXTENDS** `lib/api.ts` — adds a `login()` call *alongside* `register()`; reuses the one shared response-unwrap function and remains the **sole reader** of `taskflow_token`. Does not recreate the file.
- **Dispatch gate (cross-story):** cannot be dispatched until **Story 1.1's Frontend wave (Wave 4) has merged to main** — it edits the same `useAuth.ts` and `lib/api.ts`.
- Out of scope: `RegisterForm.tsx` (Story 1.1), any board/task components, `useTaskBoard.ts`.

### Integrator sub-unit — `tests/`, `.env` (Integrator)
- **EXTENDS** `tests/auth.test.ts` — adds login coverage *alongside* the registration tests: happy path (correct creds → `{data:{token,user}}`, same shape as register, no `password` leaked); wrong password → `401` generic message, no token; unregistered email → `401` **same** generic message (assert the two error messages are indistinguishable — must not reveal email existence).
- **REUSES** the existing `tests/setup.ts` harness (DB init/teardown + authenticated-request helper). Does **not** recreate it.
- **`.env`:** **no new keys needed** — `JWT_SECRET`, `PORT`, `DATABASE_URL` already set by Story 1.1's Integrator wave.
- **Dispatch gate (cross-story):** cannot be dispatched until **Story 1.1's Integrator wave (Wave 5) has merged to main** — it edits the same `auth.test.ts` and imports the existing `setup.ts`.
- Out of scope: `tasks.test.ts`, any registration coverage (already exists).

## 3. Wave Dispatch Plan (this story, in order)

Unlike Story 1.1, **there is no DB wave** (no DB sub-unit — see §2). The plan is four waves, not five:

| Wave | Role | Directory | Sub-unit | Depends on (this story) | Cross-story gate (must be merged to main first) |
|---|---|---|---|---|---|
| 1 | Scrum Master | `_bmad-output/implementation-artifacts/` | This task sheet | — | — |
| — | ~~DB Engineer~~ | ~~`src/db/`~~ | **SKIPPED — no DB sub-unit** | — | — |
| 2 | Backend Dev | `src/api/` | `POST /api/auth/login` (extends `routes/auth.ts`, reuses `jwt.ts`/`respond.ts`) | Wave 1 | **Story 1.1 Wave 3 (Backend) merged** |
| 3 | Frontend Dev | `src/client/` | `LoginForm.tsx` (new), extends `useAuth.ts` + `lib/api.ts` | Wave 2 (login endpoint) | **Story 1.1 Wave 4 (Frontend) merged** |
| 4 | Integrator | `tests/`, `.env` | extends `auth.test.ts`, reuses `setup.ts` | Wave 3 (endpoint + api.ts) | **Story 1.1 Wave 5 (Integrator) merged** |

Each wave passes `bmad-code-review` and lands its own PR before the next dispatches (AD-2, handoff Step 4).

### ⚠ Cross-story same-file sequencing dependency (critical)
Every wave after this one is gated on **two** things, not one:
1. the **previous wave of THIS story** (its own internal logical order — Backend→Frontend→Integrator), **and**
2. **Story 1.1's corresponding wave having already merged to main.**

This second gate is a **cross-story same-file sequencing dependency**, not merely this story's internal wave order. Story 1.2 does not create fresh files — it **edits the very files Story 1.1 authors**:

| File | Story 1.1 authors it in… | Story 1.2 edits it in… |
|---|---|---|
| `src/api/routes/auth.ts` | Wave 3 (Backend) | Wave 2 (Backend) |
| `src/api/lib/jwt.ts` | Wave 3 (Backend) | Wave 2 (reuse — must exist) |
| `src/api/lib/respond.ts` | Wave 3 (Backend) | Wave 2 (reuse — must exist) |
| `src/client/hooks/useAuth.ts` | Wave 4 (Frontend) | Wave 3 (Frontend) |
| `src/client/lib/api.ts` | Wave 4 (Frontend) | Wave 3 (Frontend) |
| `tests/auth.test.ts` | Wave 5 (Integrator) | Wave 4 (Integrator) |
| `tests/setup.ts` | Wave 5 (Integrator) | Wave 4 (reuse — must exist) |

If Story 1.2's Backend wave dispatched before Story 1.1's Backend wave merged, the login sub-unit would either recreate `routes/auth.ts`/`jwt.ts`/`respond.ts` (violating AD-4's single-authoring-sub-unit rule and clobbering the register handler) or fail against files that don't yet exist. Same reasoning for Frontend (`useAuth.ts`, `api.ts`) and Integrator (`auth.test.ts`, `setup.ts`). **Story 1.1 is the authoring story for all these shared files; Story 1.2 is a later editor and must be sequenced strictly after it, wave-for-wave** (handoff.md "same-directory parallelism is a real risk"; AD-4 single-authoring-sub-unit + sequencing rule).

## 4. AD Binding Index (which ADs apply to login, and which deliberately do not)

Per the Capability→Architecture map, **CAP-2 Login is governed by AD-7, AD-8, AD-10, AD-13** — the identical set as CAP-1 Register (deliberate: login and register are two handlers of one auth contract). Add the substrate/process ADs each sub-unit sits on.

| Sub-unit | Binding ADs | Deliberately NOT bound |
|---|---|---|
| DB (`src/db/`) | **none — no DB sub-unit this story** | AD-3, AD-9 (no schema/migration/txn work); AD-5, AD-11 (Task-only) |
| Backend (`src/api/`) | AD-6 (query Drizzle directly, no service layer), AD-7 (`jose`-only sign via `lib/jwt.ts`), AD-8 (`respond.ts` envelope; **`401` for bad creds** per fixed taxonomy; `422` never used), AD-13 (canonical Auth DTO — see note) | AD-9 (login is a single read + compare, no multi-statement write / transaction), AD-11 (Task DTO), AD-5 (ordering), AD-4 (board hook) |
| Frontend (`src/client/`) | AD-8 (`api.ts` unwraps via the one shared function), AD-10 (token at `taskflow_token`; `useAuth` sole writer — replaces prior token on login; `api.ts` sole reader), AD-13 (`useAuth` destructures `{token,user}` identically to register) | AD-4 — board-specific (`useTaskBoard`); login touches no board state |
| Integrator (`tests/`, `.env`) | AD-12 (import shared `setup.ts`; no hand-rolled DB reset/login), AD-8 (assert envelope + `401` status), AD-13 (assert canonical Auth DTO, `password` absent) | AD-11, AD-5 (Task-only) |
| Process (all waves) | AD-1 (ownership), AD-2 (wave-gated + per-wave PR) | — |

### AD-13 note (why it is the load-bearing AD for this story)
AD-13 exists precisely to enforce what AC line 1 requires — **login must return the *identical* `{data:{token,user:{id,email,name}}}` shape as register, so `useAuth` destructures `{token,user}` the same way for both**. This is not a "similar" shape: it must match register's response exactly, field-for-field, with `password` never included. The Backend login sub-unit and the Frontend `useAuth`/`LoginForm` sub-unit are both bound to reproduce that canonical DTO rather than invent a login-specific variant. AD-8's status taxonomy pins the failure case: bad password *or* unknown email both return **`401`** (not `404`, not `403`) with one generic `{error}` string, satisfying the "don't reveal whether the email exists" criterion.
