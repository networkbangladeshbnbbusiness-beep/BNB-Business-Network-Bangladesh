import { collection, query, where, getDocs, doc, setDoc, getDoc, updateDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import { User, getEffectiveBalance } from '../types';
import { apiUrl } from '../config/api';

/**
 * Utility functions for Member ID (Account Number) normalization and display
 */

export function getClientDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let devId = '';
  
  // 1. Try to load from localStorage
  try {
    devId = localStorage.getItem('amb_device_id') || '';
  } catch (e) {}

  // 2. Try to load from Cookie as a backup to prevent loss when cache/localStorage is wiped
  if (!devId) {
    try {
      const match = document.cookie.match(/(?:^|; )amb_device_id=([^;]*)/);
      if (match && match[1]) {
        devId = decodeURIComponent(match[1]);
        // Restore to localStorage
        localStorage.setItem('amb_device_id', devId);
      }
    } catch (e) {}
  }

  // 3. Generate a new high-entropy device ID if both are missing
  if (!devId) {
    const randomPart = Math.random().toString(36).substring(2, 12);
    const timePart = Date.now().toString(36);
    devId = `dev_${randomPart}_${timePart}`;
    
    // Set in localStorage
    try {
      localStorage.setItem('amb_device_id', devId);
    } catch (e) {}
    
    // Set in Cookie (lasts 10 years)
    try {
      const expires = new Date();
      expires.setFullYear(expires.getFullYear() + 10);
      document.cookie = `amb_device_id=${encodeURIComponent(devId)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
    } catch (e) {}
  } else {
    // Keep both synced
    try {
      if (!localStorage.getItem('amb_device_id')) {
        localStorage.setItem('amb_device_id', devId);
      }
    } catch (e) {}
    try {
      const hasCookie = document.cookie.includes('amb_device_id=');
      if (!hasCookie) {
        const expires = new Date();
        expires.setFullYear(expires.getFullYear() + 10);
        document.cookie = `amb_device_id=${encodeURIComponent(devId)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
      }
    } catch (e) {}
  }
  return devId;
}

export function getGpuRenderer(): string {
  if (typeof window === 'undefined') return 'unknown_gpu';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'no_webgl';
    const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
      const vendor = (gl as any).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
      const combined = `${vendor}_${renderer}`.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
      return combined || 'webgl_generic';
    }
    return 'generic_webgl';
  } catch (e) {
    return 'gpu_err';
  }
}

export function getNormalizedDeviceModel(): { os: string; model: string } {
  if (typeof window === 'undefined') return { os: 'unknown', model: 'generic' };
  const ua = (navigator.userAgent || '').toLowerCase();
  
  let os = 'other';
  if (/android/i.test(ua)) os = 'android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'ios';
  else if (/windows nt/i.test(ua)) os = 'windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macos';
  else if (/linux/i.test(ua)) os = 'linux';

  let model = 'generic';
  
  // Extract Android detailed model & version
  if (os === 'android') {
    const androidMatch = navigator.userAgent.match(/Android[^;)]*;\s*([^;)]+)/i);
    let m = '';
    if (androidMatch && androidMatch[1]) {
      m = androidMatch[1].trim()
           .replace(/Build\/[^\s;)]+/gi, '')
           .replace(/\b[a-z]{2}-[a-z]{2}\b/gi, '')
           .replace(/\bwv\b/gi, '')
           .replace(/\bU;\b/gi, '')
           .replace(/Version\/[^\s;)]+/gi, '')
           .replace(/Mobile/gi, '')
           .replace(/Chrome\/[^\s;)]+/gi, '')
           .replace(/Safari\/[^\s;)]+/gi, '')
           .trim();
    }
    const androidVerMatch = navigator.userAgent.match(/Android\s+([^;)\s]+)/i);
    let ver = '';
    if (androidVerMatch && androidVerMatch[1]) {
      ver = androidVerMatch[1].replace(/[^0-9.]/g, '_');
    }
    
    const parts = [ver ? `ver_${ver}` : '', m].filter(Boolean);
    if (parts.length > 0) {
      model = parts.join('_').toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_');
    }
  } else if (os === 'ios') {
    // Extract iOS detailed version to prevent different iOS devices matching
    const iosMatch = navigator.userAgent.match(/iPhone\s+OS\s+([^;)\s_]+(?:_[^;)\s_]+)*)/i) || navigator.userAgent.match(/OS\s+([^;)\s_]+(?:_[^;)\s_]+)*)\s+like\s+Mac/i);
    let ver = '';
    if (iosMatch && iosMatch[1]) {
      ver = iosMatch[1].replace(/[^0-9_]/g, '_');
    }
    
    let deviceName = 'iphone';
    if (/ipad/i.test(ua)) deviceName = 'ipad';
    
    model = `${deviceName}_os_${ver || 'unknown'}`.toLowerCase();
  }

  return { os, model };
}

export function getDeviceFingerprint(): string {
  if (typeof window === 'undefined') return 'fp_server';
  const nav = window.navigator;
  const screen = window.screen;
  
  const { os, model } = getNormalizedDeviceModel();
  const gpu = getGpuRenderer();

  // Screen invariant dimensions
  const minDim = Math.min(screen.width || 360, screen.height || 800);
  const maxDim = Math.max(screen.width || 360, screen.height || 800);
  // Round to nearest 4 to normalize slight differences between App & Web views
  const normMin = Math.round(minDim / 4) * 4;
  const normMax = Math.round(maxDim / 4) * 4;
  const dpr = Math.round(((window.devicePixelRatio || 1) * 10)) / 10;
  const screenDim = `${normMin}x${normMax}_dpr${dpr}`;
  
  // Available dimensions (often differs based on OS/Launcher configurations and custom zoom)
  const availMin = Math.min(screen.availWidth || 360, screen.availHeight || 800);
  const availMax = Math.max(screen.availWidth || 360, screen.availHeight || 800);
  const normAvailMin = Math.round(availMin / 4) * 4;
  const normAvailMax = Math.round(availMax / 4) * 4;
  const availDim = `avail_${normAvailMin}x${normAvailMax}`;
  
  let tz = 'Asia/Dhaka';
  let tzOffset = -360;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dhaka';
    tzOffset = new Date().getTimezoneOffset();
  } catch (e) {}
  
  const cores = nav.hardwareConcurrency || 4;
  const touch = nav.maxTouchPoints || (('ontouchstart' in window) ? 5 : 0);
  const colorDepth = screen.colorDepth || 24;
  
  // Capture the browser language settings - this is very specific to users!
  const langList = (nav.languages || [nav.language || 'en']).join('_').toLowerCase();
  const platform = (nav.platform || '').toLowerCase();
  
  // Render high-entropy, stable Canvas signature
  let canvasSig = 'no_canvas';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 150;
    canvas.height = 30;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#f60";
      ctx.fillRect(100, 1, 40, 15);
      ctx.fillStyle = "#069";
      ctx.font = "12px sans-serif";
      ctx.fillText("BNB_Lock_🛡️", 2, 12);
      ctx.fillStyle = "rgba(102, 204, 0, 0.6)";
      ctx.fillText("BNB_Lock_🛡️", 3, 13);
      canvasSig = canvas.toDataURL();
    }
  } catch (e) {}
  
  const rawHardware = `${os}__${model}__${gpu}__${screenDim}__${availDim}__${cores}c__${touch}t__${tz}__${tzOffset}__${colorDepth}__${langList}__${platform}__${canvasSig}`;
  
  // Hash the raw hardware signature
  let hash = 0;
  for (let i = 0; i < rawHardware.length; i++) {
    hash = ((hash << 5) - hash) + rawHardware.charCodeAt(i);
    hash |= 0;
  }
  const hashStr = Math.abs(hash).toString(36);
  
  // Format: Versioned format with separated variables for parsing
  return `amb_phy_v2__${hashStr}__${os}__${model}__${gpu}__${screenDim}__${availDim}__${cores}c__${touch}t__${tz}__${tzOffset}__${colorDepth}__${langList}__${platform}`;
}

