import React, { useState } from 'react';
import { User } from '../types';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { hashPinClientAsync } from '../lib/memberUtils';
import { Lock, Eye, EyeOff, ShieldCheck, X, AlertTriangle, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SetAppLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onLockSuccess: (secretCode: string) => void;
  appLanguage?: string;
  isMandatoryOnLogout?: boolean;
}

export default function SetAppLockModal({
  isOpen,
  onClose,
  user,
  onLockSuccess,
  appLanguage = 'bn',
  isMandatoryOnLogout = false
}: SetAppLockModalProps) {
  const isBn = appLanguage !== 'en';
  const [code, setCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [showConfirmCode, setShowConfirmCode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanCode = code.trim();
    const cleanConfirm = confirmCode.trim();

    if (cleanCode.length !== 4 || !/^\d{4}$/.test(cleanCode)) {
      setError(isBn ? 'পিন অবশ্যই 4 ডিজিটের সংখ্যা হতে হবে!' : 'PIN must be a 4-digit number!');
      return;
    }

    if (cleanCode !== cleanConfirm) {
      setError(isBn ? 'পিন এবং কনফার্ম পিন দুটির মিল নেই!' : 'PIN and Confirm PIN do not match!');
      return;
    }

    setLoading(true);

    // Save hashed PIN to Firestore
    if (user?.uid) {
      try {
        const pinHash = await hashPinClientAsync(cleanCode);
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          pinHash,
          pinSet: true,
          isAppLocked: true,
          pinFailedAttempts: 0,
          pinLockedUntil: 0,
          appLockResetRequested: false,
          appLockResetStatus: '',
          appLockUpdatedAt: new Date().toISOString()
        });
        if (user) {
          user.pinSet = true;
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error("Failed to save app lock code to Firestore:", err);
        }
      }
    }

    setCode('');
    setConfirmCode('');
    setLoading(false);
    onLockSuccess(cleanCode);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex flex-col bg-slate-900/60 backdrop-blur-sm">
        <div className="h-10 shrink-0 bg-[#004a2c] w-full"></div>
        
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="flex-1 bg-white rounded-t-[32px] flex flex-col overflow-hidden font-sans"
        >
          {/* Header */}
          <div className="bg-[#004a2c] p-5 text-white relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20">
                <ShieldCheck className="w-6 h-6 text-emerald-200" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">
                  {isMandatoryOnLogout
                    ? (isBn ? 'নিরাপদ লগআউট ও পিন লক' : 'Secure Logout & PIN Lock')
                    : (isBn ? 'অ্যাপ পিন লক সেটআপ' : 'App PIN Lock Setup')}
                </h3>
                <p className="text-[10px] text-emerald-100/70 font-medium tracking-wide uppercase">Application Security Module</p>
              </div>
            </div>
            {!isMandatoryOnLogout && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-white/80 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-4">
              <div className={`${isMandatoryOnLogout ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'} rounded-2xl p-5 flex gap-4 shadow-sm transition-colors`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${isMandatoryOnLogout ? 'bg-white text-rose-500' : 'bg-white text-amber-500'}`}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className={`text-sm font-black uppercase tracking-wider ${isMandatoryOnLogout ? 'text-rose-900' : 'text-amber-900'}`}>
                    {isBn ? 'গুরুত্বপূর্ণ সতর্কতা:' : 'Important Notice:'}
                  </h4>
                  <p className={`text-xs sm:text-sm font-bold leading-relaxed ${isMandatoryOnLogout ? 'text-rose-800' : 'text-amber-800'}`}>
                    {isMandatoryOnLogout ? (
                      isBn ? 'লগআউট করতে 4 ডিজিট পিন সেট/কনফার্ম করুন। পুনরায় অ্যাপে প্রবেশ করতে হুবহু এই পিনটি প্রয়োজন হবে।' : 'Set/confirm a 4-digit PIN to log out. You will need this exact PIN to re-enter the app.'
                    ) : (
                      isBn ? '4 ডিজিট সিকিউরিটি পিন সেট করুন। অ্যাপ লক আনলক করতে এই পিনটি দিতে হবে।' : 'Set a 4-digit security PIN. You will need this PIN to unlock the app.'
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-4 rounded-2xl font-bold flex items-start gap-2 shadow-sm"
              >
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* PIN Inputs */}
            <form id="app-lock-form" onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                    {isBn ? 'নতুন ৪ ডিজিট পিন দিন' : 'Enter 4-Digit PIN'}
                  </label>
                  <div className="relative">
                    <input
                      type={showCode ? 'text' : 'password'}
                      inputMode="numeric"
                      pattern="\d{4}"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      maxLength={4}
                      placeholder="••••"
                      className="w-full pl-12 pr-12 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xl font-black text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-600 transition-all tracking-[1em] text-center"
                      required
                    />
                    <KeyRound className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setShowCode(!showCode)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                    >
                      {showCode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                    {isBn ? 'পুনরায় নিশ্চিত করুন' : 'Confirm PIN'}
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmCode ? 'text' : 'password'}
                      inputMode="numeric"
                      pattern="\d{4}"
                      value={confirmCode}
                      onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      maxLength={4}
                      placeholder="••••"
                      className="w-full pl-12 pr-12 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xl font-black text-slate-900 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-600 transition-all tracking-[1em] text-center"
                      required
                    />
                    <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setShowConfirmCode(!showConfirmCode)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                    >
                      {showConfirmCode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="p-6 bg-slate-50 border-t border-slate-100 grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading || isMandatoryOnLogout}
              className={`py-4 bg-white hover:bg-slate-100 text-slate-600 font-black rounded-2xl border border-slate-200 transition-all active:scale-95 cursor-pointer text-center text-sm ${isMandatoryOnLogout ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isBn ? 'বাতিল' : 'Cancel'}
            </button>
            <button
              type="submit"
              form="app-lock-form"
              disabled={loading || code.length !== 4 || confirmCode.length !== 4}
              className={`col-span-2 py-4 px-6 ${isMandatoryOnLogout ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' : 'bg-emerald-700 hover:bg-emerald-800 shadow-emerald-700/20'} text-white font-black rounded-2xl text-base shadow-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed`}
            >
              {loading ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>সংরক্ষণ হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  <span>
                    {isMandatoryOnLogout
                      ? (isBn ? 'লক করে লগআউট করুন' : 'Lock & Log Out')
                      : (isBn ? 'অ্যাপ লক সম্পন্ন করুন' : 'Setup App Lock')}
                  </span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
