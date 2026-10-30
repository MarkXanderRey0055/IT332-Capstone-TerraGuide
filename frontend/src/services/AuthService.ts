import { apiRequest, ApiError } from "../utils/api";

export interface User {
  _id: string;
  username: string;
  email: string;
  role: string;
}

export type TokenVerificationResult =
  | { status: 'authenticated'; user: User }
  | { status: 'unauthenticated' }
  | { status: 'unavailable'; error: Error };

interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    token: string;
  };
}

/**
 * Login buyer/admin
 */
export async function login(username: string, password: string) {
  const response = (await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      username,
      password,
    }),
  })) as AuthResponse;

  localStorage.setItem(
    "terraguide_token",
    response.data.token
  );

  localStorage.setItem(
    "terraguide_user",
    JSON.stringify(response.data.user)
  );

  return response.data.user;
}


export async function register(
  username: string,
  email: string,
  password: string,
  fullName: string,
  address: string
) {
  const response = (await apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      username,
      email,
      password,
      fullName,
      address,
      role: "buyer",
    }),
  })) as AuthResponse;

  localStorage.setItem(
    "terraguide_token",
    response.data.token
  );

  localStorage.setItem(
    "terraguide_user",
    JSON.stringify(response.data.user)
  );

  return response.data.user;
}

/**
 * Logout
 */
export function logout() {
  localStorage.removeItem("terraguide_token");
  localStorage.removeItem("terraguide_user");
}

/**
 * Get logged in user
 */
export function getCurrentUser(): User | null {
  const user = localStorage.getItem("terraguide_user");

  if (!user) return null;

  return JSON.parse(user);
}

/**
 * Get JWT token
 */
export function getToken() {
  return localStorage.getItem("terraguide_token");
}

export function isAuthenticated(): boolean {
  return !!getToken();
}


export async function verifyToken(): Promise<TokenVerificationResult> {
  if (!getToken()) {
    return { status: 'unauthenticated' };
  }

  try {
    const response = (await apiRequest("/auth/me")) as {
      success: boolean;
      message: string;
      data: User;
    };

    localStorage.setItem("terraguide_user", JSON.stringify(response.data));
    return { status: 'authenticated', user: response.data };
  } catch (error) {
    // apiRequest clears the session and emits the unauthorized event for
    // confirmed 401 responses. Preserve the token for all other failures so
    // a temporary outage cannot log out a potentially valid user.
    if (error instanceof ApiError && error.status === 401) {
      return { status: 'unauthenticated' };
    }

    return {
      status: 'unavailable',
      error: error instanceof Error ? error : new Error('Unable to verify your session.'),
    };
  }
}
