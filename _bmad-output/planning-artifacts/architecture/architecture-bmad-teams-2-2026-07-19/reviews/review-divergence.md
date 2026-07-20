# Divergence Review — ARCHITECTURE-SPINE.md (TaskFlow)

**Reviewer lens:** Adversary. Construct pairs of independent units one level down that each obey every AD to the letter yet still build incompatibly. Every diverging pair is a hole to close with a new or tightened AD.

**Verdict: FAIL** (fixable — the spine is well-structured, but at least four ADs stop one step short of pinning the *shape* of the seam they name, and one AD actively creates a same-file parallel-write collision the sharding model does not resolve).

Method: for each candidate I name two concrete sub-units that the wave-dispatch model would spawn as **independent subagents with no shared context**, follow the ADs literally in each, and check whether they are forced to converge.

---

## HOLE 1 — AD-4 names a shared file but no shared *contract*, and the sharding model lets two parallel subagents both write it (DIVERGES + COLLIDES) — HIGHEST

**Pair:** Wave 4, two Frontend stories dispatched in parallel (the handoff explicitly warns this happens — "Story 2.2's board view and Story 2.4's drag-and-drop … separate, independent subagent calls within the same wave"):

- Unit A — *Board view* (CAP-4): authors `src/client/hooks/useTaskBoard.ts` returning `{ tasks, columns, isLoading }`, grouping by status.
- Unit B — *Drag-and-drop / move* (CAP-5): needs a move mutation, so it also writes `src/client/hooks/useTaskBoard.ts`, adding `moveTask(id, status, order)` with optimistic update + rollback.
- (A third, *Create task* CAP-3 Frontend unit, would add `addTask(...)` — same file again.)

**Both obey every AD.** AD-4 says all board components consume *one* `useTaskBoard`. AD-1 shards by **directory** (`src/client/`), not by file — so nothing stops two independent Frontend subagents from each legitimately editing the *same* hook file in the *same* wave.

**Divergence / collision — two distinct failures:**
1. **File collision.** AD-1's guarantee ("each agent's file writes never overlap another's") is between *roles*, not between two parallel *dispatches of the same role*. AD-4 forces both units onto one file → the exact merge conflict the sharding was supposed to prevent, now *inside* Frontend Dev.
2. **Interface divergence.** Even if serialized, AD-4 never specifies the hook's **return contract**: what it returns, the mutation method names/signatures, the optimistic-update strategy, or in-hook error handling. Unit A may return `columns: Record<Status, Task[]>`; Unit B may expect `tasks: Task[]` and group itself. `moveTask(id, status, order)` vs `moveTask({id, toStatus, newOrder})` — both "consume the shared hook," neither is wrong under AD-4, and they are incompatible.

**Close with:** tighten AD-4 to pin the hook's exported TypeScript signature (return object shape + every mutation method and its argument shape), AND add a rule that a shared same-role file (`useTaskBoard.ts`, `api.ts`, `respond.ts`, `setup.ts`) has exactly one authoring sub-unit — later same-wave units either depend on it as a completed seam (sequence it into an earlier wave) or are merged into one dispatch. This is the deepest hole because it defeats the spine's core promise (parallel safety) precisely where AD-4 mandates sharing.

---

## HOLE 2 — AD-11 governs the response DTO only; the empty-`description` representation and the request-body shape are unpinned (DIVERGES) — HIGH

**Pair:**
- Unit A — *Create task* Backend (CAP-3): title only, no description. Inserts `NULL`, returns `description: null`.
- Unit B — *Edit task* Backend/Frontend (CAP-6): "clear the description" → sends `description: ""`, stores `""`, returns `description: ""`.

**Both obey AD-11** — `"" ` and `null` are both `string | null`. AD-11 only constrains "every Task *returned* over the API"; it says nothing about (a) the canonical representation of "no description," or (b) the **request body** shape.

**Divergence:** the board now contains tasks with `description: null` and tasks with `description: ""`. A `TaskCard` written by one Frontend unit tests `if (task.description)` (both null and "" fall through — accidentally fine) while another tests `if (task.description !== null)` (renders an empty box for the `""` task). Worse on input: the create form may **omit** the field (`{title}`), the edit form may send `{title, description: null}` — Backend `JSON.parse` yields `undefined` vs `null`, and unless every route normalizes identically, the stored value diverges. AD-11 pins the wire *output* type union but not which member is canonical, so two units legitimately pick different members.

