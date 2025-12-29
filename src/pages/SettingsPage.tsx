import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AccountsTab from '../components/settings/AccountsTab';
import CategoriesTab from '../components/settings/CategoriesTab';
import RulesTab from '../components/settings/RulesTab';
import PayeesTab from '../components/settings/PayeesTab';
import AccessTab from '../components/settings/AccessTab';
import ThemeToggle from '../components/ThemeToggle';

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-gray-100">
          Settings - {activeBookset?.name}
        </h1>
        <ThemeToggle />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            disabled={activeTab === tab.id}
            className={`px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-brand-600 text-white shadow-md'
                : 'bg-white dark:bg-gray-800 text-neutral-600 dark:text-gray-300 border border-neutral-200 dark:border-gray-700 hover:bg-neutral-50 dark:hover:bg-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-neutral-200 dark:border-gray-700 shadow-sm p-6">
        {activeTab === 'accounts' && <AccountsTab />}
        {activeTab === 'categories' && <CategoriesTab />}
        {activeTab === 'payees' && <PayeesTab />}
        {activeTab === 'rules' && <RulesTab />}
        {activeTab === 'access' && <AccessTab />}
      </div>
    </div>
  );
}
