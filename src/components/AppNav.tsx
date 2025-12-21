import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AppNav() {
  const { user, activeBookset, myBooksets, switchBookset, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <nav
      style={{
        padding: '1rem',
        borderBottom: '1px solid #ccc',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <strong>Papa&apos;s Books</strong>
        <Link to="/app/dashboard">Dashboard</Link>
        <Link to="/app/workbench">Workbench</Link>
        <Link to="/app/import">Import</Link>
        <Link to="/app/reconcile">Reconcile</Link>
        <Link to="/app/reports">Reports</Link>
        <Link to="/app/settings">Settings</Link>
      </div>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        {user && (
          <select
            value={activeBookset?.id || ''}
            onChange={(e) => switchBookset(e.target.value)}
            style={{ padding: '0.25rem' }}
          >
            {myBooksets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} {b.owner_id === user.id ? '(Mine)' : '(Shared)'}
              </option>
            ))}
          </select>
        )}
        <span>{user?.display_name || user?.email}</span>
        <button onClick={handleSignOut}>Sign Out</button>
      </div>
    </nav>
  );
}
