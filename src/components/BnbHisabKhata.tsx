import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, AppConfig } from '../types';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  HelpCircle,
  User as UserIcon,
  Plus, 
  Minus, 
  UserPlus, 
  UserMinus, 
  FileText, 
  Users, 
  BarChart2, 
  Calculator, 
  Bell, 
  Trash2, 
  Edit, 
  Search, 
  Filter, 
  Calendar, 
  BookOpen, 
  Settings, 
  QrCode, 
  Save, 
  Phone, 
  MessageSquare, 
  Check,
  X,
  Pin,
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Share2,
  Star,
  Mic,
  Briefcase,
  Mail
} from 'lucide-react';

const triggerNotesUpdatedEvent = () => {
  try {
    try {
      window.dispatchEvent(new CustomEvent('local-notes-updated'));
    } catch {
      window.dispatchEvent(new Event('local-notes-updated'));
    }
  } catch {
    try {
      const evt = document.createEvent('Event');
      evt.initEvent('local-notes-updated', true, true);
      window.dispatchEvent(evt);
    } catch (e) {
      console.warn('Custom event dispatch error:', e);
    }
  }
};

interface BnbHisabKhataProps {
  user: User;
  onBack: () => void;
  syncLiveProfile: () => Promise<void>;
  appConfig?: AppConfig;
}

interface LedgerTransaction {
  id: string;
  userId: string;
  type: 'income' | 'expense' | 'receivable' | 'payable';
  amount: number;
  title: string;
  category: string;
  phone?: string;
  date: string;
  time: string;
  createdAt: string;
}

interface LedgerNote {
  id: string;
  userId: string;
  title: string;
  content: string;
  type: 'note' | 'todo';
  todos?: { text: string; completed: boolean }[];
  color: 'yellow' | 'green' | 'blue';
  pinned: boolean;
  createdAt: string;
}

interface LedgerCustomer {
  id: string;
  userId: string;
  name: string;
  phone: string;
  balance: number; // calculated dynamically but stored for reference
  createdAt: string;
}

