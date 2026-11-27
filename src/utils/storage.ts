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

function clampMinutes(value: number): number {
  return Math.min(240, Math.max(1, Math.round(value)));
}

function sanitizeSessionArray(items: number[]): number[] {
  return items.map((mins) => clampMinutes(mins));
}

function normalizeSessionEntries(
  rawValue: unknown,
  fallbackMinutes: number,
  dateKey: string,
): number[] {
  // Legacy format: non-negative integer count of pomodoros
  if (typeof rawValue === 'number') {
    if (!isValidSessionCount(rawValue)) {
      throw new Error(
        `Session counts (Morning/Afternoon/Evening) for ${dateKey} must be non-negative integers.`,
      );
    }
    return Array.from({ length: rawValue }, () => fallbackMinutes);
  }

  // New per-item duration array format
  if (Array.isArray(rawValue)) {
    const normalized: number[] = [];
    for (const entry of rawValue) {
      if (!isValidPositiveMinutes(entry)) {
        throw new Error(
          `Session durations (Morning/Afternoon/Evening) for ${dateKey} must be integers between 1 and 240 minutes.`,
        );
      }
      normalized.push(entry);
    }
    return normalized;
  }

  throw new Error(
    `Invalid session entries (Morning/Afternoon/Evening) for ${dateKey}.`,
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
    pomodoroMinutes: clampMinutes(pomodoroMinutes),
    sessions: {
      morning: [],
      afternoon: [],
      evening: [],
    },
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeDayLog(
  key: string,
  rawLog: unknown,
  defaultMinutes: number = DEFAULT_POMODORO_MINUTES,
): DayLog {
  if (!DATE_KEY_REGEX.test(key)) {
    throw new Error(`Invalid date key (expected YYYY-MM-DD): "${key}".`);
  }
  if (!isPlainObject(rawLog)) {
    throw new Error(`Invalid log entry for date ${key}.`);
  }
  if (rawLog.date !== key) {
    throw new Error(`Log date field does not match key "${key}".`);
  }

  let pomodoroMinutes: number | undefined;
  if (rawLog.pomodoroMinutes !== undefined) {
    if (!isValidPositiveMinutes(rawLog.pomodoroMinutes)) {
      throw new Error(
        `Pomodoro duration for ${key} must be an integer between 1 and 240 minutes.`,
      );
    }
    pomodoroMinutes = rawLog.pomodoroMinutes;
  }

  const fallbackMinutes = pomodoroMinutes ?? defaultMinutes;

  if (!isPlainObject(rawLog.sessions)) {
    throw new Error(`Invalid sessions object for date ${key}.`);
  }

  const morning = normalizeSessionEntries(
    rawLog.sessions.morning,
    fallbackMinutes,
    key,
  );
  const afternoon = normalizeSessionEntries(
    rawLog.sessions.afternoon,
    fallbackMinutes,
    key,
  );
  const evening = normalizeSessionEntries(
    rawLog.sessions.evening,
    fallbackMinutes,
    key,
  );

  if (typeof rawLog.updatedAt !== 'string' || rawLog.updatedAt.trim() === '') {
    throw new Error(`Invalid updatedAt timestamp for date ${key}.`);
  }

  const normalized: DayLog = {
    date: key,
    sessions: {
      morning,
      afternoon,
      evening,
    },
    updatedAt: rawLog.updatedAt,
  };

  if (pomodoroMinutes !== undefined) {
    normalized.pomodoroMinutes = pomodoroMinutes;
  }

  return normalized;
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
    normalizedLogs[key] = normalizeDayLog(
      key,
      rawLog,
      data.defaultPomodoroMinutes,
    );
  }

  const normalizedDeleted: Record<string, string> = {};
  if (isPlainObject(data.deletedDates)) {
    for (const [dateKey, deletedAt] of Object.entries(data.deletedDates)) {
      if (
        DATE_KEY_REGEX.test(dateKey) &&
        typeof deletedAt === 'string' &&
        deletedAt.trim() !== '' &&
        !(dateKey in normalizedLogs)
      ) {
        normalizedDeleted[dateKey] = deletedAt;
      }
    }
  }

  const store: StudyStore = {
    defaultPomodoroMinutes: data.defaultPomodoroMinutes,
    logs: normalizedLogs,
  };
  if (Object.keys(normalizedDeleted).length > 0) {
    store.deletedDates = normalizedDeleted;
  }
  return store;
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
    sessions: {
      morning: sanitizeSessionArray(log.sessions.morning),
      afternoon: sanitizeSessionArray(log.sessions.afternoon),
      evening: sanitizeSessionArray(log.sessions.evening),
    },
    updatedAt: log.updatedAt || new Date().toISOString(),
  };

  if (log.pomodoroMinutes !== undefined) {
    nextLog.pomodoroMinutes = clampMinutes(log.pomodoroMinutes);
  }

  let nextDeletedDates = store.deletedDates;
  if (nextDeletedDates && nextLog.date in nextDeletedDates) {
    const rest = { ...nextDeletedDates };
    delete rest[nextLog.date];
    nextDeletedDates = Object.keys(rest).length > 0 ? rest : undefined;
  }

  const nextStore: StudyStore = {
    ...store,
    logs: {
      ...store.logs,
      [nextLog.date]: nextLog,
    },
  };
  if (nextDeletedDates) {
    nextStore.deletedDates = nextDeletedDates;
  } else {
    delete nextStore.deletedDates;
  }
  return nextStore;
}

export function deleteDayLog(store: StudyStore, dateKey: string): StudyStore {
  if (!(dateKey in store.logs)) {
    return store;
  }
  const nextLogs = { ...store.logs };
  delete nextLogs[dateKey];
  return {
    ...store,
    logs: nextLogs,
    deletedDates: {
      ...store.deletedDates,
      [dateKey]: new Date().toISOString(),
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
