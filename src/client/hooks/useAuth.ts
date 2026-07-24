import { useCallback, useState } from 'react';
import { register as registerRequest, TOKEN_KEY } from '@/lib/api';
import type { AuthUser } from '@/lib/api';

/**
 * Auth state hook (AD-10, AD-13).
 *
 * AD-10: this hook is the SOLE WRITER of the `taskflow_token` localStorage key —
 * it sets the token on register success (and, in later stories, on login success /
 * clears it on logout). `lib/api.ts` is the sole reader.
 *
 * AD-13: the register response is destructured as `{ token, user }` exactly as a
 * future login flow will destructure it — register and login return the identical
 * canonical Auth DTO, so no register-specific field names are introduced here.
 */

export interface UseAuth {
  /** The authenticated user, or `null` before a successful register/login. */
  user: AuthUser | null;
  /** True once a token has been stored for the current session. */
  isAuthenticated: boolean;
  /** Register a new account; on success stores the token and returns the user. */
  register: (email: string, password: string, name: string) => Promise<AuthUser>;
}

export function useAuth(): UseAuth {
  const [user, setUser] = useState<AuthUser | null>(null);

  const register = useCallback(
    async (email: string, password: string, name: string): Promise<AuthUser> => {
      // AD-13: destructure the canonical Auth DTO identically to how login later will.
      const { token, user: registeredUser } = await registerRequest(email, password, name);
      // AD-10: sole writer of the token — replace any previous value.
      localStorage.setItem(TOKEN_KEY, token);
      setUser(registeredUser);
      return registeredUser;
    },
    [],
  );

  return {
    user,
    isAuthenticated: user !== null,
    register,
  };
}
