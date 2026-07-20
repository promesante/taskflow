---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: ["../specs/spec-taskflow/SPEC.md", "../../CLAUDE.md", "../../epics-to-agents-handoff.md", "architecture/architecture-bmad-teams-2-2026-07-19/ARCHITECTURE-SPINE.md"]
---

# TaskFlow - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for TaskFlow, decomposing the requirements from `SPEC-taskflow` (used in place of a PRD, per the project's `bmad-spec` → `bmad-architecture` → `bmad-create-epics-and-stories` planning chain), `ARCHITECTURE-SPINE.md`, `CLAUDE.md`, and `epics-to-agents-handoff.md` into implementable stories. No UX design contract exists for this project.

## Requirements Inventory

### Functional Requirements

FR1: Users can register for an account with email, password, and name, and receive a JWT. (CAP-1)
FR2: Users can log in with email and password to receive a JWT. (CAP-2)
FR3: Authenticated users can create a task with a required title and optional description. (CAP-3)
FR4: Users can view their tasks grouped into To Do / In Progress / Done columns, ordered by position. (CAP-4)
FR5: Users can drag a task to a new column or position, and the change persists across reload. (CAP-5)
FR6: Users can edit a task's title or description. (CAP-6)
FR7: Users can delete a task. (CAP-7)

### NonFunctional Requirements

NFR1: Auth is JWT-only, 7-day token expiry — no OAuth/SSO or third-party identity providers.
NFR2: Passwords hashed with bcrypt, minimum 10 salt rounds.
NFR3: Every API response follows the `{data: T}` / `{error: string}` envelope with a fixed status-code taxonomy (400/401/403/404/409).
NFR4: CORS restricted to `http://localhost:5173`.
NFR5: TypeScript strict mode throughout; named exports only; functional React components only.
NFR6: Out of scope (non-goals): real-time/multi-user collaboration, password-reset/email-verification flows, mobile app/offline support, user-defined columns, CI/CD or production deployment pipeline.

### Additional Requirements

**Stack pins (Architecture Stack table — impacts Epic 1 Story 1 project setup):** React/react-dom 19.2.7, Vite 8.1.5, TypeScript 6.x (strict), Tailwind CSS 4.3.2, shadcn/ui CLI v4 (Radix primitives), Node.js ≥22, Express 5.2.1, Drizzle ORM 0.45.2, better-sqlite3 12.11.1, jose 6.2.3, bcrypt 6.0.0.

- File ownership boundaries (AD-1): Scrum Master → `_bmad_output/`; DB Engineer → `src/db/`; Backend Dev → `src/api/`; Frontend Dev → `src/client/`; Integrator → `tests/` + `src/client/lib/api.ts` + `.env`. No cross-writes.
- Delivery process (AD-2): every story runs through 5 sequential waves (Scrum Master → DB Engineer → Backend Dev [+ parallel pure-UI Frontend] → Frontend Dev → Integrator); each wave passes `bmad-code-review` and lands its own PR before the next wave dispatches.
- SQLite via `better-sqlite3`, synchronous `db.transaction` callbacks only — never `async` (AD-3, AD-9).
- Task ordering: gap-based integers (step 1000), bounded per-column reindex exception on gap exhaustion, server-authoritative sort by `(status, order, id)` (AD-5).
- API layering: routes in `src/api/routes/` call Drizzle directly — no service/repository layer (AD-6).
- Auth: `jose`-only sign/verify via `src/api/lib/jwt.ts`; single `src/api/middleware/auth.ts` sets `req.userId` (AD-7).
- Shared `src/client/hooks/useTaskBoard.ts` with a pinned signature (`tasksByStatus`, `isLoading`, `createTask`, `updateTask`, `moveTask`, `deleteTask`); one authoring sub-unit per shared same-role file (AD-4).
- Shared response-envelope helper `src/api/lib/respond.ts` (`ok`/`fail`); `src/client/lib/api.ts` unwraps every response through one shared function (AD-8).
- JWT token handoff: stored at `taskflow_token` in `localStorage`; `useAuth` sole writer, `api.ts` sole reader (AD-10).
- Canonical Task DTO, `description` canonicalized to `null` when empty, fixed create/update request-body shapes (AD-11).
- Canonical Auth/User response DTO — register and login return the identical `{data: {token, user: {id, email, name}}}` shape, `password` never included (AD-13).
- Shared test harness `tests/setup.ts` (DB init/teardown, authenticated-request helper) (AD-12).
- Deferred (Architecture, not in scope for story generation): deployment/environments/infra, rate limiting on auth endpoints, logging/observability strategy.