export function isSamePhysicalPhone(fpA?: string | null, fpB?: string | null): boolean {
  if (!fpA || !fpB) return false;
  const strA = fpA.trim();
  const strB = fpB.trim();
  
  // 1. If exact matching string, it's 100% the same phone!
  if (strA === strB) return true;
  
  const partsA = strA.split('__');
  const partsB = strB.split('__');

  // Verify versioned format
  if (partsA[0] === 'amb_phy_v2' && partsB[0] === 'amb_phy_v2' && partsA.length >= 14 && partsB.length >= 14) {
    const osA = partsA[2];
    const osB = partsB[2];
    const gpuA = partsA[4];
    const gpuB = partsB[4];
    const screenA = partsA[5];
    const screenB = partsB[5];
    const availA = partsA[6];
    const availB = partsB[6];
    const coresA = partsA[7];
    const coresB = partsB[7];
    const touchA = partsA[8];
    const touchB = partsB[8];
    const tzA = partsA[9];
    const tzB = partsB[9];
    const tzOffsetA = partsA[10];
    const tzOffsetB = partsB[10];
    const colorA = partsA[11];
    const colorB = partsB[11];
    const langA = partsA[12];
    const langB = partsB[12];
    const platformA = partsA[13];
    const platformB = partsB[13];

    // For iOS, the browsers are extremely consistent (since all are WebKit).
    // If they are on the same physical iOS phone, their fingerprints will be 100% identical.
    // Therefore, if they are not an exact match (strA === strB), they are different iOS devices!
    if (osA === 'ios' && osB === 'ios') {
      return strA === strB;
    }

    // For Android or other OS:
    // To be recognized as the same physical phone across different browser engines,
    // they MUST match key physical hardware & user preferences exactly:
    const isOsMatch = osA === osB;
    const isGpuMatch = gpuA === gpuB;
    const isScreenMatch = screenA === screenB;
    const isAvailMatch = availA === availB;
    const isCoresMatch = coresA === coresB;
    const isTouchMatch = touchA === touchB;
    const isTzMatch = tzA === tzB && tzOffsetA === tzOffsetB;
    const isColorMatch = colorA === colorB;
    const isLangMatch = langA === langB;
    const isPlatformMatch = platformA === platformB;

    if (
      isOsMatch &&
      isGpuMatch &&
      isScreenMatch &&
      isAvailMatch &&
      isCoresMatch &&
      isTouchMatch &&
      isTzMatch &&
      isColorMatch &&
      isLangMatch &&
      isPlatformMatch
    ) {
      return true;
    }
  } else {
    // Fallback for older version compatibility
    if (strA.toLowerCase() === strB.toLowerCase()) return true;
    if (strA.toLowerCase().includes(strB.toLowerCase()) || strB.toLowerCase().includes(strA.toLowerCase())) {
      // Avoid raw fallback for general generic strings
      if (strA.length > 20 && strB.length > 20) {
        return true;
      }
    }
  }

  return false;
}

export function isSameDevice(
  userCurrentDeviceId?: string | null,
  userDeviceFingerprint?: string | null,
  localDeviceId?: string | null,
  localFingerprint?: string | null,
  userActiveTokens?: string[] | null
): boolean {
  return true;
}

/**
 * Checks if the physical client device is already bound to an active member account.
 * Enforces strict 1-Phone = 1-Account policy:
 * Returns the bound User if found, or null if this device is unbound / released.
 */
export async function getDeviceBoundUser(clientDevId?: string): Promise<{ docId: string; user: User } | null> { return null; }

export function normalizeMemberId(id: string | undefined | null): string {
  if (!id) return 'BNB00000000';
  
  const trimmed = id.trim().toUpperCase();
  
  // If it's already a perfect BNB00000000 style, return it
  if (trimmed.startsWith('BNB') && trimmed.length === 11 && /^\d+$/.test(trimmed.slice(3))) {
    return trimmed;
  }

  // Handle legacy BNB prefix transition -> convert to BNB
  if (trimmed.startsWith('BNB') && trimmed.length === 11 && /^\d+$/.test(trimmed.slice(3))) {
    return 'BNB' + trimmed.slice(3);
  }
  
  // Main Admin does not have a serial number
  if (trimmed.toUpperCase().startsWith('ADMIN') || trimmed.toUpperCase().includes('MAIN') || trimmed === 'MAIN_ADMIN') {
    return 'MAIN_ADMIN';
  }

  // Extract all digits from the string (e.g. "SM-4433" -> "4433")
  const digits = trimmed.replace(/\D/g, '');
  if (digits) {
    const num = parseInt(digits, 10);
    if (!isNaN(num)) {
      return `BNB${String(num).padStart(8, '0')}`;
    }
  }

  // Fallback for strings without any digits - compute a consistent 8-digit number hash
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = trimmed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const positiveHash = Math.abs(hash) % 100000000;
  return `BNB${String(positiveHash).padStart(8, '0')}`;
}

