import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, getDocs, collection, query, where, addDoc, limit } from 'firebase/firestore';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { User, AppConfig } from '../types';
import { ShieldCheck, UserPlus, LogIn, Mail, KeyRound, Globe, Lock, ArrowRight, AlertTriangle, CheckCircle2, User as UserIcon, Sparkles, Moon, Sun, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BNBLogo } from './BNBLogo';
import { normalizeMemberId, normalizePhoneNumber, saveUserToLocalBackup, convertBengaliToEnglishDigits, getNextSequentialMemberId, getClientDeviceId, getDeviceFingerprint, findUserInFirestoreByPhone } from '../lib/memberUtils';
import ForgotPasswordModal from './ForgotPasswordModal';
import { sendEmailOtpDirect } from '../lib/emailOtpService';
import { apiUrl } from '../config/api';

interface LoginScreenProps {
  authUid?: string;
  onLoginSuccess: (user: User) => void;
  initialRegistering?: boolean;
  appConfig?: AppConfig | null;
  appLanguage?: string;
  onLanguageChange?: (lang: 'bn' | 'en') => void;
  darkMode?: boolean;
  onThemeToggle?: () => void;
}

export default function LoginScreen({
  authUid,
  onLoginSuccess,
  initialRegistering = false,
  appConfig,
  appLanguage = 'bn',
  onLanguageChange,
  darkMode = false,
  onThemeToggle
}: LoginScreenProps) {
  const [isRegistering, setIsRegistering] = useState(initialRegistering);
  const [step, setStep] = useState<'info' | 'verify-otp' | 'register-details'>('info');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [existingAccountConflict, setExistingAccountConflict] = useState<'email' | 'phone' | null>(null);

  // Form states
  const [email, setEmail] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('amb_saved_login_email') || '';
    }
    return '';
  });
  const [otpInput, setOtpInput] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [sentOtpCode, setSentOtpCode] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('bnb_pending_otp_code') || localStorage.getItem('bnb_pending_otp_code') || '';
    }
    return '';
  });
  const [foundUser, setFoundUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('bnb_pending_otp_user') || localStorage.getItem('bnb_pending_otp_user');
        return saved ? JSON.parse(saved) : null;
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [deliveryInfo, setDeliveryInfo] = useState<{
    deliveredTo?: string;
    isOwnerFallback?: boolean;
    channel?: 'phone' | 'email';
    targetPhone?: string;
    targetEmail?: string;
  } | null>(null);

  // Registration states
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPin, setRegPin] = useState('');

  // Synchronized Language & Theme states (works both controlled via props and standalone)
  const [currentLang, setCurrentLang] = useState<'bn' | 'en'>(() => {
    if (appLanguage === 'en' || appLanguage === 'bn') return appLanguage;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('amb_lang');
      if (saved === 'en' || saved === 'bn') return saved;
    }
    return 'bn';
  });

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof darkMode === 'boolean') return darkMode;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('amb_dark_mode') === 'true';
    }
    return false;
  });

  useEffect(() => {
    if (appLanguage === 'en' || appLanguage === 'bn') {
      setCurrentLang(appLanguage);
    }
  }, [appLanguage]);

  useEffect(() => {
    if (typeof darkMode === 'boolean') {
      setIsDark(darkMode);
    }
  }, [darkMode]);

  const isBn = currentLang === 'bn';

  const localizeErrorText = (rawError: string | undefined, fallbackBn: string, fallbackEn: string): string => {
    if (!rawError) return isBn ? fallbackBn : fallbackEn;
    const lower = rawError.toLowerCase();
    if (lower.includes('already') || lower.includes('exists') || rawError.includes('ইতিপূর্বে') || rawError.includes('আগেই')) {
      if (lower.includes('phone') || lower.includes('mobile') || rawError.includes('মোবাইল') || rawError.includes('ফোন')) {
        return isBn
          ? 'এই মোবাইল নম্বর দিয়ে আগেই অ্যাকাউন্ট খোলা হয়েছে। অনুগ্রহ করে লগইন করুন।'
          : 'An account has already been opened with this mobile number. Please log in.';
      }
      return isBn
        ? 'এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট খোলা হয়েছে। অনুগ্রহ করে লগইন করুন।'
        : 'An account has already been opened with this email. Please log in.';
    }
    if (lower.includes('not found') || lower.includes('no account') || rawError.includes('পাওয়া যায়নি') || rawError.includes('পাওয়া যায়নি')) {
      return isBn
        ? 'এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি। নতুন অ্যাকাউন্ট খুলতে অনুগ্রহ করে নিবন্ধন করুন।'
        : 'No account found with this email. Please sign up to create a new account.';
    }
    if (lower.includes('expired') || rawError.includes('মেয়াদ') || rawError.includes('মেয়াদ')) {
      return isBn
        ? 'ওটিপি কোডের মেয়াদ শেষ হয়ে গেছে। অনুগ্রহ করে পুনরায় ওটিপি পাঠান।'
        : 'The OTP code has expired. Please request a new OTP.';
    }
    if (lower.includes('invalid') || lower.includes('incorrect') || lower.includes('wrong') || rawError.includes('সঠিক নয়') || rawError.includes('সঠিক নয়') || rawError.includes('ভুল')) {
      return isBn
        ? 'প্রদত্ত ওটিপি কোডটি সঠিক নয়। অনুগ্রহ করে সঠিক ৬ সংখ্যার কোড দিন।'
        : 'Incorrect OTP code. Please enter the valid 6-digit code.';
    }
    if (lower.includes('too many') || lower.includes('rate') || rawError.includes('অতিরিক্ত')) {
      return isBn
        ? 'অতিরিক্তবার চেষ্টা করা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।'
        : 'Too many attempts. Please wait a moment and try again.';
    }
    if (isBn && /[a-zA-Z]{3,}/.test(rawError)) {
      return fallbackBn;
    }
    if (!isBn && /[\u0980-\u09FF]/.test(rawError)) {
      return fallbackEn;
    }
    return rawError;
  };

  const handleToggleLanguage = () => {
    const nextLang: 'bn' | 'en' = isBn ? 'en' : 'bn';
    setCurrentLang(nextLang);
    setError('');
    setExistingAccountConflict(null);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('amb_lang', nextLang);
      } catch (e) {}
    }
    if (onLanguageChange) {
      onLanguageChange(nextLang);
    }
  };

  const handleToggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('amb_dark_mode', String(nextDark));
        if (nextDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch (e) {}
    }
    if (onThemeToggle) {
      onThemeToggle();
    }
  };

  // Predictive in-memory cache so user lookup completes BEFORE the user even clicks "Send OTP"
  const prefetchedUsersRef = useRef<Map<string, User>>(new Map());
  const inflightLookupRef = useRef<Map<string, Promise<User | null>>>(new Map());

  const cacheLocatedUser = (cleanEmail: string, u: User) => {
    prefetchedUsersRef.current.set(cleanEmail, u);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`amb_fast_email_${cleanEmail}`, JSON.stringify(u));
      } catch (e) {}
    }
  };

  // Authoritative server lookup helper (exact email -> lowercase -> uid_mappings)
  const fetchUserFast = async (rawInput: string, silent = false): Promise<User | null> => {
    const trimmedInput = rawInput.trim();
    if (!trimmedInput || !trimmedInput.includes('@')) return null;
    const cleanInput = trimmedInput.toLowerCase();

    // 1. Instant in-memory prefetch cache hit (current page load only)
    const memCached = prefetchedUsersRef.current.get(cleanInput);
    if (memCached) return memCached;

    // Reuse inflight promise if already pre-fetching while user was typing
    const existingPromise = inflightLookupRef.current.get(cleanInput);
    if (existingPromise) return existingPromise;

    const lookupPromise = (async (): Promise<User | null> => {
      const requestUrl = apiUrl('/api/auth/locate-user');
      try {
        const res = await fetch(requestUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Pass trimmedInput (preserving case) so server checks exact stored email first, then lowercase, then uid_mappings
          body: JSON.stringify({ query: trimmedInput })
        });
        const status = res.status;
        const contentType = res.headers.get('content-type') || '';
        let data: any = {};
        if (contentType.includes('application/json')) {
          data = await res.json().catch(() => ({}));
        }
        if (res.ok && data.found && data.user) {
          if (import.meta.env.DEV && !silent) {
            console.debug('[Auth] Located user:', { status });
          }
          const located = data.user as User;
          cacheLocatedUser(cleanInput, located);
          return located;
        }
      } catch (e) {
        if (import.meta.env.DEV && !silent) {
          console.debug('[Auth] Lookup error:', e);
        }
      }
      return null;
    })();

    inflightLookupRef.current.set(cleanInput, lookupPromise);
    try {
      return await lookupPromise;
    } finally {
      inflightLookupRef.current.delete(cleanInput);
    }
  };

  // Predictive pre-fetching: as soon as the user types or loads a valid email, resolve the account in the background BEFORE click!
  useEffect(() => {
    const candidate = email.trim();
    if (
      !isRegistering &&
      step === 'info' &&
      candidate.length >= 6 &&
      candidate.includes('@') &&
      candidate.includes('.')
    ) {
      const timer = setTimeout(() => {
        fetchUserFast(candidate, true).catch(() => {});
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [email, isRegistering, step]);

  // Helper to locate user via server-side endpoint (exact email -> lowercase -> uid_mappings)
  const locateUser = async (rawInput: string): Promise<User | null> => {
    const trimmedInput = rawInput.trim();
    if (!trimmedInput) return null;

    // Strict Rule: BNB member codes or non-email queries are directly forbidden
    if (!trimmedInput.includes('@') && (trimmedInput.toUpperCase().includes('BNB') || /^\d+$/.test(trimmedInput))) {
      setError(
        isBn
          ? 'মেম্বার আইডি বা অ্যাকাউন্ট নম্বর দিয়ে লগইন করা সম্পূর্ণ নিষিদ্ধ! শুধুমাত্র আপনার নিবন্ধিত বৈধ ইমেইলের মাধ্যমে লগইন করুন।'
          : 'Logging in with a member ID or account number is strictly prohibited! Please log in using your registered valid email only.'
      );
      return null;
    }

    if (!trimmedInput.includes('@')) {
      setError(
        isBn
          ? 'অনুগ্রহ করে আপনার সঠিক নিবন্ধিত ইমেইল ঠিকানা প্রদান করুন।'
          : 'Please enter your valid registered email address.'
      );
      return null;
    }

    return await fetchUserFast(trimmedInput, false);
  };

  // Handle Send OTP for Login (Works for ANY registered email; never creates an account)
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setExistingAccountConflict(null);
    setSuccessMessage('');
    const rawInput = email.trim();
    if (!rawInput) {
      setError(
        isBn
          ? 'অনুগ্রহ করে আপনার নিবন্ধিত ইমেইল ঠিকানা প্রদান করুন।'
          : 'Please enter your registered email address.'
      );
      return;
    }

    // Strict Rule: BNB member codes or numeric IDs are forbidden
    if (!rawInput.includes('@') && (rawInput.toUpperCase().includes('BNB') || /^\d+$/.test(rawInput))) {
      setError(
        isBn
          ? 'মেম্বার আইডি বা অ্যাকাউন্ট নম্বর দিয়ে লগইন করা সম্পূর্ণ নিষিদ্ধ! শুধুমাত্র আপনার নিবন্ধিত বৈধ ইমেইল ঠিকানার মাধ্যমে লগইন করুন।'
          : 'Logging in with a member ID or account number is strictly prohibited! Please log in using your registered valid email address only.'
      );
      return;
    }

    if (!rawInput.includes('@') || !rawInput.includes('.')) {
      setError(
        isBn
          ? 'অনুগ্রহ করে আপনার সঠিক নিবন্ধিত ইমেইল ঠিকানা প্রদান করুন।'
          : 'Please enter your valid registered email address.'
      );
      return;
    }

    setLoading(true);

    try {
      const targetUser = await locateUser(rawInput);
      if (!targetUser) {
        setError(
          isBn
            ? 'এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি। নতুন অ্যাকাউন্ট খুলতে অনুগ্রহ করে নিবন্ধন করুন।'
            : 'No account found with this email. Please sign up to create a new account.'
        );
        return;
      }

      setFoundUser(targetUser);

      const userDisplayName = targetUser.name || (isBn ? 'সম্মানিত সদস্য' : 'Respected Member');
      const userPhone = targetUser.phone || '';
      const userEmail = targetUser.email
        ? targetUser.email.trim().toLowerCase()
        : (targetUser.phone && targetUser.phone.includes('@') ? targetUser.phone.trim().toLowerCase() : rawInput.toLowerCase());

      if (!userEmail || !userEmail.includes('@')) {
        setError(
          isBn
            ? 'এই অ্যাকাউন্টের সাথে কোনো বৈধ ইমেইল যুক্ত নেই। সুরক্ষার স্বার্থে শুধুমাত্র নিবন্ধিত ইমেইলের মাধ্যমেই ওটিপি ভেরিফিকেশন করে লগইন করা সম্ভব।'
            : 'No valid email is linked to this account. For security reasons, login is only possible via OTP verification sent to a registered email.'
        );
        return;
      }

      const targetEmail = userEmail;

      // Format phone for Bangladesh or international standards
      let formattedPhone = '';
      if (userPhone) {
        let rawDigits = convertBengaliToEnglishDigits(userPhone).replace(/\D/g, '');
        if (rawDigits.length === 11 && rawDigits.startsWith('0')) {
          formattedPhone = `+88${rawDigits}`;
        } else if (rawDigits.length === 10) {
          formattedPhone = `+880${rawDigits}`;
        } else if (rawDigits.startsWith('880')) {
          formattedPhone = `+${rawDigits}`;
        } else if (rawDigits.startsWith('+')) {
          formattedPhone = rawDigits;
        } else if (rawDigits) {
          formattedPhone = `+88${rawDigits}`;
        }
      }

      setSentOtpCode('');
      setFoundUser(targetUser);

      // Persist pending user info (NEVER persist OTP code client-side)
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('bnb_pending_otp_code');
        localStorage.removeItem('bnb_pending_otp_code');
        sessionStorage.setItem('bnb_pending_otp_user', JSON.stringify(targetUser));
        localStorage.setItem('bnb_pending_otp_user', JSON.stringify(targetUser));
        localStorage.setItem('amb_saved_login_email', rawInput);
      }

      // Mask email for privacy display
      const maskEmail = (em: string) => {
        const parts = em.split('@');
        if (parts.length !== 2) return em;
        const namePart = parts[0];
        const masked = namePart.length > 2 ? `${namePart.slice(0, 2)}••••${namePart.slice(-1)}` : `${namePart}•`;
        return `${masked}@${parts[1]}`;
      };
      const displayEmail = maskEmail(targetEmail);

      // Dispatch server-generated 6-digit Email OTP to any registered email
      const otpDispatch = await sendEmailOtpDirect({
        email: targetEmail,
        otp: '',
        userName: userDisplayName,
        phone: formattedPhone || userPhone,
        memberId: targetUser.memberId || rawInput,
        userId: targetUser.uid,
        reason: 'login'
      });

      if (!otpDispatch.success) {
        setError(
          localizeErrorText(
            otpDispatch.error,
            'ওটিপি পাঠাতে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।',
            'Failed to send OTP. Please try again.'
          )
        );
        return;
      }

      setDeliveryInfo({
        deliveredTo: displayEmail,
        channel: 'email',
        targetPhone: formattedPhone,
        targetEmail: targetEmail
      });

      setSuccessMessage(
        isBn
          ? `আপনার নিবন্ধিত ইমেইলে (${displayEmail}) ৬ সংখ্যার ভেরিফিকেশন ওটিপি কোড পাঠানো হয়েছে (মেয়াদ ৫ মিনিট)। অনুগ্রহ করে আপনার ইনবক্স চেক করুন।`
          : `A 6-digit verification OTP code has been sent to your registered email (${displayEmail}). Please check your inbox.`
      );

      setStep('verify-otp');
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('Login error:', err);
      }
      setError(
        isBn
          ? 'লগইন প্রক্রিয়ায় ত্রুটি হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।'
          : 'An error occurred during login. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Execute actual login with unique activeSessionToken for single-device session control (Instant 0ms UI switch)
  const executeLogin = (userToLogin: User) => {
    const newSessionToken = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const deviceId = getClientDeviceId();
    
    const userWithToken: User = {
      ...userToLogin,
      activeSessionToken: newSessionToken,
      activeSessionDeviceId: deviceId
    };

    // 1. Synchronously persist session keys to guarantee 100% immediate state persistence
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('amb_user_uid', userWithToken.uid);
        localStorage.setItem('amb_user_phone', userWithToken.phone || '');
        localStorage.setItem('amb_user_name', userWithToken.name || 'সদস্য');
        localStorage.setItem('amb_user_role', userWithToken.role || 'user');
        localStorage.setItem('bnb_user_member_id', userWithToken.memberId || 'BNB00000000');
        localStorage.setItem('amb_active_session_token', newSessionToken);
        localStorage.setItem('amb_last_user', JSON.stringify(userWithToken));
        sessionStorage.removeItem('amb_session_unlocked');

        // Clear transient OTP storage
        sessionStorage.removeItem('bnb_pending_otp_code');
        sessionStorage.removeItem('bnb_pending_otp_user');
        localStorage.removeItem('bnb_pending_otp_code');
        localStorage.removeItem('bnb_pending_otp_user');
      } catch (storeErr) {
        if (import.meta.env.DEV) {
          console.warn('Storage save warning:', storeErr);
        }
      }
    }

    // 2. Set explicit success feedback
    setSuccessMessage(
      isBn
        ? '✅ ওটিপি যাচাই সফল হয়েছে! অনুগ্রহ করে আপনার 4 ডিজিট পিন দিন...'
        : '✅ OTP verification successful! Please enter your 4-digit PIN...'
    );
    setError('');
    setExistingAccountConflict(null);

    // 3. Immediately invoke onLoginSuccess to switch screen to user dashboard (NEVER blocked by network)
    onLoginSuccess(userWithToken);

    // 4. Background non-blocking session recording via Admin SDK server route
    try {
      fetch(apiUrl('/api/auth/record-login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: userWithToken.uid,
          activeSessionToken: newSessionToken,
          deviceId: deviceId
        })
      }).catch(() => {});
    } catch (e) {}
  };

  // Verify OTP strictly via Server (/api/verify-otp) for both Login and Signup
  const handleVerifyOtp = async (e?: React.FormEvent, directCode?: string) => {
    if (e) e.preventDefault();
    const code = convertBengaliToEnglishDigits(directCode || otpInput).trim();
    if (!code) {
      setError(
        isBn
          ? 'অনুগ্রহ করে আপনার ইমেইলে আসা ৬ সংখ্যার ওটিপি কোডটি লিখুন।'
          : 'Please enter the 6-digit OTP code sent to your email.'
      );
      return;
    }

    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setError(
        isBn
          ? 'ওটিপি কোড অবশ্যই ৬ সংখ্যার হতে হবে।'
          : 'The OTP code must be 6 digits.'
      );
      return;
    }

    setLoading(true);
    setError('');
    setExistingAccountConflict(null);

    try {
      let effectiveUser = foundUser;
      if (!effectiveUser && !isRegistering && typeof window !== 'undefined') {
        try {
          const raw = sessionStorage.getItem('bnb_pending_otp_user') || localStorage.getItem('bnb_pending_otp_user');
          if (raw) effectiveUser = JSON.parse(raw);
        } catch (e) {}
      }

      const rawEnteredEmail = (email || effectiveUser?.email || '').trim();
      const targetEmail = (effectiveUser?.email || email || '').trim().toLowerCase();
      if (!targetEmail) {
        setError(isBn ? 'ইমেইল ঠিকানা পাওয়া যায়নি।' : 'Email address not found.');
        return;
      }

      // Authoritative Server-Side OTP Verification (on login, server resolves existing user: exact -> lowercase -> uid_mappings)
      const verifyRes = await fetch(apiUrl('/api/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: rawEnteredEmail || targetEmail,
          otp: code,
          purpose: isRegistering ? 'signup' : 'login'
        })
      });
      const verifyData = await verifyRes.json().catch(() => null);

      if (!isRegistering && (verifyRes.status === 404 || verifyData?.code === 'user_not_found')) {
        setError(
          isBn
            ? 'এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি। নতুন অ্যাকাউন্ট খুলতে অনুগ্রহ করে নিবন্ধন করুন।'
            : 'No account found with this email. Please sign up to create a new account.'
        );
        return;
      }

      if (!verifyRes.ok || !verifyData?.verified) {
        setError(
          localizeErrorText(
            verifyData?.error,
            'প্রদত্ত ওটিপি কোডটি সঠিক নয় বা মেয়াদ শেষ হয়েছে। অনুগ্রহ করে সঠিক ৬ সংখ্যার কোড দিন।',
            'Invalid or expired OTP code. Please enter the correct 6-digit code.'
          )
        );
        return;
      }

      // If completing new account registration after Email OTP verification:
      if (isRegistering) {
        const cleanPhoneDigits = convertBengaliToEnglishDigits(regPhone).replace(/\D/g, '');
        const standardPhone = cleanPhoneDigits.length === 11 && cleanPhoneDigits.startsWith('0') ? `+88${cleanPhoneDigits}` : cleanPhoneDigits;

        const regRes = await fetch(apiUrl('/api/auth/register'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: regName.trim(),
            email: targetEmail,
            phone: standardPhone,
            password: regPassword.trim(),
            pin: convertBengaliToEnglishDigits(regPin).trim(),
            otp: code,
            otpVerificationToken: verifyData.otpVerificationToken || ''
          })
        });
        const regData = await regRes.json().catch(() => null);
        if (!regRes.ok || !regData?.success || !regData?.user) {
          const errRaw = String(regData?.error || '');
          const errLower = errRaw.toLowerCase();
          if (
            regRes.status === 409 ||
            errLower.includes('already') ||
            errLower.includes('exists') ||
            errRaw.includes('ইতিপূর্বে') ||
            errRaw.includes('আগেই')
          ) {
            const isPhoneConflict =
              errLower.includes('phone') ||
              errLower.includes('mobile') ||
              errRaw.includes('মোবাইল') ||
              errRaw.includes('ফোন');
            setStep('info');
            setOtpInput('');
            setSuccessMessage('');
            setExistingAccountConflict(isPhoneConflict ? 'phone' : 'email');
            setError(
              isPhoneConflict
                ? isBn
                  ? 'এই মোবাইল নম্বর দিয়ে আগেই অ্যাকাউন্ট খোলা হয়েছে। অনুগ্রহ করে লগইন করুন।'
                  : 'An account has already been opened with this mobile number. Please log in.'
                : isBn
                ? 'এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট খোলা হয়েছে। অনুগ্রহ করে লগইন করুন।'
                : 'An account has already been opened with this email. Please log in.'
            );
            return;
          }
          setError(
            localizeErrorText(
              regData?.error,
              'অ্যাকাউন্ট তৈরিতে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।',
              'Failed to create account. Please try again.'
            )
          );
          return;
        }
        saveUserToLocalBackup(regData.user);
        setSuccessMessage(
          isBn
            ? '✅ ইমেইল যাচাই ও অ্যাকাউন্ট তৈরি সফল হয়েছে! স্বাগতম...'
            : '✅ Email verified and account created successfully! Welcome...'
        );
        executeLogin(regData.user);
        return;
      }

      // Otherwise, completing Login: NEVER create a new account at login.
      // Use server-resolved user from /api/verify-otp (exact -> lowercase -> uid_mappings), or fallback to locateUser
      let resolvedLoginUser: User | null = (verifyData?.user as User) || null;
      if (!resolvedLoginUser) {
        resolvedLoginUser = await locateUser(rawEnteredEmail || targetEmail);
      }

      if (resolvedLoginUser && resolvedLoginUser.uid) {
        setSuccessMessage(
          isBn
            ? '✅ ওটিপি যাচাই সফল হয়েছে! স্বাগতম...'
            : '✅ OTP verified successfully! Welcome...'
        );
        executeLogin(resolvedLoginUser);
      } else {
        setError(
          isBn
            ? 'এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি। নতুন অ্যাকাউন্ট খুলতে অনুগ্রহ করে নিবন্ধন করুন।'
            : 'No account found with this email. Please sign up to create a new account.'
        );
      }
    } catch (verifyErr: any) {
      if (import.meta.env.DEV) {
        console.error('OTP Verification Error:', verifyErr);
      }
      setError(
        isBn ? 'ওটিপি যাচাই করতে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।' : 'Failed to verify OTP. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Registration handler (Step 1: validate fields, ensure email/phone is not already registered, dispatch server OTP -> Step 2: verify OTP & create account)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setExistingAccountConflict(null);
    setSuccessMessage('');

    if (!regName.trim() || !email.trim() || !regPhone.trim() || !regPassword.trim() || !regPin.trim()) {
      setError(
        isBn
          ? 'অনুগ্রহ করে সকল তারকাচিহ্নিত (*) তথ্য সঠিকভাবে পূরণ করুন।'
          : 'Please fill in all required (*) fields properly.'
      );
      return;
    }

    const cleanRegEmail = email.trim().toLowerCase();
    if (!cleanRegEmail.includes('@') && cleanRegEmail.toUpperCase().includes('BNB')) {
      setError(
        isBn
          ? 'মেম্বার আইডি দিয়ে অ্যাকাউন্ট খোলা সম্পূর্ণ নিষিদ্ধ! শুধুমাত্র আপনার ব্যক্তিগত বৈধ ইমেইল ঠিকানা দিয়ে অ্যাকাউন্ট খুলুন।'
          : 'Opening an account with a member ID is strictly prohibited! Please register using your personal valid email address only.'
      );
      return;
    }

    if (!cleanRegEmail.includes('@') || !cleanRegEmail.includes('.')) {
      setError(
        isBn
          ? 'অনুগ্রহ করে একটি সঠিক ও সক্রিয় ইমেইল ঠিকানা প্রদান করুন।'
          : 'Please provide a valid and active email address.'
      );
      return;
    }

    const cleanPhoneDigits = convertBengaliToEnglishDigits(regPhone).replace(/\D/g, '');
    if (cleanPhoneDigits.length < 10 || cleanPhoneDigits.length > 15) {
      setError(
        isBn
          ? 'অনুগ্রহ করে সঠিক মোবাইল নম্বর প্রদান করুন।'
          : 'Please enter a valid mobile number.'
      );
      return;
    }

    const cleanPinDigits = convertBengaliToEnglishDigits(regPin).trim();
    if (cleanPinDigits.length !== 4 || !/^\d{4}$/.test(cleanPinDigits)) {
      setError(
        isBn
          ? 'সিকিউরিটি পিন অবশ্যই 4 ডিজিটের হতে হবে।'
          : 'Security PIN must be exactly 4 digits.'
      );
      return;
    }

    setLoading(true);

    try {
      // 1. Check if email already has an account before sending signup OTP
      const existing = await fetchUserFast(cleanRegEmail, true);
      if (existing) {
        setExistingAccountConflict('email');
        setError(
          isBn
            ? 'এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট খোলা হয়েছে। অনুগ্রহ করে লগইন করুন।'
            : 'An account has already been opened with this email. Please log in.'
        );
        setLoading(false);
        return;
      }

      // 2. Check if phone number already has an account before sending signup OTP
      const existingByPhone = await findUserInFirestoreByPhone(db, cleanPhoneDigits).catch(() => null);
      if (existingByPhone && existingByPhone.data) {
        setExistingAccountConflict('phone');
        setError(
          isBn
            ? 'এই মোবাইল নম্বর দিয়ে আগেই অ্যাকাউন্ট খোলা হয়েছে। অনুগ্রহ করে লগইন করুন।'
            : 'An account has already been opened with this mobile number. Please log in.'
        );
        setLoading(false);
        return;
      }

      const otpRes = await sendEmailOtpDirect({
        email: cleanRegEmail,
        otp: '',
        userName: regName.trim(),
        phone: regPhone.trim(),
        reason: 'verification'
      });

      if (!otpRes.success) {
        setError(
          localizeErrorText(
            otpRes.error,
            'ভেরিফিকেশন ওটিপি পাঠাতে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।',
            'Failed to send verification OTP. Please try again.'
          )
        );
        setLoading(false);
        return;
      }

      setDeliveryInfo({
        deliveredTo: cleanRegEmail,
        channel: 'email',
        targetPhone: regPhone.trim(),
        targetEmail: cleanRegEmail
      });

      setSuccessMessage(
        isBn
          ? `আপনার ইমেইল (${cleanRegEmail}) যাচাই করতে ৬ সংখ্যার ওটিপি পাঠানো হয়েছে। ওটিপি দিয়ে নিবন্ধন সম্পন্ন করুন।`
          : `A 6-digit OTP has been sent to ${cleanRegEmail}. Enter the OTP to complete registration.`
      );
      setStep('verify-otp');
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error(err);
      }
      setError(
        isBn
          ? 'অ্যাকাউন্ট তৈরিতে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।'
          : 'Error creating account. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Dedicated Full-Screen Forgot Password Screen (not a popup/modal)
  if (showForgotPassword) {
    return (
      <ForgotPasswordModal
        isOpen={true}
        onClose={() => setShowForgotPassword(false)}
        onLoginSuccess={(loggedInUser) => {
          executeLogin(loggedInUser);
        }}
        locateUser={locateUser}
        appConfig={appConfig}
        darkMode={isDark}
        appLanguage={currentLang}
      />
    );
  }

  return (
    <div
      className={`min-h-screen w-full flex flex-col relative overflow-x-hidden font-sans select-none transition-colors duration-200 ${
        isDark ? 'bg-[#0B1120] text-slate-100' : 'bg-white text-slate-900'
      }`}
      id="login-container"
    >
      {/* 1. TOP HEADER SECTION WITH GREEN GRADIENT & WAVES */}
      <div
        className={`relative w-full bg-gradient-to-b ${
          isDark
            ? 'from-[#06331C] via-[#084426] to-[#0A522E]'
            : 'from-[#094828] via-[#0B5C33] to-[#0D6B3C]'
        } text-white pt-safe sm:pt-4 pb-12 sm:pb-16 px-4 overflow-hidden shadow-lg transition-colors duration-200`}
      >
        {/* Subtle decorative background silhouettes / landscape */}
        <div className="absolute inset-0 opacity-15 pointer-events-none mix-blend-overlay">
          <svg className="w-full h-full object-cover" viewBox="0 0 800 400" fill="currentColor" preserveAspectRatio="none">
            <path d="M0,280 L40,260 L80,280 L120,250 L160,270 L200,240 L240,270 L280,230 L320,260 L360,240 L400,260 L440,250 L480,270 L520,240 L560,260 L600,230 L640,270 L680,250 L720,270 L760,240 L800,260 L800,400 L0,400 Z" />
            <rect x="30" y="160" width="35" height="120" />
            <rect x="75" y="140" width="40" height="140" />
            <polygon points="95,90 80,140 110,140" />
            <rect x="130" y="170" width="30" height="110" />
            <rect x="180" y="130" width="45" height="150" />
            <rect x="240" y="150" width="35" height="130" />
            <rect x="290" y="180" width="40" height="100" />
            <rect x="350" y="140" width="50" height="140" />
            <polygon points="375,100 355,140 395,140" />
          </svg>
        </div>

        {/* Top Control Bar: Left BNB Security Gateway pill, Right Language & Theme buttons */}
        <div className="max-w-md mx-auto w-full flex items-center justify-between relative z-20 mb-4 sm:mb-6">
          {/* Left: BNB Security Gateway pill (Non-clickable security indicator) */}
          <div
            className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full border shadow-xs select-none transition-colors ${
              isDark
                ? 'bg-slate-900/90 text-emerald-300 border-emerald-500/40'
                : 'bg-white/95 text-emerald-900 border-emerald-400/30'
            }`}
            title={isBn ? 'সিকিউরিটি গেটওয়ে' : 'Security Gateway'}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[11px] sm:text-xs font-black tracking-tight">
              {isBn ? 'BNB সিকিউরিটি গেটওয়ে' : 'BNB Security Gateway'}
            </span>
          </div>

          {/* Right: Language (English / বাংলা) & Theme (Dark / Light) toggle buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleLanguage}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] sm:text-xs font-black shadow-xs active:scale-95 transition cursor-pointer ${
                isDark
                  ? 'bg-slate-900/90 text-slate-100 border-slate-700 hover:bg-slate-800'
                  : 'bg-white text-slate-800 border-slate-200/90 hover:bg-slate-50'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-emerald-500" />
              <span>{isBn ? 'English' : 'বাংলা'}</span>
            </button>
            <button
              type="button"
              onClick={handleToggleTheme}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] sm:text-xs font-black shadow-xs active:scale-95 transition cursor-pointer ${
                isDark
                  ? 'bg-slate-900/90 text-amber-300 border-slate-700 hover:bg-slate-800'
                  : 'bg-white text-slate-800 border-slate-200/90 hover:bg-slate-50'
              }`}
            >
              {isDark ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>{isBn ? 'সাদা মোড' : 'Light'}</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                  <span>{isBn ? 'ডার্ক মোড' : 'Dark'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Center: Official BNB Emblem inside Black Square Frame + Brand Typography */}
        <div className="max-w-md mx-auto w-full flex flex-col items-center justify-center text-center relative z-20 mt-1">
          {/* Black Square Logo Box */}
          <div className="w-[78px] h-[78px] sm:w-[86px] sm:h-[86px] bg-black border border-neutral-700/80 rounded-xl shadow-xl flex items-center justify-center p-2 mb-3">
            {appConfig?.logoUrl ? (
              <img
                src={appConfig.logoUrl}
                alt="BNB Logo"
                className="w-full h-full object-contain filter drop-shadow-md"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <BNBLogo size={58} variant="white" />
              </div>
            )}
          </div>

          {/* Typography: BNB BUSINESS NETWORK BANGLADESH */}
          <div className="space-y-0.5">
            <h1 className="flex items-center justify-center text-white drop-shadow-md leading-none">
              <span className="font-serif italic font-extrabold text-2xl sm:text-3xl text-white mr-1.5">
                BNB
              </span>
              <span className="font-sans font-black text-lg sm:text-xl tracking-wider text-white uppercase">
                BUSINESS NETWORK
              </span>
            </h1>
            <div className="text-emerald-200 text-xs sm:text-[13px] font-black tracking-[0.38em] text-center uppercase drop-shadow-sm mt-0.5">
              BANGLADESH
            </div>
          </div>
        </div>

        {/* Organic Multi-Layered Curved Waves at the bottom of the Header */}
        <div className="absolute bottom-0 left-0 right-0 w-full overflow-hidden leading-none z-10 pointer-events-none">
          <svg
            className="relative block w-full h-8 sm:h-12"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
          >
            {/* Background wave shadow layer */}
            <path
              d="M0,0 C150,90 350,-20 500,60 C650,140 900,10 1200,50 L1200,120 L0,120 Z"
              fill={isDark ? 'rgba(6, 78, 59, 0.5)' : 'rgba(16, 114, 61, 0.45)'}
            />
            {/* Foreground crisp wave matching body background */}
            <path
              d="M0,35 C180,105 380,10 550,75 C720,135 950,25 1200,65 L1200,120 L0,120 Z"
              fill={isDark ? '#0B1120' : '#FFFFFF'}
            />
          </svg>
        </div>
      </div>

      {/* 2. MIDDLE CONTENT SECTION */}
      <div className="w-full flex-1 flex flex-col justify-start items-center px-4 pt-1 pb-6 z-20">
        <div className="max-w-md w-full space-y-4">
          {/* Login and Registration Tab Pill Bar */}
          <div
            className={`p-1.5 rounded-full flex gap-1.5 shadow-inner transition-colors ${
              isDark ? 'bg-slate-800/90 border border-slate-700/80' : 'bg-[#EEF2F6]'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setIsRegistering(false);
                setStep('info');
                setError('');
                setExistingAccountConflict(null);
                setSuccessMessage('');
              }}
              className={`flex-1 py-3 px-4 sm:px-6 rounded-full text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                !isRegistering && step !== 'register-details'
                  ? isDark
                    ? 'bg-slate-950 border-2 border-emerald-500 text-emerald-400 shadow-md'
                    : 'bg-white border-2 border-emerald-600 text-emerald-950 shadow-sm'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-100 bg-transparent'
                  : 'text-slate-600 hover:text-slate-900 bg-transparent'
              }`}
            >
              <LogIn
                className={`w-4 h-4 sm:w-5 sm:h-5 ${
                  !isRegistering && step !== 'register-details'
                    ? isDark
                      ? 'text-emerald-400 stroke-[2.5]'
                      : 'text-emerald-700 stroke-[2.5]'
                    : isDark
                    ? 'text-slate-400 stroke-[2]'
                    : 'text-slate-500 stroke-[2]'
                }`}
              />
              <span>{isBn ? 'লগইন করুন' : 'Login'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsRegistering(true);
                setStep('info');
                setError('');
                setExistingAccountConflict(null);
                setSuccessMessage('');
              }}
              className={`flex-1 py-3 px-4 sm:px-6 rounded-full text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isRegistering || step === 'register-details'
                  ? isDark
                    ? 'bg-slate-950 border-2 border-emerald-500 text-emerald-400 shadow-md'
                    : 'bg-white border-2 border-emerald-600 text-emerald-950 shadow-sm'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-100 bg-transparent'
                  : 'text-slate-600 hover:text-slate-900 bg-transparent'
              }`}
            >
              <UserPlus
                className={`w-4 h-4 sm:w-5 sm:h-5 ${
                  isRegistering || step === 'register-details'
                    ? isDark
                      ? 'text-emerald-400 stroke-[2.5]'
                      : 'text-emerald-700 stroke-[2.5]'
                    : isDark
                    ? 'text-slate-400 stroke-[2]'
                    : 'text-slate-500 stroke-[2]'
                }`}
              />
              <span>{isBn ? 'নিবন্ধন করুন' : 'Register'}</span>
            </button>
          </div>

          {/* Feedback messages */}
          {error && (
            <div
              className={`text-xs p-3.5 rounded-2xl font-bold flex flex-col gap-2.5 shadow-xs animate-fade-in border ${
                isDark
                  ? 'bg-rose-950/60 border-rose-800/80 text-rose-200'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${isDark ? 'text-rose-400' : 'text-rose-600'}`} />
                <span className="leading-relaxed">{error}</span>
              </div>
              {isRegistering && existingAccountConflict && (
                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(false);
                    setStep('info');
                    setError('');
                    setExistingAccountConflict(null);
                    setSuccessMessage('');
                  }}
                  className="self-start inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-[#0B532C] hover:bg-[#084223] active:bg-[#06331B] text-white text-xs font-black shadow-xs transition active:scale-95 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{isBn ? 'লগইন করুন' : 'Switch to Login'}</span>
                </button>
              )}
            </div>
          )}

          {/* FORM VIEW ROUTING */}
          <AnimatePresence>
            {step === 'verify-otp' ? (
              /* OTP VERIFICATION STEP */
              <motion.div
                key="otp-step"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.08 }}
                className="space-y-4 pt-2"
              >
                <div className="text-center space-y-1.5">
                  <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {isBn ? '৬ সংখ্যার ওটিপি কোড দিন' : 'Enter 6-Digit OTP Code'}
                  </h3>
                  <p className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {deliveryInfo?.channel === 'phone' ? (
                      isBn ? (
                        <>
                          আপনার সিমে{' '}
                          <span className={`font-bold font-mono tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-800'}`}>
                            ({deliveryInfo?.deliveredTo || email})
                          </span>{' '}
                          ফায়ারবেজ থেকে ওটিপি পাঠানো হয়েছে। মেসেজ চেক করে কোড দিন।
                        </>
                      ) : (
                        <>
                          An OTP has been sent to your phone{' '}
                          <span className={`font-bold font-mono tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-800'}`}>
                            ({deliveryInfo?.deliveredTo || email})
                          </span>
                          . Please check your SMS and enter the code.
                        </>
                      )
                    ) : isBn ? (
                      <>
                        আপনার ইমেইল ঠিকানায়{' '}
                        <span className={`font-bold font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-800'}`}>
                          ({deliveryInfo?.deliveredTo || email})
                        </span>{' '}
                        অফিসিয়াল সিকিউরিটি ওটিপি পাঠানো হয়েছে।
                      </>
                    ) : (
                      <>
                        An official security OTP has been sent to your email address{' '}
                        <span className={`font-bold font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-800'}`}>
                          ({deliveryInfo?.deliveredTo || email})
                        </span>
                        .
                      </>
                    )}
                  </p>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5 px-1">
                      <label className={`block text-xs font-extrabold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        {isBn ? 'ওটিপি কোড (৬ ডিজিট)' : 'OTP Code (6 Digits)'}
                      </label>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoFocus
                      required
                      maxLength={6}
                      value={otpInput}
                      onChange={(e) => {
                        const val = convertBengaliToEnglishDigits(e.target.value).replace(/\D/g, '');
                        setOtpInput(val);
                        if (val.length === 6) {
                          handleVerifyOtp(undefined, val);
                        }
                      }}
                      placeholder="• • • • • •"
                      className={`w-full py-3.5 px-5 border-2 rounded-full text-center font-mono text-xl font-black tracking-widest focus:outline-none focus:ring-4 focus:ring-emerald-500/15 shadow-2xs transition-colors ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500'
                          : 'bg-white border-slate-200 text-slate-950 placeholder-slate-400 focus:border-emerald-600'
                      }`}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#0B532C] hover:bg-[#084223] active:bg-[#06331B] text-white font-black py-4 px-6 rounded-full text-sm sm:text-base shadow-md flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-98"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>{isBn ? 'ওটিপি যাচাই করে প্রবেশ করুন' : 'Verify OTP & Login'}</span>
                        <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                      </>
                    )}
                  </button>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={loading}
                      className={`flex-1 py-2.5 rounded-full border text-xs font-bold transition cursor-pointer ${
                        isDark
                          ? 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {isBn ? 'পুনরায় কোড পাঠান' : 'Resend OTP'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStep('info');
                        setOtpInput('');
                        setError('');
                        setExistingAccountConflict(null);
                      }}
                      className={`flex-1 py-2.5 rounded-full border text-xs font-bold transition cursor-pointer ${
                        isDark
                          ? 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {isBn ? 'অ্যাকাউন্ট / ইমেইল পরিবর্তন' : 'Change Email'}
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : !isRegistering ? (
              /* LOGIN FORM (MANDATORY SECURE OTP LOGIN) */
              <motion.form
                key="login-form-otp"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.08 }}
                onSubmit={handleSendOtp}
                className="space-y-4 pt-1"
              >
                {/* Input Label & Field */}
                <div>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <label className={`block text-xs sm:text-sm font-extrabold text-left ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                      {isBn ? 'আপনার নিবন্ধিত ইমেইল ঠিকানা' : 'Your Registered Email Address'}
                    </label>
                    <span
                      className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${
                        isDark
                          ? 'text-emerald-300 bg-emerald-950/70 border-emerald-700/70'
                          : 'text-emerald-800 bg-emerald-50 border-emerald-200'
                      }`}
                    >
                      {isBn ? 'ইমেইল ওটিপি যাচাই' : 'Email OTP Verify'}
                    </span>
                  </div>
                  <div className="relative">
                    <div className={`absolute inset-y-0 left-0 pl-4.5 flex items-center pointer-events-none ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                      <Mail className="w-5 h-5 stroke-[2]" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError('');
                      }}
                      placeholder={isBn ? 'আপনার নিবন্ধিত ইমেইল লিখুন' : 'Enter your email (e.g. name@gmail.com)'}
                      className={`w-full pl-13 pr-5 py-3.5 sm:py-4 border-2 rounded-full text-xs sm:text-sm font-bold focus:outline-none focus:ring-4 focus:ring-emerald-500/15 shadow-2xs transition-all ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500'
                          : 'bg-white border-slate-200/90 text-slate-950 placeholder-slate-400 focus:border-emerald-600'
                      }`}
                    />
                  </div>
                </div>

                {/* Forgot PIN link */}
                <div className="flex justify-end pt-0.5 px-1">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className={`text-xs font-bold underline cursor-pointer flex items-center gap-1 ${
                      isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-800 hover:text-emerald-950'
                    }`}
                  >
                    <span>🔑</span>
                    <span>{isBn ? 'পিন ভুলে গেছেন? পিন রিসেট করুন' : 'Forgot PIN? Reset PIN'}</span>
                  </button>
                </div>

                {/* Primary Action Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#0B532C] hover:bg-[#084223] active:bg-[#06331B] text-white font-black py-3.5 sm:py-4 px-6 rounded-full text-sm sm:text-base shadow-md flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-98"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>{isBn ? 'ওটিপি কোড পাঠান' : 'Send OTP Code'}</span>
                      <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                    </>
                  )}
                </button>
              </motion.form>
            ) : (
              /* REGISTRATION FORM (CONSISTENT ROUNDED-FULL DESIGN) */
              <motion.form
                key="register-form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.08 }}
                onSubmit={handleRegisterSubmit}
                className="space-y-3 pt-1 text-left"
              >
                <div>
                  <label className={`block text-xs font-extrabold mb-1 px-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {isBn ? 'আপনার পূর্ণ নাম *' : 'Your Full Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder={isBn ? 'উদাঃ মোঃ মোজাম্মেল হক' : 'e.g. Md. Mozammel Haque'}
                    className={`w-full px-5 py-3 border-2 rounded-full text-xs sm:text-sm font-bold focus:outline-none shadow-2xs transition-colors ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500'
                        : 'bg-white border-slate-200 text-slate-950 placeholder-slate-400 focus:border-emerald-600'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-extrabold mb-1 px-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {isBn ? 'ইমেইল ঠিকানা *' : 'Email Address *'}
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (existingAccountConflict === 'email') {
                        setExistingAccountConflict(null);
                        setError('');
                      }
                    }}
                    placeholder="example@gmail.com"
                    className={`w-full px-5 py-3 border-2 rounded-full text-xs sm:text-sm font-bold focus:outline-none shadow-2xs transition-colors ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500'
                        : 'bg-white border-slate-200 text-slate-950 placeholder-slate-400 focus:border-emerald-600'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-extrabold mb-1 px-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {isBn ? 'মোবাইল নম্বর *' : 'Mobile Number *'}
                  </label>
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => {
                      setRegPhone(convertBengaliToEnglishDigits(e.target.value).replace(/\D/g, ''));
                      if (existingAccountConflict === 'phone') {
                        setExistingAccountConflict(null);
                        setError('');
                      }
                    }}
                    placeholder="01712345678"
                    className={`w-full px-5 py-3 border-2 rounded-full text-xs sm:text-sm font-mono font-bold focus:outline-none shadow-2xs transition-colors ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500'
                        : 'bg-white border-slate-200 text-slate-950 placeholder-slate-400 focus:border-emerald-600'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={`block text-xs font-extrabold mb-1 px-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {isBn ? 'পাসওয়ার্ড *' : 'Password *'}
                    </label>
                    <input
                      type="password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full px-5 py-3 border-2 rounded-full text-xs font-mono font-bold focus:outline-none shadow-2xs transition-colors ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500'
                          : 'bg-white border-slate-200 text-slate-950 placeholder-slate-400 focus:border-emerald-600'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-extrabold mb-1 px-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {isBn ? '4 ডিজিট পিন *' : '4-Digit PIN *'}
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      required
                      minLength={4}
                      maxLength={4}
                      pattern="\d{4}"
                      value={regPin}
                      onChange={(e) => setRegPin(convertBengaliToEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 4))}
                      placeholder="••••"
                      className={`w-full px-5 py-3 border-2 rounded-full text-xs font-mono font-bold focus:outline-none shadow-2xs text-center transition-colors ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500'
                          : 'bg-white border-slate-200 text-slate-950 placeholder-slate-400 focus:border-emerald-600'
                      }`}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#0B532C] hover:bg-[#084223] active:bg-[#06331B] text-white font-black py-3.5 sm:py-4 px-6 rounded-full text-sm sm:text-base shadow-md flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-98 mt-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>{isBn ? 'নিবন্ধন সম্পন্ন করুন' : 'Complete Registration'}</span>
                      <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                    </>
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 3. BOTTOM DECORATIVE ORGANIC WAVES */}
      <div className="relative w-full overflow-hidden leading-none z-10 pointer-events-none mt-auto">
        <svg
          className="relative block w-full h-16 sm:h-24"
          viewBox="0 0 1200 200"
          preserveAspectRatio="none"
        >
          <path
            d="M0,130 C200,60 450,180 700,90 C950,20 1100,100 1200,80 L1200,200 L0,200 Z"
            fill={isDark ? '#064e3b' : '#E8F8F0'}
            opacity={isDark ? '0.25' : '0.9'}
          />
          <path
            d="M0,160 C300,100 550,195 800,135 C1050,75 1150,140 1200,120 L1200,200 L0,200 Z"
            fill={isDark ? '#047857' : '#D5F2E3'}
            opacity={isDark ? '0.2' : '0.75'}
          />
        </svg>
      </div>
    </div>
  );
}
