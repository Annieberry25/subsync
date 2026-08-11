'use client';

import { Search, Filter, ArrowUpDown } from 'lucide-react';
import { CustomSelect, type SelectOption } from '@/components/ui/custom-select';

interface SubscriptionFiltersProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  selectedStatus: string;
  onStatusChange: (st: string) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
}

const categories = ['All', 'Streaming', 'Software', 'Utilities', 'Fitness', 'Finance', 'Education', 'Gaming', 'Other'];

const statusOptions: SelectOption[] = [
  { value: 'All', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'trial', label: 'Trial' },
];

const sortOptions: SelectOption[] = [
  { value: 'next_billing_asc', label: 'Next Billing (Soonest)' },
  { value: 'price_desc', label: 'Price (High to Low)' },
  { value: 'price_asc', label: 'Price (Low to High)' },
  { value: 'name_asc', label: 'Name (A - Z)' },
];

export default function SubscriptionFilters({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedStatus,
  onStatusChange,
  sortBy,
  onSortChange,
}: SubscriptionFiltersProps) {
  return (
    <div className="p-4 sm:p-6 rounded-[20px] bg-[#0B0D0D] border border-[#1A1D1D] space-y-3.5 sm:space-y-4">
      {/* Top Search & Filter Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 sm:gap-4">
        {/* Search Input */}
        <div className="relative flex-1 min-w-0">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
            <Search className="w-4 h-4 text-[#94A3B8]" />
          </div>
          <input
            type="text"
            placeholder="Search subscriptions by name, plan tier, or notes..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-11 pl-12 pr-3.5 text-xs sm:text-sm rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
          />
        </div>

        {/* Filter Groups */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto shrink-0">
          {/* Status Select */}
          <div className="flex items-center gap-2 flex-1 sm:flex-initial">
            <div className="flex items-center gap-1.5 text-[13px] font-medium text-[#94A3B8] shrink-0">
              <Filter className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
              <span>Status:</span>
            </div>
            
            <div className="flex-1 sm:flex-initial min-w-[120px]">
              <CustomSelect
                options={statusOptions}
                value={selectedStatus}
                onChange={onStatusChange}
                ariaLabel="Filter subscriptions by status"
                minWidth="w-full sm:min-w-[125px]"
              />
            </div>
          </div>

          {/* Sort Select */}
          <div className="flex items-center gap-2 flex-1 sm:flex-initial">
            <div className="flex items-center gap-1.5 text-[13px] font-medium text-[#94A3B8] shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
              <span>Sort:</span>
            </div>

            <div className="flex-1 sm:flex-initial min-w-[180px]">
              <CustomSelect
                options={sortOptions}
                value={sortBy}
                onChange={onSortChange}
                ariaLabel="Sort subscriptions"
                minWidth="w-full sm:min-w-[200px]"
                alignRight={true}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Category Pills Row (Selected tab strictly uses SubSync Primary Accent #14B8A6) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full pt-1 pb-0.5">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryChange(cat)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap min-h-[44px] transition-colors cursor-pointer flex items-center justify-center ${
                isActive
                  ? 'bg-[#14B8A6] text-[#091512] font-semibold'
                  : 'bg-[#0D0F0F] hover:bg-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] border border-[#1A1D1D]'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}
