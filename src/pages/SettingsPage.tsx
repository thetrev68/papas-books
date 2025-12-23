import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AccountsTab from '../components/settings/AccountsTab';
import CategoriesTab from '../components/settings/CategoriesTab';
import RulesTab from '../components/settings/RulesTab';
import PayeesTab from '../components/settings/PayeesTab';
import AccessTab from '../components/settings/AccessTab';

export default function SettingsPage() {
  const { activeBookset } = useAuth();
  const [activeTab, setActiveTab] = useState<
    'accounts' | 'categories' | 'payees' | 'rules' | 'access'
  >('accounts');

  const tabs = [
    { id: 'accounts', label: 'Accounts' },
    { id: 'categories', label: 'Categories' },
    { id: 'payees', label: 'Payees' },
    { id: 'rules', label: 'Rules' },
    { id: 'access', label: 'Access' },
  ] as const;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-neutral-900">Settings - {activeBookset?.name}</h1>

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            disabled={activeTab === tab.id}
            className={`px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-brand-600 text-white shadow-md'
                : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
        {activeTab === 'accounts' && <AccountsTab />}
        {activeTab === 'categories' && <CategoriesTab />}
        {activeTab === 'payees' && <PayeesTab />}
        {activeTab === 'rules' && <RulesTab />}
        {activeTab === 'access' && <AccessTab />}
      </div>
    </div>
  );
}
