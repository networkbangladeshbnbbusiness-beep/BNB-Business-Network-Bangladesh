import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  getDocs
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { saveAppConfig } from '../../lib/config';
import { convertBengaliToEnglishDigits } from '../../lib/memberUtils';
import { SAMITY_MONTHS, SAMITY_YEARS, getEffectivePaidMonthsList } from '../../types';
import {
  isRegisteredSamityInvestor,
  getSamityMonthlyRate,
  getSamityMemberTier,
  isSamitySwitchOff,
  SamityTierKey
} from '../../lib/samityCategory';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  PieChart,
  Search,
  Settings,
  RotateCcw,
  Save,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  SlidersHorizontal,
  Users,
  Calendar
} from 'lucide-react';

export type AuditSectionKey =
  | 'samity'
  | 'safedeals_admin'
  | 'qard_admin'
  | 'bank_admin'
  | 'telecom'
  | 'ration_admin'
  | 'salary_admin'
  | 'safi_admin'
  | 'auto_recharge_admin'
  | 'bill_pay_admin'
  | 'agent_admin'
  | 'notices';

export const ALL_AUDIT_SECTION_KEYS: AuditSectionKey[] = [
  'samity',
  'safedeals_admin',
  'qard_admin',
  'bank_admin',
  'telecom',
  'ration_admin',
  'salary_admin',
  'safi_admin',
  'auto_recharge_admin',
  'bill_pay_admin',
  'agent_admin',
  'notices'
];

export type AuditEntryType = 'expense' | 'profit' | 'loss' | 'revenue';

export type SamityCustodyChannel = 'bank' | 'bkash' | 'nagad' | 'cash' | 'rocket' | 'other';

export interface SamityCustodyEntry {
  id: string;
  holderName: string;
  channel: SamityCustodyChannel;
  accountInfo?: string;
  amount: number;
  note?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SectionAuditEntry {
  id: string;
  sectionKey: AuditSectionKey;
  entryType: AuditEntryType;
  title: string;
  amount: number;
  category?: string;
  note?: string;
  monthKey?: string; // e.g., '2026-nov'
  memberName?: string;
  entryDate: string; // YYYY-MM-DD
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AutoAuditItem {
  id: string;
  sectionKey: AuditSectionKey;
  title: string;
  subtitle: string;
  entryType: AuditEntryType;
  amount: number;
  dateIso: string;
  sourceLabel: string;
}

export interface SectionMeta {
  key: AuditSectionKey;
  indexNum: number;
  numberBn: string;
  shortTitle: string;
  title: string;
  badge: string;
  emoji: string;
  boxBgClass: string;
  boxTextClass: string;
  expenseCategories: string[];
}

export const SECTION_META_MAP: Record<AuditSectionKey, SectionMeta> = {
  samity: {
    key: 'samity',
    indexNum: 1,
    numberBn: '১',
    shortTitle: '1. সমবায় পোর্টাল',
    title: 'BNB কোম্পানি ইনভেস্টর (সমবায় ও মূলধন অডিট)',
    badge: 'সমবায় অডিট',
    emoji: '🏛️',
    boxBgClass: 'bg-teal-50/95 border-teal-200 hover:bg-teal-100/90',
    boxTextClass: 'text-teal-950',
    expenseCategories: ['মাসিক পুঁজি জমা', 'অতিরিক্ত পুঁজি যোগ', 'প্রজেক্ট ক্রয় / বিনিয়োগ', 'সদস্য সঞ্চয় রিফান্ড', '২৫ ডিসেম্বর উত্তোলন', 'তহবিল সমন্বয়']
  },
  safedeals_admin: {
    key: 'safedeals_admin',
    indexNum: 2,
    numberBn: '২',
    shortTitle: '2. নিরাপদ লেনদেন',
    title: 'BNB নিরাপদ লেনদেন (গ্রুপ বাই ডিল)',
    badge: 'নিরাপদ ডিল অডিট',
    emoji: '🛡️',
    boxBgClass: 'bg-emerald-50/95 border-emerald-200 hover:bg-emerald-100/90',
    boxTextClass: 'text-emerald-950',
    expenseCategories: ['ডিল ক্রয়/সাপ্লায়ার পেমেন্ট', 'ডিসপিউট রিফান্ড/ক্ষতি', 'ডেলিভারি/লজিস্টিকস', 'প্রচারণা খরচ', 'অন্যান্য খরচ']
  },
  qard_admin: {
    key: 'qard_admin',
    indexNum: 3,
    numberBn: '৩',
    shortTitle: '3. কর্জে হাসানা',
    title: 'BNB কর্জে হাসানা (সুদমুক্ত ঋণ)',
    badge: 'কর্জে হাসানা অডিট',
    emoji: '🤝',
    boxBgClass: 'bg-rose-50/95 border-rose-200 hover:bg-rose-100/90',
    boxTextClass: 'text-rose-950',
    expenseCategories: ['ঋণ মওকুফ/অনাদায়ী ক্ষতি', 'তহবিল সহায়তা ব্যয়', 'ডকুমেন্টেশন ও যাচাই খরচ', 'স্বাস্থ্য/ত্রাণ বিতরণ', 'অন্যান্য খরচ']
  },
  bank_admin: {
    key: 'bank_admin',
    indexNum: 4,
    numberBn: '৪',
    shortTitle: '4. BNB লেনদেন',
    title: 'BNB লেনদেন (রেমিট্যান্স & ব্যাংকিং)',
    badge: 'ব্যাংকিং অডিট',
    emoji: '💳',
    boxBgClass: 'bg-amber-50/95 border-amber-200 hover:bg-amber-100/90',
    boxTextClass: 'text-amber-950',
    expenseCategories: ['ব্যাংক/MFS গেটওয়ে চার্জ', 'রেমিট্যান্স ভর্তুকি', 'ক্যাশআউট/উত্তোলন খরচ', 'রিফান্ড ও সমন্বয়', 'অন্যান্য খরচ']
  },
  telecom: {
    key: 'telecom',
    indexNum: 5,
    numberBn: '৫',
    shortTitle: '5. BNB টেলিকম',
    title: 'BNB টেলিকম (রিচার্জ ও ড্রাইভ প্যাক)',
    badge: 'টেলিকম অডিট',
    emoji: '📱',
    boxBgClass: 'bg-sky-50/95 border-sky-200 hover:bg-sky-100/90',
    boxTextClass: 'text-sky-950',
    expenseCategories: ['সিম/হাউস ব্যালেন্স ক্রয়', 'ক্যাশব্যাক প্রদান', 'ড্রাইভ অফার লস/ভর্তুকি', 'সার্ভার ও API খরচ', 'অন্যান্য খরচ']
  },
  ration_admin: {
    key: 'ration_admin',
    indexNum: 6,
    numberBn: '৬',
    shortTitle: '6. রেশন কার্ড',
    title: 'BNB রেশন কার্ড (কার্ড ও ভর্তুকি)',
    badge: 'রেশন কার্ড অডিট',
    emoji: '🪪',
    boxBgClass: 'bg-yellow-50/95 border-yellow-200 hover:bg-yellow-100/90',
    boxTextClass: 'text-yellow-950',
    expenseCategories: ['রেশন পণ্য ক্রয়', 'কার্ড প্রিন্টিং ও সরবরাহ', 'ভর্তুকি/সাবসিডি লস', 'পরিবহন ও গুদাম খরচ', 'অন্যান্য খরচ']
  },
  salary_admin: {
    key: 'salary_admin',
    indexNum: 7,
    numberBn: '৭',
    shortTitle: '7. সেলারি পে',
    title: 'BNB সেলারি পে (কর্মী বেতন)',
    badge: 'স্যালারি পে অডিট',
    emoji: '💼',
    boxBgClass: 'bg-teal-50/95 border-teal-200 hover:bg-teal-100/90',
    boxTextClass: 'text-teal-950',
    expenseCategories: ['মাসিক কর্মী বেতন', 'বোনাস ও ওভারটাইম', 'ভাতা ও টিএ/ডিএ', 'গেটওয়ে চার্জ', 'অন্যান্য খরচ']
  },
  safi_admin: {
    key: 'safi_admin',
    indexNum: 8,
    numberBn: '৮',
    shortTitle: '8. al safi শপ',
    title: 'al safi (ইন-হাউস ব্র্যান্ড ও শপ)',
    badge: 'সাফি ব্র্যান্ড অডিট',
    emoji: '🛍️',
    boxBgClass: 'bg-orange-50/95 border-orange-200 hover:bg-orange-100/90',
    boxTextClass: 'text-orange-950',
    expenseCategories: ['পণ্য ক্রয়/উৎপাদন খরচ', 'প্যাকেজিং ও কুরিয়ার', 'রিটার্ন/ড্যামেজ লস', 'মার্কেটিং ও প্রচারণা', 'অন্যান্য খরচ']
  },
  auto_recharge_admin: {
    key: 'auto_recharge_admin',
    indexNum: 9,
    numberBn: '৯',
    shortTitle: '9. অটো রিচার্জ',
    title: 'BNB অটো রিচার্জ (গেটওয়ে)',
    badge: 'অটো রিচার্জ অডিট',
    emoji: '⚡',
    boxBgClass: 'bg-cyan-50/95 border-cyan-200 hover:bg-cyan-100/90',
    boxTextClass: 'text-cyan-950',
    expenseCategories: ['রিচার্জ সার্ভার/API লোড', 'ফেইল্ড রিফান্ড/লস', 'কমিশন ভর্তুকি', 'সিম মডেম/হোস্টিং বিল', 'অন্যান্য খরচ']
  },
  bill_pay_admin: {
    key: 'bill_pay_admin',
    indexNum: 10,
    numberBn: '১০',
    shortTitle: '10. BNB বিল পে',
    title: 'BNB বিল পে (ইউটিলিটি বিল)',
    badge: 'বিল পে অডিট',
    emoji: '🧾',
    boxBgClass: 'bg-purple-50/95 border-purple-200 hover:bg-purple-100/90',
    boxTextClass: 'text-purple-950',
    expenseCategories: ['ইউটিলিটি প্রোভাইডার সেটেলমেন্ট', 'গেটওয়ে ফি/খরচ', 'রিফান্ড/পেনাল্টি লস', 'সাপোর্ট ও সমন্বয়', 'অন্যান্য খরচ']
  },
  agent_admin: {
    key: 'agent_admin',
    indexNum: 11,
    numberBn: '১১',
    shortTitle: '11. BNB এজেন্ট',
    title: 'BNB এজেন্ট (এজেন্ট পোর্টাল)',
    badge: 'এজেন্ট অডিট',
    emoji: '🏪',
    boxBgClass: 'bg-amber-50/95 border-amber-200 hover:bg-amber-100/90',
    boxTextClass: 'text-amber-950',
    expenseCategories: ['এজেন্ট কমিশন ও বোনাস', 'এজেন্ট ফি রিফান্ড', 'ভেরিফিকেশন/ব্র্যান্ডিং কিট', 'সাপোর্ট খরচ', 'অন্যান্য খরচ']
  },
  notices: {
    key: 'notices',
    indexNum: 12,
    numberBn: '১২',
    shortTitle: '12. আমাদের লক্ষ্য',
    title: 'BNB আমাদের লক্ষ্য (পরিচিতি ও গাইড)',
    badge: 'কর্পোরেট অডিট',
    emoji: '🎯',
    boxBgClass: 'bg-indigo-50/95 border-indigo-200 hover:bg-indigo-100/90',
    boxTextClass: 'text-indigo-950',
    expenseCategories: ['প্রমোশনাল বোনাস প্রদান', 'নোটিশ ও ব্রডকাস্ট খরচ', 'ইভেন্ট ও প্রচারণা', 'অফিস আপ্যায়ন ও অন্যান্য', 'অন্যান্য খরচ']
  }
};

export function normalizeAuditSectionKey(adminTab: string): AuditSectionKey | null {
  if (adminTab === 'general') return 'samity';
  if (adminTab === 'shop_admin') return 'safi_admin';
  if (adminTab in SECTION_META_MAP) {
    return adminTab as AuditSectionKey;
  }
  return null;
}

function getTxAmount(t: any): number {
  return Math.max(0, Number(t?.amount || t?.totalAmount || t?.price || 0) || 0);
}

function getTxProfit(t: any): number {
  return Math.max(
    0,
    Number(t?.adminProfit || t?.companyProfit || t?.profitAmount || t?.profit || 0) || 0
  );
}

function getTxFee(t: any): number {
  return Math.max(0, Number(t?.charge || t?.fee || t?.serviceCharge || 0) || 0);
}

function getTxLoss(t: any): number {
  return Math.max(0, Number(t?.lossAmount || t?.loss || t?.subsidyAmount || 0) || 0);
}

function isTxSuccessful(t: any): boolean {
  const s = String(t?.status || '').toLowerCase();
  return (
    s === 'success' ||
    s === 'approved' ||
    s === 'completed' ||
    s === 'delivered' ||
    s === 'paid' ||
    t?.isApproved === true
  );
}

function parseIsoDate(raw: any): Date | null {
  if (!raw) return null;
  if (typeof raw?.toDate === 'function') {
    const d = raw.toDate();
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === 'number') {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  const str = String(raw).trim();
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function matchesAuditDateFilter(dateIso: string, period: 'all' | 'today' | 'month' | '7d'): boolean {
  if (period === 'all') return true;
  const d = parseIsoDate(dateIso);
  if (!d) return false;
  const now = new Date();
  if (period === 'today') {
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }
  if (period === 'month') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  if (period === '7d') {
    const diff = now.getTime() - d.getTime();
    return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  }
  return true;
}

export function formatEngBDT(amount: number): string {
  const n = Number(amount || 0);
  return `৳${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}`;
}

export interface SectionComputedStats {
  sectionKey: AuditSectionKey;
  autoItems: AutoAuditItem[];
  manualEntries: SectionAuditEntry[];
  autoRevenue: number;
  autoProfit: number;
  autoLoss: number;
  autoExpense: number;
  manualRevenue: number;
  manualProfit: number;
  manualLoss: number;
  manualExpense: number;
  combinedRevenue: number;
  combinedProfit: number;
  combinedLoss: number;
  combinedExpense: number;
  effectiveRevenue: number;
  effectiveProfit: number;
  effectiveLoss: number;
  effectiveExpense: number;
  isOverrideRevenue: boolean;
  isOverrideProfit: boolean;
  isOverrideLoss: boolean;
  isOverrideExpense: boolean;
  hasAnyOverride: boolean;
  netResult: number;
}

const LOCAL_AUDIT_CACHE_KEY = 'bnb_section_audits_v2';
const LOCAL_CUSTODY_CACHE_KEY = 'bnb_samity_custody_v1';

function readCachedAuditEntries(): SectionAuditEntry[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(LOCAL_AUDIT_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCachedAuditEntries(entries: SectionAuditEntry[]) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_AUDIT_CACHE_KEY, JSON.stringify(entries));
    }
  } catch {
    // Ignore storage quota issues
  }
}

function readCachedCustodyEntries(): SamityCustodyEntry[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(LOCAL_CUSTODY_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCachedCustodyEntries(entries: SamityCustodyEntry[]) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_CUSTODY_CACHE_KEY, JSON.stringify(entries));
    }
  } catch {
    // Ignore storage quota issues
  }
}

export interface SectionAuditsEngineParams {
  transactions?: any[];
  users?: any[];
  appConfig?: any;
  onChangeConfig?: (cfg: any) => void;
  currentUser?: any;
  adminAgentRequests?: any[];
  broadcastLogs?: any[];
  companyExpenses?: any[];
}

