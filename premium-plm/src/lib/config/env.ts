const RAW_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function resolveBaseUrl(): string {
  const value = RAW_BASE_URL?.trim();

  if (!value) {
    throw new Error(
      "VITE_API_BASE_URL is not set. Copy `.env.example` to `.env` and set it " +
        "to the base URL of the Premium PLM API, then restart the dev server.",
    );
  }

  // Trailing slashes are stripped once, here, so that every call site can
  // pass a leading-slash path without risking a double slash.
  return value.replace(/\/+$/, "");
}

export const env = {
  /** Normalised API origin, e.g. `https://premiumplm-api.onrender.com` */
  apiBaseUrl: resolveBaseUrl(),
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const;
