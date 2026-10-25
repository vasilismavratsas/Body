import { describe, expect, it } from 'vitest';
import { displayInterval, displayMultiple, partLabel } from './displayLabels';

describe('display labels (round-2 §A.2)', () => {
  it('uses shared part labels (Upper back, not upper_back)', () => {
    expect(partLabel('upper_back')).toBe('Upper back');
    expect(partLabel('hips_glutes')).toBe('Hips & glutes');
  });

  it('shows 1× when rounded lo equals hi', () => {
    expect(displayMultiple(1, 1, 1)).toBe('1×');
    expect(displayMultiple(1.001, 1.001, 1.004)).toBe('1×');
    expect(displayInterval(1, 1)).toBe('1×');
  });

  it('shows >2.5× when saturated', () => {
    expect(displayMultiple(3.2, 2.1, 4.5, true)).toBe('>2.5×');
    expect(displayMultiple(2.5, 2.0, 3.0, true)).toBe('>2.5×');
  });
});
