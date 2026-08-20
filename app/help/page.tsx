'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  HelpCircle,
  Search,
  ChevronDown,
  ArrowLeft,
  Mail,
} from 'lucide-react';

interface HelpTopic {
  id: string;
  category: string;
  title: string;
  description: string;
  paragraphs: string[];
  subheading?: string;
  bullets?: string[];
  additionalParagraph?: string;
}

const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'getting-started',
    category: 'Overview',
    title: 'Getting started with SubHalt',
    description: 'Learn how to set up your subscription dashboard, configure currency, and track recurring bills.',
    paragraphs: [
      'SubHalt helps you consolidate and manage all your recurring software, streaming, utility, and personal subscriptions in one centralized dashboard.',
      'To get the most out of your dashboard, we recommend completing these initial setup steps:',
    ],
    subheading: 'Key setup actions',
    bullets: [
      'Configure primary currency — Normalize overall spending across foreign currencies in Settings.',
      'Connect provider links — Authorize direct integration for automatic plan importing.',
      'Import digital receipts — Upload PDF invoices or screenshots to prefill billing metadata.',
      'Add custom subscriptions — Manually input offline or custom recurring plans.',
    ],
    additionalParagraph:
      'Once configured, SubHalt will automatically calculate your monthly commitment and schedule payment notifications.',
  },
  {
    id: 'adding-subscriptions',
    category: 'Subscription Management',
    title: 'Adding subscriptions — three-path flow',
    description: 'Explore the three ways to add subscriptions: Link Subscription, Import Receipt, or Add Manually.',
    paragraphs: [
      'When you tap "Add Subscription", SubHalt presents three flexible entry paths tailored to different service types and integration options:',
    ],
    subheading: 'Available entry methods',
    bullets: [
      'Link Subscription — Authenticate directly via official provider OAuth flows to import active subscription plans automatically.',
      'Import Receipt — Upload PDF invoices, receipts, or screenshots to parse provider names, prices, and renewal cycles using assisted extraction.',
      'Add Manually — Input custom subscription parameters including provider name, price, billing frequency, category, and next renewal date.',
    ],
    additionalParagraph:
      'You can switch between any of these methods at any time depending on provider support and your preferences.',
  },
  {
    id: 'linking-subscription',
    category: 'Subscription Management',
    title: 'Linking a subscription provider',
    description: 'How authorized provider links work and why SubHalt never stores your account passwords.',
    paragraphs: [
      'Link Subscription uses official OAuth 2.0 and provider-authorized connection frameworks. SubHalt redirects you directly to the service provider to grant read-only access.',
      'We never ask for, view, or store your provider account passwords or payment credentials.',
    ],
    subheading: 'How connection works',
    bullets: [
      'Search directory — Locate your subscription provider in our authorized services directory.',
      'Provider OAuth — Sign into your service account securely in an official popup dialog.',
      'Read-only permissions — Authorize plan details, billing cycle, and pricing sync.',
      'Dashboard save — Review imported metadata and confirm saving to your portfolio.',
    ],
  },
  {
    id: 'importing-receipts',
    category: 'Receipts & Uploads',
    title: 'Importing receipts & assisted data entry',
    description: 'Upload PDF invoices, screenshots, or email receipts to prefill subscription records.',
    paragraphs: [
      'Our smart receipt parser extracts key subscription metadata from uploaded PDF invoices, image receipts, or pasted text blocks.',
      'Receipt parsing operates as an assisted data entry pipeline — all extracted fields are presented for your review before confirming.',
    ],
    subheading: 'Extracted subscription fields',
    bullets: [
      'Provider name and service category classification',
      'Recurring subscription price and currency code',
      'Billing cycle frequency (monthly, yearly, quarterly, weekly)',
      'Invoice reference ID and upcoming renewal date',
    ],
  },
  {
    id: 'adding-manually',
    category: 'Subscription Management',
    title: 'Adding subscriptions manually',
    description: 'Input custom subscription fields including optional start date, end date, and provider URL.',
    paragraphs: [
      'Manual entry gives you complete control over offline, custom, or unsupported subscription plans.',
      'Required fields include provider name, recurring price, billing currency, billing cycle, and category classification.',
    ],
    subheading: 'Optional configuration fields',
    bullets: [
      'Start date — The date your subscription contract initially commenced.',
      'End date / Term — For fixed-length contracts or trial periods.',
      'Next renewal date — Drives automated payment reminder notifications.',
      'Website URL — Direct link to manage account billing on the provider site.',
      'Custom notes — Track payment methods used, seat counts, or tier specifications.',
    ],
  },
  {
    id: 'renewal-dates-reminders',
    category: 'Notifications & Alerts',
    title: 'Renewal dates and payment reminders',
    description: 'Set custom lead times for payment reminders so you never miss a renewal or trial expiration.',
    paragraphs: [
      'Next renewal dates power SubHalt\'s automated payment notification system, ensuring you are never surprised by unexpected renewals or expired trial periods.',
    ],
    subheading: 'Configuring reminder lead times',
    bullets: [
      'Custom lead times — Schedule alerts 7 days before, 3 days before, or on renewal day.',
      'Delivery channels — Receive alerts in your in-app Inbox or via email digests.',
      'Flexible preferences — Configure notifications per subscription or globally in Settings.',
    ],
  },
  {
    id: 'managing-subscriptions',
    category: 'Subscription Management',
    title: 'Managing and editing subscriptions',
    description: 'Use the 3-dot action menu to view details, edit details, set reminders, manage, or add notes.',
    paragraphs: [
      'Every subscription entry in your dashboard features a 3-dot action menu for quick management and editing operations.',
    ],
    subheading: 'Available menu options',
    bullets: [
      'View Subscription Details — Inspect metadata, linked sub-accounts, and attached records.',
      'Edit Subscription — Update recurring price, cycle, currency, category, or next renewal date.',
      'Payment Reminder — Adjust notification lead times for upcoming billing dates.',
      'Manage Subscription — Quick launch link to the provider\'s official billing portal.',
      'Notes & Receipts — Attach supporting invoice receipts or custom contract notes.',
    ],
  },
  {
    id: 'receipts-and-records',
    category: 'Receipts & Uploads',
    title: 'Receipts and supporting payment records',
    description: 'Attach multiple receipts and confirmation invoices to your existing subscriptions.',
    paragraphs: [
      'SubHalt allows you to attach multiple invoices, receipt images, or confirmation documents to any subscription record regardless of how it was created.',
    ],
    subheading: 'Managing stored records',
    bullets: [
      'File support — Upload PDF invoices or screenshot images directly to the subscription.',
      'Metadata tracking — View upload timestamps, file sizes, and invoice reference IDs.',
      'Record access — Download or replace stored records anytime in View Subscription Details.',
    ],
  },
  {
    id: 'family-subscriptions',
    category: 'Accounts & Sharing',
    title: 'Family subscriptions & multiple linked accounts',
    description: 'Manage multiple personal or family accounts under a single paid subscription record.',
    paragraphs: [
      'SubHalt supports tracking family plans or shared multi-seat subscriptions under a single billing record without inflating your cost totals.',
    ],
    subheading: 'Multi-account features',
    bullets: [
      'Sub-account labels — Assign member tags (e.g. "Primary Account", "Sarah\'s Profile").',
      'Shared plan clarity — Distinguish shared family plans from individual subscriptions.',
      'Accurate total calculation — Aggregate seat details while keeping overall billing totals precise.',
    ],
  },
  {
    id: 'plans-and-billing',
    category: 'Billing',
    title: 'SubHalt plans & Free vs Plus tier',
    description: 'Understand feature availability across Free ($0/mo, 3 subscription limit) and Plus ($4.99/mo, unlimited subscriptions) plans.',
    paragraphs: [
      'SubHalt offers Free and Plus plan tiers designed for individual tracking and power subscription management.',
    ],
    subheading: 'Plan tier breakdown',
    bullets: [
      'Free Plan ($0/month) — Track up to 3 subscriptions with full core functionality (provider link, receipt import, manual entry, renewal dates, basic reminders, basic Smart Insights).',
      'Plus Plan ($4.99/month) — Unlimited subscriptions. Includes Everything in Free, plus advanced reminder controls, advanced Smart Insights, export subscription data (CSV/JSON), and family/shared subscription features.',
    ],
  },
  {
    id: 'account-and-security',
    category: 'Account & Security',
    title: 'Account security, email & password',
    description: 'Manage password credentials, OAuth logins, and display name change limits.',
    paragraphs: [
      'Manage your security credentials and profile information securely inside your account settings.',
    ],
    subheading: 'Security policies',
    bullets: [
      'Credential updates — Change account email and password with mandatory re-authentication.',
      'Display name rules — Update your public display name once every 30 days.',
      'Account deletion — Permanently purge your profile and data in authenticated Account settings.',
    ],
  },
  {
    id: 'notifications',
    category: 'Notifications & Alerts',
    title: 'Configuring notification preferences',
    description: 'Toggle in-app inbox alerts, email digests, SMS, and push notifications.',
    paragraphs: [
      'Customize how and when SubHalt communicates upcoming renewals and portfolio summaries.',
    ],
    subheading: 'Supported notification channels',
    bullets: [
      'In-App Inbox — Real-time alerts delivered to your dashboard notification feed.',
      'Email Summaries — Periodic weekly or monthly portfolio spending digests.',
      'Notification Timing — Tailor alert lead times per subscription or system-wide.',
    ],
  },
  {
    id: 'privacy',
    category: 'Account & Security',
    title: 'Privacy, data export & local storage',
    description: 'Export your subscription portfolio data or clear local browser cache anytime.',
    paragraphs: [
      'Your subscription data belongs entirely to you. SubHalt adheres to strict privacy-first data handling principles.',
    ],
    subheading: 'Data ownership tools',
    bullets: [
      'Portfolio Export — Download a full JSON or CSV export of all your subscription records.',
      'Cache Control — Clear local browser storage and cached preferences with one click.',
      'Data Privacy — SubHalt never sells your personal subscription data to third parties.',
    ],
  },
];

