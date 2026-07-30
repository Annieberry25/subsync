'use client';

import { useState, useEffect, useRef } from 'react';
import { fetchSubscriptions, bulkCreateSubscriptions, type SubscriptionRow, type SubscriptionInsert } from '@/lib/services/subscription-service';
import { exportToCSV, exportToJSON } from '@/lib/utils/export-utils';
import { parseCSVSubscriptions, parseJSONSubscriptions } from '@/lib/utils/import-utils';
import { calculateCategoryBreakdown } from '@/lib/utils/analytics-utils';
import { calculateMonthlySpend, formatCurrency } from '@/lib/utils/metrics-utils';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { AnalyticsChartSkeleton } from '@/components/ui/skeleton';
import { useToast } from '@/lib/hooks/use-toast';
import { 
  Download, 
  Upload, 
  FileSpreadsheet, 
  FileCode, 
  PieChart, 
  AlertCircle, 
  FileCheck,
  TrendingUp,
  Tag,
  Layers
} from 'lucide-react';

const categoryBarColors: Record<string, string> = {
  Streaming: 'bg-gradient-to-r from-purple-500 to-indigo-500',
  Software: 'bg-gradient-to-r from-indigo-500 to-blue-500',
  Utilities: 'bg-gradient-to-r from-amber-500 to-orange-500',
  Fitness: 'bg-gradient-to-r from-emerald-500 to-teal-500',
  Finance: 'bg-gradient-to-r from-teal-500 to-cyan-500',
  Education: 'bg-gradient-to-r from-blue-500 to-indigo-600',
  Gaming: 'bg-gradient-to-r from-rose-500 to-red-500',
  Other: 'bg-gradient-to-r from-zinc-500 to-zinc-600',
};

const categoryBadgeDot: Record<string, string> = {
  Streaming: 'bg-purple-500',
  Software: 'bg-indigo-500',
  Utilities: 'bg-amber-500',
  Fitness: 'bg-emerald-500',
  Finance: 'bg-teal-500',
  Education: 'bg-blue-500',
  Gaming: 'bg-rose-500',
  Other: 'bg-zinc-500',
};

