import { useState } from 'react';
import MainLoginPortal from './components/MainLoginPortal';
import BuyerPortal from './components/BuyerPortal';

type AppView = 'login' | 'buyerPortal';

export default function App() {
  const [view, setView] = useState<AppView>('login');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleBrowse = () => {
    setIsAuthenticated(false);
    setView('buyerPortal');
  };

  const handleAuthSuccess = () => {
    setIsAuthenticated(true);
    setView('buyerPortal');
  };

  const handleSignOut = () => {
    window.localStorage.removeItem('terraguide_currentBuyer');
    setIsAuthenticated(false);
    setView('login');
  };

  if (view === 'buyerPortal' || isAuthenticated) {
    return <BuyerPortal onSignIn={handleSignOut} isAuthenticated={isAuthenticated} />;
  }

  return (
    <MainLoginPortal
      onBrowse={handleBrowse}
      onSignIn={handleSignOut}
      onAuthSuccess={handleAuthSuccess}
    />
  );
}