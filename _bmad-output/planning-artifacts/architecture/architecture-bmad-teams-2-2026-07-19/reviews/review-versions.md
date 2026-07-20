# Reviewer Gate — Version & Currency Review

**Artifact:** ARCHITECTURE-SPINE.md (TaskFlow)
**Reviewer lens:** Verify every committed decision was web-researched / reality-checked rather than asserted from training data — current library/framework versions, that each named technology still exists and fits, and current defaults/APIs of anything the spine leans on.
**Review date:** 2026-07-19
**Method:** Independent WebSearch/WebFetch against npm, GitHub releases, and official docs. Did not trust the spine's own numbers.

**Verdict: PASS-WITH-NOTES.** Every pinned version in the Stack table is real and current-as-of-today, with **one exception (TypeScript)** and a few minor currency notes below. All three behavioral assumptions the lens called out (better-sqlite3 sync transactions, Express 5 async errors, jose) check out.

---

## Stack table — version-by-version

| Name | Spine pins | Verified latest (2026-07-19) | Status |
| --- | --- | --- | --- |
| React / react-dom | 19.2.7 | 19.2.7 (latest stable; 19.3 only in canary) | ✅ Match |
| Vite | 8.1.5 | 8.1.5 (published **2026-07-16**, 3 days before spine date) | ✅ Match |
| TypeScript | **6.x** | **7.0 GA'd 2026-07-09**; 6.0 was prior line | ⚠️ Superseded — see Finding 1 |
| Tailwind CSS | 4.3.2 | 4.3.2 (latest, ~2 wks old) | ✅ Match |
| shadcn/ui CLI | v4 (`--base radix`) | CLI v4 (Mar 2026); Base UI now default (Jul 2026); Radix via `-b radix` | ✅ Correct, flag-spelling note (Finding 2) |
| Node.js | ≥22 (LTS) | 22 = Maintenance LTS; 24 = Active LTS | ✅ Valid floor — see Finding 3 |
| Express | 5.2.1 | 5.2.1 (5.2 shipped Dec 2025) | ✅ Match |
| Drizzle ORM | 0.45.2 | 0.45.2 | ✅ Match |
| better-sqlite3 | 12.11.1 | 12.11.1 (~1 mo old) | ✅ Match |
| jose | 6.2.3 | 6.2.3 | ✅ Match |
| bcrypt | 6.0.0 | 6.0.0 | ✅ Match |

**9 of 11 pins are exact matches to the current latest.** Vite even pins the patch released 3 days ago — this table was clearly web-checked, not recalled from training data.

---

## Findings

### Finding 1 — TypeScript pinned to `6.x`, but `7.0` GA'd 10 days ago (currency note, non-blocking)
- TypeScript **7.0** reached general availability on **2026-07-09** (the Go-native "tsgo" compiler, ~10× faster than 6.0). 6.0 shipped 2026-03-23 and was explicitly framed by Microsoft as "the last JavaScript-based compiler and a bridge to 7.0."
- The spine pins **"6.x (strict mode)"** and asserts it as if current. As of the spine's own date (2026-07-19), 6.x is the *previous* major line, superseded by a 10-day-old GA release.
- This is not necessarily wrong — pinning the mature 6.x line over a brand-new major is a defensible stability choice for a small greenfield app. But the spine states it flatly without acknowledging 7.0 exists, which is exactly the "asserted, not currency-checked" pattern the gate guards against. **Recommendation:** either bump to 7.0 or add a one-line note that 6.x is a deliberate hold-back while 7.0 stabilizes.

### Finding 2 — shadcn base flag spelling / default flip (minor)
- CLI v4 (Mar 2026) confirmed. **As of July 2026, Base UI is the new default** for `shadcn init`; Radix is still fully supported but no longer the default.
- The spine's intent (explicitly select Radix) is therefore *correct and now necessary* — good catch by the author. However, the spine writes the flag as **`--base radix`**; the official July 2026 changelog documents it as **`-b radix`**. `--base` may be the valid long form, but that wasn't confirmable from the docs, which only show `-b radix`. **Recommendation:** verify the exact long-flag spelling against `shadcn init --help` before it lands in a story, or use the documented `-b radix`.