export default function BnbHisabKhata({ user, onBack, syncLiveProfile, appConfig }: BnbHisabKhataProps) {
  // Navigation
  const [activeSubTab, setActiveSubTab] = useState<'home' | 'transactions' | 'reports' | 'scan' | 'notes' | 'settings'>('home');

  const pushedTabRef = React.useRef<string>('home');

  useEffect(() => {
    if (activeSubTab !== 'home') {
      if (pushedTabRef.current !== activeSubTab) {
        pushedTabRef.current = activeSubTab;
        window.history.pushState({ dashboardModal: 'hisab', hisabTab: activeSubTab }, '');
      }
    } else {
      pushedTabRef.current = 'home';
    }
  }, [activeSubTab]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (state && state.dashboardModal === 'hisab') {
        const targetTab = state.hisabTab || 'home';
        if (activeSubTab !== targetTab) {
          pushedTabRef.current = targetTab;
          setActiveSubTab(targetTab);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [activeSubTab]);

  const handleBack = () => {
    if (activeSubTab !== 'home') {
      window.history.back();
    } else {
      onBack();
    }
  };

  // Firestore Data States
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [notes, setNotes] = useState<LedgerNote[]>([]);
  const [customers, setCustomers] = useState<LedgerCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Modals
  const [showAddTxModal, setShowAddTxModal] = useState(false);
  const [showAddTxScreen, setShowAddTxScreen] = useState(false);
  const [incomeTab, setIncomeTab] = useState<'general' | 'due_collection'>('general');
  const [txMethod, setTxMethod] = useState('Cash');
  const [txFormType, setTxFormType] = useState<'income' | 'expense' | 'receivable' | 'payable'>('income');
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [showAddNoteScreen, setShowAddNoteScreen] = useState(false);
  const [selectedNoteType, setSelectedNoteType] = useState<'general' | 'home' | 'business' | 'important'>('general');
  const [attachedImages, setAttachedImages] = useState<string[]>([
    "https://images.unsplash.com/photo-1517842645767-c639042777db?w=150",
    "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=150",
    "https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=150"
  ]);
  const [isListening, setIsListening] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [showReminderList, setShowReminderList] = useState(false);

  // Form Fields - Transaction
  const [txAmount, setTxAmount] = useState('');
  const [txTitle, setTxTitle] = useState('');
  const [txCategory, setTxCategory] = useState('');
  const [txPhone, setTxPhone] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);

  // Form Fields - Note
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState<'note' | 'todo'>('note');
  const [noteColor, setNoteColor] = useState<'yellow' | 'green' | 'blue'>('yellow');
  const [todoInput, setTodoInput] = useState('');
  const [todoItems, setTodoItems] = useState<{ text: string; completed: boolean }[]>([]);

  // Timeframe selector for Report Summary
  const [reportTimeframe, setReportTimeframe] = useState<'all_time' | 'this_month' | 'this_week' | 'today'>('all_time');

  // Search & Filters for Transactions Tab
  const [txSearch, setTxSearch] = useState('');
  const [txFilterType, setTxFilterType] = useState<string>('all');

  const getNoteCardStyles = (note: any) => {
    if (note.category) {
      switch (note.category) {
        case 'general':
          return 'bg-[#e6f7f4] border-[#00a884]/35 text-slate-900';
        case 'home':
          return 'bg-purple-50 border-purple-200 text-slate-900';
        case 'business':
          return 'bg-orange-50 border-orange-200 text-slate-900';
        case 'important':
          return 'bg-rose-50 border-rose-200 text-slate-900';
        default:
          return 'bg-[#e6f7f4] border-[#00a884]/35 text-slate-900';
      }
    }
    
    // fallback to old colors
    switch (note.color) {
      case 'yellow':
        return 'bg-[#fef9c3] border-yellow-200 text-yellow-900';
      case 'green':
        return 'bg-[#dcfce7] border-green-200 text-green-900';
      case 'blue':
        return 'bg-[#dbeafe] border-blue-200 text-blue-900';
      default:
        return 'bg-[#fef9c3] border-yellow-200 text-yellow-900';
    }
  };

  // Calculator State
  const [calcInput, setCalcInput] = useState('');
  const [calcResult, setCalcResult] = useState('');
  const [calcHistory, setCalcHistory] = useState<{ expr: string; result: string }[]>([]);
  const [showCalcHistory, setShowCalcHistory] = useState(false);

  // Auto live calculation evaluation
  useEffect(() => {
    if (!calcInput.trim()) {
      setCalcResult('');
      return;
    }
    let cleanExp = calcInput.trim();
    while (cleanExp.length > 0 && ['+', '-', '×', '÷'].includes(cleanExp.slice(-1))) {
      cleanExp = cleanExp.slice(0, -1);
    }
    if (!cleanExp) {
      setCalcResult('');
      return;
    }

    try {
      let mathExp = cleanExp.replace(/×/g, '*').replace(/÷/g, '/');
      mathExp = mathExp.replace(/[^0-9+\-*/.]/g, '');
      if (!mathExp || mathExp.includes('/0')) {
        setCalcResult('');
        return;
      }
      const res = Function(`"use strict"; return (${mathExp})`)();
      if (typeof res === 'number' && !isNaN(res) && isFinite(res)) {
        const strRes = String(parseFloat(res.toFixed(6)));
        if (strRes !== cleanExp) {
          setCalcResult(strRes);
        } else {
          setCalcResult('');
        }
      } else {
        setCalcResult('');
      }
    } catch (e) {
      setCalcResult('');
    }
  }, [calcInput]);

  const renderFormattedExpression = (expr: string) => {
    if (!expr) return <span className="text-slate-300">0</span>;
    const tokens = expr.split(/([+−\-×÷])/g);
    return tokens.map((token, idx) => {
      if (['+', '-', '−', '×', '÷'].includes(token)) {
        return (
          <span key={idx} className="text-[#2563eb] font-medium mx-1">
            {token}
          </span>
        );
      }
      return <span key={idx} className="text-slate-900">{token}</span>;
    });
  };

  // Auto-generate sample data if user ledger is completely empty (makes UI beautiful immediately)
  const loadSampleData = async () => {
    setLoading(true);
    try {
      const batchTransactions: Omit<LedgerTransaction, 'id'>[] = [
        {
          userId: user.uid,
          type: 'income',
          amount: 12450,
          title: 'সজিব ইসলাম',
          category: 'আয় - বিক্রয়',
          date: new Date().toISOString().split('T')[0],
          time: '09:30 PM',
          createdAt: new Date().toISOString()
        },
        {
          userId: user.uid,
          type: 'expense',
          amount: 850,
          title: 'বাজার খরচ',
          category: 'ব্যয়',
          date: new Date().toISOString().split('T')[0],
          time: '08:15 PM',
          createdAt: new Date(Date.now() - 3600000).toISOString()
        },
        {
          userId: user.uid,
          type: 'receivable',
          amount: 5000,
          title: 'রফিকুল ইসলাম',
          category: 'পাওনা (ক্রেডিট)',
          phone: '01712-345678',
          date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
          time: '07:45 PM',
          createdAt: new Date(Date.now() - 86400000).toISOString()
        },
        {
          userId: user.uid,
          type: 'payable',
          amount: 1200,
          title: 'মাহবুব আলম',
          category: 'দেনা (ডেবিট)',
          phone: '01823-456789',
          date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
          time: '06:30 PM',
          createdAt: new Date(Date.now() - 90000000).toISOString()
        },
        {
          userId: user.uid,
          type: 'income',
          amount: 3750,
          title: 'আরিফ স্টার',
          category: 'আয় - বিক্রয়',
          date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
          time: '05:10 PM',
          createdAt: new Date(Date.now() - 100000000).toISOString()
        },
        {
          userId: user.uid,
          type: 'receivable',
          amount: 3200,
          title: 'সজিব আহমেদ',
          category: 'পাওনা (ক্রেডিট)',
          phone: '01823-456789',
          date: new Date(Date.now() - 172800000).toISOString().split('T')[0],
          time: '11:20 AM',
          createdAt: new Date(Date.now() - 172800000).toISOString()
        },
        {
          userId: user.uid,
          type: 'receivable',
          amount: 2750,
          title: 'মোঃ তুহিন মিয়া',
          category: 'পাওনা (ক্রেডিট)',
          phone: '01911-223344',
          date: new Date(Date.now() - 259200000).toISOString().split('T')[0],
          time: '04:15 PM',
          createdAt: new Date(Date.now() - 259200000).toISOString()
        }
      ];

      const batchNotes: Omit<LedgerNote, 'id'>[] = [
        {
          userId: user.uid,
          title: 'গুরুত্বপূর্ণ',
          content: 'আগামীকাল পণ্য অর্ডার করতে হবে।',
          type: 'note',
          color: 'yellow',
          pinned: true,
          createdAt: new Date().toISOString()
        },
        {
          userId: user.uid,
          title: 'পরিকল্পনা',
          content: 'নতুন শাখা খুলতে হবে। স্থান: উত্তরা, ঢাকা',
          type: 'note',
          color: 'green',
          pinned: false,
          createdAt: new Date(Date.now() - 86400000).toISOString()
        },
        {
          userId: user.uid,
          title: 'To-Do List',
          content: '',
          type: 'todo',
          todos: [
            { text: 'পাওনা আদায় করা', completed: true },
            { text: 'মালের হিসাব মিলানো', completed: false },
            { text: 'ব্যাংকে টাকা জমা দেওয়া', completed: false }
          ],
          color: 'blue',
          pinned: false,
          createdAt: new Date(Date.now() - 172800000).toISOString()
        }
      ];

      // Insert all
      for (const tx of batchTransactions) {
        await addDoc(collection(db, 'hisab_transactions'), tx);
      }
      const storageKey = `local_notes_${user.email || user.uid}`;
      const sampleNotesWithIds = batchNotes.map((n, i) => ({
        id: 'sample_note_' + i + '_' + Date.now(),
        ...n
      }));
      localStorage.setItem(storageKey, JSON.stringify(sampleNotesWithIds));
      setNotes(sampleNotesWithIds as any[]);
      triggerNotesUpdatedEvent();
      alert('সফলভাবে প্রাথমিক হিসাব খাতার স্যাম্পল ডেমো ডাটা তৈরি করা হয়েছে!');
    } catch (err) {
      console.error(err);
      alert('ডেমো ডাটা তৈরি করতে সমস্যা হয়েছে।');
    }
    setLoading(false);
  };

  // Listen to transactions, notes, and customers in real-time
  useEffect(() => {
    if (!db || !user?.uid) return;

    setLoading(true);

    const txQuery = query(
      collection(db, 'hisab_transactions'),
      where('userId', '==', user.uid)
    );

    const unsubscribeTx = onSnapshot(txQuery, (snapshot) => {
      const list: LedgerTransaction[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          userId: data.userId,
          type: data.type,
          amount: Number(data.amount) || 0,
          title: data.title || '',
          category: data.category || '',
          phone: data.phone || '',
          date: data.date || '',
          time: data.time || '',
          createdAt: data.createdAt || ''
        });
      });
      // Sort by createdAt descending
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTransactions(list);

      // Extract customers
      const custMap = new Map<string, LedgerCustomer>();
      list.forEach((tx) => {
        if (tx.type === 'receivable' || tx.type === 'payable') {
          const key = tx.phone ? tx.phone.trim() : tx.title.trim();
          if (key && !custMap.has(key)) {
            custMap.set(key, {
              id: tx.id,
              userId: user.uid,
              name: tx.title,
              phone: tx.phone || 'মোবাইল নম্বর নেই',
              balance: 0,
              createdAt: tx.createdAt
            });
          }
        }
      });
      setCustomers(Array.from(custMap.values()));
      setLoading(false);
    }, (error) => {
      console.error("Firestore loading error:", error);
      setLoading(false);
    });

    // Load notes from localStorage based on user email/uid to avoid database (MB) consumption
    const storageKey = `local_notes_${user.email || user.uid}`;
    const loadLocalNotes = () => {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const list = JSON.parse(saved) as LedgerNote[];
          list.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          setNotes(list);
        } catch (e) {
          console.error("Failed to parse local notes", e);
          setNotes([]);
        }
      } else {
        setNotes([]);
      }
    };
    loadLocalNotes();

    // Listen to local storage updates to sync dynamically
    const handleSyncNotes = () => {
      loadLocalNotes();
    };
    window.addEventListener('local-notes-updated', handleSyncNotes);

    return () => {
      unsubscribeTx();
      window.removeEventListener('local-notes-updated', handleSyncNotes);
    };
  }, [user?.uid, user?.email]);

  // Handle Form Submission - Transaction
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txAmount || !txTitle) {
      alert("টাকার পরিমাণ এবং নাম/বিবরণ লিখুন!");
      return;
    }

    try {
      const amountNum = parseFloat(txAmount);
      if (isNaN(amountNum) || amountNum <= 0) {
        alert("সঠিক পরিমাণ টাকার সংখ্যা লিখুন!");
        return;
      }

      // Format current time
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      const strMinutes = minutes < 10 ? '0' + minutes : minutes;
      const strTime = `${hours}:${strMinutes} ${ampm}`;

      const newTx: Omit<LedgerTransaction, 'id'> = {
        userId: user.uid,
        type: txFormType,
        amount: amountNum,
        title: txTitle.trim(),
        category: txCategory.trim() || (txFormType === 'income' ? 'আয় - বিক্রয়' : txFormType === 'expense' ? 'ব্যয়' : txFormType === 'receivable' ? 'পাওনা (ক্রেডিট)' : 'দেনা (ডেবিট)'),
        phone: txPhone.trim() || undefined,
        date: txDate,
        time: strTime,
        createdAt: now.toISOString()
      };

      await addDoc(collection(db, 'hisab_transactions'), newTx);

      // Reset form
      setTxAmount('');
      setTxTitle('');
      setTxCategory('');
      setTxPhone('');
      setTxDate(new Date().toISOString().split('T')[0]);
      setShowAddTxModal(false);

    } catch (err) {
      console.error("Error adding transaction:", err);
      alert("তথ্য সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।");
    }
  };

  // Delete transaction
  const handleDeleteTransaction = async (id: string) => {
    if (!window.confirm("আপনি কি নিশ্চিতভাবে এই লেনদেনটি ডিলিট করতে চান?")) return;
    try {
      await deleteDoc(doc(db, 'hisab_transactions', id));
    } catch (err) {
      console.error(err);
      alert("মুছে ফেলা সম্ভব হয়নি।");
    }
  };

  // Handle Form Submission from the full-screen flow
  const handleAddTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txAmount) {
      alert("টাকার পরিমাণ লিখুন!");
      return;
    }

    try {
      const amountNum = parseFloat(txAmount);
      if (isNaN(amountNum) || amountNum <= 0) {
        alert("সঠিক পরিমাণ টাকার সংখ্যা লিখুন!");
        return;
      }

      // Format current time
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const strMinutes = minutes < 10 ? '0' + minutes : minutes;
      const strTime = `${hours}:${strMinutes} ${ampm}`;

      // Default descriptions/names if left empty (matching standard modal defaults)
      const defaultTitle = txFormType === 'income' ? 'আয় - বিক্রয়' : txFormType === 'expense' ? 'ব্যয়' : txFormType === 'receivable' ? 'পাওনা (ক্রেডিট)' : 'দেনা (ডেবিট)';
      const finalTitle = txTitle.trim() || defaultTitle;
      const finalCategory = txCategory.trim() || defaultTitle;

      const newTx: Omit<LedgerTransaction, 'id'> = {
        userId: user.uid,
        type: txFormType,
        amount: amountNum,
        title: finalTitle,
        category: finalCategory,
        phone: txMethod, // Store payment method in phone field
        date: txDate,
        time: strTime,
        createdAt: now.toISOString()
      };

      await addDoc(collection(db, 'hisab_transactions'), newTx);

      // Check if customer exists in the customer list, if not add them
      if (txCategory.trim() && !customers.some(c => c.name.toLowerCase() === txCategory.trim().toLowerCase())) {
        try {
          const newCust: Omit<LedgerCustomer, 'id'> = {
            userId: user.uid,
            name: txCategory.trim(),
            phone: 'N/A',
            balance: txFormType === 'receivable' ? amountNum : txFormType === 'payable' ? -amountNum : 0,
            createdAt: now.toISOString()
          };
          await addDoc(collection(db, 'hisab_customers'), newCust);
        } catch (custErr) {
          console.error("Error creating customer profile automatically:", custErr);
        }
      }

      // Reset form fields
      setTxAmount('');
      setTxTitle('');
      setTxCategory('');
      setTxPhone('');
      setTxDate(new Date().toISOString().split('T')[0]);
      setTxMethod('Cash');
      setShowAddTxScreen(false);

    } catch (err) {
      console.error("Error adding transaction:", err);
      alert("তথ্য সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।");
    }
  };

  // Handle Form Submission - Note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle) {
      alert("নোটের শিরোনাম লিখুন!");
      return;
    }

    try {
      const newNote: LedgerNote = {
        id: 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        userId: user.uid,
        title: noteTitle.trim(),
        content: noteContent.trim(),
        type: noteType,
        todos: noteType === 'todo' ? todoItems : [],
        color: noteColor,
        pinned: false,
        createdAt: new Date().toISOString()
      };

      const storageKey = `local_notes_${user.email || user.uid}`;
      const saved = localStorage.getItem(storageKey);
      const currentNotes = saved ? JSON.parse(saved) as LedgerNote[] : [];
      const updatedNotes = [newNote, ...currentNotes];
      localStorage.setItem(storageKey, JSON.stringify(updatedNotes));
      setNotes(updatedNotes);
      triggerNotesUpdatedEvent();

      // Reset
      setNoteTitle('');
      setNoteContent('');
      setNoteType('note');
      setNoteColor('yellow');
      setTodoItems([]);
      setTodoInput('');
      setShowAddNoteModal(false);
    } catch (err) {
      console.error(err);
      alert("নোটটি সেভ করা যায়নি।");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          setAttachedImages(prev => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setAttachedImages(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const startVoiceTyping = () => {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("আপনার ব্রাউজারে ভয়েস টাইপিং সাপোর্ট করে না। দয়া করে গুগল ক্রোম ব্যবহার করুন।");
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = 'bn-BD'; // Bengali
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onresult = (event: any) => {
        const speechToText = event.results[0][0].transcript;
        setNoteContent(prev => prev ? prev + " " + speechToText : speechToText);
      };

      recognition.start();
    } catch (err) {
      console.error("Speech recognition start failed:", err);
      alert("ভয়েস টাইপিং সার্ভিস সাময়িকভাবে চালু করা সম্ভব হয়নি।");
      setIsListening(false);
    }
  };

  const handleSaveDetailedNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) {
      alert("অনুগ্রহ করে আপনার নোট লিখুন!");
      return;
    }

    try {
      const generatedTitle = noteContent.trim().split('\n')[0].substring(0, 25) || 'সাধারণ নোট';
      const newNote: LedgerNote & { category?: string; images?: string[] } = {
        id: 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        userId: user.uid,
        title: generatedTitle,
        content: noteContent.trim(),
        type: 'note',
        color: selectedNoteType === 'general' ? 'green' : 
               selectedNoteType === 'home' ? 'blue' : 
               selectedNoteType === 'business' ? 'yellow' : 'yellow',
        category: selectedNoteType,
        images: attachedImages,
        pinned: false,
        createdAt: new Date().toISOString()
      };

      const storageKey = `local_notes_${user.email || user.uid}`;
      const saved = localStorage.getItem(storageKey);
      const currentNotes = saved ? JSON.parse(saved) as LedgerNote[] : [];
      const updatedNotes = [newNote, ...currentNotes];
      localStorage.setItem(storageKey, JSON.stringify(updatedNotes));
      setNotes(updatedNotes);
      triggerNotesUpdatedEvent();
      
      // Reset
      setNoteContent('');
      setSelectedNoteType('general');
      setAttachedImages([
        "https://images.unsplash.com/photo-1517842645767-c639042777db?w=150",
        "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=150",
        "https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=150"
      ]);
      setShowAddNoteScreen(false);
    } catch (err) {
      console.error(err);
      alert("নোটটি সেভ করা যায়নি।");
    }
  };

  // Delete note
  const handleDeleteNote = async (id: string) => {
    if (!window.confirm("আপনি কি নিশ্চিতভাবে এই নোটটি ডিলিট করতে চান?")) return;
    try {
      const storageKey = `local_notes_${user.email || user.uid}`;
      const saved = localStorage.getItem(storageKey);
      const currentNotes = saved ? JSON.parse(saved) as LedgerNote[] : [];
      const updatedNotes = currentNotes.filter(n => n.id !== id);
      localStorage.setItem(storageKey, JSON.stringify(updatedNotes));
      setNotes(updatedNotes);
      triggerNotesUpdatedEvent();
    } catch (err) {
      console.error(err);
    }
  };

  // Pin / Unpin Note
  const handleTogglePinNote = async (note: LedgerNote) => {
    try {
      const storageKey = `local_notes_${user.email || user.uid}`;
      const saved = localStorage.getItem(storageKey);
      const currentNotes = saved ? JSON.parse(saved) as LedgerNote[] : [];
      const updatedNotes = currentNotes.map((n, idx) => n.id === note.id ? { ...n, pinned: !n.pinned } : n);
      localStorage.setItem(storageKey, JSON.stringify(updatedNotes));
      setNotes(updatedNotes);
      triggerNotesUpdatedEvent();
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle todo item
  const handleToggleTodo = async (note: LedgerNote, todoIndex: number) => {
    if (!note.todos) return;
    try {
      const storageKey = `local_notes_${user.email || user.uid}`;
      const saved = localStorage.getItem(storageKey);
      const currentNotes = saved ? JSON.parse(saved) as LedgerNote[] : [];
      const updatedNotes = currentNotes.map((n, idx) => {
        if (n.id === note.id && n.todos) {
          const updatedTodos = [...n.todos];
          updatedTodos[todoIndex].completed = !updatedTodos[todoIndex].completed;
          return { ...n, todos: updatedTodos };
        }
        return n;
      });
      localStorage.setItem(storageKey, JSON.stringify(updatedNotes));
      setNotes(updatedNotes);
      triggerNotesUpdatedEvent();
    } catch (err) {
      console.error(err);
    }
  };

  // Add todo item to local array before saving
  const handleAddTodoLocal = () => {
    if (!todoInput.trim()) return;
    setTodoItems([...todoItems, { text: todoInput.trim(), completed: false }]);
    setTodoInput('');
  };

  // Remove todo item from local array before saving
  const handleRemoveTodoLocal = (index: number) => {
    setTodoItems(todoItems.filter((_, i) => i !== index));
  };

  // Calculate stats based on timeframe
  const getFilteredTransactions = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-indexed
    const currentDate = now.getDate();

    return transactions.filter(tx => {
      if (!tx.date) return false;
      const parts = tx.date.split('-');
      if (parts.length !== 3) return false;
      const txYear = parseInt(parts[0], 10);
      const txMonth = parseInt(parts[1], 10);
      const txDay = parseInt(parts[2], 10);

      if (reportTimeframe === 'today') {
        return txYear === currentYear && txMonth === currentMonth && txDay === currentDate;
      } else if (reportTimeframe === 'this_week') {
        // Robust check: within last 7 days
        const txDateObj = new Date(txYear, txMonth - 1, txDay);
        const todayObj = new Date(currentYear, currentMonth - 1, currentDate);
        const diffTime = todayObj.getTime() - txDateObj.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 7;
      } else if (reportTimeframe === 'this_month') {
        return txYear === currentYear && txMonth === currentMonth;
      } else {
        // all_time
        return true;
      }
    });
  };

  const filteredTx = getFilteredTransactions();

  const totalIncome = filteredTx.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = filteredTx.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const totalReceivable = filteredTx.filter(t => t.type === 'receivable').reduce((sum, t) => sum + t.amount, 0);
  const totalPayable = filteredTx.filter(t => t.type === 'payable').reduce((sum, t) => sum + t.amount, 0);
  const netProfit = totalIncome - totalExpense;

  // Formatting date with English digits and Bengali month name for the input view
  const formatBengaliDate = (dateStr: string) => {
    const months = [
      'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 
      'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
    ];
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = parseInt(parts[2], 10);
        const m = months[parseInt(parts[1], 10) - 1];
        const y = parts[0];
        return `${d} ${m} ${y}`;
      }
      return dateStr;
    }
    const d = dateObj.getDate();
    const m = months[dateObj.getMonth()];
    const y = dateObj.getFullYear();
    return `${d} ${m} ${y}`;
  };

  // Formatting date to Bengali
  const getBengaliDate = (dateStr: string) => {
    const days = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
    const months = [
      'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 
      'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
    ];
    const numerals: Record<string, string> = {
      '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
    };

    const convertToBngNumerals = (str: string) => {
      return str.split('').map(char => numerals[char] || char).join('');
    };

    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return dateStr;

    const day = convertToBngNumerals(String(dateObj.getDate()));
    const month = months[dateObj.getMonth()];
    const year = convertToBngNumerals(String(dateObj.getFullYear()));

    return `${day} ${month}, ${year}`;
  };

  // WhatsApp Reminder Link
  const getWhatsAppLink = (phone: string, title: string, amount: number) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.startsWith('880') ? cleanPhone : '880' + cleanPhone.replace(/^0+/, '');
    const message = `আসসালামু আলাইকুম, ${title}। আপনার কাছে আমাদের হিসাব খাতার পাওনা রয়েছে মোট ৳${amount} টাকা। অনুগ্রহ করে দ্রুত পরিশোধ করার অনুরোধ রইল। ধন্যবাদ! - ব্যবসা নেটওয়ার্ক বাংলাদেশ`;
    return `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`;
  };

  // Send WhatsApp Reminders to all outstanding customers
  const sendAllReminders = () => {
    const receivables = transactions.filter(t => t.type === 'receivable');
    if (receivables.length === 0) {
      alert("কোনো পাওনা রিমাইন্ডার পাওয়া যায়নি।");
      return;
    }
    const firstRem = receivables[0];
    if (firstRem.phone) {
      window.open(getWhatsAppLink(firstRem.phone, firstRem.title, firstRem.amount), '_blank');
    }
  };

  // Safe eval for math expression
  const evaluateExpression = (exp: string): string => {
    try {
      // Replace display operators with math operators
      let cleanExp = exp.replace(/×/g, '*').replace(/÷/g, '/');
      // Only allow numbers, math operators, decimals
      cleanExp = cleanExp.replace(/[^0-9+\-*/.]/g, '');
      
      if (!cleanExp) return '0';
      
      // Prevent division by zero
      if (cleanExp.includes('/0')) {
        return 'Error';
      }

      // Safe JS evaluation
      const res = Function(`"use strict"; return (${cleanExp})`)();
      
      if (typeof res === 'number' && !isNaN(res)) {
        // Round to 4 decimal places to prevent floating point inaccuracies
        return String(parseFloat(res.toFixed(4)));
      }
      return String(res);
    } catch (e) {
      return 'Error';
    }
  };

  // Calculator logic
  const handleCalcBtn = (val: string) => {
    if (val === 'AC' || val === 'C') {
      setCalcInput('');
      setCalcResult('');
    } else if (val === '⌫') {
      setCalcInput(prev => prev.slice(0, -1));
    } else if (val === '+/-') {
      if (!calcInput) {
        setCalcInput('-');
        return;
      }
      const match = calcInput.match(/^(.*?)((?:-|\+)?\d*\.?\d*)$/);
      if (match) {
        const prefix = match[1];
        const numToken = match[2];
        if (numToken.startsWith('-')) {
          setCalcInput(prefix + numToken.slice(1));
        } else {
          setCalcInput(prefix + '-' + numToken);
        }
      } else {
        setCalcInput(prev => (prev.startsWith('-') ? prev.slice(1) : '-' + prev));
      }
    } else if (val === '%') {
      if (!calcInput) return;
      try {
        let mathExp = calcInput.replace(/×/g, '*').replace(/÷/g, '/').replace(/[^0-9+\-*/.]/g, '');
        const res = Function(`"use strict"; return (${mathExp})`)();
        if (typeof res === 'number' && !isNaN(res)) {
          const pctVal = String(parseFloat((res / 100).toFixed(6)));
          setCalcInput(pctVal);
          setCalcResult('');
        }
      } catch (e) {
        // Fallback
      }
    } else if (val === '=') {
      if (!calcInput) return;
      let mathExp = calcInput.replace(/×/g, '*').replace(/÷/g, '/').replace(/[^0-9+\-*/.]/g, '');
      try {
        const res = Function(`"use strict"; return (${mathExp})`)();
        if (typeof res === 'number' && !isNaN(res) && isFinite(res)) {
          const finalRes = String(parseFloat(res.toFixed(6)));
          setCalcHistory(prev => [{ expr: calcInput, result: finalRes }, ...prev]);
          setCalcInput(finalRes);
          setCalcResult('');
        }
      } catch (e) {
        setCalcResult('Error');
      }
    } else {
      const isOperator = ['+', '-', '×', '÷'].includes(val);
      const lastChar = calcInput.slice(-1);
      const isLastCharOperator = ['+', '-', '×', '÷'].includes(lastChar);

      if (isOperator && isLastCharOperator) {
        setCalcInput(prev => prev.slice(0, -1) + val);
      } else {
        setCalcInput(prev => prev + val);
      }
    }
  };

  // Reset all account database entries
  const handleResetData = async () => {
    if (!window.confirm("🚨 আপনি কি আপনার হিসাব খাতার সকল ডেটা মুছে ফেলতে চান? এটি আর ফেরত আনা সম্ভব নয়।")) return;
    try {
      setLoading(true);
      // Get all tx
      const txSnap = await getDocs(query(collection(db, 'hisab_transactions'), where('userId', '==', user.uid)));
      for (const d of txSnap.docs) {
        await deleteDoc(doc(db, 'hisab_transactions', d.id));
      }
      // Get all notes from local storage and clear
      const storageKey = `local_notes_${user.email || user.uid}`;
      localStorage.removeItem(storageKey);
      setNotes([]);
      alert("সফলভাবে হিসাব খাতার সকল ডেটা মুছে ফেলা হয়েছে।");
    } catch (err) {
      console.error(err);
      alert("ডেটা রিজেট করা যায়নি।");
    }
    setLoading(false);
  };

  // Backup notes directly to user's Gmail
  const handleBackupNotesToGmail = () => {
    if (notes.length === 0) {
      alert("ব্যাকআপ করার জন্য কোনো নোট নেই!");
      return;
    }

    let backupText = `ব্যবসা নেটওয়ার্ক বাংলাদেশ - হিসাব খাতা ব্যাকআপ রিপোর্ট\n`;
    backupText += `গ্রাহকের নাম: ${user.name}\n`;
    backupText += `ইমেইল: ${user.email || 'নাই'}\n`;
    backupText += `তারিখ: ${new Date().toLocaleDateString('bn-BD')}\n`;
    backupText += `মোট চিরকুট সংখ্যা: ${notes.length}\n`;
    backupText += `=========================================\n\n`;

    notes.forEach((note, index) => {
      backupText += `${index + 1}. শিরোনাম: ${note.title}\n`;
      backupText += `ধরণ: ${note.type === 'todo' ? 'টু-ডু লিস্ট' : 'সাধারণ নোট'}\n`;
      backupText += `তারিখ: ${getBengaliDate(note.createdAt.split('T')[0])}\n`;
      
      if (note.type === 'todo' && note.todos) {
        backupText += `টাস্কসমূহ:\n`;
        note.todos.forEach((todo, idx) => {
          backupText += `   [${todo.completed ? '✔' : ' '}] ${todo.text}\n`;
        });
      } else {
        backupText += `বিবরণ:\n${note.content}\n`;
      }
      backupText += `-----------------------------------------\n\n`;
    });

    backupText += `\n\n© ব্যবসা নেটওয়ার্ক বাংলাদেশ - হিসাব খাতা`;

    const subject = encodeURIComponent(`হিসাব খাতা ডায়েরি ব্যাকআপ - ${user.name}`);
    const body = encodeURIComponent(backupText);
    const mailtoUrl = `mailto:${user.email || ''}?subject=${subject}&body=${body}`;
    
    // Open in secure location
    window.location.href = mailtoUrl;
  };

  if (showAddTxScreen) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-slate-800 select-none pb-10">
        {/* Full-screen top navigation */}
        <header className="sticky top-0 z-40 bg-[#00a884] text-white px-4 py-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                setShowAddTxScreen(false);
              }}
              className="p-1 hover:bg-[#008f72] rounded-full transition active:scale-95 text-white"
            >
              <ChevronLeft className="w-6.5 h-6.5" />
            </button>
            <h1 className="text-base xs:text-lg font-black tracking-tight text-white font-sans">
              {txFormType === 'income' ? 'আয় যোগ করুন' :
               txFormType === 'expense' ? 'ব্যয় যোগ করুন' :
               txFormType === 'receivable' ? 'পাওনা (ক্রেডিট) যোগ করুন' : 'দেনা (ডেবিট) যোগ করুন'}
            </h1>
          </div>
          <button 
            type="button"
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#008f72] transition"
          >
            <HelpCircle className="w-5.5 h-5.5 text-white" />
          </button>
        </header>

        {/* Content Area */}
        <div className="max-w-md mx-auto w-full flex-1 px-4 py-5 space-y-5">
          {/* Tabs for Income */}
          {txFormType === 'income' && (
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setIncomeTab('general')}
                className={`py-3 rounded-xl text-xs font-black tracking-tight transition ${
                  incomeTab === 'general'
                    ? 'bg-[#00a884] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                সাধারণ আয়
              </button>
              <button
                type="button"
                onClick={() => setIncomeTab('due_collection')}
                className={`py-3 rounded-xl text-xs font-black tracking-tight transition ${
                  incomeTab === 'due_collection'
                    ? 'bg-[#00a884] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                পাওনা থেকে আদায়
              </button>
            </div>
          )}

          <form onSubmit={handleAddTransactionSubmit} className="space-y-4">
            {/* 1. তারিখ Field */}
            <div className="relative border border-slate-200 rounded-2xl p-3 bg-white hover:border-[#00a884] focus-within:border-[#00a884] focus-within:ring-2 focus-within:ring-[#00a884]/10 transition-all flex justify-between items-center cursor-pointer shadow-3xs">
              <div className="flex-1">
                <span className="text-[10px] text-slate-400 font-extrabold block mb-0.5">তারিখ</span>
                <span className="text-sm font-black text-slate-800">
                  {formatBengaliDate(txDate)}
                </span>
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />
              </div>
              <Calendar className="w-5 h-5 text-slate-400 shrink-0 pointer-events-none" />
            </div>

            {/* 2. পরিমাণ Field */}
            <div className="border border-slate-200 rounded-2xl p-3 bg-white focus-within:border-[#00a884] focus-within:ring-2 focus-within:ring-[#00a884]/10 transition-all shadow-3xs">
              <label className="text-[10px] text-slate-400 font-extrabold block mb-0.5">পরিমাণ</label>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-sm font-black text-slate-800">৳</span>
                <input 
                  type="number"
                  required
                  placeholder="0.00"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  className="w-full text-sm font-black text-slate-800 outline-none bg-transparent"
                />
              </div>
            </div>

            {/* 3. বিবরণ (ঐচ্ছিক) Field */}
            <div className="border border-slate-200 rounded-2xl p-3 bg-white focus-within:border-[#00a884] focus-within:ring-2 focus-within:ring-[#00a884]/10 transition-all shadow-3xs">
              <label className="text-[10px] text-slate-400 font-extrabold block mb-0.5">
                {txFormType === 'income' ? 'বিবরণ (ঐচ্ছিক)' : 'বিবরণ'}
              </label>
              <input 
                type="text"
                required={txFormType !== 'income'}
                placeholder={txFormType === 'income' ? 'পণ্য বিক্রি' : txFormType === 'expense' ? 'বাজার খরচ' : 'বিবরণ লিখুন'}
                value={txTitle}
                onChange={(e) => setTxTitle(e.target.value)}
                className="w-full text-sm font-black text-slate-800 outline-none bg-transparent mt-0.5"
              />
            </div>

            {/* 4. গ্রাহক (ঐচ্ছিক) Field */}
            <div className="relative border border-slate-200 rounded-2xl p-3 bg-white focus-within:border-[#00a884] focus-within:ring-2 focus-within:ring-[#00a884]/10 transition-all flex justify-between items-center shadow-3xs">
              <div className="flex-1">
                <label className="text-[10px] text-slate-400 font-extrabold block mb-0.5">
                  {txFormType === 'receivable' || txFormType === 'payable' ? 'গ্রাহক/ব্যক্তির নাম' : 'গ্রাহক (ঐচ্ছিক)'}
                </label>
                <input 
                  type="text"
                  required={txFormType === 'receivable' || txFormType === 'payable'}
                  placeholder={txFormType === 'receivable' || txFormType === 'payable' ? 'গ্রাহক বা ব্যক্তির নাম লিখুন' : 'রাফি এন্টারপ্রাইজ'}
                  value={txCategory}
                  onChange={(e) => setTxCategory(e.target.value)}
                  className="w-full text-sm font-black text-slate-800 outline-none bg-transparent mt-0.5"
                />
              </div>
              <UserIcon className="w-5 h-5 text-slate-400 shrink-0 ml-2 pointer-events-none" />
              
              {/* Optional autocomplete if there are matches */}
              {txCategory && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-32 overflow-y-auto">
                  {customers
                    .filter(c => c.name.toLowerCase().includes(txCategory.toLowerCase()))
                    .map((c, idx) => (
                      <button
                        key={`${c.id}-${idx}`}
                        type="button"
                        onClick={() => setTxCategory(c.name)}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-black text-slate-700 border-b border-slate-100 last:border-0"
                      >
                        👤 {c.name} ({c.phone})
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* 5. পদ্ধতি Field */}
            <div className="relative border border-slate-200 rounded-2xl p-3 bg-white hover:border-[#00a884] focus-within:border-[#00a884] focus-within:ring-2 focus-within:ring-[#00a884]/10 transition-all flex justify-between items-center cursor-pointer shadow-3xs">
              <div className="flex-1">
                <span className="text-[10px] text-slate-400 font-extrabold block mb-0.5">পদ্ধতি</span>
                <span className="text-sm font-black text-slate-800">
                  {txMethod === 'bKash' ? 'বিকাশ' : 
                   txMethod === 'Rocket' ? 'রকেট' : 
                   txMethod === 'Nagad' ? 'নগদ পার্সোনাল' : 
                   txMethod === 'Bank' ? 'ব্যাংক' : 'নগদ'}
                </span>
                <select
                  value={txMethod}
                  onChange={(e) => setTxMethod(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10 font-sans"
                >
                  <option value="Cash">নগদ</option>
                  <option value="bKash">বিকাশ</option>
                  <option value="Rocket">রকেট</option>
                  <option value="Nagad">নগদ পার্সোনাল</option>
                  <option value="Bank">ব্যাংক</option>
                </select>
              </div>
              <ChevronDown className="w-5 h-5 text-slate-400 shrink-0 pointer-events-none" />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-4 bg-[#00a884] hover:bg-[#008f72] text-white rounded-2xl text-sm font-black tracking-wide shadow-md active:scale-98 transition-all"
            >
              সংরক্ষণ করুন
            </button>
          </form>

          {/* Underneath instructions matching client photo exactly */}
          <div className="bg-[#e6f7f4] border border-[#00a884]/15 rounded-2xl p-4 space-y-2.5 shadow-3xs">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 text-[#00a884] stroke-[3]" />
              </div>
              <span className="text-[11px] font-black text-slate-700">
                {txFormType === 'income' ? 'আয় দ্রুত যোগ করুন' :
                 txFormType === 'expense' ? 'ব্যয় দ্রুত যোগ করুন' :
                 txFormType === 'receivable' ? 'বকেয়া পাওনা দ্রুত যোগ করুন' : 'দেনা বা ঋণ দ্রুত যোগ করুন'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 text-[#00a884] stroke-[3]" />
              </div>
              <span className="text-[11px] font-black text-slate-700">
                {txFormType === 'income' ? 'গ্রাহক সিলেক্ট করুন (ঐচ্ছিক)' :
                 txFormType === 'expense' ? 'ব্যয়ের খাত সিলেক্ট করুন' :
                 txFormType === 'receivable' ? 'গ্রাহক সিলেক্ট করুন (বাধ্যতামূলক)' : 'পাওনাদার সিলেক্ট করুন'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 text-[#00a884] stroke-[3]" />
              </div>
              <span className="text-[11px] font-black text-slate-700">
                {txFormType === 'income' ? 'সব আয় হিসাব রাখে স্বয়ংক্রিয়তারে' :
                 txFormType === 'expense' ? 'সব ব্যয় হিসাব রাখে স্বয়ংক্রিয়তারে' :
                 txFormType === 'receivable' ? 'বকেয়া পাওনা হিসাব রাখে স্বয়ংক্রিয়তারে' : 'দেনা ও ঋণ হিসাব রাখে স্বয়ংক্রিয়তারে'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showAddNoteScreen) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-slate-800 select-none pb-10">
        {/* Full-screen top navigation matching client screenshot exactly */}
        <header className="sticky top-0 z-40 bg-white border-b border-slate-100 px-4 py-4 flex items-center justify-between shadow-3xs">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                setShowAddNoteScreen(false);
              }}
              className="p-1 hover:bg-slate-50 rounded-full transition active:scale-95 text-slate-800"
            >
              <ChevronLeft className="w-6.5 h-6.5" />
            </button>
            <h1 className="text-base xs:text-lg font-black tracking-tight text-slate-800 font-sans">
              নোট লিখুন
            </h1>
          </div>
          <button 
            type="button"
            onClick={() => alert("নোটবুক সাহায্য নির্দেশিকাঃ এখানে আপনি হিসাব সম্পর্কিত যে কোনো সাধারণ, বাড়ির হিসাব, ব্যবসা সংক্রান্ত বা গুরুত্বপূর্ণ চিরকুট ছবিসহ লিখে রাখতে পারেন।")}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-50 transition"
          >
            <HelpCircle className="w-5.5 h-5.5 text-emerald-555" />
          </button>
        </header>

        {/* Content Area */}
        <div className="max-w-md mx-auto w-full flex-1 px-4 py-5 space-y-5">
          <form onSubmit={handleSaveDetailedNote} className="space-y-4">
            {/* 1. নোট (TextArea with Mic button inside) */}
            <div>
              <label className="text-xs font-black text-slate-400 block mb-1.5">নোট</label>
              <div className="relative border border-slate-200 rounded-3xl p-4 bg-white focus-within:border-[#00a884] focus-within:ring-2 focus-within:ring-[#00a884]/10 transition-all shadow-3xs">
                <textarea 
                  required
                  placeholder="আপনার নোট লিখুন..."
                  rows={5}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="w-full text-sm font-black text-slate-800 placeholder-slate-350 bg-transparent outline-none resize-none min-h-[140px] pr-12 leading-relaxed"
                />
                <button 
                  type="button"
                  onClick={startVoiceTyping}
                  className={`absolute bottom-3 right-3 p-2.5 rounded-full transition-all active:scale-90 ${
                    isListening 
                      ? 'bg-rose-50 text-rose-500 animate-pulse ring-2 ring-rose-500/20' 
                      : 'text-[#00a884] bg-[#e6f7f4] hover:bg-[#00a884]/15'
                  }`}
                  title="ভয়েস দিয়ে টাইপ করুন"
                >
                  <Mic className="w-5 h-5 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* 2. নোটের ধরন */}
            <div>
              <label className="text-xs font-black text-slate-400 block mb-2">নোটের ধরন</label>
              <div className="grid grid-cols-4 gap-2.5">
                {/* সাধারণ (General) */}
                <div 
                  onClick={() => setSelectedNoteType('general')}
                  className={`p-3 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 active:scale-95 border-2 min-h-[96px] ${
                    selectedNoteType === 'general' 
                      ? 'bg-[#e6f7f4] border-[#00a884] text-[#00a884] shadow-3xs' 
                      : 'bg-white border-slate-150 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1.5 shrink-0 transition-colors ${
                    selectedNoteType === 'general' ? 'bg-[#00a884]/15' : 'bg-slate-100'
                  }`}>
                    <FileText className="w-4.5 h-4.5 stroke-[2.5]" />
                  </div>
                  <span className="text-[10px] font-black tracking-tight">সাধারণ</span>
                </div>

                {/* বাড়ির (Home) */}
                <div 
                  onClick={() => setSelectedNoteType('home')}
                  className={`p-3 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 active:scale-95 border-2 min-h-[96px] ${
                    selectedNoteType === 'home' 
                      ? 'bg-purple-50 border-purple-500 text-purple-600 shadow-3xs' 
                      : 'bg-white border-slate-150 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1.5 shrink-0 transition-colors ${
                    selectedNoteType === 'home' ? 'bg-purple-500/15' : 'bg-slate-100'
                  }`}>
                    <UserIcon className="w-4.5 h-4.5 stroke-[2.5]" />
                  </div>
                  <span className="text-[10px] font-black tracking-tight">বাড়ির</span>
                </div>

                {/* ব্যবসা (Business) */}
                <div 
                  onClick={() => setSelectedNoteType('business')}
                  className={`p-3 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 active:scale-95 border-2 min-h-[96px] ${
                    selectedNoteType === 'business' 
                      ? 'bg-orange-50 border-orange-500 text-orange-600 shadow-3xs' 
                      : 'bg-white border-slate-150 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1.5 shrink-0 transition-colors ${
                    selectedNoteType === 'business' ? 'bg-orange-500/15' : 'bg-slate-100'
                  }`}>
                    <Briefcase className="w-4.5 h-4.5 stroke-[2.5]" />
                  </div>
                  <span className="text-[10px] font-black tracking-tight">ব্যবসা</span>
                </div>

                {/* গুরুত্বপূর্ণ (Important) */}
                <div 
                  onClick={() => setSelectedNoteType('important')}
                  className={`p-3 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 active:scale-95 border-2 min-h-[96px] ${
                    selectedNoteType === 'important' 
                      ? 'bg-rose-50 border-rose-500 text-rose-600 shadow-3xs' 
                      : 'bg-white border-slate-150 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1.5 shrink-0 transition-colors ${
                    selectedNoteType === 'important' ? 'bg-rose-500/15' : 'bg-slate-100'
                  }`}>
                    <Star className="w-4.5 h-4.5 stroke-[2.5]" />
                  </div>
                  <span className="text-[10px] font-black tracking-tight">গুরুত্বপূর্ণ</span>
                </div>
              </div>
            </div>

            {/* 3. ছবি সংযুক্ত করুন (ঐচ্ছিক) */}
            <div>
              <label className="text-xs font-black text-slate-400 block mb-1.5">ছবি সংযুক্ত করুন (ঐচ্ছিক)</label>
              <div className="grid grid-cols-4 gap-2">
                {attachedImages.map((img, idx) => (
                  <div key={idx} className="relative aspect-square border border-slate-200 rounded-xl overflow-hidden bg-slate-50 shadow-3xs group">
                    <img src={img} alt="Attachment" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <button 
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition opacity-90"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                
                {attachedImages.length < 4 && (
                  <label className="aspect-square border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[#00a884] hover:bg-[#e6f7f4]/10 transition shadow-3xs">
                    <Plus className="w-6 h-6 text-slate-400 stroke-[2.5]" />
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload} 
                      className="hidden" 
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-4 bg-[#00a884] hover:bg-[#008f72] text-white rounded-2xl text-sm font-black tracking-wide shadow-md active:scale-98 transition-all mt-4"
            >
              সংরক্ষণ করুন
            </button>
          </form>

          {/* Underneath features list matching client screenshot exactly */}
          <div className="bg-[#e6f7f4] border border-[#00a884]/15 rounded-2xl p-4 space-y-2.5 shadow-3xs">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 text-[#00a884] stroke-[3]" />
              </div>
              <span className="text-[11px] font-black text-slate-700">গুরুত্বপূর্ণ নোট সংরক্ষণ করুন</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 text-[#00a884] stroke-[3]" />
              </div>
              <span className="text-[11px] font-black text-slate-700">ছবি যোগ করুন নোটের সাথে</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 text-[#00a884] stroke-[3]" />
              </div>
              <span className="text-[11px] font-black text-slate-700">সহজে খুঁজে পাবেন সব নোট</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 pb-20">
      
      {/* Top Header Section identical to Screenshot */}
      <header className="sticky top-0 z-40 bg-[#00a884] text-white px-4 py-3 shadow-md flex items-center justify-between select-none">
        <div className="flex items-center gap-3">
          <button 
            onClick={handleBack}
            className="p-1 hover:bg-[#008f72] rounded-full transition active:scale-95 text-white"
          >
            <ChevronLeft className="w-6.5 h-6.5" />
          </button>
          
          <div className="flex items-center gap-1.5">
            {/* Custom Logo from Screenshot */}
            <div className="bg-white rounded-lg px-2 py-0.5 flex items-center justify-center shrink-0">
              <span className="text-red-600 font-black text-sm xs:text-base tracking-tighter">BNB</span>
            </div>
            <h1 className="text-base xs:text-lg sm:text-xl font-bold tracking-tight text-white font-sans">
              হিসাব খাতা
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* লেনদেনসমূহ Button right next to notification bell */}
          <button 
            onClick={() => setActiveSubTab('transactions')}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black transition flex items-center gap-1 border border-white/25 hover:bg-white/10 active:scale-95 ${
              activeSubTab === 'transactions' ? 'bg-white text-[#00a884]' : 'bg-transparent text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            লেনদেনসমূহ
          </button>

          {/* Notification bell */}
          <button 
            onClick={() => setActiveSubTab('settings')}
            className="p-1.5 hover:bg-[#008f72] rounded-full transition relative shrink-0"
          >
            <Bell className="w-5.5 h-5.5 text-white" />
            <span className="absolute top-1 right-1 w-4.5 h-4.5 bg-red-500 border-2 border-[#00a884] rounded-full text-[9px] font-black flex items-center justify-center text-white">
              ৫
            </span>
          </button>
          
          {/* User profile picture */}
          <div className="w-9 h-9 rounded-full bg-slate-100 border-2 border-white/80 overflow-hidden flex items-center justify-center shrink-0 cursor-pointer hover:scale-105 transition-transform duration-200">
            {user.profilePic ? (
              <img src={user.profilePic} alt="User Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-[#00a884] text-xs font-black">{user.name.substring(0, 2)}</span>
            )}
          </div>
        </div>
      </header>

      {/* Primary Container */}
      <main className="max-w-md mx-auto w-full flex-1 px-4 py-4 space-y-4">

        {loading && (
          <div className="flex items-center justify-center py-20 text-[#00a884] gap-2">
            <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-current"></span>
            <span className="font-semibold text-sm">হিসাব খাতা লোড হচ্ছে...</span>
          </div>
        )}

        {!loading && activeSubTab === 'home' && (
          <>
            {/* আজকের সারাংশ (Today's Summary) from Screenshot */}
            <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-3xs space-y-3">
              <div className="flex flex-col gap-2 font-sans">
                <div className="flex justify-between items-center text-slate-500">
                  <span className="text-xs font-black tracking-tight flex items-center gap-1">
                    হিসাব খাতা সারসংক্ষেপ
                  </span>
                  <span className="text-[10px] font-black tracking-tight flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-lg text-slate-500">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    {getBengaliDate(new Date().toISOString().split('T')[0])}
                  </span>
                </div>
                {/* Timeframe Toggles */}
                <div className="grid grid-cols-4 gap-1 border-t border-slate-50 pt-1.5 pb-0.5">
                  {(['all_time', 'today', 'this_week', 'this_month'] as const).map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setReportTimeframe(tf)}
                      className={`py-1 rounded text-[10px] font-black tracking-tight transition text-center ${
                        reportTimeframe === tf 
                          ? 'bg-[#00a884] text-white shadow-3xs' 
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      {tf === 'all_time' ? 'সর্বমোট' : tf === 'today' ? 'আজ' : tf === 'this_week' ? 'সপ্তাহ' : 'মাস'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 5 columns bento grid for totals scrollable in mobile / neat rows in desktop */}
              <div className="grid grid-cols-5 gap-1 select-none text-center">
                {/* 1. মোট আয় */}
                <div className="p-1 border border-emerald-100/50 bg-emerald-50/20 rounded-xl flex flex-col justify-between h-20">
                  <span className="text-[9px] font-black text-slate-500 block">মোট আয়</span>
                  <div className="flex items-center justify-center gap-0.5 text-emerald-600 my-1">
                    <TrendingDown className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] xs:text-xs font-black text-slate-900 block truncate">
                    ৳{totalIncome.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[8px] font-extrabold text-emerald-600 bg-emerald-50 rounded-md block py-0.5">
                    {filteredTx.filter(t => t.type === 'income').length} টি
                  </span>
                </div>

                {/* 2. মোট ব্যয় */}
                <div className="p-1 border border-rose-100/50 bg-rose-50/20 rounded-xl flex flex-col justify-between h-20">
                  <span className="text-[9px] font-black text-slate-500 block">মোট ব্যয়</span>
                  <div className="flex items-center justify-center gap-0.5 text-rose-600 my-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] xs:text-xs font-black text-slate-900 block truncate">
                    ৳{totalExpense.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[8px] font-extrabold text-rose-600 bg-rose-50 rounded-md block py-0.5">
                    {filteredTx.filter(t => t.type === 'expense').length} টি
                  </span>
                </div>

                {/* 3. লাভ */}
                <div className="p-1 border border-blue-100/50 bg-blue-50/20 rounded-xl flex flex-col justify-between h-20">
                  <span className="text-[9px] font-black text-slate-500 block">লাভ</span>
                  <div className="flex items-center justify-center gap-0.5 text-blue-600 my-1">
                    <TrendingDown className="w-3.5 h-3.5 rotate-180" />
                  </div>
                  <span className="text-[10px] xs:text-xs font-black text-slate-900 block truncate">
                    ৳{netProfit.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[8px] font-extrabold text-blue-600 bg-blue-50 rounded-md block py-0.5">
                    {netProfit >= 0 ? 'লাভ' : 'লোকসান'}
                  </span>
                </div>

                {/* 4. পাওনা */}
                <div className="p-1 border border-orange-100/50 bg-orange-50/20 rounded-xl flex flex-col justify-between h-20">
                  <span className="text-[9px] font-black text-slate-500 block">পাওনা</span>
                  <div className="flex items-center justify-center gap-0.5 text-orange-600 my-1">
                    <UserPlus className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] xs:text-xs font-black text-slate-900 block truncate">
                    ৳{totalReceivable.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[8px] font-extrabold text-orange-600 bg-orange-50 rounded-md block py-0.5">
                    {new Set(filteredTx.filter(t => t.type === 'receivable').map((t, idx) => t.phone || t.title)).size} জন
                  </span>
                </div>

                {/* 5. দেনা */}
                <div className="p-1 border border-purple-100/50 bg-purple-50/20 rounded-xl flex flex-col justify-between h-20">
                  <span className="text-[9px] font-black text-slate-500 block">দেনা</span>
                  <div className="flex items-center justify-center gap-0.5 text-purple-600 my-1">
                    <UserMinus className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] xs:text-xs font-black text-slate-900 block truncate">
                    ৳{totalPayable.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[8px] font-extrabold text-purple-600 bg-purple-50 rounded-md block py-0.5">
                    {new Set(filteredTx.filter(t => t.type === 'payable').map((t, idx) => t.phone || t.title)).size} জন
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-5 gap-1 font-sans text-center">
              {/* 1. আয় যোগ করুন */}
              <button 
                onClick={() => { setTxFormType('income'); setIncomeTab('general'); setTxMethod('Cash'); setShowAddTxScreen(true); }}
                className="p-2 border border-emerald-200 hover:bg-emerald-50 bg-white rounded-2xl flex flex-col items-center justify-center transition active:scale-95 group shadow-3xs"
              >
                <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white mb-1 shadow-3xs group-hover:scale-105 transition-transform duration-200">
                  <Plus className="w-5.5 h-5.5 stroke-[3]" />
                </div>
                <span className="text-[9px] xs:text-[10px] font-black text-slate-700 leading-tight block">আয়<br/>যোগ করুন</span>
              </button>

              {/* 2. ব্যয় যোগ করুন */}
              <button 
                onClick={() => { setTxFormType('expense'); setTxMethod('Cash'); setShowAddTxScreen(true); }}
                className="p-2 border border-rose-200 hover:bg-rose-50 bg-white rounded-2xl flex flex-col items-center justify-center transition active:scale-95 group shadow-3xs"
              >
                <div className="w-10 h-10 rounded-full bg-rose-600 flex items-center justify-center text-white mb-1 shadow-3xs group-hover:scale-105 transition-transform duration-200">
                  <Minus className="w-5.5 h-5.5 stroke-[3]" />
                </div>
                <span className="text-[9px] xs:text-[10px] font-black text-slate-700 leading-tight block">ব্যয়<br/>যোগ করুন</span>
              </button>

              {/* 3. পাওনা (ক্রেডিট) */}
              <button 
                onClick={() => { setTxFormType('receivable'); setTxMethod('Cash'); setShowAddTxScreen(true); }}
                className="p-2 border border-blue-200 hover:bg-blue-50 bg-white rounded-2xl flex flex-col items-center justify-center transition active:scale-95 group shadow-3xs"
              >
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white mb-1 shadow-3xs group-hover:scale-105 transition-transform duration-200">
                  <UserPlus className="w-5.5 h-5.5 stroke-[2]" />
                </div>
                <span className="text-[9px] xs:text-[10px] font-black text-slate-700 leading-tight block">পাওনা<br/>(ক্রেডিট)</span>
              </button>

              {/* 4. দেনা (ডেবিট) */}
              <button 
                onClick={() => { setTxFormType('payable'); setTxMethod('Cash'); setShowAddTxScreen(true); }}
                className="p-2 border border-orange-200 hover:bg-orange-50 bg-white rounded-2xl flex flex-col items-center justify-center transition active:scale-95 group shadow-3xs"
              >
                <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center text-white mb-1 shadow-3xs group-hover:scale-105 transition-transform duration-200">
                  <UserMinus className="w-5.5 h-5.5 stroke-[2]" />
                </div>
                <span className="text-[9px] xs:text-[10px] font-black text-slate-700 leading-tight block">দেনা<br/>(ডেবিট)</span>
              </button>

              {/* 5. নোট লিখুন */}
              <button 
                onClick={() => setShowAddNoteScreen(true)}
                className="p-2 border border-purple-200 hover:bg-purple-50 bg-white rounded-2xl flex flex-col items-center justify-center transition active:scale-95 group shadow-3xs"
              >
                <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white mb-1 shadow-3xs group-hover:scale-105 transition-transform duration-200">
                  <FileText className="w-5 h-5 stroke-[2]" />
                </div>
                <span className="text-[9px] xs:text-[10px] font-black text-slate-700 leading-tight block">নোট<br/>লিখুন</span>
              </button>
            </div>






          </>
        )}

        {/* --- Tab 2: লেনদেন (Transactions List) --- */}
        {!loading && activeSubTab === 'transactions' && (
          <div className="space-y-4 font-sans">
            {/* Search and Filters */}
            <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-3xs space-y-3">
              <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200">
                <Search className="w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="নাম বা বিবরণ দিয়ে খুঁজুন..." 
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  className="bg-transparent text-xs text-slate-800 w-full focus:outline-none"
                />
                {txSearch && <X className="w-4 h-4 text-slate-400 cursor-pointer" onClick={() => setTxSearch('')} />}
              </div>

              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {['all', 'income', 'expense', 'receivable', 'payable'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setTxFilterType(type)}
                    className={`text-[10px] font-black px-3 py-1.5 rounded-xl border transition shrink-0 ${
                      txFilterType === type 
                        ? 'bg-[#00a884] text-white border-[#00a884]' 
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    {type === 'all' ? 'সব লেনদেন' :
                     type === 'income' ? 'আয়সমূহ' :
                     type === 'expense' ? 'ব্যয়সমূহ' :
                     type === 'receivable' ? 'বকেয়া পাওনা' : 'দেনা ও দায়'}
                  </button>
                ))}
              </div>
            </div>

            {/* Transactions Log List */}
            <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-3xs space-y-3">
              <h3 className="text-sm font-black text-slate-800 border-b border-slate-100 pb-2 flex justify-between items-center">
                <span>হিসাব খাতা লেজার খতিয়ান</span>
                <span className="text-[10px] font-extrabold text-[#00a884] bg-[#e6f7f4] px-2.5 py-0.5 rounded-full border border-[#00a884]/30">
                  মোট {transactions.length}টি
                </span>
              </h3>

              <div className="space-y-3">
                {transactions
                  .filter(t => {
                    const matchesSearch = t.title.toLowerCase().includes(txSearch.toLowerCase()) || t.category.toLowerCase().includes(txSearch.toLowerCase());
                    const matchesFilter = txFilterType === 'all' || t.type === txFilterType;
                    return matchesSearch && matchesFilter;
                  })
                  .map((tx, idx) => (
                    <div key={`${tx.id}-${idx}`} className="p-3 border border-slate-100 bg-[#fbfbfb] hover:bg-slate-50 rounded-xl transition flex justify-between items-center">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                          tx.type === 'income' ? 'bg-emerald-50 text-emerald-600' :
                          tx.type === 'expense' ? 'bg-rose-50 text-rose-600' :
                          tx.type === 'receivable' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                        }`}>
                          {tx.type === 'income' ? <ArrowDownLeft className="w-5 h-5" /> :
                           tx.type === 'expense' ? <ArrowUpRight className="w-5 h-5" /> :
                           tx.type === 'receivable' ? <UserPlus className="w-5 h-5" /> : <UserMinus className="w-5 h-5" />}
                        </div>

                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-slate-900 truncate">{tx.title}</h4>
                          <span className="text-[9px] font-extrabold text-slate-400 block">{tx.category}</span>
                          {tx.phone && <span className="text-[9px] text-blue-600 font-bold block">{tx.phone}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right font-sans">
                          <span className={`text-xs font-black block ${
                            tx.type === 'income' ? 'text-emerald-600' :
                            tx.type === 'expense' ? 'text-rose-600' :
                            tx.type === 'receivable' ? 'text-blue-600' : 'text-purple-600'
                          }`}>
                            {tx.type === 'income' || tx.type === 'receivable' ? '+' : '-'} ৳{tx.amount.toLocaleString('en-IN')}
                          </span>
                          <span className="text-[8px] font-bold text-slate-400 block">{tx.date} • {tx.time}</span>
                        </div>
                        
                        <button 
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="p-1 hover:bg-rose-50 rounded-lg text-rose-500 transition ml-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* --- Tab 3: রিপোর্ট ও গ্রাফ (Reports Tab) --- */}
        {!loading && activeSubTab === 'reports' && (
          <div className="space-y-4 font-sans">
            {/* Cashflow Statistics */}
            <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-3xs space-y-4">
              <h3 className="text-sm font-black text-slate-800 border-b border-slate-100 pb-2">আয়-ব্যয় ক্যাশফ্লো গ্রাফ</h3>
              
              {/* Beautiful Custom SVG Bar Chart */}
              <div className="h-44 w-full flex items-end justify-around border-b border-l border-slate-200 pb-2 pt-4 relative select-none">
                
                {/* Visual grid line */}
                <div className="absolute left-0 right-0 border-t border-slate-100 top-1/4"></div>
                <div className="absolute left-0 right-0 border-t border-slate-100 top-2/4"></div>
                <div className="absolute left-0 right-0 border-t border-slate-100 top-3/4"></div>

                {/* Bar 1: Total Income */}
                <div className="flex flex-col items-center gap-1.5 w-14">
                  <div className="text-[10px] font-black text-emerald-600">৳{totalIncome.toLocaleString('en-IN')}</div>
                  <div 
                    className="w-8 bg-emerald-555 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg transition-all duration-700"
                    style={{ height: `${Math.max(10, Math.min(120, (totalIncome / (totalIncome + totalExpense || 1)) * 120))}px` }}
                  ></div>
                  <span className="text-[9px] font-black text-slate-500">মোট আয়</span>
                </div>

                {/* Bar 2: Total Expense */}
                <div className="flex flex-col items-center gap-1.5 w-14">
                  <div className="text-[10px] font-black text-rose-600">৳{totalExpense.toLocaleString('en-IN')}</div>
                  <div 
                    className="w-8 bg-rose-500 bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-lg transition-all duration-700"
                    style={{ height: `${Math.max(10, Math.min(120, (totalExpense / (totalIncome + totalExpense || 1)) * 120))}px` }}
                  ></div>
                  <span className="text-[9px] font-black text-slate-500">মোট ব্যয়</span>
                </div>

                {/* Bar 3: Net Profit */}
                <div className="flex flex-col items-center gap-1.5 w-14">
                  <div className="text-[10px] font-black text-blue-600">৳{netProfit.toLocaleString('en-IN')}</div>
                  <div 
                    className="w-8 bg-blue-500 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg transition-all duration-700"
                    style={{ height: `${Math.max(10, Math.min(120, (netProfit / (totalIncome || 1)) * 120))}px` }}
                  ></div>
                  <span className="text-[9px] font-black text-slate-500">নিট লাভ</span>
                </div>
              </div>

              {/* Custom Statistics Details card */}
              <div className="bg-slate-50 p-3 rounded-2xl space-y-2 text-xs font-black">
                <div className="flex justify-between">
                  <span className="text-slate-500">মোট সংগৃহীত আয়:</span>
                  <span className="text-emerald-600">৳{totalIncome.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">মোট পরিচালন ব্যয়:</span>
                  <span className="text-rose-600">৳{totalExpense.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm">
                  <span>সর্বমোট প্রফিট/লাভ:</span>
                  <span className={netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}>
                    ৳{netProfit.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- Tab 4: স্ক্যান ও অনুসন্ধান (Scan Tab) --- */}
        {!loading && activeSubTab === 'scan' && (
          <div className="space-y-4 font-sans">
            <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-3xs text-center space-y-4">
              <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600">
                <QrCode className="w-12 h-12" />
              </div>
              
              <div>
                <h3 className="text-base font-black text-slate-900">QR কোড স্ক্যানার</h3>
                <p className="text-xs text-slate-400 mt-1">যেকোনো মেম্বার বা কাস্টমারের আইডি বা QR কোড স্ক্যান করে তাদের বর্তমান লেজার হিসাব দেখুন।</p>
              </div>

              {/* simulated scan target */}
              <div className="border-4 border-dashed border-emerald-400/40 w-48 h-48 mx-auto rounded-3xl flex items-center justify-center bg-slate-100 overflow-hidden relative">
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse"></div>
                <span className="text-xs font-black text-slate-400">ক্যামেরা সিমুলেশন সক্রিয়...</span>
              </div>

              <div className="space-y-2 pt-2">
                <p className="text-[11px] text-slate-400">ম্যানুয়ালি মোবাইল বা মেম্বার আইডি টাইপ করুন:</p>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="উদাঃ SM-10001 বা 01712345678" 
                    className="border border-slate-200 rounded-xl px-3 py-2 text-xs w-full focus:outline-none"
                  />
                  <button className="bg-emerald-555 text-white font-black px-4 py-2 rounded-xl text-xs active:scale-95 transition">
                    খুঁজুন
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- Tab 5: আমার নোটবুক (Notebook Tab) --- */}
        {!loading && activeSubTab === 'notes' && (
          <div className="space-y-4 font-sans">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 select-none">
              <h3 className="text-sm font-black text-slate-800">আমার ডায়েরি ও চিরকুটসমূহ ({notes.length})</h3>
              <div className="flex gap-2 w-full sm:w-auto">
                <button 
                  onClick={handleBackupNotesToGmail}
                  className="flex-1 sm:flex-initial text-[11px] bg-blue-600 hover:bg-blue-700 text-white font-black px-3 py-1.5 rounded-xl flex items-center justify-center gap-1 active:scale-95 transition shadow-2xs"
                >
                  <Mail className="w-3.5 h-3.5" />
                  জিমেইলে ব্যাকআপ
                </button>
                <button 
                  onClick={() => setShowAddNoteScreen(true)}
                  className="flex-1 sm:flex-initial text-[11px] bg-[#00a884] hover:bg-[#008f72] text-white font-black px-3 py-1.5 rounded-xl flex items-center justify-center gap-1 active:scale-95 transition shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  নতুন চিরকুট
                </button>
              </div>
            </div>


            {/* List of Notes with layout from Screenshot */}
            <div className="grid grid-cols-2 gap-3">
              {notes.length === 0 ? (
                <div className="col-span-2 text-center py-10 text-slate-400 text-xs bg-white border border-slate-150 rounded-2xl shadow-3xs">
                  কোনো নোটবুক চিরকুট পাওয়া যায়নি।
                </div>
              ) : (
                notes.map((note, idx) => (
                  <div 
                    key={`${note.id}-${idx}`} 
                    className={`p-4 rounded-2xl border flex flex-col justify-between min-h-[170px] relative shadow-3xs transition-all duration-200 hover:scale-[1.02] ${getNoteCardStyles(note)}`}
                  >
                    {/* Stickpin */}
                    <button 
                      onClick={() => handleTogglePinNote(note)}
                      className="absolute top-2.5 right-2.5 text-slate-400 hover:text-slate-600 transition"
                    >
                      <Pin className={`w-3.5 h-3.5 rotate-45 ${note.pinned ? 'text-red-500 fill-current' : ''}`} />
                    </button>

                    <div>
                      <h4 className="text-xs font-black tracking-tight uppercase border-b border-black/5 pb-1 w-28 truncate">
                        {note.title}
                      </h4>
                      
                      {note.type === 'todo' && note.todos ? (
                        <div className="space-y-1.5 mt-2.5 text-[10px] font-bold">
                          {note.todos.map((todo, i) => (
                            <div 
                              key={i} 
                              className="flex items-center gap-1.5 cursor-pointer"
                              onClick={() => handleToggleTodo(note, i)}
                            >
                              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                todo.completed ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                              }`}>
                                {todo.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </div>
                              <span className={`truncate ${todo.completed ? 'line-through text-slate-400' : ''}`}>
                                {todo.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] font-bold mt-2.5 leading-relaxed">
                          {note.content}
                        </p>
                      )}

                      {/* Attached images preview inside the card */}
                      {(note as any).images && (note as any).images.length > 0 && (
                        <div className="flex gap-1 mt-2.5 overflow-x-auto no-scrollbar shrink-0">
                          {(note as any).images.map((img: string, idx: number) => (
                            <img 
                              key={idx} 
                              src={img} 
                              alt="Attachment" 
                              className="w-8 h-8 rounded-lg object-cover border border-black/5"
                              referrerPolicy="no-referrer"
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="text-[9px] font-bold text-black/40 mt-4 pt-1.5 border-t border-black/5 flex justify-between items-center shrink-0">
                      <span>{getBengaliDate(note.createdAt.split('T')[0])}</span>
                      <button 
                        onClick={() => handleDeleteNote(note.id)} 
                        className="text-rose-600 hover:text-rose-800 p-1 rounded-md transition hover:bg-black/5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* --- Tab 6: সেটিংস ও ডেটা (Settings Tab) --- */}
        {!loading && activeSubTab === 'settings' && (
          <div className="space-y-4 font-sans">
            <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-3xs space-y-4">
              <h3 className="text-sm font-black text-slate-800 border-b border-slate-100 pb-2">হিসাব খাতা নিয়ন্ত্রণ প্যানেল</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center p-2.5 border border-slate-100 rounded-xl bg-slate-50/50">
                  <div>
                    <span className="text-xs font-black text-slate-800">প্রাথমিক ডেমো ডাটা যোগ করুন</span>
                    <p className="text-[10px] text-slate-400">পরীক্ষার জন্য ডেমো ট্রানজেকশন ও চিরকুট লোড করুন।</p>
                  </div>
                  <button 
                    onClick={loadSampleData}
                    className="bg-[#e6f7f4] text-[#00a884] font-black border border-[#00a884]/30 px-3 py-1.5 rounded-xl text-xs active:scale-95 transition shrink-0"
                  >
                    লোড করুন 💫
                  </button>
                </div>

                <div className="flex justify-between items-center p-2.5 border border-slate-100 rounded-xl bg-slate-50/50">
                  <div>
                    <span className="text-xs font-black text-rose-600">সকল ডেটা রিসেট করুন</span>
                    <p className="text-[10px] text-slate-400">আপনার হিসাব খাতার সকল রেকর্ড চিরতরে মুছে ফেলুন।</p>
                  </div>
                  <button 
                    onClick={handleResetData}
                    className="bg-rose-50 text-rose-600 font-black border border-rose-200 px-3 py-1.5 rounded-xl text-xs active:scale-95 transition shrink-0"
                  >
                    রিসেট 🚨
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-3xs space-y-4">
              <h3 className="text-sm font-black text-slate-800 border-b border-slate-100 pb-2">সহায়তা ও যোগাযোগ</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                ব্যবসা নেটওয়ার্ক বাংলাদেশ হিসাব খাতা সংক্রান্ত যেকোনো জিজ্ঞাসা বা কারিগরি সহায়তার জন্য আমাদের কাস্টমার কেয়ারের সাথে যোগাযোগ করুন।
              </p>
              
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-slate-600">সাপোর্ট নম্বর:</span>
                <span className="text-xs font-black text-[#00a884]">{appConfig?.supportPhone || "01721-217171"}</span>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* --- MODAL: Add Transaction Modal --- */}
      <AnimatePresence>
        {showAddTxModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs font-sans">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 w-full max-w-sm rounded-3xl p-5 shadow-xl space-y-4"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                  {txFormType === 'income' ? '🟢 নতুন আয় যোগ করুন' :
                   txFormType === 'expense' ? '🔴 নতুন ব্যয় যোগ করুন' :
                   txFormType === 'receivable' ? '🔵 নতুন পাওনা (ক্রেডিট) যোগ করুন' : '🟠 নতুন দেনা (ডেবিট) যোগ করুন'}
                </h3>
                <button 
                  onClick={() => setShowAddTxModal(false)}
                  className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddTransaction} className="space-y-3 text-xs font-black">
                {/* 1. Amount */}
                <div className="space-y-1">
                  <label className="text-slate-550">টাকার পরিমাণ (৳):</label>
                  <input 
                    type="number" 
                    required
                    placeholder="উদাঃ ৫০০০"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none"
                  />
                </div>

                {/* 2. Title / Customer Name */}
                <div className="space-y-1">
                  <label className="text-slate-550">নাম / বিবরণ:</label>
                  <input 
                    type="text" 
                    required
                    placeholder={txFormType === 'receivable' || txFormType === 'payable' ? "গ্রাহক/ব্যক্তির নাম" : "আয় বা ব্যয়ের বর্ণনা"}
                    value={txTitle}
                    onChange={(e) => setTxTitle(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none"
                  />
                </div>

                {/* 3. Category */}
                <div className="space-y-1">
                  <label className="text-slate-550">ক্যাটাগরি বা খাত (ঐচ্ছিক):</label>
                  <input 
                    type="text" 
                    placeholder={txFormType === 'income' ? "আয় - বিক্রয়, কমিশন" : txFormType === 'expense' ? "বাজার খরচ, বেতন, ভাড়া" : "বকেয়া আদায়"}
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none"
                  />
                </div>

                {/* 4. Phone for Receivables/Payables */}
                {(txFormType === 'receivable' || txFormType === 'payable') && (
                  <div className="space-y-1">
                    <label className="text-slate-550">মোবাইল নম্বর (ঐচ্ছিক - রিমাইন্ডারের জন্য):</label>
                    <input 
                      type="text" 
                      placeholder="উদাঃ 01712-345678"
                      value={txPhone}
                      onChange={(e) => setTxPhone(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none"
                    />
                  </div>
                )}

                {/* 5. Date */}
                <div className="space-y-1">
                  <label className="text-slate-550">তারিখ:</label>
                  <input 
                    type="date" 
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowAddTxModal(false)}
                    className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition active:scale-95"
                  >
                    বাতিল
                  </button>
                  <button 
                    type="submit" 
                    className="w-1/2 py-2.5 bg-emerald-555 hover:bg-emerald-600 text-white rounded-xl font-black transition active:scale-95 shadow-3xs"
                  >
                    সংরক্ষণ করুন
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL: Add Note Modal --- */}
      <AnimatePresence>
        {showAddNoteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs font-sans">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 w-full max-w-sm rounded-3xl p-5 shadow-xl space-y-4"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                  📒 নতুন চিরকুট/নোট লিখুন
                </h3>
                <button 
                  onClick={() => setShowAddNoteModal(false)}
                  className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddNote} className="space-y-3.5 text-xs font-black">
                {/* Note Type Selector */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNoteType('note')}
                    className={`py-2 rounded-xl border font-black transition ${
                      noteType === 'note' ? 'bg-[#00a884] text-white border-[#00a884]' : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    সাধারণ চিরকুট
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoteType('todo')}
                    className={`py-2 rounded-xl border font-black transition ${
                      noteType === 'todo' ? 'bg-[#00a884] text-white border-[#00a884]' : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    চেকলিস্ট (To-Do)
                  </button>
                </div>

                {/* 1. Title */}
                <div className="space-y-1">
                  <label className="text-slate-550">চিরকুটের শিরোনাম:</label>
                  <input 
                    type="text" 
                    required
                    placeholder="উদাঃ গুরুত্বপূর্ণ, বাজার ফর্দ"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none"
                  />
                </div>

                {/* 2. Content (For normal note) */}
                {noteType === 'note' ? (
                  <div className="space-y-1">
                    <label className="text-slate-550">মূল বিষয়বস্তু:</label>
                    <textarea 
                      required
                      placeholder="এখানে আপনার চিরকুটের বিষয়বস্তু লিখুন..."
                      rows={4}
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none resize-none"
                    />
                  </div>
                ) : (
                  // For Todo list type
                  <div className="space-y-2">
                    <label className="text-slate-550">চেকলিস্ট আইটেমসমূহ:</label>
                    
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="উদাঃ মাল ডেলিভারি দেওয়া"
                        value={todoInput}
                        onChange={(e) => setTodoInput(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                      />
                      <button 
                        type="button" 
                        onClick={handleAddTodoLocal}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl active:scale-95 transition font-black shrink-0"
                      >
                        যোগ
                      </button>
                    </div>

                    <div className="max-h-24 overflow-y-auto space-y-1 border border-slate-100 p-2 rounded-xl bg-slate-50">
                      {todoItems.length === 0 ? (
                        <div className="text-[10px] text-slate-400 text-center py-2">কোনো আইটেম যোগ করা হয়নি।</div>
                      ) : (
                        todoItems.map((item, index) => (
                          <div key={index} className="flex justify-between items-center bg-white border border-slate-150 p-1.5 rounded-lg">
                            <span className="truncate">{item.text}</span>
                            <button 
                              type="button" 
                              onClick={() => handleRemoveTodoLocal(index)}
                              className="text-red-500 hover:text-red-700 p-0.5"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Color Picker */}
                <div className="space-y-1">
                  <label className="text-slate-550">চিরকুটের ব্যাকগ্রাউন্ড রঙ নির্বাচন করুন:</label>
                  <div className="flex gap-3 pt-1">
                    {['yellow', 'green', 'blue'].map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setNoteColor(col as any)}
                        className={`w-7 h-7 rounded-full border-2 transition ${
                          col === 'yellow' ? 'bg-[#fef9c3] border-yellow-400' :
                          col === 'green' ? 'bg-[#dcfce7] border-green-400' :
                          'bg-[#dbeafe] border-blue-400'
                        } ${noteColor === col ? 'scale-115 ring-2 ring-emerald-500 ring-offset-2' : ''}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowAddNoteModal(false)}
                    className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition active:scale-95"
                  >
                    বাতিল
                  </button>
                  <button 
                    type="submit" 
                    className="w-1/2 py-2.5 bg-[#00a884] hover:bg-[#008f72] text-white rounded-xl font-black transition active:scale-95 shadow-3xs"
                  >
                    সেভ চিরকুট
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL: Customer List Modal --- */}
      <AnimatePresence>
        {showCustomerList && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs font-sans">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 w-full max-w-sm rounded-3xl p-5 shadow-xl space-y-4"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                  👥 গ্রাহক ও বকেয়া খাতা
                </h3>
                <button 
                  onClick={() => setShowCustomerList(false)}
                  className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto">
                {customers.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs">কোনো গ্রাহক পাওয়া যায়নি। নতুন পাওনা বা দেনা লেনদেন যোগ করলে গ্রাহক স্বয়ংক্রিয়ভাবে তালিকাভুক্ত হবে।</div>
                ) : (
                  customers.map((cust, i) => {
                    const custReceivables = transactions
                      .filter(t => (cust.phone !== 'মোবাইল নম্বর নেই' && t.phone === cust.phone) || (t.title === cust.name))
                      .filter(t => t.type === 'receivable')
                      .reduce((sum, t) => sum + t.amount, 0);

                    const custPayables = transactions
                      .filter(t => (cust.phone !== 'মোবাইল নম্বর নেই' && t.phone === cust.phone) || (t.title === cust.name))
                      .filter(t => t.type === 'payable')
                      .reduce((sum, t) => sum + t.amount, 0);

                    return (
                      <div key={i} className="p-3 border border-slate-100 bg-[#fbfbfb] rounded-xl flex justify-between items-center text-xs font-black">
                        <div>
                          <h4 className="text-slate-900 font-black">{cust.name}</h4>
                          <span className="text-[10px] text-slate-400 font-bold block">{cust.phone}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-blue-600 font-black">পাওনা: ৳{custReceivables.toLocaleString('en-IN')}</div>
                          <div className="text-purple-600 font-black mt-0.5">দেনা: ৳{custPayables.toLocaleString('en-IN')}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <button 
                onClick={() => setShowCustomerList(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl active:scale-95 transition text-xs"
              >
                বন্ধ করুন
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL: All Reminders List Modal --- */}
      <AnimatePresence>
        {showReminderList && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs font-sans">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 w-full max-w-sm rounded-3xl p-5 shadow-xl space-y-4"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                  🔔 সকল বকেয়া পাওনা রিমাইন্ডার
                </h3>
                <button 
                  onClick={() => setShowReminderList(false)}
                  className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5 max-h-80 overflow-y-auto">
                {transactions.filter(t => t.type === 'receivable').length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs">কোনো বকেয়া পাওনা রিমাইন্ডার পাওয়া যায়নি।</div>
                ) : (
                  transactions.filter(t => t.type === 'receivable').map((rem, idx) => (
                    <div key={`${rem.id}-${idx}`} className="p-3 border border-slate-100 bg-[#fbfbfb] rounded-xl flex justify-between items-center text-xs font-black">
                      <div>
                        <h4 className="text-slate-900">{rem.title}</h4>
                        <span className="text-[10px] text-slate-400 block">{rem.phone || "ফোন নম্বর নেই"}</span>
                        <span className="text-blue-600 font-bold block mt-1">৳{rem.amount.toLocaleString('en-IN')}</span>
                      </div>
                      
                      {rem.phone && (
                        <a 
                          href={getWhatsAppLink(rem.phone, rem.title, rem.amount)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-emerald-555 hover:bg-emerald-600 text-white rounded-xl text-[11px] font-black flex items-center gap-1.5 active:scale-95 transition"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          মেসেজ পাঠান
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>

              <button 
                onClick={() => setShowReminderList(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl active:scale-95 transition text-xs"
              >
                বন্ধ করুন
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL / FULL SCREEN: Modern Smartphone Calculator --- */}
      <AnimatePresence>
        {showCalculator && (
          <div className="fixed inset-0 z-50 bg-white flex flex-col justify-between font-sans select-none overflow-hidden">
            {/* Top Bar Header */}
            <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100">
              <button 
                onClick={() => setShowCalculator(false)}
                className="p-2 -ml-2 text-slate-700 hover:bg-slate-100 rounded-full transition active:scale-95"
                title="বন্ধ করুন"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              
              <h2 className="text-base font-bold text-slate-800">
                ক্যালকুলেটর
              </h2>

              <button 
                onClick={() => setShowCalcHistory(!showCalcHistory)}
                className="p-2 -mr-2 text-slate-700 hover:bg-slate-100 rounded-full transition active:scale-95"
                title="হিস্ট্রি"
              >
                <Clock className="w-5 h-5" />
              </button>
            </div>

            {/* Display Area (Flexible space taking top half) */}
            <div className="flex-1 px-6 py-4 flex flex-col justify-between overflow-y-auto">
              {/* History Drawer/Overlay if active */}
              {showCalcHistory ? (
                <div className="w-full h-full flex flex-col justify-between bg-slate-50 border border-slate-200/80 rounded-2xl p-4 overflow-hidden">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-600" /> হিসাবের ইতিহাস (History)
                    </span>
                    {calcHistory.length > 0 && (
                      <button 
                        onClick={() => setCalcHistory([])}
                        className="text-[11px] font-bold text-rose-600 hover:underline"
                      >
                        মুছে ফেলুন
                      </button>
                    )}
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-2 py-3">
                    {calcHistory.length === 0 ? (
                      <div className="text-center text-slate-400 text-xs py-8">কোনো হিসাবের রেকর্ড পাওয়া যায়নি</div>
                    ) : (
                      calcHistory.map((item, idx) => (
                        <div 
                          key={idx}
                          onClick={() => {
                            setCalcInput(item.result);
                            setShowCalcHistory(false);
                          }}
                          className="p-2.5 bg-white border border-slate-200/60 rounded-xl hover:border-blue-300 cursor-pointer text-right transition"
                        >
                          <div className="text-xs text-slate-500 font-medium">{item.expr}</div>
                          <div className="text-sm font-bold text-blue-600 mt-0.5">= {item.result}</div>
                        </div>
                      ))
                    )}
                  </div>

                  <button 
                    onClick={() => setShowCalcHistory(false)}
                    className="w-full py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                  >
                    বন্ধ করুন
                  </button>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col justify-end text-right">
                  {/* Large Expression Display */}
                  <div className="text-4xl sm:text-5xl md:text-6xl font-light text-slate-900 tracking-tight break-all leading-tight min-h-[70px] flex items-center justify-end">
                    {renderFormattedExpression(calcInput)}
                  </div>

                  {/* Live Auto-Evaluated Result Preview (displayed right underneath in gray) */}
                  <div className="text-2xl sm:text-3xl font-normal text-slate-400 mt-2 min-h-[36px]">
                    {calcResult ? calcResult : ''}
                  </div>
                </div>
              )}
            </div>

            {/* Middle Quick Tools Bar (History icon, Function icon, Convert icon) */}
            <div className="flex justify-around items-center px-6 py-2 border-t border-slate-100 text-slate-500">
              <button 
                onClick={() => setShowCalcHistory(!showCalcHistory)} 
                className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition active:scale-95"
                title="হিস্ট্রি"
              >
                <Clock className="w-5 h-5" />
              </button>
              <button 
                onClick={() => handleCalcBtn('%')}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-600 font-bold text-sm transition active:scale-95"
                title="পার্সেন্টেজ"
              >
                %
              </button>
              <button 
                onClick={() => handleCalcBtn('+/-')}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-600 font-bold text-sm transition active:scale-95"
                title="প্লাস/মাইনাস"
              >
                +/-
              </button>
            </div>

            {/* Keypad Grid (5 rows x 4 columns with large circular touch targets) */}
            <div className="p-4 sm:p-6 bg-white border-t border-slate-100">
              <div className="grid grid-cols-4 gap-3 max-w-sm mx-auto">
                {/* Row 1 */}
                <button 
                  onClick={() => handleCalcBtn('AC')} 
                  className="w-full aspect-square rounded-full bg-[#eff6ff] hover:bg-blue-100 text-[#2563eb] font-bold text-lg flex items-center justify-center transition active:scale-90 shadow-2xs"
                >
                  AC
                </button>
                <button 
                  onClick={() => handleCalcBtn('⌫')} 
                  className="w-full aspect-square rounded-full bg-[#eff6ff] hover:bg-blue-100 text-[#2563eb] font-bold text-lg flex items-center justify-center transition active:scale-90 shadow-2xs"
                >
                  ⌫
                </button>
                <button 
                  onClick={() => handleCalcBtn('+/-')} 
                  className="w-full aspect-square rounded-full bg-[#eff6ff] hover:bg-blue-100 text-[#2563eb] font-bold text-lg flex items-center justify-center transition active:scale-90 shadow-2xs"
                >
                  +/-
                </button>
                <button 
                  onClick={() => handleCalcBtn('÷')} 
                  className="w-full aspect-square rounded-full bg-[#eff6ff] hover:bg-blue-100 text-[#2563eb] font-bold text-2xl flex items-center justify-center transition active:scale-90 shadow-2xs"
                >
                  ÷
                </button>

                {/* Row 2 */}
                <button onClick={() => handleCalcBtn('7')} className="w-full aspect-square rounded-full bg-[#f8fafc] hover:bg-slate-100 text-slate-900 font-normal text-2xl flex items-center justify-center transition active:scale-90 shadow-2xs">7</button>
                <button onClick={() => handleCalcBtn('8')} className="w-full aspect-square rounded-full bg-[#f8fafc] hover:bg-slate-100 text-slate-900 font-normal text-2xl flex items-center justify-center transition active:scale-90 shadow-2xs">8</button>
                <button onClick={() => handleCalcBtn('9')} className="w-full aspect-square rounded-full bg-[#f8fafc] hover:bg-slate-100 text-slate-900 font-normal text-2xl flex items-center justify-center transition active:scale-90 shadow-2xs">9</button>
                <button onClick={() => handleCalcBtn('×')} className="w-full aspect-square rounded-full bg-[#eff6ff] hover:bg-blue-100 text-[#2563eb] font-bold text-2xl flex items-center justify-center transition active:scale-90 shadow-2xs">×</button>

                {/* Row 3 */}
                <button onClick={() => handleCalcBtn('4')} className="w-full aspect-square rounded-full bg-[#f8fafc] hover:bg-slate-100 text-slate-900 font-normal text-2xl flex items-center justify-center transition active:scale-90 shadow-2xs">4</button>
                <button onClick={() => handleCalcBtn('5')} className="w-full aspect-square rounded-full bg-[#f8fafc] hover:bg-slate-100 text-slate-900 font-normal text-2xl flex items-center justify-center transition active:scale-90 shadow-2xs">5</button>
                <button onClick={() => handleCalcBtn('6')} className="w-full aspect-square rounded-full bg-[#f8fafc] hover:bg-slate-100 text-slate-900 font-normal text-2xl flex items-center justify-center transition active:scale-90 shadow-2xs">6</button>
                <button onClick={() => handleCalcBtn('-')} className="w-full aspect-square rounded-full bg-[#eff6ff] hover:bg-blue-100 text-[#2563eb] font-bold text-2xl flex items-center justify-center transition active:scale-90 shadow-2xs">-</button>

                {/* Row 4 */}
                <button onClick={() => handleCalcBtn('1')} className="w-full aspect-square rounded-full bg-[#f8fafc] hover:bg-slate-100 text-slate-900 font-normal text-2xl flex items-center justify-center transition active:scale-90 shadow-2xs">1</button>
                <button onClick={() => handleCalcBtn('2')} className="w-full aspect-square rounded-full bg-[#f8fafc] hover:bg-slate-100 text-slate-900 font-normal text-2xl flex items-center justify-center transition active:scale-90 shadow-2xs">2</button>
                <button onClick={() => handleCalcBtn('3')} className="w-full aspect-square rounded-full bg-[#f8fafc] hover:bg-slate-100 text-slate-900 font-normal text-2xl flex items-center justify-center transition active:scale-90 shadow-2xs">3</button>
                <button onClick={() => handleCalcBtn('+')} className="w-full aspect-square rounded-full bg-[#eff6ff] hover:bg-blue-100 text-[#2563eb] font-bold text-2xl flex items-center justify-center transition active:scale-90 shadow-2xs">+</button>

                {/* Row 5 */}
                <button onClick={() => handleCalcBtn('%')} className="w-full aspect-square rounded-full bg-[#f8fafc] hover:bg-slate-100 text-slate-900 font-normal text-xl flex items-center justify-center transition active:scale-90 shadow-2xs">%</button>
                <button onClick={() => handleCalcBtn('0')} className="w-full aspect-square rounded-full bg-[#f8fafc] hover:bg-slate-100 text-slate-900 font-normal text-2xl flex items-center justify-center transition active:scale-90 shadow-2xs">0</button>
                <button onClick={() => handleCalcBtn('.')} className="w-full aspect-square rounded-full bg-[#f8fafc] hover:bg-slate-100 text-slate-900 font-normal text-2xl flex items-center justify-center transition active:scale-90 shadow-2xs">.</button>
                <button onClick={() => handleCalcBtn('=')} className="w-full aspect-square rounded-full bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-2xl flex items-center justify-center transition active:scale-90 shadow-md">=</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Sticky Bottom Navigation Bar with Colorful Professional Icons */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 py-2 px-3 shadow-xl flex justify-between items-center z-40 select-none font-sans">
        <button 
          onClick={() => { setActiveSubTab('home'); }}
          className={`flex flex-col items-center gap-1 flex-1 transition ${activeSubTab === 'home' ? 'text-[#00a884] scale-110 font-black' : 'text-[#00a884]/60 hover:text-[#00a884]'}`}
        >
          <BookOpen className="w-5.5 h-5.5" />
          <span className="text-[9.5px] font-black">হোম</span>
        </button>

        <button 
          onClick={() => { setShowCustomerList(true); }}
          className="flex flex-col items-center gap-1 flex-1 transition text-blue-600/70 hover:text-blue-600 active:scale-95"
        >
          <Users className="w-5.5 h-5.5 text-blue-600" />
          <span className="text-[9.5px] font-black text-blue-700">গ্রাহক তালিকা</span>
        </button>

        <button 
          onClick={() => { setActiveSubTab('reports'); }}
          className={`flex flex-col items-center gap-1 flex-1 transition ${activeSubTab === 'reports' ? 'text-amber-600 scale-110 font-black' : 'text-amber-600/60 hover:text-amber-600'}`}
        >
          <BarChart2 className="w-5.5 h-5.5" />
          <span className="text-[9.5px] font-black">রিপোর্ট</span>
        </button>

        {/* Floating Calculator button exactly centered */}
        <div className="relative -top-5 shrink-0 px-2">
          <button 
            onClick={() => { setShowCalculator(true); }}
            className="w-14 h-14 bg-emerald-555 hover:bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition border-4 border-white"
          >
            <Calculator className="w-7 h-7" />
          </button>
          <span className="text-[9px] font-black text-emerald-700 absolute -bottom-5.5 left-1/2 -translate-x-1/2">ক্যালকুলেটর</span>
        </div>

        <button 
          onClick={() => { setActiveSubTab('notes'); }}
          className={`flex flex-col items-center gap-1 flex-1 transition ${activeSubTab === 'notes' ? 'text-purple-600 scale-110 font-black' : 'text-purple-600/60 hover:text-purple-600'}`}
        >
          <FileText className="w-5.5 h-5.5" />
          <span className="text-[9.5px] font-black">নোটবুক</span>
        </button>

        <button 
          onClick={() => { setActiveSubTab('settings'); }}
          className={`flex flex-col items-center gap-1 flex-1 transition ${activeSubTab === 'settings' ? 'text-slate-600 scale-110 font-black' : 'text-slate-600/60 hover:text-slate-600'}`}
        >
          <Settings className="w-5.5 h-5.5" />
          <span className="text-[9.5px] font-black">সেটিংস</span>
        </button>
      </nav>

    </div>
  );
}
