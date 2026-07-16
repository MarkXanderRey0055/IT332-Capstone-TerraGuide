import { useState } from 'react';
import MainLoginPortal from './pages/Buyer/MainLoginPortal';
import BuyerPortal from './pages/Buyer/BuyerPortal';

type AppView = 'login' | 'buyerPortal';
type LoginInitialView = 'selection' | 'buyer';

export default function App() {
  const [view, setView] = useState<AppView>('login');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginInitialView, setLoginInitialView] = useState<LoginInitialView>('selection');

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
    window.localStorage.removeItem('terraguide_currentBuyer');
    setIsAuthenticated(false);
    setLoginInitialView('selection');
    setView('login');
  };

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
