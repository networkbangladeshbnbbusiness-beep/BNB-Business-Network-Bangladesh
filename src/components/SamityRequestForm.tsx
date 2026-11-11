import React, { useState } from 'react';
import { User, AppConfig } from '../types';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, setDoc, addDoc, collection } from 'firebase/firestore';
import { 
  Building2, 
  ArrowLeft, 
  User as UserIcon, 
  Phone, 
  CreditCard, 
  MapPin, 
  Calendar, 
  ShieldAlert, 
  CheckCircle2, 
  Send,
  FileText,
  Globe
} from 'lucide-react';
import { motion } from 'motion/react';

interface SamityRequestFormProps {
  user: User;
  appConfig: AppConfig;
  onClose: () => void;
  onSubmitSuccess: () => void;
}

export default function SamityRequestForm({ user, appConfig, onClose, onSubmitSuccess }: SamityRequestFormProps) {
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState('');
  const [success, setSuccess] = useState(false);

  // Form states initialized with existing profile values
  const [country, setCountry] = useState(user.country || 'Bangladesh');
  const [fatherName, setFatherName] = useState(user.fatherName || '');
  const [motherName, setMotherName] = useState(user.motherName || '');
  const [nid, setNid] = useState(user.nid || '');
  const [dob, setDob] = useState(user.dob || '');
  const [division, setDivision] = useState(user.division || '');
  const [district, setDistrict] = useState(user.district || '');
  const [thana, setThana] = useState(user.thana || '');
  const [postOffice, setPostOffice] = useState(user.postOffice || '');
  const [customRegion, setCustomRegion] = useState('');
  const [nomineeName, setNomineeName] = useState(user.nomineeName || '');
  const [nomineeRelation, setNomineeRelation] = useState(user.nomineeRelation || '');
  const [nomineePhone, setNomineePhone] = useState(user.nomineePhone || '');
  const [agreed, setAgreed] = useState(false);

  // Desired monthly savings rates states (minimum 500 BDT)
  const [monthlySavingsOption, setMonthlySavingsOption] = useState<string>('');
  const [customSavingsAmount, setCustomSavingsAmount] = useState<string>('');

  const parseAmountInput = (raw: string): number => {
    const normalized = String(raw || '')
      .replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)))
      .replace(/[^0-9]/g, '');
    return parseInt(normalized, 10) || 0;
  };

  const currentMainBalance = Number(user.balance !== undefined ? user.balance : user.mainBalance) || 0;
  const selectedMonthlyAmount =
    monthlySavingsOption === 'custom'
      ? parseAmountInput(customSavingsAmount)
      : parseInt(monthlySavingsOption, 10) || 0;
  const hasInsufficientBalance = selectedMonthlyAmount > 0 && currentMainBalance < selectedMonthlyAmount;

  // Countries List for Global Citizens
  const countriesList = [
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

  // Division Options for Bangladesh
  const divisions = [
    'ঢাকা (Dhaka)',
    'চট্টগ্রাম (Chattogram)',
    'রাজশাহী (Rajshahi)',
    'খুলনা (Khulna)',
    'বরিশাল (Barishal)',
    'সিলেট (Sylhet)',
    'রংপুর (Rangpur)',
    'ময়মনসিংহ (Mymensingh)'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorCode('');

    if (!agreed) {
      setErrorCode('আবেদন জমা দিতে অবশ্যই নীতিমালার সাথে একমত পোষণ করুন।');
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

    if (!nid.trim() || nid.trim().length < 6) {
      setErrorCode('অনুগ্রহ করে সঠিক জাতীয় পরিচয়পত্র (NID), পাসপোর্ট অথবা জন্ম নিবন্ধন নম্বর প্রদান করুন।');
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

    if (!nomineeName.trim()) {
      setErrorCode('অনুগ্রহ করে আপনার মনোনীত নমিনির নাম প্রদান করুন।');
      return;
    }

    if (!nomineeRelation.trim()) {
      setErrorCode('অনুগ্রহ করে নমিনির সাথে সম্পর্ক প্রদান করুন (যেমন: পিতা, মাতা, স্ত্রী, ভাই)।');
      return;
    }

    if (!nomineePhone.trim() || nomineePhone.replace(/\D/g, '').length < 7) {
      setErrorCode('সঠিক নমিনির সচল মোবাইল নম্বর লিখুন (ন্যূনতম ৭ ডিজিট)।');
      return;
    }

    if (!monthlySavingsOption) {
      setErrorCode('অনুগ্রহ করে আপনি প্রতি মাসে কত টাকা ডিপোজিট / ইনভেস্ট করবেন তা নির্বাচন করুন।');
      return;
    }

    let savingsTarget = 500;
    let selectedCategory: 'owner' | 'shareholder' | 'investor' | 'supporter' | 'regular' = 'supporter';

    if (monthlySavingsOption === 'custom') {
      const parsedAmt = parseAmountInput(customSavingsAmount);
      if (!parsedAmt || parsedAmt < 500) {
        setErrorCode('⚠️ সর্বনিম্ন ইনভেস্টমেন্ট ৳৫০০ টাকা! অনুগ্রহ করে কমপক্ষে ৫০০ টাকা বা তার বেশি সংখ্যায় লিখুন।');
        return;
      }
      savingsTarget = parsedAmt;
    } else {
      savingsTarget = parseInt(monthlySavingsOption, 10);
      if (isNaN(savingsTarget) || savingsTarget < 500) {
        setErrorCode('⚠️ সর্বনিম্ন ইনভেস্টমেন্ট ৳৫০০ টাকা হতে হবে।');
        return;
      }
    }

    if (savingsTarget >= 5000) selectedCategory = 'owner';
    else if (savingsTarget >= 3000) selectedCategory = 'shareholder';
    else if (savingsTarget >= 2000) selectedCategory = 'investor';
    else if (savingsTarget >= 1000) selectedCategory = 'supporter';
    else selectedCategory = 'supporter';

    const requiredFirstMonthAmount = savingsTarget;
    const localMainBalance = Number(user.balance !== undefined ? user.balance : user.mainBalance) || 0;

    if (localMainBalance < requiredFirstMonthAmount) {
      setErrorCode(`⚠️ আপনার মেইন ব্যালেন্সে ১ম মাসের ইনভেস্টমেন্ট বাবদ ৳${requiredFirstMonthAmount.toLocaleString('bn-BD')} টাকা নেই! (আপনার বর্তমান মেইন ব্যালেন্স: ৳${localMainBalance.toLocaleString('bn-BD')})। আপনি যে পরিমাণ মাসিক ইনভেস্টমেন্ট সিলেক্ট করবেন, আবেদন করার সময় আপনার মেইন ব্যালেন্সে কমপক্ষে সেই পরিমাণ টাকা থাকতে হবে।`);
      return;
    }

    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const latestUserSnap = await getDoc(userRef);
      const latestUserData = latestUserSnap.exists() ? latestUserSnap.data() : null;
      const userCurrentMainBalance = latestUserData
        ? (Number(latestUserData.balance !== undefined ? latestUserData.balance : latestUserData.mainBalance) || 0)
        : localMainBalance;

      if (userCurrentMainBalance < requiredFirstMonthAmount) {
        setErrorCode(`⚠️ আপনার মেইন ব্যালেন্সে ১ম মাসের ইনভেস্টমেন্ট বাবদ ৳${requiredFirstMonthAmount.toLocaleString('bn-BD')} টাকা নেই! (আপনার বর্তমান মেইন ব্যালেন্স: ৳${userCurrentMainBalance.toLocaleString('bn-BD')})। প্রথম মাসের ইনভেস্টমেন্ট মেইন ব্যালেন্স থেকে পরিশোধ করে আবেদন করতে হবে।`);
        setLoading(false);
        return;
      }

      const appRef = doc(db, 'samity_applications', user.uid);
      const nowIso = new Date().toISOString();
      
      const newMainBalance = userCurrentMainBalance - requiredFirstMonthAmount;
      const targetSamityStatus = 'pending';

      const updateData: Partial<User> & Record<string, any> = {
        balance: newMainBalance,
        mainBalance: newMainBalance,
        country: country,
        fatherName: fatherName.trim(),
        motherName: motherName.trim(),
        nid: nid.trim(),
        dob: dob || user.dob || '',
        division: finalRegion,
        district: district.trim(),
        thana: thana.trim(),
        postOffice: postOffice.trim(),
        nomineeName: nomineeName.trim(),
        nomineeRelation: nomineeRelation.trim(),
        nomineePhone: nomineePhone.trim(),
        monthlySavingsTarget: savingsTarget,
        memberCategory: selectedCategory,
        samityStatus: targetSamityStatus,
        samityApproved: false,
        isSamityMember: false,
        samityAppliedAt: nowIso,
        samityApplicationInstallmentAmount: requiredFirstMonthAmount,
        samityFirstInstallmentCredited: false,
        hasSetProfile: true
      };

      const appData = {
        id: user.uid,
        uid: user.uid,
        userId: user.uid,
        name: user.name,
        phone: user.phone,
        memberId: user.memberId || '',
        country: country,
        fatherName: fatherName.trim(),
        motherName: motherName.trim(),
        nid: nid.trim(),
        dob: dob || user.dob || '',
        division: finalRegion,
        district: district.trim(),
        thana: thana.trim(),
        postOffice: postOffice.trim(),
        nomineeName: nomineeName.trim(),
        nomineeRelation: nomineeRelation.trim(),
        nomineePhone: nomineePhone.trim(),
        monthlySavingsTarget: savingsTarget,
        memberCategory: selectedCategory,
        installmentAmount: requiredFirstMonthAmount,
        status: targetSamityStatus,
        samityStatus: targetSamityStatus,
        approved: false,
        samityAppliedAt: nowIso,
        appliedAt: nowIso,
        createdAt: nowIso
      };

      const txDocRef = doc(collection(db, 'transactions'));
      const txData = {
        id: txDocRef.id,
        userId: user.uid,
        userName: user.name,
        userPhone: user.phone,
        memberId: user.memberId || '',
        type: 'deposit',
        typeLabel: 'BNB কোম্পানি ইনভেস্টর ১ম মাসের ইনভেস্টমেন্ট (রিভিউ পেন্ডিং)',
        category: 'samity_deposit',
        amount: requiredFirstMonthAmount,
        status: 'pending',
        isApproved: false,
        paymentMethod: 'মেইন ব্যালেন্স কর্তন',
        description: `BNB কোম্পানি ইনভেস্টর সদস্যপদ আবেদনের ১ম মাসের ইনভেস্টমেন্ট ৳${requiredFirstMonthAmount.toLocaleString('bn-BD')} মেইন ব্যালেন্স থেকে কেটে জমা রাখা হয়েছে। এডমিন প্যানেল অনুমোদন দিলে ইনভেস্টমেন্ট ব্যালেন্সে যুক্ত হবে, বাতিল হলে মেইন ব্যালেন্সে রিফান্ড হবে।`,
        createdAt: nowIso,
        date: new Date().toLocaleDateString('en-GB'),
        time: new Date().toLocaleTimeString(),
        receiptNo: `REC-SAMITY-APP-${Date.now()}`
      };

      await Promise.all([
        setDoc(userRef, updateData, { merge: true }),
        setDoc(appRef, appData, { merge: true }),
        setDoc(txDocRef, txData)
      ]);

      // Async background notification for admin review
      addDoc(collection(db, 'admin_notifications'), {
        type: 'samity_membership_application',
        title: '🏢 নতুন BNB কোম্পানি ইনভেস্টর আবেদন!',
        message: `${user.name} (${user.memberId || user.phone}) BNB কোম্পানি ইনভেস্টর সদস্যপদের জন্য আবেদন করেছেন। (মাসিক ও ১ম মাসের ইনভেস্টমেন্ট: ৳${savingsTarget.toLocaleString('bn-BD')} BDT)`,
        userId: user.uid,
        userName: user.name,
        memberId: user.memberId || '',
        read: false,
        createdAt: nowIso
      }).catch(e => console.warn("Admin notification warning:", e));

      setSuccess(true);
      setTimeout(() => {
        onSubmitSuccess();
      }, 1000);
    } catch (err) {
      console.error('Error submitting Samity request form:', err);
      setErrorCode('আবেদনটি ডাটাবেজে রেকর্ড করা যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-slate-150 overflow-hidden shadow-xl mt-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-750 p-6 text-white text-left relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-6 w-32 h-32 bg-white/5 rounded-full blur-xl pointer-events-none" />
        <button 
          onClick={onClose}
          className="mb-4 flex items-center gap-1.5 text-xs text-emerald-100 hover:text-white transition bg-emerald-900/40 p-2 py-1 rounded-lg"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          ফিরে যান
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight leading-tight">সমিতি সদস্যপদ আবেদন ফরম</h1>
            <p className="text-[10.5px] text-emerald-150 mt-1 font-medium font-sans">বিশ্বের যে কোনো প্রান্ত থেকে সঞ্চয়, কিস্তি ও ঋণের অনলাইন সুবিধার জন্য সদস্যপদের প্রস্তাবনা</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-left">
          {errorCode && (
            <div className="bg-rose-50 text-rose-750 border border-rose-100 p-3.5 rounded-2xl text-[11px] font-bold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-650 shrink-0" />
              {errorCode}
            </div>
          )}

          {appConfig.samityTerms && (
            <div className="bg-emerald-50/50 text-slate-800 border border-emerald-200/60 p-4 rounded-2.5xl text-[10.5px] font-medium leading-relaxed space-y-2 shadow-xs">
              <span className="text-emerald-900 font-extrabold flex items-center gap-1.5 text-xs">
                📢 ভর্তি নিয়মাবলী ও নির্দেশাবলীঃ
              </span>
              <p className="text-slate-700 font-bold">{appConfig.samityTerms}</p>
            </div>
          )}

          {/* Section A: Verified Base Identity */}
          <div className="space-y-3 bg-slate-50/70 border border-slate-150 p-4 rounded-2.5xl">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
              <UserIcon className="w-3.5 h-3.5 text-slate-400" /> 1. প্রাথমিক প্রোফাইল তথ্য (স্থায়ী ও অপরিবর্তনশীল)
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-[11px] font-sans">
              <div>
                <label className="text-slate-450 font-semibold block">সদস্যের নাম (Full Name):</label>
                <div className="text-slate-800 font-bold bg-white border border-slate-200 rounded-xl px-3 py-2 mt-1 block">
                  {user.name}
                </div>
              </div>

              <div>
                <label className="text-slate-450 font-semibold block">মোবাইল নম্বর (Phone No):</label>
                <div className="text-slate-800 font-bold bg-white border border-slate-200 rounded-xl px-3 py-2 mt-1 font-mono">
                  {user.phone}
                </div>
              </div>

              <div>
                <label className="text-slate-450 font-semibold block">সদস্য আইডি (Member ID):</label>
                <div className="text-emerald-800 font-black bg-white border border-slate-200 rounded-xl px-3 py-2 mt-1 font-mono">
                  {user.memberId}
                </div>
              </div>

              <div>
                <label className="text-slate-450 font-semibold block">অ্যাকাউন্ট রোল (Account Role):</label>
                <div className="text-slate-700 font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2 mt-1 capitalize">
                  {user.role === 'admin' ? 'এডমিন (BNB Admin)' : 'প্রিমিয়াম সদস্য'}
                </div>
              </div>
            </div>
            <p className="text-[9px] text-slate-400 italic">
              * নাম এবং মোবাইল নম্বর পরিবর্তন করতে হেল্পডেস্কে সরাসরি যোগাযোগ করুন।
            </p>
          </div>

          {/* Section B: Editable Fields */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-indigo-100 pb-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-600" /> 2. অতিরিক্ত সমবায় তথ্যাদি প্রদান (সারা বিশ্ব থেকে গ্রহণযোগ্য)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px] font-sans">
              
              {/* Country Selection Field */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">বসবাসকারী দেশ (Country) <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <select
                    value={country}
                    onChange={(e) => {
                      setCountry(e.target.value);
                      if (!e.target.value.startsWith('Bangladesh')) {
                        setDivision('');
                      }
                    }}
                    className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 transition-all appearance-none"
                  >
                    {countriesList.map((countryName) => (
                      <option key={countryName} value={countryName}>{countryName}</option>
                    ))}
                  </select>
                  <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* Father's Name */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">পিতার নাম (Father's Name) <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="পিতার নাম লিখুন"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* Mother's Name */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">মাতার নাম (Mother's Name) <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="মাতার নাম লিখুন"
                  value={motherName}
                  onChange={(e) => setMotherName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* NID / Passport Field */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">জাতীয় পরিচয়পত্র / পাসপোর্ট নম্বর <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="NID অথবা Passport নম্বর লিখুন"
                  value={nid}
                  onChange={(e) => setNid(e.target.value)} // Don't restrict to digits so global passports work
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* Date of Birth */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">জন্ম তারিখ (Date of Birth)</label>
                <input
                  type="date"
                  placeholder="DD-MM-YYYY"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 transition-all font-mono"
                />
              </div>

              {/* Division/State Field */}
              {country.startsWith('Bangladesh') ? (
                <div>
                  <label className="text-slate-600 font-bold block mb-1">বিভাগ (Division) <span className="text-rose-500">*</span></label>
                  <select
                    value={division}
                    required
                    onChange={(e) => setDivision(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 transition-all"
                  >
                    <option value="">-- বিভাগ নির্বাচন করুন --</option>
                    {divisions.map((div) => (
                      <option key={div} value={div}>{div}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-slate-600 font-bold block mb-1">স্টেট / প্রদেশ / অঞ্চল (State / Province / Region) <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="উদাঃ মক্কা, কুয়ালালামপুর, কুইন্স"
                    value={customRegion}
                    onChange={(e) => setCustomRegion(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                  />
                </div>
              )}

              {/* District Field */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">জেলা (District) <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="আপনার জেলার নাম লিখুন"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* Thana / Upazila Field */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">থানা / উপজেলা (Thana / Upazila) <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="আপনার থানা বা উপজেলার নাম লিখুন"
                  value={thana}
                  onChange={(e) => setThana(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* Post Office or Village Field */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">পোস্ট অফিস অথবা গ্রাম (Post Office / Village) <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="আপনার পোস্ট অফিস বা গ্রামের নাম লিখুন"
                  value={postOffice}
                  onChange={(e) => setPostOffice(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* Nominee Name */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">নমিনির নাম (Nominee Name) <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="উদাঃ মোসাম্মৎ কুলসুম"
                  value={nomineeName}
                  onChange={(e) => setNomineeName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* Nominee Relation */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">নমিনির সাথে সম্পর্ক <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="উদাঃ মাতা, স্ত্রী, পিতা, পুত্র"
                  value={nomineeRelation}
                  onChange={(e) => setNomineeRelation(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* Nominee Phone */}
              <div>
                <label className="text-slate-600 font-bold block mb-1">নমিনির সচল মোবাইল নম্বর <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="উদাঃ +8801712345678"
                  value={nomineePhone}
                  onChange={(e) => setNomineePhone(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* Monthly Savings / Investment Target Choice */}
              <div className="sm:col-span-2 space-y-2.5">
                <label className="text-slate-700 font-extrabold block mb-1">
                  প্রতি মাসে কত টাকা ডিপোজিট / ইনভেস্ট করবেন নির্বাচন করুন (সর্বনিম্ন ইনভেস্ট ৳৫০০ টাকা — ১ম মাসের ইনভেস্টমেন্ট মেইন ব্যালেন্সে থাকতে হবে) <span className="text-rose-500">*</span>
                </label>

                {/* Quick Select Preset Buttons */}
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {[
                    { value: '500', label: '৳৫০০ (সর্বনিম্ন)' },
                    { value: '1000', label: '৳১,০০০' },
                    { value: '2000', label: '৳২,০০০' },
                    { value: '3000', label: '৳৩,০০০' },
                    { value: '5000', label: '৳৫,০০০' },
                    { value: '10000', label: '৳১০,০০০' },
                    { value: '20000', label: '৳২০,০০০' },
                    { value: '50000', label: '৳৫০,০০০' },
                    { value: '100000', label: '৳১,০০,০০০ (১ লক্ষ)' },
                    { value: 'custom', label: '⚙️ ইচ্ছেমতো পরিমাণ' }
                  ].map((item) => {
                    const isSelected = monthlySavingsOption === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setMonthlySavingsOption(item.value)}
                        className={`py-2 px-2 rounded-xl text-[11px] font-extrabold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm ring-2 ring-emerald-300'
                            : 'bg-slate-50 hover:bg-emerald-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                <select
                  required
                  value={monthlySavingsOption}
                  onChange={(e) => setMonthlySavingsOption(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 transition-all font-sans"
                >
                  <option value="" disabled>-- মাসিক ডিপোজিট / ইনভেস্টমেন্ট নির্বাচন করুন (সর্বনিম্ন ৳৫০০ টাকা) --</option>
                  <option value="500">🔹 ৳৫০০ / মাস — সর্বনিম্ন ইনভেস্ট (১ম মাসের ইনভেস্টমেন্ট ৳৫০০ মেইন ব্যালেন্সে আবশ্যক)</option>
                  <option value="1000">⭐ ৳১,০০০ / মাস (১ম মাসের ইনভেস্টমেন্ট ৳১,০০০ মেইন ব্যালেন্সে আবশ্যক)</option>
                  <option value="2000">💎 ৳২,০০০ / মাস (১ম মাসের ইনভেস্টমেন্ট ৳২,০০০ মেইন ব্যালেন্সে আবশ্যক)</option>
                  <option value="3000">👑 ৳৩,০০০ / মাস (১ম মাসের ইনভেস্টমেন্ট ৳৩,০০০ মেইন ব্যালেন্সে আবশ্যক)</option>
                  <option value="5000">👑 ৳৫,০০০ / মাস (১ম মাসের ইনভেস্টমেন্ট ৳৫,০০০ মেইন ব্যালেন্সে আবশ্যক)</option>
                  <option value="10000">🏆 ৳১০,০০০ / মাস (১ম মাসের ইনভেস্টমেন্ট ৳১০,০০০ মেইন ব্যালেন্সে আবশ্যক)</option>
                  <option value="20000">🏆 ৳২০,০০০ / মাস (১ম মাসের ইনভেস্টমেন্ট ৳২০,০০০ মেইন ব্যালেন্সে আবশ্যক)</option>
                  <option value="50000">🏆 ৳৫০,০০০ / মাস (১ম মাসের ইনভেস্টমেন্ট ৳৫০,০০০ মেইন ব্যালেন্সে আবশ্যক)</option>
                  <option value="100000">👑 ৳১,০০,০০০ (১ লক্ষ টাকা) / মাস (১ম মাসের ইনভেস্টমেন্ট ৳১,০০,০০০ মেইন ব্যালেন্সে আবশ্যক)</option>
                  <option value="custom">⚙️ কাস্টম পরিমাণ (সর্বনিম্ন ৳৫০০ থেকে যেকোনো পরিমাণ লিখুন)</option>
                </select>

                {monthlySavingsOption === 'custom' && (
                  <div className="mt-2">
                    <label className="text-slate-700 font-bold text-[11px] block mb-1">
                      আপনি প্রতি মাসে কত টাকা ডিপোজিট / ইনভেস্ট করবেন তা লিখুন (সর্বনিম্ন ৳৫০০ টাকা, যেমন: 500, 1000, 2000, 5000, 100000):
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="টাকার পরিমাণ লিখুন (সর্বনিম্ন 500 টাকা)"
                      value={customSavingsAmount}
                      onChange={(e) => setCustomSavingsAmount(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border border-emerald-400 rounded-xl text-xs font-extrabold font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                    />
                  </div>
                )}

                {/* Live Main Balance & 1st Month Investment Verification Box */}
                <div className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                  (monthlySavingsOption === 'custom' && selectedMonthlyAmount > 0 && selectedMonthlyAmount < 500) || hasInsufficientBalance
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : selectedMonthlyAmount >= 500
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  <div className="flex items-center justify-between font-bold">
                    <span>আপনার বর্তমান মেইন ব্যালেন্স:</span>
                    <span className="font-mono text-sm font-black">৳{currentMainBalance.toLocaleString('bn-BD')}</span>
                  </div>
                  {selectedMonthlyAmount > 0 && (
                    <div className="flex items-center justify-between font-bold border-t border-current/10 pt-1.5">
                      <span>নির্বাচিত ১ম মাসের ইনভেস্টমেন্ট:</span>
                      <span className="font-mono text-sm font-black">৳{selectedMonthlyAmount.toLocaleString('bn-BD')}</span>
                    </div>
                  )}
                  {monthlySavingsOption === 'custom' && selectedMonthlyAmount > 0 && selectedMonthlyAmount < 500 ? (
                    <p className="text-[11px] font-bold text-rose-700 pt-1 leading-relaxed">
                      ⚠️ BNB কোম্পানি ইনভেস্টর সেকশনে সর্বনিম্ন ইনভেস্টমেন্ট ৳৫০০ টাকা! অনুগ্রহ করে কমপক্ষে ৫০০ টাকা বা তার বেশি পরিমাণ লিখুন।
                    </p>
                  ) : hasInsufficientBalance ? (
                    <p className="text-[11px] font-bold text-rose-700 pt-1 leading-relaxed">
                      ⚠️ আপনার মেইন ব্যালেন্সে পর্যাপ্ত টাকা নেই! আপনি প্রতি মাসে ৳{selectedMonthlyAmount.toLocaleString('bn-BD')} সিলেক্ট করেছেন, তাই আবেদন করার সময় ১ম মাসের ইনভেস্টমেন্ট দেওয়ার জন্য আপনার মেইন ব্যালেন্সে কমপক্ষে ৳{selectedMonthlyAmount.toLocaleString('bn-BD')} থাকতে হবে (আরও প্রয়োজন: ৳{(selectedMonthlyAmount - currentMainBalance).toLocaleString('bn-BD')})।
                    </p>
                  ) : selectedMonthlyAmount >= 500 ? (
                    <p className="text-[11px] font-semibold text-emerald-800 pt-1 leading-relaxed">
                      ✅ আপনার মেইন ব্যালেন্সে পর্যাপ্ত টাকা রয়েছে। আবেদন সাবমিট করলে ১ম মাসের ইনভেস্টমেন্ট বাবদ ৳{selectedMonthlyAmount.toLocaleString('bn-BD')} আপনার মেইন ব্যালেন্স থেকে জমা নেওয়া হবে এবং এডমিন অনুমোদনের জন্য পাঠানো হবে।
                    </p>
                  ) : (
                    <p className="text-[10.5px] text-slate-600 pt-0.5 leading-relaxed">
                      📌 নিয়ম: সর্বনিম্ন ইনভেস্টমেন্ট ৳৫০০ টাকা। আপনি ফরমে যত টাকা মাসিক ইনভেস্টমেন্ট সিলেক্ট করবেন (৳৫০০ / ৳১,০০০ / ৳২,০০০ / ৳৫,০০০ / ৳১,০০,০০০ ইত্যাদি), আবেদন করার সময় আপনার মেইন ব্যালেন্সে সেই পরিমাণ টাকা থাকতে হবে এবং ১ম মাসের ইনভেস্টমেন্ট দিয়ে এখানে প্রবেশ করতে হবে।
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Step C: Checkbox Agreement */}
          <div className="pt-2">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
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
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-slate-100 border border-slate-200 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 active:scale-98 transition text-center"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold text-xs hover:from-emerald-700 hover:to-teal-705 active:scale-98 transition flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-100"
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
