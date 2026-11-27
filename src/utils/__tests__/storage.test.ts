import { beforeEach, describe, expect, it } from 'vitest';
import type { DayLog, StudyStore } from '../../types';
import {
  STORAGE_KEY,
  createDefaultStore,
  createEmptyDayLog,
  deleteDayLog,
  exportStoreJson,
  loadStore,
  parseImportedStoreJson,
  saveStore,
  upsertDayLog,
} from '../storage';
import { getDayTotalMinutes } from '../time';

describe('storage utils', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('loadStore returns default store when localStorage is empty or corrupted', () => {
    expect(loadStore()).toEqual(createDefaultStore());

    window.localStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(loadStore()).toEqual(createDefaultStore());

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ wrong: true }));
    expect(loadStore()).toEqual(createDefaultStore());
  });

  it('saveStore and loadStore round-trip mixed-duration pomodoros in one day', () => {
    const log: DayLog = {
      date: '2026-11-26',
      sessions: { morning: [25, 50], afternoon: [30], evening: [] },
      updatedAt: '2026-11-26T08:00:00.000Z',
    };
    const store: StudyStore = {
      defaultPomodoroMinutes: 25,
      logs: { '2026-11-26': log },
    };

    saveStore(store);
    const loaded = loadStore();
    expect(loaded).toEqual(store);
    expect(getDayTotalMinutes(loaded.logs['2026-11-26'])).toBe(105);
  });

  it('migrates legacy numeric session counts seamlessly on loadStore and import', () => {
    const legacyPayload = {
      defaultPomodoroMinutes: 25,
      logs: {
        '2026-11-26': {
          date: '2026-11-26',
          pomodoroMinutes: 30,
          sessions: { morning: 2, afternoon: 1, evening: 0 },
          updatedAt: '2026-11-26T08:00:00.000Z',
        },
      },
    };

    const raw = JSON.stringify(legacyPayload);
    window.localStorage.setItem(STORAGE_KEY, raw);

    const expectedSessions = {
      morning: [30, 30],
      afternoon: [30],
      evening: [],
    };

    const loaded = loadStore();
    expect(loaded.logs['2026-11-26'].sessions).toEqual(expectedSessions);
    expect(getDayTotalMinutes(loaded.logs['2026-11-26'])).toBe(90);

    const imported = parseImportedStoreJson(raw);
    expect(imported.logs['2026-11-26'].sessions).toEqual(expectedSessions);
  });

  it('upsertDayLog immutably inserts and updates logs without mutating previous days', () => {
    const initial = createDefaultStore();
    const day1: DayLog = {
      date: '2026-11-25',
      sessions: { morning: [25, 25], afternoon: [], evening: [] },
      updatedAt: '2026-11-25T10:00:00.000Z',
    };
    const day2: DayLog = {
      date: '2026-11-26',
      sessions: { morning: [30], afternoon: [45, 25], evening: [50] },
      updatedAt: '2026-11-26T10:00:00.000Z',
    };

    const s1 = upsertDayLog(initial, day1);
    const s2 = upsertDayLog(s1, day2);

    expect(initial.logs).toEqual({});
    expect(s2.logs['2026-11-25'].sessions.morning).toEqual([25, 25]);
    expect(s2.logs['2026-11-26'].sessions.afternoon).toEqual([45, 25]);
  });

  it('deleteDayLog immutably removes the target day while preserving others', () => {
    const day1 = createEmptyDayLog('2026-11-25', 25);
    day1.sessions.morning = [25, 25];
    const day2 = createEmptyDayLog('2026-11-26', 30);
    day2.sessions.afternoon = [30];

    const store = upsertDayLog(upsertDayLog(createDefaultStore(), day1), day2);
    const updated = deleteDayLog(store, '2026-11-25');

    expect(updated.logs['2026-11-25']).toBeUndefined();
    expect(updated.deletedDates?.['2026-11-25']).toBeTruthy();
    expect(updated.logs['2026-11-26']).toEqual(day2);
    expect(store.logs['2026-11-25']).toEqual(day1);
    expect(deleteDayLog(updated, '2026-01-01')).toBe(updated);

    const readded = upsertDayLog(updated, day1);
    expect(readded.deletedDates).toBeUndefined();
  });

  it('exportStoreJson and parseImportedStoreJson round-trip cleanly', () => {
    const log = createEmptyDayLog('2026-11-26', 25);
    log.sessions.morning = [25, 45, 50];
    const store = upsertDayLog(createDefaultStore(), log);

    const json = exportStoreJson(store);
    const parsed = parseImportedStoreJson(json);
    expect(parsed).toEqual(store);
  });

  it('parseImportedStoreJson throws readable English errors on invalid input', () => {
    expect(() => parseImportedStoreJson('invalid-json')).toThrow(/Invalid JSON/);
    expect(() => parseImportedStoreJson('[]')).toThrow(/JSON object/);
    expect(() =>
      parseImportedStoreJson(
        JSON.stringify({ defaultPomodoroMinutes: 0, logs: {} }),
      ),
    ).toThrow(/defaultPomodoroMinutes/);
    expect(() =>
      parseImportedStoreJson(
        JSON.stringify({
          defaultPomodoroMinutes: 25,
          logs: {
            '2026-11-26': {
              date: '2026-11-26',
              pomodoroMinutes: 25,
              sessions: { morning: -1, afternoon: 0, evening: 0 },
              updatedAt: '2026-11-26T00:00:00.000Z',
            },
          },
        }),
      ),
    ).toThrow(/non-negative integers/);
    expect(() =>
      parseImportedStoreJson(
        JSON.stringify({
          defaultPomodoroMinutes: 25,
          logs: {
            '2026-11-26': {
              date: '2026-11-26',
              sessions: { morning: [25, 0], afternoon: [], evening: [] },
              updatedAt: '2026-11-26T00:00:00.000Z',
            },
          },
        }),
      ),
    ).toThrow(/1 and 240 minutes/);
  });
});
