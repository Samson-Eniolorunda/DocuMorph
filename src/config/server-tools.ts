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
  /** Gotenberg (LibreOffice) converts Office files to PDF; Adobe PDF Services exports a PDF to Office. */
  engine: "gotenberg" | "adobe";
  outExt: "pdf" | "docx" | "xlsx";
}

export const SERVER_TOOLS: ServerTool[] = [
  {
    slug: "word-to-pdf",
    name: "Word to PDF",
    summary: "Turn a Word document (.docx or .doc) into a PDF with its layout kept.",
    accept: ["docx", "doc"],
    kinds: ["zip-office", "ole-office"],
    engine: "gotenberg",
    outExt: "pdf",
  },
  {
    slug: "pdf-to-word",
    name: "PDF to Word",
    summary: "Turn a PDF into an editable Word document.",
    accept: ["pdf"],
    kinds: ["pdf"],
    engine: "adobe",
    outExt: "docx",
  },
  {
    slug: "excel-to-pdf",
    name: "Excel to PDF",
    summary: "Turn a spreadsheet (.xlsx or .xls) into a PDF.",
    accept: ["xlsx", "xls"],
    kinds: ["zip-office", "ole-office"],
    engine: "gotenberg",
    outExt: "pdf",
  },
  {
    slug: "pdf-to-excel",
    name: "PDF to Excel",
    summary: "Pull the tables in a PDF into an Excel spreadsheet.",
    accept: ["pdf"],
    kinds: ["pdf"],
    engine: "adobe",
    outExt: "xlsx",
  },
];

export const serverToolBySlug = (slug: string) => SERVER_TOOLS.find((t) => t.slug === slug);
