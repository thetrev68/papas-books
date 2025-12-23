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
    return <div>Only the bookset owner can manage access.</div>;
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Access Grants</h2>
      <p className="mb-4 text-gray-600">
        Share &quot;{activeBookset?.name}&quot; with other users.
      </p>

      <form onSubmit={handleGrant} className="mb-8 p-4 bg-gray-50 rounded border">
        <h3 className="text-lg font-semibold mb-2">Grant Access</h3>
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">User Email:</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border p-2 rounded w-64"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Role:</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'viewer' | 'editor')}
              className="border p-2 rounded"
            >
              <option value="viewer">Viewer (Read-only)</option>
              <option value="editor">Editor (Read/Write)</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Granting...' : 'Grant Access'}
          </button>
        </div>
        {msg && (
          <div
            className={`mt-2 text-sm ${msg.type === 'error' ? 'text-red-600' : 'text-green-600'}`}
          >
            {msg.text}
          </div>
        )}
      </form>

      <h3 className="text-lg font-semibold mb-2">Active Grants</h3>
      {grants.length === 0 ? (
        <p className="text-gray-500">No active grants found.</p>
      ) : (
        <table className="min-w-full border">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2 text-left">User ID</th>
              <th className="border p-2 text-left">Role</th>
              <th className="border p-2 text-left">Granted At</th>
              <th className="border p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {grants.map((grant) => (
              <tr key={grant.id}>
                <td className="border p-2 font-mono text-sm">{grant.userId}</td>
                <td className="border p-2 capitalize">{grant.role}</td>
                <td className="border p-2">{new Date(grant.createdAt).toLocaleDateString()}</td>
                <td className="border p-2 text-center">
                  <button
                    onClick={() => handleRevoke(grant.id)}
                    className="text-red-600 hover:text-red-800 underline text-sm"
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