export function useSectionAuditsEngine({
  transactions = [],
  users = [],
  appConfig,
  onChangeConfig,
  currentUser,
  adminAgentRequests = [],
  broadcastLogs = [],
  companyExpenses = []
}: SectionAuditsEngineParams) {
  const [allManualEntries, setAllManualEntries] = useState<SectionAuditEntry[]>(() =>
    readCachedAuditEntries()
  );
  const [loadingEntries, setLoadingEntries] = useState<boolean>(false);

  // Supplemental real collections for accurate 12-section auto calculation
  const [samityInvestments, setSamityInvestments] = useState<any[]>([]);
  const [samityCustodyEntries, setSamityCustodyEntries] = useState<SamityCustodyEntry[]>(() =>
    readCachedCustodyEntries()
  );
  const [safeDealOrders, setSafeDealOrders] = useState<any[]>([]);
  const [escrowDisputes, setEscrowDisputes] = useState<any[]>([]);
  const [rationOrders, setRationOrders] = useState<any[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<any[]>([]);
  const [shopOrders, setShopOrders] = useState<any[]>([]);

  // 1. Single real-time Firestore listener on `section_audits` for all 12 sections
  useEffect(() => {
    if (!db) return;
    setLoadingEntries(true);
    const colRef = collection(db, 'section_audits');
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const list: SectionAuditEntry[] = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((item) => item && item.sectionKey in SECTION_META_MAP)
          .sort((a, b) => {
            const da = String(b.entryDate || b.createdAt || '');
            const dbStr = String(a.entryDate || a.createdAt || '');
            return da.localeCompare(dbStr);
          });
        setAllManualEntries(list);
        writeCachedAuditEntries(list);
        setLoadingEntries(false);
      },
      (err) => {
        setLoadingEntries(false);
        try {
          handleFirestoreError(err, OperationType.GET, 'section_audits');
        } catch {
          // Logged by handleFirestoreError; keep UI alive with cached entries
        }
      }
    );
    return () => unsub();
  }, []);

  // 1b. Real-time Firestore listener on `samity_investments` so Samity 8-card audit updates immediately
  useEffect(() => {
    if (!db) return;
    const unsubInv = onSnapshot(
      collection(db, 'samity_investments'),
      (snap) => {
        setSamityInvestments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      () => {
        // Non-fatal fallback
      }
    );
    return () => unsubInv();
  }, []);

  // 1c. Real-time Firestore listener on `samity_fund_custody` (কার কাছে কোথায় কত পুঁজি আছে)
  useEffect(() => {
    if (!db) return;
    const unsubCust = onSnapshot(
      collection(db, 'samity_fund_custody'),
      (snap) => {
        const list: SamityCustodyEntry[] = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
        setSamityCustodyEntries(list);
        writeCachedCustodyEntries(list);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.GET, 'samity_fund_custody');
        } catch {
          // Non-fatal fallback to cached entries
        }
      }
    );
    return () => unsubCust();
  }, []);

  // 2. Real-time listeners for Safe Deals orders & disputes + background supplemental load
  useEffect(() => {
    if (!db) return;
    let active = true;
    const unsubOrders = onSnapshot(
      collection(db, 'safe_deal_orders'),
      (snap) => {
        if (!active) return;
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        setSafeDealOrders(list);
      },
      () => {
        // Non-fatal listener fallback
      }
    );
    const unsubDisputes = onSnapshot(
      collection(db, 'escrow_disputes'),
      (snap) => {
        if (!active) return;
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .sort((a, b) => (Number(b.serialNo || 0) - Number(a.serialNo || 0)) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        setEscrowDisputes(list);
      },
      () => {
        // Non-fatal listener fallback
      }
    );

    const loadAllSupplemental = async () => {
      try {
        const [ratSnap, salSnap, shopSnap] = await Promise.all([
          getDocs(collection(db, 'ration_orders')).catch(() => null),
          getDocs(collection(db, 'salary_payments')).catch(() => null),
          getDocs(collection(db, 'shop_orders')).catch(() => null)
        ]);
        if (!active) return;
        if (ratSnap) setRationOrders(ratSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        if (salSnap) setSalaryPayments(salSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        if (shopSnap) setShopOrders(shopSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch {
        // Non-fatal supplemental load
      }
    };
    loadAllSupplemental();
    return () => {
      active = false;
      unsubOrders();
      unsubDisputes();
    };
  }, []);

  // 3. Build AutoAuditItems grouped across all 12 sections
  const autoItemsBySection = useMemo<Record<AuditSectionKey, AutoAuditItem[]>>(() => {
    const map: Record<AuditSectionKey, AutoAuditItem[]> = {
      samity: [],
      safedeals_admin: [],
      qard_admin: [],
      bank_admin: [],
      telecom: [],
      ration_admin: [],
      salary_admin: [],
      safi_admin: [],
      auto_recharge_admin: [],
      bill_pay_admin: [],
      agent_admin: [],
      notices: []
    };

    const txDate = (t: any) =>
      String(t?.createdAt || t?.updatedAt || t?.date || new Date().toISOString());

    const pushItem = (
      sec: AuditSectionKey,
      id: string,
      entryType: AuditEntryType,
      amount: number,
      title: string,
      subtitle: string,
      dateIso: string,
      sourceLabel: string
    ) => {
      if (amount <= 0) return;
      map[sec].push({
        id,
        sectionKey: sec,
        title,
        subtitle,
        entryType,
        amount,
        dateIso,
        sourceLabel
      });
    };

    // Single pass through transactions to classify cleanly into the 12 sections
    transactions.forEach((t, idx) => {
      const type = String(t?.type || '').toLowerCase();
      const cat = String(t?.category || '').toLowerCase();
      const baseId = String(t?.id || `tx_${idx}`);
      const dIso = txDate(t);
      const sub = `${t?.userName || t?.senderName || 'সদস্য'} • ${t?.typeLabel || t?.type || ''}`.trim();
      const amt = getTxAmount(t);
      const profit = getTxProfit(t);
      const fee = getTxFee(t);
      const loss = getTxLoss(t);
      const ok = isTxSuccessful(t);

      // 9. Auto Recharge
      if (type.includes('auto_recharge') || type.includes('autorecharge') || cat.includes('auto_recharge')) {
        const st = String(t?.status || '').toLowerCase();
        if (st === 'failed' || st === 'refunded') {
          pushItem('auto_recharge_admin', `${baseId}_loss`, 'loss', amt, 'অটো রিচার্জ ফেইল্ড/রিফান্ড', sub, dIso, 'অটো রিচার্জ');
        } else if (ok) {
          pushItem('auto_recharge_admin', `${baseId}_rev`, 'revenue', amt, t.typeLabel || 'অটো রিচার্জ সফল', sub, dIso, 'অটো রিচার্জ');
          if (profit + fee > 0) {
            pushItem('auto_recharge_admin', `${baseId}_prof`, 'profit', profit + fee, 'অটো রিচার্জ কমিশন লাভ', sub, dIso, 'অটো রিচার্জ');
          }
        }
        return;
      }

      // 10. Bill Pay
      if (type.includes('bill_pay') || type.includes('billpay') || cat.includes('bill_pay')) {
        if (!ok) return;
        pushItem('bill_pay_admin', `${baseId}_rev`, 'revenue', amt, t.typeLabel || 'ইউটিলিটি বিল কালেকশন', sub, dIso, 'BNB বিল পে');
        if (fee + profit > 0) {
          pushItem('bill_pay_admin', `${baseId}_prof`, 'profit', fee + profit, 'বিল পে সার্ভিস চার্জ/লাভ', sub, dIso, 'BNB বিল পে');
        }
        return;
      }

      // 2. Safe Deals
      if (type.includes('safe_deal') || type.includes('escrow') || cat.includes('safe_deal') || cat.includes('escrow')) {
        if (!ok) return;
        if (type.includes('refund') || cat.includes('refund')) {
          pushItem('safedeals_admin', `${baseId}_loss`, 'loss', amt, t.typeLabel || 'নিরাপদ ডিল রিফান্ড/ক্ষতি', sub, dIso, 'এসক্রো ডিল');
        } else {
          pushItem('safedeals_admin', `${baseId}_rev`, 'revenue', amt, t.typeLabel || 'নিরাপদ ডিল লেনদেন', sub, dIso, 'এসক্রো ডিল');
          if (profit + fee > 0) {
            pushItem('safedeals_admin', `${baseId}_prof`, 'profit', profit + fee, 'ডিল কমিশন ও সার্ভিস ফি', sub, dIso, 'এসক্রো ডিল');
          }
        }
        return;
      }

      // 3. Qard Hasana & Sadaqah Jariyah
      if (
        type.includes('qard') ||
        type === 'gold_loan' ||
        type === 'coop_instant_loan' ||
        type === 'general_charity' ||
        type === 'general_charity_donation' ||
        type === 'general_charity_disbursed' ||
        type === 'sadaqah_disbursement' ||
        type === 'donation' ||
        cat.includes('qard') ||
        cat === 'general_charity' ||
        cat === 'charity_disbursement' ||
        cat === 'charity_aid'
      ) {
        if (!ok) return;
        if (type === 'qard_donation' || type === 'qard_loan_repayment') {
          pushItem(
            'qard_admin',
            `${baseId}_rev`,
            'revenue',
            amt,
            type === 'qard_loan_repayment' ? 'ঋণ কিস্তি ফেরত (Repayment)' : 'কর্জে হাসানা তহবিল সংগ্রহ',
            sub,
            dIso,
            'কর্জে হাসানা'
          );
          if (fee + profit > 0) {
            pushItem('qard_admin', `${baseId}_prof`, 'profit', fee + profit, 'কর্জে হাসানা সার্ভিস চার্জ', sub, dIso, 'কর্জে হাসানা');
          }
        } else if (
          type === 'general_charity_donation' ||
          type === 'general_charity' ||
          type === 'donation' ||
          cat === 'general_charity'
        ) {
          pushItem(
            'qard_admin',
            `${baseId}_rev`,
            'revenue',
            amt,
            'সদকায়ে জারিয়া / মানবিক দান সংগ্রহ',
            sub,
            dIso,
            'সদকায়ে জারিয়া'
          );
        } else if (
          type === 'general_charity_disbursed' ||
          type === 'sadaqah_disbursement' ||
          cat === 'charity_disbursement' ||
          cat === 'charity_aid'
        ) {
          pushItem(
            'qard_admin',
            `${baseId}_exp`,
            'expense',
            amt,
            t.typeLabel || 'সদকায়ে জারিয়া দান বিতরণ',
            sub,
            dIso,
            'সদকায়ে জারিয়া'
          );
        } else if (type.includes('fine') || type.includes('penalty') || cat.includes('fine')) {
          pushItem('qard_admin', `${baseId}_prof`, 'profit', amt, 'বিলম্ব জরিমানা সংগ্রহ', sub, dIso, 'কর্জে হাসানা');
        } else if (type.includes('disburs') || type.includes('withdraw') || type === 'coop_instant_loan' || type === 'gold_loan') {
          pushItem('qard_admin', `${baseId}_exp`, 'expense', amt, t.typeLabel || 'ঋণ বিতরণ (Disbursement)', sub, dIso, 'কর্জে হাসানা');
          if (fee + profit > 0) {
            pushItem('qard_admin', `${baseId}_prof`, 'profit', fee + profit, 'ঋণ প্রসেসিং ফি', sub, dIso, 'কর্জে হাসানা');
          }
        }
        return;
      }

      // 5. Telecom
      if (
        type === 'telecom' ||
        type === 'telecom_recharge' ||
        type === 'recharge' ||
        type === 'prepaid' ||
        type === 'postpaid' ||
        cat.includes('telecom')
      ) {
        if (!ok) return;
        const cb = Math.max(0, Number(t?.rechargeCashback || 0) || 0);
        pushItem('telecom', `${baseId}_rev`, 'revenue', amt, `${String(t.operator || 'টেলিকম').toUpperCase()} রিচার্জ/প্যাক বিক্রয়`, sub, dIso, 'BNB টেলিকম');
        if (profit + fee > 0) {
          pushItem('telecom', `${baseId}_prof`, 'profit', profit + fee, 'টেলিকম ড্রাইভ/রিচার্জ লাভ', sub, dIso, 'BNB টেলিকম');
        }
        if (cb > 0) {
          pushItem('telecom', `${baseId}_exp`, 'expense', cb, 'সদস্য রিচার্জ ক্যাশব্যাক ব্যয়', sub, dIso, 'BNB টেলিকম');
        }
        return;
      }

      // 6. Ration Card
      if (type.includes('ration') || cat.includes('ration')) {
        if (!ok) return;
        pushItem('ration_admin', `${baseId}_rev`, 'revenue', amt, t.typeLabel || 'রেশন কার্ড ফি / বিক্রয়', sub, dIso, 'BNB রেশন');
        if (profit > 0) pushItem('ration_admin', `${baseId}_prof`, 'profit', profit, 'রেশন সার্ভিস ফি/লাভ', sub, dIso, 'BNB রেশন');
        if (loss > 0) pushItem('ration_admin', `${baseId}_loss`, 'loss', loss, 'রেশন ভর্তুকি লোকসান', sub, dIso, 'BNB রেশন');
        return;
      }

      // 7. Salary Pay
      if (type.includes('salary') || cat.includes('salary')) {
        if (!ok) return;
        pushItem('salary_admin', `${baseId}_exp`, 'expense', amt, t.typeLabel || 'কর্মী বেতন পরিশোধ', sub, dIso, 'স্যালারি পে');
        if (fee > 0) pushItem('salary_admin', `${baseId}_prof`, 'profit', fee, 'স্যালারি প্রসেসিং চার্জ', sub, dIso, 'স্যালারি পে');
        return;
      }

      // 8. Safi Brand & Shop
      if (type.includes('shop') || type.includes('safi') || cat.includes('shop') || cat.includes('safi')) {
        if (!ok) return;
        pushItem('safi_admin', `${baseId}_rev`, 'revenue', amt, t.typeLabel || 'সাফি পণ্য বিক্রয়', sub, dIso, 'al safi শপ');
        if (profit > 0) pushItem('safi_admin', `${baseId}_prof`, 'profit', profit, 'সাফি পণ্যে অর্জিত লাভ', sub, dIso, 'al safi শপ');
        if (loss > 0) pushItem('safi_admin', `${baseId}_loss`, 'loss', loss, 'সাফি রিটার্ন/ডিসকাউন্ট ক্ষতি', sub, dIso, 'al safi শপ');
        return;
      }

      // 11. Agent Portal
      if (type.includes('agent') || cat.includes('agent')) {
        if (!ok) return;
        if (type.includes('refund') || cat.includes('refund')) {
          pushItem('agent_admin', `${baseId}_exp`, 'expense', amt, 'এজেন্ট আবেদন ফি রিফান্ড', sub, dIso, 'BNB এজেন্ট');
        } else if (type.includes('commission') || type.includes('payout')) {
          pushItem('agent_admin', `${baseId}_exp`, 'expense', amt, 'এজেন্ট কমিশন পরিশোধ', sub, dIso, 'BNB এজেন্ট');
        } else {
          pushItem('agent_admin', `${baseId}_rev`, 'revenue', amt, t.typeLabel || 'এজেন্ট নিবন্ধন ফি (৳100)', sub, dIso, 'BNB এজেন্ট');
          pushItem('agent_admin', `${baseId}_prof`, 'profit', profit > 0 ? profit : amt, 'এজেন্ট পোর্টাল আয়/লাভ', sub, dIso, 'BNB এজেন্ট');
        }
        return;
      }

      // 1. Samity Portal
      if (
        type.includes('samity') ||
        cat.includes('samity') ||
        type === 'deposit' ||
        type === 'coop_savings_deposit' ||
        cat === 'samity_withdraw'
      ) {
        if (!ok) return;
        if (type === 'withdraw' || type === 'samity_release' || cat.includes('withdraw') || cat.includes('refund')) {
          pushItem('samity', `${baseId}_exp`, 'expense', amt, t.typeLabel || 'সমিতি সঞ্চয় উত্তোলন/রিফান্ড', sub, dIso, 'সমবায় ট্রানজেকশন');
        } else {
          pushItem('samity', `${baseId}_rev`, 'revenue', amt, t.typeLabel || 'সমবায় কিস্তি / পুঁজি জমা', sub, dIso, 'সমবায় ট্রানজেকশন');
        }
        return;
      }

      // 4. Bank & Remittance
      if (
        type === 'add_money' ||
        type === 'send_money' ||
        type === 'transfer' ||
        type === 'remittance' ||
        type === 'withdraw' ||
        type === 'money_exchange' ||
        type === 'fee' ||
        type === 'fee_payment'
      ) {
        if (!ok) return;
        if (type === 'withdraw') {
          pushItem('bank_admin', `${baseId}_exp`, 'expense', amt, t.typeLabel || 'ব্যাংক/MFS উত্তোলন', sub, dIso, 'BNB লেনদেন');
        } else {
          pushItem('bank_admin', `${baseId}_rev`, 'revenue', amt, t.typeLabel || `লেনদেন (${type})`, sub, dIso, 'BNB লেনদেন');
        }
        if (profit + fee > 0 || type === 'fee' || type === 'fee_payment') {
          pushItem('bank_admin', `${baseId}_prof`, 'profit', profit + fee > 0 ? profit + fee : amt, 'লেনদেন সার্ভিস চার্জ ও কমিশন লাভ', sub, dIso, 'BNB লেনদেন');
        }
        if (loss > 0) {
          pushItem('bank_admin', `${baseId}_loss`, 'loss', loss, 'বিনিময়/ক্যাশব্যাক লোকসান', sub, dIso, 'BNB লেনদেন');
        }
      }
    });

    // Supplemental: 1. Samity Investments (Capital Outlay & Sale Value — no P&L label needed)
    samityInvestments.forEach((inv) => {
      const buy = Math.max(0, Number(inv.buyAmount) || 0);
      const sell = Math.max(0, Number(inv.sellAmount) || 0);
      const dIso = String(inv.createdAt || new Date().toISOString());
      if (buy > 0) pushItem('samity', `inv_buy_${inv.id}`, 'expense', buy, `ইনভেস্টমেন্ট ক্রয় / বিনিয়োগ: ${inv.title || 'প্রজেক্ট'}`, inv.location || 'পোর্টফোলিও', dIso, 'ইনভেস্টমেন্ট প্রজেক্ট');
      if (sell > 0) pushItem('samity', `inv_sell_${inv.id}`, 'revenue', sell, `ইনভেস্টমেন্ট বিক্রয় ফেরত: ${inv.title || 'প্রজেক্ট'}`, inv.category || 'পোর্টফোলিও', dIso, 'ইনভেস্টমেন্ট প্রজেক্ট');
    });

    // Supplemental: 2. Safe Deals & Disputes (Accurate Escrow Accounting)
    safeDealOrders.forEach((ord) => {
      const amt = Math.max(0, Number(ord.totalAmount || ord.amount || ord.price) || 0);
      const fee = Math.max(0, Number(ord.escrowFee || ord.commission || ord.adminProfit) || 0);
      const adminLoss = Math.max(0, Number(ord.adminLoss) || 0);
      const dIso = String(ord.createdAt || new Date().toISOString());
      const st = String(ord.status || '').toLowerCase();
      if (st === 'refunded' || st === 'cancelled') {
        if (adminLoss > 0) {
          pushItem('safedeals_admin', `sd_loss_${ord.id}`, 'loss', adminLoss, `ডিল ক্ষতি: ${ord.dealTitle || ord.title || ord.id}`, ord.buyerName || 'ক্রেতা', dIso, 'নিরাপদ ডিল অর্ডার');
        }
      } else if (amt > 0) {
        const statusTxt = st === 'payment released' ? 'সম্পন্ন' : st === 'shipped' ? 'পথে' : 'হোল্ড';
        pushItem('safedeals_admin', `sd_rev_${ord.id}`, 'revenue', amt, `এসক্রো ডিল (${statusTxt}): ${ord.dealTitle || ord.title || ord.id}`, `${ord.buyerName || 'ক্রেতা'} → ${ord.sellerName || 'বিক্রেতা'}`, dIso, 'নিরাপদ ডিল অর্ডার');
        if (fee > 0) {
          pushItem('safedeals_admin', `sd_prof_${ord.id}`, 'profit', fee, `সার্ভিস চার্জ / ফি লাভ: ${ord.dealTitle || ord.title || ''}`, ord.buyerName || 'এসক্রো ফি', dIso, 'নিরাপদ ডিল ফি');
        }
      }
    });
    escrowDisputes.forEach((disp) => {
      const compAmt = Math.max(0, Number(disp.adminLoss || disp.refundCompensation || 0) || 0);
      const legacyRefund = String(disp.status || '').toLowerCase() === 'resolved_refund'
        ? Math.max(0, Number(disp.refundAmount || disp.disputeAmount || disp.amount) || 0)
        : 0;
      const lossAmt = compAmt > 0 ? compAmt : legacyRefund;
      if (lossAmt > 0) {
        pushItem('safedeals_admin', `sd_disp_${disp.id}`, 'loss', lossAmt, `ডিসপিউট ক্ষতি/রিফান্ড: ${disp.reason || disp.description || disp.id}`, disp.userName || disp.complainantName || 'ডিসপিউট', String(disp.createdAt || new Date().toISOString()), 'এসক্রো ডিসপিউট');
      }
    });

    // Supplemental: 6. Ration Orders
    rationOrders.forEach((ord) => {
      const total = Math.max(0, Number(ord.totalAmount || ord.payableAmount || ord.amount) || 0);
      const marketVal = Math.max(0, Number(ord.marketTotal || ord.originalPrice) || 0);
      const costVal = Math.max(0, Number(ord.costAmount || ord.purchaseCost) || 0);
      const dIso = String(ord.createdAt || new Date().toISOString());
      if (total > 0) pushItem('ration_admin', `rat_rev_${ord.id}`, 'revenue', total, `রেশন অর্ডার: ${ord.userName || ord.cardNo || ord.id}`, `${ord.items?.length || 1}টি আইটেম`, dIso, 'রেশন অর্ডার');
      if (costVal > 0) pushItem('ration_admin', `rat_exp_${ord.id}`, 'expense', costVal, 'রেশন পণ্য ক্রয় খরচ', ord.userName || '', dIso, 'রেশন অর্ডার');
      if (marketVal > total && total > 0) pushItem('ration_admin', `rat_sub_${ord.id}`, 'loss', marketVal - total, 'সদস্য ভর্তুকি/ছাড় (Subsidy)', `বাজার মূল্য ৳${marketVal}`, dIso, 'রেশন ভর্তুকি');
    });

    // Supplemental: 7. Salary Payments
    salaryPayments.forEach((p) => {
      const amt = Math.max(0, Number(p.amount || p.paidAmount || p.netSalary) || 0);
      if (amt > 0) {
        pushItem('salary_admin', `sal_pay_${p.id}`, 'expense', amt, `বেতন প্রদান: ${p.employeeName || p.name || 'কর্মী'}`, p.month || p.designation || 'মাসিক বেতন', String(p.paidAt || p.createdAt || new Date().toISOString()), 'স্যালারি শিট');
      }
    });

    // Supplemental: 8. Safi Shop Orders
    shopOrders.forEach((ord) => {
      const total = Math.max(0, Number(ord.totalAmount || ord.amount) || 0);
      const profit = Math.max(0, Number(ord.profit || ord.adminProfit) || 0);
      const buyCost = Math.max(0, Number(ord.costPrice || ord.buyAmount) || 0);
      const dIso = String(ord.createdAt || new Date().toISOString());
      const st = String(ord.status || '').toLowerCase();
      if (st === 'cancelled' || st === 'returned') {
        if (total > 0) pushItem('safi_admin', `safi_loss_${ord.id}`, 'loss', total, `রিটার্ন/বাতিল অর্ডার: ${ord.productName || ord.customerName || ord.id}`, ord.status || 'Returned', dIso, 'সাফি শপ অর্ডার');
      } else if (total > 0) {
        pushItem('safi_admin', `safi_rev_${ord.id}`, 'revenue', total, `অর্ডার বিক্রয়: ${ord.productName || ord.customerName || ord.id}`, ord.customerPhone || '', dIso, 'সাফি শপ অর্ডার');
        if (profit > 0) pushItem('safi_admin', `safi_prof_${ord.id}`, 'profit', profit, 'পণ্য মার্জিন লাভ', ord.productName || '', dIso, 'সাফি শপ অর্ডার');
        if (buyCost > 0) pushItem('safi_admin', `safi_cost_${ord.id}`, 'expense', buyCost, 'পণ্য ক্রয়/উৎপাদন মূল্য', ord.productName || '', dIso, 'সাফি শপ অর্ডার');
      }
    });

    // Supplemental: 11. Agent Requests fallback if no tx existed
    if (map.agent_admin.length === 0 && adminAgentRequests.length > 0) {
      adminAgentRequests
        .filter((r) => Number(r.feePaid || 0) > 0 && r.status !== 'rejected')
        .forEach((r) => {
          const feeAmt = Number(r.feePaid || 0);
          const dIso = String(r.createdAt || new Date().toISOString());
          pushItem('agent_admin', `ag_rev_${r.id}`, 'revenue', feeAmt, `এজেন্ট ফি: ${r.name || r.agentName || 'এজেন্ট'}`, r.phone || '', dIso, 'এজেন্ট আবেদন');
          pushItem('agent_admin', `ag_prof_${r.id}`, 'profit', feeAmt, 'এজেন্ট নিবন্ধন আয় লাভ', r.name || '', dIso, 'এজেন্ট আবেদন');
        });
    }

    // Supplemental: 12. Broadcasts & Corporate Expenses
    broadcastLogs.forEach((l) => {
      const amt = Math.max(0, Number(l.amount) || 0);
      if (amt <= 0) return;
      const count = Math.max(1, Number(l.targetCount) || 1);
      const total = l.targetType === 'all' ? amt * count : amt;
      const dIso = String(l.createdAt || new Date().toISOString());
      if (l.actionType === 'bonus') {
        pushItem('notices', `brd_bonus_${l.id}`, 'expense', total, `সদস্য বোনাস প্রদান: ${l.title || l.targetUserName || 'বোনাস'}`, l.targetUserName || '', dIso, 'বোনাস ব্রডকাস্ট');
      } else if (l.actionType === 'fine') {
        pushItem('notices', `brd_fine_${l.id}`, 'profit', total, `সদস্য জরিমানা সংগ্রহ: ${l.title || l.targetUserName || 'জরিমানা'}`, l.targetUserName || '', dIso, 'জরিমানা ব্রডকাস্ট');
      }
    });

    companyExpenses.forEach((e) => {
      const amt = Math.max(0, Number(e.amount) || 0);
      if (amt <= 0) return;
      const dIso = String(e.createdAt || new Date().toISOString());
      const isSal = String(e?.category || e?.title || '').includes('স্যালারি') || String(e?.category || '').toLowerCase().includes('salary');
      if (isSal) {
        pushItem('salary_admin', `sal_cexp_${e.id}`, 'expense', amt, e.title || 'অফিস স্যালারি ব্যয়', e.category || 'স্যালারি', dIso, 'কোম্পানি ব্যয় খাতা');
      } else {
        pushItem('notices', `corp_cexp_${e.id}`, 'expense', amt, e.title || 'কর্পোরেট পরিচালনা খরচ', e.category || 'সাধারণ খরচ', dIso, 'কোম্পানি ব্যয় খাতা');
      }
    });

    ALL_AUDIT_SECTION_KEYS.forEach((k) => {
      map[k].sort((a, b) => String(b.dateIso).localeCompare(String(a.dateIso)));
    });

    return map;
  }, [
    transactions,
    samityInvestments,
    safeDealOrders,
    escrowDisputes,
    rationOrders,
    salaryPayments,
    shopOrders,
    adminAgentRequests,
    broadcastLogs,
    companyExpenses
  ]);

  // 4. Compute stats helper for any section & time period
  const computeSectionStats = useCallback(
    (sectionKey: AuditSectionKey, period: 'all' | 'today' | 'month' | '7d' = 'all'): SectionComputedStats => {
      const autoList = (autoItemsBySection[sectionKey] || []).filter((i) =>
        matchesAuditDateFilter(i.dateIso, period)
      );
      const manualList = allManualEntries.filter(
        (e) => e.sectionKey === sectionKey && matchesAuditDateFilter(e.entryDate || e.createdAt, period)
      );

      const sumBy = (arr: Array<{ entryType: AuditEntryType; amount: number }>, t: AuditEntryType) =>
        arr.filter((x) => x.entryType === t).reduce((s, x) => s + (Number(x.amount) || 0), 0);

      const autoRevenue = sumBy(autoList, 'revenue');
      const autoProfit = sumBy(autoList, 'profit');
      const autoLoss = sumBy(autoList, 'loss');
      const autoExpense = sumBy(autoList, 'expense');

      const manualRevenue = sumBy(manualList, 'revenue');
      const manualProfit = sumBy(manualList, 'profit');
      const manualLoss = sumBy(manualList, 'loss');
      const manualExpense = sumBy(manualList, 'expense');

      const combinedRevenue = autoRevenue + manualRevenue;
      const combinedProfit = autoProfit + manualProfit;
      const combinedLoss = autoLoss + manualLoss;
      const combinedExpense = autoExpense + manualExpense;

      const overrides = appConfig?.sectionAuditOverrides?.[sectionKey] || {};
      const useOverrides = period === 'all';

      const checkOvr = (val: any): val is number =>
        useOverrides && val !== undefined && val !== null && typeof val === 'number' && !isNaN(val);

      const isOverrideRevenue = checkOvr(overrides.revenue);
      const isOverrideProfit = checkOvr(overrides.profit);
      const isOverrideLoss = checkOvr(overrides.loss);
      const isOverrideExpense = checkOvr(overrides.expense);

      const effectiveRevenue = isOverrideRevenue ? Math.max(0, overrides.revenue) : combinedRevenue;
      const effectiveProfit = isOverrideProfit ? Math.max(0, overrides.profit) : combinedProfit;
      const effectiveLoss = isOverrideLoss ? Math.max(0, overrides.loss) : combinedLoss;
      const effectiveExpense = isOverrideExpense ? Math.max(0, overrides.expense) : combinedExpense;

      const netResult = effectiveProfit - (effectiveLoss + effectiveExpense);

      return {
        sectionKey,
        autoItems: autoList,
        manualEntries: manualList,
        autoRevenue,
        autoProfit,
        autoLoss,
        autoExpense,
        manualRevenue,
        manualProfit,
        manualLoss,
        manualExpense,
        combinedRevenue,
        combinedProfit,
        combinedLoss,
        combinedExpense,
        effectiveRevenue,
        effectiveProfit,
        effectiveLoss,
        effectiveExpense,
        isOverrideRevenue,
        isOverrideProfit,
        isOverrideLoss,
        isOverrideExpense,
        hasAnyOverride: isOverrideRevenue || isOverrideProfit || isOverrideLoss || isOverrideExpense,
        netResult
      };
    },
    [autoItemsBySection, allManualEntries, appConfig?.sectionAuditOverrides]
  );

  // Precomputed map for all 12 sections (all-time) for instant Dashboard rendering
  const allSectionsStatsMap = useMemo<Record<AuditSectionKey, SectionComputedStats>>(() => {
    const out = {} as Record<AuditSectionKey, SectionComputedStats>;
    ALL_AUDIT_SECTION_KEYS.forEach((k) => {
      out[k] = computeSectionStats(k, 'all');
    });
    return out;
  }, [computeSectionStats]);

  // 5. Real-time Firestore CRUD operations for `section_audits`
  const addAuditEntry = useCallback(
    async (input: {
      sectionKey: AuditSectionKey;
      entryType: AuditEntryType;
      title: string;
      amount: number;
      category?: string;
      note?: string;
      monthKey?: string;
      memberName?: string;
      entryDate?: string;
    }) => {
      const cleanTitle = String(input.title || '').trim().slice(0, 180);
      const parsedAmount = Number(convertBengaliToEnglishDigits(String(input.amount)));
      if (!cleanTitle) throw new Error('অনুগ্রহ করে বিবরণ বা খাতের নাম লিখুন।');
      if (!isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error('অনুগ্রহ করে সঠিক টাকার পরিমাণ (০ এর বেশি) লিখুন।');
      }

      const nowIso = new Date().toISOString();
      const meta = SECTION_META_MAP[input.sectionKey];
      const payload: Omit<SectionAuditEntry, 'id'> = {
        sectionKey: input.sectionKey,
        entryType: input.entryType,
        title: cleanTitle,
        amount: parsedAmount,
        category: String(input.category || meta.expenseCategories[0] || 'সাধারণ খাত').trim().slice(0, 100),
        note: String(input.note || '').trim().slice(0, 400),
        ...(input.monthKey ? { monthKey: String(input.monthKey).trim().slice(0, 20) } : {}),
        ...(input.memberName ? { memberName: String(input.memberName).trim().slice(0, 120) } : {}),
        entryDate: input.entryDate || nowIso.slice(0, 10),
        createdBy: String(currentUser?.name || currentUser?.phone || 'Admin').slice(0, 100),
        createdAt: nowIso,
        updatedAt: nowIso
      };

      try {
        const ref = await addDoc(collection(db, 'section_audits'), payload);
        // Optimistic state update in case snapshot takes a moment
        setAllManualEntries((prev) => {
          if (prev.some((p) => p.id === ref.id)) return prev;
          const next = [{ id: ref.id, ...payload }, ...prev];
          writeCachedAuditEntries(next);
          return next;
        });
        return ref.id;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'section_audits');
      }
    },
    [currentUser]
  );

  const updateAuditEntry = useCallback(
    async (
      id: string,
      input: {
        entryType: AuditEntryType;
        title: string;
        amount: number;
        category?: string;
        note?: string;
        monthKey?: string;
        memberName?: string;
        entryDate?: string;
      }
    ) => {
      const cleanTitle = String(input.title || '').trim().slice(0, 180);
      const parsedAmount = Number(convertBengaliToEnglishDigits(String(input.amount)));
      if (!cleanTitle) throw new Error('অনুগ্রহ করে বিবরণ বা খাতের নাম লিখুন।');
      if (!isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error('অনুগ্রহ করে সঠিক টাকার পরিমাণ লিখুন।');
      }
      const nowIso = new Date().toISOString();
      const updates: Record<string, any> = {
        entryType: input.entryType,
        title: cleanTitle,
        amount: parsedAmount,
        category: String(input.category || 'সাধারণ খাত').trim().slice(0, 100),
        note: String(input.note || '').trim().slice(0, 400),
        monthKey: input.monthKey ? String(input.monthKey).trim().slice(0, 20) : '',
        memberName: input.memberName ? String(input.memberName).trim().slice(0, 120) : '',
        entryDate: input.entryDate || nowIso.slice(0, 10),
        updatedAt: nowIso
      };

      try {
        await updateDoc(doc(db, 'section_audits', id), updates);
        setAllManualEntries((prev) => {
          const next = prev.map((e) => (e.id === id ? { ...e, ...updates } : e));
          writeCachedAuditEntries(next);
          return next;
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `section_audits/${id}`);
      }
    },
    []
  );

  const deleteAuditEntry = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, 'section_audits', id));
      setAllManualEntries((prev) => {
        const next = prev.filter((e) => e.id !== id);
        writeCachedAuditEntries(next);
        return next;
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `section_audits/${id}`);
    }
  }, []);

  // 6. Save or reset Manual Balance Tune/Override for any section (`appConfig.sectionAuditOverrides`)
  const saveSectionManualTune = useCallback(
    async (
      sectionKey: AuditSectionKey,
      overridesPatch: {
        revenue?: number | null;
        profit?: number | null;
        loss?: number | null;
        expense?: number | null;
      }
    ) => {
      const currentMap = appConfig?.sectionAuditOverrides || {};
      const currentSec = currentMap[sectionKey] || {};
      const updatedSec = {
        ...currentSec,
        ...overridesPatch
      };
      const updatedConfig = {
        ...(appConfig || {}),
        sectionAuditOverrides: {
          ...currentMap,
          [sectionKey]: updatedSec
        }
      };
      if (onChangeConfig) {
        onChangeConfig(updatedConfig);
      }
      await saveAppConfig(updatedConfig);
    },
    [appConfig, onChangeConfig]
  );

  const saveSamityCapitalTune = useCallback(
    async (overridesPatch: Record<string, number | null>) => {
      const currentOverrides = appConfig?.samityCapitalOverrides || {};
      const updatedOverrides = { ...currentOverrides, ...overridesPatch };
      const updatedConfig = {
        ...(appConfig || {}),
        samityCapitalOverrides: updatedOverrides
      };
      if (onChangeConfig) {
        onChangeConfig(updatedConfig);
      }
      await saveAppConfig(updatedConfig);
    },
    [appConfig, onChangeConfig]
  );

  // 6b. Real-time Firestore CRUD for `samity_fund_custody` (কার কাছে কোথায় কত টাকা আছে)
  const addSamityCustodyEntry = useCallback(
    async (input: {
      holderName: string;
      channel: SamityCustodyChannel;
      accountInfo?: string;
      amount: number;
      note?: string;
    }) => {
      const holderName = String(input.holderName || '').trim().slice(0, 140);
      const parsedAmount = Number(convertBengaliToEnglishDigits(String(input.amount)));
      if (!holderName) throw new Error('কার কাছে টাকা আছে (ব্যক্তি বা প্রতিষ্ঠানের নাম) লিখুন।');
      if (!isFinite(parsedAmount) || parsedAmount < 0) {
        throw new Error('সঠিক টাকার পরিমাণ লিখুন।');
      }
      const nowIso = new Date().toISOString();
      const payload: Omit<SamityCustodyEntry, 'id'> = {
        holderName,
        channel: input.channel || 'cash',
        accountInfo: String(input.accountInfo || '').trim().slice(0, 180),
        amount: parsedAmount,
        note: String(input.note || '').trim().slice(0, 300),
        createdBy: String(currentUser?.name || currentUser?.phone || 'Admin').slice(0, 100),
        createdAt: nowIso,
        updatedAt: nowIso
      };
      try {
        const ref = await addDoc(collection(db, 'samity_fund_custody'), payload);
        setSamityCustodyEntries((prev) => {
          if (prev.some((p) => p.id === ref.id)) return prev;
          const next = [{ id: ref.id, ...payload }, ...prev];
          writeCachedCustodyEntries(next);
          return next;
        });
        return ref.id;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'samity_fund_custody');
      }
    },
    [currentUser]
  );

  const updateSamityCustodyEntry = useCallback(
    async (
      id: string,
      input: {
        holderName: string;
        channel: SamityCustodyChannel;
        accountInfo?: string;
        amount: number;
        note?: string;
      }
    ) => {
      const holderName = String(input.holderName || '').trim().slice(0, 140);
      const parsedAmount = Number(convertBengaliToEnglishDigits(String(input.amount)));
      if (!holderName) throw new Error('কার কাছে টাকা আছে (ব্যক্তি বা প্রতিষ্ঠানের নাম) লিখুন।');
      if (!isFinite(parsedAmount) || parsedAmount < 0) {
        throw new Error('সঠিক টাকার পরিমাণ লিখুন।');
      }
      const nowIso = new Date().toISOString();
      const updates = {
        holderName,
        channel: input.channel || 'cash',
        accountInfo: String(input.accountInfo || '').trim().slice(0, 180),
        amount: parsedAmount,
        note: String(input.note || '').trim().slice(0, 300),
        updatedAt: nowIso
      };
      try {
        await updateDoc(doc(db, 'samity_fund_custody', id), updates);
        setSamityCustodyEntries((prev) => {
          const next = prev.map((c) => (c.id === id ? { ...c, ...updates } : c));
          writeCachedCustodyEntries(next);
          return next;
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `samity_fund_custody/${id}`);
      }
    },
    []
  );

  const deleteSamityCustodyEntry = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, 'samity_fund_custody', id));
      setSamityCustodyEntries((prev) => {
        const next = prev.filter((c) => c.id !== id);
        writeCachedCustodyEntries(next);
        return next;
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `samity_fund_custody/${id}`);
    }
  }, []);

  // 4b. Dedicated Automatic Samity Capital, Monthly Collection, Per-Month Payers & Investment Audit
  const computeSamityCapitalAudit = useCallback(
    (selectedYear: number) => {
      const tierLabelMap: Record<SamityTierKey, string> = {
        owner: 'ওনার',
        shareholder: 'শেয়ার হোল্ডার',
        investor: 'ইনভেস্টার',
        supporter: 'সাপোর্টার',
        regular: 'সাধারণ'
      };

      const registeredInvestors = (users || []).filter((u) => isRegisteredSamityInvestor(u));
      const switchOffMembers = registeredInvestors.filter((u) => isSamitySwitchOff(u));
      const activeSwitchOnMembers = registeredInvestors.filter((u) => !isSamitySwitchOff(u));

      const totalMemberSavings = (users || []).reduce(
        (sum, u) => sum + Math.max(0, Number(u?.savings !== undefined ? u.savings : u?.dpsBalance) || 0),
        0
      );

      const switchOffRefundAmount = switchOffMembers.reduce(
        (sum, u) => sum + Math.max(0, Number(u?.savings !== undefined ? u.savings : u?.dpsBalance) || 0),
        0
      );

      const monthlyExpectedTarget = activeSwitchOnMembers.reduce(
        (sum, u) => sum + Math.max(0, getSamityMonthlyRate(u)),
        0
      );

      // Month-by-month automatic calculation + Payer & Unpaid member breakdown for selectedYear (Jan - Dec)
      type MonthPayerItem = {
        id: string;
        uid?: string;
        name: string;
        memberId: string;
        phone: string;
        tier: SamityTierKey;
        tierLabel: string;
        amount: number;
        sourceLabel: string;
        isManualEntry?: boolean;
        dateLabel?: string;
      };
      type MonthUnpaidItem = {
        id: string;
        name: string;
        memberId: string;
        phone: string;
        tier: SamityTierKey;
        tierLabel: string;
        expectedAmount: number;
      };

      const monthlyAmounts: Record<string, number> = {};
      const monthlyPayers: Record<string, MonthPayerItem[]> = {};
      const monthlyPaidUserKeys: Record<string, Set<string>> = {};

      SAMITY_MONTHS.forEach((m) => {
        monthlyAmounts[m.id] = 0;
        monthlyPayers[m.id] = [];
        monthlyPaidUserKeys[m.id] = new Set();
      });

      // Index completed samity installment transactions by `${userId}_${year}-${monthId}` when available
      const txAmountLookup: Record<string, { amount: number; dateLabel: string; sourceLabel: string }> = {};
      (transactions || []).forEach((t) => {
        if (!isTxSuccessful(t)) return;
        const type = String(t?.type || '').toLowerCase();
        const cat = String(t?.category || '').toLowerCase();
        if (!(type.includes('samity') || cat.includes('samity') || type === 'coop_savings_deposit')) return;
        if (type === 'withdraw' || type === 'samity_release' || cat.includes('withdraw') || cat.includes('refund')) return;

        const uid = String(t?.userId || t?.memberId || '');
        if (!uid) return;
        const paidMonthsArr: string[] = Array.isArray(t?.paidMonths)
          ? t.paidMonths
          : t?.monthKey
            ? [String(t.monthKey)]
            : [];
        const dIso = String(t?.createdAt || t?.date || '');
        const dParsed = parseIsoDate(dIso);
        const dateLabel = dParsed ? dParsed.toLocaleDateString('bn-BD') : '';
        const amtTotal = getTxAmount(t);
        const perMonthAmt = paidMonthsArr.length > 0 ? Math.round(amtTotal / paidMonthsArr.length) : amtTotal;

        paidMonthsArr.forEach((mk) => {
          if (mk && perMonthAmt > 0) {
            txAmountLookup[`${uid}_${mk}`] = {
              amount: perMonthAmt,
              dateLabel,
              sourceLabel: t?.typeLabel || 'অটো/অনলাইন কিস্তি'
            };
          }
        });
      });

      registeredInvestors.forEach((u) => {
        const rate = getSamityMonthlyRate(u);
        if (rate <= 0) return;
        const tier = getSamityMemberTier(u);
        const tierLabel = tierLabelMap[tier];
        const uKey = String(u.uid || u.id || u.memberId || u.phone || u.name);
        const paidList = getEffectivePaidMonthsList(u);

        paidList.forEach((key) => {
          const parts = String(key).split('-');
          if (parts.length !== 2) return;
          const yr = Number(parts[0]);
          const mId = parts[1];
          if (yr === selectedYear && mId in monthlyAmounts) {
            const txMatch =
              txAmountLookup[`${u.uid}_${key}`] ||
              txAmountLookup[`${u.memberId}_${key}`];
            const paidAmt = txMatch?.amount && txMatch.amount > 0 ? txMatch.amount : rate;
            monthlyAmounts[mId] += paidAmt;
            monthlyPaidUserKeys[mId].add(uKey);
            monthlyPayers[mId].push({
              id: `${uKey}_${key}`,
              uid: u.uid || u.id,
              name: u.name || 'অজ্ঞাত সদস্য',
              memberId: u.memberId || 'N/A',
              phone: u.phone || '',
              tier,
              tierLabel,
              amount: paidAmt,
              sourceLabel: txMatch?.sourceLabel || 'মাসিক সঞ্চয় কিস্তি',
              dateLabel: txMatch?.dateLabel || ''
            });
          }
        });
      });

      // Include manual month-tagged capital deposits in `section_audits`
      const samityManualEntries = allManualEntries.filter((e) => e.sectionKey === 'samity');
      samityManualEntries.forEach((e) => {
        if (e.entryType !== 'revenue' || !e.monthKey) return;
        const parts = String(e.monthKey).split('-');
        if (parts.length !== 2) return;
        const yr = Number(parts[0]);
        const mId = parts[1];
        if (yr === selectedYear && mId in monthlyAmounts) {
          const amt = Math.max(0, Number(e.amount) || 0);
          if (amt <= 0) return;
          monthlyAmounts[mId] += amt;
          monthlyPayers[mId].push({
            id: `manual_${e.id}`,
            name: e.memberName || e.title || 'ম্যানুয়াল এন্ট্রি',
            memberId: 'ম্যানুয়াল',
            phone: '',
            tier: 'regular',
            tierLabel: e.category || 'ম্যানুয়াল জমা',
            amount: amt,
            sourceLabel: e.title || 'এডমিন ম্যানুয়াল ফরম',
            isManualEntry: true,
            dateLabel: e.entryDate || ''
          });
        }
      });

      const monthlyBreakdown = SAMITY_MONTHS.map((m) => {
        const payers = [...monthlyPayers[m.id]].sort((a, b) => b.amount - a.amount);
        const unpaidMembers: MonthUnpaidItem[] = activeSwitchOnMembers
          .filter((u) => {
            const uKey = String(u.uid || u.id || u.memberId || u.phone || u.name);
            return !monthlyPaidUserKeys[m.id].has(uKey);
          })
          .map((u) => {
            const tier = getSamityMemberTier(u);
            return {
              id: String(u.uid || u.id || u.memberId || u.phone),
              name: u.name || 'সদস্য',
              memberId: u.memberId || 'N/A',
              phone: u.phone || '',
              tier,
              tierLabel: tierLabelMap[tier],
              expectedAmount: getSamityMonthlyRate(u)
            };
          });

        const tierSummary: Record<SamityTierKey, { count: number; amount: number }> = {
          owner: { count: 0, amount: 0 },
          shareholder: { count: 0, amount: 0 },
          investor: { count: 0, amount: 0 },
          supporter: { count: 0, amount: 0 },
          regular: { count: 0, amount: 0 }
        };
        payers.forEach((p) => {
          tierSummary[p.tier].count += 1;
          tierSummary[p.tier].amount += p.amount;
        });

        return {
          id: m.id,
          monthNum: m.monthNum,
          name: m.name,
          short: m.short,
          amount: monthlyAmounts[m.id] || 0,
          memberCount: payers.length,
          payers,
          unpaidMembers,
          tierSummary
        };
      });

      const now = new Date();
      const currentMonthIdx = now.getMonth(); // 0..11
      const currentMonthMeta = SAMITY_MONTHS[currentMonthIdx];
      const currentMonthCollectedAuto = (() => {
        const nowYear = now.getFullYear();
        let sum = 0;
        registeredInvestors.forEach((u) => {
          const rate = getSamityMonthlyRate(u);
          if (rate <= 0) return;
          const paidList = getEffectivePaidMonthsList(u);
          if (paidList.includes(`${nowYear}-${currentMonthMeta.id}`)) {
            const txMatch =
              txAmountLookup[`${u.uid}_${nowYear}-${currentMonthMeta.id}`] ||
              txAmountLookup[`${u.memberId}_${nowYear}-${currentMonthMeta.id}`];
            sum += txMatch?.amount && txMatch.amount > 0 ? txMatch.amount : rate;
          }
        });
        samityManualEntries.forEach((e) => {
          if (e.entryType === 'revenue' && e.monthKey === `${nowYear}-${currentMonthMeta.id}`) {
            sum += Math.max(0, Number(e.amount) || 0);
          }
        });
        return sum;
      })();

      const yearTotalCollectedAuto = monthlyBreakdown.reduce((s, m) => s + m.amount, 0);
      const yearPaidInstallmentsCount = monthlyBreakdown.reduce((s, m) => s + m.memberCount, 0);

      // Samity Investments (`samity_investments`) real-time totals
      const totalProjectsCount = samityInvestments.length;
      const totalInvestedBuyAuto = samityInvestments.reduce(
        (s, inv) => s + Math.max(0, Number(inv?.buyAmount) || 0),
        0
      );
      const activeProjects = samityInvestments.filter((inv) => inv?.status !== 'sold');
      const activeInvestedBuyAuto = activeProjects.reduce(
        (s, inv) => s + Math.max(0, Number(inv?.buyAmount) || 0),
        0
      );
      const totalSoldValue = samityInvestments.reduce(
        (s, inv) => s + Math.max(0, Number(inv?.sellAmount) || 0),
        0
      );

      // Withdrawn / Refunded totals (completed samity_withdraw & samity_release + manual samity expense)
      const autoWithdrawnTotal = (transactions || [])
        .filter((t) => {
          const type = String(t?.type || '').toLowerCase();
          const cat = String(t?.category || '').toLowerCase();
          return (
            isTxSuccessful(t) &&
            (type === 'samity_release' ||
              cat === 'samity_withdraw' ||
              (type === 'withdraw' && cat.includes('samity')))
          );
        })
        .reduce((s, t) => s + getTxAmount(t), 0);

      const manualExtraDeposit = samityManualEntries
        .filter((e) => e.entryType === 'revenue')
        .reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const manualExtraOut = samityManualEntries
        .filter((e) => e.entryType === 'expense')
        .reduce((s, e) => s + (Number(e.amount) || 0), 0);

      // Fund Custody Summary ("কার কাছে কত টাকা আছে" — ব্যাংক, বিকাশ, নগদ, হাতে ক্যাশ ইত্যাদি)
      const custodyTotalAmount = samityCustodyEntries.reduce(
        (s, c) => s + Math.max(0, Number(c?.amount) || 0),
        0
      );
      const custodyByChannel: Record<SamityCustodyChannel, { count: number; amount: number }> = {
        bank: { count: 0, amount: 0 },
        bkash: { count: 0, amount: 0 },
        nagad: { count: 0, amount: 0 },
        cash: { count: 0, amount: 0 },
        rocket: { count: 0, amount: 0 },
        other: { count: 0, amount: 0 }
      };
      samityCustodyEntries.forEach((c) => {
        const ch: SamityCustodyChannel = c.channel in custodyByChannel ? c.channel : 'other';
        custodyByChannel[ch].count += 1;
        custodyByChannel[ch].amount += Math.max(0, Number(c.amount) || 0);
      });

      const autoMemberCapital = totalMemberSavings + manualExtraDeposit;
      // When custody entries are recorded by Admin, Card 1 ("মোট পুঁজি") shows the exact sum of all custody entries
      const autoTotalSamityCapital = samityCustodyEntries.length > 0 ? custodyTotalAmount : autoMemberCapital;
      const totalWithdrawnRefunded = autoWithdrawnTotal + manualExtraOut;
      const autoCashRemainingInHand = Math.max(0, autoTotalSamityCapital - activeInvestedBuyAuto);

      // Apply optional Admin manual tune overrides (`appConfig.samityCapitalOverrides`)
      const ov = appConfig?.samityCapitalOverrides || {};
      const pickVal = (key: string, autoVal: number) => {
        const v = ov[key];
        return v !== undefined && v !== null && typeof v === 'number' && !isNaN(v)
          ? Math.max(0, v)
          : autoVal;
      };
      const hasOverrideKey = (key: string) => {
        const v = ov[key];
        return v !== undefined && v !== null && typeof v === 'number' && !isNaN(v);
      };

      const totalSamityCapital = pickVal('totalSamityCapital', autoTotalSamityCapital);
      const currentMonthCollected = pickVal('currentMonthCollected', currentMonthCollectedAuto);
      const yearTotalCollected = pickVal('yearTotalCollected', yearTotalCollectedAuto);
      const finalMonthlyExpectedTarget = pickVal('monthlyExpectedTarget', monthlyExpectedTarget);
      const totalInvestedBuy = pickVal('totalInvestedBuy', totalInvestedBuyAuto);
      const activeInvestedBuy = pickVal('activeInvestedBuy', activeInvestedBuyAuto);
      const cashRemainingInHand = hasOverrideKey('cashRemainingInHand')
        ? pickVal('cashRemainingInHand', autoCashRemainingInHand)
        : Math.max(0, totalSamityCapital - activeInvestedBuy);
      const finalSwitchOffRefundAmount = pickVal('switchOffRefundAmount', switchOffRefundAmount);

      return {
        selectedYear,
        registeredInvestorsCount: registeredInvestors.length,
        activeSwitchOnCount: activeSwitchOnMembers.length,
        switchOffCount: switchOffMembers.length,
        switchOffRefundAmount: finalSwitchOffRefundAmount,
        totalSamityCapital,
        autoMemberCapital,
        custodyEntries: samityCustodyEntries,
        custodyEntriesCount: samityCustodyEntries.length,
        custodyTotalAmount,
        custodyByChannel,
        currentMonthName: currentMonthMeta.name,
        currentMonthId: currentMonthMeta.id,
        currentMonthCollected,
        monthlyExpectedTarget: finalMonthlyExpectedTarget,
        yearTotalCollected,
        yearPaidInstallmentsCount,
        monthlyBreakdown,
        totalProjectsCount,
        activeProjectsCount: activeProjects.length,
        totalInvestedBuy,
        activeInvestedBuy,
        totalSoldValue,
        totalWithdrawnRefunded,
        cashRemainingInHand,
        manualExtraDeposit,
        manualExtraOut,
        autoValues: {
          totalSamityCapital: autoTotalSamityCapital,
          currentMonthCollected: currentMonthCollectedAuto,
          yearTotalCollected: yearTotalCollectedAuto,
          monthlyExpectedTarget,
          totalInvestedBuy: totalInvestedBuyAuto,
          activeInvestedBuy: activeInvestedBuyAuto,
          cashRemainingInHand: autoCashRemainingInHand,
          switchOffRefundAmount
        },
        hasAnyOverride:
          hasOverrideKey('totalSamityCapital') ||
          hasOverrideKey('currentMonthCollected') ||
          hasOverrideKey('yearTotalCollected') ||
          hasOverrideKey('monthlyExpectedTarget') ||
          hasOverrideKey('totalInvestedBuy') ||
          hasOverrideKey('activeInvestedBuy') ||
          hasOverrideKey('cashRemainingInHand') ||
          hasOverrideKey('switchOffRefundAmount')
      };
    },
    [users, samityInvestments, samityCustodyEntries, transactions, allManualEntries, appConfig?.samityCapitalOverrides]
  );

  const computeSafeDealsSummary = useCallback(() => {
    let heldCount = 0;
    let heldAmount = 0;
    let shippedCount = 0;
    let shippedAmount = 0;
    let releasedCount = 0;
    let releasedAmount = 0;
    let refundedCount = 0;
    let refundedAmount = 0;
    let totalFeeProfit = 0;

    safeDealOrders.forEach((o) => {
      const st = String(o?.status || '');
      const amt = Math.max(0, Number(o?.totalAmount || o?.amount || o?.price) || 0);
      const fee = Math.max(0, Number(o?.escrowFee || o?.commission || o?.adminProfit) || 0);
      if (st === 'Payment Held') {
        heldCount += 1;
        heldAmount += amt;
        totalFeeProfit += fee;
      } else if (st === 'Shipped') {
        shippedCount += 1;
        shippedAmount += amt;
        totalFeeProfit += fee;
      } else if (st === 'Payment Released') {
        releasedCount += 1;
        releasedAmount += amt;
        totalFeeProfit += fee;
      } else if (st === 'Refunded' || st === 'Cancelled') {
        refundedCount += 1;
        refundedAmount += amt;
      }
    });

    const disputesPending = escrowDisputes.filter((d) => String(d?.status || 'Pending') === 'Pending').length;
    const disputesInvestigating = escrowDisputes.filter((d) => String(d?.status || '') === 'Under Investigation').length;
    const disputesResolved = escrowDisputes.filter((d) => String(d?.status || '') === 'Resolved').length;

    return {
      totalOrdersCount: safeDealOrders.length,
      heldCount,
      heldAmount,
      shippedCount,
      shippedAmount,
      releasedCount,
      releasedAmount,
      refundedCount,
      refundedAmount,
      totalActiveHeldVolume: heldAmount + shippedAmount,
      totalCompletedVolume: releasedAmount,
      totalFeeProfit,
      disputesTotal: escrowDisputes.length,
      disputesPending,
      disputesInvestigating,
      disputesResolved,
      orders: safeDealOrders,
      disputes: escrowDisputes
    };
  }, [safeDealOrders, escrowDisputes]);

  const computeQardSadaqahAudit = useCallback(() => {
    const isOk = (t: any) => {
      const s = String(t?.status || '').toLowerCase();
      return s === 'success' || s === 'approved' || s === 'completed';
    };

    const isHumanitarianPurpose = (t: any) => {
      const pId = String(t?.donationPurpose || t?.purpose || '').toLowerCase();
      const desc = `${t?.description || ''} ${t?.details || ''}`.toLowerCase();
      if (['medical', 'education', 'micro', 'emergency', 'general_charity', 'sadaqah'].includes(pId)) return true;
      return (
        desc.includes('চিকিৎসা') ||
        desc.includes('ঔষধ') ||
        desc.includes('ওষুধ') ||
        desc.includes('শিক্ষা') ||
        desc.includes('শিক্ষার্থী') ||
        desc.includes('ক্ষুদ্র') ||
        desc.includes('স্বনির্ভর') ||
        desc.includes('ভ্যান') ||
        desc.includes('সেলাই') ||
        desc.includes('জরুরি') ||
        desc.includes('ত্রাণ') ||
        desc.includes('বন্যা') ||
        desc.includes('সদকা') ||
        desc.includes('লিল্লা')
      );
    };

    // 1. Qard Hasana Donations (excluding pure general_charity & sadaqah sectors)
    const qardDonorTxs = transactions.filter(
      (t) =>
        isOk(t) &&
        String(t?.type || '') === 'qard_donation' &&
        String(t?.donationPurpose || '') !== 'general_charity'
    );
    const pureQardDonorTxs = qardDonorTxs.filter((t) => !isHumanitarianPurpose(t));
    const qardTotalDonated = qardDonorTxs.reduce((s, t) => s + Math.max(0, Number(t?.amount) || 0), 0);
    const uniqueQardDonorKeys = new Set(
      qardDonorTxs.map((t) => t?.userId || t?.userPhone || t?.senderPhone || t?.userName || t?.id)
    );

    // 2. Qard Disbursed & Borrowers
    const qardDisbursedTxs = transactions.filter(
      (t) =>
        isOk(t) &&
        (String(t?.type || '') === 'qard_loan_disbursment' ||
          String(t?.type || '') === 'coop_instant_loan' ||
          String(t?.type || '') === 'qard_loan_request')
    );
    const qardTotalDisbursed = qardDisbursedTxs.reduce((s, t) => s + Math.max(0, Number(t?.amount) || 0), 0);
    const uniqueBorrowerKeys = new Set(
      qardDisbursedTxs.map((t) => t?.userId || t?.userPhone || t?.userName || t?.id)
    );

    const qardRepaidTxs = transactions.filter(
      (t) =>
        isOk(t) &&
        (String(t?.type || '') === 'qard_loan_repayment' || String(t?.type || '') === 'loan_repayment')
    );
    const qardTotalRepaid = qardRepaidTxs.reduce((s, t) => s + Math.max(0, Number(t?.amount) || 0), 0);

    const activeBorrowers = users.filter((u) => (Number(u.dueLoan) || 0) > 0);
    const userDueTotal = activeBorrowers.reduce((s, u) => s + Math.max(0, Number(u.dueLoan) || 0), 0);
    const qardActiveDue = userDueTotal > 0 ? userDueTotal : Math.max(0, qardTotalDisbursed - qardTotalRepaid);

    const baseQardVal = Number(appConfig?.qardBaseFund ?? (appConfig?.companyFundBalances as any)?.qard_fund ?? 0) || 0;
    const qardTotalFund = baseQardVal > 0 ? baseQardVal : qardTotalDonated;
    const qardAvailableCash = Math.max(0, qardTotalFund - qardActiveDue);

    const nowMs = Date.now();
    const overdueBorrowers = activeBorrowers.filter((u) => {
      const takenStr = (u as any).instantLoanTakenAt || (u as any).lastCoopInstantLoanAt || (u as any).loanTakenAt;
      if (!takenStr) return false;
      const days = Math.floor((nowMs - new Date(takenStr).getTime()) / (1000 * 60 * 60 * 24));
      return days > 30;
    });
    const lifetimeBannedUsers = users.filter((u) => (u as any).isLifetimeBannedFromQard === true);

    // 3. Sadaqah Jariyah (Charity Donations & Disbursements)
    const sadaqahDonorTxs = transactions.filter((t) => {
      if (!isOk(t)) return false;
      const tp = String(t?.type || '');
      const cat = String(t?.category || '');
      if (tp === 'general_charity_donation' || tp === 'general_charity' || cat === 'general_charity') return true;
      if (tp === 'qard_donation' && isHumanitarianPurpose(t)) return true;
      return false;
    });
    const baseSadaqahIn = Number(appConfig?.generalCharityTotal || 0) || 0;
    const sadaqahDonationsSum = sadaqahDonorTxs.reduce((s, t) => s + Math.max(0, Number(t?.amount) || 0), 0);
    const sadaqahTotalCollected = baseSadaqahIn + sadaqahDonationsSum;
    const uniqueSadaqahDonors = new Set(
      sadaqahDonorTxs.map((t) => t?.userId || t?.userPhone || t?.senderPhone || t?.userName || t?.id)
    );

    const sadaqahDisbursedTxs = transactions.filter((t) => {
      if (!isOk(t)) return false;
      const tp = String(t?.type || '');
      const cat = String(t?.category || '');
      return (
        tp === 'general_charity_disbursed' ||
        tp === 'sadaqah_disbursement' ||
        cat === 'charity_disbursement' ||
        cat === 'charity_aid'
      );
    });
    const baseSadaqahOut = Number(appConfig?.generalCharityDisbursed || 0) || 0;
    const sadaqahDisbursedSum = sadaqahDisbursedTxs.reduce((s, t) => s + Math.max(0, Number(t?.amount) || 0), 0);
    const sadaqahTotalDisbursed = baseSadaqahOut + sadaqahDisbursedSum;
    const sadaqahAvailableBalance = Math.max(0, sadaqahTotalCollected - sadaqahTotalDisbursed);

    return {
      qardTotalFund,
      qardTotalDonated,
      pureQardDonatedCount: pureQardDonorTxs.length,
      qardDonorCount: uniqueQardDonorKeys.size || qardDonorTxs.length,
      qardTotalDisbursed,
      qardBorrowerCount: Math.max(uniqueBorrowerKeys.size, activeBorrowers.length),
      qardActiveBorrowersCount: activeBorrowers.length,
      qardTotalRepaid,
      qardActiveDue,
      qardAvailableCash,
      qardOverdueCount: overdueBorrowers.length,
      qardLifetimeBannedCount: lifetimeBannedUsers.length,
      sadaqahTotalCollected,
      sadaqahDonorCount: uniqueSadaqahDonors.size || sadaqahDonorTxs.length,
      sadaqahDonationsCount: sadaqahDonorTxs.length,
      sadaqahTotalDisbursed,
      sadaqahRecipientCount: sadaqahDisbursedTxs.length,
      sadaqahAvailableBalance
    };
  }, [transactions, users, appConfig?.qardBaseFund, appConfig?.companyFundBalances, appConfig?.generalCharityTotal, appConfig?.generalCharityDisbursed]);

  return {
    allManualEntries,
    samityCustodyEntries,
    safeDealOrders,
    escrowDisputes,
    safeDealsConfig: appConfig?.safeDealsConfig,
    loadingEntries,
    allSectionsStatsMap,
    computeSectionStats,
    computeSamityCapitalAudit,
    computeSafeDealsSummary,
    computeQardSadaqahAudit,
    addAuditEntry,
    updateAuditEntry,
    deleteAuditEntry,
    saveSectionManualTune,
    saveSamityCapitalTune,
    addSamityCustodyEntry,
    updateSamityCustodyEntry,
    deleteSamityCustodyEntry
  };
}

