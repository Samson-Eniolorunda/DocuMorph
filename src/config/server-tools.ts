// The only conversions that leave the device. Shared by the page and the
// server route, so the server accepts exactly what the page offers.

import type { FileKind } from "@/lib/files";

export interface ServerTool {
  slug: string;
  name: string;
  summary: string;
  /** File extensions people can pick. */
  accept: string[];
  /** Signatures the server accepts for this tool. */
  kinds: FileKind[];
  /** ConvertAPI route for an input extension. */
  route: (ext: string) => string;
  outExt: string;
  /** Optional choice shown on the page and checked on the server. */
  option?: { name: string; label: string; values: { value: string; label: string }[]; default: string };
}

export const SERVER_TOOLS: ServerTool[] = [
  {
    slug: "word-to-pdf",
    name: "Word to PDF",
    summary: "Turn a Word document (.docx or .doc) into a PDF with its layout kept.",
    accept: ["docx", "doc"],
    kinds: ["zip-office", "ole-office"],
    route: (ext) => (ext === "doc" ? "doc/to/pdf" : "docx/to/pdf"),
    outExt: "pdf",
  },
  {
    slug: "pdf-to-word",
    name: "PDF to Word",
    summary: "Turn a PDF into an editable Word document.",
    accept: ["pdf"],
    kinds: ["pdf"],
    route: () => "pdf/to/docx",
    outExt: "docx",
  },
  {
    slug: "excel-to-pdf",
    name: "Excel to PDF",
    summary: "Turn a spreadsheet (.xlsx or .xls) into a PDF.",
    accept: ["xlsx", "xls"],
    kinds: ["zip-office", "ole-office"],
    route: (ext) => (ext === "xls" ? "xls/to/pdf" : "xlsx/to/pdf"),
    outExt: "pdf",
  },
  {
    slug: "pdf-to-excel",
    name: "PDF to Excel",
    summary: "Pull the tables in a PDF into an Excel spreadsheet.",
    accept: ["pdf"],
    kinds: ["pdf"],
    route: () => "pdf/to/xlsx",
    outExt: "xlsx",
  },
  {
    slug: "compress-pdf",
    name: "Compress PDF",
    summary: "Make a PDF smaller by optimising its images and structure.",
    accept: ["pdf"],
    kinds: ["pdf"],
    route: () => "pdf/to/compress",
    outExt: "pdf",
    option: {
      name: "Preset",
      label: "Quality",
      default: "ebook",
      values: [
        { value: "screen", label: "Smallest file (screen)" },
        { value: "ebook", label: "Balanced (recommended)" },
        { value: "printer", label: "High quality (print)" },
      ],
    },
  },
];

export const serverToolBySlug = (slug: string) => SERVER_TOOLS.find((t) => t.slug === slug);
