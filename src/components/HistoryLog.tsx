import { useRef, useState, type PointerEvent } from 'react';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  MoonStar,
  Sun,
  Sunrise,
  Trash2,
  X,
} from 'lucide-react';
import type { DayLog } from '../types';
import {
  formatDateLabel,
  formatMinutes,
  getDayTotalMinutes,
  getSessionMinutes,
} from '../utils/time';

export interface HistoryLogProps {
  logs: Record<string, DayLog>;
  selectedDate: string;
  todayDate: string;
  onSelectDate: (date: string) => void;
  onDeleteLog?: (date: string) => void;
}

const PAGE_SIZE = 5;
const REVEAL_OFFSET = -76;
const SNAP_THRESHOLD = -36;

interface SwipeableHistoryItemProps {
  log: DayLog;
  todayDate: string;
  isSelected: boolean;
  isOpen: boolean;
  isConfirmingDelete: boolean;
  canDelete: boolean;
  onSelectDate: (date: string) => void;
  onOpenSwipe: (date: string) => void;
  onCloseSwipe: () => void;
  onRequestDelete: (date: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (date: string) => void;
}

function SwipeableHistoryItem({
  log,
  todayDate,
  isSelected,
  isOpen,
  isConfirmingDelete,
  canDelete,
  onSelectDate,
  onOpenSwipe,
  onCloseSwipe,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: SwipeableHistoryItemProps) {
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const pointerState = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    baseOffset: number;
    didDrag: boolean;
  }>({
    pointerId: null,
    startX: 0,
    startY: 0,
    baseOffset: 0,
    didDrag: false,
  });

  const dateLabel = formatDateLabel(log.date, todayDate);
  const totalMinutes = getDayTotalMinutes(log);
  const morningMinutes = getSessionMinutes(log, 'morning');
  const afternoonMinutes = getSessionMinutes(log, 'afternoon');
  const eveningMinutes = getSessionMinutes(log, 'evening');

  if (isConfirmingDelete) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-2xl bg-rose-50 px-3.5 py-3">
        <span className="text-sm font-semibold text-rose-900">
          Delete {dateLabel}?
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Cancel delete"
            onClick={onCancelDelete}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-600 transition-colors hover:bg-slate-100 active:scale-95"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Confirm delete"
            onClick={() => onConfirmDelete(log.date)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500 text-white shadow-sm shadow-rose-500/25 transition-colors hover:bg-rose-600 active:scale-95"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  const translateX = dragOffset ?? (isOpen ? REVEAL_OFFSET : 0);
  const showDeleteAction = isOpen || (dragOffset !== null && dragOffset < 0);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!canDelete) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    pointerState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseOffset: isOpen ? REVEAL_OFFSET : 0,
      didDrag: false,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!canDelete) return;
    const state = pointerState.current;
    if (state.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;

    if (!state.didDrag) {
      if (Math.abs(deltaX) < 6 || Math.abs(deltaY) > Math.abs(deltaX)) {
        return;
      }
      state.didDrag = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }

    const nextOffset = Math.max(
      REVEAL_OFFSET - 8,
      Math.min(0, state.baseOffset + deltaX),
    );
    setDragOffset(nextOffset);
  };

  const finishDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const state = pointerState.current;
    if (state.pointerId !== event.pointerId) return;

    const finalOffset =
      dragOffset ?? (isOpen ? REVEAL_OFFSET : 0);
    const wasDragging = state.didDrag;
    state.pointerId = null;
    setDragOffset(null);

