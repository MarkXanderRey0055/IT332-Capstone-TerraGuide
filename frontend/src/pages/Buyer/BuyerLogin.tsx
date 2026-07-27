import React, { useState } from 'react';
import { login, register } from '../../services/AuthService';
interface LoginProps {
  onBack: () => void;
  onSuccess?: () => void;
}

const BuyerLogin: React.FC<LoginProps> = ({ onBack, onSuccess }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    fullName: '',
    address: '',
  });

  const [feedback, setFeedback] = useState<{
    type: 'error' | 'success';
    message: string;
  }>({
    type: 'success',
    message: '',
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setFeedback({
      type: 'success',
      message: '',
    });

    const username = formData.username.trim();
    const password = formData.password;
    const email = formData.email.trim();
    const fullName = formData.fullName.trim();
    const address = formData.address.trim();

    if (!username || !password) {
      setFeedback({
        type: 'error',
        message: 'Please enter both username and password.',
      });
      return;
    }

    try {
      setLoading(true);

      if (isSignUp) {
        if (!email || !fullName || !address) {
          setFeedback({
            type: 'error',
            message: 'Please fill in your email, full name, and address.',
          });
          return;
        }

        await register(username, email, password, fullName, address);

        setFeedback({
          type: 'success',
          message: 'Account created successfully.',
        });

        setFormData({
          email: '',
          username: '',
          password: '',
          fullName: '',
          address: '',
        });

        setShowPassword(false);

        if (onSuccess) {
          onSuccess();
        }

        return;
      }

      await login(username, password);

      setFeedback({
        type: 'success',
        message: 'Signed in successfully.',
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      setFeedback({
        type: 'error',
        message: error.message || 'Something went wrong.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#112a1d] p-4 relative overflow-hidden font-sans">
      <div className="absolute inset-0 opacity-5 pointer-events-none bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      <div className="w-full max-w-md p-10 rounded-[2.5rem] border border-white/10 bg-white/[0.03] backdrop-blur-md shadow-2xl relative z-10 text-left">

        <div className="flex items-center space-x-3 mb-8">
          <button
            onClick={isSignUp ? () => setIsSignUp(false) : onBack}
            className="text-sm text-gray-400 hover:text-white transition flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>

            Back
          </button>

          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/5 text-xs text-gray-300">
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>

            <span>
              Buyer Portal • {isSignUp ? 'Registration' : 'Authentication'}
            </span>
          </div>
        </div>

        <h2 className="text-4xl font-bold text-white font-serif mb-2 tracking-wide">
          {isSignUp ? 'Create Account' : 'Sign In'}
        </h2>

        <p className="text-sm text-gray-400 mb-8">
          {isSignUp
            ? 'Register your account to get started.'
            : 'Enter your credentials to continue.'}
        </p>

        {feedback.message ? (
          <div
            className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
              feedback.type === 'error'
                ? 'border-red-500/30 bg-red-500/10 text-red-200'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
            }`}
          >
            {feedback.message}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-5">

                  {isSignUp && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold tracking-wider text-gray-400 uppercase">
                Email Address
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
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </span>

                <input
                  type="email"
                  value={formData.email}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                  placeholder="Enter your email address"
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/30 transition text-sm"
                />
              </div>
            </div>
          )}

          {isSignUp && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold tracking-wider text-gray-400 uppercase">
                Full Name
              </label>

              <input
                type="text"
                value={formData.fullName}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    fullName: event.target.value,
                  }))
                }
                placeholder="Enter your full name"
                className="w-full px-4 py-3.5 rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/30 transition text-sm"
              />
            </div>
          )}

          {isSignUp && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold tracking-wider text-gray-400 uppercase">
                Address
              </label>

              <input
                type="text"
                value={formData.address}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    address: event.target.value,
                  }))
                }
                placeholder="Enter your address"
                className="w-full px-4 py-3.5 rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/30 transition text-sm"
              />
            </div>
          )}

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
                value={formData.username}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    username: event.target.value,
                  }))
                }
                placeholder={
                  isSignUp
                    ? "Choose a username"
                    : "Enter your username"
                }
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/30 transition text-sm"
              />
            </div>
          </div>

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
                value={formData.password}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    password: event.target.value,
                  }))
                }
                placeholder={
                  isSignUp
                    ? "Create a password"
                    : "Enter your password"
                }
                className="w-full pl-12 pr-12 py-3.5 rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/30 transition text-sm"
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

                    <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 mt-3 rounded-xl text-white font-medium text-center shadow-lg border border-emerald-500/10 transition active:scale-[0.99] ${
              loading
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-gradient-to-r from-emerald-800 to-emerald-900 hover:from-emerald-700 hover:to-emerald-800"
            }`}
          >
            {loading
              ? "Please wait..."
              : isSignUp
              ? "Create Account"
              : "Sign In"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/[0.05] text-center text-sm space-y-2">
          {isSignUp ? (
            <p className="text-gray-400">
              Already have an account?{" "}
              <span
                onClick={() => {
                  setIsSignUp(false);
                  setFeedback({
                    type: "success",
                    message: "",
                  });
                }}
                className="text-emerald-400 font-medium underline underline-offset-4 cursor-pointer hover:text-emerald-300 transition"
              >
                Sign In instead
              </span>
            </p>
          ) : (
            <p className="text-gray-400">
              Don't have an account?{" "}
              <span
                onClick={() => {
                  setIsSignUp(true);
                  setFeedback({
                    type: "success",
                    message: "",
                  });
                }}
                className="text-emerald-400 font-medium underline underline-offset-4 cursor-pointer hover:text-emerald-300 transition"
              >
                Create one
              </span>
            </p>
          )}

          {!isSignUp && (
            <p className="text-xs text-gray-500">
              Looking for admin access?{" "}
              <span
                onClick={onBack}
                className="text-gray-300 underline underline-offset-4 cursor-pointer hover:text-white transition"
              >
                Admin sign in
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default BuyerLogin;