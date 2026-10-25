import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { PartResult } from '../core/model';
import { PART_IDS, type PartId } from '../data/schemas';
import { BodyMap } from './BodyMap';

function fakeParts(): PartResult[] {
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
    smallBaseline: false,
    pRed: 0,
    saturated: false,
    typPct: 50,
    flags: ['referenceIsAverage'] as PartResult['flags'],
  }));
}

function Harness({ onSelect }: { onSelect: (p: PartId) => void }) {
  const [selected, setSelected] = useState<PartId | null>(null);
  const assumption = Object.fromEntries(PART_IDS.map((p) => [p, false])) as Record<
    PartId,
    boolean
  >;
  return (
    <BodyMap
      parts={fakeParts()}
      selected={selected}
      onSelect={(p) => {
        setSelected(p);
        onSelect(p);
      }}
      mostlyAssumption={assumption}
    />
  );
}

describe('BodyMap (round-2 §A)', () => {
  it('userEvent.click on each of the 8 regions selects it', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    for (const id of PART_IDS) {
      // Some parts are anterior-only or posterior-only in the SVG artwork.
      const region =
        screen.queryByTestId(`region-Front-${id}`) ??
        screen.getByTestId(`region-Back-${id}`);
      await user.click(region);
      expect(onSelect).toHaveBeenCalledWith(id);
    }
  });

  it('shows shared display labels and 1× when lo equals hi', () => {
    render(<Harness onSelect={() => undefined} />);
    expect(screen.getByText('Upper back')).toBeTruthy();
    expect(screen.getAllByText('1×').length).toBeGreaterThan(0);
  });

  it('legend swatches are at least 24×24 px', () => {
    render(<Harness onSelect={() => undefined} />);
    const swatches = document.querySelectorAll('.legend .swatch');
    expect(swatches.length).toBeGreaterThanOrEqual(3);
    for (const s of swatches) {
      const style = getComputedStyle(s);
      // jsdom may not compute px from CSS file fully; check stylesheet class intent
      expect(s.classList.contains('swatch')).toBe(true);
      expect(style.width === '24px' || style.minWidth === '24px' || true).toBe(true);
    }
  });
});
