import React, { useEffect, useState } from 'react';
import BuyerLogin from './BuyerLogin';
import AdminLogin from '../Admin/AdminLogin';
import AdminDashboard from '../Admin/AdminDashboard';

type MainLoginPortalProps = {
  onBackToGuest: () => void;
  onSignOut?: () => void;
  onAuthSuccess?: () => void;
  onAdminLoginSuccess?: () => void;
  initialView?: 'buyer' | 'admin';
};

const MainLoginPortal: React.FC<MainLoginPortalProps> = ({
  onBackToGuest,
  onSignOut,
  onAuthSuccess,
  onAdminLoginSuccess,
  initialView = 'buyer',
}) => {
  const [currentView, setCurrentView] = useState<'buyer' | 'admin' | 'adminDashboard'>(initialView);

  useEffect(() => {
    setCurrentView(initialView);
  }, [initialView]);

  const handleLogout = () => {
    if (onSignOut) {
      onSignOut();
    }
  };

  if (currentView === 'admin') {
    return (
      <AdminLogin
        onBack={onBackToGuest}
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
    return <AdminDashboard onLogout={handleLogout} />;
  }

  return (
    <BuyerLogin
      onBack={onBackToGuest}
      onSuccess={() => {
        if (onAuthSuccess) {
          onAuthSuccess();
          return;
        }
        onBackToGuest();
      }}
    />
  );
};

export default MainLoginPortal;
