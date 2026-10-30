'use client';
import { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { ApiError } from '../../../lib/api-client';
import {
  adminKnowledgeApi, type KnowledgeCategory, type KnowledgeChunkSummary, type KnowledgeDocument, type KnowledgeUsageSummary,
} from '../../../lib/admin-api';
import { StatCard } from '../../../components/admin/StatCard';
import { AdminTable, type AdminTableColumn } from '../../../components/admin/AdminTable';
import { AdminModal } from '../../../components/admin/AdminModal';
import { FileDropInput } from '../../../components/admin/FileDropInput';

const STATUS_LABELS: Record<string, string> = {
  indexed: 'Indexed',
  processing: 'Processing',
  failed: 'Failed',
  needs_ocr: 'Needs OCR',
};

function statusTone(status: string): 'admin-status-success' | 'admin-status-danger' | 'admin-status-warning' {
  if (status === 'indexed') return 'admin-status-success';
  if (status === 'failed') return 'admin-status-danger';
  return 'admin-status-warning'; // processing, needs_ocr, and any future in-progress states
}

export default function AdminKnowledgePage() {
  const { adminToken } = useAdminAuth();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [usage, setUsage] = useState<KnowledgeUsageSummary | null>(null);
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [search, setSearch] = useState('');

  const [docType, setDocType] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [chunksDoc, setChunksDoc] = useState<KnowledgeDocument | null>(null);
  const [chunks, setChunks] = useState<KnowledgeChunkSummary[] | null>(null);
  const [chunksLoading, setChunksLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!adminToken) return;
    setLoading(true);
    try {
      const status = await adminKnowledgeApi.status(adminToken);
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
      setUsage(await adminKnowledgeApi.usage(adminToken));
    } catch {
      // Usage stats are supplementary — a failure here shouldn't block the knowledge page.
    }
  }, [adminToken]);

  const loadCategories = useCallback(async () => {
    if (!adminToken) return;
    try {
      const { categories: cats } = await adminKnowledgeApi.categories(adminToken);
      setCategories(cats);
      setDocType(prev => prev || cats[0]?.code || '');
    } catch {
      // Categories are used for the upload form's dropdown only — a
      // failure here shouldn't block viewing already-indexed documents.
    }
  }, [adminToken]);

  useEffect(() => { loadStatus(); loadUsage(); loadCategories(); }, [loadStatus, loadUsage, loadCategories]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !adminToken || !docType) return;

    setUploading(true);
    setMessage(null);
    try {
      const result = await adminKnowledgeApi.upload(adminToken, file, docType, title);
      const statusLabel = STATUS_LABELS[result.status] ?? result.status;
      setMessage({
        type: result.status === 'failed' ? 'error' : 'success',
        text: `"${result.title}" ${result.reused_existing ? 'already indexed (unchanged)' : `${statusLabel.toLowerCase()} (${result.chunk_count} chunks).`}`,
      });
      setTitle('');
      setFile(null);
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
      await adminKnowledgeApi.reindex(adminToken, documentId);
      setMessage({ type: 'success', text: documentId ? 'Document reindexed.' : 'All documents reindexed.' });
      loadStatus();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof ApiError ? err.message : 'Reindex failed.' });
    }
  };

  const handleDelete = async (doc: KnowledgeDocument) => {
    if (!adminToken) return;
    if (!confirm(`Delete "${doc.title}"? It will stop being used by the AI Counsellor. This can't be undone from this page.`)) return;
    setMessage(null);
    try {
      await adminKnowledgeApi.remove(adminToken, doc.id);
      loadStatus();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof ApiError ? err.message : 'Delete failed.' });
    }
  };

  const openChunks = async (doc: KnowledgeDocument) => {
    if (!adminToken) return;
    setChunksDoc(doc);
    setChunks(null);
    setChunksLoading(true);
    try {
      const result = await adminKnowledgeApi.chunks(adminToken, doc.id);
      setChunks(result.chunks);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof ApiError ? err.message : 'Failed to load chunks.' });
      setChunksDoc(null);
    } finally {
      setChunksLoading(false);
    }
  };

  const filteredDocuments = search
    ? documents.filter(d =>
        d.title.toLowerCase().includes(search.toLowerCase()) || d.doc_type.toLowerCase().includes(search.toLowerCase()),
      )
    : documents;

  const columns: AdminTableColumn<KnowledgeDocument>[] = [
    { key: 'title', label: 'Title', sortable: true },
    { key: 'doc_type', label: 'Type', sortable: true },
    {
      key: 'status', label: 'Status', sortable: true,
      render: d => <span className={`admin-status-badge ${statusTone(d.status)}`}>{STATUS_LABELS[d.status] ?? d.status}</span>,
    },
    { key: 'chunk_count', label: 'Chunks', sortable: true, align: 'right' },
    { key: 'embedding_model', label: 'Embedding Model', render: d => d.embedding_model ?? '—' },
    { key: 'updated_at', label: 'Updated', sortable: true, render: d => new Date(d.updated_at).toLocaleDateString(), exportValue: d => d.updated_at },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="admin-page-header">
        <div>
          <h1 className="font-serif admin-page-title">AI Counsellor Knowledge Base</h1>
          <p className="admin-page-subtitle">
            Upload brochures, admission rules, scholarship circulars, seat matrices, and placement reports for the RAG pipeline to retrieve from.
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
        <StatCard label="Total Tokens" value={usage ? (usage.totalTokensIn + usage.totalTokensOut).toLocaleString() : '—'} />
        <StatCard label="Estimated Cost" value={usage ? `$${usage.totalCostUsd.toFixed(4)}` : '—'} />
      </div>

      <div className="card-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h2 className="font-serif" style={{ fontSize: '17px', margin: 0 }}>Upload Document</h2>
        <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <FileDropInput
            accept=".pdf,.txt,.docx,.csv,.json"
            label="Choose or drop a PDF, TXT, DOCX, CSV, or JSON file"
            hint="Scanned PDFs with no text layer are flagged “Needs OCR” rather than silently failing."
            selectedFileName={file?.name}
            onFileSelected={setFile}
          />
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={docType} onChange={e => setDocType(e.target.value)} className="input-editorial" style={{ width: 'auto' }}>
              {categories.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
            <input type="text" placeholder="Title (optional)" value={title} onChange={e => setTitle(e.target.value)} className="input-editorial" style={{ flex: 1, minWidth: '180px' }} />
            <button type="submit" className="btn-editorial-primary" style={{ padding: '10px 20px', fontSize: '13px' }} disabled={uploading || !file}>
              {uploading ? 'Uploading…' : 'Upload & Index'}
            </button>
            <button type="button" onClick={() => handleReindex()} className="btn-editorial-secondary" style={{ padding: '10px 20px', fontSize: '13px' }}>
              Rebuild All Embeddings
            </button>
          </div>
        </form>
      </div>

      <AdminTable
        columns={columns}
        rows={filteredDocuments}
        rowKey={d => d.id}
        isLoading={loading}
        emptyMessage="No documents uploaded yet."
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by title or type…"
        exportFilename="knowledge-base-documents"
        rowActions={d => (
          <div className="admin-table-row-actions">
            <button className="admin-table-action-btn" onClick={() => openChunks(d)}>View Chunks</button>
            <button className="admin-table-action-btn" onClick={() => handleReindex(d.id)}>Reindex</button>
            <button className="admin-table-action-btn" data-danger="true" onClick={() => handleDelete(d)}>Delete</button>
          </div>
        )}
      />

      {chunksDoc && (
        <AdminModal title={`Chunks — ${chunksDoc.title}`} onClose={() => setChunksDoc(null)} wide>
          {chunksLoading ? (
            <p className="admin-loading">Loading…</p>
          ) : !chunks || chunks.length === 0 ? (
            <div className="admin-empty-state"><div className="admin-empty-icon">📄</div><p style={{ margin: 0 }}>No chunks indexed for this document yet.</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '60vh', overflowY: 'auto' }}>
              {chunks.map(c => (
                <div key={c.chunk_id} style={{ fontSize: '13px', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-main)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', color: 'var(--text-muted)', fontSize: '11px' }}>
                    <span>Chunk {c.chunk_index}</span>
                    <span>{c.page_number ? `p. ${c.page_number}` : c.page_range ? `pp. ${c.page_range}` : 'no page info'}</span>
                  </div>
                  <div style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>{c.snippet}</div>
                </div>
              ))}
            </div>
          )}
        </AdminModal>
      )}
    </div>
  );
}
