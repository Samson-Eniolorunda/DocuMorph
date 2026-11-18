import { z } from "zod";

export const FEEDBACK_MAX = 2000;

/** A feedback message. The e-mail address is optional and only used to reply. */
export const feedbackSchema = z.object({
  message: z
    .string()
    .trim()
    .min(5, "Please write a little more.")
    .max(FEEDBACK_MAX, "Please keep it under 2,000 characters."),
  email: z
    .string()
    .trim()
    .max(254)
    .optional()
    .transform((v) => v || undefined)
    .pipe(z.email("That e-mail address does not look right.").optional()),
  /** The page the form was opened from: a path on this site, never an address elsewhere. */
  page: z
    .string()
    .max(100)
    .regex(/^\/[A-Za-z0-9\-_/]*$/)
    .optional()
    .catch(undefined),
  /** A field people never see. Only software fills it in. */
  website: z.string().max(0).optional(),
});

export type Feedback = z.infer<typeof feedbackSchema>;
