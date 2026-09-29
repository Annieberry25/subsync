'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useSettings, type BillingDetails } from '@/lib/contexts/user-settings-context';
import { CustomSelect } from '@/components/ui/custom-select';
import Sheet from '@/components/ui/sheet';

interface EditBillingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EditBillingModal({ isOpen, onClose }: EditBillingModalProps) {
  const { billingDetails, updateBillingDetails } = useSettings();

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

  // Reset the form when billing details load or change (render-phase adjustment).
  const [prevBillingDetails, setPrevBillingDetails] = useState<BillingDetails | null>(billingDetails);
  if (billingDetails !== prevBillingDetails) {
    setPrevBillingDetails(billingDetails);
    if (billingDetails) {
      setFormData(billingDetails);
    }
  }

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
    <Sheet
      open={isOpen}
      onClose={onClose}
      size="md"
      title="Edit billing information"
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-4 text-xs font-semibold rounded-xl text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-billing-modal-form"
            disabled={saving}
            className="h-11 px-6 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#091512]" />}
            <span>Save</span>
          </button>
        </div>
      }
    >
        <form id="edit-billing-modal-form" onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Billing email */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#94A3B8] block">Billing email</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="you@example.com"
              className="w-full h-11 px-3.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
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
              placeholder="Your full name"
              className="w-full h-11 px-3.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
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
              className="w-full h-11 min-h-0 py-0 px-3.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6]"
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
              className="w-full h-11 px-3.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
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
              className="w-full h-11 px-3.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
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
              className="w-full h-11 px-3.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
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
                className="w-full h-11 px-3.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#94A3B8] block">ZIP / Postal code</label>
              <input
                type="text"
                value={formData.postalCode || ''}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                placeholder="460106"
                className="w-full h-11 px-3.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
              />
            </div>
          </div>

        </form>
    </Sheet>
  );
}