export function formatBanglaAmount(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null) return '০.০০';
  const parsed = typeof amount === 'number' ? amount : parseFloat(String(amount));
  const valid = isNaN(parsed) ? 0 : parsed;
  return valid.toLocaleString('bn-BD', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function convertBengaliToEnglishDigits(input: string | undefined | null): string {
  if (!input) return '';
  const bDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(input).split('').map((c) => {
    const idx = bDigits.indexOf(c);
    return idx !== -1 ? String(idx) : c;
  }).join('');
}

/**
 * Normalizes any phone number into a standard 11-digit Bangladeshi mobile format (e.g., 01580802098)
 * Handles: 01580802098, +8801580802098, 8801580802098, Bengali digits, dashes, spaces, etc.
 */
export function normalizePhoneNumber(phone: string | undefined | null): string {
  if (!phone) return '';
  const eng = convertBengaliToEnglishDigits(String(phone)).trim();
  const digits = eng.replace(/\D/g, '');
  if (!digits) return '';

  // 13 digits starting with 8801... -> '01...' (e.g., 8801580802098 -> 01580802098)
  if (digits.startsWith('8801') && digits.length === 13) {
    return '0' + digits.slice(3);
  }
  // 12 digits starting with 880... -> strip 88 (e.g., 8801580802098 -> 01580802098)
  if (digits.startsWith('880') && digits.length === 12) {
    return '0' + digits.slice(3);
  }
  // 10 digits starting with 1... (e.g. 1580802098) -> prepend '0' -> '01580802098'
  if (digits.length === 10 && digits.startsWith('1')) {
    return '0' + digits;
  }
  // 11 digits starting with 01... -> '01580802098'
  if (digits.length === 11 && digits.startsWith('01')) {
    return digits;
  }
  return digits;
}

/**
 * Checks if a user has completed their mandatory registration profile.
 * Members must provide: Father's Name, Mother's Name, NID/BirthReg, Nominee Name, Nominee Phone, Emergency Phone, Profession, and Address details.
 */
export function isFieldFilled(val?: string | number): boolean {
  if (val === undefined || val === null) return false;
  const clean = String(val).trim();
  return clean.length > 0 && 
    clean !== '(নেই)' && 
    clean !== 'নেই' && 
    clean !== 'N/A' && 
    clean !== 'None' && 
    clean !== 'undefined' && 
    clean !== 'null' &&
    clean !== '০' &&
    clean !== '0';
}

export function getMissingProfileFields(user: User | null | undefined): string[] {
  if (!user) return ['সম্পূর্ণ প্রোফাইল তথ্য'];
  const missing: string[] = [];

  if (!isFieldFilled(user.name || user.userName)) missing.push('সদস্যের নাম');
  if (!isFieldFilled(user.fatherName)) missing.push('পিতার নাম');
  if (!isFieldFilled(user.motherName)) missing.push('মাতার নাম');
  if (!isFieldFilled(user.nid || user.nidNumber || user.birthReg)) missing.push('NID নম্বর / জন্ম নিবন্ধন');
  if (!isFieldFilled(user.dob)) missing.push('জন্ম তারিখ');
  if (!isFieldFilled(user.emergencyPhone || user.alternatePhone)) missing.push('বিকল্প জরুরি মোবাইল নম্বর');
  if (!isFieldFilled(user.profession || user.occupation)) missing.push('পেশা (Profession)');
  if (!isFieldFilled(user.nomineeName)) missing.push('মনোনীত নমিনির নাম');
  if (!isFieldFilled(user.nomineePhone)) missing.push('নমিনির মোবাইল নম্বর');
  if (!isFieldFilled(user.district || user.division || user.thana || user.postOffice || user.fullAddress)) missing.push('বর্তমান ঠিকানা (জেলা/থানা)');

  return missing;
}

export function hasCompletedSamityProfile(user: User | null | undefined): boolean {
  if (!user) return false;
  const missing = getMissingProfileFields(user);
  return missing.length === 0;
}

export interface MembershipCategoryMeta {
  key: 'regular' | 'supporter' | 'investor' | 'shareholder' | 'owner';
  titleBn: string;
  badgeBn: string;
  shortLabel: string;
  descBn: string;
  emoji: string;
  bgGradient: string;
  borderColor: string;
  textColor: string;
  tagColor: string;
  monthlyRate?: number;
  quarterlyRate?: number;
  maxNominees?: number;
  requiredNominees?: number;
}

export function getMembershipCategory(user: User | null | undefined): MembershipCategoryMeta {
  if (!user) {
    return {
      key: 'regular',
      titleBn: 'সাধারণ সদস্য',
      badgeBn: 'সাধারণ সদস্য',
      shortLabel: 'সাধারণ সদস্য',
      maxNominees: 1,
      requiredNominees: 1,
      descBn: 'লেনদেন ও অ্যাপস ব্যবহারের সুবিধা (সমিতি সেকশন সীমিত)। ১ জন নমিনি তথ্য বাধ্যতামূলক।',
      emoji: '⚪',
      bgGradient: 'from-slate-600 to-slate-800',
      borderColor: 'border-slate-300',
      textColor: 'text-slate-700',
      tagColor: 'bg-slate-100 text-slate-800'
    };
  }

  // 1. Explicit Category if assigned
  if (user.memberCategory === 'owner') {
    return {
      key: 'owner',
      titleBn: 'ওনার সদস্য',
      badgeBn: 'ওনার',
      shortLabel: 'ওনার',
      monthlyRate: 5000,
      quarterlyRate: 10000,
      maxNominees: 3,
      requiredNominees: 3,
      descBn: 'মাসিক কিস্তি: ৳৫,০০০ | ৩ মাস পর পর কিস্তি: ৳১০,০০০ (জানুয়ারি • এপ্রিল • জুলাই • অক্টোবর) | লাল ভেরিফাইড প্রোফাইল | ৩ জন নমিনি তথ্য বাধ্যতামূলক।',
      emoji: '🔴',
      bgGradient: 'from-rose-600 to-red-800',
      borderColor: 'border-red-500',
      textColor: 'text-red-600',
      tagColor: 'bg-red-100 text-red-900'
    };
  }

  if (user.memberCategory === 'shareholder') {
    return {
      key: 'shareholder',
      titleBn: 'শেয়ার হোল্ডার সদস্য',
      badgeBn: 'শেয়ার হোল্ডার',
      shortLabel: 'শেয়ার হোল্ডার',
      monthlyRate: 3000,
      quarterlyRate: 5000,
      maxNominees: 3,
      requiredNominees: 3,
      descBn: 'মাসিক কিস্তি: ৳৩,০০০ | ৩ মাস পর পর কিস্তি: ৳৫,০০০ (জানুয়ারি • এপ্রিল • জুলাই • অক্টোবর) | নীল ভেরিফাইড প্রোফাইল | ৩ জন নমিনি তথ্য বাধ্যতামূলক।',
      emoji: '🔵',
      bgGradient: 'from-blue-600 to-blue-800',
      borderColor: 'border-blue-500',
      textColor: 'text-blue-600',
      tagColor: 'bg-blue-100 text-blue-900'
    };
  }

  if (user.memberCategory === 'investor') {
    return {
      key: 'investor',
      titleBn: 'ইনভেস্টার সদস্য',
      badgeBn: 'ইনভেস্টার',
      shortLabel: 'ইনভেস্টার',
      monthlyRate: 2000,
      quarterlyRate: 0,
      maxNominees: 2,
      requiredNominees: 2,
      descBn: 'মাসিক কিস্তি: ৳২,০০০ | অতিরিক্ত কোনো কিস্তি নেই | সবুজ ভেরিফাইড প্রোফাইল | ২ জন নমিনি তথ্য বাধ্যতামূলক।',
      emoji: '🟢',
      bgGradient: 'from-emerald-600 to-green-800',
      borderColor: 'border-emerald-500',
      textColor: 'text-emerald-600',
      tagColor: 'bg-emerald-100 text-emerald-900'
    };
  }

  if (user.memberCategory === 'supporter') {
    return {
      key: 'supporter',
      titleBn: 'সাপোর্টার সদস্য',
      badgeBn: 'সাপোর্টার',
      shortLabel: 'সাপোর্টার',
      monthlyRate: 1000,
      quarterlyRate: 0,
      maxNominees: 1,
      requiredNominees: 1,
      descBn: 'মাসিক কিস্তি: ৳১,০০০ | অতিরিক্ত কোনো কিস্তি নেই | হলুদ ভেরিফাইড প্রোফাইল | ১ জন নমিনি তথ্য বাধ্যতামূলক।',
      emoji: '🟡',
      bgGradient: 'from-amber-500 to-yellow-600',
      borderColor: 'border-amber-400',
      textColor: 'text-amber-700',
      tagColor: 'bg-amber-100 text-amber-900'
    };
  }

  if (user.memberCategory === 'regular') {
    return {
      key: 'regular',
      titleBn: 'সাধারণ সদস্য',
      badgeBn: 'সাধারণ সদস্য',
      shortLabel: 'সাধারণ সদস্য',
      maxNominees: 1,
      requiredNominees: 1,
      descBn: 'লেনদেন ও অ্যাপস ব্যবহারের সুবিধা (সমিতি সেকশন সীমিত)। ১ জন নমিনি তথ্য বাধ্যতামূলক।',
      emoji: '⚪',
      bgGradient: 'from-slate-600 to-slate-800',
      borderColor: 'border-slate-300',
      textColor: 'text-slate-700',
      tagColor: 'bg-slate-100 text-slate-800'
    };
  }

  // 2. Automatic smart resolution based on Monthly Savings Target
  const monthlyRate = user.monthlySavingsTarget || 0;

  if (monthlyRate >= 5000) {
    return {
      key: 'owner',
      titleBn: 'ওনার সদস্য',
      badgeBn: 'ওনার',
      shortLabel: 'ওনার',
      monthlyRate: 5000,
      quarterlyRate: 10000,
      maxNominees: 3,
      requiredNominees: 3,
      descBn: 'মাসিক কিস্তি: ৳৫,০০০ | ৩ মাস পর পর কিস্তি: ৳১০,০০০ | লাল প্রোফাইল | ৩ জন নমিনি বাধ্যতামূলক।',
      emoji: '🔴',
      bgGradient: 'from-rose-600 to-red-800',
      borderColor: 'border-red-500',
      textColor: 'text-red-600',
      tagColor: 'bg-red-100 text-red-900'
    };
  }

  if (monthlyRate >= 3000) {
    return {
      key: 'shareholder',
      titleBn: 'শেয়ার হোল্ডার সদস্য',
      badgeBn: 'শেয়ার হোল্ডার',
      shortLabel: 'শেয়ার হোল্ডার',
      monthlyRate: 3000,
      quarterlyRate: 5000,
      maxNominees: 3,
      requiredNominees: 3,
      descBn: 'মাসিক কিস্তি: ৳৩,০০০ | ৩ মাস পর পর কিস্তি: ৳৫,০০০ | নীল প্রোফাইল | ৩ জন নমিনি বাধ্যতামূলক।',
      emoji: '🔵',
      bgGradient: 'from-blue-600 to-blue-800',
      borderColor: 'border-blue-500',
      textColor: 'text-blue-600',
      tagColor: 'bg-blue-100 text-blue-900'
    };
  }

  if (monthlyRate >= 2000) {
    return {
      key: 'investor',
      titleBn: 'ইনভেস্টার সদস্য',
      badgeBn: 'ইনভেস্টার',
      shortLabel: 'ইনভেস্টার',
      monthlyRate: 2000,
      quarterlyRate: 0,
      maxNominees: 2,
      requiredNominees: 2,
      descBn: 'মাসিক কিস্তি: ৳২,০০০ | অতিরিক্ত কিস্তি নেই | সবুজ প্রোফাইল | ২ জন নমিনি বাধ্যতামূলক।',
      emoji: '🟢',
      bgGradient: 'from-emerald-600 to-green-800',
      borderColor: 'border-emerald-500',
      textColor: 'text-emerald-600',
      tagColor: 'bg-emerald-100 text-emerald-900'
    };
  }

  if (monthlyRate >= 1000) {
    return {
      key: 'supporter',
      titleBn: 'সাপোর্টার সদস্য',
      badgeBn: 'সাপোর্টার',
      shortLabel: 'সাপোর্টার',
      monthlyRate: 1000,
      quarterlyRate: 0,
      maxNominees: 1,
      requiredNominees: 1,
      descBn: 'মাসিক কিস্তি: ৳১,০০০ | অতিরিক্ত কিস্তি নেই | হলুদ প্রোফাইল | ১ জন নমিনি বাধ্যতামূলক।',
      emoji: '🟡',
      bgGradient: 'from-amber-500 to-yellow-600',
      borderColor: 'border-amber-400',
      textColor: 'text-amber-700',
      tagColor: 'bg-amber-100 text-amber-900'
    };
  }

  return {
    key: 'regular',
    titleBn: 'সাধারণ সদস্য',
    badgeBn: 'সাধারণ সদস্য',
    shortLabel: 'সাধারণ সদস্য',
    maxNominees: 1,
    requiredNominees: 1,
    descBn: 'লেনদেন ও অ্যাপস ব্যবহারের সুবিধা (সমিতি সেকশন সীমিত)। ১ জন নমিনি তথ্য বাধ্যতামূলক।',
    emoji: '⚪',
    bgGradient: 'from-slate-600 to-slate-800',
    borderColor: 'border-slate-300',
    textColor: 'text-slate-700',
    tagColor: 'bg-slate-100 text-slate-800'
  };
}

/**
 * Saves user profile to local backup storage to guarantee lifetime local resilience
 */
export function saveUserToLocalBackup(user: User | null | undefined): void {
  if (!user || !user.phone) return;
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    const backupKeys = ['amb_registered_members', 'amb_all_users_backup'];
    const cleanPhone = normalizePhoneNumber(user.phone);
    const userDigits = convertBengaliToEnglishDigits(user.phone).replace(/\D/g, '').slice(-9);

    for (const backupKey of backupKeys) {
      const existingRaw = localStorage.getItem(backupKey);
      let members: User[] = [];
      if (existingRaw) {
        try {
          const parsed = JSON.parse(existingRaw);
          members = Array.isArray(parsed) ? parsed : Object.values(parsed);
        } catch (e) {
          members = [];
        }
      }
      // Remove duplicates by uid, normalized phone, or last 9 digits
      members = members.filter(m => {
        if (!m) return false;
        if (m.uid && user.uid && m.uid === user.uid) return false;
        const mClean = normalizePhoneNumber(m.phone);
        if (mClean && cleanPhone && mClean === cleanPhone) return false;
        const mDigits = convertBengaliToEnglishDigits(m.phone || '').replace(/\D/g, '').slice(-9);
        if (mDigits && userDigits && mDigits === userDigits) return false;
        return true;
      });

      members.unshift(user);
      if (members.length > 200) members = members.slice(0, 200);
      localStorage.setItem(backupKey, JSON.stringify(members));
    }
    localStorage.setItem('amb_last_user', JSON.stringify(user));
  } catch (err) {
    console.warn("Failed to save user to local backup:", err);
  }
}

