/** Returns a Date that is `minutes` minutes from now. Used across multiple modules for token expiry. */
export const minutesFromNow = (minutes: number): Date =>
  new Date(Date.now() + minutes * 60 * 1000);

/** True if the given year is strictly before the current calendar year. */
export const isYearInPast = (year: number): boolean =>
  year < new Date().getFullYear();
