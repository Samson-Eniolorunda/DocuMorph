import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover active:bg-accent-hover border border-transparent",
  secondary: "bg-surface text-fg border border-control hover:bg-raised active:bg-raised",
  ghost: "bg-transparent text-fg border border-transparent hover:bg-raised active:bg-raised",
  danger: "bg-surface text-danger border border-danger hover:bg-danger-tint active:bg-danger-tint",
};

export function buttonClass(variant: ButtonVariant = "secondary", size: "md" | "lg" = "md", extra?: string) {
  return cn(
    "transition-quick inline-flex shrink-0 select-none items-center justify-center gap-2 rounded-md px-4 text-body font-medium",
    "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
    size === "lg" ? "min-h-12" : "min-h-11",
    VARIANT[variant],
    extra,
  );
}

interface Common {
  variant?: ButtonVariant;
  size?: "md" | "lg";
  className?: string;
  children: React.ReactNode;
}

type ButtonProps = Common & {
  busy?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

/** The one button. 44 px high (48 px for the main action in a bar), 16 px label. */
export function Button({
  variant,
  size,
  className,
  busy = false,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy && <Loader2 className="size-5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/** A link that looks like a button. */
export function ButtonLink({
  variant,
  size,
  className,
  children,
  ...rest
}: Common & React.ComponentProps<typeof Link>) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

/** A square button with an icon and a required accessible name; the hit area is 44 px. */
export function IconButton({
  label,
  variant = "ghost",
  className,
  children,
  type = "button",
  ...rest
}: { label: string; variant?: ButtonVariant; className?: string; children: React.ReactNode } & Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "children" | "aria-label"
>) {
  return (
    <button
      type={type}
      aria-label={label}
      className={buttonClass(variant, "md", cn("size-11 min-h-11 px-0", className))}
      {...rest}
    >
      {children}
    </button>
  );
}
