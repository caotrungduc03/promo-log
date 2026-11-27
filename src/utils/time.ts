import type { DayLog, SessionKey } from '../types';

const DATE_KEY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEKDAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH_EN = [
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

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseDateKey(dateKey: string): Date {
  const match = DATE_KEY_REGEX.exec(dateKey);
  if (!match) {
    throw new Error(`Invalid date key: "${dateKey}"`);
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
 * Formats minutes in English hours/minutes (e.g., 0 -> "0m", 25 -> "25m",
 * 60 -> "1h", 95 -> "1h 35m"). Never displays pomodoro counts.
 */
export function formatMinutes(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return '0m';
  }
  const rounded = Math.round(totalMinutes);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours === 0) {
    return `${mins}m`;
  }
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

export function getSessionMinutes(
  log: DayLog | undefined,
  session: SessionKey,
): number {
  if (!log) return 0;
  const items = log.sessions[session];
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, mins) => sum + (Number.isFinite(mins) && mins > 0 ? mins : 0), 0);
}

export function getSessionCount(
  log: DayLog | undefined,
  session: SessionKey,
): number {
  if (!log) return 0;
  const items = log.sessions[session];
  return Array.isArray(items) ? items.length : 0;
}

export function getDayTotalMinutes(log: DayLog | undefined): number {
  if (!log) return 0;
  return (
    getSessionMinutes(log, 'morning') +
    getSessionMinutes(log, 'afternoon') +
    getSessionMinutes(log, 'evening')
  );
}

export function getDayTotalPomodoros(log: DayLog | undefined): number {
  if (!log) return 0;
  return (
    getSessionCount(log, 'morning') +
    getSessionCount(log, 'afternoon') +
    getSessionCount(log, 'evening')
  );
}

/**
 * Formats a YYYY-MM-DD key in English: "Today" if it matches today,
 * otherwise e.g. "Thu, Nov 26" or "Sun, Nov 29".
 */
export function formatDateLabel(dateKey: string, todayKey?: string): string {
  const today = todayKey ?? getTodayDateKey();
  if (dateKey === today) {
    return 'Today';
  }
  const date = parseDateKey(dateKey);
  const weekday = WEEKDAY_EN[date.getDay()];
  const month = MONTH_EN[date.getMonth()];
  return `${weekday}, ${month} ${date.getDate()}`;
}

export const formatDateVi = formatDateLabel;