export type SectionAuditsEngineReturn = ReturnType<typeof useSectionAuditsEngine>;

function entryTypeBadge(t: AuditEntryType) {
  switch (t) {
    case 'profit':
      return {
        label: 'লাভ (Profit)',
        cls: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        amountCls: 'text-emerald-700',
        sign: '+'
      };
    case 'loss':
      return {
        label: 'লস (Loss)',
        cls: 'bg-rose-100 text-rose-900 border-rose-300',
        amountCls: 'text-rose-700',
        sign: '-'
      };
    case 'expense':
      return {
        label: 'খরচ (Expense)',
        cls: 'bg-amber-100 text-amber-900 border-amber-300',
        amountCls: 'text-amber-800',
        sign: '-'
      };
    case 'revenue':
    default:
      return {
        label: 'আয়/জমা (Revenue)',
        cls: 'bg-sky-100 text-sky-900 border-sky-300',
        amountCls: 'text-sky-800',
        sign: '+'
      };
  }
}

/* ============================================================================
 * 1. DASHBOARD 3 x 4 = 12 SECTION AUDIT & EXPENSE CONTROL MATRIX
 *    Matches the exact green-marked `🏛️ কোম্পানির আর্থিক স্থিতি ও ব্যালেন্স কন্ট্রোল` box!
 * ============================================================================ */
