import { useEffect, useRef, useState } from 'react';
import MainLoginPortal from './pages/Buyer/MainLoginPortal';
import BuyerPortal from './pages/Buyer/BuyerPortal';
import * as AuthService from './services/AuthService';
import { AUTH_UNAUTHORIZED_EVENT } from './utils/api';
import ServerConnectionLoader from './components/ServerConnectionLoader';

type AppView = 'login' | 'buyerPortal';
type LoginInitialView = 'selection' | 'buyer' | 'admin';
const MIN_LOADING_DURATION_MS = import.meta.env.DEV ? 5000 : 0;

export default function App() {
  const [view, setView] = useState<AppView>('login');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginInitialView, setLoginInitialView] = useState<LoginInitialView>('selection');
  // True while we're checking for an existing session on startup, so we
  // don't briefly flash the login screen before an auto-login completes.
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [sessionVerificationError, setSessionVerificationError] = useState('');
  const [sessionRetryToken, setSessionRetryToken] = useState(0);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-login: if a token is already stored (from a previous visit),
  // verify it against the backend (/auth/me) and restore the session.
  useEffect(() => {
    let isMounted = true;
    const loadingStartedAt = performance.now();

    const waitForMinimumLoadingDuration = async () => {
      const elapsed = performance.now() - loadingStartedAt;
      const remaining = Math.max(0, MIN_LOADING_DURATION_MS - elapsed);
      if (remaining === 0) return;

      await new Promise<void>((resolve) => {
        loadingTimerRef.current = setTimeout(() => {
          loadingTimerRef.current = null;
          resolve();
        }, remaining);
      });
    };

    const restoreSession = async () => {
      if (!AuthService.isAuthenticated()) {
        await waitForMinimumLoadingDuration();
        if (isMounted) setIsRestoringSession(false);
        return;
      }

      const verification = await AuthService.verifyToken();
      await waitForMinimumLoadingDuration();

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
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
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
    return <ServerConnectionLoader />;
  }

  if (sessionVerificationError) {
    return <ServerConnectionLoader error={sessionVerificationError} onRetry={handleRetrySessionVerification} />;
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
