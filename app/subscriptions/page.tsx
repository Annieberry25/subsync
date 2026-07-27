import { CreditCard, Plus } from 'lucide-react';

export default function SubscriptionsPage() {
  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">All Subscriptions</h2>
          <p className="text-xs text-zinc-400">View and manage your active and paused subscriptions.</p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Subscription</span>
        </button>
      </div>

      {/* Empty State / Placeholder */}
      <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-12 text-center flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 flex items-center justify-center text-zinc-400">
          <CreditCard className="w-6 h-6" />
        </div>
        <div className="max-w-md space-y-1">
          <h3 className="text-sm font-semibold text-white">No Subscriptions Yet</h3>
          <p className="text-xs text-zinc-500">
            Subscriptions schema and RLS policies are live in Supabase. In the next milestone, we will build the interactive subscription manager and form.
          </p>
        </div>
      </div>
    </div>
  );
}
