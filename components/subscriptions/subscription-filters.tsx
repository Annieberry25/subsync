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
    <div className="space-y-2.5">
      {/* Top Filter & Search Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 glass-panel px-4 py-2.5 sm:py-3 rounded-2xl shadow-sm border border-env-subtle/80 bg-env-card/40">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-env-muted" />
          <input
            type="text"
            placeholder="Search subscriptions by name, plan tier, or notes..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-9 pl-9 pr-3 py-1.5 text-xs rounded-xl border text-env-heading placeholder-env-muted focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Filter Groups with Outer Labels and Intentional Minimum Width Glass SelectTriggers */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status: [ All              ▼ ] */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-env-body shrink-0">
              <Filter className="w-3.5 h-3.5 text-env-muted" />
              <span>Status:</span>
            </div>
            
            {/* Custom Glass SelectTrigger Pill (min-w-[105px]) */}
            <CustomSelect
              options={statusOptions}
              value={selectedStatus}
              onChange={onStatusChange}
              ariaLabel="Filter subscriptions by status"
              minWidth="min-w-[105px]"
            />
          </div>

          {/* Sort: [ Next Billing (Soonest) ▼ ] */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-env-body shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-env-muted" />
              <span>Sort:</span>
            </div>

            {/* Custom Glass SelectTrigger Pill (min-w-[210px]) */}
            <CustomSelect
              options={sortOptions}
              value={sortBy}
              onChange={onSortChange}
              ariaLabel="Sort subscriptions"
              minWidth="min-w-[210px]"
            />
          </div>
        </div>
      </div>

      {/* Category Quick Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryChange(cat)}
              className={`px-3.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap min-h-[30px] transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/10 border border-indigo-500/30'
                  : 'glass-panel text-env-body hover:text-env-heading hover:bg-env-button-sec-hover'
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
