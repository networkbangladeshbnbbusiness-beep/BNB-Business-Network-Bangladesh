import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import UnifiedBackButton from './UnifiedBackButton';
import { isStandaloneAdminRoute } from '../lib/adminRoute';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  Search, 
  Filter, 
  MapPin, 
  Phone, 
  Calendar, 
  Users, 
  Globe, 
  ShieldCheck, 
  Award, 
  Coins, 
  TrendingUp, 
  FileText, 
  Briefcase, 
  ArrowRight, 
  CheckCircle,
  Eye,
  Map as LucideMap,
  User,
  Heart,
  Send,
  Bell,
  Settings,
  Share2,
  AlertTriangle,
  Languages,
  Star,
  Navigation,
  Power,
  Check,
  X,
  Sparkles,
  MapPinned,
  Radio,
  Compass,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, getDoc, query, where, orderBy, serverTimestamp, doc, updateDoc, setDoc, deleteDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import LeafletActiveMap from './LeafletActiveMap';
import GoogleAgentMap from './GoogleAgentMap';
import AgentProfileCard from './AgentProfileCard';
import AgentReportModal from './AgentReportModal';
import AgentDashboardPanel from './AgentDashboardPanel';
import {
  getHighPrecisionPosition,
  startWatchingHighPrecisionLocation,
  stopSharingAgentLocation,
  syncAgentLocationToFirestore,
  calculateHaversineDistance,
  formatDistance,
  formatRelativeTime,
  getOnlinePresenceStatus,
  toBanglaDigits
} from '../lib/locationService';
import { useBackHandler } from '../lib/navigationManager';
import {
  AgentWeeklySchedule,
  DayKey,
  WEEK_DAYS,
  createDefaultWeeklySchedule,
  normalizeWeeklySchedule,
  formatDayScheduleBn,
  formatClosedDaysLabel,
  buildOpeningHoursSummary,
  getWeeklyOffDays,
  getLiveScheduleStatus,
  formatTimeBn,
} from '../lib/agentSchedule';
import { getEffectivePaidMonthsList } from '../types';
import { getMembershipCategory } from '../lib/memberUtils';

const evaluateSamityFreeAgentEligibility = (profile: Record<string, any> | null | undefined) => {
  if (!profile) {
    return {
      isFreeEligible: false,
      isSamityTierMember: false,
      categoryKey: 'regular' as const,
      categoryBadgeBn: 'সাধারণ সদস্য',
      paidMonthsCount: 0,
      requiredMonths: 3,
      monthlyRate: 0,
      depositedSavings: 0,
    };
  }

  const samitySt = String(profile.samityStatus || '').toLowerCase().trim();
  const deactivateSt = String(profile.samityDeactivateStatus || '').toLowerCase().trim();
  const isDeactivated =
    deactivateSt === 'approved' ||
    deactivateSt === 'released' ||
    deactivateSt === 'self_opted_out';

  const catMeta = getMembershipCategory(profile as any);
  const isSamityTier = ['owner', 'shareholder', 'investor', 'supporter'].includes(catMeta.key);
  const monthlyRate = catMeta.monthlyRate || Number(profile.monthlySavingsTarget || 0) || 1000;

  const hasApprovedSamityMembership = Boolean(
    !isDeactivated &&
      isSamityTier &&
      (profile.samityApproved === true ||
        profile.isSamityMember === true ||
        samitySt === 'approved' ||
        profile.samitySchemeActive === true)
  );

  const rawSavings =
    typeof profile.savings === 'number' && !isNaN(profile.savings)
      ? profile.savings
      : typeof profile.dpsBalance === 'number' && !isNaN(profile.dpsBalance)
        ? profile.dpsBalance
        : Number(profile.savings || profile.dpsBalance || 0) || 0;
  const totalDepositVal = Number(profile.totalDeposit || profile.samityDepositBalance || 0) || 0;
  const depositedSavings = Math.max(0, rawSavings, totalDepositVal);

  const rawPaidMonths = Array.isArray(profile.samityPaidMonths) ? profile.samityPaidMonths : [];
  const effectivePaidMonths = getEffectivePaidMonthsList(rawPaidMonths, depositedSavings, monthlyRate);
  const paidBySavings = monthlyRate > 0 ? Math.floor(depositedSavings / monthlyRate) : 0;

  // Minimum 3 months of actual Samity installments must be deposited (>= 3 months * monthlyRate)
  const verifiedPaidMonths =
    depositedSavings > 0
      ? Math.max(paidBySavings, Math.min(effectivePaidMonths.length, paidBySavings))
      : 0;

  const isFreeEligible = hasApprovedSamityMembership && verifiedPaidMonths >= 3;

  return {
    isFreeEligible,
    isSamityTierMember: hasApprovedSamityMembership,
    categoryKey: catMeta.key,
    categoryBadgeBn: catMeta.badgeBn,
    paidMonthsCount: verifiedPaidMonths,
    requiredMonths: 3,
    monthlyRate,
    depositedSavings,
  };
};

interface AgentScreenProps {
  user: {
    uid: string;
    name?: string;
    phone?: string;
    email?: string;
    role?: string;
    balance?: number;
    mainBalance?: number;
    memberId?: string;
    photoURL?: string;
    photoUrl?: string;
    profilePic?: string;
    img?: string;
    avatar?: string;
    nid?: string;
    nidNumber?: string;
    birthReg?: string;
    nomineeName?: string;
    nomineeRelation?: string;
    nomineePhone?: string;
    nominees?: Array<{ id?: string; name: string; relation?: string; phone?: string; nid?: string }>;
    samityStatus?: string;
    samityApproved?: boolean;
    isSamityMember?: boolean;
    district?: string;
    thana?: string;
  };
  onBack: () => void;
  appConfig?: any;
}

const AGENT_APPLICATION_FEE = 100;

interface Agent {
  id: string;
  name: string;
  role: string;
  country: string;
  flag: string;
  city: string;
  phone: string;
  lat: number;   // realLat or percentage
  lng: number;   // realLng or percentage
  realLat?: number;
  realLng?: number;
  hasRealGPS?: boolean;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  lastUpdatedTs?: number;
  distanceKm?: number;
  isSharingLocation?: boolean;
  shopMapLink?: string;
  locationNumber?: string;
  bdX?: number;  // Percent X on Bangladesh map
  bdY?: number;  // Percent Y on Bangladesh map
  img: string;
  district?: string;
  thana?: string;
  postOffice?: string;
  verified?: boolean;
  status?: 'Available' | 'Busy' | 'Offline';
  lastSeen?: string;
  whatsapp?: string;
  messenger?: string;
  liveLocationEnabled?: boolean;
  address?: string;
  agentCode?: string;
  badgeLabel?: string;
  openingHours?: string;
  weeklySchedule?: AgentWeeklySchedule;
  weeklyOffDays?: string[];
  approvalStatus?: 'approved' | 'pending' | 'rejected';
}

