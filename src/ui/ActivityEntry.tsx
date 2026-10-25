import { useMemo, useState, type SyntheticEvent } from 'react';
import { activities, getLiftParent } from '../data/load';
import { INTENSITIES, type Intensity } from '../data/schemas';
import { ActivityPicker } from './ActivityPicker';
import type { AddEntryInput, DayEntry } from './useTodayEntries';

type PendingLift = {
  key: string;
  exercise: string;
  intensity: Intensity;
  minutes: string;
};

type Props = {
  entries: DayEntry[];
  onAdd: (input: AddEntryInput) => void;
  onRemove: (id: string) => void;
  loading: boolean;
};

function defaultLiftState(): PendingLift[] {
  const parent = getLiftParent();
  const first = parent.children?.[0];
  return [
    {
      key: 'lift-0',
      exercise: first?.exerciseId ?? 'bench_press',
      intensity: first?.defaultIntensity ?? 'light',
      minutes: '30',
    },
  ];
}

export function ActivityEntry({ entries, onAdd, onRemove, loading }: Props) {
  const [activityId, setActivityId] = useState(activities[0]?.id ?? 'walk_brisk');
  const [minutes, setMinutes] = useState('30');
  const [lifts, setLifts] = useState<PendingLift[]>(() => defaultLiftState());

  const selected = activities.find((a) => a.id === activityId);
  const isLift = selected?.kind === 'liftParent';
  const liftParent = useMemo(() => getLiftParent(), []);
  const children = liftParent.children ?? [];

  function onActivityChange(id: string) {
    setActivityId(id);
    if (id === 'weightlifting') {
      setLifts(defaultLiftState());
    }
  }

  function updateLift(key: string, patch: Partial<PendingLift>) {
    setLifts((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        if (patch.exercise) {
          const child = children.find((c) => c.exerciseId === patch.exercise);
          if (child && !patch.intensity) {
            next.intensity = child.defaultIntensity;
          }
        }
        return next;
      }),
    );
  }

  function submit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isLift) {
      for (const lift of lifts) {
        const mins = Number(lift.minutes);
        if (!Number.isFinite(mins) || mins <= 0) continue;
        if (!lift.exercise) continue;
        onAdd({
          activityId: 'weightlifting',
          minutes: mins,
          exercise: lift.exercise,
          intensity: lift.intensity,
        });
      }
      setLifts(defaultLiftState());
      return;
    }
    const mins = Number(minutes);
    if (!Number.isFinite(mins) || mins <= 0) return;
    onAdd({ activityId, minutes: mins });
  }

  return (
    <section className="activity-entry" aria-labelledby="activity-heading">
      <h2 id="activity-heading">Log activity</h2>
      <p className="lede">
        Search the 25-activity catalog (grouped by category). Weightlifting opens a lift +
        intensity form. Saved for today only.
      </p>
      <form onSubmit={submit} className="activity-form">
        <ActivityPicker value={activityId} onChange={onActivityChange} />

        {isLift ? (
          <div className="lift-form" data-testid="lift-form">
            <h3>Lifts</h3>
            {lifts.map((lift) => {
              const child = children.find((c) => c.exerciseId === lift.exercise);
              return (
                <fieldset key={lift.key} className="lift-row">
                  <legend className="sr-only">Lift entry</legend>
                  <label>
                    Lift
                    <select
                      value={lift.exercise}
                      onChange={(e) => {
                        updateLift(lift.key, { exercise: e.target.value });
                      }}
                      required
                    >
                      {children.map((c) => (
                        <option key={c.exerciseId} value={c.exerciseId}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Intensity
                    <select
                      value={lift.intensity}
                      onChange={(e) => {
                        updateLift(lift.key, {
                          intensity: e.target.value as Intensity,
                        });
                      }}
                    >
                      {INTENSITIES.map((it) => (
                        <option key={it} value={it}>
                          {it}
                          {child?.defaultIntensity === it ? ' (default)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Minutes
                    <input
                      type="number"
                      min={1}
                      max={1440}
                      step={1}
                      value={lift.minutes}
                      onChange={(e) => {
                        updateLift(lift.key, { minutes: e.target.value });
                      }}
                      required
                    />
                  </label>
                  {lifts.length > 1 ? (
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => {
                        setLifts((prev) => prev.filter((l) => l.key !== lift.key));
                      }}
                    >
                      Remove lift
                    </button>
                  ) : null}
                </fieldset>
              );
            })}
            <button
              type="button"
              className="linkish"
              onClick={() => {
                const first = children[0];
                setLifts((prev) => [
                  ...prev,
                  {
                    key: `lift-${String(Date.now())}`,
                    exercise: first?.exerciseId ?? 'bench_press',
                    intensity: first?.defaultIntensity ?? 'light',
                    minutes: '30',
                  },
                ]);
              }}
            >
              Add another lift
            </button>
          </div>
        ) : (
          <label>
            Minutes
            <input
              type="number"
              min={1}
              max={1440}
              step={1}
              value={minutes}
              onChange={(e) => {
                setMinutes(e.target.value);
              }}
              required
            />
          </label>
        )}

        <button type="submit" disabled={loading}>
          Add
        </button>
      </form>
      {loading ? (
        <p className="loading" role="status">
          Updating map…
        </p>
      ) : null}
      <h3>Today</h3>
      {entries.length === 0 ? (
        <p className="muted">
          No entries yet — map shows the average non-exerciser day (1×).
        </p>
      ) : (
        <ul className="entry-list">
          {entries.map((e) => {
            const a = activities.find((x) => x.id === e.activityId);
            const lift =
              e.exercise && a?.kind === 'liftParent'
                ? a.children?.find((c) => c.exerciseId === e.exercise)
                : undefined;
            const label = lift
              ? `${a?.name ?? 'Weightlifting'}: ${lift.name} (${e.intensity ?? lift.defaultIntensity})`
              : (a?.name ?? e.activityId);
            return (
              <li key={e.id}>
                <span>
                  {label}, {e.minutes} min
                  {a?.lowN ? (
                    <span
                      className="badge low-n"
                      title="Fewer than 10 survey respondents; does not change the result"
                    >
                      {' '}
                      Low survey sample
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  className="linkish"
                  onClick={() => {
                    onRemove(e.id);
                  }}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
