'use client';

import { useState } from 'react';
import { CreditCard, X, Loader2 } from 'lucide-react';
import { useUserSettings } from '@/lib/contexts/user-settings-context';
import { CustomSelect } from '@/components/ui/custom-select';

interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddPaymentModal({ isOpen, onClose }: AddPaymentModalProps) {
  const { addPaymentMethod } = useUserSettings();

  const [cardNumber, setCardNumber] = useState('');
  const [expMonth, setExpMonth] = useState('12');
  const [expYear, setExpYear] = useState('2028');
  const [cvc, setCvc] = useState('');
  const [brand, setBrand] = useState('Mastercard');
  const [isDefault, setIsDefault] = useState(true);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const cleanNum = cardNumber.replace(/\s+/g, '');
      const last4 = cleanNum.length >= 4 ? cleanNum.slice(-4) : '4242';
      await addPaymentMethod({
        brand: brand || 'Mastercard',
        last4,
        expMonth,
        expYear,
        isDefault,
      });
      onClose();
    } catch {
      // Ignore errors
    } finally {
      setSaving(false);
    }
  };

  const formatCardNumber = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 16);
    return raw.replace(/(\d{4})/g, '$1 ').trim();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-[#0F1111] border border-[#1A1D1D] rounded-2xl p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200 relative text-[#F5F7F6]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#1A1D1D]">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#F5F7F6]" />
            <h2 className="text-lg font-bold text-[#F5F7F6] tracking-tight">Add payment method</h2>
          </div>
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
          {/* Card Brand Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#94A3B8] block">Card type / Brand</label>
            <CustomSelect
              options={[
                { value: 'Mastercard', label: 'Mastercard' },
                { value: 'Visa', label: 'Visa' },
                { value: 'American Express', label: 'American Express' },
                { value: 'Discover', label: 'Discover' },
              ]}
              value={brand}
              onChange={(val) => setBrand(val)}
              ariaLabel="Card type / Brand"
              className="w-full h-10 px-3.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6]"
            />
          </div>

          {/* Card Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#94A3B8] block">Card number</label>
            <input
              type="text"
              required
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              placeholder="5532 •••• •••• 6730"
              className="w-full h-10 px-3.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors font-mono"
            />
          </div>

          {/* Expiration & CVC */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#94A3B8] block">Expires (MM/YY)</label>
              <div className="flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-[#1A1D1D] bg-[#0D0F0F]">
                <input
                  type="text"
                  required
                  maxLength={2}
                  value={expMonth}
                  onChange={(e) => setExpMonth(e.target.value)}
                  placeholder="12"
                  className="w-6 bg-transparent text-xs text-[#F5F7F6] text-center focus:outline-none placeholder-[#94A3B8]"
                />
                <span className="text-[#94A3B8]">/</span>
                <input
                  type="text"
                  required
                  maxLength={4}
                  value={expYear}
                  onChange={(e) => setExpYear(e.target.value)}
                  placeholder="2028"
                  className="w-10 bg-transparent text-xs text-[#F5F7F6] text-center focus:outline-none placeholder-[#94A3B8]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#94A3B8] block">CVC</label>
              <input
                type="password"
                required
                maxLength={4}
                value={cvc}
                onChange={(e) => setCvc(e.target.value)}
                placeholder="•••"
                className="w-full h-10 px-3.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
              />
            </div>
          </div>

          {/* Default indicator option */}
          <div className="pt-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="set-default-card"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-[#1A1D1D] bg-[#0D0F0F] text-[#14B8A6] focus:ring-0 cursor-pointer"
            />
            <label htmlFor="set-default-card" className="text-xs text-[#94A3B8] cursor-pointer">
              Set as default payment method
            </label>
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
              <span>Add payment method</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
