import React from 'react';

interface LoginProps {
  onBack: () => void;
}

const AdminLogin: React.FC<LoginProps> = ({ onBack }) => {
  return (
    <div className="w-full max-w-md p-8 rounded-2xl bg-white/[0.04] border border-white/[0.05] backdrop-blur-md text-center text-white">
      <button onClick={onBack} className="text-xs text-yellow-500 hover:underline mb-4 block text-left">
        ← Back to selection
      </button>
      <h2 className="text-2xl font-semibold mb-2 text-yellow-500">Admin Portal</h2>
      <p className="text-gray-400 text-sm">Hello pogi</p>
    </div>
  );
};

export default AdminLogin;