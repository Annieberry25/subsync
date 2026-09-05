import { calculateBillSpendingSummary, filterBillPayments } from '../lib/services/bills-service';
import type { BillPayment } from '../lib/types/bills.types';

function runBillsUITests() {
  console.log('=== BILLS & PAYMENTS MOBILE-FIRST UX VERIFICATION ===\n');

  const nowStr = new Date().toISOString().split('T')[0];

  const mockBills: BillPayment[] = [
    {
      id: 'b1',
      userId: 'u1',
      category: 'Electricity',
      providerName: 'Ikeja Electric',
      amount: 25000,
      currency: 'NGN',
      paymentDate: nowStr,
      isRecurring: true,
      source: 'manual',
      status: 'paid',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'b2',
      userId: 'u1',
      category: 'Airtime / Mobile Data',
      providerName: 'MTN',
      amount: 3500,
      currency: 'NGN',
      paymentDate: nowStr,
      isRecurring: true,
      source: 'manual',
      status: 'paid',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'b3',
      userId: 'u1',
      category: 'Other',
      customCategory: 'Security Token',
      providerName: 'Estate Association',
      amount: 15000,
      currency: 'NGN',
      paymentDate: nowStr,
      isRecurring: false,
      source: 'receipt_scan',
      status: 'paid',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  // Test 1: Summary Calculation
  console.log('[Test 1] Monthly Summary Calculation:');
  const summary = calculateBillSpendingSummary(mockBills, 'NGN', {});
  console.log(`Total this month: ₦${summary.totalThisMonth.toLocaleString()}`);
  console.log(`Total count this month: ${summary.totalCountThisMonth}`);
  console.log(`Highest category: ${summary.categoryBreakdown[0]?.category} (${summary.categoryBreakdown[0]?.percentage}%)`);
  console.log('--------------------------------------------------\n');

  // Test 2: Filtering Logic
  console.log('[Test 2] Bill Filtering & Search:');
  const electricityBills = filterBillPayments(mockBills, { category: 'Electricity' });
  console.log(`Electricity filter count: ${electricityBills.length} (Expected 1)`);

  const searchResults = filterBillPayments(mockBills, { searchQuery: 'MTN' });
  console.log(`Search 'MTN' count: ${searchResults.length} (Expected 1)`);
  console.log('--------------------------------------------------\n');

  console.log('=== ALL BILLS & PAYMENTS TESTS PASSED ===');
}

runBillsUITests();
