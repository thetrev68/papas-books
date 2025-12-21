import React from 'react';
import { useAuth } from '../context/AuthContext';
import AppNav from '../components/AppNav';

export default function DashboardPage() {
  const { activeBookset } = useAuth();

  return (
    <div>
      <AppNav />
      <div style={{ padding: '2rem' }}>
        <h1>Dashboard - {activeBookset?.name || 'Loading...'}</h1>
        <p>Account summaries will appear here in Phase 2+</p>
      </div>
    </div>
  );
}
