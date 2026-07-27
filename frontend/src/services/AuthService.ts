import { apiRequest } from "../utils/api";

export interface User {
  _id: string;
  username: string;
  email: string;
  role: string;
}

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


export async function verifyToken(): Promise<User | null> {
  if (!getToken()) {
    return null;
  }

  try {
    const response = (await apiRequest("/auth/me")) as {
      success: boolean;
      message: string;
      data: User;
    };

    localStorage.setItem("terraguide_user", JSON.stringify(response.data));
    return response.data;
  } catch {
    // Invalid/expired token — apiRequest already clears storage on 401,
    // but clear again defensively in case of other failures.
    logout();
    return null;
  }
}