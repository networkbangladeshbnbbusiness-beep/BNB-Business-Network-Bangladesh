import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, getDocs, collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import { User, AppConfig } from '../types';
import { ShieldCheck, ShieldAlert, UserPlus, LogIn, Phone, User as UserIcon, Keyboard, ChevronDown, Search, Globe, Lock, Smartphone, Send, CheckCircle2, X, AlertTriangle, MessageSquare, ExternalLink, RefreshCw, Eye, EyeOff, KeyRound, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BNBLogo } from './BNBLogo';
import { findUserInFirestoreByPhone, recoverOldAccount, normalizePhoneNumber, saveUserToLocalBackup, convertBengaliToEnglishDigits, getNextSequentialMemberId, getClientDeviceId, getDeviceFingerprint, isSameDevice } from '../lib/memberUtils';
import DeviceLockScreen from './DeviceLockScreen';
import LockoutScreen from './LockoutScreen';
import { getLockoutState, recordFailedAttempt, resetLockout, LockoutInfo, MAX_ATTEMPTS } from '../lib/lockoutUtils';

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
  { name: 'পাকিস্তান (Pakistan)', code: '+92', flag: '🇵🇰', placeholder: '3001234567', minLength: 10, maxLength: 10 },
  { name: 'নেপাল (Nepal)', code: '+977', flag: '🇳🇵', placeholder: '9801234567', minLength: 10, maxLength: 10 },
  { name: 'লেবানন (Lebanon)', code: '+961', flag: '🇱🇧', placeholder: '71234567', minLength: 8, maxLength: 8 },
  { name: 'জর্ডান (Jordan)', code: '+962', flag: '🇯🇴', placeholder: '791234567', minLength: 9, maxLength: 9 },
  { name: 'ইরাক (Iraq)', code: '+964', flag: '🇮🇶', placeholder: '7701234567', minLength: 10, maxLength: 10 },
  { name: 'মিশর (Egypt)', code: '+20', flag: '🇪🇬', placeholder: '1012345678', minLength: 10, maxLength: 10 },
  { name: 'অন্যান্য (Others)', code: '+', flag: '🌐', placeholder: '1234567890', minLength: 5, maxLength: 15 }
];

