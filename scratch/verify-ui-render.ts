import {
  getKnownProviderWebsite,
  getKnownProviderManagementUrl,
  getProviderWebsite,
  getProviderManagementUrl,
} from '../lib/services/subscription-service';

console.log('=== VERIFYING FINAL URL MAPPING CORRECTION ===\n');

const amazonSub = {
  id: 'sub-amazon-1',
  name: 'Amazon Prime',
  provider_url: null,
};

// 1. Subscription Detail Card → Website (plain text generic provider homepage)
const detailCardWebsitePlainText = getProviderWebsite(amazonSub.name, amazonSub.provider_url);
const detailCardManagePlanUrl = getProviderManagementUrl(amazonSub.name, amazonSub.provider_url);

// 2. Edit Subscription → Provider Website (clickable subscription/account-page URL)
const knownManage = getKnownProviderManagementUrl(amazonSub.name);
const knownWebsite = getKnownProviderWebsite(amazonSub.name);

const normUrl = (u?: string | null) => u?.toLowerCase().trim().replace(/\/+$/, '') || '';
const currentUrlNorm = normUrl(amazonSub.provider_url);
const knownWebsiteNorm = normUrl(knownWebsite);
const knownManageNorm = normUrl(knownManage);

const isCustomUrl = Boolean(
  currentUrlNorm &&
  currentUrlNorm !== knownManageNorm &&
  currentUrlNorm !== knownWebsiteNorm
);
const editFormWebsiteInputValue = isCustomUrl ? amazonSub.provider_url! : (knownManage || knownWebsite || '');

console.log('FINAL UI MAPPING TRACE:');
console.log(`[Subscription Detail Card]`);
console.log(`  Website Field (Plain Text): "${detailCardWebsitePlainText}"`);
console.log(`  Manage Plan Button Action:  "${detailCardManagePlanUrl}"`);
console.log(`\n[Edit Subscription Form]`);
console.log(`  Provider Website Input (Value): "${editFormWebsiteInputValue}"`);

console.log('\n--- VERIFICATION CHECKS ---');
let errors = 0;

if (detailCardWebsitePlainText !== 'https://www.amazon.com') {
  console.error(`[FAIL] Detail Card Website should be plain text "https://www.amazon.com", got "${detailCardWebsitePlainText}"`);
  errors++;
} else {
  console.log(`[PASS] Detail Card Website displays generic homepage "https://www.amazon.com" as plain text`);
}

if (editFormWebsiteInputValue !== 'https://www.amazon.com/mc/manage') {
  console.error(`[FAIL] Edit Subscription Provider Website should be "https://www.amazon.com/mc/manage", got "${editFormWebsiteInputValue}"`);
  errors++;
} else {
  console.log(`[PASS] Edit Subscription Provider Website contains account/subscription link "https://www.amazon.com/mc/manage"`);
}

if (detailCardManagePlanUrl !== 'https://www.amazon.com/mc/manage') {
  console.error(`[FAIL] Manage Plan button URL altered! Got "${detailCardManagePlanUrl}"`);
  errors++;
} else {
  console.log(`[PASS] Manage Plan button remains untouched ("https://www.amazon.com/mc/manage")`);
}

if (errors === 0) {
  console.log('\n>>> ALL CHECKS PASSED SUCCESSFULLY! <<<');
} else {
  console.error(`\n>>> ${errors} CHECK(S) FAILED! <<<`);
  process.exit(1);
}
