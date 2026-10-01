'use client';

import { useState } from 'react';
import { Search, Filter, ArrowUpDown, X, ChevronDown } from 'lucide-react';
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
  resultCount?: number;
  totalCount?: number;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
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
  resultCount,
  totalCount,
  hasActiveFilters,
  onClearFilters,
}: SubscriptionFiltersProps) {
  const [categoriesOpen, setCategoriesOpen] = useState(true);

  return (
    <div className="space-y-3.5 sm:space-y-4">
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

        {/* Filter Groups. Status and Sort share one horizontal row: on mobile
            each collapses to a single icon button that expands its own menu,
            which keeps two labelled selects from wrapping onto three lines
            beside the search box. From `sm` up the labels come back, where
            there is room for them. */}
        <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto shrink-0">
          {/* Status Select */}
          <div className="flex items-center gap-2 sm:flex-initial">
            <div className="hidden sm:flex items-center gap-1.5 text-[13px] font-medium text-[#94A3B8] shrink-0">
              <Filter className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
              <span>Status:</span>
            </div>

            <div className="sm:hidden">
              <CustomSelect
                options={statusOptions}
                value={selectedStatus}
                onChange={onStatusChange}
                ariaLabel="Filter subscriptions by status"
                iconOnly
                icon={<Filter className="w-4 h-4" />}
              />
            </div>

            <div className="hidden sm:block sm:min-w-[125px]">
              <CustomSelect
                options={statusOptions}
                value={selectedStatus}
                onChange={onStatusChange}
                ariaLabel="Filter subscriptions by status"
                minWidth="sm:min-w-[125px]"
              />
            </div>
          </div>

          {/* Sort Select */}
          <div className="flex items-center gap-2 sm:flex-initial">
            <div className="hidden sm:flex items-center gap-1.5 text-[13px] font-medium text-[#94A3B8] shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
              <span>Sort:</span>
            </div>

            <div className="sm:hidden">
              <CustomSelect
                options={sortOptions}
                value={sortBy}
                onChange={onSortChange}
                ariaLabel="Sort subscriptions"
                iconOnly
                icon={<ArrowUpDown className="w-4 h-4" />}
                alignRight={true}
              />
            </div>

            <div className="hidden sm:block sm:min-w-[200px]">
              <CustomSelect
                options={sortOptions}
                value={sortBy}
                onChange={onSortChange}
                ariaLabel="Sort subscriptions"
                minWidth="sm:min-w-[200px]"
                alignRight={true}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Category Pills (Collapsible) + Result Feedback */}
      <div className="flex items-center gap-3 w-full">
        {/* Collapse Toggle + Pills */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setCategoriesOpen((open) => !open)}
            aria-expanded={categoriesOpen}
            aria-controls="category-pills"
            title={categoriesOpen ? 'Hide category filters' : 'Show category filters'}
            className="h-7 w-7 shrink-0 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] bg-[#0D0F0F] border border-[#1A1D1D] transition-colors cursor-pointer"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${categoriesOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {categoriesOpen && (
            <div
              id="category-pills"
              className="filter-scroll flex-1 min-w-0 py-0.5"
            >
              {categories.map((cat) => {
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => onCategoryChange(cat)}
                    className={`h-7 px-2.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center justify-center shrink-0 ${
                      isActive
                        ? 'bg-[#14B8A6] text-[#091512] font-semibold border border-[#14B8A6]'
                        : 'bg-[#0D0F0F] text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] border border-[#1A1D1D]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          )}

          {!categoriesOpen && (
            <span className="text-xs text-[#94A3B8] whitespace-nowrap select-none">
              Categories{selectedCategory !== 'All' ? `: ${selectedCategory}` : ''}
            </span>
          )}
        </div>

        {/* Result Feedback + Clear */}
        <div className="flex items-center gap-2 shrink-0">
          {resultCount !== undefined && (
            <span className="text-xs text-[#94A3B8] whitespace-nowrap" aria-live="polite">
              {hasActiveFilters && totalCount !== undefined
                ? `${resultCount} of ${totalCount} shown`
                : `${resultCount} ${resultCount === 1 ? 'subscription' : 'subscriptions'}`}
            </span>
          )}

          {hasActiveFilters && onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              title="Clear all filters and search"
              className="h-11 px-3 rounded-lg text-[11px] font-medium text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] bg-[#0D0F0F] border border-[#1A1D1D] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5 text-[#94A3B8]" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
