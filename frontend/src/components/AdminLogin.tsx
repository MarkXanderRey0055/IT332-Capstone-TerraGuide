import React, { useState } from "react";

interface LoginProps {
  onBack: () => void;
  onLogin?: () => void;
}

const AdminLogin: React.FC<LoginProps> = ({ onBack, onLogin }) => {
  const [showPassword, setShowPassword] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    const adminUsername = "admin1";
    const adminPassword = "admin123";

    if (username === adminUsername && password === adminPassword) {
      setError("");

      console.log("Admin login successful");

      // Sends user to dashboard if function exists
      if (onLogin) {
        onLogin();
      }

    } else {
      setError("Invalid username or password.");
    }
  };


  return (
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
              onChange={(e)=>setUsername(e.target.value)}
              placeholder="Enter admin username"
              className="w-full px-4 py-3.5 rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/30 transition text-sm"
            />

          </div>




          {/* Password */}

          <div className="space-y-2">

            <label className="block text-xs font-semibold tracking-wider text-gray-400 uppercase">
              Password
            </label>


            <div className="relative">

              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e)=>setPassword(e.target.value)}
                placeholder="Enter master password"
                className="w-full px-4 pr-12 py-3.5 rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/30 transition text-sm"
              />


              <button
                type="button"
                onClick={()=>setShowPassword(!showPassword)}
                className="absolute right-4 top-3 text-gray-400 hover:text-white"
              >
                {showPassword ? "👁" : "👁"}
              </button>

            </div>

          </div>




          {/* Error Message */}

          {error && (
            <p className="text-red-400 text-sm text-center">
              {error}
            </p>
          )}




          {/* Submit */}

          <button
            type="submit"
            className="w-full py-4 rounded-xl bg-gradient-to-r from-yellow-700/80 to-yellow-800/80 hover:from-yellow-600 hover:to-yellow-700 text-white font-medium shadow-lg transition"
          >
            Sign In
          </button>


        </form>




        <div className="mt-8 pt-6 border-t border-white/[0.05] text-center">

          <p className="text-gray-400 text-xs">
            Authorized group personnel only. Access logging is monitored.
          </p>

        </div>


      </div>

    </div>
  );
};


export default AdminLogin;