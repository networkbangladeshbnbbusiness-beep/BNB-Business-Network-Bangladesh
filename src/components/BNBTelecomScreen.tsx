import React, { useState, useEffect } from 'react';
import { User, Transaction, Offer, AppConfig, getEffectiveBalance, generateBNBTrxId, formatShortTrxId } from '../types';
import { db } from '../lib/firebase';
import UnifiedBackButton from './UnifiedBackButton';
import { verifyUserPin } from '../lib/memberUtils';
import { collection, addDoc, doc, updateDoc, setDoc, query, where, getDocs, runTransaction } from 'firebase/firestore';
import { apiUrl } from '../config/api';
import { 
  ChevronLeft, 
  Smartphone, 
  Zap, 
  Search, 
  Bell, 
  LogOut, 
  History, 
  CreditCard,
  Gift,
  HelpCircle,
  AlertTriangle,
  Send,
  Lock,
  CheckCircle,
  X,
  Plus,
  RefreshCw,
  Sparkles,
  ClipboardList,
  ShieldCheck,
  MessageSquare,
  PhoneCall,
  Copy,
  ExternalLink,
  Headphones,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useBackHandler } from '../lib/navigationManager';
import TelecomAdmin from './TelecomAdmin';
import MoneyExchangeModule from './MoneyExchangeModule';
import { BNBPaymentReceiptModal, PaymentReceiptData } from './BNBPaymentReceiptModal';

// Helper functions for operator-specific cashback rules matching
const isOperatorMatch = (ruleOpRaw?: string, targetOpRaw?: string): boolean => {
  const rOp = (ruleOpRaw || 'all').trim().toLowerCase();
  const tOp = (targetOpRaw || '').trim().toLowerCase();

  if (rOp === 'all' || rOp === 'সকল অপারেটর') return true;
  if (rOp === tOp) return true;

  const opAliases: Record<string, string[]> = {
    'grameenphone': ['gp', 'গ্রামীন', 'গ্রামীনফোন', 'grameenphone'],
    'robi': ['robi', 'রবি'],
    'airtel': ['airtel', 'এয়ারটেল'],
    'banglalink': ['bl', 'বাংলালিংক', 'banglalink'],
    'teletalk': ['teletalk', 'টেলিটক'],
    'skitto': ['skitto', 'স্কিটো'],
    'alaap': ['alaap', 'আলাপ'],
    'brilliant': ['brilliant', 'ব্রিলিয়ান্ট']
  };

  for (const [canonical, aliases] of Object.entries(opAliases)) {
    const isTargetInGroup = tOp === canonical || aliases.includes(tOp);
    const isRuleInGroup = rOp === canonical || aliases.includes(rOp);
    if (isTargetInGroup && isRuleInGroup) return true;
  }

  return false;
};

const getMatchedCashbackForRule = (rules: any[] = [], amount: number, operator: string): number => {
  let matchedCashback = 0;
  let foundSpecific = false;

  for (const r of rules) {
    if (Number(r.amount) !== amount) continue;
    const rOp = (r.operator || 'all').trim().toLowerCase();

    // Specific operator rule takes priority
    if (rOp !== 'all' && rOp !== 'সকল অপারেটর' && isOperatorMatch(rOp, operator)) {
      return Number(r.cashback);
    }

    // Generic 'all' operator rule fallback
    if ((rOp === 'all' || rOp === 'সকল অপারেটর') && !foundSpecific) {
      matchedCashback = Number(r.cashback);
    }
  }

  return matchedCashback;
};

const getFilteredRulesForOperator = (rules: any[] = [], operator: string) => {
  if (!rules || rules.length === 0) return [];
  const tOp = (operator || '').trim().toLowerCase();

  const filtered = rules.filter(r => {
    const rOp = (r.operator || 'all').trim().toLowerCase();
    if (rOp === 'all' || rOp === 'সকল অপারেটর') return true;
    return isOperatorMatch(rOp, tOp);
  });

  return [...filtered].sort((a, b) => Number(a.amount) - Number(b.amount));
};

interface BNBTelecomScreenProps {
  user: User;
  allOffers: Offer[];
  onBack: () => void;
  syncLiveProfile: () => void;
  onOpenDeposit: () => void;
  appConfig?: AppConfig;
  allNotices?: any[];
}

