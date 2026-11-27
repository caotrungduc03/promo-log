import { useEffect, useRef, useState } from 'react';
import { Flame, MoonStar, Plus, Sun, Sunrise } from 'lucide-react';
import type { SessionKey } from '../types';
import { formatMinutes } from '../utils/time';

export interface SessionRowProps {
  sessionKey: SessionKey;
  label: string;
  items: number[];
  pomodoroMinutes: number;
  resetKey: string;
  onChange: (nextItems: number[]) => void;
}

const DEFAULT_SLOTS = 4;

interface SessionTheme {
  icon: typeof Sunrise;
  badgeBg: string;
  badgeText: string;
  activeButton: string;
  totalText: string;
}

const SESSION_THEMES: Record<SessionKey, SessionTheme> = {
  morning: {
    icon: Sunrise,
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-600',
    activeButton:
      'bg-amber-400 text-white shadow-md shadow-amber-400/30 hover:bg-amber-500',
    totalText: 'text-amber-600',
  },
  afternoon: {
    icon: Sun,
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-600',
    activeButton:
      'bg-sky-400 text-white shadow-md shadow-sky-400/30 hover:bg-sky-500',
    totalText: 'text-sky-600',
  },
  evening: {
    icon: MoonStar,
    badgeBg: 'bg-violet-100',
    badgeText: 'text-violet-600',
    activeButton:
      'bg-violet-500 text-white shadow-md shadow-violet-500/30 hover:bg-violet-600',
    totalText: 'text-violet-600',
  },
};

export function SessionRow({
  sessionKey,
  label,
  items,
  pomodoroMinutes,
  resetKey,
  onChange,
}: SessionRowProps) {
  const safeCount = items.length;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  const [slotCount, setSlotCount] = useState(() =>
    Math.max(DEFAULT_SLOTS, safeCount),
  );

  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setSlotCount(Math.max(DEFAULT_SLOTS, safeCount));
  }

  const visibleCount = Math.max(DEFAULT_SLOTS, safeCount, slotCount);
  const totalMinutes = items.reduce(
    (sum, minutes) => sum + Math.max(0, minutes),
    0,
  );
  const theme = SESSION_THEMES[sessionKey];
  const SessionIcon = theme.icon;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (event: WheelEvent) => {
      if (
        el.scrollWidth > el.clientWidth &&
        Math.abs(event.deltaY) > Math.abs(event.deltaX)
      ) {
        event.preventDefault();
        el.scrollLeft += event.deltaY;
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const handleTapIcon = (indexOneBased: number) => {
    if (indexOneBased > items.length) {
      const countToAdd = indexOneBased - items.length;
      const unit = Math.min(240, Math.max(1, Math.round(pomodoroMinutes)));
      onChange([...items, ...Array.from({ length: countToAdd }, () => unit)]);
      return;
    }

    if (indexOneBased === items.length) {
      onChange(items.slice(0, -1));
      return;
    }

    onChange(items.slice(0, indexOneBased));
  };

  const handleAddSlot = () => {
    setSlotCount((prev) => Math.max(prev, DEFAULT_SLOTS, safeCount) + 1);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo?.({
        left: scrollRef.current.scrollWidth,
        behavior: 'smooth',
      });
    });
  };

  return (
    <section
      aria-label={`${label} session`}
      className="min-w-0 rounded-3xl bg-white p-4 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)]"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-2xl ${theme.badgeBg} ${theme.badgeText}`}
          >
            <SessionIcon className="h-4 w-4" aria-hidden="true" />
          </span>
          <h3 className="text-base font-semibold text-slate-900">{label}</h3>
          {safeCount > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 tabular-nums">
              {safeCount}
            </span>
          )}
        </div>

        <span
          data-testid={`session-total-${sessionKey}`}
          className={`text-sm font-bold tabular-nums ${
            totalMinutes > 0 ? theme.totalText : 'text-slate-400'
          }`}
        >
          {formatMinutes(totalMinutes)}
        </span>
      </div>

      <div
        ref={scrollRef}
        data-testid={`session-scroll-${sessionKey}`}
        className="thin-scrollbar flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto pb-2"
      >
        {Array.from({ length: visibleCount }, (_, idx) => {
          const indexOneBased = idx + 1;
          const isActive = indexOneBased <= safeCount;
          const loggedMinutes = isActive ? items[idx] : undefined;

          return (
            <button
              key={indexOneBased}
              type="button"
              aria-pressed={isActive}
              aria-label={`${label}: session ${indexOneBased}`}
              title={
                loggedMinutes !== undefined ? `${loggedMinutes}m` : undefined
              }
              onClick={() => handleTapIcon(indexOneBased)}
              className={`flex h-14 w-13 min-h-14 min-w-13 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl transition-all active:scale-95 ${
                isActive
                  ? theme.activeButton
                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200/70 hover:text-slate-600'
              }`}
            >
              <span className="flex items-center gap-0.5">
                <Flame
                  className="h-3.5 w-3.5"
                  fill={isActive ? 'currentColor' : 'none'}
                  strokeWidth={isActive ? 2 : 1.75}
                  aria-hidden="true"
                />
                <span className="text-[11px] leading-none font-bold tabular-nums">
                  {indexOneBased}
                </span>
              </span>
              {loggedMinutes !== undefined && (
                <span className="text-[10px] leading-none font-semibold opacity-90 tabular-nums">
                  {loggedMinutes}m
                </span>
              )}
            </button>
          );
        })}

        <button
          type="button"
          aria-label={`${label}: add session`}
          onClick={handleAddSlot}
          className="flex h-14 w-13 min-h-14 min-w-13 shrink-0 items-center justify-center rounded-2xl bg-slate-100/80 text-slate-500 transition-all hover:bg-emerald-50 hover:text-emerald-600 active:scale-95"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
