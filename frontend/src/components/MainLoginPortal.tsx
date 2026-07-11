import React, { useEffect, useState } from 'react';
import BuyerLogin from './BuyerLogin';
import AdminLogin from './AdminLogin';
import BuyerPortal from './BuyerPortal';
import AdminDashboard from './AdminDashboard';

type MainLoginPortalProps = {
  onBrowse?: () => void;
  onGoToLogin?: () => void;
  onSignOut?: () => void;
  onAuthSuccess?: () => void;
  onAdminLoginSuccess?: () => void;
  initialView?: 'selection' | 'buyer' | 'admin';
};

const MainLoginPortal: React.FC<MainLoginPortalProps> = ({
  onBrowse,
  onGoToLogin,
  onSignOut,
  onAuthSuccess,
  onAdminLoginSuccess,
  initialView = 'selection',
}) => {
  const [currentView, setCurrentView] = useState<'selection' | 'buyer' | 'admin' | 'browse' | 'adminDashboard'>(
    initialView === 'buyer' ? 'buyer' : 'selection',
  );

  useEffect(() => {
    if (initialView === 'buyer') {
      setCurrentView('buyer');
    }
  }, [initialView]);

  if (currentView === 'buyer') {
    return (
      <BuyerLogin
        onBack={() => setCurrentView('selection')}
        onSuccess={() => {
          if (onAuthSuccess) {
            onAuthSuccess();
            return;
          }
          setCurrentView('browse');
        }}
      />
    );
  }

  if (currentView === 'browse') {
    return <BuyerPortal onGoToLogin={onGoToLogin} onSignOut={onSignOut} />;
  }

  if (currentView === 'admin') {
    return (
      <AdminLogin
        onBack={() => setCurrentView('selection')}
        onLogin={() => {
          if (onAdminLoginSuccess) {
            onAdminLoginSuccess();
            return;
          }
          setCurrentView('adminDashboard');
        }}
      />
    );
  }

  if (currentView === 'adminDashboard') {
    return (
      <AdminDashboard
        onLogout={() => {
          if (onSignOut) {
            onSignOut();
            return;
          }
          setCurrentView('selection');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#112a1d] p-4 relative overflow-hidden font-sans">
      <div className="absolute inset-0 opacity-5 pointer-events-none bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]" />

      <div className="w-full max-w-md p-10 rounded-[2rem] border border-white/10 bg-white/[0.03] backdrop-blur-md shadow-2xl relative z-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white font-serif mb-2">
            Welcome Back
          </h1>
          <p className="text-sm text-gray-400">
            Sign in to your portal or browse the market as a guest.
          </p>
        </div>

        <div className="space-y-4">
          <div
            onClick={() => setCurrentView('buyer')}
            className="flex items-center justify-between p-5 rounded-2xl bg-white/[0.04] border border-white/[0.05] cursor-pointer hover:bg-white/[0.08] transition duration-200"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-950/50 text-emerald-400 border border-emerald-500/10 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <div className="text-left">
                <h3 className="text-white font-semibold text-base">Buyer Portal</h3>
                <p className="text-gray-400 text-xs mt-0.5">Browse properties & set preferences</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </div>

          <div
            onClick={() => setCurrentView('admin')}
            className="flex items-center justify-between p-5 rounded-2xl bg-white/[0.04] border border-white/[0.05] cursor-pointer hover:bg-white/[0.08] transition duration-200"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-950/30 text-yellow-600 border border-yellow-500/10 flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="text-left">
                <h3 className="text-white font-semibold text-base">Admin Dashboard</h3>
                <p className="text-gray-400 text-xs mt-0.5">Manage listings, buyers & transac...</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </div>
 
        </div>

        <div className="mt-8 pt-6 border-t border-white/[0.05] text-center text-sm text-gray-400">
          <span>Just looking? </span>
          <span
            onClick={() => {
              if (onBrowse) {
                onBrowse();
                return;
              }
              setCurrentView('browse');
            }}
            className="text-emerald-400 font-medium underline underline-offset-4 cursor-pointer hover:text-emerald-300 transition"
          >
            Browse without signing in
          </span>
        </div>
      </div>
    </div>
  );
};

export default MainLoginPortal;