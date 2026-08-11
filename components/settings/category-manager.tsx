'use client';

import { useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Film,
  Music,
  Laptop,
  Cloud,
  Gamepad2,
  Dumbbell,
  CreditCard,
  BookOpen,
  Zap,
  Home,
  Car,
  ShoppingBag,
  Shield,
  Newspaper,
  Coffee,
  Briefcase,
  Package,
  Sparkles,
  Tag,
  Folder,
  type LucideIcon,
} from 'lucide-react';
import { useUserSettings, BUILT_IN_CATEGORIES } from '@/lib/contexts/user-settings-context';
import { useToast } from '@/lib/hooks/use-toast';
import {
  updateSubscription,
  type SubscriptionRow,
} from '@/lib/services/subscription-service';
import ConfirmDialog from '@/components/ui/confirm-dialog';

interface CategoryManagerProps {
  subscriptions: SubscriptionRow[];
  onSubscriptionsUpdated: () => Promise<void>;
}

// Icon Mapping Registry
export const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  Film,
  Music,
  Laptop,
  Cloud,
  Gamepad2,
  Dumbbell,
  CreditCard,
  BookOpen,
  Zap,
  Home,
  Car,
  ShoppingBag,
  Shield,
  Newspaper,
  Coffee,
  Briefcase,
  Package,
  Sparkles,
  Tag,
  Folder,
};

export const AVAILABLE_ICONS = [
  { name: 'Film', label: 'Streaming & Video' },
  { name: 'Music', label: 'Music & Audio' },
  { name: 'Laptop', label: 'Software & Tech' },
  { name: 'Cloud', label: 'Cloud & Hosting' },
  { name: 'Gamepad2', label: 'Gaming' },
  { name: 'Dumbbell', label: 'Fitness & Health' },
  { name: 'CreditCard', label: 'Finance & Banking' },
  { name: 'BookOpen', label: 'Education & Reading' },
  { name: 'Zap', label: 'Utilities & Power' },
  { name: 'Home', label: 'Home & Living' },
  { name: 'Car', label: 'Travel & Transport' },
  { name: 'ShoppingBag', label: 'Shopping' },
  { name: 'Shield', label: 'Security & VPN' },
  { name: 'Newspaper', label: 'News & Media' },
  { name: 'Coffee', label: 'Food & Lifestyle' },
  { name: 'Briefcase', label: 'Work & Business' },
  { name: 'Package', label: 'Delivery & Shipping' },
  { name: 'Sparkles', label: 'AI & Premium' },
  { name: 'Tag', label: 'General Tag' },
  { name: 'Folder', label: 'Storage & Other' },
];

export const CATEGORY_COLORS = [
  '#14B8A6', // SubSync Teal Accent
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#14B8A6', // Teal
  '#22C55E', // Green
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#34D399', // Mint Teal
  '#64748B', // Slate
];