### UX Design Requirements

N/A — no UX design contract was produced for this project. Visual baseline comes from shadcn/ui (CLI v4, Radix primitives) + Tailwind CSS v4, per `CLAUDE.md`.

### FR Coverage Map

FR1: Epic 1 - Register with email/password/name, receive JWT
FR2: Epic 1 - Log in with email/password, receive JWT
FR3: Epic 2 - Create a task (title required, description optional)
FR4: Epic 2 - View tasks grouped into To Do / In Progress / Done
FR5: Epic 2 - Drag a task to a new column/position, persisted
FR6: Epic 2 - Edit a task's title/description
FR7: Epic 2 - Delete a task

## Epic List

### Epic 1: Account & Access
Users can register for an account and log in, establishing an authenticated session (JWT) that everything else builds on.
**FRs covered:** FR1, FR2

### Epic 2: Task Board
Authenticated users can create, view, move, edit, and delete tasks on a three-column Kanban board — the complete task-management experience.
**FRs covered:** FR3, FR4, FR5, FR6, FR7

## Epic 1: Account & Access

Users can register for an account and log in, establishing an authenticated session (JWT) that everything else builds on.

### Story 1.1: User Registration

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

### Story 1.2: User Login

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

## Epic 2: Task Board

Authenticated users can create, view, move, edit, and delete tasks on a three-column Kanban board — the complete task-management experience.

### Story 2.1: Create Task

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

### Story 2.2: View Task Board

As an authenticated user,
I want to see my tasks grouped into To Do / In Progress / Done,
So that I can see my current workload at a glance.

**Acceptance Criteria:**

**Given** I have tasks across multiple statuses
**When** I open the board
**Then** each column shows only tasks with that status, in server-authoritative `(status, order, id)` order (AD-5)

**Given** I have no tasks yet
**When** I open the board
**Then** all three columns render empty — no error state

**Given** another user has their own tasks
**When** I view my board
**Then** I only ever see my own tasks, never theirs

### Story 2.3: Move Task Between Columns

As an authenticated user,
I want to drag a task to a different column or position,
So that I can reflect its actual progress.

**Acceptance Criteria:**

**Given** I drag a task into a different column
**When** the drop completes
**Then** its `status` and `order` update per AD-5's gap-based rule, and it persists across a page reload

**Given** I reorder a task within the same column
**When** the drop completes
**Then** its `order` updates relative to its new neighbors and persists

**Given** the gap between neighbors is exhausted (< 2 apart)
**When** a move lands in that gap
**Then** only that one column is reindexed to multiples of 1000 before the move applies (AD-5) — never the whole board

**Given** a task belongs to another user
**When** a move is attempted against it
**Then** the request is rejected (`403`/`404`) and nothing changes

### Story 2.4: Edit Task

As an authenticated user,
I want to edit a task's title or description,
So that I can correct or update details as they change.

**Acceptance Criteria:**

**Given** I submit a new title and/or description for my own task
**When** I save the edit
**Then** the task updates and the response matches the canonical Task DTO, with an empty description stored as `null`

**Given** I submit an empty title
**When** I save the edit
**Then** the request is rejected with `400` and the task is left unchanged

**Given** the task belongs to another user
**When** an edit is attempted against it
**Then** the request is rejected (`403`/`404`)

### Story 2.5: Delete Task

As an authenticated user,
I want to delete a task,
So that I can remove items I no longer need to track.

**Acceptance Criteria:**

**Given** I delete my own task
**When** the deletion completes
**Then** it's removed from the board and from subsequent `GET /api/tasks`

**Given** the task belongs to another user
**When** a delete is attempted against it
**Then** the request is rejected (`403`/`404`) and the task is untouched
