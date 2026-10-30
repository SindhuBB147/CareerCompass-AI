'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Loader2, Check, AlertCircle } from 'lucide-react';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { downloadAuthenticated, reportsApi, ReportFormat, ReportType } from '../../lib/reports-api';
import { ApiError } from '../../lib/api-client';

export interface ReportDownloadButtonProps {
  reportType: ReportType;
  format?: ReportFormat;
  params?: Record<string, unknown>;
  tooltip?: string;
  ariaLabel?: string;
  size?: 'sm' | 'md';
  className?: string;
  style?: React.CSSProperties;
  showText?: boolean;
}

export function ReportDownloadButton({
  reportType,
  format = 'pdf',
  params,
  tooltip = 'Download Report',
  ariaLabel,
  size = 'sm',
  className = '',
  style,
  showText = false,
}: ReportDownloadButtonProps) {
  const router = useRouter();
  const { accessToken, isAuthenticated } = useUserAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated || !accessToken) {
      router.push('/login/student');
      return;
    }

    if (loading) return;

    setLoading(true);
    setStatus('idle');
    setErrorMessage(null);

    try {
      const report = await reportsApi.generate(accessToken, reportType, format, params);
      const filename = `${reportType}-${report.id}.${format}`;
      await downloadAuthenticated(reportsApi.downloadUrl(report.id), accessToken, filename);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (err) {
      setStatus('error');
      const msg = err instanceof ApiError ? err.message : (err instanceof Error ? err.message : 'Could not generate report.');
      setErrorMessage(msg);
      setTimeout(() => {
        setStatus('idle');
        setErrorMessage(null);
      }, 4000);
    } finally {
      setLoading(false);
    }
  };

  const iconSize = size === 'sm' ? 15 : 18;
  const isSm = size === 'sm';

  const buttonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: showText ? (isSm ? '6px 12px' : '8px 16px') : (isSm ? '8px' : '10px'),
    borderRadius: '999px',
    border: '1px solid var(--border-color, #E2E8F0)',
    backgroundColor: status === 'success' ? '#059669' : status === 'error' ? '#DC2626' : 'var(--card-bg, #ffffff)',
    color: status === 'success' || status === 'error' ? '#FFFFFF' : 'var(--text-primary, #0F172A)',
    cursor: loading ? 'wait' : 'pointer',
    transition: 'all 0.2s ease',
    fontSize: isSm ? '13px' : '14px',
    fontWeight: 500,
    outline: 'none',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
    position: 'relative',
    ...style,
  };

  const resolvedTooltip = errorMessage || (status === 'success' ? 'Report Downloaded!' : tooltip);
  const resolvedAriaLabel = ariaLabel || tooltip;

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className={`report-download-btn ${className}`}
      style={buttonStyle}
      title={resolvedTooltip}
      aria-label={resolvedAriaLabel}
    >
      {loading ? (
        <Loader2 size={iconSize} style={{ animation: 'spin 1s linear infinite' }} />
      ) : status === 'success' ? (
        <Check size={iconSize} />
      ) : status === 'error' ? (
        <AlertCircle size={iconSize} />
      ) : (
        <Download size={iconSize} />
      )}
      {showText && <span>{status === 'success' ? 'Downloaded' : status === 'error' ? 'Failed' : tooltip}</span>}
    </button>
  );
}
