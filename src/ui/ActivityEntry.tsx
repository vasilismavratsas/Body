import { useState, type SyntheticEvent } from 'react';
import { activities } from '../data/load';
import type { DayEntry } from './useTodayEntries';

type Props = {
  entries: DayEntry[];
  onAdd: (activityId: string, minutes: number) => void;
  onRemove: (id: string) => void;
  loading: boolean;
};

export function ActivityEntry({ entries, onAdd, onRemove, loading }: Props) {
  const [activityId, setActivityId] = useState(activities[0]?.id ?? 'walk_brisk');
  const [minutes, setMinutes] = useState('30');

  function submit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const mins = Number(minutes);
    if (!Number.isFinite(mins) || mins <= 0) return;
    onAdd(activityId, mins);
  }

  return (
    <section className="activity-entry" aria-labelledby="activity-heading">
      <h2 id="activity-heading">Log activity</h2>
      <p className="lede">
        Pick from the top-10 US exercise forms and a duration. Saved for today only.
      </p>
      <form onSubmit={submit} className="activity-form">
        <label>
          Activity
          <select
            value={activityId}
            onChange={(e) => {
              setActivityId(e.target.value);
            }}
          >
            {activities
              .slice()
              .sort((a, b) => a.top10Rank - b.top10Rank)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.top10Rank}. {a.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Minutes
          <input
            type="number"
            min={1}
            max={480}
            step={1}
            value={minutes}
            onChange={(e) => {
              setMinutes(e.target.value);
            }}
            required
          />
        </label>
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
            return (
              <li key={e.id}>
                <span>
                  {a?.name ?? e.activityId}, {e.minutes} min
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
