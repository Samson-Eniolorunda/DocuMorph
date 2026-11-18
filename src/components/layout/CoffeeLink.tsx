import { Coffee } from "lucide-react";
import { SITE } from "@/config/site";
import { cn } from "@/lib/cn";

/** A plain "Buy me a coffee" link. Nothing is drawn when no address is set. */
export function CoffeeLink({ className, inline = false }: { className?: string; inline?: boolean }) {
  if (!SITE.coffeeUrl) return null;
  return (
    <a
      href={SITE.coffeeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "gap-1.5 underline-offset-4 hover:underline",
        inline ? "inline-flex items-baseline underline" : "inline-flex min-h-11 items-center",
        className,
      )}
    >
      <Coffee className="size-4" aria-hidden /> Buy me a coffee
    </a>
  );
}
