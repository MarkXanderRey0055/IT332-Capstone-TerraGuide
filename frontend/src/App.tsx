import { useState } from 'react';
import MainLoginPortal from './components/MainLoginPortal';
import BuyerPortal from './components/BuyerPortal';

type AppView = 'login' | 'buyerPortal';

export default function App() {
  const [view, setView] = useState<AppView>('login');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return Boolean(window.localStorage.getItem('terraguide_currentBuyer'));
  });

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
      onBrowse={() => setView('buyerPortal')}
      onSignIn={handleSignOut}
      onAuthSuccess={() => {
        setIsAuthenticated(true);
        setView('buyerPortal');
      }}
    />
  );
}