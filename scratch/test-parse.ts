import { parseAccountLinks } from '../lib/services/subscription-service';

const mockNetFlixSub = {
  id: 'sub-1',
  user_id: 'user-1',
  name: 'Netflix',
  price: 15.99,
  currency: 'USD',
  billing_cycle: 'monthly',
  category: 'Streaming',
  status: 'active',
  next_billing_date: '2026-09-01',
  payment_method: 'Card',
  provider_url: 'https://netflix.com',
  notes: null,
  account_links: [
    { id: 'l1', label: 'Personal', url: 'https://netflix.com/youraccount' },
    { id: 'l2', label: 'Family', url: 'https://netflix.com/family' }
  ],
  created_at: '2026-01-01',
  updated_at: '2026-01-01'
};

const mockAmazonSub = {
  id: 'sub-2',
  user_id: 'user-1',
  name: 'Amazon Prime',
  price: 14.99,
  currency: 'USD',
  billing_cycle: 'monthly',
  category: 'Shopping',
  status: 'active',
  next_billing_date: '2026-09-01',
  payment_method: 'Card',
  provider_url: 'https://amazon.com',
  notes: '[AccountLinks: [{"id":"l3","label":"Personal","url":"https://amazon.com/mc/manage"}]]',
  account_links: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01'
};

console.log('Netflix parsed account links:', parseAccountLinks(mockNetFlixSub as any));
console.log('Amazon parsed account links:', parseAccountLinks(mockAmazonSub as any));
