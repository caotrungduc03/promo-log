import { beforeEach, describe, expect, it } from 'vitest';
import type { DayLog, StudyStore } from '../../types';
import {
  STORAGE_KEY,
  createDefaultStore,
  createEmptyDayLog,
  exportStoreJson,
  loadStore,
  parseImportedStoreJson,
  saveStore,
  upsertDayLog,
} from '../storage';

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

  it('saveStore and loadStore round-trip a valid store', () => {
    const log: DayLog = {
      date: '2026-11-26',
      pomodoroMinutes: 25,
      sessions: { morning: 2, afternoon: 1, evening: 0 },
      updatedAt: '2026-11-26T08:00:00.000Z',
    };
    const store: StudyStore = {
      defaultPomodoroMinutes: 25,
      logs: { '2026-11-26': log },
    };

    saveStore(store);
    expect(loadStore()).toEqual(store);
  });

  it('upsertDayLog immutably inserts and updates logs without mutating previous days', () => {
    const initial = createDefaultStore();
    const day1: DayLog = {
      date: '2026-11-25',
      pomodoroMinutes: 25,
      sessions: { morning: 2, afternoon: 0, evening: 0 },
      updatedAt: '2026-11-25T10:00:00.000Z',
    };
    const day2: DayLog = {
      date: '2026-11-26',
      pomodoroMinutes: 30,
      sessions: { morning: 1, afternoon: 2, evening: 1 },
      updatedAt: '2026-11-26T10:00:00.000Z',
    };

    const s1 = upsertDayLog(initial, day1);
    const s2 = upsertDayLog(s1, day2);

    expect(initial.logs).toEqual({});
    expect(s2.logs['2026-11-25'].pomodoroMinutes).toBe(25);
    expect(s2.logs['2026-11-26'].pomodoroMinutes).toBe(30);
  });

  it('exportStoreJson and parseImportedStoreJson round-trip cleanly', () => {
    const log = createEmptyDayLog('2026-11-26', 25);
    log.sessions.morning = 3;
    const store = upsertDayLog(createDefaultStore(), log);

    const json = exportStoreJson(store);
    const parsed = parseImportedStoreJson(json);
    expect(parsed).toEqual(store);
  });

  it('parseImportedStoreJson throws readable Vietnamese errors on invalid input', () => {
    expect(() => parseImportedStoreJson('invalid-json')).toThrow(/JSON không hợp lệ/);
    expect(() => parseImportedStoreJson('[]')).toThrow(/đối tượng JSON/);
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
    ).toThrow(/không âm/);
  });
});
