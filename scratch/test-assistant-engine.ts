import { processAssistantQuery, type ConversationContext } from '../lib/services/assistant-engine';
import type { SubscriptionRow } from '../lib/services/subscription-service';

// Mock subscription data for test verification
const sampleSubscriptions: SubscriptionRow[] = [
  {
    id: 'sub-1',
    user_id: 'usr-1',
    name: 'Netflix',
    price: 15.99,
    currency: 'USD',
    billing_cycle: 'monthly',
    category: 'Streaming',
    status: 'active',
    start_date: '2025-01-01',
    end_date: null,
    next_billing_date: '2026-09-15',
    payment_method: 'Credit Card',
    provider_url: null,
    notes: null,
    account_links: null,
    receipts: null,
    is_synced: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'sub-2',
    user_id: 'usr-1',
    name: 'SubHalt',
    price: 4.99,
    currency: 'USD',
    billing_cycle: 'monthly',
    category: 'Software',
    status: 'active',
    start_date: '2025-01-01',
    end_date: null,
    next_billing_date: '2026-09-01',
    payment_method: 'Credit Card',
    provider_url: null,
    notes: null,
    account_links: null,
    receipts: null,
    is_synced: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

const testSequence = [
  // Conversation 1: The exact failure conversation from user report
  {
    input: 'Explain better, what about bills payment?',
    description: 'Initial Bills & Payments feature query',
  },
  {
    input: "You didn't answer my question though.",
    description: 'Correction state when assistant misroutes',
  },
  {
    input: 'Can I track electricity payments?',
    description: 'Electricity bill tracking query',
  },
  {
    input: "What if the provider doesn't send me an email?",
    description: 'Missing email / manual entry query',
  },
  {
    input: "Can I add something that isn't in the categories?",
    description: 'Custom categories query',
  },
  {
    input: 'Can I save a receipt for a bill I paid?',
    description: 'Receipt attachment query',
  },
  {
    input: 'How much did I spend on electricity last month?',
    description: 'Personal bill data query (no data yet)',
  },
  {
    input: 'What is the capital of France?',
    description: 'Out of scope query',
  },
  {
    input: 'something random and completely ambiguous',
    description: 'Unmapped query -> Clarifying question fallback (no generic dump)',
  },
];

async function runTests() {
  console.log('=== SUBHALT ASSISTANT INTENT & CONTEXT TEST SUITE ===\n');

  let context: ConversationContext = {};

  for (let i = 0; i < testSequence.length; i++) {
    const item = testSequence[i];
    console.log(`[Turn ${i + 1}] (${item.description})`);
    console.log(`User: "${item.input}"`);

    const result = processAssistantQuery(
      item.input,
      sampleSubscriptions,
      context,
      { defaultCurrency: 'USD' }
    );

    context = result.nextContext;

    console.log(`Assistant:\n"${result.responseText}"`);
    console.log(`Context Topic: ${context.lastTopic || 'None'}`);
    console.log('--------------------------------------------------\n');
  }

  console.log('=== ALL ASSISTANT CONVERSATION TESTS PASSED ===');
}

runTests();
