import { useRef, useState, type ChangeEvent } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  DatabaseBackup,
  Download,
  Loader2,
  Settings2,
  Upload,
} from 'lucide-react';
import type { StudyStore } from '../types';
import {
  getPendingLogsForSync,
  loadSyncConfig,
  resolveTwoWaySyncConflicts,
  saveSyncConfig,
  syncTwoWayWithSheet,
  type ConflictResolution,
  type SheetSyncConfig,
  type SyncConflict,
  type TwoWaySyncPlan,
} from '../utils/sheetSync';
import { exportStoreJson, parseImportedStoreJson } from '../utils/storage';
import { getTodayDateKey } from '../utils/time';

function formatConflictDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  return year && month && day ? `${day}/${month}/${year}` : dateKey;
}

export interface BackupControlsProps {
  store: StudyStore;
  onImportStore: (nextStore: StudyStore) => void;
}

interface FeedbackState {
  type: 'success' | 'error';
  message: string;
}

function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () =>
      reject(new Error('Could not read the backup file.'));
    reader.readAsText(file);
  });
}

export function BackupControls({ store, onImportStore }: BackupControlsProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [syncConfig, setSyncConfig] = useState<SheetSyncConfig>(() =>
    loadSyncConfig(),
  );
  const [draftUrl, setDraftUrl] = useState<string>(() => syncConfig.workerUrl);
  const [draftSecret, setDraftSecret] = useState<string>(
    () => syncConfig.syncSecret,
  );
  const [showSyncSettings, setShowSyncSettings] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingConflicts, setPendingConflicts] = useState<{
    conflicts: SyncConflict[];
    plan: TwoWaySyncPlan;
  } | null>(null);
  const [conflictChoices, setConflictChoices] = useState<
    Record<string, ConflictResolution>
  >({});

  const pendingCount =
    Object.keys(
      getPendingLogsForSync(store.logs, syncConfig.lastSyncedAt),
    ).length + Object.keys(store.deletedDates ?? {}).length;

  const handleExport = () => {
    try {
      const json = exportStoreJson(store);
      const blob = new Blob([json], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `promo-log-backup-${getTodayDateKey()}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setFeedback({
        type: 'success',
        message: 'Backup JSON exported successfully.',
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Failed to export backup file. Please try again.',
      });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const rawText = await readFileAsText(file);
      const parsedStore = parseImportedStoreJson(rawText);
      onImportStore(parsedStore);
      const dayCount = Object.keys(parsedStore.logs).length;
      setFeedback({
        type: 'success',
        message: `Backup restored successfully (${dayCount} ${dayCount === 1 ? 'day' : 'days'}).`,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Invalid backup file. Please check your JSON.';
      setFeedback({
        type: 'error',
        message,
      });
    } finally {
      event.target.value = '';
    }
  };

  const handleSaveSyncSettings = () => {
    const nextConfig: SheetSyncConfig = {
      ...syncConfig,
      workerUrl: draftUrl.trim(),
      syncSecret: draftSecret.trim(),
    };
    saveSyncConfig(nextConfig);
    setSyncConfig(nextConfig);
    setShowSyncSettings(false);
    setFeedback({
      type: 'success',
      message: 'Google Sheet sync settings saved.',
    });
  };

  const applySyncedOutcome = (result: {
    nextStore: StudyStore;
    pulled: number;
    pushed: number;
    deleted: number;
    syncedAt: string;
  }) => {
    const hadPendingDeletes = Boolean(
      store.deletedDates && Object.keys(store.deletedDates).length > 0,
    );
    if (result.pulled > 0 || result.deleted > 0 || hadPendingDeletes) {
      onImportStore(result.nextStore);
    }
    setSyncConfig((prev) => ({ ...prev, lastSyncedAt: result.syncedAt }));
    if (result.pulled === 0 && result.pushed === 0 && result.deleted === 0) {
      setFeedback({
        type: 'success',
        message: 'Already up to date — no changes to sync.',
      });
      return;
    }

    const parts: string[] = [];
    if (result.pulled > 0) {
      parts.push(`pulled ${result.pulled} ${result.pulled === 1 ? 'day' : 'days'}`);
    }
    if (result.pushed > 0) {
      parts.push(`pushed ${result.pushed} ${result.pushed === 1 ? 'day' : 'days'}`);
    }
    if (result.deleted > 0) {
      parts.push(
        `deleted ${result.deleted} ${result.deleted === 1 ? 'day' : 'days'}`,
      );
    }
    setFeedback({
      type: 'success',
      message: `Synced with Google Sheet (${parts.join(', ')}).`,
    });
  };

  const handleSyncError = (error: unknown) => {
    const rawMessage =
      error instanceof Error
        ? error.message
        : 'Failed to sync with Google Sheet.';
    const isUnauthorized = /unauthorized/i.test(rawMessage);
    if (isUnauthorized) {
      setShowSyncSettings(true);
    }
    setFeedback({
      type: 'error',
      message: isUnauthorized
        ? 'Unauthorized — please check Sync Secret in Sync settings.'
        : rawMessage,
    });
  };

  const handleSyncToSheet = async () => {
    if (!syncConfig.workerUrl.trim()) {
      setShowSyncSettings(true);
      setFeedback({
        type: 'error',
        message: 'Please configure your Cloudflare Worker URL first.',
      });
      return;
    }

    setIsSyncing(true);
    setFeedback(null);
    setPendingConflicts(null);
    setConflictChoices({});
    try {
      const outcome = await syncTwoWayWithSheet(store, syncConfig);
      if (outcome.status === 'conflict') {
        setPendingConflicts({
          conflicts: outcome.conflicts,
          plan: outcome.plan,
        });
      } else {
        applySyncedOutcome(outcome);
      }
    } catch (error) {
      handleSyncError(error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResolveConflict = async (
    date: string,
    choice: ConflictResolution,
  ) => {
    if (!pendingConflicts || isSyncing) return;

    const nextChoices = { ...conflictChoices, [date]: choice };
    const remaining = pendingConflicts.conflicts.filter(
      (conflict) =>
        nextChoices[conflict.date] !== 'local' &&
        nextChoices[conflict.date] !== 'remote',
    );

    setConflictChoices(nextChoices);

    if (remaining.length > 0) {
      setPendingConflicts({
        ...pendingConflicts,
        conflicts: remaining,
      });
      return;
    }

    setIsSyncing(true);
    setFeedback(null);
    try {
      const result = await resolveTwoWaySyncConflicts(
        store,
        pendingConflicts.plan,
        nextChoices,
        syncConfig,
      );
      setPendingConflicts(null);
      setConflictChoices({});
      applySyncedOutcome(result);
    } catch (error) {
      handleSyncError(error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <section
      aria-label="Backup and restore"
      className="rounded-3xl bg-white p-4 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)]"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <DatabaseBackup className="h-4 w-4" aria-hidden="true" />
        </span>
        <h2 className="text-sm font-semibold text-slate-800">Backup</h2>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 active:scale-[0.98]"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          <span>Export JSON</span>
        </button>

        <button
          type="button"
          onClick={handleImportClick}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 active:scale-[0.98]"
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          <span>Import JSON</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          aria-label="Choose JSON backup file"
          onChange={handleFileChange}
          className="sr-only"
        />
      </div>

      <div className="mt-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSyncToSheet}
            disabled={isSyncing}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <CloudUpload className="h-4 w-4" aria-hidden="true" />
            )}
            <span>
              {isSyncing
                ? 'Syncing...'
                : pendingCount > 0
                  ? `Sync to Sheet (${pendingCount})`
                  : 'Sync to Sheet'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowSyncSettings((prev) => !prev)}
            aria-label="Sync settings"
            aria-expanded={showSyncSettings}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 active:scale-[0.98]"
          >
            <Settings2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {syncConfig.lastSyncedAt && (
          <p className="mt-2 text-[11px] text-slate-400">
            Last synced:{' '}
            {new Date(syncConfig.lastSyncedAt).toLocaleString()}
          </p>
        )}

        {pendingConflicts && (
          <div
            role="region"
            aria-label="Sync conflicts"
            className="mt-3 space-y-2.5 rounded-2xl bg-amber-50/90 p-3"
          >
            {pendingConflicts.conflicts.map((conflict) => (
              <div key={conflict.date} className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                  <AlertTriangle
                    className="h-4 w-4 shrink-0 text-amber-600"
                    aria-hidden="true"
                  />
                  <span className="tabular-nums">
                    Sync conflict - {formatConflictDate(conflict.date)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={() =>
                      handleResolveConflict(conflict.date, 'local')
                    }
                    className="rounded-xl bg-emerald-600 px-3 py-2 font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Overwrite DB
                  </button>
                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={() =>
                      handleResolveConflict(conflict.date, 'remote')
                    }
                    className="rounded-xl bg-sky-600 px-3 py-2 font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-60"
                  >
                    Pull from DB
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showSyncSettings && (
          <div className="mt-3 space-y-2.5 rounded-2xl bg-slate-50 p-3">
            <div>
              <label
                htmlFor="sync-worker-url"
                className="block text-xs font-semibold text-slate-600"
              >
                Worker URL
              </label>
              <input
                id="sync-worker-url"
                type="url"
                value={draftUrl}
                onChange={(event) => setDraftUrl(event.target.value)}
                placeholder="https://promo-log-sheet-sync.your-name.workers.dev"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label
                htmlFor="sync-secret-input"
                className="block text-xs font-semibold text-slate-600"
              >
                Sync Secret
              </label>
              <input
                id="sync-secret-input"
                type="password"
                value={draftSecret}
                onChange={(event) => setDraftSecret(event.target.value)}
                placeholder="Optional Bearer secret"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="button"
              onClick={handleSaveSyncSettings}
              className="w-full rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-900"
            >
              Save settings
            </button>
          </div>
        )}
      </div>

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`mt-3 flex items-start gap-2 rounded-2xl px-3 py-2.5 text-xs font-medium ${
            feedback.type === 'error'
              ? 'bg-red-50 text-red-700'
              : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {feedback.type === 'error' ? (
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
          ) : (
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
          )}
          <span>{feedback.message}</span>
        </div>
      )}
    </section>
  );
}