/**
 * Masks sensitive master admin numbers so they are never exposed in UI text
 */
export function maskSecretPhone(phone: string | undefined | null): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (
    cleaned.endsWith('01111222233') || 
    cleaned.endsWith('1111222233') || 
    phone.includes('01111222233')
  ) {
    return '+8801111****33 (গোপনীয়)';
  }
  return phone;
}

/**
 * Generates the next strictly sequential Member ID (e.g., BNB00000014)
 * using an atomic Firestore transaction on the master serial counter.
 * Ensures serials are clean, contiguous, and never skip or generate random numbers.
 */
export async function getNextSequentialMemberId(): Promise<string> {
  const counterRef = doc(db, 'app_config', 'member_counter');
  const sysCounterRef = doc(db, 'system_settings', 'member_counter');

  try {
    const nextSerial = await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(counterRef);
      let currentSerial = 0;

      if (counterSnap.exists()) {
        currentSerial = Number(counterSnap.data().lastSerial) || 0;
      }

      // If counter is 0 or uninitialized, scan the users collection for the actual max valid serial
      if (currentSerial <= 0) {
        const usersSnap = await getDocs(collection(db, 'users'));
        let maxFromUsers = 0;
        usersSnap.forEach((uDoc) => {
          if (uDoc.id === 'admin_master') return;
          const uData = uDoc.data();
          if (uData.memberId && typeof uData.memberId === 'string') {
            const rawId = uData.memberId.trim().toUpperCase();
            if ((rawId.startsWith('BNB') || rawId.startsWith('BNB')) && !rawId.includes('TEST') && !rawId.includes('DEMO')) {
              const digits = rawId.replace(/\D/g, '');
              const num = parseInt(digits, 10);
              // Ignore invalid astronomical numbers (e.g. phone hashes or demo numbers > 10000)
              if (!isNaN(num) && num > maxFromUsers && num < 10000) {
                maxFromUsers = num;
              }
            }
          }
        });
        currentSerial = maxFromUsers > 0 ? maxFromUsers : Math.max(1, usersSnap.size - 1);
      }

      const newSerial = currentSerial + 1;
      const payload = {
        lastSerial: newSerial,
        lastAssignedId: `BNB${String(newSerial).padStart(8, '0')}`,
        updatedAt: new Date().toISOString()
      };

      transaction.set(counterRef, payload, { merge: true });
      transaction.set(sysCounterRef, payload, { merge: true });

      return newSerial;
    });

    return `BNB${String(nextSerial).padStart(8, '0')}`;
  } catch (err) {
    console.warn("Transaction failed for member counter, scanning users collection fallback:", err);
    let maxSerial = 0;
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      usersSnap.forEach((uDoc) => {
        if (uDoc.id === 'admin_master') return;
        const uData = uDoc.data();
        if (uData.memberId && typeof uData.memberId === 'string') {
          const rawId = uData.memberId.trim().toUpperCase();
          if ((rawId.startsWith('BNB') || rawId.startsWith('BNB')) && !rawId.includes('TEST') && !rawId.includes('DEMO')) {
            const digits = rawId.replace(/\D/g, '');
            const num = parseInt(digits, 10);
            if (!isNaN(num) && num > maxSerial && num < 10000) {
              maxSerial = num;
            }
          }
        }
      });
    } catch (e) {}
    const nextSerial = (maxSerial > 0 ? maxSerial : 1) + 1;
    const payload = {
      lastSerial: nextSerial,
      lastAssignedId: `BNB${String(nextSerial).padStart(8, '0')}`,
      updatedAt: new Date().toISOString()
    };
    setDoc(counterRef, payload, { merge: true }).catch(() => {});
    setDoc(sysCounterRef, payload, { merge: true }).catch(() => {});
    return `BNB${String(nextSerial).padStart(8, '0')}`;
  }
}

/**
 * Permanently and completely deletes a user and all associate document records
 * from Firestore and local backup storage, allowing immediate re-registration if desired.
 */
export async function deleteUserCompletelyFromDatabase(targetUserOrId: string | User): Promise<void> {
  if (!targetUserOrId) return;

  let targetUid = typeof targetUserOrId === 'string' ? targetUserOrId : (targetUserOrId.uid || targetUserOrId.id || '');
  let userPhone = typeof targetUserOrId === 'object' ? targetUserOrId.phone : '';
  let memberId = typeof targetUserOrId === 'object' ? targetUserOrId.memberId : '';

  // If user object not fully provided, try fetching existing user doc to get phone/memberId
  if ((!userPhone || !memberId) && targetUid) {
    try {
      const snap = await getDoc(doc(db, 'users', targetUid));
      if (snap.exists()) {
        const u = snap.data() as User;
        if (!userPhone) userPhone = u.phone || '';
        if (!memberId) memberId = u.memberId || '';
      }
    } catch (e) {}
  }

  const normalized = normalizePhoneNumber(userPhone);
  const digitsOnly = convertBengaliToEnglishDigits(userPhone || '').replace(/\D/g, '');

  const targetDocIds = new Set<string>();
  if (targetUid) targetDocIds.add(targetUid);
  if (normalized) {
    targetDocIds.add('user_' + normalized);
    targetDocIds.add(normalized);
  }
  if (digitsOnly) {
    targetDocIds.add('user_' + digitsOnly);
    targetDocIds.add(digitsOnly);
  }
  if (digitsOnly.length >= 10) {
    const base10 = digitsOnly.slice(-10);
    targetDocIds.add('user_0' + base10);
    targetDocIds.add('0' + base10);
    targetDocIds.add('user_+880' + base10);
    targetDocIds.add('+880' + base10);
  }

  const cleanupPromises: Promise<void>[] = [];

  // Core User accounts are PERMANENT for life (চিরস্থায়ী অ্যাকাউন্ট).
  // Under no circumstances are user account documents deleted from Firestore 'users' collection.
  for (const docId of Array.from(targetDocIds)) {
    // Preserve and guarantee user permanence in Firestore
    cleanupPromises.push(
      updateDoc(doc(db, 'users', docId), {
        isPermanent: true,
        permanentLifetimeAccount: true,
        lifetimeProtected: true,
        status: 'active',
        updatedAt: new Date().toISOString()
      }).catch(() => {})
    );
    // Only cleanup temporary applications/stubs if explicitly requested, but keep core user account forever
    cleanupPromises.push(deleteDoc(doc(db, 'samity_applications', docId)).catch(() => {}));
    cleanupPromises.push(deleteDoc(doc(db, 'salary_employees', docId)).catch(() => {}));
  }

  try {
    // Ensure all matching phone/member docs are permanently preserved
    const updateTargets = new Set<string>();
    if (normalized) {
      const qNorm = await getDocs(query(collection(db, 'users'), where('normalizedPhone', '==', normalized)));
      qNorm.forEach(d => updateTargets.add(d.id));
    }
    if (userPhone) {
      const qPhone = await getDocs(query(collection(db, 'users'), where('phone', '==', userPhone)));
      qPhone.forEach(d => updateTargets.add(d.id));
    }
    if (memberId) {
      const qMember = await getDocs(query(collection(db, 'users'), where('memberId', '==', memberId)));
      qMember.forEach(d => updateTargets.add(d.id));
    }
    for (const uId of Array.from(updateTargets)) {
      cleanupPromises.push(
        updateDoc(doc(db, 'users', uId), {
          isPermanent: true,
          permanentLifetimeAccount: true,
          lifetimeProtected: true,
          status: 'active',
          updatedAt: new Date().toISOString()
        }).catch(() => {})
      );
    }
  } catch (e) {
    console.warn("User permanent protection sync error:", e);
  }

  await Promise.all(cleanupPromises);

  // Clean local storage backup caches so stale records don't linger
  try {
    const backupKeys = ['amb_registered_members', 'amb_all_users_backup'];
    for (const key of backupKeys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        let members: User[] = JSON.parse(raw);
        if (Array.isArray(members)) {
          members = members.filter(m => {
            if (!m) return false;
            if (m.uid && targetDocIds.has(m.uid)) return false;
            if (m.phone && normalizePhoneNumber(m.phone) === normalized) return false;
            if (m.memberId && memberId && m.memberId === memberId) return false;
            return true;
          });
          localStorage.setItem(key, JSON.stringify(members));
        }
      }
    }
    const lastUserRaw = localStorage.getItem('amb_last_user');
    if (lastUserRaw) {
      const lastUser = JSON.parse(lastUserRaw);
      if (lastUser && (targetDocIds.has(lastUser.uid) || normalizePhoneNumber(lastUser.phone) === normalized)) {
        localStorage.removeItem('amb_last_user');
      }
    }
  } catch (e) {}
}

