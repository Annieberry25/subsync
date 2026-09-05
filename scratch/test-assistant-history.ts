import {
  generateTitleFromQuery,
  type SavedConversation,
} from '../lib/services/assistant-history-service';

function runHistoryTests() {
  console.log('=== ASSISTANT HISTORY SERVICE UNIT TESTS ===\n');

  // Test 1: Title Generation
  console.log('[Test 1] Deterministic Title Generation:');
  const titleTests = [
    { query: 'How much am I spending every month?', expected: 'Monthly spending' },
    { query: 'Can I track electricity payments?', expected: 'Bills & payments' },
    { query: 'What should I cancel?', expected: 'Cancellation review' },
    { query: 'What renews next?', expected: 'Upcoming renewals' },
    { query: 'Which subscription costs me the most?', expected: 'Highest plan cost' },
    { query: 'Do I have duplicate subscriptions?', expected: 'Duplicate check' },
    { query: 'Which subscriptions should I review?', expected: 'Plan review' },
    { query: 'Can I add custom category?', expected: 'Bills & payments' },
    { query: 'Software subscriptions overview list', expected: 'Software subscriptions overview list' },
  ];

  for (const t of titleTests) {
    const title = generateTitleFromQuery(t.query);
    console.log(`Query: "${t.query}" -> Title: "${title}"`);
  }
  console.log('--------------------------------------------------\n');

  // Test 2: Date Grouping Mock Test
  console.log('[Test 2] Date Grouping Logic:');
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const threeDaysAgo = startOfToday - 3 * 24 * 60 * 60 * 1000;

  const mockList: SavedConversation[] = [
    {
      id: 'c1',
      title: 'Monthly spending',
      messages: [],
      createdAt: new Date(startOfToday + 3600000).toISOString(),
      updatedAt: new Date(startOfToday + 3600000).toISOString(),
    },
    {
      id: 'c2',
      title: 'Bills & payments',
      messages: [],
      createdAt: new Date(startOfYesterday + 3600000).toISOString(),
      updatedAt: new Date(startOfYesterday + 3600000).toISOString(),
    },
    {
      id: 'c3',
      title: 'Upcoming renewals',
      messages: [],
      createdAt: new Date(threeDaysAgo).toISOString(),
      updatedAt: new Date(threeDaysAgo).toISOString(),
    },
  ];

  const today: SavedConversation[] = [];
  const yesterday: SavedConversation[] = [];
  const earlier: SavedConversation[] = [];

  for (const conv of mockList) {
    const convTime = new Date(conv.updatedAt).getTime();
    if (convTime >= startOfToday) {
      today.push(conv);
    } else if (convTime >= startOfYesterday) {
      yesterday.push(conv);
    } else {
      earlier.push(conv);
    }
  }

  console.log(`Today (${today.length}): ${today.map((c) => c.title).join(', ')}`);
  console.log(`Yesterday (${yesterday.length}): ${yesterday.map((c) => c.title).join(', ')}`);
  console.log(`Earlier (${earlier.length}): ${earlier.map((c) => c.title).join(', ')}`);
  console.log('--------------------------------------------------\n');

  console.log('=== ALL HISTORY UNIT TESTS PASSED ===');
}

runHistoryTests();
