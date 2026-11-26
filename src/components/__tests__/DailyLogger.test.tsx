import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DayLog } from '../../types';
import { DailyLogger } from '../DailyLogger';

const TODAY = '2026-11-26';
const YESTERDAY = '2026-11-25';

function DailyLoggerHarness({
  initialLog,
  initialDate = TODAY,
  onChangeDefaultMinutes,
}: {
  initialLog?: DayLog;
  initialDate?: string;
  onChangeDefaultMinutes?: (minutes: number) => void;
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
        onUpdateLog={(nextLog) =>
          setLogs((prev) => ({ ...prev, [nextLog.date]: nextLog }))
        }
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

  it('adds an inactive numbered 6th slot on + without changing total, then activates all 6 (2h 30m) on clicking #6', () => {
    render(<DailyLoggerHarness />);

    const morningSection = screen.getByRole('region', {
      name: 'Morning session',
    });
    fireEvent.click(
      within(morningSection).getByRole('button', {
        name: 'Morning: add session',
      }),
    );

    const sixthIcon = within(morningSection).getByRole('button', {
      name: 'Morning: session 6',
    });
    expect(sixthIcon).toHaveTextContent('6');
    expect(sixthIcon).toHaveAttribute('aria-pressed', 'false');
    expect(within(morningSection).getByText('0m')).toBeInTheDocument();
    expect(screen.getByTestId('daily-total-time')).toHaveTextContent('0m');

    fireEvent.click(sixthIcon);

    for (let i = 1; i <= 6; i += 1) {
      expect(
        within(morningSection).getByRole('button', {
          name: `Morning: session ${i}`,
        }),
      ).toHaveAttribute('aria-pressed', 'true');
    }

    expect(within(morningSection).getByText('2h 30m')).toBeInTheDocument();
    expect(screen.getByTestId('daily-total-time')).toHaveTextContent('2h 30m');
  });

  it('resets unused extra slots to 5 on date change and remount while preserving active count', () => {
    const { unmount } = render(<DailyLoggerHarness />);

    const morningSection = screen.getByRole('region', {
      name: 'Morning session',
    });
    fireEvent.click(
      within(morningSection).getByRole('button', {
        name: 'Morning: session 2',
      }),
    );
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
        name: 'Morning: session 7',
      }),
    ).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(
      screen.getByRole('button', { name: 'Switch to yesterday' }),
    );
    expect(
      within(morningSection).queryByRole('button', {
        name: 'Morning: session 6',
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Switch to today' }));
    expect(
      within(morningSection).queryByRole('button', {
        name: 'Morning: session 6',
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
      sessions: { morning: 6, afternoon: 0, evening: 0 },
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

  it('resets to 0 (0m) when clicking icon #1 while count is 1', () => {
    render(<DailyLoggerHarness />);

    const afternoonSection = screen.getByRole('region', {
      name: 'Afternoon session',
    });
    const firstIcon = within(afternoonSection).getByRole('button', {
      name: 'Afternoon: session 1',
    });

    fireEvent.click(firstIcon);
    expect(firstIcon).toHaveAttribute('aria-pressed', 'true');
    expect(within(afternoonSection).getByText('25m')).toBeInTheDocument();

    fireEvent.click(firstIcon);
    expect(firstIcon).toHaveAttribute('aria-pressed', 'false');
    expect(within(afternoonSection).getByText('0m')).toBeInTheDocument();
    expect(screen.getByTestId('daily-total-time')).toHaveTextContent('0m');
  });

  it('updates day pomodoroMinutes on chip tap and sets default via icon-only Star button', () => {
    const onChangeDefault = vi.fn();
    render(<DailyLoggerHarness onChangeDefaultMinutes={onChangeDefault} />);

    const eveningSection = screen.getByRole('region', {
      name: 'Evening session',
    });
    fireEvent.click(
      within(eveningSection).getByRole('button', {
        name: 'Evening: session 2',
      }),
    );
    expect(within(eveningSection).getByText('50m')).toBeInTheDocument();
    expect(screen.getByTestId('daily-total-time')).toHaveTextContent('50m');

    const chip45 = screen.getByRole('button', { name: '45m' });
    fireEvent.click(chip45);

    expect(chip45).toHaveAttribute('aria-pressed', 'true');
    expect(within(eveningSection).getByText('1h 30m')).toBeInTheDocument();
    expect(screen.getByTestId('daily-total-time')).toHaveTextContent('1h 30m');

    const defaultButton = screen.getByRole('button', {
      name: 'Set as default',
    });
    expect(defaultButton).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(defaultButton);

    expect(onChangeDefault).toHaveBeenCalledWith(45);
    expect(defaultButton).toHaveAttribute('aria-pressed', 'true');
  });
});
