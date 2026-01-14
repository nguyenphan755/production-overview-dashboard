import React, { useState, useEffect } from 'react';
import { Factory, User, Lock, Eye, EyeOff, AlertCircle, Loader2, Activity, Package, ClipboardList, Zap } from 'lucide-react';

interface LoginProps {
  onLogin: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
}

export function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Form validation
  const isFormValid = username.trim().length > 0 && password.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!isFormValid || isLoading) {
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const result = await onLogin(username, password);
      
      if (result.success) {
        // Store credentials if "Remember me" is checked
        if (rememberMe) {
          localStorage.setItem('mes_remembered_username', username);
        } else {
          localStorage.removeItem('mes_remembered_username');
        }
      } else {
        setError(result.message || 'Invalid credentials. Please try again.');
      }
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load remembered username on mount
  useEffect(() => {
    const remembered = localStorage.getItem('mes_remembered_username');
    if (remembered) {
      setUsername(remembered);
      setRememberMe(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A1E3A] via-[#0E2F4F] to-[#0A1E3A] flex items-center justify-center p-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#34E7F8]/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#4FFFBC]/5 rounded-full blur-3xl"></div>
      </div>

      {/* Main Login Card - Two Column Layout */}
      <div className="relative w-full max-w-6xl">
        <div className="bg-white/5 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden">
          <div className="grid md:grid-cols-2 min-h-[600px]">
            {/* Left Side - MES Information */}
            <div className="hidden md:flex flex-col justify-between p-10 lg:p-12 bg-gradient-to-br from-white/10 via-white/5 to-transparent border-r border-white/10">
              <div>
                {/* Logo and Branding */}
                <div className="mb-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#34E7F8] to-[#4FFFBC] flex items-center justify-center shadow-[0_0_30px_rgba(52,231,248,0.4)]">
                      <Factory className="w-9 h-9 text-[#0A1E3A]" strokeWidth={2.5} />
                    </div>
                    <div>
                      <h1 className="text-3xl font-semibold text-white tracking-wide">CADIVI</h1>
                      <p className="text-white/60 text-sm">Manufacturing Execution System</p>
                    </div>
                  </div>
                </div>

                {/* System Description */}
                <div className="space-y-4 mb-8">
                  <h2 className="text-2xl font-medium text-white leading-tight">
                    Production Overview Dashboard
                  </h2>
                  <p className="text-white/70 text-base leading-relaxed">
                    Real-time monitoring and analytics for your manufacturing operations.
                    Track KPIs, OEE, energy consumption, and production metrics across your entire facility.
                  </p>
                </div>

                {/* Key Features */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-white/80">
                    <div className="w-2 h-2 rounded-full bg-[#34E7F8] flex-shrink-0"></div>
                    <span className="text-sm">Real-time equipment monitoring</span>
                  </div>
                  <div className="flex items-center gap-3 text-white/80">
                    <div className="w-2 h-2 rounded-full bg-[#4FFFBC] flex-shrink-0"></div>
                    <span className="text-sm">OEE and performance analytics</span>
                  </div>
                  <div className="flex items-center gap-3 text-white/80">
                    <div className="w-2 h-2 rounded-full bg-[#FFB86C] flex-shrink-0"></div>
                    <span className="text-sm">Energy consumption tracking</span>
                  </div>
                  <div className="flex items-center gap-3 text-white/80">
                    <div className="w-2 h-2 rounded-full bg-[#34E7F8] flex-shrink-0"></div>
                    <span className="text-sm">Production order management</span>
                  </div>
                </div>
              </div>

              {/* Footer Info */}
              <div className="pt-6 border-t border-white/10">
                <p className="text-white/50 text-xs">
                  Shop Floor Tân Á • Manufacturing Execution System
                </p>
              </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10 xl:p-12">
              {/* Mobile Logo - Only visible on small screens */}
              <div className="md:hidden flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#34E7F8] to-[#4FFFBC] flex items-center justify-center shadow-[0_0_20px_rgba(52,231,248,0.3)]">
                  <Factory className="w-7 h-7 text-[#0A1E3A]" strokeWidth={2.5} />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-white tracking-wide">CADIVI</h1>
                  <p className="text-white/60 text-xs">MES Dashboard</p>
                </div>
              </div>

              {/* Form Header */}
              <div className="mb-6">
                <h2 className="text-2xl md:text-3xl font-semibold text-white mb-2">Welcome Back</h2>
                <p className="text-white/60 text-sm">Sign in to access your dashboard</p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 rounded-lg bg-[#FF4C4C]/10 border border-[#FF4C4C]/30 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-[#FF4C4C] flex-shrink-0 mt-0.5" />
                  <p className="text-[#FF4C4C] text-sm flex-1">{error}</p>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Username Field */}
                <div className="space-y-2">
                  <label htmlFor="username" className="text-sm font-medium text-white/80 flex items-center gap-2">
                    <User className="w-4 h-4 text-[#34E7F8]" />
                    Username
                  </label>
                  <div className="relative">
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setError(null);
                      }}
                      placeholder="Enter your username"
                      required
                      disabled={isLoading}
                      autoComplete="username"
                      className="w-full h-12 px-4 bg-white/5 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-[#34E7F8] focus:ring-2 focus:ring-[#34E7F8]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-white/80 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#34E7F8]" />
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError(null);
                      }}
                      placeholder="Enter your password"
                      required
                      disabled={isLoading}
                      autoComplete="current-password"
                      className="w-full h-12 px-4 pr-12 bg-white/5 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-[#34E7F8] focus:ring-2 focus:ring-[#34E7F8]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-white/60 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#34E7F8]/30 rounded"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      disabled={isLoading}
                      className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#34E7F8] focus:ring-2 focus:ring-[#34E7F8]/30 focus:ring-offset-2 focus:ring-offset-transparent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">
                      Remember me
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      // Forgot password - UI only, no backend logic
                      alert('Please contact your system administrator to reset your password.');
                    }}
                    disabled={isLoading}
                    className="text-sm text-[#34E7F8] hover:text-[#4FFFBC] transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#34E7F8]/30 rounded px-1"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!isFormValid || isLoading}
                  className="w-full h-12 bg-gradient-to-r from-[#34E7F8] to-[#4FFFBC] text-[#0A1E3A] font-semibold rounded-lg shadow-[0_0_20px_rgba(52,231,248,0.3)] hover:from-[#34E7F8]/90 hover:to-[#4FFFBC]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none focus:outline-none focus:ring-2 focus:ring-[#34E7F8]/50 focus:ring-offset-2 focus:ring-offset-[#0A1E3A] flex items-center justify-center gap-2 mt-6"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Decorative gradient line */}
          <div className="h-1 bg-gradient-to-r from-[#34E7F8] via-[#4FFFBC] to-[#34E7F8]"></div>
        </div>
      </div>
    </div>
  );
}
