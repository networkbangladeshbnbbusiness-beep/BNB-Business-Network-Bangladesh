import React, { useState, useEffect } from 'react';
import { User, AppConfig } from '../types';
import { maskSecretPhone, convertBengaliToEnglishDigits, verifyUserPin, findUserInFirestoreByPhone, verifyPinUniversal, hashPinClientAsync } from '../lib/memberUtils';
import { sendEmailOtpDirect, verifyEmailOtpUniversal } from '../lib/emailOtpService';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { KeyRound, LogOut, ArrowRight, ShieldAlert, Check, X, Search, Lock, ShieldCheck, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BNBLogo } from './BNBLogo';
import { getLockoutState, recordFailedAttempt, clearLockoutState, LockoutState } from '../lib/lockoutUtils';
import LockoutScreen from './LockoutScreen';
import { apiUrl } from '../config/api';

// Comprehensive global country list with flags & dialed codes
const countries = [
  { name: 'বাংলাদেশ (Bangladesh)', code: '+880', flag: '🇧🇩', placeholder: '01712345678', minLength: 10, maxLength: 11 },
  { name: 'সৌদি আরব (Saudi Arabia)', code: '+966', flag: '🇸🇦', placeholder: '512345678', minLength: 8, maxLength: 9 },
  { name: 'মালয়েশিয়া (Malaysia)', code: '+60', flag: '🇲🇾', placeholder: '123456789', minLength: 9, maxLength: 10 },
  { name: 'সংযুক্ত আরব আমিরাত (UAE)', code: '+971', flag: '🇦🇪', placeholder: '501234567', minLength: 9, maxLength: 9 },
  { name: 'ওমান (Oman)', code: '+968', flag: '🇴🇲', placeholder: '91234567', minLength: 8, maxLength: 8 },
  { name: 'কাতার (Qatar)', code: '+974', flag: '🇶🇦', placeholder: '55123456', minLength: 8, maxLength: 8 },
  { name: 'কুয়েত (Kuwait)', code: '+965', flag: '🇰🇼', placeholder: '51234567', minLength: 8, maxLength: 8 },
  { name: 'বাহরাইন (Bahrain)', code: '+973', flag: '🇧🇭', placeholder: '31234567', minLength: 8, maxLength: 8 },
  { name: 'সিঙ্গাপুর (Singapore)', code: '+65', flag: '🇸🇬', placeholder: '81234567', minLength: 8, maxLength: 8 },
  { name: 'ভারত (India)', code: '+91', flag: '🇮🇳', placeholder: '9876543210', minLength: 10, maxLength: 10 },
  { name: 'যুক্তরাজ্য (UK)', code: '+44', flag: '🇬🇧', placeholder: '7123456789', minLength: 10, maxLength: 10 },
  { name: 'মার্কিন যুক্তরাষ্ট্র (USA)', code: '+1', flag: '🇺🇸', placeholder: '2015550123', minLength: 10, maxLength: 10 },
  { name: 'ইতালি (Italy)', code: '+39', flag: '🇮🇹', placeholder: '3123456789', minLength: 9, maxLength: 10 },
  { name: 'কানাডা (Canada)', code: '+1', flag: '🇨🇦', placeholder: '2015550123', minLength: 10, maxLength: 10 },
  { name: 'দক্ষিণ কোরিয়া (South Korea)', code: '+82', flag: '🇰🇷', placeholder: '1012345678', minLength: 9, maxLength: 10 },
  { name: 'জাপান (Japan)', code: '+81', flag: '🇯🇵', placeholder: '8012345678', minLength: 9, maxLength: 10 },
  { name: 'অস্ট্রেলিয়া (Australia)', code: '+61', flag: '🇦🇺', placeholder: '412345678', minLength: 9, maxLength: 9 },
  { name: 'মালদ্বীপ (Maldives)', code: '+960', flag: '🇲🇻', placeholder: '7123456', minLength: 7, maxLength: 7 },
  { name: 'پاکستان (Pakistan)', code: '+92', flag: '🇵🇰', placeholder: '3001234567', minLength: 10, maxLength: 10 },
  { name: 'নেপাল (Nepal)', code: '+977', flag: '🇳🇵', placeholder: '9801234567', minLength: 10, maxLength: 10 },
  { name: 'লেবানন (Lebanon)', code: '+961', flag: '🇱🇧', placeholder: '71234567', minLength: 8, maxLength: 8 },
  { name: 'জর্ডান (Jordan)', code: '+962', flag: '🇯🇴', placeholder: '791234567', minLength: 9, maxLength: 9 },
  { name: 'ইরাক (Iraq)', code: '+964', flag: '🇮🇶', placeholder: '7701234567', minLength: 10, maxLength: 10 },
  { name: 'মিশর (Egypt)', code: '+20', flag: '🇪🇬', placeholder: '1012345678', minLength: 10, maxLength: 10 },
  { name: 'অন্যান্য (Others)', code: '+', flag: '🌐', placeholder: '1234567890', minLength: 5, maxLength: 15 }
];

// Formatting helper
const getFormattedPhone = (phone: string, country: typeof countries[0]): string => {
  let formattedNumber = phone.replace(/\D/g, '');
  if (country.code === '+880') {
    if (formattedNumber.startsWith('880')) {
      formattedNumber = formattedNumber.slice(3);
    } else if (formattedNumber.startsWith('+880')) {
      formattedNumber = formattedNumber.slice(4);
    }
    if (!formattedNumber.startsWith('0')) {
      formattedNumber = '0' + formattedNumber;
    }
  } else if (country.code === '+') {
    formattedNumber = '+' + formattedNumber;
  } else {
    if (formattedNumber.startsWith('0')) {
      formattedNumber = formattedNumber.replace(/^0+/, '');
    }
    formattedNumber = country.code + formattedNumber;
  }
  return formattedNumber;
};

