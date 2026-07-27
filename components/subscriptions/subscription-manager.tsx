'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  fetchSubscriptions, 
  createSubscription, 
  updateSubscription, 
  deleteSubscription,
  type SubscriptionRow,
  type SubscriptionInsert 
} from '@/lib/services/subscription-service';
import { 
  calculateMonthlySpend, 
  calculateAnnualSpend, 
  getActiveCount, 
  getUpcomingRenewalsCount, 
  formatCurrency 
} from '@/lib/utils/metrics-utils';

import SubscriptionCard from './subscription-card';
import SubscriptionModal from './subscription-modal';
import SubscriptionFilters from './subscription-filters';

import { 
  Plus, 
  CreditCard, 
  DollarSign, 
  Calendar, 
  TrendingUp, 
  Loader2, 
  AlertCircle,
  RefreshCw
} from 'lucide-react';

export default function SubscriptionManager() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<SubscriptionRow | null>(null);

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [sortBy, setSortBy] = useState('next_billing_asc');

  // Load subscriptions from Supabase
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await fetchSubscriptions();
    if (err) {
      setError(err.message);
    } else if (data) {
      setSubscriptions(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Save (Create / Update)
  const handleSave = async (data: Omit<SubscriptionInsert, 'user_id'>, id?: string) => {
    if (id) {
      const { error: err } = await updateSubscription(id, data);
      if (err) throw err;
    } else {
      const { error: err } = await createSubscription(data);
      if (err) throw err;
    }
    await loadData();
  };

  // Handle Delete
  const handleDelete = async (id: string) => {
    const { error: err } = await deleteSubscription(id);
    if (err) {
      setError(err.message);
    } else {
      await loadData();
    }
  };

  // Filter and Sort subscriptions
  const filteredSubscriptions = useMemo(() => {
    return subscriptions
      .filter((sub) => {
        const matchesSearch = sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (sub.notes && sub.notes.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesCategory = selectedCategory === 'All' || sub.category === selectedCategory;
        const matchesStatus = selectedStatus === 'All' || sub.status === selectedStatus;
        return matchesSearch && matchesCategory && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'next_billing_asc') {
          return new Date(a.next_billing_date).getTime() - new Date(b.next_billing_date).getTime();
        }
        if (sortBy === 'price_desc') {
          return Number(b.price) - Number(a.price);
        }
        if (sortBy === 'price_asc') {
          return Number(a.price) - Number(b.price);
        }
        if (sortBy === 'name_asc') {
          return a.name.localeCompare(b.name);
        }
        return 0;
      });
  }, [subscriptions, searchQuery, selectedCategory, selectedStatus, sortBy]);

  // Calculated Metrics
  const monthlySpend = useMemo(() => calculateMonthlySpend(subscriptions), [subscriptions]);
  const annualSpend = useMemo(() => calculateAnnualSpend(subscriptions), [subscriptions]);
  const activeCount = useMemo(() => getActiveCount(subscriptions), [subscriptions]);
  const upcomingCount = useMemo(() => getUpcomingRenewalsCount(subscriptions), [subscriptions]);

  return (
    <div className="space-y-8">
      {/* Top Action & Metrics Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Subscriptions Dashboard</h2>
          <p className="text-xs text-zinc-400 mt-1">
            Track expenses, upcoming renewal dates, and optimize your recurring subscriptions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            title="Refresh subscriptions"
            className="w-9 h-9 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center border border-zinc-700/50 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingSubscription(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Subscription</span>
          </button>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Monthly Spend */}
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400">Monthly Spend</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-white block">{formatCurrency(monthlySpend)}</span>
          <span className="text-[11px] text-zinc-500 block">Normalized monthly total</span>
        </div>

        {/* Annual Spend */}
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400">Annual Projection</span>
            <div className="w-7 h-7 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-white block">{formatCurrency(annualSpend)}</span>
          <span className="text-[11px] text-zinc-500 block">Projected yearly total</span>
        </div>

        {/* Active Subscriptions */}
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400">Active Subscriptions</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-white block">{activeCount}</span>
          <span className="text-[11px] text-emerald-400 font-medium block">Active & Trial plans</span>
        </div>

        {/* Upcoming Renewals */}
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400">Due in 30 Days</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black text-white block">{upcomingCount}</span>
          <span className="text-[11px] text-amber-400 font-medium block">Upcoming billing dates</span>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-400 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar */}
      <SubscriptionFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {/* Subscriptions Grid */}
      {loading ? (
        <div className="p-16 rounded-3xl bg-zinc-900/40 border border-zinc-800/60 text-center flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <span className="text-xs font-medium text-zinc-400">Loading subscriptions from Supabase...</span>
        </div>
      ) : filteredSubscriptions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSubscriptions.map((sub) => (
            <SubscriptionCard
              key={sub.id}
              subscription={sub}
              onEdit={(item) => {
                setEditingSubscription(item);
                setIsModalOpen(true);
              }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="p-16 rounded-3xl bg-zinc-900/40 border border-zinc-800/60 text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 flex items-center justify-center text-zinc-500">
            <CreditCard className="w-6 h-6" />
          </div>
          <div className="max-w-xs space-y-1">
            <h3 className="text-sm font-bold text-white">No subscriptions found</h3>
            <p className="text-xs text-zinc-500">
              {searchQuery || selectedCategory !== 'All' || selectedStatus !== 'All'
                ? 'Try adjusting your search or category filters.'
                : 'Click "Add Subscription" above to create your first subscription record.'}
            </p>
          </div>
          {!searchQuery && selectedCategory === 'All' && selectedStatus === 'All' && (
            <button
              type="button"
              onClick={() => {
                setEditingSubscription(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
            >
              Add First Subscription
            </button>
          )}
        </div>
      )}

      {/* Subscription Form Modal */}
      <SubscriptionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSubscription(null);
        }}
        onSave={handleSave}
        initialData={editingSubscription}
      />
    </div>
  );
}
