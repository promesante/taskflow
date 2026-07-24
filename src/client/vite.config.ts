import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Vite config for the TaskFlow client (AD-1: rooted at `src/client`, the Frontend
 * Dev shard). Run with `cd src/client && npx vite`, or `npm run dev:client` from the
 * repo root (which points `--config` here). `root` is pinned to this file's directory
 * so both invocations resolve the same project root.
 *
 * The client talks to the API by absolute origin (`http://localhost:3001`, see
 * `lib/api.ts`); CORS for `http://localhost:5173` is already handled server-side
 * (AD-8 / CLAUDE.md), so no dev proxy is configured here.
 */
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': import.meta.dirname,
    },
  },
  server: {
    port: 5173,
  },
});
