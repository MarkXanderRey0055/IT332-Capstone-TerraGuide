import React, { useState } from 'react';

interface LoginProps {
  onBack: () => void;
}

const AdminLogin: React.FC<LoginProps> = ({ onBack }) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#112a1d] p-4 relative overflow-hidden font-sans">
      {/* Background Grid Pattern Overlay */}
      <div className="absolute inset-0 opacity-5 pointer-events-none bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      {/* Main Form Glassmorphic Card */}
      <div className="w-full max-w-md p-10 rounded-[2.5rem] border border-white/10 bg-white/[0.03] backdrop-blur-md shadow-2xl relative z-10 text-left">

        {/* Top Navigation Badge Row */}
        <div className="flex items-center space-x-3 mb-8">
          <button
            onClick={onBack}
            className="text-sm text-gray-400 hover:text-white transition flex items-center gap-1.5"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back
          </button>

          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/5 text-xs text-gray-300">
            <svg
              className="w-3.5 h-3.5 text-yellow-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span>Admin Portal</span>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-4xl font-bold text-white font-serif mb-2 tracking-wide">
          Sign In
        </h2>
        <p className="text-sm text-gray-400 mb-8">
          Enter admin credentials to authorize terminal.
        </p>

        {/* Form */}
        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">

          {/* Username */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold tracking-wider text-gray-400 uppercase">
              Username
            </label>

            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </span>

              <input
                type="text"
                placeholder="Enter admin username"
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/30 transition text-sm"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold tracking-wider text-gray-400 uppercase">
              Password
            </label>

            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </span>

              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter master password"
                className="w-full pl-12 pr-12 py-3.5 rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/30 transition text-sm"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-500 hover:text-gray-300 transition"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-4 mt-2 rounded-xl bg-gradient-to-r from-yellow-700/80 to-yellow-800/80 hover:from-yellow-600 hover:to-yellow-700 text-white font-medium shadow-lg border border-yellow-500/10 transition active:scale-[0.99]"
          >
            Sign In
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-white/[0.05] text-center text-sm space-y-2">
          <p className="text-gray-400 text-xs">
            Authorized group personnel only. Access logging is monitored.
          </p>
        </div>

      </div>
    </div>
  );
};

export default AdminLogin;