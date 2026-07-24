import { useState } from 'react';
import type { FormEvent } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Registration form (Story 1.1). Functional component per CLAUDE.md coding
 * standards. Collects name/email/password, runs client-side required-field
 * validation, and calls `useAuth().register`. On success the user is authenticated
 * (no separate login step) and lands on a task-board placeholder — the real board
 * ships in Epic 2. On failure it renders the server's `{ error }` string (400/409).
 */
export function RegisterForm() {
  const { register, user, isAuthenticated } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success landing. The task board (Epic 2) does not exist yet, so the newly
  // registered — and now authenticated — user lands on this stub.
  if (isAuthenticated && user) {
    return (
      <div className="mx-auto mt-24 max-w-sm rounded-xl border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Registered!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Welcome, {user.name}. Your task board will appear here once it ships.
        </p>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // Client-side required-field validation.
    if (!name.trim() || !email.trim() || !password) {
      setError('Name, email, and password are all required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register(email.trim(), password, name.trim());
    } catch (err) {
      // AD-8 envelope: an ApiError carries the server's `{ error }` string (400/409).
      setError(
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-sm rounded-xl border bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Sign up to start managing your tasks.
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isSubmitting}
          />
        </div>

        {error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </div>
  );
}
