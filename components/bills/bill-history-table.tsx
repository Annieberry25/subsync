'use client';

import { useState, useMemo } from 'react';
import { Search, Filter, Trash2, Edit3, FileText, Globe } from 'lucide-react';
import type { BillPayment } from '@/lib/types/bills.types';
import { STANDARD_BILL_CATEGORIES } from '@/lib/types/bills.types';
import { formatCurrencyAmount, SUPPORTED_CURRENCIES } from '@/lib/services/currency-service';
import { filterBillPayments } from '@/lib/services/bills-service';
import { useUserSettings } from '@/lib/contexts/user-settings-context';
import { SUPPORTED_COUNTRIES } from '@/lib/constants/country-architecture';
import ProviderLogo from './provider-logo';

interface BillHistoryTableProps {
  bills: BillPayment[];
  onSelectBill: (bill: BillPayment) => void;
  onEditBill: (bill: BillPayment) => void;
  onDeleteBill: (id: string) => void;
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
  limitDisplayCount?: number;
  onViewAll?: () => void;
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const day = d.getDate();
    return `${month} ${day}`;
  } catch {
    return dateStr;
  }
}

export default function BillHistoryTable({
  bills,
  onSelectBill,
  onEditBill,
  onDeleteBill,
  selectedCategory = 'All',
  onSelectCategory,
  limitDisplayCount,
  onViewAll,
}: BillHistoryTableProps) {
  const { defaultCurrency } = useUserSettings();

  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('All');
  const [providerFilter, setProviderFilter] = useState('All');
  const [currencyFilter, setCurrencyFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<any>('all');
  const [sortBy, setSortBy] = useState<any>('date_desc');
  const [showFilters, setShowFilters] = useState(false);

  // Extract unique list of provider names from bills
  const uniqueProviders = useMemo(() => {
    const set = new Set<string>();
    for (const b of bills) {
      if (b.providerName) set.add(b.providerName);
    }
    return Array.from(set).sort();
  }, [bills]);

  // Filtered bills
  const filteredBills = useMemo(() => {
    let result = filterBillPayments(bills, {
      searchQuery,
      category: selectedCategory,
      currency: currencyFilter,
      status: statusFilter,
      sortBy,
    });

    if (countryFilter && countryFilter !== 'All') {
      result = result.filter((b) => (b.country || '').toLowerCase() === countryFilter.toLowerCase());
    }

    if (providerFilter && providerFilter !== 'All') {
      result = result.filter((b) => b.providerName === providerFilter);
    }

    return result;
  }, [bills, searchQuery, selectedCategory, countryFilter, providerFilter, currencyFilter, statusFilter, sortBy]);

  const displayedBills = limitDisplayCount
    ? filteredBills.slice(0, limitDisplayCount)
    : filteredBills;

  return (
    <div className="space-y-3">
      {/* Search & Filter Toolbar */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search payments or providers..."
              className="w-full pl-9 pr-3 py-2 bg-[#090C0B] border border-[#161F1D] rounded-xl text-xs text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors min-h-[40px]"
            />
          </div>

          {/* Filter Toggle Button */}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer min-h-[40px] shrink-0 ${
              showFilters || selectedCategory !== 'All' || countryFilter !== 'All' || providerFilter !== 'All' || currencyFilter !== 'All'
                ? 'bg-[#14B8A6]/10 border-[#14B8A6]/40 text-[#14B8A6]'
                : 'bg-[#090C0B] border-[#161F1D] text-[#94A3B8] hover:text-[#F5F7F6]'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Filter</span>
          </button>
        </div>

        {/* Expandable Filters Drawer */}
        {showFilters && (
          <div className="p-3 rounded-xl bg-[#070A09] border border-[#161F1D] flex flex-wrap items-center gap-2 animate-in fade-in duration-150">
            {/* Country Select */}
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[#090C0B] border border-[#161F1D] rounded-lg text-xs text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6]"
            >
              <option value="All">All Countries</option>
              {SUPPORTED_COUNTRIES.map((c) => (
                <option key={c.code} value={c.name}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>

            {/* Category Select */}
            <select
              value={selectedCategory}
              onChange={(e) => onSelectCategory?.(e.target.value)}
              className="px-2.5 py-1.5 bg-[#090C0B] border border-[#161F1D] rounded-lg text-xs text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6]"
            >
              <option value="All">All Categories</option>
              {STANDARD_BILL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Provider Select */}
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[#090C0B] border border-[#161F1D] rounded-lg text-xs text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6]"
            >
              <option value="All">All Providers</option>
              {uniqueProviders.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            {/* Currency Select */}
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[#090C0B] border border-[#161F1D] rounded-lg text-xs text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6]"
            >
              <option value="All">All Currencies</option>
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>

            {/* Sort Select */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-1.5 bg-[#090C0B] border border-[#161F1D] rounded-lg text-xs text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6]"
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="amount_desc">Highest Amount</option>
              <option value="amount_asc">Lowest Amount</option>
              <option value="provider_asc">Provider A-Z</option>
            </select>
          </div>
        )}
      </div>

      {/* Payment Cards List (Mobile-first fintech layout) */}
      <div className="space-y-2">
        {displayedBills.length > 0 ? (
          displayedBills.map((bill) => {
            const formattedAmount = formatCurrencyAmount(bill.amount, bill.currency || defaultCurrency);
            const catDisplay =
              bill.category === 'Other' && bill.customCategory
                ? bill.customCategory
                : bill.category;
            const dateDisplay = formatDateShort(bill.paymentDate);
            const hasAttachedReceipt = bill.receipts && bill.receipts.length > 0;

            return (
              <div
                key={bill.id}
                onClick={() => onSelectBill(bill)}
                className="p-3.5 rounded-2xl bg-[#090C0B] hover:bg-[#0E1412] active:bg-[#121A18] border border-[#161F1D] hover:border-[#222B28] flex items-center justify-between gap-3 transition-all cursor-pointer min-h-[56px] shadow-sm"
              >
                {/* Left: Reusable Provider Logo Component & Details */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <ProviderLogo
                    name={bill.providerName}
                    officialUrl={bill.officialProviderUrl}
                    size="md"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs sm:text-sm text-[#F5F7F6] truncate">
                        {bill.providerName}
                      </span>
                      {hasAttachedReceipt && (
                        <span className="p-0.5 text-[#94A3B8]" title="Receipt attached">
                          <FileText className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-[#94A3B8] truncate flex items-center gap-1 mt-0.5">
                      {bill.country && <span>{bill.country} · </span>}
                      <span>{catDisplay}</span>
                      <span>·</span>
                      <span>{dateDisplay}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Price & Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <span className="text-xs sm:text-sm font-bold text-[#F5F7F6] block tracking-tight">
                      {formattedAmount}
                    </span>
                    {bill.status === 'pending' && (
                      <span className="text-[9px] text-amber-400 font-semibold uppercase tracking-wider block">
                        Pending
                      </span>
                    )}
                    {bill.status === 'overdue' && (
                      <span className="text-[9px] text-red-400 font-semibold uppercase tracking-wider block">
                        Overdue
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 border-l border-[#161F1D] pl-2 hidden sm:flex">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditBill(bill);
                      }}
                      className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#161F1D] transition-colors"
                      title="Edit Payment"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteBill(bill.id);
                      }}
                      className="p-1.5 rounded-lg text-[#94A3B8] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete Payment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 rounded-2xl bg-[#090C0B] border border-[#161F1D] text-center text-[#94A3B8] space-y-1">
            <p className="text-xs font-semibold text-[#F5F7F6]">No payment records found.</p>
            <p className="text-[11px] text-[#94A3B8]">
              Click &quot;Pay a Bill&quot; or &quot;Add payment manually&quot; to record your payments.
            </p>
          </div>
        )}
      </div>

      {/* View All Payments Footer Button */}
      {limitDisplayCount && filteredBills.length > limitDisplayCount && onViewAll && (
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={onViewAll}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#090C0B] hover:bg-[#121917] text-[#14B8A6] border border-[#161F1D] hover:border-[#14B8A6]/40 text-xs font-semibold transition-colors cursor-pointer min-h-[44px]"
          >
            View all payments ({filteredBills.length}) →
          </button>
        </div>
      )}
    </div>
  );
}
