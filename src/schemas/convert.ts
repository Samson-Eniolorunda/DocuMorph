import { z } from "zod";
import { SERVER_TOOLS } from "@/config/server-tools";

const slugs = SERVER_TOOLS.map((t) => t.slug) as [string, ...string[]];

/** The text fields of a conversion request. The file itself is checked by its first bytes. */
export const convertFields = z.object({
  tool: z.enum(slugs),
  option: z.string().max(32).optional(),
});

export const fileId = z.string().regex(/^[A-Za-z0-9_-]{8,128}$/);
export const resultToken = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);

export const resultQuery = z.object({ fileId, token: resultToken });
