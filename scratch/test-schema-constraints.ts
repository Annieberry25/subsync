import { createClient } from '@supabase/supabase-js';

const url = 'https://jmqsefdevgznqkheifjp.supabase.co';
const key = 'sb_publishable_Rl_Ii-iKy4im2NJl6tEI0Q_7RDWAtyt';

async function testSchemaConstraints() {
  const supabase = createClient(url, key);
  const email = `test_${Date.now()}@subsync.com`;
  const password = 'Password123!';

  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authErr || !authData.user) {
    console.error('Auth signup failed:', authErr);
    return;
  }

  console.log(`User created: ${authData.user.id}, Session: ${!!authData.session}`);
  
  let client = supabase;
  if (authData.session) {
    client = createClient(url, key, {
      global: {
        headers: {
          Authorization: `Bearer ${authData.session.access_token}`,
        },
      },
    });
  }

  // Insert a test subscription
  const { data: subData, error: insertErr } = await client
    .from('subscriptions')
    .insert({
      user_id: authData.user.id,
      name: 'Test Netflix',
      price: 15.99,
      currency: 'USD',
      billing_cycle: 'monthly',
      category: 'Streaming',
      status: 'active',
      next_billing_date: '2026-09-01',
    })
    .select()
    .single();

  if (insertErr) {
    console.error('Insert subscription failed:', insertErr);
    return;
  }

  console.log('Inserted subscription:', subData);

  // Test 1: Try updating status to 'archived'
  const { data: archiveData, error: archiveErr } = await client
    .from('subscriptions')
    .update({ status: 'archived' })
    .eq('id', subData.id)
    .select();

  console.log('Update status to "archived" result:', archiveData, 'Error:', archiveErr?.message);

  // Test 2: Try updating status to 'deleted'
  const { data: deleteData, error: deleteErr } = await client
    .from('subscriptions')
    .update({ status: 'deleted' })
    .eq('id', subData.id)
    .select();

  console.log('Update status to "deleted" result:', deleteData, 'Error:', deleteErr?.message);

  // Cleanup test row
  await client.from('subscriptions').delete().eq('id', subData.id);
  console.log('Cleaned up test subscription.');
}

testSchemaConstraints().catch(console.error);
