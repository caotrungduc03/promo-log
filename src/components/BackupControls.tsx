import { useRef, useState, type ChangeEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  DatabaseBackup,
  Download,
  Upload,
} from 'lucide-react';
import type { StudyStore } from '../types';
import { exportStoreJson, parseImportedStoreJson } from '../utils/storage';
import { getTodayDateKey } from '../utils/time';

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

  const handleExport = () => {
    try {
      const json = exportStoreJson(store);
      const blob = new Blob([json], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `pomoday-backup-${getTodayDateKey()}.json`;
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
