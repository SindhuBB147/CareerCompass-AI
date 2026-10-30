'use client';

import React, { useState } from 'react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { ApiError } from '../../lib/api-client';
import { adminSecurityApi } from '../../lib/admin-api';
import { AdminModal } from './AdminModal';

// Shared step-up auth prompt for any @RequireReauth()-guarded backend action
// (archive college, delete admin, force-disable a user, …). The caller
// retries its own request with the returned reauthToken — this component
// only owns the password prompt, not the retry.
export function ReauthModal({ actionLabel, onConfirm, onCancel }: {
  actionLabel: string;
  onConfirm: (reauthToken: string) => void;
  onCancel: () => void;
}) {
  const { adminToken } = useAdminAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !password) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const { reauthToken } = await adminSecurityApi.reauth(adminToken, password);
      onConfirm(reauthToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Incorrect password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminModal title="Confirm Your Password" onClose={onCancel} onSubmit={handleSubmit} isSubmitting={isSubmitting} error={error} submitLabel="Confirm">
      <div className="admin-form-grid">
        <div className="admin-form-group" data-span="2">
          <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            "{actionLabel}" is a sensitive action — re-enter your password to continue.
          </p>
          <label className="admin-form-label" htmlFor="reauth-password">Password</label>
          <input
            id="reauth-password" type="password" className="input-editorial" autoFocus
            value={password} onChange={e => setPassword(e.target.value)} required
          />
        </div>
      </div>
    </AdminModal>
  );
}
