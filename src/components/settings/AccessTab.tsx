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
      <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-lg text-neutral-600">
        Only the bookset owner can manage access.
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-neutral-900 mb-2">Access Grants</h2>
      <p className="mb-6 text-lg text-neutral-600">
        Share &quot;{activeBookset?.name}&quot; with other users.
      </p>

      <form
        onSubmit={handleGrant}
        className="mb-8 p-6 bg-white rounded-2xl border border-neutral-200 shadow-sm"
      >
        <h3 className="text-xl font-bold text-neutral-900 mb-4">Grant Access</h3>
        <div className="flex flex-col lg:flex-row gap-4 items-end">
          <div>
            <label className="block text-sm font-bold text-neutral-500 mb-1">User Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full lg:w-72 p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-neutral-500 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'viewer' | 'editor')}
              className="w-full lg:w-56 p-3 text-lg border-2 border-neutral-300 rounded-xl bg-neutral-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 outline-none"
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

      <h3 className="text-xl font-bold text-neutral-900 mb-2">Active Grants</h3>
      {grants.length === 0 ? (
        <p className="text-neutral-500">No active grants found.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <table className="min-w-full border-collapse">
            <thead className="bg-neutral-100">
              <tr>
                <th className="p-4 text-left text-base font-bold text-neutral-600">User ID</th>
                <th className="p-4 text-left text-base font-bold text-neutral-600">Role</th>
                <th className="p-4 text-left text-base font-bold text-neutral-600">Granted At</th>
                <th className="p-4 text-center text-base font-bold text-neutral-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 text-lg">
              {grants.map((grant) => (
                <tr key={grant.id}>
                  <td className="p-4 font-mono text-base text-neutral-600">{grant.userId}</td>
                  <td className="p-4 capitalize">{grant.role}</td>
                  <td className="p-4">{new Date(grant.createdAt).toLocaleDateString()}</td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleRevoke(grant.id)}
                      className="text-danger-700 hover:text-danger-700 underline font-bold"
                    >
                      Revoke
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
