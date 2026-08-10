import {
  getKnownProviderWebsite,
  getKnownProviderManagementUrl,
  getKnownProviderAccountUrl,
  getProviderWebsite,
  getProviderManagementUrl,
  getProviderAccountUrl,
  parseAccountLinks,
  cleanNotesUserText,
  formatNotesWithAccountLinks
} from '../lib/services/subscription-service';

console.log('--- TESTING REVERSED URL MAPPINGS FOR AMAZON PRIME ---');

const amazonSub = { name: 'Amazon Prime', provider_url: null };
const detailCardVisitOfficialSite = getProviderManagementUrl(amazonSub.name, amazonSub.provider_url);
const editFormWebsiteField = getKnownProviderWebsite(amazonSub.name) || getKnownProviderManagementUrl(amazonSub.name);
const managePlanButtonUrl = getProviderManagementUrl(amazonSub.name, amazonSub.provider_url);

console.log(`Amazon Prime Verification:`);
console.log(`  Detail Card "Visit Official Site" Link: ${detailCardVisitOfficialSite}`);
console.log(`  Edit Subscription Website Field:        ${editFormWebsiteField}`);
console.log(`  Manage Plan Button URL:                 ${managePlanButtonUrl}`);

let failed = 0;
if (detailCardVisitOfficialSite !== 'https://www.amazon.com/mc/manage') {
  console.error('  [FAIL] Detail Card Visit Official Site should be https://www.amazon.com/mc/manage');
  failed++;
}
if (editFormWebsiteField !== 'https://www.amazon.com') {
  console.error('  [FAIL] Edit Subscription Website Field should be https://www.amazon.com');
  failed++;
}
if (managePlanButtonUrl !== 'https://www.amazon.com/mc/manage') {
  console.error('  [FAIL] Manage Plan Button URL should remain https://www.amazon.com/mc/manage');
  failed++;
}

console.log('\n--- TESTING ACCOUNT LINKS & FALLBACKS ---');
const dummySub = {
  id: 'sub-1',
  user_id: 'user-1',
  name: 'Netflix',
  price: 15.99,
  currency: 'USD',
  billing_cycle: 'monthly' as const,
  category: 'Streaming' as const,
  status: 'active' as const,
  start_date: null,
  next_billing_date: '2026-09-01',
  payment_method: null,
  provider_url: 'https://www.netflix.com',
  notes: 'Personal plan [AccountLinks: [{"id":"1","label":"Family Account","url":"https://netflix.com/family"}]]',
  account_links: [{ id: '1', label: 'Family Account', url: 'https://netflix.com/family' }],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const links = parseAccountLinks(dummySub);
console.log('Parsed account links:', links);
if (links.length !== 1 || links[0].url !== 'https://netflix.com/family') {
  console.error('  [FAIL] Account link parsing failed');
  failed++;
}

const cleanedNotes = cleanNotesUserText(dummySub.notes);
console.log('Cleaned notes:', cleanedNotes);
if (cleanedNotes !== 'Personal plan') {
  console.error('  [FAIL] Notes cleaning failed');
  failed++;
}

console.log('\n--- TESTING ACCOUNT URL DESTINATIONS ---');
console.log(`Amazon Account Destination: ${getKnownProviderAccountUrl('Amazon Prime')}`);
console.log(`Netflix Account Destination: ${getKnownProviderAccountUrl('Netflix')}`);
console.log(`Spotify Account Destination: ${getKnownProviderAccountUrl('Spotify')}`);
console.log(`GitHub Account Destination: ${getKnownProviderAccountUrl('GitHub Pro')}`);
console.log(`ChatGPT Account Destination: ${getKnownProviderAccountUrl('ChatGPT')}`);

if (getKnownProviderAccountUrl('Amazon Prime') !== 'https://www.amazon.com/youraccount') {
  console.error('  [FAIL] Amazon Prime account URL should be https://www.amazon.com/youraccount');
  failed++;
}
if (getKnownProviderAccountUrl('Netflix') !== 'https://www.netflix.com/youraccount') {
  console.error('  [FAIL] Netflix account URL should be https://www.netflix.com/youraccount');
  failed++;
}
if (getKnownProviderAccountUrl('Spotify') !== 'https://www.spotify.com/account/overview/') {
  console.error('  [FAIL] Spotify account URL should be https://www.spotify.com/account/overview/');
  failed++;
}
if (getKnownProviderAccountUrl('GitHub Pro') !== 'https://github.com/settings/profile') {
  console.error('  [FAIL] GitHub Pro account URL should be https://github.com/settings/profile');
  failed++;
}
if (getKnownProviderAccountUrl('ChatGPT') !== 'https://chatgpt.com/#settings/Account') {
  console.error('  [FAIL] ChatGPT account URL should be https://chatgpt.com/#settings/Account');
  failed++;
}

// Test custom URL override vs provider fallback
const customUrlRes = getProviderAccountUrl('Amazon Prime', 'https://custom-amazon-link.com/profile');
if (customUrlRes !== 'https://custom-amazon-link.com/profile') {
  console.error('  [FAIL] Custom URL override failed');
  failed++;
}

const fallbackUrlRes = getProviderAccountUrl('Amazon Prime', '');
if (fallbackUrlRes !== 'https://www.amazon.com/youraccount') {
  console.error('  [FAIL] Fallback URL failed for Amazon Prime');
  failed++;
}

if (failed === 0) {
  console.log('\n>>> ALL TESTS PASSED SUCCESSFULLY! <<<');
} else {
  console.error(`\n>>> ${failed} TEST(S) FAILED! <<<`);
  process.exit(1);
}
