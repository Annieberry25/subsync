import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Please enter both your email and password.' },
        { status: 400 }
      );
    }

    // Sign in with a server-side client so the session is written to the
    // browser via Set-Cookie response headers, rather than a client-side
    // document.cookie write (which some embedded/restricted contexts drop).
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    if (!data.session || !data.user) {
      return NextResponse.json({ error: 'Sign-in did not return a session.' }, { status: 401 });
    }

    return NextResponse.json({ success: true, user: data.user });
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred while signing in.' },
      { status: 500 }
    );
  }
}