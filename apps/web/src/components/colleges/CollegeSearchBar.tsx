'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collegesApi, type College, type ExamCode } from '../../lib/colleges-api';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { searchApi, type SearchSuggestions } from '../../lib/search-api';

const RECENT_SEARCHES_KEY = 'cc_college_recent_searches';
const MAX_RECENT = 6;

const POPULAR_SEARCHES = [
  'Computer Science', 'MBBS', 'Bengaluru', 'B.Arch', 'AI & Data Science', 'B.Pharm',
];

function readRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function pushRecentSearch(term: string) {
  if (typeof window === 'undefined' || !term.trim()) return;
  const existing = readRecentSearches().filter((t) => t.toLowerCase() !== term.toLowerCase());
  const updated = [term, ...existing].slice(0, MAX_RECENT);
  window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
}

interface CollegeSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  examCode: ExamCode;
}

export function CollegeSearchBar({ value, onChange, onSubmit, examCode }: CollegeSearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<College[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<SearchSuggestions | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedValue = useDebouncedValue(value, 300);

  const { listening, speechSupported, toggleListening } = useSpeechRecognition({
    onResult: (transcript) => commitSearch(transcript),
  });

  useEffect(() => {
    setRecentSearches(readRecentSearches());
  }, []);

  useEffect(() => {
    if (isFocused && !aiSuggestions) {
      searchApi.getSuggestions().then(setAiSuggestions).catch(() => setAiSuggestions(null));
    }
  }, [isFocused, aiSuggestions]);

  useEffect(() => {
    let cancelled = false;
    if (!debouncedValue.trim()) {
      setSuggestions([]);
      return;
    }
    collegesApi
      .search({ q: debouncedValue, examCode, limit: 5 })
      .then((res) => {
        if (!cancelled) setSuggestions(res.results);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedValue, examCode]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const commitSearch = (term: string) => {
    onChange(term);
    pushRecentSearch(term);
    setRecentSearches(readRecentSearches());
    setIsFocused(false);
    onSubmit?.(term);
  };

  const hasAiSuggestions = !!aiSuggestions && (aiSuggestions.trendingSearches.length > 0 || aiSuggestions.suggestedQueries.length > 0);
  const showDropdown = isFocused && (suggestions.length > 0 || (!value.trim() && (recentSearches.length > 0 || POPULAR_SEARCHES.length > 0 || hasAiSuggestions)));

  const dropdownId = 'college-search-suggestions';

  return (
    <div ref={containerRef} className="colleges-search-bar" role="search">
      <span className="colleges-search-icon" aria-hidden="true">🔍</span>
      <input
        type="text"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={dropdownId}
        aria-autocomplete="list"
        aria-label="Search colleges by name, course, branch, city, district, state, NIRF rank, or college type"
        placeholder="Search college name, course, branch, city, NIRF rank..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitSearch(value);
          if (e.key === 'Escape') setIsFocused(false);
        }}
        className="input-editorial colleges-search-input"
      />
      {speechSupported && (
        <button
          type="button"
          className="smart-search-mic"
          onClick={toggleListening}
          aria-label={listening ? 'Stop voice search' : 'Search by voice'}
          title={listening ? 'Listening…' : 'Search by voice'}
          style={{ color: listening ? 'var(--accent-blue)' : undefined }}
        >
          {listening ? '●' : '🎤'}
        </button>
      )}
      {value && (
        <button
          type="button"
          className="colleges-search-clear"
          aria-label="Clear search"
          onClick={() => onChange('')}
        >
          ✕
        </button>
      )}

      {showDropdown && (
        <div id={dropdownId} className="colleges-search-dropdown" role="listbox">
          {suggestions.length > 0 && (
            <div className="colleges-search-section">
              <span className="colleges-search-section-title">Colleges</span>
              {suggestions.map((c) => (
                <button
                  key={c.id || c._id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="colleges-search-suggestion"
                  onClick={() => commitSearch(c.name)}
                >
                  <span>{c.name}</span>
                  <span className="colleges-search-suggestion-meta">{c.city}, {c.state}</span>
                </button>
              ))}
            </div>
          )}

          {!value.trim() && hasAiSuggestions && (
            <div className="colleges-search-section">
              <span className="colleges-search-section-title">✨ Trending</span>
              <div className="colleges-search-chips">
                {aiSuggestions!.trendingSearches.map((qTerm) => (
                  <button key={qTerm} type="button" className="colleges-search-chip" onClick={() => commitSearch(qTerm)}>
                    {qTerm}
                  </button>
                ))}
                {aiSuggestions!.suggestedQueries.slice(0, 5).map((qTerm) => (
                  <button key={qTerm} type="button" className="colleges-search-chip" onClick={() => commitSearch(qTerm)}>
                    {qTerm}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!value.trim() && recentSearches.length > 0 && (
            <div className="colleges-search-section">
              <span className="colleges-search-section-title">Recent Searches</span>
              <div className="colleges-search-chips">
                {recentSearches.map((term) => (
                  <button key={term} type="button" className="colleges-search-chip" onClick={() => commitSearch(term)}>
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!value.trim() && (
            <div className="colleges-search-section">
              <span className="colleges-search-section-title">Popular Searches</span>
              <div className="colleges-search-chips">
                {POPULAR_SEARCHES.map((term) => (
                  <button key={term} type="button" className="colleges-search-chip" onClick={() => commitSearch(term)}>
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
