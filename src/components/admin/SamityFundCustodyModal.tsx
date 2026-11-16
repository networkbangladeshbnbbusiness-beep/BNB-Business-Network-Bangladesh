import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  CheckCircle2,
  Copy,
  Save
} from 'lucide-react';
import { convertBengaliToEnglishDigits } from '../../lib/memberUtils';

export type SamityFundCategoryKey =
  | 'land'
  | 'gold'
  | 'bank'
  | 'mfs'
  | 'business'
  | 'cash'
  | 'receivable'
  | 'other';

export interface SamityFundHolding {
  id: string;
  accountName: string;
  category: SamityFundCategoryKey;
  holderName: string;
  accountType: string; // e.g., বিকাশ, নগদ, রকেট, ইসলামী ব্যাংক, জমি দলিল, স্বর্ণ ভল্ট, নগদ ক্যাশ
  holderPhone: string;
  accountNumber: string;
  location: string;
  amount: number;
  note: string;
  updatedAt: string;
  createdAt?: string;
}

export const SAMITY_FUND_CATEGORY_MAP: Record<
  SamityFundCategoryKey,
  { label: string; shortLabel: string; icon: string; bg: string; text: string; border: string; activeBg: string }
> = {
  land: {
    label: 'জমি ও স্থাবর সম্পত্তি',
    shortLabel: 'জমি ও সম্পত্তি',
    icon: '🏞️',
    bg: 'bg-amber-50',
    text: 'text-amber-900',
    border: 'border-amber-200',
    activeBg: 'bg-amber-800 text-white'
  },
  gold: {
    label: 'স্বর্ণ ও সোনা ক্রয়',
    shortLabel: 'স্বর্ণ ও সোনা',
    icon: '🪙',
    bg: 'bg-yellow-50',
    text: 'text-yellow-900',
    border: 'border-yellow-200',
    activeBg: 'bg-yellow-700 text-white'
  },
  bank: {
    label: 'ব্যাংক ডিপোজিট ও হিসাব',
    shortLabel: 'ব্যাংক হিসাব',
    icon: '🏦',
    bg: 'bg-blue-50',
    text: 'text-blue-900',
    border: 'border-blue-200',
    activeBg: 'bg-blue-800 text-white'
  },
  mfs: {
    label: 'বিকাশ / নগদ / মোবাইল ব্যাংকিং',
    shortLabel: 'বিকাশ / নগদ',
    icon: '📱',
    bg: 'bg-pink-50',
    text: 'text-pink-900',
    border: 'border-pink-200',
    activeBg: 'bg-pink-800 text-white'
  },
  business: {
    label: 'ব্যবসা ও প্রজেক্ট ইনভেস্টমেন্ট',
    shortLabel: 'ব্যবসা ইনভেস্টমেন্ট',
    icon: '💼',
    bg: 'bg-purple-50',
    text: 'text-purple-900',
    border: 'border-purple-200',
    activeBg: 'bg-purple-800 text-white'
  },
  cash: {
    label: 'নগদ ক্যাশ ইন হ্যান্ড',
    shortLabel: 'নগদ ক্যাশ',
    icon: '💵',
    bg: 'bg-emerald-50',
    text: 'text-emerald-900',
    border: 'border-emerald-200',
    activeBg: 'bg-emerald-800 text-white'
  },
  receivable: {
    label: 'অন্যের নিকট গচ্ছিত / পাওনা',
    shortLabel: 'অন্যের কাছে গচ্ছিত',
    icon: '🤝',
    bg: 'bg-teal-50',
    text: 'text-teal-900',
    border: 'border-teal-200',
    activeBg: 'bg-teal-800 text-white'
  },
  other: {
    label: 'অন্যান্য স্থায়ী সম্পদ',
    shortLabel: 'অন্যান্য',
    icon: '🏢',
    bg: 'bg-slate-50',
    text: 'text-slate-900',
    border: 'border-slate-200',
    activeBg: 'bg-slate-700 text-white'
  }
};

