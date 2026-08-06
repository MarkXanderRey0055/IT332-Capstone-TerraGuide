import { useEffect, useState } from 'react';
import MainLoginPortal from './pages/Buyer/MainLoginPortal';
import BuyerPortal from './pages/Buyer/BuyerPortal';
import * as AuthService from './services/AuthService';
import { AUTH_UNAUTHORIZED_EVENT } from './utils/api';

type AppView = 'login' | 'buyerPortal';
type LoginInitialView = 'selection' | 'buyer';

export default function App() {
  const [view, setView] = useState<AppView>('login');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginInitialView, setLoginInitialView] = useState<LoginInitialView>('selection');
  // True while we're checking for an existing session on startup, so we
  // don't briefly flash the login screen before an auto-login completes.
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  // Auto-login: if a token is already stored (from a previous visit),
  // verify it against the backend (/auth/me) and restore the session.
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      if (!AuthService.isAuthenticated()) {
        if (isMounted) setIsRestoringSession(false);
        return;
      }

      const user = await AuthService.verifyToken();

      if (isMounted) {
        // Only buyer accounts are routed into the buyer portal here.
        // Admin sessions are handled separately via AdminLogin/MainLoginPortal.
        if (user && user.role === 'buyer') {
          setIsAuthenticated(true);
          setView('buyerPortal');
        }
        setIsRestoringSession(false);
      }
    };

    restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

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

  const handleSignOut = () => {
    AuthService.logout();
    setIsAuthenticated(false);
    setLoginInitialView('selection');
    setView('login');
  };

  if (isRestoringSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F4ED]">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    );
  }

  if (view === 'buyerPortal' || isAuthenticated) {
    return (
      <BuyerPortal
        onGoToLogin={handleGoToLogin}
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