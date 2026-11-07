import React, { useState } from 'react';
import { User, Transaction, AppConfig, getEffectiveBalance, generateBNBTrxId, formatShortTrxId } from '../types';
import { db } from '../lib/firebase';
import UnifiedBackButton from './UnifiedBackButton';
import { doc, updateDoc, setDoc, addDoc, collection, query, where, getDocs, runTransaction } from 'firebase/firestore';
import { apiUrl } from '../config/api';
import { 
  Smartphone, 
  CheckCircle, 
  X, 
  Zap,
  RefreshCw,
  History,
  Search,
  ClipboardList,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  Check,
  Copy,
  Plus,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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

interface BNBAutoRechargeScreenProps {
  user: User;
  onBack: () => void;
  syncLiveProfile: () => void;
  appConfig?: AppConfig;
}

export default function BNBAutoRechargeScreen({
  user,
  onBack,
  syncLiveProfile,
  appConfig
}: BNBAutoRechargeScreenProps) {
  const [operator, setOperator] = useState<string>('');
  const [rechargeAmount, setRechargeAmount] = useState<string>('');
  const [recipientNumber, setRecipientNumber] = useState<string>('');
  const [rechargePin, setRechargePin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<boolean>(false);

  // Add Money to Recharge Balance Modal State
  const [showAddBalanceModal, setShowAddBalanceModal] = useState<boolean>(false);
  const [addBalanceAmount, setAddBalanceAmount] = useState<string>('');
  const [addBalancePin, setAddBalancePin] = useState<string>('');
  const [addBalanceMsg, setAddBalanceMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Transaction History Modal State
  const [showTxHistoryModal, setShowTxHistoryModal] = useState<boolean>(false);
  const [txHistory, setTxHistory] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState<boolean>(false);
  const [txSearchQuery, setTxSearchQuery] = useState<string>('');
  const [txFilterTab, setTxFilterTab] = useState<'all' | 'recharge' | 'add_balance'>('all');

  // Full-screen receipt modal state
  const [receiptModalData, setReceiptModalData] = useState<PaymentReceiptData | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState<boolean>(false);

  const operatorsList = [
    { id: 'Grameenphone', short: 'GP', name: 'Grameenphone', color: 'bg-blue-500', border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-900' },
    { id: 'Robi', short: 'Robi', name: 'Robi', color: 'bg-red-500', border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-900' },
    { id: 'Airtel', short: 'Airtel', name: 'Airtel', color: 'bg-rose-600', border: 'border-rose-200', bg: 'bg-rose-50', text: 'text-rose-900' },
    { id: 'Banglalink', short: 'BL', name: 'Banglalink', color: 'bg-orange-500', border: 'border-orange-200', bg: 'bg-orange-50', text: 'text-orange-900' },
    { id: 'Teletalk', short: 'Tele', name: 'Teletalk', color: 'bg-emerald-600', border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-900' },
    { id: 'Skitto', short: 'Skitto', name: 'Skitto', color: 'bg-yellow-400', border: 'border-yellow-200', bg: 'bg-yellow-50', text: 'text-yellow-900' }
  ];

  // Fetch recharge history
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
        const d = { id: docSnap.id, ...docSnap.data() } as Transaction;
        if (
          d.type === 'telecom_recharge' || 
          d.type === 'telecom_add_balance' || 
          (d.typeLabel && d.typeLabel.includes('রিচার্জ')) ||
          (d.typeLabel && d.typeLabel.includes('টেলিকম'))
        ) {
          list.push(d);
        }
      });
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setTxHistory(list);
    } catch (e) {
      console.error("Error fetching recharge tx history:", e);
    } finally {
      setLoadingTx(false);
    }
  };

  // Open receipt for transaction
  const openReceiptForTx = (tx: any) => {
    setReceiptModalData({
      typeLabel: tx.typeLabel || 'অটো মোবাইল রিচার্জ',
      transactionId: formatShortTrxId(tx.transactionId || tx.trxId || tx.id),
      amount: tx.amount || 0,
      fee: 0,
      totalAmount: tx.amount || 0,
      status: tx.status || 'pending',
      beneficiaryName: tx.userName || user.name || 'BNB সদস্য',
      beneficiaryAccount: tx.memberId || user.memberId || user.phone,
      senderPhone: tx.phone || tx.receiverPhone || user.phone || 'N/A',
      paymentMethod: tx.operator || tx.paymentMethod || 'BNB রিচার্জ',
      description: tx.description,
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

  // Add Money from Main Balance to Telecom Balance with 2% commission (হাজারে ২০ টাকা)
  const handleAddBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddBalanceMsg(null);

    const amt = Number(addBalanceAmount);
    if (!amt || amt < 10) {
      setAddBalanceMsg({ text: 'সর্বনিম্ন ৳১০ অ্যাড করা যাবে।', type: 'error' });
      return;
    }

    if (amt > getEffectiveBalance(user)) {
      setAddBalanceMsg({ text: 'আপনার মেইন ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই!', type: 'error' });
      return;
    }

    if (addBalancePin !== user.pin) {
      setAddBalanceMsg({ text: 'ভুল সিকিউরিটি পিন নম্বর!', type: 'error' });
      return;
    }

    setIsProcessing(true);
    try {
      const commission = amt * 0.02; // 2% bonus (হাজারে ২০ টাকা)
      const totalToAdd = amt + commission;
      
      const currentMainBal = getEffectiveBalance(user);
      const newMainBalance = currentMainBal - amt;
      const newTelecomBalance = (user.telecomBalance || 0) + totalToAdd;

      // Optimistic state update
      user.balance = newMainBalance;
      (user as any).mainBalance = newMainBalance;
      user.telecomBalance = newTelecomBalance;

      const txId = `tx-addbal-${Date.now()}`;
      const newTx: Transaction = {
        id: txId,
        userId: user.uid,
        userName: user.name,
        memberId: user.memberId,
        type: 'telecom_add_balance',
        typeLabel: 'রিচার্জ ব্যালেন্স অ্যাড',
        amount: amt,
        status: 'approved',
        description: `মেইন ব্যালেন্স থেকে ৳${amt.toLocaleString()} রিচার্জ ব্যালেন্সে অ্যাড করা হয়েছে। (২% বোনাস কমিশন ৳${commission.toFixed(2)} সহ মোট ৳${totalToAdd.toFixed(2)} রিচার্জ ওয়ালেটে যুক্ত হয়েছে)।`,
        createdAt: new Date().toISOString(),
        rechargeCommission: commission,
        operator: 'BNB Telecom'
      } as any;

      // Real-time notification
      const notifId = `notif-${Date.now()}`;
      const newNotif = {
        id: notifId,
        userId: user.uid,
        title: 'রিচার্জ ব্যালেন্স অ্যাড সফল',
        message: `৳${amt.toLocaleString()} টাকা অ্যাড সফল। ২% বোনাস (৳${commission.toFixed(2)}) সহ ৳${totalToAdd.toFixed(2)} রিচার্জ ব্যালেন্সে যোগ হয়েছে।`,
        type: 'balance_added',
        isRead: false,
        createdAt: new Date().toISOString()
      };

      // Background Firestore save using atomic transaction
      (async () => {
        try {
          const userRef = doc(db, 'users', user.uid);
          await runTransaction(db, async (t) => {
            const uSnap = await t.get(userRef);
            if (!uSnap.exists()) return;
            const uData = uSnap.data();
            const liveBal = getEffectiveBalance(uData);
            if (liveBal < amt) throw new Error('Insufficient balance');
            const updatedMain = liveBal - amt;
            const updatedTel = (Number(uData.telecomBalance) || 0) + totalToAdd;
            t.update(userRef, {
              balance: updatedMain,
              mainBalance: updatedMain,
              telecomBalance: updatedTel
            });
          });
          await setDoc(doc(db, 'transactions', newTx.id), newTx, { merge: true });

          await setDoc(doc(db, 'user_notifications', notifId), newNotif, { merge: true });
        } catch (dbErr) {
          console.error("Firestore add balance error:", dbErr);
        }
      })();

      syncLiveProfile();
      setAddBalanceMsg({ text: `সফলভাবে ৳${totalToAdd.toFixed(2)} (২% বোনাস সহ) রিচার্জ ব্যালেন্সে যুক্ত হয়েছে!`, type: 'success' });

      setTimeout(() => {
        setShowAddBalanceModal(false);
        setAddBalanceAmount('');
        setAddBalancePin('');
        setAddBalanceMsg(null);
      }, 1400);

    } catch (err: any) {
      console.error(err);
      setAddBalanceMsg({ text: 'ব্যালেন্স অ্যাড ব্যর্থ হয়েছে। পুনরায় চেষ্টা করুন।', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!operator) {
      setErrorMessage('অপারেটর সিলেক্ট করুন যেকোনো একটা!');
      return;
    }

    const reloadAmt = Number(rechargeAmount);
    if (!reloadAmt || reloadAmt < 10) {
      setErrorMessage('সর্বনিম্ন রিচার্জ 10 টাকা হতে হবে।');
      return;
    }

    const cleanCashNumber = recipientNumber.trim();
    const isNumeric = /^\d+$/.test(cleanCashNumber);
    if (!cleanCashNumber || cleanCashNumber.length !== 11 || !isNumeric) {
      setErrorMessage('11 ডিজিটের সঠিক মোবাইল নম্বর লিখুন (মেম্বার আইডি বা অক্ষর গ্রহণযোগ্য নয়)।');
      return;
    }

    // PIN verification
    const inputPinClean = rechargePin.trim();
    const storedPin = String(user.pin || '').trim();
    if (!inputPinClean || (storedPin && inputPinClean !== storedPin)) {
      setErrorMessage('ভুল সিকিউরিটি পিন নম্বর! পুনরায় সঠিক পিন দিন।');
      return;
    }

    const availableTelecom = Number(user.telecomBalance) || 0;
    const availableMain = getEffectiveBalance(user);

    let autoTransferred = false;
    let autoTransferAmount = 0;
    let autoTransferBonus = 0;

    if (availableTelecom < reloadAmt) {
      const neededFromMain = reloadAmt - availableTelecom;
      if (availableMain < neededFromMain) {
        setErrorMessage(`অপর্যাপ্ত ব্যালেন্স! আপনার রিচার্জ ওয়ালেটে ৳${availableTelecom.toLocaleString('en-US')} এবং মেইন ওয়ালেটে ৳${availableMain.toLocaleString('en-US')} আছে। মোট প্রয়োজন ৳${reloadAmt.toLocaleString('en-US')}।`);
        return;
      }
      autoTransferred = true;
      autoTransferAmount = neededFromMain;
      autoTransferBonus = neededFromMain * 0.02;
    }

    try {
      setIsProcessing(true);

      // Trigger server-authoritative Success TopUp Gateway
      const res = await fetch(apiUrl('/api/recharge'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          number: cleanCashNumber,
          operator: operator,
          type: 'prepaid',
          amount: reloadAmt,
          pin: inputPinClean,
          accountNumber: user.memberId || user.phone
        })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data || data.success === false) {
        throw new Error(data?.error || data?.message || 'সার্ভার থেকে রিচার্জ গ্রহণ করা যায়নি।');
      }

      // Optimistic balance deduction after successful submission
      if (availableMain >= reloadAmt) {
        user.balance = availableMain - reloadAmt;
        (user as any).mainBalance = availableMain - reloadAmt;
      } else {
        user.telecomBalance = availableTelecom - reloadAmt;
      }

      setPurchaseSuccess(true);
      setIsProcessing(false);
      syncLiveProfile();

      // Show Full-Screen Transaction Receipt Modal
      const ambTrxId = data.trxid || generateBNBTrxId('ST');
      setReceiptModalData({
        typeLabel: 'স্বয়ংক্রিয় অটো মোবাইল রিচার্জ (Success TopUp)',
        transactionId: ambTrxId,
        amount: reloadAmt,
        fee: 0,
        totalAmount: reloadAmt,
        status: 'pending',
        beneficiaryName: user.name,
        beneficiaryAccount: user.memberId || user.phone,
        senderPhone: cleanCashNumber,
        paymentMethod: `${operator} (Success TopUp Gateway)`,
        description: `${operator} নম্বরে (${cleanCashNumber}) ৳${reloadAmt.toLocaleString('en-US')} ইনস্ট্যান্ট অটো রিচার্জ সফলভাবে সার্ভারে প্রেরণ করা হয়েছে।`,
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
      setIsReceiptOpen(true);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(`অটো রিচার্জ ব্যর্থ হয়েছেঃ ${err?.message || 'সার্ভার সংযোগ সমস্যা'}`);
      setIsProcessing(false);
    }
  };

  const opRules = getFilteredRulesForOperator(appConfig?.rechargeCashbackRules || [], operator);

  // Filtered transactions for History Modal
  const filteredTxHistory = txHistory.filter(tx => {
    const matchesSearch = 
      (tx.phone && tx.phone.includes(txSearchQuery)) ||
      (tx.operator && tx.operator.toLowerCase().includes(txSearchQuery.toLowerCase())) ||
      (tx.amount && String(tx.amount).includes(txSearchQuery)) ||
      (tx.typeLabel && tx.typeLabel.toLowerCase().includes(txSearchQuery.toLowerCase()));
    
    if (!matchesSearch) return false;
    if (txFilterTab === 'recharge') return tx.type === 'telecom_recharge';
    if (txFilterTab === 'add_balance') return tx.type === 'telecom_add_balance';
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* Green Top Header Section matching Home Dashboard */}
      <header className="bg-gradient-to-b from-[#0b6623] via-[#005a36] to-[#004d1a] text-white px-3.5 pt-2.5 pb-2.5 rounded-b-[28px] shadow-sm border-b border-emerald-700/60 relative overflow-hidden z-30 space-y-2.5">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2">
          
          {/* Left section: Back button & Title + Main Balance pill */}
          <div className="flex items-center gap-2">
            <UnifiedBackButton onClick={onBack} label="ড্যাশবোর্ড" variant="glass" />
            <div>
              <h1 className="text-xs sm:text-sm font-black tracking-tight flex items-center gap-1 text-white">
                <Smartphone className="w-3.5 h-3.5 text-amber-300" />
                BNB অটো রিচার্জ
              </h1>
              <div 
                onClick={syncLiveProfile}
                className="mt-0.5 inline-flex items-center gap-1 bg-black/20 border border-white/20 px-2 py-0.5 rounded-full text-[9px] font-bold text-white cursor-pointer transition active:scale-95 shadow-3xs"
                title="মেইন ব্যালেন্স রিফ্রেশ করুন"
              >
                <span className="text-[7.5px] text-emerald-200 uppercase font-extrabold">মেইনঃ</span>
                <span className="font-mono text-white font-bold">৳{(user.balance || 0).toLocaleString('en-US')}</span>
              </div>
            </div>
          </div>

          {/* Right section: Recharge Balance & Add + History Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Recharge Balance Pill */}
            <div 
              onClick={() => {
                setAddBalanceAmount('');
                setAddBalanceMsg(null);
                setShowAddBalanceModal(true);
              }}
              className="inline-flex items-center gap-1 bg-black/20 border border-amber-300/40 px-2 py-0.5 rounded-full text-[9px] font-bold text-amber-200 cursor-pointer transition active:scale-95 shadow-3xs hover:bg-black/30"
              title="রিচার্জ ব্যালেন্স (২% বোনাসসহ অ্যাড করতে ক্লিক করুন)"
            >
              <span className="text-[7.5px] text-amber-300 uppercase font-extrabold">রিচার্জঃ</span>
              <span className="font-mono text-white font-bold">৳{(user.telecomBalance || 0).toLocaleString('en-US')}</span>
            </div>

            {/* Add Balance Button */}
            <button
              type="button"
              onClick={() => {
                setAddBalanceAmount('');
                setAddBalanceMsg(null);
                setShowAddBalanceModal(true);
              }}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-2 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-0.5 transition active:scale-95 cursor-pointer shadow-sm"
              title="মেইন থেকে রিচার্জ ব্যালেন্সে টাকা অ্যাড করুন (২% বোনাসসহ)"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>+ Add</span>
            </button>

            {/* History Button */}
            <button
              type="button"
              onClick={() => {
                fetchTxHistory();
                setShowTxHistoryModal(true);
              }}
              className="bg-white/20 hover:bg-white/30 border border-white/20 text-white p-1.5 sm:px-2 sm:py-1.5 rounded-xl text-[10px] font-black flex items-center gap-1 transition active:scale-95 cursor-pointer"
              title="রিচার্জ লেনদেন হিস্ট্রি"
            >
              <History className="w-3.5 h-3.5 text-white" />
              <span className="hidden xs:inline">হিস্ট্রি</span>
            </button>
          </div>
        </div>

        {/* Announcement Ticker (ঘোষণা) */}
        <div className="max-w-md mx-auto flex items-center gap-2.5 overflow-hidden w-full pt-1 px-0.5 relative z-10">
          <div className="bg-white text-[#005a36] text-[10.5px] font-black px-3 py-1 rounded-full shrink-0 shadow-xs flex items-center gap-1">
            <span>ঘোষণা</span>
          </div>
          <div className="flex-grow overflow-hidden relative mr-1">
            <marquee className="text-[12px] font-bold text-white leading-none py-0.5 tracking-wide" behavior="scroll" direction="left" scrollamount="4">
              {appConfig?.autoRechargeTicker || "BNB স্বয়ংক্রিয় অটো রিচার্জ সেবায় স্বাগতম। ইনস্ট্যান্ট কয়েক সেকেন্ডে যেকোনো সিম রিচার্জ সম্পন্ন করুন।"}
            </marquee>
          </div>
        </div>
      </header>

      {/* Main Content Form */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-4 pb-10">
        
        {/* Ticker / Notice */}
        <div className="bg-cyan-50 border border-cyan-200/80 rounded-2xl p-3 flex items-center gap-2.5 shadow-3xs">
          <div className="w-7 h-7 rounded-xl bg-cyan-600 text-white flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 fill-white" />
          </div>
          <p className="text-[10.5px] font-bold text-cyan-950 leading-relaxed">
            সব অপারেটরে ইনস্ট্যান্ট অটো মোবাইল রিচার্জ ও স্পেশাল ক্যাশব্যাক অফার স্ল্যাব সচল রয়েছে। মেইন থেকে রিচার্জ ওয়ালেটে টাকা অ্যাডে ২% বোনাস!
          </p>
        </div>

        {/* Error Alert with Quick Add Button */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-250 text-rose-800 p-3.5 rounded-2xl text-xs font-bold space-y-2.5 shadow-3xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span>⚠️</span>
                <span>{errorMessage}</span>
              </div>
              <button type="button" onClick={() => setErrorMessage('')} className="text-rose-500 font-black cursor-pointer p-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>
            {errorMessage.includes('ব্যালেন্স') && (
              <button
                type="button"
                onClick={() => {
                  setAddBalanceAmount(rechargeAmount || '');
                  setAddBalanceMsg(null);
                  setShowAddBalanceModal(true);
                  setErrorMessage('');
                }}
                className="w-full py-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white rounded-xl text-xs font-black shadow-xs flex items-center justify-center gap-1.5 transition active:scale-98 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>মেইন ওয়ালেট থেকে রিচার্জ ব্যালেন্স অ্যাড করুন (২% বোনাসসহ)</span>
              </button>
            )}
          </div>
        )}

        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4">
          
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            
            {/* Wallet Balances Overview */}
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80">
              <div className="bg-white p-2 rounded-xl border border-slate-200/60 shadow-3xs">
                <div className="text-[9px] font-bold text-slate-500 flex items-center justify-between">
                  <span>মেইন ওয়ালেট</span>
                  <span className="text-[7.5px] bg-emerald-100 text-emerald-800 font-extrabold px-1 py-0.2 rounded">মূল</span>
                </div>
                <div className="text-xs sm:text-sm font-black text-emerald-700 font-mono mt-0.5">
                  ৳{(user.balance || 0).toLocaleString('en-US')}
                </div>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-200/60 shadow-3xs">
                <div className="text-[9px] font-bold text-slate-500 flex items-center justify-between">
                  <span>রিচার্জ ওয়ালেট</span>
                  <span className="text-[7.5px] bg-amber-100 text-amber-800 font-extrabold px-1 py-0.2 rounded">+২% বোনাস</span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs sm:text-sm font-black text-rose-700 font-mono">
                    ৳{(user.telecomBalance || 0).toLocaleString('en-US')}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAddBalanceAmount(rechargeAmount || '');
                      setAddBalanceMsg(null);
                      setShowAddBalanceModal(true);
                    }}
                    className="bg-amber-400 hover:bg-amber-500 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 transition active:scale-95 shadow-3xs cursor-pointer"
                  >
                    <Plus className="w-2.5 h-2.5 stroke-[3]" />
                    <span>অ্যাড</span>
                  </button>
                </div>
              </div>
            </div>
            
            {/* Operator Selection Grid */}
            <div className="space-y-1.5">
              <label className="block text-[11px] text-slate-600 font-black tracking-wide">
                অপারেটর নির্বাচন করুন
              </label>
              <div className="grid grid-cols-6 gap-1.5">
                {operatorsList.map((op) => {
                  const isSelected = operator === op.id;
                  return (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => setOperator(op.id)}
                      className={`py-2 px-1 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95 ${
                        isSelected 
                          ? `${op.bg} ${op.border} border-2 ring-2 ring-indigo-500/30 font-black scale-102 shadow-xs` 
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-black text-white ${op.color} shadow-xs`}>
                        {op.short}
                      </div>
                      <span className="text-[8.5px] font-black block leading-none truncate max-w-full">
                        {op.short}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recipient Mobile Number */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-[11px] text-slate-600 font-black">প্রাপক মোবাইল নম্বর</label>
                <button 
                  type="button" 
                  onClick={() => setRecipientNumber(user.phone || '')} 
                  className="text-[10px] text-cyan-700 hover:underline font-extrabold"
                >
                  নিজের নম্বর ব্যবহার করুন ({user.phone || 'N/A'})
                </button>
              </div>
              <input
                type="tel"
                required
                maxLength={11}
                value={recipientNumber}
                onChange={(e) => setRecipientNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="01XXXXXXXXX (11 ডিজিট)"
                className="w-full p-2.5 bg-slate-50 border border-slate-250 rounded-xl font-mono text-sm font-bold text-slate-800 focus:bg-white focus:border-cyan-600 focus:outline-none transition"
              />
            </div>

            {/* Recharge Amount */}
            <div className="space-y-1">
              <label className="block text-[11px] text-slate-600 font-black">রিচার্জের পরিমাণ (৳)</label>
              <input
                type="number"
                required
                min={10}
                value={rechargeAmount}
                onChange={(e) => setRechargeAmount(e.target.value)}
                placeholder="10 - 1000 টাকা"
                className="w-full p-2.5 bg-slate-50 border border-slate-250 rounded-xl font-mono text-sm font-bold text-slate-800 focus:bg-white focus:border-cyan-600 focus:outline-none transition"
              />
            </div>

            {/* 4-digit Security PIN */}
            <div className="space-y-1">
              <label className="block text-[11px] text-slate-600 font-black">আপনার 4 ডিজিটের গোপন পিন নম্বর</label>
              <input
                type="password"
                required
                maxLength={4}
                value={rechargePin}
                onChange={(e) => setRechargePin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full p-2.5 bg-slate-50 border border-slate-250 rounded-xl text-center font-mono text-base tracking-widest text-slate-800 focus:bg-white focus:border-cyan-600 focus:outline-none transition"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-3.5 bg-gradient-to-r from-cyan-700 to-indigo-800 hover:from-cyan-800 hover:to-indigo-900 text-white font-black rounded-2xl text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-md active:scale-98 mt-2"
            >
              {isProcessing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-white" />
                  <span>ইনস্ট্যান্ট রিচার্জ সম্পন্ন করুন</span>
                </>
              )}
            </button>

          </form>

        </div>

      </main>

      {/* ================= MODAL 1: ADD MONEY TO RECHARGE BALANCE (2% BONUS / হাজারে ২০ টাকা) ================= */}
      <AnimatePresence>
        {showAddBalanceModal && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[100] bg-white flex flex-col font-sans"
          >
            {/* Top Spacer for Notification Bar */}
            <div className="h-10 shrink-0 bg-[#004a2c] w-full"></div>

            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-black">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 leading-tight">রিচার্জ ব্যালেন্স অ্যাড মানি</h3>
                  <p className="text-[10px] text-emerald-600 font-black mt-0.5">মেইন ব্যালেন্স থেকে ২% বোনাস</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddBalanceModal(false)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="max-w-sm mx-auto space-y-5">
                {/* Status Message */}
                {addBalanceMsg && (
                  <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-3xs ${
                    addBalanceMsg.type === 'error' ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  }`}>
                    <span className="leading-snug">{addBalanceMsg.text}</span>
                    <button type="button" onClick={() => setAddBalanceMsg(null)} className="text-slate-500 hover:text-slate-700 ml-2">×</button>
                  </div>
                )}

                {/* Wallet Summary */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 grid grid-cols-2 gap-3 text-center shadow-3xs">
                  <div className="bg-white p-3 rounded-2xl border border-slate-150">
                    <span className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">মেইন ওয়ালেট</span>
                    <span className="text-sm font-black text-emerald-700 font-mono">৳{(user.balance || 0).toLocaleString('en-US')}</span>
                  </div>
                  <div className="bg-white p-3 rounded-2xl border border-slate-150">
                    <span className="text-[10px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">বর্তমান রিচার্জ</span>
                    <span className="text-sm font-black text-rose-700 font-mono">৳{(user.telecomBalance || 0).toLocaleString('en-US')}</span>
                  </div>
                </div>

                <form onSubmit={handleAddBalanceSubmit} className="space-y-5 text-left">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <label className="text-[10px] font-black text-slate-500 block mb-1.5 uppercase tracking-wider">অ্যাড করার পরিমাণ (৳) *</label>
                    <input 
                      type="number" 
                      value={addBalanceAmount} 
                      onChange={(e) => setAddBalanceAmount(e.target.value)} 
                      required 
                      min={10}
                      className="w-full p-3 bg-white border border-slate-250 rounded-xl text-base font-mono font-bold focus:border-rose-500 focus:outline-none transition shadow-sm" 
                      placeholder="৳ 1000" 
                    />
                    
                    {/* Live 2% Bonus Calculation Display */}
                    {Number(addBalanceAmount) > 0 && (
                      <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl space-y-1.5 text-[11px]">
                        <div className="flex justify-between font-bold text-emerald-900">
                          <span>২% বোনাস কমিশন (হাজারে ২০৳):</span>
                          <span className="font-mono font-black">+৳{(Number(addBalanceAmount) * 0.02).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-black text-emerald-950 border-t border-emerald-200/60 pt-1.5">
                          <span>মোট রিচার্জ ওয়ালেটে যোগ হবে:</span>
                          <span className="font-mono text-sm text-emerald-700 font-black">
                            ৳{(Number(addBalanceAmount) * 1.02).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <label className="text-[10px] font-black text-slate-500 block mb-1.5 uppercase tracking-wider">সিকিউরিটি পিন নম্বর *</label>
                    <input 
                      type="password" 
                      value={addBalancePin} 
                      onChange={(e) => setAddBalancePin(e.target.value.replace(/\D/g, ''))} 
                      required 
                      maxLength={4} 
                      className="w-full p-3 bg-white border border-slate-250 rounded-xl text-center text-xl font-mono font-bold tracking-[1em] focus:border-rose-500 focus:outline-none transition shadow-sm" 
                      placeholder="••••" 
                    />
                  </div>

                  <div className="flex gap-3 pt-4 pb-10">
                    <button 
                      type="button" 
                      onClick={() => setShowAddBalanceModal(false)} 
                      className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 rounded-2xl text-sm font-black text-slate-600 transition active:scale-95"
                    >
                      বাতিল
                    </button>
                    <button 
                      type="submit" 
                      disabled={isProcessing} 
                      className="flex-1 py-4 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white rounded-2xl text-sm font-black shadow-lg shadow-rose-200 transition flex items-center justify-center gap-2 active:scale-95"
                    >
                      {isProcessing ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span>নিশ্চিত করুন</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= MODAL 2: TELECOM & RECHARGE TRANSACTION HISTORY ================= */}
      <AnimatePresence>
        {showTxHistoryModal && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[100] bg-white flex flex-col font-sans"
          >
            {/* Top Spacer for Notification Bar */}
            <div className="h-10 shrink-0 bg-[#004a2c] w-full"></div>

            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-black text-slate-900 leading-tight">রিচার্জ লেনদেন হিস্ট্রি</h3>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">অটো রিচার্জ ও ব্যালেন্স অ্যাডের বিবরণ</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowTxHistoryModal(false);
                  setTxSearchQuery('');
                }}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search & Tabs */}
            <div className="p-4 bg-slate-50/50 border-b border-slate-100 space-y-3">
              <div className="relative max-w-md mx-auto">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input 
                  type="text"
                  value={txSearchQuery}
                  onChange={(e) => setTxSearchQuery(e.target.value)}
                  placeholder="নম্বর, পরিমাণ বা অপারেটর দিয়ে খুঁজুন..."
                  className="w-full bg-white border border-slate-200 pl-9 pr-10 py-2.5 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 shadow-sm"
                />
                {txSearchQuery && (
                  <button 
                    onClick={() => setTxSearchQuery('')}
                    className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 absolute right-2 top-1.5 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 max-w-md mx-auto">
                <button
                  type="button"
                  onClick={() => setTxFilterTab('all')}
                  className={`py-2 rounded-xl text-[10.5px] font-black transition active:scale-95 shadow-3xs ${
                    txFilterTab === 'all' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  সকল ({txHistory.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTxFilterTab('recharge')}
                  className={`py-2 rounded-xl text-[10.5px] font-black transition active:scale-95 shadow-3xs ${
                    txFilterTab === 'recharge' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  রিচার্জ ({txHistory.filter(t => t.type === 'telecom_recharge').length})
                </button>
                <button
                  type="button"
                  onClick={() => setTxFilterTab('add_balance')}
                  className={`py-2 rounded-xl text-[10.5px] font-black transition active:scale-95 shadow-3xs ${
                    txFilterTab === 'add_balance' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  অ্যাড ব্যালেন্স ({txHistory.filter(t => t.type === 'telecom_add_balance').length})
                </button>
              </div>
            </div>

            {/* Transactions List */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="max-w-md mx-auto space-y-3">
                {loadingTx ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                    <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-black">লোডিং হচ্ছে...</span>
                  </div>
                ) : filteredTxHistory.length === 0 ? (
                  <div className="py-20 text-center space-y-2">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
                      <ClipboardList className="w-8 h-8" />
                    </div>
                    <p className="text-xs font-black text-slate-400">কোনো লেনদেন পাওয়া যায়নি</p>
                  </div>
                ) : (
                  filteredTxHistory.map((tx) => {
                    const isAdd = tx.type === 'telecom_add_balance';
                    const isApproved = tx.status === 'approved' || tx.status === 'success' || tx.status === 'completed';
                    const isRejected = tx.status === 'rejected' || tx.status === 'failed';

                    return (
                      <div
                        key={tx.id}
                        onClick={() => openReceiptForTx(tx)}
                        className="bg-white border border-slate-200 hover:border-indigo-300 p-4 rounded-2xl flex items-center justify-between gap-4 shadow-3xs transition cursor-pointer active:scale-98"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black shrink-0 shadow-3xs ${
                            isAdd ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'
                          }`}>
                            {isAdd ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black text-slate-900">
                                {tx.typeLabel || (isAdd ? 'রিচার্জ ব্যালেন্স অ্যাড' : 'মোবাইল রিচার্জ')}
                              </span>
                              {tx.operator && (
                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg text-[9px] font-black border border-slate-200">
                                  {tx.operator}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 font-bold mt-1">
                              {tx.phone || tx.receiverPhone ? `নম্বর: ${tx.phone || tx.receiverPhone}` : new Date(tx.createdAt || '').toLocaleString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`text-sm font-black font-mono block ${isAdd ? 'text-emerald-600' : 'text-slate-900'}`}>
                            {isAdd ? '+' : '-'}৳{Number(tx.amount || 0).toLocaleString('en-US')}
                          </span>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full mt-1.5 inline-block ${
                            isApproved ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 
                            isRejected ? 'bg-rose-50 text-rose-600 border border-rose-200' : 
                            'bg-amber-50 text-amber-600 border border-amber-200'
                          }`}>
                            {tx.status === 'pending' ? 'প্রসেসিং' : isApproved ? 'সফল' : 'ব্যর্থ'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="h-20" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction Receipt Modal */}
      {isReceiptOpen && receiptModalData && (
        <BNBPaymentReceiptModal
          isOpen={isReceiptOpen}
          data={receiptModalData}
          onClose={() => {
            setIsReceiptOpen(false);
            setReceiptModalData(null);
          }}
        />
      )}
    </div>
  );
}

