---
story: "2.2"
title: View Task Board
epic: "Epic 2 — Task Board"
frs: [FR4]
capability: CAP-4
wave: 1 of 4 (Scrum Master — this artifact)
sources:
  - ../planning-artifacts/epics.md (Story 2.2; Epic 2 overview + Stories 2.1/2.3–2.5 for sequencing context)
  - ../planning-artifacts/architecture/architecture-bmad-teams-2-2026-07-19/ARCHITECTURE-SPINE.md
  - ../../CLAUDE.md (ownership table, Database Schema — `tasks` table shape, GET /api/tasks)
  - ../../epics-to-agents-handoff.md (dispatch process)
  - ./story-2.1-task.md (immediate predecessor in Epic 2 — first-authors every seam file this story extends; primary cross-story dependency)
  - ./story-1.1-task.md, ./story-1.2-task.md (sibling task sheets — format reference; Epic 1 authors the base shared files)
---

# Story 2.2 — View Task Board · Wave Task Sheet

## 1. User Story & Acceptance Criteria (verbatim from epics.md)

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

> Scope note: Story 2.2 is **View / read the board only** — `GET /api/tasks`. It is the second story in Epic 2 and directly follows Story 2.1 (Create Task). `POST /api/tasks` (Story 2.1), `PATCH /api/tasks/:id/move` (Story 2.3), `PATCH /api/tasks/:id` (Story 2.4), and `DELETE /api/tasks/:id` (Story 2.5) are **out of scope** here. This story writes **no new files that Epic 2 doesn't already have in flight** — it fills bodies of / extends seams Story 2.1 first-authors (`routes/tasks.ts`, `useTaskBoard.ts`, `api.ts`, `tasks.test.ts`) and adds the two board leaf components (`KanbanColumn.tsx`, `TaskCard.tsx`) that only make sense once there is a list to render.

## 2. Per-Directory Sub-Units (classified against CLAUDE.md ownership table)

### DB sub-unit — `src/db/` (DB Engineer) — **NONE. Skipped.**

**This story has no DB sub-unit.** Reasoned call (documented, not assumed):

- View Task Board only **reads** existing rows — `GET /api/tasks` selects the authenticated user's tasks and sorts them. It adds **no** columns, tables, or migrations. The `tasks` table (`id`, `title`, `description` nullable, `status`, `userId` FK, `order`, `createdAt`, `updatedAt`) is authored by **Story 2.1's DB wave** and already carries every field this story reads. Nothing about "group by status, sort by `(status, order, id)`, scope to `userId`" needs a schema change.
- **Index question, answered explicitly.** The read query is `WHERE userId = ? ORDER BY status, order, id`. A composite index on `(userId, status, "order", id)` would let SQLite satisfy both the filter and the sort without a scan/filesort — a textbook covering-index win *at scale*. **But it is out of scope for this story:** (a) no AC or AD requires it — **AD-5 pins the *sort result* `(status, order, id)`, not a physical index**, and the sort is guaranteed by the `ORDER BY` clause regardless of any index; (b) the app's stated scale is local, single-user (SPEC non-goals: no multi-user, no production deployment), so a filesort over one user's handful of rows is not a real cost; (c) adding an index is a `src/db/` schema/migration change that would (i) reopen a DB wave and same-file contention on `schema.ts`/`drizzle` with Story 2.1's still-in-flight DB work, and (ii) constitute premature optimization the spine deliberately does not call for. **Verdict: no index this story.** If a future story surfaces a measured read-performance problem, an index is a clean, isolated follow-up — flag it there, not here.
- **The `tasks` table existing is a *cross-story gate on Story 2.1's DB wave*, not a Story 2.2 DB sub-unit.** Story 2.2 owns no work in `src/db/`; it merely requires that Story 2.1's `tasks` table has landed (see §3).

### Backend sub-unit — `src/api/` (Backend Dev)

`GET /api/tasks` **only** — the second handler in the `routes/tasks.ts` file Story 2.1 first-authored.

