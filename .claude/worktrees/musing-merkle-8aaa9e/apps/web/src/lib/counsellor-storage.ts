// localStorage-backed UI state for the AI Counsellor: pinned sessions,
// renamed-session titles, and bookmarked messages. Deliberately client-only
// (per-device, not synced) — the backend's AiConversation model has no
// isPinned/rename-title/message-bookmark field, and adding one is out of
// scope for this UI-only redesign. Mirrors the shape of colleges-storage.ts.

const PINNED_KEY = 'cc_counsellor_pinned_sessions';
const TITLES_KEY = 'cc_counsellor_session_titles';
const BOOKMARKS_KEY = 'cc_counsellor_bookmarks';

function readList(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeList(key: string, list: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(list));
}

function readMap(key: string): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeMap(key: string, map: Record<string, string>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(map));
}

// ── Pinned sessions ──────────────────────────────────────────────────────

export function readPinnedIds(): string[] {
  return readList(PINNED_KEY);
}

export function togglePinned(sessionId: string): string[] {
  const current = readPinnedIds();
  const updated = current.includes(sessionId) ? current.filter(id => id !== sessionId) : [...current, sessionId];
  writeList(PINNED_KEY, updated);
  return updated;
}

// ── Renamed session titles ──────────────────────────────────────────────

export function readSessionTitles(): Record<string, string> {
  return readMap(TITLES_KEY);
}

export function setSessionTitle(sessionId: string, title: string): Record<string, string> {
  const current = readMap(TITLES_KEY);
  const trimmed = title.trim();
  const updated = trimmed ? { ...current, [sessionId]: trimmed } : current;
  if (trimmed) writeMap(TITLES_KEY, updated);
  return updated;
}

// ── Bookmarked messages ──────────────────────────────────────────────────

function bookmarkKey(sessionId: string, messageIndex: number): string {
  return `${sessionId}:${messageIndex}`;
}

export function readBookmarks(): string[] {
  return readList(BOOKMARKS_KEY);
}

export function isBookmarked(sessionId: string, messageIndex: number): boolean {
  return readBookmarks().includes(bookmarkKey(sessionId, messageIndex));
}

export function toggleBookmark(sessionId: string, messageIndex: number): string[] {
  const key = bookmarkKey(sessionId, messageIndex);
  const current = readBookmarks();
  const updated = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
  writeList(BOOKMARKS_KEY, updated);
  return updated;
}
