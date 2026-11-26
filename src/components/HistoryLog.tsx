import { useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MoonStar,
  Sun,
  Sunrise,
} from 'lucide-react';
import type { DayLog } from '../types';
import {
  formatDateLabel,
  formatMinutes,
  getDayTotalMinutes,
  getSessionMinutes,
} from '../utils/time';

export interface HistoryLogProps {
  logs: Record<string, DayLog>;
  selectedDate: string;
  todayDate: string;
  onSelectDate: (date: string) => void;
}

const PAGE_SIZE = 5;

export function HistoryLog({
  logs,
  selectedDate,
  todayDate,
  onSelectDate,
}: HistoryLogProps) {
  const [page, setPage] = useState(1);

  const entries = Object.values(logs)
    .filter(
      (log) => getDayTotalMinutes(log) > 0 || log.date === selectedDate,
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pagedEntries = entries.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  return (
    <section
      aria-label="Study log"
      className="rounded-3xl bg-white p-4 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)]"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500"
            aria-hidden="true"
          >
            <CalendarDays className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-slate-900">Study Log</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 tabular-nums">
          {entries.length}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
          No study sessions yet
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {pagedEntries.map((log) => {
              const totalMinutes = getDayTotalMinutes(log);
              const morningMinutes = getSessionMinutes(log, 'morning');
              const afternoonMinutes = getSessionMinutes(log, 'afternoon');
              const eveningMinutes = getSessionMinutes(log, 'evening');
              const isSelected = log.date === selectedDate;

              return (
                <li key={log.date}>
                  <button
                    type="button"
                    onClick={() => onSelectDate(log.date)}
                    aria-current={isSelected ? 'date' : undefined}
                    className={`flex w-full flex-col gap-2 rounded-2xl p-3 text-left transition-all active:scale-[0.99] ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-900'
                        : 'bg-slate-50/90 text-slate-800 hover:bg-emerald-50/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">
                        {formatDateLabel(log.date, todayDate)}
                      </span>
                      <span
                        className={`text-sm font-bold tabular-nums ${
                          isSelected ? 'text-emerald-700' : 'text-slate-900'
                        }`}
                      >
                        {formatMinutes(totalMinutes)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tabular-nums">
                      <span
                        aria-label={`Morning ${formatMinutes(morningMinutes)}`}
                        className="inline-flex items-center gap-1 rounded-xl bg-amber-50/90 px-2 py-1 text-amber-700"
                      >
                        <Sunrise
                          className="h-3.5 w-3.5 text-amber-500"
                          aria-hidden="true"
                        />
                        {formatMinutes(morningMinutes)}
                      </span>
                      <span
                        aria-label={`Afternoon ${formatMinutes(afternoonMinutes)}`}
                        className="inline-flex items-center gap-1 rounded-xl bg-sky-50/90 px-2 py-1 text-sky-700"
                      >
                        <Sun
                          className="h-3.5 w-3.5 text-sky-500"
                          aria-hidden="true"
                        />
                        {formatMinutes(afternoonMinutes)}
                      </span>
                      <span
                        aria-label={`Evening ${formatMinutes(eveningMinutes)}`}
                        className="inline-flex items-center gap-1 rounded-xl bg-violet-50/90 px-2 py-1 text-violet-700"
                      >
                        <MoonStar
                          className="h-3.5 w-3.5 text-violet-500"
                          aria-hidden="true"
                        />
                        {formatMinutes(eveningMinutes)}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                aria-label="Previous page"
                disabled={safePage <= 1}
                onClick={() => setPage(Math.max(1, safePage - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-emerald-50 hover:text-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-100 disabled:hover:text-slate-600"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>

              <span className="text-xs font-semibold text-slate-500 tabular-nums">
                {safePage} / {totalPages}
              </span>

              <button
                type="button"
                aria-label="Next page"
                disabled={safePage >= totalPages}
                onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-emerald-50 hover:text-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-100 disabled:hover:text-slate-600"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
