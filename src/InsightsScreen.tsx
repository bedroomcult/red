import type { Insights } from '../lib/insights';
import { symptomHistory } from '../lib/symptom-history';
import type { Period, Prediction } from './Calendar';
import { t } from './i18n';

const fmt = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtShort = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

const SYM_LABEL: Record<string, string> = {
  cramps: t.symCramps, bloating: t.symBloating, headache: t.symHeadache, mood: t.symMood,
  tired: t.symTired, breast: t.symBreast, acne: t.symAcne, craving: t.symCraving,
};

const PHASE_LABEL: Record<string, string> = {
  period: t.phasePeriod, fertile: t.phaseFertile, ovulation: t.phaseOvulation,
  pms: t.phasePms, neutral: t.phaseNeutral, bc: t.phaseBc,
};

// Phase order for the per-phase breakdown, so the bars read in cycle order
// rather than by whatever count happens to be largest.
const PHASE_ORDER = ['period', 'fertile', 'ovulation', 'pms', 'neutral', 'bc'];

export default function InsightsScreen({ ins, periods = [], prediction = null, bcMode = false, symptomLog = [] }: {
  ins: Insights;
  periods?: Period[];
  prediction?: Prediction | null;
  bcMode?: boolean;
  symptomLog?: { date: string; kind: string }[];
}) {
  const irregular = ins.variability !== null && ins.variability > 4;
  const hist = symptomHistory(symptomLog, periods, prediction, bcMode);
  // Largest per-phase count, so each bar can be scaled against the tallest.
  const maxPhase = Math.max(1, ...Object.values(hist.byPhase));
  return (
    <>
      <div className="card">
        <h2>{t.insTitle}</h2>
        {ins.avgCycle === null ? (
          <div className="muted">{t.insEmpty}</div>
        ) : (
          <>
            <div className="pred">
              <span className="big">{ins.avgCycle}</span>
              <span className="muted">{t.insDays} · {t.insAvgCycle}</span>
            </div>
            <div className="row tight">
              {ins.avgPeriod !== null && <span className="badge grey">{t.insAvgPeriod}: {ins.avgPeriod} {t.insDays}</span>}
              {ins.variability !== null && (
                <span className={`badge ${irregular ? '' : 'green'}`}>
                  {t.insVar}: ±{ins.variability} {t.insDays} · {irregular ? t.insIrregular : t.insRegular}
                </span>
              )}
            </div>
            <ul className="list" style={{ marginTop: 12 }}>
              <li><span className="date">{t.insRange}</span><span className="meta" style={{ marginLeft: 'auto' }}>{ins.shortest} sampai {ins.longest} {t.insDays}</span></li>
              <li><span className="date">{t.insCount}</span><span className="meta" style={{ marginLeft: 'auto' }}>{ins.count}</span></li>
            </ul>
          </>
        )}
      </div>

      {ins.next3.length > 0 && (
        <div className="card">
          <h2>{t.insNext3}</h2>
          <ul className="list">
            {ins.next3.map((d, i) => (
              <li key={d}>
                <span className="date">{fmt(d)}</span>
                <span className="meta" style={{ marginLeft: 'auto' }}>#{i + 1}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2>{t.symHistoryTitle}</h2>
        {hist.total === 0 ? (
          <div className="muted">{t.symHistoryEmpty}</div>
        ) : (
          <>
            <div className="row tight" style={{ marginTop: 0 }}>
              <span className="badge grey">{t.symHistoryTotal.replace('{n}', String(hist.total))}</span>
              <span className="badge grey">{t.symHistoryDays.replace('{n}', String(hist.days))}</span>
            </div>
            {hist.first && hist.last && (
              <div className="muted" style={{ marginTop: 8 }}>
                {t.symHistoryRange.replace('{first}', fmtShort(hist.first)).replace('{last}', fmtShort(hist.last))}
              </div>
            )}

            {/* Per kind, with the phase it clusters in. A kind without enough
                observations to name a phase says so instead of guessing. */}
            <ul className="list" style={{ marginTop: 12 }}>
              {hist.stats.map((s) => (
                <li key={s.kind}>
                  <span className="date">{SYM_LABEL[s.kind] ?? s.kind}</span>
                  <span className="meta" style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    {s.count}×
                    <div>
                      {s.topPhase
                        ? t.symHistoryTopPhase.replace('{phase}', PHASE_LABEL[s.topPhase] ?? s.topPhase)
                        : <span className="muted">{t.symHistoryNoPhase}</span>}
                    </div>
                  </span>
                </li>
              ))}
            </ul>

            {/* Which phases carry symptoms overall. Bars are scaled against the
                largest bucket, so the shape is readable at any volume. */}
            <div className="muted" style={{ marginTop: 16, marginBottom: 6 }}>{t.symByPhaseTitle}</div>
            {PHASE_ORDER.filter((p) => hist.byPhase[p]).map((p) => (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 96 }}>{PHASE_LABEL[p]}</span>
                <span className="chance-bar" style={{ flex: 1, marginTop: 0 }}>
                  <span
                    className="chance-fill"
                    style={{ width: `${Math.round((hist.byPhase[p] / maxPhase) * 100)}%`, background: 'var(--rose)' }}
                  />
                </span>
                <span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 24, textAlign: 'right' }}>{hist.byPhase[p]}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}
