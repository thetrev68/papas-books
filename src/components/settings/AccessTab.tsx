import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { grantAccessByEmail, listAccessGrants, revokeAccess } from '../../lib/supabase/access';
import { AccessGrant } from '../../types/access';

export default function AccessTab() {
  const { activeBookset, user } = useAuth();
  const isOwner = activeBookset?.owner_id === user?.id;
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (activeBookset && isOwner) {
      loadGrants();
    }
  }, [activeBookset, isOwner]);

  async function loadGrants() {
    if (!activeBookset) return;
    try {
      const data = await listAccessGrants(activeBookset.id);
      setGrants(data);
    } catch (err) {
      console.error('Failed to load grants:', err);
    }
  }

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    if (!activeBookset) return;
    setLoading(true);
    setMsg(null);

    try {
      const result = await grantAccessByEmail(activeBookset.id, email, role);
      if (result.success) {
        setMsg({ type: 'success', text: 'Access granted successfully.' });
        setEmail('');
        loadGrants();
      } else {
        setMsg({ type: 'error', text: result.message || 'Failed to grant access.' });
      }
    } catch (err) {
      console.error(err);
      setMsg({ type: 'error', text: 'An unexpected error occurred.' });
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(grantId: string) {
    if (!confirm('Are you sure you want to revoke access?')) return;
    try {
      await revokeAccess(grantId);
      loadGrants();
    } catch (err) {
      console.error('Failed to revoke access:', err);
      alert('Failed to revoke access.');
    }
  }

  if (!isOwner) {
    return (
      <div className="bg-neutral-50 dark:bg-gray-900 border border-neutral-200 dark:border-gray-700 rounded-xl p-4 text-lg text-neutral-600 dark:text-gray-400">
        Only the bookset owner can manage access.
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-neutral-900 dark:text-gray-100 mb-2">Access Grants</h2>
      <p className="mb-6 text-lg text-neutral-600 dark:text-gray-400">
        Share &quot;{activeBookset?.name}&quot; with other users.
      </p>

      <form
        onSubmit={handleGrant}
        className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-2xl border border-neutral-200 dark:border-gray-700 shadow-sm"
      >
        <h3 className="text-xl font-bold text-neutral-900 dark:text-gray-100 mb-4">Grant Access</h3>
        <div className="flex flex-col lg:flex-row gap-4 items-end">
          <div>
            <label className="block text-sm font-bold text-neutral-500 dark:text-gray-400 mb-1">
              User Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full lg:w-72 p-3 text-lg border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-neutral-50 dark:bg-gray-900 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-neutral-500 dark:text-gray-400 mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'viewer' | 'editor')}
              className="w-full lg:w-56 p-3 text-lg border-2 border-neutral-300 dark:border-gray-600 rounded-xl bg-neutral-50 dark:bg-gray-900 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
            >
              <option value="viewer">Viewer (Read-only)</option>
              <option value="editor">Editor (Read/Write)</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-brand-600 text-white font-bold rounded-xl shadow hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? 'Granting...' : 'Grant Access'}
          </button>
        </div>
        {msg && (
          <div
            className={`mt-3 text-lg font-semibold ${
              msg.type === 'error' ? 'text-danger-700' : 'text-success-700'
            }`}
          >
            {msg.text}
          </div>
        )}
      </form>

      <h3 className="text-xl font-bold text-neutral-900 dark:text-gray-100 mb-2">Active Grants</h3>
      {grants.length === 0 ? (
        <p className="text-neutral-500 dark:text-gray-400">No active grants found.</p>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-neutral-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <table className="min-w-full border-collapse">
            <thead className="bg-neutral-100 dark:bg-gray-900">
              <tr>
                <th className="p-4 text-left text-base font-bold text-neutral-600 dark:text-gray-400">
                  User ID
                </th>
                <th className="p-4 text-left text-base font-bold text-neutral-600 dark:text-gray-400">
                  Role
                </th>
                <th className="p-4 text-left text-base font-bold text-neutral-600 dark:text-gray-400">
                  Granted At
                </th>
                <th className="p-4 text-center text-base font-bold text-neutral-600 dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-gray-700 text-lg">
              {grants.map((grant) => (
                <tr key={grant.id}>
                  <td className="p-4 font-mono text-base text-neutral-600 dark:text-gray-400">
                    {grant.userId}
                  </td>
                  <td className="p-4 capitalize">{grant.role}</td>
                  <td className="p-4">{new Date(grant.createdAt).toLocaleDateString()}</td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleRevoke(grant.id)}
                      className="p-2 text-neutral-400 hover:text-danger-700 transition-colors"
                      title="Revoke Access"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-2.14-1.928L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        ></path>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
