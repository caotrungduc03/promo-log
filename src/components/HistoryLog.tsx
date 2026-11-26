import { CalendarDays, CloudSun, Moon, Sun } from 'lucide-react';
import type { DayLog } from '../types';
import {
  formatDateVi,
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

export function HistoryLog({
  logs,
  selectedDate,
  todayDate,
  onSelectDate,
}: HistoryLogProps) {
  const entries = Object.values(logs)
    .filter(
      (log) => getDayTotalMinutes(log) > 0 || log.date === selectedDate,
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <section
      aria-label="Lịch sử học tập"
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
          <h2 className="text-sm font-semibold text-slate-900">Lịch sử</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 tabular-nums">
          {entries.length}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
          Chưa có ngày nào được ghi nhận
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((log) => {
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
                      {formatDateVi(log.date, todayDate)}
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
                      aria-label={`Sáng ${formatMinutes(morningMinutes)}`}
                      className="inline-flex items-center gap-1 rounded-xl bg-amber-50/90 px-2 py-1 text-amber-700"
                    >
                      <Sun
                        className="h-3.5 w-3.5 text-amber-500"
                        aria-hidden="true"
                      />
                      {formatMinutes(morningMinutes)}
                    </span>
                    <span
                      aria-label={`Chiều ${formatMinutes(afternoonMinutes)}`}
                      className="inline-flex items-center gap-1 rounded-xl bg-sky-50/90 px-2 py-1 text-sky-700"
                    >
                      <CloudSun
                        className="h-3.5 w-3.5 text-sky-500"
                        aria-hidden="true"
                      />
                      {formatMinutes(afternoonMinutes)}
                    </span>
                    <span
                      aria-label={`Tối ${formatMinutes(eveningMinutes)}`}
                      className="inline-flex items-center gap-1 rounded-xl bg-violet-50/90 px-2 py-1 text-violet-700"
                    >
                      <Moon
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
      )}
    </section>
  );
}
