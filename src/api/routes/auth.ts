import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';

import { db } from '../../db';
import { users } from '../../db/schema';
import { signToken } from '../lib/jwt';
import { ok, fail } from '../lib/respond';

/**
 * Auth routes (AD-6: query Drizzle directly, no service/repository layer;
 * AD-13: canonical Auth response DTO).
 *
 * Story 1.1 ships `POST /api/auth/register` only — login arrives in Story 1.2 and
 * must return the identical `{data:{token,user:{id,email,name}}}` shape defined here.
 */

/** bcrypt salt rounds — ≥10 per NFR2 / CLAUDE.md coding standards. */
const SALT_ROUNDS = 12;

/** Basic RFC-5322-ish email shape check — good enough for form validation. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const authRouter = Router();

authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body ?? {};

    // Validate required fields + email format (→ 400).
    if (typeof email !== 'string' || typeof password !== 'string' || typeof name !== 'string') {
      return res.status(400).json(fail('email, password, and name are required'));
    }

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    if (!trimmedEmail || !password || !trimmedName) {
      return res.status(400).json(fail('email, password, and name are required'));
    }

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      return res.status(400).json(fail('email must be a valid email address'));
    }

    // Reject duplicate email (→ 409).
    const existing = db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, trimmedEmail))
      .get();

    if (existing) {
      return res.status(409).json(fail('an account with this email already exists'));
    }

    // Hash the password — the plaintext is never stored or returned (AD-13).
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const inserted = db
      .insert(users)
      .values({ email: trimmedEmail, password: passwordHash, name: trimmedName })
      .returning({ id: users.id, email: users.email, name: users.name })
      .get();

    const token = await signToken({ userId: inserted.id });

    // Canonical Auth DTO (AD-13) — `password` is deliberately absent.
    return res.status(201).json(
      ok({
        token,
        user: { id: inserted.id, email: inserted.email, name: inserted.name },
      }),
    );
  } catch (err) {
    // The pre-check SELECT above is not atomic with this INSERT: two concurrent
    // requests for the same email can both pass the check before either commits
    // (the `await bcrypt.hash` in between yields to the event loop). The `users.email`
    // UNIQUE constraint is the real source of truth — translate its violation to the
    // same 409 the pre-check produces, rather than letting it fall through as a 500.
    if (err instanceof Error && 'code' in err && (err as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json(fail('an account with this email already exists'));
    }

    console.error('POST /api/auth/register failed:', err);
    return res.status(500).json(fail('internal server error'));
  }
});

/**
 * The single generic credential-rejection message (AD-8 / AD-13, Story 1.2 AC2).
 *
 * Returned verbatim for BOTH an unknown email AND a wrong password, so the response
 * never reveals whether an account exists for the submitted email. Keeping it as one
 * constant guarantees the two failure paths are byte-for-byte identical.
 */
const INVALID_CREDENTIALS_MESSAGE = 'invalid email or password';

/**
 * A precomputed hash of an unguessable placeholder, compared against when no user is
 * found for the submitted email (see the /login handler below).
 *
 * An identical error message is not enough on its own: `bcrypt.compare` is
 * deliberately slow (~100ms+), so skipping it entirely for an unknown email — the
 * short-circuit `!user || ...` would otherwise do — makes that case return orders of
 * magnitude faster than a wrong-password case, letting an attacker enumerate
 * registered emails purely by response time (CWE-208). Comparing against this dummy
 * hash even when no user exists keeps both failure paths doing the same bcrypt work.
 */
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('no-such-user-timing-safety-placeholder', SALT_ROUNDS);

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body ?? {};

    // Validate required fields present (→ 400). Format is not re-checked here: an
    // invalid email simply won't match any row and falls through to the generic 401.
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json(fail('email and password are required'));
    }

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      return res.status(400).json(fail('email and password are required'));
    }

    // Look up the user by email (AD-6: query Drizzle directly).
    const user = db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        password: users.password,
      })
      .from(users)
      .where(eq(users.email, trimmedEmail))
      .get();

    // Unknown email AND bad password both return the SAME generic 401 — no branch,
    // and no *timing*, reveals which case occurred (Story 1.2 AC2). bcrypt.compare
    // always runs, against the real hash when the user exists or DUMMY_PASSWORD_HASH
    // when they don't, so both paths do the same amount of work.
    const passwordMatches = await bcrypt.compare(password, user ? user.password : DUMMY_PASSWORD_HASH);

    if (!user || !passwordMatches) {
      return res.status(401).json(fail(INVALID_CREDENTIALS_MESSAGE));
    }

    const token = await signToken({ userId: user.id });

    // Canonical Auth DTO (AD-13) — field-for-field identical to register's response;
    // `password` is deliberately absent.
    return res.status(200).json(
      ok({
        token,
        user: { id: user.id, email: user.email, name: user.name },
      }),
    );
  } catch (err) {
    console.error('POST /api/auth/login failed:', err);
    return res.status(500).json(fail('internal server error'));
  }
});
