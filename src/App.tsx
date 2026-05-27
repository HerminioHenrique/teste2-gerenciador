import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { 
  doc, 
  onSnapshot
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile } from './types';
import Layout from './components/Layout';
import Login from './components/Login';
import ManagerDashboard from './components/ManagerDashboard';
import ClientDashboard from './components/ClientDashboard';
import ClientManagement from './components/ClientManagement';
import PayerDashboard from './components/PayerDashboard';

import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<{ type: 'dashboard' | 'client-detail'; clientId?: string }>({ type: 'dashboard' });

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        unsubProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (snapshot) => {
          if (snapshot.exists()) {
            setUser(snapshot.data() as UserProfile);
          }
          setLoading(false);
        });
      } else {
        if (unsubProfile) unsubProfile();
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setView({ type: 'dashboard' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={(u) => setUser(u)} />;
  }

  return (
    <ErrorBoundary>
      <Layout user={user} onLogout={handleLogout}>
        {user.role === 'manager' ? (
          view.type === 'dashboard' ? (
            <ManagerDashboard 
              manager={user} 
              onSelectClient={(id) => setView({ type: 'client-detail', clientId: id })} 
            />
          ) : (
            <ClientManagement 
              manager={user} 
              clientId={view.clientId!} 
              onBack={() => setView({ type: 'dashboard' })} 
            />
          )
        ) : user.role === 'payer' ? (
          <PayerDashboard payer={user} />
        ) : (
          <ClientDashboard client={user} />
        )}
      </Layout>
    </ErrorBoundary>
  );
}
