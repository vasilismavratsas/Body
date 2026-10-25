import { useEffect, useMemo, useState } from 'react';
import type { ExtraMinutes, PartResult } from '../core/model';
import { runModelInWorker } from '../core/runInWorker';
import type { PartId } from '../data/schemas';
import { ActivityEntry } from './ActivityEntry';
import { BodyMap } from './BodyMap';
import { DetailPanel } from './DetailPanel';
import { MethodsPage } from './MethodsPage';
import { mostlyAssumptionByPart } from './shareAssumption';
import { useTodayEntries } from './useTodayEntries';

function entriesToExtra(
  entries: { activityId: string; minutes: number }[],
): ExtraMinutes | null {
  if (entries.length === 0) return null;
  const extra: ExtraMinutes = {};
  for (const e of entries) {
    extra[e.activityId] = (extra[e.activityId] ?? 0) + e.minutes;
  }
  return extra;
}

export function App() {
  const [route, setRoute] = useState<'app' | 'methods'>(() =>
    typeof window !== 'undefined' && window.location.hash === '#methods'
      ? 'methods'
      : 'app',
  );
  const { entries, add, remove } = useTodayEntries();
  const [selected, setSelected] = useState<PartId | null>(null);
  const [parts, setParts] = useState<PartResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const assumption = useMemo(() => mostlyAssumptionByPart(), []);

  useEffect(() => {
    const onHash = () => {
      setRoute(window.location.hash === '#methods' ? 'methods' : 'app');
    };
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    const extra = entriesToExtra(entries);
    void runModelInWorker(extra, { signal: ac.signal })
      .then((r) => {
        if (ac.signal.aborted) return;
        setParts(r.parts);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
    return () => {
      ac.abort();
    };
  }, [entries]);

  const selectedPart = parts.find((p) => p.part === selected) ?? null;

  return (
    <div className="shell">
      <header className="top">
        <a
          className="brand"
          href="#app"
          onClick={() => {
            window.location.hash = '';
            setRoute('app');
          }}
        >
          Body
        </a>
        <nav>
          <a
            href="#app"
            aria-current={route === 'app' ? 'page' : undefined}
            onClick={() => {
              window.location.hash = '';
              setRoute('app');
            }}
          >
            Map
          </a>
          <a
            href="#methods"
            aria-current={route === 'methods' ? 'page' : undefined}
            onClick={() => {
              setRoute('methods');
            }}
          >
            Methods
          </a>
        </nav>
      </header>

      {route === 'methods' ? (
        <MethodsPage />
      ) : (
        <main className="app-grid">
          <ActivityEntry
            entries={entries}
            onAdd={add}
            onRemove={remove}
            loading={loading}
          />
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          {parts.length > 0 ? (
            <BodyMap
              parts={parts}
              selected={selected}
              onSelect={setSelected}
              mostlyAssumption={assumption}
            />
          ) : (
            <p className="loading" role="status">
              Computing baseline map…
            </p>
          )}
          <DetailPanel
            part={selectedPart}
            entries={entries}
            mostlyAssumption={selected ? assumption[selected] : false}
          />
        </main>
      )}

      <footer className="foot">
        Alpha v0.6.1 · IPUMS ATUS aggregates only ·{' '}
        <a href="#methods">Methods &amp; citations</a>
      </footer>
    </div>
  );
}
