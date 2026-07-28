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
    <div className="space-y-4">
      {/* Top Filter & Search Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 glass-panel p-5 rounded-3xl shadow-lg">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-env-muted" />
          <input
            type="text"
            placeholder="Search subscriptions by name, plan tier, or notes..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-11 pl-11 pr-4 py-2.5 text-xs rounded-2xl border text-env-heading placeholder-env-muted focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Filter Groups with Outer Labels and Intentional Minimum Width Glass SelectTriggers */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Status: [ All              ▼ ] */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-env-body shrink-0">
              <Filter className="w-4 h-4 text-env-muted" />
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
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-env-body shrink-0">
              <ArrowUpDown className="w-4 h-4 text-env-muted" />
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
      <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 no-scrollbar">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onCategoryChange(cat)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap min-h-[36px] transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 border border-indigo-500/30'
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