    if (wasDragging) {
      if (finalOffset <= SNAP_THRESHOLD) {
        onOpenSwipe(log.date);
      } else {
        onCloseSwipe();
      }
    }
  };

  const handleClick = () => {
    if (pointerState.current.didDrag) {
      pointerState.current.didDrag = false;
      return;
    }
    if (isOpen) {
      onCloseSwipe();
      return;
    }
    onSelectDate(log.date);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {canDelete && (
        <div
          className={`absolute inset-y-0 right-0 flex w-[76px] items-stretch transition-opacity duration-150 ${
            showDeleteAction
              ? 'opacity-100'
              : 'pointer-events-none opacity-0'
          }`}
        >
          <button
            type="button"
            aria-label={`Delete log for ${dateLabel}`}
            onClick={() => onRequestDelete(log.date)}
            className="flex w-full items-center justify-center bg-rose-500 text-white transition-colors hover:bg-rose-600 active:bg-rose-700"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onClick={handleClick}
        aria-current={isSelected ? 'date' : undefined}
        style={{ transform: `translateX(${translateX}px)` }}
        className={`relative z-10 flex w-full touch-pan-y flex-col gap-2 rounded-2xl p-3 text-left select-none ${
          dragOffset === null ? 'transition-transform duration-200 ease-out' : ''
        } ${
          isSelected
            ? 'bg-emerald-50 text-emerald-900'
            : 'bg-slate-50 text-slate-800 hover:bg-emerald-50/70'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-semibold">{dateLabel}</span>
          <span
            className={`text-base font-bold tabular-nums ${
              isSelected ? 'text-emerald-700' : 'text-slate-900'
            }`}
          >
            {formatMinutes(totalMinutes)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold tabular-nums">
          <span
            aria-label={`Morning ${formatMinutes(morningMinutes)}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50/90 px-2.5 py-1 text-amber-700"
          >
            <Sunrise
              className="h-4 w-4 text-amber-500"
              aria-hidden="true"
            />
            {formatMinutes(morningMinutes)}
          </span>
          <span
            aria-label={`Afternoon ${formatMinutes(afternoonMinutes)}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-50/90 px-2.5 py-1 text-sky-700"
          >
            <Sun className="h-4 w-4 text-sky-500" aria-hidden="true" />
            {formatMinutes(afternoonMinutes)}
          </span>
          <span
            aria-label={`Evening ${formatMinutes(eveningMinutes)}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-50/90 px-2.5 py-1 text-violet-700"
          >
            <MoonStar
              className="h-4 w-4 text-violet-500"
              aria-hidden="true"
            />
            {formatMinutes(eveningMinutes)}
          </span>
        </div>
      </button>
    </div>
  );
}

export function HistoryLog({
  logs,
  selectedDate,
  todayDate,
  onSelectDate,
  onDeleteLog,
}: HistoryLogProps) {
  const [page, setPage] = useState(1);
  const [swipedDate, setSwipedDate] = useState<string | null>(null);
  const [confirmDeleteDate, setConfirmDeleteDate] = useState<string | null>(
    null,
  );

  const entries = Object.values(logs)
    .filter(
      (log) => getDayTotalMinutes(log) > 0 || log.date === selectedDate,
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pagedEntries = entries.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const handleConfirmDelete = (date: string) => {
    setConfirmDeleteDate(null);
    setSwipedDate(null);
    onDeleteLog?.(date);
  };

  return (
    <section
      aria-label="Study log"
      className="rounded-3xl bg-white p-4 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)]"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500"
            aria-hidden="true"
          >
            <CalendarDays className="h-4 w-4" />
          </span>
          <h2 className="text-base font-semibold text-slate-900">Study Log</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 tabular-nums">
          {entries.length}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
          No study sessions yet
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {pagedEntries.map((log) => (
              <li key={log.date}>
                <SwipeableHistoryItem
                  log={log}
                  todayDate={todayDate}
                  isSelected={log.date === selectedDate}
                  isOpen={swipedDate === log.date}
                  isConfirmingDelete={confirmDeleteDate === log.date}
                  canDelete={Boolean(onDeleteLog)}
                  onSelectDate={onSelectDate}
                  onOpenSwipe={(date) => {
                    setConfirmDeleteDate(null);
                    setSwipedDate(date);
                  }}
                  onCloseSwipe={() => setSwipedDate(null)}
                  onRequestDelete={(date) => setConfirmDeleteDate(date)}
                  onCancelDelete={() => {
                    setConfirmDeleteDate(null);
                    setSwipedDate(null);
                  }}
                  onConfirmDelete={handleConfirmDelete}
                />
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                aria-label="Previous page"
                disabled={safePage <= 1}
                onClick={() => {
                  setSwipedDate(null);
                  setConfirmDeleteDate(null);
                  setPage(Math.max(1, safePage - 1));
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-emerald-50 hover:text-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-100 disabled:hover:text-slate-600"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>

              <span className="text-xs font-semibold text-slate-500 tabular-nums">
                {safePage} / {totalPages}
              </span>

              <button
                type="button"
                aria-label="Next page"
                disabled={safePage >= totalPages}
                onClick={() => {
                  setSwipedDate(null);
                  setConfirmDeleteDate(null);
                  setPage(Math.min(totalPages, safePage + 1));
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-emerald-50 hover:text-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-100 disabled:hover:text-slate-600"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
