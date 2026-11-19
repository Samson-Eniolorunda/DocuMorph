import { useId } from "react";
import { Minus, Plus } from "lucide-react";
import { IconButton } from "./Button";

/** A slider with − and + buttons, so it can be set exactly with a thumb. The value is shown in mono. */
export function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = "",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) {
  const id = useId();
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label htmlFor={id} className="text-body font-medium">
          {label}
        </label>
        <output htmlFor={id} className="tabular-nums text-[15px] font-medium">
          {value}
          {unit}
        </output>
      </div>
      <div className="flex items-center gap-2">
        <IconButton
          label={`Decrease ${label.toLowerCase()}`}
          variant="secondary"
          onClick={() => set(value - step)}
          disabled={value <= min}
        >
          <Minus className="size-5" />
        </IconButton>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => set(Number(e.target.value))}
          className="h-11 min-w-0 flex-1 accent-[var(--accent)]"
        />
        <IconButton
          label={`Increase ${label.toLowerCase()}`}
          variant="secondary"
          onClick={() => set(value + step)}
          disabled={value >= max}
        >
          <Plus className="size-5" />
        </IconButton>
      </div>
    </div>
  );
}

/** A whole-number − / + stepper with a numeric keypad field between the buttons. */
export function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  hint?: string;
}) {
  const id = useId();
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v) || min)));
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-body font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <IconButton
          label={`Decrease ${label.toLowerCase()}`}
          variant="secondary"
          onClick={() => set(value - 1)}
          disabled={value <= min}
        >
          <Minus className="size-5" />
        </IconButton>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          enterKeyHint="done"
          value={value}
          onChange={(e) => set(Number(e.target.value.replace(/\D/g, "")))}
          className="min-h-11 w-20 rounded-md border border-control bg-surface px-3 text-center tabular-nums text-body"
        />
        <IconButton
          label={`Increase ${label.toLowerCase()}`}
          variant="secondary"
          onClick={() => set(value + 1)}
          disabled={value >= max}
        >
          <Plus className="size-5" />
        </IconButton>
      </div>
      {hint && <p className="mt-1.5 text-body-sm text-subtle">{hint}</p>}
    </div>
  );
}
