'use client';

import React from 'react';

interface AdminModalProps {
  title: string;
  onClose: () => void;
  onSubmit?: (e: React.FormEvent) => void;
  children: React.ReactNode;
  submitLabel?: string;
  isSubmitting?: boolean;
  error?: string | null;
  wide?: boolean;
}

export function AdminModal({ title, onClose, onSubmit, children, submitLabel = 'Save', isSubmitting, error, wide }: AdminModalProps) {
  const content = (
    <div className="card-editorial admin-modal" style={wide ? { maxWidth: '860px' } : undefined}>
      <div className="admin-modal-header">
        <h3 className="font-serif admin-modal-title">{title}</h3>
        <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close dialog">✕</button>
      </div>

      {children}

      {error && <div className="admin-inline-message" data-tone="error">{error}</div>}

      {onSubmit && (
        <div className="admin-form-actions">
          <button type="button" className="btn-editorial-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-editorial-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : submitLabel}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      {onSubmit ? <form onSubmit={onSubmit} style={{ display: 'contents' }}>{content}</form> : content}
    </div>
  );
}
