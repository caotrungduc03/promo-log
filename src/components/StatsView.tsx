import { useMemo, useState } from 'react';
import type { StudyStore } from '../types';
import { getLastNDates } from '../utils/time';
import { BackupControls } from './BackupControls';
import { StudyChart } from './StudyChart';
import { SummaryCards } from './SummaryCards';

export interface StatsViewProps {
  store: StudyStore;
  todayDate: string;
  onSelectDate: (date: string) => void;
  onImportStore: (nextStore: StudyStore) => void;
}

const RANGE_OPTIONS: readonly (7 | 30)[] = [7, 30] as const;

export function StatsView({
  store,
  todayDate,
  onSelectDate,
  onImportStore,
}: StatsViewProps) {
  const [rangeDays, setRangeDays] = useState<7 | 30>(7);

  const days = useMemo(
    () => getLastNDates(rangeDays, todayDate),
    [rangeDays, todayDate],
  );

  return (
    <div className="space-y-4">
      {/* Borderless Segmented Range Toggle */}
      <div
        role="group"
        aria-label="Select analytics time range"
        className="grid grid-cols-2 rounded-2xl bg-slate-200/70 p-1"
      >
        {RANGE_OPTIONS.map((option) => {
          const isActive = rangeDays === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={isActive}
              onClick={() => setRangeDays(option)}
              className={`min-h-[40px] rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              {option} Days
            </button>
          );
        })}
      </div>

      <SummaryCards days={days} logs={store.logs} rangeDays={rangeDays} />

      <StudyChart
        days={days}
        logs={store.logs}
        rangeDays={rangeDays}
        todayDate={todayDate}
        onSelectDate={onSelectDate}
      />

      <BackupControls store={store} onImportStore={onImportStore} />
    </div>
  );
}
