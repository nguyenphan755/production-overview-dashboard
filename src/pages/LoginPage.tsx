import { useState } from "react";
import type { AuthSession } from "../services/authApi";
import { login } from "../services/authApi";
import "./LoginPage.css";

type LoginPageProps = {
  onSuccess: (session: AuthSession) => void;
};

export default function LoginPage({ onSuccess }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    try {
      const session = await login(email.trim().toLowerCase(), password);
      onSuccess(session);
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Login failed");
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-badge">Production Access</div>
          <h1>Sign in</h1>
          <p>Use your issued credentials to continue.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span>Username</span>
            <input
              type="email"
              name="username"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@mes.vn"
            />
          </label>

          <label className="login-field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
            />
          </label>

          <button type="submit" className="login-submit" disabled={status === "loading"}>
            {status === "loading" ? "Signing in..." : "Continue"}
          </button>
        </form>

        {status === "error" && (
          <div className="login-message login-message-error">
            {errorMessage || "Invalid credentials. Please try again."}
          </div>
        )}

        <div className="login-footer">
          <span>Need access?</span>
          <button type="button" className="login-link">
            Contact your supervisor
          </button>
        </div>
      </div>
    </div>
  );
}
