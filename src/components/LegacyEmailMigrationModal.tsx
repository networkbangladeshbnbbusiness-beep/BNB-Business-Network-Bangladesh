import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore';
import { User } from '../types';
import { normalizePhoneNumber } from '../lib/memberUtils';
import { ShieldCheck, Mail, Phone, CheckCircle2, AlertTriangle, Search, ArrowRight, X, RefreshCw, Sparkles, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LegacyEmailMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEmailLinked: (email: string) => void;
}

export function LegacyEmailMigrationModal({
  isOpen,
  onClose,
  onEmailLinked
}: LegacyEmailMigrationModalProps) {
  const [phoneInput, setPhoneInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  // Search existing user by phone number
  const handleSearchAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const raw = phoneInput.trim();
    if (!raw) {
      setError('অনুগ্রহ করে আপনার পূর্বে ব্যবহৃত মোবাইল নম্বরটি লিখুন।');
      return;
    }

    setSearching(true);
    setFoundUser(null);

    try {
      const normalized = normalizePhoneNumber(raw);
      const cleanDigits = raw.replace(/\D/g, '');
      const withPlus = raw.startsWith('+') ? raw : `+${cleanDigits}`;
      const withoutPlus = raw.replace(/^\+/, '');

      // Query variants to guarantee match
      const usersRef = collection(db, 'users');
      const queries = [
        query(usersRef, where('phone', '==', raw)),
        query(usersRef, where('phone', '==', normalized)),
        query(usersRef, where('phone', '==', withoutPlus)),
        query(usersRef, where('phone', '==', withPlus)),
        query(usersRef, where('normalizedPhone', '==', normalized)),
        query(usersRef, where('phoneNumber', '==', raw)),
        query(usersRef, where('phoneNumber', '==', normalized))
      ];

      let matchedUser: User | null = null;
      for (const q of queries) {
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0];
          matchedUser = { uid: d.id, ...d.data() } as User;
          break;
        }
      }

      if (!matchedUser) {
        // Fallback: check if phone input is Member ID
        const memberIdQuery = query(usersRef, where('memberId', '==', raw.toUpperCase()));
        const memberSnap = await getDocs(memberIdQuery);
        if (!memberSnap.empty) {
          const d = memberSnap.docs[0];
          matchedUser = { uid: d.id, ...d.data() } as User;
        }
      }

      if (matchedUser) {
        setFoundUser(matchedUser);
        if (matchedUser.email) {
          setNewEmail(matchedUser.email);
        }
      } else {
        setError('এই মোবাইল নম্বরে পূর্বে কোনো অ্যাকাউন্ট খুঁজে পাওয়া যায়নি। অনুগ্রহ করে নম্বরটি সঠিকভাবে টাইপ করুন।');
      }
    } catch (err: any) {
      console.error('Error finding user by phone:', err);
      setError('অ্যাকাউন্ট খুঁজতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setSearching(false);
    }
  };

  // Save new email to found user's old account
  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundUser) return;
    setError('');

    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('অনুগ্রহ করে একটি সঠিক ও সক্রিয় ইমেইল ঠিকানা (যেমন: example@gmail.com) লিখুন।');
      return;
    }

    setSaving(true);
    try {
      // Check if this email is already registered to ANOTHER user
      const emailQuery = query(collection(db, 'users'), where('email', '==', cleanEmail));
      const emailSnap = await getDocs(emailQuery);

      if (!emailSnap.empty) {
        const existingDoc = emailSnap.docs[0];
        if (existingDoc.id !== foundUser.uid) {
          setError('এই ইমেইলটি ইতোমধ্যে অন্য একটি অ্যাকাউন্টে লিঙ্ক করা রয়েছে। অনুগ্রহ করে আপনার নিজস্ব স্বতন্ত্র ইমেইল দিন।');
          setSaving(false);
          return;
        }
      }

      const targetUid = foundUser.uid || (foundUser as any).id;
      const targetMemberId = foundUser.memberId || 'BNB Member';

      // 1. Update user document with email in Firestore
      await updateDoc(doc(db, 'users', targetUid), {
        email: cleanEmail,
        updatedAt: new Date().toISOString()
      });

      // 2. Add confirmation notification in user_notifications
      const notifId = `email-link-${Date.now()}`;
      try {
        await setDoc(doc(db, 'user_notifications', notifId), {
          id: notifId,
          userId: targetUid,
          category: 'account_update',
          title: '🔐 অ্যাকাউন্টে নতুন ইমেইল সফলভাবে লিঙ্ক হয়েছে',
          body: `আপনার পূর্বের অ্যাকাউন্ট (${targetMemberId})-এ লগইন ইমেইল হিসেবে ${cleanEmail} সফলভাবে সংরক্ষণ করা হয়েছে। আপনার পূর্বের সমস্ত ব্যালেন্স ও সঞ্চয় ডাটাবেজ সুরক্ষিত রয়েছে।`,
          read: false,
          createdAt: new Date().toISOString()
        });
      } catch (notifErr) {
        console.warn('Notification log warning:', notifErr);
      }

      setSuccess(true);
    } catch (err: any) {
      console.error('Error updating user email:', err);
      setError('ইমেইল সংরক্ষণ করতে সমস্যা হয়েছে: ' + (err.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed inset-0 z-[100] bg-white flex flex-col font-sans text-slate-800"
        >
          {/* Top Spacer for Notification Bar */}
          <div className="h-10 shrink-0 bg-[#004a2c] w-full"></div>

          {/* Modal Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0 border border-cyan-200">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 leading-tight">
                  অ্যাকাউন্ট রিকভারি
                </h3>
                <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                  নতুন ইমেইল লিঙ্ক করুন
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-md mx-auto space-y-5">
              {/* Informational Notice */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 space-y-1.5 shadow-3xs">
                <div className="font-black flex items-center gap-1.5 text-amber-950 uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>জরুরি নির্দেশনা</span>
                </div>
                <p className="text-[11px] font-bold text-amber-800 leading-relaxed">
                  আপনার পূর্বে ব্যবহৃত মোবাইল নম্বর দিয়ে একাউন্টটি খুঁজুন এবং একটি সচল ইমেইল সেট করুন। ভবিষ্যতে এই ইমেইল দিয়েই লগইন করতে পারবেন।
                </p>
              </div>

              {error && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-black flex items-center gap-2 shadow-3xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {/* Success Screen */}
              {success ? (
                <div className="text-center py-10 space-y-4">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200 shadow-lg shadow-emerald-100">
                    <CheckCircle2 className="w-12 h-12" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-lg font-black text-slate-900">
                      ইমেইল লিঙ্ক সফল!
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto font-bold">
                      অভিনন্দন! আপনার অ্যাকাউন্টে নতুন লগইন ইমেইল হিসেবে <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono font-black">{newEmail}</span> সফলভাবে লিঙ্ক হয়েছে।
                    </p>
                  </div>
                  <div className="pt-4">
                    <button
                      onClick={() => {
                        onEmailLinked(newEmail);
                        onClose();
                      }}
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-200 transition flex items-center justify-center gap-2"
                    >
                      <span>লগইন করুন</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* STEP 1: Search by Old Phone Number */}
                  <form onSubmit={handleSearchAccount} className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">
                        ১. পূর্বে ব্যবহৃত মোবাইল নম্বর *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          placeholder="017XXXXXXXX"
                          className="w-full pl-10 pr-3 py-3 bg-white border border-slate-200 rounded-xl text-sm font-mono font-black text-slate-900 focus:outline-none focus:border-cyan-500 transition shadow-sm"
                        />
                        <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={searching || !phoneInput.trim()}
                      className="w-full py-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-lg transition flex items-center justify-center gap-2 active:scale-95"
                    >
                      {searching ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>খোঁজা হচ্ছে...</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4" />
                          <span>অ্যাকাউন্ট খুঁজুন</span>
                        </>
                      )}
                    </button>
                  </form>

                  {/* STEP 2: Show Found Account & Enter New Email */}
                  {foundUser && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4 pt-4 border-t border-slate-100"
                    >
                      {/* Found User Summary Card */}
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3 shadow-3xs">
                        <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                          <span className="font-black text-emerald-900 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>অ্যাকাউন্ট পাওয়া গেছে</span>
                          </span>
                          <span className="text-[10px] font-mono font-black text-emerald-800 bg-white px-2 py-0.5 rounded-lg border border-emerald-100">
                            {foundUser.memberId || 'BNB'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-700">
                          <div className="bg-white/50 p-2 rounded-xl border border-white">
                            <span className="text-slate-400 font-bold block mb-0.5 uppercase text-[9px]">নামঃ</span>
                            <span className="font-black text-slate-900 text-xs">{foundUser.name}</span>
                          </div>
                          <div className="bg-white/50 p-2 rounded-xl border border-white">
                            <span className="text-slate-400 font-bold block mb-0.5 uppercase text-[9px]">ব্যালেন্সঃ</span>
                            <span className="font-mono font-black text-emerald-700 text-xs">৳{Number(foundUser.balance || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Input for New Email */}
                      <form onSubmit={handleSaveEmail} className="space-y-4">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">
                            ২. আপনার নতুন সচল ইমেইল *
                          </label>
                          <div className="relative">
                            <input
                              type="email"
                              required
                              value={newEmail}
                              onChange={(e) => setNewEmail(e.target.value)}
                              placeholder="example@gmail.com"
                              className="w-full pl-10 pr-3 py-3 bg-white border border-slate-200 rounded-xl text-sm font-mono font-black text-slate-900 focus:outline-none focus:border-emerald-500 transition shadow-sm"
                            />
                            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={saving || !newEmail.trim()}
                          className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-200 transition flex items-center justify-center gap-2 active:scale-95"
                        >
                          {saving ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>সংরক্ষণ হচ্ছে...</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-4 h-4" />
                              <span>ইমেইল লিঙ্ক সম্পন্ন করুন</span>
                            </>
                          )}
                        </button>
                      </form>
                    </motion.div>
                  )}
                </>
              )}
            </div>
            <div className="h-10" />
          </div>

          {/* Footer info */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
              নিরাপত্তা এনক্রিপশন সক্রিয়
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

