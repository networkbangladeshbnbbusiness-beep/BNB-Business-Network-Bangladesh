import React, { useState, useEffect } from 'react';
import { User, AppConfig } from '../types';
import { db } from '../lib/firebase';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { sendEmailOtpDirect } from '../lib/emailOtpService';
import { apiUrl } from '../config/api';
import { convertBengaliToEnglishDigits } from '../lib/memberUtils';
import { BNBLogo } from './BNBLogo';
import { 
  ArrowLeft, 
  KeyRound, 
  Lock, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Mail, 
  RotateCw, 
  ShieldCheck,
  ClipboardPaste,
  Shield,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
  locateUser: (input: string) => Promise<User | null>;
  appConfig?: AppConfig | null;
  darkMode?: boolean;
  appLanguage?: string;
}

export default function ForgotPasswordModal({
  isOpen,
  onClose,
  onLoginSuccess,
  locateUser,
  appConfig,
  darkMode = false,
  appLanguage = 'bn'
}: ForgotPasswordModalProps) {
  const isBn = appLanguage === 'bn';
  const isDark = Boolean(darkMode);

  // Step: 1 = Enter Email, 2 = Verify OTP, 3 = Set New Security PIN, 4 = Complete Success
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [inputVal, setInputVal] = useState('');
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [resolvedEmail, setResolvedEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');

  // Security PIN states (4 to 6 digit numeric PIN)
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [countdown, setCountdown] = useState(60);

  // Countdown timer for OTP resend
  useEffect(() => {
    let timer: any;
    if (step === 2 && countdown > 0) {
      timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  if (!isOpen) return null;

  const maskEmailAddress = (em: string) => {
    const parts = em.split('@');
    if (parts.length !== 2) return em;
    const namePart = parts[0];
    const masked = namePart.length > 2 
      ? `${namePart.slice(0, 2)}••••${namePart.slice(-1)}` 
      : `${namePart}•`;
    return `${masked}@${parts[1]}`;
  };

  // Helper to paste from clipboard
  const handlePasteOtp = async () => {
    try {
      if (navigator.clipboard) {
        const text = await navigator.clipboard.readText();
        const digits = convertBengaliToEnglishDigits(text).replace(/\D/g, '').slice(0, 6);
        if (digits.length > 0) {
          setOtpCode(digits);
        }
      }
    } catch (err) {
      console.warn('Clipboard read failed:', err);
    }
  };

  // Step 1: Request OTP for Account
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const raw = inputVal.trim();
    if (!raw) {
      setError(isBn ? 'অনুগ্রহ করে আপনার নিবন্ধিত ইমেইল অ্যাড্রেস প্রদান করুন।' : 'Please enter your registered email address.');
      return;
    }

    if (!raw.includes('@') && (raw.toUpperCase().includes('BNB') || /^\d+$/.test(raw))) {
      setError(
        isBn
          ? 'BNB কোড বা অ্যাকাউন্ট নম্বর দিয়ে পিন রিসেট করা সম্পূর্ণ নিষিদ্ধ। অনুগ্রহ করে আপনার নিবন্ধিত ইমেইল দিন।'
          : 'Resetting PIN using BNB member code or account number is strictly forbidden. Please enter your registered email.'
      );
      return;
    }

    if (!raw.includes('@')) {
      setError(
        isBn
          ? 'অনুগ্রহ করে সঠিক নিবন্ধিত ইমেইল অ্যাড্রেস দিন (যেমন: name@gmail.com)।'
          : 'Please enter a valid registered email address (e.g. name@gmail.com).'
      );
      return;
    }

    setLoading(true);

    try {
      const user = await locateUser(raw);
      if (!user) {
        setError(
          isBn
            ? 'এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি। আপনার নিবন্ধিত ইমেইল দিয়ে চেষ্টা করুন।'
            : 'No account found with this email. Please provide your registered email address.'
        );
        setLoading(false);
        return;
      }

      setTargetUser(user);

      // Determine target email
      let userEmail = user.email ? user.email.trim().toLowerCase() : '';
      if (!userEmail && raw.includes('@')) {
        userEmail = raw.toLowerCase();
      }

      if (!userEmail) {
        setError(
          isBn
            ? 'এই অ্যাকাউন্টের সাথে কোনো ইমেইল যুক্ত নেই। সহায়তার জন্য হেল্পলাইনে যোগাযোগ করুন।'
            : 'No email address is linked to this account. Please contact helpline or administrator for assistance.'
        );
        setLoading(false);
        return;
      }

      setResolvedEmail(userEmail);
      setMaskedEmail(maskEmailAddress(userEmail));

      // Generate authentic 6-digit OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(code);

      // Send single verified email OTP directly
      sendEmailOtpDirect({
        email: userEmail,
        otp: code,
        userName: user.name || (isBn ? 'সম্মানিত সদস্য' : 'Respected Member'),
        phone: user.phone || '',
        memberId: user.memberId || raw,
        userId: user.uid,
        reason: 'forgot_password'
      }).catch(() => {});

      setStep(2);
      setCountdown(60);
      setSuccessMsg(
        isBn
          ? `আপনার ইমেইলে ৬ সংখ্যার ওটিপি কোড পাঠানো হয়েছে: ${maskEmailAddress(userEmail)}`
          : `A 6-digit OTP code has been sent to your email: ${maskEmailAddress(userEmail)}`
      );
    } catch (err: any) {
      console.error('[Forgot PIN Error]:', err);
      setError(isBn ? 'ওটিপি পাঠাতে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।' : 'Failed to send OTP code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    const cleanOtp = convertBengaliToEnglishDigits(otpCode).trim();

    if (cleanOtp.length !== 6) {
      setError(isBn ? 'অনুগ্রহ করে ৬ সংখ্যার ওটিপি কোড দিন।' : 'Please enter the 6-digit OTP code.');
      return;
    }

    setLoading(true);

    try {
      let isVerified = false;

      // 1. Check generated email OTP
      if (generatedOtp && cleanOtp === generatedOtp.trim()) {
        isVerified = true;
      }

      // 2. Authoritative server-side verification check
      if (!isVerified) {
        try {
          const resp = await fetch(apiUrl('/api/verify-otp'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: resolvedEmail, otp: cleanOtp })
          });
          const data = await resp.json();
          if (data && data.success) {
            isVerified = true;
          }
        } catch (serverErr) {
          console.warn('[Server OTP Check]:', serverErr);
        }
      }

      if (isVerified) {
        setStep(3);
        setError('');
        setSuccessMsg(
          isBn
            ? 'ওটিপি যাচাই সফল হয়েছে! এখন আপনার নতুন সিকিউরিটি পিন সেট করুন।'
            : 'OTP verified successfully! Now please set your new security PIN.'
        );
      } else {
        setError(
          isBn
            ? 'ভুল ওটিপি কোড! আপনার ইমেইল ইনবক্স চেক করে সঠিক ৬ সংখ্যার কোডটি দিন।'
            : 'Invalid OTP code! Please check your email inbox and enter the correct 6-digit code.'
        );
      }
    } catch (err) {
      console.error('[Verify OTP Error]:', err);
      setError(isBn ? 'ওটিপি যাচাই করতে ব্যর্থ হয়েছে। পুনরায় চেষ্টা করুন।' : 'Failed to verify OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (countdown > 0 || !resolvedEmail) return;

    setLoading(true);
    setError('');
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(code);

      await sendEmailOtpDirect({
        email: resolvedEmail,
        otp: code,
        userName: targetUser?.name || (isBn ? 'সম্মানিত সদস্য' : 'Respected Member'),
        phone: targetUser?.phone || '',
        memberId: targetUser?.memberId || '',
        userId: targetUser?.uid,
        reason: 'forgot_password'
      });

      setCountdown(60);
      setSuccessMsg(
        isBn
          ? `নতুন ওটিপি কোড পাঠানো হয়েছে: ${maskedEmail}`
          : `A new OTP code has been sent to: ${maskedEmail}`
      );
    } catch (e) {
      setError(isBn ? 'পুনরায় ওটিপি পাঠাতে ব্যর্থ হয়েছে।' : 'Failed to resend OTP code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Save New Security PIN & Auto Login
  const handleSavePinAndLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanPin = convertBengaliToEnglishDigits(newPin).replace(/\D/g, '').trim();
    const cleanConfirm = convertBengaliToEnglishDigits(confirmPin).replace(/\D/g, '').trim();

    if (cleanPin.length < 4 || cleanPin.length > 6) {
      setError(isBn ? 'সিকিউরিটি পিন ৪ থেকে ৬ সংখ্যার হতে হবে।' : 'Security PIN must be 4 to 6 numeric digits.');
      return;
    }

    if (cleanPin !== cleanConfirm) {
      setError(isBn ? 'নতুন পিন এবং কনফার্ম পিন মিলছে না!' : 'New PIN and Confirm PIN do not match!');
      return;
    }

    if (!targetUser?.uid) {
      setError(isBn ? 'ইউজারের তথ্য পাওয়া যায়নি। পুনরায় চেষ্টা করুন।' : 'User information not found. Please start from Step 1.');
      return;
    }

    setLoading(true);

    try {
      const userRef = doc(db, 'users', targetUser.uid);

      // Update PIN & credentials in Firestore
      await updateDoc(userRef, {
        pin: cleanPin,
        pinSet: true,
        password: cleanPin,
        appLockCode: cleanPin,
        updatedAt: new Date().toISOString()
      }).catch(err => console.warn('Direct firestore update fallback:', err));

      // In-app activity notification
      addDoc(collection(db, 'user_notifications'), {
        userId: targetUser.uid,
        title: isBn ? '🔑 সিকিউরিটি পিন সফলভাবে পরিবর্তন হয়েছে' : '🔑 Security PIN Successfully Changed',
        body: isBn
          ? 'আপনার অ্যাকাউন্টের সিকিউরিটি পিন আপডেট করা হয়েছে এবং স্বয়ংক্রিয়ভাবে লগইন করা হয়েছে।'
          : 'Your account security PIN has been updated and you have been logged in automatically.',
        category: 'security',
        createdAt: new Date().toISOString()
      }).catch(() => {});

      const updatedUser: User = {
        ...targetUser,
        pin: cleanPin,
        pinSet: true,
        password: cleanPin,
        appLockCode: cleanPin
      };

      setStep(4);
      setSuccessMsg(
        isBn
          ? 'সিকিউরিটি পিন সফলভাবে সেট হয়েছে! আপনার অ্যাকাউন্টে প্রবেশ করা হচ্ছে...'
          : 'Security PIN set successfully! Logging into your account automatically...'
      );

      // Auto-login into software immediately
      setTimeout(() => {
        try {
          localStorage.setItem('amb_user_phone', updatedUser.phone || '');
          localStorage.setItem('amb_user_uid', updatedUser.uid);
          localStorage.setItem('amb_user_name', updatedUser.name || '');
          localStorage.setItem('amb_user_member_id', updatedUser.memberId || '');
          localStorage.setItem('amb_user_role', updatedUser.role || 'user');
          localStorage.setItem('amb_last_user', JSON.stringify(updatedUser));
          sessionStorage.setItem('amb_session_unlocked', 'true');
        } catch (e) {}

        onLoginSuccess(updatedUser);
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('[Save PIN Error]:', err);
      setError(isBn ? 'পিন আপডেট করতে ব্যর্থ হয়েছে। পুনরায় চেষ্টা করুন।' : 'Failed to update PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 overflow-y-auto min-h-screen flex flex-col font-sans select-none transition-colors ${
        isDark ? 'bg-[#0B1120] text-slate-100' : 'bg-[#F4F6F8] text-slate-900'
      }`}
    >
      {/* Top BNB Branding Curved Header */}
      <div
        className={`bg-gradient-to-b ${
          isDark
            ? 'from-[#052e1a] via-[#074226] to-[#084d2b]'
            : 'from-[#064e3b] via-[#047857] to-[#0B532C]'
        } text-white pt-4 pb-12 px-4 relative overflow-hidden shadow-lg shrink-0`}
      >
        {/* Subtle decorative background curves */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg className="w-full h-full object-cover" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,0 C30,40 70,20 100,50 L100,100 L0,100 Z" fill="white" />
          </svg>
        </div>

        <div className="max-w-md mx-auto w-full relative z-20">
          {/* Top Bar with Back Button and Security Badge */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 text-white text-xs font-black backdrop-blur-xs transition cursor-pointer border border-white/20 shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{isBn ? 'লগইনে ফিরে যান' : 'Back to Login'}</span>
            </button>

            <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-950/40 text-emerald-200 border border-emerald-400/30 text-[11px] font-bold">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isBn ? 'নিরাপদ রিকভারি' : 'Secure Recovery'}</span>
            </div>
          </div>

          {/* Official Emblem & Title */}
          <div className="flex flex-col items-center justify-center text-center mt-1">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-black border border-neutral-700/80 rounded-2xl shadow-xl flex items-center justify-center p-2 mb-2.5">
              {appConfig?.logoUrl ? (
                <img
                  src={appConfig.logoUrl}
                  alt="BNB Logo"
                  className="w-full h-full object-contain filter drop-shadow-md"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <BNBLogo size={46} variant="white" />
                </div>
              )}
            </div>

            <h1 className="flex items-center justify-center text-white drop-shadow-md leading-none">
              <span className="font-serif italic font-extrabold text-xl sm:text-2xl text-white mr-1.5">
                BNB
              </span>
              <span className="font-sans font-black text-base sm:text-lg tracking-wider text-white uppercase">
                BUSINESS NETWORK
              </span>
            </h1>
            <div className="text-emerald-200 text-[11px] sm:text-xs font-black tracking-[0.35em] text-center uppercase drop-shadow-sm mt-0.5">
              BANGLADESH
            </div>

            {/* Pill Capsule */}
            <div className="mt-3 inline-flex items-center gap-2 px-4 py-1 rounded-full border-2 border-emerald-400/70 bg-black/40 backdrop-blur-xs shadow-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse"></span>
              <span className="text-white text-xs font-black tracking-wide">
                {isBn ? 'সিকিউরিটি পিন পুনরুদ্ধার' : 'Security PIN Recovery'}
              </span>
            </div>
          </div>
        </div>

        {/* Curved Wave Bottom */}
        <div className="absolute bottom-0 left-0 right-0 w-full overflow-hidden leading-none z-10 pointer-events-none">
          <svg className="relative block w-full h-6 sm:h-8" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path
              d="M0,0 C300,90 600,-20 900,60 C1050,100 1150,40 1200,60 L1200,120 L0,120 Z"
              fill={isDark ? '#0B1120' : '#F4F6F8'}
            />
          </svg>
        </div>
      </div>

      {/* Main Full-Screen Body */}
      <div className="flex-1 w-full max-w-md mx-auto px-4 -mt-3 sm:-mt-4 pb-10 z-20 flex flex-col">
        {/* Step Progression Indicators */}
        <div
          className={`rounded-2xl p-3 shadow-md border mb-4 flex items-center justify-between ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
          }`}
        >
          {[
            { num: 1, label: isBn ? 'ইমেইল' : 'Email' },
            { num: 2, label: isBn ? 'ওটিপি কোড' : 'OTP Code' },
            { num: 3, label: isBn ? 'নতুন পিন' : 'New PIN' },
            { num: 4, label: isBn ? 'সম্পন্ন' : 'Complete' }
          ].map((item, idx) => (
            <React.Fragment key={item.num}>
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs transition-all ${
                    step > item.num
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : step === item.num
                      ? 'bg-[#0B532C] text-white ring-4 ring-emerald-500/20 shadow-md scale-105'
                      : isDark
                      ? 'bg-slate-800 text-slate-500'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {step > item.num ? <CheckCircle2 className="w-4 h-4 stroke-[3]" /> : item.num}
                </div>
                <span
                  className={`text-[10px] mt-1 font-bold ${
                    step === item.num
                      ? isDark
                        ? 'text-emerald-400 font-extrabold'
                        : 'text-emerald-900 font-extrabold'
                      : 'text-slate-400'
                  }`}
                >
                  {item.label}
                </span>
              </div>
              {idx < 3 && (
                <div
                  className={`h-0.5 flex-1 mx-1 rounded-full transition-all ${
                    step > idx + 1 ? 'bg-emerald-500' : isDark ? 'bg-slate-800' : 'bg-slate-200'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Form Container Card */}
        <div
          className={`rounded-3xl p-5 sm:p-7 shadow-xl border flex-1 flex flex-col justify-between ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
          }`}
        >
          <div>
            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mb-4 p-3.5 border rounded-2xl text-xs font-bold flex items-start gap-2.5 shadow-2xs ${
                  isDark
                    ? 'bg-red-950/60 border-red-800/80 text-red-200'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
                <span className="leading-relaxed">{error}</span>
              </motion.div>
            )}

            {/* Success Message */}
            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mb-4 p-3.5 border rounded-2xl text-xs font-bold flex items-start gap-2.5 shadow-2xs ${
                  isDark
                    ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-200'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
                <span className="leading-relaxed">{successMsg}</span>
              </motion.div>
            )}

            <AnimatePresence mode="wait">
              {/* STEP 1: Enter Registered Email */}
              {step === 1 && (
                <motion.form
                  key="step-1"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={handleRequestOtp}
                  className="space-y-4 pt-1"
                >
                  <div className={`border-b pb-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                    <h2 className={`text-base font-black flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      <KeyRound className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`} />
                      <span>{isBn ? 'ধাপ ১: নিবন্ধিত ইমেইল দিন' : 'Step 1: Enter Registered Email'}</span>
                    </h2>
                    <p className={`text-xs font-medium mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {isBn
                        ? 'আপনার সিকিউরিটি পিন রিসেট করতে নিবন্ধিত ইমেইল যাচাই করুন'
                        : 'Verify your account security to reset your Security PIN'}
                    </p>
                  </div>

                  <div>
                    <label className={`block text-xs font-extrabold mb-1.5 px-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {isBn ? 'নিবন্ধিত ইমেইল অ্যাড্রেস *' : 'Registered Email Address *'}
                    </label>
                    <div className="relative">
                      <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                        <Mail className="w-5 h-5" />
                      </div>
                      <input
                        type="email"
                        required
                        value={inputVal}
                        onChange={(e) => setInputVal(e.target.value)}
                        placeholder={isBn ? 'আপনার ইমেইল দিন (যেমন: name@gmail.com)' : 'Enter your email (e.g. name@gmail.com)'}
                        className={`w-full pl-12 pr-4 py-3.5 border-2 rounded-2xl text-xs sm:text-sm font-bold focus:outline-none focus:ring-4 focus:ring-emerald-500/10 shadow-2xs transition ${
                          isDark
                            ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500'
                            : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-emerald-600'
                        }`}
                      />
                    </div>
                    <div
                      className={`p-3 border rounded-xl mt-3 space-y-1 ${
                        isDark ? 'bg-amber-950/50 border-amber-800/70' : 'bg-amber-50/80 border-amber-200/70'
                      }`}
                    >
                      <p className={`text-[11px] font-bold flex items-center gap-1.5 ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                        <span>⚠️</span>
                        <span>{isBn ? 'সতর্কতা: শুধুমাত্র নিবন্ধিত ইমেইল প্রযোজ্য' : 'Notice: Only Registered Email Allowed'}</span>
                      </p>
                      <p className={`text-[11px] font-medium ${isDark ? 'text-amber-200/90' : 'text-amber-700'}`}>
                        {isBn
                          ? 'BNB মেম্বার কোড বা অ্যাকাউন্ট নম্বর দিয়ে পিন রিসেট করা সম্পূর্ণ নিষিদ্ধ।'
                          : 'Resetting PIN using BNB member code or account number is strictly prohibited.'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#0B532C] hover:bg-[#084223] active:bg-[#06331B] text-white font-black py-4 px-6 rounded-full text-sm sm:text-base shadow-md flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer disabled:opacity-50 mt-2"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>{isBn ? 'ইমেইলে ওটিপি কোড পাঠান' : 'Send OTP Code to Email'}</span>
                        <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                      </>
                    )}
                  </button>
                </motion.form>
              )}

              {/* STEP 2: Enter OTP Code */}
              {step === 2 && (
                <motion.form
                  key="step-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={handleVerifyOtp}
                  className="space-y-4 pt-1"
                >
                  <div className={`border-b pb-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                    <h2 className={`text-base font-black flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      <ShieldCheck className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`} />
                      <span>{isBn ? 'ধাপ ২: ওটিপি কোড যাচাই করুন' : 'Step 2: Verify OTP Code'}</span>
                    </h2>
                    <div className={`text-xs font-medium mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {isBn ? 'ভেরিফিকেশন কোড পাঠানো হয়েছে:' : 'Verification code sent to:'}{' '}
                      <span className={`font-mono font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-800'}`}>{maskedEmail}</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5 px-1">
                      <label className={`text-xs font-extrabold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        {isBn ? '৬ সংখ্যার ওটিপি কোড *' : '6-Digit OTP Code *'}
                      </label>
                      <button
                        type="button"
                        onClick={handlePasteOtp}
                        className={`text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer px-2 py-0.5 rounded-md border ${
                          isDark
                            ? 'text-emerald-300 bg-emerald-950/60 border-emerald-800'
                            : 'text-emerald-700 hover:text-emerald-900 bg-emerald-50 border-emerald-200/60'
                        }`}
                      >
                        <ClipboardPaste className="w-3 h-3" />
                        <span>{isBn ? 'পেস্ট' : 'Paste'}</span>
                      </button>
                    </div>

                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={otpCode}
                      onChange={(e) => {
                        const val = convertBengaliToEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 6);
                        setOtpCode(val);
                        if (val.length === 6) {
                          setTimeout(() => {
                            const btn = document.getElementById('btn-verify-forgot-otp');
                            if (btn) btn.click();
                          }, 150);
                        }
                      }}
                      placeholder="• • • • • •"
                      className={`w-full py-3.5 px-4 border-2 rounded-2xl text-center font-mono text-2xl font-black tracking-widest focus:outline-none focus:ring-4 focus:ring-emerald-500/10 shadow-2xs transition ${
                        isDark
                          ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-600 focus:border-emerald-500'
                          : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-emerald-600'
                      }`}
                    />
                  </div>

                  <button
                    id="btn-verify-forgot-otp"
                    type="submit"
                    disabled={loading || otpCode.length !== 6}
                    className="w-full bg-[#0B532C] hover:bg-[#084223] active:bg-[#06331B] text-white font-black py-4 px-6 rounded-full text-sm sm:text-base shadow-md flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>{isBn ? 'ওটিপি যাচাই করুন' : 'Verify OTP & Proceed'}</span>
                        <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                      </>
                    )}
                  </button>

                  <div className="text-center pt-2">
                    {countdown > 0 ? (
                      <span
                        className={`text-xs font-bold px-3 py-1.5 rounded-full border inline-block ${
                          isDark
                            ? 'text-slate-400 bg-slate-950 border-slate-800'
                            : 'text-slate-500 bg-slate-50 border-slate-200'
                        }`}
                      >
                        {isBn ? 'পুনরায় পাঠান:' : 'Resend code in:'}{' '}
                        <span className={`font-mono font-extrabold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                          {countdown}s
                        </span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        className={`text-xs font-extrabold flex items-center justify-center gap-1.5 mx-auto transition cursor-pointer px-3.5 py-1.5 rounded-full border ${
                          isDark
                            ? 'text-emerald-300 bg-emerald-950/60 border-emerald-800'
                            : 'text-emerald-700 hover:text-emerald-900 bg-emerald-50 border-emerald-200'
                        }`}
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>{isBn ? 'পুনরায় ওটিপি পাঠান' : 'Resend OTP Code'}</span>
                      </button>
                    )}
                  </div>
                </motion.form>
              )}

              {/* STEP 3: Set New Security PIN */}
              {step === 3 && (
                <motion.form
                  key="step-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={handleSavePinAndLogin}
                  className="space-y-4 pt-1"
                >
                  <div className={`border-b pb-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                    <h2 className={`text-base font-black flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      <Lock className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`} />
                      <span>{isBn ? 'ধাপ ৩: নতুন সিকিউরিটি পিন দিন' : 'Step 3: Set New Security PIN'}</span>
                    </h2>
                    <p className={`text-xs font-medium mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {isBn ? 'আপনার অ্যাকাউন্টের জন্য ৪ থেকে ৬ সংখ্যার পিন দিন' : 'Enter a 4 to 6 digit numeric PIN for your account'}
                    </p>
                  </div>

                  <div>
                    <label className={`block text-xs font-extrabold mb-1 px-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {isBn ? 'নতুন সিকিউরিটি পিন (৪-৬ সংখ্যা) *' : 'New Security PIN (4-6 Digits) *'}
                    </label>
                    <div className="relative">
                      <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPin ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={6}
                        required
                        value={newPin}
                        onChange={(e) => {
                          const val = convertBengaliToEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 6);
                          setNewPin(val);
                        }}
                        placeholder={isBn ? '৪ বা ৬ সংখ্যার পিন দিন' : 'Enter 4 or 6 digit PIN'}
                        className={`w-full pl-11 pr-11 py-3.5 border-2 rounded-2xl text-xs sm:text-sm font-bold focus:outline-none focus:ring-4 focus:ring-emerald-500/10 shadow-2xs font-mono transition ${
                          isDark
                            ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500'
                            : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-emerald-600'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-extrabold mb-1 px-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {isBn ? 'পুনরায় সিকিউরিটি পিন দিন *' : 'Confirm Security PIN *'}
                    </label>
                    <div className="relative">
                      <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPin ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={6}
                        required
                        value={confirmPin}
                        onChange={(e) => {
                          const val = convertBengaliToEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 6);
                          setConfirmPin(val);
                        }}
                        placeholder={isBn ? 'পুনরায় নতুন পিনটি লিখুন' : 'Re-enter your new PIN'}
                        className={`w-full pl-11 pr-11 py-3.5 border-2 rounded-2xl text-xs sm:text-sm font-bold focus:outline-none focus:ring-4 focus:ring-emerald-500/10 shadow-2xs font-mono transition ${
                          isDark
                            ? 'bg-slate-950 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500'
                            : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-emerald-600'
                        }`}
                      />
                    </div>
                    {newPin && confirmPin && (
                      <p className={`text-[11px] font-bold mt-1.5 px-1 ${newPin === confirmPin ? 'text-emerald-500' : 'text-red-500'}`}>
                        {newPin === confirmPin
                          ? isBn
                            ? '✓ সিকিউরিটি পিন মিলেছে'
                            : '✓ Security PINs match'
                          : isBn
                          ? '✗ পিন মিলছে না'
                          : '✗ PINs do not match'}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || newPin.length < 4 || newPin !== confirmPin}
                    className="w-full bg-[#0B532C] hover:bg-[#084223] active:bg-[#06331B] text-white font-black py-4 px-6 rounded-full text-sm sm:text-base shadow-md flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer disabled:opacity-50 mt-3"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                        <span>{isBn ? 'পিন সেভ করে লগইন করুন' : 'Save PIN & Auto Login'}</span>
                      </>
                    )}
                  </button>
                </motion.form>
              )}

              {/* STEP 4: Success Transition */}
              {step === 4 && (
                <motion.div
                  key="step-4"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-10 text-center space-y-3 my-auto"
                >
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${isDark ? 'bg-emerald-950 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                    <CheckCircle2 className="w-10 h-10 stroke-[2.5] animate-bounce" />
                  </div>
                  <h4 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isBn ? 'সিকিউরিটি পিন রিসেট সফল!' : 'Security PIN Reset Successful!'}
                  </h4>
                  <p className={`text-xs sm:text-sm font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {isBn ? 'স্বয়ংক্রিয়ভাবে আপনার অ্যাকাউন্টে প্রবেশ করা হচ্ছে...' : 'Logging into your account automatically...'}
                  </p>
                  <div className="w-7 h-7 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mt-4" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom Card Footer */}
          <div className={`pt-6 mt-6 border-t text-center ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
            <button
              type="button"
              onClick={onClose}
              className={`text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 ${
                isDark ? 'text-slate-400 hover:text-emerald-400' : 'text-slate-500 hover:text-emerald-800'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isBn ? 'লগইন স্ক্রিনে ফিরে যান' : 'Return to Login Screen'}</span>
            </button>
          </div>
        </div>

        {/* Support Help Footer */}
        <div className="mt-4 text-center">
          <p className="text-[11px] text-slate-500 font-medium inline-flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {isBn
                ? 'সহায়তা প্রয়োজন? আমাদের অফিশিয়াল সাপোর্ট হেল্পলাইনে যোগাযোগ করুন।'
                : 'Need assistance? Contact our official support helpline.'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
