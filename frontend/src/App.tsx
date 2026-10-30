import { useEffect, useState } from 'react';
import MainLoginPortal from './pages/Buyer/MainLoginPortal';
import BuyerPortal from './pages/Buyer/BuyerPortal';
import * as AuthService from './services/AuthService';
import { AUTH_UNAUTHORIZED_EVENT } from './utils/api';

type AppView = 'login' | 'buyerPortal';
type LoginInitialView = 'selection' | 'buyer' | 'admin';

export default function App() {
  const [view, setView] = useState<AppView>('login');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginInitialView, setLoginInitialView] = useState<LoginInitialView>('selection');
  // True while we're checking for an existing session on startup, so we
  // don't briefly flash the login screen before an auto-login completes.
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [sessionVerificationError, setSessionVerificationError] = useState('');
  const [sessionRetryToken, setSessionRetryToken] = useState(0);

  // Auto-login: if a token is already stored (from a previous visit),
  // verify it against the backend (/auth/me) and restore the session.
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      if (!AuthService.isAuthenticated()) {
        if (isMounted) setIsRestoringSession(false);
        return;
      }

      const verification = await AuthService.verifyToken();

      if (isMounted) {
        // Only buyer accounts are routed into the buyer portal here.
        // Admin sessions are handled separately via AdminLogin/MainLoginPortal.
        if (verification.status === 'authenticated' && verification.user.role === 'buyer') {
          setIsAuthenticated(true);
          setView('buyerPortal');
          setSessionVerificationError('');
        } else if (verification.status === 'unavailable') {
          setIsAuthenticated(false);
          setView('login');
          setSessionVerificationError('We could not verify your session. Check your connection and try again.');
        } else {
          setIsAuthenticated(false);
          setSessionVerificationError('');
        }
        setIsRestoringSession(false);
      }
    };

    restoreSession();
    return () => {
      isMounted = false;
    };
  }, [sessionRetryToken]);

  // If any API call comes back 401 (expired/invalid token), api.ts clears
  // the stored session and fires this event — drop back to the login screen.
  useEffect(() => {
    const handleUnauthorized = () => {
      setIsAuthenticated(false);
      setLoginInitialView('selection');
      setView('login');
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  const handleBrowse = () => {
    setIsAuthenticated(false);
    setView('buyerPortal');
  };

  const handleAuthSuccess = () => {
    setIsAuthenticated(true);
    setView('buyerPortal');
  };

  const handleGoToLogin = () => {
    setLoginInitialView('buyer');
    setView('login');
  };

  const handleGoToAdminLogin = () => {
    setLoginInitialView('admin');
    setView('login');
  };

  const handleSignOut = () => {
    AuthService.logout();
    setIsAuthenticated(false);
    setLoginInitialView('selection');
    setSessionVerificationError('');
    setView('login');
  };

  const handleRetrySessionVerification = () => {
    setSessionVerificationError('');
    setIsRestoringSession(true);
    setSessionRetryToken((current) => current + 1);
  };

  if (isRestoringSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F4ED]">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    );
  }

  if (sessionVerificationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F4ED] px-4">
        <div className="w-full max-w-md rounded-2xl border border-[#d6c7b2] bg-white p-6 text-center shadow-sm">
          <h1 className="font-serif text-xl font-semibold text-[#1C3A27]">Session verification unavailable</h1>
          <p className="mt-2 text-sm text-[#7c6a57]">{sessionVerificationError}</p>
          <button
            type="button"
            onClick={handleRetrySessionVerification}
            className="mt-5 rounded-xl bg-[#1C3A27] px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#254F35] focus-visible:outline-2 focus-visible:outline-[#1C3A27] focus-visible:outline-offset-2"
          >
            Retry verification
          </button>
        </div>
      </div>
    );
  }

  if (view === 'buyerPortal') {
    return (
      <BuyerPortal
        onGoToLogin={handleGoToLogin}
        onGoToAdminLogin={handleGoToAdminLogin}
        onSignOut={handleSignOut}
        isAuthenticated={isAuthenticated}
      />
    );
  }

  return (
    <MainLoginPortal
      onBrowse={handleBrowse}
      onGoToLogin={handleGoToLogin}
      onSignOut={handleSignOut}
      onAuthSuccess={handleAuthSuccess}
      initialView={loginInitialView}
    />
  );
}
