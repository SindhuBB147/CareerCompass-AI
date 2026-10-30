'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { ApiError } from '../../../lib/api-client';
import { adminCutoffsApi, type BulkCutoffRow, type BulkUploadReport, type CutoffConflict } from '../../../lib/admin-api';
import { parseCsv } from '../../../lib/csv-export';
import { FileDropInput } from '../../../components/admin/FileDropInput';
import { AdminTable, type AdminTableColumn } from '../../../components/admin/AdminTable';

const CSV_COLUMNS = ['collegeId', 'courseId', 'examCode', 'year', 'round', 'category', 'openingRank', 'closingRank', 'seatsAvailable'];

function csvRowToCutoff(row: Record<string, string>): BulkCutoffRow | null {
  if (!row.collegeId || !row.courseId || !row.examCode || !row.closingRank) return null;
  return {
    collegeId: row.collegeId, courseId: row.courseId, examCode: row.examCode.toUpperCase(),
    year: Number(row.year), round: Number(row.round || 1), category: row.category || 'GM',
    openingRank: row.openingRank ? Number(row.openingRank) : undefined,
    closingRank: Number(row.closingRank),
    seatsAvailable: row.seatsAvailable ? Number(row.seatsAvailable) : undefined,
  };
}

function CutoffsAdminContent() {
  const { adminToken } = useAdminAuth();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<'upload' | 'conflicts'>(searchParams.get('action') === 'upload' ? 'upload' : 'conflicts');

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<BulkCutoffRow[]>([]);
  const [report, setReport] = useState<BulkUploadReport | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [conflicts, setConflicts] = useState<CutoffConflict[]>([]);
  const [isLoadingConflicts, setIsLoadingConflicts] = useState(true);

  const loadConflicts = () => {
    if (!adminToken) return;
    setIsLoadingConflicts(true);
    adminCutoffsApi.listConflicts(adminToken)
      .then(data => setConflicts(Array.isArray(data) ? data : data.conflicts))
      .catch(() => setConflicts([]))
      .finally(() => setIsLoadingConflicts(false));
  };

  useEffect(() => { if (tab === 'conflicts') loadConflicts(); }, [tab, adminToken]);

  const handleFile = (file: File) => {
    setFileName(file.name);
    setReport(null);
    setUploadError(null);
    file.text().then(text => {
      const rows = parseCsv(text).map(csvRowToCutoff).filter((r): r is BulkCutoffRow => r !== null);
      setParsedRows(rows);
    });
  };

  const handleUpload = async () => {
    if (!adminToken || parsedRows.length === 0) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const result = await adminCutoffsApi.bulkUpload(adminToken, parsedRows);
      setReport(result);
      setParsedRows([]);
      setFileName(null);
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : 'Bulk upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleResolve = async (conflict: CutoffConflict, value: number) => {
    if (!adminToken) return;
    try {
      await adminCutoffsApi.resolveConflict(adminToken, conflict.id || conflict._id, value);
      loadConflicts();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Could not resolve conflict.');
    }
  };

  const conflictColumns: AdminTableColumn<CutoffConflict>[] = [
    { key: 'college', label: 'College', render: c => c.collegeId },
    { key: 'course', label: 'Course', render: c => c.courseId },
    { key: 'exam', label: 'Exam', render: c => <span className="admin-status-badge admin-status-info">{c.examCode}</span> },
    { key: 'category', label: 'Category', render: c => c.category },
    { key: 'year', label: 'Year/Round', render: c => `${c.year} · R${c.round}` },
    { key: 'existing', label: 'Existing', render: c => `#${c.existingValue}` },
    { key: 'incoming', label: 'Incoming', render: c => `#${c.incomingValue}` },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="admin-page-header">
        <div>
          <h1 className="font-serif admin-page-title">Cutoffs — KCET · COMEDK · NEET</h1>
          <p className="admin-page-subtitle">Bulk upload multi-year, round-wise, category-wise closing ranks and resolve data conflicts.</p>
        </div>
      </div>

      <div className="admin-tabs">
        <button className="admin-tab" data-active={tab === 'upload'} onClick={() => setTab('upload')}>Bulk Upload</button>
        <button className="admin-tab" data-active={tab === 'conflicts'} onClick={() => setTab('conflicts')}>
          Conflicts {conflicts.length > 0 ? `(${conflicts.length})` : ''}
        </button>
      </div>

      {tab === 'upload' && (
        <div className="card-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '720px' }}>
          <div>
            <h3 className="font-serif" style={{ fontSize: '18px', margin: 0 }}>Upload Cutoff CSV</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Required columns: <code>{CSV_COLUMNS.join(', ')}</code>. Works for KCET, COMEDK, and NEET rows in the same file — set the <code>examCode</code> column per row.
            </p>
          </div>

          <FileDropInput accept=".csv" label="Choose or drop a CSV file" hint="Category-wise, round-wise closing ranks" selectedFileName={fileName} onFileSelected={handleFile} />

          {parsedRows.length > 0 && (
            <div className="admin-inline-message" data-tone="success">{parsedRows.length} valid row{parsedRows.length === 1 ? '' : 's'} parsed and ready to upload.</div>
          )}
          {uploadError && <div className="admin-inline-message" data-tone="error">{uploadError}</div>}

          <button className="btn-editorial-primary" disabled={parsedRows.length === 0 || isUploading} onClick={handleUpload} style={{ alignSelf: 'flex-start' }}>
            {isUploading ? 'Processing…' : `Process ${parsedRows.length || ''} Row${parsedRows.length === 1 ? '' : 's'}`}
          </button>

          {report && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <tbody>
                  <tr><td>Total Rows</td><td>{report.totalRows}</td></tr>
                  <tr><td>Accepted</td><td>{report.accepted}</td></tr>
                  <tr><td>Rejected</td><td>{report.rejected}</td></tr>
                  <tr><td>Conflicts Created</td><td>{report.conflictsCreated}</td></tr>
                </tbody>
              </table>
              {report.rejectedRows.length > 0 && (
                <ul style={{ fontSize: '12px', color: '#B4232E', marginTop: '12px' }}>
                  {report.rejectedRows.map((r, idx) => <li key={idx}>Row {r.row}: {r.reason}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'conflicts' && (
        <AdminTable
          columns={conflictColumns}
          rows={conflicts}
          rowKey={c => c.id || c._id}
          isLoading={isLoadingConflicts}
          emptyMessage="No open cutoff conflicts — all clear."
          rowActions={conflict => (
            <>
              <button className="admin-table-action-btn" onClick={() => handleResolve(conflict, conflict.existingValue)}>Keep Existing ({conflict.existingValue})</button>
              <button className="admin-table-action-btn" onClick={() => handleResolve(conflict, conflict.incomingValue)}>Accept Incoming ({conflict.incomingValue})</button>
            </>
          )}
        />
      )}
    </div>
  );
}

export default function CutoffsAdminPage() {
  return (
    <Suspense fallback={<div className="admin-loading">Loading…</div>}>
      <CutoffsAdminContent />
    </Suspense>
  );
}
