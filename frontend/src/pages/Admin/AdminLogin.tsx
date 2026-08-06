import React, { useState } from "react";
import { login, logout } from "../../services/AuthService";

interface LoginProps {
  onBack: () => void;
  onLogin?: () => void;
}

const AdminLogin: React.FC<LoginProps> = ({ onBack, onLogin }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedUsername = username.trim();

    if (!trimmedUsername || !password) {
      setError("Please enter both username and password.");
      return;
    }

    try {
      setLoading(true);
      const user = await login(trimmedUsername, password);

      if (user.role !== "admin") {
        logout();
        setError("This account does not have admin access.");
        return;
      }

      if (onLogin) {
        onLogin();
      }
    } catch (err: any) {
      setError(err.message || "Invalid username or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* FIX: Hides native browser eye (Edge/Chrome) so only your custom one shows */}
      <style>{`
        input[type="password"]::-ms-reveal,
        input[type="password"]::-ms-clear {
          display: none;
        }
        input::-webkit-credentials-auto-fill-button {
          visibility: hidden;
          display: none !important;
          pointer-events: none;
          position: absolute;
          right: 0;
        }
      `}</style>

      <div className="min-h-screen flex items-center justify-center bg-[#112a1d] p-4 relative overflow-hidden font-sans">
        <div className="absolute inset-0 opacity-5 pointer-events-none bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]"></div>

        <div className="w-full max-w-md p-10 rounded-[2.5rem] border border-white/10 bg-white/[0.03] backdrop-blur-md shadow-2xl relative z-10 text-left">
          <div className="flex items-center space-x-3 mb-8">
            <button
              onClick={onBack}
              className="text-sm text-gray-400 hover:text-white transition flex items-center gap-1.5"
            >
              ← Back
            </button>
            <div className="px-3 py-1 rounded-full bg-white/10 border border-white/5 text-xs text-gray-300">
              🔒 Admin Portal
            </div>
          </div>

          <h2 className="text-4xl font-bold text-white font-serif mb-2">
            Sign In
          </h2>
          <p className="text-sm text-gray-400 mb-8">
            Enter admin credentials to authorize terminal.
          </p>

          <form onSubmit={handleLogin} className="space-y-6">
            {/* Username */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold tracking-wider text-gray-400 uppercase">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter admin username"
                autoComplete="username"
                className="w-full px-4 py-3.5 rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/30 transition text-sm"
              />
            </div>

            {/* Password - CORRECTED */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold tracking-wider text-gray-400 uppercase">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter master password"
                  autoComplete="current-password"
                  className="w-full px-4 pr-12 py-3.5 rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/30 transition text-sm [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors z-10"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-xl text-white font-medium transition ${
                loading
                  ? "bg-gray-600 cursor-not-allowed"
                  : "bg-gradient-to-r from-yellow-700/80 to-yellow-800/80 hover:from-yellow-600 hover:to-yellow-700"
              }`}
            >
              {loading ? "Please wait..." : "Sign In"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/[0.05] text-center">
            <p className="text-gray-400 text-xs">
              Authorized group personnel only. Access logging is monitored.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminLogin;
