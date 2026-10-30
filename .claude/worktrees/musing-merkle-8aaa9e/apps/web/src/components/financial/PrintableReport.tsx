'use client';

// Print-header wrapper + action buttons, reused across the 5 "report-shaped"
// financial views. Mirrors the 🖨️ Print button pattern already used on
// apps/web/src/app/scholarships/[scholarshipId]/page.tsx (window.print()),
// plus a CSV export button reusing lib/csv-export.ts verbatim. The
// @media print rules that make this print cleanly live in globals.css.

export function PrintableReport({
  title,
  onExportCsv,
  children,
}: {
  title: string;
  onExportCsv?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="financial-print-report">
      <div className="financial-no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 className="font-serif" style={{ fontSize: '20px', margin: 0 }}>{title}</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          {onExportCsv && <button type="button" className="btn-editorial-secondary" onClick={onExportCsv}>⬇️ Export CSV</button>}
          <button type="button" className="btn-editorial-secondary" onClick={() => window.print()}>🖨️ Print / Save PDF</button>
        </div>
      </div>
      <div className="financial-print-header" style={{ display: 'none' }}>
        <h2 className="font-serif">{title}</h2>
        <p>CareerCompass AI — Generated {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
      {children}
    </div>
  );
}
