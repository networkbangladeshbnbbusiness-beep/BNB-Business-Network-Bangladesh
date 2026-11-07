import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/firebase';
import { SAMITY_MONTHS, SAMITY_YEARS, getUniquePaidMonthsCount, normalizePaidMonthsArray, getEffectiveBalance } from '../../types';
import { processUserSamitySavingsAutoDeduction, processBulkSamitySavingsAutoDeduction } from '../../lib/samitySavingsEngine';
console.log("AdminPanel: DB initialized:", !!db);
import { 
  collection, 
  getDocs, 
  getDoc,
  doc, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  setDoc,
  query, 
  orderBy,
  where,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  runTransaction
} from 'firebase/firestore';
import { User, Transaction, Notice, Offer, BapReport, BapGroup, BapAdminRequest, AppConfig, Product, UserNotification, CompanyFundAccount, AdminBroadcastLog, QardRuleItem, QardConfig, PhoneChangeRequest, SamityPolicyConfig, SamityFineTier } from '../../types';
import { normalizeMemberId, formatBanglaAmount, normalizePhoneNumber, findUserInFirestoreByPhone, getNextSequentialMemberId, deleteUserCompletelyFromDatabase, convertBengaliToEnglishDigits } from '../../lib/memberUtils';
import { sortTransactionsNewestFirst, getTxTime } from '../../lib/transactionUtils';
import { saveAppConfig, DEFAULT_QARD_CONFIG } from '../../lib/config';
import { BNBLogo } from '../BNBLogo';
import { HeaderPendingModal } from '../HeaderPendingModal';
import SamityScreen from '../SamityScreen';
import UnifiedBackButton from '../UnifiedBackButton';
import SamityAdmin from '../SamityAdmin';
import SafiPremiumShop from '../SafiPremiumShop';
import TelecomAdmin from '../TelecomAdmin';
import BNBSalaryAdmin from '../BNBSalaryAdmin';
import { HistoryRetentionSettings } from '../HistoryRetentionSettings';
import SamityInvestmentsView from '../SamityInvestmentsView';
import { runWalletEndToEndTests, TestResultItem } from '../../lib/walletTests';
import { 
  ExternalLink,
  ShieldCheck, 
  Users, 
  PiggyBank, 
  BadgeAlert, 
  Activity, 
  Briefcase, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  Send,
  ArrowLeft, 
  RefreshCw,
  RotateCcw,
  Search,
  Lock,
  Unlock,
  Megaphone,
  Check,
  Smartphone,
  Sparkles,
  UserPlus,
  Coins,
  History,
  FolderSync,
  AlertTriangle,
  AlertCircle,
  UserCheck,
  ChevronDown,
  SlidersHorizontal,
  CheckSquare,
  Save,
  Zap,
  ListOrdered,
  Settings,
  Bell,
  BellRing,
  Menu,
  Phone,
  Shield,
  ShieldAlert,
  FileText,
  ChevronRight,
  User as UserIcon,
  List,
  TrendingUp,
  ThumbsUp,
  HelpCircle,
  Home,
  Banknote,
  Wifi,
  Upload,
  Edit3,
  X,
  Scale,
  Printer,
  Building2,
  LayoutGrid,
  HeartHandshake,
  Heart,
  ClipboardList,
  Volume2,
  ShoppingBag,
  CreditCard,
  Truck,
  Store,
  BookOpen,
  Gift,
  Sliders,
  Wallet,
  Clock,
  Eye,
  EyeOff,
  Globe,
  PlusCircle,
  Calculator,
  Receipt,
  MapPin,
  Map as MapIcon,
  Cpu,
  FileJson,
  Pencil,
  PieChart,
  Copy,
  Calendar,
  ChevronLeft,
  CalendarDays,
  LineChart
} from 'lucide-react';
import { motion } from 'motion/react';
import LeafletActiveMap from '../LeafletActiveMap';

export const copyTextToClipboard = (text: string, label: string = 'নম্বর') => {
  if (!text) return;
  const cleanText = String(text).trim();
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(cleanText).then(() => {
      alert(`✅ ${label} (${cleanText}) সফলভাবে কপি করা হয়েছে!`);
    }).catch(() => {
      fallbackCopyText(cleanText, label);
    });
  } else {
    fallbackCopyText(cleanText, label);
  }
};

const fallbackCopyText = (text: string, label: string) => {
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    textArea.remove();
    alert(`✅ ${label} (${text}) সফলভাবে কপি করা হয়েছে!`);
  } catch (err) {
    prompt(`নিচে আপনার ${label} টি দেওয়া হলো, ম্যানুয়ালি কপি করুন:`, text);
  }
};

export const extractNumbersFromTx = (tx: any, targetUserPhone?: string) => {
  const foundNumbers: Array<{ number: string; label: string }> = [];
  const added = new Set<string>();

  const add = (numStr: any, labelStr: string) => {
    if (!numStr) return;
    const cleaned = String(numStr).trim();
    if (cleaned && cleaned !== 'N/A' && cleaned !== 'undefined' && cleaned !== 'null' && !added.has(cleaned)) {
      added.add(cleaned);
      foundNumbers.push({ number: cleaned, label: labelStr });
    }
  };

  // 1. Primary phone/account fields
  if (tx.userPhone) add(tx.userPhone, 'মেম্বার ফোন');
  if (targetUserPhone) add(targetUserPhone, 'মেম্বার ফোন');
  if (tx.senderPhone) add(tx.senderPhone, 'প্রেরক নম্বর');
  if (tx.senderInfo) add(tx.senderInfo, 'প্রেরক নম্বর');
  if (tx.accountNumber) add(tx.accountNumber, 'একাউন্ট/প্রেরক');
  if (tx.phoneNumber) add(tx.phoneNumber, 'টার্গেট নম্বর');
  if (tx.phone) add(tx.phone, 'ফোন নম্বর');

  // 2. Extract Bangladeshi mobile numbers (013-019XXXXXXXX) from description or paymentMethod
  const textBlob = `${tx.description || ''} ${tx.paymentMethod || ''}`;
  const bdPhoneMatches = textBlob.match(/(?:01[3-9]\d{8})/g);
  if (bdPhoneMatches) {
    bdPhoneMatches.forEach(num => add(num, 'পেমেন্ট নম্বর'));
  }

  // 3. Extract 10-18 digit account numbers
  const genNumMatches = textBlob.match(/\b\d{10,18}\b/g);
  if (genNumMatches) {
    genNumMatches.forEach(num => add(num, 'একাউন্ট নম্বর'));
  }

  // 4. TrxID
  if (tx.trxId) add(tx.trxId, 'TrxID');
  else if (tx.transactionId) add(tx.transactionId, 'TrxID');
  else if (tx.receiptNo) add(tx.receiptNo, 'TrxID');

  return foundNumbers;
};

interface AdminPanelProps {
  onBack: () => void;
  currentUser: User;
  appConfig: AppConfig;
  onChangeConfig: (newConfig: AppConfig) => void;
  appLanguage?: string;
  darkMode?: boolean;
}

export interface DispatchReport {
  id: string;
  timestamp: string;
  actionType: 'bonus' | 'fine' | 'notice';
  targetType: 'all' | 'single';
  targetName: string;
  targetCount: number;
  amount: number;
  reason: string;
  status: string;
}

