import { describe, it, expect } from 'vitest';
import {
  parseReceiptDocument,
  normalizeDocumentText,
  looksLikeBinaryNoise,
} from '@/lib/services/receipt-parser';

/**
 * Regression suite for the receipt parser.
 *
 * The "bills" block reproduces the exact inputs that broke the previous
 * regex-based parsers, and asserts the corrected behaviour.
 */

const NETFLIX_TOTAL = `Netflix
Your Premium plan is confirmed.
Subtotal $9.99
Tax $0.90
Total $10.89
Payment date: 25 August 2026
Next billing date 2026-09-01`;

describe('parseReceiptDocument — amounts', () => {
  it('prefers the Total line over Subtotal and Tax', () => {
    const r = parseReceiptDocument(NETFLIX_TOTAL, { kind: 'subscription' });
    expect(r.amount.value).toBe(10.89);
    expect(r.amount.confidence).toBe('high');
    expect(r.amount.evidence).toContain('total');
  });

  it('does not read "on 15 August" as a naira amount', () => {
    const r = parseReceiptDocument(
      'Payment Confirmation\nYour account was debited on 15 August 2026\nRef: PAY-99887766\nTotal $120.50',
      { kind: 'bill' }
    );
    expect(r.amount.value).toBe(120.5);
    expect(r.currency.value).toBe('USD');
  });

  it('parses amounts with thousands separators', () => {
    const r = parseReceiptDocument('Annual plan\nTotal $1,234.56', { kind: 'subscription' });
    expect(r.amount.value).toBe(1234.56);
  });

  it('parses grouped naira amounts', () => {
    const r = parseReceiptDocument('Ikeja Electric\nAmount Paid: N25,000.00', { kind: 'bill' });
    expect(r.amount.value).toBe(25000);
    expect(r.currency.value).toBe('NGN');
  });

  it('prefers "Amount Due" over a larger unrelated number', () => {
    const r = parseReceiptDocument(
      'Account 08031234567\nOrder 998877\nAmount Due: $4,200.00',
      { kind: 'bill' }
    );
    expect(r.amount.value).toBe(4200);
  });

  it('never uses a phone number as the amount', () => {
    const r = parseReceiptDocument(
      'Water Supply\nPhone: 0803 123 4567\nTotal $4,200.00',
      { kind: 'bill' }
    );
    expect(r.amount.value).toBe(4200);
  });

  it('returns null with a warning when no amount is readable', () => {
    const r = parseReceiptDocument('Thank you for your business.', { kind: 'bill' });
    expect(r.amount.value).toBeNull();
    expect(r.amount.confidence).toBe('none');
    expect(r.warnings.join(' ')).toMatch(/no amount/i);
  });

  it('flags a low-confidence amount guess', () => {
    const r = parseReceiptDocument('Payment 4200 received', { kind: 'bill' });
    expect(r.amount.value).toBe(4200);
    expect(r.amount.confidence).toBe('low');
    expect(r.warnings.join(' ')).toMatch(/best guess/i);
  });
});

