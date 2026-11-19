import { z } from "zod";

const positiveInt = (fallback: number, max = 100_000) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === undefined || v === "" ? fallback : Number(v)))
    .pipe(z.number().int().min(0).max(max));

const text = z.string().trim().min(1).optional();

const schema = z.object({
  CONVERT_DAILY_PER_VISITOR: positiveInt(10).pipe(z.number().min(1)),
  CONVERT_DAILY_SITE_CAP: positiveInt(200).pipe(z.number().min(1)),
  // Every attempt that reaches a service, successful or not; never given back.
  CONVERT_DAILY_ATTEMPT_CAP: positiveInt(300).pipe(z.number().min(1)),
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: text,
  // Word and Excel to PDF: a self-hosted Gotenberg service (see infra/gotenberg).
  GOTENBERG_URL: z.url({ protocol: /^https$/ }).optional(),
  GOTENBERG_USERNAME: text,
  GOTENBERG_PASSWORD: text,
  // PDF to Word and PDF to Excel: Adobe PDF Services, free tier of 500 transactions a month.
  PDF_SERVICES_CLIENT_ID: text,
  PDF_SERVICES_CLIENT_SECRET: text,
  ADOBE_MONTHLY_CAP: positiveInt(450, 100_000).pipe(z.number().min(1)),
  ADOBE_DAILY_CAP: positiveInt(25, 100_000).pipe(z.number().min(1)),
  // Feedback goes to one address, the owner's, through Resend.
  RESEND_API_KEY: text,
  FEEDBACK_TO_EMAIL: z.email().optional(),
});

export type ServerEnv = z.infer<typeof schema>;

export type EnvResult = { ok: true; env: ServerEnv } | { ok: false; problems: string[] };

const KEYS = Object.keys(schema.shape) as (keyof ServerEnv)[];

/** Reads and checks the server settings. A mistyped limit is an error, never a silently disabled limit. */
export function loadEnv(source: Record<string, string | undefined> = process.env): EnvResult {
  const raw: Record<string, string | undefined> = {};
  for (const key of KEYS) raw[key] = source[key] || undefined;
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, env: parsed.data };
  return { ok: false, problems: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
}

export interface GotenbergConfig {
  url: string;
  username: string;
  password: string;
}
export interface AdobeConfig {
  clientId: string;
  clientSecret: string;
}

export const gotenbergConfig = (e: ServerEnv): GotenbergConfig | null =>
  e.GOTENBERG_URL && e.GOTENBERG_USERNAME && e.GOTENBERG_PASSWORD
    ? { url: e.GOTENBERG_URL.replace(/\/+$/, ""), username: e.GOTENBERG_USERNAME, password: e.GOTENBERG_PASSWORD }
    : null;

export const adobeConfig = (e: ServerEnv): AdobeConfig | null =>
  e.PDF_SERVICES_CLIENT_ID && e.PDF_SERVICES_CLIENT_SECRET
    ? { clientId: e.PDF_SERVICES_CLIENT_ID, clientSecret: e.PDF_SERVICES_CLIENT_SECRET }
    : null;
