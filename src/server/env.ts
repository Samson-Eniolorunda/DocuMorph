import { z } from "zod";

const positiveInt = (fallback: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === undefined || v === "" ? fallback : Number(v)))
    .pipe(z.number().int().min(0).max(100_000));

const schema = z.object({
  CONVERTAPI_SECRET: z.string().trim().min(1).optional(),
  CONVERT_DAILY_PER_VISITOR: positiveInt(10).pipe(z.number().min(1)),
  CONVERT_DAILY_SITE_CAP: positiveInt(0),
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof schema>;

export type EnvResult = { ok: true; env: ServerEnv } | { ok: false; problems: string[] };

/** Reads and checks the server settings. A mistyped limit is an error, never a silently disabled limit. */
export function loadEnv(source: Record<string, string | undefined> = process.env): EnvResult {
  const parsed = schema.safeParse({
    CONVERTAPI_SECRET: source.CONVERTAPI_SECRET || undefined,
    CONVERT_DAILY_PER_VISITOR: source.CONVERT_DAILY_PER_VISITOR,
    CONVERT_DAILY_SITE_CAP: source.CONVERT_DAILY_SITE_CAP,
    UPSTASH_REDIS_REST_URL: source.UPSTASH_REDIS_REST_URL || undefined,
    UPSTASH_REDIS_REST_TOKEN: source.UPSTASH_REDIS_REST_TOKEN || undefined,
  });
  if (parsed.success) return { ok: true, env: parsed.data };
  return { ok: false, problems: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
}
