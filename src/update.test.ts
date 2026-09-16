import { describe, it, expect } from 'vitest';
import { isNewer } from './update';

// The update banner fires on isNewer(). Getting this wrong in either direction is
// user-visible: too eager nags on every launch, too strict never offers a real
// update.
describe('isNewer', () => {
  it('detects each version component', () => {
    expect(isNewer('1.2.0', '1.1.0')).toBe(true); // minor
    expect(isNewer('1.1.1', '1.1.0')).toBe(true); // patch
    expect(isNewer('2.0.0', '1.9.9')).toBe(true); // major
  });

  it('is false for the same version', () => {
    expect(isNewer('1.2.0', '1.2.0')).toBe(false);
  });

  it('is false for an older version', () => {
    expect(isNewer('1.1.0', '1.2.0')).toBe(false);
    expect(isNewer('1.1.9', '1.2.0')).toBe(false);
    expect(isNewer('0.9.9', '1.0.0')).toBe(false);
  });

  it('compares numerically, not as strings', () => {
    // '10' < '9' lexically, which would wrongly hide a real update.
    expect(isNewer('1.10.0', '1.9.0')).toBe(true);
    expect(isNewer('1.0.10', '1.0.9')).toBe(true);
  });

  it('accepts a leading v on the tag', () => {
    expect(isNewer('v1.2.0', '1.1.0')).toBe(true);
    expect(isNewer('v1.0.0', 'v1.0.0')).toBe(false);
  });

  it('does not fire on a malformed version', () => {
    expect(isNewer('latest', '1.0.0')).toBe(false);
    expect(isNewer('1.2', '1.0.0')).toBe(false);
    expect(isNewer('', '1.0.0')).toBe(false);
    expect(isNewer('1.2.x', '1.0.0')).toBe(false);
    expect(isNewer('1.0.0', 'nonsense')).toBe(false);
  });
});
