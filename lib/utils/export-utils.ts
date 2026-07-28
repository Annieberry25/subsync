import type { SubscriptionRow } from '@/lib/services/subscription-service';

export function exportToCSV(subscriptions: SubscriptionRow[]) {
  if (!subscriptions || subscriptions.length === 0) return;

  const headers = [
    'ID',
    'Name',
    'Price',
    'Currency',
    'Billing Cycle',
    'Category',
    'Status',
    'Next Billing Date',
    'Payment Method',
    'Provider URL',
    'Notes',
    'Created At',
  ];

  const rows = subscriptions.map((sub) => [
    `"${sub.id}"`,
    `"${sub.name.replace(/"/g, '""')}"`,
    sub.price,
    `"${sub.currency}"`,
    `"${sub.billing_cycle}"`,
    `"${sub.category}"`,
    `"${sub.status}"`,
    `"${sub.next_billing_date}"`,
    `"${(sub.payment_method || '').replace(/"/g, '""')}"`,
    `"${(sub.provider_url || '').replace(/"/g, '""')}"`,
    `"${(sub.notes || '').replace(/"/g, '""')}"`,
    `"${sub.created_at}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `subsync-subscriptions-${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToJSON(subscriptions: SubscriptionRow[]) {
  if (!subscriptions || subscriptions.length === 0) return;

  const jsonContent = JSON.stringify(subscriptions, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `subsync-subscriptions-backup-${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
