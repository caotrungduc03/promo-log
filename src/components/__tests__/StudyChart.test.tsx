import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { StudyStore } from '../../types';
import { getLastNDates } from '../../utils/time';
import { BackupControls } from '../BackupControls';
import { StatsView } from '../StatsView';
import { StudyChart } from '../StudyChart';

const TODAY = '2026-11-26';

function createSampleStore(): StudyStore {
  return {
    defaultPomodoroMinutes: 25,
    logs: {
      '2026-11-26': {
        date: '2026-11-26',
        sessions: {
          morning: [25, 50], // mixed durations = 75m = 1h 15m
          afternoon: [20, 30], // mixed durations = 50m
          evening: [25], // 25m
        }, // total = 150m = 2h 30m
        updatedAt: '2026-11-26T10:00:00.000Z',
      },
      '2026-11-24': {
        date: '2026-11-24',
        sessions: {
          morning: [45], // 45m
          afternoon: [30], // 30m
          evening: [], // 0m
        }, // total = 75m = 1h 15m
        updatedAt: '2026-11-24T10:00:00.000Z',
      },
    },
  };
}

describe('StudyChart & StatsView', () => {
  it('renders 7-day and 30-day bars and mixed-duration totals cleanly via StatsView toggle', () => {
    const store = createSampleStore();
    render(
      <StatsView
        store={store}
        todayDate={TODAY}
        onSelectDate={vi.fn()}
        onImportStore={vi.fn()}
      />,
    );

    // Total across 7 days: 150m + 75m = 225m = 3h 45m, 2/7 active days
    expect(screen.getByText('3h 45m')).toBeInTheDocument();
    expect(screen.getByText('2/7 active days')).toBeInTheDocument();

    const bars7 = screen.getAllByTestId(/^chart-bar-/);
    expect(bars7).toHaveLength(7);

    fireEvent.click(screen.getByRole('button', { name: '30 Days' }));

    const bars30 = screen.getAllByTestId(/^chart-bar-/);
    expect(bars30).toHaveLength(30);
    expect(screen.getByText('2/30 active days')).toBeInTheDocument();
  });

  it('displays formatted hours/minutes for mixed-duration sessions and never displays raw pomodoro counts', () => {
    const store = createSampleStore();
    const days = getLastNDates(7, TODAY);

    const { container } = render(
      <StudyChart
        days={days}
        logs={store.logs}
        rangeDays={7}
        todayDate={TODAY}
      />,
    );

    // Click today's bar (2h 30m total; morning [25, 50] = 1h 15m, afternoon [20, 30] = 50m, evening [25] = 25m)
    fireEvent.click(screen.getByTestId(`chart-bar-${TODAY}`));

    const detail = screen.getByTestId('chart-day-detail');
    expect(detail).toHaveTextContent('2h 30m');
    expect(detail).toHaveTextContent('1h 15m');
    expect(detail).toHaveTextContent('50m');
    expect(detail).toHaveTextContent('25m');

    // Also check 2026-11-24 (45m + 30m = 1h 15m total)
    fireEvent.click(screen.getByTestId('chart-bar-2026-11-24'));
    const pastDetail = screen.getByTestId('chart-day-detail');
    expect(pastDetail).toHaveTextContent('1h 15m');
    expect(pastDetail).toHaveTextContent('45m');
    expect(pastDetail).toHaveTextContent('30m');

    // Never show raw pomodoro terminology
    expect(container.textContent?.toLowerCase()).not.toMatch(/pomodoro|pomo/);
  });

  it('reveals Morning/Afternoon/Evening breakdown on tap and triggers onSelectDate when clicking Edit day', () => {
    const store = createSampleStore();
    const days = getLastNDates(7, TODAY);
    const onSelectDate = vi.fn();

    render(
      <StudyChart
        days={days}
        logs={store.logs}
        rangeDays={7}
        todayDate={TODAY}
        onSelectDate={onSelectDate}
      />,
    );

    fireEvent.click(screen.getByTestId(`chart-bar-${TODAY}`));

    const detail = screen.getByTestId('chart-day-detail');
    expect(detail).toHaveTextContent('Today');
    expect(detail).toHaveTextContent('Morning');
    expect(detail).toHaveTextContent('Afternoon');
    expect(detail).toHaveTextContent('Evening');
    expect(detail).toHaveTextContent('1h 15m');
    expect(detail).toHaveTextContent('50m');
    expect(detail).toHaveTextContent('25m');

    fireEvent.click(screen.getByRole('button', { name: /Edit day/i }));
    expect(onSelectDate).toHaveBeenCalledTimes(1);
    expect(onSelectDate).toHaveBeenCalledWith(TODAY);
  });
});

describe('BackupControls', () => {
  it('shows an inline error message when importing invalid JSON', async () => {
    const store = createSampleStore();
    const onImportStore = vi.fn();

    render(<BackupControls store={store} onImportStore={onImportStore} />);

    const input = screen.getByLabelText('Choose JSON backup file');
    const badFile = new File(['{not valid json'], 'broken.json', {
      type: 'application/json',
    });

    fireEvent.change(input, { target: { files: [badFile] } });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/json/i);
    expect(onImportStore).not.toHaveBeenCalled();
  });

  it('imports valid JSON cleanly and calls onImportStore', async () => {
    const currentStore = createSampleStore();
    const importedStore: StudyStore = {
      defaultPomodoroMinutes: 30,
      logs: {
        '2026-11-25': {
          date: '2026-11-25',
          sessions: { morning: [25, 50], afternoon: [30], evening: [] },
          updatedAt: '2026-11-25T12:00:00.000Z',
        },
      },
    };
    const onImportStore = vi.fn();

    render(
      <BackupControls store={currentStore} onImportStore={onImportStore} />,
    );

    const input = screen.getByLabelText('Choose JSON backup file');
    const validFile = new File(
      [JSON.stringify(importedStore)],
      'promo-log-backup-2026-11-26.json',
      { type: 'application/json' },
    );

    fireEvent.change(input, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(onImportStore).toHaveBeenCalledTimes(1);
    });
    expect(onImportStore).toHaveBeenCalledWith(importedStore);
    expect(screen.getByRole('status')).toHaveTextContent(
      /Backup restored successfully/i,
    );
  });
});
