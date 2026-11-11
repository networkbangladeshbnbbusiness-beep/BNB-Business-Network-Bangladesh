import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  X, 
  Search, 
  Gift, 
  AlertTriangle, 
  Megaphone, 
  CheckCircle2, 
  Trash2, 
  CheckCheck, 
  Clock, 
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ShieldCheck
} from 'lucide-react';
import { UserNotification, User } from '../types';

interface NotificationInboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  userNotifications: UserNotification[];
  user: User;
  onMarkAllAsRead: () => void;
  onDeleteNotification: (id: string) => void;
  onClearAllNotifications?: () => void;
}

// Helper to identify standard peer-to-peer financial transactions that belong in bottom navigation transaction history
export const isGeneralTransactionNotif = (n: UserNotification): boolean => {
  if (!n) return false;
  const type = String(n.type || '').toLowerCase().trim();
  const category = String(n.category || '').toLowerCase().trim();
  const title = String(n.title || '').toLowerCase().trim();
  const body = String(n.body || n.message || '').toLowerCase().trim();

  // Explicit flag for transaction history items (unless it's an admin profile bonus/fine)
  if (n.isTransactionHistory === true && !title.includes('বোনাস') && !title.includes('কর্তন') && !title.includes('জরিমানা') && !title.includes('এডমিন')) {
    return true;
  }

  // Check financial transaction types
  const txTypes = [
    'send_money', 'transfer', 'money_sent', 'money_received', 'received_transfer',
    'recharge', 'telecom', 'bill_pay', 'add_money_request', 'withdraw', 'cash_out',
    'auto_recharge', 'samity_deposit', 'coop_savings_deposit'
  ];
  if (txTypes.includes(type) || txTypes.includes(category)) {
    if (title.includes('এডমিন') || title.includes('বোনাস') || title.includes('জরিমানা') || title.includes('কর্তন')) {
      return false;
    }
    return true;
  }

  // Common payment / send money title phrases
  const txTitleKeywords = [
    'টাকা পাঠানো সফল', 'money sent', 'টাকা গ্রহণ সফল', 'money received',
    'ক্যাশ আউট সফল', 'রিচার্জ সফল', 'বিল পে সফল', 'সেন্ড মানি'
  ];

  if (txTitleKeywords.some(kw => title.includes(kw))) {
    if (!title.includes('বোনাস') && !title.includes('কর্তন') && !title.includes('জরিমানা') && !title.includes('এডমিন')) {
      return true;
    }
  }

  return false;
};

// Category 1: Admin Bonus / Credit
export const isBonusNotif = (n: UserNotification): boolean => {
  if (isGeneralTransactionNotif(n)) return false;
  const type = String(n.type || '').toLowerCase().trim();
  const category = String(n.category || '').toLowerCase().trim();
  const title = String(n.title || '').toLowerCase().trim();
  const body = String(n.body || n.message || '').toLowerCase().trim();

  return (
    type === 'bonus' || 
    category === 'bonus' || 
    n.notifyType === 'credit' ||
    type === 'admin_credit' ||
    title.includes('বোনাস') || 
    title.includes('কমিশন') || 
    title.includes('রিওয়ার্ড') ||
    title.includes('মূল ব্যালেন্স আপডেট (জমা)') ||
    (title.includes('এডমিন') && (title.includes('যোগ') || title.includes('জমা') || title.includes('বোনাস'))) ||
    (body.includes('এডমিন কর্তৃক') && (body.includes('যোগ') || body.includes('জমা')))
  );
};

// Category 2: Admin Deduction / Penalty / Fine
export const isDeductionNotif = (n: UserNotification): boolean => {
  if (isGeneralTransactionNotif(n)) return false;
  const type = String(n.type || '').toLowerCase().trim();
  const category = String(n.category || '').toLowerCase().trim();
  const title = String(n.title || '').toLowerCase().trim();
  const body = String(n.body || n.message || '').toLowerCase().trim();

  return (
    type === 'fine' || 
    category === 'fine' || 
    category === 'deduction' || 
    n.notifyType === 'debit' ||
    type === 'admin_debit' ||
    title.includes('কর্তন') || 
    title.includes('জরিমানা') || 
    title.includes('ফাইন') || 
    title.includes('মূল ব্যালেন্স আপডেট (কর্তন)') ||
    (title.includes('এডমিন') && (title.includes('কর্তন') || title.includes('জরিমানা'))) ||
    (body.includes('এডমিন কর্তৃক') && (body.includes('কর্তন') || body.includes('কমানো')))
  );
};

