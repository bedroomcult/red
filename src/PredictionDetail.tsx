import { t } from './i18n';
import type { PredictionReason } from '../lib/predict';

// Why a given date reads the way it does.
//
// The calendar paints a ring and the old day sheet said only "this day falls in
// the predicted window", which states the conclusion without the reasoning. A
// user could not tell a 2-day window built from six logged cycles apart from a
// 10-day window built from one, and those deserve different trust.
//
// Every branch states the basis, not just the result. Where the data cannot
// support a statement (an estimated average, a spread tie) the copy says so
// rather than presenting a guess as a measurement.

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

  // A cycle paused by contraception, or no data at all: explain the absence
  // rather than showing empty rows.
  if (kind === 'bc') {
    return (
      <div className="day-info">
        <div className="day-info-label">{t.predWhy}</div>
        <div className="day-info-value">{t.predBcPaused}</div>
      </div>
    );
  }
  if (kind === 'no-data') {
    return (
      <div className="day-info">
        <div className="day-info-label">{t.predWhy}</div>
        <div className="day-info-value">
          {t.predNoData}
          <div className="muted" style={{ marginTop: 4 }}>{t.predNeedTwo}</div>
        </div>
      </div>
    );
  }

  const offset = offsetText(reason.daysFromNext);

  // What the average was built from. An estimated average is named as the
  // configured fallback, never presented as an observation.
  const basis = reason.estimated
    ? t.predBasisEstimated.replace('{avg}', String(reason.avgCycle ?? 28))
    : t.predBasisObserved.replace('{n}', String(reason.observedCycles)).replace('{avg}', String(reason.avgCycle ?? ''));

  return (
    <>
      {/* The result: which window this date lands in. */}
      <div className="day-info">
        <div className="day-info-label">{t.predWhy}</div>
        <div className="day-info-value">
          {kind === 'in-window' && <strong>{t.dayPredictedValue}</strong>}
          {kind === 'ovulation' && <strong>{t.dayOvulationValue}</strong>}
          {kind === 'fertile' && <strong>{t.dayFertileValue}</strong>}
          {kind === 'outside' && (
            <span className="muted">
              {t.predOutside}
              {reason.daysFromNext !== null && (
                <>
                  {' · '}
                  {t.predOutsideNext.replace('{d}', fmtShort(
                    new Date(Date.parse(date + 'T00:00:00Z') - reason.daysFromNext * 864e5).toISOString().slice(0, 10)
                  ))}
                </>
              )}
            </span>
          )}
          {offset && <div className="muted" style={{ marginTop: 4 }}>{offset}</div>}
        </div>
      </div>

      {/* The window itself, stated with its width so the reader can judge it. */}
      {reason.windowLo && reason.windowHi && (
        <div className="day-info">
          <div className="day-info-label">{t.predWindowTitle}</div>
          <div className="day-info-value">
            {t.predWindowRange.replace('{a}', fmtShort(reason.windowLo)).replace('{b}', fmtShort(reason.windowHi))}
            {reason.windowDays !== null && (
              <span className="muted"> · {t.predWindowWidth.replace('{n}', String(reason.windowDays))}</span>
            )}
          </div>
        </div>
      )}

      {/* The basis: how many cycles, what average, how wide a spread. */}
      <div className="day-info">
        <div className="day-info-label">{t.predBasis}</div>
        <div className="day-info-value">
          {basis}
          {reason.spread !== null && reason.spread > 0 && (
            <div className="muted" style={{ marginTop: 4 }}>
              {t.predSpread.replace('{n}', String(reason.spread))}
              {reason.irregular && <> · {t.predSpreadIrregular}</>}
            </div>
          )}
          {reason.spread === 0 && (
            <div className="muted" style={{ marginTop: 4 }}>{t.predSpreadStable}</div>
          )}
        </div>
      </div>

      {/* The fertile window has its own basis, so state it separately. */}
      {reason.ov && reason.kind !== 'outside' && (
        <div className="day-info">
          <div className="day-info-label">{t.dayFertile}</div>
          <div className="day-info-value">
            {t.predFertileReason.replace('{ov}', fmtShort(reason.ov))}
          </div>
        </div>
      )}

      {reason.ecType && (
        <div className="day-info">
          <div className="day-info-value muted">{t.ecActiveHint}</div>
        </div>
      )}

      <div className="day-info">
        <div className="day-info-value muted">{t.predConfidenceNote}</div>
      </div>
    </>
  );
}
