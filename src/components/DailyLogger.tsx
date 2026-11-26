import { Sparkles } from 'lucide-react';
import {
  SESSION_KEYS,
  SESSION_LABELS,
  type DayLog,
  type SessionKey,
} from '../types';
import { createEmptyDayLog } from '../utils/storage';
import { formatMinutes, getDayTotalMinutes } from '../utils/time';
import { PomodoroDurationPicker } from './PomodoroDurationPicker';
import { SessionRow } from './SessionRow';

export interface DailyLoggerProps {
  selectedDate: string;
  todayDate: string;
  log: DayLog | undefined;
  defaultPomodoroMinutes: number;
  onUpdateLog: (nextLog: DayLog) => void;
  onChangeDefaultMinutes?: (minutes: number) => void;
  onSelectDate?: (date: string) => void;
}

export function DailyLogger({
  selectedDate,
  log,
  defaultPomodoroMinutes,
  onUpdateLog,
  onChangeDefaultMinutes,
}: DailyLoggerProps) {
  const pomodoroMinutes = log?.pomodoroMinutes ?? defaultPomodoroMinutes;
  const sessions = log?.sessions ?? {
    morning: 0,
    afternoon: 0,
    evening: 0,
  };
  const totalMinutes = getDayTotalMinutes(log);

  const buildBaseLog = (): DayLog =>
    log ?? createEmptyDayLog(selectedDate, defaultPomodoroMinutes);

  const handleSessionChange = (sessionKey: SessionKey, nextCount: number) => {
    const base = buildBaseLog();
    onUpdateLog({
      ...base,
      date: selectedDate,
      sessions: {
        ...base.sessions,
        [sessionKey]: Math.max(0, Math.round(nextCount)),
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const handleDayMinutesChange = (nextMinutes: number) => {
    const base = buildBaseLog();
    onUpdateLog({
      ...base,
      date: selectedDate,
      pomodoroMinutes: Math.min(240, Math.max(1, Math.round(nextMinutes))),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="flex flex-col gap-3.5">
      <section
        aria-label="Tổng thời gian học trong ngày"
        className="flex items-center justify-between gap-3 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-500 px-5 py-4 text-white shadow-lg shadow-emerald-500/20"
      >
        <div>
          <p className="text-xs font-medium tracking-wide text-emerald-50/90">
            Tổng thời gian
          </p>
          <p
            data-testid="daily-total-time"
            className="mt-0.5 text-4xl font-bold tracking-tight tabular-nums"
          >
            {formatMinutes(totalMinutes)}
          </p>
        </div>

        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-white"
          aria-hidden="true"
        >
          <Sparkles className="h-5 w-5" />
        </span>
      </section>

      <PomodoroDurationPicker
        minutes={pomodoroMinutes}
        defaultMinutes={defaultPomodoroMinutes}
        onChangeDayMinutes={handleDayMinutesChange}
        onChangeDefaultMinutes={onChangeDefaultMinutes}
      />

      <div className="flex flex-col gap-3">
        {SESSION_KEYS.map((sessionKey) => (
          <SessionRow
            key={sessionKey}
            sessionKey={sessionKey}
            label={SESSION_LABELS[sessionKey]}
            count={sessions[sessionKey]}
            pomodoroMinutes={pomodoroMinutes}
            resetKey={selectedDate}
            onChangeCount={(nextCount) =>
              handleSessionChange(sessionKey, nextCount)
            }
          />
        ))}
      </div>
    </div>
  );
}
