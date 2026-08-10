import { createClient } from '@supabase/supabase-js';

const url = 'https://jmqsefdevgznqkheifjp.supabase.co';
const key = 'sb_publishable_Rl_Ii-iKy4im2NJl6tEI0Q_7RDWAtyt';

const supabase = createClient(url, key);

async function checkAuth() {
  console.log('--- TESTING COMMON TEST ACCOUNTS ---');
  const commonEmails = [
    'test@example.com',
    'user@example.com',
    'demo@subsync.com',
    'admin@subsync.com',
    'user@subsync.com'
  ];

  for (const email of commonEmails) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: 'password123'
    });
    if (!error && data.user) {
      console.log(`Successfully logged in as ${email} (User ID: ${data.user.id})`);
      const { data: subs, error: subErr } = await supabase.from('subscriptions').select('*');
      console.log(`Fetched ${subs?.length || 0} subscriptions for ${email}:`, JSON.stringify(subs, null, 2));
      return;
    }
  }

  console.log('No common test account matched. Trying signup or checking existing auth users...');
}

checkAuth().catch(console.error);
