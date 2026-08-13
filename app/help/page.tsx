'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  HelpCircle,
  Search,
  BookOpen,
  Link2,
  FileSpreadsheet,
  PlusCircle,
  Calendar,
  Settings,
  Receipt,
  Users,
  CreditCard,
  ShieldCheck,
  Bell,
  Lock,
  ChevronDown,
  ArrowLeft,
  Mail,
} from 'lucide-react';

interface HelpTopic {
  id: string;
  category: string;
  icon: any;
  title: string;
  description: string;
  content: string;
}

const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'getting-started',
    category: 'Overview',
    icon: BookOpen,
    title: 'Getting started with SubSync',
    description: 'Learn how to set up your subscription dashboard, configure currency, and track recurring bills.',
    content: 'SubSync helps you consolidate and manage all your recurring software, streaming, utility, and personal subscriptions in one centralized dashboard. Start by configuring your primary reporting currency in Settings, then add your active plans using authorized provider links, receipt imports, or manual entry.',
  },
  {
    id: 'adding-subscriptions',
    category: 'Subscription Management',
    icon: PlusCircle,
    title: 'Adding subscriptions — three-path flow',
    description: 'Explore the three ways to add subscriptions: Link Subscription, Import Receipt, or Add Manually.',
    content: 'Tapping "Add Subscription" presents three options: 1) Link Subscription — Connect an authorized provider account to automatically import subscription details; 2) Import Receipt — Upload a PDF/image receipt or paste text to extract billing information; 3) Add Manually — Manually input provider name, price, cycle, category, and renewal date.',
  },
  {
    id: 'linking-subscription',
    category: 'Subscription Management',
    icon: Link2,
    title: 'Linking a subscription provider',
    description: 'How authorized provider links work and why SubSync never stores your account passwords.',
    content: 'Link Subscription uses OAuth and official provider authorization flows. SubSync redirects you to sign into your provider account safely. We never ask for or store your provider password. Simply search for your service name, authorize connection, and review imported plan details before saving.',
  },
  {
    id: 'importing-receipts',
    category: 'Receipts & Uploads',
    icon: FileSpreadsheet,
    title: 'Importing receipts & assisted data entry',
    description: 'Upload PDF invoices, screenshots, or email receipts to prefill subscription records.',
    content: 'Our smart receipt parser extracts provider names, pricing, billing cycles, invoice numbers, and renewal dates from uploaded files or pasted text. Receipt extraction acts as assisted data entry: you review and adjust all extracted fields in the Review step before confirming.',
  },
  {
    id: 'adding-manually',
    category: 'Subscription Management',
    icon: PlusCircle,
    title: 'Adding subscriptions manually',
    description: 'Input custom subscription fields including optional start date, end date, and provider URL.',
    content: 'Manual entry allows full control over your subscription data. Input your provider name, price, currency, billing cycle (monthly, yearly, quarterly, weekly), category, and status. Optional fields include start date, end date (not required since most recurring plans continue indefinitely), next renewal date, website URL, and custom notes.',
  },
  {
    id: 'renewal-dates-reminders',
    category: 'Notifications & Alerts',
    icon: Calendar,
    title: 'Renewal dates and payment reminders',
    description: 'Set custom lead times for payment reminders so you never miss a renewal or trial expiration.',
    content: 'Next renewal dates drive SubSync automated reminder notifications. You can configure payment reminders for individual subscriptions (e.g. 7 days before, 3 days before, or on renewal day) via in-app inbox alerts or email summaries.',
  },
  {
    id: 'managing-subscriptions',
    category: 'Subscription Management',
    icon: Settings,
    title: 'Managing and editing subscriptions',
    description: 'Use the 3-dot action menu to view details, edit details, set reminders, manage, or add notes.',
    content: 'Each subscription card and list entry features a clean 3-dot action menu containing: View subscription details, Edit subscription, Payment reminder, Manage subscription (opens provider billing portal), and Notes. Connected subscriptions remain fully editable at any time.',
  },
  {
    id: 'receipts-and-records',
    category: 'Receipts & Uploads',
    icon: Receipt,
    title: 'Receipts and supporting payment records',
    description: 'Attach multiple receipts and confirmation invoices to your existing subscriptions.',
    content: 'Every subscription can store attached supporting records regardless of how it was created. View attached receipts, upload dates, and invoice reference IDs inside the View Subscription Details panel.',
  },
  {
    id: 'family-subscriptions',
    category: 'Accounts & Sharing',
    icon: Users,
    title: 'Family subscriptions & multiple linked accounts',
    description: 'Manage multiple personal or family accounts under a single paid subscription record.',
    content: 'SubSync supports adding multiple account links under one subscription record (e.g. "John\'s Netflix account" and "Sarah\'s Netflix account"). Adding multiple linked accounts does not duplicate subscription billing totals — it represents seats or sub-accounts under one paid subscription.',
  },
  {
    id: 'plans-and-billing',
    category: 'Billing',
    icon: CreditCard,
    title: 'SubSync plans & Free vs Premium tier',
    description: 'Understand feature availability across Free, Premium, and Family plans.',
    content: 'SubSync Free includes full portfolio tracking, receipt parsing, and analytics. Premium features will expand bank synchronization, advanced team sharing, and ad-free reporting. Ad banners appear subtly on Free plans without interrupting core workflows.',
  },
  {
    id: 'account-and-security',
    category: 'Account & Security',
    icon: ShieldCheck,
    title: 'Account security, email & password',
    description: 'Manage password credentials, OAuth logins, and display name change limits.',
    content: 'Manage your profile details and change account email in your Settings and Profile pages. Display name changes can be updated once every 30 days. Account deletion is securely located inside authenticated Account settings.',
  },
  {
    id: 'notifications',
    category: 'Notifications & Alerts',
    icon: Bell,
    title: 'Configuring notification preferences',
    description: 'Toggle in-app inbox alerts, email digests, SMS, and push notifications.',
    content: 'In Settings → Preferences → Notifications, toggle your preferred delivery channels. In-app alerts populate your Inbox feed while email digests provide periodic spending summaries.',
  },
  {
    id: 'privacy',
    category: 'Account & Security',
    icon: Lock,
    title: 'Privacy, data export & local storage',
    description: 'Export your subscription portfolio data or clear local browser cache anytime.',
    content: 'Your subscription data belongs to you. In Settings → Privacy & Data, you can download a full JSON export of your portfolio records or clear local browser storage cache with one click.',
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
      topic.content.toLowerCase().includes(q)
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
              Find answers, guides, and instructions for managing your subscriptions in SubSync.
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
            className="w-full h-12 pl-12 pr-4 text-xs sm:text-sm rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors shadow-lg"
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

      {/* Topics Accordion List */}
      <div className="space-y-3">
        {filteredTopics.length > 0 ? (
          filteredTopics.map((topic) => {
            const Icon = topic.icon;
            const isOpen = openTopicId === topic.id;

            return (
              <div
                key={topic.id}
                className="rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] transition-all overflow-hidden shadow-md"
              >
                <button
                  type="button"
                  onClick={() => setOpenTopicId(isOpen ? null : topic.id)}
                  aria-expanded={isOpen}
                  className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-[#0D0F0F] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0 pr-2">
                    <div className="w-10 h-10 rounded-xl bg-[#14B8A6]/15 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6] shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] font-semibold text-[#14B8A6] uppercase tracking-wider block">
                        {topic.category}
                      </span>
                      <h3 className="text-sm sm:text-base font-bold text-[#F5F7F6] truncate">
                        {topic.title}
                      </h3>
                      <p className="text-xs text-[#94A3B8] truncate mt-0.5">
                        {topic.description}
                      </p>
                    </div>
                  </div>

                  <ChevronDown
                    className={`w-5 h-5 text-[#94A3B8] transition-transform duration-200 shrink-0 ml-2 ${
                      isOpen ? 'rotate-180 text-[#14B8A6]' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 border-t border-[#1A1D1D]/70 bg-[#0D0F0F]/60 text-xs text-[#94A3B8] leading-relaxed space-y-3">
                    <p className="text-[#F5F7F6] text-xs sm:text-sm font-normal leading-relaxed">
                      {topic.content}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="p-12 text-center rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] space-y-3">
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
      <div className="p-5 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-center sm:text-left">
          <Mail className="w-6 h-6 text-[#14B8A6] shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-[#F5F7F6]">Still need help?</h3>
            <p className="text-xs text-[#94A3B8]">Our support team is happy to assist you with any questions.</p>
          </div>
        </div>

        <a
          href="mailto:support@subsync.app"
          className="px-5 py-2.5 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold transition-colors cursor-pointer shrink-0"
        >
          Contact Support
        </a>
      </div>
    </div>
  );
}
