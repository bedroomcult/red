import { t } from './i18n';
import type { PredictionReason } from '../lib/predict';

// Why a given date reads the way it does.
//
// The calendar paints a ring and the old day sheet said only "this day falls in
// the predicted window", which states the conclusion without the reasoning. A
// user could not tell a 2-day window built from six logged cycles apart from a
// 10-day window built from one, and those deserve different trust.
//
// Rendered as one verdict line plus a definition list, with the long caveats
// folded into a disclosure. The previous version stacked five label/value blocks
// of prose, which read as a wall even though every sentence was short.

const fmtShort = (d: string) =>
  new Date(d + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

function offsetText(days: number | null): string | null {
  if (days === null) return null;
  if (days === 0) return t.predOffsetPeak;
  return days < 0
    ? t.predOffsetBefore.replace('{n}', String(Math.abs(days)))
    : t.predOffsetAfter.replace('{n}', String(days));
}

export default function PredictionDetail({ date, reason }: { date: string; reason: PredictionReason }) {
  const { kind } = reason;

  // A paused cycle or no data: explain the absence rather than showing empty rows.
  if (kind === 'bc' || kind === 'no-data') {
    return (
      <div className="day-group">
        <div className="day-info">
          <div className="day-info-label">{t.predWhy}</div>
          <div className="day-info-value">
            {kind === 'bc' ? t.predBcPaused : t.predNoData}
            {kind === 'no-data' && <div className="day-info-sub">{t.predNeedTwo}</div>}
          </div>
        </div>
      </div>
    );
  }

  const offset = offsetText(reason.daysFromNext);
  const basis = reason.estimated
    ? t.predBasisEstimated.replace('{avg}', String(reason.avgCycle ?? 28))
    : t.predBasisObserved.replace('{n}', String(reason.observedCycles)).replace('{avg}', String(reason.avgCycle ?? ''));

  const verdict =
    kind === 'in-window' ? t.dayPredictedValue
      : kind === 'ovulation' ? t.dayOvulationValue
      : kind === 'fertile' ? t.dayFertileValue
      : null;

  return (
    <div className="day-group">
      {/* Verdict first, and only the verdict. Everything else is supporting
          detail, folded away: the sheet previously opened with 14 text nodes
          for one conclusion, four of them labels repeating their own value. */}
      <div className="day-info">
        <div className="day-info-label">{t.predWhy}</div>
        <div className="day-info-value">
          {verdict ? <strong>{verdict}</strong> : <span className="muted">{t.predOutside}</span>}
        </div>
      </div>

      <details className="more">
        <summary>{t.predMore}</summary>
        <dl className="facts">
          {offset && (<><dt>{t.predOffsetLabel}</dt><dd>{offset}</dd></>)}
          {reason.windowLo && reason.windowHi && (
            <>
              <dt>{t.predWindowTitle}</dt>
              <dd>
                {t.predWindowRange.replace('{a}', fmtShort(reason.windowLo)).replace('{b}', fmtShort(reason.windowHi))}
                {reason.windowDays !== null && (
                  <span className="facts-sub">{t.predWindowWidth.replace('{n}', String(reason.windowDays))}</span>
                )}
              </dd>
            </>
          )}
          {kind === 'outside' && reason.daysFromNext !== null && (
            <>
              <dt>{t.predOutsideLabel}</dt>
              <dd>
                {fmtShort(new Date(Date.parse(date + 'T00:00:00Z') - reason.daysFromNext * 864e5).toISOString().slice(0, 10))}
              </dd>
            </>
          )}
          <dt>{t.predBasis}</dt>
          <dd>{basis}</dd>
          {reason.spread !== null && (
            <>
              <dt>{t.predSpreadLabel}</dt>
              <dd>
                {reason.spread === 0
                  ? t.predSpreadStable
                  : (
                    <>
                      {t.predSpread.replace('{n}', String(reason.spread))}
                      {reason.irregular && <span className="facts-sub">{t.predSpreadIrregular}</span>}
                    </>
                  )}
              </dd>
            </>
          )}
          {reason.ov && kind !== 'outside' && (
            <><dt>{t.dayFertile}</dt><dd>{t.predFertileReason.replace('{ov}', fmtShort(reason.ov))}</dd></>
          )}
        </dl>
        {reason.ecType && <p className="muted">{t.ecActiveHint}</p>}
        <p className="muted">{t.predConfidenceNote}</p>
      </details>
    </div>
  );
}
