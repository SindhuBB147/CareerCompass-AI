// Shared fallback handling for college banner/gallery images across the
// College Card, Profile Hero, Gallery, Saved/Compare cards, AI Counsellor
// citation cards, and Prediction results — the surfaces enumerated in
// colleges-api.ts's College/GalleryItem types. Centralized here so all of
// them fail the same way (the branded placeholder, never a broken-image
// icon) instead of each screen reinventing its own onError handler.

import type { SyntheticEvent } from 'react';

export const COLLEGE_PLACEHOLDER_IMAGE = '/images/college-placeholder.svg';

/**
 * Attach to an <img>'s onError. Swaps to the placeholder and clears the
 * handler so a broken placeholder path can't recurse.
 */
export function onCollegeImageError(e: SyntheticEvent<HTMLImageElement>): void {
  const img = e.currentTarget;
  if (img.src.endsWith(COLLEGE_PLACEHOLDER_IMAGE)) return;
  img.onerror = null;
  img.src = COLLEGE_PLACEHOLDER_IMAGE;
}

export function collegeImageSrc(url: string | null | undefined): string {
  return url && url.trim() ? url : COLLEGE_PLACEHOLDER_IMAGE;
}
