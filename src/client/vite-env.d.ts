/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional override for the API origin. Defaults to `http://localhost:3001`. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
