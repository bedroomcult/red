import { useState } from 'react';
import { t } from './i18n';
import { apiFetch, readJson } from './api';
import type { Period } from './Calendar';

// Shown when an ongoing period (no end_date) has reached the user's expected
// period length. Rather than guessing, it asks. "Sudah selesai" sets the end
// date and closes the episode. "Masih haid" leaves it ongoing and hides the
// prompt for today, so the period keeps painting and the question returns
// tomorrow if the bleeding has not stopped.
export default function OngoingPrompt({ period, today, onSaved }: {
  period: Period;
  today: string;
  onSaved: (s: any) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  const dayCount = Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(period.start_date + 'T00:00:00Z')) / 864e5) + 1;

  async function save(endDate: string) {
    setBusy(true); setErr(null);
    try {
      const r = await apiFetch('/api/periods', {
        method: 'POST',
        body: JSON.stringify({
          id: period.id,
          start_date: period.start_date,
          end_date: endDate,
          type: period.type,
          flow: period.flow ?? undefined,
        }),
      });
      if (!r.ok) throw new Error((await readJson(r)).error ?? r.statusText);
      onSaved(await readJson(r));
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  if (hidden) return null;

  return (
    <div className="card ongoing-prompt" role="status">
      <h2>{t.ongoingTitle}</h2>
      <div className="muted" style={{ marginTop: -6 }}>
        {t.ongoingBody.replace('{n}', String(dayCount))}
      </div>
      <div className="row tight">
        <button className="btn primary" disabled={busy} onClick={() => save(today)}>{t.ongoingEnded}</button>
        <button className="btn" disabled={busy} onClick={() => setHidden(true)}>{t.ongoingStill}</button>
      </div>
      {err && <div className="err">{err}</div>}
    </div>
  );
}
