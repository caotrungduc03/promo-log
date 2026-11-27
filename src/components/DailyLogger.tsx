import { useState } from 'react';
import { GraduationCap, Plus, Save } from 'lucide-react';
import {
  SESSION_KEYS,
  SESSION_LABELS,
  type DayLog,
  type SessionKey,
} from '../types';
import { createEmptyDayLog } from '../utils/storage';
import { formatMinutes } from '../utils/time';
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

const EMPTY_SESSIONS: DayLog['sessions'] = {
  morning: [],
  afternoon: [],
  evening: [],
};

function clampMinutes(mins: number): number {
  return Math.min(240, Math.max(1, Math.round(mins)));
}

function areArraysEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((val, idx) => val === b[idx]);
}

function areSessionsEqual(
  a: DayLog['sessions'],
  b: DayLog['sessions'],
): boolean {
  return SESSION_KEYS.every((key) => areArraysEqual(a[key], b[key]));
}

function sumSessionsMinutes(sessions: DayLog['sessions']): number {
  return SESSION_KEYS.reduce(
    (daySum, key) =>
      daySum + sessions[key].reduce((sum, mins) => sum + Math.max(0, mins), 0),
    0,
  );
}

export function DailyLogger({
  selectedDate,
  log,
  defaultPomodoroMinutes,
  onUpdateLog,
  onChangeDefaultMinutes,
}: DailyLoggerProps) {
  const [activeMinutes, setActiveMinutes] = useState(defaultPomodoroMinutes);
  const [prevSelectedDate, setPrevSelectedDate] = useState(selectedDate);
  const [prevLog, setPrevLog] = useState(log);
  const [draftSessions, setDraftSessions] = useState<DayLog['sessions']>(
    () => log?.sessions ?? EMPTY_SESSIONS,
  );

  if (prevSelectedDate !== selectedDate || prevLog !== log) {
    setPrevSelectedDate(selectedDate);
    setPrevLog(log);
    setDraftSessions(log?.sessions ?? EMPTY_SESSIONS);
  }

  const savedSessions = log?.sessions ?? EMPTY_SESSIONS;
  const hasUnsavedChanges = !areSessionsEqual(draftSessions, savedSessions);
  const totalMinutes = sumSessionsMinutes(draftSessions);

  const handleSessionChange = (sessionKey: SessionKey, nextItems: number[]) => {
    setDraftSessions((prev) => ({
      ...prev,
      [sessionKey]: nextItems.map(clampMinutes),
    }));
  };

  const handleActiveMinutesChange = (nextMinutes: number) => {
    setActiveMinutes(clampMinutes(nextMinutes));
  };

  const handleNewDraft = () => {
    setDraftSessions(EMPTY_SESSIONS);
  };

  const handleCommitLog = () => {
    if (!hasUnsavedChanges) return;
    const base = log ?? createEmptyDayLog(selectedDate, activeMinutes);
    onUpdateLog({
      ...base,
      date: selectedDate,
      pomodoroMinutes: activeMinutes,
      sessions: {
        morning: draftSessions.morning.map(clampMinutes),
        afternoon: draftSessions.afternoon.map(clampMinutes),
        evening: draftSessions.evening.map(clampMinutes),
      },
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="flex flex-col gap-3.5">
      <section
        aria-label="Total study time"
        className="flex items-center justify-between gap-3 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-500 px-5 py-4 text-white shadow-lg shadow-emerald-500/20"
      >
        <div>
          <p className="text-xs font-medium tracking-wide text-emerald-50/90">
            Total Study Time
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
          <GraduationCap className="h-5 w-5" />
        </span>
      </section>

      <PomodoroDurationPicker
        minutes={activeMinutes}
        defaultMinutes={defaultPomodoroMinutes}
        onChangeDayMinutes={handleActiveMinutesChange}
        onChangeDefaultMinutes={onChangeDefaultMinutes}
      />

      <div className="flex flex-col gap-3">
        {SESSION_KEYS.map((sessionKey) => (
          <SessionRow
            key={sessionKey}
            sessionKey={sessionKey}
            label={SESSION_LABELS[sessionKey]}
            items={draftSessions[sessionKey]}
            pomodoroMinutes={activeMinutes}
            resetKey={selectedDate}
            onChange={(nextItems) => handleSessionChange(sessionKey, nextItems)}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={handleNewDraft}
          disabled={totalMinutes === 0}
          className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
            totalMinutes > 0
              ? 'bg-white text-slate-700 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)] hover:bg-slate-50 active:scale-[0.99]'
              : 'cursor-not-allowed bg-slate-200/70 text-slate-400'
          }`}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>New</span>
        </button>

        <button
          type="button"
          onClick={handleCommitLog}
          disabled={!hasUnsavedChanges}
          className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
            hasUnsavedChanges
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25 hover:bg-emerald-600 active:scale-[0.99]'
              : 'cursor-not-allowed bg-slate-200/80 text-slate-400'
          }`}
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          <span>Save</span>
        </button>
      </div>
    </div>
  );
}
