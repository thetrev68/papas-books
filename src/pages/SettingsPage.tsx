import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AppNav from '../components/AppNav';

export default function SettingsPage() {
  const { activeBookset } = useAuth();
  const [activeTab, setActiveTab] = useState<'accounts' | 'categories' | 'rules' | 'access'>('accounts');

  return (
    <div>
      <AppNav />
      <div style={{ padding: '2rem' }}>
        <h1>Settings - {activeBookset?.name}</h1>
        
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <button onClick={() => setActiveTab('accounts')} disabled={activeTab === 'accounts'}>Accounts</button>
          <button onClick={() => setActiveTab('categories')} disabled={activeTab === 'categories'}>Categories</button>
          <button onClick={() => setActiveTab('rules')} disabled={activeTab === 'rules'}>Rules</button>
          <button onClick={() => setActiveTab('access')} disabled={activeTab === 'access'}>Access</button>
        </div>

        <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '4px' }}>
          {activeTab === 'accounts' && <div>Accounts content (Phase 2)</div>}
          {activeTab === 'categories' && <div>Categories content (Phase 2)</div>}
          {activeTab === 'rules' && <div>Rules content (Phase 4)</div>}
          {activeTab === 'access' && (
            <div>
              <h3>Access Grants</h3>
              <p>Grant access functionality coming in Phase 2</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