// Validation Helper
const validatePhoneNumber = (phone: string, country: typeof countries[0]): string | null => {
  if (!phone) {
    return 'অনুগ্রহ করে মোবাইল নাম্বার প্রদান করুন।';
  }
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length === 0) {
    return 'মোবাইল নাম্বারে অবশ্যই সংখ্যা থাকতে হবে।';
  }
  
  if (country.code === '+880') {
    if (digitsOnly.length === 11 && !digitsOnly.startsWith('01')) {
      return '11 ডিজিটের বাংলাদেশি নাম্বার অবশ্যই 01 দিয়ে শুরু হতে হবে।';
    }
    if (digitsOnly.length !== 10 && digitsOnly.length !== 11) {
      return 'সদস্যের সঠিক 10 বা 11 ডিজিটের বাংলাদেশি মোবাইল নাম্বার দিন।';
    }
  } else {
    if (digitsOnly.length < (country.minLength || 6) || digitsOnly.length > (country.maxLength || 15)) {
      return `সদস্যের সঠিক দৈর্ঘ্যের মোবাইল নাম্বার দিন (${country.flag} ${country.name} এর জন্য ${(country.minLength || 6)}-${(country.maxLength || 15)} ডিজিট)।`;
    }
  }
  return null;
};

interface LockScreenProps {
  user: User;
  onUnlock: () => void;
  onLogout: () => void;
  isLogoutMode?: boolean;
  onCancelLogout?: () => void;
  appConfig?: AppConfig;
  appLanguage?: string;
  onLanguageChange?: (lang: string) => void;
  darkMode?: boolean;
}

