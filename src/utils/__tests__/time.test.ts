import { describe, expect, it } from 'vitest';
import type { DayLog } from '../../types';
import {
  formatDateLabel,
  formatMinutes,
  getDayTotalMinutes,
  getLastNDates,
  getSessionMinutes,
  getTodayDateKey,
  shiftDateKey,
} from '../time';

describe('time utils', () => {
  it('getTodayDateKey returns local YYYY-MM-DD', () => {
    const localDate = new Date(2026, 10, 26, 0, 15, 0); // Nov 26, 2026 00:15 local
    expect(getTodayDateKey(localDate)).toBe('2026-11-26');

    const singleDigit = new Date(2026, 0, 5, 23, 59, 0); // Jan 5, 2026
    expect(getTodayDateKey(singleDigit)).toBe('2026-01-05');
  });

  it('shiftDateKey shifts across month and year boundaries', () => {
    expect(shiftDateKey('2026-11-26', -1)).toBe('2026-11-25');
    expect(shiftDateKey('2026-11-26', 5)).toBe('2026-12-01');
    expect(shiftDateKey('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDateKey('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('getLastNDates returns chronological keys ending at endDateKey', () => {
    expect(getLastNDates(0, '2026-11-26')).toEqual([]);
    expect(getLastNDates(1, '2026-11-26')).toEqual(['2026-11-26']);
    expect(getLastNDates(3, '2026-11-26')).toEqual([
      '2026-11-24',
      '2026-11-25',
      '2026-11-26',
    ]);
  });

  it('formatMinutes formats English durations cleanly', () => {
    expect(formatMinutes(0)).toBe('0m');
    expect(formatMinutes(-10)).toBe('0m');
    expect(formatMinutes(25)).toBe('25m');
    expect(formatMinutes(60)).toBe('1h');
    expect(formatMinutes(95)).toBe('1h 35m');
    expect(formatMinutes(120)).toBe('2h');
  });

  it('calculates session and day total minutes using day pomodoroMinutes', () => {
    const log: DayLog = {
      date: '2026-11-26',
      pomodoroMinutes: 30,
      sessions: { morning: 2, afternoon: 1, evening: 3 },
      updatedAt: '2026-11-26T10:00:00.000Z',
    };

    expect(getSessionMinutes(undefined, 'morning')).toBe(0);
    expect(getDayTotalMinutes(undefined)).toBe(0);

    expect(getSessionMinutes(log, 'morning')).toBe(60);
    expect(getSessionMinutes(log, 'afternoon')).toBe(30);
    expect(getSessionMinutes(log, 'evening')).toBe(90);
    expect(getDayTotalMinutes(log)).toBe(180);
  });

  it('formatDateLabel returns Today for today and weekday + Mon D otherwise', () => {
    expect(formatDateLabel('2026-11-26', '2026-11-26')).toBe('Today');
    expect(formatDateLabel('2026-11-26', '2026-11-27')).toBe('Thu, Nov 26');
    expect(formatDateLabel('2026-11-29', '2026-11-27')).toBe('Sun, Nov 29');
  });
});
