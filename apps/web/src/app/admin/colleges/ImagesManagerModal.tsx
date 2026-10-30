'use client';

import React, { useEffect, useState } from 'react';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { ApiError } from '../../../lib/api-client';
import { adminCollegesApi, type AddImageInput } from '../../../lib/admin-api';
import { collegesApi, type College, type GalleryItem } from '../../../lib/colleges-api';
import { AdminModal } from '../../../components/admin/AdminModal';
import { collegeImageSrc, onCollegeImageError } from '../../../lib/college-image';

const CATEGORY_OPTIONS: GalleryItem['category'][] = ['Campus', 'Library', 'Labs', 'Hostels', 'Sports', 'Auditorium', 'Fest'];

const EMPTY_NEW_IMAGE: AddImageInput = {
  category: 'Campus', url: '', title: '', altText: '', sourceUrl: '', sourceName: '', verificationStatus: 'needs_review',
};

function StatusBadge({ status }: { status?: string }) {
  const s = status || 'verified';
  const tone = s === 'verified' ? 'admin-status-success' : s === 'rejected' ? 'admin-status-danger' : 'admin-status-warning';
  const label = s === 'verified' ? 'Verified' : s === 'rejected' ? 'Rejected' : 'Needs Review';
  return <span className={`admin-status-badge ${tone}`}>{label}</span>;
}

