const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:5000/api";

export const AUTH_UNAUTHORIZED_EVENT = "auth:unauthorized";

/**
 * Error thrown for any non-2xx API response. Carries the HTTP status
 * so callers (e.g. AuthService) can branch on 401 vs. validation errors.
 */
export class ApiError extends Error {
  status: number;
  // Structured extra fields from the backend's `errors` field, when
  // present — e.g. AI usage limit responses carry a machine-readable
  // `error` code plus quota numbers here instead of just a message string.
  details: Record<string, unknown> | null;

  constructor(message: string, status: number, details: Record<string, unknown> | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function clearSession() {
  localStorage.removeItem("terraguide_token");
  localStorage.removeItem("terraguide_user");
}

export async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
) {
  const token = localStorage.getItem("terraguide_token");

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token && {
      Authorization: `Bearer ${token}`,
    }),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Some endpoints (e.g. 204 No Content) may not return a JSON body.
  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401) {
      // Token missing/expired/invalid — clear the stale session and let
      // the rest of the app (App.tsx) react by dropping back to login.
      clearSession();
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    }

    throw new ApiError(data?.message || "Request failed", response.status, data?.errors ?? null);
  }

  return data;
}