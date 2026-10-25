import type { PartResult } from '../core/model';
import { activities } from '../data/load';
import { displayInterval, displayMultiple, partLabel } from './displayLabels';
import type { DayEntry } from './useTodayEntries';

type Props = {
  part: PartResult | null;
  entries: DayEntry[];
  mostlyAssumption: boolean;
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

  const name = partLabel(part.part);
  const contributing = entries
    .map((e) => {
      const a = activities.find((x) => x.id === e.activityId);
      if (!a) return null;
      const lift =
        e.exercise && a.kind === 'liftParent'
          ? a.children?.find((c) => c.exerciseId === e.exercise)
          : undefined;
      const label = lift
        ? `${a.name}: ${lift.name} (${e.intensity ?? lift.defaultIntensity})`
        : a.name;
      return { ...e, name: label, lowN: a.lowN };
    })
    .filter((x): x is DayEntry & { name: string; lowN: boolean } => x !== null);

  const multiple = displayMultiple(part.median, part.lo89, part.hi89, part.saturated);
  const interval = displayInterval(part.lo89, part.hi89, part.saturated);

  return (
    <aside className="detail" aria-live="polite">
      <h2>{name}</h2>
      <p className="multiple">
        About <strong>{multiple}</strong>{' '}
        <span className="range">(likely {interval})</span>
      </p>
      <p className="pred" data-testid="p-red">
        Chance of red: <strong>{Math.round(part.pRed * 100)}%</strong>
      </p>
      <p className="typicality">
        More than <strong>{part.typPct}%</strong> of non-exercisers’ individual days for
        this part.
      </p>
      <ul className="badges">
        <li className="badge">Band: {part.band}</li>
        {part.saturated ? <li className="badge warn">Saturated (&gt;2.5×)</li> : null}
        {mostlyAssumption ? (
          <li className="badge warn">Shares mostly ASSUMPTION — low confidence</li>
        ) : (
          <li className="badge">Estimate based on muscle mass × activation</li>
        )}
        <li
          className="badge warn"
          title="spec §11: assumed indices rescaled ×2 onto %MVIC"
        >
          ASSUMPTION cells use ×2 index rescaling
        </li>
        {part.highUncertainty ? <li className="badge warn">High uncertainty</li> : null}
        {part.straddlesCutoff ? (
          <li className="badge">Range crosses band edges</li>
        ) : null}
        {part.smallBaseline ? (
          <li className="badge">
            Small baseline (offset larger than baseline work on nominal day)
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
              {e.lowN ? (
                <span
                  className="badge low-n"
                  title="Fewer than 10 survey respondents; does not change the result"
                >
                  {' '}
                  Low survey sample
                </span>
              ) : null}
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
