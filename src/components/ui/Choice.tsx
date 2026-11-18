import { useId } from "react";
import { cn } from "@/lib/cn";

interface Option<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
}

/** A group of radio buttons as full-width rows, each at least 44 px tall. */
export function RadioGroup<T extends string | number>({
  legend,
  value,
  onChange,
  options,
  className,
}: {
  legend: string;
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  className?: string;
}) {
  const name = useId();
  return (
    <fieldset className={className}>
      <legend className="mb-1.5 text-body font-medium">{legend}</legend>
      <div className="overflow-hidden rounded-lg border border-control bg-surface">
        {options.map((o) => (
          <label
            key={String(o.value)}
            className="transition-quick flex min-h-12 cursor-pointer items-start gap-3 border-b border-line px-3 py-3 last:border-b-0 has-[:checked]:bg-accent-tint has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-accent"
          >
            <input
              type="radio"
              name={name}
              checked={o.value === value}
              onChange={() => onChange(o.value)}
              className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-body">{o.label}</span>
              {o.hint && <span className="block text-body-sm text-subtle">{o.hint}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A tick box as a full-width row at least 44 px tall. */
export function Checkbox({
  label,
  hint,
  checked,
  onChange,
  className,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "transition-quick flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border border-control bg-surface px-3 py-3 has-[:checked]:bg-accent-tint has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
        className,
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
      />
      <span>
        <span className="block text-body">{label}</span>
        {hint && <span className="block text-body-sm text-subtle">{hint}</span>}
      </span>
    </label>
  );
}
