'use client';

import { Search, Filter, ArrowUpDown } from 'lucide-react';

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
const statuses = ['All', 'active', 'paused', 'canceled', 'trial'];

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
    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800/80">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          placeholder="Filter by subscription name or notes..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      {/* Filter Dropdowns */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Category */}
        <div className="flex items-center gap-1.5 bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-3 py-1.5">
          <Filter className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-xs text-zinc-400 font-medium">Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat} className="bg-zinc-900 text-white">
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div className="flex items-center gap-1.5 bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-3 py-1.5">
          <span className="text-xs text-zinc-400 font-medium">Status:</span>
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className="bg-transparent text-xs text-white focus:outline-none cursor-pointer capitalize"
          >
            {statuses.map((st) => (
              <option key={st} value={st} className="bg-zinc-900 text-white capitalize">
                {st}
              </option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5 bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-3 py-1.5">
          <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-xs text-zinc-400 font-medium">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
          >
            <option value="next_billing_asc" className="bg-zinc-900 text-white">Next Billing (Soonest)</option>
            <option value="price_desc" className="bg-zinc-900 text-white">Price (High to Low)</option>
            <option value="price_asc" className="bg-zinc-900 text-white">Price (Low to High)</option>
            <option value="name_asc" className="bg-zinc-900 text-white">Name (A - Z)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
