// Local notifications for pill + period reminders.
// ponytail: Capacitor LocalNotifications on native, Web Notification API in the
// browser (best-effort, requires user gesture). No server, no push infra.

type Scheduled = { id: number; title: string; body: string; at: Date };

let native: any = null;
async function getNative() {
  if (native !== null) return native;
  try {
    // Dynamic import so the web bundle never hard-depends on the plugin.
    const mod: any = await import('@capacitor/local-notifications');
    native = mod.LocalNotifications ?? null;
  } catch {
    native = false;
  }
  return native;
}

export async function notificationsSupported(): Promise<boolean> {
  const n = await getNative();
  if (n) return true;
  return typeof Notification !== 'undefined';
}

export async function requestPermission(): Promise<boolean> {
  const n = await getNative();
  if (n) {
    const r = await n.requestPermissions();
    return r.display === 'granted';
  }
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

const ID_PILL = 1001;
const ID_PERIOD = 1002;
const ID_UPDATE = 1003;
const ID_LOG = 1004;
const ALL_IDS = [{ id: ID_PILL }, { id: ID_PERIOD }, { id: ID_UPDATE }, { id: ID_LOG }];

// Last-notified update tag. A version notifies once; only a newer tag re-arms.
const LAST_UPDATE_KEY = 'pt.lastUpdateNotified';

export type ReminderPrefs = {
  pillEnabled: boolean;
  pillTime: string; // "HH:MM"
  periodEnabled: boolean;
  updateEnabled: boolean;
  logEnabled: boolean;
  logTime: string; // "HH:MM"
};

const DEFAULTS: ReminderPrefs = {
  pillEnabled: false, pillTime: '21:00', periodEnabled: true,
  updateEnabled: true, logEnabled: false, logTime: '21:00',
};

const KEY = 'pt.reminders';
export const loadPrefs = (): ReminderPrefs => {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
};
export const savePrefs = (p: ReminderPrefs) => {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
};

function atToday(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h || 21, m || 0, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

export type SyncCtx = {
  nextPeriod: string | null;
  // True when today already has any log entry (period, symptom, dose, sex,
  // note). The nudge schedules only for unlogged days.
  todayLogged: boolean;
};

export async function syncReminders(p: ReminderPrefs, nextPeriod: string | null, ctx?: Partial<SyncCtx>): Promise<void> {
  return syncRemindersCtx(p, { nextPeriod, todayLogged: ctx?.todayLogged ?? true });
}

async function syncRemindersCtx(p: ReminderPrefs, ctx: SyncCtx): Promise<void> {
  const n = await getNative();
  const jobs: Scheduled[] = [];

  // Android 8+ drops a notification whose channelId does not exist, silently:
  // no error, no notification. The channel has to be created before the first
  // schedule, and createChannel is idempotent, so it runs on every sync.
  if (n) {
    await n.createChannel({
      id: 'red-reminders',
      name: 'Pengingat',
      description: 'Pengingat pil KB dan perkiraan haid',
      importance: 4, // IMPORTANCE_HIGH: a reminder must surface, not sit in the shade
    }).catch(() => {});
  }
  if (p.pillEnabled) {
    jobs.push({ id: ID_PILL, title: 'Waktunya minum pil KB', body: `Pil KB ${p.pillTime}. Ketuk untuk mencatat di aplikasi.`, at: atToday(p.pillTime) });
  }
  if (p.periodEnabled && ctx.nextPeriod) {
    // 2 days before the predicted window starts. Plain millisecond math, not
    // setDate(): setDate works in local time while the parse is UTC, so a
    // device west of UTC landed on the wrong day.
    const at = new Date(Date.parse(ctx.nextPeriod + 'T09:00:00Z') - 2 * 864e5);
    if (at.getTime() > Date.now()) {
      jobs.push({ id: ID_PERIOD, title: 'Haid diperkirakan dekat', body: 'Perkiraan haid dalam 2 hari. Siapkan perlengkapan.', at });
    }
  }
  if (p.logEnabled && !ctx.todayLogged) {
    jobs.push({ id: ID_LOG, title: 'Waktunya mencatat hari ini', body: 'Belum ada catatan hari ini. Ketuk untuk mencatat.', at: atToday(p.logTime) });
  }
  // No scheduled job for the update check: a fired local notification can
  // only display text, never run code. The check runs at launch/foreground
  // via checkAndNotifyUpdate below; the repeating ID_UPDATE slot stays
  // reserved so a future background-fetch path can claim it.

  if (n) {
    await n.cancel({ notifications: ALL_IDS }).catch(() => {});
    if (jobs.length) {
      // Caught, not awaited bare: callers run this with `void`, so a rejection
      // (permission revoked, exact-alarm denied) would surface as an unhandled
      // promise rejection instead of a quiet no-op.
      await n.schedule({
        notifications: jobs.map((j) => {
          if (j.id === ID_PILL) {
            // Repeat daily at the chosen time.
            const [h, m] = p.pillTime.split(':').map(Number);
            return {
              id: j.id, title: j.title, body: j.body, channelId: 'red-reminders',
              schedule: { on: { hour: h || 21, minute: m || 0 }, repeats: true, allowWhileIdle: true },
            };
          }
          if (j.id === ID_LOG) {
            const [h, m] = p.logTime.split(':').map(Number);
            return {
              id: j.id, title: j.title, body: j.body, channelId: 'red-reminders',
              schedule: { on: { hour: h || 21, minute: m || 0 }, repeats: true, allowWhileIdle: true },
            };
          }
          return {
            id: j.id, title: j.title, body: j.body, channelId: 'red-reminders',
            schedule: { at: j.at, allowWhileIdle: true },
          };
        }),
      }).catch(() => {});
    }
    return;
  }

  // Web fallback: no scheduling API, so nothing persists. Fire nothing silently.
  // ponytail: web reminders need a server/cron; out of scope. Native app is the target.
}

// Check for a newer release and notify once per version. Returns true when
// a notice fired. Silent on offline/rate-limit/denied: never nags.
export async function checkAndNotifyUpdate(current: string): Promise<boolean> {
  try {
    const { checkForUpdate } = await import('./update');
    const info = await checkForUpdate(current);
    if (!info) return false;
    let last = '';
    try { last = localStorage.getItem(LAST_UPDATE_KEY) ?? ''; } catch {}
    if (last === info.latest) return false;
    const n = await getNative();
    if (n) {
      await n.createChannel({
        id: 'red-reminders', name: 'Pengingat',
        description: 'Pengingat pil KB dan perkiraan haid', importance: 4,
      }).catch(() => {});
      await n.schedule({
        notifications: [{
          id: ID_UPDATE, title: 'Pembaruan tersedia',
          body: `Red ${info.latest} tersedia. Ketuk untuk mengunduh.`,
          channelId: 'red-reminders',
          schedule: { at: new Date(Date.now() + 1000) },
        }],
      }).catch(() => { return; });
    } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('Pembaruan tersedia', { body: `Red ${info.latest} tersedia.`, icon: '/icon.svg' });
    } else {
      return false;
    }
    try { localStorage.setItem(LAST_UPDATE_KEY, info.latest); } catch {}
    return true;
  } catch { return false; }
}

// True when the day already has any entry: a logged period covering it, a
// symptom, dose, sex log, or note for the date. One helper shared by the
// nudge scheduler and the UI so they never disagree.
export function isDayLogged(
  day: string,
  me: {
    periods: { start_date: string; end_date: string | null; type: string }[];
    todaySymptoms?: string[];
    doses?: { date: string }[];
    sex?: { date: string }[];
    symptomLog?: { date: string }[];
  } | null,
  noteForDay: string = '',
): boolean {
  if (!me) return true; // unknown: do not nag
  if (me.periods.some((p) => p.type === 'menstruation' && day >= p.start_date && (!p.end_date || day <= p.end_date))) return true;
  if ((me.todaySymptoms ?? []).length > 0) return true;
  if ((me.doses ?? []).some((d) => d.date === day)) return true;
  if ((me.sex ?? []).some((s) => s.date === day)) return true;
  if ((me.symptomLog ?? []).some((s) => s.date === day)) return true;
  if (noteForDay.trim()) return true;
  return false;
}

// Fire an immediate notification (used to confirm permission works).
export async function notifyNow(title: string, body: string): Promise<void> {
  const n = await getNative();
  if (n) {
    await n.schedule({ notifications: [{ id: 9999, title, body, channelId: 'red-reminders', schedule: { at: new Date(Date.now() + 1000) } }] }).catch(() => {});
    return;
  }
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/icon.svg' });
  }
}
