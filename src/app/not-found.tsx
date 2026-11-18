import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="text-display font-semibold">That page does not exist</h1>
      <p className="mt-2 max-w-[68ch] text-muted">The address may be mistyped, or the page may have moved.</p>
      <ButtonLink href="/" variant="primary" className="mt-6">
        See all tools
      </ButtonLink>
    </div>
  );
}