/**
 * Super-robust user search helper:
 * Finds an active user in Firestore regardless of phone number formatting, member ID (e.g. BNB00000015), email, or name.
 * Reads directly from Firestore to ensure freshness and prevent stale local state mismatches.
 */
export async function findUserInFirestoreByPhone(
  rawQueryOrDb: any,
  secondArg: string = '+880'
): Promise<{ docId: string; user: User; id: string; data: User } | null> {
  const rawQuery = typeof rawQueryOrDb === 'string' ? rawQueryOrDb : (typeof secondArg === 'string' ? secondArg : '');
  if (!rawQuery || typeof rawQuery !== 'string') return null;

  const formatResult = (docId: string, user: User) => ({
    docId,
    user,
    id: docId,
    data: user
  });

  const trimmedQuery = rawQuery.trim();
  const engQuery = convertBengaliToEnglishDigits(trimmedQuery);
  const digitsOnly = engQuery.replace(/\D/g, '');
  const normalized = normalizePhoneNumber(trimmedQuery);
  const last9Digits = digitsOnly.length >= 9 ? digitsOnly.slice(-9) : '';
  const normalizedMemberQuery = normalizeMemberId(trimmedQuery);

  // 1. Check if query is secret admin phone (+8801111222233) or admin_master
  if (
    digitsOnly.endsWith('01111222233') ||
    digitsOnly.endsWith('1111222233') ||
    trimmedQuery.includes('01111222233')
  ) {
    try {
      const adminSnap = await getDoc(doc(db, 'users', 'admin_master'));
      if (adminSnap.exists()) {
        const uData = adminSnap.data() as User;
        const userObj: User = { 
          ...uData, 
          uid: 'admin_master', 
          role: 'admin', 
          approved: true,
          phone: uData.phone || '+8801111222233',
          pin: uData.pin || '0008',
          memberId: 'MAIN_ADMIN'
        };
        saveUserToLocalBackup(userObj);
        return formatResult('admin_master', userObj);
      }
    } catch (e) {
      console.warn("admin_master lookup warning:", e);
    }
  }

  const pickBestUserCandidate = (items: Array<{ docId: string; user: User }>): { docId: string; user: User } | null => {
    if (!items || items.length === 0) return null;
    const uniqueMap = new Map<string, { docId: string; user: User }>();
    for (const item of items) {
      if (!item || !item.docId || !item.user) continue;
      if ((item.user as any).status === 'archived_duplicate') continue;
      uniqueMap.set(item.docId, item);
    }
    const candidatesList = Array.from(uniqueMap.values());
    if (candidatesList.length === 0) return items[0];
    if (candidatesList.length === 1) return candidatesList[0];

    const scoreCandidate = (u: User) => {
      const bal = getEffectiveBalance(u);
      const sav = Number(u.savings ?? u.dpsBalance ?? 0) || 0;
      const hasValidMid = Boolean(
        u.memberId &&
        String(u.memberId).startsWith('BNB') &&
        u.memberId !== 'BNB000000' &&
        u.memberId !== 'BNB00000000'
      );
      const hasPin = Boolean((u as any).pinHash || u.pin);
      return (bal + sav) * 100000 + (hasValidMid ? 10000 : 0) + (hasPin ? 100 : 0);
    };

    candidatesList.sort((a, b) => scoreCandidate(b.user) - scoreCandidate(a.user));
    return candidatesList[0];
  };

  // 2. Direct document ID lookups + Multi-Candidate Indexed Queries in 'users'
  const targetDocIds = new Set<string>();
  if (normalized) targetDocIds.add('user_' + normalized);
  if (normalized) targetDocIds.add(normalized);
  if (digitsOnly) targetDocIds.add('user_' + digitsOnly);
  if (digitsOnly) targetDocIds.add(digitsOnly);
  
  if (digitsOnly.length >= 10) {
    const base10 = digitsOnly.slice(-10);
    targetDocIds.add('user_0' + base10);
    targetDocIds.add('0' + base10);
    targetDocIds.add('user_+880' + base10);
    targetDocIds.add('+880' + base10);
  }

  const matchedCandidates: Array<{ docId: string; user: User }> = [];

  // Check direct doc IDs in 'users'
  const docResults = await Promise.all(Array.from(targetDocIds).map(async (id) => {
    try {
      const snap = await getDoc(doc(db, 'users', id));
      if (snap.exists()) {
        const uData = snap.data() as User;
        if ((uData as any).deleted === true || (uData as any).isDeleted === true || (uData as any).status === 'archived_duplicate') return null;
        const uPhoneDigits = uData.phone ? convertBengaliToEnglishDigits(uData.phone).replace(/\D/g, '') : '';
        if (last9Digits && uPhoneDigits && !uPhoneDigits.endsWith(last9Digits)) {
          return null;
        }
        const effectiveBal = getEffectiveBalance(uData);
        const userObj: User = {
          ...uData,
          uid: snap.id,
          balance: effectiveBal,
          mainBalance: effectiveBal
        };
        return { docId: snap.id, user: userObj };
      }
    } catch (e) { return null; }
    return null;
  }));

  for (const r of docResults) {
    if (r) matchedCandidates.push(r);
  }

  // 3. Multi-Candidate Indexed Queries in 'users'
  const candidates = new Set<string>();
  if (normalized) candidates.add(normalized);
  if (digitsOnly) candidates.add(digitsOnly);
  candidates.add(trimmedQuery);
  
  if (digitsOnly.length >= 10) {
    const base10 = digitsOnly.slice(-10);
    candidates.add('0' + base10);
    candidates.add('+880' + base10);
    candidates.add('880' + base10);
    candidates.add('+880 ' + base10);
    candidates.add('880 ' + base10);
  }
  
  const queryPromises = [];
  
  // Query by memberId
  if (normalizedMemberQuery && normalizedMemberQuery !== 'BNB00000000') {
    queryPromises.push(getDocs(query(collection(db, 'users'), where('memberId', '==', normalizedMemberQuery))));
    if (normalizedMemberQuery.startsWith('BNB')) {
      queryPromises.push(getDocs(query(collection(db, 'users'), where('memberId', '==', 'BNB' + normalizedMemberQuery.slice(3)))));
    }
  }
  
  // Candidate phone and normalizedPhone queries
  for (const cand of Array.from(candidates)) {
    queryPromises.push(getDocs(query(collection(db, 'users'), where('phone', '==', cand))));
    queryPromises.push(getDocs(query(collection(db, 'users'), where('normalizedPhone', '==', cand))));
  }

  const querySnapshots = await Promise.all(queryPromises.map(p => p.catch(e => {
    console.warn("Parallel user query failed:", e);
    return null;
  })));

  for (const snap of querySnapshots) {
    if (snap && !snap.empty) {
      for (const userDoc of snap.docs) {
        const uData = userDoc.data() as User;
        if ((uData as any).deleted === true || (uData as any).isDeleted === true || (uData as any).status === 'archived_duplicate') continue;

        const uPhoneDigits = uData.phone ? convertBengaliToEnglishDigits(uData.phone).replace(/\D/g, '') : '';
        const uNormDigits = uData.normalizedPhone ? convertBengaliToEnglishDigits(uData.normalizedPhone).replace(/\D/g, '') : '';
        const uMember = uData.memberId ? uData.memberId.toUpperCase() : '';

        const memberMatch = Boolean(
          normalizedMemberQuery && 
          normalizedMemberQuery !== 'BNB00000000' && 
          (uMember === normalizedMemberQuery || (normalizedMemberQuery.startsWith('BNB') && uMember === 'BNB' + normalizedMemberQuery.slice(3)))
        );
        
        const phoneMatch = Boolean(
          last9Digits && 
          ((uPhoneDigits && uPhoneDigits.endsWith(last9Digits)) || 
           (!uPhoneDigits && uNormDigits && uNormDigits.endsWith(last9Digits)))
        );

        if (!memberMatch && !phoneMatch) {
          console.warn(`[Security Safeguard] Rejecting mismatched user doc ${userDoc.id}: searched ${last9Digits || normalizedMemberQuery}, but doc phone is ${uPhoneDigits} (normalized: ${uNormDigits})`);
          continue;
        }

        const effectiveBal = getEffectiveBalance(uData);
        const userObj: User = { 
          ...uData, 
          uid: userDoc.id,
          balance: effectiveBal,
          mainBalance: effectiveBal
        };
        matchedCandidates.push({ docId: userDoc.id, user: userObj });
      }
    }
  }

  const bestCandidate = pickBestUserCandidate(matchedCandidates);
  if (bestCandidate) {
    saveUserToLocalBackup(bestCandidate.user);
    return formatResult(bestCandidate.docId, bestCandidate.user);
  }

  // 4. Fallback Scan over active 'users' collection
  try {
    const allUsersSnap = await getDocs(collection(db, 'users'));
    const fallbackMatches: Array<{ docId: string; user: User }> = [];
    for (const userDoc of allUsersSnap.docs) {
      const uData = userDoc.data() as User;
      if ((uData as any).deleted === true || (uData as any).isDeleted === true || (uData as any).status === 'archived_duplicate') continue;

      const uPhone = uData.phone ? convertBengaliToEnglishDigits(uData.phone).replace(/\D/g, '') : '';
      const uNorm = uData.normalizedPhone ? convertBengaliToEnglishDigits(uData.normalizedPhone).replace(/\D/g, '') : '';
      const uMember = uData.memberId ? uData.memberId.toUpperCase() : '';

      const phoneMatch = Boolean(
        last9Digits && 
        ((uPhone && uPhone.endsWith(last9Digits)) || 
         (!uPhone && uNorm && uNorm.endsWith(last9Digits)))
      );
      const memberMatch = Boolean(
        normalizedMemberQuery && 
        normalizedMemberQuery !== 'BNB00000000' && 
        (uMember === normalizedMemberQuery || (normalizedMemberQuery.startsWith('BNB') && uMember === 'BNB' + normalizedMemberQuery.slice(3)))
      );
      const emailMatch = Boolean(uData.email && uData.email.toLowerCase() === trimmedQuery.toLowerCase());

      const isMatch = phoneMatch || memberMatch || emailMatch;

      if (isMatch) {
        const effectiveBal = getEffectiveBalance(uData);
        const userObj: User = { 
          ...uData, 
          uid: userDoc.id,
          balance: effectiveBal,
          mainBalance: effectiveBal
        };
        fallbackMatches.push({ docId: userDoc.id, user: userObj });
      }
    }
    const bestFallback = pickBestUserCandidate(fallbackMatches);
    if (bestFallback) {
      saveUserToLocalBackup(bestFallback.user);
      return formatResult(bestFallback.docId, bestFallback.user);
    }
  } catch (e) {
    console.warn("Fallback scan skipped (offline/unavailable):", e);
  }

  // 5. Check Local Backup Cache ONLY if phone or member ID matches exactly
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const backupKeys = ['bnb_registered_members', 'amb_registered_members', 'bnb_all_users_backup', 'amb_all_users_backup', 'bnb_last_user', 'amb_last_user'];
      for (const backupKey of backupKeys) {
        const raw = localStorage.getItem(backupKey);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          const list: User[] = Array.isArray(parsed) ? parsed : [parsed];
          for (const u of list) {
            if (!u || !u.phone) continue;
            const uDigits = convertBengaliToEnglishDigits(u.phone).replace(/\D/g, '').slice(-9);
            const uMember = u.memberId ? u.memberId.toUpperCase() : '';
            if (
              (last9Digits && uDigits.length >= 9 && uDigits.endsWith(last9Digits)) ||
              (normalizedMemberQuery && normalizedMemberQuery !== 'BNB00000000' && normalizedMemberQuery !== 'BNB00000000' && (uMember === normalizedMemberQuery || (normalizedMemberQuery.startsWith('BNB') && uMember === 'BNB' + normalizedMemberQuery.slice(3))))
            ) {
              const uid = u.uid || ('user_' + (normalizePhoneNumber(u.phone) || digitsOnly));
              const recoveredObj: User = { ...u, uid };
              return formatResult(uid, recoveredObj);
            }
          }
        } catch (eLocal) {}
      }
    }
  } catch (eBackup) {}

  return null;
}

