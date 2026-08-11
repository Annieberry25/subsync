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

// SubSync Design System v1.1: Maximum 3 restrained colors per chart
const chartColorPalette = [
  { bar: 'bg-[#14B8A6]', dot: 'bg-[#14B8A6]' },
  { bar: 'bg-[#94A3B8]', dot: 'bg-[#94A3B8]' },
  { bar: 'bg-[#6B7280]', dot: 'bg-[#6B7280]' },
];

export default function ExportPage() {
  const { toast } = useToast();

  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    <div className="space-y-8 min-h-[85vh] pb-32">
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

      {/* Accessible DOM Heading */}
      <h1 className="sr-only">Export & Analytics</h1>

      {error && (
        <div className="p-4 rounded-xl bg-[#D9363E]/10 border border-[#D9363E]/20 flex items-center gap-3 text-[#D9363E] text-xs">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Export & Import Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CSV Operations Card */}
        <div className="p-6 rounded-[20px] bg-[#0B0D0D] border border-[#1A1D1D] space-y-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5 text-[#94A3B8]" />
            <div>
              <h3 className="text-[18px] font-semibold text-[#F5F7F6] leading-[24px]">CSV Spreadsheet Data</h3>
              <p className="text-[15px] text-[#94A3B8]">Export formatted CSV or import existing CSV backup spreadsheets.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={loading || subscriptions.length === 0}
              className="w-full py-3 px-4 min-h-[44px] rounded-xl bg-[#14B8A6] hover:opacity-90 disabled:opacity-50 text-[#091512] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#091512]" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => csvInputRef.current?.click()}
              disabled={importing}
              className="w-full py-3 px-4 min-h-[44px] rounded-xl bg-[#0B0D0D] hover:bg-[#1A1D1D] text-[#F5F7F6] border border-[#1A1D1D] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4 text-[#94A3B8]" />
              <span>Restore CSV</span>
            </button>
          </div>
        </div>

        {/* JSON Operations Card */}
        <div className="p-6 rounded-[20px] bg-[#0B0D0D] border border-[#1A1D1D] space-y-4">
          <div className="flex items-center gap-3">
            <FileCode className="w-5 h-5 text-[#94A3B8]" />
            <div>
              <h3 className="text-[18px] font-semibold text-[#F5F7F6] leading-[24px]">JSON Full Data Backup</h3>
              <p className="text-[15px] text-[#94A3B8]">Export raw structured JSON dataset or restore previous backups.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={handleExportJSON}
              disabled={loading || subscriptions.length === 0}
              className="w-full py-3 px-4 min-h-[44px] rounded-xl bg-[#14B8A6] hover:opacity-90 disabled:opacity-50 text-[#091512] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#091512]" />
              <span>Export JSON</span>
            </button>

            <button
              type="button"
              onClick={() => jsonInputRef.current?.click()}
              disabled={importing}
              className="w-full py-3 px-4 min-h-[44px] rounded-xl bg-[#0B0D0D] hover:bg-[#1A1D1D] text-[#F5F7F6] border border-[#1A1D1D] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4 text-[#94A3B8]" />
              <span>Restore JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* Restore File Preview & Confirmation Section */}
      {(pendingImports.length > 0 || importErrors.length > 0) && (
        <div className="p-6 rounded-[20px] bg-[#0B0D0D] border border-[#14B8A6] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1A1D1D] pb-3">
            <div className="flex items-center gap-2.5">
              <FileCheck className="w-5 h-5 text-[#14B8A6] shrink-0" />
              <h3 className="text-base font-semibold text-[#F5F7F6] truncate">
                Backup Restore Preview: <span className="text-[#94A3B8] font-mono">{importedFileName}</span>
              </h3>
            </div>
            {pendingImports.length > 0 && (
              <span className="text-xs px-3 py-1 rounded-xl bg-[#14B8A6]/15 text-[#14B8A6] font-semibold border border-[#14B8A6]/30 shrink-0 self-start sm:self-auto">
                {pendingImports.length} Valid Record(s) Ready
              </span>
            )}
          </div>

          {importErrors.length > 0 && (
            <div className="space-y-1 bg-[#D9363E]/10 border border-[#D9363E]/20 p-3.5 rounded-xl text-xs text-[#D9363E]">
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
              <div className="max-h-48 overflow-y-auto rounded-2xl border border-[#1A1D1D] bg-[#0B0D0D] p-3.5 space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 text-[13px] font-medium text-[#94A3B8] pb-1 border-b border-[#1A1D1D] gap-2">
                  <span>Name</span>
                  <span>Price</span>
                  <span className="hidden sm:inline">Category</span>
                  <span className="hidden sm:inline">Billing Cycle</span>
                </div>
                {pendingImports.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-2 sm:grid-cols-4 text-xs text-[#F5F7F6] py-1 border-b border-[#1A1D1D] last:border-0 gap-2">
                    <span className="font-medium text-[#F5F7F6] truncate">{item.name}</span>
                    <span>{formatCurrency(item.price, item.currency)}</span>
                    <span className="text-[#94A3B8] hidden sm:inline">{item.category}</span>
                    <span className="capitalize text-[#94A3B8] hidden sm:inline">{item.billing_cycle}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPendingImports([]);
                    setImportedFileName(null);
                    setImportErrors([]);
                  }}
                  className="w-full sm:w-auto px-5 py-3 min-h-[44px] rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors flex items-center justify-center"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => setShowConfirmRestore(true)}
                  disabled={importing}
                  className="w-full sm:w-auto px-6 py-3 min-h-[44px] rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span>Confirm Restore ({pendingImports.length} Subscriptions)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Analytical Insights Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-[20px] bg-[#0B0D0D] border border-[#1A1D1D] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[#94A3B8] uppercase tracking-wider block">Top Category Spend</span>
            <Tag className="w-4 h-4 text-[#94A3B8]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-[#F5F7F6]">{topCategory ? topCategory.category : 'N/A'}</span>
            <span className="text-xs text-[#94A3B8]">
              {topCategory ? `(${topCategory.percentage.toFixed(0)}%)` : ''}
            </span>
          </div>
          <span className="text-[15px] text-[#94A3B8] block truncate">
            {topCategory ? `${formatCurrency(topCategory.monthlySpend)}/mo across ${topCategory.count} items` : 'No active subscriptions'}
          </span>
        </div>

        <div className="p-6 rounded-[20px] bg-[#0B0D0D] border border-[#1A1D1D] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[#94A3B8] uppercase tracking-wider block">Average Cost / Plan</span>
            <TrendingUp className="w-4 h-4 text-[#94A3B8]" />
          </div>
          <span className="text-xl font-bold text-[#F5F7F6]">{formatCurrency(avgCost)}</span>
          <span className="text-[15px] text-[#94A3B8] block truncate">Per active subscription item</span>
        </div>

        <div className="p-6 rounded-[20px] bg-[#0B0D0D] border border-[#1A1D1D] space-y-2 sm:col-span-2 md:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[#94A3B8] uppercase tracking-wider block">Categories Active</span>
            <Layers className="w-4 h-4 text-[#94A3B8]" />
          </div>
          <span className="text-xl font-bold text-[#F5F7F6]">{breakdown.length}</span>
          <span className="text-[15px] text-[#94A3B8] block truncate">Distinct categories tracked</span>
        </div>
      </div>

      {/* Category Spend Distribution Bars */}
      {loading ? (
        <AnalyticsChartSkeleton />
      ) : (
        <div className="p-6 rounded-[20px] bg-[#0B0D0D] border border-[#1A1D1D] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <PieChart className="w-5 h-5 text-[#94A3B8] shrink-0" />
              <h2 className="text-base sm:text-lg font-semibold text-[#F5F7F6] tracking-tight">Monthly Expense Distribution</h2>
            </div>
            <span className="text-xs text-[#94A3B8] font-medium bg-[#0B0D0D] px-3 py-1.5 rounded-xl border border-[#1A1D1D] shrink-0 self-start sm:self-auto">
              Total: {formatCurrency(totalMonthly)}/mo
            </span>
          </div>

          {breakdown.length > 0 ? (
            <div className="space-y-4">
              {/* Visual Stack Bar (Max 3 restrained colors) */}
              <div className="h-4 w-full bg-[#0B0D0D] rounded-full overflow-hidden flex p-0.5 border border-[#1A1D1D]">
                {breakdown.map((item, idx) => {
                  const palette = chartColorPalette[idx % chartColorPalette.length];
                  return (
                    <div
                      key={item.category}
                      style={{ width: `${item.percentage}%` }}
                      title={`${item.category}: ${item.percentage.toFixed(1)}%`}
                      className={`h-full ${palette.bar} transition-all duration-300 rounded-sm`}
                    />
                  );
                })}
              </div>

              {/* Detailed Category Items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {breakdown.map((item, idx) => {
                  const palette = chartColorPalette[idx % chartColorPalette.length];

                  return (
                    <div key={item.category} className="p-4 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${palette.dot} shrink-0`} />
                        <div>
                          <span className="text-base font-semibold text-[#F5F7F6] block">{item.category}</span>
                          <span className="text-[15px] text-[#94A3B8] block">{item.count} subscription{item.count > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-base font-semibold text-[#F5F7F6] block">{formatCurrency(item.monthlySpend)}/mo</span>
                        <span className="text-xs text-[#94A3B8] font-medium block">{item.percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-[#94A3B8]">
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
