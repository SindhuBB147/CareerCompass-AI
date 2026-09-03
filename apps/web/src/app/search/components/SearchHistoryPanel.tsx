'use client';

import { useEffect, useState } from 'react';
import { searchApi, type SearchHistoryEntry } from '../../../lib/search-api';

interface Props {
  token: string | null;
  currentHistoryId: string | null;
  onPick: (query: string) => void;
  refreshKey: number;
}

export function SearchHistoryPanel({ token, currentHistoryId, onPick, refreshKey }: Props) {
  const [recent, setRecent] = useState<SearchHistoryEntry[]>([]);
  const [saved, setSaved] = useState<SearchHistoryEntry[]>([]);

  useEffect(() => {
    if (!token) { setRecent([]); setSaved([]); return; }
    searchApi.getHistory(token)
      .then((res) => { setRecent(res.recent); setSaved(res.saved); })
      .catch(() => { setRecent([]); setSaved([]); });
  }, [token, refreshKey]);

  const toggleSave = async (entry: SearchHistoryEntry) => {
    if (!token) return;
    if (entry.isSaved) {
      await searchApi.unsaveSearch(token, entry._id).catch(() => undefined);
    } else {
      await searchApi.saveSearch(token, entry._id).catch(() => undefined);
    }
    const res = await searchApi.getHistory(token).catch(() => null);
    if (res) { setRecent(res.recent); setSaved(res.saved); }
  };

  if (!token) return null;
  if (recent.length === 0 && saved.length === 0) return null;

  return (
    <aside className="card-editorial smart-search-history-panel" aria-label="Search history">
      {saved.length > 0 && (
        <div className="smart-search-history-group">
          <span className="colleges-search-section-title">Saved Searches</span>
          {saved.map((entry) => (
            <div key={entry._id} className="smart-search-history-row">
              <button type="button" className="smart-search-history-query" onClick={() => onPick(entry.queryMasked)}>
                {entry.queryMasked}
              </button>
              <button
                type="button"
                className="smart-search-history-star"
                aria-label="Unsave this search"
                onClick={() => toggleSave(entry)}
              >★</button>
            </div>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <div className="smart-search-history-group">
          <span className="colleges-search-section-title">Recent Searches</span>
          {recent.map((entry) => (
            <div key={entry._id} className="smart-search-history-row">
              <button type="button" className="smart-search-history-query" onClick={() => onPick(entry.queryMasked)}>
                {entry.queryMasked}
              </button>
              <button
                type="button"
                className="smart-search-history-star"
                aria-label={entry._id === currentHistoryId ? 'Save this search' : 'Save this search'}
                onClick={() => toggleSave(entry)}
              >☆</button>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
