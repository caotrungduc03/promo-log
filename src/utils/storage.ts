import {
  DEFAULT_POMODORO_MINUTES,
  type DayLog,
  type StudyStore,
} from '../types';

export const STORAGE_KEY = 'study-tracker-v1';

const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidPositiveMinutes(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 240
  );
}

function isValidSessionCount(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

export function createDefaultStore(): StudyStore {
  return {
    defaultPomodoroMinutes: DEFAULT_POMODORO_MINUTES,
    logs: {},
  };
}

export function createEmptyDayLog(
  date: string,
  pomodoroMinutes: number = DEFAULT_POMODORO_MINUTES,
): DayLog {
  return {
    date,
    pomodoroMinutes,
    sessions: {
      morning: 0,
      afternoon: 0,
      evening: 0,
    },
    updatedAt: new Date().toISOString(),
  };
}

function validateStoreObject(data: unknown): StudyStore {
  if (!isPlainObject(data)) {
    throw new Error('Invalid backup structure: file must contain a JSON object.');
  }

  if (!isValidPositiveMinutes(data.defaultPomodoroMinutes)) {
    throw new Error(
      'Default duration (defaultPomodoroMinutes) must be an integer between 1 and 240 minutes.',
    );
  }

  if (!isPlainObject(data.logs)) {
    throw new Error('Invalid logs field in backup file.');
  }

  const normalizedLogs: Record<string, DayLog> = {};

  for (const [key, rawLog] of Object.entries(data.logs)) {
    if (!DATE_KEY_REGEX.test(key)) {
      throw new Error(`Invalid date key (expected YYYY-MM-DD): "${key}".`);
    }
    if (!isPlainObject(rawLog)) {
      throw new Error(`Invalid log entry for date ${key}.`);
    }
    if (rawLog.date !== key) {
      throw new Error(`Log date field does not match key "${key}".`);
    }
    if (!isValidPositiveMinutes(rawLog.pomodoroMinutes)) {
      throw new Error(
        `Pomodoro duration for ${key} must be an integer between 1 and 240 minutes.`,
      );
    }
    if (!isPlainObject(rawLog.sessions)) {
      throw new Error(`Invalid sessions object for date ${key}.`);
    }

    const { morning, afternoon, evening } = rawLog.sessions;
    if (
      !isValidSessionCount(morning) ||
      !isValidSessionCount(afternoon) ||
      !isValidSessionCount(evening)
    ) {
      throw new Error(
        `Session counts (Morning/Afternoon/Evening) for ${key} must be non-negative integers.`,
      );
    }

    if (typeof rawLog.updatedAt !== 'string' || rawLog.updatedAt.trim() === '') {
      throw new Error(`Invalid updatedAt timestamp for date ${key}.`);
    }

    normalizedLogs[key] = {
      date: key,
      pomodoroMinutes: rawLog.pomodoroMinutes,
      sessions: {
        morning,
        afternoon,
        evening,
      },
      updatedAt: rawLog.updatedAt,
    };
  }

  return {
    defaultPomodoroMinutes: data.defaultPomodoroMinutes,
    logs: normalizedLogs,
  };
}

export function loadStore(): StudyStore {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultStore();
    }
    const parsed: unknown = JSON.parse(raw);
    return validateStoreObject(parsed);
  } catch {
    return createDefaultStore();
  }
}

export function saveStore(store: StudyStore): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function upsertDayLog(store: StudyStore, log: DayLog): StudyStore {
  const nextLog: DayLog = {
    date: log.date,
    pomodoroMinutes: log.pomodoroMinutes,
    sessions: {
      morning: Math.max(0, Math.round(log.sessions.morning)),
      afternoon: Math.max(0, Math.round(log.sessions.afternoon)),
      evening: Math.max(0, Math.round(log.sessions.evening)),
    },
    updatedAt: log.updatedAt || new Date().toISOString(),
  };

  return {
    ...store,
    logs: {
      ...store.logs,
      [nextLog.date]: nextLog,
    },
  };
}

export function exportStoreJson(store: StudyStore): string {
  return JSON.stringify(store, null, 2);
}

export function parseImportedStoreJson(raw: string): StudyStore {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON data. Please check your backup file.');
  }
  return validateStoreObject(parsed);
}
