---
id: SPEC-taskflow
companions: ["../../../CLAUDE.md", "../../../epics-to-agents-handoff.md", "../../planning-artifacts/architecture/architecture-bmad-teams-2-2026-07-19/ARCHITECTURE-SPINE.md"]
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# TaskFlow

## Why

This is a vision to realize combined with an opportunity to capture: TaskFlow, a Kanban-style task manager (register, log in, create tasks, drag them across To Do / In Progress / Done), is the vehicle for the actual driving goal — hands-on practice combining BMAD's planning phases with Claude Code parallel agent-team implementation. The product must genuinely work, but the primary force behind this work is proving out a 5-role, wave-gated parallel-dispatch delivery process (Scrum Master, DB Engineer, Backend Dev, Frontend Dev, Integrator) on a real full-stack app.

## Capabilities

- **CAP-1**
  - **intent:** User creates an account with email, password, and name.
  - **success:** `POST /api/auth/register` returns `{data: {token, ...}}` for a new unique email, `{error}` for a duplicate.
- **CAP-2**
  - **intent:** User authenticates with email and password.
  - **success:** `POST /api/auth/login` returns a JWT for valid credentials, `{error}` otherwise.
- **CAP-3**
  - **intent:** Authenticated user creates a task with a required title and optional description.
  - **success:** `POST /api/tasks` persists a task scoped to that user, visible in a subsequent `GET /api/tasks`.
- **CAP-4**
  - **intent:** User views their tasks grouped into To Do / In Progress / Done columns, ordered by position.
  - **success:** `GET /api/tasks` returns `status` + `order` fields the client renders into three columns.
- **CAP-5**
  - **intent:** User drags a task to a new column or position.
  - **success:** `PATCH /api/tasks/:id/move` updates `status`/`order` and the change survives a page reload.
- **CAP-6**
  - **intent:** User edits a task's title or description.
  - **success:** `PATCH /api/tasks/:id` persists the edit.
- **CAP-7**
  - **intent:** User deletes a task.
  - **success:** `DELETE /api/tasks/:id` removes it from a subsequent `GET /api/tasks`.
- **CAP-8**
  - **intent:** Each story is implemented by dispatching role-scoped subagents (Scrum Master, DB Engineer, Backend Dev, Frontend Dev, Integrator) across 5 sequential waves, with no agent writing outside its owned directory.
  - **success:** One full story is delivered end-to-end through all 5 waves, each wave passing `bmad-code-review` and landing its own PR before the next wave dispatches, with zero overlapping file writes across agents.

## Constraints

- Auth is JWT-only, 7-day token expiry — no OAuth/SSO or third-party identity providers.
- Passwords hashed with bcrypt, minimum 10 salt rounds — plaintext or weaker hashing is rejected.
- Every API response follows the `{data: T}` success / `{error: string}` failure envelope — no ad hoc response shapes.
- CORS restricted to `http://localhost:5173` — no other origins without an explicit change.
- TypeScript strict mode, named exports only, functional React components only — no class components or default exports.
- Each of the 5 roles may write only inside its own owned directory (see `CLAUDE.md`'s ownership table) — this is what makes parallel dispatch safe from merge conflicts.
- Every wave is gated by `bmad-code-review` before its PR opens, and the next wave cannot dispatch until that PR lands — no wave skips review.
- Same-directory parallel dispatches within one wave (e.g. two Frontend stories) must consume shared architecture-spine seams (shared hook, response-envelope helper, token handoff convention, canonical DTO, shared test harness) rather than inventing their own — see `epics-to-agents-handoff.md`.

## Non-goals

- No real-time or multi-user collaboration — single-user task ownership only, no shared/team boards (schema carries no team concept).
- No OAuth/SSO, password-reset, or email-verification flows — auth is register/login only.
- No mobile app or offline support — web-only, online-only.
- No user-defined columns — status is fixed to `todo` / `in_progress` / `done`.
- No CI/CD or production deployment pipeline — scope is local dev only.

## Success signal

An end user can register, log in, create a task, and drag it from To Do through In Progress to Done, with the change persisted across a page reload. Separately, at least one full story (e.g. User Registration) is delivered end-to-end through all five dispatch waves — Scrum Master task creation, DB schema, Backend route, Frontend form, Integrator tests — each wave individually reviewed via `bmad-code-review` and merged as its own PR, with no file ever touched by more than one owning agent.
