'use client';

import React, { useMemo, useState } from 'react';
import { downloadCsv } from '../../lib/csv-export';
import { AdminPagination } from './AdminPagination';

export interface AdminTableColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  exportValue?: (row: T) => string | number;
  align?: 'left' | 'right' | 'center';
}

interface AdminTableProps<T> {
  columns: AdminTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  toolbarActions?: React.ReactNode;
  selectable?: boolean;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: (allIds: string[]) => void;
  bulkActions?: Array<{ label: string; onClick: (selectedIds: string[]) => void; danger?: boolean }>;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  totalCount?: number;
  exportFilename?: string;
  rowActions?: (row: T) => React.ReactNode;
}

export function AdminTable<T>({
  columns, rows, rowKey, isLoading, emptyMessage = 'No records found.',
  searchValue, onSearchChange, searchPlaceholder = 'Search…', toolbarActions,
  selectable, selectedIds = [], onToggleSelect, onToggleSelectAll, bulkActions,
  page, totalPages, onPageChange, totalCount, exportFilename, rowActions,
}: AdminTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find(c => c.key === sortKey);
    return [...rows].sort((a, b) => {
      const av = col?.exportValue ? col.exportValue(a) : (a as any)[sortKey];
      const bv = col?.exportValue ? col.exportValue(b) : (b as any)[sortKey];
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir, columns]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const allIds = rows.map(rowKey);
  const allSelected = selectable && allIds.length > 0 && allIds.every(id => selectedIds.includes(id));

  const handleExport = () => {
    const exportRows = sortedRows.map(row => {
      const obj: Record<string, unknown> = {};
      for (const col of columns) obj[col.label] = col.exportValue ? col.exportValue(row) : (row as any)[col.key];
      return obj;
    });
    downloadCsv(exportFilename ?? 'export', exportRows);
  };

  return (
    <div className="card-editorial admin-table-card">
      {(onSearchChange || toolbarActions || exportFilename) && (
        <div className="admin-table-toolbar">
          {onSearchChange && (
            <div className="admin-table-search">
              <input
                type="text"
                className="input-editorial"
                placeholder={searchPlaceholder}
                value={searchValue ?? ''}
                onChange={e => onSearchChange(e.target.value)}
                aria-label={searchPlaceholder}
              />
            </div>
          )}
          <div className="admin-table-toolbar-actions">
            {exportFilename && rows.length > 0 && (
              <button type="button" className="btn-editorial-secondary" style={{ padding: '9px 16px', fontSize: '13px' }} onClick={handleExport}>
                ⬇ Export CSV
              </button>
            )}
            {toolbarActions}
          </div>
        </div>
      )}

      {selectable && selectedIds.length > 0 && bulkActions && (
        <div className="admin-bulk-bar">
          <span>{selectedIds.length} selected</span>
          {bulkActions.map(action => (
            <button
              key={action.label}
              className="admin-table-action-btn"
              data-danger={action.danger || undefined}
              onClick={() => action.onClick(selectedIds)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              {selectable && (
                <th style={{ width: '36px' }}>
                  <input
                    type="checkbox"
                    className="admin-checkbox"
                    checked={allSelected}
                    onChange={() => onToggleSelectAll?.(allIds)}
                    aria-label="Select all rows"
                  />
                </th>
              )}
              {columns.map(col => (
                <th
                  key={col.key}
                  data-sortable={col.sortable || undefined}
                  onClick={() => col.sortable && toggleSort(col.key)}
                  style={{ textAlign: col.align ?? 'left' }}
                >
                  {col.label}{col.sortable && sortKey === col.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
              {rowActions && <th style={{ width: '1%' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)} className="admin-loading">Loading…</td></tr>
            ) : sortedRows.length === 0 ? (
              <tr><td colSpan={columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}>
                <div className="admin-empty-state"><div className="admin-empty-icon">📭</div><p style={{ margin: 0 }}>{emptyMessage}</p></div>
              </td></tr>
            ) : sortedRows.map(row => {
              const id = rowKey(row);
              return (
                <tr key={id}>
                  {selectable && (
                    <td>
                      <input
                        type="checkbox"
                        className="admin-checkbox"
                        checked={selectedIds.includes(id)}
                        onChange={() => onToggleSelect?.(id)}
                        aria-label={`Select row ${id}`}
                      />
                    </td>
                  )}
                  {columns.map(col => (
                    <td key={col.key} style={{ textAlign: col.align ?? 'left' }}>
                      {col.render ? col.render(row) : String((row as any)[col.key] ?? '—')}
                    </td>
                  ))}
                  {rowActions && <td><div className="admin-table-row-actions">{rowActions(row)}</div></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(totalPages !== undefined && totalPages > 1) && (
        <div className="admin-table-footer">
          <span className="admin-table-count">{totalCount !== undefined ? `${totalCount} total` : ''}</span>
          <AdminPagination page={page ?? 1} totalPages={totalPages} onChange={onPageChange ?? (() => {})} />
        </div>
      )}
    </div>
  );
}
