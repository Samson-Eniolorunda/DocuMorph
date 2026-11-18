import Link from "next/link";
import { GROUPS, TOOLS } from "@/config/tools";
import { TOOL_ICONS } from "@/config/tool-icons";
import { Badge } from "@/components/ui/Feedback";
import { cn } from "@/lib/cn";

/** The fourteen tools in their four groups: full-width rows, 56 px tall at least, the whole row a link. */
export function ToolList({
  current,
  onNavigate,
  columns = false,
}: {
  current?: string;
  onNavigate?: () => void;
  columns?: boolean;
}) {
  return (
    <div className="space-y-6">
      {GROUPS.map((group) => (
        <section key={group} aria-labelledby={`group-${group.replace(/\W/g, "")}`}>
          <h2
            id={`group-${group.replace(/\W/g, "")}`}
            className="mb-2 text-body-sm font-semibold uppercase tracking-wide text-subtle"
          >
            {group}
          </h2>
          <ul
            className={cn(
              "grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line",
              columns && "md:grid-cols-2 md:gap-3 md:overflow-visible md:border-0 md:bg-transparent lg:grid-cols-3",
            )}
          >
            {TOOLS.filter((t) => t.group === group).map((t) => {
              const Icon = TOOL_ICONS[t.slug];
              const here = t.slug === current;
              return (
                <li
                  key={t.slug}
                  className={cn(
                    "min-w-0 bg-surface",
                    columns && "md:overflow-hidden md:rounded-lg md:border md:border-line",
                  )}
                >
                  <Link
                    href={`/${t.slug}`}
                    {...(onNavigate ? { onClick: onNavigate } : {})}
                    aria-current={here ? "page" : undefined}
                    className={cn(
                      "transition-quick flex min-h-14 items-center gap-3 px-3 py-2.5 active:bg-raised hover:bg-raised",
                      here && "bg-accent-tint",
                    )}
                  >
                    {Icon && <Icon className="size-5 shrink-0 text-accent" aria-hidden />}
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{t.name}</span>
                      <span className="block truncate text-body-sm text-subtle md:whitespace-normal">{t.summary}</span>
                    </span>
                    {t.where === "server" && <Badge>Server</Badge>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
