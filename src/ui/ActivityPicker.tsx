import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { activities } from '../data/load';
import { ACTIVITY_GROUPS, type Activity, type ActivityGroup } from '../data/schemas';

type Props = {
  value: string;
  onChange: (activityId: string) => void;
};

function matchesQuery(a: Activity, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  if (a.name.toLowerCase().includes(needle)) return true;
  if (a.id.toLowerCase().includes(needle)) return true;
  return a.searchTerms.some((t) => t.toLowerCase().includes(needle));
}

/** Searchable combobox grouped by catalog group (round-2 §D). */
export function ActivityPicker({ value, onChange }: Props) {
  const listId = useId();
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = activities.find((a) => a.id === value);

  const filtered = useMemo(() => {
    return activities.filter((a) => matchesQuery(a, query));
  }, [query]);

  const grouped = useMemo(() => {
    const out: { group: ActivityGroup; items: Activity[] }[] = [];
    for (const g of ACTIVITY_GROUPS) {
      const items = filtered.filter((a) => a.group === g);
      if (items.length) out.push({ group: g, items });
    }
    return out;
  }, [filtered]);

  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
    };
  }, []);

  function choose(a: Activity) {
    onChange(a.id);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="activity-picker" ref={rootRef}>
      <label htmlFor={inputId}>Activity</label>
      <div className="combobox">
        <input
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            flat[activeIndex] ? `opt-${flat[activeIndex].id}` : undefined
          }
          placeholder={selected ? selected.name : 'Search activities…'}
          value={open ? query : (selected?.name ?? '')}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActiveIndex((i) => Math.min(i + 1, Math.max(flat.length - 1, 0)));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' && open && flat[activeIndex]) {
              e.preventDefault();
              choose(flat[activeIndex]);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
        {open ? (
          <ul id={listId} role="listbox" className="combobox-list">
            {grouped.length === 0 ? (
              <li className="muted" role="presentation">
                No matches
              </li>
            ) : (
              grouped.map(({ group, items }) => (
                <li key={group} role="presentation" className="combobox-group">
                  <div className="combobox-group-label">{group}</div>
                  <ul role="group" aria-label={group}>
                    {items.map((a) => {
                      const idx = flat.indexOf(a);
                      return (
                        <li
                          key={a.id}
                          id={`opt-${a.id}`}
                          role="option"
                          aria-selected={a.id === value}
                          className={idx === activeIndex ? 'is-active' : undefined}
                          onMouseEnter={() => {
                            setActiveIndex(idx);
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            choose(a);
                          }}
                        >
                          <span>{a.name}</span>
                          {a.lowN ? (
                            <span
                              className="badge low-n"
                              title="Fewer than 10 survey respondents; does not change the result"
                            >
                              Low survey sample
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
      {selected?.lowN ? (
        <p
          className="low-n-note"
          title="Fewer than 10 survey respondents; does not change the result"
        >
          <span className="badge low-n">Low survey sample</span> — fewer than 10 survey
          respondents; does not change the result.
        </p>
      ) : null}
    </div>
  );
}
