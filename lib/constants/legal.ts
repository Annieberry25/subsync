/**
 * Shared copy for the public legal pages and the in-app Settings versions.
 *
 * Both surfaces must say exactly the same thing; keeping the sections here means
 * a wording fix cannot land on one and miss the other.
 */
export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export const LEGAL_LAST_UPDATED = 'October 22, 2026';

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: '1. Information you give us',
    paragraphs: [
      'When you create an account we collect your name, email address, and the sign-in method you choose (email and password, or Google).',
      'We store the subscription and bill details you add or import: provider names, amounts, currencies, billing cycles, renewal dates, categories, notes, payment records, and any receipt images or files you upload.',
      'If you contact support, we keep the messages you send so we can resolve the issue.',
    ],
  },
  {
    heading: '2. Information from connected services',
    paragraphs: [
      'If you choose to connect Gmail, we request read-only access and process message content only to find subscription receipts. Access tokens are encrypted at rest. You can disconnect Gmail at any time from Settings.',
      'If you use your SubHalt forwarding address, we process the forwarded email and its attachments to extract receipt details.',
      'If you sign in with Google, we receive the basic profile information Google shares for sign-in, such as your name, email address, and profile image.',
    ],
  },
  {
    heading: '3. Payment information',
    paragraphs: [
      'Paid plans are processed by Paystack. We receive the payment status and a transaction reference, but we do not store full card details.',
      'Payment providers handle card data under their own privacy and security policies.',
    ],
  },
  {
    heading: '4. Technical information',
    paragraphs: [
      'We process IP addresses, browser and device information, and request timestamps to keep the service secure, apply rate limits, and diagnose failures.',
      'The app stores a session cookie and local preferences such as your theme and display currency.',
    ],
  },
  {
    heading: '5. How we use information',
    paragraphs: [
      'We use your information to provide and maintain the app, including tracking renewals, importing receipts, generating the summaries and AI responses you request, processing payments, preventing abuse, and providing support.',
      'We do not sell your personal data, and we do not use your subscription records for advertising.',
    ],
  },
  {
    heading: '6. Service providers',
    paragraphs: [
      'We share information with providers that help us run SubHalt: Supabase (authentication, database, and storage), Vercel (hosting), Paystack (payments), email delivery providers, Groq (AI assistant responses), Google (sign-in and optional Gmail access), Logo.dev (provider logos), and public currency-rate providers.',
      'Each provider receives only what it needs for its function and is subject to its own terms and privacy policy.',
      'For Google user data: Gmail access is read-only and limited to finding receipts. We do not sell that data, and no person reads it except for security purposes, to provide support at your request, or to comply with the law.',
    ],
  },
  {
    heading: '7. Security and isolation',
    paragraphs: [
      'Your records are isolated to your account with PostgreSQL Row Level Security. Gmail tokens are encrypted, traffic is served over HTTPS, and access to production systems is restricted.',
      'No online service can guarantee absolute security, but we work to protect your data and to limit what any one system or person can access.',
    ],
  },
  {
    heading: '8. Retention and deletion',
    paragraphs: [
      'We keep your data while your account exists. You can delete your account from Settings, which removes your subscriptions, bills, and related records. Backups may persist briefly after deletion, and we may retain limited records where the law requires it.',
    ],
  },
  {
    heading: '9. Your choices and rights',
    paragraphs: [
      'You can access and correct your data in the app, export it, disconnect Gmail, turn notifications off, and delete your account.',
      'Depending on where you live, you may have additional rights over your personal data. Contact us and we will help.',
      'The free plan may show Google AdSense ads. Google\u2019s advertising policies apply, and you can control ad personalisation through your Google account settings.',
    ],
  },
  {
    heading: '10. Children',
    paragraphs: [
      'SubHalt is not directed to children, and we do not knowingly collect personal data from children. If you believe a child has given us data, contact us and we will remove it.',
    ],
  },
  {
    heading: '11. Changes to this policy',
    paragraphs: [
      'We may update this page as the service changes. The date at the top shows the latest revision, and material changes will be communicated in the app or by email.',
    ],
  },
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: '1. Accepting these terms',
    paragraphs: [
      'These terms govern your use of SubHalt. By creating an account or using the app, you agree to them. If you do not agree, do not use the service.',
      'You must be able to enter into a binding contract to use SubHalt.',
    ],
  },
  {
    heading: '2. What SubHalt does',
    paragraphs: [
      'SubHalt is a personal subscription and bill tracker. It stores the records you add, reminds you before renewals, can import receipts from a connected inbox or forwarding address, and can answer questions about your records.',
      'SubHalt is a tracking tool. It is not a bank, payment processor, or financial adviser. Provider prices, renewal dates, and cancellation routes are controlled by the providers, and extracted receipt data may contain errors. Check important details before you act on them.',
    ],
  },
  {
    heading: '3. Your account',
    paragraphs: [
      'Provide accurate account information and keep your sign-in credentials secure. You are responsible for activity that happens under your account.',
      'If you believe your account has been accessed without permission, contact us promptly.',
    ],
  },
  {
    heading: '4. Plans and payments',
    paragraphs: [
      'SubHalt offers a free plan and a paid plan. The features, price, and billing period of a paid plan are shown before you pay.',
      'Payments are processed by Paystack, and the payment terms shown at checkout apply. You are responsible for any taxes that apply to your purchase.',
      'We may change plan features or prices. Where a change affects a paid plan, we will give reasonable notice in the app or by email.',
    ],
  },
  {
    heading: '5. Acceptable use',
    paragraphs: [
      'Do not use SubHalt to break the law, access another person\u2019s data, interfere with the service or its infrastructure, reverse engineer or scrape it, upload malware, or violate a provider\u2019s terms.',
      'We may suspend or limit access where needed to protect the service, other users, or the people who run it.',
    ],
  },
  {
    heading: '6. Your content',
    paragraphs: [
      'You keep ownership of the subscription records, bills, receipts, and other content you add. You give us a limited licence to host, process, and display that content so we can operate the service for you.',
      'You confirm that you have the right to upload the content you give us.',
    ],
  },
  {
    heading: '7. Third-party services',
    paragraphs: [
      'SubHalt links to and works with third-party services, including provider websites, Google sign-in and Gmail, Paystack, and AI providers. Their terms and privacy policies apply to your use of them, and we are not responsible for those services.',
    ],
  },
  {
    heading: '8. Availability and changes',
    paragraphs: [
      'We work to keep SubHalt available and accurate, but the service may be interrupted for maintenance, security, or reasons outside our control. Features may be added, changed, or withdrawn.',
    ],
  },
  {
    heading: '9. Termination',
    paragraphs: [
      'You can stop using SubHalt and delete your account at any time. We may suspend or terminate access if these terms are broken or if we need to protect the service.',
      'Terms that by their nature should survive termination, such as ownership, disclaimers, and liability limits, continue to apply.',
    ],
  },
  {
    heading: '10. Disclaimers',
    paragraphs: [
      'To the extent permitted by law, SubHalt is provided \u201cas is\u201d and \u201cas available\u201d. We do not warrant uninterrupted or error-free operation, or that extracted or imported data will be complete or accurate.',
    ],
  },
  {
    heading: '11. Limitation of liability',
    paragraphs: [
      'To the maximum extent permitted by law, we are not liable for indirect, incidental, special, or consequential losses, lost profits, or lost data arising from your use of SubHalt.',
      'Nothing in these terms excludes liability that cannot be excluded by law.',
    ],
  },
  {
    heading: '12. Changes to these terms',
    paragraphs: [
      'We may update these terms as the service changes. The date at the top shows the latest revision, and material changes will be communicated in the app or by email. Continuing to use SubHalt after a change means you accept the updated terms.',
    ],
  },
];
