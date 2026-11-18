"use client";

import { Button, ButtonLink } from "@/components/ui/Button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="text-display font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-[68ch] text-muted">
        The page could not be shown. Your files were not uploaded. Try again, or go back to the tools.
      </p>
      <div className="mt-6 flex justify-end gap-3 sm:justify-start">
        <ButtonLink href="/" variant="secondary">
          See all tools
        </ButtonLink>
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