export const BNBTelecomScreen = React.memo(function BNBTelecomScreen({ 
  user, 
  allOffers, 
  onBack, 
  syncLiveProfile,
  onOpenDeposit,
  appConfig,
  allNotices = []
}: BNBTelecomScreenProps) {
  
  const [activeSubView, setActiveSubView] = useState<'main' | 'admin'>('main');
  const [addBalanceMsg, setAddBalanceMsg] = useState<{ text: string; type: 'error' | 'success' } | null>(null);

  const pushedViewRef = React.useRef<string>('main');

  const handleBack = () => {
    const modalClosed = closeTelecomModals();
    if (modalClosed) return;
    if (activeSubView !== 'main') {
      setActiveSubView('main');
    } else {
      onBack();
    }
  };

  // Filtering states
  const [selectedOperator, setSelectedOperator] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'internet' | 'minute' | 'bundle'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Helpline states
  const [showHelplineModal, setShowHelplineModal] = useState(false);
  const [copiedHelpline, setCopiedHelpline] = useState(false);

  // Purchase overlay states
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [recipientNumber, setRecipientNumber] = useState('');
  const [inputPin, setInputPin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  // States for localized transaction history
  const [txHistory, setTxHistory] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [showSectionTxHistory, setShowSectionTxHistory] = useState(false);
  const [txModalSearch, setTxModalSearch] = useState('');

  const fetchTxHistory = async () => {
    setLoadingTx(true);
    try {
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const list: Transaction[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Transaction);
      });
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setTxHistory(list);
    } catch (e) {
      console.error("Error fetching telecom tx:", e);
    } finally {
      setLoadingTx(false);
    }
  };

  // Cash Recharge state (Form modal mode)
  const [showCashRecharge, setShowCashRecharge] = useState(false);
  const [showMoneyExchange, setShowMoneyExchange] = useState(false);
  const [showAddBalanceModal, setShowAddBalanceModal] = useState(false); // NEW
  const [addBalanceAmount, setAddBalanceAmount] = useState(''); // NEW
  const [addBalancePin, setAddBalancePin] = useState(''); // NEW
  const [cashRechargeAmount, setCashRechargeAmount] = useState('');
  const [cashRechargeOperator, setCashRechargeOperator] = useState('');
  const [cashRecipientNumber, setCashRecipientNumber] = useState('');
  const [cashRechargePin, setCashRechargePin] = useState('');

  // Daily Bonus tracker
  const [dailyBonusClaimed, setDailyBonusClaimed] = useState(false);
  const [bonusText, setBonusText] = useState('');

  // Full-Screen Transaction Receipt Modal State
  const [receiptModalData, setReceiptModalData] = useState<PaymentReceiptData | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  const openReceiptForTx = (tx: any) => {
    let label = tx.typeLabel || 'মোবাইল রিচার্জ';
    if (tx.packTitle) label = `ড্রাইভ প্যাক (${tx.operator || ''})`;
    setReceiptModalData({
      typeLabel: label,
      transactionId: formatShortTrxId(tx.transactionId || tx.trxId || tx.id),
      amount: tx.amount || 0,
      fee: 0,
      totalAmount: tx.amount || 0,
      status: tx.status || 'pending',
      beneficiaryName: tx.userName || user.name || 'BNB সদস্য',
      beneficiaryAccount: tx.memberId || user.memberId || user.phone,
      senderPhone: tx.phone || tx.receiverPhone || user.phone || 'N/A',
      description: tx.description,
      paymentMethod: tx.operator || tx.paymentMethod,
      transactionDate: tx.createdAt ? new Date(tx.createdAt).toLocaleString('bn-BD', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true
      }) : new Date().toLocaleString('en-US')
    });
    setIsReceiptOpen(true);
  };

  const closeTelecomModals = () => {
    let closed = false;
    if (isReceiptOpen) { setIsReceiptOpen(false); closed = true; }
    if (selectedOffer) { setSelectedOffer(null); setPurchaseError(''); setPurchaseSuccess(false); closed = true; }
    if (showSectionTxHistory) { setShowSectionTxHistory(false); closed = true; }
    if (showCashRecharge) { setShowCashRecharge(false); closed = true; }
    if (showMoneyExchange) { setShowMoneyExchange(false); closed = true; }
    if (showAddBalanceModal) { setShowAddBalanceModal(false); closed = true; }
    return closed;
  };

  const activeModalCount = [
    Boolean(selectedOffer),
    Boolean(showSectionTxHistory),
    Boolean(showCashRecharge),
    Boolean(showMoneyExchange),
    Boolean(showAddBalanceModal)
  ].filter(Boolean).length;

  const prevModalCountRef = React.useRef(activeModalCount);
  useEffect(() => {
    if (activeModalCount > prevModalCountRef.current) {
      window.history.pushState({ dashboardModal: 'telecom', level: 'modal' }, '');
    }
    prevModalCountRef.current = activeModalCount;
  }, [activeModalCount]);

  // BNB Telecom Internal Back Handler
  useBackHandler(() => {
    const modalClosed = closeTelecomModals();
    if (modalClosed) return true;
    if (activeSubView !== 'main') {
      setActiveSubView('main');
      return true;
    }
    return false;
  }, true, 25);

  // Base list of offers (combines Firestore offers with beautiful high fidelity fallback presets)
  const fallbackPresets: Offer[] = [
    { id: 'p1', title: '50GB INTERNET (Family Pack)', operator: 'Grameenphone', category: 'internet', validity: '30 Days', price: 615, isHot: true, createdAt: '' },
    { id: 'p2', title: '100GB INTERNET (Family Extra)', operator: 'Grameenphone', category: 'internet', validity: '30 Days', price: 745, isHot: true, createdAt: '' },
    { id: 'p3', title: '500 MARVEL MINUTES', operator: 'Airtel', category: 'minute', validity: '30 Days', price: 270, isHot: true, createdAt: '' },
    { id: 'p4', title: '৳1000 RECHARGE SPECIAL TARIFF', operator: 'Alaap', category: 'bundle', validity: 'UNLIMITED', price: 1000, isHot: true, createdAt: '' },
    { id: 'p5', title: '1 জিবি স্পেশাল ক্লাউড প্যাক', operator: 'Robi', category: 'internet', validity: '3 দিন', price: 39, isHot: false, createdAt: '' },
    { id: 'p6', title: '5 জিবি স্পাদাহ ইন্টারনেট', operator: 'Robi', category: 'internet', validity: '7 দিন', price: 129, isHot: false, createdAt: '' },
    { id: 'p7', title: '10 জিবি ইন্টারনেট ও ট্যালেন্ট', operator: 'Banglalink', category: 'internet', validity: '30 দিন', price: 349, isHot: false, createdAt: '' },
    { id: 'p8', title: '30 জিবি সুপার আল্ট্রা প্যাক', operator: 'Banglalink', category: 'internet', validity: '30 দিন', price: 599, isHot: false, createdAt: '' },
    { id: 'p9', title: '200 মিনিট সুপার টকটাইম', operator: 'Teletalk', category: 'minute', validity: '15 দিন', price: 110, isHot: false, createdAt: '' },
    { id: 'p10', title: '500 মিনিট ধামাকা অফার প্যাক', operator: 'Banglalink', category: 'minute', validity: '30 দিন', price: 298, isHot: true, createdAt: '' },
    { id: 'p11', title: '20 জিবি ধামাকা ইন্টারনেট', operator: 'Skitto', category: 'internet', validity: '30 দিন', price: 249, isHot: true, createdAt: '' }
  ];

  // Merge Firestore offers and filter duplicates
  const finalOffersList = [...allOffers];
  if (finalOffersList.length === 0) {
    finalOffersList.push(...fallbackPresets);
  }

  // Filter list by selected operator and category (Memoized for zero lag on category and operator click)
  const filteredOffers = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return finalOffersList.filter((off) => {
      const matchesOp = selectedOperator === 'all' || off.operator.toLowerCase() === selectedOperator.toLowerCase();
      const matchesCat = selectedCategory === 'all' || off.category === selectedCategory;
      if (!matchesOp || !matchesCat) return false;
      if (!q) return true;
      return (off.title && off.title.toLowerCase().includes(q)) || (off.operator && off.operator.toLowerCase().includes(q));
    });
  }, [finalOffersList, selectedOperator, selectedCategory, searchQuery]);

  const handleClaimDailyBonus = async () => {
    if (dailyBonusClaimed) {
      setBonusText('আপনি আজকের বোনাসটি ইতিমধ্যে সংগ্রহ করেছেন!');
      return;
    }
    
    // Grant ৳5.00 daily bonus to user instantly
    try {
      const updatedBalance = (user.balance || 0) + 5;
      user.balance = updatedBalance; // Optimistic update
      (user as any).mainBalance = updatedBalance;

      const txId = `tx-bonus-${Date.now()}`;
      const newTx: Transaction = {
        id: txId,
        userId: user.uid,
        userName: user.name,
        memberId: user.memberId,
        type: 'interest',
        typeLabel: 'ডেইলি বোনাস',
        amount: 5,
        status: 'success',
        description: 'BNB টেলিকম ডেইলি বোনাস (৳5.00) সফলভাবে মেইন ওয়ালেটে যুক্ত হয়েছে।',
        createdAt: new Date().toISOString()
      };

      setDailyBonusClaimed(true);
      setBonusText('অভিনন্দন! আপনার মেইন ওয়ালেটে ৳5.00 বোনাস সফলভাবে যুক্ত করা হয়েছে।');
      syncLiveProfile();

      // Atomic Firestore updates
      const userRef = doc(db, 'users', user.uid);
      runTransaction(db, async (t) => {
        const uSnap = await t.get(userRef);
        if (!uSnap.exists()) return;
        const nextBal = getEffectiveBalance(uSnap.data()) + 5;
        t.update(userRef, { balance: nextBal, mainBalance: nextBal });
      }).catch(console.error);
      setDoc(doc(db, 'transactions', newTx.id), newTx, { merge: true }).catch(console.error);
    } catch (err) {
      console.error(err);
      setBonusText('বোনাস ক্লেইম ব্যর্থ হয়েছে। পরে চেষ্টা করুন!');
    }
  };

  const handleOpenPurchase = (offer: Offer) => {
    setSelectedOffer(offer);
    setRecipientNumber('');
    setInputPin('');
    setPurchaseError('');
    setPurchaseSuccess(false);
  };

  const handleConfirmPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setPurchaseError('');
    
    if (!selectedOffer) return;

    const cleanNumber = recipientNumber.trim();
    const isNumeric = /^\d+$/.test(cleanNumber);
    if (!cleanNumber || cleanNumber.length !== 11 || !isNumeric) {
      setPurchaseError('অনুগ্রহ করে সঠিক 11 ডিজিটের প্রাপক মোবাইল নম্বর দিন (মেম্বার আইডি বা অক্ষর গ্রহণযোগ্য নয়)।');
      return;
    }

    if (!verifyUserPin(user, inputPin)) {
      setPurchaseError('ভুল সিকিউরিটি পিন নম্বর! পুনরায় সঠিক পিন দিন।');
      return;
    }

    if (getEffectiveBalance(user) < selectedOffer.price) {
      setPurchaseError('আপনার মেইন ওয়ালেট ব্যালেন্স পর্যাপ্ত নয়! দয়া করে মেইন ড্যাশবোর্ড থেকে টাকা জমা বা রিচার্জ করে ব্যালেন্স বাড়ান।');
      return;
    }

    try {
      setIsProcessing(true);

      const res = await fetch(apiUrl('/api/recharge'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          number: cleanNumber,
          operator: selectedOffer.operator,
          type: 'prepaid',
          amount: selectedOffer.price,
          package_id: (selectedOffer as any).driveId || selectedOffer.id,
          pin: inputPin,
          accountNumber: user.memberId || user.phone
        })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data || data.success === false) {
        throw new Error(data?.error || data?.message || 'সার্ভার থেকে ড্রাইভ অফার রিচার্জ সম্পূর্ণ করা যায়নি।');
      }

      const remainingBalance = Math.max(0, getEffectiveBalance(user) - selectedOffer.price);
      user.balance = remainingBalance;
      (user as any).mainBalance = remainingBalance;

      setPurchaseSuccess(true);
      setIsProcessing(false);
      syncLiveProfile();

      const ambTrxId = data.trxid || generateBNBTrxId('ST');
      setReceiptModalData({
        typeLabel: `ড্রাইভ অফার রিচার্জ (${selectedOffer.operator})`,
        transactionId: ambTrxId,
        amount: selectedOffer.price,
        fee: 0,
        totalAmount: selectedOffer.price,
        status: 'pending',
        beneficiaryName: user.name,
        beneficiaryAccount: user.memberId || user.phone,
        senderPhone: cleanNumber,
        paymentMethod: `${selectedOffer.operator} (Success TopUp API)`,
        description: `${selectedOffer.operator} নম্বরে (${cleanNumber}) "${selectedOffer.title}" ৳${selectedOffer.price} টাকা অটো ড্রাইভ রিচার্জ প্রসেসিংয়ে রয়েছে।`,
        transactionDate: new Date().toLocaleString('bn-BD', {
          day: 'numeric',
          month: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          second: 'numeric',
          hour12: true
        })
      });
      setSelectedOffer(null);
      setPurchaseSuccess(false);
      setIsReceiptOpen(true);
    } catch (err: any) {
      console.error(err);
      setPurchaseError(`অটো ড্রাইভ রিচার্জ প্রসেসে ত্রুটিঃ ${err?.message || 'সার্ভার সাড়াদান করছে না'}`);
      setIsProcessing(false);
    }
  };

  const handleCashRechargeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPurchaseError('');

    if (!cashRechargeOperator) {
      setPurchaseError('দয়া করে আগে রিচার্জ অপারেটর নির্বাচন করুন।');
      return;
    }

    const reloadAmt = Number(cashRechargeAmount);
    if (!reloadAmt || reloadAmt < 10) {
      setPurchaseError('সর্বনিম্ন ক্যাশ রিচার্জ 10 টাকা হতে হবে।');
      return;
    }

    const cleanCashNumber = cashRecipientNumber.trim();
    const isNumeric = /^\d+$/.test(cleanCashNumber);
    if (!cleanCashNumber || cleanCashNumber.length !== 11 || !isNumeric) {
      setPurchaseError('11 ডিজিটের সঠিক মোবাইল নম্বর লিখুন (মেম্বার আইডি বা অক্ষর গ্রহণযোগ্য নয়)।');
      return;
    }

    if (!verifyUserPin(user, cashRechargePin)) {
      setPurchaseError('ভুল সিকিউরিটি পিন নম্বর! পুনরায় সঠিক পিন দিন।');
      return;
    }

    if (getEffectiveBalance(user) < reloadAmt) {
      setPurchaseError('অপর্যাপ্ত মেইন ওয়ালেট ব্যালেন্স! দয়া করে ড্যাশবোর্ড বা হোম পেজ থেকে ওয়ালেট ব্যালেন্স রিচার্জ করুন।');
      return;
    }

    try {
      const rate = ['Alaap', 'Brilliant'].includes(cashRechargeOperator)
        ? 0
        : (user.customTelecomPercent !== undefined && user.customTelecomPercent > 0
            ? user.customTelecomPercent
            : (appConfig?.mobileRechargePercent ?? 2.0));

      const commission = (reloadAmt * rate) / 100;
      const remainingBalance = getEffectiveBalance(user) - reloadAmt + commission;
      user.balance = remainingBalance; // ⚡ Instant optimistic balance update
      (user as any).mainBalance = remainingBalance;

      const rules = appConfig?.rechargeCashbackRules || [];
      const matchedCashback = getMatchedCashbackForRule(rules, reloadAmt, cashRechargeOperator);

      const ambTrxId = generateBNBTrxId('BN');
      const txId = `tx-cash-${ambTrxId}`;
      const typeLabel = cashRechargeOperator === 'Alaap' 
        ? 'আলাপ রিচার্জ' 
        : cashRechargeOperator === 'Brilliant' 
          ? 'ব্রিলিয়ান্ট রিচার্জ' 
          : 'মোবাইল রিচার্জ';

      let description = ['Alaap', 'Brilliant'].includes(cashRechargeOperator)
        ? `${cashRechargeOperator} vVoIP নম্বরে (${cashRecipientNumber}) ৳${reloadAmt} রিচার্জের আবেদন করা হয়েছে (৳${commission.toFixed(2)} টাকা লভ্যাংশ কমিশন অনুমোদন শেষে যুক্ত করা হবে)। অ্যাডমিন ভেরিফিকেশন পেন্ডিং রয়েছে।`
        : `${cashRechargeOperator} নম্বরে (${cashRecipientNumber}) ৳${reloadAmt} ক্যাশ রিচার্জের আবেদন করা হয়েছে (৳${commission.toFixed(2)} টাকা লভ্যাংশ কমিশন অনুমোদন শেষে যুক্ত করা হবে)। অ্যাডমিন ভেরিফিকেশন পেন্ডিং রয়েছে।`;

      if (matchedCashback > 0) {
        description += ` (স্পেশাল ক্যাশব্যাক অফারঃ ৳${matchedCashback} টাকা)`;
      }
          
      const newTx: Transaction = {
        id: txId,
        transactionId: ambTrxId,
        receiptNo: ambTrxId,
        userId: user.uid,
        userName: user.name,
        memberId: user.memberId,
        type: 'telecom_recharge',
        typeLabel: typeLabel,
        amount: reloadAmt,
        status: 'pending',
        description: description,
        createdAt: new Date().toISOString(),
        rechargeCommission: commission,
        rechargeCashback: matchedCashback,
        phone: cleanCashNumber,
        receiverPhone: cleanCashNumber,
        paymentMethod: cashRechargeOperator,
        operator: cashRechargeOperator
      } as any;

      // ⚡ INSTANT SUCCESS RESPONSE - NO WAITING/SPINNING!
      setPurchaseSuccess(true);
      setIsProcessing(false);
      syncLiveProfile();
      
      // Async background save to Firestore via atomic transaction
      (async () => {
        try {
          const userRef = doc(db, 'users', user.uid);
          await runTransaction(db, async (t) => {
            const uSnap = await t.get(userRef);
            if (!uSnap.exists()) return;
            const liveBal = getEffectiveBalance(uSnap.data());
            const nextBal = Math.max(0, liveBal - reloadAmt + commission);
            t.update(userRef, { balance: nextBal, mainBalance: nextBal });
          });
          await setDoc(doc(db, 'transactions', newTx.id), newTx, { merge: true });
          addDoc(collection(db, 'admin_notifications'), {
            title: '⚡ নতুন মোবাইল রিচার্জ আবেদন',
            message: `${user.name || 'সদস্য'} (${user.memberId || 'N/A'}) ${cashRechargeOperator} নম্বরে (${cleanCashNumber}) ৳${reloadAmt} টাকা ক্যাশ রিচার্জের আবেদন করেছেন।`,
            userId: user.uid,
            userName: user.name || '',
            memberId: user.memberId || '',
            recipientPhone: cleanCashNumber,
            operator: cashRechargeOperator,
            amount: reloadAmt,
            type: 'telecom_recharge',
            read: false,
            createdAt: new Date().toISOString()
          }).catch(e => console.warn('Admin notif error:', e));
        } catch (dbErr) {
          console.error("Firestore cash recharge save error:", dbErr);
        }
      })();

      // Show Full-Screen Transaction Receipt Modal
      setReceiptModalData({
        typeLabel: typeLabel,
        transactionId: ambTrxId,
        amount: reloadAmt,
        fee: 0,
        totalAmount: reloadAmt,
        status: 'pending',
        beneficiaryName: user.name,
        beneficiaryAccount: user.memberId || user.phone,
        senderPhone: cleanCashNumber,
        paymentMethod: cashRechargeOperator,
        description: description,
        transactionDate: new Date().toLocaleString('bn-BD', {
          day: 'numeric',
          month: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          second: 'numeric',
          hour12: true
        })
      });
      setShowCashRecharge(false);
      setCashRechargeAmount('');
      setCashRecipientNumber('');
      setCashRechargePin('');
      setPurchaseSuccess(false);
      setIsReceiptOpen(true);
    } catch (err: any) {
      console.error(err);
      setPurchaseError(`মোবাইল রিচার্জ সম্পন্নকরণ ব্যর্থ হয়েছে`);
      setIsProcessing(false);
    }
  };

  const categoryTabList = [
    { id: 'all', name: 'সকল অফার' },
    { id: 'internet', name: 'ডাটা প্যাক' },
    { id: 'minute', name: 'মিনিট প্যাক' },
    { id: 'bundle', name: 'বান্ডেল অফার' }
  ];

  const operatorList = [
    { id: 'all', name: 'সব অপারেটর', color: 'from-slate-700 to-slate-800' },
    ...(appConfig?.telecomCategories?.map((tc, _idx) => ({
      id: tc.id,
      name: tc.label,
      color: tc.id === 'Grameenphone' ? 'from-blue-500 to-sky-600' :
             tc.id === 'Robi' ? 'from-red-500 to-orange-600' :
             tc.id === 'Airtel' ? 'from-rose-600 to-red-700' :
             tc.id === 'Banglalink' ? 'from-orange-500 to-amber-600' :
             tc.id === 'Teletalk' ? 'from-emerald-600 to-green-700' :
             tc.id === 'Brilliant' ? 'from-purple-500 to-indigo-600' :
             tc.id === 'Alaap' ? 'from-slate-700 to-slate-900' :
             'from-slate-700 to-slate-800'
    })) || [
      { id: 'Grameenphone', name: 'GP', color: 'from-blue-500 to-sky-600' },
      { id: 'Robi', name: 'Robi', color: 'from-red-500 to-orange-600' },
      { id: 'Airtel', name: 'Airtel', color: 'from-rose-600 to-red-700' },
      { id: 'Banglalink', name: 'Banglalink', color: 'from-orange-500 to-amber-600' },
      { id: 'Teletalk', name: 'Teletalk', color: 'from-emerald-600 to-green-700' },
      { id: 'Skitto', name: 'Skitto', color: 'from-yellow-400 to-orange-500' },
      { id: 'Brilliant', name: 'Brilliant', color: 'from-purple-500 to-indigo-600' },
      { id: 'Alaap', name: 'Alaap', color: 'from-slate-700 to-slate-900' }
    ])
  ];

  return (
    <div className="min-h-screen bg-[#0b6623] text-slate-850 font-sans flex flex-col relative" id="telecom-screen-root">
      
      {/* Dynamic Green Top Header */}
      <header className="bg-gradient-to-b from-[#0b6623] via-[#005a36] to-[#004d1a] text-white px-3.5 pt-safe pb-2.5 rounded-b-[28px] shadow-sm border-b border-emerald-700/60 relative overflow-hidden z-20 space-y-2.5">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <UnifiedBackButton
              onClick={handleBack}
              variant="dark"
              title="পিছনে যান"
            />
            <div className="text-left">
              <h1 className="text-xs xs:text-sm font-black flex items-center gap-1 text-white">
                <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                BNB টেলিকম
              </h1>
              <p className="text-[8px] xs:text-[9.5px] text-emerald-200 font-mono leading-none">ID: {user.memberId}</p>
            </div>
          </div>

          {/* Grouped Header Actions */}
          <div className="flex items-center gap-1.5">
            {/* Admin Switcher for Admins & Sub-Admins */}
            {(user.role === 'admin' || user.role === 'sub_admin') && (
              <button
                onClick={() => setActiveSubView(activeSubView === 'admin' ? 'main' : 'admin')}
                className={`flex items-center gap-1 px-2 xs:px-2.5 py-1 xs:py-1.5 rounded-xl text-[10px] font-black transition cursor-pointer shrink-0 shadow-3xs active:scale-95 ${
                  activeSubView === 'admin'
                    ? 'bg-amber-500 text-white border border-amber-600'
                    : 'bg-gradient-to-r from-purple-900 to-indigo-900 text-amber-300 border border-purple-700 hover:brightness-110'
                }`}
                title="টেলিকম এডমিন কন্ট্রোল"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                <span className="font-sans hidden sm:inline">{activeSubView === 'admin' ? 'ইউজার মোড' : 'এডমিন'}</span>
              </button>
            )}

            {/* Main Balance */}
            <div 
              onClick={syncLiveProfile}
              className="flex items-center gap-1 bg-black/20 border border-white/20 px-2.5 py-1 rounded-full text-[10px] font-bold text-white select-none cursor-pointer transition active:scale-95 shrink-0"
              title="মেইন ব্যালেন্স রিফ্রেশ করতে ক্লিক করুন"
            >
              <span className="text-[8px] text-emerald-200 uppercase font-extrabold">মেইনঃ</span>
              <span className="font-mono text-[10px] font-bold">৳{user.balance?.toLocaleString() || '0'}</span>
            </div>

            {/* Transaction History Button */}
            <button
              onClick={() => {
                fetchTxHistory();
                setShowSectionTxHistory(true);
              }}
              className="p-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg border border-white/20 transition cursor-pointer shrink-0 active:scale-95"
              title="লেনদেনের হিস্ট্রি"
            >
              <ClipboardList className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>

        {/* Announcement Ticker (ঘোষণা) */}
        <div className="flex items-center gap-2.5 overflow-hidden w-full pt-1 px-0.5 relative z-10">
          <div className="bg-white text-[#005a36] text-[10.5px] font-black px-3 py-1 rounded-full shrink-0 shadow-xs flex items-center gap-1">
            <span>ঘোষণা</span>
          </div>
          <div className="flex-grow overflow-hidden relative mr-1">
            <marquee className="text-[12px] font-bold text-white leading-none py-0.5 tracking-wide" behavior="scroll" direction="left" scrollamount="4">
              {appConfig?.telecomTicker || "BNB টেলিকমে স্বাগতম। ইনস্ট্যান্ট ২৫ পয়সা সাশ্রয়ে মিনিট ও ডাটা প্যাক কিনুন ২০০ টাকা পর্যন্ত ক্যাশব্যাক অফারে।"}
            </marquee>
          </div>
        </div>
      </header>

      {/* Main Stream list */}
      {activeSubView === 'admin' && (user.role === 'admin' || user.role === 'sub_admin') ? (
        <div className="flex-1 overflow-y-auto px-4 py-6 w-full max-w-4xl mx-auto">
          <TelecomAdmin 
            appConfig={appConfig || {} as any} 
            user={user} 
            onClose={() => setActiveSubView('main')} 
          />
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-8 max-w-md w-full mx-auto">
        
        {(() => {
          const telecomNotices = allNotices.filter(n => n.section === 'telecom');
          if (telecomNotices.length === 0) return null;
          return (
            <div className="space-y-2">
              {telecomNotices.map((n, idx) => (
                <div key={`${n.id}-${idx}`} className="bg-purple-50 border border-purple-155 p-3.5 rounded-2xl text-left relative overflow-hidden shadow-3xs">
                  <div className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-xs shrink-0 mt-0.5">📢</span>
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-black text-purple-900 leading-snug">{n.title}</h4>
                      <p className="text-[11px] text-purple-800 font-bold leading-normal">{n.content}</p>
                      <span className="text-[8.5px] text-purple-400 font-mono block pt-0.5">{new Date(n.createdAt).toLocaleDateString('bn-BD')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* WAVE/GRADIENT CONTAINER - SLEEK, THIN & COMPACT */}
        <div className="bg-gradient-to-br from-indigo-700 via-violet-800 to-purple-900 rounded-2xl p-2.5 shadow-xl border border-indigo-500/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.25),transparent)] pointer-events-none" />
          
          {/* Four Focused Action Sections: Mobile, Alaap, Brilliant, Money Exchange */}
          {(() => {
            const getServiceConfig = (key: string, defaultTitle: string, defaultIcon: string) => {
              const custom = appConfig?.telecomServicesConfig?.[key];
              return {
                title: custom?.title || defaultTitle,
                icon: custom?.icon || defaultIcon,
                subtitle: custom?.subtitle || '',
                isActive: custom?.isActive !== false
              };
            };

            const mobConfig = getServiceConfig('mobile_recharge', 'মোবাইল রিচার্জ', '📱');
            const alaapConfig = getServiceConfig('alaap_recharge', 'আলাপ রিচার্জ', '📞');
            const brilliantConfig = getServiceConfig('brilliant_recharge', 'ব্রিলিয়ান্ট রিচার্জ', '🌐');
            const exchangeConfig = getServiceConfig('money_exchange', 'মানি এক্সচেঞ্জ', '💸');

            const renderIcon = (iconStr: string) => {
              if (iconStr.startsWith('http://') || iconStr.startsWith('https://') || iconStr.startsWith('data:')) {
                return <img src={iconStr} alt="Logo" className="w-5 h-5 object-contain rounded-md" />;
              }
              return <span className="text-base">{iconStr}</span>;
            };

            return (
              <div className="grid grid-cols-4 gap-2 relative z-10">
                {mobConfig.isActive && (
                  <button
                    onClick={() => {
                      setCashRechargeOperator('');
                      setCashRecipientNumber('');
                      setCashRechargeAmount('');
                      setCashRechargePin('');
                      setPurchaseError('');
                      setPurchaseSuccess(false);
                      setShowCashRecharge(true);
                    }}
                    className="py-2.5 px-1 bg-white hover:bg-slate-50 text-indigo-950 font-black rounded-xl text-[10.5px] transition-all cursor-pointer shadow-md text-center flex flex-col items-center justify-center gap-1 active:scale-95 border border-white/15"
                  >
                    {renderIcon(mobConfig.icon)}
                    <span className="font-bold tracking-tight text-[10px] line-clamp-1">{mobConfig.title}</span>
                  </button>
                )}
                {alaapConfig.isActive && (
                  <button
                    onClick={() => {
                      setCashRechargeOperator('Alaap');
                      setCashRecipientNumber('');
                      setCashRechargeAmount('');
                      setCashRechargePin('');
                      setPurchaseError('');
                      setPurchaseSuccess(false);
                      setShowCashRecharge(true);
                    }}
                    className="py-2.5 px-1 bg-indigo-500/35 hover:bg-indigo-500/50 border border-indigo-400/20 text-indigo-50 font-black rounded-xl text-[10.5px] transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-1 active:scale-95"
                  >
                    {renderIcon(alaapConfig.icon)}
                    <span className="font-bold tracking-tight text-[10px] line-clamp-1">{alaapConfig.title}</span>
                  </button>
                )}
                {brilliantConfig.isActive && (
                  <button
                    onClick={() => {
                      setCashRechargeOperator('Brilliant');
                      setCashRecipientNumber('');
                      setCashRechargeAmount('');
                      setCashRechargePin('');
                      setPurchaseError('');
                      setPurchaseSuccess(false);
                      setShowCashRecharge(true);
                    }}
                    className="py-2.5 px-1 bg-indigo-500/35 hover:bg-indigo-500/50 border border-indigo-400/20 text-indigo-50 font-black rounded-xl text-[10.5px] transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-1 active:scale-95"
                  >
                    {renderIcon(brilliantConfig.icon)}
                    <span className="font-bold tracking-tight text-[10px] line-clamp-1">{brilliantConfig.title}</span>
                  </button>
                )}
                {exchangeConfig.isActive && (
                  <button
                    onClick={() => {
                      setShowMoneyExchange(true);
                    }}
                    className="py-2.5 px-1 bg-indigo-500/35 hover:bg-indigo-500/50 border border-indigo-400/20 text-indigo-50 font-black rounded-xl text-[10.5px] transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-1 active:scale-95"
                  >
                    {renderIcon(exchangeConfig.icon)}
                    <span className="font-bold tracking-tight text-[10px] line-clamp-1">{exchangeConfig.title}</span>
                  </button>
                )}
              </div>
            );
          })()}
        </div>

        {/* Daily bonus toast notification */}
        <AnimatePresence>
          {showMoneyExchange && (
            <div className="fixed inset-0 z-50 bg-white flex flex-col">
              <div className="h-10 shrink-0 bg-[#004a2c] w-full"></div>
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="flex-1 overflow-y-auto bg-white"
              >
                <MoneyExchangeModule 
                  user={user} 
                  onClose={() => setShowMoneyExchange(false)} 
                  syncLiveProfile={syncLiveProfile} 
                  appConfig={appConfig}
                />
              </motion.div>
            </div>
          )}
          {bonusText && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-indigo-50 border border-indigo-150 p-3.5 rounded-2xl text-xs font-semibold leading-relaxed text-indigo-800 flex justify-between items-center shadow-3xs"
            >
              <p>{bonusText}</p>
              <button onClick={() => setBonusText('')} className="p-1 hover:bg-indigo-100 text-indigo-600 rounded-full">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PROMO AND CAUTION SECTIONS REMOVED */}

        {/* QUICK ACTIONS FINTECH CONTAINER */}
        {(() => {
          const getServiceConfig = (key: string, defaultTitle: string, defaultIcon: string) => {
            const custom = appConfig?.telecomServicesConfig?.[key];
            return {
              title: custom?.title || defaultTitle,
              icon: custom?.icon || defaultIcon,
              isActive: custom?.isActive !== false
            };
          };

          const dataConfig = getServiceConfig('data_pack', 'ডাটা প্যাক', '🌐');
          const minuteConfig = getServiceConfig('minute_pack', 'মিনিট প্যাক', '📞');
          const builderConfig = getServiceConfig('pack_builder', 'প্যাক বিল্ডার', '🎁');
          const rawAddConfig = getServiceConfig('balance_add', 'হেল্পলাইন', '🎧');
          const addConfig = {
            ...rawAddConfig,
            title: (rawAddConfig.title && rawAddConfig.title !== 'ব্যালেন্স এড') ? rawAddConfig.title : 'হেল্পলাইন',
            icon: (rawAddConfig.icon && rawAddConfig.icon !== '💰') ? rawAddConfig.icon : '🎧'
          };

          const renderQuickIcon = (iconStr: string, bgClass: string) => {
            if (iconStr.startsWith('http://') || iconStr.startsWith('https://') || iconStr.startsWith('data:')) {
              return (
                <div className={`w-8 h-8 rounded-full ${bgClass} flex items-center justify-center overflow-hidden p-1`}>
                  <img src={iconStr} alt="Icon" className="w-full h-full object-contain" />
                </div>
              );
            }
            return (
              <div className={`w-8 h-8 rounded-full ${bgClass} flex items-center justify-center text-sm`}>
                {iconStr}
              </div>
            );
          };

          return (
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">কুইক অ্যাকশনস</h3>
              <div className="grid grid-cols-4 gap-2.5">
                {dataConfig.isActive && (
                  <button
                    onClick={() => { setSelectedCategory('internet'); setSelectedOperator('all'); }}
                    className="bg-white border border-slate-200 hover:border-indigo-500 p-2.5 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 transition-all text-slate-700 hover:text-indigo-700 cursor-pointer active:scale-95 shadow-3xs hover:shadow-xs"
                  >
                    {renderQuickIcon(dataConfig.icon, 'bg-indigo-500/10')}
                    <span className="text-[9px] font-extrabold font-sans line-clamp-1">{dataConfig.title}</span>
                  </button>
                )}
                {minuteConfig.isActive && (
                  <button
                    onClick={() => { setSelectedCategory('minute'); setSelectedOperator('all'); }}
                    className="bg-white border border-slate-200 hover:border-indigo-500 p-2.5 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 transition-all text-slate-700 hover:text-indigo-700 cursor-pointer active:scale-95 shadow-3xs hover:shadow-xs"
                  >
                    {renderQuickIcon(minuteConfig.icon, 'bg-amber-500/10')}
                    <span className="text-[9px] font-extrabold font-sans line-clamp-1">{minuteConfig.title}</span>
                  </button>
                )}
                {builderConfig.isActive && (
                  <button
                    onClick={() => { setSelectedCategory('bundle'); setSelectedOperator('all'); }}
                    className="bg-white border border-slate-200 hover:border-indigo-500 p-2.5 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 transition-all text-slate-700 hover:text-indigo-700 cursor-pointer active:scale-95 shadow-3xs hover:shadow-xs"
                  >
                    {renderQuickIcon(builderConfig.icon, 'bg-emerald-500/10')}
                    <span className="text-[9px] font-extrabold font-sans line-clamp-1">{builderConfig.title}</span>
                  </button>
                )}
                {addConfig.isActive && (
                  <button
                    onClick={() => setShowHelplineModal(true)}
                    className="bg-white border border-slate-200 hover:border-indigo-500 p-2.5 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 transition-all text-slate-700 hover:text-indigo-700 cursor-pointer active:scale-95 shadow-3xs hover:shadow-xs"
                  >
                    {renderQuickIcon(addConfig.icon, 'bg-purple-500/10')}
                    <span className="text-[9px] font-extrabold font-sans line-clamp-1">{addConfig.title}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* CATEGORY OPERATORS CHOICES LIST */}
        <div className="space-y-2.5 overflow-hidden">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">নেটওয়ার্ক অপারেটর ক্যাটাগরি</h3>
          <div className="flex gap-2 pb-1 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
            {operatorList.map((op, idx) => {
              const isSelected = selectedOperator.toLowerCase() === op.id.toLowerCase();
              return (
                <button
                  key={`${op.id}-${idx}`}
                  onClick={() => setSelectedOperator(op.id)}
                  className={`px-3.5 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 border uppercase tracking-wider ${
                    isSelected 
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white border-indigo-500 ring-2 ring-indigo-500/30' 
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-350 hover:text-slate-800 shadow-3xs'
                  }`}
                >
                  {op.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* SEARCH & TICKETS SUB-TAB HEADER */}
        <div className="flex bg-slate-200/60 rounded-xl p-1 border border-slate-200/80 flex-wrap sm:flex-nowrap shadow-3xs">
          {categoryTabList.map((tab, idx) => {
            const isSelected = selectedCategory === tab.id;
            return (
              <button
                key={`${tab.id}-${idx}`}
                onClick={() => setSelectedCategory(tab.id as any)}
                className={`flex-1 py-1 px-2.5 text-center text-[10.5px] font-black rounded-lg transition-all cursor-pointer ${
                  isSelected ? 'bg-white text-indigo-705 shadow-3xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.name}
              </button>
            );
          })}
        </div>

        {/* FILTER SEARCH INPUT BOX */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="অপারেশন বা ধামাকা প্যাক খুঁজুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-sans font-bold shadow-3xs"
          />
        </div>

        {/* TODAY'S HOT DHAMAKA OFFERS LIST */}
        <div className="space-y-3">
          <div className="flex justify-between items-center px-0.5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">আজকের হট ধামাকা অফার</h3>
            <span className="text-[9.5px] bg-rose-50 text-rose-600 border border-rose-100 font-black px-2 py-0.5 rounded-full">
              LIVE RATES
            </span>
          </div>

          <div className="space-y-2.5">
            {filteredOffers.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-3xl border border-slate-200 p-6 space-y-2 shadow-3xs">
                <p className="text-xs text-slate-500">এই অপারেটর বা ফিল্টারের জন্য বর্তমানে কোনো অফার পাওয়া যায়নি।</p>
                <button 
                  onClick={() => { setSelectedOperator('all'); setSelectedCategory('all'); setSearchQuery(''); }}
                  className="text-[10px] text-indigo-600 hover:underline font-extrabold"
                >
                  সব ফিল্টার রিসেট করুন
                </button>
              </div>
            ) : (
              filteredOffers.map((off, idx) => {
                // Get custom branding class
                let brandColor = 'bg-blue-500 text-white';
                if (off.operator.toLowerCase() === 'robi') brandColor = 'bg-red-500 text-white';
                if (off.operator.toLowerCase() === 'airtel') brandColor = 'bg-rose-500 text-white';
                if (off.operator.toLowerCase() === 'banglalink') brandColor = 'bg-orange-500 text-white';
                if (off.operator.toLowerCase() === 'teletalk') brandColor = 'bg-emerald-600 text-white';
                if (off.operator.toLowerCase() === 'skitto') brandColor = 'bg-yellow-400 text-slate-900';
                if (off.operator.toLowerCase() === 'alaap' || off.operator.toLowerCase() === 'brilliant') brandColor = 'bg-purple-600 text-white';

                return (
                  <div 
                    key={`${off.id}-${idx}`}
                    className="bg-white border border-slate-150 p-4 rounded-3xl flex items-center justify-between gap-4 transition-all hover:bg-slate-50 hover:border-slate-200 shadow-3xs"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[8.5px] font-black px-2 py-0.5 rounded-md uppercase tracking-wide shrink-0 ${brandColor}`}>
                          {off.operator}
                        </span>
                        {off.isHot && (
                          <span className="text-[8.5px] bg-rose-50 text-rose-600 font-extrabold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 border border-rose-100">
                            🔥 HOT
                          </span>
                        )}
                        <span className="text-[8.5px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded-md border border-slate-200 font-mono">
                          {off.validity}
                        </span>
                      </div>
                      
                      <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5 leading-snug line-clamp-1 w-full">
                        {off.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {((off.commission !== undefined && Number(off.commission) > 0) || (off.regularPrice !== undefined && Number(off.regularPrice) > 0)) && (
                        <div className="text-right">
                          <span className="text-[9.5px] text-slate-500 font-bold block">রেগুলার</span>
                          <span className="text-xs font-black font-mono text-slate-800 line-through decoration-rose-500">৳{off.regularPrice || (Number(off.price) + Number(off.commission || 0))}</span>
                        </div>
                      )}
                      <div className="text-right">
                        <span className="text-[9.5px] text-slate-500 font-bold block">অফারে কিনুন</span>
                        <strong className="text-sm font-black font-mono text-emerald-600 block">৳ {off.price}</strong>
                      </div>

                      <button
                        onClick={() => handleOpenPurchase(off)}
                        className="py-1.5 px-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-extrabold rounded-xl text-[10.5px] transition cursor-pointer shadow-md select-none border border-indigo-600 outline-none hover:scale-105 active:scale-95 duration-150"
                      >
                        কিনুন
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* POPUP BUY BOTTOM DIALOG */}
      <AnimatePresence>
        {selectedOffer && (
          <div className="fixed inset-0 z-50 bg-white flex flex-col">
            <div className="h-10 shrink-0 bg-[#004a2c] w-full"></div>
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="flex-1 flex flex-col overflow-hidden bg-white text-slate-800"
            >
              {/* Card top branding header */}
              <div className="bg-indigo-900 text-white p-4 flex justify-between items-center shrink-0">
                <div>
                  <h3 className="text-xs font-extrabold uppercase text-indigo-300 leading-none">টেলিকম ধামাকা প্যাক</h3>
                  <span className="text-sm font-black text-white mt-1 block">অনলাইন ক্রয় প্যানেল</span>
                </div>
                <button 
                  onClick={() => { setSelectedOffer(null); setPurchaseError(''); setPurchaseSuccess(false); }}
                  className="p-1.5 hover:bg-indigo-800 text-white/50 hover:text-white rounded-full transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Purchase Body / Forms */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                
                {purchaseError && (
                  <div className="bg-red-50 text-red-700 border border-red-150 p-2.5 text-xs rounded-xl flex items-center gap-1.5 font-bold leading-normal">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping shrink-0" />
                    <span>{purchaseError}</span>
                  </div>
                )}

                {purchaseSuccess ? (
                  <div className="bg-emerald-50 text-emerald-800 border border-emerald-250 p-4 rounded-2xl text-center space-y-3 py-6">
                    <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black">প্যাকেজ ক্রয়ের আবেদন গৃহীত হয়েছে!</h4>
                      <p className="text-[10px] text-slate-500 mt-1">আপনার মেইন ওয়ালেট থেকে ৳{selectedOffer.price} কেটে নেওয়া হয়েছে। আপনার আবেদনটি অ্যাডমিন প্যানেলে পেন্ডিং রয়েছে, শীঘ্রই এটি যাচাই করে অফারটি সক্রিয় করা হবে।</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleConfirmPurchase} className="space-y-4 text-left">
                    {/* Pack Summary snippet */}
                    <div className="bg-slate-50 border border-slate-150 p-3.5 rounded-2xl flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 whitespace-normal">{selectedOffer.title}</h4>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{selectedOffer.operator} • মেয়াদঃ {selectedOffer.validity}</p>
                      </div>
                      <span className="text-base font-black text-emerald-700 shrink-0">৳ {selectedOffer.price}</span>
                    </div>

                    {(() => {
                      const matchedCashback = getMatchedCashbackForRule(appConfig?.rechargeCashbackRules || [], selectedOffer.price, selectedOffer.operator);
                      if (matchedCashback > 0) {
                        return (
                          <div className="bg-purple-50 border border-purple-150 p-3 rounded-2xl flex items-center gap-2.5 text-purple-900 text-left animate-pulse">
                            <span className="text-lg shrink-0">🎁</span>
                            <div className="font-sans leading-normal">
                              <p className="text-[11px] font-black text-purple-950">বিশেষ ক্যাশব্যাক অফার সচল!</p>
                              <p className="text-[9.5px] font-extrabold text-purple-700">এই প্যাকেজটি ক্রয় করলে আপনি পাবেন ফ্ল্যাট <span className="text-[10px] font-black text-indigo-900 font-mono">৳{matchedCashback}</span> টাকা এক্সট্রা ক্যাশব্যাক!</p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Current user Wallet snippet */}
                    <div className="flex justify-between items-center text-xs font-bold text-slate-500 px-0.5">
                      <span>আমার মেইন ওয়ালেট ব্যালেন্সঃ</span>
                      <strong className="text-indigo-950 font-mono">৳ {(user.balance || 0).toLocaleString('en-US')} BDT</strong>
                    </div>

                    {/* Recipient Number Input */}
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 mb-1">প্রাপক মোবাইল নম্বর</label>
                      <input
                        type="tel"
                        required
                        maxLength={11}
                        value={recipientNumber}
                        onChange={(e) => setRecipientNumber(e.target.value.replace(/\D/g, ''))}
                        placeholder="উদাঃ 01XXXXXXXXX"
                        className="block w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:ring-1 focus:ring-indigo-600 focus:outline-none font-bold text-slate-805"
                      />
                      <p className="text-[9px] text-slate-400 mt-0.5">রিচার্জ করার সঠিক নম্বরটি প্রদান নিশ্চিত করুন।</p>
                    </div>

                    {/* Security Transaction Pin Verification */}
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 mb-1">আপনার 4 ডিজিটের সিকিউরিটি পিন</label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        value={inputPin}
                        onChange={(e) => setInputPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••"
                        className="block w-full px-4 py-2 bg-slate-50 border border-slate-202 rounded-xl tracking-widest text-center font-mono text-sm focus:ring-1 focus:ring-indigo-600 focus:outline-none font-extrabold text-slate-805"
                      />
                    </div>

                    {/* submit purchase button */}
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="w-full py-2.5 mt-2 bg-indigo-900 border border-indigo-950 text-white font-extrabold rounded-xl text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                    >
                      {isProcessing ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        'ক্রয় নিশ্চিত করুন'
                      )}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* POPUP CASH RECHARGE OVERLAY SCREEN */}
      <AnimatePresence>
        {showAddBalanceModal && (
          <div className="fixed inset-0 z-50 bg-white flex flex-col">
            <div className="h-10 shrink-0 bg-[#004a2c] w-full"></div>
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="flex-1 overflow-y-auto p-6 bg-white flex flex-col items-center justify-center"
            >
              <div className="w-full max-w-sm space-y-6">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-black text-slate-800">মেইন থেকে রিচার্জ ব্যালেন্সে টাকা অ্যাড</h3>
                  <button onClick={() => setShowAddBalanceModal(false)} className="p-1.5 hover:bg-slate-100 rounded-full">
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                {addBalanceMsg && (
                  <div className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between ${
                    addBalanceMsg.type === 'error' ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}>
                    <span>{addBalanceMsg.text}</span>
                    <button type="button" onClick={() => setAddBalanceMsg(null)} className="text-slate-500 hover:text-slate-700 ml-2">×</button>
                  </div>
                )}
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  setAddBalanceMsg(null);
                  if (Number(addBalanceAmount) > (user.balance || 0)) {
                    setAddBalanceMsg({ text: 'ব্যালেন্স অপর্যাপ্ত', type: 'error' });
                    return;
                  }
                  if (addBalancePin !== user.pin) {
                    setAddBalanceMsg({ text: 'ভুল পিন', type: 'error' });
                    return;
                  }
                  setIsProcessing(true);
                  try {
                    const commission = Number(addBalanceAmount) * 0.02; // 2%
                    const totalToAdd = Number(addBalanceAmount) + commission;
                    const userRef = doc(db, 'users', user.uid);
                    await updateDoc(userRef, {
                      balance: (user.balance || 0) - Number(addBalanceAmount),
                      mainBalance: (user.balance || 0) - Number(addBalanceAmount),
                      telecomBalance: (user.telecomBalance || 0) + totalToAdd
                    });
                    setAddBalanceMsg({ text: 'সফলভাবে রিচার্জ ব্যালেন্সে টাকা যুক্ত হয়েছে।', type: 'success' });
                    setTimeout(() => {
                      setShowAddBalanceModal(false);
                      setAddBalanceAmount('');
                      setAddBalancePin('');
                      setAddBalanceMsg(null);
                    }, 1200);
                  } catch (err) {
                    console.error(err);
                    setAddBalanceMsg({ text: 'ট্রানজেকশন ব্যর্থ হয়েছে।', type: 'error' });
                  } finally {
                    setIsProcessing(false);
                  }
                }} className="space-y-5">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">পরিমাণ (৳)</label>
                    <input type="number" value={addBalanceAmount} onChange={(e) => setAddBalanceAmount(e.target.value)} required className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-mono focus:outline-none" placeholder="1000" />
                    <p className="text-[10px] text-emerald-600 font-bold mt-1">কমিশন (2%): ৳{(Number(addBalanceAmount) * 0.02).toFixed(2)}</p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">পিন নম্বর</label>
                    <input type="password" value={addBalancePin} onChange={(e) => setAddBalancePin(e.target.value)} required maxLength={4} className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-mono focus:outline-none" placeholder="••••" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowAddBalanceModal(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold transition">বাতিল</button>
                    <button type="submit" disabled={isProcessing} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md">নিশ্চিত করুন</button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
        {showCashRecharge && (
          <div className="fixed inset-0 z-50 bg-white flex flex-col">
            <div className="h-10 shrink-0 bg-[#004a2c] w-full"></div>
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="flex-1 flex flex-col overflow-hidden bg-white text-slate-800"
            >
              <div className="bg-indigo-900 text-white p-3.5 sm:p-4 flex justify-between items-center shrink-0 sticky top-0 z-20 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span className="text-xs sm:text-sm font-black tracking-tight">
                    {cashRechargeOperator === 'Alaap' 
                      ? '📞 আলাপ VoIP' 
                      : cashRechargeOperator === 'Brilliant' 
                        ? '🌐 ব্রিলিয়ান্ট VoIP' 
                        : '💸 মোবাইল ক্যাশ রিচার্জ'}
                  </span>
                  <span className="bg-indigo-800/80 text-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-extrabold font-mono border border-indigo-700/60 inline-flex items-center gap-1">
                    ব্যালেন্স: ৳{(user.balance || 0).toLocaleString('en-US')}
                  </span>
                </div>
                <button 
                  onClick={() => { setShowCashRecharge(false); setPurchaseError(''); setPurchaseSuccess(false); }}
                  className="p-1 hover:bg-indigo-850 rounded-full cursor-pointer text-white/70 hover:text-white shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto">
                {purchaseSuccess ? (
                  <div className="bg-emerald-50 text-emerald-800 border border-emerald-250 p-4 rounded-2xl text-center space-y-3 py-6">
                    <div className="w-11 h-11 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black">
                        {cashRechargeOperator === 'Alaap' 
                          ? 'আলাপ VoIP রিচার্জ আবেদন গৃহীত!' 
                          : cashRechargeOperator === 'Brilliant' 
                            ? 'ব্রিলিয়ান্ট VoIP রিচার্জ আবেদন গৃহীত!' 
                            : 'মোবাইল রিচার্জ আবেদন গৃহীত!'}
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-1">৳ {cashRechargeAmount} টাকা রিচার্জের আবেদনটি সফলভাবে জমা হয়েছে। আপনার আবেদনটি অ্যাডমিন প্যানেলে পেন্ডিং রয়েছে, অনুমোদন হওয়ার পর রিচার্জ সম্পন্ন হবে।</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleCashRechargeSubmit} className="space-y-3.5 text-left text-xs font-bold text-slate-600 pb-10">
                    
                    {purchaseError && (
                      <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-xl text-xs font-bold flex items-center justify-between">
                        <span>⚠️ {purchaseError}</span>
                        <button type="button" onClick={() => setPurchaseError('')} className="text-rose-500 font-black ml-2 cursor-pointer">×</button>
                      </div>
                    )}

                    <div className="space-y-3">
                    {['Alaap', 'Brilliant'].includes(cashRechargeOperator) ? (
                      <div className="w-full p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-extrabold text-indigo-700 font-sans tracking-wide">
                        {cashRechargeOperator} VoIP
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="block text-[10px] text-slate-500 font-extrabold tracking-wide uppercase">রিচার্জ অপারেটর নির্বাচন করুন</label>
                        <div className="grid grid-cols-3 gap-2">
                          {['Grameenphone', 'Robi', 'Airtel', 'Banglalink', 'Teletalk', 'Skitto'].map((op, idx) => {
                            const isSelected = cashRechargeOperator === op;
                            const colors = op === 'Grameenphone' ? 'bg-blue-50 border-blue-200 text-blue-900' :
                                           op === 'Robi' ? 'bg-red-50 border-red-200 text-red-900' :
                                           op === 'Airtel' ? 'bg-rose-50 border-rose-200 text-rose-900' :
                                           op === 'Banglalink' ? 'bg-orange-50 border-orange-200 text-orange-900' :
                                           op === 'Teletalk' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
                                           'bg-yellow-50 border-yellow-200 text-yellow-900';
                            return (
                              <button
                                key={`${op}-${idx}`}
                                type="button"
                                onClick={() => setCashRechargeOperator(op)}
                                className={`py-2 px-1 rounded-xl border text-center transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
                                  isSelected 
                                    ? `${colors} border-2 ring-2 ring-indigo-500/30 font-black scale-102` 
                                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <span className="text-[10px] font-black">{op}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1 uppercase">রিচার্জের পরিমাণ (৳)</label>
                      <input
                        type="number"
                        required
                        min={10}
                        value={cashRechargeAmount}
                        onChange={(e) => setCashRechargeAmount(e.target.value)}
                        placeholder="10 - 1000 টাকা"
                        className="w-full p-3 bg-slate-50 border border-slate-205 rounded-xl font-mono text-sm focus:outline-none"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[10px] text-slate-500 uppercase">প্রাপক মোবাইল নম্বর</label>
                        <button 
                          type="button" 
                          onClick={() => setCashRecipientNumber(user.phone || '')} 
                          className="text-[9px] text-indigo-700 hover:underline font-black"
                        >
                          নিজে ({user.phone || 'N/A'})
                        </button>
                      </div>
                      <input
                        type="tel"
                        required
                        maxLength={11}
                        value={cashRecipientNumber}
                        onChange={(e) => setCashRecipientNumber(e.target.value.replace(/\D/g, ''))}
                        placeholder="উদাঃ 01XXXXXXXXX"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm text-slate-805 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1 uppercase">সিকিউরিটি পিন নম্বর</label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        value={cashRechargePin}
                        onChange={(e) => setCashRechargePin(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••"
                        className="w-full p-3 bg-slate-50 border border-slate-202 rounded-xl text-center font-mono text-lg tracking-widest text-slate-805 focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="w-full py-4 bg-indigo-900 border border-indigo-950 hover:bg-indigo-950 text-white font-extrabold rounded-xl text-sm transition cursor-pointer flex items-center justify-center gap-1 shadow-md active:scale-98 mt-2"
                    >
                      {isProcessing ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        'রিচার্জ নিশ্চিত করুন'
                      )}
                    </button>

                    {/* Dynamic Cashback Offers List */}
                    {(() => {
                      const opRules = getFilteredRulesForOperator(appConfig?.rechargeCashbackRules || [], cashRechargeOperator);
                      return (
                        <div className="space-y-1.5 text-left bg-gradient-to-br from-purple-50 to-indigo-50/50 p-3 rounded-2xl border border-purple-150 shadow-3xs mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10.5px] text-purple-900 font-black tracking-wide flex items-center gap-1.5">
                              <span className="text-sm">🎁</span>
                              <span>বিশেষ ক্যাশব্যাক স্ল্যাব (ক্লিক করুন)</span>
                            </label>
                          </div>
                          {opRules.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                              {opRules.map((rule, idx) => {
                                const isSelected = Number(cashRechargeAmount) === Number(rule.amount);
                                return (
                                  <button
                                    key={rule.id ? `${rule.id}-${idx}` : `cb-${rule.amount}-${idx}`}
                                    type="button"
                                    onClick={() => setCashRechargeAmount(String(rule.amount))}
                                    className={`p-2.5 rounded-xl text-left border transition-all active:scale-95 flex flex-col justify-between cursor-pointer ${
                                      isSelected 
                                        ? 'bg-purple-600 text-white border-purple-600 font-black shadow-md' 
                                        : 'bg-white border-purple-100 hover:bg-purple-50 text-slate-700'
                                    }`}
                                  >
                                    <span className="text-[11px] font-black">৳{rule.amount} রিচার্জ</span>
                                    <span className={`text-[10px] font-bold mt-0.5 ${isSelected ? 'text-purple-100' : 'text-purple-600'}`}>
                                      ক্যাশব্যাকঃ ৳{rule.cashback}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="bg-white/60 border border-purple-100/60 rounded-xl p-3 text-[10px] font-bold text-purple-700 text-center leading-relaxed">
                              {cashRechargeOperator || 'অপারেটর'} রিচার্জে বর্তমানে কোনো বিশেষ ক্যাশব্যাক স্ল্যাব নেই।
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {showHelplineModal && (
          <div className="fixed inset-0 z-50 bg-white flex flex-col">
            <div className="h-10 shrink-0 bg-[#004a2c] w-full"></div>
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="flex-1 flex flex-col overflow-hidden bg-white text-slate-800"
            >
              {/* Header */}
              <div className="flex justify-between items-center border-b border-slate-100 p-4 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-black">
                    <Headphones className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">BNB টেলিকম হেল্পলাইন</h3>
                    <p className="text-[10px] text-slate-500 font-extrabold">সরাসরি সাপোর্ট ও মেসেজিং সেকশন</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowHelplineModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* Notice/Subtext */}
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-900 leading-relaxed flex items-start gap-2.5">
                  <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{appConfig?.telecomHelplineNotice || 'যেকোনো বিষয় জানতে বা সমস্যার সমাধানের জন্য আমাদের হেল্পলাইন ওয়াটসঅ্যাপে মেসেজ অথবা সরাসরি কল করুন।'}</span>
                </div>

                {/* Helpline Details Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-400">হেল্পলাইন নম্বর:</span>
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-md font-mono">
                      24/7 সচল
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <PhoneCall className="w-5 h-5 text-emerald-600" />
                      <span className="text-base font-black text-slate-900 font-mono tracking-wider">
                        {appConfig?.telecomHelplinePhone || '01865911728'}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const num = appConfig?.telecomHelplinePhone || '01865911728';
                        navigator.clipboard.writeText(num);
                        setCopiedHelpline(true);
                        setTimeout(() => setCopiedHelpline(false), 2000);
                      }}
                      className="flex items-center gap-1.5 text-[11px] font-black bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl transition cursor-pointer"
                    >
                      {copiedHelpline ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                      <span>{copiedHelpline ? 'কপি হয়েছে' : 'কপি করুন'}</span>
                    </button>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-1 gap-3 pt-2">
                    <button
                      onClick={() => {
                        const num = (appConfig?.telecomHelplinePhone || '01865911728').replace(/\D/g, '');
                        const formattedNum = num.startsWith('88') ? num : `88${num}`;
                        window.open(`https://wa.me/${formattedNum}`, '_blank');
                      }}
                      className="w-full py-4 bg-[#25D366] hover:bg-[#20bd5a] text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2.5 transition shadow-md cursor-pointer"
                    >
                      <MessageSquare className="w-5 h-5" />
                      <span>WhatsApp মেসেজ পাঠান</span>
                    </button>

                    <a
                      href={`tel:${appConfig?.telecomHelplinePhone || '01865911728'}`}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2.5 transition shadow-md text-center"
                    >
                      <PhoneCall className="w-5 h-5" />
                      <span>সরাসরি কল করুন</span>
                    </a>
                  </div>

                  {/* Facebook Link Button */}
                  {(appConfig?.telecomHelplineFacebook || 'https://facebook.com') && (
                    <button
                      onClick={() => {
                        const fbUrl = appConfig?.telecomHelplineFacebook || 'https://facebook.com';
                        const validUrl = fbUrl.startsWith('http') ? fbUrl : `https://${fbUrl}`;
                        window.open(validUrl, '_blank');
                      }}
                      className="w-full py-3.5 bg-[#1877F2] hover:bg-[#166fe5] text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>অফিসিয়াল ফেসবুক পেজে যান</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Footer Close Button */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 shrink-0 pb-10">
                <button
                  onClick={() => setShowHelplineModal(false)}
                  className="w-full py-3.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-black rounded-2xl text-sm transition cursor-pointer"
                >
                  বন্ধ করুন
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showSectionTxHistory && (
          <div className="fixed inset-0 z-50 bg-white flex flex-col">
            <div className="h-10 shrink-0 bg-[#004a2c] w-full"></div>
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="flex-1 flex flex-col overflow-hidden bg-white text-slate-800"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0 shadow-sm">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-indigo-200" />
                  <div>
                    <h3 className="text-sm font-black text-white">টেলিকম রিচার্জ খতিয়ান</h3>
                    <p className="text-[10px] text-indigo-200 font-medium">মোবাইল রিচার্জ, অফার প্যাক ও ড্রাইভে ইতিহাস</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowSectionTxHistory(false);
                    setTxModalSearch('');
                  }}
                  className="p-1.5 hover:bg-white/10 rounded-xl transition text-white/90 active:scale-90"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input 
                    type="text"
                    value={txModalSearch}
                    onChange={(e) => setTxModalSearch(e.target.value)}
                    placeholder="পরিমাণ, নম্বর বা অপারেটর দিয়ে খুঁজুন..."
                    className="w-full bg-white border border-slate-200 pl-10 pr-4 py-2.5 rounded-2xl text-sm font-medium focus:outline-none focus:border-indigo-600"
                  />
                  {txModalSearch && (
                    <button 
                      onClick={() => setTxModalSearch('')}
                      className="text-[11px] font-black text-slate-400 hover:text-slate-600 absolute right-3.5 top-2.5"
                    >
                      মুছুন
                    </button>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
                {loadingTx ? (
                  <div className="text-center py-20 text-slate-400 text-xs font-bold">
                    খতিয়ান লোড হচ্ছে...
                  </div>
                ) : (() => {
                  const filteredTxs = txHistory.filter(tx => {
                    const isTelecomTx = tx.type === 'telecom_recharge' || 
                      tx.typeLabel?.toLowerCase().includes('রিচার্জ') || tx.typeLabel?.toLowerCase().includes('টেলিকম') || tx.typeLabel?.toLowerCase().includes('recharge') || tx.typeLabel?.toLowerCase().includes('telecom') ||
                      tx.description?.toLowerCase().includes('রিচার্জ') || tx.description?.toLowerCase().includes('টেলিকম') || tx.description?.toLowerCase().includes('recharge') || tx.description?.toLowerCase().includes('telecom');

                    if (!isTelecomTx) return false;

                    if (!txModalSearch.trim()) return true;
                    const searchLower = txModalSearch.toLowerCase();
                    return (
                      tx.description?.toLowerCase().includes(searchLower) ||
                      tx.typeLabel?.toLowerCase().includes(searchLower) ||
                      tx.amount.toString().includes(searchLower) ||
                      tx.id.toLowerCase().includes(searchLower) ||
                      tx.receiptNo?.toLowerCase().includes(searchLower)
                    );
                  });

                  if (filteredTxs.length === 0) {
                    return (
                      <div className="text-center py-20 text-slate-400 text-xs font-bold">
                        কোনো টেলিকম রিচার্জ বা ড্রাইভ রেকর্ড পাওয়া যায়নি।
                      </div>
                    );
                  }

                  return filteredTxs.map((tx, idx) => {
                    return (
                      <div 
                        key={`${tx.id}-${idx}`} 
                        onClick={() => openReceiptForTx(tx)}
                        className="p-4 bg-white border border-slate-150 hover:border-indigo-300 hover:bg-indigo-50/10 rounded-2xl shadow-3xs flex justify-between items-start gap-4 text-left cursor-pointer transition active:scale-[0.99]"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <span className="text-sm font-black text-slate-900 block truncate">{tx.typeLabel || 'মোবাইল রিচার্জ'}</span>
                          <span className="text-[10px] text-slate-400 block font-bold font-mono">
                            {new Date(tx.createdAt).toLocaleDateString('bn-BD')} {new Date(tx.createdAt).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <p className="text-[11px] text-slate-600 font-bold leading-relaxed">{tx.description}</p>
                          {tx.id && (
                            <span className="inline-block text-[9px] bg-slate-100 text-slate-500 font-mono px-2 py-0.5 rounded-md">
                              TXID: {tx.id.replace('tx-tel-', '').replace('tx-cash-', '').toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-black font-mono block text-rose-600">
                            - ৳{tx.amount.toLocaleString('en-US')}
                          </span>
                          <span className={`inline-block text-[9px] font-black px-2 py-0.5 mt-2 rounded-md uppercase border ${
                            tx.status === 'success' || tx.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            tx.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                          }`}>
                            {tx.status === 'success' || tx.status === 'approved' ? 'সফল' : tx.status === 'pending' ? 'অপেক্ষমাণ' : 'ব্যর্থ'}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 text-center shrink-0 pb-10">
                <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase">© BUSINESS NETWORK BANGLADESH</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )}

      {/* Full-Screen BNB Payment Receipt Modal */}
      <BNBPaymentReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        data={receiptModalData}
        appLogo={appConfig?.logoUrl || "/amb_logo.png"}
      />

    </div>
  );
});

export default BNBTelecomScreen;
