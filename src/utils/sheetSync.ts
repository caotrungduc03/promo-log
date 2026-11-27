import type { DayLog, StudyStore } from '../types';

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

function getDefaultWorkerUrl(): string {
  const envUrl = import.meta.env.VITE_SYNC_WORKER_URL;
  return typeof envUrl === 'string' ? envUrl.trim() : '';
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

export async function syncLogsToSheet(
  store: StudyStore,
  config: SheetSyncConfig,
): Promise<SheetSyncResult> {
  const endpoint = normalizeWorkerSyncUrl(config.workerUrl);
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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.syncSecret.trim()) {
    headers.Authorization = `Bearer ${config.syncSecret.trim()}`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ logs: pendingLogs }),
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

  const syncedAt = new Date().toISOString();
  saveSyncConfig({
    ...config,
    lastSyncedAt: syncedAt,
  });

  return {
    updated: payload.updated ?? 0,
    appended: payload.appended ?? 0,
    total: payload.total ?? pendingCount,
    syncedAt,
  };
}
