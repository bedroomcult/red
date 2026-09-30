import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The calendar renders the fertile window as a solid green ring and the peak as
// a dashed one. Both are pure CSS driven by the class list, so the classes and
// their styles are the contract — a rename on one side would silently drop the
// marker rather than fail a typecheck.
//
// fileURLToPath, not URL.pathname: on Windows pathname yields "/C:/...", and
// prefixing that to a relative path produced "C:\C:\...", so every read failed.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CAL = readFileSync(ROOT + 'src/Calendar.tsx', 'utf8');
const CSS = readFileSync(ROOT + 'src/index.css', 'utf8');
// Day-state classification moved into a shared module so the month grid and the
// home week strip cannot drift apart. The peak-order and staleness invariants
// are asserted against that module now.
const DAYSTATE = readFileSync(ROOT + 'src/dayState.ts', 'utf8');

describe('ovulation peak marker', () => {
  it('gives the peak its own class, distinct from the window', () => {
    expect(DAYSTATE).toContain("'pred-ovulation'");
    expect(DAYSTATE).toContain("'pred-fertile'");
  });

  it('checks the peak before the window, so the window cannot swallow it', () => {
    // The peak day is also in the fertile set, so the order of the checks
    // decides which class wins. Peak must be tested first.
    const peak = DAYSTATE.indexOf("ovDays.has(d)) return 'pred-ovulation'");
    const window = DAYSTATE.indexOf("ovs.has(d)) return 'pred-fertile'");
    expect(peak).toBeGreaterThan(-1);
    expect(window).toBeGreaterThan(-1);
    expect(peak).toBeLessThan(window);
  });

  it('styles the peak as a solid distinct fill', () => {
    // The new DESIGN.md makes the peak a solid fill in the peak hue, distinct
    // from the dashed predicted-period outline and the light fertile fill.
    expect(CSS).toMatch(/\.dnum\.pred-ovulation\s*\{[^}]*background:\s*var\(--ovulation\)/);
    expect(CSS).toMatch(/\.dnum\.pred-ovulation\s*\{[^}]*color:\s*#fff/);
  });

  it('keeps the peak distinct from the logged fill', () => {
    // A logged day fills with --period; the peak fills with --ovulation, so the
    // two are still distinguishable. Predicted days stay dashed, not filled.
    const predBlock = /\.dnum\.pred-period\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(predBlock).toMatch(/border-style:\s*dashed/);
    expect(predBlock).not.toMatch(/background:/);
  });

  it('the week strip marks days exactly like the calendar', () => {
    // One shared classifier feeds both surfaces, so they cannot drift.
    const calendar = readFileSync(ROOT + 'src/Calendar.tsx', 'utf8');
    const home = readFileSync(ROOT + 'src/Home.tsx', 'utf8');
    const week = readFileSync(ROOT + 'src/WeekStrip.tsx', 'utf8');
    expect(calendar).toMatch(/makeDayState/);
    expect(home).toMatch(/makeDayState/);
    expect(week).toMatch(/dayClass/);
    // Every state the classifier can return has a week-strip style, mirroring
    // the .dnum rules.
    for (const s of ['logged', 'pred-period', 'pred-fertile', 'pred-ovulation']) {
      expect(CSS, `week ${s}`).toMatch(new RegExp(`\\.week-num\\.${s}\\s*\\{`));
    }
    // Today is a ring, never a fill: a filled circle already means "logged".
    const todayRule = /\.week-num\.today\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(todayRule).toMatch(/box-shadow:\s*inset/);
    expect(todayRule).not.toMatch(/background:\s*var\(--period\)/);
  });

  it('hides the next-cycle peak when the prediction is stale', () => {
    // Only the single next prediction can go stale; the projections are derived
    // from the latest logged period and are always forward-looking.
    expect(DAYSTATE).toMatch(/if \(!stale && !ovStale && prediction\?\.ov\) ovDates\.add/);
  });

  it('has a legend entry and chip for the peak', () => {
    expect(CAL + readFileSync(ROOT + 'src/App.tsx', 'utf8')).toContain('chip ovulation');
    expect(readFileSync(ROOT + 'src/i18n.ts', 'utf8')).toContain('legendOvulation');
    expect(CSS).toMatch(/\.chip\.ovulation\s*\{[^}]*background:\s*var\(--ovulation\)/);
  });
});

// The calendar marks projected periods from insights.next6, not just the single
// next window. Without that, browsing a later month showed nothing, which is why
// November's prediction was invisible.
describe('calendar multi-cycle projection', () => {
  it('accepts futureStarts and marks them', () => {
    expect(DAYSTATE).toContain('futureStarts');
    expect(DAYSTATE).toContain('predDays');
  });

  it('filters out dates that have already passed', () => {
    // The projection is filtered in App before it reaches the classifier.
    const app = readFileSync(ROOT + 'src/App.tsx', 'utf8');
    expect(app).toMatch(/futureStarts=\{me\.insights\?\.next6/);
  });

  it('is fed from the insights projection in App', () => {
    const app = readFileSync(ROOT + 'src/App.tsx', 'utf8');
    expect(app).toMatch(/futureStarts=\{me\.insights\?\.next6/);
  });
});

// A predicted period is a range, not a day. Marking only the projected start left
// cycles 2-6 as a single highlighted cell, so a month looked like a one-day period.
describe('predicted period paints the whole period', () => {
  it('expands each projected start by periodLen', () => {
    expect(DAYSTATE).toMatch(/periodLen - 1\) \* DAY/);
  });

  it('applies the expansion to every projected cycle, not just the first', () => {
    // The loop must be over every projected start, with no `.slice(1)` shortcut
    // that would leave the later cycles as single days.
    expect(DAYSTATE).toMatch(/for \(const start of futureStarts\)/);
    expect(DAYSTATE).not.toMatch(/futureStarts\.slice\(1\)/);
  });

  it('takes periodLen from the caller', () => {
    const app = readFileSync(ROOT + 'src/App.tsx', 'utf8');
    expect(app).toMatch(/periodLen=\{me\.profile\?\.period_len/);
  });

  it('defaults to 5 days when no period length is set', () => {
    expect(DAYSTATE).toMatch(/periodLen = 5/);
  });
});

// Reported: the Wawasan list showed periods that had already passed, the calendar
// replaced the day number with a checkmark, and the grid left the last row half
// empty instead of showing the start of the next month.
describe('calendar and projection display fixes', () => {
  it('keeps the day number on a logged day instead of a checkmark', () => {
    expect(CAL).not.toContain("'✓'");
    expect(CAL).toMatch(/dnum-num">\{Number\(d\.slice\(8\)\)\}/);
  });

  it('pads the grid with the neighbouring months, marked out of month', () => {
    expect(CAL).toMatch(/inMonth: false/);
    expect(CAL).toMatch(/cells\.length % 7 !== 0/);
    expect(CAL).toMatch(/cell\.inMonth \? '' : 'dim'/);
  });

  it('still pads whole weeks when the month already ends on a Sunday', () => {
    // No leading or trailing padding needed; the loop must simply not add any.
    const src = CAL.slice(CAL.indexOf('function monthCells'), CAL.indexOf('const parse'));
    expect(src).toMatch(/while \(cells\.length % 7 !== 0\)/);
  });

  it('animates the grid on month change, in the direction of travel', () => {
    expect(CAL).toMatch(/slide-next|slide-prev/);
    const css = readFileSync(ROOT + 'src/index.css', 'utf8');
    expect(css).toMatch(/@keyframes slide-next/);
    expect(css).toMatch(/@keyframes slide-prev/);
  });

  it('drops past dates from the projection at render time, not just on the server', () => {
    const screen = readFileSync(ROOT + 'src/InsightsScreen.tsx', 'utf8');
    expect(screen).toMatch(/next6\.filter\(\(d\) => d >= today\)/);
  });

  it('keeps the sheet scannable: no symptom-recurrence analysis in it', () => {
    const day = readFileSync(ROOT + 'src/DaySheet.tsx', 'utf8');
    // The sheet shows what happened that day. Recurrence is analysis and lives
    // on the Wawasan tab, so neither the per-kind rows nor the summary belong.
    expect(day).not.toMatch(/s\.count\}×/);
    expect(day).not.toMatch(/symHistoryRecur/);
    const ins = readFileSync(ROOT + 'src/InsightsScreen.tsx', 'utf8');
    expect(ins).toMatch(/symHistoryTitle/);
  });

  it('folds prediction detail behind a disclosure', () => {
    const detail = readFileSync(ROOT + 'src/PredictionDetail.tsx', 'utf8');
    // Verdict outside, facts inside <details>, so the default render is short.
    const before = detail.slice(0, detail.indexOf('<details'));
    expect(before).toContain('predWhy');
    expect(before).not.toContain('<dl className="facts">');
    expect(detail).toMatch(/<details className="more">[\s\S]*<dl className="facts">/);
  });

  it('uses labelled text chips per tracked item, not icon-only rows', () => {
    const day = readFileSync(ROOT + 'src/DaySheet.tsx', 'utf8');
    // Icon-only check/cross/dash read as right/wrong/clear, not taken/missed.
    // Card headers may use decorative icons alongside text labels.
    expect(day).not.toMatch(/className="seg-row"/);
    expect(day).toMatch(/from '.\/Icon'/);
    for (const k of ['doseTaken', 'doseMissed', 'sexProtected', 'sexUnprotected']) {
      expect(day).toContain(`{t.${k}}`);
    }
    // Tapping the active chip clears, so there is no third clear button.
    expect(day).not.toMatch(/\{t\.(doseClear|sexClear)\}/);
    // Symptoms and note edit in place instead of rendering read-only.
    expect(day).toMatch(/toggleSym/);
    expect(day).toMatch(/<textarea/);
  });

  it('renders the day as an icon card grid with period quick-log', () => {
    const day = readFileSync(ROOT + 'src/DaySheet.tsx', 'utf8');
    // Six cards: verdict, symptoms, note, pill, sex, period.
    for (const icon of ['info', 'pulse', 'pencil', 'pill', 'heart', 'droplet']) {
      expect(day, icon).toContain(`name="${icon}"`);
    }
    // One open modal at a time, reset when the date changes.
    expect(day).toMatch(/activeModal/);
    expect(day).toMatch(/setActiveModal\(null\)/);
    // Quick-log posts with the last used flow; cancelling deletes the row.
    expect(day).toMatch(/\/api\/periods', \{ method: 'POST'/);
    expect(day).toMatch(/\/api\/periods\?id=' \+ startLog\.id/);
    // Mid-range dates open LogSheet instead of posting a duplicate row.
    expect(day).toMatch(/if \(inRange\) \{ onLog\(date\); return; \}/);
    // The verdict modal opens with or without a prediction: no `&& reason`
    // guard on the render path, and the no-data fallback exists.
    expect(day).toMatch(/activeModal === 'why' && \(/);
    expect(day).not.toMatch(/activeModal === 'why' && reason/);
    expect(day).toMatch(/NO_DATA_REASON/);
    // Period cancel is confirm-gated: first tap arms, second deletes.
    // The destructive action never uses the dismiss word.
    expect(day).toMatch(/confirmCancel/);
    expect(day).toMatch(/dayPeriodCancelYes/);
    // Sex modal warns on fertile dates with or without a log; the grid
    // preview still requires one.
    const modal = day.slice(day.indexOf("activeModal === 'sex'"));
    expect(modal).toMatch(/\{inFertile && \(/);
    expect(modal).not.toMatch(/\{sexLocal && inFertile && \(/);
    // New classes must exist in the stylesheet (class-coverage holds this).
    const css = readFileSync(ROOT + 'src/index.css', 'utf8');
    for (const c of ['day-grid', 'day-card', 'day-card-top', 'day-card-value', 'day-card-link', 'modal', 'modal-overlay', 'modal-head', 'modal-body']) {
      expect(css, c).toContain(`.${c}`);
    }
  });
});

// Reported: the day-detail sheet was still a wall of text, the nav was a full-width
// bar, and the Android back button did nothing.
describe('day sheet, nav and back button', () => {
  it('renders prediction detail as a definition list, not stacked prose', () => {
    const detail = readFileSync(ROOT + 'src/PredictionDetail.tsx', 'utf8');
    expect(detail).toMatch(/<dl className="facts">/);
    expect(detail).toMatch(/<details className="more">/);
  });

  it('has the new i18n keys the detail list needs', () => {
    const i18n = readFileSync(ROOT + 'src/i18n.ts', 'utf8');
    for (const k of ['predOffsetLabel', 'predOutsideLabel', 'predSpreadLabel', 'predMore']) {
      expect(i18n, k).toContain(k);
    }
  });

  it('the nav is a docked bar with a hairline top border', () => {
    // The new DESIGN.md docks the bar (spec 2.3) and drops the floating pill.
    const css = readFileSync(ROOT + 'src/index.css', 'utf8');
    const rule = /\.tabbar\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toMatch(/border-top:\s*1px solid var\(--line\)/);
    expect(rule).toMatch(/bottom:\s*0/);
  });

  it('content clears the docked bar', () => {
    const css = readFileSync(ROOT + 'src/index.css', 'utf8');
    const app = /\.app\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    // Bottom padding must clear the docked bar plus the safe-area inset, and
    // the top reserves the status-bar inset because the WebView draws under it.
    expect(app).toMatch(/padding:\s*calc\(var\(--s-5\) \+ env\(safe-area-inset-top\)\)\s+var\(--s-5\)\s+calc\(96px \+ env\(safe-area-inset-bottom\)\)/);
  });

  it('registers an Android back handler', () => {
    const app = readFileSync(ROOT + 'src/App.tsx', 'utf8');
    expect(app).toContain('ExitConfirm');
    const exit = readFileSync(ROOT + 'src/ExitConfirm.tsx', 'utf8');
    expect(exit).toMatch(/addListener\('backButton'/);
    expect(exit).toMatch(/exitApp\(\)/);
  });

  it('the back handler closes a sheet before offering to exit', () => {
    const app = readFileSync(ROOT + 'src/App.tsx', 'utf8');
    const handler = app.slice(app.indexOf('onRequestClose={()'), app.indexOf('canGoHome='));
    expect(handler).toMatch(/if \(logDate\) setLogDate\(null\)/);
    expect(handler).toMatch(/return true/);
  });

  it('shows home symptoms in every phase, not just three', () => {
    const home = readFileSync(ROOT + 'src/Home.tsx', 'utf8');
    expect(home).toContain('homeSymptomsToday');
    expect(home).not.toMatch(/st\.phase === 'period' \|\| st\.phase === 'pms'/);
  });

  it('traps Tab focus inside the card modal', () => {
    const modal = readFileSync(ROOT + 'src/DayModal.tsx', 'utf8');
    expect(modal).toMatch(/e\.key !== 'Tab'/);
    expect(modal).toMatch(/querySelectorAll/);
  });

  it('the last tab is a profile that opens settings above it', () => {
    const app = readFileSync(ROOT + 'src/App.tsx', 'utf8');
    expect(app).toContain('ProfileScreen');
    expect(app).toMatch(/tab === 'profile'/);
    expect(app).not.toMatch(/tab === 'settings'/);
    expect(app).toMatch(/settingsOpen/);
    const prof = readFileSync(ROOT + 'src/ProfileScreen.tsx', 'utf8');
    expect(prof).toMatch(/onOpenSettings/);
    expect(prof).toMatch(/onLogout/);
    const set = readFileSync(ROOT + 'src/SettingsScreen.tsx', 'utf8');
    expect(set).toMatch(/onBack/);
  });
});
