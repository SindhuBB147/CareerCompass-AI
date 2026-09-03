// localStorage-backed compare-selection state for the Colleges module.
// Shared between the directory grid and the college details page so "Add
// to Compare" from a detail page and the directory's compare checkboxes
// operate on the same list instead of silently diverging. Ephemeral and
// deliberately not backed by the API — comparing colleges on the public
// directory doesn't require login (see lib/wishlist-api.ts for the
// separate, backend-backed "Compare Later" flow on the /wishlist page).
//
// Saved-colleges/favorites state used to live here too; it's now
// backend-backed via lib/wishlist-api.ts (see the Saved Colleges &
// Wishlist module) since it needs to survive devices and drive
// notifications/AI insights.

const COMPARE_KEY = 'cc_college_compare_ids';
export const MAX_COMPARE = 4;

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

export function readCompareIds(): string[] {
  return readList(COMPARE_KEY);
}

export function toggleCompareId(id: string): string[] {
  const current = readCompareIds();
  const updated = current.includes(id)
    ? current.filter((c) => c !== id)
    : current.length >= MAX_COMPARE ? current : [...current, id];
  writeList(COMPARE_KEY, updated);
  return updated;
}

export function clearCompareIds(): string[] {
  writeList(COMPARE_KEY, []);
  return [];
}
