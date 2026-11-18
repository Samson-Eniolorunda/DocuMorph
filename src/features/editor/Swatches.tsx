import { Check } from "lucide-react";

export const SWATCHES = ["#111111", "#1d2b64", "#0f766e", "#15803d", "#d92d20", "#ea580c", "#ffe14d", "#ffffff"];

/** Colour choices as 44 px swatches, with the system colour picker behind "More". */
export function Swatches({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (colour: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c === "#ffffff" ? "White" : `Colour ${c}`}
            aria-pressed={value.toLowerCase() === c}
            onClick={() => onChange(c)}
            className="flex size-11 items-center justify-center rounded-md border border-control"
            style={{ background: c }}
          >
            {value.toLowerCase() === c && (
              <Check
                className="size-5"
                style={{ color: c === "#ffffff" || c === "#ffe14d" ? "#111" : "#fff" }}
                aria-hidden
              />
            )}
          </button>
        ))}
        <label className="flex min-h-11 items-center gap-2 rounded-md border border-control bg-surface px-3">
          More
          <input
            type="color"
            aria-label={`${label}, other colour`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="size-6 cursor-pointer border-0 bg-transparent p-0"
          />
        </label>
      </div>
    </fieldset>
  );
}