export default function AgentScreen({ user, onBack, appConfig }: AgentScreenProps) {
  const [lang, setLang] = useState<'bn' | 'en'>('bn');
  const [activeTab, setActiveTab] = useState<'map' | 'apply' | 'my-applications' | 'profile' | 'agent-dash'>('map');
  const [mapType, setMapType] = useState<'world' | 'bangladesh'>('world');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>('all');
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>('all');
  const [selectedRadiusKm, setSelectedRadiusKm] = useState<number | 'all'>('all');
  const [filterOnline, setFilterOnline] = useState<boolean>(false);
  const [filterNearby, setFilterNearby] = useState<boolean>(false);
  const [filterVerified, setFilterVerified] = useState<boolean>(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState<boolean>(false);
  const [highlightedAgentId, setHighlightedAgentId] = useState<string | null>(null);
  const [showSensitive, setShowSensitive] = useState<boolean>(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState<boolean>(false);

  // Live Main Balance & User Profile Photo synced from users/{uid}
  const [liveUserBalance, setLiveUserBalance] = useState<number>(
    Number(user.balance !== undefined ? user.balance : user.mainBalance) || 0
  );
  const [liveUserPhoto, setLiveUserPhoto] = useState<string>(
    String(user.photoURL || user.photoUrl || user.profilePic || user.img || user.avatar || '').trim()
  );
  const [liveUserDoc, setLiveUserDoc] = useState<Record<string, any> | null>(null);
  const [myLatestApplication, setMyLatestApplication] = useState<any | null>(null);

  useEffect(() => {
    const fallbackBal = Number(user.balance !== undefined ? user.balance : user.mainBalance) || 0;
    setLiveUserBalance(fallbackBal);
  }, [user.balance, user.mainBalance]);

  useEffect(() => {
    const p = String(user.photoURL || user.photoUrl || user.profilePic || user.img || user.avatar || '').trim();
    if (p) setLiveUserPhoto(p);
  }, [user.photoURL, user.photoUrl, user.profilePic, user.img, user.avatar]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubUser = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data() || {};
          setLiveUserDoc(d);
          const bal = Number(d.balance !== undefined ? d.balance : d.mainBalance);
          if (!isNaN(bal)) setLiveUserBalance(bal);
          const photo = String(d.photoURL || d.photoUrl || d.profilePic || d.img || d.avatar || '').trim();
          if (photo && !photo.includes('1534528741775-53994a69daeb')) {
            setLiveUserPhoto(photo);
          }
          if (d.weeklySchedule && typeof d.weeklySchedule === 'object') {
            setWeeklySchedule(normalizeWeeklySchedule(d.weeklySchedule));
          }
        }
      },
      () => {}
    );

    const qMyReqs = query(collection(db, 'agent_requests'), where('userId', '==', user.uid));
    const unsubMyReqs = onSnapshot(
      qMyReqs,
      (snap) => {
        if (snap.empty) {
          setMyLatestApplication(null);
          return;
        }
        const docsList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        docsList.sort((a: any, b: any) => {
          const scoreA = a.status === 'approved' ? 2 : a.status === 'pending' ? 1 : 0;
          const scoreB = b.status === 'approved' ? 2 : b.status === 'pending' ? 1 : 0;
          if (scoreA !== scoreB) return scoreB - scoreA;
          const tA = a.createdAt?.seconds || 0;
          const tB = b.createdAt?.seconds || 0;
          return tB - tA;
        });
        setMyLatestApplication(docsList[0]);
      },
      () => {}
    );

    return () => {
      unsubUser();
      unsubMyReqs();
    };
  }, [user?.uid]);

  // Admin Config State for Manual vs Auto Location
  const [allowManualLocation, setAllowManualLocation] = useState<boolean>(
    appConfig?.allowManualAgentLocation ?? false
  );

  // User Geolocation States
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  const handleRequestUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setUserLocation(null);
      setLocationError('আপনার ব্রাউজারটি জিপিএস লোকেশন সমর্থন করে না।');
      return;
    }
    setIsLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setIsLocating(false);
      },
      () => {
        setUserLocation(null);
        setLocationError('জিপিএস লোকেশন পারমিশন দেওয়া হয়নি।');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // Automatically try detecting ordinary member's GPS on mount so distance & nearest agents show right away
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      () => {
        // Silent failure on auto-mount; user can tap GPS button anytime
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Privacy: Share My Location toggle
  const [isSharingLocation, setIsSharingLocation] = useState<boolean>(() => {
    return localStorage.getItem('amb_share_location') !== 'false';
  });

  // Manual Static Location States
  const [manualLat, setManualLat] = useState<string>('');
  const [manualLng, setManualLng] = useState<string>('');
  const [isSavingManualLoc, setIsSavingManualLoc] = useState<boolean>(false);

  // Favorites state
  const [favorites, setFavorites] = useState<string[]>([]);
  useEffect(() => {
    const saved = localStorage.getItem('amb_favorite_agents');
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const toggleFavorite = (agentId: string) => {
    const updated = favorites.includes(agentId)
      ? favorites.filter(id => id !== agentId)
      : [...favorites, agentId];
    setFavorites(updated);
    localStorage.setItem('amb_favorite_agents', JSON.stringify(updated));
  };

  // Agent Reporting States
  const [reportingAgent, setReportingAgent] = useState<Agent | null>(null);
  const [reportReason, setReportReason] = useState<string>('ভুল তথ্য');
  const [reportDetails, setReportDetails] = useState<string>('');
  const [isSubmittingReport, setIsSubmittingReport] = useState<boolean>(false);
  const [reportSuccess, setReportSuccess] = useState<boolean>(false);

  // Missing application form & UI states
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [closestAgent, setClosestAgent] = useState<Agent | null>(null);
  const [loadingApps, setLoadingApps] = useState<boolean>(false);
  const [userApplications, setUserApplications] = useState<any[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<AgentWeeklySchedule>(() => createDefaultWeeklySchedule());
  const [isSavingSchedule, setIsSavingSchedule] = useState<boolean>(false);
  const [scheduleSuccessMsg, setScheduleSuccessMsg] = useState<string>('');
  const [scheduleErrorMsg, setScheduleErrorMsg] = useState<string>('');

  // Agent internal back handler
  useBackHandler(() => {
    if (isMapFullscreen) { setIsMapFullscreen(false); return true; }
    if (reportingAgent) { setReportingAgent(null); return true; }
    if (showFilterDropdown) { setShowFilterDropdown(false); return true; }
    if (activeTab !== 'map') {
      setActiveTab('map');
      return true;
    }
    return false;
  }, true, 25);
  const effectiveUserProfile = useMemo(
    () => ({ ...user, ...(liveUserDoc || {}) } as Record<string, any>),
    [user, liveUserDoc]
  );

  const samityEligibility = useMemo(
    () => evaluateSamityFreeAgentEligibility(effectiveUserProfile),
    [effectiveUserProfile]
  );
  const isSamityInvestorFree = samityEligibility.isFreeEligible;
  const isSamityMemberAccount = samityEligibility.isSamityTierMember;
  const effectiveApplicationFee = isSamityInvestorFree ? 0 : AGENT_APPLICATION_FEE;

  const existingProfileNid = String(
    effectiveUserProfile.nid || effectiveUserProfile.nidNumber || effectiveUserProfile.birthReg || ''
  ).trim();
  const existingProfileNominee =
    Array.isArray(effectiveUserProfile.nominees) && effectiveUserProfile.nominees.length > 0
      ? effectiveUserProfile.nominees[0]
      : effectiveUserProfile.nomineeName
        ? {
            name: effectiveUserProfile.nomineeName,
            relation: effectiveUserProfile.nomineeRelation || '',
            phone: effectiveUserProfile.nomineePhone || '',
          }
        : null;
  const hasCompleteSamityAutoInfo = Boolean(
    isSamityMemberAccount &&
      existingProfileNid &&
      existingProfileNominee?.name &&
      existingProfileNominee?.phone
  );

  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [fullName, setFullName] = useState<string>(user.name || '');
  const [phoneNumber, setPhoneNumber] = useState<string>(user.phone || '');
  const [district, setDistrict] = useState<string>(user.district || '');
  const [areaName, setAreaName] = useState<string>(user.thana || '');
  const [experience, setExperience] = useState<string>('নেই');
  const [whatsNumber, setWhatsNumber] = useState<string>('');
  const [agentNid, setAgentNid] = useState<string>(existingProfileNid);
  const [agentNomineeName, setAgentNomineeName] = useState<string>(existingProfileNominee?.name || '');
  const [agentNomineeRelation, setAgentNomineeRelation] = useState<string>(existingProfileNominee?.relation || '');
  const [agentNomineePhone, setAgentNomineePhone] = useState<string>(existingProfileNominee?.phone || '');
  const [isFetchingAddress, setIsFetchingAddress] = useState<boolean>(false);
  const [applyLat, setApplyLat] = useState<number | null>(null);
  const [applyLng, setApplyLng] = useState<number | null>(null);
  const [shopMapLink, setShopMapLink] = useState<string>('');
  const [locationNumber, setLocationNumber] = useState<string>('');
  const [writtenLocation, setWrittenLocation] = useState<string>('');

  // Keep profile name, phone, and Samity NID/Nominee auto-synced from user profile
  useEffect(() => {
    if (user.name) setFullName(user.name);
    if (user.phone) setPhoneNumber(user.phone);
    if (existingProfileNid) setAgentNid((prev) => prev || existingProfileNid);
    if (existingProfileNominee?.name) setAgentNomineeName((prev) => prev || existingProfileNominee.name);
    if (existingProfileNominee?.relation) setAgentNomineeRelation((prev) => prev || existingProfileNominee.relation || '');
    if (existingProfileNominee?.phone) setAgentNomineePhone((prev) => prev || existingProfileNominee.phone || '');
  }, [user.name, user.phone, existingProfileNid, existingProfileNominee?.name, existingProfileNominee?.relation, existingProfileNominee?.phone]);

  // Multi-Language translations dictionary
  const trans = {
    bn: {
      title: 'BNB এজেন্ট নেটওয়ার্ক',
      subtitle: 'সারাদেশে আমাদের অনুমোদিত এজেন্ট ও প্রতিনিধিদের অবস্থান',
      onlineBadge: 'সরাসরি লাইভ',
      locateBtn: 'লোকেশন সনাক্ত করুন 📍',
      locateBtnActive: 'লোকেশন আপডেট করুন',
      locating: 'খোঁজা হচ্ছে...',
      scanningUser: 'আপনার বর্তমান অবস্থান স্ক্যান করা হচ্ছে...',
      gpsZone: 'জিপিএস ডিস্টেন্স জোন',
      gpsFound: 'সফলভাবে অবস্থান সনাক্ত করা হয়েছে!',
      gpsHelp: 'নিকটবর্তী এজেন্টদের দূরত্ব দেখতে অবস্থান সনাক্ত করুন।',
      findNearMe: 'Find Agent Near You',
      introText: 'পৃথিবীর যেকোনো প্রান্ত থেকে আপনার নিকটস্থ কো-অপারেটিভ এজেন্টের সাথে যোগাযোগ করুন। টাকা পাঠানো, উত্তোলন করা ও ক্যাশ আউট এখন মুহূর্তেই সম্পন্ন করুন।',
      nearestAgent: 'নিকটবর্তী এজেন্টঃ',
      searchPlaceholder: 'নাম, দেশ, শহর বা Agent ID দিয়ে খুঁজুন...',
      allCountries: 'সব দেশ',
      allCities: 'সব শহর',
      onlineFilter: '🟢 অনলাইন',
      nearbyFilter: '📍 নিকটস্থ (< 50 কি.মি.)',
      verifiedFilter: '☑️ ভেরিফাইড',
      activeAgentsCount: 'জন সক্রিয় এজেন্ট',
      agentCardStatusActive: 'Active',
      agentCardStatusBusy: 'Busy',
      agentCardStatusOffline: 'Offline',
      mapViewWorld: 'ওয়ার্ল্ড ম্যাপ',
      mapViewBD: 'বাংলাদেশ ম্যাপ',
      navHome: '🏡 হোম',
      navMap: 'এজেন্ট ম্যাপ',
      navApply: 'আবেদন করুন',
      navMyApps: 'আমার আবেদন',
      navProfile: 'প্রোফাইল',
      navAgentDash: 'ড্যাশবোর্ড',
      selectedAgent: 'নির্বাচিত এজেন্ট প্রোফাইল',
      locationLabel: '📍 অবস্থানঃ',
      phoneLabel: '📞 যোগাযোগ নম্বরঃ',
      etaLabel: 'আনুমানিক দূরত্ব ও সময়ঃ',
      distLabel: 'দূরত্বঃ',
      timeLabel: 'সময়ঃ',
      callBtn: '📞 কল করুন',
      waBtn: '💬 হোয়াটসঅ্যাপ',
      dirBtn: '📍 Get Direction (ডিরেকশন)',
      shareBtn: '🔗 শেয়ার',
      favBtn: '❤️ ফেভারিট',
      reportBtn: '⚠️ রিপোর্ট',
      reportModalTitle: 'এজেন্ট রিপোর্ট খতিয়ান',
      reportReasonLabel: 'রিপোর্টের কারণ নির্বাচন করুন',
      reportDetailsLabel: 'অভিযোগের বিবরণ দিন',
      submitReportBtn: 'অভিযোগ দাখিল করুন',
      reportSuccessText: 'আপনার রিপোর্টটি সফলভাবে দাখিল করা হয়েছে!',
      agentDashTitle: '💼 এজেন্ট কন্ট্রোল প্যানেল',
      agentDashStatusTitle: 'অনলাইন ডিউটি স্ট্যাটাস পরিবর্তন',
      agentLiveLocTitle: 'লাইভ জিপিএস লোকেশন ব্রডকাস্ট',
      agentLiveLocDesc: 'এই অপশনটি চালু থাকলে কো-অপারেটিভ সদস্যরা আপনার লাইভ অবস্থান ম্যাপে দেখতে পাবেন।',
      updateLocationGPSBtn: 'বর্তমান জিপিএস লোকেশন আপডেট করুন 🗺️',
      locationUpdatedSuccess: 'আপনার লাইভ অবস্থান সফলভাবে ডাটাবেসে আপডেট করা হয়েছে!',
      profileUpdateTitle: 'এজেন্ট প্রোফাইল সেটিংস আপডেট করুন',
      saveProfileBtn: 'প্রোফাইল তথ্য সংরক্ষণ করুন 💾'
    },
    en: {
      title: 'BNB Agent Map Portal',
      subtitle: 'Our Approved Cooperative Agent Network Worldwide',
      onlineBadge: '24/7 Live',
      locateBtn: 'Detect Location 📍',
      locateBtnActive: 'Update Location',
      locating: 'Locating...',
      scanningUser: 'Scanning your current GPS coordinates...',
      gpsZone: 'GPS Proximity Zone',
      gpsFound: 'Position successfully detected!',
      gpsHelp: 'Enable GPS permission to see nearest agents and distance.',
      findNearMe: 'Find Agent Near You',
      introText: 'Connect with our nearby cooperative agents globally. Send, receive, and cash out funds instantly with maximum convenience.',
      nearestAgent: 'Nearest Agent:',
      searchPlaceholder: 'Search by Name, Country, City or Agent ID...',
      allCountries: 'All Countries',
      allCities: 'All Cities',
      onlineFilter: '🟢 Online',
      nearbyFilter: '📍 Nearby (< 50 km)',
      verifiedFilter: '☑️ Verified',
      activeAgentsCount: 'active agents mapped',
      agentCardStatusActive: 'Active',
      agentCardStatusBusy: 'Busy',
      agentCardStatusOffline: 'Offline',
      mapViewWorld: 'World Map',
      mapViewBD: 'Bangladesh Map',
      navHome: '🏡 Home',
      navMap: 'Agent Map',
      navApply: 'Apply Now',
      navMyApps: 'My Applications',
      navProfile: 'Profile',
      navAgentDash: 'Agent Panel',
      selectedAgent: 'Selected Agent Profile',
      locationLabel: '📍 Location:',
      phoneLabel: '📞 Phone Number:',
      etaLabel: 'Estimated Distance & ETA:',
      distLabel: 'Distance:',
      timeLabel: 'Time:',
      callBtn: '📞 Call Now',
      waBtn: '💬 WhatsApp',
      dirBtn: '📍 Get Direction',
      shareBtn: '🔗 Share',
      favBtn: '❤️ Favorite',
      reportBtn: '⚠️ Report',
      reportModalTitle: 'Report Agent Form',
      reportReasonLabel: 'Select Reason for Report',
      reportDetailsLabel: 'Describe your complaint',
      submitReportBtn: 'Submit Complaint',
      reportSuccessText: 'Your report has been submitted successfully!',
      agentDashTitle: '💼 Agent Control Panel',
      agentDashStatusTitle: 'Update Duty Status',
      agentLiveLocTitle: 'Live GPS Broadcast',
      agentLiveLocDesc: 'When enabled, cooperative members can see your live position on the active map.',
      updateLocationGPSBtn: 'Update Current GPS Location 🗺️',
      locationUpdatedSuccess: 'Your live coordinate has been successfully updated in Firestore!',
      profileUpdateTitle: 'Update Agent Profile Settings',
      saveProfileBtn: 'Save Profile Settings 💾'
    }
  };

  const t = trans[lang];

  // Helpers for Bangla numbers and Geodistance calculations
  const toBanglaDigits = (numStr: string | number) => {
    const banglaDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    return numStr.toString().replace(/[0-9]/g, (digit) => banglaDigits[parseInt(digit)]);
  };

  const getDistanceInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  };

  const getEstimatedTime = (distance: number) => {
    if (distance < 2) {
      // Walking at 4.5 km/h
      const mins = Math.max(1, Math.round((distance / 4.5) * 60));
      return { time: mins, type: 'হাঁটা পথ' };
    } else {
      // Driving at 25 km/h
      const mins = Math.max(1, Math.round((distance / 25) * 60));
      return { time: mins, type: 'ড্রাইভ' };
    }
  };

  const detectUserLocation = () => {
    if (!navigator.geolocation) {
      setUserLocation(null);
      setLocationError('আপনার ব্রাউজারটি জিপিএস লোকেশন সনাক্তকরণ সমর্থন করে না।');
      return;
    }
    setIsLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsLocating(false);
      },
      () => {
        setUserLocation(null);
        setLocationError('জিপিএস অনুমতি পাওয়া যায়নি।');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  // Default Agent Data (Empty - strictly loads real registered members from Firestore)
  const defaultAgents: Agent[] = [];

  // Dynamic Agents list combining Firestore agents & default agents
  const [agentsList, setAgentsList] = useState<Agent[]>(defaultAgents);

  // Agent Control Panel states
  const [myAgentProfile, setMyAgentProfile] = useState<Agent | null>(null);
  const [isUpdatingLoc, setIsUpdatingLoc] = useState<boolean>(false);
  const [isSavingAgentProfile, setIsSavingAgentProfile] = useState<boolean>(false);

  // Form input states for the Profile Tab (Unified Change/Listing Request)
  const [profName, setProfName] = useState<string>('');
  const [profPhone, setProfPhone] = useState<string>('');
  const [profWhats, setProfWhats] = useState<string>('');
  const [profCountry, setProfCountry] = useState<string>('Bangladesh');
  const [profCity, setProfCity] = useState<string>('');
  const [profDist, setProfDist] = useState<string>('');
  const [profThana, setProfThana] = useState<string>('');
  const [profPost, setProfPost] = useState<string>('');
  const [profLat, setProfLat] = useState<number | null>(null);
  const [profLng, setProfLng] = useState<number | null>(null);
  const [isProfFetchingGPS, setIsProfFetchingGPS] = useState<boolean>(false);
  const [profSuccess, setProfSuccess] = useState<string>('');
  const [profError, setProfError] = useState<string>('');
  const [isProfSubmitting, setIsProfSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      setProfName(myAgentProfile?.name || user.name || '');
      setProfPhone(myAgentProfile?.phone || user.phone || '');
      setProfWhats(myAgentProfile?.whatsapp || myAgentProfile?.phone || user.phone || '');
      setProfCountry(myAgentProfile?.country || 'Bangladesh');
      setProfCity(myAgentProfile?.city || '');
      setProfDist(myAgentProfile?.district || '');
      setProfThana(myAgentProfile?.thana || '');
      setProfPost(myAgentProfile?.postOffice || '');
      setProfLat(myAgentProfile?.realLat || myAgentProfile?.lat || null);
      setProfLng(myAgentProfile?.realLng || myAgentProfile?.lng || null);
    }
  }, [user, myAgentProfile]);

// Helper to resolve an individual profile picture / avatar
const resolveAgentAvatar = (data: any, fallbackName: string): string => {
  const customPic = data?.photoURL || data?.photoUrl || data?.profilePic || data?.img || data?.avatar || data?.nidFront || data?.photo;
  
  // Ignore standard default female sample unsplash photo if user didn't upload it
  if (
    customPic && 
    typeof customPic === 'string' && 
    customPic.trim().length > 5 && 
    !customPic.includes('1534528741775-53994a69daeb')
  ) {
    return customPic.trim();
  }
  
  const nameToUse = data?.name || data?.userName || fallbackName || 'Member Agent';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(nameToUse)}&background=0D9488&color=fff&size=200&bold=true`;
};

// District Coordinate Presets across Bangladesh (Full 64 Districts)
const districtCoordinatesMap: { [key: string]: { lat: number; lng: number } } = {
  // Dhaka Division
  'dhaka': { lat: 23.8103, lng: 90.4125 },
  'ঢাকা': { lat: 23.8103, lng: 90.4125 },
  'faridpur': { lat: 23.6071, lng: 89.8425 },
  'ফরিদপুর': { lat: 23.6071, lng: 89.8425 },
  'gazipur': { lat: 23.9999, lng: 90.4203 },
  'গাজীপুর': { lat: 23.9999, lng: 90.4203 },
  'gopalganj': { lat: 23.0050, lng: 89.8266 },
  'গোপালগঞ্জ': { lat: 23.0050, lng: 89.8266 },
  'kishoreganj': { lat: 24.4449, lng: 90.7765 },
  'কিশোরগঞ্জ': { lat: 24.4449, lng: 90.7765 },
  'madaripur': { lat: 23.1641, lng: 90.1897 },
  'মাদারীপুর': { lat: 23.1641, lng: 90.1897 },
  'manikganj': { lat: 23.8644, lng: 90.0047 },
  'মানিকগঞ্জ': { lat: 23.8644, lng: 90.0047 },
  'munshiganj': { lat: 23.5422, lng: 90.5305 },
  'মুন্সীগঞ্জ': { lat: 23.5422, lng: 90.5305 },
  'narayanganj': { lat: 23.6238, lng: 90.5000 },
  'নারায়ণগঞ্জ': { lat: 23.6238, lng: 90.5000 },
  'narsingdi': { lat: 23.9193, lng: 90.7202 },
  'নরসিংদী': { lat: 23.9193, lng: 90.7202 },
  'rajbari': { lat: 23.7574, lng: 89.6444 },
  'রাজবাড়ী': { lat: 23.7574, lng: 89.6444 },
  'shariatpur': { lat: 23.2423, lng: 90.4348 },
  'শরীয়তপুর': { lat: 23.2423, lng: 90.4348 },
  'tangail': { lat: 24.2513, lng: 89.9167 },
  'টাঙ্গাইল': { lat: 24.2513, lng: 89.9167 },

  // Chattogram Division
  'chittagong': { lat: 22.3569, lng: 91.7832 },
  'chattogram': { lat: 22.3569, lng: 91.7832 },
  'চট্টগ্রাম': { lat: 22.3569, lng: 91.7832 },
  'bandarban': { lat: 21.8311, lng: 92.3686 },
  'বান্দরবান': { lat: 21.8311, lng: 92.3686 },
  'brahmanbaria': { lat: 23.9571, lng: 91.1119 },
  'ব্রাহ্মণবাড়িয়া': { lat: 23.9571, lng: 91.1119 },
  'chandpur': { lat: 23.2321, lng: 90.6631 },
  'চাঁদপুর': { lat: 23.2321, lng: 90.6631 },
  'comilla': { lat: 23.4607, lng: 91.1809 },
  'cumilla': { lat: 23.4607, lng: 91.1809 },
  'কুমিল্লা': { lat: 23.4607, lng: 91.1809 },
  'coxsbazar': { lat: 21.4272, lng: 92.0058 },
  'কক্সবাজার': { lat: 21.4272, lng: 92.0058 },
  'feni': { lat: 23.0159, lng: 91.3976 },
  'ফেনী': { lat: 23.0159, lng: 91.3976 },
  'khagrachhari': { lat: 23.1192, lng: 91.9847 },
  'খাগড়াছড়ি': { lat: 23.1192, lng: 91.9847 },
  'lakshmipur': { lat: 22.9447, lng: 90.8282 },
  'লক্ষ্মীপুর': { lat: 22.9447, lng: 90.8282 },
  'noakhali': { lat: 22.8696, lng: 91.0991 },
  'নোয়াখালী': { lat: 22.8696, lng: 91.0991 },
  'rangamati': { lat: 22.6533, lng: 92.1753 },
  'রাঙ্গামাটি': { lat: 22.6533, lng: 92.1753 },

  // Rajshahi Division
  'rajshahi': { lat: 24.3636, lng: 88.6241 },
  'রাজশাহী': { lat: 24.3636, lng: 88.6241 },
  'bogra': { lat: 24.8481, lng: 89.3730 },
  'bogura': { lat: 24.8481, lng: 89.3730 },
  'বগুড়া': { lat: 24.8481, lng: 89.3730 },
  'joypurhat': { lat: 25.1022, lng: 89.0238 },
  'জয়পুরহাট': { lat: 25.1022, lng: 89.0238 },
  'naogaon': { lat: 24.8103, lng: 88.9415 },
  'নওগাঁ': { lat: 24.8103, lng: 88.9415 },
  'natore': { lat: 24.4102, lng: 88.9818 },
  'নাটোর': { lat: 24.4102, lng: 88.9818 },
  'chapainawabganj': { lat: 24.5965, lng: 88.2775 },
  'nawabganj': { lat: 24.5965, lng: 88.2775 },
  'চাঁপাইনবাবগঞ্জ': { lat: 24.5965, lng: 88.2775 },
  'pabna': { lat: 24.0123, lng: 89.2312 },
  'পাবনা': { lat: 24.0123, lng: 89.2312 },
  'sirajganj': { lat: 24.4534, lng: 89.7008 },
  'সিরাজগঞ্জ': { lat: 24.4534, lng: 89.7008 },

  // Khulna Division
  'khulna': { lat: 22.8456, lng: 89.5403 },
  'খুলনা': { lat: 22.8456, lng: 89.5403 },
  'bagerhat': { lat: 22.6516, lng: 89.7859 },
  'বাগেরহাট': { lat: 22.6516, lng: 89.7859 },
  'chuadanga': { lat: 23.6402, lng: 88.8418 },
  'চুয়াডাঙ্গা': { lat: 23.6402, lng: 88.8418 },
  'jhenaidah': { lat: 23.5450, lng: 89.1726 },
  'ঝিনাইদহ': { lat: 23.5450, lng: 89.1726 },
  'jessore': { lat: 23.1664, lng: 89.2081 },
  'jashore': { lat: 23.1664, lng: 89.2081 },
  'যশোর': { lat: 23.1664, lng: 89.2081 },
  'kushtia': { lat: 23.9013, lng: 89.1204 },
  'কুষ্টিয়া': { lat: 23.9013, lng: 89.1204 },
  'magura': { lat: 23.4873, lng: 89.4199 },
  'মাগুরা': { lat: 23.4873, lng: 89.4199 },
  'meherpur': { lat: 23.7622, lng: 88.6318 },
  'মেহেরপুর': { lat: 23.7622, lng: 88.6318 },
  'narail': { lat: 23.1725, lng: 89.5127 },
  'নড়াইল': { lat: 23.1725, lng: 89.5127 },
  'satkhira': { lat: 22.7185, lng: 89.0705 },
  'সাতক্ষীরা': { lat: 22.7185, lng: 89.0705 },

  // Barishal Division
  'barisal': { lat: 22.7010, lng: 90.3535 },
  'barishal': { lat: 22.7010, lng: 90.3535 },
  'বরিশাল': { lat: 22.7010, lng: 90.3535 },
  'barguna': { lat: 22.1570, lng: 90.1256 },
  'বরগুনা': { lat: 22.1570, lng: 90.1256 },
  'bhola': { lat: 22.6859, lng: 90.6482 },
  'ভোলা': { lat: 22.6859, lng: 90.6482 },
  'jhalokati': { lat: 22.6423, lng: 90.1987 },
  'ঝালকাঠি': { lat: 22.6423, lng: 90.1987 },
  'patuakhali': { lat: 22.3596, lng: 90.3298 },
  'পটুয়াখালী': { lat: 22.3596, lng: 90.3298 },
  'pirojpur': { lat: 22.5791, lng: 89.9759 },
  'পিরোজপুর': { lat: 22.5791, lng: 89.9759 },

  // Sylhet Division
  'sylhet': { lat: 24.8949, lng: 91.8687 },
  'সিলেট': { lat: 24.8949, lng: 91.8687 },
  'habiganj': { lat: 24.3749, lng: 91.4155 },
  'হবিগঞ্জ': { lat: 24.3749, lng: 91.4155 },
  'moulvibazar': { lat: 24.4829, lng: 91.7774 },
  'মৌলভীবাজার': { lat: 24.4829, lng: 91.7774 },
  'sunamganj': { lat: 25.0658, lng: 91.3950 },
  'সুনামগঞ্জ': { lat: 25.0658, lng: 91.3950 },

  // Rangpur Division
  'rangpur': { lat: 25.7439, lng: 89.2752 },
  'রংপুর': { lat: 25.7439, lng: 89.2752 },
  'dinajpur': { lat: 25.6217, lng: 88.6354 },
  'দিনাজপুর': { lat: 25.6217, lng: 88.6354 },
  'gaibandha': { lat: 25.3288, lng: 89.5404 },
  'গাইবান্ধা': { lat: 25.3288, lng: 89.5404 },
  'kurigram': { lat: 25.8054, lng: 89.6361 },
  'কুড়িগ্রাম': { lat: 25.8054, lng: 89.6361 },
  'lalmonirhat': { lat: 25.9165, lng: 89.4532 },
  'লালমনিরহাট': { lat: 25.9165, lng: 89.4532 },
  'nilphamari': { lat: 25.9318, lng: 88.8560 },
  'নীলফামারী': { lat: 25.9318, lng: 88.8560 },
  'panchagarh': { lat: 26.3411, lng: 88.5541 },
  'পঞ্চগড়': { lat: 26.3411, lng: 88.5541 },
  'thakurgaon': { lat: 26.0337, lng: 88.4617 },
  'ঠাকুরগাঁও': { lat: 26.0337, lng: 88.4617 },

  // Mymensingh Division
  'mymensingh': { lat: 24.7471, lng: 90.4203 },
  'ময়মনসিংহ': { lat: 24.7471, lng: 90.4203 },
  'jamalpur': { lat: 24.9375, lng: 89.9378 },
  'জামালপুর': { lat: 24.9375, lng: 89.9378 },
  'netrokona': { lat: 24.8709, lng: 90.7279 },
  'নেত্রকোণা': { lat: 24.8709, lng: 90.7279 },
  'sherpur': { lat: 25.0205, lng: 90.0153 },
  'শেরপুর': { lat: 25.0205, lng: 90.0153 },
  'trishal': { lat: 24.5800, lng: 90.3980 },
  'ত্রিশাল': { lat: 24.5800, lng: 90.3980 },

  // International
  'bukayriyah': { lat: 26.1439, lng: 43.6559 },
  'আল-কাসিম': { lat: 26.1439, lng: 43.6559 }
};

const bdSpreadGrid = [
  { lat: 23.8103, lng: 90.4125 }, // Dhaka
  { lat: 24.7471, lng: 90.4203 }, // Mymensingh
  { lat: 22.3569, lng: 91.7832 }, // Chittagong
  { lat: 24.8949, lng: 91.8687 }, // Sylhet
  { lat: 24.3636, lng: 88.6241 }, // Rajshahi
  { lat: 22.8456, lng: 89.5403 }, // Khulna
  { lat: 22.7010, lng: 90.3535 }, // Barisal
  { lat: 25.7439, lng: 89.2752 }, // Rangpur
  { lat: 23.4607, lng: 91.1809 }, // Comilla
  { lat: 23.9999, lng: 90.4203 }, // Gazipur
  { lat: 23.6238, lng: 90.5000 }, // Narayanganj
  { lat: 24.8481, lng: 89.3730 }, // Bogra
  { lat: 24.2513, lng: 89.9167 }, // Tangail
  { lat: 21.4272, lng: 92.0058 }, // Cox's Bazar
  { lat: 23.0159, lng: 91.3976 }, // Feni
  { lat: 22.8696, lng: 91.0991 }, // Noakhali
  { lat: 23.1664, lng: 89.2081 }, // Jessore
  { lat: 24.0123, lng: 89.2312 }, // Pabna
  { lat: 25.6217, lng: 88.6354 }, // Dinajpur
  { lat: 23.9013, lng: 89.1204 }, // Kushtia
  { lat: 23.6071, lng: 89.8425 }, // Faridpur
  { lat: 24.5800, lng: 90.3980 }, // Trishal
  { lat: 23.8500, lng: 90.2500 }, // Savar
  { lat: 23.7500, lng: 90.3800 }  // Dhaka South
];

const resolveCountryMetadata = (rawCountry?: string, rawCity?: string, rawDist?: string) => {
  const c = (rawCountry || '').toLowerCase().trim();
  const city = (rawCity || rawDist || '').toLowerCase().trim();

  if (c.includes('saudi') || c.includes('সৌদি') || c.includes('ksa') || city.includes('riyadh') || city.includes('রিয়াদ') || city.includes('jeddah') || city.includes('জেদ্দা') || city.includes('makkah') || city.includes('মাক্কা') || city.includes('মক্কা') || city.includes('medina') || city.includes('মদিনা') || city.includes('dammam') || city.includes('দাম্মাম')) {
    return { country: 'Saudi Arabia', flag: '🇸🇦', defaultLat: 24.7136, defaultLng: 46.6753 };
  }
  if (c.includes('uae') || c.includes('dubai') || c.includes('আমিরাত') || c.includes('emirates') || city.includes('dubai') || city.includes('দুবাই') || city.includes('abudhabi') || city.includes('আবুধাবি')) {
    return { country: 'UAE', flag: '🇦🇪', defaultLat: 25.2048, defaultLng: 55.2708 };
  }
  if (c.includes('qatar') || c.includes('কাতার') || city.includes('doha') || city.includes('দোহা')) {
    return { country: 'Qatar', flag: '🇶🇦', defaultLat: 25.2854, defaultLng: 51.5310 };
  }
  if (c.includes('oman') || c.includes('ওমান') || city.includes('muscat') || city.includes('মাস্কাট')) {
    return { country: 'Oman', flag: '🇴🇲', defaultLat: 23.5880, defaultLng: 58.3829 };
  }
  if (c.includes('kuwait') || c.includes('কুয়েত')) {
    return { country: 'Kuwait', flag: '🇰🇼', defaultLat: 29.3759, defaultLng: 47.9774 };
  }
  if (c.includes('malaysia') || c.includes('মালয়েশিয়া') || city.includes('kuala') || city.includes('কুয়ালালামপুর')) {
    return { country: 'Malaysia', flag: '🇲🇾', defaultLat: 3.1390, defaultLng: 101.6869 };
  }
  if (c.includes('singapore') || c.includes('সিঙ্গাপুর')) {
    return { country: 'Singapore', flag: '🇸🇬', defaultLat: 1.3521, defaultLng: 103.8198 };
  }
  if (c.includes('usa') || c.includes('united states') || c.includes('যুক্তরাষ্ট্র') || c.includes('america') || city.includes('new york') || city.includes('নিউ ইয়র্ক')) {
    return { country: 'United States', flag: '🇺🇸', defaultLat: 40.7128, defaultLng: -74.0060 };
  }
  if (c.includes('uk') || c.includes('united kingdom') || c.includes('যুক্তরাজ্য') || c.includes('england') || city.includes('london') || city.includes('লন্ডন')) {
    return { country: 'United Kingdom', flag: '🇬🇧', defaultLat: 51.5074, defaultLng: -0.1278 };
  }
  if (c.includes('italy') || c.includes('ইতালি') || city.includes('rome') || city.includes('রোম')) {
    return { country: 'Italy', flag: '🇮🇹', defaultLat: 41.9028, defaultLng: 12.4964 };
  }

  return { country: rawCountry || 'Bangladesh', flag: (rawCountry && rawCountry !== 'Bangladesh' && rawCountry !== 'বাংলাদেশ') ? '🌐' : '🇧🇩', defaultLat: 23.8103, defaultLng: 90.4125 };
};

const matchesCountryName = (agentCountry: string, filter: string) => {
  if (!filter || filter === 'all') return true;
  const c = (agentCountry || '').toLowerCase().trim();
  const f = filter.toLowerCase().trim();
  if (c === f) return true;
  if (f.includes('saudi') || f.includes('সৌদি') || f.includes('ksa')) {
    return c.includes('saudi') || c.includes('সৌদি') || c.includes('ksa');
  }
  if (f.includes('uae') || f.includes('dubai') || f.includes('দুবাই') || f.includes('আমিরাত')) {
    return c.includes('uae') || c.includes('dubai') || c.includes('আমিরাত') || c.includes('emirates');
  }
  if (f.includes('qatar') || f.includes('কাতার')) {
    return c.includes('qatar') || c.includes('কাতার');
  }
  if (f.includes('oman') || f.includes('ওমান')) {
    return c.includes('oman') || c.includes('ওমান');
  }
  if (f.includes('kuwait') || f.includes('কুয়েত')) {
    return c.includes('kuwait') || c.includes('কুয়েত');
  }
  if (f.includes('malaysia') || f.includes('মালয়েশিয়া')) {
    return c.includes('malaysia') || c.includes('মালয়েশিয়া');
  }
  if (f.includes('singapore') || f.includes('সিঙ্গাপুর')) {
    return c.includes('singapore') || c.includes('সিঙ্গাপুর');
  }
  if (f.includes('usa') || f.includes('states') || f.includes('যুক্তরাষ্ট্র') || f.includes('আমেরিকা')) {
    return c.includes('usa') || c.includes('united states') || c.includes('যুক্তরাষ্ট্র') || c.includes('america');
  }
  if (f.includes('uk') || f.includes('kingdom') || f.includes('যুক্তরাজ্য') || f.includes('লন্ডন')) {
    return c.includes('uk') || c.includes('united kingdom') || c.includes('যুক্তরাজ্য') || c.includes('london');
  }
  if (f.includes('bangladesh') || f.includes('বাংলাদেশ')) {
    return c.includes('bangladesh') || c.includes('বাংলাদেশ') || c.includes('bd');
  }
  return c.includes(f);
};

const assignUniqueAgentCoordinates = (list: Agent[]): Agent[] => {
  return list.map((agent) => {
    const meta = resolveCountryMetadata(agent.country, agent.city, agent.district);
    const resolvedCountry = meta.country;
    const resolvedFlag = agent.flag && agent.flag !== '🌐' && agent.flag !== '🇧🇩' ? agent.flag : meta.flag;

    // Keep exact static coordinates if present
    if (
      typeof agent.lat === 'number' &&
      typeof agent.lng === 'number' &&
      !isNaN(agent.lat) &&
      !isNaN(agent.lng) &&
      agent.lat !== 0 &&
      agent.lng !== 0
    ) {
      return {
        ...agent,
        country: resolvedCountry,
        flag: resolvedFlag,
        realLat: agent.realLat || agent.lat,
        realLng: agent.realLng || agent.lng,
      };
    }

    if (resolvedCountry !== 'Bangladesh') {
      return {
        ...agent,
        country: resolvedCountry,
        flag: resolvedFlag,
        lat: meta.defaultLat,
        lng: meta.defaultLng,
        realLat: meta.defaultLat,
        realLng: meta.defaultLng,
      };
    }

    const distLower = (agent.district || agent.city || agent.thana || '').toLowerCase().trim();
    let baseCoord = districtCoordinatesMap[distLower];
    if (!baseCoord) {
      const foundKey = Object.keys(districtCoordinatesMap).find(
        (k) => distLower.includes(k) || k.includes(distLower)
      );
      if (foundKey) {
        baseCoord = districtCoordinatesMap[foundKey];
      }
    }

    if (!baseCoord) {
      return {
        ...agent,
        country: resolvedCountry,
        flag: resolvedFlag,
      };
    }

    return {
      ...agent,
      country: resolvedCountry,
      flag: resolvedFlag,
      lat: baseCoord.lat,
      lng: baseCoord.lng,
      realLat: baseCoord.lat,
      realLng: baseCoord.lng,
    };
  });
};

  // Agent Dashboard Input States
  const [dashName, setDashName] = useState<string>('');
  const [dashCity, setDashCity] = useState<string>('');
  const [dashCountry, setDashCountry] = useState<string>('');
  const [dashPhone, setDashPhone] = useState<string>('');
  const [dashWhats, setDashWhats] = useState<string>('');
  const [dashMsg, setDashMsg] = useState<string>('');
  const [dashDist, setDashDist] = useState<string>('');
  const [dashThana, setDashThana] = useState<string>('');
  const [dashPost, setDashPost] = useState<string>('');

  const parseCoordinatesFromInput = (input: string): { lat: number; lng: number } | null => {
    if (!input || !input.trim()) return null;
    const str = input.trim();

    // Match standard lat, lng e.g. "23.8103, 90.4125"
    const directMatch = str.match(/(-?\d+\.\d+)[\s,]+(-?\d+\.\d+)/);
    if (directMatch) {
      const lat = parseFloat(directMatch[1]);
      const lng = parseFloat(directMatch[2]);
      if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return { lat, lng };
      }
    }

    // Match Google Maps URL patterns e.g. /@23.8103,90.4125 or ?q=23.8103,90.4125
    const urlMatch = str.match(/([@-]?\d+\.\d+)[,\/]+([@-]?\d+\.\d+)/);
    if (urlMatch) {
      const lat = parseFloat(urlMatch[1].replace('@', ''));
      const lng = parseFloat(urlMatch[2].replace('@', ''));
      if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return { lat, lng };
      }
    }

    return null;
  };

  const parseCoord = (val: any): number | undefined => {
    if (typeof val === 'number' && !isNaN(val) && val !== 0) return val;
    if (typeof val === 'string' && val.trim() !== '') {
      const p = parseFloat(val);
      if (!isNaN(p) && p !== 0) return p;
    }
    return undefined;
  };

  // Geocode a permanent address using Google Maps Geocoding API (env variable key only)
  const geocodeAddressWithGoogle = async (
    addressText: string
  ): Promise<{ lat: number; lng: number; formattedAddress?: string } | null> => {
    if (!addressText || !addressText.trim()) return null;
    const directCoords = parseCoordinatesFromInput(addressText);
    if (directCoords) {
      return { lat: directCoords.lat, lng: directCoords.lng, formattedAddress: addressText.trim() };
    }

    const gmpKey =
      import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
      (typeof process !== 'undefined' &&
        process.env &&
        (process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY)) ||
      'AIzaSyBsEZaLW1kpzMu2QP-T8IrdmkZqiM3gfe8';

    if (gmpKey) {
      try {
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            addressText.trim()
          )}&key=${encodeURIComponent(gmpKey)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'OK' && data.results && data.results.length > 0) {
            const loc = data.results[0].geometry?.location;
            if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
              return {
                lat: loc.lat,
                lng: loc.lng,
                formattedAddress: data.results[0].formatted_address || addressText.trim(),
              };
            }
          }
        }
      } catch {
        // Fallback below if network error
      }
    }
    return null;
  };

  const fetchAgents = async () => {
    try {
      const agentsMap = new globalThis.Map<string, Agent>();
      const nonApprovedKeys = new Set<string>();
      const explicitlyApprovedKeys = new Set<string>();
      const userPhotoLookup = new globalThis.Map<string, string>();
      const userScheduleLookup = new globalThis.Map<
        string,
        { weeklySchedule: AgentWeeklySchedule; openingHours?: string; weeklyOffDays?: string[] }
      >();

      // Build live user photo & schedule lookup from 'users' so every agent pin reflects their latest info
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        usersSnap.forEach((uDoc) => {
          const ud = uDoc.data() || {};
          const rawPic = String(
            ud.photoURL || ud.photoUrl || ud.profilePic || ud.img || ud.avatar || ''
          ).trim();
          if (rawPic && rawPic.length > 5 && !rawPic.includes('1534528741775-53994a69daeb')) {
            userPhotoLookup.set(uDoc.id, rawPic);
            if (ud.uid) userPhotoLookup.set(String(ud.uid), rawPic);
            if (ud.phone) userPhotoLookup.set(String(ud.phone).trim(), rawPic);
          }
          if (ud.weeklySchedule && typeof ud.weeklySchedule === 'object') {
            const normalizedSched = normalizeWeeklySchedule(ud.weeklySchedule);
            const schedEntry = {
              weeklySchedule: normalizedSched,
              openingHours: ud.openingHours || buildOpeningHoursSummary(normalizedSched),
              weeklyOffDays: Array.isArray(ud.weeklyOffDays)
                ? ud.weeklyOffDays
                : getWeeklyOffDays(normalizedSched),
            };
            userScheduleLookup.set(uDoc.id, schedEntry);
            if (ud.uid) userScheduleLookup.set(String(ud.uid), schedEntry);
            if (ud.phone) userScheduleLookup.set(String(ud.phone).trim(), schedEntry);
          }
        });
      } catch (e) {
        console.warn('Could not preload user photos for agents:', e);
      }

      const processDataAndAdd = (docId: string, data: any) => {
        if (!data) return;

        // Strictly enforce status === "approved" rule: never include pending or rejected
        const rawApproval = String(data.approvalStatus || data.status || '').toLowerCase().trim();
        if (rawApproval === 'pending' || rawApproval === 'rejected') {
          return;
        }
        const isApprovedRecord =
          rawApproval === 'approved' ||
          data.role === 'Approved Agent' ||
          (data.verified === true && rawApproval !== 'pending' && rawApproval !== 'rejected');

        if (!isApprovedRecord) return;

        const name = data.name || data.userName || data.fullName || data.agentName || data.memberName || '';
        const phone = data.phone || data.mobile || data.whatsNumber || data.userPhone || data.phoneNumber || '';
        if (!name && !phone) return;

        const key = phone.trim() || docId;
        if (nonApprovedKeys.has(key) && !explicitlyApprovedKeys.has(key) && rawApproval !== 'approved') {
          return;
        }

        const matchedUserPhoto =
          (data.userId && userPhotoLookup.get(String(data.userId))) ||
          (data.uid && userPhotoLookup.get(String(data.uid))) ||
          userPhotoLookup.get(docId) ||
          (phone && userPhotoLookup.get(phone.trim())) ||
          '';

        const avatar = matchedUserPhoto || resolveAgentAvatar(data, name);
        const shopMapLink = data.shopMapLink || data.manualMapLink || data.mapLink || data.googleMapUrl || data.locationUrl || data.shopLocationLink || '';
        const locationNumber = data.locationNumber || data.shopNumber || data.locationCode || '';

        // Safely extract static lat/lng
        const rawLat = data.realLat ?? data.lat ?? data.latitude ?? (data.location && (data.location.lat ?? data.location.latitude));
        const rawLng = data.realLng ?? data.lng ?? data.longitude ?? (data.location && (data.location.lng ?? data.location.longitude));

        let parsedLat = parseCoord(rawLat);
        let parsedLng = parseCoord(rawLng);

        if ((parsedLat === undefined || parsedLng === undefined) && shopMapLink) {
          const parsedFromLink = parseCoordinatesFromInput(shopMapLink);
          if (parsedFromLink) {
            parsedLat = parsedFromLink.lat;
            parsedLng = parsedFromLink.lng;
          }
        }

        const meta = resolveCountryMetadata(data.country, data.city || data.area, data.district);
        const hasRealGPS = parsedLat !== undefined && parsedLng !== undefined;

        const lat = parsedLat !== undefined ? parsedLat : 0;
        const lng = parsedLng !== undefined ? parsedLng : 0;

        const permanentAddress =
          data.address ||
          data.writtenLocation ||
          [data.postOffice, data.thana || data.area, data.district || data.city, meta.country]
            .filter(Boolean)
            .join(', ');

        // Deterministic agent code (e.g., AG-2041) or Official Center badge
        const numericSeed =
          String(phone || docId)
            .replace(/[^0-9]/g, '')
            .slice(-4) || '2041';
        const paddedDigits = numericSeed.padStart(4, '2');
        const agentCode = data.agentCode || data.agentId || `AG-${paddedDigits}`;
        const isOfficialCenter =
          String(data.role || '').toLowerCase().includes('official') ||
          String(data.role || '').includes('অফিসিয়াল সেন্টার') ||
          data.isOfficialCenter === true;
        const badgeLabel = data.badgeLabel || (isOfficialCenter ? 'অফিসিয়াল সেন্টার' : `এজেন্ট পয়েন্ট • ${agentCode}`);
        const matchedUserSchedule =
          (data.userId && userScheduleLookup.get(String(data.userId))) ||
          (data.uid && userScheduleLookup.get(String(data.uid))) ||
          userScheduleLookup.get(docId) ||
          (phone && userScheduleLookup.get(phone.trim())) ||
          null;
        const resolvedWeeklySchedule = data.weeklySchedule
          ? normalizeWeeklySchedule(data.weeklySchedule)
          : matchedUserSchedule?.weeklySchedule;
        const resolvedWeeklyOffDays = resolvedWeeklySchedule
          ? getWeeklyOffDays(resolvedWeeklySchedule)
          : Array.isArray(data.weeklyOffDays)
            ? data.weeklyOffDays
            : undefined;
        const openingHours =
          (resolvedWeeklySchedule ? buildOpeningHoursSummary(resolvedWeeklySchedule) : '') ||
          data.openingHours ||
          matchedUserSchedule?.openingHours ||
          data.hours ||
          data.schedule ||
          'সকাল ৯:০০ - রাত ১০:০০';

        const agentObj: Agent = {
          id: docId,
          agentCode,
          badgeLabel,
          openingHours,
          weeklySchedule: resolvedWeeklySchedule,
          weeklyOffDays: resolvedWeeklyOffDays,
          name: name || 'এজেন্ট সদস্য',
          role: data.role || data.agentRole || 'Approved Agent',
          country: meta.country,
          flag: meta.flag,
          city: data.city || data.area || data.district || 'ঢাকা',
          phone: phone,
          lat: lat,
          lng: lng,
          realLat: lat,
          realLng: lng,
          hasRealGPS: hasRealGPS,
          shopMapLink: shopMapLink,
          locationNumber: locationNumber,
          bdX: typeof data.bdX === 'number' ? data.bdX : 50,
          bdY: typeof data.bdY === 'number' ? data.bdY : 50,
          img: avatar,
          district: data.district || data.division || data.state || '',
          thana: data.thana || data.areaName || data.upazila || data.area || data.postOffice || '',
          postOffice: data.postOffice || '',
          address: permanentAddress,
          verified: true,
          status: data.status === 'Busy' ? 'Busy' : data.status === 'Offline' ? 'Offline' : 'Available',
          approvalStatus: 'approved',
          lastSeen: data.lastSeen || 'Active Now',
          whatsapp: data.whatsapp || data.whatsNumber || phone,
          messenger: data.messenger || '',
          liveLocationEnabled: false,
        };

        if (!agentsMap.has(key)) {
          agentsMap.set(key, agentObj);
        } else {
          const existing = agentsMap.get(key)!;
          if (hasRealGPS && !existing.hasRealGPS) {
            existing.lat = lat;
            existing.lng = lng;
            existing.realLat = lat;
            existing.realLng = lng;
            existing.hasRealGPS = true;
          }
          if (avatar && !avatar.includes('ui-avatars.com')) {
            existing.img = avatar;
          }
          if (resolvedWeeklySchedule && !existing.weeklySchedule) {
            existing.weeklySchedule = resolvedWeeklySchedule;
            existing.weeklyOffDays = resolvedWeeklyOffDays;
            existing.openingHours = openingHours;
          }
          if (!existing.district && (data.district || data.division)) existing.district = data.district || data.division;
          if (!existing.thana && (data.thana || data.areaName || data.area)) existing.thana = data.thana || data.areaName || data.area;
          if (!existing.address && permanentAddress) existing.address = permanentAddress;
          if (!existing.phone && phone) existing.phone = phone;
        }
      };

      // 1. First inspect 'agent_requests' to strictly filter out pending/rejected and include only status === 'approved'
      try {
        const snap3 = await getDocs(collection(db, 'agent_requests'));
        snap3.forEach((docSnap) => {
          const d = docSnap.data();
          const st = String(d?.status || '').toLowerCase().trim();
          const pKey = (d?.phone || d?.mobile || '').trim() || d?.userId || docSnap.id;
          if (st === 'approved') {
            explicitlyApprovedKeys.add(pKey);
            if (d?.userId) explicitlyApprovedKeys.add(d.userId);
            processDataAndAdd(docSnap.id, { ...d, approvalStatus: 'approved' });
          } else if (st === 'pending' || st === 'rejected') {
            nonApprovedKeys.add(pKey);
            if (d?.userId) nonApprovedKeys.add(d.userId);
          }
        });
      } catch (e) {
        console.error('Error loading agent_requests collection:', e);
      }

      // 2. Query 'agents' collection (only approved agents)
      try {
        const snap1 = await getDocs(collection(db, 'agents'));
        snap1.forEach((docSnap) => processDataAndAdd(docSnap.id, docSnap.data()));
      } catch (e) {
        console.error('Error loading agents collection:', e);
      }

      // 3. Query 'bap_agents' collection (only approved agents)
      try {
        const snap2 = await getDocs(collection(db, 'bap_agents'));
        snap2.forEach((docSnap) => processDataAndAdd(docSnap.id, docSnap.data()));
      } catch (e) {
        console.error('Error loading bap_agents collection:', e);
      }

      let fetchedAgentsList: Agent[] = Array.from(agentsMap.values());

      // Strictly keep only approved agents and filter out any demo/mock entries
      fetchedAgentsList = fetchedAgentsList.filter((agent) => {
        if (agent.approvalStatus !== 'approved') return false;
        const nameLower = agent.name.toLowerCase();
        const idLower = agent.id.toLowerCase();
        if (nameLower.includes('demo') || nameLower.includes('mock') || idLower.startsWith('demo-')) return false;
        return true;
      });

      // Resolve static coordinates from permanent address/district if needed
      fetchedAgentsList = assignUniqueAgentCoordinates(fetchedAgentsList);

      setAgentsList(fetchedAgentsList);

      // Match current logged in user
      const matched = fetchedAgentsList.find((a) => a.phone === user.phone || a.id === user.uid);
      if (matched) {
        setMyAgentProfile(matched);
        setDashName(matched.name);
        setDashCity(matched.city);
        setDashCountry(matched.country);
        setDashPhone(matched.phone);
        setDashWhats(matched.whatsapp || matched.phone);
        setDashMsg(matched.messenger || '');
        setDashDist(matched.district || '');
        setDashThana(matched.thana || '');
        setDashPost(matched.postOffice || '');
      }
    } catch (err) {
      console.error('Error fetching dynamic agents: ', err);
    }
  };

  useEffect(() => {
    fetchAgents();

    // Subscribe to system settings / app_config for real-time manual vs auto location setting
    const unsubConfig = onSnapshot(doc(db, 'system_settings', 'app_config'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.allowManualAgentLocation !== undefined) {
          setAllowManualLocation(data.allowManualAgentLocation);
        }
      }
    });

    // Subscribe to real-time updates for approved agents and requests (no live GPS tracking)
    const unsub1 = onSnapshot(collection(db, 'agents'), () => fetchAgents(), (err) => console.error(err));
    const unsub2 = onSnapshot(collection(db, 'bap_agents'), () => fetchAgents(), (err) => console.error(err));
    const unsub3 = onSnapshot(collection(db, 'agent_requests'), () => fetchAgents(), (err) => console.error(err));

    return () => {
      unsubConfig();
      unsub1();
      unsub2();
      unsub3();
    };
  }, [user.uid]);

  // Auto fetch address when applicant opens application tab
  useEffect(() => {
    if (activeTab === 'apply' && (!district || !areaName)) {
      handleAutoFetchAddress();
    }
  }, [activeTab]);

  // Fetch submitted applications for the current user
  const fetchMyApplications = async () => {
    if (!user.uid) return;
    setLoadingApps(true);
    try {
      const qApps =
        isStandaloneAdminRoute() && (user.role === 'admin' || user.role === 'sub_admin')
          ? collection(db, 'agent_requests')
          : query(collection(db, 'agent_requests'), where('userId', '==', user.uid));
      const snap = await getDocs(qApps);
      const list: any[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setUserApplications(list);
    } catch (err) {
      console.error('Error fetching agent requests: ', err);
    } finally {
      setLoadingApps(false);
    }
  };

  const handleApproveApplication = async (app: any) => {
    if (!window.confirm('আপনি কি নিশ্চিতভাবে এই এজেন্ট আবেদনটি অনুমোদন করতে চান?')) return;
    try {
      const fullAddress =
        app.writtenLocation ||
        app.address ||
        app.shopMapLink ||
        [app.postOffice, app.thana || app.area, app.district, app.country || 'Bangladesh']
          .filter(Boolean)
          .join(', ');

      const geocoded = await geocodeAddressWithGoogle(fullAddress);
      const finalLat = geocoded?.lat ?? parseCoord(app.lat) ?? 23.685;
      const finalLng = geocoded?.lng ?? parseCoord(app.lng) ?? 90.356;
      const resolvedAddress = geocoded?.formattedAddress || fullAddress;

      // 1. Update request status to approved along with geocoded lat/lng
      await updateDoc(doc(db, 'agent_requests', app.id), {
        status: 'approved',
        approvalStatus: 'approved',
        lat: finalLat,
        lng: finalLng,
        realLat: finalLat,
        realLng: finalLng,
        address: resolvedAddress,
        processedAt: serverTimestamp(),
      });

      // 2. Save approved agent with permanent geocoded coordinates to 'agents' & 'bap_agents'
      let resolvedPhoto = app.img || app.photoURL || app.profilePic || '';
      if ((!resolvedPhoto || resolvedPhoto.includes('1534528741775-53994a69daeb')) && app.userId) {
        try {
          const uSnap = await getDoc(doc(db, 'users', app.userId));
          if (uSnap.exists()) {
            const ud = uSnap.data() || {};
            resolvedPhoto = ud.photoURL || ud.photoUrl || ud.profilePic || ud.img || ud.avatar || resolvedPhoto;
          }
        } catch {
          // ignore user photo lookup fallback
        }
      }

      const newAgentId = app.userId || 'agent_' + app.id;
      const newAgentObj = {
        id: newAgentId,
        userId: app.userId || newAgentId,
        name: app.userName || app.fullName || 'অনুমোদিত এজেন্ট',
        role: app.role || 'Approved Agent',
        country: app.country || 'Bangladesh',
        flag: '🇧🇩',
        city: app.area || app.city || app.district || 'ঢাকা',
        phone: app.phone || '',
        lat: finalLat,
        lng: finalLng,
        realLat: finalLat,
        realLng: finalLng,
        hasRealGPS: true,
        address: resolvedAddress,
        shopMapLink: app.shopMapLink || '',
        locationNumber: app.locationNumber || '',
        img: resolveAgentAvatar({ ...app, img: resolvedPhoto }, app.userName),
        district: app.district || '',
        thana: app.thana || app.area || '',
        postOffice: app.postOffice || '',
        verified: true,
        status: 'Available',
        approvalStatus: 'approved',
        lastSeen: 'Active Now',
        whatsapp: app.whatsNumber || app.whatsapp || app.phone || '',
        messenger: '',
        liveLocationEnabled: false,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'agents', newAgentId), newAgentObj, { merge: true });
      await setDoc(doc(db, 'bap_agents', newAgentId), newAgentObj, { merge: true }).catch(() => {});

      if (app.userId) {
        await updateDoc(doc(db, 'users', app.userId), { role: 'agent' }).catch(() => {});
        try {
          const pendingFeeQ = query(
            collection(db, 'transactions'),
            where('userId', '==', app.userId),
            where('category', '==', 'agent_fee'),
            where('status', '==', 'pending')
          );
          const pendingFeeSnap = await getDocs(pendingFeeQ);
          await Promise.all(
            pendingFeeSnap.docs.map((d) =>
              updateDoc(doc(db, 'transactions', d.id), {
                status: 'completed',
                isApproved: true,
                reviewStatus: 'approved',
                updatedAt: new Date().toISOString(),
              })
            )
          );
        } catch {
          // ignore fee tx completion warning
        }
      }

      // 3. Dispatch dynamic notification to user's inbox
      const noticeId = 'notice_' + Date.now();
      await setDoc(doc(db, 'user_notifications', noticeId), {
        id: noticeId,
        userId: app.userId,
        title: '🛡️ এজেন্ট অনুমোদন বিজ্ঞপ্তি',
        message: `অভিনন্দন ${app.userName}! আপনার কো-অপারেটিভ এজেন্ট হওয়ার আবেদনটি সফলভাবে অনুমোদিত হয়েছে। এখন থেকে আপনি আমাদের অফিসিয়াল এজেন্ট ম্যাপে যুক্ত হয়েছেন।`,
        content: `অভিনন্দন ${app.userName}! আপনার কো-অপারেটিভ এজেন্ট হওয়ার আবেদনটি সফলভাবে অনুমোদিত হয়েছে। এখন থেকে আপনি আমাদের অফিসিয়াল রিপ্রেজেন্টেটিভ ম্যাপে যুক্ত হয়েছেন।`,
        createdAt: new Date().toISOString(),
        read: false,
      });

      fetchMyApplications();
      fetchAgents();
    } catch (err: any) {
      console.error('ত্রুটিঃ ' + err.message);
    }
  };

  const handleRejectApplication = async (app: any) => {
    const reason = window.prompt('আবেদনটি বাতিল করার কারণ লিখুন (ঐচ্ছিক):');
    if (reason === null) return; // cancelled
    const finalReason = reason.trim() || 'তথ্য অসম্পূর্ণ বা ত্রুটিপূর্ণ';
    try {
      const feeToRefund =
        !app.agentFeeRefunded && Number(app.agentApplicationFeeAmount) > 0
          ? Number(app.agentApplicationFeeAmount)
          : 0;
      const nowIso = new Date().toISOString();

      await runTransaction(db, async (transaction) => {
        const reqRef = doc(db, 'agent_requests', app.id);
        const freshReqSnap = await transaction.get(reqRef);
        const freshReq = freshReqSnap.exists() ? freshReqSnap.data() : app;

        const actualRefund =
          !freshReq?.agentFeeRefunded && Number(freshReq?.agentApplicationFeeAmount) > 0
            ? Number(freshReq.agentApplicationFeeAmount)
            : feeToRefund;

        if (actualRefund > 0 && app.userId) {
          const uRef = doc(db, 'users', app.userId);
          const uSnap = await transaction.get(uRef);
          if (uSnap.exists()) {
            const ud = uSnap.data() || {};
            const curBal = Number(ud.balance !== undefined ? ud.balance : ud.mainBalance) || 0;
            const nextBal = curBal + actualRefund;
            transaction.update(uRef, {
              balance: nextBal,
              mainBalance: nextBal,
              updatedAt: nowIso,
            });

            const refundTxRef = doc(collection(db, 'transactions'));
            transaction.set(refundTxRef, {
              id: refundTxRef.id,
              userId: app.userId,
              userName: app.userName || ud.name || '',
              userPhone: app.phone || ud.phone || '',
              type: 'agent_fee_refund',
              typeLabel: `এজেন্ট আবেদন বাতিল - ৳${actualRefund} ফি রিফান্ড`,
              category: 'agent_fee_refund',
              amount: actualRefund,
              beforeBalance: curBal,
              afterBalance: nextBal,
              postBalance: nextBal,
              status: 'completed',
              isApproved: true,
              paymentMethod: 'মেইন ব্যালেন্স রিফান্ড',
              description: `এজেন্ট আবেদন বাতিল হওয়ায় ৳${actualRefund} টাকা আপনার মেইন ব্যালেন্সে ফেরত দেওয়া হয়েছে। কারণ: ${finalReason}`,
              createdAt: nowIso,
              date: new Date().toLocaleDateString('en-GB'),
              time: new Date().toLocaleTimeString(),
            });

            const refundLedgerRef = doc(collection(db, 'wallet_ledger'));
            transaction.set(refundLedgerRef, {
              id: refundLedgerRef.id,
              userId: app.userId,
              type: 'CREDIT',
              channel: 'agent_application_refund',
              category: 'agent_fee',
              amount: actualRefund,
              beforeBalance: curBal,
              afterBalance: nextBal,
              description: `Agent application rejected refund (${finalReason})`,
              createdAt: nowIso,
            });
          }
        }

        transaction.update(reqRef, {
          status: 'rejected',
          processedAt: serverTimestamp(),
          rejectReason: finalReason,
          agentFeeRefunded: actualRefund > 0 ? true : Boolean(freshReq?.agentFeeRefunded),
          agentFeeRefundedAt: actualRefund > 0 ? nowIso : freshReq?.agentFeeRefundedAt || null,
        });
      });

      if (app.userId) {
        try {
          const pendingFeeQ = query(
            collection(db, 'transactions'),
            where('userId', '==', app.userId),
            where('category', '==', 'agent_fee'),
            where('status', '==', 'pending')
          );
          const pendingFeeSnap = await getDocs(pendingFeeQ);
          await Promise.all(
            pendingFeeSnap.docs.map((d) =>
              updateDoc(doc(db, 'transactions', d.id), {
                status: 'rejected',
                isApproved: false,
                rejectReason: finalReason,
                updatedAt: nowIso,
              })
            )
          );
        } catch {
          // ignore pending tx update failure
        }
      }

      // 2. Dispatch dynamic notification to user's inbox
      const noticeId = 'notice_' + Date.now();
      const refundText = feeToRefund > 0 ? ` আবেদন ফি ৳${feeToRefund} আপনার মেইন ব্যালেন্সে ফেরত দেওয়া হয়েছে।` : '';
      await setDoc(doc(db, 'user_notifications', noticeId), {
        id: noticeId,
        userId: app.userId,
        title: '❌ এজেন্ট আবেদন বাতিল',
        message: `দুঃখিত ${app.userName}, আপনার এজেন্ট হওয়ার আবেদনটি বাতিল করা হয়েছে। কারণঃ ${finalReason}।${refundText}`,
        content: `দুঃখিত ${app.userName}, আপনার এজেন্ট হওয়ার আবেদনটি বাতিল করা হয়েছে। কারণঃ ${finalReason}।${refundText}`,
        createdAt: nowIso,
        read: false
      });

      fetchMyApplications();
    } catch (err: any) {
      console.error('ত্রুটিঃ ' + err.message);
    }
  };

  const handleDeleteAgent = async (targetOrId: any) => {
    try {
      const isObj = targetOrId && typeof targetOrId === 'object';
      const rawId = String(isObj ? targetOrId.id || targetOrId.docId || '' : targetOrId || '').trim();
      const targetUserId = String(isObj ? targetOrId.userId || targetOrId.uid || '' : '').trim();
      const targetPhone = String(isObj ? targetOrId.phone || targetOrId.mobile || '' : '').trim();

      const candidateIds = Array.from(
        new Set([rawId, targetUserId, targetUserId ? `agent_${targetUserId}` : ''].filter(Boolean))
      );

      for (const cid of candidateIds) {
        await deleteDoc(doc(db, 'agents', cid)).catch(() => {});
        await deleteDoc(doc(db, 'bap_agents', cid)).catch(() => {});
        await deleteDoc(doc(db, 'agent_requests', cid)).catch(() => {});
        await deleteDoc(doc(db, 'agent_applications', cid)).catch(() => {});
      }

      const collectionsToClean = ['agents', 'bap_agents', 'agent_requests', 'agent_applications'];
      for (const colName of collectionsToClean) {
        try {
          const snap = await getDocs(collection(db, colName));
          for (const d of snap.docs) {
            const data = d.data() || {};
            const dPhone = String(data.phone || data.mobile || '').trim();
            const dUserId = String(data.userId || data.uid || '').trim();
            const dId = String(data.id || d.id || '').trim();
            if (
              (rawId && (d.id === rawId || dId === rawId)) ||
              (targetUserId && (d.id === targetUserId || dUserId === targetUserId)) ||
              (targetPhone && dPhone && dPhone === targetPhone)
            ) {
              await deleteDoc(doc(db, colName, d.id)).catch(() => {});
            }
          }
        } catch {
          // Ignore single collection error
        }
      }

      if (targetUserId) {
        await updateDoc(doc(db, 'users', targetUserId), { role: 'user' }).catch(() => {});
      }

      setHighlightedAgentId(null);
      fetchMyApplications();
      fetchAgents();
    } catch (err: any) {
      console.error('ত্রুটিঃ ' + err.message);
    }
  };

  useEffect(() => {
    if (activeTab === 'my-applications') {
      fetchMyApplications();
    }
  }, [activeTab]);

  // Reverse Geocoding Coordinates to District & Area/Thana
  const fetchAddressFromCoords = async (latitude: number, longitude: number) => {
    setIsFetchingAddress(true);
    setErrorMessage('');
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=bn,en`
      );
      
      if (!response.ok) {
        throw new Error('ঠিকানা সার্ভার থেকে সাড়া পাওয়া যায়নি।');
      }
      
      const data = await response.json();
      if (data && data.address) {
        const addr = data.address;
        
        let rawDistrict = addr.district || addr.state_district || addr.city || addr.state || '';
        let cleanDistrict = rawDistrict
          .replace(/District/gi, '')
          .replace(/Division/gi, '')
          .replace(/City/gi, '')
          .trim();
          
        let cleanArea = addr.suburb || addr.neighbourhood || addr.village || addr.city_district || addr.county || addr.town || addr.municipality || addr.road || '';
        cleanArea = cleanArea.trim();
        
        if (!cleanDistrict) {
          cleanDistrict = 'ঢাকা';
        }
        if (!cleanArea) {
          cleanArea = 'চিহ্নিত এলাকা';
        }

        setDistrict(cleanDistrict);
        setAreaName(cleanArea);
        setApplyLat(latitude);
        setApplyLng(longitude);
        
        if (!userLocation) {
          setUserLocation({ lat: latitude, lng: longitude });
        }
        return { district: cleanDistrict, area: cleanArea, lat: latitude, lng: longitude };
      }
    } catch (error: any) {
      console.error('Reverse geocoding error:', error);
      setErrorMessage('ঠিকানা লোড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setIsFetchingAddress(false);
    }
    return null;
  };

  // Smart Geocoding for Map Link or Location Text
  const geocodeTextOrLink = async (textInput: string) => {
    if (!textInput || !textInput.trim()) return null;
    setIsFetchingAddress(true);
    
    // Check direct coordinates first
    const parsedCoords = parseCoordinatesFromInput(textInput);
    if (parsedCoords) {
      return await fetchAddressFromCoords(parsedCoords.lat, parsedCoords.lng);
    }

    // Try extracting place name from URL or text
    let queryText = textInput.trim();
    if (queryText.includes('google.com/maps/place/')) {
      const parts = queryText.split('google.com/maps/place/');
      if (parts[1]) {
        queryText = decodeURIComponent(parts[1].split('/')[0].replace(/\+/g, ' '));
      }
    }

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryText)}&format=json&accept-language=bn,en&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        if (!isNaN(lat) && !isNaN(lon)) {
          return await fetchAddressFromCoords(lat, lon);
        }
      }
    } catch (err) {
      console.error('Search geocode error:', err);
    } finally {
      setIsFetchingAddress(false);
    }
    return null;
  };

  // Handle Auto-Fetch GPS Address
  const handleAutoFetchAddress = () => {
    setIsFetchingAddress(true);
    setErrorMessage('');
    
    if (!navigator.geolocation) {
      setErrorMessage('আপনার ব্রাউজারে জিপিএস লোকেশন সনাক্ত করার সুবিধা নেই।');
      setIsFetchingAddress(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        await fetchAddressFromCoords(latitude, longitude);
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMsg = 'জিপিএস দিয়ে আপনার অবস্থান সনাক্ত করতে ব্যর্থ হয়েছে।';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'অনুগ্রহ করে ব্রাউজারে জিপিএস লোকেশন পারমিশন দিন।';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'জিপিএস নেটওয়ার্ক পাওয়া যায়নি।';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'লোকেশন সনাক্ত করতে সময় শেষ হয়েছে (Timeout)।';
        }
        setErrorMessage(errorMsg);
        setIsFetchingAddress(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  // Handle simplified application submission (with ৳100 Main Balance atomic fee deduction & user photo attachment)
  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedName = (fullName || user.name || '').trim();
    const resolvedPhone = (phoneNumber || user.phone || '').trim();
    const resolvedWhatsapp = whatsNumber.trim();
    const resolvedShopAddress = writtenLocation.trim();
    const resolvedMapSerial = locationNumber.trim();
    const resolvedNid = (agentNid || existingProfileNid).trim();
    const resolvedNomName = (agentNomineeName || existingProfileNominee?.name || '').trim();
    const resolvedNomRelation = (agentNomineeRelation || existingProfileNominee?.relation || '').trim();
    const resolvedNomPhone = (agentNomineePhone || existingProfileNominee?.phone || '').trim();

    if (!resolvedName || !resolvedPhone) {
      setErrorMessage('প্রোফাইলের নাম ও মোবাইল নম্বর পাওয়া যায়নি।');
      return;
    }
    if (!resolvedWhatsapp || resolvedWhatsapp.replace(/\D/g, '').length < 7) {
      setErrorMessage('অনুগ্রহ করে আপনার সচল হোয়াটসঅ্যাপ নম্বর লিখুন।');
      return;
    }
    if (!resolvedShopAddress) {
      setErrorMessage('অনুগ্রহ করে আপনার দোকান বা ব্যবসার ঠিকানা লিখুন।');
      return;
    }
    if (!resolvedMapSerial) {
      setErrorMessage('অনুগ্রহ করে গুগল ম্যাপ থেকে কপি করা সিরিয়াল নম্বর / কোঅর্ডিনেট বা লিংক বসান।');
      return;
    }
    if (!resolvedNid || resolvedNid.length < 6) {
      setErrorMessage('এজেন্ট হওয়ার জন্য আপনার সঠিক এনআইডি (NID) কার্ড নম্বর প্রদান করা বাধ্যতামূলক।');
      return;
    }
    if (!hasCompleteSamityAutoInfo) {
      if (!resolvedNomName || !resolvedNomRelation || !resolvedNomPhone || resolvedNomPhone.replace(/\D/g, '').length < 7) {
        setErrorMessage('নমিনির নাম, সম্পর্ক এবং সচল মোবাইল নম্বর প্রদান করা বাধ্যতামূলক।');
        return;
      }
    }

    if (effectiveApplicationFee > 0 && liveUserBalance < effectiveApplicationFee) {
      setErrorMessage(
        `⚠️ সাধারণ সদস্যদের এজেন্ট আবেদন করার জন্য মেইন ব্যালেন্সে কমপক্ষে ৳${effectiveApplicationFee} টাকা থাকতে হবে! (বর্তমান মেইন ব্যালেন্স: ৳${liveUserBalance.toLocaleString('bn-BD')})। আগে মেইন ব্যালেন্সে টাকা অ্যাড মানি করুন অথবা সমবায়/ইনভেস্টর সদস্য হলে প্রোফাইল আপডেট করুন।`
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      let finalLat = applyLat;
      let finalLng = applyLng;
      let resolvedDistrict = district || user.district || '';
      let resolvedArea = areaName || user.thana || '';

      // 1. Parse coordinates directly from pasted Google Maps serial/coordinates or link
      const directCoords = parseCoordinatesFromInput(resolvedMapSerial);
      if (directCoords) {
        finalLat = directCoords.lat;
        finalLng = directCoords.lng;
      } else {
        // 2. Fallback: attempt geocoding from map serial/link or shop address
        const geoFromSerial = await geocodeAddressWithGoogle(resolvedMapSerial);
        if (geoFromSerial) {
          finalLat = geoFromSerial.lat;
          finalLng = geoFromSerial.lng;
        } else {
          const geoFromAddr = await geocodeAddressWithGoogle(resolvedShopAddress);
          if (geoFromAddr) {
            finalLat = geoFromAddr.lat;
            finalLng = geoFromAddr.lng;
          }
        }
      }

      if (finalLat && finalLng && (!resolvedDistrict || !resolvedArea)) {
        const reverseInfo = await fetchAddressFromCoords(finalLat, finalLng).catch(() => null);
        if (reverseInfo) {
          resolvedDistrict = resolvedDistrict || reverseInfo.district;
          resolvedArea = resolvedArea || reverseInfo.area;
        }
      }

      const finalLatNum = finalLat || (userLocation ? userLocation.lat : 23.8103);
      const finalLngNum = finalLng || (userLocation ? userLocation.lng : 90.4125);
      const addressParts = resolvedShopAddress.split(',').map((s) => s.trim()).filter(Boolean);
      const fallbackArea = resolvedArea || addressParts[0] || resolvedShopAddress;
      const fallbackDistrict = resolvedDistrict || addressParts[addressParts.length - 1] || 'Bangladesh';

      const nowIso = new Date().toISOString();
      const userRef = doc(db, 'users', user.uid);
      const reqRef = doc(collection(db, 'agent_requests'));
      const txDocRef = doc(collection(db, 'transactions'));
      const ledgerRef = doc(collection(db, 'wallet_ledger'));
      const userNotifRef = doc(collection(db, 'user_notifications'));

      let chargedFeeAmount = 0;

      await runTransaction(db, async (transaction) => {
        const latestUserSnap = await transaction.get(userRef);
        const latestUserData = latestUserSnap.exists() ? latestUserSnap.data() : null;

        const mergedDbProfile = { ...effectiveUserProfile, ...(latestUserData || {}) };
        const serverEligibility = evaluateSamityFreeAgentEligibility(mergedDbProfile);
        const serverIsSamityInvestor = serverEligibility.isFreeEligible;

        const txFeeAmount = serverIsSamityInvestor ? 0 : AGENT_APPLICATION_FEE;
        chargedFeeAmount = txFeeAmount;

        const currentBal = latestUserData
          ? (Number(latestUserData.balance !== undefined ? latestUserData.balance : latestUserData.mainBalance) || 0)
          : liveUserBalance;

        if (txFeeAmount > 0 && currentBal < txFeeAmount) {
          throw new Error(
            `⚠️ আপনার মেইন ব্যালেন্সে এজেন্ট আবেদন ফি বাবদ ৳${txFeeAmount} টাকা নেই! (বর্তমান মেইন ব্যালেন্স: ৳${currentBal.toLocaleString('bn-BD')})।`
          );
        }

        const newMainBalance = currentBal - txFeeAmount;
        const profilePhotoFromDb = latestUserData
          ? String(
              latestUserData.photoURL ||
                latestUserData.photoUrl ||
                latestUserData.profilePic ||
                latestUserData.img ||
                latestUserData.avatar ||
                ''
            ).trim()
          : '';
        const cleanProfilePhoto =
          (profilePhotoFromDb && !profilePhotoFromDb.includes('1534528741775-53994a69daeb')
            ? profilePhotoFromDb
            : '') ||
          (liveUserPhoto && !liveUserPhoto.includes('1534528741775-53994a69daeb')
            ? liveUserPhoto
            : '');

        const generatedAgentSerial = `AG-${(String(resolvedPhone).replace(/\D/g, '').slice(-4) || '2041').padStart(4, '2')}`;

        const newRequest = {
          id: reqRef.id,
          userId: user.uid,
          userName: resolvedName,
          phone: resolvedPhone,
          email: user.email || '',
          img: cleanProfilePhoto,
          photoURL: cleanProfilePhoto,
          agentCode: generatedAgentSerial,
          district: fallbackDistrict,
          area: fallbackArea,
          thana: fallbackArea,
          postOffice: addressParts[0] || '',
          experience: experience || 'নেই',
          whatsapp: resolvedWhatsapp,
          whatsNumber: resolvedWhatsapp,
          shopMapLink: resolvedMapSerial,
          writtenLocation: resolvedShopAddress,
          address: resolvedShopAddress,
          locationNumber: resolvedMapSerial,
          nid: resolvedNid,
          nidNumber: resolvedNid,
          nomineeName: resolvedNomName,
          nomineeRelation: resolvedNomRelation,
          nomineePhone: resolvedNomPhone,
          applicantType: serverIsSamityInvestor ? 'samity_investor' : 'general',
          isSamityMember: serverIsSamityInvestor || isSamityMemberAccount,
          agentApplicationFeeAmount: txFeeAmount,
          agentFeePaid: txFeeAmount > 0,
          agentFeeWaived: txFeeAmount === 0,
          feeWaivedReason: txFeeAmount === 0 ? 'samity_investor_free' : '',
          agentFeeRefunded: false,
          weeklySchedule,
          weeklyOffDays: getWeeklyOffDays(weeklySchedule),
          openingHours: buildOpeningHoursSummary(weeklySchedule),
          status: 'pending',
          createdAt: serverTimestamp(),
          appliedAtStr: new Date().toLocaleString('en-US'),
          lat: finalLatNum,
          lng: finalLngNum,
          realLat: finalLatNum,
          realLng: finalLngNum,
          hasRealGPS: Boolean(finalLat && finalLng),
        };

        const userUpdate: Record<string, any> = {
          district: fallbackDistrict,
          thana: fallbackArea,
          area: fallbackArea,
          shopMapLink: resolvedMapSerial,
          locationNumber: resolvedMapSerial,
          writtenLocation: resolvedShopAddress,
          whatsapp: resolvedWhatsapp,
          weeklySchedule,
          weeklyOffDays: getWeeklyOffDays(weeklySchedule),
          openingHours: buildOpeningHoursSummary(weeklySchedule),
          realLat: finalLatNum,
          realLng: finalLngNum,
          hasRealGPS: Boolean(finalLat && finalLng),
          updatedAt: nowIso,
        };
        if (txFeeAmount > 0) {
          userUpdate.balance = newMainBalance;
          userUpdate.mainBalance = newMainBalance;
        }
        if (!existingProfileNid && resolvedNid) {
          userUpdate.nid = resolvedNid;
          userUpdate.nidNumber = resolvedNid;
        }
        if (!existingProfileNominee?.name && resolvedNomName) {
          userUpdate.nomineeName = resolvedNomName;
          userUpdate.nomineeRelation = resolvedNomRelation;
          userUpdate.nomineePhone = resolvedNomPhone;
          userUpdate.nominees = [
            {
              id: 'nom_1',
              name: resolvedNomName,
              relation: resolvedNomRelation,
              phone: resolvedNomPhone,
            },
          ];
        }

        transaction.set(reqRef, newRequest);
        transaction.set(userRef, userUpdate, { merge: true });

        if (txFeeAmount > 0) {
          transaction.set(txDocRef, {
            id: txDocRef.id,
            userId: user.uid,
            userName: resolvedName,
            userPhone: resolvedPhone,
            memberId: (user as any).memberId || '',
            type: 'agent_fee',
            typeLabel: 'BNB এজেন্ট আবেদন ফি (৳১০০ কর্তন)',
            category: 'agent_fee',
            amount: txFeeAmount,
            totalDeducted: txFeeAmount,
            beforeBalance: currentBal,
            afterBalance: newMainBalance,
            postBalance: newMainBalance,
            status: 'pending',
            isApproved: false,
            paymentMethod: 'মেইন ব্যালেন্স কর্তন',
            description: `BNB এজেন্ট হিসেবে আবেদনের ফি বাবদ ৳${txFeeAmount} টাকা আপনার মেইন ব্যালেন্স থেকে কেটে নেওয়া হয়েছে। এডমিন বাতিল করলে টাকা ফেরত পাবেন।`,
            createdAt: nowIso,
            date: new Date().toLocaleDateString('en-GB'),
            time: new Date().toLocaleTimeString(),
            receiptNo: `REC-AGT-${Date.now()}`,
          });
          transaction.set(ledgerRef, {
            id: ledgerRef.id,
            userId: user.uid,
            type: 'DEBIT',
            channel: 'agent_application',
            category: 'agent_fee',
            amount: txFeeAmount,
            beforeBalance: currentBal,
            afterBalance: newMainBalance,
            description: 'BNB Agent Application Fee (৳100)',
            createdAt: nowIso,
          });
        }

        transaction.set(userNotifRef, {
          id: userNotifRef.id,
          userId: user.uid,
          title:
            txFeeAmount === 0
              ? '🤝 ফ্রি এজেন্ট আবেদন জমা (সমবায়/ইনভেস্টর সুবিধা)'
              : '🤝 এজেন্ট আবেদন জমা ও ৳১০০ ফি কর্তন',
          message:
            txFeeAmount === 0
              ? 'আপনার সমবায় সমিতি / ইনভেস্টর প্রোফাইলের বিশেষ সুবিধায় কোনো ফি ছাড়াই (৳০ ফ্রি) BNB এজেন্ট আবেদন সফলভাবে জমা হয়েছে! এডমিন রিভিউয়ের পর ম্যাপে যুক্ত হবেন।'
              : `আপনার BNB এজেন্ট আবেদনটি সফলভাবে জমা হয়েছে এবং আবেদন ফি বাবদ ৳${txFeeAmount} টাকা মেইন ব্যালেন্স থেকে কাটা হয়েছে। এডমিন রিভিউয়ের পর ম্যাপে যুক্ত হবেন।`,
          type: 'agent_applied',
          read: false,
          createdAt: nowIso,
        });
      });

      addDoc(collection(db, 'admin_notifications'), {
        title:
          chargedFeeAmount === 0
            ? '🤝 নতুন BNB এজেন্ট আবেদন (সমবায়/ইনভেস্টর • ফ্রি)'
            : '🤝 নতুন BNB এজেন্ট ও প্রতিনিধি আবেদন (৳১০০ ফি পেইড)',
        message:
          chargedFeeAmount === 0
            ? `${resolvedName} (${(user as any).memberId || resolvedPhone}) সমবায়/ইনভেস্টর সদস্য হিসেবে ফ্রিতে (৳০) এজেন্ট আবেদন করেছেন।`
            : `${resolvedName} (${(user as any).memberId || resolvedPhone}) এজেন্ট হিসেবে আবেদন করেছেন (৳${chargedFeeAmount} ফি কর্তন)।`,
        userId: user.uid,
        userName: resolvedName,
        memberId: (user as any).memberId || '',
        userPhone: resolvedPhone,
        type: 'agent_application',
        read: false,
        createdAt: nowIso,
      }).catch((e) => console.warn('Admin notif error:', e));

      setSuccessMessage(
        chargedFeeAmount === 0
          ? 'অভিনন্দন! সমবায়/ইনভেস্টর সদস্য হওয়ায় কোনো টাকা ছাড়াই (৳০ ফ্রি) আপনার এজেন্ট আবেদনটি সফলভাবে জমা হয়েছে। এডমিন অনুমোদন দিলে ম্যাপে যুক্ত হয়ে যাবেন!'
          : 'আপনার এজেন্ট আবেদনটি সফলভাবে জমা হয়েছে এবং মেইন ব্যালেন্স থেকে ৳১০০ আবেদন ফি কাটা হয়েছে! এডমিন যাচাই করে অনুমোদন দিলে ম্যাপে যুক্ত হয়ে যাবেন।'
      );

      setWhatsNumber('');
      setShopMapLink('');
      setWrittenLocation('');
      setLocationNumber('');
      setApplyLat(null);
      setApplyLng(null);

      setTimeout(() => {
        setActiveTab('my-applications');
        setSuccessMessage('');
      }, 3000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'পদ্ধতিগত ত্রুটি হয়েছে, আবার চেষ্টা করুন।');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProfFetchGPS = () => {
    setIsProfFetchingGPS(true);
    setProfError('');
    setProfSuccess('');

    if (!navigator.geolocation) {
      setProfError('আপনার ব্রাউজারে জিপিএস সনাক্তকরণ সমর্থন করে না।');
      setIsProfFetchingGPS(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setProfLat(latitude);
        setProfLng(longitude);

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=bn,en`
          );
          if (!res.ok) throw new Error('Reverse geocoding failed');
          const data = await res.json();
          if (data && data.address) {
            const addr = data.address;

            let rawDistrict = addr.district || addr.state_district || addr.city || addr.state || '';
            let cleanDistrict = rawDistrict
              .replace(/District/gi, '')
              .replace(/Division/gi, '')
              .replace(/City/gi, '')
              .trim();

            let cleanArea = addr.suburb || addr.neighbourhood || addr.village || addr.city_district || addr.county || addr.town || addr.municipality || addr.road || '';
            cleanArea = cleanArea.trim();

            const detectedCountry = addr.country || 'Bangladesh';

            setProfDist(cleanDistrict || 'বাংলাদেশ');
            setProfThana(cleanArea || 'চিহ্নিত এলাকা');
            setProfCity(cleanArea || addr.city || 'চিহ্নিত শহর');
            setProfCountry(detectedCountry);
            setProfSuccess('আপনার জিপিএস লোকেশন ও ঠিকানা সফলভাবে সনাক্ত করা হয়েছে!');
          } else {
            setProfSuccess('লোকেশন কোঅর্ডিনেট সেট করা হয়েছে। জেলা/থানা অনুগ্রহ করে টাইপ করুন।');
          }
        } catch (e) {
          console.error(e);
          setProfSuccess('লোকেশন কোঅর্ডিনেট সেট করা হয়েছে (সার্ভার অফলাইন)।');
        } finally {
          setIsProfFetchingGPS(false);
        }
      },
      (err) => {
        console.error(err);
        setProfError('জিপিএস লোকেশন এক্সেস ব্যর্থ হয়েছে। অনুগ্রহ করে ব্রাউজার পারমিশন চেক করুন।');
        setIsProfFetchingGPS(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  const handleProfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profName || !profPhone || !profDist || !profThana) {
      setProfError('অনুগ্রহ করে নাম, সচল ফোন নম্বর, জেলা ও থানা সহ পূর্ণাঙ্গ তথ্য দিন।');
      return;
    }

    setIsProfSubmitting(true);
    setProfError('');
    setProfSuccess('');

    try {
      const newRequest = {
        userId: user.uid,
        userName: profName,
        phone: profPhone,
        whatsNumber: profWhats || profPhone,
        country: profCountry,
        area: profCity || profThana,
        city: profCity || profThana,
        district: profDist,
        thana: profThana,
        postOffice: profPost || '',
        lat: profLat,
        lng: profLng,
        experience: myAgentProfile ? 'প্রোফাইল সংশোধন আবেদন' : 'নতুন এজেন্ট তালিকাভুক্তি',
        status: 'pending',
        createdAt: serverTimestamp(),
        appliedAtStr: new Date().toLocaleString('en-US')
      };

      await addDoc(collection(db, 'agent_requests'), newRequest);
      addDoc(collection(db, 'admin_notifications'), {
        title: '🤝 নতুন BNB এজেন্ট ও প্রতিনিধি আবেদন',
        message: `${user.name || 'সদস্য'} (${(user as any).memberId || 'N/A'}) এজেন্ট হিসেবে আবেদন করেছেন।`,
        userId: user.uid,
        userName: user.name || '',
        memberId: (user as any).memberId || '',
        userPhone: user.phone || '',
        type: 'agent_application',
        read: false,
        createdAt: new Date().toISOString()
      }).catch(e => console.warn('Admin notif error:', e));
      
      setProfSuccess('আপনার পরিবর্তনের আবেদনটি সফলভাবে দাখিল করা হয়েছে! অ্যাডমিন অনুমোদন করার সাথে সাথে এটি ম্যাপে আপডেট হয়ে যাবে।');
      
      setTimeout(() => {
        setActiveTab('my-applications');
        setProfSuccess('');
      }, 3000);

    } catch (err: any) {
      setProfError('পদ্ধতিগত ত্রুটি: ' + err.message);
    } finally {
      setIsProfSubmitting(false);
    }
  };

  // WhatsApp Business-Style Agent Operating Hours & Weekly Off-Day Handler
  const updateDaySchedule = (dayKey: DayKey, patch: Partial<AgentWeeklySchedule[DayKey]>) => {
    setWeeklySchedule((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        ...patch,
      },
    }));
    setScheduleSuccessMsg('');
    setScheduleErrorMsg('');
  };

  const applyFirstOpenDayToAllOpenDays = () => {
    const sourceDay =
      WEEK_DAYS.find((d) => weeklySchedule[d.key]?.enabled)?.key || 'sat';
    const template = weeklySchedule[sourceDay];
    setWeeklySchedule((prev) => {
      const next = { ...prev };
      for (const { key } of WEEK_DAYS) {
        if (next[key].enabled) {
          next[key] = {
            ...next[key],
            slot1Start: template.slot1Start,
            slot1End: template.slot1End,
            hasSecondSlot: template.hasSecondSlot,
            slot2Start: template.slot2Start,
            slot2End: template.slot2End,
          };
        }
      }
      return next;
    });
    setScheduleSuccessMsg('সব খোলা দিনের সময়সূচি একসাথে আপডেট করা হয়েছে। সেভ করতে নিচের বাটনে চাপুন।');
    setScheduleErrorMsg('');
  };

  const handleSaveAgentSchedule = async () => {
    if (!user?.uid || isSavingSchedule) return;
    setScheduleErrorMsg('');
    setScheduleSuccessMsg('');

    // Validate time slots for open days
    for (const { key, labelBn } of WEEK_DAYS) {
      const cfg = weeklySchedule[key];
      if (!cfg.enabled) continue;
      if (!cfg.slot1Start || !cfg.slot1End || cfg.slot1Start >= cfg.slot1End) {
        setScheduleErrorMsg(`${labelBn}: ১ম শিফটের শুরুর সময় শেষের সময়ের আগে হতে হবে।`);
        return;
      }
      if (cfg.hasSecondSlot) {
        if (!cfg.slot2Start || !cfg.slot2End || cfg.slot2Start >= cfg.slot2End) {
          setScheduleErrorMsg(`${labelBn}: ২য় শিফটের শুরুর সময় শেষের সময়ের আগে হতে হবে।`);
          return;
        }
        if (cfg.slot2Start <= cfg.slot1End) {
          setScheduleErrorMsg(`${labelBn}: বিরতির পর ২য় শিফটের সময় অবশ্যই ১ম শিফটের শেষের পর হতে হবে।`);
          return;
        }
      }
    }

    setIsSavingSchedule(true);
    try {
      const openingHoursSummary = buildOpeningHoursSummary(weeklySchedule);
      const weeklyOffDays = getWeeklyOffDays(weeklySchedule);
      const schedulePayload = {
        weeklySchedule,
        weeklyOffDays,
        openingHours: openingHoursSummary,
        openingHoursUpdatedAt: serverTimestamp(),
        updatedAt: new Date().toISOString(),
      };

      const writes: Promise<any>[] = [
        setDoc(doc(db, 'users', user.uid), schedulePayload, { merge: true }),
      ];

      if (myAgentProfile?.id) {
        writes.push(
          setDoc(doc(db, 'agents', myAgentProfile.id), schedulePayload, { merge: true }).catch(() => {}),
          setDoc(doc(db, 'bap_agents', myAgentProfile.id), schedulePayload, { merge: true }).catch(() => {}),
          updateDoc(doc(db, 'agent_requests', myAgentProfile.id), schedulePayload).catch(() => {})
        );
      }

      if (myAgentProfile || user.role === 'agent') {
        writes.push(
          updateDoc(doc(db, 'agents', user.uid), schedulePayload).catch(() => {}),
          updateDoc(doc(db, 'bap_agents', user.uid), schedulePayload).catch(() => {})
        );
      }

      await Promise.all(writes);

      if (myAgentProfile) {
        setMyAgentProfile((prev) =>
          prev
            ? {
                ...prev,
                weeklySchedule,
                weeklyOffDays,
                openingHours: openingHoursSummary,
              }
            : null
        );
        setAgentsList((prev) =>
          prev.map((a) =>
            a.id === myAgentProfile.id || a.phone === user.phone
              ? {
                  ...a,
                  weeklySchedule,
                  weeklyOffDays,
                  openingHours: openingHoursSummary,
                }
              : a
          )
        );
      }

      setScheduleSuccessMsg(
        'আপনার খোলার সময়, ডাবল বিরতি এবং সাপ্তাহিক বন্ধের দিন সফলভাবে সেভ ও লাইভ ম্যাপে আপডেট হয়েছে!'
      );
    } catch (err: any) {
      console.error('Schedule save error:', err);
      setScheduleErrorMsg('সময়সূচি সেভ করতে সমস্যা হয়েছে: ' + (err?.message || 'আবার চেষ্টা করুন'));
    } finally {
      setIsSavingSchedule(false);
    }
  };

  // Agent Control Panel Operations
  const handleUpdateAgentStatus = async (newStatus: 'Available' | 'Busy' | 'Offline') => {
    if (!myAgentProfile) return;
    try {
      const updateData = { status: newStatus, lastSeen: newStatus === 'Available' ? 'Active Now' : newStatus === 'Busy' ? 'Busy' : 'Active 5m ago' };
      await updateDoc(doc(db, 'agents', myAgentProfile.id), updateData);
      await updateDoc(doc(db, 'bap_agents', myAgentProfile.id), updateData).catch(() => {});
      
      setMyAgentProfile(prev => prev ? { ...prev, ...updateData } : null);
      setAgentsList(prev => prev.map((a, _idx) => a.id === myAgentProfile.id ? { ...a, ...updateData } : a));
    } catch (e: any) {
      console.error('Error updating status: ' + e.message);
    }
  };

  const handleToggleLiveLocation = async (enabled: boolean) => {
    if (!myAgentProfile) return;
    try {
      const updateData = { liveLocationEnabled: enabled };
      await updateDoc(doc(db, 'agents', myAgentProfile.id), updateData);
      await updateDoc(doc(db, 'bap_agents', myAgentProfile.id), updateData).catch(() => {});
      
      setMyAgentProfile(prev => prev ? { ...prev, ...updateData } : null);
      setAgentsList(prev => prev.map((a, _idx) => a.id === myAgentProfile.id ? { ...a, ...updateData } : a));
    } catch (e: any) {
      console.error('Error toggling location broadcast: ' + e.message);
    }
  };


  // Update static position using current GPS
  const handleUpdateAgentCoordinates = async () => {
    if (!myAgentProfile || isUpdatingLoc) return;
    setIsUpdatingLoc(true);
    
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported by this browser.');
      setIsUpdatingLoc(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const latVal = pos.coords.latitude;
          const lngVal = pos.coords.longitude;
          const updateData = {
            lat: latVal,
            lng: lngVal,
            realLat: latVal,
            realLng: lngVal,
            latitude: latVal,
            longitude: lngVal,
            hasRealGPS: true,
            liveLocationEnabled: false, // Explicitly false as we only want static fixed points
            lastSeen: 'Active Now',
            lastUpdatedTs: Date.now()
          };
          
          const batchPromises = [
            updateDoc(doc(db, 'agents', myAgentProfile.id), updateData).catch(() => {}),
            updateDoc(doc(db, 'bap_agents', myAgentProfile.id), updateData).catch(() => {}),
            updateDoc(doc(db, 'users', user.uid), updateData).catch(() => {})
          ];
          
          if (myAgentProfile.id !== user.uid) {
            batchPromises.push(updateDoc(doc(db, 'users', myAgentProfile.id), updateData).catch(() => {}));
          }
          
          await Promise.all(batchPromises);
          
          setMyAgentProfile(prev => prev ? { ...prev, ...updateData, hasRealGPS: true } : null);
          setAgentsList(prev => prev.map((a) => a.id === myAgentProfile.id ? { ...a, ...updateData, hasRealGPS: true } : a));
          setManualLat(latVal.toString());
          setManualLng(lngVal.toString());
          console.log('আপনার স্থায়ী জিপিএস অবস্থান সফলভাবে ডাটাবেসে সেভ করা হয়েছে!');
        } catch (err: any) {
          console.error('Failed to update coordinates: ' + err.message);
        } finally {
          setIsUpdatingLoc(false);
        }
      },
      (err) => {
        console.warn('GPS detection failed: ' + err.message);
        setIsUpdatingLoc(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Manual Coordinate Entry Handler (The "GPS Number" feature)
  const handleSaveManualLocation = async () => {
    if (!myAgentProfile || isSavingManualLoc) return;
    
    const latNum = parseFloat(manualLat);
    const lngNum = parseFloat(manualLng);
    
    if (isNaN(latNum) || isNaN(lngNum)) {
      alert('অনুগ্রহ করে সঠিক ল্যাটিটিউড এবং লঙ্গিটিউড (GPS Number) প্রদান করুন।');
      return;
    }

    if (!window.confirm('আপনার লোকেশন পরিবর্তনের জন্য এডমিন প্যানেলে আবেদন পাঠানো হবে। এডমিন অনুমোদন করলে ম্যাপে আপনার নতুন অবস্থান দেখা যাবে। আপনি কি নিশ্চিত?')) {
      return;
    }

    setIsSavingManualLoc(true);
    try {
      const updateRequest = {
        userId: user.uid,
        userName: user.name || 'Agent',
        phone: user.phone || '',
        lat: latNum,
        lng: lngNum,
        realLat: latNum,
        realLng: lngNum,
        shopMapLink: writtenLocation || myAgentProfile.shopMapLink || '',
        type: 'location_update',
        status: 'pending',
        createdAt: serverTimestamp(),
        appliedAtStr: new Date().toLocaleString('en-US'),
        experience: 'এজেন্ট লোকেশন পরিবর্তন আবেদন'
      };

      await addDoc(collection(db, 'agent_requests'), updateRequest);
      
      addDoc(collection(db, 'admin_notifications'), {
        title: '📍 এজেন্ট লোকেশন পরিবর্তনের আবেদন',
        message: `${user.name || 'এজেন্ট'} তার ম্যাপ লোকেশন পরিবর্তনের আবেদন করেছেন।`,
        userId: user.uid,
        userName: user.name || '',
        type: 'agent_location_update',
        read: false,
        createdAt: new Date().toISOString()
      }).catch(() => {});

      alert('আপনার লোকেশন পরিবর্তনের আবেদনটি সফলভাবে পাঠানো হয়েছে। এডমিন অনুমোদনের পর ম্যাপ আপডেট হবে।');
      setWrittenLocation('');
    } catch (err: any) {
      console.error('Manual location request failed:', err);
      alert('আবেদন পাঠাতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setIsSavingManualLoc(false);
    }
  };

  const handleSaveAgentProfile = async (profileData: any) => {
    if (!myAgentProfile) return;
    setIsSavingAgentProfile(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      // Create a pending request instead of direct update as per user rule
      const updateRequest = {
        userId: user.uid,
        userName: profileData.name || myAgentProfile.name,
        phone: profileData.phone || myAgentProfile.phone,
        whatsNumber: profileData.whatsapp || myAgentProfile.whatsapp || profileData.phone,
        country: profileData.country || myAgentProfile.country,
        area: profileData.city || profileData.thana || myAgentProfile.city,
        city: profileData.city || myAgentProfile.city,
        district: profileData.district || myAgentProfile.district,
        thana: profileData.thana || myAgentProfile.thana,
        postOffice: profileData.postOffice || myAgentProfile.postOffice || '',
        shopMapLink: profileData.shopMapLink || myAgentProfile.shopMapLink || '',
        experience: 'প্রোফাইল তথ্য সংশোধন আবেদন',
        status: 'pending',
        createdAt: serverTimestamp(),
        appliedAtStr: new Date().toLocaleString('en-US'),
        // Try to geocode if location text changed
        lat: myAgentProfile.lat,
        lng: myAgentProfile.lng
      };

      // If manual location changed, try to geocode it for the admin to see/preview
      if (profileData.shopMapLink && profileData.shopMapLink !== myAgentProfile.shopMapLink) {
        const geo = await geocodeTextOrLink(profileData.shopMapLink);
        if (geo) {
          updateRequest.lat = geo.lat;
          updateRequest.lng = geo.lng;
        }
      }

      await addDoc(collection(db, 'agent_requests'), updateRequest);
      
      // Admin notification
      await addDoc(collection(db, 'admin_notifications'), {
        title: '📝 এজেন্ট প্রোফাইল সংশোধন আবেদন',
        message: `${user.name || 'এজেন্ট'} তার প্রোফাইল বা লোকেশন পরিবর্তনের আবেদন করেছেন।`,
        userId: user.uid,
        userName: user.name || '',
        type: 'agent_profile_update',
        read: false,
        createdAt: new Date().toISOString()
      });

      alert('আপনার পরিবর্তনের আবেদনটি সফলভাবে দাখিল করা হয়েছে! অ্যাডমিন অনুমোদন করার পর এটি ম্যাপে আপডেট হবে।');
      setActiveTab('my-applications');
    } catch (err: any) {
      console.error('Failed to submit profile update: ' + err.message);
      alert('আবেদন দাখিল করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setIsSavingAgentProfile(false);
    }
  };

  // Perform localized proximity scanning simulation
  const handleLocalProximitySearch = () => {
    if (isScanning) return;
    setIsScanning(true);
    setClosestAgent(null);

    setTimeout(() => {
      setIsScanning(false);
      // Select closest real agent from agentsList
      let closest: Agent | null = null;
      if (userLocation && agentsList.length > 0) {
        let minDist = Infinity;
        agentsList.forEach(a => {
          const d = getDistanceInKm(userLocation.lat, userLocation.lng, a.lat, a.lng);
          if (d < minDist) {
            minDist = d;
            closest = a;
          }
        });
      }
      if (!closest && agentsList.length > 0) {
        closest = agentsList[0];
      }
      if (closest) {
        setClosestAgent(closest);
        setHighlightedAgentId((closest as Agent).id);
      }
      
      // Scroll to agent map pins or filter
      setMapType('bangladesh');
    }, 2200);
  };

  // Zoom map handlers
  const zoomIn = () => setZoomLevel(prev => Math.min(prev + 0.5, 3));
  const zoomOut = () => setZoomLevel(prev => Math.max(prev - 0.5, 1));

  // Extract unique cities for filtering options
  const uniqueCities = useMemo(() => {
    const cities = new Set(agentsList.map((a, _idx) => a.city));
    return Array.from(cities);
  }, [agentsList]);

  // Filtering agent list logically
  const filteredAgents = useMemo(() => {
    return agentsList.filter(agent => {
      const queryLower = searchQuery.toLowerCase();
      const agentIdStr = `BNB-AGT-${agent.id.substring(0,6).toUpperCase()}`;
      const matchesSearch = 
        agent.name.toLowerCase().includes(queryLower) ||
        agent.country.toLowerCase().includes(queryLower) ||
        agent.city.toLowerCase().includes(queryLower) ||
        agent.phone.includes(queryLower) ||
        agentIdStr.toLowerCase().includes(queryLower);
      
      const matchesCountry = matchesCountryName(agent.country, selectedCountryFilter);
      const matchesCity = selectedCityFilter === 'all' || agent.city.toLowerCase() === selectedCityFilter.toLowerCase();
      const matchesOnline = !filterOnline || agent.status === 'Available' || agent.status === 'Busy';
      const matchesVerified = !filterVerified || agent.verified === true;
      
      return matchesSearch && matchesCountry && matchesCity && matchesOnline && matchesVerified;
    });
  }, [agentsList, searchQuery, selectedCountryFilter, selectedCityFilter, filterOnline, filterVerified]);

  // Sort filteredAgents by distance if userLocation is available & apply radius filter
  const processedAgents = useMemo(() => {
    let mapped = filteredAgents.map((agent, _idx) => {
      let distanceKm: number | null = null;
      let estTime: string | null = null;
      let travelType: string | null = null;
      
      const lat = agent.realLat !== undefined ? agent.realLat : agent.lat;
      const lng = agent.realLng !== undefined ? agent.realLng : agent.lng;

      if (userLocation && lat && lng) {
        distanceKm = calculateHaversineDistance(userLocation.lat, userLocation.lng, lat, lng);
        const { time, type } = getEstimatedTime(distanceKm);
        estTime = `${toBanglaDigits(time)} মিনিট`;
        travelType = type;
      }
      return {
        ...agent,
        distance: distanceKm,
        distanceKm,
        estTime,
        travelType
      };
    });

    if (selectedRadiusKm !== 'all' && userLocation) {
      mapped = mapped.filter(a => a.distanceKm !== null && a.distanceKm <= (selectedRadiusKm as number));
    } else if (filterNearby && userLocation) {
      mapped = mapped.filter(a => a.distanceKm !== null && a.distanceKm <= 50);
    }

    if (userLocation) {
      // Sort ascending by distance (nearest first)
      mapped.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    }
    return mapped;
  }, [filteredAgents, userLocation, filterNearby, selectedRadiusKm]);

  // Handle toggling location sharing
  const handleToggleSharing = async () => {
    const nextState = !isSharingLocation;
    setIsSharingLocation(nextState);
    localStorage.setItem('amb_share_location', nextState ? 'true' : 'false');
    if (!nextState && user?.uid) {
      await stopSharingAgentLocation(user.uid);
    }
  };

  // Nearest agent summary ticker
  const nearestAgentsSummary = useMemo(() => {
    const withDist = processedAgents.filter(a => a.distance !== null);
    if (withDist.length === 0) return null;
    return `${withDist[0].name} — ${toBanglaDigits(withDist[0].distance!.toFixed(1))} KM`;
  }, [processedAgents]);

  const selectedAgent = useMemo(() => {
    return processedAgents.find(a => a.id === highlightedAgentId) || null;
  }, [processedAgents, highlightedAgentId]);

  return (
    <div className="bg-[#0b6623] min-h-screen text-slate-800 pb-28 relative max-w-lg mx-auto border-x border-slate-150">
      
      {/* Green Top Header Section matching Home Dashboard (Hidden when dedicated Full-Screen Apply page is open) */}
      {activeTab !== 'apply' && (
        <header className="bg-gradient-to-b from-[#0b6623] via-[#005a36] to-[#004d1a] text-white px-3.5 pt-safe pb-2.5 rounded-b-[28px] shadow-sm border-b border-emerald-700/60 relative overflow-hidden z-30 space-y-2.5">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-3">
              <UnifiedBackButton
                onClick={() => {
                  if (reportingAgent) { setReportingAgent(null); return; }
                  if (showFilterDropdown) { setShowFilterDropdown(false); return; }
                  if (activeTab !== 'map') {
                    setActiveTab('map');
                    return;
                  }
                  onBack();
                }}
                variant="dark"
                title="পিছনে যান"
              />
              <div>
                <h1 className="text-sm font-black text-white leading-tight">{t.title}</h1>
                <p className="text-[9px] font-bold text-amber-300 tracking-wide">{t.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Dynamic Language Toggle */}
              <button 
                onClick={() => setLang(prev => prev === 'bn' ? 'en' : 'bn')}
                className="p-1.5 bg-white/20 hover:bg-white/30 text-white border border-white/20 rounded-xl transition cursor-pointer flex items-center gap-1 text-[9.5px] font-black"
              >
                <Languages className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'EN' : 'বাং'}</span>
              </button>
              <span className="text-[10px] font-bold text-white bg-black/20 px-2.5 py-1 rounded-full border border-white/20 leading-none">
                {t.onlineBadge}
              </span>
            </div>
          </div>

          {/* Announcement Ticker (ঘোষণা) */}
          <div className="flex items-center gap-2.5 overflow-hidden w-full pt-1 px-0.5 relative z-10">
            <div className="bg-white text-[#005a36] text-[10.5px] font-black px-3 py-1 rounded-full shrink-0 shadow-xs flex items-center gap-1">
              <span>ঘোষণা</span>
            </div>
            <div className="flex-grow overflow-hidden relative mr-1">
              <marquee className="text-[12px] font-bold text-white leading-none py-0.5 tracking-wide" behavior="scroll" direction="left" scrollamount="4">
                {appConfig?.agentTicker || "BNB এজেন্ট ও প্রতিনিধি পোর্টাল ডিরেক্টরিতে স্বাগতম। নিকটস্থ এজেন্টদের লাইভ লোকেশন দেখুন ও যোগাযোগ করুন।"}
              </marquee>
            </div>
          </div>
        </header>
      )}

      {/* ================= DEDICATED FULL-SCREEN AGENT APPLICATION PAGE ================= */}
      {activeTab === 'apply' && (
        <div className="min-h-screen bg-[#F5F8F6] text-slate-800 flex flex-col animate-fade-in">
          {/* Sticky Top Navigation Bar */}
          <div className="sticky top-0 z-40 bg-gradient-to-r from-[#0b6623] via-[#005a36] to-[#004d1a] text-white px-4 pt-safe pb-3 shadow-md flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setActiveTab('map')}
                className="px-2.5 py-1.5 bg-white/15 hover:bg-white/25 border border-white/25 rounded-xl text-[11px] font-black flex items-center gap-1 transition cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-4 h-4 shrink-0" />
                <span>ফিরে যান</span>
              </button>
              <div className="min-w-0">
                <h2 className="text-sm font-black text-white truncate">BNB এজেন্ট আবেদন ফরম</h2>
                <p className="text-[9.5px] font-bold text-emerald-200 truncate">
                  {isSamityInvestorFree
                    ? `${samityEligibility.categoryBadgeBn} (৩+ মাস কিস্তি • ফ্রি সুবিধা)`
                    : samityEligibility.isSamityTierMember
                      ? `${samityEligibility.categoryBadgeBn} (${toBanglaDigits(samityEligibility.paidMonthsCount)} মাস জমা • ফি ৳১০০)`
                      : 'সাধারণ সদস্য আবেদন (ফি ৳১০০)'}
                </p>
              </div>
            </div>
            <span
              className={`text-[10px] font-black px-2.5 py-1 rounded-full border shrink-0 ${
                isSamityInvestorFree
                  ? 'bg-emerald-400/20 text-emerald-100 border-emerald-300/40'
                  : 'bg-white/15 text-white border-white/25'
              }`}
            >
              {isSamityInvestorFree ? 'ফ্রি (৳০)' : `ফি: ৳${AGENT_APPLICATION_FEE}`}
            </span>
          </div>

          <div className="p-4 space-y-4 pb-10">
            {/* Compact Header Banner */}
            <div className="bg-gradient-to-r from-[#0D9488] to-teal-800 rounded-2xl p-4 text-white space-y-1.5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-emerald-200 shrink-0" />
                  অফিসিয়াল এজেন্ট তালিকাভুক্তি আবেদন
                </h3>
                <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full bg-white/15 border border-white/20">
                  {isSamityInvestorFree
                    ? `${samityEligibility.categoryBadgeBn} (ফ্রি)`
                    : samityEligibility.isSamityTierMember
                      ? samityEligibility.categoryBadgeBn
                      : 'সাধারণ সদস্য'}
                </span>
              </div>
              <p className="text-[10.5px] text-emerald-100 font-medium leading-relaxed">
                {isSamityInvestorFree
                  ? `আপনি BNB সমবায় সমিতির ${samityEligibility.categoryBadgeBn} সদস্য এবং কমপক্ষে ৩ মাসের (${toBanglaDigits(samityEligibility.paidMonthsCount)} মাস) কিস্তি পরিশোধ থাকায় সম্পূর্ণ ফ্রিতে (৳০) আবেদন করতে পারবেন।`
                  : 'সমবায় সমিতিতে (ওনার/শেয়ার হোল্ডার/ইনভেস্টর/সাপোর্টার) ন্যূনতম ৩ মাসের টাকা জমা থাকলে ফ্রি আবেদন করা যাবে; অন্যথায় সাধারণ আবেদন ফি ৳১০০ প্রযোজ্য।'}
              </p>
            </div>

            {successMessage && (
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-center space-y-1">
                <CheckCircle className="w-6 h-6 text-emerald-600 mx-auto" />
                <p className="text-xs text-emerald-900 font-extrabold leading-normal">{successMessage}</p>
              </div>
            )}

            {errorMessage && (
              <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl text-[11px] text-rose-700 font-bold leading-normal">
                ⚠️ {errorMessage}
              </div>
            )}

            <form onSubmit={handleApplySubmit} className="bg-white border border-slate-200 rounded-3xl p-4 shadow-xs space-y-3.5">
              {/* Auto-filled Name & Mobile Number from Profile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 border border-slate-200 p-3 rounded-2xl">
                <div>
                  <label className="block text-[9.5px] font-bold text-slate-500 mb-1">
                    এজেন্টের নাম (প্রোফাইল থেকে অটো)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={fullName || user.name || ''}
                    className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-[9.5px] font-bold text-slate-500 mb-1">
                    মোবাইল নম্বর (প্রোফাইল থেকে অটো)
                  </label>
                  <input
                    type="tel"
                    readOnly
                    value={phoneNumber || user.phone || ''}
                    className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-black text-slate-800 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* WhatsApp Number */}
              <div>
                <label className="block text-[10.5px] font-black text-slate-700 mb-1">
                  হোয়াটসঅ্যাপ নম্বর <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={whatsNumber}
                  onChange={(e) => setWhatsNumber(e.target.value)}
                  placeholder="উদাঃ 017XXXXXXXX বা +88017XXXXXXXX"
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-[#0D9488] focus:bg-white focus:outline-none"
                />
              </div>

              {/* Shop Address */}
              <div>
                <label className="block text-[10.5px] font-black text-slate-700 mb-1">
                  দোকান বা ব্যবসার ঠিকানা <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={writtenLocation}
                  onChange={(e) => setWrittenLocation(e.target.value)}
                  placeholder="উদাঃ মিরপুর ১০ গোলচত্বর, ঢাকা"
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-1 focus:ring-[#0D9488] focus:bg-white focus:outline-none"
                />
              </div>

              {/* Google Maps Copied Serial / Coordinates */}
              <div className="bg-emerald-50/60 border border-emerald-200 p-3 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[10.5px] font-black text-emerald-950 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#0D9488]" />
                    <span>ম্যাপ সিরিয়াল নম্বর / লোকেশন কোড <span className="text-rose-500">*</span></span>
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!navigator.geolocation) return;
                      setIsFetchingAddress(true);
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          const coordStr = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
                          setLocationNumber(coordStr);
                          setApplyLat(pos.coords.latitude);
                          setApplyLng(pos.coords.longitude);
                          setIsFetchingAddress(false);
                        },
                        () => {
                          setIsFetchingAddress(false);
                          alert('জিপিএস নেওয়া যায়নি, গুগল ম্যাপ থেকে কপি করে বসান।');
                        },
                        { enableHighAccuracy: true, timeout: 8000 }
                      );
                    }}
                    disabled={isFetchingAddress}
                    className="text-[9.5px] font-black px-2.5 py-1 rounded-lg bg-[#0D9488] hover:bg-[#0B7A70] text-white cursor-pointer transition shrink-0"
                  >
                    {isFetchingAddress ? 'খুঁজছে...' : '📍 বর্তমান কোড নিন'}
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={locationNumber}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLocationNumber(val);
                    const parsed = parseCoordinatesFromInput(val);
                    if (parsed) {
                      setApplyLat(parsed.lat);
                      setApplyLng(parsed.lng);
                    }
                  }}
                  placeholder="ম্যাপ থেকে কপি করা নম্বর বসান (যেমন: 23.8103, 90.4125)"
                  className="block w-full px-3 py-2.5 bg-white border border-emerald-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#0D9488] focus:outline-none"
                />
                <p className="text-[9.5px] text-emerald-800 font-semibold leading-snug">
                  * গুগল ম্যাপে আপনার দোকানের লোকেশন চেপে ধরে কোঅর্ডিনেট সিরিয়াল নম্বরটি কপি করে এখানে পেস্ট করুন।
                </p>
              </div>

              {/* Experience */}
              <div>
                <label className="block text-[10.5px] font-black text-slate-700 mb-1">
                  পূর্ববর্তী কাজের অভিজ্ঞতা
                </label>
                <select
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-[#0D9488] focus:bg-white focus:outline-none text-slate-800 font-bold"
                >
                  <option value="নেই">কোনো অভিজ্ঞতা নেই</option>
                  <option value="১ বছর বা তার কম">১ বছর বা তার কম</option>
                  <option value="১ - ৩ বছর">১ থেকে ৩ বছর</option>
                  <option value="৫+ বছর">৫ বছর বা তার বেশি অভিজ্ঞতা আছে</option>
                </select>
              </div>

              {/* NID & Nominee Section (Auto-filled for Samity Members, Mandatory for General Members) */}
              {hasCompleteSamityAutoInfo ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10.5px] font-black text-emerald-900">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>সমবায় সমিতির প্রোফাইল থেকে এনআইডি ও নমিনি অটো-যুক্ত হয়েছে</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px] text-emerald-950 font-semibold pt-1 border-t border-emerald-200/70">
                    <p>🪪 NID / পরিচয়পত্র: <strong className="font-mono">{existingProfileNid}</strong></p>
                    <p>👥 নমিনি: <strong>{existingProfileNominee?.name}</strong> ({existingProfileNominee?.relation || 'নমিনি'})</p>
                    <p className="sm:col-span-2">📱 নমিনির ফোন: <strong className="font-mono">{existingProfileNominee?.phone}</strong></p>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5">
                    <span className="text-[10.5px] font-black text-slate-800">
                      🪪 এনআইডি ও নমিনি তথ্য (সাধারণ সদস্যদের জন্য বাধ্যতামূলক)
                    </span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">
                      এনআইডি (NID) কার্ড নম্বর <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={agentNid}
                      onChange={(e) => setAgentNid(e.target.value)}
                      placeholder="আপনার জাতীয় পরিচয়পত্র (NID) নম্বর লিখুন"
                      className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-[#0D9488] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[9.5px] font-bold text-slate-600 mb-1">
                        নমিনির নাম <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={agentNomineeName}
                        onChange={(e) => setAgentNomineeName(e.target.value)}
                        placeholder="নমিনির নাম"
                        className="block w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-[#0D9488] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold text-slate-600 mb-1">
                        নমিনির সাথে সম্পর্ক <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={agentNomineeRelation}
                        onChange={(e) => setAgentNomineeRelation(e.target.value)}
                        placeholder="যেমন: পিতা, স্ত্রী"
                        className="block w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-[#0D9488] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold text-slate-600 mb-1">
                        নমিনির ফোন নম্বর <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={agentNomineePhone}
                        onChange={(e) => setAgentNomineePhone(e.target.value)}
                        placeholder="017XXXXXXXX"
                        className="block w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-[#0D9488] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Membership Eligibility & Application Fee Summary Card */}
              {isSamityInvestorFree ? (
                <div className="p-3.5 rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-50 via-teal-50/80 to-white space-y-2 shadow-4xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-emerald-900">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      সমবায় সমিতি / ইনভেস্টর বিশেষ সুবিধা
                    </span>
                    <span className="text-[9.5px] font-black px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-3xs">
                      সম্পূর্ণ ফ্রি ✓
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 bg-white/90 border border-emerald-200/80 rounded-xl p-2.5 text-[10.5px]">
                    <div>
                      <span className="text-[9px] font-bold text-slate-500 block">সমিতি ক্যাটাগরি ও কিস্তি</span>
                      <span className="font-black text-emerald-800">
                        {samityEligibility.categoryBadgeBn} • {toBanglaDigits(samityEligibility.paidMonthsCount)} মাস পরিশোধ ✓
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-bold text-slate-500 block">এজেন্ট আবেদন ফি</span>
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 line-through">৳{AGENT_APPLICATION_FEE}</span>
                        <span className="font-mono font-black text-emerald-700 text-xs">৳০ (ফ্রি)</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] font-bold text-emerald-800 leading-snug">
                    ✓ আপনি BNB সমবায় সমিতির {samityEligibility.categoryBadgeBn} হিসেবে ন্যূনতম ৩ মাসের কিস্তি জমা দিয়েছেন — তাই কোনো ফি ছাড়াই সরাসরি এজেন্ট আবেদন করতে পারবেন।
                  </p>
                </div>
              ) : (
                <div
                  className={`p-3.5 rounded-2xl border space-y-2 text-[11px] ${
                    liveUserBalance >= AGENT_APPLICATION_FEE
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                      : 'bg-rose-50 border-rose-200 text-rose-950'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-black/10">
                    <span className="text-[10.5px] font-black">
                      {samityEligibility.isSamityTierMember
                        ? `সমবায় সদস্য (${samityEligibility.categoryBadgeBn}) — ৩ মাস পূর্ণ হয়নি`
                        : 'সাধারণ সদস্য আবেদন ফি'}
                    </span>
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      {samityEligibility.isSamityTierMember
                        ? `জমা: ${toBanglaDigits(samityEligibility.paidMonthsCount)}/৩ মাস`
                        : 'নন-ইনভেস্টর সদস্য'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-bold">
                    <span>আপনার বর্তমান মেইন ব্যালেন্স:</span>
                    <span className="font-mono font-black">
                      ৳{liveUserBalance.toLocaleString('bn-BD')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-bold">
                    <span>এজেন্ট আবেদন ফি (সাবমিটে কাটা হবে):</span>
                    <span className="font-mono font-black text-rose-700">
                      ৳{AGENT_APPLICATION_FEE.toLocaleString('bn-BD')}
                    </span>
                  </div>
                  {samityEligibility.isSamityTierMember ? (
                    <p className="text-[10px] font-bold text-amber-900 pt-1.5 border-t border-black/10 leading-snug">
                      ℹ️ আপনি সমবায় সমিতির {samityEligibility.categoryBadgeBn} সদস্য হলেও বর্তমানে আপনার {toBanglaDigits(samityEligibility.paidMonthsCount)} মাসের কিস্তি জমা আছে। ফ্রি এজেন্ট আবেদনের জন্য ন্যূনতম ৩ মাসের কিস্তি পরিশোধ থাকতে হবে — অন্যথায় ৳{AGENT_APPLICATION_FEE} ফি দিয়ে আবেদন করুন।
                    </p>
                  ) : liveUserBalance < AGENT_APPLICATION_FEE ? (
                    <p className="text-[10px] font-black text-rose-700 pt-1.5 border-t border-rose-200 leading-snug">
                      ⚠️ আপনি BNB সমবায় সমিতির (ওনার/শেয়ার হোল্ডার/ইনভেস্টর/সাপোর্টার) ৩ মাসের সঞ্চয়ী সদস্য নন, তাই এজেন্ট আবেদনের জন্য মেইন ব্যালেন্সে কমপক্ষে ৳{AGENT_APPLICATION_FEE} টাকা থাকতে হবে।
                    </p>
                  ) : (
                    <p className="text-[10px] font-semibold text-emerald-800 pt-1.5 border-t border-emerald-200 leading-snug">
                      ✓ আবেদন সাবমিট করার সাথে সাথে মেইন ব্যালেন্স থেকে ৳{AGENT_APPLICATION_FEE} কাটা হবে (আবেদন বাতিল হলে টাকা ফেরত পাবেন)। সমবায় সমিতির ওনার/শেয়ার হোল্ডার/ইনভেস্টর/সাপোর্টারদের ৩ মাসের টাকা জমা থাকলে ফ্রি আবেদন করা যায়।
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('map')}
                  className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-xs transition cursor-pointer"
                >
                  ← ম্যাপে ফিরুন
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || (effectiveApplicationFee > 0 && liveUserBalance < effectiveApplicationFee)}
                  className="sm:col-span-2 py-3 bg-[#0D9488] hover:bg-[#0B7A70] disabled:bg-slate-300 disabled:text-slate-600 text-white font-black rounded-xl text-xs transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-700/15"
                >
                  {isSubmitting ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : isSamityInvestorFree ? (
                    <span>ফ্রি এজেন্ট আবেদন দাখিল করুন (৳০ ফি) 🚀</span>
                  ) : (
                    <span>আবেদন দাখিল করুন (৳{AGENT_APPLICATION_FEE} ফি সহ) 🚀</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MAIN CONTENT CANVAS ================= */}
      {activeTab !== 'apply' && (
      <main className="p-4 space-y-4">

        {/* TAB 1: LANDING & AGENT MAP */}
        {activeTab === 'map' && (
          <div className="space-y-4 animate-fade-in text-left">
            
            {/* Real Google Maps Integration Component (With Agent Profile Photos & Fullscreen Mode) */}
            <div id="agent-google-map-container">
              <GoogleAgentMap
                agents={processedAgents
                  .filter((a: any) => a.approvalStatus === 'approved')
                  .map((a: any) => {
                    const schedStatus = getLiveScheduleStatus(a.weeklySchedule, a.openingHours);
                    return {
                      id: a.id,
                      agentCode: a.agentCode,
                      badgeLabel: a.badgeLabel,
                      name: a.name,
                      country: a.country || 'Bangladesh',
                      city: a.city || a.district || '',
                      address:
                        a.address ||
                        [a.postOffice, a.thana, a.district, a.city, a.country]
                          .filter(Boolean)
                          .join(', '),
                      openingHours: a.openingHours || 'সকাল ৯:০০ - রাত ১০:০০',
                      scheduleStatusLabel: a.weeklySchedule ? schedStatus.statusLabel : undefined,
                      scheduleState: a.weeklySchedule ? schedStatus.state : 'unknown',
                      todayHours: schedStatus.todayHours,
                      closedDaysLabel: schedStatus.closedDaysLabel,
                      phone: a.phone || '',
                      whatsapp: a.whatsapp || a.phone || '',
                      img: a.img || '',
                      lat: Number(a.realLat || a.lat || 0),
                      lng: Number(a.realLng || a.lng || 0),
                      distanceKm: userLocation ? a.distanceKm : null,
                    };
                  })}
                mapType={mapType}
                onMapTypeChange={(type) => {
                  setMapType(type);
                  if (type === 'bangladesh') {
                    setSelectedCountryFilter('Bangladesh');
                  } else {
                    setSelectedCountryFilter('all');
                  }
                }}
                selectedAgentId={highlightedAgentId}
                onSelectAgent={(id) => {
                  setHighlightedAgentId(id);
                  if (id) {
                    setTimeout(() => {
                      document
                        .getElementById(`agent-card-${id}`)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 100);
                  }
                }}
                userLocation={userLocation}
                onRequestUserLocation={handleRequestUserLocation}
                locatingUser={isLocating}
                isFullscreen={isMapFullscreen}
                onFullscreenChange={setIsMapFullscreen}
              />
            </div>

            {/* Nearest Agent Quick Discovery Card for Ordinary Members */}
            {processedAgents.length > 0 && (
              <div className="bg-white border border-emerald-200 rounded-3xl p-3.5 shadow-xs space-y-2.5">
                {userLocation && processedAgents[0]?.distanceKm != null ? (
                  (() => {
                    const nearest = processedAgents[0];
                    const nLat = nearest.realLat !== undefined ? nearest.realLat : nearest.lat;
                    const nLng = nearest.realLng !== undefined ? nearest.realLng : nearest.lng;
                    const distText =
                      nearest.distanceKm! < 1
                        ? `${toBanglaDigits(Math.round(nearest.distanceKm! * 1000))} মিটার`
                        : `${toBanglaDigits(nearest.distanceKm!.toFixed(1))} কি.মি.`;
                    return (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                            📍 আপনার সবচেয়ে কাছের এজেন্ট (টাকা উত্তোলন / দেখা করুন)
                          </span>
                          <span className="text-[10px] font-black text-[#1E3A8A] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full shrink-0">
                            {distText} দূরে
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <img
                            src={nearest.img}
                            alt={nearest.name}
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-full object-cover border-2 border-[#0D9488] shrink-0 shadow-xs"
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-black text-slate-900 truncate">{nearest.name}</h4>
                            <p className="text-[10px] text-slate-600 font-semibold truncate">
                              {nearest.address || nearest.city}
                            </p>
                            {nearest.estTime && (
                              <p className="text-[10px] text-emerald-700 font-black">
                                ⏱️ যেতে সময়: {nearest.estTime} ({nearest.travelType})
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setHighlightedAgentId(nearest.id);
                              document
                                .getElementById('agent-google-map-container')
                                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                            className="py-1.5 px-2 bg-[#0D9488] hover:bg-[#0B7A70] text-white text-[10px] font-black rounded-xl cursor-pointer transition text-center"
                          >
                            ম্যাপে দেখুন
                          </button>
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${nLat},${nLng}&travelmode=driving`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-1.5 px-2 bg-[#1E3A8A] hover:bg-blue-900 text-white text-[10px] font-black rounded-xl transition text-center flex items-center justify-center gap-1"
                          >
                            <Navigation className="w-3 h-3 shrink-0" />
                            <span>সরাসরি যান</span>
                          </a>
                          <a
                            href={`tel:${nearest.phone}`}
                            className="py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-xl transition text-center flex items-center justify-center gap-1"
                          >
                            <Phone className="w-3 h-3 shrink-0" />
                            <span>কল করুন</span>
                          </a>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="min-w-0">
                      <h4 className="text-[11px] font-black text-slate-900">
                        কাছের এজেন্ট ও দূরত্ব দেখতে চান?
                      </h4>
                      <p className="text-[10px] text-slate-600 font-semibold leading-snug">
                        জিপিএস চালু করলে কোন এজেন্ট কতটুকু দূরে আছে তা সাথে সাথে দেখতে পাবেন।
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRequestUserLocation}
                      disabled={isLocating}
                      className="px-3 py-2 bg-[#0D9488] hover:bg-[#0B7A70] text-white text-[10px] font-black rounded-xl shrink-0 cursor-pointer transition"
                    >
                      {isLocating ? 'খুঁজছে...' : '📍 দূরত্ব দেখুন'}
                    </button>
                  </div>
                )}
              </div>
            )}



            {/* ================= AGENT APPLICATION NAVIGATION BUTTON CARD (Opens Dedicated Full-Screen Page) ================= */}
            <div className="bg-white border border-slate-150 rounded-3xl p-4 shadow-3xs transition-all duration-250">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage('');
                  setSuccessMessage('');
                  setActiveTab('apply');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full flex items-center justify-between text-left focus:outline-none cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-emerald-50 rounded-2xl text-[#0D9488] group-hover:bg-emerald-100 transition">
                    <Briefcase className="w-5 h-5 shrink-0" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-800">এজেন্ট হতে আগ্রহী..? (ভর্তির আবেদন)</h3>
                    <p className="text-[10px] text-[#0D9488] font-bold mt-0.5">
                      {isSamityInvestorFree
                        ? `${samityEligibility.categoryBadgeBn} (৩+ মাস কিস্তি) — ফ্রি (৳০) আবেদন`
                        : 'সাধারণ সদস্য ৳১০০ (সমিতির ৩+ মাস কিস্তিতে ফ্রি) • আবেদন করতে ক্লিক করুন'}
                    </p>
                  </div>
                </div>
                <div className="p-1.5 bg-emerald-50 group-hover:bg-emerald-100 rounded-full text-[#0D9488] transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            </div>

            {/* ================= SEARCH & FILTERS (Clean, Simple & Professional) ================= */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-xs font-black text-emerald-100 uppercase tracking-wider font-sans">এজেন্ট তালিকা (বিশ্বজুড়ে)</h3>
                <span className="text-[10px] font-black text-[#0D9488] bg-white px-2.5 py-0.5 rounded-full shadow-xs">
                  {processedAgents.length} জন সক্রিয় ম্যাপ
                </span>
              </div>

              <div className="flex gap-2 relative">
                {/* Search Bar */}
                <div className="bg-white border border-slate-200 rounded-2.5xl px-3 py-2 flex items-center gap-2 flex-grow shadow-xs">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="নাম, দেশ বা অবস্থান দিয়ে খুঁজুন..."
                    className="w-full text-xs font-sans text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none"
                  />
                  {searchQuery && (
                    <button 
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold px-1 cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Filter Tab Button */}
                <button 
                  type="button"
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className={`px-3.5 bg-white border rounded-2.5xl flex items-center gap-1.5 text-xs font-sans font-black shadow-xs cursor-pointer ${showFilterDropdown ? 'border-[#0D9488] text-[#0D9488]' : 'border-slate-200 text-slate-600 hover:text-slate-800'}`}
                >
                  <Filter className="w-3.5 h-3.5" /> ফিল্টার
                </button>

                {/* Expanded Filter Panel Dropdown */}
                {showFilterDropdown && (
                  <div className="absolute top-11 right-0 w-44 bg-white border border-slate-200 rounded-2xl shadow-lg p-2.5 z-40 space-y-1.5">
                    <p className="text-[9px] font-black text-slate-400 tracking-wider uppercase border-b pb-1">দেশ নির্বাচন</p>
                    {[
                      { key: 'all', label: 'সব সক্রিয় দেশ' },
                      { key: 'Bangladesh', label: '🇧🇩 বাংলাদেশ' },
                      { key: 'Saudi Arabia', label: '🇸🇦 সৌদি আরব' },
                      { key: 'UAE', label: '🇦🇪 দুবাই / UAE' },
                      { key: 'Qatar', label: '🇶🇦 কাতার' },
                      { key: 'Oman', label: '🇴🇲 ওমান' },
                      { key: 'Kuwait', label: '🇰🇼 কুয়েত' },
                      { key: 'Malaysia', label: '🇲🇾 মালয়েশিয়া' },
                      { key: 'Singapore', label: '🇸🇬 সিঙ্গাপুর' },
                      { key: 'United States', label: '🇺🇸 যুক্তরাষ্ট্র' },
                      { key: 'United Kingdom', label: '🇬🇧 যুক্তরাজ্য' }
                    ].map((opt, _idx) => (
                      <button 
                        key={`${opt.key}-${_idx}`}
                        type="button"
                        onClick={() => {
                          setSelectedCountryFilter(opt.key);
                          setShowFilterDropdown(false);
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-xs leading-none flex items-center justify-between font-bold cursor-pointer ${selectedCountryFilter === opt.key ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        <span>{opt.label}</span>
                        {selectedCountryFilter === opt.key && <span className="text-emerald-600 text-[10px]">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ================= ACTIVE AGENTS GRID ================= */}
            {processedAgents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {processedAgents.map((agent, idx) => {
                  const agentLat = agent.realLat !== undefined ? agent.realLat : agent.lat;
                  const agentLng = agent.realLng !== undefined ? agent.realLng : agent.lng;
                  const isSelected = highlightedAgentId === agent.id;
                  const displayAddress =
                    agent.address ||
                    [agent.postOffice, agent.thana, agent.district, agent.city]
                      .filter(Boolean)
                      .join(', ');

                  const focusAgentOnMap = () => {
                    setHighlightedAgentId(agent.id);
                    const isBD =
                      (agent.country || '').toLowerCase().includes('bangladesh') ||
                      (agent.country || '').includes('বাংলাদেশ');
                    if (!isBD && mapType === 'bangladesh') {
                      setMapType('world');
                    }
                    setZoomLevel(1.5);
                    document
                      .getElementById('agent-google-map-container')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  };

                  return (
                    <div
                      id={`agent-card-${agent.id}`}
                      key={`${agent.id}-${idx}`}
                      onClick={focusAgentOnMap}
                      className={`bg-white rounded-2.5xl p-3.5 flex flex-col justify-between transition-all duration-200 text-left group relative overflow-hidden cursor-pointer ${
                        isSelected
                          ? 'border-2 border-orange-500 ring-2 ring-orange-400/50 bg-orange-50/20 shadow-md'
                          : 'border border-slate-200 hover:shadow-md shadow-3xs'
                      }`}
                    >
                      {/* Top Row: Badge (Agent Point + ID or Official Center) & Distance */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="inline-flex items-center gap-1 text-[9.5px] font-black px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1E3A8A] border border-blue-200">
                          {agent.badgeLabel || `এজেন্ট পয়েন্ট • ${agent.agentCode || 'AG-2041'}`}
                        </span>

                        {userLocation && agent.distanceKm != null && !isNaN(agent.distanceKm) && (
                          <span className="inline-flex items-center gap-1 text-[9.5px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                            📍 {agent.distanceKm < 1
                              ? `${toBanglaDigits(Math.round(agent.distanceKm * 1000))} মিটার`
                              : `${toBanglaDigits(agent.distanceKm.toFixed(1))} কি.মি.`}
                            {agent.estTime ? ` • ${agent.estTime}` : ''}
                          </span>
                        )}
                      </div>

                      {/* Agent Avatar + Name */}
                      <div className="flex items-center gap-2.5">
                        <img
                          src={agent.img}
                          alt={agent.name}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-full object-cover border-2 border-[#0D9488] shrink-0 shadow-2xs"
                        />
                        <h4
                          onClick={(e) => {
                            e.stopPropagation();
                            focusAgentOnMap();
                          }}
                          className="text-xs sm:text-[13px] font-black text-slate-900 hover:text-[#1E3A8A] leading-snug truncate cursor-pointer flex-1"
                        >
                          {agent.name}
                        </h4>
                      </div>

                      {/* Public Details: Address, Opening Hours, Phone Number */}
                      <div className="space-y-1.5 my-2.5 font-sans text-[10px] text-slate-700">
                        <div className="flex items-start gap-1.5 font-semibold leading-snug">
                          <MapPin className="w-3.5 h-3.5 text-[#0D9488] shrink-0 mt-0.5" />
                          <span>{displayAddress || agent.city}</span>
                        </div>

                        {(() => {
                          const liveSched = getLiveScheduleStatus(agent.weeklySchedule, agent.openingHours);
                          return (
                            <div className="space-y-1 bg-slate-50 border border-slate-200/70 rounded-xl px-2.5 py-1.5">
                              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                <span className="flex items-center gap-1 font-bold text-slate-700">
                                  <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  <span>আজ ({liveSched.todayDayLabel}):</span>
                                </span>
                                {agent.weeklySchedule && (
                                  <span
                                    className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                                      liveSched.state === 'open'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : liveSched.state === 'break'
                                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                                          : 'bg-rose-50 text-rose-700 border-rose-200'
                                    }`}
                                  >
                                    {liveSched.statusLabel}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] font-semibold text-slate-600 leading-snug">
                                {liveSched.todayHours || agent.openingHours || 'সকাল ৯:০০ - রাত ১০:০০'}
                              </p>
                              {liveSched.closedDaysLabel && (
                                <p className="text-[9.5px] font-bold text-rose-600 leading-none">
                                  📅 সাপ্তাহিক অবস্থা: {liveSched.closedDaysLabel}
                                </p>
                              )}
                            </div>
                          );
                        })()}

                        <div className="flex items-center gap-1.5 font-mono font-extrabold text-slate-800">
                          <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{agent.phone}</span>
                        </div>
                      </div>

                      {/* Action Buttons: "কল করুন" & "গুগল ম্যাপ পথ" */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                        <a
                          href={`tel:${agent.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="py-2 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-xl flex items-center justify-center gap-1.5 transition text-center shadow-2xs cursor-pointer"
                        >
                          <Phone className="w-3 h-3 shrink-0" />
                          <span>কল করুন</span>
                        </a>

                        <a
                          href={`https://www.google.com/maps/dir/?api=1&${userLocation ? `origin=${userLocation.lat},${userLocation.lng}&` : ''}destination=${agentLat},${agentLng}&travelmode=driving`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="py-2 px-2.5 bg-[#1E3A8A] hover:bg-blue-900 text-white text-[10px] font-black rounded-xl flex items-center justify-center gap-1.5 transition text-center shadow-2xs cursor-pointer"
                        >
                          <Navigation className="w-3 h-3 shrink-0" />
                          <span>দিকনির্দেশনা (Map)</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : searchQuery.trim().length > 0 ? (
              <div className="bg-white/95 border border-slate-200 rounded-2xl px-4 py-3 text-center text-slate-600 text-xs font-bold">
                “{searchQuery}” নামে কোনো সক্রিয় এজেন্ট খুঁজে পাওয়া যায়নি।
              </div>
            ) : null}

            {/* ================= 4 INFO METRICS ROW ================= */}
            <div className="grid grid-cols-4 gap-2 my-2">
              <div className="bg-[#FAFCFF] border border-sky-100/70 p-2.5 rounded-2xl text-center space-y-0.5 shadow-4xs">
                <div className="w-7 h-7 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center mx-auto mb-1">
                  <Users className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black text-slate-800 leading-none">{toBanglaDigits(agentsList.length)} জন</h4>
                <p className="text-[7.5px] text-slate-400 font-extrabold leading-none truncate block">মোট এজেন্ট</p>
                <p className="text-[7.5px] text-slate-400 font-extrabold leading-none truncate block">সারা বিশ্বে</p>
              </div>

              <div className="bg-[#FAFDFB] border border-emerald-100/70 p-2.5 rounded-2xl text-center space-y-0.5 shadow-4xs">
                <div className="w-7 h-7 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-1">
                  <Globe className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black text-sky-850 leading-none">{toBanglaDigits(new Set(agentsList.map((a, _idx) => a.country?.trim().toLowerCase()).filter(Boolean)).size)} টি</h4>
                <p className="text-[7.5px] text-slate-400 font-extrabold leading-none truncate block">সক্রিয় দেশ</p>
                <p className="text-[7.5px] text-slate-400 font-extrabold leading-none truncate block">বিশ্বজুড়ে</p>
              </div>

              <div className="bg-[#FFFBF5] border border-amber-100/70 p-2.5 rounded-2xl text-center space-y-0.5 shadow-4xs">
                <div className="w-7 h-7 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-1">
                  <MapPin className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black text-slate-800 leading-none">{toBanglaDigits(new Set(agentsList.map((a, _idx) => a.city?.trim().toLowerCase()).filter(Boolean)).size)} টি</h4>
                <p className="text-[7.5px] text-slate-400 font-extrabold leading-none truncate block">শহর কভারেজ</p>
                <p className="text-[7.5px] text-slate-400 font-extrabold leading-none truncate block">সেবা সর্বত্র</p>
              </div>

              <div className="bg-[#FFF9FB] border border-rose-100/70 p-2.5 rounded-2xl text-center space-y-0.5 shadow-4xs">
                <div className="w-7 h-7 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-1">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black text-slate-800 leading-none">100%</h4>
                <p className="text-[7.5px] text-slate-400 font-extrabold leading-none truncate block">ভেরিফাইড</p>
                <p className="text-[7.5px] text-slate-400 font-extrabold leading-none truncate block">নিরাপদ লেনদেন</p>
              </div>
            </div>



          </div>
        )}



        {/* TAB 3: USER SUBMITTED APPLICATIONS */}
        {activeTab === 'my-applications' && (
          <div className="space-y-4 animate-fade-in text-left">
            <div className="bg-white border border-slate-150 rounded-2.5xl p-4 shadow-3xs">
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-1 flex items-center gap-1.5 border-b pb-2">
                <FileText className="w-4.5 h-4.5 text-[#0D9488] shrink-0" />
                আমার এজেন্ট আবেদন খতিয়ান
              </h2>

              {loadingApps ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2">
                  <span className="w-7 h-7 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-slate-450 font-bold">আবেদনপত্র লোড হচ্ছে...</span>
                </div>
              ) : userApplications.length > 0 ? (
                <div className="space-y-3.5 mt-2.5">
                  {userApplications.map((app, idx) => {
                    const isPending = app.status === 'pending';
                    const isApproved = app.status === 'approved';
                    const isRejected = app.status === 'rejected';

                    return (
                      <div key={`${app.id}-${idx}`} className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2.5 font-sans">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[8px] font-black text-slate-400 block tracking-wide">রেফারেন্স আইডি</span>
                            <span className="text-[10px] font-mono text-slate-800 font-extrabold block">#{app.id.substring(0, 8).toUpperCase()}</span>
                          </div>
                          
                          {/* Status Badge */}
                          <span className={`text-[8.5px] font-black px-2.5 py-0.5 rounded-full uppercase leading-none border ${isPending ? 'bg-amber-50 text-amber-700 border-amber-200' : isApproved ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                            {isPending ? '⏳ অ্যাডমিন রিভিউ চলছে' : isApproved ? '✓ অনুমোদিত' : '❌ বাতিল হয়েছে'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 border-t border-dashed border-slate-200 pt-2 font-medium">
                          <p>👤 নামঃ <span className="text-slate-800 font-bold">{app.userName}</span></p>
                          <p>📱 ফোনঃ <span className="font-mono text-slate-800 font-bold">{app.phone}</span></p>
                          <p>📍 এলাকাঃ <span className="text-slate-800 font-bold">{app.area}, {app.district}</span></p>
                          <p>💼 অভিজ্ঞতাঃ <span className="text-slate-800 font-bold">{app.experience}</span></p>
                        </div>

                        {app.appliedAtStr && (
                          <p className="text-[8.5px] text-slate-400 mt-1 block">দাখিলের সময়ঃ {app.appliedAtStr}</p>
                        )}
                        
                        {/* Process tracker */}
                        <div className="bg-white border rounded-xl p-2.5 space-y-1.5 text-[9px]">
                          <p className="text-slate-500 font-bold leading-none mb-1">অগ্রগতি ট্র্যাকারঃ</p>
                          <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-[8.5px] shrink-0">✓</span>
                            <span className="text-slate-700 font-bold">আবেদনপত্র সার্ভারে গৃহীত হয়েছে</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold text-[8.5px] shrink-0 ${isPending ? 'bg-amber-100 text-amber-700' : 'bg-[#E6F4EA] text-emerald-700'}`}>
                              {isPending ? '⏳' : '✓'}
                            </span>
                            <span className={isPending ? 'text-slate-600 font-bold' : 'text-slate-700 font-bold'}>
                              {isPending ? 'অ্যাডমিন ভেরিফিকেশন চলমান রয়েছে' : 'অফিসিয়াল তথ্য রিভিউ সম্পন্ন হয়েছে'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center font-bold text-[8.5px] shrink-0">3</span>
                            <span className="text-slate-400 font-bold">ব্যবসায়িক প্রশিক্ষণ অ্যাক্সেস</span>
                          </div>
                        </div>

                        {/* Admin Action Bar (Strictly inside /admin) */}
                        {isStandaloneAdminRoute() && (user.role === 'admin' || user.role === 'sub_admin') && (
                          <div className="bg-amber-50 border border-amber-200/60 p-2.5 rounded-xl space-y-1.5">
                            <p className="text-[8.5px] font-black text-amber-900 uppercase">🛡️ প্রশাসনিক আবেদন নিয়ন্ত্রণ প্যানেল</p>
                            {isPending ? (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleApproveApplication(app)}
                                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-1.5 px-2.5 rounded-lg text-[9px] cursor-pointer text-center"
                                >
                                  অনুমোদন করুন ✓
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRejectApplication(app)}
                                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-1.5 px-2.5 rounded-lg text-[9px] cursor-pointer text-center"
                                >
                                  বাতিল করুন ✕
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAgent(app)}
                                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-1.5 px-2.5 rounded-lg text-[9px] cursor-pointer text-center"
                                >
                                  🗑️ এজেন্ট রিমুভ করুন (ম্যাপ ও তালিকা থেকে মুছুন)
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center space-y-2.5 font-sans">
                  <p className="text-xs text-slate-500 font-bold">আপনি এখনো কোনো নতুন এজেন্ট আবেদন সাবমিট করেননি।</p>
                  <button 
                    onClick={() => setActiveTab('apply')}
                    className="py-1.5 px-4 bg-[#0D9488] hover:bg-[#0B7A70] text-white text-[10px] font-black rounded-lg transition"
                  >
                    আবেদন ফর্ম পূরণ করুন
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: MOCK AGENT PROFILE */}
        {activeTab === 'profile' && (
          <div className="space-y-4 animate-fade-in text-left">
            <div className="bg-white border border-slate-150 rounded-2.5xl p-5 shadow-3xs space-y-4">
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b pb-2 flex items-center gap-1.5">
                <Globe className="w-4.5 h-4.5 text-[#0D9488]" />
                BNB কো-অপারেটিভ আন্তর্জাতিক এজেন্ট কার্ড
              </h2>

              {/* Digital Agent Identity Card (16:9 YouTube Thumbnail Size — 100% Auto-Populated from Profile & Application Form) */}
              {(() => {
                const cardName = String(
                  myAgentProfile?.name ||
                    myLatestApplication?.userName ||
                    effectiveUserProfile.name ||
                    'সম্মানিত সদস্য'
                ).trim();
                const cardPhone = String(
                  myAgentProfile?.phone ||
                    myLatestApplication?.phone ||
                    effectiveUserProfile.phone ||
                    'নম্বর যুক্ত নেই'
                ).trim();
                const rawPhoneDigits = cardPhone.replace(/\D/g, '');
                const defaultSerial = rawPhoneDigits
                  ? `AG-${rawPhoneDigits.slice(-4).padStart(4, '2')}`
                  : `BNB-AGT-${user.uid?.substring(0, 5).toUpperCase()}`;
                const cardSerial = String(
                  myAgentProfile?.agentCode ||
                    myLatestApplication?.agentCode ||
                    effectiveUserProfile.agentCode ||
                    effectiveUserProfile.memberId ||
                    defaultSerial
                ).trim();
                const cardDistrict = String(
                  myAgentProfile?.district ||
                    myLatestApplication?.district ||
                    effectiveUserProfile.district ||
                    ''
                ).trim();
                const cardThana = String(
                  myAgentProfile?.thana ||
                    myLatestApplication?.thana ||
                    myLatestApplication?.area ||
                    effectiveUserProfile.thana ||
                    ''
                ).trim();
                const cardVillageOrShop = String(
                  myAgentProfile?.postOffice ||
                    myLatestApplication?.postOffice ||
                    effectiveUserProfile.village ||
                    myLatestApplication?.writtenLocation ||
                    myAgentProfile?.address ||
                    myLatestApplication?.address ||
                    effectiveUserProfile.writtenLocation ||
                    effectiveUserProfile.address ||
                    ''
                ).trim();

                const locationSegments = Array.from(
                  new Set(
                    [cardVillageOrShop, cardThana, cardDistrict]
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                );
                const cardFullLocation =
                  locationSegments.length > 0
                    ? locationSegments.join(', ')
                    : 'ফর্মে ঠিকানা যুক্ত করলে এখানে দেখাবে';

                const rawProfileImg =
                  (liveUserPhoto && !liveUserPhoto.includes('1534528741775-53994a69daeb') ? liveUserPhoto : '') ||
                  myAgentProfile?.img ||
                  myLatestApplication?.photoURL ||
                  myLatestApplication?.img ||
                  resolveAgentAvatar({ ...effectiveUserProfile, img: liveUserPhoto }, cardName);

                const appStatus = myAgentProfile
                  ? 'approved'
                  : String(myLatestApplication?.status || '').toLowerCase();

                return (
                  <div className="w-full aspect-video bg-gradient-to-br from-[#071739] via-[#0B1E36] to-[#063B2D] text-white rounded-2xl p-3.5 sm:p-4.5 border border-emerald-400/25 relative overflow-hidden shadow-xl flex flex-col justify-between">
                    <div className="absolute -top-10 -right-10 w-36 h-36 bg-emerald-400/15 rounded-full blur-2xl pointer-events-none" />
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-sky-400/15 rounded-full blur-2xl pointer-events-none" />

                    {/* Top Row: Company Branding & Country / Serial Pill */}
                    <div className="relative z-10 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-xs sm:text-sm font-black text-white tracking-tight leading-none truncate">
                          BNB Business Co-operative Ltd.
                        </h3>
                        <p className="text-[8px] sm:text-[9px] text-emerald-400 uppercase font-black tracking-widest font-mono mt-1">
                          {myAgentProfile?.badgeLabel || 'OFFICIAL BNB AGENT ID'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/15 font-mono text-[9px] sm:text-[10px] font-black text-amber-300">
                          {cardSerial}
                        </span>
                        <span className="text-lg sm:text-xl leading-none">🇧🇩</span>
                      </div>
                    </div>

                    {/* Middle Row: Profile Photo + Auto-Populated Name, Serial, Phone & Location */}
                    <div className="relative z-10 flex items-center gap-3 sm:gap-3.5 my-auto">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/10 border-2 border-emerald-400/60 overflow-hidden shrink-0 shadow-lg flex items-center justify-center">
                        <img
                          src={rawProfileImg}
                          alt={cardName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <h4 className="text-xs sm:text-sm font-black text-white leading-tight truncate">
                          {cardName}
                        </h4>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[9.5px] sm:text-[10.5px] font-bold">
                          <span className="text-amber-300 font-mono truncate">
                            সিরিয়াল: {cardSerial}
                          </span>
                          <span className="text-emerald-300 font-mono truncate">
                            📞 {cardPhone}
                          </span>
                        </div>

                        <div className="flex items-start gap-1 text-[9px] sm:text-[10px] text-slate-200 font-semibold leading-snug">
                          <MapPin className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">
                            {cardFullLocation}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Auto Location Breakdown Chips + Live Approval Status */}
                    <div className="relative z-10 flex items-center justify-between gap-2 border-t border-white/10 pt-2 text-[8px] sm:text-[8.5px] font-bold tracking-wide">
                      <span className="text-slate-300 truncate">
                        {[cardDistrict && `জেলা: ${cardDistrict}`, cardThana && `থানা: ${cardThana}`]
                          .filter(Boolean)
                          .join(' • ') || 'AUTO SYNCED FROM FORM'}
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0 uppercase tracking-wider font-black">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            appStatus === 'approved'
                              ? 'bg-emerald-400 animate-pulse'
                              : appStatus === 'pending'
                                ? 'bg-amber-400 animate-pulse'
                                : 'bg-sky-400'
                          }`}
                        />
                        <span
                          className={
                            appStatus === 'approved'
                              ? 'text-emerald-300'
                              : appStatus === 'pending'
                                ? 'text-amber-300'
                                : 'text-sky-300'
                          }
                        >
                          {appStatus === 'approved'
                            ? 'VERIFIED ACTIVE AGENT'
                            : appStatus === 'pending'
                              ? 'PENDING APPROVAL'
                              : 'PROFILE CARD'}
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* ================= WHATSAPP BUSINESS STYLE AGENT SCHEDULE & DOUBLE BREAK EDITOR ================= */}
              {(() => {
                const livePreview = getLiveScheduleStatus(weeklySchedule);
                return (
                  <div className="bg-gradient-to-b from-emerald-50/70 to-white border border-emerald-200 rounded-3xl p-4 shadow-3xs space-y-3.5">
                    <div className="flex items-start justify-between gap-2 border-b border-emerald-100 pb-2.5">
                      <div className="flex items-start gap-2">
                        <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl shrink-0">
                          <Clock className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <h3 className="text-xs font-black text-emerald-950">
                            কাজের সময়সূচি ও সাপ্তাহিক বন্ধ (WhatsApp স্টাইল)
                          </h3>
                          <p className="text-[10px] text-slate-600 font-semibold leading-snug mt-0.5">
                            দোকান বা সেবা চালু/বন্ধের সময়, দুপুরের বিরতি (ডাবল শিফট) এবং শুক্রবার বা যেকোনো দিনের সাপ্তাহিক বন্ধ নির্ধারণ করুন।
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Live Schedule Status Preview */}
                    <div className="bg-white border border-emerald-200 rounded-2xl p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[10px] font-black text-slate-700">
                          আজ ({livePreview.todayDayLabel}) লাইভ অবস্থা:
                        </span>
                        <span
                          className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                            livePreview.state === 'open'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : livePreview.state === 'break'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {livePreview.statusLabel}
                        </span>
                      </div>
                      <p className="text-[10.5px] font-bold text-slate-800">
                        🕒 {livePreview.todayHours}
                      </p>
                      <p className="text-[10px] font-bold text-rose-600">
                        📅 {livePreview.closedDaysLabel}
                      </p>
                    </div>

                    {/* Quick Actions Row */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={applyFirstOpenDayToAllOpenDays}
                        className="flex-1 min-w-[140px] py-2 px-3 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-xl text-[10px] font-black transition cursor-pointer text-center"
                      >
                        ⚡ সব খোলা দিনে একই সময় দিন
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDaySchedule('fri', { enabled: !weeklySchedule.fri.enabled })}
                        className={`py-2 px-3 rounded-xl text-[10px] font-black border transition cursor-pointer ${
                          !weeklySchedule.fri.enabled
                            ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                            : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                        }`}
                      >
                        {!weeklySchedule.fri.enabled ? 'শুক্রবার: বন্ধ (চালু করুন)' : 'শুক্রবার: খোলা (বন্ধ করুন)'}
                      </button>
                    </div>

                    {/* 7-Day WhatsApp Business Schedule Rows */}
                    <div className="space-y-2.5">
                      {WEEK_DAYS.map(({ key, labelBn }) => {
                        const dayCfg = weeklySchedule[key];
                        return (
                          <div
                            key={key}
                            className={`rounded-2xl border p-3 transition ${
                              dayCfg.enabled
                                ? 'bg-white border-emerald-200 shadow-4xs'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            {/* Day Header + Open/Close Toggle */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                    dayCfg.enabled ? 'bg-emerald-500' : 'bg-rose-400'
                                  }`}
                                />
                                <span className="text-xs font-black text-slate-900">{labelBn}</span>
                                <span
                                  className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full ${
                                    dayCfg.enabled
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-rose-50 text-rose-700'
                                  }`}
                                >
                                  {dayCfg.enabled ? 'খোলা' : 'সাপ্তাহিক বন্ধ'}
                                </span>
                              </div>

                              <button
                                type="button"
                                role="switch"
                                aria-checked={dayCfg.enabled}
                                onClick={() => updateDaySchedule(key, { enabled: !dayCfg.enabled })}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                                  dayCfg.enabled ? 'bg-[#0D9488]' : 'bg-slate-300'
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                    dayCfg.enabled ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </div>

                            {/* Time Pickers when Day is Open */}
                            {dayCfg.enabled ? (
                              <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-2.5">
                                {/* Shift 1 */}
                                <div className="space-y-1">
                                  <span className="text-[9.5px] font-black text-emerald-800 block">
                                    ১ম শিফট (খোলা থেকে বিরতি/বন্ধ):
                                  </span>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-[8.5px] font-bold text-slate-500 block mb-0.5">
                                        শুরু ({formatTimeBn(dayCfg.slot1Start)})
                                      </label>
                                      <input
                                        type="time"
                                        value={dayCfg.slot1Start}
                                        onChange={(e) => updateDaySchedule(key, { slot1Start: e.target.value })}
                                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono font-black text-slate-800 focus:ring-1 focus:ring-[#0D9488] outline-none"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[8.5px] font-bold text-slate-500 block mb-0.5">
                                        শেষ ({formatTimeBn(dayCfg.slot1End)})
                                      </label>
                                      <input
                                        type="time"
                                        value={dayCfg.slot1End}
                                        onChange={(e) => updateDaySchedule(key, { slot1End: e.target.value })}
                                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono font-black text-slate-800 focus:ring-1 focus:ring-[#0D9488] outline-none"
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Double Break / Shift 2 Toggle */}
                                <div className="flex items-center justify-between gap-2 bg-amber-50/70 border border-amber-200/70 rounded-xl px-2.5 py-1.5">
                                  <span className="text-[10px] font-black text-amber-900">
                                    ☕ দুপুরের বিরতি ও ২য় শিফট (ডাবল ব্রেক)
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => updateDaySchedule(key, { hasSecondSlot: !dayCfg.hasSecondSlot })}
                                    className={`text-[9.5px] font-black px-2.5 py-0.5 rounded-lg border cursor-pointer transition ${
                                      dayCfg.hasSecondSlot
                                        ? 'bg-amber-600 text-white border-amber-600'
                                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                                    }`}
                                  >
                                    {dayCfg.hasSecondSlot ? 'চালু আছে ✓' : '+ ২য় শিফট যোগ করুন'}
                                  </button>
                                </div>

                                {/* Shift 2 if Double Break enabled */}
                                {dayCfg.hasSecondSlot && (
                                  <div className="space-y-1 pl-2 border-l-2 border-amber-300">
                                    <span className="text-[9.5px] font-black text-amber-900 block">
                                      ২য় শিফট (বিরতির পর পুনরায় খোলা):
                                    </span>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-[8.5px] font-bold text-slate-500 block mb-0.5">
                                          শুরু ({formatTimeBn(dayCfg.slot2Start)})
                                        </label>
                                        <input
                                          type="time"
                                          value={dayCfg.slot2Start}
                                          onChange={(e) => updateDaySchedule(key, { slot2Start: e.target.value })}
                                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono font-black text-slate-800 focus:ring-1 focus:ring-[#0D9488] outline-none"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[8.5px] font-bold text-slate-500 block mb-0.5">
                                          শেষ ({formatTimeBn(dayCfg.slot2End)})
                                        </label>
                                        <input
                                          type="time"
                                          value={dayCfg.slot2End}
                                          onChange={(e) => updateDaySchedule(key, { slot2End: e.target.value })}
                                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono font-black text-slate-800 focus:ring-1 focus:ring-[#0D9488] outline-none"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="mt-1.5 text-[10px] font-bold text-rose-600">
                                🚫 এই দিনে সেবা বন্ধ থাকবে — ম্যাপ ও এজেন্ট কার্ডে সাপ্তাহিক বন্ধ দেখাবে।
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {scheduleErrorMsg && (
                      <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-[10.5px] font-bold text-rose-700">
                        ⚠️ {scheduleErrorMsg}
                      </div>
                    )}

                    {scheduleSuccessMsg && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-[10.5px] font-bold text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{scheduleSuccessMsg}</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleSaveAgentSchedule}
                      disabled={isSavingSchedule}
                      className="w-full py-3 bg-[#0D9488] hover:bg-[#0B7A70] disabled:bg-slate-300 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
                    >
                      {isSavingSchedule ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4 shrink-0" />
                      )}
                      <span>সময়সূচি সেভ করুন 💾</span>
                    </button>
                  </div>
                );
              })()}

              <div className="bg-slate-50 border border-slate-150 p-3.5 rounded-2xl text-[10px] text-slate-600 leading-relaxed font-semibold">
                <p className="font-black text-slate-800 text-[11px] mb-1">ℹ️ অনুমোদন প্রক্রিয়াঃ</p>
                আপনার আবেদনপত্রটি দাখিল হওয়ার পর, BNB কেন্দ্রীয় গভর্নিং বোর্ড প্রতিটি এলাকার কোটা অনুযায়ী তথ্য রিভিও করে থাকে। অনুমোদন সম্পন্ন হলেই আপনার আইডি কার্ডটি সচল হবে এবং আপনি আপনার এলাকায় কালেকশন পয়েন্ট ও কিস্তি গ্রহণ সেবা শুরু করতে পারবেন।
              </div>

              {/* MANUAL STATIC LOCATION SETTING (Request #7 & #10 fix) */}
              {(user.role === 'agent' || myAgentProfile) && (
                <div className="bg-emerald-50/50 border border-emerald-200 p-4 rounded-3xl space-y-3.5 shadow-3xs">
                  <div className="flex items-center gap-2 border-b border-emerald-100 pb-2">
                    <MapPinned className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-[11px] font-black text-emerald-900 uppercase tracking-tight">ম্যাপে স্থায়ী অবস্থান সেট করুন</h3>
                  </div>

                  <p className="text-[9px] text-slate-600 font-bold leading-snug">
                    আপনার স্থায়ী ব্যবসায়িক লোকেশন ম্যাপে সেট করুন। এটি পরিবর্তন করলে এডমিন অনুমোদনের প্রয়োজন হবে।
                  </p>

                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1">লিখিত লোকেশন (Written Address)</label>
                    <input 
                      type="text" 
                      value={writtenLocation}
                      onChange={(e) => setWrittenLocation(e.target.value)}
                      placeholder="যেমনঃ খড়কী, যশোর সদর, যশোর"
                      className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-[10px] font-bold focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400 outline-none"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!writtenLocation.trim()) return;
                        const result = await geocodeTextOrLink(writtenLocation);
                        if (result) {
                          setManualLat(String(result.lat));
                          setManualLng(String(result.lng));
                          alert('লোকেশন থেকে স্থানাঙ্ক চিহ্নিত করা হয়েছে!');
                        }
                      }}
                      className="w-full py-1.5 bg-sky-50 text-sky-700 rounded-lg text-[8px] font-black uppercase tracking-wider border border-sky-100"
                    >
                      ম্যাপ থেকে স্থানাঙ্ক বের করুন
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase ml-1">ল্যাটিটিউড (Latitude)</label>
                      <input 
                        type="text" 
                        value={manualLat}
                        onChange={(e) => setManualLat(e.target.value)}
                        placeholder="e.g. 23.8103"
                        className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-[10px] font-mono font-bold focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-slate-400 uppercase ml-1">লঙ্গিটিউড (Longitude)</label>
                      <input 
                        type="text" 
                        value={manualLng}
                        onChange={(e) => setManualLng(e.target.value)}
                        placeholder="e.g. 90.4125"
                        className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-[10px] font-mono font-bold focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400 outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleUpdateAgentCoordinates}
                      disabled={isUpdatingLoc}
                      className="w-full py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl text-[9px] font-black flex items-center justify-center gap-1.5 transition shadow-4xs cursor-pointer"
                    >
                      <span>📍 বর্তমান জিপিএস থেকে লোকেশন নিন</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleSaveManualLocation}
                      disabled={isSavingManualLoc || (!manualLat || !manualLng)}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-[10px] font-black flex items-center justify-center gap-2 transition shadow-3xs cursor-pointer shadow-emerald-200"
                    >
                      {isSavingManualLoc ? (
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : <CheckCircle className="w-4 h-4" />}
                      <span>স্থায়ী অবস্থান হিসেবে সেভ করুন</span>
                    </button>
                  </div>

                  <p className="text-[8px] text-slate-400 font-bold text-center italic">
                    * গুগল ম্যাপ থেকে ল্যাটিটিউড/লঙ্গিটিউড কপি করে এখানে বসাতে পারেন।
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

      </main>
      )}

      {/* ================= STICKY BOTTOM TABS FOOTER (Hidden when dedicated Full-Screen Apply page is open) ================= */}
      {activeTab !== 'apply' && (
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-150 py-1.5 z-40 max-w-lg mx-auto shadow-md">
        <div className="grid grid-cols-4 gap-1 text-center">
          {/* Tab 1: হোম */}
          <button 
            type="button"
            onClick={onBack}
            className="flex flex-col items-center justify-center text-slate-450 hover:text-slate-800 cursor-pointer text-center"
          >
            <span className="text-lg">🏡</span>
            <span className="text-[9px] font-bold font-sans tracking-tight mt-0.5">হোম</span>
          </button>

          {/* Tab 2: এজেন্ট ম্যাপ (HIGHLIGHTED Tab) */}
          <button 
            type="button"
            onClick={() => setActiveTab('map')}
            className={`flex flex-col items-center justify-center cursor-pointer text-center ${activeTab === 'map' ? 'text-[#0D9488]' : 'text-slate-450 hover:text-slate-850'}`}
          >
            <MapPin className={`w-4.5 h-4.5 ${activeTab === 'map' ? 'text-[#0D9488]' : 'text-slate-450'}`} />
            <span className="text-[9px] font-bold font-sans tracking-tight mt-0.5">এজেন্ট ম্যাপ</span>
          </button>

          {/* Tab 3: আমার আবেদন */}
          <button 
            type="button"
            onClick={() => setActiveTab('my-applications')}
            className={`flex flex-col items-center justify-center cursor-pointer text-center ${activeTab === 'my-applications' ? 'text-[#0D9488]' : 'text-slate-450 hover:text-slate-850'}`}
          >
            <FileText className={`w-4.5 h-4.5 ${activeTab === 'my-applications' ? 'text-[#0D9488]' : 'text-slate-450'}`} />
            <span className="text-[9px] font-bold font-sans tracking-tight mt-0.5">আমার আবেদন</span>
          </button>

          {/* Tab 4: প্রোফাইল */}
          <button 
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center cursor-pointer text-center ${activeTab === 'profile' ? 'text-[#0D9488]' : 'text-slate-450 hover:text-slate-850'}`}
          >
            <User className={`w-4.5 h-4.5 ${activeTab === 'profile' ? 'text-[#0D9488]' : 'text-slate-450'}`} />
            <span className="text-[9px] font-bold font-sans tracking-tight mt-0.5">প্রোফাইল</span>
          </button>
        </div>
      </footer>
      )}

    </div>
  );
}