const QUICK_ACCOUNT_TYPE_CHIPS = [
  'বিকাশ',
  'নগদ',
  'রকেট',
  'ব্যাংক হিসাব',
  'নগদ ক্যাশ (হাতে)',
  'জমি দলিল',
  'স্বর্ণ ভল্ট',
  'ব্যবসা বিনিয়োগ'
];

interface SamityFundCustodyPanelProps {
  holdings: SamityFundHolding[];
  totalSamityCapital: number;
  onSaveHolding: (item: SamityFundHolding, isEdit: boolean) => Promise<void>;
  onDeleteHolding: (id: string) => Promise<void>;
}

export function SamityFundCustodyPanel({
  holdings,
  totalSamityCapital,
  onSaveHolding,
  onDeleteHolding
}: SamityFundCustodyPanelProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formAccountName, setFormAccountName] = useState('');
  const [formCategory, setFormCategory] = useState<SamityFundCategoryKey>('bank');
  const [formHolderName, setFormHolderName] = useState('');
  const [formAccountType, setFormAccountType] = useState('ব্যাংক হিসাব');
  const [formHolderPhone, setFormHolderPhone] = useState('');
  const [formAccountNumber, setFormAccountNumber] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formNote, setFormNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const totalCustodyCalculated = useMemo(
    () => holdings.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [holdings]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: holdings.length,
      land: 0,
      gold: 0,
      bank: 0,
      mfs: 0,
      business: 0,
      cash: 0,
      receivable: 0,
      other: 0
    };
    holdings.forEach((h) => {
      const k = h.category in c ? h.category : 'other';
      c[k] += 1;
    });
    return c;
  }, [holdings]);

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return holdings.filter((item) => {
      if (categoryFilter !== 'all' && (item.category || 'other') !== categoryFilter) return false;
      if (!q) return true;
      return (
        String(item.accountName || '').toLowerCase().includes(q) ||
        String(item.holderName || '').toLowerCase().includes(q) ||
        String(item.accountType || '').toLowerCase().includes(q) ||
        String(item.accountNumber || '').toLowerCase().includes(q) ||
        String(item.holderPhone || '').toLowerCase().includes(q) ||
        String(item.location || '').toLowerCase().includes(q) ||
        String(item.note || '').toLowerCase().includes(q)
      );
    });
  }, [holdings, categoryFilter, searchQuery]);

  const openAddForm = () => {
    setEditingId(null);
    setFormAccountName('');
    setFormCategory('bank');
    setFormHolderName('');
    setFormAccountType('ব্যাংক হিসাব');
    setFormHolderPhone('');
    setFormAccountNumber('');
    setFormLocation('');
    setFormAmount('');
    setFormNote('');
    setFormError(null);
    setShowEntryModal(true);
  };

  const openEditForm = (item: SamityFundHolding) => {
    setEditingId(item.id);
    setFormAccountName(item.accountName || '');
    setFormCategory(item.category || 'bank');
    setFormHolderName(item.holderName || '');
    setFormAccountType(item.accountType || '');
    setFormHolderPhone(item.holderPhone || '');
    setFormAccountNumber(item.accountNumber || '');
    setFormLocation(item.location || '');
    setFormAmount(String(item.amount ?? ''));
    setFormNote(item.note || '');
    setFormError(null);
    setShowEntryModal(true);
  };

  const handleCategoryPick = (cat: SamityFundCategoryKey) => {
    setFormCategory(cat);
    const defaultTypeMap: Record<SamityFundCategoryKey, string> = {
      land: 'জমি দলিল',
      gold: 'স্বর্ণ ভল্ট',
      bank: 'ব্যাংক হিসাব',
      mfs: 'বিকাশ / নগদ',
      business: 'ব্যবসা বিনিয়োগ',
      cash: 'নগদ ক্যাশ (হাতে)',
      receivable: 'ব্যক্তির নিকট গচ্ছিত',
      other: 'অন্যান্য'
    };
    if (!formAccountType || QUICK_ACCOUNT_TYPE_CHIPS.includes(formAccountType) || formAccountType === 'ব্যক্তির নিকট গচ্ছিত' || formAccountType === 'অন্যান্য' || formAccountType === 'বিকাশ / নগদ') {
      setFormAccountType(defaultTypeMap[cat]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formAccountName.trim()) {
      setFormError('অনুগ্রহ করে সম্পদ বা খাতের নাম লিখুন (যেমন: উত্তরা জমি ক্রয়, ইসলামী ব্যাংক, বিকাশ পার্সোনাল ইত্যাদি)।');
      return;
    }
    const cleanAmtStr = convertBengaliToEnglishDigits(formAmount).trim();
    const numAmount = Number(cleanAmtStr);
    if (!cleanAmtStr || !isFinite(numAmount) || numAmount < 0) {
      setFormError('অনুগ্রহ করে সঠিক টাকার পরিমাণ লিখুন।');
      return;
    }

    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const entry: SamityFundHolding = {
        id: editingId || `sf_${Date.now()}`,
        accountName: formAccountName.trim().slice(0, 180),
        category: formCategory,
        holderName: formHolderName.trim().slice(0, 140),
        accountType: formAccountType.trim().slice(0, 100),
        holderPhone: convertBengaliToEnglishDigits(formHolderPhone).trim().slice(0, 40),
        accountNumber: formAccountNumber.trim().slice(0, 120),
        location: formLocation.trim().slice(0, 160),
        amount: numAmount,
        note: formNote.trim().slice(0, 500),
        updatedAt: nowIso,
        createdAt: editingId ? undefined : nowIso
      };
      await onSaveHolding(entry, Boolean(editingId));
      setShowEntryModal(false);
      setSuccessMsg(
        editingId
          ? '✅ সমবায় পুঁজি ও সম্পদ এন্ট্রি সফলভাবে আপডেট হয়েছে!'
          : '✅ নতুন সমবায় পুঁজি / সম্পদ এন্ট্রি সফলভাবে যুক্ত হয়েছে!'
      );
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setFormError(err?.message || 'সংরক্ষণ করতে সমস্যা হয়েছে।');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async (id: string) => {
    try {
      await onDeleteHolding(id);
      setConfirmDeleteId(null);
      setSuccessMsg('🗑️ এন্ট্রিটি সফলভাবে মুছে ফেলা হয়েছে!');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setFormError(err?.message || 'মুছতে সমস্যা হয়েছে।');
    }
  };

  const handleCopy = (txt: string, id: string) => {
    if (!txt) return;
    navigator.clipboard?.writeText(txt).catch(() => null);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      {/* Big Amount Card & Add Button (matching screenshot header) */}
      <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
              সমিতির মোট হিসাবকৃত সম্পদ ও ফান্ড
            </span>
            <span className="text-xl sm:text-3xl font-black font-mono text-emerald-400 drop-shadow-sm">
              ৳{totalCustodyCalculated.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="pl-3 sm:pl-4 border-l border-slate-700">
            <span className="text-[10px] text-slate-400 block font-bold">মোট সম্পদ ও খাতের সংখ্যা</span>
            <span className="text-sm font-black font-mono text-amber-300">
              {holdings.length} টি খাত
            </span>
          </div>
          <div className="pl-3 sm:pl-4 border-l border-slate-700">
            <span className="text-[10px] text-slate-400 block font-bold">মোট সমিতি পুঁজি</span>
            <span className="text-sm font-black font-mono text-sky-300">
              ৳{Number(totalSamityCapital || 0).toLocaleString('en-US')}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={openAddForm}
          className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl text-xs font-black shadow-lg flex items-center justify-center gap-2 transition cursor-pointer shrink-0 active:scale-98 border border-emerald-400/30"
        >
          <Plus className="w-4 h-4" />
          <span>+ নতুন ফান্ড / সম্পদ এন্ট্রি যুক্ত করুন</span>
        </button>
      </div>

      {/* Save Success Alert */}
      {successMsg && (
        <div className="p-2.5 bg-emerald-50 border-b border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2 shrink-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Category Pills Filter Bar */}
      <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto shrink-0">
        <button
          type="button"
          onClick={() => setCategoryFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
            categoryFilter === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span>🌟 সকল খাত</span>
          <span className="px-1.5 py-0.2 bg-white/20 text-[10px] rounded-full font-mono">{counts.all}</span>
        </button>

        {(Object.keys(SAMITY_FUND_CATEGORY_MAP) as SamityFundCategoryKey[]).map((key) => {
          const info = SAMITY_FUND_CATEGORY_MAP[key];
          const active = categoryFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setCategoryFilter(key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border ${
                active
                  ? `${info.activeBg} border-transparent shadow-xs`
                  : `bg-white ${info.text} ${info.border} hover:opacity-90`
              }`}
            >
              <span>
                {info.icon} {info.shortLabel}
              </span>
              <span
                className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono ${
                  active ? 'bg-white/25 text-white' : `${info.bg} ${info.text}`
                }`}
              >
                {counts[key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="p-2.5 sm:p-3 bg-white border-b border-slate-100 flex justify-between items-center gap-2 shrink-0">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="সম্পদের নাম, কার কাছে আছে, বিকাশ/নগদ/ব্যাংক, দলিল নং বা বিবরণ দিয়ে খুঁজুন..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-teal-600 focus:bg-white transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1.5 py-0.5 rounded-md hover:bg-slate-100 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Asset Entries List */}
      <div className="overflow-y-auto flex-1 p-3 sm:p-4 space-y-3 bg-slate-50/50">
        {filteredList.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-3 bg-white rounded-2xl border border-dashed border-slate-300">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl font-bold">
              🏛️
            </div>
            <p className="text-xs font-bold text-slate-600">
              সমিতির টাকা কার কাছে, কোন একাউন্টে (বিকাশ/নগদ/ব্যাংক) বা কোন জমি/স্বর্ণে ইনভেস্ট আছে তা এখনো লেখা হয়নি!
            </p>
            <button
              type="button"
              onClick={openAddForm}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>প্রথম এন্ট্রি যুক্ত করুন</span>
            </button>
          </div>
        ) : (
          filteredList.map((item, idx) => {
            const catInfo = SAMITY_FUND_CATEGORY_MAP[item.category] || SAMITY_FUND_CATEGORY_MAP.other;
            const numberOrPhone = item.accountNumber || item.holderPhone || '';
            return (
              <div
                key={item.id || idx}
                className="bg-white border border-slate-200 hover:border-teal-500 rounded-2xl p-3.5 sm:p-4 shadow-2xs hover:shadow-md transition space-y-3 text-xs relative"
              >
                {/* Top Row: Index, Category Badge, Title & Amount */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-start sm:items-center gap-2 min-w-0 flex-wrap">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 font-mono font-black text-[10px] flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </span>

                    <span
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black border flex items-center gap-1 shrink-0 ${catInfo.bg} ${catInfo.text} ${catInfo.border}`}
                    >
                      <span>{catInfo.icon}</span>
                      <span>{catInfo.label}</span>
                    </span>

                    {item.accountType && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-sky-50 text-sky-900 border border-sky-200 shrink-0">
                        {item.accountType}
                      </span>
                    )}

                    <h4 className="font-black text-slate-900 text-sm truncate">
                      {item.accountName || 'নামহীন সম্পদ/খাত'}
                    </h4>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-400 block font-bold">টাকার পরিমাণ</span>
                    <span className="text-base sm:text-lg font-black font-mono text-emerald-600">
                      ৳{(Number(item.amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Middle Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-[11px] text-slate-600 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                  {/* Holder Name */}
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-teal-100 text-teal-800 flex items-center justify-center text-xs shrink-0">
                      👤
                    </span>
                    <div className="min-w-0">
                      <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">
                        কার কাছে আছে / কার নামে
                      </span>
                      <span className="font-bold text-slate-900 text-xs truncate block">
                        {item.holderName || 'অফিসিয়াল ফান্ড'}
                      </span>
                    </div>
                  </div>

                  {/* Account Type / Medium */}
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-sky-100 text-sky-800 flex items-center justify-center text-xs shrink-0">
                      💳
                    </span>
                    <div className="min-w-0">
                      <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">
                        অ্যাকাউন্ট / মাধ্যমের ধরন
                      </span>
                      <span className="font-bold text-slate-900 text-xs truncate block">
                        {item.accountType || catInfo.shortLabel}
                      </span>
                    </div>
                  </div>

                  {/* Deed / Account Number / Phone */}
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-800 flex items-center justify-center text-xs shrink-0">
                      📄
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">
                        দলিল / হিসাব / মোবাইল নং
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-slate-900 truncate block">
                          {numberOrPhone || 'তথ্য নেই'}
                          {item.accountNumber && item.holderPhone && item.accountNumber !== item.holderPhone
                            ? ` • ${item.holderPhone}`
                            : ''}
                        </span>
                        {numberOrPhone && (
                          <button
                            type="button"
                            onClick={() => handleCopy(numberOrPhone, item.id)}
                            className="text-slate-400 hover:text-teal-700 cursor-pointer shrink-0"
                            title="কপি করুন"
                          >
                            {copiedId === item.id ? (
                              <span className="text-[9px] font-black text-emerald-600">কপিড</span>
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Location */}
                  {item.location && (
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center text-xs shrink-0">
                        📍
                      </span>
                      <div className="min-w-0">
                        <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">
                          অবস্থান / শাখা / ঠিকানা
                        </span>
                        <span className="font-semibold text-slate-800 truncate block">
                          {item.location}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Note */}
                  {item.note && (
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <span className="w-6 h-6 rounded-md bg-purple-100 text-purple-800 flex items-center justify-center text-xs shrink-0">
                        📝
                      </span>
                      <div className="min-w-0">
                        <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">
                          বিবরণ / নোট
                        </span>
                        <span className="text-slate-700 break-words block">
                          {item.note}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Last updated */}
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-slate-200 text-slate-700 flex items-center justify-center text-xs shrink-0">
                      🕒
                    </span>
                    <div className="min-w-0">
                      <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">
                        সর্বশেষ আপডেট
                      </span>
                      <span className="font-mono text-slate-600 truncate block">
                        {item.updatedAt || 'সক্রিয়'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => openEditForm(item)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5 text-teal-700" />
                    <span>✏️ এডিট / পরিবর্তন</span>
                  </button>

                  {confirmDeleteId === item.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleConfirmDelete(item.id)}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black cursor-pointer"
                      >
                        নিশ্চিত মুছুন
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2.5 py-1.5 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        না
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(item.id)}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>🗑️ মুছুন</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Popup Form Modal */}
      {showEntryModal && (
        <div className="fixed inset-0 z-[10050] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 text-left">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 to-teal-950 p-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center text-lg font-bold shadow-md">
                  {editingId ? '✏️' : '➕'}
                </div>
                <div>
                  <h4 className="text-sm font-black">
                    {editingId ? 'সমবায় ফান্ড / সম্পদ এডিট করুন' : 'নতুন সমবায় ফান্ড / সম্পদ যুক্ত করুন'}
                  </h4>
                  <p className="text-[10px] text-teal-200">
                    টাকা কোথায় (জমি/স্বর্ণ/ব্যাংক/বিকাশ/নগদ) ও কার কাছে কত আছে তা লিখুন
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEntryModal(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-3 text-xs">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-[11px] font-bold">
                  ⚠️ {formError}
                </div>
              )}

              {/* 1. Title */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  সম্পদের নাম বা খাতের বিবরণ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formAccountName}
                  onChange={(e) => setFormAccountName(e.target.value)}
                  placeholder="যেমন: উত্তরা ৩ কাঠা জমি ক্রয় / ১০ ভরি স্বর্ণ / ভাইয়ের বিকাশ একাউন্ট / ইসলামী ব্যাংক"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:border-teal-600 focus:bg-white transition"
                />
              </div>

              {/* 2. Category */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  টাকা কোথায় রাখা বা ইনভেস্ট করা হয়েছে? <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(
                    [
                      { key: 'land', label: '🏞️ জমি ও সম্পত্তি' },
                      { key: 'gold', label: '🪙 স্বর্ণ ও সোনা' },
                      { key: 'bank', label: '🏦 ব্যাংক হিসাব' },
                      { key: 'mfs', label: '📱 বিকাশ / নগদ' },
                      { key: 'business', label: '💼 ব্যবসা বিনিয়োগ' },
                      { key: 'cash', label: '💵 নগদ ক্যাশ' },
                      { key: 'receivable', label: '🤝 অন্যের কাছে গচ্ছিত' },
                      { key: 'other', label: '🏢 অন্যান্য' }
                    ] as Array<{ key: SamityFundCategoryKey; label: string }>
                  ).map((cat) => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => handleCategoryPick(cat.key)}
                      className={`px-2 py-2 rounded-xl text-[10.5px] font-bold border transition text-center cursor-pointer ${
                        formCategory === cat.key
                          ? 'bg-teal-900 text-white border-teal-900 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Amount & Holder Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    টাকার পরিমাণ (৳) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="যেমন: 500000"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-emerald-700 focus:outline-none focus:border-teal-600 focus:bg-white text-sm transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    কার কাছে আছে / কার একাউন্ট (নাম)
                  </label>
                  <input
                    type="text"
                    value={formHolderName}
                    onChange={(e) => setFormHolderName(e.target.value)}
                    placeholder="যেমন: মোঃ রহিম উদ্দিন / অফিসিয়াল ফান্ড"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:border-teal-600 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* 4. Account Type / Medium (বিকাশ, নগদ, ব্যাংক, জমি, স্বর্ণ) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  কি একাউন্ট / মাধ্যম (বিকাশে না ব্যাংকে, নাকি জমি/স্বর্ণ)
                </label>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {QUICK_ACCOUNT_TYPE_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setFormAccountType(chip)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border cursor-pointer transition ${
                        formAccountType === chip
                          ? 'bg-sky-700 text-white border-sky-700'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={formAccountType}
                  onChange={(e) => setFormAccountType(e.target.value)}
                  placeholder="যেমন: বিকাশ পার্সোনাল / ডাচ-বাংলা ব্যাংক / জমি বায়না দলিল / ২২ ক্যারেট স্বর্ণ"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:border-teal-600 focus:bg-white transition"
                />
              </div>

              {/* 5. Account/Deed Number & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    দলিল নং / ব্যাংক একাউন্ট / বিকাশ নং
                  </label>
                  <input
                    type="text"
                    value={formAccountNumber}
                    onChange={(e) => setFormAccountNumber(e.target.value)}
                    placeholder="যেমন: 01712345678 বা A/C: 20501234"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-medium focus:outline-none focus:border-teal-600 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    দায়িত্বপ্রাপ্ত ব্যক্তির মোবাইল নম্বর
                  </label>
                  <input
                    type="text"
                    value={formHolderPhone}
                    onChange={(e) => setFormHolderPhone(e.target.value)}
                    placeholder="যেমন: 01800000000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-medium focus:outline-none focus:border-teal-600 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* 6. Location */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  অবস্থান / ব্যাংকের শাখা / ঠিকানা
                </label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="যেমন: উত্তরা সেক্টর ১১ / মতিঝিল শাখা / হেড অফিস ভল্ট"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:border-teal-600 focus:bg-white transition"
                />
              </div>

              {/* 7. Note */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  বিস্তারিত বিবরণ বা বিশেষ নোট
                </label>
                <textarea
                  rows={2}
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="যেমন: সমিতির টাকায় ৩ কাঠা জমি কেনা হয়েছে / ১০ ভরি স্বর্ণ লকারে জমা / জরুরি ক্যাশ"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:outline-none focus:border-teal-600 focus:bg-white transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEntryModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#008769] hover:bg-[#006e55] disabled:opacity-60 text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'সংরক্ষণ হচ্ছে...' : editingId ? 'আপডেট সেভ করুন' : 'এন্ট্রি সংরক্ষণ করুন'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
