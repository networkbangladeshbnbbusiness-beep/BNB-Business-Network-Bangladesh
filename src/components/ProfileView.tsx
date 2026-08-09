import React, { useState, useEffect } from 'react';
import { User, PhoneChangeRequest, AppConfig } from '../types';
import { maskSecretPhone, normalizePhoneNumber, hasCompletedSamityProfile } from '../lib/memberUtils';
import { 
  User as UserIcon, 
  Phone, 
  CreditCard, 
  FileText, 
  Calendar, 
  Briefcase, 
  MapPin, 
  ShieldCheck, 
  Camera, 
  Edit3, 
  Check, 
  X,
  AlertCircle,
  Copy,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc, collection, addDoc, query, where, onSnapshot, serverTimestamp, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

interface ProfileViewProps {
  user: User;
  onUpdate: () => void;
  onTriggerAdmin?: () => void;
  appConfig?: AppConfig | null;
}

const PRESET_AVATARS = [
  { id: 'av1', emoji: '👨‍💼', label: 'কর্পোরেট ডিরেক্টর', bg: 'bg-indigo-100 border-indigo-250 text-indigo-700' },
  { id: 'av2', emoji: '👩‍💼', label: 'এক্সিকিউটিভ ওম্যান', bg: 'bg-rose-100 border-rose-250 text-rose-700' },
  { id: 'av3', emoji: '👨‍💻', label: 'আইটি কো-অর্ডিনেটর', bg: 'bg-teal-100 border-teal-250 text-teal-700 font-bold' },
  { id: 'av4', emoji: '🧑‍🌾', label: 'কৃষি উদ্যোক্তা', bg: 'bg-amber-100 border-amber-250 text-amber-700' },
  { id: 'av5', emoji: '👩‍🏫', label: 'সমবায় ট্রেইনার', bg: 'bg-emerald-100 border-emerald-250 text-emerald-700' },
  { id: 'av6', emoji: '✨', label: 'ভিআইপি মেম্বার', bg: 'bg-cyan-100 border-cyan-250 text-cyan-700' },
];

export default function ProfileView({ user, onUpdate, onTriggerAdmin, appConfig }: ProfileViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Form edit states
  const [name, setName] = useState(user.name || '');
  const [fatherName, setFatherName] = useState(user.fatherName || '');
  const [motherName, setMotherName] = useState(user.motherName || '');
  const [nid, setNid] = useState(user.nid || '');
  const [dob, setDob] = useState(user.dob || '');
  const [nomineeName, setNomineeName] = useState(user.nomineeName || '');
  const [nomineePhone, setNomineePhone] = useState(user.nomineePhone || '');
  const [division, setDivision] = useState(user.division || '');
  const [district, setDistrict] = useState(user.district || '');
  const [thana, setThana] = useState(user.thana || '');
  const [postOffice, setPostOffice] = useState(user.postOffice || '');
  const [profilePic, setProfilePic] = useState(user.profilePic || 'av3'); // store avatar id or direct picUrl
  const [customPicUrl, setCustomPicUrl] = useState(user.profilePic?.startsWith('http') ? user.profilePic : '');

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Phone Change Request States
  const [showPhoneChangeModal, setShowPhoneChangeModal] = useState(false);
  const [newPhoneInput, setNewPhoneInput] = useState('');
  const [phoneReasonInput, setPhoneReasonInput] = useState('');
  const [phoneSubmitting, setPhoneSubmitting] = useState(false);
  const [phoneModalMsg, setPhoneModalMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [myPhoneRequests, setMyPhoneRequests] = useState<PhoneChangeRequest[]>([]);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'phone_change_requests'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as PhoneChangeRequest[];
      setMyPhoneRequests(list);
    }, (err) => {
      console.error('Error listening to phone change requests:', err);
    });
    return () => unsub();
  }, [user?.uid]);

  const pendingPhoneReq = myPhoneRequests.find(r => r.status === 'pending');

  const approvedReqCount = myPhoneRequests.filter(r => r.status === 'approved').length;
  const prevCount = user.phoneChangeCount !== undefined ? (user.phoneChangeCount || 0) : approvedReqCount;

  const phoneCfg = appConfig?.phoneChangeConfig || {
    enabled: true,
    freeDaysAfterRegistration: 5,
    freeAttempts: 1,
    feeIncrement: 10,
    maxFee: 50
  };

  // Calculate elapsed days since registration/account creation
  const createdDate = user.createdAt ? new Date(user.createdAt) : new Date();
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - createdDate.getTime());
  const elapsedDays = diffMs / (1000 * 60 * 60 * 24);
  const freeRegistrationDays = phoneCfg.freeDaysAfterRegistration ?? 5;
  const isWithinRegistrationFreeWindow = elapsedDays <= freeRegistrationDays;

  const getPhoneChangeFeeDetails = (count: number) => {
    if (isWithinRegistrationFreeWindow) {
      const remainingDays = Math.max(0, Math.ceil(freeRegistrationDays - elapsedDays));
      return {
        isInstantFree: true,
        fee: 0,
        badgeText: `✨ অ্যাকাউন্ট খোলার প্রথম ${freeRegistrationDays} দিন ইনস্ট্যান্ট ফ্রি অফার (৳০)`,
        noticeText: `আপনার অ্যাকাউন্ট তৈরির বয়স ${Math.floor(elapsedDays)} দিন (৫ দিনের ফ্রি সুবিধার আর ${remainingDays} দিন বাকি)। এখন পরিবর্তন করলে কোনো ফি লাগবে না এবং কোনো এডমিন অনুমোদন ছাড়াই নম্বর সঙ্গে সঙ্গে আপডেট হয়ে যাবে!`,
        successMessage: `🎉 অ্যাকাউন্ট তৈরির ${freeRegistrationDays} দিনের মধ্যে ফ্রিতে ইনস্ট্যান্ট পরিবর্তনের সুবিধা থাকায় আপনার মোবাইল নম্বরটি কোনো এডমিন অনুমোদন ছাড়াই সঙ্গে সঙ্গে আপডেট করা হয়েছে!`
      };
    }

    // After 5 days of registration: Fee applies & Admin approval is required
    const feeIncrement = phoneCfg.feeIncrement ?? 10;
    const maxFee = phoneCfg.maxFee ?? 50;
    const fee = Math.min(maxFee, Math.max(10, (count + 1) * feeIncrement));
    const nth = count + 1;
    return {
      isInstantFree: false,
      fee,
      badgeText: `📋 এডমিন অনুমোদন সাপেক্ষে নম্বর পরিবর্তন সার্ভিস চার্জ (৳${fee}):`,
      noticeText: `আপনার অ্যাকাউন্ট খোলার পর ${freeRegistrationDays} দিন পার হয়ে গেছে। এখন মোবাইল নম্বর পরিবর্তনের জন্য ৳${fee} টাকা সার্ভিস চার্জ লাগবে এবং এডমিন অনুমোদনের পর নম্বর পরিবর্তন হবে। (আপনার বর্তমান ব্যালেন্স: ৳${(user.balance || 0).toFixed(2)})`,
      successMessage: `আবেদন সফলভাবে সাবমিট হয়েছে! সার্ভিস চার্জ ৳${fee} টাকা কাটা হয়েছে। এডমিন অনুমোদন দিলে নম্বরটি দ্রুত আপডেট হয়ে যাবে।`
    };
  };

  const currentFeeDetails = getPhoneChangeFeeDetails(prevCount);

  const handleSubmitPhoneChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneCfg.enabled === false) {
      setPhoneModalMsg({ type: 'error', text: '⚠️ মোবাইল নম্বর পরিবর্তনের সেবাটি বর্তমানে সাময়িকভাবে বন্ধ রয়েছে। এডমিনের সাথে যোগাযোগ করুন।' });
      return;
    }
    const cleanPhone = newPhoneInput.replace(/\D/g, '');
    if (cleanPhone.length < 11) {
      setPhoneModalMsg({ type: 'error', text: 'অনুগ্রহ করে ১১ ডিজিটের সঠিক মোবাইল নম্বর লিখুন (যেমন: 01700000000)' });
      return;
    }
    const currentClean = (user.phone || '').replace(/\D/g, '');
    if (cleanPhone === currentClean) {
      setPhoneModalMsg({ type: 'error', text: 'নতুন মোবাইল নম্বরটি বর্তমান নম্বরের মতোই। অন্য একটি নতুন নম্বর লিখুন।' });
      return;
    }

    const PHONE_CHANGE_FEE = currentFeeDetails.fee;
    const isInstantFree = currentFeeDetails.isInstantFree;
    const currentBalance = Number(user.balance || 0);

    if (PHONE_CHANGE_FEE > 0 && currentBalance < PHONE_CHANGE_FEE) {
      setPhoneModalMsg({ 
        type: 'error', 
        text: `⚠️ আপনার একাউন্টে পর্যাপ্ত ব্যালেন্স নেই। মোবাইল নম্বর পরিবর্তনের আবেদন করতে ৳${PHONE_CHANGE_FEE} চার্জ প্রয়োজন। আপনার বর্তমান ব্যালেন্স: ৳${currentBalance.toFixed(2)}` 
      });
      return;
    }

    setPhoneSubmitting(true);
    setPhoneModalMsg(null);
    try {
      if (isInstantFree) {
        // INSTANT CHANGE WITHOUT ADMIN REQUEST (within 5 days of registration)
        const userRef = doc(db, 'users', user.uid);
        const normalized = normalizePhoneNumber(cleanPhone);
        await updateDoc(userRef, {
          phone: cleanPhone,
          mobileNumber: cleanPhone,
          normalizedPhone: normalized,
          phoneChangeCount: increment(1),
          updatedAt: serverTimestamp()
        });

        // Record User Notification
        await addDoc(collection(db, 'user_notifications'), {
          userId: user.uid,
          title: '📱 মোবাইল নম্বর ইনস্ট্যান্ট আপডেট সম্পন্ন',
          message: `অ্যাকাউন্ট সৃষ্টির প্রথম ${freeRegistrationDays} দিনের ফ্রিতে ইনস্ট্যান্ট আপডেটের সুবিধার আওতায় আপনার মোবাইল নম্বর পরিবর্তন করে ${cleanPhone} করা হয়েছে।`,
          type: 'info',
          read: false,
          createdAt: serverTimestamp()
        });

        setPhoneModalMsg({
          type: 'success',
          text: `🎉 অ্যাকাউন্ট খোলার ${freeRegistrationDays} দিনের মধ্যে হওয়ায় আপনার মোবাইল নম্বরটি এডমিন অনুমোদন ছাড়াই ইনস্ট্যান্ট পরিবর্তন করে ${cleanPhone} করা হয়েছে!`
        });
        setNewPhoneInput('');
        setPhoneReasonInput('');
        if (onUpdate) onUpdate();
        return;
      }

      // AFTER 5 DAYS: DEDUCT FEE & SUBMIT ADMIN APPROVAL REQUEST
      const newBalance = PHONE_CHANGE_FEE > 0 ? Math.max(0, currentBalance - PHONE_CHANGE_FEE) : currentBalance;

      if (PHONE_CHANGE_FEE > 0) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          balance: newBalance,
          updatedAt: serverTimestamp()
        });

        // Record transaction
        await addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          userName: user.name || 'সদস্য',
          userPhone: user.phone || '',
          memberId: user.memberId || '',
          type: 'debit',
          category: 'fee',
          amount: PHONE_CHANGE_FEE,
          title: 'মোবাইল নম্বর পরিবর্তন চার্জ',
          description: `নতুন মোবাইল নম্বর (${cleanPhone}) এর আবেদন চার্জ বাবদ ৳${PHONE_CHANGE_FEE} কাটা হয়েছে (${prevCount + 1}ম বার পরিবর্তন)।`,
          status: 'approved',
          createdAt: new Date().toISOString()
        });

        // Send user notification
        await addDoc(collection(db, 'user_notifications'), {
          userId: user.uid,
          title: '📱 মোবাইল নম্বর পরিবর্তন চার্জ কর্তন',
          message: `মোবাইল নম্বর পরিবর্তনের আবেদনের জন্য আপনার মূল ব্যালেন্স থেকে ৳${PHONE_CHANGE_FEE} চার্জ কাটা হয়েছে। অবশিষ্ট ব্যালেন্স: ৳${newBalance.toFixed(2)}`,
          type: 'info',
          read: false,
          createdAt: serverTimestamp()
        });
      }

      // Notify admin
      try {
        await addDoc(collection(db, 'admin_notifications'), {
          type: 'phone_change_request',
          title: '📱 নতুন মোবাইল নম্বর পরিবর্তনের আবেদন',
          message: `${user.name} (${user.memberId || user.phone}) নম্বর পরিবর্তন আবেদন করেছে (${user.phone} ➔ ${cleanPhone})। ফি: ৳${PHONE_CHANGE_FEE}।`,
          userId: user.uid,
          userName: user.name || 'সদস্য',
          read: false,
          createdAt: new Date().toISOString()
        });
      } catch (eNotif) {
        console.warn("Admin notification warning:", eNotif);
      }

      // Add request to phone_change_requests
      await addDoc(collection(db, 'phone_change_requests'), {
        userId: user.uid,
        userName: user.name || 'সদস্য',
        memberId: user.memberId || '',
        currentPhone: user.phone || '',
        newPhone: cleanPhone,
        reason: phoneReasonInput.trim(),
        feePaid: PHONE_CHANGE_FEE,
        status: 'pending',
        requestedAt: new Date().toISOString()
      });

      setPhoneModalMsg({ 
        type: 'success', 
        text: currentFeeDetails.successMessage
      });
      setNewPhoneInput('');
      setPhoneReasonInput('');
      if (onUpdate) onUpdate();
    } catch (err: any) {
      setPhoneModalMsg({ type: 'error', text: 'আবেদন পাঠাতে ব্যর্থ হয়েছে: ' + (err?.message || err) });
    } finally {
      setPhoneSubmitting(false);
    }
  };

  // Synchronize local states when the user prop updates in the background (only when NOT editing)
  React.useEffect(() => {
    if (!isEditing && user) {
      setName(user.name || user.userName || '');
      setFatherName(user.fatherName || '');
      setMotherName(user.motherName || '');
      setNid(user.nid || user.nidNumber || '');
      setDob(user.dob || '');
      setNomineeName(user.nomineeName || '');
      setNomineePhone(user.nomineePhone || '');
      setDivision(user.division || '');
      setDistrict(user.district || '');
      setThana(user.thana || '');
      setPostOffice(user.postOffice || '');
      if (user.profilePic) {
        setProfilePic(user.profilePic);
        setCustomPicUrl(user.profilePic.startsWith('http') ? user.profilePic : '');
      }
    }
  }, [user, isEditing]);

  const handleStartEditing = () => {
    if (user) {
      setName(user.name || user.userName || '');
      setFatherName(user.fatherName || '');
      setMotherName(user.motherName || '');
      setNid(user.nid || user.nidNumber || '');
      setDob(user.dob || '');
      setNomineeName(user.nomineeName || '');
      setNomineePhone(user.nomineePhone || '');
      setDivision(user.division || '');
      setDistrict(user.district || '');
      setThana(user.thana || '');
      setPostOffice(user.postOffice || '');
      if (user.profilePic) {
        setProfilePic(user.profilePic);
        setCustomPicUrl(user.profilePic.startsWith('http') ? user.profilePic : '');
      }
    }
    setIsEditing(true);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    // Check if profile self-edit is allowed by Admin config
    const isSelfEditAllowed = appConfig?.allowProfileSelfEdit !== false;
    if (!isSelfEditAllowed && user.role !== 'admin') {
      setErrorMsg('দুঃখিত, এডমিন প্যানেল থেকে বর্তমানে সদস্যদের নিজ তথ্য সংশোধন বন্ধ রাখা হয়েছে।');
      setLoading(false);
      return;
    }

    const finalProfilePic = customPicUrl.trim() !== '' ? customPicUrl.trim() : profilePic;
    const userRef = doc(db, 'users', user.uid);
    
    const payload: Partial<User> = {
      name: name.trim(),
      userName: name.trim(),
      fatherName: fatherName.trim(),
      motherName: motherName.trim(),
      nid: nid.trim(),
      nidNumber: nid.trim(),
      dob: dob.trim(),
      nomineeName: nomineeName.trim(),
      nomineePhone: nomineePhone.trim(),
      division,
      district: district.trim(),
      thana: thana.trim(),
      postOffice: postOffice.trim(),
      profilePic: finalProfilePic,
      hasSetProfile: true, // Lock profile information upon saving
      updatedAt: serverTimestamp() as any
    };

    // Save to Firestore asynchronously in background
    updateDoc(userRef, payload)
      .then(() => {
        if (onUpdate) onUpdate();
      })
      .catch((err: any) => {
        console.error("Profile update error:", err);
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      });

    // Instant UI feedback (<0.1s)
    setTimeout(() => {
      setSuccessMsg('আপনার প্রোফাইল তথ্য সফলভাবে আপডেট করা হয়েছে!');
      setIsEditing(false);
      setLoading(false);
      if (onUpdate) onUpdate();
      setTimeout(() => setSuccessMsg(''), 5000);
    }, 80);
  };

  const selectPresetAvatar = (id: string) => {
    setProfilePic(id);
    setCustomPicUrl('');
    setShowAvatarPicker(false);
    
    // Quick save to DB for avatar instant update
    const userRef = doc(db, 'users', user.uid);
    updateDoc(userRef, { profilePic: id })
      .then(() => { if (onUpdate) onUpdate(); })
      .catch((err) => console.error(err));
  };

  const saveCustomPicUrl = () => {
    if (!customPicUrl.trim().startsWith('http')) {
      alert('সঠিক ছবি ইউআরএল (URL) প্রদান করুন, যা http বা https দিয়ে শুরু হতে হবে।');
      return;
    }
    setProfilePic(customPicUrl);
    setShowAvatarPicker(false);
    
    // Quick save to DB
    const userRef = doc(db, 'users', user.uid);
    updateDoc(userRef, { profilePic: customPicUrl })
      .then(() => { if (onUpdate) onUpdate(); })
      .catch((err) => console.error(err));
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('অনুগ্রহ করে একটি সঠিক ছবি ফাইল নির্বাচন করুন।');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 320;
          const MAX_HEIGHT = 320;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not get canvas context');
          
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);

          setProfilePic(compressedBase64);
          setCustomPicUrl('');
          setShowAvatarPicker(false);

          // Save to firestore
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, { profilePic: compressedBase64 });
          
          setSuccessMsg('আপনার গ্যালারি ছবি সফলভাবে আপলোড ও সেভ করা হয়েছে!');
          onUpdate();
          setTimeout(() => setSuccessMsg(''), 5000);
        } catch (err: any) {
          console.error(err);
          setErrorMsg('ছবি আপলোড ব্যর্থ হয়েছে। আবার চেষ্টা করুন।');
        } finally {
          setLoading(false);
        }
      };
      img.onerror = () => {
        setErrorMsg('ছবি লোড করতে সমস্যা হয়েছে।');
        setLoading(false);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setErrorMsg('ফাইল পড়তে সমস্যা হয়েছে।');
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  // Find active avatar meta
  const currentAvatarMeta = PRESET_AVATARS.find(av => av.id === profilePic) || PRESET_AVATARS[2];
  const isCustomPic = profilePic?.startsWith('http') || profilePic?.startsWith('data:image/');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Upper Status Notifications */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-bold leading-normal flex items-start gap-2.5 shadow-sm">
          <span>🎉</span>
          <div>{successMsg}</div>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs font-bold leading-normal flex items-start gap-2.5 shadow-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>{errorMsg}</div>
        </div>
      )}

      {/* Profile Card Header with custom design concept */}
      <div className="bg-gradient-to-br from-emerald-800 to-emerald-950 text-white rounded-3xl p-4 shadow-md relative overflow-hidden text-center">
        {/* Background mesh decoration */}
        <div className="absolute -top-16 -left-16 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-emerald-300/10 rounded-full blur-2xl pointer-events-none" />

        {/* Profile Avatar Wrapper */}
        <div className="relative w-18 h-18 mx-auto mb-2 group">
          <div className="w-full h-full rounded-full ring-4 ring-emerald-500/30 p-0.5 bg-emerald-950 flex items-center justify-center overflow-hidden">
            {isCustomPic ? (
              <img 
                src={profilePic} 
                alt="Profile" 
                className="w-full h-full object-cover rounded-full"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  // Fallback
                  e.currentTarget.src = '';
                  setProfilePic('av3');
                }}
              />
            ) : (
              <div className={`w-full h-full rounded-full flex items-center justify-center text-3xl font-extrabold ${currentAvatarMeta.bg}`}>
                {currentAvatarMeta.emoji}
              </div>
            )}
          </div>
          
          {/* Custom Avatar Change Camera Indicator */}
          <button 
            type="button"
            onClick={() => setShowAvatarPicker(!showAvatarPicker)}
            className="absolute bottom-0 right-0 p-1.5 bg-emerald-600 hover:bg-emerald-500 border-2 border-emerald-950 rounded-full transition-all text-white cursor-pointer hover:scale-105 active:scale-95 shadow-md flex items-center justify-center"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* User Details Display */}
        <h2 className="text-base font-bold tracking-tight text-white leading-tight">{user.name}</h2>
        <div className="flex items-center justify-center gap-1.5 mt-1 flex-wrap">
          <span className="text-[9px] bg-emerald-900/60 border border-white/10 px-2 py-0.5 rounded-full font-mono font-bold text-emerald-250">
            সমবায় আইডিঃ {user.memberId}
          </span>
          <span className="bg-emerald-500/80 text-white text-[8px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            {user.status === 'inactive' ? 'নিষ্ক্রিয় (Inactive)' : 'সক্রিয় (Active)'}
          </span>
        </div>

        <p className="text-[10px] text-emerald-200/80 mt-1.5 font-medium">কো-অপারেটিভ সঞ্চয় ও ঋণ রেজিস্ট্রিকৃত সদস্য</p>
      </div>

      {/* Preset / Custom Avatar Picker Popup Drawer */}
      <AnimatePresence>
        {showAvatarPicker && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-3xl border border-slate-150 p-5 shadow-sm text-left overflow-hidden space-y-4"
          >
            <div>
              <h4 className="text-xs font-black text-slate-800 mb-1 flex items-center justify-between">
                <span>পছন্দের প্রোফাইল ছবি নির্বাচন করুন</span>
                <button onClick={() => setShowAvatarPicker(false)} className="text-slate-400 p-1 hover:bg-slate-50 rounded-full">
                  <X className="w-4 h-4" />
                </button>
              </h4>
              <p className="text-[10px] text-slate-450 leading-relaxed">সহজে আইডেন্টিফিকেশনের জন্য নিচের যেকোনো একটি মেম্বার রোলে ক্লিক দিনঃ</p>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {PRESET_AVATARS.map((av, idx) => (
                <button
                  key={`${av.id}-${idx}`}
                  onClick={() => selectPresetAvatar(av.id)}
                  className={`p-2.5 rounded-2xl border flex flex-col items-center gap-1 cursor-pointer transition text-center ${
                    profilePic === av.id 
                      ? 'border-emerald-600 bg-emerald-50/10' 
                      : 'border-slate-100 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <span className="text-3xl">{av.emoji}</span>
                  <span className="text-[9px] font-black text-slate-600 leading-none truncate w-full">{av.label}</span>
                </button>
              ))}
            </div>

            {/* Gallery Upload Option */}
            <div className="border-t border-slate-100 pt-3.5 space-y-2">
              <label className="block text-[10px] font-bold text-slate-500">অথবা আপনার গ্যালারি থেকে ছবি সিলেক্ট করুনঃ</label>
              <div className="flex items-center gap-2 relative overflow-hidden">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleGalleryUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                />
                <button
                  type="button"
                  className="flex-grow flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-50 border border-dashed border-emerald-350 hover:bg-emerald-100/60 rounded-xl text-emerald-800 text-xs font-bold transition"
                >
                  <Camera className="w-4 h-4 text-emerald-600" />
                  গ্যালারি থেকে ফটো নির্বাচন করুন
                </button>
              </div>
            </div>

            {/* Direct URL entry option */}
            <div className="border-t border-slate-100 pt-3.5 space-y-2">
              <label className="block text-[10px] font-bold text-slate-500">অথবা যেকোনো কাস্টম ছবি লিঙ্ক (URL) দিনঃ</label>
              <div className="flex gap-2">
                <input 
                  type="url"
                  placeholder="https://images.unsplash.com/.../profile.jpg"
                  value={customPicUrl}
                  onChange={(e) => setCustomPicUrl(e.target.value)}
                  className="flex-1 text-xs px-3 py-2 bg-slate-50 border border-slate-205 rounded-xl font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-700"
                />
                <button 
                  onClick={saveCustomPicUrl}
                  className="bg-emerald-800 hover:bg-emerald-900 text-white text-[10.5px] px-3 font-bold rounded-xl whitespace-nowrap active:scale-95 cursor-pointer"
                >
                  ছবি লিঙ্ক সেট
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Profile Info Details Grid & Edit toggle */}
      {!isEditing ? (
        <div className="bg-white border border-slate-150 p-4 rounded-3xl shadow-sm space-y-3.5 text-left">
          {/* Header Action Row */}
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-none">সদস্য পরিচিতি ও ডাটাপত্র</h3>
              <p className="text-[8.5px] text-slate-400 mt-1">নিবন্ধিত সমবায় তথ্যাদি ও আইডি বিবরণী</p>
            </div>
            {appConfig?.allowProfileSelfEdit === false && user.role !== 'admin' ? (
              <span className="px-2.5 py-1 bg-rose-50 text-rose-800 font-extrabold border border-rose-200 rounded-lg text-[9.5px] sm:text-[10px] flex items-center gap-0.5 shadow-3xs leading-none">
                🔒 তথ্য সংশোধন বন্ধ (Admin Off)
              </span>
            ) : user.hasSetProfile && appConfig?.allowProfileSelfEdit === false && user.role !== 'admin' ? (
              <span className="px-2.5 py-1 bg-amber-50 text-amber-800 font-extrabold border border-amber-200 rounded-lg text-[9.5px] sm:text-[10px] flex items-center gap-0.5 shadow-3xs leading-none">
                🔒 তথ্য লকড
              </span>
            ) : (
              <button 
                onClick={handleStartEditing}
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-850 hover:text-emerald-950 font-bold border border-emerald-200 hover:border-emerald-300 rounded-lg text-[10.5px] transition-all active:scale-95 cursor-pointer flex items-center gap-0.5"
              >
                <Edit3 className="w-3 h-3" />
                তথ্য এডিট
              </button>
            )}
          </div>

          {/* Copied Info indicator */}
          {copiedField && (
            <div className="bg-slate-900 text-white py-1 px-3 rounded-lg text-[9px] font-black tracking-wide text-center animate-bounce">
              📋 {copiedField} সফলভাবে ক্লিপবোর্ডে কপি করা হয়েছে!
            </div>
          )}

          {/* Profile Details List */}
          <div className="space-y-2.5">
            {/* 1. Name */}
            <div className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/50 rounded-2xl border border-slate-100 transition duration-150">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                  <UserIcon className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block leading-none">সদস্যের পুরো নাম</span>
                  <strong className="text-xs text-slate-800 font-bold leading-none mt-0.5 block">{user.name}</strong>
                </div>
              </div>
              <button onClick={() => handleCopy(user.name, 'নাম')} className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded transition-colors cursor-pointer">
                <Copy className="w-3 h-3" />
              </button>
            </div>

            {/* 2. Member ID */}
            <div className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/50 rounded-2xl border border-slate-100 transition duration-150">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700 shrink-0">
                  <CreditCard className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block leading-none">সদস্য রেজিস্ট্রি আইডি (Member ID)</span>
                  <strong className="text-xs text-slate-800 font-mono font-bold leading-none mt-0.5 block">{user.memberId}</strong>
                </div>
              </div>
              <button onClick={() => handleCopy(user.memberId, 'সদস্য আইডি')} className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded transition-colors cursor-pointer">
                <Copy className="w-3 h-3" />
              </button>
            </div>

            {/* 3. Phone */}
            <div className="p-2.5 bg-slate-50 hover:bg-slate-100/50 rounded-2xl border border-slate-100 transition duration-150 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 shrink-0">
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold block leading-none">মোবাইল নম্বর</span>
                    <strong className="text-xs text-slate-800 font-mono font-bold leading-none mt-0.5 block">{maskSecretPhone(user.phone)}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => handleCopy(user.phone, 'মোবাইল নম্বর')} className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded transition-colors cursor-pointer">
                    <Copy className="w-3 h-3" />
                  </button>
                  <button 
                    onClick={() => {
                      setPhoneModalMsg(null);
                      setShowPhoneChangeModal(true);
                    }}
                    className="px-2 py-1 bg-[#009273] hover:bg-[#007b61] text-white font-bold text-[10px] rounded-xl transition cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>নম্বর পরিবর্তন</span>
                  </button>
                </div>
              </div>

              {pendingPhoneReq && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-[11px] text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold">আবেদন অপেক্ষমাণ:</strong> নম্বর <strong>{user.phone}</strong> পরিবর্তন করে <strong className="font-mono">{pendingPhoneReq.newPhone}</strong> করার আবেদনটি এডমিন পর্যালোচনায় রয়েছে।
                  </div>
                </div>
              )}
            </div>

            {/* 3.5 Father & Mother Name Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Father Name */}
              <div className="p-2.5 bg-slate-50 hover:bg-slate-100/50 rounded-2xl border border-slate-100 transition duration-150 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block leading-none">পিতার নাম (Father's Name)</span>
                  <strong className="text-xs text-slate-800 font-bold block mt-1 truncate">
                    {user.fatherName || '(নেই)'}
                  </strong>
                </div>
                {user.fatherName && (
                  <button onClick={() => handleCopy(user.fatherName || '', 'পিতার নাম')} className="self-end mt-1 p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded transition-colors cursor-pointer">
                    <Copy className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Mother Name */}
              <div className="p-2.5 bg-slate-50 hover:bg-slate-100/50 rounded-2xl border border-slate-100 transition duration-150 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block leading-none">মাতার নাম (Mother's Name)</span>
                  <strong className="text-xs text-slate-800 font-bold block mt-1 truncate">
                    {user.motherName || '(নেই)'}
                  </strong>
                </div>
                {user.motherName && (
                  <button onClick={() => handleCopy(user.motherName || '', 'মাতার নাম')} className="self-end mt-1 p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded transition-colors cursor-pointer">
                    <Copy className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* 4. NID & DOB Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* NID */}
              <div className="p-2.5 bg-slate-50 hover:bg-slate-100/50 rounded-2xl border border-slate-100 transition duration-150 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block leading-none">NID নম্বর</span>
                  <strong className="text-xs text-slate-800 font-mono font-bold block mt-1 truncate">
                    {user.nid || '(নেই)'}
                  </strong>
                </div>
                {user.nid && (
                  <button onClick={() => handleCopy(user.nid || '', 'NID')} className="self-end mt-1 p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded transition-colors cursor-pointer">
                    <Copy className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* DOB */}
              <div className="p-2.5 bg-slate-50 hover:bg-slate-100/50 rounded-2xl border border-slate-100 transition duration-150 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block leading-none">জন্ম তারিখ</span>
                  <strong className="text-[11px] text-slate-800 font-bold block mt-1">
                    {user.dob ? new Date(user.dob).toLocaleDateString('bn-BD', { year: 'numeric', month: 'numeric', day: 'numeric' }) : '(নেই)'}
                  </strong>
                </div>
              </div>
            </div>

            {/* 5. Compact Nominee Details Group */}
            <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100 transition duration-150 space-y-2">
              <div className="flex items-center gap-1.5 pb-1 border-b border-slate-200/60">
                <UserIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">মনোনীত নমিনি (Nominee)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-left">
                <div className="bg-white/60 p-1.5 rounded-lg border border-slate-100">
                  <span className="text-[8px] text-slate-400 font-bold block leading-none">নমিনির নাম</span>
                  <span className="text-[10.5px] text-slate-800 font-bold truncate block mt-0.5">{user.nomineeName || '(নেই)'}</span>
                </div>
                <div className="bg-white/60 p-1.5 rounded-lg border border-slate-100 flex items-center justify-between gap-1">
                  <div className="min-w-0">
                    <span className="text-[8px] text-slate-400 font-bold block leading-none">মোবাইল নম্বর</span>
                    <span className="text-[10.5px] text-slate-800 font-mono font-bold truncate block mt-0.5">{user.nomineePhone || '(নেই)'}</span>
                  </div>
                  {user.nomineePhone && (
                    <button onClick={() => handleCopy(user.nomineePhone || '', 'নমিনি মোবাইল')} className="p-0.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded cursor-pointer shrink-0">
                      <Copy className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 6. Compact Present Address Details Group */}
            <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100 transition duration-150 space-y-2">
              <div className="flex items-center gap-1.5 pb-1 border-b border-slate-200/60">
                <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">বর্তমান ঠিকানা (Present Address)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-left">
                <div className="bg-white/60 p-1.5 rounded-lg border border-slate-100">
                  <span className="text-[8px] text-slate-400 font-bold block leading-none">বিভাগ</span>
                  <span className="text-[10.5px] text-slate-800 font-bold mt-0.5 block truncate">{user.division || '(নেই)'}</span>
                </div>
                <div className="bg-white/60 p-1.5 rounded-lg border border-slate-100">
                  <span className="text-[8px] text-slate-400 font-bold block leading-none">জেলা</span>
                  <span className="text-[10.5px] text-slate-800 font-bold mt-0.5 block truncate">{user.district || '(নেই)'}</span>
                </div>
                <div className="bg-white/60 p-1.5 rounded-lg border border-slate-100">
                  <span className="text-[8px] text-slate-400 font-bold block leading-none">থানা / উপজেলা</span>
                  <span className="text-[10.5px] text-slate-800 font-bold mt-0.5 block truncate">{user.thana || '(নেই)'}</span>
                </div>
                <div className="bg-white/60 p-1.5 rounded-lg border border-slate-100">
                  <span className="text-[8px] text-slate-400 font-bold block leading-none">পোস্ট / গ্রাম</span>
                  <span className="text-[10.5px] text-slate-800 font-bold mt-0.5 block truncate">{user.postOffice || '(নেই)'}</span>
                </div>
              </div>
            </div>

            {/* 7. Role / Security Privileges */}
            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-2xl border border-slate-100 pointer-events-none">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block leading-none">অ্যাকাউন্ট ক্যাটাগরি রোল</span>
                  <strong className="text-[10px] text-slate-800 font-bold uppercase font-mono block mt-0.5">
                    {user.role === 'admin' 
                      ? 'CORPORATE ADMIN (ডিরেক্টর)' 
                      : user.role === 'sub_admin'
                      ? 'SUB ADMIN (সহকারী এডমিন)'
                      : (user.samityStatus === 'approved' || user.samityApproved === true) && hasCompletedSamityProfile(user)
                      ? 'COOPERATIVE INVESTOR MEMBER (সমবায় ইনভেস্টর সদস্য)'
                      : user.samityStatus === 'pending'
                      ? 'GENERAL MEMBER (সমবায় আবেদন পেন্ডিং)'
                      : 'GENERAL MEMBER (সাধারণ অ্যাপ সদস্য)'}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Admin panel gate for admins only, placed cleanly outside the general grid */}
          {user.role === 'admin' && onTriggerAdmin && (
            <div className="pt-1.5 border-t border-slate-100 mt-1">
              <button
                onClick={onTriggerAdmin}
                className="w-full py-2.5 bg-slate-900 hover:bg-black text-white font-extrabold rounded-xl text-[10.5px] transition duration-150 active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-slate-900/10"
              >
                <ShieldCheck className="w-4 h-4 text-amber-450" />
                অ্যাডমিন গেটওয়ে মডিউলে প্রবেশ করুন
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Edit Profile Mode Form */
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white border border-slate-205 p-4 rounded-3xl shadow-sm text-left"
        >
          <div className="pb-2 border-b border-slate-100 mb-3">
            <h3 className="text-xs font-bold text-slate-800">প্রোফাইল সম্পাদন খাতা</h3>
            <p className="text-[9px] text-slate-450 mt-0.5">নিচের ফর্মটি যথাযথ তথ্য দিয়ে পূরণ করে ডাটা আপডেট করুনঃ</p>
          </div>

          {/* Locked policy notice matching user instructions */}
          <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-2xl mb-3 text-amber-905 text-[9.5px] leading-relaxed font-bold flex gap-1.5 text-left">
            <span>⚠️</span>
            <p>নিরাপত্তার স্বার্থে প্রোফাইল তথ্য শুধুমাত্র ১ বার সেট বা পরিবর্তন করা যাবে। পরবর্তীতে যেকোনো সংশোধনের জন্য এডমিন ডিরেক্টরের অনুমতি বাধ্যতামূলক। তবে আপনার প্রোফাইল ছবি যেকোনো সময় আনলিমিটেড পরিবর্তন করা যাবে।</p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-3 font-sans text-xs">
            {/* Name */}
            <div className="space-y-1">
              <label className="block text-[9px] font-black text-slate-500">মেম্বার পুরো নাম (বাংলা বা ইংরেজি)</label>
              <input 
                type="text" 
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="নাম লিখুন"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-205 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
              />
            </div>

            {/* Father's & Mother's Name Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Father Name */}
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-500">পিতার নাম (Father's Name)</label>
                <input 
                  type="text" 
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  placeholder="পিতার নাম লিখুন"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-205 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              {/* Mother Name */}
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-500">মাতার নাম (Mother's Name)</label>
                <input 
                  type="text" 
                  value={motherName}
                  onChange={(e) => setMotherName(e.target.value)}
                  placeholder="মাতার নাম লিখুন"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-205 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            {/* NID & DOB Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* NID */}
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-500">NID নম্বর (১০ বা ১৭ ডিজিট)</label>
                <input 
                  type="text" 
                  maxLength={17}
                  value={nid}
                  onChange={(e) => setNid(e.target.value.replace(/\D/g, ''))}
                  placeholder="National ID নম্বর"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-205 rounded-xl font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 font-bold"
                />
              </div>

              {/* Date of Birth */}
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-500">জন্ম তারিখ</label>
                <input 
                  type="date" 
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-205 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 font-bold font-mono"
                />
              </div>
            </div>

            {/* Nominee Details Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Nominee Name */}
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-500">মনোনীত নমিনির নাম</label>
                <input 
                  type="text" 
                  value={nomineeName}
                  onChange={(e) => setNomineeName(e.target.value)}
                  placeholder="নমিনির নাম লিখুন"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-205 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              {/* Nominee Mobile */}
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-500">নমিনির কন্টাক্ট মোবাইল নম্বর</label>
                <input 
                  type="tel" 
                  maxLength={11}
                  value={nomineePhone}
                  onChange={(e) => setNomineePhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="01XXXXXXXXX"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-205 rounded-xl font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 font-bold"
                />
              </div>
            </div>

            {/* Area / Division & District Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Area / Division dropdown */}
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-500">বিভাগ / এলাকা</label>
                <select 
                  value={division}
                  onChange={(e) => setDivision(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-205 rounded-xl text-slate-850 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                >
                  <option value="">নির্বাচন করুন</option>
                  <option value="Dhaka">ঢাকা (Dhaka)</option>
                  <option value="Chittagong">চট্টগ্রাম (Chittagong)</option>
                  <option value="Rajshahi">রাজশাহী (Rajshahi)</option>
                  <option value="Khulna">খুলনা (Khulna)</option>
                  <option value="Barisal">বরিশাল (Barisal)</option>
                  <option value="Sylhet">সিলেট (Sylhet)</option>
                  <option value="Rangpur">রংপুর (Rangpur)</option>
                  <option value="Mymensingh">ময়মনসিংহ (Mymensingh)</option>
                </select>
              </div>

              {/* District */}
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-500">জেলা (District)</label>
                <input 
                  type="text" 
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="জেলার নাম লিখুন"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-205 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Thana & Post Office Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Thana */}
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-500">থানা / উপজেলা (Thana / Upazila)</label>
                <input 
                  type="text" 
                  required
                  value={thana}
                  onChange={(e) => setThana(e.target.value)}
                  placeholder="থানার নাম লিখুন"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-205 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              {/* Post Office or Village */}
              <div className="space-y-1">
                <label className="block text-[9px] font-black text-slate-500">পোস্ট অফিস / গ্রাম (Post / Village)</label>
                <input 
                  type="text" 
                  required
                  value={postOffice}
                  onChange={(e) => setPostOffice(e.target.value)}
                  placeholder="গ্রাম বা পোস্ট অফিস"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-205 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Form actions */}
            <div className="flex gap-2.5 pt-2.5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-extrabold rounded-xl transition cursor-pointer text-center text-[11px] shadow-xs"
              >
                বাতিল করুন
              </button>
              
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-emerald-850 hover:bg-emerald-900 text-white font-extrabold rounded-xl transition cursor-pointer text-center text-[11px] shadow-md shadow-emerald-850/10 flex items-center justify-center gap-1 border border-emerald-900"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    ডাটা সংরক্ষণ
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Phone Change Request Modal */}
      <AnimatePresence>
        {showPhoneChangeModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 text-left">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-100 relative overflow-hidden space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold">
                    <Phone className="w-5 h-5 text-[#009273]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">মোবাইল নম্বর পরিবর্তনের আবেদন</h3>
                    <p className="text-[10px] text-slate-500 font-medium">এডমিন অনুমোদন দিলে আপনার নম্বর অটোমেটিক আপডেট হবে</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPhoneChangeModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Security & Data Preservation Notice */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-[11px] text-emerald-900 space-y-1">
                <p className="font-bold flex items-center gap-1 text-[#009273]">
                  <ShieldCheck className="w-4 h-4 text-[#009273] shrink-0" />
                  নিরাপত্তা ও ডাটা সংরক্ষণের বার্তা:
                </p>
                <p className="text-[10.5px] leading-relaxed text-slate-700">
                  নম্বর পরিবর্তন করা হলেও আপনার অ্যাকাউন্টের মেইন ওয়ালেট ব্যালেন্স, সঞ্চয় খতিয়ান, ডিপিএস, লভ্যাংশ, কিস্তি তথ্য ও মেম্বার আইডি <strong>১০০% নিরাপদ ও অপরিবর্তিত থাকবে</strong>। শুধু লগইন করার মোবাইল নম্বরটি আপডেট হবে।
                </p>
              </div>

              {/* Fee Notice */}
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl text-[11px] text-amber-900 flex items-start gap-2">
                <CreditCard className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-extrabold text-amber-900">{currentFeeDetails.badgeText}</p>
                  <p className="text-[10.5px] leading-relaxed text-amber-800">
                    {currentFeeDetails.noticeText} (আপনার বর্তমান ব্যালেন্স: <span className="font-bold text-slate-900">৳{(user.balance || 0).toFixed(2)}</span>)
                  </p>
                </div>
              </div>

              {phoneModalMsg && (
                <div className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                  phoneModalMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{phoneModalMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleSubmitPhoneChange} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    বর্তমান মোবাইল নম্বর
                  </label>
                  <input
                    type="text"
                    disabled
                    value={user.phone || ''}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-600"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    নতুন মোবাইল নম্বর <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="01700000000"
                    value={newPhoneInput}
                    onChange={(e) => setNewPhoneInput(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#009273] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    নম্বর পরিবর্তনের কারণ (ঐচ্ছিক)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="যেমন: নতুন নম্বর ব্যবহার করছি বা আগের নম্বরটি হারিয়ে গেছে..."
                    value={phoneReasonInput}
                    onChange={(e) => setPhoneReasonInput(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-[#009273] outline-none resize-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPhoneChangeModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    বন্ধ করুন
                  </button>
                  <button
                    type="submit"
                    disabled={phoneSubmitting}
                    className="flex-1 py-2.5 bg-[#009273] hover:bg-[#007b61] text-white font-black rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-teal-900/10"
                  >
                    {phoneSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>আবেদন সাবমিট করুন</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
