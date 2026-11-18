"use client";

import { useRef } from "react";
import { Field } from "./Field";
import { Button } from "./Button";

/**
 * A page-range field. The iPhone number pad has no comma or hyphen, so the text keyboard is used
 * and the two keys people need most are offered above it.
 */
export function RangesField({
  label,
  value,
  onChange,
  error,
  hint,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  hint?: string | undefined;
  placeholder?: string | undefined;
}) {
  const input = useRef<HTMLDivElement>(null);
  const add = (text: string) => {
    onChange(`${value}${text}`);
    input.current?.querySelector("input")?.focus();
  };
  return (
    <div ref={input}>
      <Field
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={error}
        hint={hint}
        placeholder={placeholder}
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
      />
      <div className="mt-2 flex gap-2">
        <Button variant="secondary" aria-label="Add a hyphen for a range" onClick={() => add("-")}>
          –
        </Button>
        <Button variant="secondary" aria-label="Add a comma between ranges" onClick={() => add(", ")}>
          ,
        </Button>
      </div>
    </div>
  );
}
