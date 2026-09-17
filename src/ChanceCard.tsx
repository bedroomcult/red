import { t } from './i18n';
import { pregnancyChance, chancePercent, type Risk } from '../lib/chance';
import type { Prediction } from './Calendar';

// Estimated pregnancy chance for today, with an explicit day-status readout.
//
// The framing is deliberate. It reports a *chance*, never a "safe day": no
// calendar method is reliable enough to justify telling someone they cannot get
// pregnant, and this app is not a contraceptive. A low estimate is shown as low,
// alongside the note that low is not safe.
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
  const pct = chancePercent(c);

  let when = '';
  if (c.offset !== null) {
    if (c.offset === 0) when = t.chancePeak;
    else if (c.offset < 0) when = t.chanceBefore.replace('{n}', String(Math.abs(c.offset)));
    else when = t.chanceAfter.replace('{n}', String(c.offset));
  }

  return (
    <div className={`card chance-card risk-${c.risk}`}>
      <h2>{t.chanceTitle}</h2>
      <div className="chance-head">
        <span className={`chance-badge risk-${c.risk}`}>{RISK_LABEL[c.risk]}</span>
        {when && <span className="muted chance-when">{when}</span>}
      </div>

      {c.risk === 'unknown' ? (
        <div className="muted" style={{ marginTop: 8 }}>
          {bcMode ? t.chanceBcNote : t.chanceUnknownWhy}
        </div>
      ) : (
        <>
          <div className="chance-bar" role="img" aria-label={`${RISK_LABEL[c.risk]} (${pct}%)`}>
            <div className={`chance-fill risk-${c.risk}`} style={{ width: `${Math.max(pct, 2)}%` }} />
          </div>
          <div className="muted chance-note">{t.chanceSafeNote}</div>
        </>
      )}
      <div className="muted chance-note">{t.chanceDisclaimer}</div>
    </div>
  );
}
