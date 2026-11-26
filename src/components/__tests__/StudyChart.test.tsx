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
        pomodoroMinutes: 25,
        sessions: {
          morning: 3, // 75p = 1g 15p
          afternoon: 2, // 50p
          evening: 1, // 25p
        }, // total = 150p = 2g 30p
        updatedAt: '2026-11-26T10:00:00.000Z',
      },
      '2026-11-24': {
        date: '2026-11-24',
        pomodoroMinutes: 25,
        sessions: {
          morning: 2, // 50p
          afternoon: 1, // 25p
          evening: 0, // 0p
        }, // total = 75p = 1g 15p
        updatedAt: '2026-11-24T10:00:00.000Z',
      },
    },
  };
}

describe('StudyChart & StatsView', () => {
  it('renders 7-day and 30-day bars cleanly via StatsView toggle', () => {
    const store = createSampleStore();
    render(
      <StatsView
        store={store}
        todayDate={TODAY}
        onSelectDate={vi.fn()}
        onImportStore={vi.fn()}
      />,
    );

    const bars7 = screen.getAllByTestId(/^chart-bar-/);
    expect(bars7).toHaveLength(7);

    fireEvent.click(screen.getByRole('button', { name: '30 ngày' }));

    const bars30 = screen.getAllByTestId(/^chart-bar-/);
    expect(bars30).toHaveLength(30);
  });

  it('displays formatted hours/minutes and never displays raw pomodoro counts', () => {
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

    // Click today's bar (2g 30p total; morning 1g 15p, afternoon 50p, evening 25p)
    fireEvent.click(screen.getByTestId(`chart-bar-${TODAY}`));

    const detail = screen.getByTestId('chart-day-detail');
    expect(detail).toHaveTextContent('2g 30p');
    expect(detail).toHaveTextContent('1g 15p');
    expect(detail).toHaveTextContent('50p');
    expect(detail).toHaveTextContent('25p');

    // Also check 2026-11-24 (1g 15p total)
    fireEvent.click(screen.getByTestId('chart-bar-2026-11-24'));
    expect(screen.getByTestId('chart-day-detail')).toHaveTextContent('1g 15p');

    // Never show raw pomodoro terminology
    expect(container.textContent?.toLowerCase()).not.toMatch(/pomodoro|pomo/);
  });

  it('reveals Sáng/Chiều/Tối breakdown on tap and triggers onSelectDate when clicking Chỉnh sửa', () => {
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
    expect(detail).toHaveTextContent('Hôm nay');
    expect(detail).toHaveTextContent('Sáng');
    expect(detail).toHaveTextContent('Chiều');
    expect(detail).toHaveTextContent('Tối');
    expect(detail).toHaveTextContent('1g 15p');
    expect(detail).toHaveTextContent('50p');
    expect(detail).toHaveTextContent('25p');

    fireEvent.click(
      screen.getByRole('button', { name: /Chỉnh sửa ngày này/i }),
    );
    expect(onSelectDate).toHaveBeenCalledTimes(1);
    expect(onSelectDate).toHaveBeenCalledWith(TODAY);
  });
});

describe('BackupControls', () => {
  it('shows an inline error message when importing invalid JSON', async () => {
    const store = createSampleStore();
    const onImportStore = vi.fn();

    render(<BackupControls store={store} onImportStore={onImportStore} />);

    const input = screen.getByLabelText('Chọn tệp JSON để khôi phục');
    const badFile = new File(['{not valid json'], 'broken.json', {
      type: 'application/json',
    });

    fireEvent.change(input, { target: { files: [badFile] } });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/JSON không hợp lệ/i);
    expect(onImportStore).not.toHaveBeenCalled();
  });

  it('imports valid JSON cleanly and calls onImportStore', async () => {
    const currentStore = createSampleStore();
    const importedStore: StudyStore = {
      defaultPomodoroMinutes: 30,
      logs: {
        '2026-11-25': {
          date: '2026-11-25',
          pomodoroMinutes: 30,
          sessions: { morning: 2, afternoon: 1, evening: 0 },
          updatedAt: '2026-11-25T12:00:00.000Z',
        },
      },
    };
    const onImportStore = vi.fn();

    render(
      <BackupControls store={currentStore} onImportStore={onImportStore} />,
    );

    const input = screen.getByLabelText('Chọn tệp JSON để khôi phục');
    const validFile = new File(
      [JSON.stringify(importedStore)],
      'study-tracker-backup-2026-11-26.json',
      { type: 'application/json' },
    );

    fireEvent.change(input, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(onImportStore).toHaveBeenCalledTimes(1);
    });
    expect(onImportStore).toHaveBeenCalledWith(importedStore);
    expect(screen.getByRole('status')).toHaveTextContent(
      /Khôi phục dữ liệu thành công/i,
    );
  });
});
