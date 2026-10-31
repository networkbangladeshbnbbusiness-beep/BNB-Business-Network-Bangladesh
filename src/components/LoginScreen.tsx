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
  const [debugInfo, setDebugInfo] = useState<{ url: string; status: number; errorCode: string; rawSnippet?: string } | null>(null);
  const [healthStatus, setHealthStatus] = useState<{ build?: string; adminSdk?: boolean } | null>(null);

  useEffect(() => {
    fetch(apiUrl('/api/health'))
      .then(r => r.json())
      .then(d => setHealthStatus(d))
      .catch(() => {});
  }, []);

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

  const handleToggleLanguage = () => {
    const nextLang: 'bn' | 'en' = isBn ? 'en' : 'bn';
    setCurrentLang(nextLang);
    setError('');
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

  // Fast, non-blocking background lookup helper (races server API and indexed Firestore query simultaneously)
  const fetchUserFast = async (rawInput: string, silent = false): Promise<User | null> => {
    const trimmedInput = rawInput.trim();
    if (!trimmedInput || !trimmedInput.includes('@')) return null;
    const cleanInput = trimmedInput.toLowerCase();

    // 1. Instant 0ms memory cache hit
    const memCached = prefetchedUsersRef.current.get(cleanInput);
    if (memCached) return memCached;

    // 2. Instant 0ms localStorage cache hit
    if (typeof window !== 'undefined') {
      try {
        const fastRaw = localStorage.getItem(`amb_fast_email_${cleanInput}`);
        if (fastRaw) {
          const parsed = JSON.parse(fastRaw);
          if (parsed && parsed.uid) {
            prefetchedUsersRef.current.set(cleanInput, parsed);
            return parsed;
          }
        }
        const lastUserRaw = localStorage.getItem('amb_last_user');
        if (lastUserRaw) {
          const cached = JSON.parse(lastUserRaw);
          if (cached.email && cached.email.toLowerCase().trim() === cleanInput) {
            prefetchedUsersRef.current.set(cleanInput, cached);
            return cached;
          }
        }
      } catch (e) {}
    }

    // Reuse inflight promise if already pre-fetching while user was typing
    const existingPromise = inflightLookupRef.current.get(cleanInput);
    if (existingPromise) return existingPromise;

    const lookupPromise = (async (): Promise<User | null> => {
      const requestUrl = apiUrl('/api/auth/locate-user');

      const serverTask = (async (): Promise<User | null> => {
        try {
          const res = await fetch(requestUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: cleanInput })
          });
          const status = res.status;
          const contentType = res.headers.get('content-type') || '';
          let data: any = {};
          if (contentType.includes('application/json')) {
            data = await res.json().catch(() => ({}));
          }
          if (res.ok && data.found && data.user) {
            if (!silent) setDebugInfo({ url: requestUrl, status, errorCode: '200_FOUND' });
            return data.user as User;
          }
        } catch (e) {}
        return null;
      })();

      const clientTask = (async (): Promise<User | null> => {
        if (!db) return null;
        try {
          const queriesToTry = [
            query(collection(db, 'users'), where('email', '==', cleanInput), limit(1)),
            ...(cleanInput !== trimmedInput ? [query(collection(db, 'users'), where('email', '==', trimmedInput), limit(1))] : []),
            query(collection(db, 'users'), where('phone', '==', cleanInput), limit(1))
          ];
          const results = await Promise.all(queriesToTry.map(q => getDocs(q).catch(() => null)));
          for (const snap of results) {
            if (snap && !snap.empty) {
              const docSnap = snap.docs[0];
              return { uid: docSnap.id, ...(docSnap.data() as any) } as User;
            }
          }
        } catch (e) {}
        return null;
      })();

      // Race server and client so whichever resolves first wins immediately
      const firstHit = await Promise.race([
        serverTask.then(u => u ? u : clientTask),
        clientTask.then(u => u ? u : serverTask)
      ]);

      if (firstHit) {
        cacheLocatedUser(cleanInput, firstHit);
        return firstHit;
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
    const candidate = email.trim().toLowerCase();
    if (
      !isRegistering &&
      step === 'info' &&
      candidate.length >= 6 &&
      candidate.includes('@') &&
      candidate.includes('.') &&
      !candidate.toUpperCase().includes('BNB')
    ) {
      const timer = setTimeout(() => {
        fetchUserFast(candidate, true).catch(() => {});
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [email, isRegistering, step]);

  // Helper to locate user via server-side endpoint with automatic client-side Firestore fallback
  const locateUser = async (rawInput: string): Promise<User | null> => {
    const trimmedInput = rawInput.trim();
    if (!trimmedInput) return null;

    // Strict Rule: BNB member codes or non-email queries are directly forbidden
    if (trimmedInput.toUpperCase().includes('BNB') || (!trimmedInput.includes('@') && /^\d+$/.test(trimmedInput))) {
      setError(
        isBn
          ? 'BNB কোড বা অ্যাকাউন্ট নম্বর দিয়ে একাউন্ট খোলা বা লগইন করা সম্পূর্ণ নিষিদ্ধ! একাউন্ট খোলা এবং লগইন শুধুমাত্র আপনার নিবন্ধিত বৈধ ইমেইলের মাধ্যমে করতে হবে।'
          : 'Opening an account or logging in with a BNB code or account number is strictly prohibited! Registration and login must be done using your registered valid email only.'
      );
      return null;
    }

    if (!trimmedInput.includes('@')) {
      setError(
        isBn
          ? 'অনুগ্রহ করে আপনার সঠিক নিবন্ধিত ইমেইল অ্যাড্রেস প্রদান করুন (যেমন: example@gmail.com)।'
          : 'Please enter your valid registered email address (e.g. example@gmail.com).'
      );
      return null;
    }

    return await fetchUserFast(trimmedInput, false);
  };

  // Handle Send OTP for Login (Strictly Email-Only OTP Verification - Instant 0ms UI Transition)
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    const rawInput = email.trim();
    if (!rawInput) {
      setError(
        isBn
          ? 'অনুগ্রহ করে আপনার নিবন্ধিত ইমেইল অ্যাড্রেস প্রদান করুন।'
          : 'Please enter your registered email address.'
      );
      return;
    }

    // Strict Rule: BNB member codes or numeric IDs are forbidden
    if (rawInput.toUpperCase().includes('BNB') || (!rawInput.includes('@') && /^\d+$/.test(rawInput))) {
      setError(
        isBn
          ? 'BNB কোড বা অ্যাকাউন্ট নম্বর দিয়ে অ্যাকাউন্ট খোলা বা লগইন করা সম্পূর্ণ নিষিদ্ধ! অ্যাকাউন্ট খোলা এবং লগইন শুধুমাত্র আপনার নিবন্ধিত বৈধ ইমেইল অ্যাড্রেসের মাধ্যমে করতে হবে।'
          : 'Opening an account or logging in with a BNB code or account number is strictly prohibited! Registration and login must be done using your registered valid email address only.'
      );
      return;
    }

    if (!rawInput.includes('@') || !rawInput.includes('.')) {
      setError(
        isBn
          ? 'অনুগ্রহ করে আপনার সঠিক নিবন্ধিত ইমেইল অ্যাড্রেস প্রদান করুন (যেমন: example@gmail.com)।'
          : 'Please enter your valid registered email address (e.g. example@gmail.com).'
      );
      return;
    }

    setLoading(true);

    try {
      const targetUser = await locateUser(rawInput);
      if (!targetUser) {
        setError(
          isBn
            ? 'প্রদত্ত ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি। সঠিক নিবন্ধিত ইমেইল অ্যাড্রেস দিয়ে পুনরায় চেষ্টা করুন।'
            : 'No account found with this email. Please try again with your registered email address.'
        );
        return;
      }

      setFoundUser(targetUser);

      const userDisplayName = targetUser.name || (isBn ? 'সম্মানিত সদস্য' : 'Respected Member');
      const userPhone = targetUser.phone || '';
      const userEmail = targetUser.email ? targetUser.email.trim().toLowerCase() : (targetUser.phone && targetUser.phone.includes('@') ? targetUser.phone.trim().toLowerCase() : '');

      // Strict security: User must have a registered email in database to login with real-time OTP
      if (!userEmail || !userEmail.includes('@')) {
        setError(
          isBn
            ? 'এই অ্যাকাউন্টের সাথে কোনো বৈধ ইমেইল যুক্ত নেই। সুরক্ষার স্বার্থে শুধুমাত্র নিবন্ধিত ইমেইলের মাধ্যমেই রিয়েল-টাইম ওটিপি ভেরিফিকেশন করে লগইন করা সম্ভব।'
            : 'No valid email is linked to this account. For security reasons, login is only possible via real-time OTP verification sent to a registered email.'
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

      // 1. Generate authoritative 6-digit OTP immediately in 0ms
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setSentOtpCode(generatedOtp);
      setFoundUser(targetUser);

      // Persist across app switching (e.g. when checking Gmail app)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('bnb_pending_otp_code', generatedOtp);
        sessionStorage.setItem('bnb_pending_otp_user', JSON.stringify(targetUser));
        localStorage.setItem('bnb_pending_otp_code', generatedOtp);
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

      // 2. Update UI state & switch to OTP input screen INSTANTLY (0ms wait — never blocked by SMTP network latency)
      setDeliveryInfo({
        deliveredTo: displayEmail,
        channel: 'email',
        targetPhone: formattedPhone,
        targetEmail: targetEmail
      });

      setSuccessMessage(
        isBn
          ? `আপনার নিবন্ধিত ইমেইলে (${displayEmail}) ৬ সংখ্যার অফিসিয়াল ভেরিফিকেশন ওটিপি কোড পাঠানো হয়েছে। অনুগ্রহ করে আপনার ইনবক্স চেক করুন।`
          : `A 6-digit official verification OTP code has been sent to your registered email (${displayEmail}). Please check your inbox.`
      );

      setStep('verify-otp');

      // 3. Dispatch multi-channel authoritative OTP in background immediately without blocking the UI
      sendEmailOtpDirect({
        email: targetEmail,
        otp: generatedOtp,
        userName: userDisplayName,
        phone: formattedPhone || userPhone,
        memberId: targetUser.memberId || rawInput,
        userId: targetUser.uid,
        reason: 'login'
      }).catch((otpErr) => {
        console.warn('Background OTP dispatch warning:', otpErr);
      });
    } catch (err: any) {
      console.error('Login error:', err);
      setError(
        err?.message ||
          (isBn
            ? 'লগইন প্রসেসে ত্রুটি হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।'
            : 'An error occurred during login. Please try again.')
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
        console.warn('Storage save warning:', storeErr);
      }
    }

    // 2. Set explicit success feedback
    setSuccessMessage(
      isBn
        ? '✅ ওটিপি ভেরিফিকেশন সফল হয়েছে! অনুগ্রহ করে আপনার সিকিউরিটি পিন দিন...'
        : '✅ OTP verification successful! Please enter your security PIN...'
    );
    setError('');

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

    // 5. Non-blocking client firestore update if available (never awaited)
    if (db && userToLogin.uid) {
      updateDoc(doc(db, 'users', userToLogin.uid), {
        activeSessionToken: newSessionToken,
        activeSessionDeviceId: deviceId,
        lastLoginAt: new Date().toISOString(),
        isLoggedIn: true
      }).catch(() => {});
    }
  };

  // Verify OTP (Dual check: Local session OTP, persistent storage OTP, or server-side /api/verify-otp)
  const handleVerifyOtp = async (e?: React.FormEvent, directCode?: string) => {
    if (e) e.preventDefault();
    const code = (directCode || otpInput).trim();
    if (!code) {
      setError(
        isBn
          ? 'অনুগ্রহ করে আপনার ইমেইলে আসা ৬ সংখ্যার ওটিপি কোডটি লিখুন।'
          : 'Please enter the 6-digit OTP code sent to your email.'
      );
      return;
    }

    if (code.length !== 6) {
      setError(
        isBn
          ? 'ওটিপি কোড অবশ্যই ৬ সংখ্যার হতে হবে।'
          : 'The OTP code must be 6 digits.'
      );
      return;
    }

    setLoading(true);
    setError('');

    try {
      let isVerified = false;

      // 1. Primary check against local state / persisted storage OTP code
      const effectiveSentCode = sentOtpCode || (typeof window !== 'undefined' ? (sessionStorage.getItem('bnb_pending_otp_code') || localStorage.getItem('bnb_pending_otp_code') || '') : '');
      
      let effectiveUser = foundUser;
      if (!effectiveUser && typeof window !== 'undefined') {
        try {
          const raw = sessionStorage.getItem('bnb_pending_otp_user') || localStorage.getItem('bnb_pending_otp_user');
          if (raw) effectiveUser = JSON.parse(raw);
        } catch (e) {}
      }

      if (effectiveSentCode && code === effectiveSentCode) {
        isVerified = true;
      }

      // 2. Server-side verification fallback via /api/verify-otp
      if (!isVerified && (effectiveUser?.email || email)) {
        try {
          const verifyRes = await fetch(apiUrl('/api/verify-otp'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: (effectiveUser?.email || email).trim().toLowerCase(),
              otp: code
            })
          });
          const verifyData = await verifyRes.json().catch(() => null);
          if (verifyData?.verified) {
            isVerified = true;
          }
        } catch (serverVerifyErr) {
          console.warn('Server verify-otp error:', serverVerifyErr);
        }
      }

      if (isVerified) {
        if (!effectiveUser) {
          effectiveUser = await locateUser(email.trim());
        }

        if (effectiveUser) {
          setSuccessMessage(
            isBn
              ? '✅ ওটিপি যাচাই সফল হয়েছে! স্বাগতম...'
              : '✅ OTP verified successfully! Welcome...'
          );
          executeLogin(effectiveUser);
        } else {
          setError(
            isBn
              ? 'ইউজার সেশন পাওয়া যায়নি। অনুগ্রহ করে পুনরায় আপনার নিবন্ধিত ইমেইল দিয়ে চেষ্টা করুন।'
              : 'User session not found. Please try again with your registered email.'
          );
        }
      } else {
        setError(
          isBn
            ? 'প্রদত্ত ওটিপি কোডটি সঠিক নয়। অনুগ্রহ করে আপনার ইমেইল ইনবক্সে আসা ৬ সংখ্যার সঠিক কোডটি দিন।'
            : 'Invalid OTP code. Please enter the correct 6-digit code sent to your email inbox.'
        );
      }
    } catch (verifyErr: any) {
      console.error('OTP Verification Error:', verifyErr);
      setError(
        verifyErr?.message ||
          (isBn ? 'ওটিপি যাচাইয়ে ত্রুটি হয়েছে।' : 'Failed to verify OTP.')
      );
    } finally {
      setLoading(false);
    }
  };

  // Registration handler
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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
    if (cleanRegEmail.toUpperCase().includes('BNB')) {
      setError(
        isBn
          ? 'BNB কোড দিয়ে একাউন্ট খোলা সম্পূর্ণ নিষিদ্ধ! শুধুমাত্র আপনার ব্যক্তিগত বৈধ ইমেইল অ্যাড্রেস দিয়ে একাউন্ট খুলুন।'
          : 'Opening an account with a BNB code is strictly prohibited! Please register using your personal valid email address only.'
      );
      return;
    }

    if (!cleanRegEmail.includes('@') || !cleanRegEmail.includes('.')) {
      setError(
        isBn
          ? 'অনুগ্রহ করে একটি সঠিক ও সক্রিয় ইমেইল অ্যাড্রেস প্রদান করুন (যেমন: example@gmail.com)। একাউন্ট খোলা শুধুমাত্র ইমেইলের মাধ্যমেই সম্ভব।'
          : 'Please provide a valid and active email address (e.g. example@gmail.com). Account registration is only possible via email.'
      );
      return;
    }

    if (regPin.trim().length !== 4) {
      setError(
        isBn
          ? 'সিকিউরিটি পিন অবশ্যই ৪ সংখ্যার হতে হবে।'
          : 'Security PIN must be exactly 4 digits.'
      );
      return;
    }

    setLoading(true);

    try {
      const cleanPhoneDigits = convertBengaliToEnglishDigits(regPhone).replace(/\D/g, '');
      const standardPhone = cleanPhoneDigits.length === 11 && cleanPhoneDigits.startsWith('0') ? `+88${cleanPhoneDigits}` : cleanPhoneDigits;
      const cleanEmail = email.trim().toLowerCase();

      let createdUser: User | null = null;
      let specificError = '';

      // 1. First attempt fast authoritative server-side registration via Firebase Admin SDK
      try {
        const res = await fetch(apiUrl('/api/auth/register'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: regName.trim(),
            email: cleanEmail,
            phone: standardPhone,
            password: regPassword.trim(),
            pin: regPin.trim()
          })
        });

        const data = await res.json().catch(() => null);
        if (data?.success && data.user) {
          createdUser = data.user;
        } else if (data?.error && !data.error.includes('route not found') && !data.error.includes('Not Found') && data.code !== 'route_not_found') {
          specificError = data.error;
        }
      } catch (serverErr) {
        console.warn('Server registration route note:', serverErr);
      }

      if (specificError) {
        setError(specificError);
        setLoading(false);
        return;
      }

      // 2. Direct client-side Firestore fallback (guarantees registration never fails if server route is not reached)
      if (!createdUser && db) {
        try {
          // Check duplicate email
          const qEmail = query(collection(db, 'users'), where('email', '==', cleanEmail), limit(1));
          const snapEmail = await getDocs(qEmail).catch(() => null);
          if (snapEmail && !snapEmail.empty) {
            setError(
              isBn
                ? 'এই ইমেইল ঠিকানা দিয়ে ইতিপূর্বে একটি অ্যাকাউন্ট খোলা হয়েছে। অনুগ্রহ করে লগইন করুন।'
                : 'An account is already registered with this email address. Please log in.'
            );
            setLoading(false);
            return;
          }

          // Check duplicate phone
          const qPhone = query(collection(db, 'users'), where('phone', '==', standardPhone), limit(1));
          const snapPhone = await getDocs(qPhone).catch(() => null);
          if (snapPhone && !snapPhone.empty) {
            setError(
              isBn
                ? 'এই মোবাইল নম্বর দিয়ে ইতিপূর্বে একটি অ্যাকাউন্ট খোলা হয়েছে। অনুগ্রহ করে লগইন করুন।'
                : 'An account is already registered with this mobile number. Please log in.'
            );
            setLoading(false);
            return;
          }

          const fallbackSerial = Math.floor(10000000 + Math.random() * 90000000);
          const newMemberId = `BNB${fallbackSerial}`;
          const newUid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

          const newUserObj: User = {
            uid: newUid,
            name: regName.trim(),
            email: cleanEmail,
            phone: standardPhone,
            memberId: newMemberId,
            role: 'user',
            balance: 0,
            mainBalance: 0,
            savings: 0,
            telecomBalance: 0,
            superShopBalance: 0,
            dueLoan: 0,
            password: regPassword.trim(),
            pin: regPin.trim(),
            appLockCode: regPin.trim(),
            pinSet: true,
            status: 'active',
            samityStatus: 'none',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          await setDoc(doc(db, 'users', newUid), newUserObj);
          createdUser = newUserObj;
        } catch (clientRegErr: any) {
          console.error('Client registration fallback error:', clientRegErr);
        }
      }

      if (!createdUser) {
        setError(
          isBn
            ? 'অ্যাকাউন্ট তৈরিতে সাময়িক সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।'
            : 'Temporary issue creating account. Please try again.'
        );
        setLoading(false);
        return;
      }

      saveUserToLocalBackup(createdUser);
      setSuccessMessage(
        isBn
          ? '✅ আপনার অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে! স্বাগতম...'
          : '✅ Your account has been created successfully! Welcome...'
      );
      executeLogin(createdUser);
    } catch (err: any) {
      console.error(err);
      setError(
        isBn
          ? `অ্যাকাউন্ট তৈরিতে সমস্যা হয়েছে: ${err?.message || ''}`
          : `Error creating account: ${err?.message || ''}`
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
        } text-white pt-3 sm:pt-4 pb-12 sm:pb-16 px-4 overflow-hidden shadow-lg transition-colors duration-200`}
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
            <div className="space-y-1.5">
              <div
                className={`text-xs p-3.5 rounded-2xl font-bold flex items-start gap-2 shadow-xs animate-fade-in border ${
                  isDark
                    ? 'bg-rose-950/60 border-rose-800/80 text-rose-200'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${isDark ? 'text-rose-400' : 'text-rose-600'}`} />
                <span>{error}</span>
              </div>
              {debugInfo && (
                <div className="px-2.5 py-1 bg-slate-900/90 text-emerald-400 font-mono text-[10px] rounded-lg break-all border border-slate-700 select-all">
                  API: {debugInfo.url} | Status: {debugInfo.status} ({debugInfo.errorCode})
                </div>
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
                      autoFocus
                      required
                      maxLength={6}
                      value={otpInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
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
                      {isBn ? 'পুনরায় পাঠান (Resend)' : 'Resend OTP'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStep('info');
                        setOtpInput('');
                        setError('');
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
                      {isBn ? 'আপনার নিবন্ধিত ইমেইল অ্যাড্রেস' : 'Your Registered Email Address'}
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
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={isBn ? 'আপনার ইমেইল দিন (যেমন: name@gmail.com)' : 'Enter your email (e.g. name@gmail.com)'}
                      className={`w-full pl-13 pr-5 py-3.5 sm:py-4 border-2 rounded-full text-xs sm:text-sm font-bold focus:outline-none focus:ring-4 focus:ring-emerald-500/15 shadow-2xs transition-all ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500'
                          : 'bg-white border-slate-200/90 text-slate-950 placeholder-slate-400 focus:border-emerald-600'
                      }`}
                    />
                  </div>
                  <p
                    className={`text-[11px] rounded-xl px-3 py-1.5 mt-2 font-medium border ${
                      isDark
                        ? 'text-amber-300 bg-amber-950/50 border-amber-800/60'
                        : 'text-amber-700 bg-amber-50/70 border-amber-200/60'
                    }`}
                  >
                    {isBn
                      ? '⚠️ BNB কোড বা অ্যাকাউন্ট নম্বর দিয়ে লগইন সম্পূর্ণ নিষিদ্ধ। একাউন্ট খোলা এবং লগইন শুধুমাত্র ইমেইলের মাধ্যমে করতে হবে।'
                      : '⚠️ Logging in with a BNB code or account number is strictly prohibited. Registration and login must be done via email only.'}
                  </p>
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
                      <span>{isBn ? 'OTP কোড পাঠান (Send OTP)' : 'Send OTP Code'}</span>
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
                    {isBn ? 'ইমেইল ঠিকানা (Email) *' : 'Email Address *'}
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                    onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, ''))}
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
                      {isBn ? '৪ ডিজিট পিন *' : '4-Digit PIN *'}
                    </label>
                    <input
                      type="password"
                      required
                      maxLength={4}
                      value={regPin}
                      onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ''))}
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
