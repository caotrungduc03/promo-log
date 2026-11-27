import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudyStore } from '../../types';
import { SYNC_CONFIG_STORAGE_KEY } from '../../utils/sheetSync';
import { BackupControls } from '../BackupControls';

const sampleStore: StudyStore = {
  defaultPomodoroMinutes: 25,
  logs: {
    '2026-11-27': {
      date: '2026-11-27',
      sessions: {
        morning: [25],
        afternoon: [25, 25],
        evening: [],
      },
      updatedAt: '2026-11-27T09:00:00.000Z',
    },
  },
};

describe('BackupControls Google Sheet Sync', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('opens settings when Worker URL is missing', () => {
    render(<BackupControls store={sampleStore} onImportStore={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /sync to sheet/i }));

    expect(screen.getByLabelText(/worker url/i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      /configure your cloudflare worker url/i,
    );
  });

  it('saves sync settings and posts pending logs with Bearer auth', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, updated: 0, appended: 1, total: 1 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<BackupControls store={sampleStore} onImportStore={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /sync settings/i }));
    fireEvent.change(screen.getByLabelText(/worker url/i), {
      target: { value: 'https://my-worker.example.workers.dev/' },
    });
    fireEvent.change(screen.getByLabelText(/sync secret/i), {
      target: { value: 'top-secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    fireEvent.click(screen.getByRole('button', { name: /sync to sheet/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://my-worker.example.workers.dev/sync');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer top-secret',
    });

    expect(screen.getByRole('status')).toHaveTextContent(
      /synced 1 day to google sheet \(1 new, 0 updated\)/i,
    );

    const saved = JSON.parse(
      window.localStorage.getItem(SYNC_CONFIG_STORAGE_KEY) || '{}',
    ) as { lastSyncedAt?: string };
    expect(saved.lastSyncedAt).toBeTruthy();
  });

  it('reports up to date when no logs changed since last sync', async () => {
    window.localStorage.setItem(
      SYNC_CONFIG_STORAGE_KEY,
      JSON.stringify({
        workerUrl: 'https://my-worker.example.workers.dev',
        syncSecret: '',
        lastSyncedAt: '2026-11-27T10:00:00.000Z',
      }),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<BackupControls store={sampleStore} onImportStore={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /sync to sheet/i }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent(
      /already up to date/i,
    );
  });
});
