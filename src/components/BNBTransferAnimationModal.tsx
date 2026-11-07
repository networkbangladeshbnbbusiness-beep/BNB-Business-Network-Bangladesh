import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, ArrowRight, Sparkles, User, Lock, Wallet, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BNBLogo } from './BNBLogo';

export interface BNBTransferAnimProps {
  isOpen: boolean;
  senderName: string;
  senderPhone: string;
  receiverName: string;
  receiverPhone: string;
  amount: number;
  txId?: string;
  onComplete: () => void;
}

export function BNBTransferAnimationModal({
  isOpen,
  senderName,
  senderPhone,
  receiverName,
  receiverPhone,
  amount,
  txId,
  onComplete
}: BNBTransferAnimProps) {
  const [displayAmount, setDisplayAmount] = useState<number>(0);
  const [progressPct, setProgressPct] = useState<number>(0);

  useEffect(() => {
    if (!isOpen) {
      setDisplayAmount(0);
      setProgressPct(0);
      return;
    }

    // 1. Animate amount count-up from 0 to target amount
    const durationMs = 1200;
    const steps = 30;
    const increment = amount / steps;
    let stepCount = 0;

    const timerCount = setInterval(() => {
      stepCount++;
      if (stepCount >= steps) {
        setDisplayAmount(amount);
        clearInterval(timerCount);
      } else {
        setDisplayAmount((prev) => Math.min(amount, prev + increment));
      }
    }, durationMs / steps);

    // 2. Animate progress bar from 0% to 100% over 2.8 seconds
    const progressDuration = 2800;
    const progressInterval = 50;
    const progressInc = 100 / (progressDuration / progressInterval);

    const timerProgress = setInterval(() => {
      setProgressPct((prev) => {
        const next = prev + progressInc;
        if (next >= 100) {
          clearInterval(timerProgress);
          return 100;
        }
        return next;
      });
    }, progressInterval);

    // 3. Auto complete after 3 seconds
    const autoFinishTimer = setTimeout(() => {
      onComplete();
    }, 3200);

    return () => {
      clearInterval(timerCount);
      clearInterval(timerProgress);
      clearTimeout(autoFinishTimer);
    };
  }, [isOpen, amount, onComplete]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex flex-col bg-[#031b13]">
          {/* Notification bar area */}
          <div className="h-10 shrink-0 bg-[#004a2c] w-full"></div>

          <motion.div 
            initial={{ y: "100%" }} 
            animate={{ y: 0 }} 
            exit={{ y: "100%" }} 
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="flex-1 text-white flex flex-col justify-between p-4 sm:p-6 overflow-y-auto font-sans relative"
          >
            {/* Background radial glow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-600/20 via-[#031b13] to-[#01110b] pointer-events-none" />

            {/* Top Header Section */}
            <div className="relative z-10 w-full max-w-md mx-auto space-y-3 text-center pt-2">
              {/* Top Security Pill Badge */}
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-950/80 border border-amber-400/80 text-amber-300 text-[11px] font-bold shadow-lg backdrop-blur-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>🛡️ ৪-ডিজিটের PIN পাসওয়ার্ড • হাত থেকে হাত টাকা যাচ্ছে</span>
              </div>

              {/* Title */}
              <h2 className="text-xl sm:text-2xl font-black text-amber-200 tracking-wide flex items-center justify-center gap-2">
                <span>BNB নিরাপদ সেন্ড মানি</span>
              </h2>

              {/* Animated Big Amount Counter */}
              <div className="bg-[#073325]/90 border border-emerald-500/40 rounded-2xl p-3 shadow-inner space-y-0.5">
                <span className="text-[11px] text-emerald-300/80 font-medium block">স্থানান্তরিত মোট পরিমাণ</span>
                <div className="text-3xl sm:text-4xl font-mono font-black text-emerald-300 tracking-tight drop-shadow-[0_2px_12px_rgba(16,185,129,0.5)]">
                  ৳ {displayAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Central BNB-Branded Art / Theme Illustration */}
            <div className="relative z-10 w-full max-w-md mx-auto my-3">
              <div className="bg-gradient-to-b from-[#0b4d3a] via-[#063327] to-[#032119] border-2 border-amber-400/80 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4 text-center overflow-hidden relative">
                
                {/* Subtle rural / BNB art background overlay */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-400/10 via-transparent to-transparent pointer-events-none" />

                {/* Top Slogan Banner inside theme */}
                <div className="bg-gradient-to-r from-amber-900/90 via-amber-800/90 to-amber-900/90 border border-amber-400/60 rounded-full py-1 px-3 text-[10px] sm:text-[11px] font-bold text-amber-200 shadow-md inline-block max-w-full truncate">
                  🌱 গ্রাম বাংলা হোক স্বাবলম্বী • ডিজিটালে নিশ্চিত সেবাবান 🌱
                </div>

                {/* Transfer Visual Scene */}
                <div className="relative py-2 flex items-center justify-between gap-2">
                  
                  {/* SENDER BOX (প্রেরকের হাত) */}
                  <div className="flex-1 bg-[#04281e]/90 border border-emerald-500/50 rounded-2xl p-2.5 space-y-1.5 shadow-md text-center flex flex-col items-center justify-center">
                    <span className="text-[9.5px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-white px-2 py-0.5 rounded-md shadow-2xs">
                      প্রেরকের হাত
                    </span>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-emerald-600 border-2 border-amber-300 text-white font-black text-sm flex items-center justify-center shadow-md">
                      {(senderName || 'S').charAt(0).toUpperCase()}
                    </div>
                    <div className="w-full min-w-0">
                      <p className="text-[11.5px] font-black text-white truncate leading-tight">{senderName || 'প্রেরক'}</p>
                      <p className="text-[9.5px] font-mono text-amber-300 font-bold truncate">{senderPhone}</p>
                    </div>
                  </div>

                  {/* CENTER ANIMATED MONEY ENVELOPE / CARD MOVING FROM LEFT TO RIGHT */}
                  <div className="relative w-16 sm:w-20 h-12 flex items-center justify-center shrink-0">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-full h-1 bg-gradient-to-r from-amber-400/30 via-emerald-400 to-amber-400/30 rounded-full" />
                    </div>

                    {/* Animated Floating Coin / Envelope Icon moving continuously */}
                    <div className="absolute animate-bounce flex items-center justify-center bg-gradient-to-tr from-amber-400 to-orange-500 text-slate-900 p-2 rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.8)] border border-amber-200">
                      <BNBLogo className="w-5 h-5 text-slate-900" />
                    </div>

                    {/* Moving pulse light effect */}
                    <div className="absolute w-3 h-3 bg-amber-300 rounded-full blur-xs animate-ping" />
                  </div>

                  {/* RECEIVER BOX (প্রাপকের হাত) */}
                  <div className="flex-1 bg-[#04281e]/90 border border-emerald-500/50 rounded-2xl p-2.5 space-y-1.5 shadow-md text-center flex flex-col items-center justify-center">
                    <span className="text-[9.5px] font-black bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-2 py-0.5 rounded-md shadow-2xs">
                      প্রাপকের হাত
                    </span>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 border-2 border-amber-300 text-white font-black text-sm flex items-center justify-center shadow-md">
                      {(receiverName || 'R').charAt(0).toUpperCase()}
                    </div>
                    <div className="w-full min-w-0">
                      <p className="text-[11.5px] font-black text-white truncate leading-tight">{receiverName || 'প্রাপক'}</p>
                      <p className="text-[9.5px] font-mono text-amber-300 font-bold truncate">{receiverPhone}</p>
                    </div>
                  </div>

                </div>

                {/* Bottom Trust Tag */}
                <div className="pt-1 border-t border-emerald-800/80 flex items-center justify-center gap-1.5 text-[10px] text-emerald-200/90">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  <span>প্রাপকের অ্যাকাউন্টে নিরাপদে অর্থ জমা হচ্ছে</span>
                </div>

              </div>
            </div>

            {/* Bottom Progress & Action Button Section */}
            <div className="relative z-10 w-full max-w-md mx-auto space-y-3 pb-3">
              
              {/* Notice line */}
              <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-amber-200 bg-[#073325]/90 border border-amber-500/40 p-2 rounded-xl text-center shadow-md">
                <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>🔒 প্রাপকের কাছে নিরাপদ সেন্ড মানি পৌঁছাল! রিসিট তৈরি হচ্ছে...</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[#072d21] rounded-full h-2 overflow-hidden border border-emerald-600/50 shadow-inner">
                <div 
                  className="bg-gradient-to-r from-amber-400 via-emerald-400 to-amber-300 h-full transition-all duration-100 shadow-[0_0_8px_rgba(245,158,11,0.8)]"
                  style={{ width: `${Math.min(100, progressPct)}%` }}
                />
              </div>

              {/* Manual 'রিসিট দেখুন' Button */}
              <button
                type="button"
                onClick={onComplete}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm rounded-2xl shadow-xl border border-emerald-400/50 transition cursor-pointer flex items-center justify-center gap-2 active:scale-95"
              >
                <span>রিসিট দেখুন</span>
                <ArrowRight className="w-4 h-4 text-amber-300 animate-pulse" />
              </button>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

