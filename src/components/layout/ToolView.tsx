"use client";

import dynamic from "next/dynamic";
import { ServerConvert } from "@/features/server-convert/ServerConvert";
import { SERVER_TOOLS } from "@/config/server-tools";

// Each device tool is its own chunk, so a page downloads only the tool it shows.
const loading = () => <p className="text-muted">Loading…</p>;
const VIEWS: Record<string, React.ComponentType> = {
  "edit-pdf": dynamic(() => import("@/features/editor/PdfEditor").then((m) => m.PdfEditor), { loading }),
  "merge-pdf": dynamic(() => import("@/features/merge/MergePdf").then((m) => m.MergePdf), { loading }),
  "split-pdf": dynamic(() => import("@/features/split/SplitPdf").then((m) => m.SplitPdf), { loading }),
  "organise-pdf": dynamic(() => import("@/features/organise/OrganisePdf").then((m) => m.OrganisePdf), { loading }),
  "compress-pdf": dynamic(() => import("@/features/compress-pdf/CompressPdf").then((m) => m.CompressPdf), {
    loading,
  }),
  "images-to-pdf": dynamic(() => import("@/features/images-to-pdf/ImagesToPdf").then((m) => m.ImagesToPdf), {
    loading,
  }),
  "pdf-to-images": dynamic(() => import("@/features/pdf-to-images/PdfToImages").then((m) => m.PdfToImages), {
    loading,
  }),
  "convert-image": dynamic(() => import("@/features/image/ImageTool").then((m) => m.ConvertImage), { loading }),
  "resize-image": dynamic(() => import("@/features/image/ImageTool").then((m) => m.ResizeImage), {
    loading,
  }),
  "compress-image": dynamic(() => import("@/features/image/ImageTool").then((m) => m.CompressImage), { loading }),
};

export function ToolView({ slug }: { slug: string }) {
  if (SERVER_TOOLS.some((t) => t.slug === slug)) return <ServerConvert slug={slug} />;
  const View = VIEWS[slug];
  return View ? <View /> : null;
}