export function CategoryIconRenderer({
  iconName,
  className = 'w-4 h-4',
  style,
}: {
  iconName: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const IconComponent = CATEGORY_ICON_MAP[iconName] || Tag;
  return <IconComponent className={className} style={style} />;
}

export function CategoryManager({
  subscriptions,
  onSubscriptionsUpdated,
}: CategoryManagerProps) {
  const { toast } = useToast();
  const {
    allCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    getCategoryMeta,
  } = useUserSettings();

  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingCategoryName, setEditingCategoryName] = useState<string | null>(null);

  // Form Field States
  const [formName, setFormName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('Tag');
  const [selectedColor, setSelectedColor] = useState('#14B8A6');

  // Deletion States
  const [deletingCategoryName, setDeletingCategoryName] = useState<string | null>(null);
  const [reassignCategoryTarget, setReassignCategoryTarget] = useState<string>('Other');

  // Open Form Fresh for New Category
  const handleOpenAdd = () => {
    setEditingCategoryName(null);
    setFormName('');
    setSelectedIcon('Sparkles');
    setSelectedColor('#14B8A6');
    setIsEditorOpen(true);
  };

  // Open Form Populated for Editing Category
  const handleOpenEdit = (categoryName: string) => {
    const meta = getCategoryMeta(categoryName);
    setEditingCategoryName(categoryName);
    setFormName(categoryName);
    setSelectedIcon(meta.icon || 'Tag');
    setSelectedColor(meta.color || '#14B8A6');
    setIsEditorOpen(true);
  };

  // Close Form cleanly without changes
  const handleCancelForm = () => {
    setIsEditorOpen(false);
    setEditingCategoryName(null);
    setFormName('');
  };

  // Save / Submit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = formName.trim();

    if (!trimmed) {
      toast.error('Please enter a valid category name.', 'Validation Error');
      return;
    }

    try {
      if (editingCategoryName) {
        // Updating Existing Category
        const isBuiltIn = BUILT_IN_CATEGORIES.includes(editingCategoryName as any);

        if (
          !isBuiltIn &&
          editingCategoryName.toLowerCase() !== trimmed.toLowerCase() &&
          allCategories.some((c) => c.toLowerCase() === trimmed.toLowerCase())
        ) {
          toast.error(`Category "${trimmed}" already exists.`, 'Duplicate Category');
          return;
        }

        await updateCategory(editingCategoryName, trimmed, {
          icon: selectedIcon,
          color: selectedColor,
        });

        // Sync subscriptions if category was renamed
        if (editingCategoryName !== trimmed) {
          const affected = subscriptions.filter((s) => s.category === editingCategoryName);
          if (affected.length > 0) {
            await Promise.all(
              affected.map((s) => updateSubscription(s.id, { category: trimmed as any }))
            );
            await onSubscriptionsUpdated();
          }
        }

        toast.success(`Category "${trimmed}" updated.`, 'Category Saved');
      } else {
        // Creating New Category
        if (allCategories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
          toast.error(`Category "${trimmed}" already exists.`, 'Duplicate Category');
          return;
        }

        await addCategory(trimmed, {
          icon: selectedIcon,
          color: selectedColor,
        });

        toast.success(`Category "${trimmed}" created successfully.`, 'Category Added');
      }

      // Close editor on success
      setIsEditorOpen(false);
      setEditingCategoryName(null);
      setFormName('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save category.';
      toast.error(msg, 'Category Error');
    }
  };

  // Safe Category Deletion Handler
  const handleConfirmDeleteCategory = async () => {
    if (!deletingCategoryName) return;

    const affected = subscriptions.filter((s) => s.category === deletingCategoryName);

    try {
      if (affected.length > 0) {
        await Promise.all(
          affected.map((s) => updateSubscription(s.id, { category: reassignCategoryTarget as any }))
        );
        await onSubscriptionsUpdated();
        toast.info(
          `Reassigned ${affected.length} subscription(s) to "${reassignCategoryTarget}".`,
          'Subscriptions Updated'
        );
      }

      await deleteCategory(deletingCategoryName);
      toast.success(`Category "${deletingCategoryName}" removed.`, 'Category Deleted');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete category.';
      toast.error(msg, 'Deletion Error');
    } finally {
      setDeletingCategoryName(null);
    }
  };

  return (
    <section className="space-y-4">
      {/* SECTION HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-[#F5F7F6] tracking-tight">Categories</h2>
          <p className="text-xs text-[#94A3B8]">Organize your subscriptions into custom categories.</p>
        </div>

        {!isEditorOpen && (
          <button
            type="button"
            onClick={handleOpenAdd}
            className="h-9 px-4 rounded-xl bg-[#14B8A6] hover:opacity-90 text-[#091512] text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Category</span>
          </button>
        )}
      </div>

      {/* CATEGORY EDITOR FORM (CARD PANEL) */}
      {isEditorOpen && (
        <form
          onSubmit={handleSubmitForm}
          className="rounded-2xl bg-[#0B0D0D] border border-[#14B8A6]/40 p-3.5 sm:p-4 space-y-3 shadow-2xl animate-fade-in"
        >
          <div className="flex items-center justify-between border-b border-[#1A1D1D] pb-2.5">
            <h3 className="text-xs sm:text-sm font-semibold text-[#F5F7F6] flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: selectedColor }}
              />
              <span className="truncate">{editingCategoryName ? `Edit "${editingCategoryName}"` : 'New Category'}</span>
            </h3>
            <button
              type="button"
              onClick={handleCancelForm}
              className="p-1 rounded-lg text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer"
              title="Close editor"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 1. Category Name */}
          <div className="space-y-1">
            <label className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-[#94A3B8] block">
              Category Name
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Netflix, Cloud Services, Work Tools..."
              autoFocus
              className="w-full h-9 px-3 text-xs rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] placeholder-[#94A3B8] focus:outline-none focus:border-[#14B8A6] transition-colors"
            />
          </div>

          {/* 2. Icon Selection */}
          <div className="space-y-1">
            <label className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-[#94A3B8] block">
              Icon
            </label>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 p-2 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D] max-h-32 overflow-y-auto custom-scrollbar">
              {AVAILABLE_ICONS.map((item) => {
                const isSelected = selectedIcon === item.name;
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setSelectedIcon(item.name)}
                    title={item.label}
                    className={`h-8 w-full rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#14B8A6]/15 border-2 text-[#F5F7F6] scale-105'
                        : 'bg-[#0B0D0D] border border-[#1A1D1D] text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D]'
                    }`}
                    style={{
                      borderColor: isSelected ? selectedColor : undefined,
                      color: isSelected ? selectedColor : undefined,
                    }}
                  >
                    <CategoryIconRenderer iconName={item.name} className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Colour Selection */}
          <div className="space-y-1">
            <label className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-[#94A3B8] block">
              Colour
            </label>
            <div className="flex items-center flex-wrap gap-2 p-2 rounded-xl bg-[#0D0F0F] border border-[#1A1D1D]">
              {CATEGORY_COLORS.map((hex) => {
                const isSelected = selectedColor.toLowerCase() === hex.toLowerCase();
                return (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setSelectedColor(hex)}
                    className={`w-6.5 h-6.5 rounded-full transition-transform cursor-pointer relative flex items-center justify-center ${
                      isSelected ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#0D0F0F]' : 'hover:scale-105 opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: hex }}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1A1D1D]">
            <button
              type="button"
              onClick={handleCancelForm}
              className="h-8.5 px-3.5 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-[#F5F7F6] bg-[#0D0F0F] hover:bg-[#1A1D1D] border border-[#1A1D1D] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-8.5 px-4 rounded-xl text-xs font-semibold text-[#091512] bg-[#14B8A6] hover:opacity-90 transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{editingCategoryName ? 'Save Changes' : 'Create Category'}</span>
            </button>
          </div>
        </form>
      )}

      {/* CATEGORY LIST GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {allCategories.map((cat) => {
          const isBuiltIn = BUILT_IN_CATEGORIES.includes(cat as any);
          const count = subscriptions.filter((s) => s.category === cat).length;
          const meta = getCategoryMeta(cat);

          return (
            <div
              key={cat}
              className="group p-3 rounded-2xl bg-[#0B0D0D] border border-[#1A1D1D] hover:border-[#14B8A6]/40 transition-all flex items-center justify-between gap-2 shadow-sm min-w-0"
            >
              {/* Left Side: Icon & Title & Subtitle Badge */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                  style={{
                    backgroundColor: `${meta.color}1F`,
                    border: `1px solid ${meta.color}35`,
                  }}
                >
                  <CategoryIconRenderer
                    iconName={meta.icon}
                    className="w-4 h-4"
                    style={{ color: meta.color }}
                  />
                </div>

                <div className="min-w-0 space-y-0.5 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-semibold text-[#F5F7F6] truncate block">{cat}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-medium shrink-0 ${
                        isBuiltIn
                          ? 'bg-[#1A1D1D]/70 text-[#94A3B8]'
                          : 'bg-[#14B8A6]/15 text-[#14B8A6] border border-[#14B8A6]/30'
                      }`}
                    >
                      {isBuiltIn ? 'Default' : 'Custom'}
                    </span>
                    <span className="text-[10px] text-[#94A3B8] whitespace-nowrap shrink-0">
                      {count} plan{count === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Side: Colour dot indicator & Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: meta.color }}
                  title={`Colour: ${meta.color}`}
                />

                <div className="flex items-center gap-0.5 bg-[#000000]/60 p-0.5 rounded-lg border border-[#1A1D1D]/60">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(cat)}
                    className="p-1 rounded-md text-[#94A3B8] hover:text-[#F5F7F6] hover:bg-[#1A1D1D] transition-colors cursor-pointer"
                    title="Edit Category"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {!isBuiltIn && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeletingCategoryName(cat);
                        const available = allCategories.filter((c) => c !== cat);
                        setReassignCategoryTarget(available[0] || 'Other');
                      }}
                      className="p-1 rounded-md text-[#94A3B8] hover:text-[#D9363E] hover:bg-[#D9363E]/10 transition-colors cursor-pointer"
                      title="Delete Category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* SAFE DELETION REASSIGNMENT DIALOG */}
      <ConfirmDialog
        isOpen={!!deletingCategoryName}
        onClose={() => setDeletingCategoryName(null)}
        onConfirm={handleConfirmDeleteCategory}
        title={`Delete Category "${deletingCategoryName}"?`}
        description={
          subscriptions.filter((s) => s.category === deletingCategoryName).length > 0
            ? `There are ${
                subscriptions.filter((s) => s.category === deletingCategoryName).length
              } subscription(s) assigned to this category. Select a target category to reassign them to before deleting.`
            : `Are you sure you want to delete category "${deletingCategoryName}"? This action cannot be undone.`
        }
        confirmText="Delete Category"
        variant="danger"
      >
        {subscriptions.filter((s) => s.category === deletingCategoryName).length > 0 && (
          <div className="pt-2 space-y-1 text-left">
            <label className="text-[11px] font-medium text-[#94A3B8] block">
              Reassign Subscriptions To:
            </label>
            <select
              value={reassignCategoryTarget}
              onChange={(e) => setReassignCategoryTarget(e.target.value)}
              className="w-full h-9 px-3 text-xs font-medium rounded-xl border border-[#1A1D1D] bg-[#0D0F0F] text-[#F5F7F6] focus:outline-none focus:border-[#14B8A6] cursor-pointer"
            >
              {allCategories
                .filter((c) => c !== deletingCategoryName)
                .map((c) => (
                  <option key={c} value={c} className="bg-[#0D0F0F] text-[#F5F7F6]">
                    {c}
                  </option>
                ))}
            </select>
          </div>
        )}
      </ConfirmDialog>
    </section>
  );
}