export default function ExportPage() {
  const { toast } = useToast();

  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Import & Confirm state
  const [importing, setImporting] = useState(false);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [pendingImports, setPendingImports] = useState<Omit<SubscriptionInsert, 'user_id'>[]>([]);
  const [importedFileName, setImportedFileName] = useState<string | null>(null);

  const csvInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    setLoading(true);
    const { data, error: err } = await fetchSubscriptions();
    if (err) setError(err.message);
    else if (data) setSubscriptions(data);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    fetchSubscriptions().then(({ data, error: err }) => {
      if (!active) return;
      if (err) {
        setError(err.message);
      } else if (data) {
        setSubscriptions(data);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, format: 'csv' | 'json') => {
    setImportErrors([]);
    setPendingImports([]);
    const file = e.target.files?.[0];
    if (!file) return;

    setImportedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const { parsedItems, errors } = format === 'csv' 
        ? parseCSVSubscriptions(content) 
        : parseJSONSubscriptions(content);

      setPendingImports(parsedItems);
      setImportErrors(errors);
      if (parsedItems.length > 0) {
        toast.info(`Parsed ${parsedItems.length} subscription records from ${file.name}.`, 'File Loaded');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (pendingImports.length === 0) return;
    setImporting(true);
    setImportErrors([]);

    const { count, error: err } = await bulkCreateSubscriptions(pendingImports);
    setImporting(false);

    if (err) {
      setImportErrors([`Failed to restore subscriptions: ${err.message}`]);
      toast.error(err.message, 'Backup Restore Failed');
    } else {
      toast.success(`Successfully restored ${count} subscription(s) from backup!`, 'Backup Restored');
      setPendingImports([]);
      setImportedFileName(null);
      await loadData();
    }
  };

  const handleExportCSV = () => {
    exportToCSV(subscriptions);
    toast.success('Downloaded CSV spreadsheet backup.', 'Export Complete');
  };

  const handleExportJSON = () => {
    exportToJSON(subscriptions);
    toast.success('Downloaded JSON data backup.', 'Export Complete');
  };

  const breakdown = calculateCategoryBreakdown(subscriptions);
  const totalMonthly = calculateMonthlySpend(subscriptions);
  const activeCount = subscriptions.filter((s) => s.status === 'active' || s.status === 'trial').length;
  const avgCost = activeCount > 0 ? totalMonthly / activeCount : 0;
  const topCategory = breakdown.length > 0 ? breakdown[0] : null;

  return (
    <div className="space-y-6 sm:space-y-8 bg-ambient-grid min-h-[85vh] pb-24 sm:pb-32">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={csvInputRef}
        accept=".csv"
        className="hidden"
        onChange={(e) => handleFileUpload(e, 'csv')}
      />
      <input
        type="file"
        ref={jsonInputRef}
        accept=".json"
        className="hidden"
        onChange={(e) => handleFileUpload(e, 'json')}
      />

      {/* Header */}
      <div>
        <h2 className="text-2xl md:text-3xl font-black text-env-heading tracking-tight">Export, Import & Analytics</h2>
        <p className="text-xs text-env-body mt-1">
          Backup, restore, and analyze your recurring subscription expenses and category distributions.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-400 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Export & Import Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {/* CSV Operations Card */}
        <div className="glass-card p-5 sm:p-6 rounded-3xl space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-env-heading">CSV Spreadsheet Data</h3>
              <p className="text-xs text-env-body">Export formatted CSV or import existing CSV backup spreadsheets.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={loading || subscriptions.length === 0}
              className="w-full py-3 px-4 min-h-[44px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => csvInputRef.current?.click()}
              disabled={importing}
              className="w-full py-3 px-4 min-h-[44px] rounded-2xl bg-env-button-sec hover:bg-env-button-sec-hover text-env-heading border border-env-main text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>Restore CSV</span>
            </button>
          </div>
        </div>

        {/* JSON Operations Card */}
        <div className="glass-card p-5 sm:p-6 rounded-3xl space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-env-heading">JSON Full Data Backup</h3>
              <p className="text-xs text-env-body">Export raw structured JSON dataset or restore previous backups.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={handleExportJSON}
              disabled={loading || subscriptions.length === 0}
              className="w-full py-3 px-4 min-h-[44px] rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export JSON</span>
            </button>

            <button
              type="button"
              onClick={() => jsonInputRef.current?.click()}
              disabled={importing}
              className="w-full py-3 px-4 min-h-[44px] rounded-2xl bg-env-button-sec hover:bg-env-button-sec-hover text-env-heading border border-env-main text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4 text-indigo-400" />
              <span>Restore JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* Restore File Preview & Confirmation Section */}
      {(pendingImports.length > 0 || importErrors.length > 0) && (
        <div className="glass-panel p-5 sm:p-6 rounded-3xl space-y-4 shadow-xl animate-in fade-in duration-150 border-indigo-500/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-env-main pb-3">
            <div className="flex items-center gap-2.5">
              <FileCheck className="w-5 h-5 text-indigo-400 shrink-0" />
              <h3 className="text-sm font-bold text-env-heading truncate">
                Backup Restore Preview: <span className="text-indigo-400 font-mono">{importedFileName}</span>
              </h3>
            </div>
            {pendingImports.length > 0 && (
              <span className="text-xs px-3 py-1 rounded-xl bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30 shrink-0 self-start sm:self-auto">
                {pendingImports.length} Valid Record(s) Ready
              </span>
            )}
          </div>

          {importErrors.length > 0 && (
            <div className="space-y-1 bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-2xl text-xs text-rose-400">
              <span className="font-semibold block">Parsing Warnings / Errors:</span>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                {importErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {pendingImports.length > 0 && (
            <div className="space-y-3">
              <div className="max-h-48 overflow-y-auto rounded-2xl border border-env-main bg-env-badge p-3.5 space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 text-[11px] font-semibold text-env-muted pb-1 border-b border-env-main gap-2">
                  <span>Name</span>
                  <span>Price</span>
                  <span className="hidden sm:inline">Category</span>
                  <span className="hidden sm:inline">Billing Cycle</span>
                </div>
                {pendingImports.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-2 sm:grid-cols-4 text-xs text-env-body py-1 border-b border-env-subtle last:border-0 gap-2">
                    <span className="font-medium text-env-heading truncate">{item.name}</span>
                    <span>{formatCurrency(item.price, item.currency)}</span>
                    <span className="text-env-muted hidden sm:inline">{item.category}</span>
                    <span className="capitalize text-env-muted hidden sm:inline">{item.billing_cycle}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPendingImports([]);
                    setImportedFileName(null);
                    setImportErrors([]);
                  }}
                  className="w-full sm:w-auto px-5 py-3 min-h-[44px] rounded-2xl text-xs font-semibold text-env-body hover:text-env-heading hover:bg-env-button-sec transition-colors flex items-center justify-center"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => setShowConfirmRestore(true)}
                  disabled={importing}
                  className="w-full sm:w-auto px-6 py-3 min-h-[44px] rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <span>Confirm Restore ({pendingImports.length} Subscriptions)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Analytical Insights Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-3xl space-y-1.5 border-l-4 border-l-purple-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-env-body uppercase block">Top Category Spend</span>
            <Tag className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black text-env-heading">{topCategory ? topCategory.category : 'N/A'}</span>
            <span className="text-xs text-indigo-400 font-bold">
              {topCategory ? `(${topCategory.percentage.toFixed(0)}%)` : ''}
            </span>
          </div>
          <span className="text-[11px] text-env-muted block truncate">
            {topCategory ? `${formatCurrency(topCategory.monthlySpend)}/mo across ${topCategory.count} items` : 'No active subscriptions'}
          </span>
        </div>

        <div className="glass-panel p-5 rounded-3xl space-y-1.5 border-l-4 border-l-indigo-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-env-body uppercase block">Average Cost / Plan</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="text-xl font-black text-env-heading">{formatCurrency(avgCost)}</span>
          <span className="text-[11px] text-env-muted block truncate">Per active subscription item</span>
        </div>

        <div className="glass-panel p-5 rounded-3xl space-y-1.5 border-l-4 border-l-emerald-500 sm:col-span-2 md:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-env-body uppercase block">Categories Active</span>
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-xl font-black text-env-heading">{breakdown.length}</span>
          <span className="text-[11px] text-env-muted block truncate">Distinct categories tracked</span>
        </div>
      </div>

      {/* Category Spend Distribution Bars / Skeleton */}
      {loading ? (
        <AnalyticsChartSkeleton />
      ) : (
        <div className="glass-panel p-5 sm:p-6 rounded-3xl space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <PieChart className="w-5 h-5 text-indigo-400 shrink-0" />
              <h3 className="text-base font-bold text-env-heading">Monthly Expense Distribution by Category</h3>
            </div>
            <span className="text-xs text-env-body font-bold bg-env-badge px-3 py-1 rounded-xl border border-env-main shrink-0 self-start sm:self-auto">
              Total: {formatCurrency(totalMonthly)}/mo
            </span>
          </div>

          {breakdown.length > 0 ? (
            <div className="space-y-4">
              {/* Visual Stack Bar */}
              <div className="h-4 w-full bg-env-button-sec rounded-full overflow-hidden flex shadow-inner p-0.5 border border-env-main">
                {breakdown.map((item) => (
                  <div
                    key={item.category}
                    style={{ width: `${item.percentage}%` }}
                    title={`${item.category}: ${item.percentage.toFixed(1)}%`}
                    className={`h-full ${categoryBarColors[item.category] || categoryBarColors.Other} transition-all duration-500 rounded-sm`}
                  />
                ))}
              </div>

              {/* Detailed Category Items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 pt-2">
                {breakdown.map((item) => {
                  const dotColor = categoryBadgeDot[item.category] || categoryBadgeDot.Other;

                  return (
                    <div key={item.category} className="p-3.5 sm:p-4 rounded-2xl bg-env-button-sec border border-env-main flex items-center justify-between hover:border-env-border-hover transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-3.5 h-3.5 rounded-full ${dotColor} shadow-md shrink-0`} />
                        <div>
                          <span className="text-xs font-bold text-env-heading block">{item.category}</span>
                          <span className="text-[11px] text-env-muted block">{item.count} subscription{item.count > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-env-heading block">{formatCurrency(item.monthlySpend)}/mo</span>
                        <span className="text-[11px] text-indigo-400 font-bold block">{item.percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-env-body">
              No active subscriptions available to generate expense analytics.
            </div>
          )}
        </div>
      )}

      {/* Confirm Restore Dialog */}
      <ConfirmDialog
        isOpen={showConfirmRestore}
        onClose={() => setShowConfirmRestore(false)}
        onConfirm={handleConfirmImport}
        loading={importing}
        title="Restore Backup Subscriptions?"
        description={`Are you sure you want to restore ${pendingImports.length} subscriptions from "${importedFileName}"? This will add these records to your SubSync account.`}
        confirmText="Restore Backup"
        variant="info"
      />
    </div>
  );
}