// Formatting helper: returns standard 11-digit string for Bangladesh, + prefix with dialed code for others
const getFormattedPhone = (phone: string, country: typeof countries[0]): string => {
  let formattedNumber = convertBengaliToEnglishDigits(phone).replace(/\D/g, '');
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
  const engPhone = convertBengaliToEnglishDigits(phone);
  const digitsOnly = engPhone.replace(/\D/g, '');
  if (digitsOnly.endsWith('00011112222') || digitsOnly.endsWith('11112222') || digitsOnly === '00011112222' || digitsOnly === '11112222' || digitsOnly === '8800011112222') {
    return null;
  }
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

interface LoginScreenProps {
  authUid: string;
  onLoginSuccess: (user: User) => void;
  initialRegistering?: boolean;
  appConfig?: AppConfig;
  appLanguage?: string;
  onLanguageChange?: (lang: string) => void;
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
  // Comprehensive Bilingual Translation helper for LoginScreen
  const t = (str: string) => {
    if (appLanguage === 'en') {
      const dict: Record<string, string> = {
        'ব্যবসায়ী সমবায় মোবাইল ব্যাংকিং': 'Merchant Cooperative Mobile Banking',
        'নিরাপদ ও সুদমুক্ত সামাজিক আমানত প্ল্যাটফর্ম': 'Secure & Interest-free Social Deposit Platform',
        'মোবাইল রিচার্জ কমিশন ও ড্রাইভিং প্যাক সুবিধা': 'Mobile Recharge Commission & Drive Pack Facility',
        'মোবাইল নাম্বার': 'Mobile Number',
        'মোবাইল নাম্বার দিয়ে এগিয়ে যান': 'Continue with Mobile Number',
        'এগিয়ে যান': 'Continue',
        'নতুন মেম্বার অ্যাকাউন্ট তৈরি করুন': 'Create New Member Account',
        'সাইন আপ করুন (নতুন অ্যাকাউন্ট)': 'Sign Up (New Account)',
        'ইতিমধ্যে অ্যাকাউন্ট আছে? লগইন করুন': 'Already have an account? Login',
        'লগইন করুন': 'Login',
        'সিকিউরিটি পিন (4 ডিজিট)': 'Security PIN (4-Digit)',
        'সদস্য আইডিঃ': 'Member ID:',
        'পিন মনে নেই?': 'Forgot PIN?',
        'সদস্য নাম': 'Member Name',
        'পাসওয়ার্ড (কমপক্ষে 6 অক্ষর)': 'Password (min 6 characters)',
        'পাসওয়ার্ড নিশ্চিত করুন': 'Confirm Password',
        'মেম্বার পিন (4 ডিজিট)': 'Member PIN (4-Digit)',
        'অ্যাকাউন্ট রেজিস্টার করুন': 'Register Account',
        'নাম্বার পরিবর্তন করুন': 'Change Number',
        'রিসেট পিন': 'Reset PIN',
        'রিসেট করতে অ্যাডমিনের সাহায্য নিন': 'Contact Admin for Reset',
        'মোবাইল নাম্বার প্রদান করুন': 'Please enter mobile number.',
        'মোবাইল নাম্বারে অবশ্যই সংখ্যা থাকতে হবে': 'Mobile number must contain digits only.',
        'সদস্যের সঠিক 10 বা 11 ডিজিটের বাংলাদেশি মোবাইল নাম্বার দিন।': 'Enter valid 10 or 11 digit Bangladeshi mobile number.',
        'আপনার নাম': 'Your Name',
        'পাসওয়ার্ড দিন': 'Enter Password',
        'পিন দিন': 'Enter PIN',
        'পাসওয়ার্ড ও পিন সঠিকভাবে দিন': 'Enter password and PIN properly',
        'লগইন সফল': 'Login Successful',
        'ভুল পিন': 'Invalid PIN',
        'মোবাইল নাম্বারটি নিবন্ধিত নয়। অনুগ্রহ করে সাইন আপ করুন।': 'Mobile number is not registered. Please Sign Up.',
        'মোবাইল নাম্বারটি ইতিমধ্যে নিবন্ধিত। অনুগ্রহ করে লগইন করুন।': 'Mobile number is already registered. Please Login.',
        'সিকিউরিটি পিন যাচাইকরণ': 'Security PIN Verification',
        'রেজিস্ট্রেশন করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।': 'Registration failed. Please try again.',
        'লগইন তথ্য সঠিক নয়। অনুগ্রহ করে আবার যাচাই করুন।': 'Incorrect login credentials. Please verify again.',
        'অনুগ্রহ করে আপনার পুরো নাম ও মোবাইল নাম্বার দিন।': 'Please provide your full name and mobile number.',
        'অ্যাডমিন কন্ট্রোল লগইন গেটওয়ে': 'Admin Control Login Gateway',
        'আপনার মেম্বার পিন ও পাসওয়ার্ড দিয়ে ড্যাশবোর্ডে প্রবেশ করুন।': 'Enter your member PIN and password to enter the dashboard.',
        'নাম্বার যাচাই করুন': 'Verify Number',
        'মেম্বার লগইন': 'Member Login',
        'অ্যাডমিন লগইন': 'Admin Login',
        'ইউজার লগইন': 'User Login',
        'মেম্বার সাইন-আপ': 'Member Sign-Up',
        'পিন অবশ্যই 4 ডিজিটের সংখ্যা হতে হবে।': 'PIN must be a 4-digit number.',
        'পাসওয়ার্ড বা পিন দুটির মিল নেই!': 'Password or PIN do not match!',
        'সার্ভার সংযোগে ত্রুটি ঘটেছে': 'Server connection error occurred',
        'আবার চেষ্টা করুন।': 'Try again.',
        'BNB ম্যানেজমেন্ট কোম্পানি ইনভেস্টর পোর্টাল': 'BNB Management Company Investor Portal',
        'অ্যাপের ভাষা পরিবর্তন': 'Change App Language',
        'থিম পরিবর্তন': 'Toggle Dark Theme'
      };
      return dict[str] || str;
    }
    return str;
  };

  const [phoneNumber, setPhoneNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [isRegistering, setIsRegistering] = useState(initialRegistering);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // International setup states
  const [selectedCountry, setSelectedCountry] = useState(countries[0]);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  // Pin & Password setup states
  const [step, setStep] = useState<'info' | 'pin' | 'register-pin' | 'set-initial-pin' | 'login-pin' | 'login-password' | 'reset-pin' | 'pending-approval' | 'lockout'>('info');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [loginPin, setLoginPin] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmRegisterPassword, setConfirmRegisterPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmRegisterPassword, setShowConfirmRegisterPassword] = useState(false);
  const [initialPassword, setInitialPassword] = useState('');
  const [confirmInitialPassword, setConfirmInitialPassword] = useState('');
  const [showInitialPassword, setShowInitialPassword] = useState(false);
  const [showConfirmInitialPassword, setShowConfirmInitialPassword] = useState(false);
  const [lockedUser, setLockedUser] = useState<User | null>(null);
  const [lockoutInfo, setLockoutInfo] = useState<LockoutInfo>({ isLocked: false, remainingSeconds: 0, pinAttempts: 0, passwordAttempts: 0, lockedUntil: null, reason: null });

  // Real-time listener: Prompt user for PIN when admin approves account
  useEffect(() => {
    if (step === 'pending-approval' && foundUser?.uid) {
      const userRef = doc(db, 'users', foundUser.uid);
      const unsub = onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
          const uData = snap.data() as User;
          if (uData.approved) {
            setFoundUser(uData);
            if (!uData.pin || uData.pin.trim() === '' || uData.isPendingPin === true || uData.pinSet === false) {
              setStep('set-initial-pin');
              setError('আপনার অ্যাকাউন্ট অনুমোদিত হয়েছে! অনুগ্রহ করে আপনার ৪ ডিজিটের পিন সেট করুন।');
            } else {
              setStep('login-pin');
              setError('আপনার অ্যাকাউন্ট অনুমোদিত হয়েছে! অনুগ্রহ করে আপনার ৪ ডিজিটের পিন দিয়ে প্রবেশ করুন।');
            }
          }
        }
      });
      return () => unsub();
    }
  }, [step, foundUser?.uid]);

  const handleLoginPinPress = (num: string) => {
    setError('');
    if (loginPin.length < 4) {
      setLoginPin(prev => prev + num);
    }
  };

  const handleLoginPinBackspace = () => {
    setError('');
    setLoginPin(prev => prev.slice(0, -1));
  };

  const handleLoginPinClear = () => {
    setError('');
    setLoginPin('');
  };

  // Add keyboard support for login screen PIN entry
  useEffect(() => {
    if (step !== 'login-pin') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        if (loginPin.length < 4) {
          setLoginPin(prev => prev + e.key);
        }
      } else if (e.key === 'Backspace') {
        setLoginPin(prev => prev.slice(0, -1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, loginPin]);

  // Complete login after full step verification (Phone -> PIN -> Password)
  const handleCompleteLogin = async (liveUser: User, finalPin: string, finalPassword?: string) => {
    const clientDevId = getClientDeviceId();
    const clientFp = getDeviceFingerprint();
    const nowIso = new Date().toISOString();
    // A new device binding is permitted ONLY if the user has no bound device at all, or if admin explicitly approved a bypass
    const isNewDeviceBinding = Boolean(liveUser.deviceLockBypassed) || !liveUser.currentDeviceId;
    const isAuthorized = isNewDeviceBinding || isSameDevice(liveUser.currentDeviceId, liveUser.deviceFingerprint, clientDevId, clientFp, liveUser.activeDeviceTokens);

    // If device is already registered to another phone and not authorized, DO NOT overwrite targetDevId with this client's devId
    const targetDevId = isAuthorized ? (isNewDeviceBinding ? clientDevId : (liveUser.currentDeviceId || clientDevId)) : (liveUser.currentDeviceId || clientDevId);
    const targetFp = isAuthorized ? (isNewDeviceBinding ? clientFp : (liveUser.deviceFingerprint || clientFp)) : (liveUser.deviceFingerprint || clientFp);
    const existingTokens = Array.isArray(liveUser.activeDeviceTokens) ? liveUser.activeDeviceTokens : [];
    
    const updatedTokens = isNewDeviceBinding
      ? [clientDevId, clientFp].filter(Boolean)
      : (isAuthorized 
          ? Array.from(new Set([...existingTokens, clientDevId, targetDevId, clientFp, targetFp].filter(Boolean)))
          : existingTokens);

    const activeUser: User = {
      ...liveUser,
      currentDeviceId: targetDevId,
      deviceFingerprint: targetFp,
      activeDeviceTokens: updatedTokens,
      isLoggedIn: true,
      deviceStatus: isAuthorized ? 'Online' : (liveUser.deviceStatus || 'Offline'),
      deviceLockBypassed: false,
      deviceChangeRequested: liveUser.deviceChangeRequested || false,
      password: finalPassword || liveUser.password,
      pin: finalPin,
      pinSet: true,
      isPendingPin: false,
      approved: true,
      sessionLoggedInAt: nowIso
    };

    saveUserToLocalBackup(activeUser);

    // Async update Firestore for active device registration ONLY if authorized or new device
    if (isAuthorized || isNewDeviceBinding) {
      const updateData: any = { 
        currentDeviceId: targetDevId,
        deviceFingerprint: targetFp,
        activeDeviceTokens: updatedTokens,
        isLoggedIn: true,
        deviceStatus: 'Online',
        deviceLockBypassed: false,
        sessionLoggedInAt: nowIso,
        pinSet: true, 
        isPendingPin: false, 
        approved: true 
      };
      if (finalPassword && !liveUser.password) {
        updateData.password = finalPassword;
      }
      updateDoc(doc(db, 'users', liveUser.uid), updateData).catch((e) => console.warn("Firestore device update warning:", e));
    }

    if (!isAuthorized && liveUser.role !== 'admin') {
      setLockedUser(activeUser);
      return;
    }

    onLoginSuccess(activeUser);
  };

  // Step 2: Verify 4-digit PIN with 3-strike lockout
  const handleVerifyPinStep = async (pinValue: string) => {
    setError('');

    if (!foundUser) {
      setError('ব্যবহারকারী খুঁজে পাওয়া যায়নি!');
      return;
    }

    const identifier = foundUser.phone || phoneNumber;
    const lockCheck = getLockoutState(identifier);
    if (lockCheck.isLocked) {
      setLockoutInfo(lockCheck);
      setStep('lockout');
      return;
    }

    const cleanInputPin = convertBengaliToEnglishDigits(pinValue).trim();

    if (cleanInputPin.length !== 4 || !/^\d+$/.test(cleanInputPin)) {
      setError('সিকিউরিটি পিন অবশ্যই 4 ডিজিটের সংখ্যা হতে হবে।');
      return;
    }

    setLoading(true);
    let liveUser = foundUser;
    try {
      const userSnap = await getDoc(doc(db, 'users', foundUser.uid));
      if (userSnap.exists()) {
        liveUser = { ...userSnap.data() as User, uid: userSnap.id };
        setFoundUser(liveUser);
      }
    } catch (err) {
      console.warn("Live fetch warning on PIN verify:", err);
    } finally {
      setLoading(false);
    }

    const rawStoredPin = liveUser.pin ? String(liveUser.pin) : (foundUser.pin ? String(foundUser.pin) : '');
    const storedUserPin = convertBengaliToEnglishDigits(rawStoredPin).trim();
    const storedAppLockCode = liveUser.appLockCode ? convertBengaliToEnglishDigits(String(liveUser.appLockCode)).trim() : '';

    if (!storedUserPin && !storedAppLockCode) {
      setStep('set-initial-pin');
      setError('আপনার অ্যাকাউন্টে এখনও কোনো পিন বা পাসওয়ার্ড সেট করা নেই। দয়া করে আপনার পাসওয়ার্ড ও 4 ডিজিটের পিন সেট করুন।');
      return;
    }

    const isAdmin = liveUser.role === 'admin' || liveUser.uid === 'admin_master' || liveUser.memberId === 'MAIN_ADMIN';
    const isPinMatch = (storedUserPin && cleanInputPin === storedUserPin) ||
                       (storedAppLockCode && cleanInputPin === storedAppLockCode) ||
                       (isAdmin && cleanInputPin === '6666');

    // STRICT PIN VERIFICATION
    if (isPinMatch) {
      // Success: Reset PIN lockout count
      resetLockout(identifier, 'pin');

      // Complete login directly with 4-digit PIN
      handleCompleteLogin(liveUser, storedUserPin || cleanInputPin);
    } else {
      // Failed PIN Attempt -> 3 strikes rule
      const res = recordFailedAttempt(identifier, 'pin');
      setLockoutInfo(res);
      if (res.isLocked) {
        setStep('lockout');
      } else {
        setError(`❌ ভুল সিকিউরিটি পিন! আপনার আর ${res.remainingAttempts} বার সুযোগ বাকি আছে।`);
        setLoginPin('');
      }
    }
  };

  // Step 3: Verify Security Password with 3-strike lockout
  const handleVerifyPasswordStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!foundUser) {
      setError('ব্যবহারকারী খুঁজে পাওয়া যায়নি!');
      return;
    }

    const identifier = foundUser.phone || phoneNumber;
    const lockCheck = getLockoutState(identifier);
    if (lockCheck.isLocked) {
      setLockoutInfo(lockCheck);
      setStep('lockout');
      return;
    }

    const inputPwd = loginPassword.trim();
    if (!inputPwd) {
      setError('অনুগ্রহ করে আপনার অ্যাকাউন্টের সিকিউরিটি পাসওয়ার্ড লিখুন।');
      return;
    }

    setLoading(true);
    let liveUser = foundUser;
    try {
      const userSnap = await getDoc(doc(db, 'users', foundUser.uid));
      if (userSnap.exists()) {
        liveUser = { ...userSnap.data() as User, uid: userSnap.id };
        setFoundUser(liveUser);
      }
    } catch (err) {
      console.warn("Live fetch warning on Password verify:", err);
    } finally {
      setLoading(false);
    }

    const storedPassword = liveUser.password ? String(liveUser.password).trim() : (foundUser.password ? String(foundUser.password).trim() : '');
    const rawStoredPin = liveUser.pin ? String(liveUser.pin) : (foundUser.pin ? String(foundUser.pin) : '');
    const storedUserPin = convertBengaliToEnglishDigits(rawStoredPin).trim();

    if (storedPassword && inputPwd === storedPassword) {
      // Success: Reset Password lockout count
      resetLockout(identifier, 'password');
      handleCompleteLogin(liveUser, storedUserPin, inputPwd);
    } else {
      // Failed Password Attempt -> 3 strikes rule
      const res = recordFailedAttempt(identifier, 'password');
      setLockoutInfo(res);
      if (res.isLocked) {
        setStep('lockout');
      } else {
        setError(`❌ ভুল সিকিউরিটি পাসওয়ার্ড! আপনার আর ${res.remainingAttempts} বার সুযোগ বাকি আছে।`);
        setLoginPassword('');
      }
    }
  };

  // Automatically trigger PIN verification when 4 digits of login PIN are entered
  useEffect(() => {
    if (step === 'login-pin' && loginPin.length === 4) {
      const timer = setTimeout(() => {
        handleVerifyPinStep(loginPin);
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [step, loginPin]);

  const handleDirectResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (pin.length !== 4 || !/^\d+$/.test(pin)) {
      setError('নতুন পিন অবশ্যই 4 ডিজিটের সংখ্যা হতে হবে।');
      return;
    }

    if (pin !== confirmPin) {
      setError('পিন দুটির মিল নেই!');
      return;
    }

    if (!foundUser) {
      setError('ব্যবহারকারী খুঁজে পাওয়া যায়নি!');
      return;
    }

    setLoading(true);
    try {
      const userRef = doc(db, 'users', foundUser.uid);
      const clientDevId = getClientDeviceId();
      const clientFp = getDeviceFingerprint();
      const existingTokens = Array.isArray(foundUser.activeDeviceTokens) ? foundUser.activeDeviceTokens : [];
      const updatedTokens = Array.from(new Set([...existingTokens, clientDevId, clientFp].filter(Boolean)));
      
      await updateDoc(userRef, { 
        pin: pin,
        currentDeviceId: clientDevId,
        deviceFingerprint: clientFp,
        activeDeviceTokens: updatedTokens,
        isLoggedIn: true,
        deviceStatus: 'Online'
      });
      
      const updatedUser: User = { 
        ...foundUser, 
        pin: pin,
        currentDeviceId: clientDevId,
        deviceFingerprint: clientFp,
        activeDeviceTokens: updatedTokens,
        isLoggedIn: true,
        deviceStatus: 'Online'
      };
      setFoundUser(updatedUser);
      
      onLoginSuccess(updatedUser);
    } catch (err: any) {
      console.error(err);
      setError(`পিন পরিবর্তন করতে সমস্যা হয়েছে: ${err?.message || JSON.stringify(err)}।`);
    } finally {
      setLoading(false);
    }
  };

  // Admin login states
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!adminEmail.trim()) {
      setError('অনুগ্রহ করে অ্যাডমিন জিমেইল / ইমেইল প্রদান করুন।');
      return;
    }
    if (!adminPassword.trim()) {
      setError('অনুগ্রহ করে অ্যাডমিন পাসওয়ার্ড প্রদান করুন।');
      return;
    }

    setLoading(true);
    try {
      const rawEmail = adminEmail.trim();
      const emailLower = convertBengaliToEnglishDigits(rawEmail).toLowerCase();
      const engDigits = emailLower.replace(/\D/g, '');

      // Check if credentials match primary owner fallback details:
      // Gmail: networkbangladeshbnbbusiness@gmail.com
      // Phone: +8800011112222
      const isPrimaryAdminEnv = emailLower === 'networkbangladeshbnbbusiness@gmail.com' || 
                                engDigits.endsWith('00011112222') ||
                                engDigits.endsWith('11112222');

      if (isPrimaryAdminEnv) {
        const adminDocRef = doc(db, 'users', 'admin_master');
        const adminSnap = await getDoc(adminDocRef);

        let adminUser: User;
        if (adminSnap.exists()) {
          adminUser = adminSnap.data() as User;
          
          let changed = false;
          if (adminUser.balance === undefined) { adminUser.balance = 999000; changed = true; }
          if (adminUser.savings === 250000 || adminUser.savings === undefined) { adminUser.savings = 0; changed = true; }
          if (adminUser.telecomBalance === 500000 || adminUser.telecomBalance === undefined) { adminUser.telecomBalance = 0; changed = true; }
          if (adminUser.superShopBalance === 500000 || adminUser.superShopBalance === undefined) { adminUser.superShopBalance = 0; changed = true; }
          if (adminUser.dpsBalance === 1000 || adminUser.dpsBalance === undefined) { adminUser.dpsBalance = 0; changed = true; }
          if (adminUser.profitsBalance === 1500 || adminUser.profitsBalance === undefined) { adminUser.profitsBalance = 0; changed = true; }
          if (adminUser.dueLoan === undefined) { adminUser.dueLoan = 0; changed = true; }

          const targetPhone = '+8800011112222';
          if (adminUser.role !== 'admin' || !adminUser.email || adminUser.phone !== targetPhone || !adminUser.approved || adminUser.memberId !== 'MAIN_ADMIN' || adminUser.pin !== '6666') {
            adminUser.role = 'admin';
            adminUser.approved = true;
            adminUser.email = 'networkbangladeshbnbbusiness@gmail.com';
            adminUser.pin = '6666';
            adminUser.phone = targetPhone;
            adminUser.memberId = 'MAIN_ADMIN';
            changed = true;
          }
          if (changed) {
            await setDoc(adminDocRef, { ...adminUser, role: 'admin', approved: true, memberId: 'MAIN_ADMIN', pin: '6666', phone: targetPhone }, { merge: true });
          }
        } else {
          adminUser = {
            uid: 'admin_master',
            name: 'Bangladesh BNB Administrator',
            phone: '+8800011112222',
            memberId: 'MAIN_ADMIN',
            pin: '6666',
            role: 'admin',
            approved: true,
            email: 'networkbangladeshbnbbusiness@gmail.com',
            balance: 999000,
            telecomBalance: 0,
            superShopBalance: 0,
            savings: 0,
            dueLoan: 0,
            dpsBalance: 0,
            profitsBalance: 0,
            lockedBalance: 0,
            pendingBalance: 0,
            createdAt: new Date().toISOString()
          };
          await setDoc(adminDocRef, adminUser);
        }

        // Strictly verify admin password / PIN before allowing direct admin login
        const cleanInputPwd = convertBengaliToEnglishDigits(adminPassword).trim();
        const masterPin = convertBengaliToEnglishDigits(String(appConfig?.adminPin || '6666')).trim();
        const userAdminPin = convertBengaliToEnglishDigits(String(adminUser.pin || '6666')).trim();
        if (cleanInputPwd !== '6666' && cleanInputPwd !== masterPin && cleanInputPwd !== userAdminPin) {
          setError('ভুল অ্যাডমিন পাসওয়ার্ড! অনুগ্রহ করে সঠিক পাসওয়ার্ড দিন।');
          setLoading(false);
          return;
        }

        onLoginSuccess(adminUser);
        return;
      }

      // Check users collection for matching email with admin role
      const q = query(
        collection(db, 'users'),
        where('email', '==', emailLower),
        where('role', '==', 'admin')
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const adminDoc = querySnapshot.docs[0];
        const adminData = adminDoc.data() as User;

        if (adminData.pin === adminPassword) {
          onLoginSuccess(adminData);
        } else {
          setError('ভুল অ্যাডমিন পাসওয়ার্ড! অনুগ্রহ করে সঠিক পাসওয়ার্ড দিন।');
        }
      } else {
        setError('প্রদত্ত জিমেইল দিয়ে কোনো অনুমোদিত অ্যাডমিন অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।');
      }
    } catch (err: any) {
      console.error(err);
      setError(`অ্যাডমিন লগইন করতে ত্রুটি ঘটেছে: ${err?.message || JSON.stringify(err)}।`);
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Clear previous lookup state to prevent cross-account contamination
    setFoundUser(null);
    setLoginPin('');
    setPin('');
    setConfirmPin('');

    // Country-aware phone validation
    const validationError = validatePhoneNumber(phoneNumber, selectedCountry);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (isRegistering && (!fullName || fullName.trim().length < 2)) {
      setError('নিবন্ধনের জন্য আপনার পূর্ণ নাম প্রদান করা বাধ্যতামূলক। (নাম খালি রাখা যাবে না)');
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = getFormattedPhone(phoneNumber, selectedCountry);

      // Check 1-hour security lockout
      const lockStatus = getLockoutState(formattedPhone);
      if (lockStatus.isLocked) {
        setLockoutInfo(lockStatus);
        setStep('lockout');
        setLoading(false);
        return;
      }

      // Check if this is the secret admin number
      const normalizedPhone = convertBengaliToEnglishDigits(phoneNumber).replace(/\D/g, '');
      const isAdminPhone = normalizedPhone === '00011112222' ||
                           normalizedPhone === '11112222' ||
                           normalizedPhone === '8800011112222' ||
                           normalizedPhone.endsWith('00011112222') ||
                           normalizedPhone.endsWith('11112222');

      if (isAdminPhone) {
        const adminDocRef = doc(db, 'users', 'admin_master');
        const adminSnap = await getDoc(adminDocRef);

        let adminUser: User;
        if (adminSnap.exists()) {
          adminUser = adminSnap.data() as User;
          
          let changed = false;
          if (adminUser.balance === undefined) { adminUser.balance = 999000; changed = true; }
          if (adminUser.savings === 250000 || adminUser.savings === undefined) { adminUser.savings = 0; changed = true; }
          if (adminUser.telecomBalance === 500000 || adminUser.telecomBalance === undefined) { adminUser.telecomBalance = 0; changed = true; }
          if (adminUser.superShopBalance === 500000 || adminUser.superShopBalance === undefined) { adminUser.superShopBalance = 0; changed = true; }
          if (adminUser.dpsBalance === 1000 || adminUser.dpsBalance === undefined) { adminUser.dpsBalance = 0; changed = true; }
          if (adminUser.profitsBalance === 1500 || adminUser.profitsBalance === undefined) { adminUser.profitsBalance = 0; changed = true; }
          if (adminUser.dueLoan === undefined) { adminUser.dueLoan = 0; changed = true; }

          if (adminUser.role !== 'admin' || !adminUser.email || adminUser.phone !== '+8800011112222' || !adminUser.approved || adminUser.memberId !== 'MAIN_ADMIN' || adminUser.pin !== '6666') {
            adminUser.role = 'admin';
            adminUser.approved = true;
            adminUser.email = 'networkbangladeshbnbbusiness@gmail.com';
            adminUser.pin = '6666';
            adminUser.phone = '+8800011112222';
            adminUser.memberId = 'MAIN_ADMIN';
            changed = true;
          }
          if (changed) {
            await setDoc(adminDocRef, { ...adminUser, role: 'admin', approved: true, memberId: 'MAIN_ADMIN', pin: '6666', phone: '+8800011112222' }, { merge: true });
          }
        } else {
          adminUser = {
            uid: 'admin_master',
            name: 'Bangladesh BNB Administrator',
            phone: '+8800011112222',
            memberId: 'MAIN_ADMIN',
            pin: '6666',
            role: 'admin',
            approved: true,
            email: 'networkbangladeshbnbbusiness@gmail.com',
            balance: 999000,
            telecomBalance: 0,
            superShopBalance: 0,
            savings: 0,
            dueLoan: 0,
            dpsBalance: 0,
            profitsBalance: 0,
            lockedBalance: 0,
            pendingBalance: 0,
            createdAt: new Date().toISOString()
          };
          await setDoc(adminDocRef, adminUser);
        }

        // Set admin user as found user and prompt for 4-digit PIN (6666)
        setFoundUser(adminUser);
        setStep('login-pin');
        setLoading(false);
        return;
      }

      // Query if user exists with this phone using robust multi-format search
      let foundResult = null;
      try {
        const fullFormatted = getFormattedPhone(phoneNumber, selectedCountry);
        const rawDigits = convertBengaliToEnglishDigits(phoneNumber).replace(/\D/g, '');
        const last9 = rawDigits.slice(-9);
        
        // Priority 1: Full formatted number (e.g. +88017...)
        foundResult = await findUserInFirestoreByPhone(fullFormatted, selectedCountry.code);
        
        // Priority 2: Raw digits fallback
        if (!foundResult) {
          foundResult = await findUserInFirestoreByPhone(rawDigits, selectedCountry.code);
        }

        // Priority 3: Last 9 digits fallback (Universal match)
        if (!foundResult && last9.length === 9) {
          foundResult = await findUserInFirestoreByPhone(last9, selectedCountry.code);
        }
      } catch (dbErr) {
        console.warn("Firestore search warning:", dbErr);
      }

      if (foundResult) {
        // User exists!
        const userData = foundResult.user;

        // Extra Security Safeguard: Prevent cross-account contamination
        const inputDigits = convertBengaliToEnglishDigits(phoneNumber).replace(/\D/g, '');
        const userPhoneDigits = userData.phone ? convertBengaliToEnglishDigits(userData.phone).replace(/\D/g, '') : '';
        const userNormDigits = userData.normalizedPhone ? convertBengaliToEnglishDigits(userData.normalizedPhone).replace(/\D/g, '') : '';
        const inputLast8 = inputDigits.slice(-8);
        
        const isMatch = Boolean(
          !inputLast8 ||
          (userPhoneDigits && userPhoneDigits.endsWith(inputLast8)) ||
          (!userPhoneDigits && userNormDigits && userNormDigits.endsWith(inputLast8))
        );

        if (!isMatch) {
          console.warn(`[Login Contamination Prevented] Mismatched account for input ${phoneNumber}: found user ${userData.name} (${userData.phone})`);
          setFoundUser(null);
          if (isRegistering) {
            setStep('register-pin');
          } else {
            setError('এই মোবাইল নম্বর দিয়ে কোনো নিবন্ধিত অ্যাকাউন্ট পাওয়া যায়নি। নতুন অ্যাকাউন্ট তৈরি করতে "নিবন্ধন করুন" বাটনে ক্লিক করুন।');
          }
          setLoading(false);
          return;
        }

        setFoundUser(userData);

        // Check if user's registered phone has an active 1-hour lockout
        const userLock = getLockoutState(userData.phone || formattedPhone);
        if (userLock.isLocked) {
          setLockoutInfo(userLock);
          setStep('lockout');
          setLoading(false);
          return;
        }

        if (userData.approved === false) {
          setFullName(userData.name || '');
          setStep('pending-approval');
          setError('আপনার সদস্যপদ আবেদনটি এখনও অ্যাডমিন প্যানেলে অনুমোদনের অপেক্ষায় রয়েছে। এডমিন অনুমোদন দিলে আপনি প্রথমবার আপনার 4 ডিজিটের পিন সেট করে প্রবেশ করতে পারবেন।');
          setLoading(false);
          return;
        }

        if (isRegistering) {
          setIsRegistering(false);
          if (!userData.pin || userData.pin.trim() === '' || userData.isPendingPin === true || userData.pinSet === false) {
            setStep('set-initial-pin');
            setError('');
          } else {
            setStep('login-pin');
            setError(`এই মোবাইল নম্বরটি (${userData.phone || phoneNumber}) ইতিমধ্যে নিবন্ধিত রয়েছে। আপনার 4 ডিজিটের পিন দিয়ে লগইন করুন।`);
          }
          setLoading(false);
          return;
        }

        // Direct to initial PIN set or login PIN step
        if (!userData.pin || userData.pin.trim() === '' || userData.isPendingPin === true || userData.pinSet === false) {
          setStep('set-initial-pin');
          setError('');
        } else {
          setStep('login-pin');
        }
      } else {
        if (isRegistering) {
          // Proceed to set PIN step for registration
          setStep('register-pin');
        } else {
          // Login mode: if user does not exist in Firestore or backup, do NOT auto-create nameless user!
          setError('এই মোবাইল নম্বর দিয়ে কোনো নিবন্ধিত অ্যাকাউন্ট পাওয়া যায়নি। নতুন অ্যাকাউন্ট তৈরি করতে "নিবন্ধন করুন" বাটনে ক্লিক করুন।');
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(`সার্ভার সংযোগে ত্রুটি ঘটেছে: ${err?.message || JSON.stringify(err)}। আবার চেষ্টা করুন।`);
    } finally {
      setLoading(false);
    }
  };

  const handleSetInitialPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!foundUser) {
      setError('ব্যবহারকারী খুঁজে পাওয়া যায়নি!');
      return;
    }

    const cleanPin = convertBengaliToEnglishDigits(pin).trim();
    const cleanConfirmPin = convertBengaliToEnglishDigits(confirmPin).trim();

    if (cleanPin.length !== 4 || !/^\d+$/.test(cleanPin)) {
      setError('পিন অবশ্যই 4 ডিজিটের সংখ্যা হতে হবে।');
      return;
    }

    if (cleanPin !== cleanConfirmPin) {
      setError('পিন দুটির মিল নেই!');
      return;
    }

    setLoading(true);
    try {
      const userDocId = foundUser.uid || ('user_' + (normalizePhoneNumber(foundUser.phone) || Date.now().toString()));
      const userRef = doc(db, 'users', userDocId);
      
      const clientDevId = getClientDeviceId();
      const clientFp = getDeviceFingerprint();

      // Check if this user already has an assigned device ID and this phone is unauthorized
      const isNewDeviceBinding = Boolean(foundUser.deviceLockBypassed) || !foundUser.currentDeviceId;
      const isAuthorized = isNewDeviceBinding || isSameDevice(foundUser.currentDeviceId, foundUser.deviceFingerprint, clientDevId, clientFp, foundUser.activeDeviceTokens);

      if (!isAuthorized && foundUser.role !== 'admin') {
        const lockedUserState: User = {
          ...foundUser,
          pin: cleanPin,
          pinSet: true,
          isPendingPin: false,
          approved: true,
          currentDeviceId: foundUser.currentDeviceId,
          deviceFingerprint: foundUser.deviceFingerprint,
          deviceStatus: 'Offline'
        };
        // Update PIN in Firestore so it is stored, but do not re-bind device to unauthorized phone
        await updateDoc(userRef, {
          pin: cleanPin,
          pinSet: true,
          isPendingPin: false,
          approved: true
        });
        setLockedUser(lockedUserState);
        onLoginSuccess(lockedUserState);
        return;
      }

      const existingTokens = Array.isArray(foundUser.activeDeviceTokens) ? foundUser.activeDeviceTokens : [];
      const updatedTokens = Array.from(new Set([...existingTokens, clientDevId, clientFp].filter(Boolean)));
      const updatedFields = {
        pin: cleanPin,
        pinSet: true,
        isPendingPin: false,
        approved: true,
        currentDeviceId: isNewDeviceBinding ? clientDevId : (foundUser.currentDeviceId || clientDevId),
        deviceFingerprint: isNewDeviceBinding ? clientFp : (foundUser.deviceFingerprint || clientFp),
        activeDeviceTokens: updatedTokens,
        isLoggedIn: true,
        deviceStatus: 'Online'
      };

      await setDoc(userRef, updatedFields, { merge: true });

      try {
        await setDoc(doc(db, 'samity_applications', userDocId), updatedFields, { merge: true });
      } catch (eSam) {
        console.warn("Samity app PIN update sync warning:", eSam);
      }

      const updatedUser: User = {
        ...foundUser,
        uid: userDocId,
        ...updatedFields
      };

      setFoundUser(updatedUser);
      onLoginSuccess(updatedUser);
    } catch (err: any) {
      console.error(err);
      setError(`পিন সেটআপ করতে সমস্যা হয়েছে: ${err?.message || JSON.stringify(err)}।`);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterWithPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName || fullName.trim().length < 2) {
      setError('নিবন্ধনের জন্য নাম প্রদান করা বাধ্যতামূলক (খালি নাম গ্রহণযোগ্য নয়)।');
      return;
    }

    if (!phoneNumber || phoneNumber.trim().length < 5) {
      setError('একটি সঠিক মোবাইল নম্বর প্রদান করা বাধ্যতামূলক।');
      return;
    }

    if (!registerPassword || registerPassword.trim().length < 4) {
      setError('সিকিউরিটি পাসওয়ার্ড অবশ্যই কমপক্ষে 4 অক্ষর বা সংখ্যার হতে হবে।');
      return;
    }

    if (registerPassword !== confirmRegisterPassword) {
      setError('পাসওয়ার্ড দুটির মিল নেই! পুনরায় সঠিকভাবে লিখুন।');
      return;
    }

    if (pin.length !== 4 || !/^\d+$/.test(pin)) {
      setError('পিন অবশ্যই 4 ডিজিটের সংখ্যা হতে হবে।');
      return;
    }

    if (pin !== confirmPin) {
      setError('পিন দুটির মিল নেই!');
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = getFormattedPhone(phoneNumber, selectedCountry);
      const normalized = normalizePhoneNumber(formattedPhone) || normalizePhoneNumber(phoneNumber);
      const digitsOnly = convertBengaliToEnglishDigits(phoneNumber).replace(/\D/g, '');

      // Deep multi-candidate check if user already exists in Firestore under any phone format
      const last9Digits = digitsOnly.length >= 9 ? digitsOnly.slice(-9) : '';
      let existingResult = await findUserInFirestoreByPhone(phoneNumber, selectedCountry.code);
      if (!existingResult && formattedPhone) {
        existingResult = await findUserInFirestoreByPhone(formattedPhone, selectedCountry.code);
      }
      if (!existingResult && digitsOnly) {
        existingResult = await findUserInFirestoreByPhone(digitsOnly, selectedCountry.code);
      }
      if (!existingResult && last9Digits.length === 9) {
        existingResult = await findUserInFirestoreByPhone(last9Digits, selectedCountry.code);
      }

      if (existingResult && existingResult.user) {
        const existingUser = existingResult.user;
        setFoundUser(existingUser);
        setIsRegistering(false);
        if (!existingUser.pin || existingUser.isPendingPin === true || existingUser.pinSet === false) {
          setStep('set-initial-pin');
          setError('');
        } else {
          setStep('login-pin');
          setError(`এই মোবাইল নম্বরটি (${existingUser.phone || phoneNumber}) দিয়ে ইতিমধ্যে একটি সদস্য অ্যাকাউন্ট (ID: ${existingUser.memberId || 'N/A'}) নিবন্ধিত রয়েছে! একটি নম্বর দিয়ে আজীবন আর নতুন অ্যাকাউন্ট খোলা যাবে না। আপনার পাসওয়ার্ড ও 4 ডিজিটের পিন দিয়ে লগইন করুন।`);
        }
        setLoading(false);
        return;
      }

      // Create member credentials with Atomic Sequential Serial System (BNB00000001, BNB00000002...)
      const generatedMemberId = await getNextSequentialMemberId();

      const clientDevId = getClientDeviceId();
      const clientFp = getDeviceFingerprint();

      // Direct PIN registration creates active approved user accounts
      const isApproved = true;

      const englishPin = convertBengaliToEnglishDigits(pin);
      
      const userDocId = 'user_' + (normalized || digitsOnly || Date.now().toString());

      const newUser: User = {
        uid: userDocId,
        name: fullName.trim(),
        phone: formattedPhone, // Save standardized international number
        normalizedPhone: normalized,
        memberId: generatedMemberId,
        password: registerPassword.trim(),
        pin: englishPin,
        pinSet: true,
        role: 'user',
        balance: 0, 
        telecomBalance: 0,
        superShopBalance: 0,
        savings: 0, 
        dueLoan: 0,
        lockedBalance: 0,
        pendingBalance: 0,
        createdAt: new Date().toISOString(),
        currentDeviceId: clientDevId,
        deviceFingerprint: clientFp,
        activeDeviceTokens: [clientDevId, clientFp],
        isLoggedIn: true,
        deviceStatus: 'Online',
        approved: isApproved
      };

      // Set user record in Firestore under permanent unique doc ID
      // This ensures cross-device visibility immediately
      await setDoc(doc(db, 'users', userDocId), newUser, { merge: true });

      // Save to local backup storage immediately
      saveUserToLocalBackup(newUser);
      
      if (isApproved) {
        // Auto-approval enabled: Log in immediately!
        onLoginSuccess(newUser);
      } else {
        // Manual approval required: Navigate to pending-approval screen
        setFoundUser(newUser);
        setStep('pending-approval');
      }
    } catch (err: any) {
      console.error(err);
      setError(`অ্যাকাউন্ট তৈরিতে সমস্যা হয়েছে: ${err?.message || JSON.stringify(err)}। আবার চেষ্টা করুন।`);
    } finally {
      setLoading(false);
    }
  };

  if (lockedUser) {
    return (
      <DeviceLockScreen
        user={lockedUser}
        deviceId={getClientDeviceId()}
        onLogout={() => {
          setLockedUser(null);
          setFoundUser(null);
          setLoginPin('');
          setStep('info');
        }}
        appConfig={appConfig}
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-start sm:justify-center min-h-screen bg-slate-50/80 px-3.5 pt-4 pb-28 sm:pb-8 overflow-y-auto font-sans text-slate-900" id="login-container">
      
      {/* Floating Language & Theme control bar */}
      <div className="w-full max-w-md flex justify-between items-center px-1 mb-3 relative z-20 shrink-0">
        <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-800 bg-white/90 px-3 py-1 rounded-full border border-slate-200/80 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>BNB সিকিউর গেটওয়ে</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onLanguageChange && onLanguageChange(appLanguage === 'bn' ? 'en' : 'bn')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-800 rounded-full text-xs font-black shadow-2xs hover:bg-slate-50 cursor-pointer transition active:scale-95"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>{appLanguage === 'bn' ? 'English' : 'বাংলা'}</span>
          </button>

          <button
            type="button"
            onClick={() => onThemeToggle && onThemeToggle()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-800 rounded-full text-xs font-black shadow-2xs hover:bg-slate-50 cursor-pointer transition active:scale-95"
          >
            <span>{darkMode ? '☀️ Light' : '🌙 Dark'}</span>
          </button>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm sm:max-w-md bg-white border border-slate-200/90 shadow-xl rounded-3xl overflow-hidden"
      >
        {/* Banner with Brand */}
        <div className="bg-gradient-to-br from-emerald-800 via-emerald-900 to-slate-950 px-4 py-4 text-white text-center relative flex flex-col items-center justify-center">
          <div className="absolute top-3 right-3 bg-white/15 backdrop-blur-md text-emerald-200 text-[10px] px-2.5 py-0.5 rounded-full font-mono font-black border border-white/20">
            v2.0
          </div>
          {/* Logo container - Sleek, large, no white box border, naturally integrated */}
          <div className="flex items-center justify-center mb-2 shrink-0">
            {appConfig?.logoUrl ? (
              <img 
                src={appConfig.logoUrl} 
                alt="BNB Logo" 
                className="h-16 sm:h-20 w-auto max-w-[140px] object-contain drop-shadow-md" 
                referrerPolicy="no-referrer" 
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center filter drop-shadow-md">
                <BNBLogo size={70} variant="white" />
              </div>
            )}
          </div>
          <div className="space-y-1 text-center">
            <h1 className="text-base sm:text-lg font-black font-sans tracking-wide leading-tight text-center text-white drop-shadow-xs">
              <span className="text-emerald-300 font-extrabold mr-1.5">BNB</span>
              <span className="tracking-wider uppercase">BUSINESS NETWORK</span>
              <span className="block text-emerald-200 text-xs font-bold tracking-widest mt-0.5">BANGLADESH</span>
            </h1>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/30 border border-white/15 text-emerald-100 text-[11px] font-bold backdrop-blur-xs shadow-inner">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>BNB ম্যানেজমেন্ট কোম্পানি ইনভেস্টর পোর্টাল</span>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 bg-white">
          <AnimatePresence mode="wait">
            {isAdminLogin ? (
              <motion.div
                key="admin-login-step"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="space-y-3.5"
              >
                <div className="text-center mb-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-black mb-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    <span>অ্যাডমিন কন্ট্রোল গেটওয়ে</span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">
                    সফটওয়্যার পরিচালনার জন্য আপনার এডমিন ইমেইল ও পাসওয়ার্ড দিন
                  </p>
                </div>

                <form onSubmit={handleAdminLoginSubmit} className="space-y-3">
                  {error && (
                    <div className="bg-rose-50 text-rose-700 border border-rose-200 text-xs p-3 rounded-2xl font-bold leading-relaxed flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1">অ্যাডমিন জিমেইল / মোবাইল নম্বর</label>
                    <input
                      type="text"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@bnb.com বা মোবাইল নম্বর"
                      className="block w-full px-3.5 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 text-xs transition-all font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1">অ্যাডমিন সিকিউরিটি পাসওয়ার্ড / পিন</label>
                    <input
                      type="password"
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="••••••••"
                      className="block w-full px-3.5 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 text-xs transition-all font-mono tracking-widest font-black"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-black py-3 px-4 rounded-2xl text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-1.5 mt-2 disabled:opacity-75 cursor-pointer active:scale-98"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'অ্যাডমিন প্যানেলে প্রবেশ করুন'
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsAdminLogin(false);
                      setError('');
                    }}
                    className="w-full border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-2.5 rounded-2xl text-xs transition-all cursor-pointer"
                  >
                    গ্রাহক লগইনে ফিরে যান (Back to User Login)
                  </button>
                </form>
              </motion.div>
            ) : step === 'info' ? (
              <motion.div
                key="info-step"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-3.5"
              >
                {/* Tab selector */}
                <div className="flex bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => { setIsRegistering(false); setError(''); }}
                    className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${!isRegistering ? 'bg-white shadow-sm text-emerald-900 border border-slate-200/70' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      <LogIn className="w-4 h-4 text-emerald-700" />
                      লগইন করুন
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsRegistering(true); setError(''); }}
                    className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${isRegistering ? 'bg-white shadow-sm text-emerald-900 border border-slate-200/70' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      <UserPlus className="w-4 h-4 text-emerald-700" />
                      নিবন্ধন করুন
                    </span>
                  </button>
                </div>

                <form onSubmit={handleNextStep} className="space-y-3">
                  {error && (
                    <div className="bg-rose-50 text-rose-700 border border-rose-200 text-xs p-3 rounded-2xl font-bold leading-relaxed">
                      <div className="flex items-start gap-1.5">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                        <span>{error}</span>
                      </div>
                      {!isRegistering && (error.includes('নিবন্ধিত অ্যাকাউন্ট পাওয়া যায়নি') || error.includes('খুঁজে পাওয়া যায়নি')) && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsRegistering(true);
                            setError('');
                          }}
                          className="mt-2.5 w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>👉 নতুন অ্যাকাউন্ট নিবন্ধন করতে এখানে ক্লিক করুন</span>
                        </button>
                      )}
                    </div>
                  )}

                  {isRegistering && (
                    <div>
                      <label className="block text-xs font-extrabold text-slate-800 mb-1">আপনার পূর্ণ নাম (বাংলা বা ইংরেজি) *</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <UserIcon className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="উদাঃ মোঃ মোজাম্মেল হক"
                          className="block w-full pl-10 pr-3.5 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 text-xs font-bold transition-all"
                        />
                      </div>
                    </div>
                  )}

                  {/* Country Selection Dropdown */}
                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1">দেশ নির্বাচন করুন (Select Country)</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-xs transition-all focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 text-slate-900 cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-base leading-none">{selectedCountry.flag}</span>
                          <span className="font-extrabold text-slate-900 text-xs">{selectedCountry.name}</span>
                        </span>
                        <span className="flex items-center gap-1 font-black text-emerald-800 font-mono text-xs">
                          {selectedCountry.code !== '+' ? selectedCountry.code : 'অন্যান্য'}
                          <ChevronDown className="w-4 h-4 text-slate-500 ml-0.5" />
                        </span>
                      </button>

                      <AnimatePresence>
                        {showCountryDropdown && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="absolute z-50 mt-1.5 w-full max-h-60 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                          >
                            <div className="p-2 border-b border-slate-100 flex items-center bg-slate-50 gap-2">
                              <Search className="w-4 h-4 text-slate-400 shrink-0" />
                              <input
                                type="text"
                                placeholder="দেশ বা ডায়াল কোড খুঁজুন..."
                                value={countrySearch}
                                onChange={(e) => setCountrySearch(e.target.value)}
                                className="w-full bg-transparent border-none text-xs focus:outline-none text-slate-900 placeholder-slate-400 font-bold"
                              />
                            </div>

                            <div className="overflow-y-auto max-h-40 divide-y divide-slate-100">
                              {countries
                                .filter(
                                  (c) =>
                                    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                                    c.code.includes(countrySearch)
                                )
                                .map((c) => (
                                  <button
                                    key={c.name}
                                    type="button"
                                    onClick={() => {
                                      setSelectedCountry(c);
                                      setPhoneNumber('');
                                      setShowCountryDropdown(false);
                                      setCountrySearch('');
                                    }}
                                    className={`w-full flex items-center justify-between px-3.5 py-2 text-left text-xs transition duration-150 hover:bg-emerald-50/70 cursor-pointer ${
                                      selectedCountry.name === c.name ? 'bg-emerald-50 text-emerald-900 font-extrabold' : 'text-slate-700 font-semibold'
                                    }`}
                                  >
                                    <span className="flex items-center gap-2">
                                      <span className="text-base leading-none">{c.flag}</span>
                                      <span>{c.name}</span>
                                    </span>
                                    <span className="font-mono font-black text-emerald-800">
                                      {c.code}
                                    </span>
                                  </button>
                                ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1">
                      মোবাইল নম্বর ({selectedCountry.name}) *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-mono text-xs font-black">
                        {selectedCountry.code !== '+' ? selectedCountry.code : ''}
                      </div>
                      <input
                        type="tel"
                        required
                        maxLength={selectedCountry.maxLength || 15}
                        value={phoneNumber}
                        onChange={(e) => {
                          const converted = convertBengaliToEnglishDigits(e.target.value);
                          setPhoneNumber(converted.replace(/\D/g, ''));
                        }}
                        placeholder={`উদাঃ ${selectedCountry.placeholder}`}
                        style={{ paddingLeft: selectedCountry.code !== '+' ? `${(selectedCountry.code.length * 8.5) + 20}px` : '14px' }}
                        className="block w-full pr-3.5 py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 text-xs font-black transition-all tracking-wider"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-1">
                      {selectedCountry.code === '+880' 
                        ? 'সচল 10 বা 11 ডিজিটের বাংলাদেশি মোবাইল নম্বর প্রদান করুন'
                        : `সঠিক আন্তর্জাতিক মোবাইল নম্বর প্রদান করুন (${selectedCountry.name})`}
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-black py-3 px-4 rounded-2xl text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 mt-1 disabled:opacity-75 cursor-pointer active:scale-98"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>এগিয়ে যান (পরবর্তী ধাপ)</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Special Notice in Registration mode */}
                  {isRegistering && (
                    <div className="mt-2.5 p-3 rounded-2xl bg-amber-50/90 border border-amber-200 text-center" id="access-policy-notice">
                      <p className="text-[11px] font-black text-amber-900 flex items-center justify-center gap-1 mb-1 font-sans">
                        <span>📢</span> বিশেষ নোটিশ (Special Notice)
                      </p>
                      <p className="text-xs leading-relaxed font-sans font-bold text-slate-800">
                        বর্তমানে অ্যাপটি শুধুমাত্র পরিচিত ব্যক্তিদের জন্য। রিকোয়েস্ট যাচাই করে অনুমোদন করা হবে। সরকারি প্রক্রিয়া সম্পন্ন হলে উন্মুক্ত করা হবে।
                      </p>
                    </div>
                  )}
                </form>
              </motion.div>
            ) : step === 'set-initial-pin' ? (
              <motion.div
                key="set-initial-pin-step"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-3"
              >
                <div className="text-center mb-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-black mb-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>4 ডিজিট পিন সেটআপ</span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium">
                    স্বাগতম <strong>{foundUser?.name}</strong>! অ্যাকাউন্টে প্রবেশের জন্য 4 ডিজিট পিন কোড সেট করুন।
                  </p>
                </div>

                <form onSubmit={handleSetInitialPin} className="space-y-3">
                  {error && (
                    <div className="bg-rose-50 text-rose-700 border border-rose-200 text-xs p-2.5 rounded-2xl font-bold">
                      {error}
                    </div>
                  )}

                  <div className="bg-emerald-50/70 border border-emerald-200 p-2.5 rounded-2xl text-xs space-y-0.5 text-slate-700 flex justify-between items-center">
                    <div>
                      <p className="font-extrabold text-slate-900">👤 {foundUser?.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono">📞 {foundUser?.phone}</p>
                    </div>
                    <span className="font-mono text-emerald-900 bg-white px-2.5 py-1 rounded-xl border border-emerald-200 font-black text-xs">
                      🆔 {foundUser?.memberId}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-800 mb-1">
                        4 ডিজিট নতুন পিন *
                      </label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        pattern="\d{4}"
                        value={pin}
                        onChange={(e) => {
                          const converted = convertBengaliToEnglishDigits(e.target.value);
                          setPin(converted.replace(/\D/g, ''));
                        }}
                        placeholder="••••"
                        className="block w-full py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-center text-lg font-mono font-black tracking-widest text-emerald-900 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-800 mb-1">
                        পুনরায় পিন নিশ্চিত করুন *
                      </label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        pattern="\d{4}"
                        value={confirmPin}
                        onChange={(e) => {
                          const converted = convertBengaliToEnglishDigits(e.target.value);
                          setConfirmPin(converted.replace(/\D/g, ''));
                        }}
                        placeholder="••••"
                        className="block w-full py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-center text-lg font-mono font-black tracking-widest text-emerald-900 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2.5 pt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('info');
                        setPin('');
                        setConfirmPin('');
                        setError('');
                      }}
                      className="w-1/3 py-2.5 border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-2xl text-xs transition cursor-pointer"
                    >
                      পেছনে
                    </button>
                    <button
                      type="submit"
                      disabled={loading || pin.length !== 4 || confirmPin.length !== 4}
                      className="w-2/3 bg-emerald-800 hover:bg-emerald-900 text-white font-black py-2.5 rounded-2xl text-xs sm:text-sm transition flex items-center justify-center cursor-pointer disabled:opacity-50 shadow-md active:scale-98"
                    >
                      {loading ? 'সংরক্ষণ...' : 'সেট করুন & প্রবেশ করুন'}
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : step === 'login-pin' ? (
              <motion.div
                key="login-pin-step"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-3"
              >
                {/* Visual Step Indicator - 2 Steps */}
                <div className="flex items-center justify-between px-4 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-extrabold">
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">✓</span>
                    <span>1. মোবাইল নম্বর</span>
                  </div>
                  <span className="text-slate-300 font-bold">➔</span>
                  <div className="flex items-center gap-1.5 text-emerald-900 font-black px-3 py-1 rounded-xl bg-emerald-100/90 border border-emerald-300 shadow-2xs">
                    <span className="w-4 h-4 rounded-full bg-emerald-800 text-white flex items-center justify-center text-[10px]">2</span>
                    <span>2. সিকিউরিটি পিন</span>
                  </div>
                </div>

                {/* Title */}
                <div className="text-center">
                  <h3 className="text-sm font-black text-slate-900">
                    ধাপ 2: 4 ডিজিট সিকিউরিটি পিন দিন
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    আপনার অ্যাকাউন্টের 4 ডিজিট ট্রানজেকশন পিন কোড চাপুন
                  </p>
                </div>

                {/* Error Banner - FIXED HEIGHT TO PREVENT KEYPAD SHIFTING */}
                <div className="h-10 flex items-center justify-center w-full">
                  {error ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3 py-1.5 rounded-2xl font-bold flex items-center gap-1.5 w-full justify-center shadow-2xs"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                      <span className="truncate">{error}</span>
                    </motion.div>
                  ) : null}
                </div>

                {/* User Info & Remaining Chances Badge */}
                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200/80 p-3 rounded-2xl text-xs space-y-1 shadow-2xs">
                  <div className="flex justify-between items-center">
                    <span className="font-black text-slate-900 text-sm">👤 {foundUser?.name || 'সদস্য'}</span>
                    <span className="font-mono text-xs bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-lg border border-purple-200 font-black">
                      🆔 {foundUser?.memberId}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-xs font-bold text-slate-600">📞 {foundUser?.phone}</span>
                    <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-black flex items-center gap-1 ${
                      (3 - (lockoutInfo.pinAttempts || 0)) <= 1 
                        ? 'bg-rose-100 text-rose-700 border border-rose-300 animate-pulse' 
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}>
                      🛡️ সুযোগ বাকি: {3 - (lockoutInfo.pinAttempts || 0)} বার
                    </span>
                  </div>
                </div>

                {/* 4 PIN Dots */}
                <div className="flex justify-center items-center gap-4 py-2">
                  {[0, 1, 2, 3].map((index) => (
                    <motion.div
                      key={index}
                      animate={error ? { x: [0, -4, 4, -4, 4, 0] } : {}}
                      transition={{ duration: 0.3 }}
                      className={`w-5 h-5 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                        index < loginPin.length
                          ? 'bg-emerald-700 border-emerald-700 shadow-sm scale-110'
                          : 'bg-slate-100 border-slate-300'
                      }`}
                    >
                      {index < loginPin.length && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </motion.div>
                  ))}
                </div>

                {/* Tactile Keypad */}
                <div className="grid grid-cols-3 gap-2 w-full pt-1">
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
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.94 }}
                      onClick={() => {
                        if (key.en === 'Clear') {
                          handleLoginPinClear();
                        } else if (key.en === 'Backspace') {
                          handleLoginPinBackspace();
                        } else {
                          handleLoginPinPress(key.en);
                        }
                      }}
                      className={`h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer border shadow-2xs select-none ${
                        key.isAction
                          ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200 font-bold'
                          : 'bg-white border-slate-200 text-slate-900 hover:bg-emerald-50 hover:border-emerald-300 font-black'
                      }`}
                    >
                      <span className={`font-bold ${key.isAction ? 'text-xs' : 'text-base font-mono'}`}>{key.bd}</span>
                    </motion.button>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('info');
                      setLoginPin('');
                      setError('');
                    }}
                    className="w-1/3 py-2.5 border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-2xl text-xs transition-all cursor-pointer text-center"
                  >
                    {appLanguage === 'en' ? 'Back' : 'পেছনে যান'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVerifyPinStep(loginPin)}
                    disabled={loading || loginPin.length !== 4}
                    className="w-2/3 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-black py-2.5 px-3 rounded-2xl text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50 active:scale-98"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{appLanguage === 'en' ? 'Login Now' : 'লগইন সম্পন্ন করুন'}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* WhatsApp Support Box */}
                <div
                  onClick={() => {
                    setStep('reset-pin');
                    setError('');
                  }}
                  className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-2xl cursor-pointer hover:bg-slate-100 transition active:scale-98 text-center flex items-center justify-between text-xs"
                >
                  <span className="font-bold text-slate-700">🔑 পিন ভুলে গেছেন? এডমিন সহায়তা</span>
                  <span className="font-mono text-emerald-800 font-black">📱 01865911728</span>
                </div>
              </motion.div>
            ) : step === 'lockout' ? (
              <LockoutScreen
                identifier={foundUser?.phone || phoneNumber}
                initialRemainingSeconds={lockoutInfo.remainingSeconds}
                reason={lockoutInfo.reason}
                onUnlocked={() => {
                  setStep('info');
                  setError('');
                }}
                onBack={() => {
                  setStep('info');
                  setFoundUser(null);
                  setLoginPin('');
                  setLoginPassword('');
                  setError('');
                }}
                appLanguage={appLanguage}
              />
            ) : step === 'reset-pin' ? (
              <motion.div
                key="reset-pin-step"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-3 text-center"
              >
                <div className="mx-auto w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center border border-amber-300">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">স্বয়ংক্রিয় পিন/পাসওয়ার্ড রিসেট বন্ধ রয়েছে</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium mt-1">
                    একবার পাসওয়ার্ড বা পিন সেট করার পর ইউজার নিজে পরিবর্তন করতে পারবেন না।
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl text-xs font-black text-amber-950 space-y-1 text-center">
                  <p className="text-amber-800 text-xs font-bold">📢 রিসেট করতে হোয়াটসঅ্যাপে মেসেজ দিন</p>
                  <p className="text-sm font-mono text-emerald-800 font-black tracking-wider">
                    📱 01865911728
                  </p>
                  <p className="text-[11px] text-slate-500 font-semibold">
                    এডমিন প্যানেল থেকে আপনার পাসওয়ার্ড বা পিন রিসেট করে দেওয়া হবে।
                  </p>
                </div>

                {foundUser && (
                  <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-2xl text-left text-xs text-slate-700 space-y-0.5 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-900">👤 {foundUser.name || 'সদস্য'}</p>
                      <p className="text-[11px] text-slate-500 font-mono">📞 {foundUser.phone}</p>
                    </div>
                    <span className="font-mono text-slate-900 font-black text-xs bg-white px-2.5 py-1 rounded-xl border border-slate-200">
                      🆔 {foundUser.memberId}
                    </span>
                  </div>
                )}

                <a
                  href={`https://wa.me/8801865911728?text=${encodeURIComponent(`হ্যালো এডমিন, আমার পাসওয়ার্ড/পিন রিসেট করা প্রয়োজন।\nসদস্য নাম: ${foundUser?.name || ''}\nসদস্য আইডি: ${foundUser?.memberId || ''}\nমোবাইল: ${foundUser?.phone || ''}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs sm:text-sm rounded-2xl transition cursor-pointer shadow-md flex items-center justify-center gap-2 active:scale-98"
                >
                  💬 হোয়াটসঅ্যাপে মেসেজ দিন (01865911728)
                </a>

                <button
                  type="button"
                  onClick={() => {
                    setStep('login-pin');
                    setError('');
                  }}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition cursor-pointer"
                >
                  {appLanguage === 'en' ? 'Back' : 'পেছনে যান (লগইন পৃষ্ঠা)'}
                </button>
              </motion.div>
            ) : step === 'pending-approval' ? (
              <motion.div
                key="pending-approval-step"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-3 text-center"
              >
                <div className="mx-auto w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center shadow-inner border border-amber-200">
                  <ShieldCheck className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="text-sm sm:text-base font-black text-slate-900">অ্যাকাউন্ট ভেরিফিকেশন অপেক্ষমান</h3>
                
                <p className="text-xs text-slate-700 leading-relaxed text-justify px-1 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  প্রিয় সমবায় সদস্য, আপনার অ্যাকাউন্টটি সফলভাবে তৈরি হয়েছে! অ্যাডমিন আবেদনটি অনুমোদন করার সাথে সাথে আপনি আপনার মোবাইল নম্বর ও পিন কোড দিয়ে এই অ্যাপে লগইন করতে পারবেন।
                </p>

                <div className="bg-amber-50/70 border border-amber-200 p-3 rounded-2xl text-left text-xs space-y-1 text-slate-700">
                  <p>👤 <strong>সদস্য নামঃ</strong> {foundUser?.name}</p>
                  <p>🆔 <strong>সদস্য আইডিঃ</strong> <span className="font-mono text-slate-900 font-bold">{foundUser?.memberId}</span></p>
                  <p>📞 <strong>মোবাইলঃ</strong> <span className="font-mono">{foundUser?.phone}</span></p>
                  <p className="flex items-center gap-1.5 mt-1 font-bold text-amber-700 text-xs">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                    অবস্থাঃ পেন্ডিং (অ্যাডমিন অনুমোদনের অপেক্ষায়)
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setStep('info');
                    setFoundUser(null);
                    setPhoneNumber('');
                    setFullName('');
                    setPin('');
                    setConfirmPin('');
                    setLoginPin('');
                    setLoginPassword('');
                    setError('');
                  }}
                  className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-bold py-2.5 rounded-2xl text-xs transition-all shadow-md cursor-pointer active:scale-98"
                >
                  লগইন পেজে ফিরে যান
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="pin-step"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-3"
              >
                <div className="text-center mb-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-black mb-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>পাসওয়ার্ড ও পিন সেট করুন</span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium">
                    অ্যাকাউন্ট তৈরি ও নিরাপদে লগইন করার জন্য পাসওয়ার্ড ও 4 ডিজিট পিন দিন।
                  </p>
                </div>

                <form onSubmit={handleRegisterWithPin} className="space-y-2.5">
                  {error && (
                    <div className="bg-rose-50 text-rose-700 border border-rose-200 text-xs p-2.5 rounded-2xl font-bold">
                      {error}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1">
                      সিকিউরিটি পাসওয়ার্ড (কমপক্ষে 4 অক্ষর/সংখ্যা) *
                    </label>
                    <div className="relative">
                      <input
                        type={showRegisterPassword ? "text" : "password"}
                        required
                        minLength={4}
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
                        placeholder="পাসওয়ার্ড লিখুন"
                        className="block w-full py-2.5 px-3.5 pr-10 bg-white border-2 border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1">
                      পাসওয়ার্ড নিশ্চিত করুন *
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmRegisterPassword ? "text" : "password"}
                        required
                        minLength={4}
                        value={confirmRegisterPassword}
                        onChange={(e) => setConfirmRegisterPassword(e.target.value)}
                        placeholder="পুনরায় পাসওয়ার্ড লিখুন"
                        className="block w-full py-2.5 px-3.5 pr-10 bg-white border-2 border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmRegisterPassword(!showConfirmRegisterPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showConfirmRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-800 mb-1">
                        4 ডিজিট পিন *
                      </label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        pattern="\d{4}"
                        value={pin}
                        onChange={(e) => {
                          const converted = convertBengaliToEnglishDigits(e.target.value);
                          setPin(converted.replace(/\D/g, ''));
                        }}
                        placeholder="••••"
                        className="block w-full py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-center text-lg font-mono font-black tracking-widest text-emerald-900 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-800 mb-1">
                        পুনরায় পিন *
                      </label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        pattern="\d{4}"
                        value={confirmPin}
                        onChange={(e) => {
                          const converted = convertBengaliToEnglishDigits(e.target.value);
                          setConfirmPin(converted.replace(/\D/g, ''));
                        }}
                        placeholder="••••"
                        className="block w-full py-2.5 bg-white border-2 border-slate-200 rounded-2xl text-center text-lg font-mono font-black tracking-widest text-emerald-900 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2.5 pt-1.5">
                    <button
                      type="button"
                      onClick={() => setStep('info')}
                      className="w-1/3 py-2.5 border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-2xl text-xs transition cursor-pointer"
                    >
                      পেছনে
                    </button>
                    <button
                      type="submit"
                      disabled={loading || pin.length !== 4 || confirmPin.length !== 4 || registerPassword.length < 4}
                      className="w-2/3 bg-emerald-800 hover:bg-emerald-900 text-white font-black py-2.5 rounded-2xl text-xs sm:text-sm transition flex items-center justify-center cursor-pointer disabled:opacity-50 shadow-md active:scale-98"
                    >
                      {loading ? 'সংরক্ষণ...' : 'নিবন্ধন সম্পন্ন করুন'}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer info */}
        <div className="bg-slate-50 border-t border-slate-100 px-4 py-2.5 text-center">
          <p className="text-[10px] text-slate-500 font-sans tracking-wide font-medium">
            © {new Date().getFullYear()} BNB Business Network Bangladesh. সুরক্ষিত ও এনক্রিপ্টেড।
          </p>
        </div>
      </motion.div>
    </div>
  );
}