export default function LockScreen({ 
  user, 
  onUnlock, 
  onLogout, 
  isLogoutMode = false,
  onCancelLogout,
  appConfig,
  appLanguage = 'bn',
  onLanguageChange,
  darkMode = false
}: LockScreenProps) {
  const isBn = appLanguage !== 'en';
  const userIdentifier = user?.phone || user?.uid || '';
  const [lockoutInfo, setLockoutInfo] = useState<LockoutState>(() => getLockoutState(userIdentifier));

  const localizeLockError = (raw: string | undefined, fallbackBn: string, fallbackEn: string): string => {
    if (!raw) return isBn ? fallbackBn : fallbackEn;
    let msg = raw.trim();
    const lower = msg.toLowerCase();
    if (
      lower.includes('api route not found') ||
      lower.includes('route_not_found') ||
      lower.includes('cannot post') ||
      lower.includes('failed to fetch') ||
      lower.includes('networkerror')
    ) {
      return isBn ? fallbackBn : fallbackEn;
    }
    if (isBn) {
      msg = msg.replace(/\s*\(no account,\s*please sign up\)/gi, '');
      msg = msg.replace(/no account,\s*please sign up/gi, 'কোনো অ্যাকাউন্ট পাওয়া যায়নি, অনুগ্রহ করে নিবন্ধন করুন।');
      msg = msg.replace(/৪ ডিজিট/g, '4 ডিজিট');
      if (/^[A-Za-z0-9\s.,!?:;'"()\-_/]+$/.test(msg)) {
        return fallbackBn;
      }
      return msg;
    } else {
      if (/ভুল পিন|সঠিক ৪|সঠিক 4/.test(msg)) {
        return 'Incorrect PIN! Please enter your 4-digit PIN or reset it below.';
      }
      if (/লক করা/.test(msg)) {
        return 'Too many incorrect PIN attempts! Your account is temporarily locked for 15 minutes.';
      }
      if (/ওটিপি/.test(msg)) {
        return fallbackEn;
      }
      if (/[\u0980-\u09FF]/.test(msg)) {
        return fallbackEn;
      }
      return msg;
    }
  };

  useEffect(() => {
    const status = getLockoutState(userIdentifier);
    setLockoutInfo(status);
  }, [userIdentifier]);

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Secret App Lock (2nd step lock) states
  const [secretCodeInput, setSecretCodeInput] = useState('');
  const [showSecretCode, setShowSecretCode] = useState(false);

  // Forgot PIN state fields
  const [showForgotPinModal, setShowForgotPinModal] = useState(false);
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotMemberId, setForgotMemberId] = useState('');
  const [newResetPin, setNewResetPin] = useState('');
  const [newResetPinConfirm, setNewResetPinConfirm] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [hasActiveUnlockRequest, setHasActiveUnlockRequest] = useState(false);

  // International recovery setup states
  const [forgotCountry, setForgotCountry] = useState(countries[0]);
  const [showForgotCountryDropdown, setShowForgotCountryDropdown] = useState(false);
  const [forgotCountrySearch, setForgotCountrySearch] = useState('');

  const [resetOtpSent, setResetOtpSent] = useState(false);
  const [resetOtpCode, setResetOtpCode] = useState('');

  // Automatically trigger mandatory Email-OTP PIN reset modal if user has forcePinResetOnNextLogin === true
  useEffect(() => {
    if ((user as any)?.forcePinResetOnNextLogin) {
      setShowForgotPinModal(true);
      setResetError(
        isBn
          ? 'নিরাপত্তা আপডেটের কারণে আপনার অ্যাকাউন্টে প্রবেশের পূর্বে ইমেইল ওটিপি ভেরিফিকেশনের মাধ্যমে নতুন 4 ডিজিট পিন সেট করা বাধ্যতামূলক।'
          : 'For security reasons, you must set a new 4-digit PIN via email OTP verification before accessing your account.'
      );
    }
  }, [user, isBn]);

  const resolveUserEmailForReset = async (): Promise<string> => {
    if (user?.email && user.email.includes('@')) {
      return user.email.trim().toLowerCase();
    }
    if (user?.uid) {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists() && snap.data()?.email) {
          return String(snap.data().email).trim().toLowerCase();
        }
      } catch (e) {}
    }
    return '';
  };

  const handleRequestPinResetOtp = async () => {
    setResetError('');
    setResetMessage('');
    if (!user?.uid) {
      setResetError(isBn ? 'ইউজার আইডি পাওয়া যায়নি!' : 'User ID not found!');
      return;
    }
    setResetLoading(true);
    try {
      const targetEmail = await resolveUserEmailForReset();
      let sentSuccess = false;
      let displayEmail = targetEmail;

      try {
        const resp = await fetch(apiUrl('/api/auth/request-pin-reset-otp'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: user.uid, email: targetEmail || user.email || '' })
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.success) {
          sentSuccess = true;
          displayEmail = data.maskedEmail || targetEmail || user.email || '';
        }
      } catch (e) {}

      if (!sentSuccess && targetEmail) {
        const otpRes = await sendEmailOtpDirect({
          email: targetEmail,
          otp: '',
          userName: user.name || 'সম্মানিত সদস্য',
          phone: user.phone || '',
          memberId: user.memberId || '',
          userId: user.uid,
          reason: 'forgot_password'
        });
        if (otpRes.success) {
          sentSuccess = true;
          const parts = targetEmail.split('@');
          displayEmail = parts.length === 2 && parts[0].length > 2
            ? `${parts[0].slice(0, 2)}••••${parts[0].slice(-1)}@${parts[1]}`
            : targetEmail;
        } else {
          setResetError(
            localizeLockError(
              otpRes.error,
              'ইমেইলে ওটিপি পাঠানো যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
              'Failed to send OTP to email. Please try again.'
            )
          );
          return;
        }
      }

      if (!sentSuccess) {
        setResetError(
          isBn
            ? 'ইমেইলে ওটিপি পাঠানো যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।'
            : 'Failed to send OTP to email. Please try again.'
        );
      } else {
        setResetOtpSent(true);
        setResetMessage(
          isBn
            ? `আপনার নিবন্ধিত ইমেইলে (${displayEmail}) 6 সংখ্যার ভেরিফিকেশন কোড পাঠানো হয়েছে।`
            : `A 6-digit verification code has been sent to your registered email (${displayEmail}).`
        );
      }
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('Request PIN reset OTP error:', err);
      }
      setResetError(
        isBn
          ? 'সার্ভার সংযোগ সমস্যা। অনুগ্রহ করে আবার চেষ্টা করুন।'
          : 'Server connection error. Please try again.'
      );
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetMessage('');

    const cleanOtp = convertBengaliToEnglishDigits(resetOtpCode).trim();
    const cleanNewPin = convertBengaliToEnglishDigits(newResetPin).trim();
    const cleanConfirmPin = convertBengaliToEnglishDigits(newResetPinConfirm).trim();

    if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setResetError(isBn ? 'ইমেইলে পাঠানো 6 সংখ্যার সঠিক ওটিপি কোডটি দিন।' : 'Please enter the valid 6-digit OTP sent to your email.');
      return;
    }
    if (cleanNewPin.length !== 4 || !/^\d{4}$/.test(cleanNewPin)) {
      setResetError(isBn ? 'নতুন পিন অবশ্যই 4 ডিজিটের সংখ্যা হতে হবে।' : 'New PIN must be a 4-digit number.');
      return;
    }
    if (cleanNewPin !== cleanConfirmPin) {
      setResetError(isBn ? 'নতুন পিন এবং নিশ্চিত করা পিন দুটির মিল নেই!' : 'New PIN and confirm PIN do not match!');
      return;
    }

    setResetLoading(true);
    try {
      if (!user?.uid) {
        setResetError(isBn ? 'ইউজার আইডি পাওয়া যায়নি!' : 'User ID not found!');
        setResetLoading(false);
        return;
      }

      const targetEmail = await resolveUserEmailForReset();
      let resetConfirmed = false;
      let resetErrText = '';

      try {
        const resp = await fetch(apiUrl('/api/auth/confirm-pin-reset-otp'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: user.uid,
            email: targetEmail || user.email || '',
            otp: cleanOtp,
            newPin: cleanNewPin
          })
        });
        const data = await resp.json().catch(() => ({}));
        const isRouteNotFound =
          resp.status === 404 ||
          data?.code === 'route_not_found' ||
          String(data?.error || '').toLowerCase().includes('route not found');

        if (resp.ok && data.success) {
          resetConfirmed = true;
        } else if (!isRouteNotFound && resp.status < 500) {
          resetErrText = data?.error || '';
        }
      } catch (e) {}

      if (!resetConfirmed && !resetErrText && targetEmail) {
        const verifyData = await verifyEmailOtpUniversal(targetEmail, cleanOtp, 'pin_reset');
        if (verifyData.verified) {
          const pinHash = await hashPinClientAsync(cleanNewPin);
          await updateDoc(doc(db, 'users', user.uid), {
            pinHash,
            pin: cleanNewPin,
            appLockCode: cleanNewPin,
            pinSet: true,
            pinFailedAttempts: 0,
            pinLockedUntil: 0,
            forcePinResetOnNextLogin: false,
            updatedAt: new Date().toISOString()
          });
          try {
            sessionStorage.setItem('amb_verified_pin', cleanNewPin);
            localStorage.setItem('amb_user_pin', cleanNewPin);
          } catch (e) {}
          resetConfirmed = true;
        } else {
          resetErrText = verifyData.error || '';
        }
      }

      if (!resetConfirmed) {
        setResetError(
          localizeLockError(
            resetErrText,
            'পিন রিসেট ব্যর্থ হয়েছে। ওটিপি যাচাই করুন।',
            'PIN reset failed. Please verify the OTP.'
          )
        );
        setResetLoading(false);
        return;
      }

      clearLockoutState(userIdentifier);
      setResetMessage(isBn ? 'আপনার 4 ডিজিট পিন সফলভাবে পরিবর্তন করা হয়েছে!' : 'Your 4-digit PIN has been updated successfully!');
      setPin('');

      setTimeout(() => {
        setShowForgotPinModal(false);
        setResetOtpSent(false);
        setResetOtpCode('');
        setNewResetPin('');
        setNewResetPinConfirm('');
        setResetMessage('');
        onUnlock();
      }, 1200);
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error(err);
      }
      setResetError(isBn ? 'পিন পরিবর্তন ব্যর্থ হয়েছে। ইন্টারনেট সংযোগ চেক করে আবার চেষ্টা করুন।' : 'Failed to change PIN. Please check your connection and try again.');
    } finally {
      setResetLoading(false);
    }
  };

  // Real-time listener for user document to unlock ONLY when Admin approves active unlock request
  useEffect(() => {
    if (!user?.uid || !hasActiveUnlockRequest) return;
    const userRef = doc(db, 'users', user.uid);
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.appLockResetStatus === 'approved' && data.appLockResetRequested) {
          updateDoc(userRef, {
            appLockResetStatus: 'consumed',
            appLockResetRequested: false
          }).catch((e) => {
            if (import.meta.env.DEV) console.warn("Failed to consume unlock status:", e);
          });
          setHasActiveUnlockRequest(false);
          onUnlock();
        }
      }
    }, (err) => {
      if (import.meta.env.DEV) console.warn("LockScreen real-time user listener error:", err);
    });
    return () => unsub();
  }, [user?.uid, hasActiveUnlockRequest, onUnlock]);

  const handleSendAdminUnlockRequest = async () => {
    if (!user?.uid) return;
    setResetLoading(true);
    setResetError('');
    setResetMessage('');

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        appLockResetRequested: true,
        appLockResetRequestedAt: new Date().toISOString(),
        appLockResetStatus: 'pending'
      });

      const reqRef = doc(db, 'app_lock_requests', user.uid);
      await setDoc(reqRef, {
        userId: user.uid,
        userName: user.name || 'সদস্য',
        memberId: user.memberId || '',
        phone: user.phone || '',
        requestedAt: new Date().toISOString(),
        status: 'pending'
      }, { merge: true });

      setHasActiveUnlockRequest(true);
      setResetMessage(
        isBn
          ? 'আপনার আনলক রিকোয়েস্ট সফলভাবে এডমিনের কাছে পাঠানো হয়েছে! এডমিন যাচাই করে এপ্রুভ করার সাথে সাথে অ্যাপস আনলক হয়ে যাবে।'
          : 'Your unlock request has been sent to the Admin! Your app will unlock automatically once approved.'
      );
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error("Error sending admin unlock request:", err);
      }
      setResetError(
        isBn
          ? 'রিকোয়েস্ট পাঠাতে সমস্যা হয়েছে। ইন্টারনেট চেক করে আবার চেষ্টা করুন।'
          : 'Failed to send request. Please check your internet connection and try again.'
      );
    } finally {
      setResetLoading(false);
    }
  };

  // Allow keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        if (pin.length < 4) {
          const nextPin = pin + e.key;
          setPin(nextPin);
          if (nextPin.length === 4) {
            handleVerifyPin(nextPin);
          }
        }
      } else if (e.key === 'Backspace') {
        setPin(prev => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        if (pin.length === 4) {
          handleVerifyPin();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin]);

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      if (nextPin.length === 4) {
        handleVerifyPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setError('');
    setPin('');
  };

  const handleVerifyPin = async (overridePin?: string) => {
    const rawTarget = overridePin !== undefined ? overridePin : pin;
    const targetPin = convertBengaliToEnglishDigits(rawTarget).trim();
    if (targetPin.length !== 4) return;

    const lockStatus = getLockoutState(userIdentifier);
    if (lockStatus.isLocked) {
      setLockoutInfo(lockStatus);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const data = await verifyPinUniversal(user?.uid || '', user?.email || '', targetPin);

      if (data.verified) {
        clearLockoutState(userIdentifier);
        if (isLogoutMode) {
          onLogout();
        } else {
          onUnlock();
        }
      } else if (data.forcePinReset) {
        setPin('');
        setShowForgotPinModal(true);
        setResetError(
          localizeLockError(
            data.error,
            'নিরাপত্তা আপডেটের কারণে ইমেইল ওটিপি ভেরিফিকেশনের মাধ্যমে নতুন 4 ডিজিট পিন সেট করা বাধ্যতামূলক।',
            'For security reasons, setting a new 4-digit PIN via email OTP is required.'
          )
        );
      } else {
        if (data.locked) {
          const remainingSec = Number(data.remainingSeconds) || 900;
          setLockoutInfo({
            isLocked: true,
            remainingSeconds: remainingSec,
            failedAttempts: 5,
            pinAttempts: 5,
            passwordAttempts: 0,
            reason: 'pin'
          });
          setError(
            localizeLockError(
              data.error,
              'ভুল পিন 5 বার দেওয়া হয়েছে! অ্যাকাউন্ট 15 মিনিটের জন্য লক করা হলো।',
              'Incorrect PIN entered 5 times! Account locked for 15 minutes.'
            )
          );
        } else {
          const rem = typeof data.remainingAttempts === 'number' ? data.remainingAttempts : undefined;
          const fallbackBn = rem !== undefined ? `ভুল পিন! আর মাত্র ${rem} বার চেষ্টা করতে পারবেন।` : 'ভুল পিন! সঠিক 4 ডিজিট পিন দিন অথবা নিচে পিন রিসেট করুন।';
          const fallbackEn = rem !== undefined ? `Incorrect PIN! ${rem} attempts remaining.` : 'Incorrect PIN! Please enter your 4-digit PIN or reset it below.';
          setError(localizeLockError(data.error, fallbackBn, fallbackEn));
        }
        setPin('');
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("PIN verification error:", err);
      }
      setError(isBn ? 'পিন যাচাই করতে সমস্যা হয়েছে। ইন্টারনেট সংযোগ চেক করুন।' : 'Failed to verify PIN. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySecretLock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanInput = convertBengaliToEnglishDigits(secretCodeInput).trim();
    if (cleanInput.length !== 4 || !/^\d{4}$/.test(cleanInput)) {
      setError(isBn ? 'অনুগ্রহ করে আপনার 4 ডিজিট পিন লিখুন!' : 'Please enter your 4-digit PIN!');
      return;
    }

    const lockStatus = getLockoutState(userIdentifier);
    if (lockStatus.isLocked) {
      setLockoutInfo(lockStatus);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const data = await verifyPinUniversal(user?.uid || '', user?.email || '', cleanInput);

      if (data.verified) {
        clearLockoutState(userIdentifier);
        setSecretCodeInput('');
        setLoading(false);

        if (isLogoutMode) {
          onLogout();
        } else {
          if (user?.uid) {
            const userRef = doc(db, 'users', user.uid);
            updateDoc(userRef, {
              isAppLocked: false
            }).catch((err) => {
              if (import.meta.env.DEV) console.error("Firestore app lock update error:", err);
            });
          }
          onUnlock();
        }
      } else if (data.forcePinReset) {
        setSecretCodeInput('');
        setLoading(false);
        setShowForgotPinModal(true);
        setResetError(
          localizeLockError(
            data.error,
            'ইমেইল ওটিপি ভেরিফিকেশনের মাধ্যমে 4 ডিজিট পিন রিসেট করুন।',
            'Please reset your 4-digit PIN via email OTP verification.'
          )
        );
      } else {
        setLoading(false);
        if (data.locked) {
          setLockoutInfo({
            isLocked: true,
            remainingSeconds: Number(data.remainingSeconds) || 900,
            failedAttempts: 5,
            pinAttempts: 5,
            passwordAttempts: 5,
            reason: 'pin'
          });
        }
        setError(
          localizeLockError(
            data.error,
            'ভুল পিন! সঠিক 4 ডিজিট পিন দিন অথবা নিচে পিন রিসেট করুন।',
            'Incorrect PIN! Please enter your 4-digit PIN or reset it below.'
          )
        );
        setSecretCodeInput('');
      }
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error("Failed to verify secret lock code:", err);
      }
      setError(isBn ? 'পিন যাচাই করতে সমস্যা হয়েছে। ইন্টারনেট চেক করুন।' : 'Failed to verify PIN. Please check your internet connection.');
      setLoading(false);
    }
  };

  const isSecretLocked = !!user?.isAppLocked;

  if (lockoutInfo.isLocked) {
    return (
      <div className="fixed inset-0 bg-slate-50 flex flex-col items-center justify-center p-4 z-50">
        <div className="w-full max-w-sm">
          <LockoutScreen
            identifier={userIdentifier}
            initialRemainingSeconds={lockoutInfo.remainingSeconds}
            reason={lockoutInfo.reason}
            onUnlocked={() => {
              setLockoutInfo({
                isLocked: false,
                remainingSeconds: 0,
                failedAttempts: 0,
                pinAttempts: 0,
                passwordAttempts: 0
              });
              setError('');
            }}
            onBack={() => {
              onLogout();
            }}
            appLanguage={appLanguage}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-50 flex flex-col items-center justify-between py-8 px-6 overflow-y-auto select-none font-sans text-slate-800 z-40">
      {/* Soft Decorative BNBient Background */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Content Area */}
      <div className="w-full max-w-sm flex flex-col items-center my-auto space-y-4 relative z-10">
        {/* Branding / Logo */}
        <div className="flex flex-col items-center gap-1.5 mb-1 mt-1 shrink-0">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-1 p-1 border border-slate-200/80 shadow-md overflow-hidden shrink-0">
            {appConfig?.logoUrl ? (
              <img src={appConfig.logoUrl} alt="Logo" className="w-full h-full object-cover rounded-xl" referrerPolicy="no-referrer" />
            ) : (
              <BNBLogo className="w-11 h-11 text-emerald-700 filter drop-shadow-xs" />
            )}
          </div>
          <h1 className="text-base font-black tracking-wide text-emerald-850 text-center">
            {appConfig?.appName && !appConfig.appName.toUpperCase().includes('MAYADIN') ? appConfig.appName : 'BNB BUSINESS network Bangladesh'}
          </h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">DIGITAL SAMITY SYSTEM</p>
        </div>

        {isSecretLocked ? (
          /* ========================================================= */
          /* 2ND STEP APP LOCK UI (4-DIGIT PIN) */
          /* ========================================================= */
          <div className="w-full bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xl space-y-4 text-left relative overflow-hidden">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 text-amber-700 shadow-xs">
                <LockKeyhole className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="text-[9px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 uppercase tracking-wider">
                  {isBn ? '🔒 অ্যাপ পিন লক' : '🔒 App PIN Lock'}
                </span>
                <h2 className="text-base font-black text-slate-900 mt-0.5">{user.name || (isBn ? 'গ্রাহক' : 'Member')}</h2>
                <p className="text-[11px] font-mono font-bold text-slate-600">ID: {user.memberId}</p>
              </div>
            </div>

            {/* Lock Instruction Banner */}
            <div className={`p-3 rounded-2xl text-[11px] leading-relaxed font-medium ${isLogoutMode ? 'bg-rose-50 border border-rose-200 text-rose-900' : 'bg-amber-50 border border-amber-200/80 text-amber-900'}`}>
              ⚠️ <strong>{isLogoutMode ? (isBn ? 'লগআউট সিকিউরিটি যাচাই:' : 'Logout Security Check:') : (isBn ? 'পিন লক সক্রিয় আছে!' : 'PIN Lock Active!')}</strong>{' '}
              {isLogoutMode
                ? (isBn ? 'অ্যাপ থেকে সম্পূর্ণ লগআউট হয়ে বের হতে আপনার 4 ডিজিট পিন দিন।' : 'Enter your 4-digit PIN to log out completely.')
                : (isBn ? 'অ্যাপে প্রবেশ করতে আপনার 4 ডিজিট পিন দিয়ে আনলক করুন।' : 'Enter your 4-digit PIN to unlock and access the app.')}
            </div>

            {/* Pending Admin Unlock Request Banner */}
            {user.appLockResetRequested && user.appLockResetStatus === 'pending' && (
              <div className="bg-sky-50 border border-sky-200 p-3 rounded-2xl text-[11px] text-sky-900 leading-relaxed font-bold flex items-start gap-2 shadow-xs">
                <div className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-ping shrink-0 mt-1" />
                <div>
                  <strong>{isBn ? '⏳ আনলক রিকোয়েস্ট পেন্ডিং:' : '⏳ Unlock Request Pending:'}</strong>{' '}
                  {isBn
                    ? 'আপনার আনলক রিকোয়েস্ট এডমিনের পর্যালোচনায় রয়েছে। এডমিন যাচাই করে এপ্রুভ করার সাথে সাথে আপনার অ্যাপস স্বয়ংক্রিয়ভাবে আনলক হয়ে যাবে।'
                    : 'Your unlock request is under Admin review. Your app will unlock automatically once approved.'}
                </div>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Secret Code Form */}
            <form onSubmit={handleVerifySecretLock} className="space-y-3.5 pt-1">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  {isBn ? '4 ডিজিট পিন' : '4-Digit PIN'}
                </label>
                <div className="relative">
                  <input
                    type={showSecretCode ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="\d{4}"
                    value={secretCodeInput}
                    onChange={(e) => setSecretCodeInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    maxLength={4}
                    placeholder="••••"
                    className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all tracking-widest"
                    autoFocus
                    required
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowSecretCode(!showSecretCode)}
                    className="absolute right-3 top-3 p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                  >
                    {showSecretCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex justify-between items-center mt-1 text-[10px] text-slate-400 font-bold px-1">
                  <span>{isBn ? '4 ডিজিট পিন' : '4-Digit PIN'}</span>
                  <span>{secretCodeInput.length}/4</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || secretCodeInput.length !== 4}
                className={`w-full py-3 px-4 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 ${isLogoutMode ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 shadow-rose-600/20' : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-emerald-600/20'}`}
              >
                {loading ? (
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    {isLogoutMode
                      ? (isBn ? '🔒 পিন দিয়ে লগআউট করুন' : '🔒 Log Out with PIN')
                      : (isBn ? 'অ্যাপস আনলক করুন' : 'Unlock App')}
                  </>
                )}
              </button>
            </form>

            {/* Cancel Logout Button when in Logout Mode */}
            {isLogoutMode && onCancelLogout && (
              <button
                type="button"
                onClick={onCancelLogout}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer text-center"
              >
                {isBn ? '❌ বাতিল করে অ্যাপে থাকুন' : '❌ Cancel & Stay in App'}
              </button>
            )}

            {/* Forgot Lock Code Link */}
            <button
              type="button"
              onClick={() => { setShowForgotPinModal(true); setResetError(''); setResetMessage(''); }}
              className="w-full text-center text-amber-900 hover:text-amber-950 text-[10.5px] font-extrabold tracking-wide cursor-pointer py-2 px-3 bg-amber-50 border border-amber-200/80 rounded-xl hover:bg-amber-100 transition-all block"
            >
              {isBn ? '🔑 পিন ভুলে গেছেন? রিসেট রিকোয়েস্ট পাঠান' : '🔑 Forgot PIN? Send Reset Request'}
            </button>

            {/* Logout button if NOT already in logout mode */}
            {!isLogoutMode && (
              <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-600 font-bold cursor-pointer transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  {isBn ? 'অন্য অ্যাকাউন্ট দিয়ে লগইন' : 'Login with Another Account'}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ========================================================= */
          /* STANDARD 4-DIGIT PIN LOCK UI */
          /* ========================================================= */
          <>
            {/* User Card */}
            <div className="flex flex-col items-center gap-1 mb-1 text-center shrink-0 w-full max-w-[300px]">
              <div className="w-13 h-13 bg-emerald-100/70 border border-emerald-200 rounded-full flex items-center justify-center text-emerald-700 shadow-xs mb-1">
                <KeyRound className="w-6 h-6 text-emerald-700" />
              </div>
              <span className="text-[10.5px] font-extrabold text-emerald-800 uppercase tracking-widest bg-emerald-50 px-3 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
                {isBn ? 'নিরাপত্তা লক' : 'Security Lock'}
              </span>
              <h2 className="text-lg font-black text-slate-900 tracking-tight mt-1">{user.name || (isBn ? 'সদস্য' : 'Member')}</h2>
              <div className="flex items-center gap-2 justify-center">
                <p className="text-[11px] font-mono font-bold text-slate-800 bg-white px-3 py-0.5 rounded-full border border-slate-200 shadow-2xs">
                  {user.memberId || localStorage.getItem('amb_user_member_id') || 'BNB00000000'}
                </p>
                {user.phone && (
                  <p className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 shadow-2xs">
                    {user.phone}
                  </p>
                )}
              </div>
            </div>

            {/* PIN Input Circles */}
            <div className="flex flex-col items-center gap-1 mb-1 shrink-0 w-full">
              <div className="flex justify-center gap-4 py-1">
                {[0, 1, 2, 3].map((index) => (
                  <motion.div
                    key={index}
                    animate={error ? { x: [0, -4, 4, -4, 4, 0] } : {}}
                    transition={{ duration: 0.4 }}
                    className={`w-4.5 h-4.5 rounded-full border-2 transition-all duration-200 ${
                      index < pin.length
                        ? 'bg-emerald-600 border-emerald-600 shadow-xs scale-110'
                        : 'bg-white border-slate-300'
                    }`}
                  />
                ))}
              </div>
              
              {/* Error Message Space - RIGID FIXED HEIGHT TO ABSOLUTELY PREVENT ANY KEYPAD LAYOUT SHIFT */}
              <div className="h-12 w-full max-w-[300px] flex items-center justify-center text-center px-1 shrink-0">
                {error ? (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-[11px] leading-tight font-bold bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1 rounded-xl shadow-2xs max-w-full"
                  >
                    ⚠️ {error}
                  </motion.span>
                ) : (
                  <span className="text-[11px] font-medium text-slate-400">
                    {isBn ? '4 ডিজিট পিন কোড দিন' : 'Enter 4-Digit PIN'}
                  </span>
                )}
              </div>
            </div>

            {/* Tactile PIN Pad Grid */}
            <div className="grid grid-cols-3 gap-y-3 gap-x-5 mb-2 w-full max-w-[300px] shrink-0">
              {[
                { bd: '1', en: '1' },
                { bd: '2', en: '2' },
                { bd: '3', en: '3' },
                { bd: '4', en: '4' },
                { bd: '5', en: '5' },
                { bd: '6', en: '6' },
                { bd: '7', en: '7' },
                { bd: '8', en: '8' },
                { bd: '9', en: '9' },
                { bd: 'C', en: 'Clear', isAction: true },
                { bd: '0', en: '0' },
                { bd: '⌫', en: 'Backspace', isAction: true }
              ].map((key) => (
                <motion.button
                  key={key.en}
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    if (key.en === 'Clear') {
                      handleClear();
                    } else if (key.en === 'Backspace') {
                      handleBackspace();
                    } else {
                      handleKeyPress(key.en);
                    }
                  }}
                  className={`h-13 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer border shadow-2xs ${
                    key.isAction
                      ? 'bg-slate-100 border-slate-250 text-slate-700 hover:bg-slate-200 hover:text-slate-900 font-bold'
                      : 'bg-white border-slate-250 text-slate-900 hover:bg-emerald-50 hover:border-emerald-300 font-black'
                  }`}
                >
                  <span className={`font-bold ${key.isAction ? 'text-xs' : 'text-xl font-mono'}`}>{key.bd}</span>
                </motion.button>
              ))}
            </div>

            {/* Forgot PIN / Password Helpline Notice */}
            <button
              type="button"
              onClick={() => { setShowForgotPinModal(true); setResetError(''); setResetMessage(''); }}
              className="block text-amber-900 hover:text-amber-950 mt-0.5 mb-1 text-[10.5px] font-extrabold tracking-wide cursor-pointer mx-auto bg-amber-50 border border-amber-200/80 py-1.5 px-3.5 rounded-full hover:bg-amber-100 active:scale-95 transition-all shrink-0 text-center shadow-2xs"
            >
              {isBn ? '🔑 পিন ভুলে গেছেন? রিসেট রিকোয়েস্ট পাঠান' : '🔑 Forgot PIN? Send Reset Request'}
            </button>

            {/* Footer actions */}
            <div className="flex justify-between items-center w-full max-w-[300px] border-t border-slate-200 pt-3 px-1 text-xs shrink-0">
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-xl transition-all font-bold cursor-pointer active:scale-95 shadow-2xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                {isBn ? 'অন্য অ্যাকাউন্ট' : 'Switch Account'}
              </button>
              
              <button
                type="button"
                onClick={() => handleVerifyPin(pin)}
                disabled={loading || pin.length !== 4}
                className="flex items-center gap-1.5 text-emerald-800 hover:text-emerald-900 transition-colors font-black disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold animate-pulse text-emerald-800">
                      {isBn ? 'অটো যাচাই হচ্ছে...' : 'Verifying...'}
                    </span>
                    <div className="w-4 h-4 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : pin.length === 4 ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold animate-pulse text-emerald-800">
                      {isBn ? 'অটো লগইন...' : 'Logging in...'}
                    </span>
                    <div className="w-4 h-4 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    {isBn ? 'প্রবেশ করুন' : 'Enter App'}
                    <ArrowRight className="w-4 h-4 animate-pulse" />
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Forgot PIN / Password Helpline Info Modal */}
      <AnimatePresence>
        {showForgotPinModal && (
          <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4 backdrop-blur-xs font-sans text-slate-800 animate-fade-in">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-sm border border-slate-100"
            >
              <div className="bg-amber-900 text-white p-5 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-300" />
                  <span className="font-bold text-sm">
                    {isBn ? 'সিকিউরিটি পিন রিসেট সার্ভিস' : 'Security PIN Reset Service'}
                  </span>
                </div>
                <button 
                  onClick={() => setShowForgotPinModal(false)}
                  className="p-1 hover:bg-amber-800 text-amber-200 hover:text-white rounded-full transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-center">
                <div className="w-12 h-12 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center mx-auto border border-amber-300">
                  <KeyRound className="w-6 h-6" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base font-black text-slate-900">
                    {isBn ? 'ইমেইল ওটিপি দিয়ে পিন রিসেট' : 'Reset PIN via Email OTP'}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    {isBn
                      ? 'পিন ভুলে গেলে আপনার নিবন্ধিত জিমেইলে 6 সংখ্যার ওটিপি কোড পাঠিয়ে নতুন 4 ডিজিট পিন সেট করুন।'
                      : 'Send a 6-digit OTP code to your registered email to set a new 4-digit PIN.'}
                  </p>
                </div>

                {resetMessage && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-2xl text-xs font-bold text-left flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{resetMessage}</span>
                  </div>
                )}

                {resetError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-2xl text-xs font-bold text-left flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{resetError}</span>
                  </div>
                )}

                {user && (
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl text-left font-sans text-xs text-slate-700 space-y-1">
                    <p>👤 <strong>{isBn ? 'সদস্য নামঃ' : 'Member Name:'}</strong> {user.name || (isBn ? 'সদস্য' : 'Member')}</p>
                    <p>🆔 <strong>{isBn ? 'সদস্য আইডিঃ' : 'Member ID:'}</strong> <span className="font-mono text-slate-900 font-black">{user.memberId}</span></p>
                    {user.email && <p>✉️ <strong>{isBn ? 'ইমেইলঃ' : 'Email:'}</strong> <span className="font-mono text-slate-900 font-black">{user.email}</span></p>}
                  </div>
                )}

                {!resetOtpSent ? (
                  <button
                    type="button"
                    onClick={handleRequestPinResetOtp}
                    disabled={resetLoading}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs rounded-2xl transition cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {resetLoading ? (
                      <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        {isBn ? '📧 ইমেইলে পিন রিসেট ওটিপি পাঠান' : '📧 Send PIN Reset OTP to Email'}
                      </>
                    )}
                  </button>
                ) : (
                  <form onSubmit={handleResetPinSubmit} className="space-y-2.5 text-left">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        {isBn ? 'ইমেইলের 6 সংখ্যার ওটিপি কোড' : '6-Digit Email OTP Code'}
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={resetOtpCode}
                        onChange={(e) => setResetOtpCode(e.target.value)}
                        placeholder={isBn ? '6 সংখ্যার ওটিপি দিন' : 'Enter 6-digit OTP'}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          {isBn ? 'নতুন 4 ডিজিট পিন' : 'New 4-Digit PIN'}
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          pattern="\d{4}"
                          maxLength={4}
                          value={newResetPin}
                          onChange={(e) => setNewResetPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder={isBn ? '4 ডিজিট পিন' : '4-digit PIN'}
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          {isBn ? 'পিন নিশ্চিত করুন' : 'Confirm PIN'}
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          pattern="\d{4}"
                          maxLength={4}
                          value={newResetPinConfirm}
                          onChange={(e) => setNewResetPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder={isBn ? 'পুনরায় পিন' : 'Re-enter PIN'}
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          required
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs rounded-2xl transition cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {resetLoading ? (
                        <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          {isBn ? 'নতুন পিন সেট ও আনলক করুন' : 'Set New PIN & Unlock'}
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* Secondary Action: Send Request to Admin */}
                <button
                  type="button"
                  onClick={handleSendAdminUnlockRequest}
                  disabled={resetLoading || user?.appLockResetRequested}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-black text-xs rounded-2xl transition cursor-pointer shadow-xs flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {user?.appLockResetRequested ? (
                    <>
                      <Check className="w-4 h-4" />
                      {isBn ? 'আনলক রিকোয়েস্ট এডমিনের কাছে পাঠানো আছে' : 'Unlock Request Sent to Admin'}
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      {isBn ? '📩 এডমিনের কাছে আনলক রিকোয়েস্ট পাঠান' : '📩 Send Unlock Request to Admin'}
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setShowForgotPinModal(false); setResetOtpSent(false); setResetOtpCode(''); }}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition cursor-pointer"
                >
                  {isBn ? 'বন্ধ করুন' : 'Close'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
