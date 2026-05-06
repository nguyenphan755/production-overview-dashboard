import React, { useState } from "react";
import type { AuthSession } from "../services/authApi";
import { login } from "../services/authApi";
import "./LoginPage.css";

type LoginPageProps = {
  onSuccess: (session: AuthSession) => void;
};

export default function LoginPage({ onSuccess }: LoginPageProps) {
  const cadiviLogo = new URL("../assets/cadivi-logo.png", import.meta.url).href;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [lastLoginInfo, setLastLoginInfo] = useState<string | null>(
    () => localStorage.getItem("mes_last_login_info")
  );

  const formatLastLogin = (dateString: string | null | undefined) => {
    if (!dateString) {
      return null;
    }
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    try {
      const session = await login(email.trim().toLowerCase(), password);
      const lastLogin = formatLastLogin(session.user.lastLoginAt);
      const hostname =
        typeof window !== "undefined" && window.location.hostname
          ? window.location.hostname
          : "this workstation";
      const info = lastLogin
        ? `Last login: ${lastLogin} from ${hostname}`
        : `First login from ${hostname}`;
      localStorage.setItem("mes_last_login_info", info);
      setLastLoginInfo(info);
      onSuccess(session);
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Login failed");
    }
  };

  return (
    <div className="login-page">
      <div className="login-snow" aria-hidden="true" />
      <div className="login-grid" aria-hidden="true" />
      <div className="login-shell">
        <section className="login-aside">
          <div className="login-brand">
            <img src={cadiviLogo} alt="CADIVI" className="login-brand-logo" />
            <div className="login-badge">MES Secure Access</div>
          </div>

          <h1>Manufacturing Execution System</h1>
          <p>Real-time Production Monitoring &amp; Control</p>

          <ul className="login-features">
            <li>
              <span className="login-dot login-dot-green" />
              Equipment Status Tracking
            </li>
            <li>
              <span className="login-dot login-dot-cyan" />
              Performance Analytics
            </li>
            <li>
              <span className="login-dot login-dot-amber" />
              Quality Control
            </li>
          </ul>

          <div className="login-divider" aria-hidden="true" />

          <div className="login-footer-brand">
            <strong>CADIVI Tân Á</strong>
            <span>Industrial Manufacturing Dashboard</span>
          </div>
        </section>

        <section className="login-panel">
          <div className="login-header">
            <h2>Welcome Back</h2>
            <p>Sign in to access the dashboard</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="login-field">
              <span>Username</span>
              <div className="login-input">
                <span className="login-input-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" role="presentation">
                    <path
                      d="M20 21a8 8 0 0 0-16 0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle
                      cx="12"
                      cy="7"
                      r="4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                </span>
                <input
                  type="email"
                  name="username"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your username"
                />
              </div>
            </label>

            <label className="login-field">
              <span>Password</span>
              <div className="login-input">
                <span className="login-input-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" role="presentation">
                    <rect
                      x="3"
                      y="10"
                      width="18"
                      height="10"
                      rx="2"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      d="M7 10V7a5 5 0 0 1 10 0v3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="login-input-action"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <svg viewBox="0 0 24 24" role="presentation">
                    <path
                      d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </button>
              </div>
            </label>

            <div className="login-row">
              <label className="login-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                Remember me
              </label>
              <button type="button" className="login-link">
                Forgot password?
              </button>
            </div>

            <button type="submit" className="login-submit" disabled={status === "loading"}>
              {status === "loading" ? "Signing in..." : "Sign In"}
              <span aria-hidden="true">→</span>
            </button>
          </form>

          {status === "loading" && (
            <div className="login-loading" aria-live="polite">
              <div className="login-loading-bar">
                <span />
              </div>
              <div className="login-loading-text">
                Authenticating... Verifying credentials...
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="login-message login-message-error">
              {errorMessage || "Invalid credentials. Please try again."}
            </div>
          )}

          {status !== "loading" && lastLoginInfo && (
            <div className="login-message login-message-info">{lastLoginInfo}</div>
          )}

          <div className="login-footer">
            For security reasons, this system is restricted to authorized personnel only.
          </div>
        </section>
      </div>
    </div>
  );
}
