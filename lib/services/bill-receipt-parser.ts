import type { ExtractedBillReceiptData, BillFrequency } from '@/lib/types/bills.types';
import { getVerifiedProvider } from '@/lib/constants/verified-providers';

export function parseBillReceiptText(rawText: string, fileName?: string): ExtractedBillReceiptData {
  const text = rawText || '';
  const normText = text.toLowerCase();

  // 1. Detect Provider / Merchant
  let providerName = '';
  const knownMatch = getVerifiedProvider(text);
  if (knownMatch) {
    providerName = knownMatch.name;
  } else if (normText.includes('ikeja electric') || normText.includes('ikedc')) {
    providerName = 'Ikeja Electric (IKEDC)';
  } else if (normText.includes('eko electric') || normText.includes('ekedc')) {
    providerName = 'Eko Electricity (EKEDC)';
  } else if (normText.includes('ibadan electric') || normText.includes('ibedc')) {
    providerName = 'Ibadan Electricity (IBEDC)';
  } else if (normText.includes('abuja electric') || normText.includes('aedc')) {
    providerName = 'Abuja Electricity (AEDC)';
  } else if (normText.includes('mtn')) {
    providerName = 'MTN Nigeria';
  } else if (normText.includes('airtel')) {
    providerName = 'Airtel Nigeria';
  } else if (normText.includes('glo') || normText.includes('globacom')) {
    providerName = 'Glo Nigeria';
  } else if (normText.includes('dstv')) {
    providerName = 'MultiChoice DSTV';
  } else if (normText.includes('gotv')) {
    providerName = 'GOtv Nigeria';
  } else if (normText.includes('spectranet')) {
    providerName = 'Spectranet 4G LTE';
  } else if (normText.includes('starlink')) {
    providerName = 'Starlink';
  } else if (normText.includes('lagos water') || normText.includes('lwc')) {
    providerName = 'Lagos Water Corporation (LWC)';
  } else if (normText.includes('aws') || normText.includes('amazon web services')) {
    providerName = 'Amazon Web Services (AWS)';
  } else if (normText.includes('openai') || normText.includes('chatgpt')) {
    providerName = 'OpenAI ChatGPT';
  } else {
    // Extract first meaningful non-keyword line
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (!/receipt|invoice|bill|statement|confirmation|payment|thank you|order|#|paid/i.test(line) && line.length > 2) {
        providerName = line.slice(0, 40);
        break;
      }
    }
    if (!providerName && fileName) {
      providerName = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').slice(0, 30);
    }
    if (!providerName) {
      providerName = 'General Provider';
    }
  }

  // 2. Detect Currency
  let currency = 'NGN';
  if (text.includes('₦') || normText.includes('ngn') || normText.includes('naira')) {
    currency = 'NGN';
  } else if (text.includes('$') || normText.includes('usd') || normText.includes('dollar')) {
    currency = 'USD';
  } else if (text.includes('€') || normText.includes('eur') || normText.includes('euro')) {
    currency = 'EUR';
  } else if (text.includes('£') || normText.includes('gbp') || normText.includes('pound')) {
    currency = 'GBP';
  } else if (normText.includes('cad')) {
    currency = 'CAD';
  } else if (normText.includes('aud')) {
    currency = 'AUD';
  }

  // 3. Detect Amount
  let amount = 0;
  // Match ₦25,000 or NGN 25,000 or $25.00 or 25,000.00
  const nairaMatch = text.match(/(?:₦|NGN|N)\s*([\d,]+(?:\.\d{1,2})?)/i);
  const usdMatch = text.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  const generalNumMatch = text.match(/(?:total|amount|paid|sum):\s*([A-Z$₦]*\s*[\d,]+(?:\.\d{1,2})?)/i);

  if (nairaMatch && nairaMatch[1]) {
    amount = parseFloat(nairaMatch[1].replace(/,/g, ''));
    currency = 'NGN';
  } else if (usdMatch && usdMatch[1]) {
    amount = parseFloat(usdMatch[1].replace(/,/g, ''));
    currency = 'USD';
  } else if (generalNumMatch && generalNumMatch[1]) {
    const rawVal = generalNumMatch[1].replace(/[^0-9.]/g, '');
    if (rawVal) amount = parseFloat(rawVal);
  } else {
    // Fallback: search for numbers with decimals like 2500.00 or comma separated integers like 25,000
    const rawNumbers = text.match(/\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b/g);
    if (rawNumbers && rawNumbers.length > 0) {
      const parsed = rawNumbers
        .map((n) => parseFloat(n.replace(/,/g, '')))
        .filter((num) => num > 0 && num < 100000000);
      if (parsed.length > 0) {
        amount = Math.max(...parsed); // usually total is largest numeric figure
      }
    }
  }

  // 4. Detect Date
  let paymentDate = new Date().toISOString().split('T')[0];
  const dateMatchISO = text.match(/20\d{2}[-/.]\d{2}[-/.]\d{2}/);
  const dateMatchText = text.match(/(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d{2})/i);
  const dateMatchTextReverse = text.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(20\d{2})/i);

  if (dateMatchISO) {
    paymentDate = dateMatchISO[0].replace(/\./g, '-').replace(/\//g, '-');
  } else if (dateMatchText) {
    const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const monthIdx = months.indexOf(dateMatchText[2].toLowerCase());
    const dayStr = String(dateMatchText[1]).padStart(2, '0');
    const monthStr = String(monthIdx + 1).padStart(2, '0');
    paymentDate = `${dateMatchText[3]}-${monthStr}-${dayStr}`;
  } else if (dateMatchTextReverse) {
    const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const monthIdx = months.indexOf(dateMatchTextReverse[1].toLowerCase());
    const dayStr = String(dateMatchTextReverse[2]).padStart(2, '0');
    const monthStr = String(monthIdx + 1).padStart(2, '0');
    paymentDate = `${dateMatchTextReverse[3]}-${monthStr}-${dayStr}`;
  }

  // 5. Detect Transaction Reference
  let providerReference = '';
  const refMatch = text.match(/(?:ref|reference|txn|transaction|meter|account|receipt)\s*(?:#|id|no|num|number)?:?\s*([A-Za-z0-9\-_]{5,30})/i);
  if (refMatch && refMatch[1]) {
    providerReference = refMatch[1];
  }

  // 6. Detect Category
  let category = 'Utilities';
  if (normText.includes('electric') || normText.includes('power') || normText.includes('kedc') || normText.includes('disco') || normText.includes('light')) {
    category = 'Electricity';
  } else if (normText.includes('internet') || normText.includes('wifi') || normText.includes('broadband') || normText.includes('spectranet') || normText.includes('starlink') || normText.includes('swift')) {
    category = 'Internet';
  } else if (normText.includes('airtime') || normText.includes('recharge') || normText.includes('mobile data') || normText.includes('mtn') || normText.includes('airtel') || normText.includes('glo') || normText.includes('9mobile')) {
    category = 'Airtime / Mobile Data';
  } else if (normText.includes('tv') || normText.includes('dstv') || normText.includes('gotv') || normText.includes('startimes') || normText.includes('streaming') || normText.includes('netflix') || normText.includes('spotify')) {
    category = 'TV / Streaming';
  } else if (normText.includes('rent') || normText.includes('housing') || normText.includes('estate') || normText.includes('apartment') || normText.includes('lease')) {
    category = 'Rent / Housing';
  } else if (normText.includes('insurance') || normText.includes('health') || normText.includes('policy')) {
    category = 'Insurance';
  } else if (normText.includes('tuition') || normText.includes('school') || normText.includes('education') || normText.includes('university') || normText.includes('course') || normText.includes('waec') || normText.includes('jamb')) {
    category = 'Education';
  } else if (normText.includes('software') || normText.includes('digital') || normText.includes('cloud') || normText.includes('aws') || normText.includes('github') || normText.includes('openai') || normText.includes('microsoft')) {
    category = 'Software / Digital Services';
  } else if (normText.includes('membership') || normText.includes('gym') || normText.includes('club')) {
    category = 'Membership';
  } else if (normText.includes('water') || normText.includes('waste') || normText.includes('trash') || normText.includes('security')) {
    category = 'Utilities';
  } else {
    category = 'Other';
  }

  // 7. Detect Frequency
  let paymentFrequency: BillFrequency = 'one_time';
  if (normText.includes('monthly') || normText.includes('month') || normText.includes('/mo')) {
    paymentFrequency = 'monthly';
  } else if (normText.includes('yearly') || normText.includes('annual') || normText.includes('/yr')) {
    paymentFrequency = 'yearly';
  } else if (normText.includes('weekly')) {
    paymentFrequency = 'weekly';
  } else if (normText.includes('quarterly')) {
    paymentFrequency = 'quarterly';
  }

  // 8. Detect Region / City
  let region = '';
  if (normText.includes('lagos') || normText.includes('ikeja') || normText.includes('lekki') || normText.includes('victoria island')) {
    region = 'Lagos';
  } else if (normText.includes('abuja') || normText.includes('fct')) {
    region = 'Abuja (FCT)';
  } else if (normText.includes('port harcourt') || normText.includes('rivers')) {
    region = 'Rivers';
  } else if (normText.includes('ibadan') || normText.includes('oyo')) {
    region = 'Oyo';
  } else if (normText.includes('enugu')) {
    region = 'Enugu';
  } else if (normText.includes('kano')) {
    region = 'Kano';
  }

  return {
    providerName,
    amount,
    currency,
    paymentDate,
    category,
    providerReference,
    paymentFrequency,
    region,
    rawText: text,
    fileName,
  };
}
