import {
  SESSION_KEYS,
  type DayLog,
  type StudyStore,
} from '../types';
import { normalizeDayLog } from './storage';

export const SYNC_CONFIG_STORAGE_KEY = 'study-tracker-sheet-sync-v1';

export interface SheetSyncConfig {
  workerUrl: string;
  syncSecret: string;
  lastSyncedAt?: string;
}

export interface SheetSyncResult {
  updated: number;
  appended: number;
  total: number;
  syncedAt: string;
}

export interface SyncConflict {
  date: string;
  local: DayLog;
  remote: DayLog;
}

export type ConflictResolution = 'local' | 'remote';

export interface TwoWaySyncPlan {
  mergedLogs: Record<string, DayLog>;
  toPushLogs: Record<string, DayLog>;
  pulledCount: number;
  conflicts: SyncConflict[];
}

export type TwoWaySyncOutcome =
  | {
      status: 'synced';
      nextStore: StudyStore;
      pulled: number;
      pushed: number;
      updated: number;
      appended: number;
      syncedAt: string;
    }
  | {
      status: 'conflict';
      conflicts: SyncConflict[];
      plan: TwoWaySyncPlan;
    };

function getDefaultWorkerUrl(): string {
  const envUrl = import.meta.env.VITE_SYNC_WORKER_URL;
  return typeof envUrl === 'string' ? envUrl.trim() : '';
}

function buildSyncHeaders(
  config: SheetSyncConfig,
  includeJsonContentType = false,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json';
  }
  if (config.syncSecret.trim()) {
    headers.Authorization = `Bearer ${config.syncSecret.trim()}`;
  }
  return headers;
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

export function loadSyncConfig(): SheetSyncConfig {
  const defaultConfig: SheetSyncConfig = {
    workerUrl: getDefaultWorkerUrl(),
    syncSecret: '',
  };

  try {
    const raw = window.localStorage.getItem(SYNC_CONFIG_STORAGE_KEY);
    if (!raw) return defaultConfig;
    const parsed = JSON.parse(raw) as Partial<SheetSyncConfig>;
    return {
      workerUrl:
        typeof parsed.workerUrl === 'string' && parsed.workerUrl.trim()
          ? parsed.workerUrl.trim()
          : defaultConfig.workerUrl,
      syncSecret: typeof parsed.syncSecret === 'string' ? parsed.syncSecret : '',
      lastSyncedAt:
        typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : undefined,
    };
  } catch {
    return defaultConfig;
  }
}

export function saveSyncConfig(config: SheetSyncConfig): void {
  window.localStorage.setItem(SYNC_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

export function normalizeWorkerSyncUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error('Please configure your Cloudflare Worker URL first.');
  }
  return trimmed.endsWith('/sync') ? trimmed : `${trimmed}/sync`;
}

export function getPendingLogsForSync(
  logs: Record<string, DayLog>,
  lastSyncedAt?: string,
): Record<string, DayLog> {
  if (!lastSyncedAt) {
    return logs;
  }

  const pending: Record<string, DayLog> = {};
  for (const [dateKey, log] of Object.entries(logs)) {
    if (log.updatedAt > lastSyncedAt) {
      pending[dateKey] = log;
    }
  }
  return pending;
}

export function planTwoWaySync(
  localLogs: Record<string, DayLog>,
  remoteLogs: Record<string, DayLog>,
  lastSyncedAt?: string,
): TwoWaySyncPlan {
  const allDates = Array.from(
    new Set([...Object.keys(localLogs), ...Object.keys(remoteLogs)]),
  ).sort((a, b) => a.localeCompare(b));

  const mergedLogs: Record<string, DayLog> = {};
  const toPushLogs: Record<string, DayLog> = {};
  const conflicts: SyncConflict[] = [];
  let pulledCount = 0;

  for (const date of allDates) {
    const local = localLogs[date];
    const remote = remoteLogs[date];

    if (local && !remote) {
      mergedLogs[date] = local;
      toPushLogs[date] = local;
      continue;
    }

    if (!local && remote) {
      mergedLogs[date] = remote;
      pulledCount += 1;
      continue;
    }

    if (local && remote) {
      if (areSessionsEqual(local.sessions, remote.sessions)) {
        mergedLogs[date] = local;
        continue;
      }

      const localDirty = !lastSyncedAt || local.updatedAt > lastSyncedAt;
      const remoteDirty = !lastSyncedAt || remote.updatedAt > lastSyncedAt;

      if (localDirty && !remoteDirty) {
        mergedLogs[date] = local;
        toPushLogs[date] = local;
      } else if (!localDirty && remoteDirty) {
        mergedLogs[date] = remote;
        pulledCount += 1;
      } else {
        mergedLogs[date] = local;
        conflicts.push({ date, local, remote });
      }
    }
  }

  return {
    mergedLogs,
    toPushLogs,
    pulledCount,
    conflicts,
  };
}

