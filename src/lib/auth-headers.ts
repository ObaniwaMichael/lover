/**
 * JWT from session (same key as AuthContext). Sent on protected API calls.
 */
export function jsonAuthHeaders(): Record<string, string> {
  try {
    const token = sessionStorage.getItem("token");
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  } catch {
    return { "Content-Type": "application/json" };
  }
}
