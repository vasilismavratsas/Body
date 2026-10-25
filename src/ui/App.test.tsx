import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PART_IDS } from '../data/schemas';
import { App } from './App';

function mockParts() {
  return PART_IDS.map((part) => ({
    part,
    lo89: 1,
    median: 1,
    hi89: 1,
    band: 'green' as const,
    color: '#2E7D32',
    straddlesCutoff: false,
    log2HiLo: 0,
    highUncertainty: false,
    offsetGtB: 0.1,
    smallBaseline: part === 'chest' || part === 'core',
    pRed: 0,
    saturated: false,
    typPct: 50,
    flags: ['referenceIsAverage'] as const,
  }));
}

vi.mock('../core/runInWorker', () => ({
  runModelInWorker: vi.fn(() =>
    Promise.resolve({
      parts: mockParts(),
      grossInd: [],
      calibration: { sd: 4.16, p10: 27.91, p50: 32.34, p90: 38.16 },
    }),
  ),
}));

describe('App', () => {
  it('renders the Body brand and activity entry', async () => {
    render(<App />);
    expect(screen.getByRole('link', { name: 'Body' })).toBeTruthy();
    expect(await screen.findByText(/Today’s body map/)).toBeTruthy();
    expect(screen.getByLabelText('Activity')).toBeTruthy();
  });

  it('Methods page has exactly one main landmark', async () => {
    window.location.hash = '#methods';
    render(<App />);
    expect(await screen.findByRole('heading', { name: /Methods/ })).toBeTruthy();
    expect(document.querySelectorAll('main')).toHaveLength(1);
    window.location.hash = '';
  });
});
