import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ShieldCheck, AlertCircle, RefreshCw, ExternalLink, ArrowLeft, Loader2, Check, Smartphone, Lock } from 'lucide-react';
import { apiUrl, getReturnOrigin, isStrictNative } from '../config/api';
import { useBackHandler } from '../lib/navigationManager';
import UnifiedBackButton from './UnifiedBackButton';
import { Browser } from '@capacitor/browser';
import { db, auth } from '../lib/firebase';
import { doc, setDoc, getDoc, updateDoc, runTransaction } from 'firebase/firestore';

export interface JenifyPaymentGatewayProps {
  onConfirm?: (amount: number, method: string) => void;
  onBack?: () => void;
  isLoading?: boolean;
  currentUser?: any;
  onPaymentSuccess?: (amount: number, newBalance: number, trxId: string) => void;
}

export const JenifyPaymentGateway: React.FC<JenifyPaymentGatewayProps> = ({ 
  onConfirm, 
  onBack, 
  isLoading: parentLoading,
  currentUser,
  onPaymentSuccess
}) => {
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'input' | 'redirecting' | 'success'>('input');
  const [localLoading, setLocalLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeInvoice, setActiveInvoice] = useState<{
    val_id: string;
    invoice_id: string;
    amount: number;
    payment_url: string;
  } | null>(null);
  const [successDetails, setSuccessDetails] = useState<{
    amount: number;
    newBalance: number;
    trxId: string;
  } | null>(null);

  const quickAmounts = [50, 100, 200, 500, 1000, 2000, 5000];
  const pollIntervalRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const iframeLoadCountRef = useRef<number>(0);

  // Return to Dashboard cleanly on Back button or hardware/gesture back
  const handleReturnToDashboard = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    // If there was a pending invoice when pressing Back, verify once in background so if payment succeeded, the user sees it on Dashboard
    try {
      const pendingRaw = localStorage.getItem('amb_pending_zinipay_invoice');
      const invToCheck = activeInvoice || (pendingRaw ? JSON.parse(pendingRaw) : null);
      localStorage.removeItem('amb_zinipay_redirect_active');
      if (invToCheck && (invToCheck.val_id || invToCheck.invoice_id)) {
        const targetUid = getUserUid();
        fetch(apiUrl('/api/payment/check-status'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            val_id: invToCheck.val_id,
            invoice_id: invToCheck.invoice_id,
            userId: targetUid
          })
        })
          .then(r => r.json())
          .then(data => {
            if (data && data.success && data.status === 'completed') {
              try { localStorage.removeItem('amb_pending_zinipay_invoice'); } catch (e) {}
              const confirmedAmount = Number(data.amount || invToCheck.amount || 0);
              const newBal = Number(data.newBalance || 0);
              const trxId = data.trxId || invToCheck.invoice_id || invToCheck.val_id;
              window.dispatchEvent(new CustomEvent('bnb_payment_completed_on_return', {
                detail: { amount: confirmedAmount, newBalance: newBal, trxId }
              }));
            } else {
              try { localStorage.removeItem('amb_pending_zinipay_invoice'); } catch (e) {}
            }
          })
          .catch(() => {});
      }
    } catch (e) {}

    setStep('input');
    setActiveInvoice(null);
    try {
      window.dispatchEvent(new CustomEvent('bnb_force_return_to_dashboard'));
      window.dispatchEvent(new CustomEvent('bnb_reveal_dashboard_balance'));
      if (typeof window !== 'undefined') {
        window.history.replaceState({ amb_root: true }, '', '/dashboard');
      }
    } catch (e) {}
    if (onBack) {
      onBack();
    }
  };

  // Hardware / System back gesture handler: Returns cleanly to Dashboard without exiting app
  useBackHandler(() => {
    handleReturnToDashboard();
    return true;
  }, true, 50);

  // Helper to resolve user ID safely across all object formats and local storage (never prioritizing anonymous Firebase auth UID over stored user UID)
  const getUserUid = (): string => {
    const isValidRealUid = (id?: any) => {
      if (!id || typeof id !== 'string') return false;
      const trimmed = id.trim();
      return trimmed.length > 0 && !trimmed.startsWith('user_member_') && !trimmed.startsWith('user_fallback_');
    };
    if (isValidRealUid(currentUser?.uid)) return String(currentUser.uid).trim();
    if (isValidRealUid(currentUser?.id)) return String(currentUser.id).trim();
    if (isValidRealUid(currentUser?.userId)) return String(currentUser.userId).trim();
    if (typeof window !== 'undefined') {
      try {
        const lastRaw = localStorage.getItem('amb_last_user') || localStorage.getItem('bnb_last_user');
        if (lastRaw) {
          const parsed = JSON.parse(lastRaw);
          if (isValidRealUid(parsed?.uid)) return String(parsed.uid).trim();
        }
      } catch (e) {}
      const ambUid = localStorage.getItem('amb_user_uid');
      if (isValidRealUid(ambUid)) return ambUid!.trim();
      const bnbUid = localStorage.getItem('bnb_user_uid');
      if (isValidRealUid(bnbUid)) return bnbUid!.trim();
    }
    if (auth.currentUser?.uid) return auth.currentUser.uid;
    return '';
  };

  // Helper to resolve user phone safely
  const getUserPhone = (): string => {
    if (currentUser?.phone) return String(currentUser.phone).trim();
    if (currentUser?.userPhone) return String(currentUser.userPhone).trim();
    if (currentUser?.phoneNumber) return String(currentUser.phoneNumber).trim();
    if (typeof window !== 'undefined') {
      try {
        const lastRaw = localStorage.getItem('amb_last_user') || localStorage.getItem('bnb_last_user');
        if (lastRaw) {
          const parsed = JSON.parse(lastRaw);
          if (parsed?.phone) return String(parsed.phone).trim();
        }
      } catch (e) {}
      const ambPhone = localStorage.getItem('amb_user_phone');
      if (ambPhone && ambPhone.trim()) return ambPhone.trim();
    }
    if (auth.currentUser?.phoneNumber) return auth.currentUser.phoneNumber;
    return '';
  };

  // Silent background status checker via server API only
  const checkPaymentStatusSilently = async () => {
    if (!activeInvoice) return;

    const targetUserId = getUserUid();

    try {
      const res = await fetch(apiUrl('/api/payment/check-status'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          val_id: activeInvoice.val_id,
          invoice_id: activeInvoice.invoice_id,
          userId: targetUserId
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.status === 'completed') {
          const confirmedAmount = Number(data.amount || activeInvoice.amount);
          const newBal = Number(data.newBalance || 0);
          const trxId = data.trxId || activeInvoice.invoice_id || `ZP_${Date.now()}`;

          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }

          try {
            await Browser.close();
          } catch (e) {}

          try {
            localStorage.removeItem('amb_pending_zinipay_invoice');
          } catch (e) {}

          setSuccessDetails({
            amount: confirmedAmount,
            newBalance: newBal,
            trxId
          });
          setStep('success');

          try {
            if (typeof window !== 'undefined') {
              const cur = Number(localStorage.getItem('amb_user_balance') || '0');
              const updated = cur + confirmedAmount;
              localStorage.setItem('amb_user_balance', String(newBal || updated));
              window.dispatchEvent(new CustomEvent('amb_admin_sync_tick', { detail: { time: Date.now() } }));
              window.dispatchEvent(new CustomEvent('bnb_balance_updated', { detail: { amount: confirmedAmount, newBalance: newBal } }));
            }
          } catch (e) {}

          if (onPaymentSuccess) {
            onPaymentSuccess(confirmedAmount, newBal, trxId);
          }
          try {
            window.dispatchEvent(new CustomEvent('bnb_payment_completed_on_return', {
              detail: { amount: confirmedAmount, newBalance: newBal, trxId }
            }));
            window.dispatchEvent(new CustomEvent('bnb_reveal_dashboard_balance'));
          } catch (e) {}
          return;
        }

        if (data && (data.status === 'cancelled' || data.status === 'failed')) {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          try {
            await Browser.close();
          } catch (e) {}
          try {
            localStorage.removeItem('amb_pending_zinipay_invoice');
          } catch (e) {}
          try {
            window.dispatchEvent(new CustomEvent('bnb_payment_cancelled_or_failed', {
              detail: {
                status: data.status,
                message: data.message || (data.status === 'cancelled' ? 'পেমেন্ট বাতিল করা হয়েছে।' : 'পেমেন্ট সম্পন্ন হতে পারেনি।')
              }
            }));
          } catch (e) {}
          setActiveInvoice(null);
          setStep('input');
          handleReturnToDashboard();
          return;
        }
      }
    } catch (err: any) {
      // Background polling silent catch
    }
  };

  // On mount: Check for recently saved pending invoice and verify status immediately
  useEffect(() => {
    try {
      const savedRaw = localStorage.getItem('amb_pending_zinipay_invoice');
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (parsed && (parsed.invoice_id || parsed.val_id)) {
          setActiveInvoice(parsed);
          const targetUid = getUserUid();
          fetch(apiUrl('/api/payment/check-status'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              val_id: parsed.val_id,
              invoice_id: parsed.invoice_id,
              userId: targetUid
            })
          }).then(r => r.json()).then(data => {
            if (data && (data.status === 'completed' || data.success)) {
              localStorage.removeItem('amb_pending_zinipay_invoice');
              const confirmedAmount = Number(data.amount || parsed.amount);
              const newBal = Number(data.newBalance || 0);
              const trxId = data.trxId || parsed.invoice_id;
              setSuccessDetails({
                amount: confirmedAmount,
                newBalance: newBal,
                trxId
              });
              setStep('success');
              if (onPaymentSuccess) {
                onPaymentSuccess(confirmedAmount, newBal, trxId);
              }
            } else if (data && (data.status === 'cancelled' || data.status === 'failed')) {
              localStorage.removeItem('amb_pending_zinipay_invoice');
              setActiveInvoice(null);
            }
          }).catch(() => {});
        }
      }
    } catch (e) {}
  }, [currentUser?.uid, onPaymentSuccess]);

  // Start silent background verification when redirecting (800ms sub-second polling for instant close)
  useEffect(() => {
    if (step === 'redirecting' && activeInvoice) {
      pollIntervalRef.current = setInterval(() => {
        checkPaymentStatusSilently();
      }, 800);

      let browserFinishedSub: any = null;
      try {
        Browser.addListener('browserFinished', () => {
          handleReturnToDashboard();
        }).then(sub => { browserFinishedSub = sub; }).catch(() => {});
      } catch (e) {}

      // Listen for postMessage from callback/cancel/dashboard inside iframe
      const handleIframeMessage = (ev: MessageEvent) => {
        const msg = ev?.data;
        if (!msg || typeof msg !== 'object' || msg.type !== 'BNB_PAYMENT_IFRAME_RESULT') return;
        const st = String(msg.status || '').toLowerCase();
        if (st === 'cancelled' || st === 'cancel' || st === 'failed') {
          try {
            localStorage.removeItem('amb_pending_zinipay_invoice');
            localStorage.removeItem('amb_zinipay_redirect_active');
            window.dispatchEvent(new CustomEvent('bnb_payment_cancelled_or_failed', {
              detail: {
                status: st === 'failed' ? 'failed' : 'cancelled',
                message: st === 'failed' ? 'পেমেন্ট সম্পন্ন হতে পারেনি।' : 'পেমেন্ট বাতিল করা হয়েছে।'
              }
            }));
          } catch (e) {}
          handleReturnToDashboard();
        } else if (st === 'success' || st === 'completed') {
          checkPaymentStatusSilently();
        }
      };

      window.addEventListener('message', handleIframeMessage);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        if (browserFinishedSub && typeof browserFinishedSub.remove === 'function') {
          browserFinishedSub.remove();
        }
        window.removeEventListener('message', handleIframeMessage);
      };
    }
  }, [step, activeInvoice]);

  // Handle Initiate Payment: User selects amount -> Secure server API call
  const handleProceedToPayment = async () => {
    const numAmount = Number(amount);
    if (!numAmount || numAmount < 10) {
      setErrorMsg('সর্বনিম্ন জমার পরিমাণ ১০ টাকা।');
      return;
    }

    if (numAmount > 100000) {
      setErrorMsg('সর্বোচ্চ জমার পরিমাণ ১০০,০০০ টাকা।');
      return;
    }

    const targetUserId = getUserUid();
    if (!targetUserId) {
      setErrorMsg('ব্যবহারকারী শনাক্ত করা যায়নি। দয়া করে পুনরায় লগইন করুন।');
      return;
    }

    const targetPhone = getUserPhone();

    setErrorMsg('');
    setLocalLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const endpoint = apiUrl('/api/payment/create');
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          amount: numAmount,
          userId: targetUserId,
          phone: targetPhone,
          email: currentUser?.email || '',
          memberId: currentUser?.memberId || '',
          name: currentUser?.name || '',
          return_origin: typeof window !== 'undefined' ? getReturnOrigin() : undefined
        })
      });
      clearTimeout(timeoutId);

      const responseText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        throw new Error('পেমেন্ট সার্ভার থেকে সঠিক উত্তর পাওয়া যায়নি। অনুগ্রহ করে ইন্টারনেট সংযোগ চেক করে আবার চেষ্টা করুন।');
      }

      if (!res.ok) {
        throw new Error(data?.error || data?.message || 'পেমেন্ট তৈরি করতে ব্যর্থ হয়েছে।');
      }

      if (data && data.success && data.payment_url) {
        const activeInv = {
          invoice_id: data.invoice_id,
          val_id: data.val_id || data.invoice_id,
          amount: numAmount,
          payment_url: data.payment_url
        };
        iframeLoadCountRef.current = 0;
        setActiveInvoice(activeInv);
        setStep('redirecting');
        try {
          localStorage.setItem('amb_pending_zinipay_invoice', JSON.stringify(activeInv));
          localStorage.setItem('amb_zinipay_redirect_active', String(Date.now()));
        } catch (e) {}

        // Save current user explicitly to localStorage so session survives any state transition
        if (currentUser && currentUser.uid && !String(currentUser.uid).startsWith('user_member_') && !String(currentUser.uid).startsWith('user_fallback_')) {
          try {
            localStorage.setItem('amb_last_user', JSON.stringify(currentUser));
            localStorage.setItem('amb_user_uid', currentUser.uid);
            if (currentUser.phone) localStorage.setItem('amb_user_phone', currentUser.phone);
            if (currentUser.name) localStorage.setItem('amb_user_name', currentUser.name);
            if (currentUser.role) localStorage.setItem('amb_user_role', currentUser.role);
            if (currentUser.memberId) localStorage.setItem('bnb_user_member_id', currentUser.memberId);
            if (currentUser.balance !== undefined) localStorage.setItem('amb_user_balance', String(currentUser.balance));
            sessionStorage.setItem('amb_session_unlocked', 'true');
          } catch (e) {}
        }

        // Push a history entry so pressing Hardware/Browser Back returns directly to Dashboard without leaving the app
        try {
          window.history.pushState({ amb_zinipay_modal: true }, '');
        } catch (e) {}
      } else {
        setErrorMsg(data?.error || 'পেমেন্ট গেটওয়ে থেকে সঠিক লিংক পাওয়া যায়নি।');
      }
    } catch (serverErr: any) {
      if (serverErr.name === 'AbortError') {
        setErrorMsg('সার্ভার থেকে কোনো সাড়া পাওয়া যায়নি। দয়া করে আবার চেষ্টা করুন।');
      } else if (!navigator.onLine) {
        setErrorMsg('নেটওয়ার্ক সংযোগে সমস্যা হয়েছে। দয়া করে ইন্টারনেট সংযোগ চেক করুন।');
      } else {
        setErrorMsg(serverErr.message || 'পেমেন্ট ব্যর্থ হয়েছে। দয়া করে সঠিক তথ্য দিয়ে আবার চেষ্টা করুন।');
      }
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <UnifiedBackButton onClick={handleReturnToDashboard} label="ফিরে যান" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">অনলাইন পেমেন্ট গেটওয়ে (ZiniPay)</h2>
      </div>

      {step === 'input' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="w-6 h-6 shrink-0" />
            <p className="text-sm">আপনার অ্যাকাউন্টে তাৎক্ষণিকভাবে ব্যালেন্স যোগ করতে নিরাপদ অনলাইন পেমেন্ট ব্যবহার করুন।</p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              জমার পরিমাণ (টাকা)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-lg font-bold text-slate-400">৳</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="যেমন: ৫০০"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="mb-6">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3">দ্রুত পরিমাণ নির্বাচন:</p>
            <div className="grid grid-cols-4 gap-2">
              {quickAmounts.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(String(q))}
                  className="py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/50 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 transition"
                >
                  ৳{q}
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl space-y-2">
              <div className="flex items-center gap-3 text-rose-700 dark:text-rose-300 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button
                type="button"
                onClick={handleReturnToDashboard}
                className="text-xs font-bold text-rose-800 dark:text-rose-300 underline cursor-pointer hover:opacity-80 block"
              >
                ← ড্যাশবোর্ডে ফিরে যান
              </button>
            </div>
          )}

          <button
            onClick={handleProceedToPayment}
            disabled={localLoading || !amount}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-base shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition"
          >
            {localLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>প্রসেস হচ্ছে...</span>
              </>
            ) : (
              <>
                <span>পেমেন্ট গেটওয়েতে এগিয়ে যান</span>
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      )}

      {step === 'redirecting' && activeInvoice && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/95 flex flex-col">
          {/* Top Bar: Always visible in-app header so user can go back to Dashboard anytime with 1 tap */}
          <div className="bg-emerald-800 text-white px-3 py-2.5 flex items-center justify-between shadow-md shrink-0">
            <button
              type="button"
              onClick={handleReturnToDashboard}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 active:scale-95 rounded-xl text-xs font-extrabold text-white transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>ড্যাশবোর্ডে ফিরে যান</span>
            </button>

            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold truncate px-2">
              <Lock className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span>নিরাপদ পেমেন্ট (৳{activeInvoice.amount})</span>
            </div>

            <button
              type="button"
              onClick={async () => {
                setLocalLoading(true);
                await checkPaymentStatusSilently();
                setLocalLoading(false);
              }}
              disabled={localLoading}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-extrabold transition cursor-pointer shrink-0"
            >
              {localLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>যাচাই</span>
            </button>
          </div>

          {/* Embedded Sandboxed ZiniPay Checkout: Cannot trigger intent:// or bnbnetwork:// or leave the app */}
          <div className="relative flex-1 w-full bg-white overflow-hidden">
            {/* Official BNB Company Logo over the default shop icon spot */}
            <div
              className="pointer-events-none select-none z-10 rounded-full bg-white flex items-center justify-center overflow-hidden"
              style={{
                position: 'absolute',
                top: '72px',
                left: 'calc(50% - 149px)',
                width: '64px',
                height: '64px',
                padding: '3px',
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)',
                border: '1px solid #e2e8f0'
              }}
            >
              <img
                src="/app_icon.png"
                alt="BNB Business Network Bangladesh"
                className="w-full h-full rounded-full object-cover"
              />
            </div>

            <iframe
              ref={iframeRef}
              src={activeInvoice.payment_url}
              title="ZiniPay Secure Checkout"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              allow="clipboard-read; clipboard-write"
              onLoad={() => {
                iframeLoadCountRef.current += 1;
                // First load is secure.zinipay.com itself; subsequent loads may be operator selection (bKash/Nagad) OR final redirect_url / cancel_url
                if (iframeLoadCountRef.current >= 2) {
                  let isExplicitCancelRedirect = false;
                  try {
                    const href = iframeRef.current?.contentWindow?.location?.href || '';
                    if (href.includes('payment_status=cancelled') || href.includes('status=cancelled') || href.includes('zinipay-cancel')) {
                      isExplicitCancelRedirect = true;
                    }
                  } catch (e) {
                    // Cross-origin means the iframe is still on ZiniPay / bKash / Nagad checkout page! Do NOT cancel!
                  }

                  if (isExplicitCancelRedirect) {
                    try {
                      localStorage.removeItem('amb_pending_zinipay_invoice');
                      localStorage.removeItem('amb_zinipay_redirect_active');
                      window.dispatchEvent(new CustomEvent('bnb_payment_cancelled_or_failed', {
                        detail: { status: 'cancelled', message: 'পেমেন্ট বাতিল করা হয়েছে।' }
                      }));
                    } catch (e) {}
                    handleReturnToDashboard();
                    return;
                  }

                  // Silently check status with server; only close if server confirms completed, cancelled, or failed (never cancel if still pending on checkout!)
                  checkPaymentStatusSilently();
                }
              }}
              className="w-full h-full border-0 bg-white"
            />
          </div>
        </div>
      )}

      {step === 'success' && successDetails && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 text-center border border-slate-100 dark:border-slate-800">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">পেমেন্ট সফল হয়েছে!</h3>
          <p className="text-emerald-600 dark:text-emerald-400 font-bold text-lg mb-6">৳{successDetails.amount.toLocaleString('en-BD')} টাকা জমা হয়েছে</p>
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl text-left mb-6 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">নতুন ব্যালেন্স:</span>
              <span className="font-bold text-slate-900 dark:text-white">৳{successDetails.newBalance.toLocaleString('en-BD')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">ট্রানজেকশন আইডি:</span>
              <span className="font-mono text-slate-900 dark:text-white">{successDetails.trxId}</span>
            </div>
          </div>
          <button
            onClick={handleReturnToDashboard}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-base shadow-lg transition"
          >
            ড্যাশবোর্ডে ফিরে যান
          </button>
        </div>
      )}
    </div>
  );
};
