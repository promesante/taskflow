# Handoff: Epics/Stories → Four Owned-Directory Agents

How TaskFlow implementation is orchestrated once BMAD produces epics and stories, instead of running BMAD's own sequential story-cycle skills (`bmad-create-story` → `bmad-dev-story`). Orchestration is done directly by the assisting Claude session — this is a manual dispatch process, not a BMAD skill or script.

## Why this exists

CLAUDE.md partitions the codebase into four fixed ownership boundaries:

| Agent | Owns | Must not touch |
|---|---|---|
| Scrum Master | `_bmad-output/implementation-artifacts/` | `src/` |
| DB Engineer | `src/db/` | `src/api/`, `src/client/`, `tests/` |
| Backend Dev | `src/api/` | `src/db/`, `src/client/`, `tests/` |
| Frontend Dev | `src/client/` (including `lib/api.ts`) | `src/db/`, `src/api/`, `tests/` |
| Integrator | `tests/`, `.env` | `src/db/`, `src/api/`, `src/client/` |

That partition is exactly the shape needed to dispatch multiple Claude Code subagents in parallel without merge conflicts — each agent's file writes never overlap another's. BMAD's phases 1–3 (`bmad-spec` → `bmad-architecture` → `bmad-create-epics-and-stories`) produce the shared contract (`SPEC.md`, `ARCHITECTURE-SPINE.md`, `epics.md`) those agents build against; this document covers what happens after that contract exists.

## Where BMAD hands off

`bmad-create-epics-and-stories` writes `_bmad-output/planning-artifacts/epics.md`: epics organized by user value (for TaskFlow: Epic 1 Account & Access, Epic 2 Task Board), each broken into stories with Given/When/Then acceptance criteria. BMAD's own next step would be `bmad-create-story` → `bmad-dev-story`, running stories one at a time through a single developer persona. That is the point where this process branches off instead.

As soon as every agent completes a Task in its Story, open a PR before going on.

## Step 1 — Classify each story by owned directory

Every story in `epics.md` is a full-stack, user-value slice (e.g. "Story 1.2: User Registration" touches the `users` schema, the `/api/auth/register` route, and `RegisterForm.tsx`). Before dispatch, break each story into its per-directory sub-units against the CLAUDE.md ownership table:

- DB sub-unit: schema/migration changes in `src/db/`
- Backend sub-unit: route/middleware changes in `src/api/`
- Frontend sub-unit: component/hook changes in `src/client/`, including `src/client/lib/api.ts`
- Integrator sub-unit: tests in `tests/`, only once the above exist

A story with no work in a given directory simply has no sub-unit there — not every story touches all four.

## Step 2 — Group sub-units into dependency waves

Directory ownership prevents *file* conflicts, but not *logical* dependencies: Backend needs DB's schema to exist; Frontend needs Backend's endpoint to exist; Integrator needs both a real endpoint and real client calls to wire together and test. So sub-units are grouped into sequential waves:

1. **Wave 1 — Scrum Master.** Creates a task in the context of a Story.
2. **Wave 2 — DB Engineer.** All schema/migration sub-units due this round.
3. **Wave 3 — Backend Dev** (+ any Frontend sub-units that are pure UI with no API dependency, run in parallel with Backend since they don't block on it).
4. **Wave 4 — Frontend Dev.** Sub-units that consume the endpoints Wave 3 just built.
5. **Wave 5 — Integrator.** `tests/`, last, since it needs both real endpoints and real client calls (now including `api.ts`, built by Frontend Dev in Wave 4) to integrate against.

Waves run sequentially; within a wave, sub-units are independent by construction (different directories, or the same directory but no shared dependency) and dispatch in parallel.

### Same-directory parallelism is a real risk, not just a footnote

Two stories can both belong to, say, Frontend Dev (e.g. Story 2.2's board view and Story 2.4's drag-and-drop) and still be dispatched as **separate, independent subagent calls within the same wave** — same owning role, but no shared context between the two runs. Nothing stops them from silently diverging (duplicate local state, inconsistent error handling, mismatched field names) unless the architecture spine already pinned the shared contract. This is exactly what `ARCHITECTURE-SPINE.md`'s AD-4 (shared `useTaskBoard` hook), AD-8 (shared response-envelope helper), AD-10 (token handoff), AD-11 (canonical `Task` DTO), and AD-12 (shared test harness) exist to close — every parallel-dispatch story is required to consume those shared seams rather than inventing its own.

## Step 3 — Dispatch

For each sub-unit in a wave, spawn one subagent scoped to just that sub-unit: the story's text and acceptance criteria, the single directory it may touch, and the relevant `ARCHITECTURE-SPINE.md` AD references that bind it. Example:

```
Agent({
  description: "Implement Story 1.2 DB sub-unit: users schema",
  prompt: "<Story 1.2 text + AC, DB portion only>. Own only src/db/. \
           Do not touch src/api/, src/client/, tests/. \
           Follow AD-9 (synchronous db.transaction callbacks).",
  subagent_type: "claude"
})
```

## Step 4 — Gate between waves

Before advancing to the next wave, run `bmad-code-review` on the wave's diff — so a broken wave doesn't silently break the next wave's assumptions. Once the review passes, open a PR for that wave's Task before dispatching the next wave: one PR per wave (each wave being one Task within the Story), opened after `bmad-code-review` clears it. This is a hard gate: the next wave's dispatch prompts assume the previous wave's contract (schema, endpoint, DTO shape) is actually correct, and its own PR is what carries that wave's work forward.

## Step 5 — Close the loop back into BMAD

Once every wave for an epic completes, feed status back through `bmad-sprint-status` so BMAD's own tracking stays accurate, and optionally run `bmad-retrospective` at epic end.

## Worked example: TaskFlow Epic 1, Story 1.2 (User Registration)

| Sub-unit | Directory | Wave | Depends on |
|---|---|---|---|
| Task creation for Story 1.2 in `_bmad-output/implementation-artifacts/` | `_bmad-output/implementation-artifacts/` | 1 | — |
| `users` Drizzle schema + migration | `src/db/` | 2 | Wave 1 |
| `POST /api/auth/register` route, bcrypt hashing, JWT issuance (`jose`) | `src/api/` | 3 | Wave 2 |
| `RegisterForm.tsx`, calls through `api.ts` | `src/client/` | 4 | Wave 3 |
| `useAuth` writes JWT to `taskflow_token` (AD-10), `api.ts` reads it | `src/client/` | 4 (same wave as above, same directory — sequenced or merged into one dispatch since both are Frontend and interdependent within the story) | Wave 3 |
| `tests/setup.ts` + `auth.test.ts` covering registration | `tests/` | 5 | Wave 4 |

This is the pattern repeated per story across both epics.