export default function HelpPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [openTopicId, setOpenTopicId] = useState<string | null>('getting-started');

  const filteredTopics = HELP_TOPICS.filter((topic) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      topic.title.toLowerCase().includes(q) ||
      topic.description.toLowerCase().includes(q) ||
      topic.category.toLowerCase().includes(q) ||
      topic.paragraphs.some((p) => p.toLowerCase().includes(q)) ||
      (topic.bullets && topic.bullets.some((b) => b.toLowerCase().includes(q)))
    );
  });

  const categories = Array.from(new Set(HELP_TOPICS.map((t) => t.category)));

  return (
    <div className="space-y-6 max-w-4xl min-h-[85vh] pb-24 animate-fade-in text-[#F5F7F6]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1A1D1D] pb-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-[#0D0F0F] hover:bg-[#1A1D1D] flex items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] transition-colors cursor-pointer border border-[#1A1D1D]"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#F5F7F6] tracking-tight">Help Center</h1>
            <p className="text-xs sm:text-sm text-[#94A3B8] mt-0.5">
              Find answers, guides, and instructions for managing your subscriptions in SubHalt.
            </p>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-5 h-5 text-[#94A3B8] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search help topics (e.g. adding subscriptions, receipt import, renewal dates)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-12 pr-4 text-xs sm:text-sm rounded-xl bg-[#0B0D0D] border border-[#1A1D1D] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
          />
        </div>
      </div>

      {/* Quick Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          type="button"
          onClick={() => setSearchQuery('')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
            searchQuery === ''
              ? 'bg-[#14B8A6] text-[#091512] border-[#14B8A6]'
              : 'bg-[#0B0D0D] text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] border-[#1A1D1D]'
          }`}
        >
          All Topics ({HELP_TOPICS.length})
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSearchQuery(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
              searchQuery.toLowerCase() === cat.toLowerCase()
                ? 'bg-[#14B8A6] text-[#091512] border-[#14B8A6]'
                : 'bg-[#0B0D0D] text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] border-[#1A1D1D]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Topics Accordion List - Google "People also ask" style */}
      <div className="border-t border-b border-[#1A1D1D]/80 divide-y divide-[#1A1D1D]/80">
        {filteredTopics.length > 0 ? (
          filteredTopics.map((topic) => {
            const isOpen = openTopicId === topic.id;

            return (
              <div key={topic.id} className="group">
                <button
                  type="button"
                  onClick={() => setOpenTopicId(isOpen ? null : topic.id)}
                  aria-expanded={isOpen}
                  className="w-full py-4.5 sm:py-5 flex items-center justify-between text-left cursor-pointer transition-colors"
                >
                  <div className="min-w-0 pr-4">
                    <span className="text-[11px] font-semibold text-[#14B8A6] uppercase tracking-wider block mb-1">
                      {topic.category}
                    </span>
                    <h3 className="text-sm sm:text-base font-semibold text-[#F5F7F6] group-hover:text-[#14B8A6] transition-colors leading-snug">
                      {topic.title}
                    </h3>
                  </div>

                  <div
                    className={`w-7 h-7 rounded-full bg-[#1A1D1D]/70 flex items-center justify-center text-[#94A3B8] group-hover:text-[#F5F7F6] group-hover:bg-[#262B2B] transition-all shrink-0 ml-2 ${
                      isOpen ? 'rotate-180 bg-[#1A1D1D] text-[#14B8A6]' : ''
                    }`}
                  >
                    <ChevronDown className="w-4 h-4 transition-transform duration-200" />
                  </div>
                </button>

                {isOpen && (
                  <div className="pb-5 pt-1 text-xs sm:text-sm text-[#D1D5DB] leading-relaxed space-y-3 animate-fade-in">
                    {topic.paragraphs.map((p, idx) => (
                      <p key={idx} className="text-[#D1D5DB] leading-relaxed">
                        {p}
                      </p>
                    ))}

                    {topic.subheading && (
                      <h4 className="text-xs sm:text-sm font-semibold text-[#F5F7F6] pt-2 mb-1">
                        {topic.subheading}
                      </h4>
                    )}

                    {topic.bullets && topic.bullets.length > 0 && (
                      <ul className="space-y-1.5 my-2 pl-4 list-disc marker:text-[#14B8A6]">
                        {topic.bullets.map((bullet, idx) => {
                          const parts = bullet.split(' — ');
                          return (
                            <li key={idx} className="text-[#94A3B8] leading-relaxed">
                              {parts.length > 1 ? (
                                <>
                                  <strong className="text-[#F5F7F6] font-medium">{parts[0]}</strong> — {parts.slice(1).join(' — ')}
                                </>
                              ) : (
                                bullet
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {topic.additionalParagraph && (
                      <p className="text-[#D1D5DB] leading-relaxed pt-1">
                        {topic.additionalParagraph}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="py-12 text-center space-y-3">
            <HelpCircle className="w-10 h-10 text-[#94A3B8] mx-auto" />
            <h3 className="text-sm font-bold text-[#F5F7F6]">No help topics found</h3>
            <p className="text-xs text-[#94A3B8]">
              No articles matched &quot;{searchQuery}&quot;. Try searching for &quot;receipt&quot;, &quot;link&quot;, or &quot;renewal&quot;.
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-xs font-semibold text-[#14B8A6] hover:underline cursor-pointer"
            >
              Clear Search
            </button>
          </div>
        )}
      </div>

      {/* Support CTA Footer */}
      <div className="p-5 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] flex flex-col sm:flex-row items-center justify-between gap-4 mt-8">
        <div className="flex items-center gap-3 text-center sm:text-left">
          <Mail className="w-6 h-6 text-[#14B8A6] shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-[#F5F7F6]">Still need help?</h3>
            <p className="text-xs text-[#94A3B8]">Our support team is happy to assist you with any questions.</p>
          </div>
        </div>

        <a
          href="mailto:support@subhalt.app"
          className="px-5 py-2.5 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold transition-colors cursor-pointer shrink-0"
        >
          Contact Support
        </a>
      </div>
    </div>
  );
}

