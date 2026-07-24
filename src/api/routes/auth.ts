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
