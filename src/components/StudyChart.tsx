import { useState } from 'react';
import { MoonStar, Pencil, Sun, Sunrise } from 'lucide-react';
import {
  SESSION_KEYS,
  SESSION_LABELS,
  type DayLog,
  type SessionKey,
} from '../types';
import {
  formatDateLabel,
  formatMinutes,
  getDayTotalMinutes,
  getSessionMinutes,
} from '../utils/time';

export interface StudyChartProps {
  days: string[];
  logs: Record<string, DayLog>;
  rangeDays: 7 | 30;
  todayDate: string;
  onSelectDate?: (date: string) => void;
}

const SESSION_BAR_CLASSES: Record<SessionKey, string> = {
  morning: 'bg-amber-400',
  afternoon: 'bg-sky-400',
  evening: 'bg-violet-500',
};

const SESSION_ICON_CLASSES: Record<SessionKey, string> = {
  morning: 'text-amber-500',
  afternoon: 'text-sky-500',
  evening: 'text-violet-500',
};

const SESSION_ICONS: Record<SessionKey, typeof Sunrise> = {
  morning: Sunrise,
  afternoon: Sun,
  evening: MoonStar,
};

const WEEKDAY_SHORT_EN = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const;

const MONTH_SHORT_EN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function parseLocalDateParts(dateKey: string): {
  year: number;
  month: number;
  day: number;
  weekday: number;
} {
  const [y, m, d] = dateKey.split('-').map(Number);
  const localDate = new Date(y, m - 1, d);
  return {
    year: y,
    month: m,
    day: d,
    weekday: localDate.getDay(),
  };
}

function formatMonthDayEn(dateKey: string): string {
  const { day, month } = parseLocalDateParts(dateKey);
  return `${MONTH_SHORT_EN[month - 1]} ${day}`;
}

function getShortAxisLabel(
  dateKey: string,
  index: number,
  totalDays: number,
  rangeDays: 7 | 30,
  todayDate: string,
): string {
  if (rangeDays === 7) {
    if (dateKey === todayDate) {
      return 'Today';
    }
    const { weekday } = parseLocalDateParts(dateKey);
    return WEEKDAY_SHORT_EN[weekday];
  }

  const isLast = index === totalDays - 1;
  if (isLast) {
    return dateKey === todayDate ? 'Today' : formatMonthDayEn(dateKey);
  }
  if (index === 0 || index === 9 || index === 19) {
    return formatMonthDayEn(dateKey);
  }
  return '';
}

function computeScale(maxMinutes: number): { yMax: number; ticks: number[] } {
  if (maxMinutes <= 60) {
    return { yMax: 60, ticks: [60, 30, 0] };
  }
  if (maxMinutes <= 120) {
    return { yMax: 120, ticks: [120, 60, 0] };
  }
  if (maxMinutes <= 240) {
    return { yMax: 240, ticks: [240, 120, 0] };
  }
  if (maxMinutes <= 360) {
    return { yMax: 360, ticks: [360, 180, 0] };
  }
  const yMax = Math.ceil(maxMinutes / 120) * 120;
  return { yMax, ticks: [yMax, Math.round(yMax / 2), 0] };
}