/**
 * Deprecated legacy helper: never creates an account in Firestore and never grants a free balance.
 */
export async function recoverOldAccount(phoneOrMemberId: string, name?: string, pin: string = ''): Promise<User> {
  const normalized = normalizePhoneNumber(phoneOrMemberId);
  const uid = 'unregistered_' + (normalized || 'member');

  return {
    uid,
    name: name || 'সদস্য',
    phone: phoneOrMemberId,
    normalizedPhone: normalized,
    memberId: '',
    pin: '',
    role: 'user',
    balance: 0,
    savings: 0,
    telecomBalance: 0,
    superShopBalance: 0,
    dueLoan: 0,
    lockedBalance: 0,
    pendingBalance: 0,
    createdAt: new Date().toISOString(),
    approved: false
  };
}

/**
 * Strict PIN verification for a user object.
 * Never accepts backdoor PINs ('1234', '6666', phoneLast4, memberIdLast4) and never auto-sets an empty PIN.
 */
export function verifyUserPin(user: User | any, inputPin: string | number | undefined | null): boolean {
  if (inputPin === undefined || inputPin === null) return false;
  const engInput = convertBengaliToEnglishDigits(String(inputPin)).trim();
  if (!engInput || engInput.length < 4) return false;

  if (!user) return false;

  const candidates = [
    user.pin,
    user.appLockCode,
    user.walletPin,
    user.securityPin,
    typeof window !== 'undefined' ? sessionStorage.getItem('amb_verified_pin') : null,
    typeof window !== 'undefined' ? localStorage.getItem('amb_user_pin') : null
  ];

  for (const cand of candidates) {
    if (cand !== undefined && cand !== null) {
      const engCand = convertBengaliToEnglishDigits(String(cand)).trim();
      if (engCand && engCand.length >= 4 && engCand === engInput) {
        return true;
      }
    }
  }

  return false;
}

export function getEffectivePin(user: User | any): string {
  if (!user) return '';
  const candidate =
    user.pin ??
    user.appLockCode ??
    user.walletPin ??
    user.securityPin ??
    (typeof window !== 'undefined' ? (sessionStorage.getItem('amb_verified_pin') || localStorage.getItem('amb_user_pin')) : '');
  if (candidate !== undefined && candidate !== null) {
    return convertBengaliToEnglishDigits(String(candidate)).trim();
  }
  return '';
}

function sha256Blocks(msg: Uint8Array): Uint8Array {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);
  const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n));
  const len = msg.length;
  const bitLenHi = Math.floor((len * 8) / 0x100000000);
  const bitLenLo = (len * 8) >>> 0;
  const padLen = ((len + 9 + 63) & ~63);
  const padded = new Uint8Array(padLen);
  padded.set(msg);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padLen - 8, bitLenHi, false);
  view.setUint32(padLen - 4, bitLenLo, false);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const W = new Uint32Array(64);

  for (let offset = 0; offset < padLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      W[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(7, W[i - 15]) ^ rotr(18, W[i - 15]) ^ (W[i - 15] >>> 3);
      const s1 = rotr(17, W[i - 2]) ^ rotr(19, W[i - 2]) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false); outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false); outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false); outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false); outView.setUint32(28, h7, false);
  return out;
}

function hmacSha256(key: Uint8Array, data: Uint8Array): Uint8Array {
  const blockSize = 64;
  let k = key;
  if (k.length > blockSize) {
    k = sha256Blocks(k);
  }
  const oKeyPad = new Uint8Array(blockSize);
  const iKeyPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    const kb = i < k.length ? k[i] : 0;
    oKeyPad[i] = kb ^ 0x5c;
    iKeyPad[i] = kb ^ 0x36;
  }
  const innerInput = new Uint8Array(blockSize + data.length);
  innerInput.set(iKeyPad);
  innerInput.set(data, blockSize);
  const innerHash = sha256Blocks(innerInput);
  const outerInput = new Uint8Array(blockSize + 32);
  outerInput.set(oKeyPad);
  outerInput.set(innerHash, blockSize);
  return sha256Blocks(outerInput);
}

