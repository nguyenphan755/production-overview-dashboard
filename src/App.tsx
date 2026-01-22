import React, { useEffect, useState } from "react";
import Dashboard from "./pages/Dashboard";
import LoginPage from "./pages/LoginPage";
import type { AuthSession } from "./services/authApi";

const SESSION_KEY = "mes_login_session";

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as AuthSession;
      if (parsed?.token && parsed?.user) {
        setSession(parsed);
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }, []);

  const handleLoginSuccess = (payload: AuthSession) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    setSession(payload);
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  if (!session) {
    return <LoginPage onSuccess={handleLoginSuccess} />;
  }

  return <Dashboard onLogout={handleLogout} user={session.user} token={session.token} />;
}