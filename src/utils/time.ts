import type { DayLog, SessionKey } from '../types';

const DATE_KEY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEKDAY_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseDateKey(dateKey: string): Date {
  const match = DATE_KEY_REGEX.exec(dateKey);
  if (!match) {
    throw new Error(`Ngày không hợp lệ: "${dateKey}"`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(year, month - 1, day);
}

/**
 * Returns local date in YYYY-MM-DD format (never UTC).
 */
export function getTodayDateKey(now: Date = new Date()): string {
  return formatLocalDate(now);
}

/**
 * Shifts a YYYY-MM-DD local date key by deltaDays.
 */
export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + deltaDays);
  return formatLocalDate(date);
}

/**
 * Returns an array of n consecutive YYYY-MM-DD keys in chronological order
 * (oldest -> newest) ending on endDateKey (defaults to today).
 */
export function getLastNDates(n: number, endDateKey?: string): string[] {
  if (n <= 0) return [];
  const end = endDateKey ?? getTodayDateKey();
  const result: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    result.push(shiftDateKey(end, -i));
  }
  return result;
}

/**
 * Formats minutes in Vietnamese hours/minutes (e.g., 0 -> "0p", 25 -> "25p",
 * 60 -> "1g", 95 -> "1g 35p"). Never displays pomodoro counts.
 */
export function formatMinutes(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return '0p';
  }
  const rounded = Math.round(totalMinutes);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours === 0) {
    return `${mins}p`;
  }
  if (mins === 0) {
    return `${hours}g`;
  }
  return `${hours}g ${mins}p`;
}

export function getSessionMinutes(
  log: DayLog | undefined,
  session: SessionKey,
): number {
  if (!log) return 0;
  const count = Math.max(0, log.sessions[session] ?? 0);
  const unit = Math.max(0, log.pomodoroMinutes);
  return count * unit;
}

export function getDayTotalMinutes(log: DayLog | undefined): number {
  if (!log) return 0;
  const totalCount =
    Math.max(0, log.sessions.morning) +
    Math.max(0, log.sessions.afternoon) +
    Math.max(0, log.sessions.evening);
  return totalCount * Math.max(0, log.pomodoroMinutes);
}

/**
 * Formats a YYYY-MM-DD key in Vietnamese: "Hôm nay" if it matches today,
 * otherwise e.g. "T5, 26/11" or "CN, 29/11".
 */
export function formatDateVi(dateKey: string, todayKey?: string): string {
  const today = todayKey ?? getTodayDateKey();
  if (dateKey === today) {
    return 'Hôm nay';
  }
  const date = parseDateKey(dateKey);
  const weekday = WEEKDAY_VI[date.getDay()];
  return `${weekday}, ${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`;
}
