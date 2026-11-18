import { TOOLS } from "@/config/tools";
import { ToolList } from "@/components/layout/ToolList";

export default function Home() {
  const device = TOOLS.filter((t) => t.where === "device").length;
  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6 sm:pt-10">
      <h1 className="text-display font-semibold tracking-[-0.01em] md:text-display-lg">
        Edit, sign and convert documents
      </h1>
      <p className="mt-2 max-w-[68ch] text-muted">
        {device} of {TOOLS.length} tools never upload your file. Pick one to start.
      </p>
      <div className="mt-6">
        <ToolList columns />
      </div>
      <p className="mt-6 max-w-[68ch] text-body-sm text-subtle">
        The five tools marked Server send your file to ConvertAPI, up to 4 MB, and DocuMorph does not keep it.
      </p>
    </div>
  );
}
