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
        Chuyển hôm qua
      </button>
      <button type="button" onClick={() => setSelectedDate(TODAY)}>
        Chuyển hôm nay
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
  it('activates 3 pomodoros (1g 15p) when clicking icon #3', () => {
    render(<DailyLoggerHarness />);

    const morningSection = screen.getByRole('region', { name: 'Buổi Sáng' });
    fireEvent.click(
      within(morningSection).getByRole('button', { name: 'Sáng: phiên 3' }),
    );

    expect(
      within(morningSection).getByRole('button', { name: 'Sáng: phiên 1' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(morningSection).getByRole('button', { name: 'Sáng: phiên 2' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(morningSection).getByRole('button', { name: 'Sáng: phiên 3' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(morningSection).getByRole('button', { name: 'Sáng: phiên 4' }),
    ).toHaveAttribute('aria-pressed', 'false');

    expect(within(morningSection).getByText('1g 15p')).toBeInTheDocument();
    expect(screen.getByTestId('daily-total-time')).toHaveTextContent('1g 15p');
  });

  it('adds an inactive 6th icon on + without changing total, then activates all 6 (2g 30p) on clicking #6', () => {
    render(<DailyLoggerHarness />);

    const morningSection = screen.getByRole('region', { name: 'Buổi Sáng' });
    fireEvent.click(
      within(morningSection).getByRole('button', { name: 'Sáng: thêm phiên' }),
    );

    const sixthIcon = within(morningSection).getByRole('button', {
      name: 'Sáng: phiên 6',
    });
    expect(sixthIcon).toHaveAttribute('aria-pressed', 'false');
    expect(within(morningSection).getByText('0p')).toBeInTheDocument();
    expect(screen.getByTestId('daily-total-time')).toHaveTextContent('0p');

    fireEvent.click(sixthIcon);

    for (let i = 1; i <= 6; i += 1) {
      expect(
        within(morningSection).getByRole('button', {
          name: `Sáng: phiên ${i}`,
        }),
      ).toHaveAttribute('aria-pressed', 'true');
    }

    expect(within(morningSection).getByText('2g 30p')).toBeInTheDocument();
    expect(screen.getByTestId('daily-total-time')).toHaveTextContent('2g 30p');
  });

  it('resets unused extra slots to 5 on date change and remount while preserving active count', () => {
    const { unmount } = render(<DailyLoggerHarness />);

    const morningSection = screen.getByRole('region', { name: 'Buổi Sáng' });
    fireEvent.click(
      within(morningSection).getByRole('button', { name: 'Sáng: phiên 2' }),
    );
    fireEvent.click(
      within(morningSection).getByRole('button', { name: 'Sáng: thêm phiên' }),
    );
    fireEvent.click(
      within(morningSection).getByRole('button', { name: 'Sáng: thêm phiên' }),
    );

    expect(
      within(morningSection).getByRole('button', { name: 'Sáng: phiên 7' }),
    ).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Chuyển hôm qua' }));
    expect(
      within(morningSection).queryByRole('button', { name: 'Sáng: phiên 6' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Chuyển hôm nay' }));
    expect(
      within(morningSection).queryByRole('button', { name: 'Sáng: phiên 6' }),
    ).not.toBeInTheDocument();
    expect(
      within(morningSection).getByRole('button', { name: 'Sáng: phiên 2' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(morningSection).getByRole('button', { name: 'Sáng: phiên 3' }),
    ).toHaveAttribute('aria-pressed', 'false');

    unmount();

    const savedLog: DayLog = {
      date: TODAY,
      pomodoroMinutes: 25,
      sessions: { morning: 6, afternoon: 0, evening: 0 },
      updatedAt: '2026-11-26T00:00:00.000Z',
    };
    render(<DailyLoggerHarness initialLog={savedLog} />);
    const remountedMorning = screen.getByRole('region', { name: 'Buổi Sáng' });
    expect(
      within(remountedMorning).getByRole('button', { name: 'Sáng: phiên 6' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(remountedMorning).queryByRole('button', { name: 'Sáng: phiên 7' }),
    ).not.toBeInTheDocument();
  });

  it('resets to 0 (0p) when clicking icon #1 while count is 1', () => {
    render(<DailyLoggerHarness />);

    const afternoonSection = screen.getByRole('region', {
      name: 'Buổi Chiều',
    });
    const firstIcon = within(afternoonSection).getByRole('button', {
      name: 'Chiều: phiên 1',
    });

    fireEvent.click(firstIcon);
    expect(firstIcon).toHaveAttribute('aria-pressed', 'true');
    expect(within(afternoonSection).getByText('25p')).toBeInTheDocument();

    fireEvent.click(firstIcon);
    expect(firstIcon).toHaveAttribute('aria-pressed', 'false');
    expect(within(afternoonSection).getByText('0p')).toBeInTheDocument();
    expect(screen.getByTestId('daily-total-time')).toHaveTextContent('0p');
  });

  it('updates day pomodoroMinutes on chip tap and pins default via icon-only pin button', () => {
    const onChangeDefault = vi.fn();
    render(<DailyLoggerHarness onChangeDefaultMinutes={onChangeDefault} />);

    const eveningSection = screen.getByRole('region', { name: 'Buổi Tối' });
    fireEvent.click(
      within(eveningSection).getByRole('button', { name: 'Tối: phiên 2' }),
    );
    expect(within(eveningSection).getByText('50p')).toBeInTheDocument();
    expect(screen.getByTestId('daily-total-time')).toHaveTextContent('50p');

    const chip45 = screen.getByRole('button', { name: '45p' });
    fireEvent.click(chip45);

    expect(chip45).toHaveAttribute('aria-pressed', 'true');
    expect(within(eveningSection).getByText('1g 30p')).toBeInTheDocument();
    expect(screen.getByTestId('daily-total-time')).toHaveTextContent('1g 30p');

    const pinButton = screen.getByRole('button', { name: 'Đặt làm mặc định' });
    expect(pinButton).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(pinButton);

    expect(onChangeDefault).toHaveBeenCalledWith(45);
    expect(pinButton).toHaveAttribute('aria-pressed', 'true');
  });
});
