import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DayLog } from '../../types';
import { DailyLogger } from '../DailyLogger';
import { HistoryLog } from '../HistoryLog';

const TODAY = '2026-11-26';
const YESTERDAY = '2026-11-25';

function DailyLoggerHarness({
  initialLog,
  initialDate = TODAY,
  onChangeDefaultMinutes,
  onLogSaved,
}: {
  initialLog?: DayLog;
  initialDate?: string;
  onChangeDefaultMinutes?: (minutes: number) => void;
  onLogSaved?: (nextLog: DayLog) => void;
}) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [defaultMinutes, setDefaultMinutes] = useState(25);
  const [logs, setLogs] = useState<Record<string, DayLog>>(
    initialLog ? { [initialLog.date]: initialLog } : {},
  );

  return (
    <div>
      <button type="button" onClick={() => setSelectedDate(YESTERDAY)}>
        Switch to yesterday
      </button>
      <button type="button" onClick={() => setSelectedDate(TODAY)}>
        Switch to today
      </button>
      <DailyLogger
        selectedDate={selectedDate}
        todayDate={TODAY}
        log={logs[selectedDate]}
        defaultPomodoroMinutes={defaultMinutes}
        onUpdateLog={(nextLog) => {
          setLogs((prev) => ({ ...prev, [nextLog.date]: nextLog }));
          onLogSaved?.(nextLog);
        }}
        onChangeDefaultMinutes={(minutes) => {
          setDefaultMinutes(minutes);
          onChangeDefaultMinutes?.(minutes);
        }}
      />
    </div>
  );
}

