// Late-period dismissal, device-local like pt.theme and pt.reminders.
//
// The overdue card is hidden only while the prediction it was dismissed against
// is still the current one. A new prediction (after logging a period, or after
// the server rolls the window forward) yields a different date, so the card
// re-arms on its own — no manual reset and no stale boolean.
const KEY = 'pt.lateDismissed';

export const loadLateDismissed = (): string | null => {
  try { return localStorage.getItem(KEY); } catch { return null; }
};

export const saveLateDismissed = (date: string) => {
  try { localStorage.setItem(KEY, date); } catch { /* ignore */ }
};

export const clearLateDismissed = () => {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
};
