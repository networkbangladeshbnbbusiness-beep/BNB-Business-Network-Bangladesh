import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, ShieldAlert, Check, Sparkles, Award } from 'lucide-react';
import { db } from '../lib/firebase';
import UnifiedBackButton from './UnifiedBackButton';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

export default function RationApplicationForm({ liveUser, onClose, appConfig }: any) {
  const [name, setName] = useState(liveUser?.name || '');
  const [phone, setPhone] = useState(liveUser?.phone || '');
  const [address, setAddress] = useState((liveUser as any)?.address || '');
  const [duration, setDuration] = useState('1');
  const [cardType, setCardType] = useState('red_white'); // Defaulting to highest
  const [submitting, setSubmitting] = useState(false);

  const isInitialized = React.useRef(false);

  useEffect(() => {
    if (liveUser && !isInitialized.current) {
      setName(liveUser.name || '');
      setPhone(liveUser.phone || '');
      setAddress((liveUser as any)?.address || '');
      isInitialized.current = true;
    }
  }, [liveUser]);

  const cardCategories = [
    {
      id: 'red_white',
      name: appConfig?.rationCardConfigs?.red_white?.label || 'গোল্ডেন প্রিমিয়াম',
      fee: appConfig?.rationCardConfigs?.red_white?.price || 500,
      color: 'bg-red-500',
      activeBorderClass: 'ring-2 ring-red-400 border-red-600'
    },
    {
      id: 'blue_white',
      name: appConfig?.rationCardConfigs?.blue_white?.label || 'গোল্ডেন',
      fee: appConfig?.rationCardConfigs?.blue_white?.price || 300,
      color: 'bg-blue-500',
      activeBorderClass: 'ring-2 ring-blue-400 border-blue-600'
    },
    {
      id: 'green_white',
      name: appConfig?.rationCardConfigs?.green_white?.label || 'প্রিমিয়াম',
      fee: appConfig?.rationCardConfigs?.green_white?.price || 200,
      color: 'bg-emerald-500',
      activeBorderClass: 'ring-2 ring-emerald-400 border-emerald-600'
    },
    {
      id: 'black_white',
      name: appConfig?.rationCardConfigs?.black_white?.label || 'রেগুলার',
      fee: appConfig?.rationCardConfigs?.black_white?.price || 100,
      color: 'bg-slate-700',
      activeBorderClass: 'ring-2 ring-slate-400 border-slate-500'
    }
  ];

  const selectedCategoryObj = cardCategories.find(c => c.id === cardType) || cardCategories[3];
  const totalFee = selectedCategoryObj.fee * parseInt(duration);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Auto-use profile pic
    const userPhoto = liveUser.profilePic || liveUser.photoURL || '';

    // 2. Check if user has sufficient main balance
    const userBalance = liveUser?.balance || 0;
    if (userBalance < totalFee) {
      alert(`আপনার মেইন ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই! রেশন কার্ড ফি ৳${totalFee} BDT কিন্তু আপনার ব্যালেন্স ৳${userBalance} BDT। অনুগ্রহ করে প্রথমে ড্যাশবোর্ড থেকে এড মানি করে অ্যাকাউন্ট ব্যালেন্স বৃদ্ধি করুন।`);
      return;
    }

    if (!window.confirm(`আপনি কি ৳${totalFee} BDT ফি প্রদান করে এই কার্ডের জন্য আবেদন করতে চান? আপনার মেইন ব্যালেন্স থেকে এই টাকা কেটে নেওয়া হবে।`)) {
      return;
    }

    setSubmitting(true);
    try {
      const timestamp = new Date().toISOString();
      const cardNo = liveUser?.memberId || liveUser?.phone || `BNB-${Date.now()}`;
      
      // 3. Deduct balance from user
      const userRef = doc(db, 'users', liveUser.uid);
      await updateDoc(userRef, {
        balance: userBalance - totalFee,
        mainBalance: userBalance - totalFee
      });

      // 4. Create Ration Card record
      const expiryDateObj = new Date(new Date().setFullYear(new Date().getFullYear() + parseInt(duration)));
      await addDoc(collection(db, 'ration_cards'), {
        userId: liveUser.uid,
        userName: name,
        name: name,
        phone: phone,
        address: address,
        village: address.split(',')[0] || address,
        upazila: address.split(',')[1] || 'যশোর সদর',
        district: address.split(',')[2] || 'যশোর',
        duration: duration,
        cardType: cardType, 
        cardNo: cardNo,
        cardNumber: cardNo,
        photoUrl: userPhoto,
        status: 'pending',
        createdAt: timestamp,
        issueDate: new Date().toLocaleDateString('bn-BD'),
        expiryDate: expiryDateObj.toLocaleDateString('bn-BD'),
        expiryTimestamp: expiryDateObj.toISOString(),
        signature: 'S.Hasan'
      });

      // 5. Add Transaction Log
      await addDoc(collection(db, 'transactions'), {
        id: `tx-rc-apply-${Date.now()}`,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId || '',
        type: 'fee_payment',
        typeLabel: 'রেশন কার্ড সক্রিয়করণ ফি',
        amount: totalFee,
        status: 'success',
        description: `${selectedCategoryObj.name} সক্রিয়করণ ফি (মেয়াদঃ ${duration} বছর)। আবেদনটি পর্যালোচনার জন্য পাঠানো হয়েছে।`,
        createdAt: timestamp,
        paymentMethod: 'Main Balance'
      });

      // 6. Save Personal Notification
      await addDoc(collection(db, 'user_notifications'), {
        id: `notif-rc-apply-${Date.now()}`,
        userId: liveUser.uid,
        title: "🥗 রেশন কার্ড আবেদন ফি পরিশোধিত!",
        body: `আপনার ${selectedCategoryObj.name} এর আবেদন সফলভাবে গ্রহণ করা হয়েছে এবং ৳${totalFee} BDT মেইন ওয়ালেট থেকে কেটে নেওয়া হয়েছে। শীঘ্রই এডমিন কার্ডটি সক্রিয় করবেন।`,
        read: false,
        isPersonal: true,
        category: 'admin_msg',
        createdAt: timestamp
      });

      alert('অভিনন্দন! আপনার রেশন কার্ডের আবেদন এবং ফি সফলভাবে পরিশোধ করা হয়েছে। এডমিন প্যানেল থেকে দ্রুত সময়ের মধ্যে যাচাই শেষে কার্ডটি সক্রিয় করা হবে।');
      if (onClose) onClose();
    } catch (err: any) {
      alert('আবেদন পাঠাতে সমস্যা হয়েছে: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed inset-0 z-[100] bg-white flex flex-col font-sans text-slate-800 select-none"
      >
        {/* Top Spacer for Notification Bar */}
        <div className="h-10 shrink-0 bg-[#004a2c] w-full"></div>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <UnifiedBackButton onClick={onClose} variant="dark" />
            <h2 className="text-sm font-black text-[#015335]">রেশন কার্ড আবেদন</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-md mx-auto space-y-5">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-black text-[#015335]">🥗 ডিজিটাল রেশন কার্ড</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ভর্তুকি পণ্য সুবিধা পাওয়ার স্মার্ট কার্ড</p>
            </div>

            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-start gap-3 shadow-3xs">
              <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-emerald-900 leading-relaxed">
                আপনার ওয়ালেটে পর্যাপ্ত মেইন ব্যালেন্স থাকতে হবে। আবেদন সম্পূর্ণ হওয়ামাত্রই একাউন্ট থেকে ফি কেটে নেওয়া হবে।
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">কার্ড ক্যাটাগরি নির্বাচন করুন *</label>
              <div className="grid grid-cols-2 gap-2">
                {cardCategories.map((category, idx) => {
                  const isSelected = cardType === category.id;
                  return (
                    <div
                      key={`${category.id}-${idx}`}
                      onClick={() => setCardType(category.id)}
                      className={`border-2 rounded-2xl p-3 cursor-pointer transition-all flex flex-col gap-2 relative overflow-hidden ${
                        isSelected 
                          ? 'border-[#015335] bg-emerald-50 shadow-md scale-[1.02]' 
                          : 'border-slate-100 hover:border-slate-200 bg-white'
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full ${category.color} flex items-center justify-center`}>
                        {isSelected && <Check className="w-2 h-2 text-white stroke-[4]" />}
                      </div>
                      <div>
                        <h4 className="text-[11px] font-black text-slate-800 leading-tight">{category.name}</h4>
                        <p className="text-xs font-mono font-black text-emerald-700 mt-1">৳{category.fee}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">সদস্যের নাম *</label>
                  <input 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    className="w-full bg-transparent text-xs font-black outline-none" 
                    required 
                  />
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">মোবাইল নম্বর *</label>
                  <input 
                    type="text" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    className="w-full bg-transparent text-xs font-mono font-black outline-none" 
                    required 
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">পূর্ণ ঠিকানা (গ্রাম, উপজেলা, জেলা) *</label>
                <textarea 
                  value={address} 
                  onChange={(e) => setAddress(e.target.value)} 
                  placeholder="যেমন: খড়কী, যশোর সদর, যশোর"
                  className="w-full bg-transparent text-xs font-bold outline-none h-16 resize-none" 
                  required 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">মেয়াদ</label>
                  <select 
                    value={duration} 
                    onChange={(e) => setDuration(e.target.value)} 
                    className="w-full bg-transparent text-xs font-black outline-none appearance-none"
                  >
                    {[1, 2, 3, 4, 5].map(y => <option key={y} value={y.toString()}>{y} বছর</option>)}
                  </select>
                </div>

                <div className="bg-slate-900 text-white p-3 rounded-2xl flex justify-between items-center shadow-lg">
                  <div>
                    <p className="text-[8px] text-slate-400 font-black uppercase leading-none">মোট ফি</p>
                    <p className="text-[10px] text-emerald-400 font-black mt-1">৳{selectedCategoryObj.fee} × {duration}</p>
                  </div>
                  <span className="text-lg font-black text-white font-mono">৳{totalFee}</span>
                </div>
              </div>

              <div className="pt-2 pb-10">
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full py-4 bg-[#015335] hover:bg-[#014028] disabled:bg-slate-300 text-white rounded-2xl font-black text-sm transition shadow-xl shadow-emerald-100 uppercase tracking-widest active:scale-95 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      <span>আবেদন জমা দিন</span>
                    </>
                  )}
                </button>
                <p className="text-[9px] text-slate-400 text-center mt-3 font-bold">
                  প্রোফাইল পিকচারটি রেশন কার্ডে অটোমেটিক সেট করা হবে।
                </p>
              </div>
            </form>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
