import React, { useState, useEffect, useMemo } from 'react';
import { User, Transaction, AppConfig } from '../types';
import { db } from '../lib/firebase';
import SamityAdmin from './SamityAdmin';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { 
  Menu,
  Bell,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  PiggyBank,
  FileText,
  Users,
  UserPlus,
  CheckCircle,
  HelpCircle,
  Plus,
  ArrowDown,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Check,
  Hourglass,
  Lock,
  Wallet,
  Sparkles,
  ClipboardList,
  Search,
  BookOpen,
  LineChart,
  Home,
  MessageCircle,
  User as UserIcon,
  RefreshCw,
  Award,
  AlertTriangle,
  Send,
  Play,
  Volume2,
  Calendar,
  X,
  ShieldCheck,
  Smartphone,
  Copy,
  Trash2,
  CheckCircle2,
  PlusCircle,
  PhoneCall,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { normalizePhoneNumber, findUserInFirestoreByPhone } from '../lib/memberUtils';

interface SamityScreenProps {
  user: User;
  allUsers: User[];
  onBack: () => void;
  syncLiveProfile: () => void;
  setActiveTab: (tab: 'home' | 'deposit' | 'loan' | 'history' | 'profile') => void;
  setModalType: (type: any) => void;
  appConfig?: AppConfig;
  allNotices?: any[];
}

export default function SamityScreen({ 
  user, 
  allUsers, 
  onBack, 
  syncLiveProfile,
  setActiveTab,
  setModalType,
  appConfig,
  allNotices = []
}: SamityScreenProps) {
  
  // High-fidelity active sub-view state inside full-screen Samity option
  const [activeSubView, setActiveSubView] = useState<'main' | 'savings_dps' | 'loan_ledger' | 'profits' | 'member_registry' | 'withdraw_savings' | 'new_deposit' | 'monthly_investment_policy' | 'referral_network' | 'share_transfer' | 'register_other_member' | 'custom_savings' | 'admin'>('main');
  const [bottomTab, setBottomTab] = useState<'home' | 'report' | 'messages' | 'profile'>('home');

  // States for registering other member
  const [createdMembersCount, setCreatedMembersCount] = useState<number>(0);
  const [createdMembersList, setCreatedMembersList] = useState<User[]>([]);
  const [regMemberName, setRegMemberName] = useState('');
  const [regMemberPhone, setRegMemberPhone] = useState('');
  const [regFatherName, setRegFatherName] = useState('');
  const [regMotherName, setRegMotherName] = useState('');
  const [regMemberNid, setRegMemberNid] = useState('');
  const [regMemberDob, setRegMemberDob] = useState('');
  const [regMemberCountry, setRegMemberCountry] = useState('Bangladesh (বাংলাদেশ)');
  const [regMemberDivision, setRegMemberDivision] = useState('');
  const [regMemberDistrict, setRegMemberDistrict] = useState('');
  const [regMemberThana, setRegMemberThana] = useState('');
  const [regMemberPostOffice, setRegMemberPostOffice] = useState('');
  const [regNomineeName, setRegNomineeName] = useState('');
  const [regNomineeRelation, setRegNomineeRelation] = useState('');
  const [regNomineePhone, setRegNomineePhone] = useState('');
  const [regMonthlySavingsOption, setRegMonthlySavingsOption] = useState<string>('');
  const [regCustomSavingsAmount, setRegCustomSavingsAmount] = useState<string>('');
  const [regAgreed, setRegAgreed] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccessData, setRegSuccessData] = useState<{ name: string; phone: string; memberId: string } | null>(null);

  const pushedSubViewRef = React.useRef<{ subView: string; tab: string }>({ subView: 'main', tab: 'home' });

  useEffect(() => {
    const isMain = activeSubView === 'main' && bottomTab === 'home';
    if (!isMain) {
      if (pushedSubViewRef.current.subView !== activeSubView || pushedSubViewRef.current.tab !== bottomTab) {
        pushedSubViewRef.current = { subView: activeSubView, tab: bottomTab };
        window.history.pushState({ dashboardModal: 'samity', samitySubView: activeSubView, samityBottomTab: bottomTab }, '');
      }
    } else {
      pushedSubViewRef.current = { subView: 'main', tab: 'home' };
    }
  }, [activeSubView, bottomTab]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (state && state.dashboardModal === 'samity') {
        const targetView = state.samitySubView || 'main';
        const targetTab = state.samityBottomTab || 'home';
        if (activeSubView !== targetView || bottomTab !== targetTab) {
          pushedSubViewRef.current = { subView: targetView, tab: targetTab };
          setActiveSubView(targetView);
          setBottomTab(targetTab);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [activeSubView, bottomTab]);

  // Ledger lists fetched from db
  const [liveDbUsers, setLiveDbUsers] = useState<User[]>([]);
  const [userTxHistory, setUserTxHistory] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [showSectionTxHistory, setShowSectionTxHistory] = useState(false);
  const [txModalSearch, setTxModalSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showBalance, setShowBalance] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [copySuccess, setCopySuccess] = useState('');
  const [samityAutoSavingsActive, setSamityAutoSavingsActive] = useState<boolean>(
    user.samityAutoSavingsActive !== undefined ? user.samityAutoSavingsActive : true
  );

  useEffect(() => {
    let rawUsersList: User[] = [];
    let rawSamityAppsList: any[] = [];

    const syncCombined = () => {
      const usersMap = new Map<string, User>();
      rawUsersList.forEach(u => {
        const key = u.uid || (u as any).id;
        if (key) {
          usersMap.set(key, { ...u });
        }
      });

      rawSamityAppsList.forEach(app => {
        const key = app.userId || app.uid || app.id || app.docId;
        if (key) {
          if (usersMap.has(key)) {
            const existing = usersMap.get(key)!;
            if (app.savings) existing.savings = Math.max(Number(existing.savings) || 0, Number(app.savings) || 0);
            if (app.dpsBalance) existing.dpsBalance = Math.max(Number(existing.dpsBalance) || 0, Number(app.dpsBalance) || 0);
            if (app.nomineeName) existing.nomineeName = app.nomineeName;
            if (app.nomineePhone) existing.nomineePhone = app.nomineePhone;
            if (app.monthlySavingsTarget) existing.monthlySavingsTarget = app.monthlySavingsTarget;
            if (app.samityStatus === 'approved' || app.status === 'approved' || app.approved === true) {
              existing.samityStatus = 'approved';
              existing.samityApproved = true;
            }
          } else {
            const isApproved = app.approved === true || app.status === 'approved' || app.samityStatus === 'approved';
            const newUser: User = {
              uid: key,
              name: app.name || 'সদস্য আবেদনকারী',
              phone: app.phone || '',
              memberId: app.memberId || '',
              pin: app.pin || '1234',
              role: 'user',
              balance: app.balance || 0,
              savings: app.savings || 0,
              dpsBalance: app.dpsBalance || 0,
              dueLoan: app.dueLoan || 0,
              createdAt: app.createdAt || new Date().toISOString(),
              samityStatus: isApproved ? 'approved' : (app.status || 'pending'),
              samityApproved: isApproved,
              approved: isApproved,
              status: isApproved ? 'active' : 'inactive'
            };
            usersMap.set(key, newUser);
          }
        }
      });

      setLiveDbUsers(Array.from(usersMap.values()));
    };

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      rawUsersList = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
      syncCombined();
    }, (err) => {
      console.error("Error fetching live users for Samity summary:", err);
    });

    const unsubSamityApps = onSnapshot(collection(db, 'samity_applications'), (snap) => {
      rawSamityAppsList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      syncCombined();
    }, (err) => {
      console.error("Error fetching live samity applications for Samity summary:", err);
    });

    return () => {
      unsubUsers();
      unsubSamityApps();
    };
  }, []);

  useEffect(() => {
    if (user.samityAutoSavingsActive !== undefined) {
      setSamityAutoSavingsActive(user.samityAutoSavingsActive);
    }
  }, [user.samityAutoSavingsActive]);

  // Fetch count and list of members created by this user
  useEffect(() => {
    if (activeSubView === 'register_other_member' && user?.uid) {
      const fetchCreatedMembers = async () => {
        try {
          const usersSnap = await getDocs(collection(db, 'users'));
          const created: User[] = [];
          usersSnap.forEach((docSnap) => {
            const u = docSnap.data() as User;
            if (
              u.createdByUid === user.uid ||
              (u.createdByMemberId && u.createdByMemberId === user.memberId) ||
              (u.referrerMemberId && u.referrerMemberId === user.memberId)
            ) {
              created.push({ ...u, uid: docSnap.id });
            }
          });
          setCreatedMembersCount(created.length);
          setCreatedMembersList(created);
        } catch (e) {
          console.error("Error fetching created members count:", e);
        }
      };
      fetchCreatedMembers();
    }
  }, [activeSubView, user?.uid, user?.memberId]);

  const handleRegisterOtherMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    if (!regMemberName.trim()) {
      setRegError('নতুন সদস্যের নাম প্রদান করা বাধ্যতামূলক।');
      return;
    }

    if (!regMemberPhone.trim() || regMemberPhone.trim().length < 5) {
      setRegError('সঠিক মোবাইল নম্বর প্রদান করুন।');
      return;
    }

    if (!regAgreed) {
      setRegError('আবেদন জমা দিতে অবশ্যই নীতিমালার সাথে একমত পোষণ করুন।');
      return;
    }

    if (!regMemberNid.trim()) {
      setRegError('অনুগ্রহ করে জাতীয় পরিচয়পত্র (NID), পাসপোর্ট অথবা জন্ম নিবন্ধন নম্বর লিখুন।');
      return;
    }

    if (!regNomineeName.trim()) {
      setRegError('অনুগ্রহ করে নমিনির নাম প্রদান করুন।');
      return;
    }

    if (!regNomineePhone.trim()) {
      setRegError('অনুগ্রহ করে নমিনির মোবাইল নম্বর প্রদান করুন।');
      return;
    }

    if (!regMonthlySavingsOption) {
      setRegError('অনুগ্রহ করে কাঙ্ক্ষিত মাসিক সঞ্চয় স্কিম নির্ধারণ করুন।');
      return;
    }

    let savingsTarget = 500;
    if (regMonthlySavingsOption === 'custom') {
      const parsedAmt = parseInt(regCustomSavingsAmount, 10);
      if (isNaN(parsedAmt) || parsedAmt < 500) {
        setRegError('মাসিক সঞ্চয়ের পরিমাণ সর্বনিম্ন ৫০০ টাকা বা তার বেশি হতে হবে (ইংলিশ সংখ্যায় লিখুন)।');
        return;
      }
      savingsTarget = parsedAmt;
    } else {
      savingsTarget = parseInt(regMonthlySavingsOption, 10);
    }

    setRegLoading(true);
    try {
      const normPhone = normalizePhoneNumber(regMemberPhone);
      const formattedPhone = regMemberPhone.startsWith('+') ? regMemberPhone : '+880' + regMemberPhone.replace(/^0+/, '');

      // ⚡ 1. Check if user already exists locally (< 0.1ms)
      const existingLocal = allUsers?.find(u => 
        (u.phone && (u.phone === regMemberPhone || u.phone === formattedPhone)) || 
        (u.normalizedPhone && u.normalizedPhone === normPhone)
      );
      if (existingLocal) {
        setRegError(`এই মোবাইল নম্বরটি (${existingLocal.phone || regMemberPhone}) ইতিমধ্যে নিবন্ধিত রয়েছে (সদস্য নাম: ${existingLocal.name}, আইডি: ${existingLocal.memberId})।`);
        setRegLoading(false);
        return;
      }

      // ⚡ 2. Instant Member ID generation from in-memory allUsers (< 0.1ms)
      let maxSerial = 0;
      if (Array.isArray(allUsers) && allUsers.length > 0) {
        allUsers.forEach((u) => {
          if (u.memberId && u.memberId.startsWith('BNB')) {
            const serialPart = u.memberId.replace('BNB', '');
            const serialNum = parseInt(serialPart, 10);
            if (!isNaN(serialNum) && serialNum > maxSerial) {
              maxSerial = serialNum;
            }
          }
        });
      }
      const nextSerial = Math.max(maxSerial, (allUsers?.length || 0)) + 1;
      const newMemberId = `BNB${String(nextSerial).padStart(8, '0')}`;
      const userDocId = 'user_' + (normPhone || Date.now().toString());
      const nowIso = new Date().toISOString();

      const newMemberDoc: User = {
        uid: userDocId,
        name: regMemberName.trim(),
        phone: formattedPhone,
        normalizedPhone: normPhone,
        memberId: newMemberId,
        pin: '', // Empty PIN - member sets PIN upon first login
        pinSet: false,
        isPendingPin: true,
        role: 'user',
        balance: 0,
        savings: 0,
        telecomBalance: 0,
        superShopBalance: 0,
        dueLoan: 0,
        lockedBalance: 0,
        pendingBalance: 0,
        monthlySavingsTarget: savingsTarget,
        createdAt: nowIso,
        approved: false, // Requires admin approval before login
        samityStatus: 'pending',
        status: 'inactive',
        createdByUid: user.uid,
        createdByMemberId: user.memberId || '',
        createdByMemberName: user.name,
        referrerMemberId: user.memberId || '',
        country: regMemberCountry,
        fatherName: regFatherName.trim(),
        motherName: regMotherName.trim(),
        nid: regMemberNid.trim(),
        dob: regMemberDob,
        division: regMemberDivision,
        district: regMemberDistrict,
        thana: regMemberThana,
        postOffice: regMemberPostOffice,
        nomineeName: regNomineeName.trim(),
        nomineeRelation: regNomineeRelation.trim(),
        nomineePhone: regNomineePhone.trim()
      };

      const appDocData = {
        ...newMemberDoc,
        status: 'pending',
        samityStatus: 'pending',
        approved: false,
        submittedAt: nowIso,
        appliedAt: nowIso,
        applicantName: regMemberName.trim()
      };

      // ⚡ 3. Parallel Firestore document creation (users & samity_applications concurrently under 0.5s)
      await Promise.all([
        setDoc(doc(db, 'users', userDocId), newMemberDoc, { merge: true }),
        setDoc(doc(db, 'samity_applications', userDocId), appDocData, { merge: true })
      ]);

      // ⚡ 4. Background Async Notifications (non-blocking)
      addDoc(collection(db, 'admin_notifications'), {
        type: 'samity_membership_application',
        title: '🏢 নতুন সদস্য আবেদনের অনুরোধ (রেফারেল)',
        message: `${user.name} (${user.memberId}) নতুন সদস্য ${regMemberName.trim()} (${formattedPhone}) এর জন্য সদস্যপদ আবেদন জমা দিয়েছেন।`,
        userId: userDocId,
        userName: regMemberName.trim(),
        referrerName: user.name,
        referrerMemberId: user.memberId || '',
        read: false,
        createdAt: nowIso
      }).catch(eAdminNotif => console.warn("Admin notification warning:", eAdminNotif));

      addDoc(collection(db, 'user_notifications'), {
        userId: user.uid,
        title: '📩 সদস্য আবেদন জমা সফল!',
        message: `আপনি সফলভাবে ${regMemberName.trim()} (আইডি: ${newMemberId}, মোবাইল: ${formattedPhone}) এর সদস্যপদ আবেদন সাবমিট করেছেন। এডমিন অনুমোদনের পর তিনি লগইন করতে পারবেন।`,
        timestamp: nowIso,
        read: false
      }).catch(eNotif => console.warn("Notification add warning:", eNotif));

      // ⚡ 5. Instant UI State Update
      setCreatedMembersCount(prev => prev + 1);
      setCreatedMembersList(prev => [newMemberDoc, ...prev]);

      setRegSuccessData({
        name: regMemberName.trim(),
        phone: formattedPhone,
        memberId: newMemberId
      });

      // Reset form fields
      setRegMemberName('');
      setRegMemberPhone('');
      setRegFatherName('');
      setRegMotherName('');
      setRegMemberNid('');
      setRegMemberDob('');
      setRegMemberDivision('');
      setRegMemberDistrict('');
      setRegMemberThana('');
      setRegMemberPostOffice('');
      setRegNomineeName('');
      setRegNomineeRelation('');
      setRegNomineePhone('');
      setRegCustomSavingsAmount('');
      setRegAgreed(false);

    } catch (err: any) {
      console.error(err);
      setRegError(`একাউন্ট তৈরি করতে সমস্যা হয়েছে: ${err?.message || JSON.stringify(err)}।`);
    } finally {
      setRegLoading(false);
    }
  };
  const [showHelplineModal, setShowHelplineModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [deactivatePin, setDeactivatePin] = useState('');
  const [deactivateSubmitting, setDeactivateSubmitting] = useState(false);

  // Dec 25 Auto Balance Release effect
  useEffect(() => {
    const checkDec25AutoRelease = async () => {
      if (!user.uid) return;
      const now = new Date();
      const isDec25OrLater = now.getMonth() === 11 && now.getDate() >= 25;
      const isApproved = user.samityDeactivateStatus === 'approved' || (user.canDisableAutoSavings && user.samityAutoSavingsActive === false);
      const savingsToRelease = Number(user.savings || 0);

      if (isDec25OrLater && isApproved && savingsToRelease > 0) {
        try {
          const newBalance = (user.balance || 0) + savingsToRelease;
          const userRef = doc(db, 'users', user.uid);
          
          await updateDoc(userRef, {
            balance: newBalance,
            savings: 0,
            samityDeactivateStatus: 'released',
            samityAutoSavingsActive: false
          });

          const nowIso = now.toISOString();
          await addDoc(collection(db, 'transactions'), {
            userId: user.uid,
            userName: user.name || '',
            memberId: user.memberId || '',
            phone: user.phone || '',
            type: 'samity_release',
            typeLabel: 'সমিতি সঞ্চয় মেয়ারপূর্তি রিফান্ড (২৫ ডিসেম্বর)',
            amount: savingsToRelease,
            preBalance: user.balance || 0,
            postBalance: newBalance,
            status: 'completed',
            description: `২৫শে ডিসেম্বর সমবায় সমিতি সঞ্চয় অফ আবেদনের নীতি অনুযায়ী জমানো ৳${savingsToRelease.toLocaleString('bn-BD')} টাকা মেইন ব্যালেন্সে স্বয়ংক্রিয়ভাবে রিফান্ড করা হয়েছে।`,
            createdAt: nowIso,
            receiptNo: `REFUND-DEC25-${Date.now()}`
          });

          await addDoc(collection(db, 'user_notifications'), {
            userId: user.uid,
            memberId: user.memberId || '',
            title: '🎉 ২৫শে ডিসেম্বর সমবায় সঞ্চয় রিফান্ড!',
            body: `আপনার অনুমোদিত সঞ্চয় বন্ধের আবেদন অনুযায়ী সঞ্চিত ৳${savingsToRelease.toLocaleString('bn-BD')} টাকা সফলভাবে মেইন ব্যালেন্সে স্থানান্তরিত করা হয়েছে।`,
            read: false,
            isPersonal: true,
            isTransactionHistory: true,
            category: 'transaction',
            createdAt: nowIso
          });

          syncLiveProfile();
          setCustomAlert({
            title: '🎉 ২৫শে ডিসেম্বর সমবায় সঞ্চয় রিফান্ড সম্পূর্ণ!',
            message: `আপনার সমবায় সমিতি সঞ্চয়ের মোট ৳${savingsToRelease.toLocaleString('bn-BD')} টাকা সফলভাবে আপনার মেইন ব্যালেন্সে জমা করা হয়েছে।`
          });
        } catch (err) {
          console.error("Auto release error:", err);
        }
      }
    };

    checkDec25AutoRelease();
  }, [user.uid, user.samityDeactivateStatus, user.savings, user.canDisableAutoSavings, user.samityAutoSavingsActive]);

  // Handle Dec 25-30 auto-transfer when auto-savings switch is OFF
  const [selectedPayMonth, setSelectedPayMonth] = useState<{ id: string; monthNum: number; name: string; year: number } | null>(null);
  const [monthPayLoading, setMonthPayLoading] = useState(false);
  const [trackerSelectedYear, setTrackerSelectedYear] = useState<number>(new Date().getFullYear() > 2050 ? 2050 : Math.max(2026, new Date().getFullYear()));
  const [show2050CalendarModal, setShow2050CalendarModal] = useState(false);

  const SAMITY_YEARS = Array.from({ length: 2050 - 2026 + 1 }, (_, i) => 2026 + i);

  const SAMITY_MONTHS = [
    { id: 'jan', monthNum: 1, name: 'জানুয়ারি', short: 'Jan' },
    { id: 'feb', monthNum: 2, name: 'ফেব্রুয়ারি', short: 'Feb' },
    { id: 'mar', monthNum: 3, name: 'মার্চ', short: 'Mar' },
    { id: 'apr', monthNum: 4, name: 'এপ্রিল', short: 'Apr' },
    { id: 'may', monthNum: 5, name: 'মে', short: 'May' },
    { id: 'jun', monthNum: 6, name: 'জুন', short: 'Jun' },
    { id: 'jul', monthNum: 7, name: 'জুলাই', short: 'Jul' },
    { id: 'aug', monthNum: 8, name: 'আগস্ট', short: 'Aug' },
    { id: 'sep', monthNum: 9, name: 'সেপ্টেম্বর', short: 'Sep' },
    { id: 'oct', monthNum: 10, name: 'অক্টোবর', short: 'Oct' },
    { id: 'nov', monthNum: 11, name: 'নভেম্বর', short: 'Nov' },
    { id: 'dec', monthNum: 12, name: 'ডিসেম্বর', short: 'Dec' },
  ];

  // Monthly Auto-debit (1st to 9th of every month)
  useEffect(() => {
    const checkMonthlyAutoDebit = async () => {
      const now = new Date();
      const date = now.getDate(); // 1 to 31
      const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const monthNames = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
      const currentMonthKey = monthKeys[now.getMonth()];
      const currentMonthName = monthNames[now.getMonth()];

      // Only run between 1st and 9th of the month when auto savings active
      if (date >= 1 && date <= 9 && user.samityAutoSavingsActive !== false) {
        const paidMonths: string[] = user.samityPaidMonths || [];
        if (!paidMonths.includes(currentMonthKey) && user.lastPaidMonth !== currentYearMonth) {
          const target = user.monthlySavingsTarget || 1000;
          const userBalance = user.balance || 0;

          if (userBalance >= target) {
            try {
              const userRef = doc(db, 'users', user.uid);
              const updatedPaidMonths = Array.from(new Set([...paidMonths, currentMonthKey]));

              await updateDoc(userRef, {
                balance: userBalance - target,
                savings: (user.savings || 0) + target,
                samityPaidMonths: updatedPaidMonths,
                lastPaidMonth: currentYearMonth
              });

              await addDoc(collection(db, 'transactions'), {
                userId: user.uid,
                userName: user.name || '',
                memberId: user.memberId || '',
                type: 'samity_deposit',
                typeLabel: `অটো-ডেবিট সঞ্চয় जमा (${currentMonthName})`,
                amount: target,
                status: 'approved',
                description: `মাসিক অটো সঞ্চয় নীতি (১-৯ তারিখ): মেইন ব্যালেন্স থেকে ${currentMonthName} মাসের কিস্তি ৳${target.toLocaleString('bn-BD')} টাকা স্বয়ংক্রিয়ভাবে সমিতি সঞ্চয় ফাণ্ডে জমা করা হয়েছে।`,
                createdAt: now.toISOString(),
                receiptNo: `AUTO-DEBIT-${Date.now()}`
              });

              await addDoc(collection(db, 'user_notifications'), {
                userId: user.uid,
                memberId: user.memberId || '',
                title: `✅ ${currentMonthName} মাসের অটো-সঞ্চয় সম্পূর্ণ`,
                body: `১-৯ তারিখের নিয়মিত নিয়মানুযায়ী আপনার মেইন ব্যালেন্স থেকে ${currentMonthName} মাসের সমিতি সঞ্চয় ৳${target.toLocaleString('bn-BD')} টাকা স্বয়ংক্রিয়ভাবে জমা করা হয়েছে।`,
                read: false,
                isPersonal: true,
                isTransactionHistory: true,
                category: 'transaction',
                createdAt: now.toISOString()
              });

              syncLiveProfile();
              setCustomAlert({
                title: `✅ ${currentMonthName} মাসের অটো-সঞ্চয় কর্তন`,
                message: `প্রতি মাসের ১ থেকে ৯ তারিখের মধ্যে বকেয়া কিস্তি কর্তনের নিয়ম অনুযায়ী আপনার মেইন ব্যালেন্স থেকে ৳${target.toLocaleString('bn-BD')} টাকা কেটে সমিতি সঞ্চয় ফাণ্ডে জমা করা হয়েছে।`
              });
            } catch (err) {
              console.error("Auto debit error:", err);
            }
          }
        }
      }
    };

    checkMonthlyAutoDebit();
  }, [user.uid, user.samityAutoSavingsActive, user.balance, user.samityPaidMonths]);

  const handleConfirmMonthPayment = async () => {
    if (!selectedPayMonth) return;
    const targetAmt = user.monthlySavingsTarget || 1000;
    const payYear = selectedPayMonth.year || trackerSelectedYear;
    if ((user.balance || 0) < targetAmt) {
      setCustomAlert({
        title: '⚠️ পর্যাপ্ত ব্যালেন্স নেই',
        message: `আপনার মেইন ব্যালেন্স ৳${(user.balance || 0).toLocaleString('bn-BD')} টাকা। ${selectedPayMonth.name} ${payYear} সালের সঞ্চয় ৳${targetAmt.toLocaleString('bn-BD')} জমা দিতে পর্যাপ্ত মেইন ব্যালেন্স নেই।`
      });
      return;
    }

    setMonthPayLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const existingPaid = user.samityPaidMonths || [];
      const yearMonthKey = `${payYear}-${selectedPayMonth.id}`;
      const updatedPaid = Array.from(new Set([...existingPaid, yearMonthKey, selectedPayMonth.id]));

      await updateDoc(userRef, {
        balance: (user.balance || 0) - targetAmt,
        savings: (user.savings || 0) + targetAmt,
        samityPaidMonths: updatedPaid
      });

      const nowIso = new Date().toISOString();
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        userName: user.name || '',
        memberId: user.memberId || '',
        type: 'samity_deposit',
        typeLabel: `সমিতি সঞ্চয় জমা (${selectedPayMonth.name} ${payYear})`,
        amount: targetAmt,
        status: 'approved',
        description: `সদস্য কর্তৃক ম্যানুয়ালি ${selectedPayMonth.name} ${payYear} সালের সমিতি সঞ্চয় কিস্তি জমা দেওয়া হয়েছে।`,
        createdAt: nowIso,
        receiptNo: `DEP-MONTH-${Date.now()}`
      });

      await addDoc(collection(db, 'user_notifications'), {
        userId: user.uid,
        memberId: user.memberId || '',
        title: `✅ ${selectedPayMonth.name} ${payYear} সালের সঞ্চয় জমা সফল`,
        body: `আপনার মেইন ব্যালেন্স থেকে ${selectedPayMonth.name} ${payYear} সালের কিস্তি ৳${targetAmt.toLocaleString('bn-BD')} টাকা সমিতি সঞ্চয় ফান্ডে জমা হয়েছে।`,
        read: false,
        isPersonal: true,
        isTransactionHistory: true,
        category: 'transaction',
        createdAt: nowIso
      });

      await syncLiveProfile();
      setSelectedPayMonth(null);
      setCustomAlert({
        title: `🎉 ${selectedPayMonth.name} ${payYear} সালের জমা সফল`,
        message: `${selectedPayMonth.name} ${payYear} সালের সমিতি সঞ্চয় কিস্তি ৳${targetAmt.toLocaleString('bn-BD')} টাকা সফলভাবে জমা হয়েছে!`
      });
    } catch (err) {
      console.error('Month payment error:', err);
      alert('টাকা জমা প্রক্রিয়ায় সমস্যা ঘটেছে। আবার চেষ্টা করুন।');
    } finally {
      setMonthPayLoading(false);
    }
  };

  const [dbSearchResults, setDbSearchResults] = useState<User[]>([]);
  const [isSearchingDb, setIsSearchingDb] = useState(false);
  
  // High-fidelity Custom Pop-up Modal state
  const [customAlert, setCustomAlert] = useState<{ message: string; title?: string } | null>(null);
  const [noticeFilter, setNoticeFilter] = useState<'all' | 'samity' | 'general'>('all');
  const [readNoticeIds, setReadNoticeIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('samity_read_notice_ids') || '[]');
    } catch (e) {
      return [];
    }
  });

  // Filter allNotices strictly for Samity / Co-operative & General Admin announcements
  const samityNotices = useMemo(() => {
    return (allNotices || []).filter(n => {
      // Exclude other non-Samity section notices (telecom, safe_deal, shop, ration)
      if (n.section === 'telecom' || n.section === 'safe_deal' || n.section === 'shop' || n.section === 'ration') {
        return false;
      }
      // Exclude auto transaction/booking logs or system auto-notifications
      if (n.isTransactionHistory === true || n.isSystemAuto === true) {
        return false;
      }
      const titleText = ((n.title || '') + ' ' + (n.content || '')).toLowerCase();
      if (
        titleText.includes('নিরাপদ লেনদেন') || 
        titleText.includes('ক্যাশ ইন') || 
        titleText.includes('রিচার্জ') || 
        titleText.includes('বুর্কিং') || 
        titleText.includes('booking')
      ) {
        return false;
      }
      return true;
    });
  }, [allNotices]);

  const isSamityNoticeRead = (n: any) => {
    if (n.read === true) return true;
    const idKey = n.id || n.docId;
    if (idKey && readNoticeIds.includes(idKey)) return true;
    return false;
  };

  const unreadSamityCount = samityNotices.filter(n => !isSamityNoticeRead(n)).length;
  const hasUnreadSamity = unreadSamityCount > 0;

  const markAllSamityNoticesAsRead = () => {
    const idsToMark = samityNotices.map((n, idx) => n.id || n.docId).filter(Boolean);
    if (idsToMark.length > 0) {
      const updated = Array.from(new Set([...readNoticeIds, ...idsToMark]));
      setReadNoticeIds(updated);
      try {
        localStorage.setItem('samity_read_notice_ids', JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save read notice ids:", e);
      }
    }
  };

  const handleToggleReadNotice = (noticeId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!noticeId) return;
    
    let updated: string[];
    if (readNoticeIds.includes(noticeId)) {
      updated = readNoticeIds.filter(id => id !== noticeId);
    } else {
      updated = [...readNoticeIds, noticeId];
    }
    setReadNoticeIds(updated);
    try {
      localStorage.setItem('samity_read_notice_ids', JSON.stringify(updated));
    } catch (err) {
      console.error("Save read state error:", err);
    }
  };

  const handleDeleteNotice = async (noticeId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!noticeId) return;
    if (!window.confirm("আপনি কি এই নোটিশটি ডিলিট করতে চান?")) return;
    try {
      await deleteDoc(doc(db, 'notices', noticeId));
      setCustomAlert({ title: "সফল", message: "নোটিশটি মুছে ফেলা হয়েছে।" });
    } catch (err) {
      console.error("Failed to delete notice from firestore:", err);
      const updated = Array.from(new Set([...readNoticeIds, noticeId]));
      setReadNoticeIds(updated);
      try {
        localStorage.setItem('samity_read_notice_ids', JSON.stringify(updated));
      } catch (e) {}
    }
  };

  const handleClearAllNotices = async () => {
    if (samityNotices.length === 0) return;
    if (!window.confirm("আপনি কি নিশ্চিত যে সকল নোটিশ মুছে ফেলতে চান?")) return;
    try {
      for (const n of samityNotices) {
        const idKey = n.id || n.docId;
        if (idKey) {
          await deleteDoc(doc(db, 'notices', idKey));
        }
      }
      setCustomAlert({ title: "সফল", message: "সকল নোটিশ সফলভাবে মুছে ফেলা হয়েছে।" });
    } catch (err) {
      console.error("Clear notices error:", err);
      markAllSamityNoticesAsRead();
    }
  };

  // Automatically mark all Samity notices as read whenever Notice Board tab is opened or active
  useEffect(() => {
    if (bottomTab === 'messages') {
      markAllSamityNoticesAsRead();
    }
  }, [bottomTab, samityNotices]);

  // Admin integration states
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [adminTransactions, setAdminTransactions] = useState<Transaction[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [reconUserUid, setReconUserUid] = useState('');
  const [reconAction, setReconAction] = useState<'add_savings' | 'reduce_savings' | 'add_dps' | 'reduce_dps' | 'add_profits' | 'reduce_profits' | 'disburse_loan' | 'repay_loan_cash' | 'disburse_qard' | 'repay_qard'>('add_savings');
  const [reconAmount, setReconAmount] = useState('');
  const [reconNotes, setReconNotes] = useState('');
  const [reconSuccess, setReconSuccess] = useState('');
  const [reconError, setReconError] = useState('');
  const [dbSamityBanners, setDbSamityBanners] = useState<any[]>([]);

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    requireInput?: boolean;
    inputValue?: string;
    inputPlaceholder?: string;
    onConfirm: (val?: string) => void;
    onCancel?: () => void;
  } | null>(null);

  const requestConfirm = (title: string, description: string, onConfirm: () => void) => {
    setConfirmState({
      isOpen: true,
      title,
      description,
      onConfirm: () => {
        onConfirm();
      }
    });
  };

  const requestPrompt = (title: string, description: string, defaultValue: string, onConfirm: (val: string) => void) => {
    setConfirmState({
      isOpen: true,
      title,
      description,
      requireInput: true,
      inputValue: defaultValue,
      onConfirm: (val) => {
        onConfirm(val || '');
      }
    });
  };

  const requestAlert = (title: string, description: string) => {
    setConfirmState({
      isOpen: true,
      title,
      description,
      onConfirm: () => {}
    });
  };

  const customAlertFn = (msg: string) => {
    requestAlert('সিস্টেম রিকোয়েস্ট', msg);
  };

  const handleToggleAutoSavingsSwitch = () => {
    const nextState = !samityAutoSavingsActive;

    // Strict Admin Permission and Application logic when member attempts to turn OFF auto savings
    if (nextState === false) {
      const now = new Date();
      const currentMonth = now.getMonth(); // 11 is December
      const currentDate = now.getDate();

      // Dec 25 cutoff rule: cannot request new deactivation after Dec 25 until Jan 1
      if (currentMonth === 11 && currentDate > 25) {
        setCustomAlert({
          title: "❌ ২৫ ডিসেম্বরের সময়সীমা অতিক্রান্ত",
          message: "চলতি বছরের ২৫শে ডিসেম্বরের সময়সীমা অতিক্রান্ত হয়েছে। ২৫শে ডিসেম্বরের পর সঞ্চয় বন্ধের নতুন আবেদন গ্রহণ করা সম্ভব নয়। আপনি আগামী ১লা জানুয়ারি থেকে নতুন বছরের জন্য বন্ধের আবেদন জমা দিতে পারবেন।"
        });
        return;
      }

      // Check if user has pending request
      if (user.samityDeactivateStatus === 'pending') {
        setCustomAlert({
          title: "⏳ আবেদন প্রক্রিয়াধীন (Pending Review)",
          message: "আপনার সমিতি সঞ্চয় বন্ধের আবেদনটি ইতিমধ্যেই এডমিন প্যানেলে জমা আছে এবং পর্যালোচনায় রয়েছে। এডমিন অনুমোদন দিলে আগামী ২৫শে ডিসেম্বর আপনার সঞ্চিত মোট ৳" + (user.savings || 0).toLocaleString('bn-BD') + " টাকা স্বয়ংক্রিয়ভাবে মেইন ব্যালেন্সে ট্রান্সফার হবে।"
        });
        return;
      }

      // Check if admin permission is already granted
      const isAllowedByAdmin = Boolean(
        user.samityDeactivateStatus === 'approved' ||
        user?.canDisableAutoSavings ||
        user?.allowAutoSavingsToggle
      );

      if (!isAllowedByAdmin) {
        // Show Deactivation Application Modal to collect reason & security PIN
        setShowDeactivateModal(true);
        return;
      }
    }

    const actionText = nextState ? "সচল (ON)" : "বন্ধ (OFF)";

    const enteredPin = window.prompt(
      `🔒 সিকিউরিটি পিন কোড দিন:\n\nঅটো সঞ্চয় ডিপোজিট সুইচ ${actionText} করতে আপনার ৪ ডিজিটের সিকিউরিটি পিন কোড প্রবেশ করান:`
    );

    if (enteredPin === null) return; // User cancelled prompt

    const userPin = String(user?.pin || (user as any)?.pinCode || (user as any)?.securityPin || '').trim();

    if (userPin && enteredPin.trim() !== userPin) {
      setCustomAlert({
        title: "❌ ভুল সিকিউরিটি পিন কোড",
        message: "আপনার প্রবেশ করানো পিন কোডটি সঠিক নয়! দুর্ঘটনাবশত অটো সঞ্চয় সুইচ অন/অফ হাওয়া রোধ করতে পরিবর্তন বাতিল করা হলো।"
      });
      return;
    }

    if (!userPin && enteredPin.trim().length !== 4) {
      setCustomAlert({
        title: "❌ ৪ ডিজিটের পিন আবশ্যক",
        message: "অনুগ্রহ করে আপনার ৪ ডিজিটের সিকিউরিটি পিন কোডটি সঠিকভাবে দিন।"
      });
      return;
    }

    // Proceed with state change after valid PIN verification
    setSamityAutoSavingsActive(nextState);
    (async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          samityAutoSavingsActive: nextState
        });

        await addDoc(collection(db, 'user_notifications'), {
          id: `notif-auto-savings-${Date.now()}`,
          userId: user.uid,
          memberId: user.memberId || '',
          title: nextState ? '🔄 অটো সঞ্চয় সচল করা হয়েছে' : '⏸️ অটো সঞ্চয় বন্ধ করা হয়েছে',
          body: nextState
            ? 'আপনার সমবায় সমিতির মাসিক অটো সঞ্চয় প্রক্রিয়া পুনরায় সচল করা হলো।'
            : 'আপনার সমবায় সমিতির অটো সঞ্চয় প্রক্রিয়া বন্ধ করা হয়েছে। ২৫শে ডিসেম্বর আপনার মোট জমাকৃত অর্থ মেইন ব্যালেন্সে স্বয়ংক্রিয়ভাবে স্থানান্তর হবে।',
          read: false,
          isPersonal: true,
          createdAt: new Date().toISOString()
        });

        syncLiveProfile();
        setCustomAlert({
          title: nextState ? "অটো সঞ্চয় সচল" : "অটো সঞ্চয় বন্ধ",
          message: nextState
            ? "আপনার অটো সঞ্চয় সফলভাবে সচল করা হয়েছে।"
            : "আপনার অটো সঞ্চয় বন্ধ করা হয়েছে। একাউন্ট থেকে আর অটো টাকা কাটবে না এবং আগামী ২৫শে ডিসেম্বর জমানো সমিতি টাকা মেইন ব্যালেন্সে স্থানান্তর হবে।"
        });
      } catch (err: any) {
        console.error("Error setting auto savings switch:", err);
      }
    })();
  };

  const handleSubmitDeactivateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deactivateReason.trim()) {
      setCustomAlert({ title: "⚠️ কারণ প্রয়োজন", message: "কেন আপনি সমবায় সমিতি সঞ্চয় বন্ধ/লিভ নিতে চান তা বিস্তারিত লিখুন।" });
      return;
    }
    const userPin = String(user?.pin || (user as any)?.pinCode || (user as any)?.securityPin || '').trim();
    if (userPin && deactivatePin.trim() !== userPin) {
      setCustomAlert({ title: "❌ ভুল পিন কোড", message: "আপনার ৪ ডিজিটের পিন কোডটি সঠিক নয়!" });
      return;
    }
    if (!userPin && deactivatePin.trim().length !== 4) {
      setCustomAlert({ title: "❌ ৪ ডিজিটের পিন আবশ্যক", message: "অনুগ্রহ করে আপনার ৪ ডিজিটের সিকিউরিটি পিন কোড দিন।" });
      return;
    }

    setDeactivateSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const userRef = doc(db, 'users', user.uid);

      await updateDoc(userRef, {
        samityDeactivateStatus: 'pending',
        samityDeactivateReason: deactivateReason.trim(),
        samityDeactivateRequestedAt: nowIso
      });

      await addDoc(collection(db, 'samity_deactivate_requests'), {
        userId: user.uid,
        userName: user.name || '',
        userPhone: user.phone || '',
        memberId: user.memberId || '',
        savings: user.savings || 0,
        reason: deactivateReason.trim(),
        status: 'pending',
        createdAt: nowIso
      });

      await addDoc(collection(db, 'admin_notifications'), {
        title: '🚨 সমিতি সঞ্চয় বন্ধের আবেদন',
        message: `${user.name || 'সদস্য'} (${user.phone}) সমিতি সঞ্চয় বন্ধ করার আবেদন জমা দিয়েছেন। কারণ: ${deactivateReason.trim()}`,
        type: 'samity_deactivate',
        userId: user.uid,
        createdAt: nowIso,
        read: false
      });

      await addDoc(collection(db, 'user_notifications'), {
        userId: user.uid,
        title: '📝 সঞ্চয় বন্ধের আবেদন জমা হয়েছে',
        message: 'আপনার সমিতি সঞ্চয় বন্ধ ও লিভ আবেদন এডমিন প্যানেলে প্রেরিত হয়েছে। এডমিন অনুমোদন দিলে আগামী ২৫শে ডিসেম্বর জমানো টাকা মেইন ব্যালেন্সে ট্রান্সফার হবে।',
        type: 'samity_deactivate_submitted',
        read: false,
        createdAt: nowIso
      });

      setShowDeactivateModal(false);
      setDeactivateReason('');
      setDeactivatePin('');
      syncLiveProfile();

      setCustomAlert({
        title: "✅ আবেদন জমা হয়েছে",
        message: "আপনার সমবায় সমিতি সঞ্চয় বন্ধের আবেদন সফলভাবে এডমিন প্যানেলে প্রেরিত হয়েছে! এডমিন এটি অনুমোদন দিলে আগামী ২৫শে ডিসেম্বর আপনার সমস্ত জমানো সঞ্চয় (৳" + (user.savings || 0).toLocaleString('bn-BD') + ") স্বয়ংক্রিয়ভাবে মেইন ব্যালেন্সে যুক্ত হয়ে যাবে।"
      });
    } catch (err: any) {
      console.error("Deactivate request error:", err);
      alert("আবেদন প্রেরণে ত্রুটি ঘটেছে: " + (err?.message || "আবার চেষ্টা করুন।"));
    } finally {
      setDeactivateSubmitting(false);
    }
  };

  // Sync admin users and transactions in real-time
  useEffect(() => {
    if (user.role !== 'admin' && user.role !== 'sub_admin') return;

    setAdminLoading(true);

    const usersUnsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersList: User[] = [];
      snapshot.forEach((doc) => {
        usersList.push({ uid: doc.id, ...doc.data() } as User);
      });
      setAdminUsers(usersList);
      setAdminLoading(false);
    }, (error) => {
      console.error("Error fetching users for admin:", error);
    });

    const txUnsubscribe = onSnapshot(collection(db, 'transactions'), (snapshot) => {
      const txList: Transaction[] = [];
      snapshot.forEach((doc) => {
        txList.push({ docId: doc.id, ...doc.data() } as Transaction);
      });
      txList.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setAdminTransactions(txList);
    }, (error) => {
      console.error("Error fetching transactions for admin:", error);
    });

    return () => {
      usersUnsubscribe();
      txUnsubscribe();
    };
  }, [user.role]);

  // Sync Samity banners initially
  useEffect(() => {
    if (appConfig?.samityBanners) {
      setDbSamityBanners(appConfig.samityBanners);
    }
  }, [appConfig?.samityBanners]);

  const onChangeConfig = async (newConfig: any) => {
    try {
      const configRef = doc(db, 'app_config', 'config_v1');
      await updateDoc(configRef, newConfig);
    } catch (err: any) {
      customAlertFn("কনফিগ আপডেট করতে সমস্যা হয়েছে: " + err.message);
    }
  };

  const autoGenerateMemberId = () => {
    let maxSerial = 0;
    const totalUsers = Array.isArray(adminUsers) ? adminUsers.length : 0;
    if (Array.isArray(adminUsers)) {
      adminUsers.forEach((u) => {
        if (u.memberId && u.memberId.startsWith('BNB')) {
          const serialPart = u.memberId.replace('BNB', '');
          const serialNum = parseInt(serialPart, 10);
          if (!isNaN(serialNum) && serialNum > maxSerial) {
            maxSerial = serialNum;
          }
        }
      });
    }
    const nextSerial = Math.max(maxSerial, totalUsers) + 1;
    return `BNB${String(nextSerial).padStart(8, '0')}`;
  };

  const handleReconciliationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReconSuccess('');
    setReconError('');

    if (!reconUserUid) {
      setReconError('অনুগ্রহ করে একজন সমবায় সদস্য নির্বাচন করুন।');
      return;
    }

    const amt = Number(reconAmount);
    if (!reconAmount || isNaN(amt) || amt <= 0) {
      setReconError('সদস্য খতিয়ানের সঠিক টাকার পরিমাণ লিখুন।');
      return;
    }

    const targetUser = adminUsers.find(u => u.uid === reconUserUid);
    if (!targetUser) {
      setReconError('সদস্যকে ডাটাবেজে খুঁজে পাওয়া যায়নি।');
      return;
    }

    setAdminLoading(true);
    try {
      const userRef = doc(db, 'users', targetUser.uid);
      const txId = `tx-recon-${Date.now()}`;
      const recNo = `REC-RECON-${Math.floor(100000 + Math.random() * 900000)}`;
      
      let updatedSavings = targetUser.savings || 0;
      let updatedDueLoan = targetUser.dueLoan || 0;
      let updatedBalance = targetUser.balance || 0;
      let updatedDpsBalance = targetUser.dpsBalance !== undefined ? targetUser.dpsBalance : 0;
      let updatedProfitsBalance = targetUser.profitsBalance !== undefined ? targetUser.profitsBalance : 0;

      let typeLabel = '';
      let type: any = 'fee_payment';
      let description = '';

      if (reconAction === 'add_savings') {
        updatedSavings += amt;
        type = 'deposit';
        typeLabel = 'সঞ্চয়ী আমানত জমা';
        description = `অফিস ম্যানুয়ালি বা সমন্বয়ের মাধ্যমে কো-অপারেティブ সঞ্চয় ফান্ডে ৳${amt.toLocaleString('bn-BD')} টাকা নগদ জমা করেছেন।`;
      } else if (reconAction === 'reduce_savings') {
        updatedSavings = Math.max(0, updatedSavings - amt);
        type = 'withdraw';
        typeLabel = 'সঞ্চয়ী আমানত উত্তোলন';
        description = `অফিস ম্যানুয়ালি কো-অপারেティブ সঞ্চয় ফান্ড থেকে ৳${amt.toLocaleString('bn-BD')} টাকা বিয়োগ বা সমন্বয় করেছেন।`;
      } else if (reconAction === 'add_dps') {
        updatedDpsBalance += amt;
        type = 'deposit';
        typeLabel = 'ডিপিএস আমানত জমা';
        description = `অফিস ম্যানুয়ালি বা জমার মাধ্যমে সদস্যের ডিপিএস ফান্ডে ৳${amt.toLocaleString('bn-BD')} টাকা জমা রেকর্ড করেছেন।`;
      } else if (reconAction === 'reduce_dps') {
        updatedDpsBalance = Math.max(0, updatedDpsBalance - amt);
        type = 'withdraw';
        typeLabel = 'ডিপিএস আমানত সমন্বয়';
        description = `অফিস ম্যানুয়ালি বা সমন্বয়ের মাধ্যমে সদস্যের ডিপিএস ফান্ড থেকে ৳${amt.toLocaleString('bn-BD')} টাকা বিয়োগ বা সমন্বয় করেছেন।`;
      } else if (reconAction === 'add_profits') {
        updatedProfitsBalance += amt;
        type = 'interest';
        typeLabel = 'সমিতি লভ্যাংশ বণ্টন';
        description = `সমিতি লভ্যাংশ বণ্টন বাবদ সদস্যের অর্জিত লভ্যাংশ খতিয়ানে ৳${amt.toLocaleString('bn-BD')} টাকা ক্রেডিট করা হয়েছে।`;
      } else if (reconAction === 'reduce_profits') {
        updatedProfitsBalance = Math.max(0, updatedProfitsBalance - amt);
        type = 'withdraw';
        typeLabel = 'সমিতি লভ্যাংশ উত্তোলন';
        description = `সদস্যের অর্জিত লভ্যাংশ খতিয়ান হতে ৳${amt.toLocaleString('bn-BD')} টাকা উত্তোলন বা সমন্বয় রেকর্ড করা হয়েছে।`;
      } else if (reconAction === 'disburse_loan') {
        updatedBalance += amt;
        updatedDueLoan += amt;
        type = 'loan_disbursment';
        typeLabel = 'কো-অপারেটিভ ঋণ প্রদান';
        description = `অফিস আপনার কো-অপারেটিভ ঋণ বাবদ ৳${amt.toLocaleString('bn-BD')} টাকা ওয়ালেট ব্যালেন্সে ক্রেডিট এবং ঋণের খাতায় চার্জ করেছে।`;
      } else if (reconAction === 'repay_loan_cash') {
        updatedDueLoan = Math.max(0, updatedDueLoan - amt);
        type = 'loan_repayment';
        typeLabel = 'কো-অপারেটিভ ঋণ নগদ পরিশোধ';
        description = `অফিস আপনার কো-অপারেটিভ ঋণের বিপরীতে ৳${amt.toLocaleString('bn-BD')} টাকা নগদ পরিশোধ বা সমন্বয় রেকর্ড করেছে।`;
      }

      await updateDoc(userRef, {
        balance: updatedBalance,
        savings: updatedSavings,
        dueLoan: updatedDueLoan,
        dpsBalance: updatedDpsBalance,
        profitsBalance: updatedProfitsBalance
      });

      const newTx: Transaction = {
        id: txId,
        userId: targetUser.uid,
        userName: targetUser.name || '',
        memberId: targetUser.memberId || '',
        type,
        typeLabel,
        amount: amt,
        status: 'success',
        description,
        createdAt: new Date().toISOString(),
        paymentMethod: 'Cash Entry / Manual Adj.',
        receiptNo: recNo
      };

      await addDoc(collection(db, 'transactions'), newTx);

      const notifyId = `notif-${Date.now()}`;
      await addDoc(collection(db, 'user_notifications'), {
        id: notifyId,
        userId: targetUser.uid,
        title: `✍️ ব্যালেন্স সমন্বয়: ${typeLabel}`,
        body: description,
        read: false,
        isPersonal: true,
        category: 'samity',
        createdAt: new Date().toISOString()
      });

      setReconSuccess('সদস্য খতিয়ান সমন্বয় সম্পন্ন হয়েছে!');
      setReconAmount('');
      setReconNotes('');
    } catch (err: any) {
      setReconError('সমন্বয় করতে সমস্যা হয়েছে: ' + err.message);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleApproveTransaction = async (tx: Transaction) => {
    requestConfirm(
      'অনুমোদন নিশ্চিতকরণ',
      `আপনি কি নিশ্চিত যে ${tx.userName} (আইডি: ${tx.memberId}) এর করা এই আবেদনটি (${tx.typeLabel} - ৳${tx.amount.toLocaleString('bn-BD')}) অনুমোদন করতে চান?`,
      async () => {
        setAdminLoading(true);
        try {
          const targetUserRef = doc(db, 'users', tx.userId);
          const targetUserSnap = await getDoc(targetUserRef);
          if (!targetUserSnap.exists()) {
            customAlertFn('সদস্য ডাটাবেসে পাওয়া যায়নি!');
            return;
          }
          const userToModify = { uid: targetUserSnap.id, ...targetUserSnap.data() } as User;

          let updatedBalance = userToModify.balance || 0;
          let updatedSavings = userToModify.savings || 0;
          let updatedDueLoan = userToModify.dueLoan || 0;

          if (tx.type === 'deposit' || tx.type === 'add_money') {
            updatedBalance += tx.amount;
          } else if (tx.type === 'coop_savings_deposit') {
            updatedSavings += tx.amount;
          } else if (tx.type === 'loan_repayment') {
            updatedDueLoan = Math.max(0, updatedDueLoan - tx.amount);
            if (!tx.paymentMethod && updatedBalance >= tx.amount) {
              updatedBalance = Math.max(0, updatedBalance - tx.amount);
            }
          } else if (tx.type === 'coop_loan_apply') {
            updatedBalance += tx.amount;
            updatedDueLoan += tx.amount;
          } else if (tx.type === 'withdraw') {
            updatedSavings = Math.max(0, updatedSavings - tx.amount);
            updatedBalance += tx.amount;
          }

          await updateDoc(targetUserRef, {
            balance: updatedBalance,
            savings: updatedSavings,
            dueLoan: updatedDueLoan
          });

          const realDocId = tx.docId || tx.id;
          const txRef = doc(db, 'transactions', realDocId);
          await updateDoc(txRef, {
            status: 'approved',
            processedAt: new Date().toISOString()
          });

          const notifyId = `notif-${Date.now()}`;
          await addDoc(collection(db, 'user_notifications'), {
            id: notifyId,
            userId: tx.userId,
            title: "✅ আবেদন অনুমোদিত",
            body: `আপনার ${tx.typeLabel} (৳${tx.amount.toLocaleString('bn-BD')}) এর আবেদনটি অ্যাডমিন কর্তৃক অনুমোদন করা হয়েছে।`,
            read: false,
            isPersonal: true,
            category: 'samity',
            createdAt: new Date().toISOString()
          });

          customAlertFn('আবেদনটি সফলভাবে অনুমোদন করা হয়েছে।');
        } catch (err: any) {
          customAlertFn('অনুমোদন করতে সমস্যা হয়েছে: ' + err.message);
        } finally {
          setAdminLoading(false);
        }
      }
    );
  };

  const handleRejectTransaction = async (txId: string) => {
    requestPrompt(
      'বাতিলকরণ কারণ',
      'আবেদনটি বাতিল করার নির্দিষ্ট কারণ বা নোটিশ লিখুন (ঐচ্ছিক):',
      '',
      async (rejectReasonText) => {
        requestConfirm(
          'বাতিল নিশ্চিতকরণ',
          'আপনি কি নিশ্চিত যে আবেদনটি বাতিল করতে চান?',
          async () => {
            setAdminLoading(true);
            try {
              const txDoc = adminTransactions.find(t => t.id === txId || t.docId === txId);
              const realDocId = txDoc?.docId || txId;
              const txRef = doc(db, 'transactions', realDocId);

              await updateDoc(txRef, {
                status: 'rejected',
                rejectReason: rejectReasonText || '',
                processedAt: new Date().toISOString()
              });

              if (txDoc) {
                const notifyId = `notif-${Date.now()}`;
                await addDoc(collection(db, 'user_notifications'), {
                  id: notifyId,
                  userId: txDoc.userId,
                  title: '❌ লেনদেন বাতিল',
                  body: `আপনার ${txDoc.typeLabel} আবেদনটি বাতিল করা হয়েছে। কারণ: ${rejectReasonText || 'উল্লেখ নেই'}`,
                  read: false,
                  isPersonal: true,
                  category: 'samity',
                  createdAt: new Date().toISOString()
                });
              }

              customAlertFn('আবেদনটি বাতিল করা হয়েছে।');
            } catch (err: any) {
              customAlertFn('বাতিল করতে সমস্যা হয়েছে: ' + err.message);
            } finally {
              setAdminLoading(false);
            }
          }
        );
      }
    );
  };

  const handleApproveSamityMember = async (targetUser: User) => {
    try {
      const userRef = doc(db, 'users', targetUser.uid);
      const mId = targetUser.memberId || autoGenerateMemberId();
      await updateDoc(userRef, {
        memberId: mId,
        samityStatus: 'approved'
      });

      try {
        await updateDoc(doc(db, 'samity_applications', targetUser.uid), {
          status: 'approved',
          samityStatus: 'approved',
          approvedAt: new Date().toISOString()
        });
      } catch (e) {
        // ignore if doc missing
      }

      await addDoc(collection(db, 'user_notifications'), {
        userId: targetUser.uid,
        title: '🎉 সমবায় সদস্যপদ অনুমোদিত!',
        message: `অভিনন্দন ${targetUser.name}! আপনার সমবায় সমিতির সদস্যপদ আবেদনটি অনুমোদিত হয়েছে। আপনার মেম্বার আইডি: ${mId}।`,
        type: 'samity_approved',
        read: false,
        createdAt: new Date().toISOString()
      });

      customAlertFn(`সদস্য "${targetUser.name}" এর সদস্যতা অনুমোদন করা হয়েছে। মেম্বার আইডি: ${mId}`);
    } catch (err: any) {
      customAlertFn("অনুমোদন দিতে সমস্যা হয়েছে: " + err.message);
    }
  };

  const handleRejectSamityMember = async (targetUser: User) => {
    requestConfirm(
      'বাতিল নিশ্চিতকরণ',
      `আপনি কি নিশ্চিত যে সদস্য "${targetUser.name}" এর আবেদনটি বাতিল করতে চান?`,
      async () => {
        try {
          const userRef = doc(db, 'users', targetUser.uid);
          await updateDoc(userRef, {
            samityStatus: 'rejected'
          });

          try {
            await updateDoc(doc(db, 'samity_applications', targetUser.uid), {
              status: 'rejected',
              samityStatus: 'rejected',
              rejectedAt: new Date().toISOString()
            });
          } catch (e) {
            // ignore
          }

          await addDoc(collection(db, 'user_notifications'), {
            userId: targetUser.uid,
            title: '⚠️ সমবায় সদস্যপদ আবেদন সংক্রান্ত বার্তা',
            message: `সম্মানিত ${targetUser.name}, আপনার সমবায় সমিতির সদস্যপদ আবেদনটি বর্তমানে মঞ্জুর করা সম্ভব হয়নি। অনুগ্রহ করে বিস্তারিত জানতে এডমিন সাপোর্ট টিমে যোগাযোগ করুন।`,
            type: 'samity_rejected',
            read: false,
            createdAt: new Date().toISOString()
          });

          customAlertFn("আবেদনটি বাতিল করা হয়েছে।");
        } catch (err: any) {
          customAlertFn("বাতিল করতে সমস্যা হয়েছে: " + err.message);
        }
      }
    );
  };

  useEffect(() => {
    if (!searchTerm.trim()) {
      setDbSearchResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setIsSearchingDb(true);
      try {
        const qText = searchTerm.trim().toLowerCase();
        
        // Query users by phone and memberId directly on Firebase for ultra-fast index matching
        const phoneQuery = query(collection(db, 'users'), where('phone', '==', qText));
        const memberIdQuery = query(collection(db, 'users'), where('memberId', '==', qText));
        
        const [phoneSnap, memberIdSnap] = await Promise.all([
          getDocs(phoneQuery),
          getDocs(memberIdQuery)
        ]);
        
        const results: User[] = [];
        phoneSnap.forEach(doc => {
          results.push({ uid: doc.id, ...doc.data() } as User);
        });
        memberIdSnap.forEach(doc => {
          if (!results.some(r => r.uid === doc.id)) {
            results.push({ uid: doc.id, ...doc.data() } as User);
          }
        });

        // Also check if any local preloaded users match
        allUsers.forEach(u => {
          if (
            (u.name || '').toLowerCase().includes(qText) ||
            (u.memberId || '').toLowerCase().includes(qText) ||
            (u.phone || '').includes(qText)
          ) {
            if (!results.some(r => r.uid === u.uid)) {
              results.push(u);
            }
          }
        });

        setDbSearchResults(results.slice(0, 50));
      } catch (err) {
        console.error("Error searching members in DB:", err);
      } finally {
        setIsSearchingDb(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, allUsers]);

  const defaultSamitySlides = [
    {
      id: 1,
      tag: "সঞ্চয় কিস্তি",
      title: "নিয়মিত সঞ্চয় ডিপিএস",
      description: "প্রতি মাসে ছোট সঞ্চয়ে গড়ে তুলুন আপনার নিশ্চিত ভবিষ্যৎ কল্যাণ তহবিল।",
      bgGradient: "from-slate-950 via-teal-950 to-emerald-950",
      image: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=80&w=650"
    },
    {
      id: 2,
      tag: "হালাল লভ্যাংশ",
      title: "শতভাগ হালাল ব্যবসা পার্টনার",
      description: "আপনার ডিপোজিটকৃত পুঁজি দিয়ে সরাসরি লাভজনক ব্যবসায় অংশ নিন এবং হালাল মুনাফা অর্জন করুন।",
      bgGradient: "from-emerald-950 via-emerald-900 to-teal-950",
      image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=650"
    },
    {
      id: 3,
      tag: "ইনভেস্টর সহায়তা",
      title: "সহজ শর্তে সুদমুক্ত ঋণ",
      description: "আমাদের সম্মানিত সহযোগী সদস্যদের জন্য জরুরী প্রয়োজনে করযে হাসানা ঋণ সুবিধা গ্রহণ করুন।",
      bgGradient: "from-teal-950 via-slate-900 to-zinc-950",
      image: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&q=80&w=650"
    }
  ];

  const samitySlides = appConfig?.samityBanners && appConfig.samityBanners.length > 0
    ? appConfig.samityBanners
    : defaultSamitySlides;

  useEffect(() => {
    if (samitySlides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % samitySlides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [samitySlides.length]);

  // Form states - New Deposit
  const [depositPurpose, setDepositPurpose] = useState<'savings' | 'loan' | 'fees'>('savings');
  const [depositChannel, setDepositChannel] = useState('bKash');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositSender, setDepositSender] = useState(user.phone || '');
  const [depositTxId, setDepositTxId] = useState('');
  const [depositPin, setDepositPin] = useState('');

  // Form states - Savings Withdrawal
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawChannel, setWithdrawChannel] = useState('bKash');
  const [withdrawSender, setWithdrawSender] = useState(user.phone || '');
  const [withdrawPin, setWithdrawPin] = useState('');

  // Form states - Co-op Loan Application
  const [loanApplyAmount, setLoanApplyAmount] = useState('');
  const [loanApplyPurpose, setLoanApplyPurpose] = useState('');
  const [loanApplyPin, setLoanApplyPin] = useState('');

  // Success / Error triggers
  const [actionLoading, setActionLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // States for new features
  // 1. Monthly Investment states
  const [selectedInvestmentAmount, setSelectedInvestmentAmount] = useState<number>(user.monthlySavingsTarget || 1000);
  const [simulatedDay, setSimulatedDay] = useState<number>(5); // Default is 5th (no penalty)
  const [samityPinPrompt, setSamityPinPrompt] = useState<'none' | 'close' | 'active' | 'pay_reactivate'>('none');
  const [samityPinInput, setSamityPinInput] = useState('');
  const [simulatedOverdueDays, setSimulatedOverdueDays] = useState<number>(0);
  
  // 2. Referral system states
  const [referrerCodeInput, setReferrerCodeInput] = useState<string>('');
  const [referralMessage, setReferralMessage] = useState<string>('');

  // 3. Share transfer states
  const [shareRecipientId, setShareRecipientId] = useState<string>('');
  const [shareRecipientName, setShareRecipientName] = useState<string>('');
  const [shareCountInput, setShareCountInput] = useState<string>('');
  const [sharePriceInput, setSharePriceInput] = useState<string>('');
  const [shareTransferPin, setShareTransferPin] = useState<string>('');
  const [shareTransfers, setShareTransfers] = useState<any[]>([]);
  const [loadingShareTransfers, setLoadingShareTransfers] = useState<boolean>(false);

  // Custom Savings deposit state variables
  const [customDepositAmount, setCustomDepositAmount] = useState<string>('');
  const [customDepositPin, setCustomDepositPin] = useState<string>('');

  // Fallbacks for dynamic DPS and profit balances
  const userDps = user.dpsBalance !== undefined ? user.dpsBalance : 0;
  const userProfits = user.profitsBalance !== undefined ? user.profitsBalance : 0;
  const userSavings = user.savings !== undefined ? user.savings : 0;
  
  // Compute dynamic stats from user transaction histories to prevent hardcoded leaks
  const currentMonthDeposits = userTxHistory
    .filter(tx => {
      if (tx.type !== 'coop_savings_deposit') return false;
      if (tx.status !== 'success' && tx.status !== 'approved') return false;
      if (!tx.createdAt) return false;
      const txDate = new Date(tx.createdAt);
      const now = new Date();
      return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);

  // Find the last successful deposit transaction to display in the "জমা" card
  const lastDepositTx = userTxHistory
    .filter(tx => {
      if (tx.type !== 'coop_savings_deposit') return false;
      return tx.status === 'success' || tx.status === 'approved';
    })
    .sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    })[0];

  const lastDepositAmount = lastDepositTx ? (lastDepositTx.amount || 0) : 0;

  const totalCoopBalance = userSavings + userDps + userProfits;

  const profitPercentage = userSavings > 0
    ? ((userProfits / userSavings) * 100).toFixed(1)
    : "0.0";

  const targetGoal = user.monthlySavingsTarget ? user.monthlySavingsTarget * 12 : 50000;
  const progressPercent = targetGoal > 0 ? Math.min(100, Math.round((userSavings / targetGoal) * 100)) : 0;
  const remainingTarget = Math.max(0, targetGoal - userSavings);

  // Clear states helper
  const resetFormState = () => {
    setFormError('');
    setFormSuccess('');
    setDepositAmount('');
    setDepositTxId('');
    setDepositPin('');
    setWithdrawAmount('');
    setWithdrawPin('');
    setLoanApplyAmount('');
    setLoanApplyPurpose('');
    setLoanApplyPin('');
  };

  // Fetch transactions logs specifically for cooperative receipts
  const fetchUserTransactions = async () => {
    setLoadingTx(true);
    try {
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const list: Transaction[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Transaction);
      });
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setUserTxHistory(list);
    } catch (e) {
      console.error("Error fetching co-op tx:", e);
    } finally {
      setLoadingTx(false);
    }
  };

  useEffect(() => {
    fetchUserTransactions();
  }, [user.uid, activeSubView]);

  // Handle co-op deposit submission
  const handleCoopDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const amt = Number(depositAmount);
    if (!depositAmount || isNaN(amt) || amt <= 0) {
      setFormError('দয়া করে সঠিক জমা টাকার পরিমাণ টাইপ করুন।');
      return;
    }

    if (user.balance < amt) {
      setFormError(`দুঃখিত! আপনার মেইন ব্যালেন্স পর্যাপ্ত নয়। আপনার বর্তমান মেইন ব্যালেন্স ৳${(user.balance || 0).toLocaleString('bn-BD')} BDT.`);
      return;
    }

    if (!depositPin || depositPin !== user.pin) {
      setFormError('ভুল ৪-ডিজিটের সিকিউরিটি পিন! আবার চেষ্টা করুন।');
      return;
    }

    setActionLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      
      let newBalance = user.balance - amt;
      let updateFields: Record<string, any> = { balance: newBalance };

      let typeLabel = '';
      let typeStr: Transaction['type'] = 'deposit';
      let descriptionStr = '';

      if (depositPurpose === 'savings') {
        updateFields.savings = (user.savings || 0) + amt;
        typeStr = 'deposit';
        typeLabel = 'সঞ্চয় আমানত জমা';
        descriptionStr = `মেইন ব্যালেন্স হতে ৳${amt.toLocaleString('bn-BD')} টাকা সরাসরি ইনভেস্টর সাধারণ সঞ্চয় তহবিলে স্থানান্তর করা হয়েছে।`;
      } else if (depositPurpose === 'loan') {
        updateFields.dueLoan = Math.max(0, (user.dueLoan || 0) - amt);
        typeStr = 'loan_repayment';
        typeLabel = 'সমিতি লোন কিস্তি পরিশোধ';
        descriptionStr = `মেইন ব্যালেন্স হতে ৳${amt.toLocaleString('bn-BD')} টাকা সরাসরি সমবায় ঋণের কিস্তি পরিশোধ করা হয়েছে।`;
      } else {
        typeStr = 'fee_payment';
        typeLabel = 'ভর্তি ফি ও সার্ভিস চার্জ';
        descriptionStr = `মেইন ব্যালেন্স হতে ৳${amt.toLocaleString('bn-BD')} টাকা সরাসরি ভর্তি ফি ও সার্ভিস চার্জ পরিশোধ করা হয়েছে।`;
      }

      // Update User Document
      await updateDoc(userRef, updateFields);

      // Create a Successful Transaction Log
      const newTx: Partial<Transaction> = {
        userId: user.uid,
        userName: user.name,
        memberId: user.memberId || user.phone,
        type: typeStr,
        typeLabel: typeLabel,
        amount: amt,
        status: 'success',
        paymentMethod: 'Main Balance',
        description: descriptionStr,
        createdAt: new Date().toISOString(),
        receiptNo: `REC-${Math.floor(100000 + Math.random() * 900000)}`
      };

      await addDoc(collection(db, 'transactions'), newTx);
      
      setFormSuccess(`আলহামদুলিল্লাহ! আপনার মেইন ব্যালেন্স হতে ৳${amt.toLocaleString('bn-BD')} টাকা সফলভাবে স্থানান্তরিত ও সচল করা হয়েছে।`);
      setTimeout(() => {
        setActiveSubView('main');
        resetFormState();
        syncLiveProfile();
      }, 3000);

    } catch (err: any) {
      setFormError('জমাপ্রদান সম্পন্ন করতে সমস্যা হয়েছেঃ ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle custom savings deposit submission
  const handleCustomSavingsSubmit = async (amountToDeposit: number, pin: string) => {
    setFormError('');
    setFormSuccess('');

    if (!amountToDeposit || isNaN(amountToDeposit) || amountToDeposit <= 0) {
      setFormError('দয়া করে সঠিক জমার পরিমাণ প্রদান করুন।');
      return;
    }

    if (user.balance < amountToDeposit) {
      setFormError(`দুঃখিত! আপনার মেইন ব্যালেন্স পর্যাপ্ত নয়। আপনার বর্তমান মেইন ব্যালেন্স ৳${(user.balance || 0).toLocaleString('bn-BD')} BDT.`);
      return;
    }

    if (!pin || pin !== user.pin) {
      setFormError('ভুল ৪-ডিজিটের সিকিউরিটি পিন! আবার চেষ্টা করুন।');
      return;
    }

    setActionLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      let newBalance = user.balance - amountToDeposit;
      let newDpsBalance = (user.dpsBalance || 0) + amountToDeposit;

      await updateDoc(userRef, {
        balance: newBalance,
        dpsBalance: newDpsBalance
      });

      const tx: Partial<Transaction> = {
        userId: user.uid,
        userName: user.name,
        memberId: user.memberId || user.phone,
        type: 'coop_savings_deposit',
        typeLabel: 'সঞ্চয় আমানত',
        amount: amountToDeposit,
        status: 'success',
        paymentMethod: 'Main Balance',
        description: `মেইন ব্যালেন্স হতে ৳${amountToDeposit.toLocaleString('bn-BD')} টাকা সাধারণ সঞ্চয় ওয়ালেটে স্থানান্তর করা হয়েছে।`,
        createdAt: new Date().toISOString(),
        receiptNo: `REC-${Math.floor(100000 + Math.random() * 900000)}`
      };

      await addDoc(collection(db, 'transactions'), tx);
      setFormSuccess(`আলহামদুলিল্লাহ! আপনার মেইন ব্যালেন্স হতে ৳${amountToDeposit.toLocaleString('bn-BD')} টাকা সফলভাবে আপনার সঞ্চয় তহবিলে জমা করা হয়েছে।`);
      
      // Reset inputs
      setCustomDepositAmount('');
      setCustomDepositPin('');
      
      setTimeout(() => {
        syncLiveProfile();
      }, 1500);
    } catch (err: any) {
      setFormError('সঞ্চয় সম্পন্ন করতে সমস্যা হয়েছেঃ ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle savings withdrawal request
  const handleSavingsWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const amt = Number(withdrawAmount);
    if (!withdrawAmount || isNaN(amt) || amt <= 0) {
      setFormError('দয়া করে স্থানান্তরের সঠিক পরিমাণ টাইপ করুন।');
      return;
    }

    if (amt > userSavings) {
      setFormError(`পর্যাপ্ত সঞ্চয় ব্যালেন্স নেই! আপনার বর্তমান সঞ্চয় আমানত ৳${userSavings.toLocaleString('bn-BD')} BDT।`);
      return;
    }

    if (!withdrawPin || withdrawPin !== user.pin) {
      setFormError('ভুল ৪-ডিজিটের সিকিউরিটি পিন! আবার চেষ্টা করুন।');
      return;
    }

    const now = new Date();
    const isDec25 = (now.getMonth() === 11 && now.getDate() === 25) || user.role === 'admin';

    if (!isDec25) {
      setFormError('🔒 সমবায় সমিতি সঞ্চয় নীতিমালা: সমবায় সমিতি থেকে সঞ্চয়কৃত আমানত কেবল প্রতিবছরের ২৫শে ডিসেম্বর উত্তোলন বা উত্তোলনের আবেদন করা যাবে এবং তা এডমিন প্যানেলের এপ্রুভ সাপেক্ষে পরিশোধ হবে। বছরের অন্য কোন তারিখে সমিতি সঞ্চয় উত্তোলন গ্রহণযোগ্য নয়।');
      return;
    }

    setActionLoading(true);
    try {
      const newTx: Partial<Transaction> = {
        userId: user.uid,
        userName: user.name,
        memberId: user.memberId || user.phone,
        type: 'withdraw',
        typeLabel: 'সমবায় সঞ্চয় উত্তোলন (২৫শে ডিসেম্বর)',
        amount: amt,
        status: 'pending',
        description: `সমবায় সমিতি সঞ্চয় আমানত হতে ৳${amt.toLocaleString('bn-BD')} টাকা উত্তোলনের আবেদন। এডমিন প্যানেলের অনুমোদনের পর মেইন ব্যালেন্সে জমা হবে।`,
        createdAt: new Date().toISOString(),
        receiptNo: `REC-WD-${Math.floor(100000 + Math.random() * 900000)}`
      };

      await addDoc(collection(db, 'transactions'), newTx);
      setFormSuccess('আপনার ২৫শে ডিসেম্বরের সমবায় সঞ্চয় উত্তোলনের আবেদনটি সফলভাবে জমা দেওয়া হয়েছে! অ্যাডমিন প্যানেল আবেদনটি যাচাই করে অনুমোদন করার পর টাকা আপনার মেইন ব্যালেন্সে জমা হবে।');
      setWithdrawAmount('');
      setWithdrawPin('');
      setTimeout(() => {
        setActiveSubView('main');
        syncLiveProfile();
      }, 3500);
    } catch (err: any) {
      setFormError('আবেদন জমা দিতে সমস্যা হয়েছেঃ ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle new cooperative loan application
  const handleLoanApplicationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const amt = Number(loanApplyAmount);
    if (!loanApplyAmount || isNaN(amt) || amt <= 0) {
      setFormError('দয়া করে ঋণের কাঙ্ক্ষিত পরিমাণ টাইপ করুন।');
      return;
    }

    if (amt > 50000) {
      setFormError('BNB ম্যানেজমেন্ট কোম্পানি ইনভেস্টর নীতি অনুযায়ী নতুন লোন সর্বোচ্চ ৫০,০০০ টাকার বেশি হওয়া সম্ভব নয়।');
      return;
    }

    if (!loanApplyPurpose.trim()) {
      setFormError('অনুগ্রহ করে লোন নেওয়ার স্পষ্ট ধরণ বা লক্ষ্য উল্লেখ করুন।');
      return;
    }

    if (!loanApplyPin || loanApplyPin !== user.pin) {
      setFormError('ভুল সিকিউরিটি পিন! লোন আবেদন বাতিল করা হয়েছে।');
      return;
    }

    setActionLoading(true);
    try {
      const newTx: Partial<Transaction> = {
        userId: user.uid,
        userName: user.name,
        memberId: user.memberId || user.phone,
        type: 'coop_loan_apply',
        typeLabel: 'সমিতি নতুন লোন আবেদন',
        amount: amt,
        status: 'pending',
        description: `সমবায় লোন আবেদনঃ ৳${amt.toLocaleString('bn-BD')} টাকা ঋণের রিকোয়েস্ট (कारणঃ ${loanApplyPurpose})`,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'transactions'), newTx);
      setFormSuccess('সফল! আপনার সমবায় লোন আবেদনটি যাচাইকরণ টেবিলে পাঠানো হয়েছে। অ্যাডমিন প্যানেল মিটিংয়ের ভিত্তিতে এটি মঞ্জুর বা বাতিল করবেন।');
      setTimeout(() => {
        setActiveSubView('main');
        resetFormState();
        syncLiveProfile();
      }, 3500);

    } catch (err: any) {
      setFormError('লোন এপ্লিকেশন প্রক্রিয়াকরণে সমস্যাঃ ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Effects and helper functions for new features
  useEffect(() => {
    if (!shareRecipientId) {
      setShareRecipientName('');
      return;
    }
    const found = allUsers.find(
      (u) => u.memberId === shareRecipientId.trim() || u.phone === shareRecipientId.trim()
    );
    if (found) {
      setShareRecipientName(found.name);
    } else {
      setShareRecipientName('');
    }
  }, [shareRecipientId, allUsers]);

  const fetchShareTransfers = async () => {
    setLoadingShareTransfers(true);
    try {
      const q = query(
        collection(db, 'share_transfers'),
        where('senderUid', '==', user.uid)
      );
      const q2 = query(
        collection(db, 'share_transfers'),
        where('receiverUid', '==', user.uid)
      );
      const [s1, s2] = await Promise.all([getDocs(q), getDocs(q2)]);
      const list: any[] = [];
      s1.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      s2.forEach(docSnap => {
        if (!list.some(item => item.id === docSnap.id)) {
          list.push({ id: docSnap.id, ...docSnap.data() });
        }
      });
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setShareTransfers(list);
    } catch (e) {
      console.error("Error fetching share transfers:", e);
    } finally {
      setLoadingShareTransfers(false);
    }
  };

  useEffect(() => {
    if (activeSubView === 'share_transfer') {
      fetchShareTransfers();
    }
  }, [activeSubView, user.uid]);

  const handleUpdateMonthlyInvestment = async () => {
    setFormError('');
    setFormSuccess('');
    
    if (selectedInvestmentAmount < 500 || selectedInvestmentAmount > 5000) {
      setFormError('বিনিযোগের পরিমাণ সর্বনিম্ন ৫০০ টাকা এবং সর্বোচ্চ ৫,০০০ টাকা হতে হবে।');
      return;
    }
    
    setActionLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        monthlySavingsTarget: selectedInvestmentAmount
      });
      setFormSuccess(`সফল! আপনার মাসিক সঞ্চয় লক্ষ্য ৳${selectedInvestmentAmount.toLocaleString('bn-BD')} BDT নির্ধারণ করা হয়েছে।`);
      syncLiveProfile();
    } catch (e: any) {
      setFormError('লক্ষ্য আপডেট করতে সমস্যা হয়েছে: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const getPenaltyAmount = (day: number): number => {
    const policy = appConfig?.samityPolicyConfig;
    if (policy?.pausePenaltyUntil15th) {
      const exemptionDay = policy.penaltyExemptionUntilDay || 15;
      if (day <= exemptionDay) {
        return 0;
      }
    }

    const customTiers = policy?.penaltyTiers;
    if (customTiers && customTiers.length > 0) {
      for (const tier of customTiers) {
        if (day >= tier.fromDay && day <= tier.toDay) {
          if (tier.isDaily) {
            const extraDays = day - tier.fromDay + 1;
            return (tier.fineAmount || 0) * extraDays;
          }
          return tier.fineAmount || 0;
        }
      }
    }
    if (day <= 9) return 0;
    if (day >= 10 && day <= 19) return 10;
    if (day >= 20 && day <= 29) return 20;
    if (day >= 30 && day <= 39) return 30;
    if (day === 40) return 80;
    return 80 + (day - 40) * 10;
  };

  const handleExecuteAutoDebit = async () => {
    setFormError('');
    setFormSuccess('');

    const targetAmt = user.monthlySavingsTarget || 1000;
    if (targetAmt < 500 || targetAmt > 5000) {
      setFormError('দয়া করে প্রথমে আপনার মাসিক বিনিয়োগ লক্ষ্য নির্ধারণ করুন (৫০০ - ৫,০০০ BDT)।');
      return;
    }

    // Determine penalty based on simulated date
    const penalty = getPenaltyAmount(simulatedDay);

    const totalNeeded = targetAmt + penalty;
    const hasEnoughBalance = user.balance >= totalNeeded;

    setActionLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      
      let balanceDeduction = 0;
      let savingsDeduction = 0;
      let newBalance = user.balance;
      let newSavings = user.savings || 0;
      let adjustmentDetails = '';

      if (hasEnoughBalance) {
        newBalance = user.balance - totalNeeded;
        newSavings = (user.savings || 0) + targetAmt;
        balanceDeduction = totalNeeded;
        adjustmentDetails = `আপনার মেইন ব্যালেন্স থেকে ৳${totalNeeded.toLocaleString('bn-BD')} কেটে নেওয়া হয়েছে।`;
      } else {
        const partialFromBalance = user.balance;
        const remainingToDeduct = totalNeeded - partialFromBalance;
        
        if ((user.savings || 0) + partialFromBalance < totalNeeded) {
          throw new Error(`দুঃখিত! আপনার মেইন ব্যালেন্স এবং পূর্বের জমানো সঞ্চয় মিলিয়েও প্রয়োজনীয় ৳${totalNeeded.toLocaleString('bn-BD')} (কিস্তি ৳${targetAmt} + জরিমানা ৳${penalty}) নেই। অনুগ্রহ করে প্রথমে ব্যালেন্স রিচার্জ করুন।`);
        }

        newBalance = 0;
        newSavings = (user.savings || 0) + targetAmt - remainingToDeduct;
        balanceDeduction = partialFromBalance;
        savingsDeduction = remainingToDeduct;
        
        adjustmentDetails = `মেইন ব্যালেন্স থেকে ৳${partialFromBalance.toLocaleString('bn-BD')} এবং পূর্বের জমাকৃত সঞ্চয় থেকে ৳${remainingToDeduct.toLocaleString('bn-BD')} সমন্বয় (Adjust) করা হয়েছে।`;
      }

      await updateDoc(userRef, {
        balance: newBalance,
        savings: newSavings,
        lastPaidMonth: "2026-06"
      });

      const dpsTx: Partial<Transaction> = {
        userId: user.uid,
        userName: user.name,
        memberId: user.memberId || user.phone,
        type: 'deposit',
        typeLabel: 'মাসিক সঞ্চয় ডিপিএস',
        amount: targetAmt,
        status: 'success',
        description: `মাসিক নিয়মিত ডিপিএস সঞ্চয় (তারিখ: ${simulatedDay} জুন)। ${adjustmentDetails}`,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'transactions'), dpsTx);

      if (penalty > 0) {
        const penaltyTx: Partial<Transaction> = {
          userId: user.uid,
          userName: user.name,
          memberId: user.memberId || user.phone,
          type: 'fee_payment',
          typeLabel: 'বিলম্ব জরিমানা',
          amount: penalty,
          status: 'success',
          description: `বিলম্ব পেমেন্টের জরিমানা (${simulatedDay} জুনের বিলম্ব পেমেন্ট বাবদ)`,
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'transactions'), penaltyTx);
      }

      setFormSuccess(`আলহামদুলিল্লাহ! আপনার জুন ২০২৬ মাসের সঞ্চয় সফলভাবে জমা হয়েছে। ${adjustmentDetails}`);
      syncLiveProfile();
    } catch (e: any) {
      setFormError(e.message || 'পেমেন্ট সম্পন্ন করা যায়নি।');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivateScheme = async () => {
    setFormError('');
    setFormSuccess('');
    if (!samityPinInput || samityPinInput !== user.pin) {
      setFormError('ভুল সিকিউরিটি পিন! আবার চেষ্টা করুন।');
      setSamityPinPrompt('none');
      setSamityPinInput('');
      return;
    }
    setActionLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        samitySchemeActive: false
      });
      
      await addDoc(collection(db, 'user_notifications'), {
        id: `notif-deact-${Date.now()}`,
        userId: user.uid,
        memberId: user.memberId || 'N/A',
        title: '🔴 মাসিক বিনিয়োগ সাময়িকভাবে বন্ধ করা হয়েছে',
        body: `আপনার মাসিক বিনিয়োগ স্কিমটি বন্ধ করা হয়েছে। নতুন মাসিক কিস্তি আর অটো-ডেবিট হবে না। ২৫শে ডিসেম্বরের পূর্বে আপনার সঞ্চিত টাকা উত্তোলন করতে পারবেন না।`,
        read: false,
        isPersonal: true,
        category: 'samity_msg',
        createdAt: new Date().toISOString()
      });

      setFormSuccess('সফল! আপনার মাসিক বিনিয়োগ স্কিমটি সাময়িকভাবে বন্ধ (Inactive) করা হয়েছে।');
      setSamityPinPrompt('none');
      setSamityPinInput('');
      syncLiveProfile();
    } catch (e: any) {
      setFormError('স্কিম বন্ধ করতে সমস্যা হয়েছে: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivateScheme = async () => {
    setFormError('');
    setFormSuccess('');
    if (!samityPinInput || samityPinInput !== user.pin) {
      setFormError('ভুল সিকিউরিটি পিন! আবার চেষ্টা করুন।');
      setSamityPinPrompt('none');
      setSamityPinInput('');
      return;
    }
    setActionLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        samitySchemeActive: true,
        dueMonths: 0
      });

      await addDoc(collection(db, 'user_notifications'), {
        id: `notif-act-${Date.now()}`,
        userId: user.uid,
        memberId: user.memberId || 'N/A',
        title: '🟢 মাসিক বিনিয়োগ স্কিম পুনরায় চালু করা হয়েছে',
        body: `আপনার কো-অপারেটিভ মাসিক বিনিয়োগ স্কিমটি সফলভাবে পুনরায় সচল করা হয়েছে। নিয়মিত কিস্তি অটো-ডেবিট আবার শুরু হবে।`,
        read: false,
        isPersonal: true,
        category: 'samity_msg',
        createdAt: new Date().toISOString()
      });

      setFormSuccess('আলহামদুলিল্লাহ! আপনার মাসিক বিনিয়োগ স্কিমটি পুনরায় সফলভাবে চালু (Active) করা হয়েছে।');
      setSamityPinPrompt('none');
      setSamityPinInput('');
      syncLiveProfile();
    } catch (e: any) {
      setFormError('স্কিম চালু করতে সমস্যা হয়েছে: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayArrearsAndReactivate = async () => {
    setFormError('');
    setFormSuccess('');
    if (!samityPinInput || samityPinInput !== user.pin) {
      setFormError('ভুল সিকিউরিটি পিন! আবার চেষ্টা করুন।');
      setSamityPinPrompt('none');
      setSamityPinInput('');
      return;
    }
    setActionLoading(true);
    try {
      const targetAmt = user.monthlySavingsTarget || 1000;
      const dueMonths = user.dueMonths || 1;
      const totalDueAmount = targetAmt * dueMonths;

      if (user.balance < totalDueAmount) {
        throw new Error(`বকেয়া কিস্তি পরিশোধ করার জন্য আপনার মেইন ব্যালেন্সে পর্যাপ্ত টাকা নেই। মোট প্রয়োজন ৳${totalDueAmount.toLocaleString('bn-BD')} BDT, কিন্তু আপনার মেইন ব্যালেন্স ৳${(user.balance || 0).toLocaleString('bn-BD')} BDT।`);
      }

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        balance: user.balance - totalDueAmount,
        savings: (user.savings || 0) + totalDueAmount,
        samitySchemeActive: true,
        dueMonths: 0
      });

      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        userName: user.name,
        memberId: user.memberId || user.phone,
        type: 'deposit',
        typeLabel: 'বকেয়া কিস্তি ও পুনঃসচলকরণ',
        amount: totalDueAmount,
        status: 'success',
        description: `মাসিক স্কিম পুনঃসচলকরণ কালে বকেয়া ${dueMonths} মাসের কিস্তি পরিশোধ করা হয়েছে।`,
        createdAt: new Date().toISOString()
      });

      await addDoc(collection(db, 'user_notifications'), {
        id: `notif-arrear-${Date.now()}`,
        userId: user.uid,
        memberId: user.memberId || 'N/A',
        title: '🟢 বকেয়া কিস্তি পরিশোধ ও স্কিম সচল সফল',
        body: `বকেয়া কিস্তি পরিশোধ করে আপনার কো-অপারেটিভ মাসিক বিনিয়োগ স্কিমটি পুনরায় সফলভাবে চালু করা হয়েছে।`,
        read: false,
        isPersonal: true,
        category: 'samity_msg',
        createdAt: new Date().toISOString()
      });

      setFormSuccess(`বকেয়া ৳${totalDueAmount.toLocaleString('bn-BD')} BDT পরিশোধপূর্বক আপনার স্কিম সফলভাবে পুনরায় সচল করা হয়েছে।`);
      setSamityPinPrompt('none');
      setSamityPinInput('');
      syncLiveProfile();
    } catch (e: any) {
      setFormError(e.message || 'বকেয়া পরিশোধ করা সম্ভব হয়নি।');
      setSamityPinPrompt('none');
      setSamityPinInput('');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetReferrer = async () => {
    setFormError('');
    setFormSuccess('');
    setReferralMessage('');

    if (!referrerCodeInput.trim()) {
      setFormError('দয়া করে রেফারেল কোড বা মোবাইল নম্বর প্রবেশ করুন।');
      return;
    }

    const refCode = referrerCodeInput.trim();
    const referrer = allUsers.find(
      u => u.memberId === refCode || u.phone === refCode
    );

    if (!referrer) {
      setFormError('দুঃখিত! এই রেফারেল কোড বা মোবাইল নম্বরের কোনো সদস্য খুঁজে পাওয়া যায়নি।');
      return;
    }

    if (referrer.uid === user.uid) {
      setFormError('আপনি নিজেকে রেফার করতে পারবেন না!');
      return;
    }

    setActionLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        referredBy: referrer.memberId
      });
      setFormSuccess(`সফল! আপনাকে ${referrer.name} (ID: ${referrer.memberId}) এর অধীনে সফলভাবে রেফার করা হয়েছে।`);
      syncLiveProfile();
    } catch (e: any) {
      setFormError('রেফারার সেট করতে সমস্যা হয়েছে: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleShareTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const count = parseInt(shareCountInput, 10);
    const price = parseInt(sharePriceInput, 10) || 0;
    const myShares = user.shares !== undefined ? user.shares : Math.max(1, Math.floor(user.savings / 1000));

    if (!shareRecipientId.trim()) {
      setFormError('গ্রহীতার মেম্বার আইডি বা মোবাইল নম্বর প্রবেশ করুন।');
      return;
    }

    const recipient = allUsers.find(
      u => u.memberId === shareRecipientId.trim() || u.phone === shareRecipientId.trim()
    );

    if (!recipient) {
      setFormError('দুঃখিত! গ্রহীতার কোনো অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।');
      return;
    }

    if (recipient.uid === user.uid) {
      setFormError('আপনি নিজের অ্যাকাউন্টে শেয়ার হস্তান্তর করতে পারবেন না!');
      return;
    }

    if (isNaN(count) || count <= 0) {
      setFormError('শেয়ার সংখ্যা অবশ্যই ১ বা তার বেশি হতে হবে।');
      return;
    }

    if (count > myShares) {
      setFormError(`দুঃখিত! আপনার কাছে পর্যাপ্ত শেয়ার নেই। আপনার মোট শেয়ার সংখ্যা: ${myShares}`);
      return;
    }

    if (shareTransferPin !== user.pin) {
      setFormError('ভুল ৪-ডিজিটের সিকিউরিটি পিন! দয়া করে সঠিক পিন দিন।');
      return;
    }

    setActionLoading(true);
    try {
      const newTransfer = {
        senderUid: user.uid,
        senderName: user.name,
        senderMemberId: user.memberId || user.phone,
        receiverUid: recipient.uid,
        receiverName: recipient.name,
        receiverMemberId: recipient.memberId || recipient.phone,
        sharesCount: count,
        pricePerShare: price,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'share_transfers'), newTransfer);
      setFormSuccess('সফল! আপনার শেয়ার হস্তান্তর আবেদনটি সফলভাবে সাবমিট করা হয়েছে। এডমিন প্যানেলের অনুমোদনের পর শেয়ার স্থানান্তর কার্যকর হবে।');
      
      setShareCountInput('');
      setSharePriceInput('');
      setShareRecipientId('');
      setShareTransferPin('');
      
      fetchShareTransfers();
    } catch (err: any) {
      setFormError('শেয়ার হস্তান্তর প্রক্রিয়া করা যায়নি: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Filter members list based on query or Firestore-backed debounce search results
  const filteredUsers = searchTerm.trim() ? dbSearchResults : allUsers;

  // Dynamic values computation specifically for Samity investors, Samity deposits, and Samity profits
  const membersToUse = liveDbUsers.length > 0 ? liveDbUsers : (allUsers.length > 0 ? allUsers : [user]);

  // Unified helper matching Admin Panel Samity user definition
  const isSamityMemberUser = (u: any) => Boolean(
    u.samityApproved === true ||
    u.samityStatus === 'approved' ||
    u.samitySchemeActive === true ||
    u.samityAutoSavingsActive === true ||
    u.isSamityMember === true ||
    (Number(u.savings) || 0) > 0 ||
    (Number(u.dpsBalance) || 0) > 0 ||
    (Number(u.shares) || 0) > 0 ||
    (Number(u.monthlySavingsTarget) || 0) > 0
  );

  // Filter members who are registered / enrolled in Samity
  const samityMembersList = membersToUse.filter(isSamityMemberUser);

  // Real Samity member count (fallback to membersToUse if filter hasn't flagged users yet)
  const activeMembersNum = samityMembersList.length > 0 ? samityMembersList.length : membersToUse.length;

  // Calculated deposits in Samity across members (savings + dpsBalance ONLY - main balance excluded)
  const calculatedDeposits = membersToUse.reduce((sum, u) => {
    const isSelf = u.uid === user.uid;
    const s = isSelf ? Math.max(Number(u.savings) || 0, Number(user.savings) || 0) : (Number(u.savings) || 0);
    const d = isSelf ? Math.max(Number(u.dpsBalance) || 0, Number(user.dpsBalance) || 0) : (Number(u.dpsBalance) || 0);
    return sum + s + d;
  }, 0);

  // Sync with manual override from Admin Panel appConfig if set
  const manualFundVal = appConfig?.manualFundAdjustments?.['samity_fund'];
  const totalCompanyDeposits = (manualFundVal !== undefined && manualFundVal !== null && typeof manualFundVal === 'number' && !isNaN(manualFundVal))
    ? manualFundVal
    : calculatedDeposits;

  // Real total profits generated/distributed in Samity across all members (profitsBalance)
  const totalCompanyProfits = membersToUse.reduce((sum, u) => {
    return sum + (Number(u.profitsBalance) || 0);
  }, 0);

  // Render format helpers
  const renderBalanceValue = (val: number) => {
    if (!showBalance) return '••••••';
    return `৳ ${val.toLocaleString('bn-BD')}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col relative" id="samity-screen-root">
      
      {/* 1. Header (১. হেডার) styled absolutely matching the forest-green app header */}
      <header className="bg-gradient-to-r from-teal-700 via-teal-800 to-emerald-800 text-white px-4 py-4 rounded-b-3xl shadow-lg relative overflow-hidden z-20">
        {/* Decorative subtle header glows */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-emerald-500/15 rounded-full blur-2xl" />

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                if (activeSubView !== 'main' || bottomTab !== 'home') {
                  window.history.back();
                } else {
                  onBack();
                }
              }}
              className="p-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-white transition active:scale-95"
            >
              {activeSubView !== 'main' || bottomTab !== 'home' ? (
                <ChevronLeft className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
            
            <div className="flex items-center gap-2.5">
              {/* Profile Image with high-contrast borders */}
              <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white/80 overflow-hidden shadow-xs relative flex items-center justify-center shrink-0">
                {user.profilePic ? (
                  user.profilePic.startsWith('http') || user.profilePic.startsWith('data:image/') ? (
                    <img src={user.profilePic} referrerPolicy="no-referrer" alt="User Profile" className="w-full h-full object-cover rounded-full" />
                  ) : (() => {
                    const PRESET_AVATARS = [
                      { id: 'av1', emoji: '👨‍💼', bg: 'bg-indigo-50 text-indigo-700' },
                      { id: 'av2', emoji: '👩‍💼', bg: 'bg-rose-50 text-rose-700' },
                      { id: 'av3', emoji: '👨‍💻', bg: 'bg-teal-50 text-teal-700' },
                      { id: 'av4', emoji: '🧑‍🌾', bg: 'bg-amber-50 text-amber-700' },
                      { id: 'av5', emoji: '👩‍🏫', bg: 'bg-emerald-50 text-emerald-700' },
                      { id: 'av6', emoji: '✨', bg: 'bg-cyan-50 text-cyan-700' },
                    ];
                    const activeAv = PRESET_AVATARS.find(av => av.id === user.profilePic) || PRESET_AVATARS[2];
                    return (
                      <div className={`w-full h-full rounded-full flex items-center justify-center text-xl ${activeAv.bg}`}>
                        {activeAv.emoji}
                      </div>
                    );
                  })()
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-teal-900 text-white text-xs font-black rounded-full">
                    {user.name ? user.name.slice(0, 1) : "ম"}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-[13px] font-black tracking-tight leading-tight flex items-center gap-1.5 font-sans">
                  {user.name || "মোঃ রহিম"}
                </h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[9.5px] text-teal-100 font-bold block">
                    সদস্য আইডি: {user.memberId || "BNB00005327"}
                  </span>
                  
                  {/* Status badge: 'সক্রিয়' in vivid green */}
                  <span className="text-[8.5px] bg-emerald-500/20 text-emerald-300 font-extrabold px-1.5 py-0.2 rounded-md uppercase border border-emerald-500/30 flex items-center gap-0.5 shadow-2xs">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                    সক্রিয়
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div 
              onClick={() => {
                syncLiveProfile();
                fetchUserTransactions();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full transition cursor-pointer select-none text-left shrink-0"
              title="মেইন ব্যালেন্স রিফ্রেশ করতে ট্যাপ করুন"
            >
              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-sans font-black shrink-0">৳</span>
              <div className="flex flex-col leading-none">
                <span className="text-[7.5px] uppercase tracking-wider text-teal-100 font-extrabold">মেইন ব্যালেন্স</span>
                <span className="text-[11px] font-bold font-mono text-white mt-0.5">
                  ৳{(user.balance || 0).toLocaleString('bn-BD')}
                </span>
              </div>
            </div>
            
            <button 
              onClick={() => {
                fetchUserTransactions();
                setShowSectionTxHistory(true);
              }}
              className="p-2 bg-white/15 hover:bg-white/25 text-teal-100 rounded-xl flex items-center gap-1 cursor-pointer active:scale-95"
              title="ইনভেস্টর লেনদেন খতিয়ান"
            >
              <ClipboardList className="w-4 h-4 text-white" />
              <span className="text-[10px] text-white font-extrabold hidden xs:inline">খতিয়ান</span>
            </button>

            <button 
              type="button"
              onClick={() => {
                setBottomTab('messages');
                setActiveSubView('main');
                markAllSamityNoticesAsRead();
              }}
              className={`p-2 rounded-xl relative cursor-pointer active:scale-95 transition-all flex items-center justify-center ${
                hasUnreadSamity
                  ? 'bg-rose-500 text-white shadow-md animate-pulse ring-2 ring-rose-300'
                  : 'bg-white/15 hover:bg-white/25 text-teal-100 hover:text-white'
              }`}
              title={hasUnreadSamity ? `${unreadSamityCount}টি অপঠিত নোটিশ` : 'নোটিশ বোর্ড (সকল পঠিত)'}
            >
              <Bell className={`w-4 h-4 ${hasUnreadSamity ? 'text-white' : 'text-teal-100'}`} />
              {hasUnreadSamity && (
                <span className="absolute -top-1 -right-1 bg-amber-400 text-rose-950 font-black text-[9px] min-w-[18px] h-4 px-1 rounded-full flex items-center justify-center border-2 border-emerald-900 shadow-sm font-mono leading-none">
                  {unreadSamityCount > 9 ? '9+' : unreadSamityCount}
                </span>
              )}
            </button>

            {(user.role === 'admin' || user.role === 'sub_admin') && (
              <button 
                onClick={() => {
                  if (activeSubView === 'admin') {
                    setActiveSubView('main');
                  } else {
                    setActiveSubView('admin');
                  }
                }}
                className={`p-2 rounded-xl flex items-center gap-1 cursor-pointer active:scale-95 transition-all ${
                  activeSubView === 'admin' 
                    ? 'bg-rose-500 text-white font-black' 
                    : 'bg-amber-500 hover:bg-amber-600 text-white font-extrabold shadow-md'
                }`}
                title="সমবায় অ্যাডমিন প্যানেল"
              >
                <ShieldCheck className="w-4 h-4" />
                <span className="text-[10px] hidden xs:inline">অ্যাডমিন</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 w-full max-w-md mx-auto px-4 py-4 space-y-4 pb-6 overflow-y-auto">

        {/* ================= BOTTOM TAB: SYSTEM NOTICES & ANNOUNCEMENTS ================= */}
        {bottomTab === 'messages' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 text-left min-h-[500px] flex flex-col justify-between"
          >
            <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 space-y-4 shadow-sm flex-1 flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-3xs shrink-0">
                    <Bell className="w-5 h-5 animate-bounce" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest leading-none">BNB Notice Board</h3>
                    <p className="text-[9.5px] mt-1 text-indigo-600 font-bold block">লাইভ সমবায় নোটিশ ও সিস্টেম ঘোষণা বার্তাখানা</p>
                  </div>
                </div>

                {/* Quick Action Buttons: Mark All Read & Clear All */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={markAllSamityNoticesAsRead}
                    className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 rounded-xl text-[9.5px] font-black transition cursor-pointer active:scale-95"
                    title="সব পঠিত করুন"
                  >
                    ✓ পঠিত
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllNotices}
                    className="px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-[9.5px] font-black transition cursor-pointer active:scale-95 flex items-center gap-1"
                    title="সকল নোটিশ মুছুন"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>মুছুন</span>
                  </button>
                </div>
              </div>

              {/* Notification Filter Controls */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNoticeFilter('all')}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black transition cursor-pointer ${
                      noticeFilter === 'all'
                        ? 'bg-indigo-600 text-white shadow-3xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    সব সমবায় নোটিশ
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoticeFilter('samity')}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black transition cursor-pointer ${
                      noticeFilter === 'samity'
                        ? 'bg-teal-700 text-white shadow-3xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    কো-অপারেটিভ
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoticeFilter('general')}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black transition cursor-pointer ${
                      noticeFilter === 'general'
                        ? 'bg-rose-600 text-white shadow-3xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    সাধারণ ঘোষণা
                  </button>
                </div>

                <span className="text-[10px] font-bold text-slate-400">
                  মোট: {samityNotices.length} টি
                </span>
              </div>

              {/* Full height scrollable notices container (no rigid max-h constraint) */}
              <div className="space-y-3 pt-2 flex-1 overflow-y-auto pr-1 min-h-[350px]">
                {(() => {
                  const filteredNotices = samityNotices.filter(n => {
                    if (noticeFilter === 'all') return true;
                    if (noticeFilter === 'samity') return n.section === 'samity';
                    if (noticeFilter === 'general') return n.section === 'general' || !n.section;
                    return true;
                  });

                  if (filteredNotices.length === 0) {
                    return (
                      <div className="p-8 text-center bg-slate-50 border border-slate-150 rounded-2xl space-y-2 my-auto">
                        <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-xs font-bold text-slate-500">বর্তমানে কোনো নোটিশ বা ঘোষণা নেই।</p>
                      </div>
                    );
                  }

                  const formatNoticeDate = (dateStr?: string) => {
                    if (!dateStr) return '';
                    try {
                      const d = new Date(dateStr);
                      return d.toLocaleDateString('bn-BD', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      });
                    } catch (e) {
                      return dateStr;
                    }
                  };

                  return filteredNotices.map((n, idx) => {
                    const noticeId = n.id || n.docId;
                    const isRead = isSamityNoticeRead(n);

                    let sectionLabel = 'সাধারণ ঘোষণা';
                    let iconEmoji = '📢';

                    if (n.section === 'samity') {
                      sectionLabel = 'কো-অপারেটিভ সমবায়';
                      iconEmoji = '🌿';
                    }

                    return (
                      <div 
                        key={noticeId || Math.random().toString()} 
                        onClick={() => handleToggleReadNotice(noticeId)}
                        className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer text-left space-y-2 relative overflow-hidden active:scale-[0.99] ${
                          !isRead
                            ? 'bg-rose-50/90 border-2 border-rose-300 text-rose-950 shadow-xs ring-1 ring-rose-200/80'
                            : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300 shadow-3xs'
                        }`}
                      >
                        {/* Status bar accent */}
                        {!isRead && (
                          <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-rose-600 animate-pulse" />
                        )}

                        <div className="flex items-center justify-between gap-2 border-b border-black/10 pb-1.5 pl-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-black tracking-wide uppercase flex items-center gap-1">
                              <span>{iconEmoji}</span>
                              <span>{sectionLabel}</span>
                            </span>

                            {/* Status Tag: Red if Unread, Green/White if Read */}
                            {!isRead ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-600 text-white flex items-center gap-1 shadow-3xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                🔴 অপঠিত (টিপ দিন)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-0.5">
                                ✓ পঠিত
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-slate-500 font-bold font-mono">
                              {formatNoticeDate(n.createdAt)}
                            </span>

                            {/* Delete single notice button */}
                            <button
                              type="button"
                              onClick={(e) => handleDeleteNotice(noticeId, e)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-100/80 rounded-lg transition-colors cursor-pointer shrink-0"
                              title="নোটিশ ডিলিট করুন"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <h4 className={`text-xs sm:text-sm tracking-tight leading-snug pl-1 ${
                          !isRead ? 'font-black text-rose-950' : 'font-extrabold text-slate-900'
                        }`}>
                          {n.title}
                        </h4>

                        <p className="text-[11px] leading-relaxed font-semibold opacity-90 whitespace-pre-line pl-1">
                          {n.content || n.message || n.body}
                        </p>

                        <div className="pt-1 flex justify-end pl-1">
                          <span className="text-[9.5px] font-black text-indigo-700 hover:underline">
                            {!isRead ? 'টিপ দিয়ে সিন করুন (সাদা করুন) →' : 'পঠিত স্থিতি'}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setBottomTab('home')}
              className="w-full bg-white border border-slate-200 py-3 rounded-2xl text-xs font-extrabold transition text-slate-700 hover:bg-slate-50 shadow-3xs cursor-pointer active:scale-98"
            >
              ড্যাশবোর্ডে ফিরে যান
            </button>
          </motion.div>
        )}

        {/* ================= BOTTOM TAB: INVESTMENT REPORTS ================= */}
        {bottomTab === 'report' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 text-left"
          >
            <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-3 pb-3 border-b border-indigo-150">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                  <LineChart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none">Investment Statement</h3>
                  <p className="text-[9.5px] mt-1 text-indigo-600 font-bold block">সদস্যের মাসিক সঞ্চয় রিপোর্ট ও লভ্যাংশ চার্ট</p>
                </div>
              </div>

              <div className="space-y-4 font-sans text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="block text-[9px] text-slate-400 font-extrabold leading-none mb-1 uppercase">টোটাল বিনিয়োগ</span>
                    <strong className="text-sm font-mono text-slate-800">৳ {userSavings.toLocaleString('bn-BD')}</strong>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="block text-[9px] text-slate-400 font-extrabold leading-none mb-1 uppercase">পরিশোধিত ডিপিএস</span>
                    <strong className="text-sm font-mono text-slate-800">৳ {userDps.toLocaleString('bn-BD')}</strong>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-4.5 space-y-2.5">
                  <h4 className="font-extrabold text-[12px] text-teal-800">📈 আমার ঐতিহাসিক রিটার্ন পারফরম্যান্সঃ</h4>
                  <p className="text-[10.5px] text-slate-650 leading-relaxed font-bold">
                    আপনার মোট সঞ্চয় এবং চলমান ডিপিএস ও লভ্যাংশের বণ্টন হার চমৎকারভাবে ১% সাপ্তাহিক গড়ের উপর সচল রয়েছে। নির্ধারিত সময়ের ১ মাসের মধ্যে ঋণের সব কিস্তি পরিশোধ করলে ক্রেডিট স্কোর স্বয়ংক্রিয় উন্নত হবে।
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setBottomTab('home')}
              className="w-full bg-white border border-slate-200 py-3 rounded-2xl text-xs font-extrabold transition text-slate-705 shadow-3xs"
            >
              ড্যাশবোর্ডে ফিরে যান
            </button>
          </motion.div>
        )}

        {/* ================= BOTTOM TAB: USER PROFILE VIEW ================= */}
        {bottomTab === 'profile' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 text-left"
          >
            <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm text-center">
              <div className="w-16 h-16 rounded-full bg-teal-100 mx-auto border-2 border-teal-600 overflow-hidden shadow-xs flex items-center justify-center text-teal-700 text-lg font-black relative shrink-0">
                {user.profilePic ? (
                  user.profilePic.startsWith('http') || user.profilePic.startsWith('data:image/') ? (
                    <img src={user.profilePic} alt="Me" className="w-full h-full object-cover rounded-full" />
                  ) : (() => {
                    const PRESET_AVATARS = [
                      { id: 'av1', emoji: '👨‍💼', bg: 'bg-indigo-50 text-indigo-700' },
                      { id: 'av2', emoji: '👩‍💼', bg: 'bg-rose-50 text-rose-700' },
                      { id: 'av3', emoji: '👨‍💻', bg: 'bg-teal-50 text-teal-700' },
                      { id: 'av4', emoji: '🧑‍🌾', bg: 'bg-amber-50 text-amber-700' },
                      { id: 'av5', emoji: '👩‍🏫', bg: 'bg-emerald-50 text-emerald-700' },
                      { id: 'av6', emoji: '✨', bg: 'bg-cyan-50 text-cyan-700' },
                    ];
                    const activeAv = PRESET_AVATARS.find(av => av.id === user.profilePic) || PRESET_AVATARS[2];
                    return (
                      <div className={`w-full h-full rounded-full flex items-center justify-center text-3xl ${activeAv.bg}`}>
                        {activeAv.emoji}
                      </div>
                    );
                  })()
                ) : (
                  user.name ? user.name.slice(0, 1) : "ম"
                )}
              </div>

              <div className="space-y-1">
                <h3 className="font-sans font-black text-slate-800 text-base">{user.name || "মোঃ রহিম"}</h3>
                <p className="text-xs text-slate-400 font-mono font-bold leading-none">সহযোগী আইডিঃ {user.memberId || "BNB00005327"}</p>
                <span className="inline-block mt-1.5 text-[8.5px] bg-emerald-50 text-emerald-700 font-black border border-emerald-100 px-3 py-0.5 rounded-full uppercase">সমবায় সদস্য সচল</span>
              </div>

              <div className="border-t border-slate-100 pt-4 text-left space-y-2.5 text-xs font-sans">
                <div className="flex justify-between items-center bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 font-bold">মোবাইল নাম্বারঃ</span>
                  <strong className="text-slate-700 font-mono">{user.phone}</strong>
                </div>
                <div className="flex justify-between items-center bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 font-bold">সদস্য গ্রুপঃ</span>
                  <strong className="text-slate-750">{user.memberGroup === 'admin' ? 'অফিসিয়াল অ্যাডমিন' : 'সাধারণ সহযোগী সদস্য'}</strong>
                </div>
                <div className="flex justify-between items-center bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-400 font-bold">সিকিউরিটি পিন কোডঃ</span>
                  <strong className="text-slate-750 font-mono tracking-widest">•••• (নিরাপদ)</strong>
                </div>
              </div>
            </div>

            <button
              onClick={() => setBottomTab('home')}
              className="w-full bg-white border border-slate-200 py-3 rounded-2xl text-xs font-extrabold transition text-slate-705 shadow-3xs"
            >
              ড্যাশবোর্ডে ফিরে যান
            </button>
          </motion.div>
        )}

        {/* ================= SAMITY ADMINTRACTION VIEWS (ADMIN) ================= */}
        {activeSubView === 'admin' && (user.role === 'admin' || user.role === 'sub_admin') && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <SamityAdmin
              users={adminUsers}
              transactions={adminTransactions}
              loading={adminLoading}
              reconUserUid={reconUserUid}
              setReconUserUid={setReconUserUid}
              reconAction={reconAction}
              setReconAction={setReconAction}
              reconAmount={reconAmount}
              setReconAmount={setReconAmount}
              reconNotes={reconNotes}
              setReconNotes={setReconNotes}
              reconSuccess={reconSuccess}
              reconError={reconError}
              handleReconciliationSubmit={handleReconciliationSubmit}
              handleApproveTransaction={handleApproveTransaction}
              handleRejectTransaction={handleRejectTransaction}
              handleApproveSamityMember={handleApproveSamityMember}
              handleRejectSamityMember={handleRejectSamityMember}
              appConfig={appConfig}
              onChangeConfig={onChangeConfig}
              dbSamityBanners={dbSamityBanners}
              setDbSamityBanners={setDbSamityBanners}
              defaultSamitySlides={defaultSamitySlides}
            />
          </motion.div>
        )}

        {/* ================= MAIN DASHBOARD VIEWS (HOME) ================= */}
        {bottomTab === 'home' && activeSubView === 'main' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Ticker / Announcement (ঘোষণা) */}
            <div className="bg-amber-500/10 border border-amber-300/30 rounded-2.5xl p-2.5 flex items-center gap-2 text-amber-900 shadow-4xs select-none">
              <div className="text-[10px] font-extrabold bg-amber-500 text-white rounded-lg px-2 py-1 flex items-center gap-1 uppercase tracking-tight shrink-0 font-sans shadow-3xs">
                <Volume2 className="w-3.5 h-3.5" />
                <span>ঘোষণা</span>
              </div>
              <div className="flex-grow overflow-hidden relative mr-1.5">
                <marquee className="text-[12px] font-bold text-slate-800 leading-none py-0.5" behavior="scroll" direction="left" scrollamount="4">
                  {appConfig?.samityTicker || "BNB ম্যানেজমেন্ট কোম্পানি ইনভেস্টর সাধারণ ফান্ডে স্বাগতম। আপনি এখান থেকে সঞ্চয় জমা দিতে পারেন, ঋণ আবেদন এবং মুনাফার শেয়ার তুলতে পারেন।"}
                </marquee>
              </div>
            </div>




            {/* 2. Red/Amber Compact Card: Auto-Savings Switch & Withdrawal Policy (লাল দাগ চিহ্নিত তথ্য ও সুইচের বক্স - আরও সংক্ষিপ্ত) */}
            <div className="bg-gradient-to-r from-amber-50/90 via-orange-50/60 to-amber-50/90 border border-amber-200/90 rounded-2xl p-2.5 shadow-2xs space-y-1.5 w-full">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-400/30 text-amber-700 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                  </div>
                  <div className="min-w-0 flex items-center gap-1.5">
                    <span className="text-[11px] font-black text-amber-950">অটো সঞ্চয় ডিপোজিটঃ</span>
                    <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded-full border ${
                      samityAutoSavingsActive
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}>
                      {samityAutoSavingsActive ? 'সচল (ON)' : 'বন্ধ (OFF)'}
                    </span>
                  </div>
                </div>

                {/* Interactive Switch Toggle */}
                <button
                  type="button"
                  onClick={handleToggleAutoSavingsSwitch}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none shadow-3xs ${
                    samityAutoSavingsActive ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      samityAutoSavingsActive ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Ultra-compact combined notice box */}
              <div className="bg-white/90 border border-amber-200/80 rounded-xl p-1.5 text-[9.5px] font-bold space-y-1 text-amber-950 shadow-3xs">
                <p className="leading-tight text-amber-900">
                  {samityAutoSavingsActive ? (
                    <>💡 <strong>সুইচ সচল (ON):</strong> আপনার মাসিক অটো সঞ্চয় চালু রয়েছে। নিয়মিত সমিতি অব্যাহত থাকবে।</>
                  ) : (
                    <>⚠️ <strong>সুইচ বন্ধ (OFF):</strong> অটো সঞ্চয় বন্ধ রয়েছে। ২৫-৩০শে ডিসেম্বর জমানো টাকা মেইন ব্যালেন্সে জমা হবে।</>
                  )}
                </p>

                {user.samityDeactivateStatus === 'pending' ? (
                  <div className="pt-1 border-t border-amber-100 flex items-center justify-between gap-1 text-amber-900 font-extrabold text-[9px]">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                      ⏳ বন্ধের আবেদন বিবেচনাধীন (Pending)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowHelplineModal(true)}
                      className="text-[8px] bg-amber-600 hover:bg-amber-700 text-white px-1.5 py-0.5 rounded font-black transition"
                    >
                      💬 হেল্পলাইন
                    </button>
                  </div>
                ) : (
                  <div className="pt-1 border-t border-amber-100 flex items-center justify-between gap-1">
                    <span className="text-[9px] font-bold text-amber-950 truncate">
                      {user?.canDisableAutoSavings || user?.allowAutoSavingsToggle || user?.samityDeactivateStatus === 'approved'
                        ? '🔓 অফের অনুমতিঃ এডমিন অনুমোদিত (সুইচ অফ করতে পারবেন)'
                        : '🔒 অফের অনুমতিঃ এডমিন অনুমতি সংরক্ষিত'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowHelplineModal(true)}
                      className="text-[8px] bg-rose-600 hover:bg-rose-700 text-white px-1.5 py-0.5 rounded font-black shadow-2xs shrink-0 transition flex items-center gap-0.5 cursor-pointer"
                    >
                      💬 হেল্পলাইন যোগাযোগ
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Main Combined Box (একত্রিত সবুজ দাগের সম্পূর্ণ সেকশন - ফুল স্ক্রিন ও কম উচ্চতায়) */}
            <div className="bg-white border border-slate-150 rounded-2xl p-2.5 sm:p-3 shadow-sm text-left relative overflow-hidden space-y-2 w-full">
              <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

              {/* Virtual Samity Deposit Account Number Banner (Phone + 0) - Ultra Compact 1-Line */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50/70 to-emerald-50 border border-emerald-300/80 rounded-xl p-1.5 px-2.5 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <div className="min-w-0 flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] font-black text-emerald-900 uppercase tracking-tight">
                      সমিতি একাউন্ট নং (BNB অটো ফান্ডিং):
                    </span>
                    <span className="text-xs font-black font-mono text-emerald-950 tracking-wider">
                      {user.phone ? `${user.phone}0` : '017000000000'}
                    </span>
                    <span className="text-[7.5px] bg-emerald-600 text-white px-1 py-0.1 rounded font-mono font-bold">
                      অটো জমা
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const virtualNum = `${user.phone || ''}0`;
                    navigator.clipboard.writeText(virtualNum);
                    setCopySuccess('কপি হয়েছে!');
                    setTimeout(() => setCopySuccess(''), 2500);
                  }}
                  className="px-2 py-0.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-extrabold text-[10px] rounded-lg flex items-center gap-1 transition shadow-xs cursor-pointer shrink-0"
                >
                  <Copy className="w-2.5 h-2.5" />
                  <span>{copySuccess || 'কপি'}</span>
                </button>
              </div>

              {/* Multi-Year Samity Payment Tracker Matrix (৫০ সাল পর্যন্ত সঞ্চয় কিস্তি ট্র্যাকার) */}
              <div className="bg-gradient-to-br from-slate-50 via-emerald-50/20 to-teal-50/30 border border-emerald-200/80 rounded-xl text-left p-2 space-y-2 shadow-xs">
                {/* Header (Clickable to open 2050 Calendar) - Compact */}
                <div 
                  onClick={() => setShow2050CalendarModal(true)}
                  className="flex items-center justify-between border-b border-emerald-150/80 pb-1 cursor-pointer group hover:bg-emerald-100/40 p-1 rounded-lg transition"
                  title="৫০ সাল পর্যন্ত সম্পূর্ণ ক্যালেন্ডার দেখতে টিপ দিন"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Calendar className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <h3 className="text-[10.5px] font-black text-emerald-950 uppercase tracking-tight">
                          ৫০ সালের সঞ্চয় কিস্তি ট্র্যাকার
                        </h3>
                        <span className="text-[8px] bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-full font-bold shadow-3xs group-hover:bg-amber-400 transition">
                          ৫০ সালের ক্যালেন্ডার ↗
                        </span>
                      </div>
                      <p className="text-[8px] text-slate-500 font-bold truncate">টিপ দিলে ২০৫০ সাল পর্যন্ত সম্পূর্ণ ক্যালেন্ডার ও লক্ষ্যমাত্রা খুলবে</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-black bg-emerald-600 text-white px-1.5 py-0.5 rounded-full font-mono shadow-3xs shrink-0">
                    {SAMITY_MONTHS.filter((m, idx) => {
                      const targetMonthly = user.monthlySavingsTarget || 1000;
                      const monthIndexFromStart = (trackerSelectedYear - 2026) * 12 + idx;
                      const totalMonthsPaidBySavings = Math.floor((user.savings || 0) / targetMonthly);
                      return monthIndexFromStart < totalMonthsPaidBySavings;
                    }).length} / ১২ মাস ({trackerSelectedYear})
                  </span>
                </div>

                {/* Year Navigation Bar (২০২৬ - ২০৫০) */}
                <div className="flex items-center justify-between gap-1.5 bg-emerald-100/40 p-1.5 rounded-xl border border-emerald-200/60">
                  <div className="flex items-center gap-1 overflow-x-auto py-0.5 scrollbar-none max-w-[calc(100%-85px)]">
                    {SAMITY_YEARS.map(yr => {
                      const isCurrent = yr === new Date().getFullYear();
                      const isSelected = yr === trackerSelectedYear;
                      const targetMonthly = user.monthlySavingsTarget || 1000;
                      const totalMonthsPaidBySavings = Math.floor((user.savings || 0) / targetMonthly);
                      const yrPaid = SAMITY_MONTHS.filter((m, idx) => {
                        const idxStart = (yr - 2026) * 12 + idx;
                        return idxStart < totalMonthsPaidBySavings;
                      }).length;

                      return (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => setTrackerSelectedYear(yr)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-black font-mono transition shrink-0 cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-700 text-white ring-2 ring-emerald-500 shadow-3xs'
                              : yrPaid === 12
                              ? 'bg-emerald-200/90 text-emerald-950 border border-emerald-300'
                              : 'bg-white border border-slate-200 text-slate-700 hover:border-emerald-300'
                          }`}
                        >
                          {yr}{isCurrent ? '*' : ''}
                        </button>
                      );
                    })}
                  </div>

                  {/* Dropdown for quick jump */}
                  <select
                    value={trackerSelectedYear}
                    onChange={(e) => setTrackerSelectedYear(Number(e.target.value))}
                    className="text-[10px] font-black font-mono bg-white border border-emerald-300 text-emerald-950 rounded-lg px-1.5 py-0.5 shrink-0 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  >
                    {SAMITY_YEARS.map(yr => (
                      <option key={yr} value={yr}>বছর: {yr}</option>
                    ))}
                  </select>
                </div>

                {/* Selected Year Title Banner */}
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-700 px-0.5">
                  <span>📅 <strong>{trackerSelectedYear} সালের</strong> সঞ্চয় কিস্তি তালিকা ({trackerSelectedYear === new Date().getFullYear() ? 'চলতি বছর' : '২০৫০ লক্ষ্যমাত্রা'})</span>
                  <span className="text-[9px] text-emerald-800 font-mono font-black bg-emerald-100/80 px-1.5 py-0.2 rounded border border-emerald-200">
                    মাসিক: ৳{(user.monthlySavingsTarget || 1000).toLocaleString('bn-BD')}
                  </span>
                </div>

                {/* 12-Month Payment Matrix Grid */}
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {SAMITY_MONTHS.map((m, idx) => {
                    const targetMonthly = user.monthlySavingsTarget || 1000;
                    const monthIndexFromStart = (trackerSelectedYear - 2026) * 12 + idx;
                    const totalMonthsPaidBySavings = Math.floor((user.savings || 0) / targetMonthly);
                    const isPaid = monthIndexFromStart < totalMonthsPaidBySavings;

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          if (!isPaid) {
                            setSelectedPayMonth({ ...m, year: trackerSelectedYear });
                          } else {
                            setCustomAlert({
                              title: `✅ ${m.name} ${trackerSelectedYear} সঞ্চয় পরিশোধিত`,
                              message: `আপনি ইতিমধ্যে ${m.name} ${trackerSelectedYear} সালের সমবায় সঞ্চয় কিস্তি ৳${targetMonthly.toLocaleString('bn-BD')} টাকা সফলভাবে জমা দিয়েছেন।`
                            });
                          }
                        }}
                        className={`p-1.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-between min-h-[52px] ${
                          isPaid
                            ? 'bg-emerald-500/10 border-emerald-300 text-emerald-950 font-black shadow-3xs'
                            : 'bg-rose-50/60 border-rose-200 hover:border-rose-400 text-slate-800 font-bold hover:shadow-2xs'
                        }`}
                      >
                        <span className="text-[10px] font-extrabold truncate">{m.name}</span>
                        {isPaid ? (
                          <span className="inline-flex items-center gap-0.5 text-[8.5px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-mono font-bold mt-1 shadow-3xs">
                            <CheckCircle2 className="w-2.5 h-2.5" /> পরিশোধিত
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[8.5px] bg-rose-600 hover:bg-rose-700 text-white px-1.5 py-0.2 rounded font-mono font-bold mt-1 shadow-3xs">
                            <PlusCircle className="w-2.5 h-2.5" /> বকেয়া (জমা)
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Side-by-side Row: Left = Samity Balance ("আমার মোট টাকা"), Right = Deposit Progress ("জমার অগ্রগতি") */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {/* Left Box: আমার মোট টাকা */}
                <div className="bg-gradient-to-br from-emerald-50/70 to-teal-50/40 border border-emerald-150 rounded-2xl p-2.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-emerald-900 font-sans tracking-tight truncate">আমার মোট টাকা</span>
                    <button 
                      type="button"
                      onClick={() => setShowBalance(!showBalance)}
                      className="p-1 bg-white/80 hover:bg-white border border-emerald-200/60 rounded-lg transition text-emerald-700 cursor-pointer"
                    >
                      {showBalance ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="mt-1">
                    <h2 className="text-lg sm:text-xl font-black font-sans text-teal-900 tracking-tight flex items-baseline">
                      {renderBalanceValue(totalCoopBalance)}
                    </h2>
                    <span className="text-[8px] font-extrabold text-emerald-700 block mt-0.5">সমিতি ব্যালেন্স</span>
                  </div>
                </div>

                {/* Right Box: জমার অগ্রগতি */}
                <div className="bg-gradient-to-br from-slate-50 to-teal-50/30 border border-slate-200/80 rounded-2xl p-2.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-800 font-sans truncate">জমার অগ্রগতি</span>
                    <span className="text-[9px] font-black font-sans text-teal-800 bg-teal-100/80 border border-teal-200/80 px-1.5 py-0.2 rounded-md shrink-0">
                      {progressPercent.toLocaleString('bn-BD')}%
                    </span>
                  </div>

                  <div className="my-1">
                    <div className="w-full h-2 bg-slate-200/90 rounded-full overflow-hidden border border-slate-200/60">
                      <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-600 rounded-full" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[8px] text-slate-500 font-extrabold font-mono leading-none">
                    <span className="truncate">লক্ষ্য: ৳{targetGoal.toLocaleString('bn-BD')}</span>
                    <span className="text-emerald-700 shrink-0">{remainingTarget > 0 ? `৳${remainingTarget.toLocaleString('bn-BD')} বাকি` : "অর্জিত!"}</span>
                  </div>
                </div>
              </div>

              {/* Bottom 4 Stat Cards: জমা, লাভ, সঞ্চয়, এই মাসের জমা */}
              <div className="grid grid-cols-4 gap-1 sm:gap-2 pt-2.5 border-t border-slate-100 text-xs">
                {/* 1. জমা */}
                <div 
                  onClick={() => setActiveSubView('savings_dps')}
                  className="space-y-1 cursor-pointer hover:bg-slate-50/80 rounded-xl p-1 transition flex flex-col items-center text-center min-w-0"
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
                      <PiggyBank className="w-3.5 h-3.5 text-emerald-600" />
                    </span>
                    <span className="text-[9.5px] text-slate-500 font-extrabold leading-none truncate">জমা</span>
                  </div>
                  <p className="font-sans font-black text-slate-800 text-[10px] sm:text-xs leading-none truncate mt-0.5">{renderBalanceValue(lastDepositAmount)}</p>
                  <span className="text-[7.5px] text-emerald-600 font-bold block leading-none truncate">সর্বশেষ জমা</span>
                </div>

                {/* 2. লাভ */}
                <div 
                  onClick={() => setActiveSubView('profits')}
                  className="space-y-1 cursor-pointer hover:bg-slate-50/80 rounded-xl p-1 transition flex flex-col items-center text-center min-w-0 border-l border-slate-150/70"
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100">
                      <LineChart className="w-3.5 h-3.5 text-indigo-600" />
                    </span>
                    <span className="text-[9.5px] text-slate-500 font-extrabold leading-none truncate">লাভ</span>
                  </div>
                  <p className="font-sans font-black text-slate-800 text-[10px] sm:text-xs leading-none truncate mt-0.5">{renderBalanceValue(userProfits)}</p>
                  <span className="text-[7.5px] text-indigo-600 font-bold block leading-none truncate">লভ্যাংশ</span>
                </div>

                {/* 3. সঞ্চয় */}
                <div 
                  onClick={() => setActiveSubView('custom_savings')}
                  className="space-y-1 cursor-pointer hover:bg-slate-50/80 rounded-xl p-1 transition flex flex-col items-center text-center min-w-0 border-l border-slate-150/70"
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100">
                      <Award className="w-3.5 h-3.5 text-amber-600" />
                    </span>
                    <span className="text-[9.5px] text-slate-500 font-extrabold leading-none truncate">সঞ্চয়</span>
                  </div>
                  <p className="font-sans font-black text-slate-800 text-[10px] sm:text-xs leading-none truncate mt-0.5">{renderBalanceValue(userDps)}</p>
                  <span className="text-[7.5px] text-amber-600 font-bold block leading-none truncate">ইচ্ছেমত</span>
                </div>

                {/* 4. এই মাসের জমা */}
                <div 
                  onClick={() => setActiveSubView('new_deposit')}
                  className="space-y-1 cursor-pointer hover:bg-slate-50/80 rounded-xl p-1 transition flex flex-col items-center text-center min-w-0 border-l border-slate-150/70"
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="w-6 h-6 rounded-lg bg-red-50 flex items-center justify-center shrink-0 border border-red-100">
                      <Calendar className="w-3.5 h-3.5 text-red-600" />
                    </span>
                    <span className="text-[9.5px] text-slate-500 font-extrabold leading-none truncate">এই মাসের জমা</span>
                  </div>
                  <p className="font-sans font-black text-slate-800 text-[10px] sm:text-xs leading-none truncate mt-0.5">{renderBalanceValue(user.monthlySavingsTarget || 500)}</p>
                  <span className="text-[7.5px] text-rose-600 font-bold block leading-none truncate">৯ তারিখের মধ্যে</span>
                </div>
              </div>
            </div>

            {/* 6. Fast Actions (৬. ক্ষুদ্র অ্যাকশন) - Square clickable icons for quick views */}
            <div className="bg-white border border-slate-150 p-4 rounded-3xl text-left shadow-2xs space-y-3">
              <h4 className="text-[10px] font-black text-slate-400 tracking-wider uppercase">ক্ষুদ্র অ্যাকশন</h4>
              
              <div className="grid grid-cols-4 gap-2">
                
                {/* টাকা জমা */}
                <button
                  onClick={() => setActiveSubView('new_deposit')}
                  className="flex flex-col items-center gap-1.5 transition active:scale-90 group cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-md hover:opacity-95 shadow-sm">
                    <Plus className="w-5 h-5 stroke-[3]" />
                  </div>
                  <span className="text-[10.5px] font-black text-slate-700 font-sans">টাকা জমা</span>
                </button>

                {/* টাকা উত্তোলন */}
                <button
                  onClick={() => setActiveSubView('withdraw_savings')}
                  className="flex flex-col items-center gap-1.5 transition active:scale-90 group cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-full bg-blue-500 text-white flex items-center justify-center font-black text-md hover:opacity-95 shadow-sm">
                    <ArrowDown className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <span className="text-[10.5px] font-black text-slate-700 font-sans">টাকা উত্তোলন</span>
                </button>

                {/* লেনদেন */}
                <button
                  onClick={() => {
                    fetchUserTransactions();
                    setCustomAlert({
                      message: "সমিতির সব লেনদেন দেখতে নিচে 'সাম্প্রতিক কার্যক্রম' স্ক্রোল করুন অথবা 'রিপোর্ট' বাটন ট্যাপ করুন।",
                      title: "লেনদেন দেখার নির্দেশিকা"
                    });
                  }}
                  className="flex flex-col items-center gap-1.5 transition active:scale-90 group cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-full bg-amber-500 text-white flex items-center justify-center font-black text-md hover:opacity-95 shadow-sm">
                    <FileText className="w-[18px] h-[18px]" />
                  </div>
                  <span className="text-[10.5px] font-black text-slate-700 font-sans">লেনদেন</span>
                </button>

                {/* সদস্য তালিকা */}
                <button
                  onClick={() => setActiveSubView('member_registry')}
                  className="flex flex-col items-center gap-1.5 transition active:scale-90 group cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-md hover:opacity-95 shadow-sm">
                    <Users className="w-[18px] h-[18px]" />
                  </div>
                  <span className="text-[10.5px] font-black text-slate-700 font-sans">সদস্য তালিকা</span>
                </button>

              </div>
            </div>

            {/* Special Investor Services Section */}
            <div className="bg-white border border-slate-150 p-4 rounded-3xl text-left shadow-2xs space-y-3" id="special-investor-services">
              <h4 className="text-[10px] font-black text-slate-400 tracking-wider uppercase">ইনভেস্টর সেবা ও নীতিমালা</h4>
              
              <div className="grid grid-cols-4 gap-1 sm:gap-2">
                {/* মাসিক বিনিয়োগ ও পলিসি */}
                <button
                  onClick={() => setActiveSubView('monthly_investment_policy')}
                  className="flex flex-col items-center text-center p-1.5 sm:p-2 rounded-2xl bg-teal-50/50 hover:bg-teal-50 border border-teal-100/45 transition active:scale-95 cursor-pointer"
                  id="btn-monthly-policy"
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-xs mb-1">
                    <PiggyBank className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-black text-teal-900 font-sans leading-tight">মাসিক বিনিয়োগ<br/>& পলিসি</span>
                </button>

                {/* রেফারেল নেটওয়ার্ক */}
                <button
                  onClick={() => setActiveSubView('referral_network')}
                  className="flex flex-col items-center text-center p-1.5 sm:p-2 rounded-2xl bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100/45 transition active:scale-95 cursor-pointer"
                  id="btn-referral-network"
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs mb-1">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-black text-indigo-900 font-sans leading-tight">রেফারেল<br/>নেটওয়ার্ক</span>
                </button>

                {/* শেয়ার বিক্রয় ও হস্তান্তর */}
                <button
                  onClick={() => setActiveSubView('share_transfer')}
                  className="flex flex-col items-center text-center p-1.5 sm:p-2 rounded-2xl bg-rose-50/50 hover:bg-rose-50 border border-rose-100/45 transition active:scale-95 cursor-pointer"
                  id="btn-share-transfer"
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xs mb-1">
                    <Award className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-black text-rose-900 font-sans leading-tight">শেয়ার বিক্রয়<br/>ও হস্তান্তর</span>
                </button>

                {/* অন্য সদস্যের একাউন্ট */}
                <button
                  onClick={() => setActiveSubView('register_other_member')}
                  className="flex flex-col items-center text-center p-1.5 sm:p-2 rounded-2xl bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-100/45 transition active:scale-95 cursor-pointer"
                  id="btn-register-other-member"
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs mb-1">
                    <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-black text-emerald-900 font-sans leading-tight">অন্য সদস্যের<br/>একাউন্ট করুন</span>
                </button>
              </div>
            </div>

            {/* 8. Samity Summary (৮. সমিতি সারাংশ) - Horizontal 3-column Samity replica cards */}
            <div className="bg-white border border-slate-150 rounded-2xl p-3 text-left shadow-2xs space-y-2.5 w-full">
              <h4 className="text-[10px] font-black text-emerald-800 tracking-wider uppercase leading-none flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                সমবায় সমিতি সারাংশ
              </h4>
              
              <div className="grid grid-cols-3 gap-2 text-center">
                
                {/* ১. সমিতি সদস্য (ইনভেস্টার) */}
                <div className="bg-emerald-50/60 p-2 rounded-xl border border-emerald-100 flex flex-col items-center justify-center">
                  <span className="block text-[8px] text-emerald-800 font-extrabold mb-0.5 uppercase truncate w-full">সমিতি সদস্য</span>
                  <div className="flex items-center justify-center gap-1">
                    <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <strong className="text-[11px] font-black text-slate-900 truncate">{Math.round(activeMembersNum).toLocaleString('bn-BD')} জন</strong>
                  </div>
                  <span className="text-[7.5px] text-emerald-700 font-bold block mt-0.5 truncate">মাসিক ইনভেস্টার</span>
                </div>

                {/* ২. সমিতি মোট জমা */}
                <div className="bg-teal-50/60 p-2 rounded-xl border border-teal-100 flex flex-col items-center justify-center">
                  <span className="block text-[8px] text-teal-800 font-extrabold mb-0.5 uppercase truncate w-full">সমিতি মোট জমা</span>
                  <div className="flex items-center justify-center gap-1">
                    <PiggyBank className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <strong className="text-[10.5px] font-black text-slate-900 truncate">৳ {totalCompanyDeposits.toLocaleString('bn-BD')}</strong>
                  </div>
                  <span className="text-[7.5px] text-teal-700 font-bold block mt-0.5 truncate">সমবায় আমানত</span>
                </div>

                {/* ৩. সমিতি মোট লাভ */}
                <div className="bg-indigo-50/60 p-2 rounded-xl border border-indigo-100 flex flex-col items-center justify-center">
                  <span className="block text-[8px] text-indigo-800 font-extrabold mb-0.5 uppercase truncate w-full">সমিতি মোট লাভ</span>
                  <div className="flex items-center justify-center gap-1">
                    <LineChart className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <strong className="text-[10.5px] font-black text-slate-900 truncate">৳ {totalCompanyProfits.toLocaleString('bn-BD')}</strong>
                  </div>
                  <span className="text-[7.5px] text-indigo-700 font-bold block mt-0.5 truncate">সদস্যদের লভ্যাংশ</span>
                </div>

              </div>
            </div>

            {/* Standard Warning Notice for trust assets */}
            <div className="bg-rose-50 border border-rose-100 p-3 rounded-2xl text-[10.5px] text-rose-800 font-sans leading-relaxed flex items-start gap-2 text-left">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <p className="font-bold">
                ⚠️ অ্যাডমিন প্যানেলের অনুমতি ব্যতীত সমিতির টাকা ও ব্যাংক অ্যাকাউন্ট হতে টাকা সরাসরি স্থানান্তর করা সম্ভব নয়। সকল উত্তোলন পেন্ডিং থাকবে।
              </p>
            </div>

          </motion.div>
        )}

        {/* ================= SUB VIEW: MONTHLY INVESTMENT & POLICY ================= */}
        {bottomTab === 'home' && activeSubView === 'monthly_investment_policy' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 text-left font-sans"
          >
            {/* Header / Nav card with Back Button and Toggle Button */}
            <div className="bg-white border border-slate-150 p-4 rounded-3xl shadow-3xs flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => {
                    setActiveSubView('main');
                    setFormError('');
                    setFormSuccess('');
                  }}
                  className="p-1.5 hover:bg-slate-100 rounded-xl border border-slate-150 text-slate-500 transition active:scale-95 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                <div>
                  <h3 className="text-sm font-black text-teal-900 font-sans">
                    {appConfig?.samityPolicyConfig?.policyTitle || 'মাসিক বিনিয়োগ ও নীতিমালা'}
                  </h3>
                  <p className="text-[9.5px] text-slate-400 mt-0.5">
                    {appConfig?.samityPolicyConfig?.policySubTitle || '১ম থেকে ২৫শে অক্টোবর পেমেন্ট সিস্টেম ও বিলম্ব চার্জসমূহ'}
                  </p>
                </div>
              </div>

              {/* Deactivate/Reactivate Button */}
              {user.samitySchemeActive !== false ? (
                <button
                  onClick={() => {
                    setFormError('');
                    setFormSuccess('');
                    setSamityPinInput('');
                    setSamityPinPrompt('close');
                  }}
                  className="px-3.5 py-1.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 font-black hover:bg-rose-100 transition active:scale-95 cursor-pointer"
                >
                  বন্ধ করুন
                </button>
              ) : (
                <button
                  onClick={() => {
                    setFormError('');
                    setFormSuccess('');
                    setSamityPinInput('');
                    if (user.dueMonths && user.dueMonths > 0) {
                      setSamityPinPrompt('pay_reactivate');
                    } else {
                      setSamityPinPrompt('active');
                    }
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 border border-emerald-750 text-white rounded-xl text-xs font-black hover:bg-emerald-700 transition active:scale-95 cursor-pointer"
                >
                  চালু করুন
                </button>
              )}
            </div>

            {/* Error/Success alerts */}
            {formError && (
              <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs p-3.5 rounded-2xl font-bold">
                ⚠️ {formError}
              </div>
            )}
            {formSuccess && (
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs p-3.5 rounded-2xl font-bold">
                ✓ {formSuccess}
              </div>
            )}

            {/* Current Active Status Indicator */}
            <div className={`p-4 rounded-3xl border ${
              user.samitySchemeActive !== false 
                ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800'
                : 'bg-rose-50/50 border-rose-100 text-rose-800'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${user.samitySchemeActive !== false ? 'bg-emerald-600 animate-pulse' : 'bg-rose-500'}`} />
                <span className="text-xs font-black">
                  স্কিম স্ট্যাটাসঃ {user.samitySchemeActive !== false ? '🟢 সচল (Active)' : '🔴 বন্ধ (Inactive)'}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-bold mt-1.5 leading-normal">
                {user.samitySchemeActive !== false 
                  ? (appConfig?.samityPolicyConfig?.schemeStatusNote || 'আপনার একাউন্ট থেকে প্রতি মাসের ১ থেকে ৯ তারিখের মধ্যে স্বয়ংক্রিয়ভাবে মেইন ব্যালেন্স থেকে কিস্তি অটো-ডেবিট করা হবে।')
                  : 'আপনার স্কিমটি বর্তমানে বন্ধ রয়েছে। বকেয়া কিস্তিসমূহ পরিশোধপূর্বক সিকিউরিটি পিন দিয়ে পুনরায় চালু করতে পারবেন।'}
              </p>
              {user.samitySchemeActive === false && (
                <div className="mt-2.5 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-[10.5px] font-bold leading-relaxed">
                  <p className="text-slate-700">
                    ২৫শে ডিসেম্বরের পূর্বে আপনার সঞ্চিত টাকা উত্তোলন করতে পারবেন না। আপনার জমাকৃত <strong className="text-rose-600 font-black">৳ {userSavings.toLocaleString('bn-BD')}</strong> টাকা ডিসেম্বরের ২৫ তারিখে আপনার মেইন ব্যালেন্সে স্বয়ংক্রিয়ভাবে যোগ হয়ে যাবে।
                  </p>
                </div>
              )}
            </div>

            {/* 1. Fixed Investment amount card */}
            <div className="bg-white border border-slate-150 p-4.5 rounded-3xl space-y-3.5 shadow-3xs text-left">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-extrabold text-teal-600 uppercase tracking-widest block">
                  {appConfig?.samityPolicyConfig?.fixedAmountTitle || '১. নির্ধারিত মাসিক বিনিয়োগের পরিমাণ'}
                </span>
                <span className="text-[9.5px] bg-slate-100 border border-slate-200 text-slate-500 font-bold px-2 py-0.5 rounded-md flex items-center gap-1 uppercase">
                  🔒 Locked
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">নির্ধারিত মাসিক কিস্তি</span>
                  <span className="font-sans text-lg font-black text-slate-800">৳ {(user.monthlySavingsTarget || 1000).toLocaleString('bn-BD')} <span className="text-xs text-slate-500 font-normal">BDT</span></span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-teal-600" />
                </div>
              </div>
              <p className="text-[10.5px] text-slate-500 leading-normal font-sans">
                {appConfig?.samityPolicyConfig?.fixedAmountNote || '💡 অ্যাকাউন্ট খোলার সময় আপনার নির্বাচিত এই কিস্তির পরিমাণ স্থায়ী। এটি সাধারণ ব্যবহারকারী নিজে পরিবর্তন করতে পারবেন না। প্রয়োজনে পরিবর্তন করার জন্য এডমিন প্যানেলের মাধ্যমে প্রধান কার্যালয়ের সাথে যোগাযোগ করুন।'}
              </p>
            </div>

            {/* 2. Penalty Schedule */}
            <div className="bg-white border border-slate-150 p-4.5 rounded-3xl space-y-3.5 shadow-3xs">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                {appConfig?.samityPolicyConfig?.penaltyTitle || '২. বিলম্ব পেমেন্ট ও জরিমানা পলিসি'}
              </span>

              {appConfig?.samityPolicyConfig?.pausePenaltyUntil15th && (
                <div className="p-3 bg-amber-500/10 border border-amber-400/60 rounded-2xl text-amber-900 text-xs font-bold flex items-start gap-2 shadow-2xs">
                  <span className="text-base leading-none">📢</span>
                  <div>
                    <span className="text-[11px] font-black text-amber-800 uppercase block">
                      বিশেষ সুযোগঃ বিলম্ব জরিমানা স্থগিত (১৫ই পর্যন্ত ০ জরিমানা)
                    </span>
                    <p className="text-[11.5px] font-semibold text-slate-700 mt-0.5 leading-relaxed">
                      {appConfig?.samityPolicyConfig?.penaltyExemptionNote || `অ্যাপ সম্পূর্ণ প্রস্তুত না হওয়া পর্যন্ত এই মাসের জরিমানা ৯ তারিখের পরিবর্তে ${appConfig?.samityPolicyConfig?.penaltyExemptionUntilDay || 15} তারিখ পর্যন্ত স্থগিত করা হয়েছে।`}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2 text-xs">
                {(appConfig?.samityPolicyConfig?.penaltyTiers && appConfig.samityPolicyConfig.penaltyTiers.length > 0
                  ? appConfig.samityPolicyConfig.penaltyTiers
                  : [
                      { id: '1', rangeLabel: '১ থেকে ৯ তারিখঃ', fineText: 'কোনো জরিমানা নেই (০ BDT)', bgClass: 'bg-emerald-50/40 border-emerald-100 text-emerald-800' },
                      { id: '2', rangeLabel: '১০ থেকে ১৯ তারিখঃ', fineText: '৳ ১০ জরিমানা', bgClass: 'bg-amber-50/40 border-amber-100 text-amber-800' },
                      { id: '3', rangeLabel: '২০ থেকে ২৯ তারিখঃ', fineText: '৳ ২০ জরিমানা', bgClass: 'bg-orange-50/40 border-orange-100 text-orange-800' },
                      { id: '4', rangeLabel: '৩০ থেকে ৩৯ তারিখঃ', fineText: '৳ ৩০ জরিমানা', bgClass: 'bg-rose-50/40 border-rose-100 text-rose-800' },
                      { id: '5', rangeLabel: '৪০তম দিনঃ', fineText: '৳ ৮০ জরিমানা', bgClass: 'bg-red-50/40 border-red-150 text-red-800' },
                      { id: '6', rangeLabel: '৪০তম দিনের পরঃ', fineText: '৳ ১০ প্রতিদিন জরিমানা', bgClass: 'bg-slate-50 border-slate-150 text-slate-700' }
                    ]
                ).map((tier, idx) => (
                  <div key={tier.id || idx} className={`flex justify-between items-center p-2.5 rounded-xl border ${tier.bgClass || 'bg-slate-50 border-slate-200 text-slate-800'}`}>
                    <span className="font-bold">{tier.rangeLabel}</span>
                    <span className="font-extrabold">
                      {appConfig?.samityPolicyConfig?.pausePenaltyUntil15th && tier.fromDay <= (appConfig?.samityPolicyConfig?.penaltyExemptionUntilDay || 15)
                        ? `${tier.fineText} (বর্তমানে স্থগিত)`
                        : tier.fineText}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Rules List */}
            <div className="bg-white border border-slate-150 p-4.5 rounded-3xl space-y-2.5 shadow-3xs">
              <span className="text-[10px] font-extrabold text-purple-600 uppercase tracking-widest block">
                ৩. বিশেষ ইনভেস্টার শর্তাবলী
              </span>
              <div className="space-y-2">
                {(appConfig?.samityPolicyConfig?.customRules && appConfig.samityPolicyConfig.customRules.length > 0
                  ? appConfig.samityPolicyConfig.customRules
                  : [
                      "২৫শে ডিসেম্বরের পূর্বে আপনার সঞ্চিত টাকা উত্তোলন করতে পারবেন না। আপনার জমাকৃত টাকা ডিসেম্বরের ২৫-৩০ তারিখের মধ্যে স্বয়ংক্রিয়ভাবে মেইন ব্যালেন্সে জমা হবে।",
                      "প্রতি মাসের ১ থেকে ৯ তারিখের মধ্যে স্বয়ংক্রিয়ভাবে অটো-ডেবিট কিস্তি জমা নেওয়া হয়।",
                      "১০ তারিখ থেকে বিলম্বে কিস্তি জমায় জরিমানা পলিসি প্রযোজ্য হবে।",
                      "বিশেষ প্রয়োজনে অটো সঞ্চয় বন্ধ করতে এডমিন অনুমতির জন্য হেল্পলাইনে যোগাযোগ করুন।"
                    ]
                ).map((ruleItem, rIdx) => (
                  <div key={rIdx} className="bg-purple-50/50 border border-purple-100 p-3 rounded-2xl flex items-start gap-2 text-xs font-semibold text-purple-950">
                    <span className="w-5 h-5 rounded-full bg-purple-200 text-purple-800 font-extrabold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      {rIdx + 1}
                    </span>
                    <p className="leading-relaxed text-[11px] font-sans">{ruleItem}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Interactive simulation tool */}
            <div className="bg-slate-900 text-white p-5 rounded-3xl space-y-4 shadow-md relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                  ⚡
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-emerald-400">তারিখ পরিবর্তন করে জরিমানা পরীক্ষা করুন</h4>
                  <p className="text-[9.5px] text-slate-400 mt-0.5">স্বয়ংক্রিয় অটো-ডেবিট ও জরিমানা সমন্বয় সিমুলেশন</p>
                </div>
              </div>

              <div className="space-y-3 pt-1 text-xs">
                <div>
                  <label className="block text-[10.5px] text-slate-450 font-bold mb-1.5">চলতি মাসের কোন তারিখে পেমেন্ট পরীক্ষা করবেন?</label>
                  <select
                    value={simulatedDay}
                    onChange={(e) => setSimulatedDay(Number(e.target.value))}
                    className="block w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs"
                  >
                    {Array.from({ length: 60 }, (_, i) => i + 1).map((day) => {
                      let tag = '';
                      const penaltyAmt = getPenaltyAmount(day);
                      if (penaltyAmt === 0) {
                        if (appConfig?.samityPolicyConfig?.pausePenaltyUntil15th && day > 9) {
                          tag = ` (${day}ই পর্যন্ত জরিমানা স্থগিত - ৳০)`;
                        } else {
                          tag = ' (জরিমানা নেই - ৳০)';
                        }
                      } else {
                        tag = ` (৳${penaltyAmt} বিলম্ব জরিমানা)`;
                      }
                      return (
                        <option key={day} value={day}>
                          {day} তারিখ {tag}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Live penalty calculations output */}
                <div className="bg-slate-850/80 p-3.5 rounded-2xl border border-slate-800 space-y-2 text-[11.5px] font-sans font-semibold">
                  <div className="flex justify-between">
                    <span className="text-slate-400">নির্ধারিত মাসিক কিস্তিঃ</span>
                    <span className="font-bold">৳ {(user.monthlySavingsTarget || 1000).toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">বিলম্ব জরিমানা চার্জঃ</span>
                    <span className={`font-bold ${getPenaltyAmount(simulatedDay) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      ৳ {getPenaltyAmount(simulatedDay).toLocaleString('bn-BD')}
                      {appConfig?.samityPolicyConfig?.pausePenaltyUntil15th && simulatedDay > 9 && simulatedDay <= (appConfig?.samityPolicyConfig?.penaltyExemptionUntilDay || 15) ? ' (স্থগিত)' : ''}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-2 text-xs font-black">
                    <span className="text-teal-400">মোট প্রদেয় কিস্তিঃ</span>
                    <span className="text-emerald-400">
                      ৳ {((user.monthlySavingsTarget || 1000) + getPenaltyAmount(simulatedDay)).toLocaleString('bn-BD')}
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 leading-normal bg-slate-850 p-2.5 border border-slate-800 rounded-xl font-normal leading-relaxed">
                  💡 <strong>পলিসি অনুযায়ীঃ</strong> আপনার মেইন ব্যালেন্স যদি পর্যাপ্ত না থাকে, তবে পূর্বের জমানো সঞ্চয় (৳{userSavings.toLocaleString('bn-BD')}) হতে এই জরিমানা সমন্বয় করা হবে।
                </div>

                {/* Process Auto Debit Simulation */}
                {user.lastPaidMonth === '2026-06' ? (
                  <div className="bg-emerald-950/50 border border-emerald-900 text-emerald-400 text-xs p-3 rounded-xl text-center font-bold">
                    ✓ এই সিমুলেশনে জুন ২০২৬ মাসের ডিপিএস অলরেডি পেইড দেখাচ্ছে!
                  </div>
                ) : (
                  <button
                    onClick={handleExecuteAutoDebit}
                    disabled={actionLoading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-3 rounded-xl font-extrabold text-xs transition duration-200 disabled:opacity-50"
                  >
                    {actionLoading ? 'প্রক্রিয়াকরণ হচ্ছে...' : 'অটো-ডেবিট ও জরিমানা সমন্বয় করুন'}
                  </button>
                )}
              </div>
            </div>

            {/* Back button */}
            <button
              onClick={() => setActiveSubView('main')}
              className="w-full bg-white border border-slate-150 hover:bg-slate-50 text-slate-700 font-extrabold py-3.5 rounded-2xl text-xs transition shadow-4xs text-center"
            >
              পিছনে ফিরে যান
            </button>
          </motion.div>
        )}

        {/* ================= SUB VIEW: REFERRAL NETWORK ================= */}
        {bottomTab === 'home' && activeSubView === 'referral_network' && (() => {
          const myReferrals = allUsers.filter(u => u.referredBy === user.memberId || u.referredBy === user.phone);
          const referralLink = `${window.location.origin}/?ref=${user.memberId || user.phone}`;
          
          return (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 text-left font-sans"
            >
              {/* Header */}
              <div className="bg-white border border-slate-150 p-4.5 rounded-3xl shadow-3xs flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-teal-900">রেফারেল নেটওয়ার্ক</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">আপনার রেফারেল নেটওয়ার্ক, কোড এবং মেম্বার লিস্ট</p>
                </div>
                <button
                  onClick={() => {
                    setActiveSubView('main');
                    setFormError('');
                    setFormSuccess('');
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 font-bold hover:bg-slate-100 transition active:scale-95"
                >
                  বন্ধ করুন
                </button>
              </div>

              {/* Alert Notification */}
              {formError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-750 text-xs p-3.5 rounded-2xl font-bold">
                  ⚠️ {formError}
                </div>
              )}
              {formSuccess && (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-750 text-xs p-3.5 rounded-2xl font-bold">
                  ✓ {formSuccess}
                </div>
              )}

              {/* 1. Share Refer and Earn card */}
              <div className="bg-gradient-to-br from-indigo-900 to-teal-950 text-white p-5 rounded-3xl space-y-4 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl" />
                
                <div className="space-y-1">
                  <span className="text-[9px] bg-indigo-500 text-white font-extrabold uppercase px-2 py-0.5 rounded-md">
                    REWARD SYSTEM
                  </span>
                  <h3 className="text-sm font-black text-teal-300">রেফারেল প্রোগ্রাম</h3>
                  <p className="text-[10px] text-slate-300 leading-normal font-medium mt-1">
                    আপনার রেফারেল লিংক বা মেম্বার আইডি ব্যবহার করে নতুন সদস্য যুক্ত করুন। ড্যাশবোর্ড থেকে তাদের স্থিতি নজর রাখুন।
                  </p>
                </div>

                {/* Referral Code Display */}
                <div className="bg-indigo-950/60 border border-indigo-800/80 p-3 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-indigo-300 block font-bold uppercase">আমার রেফারেল কোড</span>
                    <span className="font-mono text-base font-black tracking-wide text-white">{user.memberId || user.phone}</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(user.memberId || user.phone);
                      setCustomAlert({
                        message: "রেফারেল কোড সফলভাবে কপি করা হয়েছে!",
                        title: "কোড কপি সম্পন্ন"
                      });
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-[10.5px] font-bold text-white transition active:scale-95"
                  >
                    কপি করুন
                  </button>
                </div>

                {/* Referral Link Display */}
                <div className="bg-indigo-950/60 border border-indigo-800/80 p-3 rounded-2xl space-y-1.5">
                  <span className="text-[9px] text-indigo-300 block font-bold uppercase">আমার রেফারেল লিংক</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={referralLink}
                      className="flex-1 bg-indigo-950 border border-indigo-900 px-3 py-1.5 text-[10px] rounded-xl text-slate-300 font-mono focus:outline-none truncate"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(referralLink);
                        setCustomAlert({
                          message: "রেফারেল লিংক সফলভাবে কপি করা হয়েছে!",
                          title: "লিংক কপি সম্পন্ন"
                        });
                      }}
                      className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 rounded-xl text-[10.5px] font-bold text-white transition active:scale-95"
                    >
                      কপি করুন
                    </button>
                  </div>
                </div>
              </div>

              {/* Enter Referrer Code if not set */}
              {!user.referredBy ? (
                <div className="bg-white border border-slate-150 p-4.5 rounded-3xl space-y-3 shadow-3xs">
                  <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest block">১. রেফারার কোড যোগ করুন</span>
                  <p className="text-xs text-slate-500 leading-normal">
                    আপনাকে যদি অন্য কোনো সক্রিয় সদস্য রেফার করে থাকেন, তবে তার মেম্বার আইডি বা মোবাইল নম্বর দিয়ে সাবমিট করুন।
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={referrerCodeInput}
                      onChange={(e) => setReferrerCodeInput(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800"
                      placeholder="যেমনঃ BNB00000001"
                    />
                    <button
                      onClick={handleSetReferrer}
                      disabled={actionLoading}
                      className="px-4 py-2.5 bg-indigo-800 hover:bg-indigo-900 text-white text-xs font-bold rounded-xl transition disabled:opacity-50"
                    >
                      সাবমিট
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-xs text-emerald-800 font-semibold space-y-1">
                  <p>✓ <strong>রেফারার সংযুক্তঃ</strong> আপনি সফলভাবে রেফারেল নেটওয়ার্কে যুক্ত আছেন।</p>
                  <p className="text-[10px] text-emerald-600 font-bold uppercase mt-1">রেফারার আইডি: {user.referredBy}</p>
                </div>
              )}

              {/* Referred Members list */}
              <div className="bg-white border border-slate-150 p-4 rounded-3xl space-y-4 shadow-3xs">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                  <span className="text-[10.5px] font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-tight">
                    <Users className="w-4 h-4 text-slate-500" />
                    আমার রেফারকৃত মেম্বার তালিকা ({myReferrals.length})
                  </span>
                  <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono font-black">NETWORK SIZE</span>
                </div>

                <div className="space-y-2.5">
                  {myReferrals.length > 0 ? (
                    myReferrals.map((item, idx) => (
                      <div key={item.uid || idx} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between text-xs shadow-4xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                            {idx + 1}
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-800 block text-[11px] leading-tight">{item.name}</span>
                            <span className="text-[9.5px] text-slate-400 block mt-0.5 font-sans">ID: {item.memberId || 'N/A'} • মোবাইলঃ {item.phone ? `${item.phone.slice(0, 5)}*****${item.phone.slice(-3)}` : 'N/A'}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[8.5px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-extrabold uppercase border border-emerald-200">
                            সক্রিয় সদস্য
                          </span>
                          <span className="text-[8.5px] text-slate-450 block mt-1">সঞ্চয়: ৳{(item.savings || 0).toLocaleString('bn-BD')}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-7 text-center text-xs text-slate-400 font-bold italic leading-relaxed">
                      আপনি এখনো কোনো মেম্বার রেফার করেননি।<br/>আপনার রেফারেল লিংক ব্যবহার করে মেম্বারদের আমন্ত্রন জানান!
                    </div>
                  )}
                </div>
              </div>

              {/* Back button */}
              <button
                onClick={() => setActiveSubView('main')}
                className="w-full bg-white border border-slate-150 hover:bg-slate-50 text-slate-700 font-extrabold py-3.5 rounded-2xl text-xs transition shadow-4xs text-center"
              >
                পিছনে ফিরে যান
              </button>
            </motion.div>
          );
        })()}

        {/* ================= SUB VIEW: SHARE TRANSFER ================= */}
        {bottomTab === 'home' && activeSubView === 'share_transfer' && (() => {
          const myShares = user.shares !== undefined ? user.shares : Math.max(1, Math.floor(user.savings / 1000));
          
          return (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 text-left font-sans"
            >
              {/* Header */}
              <div className="bg-white border border-slate-150 p-4.5 rounded-3xl shadow-3xs flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-teal-900">শেয়ার বিক্রয় ও হস্তান্তর</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">আপনার শেয়ার বিক্রি বা হস্তান্তর করার পোর্টাল</p>
                </div>
                <button
                  onClick={() => {
                    setActiveSubView('main');
                    setFormError('');
                    setFormSuccess('');
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 font-bold hover:bg-slate-100 transition active:scale-95"
                >
                  বন্ধ করুন
                </button>
              </div>

              {/* Alerts */}
              {formError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-750 text-xs p-3.5 rounded-2xl font-bold">
                  ⚠️ {formError}
                </div>
              )}
              {formSuccess && (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-750 text-xs p-3.5 rounded-2xl font-bold">
                  ✓ {formSuccess}
                </div>
              )}

              {/* 1. Share stats card */}
              <div className="bg-gradient-to-br from-rose-900 to-rose-950 text-white p-5 rounded-3xl space-y-3.5 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-28 h-28 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
                
                <div>
                  <span className="text-[9px] bg-rose-500/30 text-rose-200 font-extrabold uppercase border border-rose-500/30 px-2 py-0.5 rounded-md">
                    EQUITY HOLDING
                  </span>
                  <span className="text-[10.5px] block text-rose-200 mt-1.5 font-bold uppercase font-sans">আমার মোট শেয়ার সংখ্যা</span>
                  <h2 className="text-3xl font-black font-sans mt-0.5 text-white tracking-tight">{myShares} টি শেয়ার</h2>
                  <p className="text-[10px] text-rose-250 mt-1 leading-normal">
                    ১,০০০ টাকা সঞ্চয়ের বিপরীতে ১টি শেয়ার ধরা হয়েছে। আপনার মালিকানাধীন শেয়ার আপনি অন্য যেকোনো নিবন্ধিত মেম্বারের কাছে বিক্রি বা ট্রান্সফার করতে পারেন।
                  </p>
                </div>
              </div>

              {/* 2. Submit Transfer request */}
              <div className="bg-white border border-slate-150 p-4.5 rounded-3xl space-y-4 shadow-3xs">
                <span className="text-[10px] font-extrabold text-rose-600 uppercase tracking-widest block">১. নতুন শেয়ার হস্তান্তর আবেদন</span>
                
                <form onSubmit={handleShareTransferSubmit} className="space-y-3 text-xs">
                  {/* Recipient User ID */}
                  <div>
                    <label className="block text-slate-600 font-extrabold mb-1.5">গ্রহীতার মেম্বার আইডি বা মোবাইল নম্বর</label>
                    <input
                      type="text"
                      required
                      value={shareRecipientId}
                      onChange={(e) => setShareRecipientId(e.target.value)}
                      className="block w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-850 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white"
                      placeholder="যেমনঃ BNB00000002"
                    />
                    {shareRecipientName ? (
                      <span className="text-[10px] text-emerald-600 font-bold block mt-1">
                        ✓ গ্রহীতার নামঃ <strong>{shareRecipientName}</strong>
                      </span>
                    ) : shareRecipientId.trim() ? (
                      <span className="text-[10px] text-rose-500 font-semibold block mt-1">
                        ⚠️ এই আইডি বা মোবাইলের কোনো সদস্য পাওয়া যায়নি
                      </span>
                    ) : null}
                  </div>

                  {/* Share count and Price */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-600 font-extrabold mb-1.5">হস্তান্তর শেয়ার সংখ্যা</label>
                      <input
                        type="number"
                        required
                        min={1}
                        max={myShares}
                        value={shareCountInput}
                        onChange={(e) => setShareCountInput(e.target.value)}
                        className="block w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-850 text-xs font-bold focus:outline-none"
                        placeholder={`সর্বোচ্চ ${myShares}`}
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-extrabold mb-1.5">প্রতি শেয়ারের মূল্য (ঐচ্ছিক)</label>
                      <input
                        type="number"
                        min={0}
                        value={sharePriceInput}
                        onChange={(e) => setSharePriceInput(e.target.value)}
                        className="block w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-850 text-xs font-bold focus:outline-none"
                        placeholder="যেমনঃ ৫০০"
                      />
                    </div>
                  </div>

                  {/* Security PIN code */}
                  <div>
                    <label className="block text-slate-600 font-extrabold mb-1.5">সিকিউরিটি পিন নম্বর</label>
                    <input
                      type="password"
                      required
                      maxLength={4}
                      value={shareTransferPin}
                      onChange={(e) => setShareTransferPin(e.target.value.replace(/\D/g, ''))}
                      className="block w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-850 text-xs font-bold tracking-widest text-center"
                      placeholder="••••"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading || !shareRecipientName}
                    className="w-full bg-rose-800 hover:bg-rose-900 active:bg-rose-950 text-white font-extrabold py-3 rounded-xl text-xs transition duration-200 disabled:opacity-50"
                  >
                    {actionLoading ? 'প্রক্রিয়াকরণ হচ্ছে...' : 'হস্তান্তর আবেদন সাবমিট করুন'}
                  </button>
                </form>
              </div>

              {/* 3. Share transfer request list */}
              <div className="bg-white border border-slate-150 p-4 rounded-3xl space-y-3 shadow-3xs">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block border-b border-slate-100 pb-1.5">২. হস্তান্তর ইতিহাস ও অনুরোধসমূহ</span>
                
                {loadingShareTransfers ? (
                  <div className="py-5 text-center text-xs text-slate-450 font-bold">লোড হচ্ছে...</div>
                ) : (
                  <div className="space-y-2">
                    {shareTransfers.length > 0 ? (
                      shareTransfers.map((item, idx) => {
                        const isSender = item.senderUid === user.uid;
                        return (
                          <div key={`${item.id}-${idx}`} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between text-xs shadow-4xs">
                            <div>
                              <span className={`font-extrabold text-xs block ${isSender ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {isSender ? `শেয়ার বিক্রয় / হস্তান্তর` : `শেয়ার ক্রয় / প্রাপ্ত`}
                              </span>
                              <span className="text-[9.5px] text-slate-450 block mt-0.5 font-semibold">
                                {isSender ? `গ্রহীতা: ${item.receiverName} (${item.receiverMemberId})` : `প্রেরক: ${item.senderName} (${item.senderMemberId})`}
                              </span>
                              <span className="text-[8px] text-slate-400 font-mono block mt-0.5">তারিখ: {new Date(item.createdAt).toLocaleDateString('bn-BD')}</span>
                            </div>
                            <div className="text-right space-y-1">
                              <span className="font-sans font-black text-slate-800 text-xs block">{item.sharesCount} টি শেয়ার</span>
                              <span className={`text-[8.5px] px-1.5 py-0.5 rounded font-extrabold uppercase border block ${
                                item.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                item.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                'bg-amber-50 text-amber-700 border-amber-100'
                              }`}>
                                {item.status === 'approved' ? 'অনুমোদিত' : item.status === 'rejected' ? 'প্রত্যাখ্যাত' : 'অনুমোদন অপেক্ষায়'}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-6 text-center text-xs text-slate-450 font-bold">কোনো পূর্ববর্তী ট্র্যান্সফার রেকর্ড পাওয়া যায়নি।</div>
                    )}
                  </div>
                )}
              </div>

              {/* Back button */}
              <button
                onClick={() => setActiveSubView('main')}
                className="w-full bg-white border border-slate-150 hover:bg-slate-50 text-slate-700 font-extrabold py-3.5 rounded-2xl text-xs transition shadow-4xs text-center"
              >
                পিছনে ফিরে যান
              </button>
            </motion.div>
          );
        })()}

        {/* ================= SUB VIEW: REGISTER OTHER MEMBER ================= */}
        {bottomTab === 'home' && activeSubView === 'register_other_member' && (() => {
          return (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 text-left"
            >
              {/* Header card */}
              <div className="bg-white border border-slate-150 p-4 rounded-3xl shadow-2xs flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 leading-tight">অন্য সদস্যের একাউন্ট করুন</h3>
                    <p className="text-[10.5px] text-slate-500 font-medium">সমবায় সমিতিতে আপনার মাধ্যমে নতুন সদস্য যুক্ত করুন</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveSubView('main')}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  পিছনে যান
                </button>
              </div>

              {/* Prominent Counter Box */}
              <div className="bg-gradient-to-br from-emerald-800 to-emerald-950 text-white p-5 rounded-3xl shadow-lg relative overflow-hidden text-center space-y-2 border border-emerald-700/50">
                <div className="w-11 h-11 bg-white/10 rounded-2xl flex items-center justify-center mx-auto text-emerald-300 border border-white/20 backdrop-blur-xs">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-xs font-extrabold tracking-wide text-emerald-100">আপনি এ পর্যন্ত মোট নিবন্ধিত করেছেন</h3>
                <div className="text-3xl font-black font-mono tracking-tight text-white flex items-center justify-center gap-2">
                  <span>🎉</span>
                  <span>{createdMembersCount}</span>
                  <span className="text-sm font-bold text-emerald-200 font-sans">জন সদস্য</span>
                </div>
                <p className="text-[11px] text-emerald-200/90 font-medium max-w-sm mx-auto">
                  আপনি যেসব নতুন সদস্যের অ্যাকাউন্ট তৈরি করে দিয়েছেন তারা আপনার তালিকাভুক্ত সমবায় সদস্য হিসেবে গণ্য হবেন।
                </p>
              </div>

              {regSuccessData ? (
                /* Success View */
                <div className="bg-white border border-emerald-200 p-6 rounded-3xl text-center space-y-4 shadow-sm">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto border border-emerald-300">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-black text-slate-900">সদস্য আবেদন সফলভাবে সাবমিট হয়েছে!</h3>
                    <p className="text-xs text-slate-600">নতুন সদস্যের আবেদনটি এডমিন প্যানেলে অনুমোদনের জন্য জমা হয়েছে।</p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl text-left text-xs space-y-1.5 text-slate-700">
                    <p>👤 <strong>সদস্য নামঃ</strong> {regSuccessData.name}</p>
                    <p>🆔 <strong>সদস্য আইডিঃ</strong> <span className="font-mono text-emerald-900 font-black">{regSuccessData.memberId}</span></p>
                    <p>📞 <strong>মোবাইল নম্বরঃ</strong> <span className="font-mono text-slate-900 font-black">{regSuccessData.phone}</span></p>
                    <p>⏳ <strong>আবেদনের স্ট্যাটাসঃ</strong> <span className="text-amber-600 font-extrabold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">এডমিন অনুমোদনের অপেক্ষায় (Pending)</span></p>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-xs text-emerald-900 font-medium space-y-1 text-left">
                    <p className="font-bold flex items-center gap-1.5 text-emerald-800">
                      <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                      এডমিন অনুমোদন ও পিন সেটআপ প্রক্রিয়া:
                    </p>
                    <p className="text-[11px] leading-relaxed text-emerald-850">
                      এডমিন আবেদনটি যাচাই করে অনুমোদন (Approve) দিলে এই সদস্য তাঁর মোবাইল নম্বর দিয়ে অ্যাপে প্রবেশ করে প্রথমবার নিজের ৪ ডিজিটের সিকিউরিটি পিন সেট করে অ্যাকাউন্টে প্রবেশ করতে পারবেন।
                    </p>
                  </div>

                  <button
                    onClick={() => setRegSuccessData(null)}
                    className="w-full py-3.5 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-extrabold rounded-2xl text-xs transition shadow-md cursor-pointer"
                  >
                    আরেকটি নতুন একাউন্ট করুন
                  </button>
                </div>
              ) : (
                /* Registration Form */
                <div className="bg-white border border-slate-150 p-5 rounded-3xl space-y-4 shadow-2xs">
                  
                  {/* Pin Security Banner */}
                  <div className="bg-amber-50 border border-amber-200/80 p-3.5 rounded-2xl text-xs text-amber-900 space-y-1">
                    <p className="font-bold flex items-center gap-1.5 text-amber-800">
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                      গোপনীয়তা ও সিকিউরিটি পিন সংক্রান্ত নির্দেশনা:
                    </p>
                    <p className="text-[11px] leading-relaxed text-amber-900/90 font-medium">
                      সদস্যের নিরাপত্তার স্বার্থে আপনি পিন কোড সেট করতে পারবেন না। নতুন সদস্য প্রথমবার নিজের মোবাইল নম্বর দিয়ে অ্যাপসে প্রবেশ করার সময় নিজের পছন্দের ৪ ডিজিটের পিন কোড সেট করে নিবেন।
                    </p>
                  </div>

                  <form onSubmit={handleRegisterOtherMemberSubmit} className="space-y-3.5">
                    {regError && (
                      <div className="bg-red-50 text-red-650 border border-red-100 text-xs p-3.5 rounded-2xl font-medium leading-relaxed">
                        {regError}
                      </div>
                    )}

                    {/* ১. নাম */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        ১. নতুন সদস্যের নাম (বাংলা বা ইংরেজি) *
                      </label>
                      <input
                        type="text"
                        required
                        value={regMemberName}
                        onChange={(e) => setRegMemberName(e.target.value)}
                        placeholder="উদাঃ মোজাফ্মেল হক"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                      />
                    </div>

                    {/* ২. মোবাইল নম্বর */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        ২. নতুন সদস্যের মোবাইল নম্বর *
                      </label>
                      <input
                        type="tel"
                        required
                        value={regMemberPhone}
                        onChange={(e) => setRegMemberPhone(e.target.value.replace(/[^\d+]/g, ''))}
                        placeholder="উদাঃ 01712345678"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">এই নম্বর দিয়ে পরবর্তীতে সদস্য অ্যাপে প্রবেশ করবেন।</p>
                    </div>

                    {/* ৩. পিতার নাম & মাতার নাম */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">৩. পিতার নাম</label>
                        <input
                          type="text"
                          value={regFatherName}
                          onChange={(e) => setRegFatherName(e.target.value)}
                          placeholder="পিতার নাম লিখুন"
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">৪. মাতার নাম</label>
                        <input
                          type="text"
                          value={regMotherName}
                          onChange={(e) => setRegMotherName(e.target.value)}
                          placeholder="মাতার নাম লিখুন"
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* ৫. NID & জন্ম তারিখ */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">৫. NID / পাসপোর্ট নম্বর *</label>
                        <input
                          type="text"
                          required
                          value={regMemberNid}
                          onChange={(e) => setRegMemberNid(e.target.value)}
                          placeholder="NID বা পাসপোর্ট নম্বর"
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">৬. জন্ম তারিখ</label>
                        <input
                          type="date"
                          value={regMemberDob}
                          onChange={(e) => setRegMemberDob(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* ৭. ঠিকানা */}
                    <div className="space-y-2 border-t border-slate-100 pt-3">
                      <p className="text-xs font-extrabold text-slate-800">৭. সদস্যের ঠিকানা বিবরণী</p>
                      
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10.5px] font-semibold text-slate-600 mb-1">বিভাগ / প্রদেশ</label>
                          <input
                            type="text"
                            value={regMemberDivision}
                            onChange={(e) => setRegMemberDivision(e.target.value)}
                            placeholder="উদাঃ ঢাকা"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10.5px] font-semibold text-slate-600 mb-1">জেলা</label>
                          <input
                            type="text"
                            value={regMemberDistrict}
                            onChange={(e) => setRegMemberDistrict(e.target.value)}
                            placeholder="উদাঃ গাজীপুর"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10.5px] font-semibold text-slate-600 mb-1">থানা / উপজেলা</label>
                          <input
                            type="text"
                            value={regMemberThana}
                            onChange={(e) => setRegMemberThana(e.target.value)}
                            placeholder="উদাঃ টঙ্গী"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10.5px] font-semibold text-slate-600 mb-1">পোস্ট অফিস / গ্রাম</label>
                          <input
                            type="text"
                            value={regMemberPostOffice}
                            onChange={(e) => setRegMemberPostOffice(e.target.value)}
                            placeholder="গ্রাম/রোড"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* ৮. নমিনির তথ্য */}
                    <div className="space-y-2 border-t border-slate-100 pt-3">
                      <p className="text-xs font-extrabold text-slate-800">৮. নমিনির বিবরণী</p>
                      
                      <div>
                        <label className="block text-[10.5px] font-semibold text-slate-600 mb-1">নমিনির নাম *</label>
                        <input
                          type="text"
                          required
                          value={regNomineeName}
                          onChange={(e) => setRegNomineeName(e.target.value)}
                          placeholder="নমিনির নাম লিখুন"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10.5px] font-semibold text-slate-600 mb-1">নমিনির সম্পর্ক</label>
                          <input
                            type="text"
                            value={regNomineeRelation}
                            onChange={(e) => setRegNomineeRelation(e.target.value)}
                            placeholder="উদাঃ পিতা/স্ত্রী"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10.5px] font-semibold text-slate-600 mb-1">নমিনির মোবাইল *</label>
                          <input
                            type="tel"
                            required
                            value={regNomineePhone}
                            onChange={(e) => setRegNomineePhone(e.target.value)}
                            placeholder="017XXXXXXXX"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* ৯. কাঙ্ক্ষিত মাসিক সঞ্চয় স্কিম */}
                    <div className="border-t border-slate-100 pt-3 space-y-2">
                      <label className="block text-xs font-bold text-slate-800">
                        ৯. কাঙ্ক্ষিত মাসিক সঞ্চয় স্কিম নির্ধারণ করুন *
                      </label>

                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: '500 BDT', value: '500' },
                          { label: '1000 BDT', value: '1000' },
                          { label: '2000 BDT', value: '2000' },
                          { label: '3000 BDT', value: '3000' },
                          { label: '5000 BDT', value: '5000' },
                          { label: 'Custom', value: 'custom' },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setRegMonthlySavingsOption(opt.value)}
                            className={`py-2 px-1 rounded-xl text-xs font-bold border transition ${
                              regMonthlySavingsOption === opt.value
                                ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {regMonthlySavingsOption === 'custom' && (
                        <div className="mt-2">
                          <label className="block text-[10.5px] font-bold text-slate-600 mb-1">
                            আপনার পছন্দের মাসিক সঞ্চয়ের পরিমাণ লিখুন (টাকায়) *
                          </label>
                          <input
                            type="number"
                            min="500"
                            required
                            value={regCustomSavingsAmount}
                            onChange={(e) => setRegCustomSavingsAmount(e.target.value)}
                            placeholder="উদাঃ 1500, 2500, 10000"
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      )}
                    </div>

                    {/* ১০. সম্মতি */}
                    <div className="pt-2">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={regAgreed}
                          onChange={(e) => setRegAgreed(e.target.checked)}
                          className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                        />
                        <span className="text-[11px] text-slate-650 leading-snug">
                          আমি নিশ্চিত করছি যে প্রদত্ত সমস্ত তথ্য সঠিক এবং আমি সমবায় সমিতির নীতিমালার সাথে একমত পোষণ করছি।
                        </span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={regLoading}
                      className="w-full py-3.5 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-extrabold rounded-2xl text-xs transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {regLoading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        'নতুন সদস্য অ্যাকাউন্ট তৈরি করুন'
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* Previously Created Members List */}
              {createdMembersList.length > 0 && (
                <div className="bg-white border border-slate-150 p-4 rounded-3xl space-y-3 shadow-2xs">
                  <h4 className="text-xs font-black text-slate-800 flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-emerald-600" />
                      আপনার নিবন্ধিত সদস্যবৃন্দের তালিকা
                    </span>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-100">
                      মোট {createdMembersList.length} জন
                    </span>
                  </h4>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {createdMembersList.map((m, idx) => (
                      <div key={`${m.uid}-${idx}`} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between text-xs">
                        <div>
                          <span className="font-extrabold text-slate-900 block">{m.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">আইডি: {m.memberId} | মোবাইল: {m.phone}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-emerald-700 block bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                            মাসিক ৳{m.monthlySavingsTarget || 500}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setActiveSubView('main')}
                className="w-full bg-white border border-slate-150 hover:bg-slate-50 text-slate-700 font-extrabold py-3.5 rounded-2xl text-xs transition shadow-4xs text-center"
              >
                পিছনে ফিরে যান
              </button>
            </motion.div>
          );
        })()}

        {/* ================= SUB VIEW: SAVINGS & DPS DETAIL ================= */}
        {bottomTab === 'home' && activeSubView === 'savings_dps' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4 text-left"
          >
            <div className="bg-white border border-slate-150 p-5 rounded-3xl space-y-4 shadow-3xs">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <span className="text-xs font-black text-emerald-600 flex items-center gap-1">
                  <Wallet className="w-4 h-4" />
                  সঞ্চয় বিবরণী ও চলমান ডিপিএস খাতা
                </span>
                <span className="text-[9px] bg-slate-100 text-slate-500 font-mono font-bold border border-slate-200/80 px-2.5 py-0.5 rounded-full">Automated Ledger</span>
              </div>

              <div className="space-y-3 font-sans text-xs font-bold leading-relaxed">
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500">১. সঞ্চয় তহবিলের স্থিতিঃ</span>
                  <span className="font-sans font-black text-slate-850">৳ {userSavings.toLocaleString('bn-BD')}</span>
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500">২. ডিপিএস অ্যাকাউন্ট সংখ্যাঃ</span>
                  <span className="font-sans font-black text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-100 text-[10px]">১টি সক্রিয় ডিপিএস</span>
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500">৩. মাসিক ডিপিএস কিস্তিঃ</span>
                  <span className="font-mono text-slate-800">৳ ৫০০ / মাসিক</span>
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500">৪. মোট পরিশোধিত ডিপিএস কিস্তিঃ</span>
                  <span className="font-mono text-slate-800">৳ {userDps.toLocaleString('bn-BD')} ({Math.floor(userDps / 500)}টি কিস্তি পরিশোধিত)</span>
                </div>

                <p className="text-[10px] text-slate-400 bg-slate-50 p-2.5 border border-slate-150 leading-normal pt-2 border-t rounded-xl italic font-normal">
                  *আপনার কোনো ডিপিএস কিস্তি বকেয়া নেই। ডিপিএস ম্যাচিউরিটি হলে ১০০% হালাল মুনাফা সহ মূল সঞ্চয় ওয়ালেটে একযোগে জমা হয়ে যাবে।
                </p>
              </div>
            </div>

            {/* Savings Deposit History Ledger */}
            <div className="bg-white border border-slate-150 p-5 rounded-3xl space-y-3 shadow-3xs text-left font-sans">
              <h4 className="text-[11.5px] font-black text-slate-700 flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                <span className="w-1.5 h-3 bg-emerald-500 rounded-sm inline-block"></span>
                সমবায় ও ইনভেস্টর জমা স্টেটমেন্ট (ইতিহাস)
              </h4>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {userTxHistory.filter(tx => tx.type === 'coop_savings_deposit' && (tx.status === 'success' || tx.status === 'approved')).length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-[10.5px] font-bold">
                    এখনো কোনো আমানত বা সঞ্চয় জমা করা হয়নি।
                  </div>
                ) : (
                  userTxHistory
                    .filter(tx => tx.type === 'coop_savings_deposit' && (tx.status === 'success' || tx.status === 'approved'))
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((tx, idx) => (
                      <div key={`${tx.id}-${idx}`} className="flex justify-between items-center p-2.5 bg-slate-50/60 rounded-xl border border-slate-100 text-xs">
                        <div>
                          <span className="font-extrabold text-slate-700 block">{tx.typeLabel || 'মাসিক সঞ্চয় ডিপিএস'}</span>
                          <span className="text-[9.5px] text-slate-400 block mt-0.5 font-medium">
                            {new Date(tx.createdAt).toLocaleDateString('bn-BD')} {new Date(tx.createdAt).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-emerald-600 font-mono">+ ৳{tx.amount.toLocaleString('bn-BD')} BDT</span>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            <button
              onClick={() => setActiveSubView('new_deposit')}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-2xl text-xs transition duration-200 shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-5 h-5 text-white" />
              নতুন আমানত বা ডিপিএস কিস্তি জমা দিন
            </button>

            <button
              onClick={() => setActiveSubView('main')}
              className="w-full bg-white border border-slate-150 hover:bg-slate-50 text-slate-700 font-extrabold py-2.5 rounded-2xl text-xs transition active:scale-95 cursor-pointer shadow-4xs text-center"
            >
              পিছনে ফিরে যান
            </button>
          </motion.div>
        )}

        {/* ================= SUB VIEW: CUSTOM SAVINGS ================= */}
        {bottomTab === 'home' && activeSubView === 'custom_savings' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4 text-left font-sans animate-fade-in"
          >
            <div className="bg-white border border-slate-150 p-5 rounded-3xl space-y-4 shadow-3xs">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <span className="text-xs font-black text-amber-600 flex items-center gap-1">
                  <Wallet className="w-4 h-4" />
                  ইচ্ছেমত সঞ্চয় খাতা ও আমানত
                </span>
                <span className="text-[9px] bg-amber-50 text-amber-700 font-mono font-bold border border-amber-200 px-2.5 py-0.5 rounded-full">Flexible Savings</span>
              </div>

              {/* Savings Balance summary */}
              <div className="bg-gradient-to-br from-amber-50/50 to-orange-50/50 border border-amber-100 p-4 rounded-2xl flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-slate-500 font-black uppercase">সঞ্চয় তহবিলের মোট ব্যালেন্স</span>
                  <h3 className="text-2xl font-black text-amber-700 mt-1">৳ {userDps.toLocaleString('bn-BD')} <span className="text-xs font-bold text-slate-500">BDT</span></h3>
                </div>
                <Award className="w-10 h-10 text-amber-500/30 shrink-0" />
              </div>

              {/* Savings Deposit Form */}
              <div className="space-y-4 pt-1.5">
                <h4 className="text-[11.5px] font-black text-slate-700 flex items-center gap-1.5">
                  <span className="w-1.5 h-3 bg-amber-500 rounded-sm inline-block"></span>
                  নতুন সঞ্চয় যুক্ত করুন
                </h4>

                {formSuccess && <div className="p-2.5 bg-emerald-50 border border-emerald-150 text-emerald-700 text-[10px] rounded-lg font-bold">{formSuccess}</div>}
                {formError && <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-700 text-[10px] rounded-lg font-bold">{formError}</div>}

                {/* Quick Deposit Buttons */}
                <div className="space-y-1.5">
                  <span className="block text-[9.5px] text-slate-400 font-extrabold uppercase">দ্রুত পরিমাণ নির্বাচন করুনঃ</span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[10, 50, 100, 200, 500].map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setCustomDepositAmount(amount.toString())}
                        className={`py-2 text-[10.5px] font-black rounded-xl border transition-all cursor-pointer ${
                          customDepositAmount === amount.toString()
                            ? 'bg-amber-600 text-white border-amber-600 shadow-3xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        ৳{amount}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[9.5px] text-slate-400 font-extrabold uppercase mb-1">অথবা কাস্টম পরিমাণ (৳):</label>
                    <input
                      type="number"
                      value={customDepositAmount}
                      onChange={(e) => setCustomDepositAmount(e.target.value)}
                      placeholder="৳ জমার পরিমাণ লিখুন"
                      className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs text-slate-805 font-bold focus:outline-none focus:bg-white focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9.5px] text-slate-400 font-extrabold uppercase mb-1">৪ ডিজিটের সিকিউরিটি পিন:</label>
                    <input
                      type="password"
                      maxLength={4}
                      value={customDepositPin}
                      onChange={(e) => setCustomDepositPin(e.target.value)}
                      placeholder="•••• আপনার অ্যাকাউন্ট পিন"
                      className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs text-slate-800 text-center tracking-widest focus:outline-none focus:bg-white focus:border-amber-500"
                    />
                  </div>

                  <button
                    onClick={() => {
                      const amt = Number(customDepositAmount);
                      handleCustomSavingsSubmit(amt, customDepositPin);
                    }}
                    disabled={actionLoading}
                    className="w-full mt-1.5 py-3 bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-700 hover:to-orange-800 text-white rounded-xl text-xs font-black transition cursor-pointer text-center shadow-md shadow-amber-100"
                  >
                    {actionLoading ? 'সঞ্চয় স্থানান্তর হচ্ছে...' : 'মেইন ব্যালেন্স থেকে সঞ্চয় করুন'}
                  </button>
                </div>
              </div>
            </div>

            {/* Savings History Ledger list */}
            <div className="bg-white border border-slate-150 p-5 rounded-3xl space-y-3 shadow-3xs">
              <h4 className="text-[11.5px] font-black text-slate-700 flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                <span className="w-1.5 h-3 bg-amber-500 rounded-sm inline-block"></span>
                সঞ্চয় জমার স্টেটমেন্ট (হিস্টোরি)
              </h4>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {userTxHistory.filter(tx => tx.type === 'coop_savings_deposit' && tx.status === 'success').length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-[10.5px] font-bold">
                    এখনো কোনো সঞ্চয় জমা করা হয়নি।
                  </div>
                ) : (
                  userTxHistory
                    .filter(tx => tx.type === 'coop_savings_deposit' && tx.status === 'success')
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((tx, idx) => (
                      <div key={`${tx.id}-${idx}`} className="flex justify-between items-center p-2.5 bg-slate-50/60 rounded-xl border border-slate-100 text-xs">
                        <div>
                          <span className="font-extrabold text-slate-700 block">সঞ্চয় আমানত</span>
                          <span className="text-[9.5px] text-slate-400 block mt-0.5 font-medium">
                            {new Date(tx.createdAt).toLocaleDateString('bn-BD')} {new Date(tx.createdAt).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-emerald-600 font-mono">+ ৳{tx.amount.toLocaleString('bn-BD')} BDT</span>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            <button
              onClick={() => {
                setActiveSubView('main');
                resetFormState();
                setCustomDepositAmount('');
                setCustomDepositPin('');
              }}
              className="w-full bg-white border border-slate-150 hover:bg-slate-50 text-slate-700 font-extrabold py-2.5 rounded-2xl text-xs transition active:scale-95 cursor-pointer shadow-4xs text-center"
            >
              পিছনে ফিরে যান
            </button>
          </motion.div>
        )}

        {/* ================= SUB VIEW: COOPERATIVE LOAN LEDGER ================= */}
        {bottomTab === 'home' && activeSubView === 'loan_ledger' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4 text-left"
          >
            <div className="bg-white border border-slate-150 p-5 rounded-2.5xl space-y-4 shadow-3xs">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-rose-600" />
                  লোন হিসাব (Co-operative Loan)
                </span>
                <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full ${user.dueLoan > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {user.dueLoan > 0 ? "ACTIVE LOAN" : "NO OUTSTANDING LOAN"}
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-500 font-bold">চলতি বকেয়া ঋণের পরিমাণঃ</span>
                  <span className="text-xl font-black font-sans text-rose-600">৳ {user.dueLoan > 0 ? user.dueLoan.toLocaleString('bn-BD') : "০"} BDT</span>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-[10.5px] text-amber-850 leading-relaxed font-sans font-bold shadow-4xs">
                  ⚠️ <strong>ঋণ নিয়মনীতিঃ</strong> সমবায় বিধি অনুযায়ী প্রতিটি লোন কিস্তি প্রতি মাসের ১০ তারিখের মধ্যে ওয়ালেট ব্যালেন্স থেকে পরিশোধ করা বাধ্যতামুলক।
                </div>
              </div>
            </div>

            {/* Direct Loan Apply Inline Form */}
            <div className="bg-white border border-slate-150 p-5 rounded-2.5xl space-y-4 shadow-3xs">
              <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                ✏️ নতুন সমবায় লোনের জন্য আবেদন ফর্ম
              </h4>

              <form onSubmit={handleLoanApplicationSubmit} className="space-y-3">
                {formSuccess && <div className="p-2.5 bg-emerald-50 border border-emerald-150 text-emerald-700 text-[10px] rounded-lg font-bold">{formSuccess}</div>}
                {formError && <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-700 text-[10px] rounded-lg font-bold">{formError}</div>}

                <div>
                  <label className="block text-[10px] text-slate-500 font-extrabold uppercase mb-1">কাম্য ঋণের পরিমাণ (BDT)</label>
                  <input
                    type="number"
                    required
                    value={loanApplyAmount}
                    onChange={(e) => setLoanApplyAmount(e.target.value)}
                    placeholder="৳ কত টাকা সর্বোচ্চ ৫০,০০০ BDT"
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-teal-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-extrabold uppercase mb-1">ঋণ ব্যবহারের সুনির্দিষ্ট কারণ</label>
                  <input
                    type="text"
                    required
                    value={loanApplyPurpose}
                    onChange={(e) => setLoanApplyPurpose(e.target.value)}
                    placeholder="উদাঃ ব্যবসার নতুন পণ্য কিনার উদ্দেশ্যে"
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-teal-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-extrabold uppercase mb-1">৪ ডিজিটের সিকিউরিটি পিন কোড</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={loanApplyPin}
                    onChange={(e) => setLoanApplyPin(e.target.value)}
                    placeholder="•••• আপনার ৪ ডিজিটের একাউন্ট পিন"
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs text-slate-800 text-center tracking-widest focus:outline-none focus:bg-white focus:border-teal-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full mt-1.5 py-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition duration-150 cursor-pointer text-center"
                >
                  {actionLoading ? 'আবেদন পাঠানো হচ্ছে...' : 'লোন আবেদন সাবমিট করুন'}
                </button>
              </form>
            </div>

            <button
              onClick={() => setActiveSubView('main')}
              className="w-full bg-white border border-slate-150 hover:bg-slate-50 text-slate-700 font-extrabold py-2.5 rounded-2xl text-xs transition active:scale-95 cursor-pointer shadow-4xs text-center"
            >
              পিছনে ফিরে যান
            </button>
          </motion.div>
        )}

        {/* ================= SUB VIEW: PROFITS LEDGER ================= */}
        {bottomTab === 'home' && activeSubView === 'profits' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4 text-left"
          >
            <div className="bg-white border border-slate-150 p-5 rounded-2xl space-y-4 shadow-3xs">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Award className="w-5 h-5 text-indigo-600 animate-pulse" />
                  কোপারেটিভ অর্জিত হালাল লাভ বিবরণী
                </span>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full font-mono">Profit Ledger</span>
              </div>

              <div className="space-y-3.5">
                <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-100 p-4 rounded-xl flex justify-between items-baseline shadow-4xs">
                  <span className="text-xs text-slate-500 font-bold">সর্বমোট লভ্যাংশ ক্রেডিটঃ</span>
                  <span className="text-xl font-black text-emerald-800">৳ {userProfits.toLocaleString('bn-BD')} BDT</span>
                </div>

                <div className="text-[11px] text-slate-650 leading-relaxed font-sans font-bold space-y-2">
                  <p>🌿 <strong>লাভ বণ্টন পরিবীক্ষণঃ</strong> কো-অপারেটিভ তহবিলের সমস্ত অর্থ সরাসরি আমাদের ক্ষুদ্র শিল্প ব্যবসায় নিয়োজিত থাকে এবং অর্জিত লভ্যাংশ প্রতি ১০০ টাকায় ১% হারে বণ্টন হয়।</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setActiveSubView('main')}
              className="w-full bg-white border border-slate-150 hover:bg-slate-50 text-slate-700 font-extrabold py-2.5 rounded-2xl text-xs transition active:scale-95 cursor-pointer shadow-4xs text-center"
            >
              পিছনে ফিরে যান
            </button>
          </motion.div>
        )}

        {/* ================= SUB VIEW: MEMBER REGISTRY ================= */}
        {bottomTab === 'home' && activeSubView === 'member_registry' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4 text-left"
          >
            <div className="bg-white border border-slate-150 p-4.5 rounded-2.5xl space-y-4 shadow-3xs">
              <div className="border-b border-slate-100 pb-2.5">
                <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Users className="w-5 h-5 text-indigo-600" />
                  ইনভেস্টর মেম্বার রেজিস্ট্রি ({allUsers.length} জন)
                </h3>
              </div>

              {/* Seach registry */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="মেম্বারের নাম বা আইডি দিয়ে খুঁজুন..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 pl-9 text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-teal-500 font-bold"
                />
              </div>

              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {filteredUsers.map((m, idx) => (
                  <div key={`${m.uid}-${idx}`} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-150 rounded-2xl text-xs shadow-4xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-slate-800">{m.name}</span>
                        <span className="text-[8.5px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-black">{m.memberId || 'PENDING'}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[8.5px] bg-emerald-50 text-emerald-700 font-extrabold px-1.5 py-0.5 rounded-full uppercase">সক্ষম</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setActiveSubView('main')}
              className="w-full bg-white border border-slate-150 hover:bg-slate-50 text-slate-700 font-extrabold py-2.5 rounded-2xl text-xs transition active:scale-95 cursor-pointer shadow-4xs text-center"
            >
              পিছনে ফিরে যান
            </button>
          </motion.div>
        )}

        {/* ================= SUB VIEW: SAVINGS WITHDRAWAL ================= */}
        {bottomTab === 'home' && activeSubView === 'withdraw_savings' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4 text-left animate-fade-in"
          >
            <div className="bg-white border border-slate-150 p-5 rounded-2.5xl space-y-4.5 shadow-3xs">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                <span className="text-xs font-black text-rose-600 flex items-center gap-1">
                  <ArrowDownLeft className="w-5 h-5 text-rose-600" />
                  সঞ্চয় সাধারণ তহবিল হতে মেইন ব্যালেন্স স্থানান্তর
                </span>
                <span className="text-[9px] bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded-full font-mono uppercase font-black">Coop Transfer</span>
              </div>

              {/* Destination Warning Card */}
              <div className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl space-y-1 text-slate-700">
                <span className="text-[10px] font-bold text-rose-700 block uppercase">💡 স্থানান্তর পলিসিঃ</span>
                <p className="text-[10.5px] font-bold leading-relaxed text-slate-600">
                  সঞ্চয়ী আমানত হতে টাকা ডিরেক্টলি বা সরাসরি আপনার মেইন ব্যালেন্সে ট্রান্সফার হবে। কোনো গেটওয়ে নম্বর লাগবে না। তবে স্থানান্তরের জন্য সমবায় এডমিন অফিস থেকে অনুমতি (অ্যাপ্রুভাল) প্রয়োজন।
                </p>
              </div>

              <form onSubmit={handleSavingsWithdrawSubmit} className="space-y-3.5">
                {formSuccess && <div className="p-2.5 bg-emerald-50 border border-emerald-150 text-emerald-700 text-[10px] rounded-lg font-bold">{formSuccess}</div>}
                {formError && <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-700 text-[10px] rounded-lg font-bold">{formError}</div>}

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] text-slate-500 font-extrabold uppercase">স্থানান্তরের মোট পরিমাণ (BDT)</label>
                    <span className="text-[10px] text-indigo-600 font-bold">সর্বোচ্চঃ ৳{userSavings.toLocaleString('bn-BD')} BDT</span>
                  </div>
                  <input
                    type="number"
                    required
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="৳ কত টাকা স্থানান্তর করবেন"
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs text-slate-805 font-bold focus:outline-none focus:bg-white focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-extrabold uppercase mb-1">৪ ডিজিটের সিকিউরিটি পিন</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={withdrawPin}
                    onChange={(e) => setWithdrawPin(e.target.value)}
                    placeholder="•••• আপনার ৪ ডিজিটের অ্যাকাউন্ট পিন"
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs text-slate-800 text-center tracking-widest focus:outline-none focus:bg-white focus:border-rose-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full mt-1.5 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition duration-150 cursor-pointer text-center"
                >
                  {actionLoading ? 'অনুরোধ পাঠানো হচ্ছে...' : 'স্থানান্তর ভেরিফিকেশন পাঠান'}
                </button>
              </form>
            </div>

            <button
              onClick={() => setActiveSubView('main')}
              className="w-full bg-white border border-slate-150 hover:bg-slate-50 text-slate-700 font-extrabold py-2.5 rounded-2xl text-xs transition active:scale-95 cursor-pointer shadow-4xs text-center"
            >
              পিছনে ফিরে যান
            </button>
          </motion.div>
        )}

        {/* ================= SUB VIEW: NEW DEPOSIT ONLINE ================= */}
        {bottomTab === 'home' && activeSubView === 'new_deposit' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4 text-left font-sans"
          >
            <div className="bg-white border border-slate-150 p-5 rounded-2.5xl space-y-4 shadow-3xs">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="text-xs font-black text-emerald-600 flex items-center gap-1">
                  <Plus className="w-4 h-4 stroke-[3]" />
                  অনলাইন আমানত ও সঞ্চয় কিস্তি জমা পোর্টাল
                </span>
                <span className="text-[9.5px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-0.5 rounded-full">Deposit</span>
              </div>

              {/* Jamadan Sector Info Label */}
              <div className="bg-gradient-to-r from-emerald-50/60 to-teal-50/60 border border-emerald-100 p-3 rounded-xl flex justify-between items-center text-xs font-bold text-teal-800">
                <span>জমাদানের খাতঃ</span>
                <span className="bg-emerald-600 text-white px-2.5 py-0.5 rounded-md text-[10px] font-black">১. সাধারণ সঞ্চয়</span>
              </div>

              <form onSubmit={handleCoopDepositSubmit} className="space-y-3.5 pt-1.5">
                {formSuccess && <div className="p-2.5 bg-emerald-50 border border-emerald-150 text-emerald-700 text-[10px] rounded-lg font-bold">{formSuccess}</div>}
                {formError && <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-700 text-[10px] rounded-lg font-bold">{formError}</div>}

                {/* Current Main Balance Display */}
                <div className="flex justify-between items-center bg-teal-50/30 border border-teal-100 p-3 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase">আপনার বর্তমান মেইন ব্যালেন্স</span>
                  <span className="text-xs font-black text-teal-800">৳ {(user.balance || 0).toLocaleString('bn-BD')} BDT</span>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-extrabold uppercase mb-1">জমাদানের পরিমাণ (৳ টাকার পরিমাণ)</label>
                  <input
                    type="number"
                    required
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="৳ কত টাকা স্থানান্তর করতে চান লিখুন"
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:bg-white focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-extrabold uppercase mb-1">৪ ডিজিটের সিকিউরিটি পিন</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={depositPin}
                    onChange={(e) => setDepositPin(e.target.value)}
                    placeholder="•••• আপনার ৪ ডিজিটের অ্যাকাউন্ট পিন"
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs text-slate-800 text-center tracking-widest focus:outline-none focus:bg-white focus:border-teal-500"
                  />
                </div>

                <div className="p-3 bg-emerald-50/50 border border-emerald-150 rounded-xl text-[9.5px] leading-relaxed text-emerald-850 font-bold italic">
                  🌿 জমাকৃত টাকা আপনার প্রধান বা মেইন ব্যালেন্স থেকে সরাসরি কেটে নিয়ে এই তহবিলে স্থানান্তর করা হবে। এর জন্য কোনো সার্ভিস চার্জ প্রযোজ্য নয় এবং এটি তাৎক্ষণিকভাবে সম্পন্ন হবে।
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full mt-1.5 py-3 bg-gradient-to-r from-teal-700 to-emerald-850 text-white rounded-xl text-xs font-bold transition duration-150 cursor-pointer text-center shadow-md shadow-emerald-100"
                >
                  {actionLoading ? 'আমানত স্থানান্তর হচ্ছে...' : 'মেইন ব্যালেন্স থেকে সরাসরি যুক্ত করুন'}
                </button>
              </form>
            </div>

            <button
              onClick={() => setActiveSubView('main')}
              className="w-full bg-white border border-slate-150 hover:bg-slate-50 text-slate-700 font-extrabold py-2.5 rounded-2xl text-xs transition active:scale-95 cursor-pointer shadow-4xs text-center"
            >
              পিছনে ফিরে যান
            </button>
          </motion.div>
        )}

        {/* ================= LOCALIZED TRANSACTION HISTORY MODAL ================= */}
        <AnimatePresence>
          {showSectionTxHistory && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 font-sans"
            >
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[80vh] overflow-hidden text-slate-800"
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-emerald-800 text-white px-5 py-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-5 h-5" />
                    <div>
                      <h3 className="text-sm font-black">সমবায় ও ইনভেস্টর খতিয়ান</h3>
                      <p className="text-[10px] text-teal-100 font-medium">শুধুমাত্র কো-অপারেティブ ও বিনিয়োগ কার্যক্রমের লেনদেন</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setShowSectionTxHistory(false);
                      setTxModalSearch('');
                    }}
                    className="p-1.5 hover:bg-white/10 rounded-xl transition text-white/90 active:scale-90"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Search Bar */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input 
                      type="text"
                      value={txModalSearch}
                      onChange={(e) => setTxModalSearch(e.target.value)}
                      placeholder="পরিমাণ, আইডি বা বিবরণ দিয়ে খুঁজুন..."
                      className="w-full bg-white border border-slate-200 pl-10 pr-4 py-2 rounded-2xl text-xs font-medium focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                    />
                    {txModalSearch && (
                      <button 
                        onClick={() => setTxModalSearch('')}
                        className="text-[10px] font-black text-slate-400 hover:text-slate-600 absolute right-3.5 top-2.5"
                      >
                        মুছুন
                      </button>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {(() => {
                    const filteredTxs = userTxHistory.filter(tx => {
                      const isSamityType = ['coop_savings_deposit', 'coop_loan_apply', 'coop_loan_disbursment', 'loan_repayment'].includes(tx.type) ||
                        tx.type === 'coop_savings_deposit' ||
                        tx.type?.includes('coop') ||
                        tx.type?.includes('samity') ||
                        tx.typeLabel?.includes('সঞ্চয়') ||
                        tx.typeLabel?.includes('সমবায়') ||
                        tx.typeLabel?.includes('ডিপিএস') ||
                        tx.typeLabel?.includes('লোন') ||
                        tx.typeLabel?.includes('ঋণ') ||
                        tx.typeLabel?.includes('জরিমানা') ||
                        tx.typeLabel?.includes('শেয়ার') ||
                        tx.description?.includes('সঞ্চয়') ||
                        tx.description?.includes('সমবায়') ||
                        tx.description?.includes('ডিপিএস') ||
                        tx.description?.includes('লোন') ||
                        tx.description?.includes('ঋণ') ||
                        tx.description?.includes('জরিমানা') ||
                        tx.description?.includes('শেয়ার') ||
                        (tx.type === 'deposit' && (tx.typeLabel?.includes('সঞ্চয়') || tx.typeLabel?.includes('ডিপিএস') || tx.description?.includes('সঞ্চয়') || tx.description?.includes('ডিপিএস'))) ||
                        (tx.type === 'withdraw' && (tx.description?.includes('সমবায়') || tx.description?.includes('সঞ্চয়') || tx.typeLabel?.includes('সঞ্চয়') || tx.typeLabel?.includes('সমবায়'))) ||
                        (tx.type === 'fee_payment' && (tx.description?.includes('সমিতি') || tx.description?.includes('ডিপিএস') || tx.description?.includes('জরিমানা') || tx.description?.includes('সার্ভিস')));
                      
                      if (!isSamityType) return false;
                      
                      if (!txModalSearch.trim()) return true;
                      const searchLower = txModalSearch.toLowerCase();
                      return (
                        tx.description?.toLowerCase().includes(searchLower) ||
                        tx.typeLabel?.toLowerCase().includes(searchLower) ||
                        tx.amount.toString().includes(searchLower) ||
                        tx.id.toLowerCase().includes(searchLower) ||
                        tx.receiptNo?.toLowerCase().includes(searchLower)
                      );
                    });

                    if (filteredTxs.length === 0) {
                      return (
                        <div className="text-center py-10 text-slate-400 text-xs font-bold">
                          কোনো সমবায় লেনদেন রেকর্ড পাওয়া যায়নি।
                        </div>
                      );
                    }

                    return filteredTxs.map((tx, idx) => {
                      const isCredit = ['coop_savings_deposit', 'deposit'].includes(tx.type) && !tx.description?.includes('উত্তোলন');
                      return (
                        <div key={`${tx.id}-${idx}`} className="p-3 bg-white border border-slate-150 rounded-2xl shadow-3xs flex justify-between items-start gap-3">
                          <div className="space-y-1">
                            <span className="text-xs font-black text-slate-800 block">{tx.typeLabel || 'সমবায় সঞ্চয়'}</span>
                            <span className="text-[10px] text-slate-400 block font-medium">
                              {new Date(tx.createdAt).toLocaleDateString('bn-BD')} {new Date(tx.createdAt).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <p className="text-[10.5px] text-slate-600 font-bold leading-normal">{tx.description}</p>
                            {tx.receiptNo && (
                              <span className="inline-block text-[9px] bg-slate-100 text-slate-500 font-mono px-2 py-0.5 rounded-md">
                                Receipt: {tx.receiptNo}
                              </span>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`text-xs font-black font-mono block ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {isCredit ? '+' : '-'} ৳{tx.amount.toLocaleString('bn-BD')}
                            </span>
                            <span className={`inline-block text-[8.5px] font-extrabold px-1.5 py-0.2 mt-1 rounded-md uppercase ${
                              tx.status === 'success' || tx.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                              tx.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}>
                              {tx.status === 'success' || tx.status === 'approved' ? 'সফল' : tx.status === 'pending' ? 'অপেক্ষমাণ' : 'ব্যর্থ'}
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                  <span className="text-[10px] text-slate-400 font-bold">© BUSINESS NETWORK BANGLADESH (BNB)</span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Month Payment Modal */}
        <AnimatePresence>
          {selectedPayMonth && (
            <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedPayMonth(null)}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 text-left z-10"
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 flex items-center justify-center font-bold">
                      <PiggyBank className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase">
                        {selectedPayMonth.name} মাসের সঞ্চয় জমা
                      </h3>
                      <p className="text-[10px] text-slate-500 font-bold">
                        সমবায় সমিতি কিস্তি পরিশোধ
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPayMonth(null)}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-3 rounded-2xl space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-700 dark:text-slate-300 font-bold">
                    <span>মাসের নাম:</span>
                    <span className="font-black text-emerald-800 dark:text-emerald-300">{selectedPayMonth.name}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700 dark:text-slate-300 font-bold">
                    <span>সঞ্চয় কিস্তি পরিমাণ:</span>
                    <span className="font-black text-emerald-700 font-mono">৳{(user.monthlySavingsTarget || 1000).toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700 dark:text-slate-300 font-bold border-t border-emerald-200/60 pt-1.5">
                    <span>আপনার মেইন ব্যালেন্স:</span>
                    <span className="font-black font-mono text-teal-900 dark:text-teal-300">৳{(user.balance || 0).toLocaleString('bn-BD')}</span>
                  </div>
                </div>

                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                  💡 আপনি মেইন ব্যালেন্স থেকে <strong className="text-emerald-700">{selectedPayMonth.name}</strong> মাসের কিস্তি ৳{(user.monthlySavingsTarget || 1000).toLocaleString('bn-BD')} টাকা জমা দিতে নিশ্চিত করুন। জমা সম্পন্ন হলে তা সরাসরি সমবায় সঞ্চয় আমানতে যোগ হবে।
                </p>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedPayMonth(null)}
                    className="w-1/2 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold rounded-xl text-xs hover:bg-slate-200 transition cursor-pointer"
                  >
                    বাতিল
                  </button>
                  <button
                    type="button"
                    disabled={monthPayLoading}
                    onClick={handleConfirmMonthPayment}
                    className="w-1/2 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-xl text-xs transition shadow-md flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {monthPayLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'জমা নিশ্চিত করুন ⚡'
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* 50-Year Multi-Year Calendar & Target Modal (২০২৪ - ২০৫০) */}
        <AnimatePresence>
          {show2050CalendarModal && (
            <div className="fixed inset-0 z-[9995] flex items-center justify-center p-3 sm:p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShow2050CalendarModal(false)}
                className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 15 }}
                className="relative bg-white dark:bg-slate-900 border border-emerald-300 dark:border-slate-800 w-full max-w-2xl rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3.5 text-left z-10 max-h-[90vh] flex flex-col"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-emerald-100 dark:border-slate-800 pb-3 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold shadow-md">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-1.5">
                        ৫০ সালের রূপকল্প ও সঞ্চয় কিস্তি ক্যালেন্ডার
                        <span className="text-[9px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-mono font-bold">২০২৬ - ২০৫০</span>
                      </h3>
                      <p className="text-[10px] text-slate-500 font-bold">
                        দীর্ঘমেয়াদী সমবায় সমিতি সঞ্চয় লক্ষ্যমাত্রা ও খতিয়ান
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShow2050CalendarModal(false)}
                    className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Target Progress Overview Box */}
                <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-3.5 rounded-2xl shadow-sm space-y-2 shrink-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-700/60 pb-2">
                    <div>
                      <span className="text-[9px] font-extrabold text-emerald-300 uppercase tracking-wider block">৫০ সালের দীর্ঘমেয়াদী সঞ্চয় লক্ষ্যমাত্রা</span>
                      <h4 className="text-base font-black font-mono text-amber-300">
                        ৳{(300 * (user.monthlySavingsTarget || 1000)).toLocaleString('bn-BD')} টাকা
                      </h4>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-extrabold text-emerald-200 block">মোট সঞ্চিত জমা (আমানত)</span>
                      <h4 className="text-sm font-black font-mono text-emerald-400">
                        ৳{(user.savings || 0).toLocaleString('bn-BD')}
                      </h4>
                    </div>
                  </div>

                  {/* Overall 2050 Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-emerald-200">মোট কিস্তি পরিশোধ (২০২৬-২০৫০):</span>
                      <span className="text-amber-300 font-mono">
                        {Math.floor((user.savings || 0) / (user.monthlySavingsTarget || 1000))} / ৩০০ মাস ({((Math.floor((user.savings || 0) / (user.monthlySavingsTarget || 1000)) / 300) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-emerald-950/80 rounded-full overflow-hidden border border-emerald-700/50 p-0.5">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-400 via-emerald-400 to-teal-300 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, (Math.floor((user.savings || 0) / (user.monthlySavingsTarget || 1000)) / 300) * 100)}%` }} 
                      />
                    </div>
                  </div>
                </div>

                {/* 2026 to 2050 Yearly Matrix Scroll Area */}
                <div className="overflow-y-auto space-y-3 pr-1 grow max-h-[50vh]">
                  <p className="text-[10px] text-slate-600 dark:text-slate-300 font-bold">
                    💡 <strong>বছর সিলেক্ট নির্দেশিকা:</strong> যেকোনো বছরে ক্লিক করলে প্রধান স্ক্রিনের কিস্তি ট্র্যাকার সেই বছরে সরাসরি নেভিগেট হবে।
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {SAMITY_YEARS.map(yr => {
                      const isCurrent = yr === new Date().getFullYear();
                      const targetMonthly = user.monthlySavingsTarget || 1000;
                      const totalMonthsPaidBySavings = Math.floor((user.savings || 0) / targetMonthly);

                      let yrPaidCount = 0;
                      SAMITY_MONTHS.forEach((m, idx) => {
                        const idxStart = (yr - 2026) * 12 + idx;
                        if (idxStart < totalMonthsPaidBySavings) {
                          yrPaidCount++;
                        }
                      });

                      const isSelected = yr === trackerSelectedYear;

                      return (
                        <div
                          key={yr}
                          onClick={() => {
                            setTrackerSelectedYear(yr);
                            setShow2050CalendarModal(false);
                          }}
                          className={`p-3 rounded-2xl border transition cursor-pointer text-left space-y-2 ${
                            isSelected
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-400 shadow-md'
                              : yrPaidCount === 12
                              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-900/40'
                              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-emerald-300'
                          }`}
                        >
                          <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-1.5">
                            <span className="text-xs font-black font-mono text-slate-900 dark:text-white flex items-center gap-1.5">
                              📅 {yr} সালের কিস্তি {isCurrent ? <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-sans">চলতি</span> : null}
                            </span>
                            <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-full font-mono ${
                              yrPaidCount === 12
                                ? 'bg-emerald-600 text-white'
                                : yrPaidCount > 0
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                            }`}>
                              {yrPaidCount} / ১২ মাস পরিশোধিত
                            </span>
                          </div>

                          {/* 12 Month Dots Matrix */}
                          <div className="grid grid-cols-6 gap-1 pt-0.5">
                            {SAMITY_MONTHS.map((m, idx) => {
                              const idxStart = (yr - 2026) * 12 + idx;
                              const mPaid = idxStart < totalMonthsPaidBySavings;

                              return (
                                <div
                                  key={m.id}
                                  title={`${m.name} ${yr}: ${mPaid ? 'পরিশোধিত' : 'বকেয়া'}`}
                                  className={`p-1 rounded-lg text-center text-[8.5px] font-black truncate ${
                                    mPaid
                                      ? 'bg-emerald-600 text-white shadow-3xs'
                                      : 'bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
                                  }`}
                                >
                                  {m.short}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
                  <button
                    type="button"
                    onClick={() => setShow2050CalendarModal(false)}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer"
                  >
                    বন্ধ করুন
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Beautiful Custom Popup/Alert Modal */}
        <AnimatePresence>
          {customAlert && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              {/* Overlay Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setCustomAlert(null)}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
              />
              
              {/* Modal Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl overflow-hidden text-center space-y-4"
              >
                {/* Colored Accent Top Strip */}
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-teal-500 via-amber-500 to-indigo-500" />
                
                {/* Visual Icon Badge */}
                <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Bell className="w-6 h-6 stroke-[2]" />
                </div>
                
                <div className="space-y-1.5">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                    {customAlert.title || "বিজ্ঞপ্তি"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold leading-relaxed px-1">
                    {customAlert.message}
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setCustomAlert(null)}
                    className="w-full py-3 px-4 bg-teal-700 hover:bg-teal-800 text-white text-xs font-black rounded-2xl shadow-md shadow-teal-700/10 transition active:scale-95 cursor-pointer"
                  >
                    ঠিক আছে
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Custom Confirmation / Prompt Modal */}
        <AnimatePresence>
          {confirmState && confirmState.isOpen && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
              {/* Overlay Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  if (confirmState.onCancel) confirmState.onCancel();
                  setConfirmState(null);
                }}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
              />

              {/* Modal Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4 text-left"
              >
                <div className="absolute top-0 inset-x-0 h-1.5 bg-emerald-500" />

                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                  {confirmState.title}
                </h3>
                
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
                  {confirmState.description}
                </p>

                {confirmState.requireInput && (
                  <div className="mt-3">
                    <input
                      type="text"
                      defaultValue={confirmState.inputValue || ''}
                      id="custom-confirm-input"
                      className="block w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold text-slate-900 dark:text-white"
                      placeholder={confirmState.inputPlaceholder || 'কারণ লিখুন...'}
                      onChange={(e) => {
                        confirmState.inputValue = e.target.value;
                      }}
                    />
                  </div>
                )}

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmState.onCancel) confirmState.onCancel();
                      setConfirmState(null);
                    }}
                    className="flex-1 py-3 px-4 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 text-xs font-black rounded-2xl transition active:scale-95 cursor-pointer text-center"
                  >
                    বাতিল
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const inputVal = confirmState.requireInput 
                        ? (document.getElementById('custom-confirm-input') as HTMLInputElement)?.value 
                        : undefined;
                      const callback = confirmState.onConfirm;
                      setConfirmState(null);
                      setTimeout(() => {
                        callback(inputVal);
                      }, 0);
                    }}
                    className="flex-grow py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-2xl shadow-md shadow-emerald-600/10 transition active:scale-95 cursor-pointer text-center"
                  >
                    নিশ্চিত করুন
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Secure PIN Prompt Modal for Samity Scheme Toggle */}
        <AnimatePresence>
          {samityPinPrompt !== 'none' && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
              {/* Overlay Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setSamityPinPrompt('none');
                  setSamityPinInput('');
                }}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
              />

              {/* Modal Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white border border-slate-200 w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4 text-left font-sans"
              >
                {/* Accent Top Strip */}
                <div className={`absolute top-0 inset-x-0 h-1.5 ${
                  samityPinPrompt === 'close' ? 'bg-rose-500' : 'bg-emerald-500'
                }`} />

                <div className="space-y-1">
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 animate-pulse ${
                      samityPinPrompt === 'close' ? 'bg-rose-500' : 'bg-emerald-500'
                    }`} />
                    সিকিউরিটি পিন যাচাই করুন
                  </h3>
                  <p className="text-xs text-slate-500 font-bold leading-normal">
                    {samityPinPrompt === 'close' && 'আপনার মাসিক বিনিয়োগ স্কিমটি সাময়িকভাবে বন্ধ করতে সিকিউরিটি পিন প্রবেশ করুন। এটি বন্ধ করলে মাসিক অটো-ডেবিট বন্ধ হবে।'}
                    {samityPinPrompt === 'active' && 'আপনার মাসিক বিনিয়োগ স্কিমটি পুনরায় সচল করতে সিকিউরিটি পিন প্রবেশ করুন।'}
                    {samityPinPrompt === 'pay_reactivate' && `আপনার বকেয়া ${user.dueMonths || 1} মাসের কিস্তি (৳${((user.monthlySavingsTarget || 1000) * (user.dueMonths || 1)).toLocaleString('bn-BD')} BDT) পরিশোধ করে স্কিম সচল করতে সিকিউরিটি পিন প্রবেশ করুন।`}
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-[10.5px] text-slate-500 font-extrabold mb-1 uppercase tracking-wider">৪ ডিজিটের পিন কোড</label>
                    <input
                      type="password"
                      maxLength={4}
                      pattern="\d*"
                      value={samityPinInput}
                      onChange={(e) => setSamityPinInput(e.target.value.replace(/\D/g, ''))}
                      className="block w-full text-center tracking-[1em] font-mono py-3 px-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-lg font-black text-slate-900 placeholder:tracking-normal placeholder:text-sm placeholder:font-sans"
                      placeholder="••••"
                    />
                  </div>
                </div>

                {/* Confirm/Cancel Buttons */}
                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSamityPinPrompt('none');
                      setSamityPinInput('');
                    }}
                    className="flex-1 py-3 px-4 border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 text-xs font-black rounded-2xl transition active:scale-95 cursor-pointer text-center"
                  >
                    বাতিল
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (samityPinPrompt === 'close') {
                        handleDeactivateScheme();
                      } else if (samityPinPrompt === 'active') {
                        handleReactivateScheme();
                      } else if (samityPinPrompt === 'pay_reactivate') {
                        handlePayArrearsAndReactivate();
                      }
                    }}
                    disabled={actionLoading || samityPinInput.length < 4}
                    className={`flex-grow py-3 px-4 text-white text-xs font-black rounded-2xl shadow-md transition active:scale-95 cursor-pointer text-center disabled:opacity-40 disabled:pointer-events-none ${
                      samityPinPrompt === 'close' 
                        ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/10' 
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10'
                    }`}
                  >
                    {actionLoading ? 'যাচাই হচ্ছে...' : 'নিশ্চিত করুন'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        {/* Helpline WhatsApp Modal */}
        <AnimatePresence>
          {showHelplineModal && (
            <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowHelplineModal(false)}
                className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white border border-slate-200 w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4 text-left z-10 overflow-hidden"
              >
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500" />

                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                      <PhoneCall className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">অফিসিয়াল হেল্পলাইন সেবা</h3>
                      <p className="text-[10px] text-slate-500 font-bold">BNB সমবায় সমিতি ও কাস্টমার সাপোর্ট</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowHelplineModal(false)}
                    className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-3.5 space-y-2 text-center">
                  <span className="text-[10.5px] font-black text-emerald-900 uppercase tracking-tight block">
                    WhatsApp হেল্পলাইন ও সাপোর্ট নম্বর
                  </span>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xl font-black font-mono text-emerald-950 tracking-wider">
                      01865911728
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText('01865911728');
                        setCopySuccess('কপি হয়েছে!');
                        setTimeout(() => setCopySuccess(''), 2500);
                      }}
                      className="p-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-3xs"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copySuccess || 'কপি করুন'}</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <a
                    href="https://wa.me/8801865911728"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black rounded-2xl shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 fill-current" />
                    <span>WhatsApp-এ সরাসরি মেসেজ দিন</span>
                  </a>
                  <a
                    href="tel:01865911728"
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 text-xs font-extrabold rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer border border-slate-200"
                  >
                    <PhoneCall className="w-3.5 h-3.5 text-slate-600" />
                    <span>সরাসরি কল দিন (01865911728)</span>
                  </a>
                </div>

                <p className="text-[10px] text-slate-400 text-center font-semibold">
                  সাপ্তাহিক ৭ দিন সকাল ৯:০০ টা থেকে রাত ১০:০০ টা পর্যন্ত সাপোর্ট খোলা থাকবে।
                </p>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Deactivation Application Modal */}
        <AnimatePresence>
          {showDeactivateModal && (
            <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowDeactivateModal(false)}
                className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white border border-slate-200 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 text-left z-10 overflow-hidden"
              >
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600" />

                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-black">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">সঞ্চয় বন্ধের লিখিত আবেদন</h3>
                      <p className="text-[10px] text-slate-500 font-bold">এডমিন অনুমোদনের জন্য জমা দিন</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDeactivateModal(false)}
                    className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center text-xs font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-[10px] text-amber-900 font-semibold leading-relaxed space-y-1">
                  <p>
                    📌 <strong>সমিতি পলিসি নিয়মাবলী:</strong> অটো সঞ্চয় সুইচ বন্ধ করতে হলে এডমিন প্যানেলে লিখিত আবেদন করতে হবে।
                  </p>
                  <p>
                    ✅ এডমিন অনুমোদন দিলে আগামী <strong>২৫শে ডিসেম্বর</strong> আপনার জমানো সঞ্চয়ের মোট (৳{(user.savings || 0).toLocaleString('bn-BD')}) টাকা মেইন ব্যালেন্সে স্বয়ংক্রিয়ভাবে রিফান্ড হয়ে যাবে।
                  </p>
                </div>

                <form onSubmit={handleSubmitDeactivateRequest} className="space-y-3">
                  <div>
                    <label className="block text-[10.5px] font-black text-slate-700 mb-1">
                      সঞ্চয় বন্ধ বা লিভ নেওয়ার কারণ লিখুন *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={deactivateReason}
                      onChange={(e) => setDeactivateReason(e.target.value)}
                      placeholder="যেমন: জরুরি প্রয়োজনে সঞ্চয় বন্ধ করতে চাচ্ছি..."
                      className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-black text-slate-700 mb-1">
                      আপনার ৪ ডিজিটের সিকিউরিটি পিন কোড *
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      pattern="\d*"
                      required
                      value={deactivatePin}
                      onChange={(e) => setDeactivatePin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className="w-full text-center tracking-[0.5em] font-mono py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-base font-black text-slate-900"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowDeactivateModal(false)}
                      className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer"
                    >
                      বাতিল
                    </button>
                    <button
                      type="submit"
                      disabled={deactivateSubmitting || deactivatePin.length < 4 || !deactivateReason.trim()}
                      className="w-2/3 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl transition shadow-md shadow-rose-600/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1"
                    >
                      {deactivateSubmitting ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        'আবেদন জমা দিন 📝'
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        </AnimatePresence>

      </div>

    </div>
  );
}
