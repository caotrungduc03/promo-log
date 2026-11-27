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
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_SYNC_WORKER_URL', '');
  });

  it('opens settings when Worker URL is missing', () => {
    render(<BackupControls store={sampleStore} onImportStore={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /sync to sheet/i }));

    expect(screen.getByLabelText(/worker url/i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      /configure your cloudflare worker url/i,
    );
  });

  it('saves sync settings and performs 2-way sync (pull remote + push local) with Bearer auth', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          logs: {
            '2026-11-26': {
              date: '2026-11-26',
              sessions: { morning: [50], afternoon: [], evening: [] },
              updatedAt: '2026-11-26T10:00:00.000Z',
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, updated: 0, appended: 1, total: 1 }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const onImportStore = vi.fn();

    render(<BackupControls store={sampleStore} onImportStore={onImportStore} />);

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
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const [getUrl, getInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(getUrl).toBe('https://my-worker.example.workers.dev/sync');
    expect(getInit.method).toBe('GET');
    expect(getInit.headers).toMatchObject({
      Authorization: 'Bearer top-secret',
    });

    const [postUrl, postInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(postUrl).toBe('https://my-worker.example.workers.dev/sync');
    expect(postInit.method).toBe('POST');
    expect(postInit.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer top-secret',
    });

    expect(onImportStore).toHaveBeenCalledTimes(1);
    expect(onImportStore.mock.calls[0][0].logs['2026-11-26']).toBeDefined();
    expect(onImportStore.mock.calls[0][0].logs['2026-11-27']).toBeDefined();

    expect(screen.getByRole('status')).toHaveTextContent(
      /synced with google sheet \(pulled 1 day, pushed 1 day\)/i,
    );

    const saved = JSON.parse(
      window.localStorage.getItem(SYNC_CONFIG_STORAGE_KEY) || '{}',
    ) as { lastSyncedAt?: string };
    expect(saved.lastSyncedAt).toBeTruthy();
  });

  it('reports up to date when local and remote match', async () => {
    window.localStorage.setItem(
      SYNC_CONFIG_STORAGE_KEY,
      JSON.stringify({
        workerUrl: 'https://my-worker.example.workers.dev',
        syncSecret: '',
        lastSyncedAt: '2026-11-27T10:00:00.000Z',
      }),
    );
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        logs: sampleStore.logs,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<BackupControls store={sampleStore} onImportStore={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /sync to sheet/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      /already up to date/i,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('prompts on conflict and lets user choose Pull from DB or Overwrite DB', async () => {
    window.localStorage.setItem(
      SYNC_CONFIG_STORAGE_KEY,
      JSON.stringify({
        workerUrl: 'https://my-worker.example.workers.dev',
        syncSecret: 'secret',
        lastSyncedAt: '2026-11-27T08:00:00.000Z',
      }),
    );

    const remoteConflictingLog = {
      date: '2026-11-27',
      sessions: { morning: [50], afternoon: [], evening: [] },
      updatedAt: '2026-11-27T09:30:00.000Z',
    };

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        logs: { '2026-11-27': remoteConflictingLog },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const onImportStore = vi.fn();

    const { unmount } = render(
      <BackupControls store={sampleStore} onImportStore={onImportStore} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /sync to sheet/i }));

    const conflictRegion = await screen.findByRole('region', {
      name: /sync conflicts/i,
    });
    expect(conflictRegion).toHaveTextContent(/sync conflict/i);
    expect(conflictRegion).toHaveTextContent('27/11/2026');

    // Clicking Pull from DB executes immediately without extra confirmation
    fireEvent.click(screen.getByRole('button', { name: /pull from db/i }));

    await waitFor(() => {
      expect(onImportStore).toHaveBeenCalledTimes(1);
    });
    expect(onImportStore.mock.calls[0][0].logs['2026-11-27']).toEqual(
      remoteConflictingLog,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      /synced with google sheet \(pulled 1 day\)/i,
    );

    unmount();

    // Next sync: test Overwrite DB executes immediately on click
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          logs: { '2026-11-27': remoteConflictingLog },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, updated: 1, appended: 0, total: 1 }),
      });

    window.localStorage.setItem(
      SYNC_CONFIG_STORAGE_KEY,
      JSON.stringify({
        workerUrl: 'https://my-worker.example.workers.dev',
        syncSecret: 'secret',
        lastSyncedAt: '2026-11-27T08:00:00.000Z',
      }),
    );

    render(<BackupControls store={sampleStore} onImportStore={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /sync to sheet/i }));
    await screen.findByRole('region', { name: /sync conflicts/i });
    fireEvent.click(screen.getByRole('button', { name: /overwrite db/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      /synced with google sheet \(pushed 1 day\)/i,
    );
  });

  it('opens settings with a clear hint when Worker returns Unauthorized', async () => {
    window.localStorage.setItem(
      SYNC_CONFIG_STORAGE_KEY,
      JSON.stringify({
        workerUrl: 'https://my-worker.example.workers.dev',
        syncSecret: '',
      }),
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<BackupControls store={sampleStore} onImportStore={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /sync to sheet/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /unauthorized.*sync secret/i,
    );
    expect(screen.getByLabelText(/sync secret/i)).toBeInTheDocument();
  });

  it('deletes locally removed days on Sheet instead of re-pulling them', async () => {
    window.localStorage.setItem(
      SYNC_CONFIG_STORAGE_KEY,
      JSON.stringify({
        workerUrl: 'https://my-worker.example.workers.dev',
        syncSecret: 'secret',
        lastSyncedAt: '2026-11-27T08:00:00.000Z',
      }),
    );

    const storeWithDeletedDay: StudyStore = {
      defaultPomodoroMinutes: 25,
      logs: {},
      deletedDates: {
        '2026-11-27': '2026-11-27T10:00:00.000Z',
      },
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          logs: {
            '2026-11-27': {
              date: '2026-11-27',
              sessions: { morning: [25], afternoon: [], evening: [] },
              updatedAt: '2026-11-27T09:00:00.000Z',
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          updated: 0,
          appended: 0,
          deleted: 1,
          total: 1,
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const onImportStore = vi.fn();

    render(
      <BackupControls
        store={storeWithDeletedDay}
        onImportStore={onImportStore}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /sync to sheet/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const [, postInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(String(postInit.body))).toEqual({
      logs: {},
      deleteDates: ['2026-11-27'],
    });
    expect(onImportStore).toHaveBeenCalledWith({
      defaultPomodoroMinutes: 25,
      logs: {},
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      /synced with google sheet \(deleted 1 day\)/i,
    );
  });
});
