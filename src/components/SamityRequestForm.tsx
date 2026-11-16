import React, { useState } from 'react';
import { User, AppConfig, MemberNominee } from '../types';
import { db } from '../lib/firebase';
import { doc, runTransaction, addDoc, collection } from 'firebase/firestore';
import {
  Building2,
  ArrowLeft,
  User as UserIcon,
  ShieldAlert,
  CheckCircle2,
  Send,
  FileText,
  Globe,
  Users,
  IdCard
} from 'lucide-react';

interface SamityRequestFormProps {
  user: User;
  appConfig: AppConfig;
  onClose: () => void;
  onSubmitSuccess: () => void;
}

type SamityCategoryKey = 'owner' | 'shareholder' | 'investor' | 'supporter';
type IdentityDocType = 'nid' | 'birthReg';

interface NomineeFormEntry {
  name: string;
  relation: string;
  phone: string;
}

const SAMITY_CATEGORIES: Array<{
  key: SamityCategoryKey;
  title: string;
  emoji: string;
  monthlyFee: number;
  monthlyLabel: string;
  subBadge: string;
  titleColor: string;
  priceColor: string;
  idleBg: string;
  activeBg: string;
  badgeIdle: string;
  badgeActive: string;
}> = [
  {
    key: 'owner',
    title: 'ওনার',
    emoji: '🔴',
    monthlyFee: 5000,
    monthlyLabel: '৳৫,০০০/মাস',
    subBadge: '৩ মাসে ৳১০হাজার',
    titleColor: 'text-rose-950',
    priceColor: 'text-rose-700',
    idleBg: 'bg-rose-50/90 hover:bg-rose-100 border-rose-300',
    activeBg: 'bg-gradient-to-b from-rose-600 via-red-600 to-red-700 text-white border-red-400 ring-2 ring-red-400 shadow-md scale-[1.02]',
    badgeIdle: 'bg-rose-200/80 text-rose-900',
    badgeActive: 'bg-white/20 text-rose-100',
  },
  {
    key: 'shareholder',
    title: 'শেয়ার হোল্ডার',
    emoji: '🔵',
    monthlyFee: 3000,
    monthlyLabel: '৳৩,০০০/মাস',
    subBadge: '৩ মাসে ৳৫হাজার',
    titleColor: 'text-blue-950',
    priceColor: 'text-blue-700',
    idleBg: 'bg-blue-50/90 hover:bg-blue-100 border-blue-300',
    activeBg: 'bg-gradient-to-b from-blue-600 via-indigo-600 to-blue-700 text-white border-blue-400 ring-2 ring-blue-400 shadow-md scale-[1.02]',
    badgeIdle: 'bg-blue-200/80 text-blue-900',
    badgeActive: 'bg-white/20 text-blue-100',
  },
  {
    key: 'investor',
    title: 'ইনভেস্টার',
    emoji: '🟢',
    monthlyFee: 2000,
    monthlyLabel: '৳২,০০০/মাস',
    subBadge: '১ম মাস ৳২হাজার',
    titleColor: 'text-emerald-950',
    priceColor: 'text-emerald-700',
    idleBg: 'bg-emerald-50/90 hover:bg-emerald-100 border-emerald-300',
    activeBg: 'bg-gradient-to-b from-emerald-600 via-green-600 to-emerald-700 text-white border-emerald-400 ring-2 ring-emerald-400 shadow-md scale-[1.02]',
    badgeIdle: 'bg-emerald-200/80 text-emerald-900',
    badgeActive: 'bg-white/20 text-emerald-100',
  },
  {
    key: 'supporter',
    title: 'সাপোর্টার',
    emoji: '🟡',
    monthlyFee: 1000,
    monthlyLabel: '৳১,০০০/মাস',
    subBadge: '১ম মাস ৳১হাজার',
    titleColor: 'text-amber-950',
    priceColor: 'text-amber-700',
    idleBg: 'bg-amber-50/90 hover:bg-amber-100 border-amber-300',
    activeBg: 'bg-gradient-to-b from-amber-500 via-yellow-500 to-amber-600 text-white border-amber-400 ring-2 ring-amber-400 shadow-md scale-[1.02]',
    badgeIdle: 'bg-amber-200/80 text-amber-900',
    badgeActive: 'bg-white/20 text-amber-100',
  },
];

const COUNTRIES_LIST = [
  'Bangladesh (বাংলাদেশ)',
  'India (ভারত)',
  'Saudi Arabia (সৌদি আরব)',
  'United Arab Emirates (ইউএই)',
  'Qatar (কাতার)',
  'Oman (ওমান)',
  'Kuwait (কুয়েত)',
  'Malaysia (মালয়েশিয়া)',
  'Singapore (সিঙ্গাপুর)',
  'United Kingdom (যুক্তরাজ্য)',
  'United States (যুক্তরাষ্ট্র)',
  'Canada (কানাডা)',
  'Italy (ইতালি)',
  'Australia (অস্ট্রেলিয়া)',
  'South Africa (দক্ষিণ আফ্রিকা)',
  'Japan (জাপান)',
  'South Korea (দক্ষিণ কোরিয়া)',
  'Other (অন্যান্য দেশ)'
];

