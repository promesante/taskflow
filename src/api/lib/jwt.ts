import { SignJWT, jwtVerify } from 'jose';

/**
 * JWT sign/verify helpers (AD-7: `jose` exclusively, no other JWT library).
 *
 * These are the single source of token signing/verification for the whole app —
 * every auth route and the auth middleware (when it arrives) reuse them, so the
 * functions are named generically rather than register-specific. Tokens carry the
 * authenticated user's id and expire in 7 days (CLAUDE.md coding standards).
 */

/** Claims carried inside a TaskFlow JWT. */
export interface JwtPayload {
  userId: number;
}

const TOKEN_EXPIRY = '7d';
const ALGORITHM = 'HS256';

/**
 * The HMAC secret, encoded once. Read lazily so a missing `JWT_SECRET` fails loudly
 * at sign/verify time rather than silently signing with an empty key.
 */
function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }
  return new TextEncoder().encode(secret);
}

/** Sign a token embedding the given claims; expires in 7 days. */
export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ userId: payload.userId })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(secretKey());
}

/** Verify a token and return its claims, throwing if invalid or expired. */
export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, secretKey(), {
    algorithms: [ALGORITHM],
  });

  if (typeof payload.userId !== 'number') {
    throw new Error('Token payload missing numeric userId');
  }

  return { userId: payload.userId };
}
