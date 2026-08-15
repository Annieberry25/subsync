'use client';

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useUserSettings, type BillingDetails } from '@/lib/contexts/user-settings-context';
import { CustomSelect } from '@/components/ui/custom-select';

interface EditBillingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EditBillingModal({ isOpen, onClose }: EditBillingModalProps) {
  const { billingDetails, updateBillingDetails } = useUserSettings();

  const [formData, setFormData] = useState<BillingDetails>({
    email: '',
    fullName: '',
    country: 'Nigeria',
    addressLine1: '',
    addressLine2: '',
    city: '',
    stateProvince: '',
    postalCode: '',
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (billingDetails) {
      setFormData(billingDetails);
    }
  }, [billingDetails]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateBillingDetails(formData);
      onClose();
    } catch {
      // Ignore errors
    } finally {
      setSaving(false);
    }
  };

  const countries = [
    'Nigeria',
    'United States',
    'United Kingdom',
    'Canada',
    'Australia',
    'Germany',
    'France',
    'Ghana',
    'Kenya',
    'South Africa',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-[#0F1111] border border-[#1A1D1D] rounded-2xl p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200 relative text-[#F5F7F6] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#1A1D1D]">
          <h2 className="text-lg font-bold text-[#F5F7F6] tracking-tight">Edit billing information</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#94A3B8] hover:text-[#F5F7F6] p-1 rounded-lg hover:bg-[#1A1D1D] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Billing email */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#94A3B8] block">Billing email</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="anitaonyema25@gmail.com"
              className="w-full h-10 px-3.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
            />
          </div>

          {/* Full name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#94A3B8] block">Full name</label>
            <input
              type="text"
              required
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="Anita Onyema"
              className="w-full h-10 px-3.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
            />
          </div>

          {/* Country or region */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#94A3B8] block">Country or region</label>
            <CustomSelect
              options={countries.map((c) => ({ value: c, label: c }))}
              value={formData.country}
              onChange={(val) => setFormData({ ...formData, country: val })}
              ariaLabel="Country or region"
              className="w-full h-10 min-h-0 py-0 px-3.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6]"
            />
          </div>

          {/* Address line 1 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#94A3B8] block">Address line 1</label>
            <input
              type="text"
              required
              value={formData.addressLine1}
              onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
              placeholder="Umuchima, Ihiagwa, Owerri."
              className="w-full h-10 px-3.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
            />
          </div>

          {/* Address line 2 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#94A3B8] block">Address line 2</label>
            <input
              type="text"
              value={formData.addressLine2 || ''}
              onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
              placeholder="Suite, apartment, unit, etc. (optional)"
              className="w-full h-10 px-3.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
            />
          </div>

          {/* City */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#94A3B8] block">City</label>
            <input
              type="text"
              required
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Owerri"
              className="w-full h-10 px-3.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
            />
          </div>

          {/* State / Province & Postal Code (2-column layout) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#94A3B8] block">State / Province</label>
              <input
                type="text"
                value={formData.stateProvince || ''}
                onChange={(e) => setFormData({ ...formData, stateProvince: e.target.value })}
                placeholder="Imo"
                className="w-full h-10 px-3.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#94A3B8] block">ZIP / Postal code</label>
              <input
                type="text"
                value={formData.postalCode || ''}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                placeholder="460106"
                className="w-full h-10 px-3.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 text-xs font-semibold rounded-xl text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 px-6 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#091512]" />}
              <span>Save</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
