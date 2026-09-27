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
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  NEXT_PUBLIC_LOGO_DEV_TOKEN: z.string().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().optional(),
  GROQ_API_KEY: z.string().min(1).optional(),
  GROQ_MODEL: z.string().min(1).optional(),
  GROQ_WEB_SEARCH: z.string().optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  INBOUND_EMAIL_DOMAIN: z.string().optional(),
  INBOUND_WEBHOOK_SECRET: z.string().optional(),
  MAILGUN_SIGNING_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  ENABLE_BACKGROUND_GMAIL_SCAN: z.string().optional(),
});

function loadEnv() {
  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_LOGO_DEV_TOKEN: process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_MODEL: process.env.GROQ_MODEL,
    GROQ_WEB_SEARCH: process.env.GROQ_WEB_SEARCH,
    PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
    NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
    INBOUND_EMAIL_DOMAIN: process.env.INBOUND_EMAIL_DOMAIN,
    INBOUND_WEBHOOK_SECRET: process.env.INBOUND_WEBHOOK_SECRET,
    MAILGUN_SIGNING_KEY: process.env.MAILGUN_SIGNING_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    ENABLE_BACKGROUND_GMAIL_SCAN: process.env.ENABLE_BACKGROUND_GMAIL_SCAN,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => i.message);
    console.error('[env] Invalid environment variables:', issues.join('; '));
    throw new Error(`Invalid environment variables: ${issues.join('; ')}`);
  }

  return parsed.data;
}

export const env = loadEnv();
