/// <reference types="vite/client" />

/**
 * Merges with Vite's own `ImportMetaEnv` so the base URL is a `string` rather
 * than `any`, and a typo in the name becomes a compile error.
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}
