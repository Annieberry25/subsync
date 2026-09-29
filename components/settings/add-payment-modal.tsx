'use client';

import { useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';
import { useSettings } from '@/lib/contexts/user-settings-context';
import { CustomSelect } from '@/components/ui/custom-select';
import Sheet from '@/components/ui/sheet';

interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddPaymentModal({ isOpen, onClose }: AddPaymentModalProps) {
  const { addPaymentMethod } = useSettings();

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
    <Sheet
      open={isOpen}
      onClose={onClose}
      size="md"
      title={
        <span className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-[#F5F7F6]" />
          Add payment method
        </span>
      }
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
            form="add-payment-modal-form"
            disabled={saving}
            className="h-11 px-6 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#091512]" />}
            <span>Add payment method</span>
          </button>
        </div>
      }
    >
        <form id="add-payment-modal-form" onSubmit={handleSubmit} className="space-y-4 pt-1">
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
              className="w-full h-11 px-3.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6]"
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
              placeholder="1234 5678 9012 3456"
              className="w-full h-11 px-3.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors font-mono"
            />
          </div>

          {/* Expiration & CVC */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#94A3B8] block">Expires (MM/YY)</label>
              <div className="flex items-center gap-1.5 h-11 px-3.5 rounded-xl border border-[#1A1D1D] bg-[#0D0F0F]">
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
                className="w-full h-11 px-3.5 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
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

        </form>
    </Sheet>
  );
}
