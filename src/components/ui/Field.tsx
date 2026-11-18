import { useId } from "react";
import { cn } from "@/lib/cn";

const CONTROL =
  "transition-quick block min-h-11 w-full rounded-md border border-control bg-surface px-3 text-body text-fg placeholder:text-subtle " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 aria-invalid:border-danger";

interface FieldShell {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  className?: string | undefined;
}

/** Wires a label, a hint and an error message to one control. */
function useFieldIds() {
  const id = useId();
  return { id, hintId: `${id}-hint`, errorId: `${id}-error` };
}

function Shell({
  label,
  hint,
  error,
  className,
  ids,
  children,
}: FieldShell & { ids: ReturnType<typeof useFieldIds>; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={ids.id} className="mb-1.5 block text-body font-medium">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={ids.hintId} className="mt-1.5 text-body-sm text-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={ids.errorId} role="alert" className="mt-1.5 text-body-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const describedBy = (ids: ReturnType<typeof useFieldIds>, hint?: string, error?: string) =>
  error ? ids.errorId : hint ? ids.hintId : undefined;

type InputProps = FieldShell & Omit<React.InputHTMLAttributes<HTMLInputElement>, "className" | "id">;

export function Field({ label, hint, error, className, ...rest }: InputProps) {
  const ids = useFieldIds();
  return (
    <Shell label={label} hint={hint} error={error} className={className} ids={ids}>
      <input
        id={ids.id}
        className={CONTROL}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(ids, hint, error)}
        {...rest}
      />
    </Shell>
  );
}

type TextAreaProps = FieldShell & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "className" | "id">;

export function TextArea({ label, hint, error, className, ...rest }: TextAreaProps) {
  const ids = useFieldIds();
  return (
    <Shell label={label} hint={hint} error={error} className={className} ids={ids}>
      <textarea
        id={ids.id}
        className={cn(CONTROL, "min-h-28 py-2")}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(ids, hint, error)}
        {...rest}
      />
    </Shell>
  );
}

type SelectProps = FieldShell & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "className" | "id">;

/** A native select, so the phone shows its own picker. */
export function Select({ label, hint, error, className, children, ...rest }: SelectProps) {
  const ids = useFieldIds();
  return (
    <Shell label={label} hint={hint} error={error} className={className} ids={ids}>
      <select
        id={ids.id}
        className={CONTROL}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(ids, hint, error)}
        {...rest}
      >
        {children}
      </select>
    </Shell>
  );
}
