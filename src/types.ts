export type SessionKey = 'morning' | 'afternoon' | 'evening';

export const SESSION_KEYS: readonly SessionKey[] = [
  'morning',
  'afternoon',
  'evening',
] as const;

export const SESSION_LABELS: Record<SessionKey, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

export const DEFAULT_POMODORO_MINUTES = 25;

export interface DayLog {
  date: string; // YYYY-MM-DD (local date)
  pomodoroMinutes?: number; // optional last-picked / legacy default duration
  sessions: {
    morning: number[];
    afternoon: number[];
    evening: number[];
  };
  updatedAt: string; // ISO timestamp
}

export interface StudyStore {
  defaultPomodoroMinutes: number; // default 25
  logs: Record<string, DayLog>; // keyed by YYYY-MM-DD
  deletedDates?: Record<string, string>; // dateKey -> deletedAt ISO timestamp
}
