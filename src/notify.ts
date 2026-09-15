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

  if (p.pillEnabled) {
    jobs.push({ id: ID_PILL, title: 'Waktunya minum pil KB', body: 'Jangan lupa minum pil hari ini.', at: atToday(p.pillTime) });
  }
  if (p.periodEnabled && nextPeriod) {
    // 2 days before the predicted window starts.
    const at = new Date(Date.parse(nextPeriod + 'T09:00:00Z'));
    at.setDate(at.getDate() - 2);
    if (at.getTime() > Date.now()) {
      jobs.push({ id: ID_PERIOD, title: 'Haid diperkirakan dekat', body: 'Perkiraan haid dalam 2 hari. Siapkan perlengkapan.', at });
    }
  }

  if (n) {
    await n.cancel({ notifications: [{ id: ID_PILL }, { id: ID_PERIOD }] }).catch(() => {});
    if (jobs.length) {
      await n.schedule({
        notifications: jobs.map((j) => {
          if (j.id === ID_PILL) {
            // Repeat daily at the chosen time.
            const [h, m] = p.pillTime.split(':').map(Number);
            return {
              id: j.id, title: j.title, body: j.body,
              schedule: { on: { hour: h || 21, minute: m || 0 }, repeats: true, allowWhileIdle: true },
            };
          }
          return { id: j.id, title: j.title, body: j.body, schedule: { at: j.at, allowWhileIdle: true } };
        }),
      });
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
    await n.schedule({ notifications: [{ id: 9999, title, body, schedule: { at: new Date(Date.now() + 1000) } }] });
    return;
  }
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/icon.svg' });
  }
}
