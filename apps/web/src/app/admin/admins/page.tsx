'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { ApiError } from '../../../lib/api-client';
import { adminAccountsApi, type AdminAccount, type AdminRole } from '../../../lib/admin-api';
import { AdminTable, type AdminTableColumn } from '../../../components/admin/AdminTable';
import { AdminModal } from '../../../components/admin/AdminModal';

const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin', data_manager: 'Data Manager',
  support_agent: 'Support Agent', b2b_account_manager: 'B2B Account Manager',
  counsellor: 'Counsellor', moderator: 'Moderator', data_entry_operator: 'Data Entry Operator',
  content_manager: 'Content Manager', ai_manager: 'AI Manager',
};

interface FormState { name: string; email: string; password: string; role: AdminRole; permissions: string[]; isActive: boolean; }
const EMPTY_FORM: FormState = { name: '', email: '', password: '', role: 'data_manager', permissions: [], isActive: true };

export default function AdminsAdminPage() {
  const { admin, adminToken } = useAdminAuth();
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [allPermissions, setAllPermissions] = useState<string[]>([]);
  const [allRoles, setAllRoles] = useState<AdminRole[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!adminToken) return;
    setIsLoading(true);
    adminAccountsApi.list(adminToken, { page: 1, limit: 50 })
      .then(res => { setAdmins(res.admins); setTotalResults(res.totalResults); })
      .catch(() => { setAdmins([]); setTotalResults(0); })
      .finally(() => setIsLoading(false));
  }, [adminToken]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!adminToken) return;
    adminAccountsApi.listPermissions(adminToken).then(res => { setAllPermissions(res.permissions); setAllRoles(res.roles); }).catch(() => {});
  }, [adminToken]);

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setFormError(null); setShowForm(true); };
  const openEdit = (a: AdminAccount) => {
    setEditingId(a.id || a._id);
    setForm({ name: a.name, email: a.email, password: '', role: a.role, permissions: a.permissions, isActive: a.isActive });
    setFormError(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      if (editingId) {
        await adminAccountsApi.update(adminToken, editingId, { name: form.name, role: form.role, permissions: form.permissions, isActive: form.isActive });
      } else {
        await adminAccountsApi.create(adminToken, { name: form.name, email: form.email, password: form.password, role: form.role, permissions: form.permissions });
      }
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save admin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (a: AdminAccount) => {
    if (!adminToken || !confirm(`Reset password for ${a.email}? A new temporary password will be generated.`)) return;
    try {
      const result = await adminAccountsApi.resetPassword(adminToken, a.id || a._id);
      setMessage(`Temporary password for ${a.email}: ${result.temporaryPassword} — share this securely; it will not be shown again.`);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Reset failed.');
    }
  };

  const handleDelete = async (a: AdminAccount) => {
    if (!adminToken || !confirm(`Delete admin account "${a.email}"?`)) return;
    try { await adminAccountsApi.remove(adminToken, a.id || a._id); load(); }
    catch (err) { alert(err instanceof ApiError ? err.message : 'Delete failed.'); }
  };

  const togglePermission = (perm: string) => {
    setForm(prev => ({ ...prev, permissions: prev.permissions.includes(perm) ? prev.permissions.filter(p => p !== perm) : [...prev.permissions, perm] }));
  };

  const columns: AdminTableColumn<AdminAccount>[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: a => <span className="admin-status-badge admin-status-info">{ROLE_LABELS[a.role]}</span> },
    { key: 'permissions', label: 'Extra Permissions', render: a => a.permissions.length ? a.permissions.join(', ') : '— (role defaults)' },
    { key: 'status', label: 'Status', render: a => <span className={`admin-status-badge ${a.isActive ? 'admin-status-success' : 'admin-status-neutral'}`}>{a.isActive ? 'Active' : 'Inactive'}</span> },
    { key: 'lastLogin', label: 'Last Login', render: a => a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString() : 'Never' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="admin-page-header">
        <div>
          <h1 className="font-serif admin-page-title">Admins & Permissions</h1>
          <p className="admin-page-subtitle">Manage admin accounts, roles, and per-account permission overrides. Super Admin only.</p>
        </div>
      </div>

      {message && <div className="admin-inline-message" data-tone="success">{message}</div>}

      <AdminTable
        columns={columns}
        rows={admins}
        rowKey={a => a.id || a._id}
        isLoading={isLoading}
        toolbarActions={<button className="btn-editorial-primary" style={{ padding: '9px 18px', fontSize: '13px' }} onClick={openCreate}>+ Add Admin</button>}
        totalCount={totalResults}
        exportFilename="admins"
        rowActions={a => (
          <>
            <button className="admin-table-action-btn" onClick={() => openEdit(a)}>Edit</button>
            <button className="admin-table-action-btn" onClick={() => handleResetPassword(a)}>Reset Password</button>
            <button className="admin-table-action-btn" data-danger="true" disabled={a.email === admin?.email} onClick={() => handleDelete(a)}>Delete</button>
          </>
        )}
      />

      {showForm && (
        <AdminModal title={editingId ? 'Edit Admin' : 'Add Admin'} onClose={() => setShowForm(false)} onSubmit={handleSubmit} isSubmitting={isSubmitting} error={formError} submitLabel={editingId ? 'Save Changes' : 'Create Admin'}>
          <div className="admin-form-grid">
            <div className="admin-form-group">
              <label className="admin-form-label">Full Name</label>
              <input className="input-editorial" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Email</label>
              <input type="email" className="input-editorial" required disabled={!!editingId} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            {!editingId && (
              <div className="admin-form-group" data-span="2">
                <label className="admin-form-label">Temporary Password</label>
                <input type="text" className="input-editorial" required minLength={10} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                <span className="admin-form-hint">At least 10 characters. The admin should change it after first login.</span>
              </div>
            )}
            <div className="admin-form-group">
              <label className="admin-form-label">Role</label>
              <select className="input-editorial" value={form.role} onChange={e => setForm({ ...form, role: e.target.value as AdminRole })}>
                {(allRoles.length ? allRoles : Object.keys(ROLE_LABELS) as AdminRole[]).map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            {editingId && (
              <div className="admin-checkbox-row">
                <input type="checkbox" className="admin-checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
                <label>Active</label>
              </div>
            )}
            <div className="admin-form-group" data-span="2">
              <label className="admin-form-label">Extra Permissions (beyond role defaults)</label>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                {allPermissions.map(perm => (
                  <label key={perm} className="admin-checkbox-row">
                    <input type="checkbox" className="admin-checkbox" checked={form.permissions.includes(perm)} onChange={() => togglePermission(perm)} />
                    {perm}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}
