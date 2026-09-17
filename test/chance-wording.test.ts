import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// This app must not tell anyone a day is "safe" for unprotected sex. No calendar
// method is reliable enough for that, and a low estimate being read as
// permission is the failure mode that matters most here. These tests pin the
// wording, because it is the safety control — a future copy tweak could remove
// it without breaking anything else.
const ROOT = new URL('..', import.meta.url).pathname;
const I18N = readFileSync(ROOT + 'src/i18n.ts', 'utf8');
const CARD = readFileSync(ROOT + 'src/ChanceCard.tsx', 'utf8');

describe('pregnancy chance wording', () => {
  it('never claims a day is safe', () => {
    // "aman" (safe) must not appear as a day status anywhere in the copy.
    expect(I18N).not.toMatch(/hari aman/i);
    expect(I18N).not.toMatch(/tidak (akan )?hamil/i);
    expect(I18N).not.toMatch(/bebas (risiko|hamil)/i);
  });

  it('says a low chance is not the same as safe', () => {
    expect(I18N).toMatch(/Peluang rendah bukan berarti aman/);
  });

  it('states that the calendar method does not prevent pregnancy', () => {
    expect(I18N).toMatch(/tidak dapat mencegah kehamilan/);
  });

  it('labels the estimate as an estimate, not a test result', () => {
    expect(I18N).toMatch(/bukan hasil tes kesuburan/);
  });

  it('renders the safe-note alongside every numeric estimate', () => {
    // The note must be in the same branch as the bar, so a risk level cannot be
    // shown without it.
    const branch = CARD.slice(CARD.indexOf('chance-bar'), CARD.indexOf('chanceDisclaimer'));
    expect(branch).toContain('chanceSafeNote');
  });

  it('explains rather than guesses when birth control is active', () => {
    expect(CARD).toContain('chanceBcNote');
  });

  it('uses the word Perkiraan (estimate) in the card title', () => {
    expect(I18N).toMatch(/chanceTitle: 'Perkiraan/);
  });
});
