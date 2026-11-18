import { z } from "zod";
import { SERVER_TOOLS } from "@/config/server-tools";

const slugs = SERVER_TOOLS.map((t) => t.slug) as [string, ...string[]];

/** The text fields of a conversion request. The file itself is checked by its first bytes. */
export const convertFields = z.object({ tool: z.enum(slugs) });