const DIVISIONS = [
  'ঢাকা (Dhaka)',
  'চট্টগ্রাম (Chattogram)',
  'রাজশাহী (Rajshahi)',
  'খুলনা (Khulna)',
  'বরিশাল (Barishal)',
  'সিলেট (Sylhet)',
  'রংপুর (Rangpur)',
  'ময়মনসিংহ (Mymensingh)'
];

export default function SamityRequestForm({ user, appConfig, onClose, onSubmitSuccess }: SamityRequestFormProps) {
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState('');
  const [success, setSuccess] = useState(false);

  // Selected Samity Category (must be chosen first)
  const [selectedCategory, setSelectedCategory] = useState<SamityCategoryKey | ''>('');

  // ID Type (NID or Birth Registration) & Number
  const initialIdType: IdentityDocType = !user.nid && !user.nidNumber && user.birthReg ? 'birthReg' : 'nid';
  const [idType, setIdType] = useState<IdentityDocType>(initialIdType);
  const [idNumber, setIdNumber] = useState<string>(
    initialIdType === 'birthReg' ? (user.birthReg || '') : (user.nid || user.nidNumber || '')
  );

  // Profile / Personal fields
  const [country, setCountry] = useState(user.country || 'Bangladesh (বাংলাদেশ)');
  const [fatherName, setFatherName] = useState(user.fatherName || '');
  const [motherName, setMotherName] = useState(user.motherName || '');
  const [dob, setDob] = useState(user.dob || '');
  const [division, setDivision] = useState(user.division || '');
  const [district, setDistrict] = useState(user.district || '');
  const [thana, setThana] = useState(user.thana || '');
  const [postOffice, setPostOffice] = useState(user.postOffice || '');
  const [customRegion, setCustomRegion] = useState('');
  const [agreed, setAgreed] = useState(false);

  // 3 Nominees (1st Mandatory, 2nd & 3rd Optional)
  const buildInitialNominees = (): [NomineeFormEntry, NomineeFormEntry, NomineeFormEntry] => {
    const existing = Array.isArray(user.nominees) ? user.nominees : [];
    const first: NomineeFormEntry = existing[0]
      ? { name: existing[0].name || '', relation: existing[0].relation || '', phone: existing[0].phone || '' }
      : { name: user.nomineeName || '', relation: user.nomineeRelation || '', phone: user.nomineePhone || '' };
    const second: NomineeFormEntry = existing[1]
      ? { name: existing[1].name || '', relation: existing[1].relation || '', phone: existing[1].phone || '' }
      : { name: '', relation: '', phone: '' };
    const third: NomineeFormEntry = existing[2]
      ? { name: existing[2].name || '', relation: existing[2].relation || '', phone: existing[2].phone || '' }
      : { name: '', relation: '', phone: '' };
    return [first, second, third];
  };
  const [nominees, setNominees] = useState<[NomineeFormEntry, NomineeFormEntry, NomineeFormEntry]>(buildInitialNominees);

  const selectedCategoryMeta = SAMITY_CATEGORIES.find((c) => c.key === selectedCategory) || null;
  const currentMainBalance = Number(user.balance !== undefined ? user.balance : user.mainBalance) || 0;
  const requiredFirstMonthAmount = selectedCategoryMeta ? selectedCategoryMeta.monthlyFee : 0;
  const hasInsufficientBalance = requiredFirstMonthAmount > 0 && currentMainBalance < requiredFirstMonthAmount;

  const handleSelectCategory = (cat: (typeof SAMITY_CATEGORIES)[number]) => {
    setSelectedCategory(cat.key);
    setErrorCode('');
  };

  const handleSelectIdType = (nextType: IdentityDocType) => {
    setIdType(nextType);
    if (nextType === 'nid' && !idNumber.trim() && (user.nid || user.nidNumber)) {
      setIdNumber(user.nid || user.nidNumber || '');
    } else if (nextType === 'birthReg' && !idNumber.trim() && user.birthReg) {
      setIdNumber(user.birthReg);
    }
    setErrorCode('');
  };

  const updateNomineeField = (index: 0 | 1 | 2, field: keyof NomineeFormEntry, value: string) => {
    setNominees((prev) => {
      const copy: [NomineeFormEntry, NomineeFormEntry, NomineeFormEntry] = [{ ...prev[0] }, { ...prev[1] }, { ...prev[2] }];
      copy[index][field] = value;
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorCode('');

    if (!selectedCategory || !selectedCategoryMeta) {
      setErrorCode('⚠️ অনুগ্রহ করে প্রথমে উপরের ৪টি ক্যাটাগরি (ওনার ৳৫,০০০ / শেয়ার হোল্ডার ৳৩,০০০ / ইনভেস্টার ৳২,০০০ / সাপোর্টার ৳১,০০০) থেকে একটি সিলেক্ট করুন।');
      return;
    }

    if (!fatherName.trim()) {
      setErrorCode('অনুগ্রহ করে আপনার পিতার নাম সঠিকভাবে প্রদান করুন।');
      return;
    }

    if (!motherName.trim()) {
      setErrorCode('অনুগ্রহ করে আপনার মাতার নাম সঠিকভাবে প্রদান করুন।');
      return;
    }

    const cleanedId = idNumber.trim();
    if (!cleanedId || cleanedId.length < 6) {
      setErrorCode(
        idType === 'nid'
          ? 'অনুগ্রহ করে সঠিক জাতীয় পরিচয়পত্র (NID) নম্বর প্রদান করুন (ন্যূনতম ৬ অক্ষর/সংখ্যা)।'
          : 'অনুগ্রহ করে সঠিক জন্ম নিবন্ধন নম্বর প্রদান করুন (ন্যূনতম ৬ অক্ষর/সংখ্যা)।'
      );
      return;
    }

    if (!dob) {
      setErrorCode('অনুগ্রহ করে আপনার সঠিক জন্ম তারিখ নির্বাচন করুন।');
      return;
    }

    const finalRegion = country.startsWith('Bangladesh') ? division : customRegion;
    if (!finalRegion.trim()) {
      setErrorCode('অনুগ্রহ করে আপনার বিভাগ, স্টেট বা প্রদেশের নাম প্রদান করুন।');
      return;
    }

    if (!district.trim()) {
      setErrorCode('অনুগ্রহ করে আপনার জেলার নাম প্রদান করুন।');
      return;
    }

    if (!thana.trim()) {
      setErrorCode('অনুগ্রহ করে আপনার থানা বা উপজেলার নাম প্রদান করুন।');
      return;
    }

    if (!postOffice.trim()) {
      setErrorCode('অনুগ্রহ করে আপনার পোস্ট অফিস অথবা গ্রামের নাম প্রদান করুন।');
      return;
    }

    // Validate Nominee 1 (Mandatory)
    const nom1 = nominees[0];
    if (!nom1.name.trim()) {
      setErrorCode('নমিনি ১ (বাধ্যতামূলক)-এর নাম প্রদান করুন।');
      return;
    }
    if (!nom1.relation.trim()) {
      setErrorCode('নমিনি ১ (বাধ্যতামূলক)-এর সাথে সম্পর্ক উল্লেখ করুন।');
      return;
    }
    if (!nom1.phone.trim() || nom1.phone.replace(/\D/g, '').length < 7) {
      setErrorCode('নমিনি ১ (বাধ্যতামূলক)-এর সচল মোবাইল নম্বর লিখুন (ন্যূনতম ৭ ডিজিট)।');
      return;
    }

    // Validate Optional Nominees 2 & 3 (only if partially filled)
    const validNominees: MemberNominee[] = [
      {
        id: 'nom_1',
        name: nom1.name.trim(),
        relation: nom1.relation.trim(),
        phone: nom1.phone.trim(),
      }
    ];

    for (let idx = 1; idx <= 2; idx++) {
      const entry = nominees[idx];
      const hasAny = Boolean(entry.name.trim() || entry.relation.trim() || entry.phone.trim());
      if (hasAny) {
        const label = idx === 1 ? 'নমিনি ২' : 'নমিনি ৩';
        if (!entry.name.trim()) {
          setErrorCode(`${label}-এর নাম লিখুন অথবা সব ঘর খালি রাখুন।`);
          return;
        }
        if (!entry.relation.trim()) {
          setErrorCode(`${label}-এর সাথে সম্পর্ক লিখুন অথবা সব ঘর খালি রাখুন।`);
          return;
        }
        if (!entry.phone.trim() || entry.phone.replace(/\D/g, '').length < 7) {
          setErrorCode(`${label}-এর সঠিক মোবাইল নম্বর লিখুন (ন্যূনতম ৭ ডিজিট) অথবা ঘরটি খালি রাখুন।`);
          return;
        }
        validNominees.push({
          id: `nom_${idx + 1}`,
          name: entry.name.trim(),
          relation: entry.relation.trim(),
          phone: entry.phone.trim(),
        });
      }
    }

    if (!agreed) {
      setErrorCode('আবেদন জমা দিতে অবশ্যই নীতিমালার সাথে একমত পোষণ করুন।');
      return;
    }

    const savingsTarget = selectedCategoryMeta.monthlyFee;
    const localMainBalance = Number(user.balance !== undefined ? user.balance : user.mainBalance) || 0;

    if (localMainBalance < savingsTarget) {
      setErrorCode(`⚠️ আপনার মেইন ব্যালেন্সে ${selectedCategoryMeta.title} ক্যাটাগরির ১ম মাসের টাকা বাবদ ৳${savingsTarget.toLocaleString('bn-BD')} টাকা নেই! (বর্তমান ব্যালেন্স: ৳${localMainBalance.toLocaleString('bn-BD')})। আগে মেইন ব্যালেন্সে টাকা অ্যাড মানি করুন, তারপর আবেদন করুন।`);
      return;
    }

    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const appRef = doc(db, 'samity_applications', user.uid);
      const txDocRef = doc(collection(db, 'transactions'));
      const ledgerRef = doc(collection(db, 'wallet_ledger'));
      const userNotifRef = doc(collection(db, 'user_notifications'));
      const nowIso = new Date().toISOString();

      await runTransaction(db, async (transaction) => {
        const latestUserSnap = await transaction.get(userRef);
        const latestUserData = latestUserSnap.exists() ? latestUserSnap.data() : null;

        if (latestUserData?.samityStatus === 'pending') {
          throw new Error('আপনার একটি আবেদন ইতিমধ্যে পর্যালোচনাধীন রয়েছে।');
        }
        if (latestUserData?.samityStatus === 'approved' && latestUserData?.samityApproved === true) {
          throw new Error('আপনি ইতিমধ্যে সমবায় সমিতির অনুমোদিত সদস্য।');
        }

        const userCurrentMainBalance = latestUserData
          ? (Number(latestUserData.balance !== undefined ? latestUserData.balance : latestUserData.mainBalance) || 0)
          : localMainBalance;

        if (userCurrentMainBalance < savingsTarget) {
          throw new Error(`⚠️ আপনার মেইন ব্যালেন্সে ${selectedCategoryMeta.title} ক্যাটাগরির ১ম মাসের টাকা বাবদ ৳${savingsTarget.toLocaleString('bn-BD')} টাকা নেই! (বর্তমান মেইন ব্যালেন্স: ৳${userCurrentMainBalance.toLocaleString('bn-BD')})। আগে মেইন ব্যালেন্সে টাকা অ্যাড মানি করুন।`);
        }

        const newMainBalance = userCurrentMainBalance - savingsTarget;
        const targetSamityStatus = 'pending';

        const identityPayload =
          idType === 'nid'
            ? { idType: 'nid', nid: cleanedId, nidNumber: cleanedId }
            : { idType: 'birthReg', birthReg: cleanedId };

        const updateData: Partial<User> & Record<string, any> = {
          balance: newMainBalance,
          mainBalance: newMainBalance,
          country,
          fatherName: fatherName.trim(),
          motherName: motherName.trim(),
          ...identityPayload,
          dob: dob || user.dob || '',
          division: finalRegion,
          district: district.trim(),
          thana: thana.trim(),
          postOffice: postOffice.trim(),
          nominees: validNominees,
          nomineeName: validNominees[0].name,
          nomineeRelation: validNominees[0].relation || '',
          nomineePhone: validNominees[0].phone || '',
          monthlySavingsTarget: savingsTarget,
          memberCategory: selectedCategory,
          samityRole: selectedCategory,
          samityStatus: targetSamityStatus,
          samityApproved: false,
          isSamityMember: false,
          samityAppliedAt: nowIso,
          samityApplicationInstallmentAmount: savingsTarget,
          samityFirstInstallmentCredited: false,
          hasSetProfile: true,
          updatedAt: nowIso
        };

        const appData = {
          id: user.uid,
          uid: user.uid,
          userId: user.uid,
          name: user.name,
          phone: user.phone,
          memberId: user.memberId || '',
          country,
          fatherName: fatherName.trim(),
          motherName: motherName.trim(),
          ...identityPayload,
          dob: dob || user.dob || '',
          division: finalRegion,
          district: district.trim(),
          thana: thana.trim(),
          postOffice: postOffice.trim(),
          nominees: validNominees,
          nomineeName: validNominees[0].name,
          nomineeRelation: validNominees[0].relation || '',
          nomineePhone: validNominees[0].phone || '',
          monthlySavingsTarget: savingsTarget,
          memberCategory: selectedCategory,
          samityRole: selectedCategory,
          installmentAmount: savingsTarget,
          samityApplicationInstallmentAmount: savingsTarget,
          status: targetSamityStatus,
          samityStatus: targetSamityStatus,
          approved: false,
          samityAppliedAt: nowIso,
          appliedAt: nowIso,
          createdAt: nowIso
        };

        const txData = {
          id: txDocRef.id,
          userId: user.uid,
          userName: user.name,
          userPhone: user.phone,
          memberId: user.memberId || '',
          type: 'samity_deposit',
          typeLabel: `সমবায় আবেদন (${selectedCategoryMeta.title}) - ১ম মাসের টাকা কর্তন`,
          category: 'samity_deposit',
          amount: savingsTarget,
          totalDeducted: savingsTarget,
          beforeBalance: userCurrentMainBalance,
          afterBalance: newMainBalance,
          postBalance: newMainBalance,
          status: 'pending',
          isApproved: false,
          paymentMethod: 'মেইন ব্যালেন্স কর্তন',
          description: `সমবায় সমিতিতে (${selectedCategoryMeta.title}) সদস্যপদ আবেদনের ১ম মাসের ৳${savingsTarget.toLocaleString('bn-BD')} টাকা মেইন ব্যালেন্স থেকে কেটে নেওয়া হয়েছে। এডমিন অনুমোদন দিলে সঞ্চয়ে যুক্ত হবে, বাতিল হলে মেইন ব্যালেন্সে ফেরত আসবে।`,
          createdAt: nowIso,
          date: new Date().toLocaleDateString('en-GB'),
          time: new Date().toLocaleTimeString(),
          receiptNo: `REC-SAMITY-APP-${Date.now()}`
        };

        transaction.set(userRef, updateData, { merge: true });
        transaction.set(appRef, appData, { merge: true });
        transaction.set(txDocRef, txData);
        transaction.set(ledgerRef, {
          id: ledgerRef.id,
          userId: user.uid,
          type: 'DEBIT',
          channel: 'samity_application',
          category: selectedCategory,
          amount: savingsTarget,
          beforeBalance: userCurrentMainBalance,
          afterBalance: newMainBalance,
          description: `Samity 1st month application payment (${selectedCategoryMeta.title})`,
          createdAt: nowIso
        });
        transaction.set(userNotifRef, {
          userId: user.uid,
          title: `🏢 সমবায় আবেদন সাবমিট (${selectedCategoryMeta.title})`,
          message: `আপনার সমবায় সমিতির (${selectedCategoryMeta.title}) আবেদনটি সফলভাবে জমা হয়েছে এবং ১ম মাসের ৳${savingsTarget.toLocaleString('bn-BD')} মেইন ব্যালেন্স থেকে কেটে নেওয়া হয়েছে। এডমিন অনুমোদনের অপেক্ষায় আছে।`,
          type: 'samity_applied',
          read: false,
          createdAt: nowIso
        });
      });

      addDoc(collection(db, 'admin_notifications'), {
        type: 'samity_membership_application',
        title: `🏢 নতুন সমবায় আবেদন (${selectedCategoryMeta.title})!`,
        message: `${user.name} (${user.memberId || user.phone}) ${selectedCategoryMeta.title} ক্যাটাগরিতে সমবায় সমিতির জন্য আবেদন করেছেন। ১ম মাসের ৳${savingsTarget.toLocaleString('bn-BD')} মেইন ব্যালেন্স থেকে কেটে রাখা হয়েছে।`,
        userId: user.uid,
        userName: user.name,
        memberId: user.memberId || '',
        memberCategory: selectedCategory,
        read: false,
        createdAt: nowIso
      }).catch(e => console.warn("Admin notification warning:", e));

      setSuccess(true);
      setTimeout(() => {
        onSubmitSuccess();
      }, 1000);
    } catch (err: any) {
      console.error('Error submitting Samity request form:', err);
      setErrorCode(err?.message || 'আবেদনটি ডাটাবেজে রেকর্ড করা যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xl mt-4 sm:mt-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-700 p-5 text-white text-left relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-6 w-32 h-32 bg-white/5 rounded-full blur-xl pointer-events-none" />
        <button
          type="button"
          onClick={onClose}
          className="mb-3 flex items-center gap-1.5 text-xs text-emerald-100 hover:text-white transition bg-emerald-900/40 px-2.5 py-1 rounded-lg cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          ফিরে যান
        </button>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-white/15 rounded-2xl flex items-center justify-center text-white shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight leading-tight">সমিতি সদস্যপদ আবেদন ফরম</h1>
            <p className="text-[10.5px] text-emerald-100 mt-0.5 font-medium font-sans">
              ক্যাটাগরি নির্বাচন ও প্রয়োজনীয় তথ্য পূরণ করে অনলাইন সদস্যপদের আবেদন সম্পন্ন করুন
            </p>
          </div>
        </div>
      </div>

      {success ? (
        <div className="p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mx-auto animate-bounce">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h2 className="text-base font-black text-slate-800">আবেদন সফলভাবে সাবমিট হয়েছে!</h2>
          <p className="text-[11px] text-slate-500 max-w-md mx-auto leading-relaxed">
            আপনার সমিতির সদস্যপদ আবেদনটি এডমিন অফিসে পাঠানো হয়েছে। এডমিন প্যানেল আপনার প্রোফাইল তথ্য ভেরিফাই করার পর এটি অনুমোদন করবে। অনুগ্রহ করে অপেক্ষা করুন।
          </p>
          <div className="w-16 h-1 bg-emerald-500 rounded mx-auto mt-4 animate-pulse" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 text-left">
          {/* Top 4 Samity Categories Selector */}
          <div className="bg-slate-50 border-2 border-emerald-200/90 rounded-2xl p-2.5 space-y-2 shadow-xs">
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-[11px] font-black text-emerald-950">
                ১. সমবায় সমিতির ক্যাটাগরি নির্বাচন করুন <span className="text-rose-600">*</span>
              </span>
              <span className="text-[9.5px] font-bold text-slate-500">
                মেইন ব্যালেন্স: <strong className="font-mono text-emerald-700">৳{currentMainBalance.toLocaleString('bn-BD')}</strong>
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {SAMITY_CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => handleSelectCategory(cat)}
                    className={`py-2 px-1 rounded-xl border transition-all flex flex-col items-center justify-center text-center cursor-pointer relative min-h-[68px] active:scale-95 ${
                      isActive ? cat.activeBg : cat.idleBg
                    }`}
                  >
                    <span className={`text-[9.5px] sm:text-[11px] font-black leading-tight flex items-center justify-center gap-0.5 ${isActive ? 'text-white' : cat.titleColor}`}>
                      <span>{cat.emoji}</span>
                      <span className="truncate">{cat.title}</span>
                    </span>
                    <span className={`text-[8.5px] sm:text-[9.5px] font-black mt-1 block font-mono ${isActive ? 'text-white' : cat.priceColor}`}>
                      {cat.monthlyLabel}
                    </span>
                    <span className={`text-[7px] sm:text-[7.5px] font-extrabold px-1 py-0.5 rounded mt-1 leading-none ${isActive ? cat.badgeActive : cat.badgeIdle}`}>
                      {isActive ? '✓ নির্বাচিত' : cat.subBadge}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedCategoryMeta ? (
              <div className={`px-3 py-2 rounded-xl border text-[10.5px] font-bold leading-snug ${
                hasInsufficientBalance
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}>
                {hasInsufficientBalance ? (
                  <>
                    ⚠️ আপনি <strong>{selectedCategoryMeta.title} ({selectedCategoryMeta.monthlyLabel})</strong> সিলেক্ট করেছেন। আবেদন করতে মেইন ব্যালেন্সে কমপক্ষে <strong>৳{requiredFirstMonthAmount.toLocaleString('bn-BD')}</strong> থাকতে হবে (আরও অ্যাড মানি প্রয়োজন: <strong>৳{(requiredFirstMonthAmount - currentMainBalance).toLocaleString('bn-BD')}</strong>)।
                  </>
                ) : (
                  <>
                    ✅ নির্বাচিত ক্যাটাগরি: <strong>{selectedCategoryMeta.title}</strong> — ফর্ম সাবমিট করলে ১ম মাসের <strong>৳{requiredFirstMonthAmount.toLocaleString('bn-BD')}</strong> আপনার মেইন ব্যালেন্স থেকে কেটে নেওয়া হবে।
                  </>
                )}
              </div>
            ) : (
              <div className="px-3 py-2 rounded-xl border border-amber-200 bg-amber-50/90 text-[10.5px] font-bold text-amber-900 leading-snug">
                👆 অনুগ্রহ করে প্রথমে উপরের ৪টি ক্যাটাগরি থেকে একটি নির্বাচন করুন। নির্বাচিত ক্যাটাগরির ১ম মাসের টাকা সাবমিটের সময় মেইন ব্যালেন্স থেকে কেটে নেওয়া হবে।
              </div>
            )}
          </div>

          {errorCode && (
            <div className="bg-rose-50 text-rose-700 border border-rose-200 p-3 rounded-2xl text-[11px] font-bold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorCode}</span>
            </div>
          )}

          {appConfig.samityTerms && (
            <div className="bg-emerald-50/60 text-slate-800 border border-emerald-200/70 p-3 rounded-2xl text-[10.5px] font-medium leading-relaxed space-y-1">
              <span className="text-emerald-900 font-extrabold flex items-center gap-1.5 text-[11px]">
                📢 ভর্তি নিয়মাবলী ও নির্দেশাবলীঃ
              </span>
              <p className="text-slate-700 font-semibold">{appConfig.samityTerms}</p>
            </div>
          )}

          {/* Section A: Verified Base Identity (Compact) */}
          <div className="space-y-2.5 bg-slate-50/80 border border-slate-200 p-3.5 rounded-2xl">
            <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
              <UserIcon className="w-3.5 h-3.5 text-slate-500" /> প্রাথমিক প্রোফাইল তথ্য (স্থায়ী)
            </h3>

            <div className="grid grid-cols-2 gap-2.5 text-[11px] font-sans">
              <div>
                <span className="text-slate-400 font-semibold block text-[10px]">সদস্যের নাম:</span>
                <div className="text-slate-800 font-bold bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 mt-0.5 truncate">
                  {user.name}
                </div>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block text-[10px]">মোবাইল নম্বর:</span>
                <div className="text-slate-800 font-bold bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 mt-0.5 font-mono truncate">
                  {user.phone}
                </div>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block text-[10px]">সদস্য আইডি:</span>
                <div className="text-emerald-800 font-black bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 mt-0.5 font-mono truncate">
                  {user.memberId || 'নতুন আবেদন'}
                </div>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block text-[10px]">অ্যাকাউন্ট রোল:</span>
                <div className="text-slate-700 font-semibold bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 mt-0.5 truncate">
                  {user.role === 'admin' ? 'এডমিন (BNB Admin)' : 'প্রিমিয়াম সদস্য'}
                </div>
              </div>
            </div>
          </div>

          {/* Section B: Personal, Identity Doc (NID / Birth Reg) & Address */}
          <div className="space-y-3 bg-white border border-slate-200 p-3.5 rounded-2xl">
            <h3 className="text-[11px] font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-indigo-100 pb-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-600" /> ২. ব্যক্তিগত তথ্য, পরিচয়পত্র ও ঠিকানা
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] font-sans">
              {/* Country */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">বসবাসকারী দেশ <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <select
                    value={country}
                    onChange={(e) => {
                      setCountry(e.target.value);
                      if (!e.target.value.startsWith('Bangladesh')) {
                        setDivision('');
                      }
                    }}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 transition-all"
                  >
                    {COUNTRIES_LIST.map((countryName) => (
                      <option key={countryName} value={countryName}>{countryName}</option>
                    ))}
                  </select>
                  <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Date of Birth */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">জন্ম তারিখ (Date of Birth) <span className="text-rose-500">*</span></label>
                <input
                  type="date"
                  required
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 transition-all font-mono"
                />
              </div>

              {/* Father's Name */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">পিতার নাম <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="পিতার নাম লিখুন"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* Mother's Name */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">মাতার নাম <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="মাতার নাম লিখুন"
                  value={motherName}
                  onChange={(e) => setMotherName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* Identity Document Selector: NID OR Birth Registration */}
              <div className="sm:col-span-2 bg-slate-50/90 border border-emerald-200 rounded-2xl p-3 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <label className="text-slate-800 font-extrabold text-[11px] flex items-center gap-1.5">
                    <IdCard className="w-3.5 h-3.5 text-emerald-700" />
                    পরিচয়পত্র নির্বাচন করুন (যেকোনো একটি আবশ্যক) <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 bg-white p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => handleSelectIdType('nid')}
                      className={`px-2.5 py-1.5 rounded-lg text-[10.5px] font-black transition-all cursor-pointer ${
                        idType === 'nid'
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      🪪 এনআইডি (NID)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectIdType('birthReg')}
                      className={`px-2.5 py-1.5 rounded-lg text-[10.5px] font-black transition-all cursor-pointer ${
                        idType === 'birthReg'
                          ? 'bg-emerald-700 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      📜 জন্ম নিবন্ধন
                    </button>
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    required
                    placeholder={
                      idType === 'nid'
                        ? 'আপনার জাতীয় পরিচয়পত্র (NID) নম্বর লিখুন'
                        : 'আপনার ১৭ ডিজিটের জন্ম নিবন্ধন নম্বর লিখুন'
                    }
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 placeholder-slate-400 transition-all"
                  />
                </div>
              </div>

              {/* Division / Custom Region */}
              {country.startsWith('Bangladesh') ? (
                <div>
                  <label className="text-slate-600 font-bold block mb-1">বিভাগ (Division) <span className="text-rose-500">*</span></label>
                  <select
                    value={division}
                    required
                    onChange={(e) => setDivision(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 transition-all"
                  >
                    <option value="">-- বিভাগ নির্বাচন করুন --</option>
                    {DIVISIONS.map((div) => (
                      <option key={div} value={div}>{div}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-slate-600 font-bold block mb-1">স্টেট / প্রদেশ <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="উদাঃ মক্কা, কুয়ালালামপুর"
                    value={customRegion}
                    onChange={(e) => setCustomRegion(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                  />
                </div>
              )}

              {/* District */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">জেলা (District) <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="আপনার জেলার নাম লিখুন"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* Thana */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">থানা / উপজেলা <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="থানা বা উপজেলার নাম লিখুন"
                  value={thana}
                  onChange={(e) => setThana(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* Post Office / Village */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">পোস্ট অফিস / গ্রাম <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="পোস্ট অফিস বা গ্রামের নাম"
                  value={postOffice}
                  onChange={(e) => setPostOffice(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Section C: 3 Nominees (1 Mandatory, 2 & 3 Optional) */}
          <div className="space-y-2.5 bg-white border border-slate-200 p-3.5 rounded-2xl">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
              <h3 className="text-[11px] font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-700" /> ৩. নমিনি তথ্য (সর্বনিম্ন ১ জন বাধ্যতামূলক, সর্বোচ্চ ৩ জন)
              </h3>
            </div>

            <div className="space-y-2.5">
              {[0, 1, 2].map((idx) => {
                const nomIdx = idx as 0 | 1 | 2;
                const isRequired = nomIdx === 0;
                const entry = nominees[nomIdx];
                return (
                  <div
                    key={nomIdx}
                    className={`p-2.5 rounded-xl border ${
                      isRequired
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : 'bg-slate-50/70 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10.5px] font-black text-slate-800">
                        নমিনি {nomIdx === 0 ? '১' : nomIdx === 1 ? '২' : '৩'}
                      </span>
                      <span
                        className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                          isRequired
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-200/80 text-slate-600'
                        }`}
                      >
                        {isRequired ? 'বাধ্যতামূলক *' : 'ঐচ্ছিক (চাইলে স্কিপ করুন)'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                      <input
                        type="text"
                        required={isRequired}
                        placeholder={isRequired ? 'নমিনির নাম *' : 'নমিনির নাম (ঐচ্ছিক)'}
                        value={entry.name}
                        onChange={(e) => updateNomineeField(nomIdx, 'name', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 placeholder-slate-400"
                      />
                      <input
                        type="text"
                        required={isRequired}
                        placeholder={isRequired ? 'সম্পর্ক (যেমন: স্ত্রী, মাতা) *' : 'সম্পর্ক (ঐচ্ছিক)'}
                        value={entry.relation}
                        onChange={(e) => updateNomineeField(nomIdx, 'relation', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 placeholder-slate-400"
                      />
                      <input
                        type="text"
                        required={isRequired}
                        placeholder={isRequired ? 'মোবাইল নম্বর *' : 'মোবাইল নম্বর (ঐচ্ছিক)'}
                        value={entry.phone}
                        onChange={(e) => updateNomineeField(nomIdx, 'phone', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 placeholder-slate-400"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Compact Balance & 1st Month Summary Box */}
          <div className={`p-3 rounded-2xl border text-[11px] space-y-1 ${
            hasInsufficientBalance
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : selectedCategoryMeta
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <div className="flex items-center justify-between font-bold">
              <span>আপনার বর্তমান মেইন ব্যালেন্স:</span>
              <span className="font-mono font-black text-xs">৳{currentMainBalance.toLocaleString('bn-BD')}</span>
            </div>
            {selectedCategoryMeta && (
              <div className="flex items-center justify-between font-bold border-t border-current/10 pt-1">
                <span>নির্বাচিত ক্যাটাগরি ({selectedCategoryMeta.emoji} {selectedCategoryMeta.title}):</span>
                <span className="font-mono font-black text-xs">১ম মাস ৳{requiredFirstMonthAmount.toLocaleString('bn-BD')}</span>
              </div>
            )}
            {hasInsufficientBalance ? (
              <p className="text-[10.5px] font-bold text-rose-700 pt-0.5 leading-snug">
                ⚠️ মেইন ব্যালেন্সে পর্যাপ্ত টাকা নেই! আবেদন সাবমিটের আগে কমপক্ষে ৳{(requiredFirstMonthAmount - currentMainBalance).toLocaleString('bn-BD')} টাকা অ্যাড মানি করুন।
              </p>
            ) : selectedCategoryMeta ? (
              <p className="text-[10.5px] font-semibold text-emerald-800 pt-0.5 leading-snug">
                ✅ সাবমিট করলে ১ম মাসের ৳{requiredFirstMonthAmount.toLocaleString('bn-BD')} মেইন ব্যালেন্স থেকে কেটে নেওয়া হবে।
              </p>
            ) : (
              <p className="text-[10.5px] text-slate-600 pt-0.5 leading-snug">
                📌 ফর্মের উপরে থাকা ৪টি ক্যাটাগরি থেকে একটি নির্বাচন করে আবেদন সম্পন্ন করুন।
              </p>
            )}
          </div>

          {/* Agreement Checkbox */}
          <label className="flex items-start gap-2.5 cursor-pointer select-none px-1">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="w-4 h-4 bg-slate-100 border border-slate-200 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 mt-0.5 shrink-0"
            />
            <span className="text-[10px] text-slate-500 leading-normal font-sans">
              আমি ঘোষণা করছি যে উপরে প্রদত্ত আমার সকল তথ্য সম্পূর্ণ সঠিক ও নিখুঁত। আমি সমবায়ের অনলাইন সেবার সদস্যপদ নিতে ইচ্ছুক এবং সমিতির যাবতীয় নিয়ম-কানুন ও নীতিমালা মেনে চলতে সর্বদা দায়বদ্ধ থাকবো।
            </span>
          </label>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="sm:w-1/3 px-4 py-2.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 active:scale-98 transition text-center cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={loading}
              className="sm:w-2/3 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold text-xs hover:from-emerald-700 hover:to-teal-700 active:scale-98 transition flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-100 cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  প্রক্রিয়াধীন...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  আবেদন করুন (Submit Application)
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