describe('DailyLogger 1-tap interactions', () => {
  it('renders numbered items in a horizontally scrollable row and activates 3 sessions (1h 15m)', () => {
    render(<DailyLoggerHarness />);

    const scrollRow = screen.getByTestId('session-scroll-morning');
    expect(scrollRow.className).toContain('flex-nowrap');
    expect(scrollRow.className).toContain('overflow-x-auto');
    expect(scrollRow.className).toContain('thin-scrollbar');

    const morningSection = screen.getByRole('region', {
      name: 'Morning session',
    });
    const firstIcon = within(morningSection).getByRole('button', {
      name: 'Morning: session 1',
    });
    const thirdIcon = within(morningSection).getByRole('button', {
      name: 'Morning: session 3',
    });

    expect(firstIcon).toHaveTextContent('1');
    expect(thirdIcon).toHaveTextContent('3');

    fireEvent.click(thirdIcon);

    expect(firstIcon).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(morningSection).getByRole('button', {
        name: 'Morning: session 2',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(thirdIcon).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(morningSection).getByRole('button', {
        name: 'Morning: session 4',
      }),
    ).toHaveAttribute('aria-pressed', 'false');

    expect(within(morningSection).getByText('1h 15m')).toBeInTheDocument();
    expect(screen.getByTestId('daily-total-time')).toHaveTextContent('1h 15m');
  });

  it('adds an inactive numbered 5th slot on + without changing total, then activates all 5 (2h 5m) on clicking #5', () => {
    render(<DailyLoggerHarness />);

    const morningSection = screen.getByRole('region', {
      name: 'Morning session',
    });
    fireEvent.click(
      within(morningSection).getByRole('button', {
        name: 'Morning: add session',
      }),
    );

    const fifthIcon = within(morningSection).getByRole('button', {
      name: 'Morning: session 5',
    });
    expect(fifthIcon).toHaveTextContent('5');
    expect(fifthIcon).toHaveAttribute('aria-pressed', 'false');
    expect(within(morningSection).getByText('0m')).toBeInTheDocument();
    expect(screen.getByTestId('daily-total-time')).toHaveTextContent('0m');

    fireEvent.click(fifthIcon);

    for (let i = 1; i <= 5; i += 1) {
      expect(
        within(morningSection).getByRole('button', {
          name: `Morning: session ${i}`,
        }),
      ).toHaveAttribute('aria-pressed', 'true');
    }

    expect(within(morningSection).getByText('2h 5m')).toBeInTheDocument();
    expect(screen.getByTestId('daily-total-time')).toHaveTextContent('2h 5m');
  });

  it('resets unused extra slots to 4 on date change and remount while preserving active count', () => {
    const { unmount } = render(<DailyLoggerHarness />);

    const morningSection = screen.getByRole('region', {
      name: 'Morning session',
    });
    fireEvent.click(
      within(morningSection).getByRole('button', {
        name: 'Morning: session 2',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(
      within(morningSection).getByRole('button', {
        name: 'Morning: add session',
      }),
    );
    fireEvent.click(
      within(morningSection).getByRole('button', {
        name: 'Morning: add session',
      }),
    );

    expect(
      within(morningSection).getByRole('button', {
        name: 'Morning: session 6',
      }),
    ).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(
      screen.getByRole('button', { name: 'Switch to yesterday' }),
    );
    expect(
      within(morningSection).queryByRole('button', {
        name: 'Morning: session 5',
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Switch to today' }));
    expect(
      within(morningSection).queryByRole('button', {
        name: 'Morning: session 5',
      }),
    ).not.toBeInTheDocument();
    expect(
      within(morningSection).getByRole('button', {
        name: 'Morning: session 2',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(morningSection).getByRole('button', {
        name: 'Morning: session 3',
      }),
    ).toHaveAttribute('aria-pressed', 'false');

    unmount();

    const savedLog: DayLog = {
      date: TODAY,
      pomodoroMinutes: 25,
      sessions: {
        morning: [25, 25, 25, 25, 25, 25],
        afternoon: [],
        evening: [],
      },
      updatedAt: '2026-11-26T00:00:00.000Z',
    };
    render(<DailyLoggerHarness initialLog={savedLog} />);
    const remountedMorning = screen.getByRole('region', {
      name: 'Morning session',
    });
    expect(
      within(remountedMorning).getByRole('button', {
        name: 'Morning: session 6',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(remountedMorning).queryByRole('button', {
        name: 'Morning: session 7',
      }),
    ).not.toBeInTheDocument();
  });

  it('removes the last item when clicking the last active icon (including #1 -> 0m)', () => {
    render(<DailyLoggerHarness />);

    const afternoonSection = screen.getByRole('region', {
      name: 'Afternoon session',
    });
    const firstIcon = within(afternoonSection).getByRole('button', {
      name: 'Afternoon: session 1',
    });

    fireEvent.click(firstIcon);
    expect(firstIcon).toHaveAttribute('aria-pressed', 'true');
    expect(firstIcon).toHaveTextContent('25m');
    expect(screen.getByTestId('session-total-afternoon')).toHaveTextContent(
      '25m',
    );

    fireEvent.click(firstIcon);
    expect(firstIcon).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('session-total-afternoon')).toHaveTextContent(
      '0m',
    );
    expect(screen.getByTestId('daily-total-time')).toHaveTextContent('0m');
  });

  it('supports mixed pomodoro durations in one day and resets picker via RotateCcw without altering logged items', () => {
    render(<DailyLoggerHarness />);

    const morningSection = screen.getByRole('region', {
      name: 'Morning session',
    });
    const resetButton = screen.getByRole('button', {
      name: 'Reset to default',
    });
    expect(resetButton).toBeDisabled();

    // Log first item at default 25m
    const firstIcon = within(morningSection).getByRole('button', {
      name: 'Morning: session 1',
    });
    fireEvent.click(firstIcon);
    expect(firstIcon).toHaveTextContent('25m');
    expect(screen.getByTestId('daily-total-time')).toHaveTextContent('25m');

    // Switch picker to 50m — already logged 25m item must stay unchanged
    const chip50 = screen.getByRole('button', { name: '50m' });
    fireEvent.click(chip50);
    expect(chip50).toHaveAttribute('aria-pressed', 'true');
    expect(resetButton).toBeEnabled();
    expect(firstIcon).toHaveTextContent('25m');
    expect(screen.getByTestId('daily-total-time')).toHaveTextContent('25m');

    // Log second item at 50m -> 25m + 50m = 1h 15m
    const secondIcon = within(morningSection).getByRole('button', {
      name: 'Morning: session 2',
    });
    fireEvent.click(secondIcon);
    expect(firstIcon).toHaveTextContent('25m');
    expect(secondIcon).toHaveTextContent('50m');
    expect(within(morningSection).getByText('1h 15m')).toBeInTheDocument();
    expect(screen.getByTestId('daily-total-time')).toHaveTextContent('1h 15m');

    // Reset picker to default 25m — logged total must remain 1h 15m
    fireEvent.click(resetButton);
    expect(screen.getByRole('button', { name: '25m' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(resetButton).toBeDisabled();
    expect(within(morningSection).getByText('1h 15m')).toBeInTheDocument();
    expect(screen.getByTestId('daily-total-time')).toHaveTextContent('1h 15m');
  });

  it('commits changes to the database only when clicking Save and clears draft on New', () => {
    const onLogSaved = vi.fn();
    render(<DailyLoggerHarness onLogSaved={onLogSaved} />);

    const newButton = screen.getByRole('button', { name: 'New' });
    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(newButton).toBeDisabled();
    expect(saveButton).toBeDisabled();

    const morningSection = screen.getByRole('region', {
      name: 'Morning session',
    });
    fireEvent.click(
      within(morningSection).getByRole('button', {
        name: 'Morning: session 2',
      }),
    );

    expect(onLogSaved).not.toHaveBeenCalled();
    expect(newButton).toBeEnabled();
    expect(saveButton).toBeEnabled();

    fireEvent.click(newButton);
    expect(screen.getByTestId('daily-total-time')).toHaveTextContent('0m');
    expect(newButton).toBeDisabled();
    expect(saveButton).toBeDisabled();
    expect(onLogSaved).not.toHaveBeenCalled();

    fireEvent.click(
      within(morningSection).getByRole('button', {
        name: 'Morning: session 2',
      }),
    );
    fireEvent.click(saveButton);
    expect(onLogSaved).toHaveBeenCalledTimes(1);
    expect(onLogSaved.mock.calls[0][0].sessions.morning).toEqual([25, 25]);
    expect(saveButton).toBeDisabled();

    const afternoonSection = screen.getByRole('region', {
      name: 'Afternoon session',
    });
    fireEvent.click(
      within(afternoonSection).getByRole('button', {
        name: 'Afternoon: session 1',
      }),
    );

    expect(onLogSaved).toHaveBeenCalledTimes(1);
    expect(saveButton).toBeEnabled();

    fireEvent.click(saveButton);
    expect(onLogSaved).toHaveBeenCalledTimes(2);
    expect(onLogSaved.mock.calls[1][0].sessions.afternoon).toEqual([25]);
  });
});

describe('HistoryLog pagination and delete', () => {
  it('paginates 7 logged days into 5 items on page 1 and 2 items on page 2', () => {
    const logs: Record<string, DayLog> = {};
    for (let day = 20; day <= 26; day += 1) {
      const date = `2026-11-${String(day).padStart(2, '0')}`;
      logs[date] = {
        date,
        pomodoroMinutes: 25,
        sessions: { morning: [25, 25], afternoon: [], evening: [] },
        updatedAt: `${date}T10:00:00.000Z`,
      };
    }

    const onSelectDate = vi.fn();
    render(
      <HistoryLog
        logs={logs}
        selectedDate={TODAY}
        todayDate={TODAY}
        onSelectDate={onSelectDate}
      />,
    );

    const historySection = screen.getByRole('region', { name: 'Study log' });
    expect(within(historySection).getAllByRole('listitem')).toHaveLength(5);
    expect(within(historySection).getByText('1 / 2')).toBeInTheDocument();

    const prevButton = within(historySection).getByRole('button', {
      name: 'Previous page',
    });
    const nextButton = within(historySection).getByRole('button', {
      name: 'Next page',
    });

    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeEnabled();

    fireEvent.click(nextButton);

    expect(within(historySection).getAllByRole('listitem')).toHaveLength(2);
    expect(within(historySection).getByText('2 / 2')).toBeInTheDocument();
    expect(prevButton).toBeEnabled();
    expect(nextButton).toBeDisabled();

    fireEvent.click(prevButton);

    expect(within(historySection).getAllByRole('listitem')).toHaveLength(5);
    expect(within(historySection).getByText('1 / 2')).toBeInTheDocument();
  });

  it('requires inline confirmation before calling onDeleteLog and displays mixed-duration totals', () => {
    const logs: Record<string, DayLog> = {
      [TODAY]: {
        date: TODAY,
        sessions: { morning: [25, 50], afternoon: [30], evening: [] },
        updatedAt: '2026-11-26T10:00:00.000Z',
      },
    };
    const onDeleteLog = vi.fn();

    render(
      <HistoryLog
        logs={logs}
        selectedDate={TODAY}
        todayDate={TODAY}
        onSelectDate={vi.fn()}
        onDeleteLog={onDeleteLog}
      />,
    );

    const historySection = screen.getByRole('region', { name: 'Study log' });
    expect(within(historySection).getByText('1h 45m')).toBeInTheDocument();
    expect(within(historySection).getByText('1h 15m')).toBeInTheDocument();
    expect(within(historySection).getByText('30m')).toBeInTheDocument();

    fireEvent.click(
      within(historySection).getByRole('button', {
        name: 'Delete log for Today',
      }),
    );

    fireEvent.click(
      within(historySection).getByRole('button', { name: 'Cancel delete' }),
    );
    expect(onDeleteLog).not.toHaveBeenCalled();

    fireEvent.click(
      within(historySection).getByRole('button', {
        name: 'Delete log for Today',
      }),
    );
    fireEvent.click(
      within(historySection).getByRole('button', { name: 'Confirm delete' }),
    );
    expect(onDeleteLog).toHaveBeenCalledWith(TODAY);
  });
});
