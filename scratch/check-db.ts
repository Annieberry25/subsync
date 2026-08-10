import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { getKnownProviderWebsite, getKnownProviderManagementUrl, getProviderWebsite, getProviderManagementUrl } from '../lib/services/subscription-service';

const envPath = path.join(process.cwd(), '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const envVars: Record<string, string> = {};
envFile.split('\n').forEach((line) => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    envVars[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('--- QUERYING SUPABASE DIRECTLY WITH .env.local ---');
  const { data, error } = await supabase.from('subscriptions').select('*');
  if (error) {
    console.error('Error fetching subscriptions:', error);
    return;
  }
  console.log(`Found ${data?.length || 0} subscriptions in Supabase:\n`);
  data?.forEach((sub) => {
    console.log(`Subscription: "${sub.name}" (ID: ${sub.id})`);
    console.log(`  stored provider_url: "${sub.provider_url}"`);
    console.log(`  getProviderWebsite: "${getProviderWebsite(sub.name, sub.provider_url)}"`);
    console.log(`  getProviderManagementUrl: "${getProviderManagementUrl(sub.name, sub.provider_url)}"`);
    console.log(`  getKnownProviderWebsite: "${getKnownProviderWebsite(sub.name)}"`);
    console.log(`  getKnownProviderManagementUrl: "${getKnownProviderManagementUrl(sub.name)}"`);
    console.log('---');
  });
}

main().catch(console.error);
