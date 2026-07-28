import type { SubscriptionInsert } from '@/lib/services/subscription-service';

export interface ImportResult {
  parsedItems: Omit<SubscriptionInsert, 'user_id'>[];
  errors: string[];
}

type AllowedStatus = 'active' | 'paused' | 'canceled' | 'trial';
type AllowedBillingCycle = 'monthly' | 'yearly' | 'weekly' | 'quarterly' | 'custom';
type AllowedCategory = 'Streaming' | 'Software' | 'Utilities' | 'Fitness' | 'Finance' | 'Education' | 'Gaming' | 'Other';

const CATEGORIES: AllowedCategory[] = ['Streaming', 'Software', 'Utilities', 'Fitness', 'Finance', 'Education', 'Gaming', 'Other'];

function normalizeStatus(rawStatus?: string): AllowedStatus {
  if (!rawStatus) return 'active';
  const s = rawStatus.toLowerCase().trim();
  if (s === 'cancelled' || s === 'canceled') return 'canceled';
  if (s === 'paused') return 'paused';
  if (s === 'trial') return 'trial';
  return 'active';
}

function normalizeBillingCycle(rawCycle?: string): AllowedBillingCycle {
  if (!rawCycle) return 'monthly';
  const c = rawCycle.toLowerCase().trim();
  if (c === 'yearly' || c === 'annual' || c === 'annually') return 'yearly';
  if (c === 'weekly' || c === 'week') return 'weekly';
  if (c === 'quarterly') return 'quarterly';
  if (c === 'custom') return 'custom';
  return 'monthly';
}

function normalizeCategory(rawCategory?: string): AllowedCategory {
  if (!rawCategory) return 'Other';
  const trimmed = rawCategory.trim();
  const match = CATEGORIES.find((c) => c.toLowerCase() === trimmed.toLowerCase());
  return match || 'Other';
}

export function parseJSONSubscriptions(jsonText: string): ImportResult {
  const errors: string[] = [];
  const parsedItems: Omit<SubscriptionInsert, 'user_id'>[] = [];

  try {
    const rawData = JSON.parse(jsonText);
    if (!Array.isArray(rawData)) {
      return { parsedItems: [], errors: ['Invalid JSON format: Top-level data must be an array of subscriptions.'] };
    }

    rawData.forEach((item, index) => {
      if (typeof item !== 'object' || item === null) {
        errors.push(`Row #${index + 1}: Not a valid JSON object.`);
        return;
      }

      const name = item.name || item.Name;
      const price = parseFloat(item.price ?? item.Price);
      const currency = (item.currency || item.Currency || 'USD').toUpperCase();
      const billingCycle = normalizeBillingCycle(item.billing_cycle || item.billingCycle || item['Billing Cycle']);
      const category = normalizeCategory(item.category || item.Category);
      const status = normalizeStatus(item.status || item.Status);
      const nextBillingDate = item.next_billing_date || item.nextBillingDate || item['Next Billing Date'] || new Date().toISOString().split('T')[0];

      if (!name || typeof name !== 'string' || name.trim() === '') {
        errors.push(`Row #${index + 1}: Missing subscription name.`);
        return;
      }

      if (isNaN(price) || price < 0) {
        errors.push(`Row #${index + 1} ("${name}"): Invalid or missing price.`);
        return;
      }

      parsedItems.push({
        name: name.trim(),
        price,
        currency,
        billing_cycle: billingCycle,
        category,
        status,
        next_billing_date: nextBillingDate,
        payment_method: item.payment_method || item.paymentMethod || item['Payment Method'] || null,
        provider_url: item.provider_url || item.providerUrl || item['Provider URL'] || null,
        notes: item.notes || item.Notes || null,
      });
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      errors.push(`Failed to parse JSON file: ${err.message}`);
    } else {
      errors.push('Failed to parse JSON file due to syntax error.');
    }
  }

  return { parsedItems, errors };
}

export function parseCSVSubscriptions(csvText: string): ImportResult {
  const errors: string[] = [];
  const parsedItems: Omit<SubscriptionInsert, 'user_id'>[] = [];

  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { parsedItems: [], errors: ['CSV file must contain a header row and at least one data row.'] };
  }

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().replace(/['"]/g, ''));
  
  const getIndex = (possibleNames: string[]) => {
    return headers.findIndex((h) => possibleNames.includes(h));
  };

  const nameIdx = getIndex(['name', 'subscription']);
  const priceIdx = getIndex(['price', 'cost', 'amount']);
  const currencyIdx = getIndex(['currency']);
  const cycleIdx = getIndex(['billing cycle', 'billing_cycle', 'cycle']);
  const categoryIdx = getIndex(['category']);
  const statusIdx = getIndex(['status']);
  const nextDateIdx = getIndex(['next billing date', 'next_billing_date', 'next billing']);
  const paymentIdx = getIndex(['payment method', 'payment_method']);
  const urlIdx = getIndex(['provider url', 'provider_url', 'url']);
  const notesIdx = getIndex(['notes', 'note']);

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length === 0 || (row.length === 1 && row[0] === '')) continue;

    const name = nameIdx !== -1 ? row[nameIdx] : '';
    const rawPrice = priceIdx !== -1 ? row[priceIdx] : '';
    const price = parseFloat(rawPrice);
    const currency = (currencyIdx !== -1 && row[currencyIdx] ? row[currencyIdx] : 'USD').toUpperCase();
    const cycle = normalizeBillingCycle(cycleIdx !== -1 ? row[cycleIdx] : undefined);
    const category = normalizeCategory(categoryIdx !== -1 ? row[categoryIdx] : undefined);
    const status = normalizeStatus(statusIdx !== -1 ? row[statusIdx] : undefined);
    const nextDate = nextDateIdx !== -1 && row[nextDateIdx] ? row[nextDateIdx] : new Date().toISOString().split('T')[0];

    if (!name || name.trim() === '') {
      errors.push(`Row #${i}: Missing subscription name.`);
      continue;
    }

    if (isNaN(price) || price < 0) {
      errors.push(`Row #${i} ("${name}"): Invalid or missing price.`);
      continue;
    }

    parsedItems.push({
      name: name.trim(),
      price,
      currency,
      billing_cycle: cycle,
      category,
      status,
      next_billing_date: nextDate,
      payment_method: paymentIdx !== -1 && row[paymentIdx] ? row[paymentIdx] : null,
      provider_url: urlIdx !== -1 && row[urlIdx] ? row[urlIdx] : null,
      notes: notesIdx !== -1 && row[notesIdx] ? row[notesIdx] : null,
    });
  }

  return { parsedItems, errors };
}