export function ImagesManagerModal({ collegeId, onClose }: { collegeId: string; onClose: () => void }) {
  const { adminToken } = useAdminAuth();
  const [college, setCollege] = useState<College | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newImage, setNewImage] = useState<AddImageInput>(EMPTY_NEW_IMAGE);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = () => {
    setIsLoading(true);
    collegesApi.getDetail(collegeId).then(setCollege).catch(() => setError('Failed to load images.')).finally(() => setIsLoading(false));
  };

  useEffect(() => { reload(); }, [collegeId]);

  const gallery = (college?.gallery ?? []).slice().sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const withBusy = async (id: string, action: () => Promise<unknown>) => {
    if (!adminToken) return;
    setBusyId(id);
    setError(null);
    try {
      await action();
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleAddImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !newImage.url.trim() || !newImage.title.trim()) return;
    setError(null);
    try {
      await adminCollegesApi.addImage(adminToken, collegeId, {
        ...newImage,
        altText: newImage.altText || `${college?.name ?? ''} — ${newImage.title}`.trim(),
        sourceUrl: newImage.sourceUrl || undefined,
        sourceName: newImage.sourceName || undefined,
      });
      setNewImage(EMPTY_NEW_IMAGE);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add image.');
    }
  };

  const move = (index: number, dir: -1 | 1) => {
    const ids = gallery.map(g => g.id!).filter(Boolean);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    if (adminToken) withBusy('reorder', () => adminCollegesApi.reorderImages(adminToken, collegeId, ids));
  };

  return (
    <AdminModal title={`Manage Images — ${college?.name ?? '…'}`} onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxHeight: '70vh', overflowY: 'auto' }}>
        {error && <div className="admin-inline-message" data-tone="error">{error}</div>}

        {isLoading ? (
          <p className="admin-loading">Loading…</p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
              <img
                src={collegeImageSrc(college?.bannerImage)}
                onError={onCollegeImageError}
                alt=""
                style={{ width: '120px', height: '80px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700 }}>Current Primary Image</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                  {college?.bannerImage || 'No verified primary image yet — the public site shows the placeholder.'}
                </div>
              </div>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th></th><th>Category</th><th>Title / Alt Text</th><th>Status</th><th>Source</th><th>Primary</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {gallery.map((img, idx) => (
                    <tr key={img.id ?? idx}>
                      <td>
                        <img
                          src={collegeImageSrc(img.thumbnailUrl || img.url)}
                          onError={onCollegeImageError}
                          alt=""
                          style={{ width: '64px', height: '44px', objectFit: 'cover', borderRadius: '6px' }}
                        />
                      </td>
                      <td>{img.category}</td>
                      <td style={{ maxWidth: '220px' }}>
                        <div style={{ fontWeight: 600 }}>{img.title}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{img.altText}</div>
                      </td>
                      <td><StatusBadge status={img.verificationStatus} /></td>
                      <td style={{ maxWidth: '160px' }}>
                        {img.sourceUrl ? (
                          <a href={img.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px' }}>
                            {img.sourceName || 'View source'}
                          </a>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{img.sourceName || '—'}</span>
                        )}
                      </td>
                      <td>{img.isPrimary ? '★' : ''}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          <button className="admin-table-action-btn" disabled={idx === 0 || busyId !== null} onClick={() => move(idx, -1)} title="Move up">↑</button>
                          <button className="admin-table-action-btn" disabled={idx === gallery.length - 1 || busyId !== null} onClick={() => move(idx, 1)} title="Move down">↓</button>
                          {!img.isPrimary && (
                            <button
                              className="admin-table-action-btn"
                              disabled={busyId !== null}
                              onClick={() => img.id && withBusy(img.id, () => adminCollegesApi.setPrimaryImage(adminToken!, collegeId, img.id!))}
                            >
                              Set Primary
                            </button>
                          )}
                          {img.verificationStatus !== 'verified' && (
                            <button
                              className="admin-table-action-btn"
                              disabled={busyId !== null}
                              onClick={() => img.id && withBusy(img.id, () => adminCollegesApi.verifyImage(adminToken!, collegeId, img.id!))}
                            >
                              Verify
                            </button>
                          )}
                          {img.verificationStatus !== 'rejected' && (
                            <button
                              className="admin-table-action-btn"
                              data-danger="true"
                              disabled={busyId !== null}
                              onClick={() => img.id && withBusy(img.id, () => adminCollegesApi.rejectImage(adminToken!, collegeId, img.id!))}
                            >
                              Reject
                            </button>
                          )}
                          <button
                            className="admin-table-action-btn"
                            data-danger="true"
                            disabled={busyId !== null}
                            onClick={() => img.id && confirm(`Remove "${img.title}"?`) && withBusy(img.id, () => adminCollegesApi.removeImage(adminToken!, collegeId, img.id!))}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {gallery.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No images yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        <form onSubmit={handleAddImage} className="admin-form-grid" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <div className="admin-form-group">
            <label className="admin-form-label">Category</label>
            <select className="input-editorial" value={newImage.category} onChange={e => setNewImage({ ...newImage, category: e.target.value as GalleryItem['category'] })}>
              {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="admin-form-group" data-span="2">
            <label className="admin-form-label">Image URL</label>
            <input className="input-editorial" required value={newImage.url} onChange={e => setNewImage({ ...newImage, url: e.target.value })} placeholder="https://…" />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Title</label>
            <input className="input-editorial" required value={newImage.title} onChange={e => setNewImage({ ...newImage, title: e.target.value })} placeholder="Main Building" />
          </div>
          <div className="admin-form-group" data-span="2">
            <label className="admin-form-label">Alt Text (accessibility)</label>
            <input className="input-editorial" value={newImage.altText} onChange={e => setNewImage({ ...newImage, altText: e.target.value })} placeholder="e.g. Main academic block viewed from the quadrangle" />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Source URL</label>
            <input className="input-editorial" value={newImage.sourceUrl} onChange={e => setNewImage({ ...newImage, sourceUrl: e.target.value })} placeholder="https://college-site.edu/gallery" />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Source Name</label>
            <input className="input-editorial" value={newImage.sourceName} onChange={e => setNewImage({ ...newImage, sourceName: e.target.value })} placeholder="Official Website" />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Verification Status</label>
            <select className="input-editorial" value={newImage.verificationStatus} onChange={e => setNewImage({ ...newImage, verificationStatus: e.target.value as AddImageInput['verificationStatus'] })}>
              <option value="needs_review">Needs Review</option>
              <option value="verified">Verified</option>
            </select>
          </div>
          <div className="admin-checkbox-row">
            <input id="im-primary" type="checkbox" className="admin-checkbox" checked={!!newImage.setPrimary} onChange={e => setNewImage({ ...newImage, setPrimary: e.target.checked })} />
            <label htmlFor="im-primary">Set as primary image</label>
          </div>
          <div className="admin-form-group" data-span="2" style={{ alignItems: 'flex-end' }}>
            <button type="submit" className="btn-editorial-primary" style={{ padding: '10px 20px', fontSize: '13px' }}>+ Add Image</button>
          </div>
        </form>
      </div>
    </AdminModal>
  );
}
