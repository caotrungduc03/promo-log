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
    throw new Error('Cấu trúc dữ liệu không hợp lệ: tệp phải là một đối tượng JSON.');
  }

  if (!isValidPositiveMinutes(data.defaultPomodoroMinutes)) {
    throw new Error(
      'Thời lượng mặc định (defaultPomodoroMinutes) phải là số nguyên từ 1 đến 240 phút.',
    );
  }

  if (!isPlainObject(data.logs)) {
    throw new Error('Trường nhật ký (logs) không hợp lệ.');
  }

  const normalizedLogs: Record<string, DayLog> = {};

  for (const [key, rawLog] of Object.entries(data.logs)) {
    if (!DATE_KEY_REGEX.test(key)) {
      throw new Error(`Khóa ngày không đúng định dạng YYYY-MM-DD: "${key}".`);
    }
    if (!isPlainObject(rawLog)) {
      throw new Error(`Dữ liệu của ngày ${key} không hợp lệ.`);
    }
    if (rawLog.date !== key) {
      throw new Error(`Trường date không khớp với khóa ngày "${key}".`);
    }
    if (!isValidPositiveMinutes(rawLog.pomodoroMinutes)) {
      throw new Error(
        `Thời lượng pomodoro của ngày ${key} phải là số nguyên từ 1 đến 240 phút.`,
      );
    }
    if (!isPlainObject(rawLog.sessions)) {
      throw new Error(`Dữ liệu các buổi học của ngày ${key} không hợp lệ.`);
    }

    const { morning, afternoon, evening } = rawLog.sessions;
    if (
      !isValidSessionCount(morning) ||
      !isValidSessionCount(afternoon) ||
      !isValidSessionCount(evening)
    ) {
      throw new Error(
        `Số phiên học (Sáng/Chiều/Tối) của ngày ${key} phải là số nguyên không âm.`,
      );
    }

    if (typeof rawLog.updatedAt !== 'string' || rawLog.updatedAt.trim() === '') {
      throw new Error(`Thời gian cập nhật (updatedAt) của ngày ${key} không hợp lệ.`);
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
    throw new Error('Dữ liệu JSON không hợp lệ. Vui lòng kiểm tra lại tệp sao lưu.');
  }
  return validateStoreObject(parsed);
}
