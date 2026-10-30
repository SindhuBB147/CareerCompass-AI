'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { apiClient, ApiError } from '../../../lib/api-client';
import { StatCard } from '../../../components/admin/StatCard';

interface KnowledgeDocument {
  id: string;
  title: string;
  doc_type: string;
  status: string;
  chunk_count: number;
  embedding_model: string | null;
  source_filename: string | null;
  created_at: string;
  updated_at: string;
}

interface UsageSummary {
  totalRequests: number;
  avgConfidence: number | null;
  avgLatencyMs: number | null;
  lowConfidenceRate: number;
  erroredRate: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostUsd: number;
  avgCostPerRequest: number;
  byIntent: Array<{ intent: string; count: number }>;
}

const DOC_TYPES = [
  { value: 'brochure', label: 'College Brochure' },
  { value: 'admission_rules', label: 'Admission Rules' },
  { value: 'scholarship_pdf', label: 'Scholarship PDF' },
  { value: 'circular', label: 'Government Circular' },
  { value: 'placement_report', label: 'Placement Report' },
  { value: 'faq', label: 'FAQ' },
  { value: 'general', label: 'General' },
];

export default function AdminKnowledgePage() {
  const { adminToken } = useAdminAuth();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [docType, setDocType] = useState('brochure');
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadStatus = useCallback(async () => {
    if (!adminToken) return;
    setLoading(true);
    try {
      const status = await apiClient.get<{ documents: KnowledgeDocument[]; total_chunks: number }>('/admin/ai-counsellor/knowledge/status', adminToken);
      setDocuments(status.documents);
      setTotalChunks(status.total_chunks);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof ApiError ? err.message : 'Failed to load knowledge base status.' });
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  const loadUsage = useCallback(async () => {
    if (!adminToken) return;
    try {
      const data = await apiClient.get<UsageSummary>('/admin/ai-counsellor/usage', adminToken);
      setUsage(data);
    } catch {
      // Usage stats are supplementary — a failure here shouldn't block the knowledge page.
    }
  }, [adminToken]);

  useEffect(() => { loadStatus(); loadUsage(); }, [loadStatus, loadUsage]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file || !adminToken) return;

    setUploading(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const params = new URLSearchParams({ docType });
      if (title.trim()) params.set('title', title.trim());

      const result = await apiClient.postForm<{ title: string; status: string; chunk_count: number; reused_existing: boolean }>(
        `/admin/ai-counsellor/knowledge/upload?${params.toString()}`, form, adminToken,
      );
      setMessage({ type: 'success', text: `"${result.title}" ${result.reused_existing ? 'already indexed (unchanged)' : `indexed successfully (${result.chunk_count} chunks).`}` });
      setTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadStatus();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof ApiError ? err.message : 'Upload failed.' });
    } finally {
      setUploading(false);
    }
  };

  const handleReindex = async (documentId?: string) => {
    if (!adminToken) return;
    setMessage(null);
    try {
      const query = documentId ? `?documentId=${documentId}` : '';
      await apiClient.post(`/admin/ai-counsellor/knowledge/reindex${query}`, undefined, adminToken);
      setMessage({ type: 'success', text: documentId ? 'Document reindexed.' : 'All documents reindexed.' });
      loadStatus();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof ApiError ? err.message : 'Reindex failed.' });
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!adminToken) return;
    setMessage(null);
    try {
      await apiClient.del(`/admin/ai-counsellor/knowledge/${documentId}`, adminToken);
      loadStatus();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof ApiError ? err.message : 'Delete failed.' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="admin-page-header">
        <div>
          <h1 className="font-serif admin-page-title">AI Counsellor Knowledge Base</h1>
          <p className="admin-page-subtitle">
            Upload brochures, admission rules, scholarship circulars, and placement reports for the RAG pipeline to retrieve from.
            {' '}{totalChunks} chunk{totalChunks === 1 ? '' : 's'} indexed across {documents.length} document{documents.length === 1 ? '' : 's'}.
          </p>
        </div>
      </div>

      {message && <div className="admin-inline-message" data-tone={message.type}>{message.text}</div>}

      <div className="admin-kpi-grid">
        <StatCard label="Total Requests" value={usage?.totalRequests ?? '—'} />
        <StatCard label="Avg Confidence" value={usage?.avgConfidence != null ? usage.avgConfidence.toFixed(2) : '—'} />
        <StatCard label="Low-Confidence Rate" value={usage ? `${(usage.lowConfidenceRate * 100).toFixed(0)}%` : '—'} />
        <StatCard label="Avg Latency" value={usage?.avgLatencyMs != null ? `${Math.round(usage.avgLatencyMs)}ms` : '—'} />
        <StatCard
          label="Total Tokens"
          value={usage ? (usage.totalTokensIn + usage.totalTokensOut).toLocaleString() : '—'}
        />
        <StatCard label="Estimated Cost" value={usage ? `$${usage.totalCostUsd.toFixed(4)}` : '—'} />
      </div>

      <div className="card-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h2 className="font-serif" style={{ fontSize: '17px', margin: 0 }}>Upload Document</h2>
        <form onSubmit={handleUpload} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input ref={fileInputRef} type="file" accept=".pdf,.txt,.docx" className="input-editorial" style={{ width: 'auto' }} required />
          <select value={docType} onChange={e => setDocType(e.target.value)} className="input-editorial" style={{ width: 'auto' }}>
            {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input type="text" placeholder="Title (optional)" value={title} onChange={e => setTitle(e.target.value)} className="input-editorial" style={{ flex: 1, minWidth: '180px' }} />
          <button type="submit" className="btn-editorial-primary" style={{ padding: '10px 20px', fontSize: '13px' }} disabled={uploading}>{uploading ? 'Uploading…' : 'Upload & Index'}</button>
          <button type="button" onClick={() => handleReindex()} className="btn-editorial-secondary" style={{ padding: '10px 20px', fontSize: '13px' }}>Rebuild All Embeddings</button>
        </form>
      </div>

      <div className="card-editorial admin-table-card" style={{ padding: '0 !important' }}>
        <div className="admin-table-toolbar"><h2 className="font-serif" style={{ fontSize: '17px', margin: 0 }}>Documents</h2></div>
        <div className="admin-table-wrap">
          {loading ? (
            <p className="admin-loading">Loading…</p>
          ) : documents.length === 0 ? (
            <div className="admin-empty-state"><div className="admin-empty-icon">📚</div><p style={{ margin: 0 }}>No documents uploaded yet.</p></div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th><th>Type</th><th>Status</th><th>Chunks</th><th>Embedding Model</th><th>Updated</th><th></th>
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => (
                  <tr key={doc.id}>
                    <td>{doc.title}</td>
                    <td>{doc.doc_type}</td>
                    <td>
                      <span className={`admin-status-badge ${doc.status === 'indexed' ? 'admin-status-success' : doc.status === 'failed' ? 'admin-status-danger' : 'admin-status-warning'}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td>{doc.chunk_count}</td>
                    <td>{doc.embedding_model ?? '—'}</td>
                    <td>{new Date(doc.updated_at).toLocaleDateString()}</td>
                    <td>
                      <div className="admin-table-row-actions">
                        <button className="admin-table-action-btn" onClick={() => handleReindex(doc.id)}>Reindex</button>
                        <button className="admin-table-action-btn" data-danger="true" onClick={() => handleDelete(doc.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
