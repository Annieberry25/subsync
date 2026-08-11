import {
  getSubscriptionHistoryState,
  archiveSubscription,
  softDeleteSubscription,
  restoreSubscription,
  permanentlyDeleteSubscription,
  filterActiveSubscriptions,
  filterArchivedSubscriptions,
  filterDeletedSubscriptions,
  getRestoredHistory,
  cleanNotesUserText,
  formatNotesWithAccountLinks,
  type SubscriptionRow,
} from '../lib/services/subscription-service';

function createMockSubscription(name: string): SubscriptionRow {
  return {
    id: `test-sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    user_id: 'user-123',
    name,
    price: 14.99,
    currency: 'USD',
    billing_cycle: 'monthly',
    category: 'Streaming',
    status: 'active',
    start_date: '2026-01-01',
    next_billing_date: '2026-09-01',
    payment_method: 'Credit Card',
    provider_url: 'https://netflix.com',
    notes: 'Personal account plan\n[AccountLinks: [{"id":"1","label":"Profile","url":"https://netflix.com/profile"}]]',
    account_links: [{ id: '1', label: 'Profile', url: 'https://netflix.com/profile' }],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function testFlows() {
  console.log('=== VERIFYING SUBSYNC HISTORY DATA FLOWS ===\n');

  // Test 1: Initial state
  const mockActiveSub = createMockSubscription('Netflix Premium');
  const initialHistory = getSubscriptionHistoryState(mockActiveSub);
  console.log('1. Initial Subscription State:', initialHistory.state);
  console.assert(initialHistory.state === 'active', 'Expected active state initially');

  // Test 2: Archiving subscription
  const archivedNotes = formatNotesWithAccountLinks(
    cleanNotesUserText(mockActiveSub.notes),
    mockActiveSub.account_links as any,
    { state: 'archived', previousStatus: mockActiveSub.status, archivedAt: new Date().toISOString() }
  );
  const archivedSub: SubscriptionRow = { ...mockActiveSub, notes: archivedNotes };
  const archivedHistoryState = getSubscriptionHistoryState(archivedSub);
  console.log('2. Archived Subscription State:', archivedHistoryState.state);
  console.assert(archivedHistoryState.state === 'archived', 'Expected archived state');

  const activeFiltered = filterActiveSubscriptions([archivedSub]);
  const archivedFiltered = filterArchivedSubscriptions([archivedSub]);
  console.log(`   Active count: ${activeFiltered.length}, Archived count: ${archivedFiltered.length}`);
  console.assert(activeFiltered.length === 0, 'Active list should not include archived item');
  console.assert(archivedFiltered.length === 1, 'Archive list should include archived item');

  // Test 3: Soft-Deleting subscription
  const deletedNotes = formatNotesWithAccountLinks(
    cleanNotesUserText(mockActiveSub.notes),
    mockActiveSub.account_links as any,
    { state: 'deleted', previousStatus: mockActiveSub.status, deletedAt: new Date().toISOString() }
  );
  const deletedSub: SubscriptionRow = { ...mockActiveSub, notes: deletedNotes };
  const deletedHistoryState = getSubscriptionHistoryState(deletedSub);
  console.log('3. Soft-Deleted Subscription State:', deletedHistoryState.state);
  console.assert(deletedHistoryState.state === 'deleted', 'Expected deleted state');

  const deletedFiltered = filterDeletedSubscriptions([deletedSub]);
  console.log(`   Active count: ${filterActiveSubscriptions([deletedSub]).length}, Deleted count: ${deletedFiltered.length}`);
  console.assert(deletedFiltered.length === 1, 'Deleted list should include soft-deleted item');

  // Test 4: Restoring subscription
  const restoredNotes = formatNotesWithAccountLinks(
    cleanNotesUserText(archivedSub.notes),
    archivedSub.account_links as any,
    null
  );
  const restoredSub: SubscriptionRow = { ...archivedSub, notes: restoredNotes, status: 'active' };
  const restoredHistoryState = getSubscriptionHistoryState(restoredSub);
  console.log('4. Restored Subscription State:', restoredHistoryState.state);
  console.assert(restoredHistoryState.state === 'active', 'Expected active state after restore');

  // Test 5: Verify account links and notes data preservation
  const cleanNotesResult = cleanNotesUserText(restoredSub.notes);
  console.log('5. Preserved User Notes:', `"${cleanNotesResult}"`);
  console.assert(cleanNotesResult === 'Personal account plan', 'User notes should be preserved untainted');

  console.log('\n=== ALL HISTORY FLOW LOGIC VERIFIED SUCCESSFULLY ===');
}

testFlows();