export function AdminSamitySection(props: any) {


  const currentUser = props.currentUser || props.user || props.liveUser || {};
  const appConfig = props.appConfig || {};

  const {
    adminTab,
    y,
    text,
    users,
    setViewingGrid,
    type,
    notices,
    left,
    now,
    curYear,
    curMonthDef,
    BENGALI_MONTH_DEFS,
    isCurExempt,
    isMonthExemptedInConfig,
    key,
    getMonthExemptConfig,
    policyFormState,
    setQuickPenaltyDay,
    setQuickPenaltyNote,
    setIsQuickPenaltyModalOpen,
    setIsPolicyModalOpen,
    cfgAllowProfileSelfEdit,
    handleToggleProfileSelfEdit,
    u,
    isSubAdmin,
    setGeneralMemberFilterTab,
    generalMemberFilterTab,
    setAdminTab,
    uid,
    name,
    handleApproveUserAccount,
    handleRejectUserAccount,
    isResequencing,
    handleResequenceAllMemberIds,
    setShowAddMemberForm,
    showAddMemberForm,
    regSuccess,
    regError,
    handleManualMemberRegistration,
    newMemberName,
    setNewMemberName,
    target,
    newMemberPhone,
    setNewMemberPhone,
    newMemberPin,
    setNewMemberPin,
    newMemberId,
    setNewMemberId,
    autoGenerateMemberId,
    newRole,
    setNewRole,
    newMemberGroup,
    setNewMemberGroup,
    newMainsBal,
    setNewMainsBal,
    newTelBal,
    setNewTelBal,
    newShopBal,
    setNewShopBal,
    newSavings,
    setNewSavings,
    newDueLoan,
    setNewDueLoan,
    setRegSuccess,
    setRegError,
    generalMemberSearch,
    setGeneralMemberSearch,
    memberSortOrder,
    setMemberSortOrder,
    q,
    numA,
    numB,
    timeA,
    timeB,
    adminAgentRequests,
    img,
    getUserMainWalletBalance,
    handleApproveAppLockReset,
    handleRejectAppLockReset,
    showAppLockCodeMap,
    id,
    docId,
    setShowAppLockCodeMap,
    setCopiedAppLockUid,
    copiedAppLockUid,
    handleAdminInstantUnlockUser,
    openUserEditModal,
    handleDeleteUser
  } = props;

  const [samityActiveSubTab, setSamityActiveSubTab] = useState<'samity_portal' | 'member_directory' | 'pending_applications'>('member_directory');
  const [forceSamitySubView, setForceSamitySubView] = useState<'main' | 'our_investments' | null>(null);

  const [selectedAppForReview, setSelectedAppForReview] = useState<User | null>(null);
  const [selectedRoleForApp, setSelectedRoleForApp] = useState<'owner' | 'shareholder' | 'investor' | 'general'>('shareholder');
  const [assignMemberIdForApp, setAssignMemberIdForApp] = useState<string>('');
  const [modalRejectReason, setModalRejectReason] = useState<string>('প্রদত্ত এনআইডি বা তথ্যে গরমিল রয়েছে। অনুগ্রহ করে সঠিক তথ্য প্রদান করুন।');
  const [appSearchQuery, setAppSearchQuery] = useState<string>('');
  const [isReviewSubmitting, setIsReviewSubmitting] = useState<boolean>(false);

  // Master Hub 4-Section Controls State (null = closed by default)
  const [hubTab, setHubTab] = useState<'investments' | 'policy_rules' | 'fine_schedule' | 'dividend_policy' | null>(null);

  // 1. Policy & Rules State
  const [samityPolicyText, setSamityPolicyText] = useState<string>(() => 
    appConfig?.samityPolicyText || appConfig?.samityTermsAndConditions || `১. প্রতি মাসের ১ থেকে ১০ তারিখ পর্যন্ত সদস্যকে নিজের ইচ্ছায় কিস্তি পরিশোধ করার সুযোগ দেওয়া হয়।
২. ১০ তারিখের মধ্যে কিস্তি পরিশোধ না করা থাকলে এবং মেইন ব্যালেন্সে পর্যাপ্ত টাকা থাকলে ১১ তারিখে স্বয়ংক্রিয়ভাবে ১টি কিস্তি কেটে নেওয়া হয়।
৩. প্রতি মাসের ১৫ তারিখ হলো কিস্তি পরিশোধের শেষ তারিখ (Due Date)।
৪. ১৬ তারিখ থেকে প্রতিদিন ১ টাকা জরিমানা শুরু হয় (প্রথম ৩০ দিন প্রতিদিন ১ টাকা, ৩০ দিন অতিক্রান্ত হলে ৪৬তম দিন থেকে প্রতিদিন ১০ টাকা)।
৫. অনার (৳৪,০০০ + ৩ মাসে ৳১০,০০০), শেয়ার হোল্ডার (৳২,০০০ + ৩ মাসে ৳৫,০০০) এবং ইনভেস্টার (৳১,০০০) ক্যাটাগরি অনুযায়ী কিস্তি কার্যকর থাকবে।`
  );
  const [samityRulesTitle, setSamityRulesTitle] = useState<string>(appConfig?.samityRulesTitle || 'BNB সমবায় সমিতি ও ইনভেস্টর কোম্পানি নীতিমালা');

  // 2. Fine Schedule & Deadline State
  const [fineStartDay, setFineStartDay] = useState<number>(Number(appConfig?.fineStartDay) || 16);
  const [fineDeadlineDay, setFineDeadlineDay] = useState<number>(Number(appConfig?.fineDeadlineDay) || 15);
  const [lateFineAmount, setLateFineAmount] = useState<number>(Number(appConfig?.lateFineAmount) || 1);
  const [lateFineType, setLateFineType] = useState<'fixed' | 'per_day'>(appConfig?.lateFineType || 'per_day');
  const [lateFineEnabled, setLateFineEnabled] = useState<boolean>(appConfig?.lateFineEnabled !== false);
  const [lateFineNoticeText, setLateFineNoticeText] = useState<string>(appConfig?.lateFineNoticeText || 'প্রতি মাসের ১৫ তারিখ কিস্তি পরিশোধের শেষ দিন। ১৬ তারিখ থেকে প্রতিদিন ১ টাকা বিলম্ব ফি (জরিমানা) প্রযোজ্য হবে।');

  // 3. Dividend & Profit Share State
  const [ownerProfitPct, setOwnerProfitPct] = useState<number>(Number(appConfig?.ownerProfitPct) || 40);
  const [shareholderProfitPct, setShareholderProfitPct] = useState<number>(Number(appConfig?.shareholderProfitPct) || 35);
  const [investorProfitPct, setInvestorProfitPct] = useState<number>(Number(appConfig?.investorProfitPct) || 25);
  const [dividendPayoutDay, setDividendPayoutDay] = useState<number>(Number(appConfig?.dividendPayoutDay) || 1);
  const [dividendPolicyNotes, setDividendPolicyNotes] = useState<string>(appConfig?.dividendPolicyNotes || 'প্রতি মাসের ১ তারিখে স্বয়ংক্রিয়ভাবে ক্যাটাগরি অনুযায়ী মুনাফা বন্টন হিসাব সম্পন্ন হবে।');

  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);

  const handleSavePolicyRules = async () => {
    setIsSavingConfig(true);
    try {
      const configRef = doc(db, 'system_settings', 'app_config');
      await updateDoc(configRef, {
        samityPolicyText,
        samityRulesTitle,
        samityTermsAndConditions: samityPolicyText,
        updatedAt: new Date().toISOString()
      }).catch(() => setDoc(configRef, {
        samityPolicyText,
        samityRulesTitle,
        samityTermsAndConditions: samityPolicyText,
        updatedAt: new Date().toISOString()
      }, { merge: true }));

      if (typeof props.onChangeConfig === 'function') {
        props.onChangeConfig({
          ...appConfig,
          samityPolicyText,
          samityRulesTitle,
          samityTermsAndConditions: samityPolicyText
        });
      }
      alert('✅ সমবায় নীতিমালা ও নিয়মাবলী সফলভাবে সেভ করা হয়েছে!');
    } catch (err: any) {
      alert('নীতিমালা আপডেট করতে সমস্যা হয়েছে: ' + (err?.message || err));
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSaveFineSchedule = async () => {
    setIsSavingConfig(true);
    try {
      const configRef = doc(db, 'system_settings', 'app_config');
      const finePayload = {
        fineStartDay,
        fineDeadlineDay,
        lateFineAmount,
        lateFineType,
        lateFineEnabled,
        lateFineNoticeText,
        updatedAt: new Date().toISOString()
      };
      await updateDoc(configRef, finePayload).catch(() => setDoc(configRef, finePayload, { merge: true }));

      if (typeof props.onChangeConfig === 'function') {
        props.onChangeConfig({ ...appConfig, ...finePayload });
      }
      alert('✅ জরিমানা ও সময়সীমা সেটিংস সফলভাবে সেভ করা হয়েছে!');
    } catch (err: any) {
      alert('জরিমানা সেটিংস সেভ করতে সমস্যা হয়েছে: ' + (err?.message || err));
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSaveDividendPolicy = async () => {
    setIsSavingConfig(true);
    try {
      const configRef = doc(db, 'system_settings', 'app_config');
      const divPayload = {
        ownerProfitPct,
        shareholderProfitPct,
        investorProfitPct,
        dividendPayoutDay,
        dividendPolicyNotes,
        updatedAt: new Date().toISOString()
      };
      await updateDoc(configRef, divPayload).catch(() => setDoc(configRef, divPayload, { merge: true }));

      if (typeof props.onChangeConfig === 'function') {
        props.onChangeConfig({ ...appConfig, ...divPayload });
      }
      alert('✅ লভ্যাংশ বন্টন ও মুনাফা নীতি সফলভাবে সেভ করা হয়েছে!');
    } catch (err: any) {
      alert('মুনাফা নীতি সেভ করতে সমস্যা হয়েছে: ' + (err?.message || err));
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleOpenReviewModal = (user: User) => {
    setSelectedAppForReview(user);
    const initialRole = (user.memberCategory === 'owner' || user.memberCategory === 'shareholder' || user.memberCategory === 'investor' || user.memberCategory === 'regular')
      ? user.memberCategory 
      : 'shareholder';
    setSelectedRoleForApp(initialRole as any);
    const mId = user.memberId || (typeof autoGenerateMemberId === 'function' ? autoGenerateMemberId() : ('BNB-' + Math.floor(100000 + Math.random() * 900000)));
    setAssignMemberIdForApp(mId);
    setModalRejectReason('প্রদত্ত এনআইডি বা তথ্যে গরমিল রয়েছে। অনুগ্রহ করে সঠিক তথ্য প্রদান করুন।');
  };

  const handleConfirmSamityApproval = async (applicant: User, targetRole: string, targetMemberId: string) => {
    const targetUid = applicant.uid || applicant.id;
    if (!targetUid) {
      alert("আবেদনকারীর ইউজার আইডি পাওয়া যায়নি!");
      return;
    }

    setIsReviewSubmitting(true);
    try {
      const finalMemberId = targetMemberId.trim() || applicant.memberId || ('BNB-' + Math.floor(100000 + Math.random() * 900000));
      const nowIso = new Date().toISOString();
      const installmentAmt = Number((applicant as any).samityApplicationInstallmentAmount || applicant.monthlySavingsTarget) || (targetRole === 'owner' ? 5000 : targetRole === 'shareholder' ? 3000 : targetRole === 'investor' ? 2000 : 1000);

      const userRef = doc(db, 'users', targetUid);
      const userSnap = await getDoc(userRef);
      const freshUserData = userSnap.exists() ? userSnap.data() : applicant;
      const currentSavings = Number(freshUserData.savings || freshUserData.dpsBalance) || 0;
      const newSavings = currentSavings + installmentAmt;

      if (typeof props.setUsers === 'function') {
        props.setUsers((prev: User[]) => prev.map(u => (u.uid === targetUid || u.id === targetUid) ? {
          ...u,
          approved: true,
          samityApproved: true,
          isSamityMember: true,
          samityStatus: 'approved',
          samityAppliedAt: null,
          status: 'active',
          memberCategory: targetRole,
          samityRole: targetRole,
          memberId: finalMemberId,
          savings: newSavings,
          dpsBalance: newSavings
        } : u));
      }

      const appRef = doc(db, 'samity_applications', targetUid);

      const updatePayload = {
        approved: true,
        samityApproved: true,
        isSamityMember: true,
        samityStatus: 'approved',
        samityAppliedAt: null,
        status: 'active',
        memberCategory: targetRole,
        samityRole: targetRole,
        memberId: finalMemberId,
        savings: newSavings,
        dpsBalance: newSavings,
        updatedAt: nowIso
      };

      await Promise.all([
        updateDoc(userRef, updatePayload).catch(() => setDoc(userRef, updatePayload, { merge: true })),
        deleteDoc(appRef).catch(() => setDoc(appRef, updatePayload, { merge: true }))
      ]);

      // Update pending samity_deposit transaction if exists
      try {
        const qPendingTx = query(
          collection(db, 'transactions'),
          where('userId', '==', targetUid),
          where('category', '==', 'samity_deposit'),
          where('status', '==', 'pending')
        );
        const snapPendingTx = await getDocs(qPendingTx);
        await Promise.all(snapPendingTx.docs.map(async (d) => {
          await updateDoc(doc(db, 'transactions', d.id), {
            status: 'success',
            isApproved: true,
            reviewStatus: 'approved',
            description: `এডমিন কর্তৃক সদস্যপদ অনুমোদন সম্পন্ন এবং ১ম মাসের সঞ্চয় কিস্তি ৳${installmentAmt.toLocaleString('bn-BD')} টাকা সঞ্চয়ে জমা হয়েছে।`,
            updatedAt: nowIso
          });
        }));
      } catch (e) {
        console.warn("Tx update warning on approval:", e);
      }

      const roleLabels: Record<string, string> = {
        owner: '👑 অনার (Owner / স্বত্বাধিকারী)',
        shareholder: '📈 শেয়ার হোল্ডার (Shareholder / শেয়ারমালিক)',
        investor: '💼 ইনভেস্টার (Investor / বিনিয়োগকারী)',
        supporter: '🟡 সাপোর্টার (Supporter)',
        general: '👥 সাধারণ সমবায় সদস্য (General Member)'
      };
      const roleText = roleLabels[targetRole] || targetRole;

      const notifId = 'notif_samity_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      await setDoc(doc(db, 'user_notifications', notifId), {
        id: notifId,
        userId: targetUid,
        memberId: finalMemberId,
        title: "🎉 সমবায় সমিতির সদস্যপদ সফলভাবে অনুমোদিত!",
        body: `অভিনন্দন ${applicant.name || ''}! আপনার ${roleText} সদস্যপদ সফলভাবে অনুমোদিত হয়েছে এবং ১ম মাসের সঞ্চয় কিস্তি ৳${installmentAmt.toLocaleString('bn-BD')} টাকা আপনার সঞ্চয়ে জমা হয়েছে।`,
        read: false,
        createdAt: nowIso,
        type: 'samity_approved'
      }).catch(() => {});

      alert(`✅ সদস্যপদ সফলভাবে অনুমোদন করা হয়েছে! (১ম মাসের কিস্তি ৳${installmentAmt.toLocaleString('bn-BD')} টাকা সঞ্চয়ে যুক্ত হয়েছে)`);
      setSelectedAppForReview(null);
    } catch (err: any) {
      console.error("Error confirming samity approval:", err);
      alert("অনুমোদন করতে সমস্যা হয়েছে: " + (err.message || err));
    } finally {
      setIsReviewSubmitting(false);
    }
  };

  const handleRejectSamityAppWithReason = async (applicant: User, customReason?: string) => {
    const targetUid = applicant.uid || applicant.id;
    if (!targetUid) return;

    let reason = customReason !== undefined ? customReason : '';
    if (!reason || !reason.trim()) {
      reason = window.prompt("আবেদন বাতিলের কারণ লিখুন (সদস্যকে নোটিফিকেশন পাঠানো হবে):", "প্রদত্ত এনআইডি বা তথ্যে গরমিল রয়েছে। অনুগ্রহ করে সঠিক তথ্য প্রদান করুন।") || '';
    }
    const finalReason = reason.trim() || "প্রদত্ত এনআইডি বা তথ্যে অসংগতি থাকায় আবেদনটি বাতিল করা হয়েছে।";

    setIsReviewSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const installmentAmt = Number((applicant as any).samityApplicationInstallmentAmount || applicant.monthlySavingsTarget) || (applicant.memberCategory === 'owner' ? 5000 : applicant.memberCategory === 'shareholder' ? 3000 : applicant.memberCategory === 'investor' ? 2000 : 1000);

      const userRef = doc(db, 'users', targetUid);
      const userSnap = await getDoc(userRef);
      const freshUserData = userSnap.exists() ? userSnap.data() : applicant;
      const currentMainBal = Number(freshUserData.balance !== undefined ? freshUserData.balance : freshUserData.mainBalance) || 0;
      const refundedMainBal = currentMainBal + installmentAmt;

      if (typeof props.setUsers === 'function') {
        props.setUsers((prev: User[]) => prev.map(u => (u.uid === targetUid || u.id === targetUid) ? {
          ...u,
          samityStatus: 'rejected',
          samityApproved: false,
          samityAppliedAt: null,
          samityRejectionReason: finalReason,
          balance: refundedMainBal,
          mainBalance: refundedMainBal
        } : u));
      }

      const appRef = doc(db, 'samity_applications', targetUid);

      const updatePayload = {
        samityStatus: 'rejected',
        samityApproved: false,
        samityAppliedAt: null,
        status: 'rejected',
        samityRejectionReason: finalReason,
        balance: refundedMainBal,
        mainBalance: refundedMainBal,
        updatedAt: nowIso
      };

      await Promise.all([
        updateDoc(userRef, updatePayload).catch(() => setDoc(userRef, updatePayload, { merge: true })),
        deleteDoc(appRef).catch(() => setDoc(appRef, updatePayload, { merge: true }))
      ]);

      // Refund transaction
      try {
        const qPendingTx = query(
          collection(db, 'transactions'),
          where('userId', '==', targetUid),
          where('category', '==', 'samity_deposit'),
          where('status', '==', 'pending')
        );
        const snapPendingTx = await getDocs(qPendingTx);
        await Promise.all(snapPendingTx.docs.map(async (d) => {
          await updateDoc(doc(db, 'transactions', d.id), {
            status: 'rejected',
            isApproved: false,
            reviewStatus: 'rejected',
            rejectReason: finalReason,
            description: `সদস্যপদ আবেদন বাতিল হওয়ায় ১ম মাসের জমা ৳${installmentAmt.toLocaleString('bn-BD')} টাকা মেইন ওয়ালেটে রিফান্ড করা হয়েছে। কারণ: ${finalReason}`,
            updatedAt: nowIso
          });
        }));
      } catch (e) {
        console.warn("Tx update warning on rejection:", e);
      }

      const notifId = 'notif_samity_rej_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      await setDoc(doc(db, 'user_notifications', notifId), {
        id: notifId,
        userId: targetUid,
        title: "❌ সমবায় সদস্যপদ আবেদন বাতিল ও টাকা রিফান্ড",
        body: `দুঃখিত, আপনার সমবায় সদস্যপদ আবেদনটি বাতিল করা হয়েছে। কারণ: ${finalReason}। আবেদনের জন্য কেটে নেওয়া ১ম মাসের কিস্তির ৳${installmentAmt.toLocaleString('bn-BD')} টাকা আপনার মেইন ওয়ালেটে রিফান্ড করা হয়েছে।`,
        read: false,
        createdAt: nowIso,
        type: 'samity_rejected'
      }).catch(() => {});

      alert(`❌ আবেদন বাতিল সম্পন্ন হয়েছে এবং সদস্যের মেইন ওয়ালেটে ৳${installmentAmt.toLocaleString('bn-BD')} টাকা রিফান্ড করা হয়েছে।`);
      setSelectedAppForReview(null);
    } catch (err: any) {
      alert("বাতিল করতে সমস্যা হয়েছে: " + (err.message || err));
    } finally {
      setIsReviewSubmitting(false);
    }
  };

  useEffect(() => {
    if (adminTab === 'general') {
      setSamityActiveSubTab('member_directory');
    }
  }, [adminTab]);

  const [processingRefundUid, setProcessingRefundUid] = useState<string | null>(null);

  const handleApproveSamityRefund = async (memberUser: any) => {
    const refundAmt = Number(memberUser.savings !== undefined ? memberUser.savings : (memberUser as any).dpsBalance) || 0;
    if (!window.confirm(`${memberUser.name || 'সদস্য'} (আইডি: ${memberUser.memberId || 'N/A'}) এর জমানো মোট ৳${refundAmt.toLocaleString('bn-BD')} টাকা মেইন ওয়ালেটে রিফান্ড অনুমোদন করতে চান?`)) {
      return;


    }
    setProcessingRefundUid(memberUser.uid);
    try {
      const userRef = doc(db, 'users', memberUser.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        alert("ব্যবহারকারী ডাটাবেজে পাওয়া যায়নি!");
        return;
      }
      const freshData = userSnap.data();
      const currentBal = Number(freshData.balance !== undefined ? freshData.balance : freshData.mainBalance) || 0;
      const newBal = currentBal + refundAmt;
      const nowIso = new Date().toISOString();

      await updateDoc(userRef, {
        balance: newBal,
        mainBalance: newBal,
        savings: 0,
        dpsBalance: 0,
        samityAutoSavingsActive: false,
        samitySwitchStatus: 'OFF',
        samityDeactivateStatus: 'released',
        samityReleasedDate: nowIso,
        updatedAt: serverTimestamp()
      });

      // Create transaction log
      const txDocRef = doc(collection(db, 'transactions'));
      await setDoc(txDocRef, {
        id: txDocRef.id,
        userId: memberUser.uid,
        userName: memberUser.name || '',
        userPhone: memberUser.phone || '',
        memberId: memberUser.memberId || '',
        type: 'withdraw',
        typeLabel: 'সমবায় সঞ্চয় উত্তোলন ও রিফান্ড অনুমোদন',
        category: 'samity_withdraw',
        amount: refundAmt,
        status: 'success',
        isApproved: true,
        paymentMethod: 'মেইন ওয়ালেট রিফান্ড',
        description: `এডমিন কর্তৃক সমবায় সঞ্চয় বন্ধের আবেদন অনুমোদন ও মেইন ওয়ালেটে ৳${refundAmt.toLocaleString('bn-BD')} টাকা রিফান্ড প্রদান সম্পন্ন।`,
        createdAt: nowIso,
        date: new Date().toLocaleDateString('en-GB'),
        time: new Date().toLocaleTimeString(),
        receiptNo: `REC-SAMITY-APP-${Date.now()}`
      });

      // Update any pending transactions for this user
      try {
        const qPending = query(
          collection(db, 'transactions'),
          where('userId', '==', memberUser.uid),
          where('status', '==', 'pending')
        );
        const snapPending = await getDocs(qPending);
        await Promise.all(snapPending.docs.map(async (d) => {
          const dData = d.data();
          if (dData.category === 'samity_withdraw' || dData.type === 'withdraw' || (dData as any).isSavingsWithdraw || (dData.typeLabel || '').includes('সমবায়') || (dData.typeLabel || '').includes('সঞ্চয়')) {
            await updateDoc(doc(db, 'transactions', d.id), {
              status: 'success',
              isApproved: true,
              reviewStatus: 'approved',
              approvedAt: nowIso,
              updatedAt: nowIso
            });
          }
        }));
      } catch (e) {}

      // Dispatch User Notification
      await addDoc(collection(db, 'user_notifications'), {
        userId: memberUser.uid,
        memberId: memberUser.memberId || '',
        title: '🎉 সঞ্চয় উত্তোলন ও রিফান্ড অনুমোদন সম্পন্ন',
        message: `আপনার সঞ্চয় বন্ধ ও ৳${refundAmt.toLocaleString('bn-BD')} টাকা উত্তোলনের আবেদন এডমিন কর্তৃক সফলভাবে অনুমোদন করা হয়েছে এবং টাকা আপনার মেইন ব্যালেন্সে যুক্ত হয়েছে।`,
        body: `আপনার সঞ্চয় বন্ধ ও ৳${refundAmt.toLocaleString('bn-BD')} টাকা উত্তোলনের আবেদন এডমিন কর্তৃক সফলভাবে অনুমোদন করা হয়েছে এবং টাকা আপনার মেইন ব্যালেন্সে যুক্ত হয়েছে।`,
        isPersonal: true,
        read: false,
        type: 'samity',
        category: 'transaction',
        date: new Date().toLocaleDateString('en-GB'),
        time: new Date().toLocaleTimeString(),
        createdAt: serverTimestamp()
      });

      alert(`✅ সফল! ${memberUser.name || 'সদস্য'} এর ৳${refundAmt.toLocaleString('bn-BD')} টাকা মেইন ওয়ালেটে রিফান্ড অনুমোদন সম্পন্ন হয়েছে।`);
    } catch (err: any) {
      console.error("Refund approval error:", err);
      alert("অনুমোদনে সমস্যা হয়েছে: " + (err.message || err));
    } finally {
      setProcessingRefundUid(null);
    }
  };

  const handleApproveSamityCashPayout = async (memberUser: any) => {
    const payoutAmt = Number(memberUser.savings !== undefined ? memberUser.savings : (memberUser as any).dpsBalance) || 0;
    if (!window.confirm(`${memberUser.name || 'সদস্য'} কে কি সরাসরি ক্যাশ/হাতে ৳${payoutAmt.toLocaleString('bn-BD')} টাকা প্রদান করে একাউন্ট সেটেল করতে চান?`)) {
      return;
    }
    setProcessingRefundUid(memberUser.uid);
    try {
      const userRef = doc(db, 'users', memberUser.uid);
      const nowIso = new Date().toISOString();

      await updateDoc(userRef, {
        savings: 0,
        dpsBalance: 0,
        samityAutoSavingsActive: false,
        samitySwitchStatus: 'OFF',
        samityDeactivateStatus: 'released',
        samityReleasedDate: nowIso,
        updatedAt: serverTimestamp()
      });

      const txDocRef = doc(collection(db, 'transactions'));
      await setDoc(txDocRef, {
        id: txDocRef.id,
        userId: memberUser.uid,
        userName: memberUser.name || '',
        userPhone: memberUser.phone || '',
        memberId: memberUser.memberId || '',
        type: 'withdraw',
        typeLabel: 'সমবায় সঞ্চয় ক্যাশ প্রদান ও সেটেল',
        category: 'samity_withdraw',
        amount: payoutAmt,
        status: 'success',
        isApproved: true,
        paymentMethod: 'ক্যাশ / হাতে প্রদান',
        description: `এডমিন কর্তৃক সমবায় সঞ্চয় আমানত ৳${payoutAmt.toLocaleString('bn-BD')} টাকা সরাসরি ক্যাশ/হাতে প্রদান করে একাউন্ট ক্লোজ করা হয়েছে।`,
        createdAt: nowIso,
        date: new Date().toLocaleDateString('en-GB'),
        time: new Date().toLocaleTimeString(),
        receiptNo: `REC-SAMITY-CASH-${Date.now()}`
      });

      await addDoc(collection(db, 'user_notifications'), {
        userId: memberUser.uid,
        memberId: memberUser.memberId || '',
        title: '💵 সঞ্চয় আমানত ক্যাশ প্রদান সম্পন্ন',
        message: `আপনার সমবায় সমিতির সঞ্চয় আমানত মোট ৳${payoutAmt.toLocaleString('bn-BD')} টাকা সরাসরি ক্যাশে প্রদান করে একাউন্ট সেটেল করা হয়েছে।`,
        body: `আপনার সমবায় সমিতির সঞ্চয় আমানত মোট ৳${payoutAmt.toLocaleString('bn-BD')} টাকা সরাসরি ক্যাশে প্রদান করে একাউন্ট সেটেল করা হয়েছে।`,
        isPersonal: true,
        read: false,
        type: 'samity',
        date: new Date().toLocaleDateString('en-GB'),
        time: new Date().toLocaleTimeString(),
        createdAt: serverTimestamp()
      });

      alert(`✅ সফল! ${memberUser.name || 'সদস্য'} কে ক্যাশ প্রদান ও সেটেল সম্পন্ন হয়েছে।`);
    } catch (err: any) {
      console.error("Cash payout error:", err);
      alert("ক্যাশ সেটেলমেন্টে সমস্যা হয়েছে: " + (err.message || err));
    } finally {
      setProcessingRefundUid(null);
    }
  };

  const handleReactivateSamitySavings = async (memberUser: any) => {
    if (!window.confirm(`${memberUser.name || 'সদস্য'} এর জন্য অটো সঞ্চয় পুনরায় চালু (ON) করতে চান?`)) {
      return;
    }
    try {
      const userRef = doc(db, 'users', memberUser.uid);
      await updateDoc(userRef, {
        samityAutoSavingsActive: true,
        samitySwitchStatus: 'ON',
        samityDeactivateStatus: 'active',
        samityOptInReason: 'এডমিন কর্তৃক পুনরায় সঞ্চয় চালু করা হয়েছে',
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'user_notifications'), {
        userId: memberUser.uid,
        memberId: memberUser.memberId || '',
        title: '🔄 সমবায় সমিতি সঞ্চয় পুনরায় সচল (ON)',
        message: `আপনার সমিতির অটো সঞ্চয় এডমিন কর্তৃক পুনরায় সক্রিয় (ON) করা হয়েছে। প্রতিমাসের নির্দিষ্ট দিনে নিয়মিত সঞ্চয় জমা অব্যাহত থাকবে।`,
        body: `আপনার সমিতির অটো সঞ্চয় এডমিন কর্তৃক পুনরায় সক্রিয় (ON) করা হয়েছে। প্রতিমাসের নির্দিষ্ট দিনে নিয়মিত সঞ্চয় জমা অব্যাহত থাকবে।`,
        isPersonal: true,
        read: false,
        type: 'samity',
        date: new Date().toLocaleDateString('en-GB'),
        time: new Date().toLocaleTimeString(),
        createdAt: serverTimestamp()
      });

      alert(`✅ সফল! ${memberUser.name || 'সদস্য'} এর সঞ্চয় সফলভাবে পুনরায় চালু হয়েছে।`);
    } catch (err: any) {
      alert("সঞ্চয় পুনরায় চালু করতে সমস্যা হয়েছে: " + (err.message || err));
    }
  };

  const handleRejectSamityOptOut = async (memberUser: any) => {
    const reason = window.prompt("সঞ্চয় বন্ধের আবেদন বাতিলের কারণ লিখুন:", "নিয়ম অনুযায়ী চলতি মেয়াদ শেষে আবেদন প্রযোজ্য হবে");
    if (reason === null) return;
    try {
      const userRef = doc(db, 'users', memberUser.uid);
      const nowIso = new Date().toISOString();

      await updateDoc(userRef, {
        samityAutoSavingsActive: true,
        samitySwitchStatus: 'ON',
        samityDeactivateStatus: 'rejected',
        samityRejectReason: reason.trim(),
        updatedAt: serverTimestamp()
      });

      try {
        const qPending = query(
          collection(db, 'transactions'),
          where('userId', '==', memberUser.uid),
          where('status', '==', 'pending')
        );
        const snapPending = await getDocs(qPending);
        await Promise.all(snapPending.docs.map(async (d) => {
          const dData = d.data();
          if (dData.category === 'samity_withdraw' || dData.type === 'withdraw' || (dData as any).isSavingsWithdraw || (dData.typeLabel || '').includes('সমবায়') || (dData.typeLabel || '').includes('সঞ্চয়')) {
            await updateDoc(doc(db, 'transactions', d.id), {
              status: 'rejected',
              isApproved: false,
              reviewStatus: 'rejected',
              rejectReason: reason.trim(),
              rejectionReason: reason.trim(),
              updatedAt: nowIso
            });
          }
        }));
      } catch (e) {}

      await addDoc(collection(db, 'user_notifications'), {
        userId: memberUser.uid,
        memberId: memberUser.memberId || '',
        title: '❌ সঞ্চয় বন্ধের আবেদন বাতিল',
        message: `আপনার সঞ্চয় বন্ধের আবেদনটি এডমিন কর্তৃক বাতিল করা হয়েছে এবং সঞ্চয় সচল রাখা হয়েছে।\nকারণ: ${reason.trim()}`,
        body: `আপনার সঞ্চয় বন্ধের আবেদনটি এডমিন কর্তৃক বাতিল করা হয়েছে এবং সঞ্চয় সচল রাখা হয়েছে।\nকারণ: ${reason.trim()}`,
        isPersonal: true,
        read: false,
        type: 'samity',
        date: new Date().toLocaleDateString('en-GB'),
        time: new Date().toLocaleTimeString(),
        createdAt: serverTimestamp()
      });

      alert(`✅ আবেদন বাতিল সম্পন্ন হয়েছে এবং সদস্যকে অবহিত করা হয়েছে।`);
    } catch (err: any) {
      alert("বাতিল করতে সমস্যা হয়েছে: " + (err.message || err));
    }
  };

  return (
    <>
        {(adminTab === 'samity' || adminTab === 'general') && (
          <div className="space-y-4 animate-fade-in text-slate-800 font-sans">
            {/* Tabs removed as requested */}

            {samityActiveSubTab === 'pending_applications' && (
              <div className="space-y-4 animate-fade-in text-slate-800 font-sans text-left pb-32">
                <button
                  type="button"
                  onClick={() => setSamityActiveSubTab('member_directory')}
                  className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black transition shadow-sm border border-slate-700 active:scale-95 cursor-pointer"
                >
                  ⬅️ ব্যাক (Back)
                </button>

                <div className="bg-gradient-to-r from-amber-700 via-orange-800 to-amber-900 px-4 py-3 rounded-2xl text-white shadow-md border border-amber-600/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <h3 className="text-sm sm:text-base font-black flex items-center gap-2">
                      <span>⏳ সমবায় সমিতি সদস্য পদ ও ইনভেস্টর আবেদনপত্র যাচাই-বাছাই</span>
                    </h3>
                    <p className="text-xs text-amber-100/90">
                      কেউ সমবায় সমিতির সদস্য হতে আবেদন করলে এখানে সম্পূর্ণ তথ্য আসবে। তথ্য যাচাই করে একসেপ্ট করলে অনার, শেয়ার হোল্ডার বা ইনভেস্টার হিসেবে সদস্য হতে পারবেন।
                    </p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                    <input
                      type="text"
                      placeholder="🔍 নাম, মোবাইল বা আইডি দিয়ে খুঁজুন..."
                      value={appSearchQuery}
                      onChange={(e) => setAppSearchQuery(e.target.value)}
                      className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-amber-500/40 text-white placeholder-amber-200/60 text-xs w-full sm:w-64 outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>

                {(() => {
                  const pendingApps = users.filter((u: any) => {
                    const isPend = u.samityStatus === 'pending' || (u.samityAppliedAt && u.samityStatus !== 'approved' && u.samityStatus !== 'rejected');
                    if (!isPend) return false;
                    if (!appSearchQuery.trim()) return true;
                    const q = appSearchQuery.toLowerCase();
                    return (
                      (u.name && u.name.toLowerCase().includes(q)) ||
                      (u.phone && u.phone.toLowerCase().includes(q)) ||
                      (u.memberId && u.memberId.toLowerCase().includes(q)) ||
                      (u.nid && u.nid.toLowerCase().includes(q))
                    );
                  });

                  if (pendingApps.length === 0) {
                    return (
                      <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3 shadow-xs">
                        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto text-2xl border border-amber-100 shadow-xs">
                          ⏳
                        </div>
                        <h4 className="text-sm font-black text-slate-800">কোনো নতুন সমবায় সদস্য আবেদন অপেক্ষমান নেই</h4>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                          যখন কোনো সাধারণ সদস্য সমবায় সমিতি, শেয়ার হোল্ডার বা ইনভেস্টর হওয়ার জন্য আবেদন ফর্ম জমা দেবেন, তখন তাদের সম্পূর্ণ তথ্য ও এনআইডি সহ এখানে প্রদর্শিত হবে।
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                      {pendingApps.map((appUser: any, idx: number) => {
                        const memberCategoryLabel: Record<string, string> = {
                          owner: '👑 অনার (৳৫,০০০)',
                          shareholder: '📈 শেয়ার হোল্ডার (৳৩,০০০)',
                          investor: '💼 ইনভেস্টার (৳২,০০০)',
                          supporter: '🟡 সাপোর্টার (৳১,০০০)',
                          general: '👥 সাধারণ সদস্য'
                        };
                        const catLabel = memberCategoryLabel[appUser.memberCategory || 'shareholder'] || '📈 শেয়ার হোল্ডার';
                        const firstMonthAmt = Number(appUser.samityApplicationInstallmentAmount || appUser.monthlySavingsTarget) || (appUser.memberCategory === 'owner' ? 5000 : appUser.memberCategory === 'shareholder' ? 3000 : appUser.memberCategory === 'investor' ? 2000 : 1000);

                        return (
                          <div 
                            key={appUser.uid || idx}
                            className="bg-white border-2 border-amber-200/90 hover:border-amber-400 rounded-2xl p-2.5 shadow-2xs hover:shadow-xs transition space-y-2 flex flex-col justify-between relative overflow-hidden"
                          >
                            {/* Card Top Category & ID Badge */}
                            <div className="flex items-center justify-between gap-1 border-b border-amber-100 pb-1.5">
                              <span className="text-[9.5px] font-black bg-gradient-to-r from-amber-500 to-orange-600 text-white px-1.5 py-0.5 rounded-md truncate">
                                {catLabel}
                              </span>
                              {appUser.memberId && (
                                <span className="text-[8.5px] font-mono text-slate-600 font-bold bg-slate-100 px-1 py-0.5 rounded shrink-0">
                                  #{appUser.memberId}
                                </span>
                              )}
                            </div>

                            {/* Main Basic Info Block */}
                            <div className="space-y-1.5 text-left">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-amber-700 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                                  {(appUser.name || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-[11px] font-black text-slate-900 truncate leading-tight">{appUser.name || 'নামবিহীন সদস্য'}</h4>
                                  <p className="text-[9.5px] font-mono font-bold text-amber-800 truncate">📱 {appUser.phone}</p>
                                </div>
                              </div>

                              <div className="bg-amber-50/90 rounded-lg px-2 py-1 border border-amber-200/70 text-[9.5px] flex items-center justify-between">
                                <span className="text-slate-600 font-medium">১ম সঞ্চয় কিস্তি:</span>
                                <span className="font-mono font-black text-emerald-700">৳{firstMonthAmt.toLocaleString('bn-BD')}</span>
                              </div>

                              <p className="text-[8.5px] text-slate-400 font-medium truncate">
                                🕒 {appUser.samityAppliedAt ? new Date(appUser.samityAppliedAt).toLocaleDateString('bn-BD') : 'তারিখ অনুপলব্ধ'}
                              </p>
                            </div>

                            {/* Card Action Button - Single Button to View Details */}
                            <button
                              type="button"
                              onClick={() => handleOpenReviewModal(appUser)}
                              className="w-full py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-[10.5px] rounded-xl transition cursor-pointer flex items-center justify-center gap-1 active:scale-95 shadow-2xs"
                            >
                              <span>🔍</span>
                              <span>বিস্তারিত দেখুন</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {samityActiveSubTab === 'samity_portal' && (
              <div className="space-y-4 animate-fade-in text-slate-800 font-sans">
                {/* Back button logic */}
                <button
                    onClick={() => {
                        // If we are in the deeper view, go back one level first
                        if (forceSamitySubView === 'our_investments') {
                            setForceSamitySubView('main');
                        } 
                        // If we are already at main level, close the samity portal subview
                        else {
                            setSamityActiveSubTab('member_directory'); 
                            setViewingGrid(true);
                        }
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-bold text-slate-800 transition shadow-sm mb-2"
                >
                    ⬅️ ব্যাক (Back)
                </button>
                <SamityScreen
                  user={currentUser}
                  allUsers={users}
                  onBack={() => { setViewingGrid(true); setForceSamitySubView(null); }}
                  syncLiveProfile={() => {}}
                  setActiveTab={() => {}}
                  setModalType={(type) => { if (!type) { setViewingGrid(true); setForceSamitySubView(null); } }}
                  appConfig={appConfig}
                  allNotices={notices}
                  isAdminView={true}
                  initialSubView={forceSamitySubView || 'main'}
                />
              </div>
            )}

            {samityActiveSubTab === 'member_directory' && (
              <div className="space-y-3 animate-fade-in text-slate-800 font-sans text-left pb-96 sm:pb-[480px]">
                
                {/* IF A HUB TAB IS SELECTED -> OPEN FULL SEPARATE DEDICATED PAGE */}
                {hubTab !== null ? (
                  <div className="space-y-4 animate-fade-in">
                    {/* Top Header Navigation Bar for Full Page Sub-Views */}
                    <div className="bg-gradient-to-r from-[#00a884] via-emerald-700 to-teal-800 border-2 border-emerald-600 p-3 sm:p-4 rounded-3xl text-white shadow-md flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setHubTab(null)}
                        className="px-3.5 py-2 bg-white text-emerald-950 hover:bg-emerald-50 font-black rounded-xl text-xs shadow-md transition active:scale-95 cursor-pointer flex items-center gap-1.5 shrink-0 border border-emerald-200"
                      >
                        ⬅️ ব্যাক (Back)
                      </button>

                      <div className="text-right min-w-0">
                        <h3 className="text-xs sm:text-sm font-black text-amber-200 truncate">
                          {hubTab === 'investments' && '📈 আমাদের ইনভেস্টমেন্ট প্রজেক্ট পোর্টাল'}
                          {hubTab === 'policy_rules' && '📜 সমবায় সমিতি নিয়মাবলী এডিটর'}
                          {hubTab === 'fine_schedule' && '⏰ জরিমানা ও জমার ডেডলাইন সেটিংস'}
                          {hubTab === 'dividend_policy' && '📊 লভ্যাংশ ও মুনাফা বন্টন নীতি'}
                        </h3>
                        <p className="text-[10px] text-emerald-100 truncate">
                          BNB ইনভেস্টার কোম্পানি ও সমবায় সমিতি মাস্টার পোর্টাল
                        </p>
                      </div>
                    </div>

                    {/* Quick Switch Bar between the 4 sub-pages inside */}
                    <div className="grid grid-cols-4 gap-1 p-1 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-xs">
                      <button
                        type="button"
                        onClick={() => setHubTab('investments')}
                        className={`px-1 sm:px-2 py-1.5 rounded-xl text-[9px] sm:text-[11px] font-black transition flex items-center justify-center gap-1 cursor-pointer truncate ${
                          hubTab === 'investments'
                            ? 'bg-[#00a884] text-white shadow-sm border border-emerald-600'
                            : 'text-slate-700 hover:text-emerald-900 hover:bg-emerald-100/60'
                        }`}
                      >
                        <span>📈</span>
                        <span className="truncate">১. ইনভেস্ট</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setHubTab('policy_rules')}
                        className={`px-1 sm:px-2 py-1.5 rounded-xl text-[9px] sm:text-[11px] font-black transition flex items-center justify-center gap-1 cursor-pointer truncate ${
                          hubTab === 'policy_rules'
                            ? 'bg-[#00a884] text-white shadow-sm border border-emerald-600'
                            : 'text-slate-700 hover:text-emerald-900 hover:bg-emerald-100/60'
                        }`}
                      >
                        <span>📜</span>
                        <span className="truncate">২. নিয়মাবলী</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setHubTab('fine_schedule')}
                        className={`px-1 sm:px-2 py-1.5 rounded-xl text-[9px] sm:text-[11px] font-black transition flex items-center justify-center gap-1 cursor-pointer truncate ${
                          hubTab === 'fine_schedule'
                            ? 'bg-[#00a884] text-white shadow-sm border border-emerald-600'
                            : 'text-slate-700 hover:text-emerald-900 hover:bg-emerald-100/60'
                        }`}
                      >
                        <span>⏰</span>
                        <span className="truncate">৩. জরিমানা</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setHubTab('dividend_policy')}
                        className={`px-1 sm:px-2 py-1.5 rounded-xl text-[9px] sm:text-[11px] font-black transition flex items-center justify-center gap-1 cursor-pointer truncate ${
                          hubTab === 'dividend_policy'
                            ? 'bg-[#00a884] text-white shadow-sm border border-emerald-600'
                            : 'text-slate-700 hover:text-emerald-900 hover:bg-emerald-100/60'
                        }`}
                      >
                        <span>📊</span>
                        <span className="truncate">৪. লভ্যাংশ</span>
                      </button>
                    </div>

                    {/* FULL DEDICATED PAGE 1: OUR INVESTMENTS MANAGER */}
                    {hubTab === 'investments' && (
                      <div className="space-y-4 bg-white p-3 sm:p-5 rounded-3xl border-2 border-emerald-200 text-slate-800 shadow-md">
                        <div className="border-b border-emerald-100 pb-3 flex items-center justify-between gap-2">
                          <div>
                            <h4 className="text-sm sm:text-base font-black text-emerald-800 flex items-center gap-2">
                              <span>📈</span>
                              <span>আমাদের ইনভেস্ট প্রজেক্ট পোস্ট ও পোর্টফোলিও কন্ট্রোল</span>
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              নতুন ইনভেস্টমেন্ট প্রজেক্ট পোস্ট করুন, ছবি/বিবরণ এডিট করুন এবং ডিলিট করুন।
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setHubTab(null)}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-black rounded-xl text-xs transition border border-emerald-300 shrink-0 cursor-pointer"
                          >
                            ⬅️ ব্যাক
                          </button>
                        </div>

                        <SamityInvestmentsView
                          user={currentUser}
                          onBack={() => setHubTab(null)}
                          isAdmin={true}
                          hideHeader={false}
                        />
                      </div>
                    )}

                    {/* FULL DEDICATED PAGE 2: SAMITY POLICY & RULES TEXT EDITOR */}
                    {hubTab === 'policy_rules' && (
                      <div className="space-y-4 bg-white p-4 sm:p-6 rounded-3xl border-2 border-emerald-200 text-slate-800 shadow-md text-left">
                        <div className="border-b border-emerald-100 pb-3 flex items-center justify-between gap-2">
                          <div>
                            <h4 className="text-sm sm:text-base font-black text-emerald-800 flex items-center gap-2">
                              <span>📜</span>
                              <span>সমবায় সমিতি ও ইনভেস্টমেন্ট কোম্পানি নিয়ম-কানুন ম্যানুয়াল এডিটর</span>
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              সমবায় সমিতি, ইনভেস্টমেন্ট জমা, উত্তোলন ও জেনারেল নীতিমালার সব লেখা এখান থেকে ম্যানুয়ালি এডিট ও আপডেট করুন।
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setHubTab(null)}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-black rounded-xl text-xs transition border border-emerald-300 shrink-0 cursor-pointer"
                          >
                            ⬅️ ব্যাক
                          </button>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">
                              নীতিমালার শিরোনাম (Policy Title):
                            </label>
                            <input
                              type="text"
                              value={samityRulesTitle}
                              onChange={(e) => setSamityRulesTitle(e.target.value)}
                              placeholder="যেমন: BNB সমবায় সমিতি ও ইনভেস্টর কোম্পানি নীতিমালা"
                              className="w-full bg-emerald-50/40 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold focus:border-emerald-600 outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">
                              সম্পূর্ণ নিয়মাবলী ও শর্তাবলী (লাইন বাই লাইন লিখে দিন):
                            </label>
                            <textarea
                              rows={12}
                              value={samityPolicyText}
                              onChange={(e) => setSamityPolicyText(e.target.value)}
                              placeholder="এখানে সমিতির সমস্ত নিয়ম-কানুন ক্রমানুসারে লিখে দিন..."
                              className="w-full bg-emerald-50/40 border border-slate-300 rounded-2xl p-3.5 text-xs text-slate-900 leading-relaxed font-sans focus:border-emerald-600 outline-none"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={handleSavePolicyRules}
                            disabled={isSavingConfig}
                            className="w-full py-3 bg-[#00a884] hover:bg-[#009675] text-white font-black text-xs rounded-xl shadow-md transition active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <span>💾</span>
                            <span>{isSavingConfig ? 'সেভ করা হচ্ছে...' : 'নীতি ও নিয়মাবলী সেভ করুন'}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* FULL DEDICATED PAGE 3: FINE SCHEDULE & DEADLINE CONTROL */}
                    {hubTab === 'fine_schedule' && (
                      <div className="space-y-4 bg-white p-4 sm:p-6 rounded-3xl border-2 border-emerald-200 text-slate-800 shadow-md text-left">
                        <div className="border-b border-emerald-100 pb-3 flex items-center justify-between gap-2">
                          <div>
                            <h4 className="text-sm sm:text-base font-black text-teal-800 flex items-center gap-2">
                              <span>⏰</span>
                              <span>ডিপিএস/সঞ্চয় জমা দেওয়ার সময়সীমা ও জরিমানা সেটিংস</span>
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              মাসের কত তারিখ থেকে কত তারিখের মধ্যে ডিপিএস জমা দিতে হবে এবং কত তারিখ পার হলে কত টাকা জরিমানা প্রযোজ্য তা নির্ধারণ করুন।
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setHubTab(null)}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-black rounded-xl text-xs transition border border-emerald-300 shrink-0 cursor-pointer"
                          >
                            ⬅️ ব্যাক
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">
                              মাসের প্রারম্ভিক জমার দিন (Start Day):
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={31}
                              value={fineStartDay}
                              onChange={(e) => setFineStartDay(Number(e.target.value))}
                              className="w-full bg-emerald-50/40 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-black outline-none focus:border-teal-600"
                            />
                            <span className="text-[10px] text-slate-500 block mt-0.5">মাসের ১ম তারিখ থেকে জমা গ্রহণ শুরু</span>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">
                              জমা দেওয়ার শেষ সময়সীমা / ডেডলাইন (Deadline Day):
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={31}
                              value={fineDeadlineDay}
                              onChange={(e) => setFineDeadlineDay(Number(e.target.value))}
                              className="w-full bg-emerald-50/40 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-black outline-none focus:border-teal-600"
                            />
                            <span className="text-[10px] text-slate-500 block mt-0.5">যেমন: ১৫ তারিখের পর (১৬ তারিখ থেকে) বিলম্ব ফি শুরু হবে</span>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">
                              বিলম্ব ফি/জরিমানের পরিমাণ (৳):
                            </label>
                            <input
                              type="number"
                              value={lateFineAmount}
                              onChange={(e) => setLateFineAmount(Number(e.target.value))}
                              className="w-full bg-emerald-50/40 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-black outline-none focus:border-teal-600"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">
                              জরিমানা গণনার ধরণ:
                            </label>
                            <select
                              value={lateFineType}
                              onChange={(e) => setLateFineType(e.target.value as any)}
                              className="w-full bg-emerald-50/40 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-bold outline-none focus:border-teal-600"
                            >
                              <option value="fixed">এককালীন নির্দিষ্ট জরিমানা (Fixed Fine)</option>
                              <option value="per_day">প্রতিদিনের অতিরিক্ত জরিমানা (Per Day Fine)</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center justify-between bg-emerald-50 p-3 rounded-2xl border border-emerald-200">
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-slate-900">অটোমেটিক জরিমানা ধার্য সিস্টেম</span>
                            <p className="text-[10px] text-slate-600">ডেডলাইন অতিক্রম করলে জরিমানের নোটিশ ও হিসাব সচল থাকবে</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setLateFineEnabled(!lateFineEnabled)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                              lateFineEnabled ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                            }`}
                          >
                            {lateFineEnabled ? '🟢 সচল (ON)' : '🔴 বন্ধ (OFF)'}
                          </button>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">
                            জরিমানা সংক্রান্ত নোটিশ বার্তা:
                          </label>
                          <input
                            type="text"
                            value={lateFineNoticeText}
                            onChange={(e) => setLateFineNoticeText(e.target.value)}
                            className="w-full bg-emerald-50/40 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-teal-600"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={handleSaveFineSchedule}
                          disabled={isSavingConfig}
                          className="w-full py-3 bg-[#00a884] hover:bg-[#009675] text-white font-black text-xs rounded-xl shadow-md transition active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>💾</span>
                          <span>{isSavingConfig ? 'সেভ করা হচ্ছে...' : 'জরিমানা ও সময়সীমা সেটিংস সেভ করুন'}</span>
                        </button>
                      </div>
                    )}

                    {/* FULL DEDICATED PAGE 4: DIVIDEND & CATEGORY PROFIT POLICY */}
                    {hubTab === 'dividend_policy' && (
                      <div className="space-y-4 bg-white p-4 sm:p-6 rounded-3xl border-2 border-emerald-200 text-slate-800 shadow-md text-left">
                        <div className="border-b border-emerald-100 pb-3 flex items-center justify-between gap-2">
                          <div>
                            <h4 className="text-sm sm:text-base font-black text-emerald-800 flex items-center gap-2">
                              <span>📊</span>
                              <span>মাসিক লভ্যাংশ বন্টন ও ক্যাটাগরি মুনাফা নীতি</span>
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              অনার, শেয়ার হোল্ডার এবং ইনভেস্টার ক্যাটাগরির জন্য লভ্যাংশ শতকরা (%) বন্টন হার ও নীতি আপডেট করুন।
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setHubTab(null)}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-black rounded-xl text-xs transition border border-emerald-300 shrink-0 cursor-pointer"
                          >
                            ⬅️ ব্যাক
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="bg-amber-50/60 p-3 rounded-2xl border border-amber-200 space-y-1">
                            <span className="text-xs font-black text-amber-900">👑 অনার (Owner)</span>
                            <label className="text-[10px] text-slate-600 block">মুনাফা শেয়ার (%):</label>
                            <input
                              type="number"
                              value={ownerProfitPct}
                              onChange={(e) => setOwnerProfitPct(Number(e.target.value))}
                              className="w-full bg-white border border-amber-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-black outline-none focus:border-amber-500"
                            />
                          </div>

                          <div className="bg-blue-50/60 p-3 rounded-2xl border border-blue-200 space-y-1">
                            <span className="text-xs font-black text-blue-900">📈 শেয়ার হোল্ডার (Shareholder)</span>
                            <label className="text-[10px] text-slate-600 block">মুনাফা শেয়ার (%):</label>
                            <input
                              type="number"
                              value={shareholderProfitPct}
                              onChange={(e) => setShareholderProfitPct(Number(e.target.value))}
                              className="w-full bg-white border border-blue-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-black outline-none focus:border-blue-500"
                            />
                          </div>

                          <div className="bg-emerald-50/60 p-3 rounded-2xl border border-emerald-200 space-y-1">
                            <span className="text-xs font-black text-emerald-900">💼 ইনভেস্টার (Investor)</span>
                            <label className="text-[10px] text-slate-600 block">মুনাফা শেয়ার (%):</label>
                            <input
                              type="number"
                              value={investorProfitPct}
                              onChange={(e) => setInvestorProfitPct(Number(e.target.value))}
                              className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 font-black outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">
                              মাসিক লভ্যাংশ প্রদানের তারিখ (Payout Day):
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={31}
                              value={dividendPayoutDay}
                              onChange={(e) => setDividendPayoutDay(Number(e.target.value))}
                              className="w-full bg-emerald-50/40 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-black outline-none focus:border-emerald-600"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">
                              মুনাফা বন্টন সংক্রান্ত বিশেষ নীতি নির্দেশিকা:
                            </label>
                            <textarea
                              rows={3}
                              value={dividendPolicyNotes}
                              onChange={(e) => setDividendPolicyNotes(e.target.value)}
                              className="w-full bg-emerald-50/40 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 outline-none focus:border-emerald-600"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={handleSaveDividendPolicy}
                            disabled={isSavingConfig}
                            className="w-full py-3 bg-[#00a884] hover:bg-[#009675] text-white font-black text-xs rounded-xl shadow-md transition active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <span>💾</span>
                            <span>{isSavingConfig ? 'সেভ করা হচ্ছে...' : 'লভ্যাংশ বন্টন নীতি সেভ করুন'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* WHEN NO HUB TAB IS SELECTED -> SHOW MAIN SAMITY MASTER OVERVIEW DASHBOARD */
                  <div className="space-y-2.5 animate-fade-in">
                    {/* ========================================================================= */}
                    {/* 🏛️ 4-SECTION MASTER CONTROL HUB TOP BAR */}
                    {/* ========================================================================= */}
                    <div className="bg-gradient-to-r from-[#00a884] via-emerald-700 to-teal-800 border-2 border-emerald-600 rounded-3xl p-3 sm:p-4 text-white shadow-md space-y-3">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/20 pb-2.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🏛️</span>
                            <h3 className="text-xs sm:text-sm font-black text-amber-200 tracking-wide uppercase">
                              BNB ইনভেস্টর কোম্পানি ও সমবায় সমিতি মাস্টার ম্যানেজমেন্ট
                            </h3>
                          </div>
                          <p className="text-[10px] text-emerald-100 mt-0.5">
                            আমাদের ইনভেস্ট প্রজেক্ট পোস্ট, সমবায় নিয়মাবলী, জরিমানা ও সময়সীমা এবং লভ্যাংশ নীতি সম্পূর্ণ ম্যানুয়ালি কন্ট্রোল করুন।
                          </p>
                        </div>
                      </div>

                      {/* 4 Interactive Hub Navigation Tabs - STRICT SINGLE LINE (4 Columns) */}
                      <div className="grid grid-cols-4 gap-1 p-1 bg-emerald-950/40 rounded-2xl border border-white/20">
                        <button
                          type="button"
                          onClick={() => setHubTab('investments')}
                          className="px-1 sm:px-2.5 py-1.5 sm:py-2 rounded-xl text-[9.5px] sm:text-[11px] font-black transition flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap min-w-0 text-white hover:bg-white/20 active:scale-95"
                        >
                          <span className="text-xs shrink-0">📈</span>
                          <span className="truncate">১. আমাদের ইনভেস্ট</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setHubTab('policy_rules')}
                          className="px-1 sm:px-2.5 py-1.5 sm:py-2 rounded-xl text-[9.5px] sm:text-[11px] font-black transition flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap min-w-0 text-white hover:bg-white/20 active:scale-95"
                        >
                          <span className="text-xs shrink-0">📜</span>
                          <span className="truncate">২. নিয়মাবলী</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setHubTab('fine_schedule')}
                          className="px-1 sm:px-2.5 py-1.5 sm:py-2 rounded-xl text-[9.5px] sm:text-[11px] font-black transition flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap min-w-0 text-white hover:bg-white/20 active:scale-95"
                        >
                          <span className="text-xs shrink-0">⏰</span>
                          <span className="truncate">৩. জরিমানা/তারিখ</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setHubTab('dividend_policy')}
                          className="px-1 sm:px-2.5 py-1.5 sm:py-2 rounded-xl text-[9.5px] sm:text-[11px] font-black transition flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap min-w-0 text-white hover:bg-white/20 active:scale-95"
                        >
                          <span className="text-xs shrink-0">📊</span>
                          <span className="truncate">৪. লভ্যাংশ/মুনাফা</span>
                        </button>
                      </div>
                    </div>

            {/* 2. ⚙️ গ্লোবাল সদস্য তথ্য নিজস্ব আপডেট সুইচ (Member Profile Self-Edit Switch) - Slim Bar */}
            <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-emerald-50 border border-amber-200/90 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 text-left">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm">⚙️</span>
                  <h3 className="text-[11px] sm:text-xs font-black text-slate-900">
                    সদস্যদের নিজ প্রোফাইল তথ্য সংশোধন পাওয়ার সুইচ
                  </h3>
                  <span className={`px-2 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wide border ${
                    cfgAllowProfileSelfEdit 
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                      : 'bg-rose-100 text-rose-800 border-rose-300'
                  }`}>
                    {cfgAllowProfileSelfEdit ? '🟢 অন (ON)' : '🔴 অফ (OFF)'}
                  </span>
                </div>
                <p className="text-[9.5px] sm:text-[10px] text-slate-600 truncate">
                  {cfgAllowProfileSelfEdit 
                    ? 'অন থাকায় সদস্যরা প্রোফাইল থেকে নাম, এনআইডি, ঠিকানা, ছবি ও নমিনি নিজেরা পরিবর্তন করতে পারবে।'
                    : 'অফ থাকায় সদস্যরা নিজেরা কোনো তথ্য এডিট করতে পারবে না (শুধুমাত্র এডমিন এডিট করতে পারবে)।'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggleProfileSelfEdit(!cfgAllowProfileSelfEdit)}
                className={`w-full sm:w-auto px-3 py-1 rounded-lg text-[10.5px] font-black transition cursor-pointer shrink-0 shadow-2xs flex items-center justify-center gap-1 ${
                  cfgAllowProfileSelfEdit
                    ? 'bg-rose-600 hover:bg-rose-700 active:scale-95 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white'
                }`}
              >
                <span>{cfgAllowProfileSelfEdit ? '🔒 অফ করুন (Disable)' : '🔓 অন করুন (Enable)'}</span>
              </button>
            </div>

            {/* 3. 🌟 Member Statistics & Control Hub (১০টি সেকশন - ২টি লাইনে ৫টি করে) */}
            {(() => {
              const isSubAdminUser = (u: any) => Boolean(
                u.role === 'sub_admin' ||
                u.role === 'admin' ||
                (Array.isArray(u.subAdminPermissions) && u.subAdminPermissions.length > 0) ||
                u.isSubAdmin === true
              );

              const isOwnerUser = (u: any) => Boolean(
                u.memberCategory === 'owner' ||
                Number(u.monthlySavingsTarget) === 5000 ||
                u.memberGroup === 'owner'
              );

              const isShareholderUser = (u: any) => Boolean(
                (u.memberCategory === 'shareholder' || Number(u.monthlySavingsTarget) === 3000 || u.memberGroup === 'shareholder') &&
                !isOwnerUser(u)
              );

              const isInvestorUser = (u: any) => Boolean(
                (u.memberCategory === 'investor' || Number(u.monthlySavingsTarget) === 2000 || u.memberGroup === 'investor' || u.isInvestor === true || (Array.isArray(u.investments) && u.investments.length > 0)) &&
                !isOwnerUser(u) &&
                !isShareholderUser(u)
              );

              const isSupporterUser = (u: any) => Boolean(
                (u.memberCategory === 'supporter' || Number(u.monthlySavingsTarget) === 1000 || u.memberGroup === 'supporter') &&
                !isOwnerUser(u) &&
                !isShareholderUser(u) &&
                !isInvestorUser(u)
              );

              const isGeneralUser = (u: any) => Boolean(
                !isOwnerUser(u) &&
                !isShareholderUser(u) &&
                !isInvestorUser(u) &&
                !isSupporterUser(u) &&
                u.role !== 'admin' &&
                u.role !== 'sub_admin'
              );

              const isSamityMemberUser = (u: any) => Boolean(
                u.samityApproved === true ||
                u.samityStatus === 'approved' ||
                u.isSamityMember === true ||
                (Number(u.savings) > 0) ||
                isOwnerUser(u) ||
                isShareholderUser(u) ||
                isInvestorUser(u) ||
                isSupporterUser(u)
              );

              const isSwitchOffUser = (u: any) => Boolean(
                u.samityAutoSavingsActive === false ||
                u.samityDeactivateStatus === 'self_opted_out' ||
                u.samitySwitchStatus === 'OFF'
              );

              const isSwitchOnUser = (u: any) => Boolean(
                (u.samityAutoSavingsActive === true || u.samitySwitchStatus === 'ON' || u.samityDeactivateStatus === 'active') &&
                isSamityMemberUser(u) &&
                !isSwitchOffUser(u)
              );

              const currentMonthNumber = new Date().getMonth() + 1;

              const getPaidMonthsCountForUser = (u: any) => {
                if (Array.isArray(u.samityPaidMonths) && u.samityPaidMonths.length > 0) {
                  return getUniquePaidMonthsCount(u.samityPaidMonths, u.savings, u.monthlySavingsTarget);
                }
                const monthlyRate = Number(u.monthlySavingsTarget) || (isOwnerUser(u) ? 5000 : isShareholderUser(u) ? 3000 : isInvestorUser(u) ? 2000 : isSupporterUser(u) ? 1000 : 1000);
                const savings = Number(u.savings) || Number(u.dpsBalance) || 0;
                return Math.floor(savings / monthlyRate);
              };

              const isPaidCurrentMonthUser = (u: any) => {
                if (!isSamityMemberUser(u)) return false;
                if (isSwitchOffUser(u)) return false;
                const paidCount = getPaidMonthsCountForUser(u);
                return paidCount >= currentMonthNumber;
              };

              const isDueCurrentMonthUser = (u: any) => {
                if (!isSamityMemberUser(u)) return false;
                if (isSwitchOffUser(u)) return false;
                const paidCount = getPaidMonthsCountForUser(u);
                return paidCount < currentMonthNumber;
              };

              const isResetRequestedUser = (u: any) => Boolean(
                u.appLockResetRequested === true ||
                u.appLockResetStatus === 'pending' ||
                u.forgotPinRequested === true ||
                u.pinResetRequested === true ||
                (u.isAppLocked && (u.appLockResetStatus === 'pending' || u.appLockResetRequested === true))
              );

              const subAdminUsers = users.filter(isSubAdminUser);
              const ownerUsers = users.filter(isOwnerUser);
              const samityShareholderUsers = users.filter(isShareholderUser);
              const investorUsers = users.filter(isInvestorUser);
              const supporterUsers = users.filter(isSupporterUser);
              const generalAppUsers = users.filter(isGeneralUser);
              const switchOffUsers = users.filter(isSwitchOffUser);
              const switchOnUsers = users.filter(isSwitchOnUser);
              const paidCurrentMonthUsers = users.filter(isPaidCurrentMonthUser);
              const dueCurrentMonthUsers = users.filter(isDueCurrentMonthUser);
              const appLockResetUsers = users.filter(isResetRequestedUser);
              const totalSwitchOffRefundAmount = switchOffUsers.reduce((sum, u) => sum + (Number(u.savings) || 0) + (Number(u.samityBalance) || 0), 0);

              return (
                <div className="bg-slate-900 border border-slate-800 p-2 sm:p-2.5 rounded-xl text-white space-y-2 shadow-md">
                  {/* Hub Header - Slim 1-line */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      <h3 className="text-[11px] sm:text-xs font-bold text-slate-200 truncate">
                        📊 সদস্য ক্যাটাগরি ও ফিল্টার হাব (১০টি সেকশন)
                      </h3>
                    </div>

                    {appLockResetUsers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setGeneralMemberFilterTab('reset_requests')}
                        className="bg-rose-950 hover:bg-rose-900 border border-rose-500/60 px-2 py-0.5 rounded-md flex items-center gap-1.5 cursor-pointer shadow-xs transition animate-pulse shrink-0"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                        <span className="text-[10px] font-black text-rose-200">
                          🔒 {appLockResetUsers.length}টি রিসেট রিকোয়েস্ট!
                        </span>
                      </button>
                    )}
                  </div>

                  {/* ROW 1: 🔴🔵🟢🟡⚪ সদস্য ক্যাটাগরি — ১ সিরিয়ালে ৫টি সেকশন */}
                  <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-1.5 shadow-sm space-y-1">
                    <div className="flex items-center justify-between px-1 text-[9.5px] font-black text-slate-300">
                      <span>🔴🔵🟢🟡⚪ সদস্য ক্যাটাগরি ফিল্টার ও নিয়ন্ত্রণ (১ম সারিতে ৫টি ক্যাটাগরি):</span>
                      <span className="text-[8px] font-mono text-emerald-400">রিয়েল-টাইম সিঙ্ক</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1 sm:gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800">
                      {/* 1. 🔴 ওনার (৳৫,০০০/মাস) */}
                      <button
                        type="button"
                        onClick={() => setGeneralMemberFilterTab(generalMemberFilterTab === 'owner' ? 'all' : 'owner')}
                        className={`py-1.5 px-0.5 rounded-lg transition-all flex flex-col items-center justify-between text-center cursor-pointer min-h-[58px] ${
                          generalMemberFilterTab === 'owner'
                            ? 'bg-rose-700 text-white ring-2 ring-rose-400 shadow-md font-black border-rose-500'
                            : 'bg-slate-800 hover:bg-rose-950/60 text-slate-200 border border-slate-700'
                        }`}
                      >
                        <span className="text-[10px] sm:text-[11px] font-black leading-tight truncate max-w-full">🔴 ওনার</span>
                        <span className="text-[8.5px] sm:text-[9.5px] font-mono font-bold text-rose-300 truncate max-w-full">৳৫,০০০/মাস</span>
                        <span className="text-[8px] sm:text-[8.5px] bg-black/40 text-rose-200 px-1 py-0.2 rounded font-bold mt-0.5 truncate max-w-full">
                          {ownerUsers.length} জন
                        </span>
                      </button>

                      {/* 2. 🔵 শেয়ার হোল্ডার (৳৩,০০০/মাস) */}
                      <button
                        type="button"
                        onClick={() => setGeneralMemberFilterTab(generalMemberFilterTab === 'shareholder' ? 'all' : 'shareholder')}
                        className={`py-1.5 px-0.5 rounded-lg transition-all flex flex-col items-center justify-between text-center cursor-pointer min-h-[58px] ${
                          generalMemberFilterTab === 'shareholder'
                            ? 'bg-blue-600 text-white ring-2 ring-blue-400 shadow-md font-black border-blue-500'
                            : 'bg-slate-800 hover:bg-blue-950/60 text-slate-200 border border-slate-700'
                        }`}
                      >
                        <span className="text-[10px] sm:text-[11px] font-black leading-tight truncate max-w-full">🔵 শেয়ার হোল্ডার</span>
                        <span className="text-[8.5px] sm:text-[9.5px] font-mono font-bold text-blue-300 truncate max-w-full">৳৩,০০০/মাস</span>
                        <span className="text-[8px] sm:text-[8.5px] bg-black/40 text-blue-200 px-1 py-0.2 rounded font-bold mt-0.5 truncate max-w-full">
                          {samityShareholderUsers.length} জন
                        </span>
                      </button>

                      {/* 3. 🟢 ইনভেস্টার (৳২,০০০/মাস) */}
                      <button
                        type="button"
                        onClick={() => setGeneralMemberFilterTab(generalMemberFilterTab === 'investor' ? 'all' : 'investor')}
                        className={`py-1.5 px-0.5 rounded-lg transition-all flex flex-col items-center justify-between text-center cursor-pointer min-h-[58px] ${
                          generalMemberFilterTab === 'investor'
                            ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 shadow-md font-black border-emerald-500'
                            : 'bg-slate-800 hover:bg-emerald-950/60 text-slate-200 border border-slate-700'
                        }`}
                      >
                        <span className="text-[10px] sm:text-[11px] font-black leading-tight truncate max-w-full">🟢 ইনভেস্টার</span>
                        <span className="text-[8.5px] sm:text-[9.5px] font-mono font-bold text-emerald-300 truncate max-w-full">৳২,০০০/মাস</span>
                        <span className="text-[8px] sm:text-[8.5px] bg-black/40 text-emerald-200 px-1 py-0.2 rounded font-bold mt-0.5 truncate max-w-full">
                          {investorUsers.length} জন
                        </span>
                      </button>

                      {/* 4. 🟡 সাপোর্টার (৳১,০০০/মাস) */}
                      <button
                        type="button"
                        onClick={() => setGeneralMemberFilterTab(generalMemberFilterTab === 'supporter' ? 'all' : 'supporter')}
                        className={`py-1.5 px-0.5 rounded-lg transition-all flex flex-col items-center justify-between text-center cursor-pointer min-h-[58px] ${
                          generalMemberFilterTab === 'supporter'
                            ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300 shadow-md font-black border-amber-400'
                            : 'bg-slate-800 hover:bg-amber-950/60 text-slate-200 border border-slate-700'
                        }`}
                      >
                        <span className="text-[10px] sm:text-[11px] font-black leading-tight truncate max-w-full">🟡 সাপোর্টার</span>
                        <span className="text-[8.5px] sm:text-[9.5px] font-mono font-bold text-amber-300 truncate max-w-full">৳১,০০০/মাস</span>
                        <span className="text-[8px] sm:text-[8.5px] bg-black/40 text-amber-200 px-1 py-0.2 rounded font-bold mt-0.5 truncate max-w-full">
                          {supporterUsers.length} জন
                        </span>
                      </button>

                      {/* 5. ⚪ সাধারণ সদস্য (সমবায় সমিতিতে নাই) */}
                      <button
                        type="button"
                        onClick={() => setGeneralMemberFilterTab(generalMemberFilterTab === 'general' ? 'all' : 'general')}
                        className={`py-1.5 px-0.5 rounded-lg transition-all flex flex-col items-center justify-between text-center cursor-pointer min-h-[58px] ${
                          generalMemberFilterTab === 'general'
                            ? 'bg-white text-slate-900 ring-2 ring-slate-300 shadow-md font-black border-white'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
                        }`}
                      >
                        <span className="text-[10px] sm:text-[11px] font-black leading-tight truncate max-w-full">⚪ সাধারণ সদস্য</span>
                        <span className="text-[8.5px] sm:text-[9.5px] font-mono font-bold text-slate-300 truncate max-w-full">ফ্রি / বেসিক</span>
                        <span className="text-[8px] sm:text-[8.5px] bg-black/40 text-slate-200 px-1 py-0.2 rounded font-bold mt-0.5 truncate max-w-full">
                          {generalAppUsers.length} জন
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* ROW 2: 📌 অ্যাডমিন ও সমিতি পেমেন্ট ফিল্টার হাব (২য় সারিতে নতুন ৫টি সেকশন) */}
                  <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-1.5 shadow-sm space-y-1">
                    <div className="flex items-center justify-between px-1 text-[9.5px] font-black text-slate-300">
                      <span>📌 অ্যাডমিন ও রানিং মাস পেমেন্ট ফিল্টার হাব (২য় সারিতে ৫টি সেকশন):</span>
                      <span className="text-[8px] font-mono text-emerald-400">অটো ট্র্যাকিং</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1 sm:gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800">
                      {/* 1. 👥 সর্বমোট সদস্য */}
                      <button
                        type="button"
                        onClick={() => setGeneralMemberFilterTab('all')}
                        className={`py-1.5 px-0.5 rounded-lg transition-all flex flex-col items-center justify-between text-center cursor-pointer min-h-[58px] ${
                          generalMemberFilterTab === 'all'
                            ? 'bg-purple-600 text-white ring-2 ring-purple-400 shadow-md font-black border-purple-500'
                            : 'bg-slate-800 hover:bg-purple-950/60 text-slate-200 border border-slate-700'
                        }`}
                      >
                        <span className="text-[10px] sm:text-[11px] font-black leading-tight truncate max-w-full">👥 সর্বমোট সদস্য</span>
                        <span className="text-[8.5px] sm:text-[9.5px] font-mono font-bold text-purple-300 truncate max-w-full">সকল মেম্বার</span>
                        <span className="text-[8px] sm:text-[8.5px] bg-black/40 text-purple-200 px-1 py-0.2 rounded font-bold mt-0.5 truncate max-w-full">
                          {users.length} জন
                        </span>
                      </button>

                      {/* 2. 👑 সাব এডমিন / বিশেষ দায়িত্ব */}
                      <button
                        type="button"
                        onClick={() => setGeneralMemberFilterTab(generalMemberFilterTab === 'sub_admin' ? 'all' : 'sub_admin')}
                        className={`py-1.5 px-0.5 rounded-lg transition-all flex flex-col items-center justify-between text-center cursor-pointer min-h-[58px] ${
                          generalMemberFilterTab === 'sub_admin'
                            ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 shadow-md font-black border-indigo-500'
                            : 'bg-slate-800 hover:bg-indigo-950/60 text-slate-200 border border-slate-700'
                        }`}
                      >
                        <span className="text-[10px] sm:text-[11px] font-black leading-tight truncate max-w-full">👑 সাব এডমিন</span>
                        <span className="text-[8.5px] sm:text-[9.5px] font-mono font-bold text-indigo-300 truncate max-w-full">বিশেষ দায়িত্ব</span>
                        <span className="text-[8px] sm:text-[8.5px] bg-black/40 text-indigo-200 px-1 py-0.2 rounded font-bold mt-0.5 truncate max-w-full">
                          {subAdminUsers.length} জন
                        </span>
                      </button>

                      {/* 3. 🔴 সমিতি সুইচ অফ */}
                      <button
                        type="button"
                        onClick={() => setGeneralMemberFilterTab(generalMemberFilterTab === 'switch_off' ? 'all' : 'switch_off')}
                        className={`py-1.5 px-0.5 rounded-lg transition-all flex flex-col items-center justify-between text-center cursor-pointer min-h-[58px] ${
                          generalMemberFilterTab === 'switch_off'
                            ? 'bg-rose-900 text-white ring-2 ring-rose-500 shadow-md font-black border-rose-600'
                            : 'bg-slate-800 hover:bg-rose-950/60 text-slate-200 border border-slate-700'
                        }`}
                      >
                        <span className="text-[10px] sm:text-[11px] font-black leading-tight truncate max-w-full">🔴 সুইচ অফ</span>
                        <span className="text-[8.5px] sm:text-[9.5px] font-mono font-bold text-rose-300 truncate max-w-full">বন্ধ সঞ্চয়</span>
                        <span className="text-[8px] sm:text-[8.5px] bg-black/40 text-rose-200 px-1 py-0.2 rounded font-bold mt-0.5 truncate max-w-full">
                          {switchOffUsers.length} জন
                        </span>
                      </button>

                      {/* 4. 🟢 চলতি মাস পরিশোধিত */}
                      <button
                        type="button"
                        onClick={() => setGeneralMemberFilterTab(generalMemberFilterTab === 'paid_current_month' ? 'all' : 'paid_current_month')}
                        className={`py-1.5 px-0.5 rounded-lg transition-all flex flex-col items-center justify-between text-center cursor-pointer min-h-[58px] ${
                          generalMemberFilterTab === 'paid_current_month'
                            ? 'bg-emerald-700 text-white ring-2 ring-emerald-400 shadow-md font-black border-emerald-500'
                            : 'bg-slate-800 hover:bg-emerald-950/60 text-slate-200 border border-slate-700'
                        }`}
                      >
                        <span className="text-[10px] sm:text-[11px] font-black leading-tight truncate max-w-full">🟢 রানিং মাস ওকে</span>
                        <span className="text-[8.5px] sm:text-[9.5px] font-mono font-bold text-emerald-300 truncate max-w-full">পরিশোধিত</span>
                        <span className="text-[8px] sm:text-[8.5px] bg-black/40 text-emerald-200 px-1 py-0.2 rounded font-bold mt-0.5 truncate max-w-full">
                          {paidCurrentMonthUsers.length} জন
                        </span>
                      </button>

                      {/* 5. ⚠️ রানিং মাস বকেয়া সদস্য */}
                      <button
                        type="button"
                        onClick={() => setGeneralMemberFilterTab(generalMemberFilterTab === 'due_current_month' ? 'all' : 'due_current_month')}
                        className={`py-1.5 px-0.5 rounded-lg transition-all flex flex-col items-center justify-between text-center cursor-pointer min-h-[58px] ${
                          generalMemberFilterTab === 'due_current_month'
                            ? 'bg-amber-600 text-slate-950 ring-2 ring-amber-300 shadow-md font-black border-amber-400 animate-pulse'
                            : 'bg-slate-800 hover:bg-amber-950/60 text-slate-200 border border-slate-700'
                        }`}
                      >
                        <span className="text-[10px] sm:text-[11px] font-black leading-tight truncate max-w-full">⚠️ রানিং মাস বকেয়া</span>
                        <span className="text-[8.5px] sm:text-[9.5px] font-mono font-bold text-amber-300 truncate max-w-full">অপরিশোধিত</span>
                        <span className="text-[8px] sm:text-[8.5px] bg-black/40 text-amber-200 px-1 py-0.2 rounded font-bold mt-0.5 truncate max-w-full">
                          {dueCurrentMonthUsers.length} জন
                        </span>
                      </button>
                    </div>
                  </div>

                </div>
              );
            })()}



            {/* 5. Header controls for Manual Member Registration Toggle & Serial ID Resequence - Slim Bar */}
            <div className="bg-white border border-slate-150 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <span>📌 সদস্য সিরিয়াল ও রেজিষ্ট্রেশন কন্ট্রোল</span>
                </h4>
                <p className="text-[10px] text-slate-500 truncate">
                  সদস্যদের সিরিয়াল আইডি 1 থেকে পরপর (BNB00000001 - 1,00,000) সুবিন্যস্ত রাখুন বা নতুন সদস্য যোগ করুন।
                </p>
              </div>
              <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0 flex-wrap">
                <button
                  type="button"
                  disabled={isResequencing}
                  onClick={handleResequenceAllMemberIds}
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[11px] rounded-lg transition cursor-pointer shadow-xs flex items-center justify-center gap-1 disabled:opacity-50"
                  title="সকল সদস্যের সিরিয়াল নম্বর 1 থেকে পরপর ঠিক করুন"
                >
                  <RefreshCw className={`w-3 h-3 ${isResequencing ? 'animate-spin' : ''}`} />
                  {isResequencing ? 'ফিক্স হচ্ছে...' : '🔢 সিরিয়াল 1 থেকে ঠিক করুন'}
                </button>

                {/* ⏳ পেন্ডিং সমিতি সদস্য আবেদন রিকোয়েস্ট বাটন (লাল দাগ চিহ্নিত স্থান) */}
                <button
                  type="button"
                  onClick={() => setSamityActiveSubTab('pending_applications')}
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] rounded-lg transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5 active:scale-95 border border-rose-400/40 relative"
                  title="সমিতিতে যোগদানের অপেক্ষমান সদস্য আবেদনপত্রসমূহ যাচাই-বাছাই ও অনুমোদন করুন"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping shrink-0" />
                  <span>⏳ পেন্ডিং রিকোয়েস্ট</span>
                  <span className="bg-white text-rose-900 text-[10px] font-mono font-black px-1.5 py-0.2 rounded-full ml-0.5">
                    {users.filter((u: any) => u.samityStatus === 'pending' || (u.samityAppliedAt && u.samityStatus !== 'approved' && u.samityStatus !== 'rejected')).length}টি
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddMemberForm(!showAddMemberForm)}
                  className={`flex-1 sm:flex-none px-3 py-1.5 text-[11px] font-black rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                    showAddMemberForm
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200'
                      : 'bg-[#00a884] hover:bg-[#009675] text-white shadow-xs active:scale-95'
                  }`}
                >
                  {showAddMemberForm ? '✕ ফর্ম বন্ধ' : '➕ নতুন সদস্য নিবন্ধন'}
                </button>
              </div>
            </div>

            {/* Collapsing New Member Registration Form */}
            {showAddMemberForm && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3 animate-fade-in">
                <div className="border-b border-slate-200 pb-2">
                  <h3 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5">
                    👥 নতুন সমবায় সদস্য ম্যানুয়াল রেজিষ্ট্রেশন
                  </h3>
                  <p className="text-[10px] text-slate-500">মেম্বার আইডি, মোবাইল নম্বর, 4 ডিজিটের পিন ও প্রারম্ভিক শেয়ার সঞ্চয় দিয়ে সরাসরি যুক্ত করুন।</p>
                </div>

                {regSuccess && (
                  <div className="bg-emerald-50 border border-emerald-200 text-[#00a884] text-xs p-2.5 rounded-xl font-bold">
                    {regSuccess}
                  </div>
                )}
                {regError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs p-2.5 rounded-xl font-bold">
                    {regError}
                  </div>
                )}

                <form onSubmit={handleManualMemberRegistration} className="space-y-3">
                  {/* Row 1: Name, Phone, PIN */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">সদস্যের নাম (বাংলায়/ইংরেজিতে)</label>
                      <input
                        type="text"
                        required
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        placeholder="যেমন: মোঃ রাজিব আহমেদ"
                        className="w-full bg-white border border-slate-250 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-850 outline-none focus:border-[#00a884]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">মোবাইল নাম্বার (11 ডিজিট)</label>
                      <input
                        type="tel"
                        required
                        maxLength={11}
                        value={newMemberPhone}
                        onChange={(e) => setNewMemberPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder="017XXXXXXXX"
                        className="w-full bg-white border border-slate-250 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-850 outline-none focus:border-[#00a884]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">4 ডিজিটের সিকিউরিটি পিন</label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        value={newMemberPin}
                        onChange={(e) => setNewMemberPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="XXXX"
                        className="w-full bg-white border border-slate-250 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-850 text-center tracking-widest outline-none focus:border-[#00a884]"
                      />
                    </div>
                  </div>

                  {/* Row 2: Member ID Normalization & Groups */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">সদস্য আইডি (BNB ফরম্যাট)</label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          required
                          value={newMemberId}
                          onChange={(e) => setNewMemberId(e.target.value.toUpperCase())}
                          placeholder="BNB00000001"
                          className="flex-1 bg-white border border-slate-250 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-slate-850 outline-none focus:border-[#00a884]"
                        />
                        <button
                          type="button"
                          onClick={autoGenerateMemberId}
                          className="px-2.5 bg-teal-50 hover:bg-teal-100 text-[#00a884] border border-teal-200 text-[11px] font-black rounded-xl transition cursor-pointer"
                        >
                          অটো
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">অ্যাকাউন্ট ক্যাটাগরি রোল</label>
                      <select
                        value={newRole}
                        onChange={(e: any) => setNewRole(e.target.value)}
                        className="w-full bg-white border border-slate-250 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-850 outline-none focus:border-[#00a884]"
                      >
                        <option value="user">USER (কো-অপারেটিভ সাধারণ সদস্য)</option>
                        <option value="admin">ADMIN (মাস্টার ডিরেক্টর/পরিচালক)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">সদস্য গ্রুপ ক্যাটাগরি</label>
                      <select
                        value={newMemberGroup}
                        onChange={(e: any) => setNewMemberGroup(e.target.value)}
                        className="w-full bg-white border border-slate-250 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-850 outline-none focus:border-[#00a884]"
                      >
                        <option value="general">সাধারণ সদস্য (5,000 টাকা লোন ক্যাটাগরি)</option>
                        <option value="admin">ভিআইপি গ্রুপ (বিশেষ ক্যাটাগরি লোন)</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 3: Initial Balances */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 border-t border-slate-200">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">মেইন ওয়ালেট (৳)</label>
                      <input
                        type="number"
                        value={newMainsBal}
                        onChange={(e) => setNewMainsBal(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">টেলিকম ব্যালেন্স (৳)</label>
                      <input
                        type="number"
                        value={newTelBal}
                        onChange={(e) => setNewTelBal(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">সুপার শপ ব্যালেন্স (৳)</label>
                      <input
                        type="number"
                        value={newShopBal}
                        onChange={(e) => setNewShopBal(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">শেয়ার সঞ্চয়/DPS (৳)</label>
                      <input
                        type="number"
                        value={newSavings}
                        onChange={(e) => setNewSavings(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">বকেয়া ঋণ স্থিতি (৳)</label>
                      <input
                        type="number"
                        value={newDueLoan}
                        onChange={(e) => setNewDueLoan(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 text-red-700"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddMemberForm(false);
                        setRegSuccess('');
                        setRegError('');
                      }}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black rounded-lg transition cursor-pointer"
                    >
                      বাতিল
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-[#00a884] hover:bg-[#009675] text-white text-xs font-black rounded-lg shadow-xs transition cursor-pointer"
                    >
                      নিশ্চিত মেম্বারশিপ এড করুন
                    </button>
                  </div>
                </form>
              </div>
            )}
            {/* Filter and Search Section for Directory */}
            {(() => {
              const isSamityMemberUser = (u: any) => Boolean(
                u.samityApproved === true ||
                u.samityStatus === 'approved' ||
                u.isSamityMember === true
              );

              const samityRegisteredCount = users.filter(isSamityMemberUser).length;
              const generalAppCount = users.filter(u => !isSamityMemberUser(u) && u.samityStatus !== 'pending' && u.approved !== false).length;
              const samityPendingCount = users.filter(u => u.samityStatus === 'pending' || u.approved === false).length;

              return (
                <div className="bg-white border border-slate-150 rounded-3xl p-4.5 space-y-4 pb-96 sm:pb-[480px]">

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
                    <div className="w-full sm:flex-1 relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={generalMemberSearch}
                        onChange={(e) => setGeneralMemberSearch(e.target.value)}
                        onFocus={(e) => {
                          setTimeout(() => {
                            e.target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 250);
                        }}
                        placeholder="সদস্যের নাম, মোবাইল নাম্বার অথবা মেম্বার আইডি (যেমন: BNB00000030) দিয়ে খুঁজুন..."
                        className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 focus:border-[#00a884] focus:bg-white rounded-xl text-xs font-bold text-slate-800 outline-none transition shadow-2xs"
                      />
                      {generalMemberSearch && (
                        <button
                          type="button"
                          onClick={() => setGeneralMemberSearch('')}
                          className="absolute right-2.5 top-2 p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                          title="সার্চ মুছুন"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                      <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">সাজান:</span>
                      <select
                        value={memberSortOrder}
                        onChange={(e: any) => setMemberSortOrder(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-[#00a884] cursor-pointer"
                      >
                        <option value="id_asc">🔢 সিরিয়াল নম্বর (1 ➔ N)</option>
                        <option value="id_desc">🔢 উল্টো সিরিয়াল (N ➔ 1)</option>
                        <option value="newest">🕒 নতুন নিবন্ধন প্রথম</option>
                        <option value="balance_desc">💰 মোট ব্যালেন্স অনুযায়ী</option>
                      </select>
                    </div>
                  </div>

                  {/* Members Grid/List */}
                  <div className="space-y-2">
                    {(() => {
                      const isSubAdminUser = (u: any) => Boolean(
                        u.role === 'sub_admin' ||
                        u.role === 'admin' ||
                        (Array.isArray(u.subAdminPermissions) && u.subAdminPermissions.length > 0) ||
                        u.isSubAdmin === true
                      );

                      const isOwnerUser = (u: any) => Boolean(
                        u.memberCategory === 'owner' ||
                        Number(u.monthlySavingsTarget) === 5000 ||
                        u.memberGroup === 'owner'
                      );

                      const isShareholderUser = (u: any) => Boolean(
                        (u.memberCategory === 'shareholder' || Number(u.monthlySavingsTarget) === 3000 || u.memberGroup === 'shareholder') &&
                        !isOwnerUser(u)
                      );

                      const isInvestorUser = (u: any) => Boolean(
                        (u.memberCategory === 'investor' || Number(u.monthlySavingsTarget) === 2000 || u.memberGroup === 'investor' || u.isInvestor === true || (Array.isArray(u.investments) && u.investments.length > 0)) &&
                        !isOwnerUser(u) &&
                        !isShareholderUser(u)
                      );

                      const isSupporterUser = (u: any) => Boolean(
                        (u.memberCategory === 'supporter' || Number(u.monthlySavingsTarget) === 1000 || u.memberGroup === 'supporter') &&
                        !isOwnerUser(u) &&
                        !isShareholderUser(u) &&
                        !isInvestorUser(u)
                      );

                      const isGeneralUser = (u: any) => Boolean(
                        !isOwnerUser(u) &&
                        !isShareholderUser(u) &&
                        !isInvestorUser(u) &&
                        !isSupporterUser(u) &&
                        u.role !== 'admin' &&
                        u.role !== 'sub_admin'
                      );

                      const isSamityMemberUser = (u: any) => Boolean(
                        u.samityApproved === true ||
                        u.samityStatus === 'approved' ||
                        u.isSamityMember === true ||
                        (Number(u.savings) > 0) ||
                        isOwnerUser(u) ||
                        isShareholderUser(u) ||
                        isInvestorUser(u) ||
                        isSupporterUser(u)
                      );

                      const isSwitchOffUser = (u: any) => Boolean(
                        u.samityAutoSavingsActive === false ||
                        u.samityDeactivateStatus === 'self_opted_out' ||
                        u.samitySwitchStatus === 'OFF'
                      );

                      const isSwitchOnUser = (u: any) => Boolean(
                        (u.samityAutoSavingsActive === true || u.samitySwitchStatus === 'ON' || u.samityDeactivateStatus === 'active') &&
                        isSamityMemberUser(u) &&
                        !isSwitchOffUser(u)
                      );

                      const currentMonthNumber = new Date().getMonth() + 1;

                      const getPaidMonthsCountForUser = (u: any) => {
                        if (Array.isArray(u.samityPaidMonths) && u.samityPaidMonths.length > 0) {
                          return getUniquePaidMonthsCount(u.samityPaidMonths, u.savings, u.monthlySavingsTarget);
                        }
                        const monthlyRate = Number(u.monthlySavingsTarget) || (isOwnerUser(u) ? 5000 : isShareholderUser(u) ? 3000 : isInvestorUser(u) ? 2000 : isSupporterUser(u) ? 1000 : 1000);
                        const savings = Number(u.savings) || Number(u.dpsBalance) || 0;
                        return Math.floor(savings / monthlyRate);
                      };

                      const isPaidCurrentMonthUser = (u: any) => {
                        if (!isSamityMemberUser(u)) return false;
                        if (isSwitchOffUser(u)) return false;
                        const paidCount = getPaidMonthsCountForUser(u);
                        return paidCount >= currentMonthNumber;
                      };

                      const isDueCurrentMonthUser = (u: any) => {
                        if (!isSamityMemberUser(u)) return false;
                        if (isSwitchOffUser(u)) return false;
                        const paidCount = getPaidMonthsCountForUser(u);
                        return paidCount < currentMonthNumber;
                      };

                      const isResetRequestedUser = (u: any) => Boolean(
                        u.appLockResetRequested === true ||
                        u.appLockResetStatus === 'pending' ||
                        u.forgotPinRequested === true ||
                        u.pinResetRequested === true ||
                        (u.isAppLocked && (u.appLockResetStatus === 'pending' || u.appLockResetRequested === true))
                      );

                      const totalSwitchOffRefundAmount = users
                        .filter(isSwitchOffUser)
                        .reduce((sum, u) => sum + (Number(u.savings) || 0) + (Number(u.samityBalance) || 0), 0);

                      const filtered = users
                        .filter((u) => {
                          const isSubAdmin = isSubAdminUser(u);
                          const isOwner = isOwnerUser(u);
                          const isShareholder = isShareholderUser(u);
                          const isInvestor = isInvestorUser(u);
                          const isSupporter = isSupporterUser(u);
                          const isGeneral = isGeneralUser(u);
                          const isSamity = isSamityMemberUser(u);
                          const isSwOff = isSwitchOffUser(u);
                          const isSwOn = isSwitchOnUser(u);
                          const isPaidCur = isPaidCurrentMonthUser(u);
                          const isDueCur = isDueCurrentMonthUser(u);
                          const isResetReq = isResetRequestedUser(u);

                          if (generalMemberFilterTab === 'reset_requests' && !isResetReq) return false;
                          if (generalMemberFilterTab === 'switch_off' && !isSwOff) return false;
                          if (generalMemberFilterTab === 'switch_on' && !isSwOn) return false;
                          if (generalMemberFilterTab === 'sub_admin' && !isSubAdmin) return false;
                          if (generalMemberFilterTab === 'owner' && !isOwner) return false;
                          if (generalMemberFilterTab === 'shareholder' && !isShareholder) return false;
                          if (generalMemberFilterTab === 'investor' && !isInvestor) return false;
                          if (generalMemberFilterTab === 'supporter' && !isSupporter) return false;
                          if (generalMemberFilterTab === 'general' && !isGeneral) return false;
                          if (generalMemberFilterTab === 'samity' && !isSamity) return false;
                          if (generalMemberFilterTab === 'paid_current_month' && !isPaidCur) return false;
                          if (generalMemberFilterTab === 'due_current_month' && !isDueCur) return false;

                          if (!generalMemberSearch.trim()) return true;
                          const q = generalMemberSearch.toLowerCase();
                          return (
                            (u.name || '').toLowerCase().includes(q) ||
                            (u.phone || '').includes(q) ||
                            (u.memberId || '').toLowerCase().includes(q)
                          );
                        })
                        .sort((a, b) => {
                          if (memberSortOrder === 'id_asc') {
                            const numA = parseInt((a.memberId || '').replace(/\D/g, ''), 10) || 0;
                            const numB = parseInt((b.memberId || '').replace(/\D/g, ''), 10) || 0;
                            return numA - numB;
                          } else if (memberSortOrder === 'id_desc') {
                            const numA = parseInt((a.memberId || '').replace(/\D/g, ''), 10) || 0;
                            const numB = parseInt((b.memberId || '').replace(/\D/g, ''), 10) || 0;
                            return numB - numA;
                          } else if (memberSortOrder === 'newest') {
                            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                            return timeB - timeA;
                          } else {
                            const valA = (Number(a.balance) || 0) + (Number(a.savings) || 0) + (Number(a.telecomBalance) || 0) + (Number(a.superShopBalance) || 0);
                            const valB = (Number(b.balance) || 0) + (Number(b.savings) || 0) + (Number(b.telecomBalance) || 0) + (Number(b.superShopBalance) || 0);
                            return valB - valA;
                          }
                        });

                      if (filtered.length === 0) {
                        return (
                          <div className="text-center py-10 text-slate-400">
                            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            <p className="text-xs font-black">নির্ধারিত ক্যাটাগরিতে কোনো সদস্য পাওয়া যায়নি!</p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-3">
                          {/* 📢 Contextual Banner for Switch OFF (25 Dec Refund) */}
                          {generalMemberFilterTab === 'switch_off' && (
                            <div className="bg-gradient-to-r from-rose-950/90 via-slate-900 to-amber-950/90 border border-amber-500/40 rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-white shadow-lg">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="text-amber-400 text-xl shrink-0">🛡️</span>
                                <div>
                                  <h4 className="font-black text-amber-300 text-xs sm:text-sm">
                                    ২৫শে ডিসেম্বর রিফান্ড ফান্ড পলিসি ও সুইচ অফ সদস্য তালিকা
                                  </h4>
                                  <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
                                    সুইচ অফ সদস্যদের জমাকৃত মোট <strong className="text-amber-300">৳{totalSwitchOffRefundAmount.toLocaleString('bn-BD')}</strong> টাকা আগামী <strong>২৫শে ডিসেম্বর</strong> কোনো প্রকার ফি ছাড়াই স্ব-স্ব মেইন ওয়ালেটে স্বয়ংক্রিয়ভাবে রিফান্ড প্রদান করা হবে।
                                  </p>
                                </div>
                              </div>
                              <div className="bg-slate-950/90 border border-amber-500/40 px-3 py-1.5 rounded-xl shrink-0 flex items-center gap-2">
                                <span className="text-[10px] text-amber-400 font-bold uppercase">মোট রিফান্ড তহবিলঃ</span>
                                <span className="text-sm font-black text-amber-300 font-mono">৳{totalSwitchOffRefundAmount.toLocaleString('bn-BD')}</span>
                              </div>
                            </div>
                          )}

                          {/* 📢 Contextual Banner for Password/PIN Reset Requests */}
                          {generalMemberFilterTab === 'reset_requests' && (
                            <div className="bg-gradient-to-r from-rose-950/90 via-slate-900 to-rose-950/90 border border-rose-500/50 rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-white shadow-lg">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="text-rose-400 text-xl shrink-0">🔒</span>
                                <div>
                                  <h4 className="font-black text-rose-300 text-xs sm:text-sm">
                                    পাসওয়ার্ড / পিন ও অ্যাপ লক রিসেট রিকোয়েস্ট তালিকা
                                  </h4>
                                  <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
                                    যেসব সদস্য পাসওয়ার্ড বা পিন ভুলে গিয়ে অ্যাপ লক আনলকের রিকোয়েস্ট পাঠিয়েছেন তাদের তালিকা নিচে প্রদর্শিত হচ্ছে।
                                  </p>
                                </div>
                              </div>
                              <div className="bg-slate-950/90 border border-rose-500/50 px-3 py-1.5 rounded-xl shrink-0 flex items-center gap-2">
                                <span className="text-[10px] text-rose-300 font-bold uppercase">অপেক্ষমান রিকোয়েস্টঃ</span>
                                <span className="text-sm font-black text-rose-200 font-mono">{filtered.length} জন</span>
                              </div>
                            </div>
                          )}

                          {/* 📢 Contextual Banner for Due Current Month */}
                          {generalMemberFilterTab === 'due_current_month' && (
                            <div className="bg-gradient-to-r from-amber-950/90 via-slate-900 to-red-950/90 border border-amber-500/50 rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-white shadow-lg">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="text-amber-400 text-xl shrink-0">⚠️</span>
                                <div>
                                  <h4 className="font-black text-amber-300 text-xs sm:text-sm">
                                    রানি মাস সঞ্চয় কিস্তি অপরিশোধিত / বকেয়া সদস্য তালিকা
                                  </h4>
                                  <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
                                    যেসব সমবায় সদস্য চলমান মাসের নির্ধারিত সঞ্চয় কিস্তি এখনো জমা প্রদান করেননি তাদের তালিকা নিচে দেখানো হচ্ছে।
                                  </p>
                                </div>
                              </div>
                              <div className="bg-slate-950/90 border border-amber-500/50 px-3 py-1.5 rounded-xl shrink-0 flex items-center gap-2">
                                <span className="text-[10px] text-amber-300 font-bold uppercase">মোট বকেয়া সদস্যঃ</span>
                                <span className="text-sm font-black text-amber-200 font-mono">{filtered.length} জন</span>
                              </div>
                            </div>
                          )}

                          {/* 📢 Contextual Banner for Paid Current Month */}
                          {generalMemberFilterTab === 'paid_current_month' && (
                            <div className="bg-gradient-to-r from-emerald-950/90 via-slate-900 to-teal-950/90 border border-emerald-500/50 rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-white shadow-lg">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="text-emerald-400 text-xl shrink-0">🟢</span>
                                <div>
                                  <h4 className="font-black text-emerald-300 text-xs sm:text-sm">
                                    রানি মাস সঞ্চয় কিস্তি পরিশোধিত সদস্য তালিকা
                                  </h4>
                                  <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
                                    চলমান মাস পর্যন্ত সফলভাবে সঞ্চয় কিস্তি জমা সম্পন্ন করা সকল সম্মানিত সদস্যের তালিকা।
                                  </p>
                                </div>
                              </div>
                              <div className="bg-slate-950/90 border border-emerald-500/50 px-3 py-1.5 rounded-xl shrink-0 flex items-center gap-2">
                                <span className="text-[10px] text-emerald-300 font-bold uppercase">পরিশোধিত সদস্যঃ</span>
                                <span className="text-sm font-black text-emerald-200 font-mono">{filtered.length} জন</span>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
                          {filtered.map((u, idx) => {
                            const isAgentUser = Boolean(u.role === 'agent' || (u as any).isAgent || (u as any).agentApproved || adminAgentRequests.some(r => r.phone === u.phone && r.status === 'approved'));
                            const isSamityUser = isSamityMemberUser(u);
                            const isPendingUser = u.samityStatus === 'pending' || u.approved === false;

                            let cardTheme = 'bg-sky-50/60 hover:bg-sky-50/90 border-sky-200 hover:border-sky-400 border-l-4 border-l-sky-600 shadow-2xs';
                            let idBadgeTheme = 'bg-sky-700 text-white';
                            let avatarTheme = 'bg-sky-100 text-sky-900 border-sky-300';

                            if (isAgentUser) {
                              cardTheme = 'bg-amber-50/60 hover:bg-amber-50/90 border-amber-200 hover:border-amber-400 border-l-4 border-l-amber-600 shadow-2xs';
                              idBadgeTheme = 'bg-amber-700 text-white';
                              avatarTheme = 'bg-amber-100 text-amber-900 border-amber-300';
                            } else if (isSamityUser) {
                              cardTheme = 'bg-emerald-50/60 hover:bg-emerald-50/90 border-emerald-200 hover:border-emerald-400 border-l-4 border-l-emerald-600 shadow-2xs';
                              idBadgeTheme = 'bg-emerald-700 text-white';
                              avatarTheme = 'bg-emerald-100 text-emerald-900 border-emerald-300';
                            } else if (isPendingUser) {
                              cardTheme = 'bg-orange-50/60 hover:bg-orange-50/90 border-orange-200 hover:border-orange-400 border-l-4 border-l-orange-500 shadow-2xs';
                              idBadgeTheme = 'bg-orange-700 text-white';
                              avatarTheme = 'bg-orange-100 text-orange-900 border-orange-300';
                            }

                            return (
                              <div 
                                key={`${u.uid}-${idx}`} 
                                className={`rounded-2xl p-2.5 sm:p-3 transition-all duration-150 flex flex-col justify-between gap-2 ${cardTheme}`}
                              >
                                {/* Top Header Info */}
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    {/* Avatar */}
                                    <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center font-black text-xs shrink-0 overflow-hidden ${avatarTheme}`}>
                                      {u.profilePic ? (
                                        <img src={u.profilePic} alt={u.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                      ) : (
                                        (u.name || 'M').charAt(0).toUpperCase()
                                      )}
                                    </div>
                                    <div className="min-w-0 text-left">
                                      <h4 className="font-black text-xs sm:text-sm text-slate-900 leading-tight truncate">{u.name || u.phone || u.memberId || 'সম্মানিত সদস্য'}</h4>
                                      <span className="text-[10px] text-slate-600 font-extrabold font-mono block tracking-tight mt-0.5">{u.phone}</span>
                                      
                                      {/* Membership Type & GPS Badges */}
                                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                        {isAgentUser ? (
                                          <span className="text-[8.5px] font-black bg-amber-600 text-white border border-amber-700 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5 shadow-2xs">
                                            ⭐ এজেন্ট / প্রতিনিধি
                                          </span>
                                        ) : isSamityUser ? (
                                          <span className="text-[8.5px] font-black bg-emerald-600 text-white border border-emerald-700 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5 shadow-2xs">
                                            🏢 সমবায় সমিতি সদস্য
                                          </span>
                                        ) : isPendingUser ? (
                                          <span className="text-[8.5px] font-black bg-orange-600 text-white border border-orange-700 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5 shadow-2xs">
                                            ⏳ সমিতি আবেদন পেন্ডিং
                                          </span>
                                        ) : (
                                          <span className="text-[8.5px] font-black bg-sky-600 text-white border border-sky-700 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5 shadow-2xs">
                                            📱 নরমাল সদস্য
                                          </span>
                                        )}

                                        {/* 🔴🟡⚪ সদস্য ক্যাটাগরি ব্যাজ */}
                                        {u.memberCategory === 'owner' ? (
                                          <span className="text-[8.5px] font-black bg-rose-600 text-white border border-rose-700 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5 shadow-2xs">
                                            🔴 ওনার (৳৫,০০০/মাস)
                                          </span>
                                        ) : u.memberCategory === 'shareholder' ? (
                                          <span className="text-[8.5px] font-black bg-blue-600 text-white border border-blue-700 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5 shadow-2xs">
                                            🔵 শেয়ার হোল্ডার (৳৩,০০০/মাস)
                                          </span>
                                        ) : u.memberCategory === 'investor' ? (
                                          <span className="text-[8.5px] font-black bg-emerald-600 text-white border border-emerald-700 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5 shadow-2xs">
                                            🟢 ইনভেস্টার (৳২,০০০/মাস)
                                          </span>
                                        ) : u.memberCategory === 'supporter' ? (
                                          <span className="text-[8.5px] font-black bg-amber-500 text-slate-950 border border-amber-600 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5 shadow-2xs">
                                            🟡 সাপোর্টার (৳১,০০০/মাস)
                                          </span>
                                        ) : null}

                                        {/* 🔘 সুইচ অবস্থা ও নমিনি ব্যাজ */}
                                        <span className={`text-[8px] font-black px-1.5 py-0.2 rounded border shadow-2xs ${
                                          (u.samityAutoSavingsActive === false || u.samitySwitchStatus === 'OFF' || u.samityDeactivateStatus === 'self_opted_out')
                                            ? 'bg-rose-950 text-rose-200 border-rose-500'
                                            : 'bg-emerald-950 text-emerald-200 border-emerald-600'
                                        }`}>
                                          {(u.samityAutoSavingsActive === false || u.samitySwitchStatus === 'OFF' || u.samityDeactivateStatus === 'self_opted_out')
                                            ? '🔴 সুইচ OFF'
                                            : '🟢 সুইচ ON'}
                                        </span>

                                        {(Array.isArray(u.nominees) ? u.nominees.length : (u.nomineeName ? 1 : 0)) > 0 && (
                                          <span className="text-[8px] font-bold bg-slate-100 text-slate-700 border border-slate-300 px-1.5 py-0.2 rounded shadow-2xs">
                                            👥 নমিনি {Array.isArray(u.nominees) ? u.nominees.length : 1} জন
                                          </span>
                                        )}

                                        {((u.latitude || (u as any).lat) && (u.longitude || (u as any).lng)) ? (() => {
                                          const latNum = Number(u.latitude || (u as any).lat);
                                          const lngNum = Number(u.longitude || (u as any).lng);
                                          const isOldDefaultDhaka = Math.abs(latNum - 23.8103) < 0.0001 && Math.abs(lngNum - 90.4125) < 0.0001;
                                          const locText = u.fullAddress || (u as any).lastLocation;

                                          return (
                                            <div className="flex flex-col gap-0.5">
                                              <span className={`text-[8.5px] font-mono font-black px-1.5 py-0.5 rounded inline-flex items-center gap-1 border shadow-2xs ${
                                                isOldDefaultDhaka 
                                                  ? 'bg-amber-50 text-amber-800 border-amber-300' 
                                                  : 'bg-emerald-50 text-emerald-850 border-emerald-300'
                                              }`}>
                                                <span>{isOldDefaultDhaka ? '📍' : '🟢'}</span> 
                                                <span className="font-extrabold">{latNum.toFixed(6)}, {lngNum.toFixed(6)}</span>
                                                <a
                                                  href={`https://www.google.com/maps/search/?api=1&query=${latNum},${lngNum}`}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-teal-700 hover:underline font-black ml-0.5"
                                                >
                                                  (গুগল ম্যাপে ↗)
                                                </a>
                                              </span>
                                              {locText && !isOldDefaultDhaka && (
                                                <span className="text-[8px] font-bold text-slate-600 truncate max-w-[200px]">
                                                  📍 {locText}
                                                </span>
                                              )}
                                            </div>
                                          );
                                        })() : null}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Status & ID Badges */}
                                  <div className="text-right flex flex-col items-end gap-1 shrink-0">
                                    {u.uid === 'admin_master' || u.phone === '+8801111222233' || u.memberId === 'MAIN_ADMIN' ? (
                                      <span className="text-[9px] font-black px-2 py-0.5 rounded-md inline-block uppercase leading-none font-mono shadow-2xs bg-purple-700 text-white">
                                        👑 মেইন এডমিন
                                      </span>
                                    ) : (
                                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-md inline-block uppercase leading-none font-mono shadow-2xs ${idBadgeTheme}`}>
                                        ID: {u.memberId || 'N/A'}
                                      </span>
                                    )}
                                    <span className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded ${
                                      u.status === 'active' 
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                                    } uppercase`}>
                                      {u.status === 'active' ? '🔴 সচল' : '⚪ নিষ্ক্রিয়'}
                                    </span>
                                  </div>
                                </div>

                                {/* Quick Wallet Balances Panel */}
                                <div className="bg-white/90 border border-slate-200/80 rounded-xl p-2 grid grid-cols-3 gap-1 text-center shadow-2xs">
                                  <div>
                                    <span className="text-[8.5px] font-bold text-slate-500 block uppercase leading-none">
                                      মেইন ওয়ালেট
                                    </span>
                                    <span className="text-xs font-black text-slate-900 block mt-0.5">৳{getUserMainWalletBalance(u).toLocaleString('bn-BD')}</span>
                                  </div>
                                  <div>
                                    <span className="text-[8.5px] font-bold text-slate-500 block uppercase leading-none">শেয়ার সঞ্চয়</span>
                                    <span className="text-xs font-black text-emerald-700 block mt-0.5">৳{(u.savings || 0).toLocaleString('bn-BD')}</span>
                                  </div>
                                  <div>
                                    <span className="text-[8.5px] font-bold text-slate-500 block uppercase leading-none">বকেয়া ঋণ</span>
                                    <span className={`text-xs font-black block mt-0.5 ${u.dueLoan > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                                      ৳{(u.dueLoan || 0).toLocaleString('bn-BD')}
                                    </span>
                                  </div>
                                </div>

                                {/* Secondary Balances */}
                                <div className="flex flex-wrap items-center gap-1 text-[9px] font-bold text-slate-600">
                                  <span className="bg-indigo-50 border border-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded">
                                    📱 টেলিকমঃ ৳{(u.telecomBalance || 0).toLocaleString('bn-BD')}
                                  </span>
                                  <span className="bg-amber-50 border border-amber-100 text-amber-900 px-1.5 py-0.2 rounded">
                                    🛒 শপ ওয়ালেটঃ ৳{(u.superShopBalance || 0).toLocaleString('bn-BD')}
                                  </span>
                                  <span className="bg-slate-100 border border-slate-200 text-slate-700 px-1.5 py-0.2 rounded uppercase">
                                    🛡️ {u.role === 'admin' ? 'মাস্টার এডমিন' : u.role === 'sub_admin' ? 'ছাপ এডমিন' : 'কো-অপারেティブ সদস্য'}
                                  </span>
                                </div>

                                 {/* Samity Switch Status & Admin Action Box */}
                                 {(u.samityAutoSavingsActive === false || u.samityDeactivateStatus === 'self_opted_out' || u.samitySwitchStatus === 'OFF') ? (
                                   <div className="bg-gradient-to-r from-rose-950 via-slate-950 to-amber-950 border-2 border-rose-500/80 rounded-xl p-2.5 text-left space-y-2 text-white shadow-md">
                                     <div className="flex items-center justify-between flex-wrap gap-1">
                                       <span className="text-[11px] font-black text-rose-300 flex items-center gap-1.5">
                                         <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                                         ⏸️ সঞ্চয় বন্ধ ও টাকা উত্তোলন আবেদন
                                       </span>
                                       <span className="text-[10px] font-mono font-black text-amber-300 bg-black/40 px-2 py-0.5 rounded border border-amber-500/40">
                                         জমানো মোট: ৳{(Number(u.savings !== undefined ? u.savings : (u as any).dpsBalance) || 0).toLocaleString('bn-BD')} টাকা
                                       </span>
                                     </div>
                                     {u.samityOptOutReason && (
                                       <div className="bg-black/30 p-1.5 rounded-lg border border-amber-500/20 text-[10px] text-amber-200 leading-tight">
                                         <strong className="text-amber-400">📝 আবেদনের কারণ:</strong> "{u.samityOptOutReason}"
                                       </div>
                                     )}

                                     {/* 🚀 Interactive Action Buttons for Admin */}
                                     <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-rose-900/60">
                                       {(Number(u.savings !== undefined ? u.savings : (u as any).dpsBalance) || 0) > 0 ? (
                                         <>
                                           {/* Button 1: Refund to Main Wallet */}
                                           <button
                                             type="button"
                                             disabled={processingRefundUid === u.uid}
                                             onClick={() => handleApproveSamityRefund(u)}
                                             className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10.5px] rounded-lg transition cursor-pointer shadow-xs flex items-center justify-center gap-1 disabled:opacity-50 active:scale-95"
                                             title="জমানো টাকা মেইন ওয়ালেটে রিফান্ড অনুমোদন করুন"
                                           >
                                             <span>✅ মেইন ব্যালেন্সে রিফান্ড অনুমোদন</span>
                                           </button>

                                           {/* Button 2: Cash Payout Settlement */}
                                           <button
                                             type="button"
                                             disabled={processingRefundUid === u.uid}
                                             onClick={() => handleApproveSamityCashPayout(u)}
                                             className="py-1.5 px-2 bg-amber-700 hover:bg-amber-600 text-amber-100 font-black text-[10.5px] rounded-lg transition cursor-pointer border border-amber-500/60 flex items-center justify-center gap-1 disabled:opacity-50 active:scale-95"
                                             title="সরাসরি ক্যাশ দিয়ে একাউন্ট সেটেল করুন"
                                           >
                                             <span>💵 ক্যাশ প্রদান ও সেটেল</span>
                                           </button>
                                         </>
                                       ) : (
                                         <div className="text-[10px] text-emerald-300 font-bold bg-emerald-950/60 px-2 py-1 rounded border border-emerald-700/60 flex items-center gap-1">
                                           <span>✓</span>
                                           <span>সঞ্চয় রিফান্ড / সেটেল সম্পন্ন হয়েছে (ব্যালেন্স ৳০)</span>
                                         </div>
                                       )}

                                       {/* Button 3: Reactivate Savings */}
                                       <button
                                         type="button"
                                         onClick={() => handleReactivateSamitySavings(u)}
                                         className="py-1.5 px-2 bg-sky-800 hover:bg-sky-700 text-white font-bold text-[10.5px] rounded-lg transition cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                                         title="পুনরায় অটো সঞ্চয় সচল করুন"
                                       >
                                         <span>🔄 পুনরায় চালু (ON)</span>
                                       </button>

                                       {/* Button 4: Reject request */}
                                       <button
                                         type="button"
                                         onClick={() => handleRejectSamityOptOut(u)}
                                         className="py-1.5 px-2 bg-rose-900 hover:bg-rose-800 text-rose-200 font-bold text-[10.5px] rounded-lg transition cursor-pointer border border-rose-700/60 active:scale-95"
                                         title="আবেদন বাতিল করুন"
                                       >
                                         <span>❌ বাতিল</span>
                                       </button>

                                       <a
                                         href={`tel:${u.phone}`}
                                         className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-[10.5px] rounded-lg transition cursor-pointer flex items-center gap-1"
                                       >
                                         <span>📞 কল</span>
                                       </a>
                                     </div>
                                   </div>
                                 ) : u.samityOptInReason ? (
                                   <div className="bg-teal-950/80 border border-teal-500/40 rounded-xl p-1.5 text-left text-teal-200 text-[9.5px]">
                                     <span className="font-bold text-teal-400">🔄 সচল কারণ:</span> "{u.samityOptInReason}"
                                   </div>
                                 ) : null}

                                {/* 🚨 পেন্ডিং পাসওয়ার্ড / পিন / অ্যাপ লক রিসেট বক্স */}
                                 {(u.appLockResetRequested || u.appLockResetStatus === 'pending' || u.forgotPinRequested || u.pinResetRequested) && (
                                   <div className="bg-gradient-to-r from-rose-950 to-slate-950 border-2 border-rose-500 rounded-xl p-2.5 text-white space-y-2 shadow-md">
                                     <div className="flex items-center justify-between">
                                       <span className="text-[10.5px] font-black text-rose-300 flex items-center gap-1.5">
                                         <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                                         🔒 পাসওয়ার্ড / পিন ভুলে গেছেন (লক রিকোয়েস্ট)
                                       </span>
                                       {u.appLockResetRequestedAt && (
                                         <span className="text-[8.5px] text-slate-400 font-mono">
                                           🕒 {new Date(u.appLockResetRequestedAt).toLocaleTimeString('bn-BD')}
                                         </span>
                                       )}
                                     </div>
                                     <p className="text-[10px] text-rose-200/90 leading-tight">
                                       সদস্য পাসওয়ার্ড/পিন মনে নেই বলে রিকোয়েস্ট পাঠিয়েছেন। অনুমোদন দিলে অ্যাপ তাৎক্ষণিক আনলক হবে এবং পিন <strong className="text-amber-300">১২৩৪</strong> এ রিসেট হবে।
                                     </p>
                                     <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-rose-900/60">
                                       <button
                                         type="button"
                                         onClick={() => handleApproveAppLockReset(u)}
                                         className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10.5px] rounded-lg transition cursor-pointer shadow-xs flex items-center justify-center gap-1"
                                       >
                                         <span>✓ অনুমোদন ও আনলক (পিন ১২৩৪)</span>
                                       </button>
                                       <button
                                         type="button"
                                         onClick={() => handleRejectAppLockReset(u)}
                                         className="px-2 py-1.5 bg-rose-900 hover:bg-rose-800 text-rose-200 font-bold text-[10.5px] rounded-lg transition cursor-pointer border border-rose-700/60"
                                       >
                                         ❌ বাতিল
                                       </button>
                                       <a
                                         href={`tel:${u.phone}`}
                                         className="px-2.5 py-1.5 bg-sky-800 hover:bg-sky-700 text-white font-bold text-[10.5px] rounded-lg transition cursor-pointer flex items-center gap-1"
                                       >
                                         <span>📞 কল</span>
                                       </a>
                                     </div>
                                   </div>
                                 )}

                                 {/* 🔐 সদস্য সিকিউরিটি ও লাস্ট গোপন অ্যাপ লক পাসওয়ার্ড বার */}
                                <div className="bg-slate-900 text-white border border-slate-800 rounded-xl p-2 space-y-1.5 shadow-2xs text-left">
                                  <div className="flex items-center justify-between gap-1 text-[10px]">
                                    <div className="flex items-center gap-1.5 font-mono">
                                      <span className="text-amber-400 font-bold">🔑 পিন:</span>
                                      <span className="font-black bg-slate-800 px-1.5 py-0.5 rounded text-amber-300 border border-slate-700 tracking-wider">
                                        {u.pin || '1234'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                        u.isAppLocked 
                                          ? 'bg-rose-900/90 text-rose-200 border border-rose-600 animate-pulse' 
                                          : 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                                      }`}>
                                        {u.isAppLocked ? '🔒 লক সক্রিয়' : '🔓 আনলক'}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between gap-1 text-[10px] pt-1 border-t border-slate-800/80">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="text-cyan-300 font-bold shrink-0">🔒 লাস্ট লক পাসওয়ার্ড:</span>
                                      {u.appLockCode ? (
                                        <span className="font-mono font-black text-cyan-200 bg-cyan-950/90 px-1.5 py-0.5 rounded border border-cyan-700/60 truncate">
                                          {showAppLockCodeMap[u.uid || u.id || (u as any).docId] ? u.appLockCode : '••••••'}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 italic text-[9px]">সেট করা নেই</span>
                                      )}
                                    </div>

                                    {u.appLockCode ? (
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const uidKey = u.uid || u.id || (u as any).docId;
                                            setShowAppLockCodeMap(prev => ({ ...prev, [uidKey]: !prev[uidKey] }));
                                          }}
                                          className="p-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition cursor-pointer text-[9px]"
                                          title="পাসওয়ার্ড দেখুন/লুকান"
                                        >
                                          {showAppLockCodeMap[u.uid || u.id || (u as any).docId] ? '🙈' : '👁️'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (u.appLockCode) {
                                              navigator.clipboard?.writeText(u.appLockCode);
                                              const uidKey = u.uid || u.id || (u as any).docId;
                                              setCopiedAppLockUid(uidKey);
                                              setTimeout(() => setCopiedAppLockUid(null), 2000);
                                            }
                                          }}
                                          className="px-1.5 py-0.5 bg-cyan-800 hover:bg-cyan-700 text-cyan-100 font-bold rounded text-[9px] transition cursor-pointer flex items-center gap-0.5"
                                          title="পাসওয়ার্ড কপি করুন"
                                        >
                                          {copiedAppLockUid === (u.uid || u.id || (u as any).docId) ? '✓ কপিড' : '📋 কপি'}
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>

                                  {u.isAppLocked && (
                                    <div className="pt-1 flex items-center justify-between gap-1 border-t border-slate-800/80">
                                      <span className="text-[9px] text-amber-300/90 font-medium">গ্রাহক লক খুলতে না পারলে:</span>
                                      <button
                                        type="button"
                                        onClick={() => handleAdminInstantUnlockUser(u)}
                                        className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[9px] rounded-md transition cursor-pointer shadow-2xs"
                                      >
                                        🔓 সরাসরি আনলক করুন
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Actions Bar */}
                                <div className="flex gap-1.5 pt-1.5 border-t border-slate-200/80">
                                  <button
                                    type="button"
                                    onClick={() => openUserEditModal(u)}
                                    className="flex-1 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-[11px] rounded-lg transition cursor-pointer text-center flex items-center justify-center gap-1 active:scale-98 shadow-2xs"
                                  >
                                    ✏️ তথ্য ও ব্যালেন্স সংশোধন
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUser(u)}
                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-lg transition cursor-pointer active:scale-95"
                                    title="মেম্বার অ্যাকাউন্ট ডিলিট করুন"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })()}
                  </div>
                )}
          </div>
        )}
      </div>
    )}

    {/* 🔍 সমবায় সমিতি আবেদনপত্র বিস্তারিত রিভিউ ও ক্যাটাগরি পরিবর্তন মডাল */}
    {selectedAppForReview && (
      <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in text-slate-800">
        <div className="bg-white rounded-3xl max-w-xl w-full border-2 border-amber-300 shadow-2xl overflow-hidden my-8 space-y-0">
          
          {/* Modal Header */}
          <div className="bg-gradient-to-r from-amber-700 via-orange-700 to-amber-900 p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔍</span>
              <div>
                <h3 className="text-sm font-black text-amber-100">আবেদনপত্র রিভিউ ও ক্যাটাগরি পরিবর্তন</h3>
                <p className="text-[11px] text-amber-200/80">সদস্যের এনআইডি ও তথ্য যাচাই করে ক্যাটাগরি ও আইডি নির্বাচন করুন</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedAppForReview(null)}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center font-bold text-base transition cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-5 space-y-4 max-h-[75vh] overflow-y-auto">
            
            {/* Applicant Summary Header */}
            <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-base font-black text-slate-900">{selectedAppForReview.name || 'নামবিহীন সদস্য'}</h4>
                <span className="text-xs font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-xl">
                  📱 {selectedAppForReview.phone}
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium">
                📅 আবেদন সময়: {selectedAppForReview.samityAppliedAt ? new Date(selectedAppForReview.samityAppliedAt).toLocaleString('bn-BD') : 'তারিখ অনুপলব্ধ'}
              </p>
            </div>

            {/* Application Data Grid */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs">
              <h5 className="font-bold text-slate-800 border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                <span>📄</span>
                <span>প্রদত্ত ব্যক্তিগত ও এনআইডি তথ্য:</span>
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                <p><strong className="text-slate-900">পিতার নাম:</strong> {selectedAppForReview.fatherName || 'প্রদান করা হয়নি'}</p>
                <p><strong className="text-slate-900">মাতার নাম:</strong> {selectedAppForReview.motherName || 'প্রদান করা হয়নি'}</p>
                <p><strong className="text-slate-900">NID / Passport:</strong> <span className="font-mono font-bold text-slate-900">{selectedAppForReview.nid || 'প্রদান করা হয়নি'}</span></p>
                <p><strong className="text-slate-900">জন্ম তারিখ:</strong> {selectedAppForReview.dob || 'প্রদান করা হয়নি'}</p>
                <p><strong className="text-slate-900">ঠিকানা:</strong> {[selectedAppForReview.postOffice, selectedAppForReview.thana, selectedAppForReview.district, selectedAppForReview.division].filter(Boolean).join(', ') || 'প্রদান করা হয়নি'}</p>
                <p><strong className="text-slate-900">দেশ:</strong> {selectedAppForReview.country || 'Bangladesh'}</p>
                <p><strong className="text-slate-900">নমিনির নাম:</strong> {selectedAppForReview.nomineeName || 'প্রদান করা হয়নি'} ({selectedAppForReview.nomineeRelation || '-'})</p>
                <p><strong className="text-slate-900">নমিনির ফোন:</strong> <span className="font-mono">{selectedAppForReview.nomineePhone || '-'}</span></p>
              </div>
            </div>

            {/* Category & ID Selection Controls */}
            <div className="space-y-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-3.5 text-left">
              <h5 className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                <span>⚙️</span>
                <span>এডমিন অনুমোদনের ক্যাটাগরি ও মেম্বার আইডি নির্ধারণ:</span>
              </h5>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">সদস্যের ক্যাটাগরি (Member Role Category):</label>
                <select
                  value={selectedRoleForApp}
                  onChange={(e) => setSelectedRoleForApp(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-white border-2 border-emerald-300 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="owner">👑 অনার (Owner - ৳৫,০০০/মাস)</option>
                  <option value="shareholder">📈 শেয়ার হোল্ডার (Shareholder - ৳৩,০০০/মাস)</option>
                  <option value="investor">💼 ইনভেস্টার (Investor - ৳২,০০০/মাস)</option>
                  <option value="supporter">🟡 সাপোর্টার (Supporter - ৳১,০০০/মাস)</option>
                  <option value="general">👥 সাধারণ সমবায় সদস্য (General Member)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">বরাদ্দকৃত মেম্বার আইডি (Member Serial ID):</label>
                <input
                  type="text"
                  value={assignMemberIdForApp}
                  onChange={(e) => setAssignMemberIdForApp(e.target.value)}
                  placeholder="যেমন: BNB-00000181"
                  className="w-full px-3 py-2 rounded-xl bg-white border-2 border-emerald-300 text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Rejection Reason Input Box */}
            <div className="space-y-1.5 bg-rose-50/90 border border-rose-200/90 rounded-2xl p-3 text-left">
              <label className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                <span>📝</span>
                <span>আবেদন বাতিলের কারণ (সদস্যের ওয়ালেটে টাকা রিফান্ড করা হবে):</span>
              </label>
              <input
                type="text"
                value={modalRejectReason}
                onChange={(e) => setModalRejectReason(e.target.value)}
                placeholder="বাতিলের কারণ লিখুন..."
                className="w-full px-3 py-2 rounded-xl bg-white border border-rose-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-rose-400 font-medium"
              />
            </div>

          </div>

          {/* Modal Footer Actions - Prominent Approval and Enlarged Cancel Buttons */}
          <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <button
              type="button"
              disabled={isReviewSubmitting}
              onClick={() => handleConfirmSamityApproval(selectedAppForReview, selectedRoleForApp, assignMemberIdForApp)}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              <span>✅</span>
              <span>অনুমোদন করুন</span>
            </button>
            <button
              type="button"
              disabled={isReviewSubmitting}
              onClick={() => handleRejectSamityAppWithReason(selectedAppForReview, modalRejectReason)}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              <span>❌</span>
              <span>আবেদন বাতিল ও রিফান্ড দিন</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedAppForReview(null)}
              className="px-4 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer shrink-0"
            >
              বন্ধ করুন
            </button>
          </div>

        </div>
      </div>
    )}
  </>
);
}
