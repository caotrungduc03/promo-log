import type { ChangeEvent } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDateVi, shiftDateKey } from '../utils/time';

export interface DateNavigatorProps {
  selectedDate: string;
  todayDate: string;
  onSelectDate: (date: string) => void;
}

export function DateNavigator({
  selectedDate,
  todayDate,
  onSelectDate,
}: DateNavigatorProps) {
  const isToday = selectedDate === todayDate;
  const displayLabel = formatDateVi(selectedDate, todayDate);

  const handlePrevDay = () => {
    onSelectDate(shiftDateKey(selectedDate, -1));
  };

  const handleNextDay = () => {
    onSelectDate(shiftDateKey(selectedDate, 1));
  };

  const handleDateInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextDate = event.target.value;
    if (nextDate) {
      onSelectDate(nextDate);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-stone-200/90 bg-white p-1.5 shadow-xs">
        <button
          type="button"
          onClick={handlePrevDay}
          aria-label="Ngày trước"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 active:scale-95"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="relative flex min-h-11 flex-1 items-center justify-center rounded-xl px-3 transition-colors hover:bg-stone-50">
          <div className="pointer-events-none flex items-center gap-2 text-stone-900">
            <Calendar
              className="h-4 w-4 shrink-0 text-amber-600"
              aria-hidden="true"
            />
            <span className="text-base font-semibold tracking-tight">
              {displayLabel}
            </span>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateInputChange}
            aria-label="Chọn ngày"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>

        <button
          type="button"
          onClick={handleNextDay}
          aria-label="Ngày sau"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 active:scale-95"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {!isToday && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => onSelectDate(todayDate)}
            className="inline-flex min-h-9 items-center rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 active:scale-95"
          >
            Hôm nay
          </button>
        </div>
      )}
    </div>
  );
}