- `routes/tasks.ts` — **EXTENDS** (does not create): adds a `GET /api/tasks` handler *alongside* the `POST /api/tasks` handler Story 2.1 authored. Does not recreate the file or the create handler.
- Logic: read the authenticated user from **`req.userId`** (set by `middleware/auth.ts` — never re-decode the token, AD-7). Query Drizzle directly (no service layer, AD-6): `SELECT` all `tasks` `WHERE userId = req.userId`, **`ORDER BY status, order, id`** — **server-authoritative sort per AD-5**. Return **`{ data: Task[] }`** where each element is the canonical Task DTO (AD-11: camelCase, `createdAt`/`updatedAt` as ISO 8601 strings, `description: string | null`). An empty result set returns `{ data: [] }` with `200` — **never** an error (satisfies the "no tasks → no error state" AC at the API boundary). Cross-user isolation is enforced by the `WHERE userId = req.userId` scope — one user's request can never return another's rows.
- **REUSES (does not create):** `middleware/auth.ts` (gates the route; sets `req.userId` — authored by **Story 2.1's Backend wave**, this being the first protected route in the app), `lib/respond.ts` (`ok`/`fail` envelope, AD-8 — authored by **Story 1.1's Backend wave**, already on main), `lib/jwt.ts` (used transitively by the middleware, not directly by this handler).
- **No `index.ts` edit.** The tasks router is already mounted in `index.ts` by Story 2.1's Backend wave; adding a second handler to an already-mounted router needs no bootstrap change.
- **Cross-story gate:** cannot dispatch until **Story 2.1's Backend wave has merged to main** — `routes/tasks.ts` and `middleware/auth.ts` **do not exist on main today** (main has only `routes/auth.ts`, `lib/jwt.ts`, `lib/respond.ts`, `index.ts` from Story 1.1 W3). That same Story 2.1 Backend merge transitively guarantees the `tasks` table (Story 2.1's DB wave, which 2.1 Backend itself gates on). `lib/respond.ts` (Story 1.1 W3) is already merged.
- Out of scope: `POST /api/tasks` (Story 2.1), `PATCH /api/tasks/:id/move` (2.3), `PATCH /api/tasks/:id` (2.4), `DELETE /api/tasks/:id` (2.5), any change to `routes/auth.ts`, `middleware/auth.ts`, `index.ts`.
- **Bound by:** AD-5 (server-authoritative `ORDER BY status, order, id`), AD-6 (Drizzle direct, no service layer), AD-7 (read `req.userId` from the shared middleware; never re-decode), AD-8 (`respond.ts` envelope; `200 { data: [...] }`, `401` on missing/invalid auth via the middleware), AD-11 (each element is the canonical Task DTO). **Not** bound by AD-9 (read-only — no `db.transaction`) or AD-5's *reindex/move* clause (no ordering writes; only the sort clause applies).

### Frontend sub-unit — `src/client/` incl. `lib/api.ts` (Frontend Dev)

Fill the board hook's read path, add the API call, and build the actual three-column board render.