**Close with:** a rule that "empty description" is canonically `null` end-to-end (request normalizes `undefined`/`""`→`null`; DB stores `NULL`; DTO returns `null`), and add a canonical **request-body** shape for create/edit (AD-11 currently covers only responses).

---

## HOLE 3 — No canonical Auth/User response DTO; the `...` in `{data: {token, ...}}` is literally unspecified (DIVERGES) — HIGH

**Pair:**
- Unit A — *Register* Backend (CAP-1): returns `{ data: { token } }`.
- Unit B — *Login* Backend (CAP-2): returns `{ data: { token, user: { id, name, email } } }`.

**Both obey every AD.** AD-8 fixes the outer envelope (`{data}`), AD-7 fixes signing, AD-10 fixes where the token is stored — but **AD-11 covers only the Task DTO.** SPEC CAP-1 literally writes `{data: {token, ...}}` — the `...` is undefined. There is no canonical User or auth-response shape anywhere in the spine.

**Divergence:** `useAuth` (Frontend) consumes both endpoints. If register returns only `{token}` but login returns `{token, user}`, then after registering the app has no user name to display but after login it does — divergent post-auth UI state from two independently-dispatched auth stories. Any component reading `currentUser.name` breaks on the register path.

**Close with:** a new AD (or extend AD-11) defining the canonical User DTO and the auth-response payload (`{ token: string, user: User }`), shared by register and login alike, and a canonical User shape (`{ id, email, name, createdAt }` — note: `password` must be excluded, which the spine never states).

---

## HOLE 4 — AD-5 forbids reindex but leaves gap-exhaustion undefined, and sort responsibility (server vs client) is unpinned (DIVERGES / CORRUPTS) — HIGH

**Pair:**
- Unit A — *Move task* Backend v1 (CAP-5): places task at midpoint of neighbors.
- Unit B — *Move task* Backend v2 / a later move-heavy story: same rule, but after many moves two neighbors are at `order` 1000 and 1001.

