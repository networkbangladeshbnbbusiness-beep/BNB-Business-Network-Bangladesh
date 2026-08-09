import React, { useState } from 'react';
import { User } from '../types';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Smartphone, Lock, ShieldAlert, Send, LogOut, RefreshCw, CheckCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface DeviceLockScreenProps {
  user: User;
  deviceId: string;
  onLogout: () => void;
}

export default function DeviceLockScreen({ user, deviceId, onLogout }: DeviceLockScreenProps) {
  const [requesting, setRequesting] = useState(false);
  const [requestSent, setRequestSent] = useState(user.deviceChangeRequested || false);
  const [refreshing, setRefreshing] = useState(false);

  const handleSendRequest = async () => {
    setRequesting(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        deviceChangeRequested: true,
        requestedDeviceId: deviceId,
        deviceChangeRequestedAt: new Date().toISOString()
      });
      setRequestSent(true);
      alert("✅ নতুন ডিভাইস অনুমোদনের রিকোয়েস্ট সফলভাবে এডমিন প্যানেলে পাঠানো হয়েছে!");
    } catch (err) {
      console.error("Failed to send device change request:", err);
      alert("অনুরোধ পাঠাতে সমস্যা হয়েছে। দয়া করে পুনরায় চেষ্টা করুন।");
    } finally {
      setRequesting(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  const waMessage = `আসসালামু আলাইকুম এডমিন, আমার BNB অ্যাকাউন্টে ডিভাইস লক দেখাচ্ছে। আমি নতুন ডিভাইসে লগইন অনুমোদন করতে চাই।\n\nনাম: ${user.name}\nমেম্বার আইডি: ${user.memberId}\nমোবাইল নম্বর: ${user.phone}\nডিভাইস আইডি: ${deviceId}`;
  const waUrl = `https://wa.me/8801865911728?text=${encodeURIComponent(waMessage)}`;

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between p-6 font-sans relative overflow-hidden">
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-red-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

      {/* Header */}
      <div className="w-full flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-red-600 flex items-center justify-center shadow-lg">
            <Lock className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-black text-xs tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-red-500">
              BNB SECURITY GATEWAY
            </span>
          </div>
        </div>
        
        <button
          onClick={handleRefresh}
          className={`p-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 text-xs font-bold ${refreshing ? 'animate-spin' : ''}`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          রিলোড
        </button>
      </div>

      {/* Main Card Section */}
      <div className="max-w-md w-full mx-auto my-auto py-8 text-center z-10 flex flex-col items-center">
        {/* Animated Locker Shield */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 15 }}
          className="relative mb-6"
        >
          <div className="w-24 h-24 bg-red-500/15 border border-red-500/30 rounded-3xl flex items-center justify-center shadow-2xl relative">
            <Smartphone className="w-12 h-12 text-red-500" />
            <div className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 p-1.5 rounded-xl border-2 border-slate-900 shadow-md">
              <Lock className="w-4 h-4 font-black" />
            </div>
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-red-500/5 rounded-full filter blur-xl animate-pulse pointer-events-none" />
        </motion.div>

        <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2 mb-2">
          <ShieldAlert className="w-5 h-5 text-red-500" />
          ডিভাইস লক সক্রিয় করা হয়েছে!
        </h1>

        <div className="bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full text-[10.5px] font-black text-red-400 uppercase tracking-widest inline-flex items-center gap-1 mb-4">
          <span>🔒 One Account, One Device Only</span>
        </div>

        <div className="bg-slate-800/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 space-y-4 text-slate-300 text-sm leading-relaxed max-w-sm">
          <p className="font-medium text-left text-xs text-slate-300">
            নিরাপত্তার স্বার্থে, BNB বিজনেস অ্যাকাউন্টের একটি অ্যাকাউন্ট এককালীন শুধুমাত্র একটি ফোনেই লগইন করা সম্ভব। 
          </p>
          <p className="text-left text-xs font-medium text-slate-400">
            আপনার অ্যাকাউন্টটি ইতিমধ্যে অন্য একটি ডিভাইসে লগইন করা রয়েছে। অ্যাডমিন প্যানেলের অনুমোদন ব্যতীত আপনি এই অ্যাকাউন্টটি একাধিক ডিভাইসে ব্যবহার করতে পারবেন না।
          </p>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-left space-y-1.5 font-mono text-[10px] text-slate-450">
            <div>
              <span className="text-slate-500">নাম:</span> <span className="text-slate-300 font-bold">{user.name}</span>
            </div>
            <div>
              <span className="text-slate-500">মেম্বার আইডি:</span> <span className="text-amber-450 font-bold">{user.memberId}</span>
            </div>
            <div>
              <span className="text-slate-500">ডিভাইস আইডি (বর্তমান):</span> <span className="text-red-450 truncate block max-w-[280px]">{deviceId}</span>
            </div>
            <div>
              <span className="text-slate-500">ডিভাইস আইডি (অনুমোদিত):</span> <span className="text-emerald-450 truncate block max-w-[280px]">{user.currentDeviceId || "সেট করা নেই"}</span>
            </div>
          </div>
        </div>

        {/* Support Options */}
        <div className="w-full max-w-sm mt-6 space-y-3">
          {requestSent ? (
            <div className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              ডিভাইস পরিবর্তনের অনুরোধ অ্যাডমিনের কাছে পাঠানো হয়েছে!
            </div>
          ) : (
            <button
              onClick={handleSendRequest}
              disabled={requesting}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:scale-98 text-white font-black py-3 px-4 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {requesting ? "অনুরোধ পাঠানো হচ্ছে..." : "নতুন ডিভাইস অনুমোদনের রিকোয়েস্ট পাঠান"}
            </button>
          )}

          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black py-3 px-4 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-lg"
          >
            <span className="text-sm">💬</span>
            হোয়াটসঅ্যাপে এডমিনের সাথে যোগাযোগ করুন
          </a>
        </div>
      </div>

      {/* Footer / Log Out option */}
      <div className="w-full max-w-sm mx-auto z-10 text-center">
        <p className="text-[10px] text-slate-500 leading-relaxed mb-4">
          অনুমোদন রিকোয়েস্ট পাঠানোর পর এডমিন প্যানেল থেকে অনুমোদন দিলে রিলোড বাটনে ক্লিক করলেই আপনার ড্যাশবোর্ড সচল হয়ে যাবে।
        </p>

        <button
          onClick={onLogout}
          className="py-2.5 px-6 border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 mx-auto active:scale-95"
        >
          <LogOut className="w-3.5 h-3.5" />
          অন্য অ্যাকাউন্টে লগইন করুন (লগ আউট)
        </button>
      </div>
    </div>
  );
}
