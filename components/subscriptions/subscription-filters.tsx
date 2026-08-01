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
    <div className="glass-panel p-4 sm:p-5 rounded-3xl space-y-4 shadow-sm border border-env-subtle/80 bg-env-card/40">
      {/* Top Search & Filter Controls */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-env-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search subscriptions by name, plan tier, or notes..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-11 pl-10 pr-3.5 py-2.5 text-xs rounded-2xl border text-env-heading placeholder-env-muted focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Filter Groups with Outer Labels and Responsive Custom SelectTriggers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex items-center gap-3 w-full lg:w-auto">
          {/* Status: [ All              ▼ ] */}
          <div className="flex items-center gap-2.5 flex-1 sm:flex-initial">
            <div className="flex items-center gap-1.5 text-xs font-bold text-env-body w-14 shrink-0">
              <Filter className="w-3.5 h-3.5 text-env-muted shrink-0" />
              <span>Status:</span>
            </div>
            
            <div className="flex-1 sm:flex-initial">
              <CustomSelect
                options={statusOptions}
                value={selectedStatus}
                onChange={onStatusChange}
                ariaLabel="Filter subscriptions by status"
                minWidth="w-full sm:min-w-[125px]"
              />
            </div>
          </div>

          {/* Sort: [ Next Billing (Soonest) ▼ ] */}
          <div className="flex items-center gap-2.5 flex-1 sm:flex-initial">
            <div className="flex items-center gap-1.5 text-xs font-bold text-env-body w-14 shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-env-muted shrink-0" />
              <span>Sort:</span>
            </div>

            <div className="flex-1 sm:flex-initial">
              <CustomSelect
                options={sortOptions}
                value={sortBy}
                onChange={onSortChange}
                ariaLabel="Sort subscriptions"
                minWidth="w-full sm:min-w-[210px]"
                alignRight={true}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Category Quick Filter Pills Row */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full pt-0.5">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryChange(cat)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap min-h-[38px] transition-all cursor-pointer flex items-center justify-center ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 border border-indigo-500/30'
                  : 'bg-env-button-sec hover:bg-env-button-sec-hover text-env-body hover:text-env-heading border border-transparent hover:border-env-subtle/40'
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