// Category 3: Admin Emergency Notice / System Announcement
export const isNoticeNotif = (n: UserNotification): boolean => {
  if (isGeneralTransactionNotif(n)) return false;
  if (isBonusNotif(n) || isDeductionNotif(n)) return false;
  return true;
};

export const NotificationInboxModal: React.FC<NotificationInboxModalProps> = ({
  isOpen,
  onClose,
  userNotifications,
  user: _user,
  onMarkAllAsRead,
  onDeleteNotification,
  onClearAllNotifications
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'bonus' | 'deduction' | 'notice'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNotif, setSelectedNotif] = useState<UserNotification | null>(null);

  // Filter allowed notifications for Top Bell Inbox (Excludes general transaction receipts)
  const allowedNotifications = useMemo(() => {
    return userNotifications.filter(n => !isGeneralTransactionNotif(n));
  }, [userNotifications]);

  // Counts for Bell Notification Inbox
  const counts = useMemo(() => {
    let unread = 0;
    let bonus = 0;
    let deduction = 0;
    let notice = 0;

    allowedNotifications.forEach(n => {
      if (!n.read) unread++;
      if (isBonusNotif(n)) bonus++;
      else if (isDeductionNotif(n)) deduction++;
      else notice++;
    });

    return { total: allowedNotifications.length, unread, bonus, deduction, notice };
  }, [allowedNotifications]);

  // Filtered list based on active tab & search
  const filteredNotifications = useMemo(() => {
    return allowedNotifications.filter(n => {
      // 1. Tab filter
      if (activeTab === 'bonus' && !isBonusNotif(n)) return false;
      if (activeTab === 'deduction' && !isDeductionNotif(n)) return false;
      if (activeTab === 'notice' && !isNoticeNotif(n)) return false;

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (n.title || '').toLowerCase().includes(q);
        const bodyMatch = (n.body || n.message || '').toLowerCase().includes(q);
        const amtMatch = n.amount ? String(n.amount).includes(q) : false;
        return titleMatch || bodyMatch || amtMatch;
      }

      return true;
    });
  }, [allowedNotifications, activeTab, searchQuery]);

  if (!isOpen) return null;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'তারিখ পাওয়া যায়নি';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      
      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      };
      return new Intl.DateTimeFormat('en-US', options).format(d);
    } catch {
      return String(dateStr);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-slate-100 text-slate-800 w-screen h-screen overflow-hidden font-sans animate-in fade-in duration-200">
      <div className="h-10 shrink-0 bg-[#004a2c] w-full"></div>
      
      <div className="bg-slate-50 w-full h-full flex flex-col overflow-hidden relative">
        
        {/* Header Bar - Official Deep Green (#004a2c) */}
        <div className="bg-[#004a2c] text-white shadow-md flex items-center justify-between gap-2 px-3.5 py-4 shrink-0 border-b border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-white shadow-xs relative shrink-0">
              <Bell className="w-5 h-5 text-white" />
              {counts.unread > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#004a2c] shadow-sm font-mono">
                  {counts.unread > 9 ? '9+' : counts.unread}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white leading-none font-sans tracking-tight truncate">
                  নোটিফিকেশন ও ইনবক্স
                </h2>
                <span className="bg-white/20 text-white font-bold text-[10px] px-2 py-0.5 rounded-full font-mono shrink-0">
                  {counts.unread} অপঠিত
                </span>
              </div>
              <p className="text-[10.5px] text-emerald-100 mt-1 font-sans truncate">
                সর্বমোট {counts.total}টি আপডেট বার্তা সংরক্ষিত রয়েছে
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white flex items-center justify-center transition cursor-pointer shrink-0 border border-white/20"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Controls Bar (Mark All as Read / Clear All) - Clean Light Background */}
        <div className="px-3.5 py-2.5 bg-white border-b border-slate-200/80 flex items-center justify-between gap-2 shrink-0 text-xs shadow-2xs">
          <button
            type="button"
            onClick={onMarkAllAsRead}
            disabled={counts.unread === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer border ${
              counts.unread > 0 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 active:scale-95 shadow-2xs' 
                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
            }`}
          >
            <CheckCheck className="w-4 h-4 text-emerald-700" />
            <span>সব পঠিত করুন</span>
          </button>

          {onClearAllNotifications && counts.total > 0 && (
            <button
              type="button"
              onClick={onClearAllNotifications}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 active:scale-95 transition cursor-pointer shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>সব মুছুন</span>
            </button>
          )}
        </div>

        {/* Search Bar - Crisp White Input with High Contrast */}
        <div className="px-3.5 pt-2.5 pb-2 bg-slate-50 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-emerald-700 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="নোটিফিকেশনে খুঁজুন (যেমন: ওটিপি, বোনাস, কর্তন, ৫০ টাকা)..."
              className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none transition shadow-2xs font-sans font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Tabs - Matching Software Design (Deep Green Active / Crisp White Inactive) */}
        <div className="px-3.5 py-1.5 shrink-0 overflow-x-auto no-scrollbar bg-slate-50">
          <div className="flex items-center gap-2 min-w-max pb-1">
            {[
              { id: 'all', label: 'সকল', count: counts.total, icon: Bell },
              { id: 'bonus', label: 'বোনাস', count: counts.bonus, icon: Gift },
              { id: 'deduction', label: 'কর্তন', count: counts.deduction, icon: AlertTriangle },
              { id: 'notice', label: 'আপডেট / নোটিশ', count: counts.notice, icon: Megaphone }
            ].map(tab => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer border shadow-2xs ${
                    isActive
                      ? 'bg-[#0b6623] text-white border-emerald-700 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-250 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <TabIcon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-300' : 'text-slate-500'}`} />
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Notifications Scrollable List - Crisp White Cards with High-Contrast Text */}
        <div className="flex-1 overflow-y-auto px-3.5 py-2.5 space-y-3 bg-slate-100/70">
          {filteredNotifications.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-white rounded-3xl border border-dashed border-slate-300 my-4 shadow-xs">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center mb-3 shadow-inner">
                <Bell className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-black text-slate-800 font-sans">
                কোনো নোটিফিকেশন পাওয়া যায়নি
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs font-sans">
                {searchQuery 
                  ? 'আপনার অনুসন্ধানের সাথে মেলে এমন কোনো ইনবক্স বার্তা নেই।' 
                  : 'এই ক্যাটাগরিতে এই মুহূর্তে কোনো নোটিফিকেশন বা বার্তা সংরক্ষিত নেই।'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const isBonus = isBonusNotif(notif);
              const isDeduction = isDeductionNotif(notif);
              const isUnread = !notif.read;

              return (
                <div
                  key={notif.id || notif.docId}
                  onClick={() => setSelectedNotif(notif)}
                  className={`group relative p-4 rounded-2xl transition cursor-pointer border shadow-xs hover:shadow-md ${
                    isUnread
                      ? 'bg-white border-l-4 border-l-[#0b6623] border-slate-200 ring-1 ring-emerald-500/10'
                      : 'bg-white border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  {/* Unread Glowing Dot Indicator */}
                  {isUnread && (
                    <div className="absolute top-4 right-4 flex items-center gap-1">
                      <span className="w-2.5 h-2.5 bg-emerald-600 rounded-full animate-ping" />
                      <span className="w-2.5 h-2.5 bg-emerald-600 rounded-full" />
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    {/* Category Icon Badge */}
                    <div className={`w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center shadow-2xs border ${
                      isBonus
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : isDeduction
                        ? 'bg-rose-100 text-rose-700 border-rose-300'
                        : 'bg-sky-100 text-sky-800 border-sky-300'
                    }`}>
                      {isBonus ? (
                        <TrendingUp className="w-5 h-5" />
                      ) : isDeduction ? (
                        <TrendingDown className="w-5 h-5" />
                      ) : (
                        <Megaphone className="w-5 h-5" />
                      )}
                    </div>

                    {/* Content Details */}
                    <div className="flex-1 min-w-0 pr-4">
                      {/* Top Row: Category tag & Time */}
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border uppercase tracking-wider ${
                          isBonus
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-250'
                            : isDeduction
                            ? 'bg-rose-50 text-rose-900 border-rose-250'
                            : 'bg-sky-50 text-sky-900 border-sky-250'
                        }`}>
                          {isBonus ? '🎁 বোনাস' : isDeduction ? '⚠️ কর্তন / ফি' : '📢 নোটিশ'}
                        </span>

                        <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1 ml-auto font-medium">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatDate(notif.createdAt)}
                        </span>
                      </div>

                      {/* Notification Title - Clear High Contrast */}
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-snug font-sans tracking-tight">
                        {notif.title || (isBonus ? '🎁 বোনাস জমা হয়েছে' : isDeduction ? '⚠️ টাকা কর্তন করা হয়েছে' : '📢 সিস্টেম নোটিফিকেশন')}
                      </h4>

                      {/* Main Amount if available */}
                      {notif.amount !== undefined && notif.amount !== null && Number(notif.amount) > 0 && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-600">পরিমাণ:</span>
                          <span className={`text-xs sm:text-sm font-black font-mono ${
                            isBonus ? 'text-emerald-700' : isDeduction ? 'text-rose-700' : 'text-slate-900'
                          }`}>
                            {isBonus ? '+' : isDeduction ? '-' : ''} ৳ {Number(notif.amount).toFixed(2)}
                          </span>
                        </div>
                      )}

                      {/* Reason / Body - Clean High Contrast Slate-700 */}
                      <p className="text-xs sm:text-[12.5px] text-slate-700 font-medium mt-1.5 line-clamp-2 leading-relaxed font-sans">
                        {notif.body || notif.message || 'কোনো বিস্তারিত বিবরণ দেয়া হয়নি।'}
                      </p>
                    </div>
                  </div>

                  {/* Bottom Bar Controls for Item */}
                  <div className="mt-3 pt-2.5 border-t border-slate-150 flex items-center justify-between text-xs text-slate-600">
                    <span className="flex items-center gap-1 text-[#0b6623] hover:text-emerald-900 font-extrabold cursor-pointer">
                      <span>বিস্তারিত দেখুন</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (notif.id || notif.docId) {
                          onDeleteNotification(notif.id || notif.docId || '');
                        }
                      }}
                      className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                      title="মুছে ফেলুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer - Clean Light Footer matching BNB styling */}
        <div className="p-3 bg-white border-t border-slate-200 shrink-0 text-center pb-safe">
          <p className="text-[11px] text-slate-600 font-bold font-sans flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span>BNB Business Network Bangladesh — রিয়েল-টাইম তথ্য ও নোটিফিকেশন সিস্টেম</span>
          </p>
        </div>
      </div>

      {/* Selected Notification Full Details Modal - Clean White Theme with High Contrast */}
      <AnimatePresence>
        {selectedNotif && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs font-sans"
          >
            <div className="bg-white border border-slate-200 text-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 relative overflow-hidden">
              {/* Header Icon & Close Button */}
              <div className="flex items-center justify-between">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs border ${
                  isBonusNotif(selectedNotif)
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : isDeductionNotif(selectedNotif)
                    ? 'bg-rose-100 text-rose-700 border-rose-300'
                    : 'bg-sky-100 text-sky-800 border-sky-300'
                }`}>
                  {isBonusNotif(selectedNotif) ? (
                    <Gift className="w-6 h-6" />
                  ) : isDeductionNotif(selectedNotif) ? (
                    <AlertTriangle className="w-6 h-6" />
                  ) : (
                    <Megaphone className="w-6 h-6" />
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedNotif(null)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Title & Badge */}
              <div>
                <span className={`inline-block text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider mb-2 border ${
                  isBonusNotif(selectedNotif)
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : isDeductionNotif(selectedNotif)
                    ? 'bg-rose-50 text-rose-900 border-rose-300'
                    : 'bg-sky-50 text-sky-900 border-sky-300'
                }`}>
                  {isBonusNotif(selectedNotif) ? '🎁 বোনাস বার্তা' : isDeductionNotif(selectedNotif) ? '⚠️ টাকা কর্তন / ফি' : '📢 সিস্টেম আপডেট'}
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug font-sans">
                  {selectedNotif.title}
                </h3>
                <p className="text-[11px] text-slate-500 mt-1.5 font-mono flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {formatDate(selectedNotif.createdAt)}
                </p>
              </div>

              {/* Amount Box if present */}
              {selectedNotif.amount !== undefined && selectedNotif.amount !== null && (
                <div className={`p-4 rounded-2xl border text-center ${
                  isBonusNotif(selectedNotif)
                    ? 'bg-emerald-50 border-emerald-250 text-emerald-900'
                    : isDeductionNotif(selectedNotif)
                    ? 'bg-rose-50 border-rose-250 text-rose-900'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}>
                  <span className="text-xs text-slate-600 font-bold block mb-0.5">লেনদেনের পরিমাণ</span>
                  <span className="text-2xl font-black font-mono">
                    {isBonusNotif(selectedNotif) ? '+' : isDeductionNotif(selectedNotif) ? '-' : ''} ৳ {Number(selectedNotif.amount).toFixed(2)}
                  </span>
                </div>
              )}

              {/* Description Body */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1.5">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                  কারণ / বিবরণ (Reason & Description):
                </span>
                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-sans whitespace-pre-wrap font-medium">
                  {selectedNotif.body || selectedNotif.message || 'কোনো বিবরণ দেয়া নেই।'}
                </p>
              </div>

              {/* Close / Action Buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedNotif.id || selectedNotif.docId) {
                      onDeleteNotification(selectedNotif.id || selectedNotif.docId || '');
                    }
                    setSelectedNotif(null);
                  }}
                  className="flex-1 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-black rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>মুছে ফেলুন</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedNotif(null)}
                  className="flex-[2] py-3 bg-[#0b6623] hover:bg-emerald-800 text-white font-black rounded-xl text-xs transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ঠিক আছে, বুঝেছি</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
