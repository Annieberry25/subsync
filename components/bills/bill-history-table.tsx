'use client';

import { useState, useMemo } from 'react';
import { Search, Filter, ShieldCheck, ExternalLink, FileText, Trash2, Edit3, Eye, ArrowUpDown, Tag, Calendar } from 'lucide-react';
import type { BillPayment, BillFilterOptions } from '@/lib/types/bills.types';
import { STANDARD_BILL_CATEGORIES } from '@/lib/types/bills.types';
import { formatCurrencyAmount, convertAmount, SUPPORTED_CURRENCIES } from '@/lib/services/currency-service';
import { filterBillPayments } from '@/lib/services/bills-service';
import { useUserSettings } from '@/lib/contexts/user-settings-context';
import { getVerifiedProvider } from '@/lib/constants/verified-providers';

interface BillHistoryTableProps {
  bills: BillPayment[];
  onSelectBill: (bill: BillPayment) => void;
  onEditBill: (bill: BillPayment) => void;
  onDeleteBill: (id: string) => void;
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
}

export default function BillHistoryTable({
  bills,
  onSelectBill,
  onEditBill,
  onDeleteBill,
  selectedCategory = 'All',
  onSelectCategory,
}: BillHistoryTableProps) {
  const { defaultCurrency, exchangeRates } = useUserSettings();

  const [searchQuery, setSearchQuery] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<any>('all');
  const [sortBy, setSortBy] = useState<any>('date_desc');

  // Filtered bills
  const filteredBills = useMemo(() => {
    return filterBillPayments(bills, {
      searchQuery,
      category: selectedCategory,
      currency: currencyFilter,
      status: statusFilter,
      sortBy,
    });
  }, [bills, searchQuery, selectedCategory, currencyFilter, statusFilter, sortBy]);

  // Unique list of providers for filter
  const uniqueProviders = useMemo(() => {
    const set = new Set(bills.map((b) => b.providerName));
    return Array.from(set);
  }, [bills]);

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search payments by provider, reference, notes, location..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#000000] border border-[#1A1D1D] rounded-xl text-xs text-[#F5F7F6] placeholder-[#64748B] focus:outline-none focus:border-[#14B8A6] transition-colors"
            />
          </div>

          {/* Quick Filter Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Select */}
            <select
              value={selectedCategory}
              onChange={(e) => onSelectCategory?.(e.target.value)}
              className="px-3 py-2 bg-[#000000] border border-[#1A1D1D] rounded-xl text-xs text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6]"
            >
              <option value="All">All Categories</option>
              {STANDARD_BILL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Currency Select */}
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="px-3 py-2 bg-[#000000] border border-[#1A1D1D] rounded-xl text-xs text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6]"
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
              className="px-3 py-2 bg-[#000000] border border-[#1A1D1D] rounded-xl text-xs text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6]"
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="amount_desc">Highest Amount</option>
              <option value="amount_asc">Lowest Amount</option>
              <option value="provider_asc">Provider A-Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#1A1D1D] bg-[#0F1111] text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">
              <th className="py-3.5 px-4">Provider / Biller</th>
              <th className="py-3.5 px-4">Category</th>
              <th className="py-3.5 px-4">Date</th>
              <th className="py-3.5 px-4">Original Amount</th>
              <th className="py-3.5 px-4">Converted Total</th>
              <th className="py-3.5 px-4">Receipt</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A1D1D]/70 text-xs">
            {filteredBills.length > 0 ? (
              filteredBills.map((bill) => {
                const verified = getVerifiedProvider(bill.providerName);
                const isVerified = Boolean(verified);
                const originalFormatted = formatCurrencyAmount(bill.amount, bill.currency);
                const convertedDisplay = convertAmount(bill.amount, bill.currency, defaultCurrency, exchangeRates);
                const convertedFormatted = formatCurrencyAmount(convertedDisplay, defaultCurrency);
                const isDifferentCurrency = (bill.currency || 'NGN').toUpperCase() !== (defaultCurrency || 'USD').toUpperCase();

                return (
                  <tr
                    key={bill.id}
                    className="hover:bg-[#121414] transition-colors group cursor-pointer"
                    onClick={() => onSelectBill(bill)}
                  >
                    {/* Provider Name */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#14B8A6]/10 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6] font-bold text-xs shrink-0">
                          {bill.providerName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[#F5F7F6] group-hover:text-[#14B8A6] transition-colors">
                              {bill.providerName}
                            </span>
                            {isVerified && (
                              <span title="Verified Biller">
                                <ShieldCheck className="w-3.5 h-3.5 text-[#14B8A6]" />
                              </span>
                            )}
                          </div>
                          {bill.providerReference && (
                            <span className="text-[10px] text-[#64748B] block font-mono">
                              {bill.providerReference}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-md bg-[#1A1D1D] text-[#94A3B8] font-medium text-[11px]">
                        {bill.category === 'Other' && bill.customCategory ? bill.customCategory : bill.category}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 text-[#94A3B8]">
                      {bill.paymentDate}
                    </td>

                    {/* Original Amount */}
                    <td className="py-3.5 px-4 font-semibold text-[#F5F7F6]">
                      {originalFormatted}
                    </td>

                    {/* Converted Display Amount */}
                    <td className="py-3.5 px-4 text-[#94A3B8]">
                      {isDifferentCurrency ? (
                        <span>{convertedFormatted}</span>
                      ) : (
                        <span className="text-[#64748B]">—</span>
                      )}
                    </td>

                    {/* Receipt Indicator */}
                    <td className="py-3.5 px-4">
                      {bill.receipts && bill.receipts.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#14B8A6] font-medium">
                          <FileText className="w-3.5 h-3.5" />
                          Attached
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#64748B]">None</span>
                      )}
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {bill.officialProviderUrl && (
                          <a
                            href={bill.officialProviderUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#14B8A6] hover:bg-[#1A1D1D] transition-colors"
                            title="Visit Official Provider Portal"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => onEditBill(bill)}
                          className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteBill(bill.id)}
                          className="p-1.5 rounded-lg text-[#94A3B8] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[#94A3B8]">
                  <p className="text-sm font-semibold">No payment records found.</p>
                  <p className="text-xs text-[#64748B] mt-1">
                    Try adjusting your filters or click &quot;Add Bill or Payment&quot; above.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List View (< md screens) */}
      <div className="md:hidden space-y-3">
        {filteredBills.length > 0 ? (
          filteredBills.map((bill) => {
            const verified = getVerifiedProvider(bill.providerName);
            const isVerified = Boolean(verified);
            const originalFormatted = formatCurrencyAmount(bill.amount, bill.currency);

            return (
              <div
                key={bill.id}
                onClick={() => onSelectBill(bill)}
                className="p-4 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] space-y-3 active:bg-[#121414] transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#14B8A6]/10 border border-[#14B8A6]/30 flex items-center justify-center text-[#14B8A6] font-bold text-xs shrink-0">
                      {bill.providerName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-xs text-[#F5F7F6] truncate">
                          {bill.providerName}
                        </span>
                        {isVerified && <ShieldCheck className="w-3.5 h-3.5 text-[#14B8A6] shrink-0" />}
                      </div>
                      <span className="text-[10px] text-[#94A3B8] block">
                        {bill.category === 'Other' && bill.customCategory ? bill.customCategory : bill.category}
                      </span>
                    </div>
                  </div>

                  <span className="text-sm font-bold text-[#F5F7F6]">
                    {originalFormatted}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#94A3B8] pt-2 border-t border-[#1A1D1D]">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-[#14B8A6]" />
                    {bill.paymentDate}
                  </span>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onEditBill(bill)}
                      className="px-2.5 py-1 rounded-lg bg-[#1A1D1D] text-[#F5F7F6] font-medium"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteBill(bill.id)}
                      className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center bg-[#0B0D0D] border border-[#1A1D1D] rounded-2xl text-[#94A3B8]">
            <p className="text-sm font-semibold">No payment records found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
