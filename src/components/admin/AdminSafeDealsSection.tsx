import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  increment
} from 'firebase/firestore';
import { saveAppConfig, computeSafeDealsFee } from '../../lib/config';
import { convertBengaliToEnglishDigits } from '../../lib/memberUtils';
import {
  Plus,
  Save,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Truck,
  Search,
  Settings,
  ShieldCheck,
  AlertTriangle,
  Megaphone,
  Phone,
  RefreshCw,
  Sliders,
  Wallet
} from 'lucide-react';

export function AdminSafeDealsSection(props: any) {
  const {
    adminTab,
    setSdSubTab,
    sdSubTab,
    disputes: propDisputes = [],
    handleCreateSafeDeal,
    sdTitle,
    setSdTitle,
    sdSupplier,
    setSdSupplier,
    sdPrice,
    setSdPrice,
    sdMinQty,
    setSdMinQty,
    sdEmoji,
    setSdEmoji,
    loadingEscrow,
    sdDesc,
    setSdDesc,
    safeDeals = [],
    handleToggleSafeDealStatus,
    handleDeleteSafeDeal,
    handleUpdateDisputeStatus,
    updatingDisputeId,
    appConfig,
    onChangeConfig,
    sectionAuditEngine,
    requestAlert,
    setCfgEscrowTicker,
    handleFileChange,
    notices: propNotices = [],
    fetchNotices,
    currentUser
  } = props;

  // Live orders & disputes from real-time sectionAuditEngine (fallback to props)
  const liveOrders: any[] = sectionAuditEngine?.safeDealOrders || [];
  const liveDisputes: any[] =
    sectionAuditEngine?.escrowDisputes?.length > 0
      ? sectionAuditEngine.escrowDisputes
      : propDisputes;

  // Escrow Orders Filter & Action States
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'held' | 'shipped' | 'released' | 'refunded'>('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [confirmOrderAction, setConfirmOrderAction] = useState<{
    order: any;
    action: 'release' | 'refund';
  } | null>(null);
  const [orderFeedback, setOrderFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Fee & User Control Settings State (`appConfig.safeDealsConfig` + `serviceStatus.safedeals`)
  const existingCfg = appConfig?.safeDealsConfig || {
    enabled: true,
    feeMode: 'free',
    feePercent: 0,
    feeFixed: 0,
    feeBearer: 'buyer',
    minAmount: 100,
    maxAmount: 500000,
    supportWhatsapp: '01865911728',
    allowBuyerSend: true,
    allowSellerCancel: true,
    allowBuyerDispute: true,
    rulesSummary:
      'নিরাপদ লেনদেন এসক্রো সেবার মাধ্যমে ক্রেতা ও বিক্রেতার টাকা সুরক্ষিত থাকে। পণ্য হাতে পেয়ে ক্রেতা নিশ্চিত করলে বিক্রেতার ওয়ালেটে টাকা জমা হয়।'
  };

  const [sdServiceEnabled, setSdServiceEnabled] = useState<boolean>(
    appConfig?.serviceStatus?.safedeals !== false && existingCfg.enabled !== false
  );
  const [feeMode, setFeeMode] = useState<'free' | 'percent' | 'fixed' | 'both'>(
    existingCfg.feeMode || 'free'
  );
  const [feePercent, setFeePercent] = useState<string>(String(existingCfg.feePercent ?? 0));
  const [feeFixed, setFeeFixed] = useState<string>(String(existingCfg.feeFixed ?? 0));
  const [feeBearer, setFeeBearer] = useState<'buyer' | 'seller'>(
    existingCfg.feeBearer || 'buyer'
  );
  const [minAmount, setMinAmount] = useState<string>(String(existingCfg.minAmount ?? 100));
  const [maxAmount, setMaxAmount] = useState<string>(String(existingCfg.maxAmount ?? 500000));
  const [supportWhatsapp, setSupportWhatsapp] = useState<string>(
    existingCfg.supportWhatsapp || '01865911728'
  );
  const [allowBuyerSend, setAllowBuyerSend] = useState<boolean>(existingCfg.allowBuyerSend !== false);
  const [allowSellerCancel, setAllowSellerCancel] = useState<boolean>(existingCfg.allowSellerCancel !== false);
  const [allowBuyerDispute, setAllowBuyerDispute] = useState<boolean>(existingCfg.allowBuyerDispute !== false);
  const [rulesSummary, setRulesSummary] = useState<string>(existingCfg.rulesSummary || '');
  const [previewAmount, setPreviewAmount] = useState<string>('1000');
  const [savingControls, setSavingControls] = useState(false);
  const [controlsFeedback, setControlsFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Media / Ticker / Banners / Notices State
  const [localTicker, setLocalTicker] = useState<string>(appConfig?.escrowTicker || '');
  const [localBanners, setLocalBanners] = useState<any[]>(appConfig?.safeDealsBanners || []);
  const [newBannerImage, setNewBannerImage] = useState('');
  const [newBannerTitle, setNewBannerTitle] = useState('');
  const [newBannerDesc, setNewBannerDesc] = useState('');
  const [savingMedia, setSavingMedia] = useState(false);
  const [mediaFeedback, setMediaFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [dealNotices, setDealNotices] = useState<any[]>(() =>
    (propNotices || []).filter((n: any) => n.section === 'safe_deal')
  );
  const [newNoticeTitle, setNewNoticeTitle] = useState('');
  const [newNoticeContent, setNewNoticeContent] = useState('');
  const [savingNotice, setSavingNotice] = useState(false);

  // Dispute compensation/loss input
  const [disputeLossDraft, setDisputeLossDraft] = useState<Record<string, string>>({});
  const [savingDisputeLossId, setSavingDisputeLossId] = useState<string | null>(null);

  useEffect(() => {
    const cfg = appConfig?.safeDealsConfig;
    if (cfg) {
      setSdServiceEnabled(appConfig?.serviceStatus?.safedeals !== false && cfg.enabled !== false);
      setFeeMode(cfg.feeMode || 'free');
      setFeePercent(String(cfg.feePercent ?? 0));
      setFeeFixed(String(cfg.feeFixed ?? 0));
      setFeeBearer(cfg.feeBearer || 'buyer');
      setMinAmount(String(cfg.minAmount ?? 100));
      setMaxAmount(String(cfg.maxAmount ?? 500000));
      setSupportWhatsapp(cfg.supportWhatsapp || '01865911728');
      setAllowBuyerSend(cfg.allowBuyerSend !== false);
      setAllowSellerCancel(cfg.allowSellerCancel !== false);
      setAllowBuyerDispute(cfg.allowBuyerDispute !== false);
      setRulesSummary(cfg.rulesSummary || '');
    } else {
      setSdServiceEnabled(appConfig?.serviceStatus?.safedeals !== false);
    }
    setLocalTicker(appConfig?.escrowTicker || '');
    setLocalBanners(appConfig?.safeDealsBanners || []);
  }, [appConfig]);

  // Real-time listener for Safe Deals section notices (`notices` where section === 'safe_deal')
  useEffect(() => {
    if (adminTab !== 'safedeals_admin') return;
    const unsub = onSnapshot(
      collection(db, 'notices'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((n) => n.section === 'safe_deal')
          .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        setDealNotices(list);
      },
      () => {
        setDealNotices((propNotices || []).filter((n: any) => n.section === 'safe_deal'));
      }
    );
    return () => unsub();
  }, [adminTab]);

  if (adminTab !== 'safedeals_admin') return null;

  const showMsg = (title: string, message: string) => {
    if (requestAlert) {
      requestAlert(title, message);
    }
  };

  // Live Fee Preview Computation
  const previewFeeConfig = {
    enabled: sdServiceEnabled,
    feeMode,
    feePercent: Math.max(0, Number(convertBengaliToEnglishDigits(feePercent)) || 0),
    feeFixed: Math.max(0, Number(convertBengaliToEnglishDigits(feeFixed)) || 0),
    feeBearer,
    minAmount: Math.max(1, Number(convertBengaliToEnglishDigits(minAmount)) || 100),
    maxAmount: Math.max(100, Number(convertBengaliToEnglishDigits(maxAmount)) || 500000),
    supportWhatsapp: supportWhatsapp.trim() || '01865911728',
    allowBuyerSend,
    allowSellerCancel,
    allowBuyerDispute,
    rulesSummary: rulesSummary.trim()
  };
  const parsedPreviewAmt = Math.max(0, Number(convertBengaliToEnglishDigits(previewAmount)) || 0);
  const computedPreviewFee = computeSafeDealsFee(parsedPreviewAmt, previewFeeConfig);

  // Save Fee, Limits & User Dashboard Controls
  const handleSaveSafeDealsControls = async (e: React.FormEvent) => {
    e.preventDefault();
    setControlsFeedback(null);
    setSavingControls(true);
    try {
      const updatedConfig = {
        ...(appConfig || {}),
        serviceStatus: {
          ...(appConfig?.serviceStatus || {}),
          safedeals: sdServiceEnabled
        },
        safeDealsConfig: previewFeeConfig
      };
      await saveAppConfig(updatedConfig);
      if (onChangeConfig) onChangeConfig(updatedConfig);
      setControlsFeedback({
        type: 'ok',
        text: '✅ নিরাপদ লেনদেনের চার্জ, সীমা ও ইউজার কন্ট্রোল সফলভাবে সংরক্ষিত হয়েছে!'
      });
      setTimeout(() => setControlsFeedback(null), 4000);
    } catch (err: any) {
      const m = err?.message || 'সংরক্ষণ করতে সমস্যা হয়েছে।';
      setControlsFeedback({ type: 'err', text: m });
      showMsg('সেটিংস ত্রুটি', m);
    } finally {
      setSavingControls(false);
    }
  };

  // Save Header Ticker & Banners
  const handleSaveMediaControls = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setMediaFeedback(null);
    setSavingMedia(true);
    try {
      const updatedConfig = {
        ...(appConfig || {}),
        escrowTicker: localTicker.trim(),
        safeDealsBanners: localBanners
      };
      await saveAppConfig(updatedConfig);
      if (onChangeConfig) onChangeConfig(updatedConfig);
      if (setCfgEscrowTicker) setCfgEscrowTicker(localTicker.trim());
      setMediaFeedback({
        type: 'ok',
        text: '✅ ঘোষণা টিকার এবং ব্যানার স্লাইডার ইউজার ড্যাশবোর্ডে আপডেট হয়েছে!'
      });
      setTimeout(() => setMediaFeedback(null), 4000);
    } catch (err: any) {
      const m = err?.message || 'ব্যানার ও ঘোষণা সংরক্ষণ করা যায়নি।';
      setMediaFeedback({ type: 'err', text: m });
      showMsg('ব্যানার সংরক্ষণ ত্রুটি', m);
    } finally {
      setSavingMedia(false);
    }
  };

  const handleAddBannerSlide = async () => {
    if (!newBannerImage.trim()) {
      setMediaFeedback({ type: 'err', text: 'প্রথমে ব্যানারের ছবি আপলোড করুন অথবা ইমেজ লিংক দিন।' });
      return;
    }
    const nextSlides = [
      ...localBanners,
      {
        id: Date.now(),
        image: newBannerImage.trim(),
        title: newBannerTitle.trim() || 'নিরাপদ লেনদেন',
        description: newBannerDesc.trim() || 'সুরক্ষিত এসক্রো পেমেন্ট সেবা'
      }
    ];
    setLocalBanners(nextSlides);
    setNewBannerImage('');
    setNewBannerTitle('');
    setNewBannerDesc('');
    setSavingMedia(true);
    try {
      const updatedConfig = {
        ...(appConfig || {}),
        escrowTicker: localTicker.trim(),
        safeDealsBanners: nextSlides
      };
      await saveAppConfig(updatedConfig);
      if (onChangeConfig) onChangeConfig(updatedConfig);
      setMediaFeedback({ type: 'ok', text: '✅ নতুন ব্যানার স্লাইড যুক্ত ও সংরক্ষিত হয়েছে!' });
      setTimeout(() => setMediaFeedback(null), 3500);
    } catch (err: any) {
      setMediaFeedback({ type: 'err', text: err?.message || 'ব্যানার যোগ করা যায়নি।' });
    } finally {
      setSavingMedia(false);
    }
  };

  const handleDeleteBannerSlide = async (id: number) => {
    const nextSlides = localBanners.filter((b) => b.id !== id);
    setLocalBanners(nextSlides);
    setSavingMedia(true);
    try {
      const updatedConfig = {
        ...(appConfig || {}),
        safeDealsBanners: nextSlides
      };
      await saveAppConfig(updatedConfig);
      if (onChangeConfig) onChangeConfig(updatedConfig);
      setMediaFeedback({ type: 'ok', text: '🗑️ ব্যানার স্লাইড মুছে ফেলা হয়েছে।' });
      setTimeout(() => setMediaFeedback(null), 3000);
    } catch (err: any) {
      setMediaFeedback({ type: 'err', text: err?.message || 'মুছতে সমস্যা হয়েছে।' });
    } finally {
      setSavingMedia(false);
    }
  };

  // Safe Deals Specific Notice Create / Delete
  const handleAddDealNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoticeTitle.trim() || !newNoticeContent.trim()) return;
    setSavingNotice(true);
    try {
      await addDoc(collection(db, 'notices'), {
        title: newNoticeTitle.trim(),
        content: newNoticeContent.trim(),
        section: 'safe_deal',
        createdBy: currentUser?.name || 'Admin',
        createdAt: new Date().toISOString()
      });
      setNewNoticeTitle('');
      setNewNoticeContent('');
      if (fetchNotices) fetchNotices();
      setMediaFeedback({ type: 'ok', text: '✅ নিরাপদ লেনদেন নোটিশ ইউজার স্ক্রিনে যুক্ত হয়েছে!' });
      setTimeout(() => setMediaFeedback(null), 3500);
    } catch (err: any) {
      setMediaFeedback({ type: 'err', text: err?.message || 'নোটিশ যোগ করা যায়নি।' });
    } finally {
      setSavingNotice(false);
    }
  };

  const handleDeleteDealNotice = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notices', id));
      if (fetchNotices) fetchNotices();
    } catch (err: any) {
      showMsg('নোটিশ মুছতে ত্রুটি', err?.message || 'নোটিশ মুছা যায়নি।');
    }
  };

  // Atomic Admin Release / Refund Execution for any Escrow Order
  const handleExecuteOrderAction = async () => {
    if (!confirmOrderAction) return;
    const { order, action } = confirmOrderAction;
    setProcessingOrderId(order.id);
    setOrderFeedback(null);
    try {
      const nowIso = new Date().toISOString();
      const dealAmt = Math.max(0, Number(order.totalAmount || order.amount) || 0);
      const feeAmt = Math.max(0, Number(order.escrowFee || 0) || 0);

      await runTransaction(db, async (tx) => {
        const orderRef = doc(db, 'safe_deal_orders', order.id);
        const orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists()) {
          throw new Error('অর্ডারটি ডাটাবেজে পাওয়া যায়নি।');
        }
        const current = orderSnap.data();
        if (current.status === 'Payment Released' || current.status === 'Refunded' || current.status === 'Cancelled') {
          throw new Error(`এই অর্ডারটি ইতোমধ্যেই "${current.status}" হয়ে গেছে!`);
        }

        if (action === 'release') {
          const sellerCredit =
            current.feeBearer === 'seller' && feeAmt > 0
              ? Math.max(0, dealAmt - feeAmt)
              : dealAmt;

          if (current.sellerUid) {
            const sellerRef = doc(db, 'users', current.sellerUid);
            const sellerSnap = await tx.get(sellerRef);
            if (sellerSnap.exists()) {
              tx.update(sellerRef, {
                balance: increment(sellerCredit),
                mainBalance: increment(sellerCredit)
              });
            }
          }

          tx.update(orderRef, {
            status: 'Payment Released',
            approvedAt: nowIso,
            resolvedByAdmin: currentUser?.name || 'Admin',
            statusHistory: [
              ...(current.statusHistory || []),
              {
                status: 'Payment Released',
                timestamp: nowIso,
                note: `এডমিন (${currentUser?.name || 'Admin'}) নিরাপদ লেনদেন যাচাই করে পেমেন্ট বিক্রেতাকে রিলিজ করেছেন।`
              }
            ]
          });
        } else {
          const buyerRefund =
            current.feeBearer === 'buyer' && Number(current.totalBuyerPaid) > dealAmt
              ? Number(current.totalBuyerPaid)
              : dealAmt;

          if (current.buyerUid) {
            const buyerRef = doc(db, 'users', current.buyerUid);
            const buyerSnap = await tx.get(buyerRef);
            if (buyerSnap.exists()) {
              tx.update(buyerRef, {
                balance: increment(buyerRefund),
                mainBalance: increment(buyerRefund)
              });
            }
          }

          tx.update(orderRef, {
            status: 'Refunded',
            refundedAt: nowIso,
            resolvedByAdmin: currentUser?.name || 'Admin',
            statusHistory: [
              ...(current.statusHistory || []),
              {
                status: 'Refunded',
                timestamp: nowIso,
                note: `এডমিন (${currentUser?.name || 'Admin'}) অর্ডারটি বাতিল করে সম্পূর্ণ টাকা ক্রেতার ওয়ালেটে ফেরত পাঠিয়েছেন।`
              }
            ]
          });
        }
      });

      // Log transaction & user notifications
      if (action === 'release') {
        const sellerCredit =
          order.feeBearer === 'seller' && feeAmt > 0 ? Math.max(0, dealAmt - feeAmt) : dealAmt;
        if (order.sellerUid) {
          await addDoc(collection(db, 'transactions'), {
            id: `tx-esc-admrel-${Date.now()}`,
            userId: order.sellerUid,
            userName: order.sellerName || '',
            memberId: order.sellerMemberId || 'SELLER',
            type: 'deposit',
            category: 'safe_deal',
            typeLabel: 'নিরাপদ লেনদেন প্রাপ্তি (Admin)',
            amount: sellerCredit,
            fee: feeAmt,
            profit: feeAmt,
            status: 'success',
            description: `এডমিন কর্তৃক নিরাপদ লেনদেন পেমেন্ট রিলিজ: ${order.dealTitle || 'ডিল'} (#${order.id.substring(0, 6).toUpperCase()})`,
            createdAt: nowIso,
            paymentMethod: 'Escrow Admin Release'
          });
          await addDoc(collection(db, 'user_notifications'), {
            userId: order.sellerUid,
            title: '✅ নিরাপদ লেনদেন পেমেন্ট রিলিজ!',
            message: `এডমিন আপনার নিরাপদ ডিল "${order.dealTitle || 'এসক্রো ডিল'}" এর ৳${sellerCredit.toLocaleString('bn-BD')} ওয়ালেটে যোগ করেছেন।`,
            type: 'safe_deal_released',
            read: false,
            createdAt: nowIso
          });
        }
        setOrderFeedback({ type: 'ok', text: '✅ পেমেন্ট সফলভাবে বিক্রেতাকে রিলিজ করা হয়েছে!' });
      } else {
        const buyerRefund =
          order.feeBearer === 'buyer' && Number(order.totalBuyerPaid) > dealAmt
            ? Number(order.totalBuyerPaid)
            : dealAmt;
        if (order.buyerUid) {
          await addDoc(collection(db, 'transactions'), {
            id: `tx-esc-admref-${Date.now()}`,
            userId: order.buyerUid,
            userName: order.buyerName || '',
            memberId: order.buyerMemberId || '',
            type: 'deposit',
            category: 'safe_deal_refund',
            typeLabel: 'নিরাপদ লেনদেন রিফান্ড (Admin)',
            amount: buyerRefund,
            status: 'success',
            description: `এডমিন কর্তৃক নিরাপদ লেনদেন বাতিল ও রিফান্ড: ${order.dealTitle || 'ডিল'} (#${order.id.substring(0, 6).toUpperCase()})`,
            createdAt: nowIso,
            paymentMethod: 'Escrow Admin Refund'
          });
          await addDoc(collection(db, 'user_notifications'), {
            userId: order.buyerUid,
            title: '↩️ নিরাপদ লেনদেন টাকা ফেরত (রিফান্ড)',
            message: `আপনার নিরাপদ ডিল "${order.dealTitle || 'এসক্রো ডিল'}" বাতিল হয়ে ৳${buyerRefund.toLocaleString('bn-BD')} মেইন ব্যালেন্সে ফেরত দেওয়া হয়েছে।`,
            type: 'safe_deal_refund',
            read: false,
            createdAt: nowIso
          });
        }
        setOrderFeedback({ type: 'ok', text: '↩️ অর্ডার বাতিল করে টাকা ক্রেতার ওয়ালেটে ফেরত দেওয়া হয়েছে!' });
      }

      setConfirmOrderAction(null);
      setTimeout(() => setOrderFeedback(null), 4000);
    } catch (err: any) {
      const m = err?.message || 'অর্ডার প্রসেস করতে সমস্যা হয়েছে।';
      setOrderFeedback({ type: 'err', text: m });
      showMsg('এসক্রো অর্ডার ত্রুটি', m);
    } finally {
      setProcessingOrderId(null);
    }
  };

  // Record optional Admin Loss/Compensation on a Dispute (tracked in Safe Deals Audit)
  const handleSaveDisputeLoss = async (dispId: string) => {
    const raw = convertBengaliToEnglishDigits(disputeLossDraft[dispId] ?? '0');
    const lossVal = Math.max(0, Number(raw) || 0);
    setSavingDisputeLossId(dispId);
    try {
      await updateDoc(doc(db, 'escrow_disputes', dispId), {
        adminLoss: lossVal
      });
    } catch (err: any) {
      showMsg('ক্ষতিপূরণ সেভ ত্রুটি', err?.message || 'সংরক্ষণ করা যায়নি।');
    } finally {
      setSavingDisputeLossId(null);
    }
  };

  const pendingDisputesCount = liveDisputes.filter((d: any) => d.status === 'Pending').length;
  const activeOrdersCount = liveOrders.filter(
    (o: any) => o.status === 'Payment Held' || o.status === 'Shipped'
  ).length;

  const filteredOrders = liveOrders.filter((ord) => {
    const st = String(ord.status || '');
    if (orderStatusFilter === 'held' && st !== 'Payment Held') return false;
    if (orderStatusFilter === 'shipped' && st !== 'Shipped') return false;
    if (orderStatusFilter === 'released' && st !== 'Payment Released') return false;
    if (orderStatusFilter === 'refunded' && st !== 'Refunded' && st !== 'Cancelled') return false;
    const q = orderSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      String(ord.id || '').toLowerCase().includes(q) ||
      String(ord.buyerName || '').toLowerCase().includes(q) ||
      String(ord.buyerPhone || '').toLowerCase().includes(q) ||
      String(ord.buyerMemberId || '').toLowerCase().includes(q) ||
      String(ord.sellerName || '').toLowerCase().includes(q) ||
      String(ord.sellerPhone || '').toLowerCase().includes(q) ||
      String(ord.dealTitle || '').toLowerCase().includes(q) ||
      String(ord.trackingNumber || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4 animate-fade-in text-slate-800">
      {/* Sub-tab switcher covering all Safe Deals Admin controls */}
      <div className="flex flex-wrap border-b border-slate-200 pb-2.5 gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => setSdSubTab('orders')}
          className={`px-3 sm:px-3.5 py-2 text-[11px] sm:text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
            sdSubTab === 'orders'
              ? 'bg-[#008769] text-white shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          <span>💸 এসক্রো লেনদেন ও অর্ডার ({liveOrders.length})</span>
          {activeOrdersCount > 0 && (
            <span className="bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-full text-[9.5px] font-mono font-black">
              {activeOrdersCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSdSubTab('controls')}
          className={`px-3 sm:px-3.5 py-2 text-[11px] sm:text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
            sdSubTab === 'controls'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>⚙️ ফি, সীমা ও ইউজার কন্ট্রোল</span>
        </button>

        <button
          type="button"
          onClick={() => setSdSubTab('media')}
          className={`px-3 sm:px-3.5 py-2 text-[11px] sm:text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
            sdSubTab === 'media'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          <Megaphone className="w-3.5 h-3.5" />
          <span>📢 ঘোষণা, ব্যানার ও নোটিশ</span>
        </button>

        <button
          type="button"
          onClick={() => setSdSubTab('deals')}
          className={`px-3 sm:px-3.5 py-2 text-[11px] sm:text-xs font-black rounded-xl transition cursor-pointer ${
            sdSubTab === 'deals'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          📦 গ্রুপ ডিল ও প্রোডাক্টস তালিকা ({safeDeals.length})
        </button>

        <button
          type="button"
          onClick={() => setSdSubTab('disputes')}
          className={`px-3 sm:px-3.5 py-2 text-[11px] sm:text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
            sdSubTab === 'disputes'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          <span>🚨 কাস্টমার অভিযোগ ও সাপোর্ট টিকিট ({pendingDisputesCount})</span>
        </button>
      </div>

      {/* TAB 1: LIVE ESCROW ORDERS CONTROL */}
      {sdSubTab === 'orders' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 space-y-4 shadow-2xs text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  নিরাপদ লেনদেন (এসক্রো অর্ডার) রিয়েল-টাইম কন্ট্রোল
                </h2>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  ইউজারদের পাঠানো সব নিরাপদ লেনদেন এখান থেকে মনিটর, ভেরিফাই, পেমেন্ট রিলিজ অথবা রিফান্ড/বাতিল করুন।
                </p>
              </div>
              <div className="relative sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="নাম, মোবাইল, আইডি বা ট্র্যাকিং..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Status filter pills */}
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { k: 'all', l: `সব অর্ডার (${liveOrders.length})` },
                  { k: 'held', l: `⏳ হোল্ড (${liveOrders.filter((o) => o.status === 'Payment Held').length})` },
                  { k: 'shipped', l: `🚚 পথে পাঠানো (${liveOrders.filter((o) => o.status === 'Shipped').length})` },
                  { k: 'released', l: `✅ সম্পন্ন (${liveOrders.filter((o) => o.status === 'Payment Released').length})` },
                  { k: 'refunded', l: `↩️ বাতিল/রিফান্ড (${liveOrders.filter((o) => o.status === 'Refunded' || o.status === 'Cancelled').length})` }
                ] as const
              ).map((f) => (
                <button
                  key={f.k}
                  type="button"
                  onClick={() => setOrderStatusFilter(f.k)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black border transition cursor-pointer ${
                    orderStatusFilter === f.k
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {f.l}
                </button>
              ))}
            </div>

            {orderFeedback && (
              <div
                className={`text-xs font-bold px-3 py-2 rounded-xl border ${
                  orderFeedback.type === 'ok'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {orderFeedback.text}
              </div>
            )}

            {/* Confirmation strip if pending release/refund */}
            {confirmOrderAction && (
              <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-amber-950">
                      {confirmOrderAction.action === 'release'
                        ? '✅ পেমেন্ট রিলিজ নিশ্চিত করুন'
                        : '↩️ অর্ডার বাতিল ও ক্রেতাকে রিফান্ড নিশ্চিত করুন'}
                    </h4>
                    <p className="text-[11px] font-bold text-amber-900 mt-0.5">
                      অর্ডার #{confirmOrderAction.order.id.substring(0, 8).toUpperCase()} • পরিমাণ: ৳
                      {Number(confirmOrderAction.order.totalAmount || 0).toLocaleString('en-US')} •{' '}
                      {confirmOrderAction.action === 'release'
                        ? `টাকা বিক্রেতা (${confirmOrderAction.order.sellerName}) এর ওয়ালেটে যোগ হবে।`
                        : `টাকা ক্রেতা (${confirmOrderAction.order.buyerName}) এর ওয়ালেটে ফেরত যাবে।`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={processingOrderId === confirmOrderAction.order.id}
                    onClick={handleExecuteOrderAction}
                    className={`px-4 py-2 rounded-xl text-xs font-black text-white cursor-pointer ${
                      confirmOrderAction.action === 'release'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    {processingOrderId ? 'প্রসেসিং...' : 'হ্যাঁ, নিশ্চিত করুন'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmOrderAction(null)}
                    className="px-4 py-2 rounded-xl text-xs font-black bg-white border border-slate-300 text-slate-700 cursor-pointer"
                  >
                    বাতিল
                  </button>
                </div>
              </div>
            )}

            {/* Orders list */}
            {filteredOrders.length === 0 ? (
              <div className="py-12 border border-dashed border-slate-200 rounded-2xl text-center text-slate-500 text-xs font-bold">
                এই ক্যাটাগরিতে কোনো নিরাপদ লেনদেন (এসক্রো অর্ডার) পাওয়া যায়নি।
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((ord) => {
                  const st = String(ord.status || 'Payment Held');
                  const isActive = st === 'Payment Held' || st === 'Shipped';
                  const feeVal = Math.max(0, Number(ord.escrowFee || 0) || 0);
                  return (
                    <div
                      key={ord.id}
                      className="bg-slate-50/70 border border-slate-200 rounded-2xl p-3.5 sm:p-4 space-y-2.5 hover:border-emerald-400/60 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono font-black bg-slate-900 text-white px-2 py-0.5 rounded-md">
                            #{String(ord.id).substring(0, 8).toUpperCase()}
                          </span>
                          <span
                            className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                              st === 'Payment Released'
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : st === 'Shipped'
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : st === 'Refunded' || st === 'Cancelled'
                                    ? 'bg-rose-100 text-rose-900 border-rose-300'
                                    : 'bg-sky-100 text-sky-900 border-sky-300'
                            }`}
                          >
                            {st === 'Payment Released'
                              ? '✅ সম্পন্ন (Released)'
                              : st === 'Shipped'
                                ? '🚚 পথে পাঠানো (Shipped)'
                                : st === 'Refunded' || st === 'Cancelled'
                                  ? '↩️ বাতিল ও ফেরত'
                                  : '⏳ অপেক্ষমাণ (Held)'}
                          </span>
                          {ord.createdAt && (
                            <span className="text-[10px] font-mono text-slate-500">
                              {new Date(ord.createdAt).toLocaleString('bn-BD')}
                            </span>
                          )}
                        </div>

                        <div className="text-left sm:text-right">
                          <span className="text-base font-black font-mono text-slate-950">
                            ৳{Number(ord.totalAmount || 0).toLocaleString('en-US')}
                          </span>
                          <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                            {feeVal > 0 ? `ফি: ৳${feeVal}` : 'ফি: ফ্রি (৳0)'}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-white border border-slate-200/80 rounded-xl p-2.5">
                        <div>
                          <span className="text-[9.5px] font-black text-slate-400 uppercase block">ক্রেতা (টাকা পেয়ার)</span>
                          <span className="font-black text-slate-800">{ord.buyerName || 'অজানা'}</span>
                          <span className="block text-[10.5px] font-mono text-slate-500">
                            {ord.buyerPhone} {ord.buyerMemberId ? `• ${ord.buyerMemberId}` : ''}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9.5px] font-black text-slate-400 uppercase block">বিক্রেতা (টাকা প্রাপক)</span>
                          <span className="font-black text-slate-800">{ord.sellerName || 'অনিবন্ধিত'}</span>
                          <span className="block text-[10.5px] font-mono text-slate-500">
                            {ord.sellerPhone} {ord.sellerMemberId ? `• ${ord.sellerMemberId}` : ''}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9.5px] font-black text-slate-400 uppercase block">ডিলের বিবরণ</span>
                          <span className="font-bold text-slate-800 line-clamp-2">
                            {ord.dealTitle || 'নিরাপদ লেনদেন ডিল'}
                          </span>
                        </div>
                      </div>

                      {ord.trackingNumber && (
                        <div className="bg-sky-50 border border-sky-200 rounded-xl px-3 py-2 text-[11px] flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-sky-900">
                            🚚 কুরিয়ার: {ord.courierName || 'N/A'} • ট্র্যাকিং নং:{' '}
                            <span className="font-mono font-black text-rose-800">{ord.trackingNumber}</span>
                          </span>
                          {ord.shipmentDate && (
                            <span className="text-[10px] font-mono text-sky-700">{ord.shipmentDate}</span>
                          )}
                        </div>
                      )}

                      {isActive && (
                        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setConfirmOrderAction({ order: ord, action: 'release' })}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black cursor-pointer flex items-center gap-1 shadow-2xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>পেমেন্ট রিলিজ করুন (বিক্রেতাকে দিন)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmOrderAction({ order: ord, action: 'refund' })}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[11px] font-black cursor-pointer flex items-center gap-1"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>বাতিল ও ক্রেতাকে রিফান্ড</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FEE SETTINGS (FREE OR % / FIXED), LIMITS & USER DASHBOARD CONTROLS */}
      {sdSubTab === 'controls' && (
        <form onSubmit={handleSaveSafeDealsControls} className="space-y-4 text-left">
          {/* Card 1: Service Master Switch & Fee Settings */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 space-y-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-600" />
                  নিরাপদ লেনদেন চার্জ / ফি ও সার্ভিস কন্ট্রোল
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  আপাতত ফ্রি রাখুন অথবা ভবিষ্যতে যেকোনো সময় শতাংশ (%) বা নির্দিষ্ট টাকা (৳) চার্জ চালু করুন। এখান থেকেই ইউজার ড্যাশবোর্ড সরাসরি নিয়ন্ত্রিত হবে।
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSdServiceEnabled((v) => !v)}
                className={`px-4 py-2 rounded-xl text-xs font-black border transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  sdServiceEnabled
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                    : 'bg-rose-600 text-white border-rose-700 shadow-xs'
                }`}
              >
                {sdServiceEnabled ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                <span>{sdServiceEnabled ? 'সার্ভিস চালু (ON)' : 'সার্ভিস বন্ধ (OFF)'}</span>
              </button>
            </div>

            {/* Fee Mode Selector */}
            <div className="space-y-2.5">
              <label className="text-xs font-black text-slate-700 block">
                ১. লেনদেন চার্জ / ফি ধরন (Fee Mode)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { k: 'free', title: '🆓 সম্পূর্ণ ফ্রি (আপাতত)', sub: '০% এবং ৳০ চার্জ' },
                    { k: 'percent', title: '📊 শতাংশ হার (%)', sub: 'যেমন: ১% বা ২%' },
                    { k: 'fixed', title: '💵 নির্দিষ্ট টাকা (৳)', sub: 'যেমন: ৳৫ বা ৳১০' },
                    { k: 'both', title: '🔀 উভয় (% + ৳)', sub: 'শতাংশ + ফিক্সড ফি' }
                  ] as const
                ).map((m) => (
                  <button
                    key={m.k}
                    type="button"
                    onClick={() => {
                      setFeeMode(m.k);
                      if (m.k === 'free') {
                        setFeePercent('0');
                        setFeeFixed('0');
                      }
                    }}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      feeMode === m.k
                        ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/30'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-xs font-black text-slate-900">{m.title}</div>
                    <div className="text-[10px] font-bold text-slate-500 mt-0.5">{m.sub}</div>
                  </button>
                ))}
              </div>

              {/* Quick Fee Presets */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10.5px] font-black text-slate-500 mr-1">দ্রুত বাছাই:</span>
                {[
                  { label: '🆓 ফ্রি (০%)', mode: 'free' as const, pct: '0', fix: '0' },
                  { label: '১% (প্রতি হাজারে ১০৳)', mode: 'percent' as const, pct: '1', fix: '0' },
                  { label: '২% (প্রতি হাজারে ২০৳)', mode: 'percent' as const, pct: '2', fix: '0' },
                  { label: '৳৫ ফিক্সড', mode: 'fixed' as const, pct: '0', fix: '5' },
                  { label: '৳১০ ফিক্সড', mode: 'fixed' as const, pct: '0', fix: '10' },
                  { label: '৳২০ ফিক্সড', mode: 'fixed' as const, pct: '0', fix: '20' }
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setFeeMode(preset.mode);
                      setFeePercent(preset.pct);
                      setFeeFixed(preset.fix);
                    }}
                    className="text-[10.5px] font-black px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-emerald-100 hover:text-emerald-900 border border-slate-200 text-slate-700 cursor-pointer transition"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fee Inputs & Bearer */}
            {feeMode !== 'free' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                {(feeMode === 'percent' || feeMode === 'both') && (
                  <div className="space-y-1">
                    <label className="text-[10.5px] font-black text-slate-700 block">
                      শতাংশ ফি (%) — যেমন: 1 বা 2
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={feePercent}
                      onChange={(e) => setFeePercent(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-black font-mono outline-none focus:border-emerald-600"
                      placeholder="যেমন: 1"
                    />
                  </div>
                )}

                {(feeMode === 'fixed' || feeMode === 'both') && (
                  <div className="space-y-1">
                    <label className="text-[10.5px] font-black text-slate-700 block">
                      নির্দিষ্ট ফি (৳ টাকা) — যেমন: 5 বা 10
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={feeFixed}
                      onChange={(e) => setFeeFixed(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-black font-mono outline-none focus:border-emerald-600"
                      placeholder="যেমন: 10"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10.5px] font-black text-slate-700 block">
                    চার্জ কে বহন করবে?
                  </label>
                  <select
                    value={feeBearer}
                    onChange={(e) => setFeeBearer(e.target.value as 'buyer' | 'seller')}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-emerald-600"
                  >
                    <option value="buyer">ক্রেতা অতিরিক্ত দিবে (Buyer Pays Fee)</option>
                    <option value="seller">বিক্রেতার টাকা থেকে কাটা হবে (Deduct from Seller)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Live Fee Preview Box */}
            <div className="bg-emerald-950 text-white rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-[10px] font-black text-emerald-300 uppercase tracking-wider">
                  📊 লাইভ ফি ও অডিট প্রিভিউ
                </div>
                <div className="text-xs sm:text-sm font-black">
                  {feeMode === 'free' || computedPreviewFee === 0 ? (
                    <span>বর্তমান সেটিংস: 🆓 সম্পূর্ণ ফ্রি — কোনো লেনদেনে চার্জ কাটা হবে না।</span>
                  ) : (
                    <span>
                      ৳{parsedPreviewAmt.toLocaleString('en-US')} লেনদেনে কোম্পানি আয় (ফি):{' '}
                      <span className="text-amber-300 font-mono">৳{computedPreviewFee}</span> •{' '}
                      {feeBearer === 'buyer'
                        ? `ক্রেতা মোট দিবে ৳${(parsedPreviewAmt + computedPreviewFee).toLocaleString('en-US')}, বিক্রেতা পাবে ৳${parsedPreviewAmt.toLocaleString('en-US')}`
                        : `ক্রেতা দিবে ৳${parsedPreviewAmt.toLocaleString('en-US')}, বিক্রেতা পাবে ৳${Math.max(0, parsedPreviewAmt - computedPreviewFee).toLocaleString('en-US')}`}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-bold text-emerald-200">টেস্ট টাকা:</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={previewAmount}
                  onChange={(e) => setPreviewAmount(e.target.value)}
                  className="w-24 bg-slate-900 border border-emerald-600 rounded-xl px-2.5 py-1 text-xs font-black font-mono text-white outline-none"
                />
              </div>
            </div>

            {/* Transaction Limits & Support Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[10.5px] font-black text-slate-600 block">
                  সর্বনিম্ন লেনদেন সীমা (৳ BDT)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black font-mono outline-none focus:border-emerald-600"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10.5px] font-black text-slate-600 block">
                  সর্বোচ্চ লেনদেন সীমা (৳ BDT)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black font-mono outline-none focus:border-emerald-600"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10.5px] font-black text-slate-600 block flex items-center gap-1">
                  <Phone className="w-3 h-3 text-emerald-600" />
                  সাপোর্ট WhatsApp নম্বর (ইউজার হেল্প ডেস্ক)
                </label>
                <input
                  type="text"
                  value={supportWhatsapp}
                  onChange={(e) => setSupportWhatsapp(e.target.value)}
                  placeholder="01865911728"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black font-mono outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            {/* Action Permission Toggles for User Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                {
                  val: allowBuyerSend,
                  set: setAllowBuyerSend,
                  title: '📤 টাকা পাঠান (নতুন বুকিং)',
                  sub: 'ইউজার নতুন এসক্রো বুকিং পাঠাতে পারবে'
                },
                {
                  val: allowSellerCancel,
                  set: setAllowSellerCancel,
                  title: '↩️ বিক্রেতা বাতিল/রিফান্ড',
                  sub: 'বিক্রেতা নিজে ডিল বাতিল করতে পারবে'
                },
                {
                  val: allowBuyerDispute,
                  set: setAllowBuyerDispute,
                  title: '🚨 অভিযোগ ও সাপোর্ট টিকিট',
                  sub: 'ইউজার বিবাদ/অভিযোগ দাখিল করতে পারবে'
                }
              ].map((t) => (
                <button
                  key={t.title}
                  type="button"
                  onClick={() => t.set(!t.val)}
                  className={`p-3 rounded-2xl border text-left flex items-center justify-between gap-2 cursor-pointer transition ${
                    t.val ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div>
                    <div className="text-xs font-black text-slate-900">{t.title}</div>
                    <div className="text-[10px] font-medium text-slate-500">{t.sub}</div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black shrink-0 ${
                      t.val ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'
                    }`}
                  >
                    {t.val ? 'ON' : 'OFF'}
                  </span>
                </button>
              ))}
            </div>

            {/* Rules Summary */}
            <div className="space-y-1">
              <label className="text-[10.5px] font-black text-slate-600 block">
                নিরাপদ লেনদেন নিয়মাবলী ও নির্দেশিকা (User Guide Summary)
              </label>
              <textarea
                rows={2}
                value={rulesSummary}
                onChange={(e) => setRulesSummary(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-emerald-600"
              />
            </div>

            {controlsFeedback && (
              <div
                className={`text-xs font-bold px-3 py-2 rounded-xl border ${
                  controlsFeedback.type === 'ok'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {controlsFeedback.text}
              </div>
            )}

            <button
              type="submit"
              disabled={savingControls}
              className="w-full py-3 bg-[#008769] hover:bg-[#006e55] disabled:opacity-60 text-white rounded-2xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>{savingControls ? 'সংরক্ষণ হচ্ছে...' : 'নিরাপদ লেনদেন সেটিংস ও কন্ট্রোল সংরক্ষণ করুন'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: TICKER, BANNERS & SAFE DEALS NOTICES CONTROL */}
      {sdSubTab === 'media' && (
        <div className="space-y-4 text-left">
          {/* 1. Header Ticker */}
          <form onSubmit={handleSaveMediaControls} className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 space-y-3 shadow-2xs">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-amber-500" />
              ১. ইউজার নিরাপদ লেনদেন হেডার ঘোষণা (Marquee Ticker)
            </h3>
            <textarea
              rows={2}
              value={localTicker}
              onChange={(e) => setLocalTicker(e.target.value)}
              placeholder="ইউজার নিরাপদ লেনদেন পেজের উপরের চলমান ঘোষণা লিখুন..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600"
            />
            <button
              type="submit"
              disabled={savingMedia}
              className="px-4 py-2 bg-[#008769] hover:bg-[#006e55] text-white rounded-xl text-xs font-black cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingMedia ? 'সেভ হচ্ছে...' : 'ঘোষণা ও ব্যানার সেভ করুন'}</span>
            </button>
          </form>

          {/* 2. Banners Slider Manager (`safeDealsBanners`) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 space-y-4 shadow-2xs">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                🖼️ ২. ইউজার নিরাপদ লেনদেন ব্যানার স্লাইডার ({localBanners.length}টি)
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                ইউজার নিরাপদ লেনদেন পেজে যে ১৬:৯ ব্যানার স্লাইডার দেখা যায় তা এখান থেকে যোগ বা পরিবর্তন করুন।
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={newBannerImage}
                  onChange={(e) => setNewBannerImage(e.target.value)}
                  placeholder="ব্যানার ছবির URL দিন অথবা গ্যালারি থেকে আপলোড করুন..."
                  className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-emerald-600"
                />
                {handleFileChange && (
                  <label className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black text-center cursor-pointer flex items-center justify-center gap-1.5">
                    <span>📁 গ্যালারি থেকে ব্যানার ছবি নিন</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, (base64: string) => setNewBannerImage(base64))}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={newBannerTitle}
                  onChange={(e) => setNewBannerTitle(e.target.value)}
                  placeholder="শিরোনাম (ঐচ্ছিক)"
                  className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-emerald-600"
                />
                <input
                  type="text"
                  value={newBannerDesc}
                  onChange={(e) => setNewBannerDesc(e.target.value)}
                  placeholder="সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)"
                  className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-emerald-600"
                />
                <button
                  type="button"
                  disabled={savingMedia}
                  onClick={handleAddBannerSlide}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 py-2 text-xs font-black cursor-pointer flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> ব্যানার যোগ করুন
                </button>
              </div>
            </div>

            {localBanners.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {localBanners.map((b) => (
                  <div key={b.id} className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="aspect-video bg-slate-900 relative">
                      <img src={b.image} alt={b.title || 'Banner'} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleDeleteBannerSlide(b.id)}
                        className="absolute top-2 right-2 p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer shadow"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {(b.title || b.description) && (
                      <div className="p-2.5">
                        <div className="text-xs font-black text-slate-800">{b.title}</div>
                        <div className="text-[10.5px] text-slate-500">{b.description}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Section-Specific Notices (`section === 'safe_deal'`) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 space-y-4 shadow-2xs">
            <h3 className="text-sm font-black text-slate-900">
              📌 ৩. নিরাপদ লেনদেন বিশেষ নোটিশ বোর্ড ({dealNotices.length}টি)
            </h3>

            <form onSubmit={handleAddDealNotice} className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
              <input
                type="text"
                required
                value={newNoticeTitle}
                onChange={(e) => setNewNoticeTitle(e.target.value)}
                placeholder="নোটিশ শিরোনাম লিখুন..."
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-emerald-600"
              />
              <textarea
                rows={2}
                required
                value={newNoticeContent}
                onChange={(e) => setNewNoticeContent(e.target.value)}
                placeholder="নোটিশের বিস্তারিত বার্তা লিখুন..."
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-emerald-600"
              />
              <button
                type="submit"
                disabled={savingNotice}
                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-black cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{savingNotice ? 'প্রকাশ হচ্ছে...' : 'নিরাপদ লেনদেন নোটিশ প্রকাশ করুন'}</span>
              </button>
            </form>

            {mediaFeedback && (
              <div
                className={`text-xs font-bold px-3 py-2 rounded-xl border ${
                  mediaFeedback.type === 'ok'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {mediaFeedback.text}
              </div>
            )}

            {dealNotices.length > 0 && (
              <div className="space-y-2">
                {dealNotices.map((n) => (
                  <div
                    key={n.id}
                    className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3 flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-emerald-950">{n.title}</h4>
                      <p className="text-[11px] text-slate-700 mt-0.5">{n.content}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteDealNotice(n.id)}
                      className="p-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: GROUP BUY DEALS & PRODUCTS (EXISTING PRESERVED) */}
      {sdSubTab === 'deals' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200/80 p-5 sm:p-6 rounded-3xl text-left">
            <h2 className="text-base sm:text-lg font-black text-emerald-600 flex items-center gap-2">
              🤝 গ্রুপ বাই ডিল প্রোডাক্টস কন্ট্রোল প্যানেল
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              ইউজারদের অ্যাপে প্রদর্শনের জন্য নিরাপদ লেনদেনের নতুন ক্যাটাগরি ও প্রোডাক্ট ডিল এখান থেকে নিয়ন্ত্রণ করুন।
            </p>

            <form onSubmit={handleCreateSafeDeal} className="mt-5 bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">নতুন প্রোডাক্ট ডিল যুক্ত করুন</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">প্রোডাক্টের নাম (Title)</label>
                  <input
                    type="text"
                    value={sdTitle}
                    onChange={(e) => setSdTitle(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-bold outline-none transition"
                    placeholder="যেমন: ঘানি ভাঙা খাঁটি সরিষার তেল"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">সরবরাহকারী (Supplier Brand)</label>
                  <input
                    type="text"
                    value={sdSupplier}
                    onChange={(e) => setSdSupplier(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-bold outline-none transition"
                    placeholder="যেমন: Safi Pure Food Ltd"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">মূল্য (৳ BDT)</label>
                  <input
                    type="number"
                    value={sdPrice}
                    onChange={(e) => setSdPrice(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-bold outline-none transition"
                    placeholder="যেমন: 220"
                    required
                    min="1"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">সর্বনিম্ন অর্ডার (Min Qty)</label>
                  <input
                    type="text"
                    value={sdMinQty}
                    onChange={(e) => setSdMinQty(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-bold outline-none transition"
                    placeholder="যেমন: 5 লিটার বা 3 পিস"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">আইকন ইমোজি (Emoji)</label>
                  <input
                    type="text"
                    value={sdEmoji}
                    onChange={(e) => setSdEmoji(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-bold outline-none transition text-center"
                    placeholder="যেমন: 🛢️"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={loadingEscrow}
                    className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-black transition shadow-sm hover:scale-101 active:scale-98 disabled:opacity-50 cursor-pointer"
                  >
                    {loadingEscrow ? 'সেভ হচ্ছে...' : 'ডিল প্রোডাক্ট সংরক্ষণ করুন 🚀'}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest font-mono">প্রোডাক্টের বিবরণ (Description)</label>
                <textarea
                  value={sdDesc}
                  onChange={(e) => setSdDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-medium outline-none transition resize-none"
                  placeholder="প্রোডাক্টের বৈশিষ্ট্য, বিশুদ্ধতার গ্যারান্টি ইত্যাদি সংক্ষিপ্ত বিবরণ দিন..."
                />
              </div>
            </form>
          </div>

          {/* List of deals */}
          <div className="bg-white border border-slate-200/80 p-5 sm:p-6 rounded-3xl text-left">
            <h3 className="text-sm font-extrabold text-slate-800 mb-4 flex items-center gap-2">
              📦 বিদ্যমান গ্রুপ বাই ডিল প্রোডাক্টস তালিকা ({safeDeals.length} টি)
            </h3>

            {safeDeals.length === 0 ? (
              <div className="py-12 border border-dashed border-slate-200/80 rounded-2xl text-center text-slate-500 text-xs font-bold">
                কোনো প্রোডাক্ট ডিল পাওয়া যায়নি।
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {safeDeals.map((deal: any, idx: number) => (
                  <div key={`${deal.id}-${idx}`} className="bg-white border border-slate-200 p-4 rounded-2xl flex items-start gap-3 justify-between hover:border-emerald-500/40 transition">
                    <div className="flex items-start gap-2.5">
                      <span className="text-2xl bg-slate-100 p-2 rounded-xl block leading-none">{deal.emoji || '📦'}</span>
                      <div className="space-y-0.5 text-left">
                        <h4 className="text-xs font-black text-slate-800">{deal.title}</h4>
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed truncate max-w-[220px]">{deal.description}</p>
                        <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 font-bold font-mono">
                          <span>৳{deal.price}</span>
                          <span>•</span>
                          <span>Min: {deal.minQty}</span>
                          <span>•</span>
                          <span className="text-slate-700">{deal.supplier}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end justify-between h-full gap-4 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                          deal.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {deal.status === 'active' ? 'ACTIVE' : 'INACTIVE'}
                      </span>

                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleSafeDealStatus(deal.id, deal.status)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition cursor-pointer"
                        >
                          {deal.status === 'active' ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSafeDeal(deal.id)}
                          className="p-1 text-rose-600 hover:text-white hover:bg-rose-600 rounded-lg transition cursor-pointer"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: CUSTOMER DISPUTES & SUPPORT TICKETS */}
      {sdSubTab === 'disputes' && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 text-left space-y-6 animate-fade-in">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800">🚨 অভিযোগ ও সাপোর্ট টিকিট খাতা ({liveDisputes.length} টি)</h3>
            <p className="text-xs text-slate-500 mt-1">
              নিরাপদ লেনদেন বা পণ্য ক্রয়ের বিপরীতে গ্রাহকদের দাখিল করা অভিযোগসমূহ এখান থেকে পর্যালোচনা ও স্ট্যাটাস পরিবর্তন করুন।
            </p>
          </div>

          {liveDisputes.length === 0 ? (
            <div className="py-12 border border-dashed border-slate-200/80 rounded-2xl text-center text-slate-500 text-xs font-bold">
              কোনো কাস্টমার অভিযোগ পাওয়া যায়নি।
            </div>
          ) : (
            <div className="space-y-4">
              {liveDisputes.map((disp: any, idx: number) => (
                <div key={`${disp.id}-${idx}`} className="bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl space-y-4 shadow-2xs hover:border-emerald-500/20 transition-all">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-slate-100 text-slate-800 font-extrabold px-2 py-1 rounded-md">
                        {disp.serialNo || `#${String(disp.id).substring(0, 6).toUpperCase()}`}
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        অর্ডার আইডি: #{disp.orderId?.substring(0, 8).toUpperCase() || 'N/A'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                          disp.status === 'Resolved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : disp.status === 'Under Investigation'
                              ? 'bg-amber-100 text-amber-800 animate-pulse'
                              : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {disp.status || 'Pending'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
                    <div className="space-y-1 text-left">
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-wide">গ্রাহকের বিবরণ</p>
                      <p className="text-slate-800 font-extrabold">{disp.userName || 'Unknown User'}</p>
                      <p className="text-slate-500 font-bold">{disp.userPhone || 'N/A'}</p>
                    </div>
                    <div className="space-y-1 text-left">
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-wide">প্রোডাক্ট ও টাকা</p>
                      <p className="text-slate-800 font-extrabold">{disp.orderTitle || 'নিরাপদ লেনদেন ডিল'}</p>
                      <p className="text-emerald-700 font-extrabold">৳{Number(disp.amount || 0).toLocaleString('en-US')}</p>
                    </div>
                  </div>

                  {disp.courierName && disp.courierName !== 'N/A' && (
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs space-y-1">
                      <p className="text-slate-400 text-[10px] font-bold uppercase">কুরিয়ার ও ট্র্যাকিং</p>
                      <p className="text-slate-700 font-bold">কুরিয়ার: {disp.courierName} | ট্র্যাকিং নং: {disp.trackingNumber}</p>
                      <p className="text-slate-500">তারিখ: {disp.shipmentDate}</p>
                    </div>
                  )}

                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-left">
                    <p className="text-slate-400 text-[10px] font-bold uppercase mb-1">অভিযোগের কারণ / বিবরণ</p>
                    <p className="text-xs text-slate-700 font-semibold whitespace-pre-wrap leading-relaxed">{disp.description}</p>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10.5px] font-bold text-slate-500">অডিটে ডিসপিউট ক্ষতি (৳):</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={disputeLossDraft[disp.id] ?? String(disp.adminLoss ?? 0)}
                        onChange={(e) => setDisputeLossDraft((prev) => ({ ...prev, [disp.id]: e.target.value }))}
                        className="w-24 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-black font-mono outline-none focus:border-emerald-600"
                      />
                      <button
                        type="button"
                        disabled={savingDisputeLossId === disp.id}
                        onClick={() => handleSaveDisputeLoss(disp.id)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[10.5px] font-black cursor-pointer"
                      >
                        {savingDisputeLossId === disp.id ? '...' : 'সেভ'}
                      </button>
                    </div>

                    <select
                      value={disp.status || 'Pending'}
                      onChange={(e) => handleUpdateDisputeStatus(disp.id, e.target.value)}
                      disabled={updatingDisputeId === disp.id}
                      className="bg-white border border-slate-300 text-slate-800 text-xs font-extrabold rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer"
                    >
                      <option value="Pending">🔴 Pending</option>
                      <option value="Under Investigation">🟡 Under Investigation</option>
                      <option value="Resolved">🟢 Resolved</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
