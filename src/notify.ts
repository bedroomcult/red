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

export type ReminderPrefs = {
  pillEnabled: boolean;
  pillTime: string; // "HH:MM"
  periodEnabled: boolean;
};

const KEY = 'pt.reminders';
export const loadPrefs = (): ReminderPrefs => {
  try {
    return { pillEnabled: false, pillTime: '21:00', periodEnabled: true, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { pillEnabled: false, pillTime: '21:00', periodEnabled: true };
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

export async function syncReminders(p: ReminderPrefs, nextPeriod: string | null): Promise<void> {
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
  if (p.periodEnabled && nextPeriod) {
    // 2 days before the predicted window starts. Plain millisecond math, not
    // setDate(): setDate works in local time while the parse is UTC, so a
    // device west of UTC landed on the wrong day.
    const at = new Date(Date.parse(nextPeriod + 'T09:00:00Z') - 2 * 864e5);
    if (at.getTime() > Date.now()) {
      jobs.push({ id: ID_PERIOD, title: 'Haid diperkirakan dekat', body: 'Perkiraan haid dalam 2 hari. Siapkan perlengkapan.', at });
    }
  }

  if (n) {
    await n.cancel({ notifications: [{ id: ID_PILL }, { id: ID_PERIOD }] }).catch(() => {});
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