**The rule runs out.** `order` is an **integer** (AD-11: `order: number`; DB int). Midpoint of 1000 and 1001 = 1000.5 → rounds to a collision. AD-5 explicitly says "**No full-column reindex on a normal move**," so it *forbids* the one obvious escape hatch without naming any replacement. Two independent implementations therefore diverge:
- v1: silently rounds → duplicate `order` values → non-deterministic column order (violates CAP-5's "survives reload" if the tiebreak differs between GET and move).
- v2: does a local reindex anyway (violates AD-5's letter) or errors the move.

Neither can be called compliant *and* correct. Additionally: **who sorts?** AD-4 says the hook does "group-by-status" but never says whether ordering within a column comes from a server `ORDER BY order` or a client-side sort. A GET route that returns insertion order + a client that trusts array order will render wrong; another client that sorts by `order` will not — a CAP-4/CAP-5 seam left open.

**Close with:** tighten AD-5 to define the exhaustion path (e.g. "when the gap between neighbors is < 2, reindex *that column only* to fresh 1000-spaced values in one transaction" — an explicit, bounded exception to the no-reindex rule), require a deterministic tiebreak (`ORDER BY order, id`), and pin that ordering is applied **server-side** in the GET query so every client renders identically.

---

## HOLE 5 — AD-8 fixes the envelope but not the HTTP-status taxonomy or the error-string convention (DIVERGES) — MEDIUM

**Pair:**
- Unit A — *Register* Backend (CAP-1): duplicate email → `409 { error: "Email already registered" }`.
- Unit B — *Create task* Backend (CAP-3): missing title → `400 { error: "title is required" }`; but a parallel *Edit* unit picks `422 { error: "Validation failed" }`.

**Both obey AD-8** — the envelope is `{error: string}` in every case. AD-6 ("routes call Drizzle directly") and the convention row ("map errors to HTTP status + `{error}`") deliberately leave the mapping to each route. So `error` is a bare string with no agreed vocabulary, and status codes for "validation error," "duplicate," "not found," "unauthorized" are each chosen per-story.

**Divergence:** `api.ts` unwraps uniformly (AD-8) — good — but any client logic that *branches* on status (show field error vs toast vs redirect-to-login on 401) gets inconsistent inputs. Two auth stories disagreeing on duplicate-email (400 vs 409) means the register form can't reliably detect "email taken." The bare-string `error` also cannot carry a field name, so field-level validation UI is impossible to build consistently.

**Close with:** a small status-code + error-shape taxonomy in the conventions table: 400 validation / 401 auth / 403 forbidden / 404 not found / 409 conflict, and decide whether `error` stays a bare string (then say so and forbid field-level error UI) or becomes `{ error: { message, code?, field? } }`.

---

## HOLE 6 — AD-7 pins the middleware *file* but not what it puts on `req` (DIVERGES) — MEDIUM

**Pair:**
- Unit A — *auth middleware* (`src/api/middleware/auth.ts`): attaches `req.user = { id, email }`.
- Unit B — *tasks route* (`src/api/routes/tasks.ts`), a different Backend story: reads `req.userId` to scope the query.

Both live in `src/api/` (same role, different stories/waves). AD-7 guarantees one middleware and one jwt.ts, so sign/verify are symmetric — but the **request-augmentation contract** (what property the middleware sets, `req.user` vs `req.userId` vs `req.auth`, and the JWT claim it reads — `sub` vs `userId`) is never stated. A route unit dispatched independently guesses the property name and the userId scoping silently reads `undefined` → returns all users' tasks or none.

**Close with:** extend AD-7 to declare the augmentation (`req.userId: number`) and the JWT claim carrying it (`sub`), so every route reads the same field.

---

## HOLE 7 — Scrum Master Wave-1 output shape into `_bmad_output` is unspecified (WEAK / process-level)

AD-1 grants the Scrum Master `_bmad_output`; AD-2 says Wave 1 "creates a task in context of a Story." Nothing pins the **schema** of that artifact. Two stories' Wave-1 outputs could be structured differently; downstream waves that consume them would parse inconsistently.

**Why weaker:** per the handoff, the orchestrating session hands each downstream subagent the story text + AD refs *directly* — downstream units are not shown to parse `_bmad_output` as a machine contract. So the risk is mediated by the human/orchestrator, not code-to-code. Still worth a one-line template (a fixed task-doc front-matter/section shape) if downstream ever reads it programmatically.

---

## Candidate pairs that CONVERGE (spine holds here)

- **AD-10 token key** — `taskflow_token`, sole writer `useAuth`, sole reader `api.ts`. Two units cannot diverge on storage key or attach mechanism. **Converges.**
- **AD-8 outer envelope** — `ok()`/`fail()` + one unwrap in `api.ts`. The `{data}`/`{error}` *outer* shape converges (only the *contents* diverge — Holes 3 & 5).
- **AD-6 layering** — "routes call Drizzle directly, no services/repositories." Two Backend units cannot invent divergent layering. **Converges.**
- **AD-3 / AD-9 DB access style** — one driver, sync transaction callbacks. Two units cannot mix sync/async. **Converges.**
- **AD-7 sign/verify algorithm** — single jwt.ts + jose. Symmetric by construction (the *claim name* is Hole 6, but the crypto converges).
- **AD-12 test harness** — one `tests/setup.ts` for DB reset + auth helper. Converges on setup — though note it inherits the same "two parallel Integrator units both writing setup.ts" collision risk flagged in Hole 1 if two stories reach Wave 5 in the same round.
- **AD-1 cross-role file ownership** — converges for *distinct* roles; the gap is only same-role parallel dispatch (Hole 1).

---

## Summary of holes to close

| # | Hole | Fix | Severity |
|---|------|-----|----------|
| 1 | AD-4 shared hook: no contract + same-file parallel write | Pin hook's exported signature; one author per shared same-role file | Critical |
| 2 | AD-11 covers responses only; empty-description + request body unpinned | Canonicalize empty desc = `null` end-to-end; add request-body DTO | High |
| 3 | No canonical Auth/User DTO (`{token, ...}`) | New AD: User DTO + auth payload `{token, user}`, exclude password | High |
| 4 | AD-5 gap exhaustion undefined; sort responsibility unpinned | Define bounded reindex exception + deterministic server-side `ORDER BY order, id` | High |
| 5 | AD-8 envelope only; status codes + error string uncoordinated | Add status-code taxonomy + fix error shape | Medium |
| 6 | AD-7 pins file, not `req` augmentation / JWT claim | Declare `req.userId` + `sub` claim | Medium |
| 7 | Scrum Master Wave-1 output shape unspecified | Add task-doc template if consumed programmatically | Weak |
