import { useCallback, useEffect, useState } from 'react';

export type DayEntry = {
  id: string;
  activityId: string;
  minutes: number;
};

const STORAGE_KEY = 'body.alpha.entries';

type Stored = { date: string; entries: DayEntry[] };

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${String(y)}-${m}-${day}`;
}

function load(): DayEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Stored;
    if (parsed.date !== todayKey()) {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    return parsed.entries;
  } catch {
    return [];
  }
}

function save(entries: DayEntry[]) {
  const payload: Stored = { date: todayKey(), entries };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function msUntilMidnight(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}

export function useTodayEntries() {
  const [entries, setEntries] = useState<DayEntry[]>(() => load());

  useEffect(() => {
    save(entries);
  }, [entries]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setEntries([]);
      localStorage.removeItem(STORAGE_KEY);
    }, msUntilMidnight());
    return () => {
      window.clearTimeout(t);
    };
  }, [entries]);

  const add = useCallback((activityId: string, minutes: number) => {
    setEntries((prev) => [
      ...prev,
      {
        id: `${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}`,
        activityId,
        minutes,
      },
    ]);
  }, []);

  const remove = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clear = useCallback(() => {
    setEntries([]);
  }, []);

  return { entries, add, remove, clear };
}