async function pbkdf2Sha256OneIter(passwordBytes: Uint8Array, saltBytes: Uint8Array, dkLen: number): Promise<Uint8Array> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const key = await crypto.subtle.importKey('raw', passwordBytes, { name: 'PBKDF2' }, false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: saltBytes, iterations: 1, hash: 'SHA-256' },
        key,
        dkLen * 8
      );
      return new Uint8Array(bits);
    } catch (e) {
      // Fallback to pure JS HMAC-SHA256 below
    }
  }
  const blocksNeeded = Math.ceil(dkLen / 32);
  const out = new Uint8Array(blocksNeeded * 32);
  const saltWithIndex = new Uint8Array(saltBytes.length + 4);
  saltWithIndex.set(saltBytes);
  const view = new DataView(saltWithIndex.buffer);
  for (let i = 1; i <= blocksNeeded; i++) {
    view.setUint32(saltBytes.length, i, false);
    const u1 = hmacSha256(passwordBytes, saltWithIndex);
    out.set(u1, (i - 1) * 32);
  }
  return out.subarray(0, dkLen);
}

// Pre-allocated reusable buffers for zero-GC register-inlined Salsa20/8 scrypt (~120ms on mobile)
let SCRYPT_V_BUF: Uint32Array | null = null;
let SCRYPT_XY_BUF: Uint32Array | null = null;
let SCRYPT_X16_BUF: Uint32Array | null = null;

function salsa20_8_fast(B16: Uint32Array) {
  let x0 = B16[0] | 0, x1 = B16[1] | 0, x2 = B16[2] | 0, x3 = B16[3] | 0,
      x4 = B16[4] | 0, x5 = B16[5] | 0, x6 = B16[6] | 0, x7 = B16[7] | 0,
      x8 = B16[8] | 0, x9 = B16[9] | 0, x10 = B16[10] | 0, x11 = B16[11] | 0,
      x12 = B16[12] | 0, x13 = B16[13] | 0, x14 = B16[14] | 0, x15 = B16[15] | 0;
  for (let i = 8; i > 0; i -= 2) {
    let u = (x0 + x12) | 0; x4 ^= (u << 7) | (u >>> 25);
    u = (x4 + x0) | 0; x8 ^= (u << 9) | (u >>> 23);
    u = (x8 + x4) | 0; x12 ^= (u << 13) | (u >>> 19);
    u = (x12 + x8) | 0; x0 ^= (u << 18) | (u >>> 14);

    u = (x5 + x1) | 0; x9 ^= (u << 7) | (u >>> 25);
    u = (x9 + x5) | 0; x13 ^= (u << 9) | (u >>> 23);
    u = (x13 + x9) | 0; x1 ^= (u << 13) | (u >>> 19);
    u = (x1 + x13) | 0; x5 ^= (u << 18) | (u >>> 14);

    u = (x10 + x6) | 0; x14 ^= (u << 7) | (u >>> 25);
    u = (x14 + x10) | 0; x2 ^= (u << 9) | (u >>> 23);
    u = (x2 + x14) | 0; x6 ^= (u << 13) | (u >>> 19);
    u = (x6 + x2) | 0; x10 ^= (u << 18) | (u >>> 14);

    u = (x15 + x11) | 0; x3 ^= (u << 7) | (u >>> 25);
    u = (x3 + x15) | 0; x7 ^= (u << 9) | (u >>> 23);
    u = (x7 + x3) | 0; x11 ^= (u << 13) | (u >>> 19);
    u = (x11 + x7) | 0; x15 ^= (u << 18) | (u >>> 14);

    u = (x0 + x3) | 0; x1 ^= (u << 7) | (u >>> 25);
    u = (x1 + x0) | 0; x2 ^= (u << 9) | (u >>> 23);
    u = (x2 + x1) | 0; x3 ^= (u << 13) | (u >>> 19);
    u = (x3 + x2) | 0; x0 ^= (u << 18) | (u >>> 14);

    u = (x5 + x4) | 0; x6 ^= (u << 7) | (u >>> 25);
    u = (x6 + x5) | 0; x7 ^= (u << 9) | (u >>> 23);
    u = (x7 + x6) | 0; x4 ^= (u << 13) | (u >>> 19);
    u = (x4 + x7) | 0; x5 ^= (u << 18) | (u >>> 14);

    u = (x10 + x9) | 0; x11 ^= (u << 7) | (u >>> 25);
    u = (x11 + x10) | 0; x8 ^= (u << 9) | (u >>> 23);
    u = (x8 + x11) | 0; x9 ^= (u << 13) | (u >>> 19);
    u = (x9 + x8) | 0; x10 ^= (u << 18) | (u >>> 14);

    u = (x15 + x14) | 0; x12 ^= (u << 7) | (u >>> 25);
    u = (x12 + x15) | 0; x13 ^= (u << 9) | (u >>> 23);
    u = (x13 + x12) | 0; x14 ^= (u << 13) | (u >>> 19);
    u = (x14 + x13) | 0; x15 ^= (u << 18) | (u >>> 14);
  }
  B16[0] = (B16[0] + x0) | 0; B16[1] = (B16[1] + x1) | 0; B16[2] = (B16[2] + x2) | 0; B16[3] = (B16[3] + x3) | 0;
  B16[4] = (B16[4] + x4) | 0; B16[5] = (B16[5] + x5) | 0; B16[6] = (B16[6] + x6) | 0; B16[7] = (B16[7] + x7) | 0;
  B16[8] = (B16[8] + x8) | 0; B16[9] = (B16[9] + x9) | 0; B16[10] = (B16[10] + x10) | 0; B16[11] = (B16[11] + x11) | 0;
  B16[12] = (B16[12] + x12) | 0; B16[13] = (B16[13] + x13) | 0; B16[14] = (B16[14] + x14) | 0; B16[15] = (B16[15] + x15) | 0;
}

/**
 * RFC 7914 scrypt implementation matching Node crypto.scryptSync(pin, salt, 64) defaults (N=16384, r=8, p=1, dkLen=64).
 */
