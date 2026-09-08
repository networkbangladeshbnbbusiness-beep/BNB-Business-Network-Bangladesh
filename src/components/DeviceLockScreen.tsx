import React, { useState } from 'react';
import { User, AppConfig } from '../types';
import { db } from '../lib/firebase';
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { Smartphone, Lock, ShieldAlert, Send, LogOut, RefreshCw, CheckCircle2, MessageSquare } from 'lucide-react';
import { motion } from 'motion/react';

interface DeviceLockScreenProps {
  user: User;
  deviceId: string;
  onLogout: () => void;
  appConfig?: AppConfig;
}

export default function DeviceLockScreen({ user, deviceId, onLogout, appConfig }: DeviceLockScreenProps) {
  const [requesting, setRequesting] = useState(false);
  const [requestSent, setRequestSent] = useState(user.deviceChangeRequested || false);
  const [refreshing, setRefreshing] = useState(false);
  const [complainReason, setComplainReason] = useState('নতুন ডিভাইসে লগইন');
  const [complainNote, setComplainNote] = useState('');
  const [showComplainForm, setShowComplainForm] = useState(false);

  const handleSendRequest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setRequesting(true);
    const nowIso = new Date().toISOString();
    try {
      // 1. Submit to device_release_requests collection
      await addDoc(collection(db, 'device_release_requests'), {
        userId: user.uid,
        userName: user.name || 'সদস্য',
        userPhone: user.phone || '',
        memberId: user.memberId || '',
        reason: complainReason,
        details: complainNote || 'নতুন ডিভাইসে লগইন করার জন্য অনুমোদন প্রয়োজন।',
        requestedDeviceId: deviceId,
        lockedDeviceId: user.currentDeviceId || '',
        status: 'pending',
        createdAt: nowIso
      });

      // 2. Update user doc
      await updateDoc(doc(db, 'users', user.uid), {
        deviceChangeRequested: true,
        requestedDeviceId: deviceId,
        deviceChangeReason: complainReason,
        deviceChangeRequestedAt: nowIso
      });

      setRequestSent(true);
      setShowComplainForm(false);
    } catch (err: any) {
      console.error("Failed to send device change request:", err);
      alert("অনুরোধ পাঠাতে সমস্যা হয়েছে: " + (err?.message || 'দয়া করে পুনরায় চেষ্টা করুন'));
    } finally {
      setRequesting(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  const cleanAdminPhone = (appConfig?.supportPhone || '01865911728').replace(/[^0-9]/g, '');
  const internationalPhone = cleanAdminPhone.startsWith('880') 
    ? cleanAdminPhone 
    : (cleanAdminPhone.startsWith('0') ? '88' + cleanAdminPhone : '880' + cleanAdminPhone);

  const waMessage = `আসসালামু আলাইকুম এডমিন, আমার BNB অ্যাকাউন্টে ডিভাইস লক দেখাচ্ছে। আমি নতুন ডিভাইসে লগইন করতে পারছি না। দয়া করে আমার অ্যাকাউন্টটি জিরো ডিভাইস (রিলিজ) করে দিন।\n\nনাম: ${user.name}\nমেম্বার আইডি: #${user.memberId}\nমোবাইল নম্বর: ${user.phone}\nডিভাইস আইডি: ${deviceId}`;
  const waUrl = `https://wa.me/${internationalPhone}?text=${encodeURIComponent(waMessage)}`;

  return (
    <div className="min-h-screen bg-[#0d111d] text-slate-100 flex flex-col justify-between p-4 sm:p-6 font-sans relative overflow-x-hidden select-none">
      {/* Background Decorative Glows */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-red-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/5 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-600/5 rounded-full blur-[80px] pointer-events-none" />

      {/* 1. Header Bar */}
      <div className="w-full max-w-md mx-auto flex justify-between items-center z-10 pt-1 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#f97316] flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
            <Lock className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <span className="font-extrabold text-[12px] tracking-wider uppercase text-[#f97316]">
              BNB SECURITY GATEWAY
            </span>
          </div>
        </div>
        
        <button
          type="button"
          onClick={handleRefresh}
          className={`px-3 py-1.5 bg-[#1e293b]/70 hover:bg-[#334155]/80 active:scale-95 text-slate-200 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 text-xs font-bold border border-slate-700/60 shadow-md ${refreshing ? 'opacity-80' : ''}`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          রিলোড
        </button>
      </div>

      {/* 2. Main Content Container */}
      <div className="max-w-md w-full mx-auto my-auto py-2 text-center z-10 flex flex-col items-center">
        {/* Glowing Red Phone Icon with Attached Gold Lock */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 15 }}
          className="relative mb-5"
        >
          <div className="w-28 h-28 bg-[#1e131d]/90 border border-red-500/30 rounded-[28px] flex items-center justify-center shadow-2xl relative">
            <div className="absolute inset-0 bg-red-600/5 rounded-[28px] blur-sm" />
            <Smartphone className="w-12 h-12 text-[#ef4444] relative z-10" strokeWidth={1.5} />
            <div className="absolute -bottom-1 -right-1 bg-[#f59e0b] text-slate-950 p-1.5 rounded-lg border-2 border-[#0d111d] shadow-lg flex items-center justify-center z-20">
              <Lock className="w-3.5 h-3.5 text-slate-950" strokeWidth={3} />
            </div>
          </div>
        </motion.div>

        {/* Title */}
        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-red-600/20 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-4 h-4 text-[#ef4444]" strokeWidth={2.5} />
          </div>
          ডিভাইস লক সক্রিয় করা হয়েছে!
        </h1>

        {/* Policy Pill Badge */}
        <div className="bg-[#1e141a] border border-red-500/20 px-3.5 py-1 rounded-full text-[10px] font-black text-[#ef4444] uppercase tracking-widest inline-flex items-center gap-1.5 mb-5">
          <Lock className="w-3 h-3 text-[#f59e0b]" strokeWidth={2.5} />
          <span>ONE ACCOUNT, ONE DEVICE ONLY</span>
        </div>

        {/* Details & Explanation Box */}
        <div className="bg-[#161c2c] border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3.5 text-slate-300 text-[12.5px] leading-relaxed w-full text-left shadow-2xl">
          <p className="text-slate-200 font-medium">
            নিরাপত্তার স্বার্থে, BNB বিজনেস অ্যাকাউন্টের একটি অ্যাকাউন্ট এককালীন শুধুমাত্র একটি ফোনেই লগইন করা সম্ভব।
          </p>
          <p className="text-slate-400 text-[11.5px] leading-relaxed">
            আপনার অ্যাকাউন্টটি ইতোমধ্যে অন্য একটি ডিভাইসে লগইন করা রয়েছে। অ্যাডমিন প্যানেলের অনুমোদন ব্যতীত আপনি এই অ্যাকাউন্টটি একাধিক ডিভাইসে ব্যবহার করতে পারবেন না।
          </p>

          {/* User & Device Identifiers Card */}
          <div className="bg-[#0f1422] border border-slate-800/80 rounded-xl p-3.5 space-y-2.5 text-[11.5px]">
            <div>
              <span className="text-slate-400">নাম: </span>
              <strong className="text-white font-sans font-bold">{user.name || 'সদস্য'}</strong>
            </div>
            <div>
              <span className="text-slate-400">মেম্বার আইডি: </span>
              <strong className="text-white font-mono font-bold">{user.memberId}</strong>
            </div>
            <div className="pt-0.5 border-t border-slate-800/50">
              <span className="text-slate-400 block text-[10px]">ডিভাইস আইডি (বর্তমান):</span>
              <span className="text-slate-300 break-all text-[11px] select-all block font-mono mt-0.5">{deviceId}</span>
            </div>
            <div className="pt-0.5">
              <span className="text-slate-400 block text-[10px]">ডিভাইস আইডি (অনুমোদিত):</span>
              <span className="text-slate-300 break-all text-[11px] select-all block font-mono mt-0.5">{user.currentDeviceId || 'অনুমোদিত ডিভাইস আইডি'}</span>
            </div>
          </div>
        </div>

        {/* 3. Action Buttons & Requests */}
        <div className="w-full mt-5 space-y-3">
          {requestSent ? (
            <div className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3.5 rounded-2xl text-xs font-bold flex flex-col items-center justify-center gap-1.5 text-center shadow-lg">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              <span>নতুন ডিভাইস অনুমোদনের রিকোয়েস্ট অ্যাডমিনের কাছে পাঠানো হয়েছে!</span>
              <span className="text-[10px] font-normal text-emerald-400/80">
                এডমিন অনুমোদন দিলে বা জিরো ডিভাইস করে দিলে উপরের 'রিলোড' বাটনে ক্লিক করলেই আপনার ড্যাশবোর্ড সচল হয়ে যাবে।
              </span>
            </div>
          ) : showComplainForm ? (
            <form onSubmit={handleSendRequest} className="bg-[#161c2c] border border-slate-800/80 p-4 rounded-2xl text-left space-y-3 shadow-xl">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                এডমিনকে ডিভাইস রিলিজ কমপ্লেইন পাঠান:
              </h4>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">
                  সমস্যার কারণ নির্বাচন করুন:
                </label>
                <select
                  value={complainReason}
                  onChange={(e) => setComplainReason(e.target.value)}
                  className="w-full py-2 px-2.5 bg-[#0f1422] border border-slate-700/60 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="ফোন হারিয়ে গেছে">📱 পূর্বের ফোন হারিয়ে গেছে</option>
                  <option value="ফোন নষ্ট/অকেজো হয়ে গেছে">💥 পূর্বের ফোন নষ্ট বা অকেজো হয়ে গেছে</option>
                  <option value="পূর্বে লগআউট করা হয়নি">🔑 পূর্বে লগআউট না করেই নতুন ফোন নিয়েছি</option>
                  <option value="নতুন মোবাইল ক্রয় করেছি">🆕 নতুন মোবাইল ক্রয় করেছি</option>
                  <option value="অন্যান্য সমস্যা">❓ অন্যান্য সমস্যা</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">
                  নোট (ঐচ্ছিক):
                </label>
                <textarea
                  rows={2}
                  value={complainNote}
                  onChange={(e) => setComplainNote(e.target.value)}
                  placeholder="যেমন: আমার আগের ফোনটি হারিয়ে গেছে, দয়া করে ডিভাইসটি জিরো/রিলিজ করে দিন।"
                  className="w-full py-1.5 px-2.5 bg-[#0f1422] border border-slate-700/60 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowComplainForm(false)}
                  className="w-1/3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer text-center"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={requesting}
                  className="w-2/3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                >
                  {requesting ? (
                    <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      অনুরোধ পাঠান
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={handleSendRequest}
              disabled={requesting}
              className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] active:scale-[0.98] text-white font-extrabold py-3 px-4 rounded-xl text-[12.5px] transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-purple-950/40"
            >
              {requesting ? (
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <svg className="w-4 h-4 transform rotate-45 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                  <span>নতুন ডিভাইস অনুমোদনের রিকোয়েস্ট পাঠান</span>
                </>
              )}
            </button>
          )}

          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full bg-[#10b981] hover:bg-[#059669] active:scale-[0.98] text-white font-extrabold py-3 px-4 rounded-xl text-[12.5px] transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40"
          >
            {/* Custom WhatsApp Icon SVG */}
            <svg className="w-4 h-4 fill-white shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            <span>হোয়াটসঅ্যাপে এডমিনের সাথে যোগাযোগ করুন</span>
          </a>
        </div>

        {/* Subtitle helper under action buttons */}
        <p className="text-[11px] text-slate-400/80 leading-relaxed mt-4 px-4">
          অনুমোদন রিকোয়েস্ট পাঠানোর পর এডমিন প্যানেল থেকে অনুমোদন দিলে রিলোড বাটনে ক্লিক করলেই আপনার ড্যাশবোর্ড সচল হয়ে যাবে।
        </p>
      </div>

      {/* 4. Bottom Logout Button */}
      <div className="w-full max-w-md mx-auto z-10 text-center pb-2 pt-4">
        <button
          type="button"
          onClick={onLogout}
          className="w-full py-2.5 px-4 bg-[#0a0d16] hover:bg-[#121827] border border-slate-800/80 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shadow-md"
        >
          <LogOut className="w-3.5 h-3.5 text-slate-400" />
          [→ অন্য অ্যাকাউন্টে লগইন করুন (লগ আউট)
        </button>
      </div>
    </div>
  );
}

