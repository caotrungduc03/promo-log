import { useEffect, useRef, useState } from 'react';
import { Flame, MoonStar, Plus, Sun, Sunrise } from 'lucide-react';
import type { SessionKey } from '../types';
import { formatMinutes } from '../utils/time';

export interface SessionRowProps {
  sessionKey: SessionKey;
  label: string;
  count: number;
  pomodoroMinutes: number;
  resetKey: string;
  onChangeCount: (nextCount: number) => void;
}

const MIN_VISIBLE_ICONS = 5;

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
  count,
  pomodoroMinutes,
  resetKey,
  onChangeCount,
}: SessionRowProps) {
  const safeCount = Math.max(0, count);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  const [slotCount, setSlotCount] = useState(() =>
    Math.max(MIN_VISIBLE_ICONS, safeCount),
  );

  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setSlotCount(Math.max(MIN_VISIBLE_ICONS, safeCount));
  }

  const visibleCount = Math.max(MIN_VISIBLE_ICONS, safeCount, slotCount);
  const totalMinutes = safeCount * Math.max(0, pomodoroMinutes);
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
    if (indexOneBased === 1 && safeCount === 1) {
      onChangeCount(0);
      return;
    }
    onChangeCount(indexOneBased);
  };

  const handleAddSlot = () => {
    setSlotCount((prev) => Math.max(prev, MIN_VISIBLE_ICONS, safeCount) + 1);
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
        </div>

        <span
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
          return (
            <button
              key={indexOneBased}
              type="button"
              aria-pressed={isActive}
              aria-label={`${label}: session ${indexOneBased}`}
              onClick={() => handleTapIcon(indexOneBased)}
              className={`flex h-12 w-12 min-h-12 min-w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl transition-all active:scale-95 ${
                isActive
                  ? theme.activeButton
                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200/70 hover:text-slate-600'
              }`}
            >
              <Flame
                className="h-4 w-4"
                fill={isActive ? 'currentColor' : 'none'}
                strokeWidth={isActive ? 2 : 1.75}
                aria-hidden="true"
              />
              <span className="text-[11px] leading-none font-bold tabular-nums">
                {indexOneBased}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          aria-label={`${label}: add session`}
          onClick={handleAddSlot}
          className="flex h-12 w-12 min-h-12 min-w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100/80 text-slate-500 transition-all hover:bg-emerald-50 hover:text-emerald-600 active:scale-95"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
