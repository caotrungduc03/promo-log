import { useState, type FormEvent } from 'react';
import { Check, RotateCcw, SlidersHorizontal } from 'lucide-react';

export interface PomodoroDurationPickerProps {
  minutes: number;
  defaultMinutes: number;
  onChangeDayMinutes: (minutes: number) => void;
  onChangeDefaultMinutes?: (minutes: number) => void;
}

const PRESET_MINUTES = [25, 30, 45, 50] as const;
const MIN_MINUTES = 1;
const MAX_MINUTES = 240;

function clampMinutes(value: number): number {
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(value)));
}

export function PomodoroDurationPicker({
  minutes,
  defaultMinutes,
  onChangeDayMinutes,
}: PomodoroDurationPickerProps) {
  const isCustomActive = !PRESET_MINUTES.includes(
    minutes as (typeof PRESET_MINUTES)[number],
  );
  const isDefault = minutes === defaultMinutes;
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [draftMinutes, setDraftMinutes] = useState(String(minutes));

  const handleOpenCustom = () => {
    setDraftMinutes(String(minutes));
    setShowCustomInput((prev) => !prev);
  };

  const handleSelectPreset = (preset: number) => {
    setShowCustomInput(false);
    setDraftMinutes(String(preset));
    onChangeDayMinutes(preset);
  };

  const handleResetToDefault = () => {
    setShowCustomInput(false);
    setDraftMinutes(String(defaultMinutes));
    onChangeDayMinutes(defaultMinutes);
  };

  const handleApplyCustom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = Number(draftMinutes);
    if (!Number.isFinite(parsed) || parsed < MIN_MINUTES) {
      return;
    }
    const next = clampMinutes(parsed);
    setDraftMinutes(String(next));
    onChangeDayMinutes(next);
    setShowCustomInput(false);
  };

  const handleStepCustom = (delta: number) => {
    const base = Number(draftMinutes);
    const current = Number.isFinite(base) && base >= MIN_MINUTES ? base : minutes;
    const next = clampMinutes(current + delta);
    setDraftMinutes(String(next));
    onChangeDayMinutes(next);
  };

  return (
    <section
      aria-label="Pomodoro session length"
      className="rounded-3xl bg-white p-3 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)]"
    >
      <div className="flex flex-nowrap items-center gap-1.5">
        {PRESET_MINUTES.map((preset) => {
          const isSelected = minutes === preset;
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={isSelected}
              onClick={() => handleSelectPreset(preset)}
              className={`min-h-10 min-w-10 shrink-0 rounded-2xl px-2.5 text-sm font-semibold tabular-nums transition-all active:scale-95 ${
                isSelected
                  ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/25'
                  : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
              }`}
            >
              {preset}m
            </button>
          );
        })}

        <button
          type="button"
          aria-expanded={showCustomInput}
          aria-pressed={isCustomActive}
          aria-label="Custom duration"
          title="Custom duration"
          onClick={handleOpenCustom}
          className={`inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center gap-1 rounded-2xl px-2.5 text-sm font-semibold tabular-nums transition-all active:scale-95 ${
            isCustomActive
              ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/25'
              : showCustomInput
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {isCustomActive && <span>{minutes}m</span>}
        </button>

        <button
          type="button"
          disabled={isDefault}
          aria-label="Reset to default"
          title={`Reset to default (${defaultMinutes}m)`}
          onClick={handleResetToDefault}
          className={`ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-all ${
            isDefault
              ? 'cursor-default bg-slate-100/70 text-slate-300'
              : 'bg-amber-50 text-amber-600 hover:bg-amber-100 active:scale-95'
          }`}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {showCustomInput && (
        <form
          onSubmit={handleApplyCustom}
          className="mt-2.5 flex items-center gap-2 rounded-2xl bg-slate-50 p-2.5"
        >
          <button
            type="button"
            onClick={() => handleStepCustom(-5)}
            aria-label="Decrease by 5 minutes"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-semibold text-slate-700 shadow-xs hover:bg-emerald-50 hover:text-emerald-700 active:scale-95"
          >
            -5
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_MINUTES}
            max={MAX_MINUTES}
            value={draftMinutes}
            onChange={(event) => setDraftMinutes(event.target.value)}
            aria-label="Minutes per session"
            className="h-10 w-20 rounded-xl bg-white px-2.5 text-center text-sm font-semibold text-slate-900 shadow-xs"
          />
          <button
            type="button"
            onClick={() => handleStepCustom(5)}
            aria-label="Increase by 5 minutes"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-semibold text-slate-700 shadow-xs hover:bg-emerald-50 hover:text-emerald-700 active:scale-95"
          >
            +5
          </button>
          <button
            type="submit"
            aria-label="Apply"
            title="Apply"
            className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm shadow-emerald-500/25 transition-colors hover:bg-emerald-600 active:scale-95"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      )}
    </section>
  );
}
