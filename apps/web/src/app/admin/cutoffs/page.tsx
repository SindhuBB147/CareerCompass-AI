'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { ApiError } from '../../../lib/api-client';
import {
  adminCutoffsApi, type BulkCutoffRow, type BulkUploadReport, type CutoffConflict, type CutoffDashboardStats,
  type CutoffImportLog, type RejectReasonCode, type RowPreview, type ValidateRowsResult,
} from '../../../lib/admin-api';
import { parseCsv } from '../../../lib/csv-export';
import { FileDropInput } from '../../../components/admin/FileDropInput';
import { AdminTable, type AdminTableColumn } from '../../../components/admin/AdminTable';
import { StatCard } from '../../../components/admin/StatCard';
import { AddCutoffTab } from './AddCutoffTab';

const CSV_COLUMNS = ['collegeId', 'courseId', 'examCode', 'year', 'round', 'category', 'branch', 'closingRank'];
const ACCEPTED_EXTENSIONS = ['csv', 'xlsx', 'xls'];

const REASON_LABEL: Record<RejectReasonCode, string> = {
  missing_fields: 'Missing required fields',
  unmatched_exam: 'Unrecognized exam',
  unmatched_college: 'Unmatched college',
  unmatched_course: 'Unmatched course',
  archived_conflict: 'Matches an archived record',
  other: 'Other',
};

const PREVIEW_STATUS_LABEL: Record<RowPreview['status'], { icon: string; label: string; tone: string }> = {
  valid: { icon: '✓', label: 'Valid', tone: 'admin-status-success' },
  needs_review: { icon: '⚠', label: 'Needs Review', tone: 'admin-status-warning' },
  invalid: { icon: '✕', label: 'Invalid', tone: 'admin-status-danger' },
  unmatched_college: { icon: '✕', label: 'Unmatched College', tone: 'admin-status-danger' },
  unmatched_course: { icon: '✕', label: 'Unmatched Course', tone: 'admin-status-danger' },
};

function csvRowToCutoff(row: Record<string, string>): BulkCutoffRow | null {
  if (!row.collegeId || !row.courseId || !row.examCode || !row.closingRank) return null;
  return {
    collegeId: row.collegeId.trim(),
    courseId: row.courseId.trim(),
    courseName: row.courseName?.trim() || row.course?.trim(),
    examCode: row.examCode.trim().toUpperCase(),
    year: Number(row.year) || new Date().getFullYear(),
    round: Number(row.round || 1),
    category: row.category?.trim() || 'GM',
    branch: row.branch?.trim(),
    closingRank: Number(row.closingRank),
  };
}

