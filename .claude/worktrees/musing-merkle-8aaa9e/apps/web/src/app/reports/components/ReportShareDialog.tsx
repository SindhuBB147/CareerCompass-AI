'use client';

import { ShareResult } from '../../../lib/reports-api';

export function ReportShareDialog({
  share, onDisable, onClose,
}: {
  share: ShareResult;
  onDisable: () => void;
  onClose: () => void;
}) {
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/reports/shared/${share.token}` : '';

  return (
    <div className="reports-share-dialog">
      <div className="reports-share-row">
        <img src={share.qrCodeDataUrl} alt="Report share QR code" className="reports-qr" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <code className="reports-share-link">{shareUrl}</code>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Expires {new Date(share.expiresAt).toLocaleDateString('en-IN')}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button" className="btn-editorial-secondary reports-btn-sm"
              onClick={() => navigator.clipboard?.writeText(shareUrl).catch(() => {})}
            >
              Copy Link
            </button>
            <button type="button" className="btn-editorial-secondary reports-btn-sm" onClick={onDisable}>Disable Sharing</button>
            <button type="button" className="reports-link-btn" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