- `hooks/useTaskBoard.ts` — **EXTENDS body only, never the signature (AD-4).** Story 2.1 first-authored this file against the *full* pinned AD-4 signature but implemented **only `createTask`**, leaving `tasksByStatus`/`isLoading`/`updateTask`/`moveTask`/`deleteTask` as present-but-deferred stubs. **Story 2.2 fills the `tasksByStatus` + `isLoading` bodies:** on mount, fetch the user's tasks via `api.ts`'s new `getTasks()`, set `isLoading` true→false around the fetch, and populate `tasksByStatus` by grouping the returned (already server-sorted) array into `{ todo, in_progress, done }`. **Do NOT change the exported signature, and do NOT touch `updateTask`/`moveTask`/`deleteTask`** (Stories 2.3/2.4/2.5 fill those bodies). The grouping preserves the server's array order within each status — **the client never re-sorts (AD-5)**; it only partitions the pre-sorted list by `status`.
- `lib/api.ts` — **EXTENDS** (does not create): add a `getTasks()` call that `GET`s `/api/tasks` and unwraps through the one shared response-parsing function (AD-8). Remains the **sole reader** of `taskflow_token` — attaches `Authorization: Bearer <token>` to the request (AD-10). Sits alongside the `createTask()` Story 2.1 added and the `register()`/`login()` from Epic 1.
- `components/KanbanColumn.tsx` — **NEW.** Functional component rendering one status column (a title + the list of that column's `TaskCard`s). Renders an empty column with no error when its task list is empty (satisfies the "all three columns render empty" AC). Consumes task state **through `useTaskBoard()`** (via `TaskBoard`), never `api.ts` directly.
- `components/TaskCard.tsx` — **NEW.** Functional component rendering a single task (title + optional description). Read-only display this story — no edit/delete/drag affordances (those are Stories 2.3/2.4/2.5).
- `components/TaskBoard.tsx` — **EXTENDS** the minimal create-task surface Story 2.1 built into the **full board**: renders the three `KanbanColumn`s (To Do / In Progress / Done) from `useTaskBoard().tasksByStatus`, shows a loading state while `isLoading`, and keeps Story 2.1's create affordance. Consumes everything **through `useTaskBoard()`**.
- **REUSES (does not edit):** `hooks/useAuth.ts` for the authenticated session (the token `api.ts` already reads authorizes the `GET`); no change expected.
- **What is NEW here vs. what Story 2.1 already built** (determined precisely): Story 2.1 built a **minimal create-task form/surface** + the `useTaskBoard` skeleton with `createTask` implemented and the rest stubbed. Story 2.2 adds: (a) the `getTasks()` API call; (b) the filled `tasksByStatus`/`isLoading` fetch-on-mount body in `useTaskBoard`; (c) **two brand-new leaf components** `KanbanColumn.tsx` and `TaskCard.tsx`; (d) the expansion of `TaskBoard.tsx` from a create surface into the actual three-column board render. Story 2.1's `LoginForm`/`RegisterForm` and the create form are untouched except that `TaskBoard` now hosts the board around the existing create affordance.
- **Cross-story gate:** cannot dispatch until **(a) Story 2.1's Frontend wave has merged to main** — `useTaskBoard.ts`, `TaskBoard.tsx`, and `api.ts`'s `createTask` do not exist until then (and `api.ts`/`useAuth.ts` themselves come from Story 1.1's Frontend wave, which 2.1's Frontend wave itself gates on) — **and (b) this story's own Backend wave has merged** (the `getTasks()` fetch needs a live `GET /api/tasks`).
- Out of scope: drag-and-drop / `moveTask` (2.3), edit UI / `updateTask` (2.4), delete UI / `deleteTask` (2.5), `LoginForm.tsx`/`RegisterForm.tsx` (Epic 1), any change to the pinned `useTaskBoard` signature.
- **Bound by:** AD-4 (fill `tasksByStatus`/`isLoading` **body only** against the frozen pinned signature; components consume task state exclusively through the hook), AD-5 (render in the server-returned order — **client never re-sorts**; grouping by status preserves array order), AD-8 (`api.ts` unwraps via the one shared function), AD-10 (`api.ts` sole reader of `taskflow_token`, attaches `Bearer`), AD-11 (client `Task` type matches the canonical DTO). **Not** bound by AD-13 (no auth token issued), AD-6/AD-7 (Backend concerns), AD-9 (no writes).

### Integrator sub-unit — `tests/`, `.env` (Integrator)

- `tests/tasks.test.ts` — **EXTENDS** (does not create): adds view/list coverage *alongside* the create coverage Story 2.1 authored. Cases mapping 1:1 to the ACs: (1) **multiple tasks across statuses** → `GET /api/tasks` returns them grouped-correctly and in server-authoritative `(status, order, id)` order (assert the exact returned sequence, and that each row's `status` matches the column it belongs to); (2) **empty board** → `GET /api/tasks` returns `{ data: [] }` with `200`, **no error state**; (3) **cross-user isolation** → seed tasks for user A and user B, authenticate as A, assert A's `GET` returns only A's tasks and never B's. Every element asserted to be the canonical Task DTO (camelCase, ISO dates, `description: string | null`, no `password`/foreign fields). Optionally assert unauthenticated `GET /api/tasks` → `401` (exercises the shared middleware).
- `tests/setup.ts` — **REUSES** the existing harness (DB init/teardown + authenticated-request helper — authored by Story 1.1's Integrator wave). The authenticated-request helper (create user → token) already supports seeding **two** users for the isolation case, so **no new fixture is anticipated**. Flag if one is added.
- `.env` — **no new keys.** `JWT_SECRET`, `PORT`, `DATABASE_URL` already cover this story; viewing tasks introduces no new configuration.
- **Cross-story gate:** cannot dispatch until **Story 2.1's Integrator wave has merged to main** — `tests/tasks.test.ts` (which this story extends) does not exist until then, and `tests/setup.ts` / `.env` come from Story 1.1's Integrator wave (which 2.1's Integrator wave itself gates on). It also needs this story's **Backend** wave merged (a live `GET /api/tasks` to assert against). Frontend need not be merged for the API-level tests, but this wave dispatches last per the standard ordering.
- Out of scope: `auth.test.ts`, any create/move/edit/delete coverage (Stories 2.1/2.3/2.4/2.5).
- **Bound by:** AD-12 (import shared `setup.ts`; no hand-rolled DB reset/login), AD-8 (assert envelope + `200`/`401`), AD-11 (assert canonical Task DTO array; `description` `null` not `""`), AD-5 (assert the returned `(status, order, id)` sort and correct per-status grouping). **Not** bound by AD-13 (Auth DTO — `auth.test.ts`'s concern), AD-9, AD-4 (hook internals).

## 3. Wave Dispatch Plan (this story, in order)

Like Story 1.2, **there is no DB wave** (no DB sub-unit — see §2). The plan is **four waves, not five.** Each wave is one Task; each wave's diff must pass `bmad-code-review` **and** land its own PR before the next wave dispatches (AD-2, handoff Step 4).

| Wave | Role | Directory | Sub-unit | Depends on (this story) | Cross-story gate (must be merged to main first) |
|---|---|---|---|---|---|
| 1 | Scrum Master | `_bmad-output/implementation-artifacts/` | This task sheet | — | — |
| — | ~~DB Engineer~~ | ~~`src/db/`~~ | **SKIPPED — no DB sub-unit** (existing `tasks` table sufficient; no index this story) | — | — |
| 2 | Backend Dev | `src/api/` | `GET /api/tasks` (extends `routes/tasks.ts`, reuses `middleware/auth.ts` + `respond.ts`) | Wave 1 | **Story 2.1 Wave 3 (Backend)** — needs `routes/tasks.ts` + `middleware/auth.ts` (which transitively carry Story 2.1's `tasks` table). `respond.ts` already on main (Story 1.1 W3). |
| 3 | Frontend Dev | `src/client/` | fill `useTaskBoard` read body, add `getTasks()` to `api.ts`, new `KanbanColumn.tsx`/`TaskCard.tsx`, expand `TaskBoard.tsx` | Wave 2 (live endpoint) | **Story 2.1 Wave 4 (Frontend)** — needs `useTaskBoard.ts`, `TaskBoard.tsx`, `api.ts` (which transitively carry Story 1.1's `api.ts`/`useAuth.ts`). |
| 4 | Integrator | `tests/`, `.env` | extend `tasks.test.ts` (view/empty/isolation), reuse `setup.ts` | Wave 2 (endpoint) | **Story 2.1 Wave 5 (Integrator)** — needs `tasks.test.ts` (which transitively carries Story 1.1's `setup.ts`/`.env`). |

### Is Story 2.2 blocked on "all of Story 2.1" finishing? No — gate each wave on the *corresponding* Story 2.1 wave.

The prompt's key question, answered precisely. **Story 2.2 directly follows Story 2.1 in the same epic and touches the exact same seam files, so — unlike Story 2.1, whose DB wave was unblocked the moment its sheet landed — every one of Story 2.2's implementation waves is gated behind Story 2.1's *matching* wave, because the files 2.2 extends literally do not exist on `main` until 2.1 authors them.** But it is still **per-wave**, not monolithic:

- **Backend (Wave 2) → Story 2.1 Wave 3 (Backend).** `routes/tasks.ts` and `middleware/auth.ts` are first-authored by Story 2.1's Backend wave; on `main` today only `routes/auth.ts`/`lib/*`/`index.ts` (Story 1.1 W3) exist. Story 2.1's Backend merge also transitively guarantees the `tasks` table (2.1 Backend gates on 2.1 DB). **Not** gated on Story 2.1's Frontend or Integrator waves, nor on Story 1.2 (which touches `auth.ts` only). `lib/respond.ts` is already merged.
- **Frontend (Wave 3) → Story 2.1 Wave 4 (Frontend)** *and* this story's Wave 2. `useTaskBoard.ts`/`TaskBoard.tsx`/`api.ts`'s `createTask` are first-authored by Story 2.1's Frontend wave (which itself carries Story 1.1's `api.ts`/`useAuth.ts`). Filling `useTaskBoard`'s body **requires the file to exist with its pinned signature and `createTask` body already in place** (AD-4 single-authoring — 2.2 edits body only, sequenced *after* 2.1's authoring merge, never parallel against it). It also needs the live `GET` endpoint from this story's Wave 2.
- **Integrator (Wave 4) → Story 2.1 Wave 5 (Integrator)** *and* this story's Wave 2. `tasks.test.ts` is first-authored by Story 2.1's Integrator wave (which carries Story 1.1's `setup.ts`/`.env`); 2.2 extends it with view coverage and needs a live `GET /api/tasks` to assert against.

**Net:** on `main` today (Story 1.1 W1–W3 merged; Story 1.2 & 2.1 have only their Scrum-Master sheets merged) **none of Story 2.2's implementation waves can dispatch yet** — each is held until the corresponding Story 2.1 wave merges. This is the expected shape for a story that directly extends its immediate predecessor's seam files, and it is enforced wave-by-wave, not as a blunt "wait for all of Story 2.1."

### Cross-story same-file dependency table (who authors each file vs. how Story 2.2 touches it)

| File | First author | Status on main today | Story 2.2 touches it in… | Nature |
|---|---|---|---|---|
| `src/db/schema.ts` (`tasks` table) | Story 2.1 W2 (DB) | **not merged** (main has `users` only) | — | **read-only dependency** — no `src/db/` edit this story |
| `src/api/routes/tasks.ts` | Story 2.1 W3 (Backend) | not merged | Wave 2 | **extend** — add `GET /api/tasks` handler |
| `src/api/middleware/auth.ts` | Story 2.1 W3 (Backend) | not merged | Wave 2 | **reuse** — gates the route, sets `req.userId` |
| `src/api/lib/respond.ts` | Story 1.1 W3 (Backend) | **merged** | Wave 2 | **reuse** — `ok`/`fail` envelope |
| `src/api/index.ts` | Story 1.1 W3 (Backend) | merged | — | **no edit** — tasks router already mounted by Story 2.1 W3 |
| `src/client/hooks/useTaskBoard.ts` | Story 2.1 W4 (Frontend) | not merged | Wave 3 | **extend body only** — fill `tasksByStatus`/`isLoading` (signature frozen, AD-4) |
| `src/client/lib/api.ts` | Story 1.1 W4 (Frontend) | not merged | Wave 3 | **extend** — add `getTasks()` |
| `src/client/components/TaskBoard.tsx` | Story 2.1 W4 (Frontend) | not merged | Wave 3 | **extend** — create surface → full board |
| `src/client/components/KanbanColumn.tsx` | **Story 2.2 W3** (first author) | does not exist | Wave 3 | **NEW** |
| `src/client/components/TaskCard.tsx` | **Story 2.2 W3** (first author) | does not exist | Wave 3 | **NEW** |
| `src/client/hooks/useAuth.ts` | Story 1.1 W4 (Frontend) | not merged | — | **reuse** — no edit expected |
| `tests/tasks.test.ts` | Story 2.1 W5 (Integrator) | not merged | Wave 4 | **extend** — add view/empty/isolation coverage |
| `tests/setup.ts` | Story 1.1 W5 (Integrator) | not merged | Wave 4 | **reuse** — harness + auth helper |
| `.env` | Story 1.1 W5 (Integrator) | not merged | Wave 4 | **reuse** — no new keys |

## 4. AD Binding Index (which ADs apply to View Task Board, and which deliberately do not)

Per the Capability→Architecture map, **CAP-4 View board is governed by AD-4 and AD-11.** For a story that fills the hook's fetch/`tasksByStatus` body against a live `GET`, the operative set is broader — **AD-5 (server-authoritative sort) is load-bearing here**, plus the Backend substrate ADs (AD-6/AD-7/AD-8) the read route sits on and the process ADs.

| Sub-unit | Binding ADs | Deliberately NOT bound |
|---|---|---|
| DB (`src/db/`) | **N/A — no sub-unit** (existing `tasks` table read-only; no index this story) | AD-3, AD-9 (no `src/db/` work); all others |
| Backend (`src/api/`) | AD-5 (server-authoritative `ORDER BY status, order, id`), AD-6 (Drizzle direct), AD-7 (read `req.userId` from shared middleware), AD-8 (`respond.ts` envelope; `200 {data:[]}`, `401`), AD-11 (canonical Task DTO array) | AD-9 (read-only, no transaction), AD-13 (no token issued), AD-5's reindex/move clause (no ordering writes), AD-4/AD-10 (Frontend) |
| Frontend (`src/client/`) | AD-4 (fill `tasksByStatus`/`isLoading` **body only** at the frozen signature; components consume via the hook), AD-5 (**render in server order — client never re-sorts**; group-by-status preserves array order), AD-8 (`api.ts` one shared unwrap), AD-10 (`api.ts` sole token reader, attaches `Bearer`), AD-11 (client `Task` type) | AD-13 (Auth DTO), AD-6/AD-7 (Backend), AD-9 (no writes) |
| Integrator (`tests/`, `.env`) | AD-12 (shared `setup.ts`), AD-8 (envelope + `200`/`401`), AD-11 (canonical Task DTO array; `description` `null` not `""`), AD-5 (assert `(status, order, id)` sort + per-status grouping) | AD-13 (Auth DTO — `auth.test.ts`), AD-9, AD-4 (hook internals) |
| Process (all waves) | AD-1 (ownership), AD-2 (wave-gated + per-wave PR) | — |

### Why AD-5 + AD-4 are the load-bearing ADs for this story
AD-5's **server-authoritative sort** is the invariant the whole story pivots on: `GET /api/tasks` returns tasks pre-sorted by `(status, order, id)`, and **the client renders in that exact order and never re-sorts** — the Frontend's `tasksByStatus` grouping only *partitions* the already-ordered array by status. Getting this wrong (a client-side sort, or a Backend sort that isn't `(status, order, id)`) is precisely the Backend/Frontend divergence AD-5 exists to prevent, and it is the direct subject of AC line 1. AD-4 is load-bearing for the *seam*: Story 2.2 is the first story to **fill** `useTaskBoard`'s read path, and it must do so as a **body-only** edit against the pinned signature Story 2.1 froze — the single-authoring rule means 2.2 is sequenced after 2.1's authoring merge, never parallel-dispatched against the same file. AD-11 backs both: every rendered/asserted task is the exact canonical DTO. Cross-user isolation (AC line 3) is a Backend `WHERE userId = req.userId` concern under AD-7, verified by the Integrator's isolation test.
