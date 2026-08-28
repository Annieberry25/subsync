import { z } from 'zod';

function safeParseUrl(value: string | undefined): string {
  if (!value) return '';
  try {
    new URL(value);
    return value;
  } catch {
    return '';
  }
}

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_URL is required').refine((v) => safeParseUrl(v), {
    message: 'NEXT_PUBLIC_SUPABASE_URL must be a valid URL',
  }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required'),
  NEXT_PUBLIC_LOGO_DEV_TOKEN: z.string().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).optional(),
  GEMINI_WEB_SEARCH: z.string().optional(),
});

function loadEnv() {
  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_LOGO_DEV_TOKEN: process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GEMINI_WEB_SEARCH: process.env.GEMINI_WEB_SEARCH,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => i.message);
    console.error('[env] Invalid environment variables:', issues.join('; '));
    throw new Error(`Invalid environment variables: ${issues.join('; ')}`);
  }

  return parsed.data;
}

export const env = loadEnv();
