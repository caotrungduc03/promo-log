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
  local: DayLog | undefined;
  remote: DayLog;
}

export type ConflictResolution = 'local' | 'remote';

export interface TwoWaySyncPlan {
  mergedLogs: Record<string, DayLog>;
  toPushLogs: Record<string, DayLog>;
  toDeleteDates: string[];
  pulledCount: number;
  conflicts: SyncConflict[];
}

export type TwoWaySyncOutcome =
  | {
      status: 'synced';
      nextStore: StudyStore;
      pulled: number;
      pushed: number;
      deleted: number;
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
  deletedDates: Record<string, string> = {},
): TwoWaySyncPlan {
  const allDates = Array.from(
    new Set([
      ...Object.keys(localLogs),
      ...Object.keys(remoteLogs),
      ...Object.keys(deletedDates),
    ]),
  ).sort((a, b) => a.localeCompare(b));

  const mergedLogs: Record<string, DayLog> = {};
  const toPushLogs: Record<string, DayLog> = {};
  const toDeleteDates: string[] = [];
  const conflicts: SyncConflict[] = [];
  let pulledCount = 0;

  for (const date of allDates) {
    const local = localLogs[date];
    const remote = remoteLogs[date];
    const deletedAt = deletedDates[date];

    if (local && !remote) {
      mergedLogs[date] = local;
      toPushLogs[date] = local;
      continue;
    }

    if (!local && remote) {
      if (deletedAt) {
        if (remote.updatedAt <= deletedAt) {
          toDeleteDates.push(date);
        } else {
          conflicts.push({ date, local: undefined, remote });
        }
        continue;
      }

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
    toDeleteDates,
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
  deleteDates: string[] = [],
): Promise<{ updated: number; appended: number; deleted: number; total: number }> {
  const pushCount = Object.keys(logs).length;
  if (pushCount === 0 && deleteDates.length === 0) {
    return { updated: 0, appended: 0, deleted: 0, total: 0 };
  }

  const endpoint = normalizeWorkerSyncUrl(config.workerUrl);
  const bodyPayload =
    deleteDates.length > 0 ? { logs, deleteDates } : { logs };
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: buildSyncHeaders(config, true),
    body: JSON.stringify(bodyPayload),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    updated?: number;
    appended?: number;
    deleted?: number;
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
    deleted: payload.deleted ?? deleteDates.length,
    total: payload.total ?? pushCount + deleteDates.length,
  };
}

function buildSyncedStore(
  store: StudyStore,
  mergedLogs: Record<string, DayLog>,
): StudyStore {
  return {
    defaultPomodoroMinutes: store.defaultPomodoroMinutes,
    logs: mergedLogs,
  };
}

export async function syncTwoWayWithSheet(
  store: StudyStore,
  config: SheetSyncConfig,
): Promise<TwoWaySyncOutcome> {
  const remoteLogs = await fetchRemoteLogs(config, store.defaultPomodoroMinutes);
  const plan = planTwoWaySync(
    store.logs,
    remoteLogs,
    config.lastSyncedAt,
    store.deletedDates,
  );

  if (plan.conflicts.length > 0) {
    return {
      status: 'conflict',
      conflicts: plan.conflicts,
      plan,
    };
  }

  const pushResult = await pushLogsToSheet(
    plan.toPushLogs,
    config,
    plan.toDeleteDates,
  );
  const syncedAt = new Date().toISOString();
  saveSyncConfig({
    ...config,
    lastSyncedAt: syncedAt,
  });

  return {
    status: 'synced',
    nextStore: buildSyncedStore(store, plan.mergedLogs),
    pulled: plan.pulledCount,
    pushed: Object.keys(plan.toPushLogs).length,
    deleted: pushResult.deleted,
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
  const toDeleteDates: string[] = [...plan.toDeleteDates];
  let pulledCount = plan.pulledCount;

  for (const conflict of plan.conflicts) {
    const choice = resolutions[conflict.date];
    if (choice === 'remote') {
      mergedLogs[conflict.date] = conflict.remote;
      pulledCount += 1;
    } else if (conflict.local) {
      mergedLogs[conflict.date] = conflict.local;
      toPushLogs[conflict.date] = conflict.local;
    } else {
      delete mergedLogs[conflict.date];
      toDeleteDates.push(conflict.date);
    }
  }

  const pushResult = await pushLogsToSheet(toPushLogs, config, toDeleteDates);
  const syncedAt = new Date().toISOString();
  saveSyncConfig({
    ...config,
    lastSyncedAt: syncedAt,
  });

  return {
    status: 'synced',
    nextStore: buildSyncedStore(store, mergedLogs),
    pulled: pulledCount,
    pushed: Object.keys(toPushLogs).length,
    deleted: pushResult.deleted,
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
