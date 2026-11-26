import { useState } from 'react';
import { CloudSun, Moon, Plus, Sun, Timer } from 'lucide-react';
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
  icon: typeof Sun;
  badgeBg: string;
  badgeText: string;
  activeButton: string;
  totalText: string;
}

const SESSION_THEMES: Record<SessionKey, SessionTheme> = {
  morning: {
    icon: Sun,
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-600',
    activeButton:
      'bg-amber-400 text-white shadow-md shadow-amber-400/30 hover:bg-amber-500',
    totalText: 'text-amber-600',
  },
  afternoon: {
    icon: CloudSun,
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-600',
    activeButton:
      'bg-sky-400 text-white shadow-md shadow-sky-400/30 hover:bg-sky-500',
    totalText: 'text-sky-600',
  },
  evening: {
    icon: Moon,
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

  const handleTapIcon = (indexOneBased: number) => {
    if (indexOneBased === 1 && safeCount === 1) {
      onChangeCount(0);
      return;
    }
    onChangeCount(indexOneBased);
  };

  const handleAddSlot = () => {
    setSlotCount((prev) => Math.max(prev, MIN_VISIBLE_ICONS, safeCount) + 1);
  };

  return (
    <section
      aria-label={`Buổi ${label}`}
      className="rounded-3xl bg-white p-4 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)]"
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

      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: visibleCount }, (_, idx) => {
          const indexOneBased = idx + 1;
          const isActive = indexOneBased <= safeCount;
          return (
            <button
              key={indexOneBased}
              type="button"
              aria-pressed={isActive}
              aria-label={`${label}: phiên ${indexOneBased}`}
              onClick={() => handleTapIcon(indexOneBased)}
              className={`flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-2xl transition-all active:scale-95 ${
                isActive
                  ? theme.activeButton
                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200/70 hover:text-slate-600'
              }`}
            >
              <Timer
                className="h-5 w-5"
                strokeWidth={isActive ? 2.25 : 1.75}
                aria-hidden="true"
              />
            </button>
          );
        })}

        <button
          type="button"
          aria-label={`${label}: thêm phiên`}
          onClick={handleAddSlot}
          className="flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-2xl bg-slate-100/80 text-slate-500 transition-all hover:bg-emerald-50 hover:text-emerald-600 active:scale-95"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
