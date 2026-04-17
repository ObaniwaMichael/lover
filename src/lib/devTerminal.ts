/**
 * Sends a line to the Vite dev server terminal (development only).
 * Use for debugging flows while clicking through the app.
 */
export function reportToDevTerminal(type: string, detail?: unknown): void {
  if (!import.meta.env.DEV) return;
  const body = JSON.stringify(
    detail !== undefined ? { type, detail } : { type },
  );
  fetch("/__lover_dev", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Offline / no dev server
  });
}
