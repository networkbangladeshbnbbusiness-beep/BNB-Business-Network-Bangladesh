import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { 
  Trash2, 
  Edit, 
  User, 
  Search, 
  Plus, 
  X, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  UserPlus, 
  UserMinus, 
  ArrowLeft, 
  Bell, 
  CheckCircle2 
} from 'lucide-react';

interface BnbHisabKhataAdminProps {
  onBack: () => void;
}

interface LedgerTransaction {
  id: string;
  userId: string;
  type: 'income' | 'expense' | 'receivable' | 'payable';
  amount: number;
  title: string;
  category: string;
  date: string;
  time: string;
  phone?: string;
  createdAt: string;
  userName?: string;
  userPhone?: string;
}

interface PlatformUser {
  uid: string;
  name: string;
  phone: string;
  memberId?: string;
}

export default function BnbHisabKhataAdmin({ onBack }: BnbHisabKhataAdminProps) {
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & State
  const [search, setSearch] = useState('');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [reportTimeframe, setReportTimeframe] = useState<'all_time' | 'today' | 'this_week' | 'this_month'>('all_time');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTx, setEditingTx] = useState<LedgerTransaction | null>(null);

  // Form State
  const [formUserId, setFormUserId] = useState('');
  const [formType, setFormType] = useState<'income' | 'expense' | 'receivable' | 'payable'>('income');
  const [formTitle, setFormTitle] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('সাধারণ');
  const [formPhone, setFormPhone] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);

  // Load Transactions & Users
  useEffect(() => {
    // 1. Listen to all transactions
    const txQuery = query(collection(db, 'hisab_transactions'));
    const unsubscribeTx = onSnapshot(txQuery, (snapshot) => {
      const list: LedgerTransaction[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          userId: data.userId || '',
          type: data.type || 'income',
          amount: Number(data.amount) || 0,
          title: data.title || '',
          category: data.category || 'সাধারণ',
          date: data.date || '',
          time: data.time || '',
          phone: data.phone || '',
          createdAt: data.createdAt || ''
        });
      });
      // Sort by date/time descending
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTransactions(list);
      setLoading(false);
    }, (error) => {
      console.error("Error loading transactions for admin:", error);
      setLoading(false);
    });

    // 2. Listen to users list
    const usersQuery = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      const uList: PlatformUser[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        uList.push({
          uid: docSnap.id,
          name: data.name || 'নাম নেই',
          phone: data.phone || 'মোবাইল নম্বর নেই',
          memberId: data.memberId || ''
        });
      });
      setUsers(uList);
    });

    return () => {
      unsubscribeTx();
      unsubscribeUsers();
    };
  }, []);

  // Helper to find username/phone
  const getUserMeta = (userId: string) => {
    const found = users.find(u => u.uid === userId);
    return found ? { name: found.name, phone: found.phone } : { name: 'অজানা ব্যবহারকারী', phone: '' };
  };

  // Filter logic
  const getFilteredTransactions = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDate = now.getDate();

    return transactions.filter(tx => {
      // 1. User Filter
      if (selectedUserFilter !== 'all' && tx.userId !== selectedUserFilter) return false;

      // 2. Type Filter
      if (selectedTypeFilter !== 'all' && tx.type !== selectedTypeFilter) return false;

      // 3. Search Filter
      const meta = getUserMeta(tx.userId);
      const matchesSearch = 
        tx.title.toLowerCase().includes(search.toLowerCase()) ||
        tx.category.toLowerCase().includes(search.toLowerCase()) ||
        meta.name.toLowerCase().includes(search.toLowerCase()) ||
        meta.phone.includes(search);
      if (!matchesSearch) return false;

      // 4. Timeframe Filter
      if (!tx.date) return false;
      const parts = tx.date.split('-');
      if (parts.length !== 3) return false;
      const txYear = parseInt(parts[0], 10);
      const txMonth = parseInt(parts[1], 10);
      const txDay = parseInt(parts[2], 10);

      if (reportTimeframe === 'today') {
        return txYear === currentYear && txMonth === currentMonth && txDay === currentDate;
      } else if (reportTimeframe === 'this_week') {
        const txDateObj = new Date(txYear, txMonth - 1, txDay);
        const todayObj = new Date(currentYear, currentMonth - 1, currentDate);
        const diffTime = todayObj.getTime() - txDateObj.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 7;
      } else if (reportTimeframe === 'this_month') {
        return txYear === currentYear && txMonth === currentMonth;
      }

      return true; // all_time
    });
  };

  const filteredTx = getFilteredTransactions();

  // Statistics
  const totalIncome = filteredTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = filteredTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const totalReceivable = filteredTx.filter(t => t.type === 'receivable').reduce((sum, t) => sum + t.amount, 0);
  const totalPayable = filteredTx.filter(t => t.type === 'payable').reduce((sum, t) => sum + t.amount, 0);
  const netProfit = totalIncome - totalExpense;

  // Create real-time notification in user's inbox
  const sendInboxNotification = async (userId: string, title: string, body: string) => {
    try {
      const notifyId = `notif-${Date.now()}`;
      await addDoc(collection(db, 'user_notifications'), {
        id: notifyId,
        userId: userId,
        title: title,
        body: body,
        read: false,
        isPersonal: true,
        category: 'admin_msg',
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to send user notification:", err);
    }
  };

  // Add transaction
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUserId) {
      alert("অনুগ্রহ করে ব্যবহারকারী নির্বাচন করুন!");
      return;
    }
    if (!formTitle || !formAmount) {
      alert("অনুগ্রহ করে বিবরণ ও টাকার পরিমাণ দিন!");
      return;
    }

    try {
      const targetUser = users.find(u => u.uid === formUserId);
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);

      const docData = {
        userId: formUserId,
        type: formType,
        title: formTitle,
        amount: Number(formAmount),
        category: formCategory,
        phone: (formType === 'receivable' || formType === 'payable') ? formPhone : '',
        date: formDate,
        time: timeStr,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'hisab_transactions'), docData);

      // Trigger automatic inbox notification
      let typeText = "আয়";
      if (formType === 'expense') typeText = "ব্যয়";
      if (formType === 'receivable') typeText = "পাওনা (বকেয়া)";
      if (formType === 'payable') typeText = "দেনা";

      await sendInboxNotification(
        formUserId,
        `📊 হিসাব খাতা আপডেট করা হয়েছে`,
        `অ্যাডমিন প্যানেল আপনার হিসাব খাতায় একটি নতুন ${typeText} লেনদেন যোগ করেছে। বিবরণ: ${formTitle}, পরিমাণ: ৳${Number(formAmount).toLocaleString('en-IN')}।`
      );

      // Reset
      setFormTitle('');
      setFormAmount('');
      setFormCategory('সাধারণ');
      setFormPhone('');
      setShowAddModal(false);
      alert("হিসাব লেনদেন সফলভাবে যোগ করা হয়েছে এবং গ্রাহককে অবহিত করা হয়েছে!");
    } catch (err: any) {
      alert("যোগ করতে সমস্যা হয়েছে: " + err.message);
    }
  };

  // Edit transaction
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;

    try {
      const docRef = doc(db, 'hisab_transactions', editingTx.id);
      await updateDoc(docRef, {
        title: formTitle,
        amount: Number(formAmount),
        type: formType,
        category: formCategory,
        date: formDate,
        phone: (formType === 'receivable' || formType === 'payable') ? formPhone : ''
      });

      // Notify user
      let typeText = "আয়";
      if (formType === 'expense') typeText = "ব্যয়";
      if (formType === 'receivable') typeText = "পাওনা";
      if (formType === 'payable') typeText = "দেনা";

      await sendInboxNotification(
        editingTx.userId,
        `✏️ হিসাব লেনদেন সংশোধিত হয়েছে`,
        `অ্যাডমিন আপনার পূর্বের লেনদেনটি সংশোধন করেছেন। নতুন বিবরণ: ${formTitle}, নতুন পরিমাণ: ৳${Number(formAmount).toLocaleString('en-IN')} (${typeText})।`
      );

      setEditingTx(null);
      alert("লেনদেন সফলভাবে সংশোধন করা হয়েছে!");
    } catch (err: any) {
      alert("সংশোধন করতে সমস্যা হয়েছে: " + err.message);
    }
  };

  // Delete transaction
  const handleDelete = async (tx: LedgerTransaction) => {
    if (window.confirm(`আপনি কি নিশ্চিতভাবে "${tx.title}" লেনদেনটি মুছে ফেলতে চান?`)) {
      try {
        await deleteDoc(doc(db, 'hisab_transactions', tx.id));
        
        await sendInboxNotification(
          tx.userId,
          `🗑️ হিসাব লেনদেন মুছে ফেলা হয়েছে`,
          `অ্যাডমিন প্যানেল থেকে আপনার হিসাব খাতার একটি লেনদেন (${tx.title}, পরিমাণ: ৳${tx.amount.toLocaleString('en-IN')}) মুছে ফেলা হয়েছে।`
        );
        alert("লেনদেনটি সফলভাবে মুছে ফেলা হয়েছে!");
      } catch (err: any) {
        alert("মুছে ফেলতে সমস্যা হয়েছে: " + err.message);
      }
    }
  };

  // Open Edit Modal
  const startEdit = (tx: LedgerTransaction) => {
    setEditingTx(tx);
    setFormUserId(tx.userId);
    setFormType(tx.type);
    setFormTitle(tx.title);
    setFormAmount(tx.amount.toString());
    setFormCategory(tx.category);
    setFormPhone(tx.phone || '');
    setFormDate(tx.date);
  };

  const getBengaliDate = (dateStr: string) => {
    const months = [
      'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 
      'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
    ];
    if (!dateStr) return '';
    const p = dateStr.split('-');
    if (p.length !== 3) return dateStr;
    const year = p[0];
    const month = months[parseInt(p[1], 10) - 1] || p[1];
    const day = parseInt(p[2], 10);
    return `${day} ${month}, ${year}`;
  };

  return (
    <div className="bg-[#f3f4f6] min-h-screen font-sans pb-12">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-white/10 rounded-full transition active:scale-95"
              title="ফিরে যান"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-lg md:text-xl font-black tracking-tight">BNB হিসাব খাতা অ্যাডমিন গেটওয়ে</h1>
              <p className="text-[10px] md:text-xs text-emerald-200 font-bold">সকল সদস্যের টালি ও হিসাব খাতা রিয়েল-টাইম নিয়ন্ত্রণ প্যানেল</p>
            </div>
          </div>
          <button
            onClick={() => {
              setFormUserId('');
              setFormType('income');
              setFormTitle('');
              setFormAmount('');
              setFormCategory('সাধারণ');
              setFormPhone('');
              setFormDate(new Date().toISOString().split('T')[0]);
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-black rounded-xl transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            নতুন এন্ট্রি
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-6 space-y-6">
        
        {/* REPORT TIMEFRAME SELECTOR */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">রিপোর্ট ফিল্টারিং সময়কাল</h2>
            <p className="text-[10px] text-slate-400 font-bold">ফিল্টারকৃত সময়ের উপর ভিত্তি করে পরিসংখ্যান পরিবর্তিত হবে</p>
          </div>
          <div className="grid grid-cols-4 md:flex gap-1 bg-slate-50 p-1 rounded-xl">
            {(['all_time', 'today', 'this_week', 'this_month'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setReportTimeframe(tf)}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition text-center whitespace-nowrap ${
                  reportTimeframe === tf 
                    ? 'bg-[#00a884] text-white shadow-3xs' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tf === 'all_time' ? 'সর্বমোট' : tf === 'today' ? 'আজ' : tf === 'this_week' ? 'সপ্তাহ' : 'মাস'}
              </button>
            ))}
          </div>
        </div>

        {/* METRICS DASHBOARD - 5 COLUMNS BENTO */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
          {/* Total Income */}
          <div className="bg-white border border-emerald-100/60 p-4 rounded-2xl shadow-3xs flex flex-col justify-between h-28 relative overflow-hidden">
            <div className="absolute top-2 right-2 w-7 h-7 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
              <TrendingDown className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black text-slate-400">মোট প্লাটফর্ম আয়</span>
            <div className="my-1">
              <span className="text-lg md:text-xl font-black text-slate-900 block truncate">
                ৳{totalIncome.toLocaleString('en-IN')}
              </span>
            </div>
            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md inline-block w-max">
              {filteredTx.filter(t => t.type === 'income').length} টি সফল রিসিভ
            </span>
          </div>

          {/* Total Expense */}
          <div className="bg-white border border-rose-100/60 p-4 rounded-2xl shadow-3xs flex flex-col justify-between h-28 relative overflow-hidden">
            <div className="absolute top-2 right-2 w-7 h-7 bg-rose-50 rounded-full flex items-center justify-center text-rose-600">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black text-slate-400">মোট প্লাটফর্ম ব্যয়</span>
            <div className="my-1">
              <span className="text-lg md:text-xl font-black text-slate-900 block truncate">
                ৳{totalExpense.toLocaleString('en-IN')}
              </span>
            </div>
            <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md inline-block w-max">
              {filteredTx.filter(t => t.type === 'expense').length} টি সফল খরচ
            </span>
          </div>

          {/* Net Profit */}
          <div className="bg-white border border-blue-100/60 p-4 rounded-2xl shadow-3xs flex flex-col justify-between h-28 relative overflow-hidden">
            <div className="absolute top-2 right-2 w-7 h-7 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
              <TrendingDown className="w-4 h-4 rotate-180" />
            </div>
            <span className="text-[10px] font-black text-slate-400">মোট নিট লাভ / লোকসান</span>
            <div className="my-1">
              <span className={`text-lg md:text-xl font-black block truncate ${netProfit >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                ৳{netProfit.toLocaleString('en-IN')}
              </span>
            </div>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md inline-block w-max ${netProfit >= 0 ? 'text-blue-600 bg-blue-50' : 'text-rose-600 bg-rose-50'}`}>
              {netProfit >= 0 ? 'লাভজনক অবস্থা' : 'ক্ষতিগ্রস্ত অবস্থা'}
            </span>
          </div>

          {/* Total Receivable */}
          <div className="bg-white border border-orange-100/60 p-4 rounded-2xl shadow-3xs flex flex-col justify-between h-28 relative overflow-hidden col-span-1">
            <div className="absolute top-2 right-2 w-7 h-7 bg-orange-50 rounded-full flex items-center justify-center text-orange-600">
              <UserPlus className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black text-slate-400">মোট বকেয়া পাওনা</span>
            <div className="my-1">
              <span className="text-lg md:text-xl font-black text-slate-900 block truncate">
                ৳{totalReceivable.toLocaleString('en-IN')}
              </span>
            </div>
            <span className="text-[9px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md inline-block w-max">
              {new Set(filteredTx.filter(t => t.type === 'receivable').map((t, idx) => t.phone || t.title)).size} জন গ্রাহক
            </span>
          </div>

          {/* Total Payable */}
          <div className="bg-white border border-purple-100/60 p-4 rounded-2xl shadow-3xs flex flex-col justify-between h-28 relative overflow-hidden col-span-2 md:col-span-1">
            <div className="absolute top-2 right-2 w-7 h-7 bg-purple-50 rounded-full flex items-center justify-center text-purple-600">
              <UserMinus className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black text-slate-400">মোট বকেয়া দেনা</span>
            <div className="my-1">
              <span className="text-lg md:text-xl font-black text-slate-900 block truncate">
                ৳{totalPayable.toLocaleString('en-IN')}
              </span>
            </div>
            <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md inline-block w-max">
              {new Set(filteredTx.filter(t => t.type === 'payable').map((t, idx) => t.phone || t.title)).size} জন মহাজন
            </span>
          </div>
        </div>

        {/* CONTROLS & FILTERING PANEL */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-3xs space-y-4">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-50 pb-2">সার্চ ও কাস্টম ফিল্টারিং প্যানেল</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* 1. Filter by Specific User */}
            <div>
              <label className="text-[11px] font-black text-slate-500 block mb-1">সদস্য ফিল্টার</label>
              <select
                value={selectedUserFilter}
                onChange={(e) => setSelectedUserFilter(e.target.value)}
                className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
              >
                <option value="all">সকল সদস্য (সবাই)</option>
                {users.map((u, idx) => (
                  <option key={`${u.uid}-${idx}`} value={u.uid}>{u.name} ({u.phone})</option>
                ))}
              </select>
            </div>

            {/* 2. Filter by Type */}
            <div>
              <label className="text-[11px] font-black text-slate-500 block mb-1">লেনদেনের ধরন</label>
              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
              >
                <option value="all">সকল ধরন</option>
                <option value="income">মোট আয় (রিসিভ)</option>
                <option value="expense">মোট ব্যয় (খরচ)</option>
                <option value="receivable">মোট বকেয়া পাওনা</option>
                <option value="payable">মোট বকেয়া দেনা</option>
              </select>
            </div>

            {/* 3. Text Search */}
            <div className="md:col-span-2">
              <label className="text-[11px] font-black text-slate-500 block mb-1">বিবরণ, ক্যাটাগরি, নাম বা ফোন নম্বর</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="সার্চ করুন..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-200 rounded-xl pl-9 pr-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* MAIN DATA TABLE / LIST */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-3xs overflow-hidden">
          <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
            <span className="text-xs font-black text-slate-700">
              ফলাফল: {filteredTx.length} টি লেনদেন পাওয়া গেছে
            </span>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-xs font-bold text-slate-400">লেনদেন লোড হচ্ছে...</p>
            </div>
          ) : filteredTx.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-xs font-black text-slate-400">কোনো তথ্য পাওয়া যায়নি। ফিল্টার পরিবর্তন করে পুনরায় চেষ্টা করুন।</p>
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE VIEW */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase font-black tracking-wider border-b border-slate-100">
                      <th className="p-4">তারিখ ও সময়</th>
                      <th className="p-4">সদস্যের তথ্য</th>
                      <th className="p-4">বিবরণ ও ক্যাটাগরি</th>
                      <th className="p-4 text-center">ধরন</th>
                      <th className="p-4 text-right">পরিমাণ (টাকা)</th>
                      <th className="p-4 text-center">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-black text-slate-700">
                    {filteredTx.map((tx, idx) => {
                      const userMeta = getUserMeta(tx.userId);
                      return (
                        <tr key={`${tx.id}-${idx}`} className="hover:bg-slate-50/50 transition">
                          <td className="p-4">
                            <div className="font-black text-slate-900">{getBengaliDate(tx.date)}</div>
                            <span className="text-[10px] text-slate-400 font-bold block">{tx.time || '--:--'}</span>
                          </td>
                          <td className="p-4">
                            <div className="font-black text-slate-900 flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              {userMeta.name}
                            </div>
                            <span className="text-[10px] text-slate-400 font-bold block">{userMeta.phone}</span>
                          </td>
                          <td className="p-4">
                            <div className="font-black text-slate-900">{tx.title}</div>
                            <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-bold inline-block mt-0.5">
                              {tx.category}
                            </span>
                            {tx.phone && (
                              <span className="text-[9px] text-slate-500 font-bold block mt-0.5">
                                মোবাইল: {tx.phone}
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            {tx.type === 'income' && (
                              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black border border-emerald-100">
                                আয়
                              </span>
                            )}
                            {tx.type === 'expense' && (
                              <span className="px-2.5 py-1 bg-rose-50 text-rose-600 rounded-full text-[10px] font-black border border-rose-100">
                                ব্যয়
                              </span>
                            )}
                            {tx.type === 'receivable' && (
                              <span className="px-2.5 py-1 bg-orange-50 text-orange-600 rounded-full text-[10px] font-black border border-orange-100">
                                পাওনা
                              </span>
                            )}
                            {tx.type === 'payable' && (
                              <span className="px-2.5 py-1 bg-purple-50 text-purple-600 rounded-full text-[10px] font-black border border-purple-100">
                                দেনা
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right text-sm font-black text-slate-900">
                            ৳{tx.amount.toLocaleString('en-IN')}
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex justify-center items-center gap-2">
                              <button
                                onClick={() => startEdit(tx)}
                                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition active:scale-95"
                                title="সম্পাদনা করুন"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(tx)}
                                className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-500 hover:text-rose-700 transition active:scale-95"
                                title="মুছে ফেলুন"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE LIST VIEW */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredTx.map((tx, idx) => {
                  const userMeta = getUserMeta(tx.userId);
                  return (
                    <div key={`${tx.id}-${idx}`} className="p-4 space-y-2.5">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-[10px] font-bold text-slate-400">{getBengaliDate(tx.date)} | {tx.time}</div>
                          <div className="text-xs font-black text-slate-900 flex items-center gap-1 mt-0.5">
                            <User className="w-3 h-3 text-slate-400" />
                            {userMeta.name} ({userMeta.phone})
                          </div>
                        </div>
                        <div>
                          {tx.type === 'income' && (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black border border-emerald-100">
                              আয়
                            </span>
                          )}
                          {tx.type === 'expense' && (
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full text-[9px] font-black border border-rose-100">
                              ব্যয়
                            </span>
                          )}
                          {tx.type === 'receivable' && (
                            <span className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full text-[9px] font-black border border-orange-100">
                              পাওনা
                            </span>
                          )}
                          {tx.type === 'payable' && (
                            <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full text-[9px] font-black border border-purple-100">
                              দেনা
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between items-end">
                        <div>
                          <h4 className="text-xs font-black text-slate-800">{tx.title}</h4>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-md inline-block mt-1">
                            {tx.category}
                          </span>
                          {tx.phone && (
                            <span className="text-[9px] font-bold text-slate-500 block mt-1">
                              গ্রাহক মোবাইল: {tx.phone}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black text-slate-900">৳{tx.amount.toLocaleString('en-IN')}</div>
                          <div className="flex justify-end gap-1.5 mt-2">
                            <button
                              onClick={() => startEdit(tx)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-500"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(tx)}
                              className="p-1 hover:bg-rose-50 rounded text-rose-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* --- ADD NEW TRANSACTION MODAL --- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs font-sans">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                📊 নতুন হিসাব এন্ট্রি যোগ করুন
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3">
              {/* Select User */}
              <div>
                <label className="text-[10px] font-black text-slate-500 block mb-1">সদস্য নির্বাচন করুন *</label>
                <select
                  value={formUserId}
                  onChange={(e) => setFormUserId(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                  required
                >
                  <option value="">-- সদস্য সিলেক্ট করুন --</option>
                  {users.map((u, idx) => (
                    <option key={`${u.uid}-${idx}`} value={u.uid}>{u.name} ({u.phone})</option>
                  ))}
                </select>
              </div>

              {/* Select Type */}
              <div>
                <label className="text-[10px] font-black text-slate-500 block mb-1">লেনদেনের ধরন *</label>
                <div className="grid grid-cols-4 gap-1">
                  {(['income', 'expense', 'receivable', 'payable'] as const).map((type) => {
                    let label = "আয়";
                    let col = "emerald";
                    if (type === 'expense') { label = "ব্যয়"; col = "rose"; }
                    if (type === 'receivable') { label = "পাওনা"; col = "orange"; }
                    if (type === 'payable') { label = "দেনা"; col = "purple"; }

                    const activeColors: Record<string, string> = {
                      income: 'bg-emerald-500 text-white',
                      expense: 'bg-rose-500 text-white',
                      receivable: 'bg-orange-500 text-white',
                      payable: 'bg-purple-500 text-white',
                    };

                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormType(type)}
                        className={`py-1.5 rounded-lg text-[10px] font-black text-center transition ${
                          formType === type 
                            ? activeColors[type]
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title / Description */}
              <div>
                <label className="text-[10px] font-black text-slate-500 block mb-1">বিবরণ (যেমন: সিম রিচার্জ বা চাল ক্রয়) *</label>
                <input
                  type="text"
                  placeholder="বিবরণ লিখুন"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                  required
                />
              </div>

              {/* Amount */}
              <div>
                <label className="text-[10px] font-black text-slate-500 block mb-1">টাকার পরিমাণ (৳) *</label>
                <input
                  type="number"
                  placeholder="টাকার পরিমাণ লিখুন"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                  required
                />
              </div>

              {/* Date */}
              <div>
                <label className="text-[10px] font-black text-slate-500 block mb-1">তারিখ *</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-[10px] font-black text-slate-500 block mb-1">ক্যাটাগরি</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                >
                  <option value="সাধারণ">সাধারণ</option>
                  <option value="টেলিকম">টেলিকম রিচার্জ</option>
                  <option value="বেতন">কর্মচারী বেতন</option>
                  <option value="রেশন">রেশন ও বাজার</option>
                  <option value="কমিশন">এজেন্ট কমিশন</option>
                  <option value="ঋণ">কর্জ বা ঋণ</option>
                </select>
              </div>

              {/* Customer Phone (Optional, for Receivable / Payable) */}
              {(formType === 'receivable' || formType === 'payable') && (
                <div>
                  <label className="text-[10px] font-black text-slate-500 block mb-1">গ্রাহক / মহাজনের মোবাইল নম্বর (ঐচ্ছিক)</label>
                  <input
                    type="tel"
                    placeholder="যেমন: 017xxxxxxxx"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black transition text-xs"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-[#00a884] hover:bg-[#008f72] text-white rounded-xl font-black transition active:scale-95 text-xs shadow-3xs"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT TRANSACTION MODAL --- */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs font-sans">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                ✏️ হিসাব এন্ট্রি সংশোধন করুন
              </h3>
              <button 
                onClick={() => setEditingTx(null)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3">
              {/* Selected User Notice */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] text-slate-400 font-bold block">সদস্যের তথ্য</span>
                <span className="text-xs font-black text-slate-800">
                  {getUserMeta(editingTx.userId).name} ({getUserMeta(editingTx.userId).phone})
                </span>
              </div>

              {/* Select Type */}
              <div>
                <label className="text-[10px] font-black text-slate-500 block mb-1">লেনদেনের ধরন *</label>
                <div className="grid grid-cols-4 gap-1">
                  {(['income', 'expense', 'receivable', 'payable'] as const).map((type) => {
                    let label = "আয়";
                    if (type === 'expense') label = "ব্যয়";
                    if (type === 'receivable') label = "পাওনা";
                    if (type === 'payable') label = "দেনা";

                    const activeColors: Record<string, string> = {
                      income: 'bg-emerald-500 text-white',
                      expense: 'bg-rose-500 text-white',
                      receivable: 'bg-orange-500 text-white',
                      payable: 'bg-purple-500 text-white',
                    };

                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormType(type)}
                        className={`py-1.5 rounded-lg text-[10px] font-black text-center transition ${
                          formType === type 
                            ? activeColors[type]
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title / Description */}
              <div>
                <label className="text-[10px] font-black text-slate-500 block mb-1">বিবরণ *</label>
                <input
                  type="text"
                  placeholder="বিবরণ লিখুন"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                  required
                />
              </div>

              {/* Amount */}
              <div>
                <label className="text-[10px] font-black text-slate-500 block mb-1">টাকার পরিমাণ (৳) *</label>
                <input
                  type="number"
                  placeholder="টাকার পরিমাণ লিখুন"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                  required
                />
              </div>

              {/* Date */}
              <div>
                <label className="text-[10px] font-black text-slate-500 block mb-1">তারিখ *</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-[10px] font-black text-slate-500 block mb-1">ক্যাটাগরি</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                >
                  <option value="সাধারণ">সাধারণ</option>
                  <option value="টেলিকম">টেলিকম রিচার্জ</option>
                  <option value="বেতন">কর্মচারী বেতন</option>
                  <option value="রেশন">রেশন ও বাজার</option>
                  <option value="কমিশন">এজেন্ট কমিশন</option>
                  <option value="ঋণ">কর্জ বা ঋণ</option>
                </select>
              </div>

              {/* Customer Phone (Optional, for Receivable / Payable) */}
              {(formType === 'receivable' || formType === 'payable') && (
                <div>
                  <label className="text-[10px] font-black text-slate-500 block mb-1">গ্রাহক / মহাজনের মোবাইল নম্বর (ঐচ্ছিক)</label>
                  <input
                    type="tel"
                    placeholder="যেমন: 017xxxxxxxx"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white transition outline-none"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black transition text-xs"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-[#00a884] hover:bg-[#008f72] text-white rounded-xl font-black transition active:scale-95 text-xs shadow-3xs"
                >
                  পরিবর্তন সেভ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
