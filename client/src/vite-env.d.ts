/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the FinCheck API. Defaults to "/api" (same-origin). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
