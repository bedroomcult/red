import { t } from './i18n';
import { pregnancyChance, barWidth, type Risk } from '../lib/chance';
import type { Prediction } from './Calendar';

// Estimated pregnancy chance for today, with the number shown as a percentage.
//
// The framing is deliberate and load-bearing. It reports a *chance*, never a
// "safe day": no calendar method is reliable enough to tell someone they cannot
// get pregnant, and this app is not a contraceptive. The percentage is a
// population average for one act of intercourse on that day, assuming the
// predicted ovulation day is correct — which it may not be by a couple of days.
// The UI states both limits rather than presenting the number as personal.
const RISK_LABEL: Record<Risk, string> = {
  high: t.chanceHigh,
  medium: t.chanceMedium,
  low: t.chanceLow,
  unknown: t.chanceUnknown,
};

export default function ChanceCard({ date, prediction, bcMode }: {
  date: string;
  prediction: Prediction | null;
  bcMode: boolean;
}) {
  const c = pregnancyChance(date, prediction, bcMode);

  let when = '';
  if (c.offset !== null) {
    if (c.offset === 0) when = t.chancePeak;
    else if (c.offset < 0) when = t.chanceBefore.replace('{n}', String(Math.abs(c.offset)));
    else when = t.chanceAfter.replace('{n}', String(c.offset));
  }

  return (
    <div className={`card chance-card risk-${c.risk}`}>
      <h2>{t.chanceTitle}</h2>

      {c.risk === 'unknown' ? (
        <>
          <div className="chance-head">
            <span className="chance-badge risk-unknown">{RISK_LABEL.unknown}</span>
          </div>
          <div className="muted" style={{ marginTop: 8 }}>
            {bcMode ? t.chanceBcNote : t.chanceUnknownWhy}
          </div>
        </>
      ) : (
        <>
          <div className="chance-head">
            <span className={`chance-value risk-${c.risk}`}>
              {c.belowOne ? t.chanceBelowOne : `${c.percent}%`}
            </span>
            <span className={`chance-badge risk-${c.risk}`}>{RISK_LABEL[c.risk]}</span>
          </div>
          {when && <div className="muted chance-when">{when}</div>}

          <div className="chance-bar" role="img" aria-label={`${RISK_LABEL[c.risk]}, ${c.percent}%`}>
            <div className={`chance-fill risk-${c.risk}`} style={{ width: `${Math.max(barWidth(c), 3)}%` }} />
          </div>

          <div className="muted chance-note">{t.chanceSafeNote}</div>
          <div className="muted chance-note">{t.chanceAverageNote}</div>
        </>
      )}
      <div className="muted chance-note">{t.chanceDisclaimer}</div>
    </div>
  );
}