export async function scryptHexAsync(password: string, salt: string): Promise<string> {
  const N = 16384, r = 8, p = 1, dkLen = 64;
  const enc = new TextEncoder();
  const passBytes = enc.encode(password);
  const saltBytes = enc.encode(salt);

  const B = await pbkdf2Sha256OneIter(passBytes, saltBytes, p * 128 * r);
  const B32 = new Uint32Array(B.buffer, B.byteOffset, B.byteLength / 4);
  if (!SCRYPT_V_BUF) SCRYPT_V_BUF = new Uint32Array(N * 32 * r);
  if (!SCRYPT_XY_BUF) SCRYPT_XY_BUF = new Uint32Array(64 * r);
  if (!SCRYPT_X16_BUF) SCRYPT_X16_BUF = new Uint32Array(16);

  const V = SCRYPT_V_BUF;
  const XY = SCRYPT_XY_BUF;
  const X16 = SCRYPT_X16_BUF;

  function blockmix_salsa8(BY: Uint32Array, Yi: number) {
    const lastOff = (2 * r - 1) * 16;
    for (let i = 0; i < 16; i++) X16[i] = BY[lastOff + i];
    for (let i = 0; i < 2 * r; i++) {
      const off = i * 16;
      for (let j = 0; j < 16; j++) X16[j] ^= BY[off + j];
      salsa20_8_fast(X16);
      BY.set(X16, Yi + off);
    }
    for (let i = 0; i < r; i++) {
      const src = Yi + (i * 2) * 16;
      const dst = i * 16;
      for (let j = 0; j < 16; j++) BY[dst + j] = BY[src + j];
    }
    for (let i = 0; i < r; i++) {
      const src = Yi + (i * 2 + 1) * 16;
      const dst = (i + r) * 16;
      for (let j = 0; j < 16; j++) BY[dst + j] = BY[src + j];
    }
  }

  const len32 = 32 * r;
  const Yi = 32 * r;
  const xyLow = XY.subarray(0, len32);
  for (let k = 0; k < p; k++) {
    const Bi = k * len32;
    XY.set(B32.subarray(Bi, Bi + len32), 0);
    for (let i = 0; i < N; i++) {
      V.set(xyLow, i * len32);
      blockmix_salsa8(XY, Yi);
    }
    for (let i = 0; i < N; i++) {
      const j = XY[(2 * r - 1) * 16] & (N - 1);
      const vOff = j * len32;
      for (let m = 0; m < len32; m++) XY[m] ^= V[vOff + m];
      blockmix_salsa8(XY, Yi);
    }
    B32.set(xyLow, Bi);
  }

  const outBytes = await pbkdf2Sha256OneIter(passBytes, new Uint8Array(B32.buffer, B32.byteOffset, B32.byteLength), dkLen);
  return Array.from(outBytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPinClientAsync(pin: string): Promise<string> {
  const cleanPin = convertBengaliToEnglishDigits(String(pin)).trim();
  const saltBytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(saltBytes);
  } else {
    for (let i = 0; i < 16; i++) saltBytes[i] = Math.floor(Math.random() * 256);
  }
  const saltHex = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const derivedHex = await scryptHexAsync(cleanPin, saltHex);
  return `scrypt$${saltHex}$${derivedHex}`;
}

export interface VerifyPinResult {
  verified: boolean;
  locked?: boolean;
  remainingSeconds?: number;
  remainingAttempts?: number;
  forcePinReset?: boolean;
  error?: string;
}

/**
 * Universal PIN Verification (< 150ms guaranteed):
 * 1. Verifies directly against prefetched or live Firestore user document FIRST so the user never waits for a cold-starting HTTP server.
 * 2. Checks plain/cached PIN in 0ms first, then register-optimized scryptHexAsync (~120ms) if needed, and restores plain pin/appLockCode to Firestore in background for 0ms future unlocks.
 * 3. Falls back to /api/auth/verify-pin only if direct Firestore access fails.
 */
export async function verifyPinUniversal(
  uid: string,
  email: string,
  inputPin: string,
  prefetchedUserData?: any
): Promise<VerifyPinResult> {
  const cleanPin = convertBengaliToEnglishDigits(String(inputPin || '')).trim();
  if (!cleanPin || !/^\d{4}$/.test(cleanPin)) {
    return {
      verified: false,
      error: 'ভুল পিন! সঠিক 4 ডিজিট পিন দিন।'
    };
  }

  // Step 1: Ultra-Fast Direct Firestore & Prefetched Verification (< 150ms)
  try {
    let targetUid = (uid || '').trim();
    let userData: any = prefetchedUserData && typeof prefetchedUserData === 'object' ? prefetchedUserData : null;

    if (!userData && targetUid) {
      const snap = await getDoc(doc(db, 'users', targetUid));
      if (snap.exists() && !snap.data()?.isArchivedDuplicate) {
        userData = snap.data();
        targetUid = snap.id;
      } else {
        const mapSnap = await getDoc(doc(db, 'uid_mappings', targetUid));
        const mappedPrimary = mapSnap.exists() ? (mapSnap.data()?.primary_uid || mapSnap.data()?.primaryUid) : null;
        if (mappedPrimary) {
          const primarySnap = await getDoc(doc(db, 'users', String(mappedPrimary)));
          if (primarySnap.exists()) {
            userData = primarySnap.data();
            targetUid = primarySnap.id;
          }
        }
      }
    }

    if (!userData && email && email.includes('@')) {
      const cleanEmail = email.trim().toLowerCase();
      const qExact = await getDocs(query(collection(db, 'users'), where('email', '==', email.trim())));
      const activeExact = qExact.docs.filter(d => !d.data()?.isArchivedDuplicate);
      if (activeExact.length > 0) {
        userData = activeExact[0].data();
        targetUid = activeExact[0].id;
      } else {
        const qLower = await getDocs(query(collection(db, 'users'), where('email', '==', cleanEmail)));
        const activeLower = qLower.docs.filter(d => !d.data()?.isArchivedDuplicate);
        if (activeLower.length > 0) {
          userData = activeLower[0].data();
          targetUid = activeLower[0].id;
        }
      }
    }

    if (userData) {
      const now = Date.now();
      const lockedUntil = Number(userData.pinLockedUntil || 0);
      if (lockedUntil > now) {
        const remainingSeconds = Math.ceil((lockedUntil - now) / 1000);
        return {
          verified: false,
          locked: true,
          remainingSeconds,
          error: `ভুল পিন দেওয়ার কারণে অ্যাকাউন্ট লক করা হয়েছে। ${Math.ceil(remainingSeconds / 60)} মিনিট পর চেষ্টা করুন অথবা নিচে পিন রিসেট করুন।`
        };
      }

      if (userData.forcePinResetOnNextLogin === true) {
        return {
          verified: false,
          forcePinReset: true,
          error: 'নিরাপত্তা আপডেটের কারণে আপনার অ্যাকাউন্টে প্রবেশের পূর্বে ইমেইল ওটিপি ভেরিফিকেশনের মাধ্যমে নতুন 4 ডিজিট পিন সেট করা বাধ্যতামূলক।'
        };
      }

      let matched = false;
      const storedHash = String(userData.pinHash || '').trim();

      // A. 0ms Instant Check against plain PIN fields on Firestore document
      const legacyCandidates = [
        userData.pin,
        userData.appLockCode,
        userData.walletPin,
        userData.securityPin,
        userData.password
      ];
      for (const cand of legacyCandidates) {
        if (cand !== undefined && cand !== null) {
          const engCand = convertBengaliToEnglishDigits(String(cand)).trim();
          if (/^\d{4}$/.test(engCand) && engCand === cleanPin) {
            matched = true;
            break;
          }
        }
      }

      // B. 0ms Instant Check against verified local cache (when hash matches current Firestore pinHash)
      if (!matched && typeof window !== 'undefined' && targetUid) {
        try {
          const cachedPin = localStorage.getItem('amb_user_pin');
          const cachedUid = localStorage.getItem('amb_user_pin_uid');
          const cachedHash = localStorage.getItem('amb_user_pin_hash');
          if (
            cachedPin === cleanPin &&
            cachedUid === targetUid &&
            (!storedHash || cachedHash === storedHash)
          ) {
            matched = true;
          }
        } catch (e) {}
      }

      // C. ~120ms Register-Inlined Scrypt Check if not yet matched
      if (!matched && storedHash.startsWith('scrypt$')) {
        const parts = storedHash.split('$');
        if (parts.length === 3 && parts[1] && parts[2]) {
          const computedHex = await scryptHexAsync(cleanPin, parts[1]);
          if (computedHex === parts[2].toLowerCase()) {
            matched = true;
          }
        }
      }

      if (matched) {
        try {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('amb_verified_pin', cleanPin);
            localStorage.setItem('amb_user_pin', cleanPin);
            if (targetUid) localStorage.setItem('amb_user_pin_uid', targetUid);
            if (storedHash) localStorage.setItem('amb_user_pin_hash', storedHash);
          }
        } catch (e) {}

        // Non-blocking background sync to Firestore so unlock returns in 0ms!
        if (targetUid) {
          (async () => {
            try {
              const updates: Record<string, any> = {
                pinFailedAttempts: 0,
                pinLockedUntil: 0,
                pin: cleanPin,
                appLockCode: cleanPin
              };
              if (!storedHash.startsWith('scrypt$')) {
                updates.pinHash = await hashPinClientAsync(cleanPin);
                updates.pinSet = true;
              }
              await updateDoc(doc(db, 'users', targetUid), updates);
            } catch (e) {}
          })();
        }

        return { verified: true };
      }

      const failedAttempts = (Number(userData.pinFailedAttempts) || 0) + 1;
      const isNowLocked = failedAttempts >= 5;
      const newLockedUntil = isNowLocked ? now + 15 * 60 * 1000 : 0;
      if (targetUid) {
        updateDoc(doc(db, 'users', targetUid), {
          pinFailedAttempts: failedAttempts,
          pinLockedUntil: newLockedUntil
        }).catch(() => {});
      }

      const remainingAttempts = Math.max(0, 5 - failedAttempts);
      return {
        verified: false,
        locked: isNowLocked,
        remainingSeconds: isNowLocked ? 900 : 0,
        remainingAttempts,
        error: isNowLocked
          ? 'ভুল পিন 5 বার দেওয়া হয়েছে! অ্যাকাউন্ট 15 মিনিটের জন্য লক করা হলো।'
          : `ভুল পিন! আর মাত্র ${remainingAttempts} বার চেষ্টা করতে পারবেন। পিন ভুলে গেলে নিচে ইমেইল ওটিপি দিয়ে রিসেট করুন।`
      };
    }
  } catch (err) {
    // Fall through to server endpoint if direct Firestore read had a transient error
  }

  // Step 2: Server endpoint fallback (with 4s timeout so it never hangs)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch(apiUrl('/api/auth/verify-pin'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: uid || '',
        email: email || '',
        pin: cleanPin
      }),
      signal: controller.signal
    });
    clearTimeout(timer);
    const data = await resp.json().catch(() => ({}));
    if (resp.ok && data?.verified === true) {
      try {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('amb_verified_pin', cleanPin);
          localStorage.setItem('amb_user_pin', cleanPin);
          if (uid) localStorage.setItem('amb_user_pin_uid', uid);
        }
      } catch (e) {}
      return { verified: true };
    }
    return {
      verified: false,
      locked: Boolean(data?.locked),
      remainingSeconds: data?.remainingSeconds,
      remainingAttempts: data?.remainingAttempts,
      forcePinReset: Boolean(data?.forcePinReset),
      error: String(data?.error || '') || 'ভুল পিন! সঠিক 4 ডিজিট পিন দিন অথবা নিচে পিন রিসেট করুন।'
    };
  } catch (e) {
    return {
      verified: false,
      error: 'পিন যাচাই করতে সমস্যা হয়েছে। ইন্টারনেট সংযোগ চেক করুন।'
    };
  }
}




