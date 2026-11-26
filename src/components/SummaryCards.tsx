import { Clock, TrendingUp } from 'lucide-react';
import type { DayLog } from '../types';
import { formatMinutes, getDayTotalMinutes } from '../utils/time';

export interface SummaryCardsProps {
  days: string[];
  logs: Record<string, DayLog>;
  rangeDays: 7 | 30;
}

export function SummaryCards({ days, logs, rangeDays }: SummaryCardsProps) {
  let totalMinutes = 0;
  let activeDays = 0;

  for (const date of days) {
    const minutes = getDayTotalMinutes(logs[date]);
    totalMinutes += minutes;
    if (minutes > 0) {
      activeDays += 1;
    }
  }

  const averageMinutes =
    rangeDays > 0 ? Math.round(totalMinutes / rangeDays) : 0;

  return (
    <section
      aria-label="Study time summary"
      className="grid grid-cols-2 gap-3"
    >
      <div className="rounded-3xl bg-white p-4 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <Clock className="h-4 w-4" aria-hidden="true" />
          </span>
          <span>Total Time</span>
        </div>
        <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
          {formatMinutes(totalMinutes)}
        </p>
        <p className="mt-1 text-xs text-slate-400">Last {rangeDays} days</p>
      </div>

      <div className="rounded-3xl bg-white p-4 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
          </span>
          <span>Daily Avg</span>
        </div>
        <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
          {formatMinutes(averageMinutes)}
        </p>
        <p className="mt-1 text-xs text-slate-400 tabular-nums">
          {activeDays}/{rangeDays} active days
        </p>
      </div>
    </section>
  );
}
