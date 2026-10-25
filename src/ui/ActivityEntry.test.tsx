/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-type-assertion */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ActivityEntry } from './ActivityEntry';
import type { AddEntryInput, DayEntry } from './useTodayEntries';

function Harness({ onAdd }: { onAdd?: (input: AddEntryInput) => void }) {
  const [entries, setEntries] = useState<DayEntry[]>([]);
  return (
    <ActivityEntry
      entries={entries}
      loading={false}
      onAdd={(input) => {
        onAdd?.(input);
        setEntries((prev) => {
          const entry: DayEntry = {
            id: String(prev.length + 1),
            activityId: input.activityId,
            minutes: input.minutes,
          };
          if (input.exercise) entry.exercise = input.exercise;
          if (input.intensity) entry.intensity = input.intensity;
          return [...prev, entry];
        });
      }}
      onRemove={(id) => {
        setEntries((prev) => prev.filter((e) => e.id !== id));
      }}
    />
  );
}

describe('ActivityEntry / picker (round-2 §D)', () => {
  it('filters by search terms', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Activity');
    await user.click(input);
    await user.type(input, 'swim');
    expect(await screen.findByRole('option', { name: /Swimming/i })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /^Tennis/i })).toBeNull();
  });

  it('weightlifting requires a lift and preselects default intensity', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<Harness onAdd={onAdd} />);
    const input = screen.getByLabelText('Activity');
    await user.click(input);
    await user.type(input, 'weight');
    const opt = await screen.findByRole('option', { name: /Weightlifting/i });
    await user.click(opt);
    expect(await screen.findByTestId('lift-form')).toBeTruthy();
    const intensity = screen.getByLabelText('Intensity') as HTMLSelectElement;
    // first child default (bench_press default is light)
    expect(intensity.value).toMatch(/light|moderate|vigorous/);
    expect(intensity.selectedOptions[0]?.textContent).toMatch(/default/);
  });

  it('multiple lifts persist in the today list', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Activity');
    await user.click(input);
    await user.clear(input);
    await user.type(input, 'weightlift');
    await user.click(await screen.findByRole('option', { name: /Weightlifting/i }));
    await user.click(screen.getByRole('button', { name: /Add another lift/i }));
    const liftSelects = screen.getAllByLabelText('Lift');
    expect(liftSelects.length).toBe(2);
    await user.selectOptions(liftSelects[1]!, 'biceps_curl');
    await user.click(screen.getByRole('button', { name: /^Add$/i }));
    const list = screen.getByRole('heading', { name: 'Today' }).parentElement!;
    expect(within(list).getAllByText(/Weightlifting:/i).length).toBeGreaterThanOrEqual(1);
  });

  it('shows lowN badge for low-sample activities', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Activity');
    await user.click(input);
    await user.type(input, 'soccer');
    expect(await screen.findByText(/Low survey sample/i)).toBeTruthy();
  });
});
