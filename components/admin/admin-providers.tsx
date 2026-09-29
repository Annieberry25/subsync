'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import Sheet from '@/components/ui/sheet';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import type { AdminBillProviderRow, AdminProviderInput } from '@/lib/types/admin.types';
import { useToast } from '@/lib/hooks/use-toast';
import { LoadingState, ErrorState, EmptyState, StatusBadge, formatDateTime } from '@/components/admin/admin-ui';

const EMPTY_FORM: AdminProviderInput = {
  name: '',
  category: '',
  country: '',
  region: null,
  official_website: null,
  official_payment_url: null,
  verification_status: 'unverified',
  supported_regions: null,
};

export default function AdminProvidersTab() {
  const { toast } = useToast();
  const [providers, setProviders] = useState<AdminBillProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminBillProviderRow | null>(null);
  const [form, setForm] = useState<AdminProviderInput>(EMPTY_FORM);
  const [regionsText, setRegionsText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<AdminBillProviderRow | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/providers');
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Failed to load providers.');
        return;
      }
      setError(null);
      setProviders(data.rows ?? []);
    } catch {
      setError('Failed to load providers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => load());
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setRegionsText('');
    setModalOpen(true);
  };

  const openEdit = (p: AdminBillProviderRow) => {
    setEditing(p);
    setForm({
      name: p.name,
      category: p.category,
      country: p.country,
      region: p.region,
      official_website: p.official_website,
      official_payment_url: p.official_payment_url,
      verification_status: p.verification_status,
      supported_regions: p.supported_regions,
    });
    setRegionsText((p.supported_regions ?? []).join(', '));
    setModalOpen(true);
  };

  const set = <K extends keyof AdminProviderInput>(key: K, value: AdminProviderInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    if (!form.name.trim() || !form.category.trim() || !form.country.trim()) {
      toast.error('Name, category, and country are required.', 'Admin');
      return;
    }
    const payload: AdminProviderInput = {
      ...form,
      name: form.name.trim(),
      category: form.category.trim(),
      country: form.country.trim(),
      supported_regions: regionsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean) as string[] | null,
    };
    setSaving(true);
    try {
      const res = editing
        ? await fetch(`/api/admin/providers/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/admin/providers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || 'Failed to save provider.', 'Admin');
        return;
      }
      toast.success(editing ? 'Provider updated.' : 'Provider created.', 'Admin');
      setModalOpen(false);
      load();
    } catch {
      toast.error('Failed to save provider.', 'Admin');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/providers/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || 'Failed to delete provider.', 'Admin');
        return;
      }
      toast.success('Provider deleted.', 'Admin');
      setConfirmDelete(null);
      load();
    } catch {
      toast.error('Failed to delete provider.', 'Admin');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#94A3B8]">
          {providers.length.toLocaleString()} providers in the database catalog.
        </p>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-xl text-xs font-semibold text-[#06090A] bg-[#14B8A6] hover:bg-[#0FA394] transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add provider
        </button>
      </div>

      {error ? (
        <ErrorState message={error} />
      ) : loading ? (
        <LoadingState label="Loading providers…" />
      ) : providers.length === 0 ? (
        <EmptyState message="No providers in the catalog yet." />
      ) : (
        <div className="rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] table-scroll">
          <table className="w-full min-w-[760px] text-left">
            <thead className="border-b border-[#1A1D1D]">
              <tr className="text-[11px] uppercase tracking-wider text-[#94A3B8]">
                <th className="px-4 py-3 font-medium table-sticky-col">Name</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Country</th>
                <th className="px-4 py-3 font-medium">Verification</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1D1D]">
              {providers.map((p) => (
                <tr key={p.id} className="hover:bg-[#0D0F0F] transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-xs font-semibold text-[#F5F7F6]">{p.name}</p>
                    {p.official_website ? (
                      <p className="text-[11px] text-[#94A3B8] truncate max-w-[220px]">{p.official_website}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8]">{p.category}</td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8]">{p.country}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.verification_status} /></td>
                  <td className="px-4 py-3 text-xs text-[#94A3B8]">{formatDateTime(p.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        aria-label={`Edit ${p.name}`}
                        className="w-8 h-8 rounded-lg text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] flex items-center justify-center cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(p)}
                        aria-label={`Delete ${p.name}`}
                        className="w-8 h-8 rounded-lg text-[#94A3B8] hover:text-[#F87171] hover:bg-[#F87171]/10 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        size="md"
        title={editing ? 'Edit provider' : 'Add provider'}
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="flex-1 px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-medium text-[#94A3B8] border border-[#1A1D1D] hover:text-[#F5F7F6] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex-1 px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold text-[#06090A] bg-[#14B8A6] hover:bg-[#0FA394] transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create provider'}
            </button>
          </div>
        }
      >
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name">
                  <input value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} placeholder="DStv" className={inputClass} />
                </Field>
                <Field label="Country">
                  <input value={form.country ?? ''} onChange={(e) => set('country', e.target.value)} placeholder="NG" className={inputClass} />
                </Field>
              </div>
              <Field label="Category">
                <input value={form.category ?? ''} onChange={(e) => set('category', e.target.value)} placeholder="TV / Streaming" className={inputClass} />
              </Field>
              <Field label="Region (optional)">
                <input value={form.region ?? ''} onChange={(e) => set('region', e.target.value || null)} placeholder="Lagos" className={inputClass} />
              </Field>
              <Field label="Support regions — comma separated (optional)">
                <input value={regionsText} onChange={(e) => setRegionsText(e.target.value)} placeholder="Lagos, Abuja, Rivers" className={inputClass} />
              </Field>
              <Field label="Official website (optional)">
                <input value={form.official_website ?? ''} onChange={(e) => set('official_website', e.target.value || null)} placeholder="https://…" className={inputClass} />
              </Field>
              <Field label="Payment URL (optional)">
                <input value={form.official_payment_url ?? ''} onChange={(e) => set('official_payment_url', e.target.value || null)} placeholder="https://…" className={inputClass} />
              </Field>
              <Field label="Verification status">
                <select
                  value={form.verification_status}
                  onChange={(e) => set('verification_status', e.target.value as AdminProviderInput['verification_status'])}
                  className={`${inputClass} [&>option]:bg-[#0B0D0D]`}
                >
                  <option value="verified">verified</option>
                  <option value="user_submitted">user_submitted</option>
                  <option value="unverified">unverified</option>
                </select>
              </Field>
            </div>
      </Sheet>

      <ConfirmDialog
        isOpen={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => remove(confirmDelete!.id)}
        title="Delete provider?"
        description={`“${confirmDelete?.name ?? ''}” will be removed from the bill providers catalog.`}
        confirmText="Delete"
      />
    </div>
  );
}

const inputClass =
  'w-full h-11 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] px-3 text-xs text-[#F5F7F6] placeholder:text-[#5B6470] focus:outline-none focus:border-[#14B8A6]/50';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-[#94A3B8] mb-1.5">{label}</label>
      {children}
    </div>
  );
}