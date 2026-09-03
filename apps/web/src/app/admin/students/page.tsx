'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { ApiError } from '../../../lib/api-client';
import { adminStudentsApi, type AdminUserSummary } from '../../../lib/admin-api';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { AdminTable, type AdminTableColumn } from '../../../components/admin/AdminTable';

const STATUS_TONE: Record<string, string> = { active: 'admin-status-success', suspended: 'admin-status-warning', deleted: 'admin-status-danger' };

export default function StudentsAdminPage() {
  const { adminToken } = useAdminAuth();
  const [students, setStudents] = useState<AdminUserSummary[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 350);

  const load = useCallback(() => {
    if (!adminToken) return;
    setIsLoading(true);
    const isEmail = debouncedSearch.includes('@');
    adminStudentsApi.search(adminToken, {
      email: isEmail ? debouncedSearch : undefined,
      phone: !isEmail ? debouncedSearch || undefined : undefined,
      accountStatus: statusFilter || undefined,
      page, limit: 15,
    })
      .then(res => { setStudents(res.users); setTotalResults(res.totalResults); })
      .catch(() => { setStudents([]); setTotalResults(0); })
      .finally(() => setIsLoading(false));
  }, [adminToken, debouncedSearch, statusFilter, page]);

  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter]);
  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (student: AdminUserSummary, status: string) => {
    if (!adminToken) return;
    const reason = prompt(`Reason for marking this student "${status}"?`, status === 'suspended' ? 'Policy violation' : 'Reactivated by support');
    if (reason === null) return;
    try {
      await adminStudentsApi.updateStatus(adminToken, student.id || student._id, status, reason);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Could not update status.');
    }
  };

  const columns: AdminTableColumn<AdminUserSummary>[] = [
    { key: 'name', label: 'Name', render: s => s.fullName },
    { key: 'contact', label: 'Contact', render: s => s.email || s.phone || '—' },
    { key: 'category', label: 'Category', render: s => s.category ?? '—' },
    { key: 'state', label: 'State', render: s => s.domicileState ?? '—' },
    { key: 'exams', label: 'Exam Profiles', render: s => s.examProfiles?.map(e => e.examCode).join(', ') || '—' },
    { key: 'status', label: 'Status', render: s => <span className={`admin-status-badge ${STATUS_TONE[s.accountStatus]}`}>{s.accountStatus}</span> },
    { key: 'joined', label: 'Joined', render: s => new Date(s.createdAt).toLocaleDateString() },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="admin-page-header">
        <div>
          <h1 className="font-serif admin-page-title">Students</h1>
          <p className="admin-page-subtitle">Search students by email or phone, and manage account status.</p>
        </div>
      </div>

      <AdminTable
        columns={columns}
        rows={students}
        rowKey={s => s.id || s._id}
        isLoading={isLoading}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by email or phone…"
        toolbarActions={
          <select className="input-editorial" style={{ width: 'auto', padding: '9px 14px', fontSize: '13px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="deleted">Deleted</option>
          </select>
        }
        totalCount={totalResults}
        exportFilename="students"
        emptyMessage="No students match this search."
        rowActions={student => (
          <>
            {student.accountStatus !== 'active' && <button className="admin-table-action-btn" onClick={() => handleStatusChange(student, 'active')}>Activate</button>}
            {student.accountStatus !== 'suspended' && <button className="admin-table-action-btn" onClick={() => handleStatusChange(student, 'suspended')}>Suspend</button>}
            {student.accountStatus !== 'deleted' && <button className="admin-table-action-btn" data-danger="true" onClick={() => handleStatusChange(student, 'deleted')}>Delete</button>}
          </>
        )}
      />
    </div>
  );
}