export async function fetchRemoteLogs(
  config: SheetSyncConfig,
  defaultPomodoroMinutes?: number,
): Promise<Record<string, DayLog>> {
  const endpoint = normalizeWorkerSyncUrl(config.workerUrl);
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: buildSyncHeaders(config, false),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    logs?: Record<string, unknown>;
  };

  if (!response.ok) {
    throw new Error(
      payload.error || `Sync failed with status ${response.status}.`,
    );
  }

  const rawLogs = payload.logs ?? {};
  const normalized: Record<string, DayLog> = {};
  for (const [dateKey, rawLog] of Object.entries(rawLogs)) {
    normalized[dateKey] = normalizeDayLog(
      dateKey,
      rawLog,
      defaultPomodoroMinutes,
    );
  }
  return normalized;
}

async function pushLogsToSheet(
  logs: Record<string, DayLog>,
  config: SheetSyncConfig,
): Promise<{ updated: number; appended: number; total: number }> {
  const count = Object.keys(logs).length;
  if (count === 0) {
    return { updated: 0, appended: 0, total: 0 };
  }

  const endpoint = normalizeWorkerSyncUrl(config.workerUrl);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: buildSyncHeaders(config, true),
    body: JSON.stringify({ logs }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    updated?: number;
    appended?: number;
    total?: number;
  };

  if (!response.ok) {
    throw new Error(
      payload.error || `Sync failed with status ${response.status}.`,
    );
  }

  return {
    updated: payload.updated ?? 0,
    appended: payload.appended ?? 0,
    total: payload.total ?? count,
  };
}

export async function syncTwoWayWithSheet(
  store: StudyStore,
  config: SheetSyncConfig,
): Promise<TwoWaySyncOutcome> {
  const remoteLogs = await fetchRemoteLogs(config, store.defaultPomodoroMinutes);
  const plan = planTwoWaySync(store.logs, remoteLogs, config.lastSyncedAt);

  if (plan.conflicts.length > 0) {
    return {
      status: 'conflict',
      conflicts: plan.conflicts,
      plan,
    };
  }

  const pushResult = await pushLogsToSheet(plan.toPushLogs, config);
  const syncedAt = new Date().toISOString();
  saveSyncConfig({
    ...config,
    lastSyncedAt: syncedAt,
  });

  return {
    status: 'synced',
    nextStore: {
      ...store,
      logs: plan.mergedLogs,
    },
    pulled: plan.pulledCount,
    pushed: pushResult.total,
    updated: pushResult.updated,
    appended: pushResult.appended,
    syncedAt,
  };
}

export async function resolveTwoWaySyncConflicts(
  store: StudyStore,
  plan: TwoWaySyncPlan,
  resolutions: Record<string, ConflictResolution>,
  config: SheetSyncConfig,
): Promise<Extract<TwoWaySyncOutcome, { status: 'synced' }>> {
  const mergedLogs: Record<string, DayLog> = { ...plan.mergedLogs };
  const toPushLogs: Record<string, DayLog> = { ...plan.toPushLogs };
  let pulledCount = plan.pulledCount;

  for (const conflict of plan.conflicts) {
    const choice = resolutions[conflict.date];
    if (choice === 'remote') {
      mergedLogs[conflict.date] = conflict.remote;
      pulledCount += 1;
    } else {
      mergedLogs[conflict.date] = conflict.local;
      toPushLogs[conflict.date] = conflict.local;
    }
  }

  const pushResult = await pushLogsToSheet(toPushLogs, config);
  const syncedAt = new Date().toISOString();
  saveSyncConfig({
    ...config,
    lastSyncedAt: syncedAt,
  });

  return {
    status: 'synced',
    nextStore: {
      ...store,
      logs: mergedLogs,
    },
    pulled: pulledCount,
    pushed: pushResult.total,
    updated: pushResult.updated,
    appended: pushResult.appended,
    syncedAt,
  };
}

export async function syncLogsToSheet(
  store: StudyStore,
  config: SheetSyncConfig,
): Promise<SheetSyncResult> {
  const pendingLogs = getPendingLogsForSync(store.logs, config.lastSyncedAt);
  const pendingCount = Object.keys(pendingLogs).length;

  if (pendingCount === 0) {
    return {
      updated: 0,
      appended: 0,
      total: 0,
      syncedAt: config.lastSyncedAt ?? new Date().toISOString(),
    };
  }

  const result = await pushLogsToSheet(pendingLogs, config);
  const syncedAt = new Date().toISOString();
  saveSyncConfig({
    ...config,
    lastSyncedAt: syncedAt,
  });

  return {
    updated: result.updated,
    appended: result.appended,
    total: result.total,
    syncedAt,
  };
}
