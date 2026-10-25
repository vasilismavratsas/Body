import type { PartResult } from '../core/model';
import { activities } from '../data/load';
import type { PartId } from '../data/schemas';
import type { DayEntry } from './useTodayEntries';

type Props = {
  part: PartResult | null;
  entries: DayEntry[];
  mostlyAssumption: boolean;
};

const LABELS: Record<PartId, string> = {
  arms: 'Arms',
  shoulders: 'Shoulders',
  chest: 'Chest',
  upper_back: 'Upper back',
  core: 'Core',
  lower_back: 'Lower back',
  hips_glutes: 'Hips & glutes',
  legs: 'Legs',
};

export function DetailPanel({ part, entries, mostlyAssumption }: Props) {
  if (!part) {
    return (
      <aside className="detail" aria-live="polite">
        <h2>Part detail</h2>
        <p>Select a body part on the map to see its multiple and confidence.</p>
      </aside>
    );
  }

  const name = LABELS[part.part];
  const contributing = entries
    .map((e) => {
      const a = activities.find((x) => x.id === e.activityId);
      return a ? { ...e, name: a.name } : null;
    })
    .filter((x): x is DayEntry & { name: string } => x !== null);

  return (
    <aside className="detail" aria-live="polite">
      <h2>{name}</h2>
      <p className="multiple">
        About <strong>{part.median}×</strong>{' '}
        <span className="range">
          (likely {part.lo89}–{part.hi89}×)
        </span>
      </p>
      <p className="typicality">
        More than <strong>{part.typPct}%</strong> of non-exercisers’ individual days for
        this part.
      </p>
      <ul className="badges">
        <li className="badge">Band: {part.band}</li>
        {mostlyAssumption ? (
          <li className="badge warn">Shares mostly ASSUMPTION — low confidence</li>
        ) : (
          <li className="badge">Estimate based on muscle mass × activation</li>
        )}
        {part.highUncertainty ? <li className="badge warn">High uncertainty</li> : null}
        {part.straddlesCutoff ? (
          <li className="badge">Range crosses band edges</li>
        ) : null}
        {part.offsetGtB > 0.5 ? (
          <li className="badge">
            Small baseline (offset often larger than baseline work)
          </li>
        ) : null}
        <li className="badge">Compared to average non-exerciser — not personalized</li>
      </ul>
      <h3>Contributing entries today</h3>
      {contributing.length === 0 ? (
        <p className="muted">No logged exercise — showing the mean baseline day.</p>
      ) : (
        <ul className="contrib">
          {contributing.map((e) => (
            <li key={e.id}>
              {e.name}, {e.minutes} min
            </li>
          ))}
        </ul>
      )}
      <p className="baseline-note">
        Comparison is to the average non-exercising American day (IPUMS ATUS 2024), not to
        your own resting baseline.
      </p>
    </aside>
  );
}