export function AdminDashboardSectionAuditMatrix(props: {
  sectionAuditEngine?: SectionAuditsEngineReturn;
  openSectionAuditModal?: (sectionKey: AuditSectionKey, initialTab?: 'ledger' | 'tune' | 'auto') => void;
  setAdminTab?: (tab: string) => void;
  setViewingGrid?: (val: boolean) => void;
}) {
  const { sectionAuditEngine, openSectionAuditModal } = props;
  if (!sectionAuditEngine) return null;

  const { allSectionsStatsMap } = sectionAuditEngine;

  const grandTotals = ALL_AUDIT_SECTION_KEYS.reduce(
    (acc, k) => {
      const s = allSectionsStatsMap[k];
      if (!s) return acc;
      acc.profit += s.effectiveProfit;
      acc.loss += s.effectiveLoss;
      acc.expense += s.effectiveExpense;
      acc.net += s.netResult;
      return acc;
    },
    { profit: 0, loss: 0, expense: 0, net: 0 }
  );

  return (
    <div className="bg-white border border-emerald-300/90 rounded-3xl p-4 sm:p-5 shadow-xs text-left mb-4 font-sans space-y-3.5">
      {/* Header matching green-marked Balance Control Box */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse shrink-0" />
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-1.5">
              📊 ১২ সেকশন পৃথক অডিট ও খরচের হিসাব কন্ট্রোল
            </h3>
            <span className="text-[10px] text-slate-500 font-bold block">
              3 × 4 লেআউট • প্রত্যেক সেকশনের আলাদা লাভ, লস ও খরচের খাতা (বক্সে টিপ দিন)
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => openSectionAuditModal && openSectionAuditModal('samity', 'ledger')}
            className="bg-[#008769] hover:bg-[#006e55] text-white text-xs font-black px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" /> পৃথক খরচ/লাভ লিখুন
          </button>
          <button
            type="button"
            onClick={() => openSectionAuditModal && openSectionAuditModal('samity', 'tune')}
            className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
          >
            <Settings className="w-3.5 h-3.5 text-amber-600" /> ⚙️ সেকশন টিউন/এডিট
          </button>
        </div>
      </div>

      {/* Compact Grand Summary Strip across all 12 Sections */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl px-2 py-1.5 flex flex-col">
          <span className="text-[8.5px] sm:text-[10px] font-bold text-emerald-800 truncate">মোট লাভ (১২ সেকশন)</span>
          <span className="text-[11px] sm:text-sm font-black font-mono text-emerald-950 truncate">
            {formatEngBDT(grandTotals.profit)}
          </span>
        </div>
        <div className="bg-rose-50/90 border border-rose-200 rounded-xl px-2 py-1.5 flex flex-col">
          <span className="text-[8.5px] sm:text-[10px] font-bold text-rose-800 truncate">মোট লস (১২ সেকশন)</span>
          <span className="text-[11px] sm:text-sm font-black font-mono text-rose-950 truncate">
            {formatEngBDT(grandTotals.loss)}
          </span>
        </div>
        <div className="bg-amber-50/90 border border-amber-200 rounded-xl px-2 py-1.5 flex flex-col">
          <span className="text-[8.5px] sm:text-[10px] font-bold text-amber-900 truncate">মোট খরচ (১২ সেকশন)</span>
          <span className="text-[11px] sm:text-sm font-black font-mono text-amber-950 truncate">
            {formatEngBDT(grandTotals.expense)}
          </span>
        </div>
        <div
          className={`rounded-xl px-2 py-1.5 flex flex-col border ${
            grandTotals.net >= 0
              ? 'bg-slate-900 text-white border-slate-800'
              : 'bg-rose-950 text-white border-rose-800'
          }`}
        >
          <span className="text-[8.5px] sm:text-[10px] font-bold text-emerald-300 truncate">
            {grandTotals.net >= 0 ? 'সর্বমোট নিট লাভ' : 'সর্বমোট নিট ঘাটতি'}
          </span>
          <span className="text-[11px] sm:text-sm font-black font-mono text-white truncate">
            {grandTotals.net < 0 ? '-' : ''}
            {formatEngBDT(Math.abs(grandTotals.net))}
          </span>
        </div>
      </div>

      {/* 3 x 4 = 12 Section Audit Boxes (Identical 4-column grid as Green Box!) */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5">
        {ALL_AUDIT_SECTION_KEYS.map((secKey) => {
          const meta = SECTION_META_MAP[secKey];
          const st = allSectionsStatsMap[secKey];
          const isSamitySec = secKey === 'samity';
          const samityCap = isSamitySec && sectionAuditEngine.computeSamityCapitalAudit
            ? sectionAuditEngine.computeSamityCapitalAudit(new Date().getFullYear())
            : null;
          const totalOut = (st?.effectiveExpense || 0) + (st?.effectiveLoss || 0);
          return (
            <div
              key={secKey}
              onClick={() => openSectionAuditModal && openSectionAuditModal(secKey, 'ledger')}
              className={`${meta.boxBgClass} border p-2 sm:p-2.5 rounded-xl sm:rounded-2xl flex flex-col justify-between shadow-2xs cursor-pointer transition active:scale-98 min-h-[70px] sm:min-h-[82px] relative overflow-hidden`}
            >
              <div className={`flex justify-between items-center text-[8.5px] sm:text-[11px] font-extrabold ${meta.boxTextClass}`}>
                <span className="truncate">{meta.shortTitle}</span>
                <span className="text-[10px] sm:text-xs shrink-0">{meta.emoji}</span>
              </div>

              {isSamitySec && samityCap ? (
                <div className="mt-1 space-y-0.5">
                  <div className="flex items-center justify-between text-[8px] sm:text-[10px] font-bold leading-tight">
                    <span className="text-teal-800">পুঁজি:</span>
                    <span className="font-mono font-black text-teal-950 truncate">
                      {formatEngBDT(samityCap.totalSamityCapital)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[8px] sm:text-[10px] font-bold leading-tight">
                    <span className="text-indigo-800">ইনভেস্ট:</span>
                    <span className="font-mono font-black text-indigo-950 truncate">
                      {formatEngBDT(samityCap.totalInvestedBuy)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[8px] sm:text-[10px] font-bold leading-tight border-t border-slate-900/10 pt-0.5">
                    <span className="text-emerald-900">ক্যাশ:</span>
                    <span className="font-mono font-black text-emerald-950 truncate">
                      {formatEngBDT(samityCap.cashRemainingInHand)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-1 space-y-0.5">
                  <div className="flex items-center justify-between text-[8px] sm:text-[10px] font-bold leading-tight">
                    <span className="text-emerald-800">লাভ:</span>
                    <span className="font-mono font-black text-emerald-900 truncate">
                      {formatEngBDT(st?.effectiveProfit || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[8px] sm:text-[10px] font-bold leading-tight">
                    <span className="text-rose-800">লস:</span>
                    <span className="font-mono font-black text-rose-900 truncate">
                      {formatEngBDT(st?.effectiveLoss || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[8px] sm:text-[10px] font-bold leading-tight border-t border-slate-900/10 pt-0.5">
                    <span className="text-amber-900">খরচ:</span>
                    <span className="font-mono font-black text-amber-950 truncate">
                      {formatEngBDT(st?.effectiveExpense || 0)}
                    </span>
                  </div>
                </div>
              )}

              {st?.hasAnyOverride && (
                <span
                  title="ম্যানুয়াল টিউন সক্রিয়"
                  className="absolute bottom-1 left-1 w-1.5 h-1.5 rounded-full bg-amber-500"
                />
              )}
              {totalOut === 0 && (st?.effectiveProfit || 0) === 0 && (
                <span className="sr-only">খাতা খুলুন</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================================
 * 2. IN-SECTION AUDIT & SEPARATE EXPENSE BAR (`!viewingGrid`)
 *    Shows Green-Box-Style 4 Metric Cards + 1-Tap Inline Quick Expense/P&L Form
 *    right inside each of the 12 sections (zero modal required for quick entry!)
 * ============================================================================ */
interface AdminSectionAuditBarProps {
  adminTab: string;
  sectionAuditEngine?: SectionAuditsEngineReturn;
  openSectionAuditModal?: (sectionKey: AuditSectionKey, initialTab?: 'ledger' | 'tune' | 'auto') => void;
  requestAlert?: (title: string, message: string) => void;
}

export default function AdminSectionAuditBar({
  adminTab,
  sectionAuditEngine,
  openSectionAuditModal,
  requestAlert
}: AdminSectionAuditBarProps) {
  const sectionKey = normalizeAuditSectionKey(adminTab);

  const [period, setPeriod] = useState<'all' | 'today' | '7d' | 'month'>('all');
  const [samityAuditYear, setSamityAuditYear] = useState<number>(() => {
    const y = new Date().getFullYear();
    return y >= 2026 && y <= 2050 ? y : 2026;
  });
  const [showMonthlyGrid, setShowMonthlyGrid] = useState<boolean>(true);
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [quickType, setQuickType] = useState<AuditEntryType>('expense');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickCategory, setQuickCategory] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickMsg, setQuickMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [samitySelectedMonthId, setSamitySelectedMonthId] = useState<string | null>(null);
  const [samityMonthTab, setSamityMonthTab] = useState<'paid' | 'unpaid'>('paid');
  const [samityMonthSearch, setSamityMonthSearch] = useState('');
  const [samityFormTab, setSamityFormTab] = useState<'entry' | 'tune'>('entry');
  const [quickMemberName, setQuickMemberName] = useState('');
  const [quickMonthId, setQuickMonthId] = useState('');
  const [editingQuickEntry, setEditingQuickEntry] = useState<SectionAuditEntry | null>(null);
  const [samityTuneDraft, setSamityTuneDraft] = useState<Record<string, string>>({});
  const [savingSamityTune, setSavingSamityTune] = useState(false);

  // Samity Fund Custody Panel ("কার কাছে কত টাকা আছে" — ব্যাংক, বিকাশ, নগদ, হাতে ক্যাশ)
  const [showCustodyPanel, setShowCustodyPanel] = useState(false);
  const [showCustodyForm, setShowCustodyForm] = useState(false);
  const [editingCustodyItem, setEditingCustodyItem] = useState<SamityCustodyEntry | null>(null);
  const [custodyHolderName, setCustodyHolderName] = useState('');
  const [custodyChannel, setCustodyChannel] = useState<SamityCustodyChannel>('bank');
  const [custodyAccountInfo, setCustodyAccountInfo] = useState('');
  const [custodyAmount, setCustodyAmount] = useState('');
  const [custodyNote, setCustodyNote] = useState('');
  const [custodySaving, setCustodySaving] = useState(false);
  const [custodyConfirmDeleteId, setCustodyConfirmDeleteId] = useState<string | null>(null);
  const [custodyFeedback, setCustodyFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setShowInlineForm(false);
    setQuickTitle('');
    setQuickAmount('');
    setQuickMemberName('');
    setQuickMonthId('');
    setEditingQuickEntry(null);
    setQuickMsg(null);
    setSamitySelectedMonthId(null);
    setShowCustodyPanel(false);
    setShowCustodyForm(false);
    setEditingCustodyItem(null);
    setCustodyHolderName('');
    setCustodyChannel('bank');
    setCustodyAccountInfo('');
    setCustodyAmount('');
    setCustodyNote('');
    setCustodyConfirmDeleteId(null);
    setCustodyFeedback(null);
    if (sectionKey) {
      setQuickCategory(SECTION_META_MAP[sectionKey].expenseCategories[0] || 'অন্যান্য খরচ');
      if (sectionKey === 'samity') {
        setQuickType('revenue');
      } else {
        setQuickType('expense');
      }
    }
  }, [sectionKey]);

  useEffect(() => {
    if (sectionKey !== 'samity' || !sectionAuditEngine) return;
    const cap = sectionAuditEngine.computeSamityCapitalAudit?.(samityAuditYear);
    if (!cap) return;
    const keys = [
      'totalSamityCapital',
      'currentMonthCollected',
      'yearTotalCollected',
      'monthlyExpectedTarget',
      'totalInvestedBuy',
      'activeInvestedBuy',
      'cashRemainingInHand',
      'switchOffRefundAmount'
    ] as const;
    const nextDraft: Record<string, string> = {};
    keys.forEach((k) => {
      const autoVal = (cap.autoValues as any)?.[k];
      const activeVal = (cap as any)[k];
      nextDraft[k] = activeVal !== autoVal ? String(activeVal) : '';
    });
    setSamityTuneDraft(nextDraft);
  }, [sectionKey, samityAuditYear, showInlineForm, samityFormTab]);

  if (!sectionKey || !sectionAuditEngine) return null;

  const meta = SECTION_META_MAP[sectionKey];
  const stats = sectionAuditEngine.computeSectionStats(sectionKey, period);
  const samityCap = sectionKey === 'samity' && sectionAuditEngine.computeSamityCapitalAudit
    ? sectionAuditEngine.computeSamityCapitalAudit(samityAuditYear)
    : null;

  const handleQuickSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickMsg(null);
    setQuickSaving(true);
    try {
      const monthKeyVal = quickMonthId ? `${samityAuditYear}-${quickMonthId}` : undefined;
      const numericAmt = Number(convertBengaliToEnglishDigits(quickAmount));
      if (editingQuickEntry) {
        await sectionAuditEngine.updateAuditEntry(editingQuickEntry.id, {
          entryType: quickType,
          title: quickTitle,
          amount: numericAmt,
          category: quickCategory || meta.expenseCategories[0],
          monthKey: monthKeyVal || '',
          memberName: quickMemberName.trim()
        });
        setEditingQuickEntry(null);
        setQuickMsg({ type: 'ok', text: '✅ ম্যানুয়াল এন্ট্রি সফলভাবে আপডেট হয়েছে!' });
      } else {
        await sectionAuditEngine.addAuditEntry({
          sectionKey,
          entryType: quickType,
          title: quickTitle,
          amount: numericAmt,
          category: quickCategory || meta.expenseCategories[0],
          monthKey: monthKeyVal,
          memberName: quickMemberName.trim() || undefined
        });
        setQuickMsg({ type: 'ok', text: '✅ সফলভাবে এই সেকশনের পৃথক খাতায় সংরক্ষিত হয়েছে!' });
      }
      setQuickTitle('');
      setQuickAmount('');
      setQuickMemberName('');
      setQuickMonthId('');
      setTimeout(() => setQuickMsg(null), 3500);
    } catch (err: any) {
      const m = err?.message || 'সংরক্ষণ করতে সমস্যা হয়েছে।';
      setQuickMsg({ type: 'err', text: m });
      if (requestAlert) requestAlert('অডিট এন্ট্রি ত্রুটি', m);
    } finally {
      setQuickSaving(false);
    }
  };

  const handleSaveSamityTuneForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionAuditEngine.saveSamityCapitalTune) return;
    setQuickMsg(null);
    setSavingSamityTune(true);
    try {
      const patch: Record<string, number | null> = {};
      const fields = [
        'totalSamityCapital',
        'currentMonthCollected',
        'yearTotalCollected',
        'monthlyExpectedTarget',
        'totalInvestedBuy',
        'activeInvestedBuy',
        'cashRemainingInHand',
        'switchOffRefundAmount'
      ];
      fields.forEach((f) => {
        const cleaned = convertBengaliToEnglishDigits(String(samityTuneDraft[f] || '')).trim();
        if (cleaned === '') {
          patch[f] = null;
        } else {
          const n = Number(cleaned);
          if (!isFinite(n) || n < 0) {
            throw new Error('সব টিউন ঘরে সঠিক সংখ্যা (০ বা তার বেশি) লিখুন অথবা অটো রাখতে খালি রাখুন।');
          }
          patch[f] = n;
        }
      });
      await sectionAuditEngine.saveSamityCapitalTune(patch);
      setQuickMsg({ type: 'ok', text: '✅ ৮টি সমবায় অডিট কার্ডের ম্যানুয়াল তথ্য সংরক্ষিত হয়েছে!' });
      setTimeout(() => setQuickMsg(null), 3500);
    } catch (err: any) {
      const m = err?.message || 'সংরক্ষণ করতে সমস্যা হয়েছে।';
      setQuickMsg({ type: 'err', text: m });
      if (requestAlert) requestAlert('ম্যানুয়াল টিউন ত্রুটি', m);
    } finally {
      setSavingSamityTune(false);
    }
  };

  const handleResetSamityTune = async () => {
    if (!sectionAuditEngine.saveSamityCapitalTune) return;
    setSavingSamityTune(true);
    try {
      await sectionAuditEngine.saveSamityCapitalTune({
        totalSamityCapital: null,
        currentMonthCollected: null,
        yearTotalCollected: null,
        monthlyExpectedTarget: null,
        totalInvestedBuy: null,
        activeInvestedBuy: null,
        cashRemainingInHand: null,
        switchOffRefundAmount: null
      });
      setSamityTuneDraft({});
      setQuickMsg({ type: 'ok', text: '🔄 সব ৮টি অডিট কার্ড অটোমেটিক হিসাবে ফিরিয়ে আনা হয়েছে!' });
      setTimeout(() => setQuickMsg(null), 3500);
    } catch (err: any) {
      setQuickMsg({ type: 'err', text: err?.message || 'রিসেট করতে সমস্যা হয়েছে।' });
    } finally {
      setSavingSamityTune(false);
    }
  };

  const resetCustodyForm = () => {
    setEditingCustodyItem(null);
    setCustodyHolderName('');
    setCustodyChannel('bank');
    setCustodyAccountInfo('');
    setCustodyAmount('');
    setCustodyNote('');
  };

  const handleSaveCustody = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionAuditEngine.addSamityCustodyEntry || !sectionAuditEngine.updateSamityCustodyEntry) return;
    setCustodyFeedback(null);
    setCustodySaving(true);
    try {
      const numericAmt = Number(convertBengaliToEnglishDigits(custodyAmount));
      if (!custodyHolderName.trim()) {
        throw new Error('কার কাছে টাকা আছে তা লিখুন (যেমন: আমার কাছে / মোঃ করিম)।');
      }
      if (!isFinite(numericAmt) || numericAmt < 0) {
        throw new Error('সঠিক টাকার পরিমাণ লিখুন।');
      }

      if (editingCustodyItem) {
        await sectionAuditEngine.updateSamityCustodyEntry(editingCustodyItem.id, {
          holderName: custodyHolderName.trim(),
          channel: custodyChannel,
          accountInfo: custodyAccountInfo.trim(),
          amount: numericAmt,
          note: custodyNote.trim()
        });
        setCustodyFeedback({
          type: 'ok',
          text: '✅ তথ্য আপডেট হয়েছে এবং ১. মোট পুঁজি কার্ডে যোগফল আপডেট হয়েছে!'
        });
      } else {
        await sectionAuditEngine.addSamityCustodyEntry({
          holderName: custodyHolderName.trim(),
          channel: custodyChannel,
          accountInfo: custodyAccountInfo.trim(),
          amount: numericAmt,
          note: custodyNote.trim()
        });
        setCustodyFeedback({
          type: 'ok',
          text: '✅ নতুন হিসাব যুক্ত হয়েছে এবং ১. মোট পুঁজি কার্ডে স্বয়ংক্রিয়ভাবে যোগ হয়েছে!'
        });
      }

      // Clear any manual override on Card 1 so Card 1 reflects the live custody sum automatically
      if (
        samityCap &&
        samityCap.totalSamityCapital !== samityCap.autoValues.totalSamityCapital &&
        sectionAuditEngine.saveSamityCapitalTune
      ) {
        await sectionAuditEngine.saveSamityCapitalTune({ totalSamityCapital: null });
      }

      resetCustodyForm();
      setShowCustodyForm(false);
      setTimeout(() => setCustodyFeedback(null), 4000);
    } catch (err: any) {
      const m = err?.message || 'সংরক্ষণ করতে সমস্যা হয়েছে।';
      setCustodyFeedback({ type: 'err', text: m });
      if (requestAlert) requestAlert('মোট পুঁজি কাস্টডি ত্রুটি', m);
    } finally {
      setCustodySaving(false);
    }
  };

  const handleStartEditCustody = (item: SamityCustodyEntry) => {
    setEditingCustodyItem(item);
    setCustodyHolderName(item.holderName || '');
    setCustodyChannel(item.channel || 'bank');
    setCustodyAccountInfo(item.accountInfo || '');
    setCustodyAmount(String(item.amount ?? ''));
    setCustodyNote(item.note || '');
    setShowCustodyForm(true);
    setCustodyConfirmDeleteId(null);
    setCustodyFeedback(null);
  };

  const handleDeleteCustody = async (id: string) => {
    if (!sectionAuditEngine.deleteSamityCustodyEntry) return;
    setCustodySaving(true);
    try {
      await sectionAuditEngine.deleteSamityCustodyEntry(id);
      if (editingCustodyItem?.id === id) {
        resetCustodyForm();
        setShowCustodyForm(false);
      }
      setCustodyConfirmDeleteId(null);
      setCustodyFeedback({ type: 'ok', text: '🗑️ এন্ট্রি মুছে ফেলা হয়েছে এবং মোট পুঁজি আপডেট হয়েছে।' });
      setTimeout(() => setCustodyFeedback(null), 3500);
    } catch (err: any) {
      setCustodyFeedback({ type: 'err', text: err?.message || 'মুছে ফেলতে সমস্যা হয়েছে।' });
    } finally {
      setCustodySaving(false);
    }
  };

  /* DEDICATED 8-CARD AUTOMATIC AUDIT VIEW FOR SAMITY (NO PROFIT/LOSS) */
  if (sectionKey === 'samity' && samityCap) {
    const currentYear = new Date().getFullYear();
    const selectedMonthObj = samitySelectedMonthId
      ? samityCap.monthlyBreakdown.find((m) => m.id === samitySelectedMonthId) || null
      : null;

    const samityManualList = stats.manualEntries;
    const monthSearchLower = samityMonthSearch.trim().toLowerCase();
    const filteredPayers = selectedMonthObj
      ? selectedMonthObj.payers.filter(
          (p) =>
            !monthSearchLower ||
            p.name.toLowerCase().includes(monthSearchLower) ||
            p.memberId.toLowerCase().includes(monthSearchLower) ||
            p.phone.toLowerCase().includes(monthSearchLower) ||
            p.tierLabel.toLowerCase().includes(monthSearchLower)
        )
      : [];
    const filteredUnpaid = selectedMonthObj
      ? selectedMonthObj.unpaidMembers.filter(
          (u) =>
            !monthSearchLower ||
            u.name.toLowerCase().includes(monthSearchLower) ||
            u.memberId.toLowerCase().includes(monthSearchLower) ||
            u.phone.toLowerCase().includes(monthSearchLower)
        )
      : [];

    const tierBadgeCls: Record<SamityTierKey, string> = {
      owner: 'bg-rose-100 text-rose-900 border-rose-300',
      shareholder: 'bg-sky-100 text-sky-900 border-sky-300',
      investor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      supporter: 'bg-amber-100 text-amber-900 border-amber-300',
      regular: 'bg-slate-100 text-slate-800 border-slate-300'
    };

    return (
      <div className="mb-3 bg-white border-2 border-emerald-500/40 rounded-3xl p-2.5 sm:p-4 shadow-xs text-left font-sans space-y-2.5">
        {/* Compact Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-md">
                  সমবায় পুঁজি অডিট (৮টি কার্ড)
                </span>
                <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-md border bg-teal-50 text-teal-900 border-teal-200">
                  শুধু পুঁজি জমা • লাভ/লস নেই
                </span>
                {samityCap.hasAnyOverride && (
                  <span className="text-[9.5px] font-black px-2 py-0.5 rounded-md border bg-amber-100 text-amber-900 border-amber-300">
                    ⚙️ ম্যানুয়াল টিউন চালু
                  </span>
                )}
              </div>
              <h3 className="text-[11.5px] sm:text-sm font-black text-slate-800 truncate mt-0.5">
                🏛️ BNB কোম্পানি ইনভেস্টর — মূল পুঁজি, ১২ মাস আদায় ও বিনিয়োগ হিসাব
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap shrink-0">
            <select
              value={samityAuditYear}
              onChange={(e) => {
                setSamityAuditYear(Number(e.target.value));
              }}
              aria-label="অডিট বছর"
              className="text-[10.5px] sm:text-[11px] font-black bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-xl px-2 py-1.5 outline-none focus:border-emerald-600 cursor-pointer"
            >
              {SAMITY_YEARS.map((yr) => (
                <option key={yr} value={yr}>
                  📅 {yr}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                setShowCustodyPanel((prev) => {
                  const next = !prev;
                  if (next && samityCap.custodyEntriesCount === 0) {
                    setShowCustodyForm(true);
                  }
                  return next;
                });
              }}
              className={`text-[10.5px] sm:text-[11px] font-black px-2 sm:px-2.5 py-1.5 rounded-xl border transition cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95 ${
                showCustodyPanel
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border-emerald-300'
              }`}
            >
              <Wallet className="w-3 h-3" />
              <span>কার কাছে কত ({samityCap.custodyEntriesCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setShowMonthlyGrid((v) => !v)}
              className="bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 text-[10.5px] sm:text-[11px] font-black px-2 sm:px-2.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
            >
              <Calendar className="w-3 h-3" />
              <span>{showMonthlyGrid ? '১২ মাস ▴' : '১২ মাস ▾'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowInlineForm((v) => !v)}
              className={`text-[10.5px] sm:text-[11px] font-black px-2 sm:px-2.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95 ${
                showInlineForm
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-[#008769] hover:bg-[#006e55] text-white'
              }`}
            >
              <Pencil className="w-3 h-3" />
              <span>{showInlineForm ? 'ফর্ম বন্ধ' : 'ম্যানুয়াল ফরম'}</span>
            </button>

            <button
              type="button"
              onClick={() => openSectionAuditModal && openSectionAuditModal('samity', 'ledger')}
              className="bg-slate-900 hover:bg-slate-800 text-white text-[10.5px] sm:text-[11px] font-black px-2 sm:px-2.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
            >
              <FolderOpen className="w-3 h-3 text-amber-300" />
              <span>খাতা ({stats.manualEntries.length})</span>
            </button>
          </div>
        </div>

        {/* 8 AUTOMATIC AUDIT CARDS — ALWAYS 2 ROWS × 4 COLUMNS (compact & neat on mobile + desktop) */}
        <div className="grid grid-cols-4 gap-1 sm:gap-2">
          {/* Card 1: মোট পুঁজি (ট্যাপ করলে কার কাছে কত টাকা আছে তা বিস্তারিত দেখাবে ও এডিট/যোগ করা যাবে) */}
          <div
            onClick={() => {
              setShowCustodyPanel((prev) => {
                const next = !prev;
                if (next && samityCap.custodyEntriesCount === 0) {
                  setShowCustodyForm(true);
                }
                return next;
              });
            }}
            className={`bg-gradient-to-br from-[#008769] to-[#006e55] text-white p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl shadow-2xs flex flex-col justify-between cursor-pointer hover:opacity-95 transition min-h-[54px] sm:min-h-[66px] ${
              showCustodyPanel ? 'ring-2 ring-emerald-300 ring-offset-1' : ''
            }`}
          >
            <div className="flex justify-between items-center text-[7.5px] sm:text-[10px] font-extrabold text-teal-100 gap-0.5">
              <span className="truncate">১. মোট পুঁজি</span>
              <Wallet className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-teal-100 shrink-0" />
            </div>
            <div className="text-[10.5px] sm:text-sm font-black text-white font-mono truncate leading-tight">
              {formatEngBDT(samityCap.totalSamityCapital)}
            </div>
            <div className="text-[7px] sm:text-[9px] text-teal-100/90 font-bold truncate">
              {samityCap.custodyEntriesCount > 0
                ? `${samityCap.custodyEntriesCount} জায়গায় • ট্যাপ দেখুন`
                : `${samityCap.registeredInvestorsCount} জন • ট্যাপ লিখুন`}
            </div>
          </div>

          {/* Card 2: চলতি মাস */}
          <div
            onClick={() => {
              setShowMonthlyGrid(true);
              setSamitySelectedMonthId(samityCap.currentMonthId);
              setSamityMonthTab('paid');
            }}
            className="bg-emerald-50/95 border border-emerald-200 p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl text-slate-800 flex flex-col justify-between shadow-2xs cursor-pointer hover:bg-emerald-100/80 transition min-h-[54px] sm:min-h-[66px]"
          >
            <div className="flex justify-between items-center text-[7.5px] sm:text-[10px] font-extrabold text-emerald-900 gap-0.5">
              <span className="truncate">২. {samityCap.currentMonthName}</span>
              <TrendingUp className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-emerald-700 shrink-0" />
            </div>
            <div className="text-[10.5px] sm:text-sm font-black text-emerald-950 font-mono truncate leading-tight">
              {formatEngBDT(samityCap.currentMonthCollected)}
            </div>
            <div className="text-[7px] sm:text-[9px] text-emerald-800 font-bold truncate">
              লক্ষ্য: {formatEngBDT(samityCap.monthlyExpectedTarget)}
            </div>
          </div>

          {/* Card 3: নির্বাচিত বছরে আদায় */}
          <div
            onClick={() => setShowMonthlyGrid(true)}
            className="bg-sky-50/95 border border-sky-200 p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl text-slate-800 flex flex-col justify-between shadow-2xs cursor-pointer hover:bg-sky-100/80 transition min-h-[54px] sm:min-h-[66px]"
          >
            <div className="flex justify-between items-center text-[7.5px] sm:text-[10px] font-extrabold text-sky-900 gap-0.5">
              <span className="truncate">৩. {samityAuditYear} আদায়</span>
              <PieChart className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-sky-700 shrink-0" />
            </div>
            <div className="text-[10.5px] sm:text-sm font-black text-sky-950 font-mono truncate leading-tight">
              {formatEngBDT(samityCap.yearTotalCollected)}
            </div>
            <div className="text-[7px] sm:text-[9px] text-sky-800 font-bold truncate">
              {samityCap.yearPaidInstallmentsCount}টি কিস্তি
            </div>
          </div>

          {/* Card 4: মাসিক নির্ধারিত হার */}
          <div
            onClick={() => {
              setSamityFormTab('tune');
              setShowInlineForm(true);
            }}
            className="bg-teal-50/95 border border-teal-200 p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl text-slate-800 flex flex-col justify-between shadow-2xs cursor-pointer hover:bg-teal-100/80 transition min-h-[54px] sm:min-h-[66px]"
          >
            <div className="flex justify-between items-center text-[7.5px] sm:text-[10px] font-extrabold text-teal-900 gap-0.5">
              <span className="truncate">৪. মাসিক হার</span>
              <CheckCircle2 className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-teal-700 shrink-0" />
            </div>
            <div className="text-[10.5px] sm:text-sm font-black text-teal-950 font-mono truncate leading-tight">
              {formatEngBDT(samityCap.monthlyExpectedTarget)}
            </div>
            <div className="text-[7px] sm:text-[9px] text-teal-800 font-bold truncate">
              ON: {samityCap.activeSwitchOnCount} জন
            </div>
          </div>

          {/* Card 5: ইনভেস্টারে মোট কেনা */}
          <div
            onClick={() => openSectionAuditModal && openSectionAuditModal('samity', 'auto')}
            className="bg-indigo-50/95 border border-indigo-200 p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl text-slate-800 flex flex-col justify-between shadow-2xs cursor-pointer hover:bg-indigo-100/80 transition min-h-[54px] sm:min-h-[66px]"
          >
            <div className="flex justify-between items-center text-[7.5px] sm:text-[10px] font-extrabold text-indigo-900 gap-0.5">
              <span className="truncate">৫. মোট কেনা</span>
              <Receipt className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-indigo-700 shrink-0" />
            </div>
            <div className="text-[10.5px] sm:text-sm font-black text-indigo-950 font-mono truncate leading-tight">
              {formatEngBDT(samityCap.totalInvestedBuy)}
            </div>
            <div className="text-[7px] sm:text-[9px] text-indigo-800 font-bold truncate">
              {samityCap.totalProjectsCount}টি প্রজেক্ট
            </div>
          </div>

          {/* Card 6: চলমান প্রজেক্ট */}
          <div
            onClick={() => openSectionAuditModal && openSectionAuditModal('samity', 'auto')}
            className="bg-purple-50/95 border border-purple-200 p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl text-slate-800 flex flex-col justify-between shadow-2xs cursor-pointer hover:bg-purple-100/80 transition min-h-[54px] sm:min-h-[66px]"
          >
            <div className="flex justify-between items-center text-[7.5px] sm:text-[10px] font-extrabold text-purple-900 gap-0.5">
              <span className="truncate">৬. চলমান প্রজেক্ট</span>
              <SlidersHorizontal className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-purple-700 shrink-0" />
            </div>
            <div className="text-[10.5px] sm:text-sm font-black text-purple-950 font-mono truncate leading-tight">
              {formatEngBDT(samityCap.activeInvestedBuy)}
            </div>
            <div className="text-[7px] sm:text-[9px] text-purple-800 font-bold truncate">
              {samityCap.activeProjectsCount}টি • বিক্রি {formatEngBDT(samityCap.totalSoldValue)}
            </div>
          </div>

          {/* Card 7: হাতে থাকা নগদ তহবিল */}
          <div
            onClick={() => {
              setSamityFormTab('tune');
              setShowInlineForm(true);
            }}
            className="bg-slate-900 text-white border border-slate-800 p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl flex flex-col justify-between shadow-2xs cursor-pointer hover:bg-slate-800 transition min-h-[54px] sm:min-h-[66px]"
          >
            <div className="flex justify-between items-center text-[7.5px] sm:text-[10px] font-extrabold text-emerald-300 gap-0.5">
              <span className="truncate">৭. হাতে নগদ</span>
              <Wallet className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" />
            </div>
            <div className="text-[10.5px] sm:text-sm font-black text-white font-mono truncate leading-tight">
              {formatEngBDT(samityCap.cashRemainingInHand)}
            </div>
            <div className="text-[7px] sm:text-[9px] text-slate-300 font-bold truncate">
              পুঁজি − চলমান
            </div>
          </div>

          {/* Card 8: সুইচ অফ (২৫ ডিসে. রিফান্ড) */}
          <div
            onClick={() => openSectionAuditModal && openSectionAuditModal('samity', 'auto')}
            className="bg-amber-50/95 border border-amber-300 p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl text-slate-800 flex flex-col justify-between shadow-2xs cursor-pointer hover:bg-amber-100/80 transition min-h-[54px] sm:min-h-[66px]"
          >
            <div className="flex justify-between items-center text-[7.5px] sm:text-[10px] font-extrabold text-amber-950 gap-0.5">
              <span className="truncate">৮. সুইচ অফ</span>
              <RotateCcw className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-amber-700 shrink-0" />
            </div>
            <div className="text-[10.5px] sm:text-sm font-black text-amber-950 font-mono truncate leading-tight">
              {formatEngBDT(samityCap.switchOffRefundAmount)}
            </div>
            <div className="text-[7px] sm:text-[9px] text-amber-900 font-bold truncate">
              {samityCap.switchOffCount} অফ • {formatEngBDT(samityCap.totalWithdrawnRefunded)}
            </div>
          </div>
        </div>

        {/* CARD 1 DRILLDOWN: মোট পুঁজি বিস্তারিত — কার কাছে কত টাকা আছে (ব্যাংক, বিকাশ, নগদ, হাতে ক্যাশ) */}
        {showCustodyPanel && (() => {
          const channelList: Array<{
            k: SamityCustodyChannel;
            label: string;
            icon: string;
            badgeCls: string;
          }> = [
            { k: 'bank', label: 'ব্যাংক', icon: '🏦', badgeCls: 'bg-sky-100 text-sky-900 border-sky-300' },
            { k: 'bkash', label: 'বিকাশ', icon: '📱', badgeCls: 'bg-pink-100 text-pink-900 border-pink-300' },
            { k: 'nagad', label: 'নগদ', icon: '🟠', badgeCls: 'bg-orange-100 text-orange-900 border-orange-300' },
            { k: 'cash', label: 'হাতে ক্যাশ', icon: '💵', badgeCls: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
            { k: 'rocket', label: 'রকেট', icon: '🚀', badgeCls: 'bg-purple-100 text-purple-900 border-purple-300' },
            { k: 'other', label: 'অন্যান্য', icon: '📋', badgeCls: 'bg-slate-100 text-slate-800 border-slate-300' }
          ];
          const channelMap = Object.fromEntries(channelList.map((c) => [c.k, c])) as Record<
            SamityCustodyChannel,
            (typeof channelList)[number]
          >;
          const hasCard1ManualOverride =
            samityCap.custodyEntriesCount > 0 &&
            samityCap.totalSamityCapital !== samityCap.custodyTotalAmount;

          return (
            <div className="bg-emerald-50/60 border-2 border-emerald-500 rounded-2xl p-2.5 sm:p-3.5 space-y-2.5 shadow-sm">
              {/* Panel Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200 pb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-black bg-[#008769] text-white px-2 py-0.5 rounded-md">
                      🏦 মোট পুঁজি বিস্তারিত
                    </span>
                    <span className="text-[10.5px] font-black font-mono bg-white text-emerald-950 border border-emerald-300 px-2 py-0.5 rounded-md">
                      সর্বমোট যোগফল: {formatEngBDT(samityCap.custodyTotalAmount)}
                    </span>
                    <span className="text-[10px] font-bold text-slate-600">
                      (সদস্য সঞ্চয় হিসাব: {formatEngBDT(samityCap.autoMemberCapital)})
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 mt-1">
                    কার কাছে ও কোন মাধ্যমে (ব্যাংক / বিকাশ / নগদ / হাতে ক্যাশ) কত টাকা আছে
                  </h4>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (showCustodyForm && !editingCustodyItem) {
                        setShowCustodyForm(false);
                      } else {
                        resetCustodyForm();
                        setShowCustodyForm(true);
                      }
                    }}
                    className={`text-[10.5px] sm:text-xs font-black px-2.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs ${
                      showCustodyForm && !editingCustodyItem
                        ? 'bg-slate-800 text-white'
                        : 'bg-[#008769] hover:bg-[#006e55] text-white'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{showCustodyForm && !editingCustodyItem ? 'ফর্ম বন্ধ' : 'নতুন হিসাব লিখুন'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustodyPanel(false);
                      setShowCustodyForm(false);
                      resetCustodyForm();
                    }}
                    className="p-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl cursor-pointer"
                    title="বন্ধ করুন"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {hasCard1ManualOverride && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-amber-50 border border-amber-300 rounded-xl px-2.5 py-1.5 text-[10.5px] font-bold text-amber-950">
                  <span>
                    ⚠️ কার্ড ১-এ ম্যানুয়াল টিউন ({formatEngBDT(samityCap.totalSamityCapital)}) চালু আছে; কাস্টডি যোগফল ({formatEngBDT(samityCap.custodyTotalAmount)}) অটোমেটিক দেখাতে নিচের বাটনে চাপ দিন।
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (sectionAuditEngine.saveSamityCapitalTune) {
                        await sectionAuditEngine.saveSamityCapitalTune({ totalSamityCapital: null });
                        setCustodyFeedback({ type: 'ok', text: '✅ ১. মোট পুঁজি এখন কাস্টডির লাইভ যোগফল দেখাচ্ছে!' });
                      }
                    }}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-2.5 py-1 rounded-lg cursor-pointer shrink-0"
                  >
                    অটো যোগফল দেখান
                  </button>
                </div>
              )}

              {/* Channel Summary Strip (6 channels) */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 sm:gap-1.5">
                {channelList.map((ch) => {
                  const stat = samityCap.custodyByChannel[ch.k];
                  return (
                    <div
                      key={ch.k}
                      className={`rounded-xl px-2 py-1.5 border bg-white flex flex-col justify-between ${
                        stat.amount > 0 ? 'border-emerald-300 shadow-2xs' : 'border-slate-200 opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 text-[9.5px] font-black text-slate-700">
                        <span className="truncate">
                          {ch.icon} {ch.label}
                        </span>
                        <span className="text-[8.5px] font-mono text-slate-500 shrink-0">
                          {stat.count}টি
                        </span>
                      </div>
                      <div className="text-[11px] font-black font-mono text-slate-950 truncate mt-0.5">
                        {formatEngBDT(stat.amount)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add / Edit Custody Form */}
              {showCustodyForm && (
                <form
                  onSubmit={handleSaveCustody}
                  className="bg-white border-2 border-emerald-400/70 rounded-2xl p-2.5 sm:p-3 space-y-2.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                    <span className="text-xs font-black text-emerald-950">
                      {editingCustodyItem ? '✏️ কাস্টডি হিসাব এডিট করুন' : '✍️ কার কাছে কত টাকা আছে লিখুন'}
                    </span>
                    {editingCustodyItem && (
                      <button
                        type="button"
                        onClick={() => {
                          resetCustodyForm();
                          setShowCustodyForm(false);
                        }}
                        className="text-[10.5px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg cursor-pointer"
                      >
                        বাতিল
                      </button>
                    )}
                  </div>

                  {/* Quick Holder Presets */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-500 mr-1">দ্রুত বাছাই:</span>
                    {['আমার কাছে', 'কোম্পানি ব্যাংক একাউন্ট', 'সাব এডমিন / পার্টনার', 'অন্য ব্যক্তির কাছে'].map(
                      (preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setCustodyHolderName(preset)}
                          className={`text-[10px] font-black px-2 py-0.5 rounded-lg border transition cursor-pointer ${
                            custodyHolderName === preset
                              ? 'bg-emerald-700 text-white border-emerald-700'
                              : 'bg-slate-50 hover:bg-emerald-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          {preset}
                        </button>
                      )
                    )}
                  </div>

                  {/* Channel Selector */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
                    {channelList.map((ch) => (
                      <button
                        key={ch.k}
                        type="button"
                        onClick={() => setCustodyChannel(ch.k)}
                        className={`py-1.5 px-2 rounded-xl text-[10.5px] font-black border transition cursor-pointer ${
                          custodyChannel === ch.k
                            ? 'bg-[#008769] text-white border-[#006e55] shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {ch.icon} {ch.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-black text-slate-600 block mb-1">
                        কার কাছে আছে? (ব্যক্তি / প্রতিষ্ঠান) *
                      </label>
                      <input
                        type="text"
                        value={custodyHolderName}
                        onChange={(e) => setCustodyHolderName(e.target.value)}
                        placeholder="যেমন: আমার কাছে / মোঃ রফিক / কোম্পানি ব্যাংক"
                        required
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-600 block mb-1">
                        কার একাউন্টে / ব্যাংকের নাম / মোবাইল নম্বর
                      </label>
                      <input
                        type="text"
                        value={custodyAccountInfo}
                        onChange={(e) => setCustodyAccountInfo(e.target.value)}
                        placeholder="যেমন: Islami Bank A/C #2050... বা bKash 017..."
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-emerald-600 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                    <div>
                      <label className="text-[10px] font-black text-slate-600 block mb-1">
                        টাকার পরিমাণ (৳) *
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={custodyAmount}
                        onChange={(e) => setCustodyAmount(e.target.value)}
                        placeholder="যেমন: 500000"
                        required
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-black font-mono text-slate-950 outline-none focus:border-emerald-600 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-600 block mb-1">
                        বিবরণ / নোট (ঐচ্ছিক)
                      </label>
                      <input
                        type="text"
                        value={custodyNote}
                        onChange={(e) => setCustodyNote(e.target.value)}
                        placeholder="যেমন: মূল ফান্ড জমা, প্রজেক্ট রিজার্ভ..."
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-emerald-600 focus:bg-white"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={custodySaving}
                      className="w-full bg-[#008769] hover:bg-[#006e55] disabled:opacity-60 text-white py-2 px-4 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>
                        {custodySaving
                          ? 'সংরক্ষণ হচ্ছে...'
                          : editingCustodyItem
                            ? 'আপডেট সংরক্ষণ করুন'
                            : 'যোগ করুন (মোট পুঁজিতে যোগ হবে)'}
                      </span>
                    </button>
                  </div>
                </form>
              )}

              {custodyFeedback && (
                <div
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border ${
                    custodyFeedback.type === 'ok'
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  {custodyFeedback.text}
                </div>
              )}

              {/* Custody Entries List */}
              {samityCap.custodyEntries.length === 0 ? (
                <div className="text-center py-4 bg-white rounded-xl border border-dashed border-emerald-300 space-y-1">
                  <p className="text-xs font-black text-slate-700">
                    এখনো কোনো কাস্টডি হিসাব লেখা হয়নি।
                  </p>
                  <p className="text-[10.5px] font-medium text-slate-500">
                    উপরের ফর্মে কার কাছে (আমার কাছে / অন্য কারো কাছে) এবং কোথায় (ব্যাংক / বিকাশ / নগদ / হাতে ক্যাশ) কত টাকা আছে তা লিখলে সব যোগ হয়ে ১. মোট পুঁজি কার্ডে দেখাবে।
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
                  {samityCap.custodyEntries.map((item, idx) => {
                    const chMeta = channelMap[item.channel] || channelMap.other;
                    return (
                      <div
                        key={item.id}
                        className="bg-white border border-emerald-200/90 hover:border-emerald-400 rounded-xl px-2.5 sm:px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-900 font-mono text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs sm:text-[13px] font-black text-slate-900">
                                {item.holderName}
                              </span>
                              <span
                                className={`text-[9.5px] font-black px-2 py-0.5 rounded-md border ${chMeta.badgeCls}`}
                              >
                                {chMeta.icon} {chMeta.label}
                              </span>
                            </div>
                            {item.accountInfo && (
                              <p className="text-[10.5px] font-bold text-slate-700">
                                একাউন্ট/ব্যাংক/নম্বর: {item.accountInfo}
                              </p>
                            )}
                            <div className="flex items-center gap-2 flex-wrap text-[9.5px] text-slate-500 font-medium">
                              {item.note && <span>📝 {item.note}</span>}
                              {item.updatedAt && (
                                <span className="font-mono">
                                  আপডেট: {new Date(item.updatedAt).toLocaleDateString('bn-BD')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 border-t sm:border-t-0 pt-1.5 sm:pt-0 border-slate-100">
                          <span className="text-sm font-black font-mono text-emerald-900">
                            {formatEngBDT(item.amount)}
                          </span>

                          {custodyConfirmDeleteId === item.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={custodySaving}
                                onClick={() => handleDeleteCustody(item.id)}
                                className="bg-rose-600 text-white text-[10px] font-black px-2 py-1 rounded-lg cursor-pointer"
                              >
                                নিশ্চিত মুছুন
                              </button>
                              <button
                                type="button"
                                onClick={() => setCustodyConfirmDeleteId(null)}
                                className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-1 rounded-lg cursor-pointer"
                              >
                                না
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartEditCustody(item)}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg cursor-pointer flex items-center gap-1 text-[10px] font-black"
                                title="এডিট"
                              >
                                <Pencil className="w-3 h-3" /> এডিট
                              </button>
                              <button
                                type="button"
                                onClick={() => setCustodyConfirmDeleteId(item.id)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg cursor-pointer"
                                title="মুছুন"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* 12-MONTH CLICKABLE COLLECTION BREAKDOWN + PAYER DRILLDOWN */}
        {showMonthlyGrid && (
          <div className="bg-slate-950 text-white rounded-2xl p-2.5 sm:p-3 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[10px] sm:text-xs font-black text-emerald-300">
                📅 ১২ মাসের পুঁজি আদায় ({samityAuditYear}) — যেকোনো মাসে টিপ দিয়ে তালিকা দেখুন
              </span>
              <span className="text-[9.5px] font-mono font-bold text-amber-300">
                মোট {samityAuditYear}: {formatEngBDT(samityCap.yearTotalCollected)}
              </span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1 sm:gap-1.5">
              {samityCap.monthlyBreakdown.map((m) => {
                const isCurrent = samityAuditYear === currentYear && m.id === samityCap.currentMonthId;
                const isSelected = samitySelectedMonthId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSamitySelectedMonthId((prev) => (prev === m.id ? null : m.id));
                      setSamityMonthSearch('');
                    }}
                    className={`rounded-xl px-1.5 sm:px-2 py-1.5 border text-left flex flex-col justify-between transition cursor-pointer active:scale-97 ${
                      isSelected
                        ? 'bg-sky-700 border-sky-300 ring-2 ring-sky-400 shadow-sm'
                        : isCurrent
                          ? 'bg-emerald-800/75 border-emerald-400 ring-1 ring-emerald-400/60 hover:bg-emerald-800'
                          : m.amount > 0
                            ? 'bg-slate-900 border-emerald-700/50 hover:border-sky-400'
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-0.5 text-[8.5px] sm:text-[9.5px] font-bold w-full">
                      <span className={isSelected ? 'text-white font-black truncate' : isCurrent ? 'text-amber-200 font-black truncate' : 'text-slate-300 truncate'}>
                        {m.name}
                      </span>
                      {m.memberCount > 0 ? (
                        <span className={`text-[7.5px] font-mono shrink-0 ${isSelected ? 'text-sky-100' : 'text-emerald-300'}`}>
                          {m.memberCount}জন
                        </span>
                      ) : (
                        <ChevronDown className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-0.5 mt-0.5 w-full">
                      <span className={`text-[10px] sm:text-xs font-black font-mono truncate ${m.amount > 0 ? 'text-white' : 'text-slate-500'}`}>
                        {formatEngBDT(m.amount)}
                      </span>
                      {isSelected && <ChevronUp className="w-2.5 h-2.5 text-sky-200 shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* SELECTED MONTH PAYERS LIST (কে কে টাকা দিয়েছে ও কত টাকা দিয়েছে) */}
            {selectedMonthObj && (
              <div className="bg-white text-slate-900 rounded-2xl p-2.5 sm:p-3 border-2 border-sky-400 space-y-2.5 shadow-lg">
                <div className="flex items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-black bg-sky-100 text-sky-900 border border-sky-300 px-2 py-0.5 rounded-md">
                        📅 {selectedMonthObj.name} {samityAuditYear}
                      </span>
                      <span className="text-[10px] font-black font-mono bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-md">
                        মোট পুঁজি জমা: {formatEngBDT(selectedMonthObj.amount)}
                      </span>
                      <span className="text-[10px] font-bold text-slate-600">
                        ({selectedMonthObj.memberCount} জন দিয়েছেন)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSamityFormTab('entry');
                        setQuickType('revenue');
                        setQuickMonthId(selectedMonthObj.id);
                        setQuickCategory('মাসিক পুঁজি জমা');
                        setShowInlineForm(true);
                      }}
                      className="text-[10px] font-black bg-[#008769] hover:bg-[#006e55] text-white px-2 py-1 rounded-lg cursor-pointer flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" /> এই মাসে লিখুন
                    </button>
                    <button
                      type="button"
                      onClick={() => setSamitySelectedMonthId(null)}
                      className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg cursor-pointer"
                      title="বন্ধ করুন"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Tier Breakdown Chips for Selected Month */}
                <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
                  {(
                    [
                      { k: 'owner', label: '🔴 ওনার', cls: 'bg-rose-50 border-rose-200 text-rose-900' },
                      { k: 'shareholder', label: '🔵 শেয়ার হোল্ডার', cls: 'bg-sky-50 border-sky-200 text-sky-900' },
                      { k: 'investor', label: '🟢 ইনভেস্টার', cls: 'bg-emerald-50 border-emerald-200 text-emerald-900' },
                      { k: 'supporter', label: '🟡 সাপোর্টার', cls: 'bg-amber-50 border-amber-200 text-amber-900' }
                    ] as Array<{ k: SamityTierKey; label: string; cls: string }>
                  ).map((t) => {
                    const stat = selectedMonthObj.tierSummary[t.k];
                    return (
                      <div key={t.k} className={`border rounded-xl px-1.5 py-1 flex flex-col ${t.cls}`}>
                        <span className="text-[7.5px] sm:text-[9.5px] font-black truncate">{t.label}</span>
                        <span className="text-[9.5px] sm:text-[11px] font-black font-mono truncate">
                          {stat.count}জন • {formatEngBDT(stat.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Paid vs Unpaid Tabs + Search */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSamityMonthTab('paid')}
                      className={`px-2.5 py-1 rounded-xl text-[10.5px] font-black border cursor-pointer transition ${
                        samityMonthTab === 'paid'
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      ✅ দিয়েছেন ({selectedMonthObj.payers.length} জন)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSamityMonthTab('unpaid')}
                      className={`px-2.5 py-1 rounded-xl text-[10.5px] font-black border cursor-pointer transition ${
                        samityMonthTab === 'unpaid'
                          ? 'bg-amber-500 text-slate-950 border-amber-500'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      ⏳ বকেয়া ({selectedMonthObj.unpaidMembers.length} জন)
                    </button>
                  </div>

                  <div className="relative sm:w-56">
                    <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={samityMonthSearch}
                      onChange={(e) => setSamityMonthSearch(e.target.value)}
                      placeholder="নাম, আইডি বা মোবাইল..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-7 pr-2.5 py-1 text-[11px] font-bold text-slate-800 outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                {/* Payers or Unpaid List */}
                <div className="max-h-60 overflow-y-auto space-y-1 pr-0.5">
                  {samityMonthTab === 'paid' ? (
                    filteredPayers.length === 0 ? (
                      <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-[11px] font-bold text-slate-500">
                        {selectedMonthObj.name} {samityAuditYear} মাসে এখনো কোনো সদস্যের কিস্তি জমা পাওয়া যায়নি।
                      </div>
                    ) : (
                      filteredPayers.map((p, idx) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-2 bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 rounded-xl px-2.5 py-1.5"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-900 font-mono text-[10px] font-black flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-[11px] sm:text-xs font-black text-slate-900 truncate">
                                  {p.name}
                                </span>
                                <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded border ${tierBadgeCls[p.tier]}`}>
                                  {p.tierLabel}
                                </span>
                              </div>
                              <div className="text-[9.5px] text-slate-500 font-bold truncate">
                                {p.memberId}
                                {p.phone ? ` • ${p.phone}` : ''}
                                {p.dateLabel ? ` • ${p.dateLabel}` : ''}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs sm:text-sm font-black font-mono text-emerald-800">
                              {formatEngBDT(p.amount)}
                            </div>
                            <div className="text-[8.5px] text-slate-500 font-bold truncate max-w-[110px]">
                              {p.isManualEntry ? 'ম্যানুয়াল' : p.sourceLabel}
                            </div>
                          </div>
                        </div>
                      ))
                    )
                  ) : filteredUnpaid.length === 0 ? (
                    <div className="text-center py-4 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] font-bold text-emerald-800">
                      🎉 এই মাসে সকল সচল (সুইচ ON) সদস্যের কিস্তি পরিশোধ হয়েছে!
                    </div>
                  ) : (
                    filteredUnpaid.map((u, idx) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between gap-2 bg-amber-50/50 border border-amber-200/80 rounded-xl px-2.5 py-1.5"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 font-mono text-[10px] font-black flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-[11px] sm:text-xs font-black text-slate-900 truncate">
                                {u.name}
                              </span>
                              <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded border ${tierBadgeCls[u.tier]}`}>
                                {u.tierLabel}
                              </span>
                            </div>
                            <div className="text-[9.5px] text-slate-500 font-bold truncate">
                              {u.memberId}
                              {u.phone ? ` • ${u.phone}` : ''}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-black font-mono text-amber-900">
                            {formatEngBDT(u.expectedAmount)}
                          </div>
                          <div className="text-[8.5px] text-amber-700 font-bold">বকেয়া</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="text-[9px] sm:text-[10px] text-amber-200/95 bg-amber-950/50 border border-amber-500/30 rounded-xl px-2.5 py-1.5 font-bold">
              🗓️ এই সেকশনে শুধু সদস্যদের মূল পুঁজি জমা হয় (কোনো লাভ/লস নেই)। সুইচ অফ করা সদস্যদের সঞ্চিত টাকা প্রতি বছর ২৫শে ডিসেম্বর স্বয়ংক্রিয়ভাবে নিজ ওয়ালেটে ফেরত যাবে।
            </div>
          </div>
        )}

        {/* DEDICATED MANUAL ENTRY & 8-CARD SAMITY FORM SECTION */}
        {showInlineForm && (
          <div className="bg-slate-50 border-2 border-emerald-300/80 rounded-2xl p-2.5 sm:p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-200 pb-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSamityFormTab('entry')}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-black border transition cursor-pointer ${
                    samityFormTab === 'entry'
                      ? 'bg-[#008769] text-white border-[#006e55]'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  ✍️ পুঁজি ও মাসিক জমা ফরম
                </button>
                <button
                  type="button"
                  onClick={() => setSamityFormTab('tune')}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-black border transition cursor-pointer ${
                    samityFormTab === 'tune'
                      ? 'bg-amber-500 text-slate-950 border-amber-500'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  ⚙️ ৮টি কার্ড ম্যানুয়াল টিউন (এডিট)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCustodyPanel(true);
                    setShowCustodyForm(true);
                    setShowInlineForm(false);
                  }}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-black border transition cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300"
                >
                  💼 কার কাছে কত টাকা ({samityCap.custodyEntriesCount})
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowInlineForm(false);
                  setEditingQuickEntry(null);
                }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {samityFormTab === 'entry' ? (
              <div className="space-y-2.5">
                <form onSubmit={handleQuickSave} className="space-y-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { k: 'revenue', label: '🏦 পুঁজি জমা / মাসিক আদায়' },
                        { k: 'expense', label: '📤 প্রজেক্ট ক্রয় / রিফান্ড উত্তোলন' }
                      ] as Array<{ k: AuditEntryType; label: string }>
                    ).map((opt) => (
                      <button
                        key={opt.k}
                        type="button"
                        onClick={() => setQuickType(opt.k)}
                        className={`py-1.5 px-2 rounded-xl text-[10.5px] sm:text-[11px] font-black border transition cursor-pointer ${
                          quickType === opt.k
                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={quickTitle}
                      onChange={(e) => setQuickTitle(e.target.value)}
                      placeholder="বিবরণ লিখুন (যেমন: পুঁজি জমা / জমি ক্রয় / রিফান্ড)..."
                      required
                      className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600"
                    />
                    <input
                      type="text"
                      value={quickMemberName}
                      onChange={(e) => setQuickMemberName(e.target.value)}
                      placeholder="সদস্যের নাম (ঐচ্ছিক — যেমন: মোঃ করিম)"
                      className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      value={quickMonthId}
                      onChange={(e) => setQuickMonthId(e.target.value)}
                      className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600"
                    >
                      <option value="">📅 কোনো নির্দিষ্ট মাস নয় (সাধারণ পুঁজি)</option>
                      {SAMITY_MONTHS.map((m) => (
                        <option key={m.id} value={m.id}>
                          📅 {m.name} {samityAuditYear}
                        </option>
                      ))}
                    </select>

                    <select
                      value={quickCategory}
                      onChange={(e) => setQuickCategory(e.target.value)}
                      className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600"
                    >
                      {meta.expenseCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={quickAmount}
                        onChange={(e) => setQuickAmount(e.target.value)}
                        placeholder="টাকার পরিমাণ (৳)"
                        required
                        className="flex-1 min-w-0 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-black font-mono text-slate-900 outline-none focus:border-emerald-600"
                      />
                      <button
                        type="submit"
                        disabled={quickSaving}
                        className="bg-[#008769] hover:bg-[#006e55] disabled:opacity-60 text-white px-3 py-2 rounded-xl text-xs font-black transition cursor-pointer shrink-0 flex items-center gap-1"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{quickSaving ? '...' : editingQuickEntry ? 'আপডেট' : 'সেভ'}</span>
                      </button>
                      {editingQuickEntry && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingQuickEntry(null);
                            setQuickTitle('');
                            setQuickAmount('');
                            setQuickMemberName('');
                            setQuickMonthId('');
                          }}
                          className="bg-rose-100 text-rose-800 px-2 py-2 rounded-xl text-xs font-black cursor-pointer shrink-0"
                        >
                          বাতিল
                        </button>
                      )}
                    </div>
                  </div>
                </form>

                {/* Manual Entries Quick List with Edit/Delete right inside section */}
                {samityManualList.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-xl p-2 space-y-1.5 max-h-44 overflow-y-auto">
                    <div className="text-[10px] font-black text-slate-600 px-1">
                      📋 ম্যানুয়াল ফরমে লেখা তথ্য ({samityManualList.length}টি):
                    </div>
                    {samityManualList.slice(0, 12).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1.5"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span
                              className={`text-[8.5px] font-black px-1.5 py-0.5 rounded border ${
                                item.entryType === 'revenue'
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                  : 'bg-amber-100 text-amber-900 border-amber-300'
                              }`}
                            >
                              {item.entryType === 'revenue' ? 'পুঁজি জমা' : 'বিনিয়োগ/উত্তোলন'}
                            </span>
                            {item.memberName && (
                              <span className="text-[9.5px] font-black text-sky-800">
                                {item.memberName}
                              </span>
                            )}
                            {item.monthKey && (
                              <span className="text-[8.5px] font-mono bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                                {item.monthKey}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-bold text-slate-800 truncate">{item.title}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-black font-mono text-slate-900">
                            {formatEngBDT(item.amount)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingQuickEntry(item);
                              setQuickType(item.entryType === 'expense' ? 'expense' : 'revenue');
                              setQuickTitle(item.title || '');
                              setQuickAmount(String(item.amount || ''));
                              setQuickMemberName(item.memberName || '');
                              setQuickCategory(item.category || meta.expenseCategories[0]);
                              const mkParts = String(item.monthKey || '').split('-');
                              setQuickMonthId(mkParts.length === 2 ? mkParts[1] : '');
                            }}
                            className="p-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg cursor-pointer"
                            title="এডিট"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => sectionAuditEngine.deleteAuditEntry(item.id)}
                            className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg cursor-pointer"
                            title="মুছুন"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* TAB B: 8-CARD SAMITY MANUAL TUNE / EDIT FORM */
              <form onSubmit={handleSaveSamityTuneForm} className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[10.5px] font-bold text-slate-600">
                    যেকোনো কার্ডের সংখ্যা ম্যানুয়ালি লিখুন; অটো রাখতে ঘর খালি রাখুন।
                  </span>
                  <button
                    type="button"
                    onClick={handleResetSamityTune}
                    disabled={savingSamityTune}
                    className="bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-xl text-[10.5px] font-black flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> অটো হিসাবে রিসেট
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      { key: 'totalSamityCapital', label: '১. মোট পুঁজি', auto: samityCap.autoValues.totalSamityCapital },
                      { key: 'currentMonthCollected', label: `২. ${samityCap.currentMonthName} আদায়`, auto: samityCap.autoValues.currentMonthCollected },
                      { key: 'yearTotalCollected', label: `৩. ${samityAuditYear} আদায়`, auto: samityCap.autoValues.yearTotalCollected },
                      { key: 'monthlyExpectedTarget', label: '৪. মাসিক হার', auto: samityCap.autoValues.monthlyExpectedTarget },
                      { key: 'totalInvestedBuy', label: '৫. মোট কেনা', auto: samityCap.autoValues.totalInvestedBuy },
                      { key: 'activeInvestedBuy', label: '৬. চলমান প্রজেক্ট', auto: samityCap.autoValues.activeInvestedBuy },
                      { key: 'cashRemainingInHand', label: '৭. হাতে নগদ', auto: samityCap.autoValues.cashRemainingInHand },
                      { key: 'switchOffRefundAmount', label: '৮. সুইচ অফ রিফান্ড', auto: samityCap.autoValues.switchOffRefundAmount }
                    ] as const
                  ).map((f) => (
                    <div key={f.key} className="bg-white p-2 rounded-xl border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between gap-1 text-[9.5px] font-black text-slate-800">
                        <span className="truncate">{f.label}</span>
                        <span className="text-[8.5px] font-mono text-slate-500 shrink-0">
                          অটো: {formatEngBDT(f.auto)}
                        </span>
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={samityTuneDraft[f.key] ?? ''}
                        onChange={(e) =>
                          setSamityTuneDraft((prev) => ({ ...prev, [f.key]: e.target.value }))
                        }
                        placeholder="অটো রাখতে খালি..."
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-black font-mono text-slate-900 outline-none focus:border-amber-500"
                      />
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={savingSamityTune}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-slate-950 font-black text-xs py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingSamityTune ? 'সংরক্ষণ হচ্ছে...' : '৮টি কার্ডের ম্যানুয়াল টিউন সংরক্ষণ করুন'}</span>
                </button>
              </form>
            )}

            {quickMsg && (
              <div
                className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border ${
                  quickMsg.type === 'ok'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {quickMsg.text}
              </div>
            )}
          </div>
        )}

        {!showInlineForm && quickMsg && (
          <div className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl border bg-emerald-50 text-emerald-800 border-emerald-200">
            {quickMsg.text}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mb-3.5 bg-white border-2 border-emerald-500/40 rounded-3xl p-3.5 sm:p-4 shadow-xs text-left font-sans space-y-3">
      {/* Header matching Green Financial Control Box */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-md">
                সেকশন {meta.numberBn} • {meta.badge}
              </span>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-md border font-mono ${
                  stats.netResult >= 0
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {stats.netResult >= 0 ? 'নিট লাভ:' : 'নিট লস:'}{' '}
                {stats.netResult < 0 ? '-' : ''}
                {formatEngBDT(Math.abs(stats.netResult))}
              </span>
              {sectionKey === 'safedeals_admin' && (() => {
                const sdCfg = sectionAuditEngine.safeDealsConfig;
                const mode = sdCfg?.feeMode || 'free';
                const badgeTxt =
                  mode === 'free'
                    ? '🆓 চার্জ: আপাতত ফ্রি (০%)'
                    : mode === 'percent'
                      ? `💰 ফি: ${sdCfg?.feePercent || 0}%`
                      : mode === 'fixed'
                        ? `💰 ফি: ৳${sdCfg?.feeFixed || 0}`
                        : `💰 ফি: ${sdCfg?.feePercent || 0}% + ৳${sdCfg?.feeFixed || 0}`;
                return (
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                      mode === 'free'
                        ? 'bg-sky-50 text-sky-900 border-sky-200'
                        : 'bg-amber-50 text-amber-900 border-amber-300'
                    }`}
                  >
                    {badgeTxt}
                  </span>
                );
              })()}
            </div>
            <h3 className="text-xs sm:text-sm font-black text-slate-800 truncate mt-0.5">
              {meta.emoji} {meta.title} — পৃথক লাভ, লস ও খরচের হিসাব
            </h3>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            aria-label="অডিট সময়কাল"
            className="text-[11px] font-bold bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-2 py-1.5 outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">সব সময়</option>
            <option value="today">আজকের হিসাব</option>
            <option value="7d">গত ৭ দিন</option>
            <option value="month">চলতি মাস</option>
          </select>

          <button
            type="button"
            onClick={() => setShowInlineForm((v) => !v)}
            className="bg-[#008769] hover:bg-[#006e55] text-white text-[11px] font-black px-2.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showInlineForm ? 'ফর্ম বন্ধ' : 'খরচ/লাভ লিখুন'}</span>
          </button>

          <button
            type="button"
            onClick={() => openSectionAuditModal && openSectionAuditModal(sectionKey, 'tune')}
            className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-black px-2.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
          >
            <Settings className="w-3.5 h-3.5 text-amber-600" />
            <span>টিউন</span>
          </button>

          <button
            type="button"
            onClick={() => openSectionAuditModal && openSectionAuditModal(sectionKey, 'ledger')}
            className="bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black px-2.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-300" />
            <span>পৃথক খাতা ({stats.manualEntries.length})</span>
          </button>
        </div>
      </div>

      {/* 4 Green-Box-Style Metric Cards (Strictly 4 columns matching Green Box!) */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5">
        {/* Card 1: Total Section Revenue/Volume */}
        <div
          onClick={() => openSectionAuditModal && openSectionAuditModal(sectionKey, 'auto')}
          className="bg-gradient-to-br from-[#008769] to-[#006e55] text-white p-2 sm:p-2.5 rounded-xl sm:rounded-2xl shadow-2xs flex flex-col justify-between cursor-pointer hover:opacity-95 transition active:scale-98 min-h-[58px] sm:min-h-[68px]"
        >
          <div className="flex justify-between items-center text-[8.5px] sm:text-[11px] font-bold text-teal-100">
            <span className="truncate">1. মোট আয়/লেনদেন</span>
            <Wallet className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-teal-100 shrink-0" />
          </div>
          <div className="text-xs sm:text-base font-black text-white tracking-tight font-mono truncate">
            {formatEngBDT(stats.effectiveRevenue)}
          </div>
        </div>

        {/* Card 2: Section Profit */}
        <div
          onClick={() => openSectionAuditModal && openSectionAuditModal(sectionKey, 'ledger')}
          className="bg-emerald-50/95 border border-emerald-200 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl text-slate-800 flex flex-col justify-between shadow-2xs cursor-pointer hover:bg-emerald-100/90 transition active:scale-98 min-h-[58px] sm:min-h-[68px]"
        >
          <div className="flex justify-between items-center text-[8.5px] sm:text-[11px] font-bold text-emerald-900">
            <span className="truncate">2. অর্জিত লাভ</span>
            <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-700 shrink-0" />
          </div>
          <div className="text-xs sm:text-base font-black text-emerald-950 tracking-tight font-mono truncate">
            {formatEngBDT(stats.effectiveProfit)}
          </div>
        </div>

        {/* Card 3: Section Loss */}
        <div
          onClick={() => openSectionAuditModal && openSectionAuditModal(sectionKey, 'ledger')}
          className="bg-rose-50/95 border border-rose-200 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl text-slate-800 flex flex-col justify-between shadow-2xs cursor-pointer hover:bg-rose-100/90 transition active:scale-98 min-h-[58px] sm:min-h-[68px]"
        >
          <div className="flex justify-between items-center text-[8.5px] sm:text-[11px] font-bold text-rose-900">
            <span className="truncate">3. লোকসান / লস</span>
            <TrendingDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-700 shrink-0" />
          </div>
          <div className="text-xs sm:text-base font-black text-rose-950 tracking-tight font-mono truncate">
            {formatEngBDT(stats.effectiveLoss)}
          </div>
        </div>

        {/* Card 4: Separate Section Expense */}
        <div
          onClick={() => setShowInlineForm(true)}
          className="bg-amber-50/95 border border-amber-300 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl text-slate-800 flex flex-col justify-between shadow-2xs cursor-pointer hover:bg-amber-100/90 transition active:scale-98 min-h-[58px] sm:min-h-[68px]"
        >
          <div className="flex justify-between items-center text-[8.5px] sm:text-[11px] font-bold text-amber-950">
            <span className="truncate">4. পৃথক খরচ</span>
            <Receipt className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-700 shrink-0" />
          </div>
          <div className="text-xs sm:text-base font-black text-amber-950 tracking-tight font-mono truncate">
            {formatEngBDT(stats.effectiveExpense)}
          </div>
        </div>
      </div>

      {/* Live Qard Hasana + Sadaqah Jariyah Audit Strip (Strict 4 columns per row!) */}
      {sectionKey === 'qard_admin' && sectionAuditEngine.computeQardSadaqahAudit && (() => {
        const qs = sectionAuditEngine.computeQardSadaqahAudit();
        return (
          <div className="space-y-1.5 bg-slate-950 text-white rounded-2xl p-2 border border-slate-800">
            {/* Row 1: Qard Hasana Summary (4 cards) */}
            <div className="grid grid-cols-4 gap-1 sm:gap-2">
              <div className="bg-slate-900 border border-emerald-500/30 rounded-xl px-2 py-1.5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[8px] sm:text-[10px] font-black text-emerald-300">
                  <span className="truncate">🤝 কর্জে জমা (দাতা)</span>
                  <span className="font-mono shrink-0">{qs.qardDonorCount}জন</span>
                </div>
                <div className="text-[10.5px] sm:text-xs font-black font-mono text-white truncate mt-0.5">
                  {formatEngBDT(qs.qardTotalFund)}
                </div>
              </div>

              <div className="bg-slate-900 border border-amber-500/30 rounded-xl px-2 py-1.5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[8px] sm:text-[10px] font-black text-amber-300">
                  <span className="truncate">👥 নিয়েছে (বিতরণ)</span>
                  <span className="font-mono shrink-0">{qs.qardBorrowerCount}জন</span>
                </div>
                <div className="text-[10.5px] sm:text-xs font-black font-mono text-white truncate mt-0.5">
                  {formatEngBDT(qs.qardTotalDisbursed)}
                </div>
              </div>

              <div className="bg-slate-900 border border-sky-500/30 rounded-xl px-2 py-1.5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[8px] sm:text-[10px] font-black text-sky-300">
                  <span className="truncate">♻️ ফেরত / বকেয়া</span>
                  <span className="font-mono shrink-0">{qs.qardActiveBorrowersCount}জন</span>
                </div>
                <div className="text-[9.5px] sm:text-[11px] font-black font-mono text-white truncate mt-0.5">
                  {formatEngBDT(qs.qardTotalRepaid)} / {formatEngBDT(qs.qardActiveDue)}
                </div>
              </div>

              <div className="bg-slate-900 border border-rose-500/30 rounded-xl px-2 py-1.5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[8px] sm:text-[10px] font-black text-rose-300">
                  <span className="truncate">💧 হাতে নগদ • 🚫 ব্লক</span>
                  <span className="font-mono shrink-0">🚫{qs.qardLifetimeBannedCount}</span>
                </div>
                <div className="text-[10.5px] sm:text-xs font-black font-mono text-white truncate mt-0.5">
                  {formatEngBDT(qs.qardAvailableCash)}
                </div>
              </div>
            </div>

            {/* Row 2: Sadaqah Jariyah Summary + 1 Month Strict Rule (4 cards) */}
            <div className="grid grid-cols-4 gap-1 sm:gap-2">
              <div className="bg-emerald-950/60 border border-teal-500/30 rounded-xl px-2 py-1.5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[8px] sm:text-[10px] font-black text-teal-300">
                  <span className="truncate">🕊️ সদকা মোট জমা</span>
                  <span className="font-mono shrink-0">{qs.sadaqahDonorCount}জন</span>
                </div>
                <div className="text-[10.5px] sm:text-xs font-black font-mono text-white truncate mt-0.5">
                  {formatEngBDT(qs.sadaqahTotalCollected)}
                </div>
              </div>

              <div className="bg-emerald-950/60 border border-pink-500/30 rounded-xl px-2 py-1.5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[8px] sm:text-[10px] font-black text-pink-300">
                  <span className="truncate">🎁 কাকে দান করেছি</span>
                  <span className="font-mono shrink-0">{qs.sadaqahRecipientCount}জন</span>
                </div>
                <div className="text-[10.5px] sm:text-xs font-black font-mono text-white truncate mt-0.5">
                  {formatEngBDT(qs.sadaqahTotalDisbursed)}
                </div>
              </div>

              <div className="bg-emerald-950/60 border border-emerald-400/40 rounded-xl px-2 py-1.5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[8px] sm:text-[10px] font-black text-emerald-300">
                  <span className="truncate">💰 সদকা বর্তমানে আছে</span>
                  <span className="font-mono shrink-0">মজুত</span>
                </div>
                <div className="text-[10.5px] sm:text-xs font-black font-mono text-emerald-200 truncate mt-0.5">
                  {formatEngBDT(qs.sadaqahAvailableBalance)}
                </div>
              </div>

              <div className="bg-rose-950/50 border border-rose-500/40 rounded-xl px-2 py-1.5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[8px] sm:text-[10px] font-black text-rose-300">
                  <span className="truncate">⏳ সর্বোচ্চ মেয়াদ</span>
                  <span className="font-mono shrink-0">বকেয়া:{qs.qardOverdueCount}</span>
                </div>
                <div className="text-[9px] sm:text-[10.5px] font-black text-amber-300 truncate mt-0.5">
                  ১ মাস • না দিলে আজীবন ব্লক
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Live Safe Deals Escrow Breakdown Strip (অপেক্ষমাণ, পথে পাঠানো, সম্পন্ন, বাতিল/অভিযোগ) */}
      {sectionKey === 'safedeals_admin' && sectionAuditEngine.computeSafeDealsSummary && (() => {
        const sdSum = sectionAuditEngine.computeSafeDealsSummary();
        return (
          <div className="grid grid-cols-4 gap-1 sm:gap-2 bg-slate-950 text-white rounded-2xl p-2 border border-slate-800">
            <div className="bg-slate-900 border border-sky-500/30 rounded-xl px-2 py-1.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[8px] sm:text-[10px] font-black text-sky-300">
                <span className="truncate">⏳ হোল্ড / অপেক্ষমাণ</span>
                <span className="font-mono shrink-0">{sdSum.heldCount}টি</span>
              </div>
              <div className="text-[10.5px] sm:text-xs font-black font-mono text-white truncate mt-0.5">
                {formatEngBDT(sdSum.heldAmount)}
              </div>
            </div>

            <div className="bg-slate-900 border border-amber-500/30 rounded-xl px-2 py-1.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[8px] sm:text-[10px] font-black text-amber-300">
                <span className="truncate">🚚 পথে পাঠানো</span>
                <span className="font-mono shrink-0">{sdSum.shippedCount}টি</span>
              </div>
              <div className="text-[10.5px] sm:text-xs font-black font-mono text-white truncate mt-0.5">
                {formatEngBDT(sdSum.shippedAmount)}
              </div>
            </div>

            <div className="bg-slate-900 border border-emerald-500/30 rounded-xl px-2 py-1.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[8px] sm:text-[10px] font-black text-emerald-300">
                <span className="truncate">✅ সম্পন্ন (রিলিজড)</span>
                <span className="font-mono shrink-0">{sdSum.releasedCount}টি</span>
              </div>
              <div className="text-[10.5px] sm:text-xs font-black font-mono text-white truncate mt-0.5">
                {formatEngBDT(sdSum.releasedAmount)}
              </div>
            </div>

            <div className="bg-slate-900 border border-rose-500/30 rounded-xl px-2 py-1.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[8px] sm:text-[10px] font-black text-rose-300">
                <span className="truncate">↩️ বাতিল / অভিযোগ</span>
                <span className="font-mono shrink-0">{sdSum.refundedCount}টি • 🚨{sdSum.disputesPending}</span>
              </div>
              <div className="text-[10.5px] sm:text-xs font-black font-mono text-white truncate mt-0.5">
                {formatEngBDT(sdSum.refundedAmount)}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Inline 1-Tap Quick Expense / Profit / Loss Entry Form (Zero Modal Needed!) */}
      {showInlineForm && (
        <form
          onSubmit={handleQuickSave}
          className="bg-slate-50 border border-emerald-200 rounded-2xl p-3 space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-800">
              ✍️ সরাসরি এই সেকশনে খরচ / লাভ / লস যুক্ত করুন
            </span>
            <button
              type="button"
              onClick={() => setShowInlineForm(false)}
              className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {(
              [
                { k: 'expense', label: '📉 খরচ' },
                { k: 'profit', label: '💰 লাভ' },
                { k: 'loss', label: '⚠️ লস' },
                { k: 'revenue', label: '🏦 আয়' }
              ] as Array<{ k: AuditEntryType; label: string }>
            ).map((opt) => (
              <button
                key={opt.k}
                type="button"
                onClick={() => setQuickType(opt.k)}
                className={`py-1.5 px-2 rounded-xl text-[11px] font-black border transition cursor-pointer ${
                  quickType === opt.k
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="খরচ বা হিসাবের বিবরণ লিখুন..."
              required
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600"
            />
            <select
              value={quickCategory}
              onChange={(e) => setQuickCategory(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600"
            >
              {meta.expenseCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                inputMode="decimal"
                value={quickAmount}
                onChange={(e) => setQuickAmount(e.target.value)}
                placeholder="টাকার পরিমাণ (৳)"
                required
                className="flex-1 min-w-0 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-black font-mono text-slate-900 outline-none focus:border-emerald-600"
              />
              <button
                type="submit"
                disabled={quickSaving}
                className="bg-[#008769] hover:bg-[#006e55] disabled:opacity-60 text-white px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer shrink-0 flex items-center gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{quickSaving ? '...' : 'সেভ'}</span>
              </button>
            </div>
          </div>

          {quickMsg && (
            <div
              className={`text-[11px] font-bold px-2.5 py-1.5 rounded-xl border ${
                quickMsg.type === 'ok'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {quickMsg.text}
            </div>
          )}
        </form>
      )}

      {!showInlineForm && quickMsg && (
        <div className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl border bg-emerald-50 text-emerald-800 border-emerald-200">
          {quickMsg.text}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * 3. UNIFIED 12-SECTION AUDIT, EXPENSE LEDGER & MANUAL TUNE MODAL
 *    Opened from Dashboard 12-Box Matrix, 12 Section Cards, Box 12, or Section Bar!
 * ============================================================================ */
export function AdminSectionAuditModal(props: {
  activeSectionKey: AuditSectionKey | null;
  initialTab?: 'ledger' | 'tune' | 'auto';
  onSelectSection: (key: AuditSectionKey) => void;
  onClose: () => void;
  sectionAuditEngine?: SectionAuditsEngineReturn;
  onNavigateToSection?: (key: AuditSectionKey) => void;
}) {
  const {
    activeSectionKey,
    initialTab = 'ledger',
    onSelectSection,
    onClose,
    sectionAuditEngine,
    onNavigateToSection
  } = props;

  const [tab, setTab] = useState<'ledger' | 'tune' | 'auto'>(initialTab);
  const [period, setPeriod] = useState<'all' | 'today' | '7d' | 'month'>('all');
  const [filterType, setFilterType] = useState<'all' | AuditEntryType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Add / Edit Entry Form State
  const [editingEntry, setEditingEntry] = useState<SectionAuditEntry | null>(null);
  const [entryType, setEntryType] = useState<AuditEntryType>('expense');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [savingEntry, setSavingEntry] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Manual Tune Form State (`appConfig.sectionAuditOverrides`)
  const [tuneRevenue, setTuneRevenue] = useState('');
  const [tuneProfit, setTuneProfit] = useState('');
  const [tuneLoss, setTuneLoss] = useState('');
  const [tuneExpense, setTuneExpense] = useState('');
  const [savingTune, setSavingTune] = useState(false);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!activeSectionKey || !sectionAuditEngine) return;
    const meta = SECTION_META_MAP[activeSectionKey];
    const st = sectionAuditEngine.computeSectionStats(activeSectionKey, 'all');
    setEditingEntry(null);
    setTitle('');
    setAmount('');
    setNote('');
    setCategory(meta.expenseCategories[0] || 'অন্যান্য খরচ');
    setConfirmDeleteId(null);
    setFeedback(null);

    setTuneRevenue(st.isOverrideRevenue ? String(st.effectiveRevenue) : '');
    setTuneProfit(st.isOverrideProfit ? String(st.effectiveProfit) : '');
    setTuneLoss(st.isOverrideLoss ? String(st.effectiveLoss) : '');
    setTuneExpense(st.isOverrideExpense ? String(st.effectiveExpense) : '');
  }, [activeSectionKey, sectionAuditEngine]);

  if (!activeSectionKey || !sectionAuditEngine) return null;

  const meta = SECTION_META_MAP[activeSectionKey];
  const stats = sectionAuditEngine.computeSectionStats(activeSectionKey, period);
  const allTimeStats = sectionAuditEngine.computeSectionStats(activeSectionKey, 'all');

  const qLower = searchQuery.trim().toLowerCase();
  const visibleManual = stats.manualEntries.filter((e) => {
    if (filterType !== 'all' && e.entryType !== filterType) return false;
    if (!qLower) return true;
    return (
      String(e.title || '').toLowerCase().includes(qLower) ||
      String(e.category || '').toLowerCase().includes(qLower) ||
      String(e.note || '').toLowerCase().includes(qLower)
    );
  });

  const visibleAuto = stats.autoItems.filter((a) => {
    if (filterType !== 'all' && a.entryType !== filterType) return false;
    if (!qLower) return true;
    return (
      String(a.title || '').toLowerCase().includes(qLower) ||
      String(a.subtitle || '').toLowerCase().includes(qLower) ||
      String(a.sourceLabel || '').toLowerCase().includes(qLower)
    );
  });

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSavingEntry(true);
    try {
      const numericAmt = Number(convertBengaliToEnglishDigits(amount));
      if (editingEntry) {
        await sectionAuditEngine.updateAuditEntry(editingEntry.id, {
          entryType,
          title,
          amount: numericAmt,
          category: category || meta.expenseCategories[0],
          note,
          entryDate
        });
        setFeedback({ type: 'ok', text: '✅ এন্ট্রিটি সফলভাবে আপডেট করা হয়েছে!' });
      } else {
        await sectionAuditEngine.addAuditEntry({
          sectionKey: activeSectionKey,
          entryType,
          title,
          amount: numericAmt,
          category: category || meta.expenseCategories[0],
          note,
          entryDate
        });
        setFeedback({ type: 'ok', text: '✅ নতুন হিসাব সফলভাবে এই সেকশনের পৃথক খাতায় যুক্ত হয়েছে!' });
      }
      setEditingEntry(null);
      setTitle('');
      setAmount('');
      setNote('');
      setEntryDate(new Date().toISOString().slice(0, 10));
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'সংরক্ষণ করতে সমস্যা হয়েছে।' });
    } finally {
      setSavingEntry(false);
    }
  };

  const startEdit = (item: SectionAuditEntry) => {
    setTab('ledger');
    setEditingEntry(item);
    setEntryType(item.entryType);
    setTitle(item.title || '');
    setAmount(String(item.amount || ''));
    setCategory(item.category || meta.expenseCategories[0] || '');
    setEntryDate(item.entryDate || new Date().toISOString().slice(0, 10));
    setNote(item.note || '');
    setFeedback(null);
  };

  const handleConfirmDelete = async (id: string) => {
    try {
      await sectionAuditEngine.deleteAuditEntry(id);
      setConfirmDeleteId(null);
      if (editingEntry?.id === id) {
        setEditingEntry(null);
        setTitle('');
        setAmount('');
      }
      setFeedback({ type: 'ok', text: '🗑️ এন্ট্রিটি মুছে ফেলা হয়েছে।' });
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'মুছতে সমস্যা হয়েছে।' });
    }
  };

  const parseTuneField = (raw: string): number | null => {
    const cleaned = convertBengaliToEnglishDigits(String(raw || '')).trim();
    if (cleaned === '') return null;
    const n = Number(cleaned);
    if (!isFinite(n) || n < 0) {
      throw new Error('ম্যানুয়াল ব্যালেন্সে সঠিক সংখ্যা (০ বা তার বেশি) দিন অথবা অটো রাখতে খালি রাখুন।');
    }
    return n;
  };

  const handleSaveManualTune = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSavingTune(true);
    try {
      await sectionAuditEngine.saveSectionManualTune(activeSectionKey, {
        revenue: parseTuneField(tuneRevenue),
        profit: parseTuneField(tuneProfit),
        loss: parseTuneField(tuneLoss),
        expense: parseTuneField(tuneExpense)
      });
      setFeedback({ type: 'ok', text: '⚙️ সেকশনের ম্যানুয়াল ব্যালেন্স টিউন সফলভাবে সংরক্ষিত হয়েছে!' });
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'টিউন সংরক্ষণ করতে সমস্যা হয়েছে।' });
    } finally {
      setSavingTune(false);
    }
  };

  const handleResetAllTuneForSection = async () => {
    setFeedback(null);
    setSavingTune(true);
    try {
      await sectionAuditEngine.saveSectionManualTune(activeSectionKey, {
        revenue: null,
        profit: null,
        loss: null,
        expense: null
      });
      setTuneRevenue('');
      setTuneProfit('');
      setTuneLoss('');
      setTuneExpense('');
      setFeedback({ type: 'ok', text: '🔄 অটো ও লেজার হিসাবে রিসেট করা হয়েছে!' });
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'রিসেট করতে সমস্যা হয়েছে।' });
    } finally {
      setSavingTune(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10025] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 font-sans text-slate-800 text-left">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Top Gradient Header */}
        <div className="bg-gradient-to-r from-[#006e55] via-[#005a46] to-slate-900 px-4 py-3.5 text-white flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black bg-amber-400 text-slate-950 px-2 py-0.5 rounded-md">
                সেকশন {meta.numberBn} অডিট খাতা
              </span>
              {onNavigateToSection && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateToSection(activeSectionKey);
                  }}
                  className="text-[10px] font-black bg-white/15 hover:bg-white/25 text-white px-2 py-0.5 rounded-md border border-white/20 transition cursor-pointer flex items-center gap-0.5"
                >
                  <span>সেকশনে যান</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
            <h3 className="text-sm sm:text-base font-black truncate mt-0.5">
              {meta.emoji} {meta.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 12-Section Quick Switcher Strip */}
        <div className="bg-slate-100 border-b border-slate-200 px-3 py-2 flex items-center gap-1.5 overflow-x-auto shrink-0">
          {ALL_AUDIT_SECTION_KEYS.map((k) => {
            const m = SECTION_META_MAP[k];
            const active = k === activeSectionKey;
            return (
              <button
                key={k}
                type="button"
                onClick={() => onSelectSection(k)}
                className={`px-2.5 py-1 rounded-xl text-[10.5px] font-black whitespace-nowrap border transition cursor-pointer shrink-0 ${
                  active
                    ? 'bg-[#008769] text-white border-[#006e55] shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50'
                }`}
              >
                {m.emoji} {m.shortTitle}
              </button>
            );
          })}
        </div>

        {/* Scrollable Body */}
        <div className="p-3.5 sm:p-4 overflow-y-auto flex-1 space-y-3.5">
          {/* 4 + 1 Green-Box-Style Summary Strip */}
          {activeSectionKey === 'samity' && sectionAuditEngine.computeSamityCapitalAudit ? (() => {
            const modalSamityCap = sectionAuditEngine.computeSamityCapitalAudit(new Date().getFullYear());
            return (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div className="bg-teal-50 border border-teal-200 rounded-2xl p-2.5">
                  <span className="text-[10px] font-bold text-teal-800 block">১. মোট সমিতি পুঁজি</span>
                  <span className="text-sm font-black font-mono text-teal-950">{formatEngBDT(modalSamityCap.totalSamityCapital)}</span>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-2.5">
                  <span className="text-[10px] font-bold text-indigo-800 block">২. ইনভেস্টারে মোট কেনা</span>
                  <span className="text-sm font-black font-mono text-indigo-950">{formatEngBDT(modalSamityCap.totalInvestedBuy)}</span>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-2.5">
                  <span className="text-[10px] font-bold text-purple-800 block">৩. চলমান প্রজেক্ট বিনিয়োগ</span>
                  <span className="text-sm font-black font-mono text-purple-950">{formatEngBDT(modalSamityCap.activeInvestedBuy)}</span>
                </div>
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-2.5">
                  <span className="text-[10px] font-bold text-amber-900 block">৪. উত্তোলন / সুইচ অফ</span>
                  <span className="text-sm font-black font-mono text-amber-950">{formatEngBDT(modalSamityCap.switchOffRefundAmount)}</span>
                </div>
                <div className="col-span-2 sm:col-span-1 rounded-2xl p-2.5 border bg-slate-900 text-white border-slate-800">
                  <span className="text-[10px] font-bold text-emerald-300 block">৫. হাতে থাকা নগদ তহবিল</span>
                  <span className="text-sm font-black font-mono text-white">{formatEngBDT(modalSamityCap.cashRemainingInHand)}</span>
                </div>
              </div>
            );
          })() : (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="bg-teal-50 border border-teal-200 rounded-2xl p-2.5">
                <span className="text-[10px] font-bold text-teal-800 block">১. মোট আয়/লেনদেন</span>
                <span className="text-sm font-black font-mono text-teal-950">{formatEngBDT(stats.effectiveRevenue)}</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-2.5">
                <span className="text-[10px] font-bold text-emerald-800 block">২. অর্জিত লাভ (Profit)</span>
                <span className="text-sm font-black font-mono text-emerald-900">{formatEngBDT(stats.effectiveProfit)}</span>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-2.5">
                <span className="text-[10px] font-bold text-rose-800 block">৩. লোকসান / লস (Loss)</span>
                <span className="text-sm font-black font-mono text-rose-900">{formatEngBDT(stats.effectiveLoss)}</span>
              </div>
              <div className="bg-amber-50 border border-amber-300 rounded-2xl p-2.5">
                <span className="text-[10px] font-bold text-amber-900 block">৪. পৃথক খরচ (Expense)</span>
                <span className="text-sm font-black font-mono text-amber-950">{formatEngBDT(stats.effectiveExpense)}</span>
              </div>
              <div
                className={`col-span-2 sm:col-span-1 rounded-2xl p-2.5 border ${
                  stats.netResult >= 0
                    ? 'bg-slate-900 text-white border-slate-800'
                    : 'bg-rose-950 text-white border-rose-800'
                }`}
              >
                <span className="text-[10px] font-bold text-emerald-300 block">
                  {stats.netResult >= 0 ? 'নিট লাভ (Net)' : 'নিট ঘাটতি (Net)'}
                </span>
                <span className="text-sm font-black font-mono text-white">
                  {stats.netResult < 0 ? '-' : ''}
                  {formatEngBDT(Math.abs(stats.netResult))}
                </span>
              </div>
            </div>
          )}

          {/* Mode Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setTab('ledger')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                  tab === 'ledger'
                    ? 'bg-[#008769] text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-white'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>
                  {activeSectionKey === 'samity'
                    ? `পুঁজি ও বিনিয়োগ খাতা (${stats.manualEntries.length})`
                    : `পৃথক খরচ ও লাভ-লস খাতা (${stats.manualEntries.length})`}
                </span>
              </button>
              {activeSectionKey !== 'samity' && (
                <button
                  type="button"
                  onClick={() => setTab('tune')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                    tab === 'tune'
                      ? 'bg-amber-500 text-slate-950 shadow-2xs'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>⚙️ ম্যানুয়াল ব্যালেন্স টিউন</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setTab('auto')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                  tab === 'auto'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-white'
                }`}
              >
                <PieChart className="w-3.5 h-3.5" />
                <span>অটো লেনদেন হিসাব ({stats.autoItems.length})</span>
              </button>
            </div>

            {tab !== 'tune' && (
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as any)}
                className="text-xs font-bold bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 outline-none"
              >
                <option value="all">সব সময়</option>
                <option value="today">আজ</option>
                <option value="7d">গত ৭ দিন</option>
                <option value="month">চলতি মাস</option>
              </select>
            )}
          </div>

          {feedback && (
            <div
              className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-between ${
                feedback.type === 'ok'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-rose-50 text-rose-900 border-rose-200'
              }`}
            >
              <span>{feedback.text}</span>
              <button type="button" onClick={() => setFeedback(null)} className="cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* TAB 1: SEPARATE EXPENSE & P/L LEDGER (ADD / EDIT / DELETE) */}
          {tab === 'ledger' && (
            <div className="space-y-4">
              {/* Direct Inline Add/Edit Card */}
              <form
                onSubmit={handleSaveEntry}
                className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-3.5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-black text-emerald-950">
                    {editingEntry
                      ? '✏️ এন্ট্রি সংশোধন (Edit) করুন'
                      : activeSectionKey === 'samity'
                        ? '➕ সমবায় পুঁজি জমা / বিনিয়োগ / রিফান্ড লিখুন'
                        : `➕ ${meta.shortTitle}-এর নতুন খরচ / লাভ / লস লিখুন`}
                  </h4>
                  {editingEntry && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingEntry(null);
                        setTitle('');
                        setAmount('');
                        setNote('');
                      }}
                      className="text-[11px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg cursor-pointer"
                    >
                      এডিট বাতিল
                    </button>
                  )}
                </div>

                {/* Entry Type Buttons (No Profit/Loss for Samity) */}
                {activeSectionKey === 'samity' ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { k: 'revenue', label: '🏦 পুঁজি জমা / মাসিক আদায়' },
                        { k: 'expense', label: '📤 প্রজেক্ট ক্রয় / রিফান্ড উত্তোলন' }
                      ] as Array<{ k: AuditEntryType; label: string }>
                    ).map((opt) => (
                      <button
                        key={opt.k}
                        type="button"
                        onClick={() => setEntryType(opt.k)}
                        className={`py-2 px-2 rounded-xl text-[11px] font-black border transition cursor-pointer ${
                          entryType === opt.k
                            ? 'bg-[#008769] text-white border-[#006e55] shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5">
                    {(
                      [
                        { k: 'expense', label: '📉 খরচ (Expense)' },
                        { k: 'profit', label: '💰 লাভ (Profit)' },
                        { k: 'loss', label: '⚠️ লস (Loss)' },
                        { k: 'revenue', label: '🏦 আয় (Revenue)' }
                      ] as Array<{ k: AuditEntryType; label: string }>
                    ).map((opt) => (
                      <button
                        key={opt.k}
                        type="button"
                        onClick={() => setEntryType(opt.k)}
                        className={`py-2 px-2 rounded-xl text-[11px] font-black border transition cursor-pointer ${
                          entryType === opt.k
                            ? 'bg-[#008769] text-white border-[#006e55] shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black text-slate-600 block mb-1">বিবরণ / খাতের নাম *</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="যেমন: স্টাফ খরচ, সার্ভার বিল, ডিল লাভ..."
                      required
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-600 block mb-1">টাকার পরিমাণ (৳) *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      required
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-black font-mono text-slate-900 outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-600 block mb-1">তারিখ</label>
                    <input
                      type="date"
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                  <div>
                    <label className="text-[10px] font-black text-slate-600 block mb-1">ক্যাটাগরি</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600"
                    >
                      {meta.expenseCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-600 block mb-1">অতিরিক্ত নোট (ঐচ্ছিক)</label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="ভাউচার বা রেফারেন্স নোট..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-emerald-600"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingEntry}
                    className="w-full bg-[#008769] hover:bg-[#006e55] disabled:opacity-60 text-white py-2.5 px-4 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{savingEntry ? 'সংরক্ষণ হচ্ছে...' : editingEntry ? 'আপডেট সেভ করুন' : 'পৃথক খাতায় সেভ করুন'}</span>
                  </button>
                </div>
              </form>

              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
                <div className="flex items-center gap-1 flex-wrap">
                  {(
                    [
                      { k: 'all', l: 'সব এন্ট্রি' },
                      { k: 'expense', l: 'খরচ' },
                      { k: 'profit', l: 'লাভ' },
                      { k: 'loss', l: 'লস' },
                      { k: 'revenue', l: 'আয়' }
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.k}
                      type="button"
                      onClick={() => setFilterType(f.k)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-black border cursor-pointer ${
                        filterType === f.k
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {f.l}
                    </button>
                  ))}
                </div>
                <div className="relative sm:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="বিবরণ বা খাত খুঁজুন..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Manual Entries List */}
              {visibleManual.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs font-bold text-slate-500">
                    এই সেকশনে এখনো কোনো পৃথক খরচ বা লাভ-লস এন্ট্রি নেই। উপরের ফর্ম থেকে সরাসরি যোগ করুন।
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleManual.map((item) => {
                    const b = entryTypeBadge(item.entryType);
                    return (
                      <div
                        key={item.id}
                        className="bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${b.cls}`}>
                              {b.label}
                            </span>
                            {item.category && (
                              <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                                {item.category}
                              </span>
                            )}
                            <span className="text-[10px] font-mono text-slate-400">{item.entryDate}</span>
                          </div>
                          <p className="text-xs sm:text-sm font-black text-slate-800">{item.title}</p>
                          {item.note && <p className="text-[11px] text-slate-500">{item.note}</p>}
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                          <span className={`text-sm sm:text-base font-black font-mono ${b.amountCls}`}>
                            {b.sign}
                            {formatEngBDT(item.amount)}
                          </span>

                          {confirmDeleteId === item.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleConfirmDelete(item.id)}
                                className="bg-rose-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg cursor-pointer"
                              >
                                নিশ্চিত মুছুন
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-1 rounded-lg cursor-pointer"
                              >
                                না
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => startEdit(item)}
                                className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg cursor-pointer"
                                title="এডিট"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(item.id)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg cursor-pointer"
                                title="ডিলিট"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MANUAL SECTION BALANCE TUNE / OVERRIDE (Just like Green Box!) */}
          {tab === 'tune' && (
            <form
              onSubmit={handleSaveManualTune}
              className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/70 pb-3">
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-amber-950">
                    ⚙️ {meta.title} — ম্যানুয়াল ব্যালেন্স টিউন / কাস্টম এডিট
                  </h4>
                  <p className="text-[11px] text-amber-900/80 font-medium">
                    যে ঘরে সংখ্যা বসাবেন সেই ঘরের ব্যালেন্স সরাসরি ওই সংখ্যা দেখাবে। ঘর খালি রেখে সেভ করলে অটো + লেজার যোগফল দেখাবে।
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetAllTuneForSection}
                  disabled={savingTune}
                  className="bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> অটো হিসাবে রিসেট করুন
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-teal-900">১. মোট আয় / লেনদেন (Revenue)</span>
                    <span className="text-slate-500 font-mono">অটো+খাতা: {formatEngBDT(allTimeStats.combinedRevenue)}</span>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={tuneRevenue}
                    onChange={(e) => setTuneRevenue(e.target.value)}
                    placeholder="অটো রাখতে খালি রাখুন..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-black font-mono outline-none focus:border-amber-500"
                  />
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-emerald-900">২. অর্জিত লাভ (Profit)</span>
                    <span className="text-slate-500 font-mono">অটো+খাতা: {formatEngBDT(allTimeStats.combinedProfit)}</span>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={tuneProfit}
                    onChange={(e) => setTuneProfit(e.target.value)}
                    placeholder="অটো রাখতে খালি রাখুন..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-black font-mono outline-none focus:border-amber-500"
                  />
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-rose-900">৩. লোকসান / লস (Loss)</span>
                    <span className="text-slate-500 font-mono">অটো+খাতা: {formatEngBDT(allTimeStats.combinedLoss)}</span>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={tuneLoss}
                    onChange={(e) => setTuneLoss(e.target.value)}
                    placeholder="অটো রাখতে খালি রাখুন..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-black font-mono outline-none focus:border-amber-500"
                  />
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-amber-900">৪. পৃথক খরচ (Expense)</span>
                    <span className="text-slate-500 font-mono">অটো+খাতা: {formatEngBDT(allTimeStats.combinedExpense)}</span>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={tuneExpense}
                    onChange={(e) => setTuneExpense(e.target.value)}
                    placeholder="অটো রাখতে খালি রাখুন..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-black font-mono outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingTune}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs sm:text-sm py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Save className="w-4 h-4" />
                <span>{savingTune ? 'সংরক্ষণ হচ্ছে...' : 'ম্যানুয়াল ব্যালেন্স টিউন সংরক্ষণ করুন'}</span>
              </button>
            </form>
          )}

          {/* TAB 3: AUTO SYSTEM TRANSACTIONS BREAKDOWN */}
          {tab === 'auto' && (
            <div className="space-y-2.5">
              {visibleAuto.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-xs font-bold text-slate-500">
                    নির্বাচিত সময়ে এই সেকশনে কোনো অটোমেটিক সিস্টেম লেনদেন পাওয়া যায়নি।
                  </p>
                </div>
              ) : (
                visibleAuto.slice(0, 120).map((item) => {
                  const b = entryTypeBadge(item.entryType);
                  return (
                    <div
                      key={item.id}
                      className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-md border ${b.cls}`}>
                            {b.label}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                            {item.sourceLabel}
                          </span>
                        </div>
                        <p className="text-xs font-black text-slate-800 truncate">{item.title}</p>
                        {item.subtitle && <p className="text-[10.5px] text-slate-500 truncate">{item.subtitle}</p>}
                      </div>
                      <span className={`text-xs sm:text-sm font-black font-mono shrink-0 ${b.amountCls}`}>
                        {b.sign}
                        {formatEngBDT(item.amount)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[10.5px] font-bold text-slate-500">
            শুধুমাত্র এডমিন প্যানেল অভ্যন্তরীণ অডিট • সাধারণ সদস্যদের স্ক্রিনে অদৃশ্য
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black transition cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
}
