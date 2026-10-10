import { useState } from 'react';
import { t } from './i18n';
import { apiFetch, readJson } from './api';
import type { Period } from './Calendar';

// Shown when an ongoing period (no end_date) has reached the user's expected
// period length. Rather than guessing, it asks. "Sudah selesai" closes the
// episode at yesterday, so today already reads as clean. "Masih haid" leaves it ongoing and hides the
// prompt for today, so the period keeps painting and the question returns
// tomorrow if the bleeding has not stopped.
export default function OngoingPrompt({ period, today, onSaved, onSyncFail }: {
  period: Period;
  today: string;
  onSaved: (s: any) => void;
  onSyncFail: (retry: () => void) => void;
}) {
  const [hidden, setHidden] = useState(false);

  const dayCount = Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(period.start_date + 'T00:00:00Z')) / 864e5) + 1;

  // Last bleeding day is yesterday, clamped to start_date for 1-day edge case.
  const yesterday = new Date(Date.parse(today + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10);
  const endDay = yesterday < period.start_date ? period.start_date : yesterday;

  async function save(endDate: string) {
    const body = JSON.stringify({
      id: period.id,
      start_date: period.start_date,
      end_date: endDate,
      type: period.type,
      flow: period.flow ?? undefined,
    });
    const run = async () => {
      const r = await apiFetch('/api/periods', { method: 'POST', body });
      if (!r.ok) throw new Error((await readJson(r)).error ?? r.statusText);
      onSaved(await readJson(r));
    };
    // Same close-then-sync as the sheets: ending a period hides the prompt
    // first, so a slow network never leaves the buttons frozen. Failure
    // retries from the banner via onSyncFail.
    setHidden(true);
    try { await run(); } catch { setHidden(false); onSyncFail(() => { void run().catch(() => onSyncFail(() => {})); }); }
  }

  if (hidden) return null;

  return (
    <div className="card ongoing-prompt" role="status">
      <h2>{t.ongoingTitle}</h2>
      <div className="muted" style={{ marginTop: -6 }}>
        {t.ongoingBody.replace('{n}', String(dayCount))}
      </div>
      <div className="row tight">
        <button className="btn primary" onClick={() => save(endDay)}>{t.ongoingEnded}</button>
        <button className="btn" onClick={() => setHidden(true)}>{t.ongoingStill}</button>
      </div>
    </div>
  );
}