### Finding 3 — Node "≥22 (LTS)" is a valid floor but no longer the *active* LTS (informational)
- In 2026, **Node 24 is Active LTS**; **Node 22 has moved to Maintenance LTS** (still supported, still "LTS"); Node 26 is Current (enters LTS Oct 2026).
- `≥22` is a correct, safe floor and satisfies Vite 8's requirement (Node 20.19+ / 22.12+), so nothing is broken. Just flagging that "≥22 (LTS)" reads as if 22 were the headline LTS when the active line is now 24. No change required.

---

## Behavioral / API assumptions called out by the lens — all verified

### AD-9 — better-sqlite3 synchronous transaction callbacks ✅ CONFIRMED
Official better-sqlite3 API docs (WiseLibs) explicitly state: *"Transaction functions do not work with async functions… an async function always returns after the first `await`, which means the transaction will already be committed before any async code executes."* The spine's rule (every `db.transaction(cb)` is plain sync, never async/Promise/await) is **exactly correct** and matches current library behavior. This is the strongest-verified rule in the spine.

### Express 5 async error handling ✅ CONFIRMED (spine is correct, and slightly conservative)
Express 5.x automatically forwards rejected promises / thrown errors from async route handlers to error-handling middleware — `asyncHandler` wrappers are no longer needed. The spine's Consistency Conventions say routes "wrap async handlers in try/catch, map errors to HTTP status + `{error}`." That still works and is not wrong; it's belt-and-suspenders given Express 5's native forwarding. No correction needed — optionally note that a central error middleware could replace per-route try/catch.

### AD-7 — jose ✅ CONFIRMED current, no contradicted API assumption
jose 6.2.3 is the current latest and jose remains the maintained, web-standard JOSE library (panva/jose). AD-7 does not pin a specific jose call signature (it only says "JWT sign/verify goes through jose exclusively"), so there is no concrete API shape to contradict — the stable `SignJWT` / `jwtVerify` async API in v6 fits the rule cleanly.

### Technology existence / deprecation sweep ✅
None of the named technologies are deprecated or abandoned: React 19, Vite 8 (now Rolldown-based), Tailwind v4, shadcn CLI v4, Express 5, Drizzle 0.45, better-sqlite3 12, jose 6, bcrypt 6 are all actively maintained and current. bcrypt remains OWASP-accepted (work factor ≥10), consistent with the CLAUDE.md ≥10-salt-rounds rule.

---

## Sources
- React: https://www.npmjs.com/package/react?activeTab=versions · https://react.dev/versions
- Vite: https://github.com/vitejs/vite/releases · https://vite.dev/blog/announcing-vite8
- TypeScript: https://github.com/microsoft/typescript/releases · https://visualstudiomagazine.com/articles/2026/04/21/typescript-7-0-beta-arrives-on-go-based-foundation-with-10x-speed-claim.aspx
- Tailwind: https://www.npmjs.com/package/tailwindcss?activeTab=versions · https://tailwindcss.com/blog/tailwindcss-v4
- shadcn/ui: https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default · https://ui.shadcn.com/docs/changelog/2026-03-cli-v4
- Node.js: https://nodejs.org/en/about/previous-releases · https://endoflife.date/nodejs
- Express: https://expressjs.com/en/blog/2025-03-31-v5-1-latest-release/ · https://expressjs.com/en/guide/error-handling/
- Drizzle: https://www.npmjs.com/package/drizzle-orm
- better-sqlite3: https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md
- jose: https://www.npmjs.com/package/jose · https://github.com/panva/jose
- bcrypt: https://www.npmjs.com/package/bcrypt
