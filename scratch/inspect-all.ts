import { createClient } from '@supabase/supabase-js';

const url = 'https://jmqsefdevgznqkheifjp.supabase.co';
const key = 'sb_publishable_Rl_Ii-iKy4im2NJl6tEI0Q_7RDWAtyt';

const supabase = createClient(url, key);

async function inspect() {
  console.log('--- INSPECTING SUPABASE DATABASE ---');
  
  // Try querying without auth (will return rows if RLS is off or public read is allowed)
  const { data: publicSubs, error: pubErr } = await supabase.from('subscriptions').select('*');
  console.log('Public fetch subscriptions count:', publicSubs?.length, 'Error:', pubErr?.message);
  if (publicSubs && publicSubs.length > 0) {
    console.log('Sample row:', JSON.stringify(publicSubs[0], null, 2));
  }

  // Try RPC or REST endpoint to list users or inspect tables
  const res = await fetch(`${url}/rest/v1/subscriptions?select=*`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`
    }
  });
  const json = await res.json();
  console.log('REST API raw response status:', res.status, 'Body count:', Array.isArray(json) ? json.length : json);
  if (Array.isArray(json) && json.length > 0) {
    console.log('Raw subscriptions stored in DB:');
    json.forEach((sub: any) => {
      console.log(`- ID: ${sub.id} | Name: "${sub.name}" | provider_url: "${sub.provider_url}" | account_links: ${JSON.stringify(sub.account_links)} | notes: ${JSON.stringify(sub.notes)}`);
    });
  }
}

inspect().catch(console.error);
