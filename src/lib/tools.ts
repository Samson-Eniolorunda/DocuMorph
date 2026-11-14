// Every tool, for the home page, the menu and page titles.

import { SERVER_TOOLS } from "./server-tools";

export type Where = "device" | "server";
export type Group = "Edit and organise" | "Convert" | "Images" | "Office and compression";

export interface ToolInfo {
  slug: string;
  name: string;
  summary: string;
  group: Group;
  where: Where;
}

export const TOOLS: ToolInfo[] = [
  { slug: "edit-pdf", name: "Edit PDF", summary: "Add text, cover and retype, sign, highlight, add images and fill forms.", group: "Edit and organise", where: "device" },
  { slug: "merge-pdf", name: "Merge PDF", summary: "Combine several PDFs into one, in the order you choose.", group: "Edit and organise", where: "device" },
  { slug: "split-pdf", name: "Split PDF", summary: "Take out page ranges, or split every few pages into separate files.", group: "Edit and organise", where: "device" },
  { slug: "organise-pdf", name: "Organise pages", summary: "Reorder, rotate and delete pages, with a preview of each one.", group: "Edit and organise", where: "device" },
  { slug: "images-to-pdf", name: "Images to PDF", summary: "Turn JPG, PNG or WebP images into a single PDF.", group: "Convert", where: "device" },
  { slug: "pdf-to-images", name: "PDF to images", summary: "Save each page as a PNG or JPG at the resolution you need.", group: "Convert", where: "device" },
  { slug: "convert-image", name: "Convert image", summary: "Change images between JPG, PNG and WebP.", group: "Images", where: "device" },
  { slug: "resize-image", name: "Resize image", summary: "Set an exact width and height, or scale by a percentage.", group: "Images", where: "device" },
  { slug: "compress-image", name: "Compress image", summary: "Shrink images by quality or to a target file size.", group: "Images", where: "device" },
  ...SERVER_TOOLS.map((t) => ({ slug: t.slug, name: t.name, summary: t.summary, group: "Office and compression" as const, where: "server" as const })),
];

export const GROUPS: Group[] = ["Edit and organise", "Convert", "Images", "Office and compression"];

export const toolBySlug = (slug: string) => TOOLS.find((t) => t.slug === slug)!;

export const SITE = {
  name: "DocuMorph",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://documorph-blue.vercel.app",
  tagline: "Private PDF and image tools that run in your browser.",
  author: { name: "Samson Eniolorunda", url: "https://samsoneniolorunda.vercel.app" },
  repo: "https://github.com/Samson-Eniolorunda/DocuMorph",
};
