import type { Insights } from '../lib/insights';
import { t } from './i18n';

const fmt = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

export default function InsightsScreen({ ins }: { ins: Insights }) {
  const irregular = ins.variability !== null && ins.variability > 4;
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
              <li><span className="date">{t.insRange}</span><span className="meta" style={{ marginLeft: 'auto' }}>{ins.shortest}–{ins.longest} {t.insDays}</span></li>
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
    </>
  );
}
