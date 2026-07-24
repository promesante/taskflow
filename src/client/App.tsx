import { RegisterForm } from '@/components/RegisterForm';

/**
 * App shell for Story 1.1 — just enough to mount `RegisterForm` and verify the
 * end-to-end registration flow. Full routing / app shell is out of scope here.
 */
export function App() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <RegisterForm />
    </main>
  );
}
