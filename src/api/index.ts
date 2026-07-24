import express from 'express';
import cors from 'cors';

import { authRouter } from './routes/auth';

/**
 * Express app bootstrap (entry point).
 *
 * CORS is restricted to the Vite dev origin (NFR4 / CLAUDE.md). JSON body parsing
 * is enabled globally. Routers mount under `/api`; Story 1.1 wires only auth.
 */

const CLIENT_ORIGIN = 'http://localhost:5173';
const DEFAULT_PORT = 3001;

export function createApp() {
  const app = express();

  app.use(cors({ origin: CLIENT_ORIGIN }));
  app.use(express.json());

  app.use('/api/auth', authRouter);

  return app;
}

// Start the server when run directly (the tsx entry point).
const port = Number(process.env.PORT) || DEFAULT_PORT;

createApp().listen(port, () => {
  console.log(`TaskFlow API listening on http://localhost:${port}`);
});