describe('parseReceiptDocument — dates', () => {
  it('uses the labelled next billing date, not the first date', () => {
    const r = parseReceiptDocument(NETFLIX_TOTAL, { kind: 'subscription' });
    expect(r.nextBillingDate.value).toBe('2026-09-01');
    expect(r.nextBillingDate.evidence).toContain('next billing');
    expect(r.paymentDate.value).toBe('2026-08-25');
  });

  it('ignores an invoice date when a payment date is labelled', () => {
    const r = parseReceiptDocument(
      'Invoice date: 2026-08-01\nNetflix\nTotal $15.49\nPaid on 2026-08-25',
      { kind: 'subscription' }
    );
    expect(r.paymentDate.value).toBe('2026-08-25');
    expect(r.nextBillingDate.value).toBeNull();
  });

  it('uses the END of a billing period as the renewal date', () => {
    const r = parseReceiptDocument(
      'Billing period 2026-08-01 to 2026-09-01\nTotal $9.99\nPaid on 2026-08-25',
      { kind: 'subscription' }
    );
    expect(r.nextBillingDate.value).toBe('2026-09-01');
  });

  it('rejects impossible calendar dates instead of persisting them', () => {
    const r = parseReceiptDocument('Netflix\nTotal $15.49', { kind: 'subscription' });
    expect(r.nextBillingDate.value).toBeNull();
    const bad = parseReceiptDocument('Netflix\nRenewal 2026-13-45', { kind: 'subscription' });
    expect(bad.nextBillingDate.value).toBeNull();
  });

  it('supports several date formats', () => {
    const cases: Array<[string, string]> = [
      ['Next billing date 2026/09/01', '2026-09-01'],
      ['Next billing date 1 September 2026', '2026-09-01'],
      ['Next billing date September 1, 2026', '2026-09-01'],
      ['Next billing date 01/09/2026', '2026-09-01'],
      ['Next billing date 1st Sep 2026', '2026-09-01'],
    ];
    for (const [text, expected] of cases) {
      const r = parseReceiptDocument(`Acme\nTotal $9.99\n${text}`, { kind: 'subscription' });
      expect(r.nextBillingDate.value, text).toBe(expected);
    }
  });

  it('flags a numerically ambiguous date and lowers confidence', () => {
    // Both components are <= 12, so day-first is assumed and the result is
    // flagged rather than presented as certain.
    const r = parseReceiptDocument('Acme\nTotal $9.99\nNext billing date 05/06/2026', {
      kind: 'subscription',
    });
    expect(r.nextBillingDate.value).toBe('2026-06-05');
    expect(r.nextBillingDate.confidence).toBe('low');
    expect(r.warnings.join(' ')).toMatch(/ambiguous/i);
  });

  it('reads an unambiguous numeric date without flagging it', () => {
    const r = parseReceiptDocument('Acme\nTotal $9.99\nNext billing date 25/08/2026', {
      kind: 'subscription',
    });
    expect(r.nextBillingDate.value).toBe('2026-08-25');
    expect(r.nextBillingDate.confidence).toBe('high');
  });

  it('never invents a renewal date', () => {
    const r = parseReceiptDocument('Netflix receipt\nTotal $15.49', { kind: 'subscription' });
    expect(r.nextBillingDate.value).toBeNull();
    expect(r.warnings.join(' ')).toMatch(/no renewal date/i);
  });
});

describe('parseReceiptDocument — provider and category', () => {
  it('does not treat "laws" as the AWS provider', () => {
    const r = parseReceiptDocument('Summary of applicable laws\nTotal $10.00', { kind: 'bill' });
    expect(r.providerName.evidence).not.toBe('provider registry match');
    expect(r.category.value).not.toBe('Software / Digital Services');
  });

  it('does not treat "Global" as Glo', () => {
    const r = parseReceiptDocument('Global delivery report\nTotal $10.00', { kind: 'bill' });
    expect(r.category.value).not.toBe('Airtime / Mobile Data');
  });

  it('does not treat "Current account" as rent', () => {
    const r = parseReceiptDocument('Current account statement\nTotal $10.00', { kind: 'bill' });
    expect(r.category.value).not.toBe('Rent / Housing');
  });

  it('resolves registry providers from aliases', () => {
    const r = parseReceiptDocument('IKEDC\nPrepaid token\nAmount Paid: N25,000.00', { kind: 'bill' });
    expect(r.providerName.value).toBe('Ikeja Electric (IKEDC)');
    expect(r.providerName.confidence).toBe('high');
    expect(r.category.value).toBe('Electricity');
  });

  it('resolves subscription brands', () => {
    const r = parseReceiptDocument('Netflix\nTotal $15.49\nNext billing date 2026-09-01', {
      kind: 'subscription',
    });
    expect(r.providerName.value).toBe('Netflix');
    expect(r.category.value).toBe('Streaming');
  });

  it('does not use a city as the merchant name', () => {
    const r = parseReceiptDocument(
      'INVOICE\nBilling Address: 12 Example Crescent\nLagos\nTotal $50.00',
      { kind: 'bill' }
    );
    expect(r.providerName.value).not.toBe('Lagos');
  });

  it('uses a "Billed by" label', () => {
    const r = parseReceiptDocument('Receipt\nBilled by: Zeel Pharmacy\nTotal $5,000.00', {
      kind: 'bill',
    });
    expect(r.providerName.value).toBe('Zeel Pharmacy');
  });

  it('falls back to the file name and says so', () => {
    const r = parseReceiptDocument('Total $10.00', { kind: 'bill', fileName: 'ikeda_slip.jpg' });
    expect(r.providerName.value).toBe('ikeda slip');
    expect(r.providerName.confidence).toBe('low');
    expect(r.warnings.join(' ')).toMatch(/file name/i);
  });
});

