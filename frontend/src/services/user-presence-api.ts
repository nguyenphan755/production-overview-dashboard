export type OnlineUser = {
  userId: number;
  username: string;
};

export type PresenceSnapshot = {
  count: number;
  users: OnlineUser[];
};

function getApiBaseUrl(): string {
  const currentHostname =
    typeof window !== "undefined" && window.location ? window.location.hostname : null;

  if (import.meta.env.VITE_API_BASE_URL) {
    const envUrl = import.meta.env.VITE_API_BASE_URL;
    const isLocalhostEnv = envUrl.includes("localhost") || envUrl.includes("127.0.0.1");
    const isLocalhostHostname =
      currentHostname === "localhost" || currentHostname === "127.0.0.1";

    if (!(isLocalhostEnv && !isLocalhostHostname && currentHostname)) {
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
  token: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });

  const payload = await response.json();
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `Presence request failed: ${response.status}`);
  }

  return payload.data as T;
}

export async function sendPresenceHeartbeat(
  token: string,
  sessionId: string
): Promise<PresenceSnapshot> {
  return request<PresenceSnapshot>("/presence/heartbeat", token, {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export async function sendPresenceLeave(
  token: string,
  sessionId: string
): Promise<PresenceSnapshot> {
  return request<PresenceSnapshot>("/presence/leave", token, {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export async function fetchOnlineUserCount(token: string): Promise<PresenceSnapshot> {
  return request<PresenceSnapshot>("/presence/count", token);
}
