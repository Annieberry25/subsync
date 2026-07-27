import { Download, FileText } from 'lucide-react';

export default function ExportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Export & Analytics</h2>
        <p className="text-xs text-zinc-400">Download your subscription reports in CSV or JSON formats.</p>
      </div>

      <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-12 text-center flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 flex items-center justify-center text-zinc-400">
          <Download className="w-6 h-6" />
        </div>
        <div className="max-w-md space-y-1">
          <h3 className="text-sm font-semibold text-white">Export Engine Placeholder</h3>
          <p className="text-xs text-zinc-500">
            Export capabilities will allow you to generate CSV / PDF reports of your monthly and yearly expenses.
          </p>
        </div>
      </div>
    </div>
  );
}