function CutoffsAdminContent() {
  const { adminToken } = useAdminAuth();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<'dashboard' | 'add' | 'upload' | 'history' | 'conflicts'>(
    searchParams.get('action') === 'upload' ? 'upload' : searchParams.get('action') === 'add' ? 'add' : 'dashboard'
  );

  const [dashboard, setDashboard] = useState<CutoffDashboardStats | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);

  const loadDashboard = () => {
    if (!adminToken) return;
    setIsLoadingDashboard(true);
    adminCutoffsApi.getDashboard(adminToken)
      .then(setDashboard)
      .catch(() => setDashboard(null))
      .finally(() => setIsLoadingDashboard(false));
  };

  useEffect(() => {
    if (tab === 'dashboard') loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, adminToken]);

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<BulkCutoffRow[]>([]);
  const [overwriteExisting, setOverwriteExisting] = useState<boolean>(true);
  const [report, setReport] = useState<BulkUploadReport | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [validation, setValidation] = useState<ValidateRowsResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const [importLogs, setImportLogs] = useState<CutoffImportLog[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);

  const [conflicts, setConflicts] = useState<CutoffConflict[]>([]);
  const [isLoadingConflicts, setIsLoadingConflicts] = useState(true);

  const loadConflicts = () => {
    if (!adminToken) return;
    setIsLoadingConflicts(true);
    adminCutoffsApi.listConflicts(adminToken)
      .then((data) => setConflicts(Array.isArray(data) ? data : data.conflicts || []))
      .catch(() => setConflicts([]))
      .finally(() => setIsLoadingConflicts(false));
  };

  const loadImportHistory = () => {
    if (!adminToken) return;
    setIsLoadingHistory(true);
    adminCutoffsApi.listImports(adminToken)
      .then((res) => setImportLogs(res.imports || []))
      .catch(() => setImportLogs([]))
      .finally(() => setIsLoadingHistory(false));
  };

  useEffect(() => {
    if (tab === 'conflicts') loadConflicts();
    if (tab === 'history') loadImportHistory();
  }, [tab, adminToken]);

  const runValidation = (rows: BulkCutoffRow[]) => {
    if (!adminToken || rows.length === 0) { setValidation(null); return; }
    setIsValidating(true);
    adminCutoffsApi.validateRows(adminToken, rows)
      .then(setValidation)
      .catch(() => setValidation(null))
      .finally(() => setIsValidating(false));
  };

  const handleFile = async (file: File) => {
    setReport(null);
    setUploadError(null);
    setValidation(null);
    setParsedRows([]);

    const ext = file.name.toLowerCase().split('.').pop() || '';
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setFileName(null);
      setUploadError(`Unsupported file type ".${ext}" — upload a .csv or .xlsx file.`);
      return;
    }
    setFileName(file.name);
    setIsParsing(true);

    try {
      let rows: BulkCutoffRow[];
      if (ext === 'xlsx' || ext === 'xls') {
        if (!adminToken) return;
        const parsed = await adminCutoffsApi.parseFile(adminToken, file);
        rows = parsed.rows.map(csvRowToCutoff).filter((r): r is BulkCutoffRow => r !== null);
      } else {
        const text = await file.text();
        rows = parseCsv(text).map(csvRowToCutoff).filter((r): r is BulkCutoffRow => r !== null);
      }

      if (rows.length === 0) {
        setUploadError('No valid rows found. Check that the file has a header row with at least collegeId, courseId, examCode, and closingRank columns.');
        setIsParsing(false);
        return;
      }

      setParsedRows(rows);
      runValidation(rows);
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : 'Could not read that file.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleUpload = async () => {
    if (!adminToken || parsedRows.length === 0) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const result = await adminCutoffsApi.bulkUpload(adminToken, parsedRows, fileName || 'cutoffs.csv', overwriteExisting);
      setReport(result);
      setParsedRows([]);
      setValidation(null);
      setFileName(null);
      if (tab === 'history') loadImportHistory();
      if (tab === 'dashboard') loadDashboard();
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : 'Bulk upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRollback = async (importId: string) => {
    if (!adminToken) return;
    if (!confirm(`Are you sure you want to rollback import "${importId}"? All cutoffs created by this import will be removed.`)) return;

    setRollingBackId(importId);
    try {
      await adminCutoffsApi.rollbackImport(adminToken, importId);
      loadImportHistory();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Rollback failed');
    } finally {
      setRollingBackId(null);
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
    { key: 'college', label: 'College ID', render: (c) => c.collegeId },
    { key: 'course', label: 'Course ID', render: (c) => c.courseId },
    { key: 'exam', label: 'Exam', render: (c) => <span className="admin-status-badge admin-status-info">{c.examCode}</span> },
    { key: 'category', label: 'Category', render: (c) => c.category },
    { key: 'year', label: 'Year / Round', render: (c) => `${c.year} · R${c.round}` },
    { key: 'existing', label: 'Existing Closing', render: (c) => `#${c.existingValue}` },
    { key: 'incoming', label: 'Incoming Closing', render: (c) => `#${c.incomingValue}` },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="admin-page-header">
        <div>
          <h1 className="font-serif admin-page-title">Cutoff Management — KCET · COMEDK · NEET</h1>
          <p className="admin-page-subtitle">
            Upload historical cutoff datasets, preview data, validate duplicate records, track import history, and rollback failed imports.
          </p>
        </div>
      </div>

      <div className="admin-tabs">
        <button className="admin-tab" data-active={tab === 'dashboard'} onClick={() => setTab('dashboard')}>
          Dashboard
        </button>
        <button className="admin-tab" data-active={tab === 'add'} onClick={() => setTab('add')}>
          + Add Cutoff
        </button>
        <button className="admin-tab" data-active={tab === 'upload'} onClick={() => setTab('upload')}>
          Dataset Bulk Upload
        </button>
        <button className="admin-tab" data-active={tab === 'history'} onClick={() => setTab('history')}>
          Import History & Rollback
        </button>
        <button className="admin-tab" data-active={tab === 'conflicts'} onClick={() => setTab('conflicts')}>
          Conflicts {conflicts.length > 0 ? `(${conflicts.length})` : ''}
        </button>
      </div>

      {/* 0. DASHBOARD TAB */}
      {tab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="admin-kpi-grid">
            <StatCard label="Total Cutoff Records" value={isLoadingDashboard ? '—' : dashboard?.totalRecords ?? 0} />
            <StatCard label="Colleges with Cutoffs" value={isLoadingDashboard ? '—' : dashboard?.totalCollegesWithCutoffs ?? 0} />
            <StatCard label="Courses with Cutoffs" value={isLoadingDashboard ? '—' : dashboard?.totalCoursesWithCutoffs ?? 0} />
            <StatCard label="KCET Records" value={isLoadingDashboard ? '—' : dashboard?.kcetRecords ?? 0} />
            <StatCard label="COMEDK Records" value={isLoadingDashboard ? '—' : dashboard?.comedkRecords ?? 0} />
            <StatCard label="NEET Records" value={isLoadingDashboard ? '—' : dashboard?.neetRecords ?? 0} />
            <StatCard label="Latest Academic Year" value={isLoadingDashboard ? '—' : dashboard?.latestAcademicYear ?? '—'} />
            <StatCard
              label="Latest Import"
              value={isLoadingDashboard ? '—' : dashboard?.latestImport ? new Date(dashboard.latestImport.createdAt).toLocaleDateString('en-IN') : 'None yet'}
              trend={dashboard?.latestImport ? dashboard.latestImport.fileName : undefined}
            />
            <StatCard label="Records Requiring Review" value={isLoadingDashboard ? '—' : dashboard?.recordsRequiringReview ?? 0} />
          </div>

          <div className="card-editorial">
            <h3 className="font-serif" style={{ fontSize: '16px', margin: '0 0 12px' }}>
              Records Requiring Review
            </h3>
            {isLoadingDashboard ? (
              <div style={{ padding: '1rem 0' }}>Loading…</div>
            ) : !dashboard?.reviewSample.length ? (
              <div style={{ padding: '1rem 0', color: 'var(--text-secondary)' }}>No cutoff records are currently flagged for review.</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>College</th><th>Course</th><th>Exam</th><th>Year</th><th>Category</th><th>Closing Rank</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.reviewSample.map((r) => (
                      <tr key={r.id}>
                        <td>{r.collegeName}</td>
                        <td>{r.courseName || r.courseId}</td>
                        <td><span className="admin-status-badge admin-status-info">{r.examCode}</span></td>
                        <td>{r.year}</td>
                        <td>{r.category}</td>
                        <td>#{r.closingRank}</td>
                        <td><Link className="admin-table-action-btn" href={`/admin/colleges/${r.collegeId}?tab=cutoffs`}>Review</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD CUTOFF TAB */}
      {tab === 'add' && <AddCutoffTab />}

      {/* 1. BULK UPLOAD TAB */}
      {tab === 'upload' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '900px' }}>
          <div className="card-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h3 className="font-serif" style={{ fontSize: '18px', margin: 0 }}>
                Upload Cutoff Dataset (CSV / Excel)
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                Supported columns: <code>{CSV_COLUMNS.join(', ')}</code>. <code>collegeId</code> accepts the college&apos;s code (e.g. E005), exact name, or internal ID.
                <code> courseId</code> accepts the course&apos;s code or exact name. Automatic support for KCET, COMEDK, NEET, and future entrance exams.
              </p>
            </div>

            <FileDropInput accept=".csv,.xlsx,.xls" label="Choose or drop a Cutoffs CSV or Excel file" hint="Category-wise, round-wise closing ranks" selectedFileName={fileName} onFileSelected={handleFile} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="overwriteCheck"
                checked={overwriteExisting}
                onChange={(e) => setOverwriteExisting(e.target.checked)}
              />
              <label htmlFor="overwriteCheck" style={{ fontSize: '13px', cursor: 'pointer' }}>
                Overwrite existing cutoff records matching (College + Course + Exam + Year + Round + Category)
              </label>
            </div>

            {isParsing && <div className="admin-inline-message" data-tone="info">Reading file…</div>}
            {parsedRows.length > 0 && !isParsing && (
              <div className="admin-inline-message" data-tone="success">
                ✓ {parsedRows.length} row{parsedRows.length === 1 ? '' : 's'} parsed — review the validation preview below before committing.
              </div>
            )}
            {uploadError && <div className="admin-inline-message" data-tone="error">{uploadError}</div>}

            <button className="btn-editorial-primary" disabled={parsedRows.length === 0 || isUploading} onClick={handleUpload} style={{ alignSelf: 'flex-start' }}>
              {isUploading ? 'Processing Import...' : `Process & Commit ${parsedRows.length || ''} Record${parsedRows.length === 1 ? '' : 's'}`}
            </button>
          </div>

          {/* VALIDATION PREVIEW — real matching/validation against the database, before commit */}
          {parsedRows.length > 0 && (
            <div className="card-editorial">
              <h4 className="font-serif" style={{ margin: '0 0 12px', fontSize: '15px' }}>
                🔍 Validation Preview
              </h4>
              {isValidating ? (
                <div style={{ padding: '0.5rem 0', color: 'var(--text-secondary)' }}>Matching rows against colleges and courses…</div>
              ) : !validation ? (
                <div style={{ padding: '0.5rem 0', color: 'var(--text-secondary)' }}>Could not validate this dataset — you can still attempt to commit it.</div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px', fontSize: '13px' }}>
                    <span>✓ Valid: <strong>{validation.summary.valid}</strong></span>
                    <span>⚠ Needs Review: <strong>{validation.summary.needs_review}</strong></span>
                    <span>✕ Unmatched College: <strong>{validation.summary.unmatched_college}</strong></span>
                    <span>✕ Unmatched Course: <strong>{validation.summary.unmatched_course}</strong></span>
                    <span>✕ Invalid: <strong>{validation.summary.invalid}</strong></span>
                  </div>
                  <div className="admin-table-wrap">
                    <table className="admin-table" style={{ fontSize: '12px' }}>
                      <thead>
                        <tr>
                          <th>Row</th><th>College</th><th>Course</th><th>Exam</th><th>Year</th><th>Round</th><th>Category</th><th>Closing</th><th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validation.rows.slice(0, 50).map((r) => {
                          const meta = PREVIEW_STATUS_LABEL[r.status];
                          return (
                            <tr key={r.row}>
                              <td>{r.row}</td>
                              <td>{r.collegeName || parsedRows[r.row - 1]?.collegeId}</td>
                              <td>{r.courseName || parsedRows[r.row - 1]?.courseId}</td>
                              <td>{r.examCode}</td>
                              <td>{r.year}</td>
                              <td>R{r.round}</td>
                              <td>{r.category}</td>
                              <td style={{ fontWeight: 700 }}>{r.closingRank ? `#${r.closingRank}` : '—'}</td>
                              <td>
                                <span className={`admin-status-badge ${meta.tone}`} title={r.reason}>{meta.icon} {meta.label}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {validation.rows.length > 50 && (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                      Showing the first 50 of {validation.rows.length} rows.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* IMPORT RESULT REPORT */}
          {report && (
            <div className="card-editorial" style={{ border: '1px solid var(--accent-blue-light)' }}>
              <h4 className="font-serif" style={{ margin: '0 0 12px', fontSize: '16px' }}>
                🎉 Import Completed (ID: {report.importId})
              </h4>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <tbody>
                    <tr><td>Total Rows Processed</td><td>{report.totalRows}</td></tr>
                    <tr><td>Accepted & Saved</td><td>{report.accepted}</td></tr>
                    <tr><td>Conflicts Logged</td><td>{report.conflictsCreated}</td></tr>
                    <tr><td>Rejected Rows</td><td>{report.rejected}</td></tr>
                  </tbody>
                </table>
              </div>

              {report.rejectedRows.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <h5 style={{ fontSize: '13px', color: '#B4232E', margin: '0 0 6px' }}>Rejection Breakdown:</h5>
                  <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '12px', marginBottom: '10px' }}>
                    {(Object.entries(
                      report.rejectedRows.reduce((acc, r) => { acc[r.reasonCode] = (acc[r.reasonCode] || 0) + 1; return acc; }, {} as Record<RejectReasonCode, number>)
                    ) as Array<[RejectReasonCode, number]>).map(([code, count]) => (
                      <span key={code}>{REASON_LABEL[code]}: <strong>{count}</strong></span>
                    ))}
                  </div>
                  <h5 style={{ fontSize: '13px', color: '#B4232E', margin: '0 0 6px' }}>Rejection Details:</h5>
                  <ul style={{ fontSize: '12px', color: '#B4232E', margin: 0, paddingLeft: '16px' }}>
                    {report.rejectedRows.map((r, idx) => (
                      <li key={idx}>Row {r.row}: {r.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. IMPORT HISTORY & ROLLBACK TAB */}
      {tab === 'history' && (
        <div className="card-editorial">
          <h3 className="font-serif" style={{ fontSize: '18px', margin: '0 0 12px' }}>
            📜 Cutoffs Dataset Import History
          </h3>

          {isLoadingHistory ? (
            <div style={{ padding: '1rem 0' }}>Loading import history...</div>
          ) : importLogs.length === 0 ? (
            <div style={{ padding: '1rem 0', color: 'var(--text-secondary)' }}>No import history records on file yet.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Import ID</th>
                    <th>File Name</th>
                    <th>Date</th>
                    <th>Total Rows</th>
                    <th>Inserted</th>
                    <th>Updated</th>
                    <th>Failed</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {importLogs.map((log) => (
                    <tr key={log.importId}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{log.importId}</td>
                      <td>{log.fileName}</td>
                      <td>{new Date(log.createdAt).toLocaleString('en-IN')}</td>
                      <td>{log.totalRows}</td>
                      <td>{log.insertedCount}</td>
                      <td>{log.updatedCount}</td>
                      <td>{log.failedCount}</td>
                      <td>
                        <span className={`admin-status-badge ${log.status === 'completed' ? 'admin-status-success' : log.status === 'rolled_back' ? 'admin-status-warning' : 'admin-status-danger'}`}>
                          {log.status}
                        </span>
                      </td>
                      <td>
                        {log.status === 'completed' && log.affectedCutoffIds?.length > 0 ? (
                          <button
                            type="button"
                            className="admin-table-action-btn"
                            style={{ color: '#B4232E' }}
                            disabled={rollingBackId === log.importId}
                            onClick={() => handleRollback(log.importId)}
                          >
                            {rollingBackId === log.importId ? 'Rolling back...' : '↩ Rollback Import'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. CONFLICTS TAB */}
      {tab === 'conflicts' && (
        <AdminTable
          columns={conflictColumns}
          rows={conflicts}
          rowKey={(c) => c.id || c._id}
          isLoading={isLoadingConflicts}
          emptyMessage="No open cutoff conflicts — all datasets reconciled."
          rowActions={(conflict) => (
            <>
              <button className="admin-table-action-btn" onClick={() => handleResolve(conflict, conflict.existingValue)}>
                Keep Existing ({conflict.existingValue})
              </button>
              <button className="admin-table-action-btn" onClick={() => handleResolve(conflict, conflict.incomingValue)}>
                Accept Incoming ({conflict.incomingValue})
              </button>
            </>
          )}
        />
      )}
    </div>
  );
}

export default function CutoffsAdminPage() {
  return (
    <Suspense fallback={<div className="admin-loading">Loading cutoffs admin...</div>}>
      <CutoffsAdminContent />
    </Suspense>
  );
}