describe('parseReceiptDocument — references, plan, cycle, url, region', () => {
  it('does not read "Preferred" as a reference number', () => {
    const r = parseReceiptDocument('Your Preferred plan has been renewed. Total $15.00', {
      kind: 'bill',
    });
    expect(r.providerReference.value).toBeNull();
  });

  it('reads a real reference number', () => {
    const r = parseReceiptDocument('Ref: PAY-99887766\nTotal $120.50', { kind: 'bill' });
    expect(r.providerReference.value).toBe('PAY-99887766');
  });

  it('resolves "annually for 12 months" to yearly, not monthly', () => {
    const r = parseReceiptDocument('Annual plan billed annually for 12 months. Total $120.00', {
      kind: 'subscription',
    });
    expect(r.billingCycle.value).toBe('yearly');
  });

  it('resolves "$15/mo" to monthly', () => {
    const r = parseReceiptDocument('Acme Cloud $15/mo\nTotal $15.00', { kind: 'subscription' });
    expect(r.billingCycle.value).toBe('monthly');
  });

  it('returns "unknown" rather than guessing a cycle', () => {
    const r = parseReceiptDocument('Acme\nTotal $15.00', { kind: 'subscription' });
    expect(r.billingCycle.value).toBe('unknown');
    expect(r.billingCycle.confidence).toBe('none');
  });

  it('skips unsubscribe/cancel links when picking a provider URL', () => {
    const r = parseReceiptDocument(
      'Netflix receipt\nManage your plan at https://www.netflix.com/cancelplan\nTotal $15.49',
      { kind: 'subscription' }
    );
    expect(r.providerUrl.value).toBeNull();
  });

  it('keeps a legitimate provider link', () => {
    const r = parseReceiptDocument(
      'Netflix\nVisit https://www.netflix.com for details\nTotal $15.49',
      { kind: 'subscription' }
    );
    expect(r.providerUrl.value).toBe('https://www.netflix.com');
  });

  it('detects Nigerian regions without matching "Toyota" as Oyo', () => {
    const oyo = parseReceiptDocument('Payment made in Oyo State\nTotal $10.00', { kind: 'bill' });
    expect(oyo.region.value).toBe('Oyo');
    const toyota = parseReceiptDocument('Toyota dealership invoice\nTotal $10.00', { kind: 'bill' });
    expect(toyota.region.value).toBeNull();
  });

  it('extracts a plan tier', () => {
    const r = parseReceiptDocument('Acme\nPremium Plan\nTotal $9.99', { kind: 'subscription' });
    expect(r.plan.value).toBe('Premium');
  });
});

describe('parseReceiptDocument — naira receipts', () => {
  it('handles a Nigerian receipt end to end', () => {
    const r = parseReceiptDocument(
      `MTN Nigeria
Data subscription renewal
Prepaid
Amount Paid: N5,000.00
Payment date: 2 September 2026
Ref: MNP-8891234`,
      { kind: 'bill' }
    );
    expect(r.providerName.value).toBe('MTN Nigeria');
    expect(r.amount.value).toBe(5000);
    expect(r.currency.value).toBe('NGN');
    expect(r.paymentDate.value).toBe('2026-09-02');
    expect(r.category.value).toBe('Airtime / Mobile Data');
    expect(r.providerReference.value).toBe('MNP-8891234');
  });
});

describe('helpers', () => {
  it('normalises exotic whitespace and dashes', () => {
    expect(normalizeDocumentText('a\u00a0b\u2013c\u0007')).toBe('a b-c');
  });

  it('detects undecoded binary blobs', () => {
    const pdfBytesAsText = '\u0001\u0002\u0003%PDF-1.4\u0000\u0007\u0008\u000E\u001F binary';
    expect(looksLikeBinaryNoise(pdfBytesAsText)).toBe(true);
    expect(looksLikeBinaryNoise('Total $10.00 thank you')).toBe(false);
  });
});
