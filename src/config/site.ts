/**
 * Self-hosted VM / local URLs. No cloud host defaults — use env when the SPA
 * is not served from the same origin as the API (e.g. split hosts).
 */

export function getApiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:4000";
  if (typeof window !== "undefined" && window.location?.origin)
    return window.location.origin;
  return "http://localhost:4000";
}

/** Socket.IO connects to the same host as HTTP unless overridden. */
export function getSocketUrl(): string {
  const fromEnv = (import.meta.env.VITE_SOCKET_URL as string | undefined)?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return getApiBaseUrl();
}

/**
 * Public origin for invite links (WhatsApp, etc.). On the VM set
 * VITE_PUBLIC_APP_URL if the app is behind a domain that differs from window.location (rare for same-box nginx).
 */
export function getPublicAppOrigin(): string {
  const fromEnv = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location?.origin)
    return window.location.origin;
  return "http://localhost:5729";
}

export function getOnboardingUrl(): string {
  return `${getPublicAppOrigin()}/onboarding`;
}
