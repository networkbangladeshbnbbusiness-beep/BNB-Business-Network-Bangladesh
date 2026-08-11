import React, { useState } from 'react';
import { User } from '../types';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
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

    if (cleanCode.length < 4 || cleanCode.length > 12) {
      setError('পাসওয়ার্ড কোডটি অবশ্যই ৪ থেকে ১২ অক্ষরের/সংখ্যার হতে হবে!');
      return;
    }

    if (cleanCode !== cleanConfirm) {
      setError('গোপন লকিং কোড এবং কনফার্ম কোড দুটির মিল নেই!');
      return;
    }

    setLoading(true);

    // Save to Firestore asynchronously in background without blocking UI
    if (user?.uid) {
      const userRef = doc(db, 'users', user.uid);
      updateDoc(userRef, {
        isAppLocked: true,
        appLockCode: cleanCode,
        appLockResetRequested: false,
        appLockResetStatus: ''
      }).catch((err) => {
        console.error("Failed to save app lock code to Firestore:", err);
      });
    }

    // Instant UI update (< 0.1 sec)
    setTimeout(() => {
      setCode('');
      setConfirmCode('');
      setLoading(false);
      onLockSuccess(cleanCode);
      onClose();
    }, 100);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 relative text-left overflow-hidden"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-2xl ${isMandatoryOnLogout ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'} border flex items-center justify-center shrink-0`}>
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 flex items-center gap-1.5">
                {isMandatoryOnLogout ? '🔒 লগআউট ও গোপন অ্যাপ লক সেটআপ' : '🔒 গোপন অ্যাপ লক সেটআপ'}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                সিকিউরিটি লক পাসওয়ার্ড (৪ - ১২ ডিজিট/অক্ষর)
              </p>
            </div>
          </div>

          {/* Warning / Instructions Box */}
          <div className={`${isMandatoryOnLogout ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-amber-50 border-amber-200/70 text-amber-900'} border p-3.5 rounded-2xl text-[11px] leading-relaxed mb-4 flex items-start gap-2.5 shadow-xs`}>
            <AlertTriangle className={`w-4.5 h-4.5 ${isMandatoryOnLogout ? 'text-rose-600' : 'text-amber-600'} shrink-0 mt-0.5`} />
            <div>
              {isMandatoryOnLogout ? (
                <span><strong>লগআউট ও অ্যাপ লক নিয়ম:</strong> অ্যাপ থেকে নিরাপদ লগআউট হতে ৪ থেকে ১২ অক্ষরের/সংখ্যার একটি সিক্রেট পাসওয়ার্ড দুইবার লিখে সেট করুন। পরবর্তীতে অ্যাপে প্রবেশ করতে বা আনলক করতে পিন কোড দিলে খুলবে না, হুবহু এই সেট করা পাসওয়ার্ড দিতে হবে।</span>
              ) : (
                <span><strong>গুরুত্বপূর্ণ নিয়ম:</strong> ৪ থেকে ১২ অক্ষরের বা সংখ্যার একটি সিক্রেট লকিং পাসওয়ার্ড দুইবার দিন। অ্যাপ লক করার পর পিন কোড দিলে খুলবে না, সেম পাসওয়ার্ড দিয়ে আনলক করতে হবে।</span>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-bold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input 1 */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                গোপন লকিং কোড (৪ - ১২ ডিজিট/অক্ষর) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showCode ? 'text' : 'password'}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={12}
                  placeholder="যেমন: bnb987654 বা 1234"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  required
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                >
                  {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[10px] text-slate-400 font-medium block mt-1">
                দৈর্ঘ্য: {code.length}/12 (সর্বনিম্ন ৪ অক্ষর/সংখ্যা)
              </span>
            </div>

            {/* Input 2 */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                গোপন লকিং কোডটি পুনরায় লিখুন <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmCode ? 'text' : 'password'}
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  maxLength={12}
                  placeholder="কনফার্ম পাসওয়ার্ড লিখুন"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  required
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowConfirmCode(!showConfirmCode)}
                  className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                >
                  {showConfirmCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit & Cancel Actions */}
            <div className="pt-2 flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="w-1/3 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer text-center"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`w-2/3 py-2.5 px-4 ${isMandatoryOnLogout ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'} text-white font-extrabold rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5`}
              >
                {loading ? (
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    {isMandatoryOnLogout ? 'পাসওয়ার্ড দিয়ে লগআউট করুন' : 'অ্যাপ লক করুন (Lock App)'}
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
