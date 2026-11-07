import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import UnifiedBackButton from './UnifiedBackButton';
import { 
  Lock, 
  HelpCircle, 
  Send, 
  Clock, 
  Check, 
  CheckCircle, 
  X, 
  XCircle, 
  ChevronRight, 
  User, 
  Phone, 
  ShieldCheck, 
  AlertCircle, 
  ArrowLeft, 
  ArrowDown, 
  Truck, 
  AlertTriangle,
  Search,
  Filter,
  DollarSign,
  Eye,
  EyeOff,
  Download,
  Share2,
  Printer,
  Copy,
  UploadCloud,
  ClipboardList,
  RefreshCw,
  Scale,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  where, 
  onSnapshot 
} from 'firebase/firestore';
import { User as UserType, Transaction } from '../types';
import { useBackHandler } from '../lib/navigationManager';

interface SafeDealsEscrowViewProps {
  liveUser: UserType;
  syncLiveProfile: () => Promise<void>;
  appConfig?: any;
  onBack?: () => void;
  allNotices?: any[];
}

const SafeDealsBannerSlider = React.memo(function SafeDealsBannerSlider({ adSlides }: { adSlides: any[] }) {
  const [currentAdSlide, setCurrentAdSlide] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const validSlides = (adSlides || []).filter((slide) => slide?.image && !failedImages[slide.image]);

  useEffect(() => {
    if (validSlides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentAdSlide((prev) => (prev + 1) % validSlides.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [validSlides.length]);

  if (validSlides.length === 0) return null;

  const safeIdx = currentAdSlide % validSlides.length;
  const activeImage = validSlides[safeIdx]?.image;

  return (
    <div className="relative rounded-none overflow-hidden aspect-video shadow-sm border border-slate-200/80 bg-slate-900 group w-full">
      <div className="absolute inset-0 w-full h-full">
        <img 
          src={activeImage} 
          alt="নিরাপদ লেনদেন ব্যানার"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
          loading="lazy"
          onError={() => setFailedImages((prev) => ({ ...prev, [activeImage]: true }))}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
      </div>
      {validSlides.length > 1 && (
        <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex items-center gap-1.5 z-20">
          {validSlides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={'Slide ' + (idx + 1)}
              onClick={() => setCurrentAdSlide(idx)}
              className={'h-1.5 rounded-full transition-all duration-300 cursor-pointer ' + (
                safeIdx === idx ? 'w-4 bg-[#1A56DB]' : 'w-1.5 bg-white/60'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
});


export const SafeDealsEscrowView = React.memo(function SafeDealsEscrowView({ 
  liveUser, 
  syncLiveProfile, 
  appConfig, 
  onBack,
  allNotices = []
}: SafeDealsEscrowViewProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'confirmed' | 'shipped' | 'cancelled'>('all');
  const [showBalance, setShowBalance] = useState<boolean>(true);

  // States for localized transaction history
  const [txHistory, setTxHistory] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [showSectionTxHistory, setShowSectionTxHistory] = useState(false);
  const [txModalSearch, setTxModalSearch] = useState('');

  const fetchTxHistory = async () => {
    setLoadingTx(true);
    try {
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', liveUser.uid)
      );
      const snapshot = await getDocs(q);
      const list: Transaction[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Transaction);
      });
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setTxHistory(list);
    } catch (e) {
      console.error("Error fetching escrow tx:", e);
    } finally {
      setLoadingTx(false);
    }
  };

  // Compute total escrow balance currently locked in safe deals for this buyer
  const safeDealsBalance = orders
    .filter(order => 
      (order.buyerUid === liveUser.uid || order.buyerPhone === liveUser.phone) &&
      (order.status === 'Payment Held' || order.status === 'Shipped')
    )
    .reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0);

  const defaultDealsSlides = [
    {
      id: 1,
      image: "https://images.unsplash.com/photo-1563013544-824ae1d704d3?auto=format&fit=crop&q=80&w=800",
      title: "নিরাপদ ট্রাস্ট ও লেনদেন",
      description: "ডিজিটাল এসক্রো ব্যবস্থার সাথে প্রতিটি ডিল ও লেনদেন হোক সম্পূর্ণ নিরাপদ ও ঝুঁকিমুক্ত।"
    },
    {
      id: 2,
      image: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=800",
      title: "গ্রুপ বাই ডিল ও সমবায় পেমেন্ট",
      description: "ক্রেতা বিক্রেতার শতভাগ নিশ্চয়তা, টাকা থাকবে আমাদের সুরক্ষিত ওয়ালেটে।"
    }
  ];

  const adSlides = appConfig?.safeDealsBanners && appConfig.safeDealsBanners.length > 0 
    ? appConfig.safeDealsBanners 
    : defaultDealsSlides;



  // Trigger real-time sync with safe_deal_orders
  useEffect(() => {
    // Sync all escrow orders where liveUser is either the buyer or the seller, or if the user is an admin/sub_admin
    const unsubscribe = onSnapshot(collection(db, 'safe_deal_orders'), (snap) => {
      const list: any[] = [];
      snap.forEach((d) => {
        const data = d.data();
        // Include if associated with current user, or if admin/sub_admin
        if (
          liveUser.role === 'admin' || 
          liveUser.role === 'sub_admin' || 
          data.buyerUid === liveUser.uid || 
          data.sellerUid === liveUser.uid || 
          data.buyerPhone === liveUser.phone || 
          data.sellerPhone === liveUser.phone
        ) {
          list.push({ id: d.id, ...data });
        }
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setOrders(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [liveUser]);

  // Recipient resolution inside "টাকা পাঠান" form
  const [sendPhone, setSendPhone] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendPurpose, setSendPurpose] = useState('');
  const [sendPin, setSendPin] = useState('');
  const [resolvedRecipient, setResolvedRecipient] = useState<any | null>(null);
  const [checkingRecipient, setCheckingRecipient] = useState(false);
  
  useEffect(() => {
    const checkRecipient = async () => {
      const cleaned = sendPhone.trim();
      if (cleaned.length < 5) {
        setResolvedRecipient(null);
        return;
      }
      setCheckingRecipient(true);
      try {
        // Query users by Member ID
        const q1 = query(collection(db, 'users'), where('memberId', '==', cleaned));
        const snap1 = await getDocs(q1);
        if (!snap1.empty) {
          setResolvedRecipient({ id: snap1.docs[0].id, ...snap1.docs[0].data() });
          return;
        }

        // Query users by Phone
        const q2 = query(collection(db, 'users'), where('phone', '==', cleaned));
        const snap2 = await getDocs(q2);
        if (!snap2.empty) {
          setResolvedRecipient({ id: snap2.docs[0].id, ...snap2.docs[0].data() });
          return;
        }

        setResolvedRecipient(null);
      } catch (err) {
        console.error("Error checking recipient", err);
      } finally {
        setCheckingRecipient(false);
      }
    };

    const delayDebounce = setTimeout(() => {
      checkRecipient();
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [sendPhone]);

  // Modals visibility toggles
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copiedVoucher, setCopiedVoucher] = useState(false);
  const [voucherData, setVoucherData] = useState<{
    title: string;
    bookingId: string;
    amount: number;
    buyerName: string;
    buyerPhone: string;
    sellerName: string;
    sellerPhone: string;
    detail: string;
    courierName?: string;
    trackingNumber?: string;
    status: string;
    timestamp: string;
  } | null>(null);

  const [confirmModalData, setConfirmModalData] = useState<{
    title: string;
    description: string;
    actionLabel: string;
    onConfirm: () => void;
    type: 'release' | 'cancel';
    amount: number;
    bookingId: string;
  } | null>(null);

  // Seller ship variables
  const [courierName, setCourierName] = useState('সুন্দরবন কুরিয়ার');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [showShipForm, setShowShipForm] = useState(false);
  const [shipmentScreenshot, setShipmentScreenshot] = useState<string | null>(null);
  const [shipmentScreenshotName, setShipmentScreenshotName] = useState('');

  // Support & Dispute states
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeOrder, setDisputeOrder] = useState<any | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeContactPhone, setDisputeContactPhone] = useState(liveUser.phone || '');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [showSupportHistoryModal, setShowSupportHistoryModal] = useState(false);
  const [searchTicketNo, setSearchTicketNo] = useState('');
  const [searchTicketResult, setSearchTicketResult] = useState<any | null>(null);
  const [searchTicketError, setSearchTicketError] = useState('');
  const [searchingTicket, setSearchingTicket] = useState(false);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);

  // Safe Deals internal back handler
  useBackHandler(() => {
    if (showDisputeModal) { setShowDisputeModal(false); return true; }
    if (showSupportHistoryModal) { setShowSupportHistoryModal(false); return true; }
    if (showShipForm) { setShowShipForm(false); return true; }
    if (showSendModal) { setShowSendModal(false); return true; }
    if (showReceiveModal) { setShowReceiveModal(false); return true; }
    if (showHelpModal) { setShowHelpModal(false); return true; }
    if (showSectionTxHistory) { setShowSectionTxHistory(false); return true; }
    if (selectedOrder) { setSelectedOrder(null); return true; }
    if (voucherData) { setVoucherData(null); return true; }
    if (confirmModalData) { setConfirmModalData(null); return true; }
    return false;
  }, true, 25);

  // Sync support tickets real-time
  useEffect(() => {
    if (!liveUser?.uid) return;
    const q = (liveUser.role === 'admin' || liveUser.role === 'sub_admin')
      ? collection(db, 'escrow_disputes')
      : query(collection(db, 'escrow_disputes'), where('userId', '==', liveUser.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setSupportTickets(list);
    });
    return () => unsubscribe();
  }, [liveUser]);

  // Stats Counters
  const countPending = orders.filter(o => o.status === 'Payment Held').length;
  const countConfirmed = orders.filter(o => o.status === 'Payment Released').length;
  const countShipped = orders.filter(o => o.status === 'Shipped').length;
  const countCancelled = orders.filter(o => o.status === 'Cancelled' || o.status === 'Refunded').length;

  // Filter logic
  const filteredOrders = orders.filter(o => {
    if (activeFilter === 'pending') return o.status === 'Payment Held';
    if (activeFilter === 'confirmed') return o.status === 'Payment Released';
    if (activeFilter === 'shipped') return o.status === 'Shipped';
    if (activeFilter === 'cancelled') return o.status === 'Cancelled' || o.status === 'Refunded';
    return true; // 'all'
  });

  // Bengali Date helper
  const formatBengaliDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const bengaliMonths = [
      'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 
      'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
    ];
    const day = d.getDate();
    const month = bengaliMonths[d.getMonth()];
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;

    const bNum = (num: any) => {
      const numbers: Record<string, string> = {
        '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
        '5': '5', '6': '6', '7': '7', '8': '8', '9': '9'
      };
      return num.toString().split('').map((char: string) => numbers[char] || char).join('');
    };

    return `${bNum(day)} ${month}, ${bNum(year)} • ${bNum(hours)}:${bNum(minutes)} ${ampm}`;
  };

  // Convert English number to Bengali number helper
  const englishToBengaliNumber = (num: any) => {
    if (num === undefined || num === null) return '0';
    const numbers: Record<string, string> = {
      '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
      '5': '5', '6': '6', '7': '7', '8': '8', '9': '9'
    };
    return num.toString().split('').map((char: string) => numbers[char] || char).join('');
  };

  // Format money with commas in English first, then convert characters to Bengali digit
  const formatBengaliMoney = (value: number) => {
    const formatted = Number(value || 0).toLocaleString('en-US');
    return englishToBengaliNumber(formatted);
  };

  // Send Secure Escrow Money Execution
  const handleSendEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseFloat(sendAmount);
    if (!sendPhone || isNaN(cleanAmount) || cleanAmount <= 0) {
      setErrorMsg("অনুগ্রহ করে মোবাইল/আইডি এবং সঠিক টাকার পরিমাণ লিখুন।");
      return;
    }
    if (cleanAmount > liveUser.balance) {
      setErrorMsg(`আপনার অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স নেই! আপনার ব্যালেন্স মাত্র ৳${liveUser.balance.toLocaleString('bn-BD')} BDT।`);
      return;
    }
    if (sendPin !== liveUser.pin) {
      setErrorMsg("আপনার নিরাপত্তা পিন নম্বরটি সঠিক নয়!");
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const timestamp = new Date().toISOString();

      // Deduct sender's balance
      const senderRef = doc(db, 'users', liveUser.uid);
      await updateDoc(senderRef, {
        balance: liveUser.balance - cleanAmount,
        mainBalance: liveUser.balance - cleanAmount
      });

      // Create new safe deal escrow order
      const orderData = {
        buyerUid: liveUser.uid,
        buyerName: liveUser.name,
        buyerPhone: liveUser.phone,
        buyerMemberId: liveUser.memberId,
        sellerUid: resolvedRecipient ? resolvedRecipient.uid : '',
        sellerName: resolvedRecipient ? resolvedRecipient.name : 'অনিবন্ধিত প্রাপক',
        sellerPhone: resolvedRecipient ? resolvedRecipient.phone : sendPhone.trim(),
        sellerMemberId: resolvedRecipient ? resolvedRecipient.memberId : '',
        dealTitle: sendPurpose || 'নিরাপদ লেনদেন ডিল',
        totalAmount: cleanAmount,
        pricePerItem: cleanAmount,
        quantity: 1,
        status: 'Payment Held', // 'অপেক্ষমাণ' state
        createdAt: timestamp,
        courierName: '',
        trackingNumber: '',
        shipmentDate: '',
        statusHistory: [
          { status: 'Payment Held', timestamp, note: 'ক্রেতা মেইন ব্যালেন্স দিয়ে নিরাপদ লেনদেন শুরু করেছেন। টাকা সাময়িকভাবে এসক্রো সুরক্ষিত ওয়ালেটে হোল্ড করা হয়েছে।' }
        ]
      };

      const docRef = await addDoc(collection(db, 'safe_deal_orders'), orderData);
      // Dispatch real-time Admin Notification for Safe Deal booking
      addDoc(collection(db, 'admin_notifications'), {
        title: '🛡️ নতুন নিরাপদ লেনদেন (এসক্রো ডিল) বুকিং',
        message: `${liveUser.name || 'সদস্য'} (${liveUser.memberId || 'N/A'}) ৳${cleanAmount.toLocaleString('bn-BD')} টাকার একটি নতুন নিরাপদ লেনদেন শুরু করেছেন (প্রাপক: ${sendPhone})।`,
        userId: liveUser.uid,
        userName: liveUser.name || '',
        memberId: liveUser.memberId || '',
        userPhone: liveUser.phone || '',
        recipientPhone: sendPhone,
        amount: cleanAmount,
        type: 'safe_deal_booking',
        read: false,
        createdAt: timestamp
      }).catch(e => console.warn('Admin notif error:', e));

      // Log transaction for sender (Escrow Locked) as 'fee_payment' type compliant with schema
      await addDoc(collection(db, 'transactions'), {
        id: `tx-esc-held-${Date.now()}`,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        type: 'fee_payment',
        typeLabel: 'নিরাপদ লেনদেন হোল্ড',
        amount: cleanAmount,
        status: 'success',
        description: `নিরাপদ ডিল ফান্ড বুকিং: ${sendPurpose || 'লেনদেন'} (আইডি: ${docRef.id.substring(0, 6).toUpperCase()})। টাকা এসক্রো লক করা হয়েছে।`,
        createdAt: timestamp,
        paymentMethod: 'Main Balance'
      });

      // Log system notice for recipient
      if (resolvedRecipient) {
        await addDoc(collection(db, 'notices'), {
          title: `নিরাপদ লেনদেন জমার নিবেদন!`,
          content: `${liveUser.name} (BNB ID: ${liveUser.memberId}) আপনার ফোন নম্বরে ৳${cleanAmount.toLocaleString('bn-BD')} BDT এর একটি নিরাপদ লেনদেন বুকিং জমা করেছেন। ট্র্যাকিং জমা দিয়ে বা পণ্যটি পাঠিয়ে রিলিজ বুঝে নিন।`,
          createdAt: timestamp
        });
      }

      setShowSendModal(false);
      setSendPhone('');
      setSendAmount('');
      setSendPurpose('');
      setSendPin('');
      setResolvedRecipient(null);
      await syncLiveProfile();

      setVoucherData({
        title: "নিরাপদ লেনদেন ফান্ড বুকিং ভাউচার",
        bookingId: docRef.id.toUpperCase(),
        amount: cleanAmount,
        buyerName: liveUser.name,
        buyerPhone: liveUser.phone || liveUser.memberId,
        sellerName: resolvedRecipient ? resolvedRecipient.name : 'অনিবন্ধিত প্রাপক',
        sellerPhone: sendPhone,
        detail: sendPurpose || 'নিরাপদ লেনদেন ডিল',
        courierName: '-',
        trackingNumber: '-',
        status: 'অপেক্ষমাণ সুরক্ষায় হোল্ড (Held)',
        timestamp: new Date().toLocaleString('bn-BD')
      });

    } catch (err: any) {
      console.error(err);
      setErrorMsg("লেনদেন সম্পন্ন করা যায়নি: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Shipper updates tracking detail (Seller/Recipient)
  const handleShipProduct = async (order: any) => {
    if (!trackingNumber.trim()) {
      alert("অনুগ্রহ করে কুরিয়ার ট্র্যাকিং নাম্বার লিখুন।");
      return;
    }
    setSubmitting(true);
    try {
      const timestamp = new Date().toISOString();
      const orderRef = doc(db, 'safe_deal_orders', order.id);

      const updatedHistory = [
        ...(order.statusHistory || []),
        { status: 'Shipped', timestamp, note: `বিক্রেতা পণ্যটি শিপ করেছেন এবং ট্র্যাকিং তথ্য দিয়েছেনঃ ${courierName}, ট্র্যাকিং নং ${trackingNumber}` }
      ];

      await updateDoc(orderRef, {
        status: 'Shipped',
        courierName,
        trackingNumber,
        shipmentDate: new Date().toLocaleDateString('bn-BD'),
        statusHistory: updatedHistory,
        shipmentScreenshot: shipmentScreenshot || ''
      });

      // Notice to buyer
      await addDoc(collection(db, 'notices'), {
        title: `নিরাপদ লেনদেনঃ কুরিয়ার পণ্য বুকিং অ্যালার্ট!`,
        content: `আপনার বুকিংকৃত ডিল "${order.dealTitle}" এর বিপরীতে কুরিয়ার করা হয়েছে। ট্র্যাকিং নাম্বারঃ ${trackingNumber} (${courierName})। পণ্য হাতে পেয়ে অনুগ্রহ করে ওয়ালেটে পেমেন্ট রিলিজ নিশ্চিত করুন।`,
        createdAt: timestamp
      });

      setVoucherData({
        title: "নিরাপদ কুরিয়ার পণ্য ট্র্যাকিং রসিদ",
        bookingId: order.id.toUpperCase(),
        amount: order.totalAmount,
        buyerName: order.buyerName || 'ক্রেতা',
        buyerPhone: order.buyerPhone || '-',
        sellerName: order.sellerName || 'বিক্রেতা',
        sellerPhone: order.sellerPhone || '-',
        detail: order.dealTitle || 'নিরাপদ লেনদেন ডিল',
        courierName: courierName,
        trackingNumber: trackingNumber,
        status: 'পণ্য পাঠানো হয়েছে (Shipped)',
        timestamp: new Date().toLocaleString('bn-BD')
      });
      setShowShipForm(false);
      setTrackingNumber('');
      setShipmentScreenshot(null);
      setShipmentScreenshotName('');
      if (selectedOrder?.id === order.id) {
        setSelectedOrder({ 
          ...selectedOrder, 
          status: 'Shipped', 
          courierName, 
          trackingNumber,
          shipmentScreenshot: shipmentScreenshot || ''
        });
      }
    } catch (err: any) {
      alert("ত্রুটি: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Execute actual Release Funds logic
  const executeReleaseFunds = async (order: any) => {
    setConfirmModalData(null);
    setSubmitting(true);
    try {
      const timestamp = new Date().toISOString();
      const orderRef = doc(db, 'safe_deal_orders', order.id);

      // 1. Update order status to Payment Released
      const updatedHistory = [
        ...(order.statusHistory || []),
        { status: 'Payment Released', timestamp, note: 'ক্রেতা সন্তুষ্ট হয়ে সফলভাবে পণ্য বুঝে পেয়ে পেমেন্ট রিলিজ নিশ্চিত করেছেন।' }
      ];

      await updateDoc(orderRef, {
        status: 'Payment Released',
        approvedAt: timestamp,
        statusHistory: updatedHistory
      });

      // 2. Transfer funds to target seller/recipient's balance if they are registered users
      if (order.sellerUid) {
        const sellerRef = doc(db, 'users', order.sellerUid);
        const sellerSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', order.sellerUid)));
        if (!sellerSnap.empty) {
          const sellerData = sellerSnap.docs[0].data();
          await updateDoc(sellerRef, {
            balance: (sellerData.balance || 0) + order.totalAmount,
            mainBalance: (sellerData.balance || 0) + order.totalAmount
          });
        }

        // Log transaction for recipient (deposit credit)
        await addDoc(collection(db, 'transactions'), {
          id: `tx-esc-rec-${Date.now()}`,
          userId: order.sellerUid,
          userName: order.sellerName,
          memberId: order.sellerMemberId || 'SELLER',
          type: 'deposit',
          typeLabel: 'নিরাপদ লেনদেন প্রাপ্তি',
          amount: order.totalAmount,
          status: 'success',
          description: `নিরাপদ লেনদেন সম্পন্নঃ ক্রেতা পণ্য চেক করে টাকা রিলিজ করেছেন (মোবাইল: ${order.buyerPhone})।`,
          createdAt: timestamp,
          paymentMethod: 'Escrow Release'
        });
      }

      setVoucherData({
        title: "নিরাপদ লেনদেন নিষ্পত্তি ভাউচার (Released)",
        bookingId: order.id.toUpperCase(),
        amount: order.totalAmount,
        buyerName: order.buyerName || 'ক্রেতা',
        buyerPhone: order.buyerPhone || '-',
        sellerName: order.sellerName || 'বিক্রেতা',
        sellerPhone: order.sellerPhone || '-',
        detail: order.dealTitle || 'নিরাপদ লেনদেন ডিল',
        courierName: order.courierName || '-',
        trackingNumber: order.trackingNumber || '-',
        status: 'সম্পন্ন ও রিলিজড (Completed)',
        timestamp: new Date().toLocaleString('bn-BD')
      });
      setSelectedOrder(null);
      await syncLiveProfile();
    } catch (err: any) {
      alert("ত্রুটি: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Buyer Releases Funds to Seller
  const handleReleaseFunds = (order: any) => {
    setConfirmModalData({
      title: "পেমেন্ট রিলিজ নিশ্চিতকরণ",
      description: `আপনি কি এই ডিলটির পেমেন্ট সম্পন্ন করতে চান? আপনি পেমেন্ট নিশ্চিত করলে সরাসরি এই টাকা বিক্রেতার ব্যালেন্সে জমা হয়ে যাবে এবং এটি পরিবর্তন করা সম্ভব নয়।`,
      actionLabel: "হ্যাঁ, পেমেন্ট দিন",
      type: "release",
      amount: order.totalAmount,
      bookingId: order.id,
      onConfirm: () => executeReleaseFunds(order)
    });
  };

  // Execute actual Cancel/Refund Escrow logic
  const executeCancelEscrow = async (order: any) => {
    setConfirmModalData(null);
    setSubmitting(true);
    try {
      const timestamp = new Date().toISOString();
      const orderRef = doc(db, 'safe_deal_orders', order.id);

      // 1. Update order status
      const updatedHistory = [
        ...(order.statusHistory || []),
        { status: 'Refunded', timestamp, note: 'লেনদেন বাতিল করা হয়েছে এবং টাকা সম্পূর্ণ ফেরত পাঠানো হয়েছে।' }
      ];

      await updateDoc(orderRef, {
        status: 'Refunded',
        statusHistory: updatedHistory
      });

      // 2. Credit back the buyer's balance
      const buyerRef = doc(db, 'users', order.buyerUid);
      const buyerSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', order.buyerUid)));
      if (!buyerSnap.empty) {
        const buyerData = buyerSnap.docs[0].data();
        await updateDoc(buyerRef, {
          balance: (buyerData.balance || 0) + order.totalAmount
        });
      }

      // Log transaction for buyer credit
      await addDoc(collection(db, 'transactions'), {
        id: `tx-esc-refund-${Date.now()}`,
        userId: order.buyerUid,
        userName: order.buyerName,
        memberId: order.buyerMemberId,
        type: 'deposit',
        typeLabel: 'নিরাপদ লেনদেন রিফান্ড',
        amount: order.totalAmount,
        status: 'success',
        description: `নিরাপদ লেনদেন বুকিং রিফান্ডঃ ডিল বাতিল হওয়ার কারণে পেমেন্ট মেইন ব্যালেন্সে ক্রেডিট করা হয়েছে।`,
        createdAt: timestamp,
        paymentMethod: 'Escrow Refund'
      });

      setVoucherData({
        title: "নিরাপদ লেনদেন বাতিল ও রিফান্ড ভাউচার",
        bookingId: order.id.toUpperCase(),
        amount: order.totalAmount,
        buyerName: order.buyerName || 'ক্রেতা',
        buyerPhone: order.buyerPhone || '-',
        sellerName: order.sellerName || 'বিক্রেতা',
        sellerPhone: order.sellerPhone || '-',
        detail: order.dealTitle || 'নিরাপদ লেনদেন ডিল',
        courierName: order.courierName || '-',
        trackingNumber: order.trackingNumber || '-',
        status: 'রিফান্ডেড ও বাতিল (Refunded)',
        timestamp: new Date().toLocaleString('bn-BD')
      });
      setSelectedOrder(null);
      await syncLiveProfile();
    } catch (err: any) {
      alert("ত্রুটি: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel/Refund Transaction (Available to Seller freely OR Admin)
  const handleCancelEscrow = (order: any) => {
    setConfirmModalData({
      title: "লেনদেন বাতিল ও রিফান্ড নিশ্চিতকরণ",
      description: `আপনি কি নিশ্চিতভাবে এই লেনদেনটি বাতিল বা রিফান্ড করতে চান? বুকিংকৃত টাকা সরাসরি পুনরায় ক্রেতার মেইন ওয়ালেটে ফেরত দেওয়া হবে।`,
      actionLabel: "হ্যাঁ, বাতিল ও রিফান্ড করুন",
      type: "cancel",
      amount: order.totalAmount,
      bookingId: order.id,
      onConfirm: () => executeCancelEscrow(order)
    });
  };

  const handleOpenDisputeModal = (order: any) => {
    setDisputeOrder(order);
    setDisputeReason('');
    setDisputeContactPhone(liveUser.phone || '');
    setShowDisputeModal(true);
  };

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeOrder) return;
    if (!disputeReason.trim()) {
      alert("অনুগ্রহ করে আপনার অভিযোগের বিবরণ বিস্তারিত লিখুন।");
      return;
    }

    setSubmittingDispute(true);
    try {
      const timestamp = new Date().toISOString();
      const ticketId = `SUP-${Math.floor(100000 + Math.random() * 900000)}`;
      
      // Determine the sequential serial number
      const allDisputesSnap = await getDocs(collection(db, 'escrow_disputes'));
      const serialNo = allDisputesSnap.size + 1;

      const disputeDoc = {
        ticketId,
        serialNo,
        userId: liveUser.uid,
        userName: liveUser.name,
        userPhone: disputeContactPhone || liveUser.phone || '',
        orderId: disputeOrder.id,
        orderTitle: disputeOrder.dealTitle || 'নিরাপদ লেনদেন ডিল',
        amount: Number(disputeOrder.totalAmount) || 0,
        description: disputeReason.trim(),
        status: 'Pending', // Pending, Processing, Resolved
        createdAt: timestamp,
        whatsappSupportNumber: '01865911728',
        courierName: disputeOrder.courierName || 'N/A',
        trackingNumber: disputeOrder.trackingNumber || 'N/A',
        shipmentDate: disputeOrder.shipmentDate || 'N/A'
      };

      await addDoc(collection(db, 'escrow_disputes'), disputeDoc);
      // Dispatch real-time Admin Notification for Escrow Dispute
      addDoc(collection(db, 'admin_notifications'), {
        title: '🚨 নিরাপদ লেনদেন অভিযোগ ও সাপোর্ট টিকিট দাখিল',
        message: `${liveUser.name || 'সদস্য'} (${liveUser.memberId || 'N/A'}) ডিল #${disputeOrder.id?.substring(0, 8).toUpperCase()} এর বিপরীতে অভিযোগ দাখিল করেছেন (টিকিট: ${ticketId})।`,
        userId: liveUser.uid,
        userName: liveUser.name || '',
        memberId: liveUser.memberId || '',
        userPhone: disputeContactPhone || liveUser.phone || '',
        orderId: disputeOrder.id,
        ticketId: ticketId,
        amount: Number(disputeOrder.totalAmount) || 0,
        type: 'safe_deal_dispute',
        read: false,
        createdAt: timestamp
      }).catch(e => console.warn('Admin notif error:', e));

      // Add a notice to user about support ticket submission
      await addDoc(collection(db, 'notices'), {
        title: `অভিযোগ সাবমিট সম্পন্নঃ রসিদ নং ${ticketId}`,
        content: `আপনার নিরাপদ লেনদেন ডিল "${disputeOrder.dealTitle}" এর বিপরীতে অভিযোগটি সফলভাবে রেজিস্টার করা হয়েছে। সিরিয়াল নংঃ ${serialNo}। আমাদের গ্রাহক সেবা প্রতিনিধি আপনার সাথে হোয়াটসঅ্যাপে (01865911728) যোগাযোগ করবেন।`,
        createdAt: timestamp
      });

      alert(`আলহামদুলিল্লাহ! আপনার অভিযোগটি সফলভাবে রেকর্ড করা হয়েছে।\nরসিদ নম্বর: ${ticketId}\nআপনার অভিযোগের সিরিয়াল নং: ${serialNo}`);
      
      setShowDisputeModal(false);
      setDisputeOrder(null);
      setDisputeReason('');
      
      // Open support tracker to let them see it
      setShowSupportHistoryModal(true);

    } catch (err: any) {
      console.error(err);
      alert("অভিযোগ সাবমিট করা যায়নি: " + err.message);
    } finally {
      setSubmittingDispute(false);
    }
  };

  const handleSearchTicket = async () => {
    const queryStr = searchTicketNo.trim().toUpperCase();
    if (!queryStr) {
      setSearchTicketError('অনুগ্রহ করে সঠিক রসিদ নম্বর দিন।');
      return;
    }
    setSearchingTicket(true);
    setSearchTicketResult(null);
    setSearchTicketError('');
    try {
      const q = query(
        collection(db, 'escrow_disputes'),
        where('ticketId', '==', queryStr)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setSearchTicketError('দুঃখিত, এই রসিদ নম্বরের কোনো অভিযোগ পাওয়া যায়নি। অনুগ্রহ করে সঠিক রসিদ নম্বর টাইপ করুন।');
      } else {
        setSearchTicketResult({ id: snap.docs[0].id, ...snap.docs[0].data() });
      }
    } catch (err: any) {
      setSearchTicketError('অনুসন্ধান ব্যর্থ হয়েছেঃ ' + err.message);
    } finally {
      setSearchingTicket(false);
    }
  };

  return (
    <div className="bg-[#0b6623] min-h-screen text-slate-800 font-sans flex flex-col">
      {/* Green Top Header Section matching Home Dashboard */}
      <header className="bg-gradient-to-b from-[#0b6623] via-[#005a36] to-[#004d1a] px-3.5 sm:px-4 pt-2.5 pb-3 text-white shadow-sm space-y-2.5 rounded-b-[28px] border-b border-emerald-700/60 w-full z-20">
        <div className="max-w-2xl mx-auto space-y-2.5">
          {/* Top Bar Controls */}
          <div className="flex items-center justify-between gap-1 w-full flex-nowrap">
            <div className="flex items-center gap-1.5">
              <UnifiedBackButton
                onClick={() => {
                  if (showDisputeModal) { setShowDisputeModal(false); return; }
                  if (showSupportHistoryModal) { setShowSupportHistoryModal(false); return; }
                  if (showShipForm) { setShowShipForm(false); return; }
                  if (showSendModal) { setShowSendModal(false); return; }
                  if (showReceiveModal) { setShowReceiveModal(false); return; }
                  if (showHelpModal) { setShowHelpModal(false); return; }
                  if (showSectionTxHistory) { setShowSectionTxHistory(false); return; }
                  if (selectedOrder) { setSelectedOrder(null); return; }
                  if (voucherData) { setVoucherData(null); return; }
                  if (confirmModalData) { setConfirmModalData(null); return; }
                  if (onBack) onBack();
                }}
                variant="dark"
                title="পিছনে যান"
              />

              <button 
                type="button"
                onClick={() => {
                  fetchTxHistory();
                  setShowSectionTxHistory(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-white/20 hover:bg-white/30 text-white text-[10px] sm:text-xs font-black rounded-xl border border-white/25 shadow-4xs cursor-pointer transition-all shrink-0 active:scale-95"
                title="নিরাপদ লেনদেন খতিয়ান"
              >
                <ClipboardList className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-200" />
                <span>খতিয়ান</span>
              </button>
            </div>

            {/* Dual Balance Widget (Main Balance on Left, Safe Deal locked balance on Right) */}
            <button
              type="button"
              onClick={() => setShowBalance(!showBalance)}
              className="flex items-center bg-black/20 backdrop-blur-md border border-white/25 rounded-full p-0.5 shadow-inner hover:bg-black/30 transition cursor-pointer select-none text-left shrink-0 scale-95 sm:scale-100 origin-right text-white"
            >
              {/* Main Balance */}
              <div className="flex items-center gap-0.5 px-2 py-0.5 sm:py-1 bg-emerald-500/35 text-white rounded-full">
                <span className="w-3.5 h-3.5 rounded-full bg-white text-[#005a36] flex items-center justify-center text-[8px] font-sans font-black shrink-0">৳</span>
                <div className="flex flex-col leading-none">
                  <span className="text-[6.5px] uppercase tracking-wider text-emerald-200 font-black">মেইন</span>
                  <span className="text-[10px] font-bold font-mono text-white">
                    {showBalance ? `৳${(liveUser.balance || 0).toLocaleString('bn-BD')}` : '••••'}
                  </span>
                </div>
              </div>

              {/* Separator / Divider */}
              <div className="w-[1px] h-3.5 bg-white/20 mx-0.5" />

              {/* Safe Deals Held Balance */}
              <div className="flex items-center gap-0.5 px-2 py-0.5 sm:py-1 text-white">
                <span className="w-3.5 h-3.5 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center text-[8px] font-sans font-black shrink-0">৳</span>
                <div className="flex flex-col leading-none">
                  <span className="text-[6.5px] uppercase tracking-wider text-amber-300 font-black">
                    নিরাপদ<span className="hidden xs:inline"> লেনদেন</span>
                  </span>
                  <span className="text-[10px] font-bold font-mono text-amber-200">
                    {showBalance ? `৳${safeDealsBalance.toLocaleString('bn-BD')}` : '••••'}
                  </span>
                </div>
              </div>

              {/* Toggle Eye Icon */}
              <div className="pl-0.5 pr-1.5 text-white/70 hover:text-white transition shrink-0">
                {showBalance ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              </div>
            </button>
          </div>

          {/* Urgent Notice Scroll Ticker (ঘোষণা) - Seamless inside green header, NO separate box border line */}
          <div className="flex items-center gap-2.5 overflow-hidden w-full pt-1 px-0.5">
            <div className="bg-white text-[#005a36] text-[10.5px] font-black px-3 py-1 rounded-full shrink-0 shadow-xs flex items-center gap-1">
              <span>ঘোষণা</span>
            </div>
            <div className="flex-grow overflow-hidden relative mr-1">
              <marquee className="text-[12px] font-bold text-white leading-none py-0.5 tracking-wide" behavior="scroll" direction="left" scrollamount="4">
                {appConfig?.escrowTicker || "BNB নিরাপদ লেনদেনঃ যেকোনো প্রোডাক্ট কুরিয়ার কন্ডিশনে ক্রয়ের পূর্বে এসক্রো ডিল বুকিং করে আপনার মেইন ব্যালেন্সের পেমেন্ট নিরাপদ করুন।"}
              </marquee>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow bg-slate-50 w-full max-w-2xl mx-auto p-3.5 sm:p-4 space-y-4 sm:space-y-5 pb-28">
        {(() => {
          const dealNotices = allNotices.filter(n => n.section === 'safe_deal');
          if (dealNotices.length === 0) return null;
          return (
            <div className="space-y-2">
              {dealNotices.map((n, idx) => (
                <div key={`${n.id}-${idx}`} className="bg-gradient-to-r from-[#005a36] to-[#004d1a] border border-emerald-500/50 p-3.5 rounded-2xl text-left relative overflow-hidden shadow-sm text-white">
                  <div className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-white/20 text-white flex items-center justify-center text-xs shrink-0 mt-0.5 border border-white/20">📢</span>
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-black text-white leading-snug">{n.title}</h4>
                      <p className="text-[11px] text-emerald-100 font-medium leading-normal">{n.content}</p>
                      <span className="text-[8.5px] text-emerald-300 font-mono block pt-0.5">{new Date(n.createdAt).toLocaleDateString('bn-BD')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Custom Support & Dispute tracker button */}
        <button
          type="button"
          onClick={() => setShowSupportHistoryModal(true)}
          className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold py-3.5 px-4 rounded-2xl text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-md border border-amber-400/40 active:scale-98"
        >
          <AlertTriangle className="w-4 h-4 text-white animate-pulse" />
          <span>অভিযোগ ট্র্যাকিং ও কাস্টমার কেয়ার (Support Desk)</span>
        </button>
        
        {/* 2. YOUTUBE SIZE BANNER (Memoized isolated slider) */}
        <SafeDealsBannerSlider adSlides={adSlides} />

        {/* 3. TWO ACTION CARDS - HARMONIZED GREEN-WHITE THEME */}
        <div className="grid grid-cols-2 bg-white rounded-[32px] overflow-hidden border border-[#E2E8F0] shadow-sm divide-x divide-[#E2E8F0]">
          
          {/* Card A: টাকা গ্রহণ করুন (Left Green) */}
          <div className="bg-[#EEFBF6] py-8 sm:py-10 px-4 text-center flex flex-col items-center justify-between">
            <div className="w-full">
              {/* Green circle with down arrow */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white flex items-center justify-center border border-[#D5F3E5] shadow-xs mx-auto mb-4">
                <ArrowDown className="w-7 h-7 sm:w-8 sm:h-8 text-[#008F56] stroke-[3.5]" />
              </div>

              <h3 className="text-lg sm:text-[22px] font-black text-[#008F56] tracking-tight text-center leading-none">
                টাকা গ্রহণ করুন
              </h3>
              <p className="text-[#475569] text-xs sm:text-[13px] font-black text-center leading-relaxed mt-3 whitespace-pre-line">
                কেউ টাকা পাঠালে{"\n"}এখানে গ্রহণ করুন
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowReceiveModal(true);
              }}
              className="mt-6 bg-[#008955] hover:bg-[#007346] active:scale-95 text-white font-black text-xs sm:text-[13px] tracking-wide py-2.5 sm:py-3 px-5 sm:px-6 rounded-full transition-transform w-[130px] sm:w-[155px] shadow-sm cursor-pointer text-center leading-none"
            >
              টাকা গ্রহণ করুন
            </button>
          </div>

          {/* Card B: টাকা পাঠান (Right Green Harmonized Theme) */}
          <div className="bg-[#F0FAF5] py-8 sm:py-10 px-4 text-center flex flex-col items-center justify-between">
            <div className="w-full">
              {/* Emerald circle with paper plane */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white flex items-center justify-center border border-[#C2EED8] shadow-xs mx-auto mb-4">
                <Send className="w-7 h-7 sm:w-8 sm:h-8 text-[#006A3E] stroke-[2.5] -rotate-45 translate-x-0.5 -translate-y-0.5" />
              </div>

              <h3 className="text-lg sm:text-[22px] font-black text-[#006A3E] tracking-tight text-center leading-none">
                টাকা পাঠান
              </h3>
              <p className="text-[#475569] text-xs sm:text-[13px] font-black text-center leading-relaxed mt-3 whitespace-pre-line">
                কার্ডে টাকা পাঠিয়ে{"\n"}নিরাপদে রাখুন
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowSendModal(true)}
              className="mt-6 bg-[#006A3E] hover:bg-[#005230] active:scale-95 text-white font-black text-xs sm:text-[13px] tracking-wide py-2.5 sm:py-3 px-5 sm:px-6 rounded-full transition-transform w-[130px] sm:w-[155px] shadow-sm cursor-pointer text-center leading-none"
            >
              টাকা পাঠান
            </button>
          </div>

        </div>

        {/* 4. MY TRANSACTIONS SECTION & COUNTS */}
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-[14.5px] font-black text-slate-900">আমার লেনদেন</h3>
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              সব দেখুন <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 4 Status summary cards matching the image alignment */}
          <div className="grid grid-cols-4 gap-1 sm:gap-3">
            {/* Stat 1: অপেক্ষমাণ */}
            <button
              type="button"
              onClick={() => setActiveFilter('pending')}
              className={`p-1.5 xs:p-2 sm:p-3.5 rounded-xl sm:rounded-2xl space-y-0.5 sm:space-y-1 transition-all border text-left ${
                activeFilter === 'pending' 
                  ? 'bg-blue-150 border-blue-400 ring-2 ring-blue-150' 
                  : 'bg-[#F0F5FF] hover:bg-blue-100/60 border-blue-50'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-1.5">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-[#2563EB] stroke-[2.5] shrink-0" />
                <span className="text-[8.5px] xs:text-[10px] sm:text-[11px] font-black text-[#2563EB] truncate">অপেক্ষমাণ</span>
              </div>
              <p className="text-xs sm:text-[19px] font-black text-slate-900 font-sans mt-1 sm:mt-1.5 leading-none truncate">
                • {englishToBengaliNumber(countPending)} টি
              </p>
              <p className="text-[8px] sm:text-[10px] text-slate-500 font-extrabold mt-0.5 sm:mt-1 truncate">টাকা ছাড় হয় নি</p>
            </button>

            {/* Stat 2: নিশ্চিত হয়েছে */}
            <button
              type="button"
              onClick={() => setActiveFilter('confirmed')}
              className={`p-1.5 xs:p-2 sm:p-3.5 rounded-xl sm:rounded-2xl space-y-0.5 sm:space-y-1 transition-all border text-left ${
                activeFilter === 'confirmed' 
                  ? 'bg-emerald-150 border-emerald-400 ring-2 ring-emerald-150' 
                  : 'bg-[#ECFDF5] hover:bg-emerald-100/60 border-emerald-50'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-1.5">
                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-[#059669] stroke-[2.5] shrink-0" />
                <span className="text-[8.5px] xs:text-[10px] sm:text-[11px] font-black text-[#059669] truncate">নিশ্চিত হয়েছে</span>
              </div>
              <p className="text-xs sm:text-[19px] font-black text-slate-900 font-sans mt-1 sm:mt-1.5 leading-none truncate">
                • {englishToBengaliNumber(countConfirmed)} টি
              </p>
              <p className="text-[8px] sm:text-[10px] text-slate-500 font-extrabold mt-0.5 sm:mt-1 truncate">লেনদেন সম্পন্ন</p>
            </button>

            {/* Stat 3: পথে পাঠানো */}
            <button
              type="button"
              onClick={() => setActiveFilter('shipped')}
              className={`p-1.5 xs:p-2 sm:p-3.5 rounded-xl sm:rounded-2xl space-y-0.5 sm:space-y-1 transition-all border text-left ${
                activeFilter === 'shipped' 
                  ? 'bg-amber-150 border-amber-400 ring-2 ring-amber-150' 
                  : 'bg-[#FFFBEB] hover:bg-amber-100/60 border-amber-100/40'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-1.5">
                <Truck className="w-3 h-3 sm:w-4 sm:h-4 text-[#D97706] stroke-[2.5] shrink-0" />
                <span className="text-[8.5px] xs:text-[10px] sm:text-[11px] font-black text-[#B45309] truncate">পথে পাঠানো</span>
              </div>
              <p className="text-xs sm:text-[19px] font-black text-slate-900 font-sans mt-1 sm:mt-1.5 leading-none truncate">
                • {englishToBengaliNumber(countShipped)} টি
              </p>
              <p className="text-[8px] sm:text-[10px] text-slate-500 font-extrabold mt-0.5 sm:mt-1 truncate">নিশ্চিতের অপেক্ষায়</p>
            </button>

            {/* Stat 4: বাতিল */}
            <button
              type="button"
              onClick={() => setActiveFilter('cancelled')}
              className={`p-1.5 xs:p-2 sm:p-3.5 rounded-xl sm:rounded-2xl space-y-0.5 sm:space-y-1 transition-all border text-left ${
                activeFilter === 'cancelled' 
                  ? 'bg-rose-150 border-rose-400 ring-2 ring-rose-150' 
                  : 'bg-[#FFF5F5] hover:bg-rose-100/60 border-rose-100/40'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-1.5">
                <XCircle className="w-3 h-3 sm:w-4 sm:h-4 text-[#E11D48] stroke-[2.5] shrink-0" />
                <span className="text-[8.5px] xs:text-[10px] sm:text-[11px] font-black text-[#E11D48] truncate">বাতিল</span>
              </div>
              <p className="text-xs sm:text-[19px] font-black text-slate-900 font-sans mt-1 sm:mt-1.5 leading-none truncate">
                • {englishToBengaliNumber(countCancelled)} টি
              </p>
              <p className="text-[8px] sm:text-[10px] text-slate-500 font-extrabold mt-0.5 sm:mt-1 truncate">লেনদেন বাতিল</p>
            </button>
          </div>
        </div>

        {/* 5. RECENT TRANSACTIONS SECTION ("সাম্প্রতিক লেনদেন") */}
        <div className="space-y-3 pt-2 text-left">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-black text-slate-900 flex items-center gap-1.5">
              সাম্প্রতিক লেনদেন
              {activeFilter !== 'all' && (
                <span className="text-[9px] font-extrabold bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full select-none flex items-center gap-1">
                  ফিল্টারঃ {activeFilter === 'pending' ? 'অপেক্ষমাণ' : activeFilter === 'confirmed' ? 'সম্পন্ন' : activeFilter === 'shipped' ? 'পণ্য পাঠানো' : 'বাতিল'}
                  <button onClick={() => setActiveFilter('all')} className="hover:text-red-600 font-black ml-1 text-slate-500">×</button>
                </span>
              )}
            </h3>
            <span className="text-[10px] text-slate-400 font-bold">রিয়েল-টাইম ডাটাবেস</span>
          </div>

          {loading ? null : filteredOrders.length === 0 ? (
            <div className="p-10 text-center border-2 border-dashed border-slate-200 bg-white rounded-3xl text-slate-450 text-xs font-bold">
              এই ক্যাটাগরিতে কোনো বুকিং লেনদেন পাওয়া যায়নি।
            </div>
          ) : (
            <div className="bg-white border border-slate-200/85 rounded-3xl overflow-hidden divide-y divide-slate-100 shadow-3xs">
              {filteredOrders.map((order, idx) => {
                const isBuyer = order.buyerUid === liveUser.uid;
                const otherPartyName = isBuyer ? order.sellerName : order.buyerName;
                const initials = otherPartyName ? otherPartyName.charAt(0).toUpperCase() : 'B';
                
                // Subtitle label determine
                let labelText = isBuyer ? 'টাকা পাঠিয়েছেন' : 'টাকা পেয়েছেন';
                if (order.status === 'Cancelled' || order.status === 'Refunded') {
                  labelText = 'লেনদেন বাতিল';
                }

                // Render dynamic status pill on transaction item
                let statusBadgeColor = 'bg-blue-50 text-blue-700 border-blue-100';
                let statusText = 'অপেক্ষমাণ';
                if (order.status === 'Payment Released') {
                  statusBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                  statusText = 'সম্পন্ন';
                } else if (order.status === 'Cancelled' || order.status === 'Refunded') {
                  statusBadgeColor = 'bg-rose-50 text-rose-700 border-rose-100';
                  statusText = 'বাতিল';
                } else if (order.status === 'Shipped') {
                  statusBadgeColor = 'bg-amber-50 text-amber-700 border-amber-100';
                  statusText = 'পণ্য পাঠানো';
                }

                // Assign background pattern to Avatar based on initials to match screenshot
                const charCode = initials.charCodeAt(0) || 65;
                const avatarBg = charCode % 3 === 0 
                  ? 'bg-blue-600' 
                  : charCode % 3 === 1 
                    ? 'bg-emerald-600' 
                    : 'bg-amber-500';

                return (
                  <div 
                    key={`${order.id}-${idx}`}
                    onClick={() => setSelectedOrder(order)}
                    className="p-4 flex items-center justify-between hover:bg-slate-50 transition-all cursor-pointer font-sans"
                  >
                    {/* Left details */}
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${avatarBg} text-white font-extrabold text-base rounded-full flex items-center justify-center shadow-3xs`}>
                        {initials}
                      </div>
                      
                      <div className="text-left space-y-0.5">
                        <h4 className="text-xs sm:text-sm font-black text-slate-905 text-gray-900 leading-normal">{otherPartyName || 'কো-অপারেটিভ মেম্বার'}</h4>
                        <p className={`text-[10px] font-bold ${order.status === 'Cancelled' || order.status === 'Refunded' ? 'text-rose-500' : 'text-slate-450'}`}>
                          {labelText}
                        </p>
                      </div>
                    </div>

                    {/* Right part */}
                    <div className="flex items-center gap-3">
                      <div className="text-right space-y-0.5">
                        <p className="text-sm sm:text-base font-black text-slate-900 font-mono">
                          ৳ {formatBengaliMoney(order.totalAmount)}
                        </p>
                        <p className="text-[9.5px] text-slate-400 font-semibold font-mono">
                          {formatBengaliDate(order.createdAt)}
                        </p>
                      </div>

                      {/* Status pill & arrow */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${statusBadgeColor}`}>
                          {statusText}
                        </span>
                        <ChevronRight className="w-4 const h-4 text-slate-400" />
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

      {/* MODAL I: টাকা পাঠান (Send secure money form) */}
      <AnimatePresence>
        {showSendModal && (
          <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900/60 backdrop-blur-sm">
            <div className="h-10 shrink-0 bg-[#004a2c] w-full"></div>
            
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="flex-1 bg-white rounded-t-[32px] flex flex-col overflow-hidden font-sans"
            >
              <div className="bg-[#004a2c] text-white px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <Send className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-black">নিরাপদ এসক্রো টাকা পাঠান</h3>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    setShowSendModal(false);
                    setErrorMsg('');
                  }}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <form onSubmit={handleSendEscrow} className="space-y-6">
                  {/* Search recipient */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">প্রাপকের মোবাইল নম্বর অথবা মেম্বার আইডি *</label>
                    <div className="relative">
                      <input 
                        type="text"
                        required
                        placeholder="উদাঃ BNB00005327 অথবা মোবাইল"
                        value={sendPhone}
                        onChange={(e) => setSendPhone(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 text-slate-900 rounded-2xl focus:outline-none focus:border-emerald-500 font-mono text-sm pl-12 shadow-inner transition-all"
                      />
                      <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
                    </div>

                    {checkingRecipient && (
                      <div className="flex items-center gap-2 text-[10px] text-emerald-600 font-black animate-pulse px-1">
                        <div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                        ডাটাবেসে প্রাপক খোঁজা হচ্ছে...
                      </div>
                    )}

                    {resolvedRecipient ? (
                      <div className="bg-emerald-50 border-2 border-emerald-100 p-4 rounded-2xl flex items-center justify-between text-xs shadow-sm animate-in zoom-in duration-300">
                        <div className="text-left space-y-1">
                          <p className="font-black text-emerald-800 flex items-center gap-1.5 uppercase tracking-wide">
                            <CheckCircle className="w-4 h-4" /> প্রাপক সঠিকঃ
                          </p>
                          <p className="text-slate-700 font-black text-sm">{resolvedRecipient.name}</p>
                          <p className="text-slate-500 font-bold text-[10px]">{resolvedRecipient.memberId || 'সাধারণ সদস্য'} • {resolvedRecipient.phone}</p>
                        </div>
                        <span className="text-[10px] font-black bg-emerald-600 text-white px-3 py-1 rounded-full shadow-sm">ভেরিফাইড</span>
                      </div>
                    ) : sendPhone.length >= 5 && !checkingRecipient && (
                      <div className="bg-rose-50 border-2 border-rose-100 p-4 rounded-2xl text-xs text-rose-800 leading-relaxed font-black shadow-sm animate-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertCircle className="w-4 h-4" />
                          <span className="uppercase tracking-wider">ত্রুটি</span>
                        </div>
                        প্রাপক ডাটাবেসে নিবন্ধিত পাওয়া যায়নি। আপনার দেওয়া তথ্য পুনরায় নিশ্চিত করুন।
                      </div>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">টাকার পরিমাণ (৳ BDT) *</label>
                    <div className="relative">
                      <input 
                        type="number"
                        required
                        min="100"
                        placeholder="নূন্যতম 100 টাকা"
                        value={sendAmount}
                        onChange={(e) => setSendAmount(e.target.value)}
                        className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-200 text-slate-900 rounded-2xl text-xl font-black focus:border-emerald-500 font-mono text-center shadow-inner transition-all"
                      />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">৳</span>
                    </div>
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">বর্তমান ব্যালেন্সঃ</p>
                      <p className="text-[11px] text-emerald-700 font-black">৳ {(liveUser.balance || 0).toLocaleString('bn-BD')} BDT</p>
                    </div>
                  </div>

                  {/* Purpose/Description */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">লেনদেনের উদ্দেশ্য / বিবরণ (ঐচ্ছিক)</label>
                    <textarea 
                      rows={2}
                      placeholder="উদাঃ শাড়ি ও জামা কাপড়ের পেমেন্ট"
                      value={sendPurpose}
                      onChange={(e) => setSendPurpose(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 text-slate-900 rounded-2xl text-sm font-bold focus:border-emerald-500 shadow-inner transition-all"
                    />
                  </div>

                  {/* Security Pin */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">আপনার 4 ডিজিটের নিরাপত্তা পিন নাম্বার *</label>
                    <input 
                      type="password"
                      required
                      maxLength={4}
                      placeholder="••••"
                      value={sendPin}
                      onChange={(e) => setSendPin(e.target.value)}
                      className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-200 text-slate-900 rounded-2xl text-center focus:border-emerald-500 font-mono tracking-[1em] text-xl shadow-inner transition-all"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black py-4 px-6 rounded-2xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-3 cursor-pointer text-base active:scale-95"
                    >
                      {submitting ? (
                        <>
                          <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                          <span>টাকা পাঠানো হচ্ছে...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-5 h-5" />
                          <span>বুকিং নিশ্চিত ও সুরক্ষিত হোল্ড করুন</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL II: টাকা গ্রহণ করুন (Receive/Accept orders list overlay) */}
      <AnimatePresence>
        {showReceiveModal && (
          <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900/60 backdrop-blur-sm">
            <div className="h-10 shrink-0 bg-[#004a2c] w-full"></div>
            
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="flex-1 bg-white rounded-t-[32px] flex flex-col overflow-hidden font-sans"
            >
              <div className="bg-[#004a2c] text-white px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <ArrowDown className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-black">সুরক্ষিত ডিল টাকা ও কুরিয়ার গ্রহণ করুন</h3>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowReceiveModal(false)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Find list where Seller is current user and status is Payment Held */}
                {(() => {
                  const pendingSales = orders.filter(o => o.sellerUid === liveUser.uid && o.status === 'Payment Held');
                  return (
                    <div className="space-y-4">
                      <div className="bg-emerald-50 border-2 border-emerald-100 p-4 rounded-2xl">
                        <p className="text-xs text-emerald-800 font-bold leading-relaxed">
                          কেউ নিরাপদ লেনদেনের মাধ্যমে আপনাকে টাকা বুকিং করলে নিচে দেখতে পাবেন এবং কুরিয়ার প্রদানের পর রিলিজ নিতে পারবেনঃ
                        </p>
                      </div>
                      
                      {pendingSales.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-6 text-center border-2 border-dashed border-slate-200 rounded-[32px] bg-slate-50/50 space-y-4">
                          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm text-slate-300">
                            <Clock className="w-8 h-8" />
                          </div>
                          <p className="text-sm text-slate-400 font-black leading-relaxed">
                            আপাতত আপনার জন্য কোনো পেন্ডিং বুকিং পাওয়া যায়নি। ক্রেতাদের আপনার BNB মোবাইল নম্বরে বা BNB মেম্বার আইডিতে "টাকা পাঠান" সেকশন ব্যবহার করে পেমেন্ট করার কথা বলুন।
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {pendingSales.map((item, idx) => (
                            <div key={`${item.id}-${idx}`} className="p-5 bg-white border-2 border-slate-100 rounded-[28px] space-y-4 shadow-sm hover:border-emerald-200 transition-all">
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner">
                                    {item.buyerName ? item.buyerName.charAt(0).toUpperCase() : 'B'}
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-black text-slate-800">{item.buyerName}</h4>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wider">ID: {item.buyerMemberId}</span>
                                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">#{item.id.substring(0, 6).toUpperCase()}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-black text-emerald-700 font-mono">৳ {item.totalAmount.toLocaleString('bn-BD')}</p>
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">বুকিং ফান্ড</p>
                                </div>
                              </div>

                              <div className="bg-slate-50 p-4 rounded-2xl space-y-1.5 border border-slate-100">
                                <span className="text-[9px] uppercase font-black tracking-[0.1em] text-slate-400 block">লেনদেনের উদ্দেশ্য ও বিবরণঃ</span>
                                <p className="text-xs text-slate-700 font-bold italic leading-relaxed">
                                  "{item.dealTitle || 'নিরাপদ ক্রয় ডিল'}"
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedOrder(item);
                                  setShowReceiveModal(false);
                                }}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 px-4 rounded-2xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/10 active:scale-95"
                              >
                                <span>পণ্য শিপিং ট্র্যাকিং বা রিফান্ড পরিচালনা করুন</span>
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL III: TRANSACTION DETAIL TIMELINE MODAL */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900/60 backdrop-blur-sm">
            <div className="h-10 shrink-0 bg-[#004a2c] w-full"></div>
            
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="flex-1 bg-white rounded-t-[32px] flex flex-col overflow-hidden font-sans"
            >
              <div className="bg-[#004a2c] text-white px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black leading-tight">নিরাপদ লেনদেন ভাউচার</h3>
                    <p className="text-[10px] text-emerald-100/70 font-medium tracking-wide uppercase">Booking ID: #{selectedOrder.id.toUpperCase()}</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    setSelectedOrder(null);
                    setShowShipForm(false);
                  }}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Status & money summary card */}
                <div className="bg-slate-50 border-2 border-slate-100 p-6 rounded-[32px] space-y-3 text-center relative overflow-hidden shadow-sm">
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                    <ShieldCheck className="w-20 h-20" />
                  </div>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] block">বুকিং পেমেন্ট পরিমাণ</p>
                  <h2 className="text-3xl font-black text-slate-900 font-mono">
                    ৳ {formatBengaliMoney(selectedOrder.totalAmount)}
                  </h2>
                  
                  <div className={`inline-flex items-center gap-2 py-2 px-4 rounded-full text-xs font-black shadow-sm border-2 ${
                    selectedOrder.status === 'Payment Held' ? 'bg-blue-50 border-blue-100 text-blue-700' : 
                    selectedOrder.status === 'Payment Released' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 
                    selectedOrder.status === 'Shipped' ? 'bg-amber-50 border-amber-100 text-amber-700' : 
                    'bg-rose-50 border-rose-100 text-rose-700'
                  }`}>
                    <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                    <span>
                      {selectedOrder.status === 'Payment Held' ? '⏳ অপেক্ষমাণ হোল্ড' : 
                       selectedOrder.status === 'Payment Released' ? '✓ সম্পন্ন (Paid)' : 
                       selectedOrder.status === 'Shipped' ? '🚚 পণ্য পাঠানো হয়েছে' : '❌ বাতিল ও ফেরতকৃত'}
                    </span>
                  </div>
                </div>

                {/* Deal description metadata details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                    <span className="text-slate-400 block text-[9px] font-black uppercase tracking-wider">টাকা পেয়ার (ক্রেতা)</span>
                    <p className="text-slate-800 font-black text-xs truncate">{selectedOrder.buyerName}</p>
                    <p className="text-slate-500 font-mono text-[10px] font-bold">{selectedOrder.buyerPhone}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                    <span className="text-slate-400 block text-[9px] font-black uppercase tracking-wider">টাকা প্রাপক (বিক্রেতা)</span>
                    <p className="text-slate-800 font-black text-xs truncate">{selectedOrder.sellerName}</p>
                    <p className="text-slate-500 font-mono text-[10px] font-bold">{selectedOrder.sellerPhone}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-slate-400 block text-[10px] font-black uppercase tracking-widest px-1">লেনদেনের উদ্দেশ্য ও বিবরণঃ</span>
                  <div className="p-4 bg-emerald-50/50 border-2 border-emerald-100/50 rounded-2xl italic font-bold leading-relaxed text-slate-700 text-xs shadow-inner">
                    "{selectedOrder.dealTitle || 'সুরক্ষিত ক্রয় লেনদেন ডিল'}"
                  </div>
                </div>

                {selectedOrder.courierName && (
                  <div className="bg-sky-50 border-2 border-sky-100 p-5 rounded-[28px] space-y-4 shadow-sm">
                    <div className="flex items-center justify-between border-b border-sky-200/50 pb-3">
                      <p className="font-black text-sky-900 flex items-center gap-2 uppercase tracking-wider text-xs">
                        <Truck className="w-4 h-4 text-sky-700" /> শিপিং ট্র্যাকিং তথ্যঃ
                      </p>
                      <span className="text-[10px] font-black bg-white text-sky-700 px-3 py-1 rounded-full border border-sky-200">ACTIVE</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-sky-400 uppercase tracking-widest">কুরিয়ার কোম্পানি</span>
                        <p className="text-xs font-black text-slate-800">{selectedOrder.courierName}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-sky-400 uppercase tracking-widest">পোস্টিং তারিখ</span>
                        <p className="text-xs font-black text-slate-800 font-mono">{selectedOrder.shipmentDate || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[9px] font-black text-sky-400 uppercase tracking-widest">ট্র্যাকিং কোড বা মেমো নম্বর</span>
                      <div className="bg-white border-2 border-sky-100 p-3 rounded-xl flex items-center justify-between shadow-inner">
                        <span className="font-mono font-black text-sm text-rose-800 tracking-wider">{selectedOrder.trackingNumber}</span>
                        <button onClick={() => {
                          navigator.clipboard.writeText(selectedOrder.trackingNumber);
                          alert('ট্র্যাকিং কোড কপি করা হয়েছে!');
                        }} className="text-sky-600 hover:text-sky-800 transition p-1 cursor-pointer">
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    {selectedOrder.shipmentScreenshot && (
                      <div className="space-y-2">
                        <span className="text-[9px] font-black text-sky-400 uppercase tracking-widest">সংযুক্ত রসিদ বা স্ক্রিনশটঃ</span>
                        <div className="relative group overflow-hidden rounded-2xl border-2 border-white shadow-md bg-white">
                          <img 
                            src={selectedOrder.shipmentScreenshot} 
                            alt="Shipment Memo" 
                            className="w-full max-h-64 object-contain cursor-zoom-in hover:scale-105 transition-transform duration-500"
                            onClick={() => {
                              const imgWindow = window.open();
                              if (imgWindow) {
                                imgWindow.document.write(`<img src="${selectedOrder.shipmentScreenshot}" style="max-width:100%; max-height:100vh; display:block; margin:auto;"/>`);
                              }
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions segment */}
                <div className="space-y-4 pt-4">
                  {/* 1. Buyer actions */}
                  {selectedOrder.buyerUid === liveUser.uid && (selectedOrder.status === 'Payment Held' || selectedOrder.status === 'Shipped') && (
                    <div className="space-y-3">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => handleReleaseFunds(selectedOrder)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 px-6 rounded-2xl text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95"
                      >
                        <CheckCircle className="w-5 h-5" />
                        <span>পণ্য পেয়েছি (টাকা রিলিজ করুন)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenDisputeModal(selectedOrder)}
                        className="w-full border-2 border-slate-100 hover:bg-slate-50 text-slate-700 font-black py-3 px-4 rounded-2xl text-xs transition-all cursor-pointer text-center flex items-center justify-center gap-2 active:scale-95"
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span>বিবাদ বা অভিযোগ (Admin Support)</span>
                      </button>
                    </div>
                  )}

                  {/* 2. Seller actions */}
                  {selectedOrder.sellerUid === liveUser.uid && selectedOrder.status === 'Payment Held' && (
                    <div className="space-y-4">
                      {!showShipForm ? (
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setShowShipForm(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 px-4 rounded-2xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95"
                          >
                            <Truck className="w-4 h-4" />
                            <span>পণ্য কুরিয়ার করুন</span>
                          </button>

                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleCancelEscrow(selectedOrder)}
                            className="bg-rose-50 border-2 border-rose-100 hover:bg-rose-100 text-rose-700 font-black py-4 px-4 rounded-2xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
                          >
                            <span>বাতিল ও রিফান্ড</span>
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="bg-slate-50 border-2 border-slate-100 rounded-[28px] p-5 space-y-4 shadow-inner animate-in slide-in-from-top duration-300">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-emerald-600 text-white rounded-lg flex items-center justify-center">
                              <Truck className="w-5 h-5" />
                            </div>
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">কুরিয়ার ট্র্যাকিং জমা দিন</h4>
                          </div>
                          
                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">কুরিয়ার সার্ভিস কোম্পানিঃ</label>
                              <select
                                value={courierName}
                                onChange={(e) => setCourierName(e.target.value)}
                                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-xs font-bold focus:border-emerald-500 outline-none transition-all shadow-sm"
                              >
                                <option value="ক্যাশ টু ক্যাশ নিরাপদ ডেলিভারি">ক্যাশ টু ক্যাশ নিরাপদ ডেলিভারি (Cash to Cash)</option>
                                <option value="সুন্দরবন কুরিয়ার">সুন্দরবন কুরিয়ার (Sundarban)</option>
                                <option value="এস এ পরিবহন">এস এ পরিবহন (SA Paribahan)</option>
                                <option value="পাঠাও কুরিয়ার">পাঠাও কুরিয়ার (Pathao)</option>
                                <option value="রেডএক্স কুরিয়ার">রেডএক্স কুরিয়ার (REDX)</option>
                                <option value="নিজেদের হোম ডেলিভারি">হ্যান্ড টু হ্যান্ড হোম ডেলিভারি</option>
                              </select>
                            </div>

                            <div className="space-y-1.5">
                              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">মেমো বা ট্র্যাকিং রসিদ নম্বরঃ</label>
                              <input 
                                type="text"
                                required
                                placeholder="উদাঃ CN-73491-DN"
                                value={trackingNumber}
                                onChange={(e) => setTrackingNumber(e.target.value)}
                                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-mono font-black focus:border-emerald-500 outline-none transition-all shadow-sm"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">রসিদ বা স্ক্রিনশট আপলোড (ঐচ্ছিক):</label>
                              {!shipmentScreenshot ? (
                                <div
                                  onClick={() => document.getElementById('shipment-screenshot-input')?.click()}
                                  className="border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/30 rounded-2xl py-6 px-4 text-center cursor-pointer flex flex-col items-center justify-center gap-2 transition-all duration-300 bg-white"
                                >
                                  <input 
                                    id="shipment-screenshot-input"
                                    type="file" 
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        if (file.size > 2 * 1024 * 1024) {
                                          alert('রসিদ ছবির সাইজ সর্বোচ্চ 2 মেগাবাইট হতে পারে!');
                                          return;
                                        }
                                        setShipmentScreenshotName(file.name);
                                        const reader = new FileReader();
                                        reader.onload = () => setShipmentScreenshot(reader.result as string);
                                        reader.readAsDataURL(file);
                                      }
                                    }}
                                  />
                                  <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shadow-sm">
                                    <UploadCloud className="w-6 h-6" />
                                  </div>
                                  <span className="text-xs font-black text-slate-500 tracking-wide">গ্যালারি থেকে মেমো বা রসিদ ছবি দিন</span>
                                </div>
                              ) : (
                                <div className="relative border-2 border-emerald-100 rounded-2xl p-3 bg-white flex items-center gap-3 shadow-sm">
                                  <img 
                                    src={shipmentScreenshot} 
                                    alt="Receipt Preview" 
                                    className="w-12 h-12 rounded-xl object-cover border border-emerald-100 shadow-inner" 
                                  />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[11px] font-black text-slate-700 block truncate">{shipmentScreenshotName || 'receipt.png'}</span>
                                    <span className="text-[10px] text-emerald-600 font-black block leading-none mt-1">সফলভাবে লোড হয়েছে ✓</span>
                                  </div>
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      setShipmentScreenshot(null);
                                      setShipmentScreenshotName('');
                                    }}
                                    className="w-8 h-8 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 font-bold"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-2">
                              <button
                                type="button"
                                onClick={() => setShowShipForm(false)}
                                className="py-3 px-4 border-2 border-slate-200 rounded-xl text-slate-500 text-xs font-black transition-all hover:bg-slate-100"
                              >
                                বাতিল
                              </button>
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => handleShipProduct(selectedOrder)}
                                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black py-3 px-4 rounded-xl text-xs transition-all shadow-md active:scale-95"
                              >
                                {submitting ? 'জমা হচ্ছে...' : 'জমা দিন'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. Closed trans message */}
                  {selectedOrder.status === 'Payment Released' && (
                    <div className="bg-emerald-50 text-emerald-800 border-2 border-emerald-100 p-5 rounded-[28px] text-xs text-center font-black flex flex-col items-center justify-center gap-2 shadow-sm animate-in zoom-in duration-300">
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                        <CheckCircle className="w-6 h-6 text-emerald-600" />
                      </div>
                      এই লেনদেনের সম্পূর্ণ সমাধান হয়ে ক্লোজ করা হয়েছে।
                    </div>
                  )}

                  {selectedOrder.status === 'Refunded' && (
                    <div className="bg-rose-50 text-rose-800 border-2 border-rose-100 p-5 rounded-[28px] text-xs text-center font-black flex flex-col items-center justify-center gap-2 shadow-sm animate-in zoom-in duration-300">
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                        <XCircle className="w-6 h-6 text-rose-600" />
                      </div>
                      এই লেনদেনটি বাতিল ও ক্রেতাকে রিফান্ড সম্পন্নকৃত।
                    </div>
                  )}

                  {/* 4. Admin Arbitrator Actions */}
                  {(liveUser.role === 'admin' || liveUser.role === 'sub_admin') && (selectedOrder.status === 'Payment Held' || selectedOrder.status === 'Shipped') && (
                    <div className="bg-amber-50 border-2 border-amber-200/50 p-5 rounded-[28px] space-y-4 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-amber-500 text-white rounded-lg flex items-center justify-center shadow-sm">
                          <Scale className="w-5 h-5" />
                        </div>
                        <p className="text-[11px] uppercase font-black tracking-widest text-amber-900">
                          প্রশাসনিক সালিশি প্যানেল
                        </p>
                      </div>
                      <p className="text-xs text-amber-800 font-bold leading-relaxed">
                        সালিশকারী হিসেবে আপনি ক্রেতা/বিক্রেতার বিবাদ নিষ্পত্তি করতে ফোর্স অ্যাকশন সম্পন্ন করতে পারবেন।
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleReleaseFunds(selectedOrder)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 px-4 rounded-xl text-[10px] transition-all cursor-pointer shadow-md active:scale-95"
                        >
                          ফোর্স পেমেন্ট রিলিজ
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleCancelEscrow(selectedOrder)}
                          className="bg-rose-600 hover:bg-rose-700 text-white font-black py-3.5 px-4 rounded-xl text-[10px] transition-all cursor-pointer shadow-md active:scale-95"
                        >
                          ফোর্স বাতিল ও রিফান্ড
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL IV: নীতিমালা ও সাহায্য নির্দেশিকা (Help / Safe Rules manual) */}
      <AnimatePresence>
        {showHelpModal && (
          <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900/60 backdrop-blur-sm">
            <div className="h-10 shrink-0 bg-[#004a2c] w-full"></div>
            
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="flex-1 bg-white rounded-t-[32px] flex flex-col overflow-hidden font-sans"
            >
              <div className="bg-[#004a2c] text-white px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-black">নিরাপদ লেনদেন ও এসক্রো নীতিমালা</h3>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowHelpModal(false)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="space-y-6 text-sm text-slate-600 font-bold leading-relaxed">
                  <div className="bg-emerald-50 p-5 rounded-[28px] border-2 border-emerald-100 space-y-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-emerald-600">
                      <Lock className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-slate-800 font-black uppercase tracking-wider">১. এসক্রো বা নিরাপদ হোল্ড কি?</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        নিরাপদ লেনদেন হল সমবায় ইউনিয়নের ডিজিটাল সমাধান। এখানে ক্রেতার টাকা বিক্রেতাকে সাথে সাথে দেওয়া হয় না। পণ্য ক্রেতা ভালোমতো হাতে বুঝে নিয়ে ওয়ালেটে 'পণ্য পেয়েছি' নিশ্চিত করলেই কেবল বিক্রেতা পেমেন্ট লাভ করেন।
                      </p>
                    </div>
                  </div>

                  <div className="bg-blue-50 p-5 rounded-[28px] border-2 border-blue-100 space-y-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-blue-600">
                      <Truck className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-slate-800 font-black uppercase tracking-wider">২. বিক্রেতা ট্র্যাকিং কিভাবে দিবেন?</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        বিক্রেতা যখন পণ্যটি কোনো কুরিয়ারে বুকিং দেন, তখন সাথে সাথে প্রাপ্ত রসিদ বা মোমো নম্বর কুরিয়ার নাম সহ ইনপুট দিবেন। এটি দিলে স্ট্যাটাস পণ্য পাঠানো- তে হালনাগাদ হয়ে যায়।
                      </p>
                    </div>
                  </div>

                  <div className="bg-amber-50 p-5 rounded-[28px] border-2 border-amber-100 space-y-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-amber-600">
                      <Clock className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-slate-800 font-black uppercase tracking-wider">৩. ৭২ ঘণ্টার অটোমেটিক এডমিন সহায়তা</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        বিক্রেতা পণ্য সরবারাহ সম্পন্ন করার পরও যদি ক্রেতা ৭২ ঘণ্টার ভেতর টাকা রিলিজ না করেন বা কোনো অভিযোগ না পাঠান, তবে সমবায় এডমিন তদন্ত সাপেক্ষে লেনদেনটি সুরাহা করে থাকেন।
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="button"
                    onClick={() => setShowHelpModal(false)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-black text-sm text-center cursor-pointer shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
                  >
                    বুঝেছি, ধন্যবাদ
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Centered Success Popup Overlay */}
      <AnimatePresence>
        {successMsg && (
          <div className="fixed inset-0 z-[200] flex flex-col bg-slate-900/60 backdrop-blur-sm">
            <div className="h-10 shrink-0 bg-[#004a2c] w-full"></div>
            
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="flex-1 bg-white rounded-t-[32px] flex flex-col overflow-hidden font-sans"
            >
              <div className="bg-[#004a2c] text-white px-6 py-8 flex flex-col items-center justify-center text-center shrink-0">
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-4 border-2 border-white/20 animate-in zoom-in duration-500">
                  <CheckCircle className="w-12 h-12 text-emerald-400 stroke-[3]" />
                </div>
                <h3 className="text-2xl font-black">লেনদেন সফল হয়েছে!</h3>
                <p className="text-emerald-100/70 text-xs font-bold mt-1 uppercase tracking-widest">Transaction Completed</p>
              </div>

              <div className="flex-1 p-6 flex flex-col items-center justify-center space-y-8">
                <div className="w-full bg-emerald-50 border-2 border-emerald-100 p-8 rounded-[40px] text-center shadow-inner animate-in slide-in-from-bottom-4 duration-500">
                  <p className="text-lg font-black text-emerald-900 leading-relaxed">
                    {successMsg}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSuccessMsg('')}
                  className="w-full max-w-xs py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-base font-black shadow-xl shadow-emerald-600/30 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  <span>ঠিক আছে</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Centered Detailed Success Receipt Voucher Overlay */}
      <AnimatePresence>
        {voucherData && (
          <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900/60 backdrop-blur-sm">
            <div className="h-10 shrink-0 bg-[#004a2c] w-full"></div>
            
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="flex-1 bg-white rounded-t-[32px] flex flex-col overflow-hidden font-sans"
            >
              <div className="bg-[#004a2c] text-white px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black leading-tight">লেনদেন রশিদ ভাউচার</h3>
                    <p className="text-[10px] text-emerald-100/70 font-medium tracking-wide uppercase">{voucherData.title}</p>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => setVoucherData(null)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Large Amount Box */}
                <div className="bg-emerald-50 border-2 border-emerald-100 rounded-[32px] p-6 text-center shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                    <DollarSign className="w-20 h-20" />
                  </div>
                  <span className="text-[10px] uppercase font-black text-emerald-600 tracking-[0.2em]">লেনদেনের মোট পরিমাণ</span>
                  <div className="text-3xl font-black text-emerald-800 mt-2 font-mono">
                    ৳ {Number(voucherData.amount).toLocaleString('bn-BD')} <span className="text-sm font-bold uppercase tracking-widest ml-1">BDT</span>
                  </div>
                </div>

                {/* Details List */}
                <div className="space-y-4 bg-slate-50 border-2 border-slate-100 p-6 rounded-[32px] shadow-inner text-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200/50">
                    <span className="text-slate-400 font-black uppercase tracking-wider">বুকিং আইডি:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-slate-800 text-sm select-all">{voucherData.bookingId}</span>
                      <button 
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(voucherData.bookingId);
                          setCopiedVoucher(true);
                          setTimeout(() => setCopiedVoucher(false), 2000);
                        }}
                        className="text-emerald-600 hover:text-emerald-700 p-1.5 bg-white border border-emerald-100 rounded-lg shadow-xs active:scale-95"
                        title="কপি করুন"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between pb-3 border-b border-slate-200/50">
                    <span className="text-slate-400 font-black uppercase tracking-wider">তারিখ ও সময়:</span>
                    <span className="text-slate-800 font-black">{voucherData.timestamp}</span>
                  </div>

                  <div className="flex justify-between pb-3 border-b border-slate-200/50">
                    <span className="text-slate-400 font-black uppercase tracking-wider">ক্রেতা (প্রেরক):</span>
                    <span className="text-slate-800 font-black">{voucherData.buyerName} ({voucherData.buyerPhone})</span>
                  </div>

                  <div className="flex justify-between pb-3 border-b border-slate-200/50">
                    <span className="text-slate-400 font-black uppercase tracking-wider">বিক্রেতা (প্রাপক):</span>
                    <span className="text-slate-800 font-black">{voucherData.sellerName} ({voucherData.sellerPhone})</span>
                  </div>

                  <div className="space-y-1 pb-3 border-b border-slate-200/50">
                    <span className="text-slate-400 font-black uppercase tracking-wider block">লেনদেনের বিবরণ:</span>
                    <p className="text-slate-800 font-bold italic leading-relaxed">"{voucherData.detail}"</p>
                  </div>

                  {voucherData.courierName && voucherData.courierName !== '-' && (
                    <div className="flex justify-between pb-3 border-b border-slate-200/50">
                      <span className="text-slate-400 font-black uppercase tracking-wider">কুরিয়ার কোম্পানি:</span>
                      <span className="text-slate-800 font-black">{voucherData.courierName}</span>
                    </div>
                  )}

                  {voucherData.trackingNumber && voucherData.trackingNumber !== '-' && (
                    <div className="flex justify-between pb-3 border-b border-slate-200/50">
                      <span className="text-slate-400 font-black uppercase tracking-wider">মেমো বা ট্র্যাকিং নং:</span>
                      <span className="text-slate-800 font-black font-mono">{voucherData.trackingNumber}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-400 font-black uppercase tracking-wider">স্ট্যাটাস:</span>
                    <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-3xs">
                      {voucherData.status}
                    </span>
                  </div>
                </div>

                {/* Copied alert toast indicator */}
                {copiedVoucher && (
                  <div className="text-center text-xs font-black text-emerald-600 bg-emerald-50 border-2 border-emerald-100 py-3 rounded-2xl animate-pulse shadow-sm">
                    ✓ তথ্য সফলভাবে ক্লিপবোর্ডে কপি করা হয়েছে!
                  </div>
                )}

                {/* Main Action Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const canvas = document.createElement('canvas');
                        canvas.width = 600;
                        canvas.height = 880;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) return;

                        // Fill background
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        // Draw dual border
                        ctx.strokeStyle = '#e2e8f0';
                        ctx.lineWidth = 12;
                        ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
                        ctx.strokeStyle = '#057a55'; // emerald-700
                        ctx.lineWidth = 2;
                        ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

                        // Draw Header Logo and Subtitle
                        ctx.textAlign = 'center';
                        ctx.fillStyle = '#057a55';
                        ctx.font = 'bold 24px system-ui, sans-serif';
                        ctx.fillText('BUSINESS NETWORK BANGLADESH', canvas.width / 2, 70);

                        ctx.fillStyle = '#475569';
                        ctx.font = 'bold 12px system-ui, sans-serif';
                        ctx.fillText('নিরাপদ বাতায়ন ও সমবায় লেনদেন', canvas.width / 2, 95);

                        // Draw Badge Title
                        ctx.fillStyle = '#f1f5f9';
                        const titleWidth = 260;
                        const titleHeight = 32;
                        ctx.fillRect((canvas.width - titleWidth) / 2, 115, titleWidth, titleHeight);
                        ctx.strokeStyle = '#cbd5e1';
                        ctx.strokeRect((canvas.width - titleWidth) / 2, 115, titleWidth, titleHeight);

                        ctx.fillStyle = '#0f172a';
                        ctx.font = 'bold 13px system-ui, sans-serif';
                        ctx.fillText(voucherData.title || 'লেনদেন রশিদ ভাউচার', canvas.width / 2, 136);

                        // Amount Box
                        ctx.fillStyle = '#f0fdf4';
                        ctx.fillRect(40, 175, canvas.width - 80, 95);
                        ctx.strokeStyle = '#bbf7d0';
                        ctx.strokeRect(40, 175, canvas.width - 80, 95);

                        ctx.textAlign = 'center';
                        ctx.fillStyle = '#15803d';
                        ctx.font = 'bold 12px system-ui, sans-serif';
                        ctx.fillText('লেনদেনকৃত টাকার পরিমাণ', canvas.width / 2, 205);

                        ctx.fillStyle = '#166534';
                        ctx.font = 'bold 30px system-ui, sans-serif';
                        ctx.fillText(`৳ ${Number(voucherData.amount).toLocaleString('bn-BD')} BDT`, canvas.width / 2, 245);

                        // Draw Information Table
                        const startX = 40;
                        const endX = canvas.width - 40;
                        let currentY = 320;
                        const rowHeight = 38;

                        const drawRow = (label: string, value: string) => {
                          // Draw bottom line
                          ctx.strokeStyle = '#f1f5f9';
                          ctx.lineWidth = 1;
                          ctx.beginPath();
                          ctx.moveTo(startX, currentY + 10);
                          ctx.lineTo(endX, currentY + 10);
                          ctx.stroke();

                          ctx.textAlign = 'left';
                          ctx.fillStyle = '#64748b';
                          ctx.font = 'bold 13px system-ui, sans-serif';
                          ctx.fillText(label, startX + 10, currentY - 4);

                          ctx.textAlign = 'right';
                          ctx.fillStyle = '#0f172a';
                          ctx.font = 'bold 13px system-ui, sans-serif';
                          ctx.fillText(value, endX - 10, currentY - 4);

                          currentY += rowHeight;
                        };

                        drawRow('বুকিং আইডি', voucherData.bookingId || 'N/A');
                        drawRow('তারিখ ও সময়', voucherData.timestamp || 'N/A');
                        drawRow('ক্রেতা (প্রেরক)', `${voucherData.buyerName} (${voucherData.buyerPhone})`);
                        drawRow('বিক্রেতা (প্রাপক)', `${voucherData.sellerName} (${voucherData.sellerPhone})`);
                        
                        // Handle wrapping of details text
                        ctx.strokeStyle = '#f1f5f9';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(startX, currentY + 10);
                        ctx.lineTo(endX, currentY + 10);
                        ctx.stroke();

                        ctx.textAlign = 'left';
                        ctx.fillStyle = '#64748b';
                        ctx.font = 'bold 13px system-ui, sans-serif';
                        ctx.fillText('লেনদেনের বিবরণ', startX + 10, currentY - 4);

                        ctx.textAlign = 'right';
                        ctx.fillStyle = '#334155';
                        ctx.font = 'bold 12px system-ui, sans-serif';
                        const descVal = `"${voucherData.detail || ''}"`;
                        ctx.fillText(descVal.length > 35 ? descVal.slice(0, 35) + '...' : descVal, endX - 10, currentY - 4);
                        currentY += rowHeight;

                        if (voucherData.courierName && voucherData.courierName !== '-') {
                          drawRow('কুরিয়ার কোম্পানি', voucherData.courierName);
                        }
                        if (voucherData.trackingNumber && voucherData.trackingNumber !== '-') {
                          drawRow('মেমো বা ট্র্যাকিং নং', voucherData.trackingNumber);
                        }

                        // Status row with badge drawing
                        ctx.strokeStyle = '#f1f5f9';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(startX, currentY + 10);
                        ctx.lineTo(endX, currentY + 10);
                        ctx.stroke();

                        ctx.textAlign = 'left';
                        ctx.fillStyle = '#64748b';
                        ctx.font = 'bold 13px system-ui, sans-serif';
                        ctx.fillText('লেনদেনের স্ট্যাটাস', startX + 10, currentY - 4);

                        // Draw status pill
                        const statusBadgeWidth = 100;
                        const statusBadgeHeight = 22;
                        const sbX = endX - statusBadgeWidth - 10;
                        const sbY = currentY - 18;
                        
                        ctx.fillStyle = '#dcfce7';
                        ctx.beginPath();
                        ctx.arc(sbX + 11, sbY + 11, 11, Math.PI/2, 3*Math.PI/2);
                        ctx.lineTo(sbX + statusBadgeWidth - 11, sbY);
                        ctx.arc(sbX + statusBadgeWidth - 11, sbY + 11, 11, 3*Math.PI/2, Math.PI/2);
                        ctx.lineTo(sbX + 11, sbY + statusBadgeHeight);
                        ctx.closePath();
                        ctx.fill();

                        ctx.textAlign = 'center';
                        ctx.fillStyle = '#15803d';
                        ctx.font = 'bold 11px system-ui, sans-serif';
                        ctx.fillText(voucherData.status || 'সফল', sbX + statusBadgeWidth / 2, sbY + 15);

                        currentY += rowHeight + 20;

                        // Footer divider
                        ctx.strokeStyle = '#e2e8f0';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(40, currentY);
                        ctx.lineTo(canvas.width - 40, currentY);
                        ctx.stroke();

                        // Footer text
                        ctx.textAlign = 'center';
                        ctx.fillStyle = '#94a3b8';
                        ctx.font = 'bold 10px system-ui, sans-serif';
                        ctx.fillText('এটি একটি সিস্টেম জেনারেটেড রসিদ কপি। যেকোনো তথ্যের জন্য সাপোর্ট টিমে যোগাযোগ করুন।', canvas.width / 2, currentY + 30);
                        ctx.fillText('© BUSINESS NETWORK BANGLADESH (BNB)', canvas.width / 2, currentY + 48);

                        // Bottom scallops
                        ctx.fillStyle = '#f1f5f9';
                        for (let i = 0; i < canvas.width; i += 24) {
                          ctx.beginPath();
                          ctx.arc(i + 12, canvas.height, 12, 0, Math.PI, true);
                          ctx.fill();
                        }

                        const dataUrl = canvas.toDataURL('image/png');
                        
                        // Convert to Blob for direct mobile/iOS download support (bypasses sandbox restrictions)
                        const arr = dataUrl.split(',');
                        const mime = arr[0].match(/:(.*?);/)![1];
                        const bstr = atob(arr[1]);
                        let n = bstr.length;
                        const u8arr = new Uint8Array(n);
                        while (n--) {
                          u8arr[n] = bstr.charCodeAt(n);
                        }
                        const blob = new Blob([u8arr], { type: mime });
                        const blobUrl = URL.createObjectURL(blob);

                        const link = document.createElement('a');
                        link.download = `BNB-Escrow-Voucher-${voucherData.bookingId}.png`;
                        link.href = blobUrl;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                      } catch (err) {
                        console.error('Error generating and downloading escrow receipt image:', err);
                        alert("রসিদটি সরাসরি ডাউনলোড করা যায়নি। অনুগ্রহ করে স্ক্রিনের একটি স্ক্রিনশট নিয়ে রাখুন।");
                      }
                    }}
                    className="flex items-center justify-center gap-2 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-emerald-600/20 transition-all cursor-pointer active:scale-95"
                  >
                    <Printer className="w-4 h-4" /> 
                    <span>রসিদ ডাউনলোড</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const shareText = `📝 *নিরাপদ লেনদেনের ভাউচার কপি* 📝\n🏢 *প্রতিষ্ঠান:* BUSINESS NETWORK BANGLADESH\n📌 *ভাউচার টাইপ:* ${voucherData.title}\n🔢 *বুকিং আইডি:* ${voucherData.bookingId}\n💰 *পরিমাণ:* ৳ ${Number(voucherData.amount).toLocaleString('bn-BD')} BDT\n⏰ *তারিখ ও সময়:* ${voucherData.timestamp}\n👤 *ক্রেতা:* ${voucherData.buyerName} (${voucherData.buyerPhone})\n👥 *বিক্রেতা:* ${voucherData.sellerName} (${voucherData.sellerPhone})\n📦 *বিবরণ:* "${voucherData.detail}"\n${voucherData.courierName && voucherData.courierName !== '-' ? `🚚 *কুরিয়ার:* ${voucherData.courierName}\n` : ''}${voucherData.trackingNumber && voucherData.trackingNumber !== '-' ? `🎫 *ট্র্যাকিং নং:* ${voucherData.trackingNumber}\n` : ''}✅ *স্ট্যাটাস:* ${voucherData.status}\n\n-------------------------------------\n*ধন্যবাদ, বিজনেস নেটওয়ার্ক বাংলাদেশ এর সাথে লেনদেন করার জন্য!*`;
                      
                      navigator.clipboard.writeText(shareText).then(() => {
                        setCopiedVoucher(true);
                        setTimeout(() => setCopiedVoucher(false), 3000);
                      }).catch(err => {
                        alert("কপি করা যায়নিঃ " + err);
                      });
                    }}
                    className="flex items-center justify-center gap-2 py-4 bg-[#004a2c] hover:bg-[#003820] text-white rounded-2xl text-xs font-black shadow-lg shadow-emerald-900/20 transition-all cursor-pointer active:scale-95"
                  >
                    <Share2 className="w-4 h-4" /> 
                    <span>ফরোয়ার্ড করুন</span>
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setVoucherData(null)}
                    className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-sm font-black transition-all cursor-pointer text-center active:scale-95"
                  >
                    বন্ধ করুন
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Centered Error Popup Overlay */}
      <AnimatePresence>
        {errorMsg && (
          <div className="fixed inset-0 z-[200] flex flex-col bg-slate-900/60 backdrop-blur-sm">
            <div className="h-10 shrink-0 bg-[#004a2c] w-full"></div>
            
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="flex-1 bg-white rounded-t-[32px] flex flex-col overflow-hidden font-sans"
            >
              <div className="bg-[#004a2c] text-white px-6 py-8 flex flex-col items-center justify-center text-center shrink-0">
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-4 border-2 border-white/20">
                  <AlertCircle className="w-12 h-12 text-rose-400 stroke-[3]" />
                </div>
                <h3 className="text-2xl font-black">লেনদেন ব্যর্থ হয়েছে</h3>
                <p className="text-rose-100/70 text-xs font-bold mt-1 uppercase tracking-widest">Transaction Failed</p>
              </div>

              <div className="flex-1 p-6 flex flex-col items-center justify-center space-y-8">
                <div className="w-full bg-rose-50 border-2 border-rose-100 p-8 rounded-[40px] text-center shadow-inner animate-in slide-in-from-bottom-4 duration-500">
                  <p className="text-lg font-black text-rose-900 leading-relaxed">
                    {errorMsg}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setErrorMsg('')}
                  className="w-full max-w-xs py-4 bg-[#004a2c] hover:bg-[#003820] text-white rounded-2xl text-base font-black shadow-xl shadow-emerald-900/30 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span>আবার চেষ্টা করুন</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Professional Brand Confirmation Modal Overlay */}
      <AnimatePresence>
        {confirmModalData && (
          <div className="fixed inset-0 z-[200] flex flex-col bg-slate-900/60 backdrop-blur-sm">
            <div className="h-10 shrink-0 bg-[#004a2c] w-full"></div>
            
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="flex-1 bg-white rounded-t-[32px] flex flex-col overflow-hidden font-sans"
            >
              <div className="bg-[#004a2c] text-white px-6 py-8 flex flex-col items-center justify-center text-center shrink-0">
                <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-4 border-2 border-white/20 animate-in zoom-in duration-500">
                  <AlertTriangle className="w-12 h-12 text-amber-400 stroke-[2.5]" />
                </div>
                <h3 className="text-2xl font-black">{confirmModalData.title}</h3>
                <p className="text-emerald-100/70 text-xs font-bold mt-1 uppercase tracking-widest">Confirmation Required</p>
              </div>

              <div className="flex-1 p-6 flex flex-col space-y-6">
                <div className="bg-slate-50 border-2 border-slate-100 rounded-[32px] p-6 text-center shadow-sm relative overflow-hidden">
                  <p className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] block mb-2">বুকিংকৃত ডিলের পরিমাণ</p>
                  <div className="text-3xl font-black text-slate-800 font-mono">
                    ৳ {confirmModalData.amount.toLocaleString('bn-BD')} <span className="text-sm font-bold uppercase tracking-widest ml-1">BDT</span>
                  </div>
                  {confirmModalData.bookingId && (
                    <div className="mt-3 inline-block text-[10px] font-mono font-black bg-white border border-slate-200 text-slate-500 px-3 py-1 rounded-full shadow-xs">
                      বুকিং আইডিঃ {confirmModalData.bookingId.toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="bg-amber-50 border-2 border-amber-100 p-6 rounded-[32px] space-y-3 shadow-inner">
                  <h4 className="text-sm font-black text-amber-900 flex items-center gap-2 uppercase tracking-wider">
                    <ShieldCheck className="w-5 h-5 text-amber-600" /> গুরুত্বপূর্ণ সতর্কতা
                  </h4>
                  <p className="text-sm font-bold text-slate-600 leading-relaxed">
                    {confirmModalData.description}
                  </p>
                </div>

                <div className="flex-1 flex flex-col justify-end space-y-4 pt-4">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={confirmModalData.onConfirm}
                    className={`w-full py-4 rounded-2xl text-base font-black shadow-xl transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2 ${
                      confirmModalData.type === 'cancel'
                        ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                    } text-white`}
                  >
                    {submitting ? (
                      <>
                        <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                        <span>প্রক্রিয়াধীন...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        <span>{confirmModalData.actionLabel}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfirmModalData(null)}
                    className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-base font-black transition-all cursor-pointer text-center active:scale-95"
                  >
                    ফিরে যান
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================== DISPUTE / COMPLAINT SUBMISSION MODAL ==================== */}
      <AnimatePresence>
        {showDisputeModal && disputeOrder && (
          <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900/60 backdrop-blur-sm">
            <div className="h-10 shrink-0 bg-[#004a2c] w-full"></div>
            
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="flex-1 bg-white rounded-t-[32px] flex flex-col overflow-hidden font-sans"
            >
              <div className="bg-[#004a2c] text-white px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  </div>
                  <h3 className="text-lg font-black">বিবাদ বা অভিযোগ সাবমিট করুন</h3>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowDisputeModal(false)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Order Info Summary */}
                <div className="bg-amber-50 border-2 border-amber-100 p-5 rounded-[28px] space-y-3 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                    <AlertCircle className="w-16 h-16" />
                  </div>
                  <span className="text-[10px] text-amber-800 font-black uppercase tracking-widest block">অভিযোগের বুকিং তথ্যঃ</span>
                  <p className="text-sm font-black text-slate-800">{disputeOrder.dealTitle}</p>
                  <div className="flex flex-col gap-1 text-[11px] text-slate-500 font-mono">
                    <span className="font-black">ID: #{disputeOrder.id.substring(0, 8).toUpperCase()}</span>
                    <span className="font-sans font-black text-amber-700">পরিমাণঃ ৳{disputeOrder.totalAmount?.toLocaleString('bn-BD')} BDT</span>
                  </div>
                </div>

                <form onSubmit={handleSubmitDispute} className="space-y-6">
                  {/* Contact Phone */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider px-1">যোগাযোগের মোবাইল নাম্বার (WhatsApp সচল থাকতে হবে) *</label>
                    <div className="relative">
                      <input
                        type="tel"
                        required
                        placeholder="01xxxxxxxxx"
                        value={disputeContactPhone}
                        onChange={(e) => setDisputeContactPhone(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 text-slate-900 rounded-2xl text-sm font-black focus:border-emerald-500 transition shadow-inner"
                      />
                      <Phone className="w-4 h-4 text-slate-400 absolute right-4 top-3.5" />
                    </div>
                  </div>

                  {/* Dispute Reason/Description */}
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider px-1">অভিযোগের বিবরণ (বিস্তারিত লিখুন) *</label>
                    <textarea
                      required
                      rows={5}
                      placeholder="পণ্য বা কুরিয়ার সংক্রান্ত বিস্তারিত সমস্যা এখানে লিখুন যেন এডমিন দ্রুত সমাধান করতে পারেন..."
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 text-slate-900 rounded-2xl text-sm font-bold focus:border-emerald-500 transition shadow-inner"
                    />
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <p className="text-[10px] text-slate-500 leading-relaxed font-bold">
                        * আপনার কুরিয়ার ডকিং ডাটা ও মেম্বার ট্র্যাকিং ইনফো স্বয়ংক্রিয়ভাবে প্রশাসনের কাছে রিপোর্টের সাথে যুক্ত হয়ে যাবে। আমাদের প্রতিনিধি হোয়াটসঅ্যাপে যোগাযোগ করবেন।
                      </p>
                    </div>
                  </div>

                  {/* Form Buttons */}
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowDisputeModal(false)}
                      className="py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-black transition cursor-pointer active:scale-95"
                    >
                      বাতিল করুন
                    </button>

                    <button
                      type="submit"
                      disabled={submittingDispute}
                      className="py-4 bg-[#004a2c] hover:bg-[#003820] disabled:opacity-50 text-white rounded-2xl text-xs font-black shadow-lg shadow-emerald-900/20 transition cursor-pointer flex items-center justify-center gap-2 active:scale-95"
                    >
                      {submittingDispute ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>সাবমিট হচ্ছে...</span>
                        </>
                      ) : (
                        <>✓ অভিযোগ জমা দিন</>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================== SUPPORT TICKETS & COMPLAINT TRACKER MODAL ==================== */}
      <AnimatePresence>
        {showSupportHistoryModal && (
          <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900/60 backdrop-blur-sm">
            <div className="h-10 shrink-0 bg-[#004a2c] w-full"></div>
            
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="flex-1 bg-white rounded-t-[32px] flex flex-col overflow-hidden font-sans"
            >
              <div className="bg-[#004a2c] text-white px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-xl">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black leading-tight">অ্যাডমিন সাপোর্ট ও ট্র্যাকিং সেন্টার</h3>
                    <p className="text-[10px] text-emerald-100/70 font-medium tracking-wide uppercase">Support & Dispute Center</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    setShowSupportHistoryModal(false);
                    setSearchTicketNo('');
                    setSearchTicketResult(null);
                    setSearchTicketError('');
                  }}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* WhatsApp Quick Support Section */}
                <div className="bg-emerald-50 border-2 border-emerald-100 p-5 rounded-[28px] flex flex-col gap-4 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Phone className="w-16 h-16" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest block">সরাসরি হোয়াটসঅ্যাপে যোগাযোগঃ</span>
                    <p className="text-sm font-black text-slate-800 leading-tight">এডমিন সাপোর্ট সেন্টারের সাথে সরাসরি কথা বলুন</p>
                    <p className="text-xs text-emerald-700 font-mono font-black mt-1">WhatsApp: 01865911728</p>
                  </div>
                  <a
                    href="https://wa.me/8801865911728"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-4 bg-[#25D366] hover:bg-emerald-600 text-white font-black text-sm rounded-2xl transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Phone className="w-4 h-4 text-white" />
                    <span>হোয়াটসঅ্যাপ সাপোর্ট</span>
                  </a>
                </div>

                {/* Live Status Tracker Search Input */}
                <div className="bg-slate-50 border-2 border-slate-100 p-5 rounded-[28px] space-y-4 shadow-inner">
                  <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider px-1">রসিদ নম্বর (Ticket ID) দিয়ে স্ট্যাটাস চেক করুনঃ</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="যেমন: SUP-123456"
                        value={searchTicketNo}
                        onChange={(e) => setSearchTicketNo(e.target.value)}
                        className="flex-1 px-4 py-3 bg-white border-2 border-slate-200 text-slate-900 font-mono uppercase tracking-widest rounded-xl text-sm font-black focus:border-emerald-500 outline-none transition-all shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={handleSearchTicket}
                        disabled={searchingTicket}
                        className="px-6 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-sm rounded-xl transition shadow-md cursor-pointer active:scale-95"
                      >
                        {searchingTicket ? (
                          <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                        ) : 'সার্চ'}
                      </button>
                    </div>
                  </div>

                  {/* Ticket Search Result Display */}
                  {searchTicketError && (
                    <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl">
                      <p className="text-[11px] text-rose-600 font-black text-center">{searchTicketError}</p>
                    </div>
                  )}

                  {searchTicketResult && (
                    <div className="bg-white border-2 border-emerald-100 p-4 rounded-2xl space-y-3 text-xs shadow-sm animate-in zoom-in duration-300">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <span className="font-mono font-black text-emerald-700 text-sm">ID: {searchTicketResult.ticketId}</span>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black border-2 ${
                          searchTicketResult.status === 'Resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          searchTicketResult.status === 'Processing' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                          'bg-amber-50 text-amber-700 border-amber-100 animate-pulse'
                        }`}>
                          {searchTicketResult.status === 'Resolved' ? '✓ সমাধান হয়েছে' :
                           searchTicketResult.status === 'Processing' ? '⌚ তদন্তাধীন' : '⏳ পেন্ডিং'}
                        </span>
                      </div>
                      <div className="space-y-2 text-slate-600">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">অভিযোগকারী</span>
                            <p className="font-black text-slate-800 text-xs">{searchTicketResult.userName}</p>
                          </div>
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">সিরিয়াল নম্বর</span>
                            <p className="font-black text-slate-800 text-xs font-mono">{englishToBengaliNumber(searchTicketResult.serialNo)}</p>
                          </div>
                        </div>
                        <div>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ডিল শিরোনাম</span>
                          <p className="text-slate-800 font-black text-xs">{searchTicketResult.orderTitle}</p>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">অভিযোগের বিবরণ</span>
                          <p className="font-bold text-slate-700 italic leading-relaxed">" {searchTicketResult.description} "</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Your Ticket History List */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-xs font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest">
                      <Clock className="w-4 h-4 text-slate-400" /> অভিযোগের ইতিহাস
                    </h4>
                    <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{englishToBengaliNumber(supportTickets.length)} টি</span>
                  </div>

                  {supportTickets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-6 text-center border-2 border-dashed border-slate-200 rounded-[32px] bg-slate-50/50 space-y-3">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-slate-300">
                        <ClipboardList className="w-6 h-6" />
                      </div>
                      <p className="text-xs text-slate-400 font-black leading-relaxed">
                        আপনার কোনো পূর্ববর্তী অভিযোগের রেকর্ড পাওয়া যায়নি।
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                      {supportTickets.map((ticket, idx) => (
                        <div key={ticket.id || idx} className="p-4 bg-white border-2 border-slate-100 hover:border-emerald-200 rounded-[24px] flex items-center justify-between gap-4 transition-all shadow-sm">
                          <div className="space-y-1.5 flex-1 min-w-0 text-left">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-slate-700 text-xs tracking-wider">{ticket.ticketId}</span>
                              <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-full">{new Date(ticket.createdAt).toLocaleDateString('bn-BD')}</span>
                            </div>
                            <p className="text-xs font-black text-slate-800 truncate">{ticket.orderTitle || 'সাধারণ অভিযোগ'}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Serial No: {englishToBengaliNumber(ticket.serialNo)}</span>
                              {ticket.status === 'Pending' && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              )}
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <span className={`px-3 py-1 rounded-full text-[9px] font-black border-2 block text-center uppercase tracking-wider ${
                              ticket.status === 'Resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              ticket.status === 'Processing' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                              'bg-amber-50 text-amber-700 border-amber-100'
                            }`}>
                              {ticket.status === 'Resolved' ? 'সম্পন্ন' :
                               ticket.status === 'Processing' ? 'তদন্তাধীন' : 'পেন্ডিং'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-4 pb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSupportHistoryModal(false);
                      setSearchTicketNo('');
                      setSearchTicketResult(null);
                      setSearchTicketError('');
                    }}
                    className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-sm font-black transition-all cursor-pointer active:scale-95"
                  >
                    বন্ধ করুন
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

        {/* ================= LOCALIZED ESCROW TRANSACTION HISTORY MODAL ================= */}
        {/* ================= LOCALIZED ESCROW TRANSACTION HISTORY MODAL ================= */}
        {showSectionTxHistory && (
          <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900/60 backdrop-blur-sm">
            <div className="h-10 shrink-0 bg-[#004a2c] w-full"></div>
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="flex-1 bg-white rounded-t-[32px] flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="bg-[#004a2c] text-white px-6 py-5 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
                    <ClipboardList className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white leading-tight">নিরাপদ লেনদেন এসক্রো খতিয়ান</h3>
                    <p className="text-[11px] text-emerald-100/80 font-bold uppercase tracking-wider">নিরাপদ ডিল, ফান্ড হোল্ড ও রিলিজ সংক্রান্ত ইতিহাস</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowSectionTxHistory(false);
                    setTxModalSearch('');
                  }}
                  className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-2xl transition-all active:scale-90"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text"
                    value={txModalSearch}
                    onChange={(e) => setTxModalSearch(e.target.value)}
                    placeholder="অ্যামাউন্ট, আইডি বা বিবরণ দিয়ে খুঁজুন..."
                    className="w-full bg-white border-2 border-slate-100 pl-11 pr-4 py-3 rounded-2xl text-xs font-bold focus:outline-none focus:border-[#004a2c] focus:ring-4 focus:ring-[#004a2c]/5 transition-all"
                  />
                  {txModalSearch && (
                    <button 
                      onClick={() => setTxModalSearch('')}
                      className="text-[10px] font-black bg-slate-100 text-slate-500 px-3 py-1.5 rounded-xl hover:bg-slate-200 absolute right-3 top-1/2 -translate-y-1/2 transition-all"
                    >
                      মুছুন
                    </button>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingTx ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-12 h-12 border-4 border-slate-100 border-t-[#004a2c] rounded-full animate-spin"></div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">খতিয়ান লোড হচ্ছে...</p>
                  </div>
                ) : (() => {
                  const filteredTxs = txHistory.filter(tx => {
                    const isEscrowTx = tx.typeLabel?.includes('নিরাপদ') || tx.typeLabel?.includes('এসক্রো') ||
                      tx.description?.includes('নিরাপদ') || tx.description?.includes('এসক্রো') ||
                      tx.description?.includes('ডিল ফান্ড') || tx.paymentMethod?.includes('Escrow');

                    if (!isEscrowTx) return false;

                    if (!txModalSearch.trim()) return true;
                    const searchLower = txModalSearch.toLowerCase();
                    return (
                      tx.description?.toLowerCase().includes(searchLower) ||
                      tx.typeLabel?.toLowerCase().includes(searchLower) ||
                      tx.amount?.toString().includes(searchLower) ||
                      tx.id?.toLowerCase().includes(searchLower)
                    );
                  });

                  if (filteredTxs.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-[24px] flex items-center justify-center text-slate-300 mb-4">
                          <Search className="w-8 h-8" />
                        </div>
                        <h4 className="text-sm font-black text-slate-800 mb-1">কোনো তথ্য পাওয়া যায়নি</h4>
                        <p className="text-[11px] text-slate-400 font-bold max-w-[200px] leading-relaxed">
                          আপনার এসক্রো লেনদেনের কোনো রেকর্ড এই মুহূর্তে নেই।
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {filteredTxs.map((tx, idx) => {
                        const isCredit = tx.typeLabel?.includes('প্রাপ্তি') || tx.description?.includes('প্রাপ্তি') || tx.description?.includes('রিলিজ করেছেন');
                        return (
                          <div key={`${tx.id}-${idx}`} className="p-4 bg-white border-2 border-slate-100 rounded-[28px] shadow-sm hover:border-emerald-100 transition-all">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                                  isCredit ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                }`}>
                                  {isCredit ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                                </div>
                                <div>
                                  <h4 className="text-xs font-black text-slate-800 leading-tight">{tx.typeLabel || 'নিরাপদ লেনদেন'}</h4>
                                  <p className="text-[10px] text-slate-400 font-bold">
                                    {new Date(tx.createdAt).toLocaleDateString('bn-BD')} {new Date(tx.createdAt).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className={`text-sm font-black ${
                                  isCredit ? 'text-emerald-600' : 'text-rose-600'
                                }`}>
                                  {isCredit ? '+' : '-'} ৳{tx.amount.toLocaleString('bn-BD')}
                                </span>
                                {tx.id && (
                                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">ID: {tx.id.replace('tx-esc-', '').toUpperCase()}</div>
                                )}
                              </div>
                            </div>
                            <div className="pl-13">
                              <p className="text-[11px] font-bold text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl italic border-l-4 border-slate-200">
                                {tx.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowSectionTxHistory(false);
                    setTxModalSearch('');
                  }}
                  className="w-full py-4 bg-white border-2 border-slate-200 hover:border-rose-100 hover:text-rose-600 text-slate-600 rounded-[24px] text-sm font-black transition-all shadow-sm active:scale-95"
                >
                  বন্ধ করুন
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </main>
    </div>
  );
});

export default SafeDealsEscrowView;
