export type AuthUser = {
  id: number;
  username: string;
  role: "operator" | "engineer" | "supervisor" | "admin";
  isActive: boolean;
  plant?: string | null;
  area?: string | null;
  line?: string | null;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

export type ManagedUser = AuthUser & {
  lastLoginAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function getApiBaseUrl(): string {
  const currentHostname =
    typeof window !== "undefined" && window.location ? window.location.hostname : null;

  if (import.meta.env.VITE_API_BASE_URL) {
    const envUrl = import.meta.env.VITE_API_BASE_URL;
    const isLocalhostEnv = envUrl.includes("localhost") || envUrl.includes("127.0.0.1");
    const isLocalhostHostname =
      currentHostname === "localhost" || currentHostname === "127.0.0.1";

    if (isLocalhostEnv && !isLocalhostHostname && currentHostname) {
      console.warn("⚠️ Auth API base URL points to localhost on a remote host.");
    } else {
      return envUrl;
    }
  }

  if (typeof window !== "undefined" && window.location) {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:3001/api`;
  }

  return "http://localhost:3001/api";
}

async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${getApiBaseUrl()}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const payload = await response.json();

  if (!response.ok || payload.success === false) {
    const message = payload.message || `Request failed: ${response.status}`;
    console.error("Auth API error:", { url, status: response.status, message });
    throw new Error(message);
  }

  return payload.data as T;
}

export async function login(username: string, password: string): Promise<AuthSession> {
  return request<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function listUsers(token: string): Promise<ManagedUser[]> {
  return request<ManagedUser[]>("/users", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function createUser(
  token: string,
  payload: {
    username: string;
    password: string;
    role: AuthUser["role"];
    isActive: boolean;
    plant?: string;
    area?: string;
    line?: string;
  }
): Promise<ManagedUser> {
  return request<ManagedUser>("/users", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function updateUser(
  token: string,
  userId: number,
  payload: {
    username?: string;
    role?: AuthUser["role"];
    isActive?: boolean;
    plant?: string | null;
    area?: string | null;
    line?: string | null;
  }
): Promise<ManagedUser> {
  return request<ManagedUser>(`/users/${userId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function resetUserPassword(
  token: string,
  userId: number,
  newPassword: string
): Promise<{ id: number; username: string }> {
  return request<{ id: number; username: string }>(`/users/${userId}/reset-password`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ newPassword }),
  });
}
