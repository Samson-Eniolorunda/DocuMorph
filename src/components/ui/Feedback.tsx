import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/cn";

const TONE = {
  info: { box: "border-line bg-raised", icon: Info, colour: "text-muted" },
  success: { box: "border-accent bg-accent-tint", icon: CheckCircle2, colour: "text-accent" },
  warning: { box: "border-warn bg-raised", icon: AlertTriangle, colour: "text-warn" },
  error: { box: "border-danger bg-danger-tint", icon: AlertTriangle, colour: "text-danger" },
} as const;

/** An inline message: what happened and, where there is one, what to do. */
export function Notice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof TONE;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { box, icon: Icon, colour } = TONE[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-lg border p-3", box, className)}
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", colour)} aria-hidden />
      <div className="min-w-0 text-body">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "text-muted")}>{children}</div>}
      </div>
    </div>
  );
}

/** A progress bar: a real figure where there is one, otherwise an honest moving bar. */
export function ProgressBar({
  label,
  value,
  className,
}: {
  label: string;
  value?: number | undefined;
  className?: string;
}) {
  const determinate = typeof value === "number";
  return (
    <div className={className}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={determinate ? Math.round(value) : undefined}
        className="h-2 overflow-hidden rounded-sm bg-raised"
      >
        {determinate ? (
          <div
            className="progress-fill h-full bg-accent transition-[width] duration-200 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          />
        ) : (
          <div className="h-full w-2/5 bg-accent" style={{ animation: "slide-bar 1.2s var(--ease-out) infinite" }} />
        )}
      </div>
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "accent" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-caption font-medium",
        tone === "accent" ? "border-accent text-accent" : "border-control text-muted",
      )}
    >
      {children}
    </span>
  );
}