export function StudyChart({
  days,
  logs,
  rangeDays,
  todayDate,
  onSelectDate,
}: StudyChartProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const effectiveSelectedDate =
    selectedDate !== null && days.includes(selectedDate) ? selectedDate : null;

  const dayEntries = days.map((date) => {
    const log = logs[date];
    const morning = getSessionMinutes(log, 'morning');
    const afternoon = getSessionMinutes(log, 'afternoon');
    const evening = getSessionMinutes(log, 'evening');
    const total = getDayTotalMinutes(log);
    return {
      date,
      morning,
      afternoon,
      evening,
      total,
    };
  });

  const maxDayMinutes = dayEntries.reduce(
    (max, item) => (item.total > max ? item.total : max),
    0,
  );
  const { yMax, ticks } = computeScale(maxDayMinutes);

  const selectedEntry = effectiveSelectedDate
    ? dayEntries.find((item) => item.date === effectiveSelectedDate) ?? null
    : null;

  const handleToggleDate = (date: string) => {
    setSelectedDate((prev) => (prev === date ? null : date));
  };

  return (
    <section
      aria-label="Study time chart"
      className="rounded-3xl bg-white p-4 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)]"
    >
      {/* Header & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">
          Study Overview
        </h2>
        <div
          className="flex items-center gap-3 text-xs font-medium text-slate-500"
          aria-label="Session legend"
        >
          {SESSION_KEYS.map((key) => {
            const Icon = SESSION_ICONS[key];
            return (
              <span key={key} className="inline-flex items-center gap-1">
                <Icon
                  className={`h-3.5 w-3.5 ${SESSION_ICON_CLASSES[key]}`}
                  aria-hidden="true"
                />
                <span>{SESSION_LABELS[key]}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Stacked Bar Chart */}
      <div className="mt-4">
        <div className="flex gap-2">
          {/* Y-axis scale labels */}
          <div
            className="flex h-44 w-9 shrink-0 flex-col justify-between pb-0.5 text-right text-[11px] font-medium text-slate-400 tabular-nums"
            aria-hidden="true"
          >
            {ticks.map((tick) => (
              <span key={tick} className="leading-none">
                {formatMinutes(tick)}
              </span>
            ))}
          </div>

          {/* Plot area */}
          <div className="relative flex-1">
            {/* Ultra-subtle horizontal reference lines */}
            <div
              className="pointer-events-none absolute inset-0 flex flex-col justify-between"
              aria-hidden="true"
            >
              {ticks.map((tick) => (
                <div
                  key={tick}
                  className={
                    tick === 0 ? 'h-px bg-slate-200/80' : 'h-px bg-slate-100'
                  }
                />
              ))}
            </div>

            {/* Bars */}
            <div
              role="group"
              aria-label={`Study time bars for ${rangeDays} days`}
              className={`relative z-10 flex h-44 items-end ${
                rangeDays === 7 ? 'gap-2 px-1' : 'gap-[3px]'
              }`}
            >
              {dayEntries.map((entry) => {
                const isSelected = entry.date === effectiveSelectedDate;
                const totalHeightPct =
                  entry.total > 0
                    ? Math.min(100, (entry.total / yMax) * 100)
                    : 0;
                const morningPct =
                  entry.total > 0 ? (entry.morning / entry.total) * 100 : 0;
                const afternoonPct =
                  entry.total > 0 ? (entry.afternoon / entry.total) * 100 : 0;
                const eveningPct =
                  entry.total > 0 ? (entry.evening / entry.total) * 100 : 0;

                const dateLabel = formatDateLabel(entry.date, todayDate);
                const totalLabel = formatMinutes(entry.total);

                return (
                  <button
                    key={entry.date}
                    type="button"
                    data-testid={`chart-bar-${entry.date}`}
                    data-date={entry.date}
                    aria-pressed={isSelected}
                    aria-label={`${dateLabel}: ${totalLabel}`}
                    onClick={() => handleToggleDate(entry.date)}
                    className={`group flex h-full flex-1 flex-col justify-end rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-500 ${
                      rangeDays === 7 ? 'px-1 pt-1' : 'pt-1'
                    } ${
                      isSelected ? 'bg-emerald-50/70' : 'hover:bg-slate-50/90'
                    }`}
                  >
                    {entry.total > 0 ? (
                      <div
                        className={`flex w-full flex-col justify-end overflow-hidden transition-all ${
                          rangeDays === 7 ? 'rounded-t-lg' : 'rounded-t-sm'
                        }`}
                        style={{
                          height: `${totalHeightPct}%`,
                          minHeight: '4px',
                        }}
                      >
                        {entry.evening > 0 && (
                          <div
                            className={`w-full ${SESSION_BAR_CLASSES.evening}`}
                            style={{ height: `${eveningPct}%` }}
                          />
                        )}
                        {entry.afternoon > 0 && (
                          <div
                            className={`w-full ${SESSION_BAR_CLASSES.afternoon}`}
                            style={{ height: `${afternoonPct}%` }}
                          />
                        )}
                        {entry.morning > 0 && (
                          <div
                            className={`w-full ${SESSION_BAR_CLASSES.morning}`}
                            style={{ height: `${morningPct}%` }}
                          />
                        )}
                      </div>
                    ) : (
                      <div
                        className="h-[3px] w-full rounded-full bg-slate-100"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* X-axis labels */}
        <div className="mt-2 flex gap-2">
          <div className="w-9 shrink-0" aria-hidden="true" />
          <div
            className={`flex flex-1 ${
              rangeDays === 7 ? 'gap-2 px-1' : 'gap-[3px]'
            }`}
          >
            {dayEntries.map((entry, index) => {
              const label = getShortAxisLabel(
                entry.date,
                index,
                dayEntries.length,
                rangeDays,
                todayDate,
              );
              const isSelected = entry.date === effectiveSelectedDate;
              const isToday = entry.date === todayDate;

              return (
                <div
                  key={entry.date}
                  className={`flex-1 text-center text-[11px] leading-tight whitespace-nowrap ${
                    isSelected
                      ? 'font-semibold text-emerald-600'
                      : isToday
                        ? 'font-semibold text-slate-800'
                        : 'text-slate-400'
                  }`}
                >
                  {label}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Day Detail Panel */}
      {selectedEntry ? (
        <div
          data-testid="chart-day-detail"
          className="mt-4 rounded-2xl bg-slate-50 p-3.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">
                {formatDateLabel(selectedEntry.date, todayDate)}
              </span>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 tabular-nums">
                {formatMinutes(selectedEntry.total)}
              </span>
            </div>

            {onSelectDate && (
              <button
                type="button"
                aria-label="Edit day"
                title="Edit day"
                onClick={() => onSelectDate(selectedEntry.date)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-xs transition-colors hover:bg-emerald-600 active:scale-95"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {SESSION_KEYS.map((key) => {
              const sessionMinutes = selectedEntry[key];
              const Icon = SESSION_ICONS[key];
              return (
                <div
                  key={key}
                  className="rounded-xl bg-white px-2.5 py-2 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.05)]"
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                    <Icon
                      className={`h-3.5 w-3.5 shrink-0 ${SESSION_ICON_CLASSES[key]}`}
                      aria-hidden="true"
                    />
                    <span>{SESSION_LABELS[key]}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-900 tabular-nums">
                    {formatMinutes(sessionMinutes)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-center text-xs text-slate-400">
          {maxDayMinutes === 0
            ? 'No study data yet'
            : 'Tap any bar to view breakdown'}
        </p>
      )}
    </section>
  );
}
