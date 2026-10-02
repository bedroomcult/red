export type WidgetText = { title: string; note: string };

const TITLE_KEY = 'pt.widgetTitle';
const NOTE_KEY = 'pt.widgetNote';

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

export function loadWidgetText(): WidgetText {
  return { title: read(TITLE_KEY), note: read(NOTE_KEY) };
}

export function saveWidgetText(o: { title: string; note: string }): void {
  const title = o.title.slice(0, 40);
  const note = o.note.slice(0, 80);
  try {
    localStorage.setItem(TITLE_KEY, title);
    localStorage.setItem(NOTE_KEY, note);
  } catch {}
}
