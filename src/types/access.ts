export interface AccessGrant {
  id: string;
  booksetId: string;
  userId: string;
  role: 'viewer' | 'editor';
  grantedBy: string;
  revokedAt?: string | null;
  createdAt: string;
}

export interface GrantAccessResult {
  success: boolean;
  grantId?: string;
  message?: string;
}
