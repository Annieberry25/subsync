import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  let supabaseOk = false;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.getSession();
    supabaseOk = !error;
  } catch (err) {
    logger.error('Health check: Supabase connectivity failed', err);
  }

  return NextResponse.json(
    { status: supabaseOk ? 'ok' : 'degraded', supabase: supabaseOk },
    { status: supabaseOk ? 200 : 503 }
  );
}
