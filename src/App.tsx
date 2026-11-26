import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, BookOpenCheck, Calendar } from 'lucide-react';
import { DailyLogger } from './components/DailyLogger';
import { HistoryLog } from './components/HistoryLog';
import { Logo } from './components/Logo';
import { StatsView } from './components/StatsView';
import type { DayLog, StudyStore } from './types';
import { loadStore, saveStore, upsertDayLog } from './utils/storage';
import { formatDateLabel, getTodayDateKey } from './utils/time';

type ActiveTab = 'today' | 'stats';

export default function App() {
  const todayDate = getTodayDateKey();
  const [store, setStore] = useState<StudyStore>(() => loadStore());
  const [selectedDate, setSelectedDate] = useState<string>(todayDate);
  const [activeTab, setActiveTab] = useState<ActiveTab>('today');
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    saveStore(store);
  }, [store]);

  const handleUpdateLog = useCallback((nextLog: DayLog) => {
    setStore((prev) => upsertDayLog(prev, nextLog));
  }, []);

  const handleChangeDefaultMinutes = useCallback((minutes: number) => {
    const clamped = Math.min(240, Math.max(1, Math.round(minutes)));
    setStore((prev) => ({
      ...prev,
      defaultPomodoroMinutes: clamped,
    }));
  }, []);

  const handleImportStore = useCallback((nextStore: StudyStore) => {
    setStore(nextStore);
  }, []);

  const handleSelectDateAndFocus = useCallback((date: string) => {
    setSelectedDate(date);
    setActiveTab('today');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleOpenDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
        return;
      } catch {
        // Fallback for browsers that disallow programmatic showPicker
      }
    }
    input.focus();
    input.click();
  };

  const currentLog = store.logs[selectedDate];

  return (
    <div className="min-h-dvh bg-[#F2F6FA] text-slate-900 flex flex-col">
      <header className="sticky top-0 z-10 bg-white/85 backdrop-blur-md shadow-[0_2px_14px_-4px_rgba(15,23,42,0.07)]">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between gap-2">
          <Logo />

          <div className="relative">
            <button
              type="button"
              onClick={handleOpenDatePicker}
              aria-label="Select date"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-2xl bg-slate-100/90 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-emerald-50 hover:text-emerald-700 active:scale-[0.98]"
            >
              <Calendar
                className="h-4 w-4 text-emerald-500 shrink-0"
                aria-hidden="true"
              />
              <span>{formatDateLabel(selectedDate, todayDate)}</span>
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={selectedDate}
              aria-label="Select date"
              onChange={(event) => {
                const nextDate = event.target.value;
                if (nextDate) {
                  setSelectedDate(nextDate);
                }
              }}
              className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
              tabIndex={-1}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-5">
        {activeTab === 'today' ? (
          <div className="space-y-5">
            <DailyLogger
              selectedDate={selectedDate}
              todayDate={todayDate}
              log={currentLog}
              defaultPomodoroMinutes={store.defaultPomodoroMinutes}
              onUpdateLog={handleUpdateLog}
              onChangeDefaultMinutes={handleChangeDefaultMinutes}
            />
            <HistoryLog
              logs={store.logs}
              selectedDate={selectedDate}
              todayDate={todayDate}
              onSelectDate={handleSelectDateAndFocus}
            />
          </div>
        ) : (
          <StatsView
            store={store}
            todayDate={todayDate}
            onSelectDate={handleSelectDateAndFocus}
            onImportStore={handleImportStore}
          />
        )}
      </main>

      <nav
        aria-label="Main navigation"
        className="sticky bottom-0 z-10 bg-white/95 backdrop-blur-md shadow-[0_-4px_20px_-6px_rgba(15,23,42,0.08)] safe-bottom"
      >
        <div className="mx-auto max-w-md grid grid-cols-2 gap-1.5 px-3 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('today')}
            aria-current={activeTab === 'today' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-1 rounded-2xl py-2 text-xs font-semibold min-h-12 transition-colors ${
              activeTab === 'today'
                ? 'bg-emerald-50 text-emerald-600'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <BookOpenCheck className="h-5 w-5" aria-hidden="true" />
            <span>Log</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('stats')}
            aria-current={activeTab === 'stats' ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-1 rounded-2xl py-2 text-xs font-semibold min-h-12 transition-colors ${
              activeTab === 'stats'
                ? 'bg-emerald-50 text-emerald-600'
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
            <span>Stats</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
