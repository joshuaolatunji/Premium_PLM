/// <reference types="vite/client" />

/**
 * Typed access to Vite env vars. Vite's own declaration is an interface with
 * an index signature, so this merges with it rather than replacing it — which
 * is what makes `import.meta.env.VITE_API_BASE_URL` a `string` instead of
 * `any`, and makes a typo in the variable name a compile error.
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}
