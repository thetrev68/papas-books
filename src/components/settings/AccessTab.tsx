import { useAuth } from '../../context/AuthContext';

export default function AccessTab() {
  const { activeBookset, user } = useAuth();
  const isOwner = activeBookset?.owner_id === user?.id;

  if (!isOwner) {
    return <div>Only the bookset owner can manage access.</div>;
  }

  return (
    <div>
      <h2>Access Grants</h2>
      <p>Multi-user access management coming in future phase.</p>
      <p>This bookset is owned by: {activeBookset?.name}</p>
    </div>
  );
}
