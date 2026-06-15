import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  fetchOnlineUserCount,
  sendPresenceHeartbeat,
  sendPresenceLeave,
  type PresenceSnapshot,
} from "../services/user-presence-api";

const LIVE_STORAGE_KEY = "mes_presence_live";
const HEARTBEAT_MS = 20000;
const POLL_MS = 15000;

type UserPresenceContextValue = {
  count: number;
  users: PresenceSnapshot["users"];
  isLive: boolean;
  toggleLive: () => void;
  isLoading: boolean;
};

const UserPresenceContext = createContext<UserPresenceContextValue | null>(null);

function getOrCreateSessionId(): string {
  const key = "mes_presence_session_id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

function readLivePreference(): boolean {
  const stored = localStorage.getItem(LIVE_STORAGE_KEY);
  return stored !== "false";
}

type UserPresenceProviderProps = {
  token: string;
  children: ReactNode;
};

export function UserPresenceProvider({ token, children }: UserPresenceProviderProps) {
  const [count, setCount] = useState(0);
  const [users, setUsers] = useState<PresenceSnapshot["users"]>([]);
  const [isLive, setIsLive] = useState(readLivePreference);
  const [isLoading, setIsLoading] = useState(true);
  const sessionIdRef = useRef(getOrCreateSessionId());
  const wsRef = useRef<WebSocket | null>(null);

  const applySnapshot = useCallback((snapshot: PresenceSnapshot) => {
    setCount(snapshot.count);
    setUsers(snapshot.users);
    setIsLoading(false);
  }, []);

  const toggleLive = useCallback(() => {
    setIsLive((prev) => {
      const next = !prev;
      localStorage.setItem(LIVE_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    if (!token || !isLive) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const sessionId = sessionIdRef.current;

    const heartbeat = async () => {
      try {
        const snapshot = await sendPresenceHeartbeat(token, sessionId);
        if (!cancelled) {
          applySnapshot(snapshot);
        }
      } catch {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    const poll = async () => {
      try {
        const snapshot = await fetchOnlineUserCount(token);
        if (!cancelled) {
          applySnapshot(snapshot);
        }
      } catch {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void heartbeat();
    const heartbeatTimer = window.setInterval(() => void heartbeat(), HEARTBEAT_MS);
    const pollTimer = window.setInterval(() => void poll(), POLL_MS);

    const leave = () => {
      const base =
        import.meta.env.VITE_API_BASE_URL ||
        `${window.location.protocol}//${window.location.hostname}:3001/api`;
      void fetch(`${base}/presence/leave`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId }),
        keepalive: true,
      }).catch(() => undefined);
    };

    window.addEventListener("beforeunload", leave);
    window.addEventListener("pagehide", leave);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeatTimer);
      window.clearInterval(pollTimer);
      window.removeEventListener("beforeunload", leave);
      window.removeEventListener("pagehide", leave);
      void sendPresenceLeave(token, sessionId).catch(() => undefined);
    };
  }, [token, isLive, applySnapshot]);

  useEffect(() => {
    if (!token || !isLive) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    const ws = new WebSocket(`${protocol}//${host}:3001/ws`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string);
        if (message.type === "presence:update" && message.data?.count != null) {
          setCount(message.data.count);
          setIsLoading(false);
        }
      } catch {
        // ignore malformed messages
      }
    };

    return () => {
      ws.close();
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
    };
  }, [token, isLive]);

  const value = useMemo(
    () => ({ count, users, isLive, toggleLive, isLoading }),
    [count, users, isLive, toggleLive, isLoading]
  );

  return (
    <UserPresenceContext.Provider value={value}>{children}</UserPresenceContext.Provider>
  );
}

export function useUserPresence(): UserPresenceContextValue {
  const ctx = useContext(UserPresenceContext);
  if (!ctx) {
    return {
      count: 0,
      users: [],
      isLive: true,
      toggleLive: () => undefined,
      isLoading: false,
    };
  }
  return ctx;
}
