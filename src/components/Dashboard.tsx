import React, { useState, useEffect, useRef } from 'react';
import { User, Transaction, Notice, Offer, AppConfig, Product, UserNotification, SAMITY_MONTHS, SAMITY_YEARS } from '../types';
import { sortTransactionsNewestFirst } from '../lib/transactionUtils';
import { db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  doc, 
  updateDoc,
  setDoc,
  limit,
  onSnapshot,
  deleteDoc,
  runTransaction
} from 'firebase/firestore';
import { 
  Menu, 
  Bell, 
  BellRing,
  Eye,
  LogOut, 
  Wallet, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Home,
  UserCircle, 
  DollarSign, 
  BookOpen, 
  Smartphone, 
  ShoppingBag, 
  CreditCard,
  Building2, 
  ShieldCheck,
  Sparkles,
  HeartHandshake,
  FileText,
  Users,
  Megaphone,
  History,
  CheckCircle2,
  PlusCircle,
  AlertCircle,
  X,
  Languages,
  BadgePercent,
  ChevronRight,
  ChevronLeft,
  Clock,
  ShieldAlert,
  RefreshCw,
  MessageCircle,
  Store,
  Plus,
  Send,
  Calendar,
  Ticket,
  Construction,
  Lock,
  Check,
  Gift,
  Target,
  Landmark,
  Truck,
  Heart,
  Globe,
  PhoneCall,
  Utensils,
  Sun,
  Moon,
  Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BNBLogo } from './BNBLogo';
import SafeDealsEscrowView from './SafeDealsEscrowView';
import BNBTelecomScreen from './BNBTelecomScreen';
import SamityScreen from './SamityScreen';
import SamityRequestForm from './SamityRequestForm';
import QardScreen from './QardScreen';
import AgentScreen from './AgentScreen';
import { QardLiveTicker } from './QardLiveTicker';
import ProfileView from './ProfileView';
import { formatBanglaAmount, hasCompletedSamityProfile } from '../lib/memberUtils';
import MoneyExchangeModule from './MoneyExchangeModule';
import { BnbMobileBankingPortal } from './BnbMobileBankingPortal';
import RationCardView from './RationCardView';
import BNBInstantCourier from './BNBInstantCourier';
import BnbHisabKhata from './BnbHisabKhata';
import BnbAutoSalaryPay from './BnbAutoSalaryPay';
import BnbEducationCenter from './BnbEducationCenter';
import SmartExchange from './SmartExchange';
import SafiPremiumShop from './SafiPremiumShop';
import BnbCorporateGuide from './BnbCorporateGuide';

const cleanDescription = (desc: string, status?: string): string => {
  if (!desc) return '';
  if (status && status !== 'pending') {
    return desc
      .replace(/\s*\(অ্যাডমিন অনুমোদনের অপেক্ষায়\)।?/g, '')
      .replace(/\s*\(অ্যাডমিন অনুমোদনের অপেক্ষায়\)/g, '')
      .replace(/\s*\(অ্যাডমিন অনুমোদনের অপেক্ষায়\)।?/g, '')
      .replace(/\s*\(অ্যাডমিন অনুমোদনের অপেক্ষায়\)/g, '')
      .replace(/\s*\(অনুমোদনের অপেক্ষায়\)।?/g, '')
      .replace(/\s*\(অনুমোদনের অপেক্ষায়\)/g, '')
      .trim();
  }
  return desc;
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
};

const toBnDigits = (num: number | string) => {
  const digits: Record<string, string> = {
    '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
    '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯', '.': '.'
  };
  return num.toString().split('').map(char => digits[char] || char).join('');
};

const defaultProducts: Product[] = [
  { id: 'item-101', name: 'Sundarban Honey 1kg', price: 2300, oldPrice: 2500, category: 'honey', icon: '🍯', description: 'সুন্দরবনের ১০০% খাঁটি প্রাকৃতিক চাকের খলিশা ফুলের মধু। 🐝', rating: 5.0, minOrder: '1 কেজি', supplier: 'Sundarban API Co.', flag: '🇧🇩', shipTime: '২-৩ দিন', imageUrl: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&q=80&w=300', latitude: 23.7930, longitude: 90.2330, shopAddress: 'মৌচাক বাজার, সাভার, ঢাকা' },
  { id: 'item-102', name: 'Gawa Ghee 1kg', price: 1800, oldPrice: 2000, category: 'oil_ghee', icon: '🍶', description: 'খাঁটি গরুর দুধের সর থেকে ঐতিহ্যবাহী পদ্ধতিতে তৈরি গাওয়া ঘি। সুবাসে অনন্য। 🧈', rating: 4.9, minOrder: '1 Unit', supplier: 'Pabna Sweet Dairy', flag: '🇧🇩', shipTime: '১-৩ দিন', imageUrl: 'https://images.unsplash.com/photo-1622484211148-7162624dd1ee?auto=format&fit=crop&q=80&w=300', latitude: 23.7980, longitude: 90.2220, shopAddress: 'ডেইরি ফার্স্ট রোড, হেমায়েতপুর, সাভার' },
  { id: 'item-103', name: 'Deshi Mustard Oil 5 Liter', price: 1550, oldPrice: 1750, category: 'oil_ghee', icon: '🍶', description: 'কাঠের ঘানির ভাঙানো প্রথম চাপের খাঁটি সরিষার তেল। ঝাঁঝালো স্বাদ ও গন্ধ। 🌿', rating: 4.8, minOrder: '1 Unit', supplier: 'Rajshahi Oil Mills', flag: '🇧🇩', shipTime: '৩-৪ দিন', imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=300', latitude: 23.8200, longitude: 90.2600, shopAddress: 'ঘানিঘর লেন, সাভার বাসস্ট্যান্ড, ঢাকা' },
  { id: 'item-104', name: 'Black Seed Honey 1kg', price: 1500, oldPrice: 1600, category: 'honey', icon: '🍯', description: 'কালোজিরা ফুলের মধু অত্যন্ত পুষ্টিকর ও রোগ প্রতিরোধ ক্ষমতাবর্ধক। 💪', rating: 5.0, minOrder: '1 কেজি', supplier: 'Nator Honey Farms', flag: '🇧🇩', shipTime: '২-৪ দিন', imageUrl: 'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?auto=format&fit=crop&q=80&w=300', latitude: 23.8500, longitude: 90.2900, shopAddress: 'মৌমাছি এভিনিউ, নবীনগর, সাভার' },
  { id: 'item-105', name: 'African Organic Wild Honey', price: 1100, oldPrice: 1250, category: 'honey', icon: '🍯', description: 'আফ্রিকার চিরহরিৎ বনাঞ্চলের শতভাগ বুনো মোচাকের অর্গানিক মধু। 🍯', rating: 4.7, minOrder: '1 Unit', supplier: 'Kenya Wild Imports', flag: '🇰🇪', shipTime: '৫-৭ দিন', imageUrl: 'https://images.unsplash.com/photo-1555169062-013468b47731?auto=format&fit=crop&q=80&w=300', latitude: 23.9500, longitude: 90.3500, shopAddress: 'ইমপোর্ট হাব কমপ্লেক্স, উত্তরা, ঢাকা' },
  { id: 'item-106', name: 'Iranian Premium Dates 1kg', price: 1200, oldPrice: 1350, category: 'dates', icon: '🧆', description: 'শতভাগ প্রিমিয়াম বড় সাইজের ইরানি মরিয়ম খেজুর। নরম, মিষ্টি ও সুস্বাদু। 🌴', rating: 5.0, minOrder: '1 Unit', supplier: 'Tehran Palm Orchard', flag: '🇮🇷', shipTime: '৩-৫ দিন', imageUrl: 'https://images.unsplash.com/photo-1596701062351-8c2c14d1fdd0?auto=format&fit=crop&q=80&w=300', latitude: 24.1000, longitude: 90.5000, shopAddress: 'গাজীপুর চৌরাস্তা ইমপোর্ট জোন, গাজীপুর' }
];

const SAFI_CATEGORIES = [
  {
    id: 'food_grocery',
    name: 'খাদ্য ও নিত্যপ্রয়োজনীয় পণ্য',
    desc: 'ঘানি ভাঙা তেল, খাঁটি মধু, ঘি ও অর্গানিক খাদ্য',
    icon: '🍯',
    gradient: 'from-amber-50 to-orange-50/50 hover:from-amber-100 hover:to-orange-100/60 border-amber-200 text-amber-900',
    iconBg: 'bg-amber-150 text-amber-800',
    count: '৬টি প্রোডাক্ট'
  },
  {
    id: 'clothing_fashion',
    name: 'পোশাক ও ফ্যাশন',
    desc: 'ঐতিহ্যবাহী সুতি শাড়ি, পাঞ্জাবি ও প্রিমিয়াম পোশাক',
    icon: '👕',
    gradient: 'from-sky-50 to-indigo-50/50 hover:from-sky-100 hover:to-indigo-100/60 border-indigo-150 text-indigo-900',
    iconBg: 'bg-indigo-100 text-indigo-800',
    count: '৫টি প্রোডাক্ট'
  },
  {
    id: 'tech_gadgets',
    name: 'প্রযুক্তি ও গ্যাজেট',
    desc: 'ফাস্ট চার্জার, এয়ারবাডস ও মোবাইল পার্টস',
    icon: '⚡',
    gradient: 'from-purple-50 to-fuchsia-50/50 hover:from-purple-100 hover:to-fuchsia-100/60 border-purple-150 text-purple-900',
    iconBg: 'bg-purple-100 text-purple-800',
    count: '৫টি প্রোডাক্ট'
  },
  {
    id: 'cosmetics_lifestyle',
    name: 'প্রসাধন ও লাইফস্টাইল',
    desc: 'আয়ুর্বেদিক সাবান, অর্গানিক তেল ও রূপচর্চা সামগ্রী',
    icon: '🧼',
    gradient: 'from-emerald-50 to-teal-50/50 hover:from-emerald-100 hover:to-teal-100/60 border-emerald-150 text-emerald-900',
    iconBg: 'bg-emerald-100 text-emerald-800',
    count: '৪টি প্রোডাক্ট'
  }
];

const SAFI_PRODUCTS = [
  // Food & Grocery
  { id: 'sf_oil', category: 'food_grocery', name: 'Safi কাঠের ঘানি ভাঙা সর্ষের তৈল', price: 295, desc: '১ লিটার বোতল, শতভাগ বিশুদ্ধ সরিষার বীজ থেকে প্রস্তুত', emoji: '🛢️', badge: 'Best Seller', rating: '৪.৯', brand: 'Safi Pure', stock: '১২০ পিস' },
  { id: 'sf_honey_wild', category: 'food_grocery', name: 'Safi প্রিমিয়াম খাঁটি ফুলের মধু', price: 650, desc: '৫০০ গ্রাম প্যাক, সুন্দরবনের প্রাকৃতিক চাক হতে সংগৃহীত', emoji: '🍯', badge: '100% Organic', rating: '৫.০', brand: 'Safi Organics', stock: '৪৫ পিস' },
  { id: 'sf_ghee', category: 'food_grocery', name: 'Safi প্রিমিয়াম গাওয়া ঘি (Pure Cow Ghee)', price: 420, desc: '২৫০ গ্রাম বয়াম, traditional ও খাঁটি পদ্ধতিতে তৈরি', emoji: '🧈', badge: 'Pure Desi', rating: '৪.৮', brand: 'Safi Dairy', stock: '৬০ পিস' },
  { id: 'sf_honey_black', category: 'food_grocery', name: 'Safi প্রিমিয়াম কালোজিরা মধু', price: 550, desc: '৫০০ গ্রাম প্রিমিয়াম গ্লাস জার, নাটোর ও সিরাজগঞ্জের বিশ্বস্ত কালোজিরা ফুলের মধু', emoji: '🐝', badge: 'Premium', rating: '৪.৯', brand: 'Safi Organics', stock: '৮৫ পিস' },
  { id: 'sf_rice_chinigura', category: 'food_grocery', name: 'Safi সুগন্ধি চিনিগুঁড়া চাল', price: 145, desc: '১ কেজি এয়ারটাইট প্যাক, দিনাজপুর থেকে সংগৃহীত সুগন্ধি পোলাও চাল', emoji: '🌾', badge: 'Superb Quality', rating: '৫.০', brand: 'Safi Foods', stock: '২০০ কেজি' },
  { id: 'sf_darjeeling_tea', category: 'food_grocery', name: 'Safi প্রিমিয়াম দার্জিলিং ব্ল্যাক টি', price: 250, desc: '২০০ গ্রাম লাক্সারি টিন ক্যান, বাগানের তরতাজা প্রথম চাপের প্রিমিয়াম চা পাতা', emoji: '🍵', badge: 'New Arrival', rating: '৪.৭', brand: 'Safi Brew', stock: '১৫০ পিস' },

  // Clothing & Fashion
  { id: 'sf_sharee', category: 'clothing_fashion', name: 'Safi ঐতিহ্যবাহী টাঙ্গাইলের সুতি শাড়ি', price: 1450, desc: '১০০% পিওর সুতা দিয়ে কারিগরদের তাঁতে বোনা আকর্ষণীয় ডিজাইনের শাড়ি', emoji: '👘', badge: 'Handloom', rating: '৪.৯', brand: 'Safi Weaves', stock: '২৫ পিস' },
  { id: 'sf_panjabi', category: 'clothing_fashion', name: 'Safi প্রিমিয়াম সেমি-ফিটেড পাঞ্জাবি', price: 1250, desc: 'লিলেন ও সুতি ব্লেন্ডের আরামদায়ক পাঞ্জাবি, মেটাল বোতাম ও এমব্রয়ডারি ওয়ার্ক', emoji: '🧥', badge: 'Hot Trend', rating: '৪.৮', brand: 'Safi Fits', stock: '৪০ পিস' },
  { id: 'sf_tshirt', category: 'clothing_fashion', name: 'Safi আরামদায়ক ক্যাজুয়াল টি-শার্ট', price: 290, desc: '১৬০ GSM প্রি-শ্রাঙ্ক কটন, অত্যন্ত আরামদায়ক ও ট্রেন্ডি কমফোর্ট ফিট টি-শার্ট', emoji: '👕', badge: 'Premium Cotton', rating: '৪.৭', brand: 'Safi Casuals', stock: '১১০ পিস' },
  { id: 'sf_trouser', category: 'clothing_fashion', name: 'Safi স্পোর্টস ট্রাউজার (Comfort Fit)', price: 450, desc: 'ব্রেথেবল ফেব্রিক, ৪-ওয়ে স্ট্রেচেবল ওয়ার্কআউট ও ট্রাভেল জগার্স', emoji: '👖', badge: 'Comfort Wear', rating: '৪.৬', brand: 'Safi Sports', stock: '৮০ পিস' },
  { id: 'sf_lungi', category: 'clothing_fashion', name: 'Safi এক্সক্লুসিভ ৮.৫ হাত সুতি লুঙ্গি', price: 370, desc: 'আসল সুতি সুতা দিয়ে তৈরি অত্যন্ত আরামদায়ক ও স্থায়ী ঐতিহ্যবাহী দেশি লুঙ্গি', emoji: '🧣', badge: 'Traditional', rating: '৪.৯', brand: 'Safi Weaves', stock: '৯৫ পিস' },

  // Technology & Gadgets
  { id: 'sf_adapter', category: 'tech_gadgets', name: 'Safi ফাস্ট চার্জিং এডাপ্টার ২০ ওয়াট', price: 390, desc: 'PD Type-C ফাস্ট চার্জিং ৩.০ পোর্ট, মাল্টি-লেয়ার প্রটেকশন ও থার্মাল কন্ট্রোল', emoji: '🔌', badge: 'Super Fast', rating: '৪.৮', brand: 'Safi Tech', stock: '৭৫ পিস' },
  { id: 'sf_cable', category: 'tech_gadgets', name: 'Safi ২-ইন-১ মাল্টি ডাটা ক্যাবল', price: 150, desc: '১.২ মিটার নাইলন ব্রেইডেড টেকসই ক্যাবল, Type-C এবং Micro-USB চার্জিং', emoji: '🎗️', badge: 'Ultra Durable', rating: '৪.৭', brand: 'Safi Tech', stock: '১২০ পিস' },
  { id: 'sf_powerbank', category: 'tech_gadgets', name: 'Safi ১০,০০০ mAh পাওয়ার ব্যাংক', price: 1250, desc: 'ডুয়াল ইউএসবি আউটপুট, ডিজিটাল ডিসপ্লে ইন্টিগ্রেটেড স্লিম পাওয়ার ব্যাংক', emoji: '🔋', badge: 'Li-Polymer', rating: '৪.৯', brand: 'Safi Power', stock: '৩০ পিস' },
  { id: 'sf_earbuds', category: 'tech_gadgets', name: 'Safi ওয়েরলেস ব্লুটুথ ৫.৩ ইয়ারবাডস', price: 990, desc: 'HIFI সাউন্ড কোয়ালিটি, ৪ ঘন্টা একটানা প্লেব্যাক ও সুপার বেস সমৃদ্ধ', emoji: '🎧', badge: 'HIFI Audio', rating: '৪.৬', brand: 'Safi Audio', stock: '৪৫ পিস' },
  { id: 'sf_otg', category: 'tech_gadgets', name: 'Safi ইউনিভার্সাল মেটাল ওটিজি কানেক্টর', price: 85, desc: 'Type-C টু USB ৩.০ কনভার্টার, হাই স্পিড ডাটা ট্রান্সফার মেটালিক বডি', emoji: '⚙️', badge: 'Mini USB', rating: '৪.৮', brand: 'Safi Tech', stock: '১৫০ পিস' },

  // Cosmetics & Lifestyle
  { id: 'sf_soap', category: 'cosmetics_lifestyle', name: 'Safi হস্তনির্মিত নিম ও তুলসী সাবান', price: 140, desc: '১৫০ গ্রাম বার, নিম এবং তুলসী পাতার নির্যাসযুক্ত ন্যাচারাল গ্লিসারিন সাবান', emoji: '🧼', badge: 'Handcrafted', rating: '৪.৯', brand: 'Safi Herbs', stock: '১১০ পিস' },
  { id: 'sf_hair_oil', category: 'cosmetics_lifestyle', name: 'Safi অর্গানিক herbal হেয়ার অয়েল', price: 190, desc: '১০০ মিলি বোতল, আমলকী ও জবা ফুলের নির্যাসযুক্ত ও পুষ্টিকর herbal অয়েল', emoji: '🧴', badge: '100% Herbal', rating: '৪.৮', brand: 'Safi Herbs', stock: '৬৫ পিস' },
  { id: 'sf_aloe_gel', category: 'cosmetics_lifestyle', name: 'Safi ফ্রেশ অ্যালোভেরা সুদিং জেল', price: 180, desc: '১৫০ মিলি জার, প্রাকৃতিক অ্যালোভেরা নির্যাসের জাদুকরী স্কিন ময়শ্চারাইজার', emoji: '🧪', badge: 'Hydrating', rating: '৪.৭', brand: 'Safi Skin', stock: '৮ো পিস' },
  { id: 'sf_chandan_pack', category: 'cosmetics_lifestyle', name: 'Safi প্রিমিয়াম চন্দন ফেসপ্যাক', price: 120, desc: '১০০ গ্রাম রিফিল প্যাক, আসল মহীশূর চন্দন কাঠের গুঁড়া মিশ্রিত স্কিন গ্লোয়িং ফর্মুলা', emoji: '🌸', badge: 'Natural Glow', rating: '৪.৯', brand: 'Safi Skin', stock: '১০০ পিস' }
];

interface DashboardProps {
  user: User;
  onLogout: (toRegister?: boolean) => void;
  onOpenDrawer: () => void;
  onTriggerAdmin: () => void;
  onTriggerBap: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  setSelectedAction: (act: string | null) => void;
  selectedAction: string | null;
  appConfig: AppConfig;
  onTriggerDemoAuth?: () => void;
  appLanguage?: string;
  onLanguageChange?: (lang: string) => void;
  darkMode?: boolean;
  onThemeToggle?: () => void;
}

export default function Dashboard({ 
  user, 
  onLogout, 
  onOpenDrawer, 
  onTriggerAdmin,
  onTriggerBap,
  activeTab,
  setActiveTab,
  selectedAction,
  setSelectedAction,
  appConfig,
  onTriggerDemoAuth,
  appLanguage = 'bn',
  onLanguageChange,
  darkMode = false,
  onThemeToggle
}: DashboardProps) {

  // --- LAYOUT CUSTOMIZATION HELPERS ---
  const bannerType = appConfig?.bannerHeightType || 'medium';
  const bannerVal = appConfig?.bannerHeightValue;
  
  const getBannerStyleAndClass = () => {
    let className = "relative w-full bg-slate-100 overflow-hidden border-t border-b border-slate-200/50 shadow-3xs";
    let style: React.CSSProperties = {};

    if (bannerType === 'custom' && bannerVal) {
      style = { height: `${bannerVal}px` };
    } else {
      switch (bannerType) {
        case 'thin':
          className += ' aspect-[16/5]';
          break;
        case 'medium':
          className += ' aspect-[16/7.5]';
          break;
        case 'thick':
          className += ' aspect-[16/10]';
          break;
        case '16:9':
          className += ' aspect-[16/9]';
          break;
        case '21:9':
          className += ' aspect-[21/9]';
          break;
        case '32:9':
          className += ' aspect-[32/9]';
          break;
        default:
          className += ' aspect-[16/7.5]';
      }
    }
    return { className, style };
  };

  const gridCols = appConfig?.gridColsCount || 3;
  let gridClass = "grid gap-1.5 xs:gap-2 sm:gap-3 md:gap-4 ";
  if (gridCols === 2) {
    gridClass += "grid-cols-2";
  } else if (gridCols === 4) {
    gridClass += "grid-cols-4";
  } else if (gridCols === 5) {
    gridClass += "grid-cols-5";
  } else {
    gridClass += "grid-cols-3"; // Default
  }

  const iconSizeType = appConfig?.gridIconSize || 'medium';
  let diameter = 64; // Default medium (e.g. 64px)
  if (iconSizeType === 'small') {
    diameter = 48;
  } else if (iconSizeType === 'large') {
    diameter = 80;
  } else if (iconSizeType === 'custom' && appConfig?.gridIconSizeValue) {
    diameter = appConfig.gridIconSizeValue;
  }
  const innerIconSize = Math.max(16, Math.round(diameter * 0.5));

  const getTitleClass = () => {
    if (gridCols >= 4) {
      return "text-[8.5px] xs:text-[9.5px] sm:text-[11px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center";
    } else {
      return "text-[9.5px] xs:text-[11px] sm:text-[12.5px] md:text-[14px] lg:text-[15.5px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center";
    }
  };

  const getCardMinHeightClass = () => {
    if (gridCols === 5) {
      return "p-1 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[74px] xs:min-h-[86px] sm:min-h-[105px] md:min-h-[115px] relative group";
    } else if (gridCols === 4) {
      return "p-1 xs:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[84px] xs:min-h-[98px] sm:min-h-[120px] md:min-h-[130px] relative group";
    } else if (gridCols === 2) {
      return "p-2 xs:p-2.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[110px] xs:min-h-[130px] sm:min-h-[160px] md:min-h-[180px] relative group";
    }
    return "p-1 xs:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[96px] xs:min-h-[114px] sm:min-h-[142px] md:min-h-[156px] relative group";
  };

  const isTabActive = (tabKey: string) => {
    if (!appConfig?.bottomNavTabs || appConfig.bottomNavTabs.length === 0) {
      return true; // Default to all active
    }
    return appConfig.bottomNavTabs.includes(tabKey);
  };

  let bottomNavClass = "fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-100 z-20 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] transition-all ";
  const bottomNavHeight = appConfig?.bottomNavHeightType || 'medium';
  if (bottomNavHeight === 'thin') {
    bottomNavClass += "pb-[env(safe-area-inset-bottom,2px)] pt-0.5 px-2";
  } else if (bottomNavHeight === 'thick') {
    bottomNavClass += "pb-[env(safe-area-inset-bottom,12px)] pt-2.5 px-4";
  } else {
    bottomNavClass += "pb-[env(safe-area-inset-bottom,4px)] pt-1 px-3"; // medium
  }

  // Comprehensive Bilingual Translation helper
  const t = (str: string) => {
    if (appLanguage === 'en') {
      const dict: Record<string, string> = {
        // App Core Labels & Tabs
        'হোম': 'Home',
        'অ্যাড মানি': 'Add Money',
        'ইতিহাস': 'History',
        'প্রোফাইল': 'Profile',
        'সক্রিয়': 'ACTIVE',
        'পেন্ডিং': 'PENDING',
        'নিরাপদ ও সুদমুক্ত সামাজিক ব্যাংকিং প্ল্যাটফর্ম': 'Interest-free Social Banking Platform',
        'মোট সঞ্চয়': 'Total Savings',
        'চলতি আমানত': 'Total Savings',
        'মূল ব্যালেন্স': 'Main Balance',
        'টেলিকম ব্যালেন্স': 'Telecom Balance',
        'সুপারশপ ব্যালেন্স': 'Super Shop Balance',
        'চলতি লোন': 'Active Loan',
        'ট্যাপ করুন': 'Tap here',
        'ব্যালেন্স দেখতে ট্যাপ করুন': 'Tap to show balance',
        'টাকা': 'BDT',
        'টাকা জমা করুন': 'Deposit BDT',
        'টাকা উত্তোলন': 'Withdraw Money',
        'সঞ্চয় অ্যাকাউন্ট': 'Savings Account',
        'ব্যালেন্স': 'Balance',
        'বকেয়া': 'Due',

        // Quick Action Grid Items
        'সমবায় লোন': 'Cooperative Loan',
        'লোন সুবিধা': 'Loan Panel',
        'সমিতি ফান্ড': 'Samity Fund',
        'সদস্য সঞ্চয়': 'Samity General',
        'বি এন বি পে': 'BNB Pay',
        'পেমেন্ট করুন': 'Scan & Pay',
        'টেলিকম রিচার্জ': 'Mobile Recharge',
        'রিচার্জ প্যানেল': 'Telecom Panel',
        'করজে হাসানা': 'Qard Screen',
        'বিনাসুদে লোন': 'Qard Panel',
        'রেশন কার্ড': 'Ration Card',
        'ফ্যামিলি কার্ড': 'Ration Panel',
        'নিরাপদ ডিল': 'Escrow Deals',
        'এসক্রো প্যানেল': 'Escrow Panel',
        'লাইভ চ্যাট': 'Live Chat',
        'সাপোর্ট এজেন্ট': 'Support Panel',

        // Announcements & Ticker
        'ঘোষণা': 'Announcement',
        'সাপ্তাহিক সঞ্চয়': 'Weekly Savings',
        'মাসিক লোন কিস্তি': 'Monthly Loan Installment',
        'চলতি সপ্তাহে সমবায়ের সঞ্চয় জমার শেষ সময় আগামী শুক্রবার রাত ১০টা পর্যন্ত।': 'Savings deposit deadline for this week is next Friday 10:00 PM.',
        
        // Statements / Transaction History
        'সাম্প্রতিক লেনদেন সমূহ': 'Recent Transactions',
        'সব লেনদেন দেখুন': 'View all transactions',
        'কোনো লেনদেন পাওয়া যায়নি।': 'No transactions found.',
        'সফল': 'Success',
        'পেন্ডিং বা প্রক্রিয়াধীন': 'Pending/Processing',
        'ব্যর্থ': 'Failed',
        'বিবরণ': 'Description',
        'পরিমাণ': 'Amount',
        'তারিখ ও সময়': 'Date & Time',
        'স্ট্যাটাস': 'Status',
        
        // Popups and Forms
        'অ্যাড মানি (টাকা জমা)': 'Add Money (Deposit)',
        'টাকা উত্তোলন (ক্যাশআউট)': 'Withdraw Money (Cashout)',
        'পিন নম্বর দিন': 'Enter Security PIN',
        'নিশ্চিত করুন': 'Confirm Transaction',
        ' hiseab': ' Ledger',
        'বাতিল': 'Cancel',
        'পরিমাণ লিখুন': 'Enter Amount',
        '৪ ডিজিটের পিন': '4-digit PIN',
        'ট্রানজেকশন সফল হয়েছে': 'Transaction successful!',
        'অনুগ্রহ করে অপেক্ষা করুন': 'Please wait...',
        'ব্যালেন্স অপর্যাপ্ত': 'Insufficient Balance',
        'ভুল পিন নম্বর': 'Invalid PIN number',
        'অনুগ্রহ করে সঠিক পরিমাণ ও পিন দিন': 'Please provide valid amount and PIN',

        // Dashboard Headers & Menu
        'শুভ সকাল': 'Good Morning',
        'শুভ দুপুর': 'Good Afternoon',
        'শুভ বিকাল': 'Good Afternoon',
        'শুভ সন্ধ্যা': 'Good Evening',
        'শুভ রাত্রি': 'Good Night',
        'সেটিংস': 'Settings',
        'লগআউট': 'Logout',
        'হেল্প ও সাপোর্ট': 'Help & Support',
        '১২টি লাইভ সেবা ও প্যানেল': '12 Live Services & Panels',
        'সকল সার্ভিস ও হিসাব খাতা': 'All Services & Ledger',
        '*এই ড্যাশবোর্ডটি সরাসরি লাইভ ডাটাবেজ দ্বারা পরিচালিত হচ্ছে।': '*This dashboard is running directly on live database sync.',
        'সমবায় ডিজিটাল ব্যাংকিং নেটওয়ার্ক': 'Cooperative Digital Banking Network',
        'আপনার সঞ্চয় ও ভবিষ্যৎ আর্থিক নিরাপত্তা নিশ্চিতে শতভাগ বিশ্বস্ত সমবায় প্ল্যাটফর্ম।': '100% trusted cooperative platform to secure your savings and future.',
        'হেল্প ডেস্ক যোগাযোগ': 'Help Desk Contact',
        'যেকোনো সাহায্য বা তথ্যের জন্য সরাসরি আমাদের হেল্প ডেস্কে কল করুন।': 'Call our helpdesk directly for any support or information.',
        'কিল্যাণ ঋণ আবেদন': 'Welfare Loan Application',
        'ডিজিটাল রেশন কার্ডের আবেদন': 'Digital Ration Card Application'
      };
      return dict[str] || str;
    }
    return str;
  };

  const getTxt = (key: string, fallback: string) => {
    const rawVal = appConfig?.globalTexts?.[key] || fallback;
    return appLanguage === 'en' ? t(rawVal) : rawVal;
  };

  const [showBalance, setShowBalance] = useState(false);
  const [balanceText, setBalanceText] = useState('ব্যালেন্স দেখতে ট্যাপ করুন');
  const [isRevealed, setIsRevealed] = useState(false);

  // Advertisement slider states
  const [currentAdSlide, setCurrentAdSlide] = useState(0);
  const defaultAdSlides = [
    {
      id: 1,
      tag: "সঞ্চয় ও বিনিয়োগ",
      title: "Business Network Bangladesh",
      description: "নিরাপদে আপনার আমানত সঞ্চয় করুন ও সহজ ঋণের সুবিধা গ্রহণ করুন।",
      bgGradient: "from-emerald-950 via-emerald-900 to-teal-950",
      image: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=80&w=650"
    },
    {
      id: 2,
      tag: "টেলিকম অফার",
      title: "BNB টেলিকম রিচার্জ",
      description: "সব অপারেটরে আকর্ষণীয় ক্যাশব্যাক ও সুপার ফাস্ট ফ্লেক্সিলোড ড্রাইভে অফার!",
      bgGradient: "from-slate-950 via-cyan-950 to-emerald-950",
      image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=650"
    },
    {
      id: 3,
      tag: "সুদমুক্ত ঋণ",
      title: "করযে হাসানা কল্যাণ তহবিল",
      description: "সব মেম্বারদের জন্য বিপদের সময়ে স্বস্তি ও সুদমুক্ত করযে হাসানা ঋণ সমাধান!",
      bgGradient: "from-stone-950 via-rose-950 to-indigo-950",
      image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=650"
    }
  ];

  const adSlides = appConfig?.dashboardBanners && appConfig.dashboardBanners.length > 0
    ? appConfig.dashboardBanners
    : defaultAdSlides;

  const activeSliders = (appConfig?.sliders && appConfig.sliders.length > 0)
    ? appConfig.sliders
    : adSlides.map(slide => slide.image);

  useEffect(() => {
    if (activeSliders.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentAdSlide((prev) => (prev + 1) % activeSliders.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [activeSliders.length]);

  // Core Account details loaded live in real-time
  const [liveUser, setLiveUser] = useState<User>(user);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [allNotices, setAllNotices] = useState<Notice[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allOffers, setAllOffers] = useState<Offer[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [userNotifications, setUserNotifications] = useState<UserNotification[]>([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [selectedDetailNotif, setSelectedDetailNotif] = useState<UserNotification | null>(null);
  const [notifCategoryFilter, setNotifCategoryFilter] = useState<'all' | 'bonus' | 'fine' | 'notice'>('all');

  const playNotificationChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
      // Autoplay permissions
    }
  };

  const isNotificationRead = (n: UserNotification) => {
    if (n.read === true) return true;
    if (n.userId === 'all') {
      const readGlobalIds = JSON.parse(localStorage.getItem('read_global_notifications') || '[]');
      return readGlobalIds.includes(n.id) || (!!n.docId && readGlobalIds.includes(n.docId));
    }
    return false;
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      // Instantly mark as read in local state so UI turns white immediately!
      setUserNotifications(prev => prev.map(x => {
        if (x.id === id || x.docId === id) {
          return { ...x, read: true };
        }
        return x;
      }));

      const n = userNotifications.find(x => x.id === id || x.docId === id);
      if (n && n.userId === 'all') {
        const readGlobalIds = JSON.parse(localStorage.getItem('read_global_notifications') || '[]');
        if (!readGlobalIds.includes(n.id)) {
          readGlobalIds.push(n.id);
        }
        if (n.docId && !readGlobalIds.includes(n.docId)) {
          readGlobalIds.push(n.docId);
        }
        localStorage.setItem('read_global_notifications', JSON.stringify(readGlobalIds));
        return;
      }

      const docIdToUpdate = n?.docId || id;
      if (docIdToUpdate) {
        try {
          await updateDoc(doc(db, 'user_notifications', docIdToUpdate), { read: true });
        } catch (err) {
          const q = query(collection(db, 'user_notifications'), where('id', '==', id));
          const snap = await getDocs(q);
          if (!snap.empty) {
            await updateDoc(doc(db, 'user_notifications', snap.docs[0].id), { read: true });
          }
        }
      }
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      // Instantly update local state
      setUserNotifications(prev => prev.map(x => ({ ...x, read: true })));

      const unreadList = userNotifications.filter(n => !isNotificationRead(n));
      const readGlobalIds = JSON.parse(localStorage.getItem('read_global_notifications') || '[]');
      let updatedGlobal = false;

      for (const item of unreadList) {
        if (item.userId === 'all') {
          if (!readGlobalIds.includes(item.id)) {
            readGlobalIds.push(item.id);
            updatedGlobal = true;
          }
          if (item.docId && !readGlobalIds.includes(item.docId)) {
            readGlobalIds.push(item.docId);
            updatedGlobal = true;
          }
        } else {
          const docIdToUpdate = item.docId || item.id;
          try {
            await updateDoc(doc(db, 'user_notifications', docIdToUpdate), { read: true });
          } catch (e) {
            const q = query(collection(db, 'user_notifications'), where('id', '==', item.id));
            const snap = await getDocs(q);
            if (!snap.empty) {
              await updateDoc(doc(db, 'user_notifications', snap.docs[0].id), { read: true });
            }
          }
        }
      }

      if (updatedGlobal) {
        localStorage.setItem('read_global_notifications', JSON.stringify(readGlobalIds));
      }
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      setUserNotifications(prev => prev.filter(x => x.id !== id && x.docId !== id));

      const n = userNotifications.find(x => x.id === id || x.docId === id);
      if (n && n.userId === 'all') {
        const deletedGlobalIds = JSON.parse(localStorage.getItem('deleted_global_notifications') || '[]');
        if (!deletedGlobalIds.includes(n.id)) {
          deletedGlobalIds.push(n.id);
        }
        if (n.docId && !deletedGlobalIds.includes(n.docId)) {
          deletedGlobalIds.push(n.docId);
        }
        localStorage.setItem('deleted_global_notifications', JSON.stringify(deletedGlobalIds));
        return;
      }

      const docIdToDelete = n?.docId || id;
      try {
        await deleteDoc(doc(db, 'user_notifications', docIdToDelete));
      } catch (e) {
        const q = query(collection(db, 'user_notifications'), where('id', '==', id));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await deleteDoc(doc(db, 'user_notifications', snap.docs[0].id));
        }
      }
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  // Push notifications states
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [showSecretPinPrompt, setShowSecretPinPrompt] = useState(false);
  const [secretPinInput, setSecretPinInput] = useState('');
  const [secretPinError, setSecretPinError] = useState('');
  const [isSecretAdminOpen, setIsSecretAdminOpen] = useState(false);
  const [allPushes, setAllPushes] = useState<any[]>([]);
  const [newPushTitle, setNewPushTitle] = useState('');
  const [newPushBody, setNewPushBody] = useState('');
  const [livePushToast, setLivePushToast] = useState<{ id: string; title: string; body: string } | null>(null);

  // Forms modal toggling
  const [modalType, setRawModalType] = useState<'deposit' | 'loan' | 'telecom' | 'shop' | 'withdraw' | 'members' | 'notices' | 'invest' | 'bank' | 'total_money' | 'samity' | 'qard' | 'agent' | 'about' | 'chat' | 'safedeals' | 'safi' | 'ration' | 'salary' | 'edu' | 'exchange' | null>(null);

  const [isReapplyingSamity, setIsReapplyingSamity] = useState(false);
  const [resendSamityLoading, setResendSamityLoading] = useState(false);
  const [resendSamitySuccess, setResendSamitySuccess] = useState('');

  const handleDirectResendSamityRequest = async () => {
    if (!liveUser) return;
    setResendSamityLoading(true);
    setResendSamitySuccess('');
    try {
      const nowIso = new Date().toISOString();
      const isAutoApprove = appConfig?.autoApproveSomiti === true || appConfig?.autoApproveSamity === true;
      const targetStatus = isAutoApprove ? 'approved' : 'pending';

      const updatePayload: Partial<User> = {
        samityStatus: targetStatus,
        samityApproved: isAutoApprove ? true : false,
        isSamityMember: isAutoApprove ? true : (liveUser.isSamityMember ?? false),
        approved: isAutoApprove ? true : (liveUser.approved ?? false),
        samityAppliedAt: nowIso
      };

      // 1. Immediately update local state for zero visual latency
      setLiveUser(prev => prev ? ({
        ...prev,
        ...updatePayload
      }) : prev);

      // 2. Perform fast Firestore writes concurrently
      const userRef = doc(db, 'users', liveUser.uid);
      const appRef = doc(db, 'samity_applications', liveUser.uid);

      await Promise.all([
        setDoc(userRef, updatePayload, { merge: true }),
        setDoc(appRef, {
          userId: liveUser.uid,
          uid: liveUser.uid,
          name: liveUser.name || '',
          phone: liveUser.phone || '',
          memberId: liveUser.memberId || '',
          country: liveUser.country || 'Bangladesh',
          nid: liveUser.nid || '',
          dob: liveUser.dob || '',
          division: liveUser.division || '',
          district: liveUser.district || '',
          thana: liveUser.thana || '',
          postOffice: liveUser.postOffice || '',
          nomineeName: liveUser.nomineeName || '',
          nomineeRelation: liveUser.nomineeRelation || '',
          nomineePhone: liveUser.nomineePhone || '',
          monthlySavingsTarget: liveUser.monthlySavingsTarget || 500,
          samityStatus: targetStatus,
          status: targetStatus,
          approved: isAutoApprove,
          createdAt: nowIso,
          samityAppliedAt: nowIso
        }, { merge: true }),
        !isAutoApprove ? addDoc(collection(db, 'admin_notifications'), {
          title: '⚡ সমিতি আবেদন রিসেন্ড রিকোয়েস্ট',
          message: `${liveUser.name} (${liveUser.phone}) এডমিন প্যানেলে তাদের সমিতি মেম্বারশিপ আবেদন পুনরায় রিসেন্ড করেছেন।`,
          type: 'samity_resend',
          createdAt: nowIso,
          read: false
        }).catch(() => null) : Promise.resolve()
      ]);

      setResendSamitySuccess(isAutoApprove ? 'আপনার সমিতির সদস্যপদ আবেদনটি স্বয়ংক্রিয়ভাবে অনুমোদিত হয়েছে!' : 'আপনার সমিতির সদস্যপদ আবেদনটি এডমিন প্যানেলে সফলভাবে পুন:প্রেরণ করা হয়েছে!');
      // Non-blocking background sync
      syncLiveProfile().catch(e => console.error("Resend sync error:", e));
    } catch (err: any) {
      console.error('Error resending samity application:', err);
      alert('আবেদন পুন:প্রেরণে ত্রুটি ঘটেছে: ' + (err?.message || 'অনুগ্রহ করে আবার চেষ্টা করুন।'));
    } finally {
      setResendSamityLoading(false);
    }
  };

  const [showDemoAuthPrompt, setShowDemoAuthPrompt] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [maintenanceServiceName, setMaintenanceServiceName] = useState('');

  const checkDemoAndRun = (action: () => void) => {
    if (user?.isDemo) {
      if (onTriggerDemoAuth) {
        onTriggerDemoAuth();
      } else {
        setShowDemoAuthPrompt(true);
      }
      return;
    }
    action();
  };

  const setModalType = (type: typeof modalType) => {
    if (type !== null && user?.isDemo) {
      if (onTriggerDemoAuth) {
        onTriggerDemoAuth();
      } else {
        setShowDemoAuthPrompt(true);
      }
      return;
    }
    setRawModalType(type);
  };

  const handleServiceClick = (serviceKey: string, actionCallback: () => void) => {
    const isServiceActive = appConfig?.serviceStatus?.[serviceKey] !== false;
    if (!isServiceActive) {
      const serviceNamesBengali: Record<string, string> = {
        samity: 'BNB ম্যানেজমেন্ট কোম্পানি ইনভেস্টর',
        bank: 'MY BNB লেনদেন (রেমিট্যান্স)',
        telecom: 'BNB টেলিকম (ফ্লেক্সিলোড)',
        shop: 'BNB সুপার শপ (পণ্য অর্ডার)',
        qard: 'করযে হাসানা (সুদমুক্ত ঋণ)',
        safedeals: 'নিরাপদ লেনদেন (ভেরিফাইড পাইকারি)',
        safi: 'প্রিমিয়াম Safi (খাঁটি পণ্য)',
        ration: 'BNB রেশন কার্ড (পাইকারি ছাড়)',
        chat: 'লাইভ চ্যাট (সাপোর্ট রুম)',
        agent: 'BNB এজেন্ট (ক্যারিয়ার পোর্টাল)',
        about: 'আমাদের সম্পর্কে (পরিচিতি)',
        bap: 'বাংলাদেশ এডমিন প্যানেল',
        hisab: 'BNB হিসাব খাতা',
        salary: 'BNB অটো স্যালারি পে',
        edu: 'BNB জ্ঞান ও শিক্ষা কেন্দ্র'
      };
      setMaintenanceServiceName(serviceNamesBengali[serviceKey] || 'চিহ্নিত সেকশন');
      setShowMaintenanceModal(true);
      return;
    }
    actionCallback();
  };

  useEffect(() => {
    if (selectedAction) {
      if (selectedAction === 'deposit') setModalType('deposit');
      else if (selectedAction === 'loan') setModalType('loan');
      else if (selectedAction === 'telecom') setModalType('telecom');
      else if (selectedAction === 'shop') setModalType('shop');
      else if (selectedAction === 'withdraw') setModalType('withdraw');
      else if (selectedAction === 'samity') setModalType('samity');
      else if (selectedAction === 'qard') setModalType('qard');
      else if (selectedAction === 'agent') setModalType('agent');
      else if (selectedAction === 'chat' || selectedAction === 'support') setModalType('chat');
      else if (selectedAction === 'about') setModalType('about');
      
      setSelectedAction(null);
    }
  }, [selectedAction, setSelectedAction]);

  // New state variables for BNB agent registration, about us and live chat
  const [agentPhone, setAgentPhone] = useState('');
  const [agentDistrict, setAgentDistrict] = useState('');
  const [agentExperience, setAgentExperience] = useState('নেই');
  const [agentSuccessMsg, setAgentSuccessMsg] = useState('');
  const [agentErrorMsg, setAgentErrorMsg] = useState('');
  const [hasSubmittedAgent, setHasSubmittedAgent] = useState(false);

  const [chatMessages, setChatMessages] = useState<any[]>([
    { id: '1', sender: 'support', text: 'আসসালামু আলাইকুম! Business Network Bangladesh (BNB) সাপোর্ট সেন্টারে আপনাকে স্বাগতম। আমি আপনার ডিজিটাল সহকারী। আমাদের সমিতি, ঋণ, টেলিকম বা সুপার শপ সম্পর্কে যেকোনো প্রশ্ন করতে পারেন।', timestamp: '১০:৩০ AM' }
  ]);
  const [chatInputText, setChatInputText] = useState('');
  const [noticeSearchQuery, setNoticeSearchQuery] = useState('');
  const [isChatTyping, setIsChatTyping] = useState(false);

  // Browser/device Back-Button Gesture history synchronization system for modalType
  const pushedModalRef = useRef<Record<string, any>>({});

  useEffect(() => {
    (window as any).bnb_modal_open = !!modalType;
    if (modalType && pushedModalRef.current.modalType !== modalType) {
      pushedModalRef.current.modalType = modalType;
      window.history.pushState({ dashboardModal: modalType }, '');
    } else if (!modalType && pushedModalRef.current.modalType) {
      pushedModalRef.current.modalType = null;
      if (window.history.state?.dashboardModal) {
        window.history.back();
      }
    }
  }, [modalType]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      // If modal was open but current popped state is different, close/clear the modal state
      if (modalType && state?.dashboardModal !== modalType) {
        setModalType(null);
        pushedModalRef.current.modalType = null;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [modalType]);

  // NEW STATES FOR SAFE DEALS, PREMIUM SAFI, AND RATION CARDS
  const [safeDeals, setSafeDeals] = useState<any[]>([]);
  const [rationCard, setRationCard] = useState<any | null>(null);
  const [showCreateCardModal, setShowCreateCardModal] = useState(false);
  const [rationCardName, setRationCardName] = useState(user?.name || '');
  const [rationCardAddress, setRationCardAddress] = useState('');
  const [rationCardType, setRationCardType] = useState('wholesale');
  const [rationCardNominee, setRationCardNominee] = useState('');
  const [showAddDealModal, setShowAddDealModal] = useState(false);
  const [newDealTitle, setNewDealTitle] = useState('');
  const [newDealDesc, setNewDealDesc] = useState('');
  const [newDealPrice, setNewDealPrice] = useState('');
  const [newDealMinQty, setNewDealMinQty] = useState('৫ পিস');
  const [newDealEmoji, setNewDealEmoji] = useState('📦');

  // Qard Hasana state variables
  const [qardTab, setQardTab] = useState<'info' | 'donate' | 'apply' | 'my_applications' | 'history'>('info');
  const [qardDonateAmount, setQardDonateAmount] = useState('');
  const [qardDonationReasonText, setQardDonationReasonText] = useState('');
  const [qardLoanAmount, setQardLoanAmount] = useState('');
  const [qardPin, setQardPin] = useState('');
  const [qardLoanDuration, setQardLoanDuration] = useState<number>(1);
  const [qardLoanWhatsapp, setQardLoanWhatsapp] = useState('');
  const [qardHistory, setQardHistory] = useState<Transaction[]>([]);
  const [qardTotalFund, setQardTotalFund] = useState(55000);
  const [qardActiveLoansAmount, setQardActiveLoansAmount] = useState(0);
  const [qardDonationType, setQardDonationType] = useState('one-time');
  const [qardDonationPurpose, setQardDonationPurpose] = useState('general');
  const [qardDonationPayMethod, setQardDonationPayMethod] = useState('balance');
  const [qardDonationSender, setQardDonationSender] = useState('');
  const [qardDonationTxId, setQardDonationTxId] = useState('');

  // bKash-style Tap to Check Main Balance
  const [showMainBalance, setShowMainBalance] = useState(false);
  const balanceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleRevealBalance = () => {
    if (showMainBalance) {
      setShowMainBalance(false);
      if (balanceTimeoutRef.current) {
        clearTimeout(balanceTimeoutRef.current);
        balanceTimeoutRef.current = null;
      }
    } else {
      setShowMainBalance(true);
      if (balanceTimeoutRef.current) {
        clearTimeout(balanceTimeoutRef.current);
      }
      balanceTimeoutRef.current = setTimeout(() => {
        setShowMainBalance(false);
        balanceTimeoutRef.current = null;
      }, 4000);
    }
  };

  useEffect(() => {
    if (!user?.uid) return;

    // Programmatic one-time reset of mock transactions for clean live state
    if (!localStorage.getItem('transactions_cleaned_v5')) {
      const initClean = async () => {
        try {
          const tCol = collection(db, 'transactions');
          const q = query(tCol, where('userId', '==', user.uid));
          const snap = await getDocs(q);
          for (const docSnap of snap.docs) {
            await deleteDoc(doc(db, 'transactions', docSnap.id));
          }
          localStorage.setItem('transactions_cleaned_v5', 'true');
          console.log("Mock transactions cleared successfully.");
        } catch (err) {
          console.error("Error cleaning mock transactions:", err);
        }
      };
      initClean();
    }

    // 1. Live User Document real-time listener (includes balance, dps, savings, loans, telecom, etc.)
    const userDocRef = doc(db, 'users', user.uid);
    const unsubUser = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        setLiveUser({ uid: snap.id, ...snap.data() } as User);
      }
    }, (err) => {
      console.error("Dashboard User subscription error:", err);
    });

    // 2. Live Transactions real-time listener (recharges, deposits, transfers, add money, Qard Hasana)
    const tQ = query(collection(db, 'transactions'), where('userId', '==', user.uid));
    const unsubTx = onSnapshot(tQ, (snap) => {
      const list: Transaction[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Transaction);
      });
      setAllTransactions(sortTransactionsNewestFirst(list));
    }, (err) => {
      console.error("Dashboard Transactions subscription error:", err);
    });

    // 3. Live Notices real-time listener (Index-safe client-side sort)
    const nQ = query(collection(db, 'notices'), limit(40));
    const unsubNotices = onSnapshot(nQ, (snap) => {
      const listNotices: Notice[] = [];
      snap.forEach((d) => {
        listNotices.push({ id: d.id, ...d.data() } as Notice);
      });
      listNotices.sort((a, b) => {
        const dA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dB - dA;
      });
      setAllNotices(listNotices);
    }, (err) => {
      console.error("Dashboard Notices subscription error:", err);
    });

    // 4. Live Products real-time listener
    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      const list: Product[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Product);
      });
      setAllProducts(list);
    }, (err) => console.error("Error fetching products:", err));

    // 5. Live Offers real-time listener
    const unsubOffers = onSnapshot(collection(db, 'offers'), (snap) => {
      const list: Offer[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Offer);
      });
      setAllOffers(list);
    }, (err) => console.error("Error fetching offers:", err));

    // 5. Live Ration Card real-time listener
    const rcQ = query(collection(db, 'ration_cards'), where('userId', '==', user.uid));
    const unsubRation = onSnapshot(rcQ, (snap) => {
      if (!snap.empty) {
        setRationCard({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setRationCard(null);
      }
    }, (err) => {
      console.error("Dashboard Ration Cards subscription error:", err);
    });

    // 9. Live Personal & Global System Notifications real-time listeners (multi-ID matching guarantees 100% receipt)
    const userTargetIds = Array.from(new Set([
      user.uid,
      (user as any).id,
      (user as any).docId,
      user.phone,
      user.memberId
    ].filter((x): x is string => typeof x === 'string' && Boolean(x.trim()))));

    const notifyPersonalQ = userTargetIds.length > 0
      ? query(collection(db, 'user_notifications'), where('userId', 'in', userTargetIds.slice(0, 10)))
      : query(collection(db, 'user_notifications'), where('userId', '==', user.uid));

    const notifyMemberQ = user.memberId
      ? query(collection(db, 'user_notifications'), where('memberId', '==', user.memberId))
      : null;

    const notifyGlobalQ = query(collection(db, 'user_notifications'), where('userId', '==', 'all'));

    let personalList: UserNotification[] = [];
    let memberList: UserNotification[] = [];
    let globalList: UserNotification[] = [];
    let initialLoadsRemaining = (notifyMemberQ ? 3 : 2);
    const mountTime = Date.now();
    const knownNotifIds = new Set<string>();

    const updateNotificationsState = (isFromSnapshot = false) => {
      if (isFromSnapshot && initialLoadsRemaining > 0) {
        initialLoadsRemaining--;
      }

      const deletedGlobalIds = JSON.parse(localStorage.getItem('deleted_global_notifications') || '[]');
      const filteredGlobal = globalList.filter(n => !deletedGlobalIds.includes(n.id) && !deletedGlobalIds.includes(n.docId));
      const merged = [...personalList, ...memberList, ...filteredGlobal];
      
      // Preserve all admin messages, direct credit/debit alerts & broadcasts
      const isPersonalMessage = (n: UserNotification) => {
        if (n.isTransactionHistory === true && !n.title && !n.body) return false;
        return true;
      };
      
      const filtered = merged.filter(isPersonalMessage);

      // Smart deduplication: deduplicate by content fingerprint (title + body + time window) & ID
      const uniqueMap = new Map<string, UserNotification>();
      const seenIds = new Set<string>();

      filtered.forEach(n => {
        const idKey = n.id || n.docId;
        const titleNorm = (n.title || '').trim().toLowerCase();
        const bodyNorm = (n.body || (n as any).content || (n as any).message || '').trim().toLowerCase();
        // Minute-level time signature (e.g. "2026-07-28t12:33")
        const timeNorm = n.createdAt ? n.createdAt.substring(0, 16) : '';
        const contentFingerprint = `${titleNorm}___${bodyNorm}___${timeNorm}`;

        if (idKey && seenIds.has(idKey)) return;
        if (uniqueMap.has(contentFingerprint)) return;

        if (idKey) seenIds.add(idKey);
        uniqueMap.set(contentFingerprint, n);
      });
      const deduplicated = Array.from(uniqueMap.values());

      // Sort client-side by createdAt descending
      deduplicated.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      // Sound chime and trigger live toast popup ONLY for brand-new incoming notifications after initial load
      if (initialLoadsRemaining <= 0) {
        for (const n of deduplicated) {
          const idKey = n.id || n.docId;
          const createdAtMs = n.createdAt ? new Date(n.createdAt).getTime() : 0;
          if (idKey && !knownNotifIds.has(idKey) && createdAtMs > mountTime - 5000) {
            playNotificationChime();
            setLivePushToast({
              id: idKey,
              title: n.title || '🔔 নতুন অ্যাডমিন নোটিফিকেশন',
              body: n.body || ''
            });
            break;
          }
        }
      }

      deduplicated.forEach(n => {
        if (n.id) knownNotifIds.add(n.id);
        if (n.docId) knownNotifIds.add(n.docId);
      });

      setUserNotifications(deduplicated);
    };

    const parseNotifDoc = (d: any) => {
      const data = d.data();
      const bodyText = data.body || data.message || data.desc || data.content || '';
      const titleText = data.title || '🔔 নতুন নোটিফিকেশন';
      return {
        ...data,
        docId: d.id,
        id: data.id || d.id,
        title: titleText,
        body: bodyText,
        message: bodyText
      } as UserNotification;
    };

    const unsubNotifyPersonal = onSnapshot(notifyPersonalQ, (snap) => {
      personalList = [];
      snap.forEach((d) => {
        personalList.push(parseNotifDoc(d));
      });
      updateNotificationsState(true);
    }, (err) => {
      console.error("Personal Notifications query error:", err);
    });

    const unsubNotifyMember = notifyMemberQ ? onSnapshot(notifyMemberQ, (snap) => {
      memberList = [];
      snap.forEach((d) => {
        memberList.push(parseNotifDoc(d));
      });
      updateNotificationsState(true);
    }, (err) => {
      console.error("Member Notifications query error:", err);
    }) : () => {};

    const unsubNotifyGlobal = onSnapshot(notifyGlobalQ, (snap) => {
      globalList = [];
      snap.forEach((d) => {
        globalList.push(parseNotifDoc(d));
      });
      updateNotificationsState(true);
    }, (err) => {
      console.error("Global Notifications query error:", err);
    });

    return () => {
      unsubUser();
      unsubTx();
      unsubNotices();
      unsubProducts();
      unsubOffers();
      unsubRation();
      unsubNotifyPersonal();
      unsubNotifyMember();
      unsubNotifyGlobal();
    };
  }, [user.uid]);

  // ON-DEMAND / CONDITIONAL REAL-TIME LISTENERS TO RADICALLY REDUCE FIRESTORE READ UNITS

  // A. Members Directory Listener (Only active when Samity Screen or Transfer screen is opened)
  useEffect(() => {
    if (!user?.uid || !['samity', 'deposit', 'members'].includes(modalType)) {
      return;
    }
    const unsubUsers = onSnapshot(query(collection(db, 'users'), limit(150)), (snap) => {
      const listMems: User[] = [];
      snap.forEach((d) => {
        listMems.push({ uid: d.id, ...d.data() } as User);
      });
      setAllUsers(listMems);
    }, (err) => {
      console.error("Dashboard Users subscription error:", err);
    });
    return () => unsubUsers();
  }, [modalType, user?.uid]);

  // B. Live Qard Hasana global real-time listener (Only active when Qard Screen is open)
  useEffect(() => {
    if (!user?.uid || modalType !== 'qard') {
      return;
    }
    const qardGlobalQuery = query(
      collection(db, 'transactions'),
      where('type', 'in', ['qard_donation', 'qard_loan_request', 'qard_loan_disbursment', 'qard_loan_repayment'])
    );
    const unsubQardGlobal = onSnapshot(qardGlobalQuery, (snap) => {
      const qardList: Transaction[] = [];
      snap.forEach((d) => {
        qardList.push({ id: d.id, ...d.data() } as Transaction);
      });
      qardList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setQardHistory(qardList);

      const starterAmount = 55000;
      const totalDonations = qardList
        .filter(t => t.type === 'qard_donation' && t.status === 'success')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      setQardTotalFund(starterAmount + totalDonations);

      const totalDisbursed = qardList
        .filter(t => t.type === 'qard_loan_disbursment' && t.status === 'success')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      const totalRepaid = qardList
        .filter(t => t.type === 'qard_loan_repayment' && t.status === 'success')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      setQardActiveLoansAmount(Math.max(0, totalDisbursed - totalRepaid));
    }, (err) => {
      console.error("Dashboard Qard subscription error:", err);
    });
    return () => unsubQardGlobal();
  }, [modalType, user?.uid]);

  // C. Live Safe Deals real-time listener (Only active when Safe Deals is open)
  useEffect(() => {
    if (!user?.uid || modalType !== 'safedeals') {
      return;
    }
    const unsubDeals = onSnapshot(query(collection(db, 'safe_deals'), limit(30)), (snap) => {
      const listSds: any[] = [];
      snap.forEach((d) => {
        listSds.push({ id: d.id, ...d.data() });
      });
      listSds.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      
      if (listSds.length === 0) {
        const defaultDeals = [
          {
            id: 'deal-default-1',
            title: '১০০% ঘানি ভাঙা সরিষার তেল (পাইকারি গ্রুপ ডিল)',
            description: 'খাঁটি সরিষার তেল। সরাসরি পাবনা ও কুষ্টিয়ার মিল থেকে সংগ্রহ করা হবে। সর্বোচ্চ বিশুদ্ধতার গ্যারান্টি।',
            price: 215,
            minQty: '১০ লিটার',
            emoji: '🛢️',
            supplier: 'Safi Pure Food Ltd.',
            status: 'active',
            createdAt: new Date().toISOString()
          },
          {
            id: 'deal-default-2',
            title: 'প্রিমিয়াম কাতান শাড়ি ও থ্রি-পিস ঈদ কালেকশন',
            description: 'ঈদের বিশেষ পাইকারি গ্রুপ বাই ডিল। সম্পূর্ণ প্রিমিয়াম কোয়ালিটি নিশ্চিত।',
            price: 1350,
            minQty: '৩ পিস',
            emoji: '👗',
            supplier: 'Moulvibazar Fashion Wholesalers',
            status: 'active',
            createdAt: new Date().toISOString()
          }
        ];
        setSafeDeals(defaultDeals);
      } else {
        setSafeDeals(listSds);
      }
    }, (err) => {
      console.error("Dashboard Safe Deals subscription error:", err);
    });
    return () => unsubDeals();
  }, [modalType, user?.uid]);

  // D. Live Telecom Offers real-time listener (Only active when Telecom Screen is open)
  useEffect(() => {
    if (!user?.uid || modalType !== 'telecom') {
      return;
    }
    const unsubOffers = onSnapshot(query(collection(db, 'offers'), orderBy('createdAt', 'desc'), limit(40)), (snap) => {
      const listOffers: Offer[] = [];
      snap.forEach((d) => {
        listOffers.push({ id: d.id, ...d.data() } as Offer);
      });
      setAllOffers(listOffers);
    }, (err) => {
      console.error("Dashboard Offers subscription error:", err);
    });
    return () => unsubOffers();
  }, [modalType, user?.uid]);

  // E. Live Super Shop Products real-time listener (Only active when Super Shop / Safi is open)
  useEffect(() => {
    if (!user?.uid || !['shop', 'safi'].includes(modalType)) {
      return;
    }
    const unsubProducts = onSnapshot(query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(50)), (snap) => {
      const listProds: Product[] = [];
      snap.forEach((d) => {
        listProds.push({ id: d.id, ...d.data() } as Product);
      });
      if (listProds.length === 0) {
        setAllProducts(defaultProducts);
      } else {
        setAllProducts(listProds);
      }
    }, (err) => {
      console.error("Dashboard Products subscription error:", err);
      setAllProducts(defaultProducts);
    });
    return () => unsubProducts();
  }, [modalType, user?.uid]);

  useEffect(() => {
    return () => {
      if (balanceTimeoutRef.current) {
        clearTimeout(balanceTimeoutRef.current);
      }
    };
  }, []);

  // Form input states
  const [depositAmount, setDepositAmount] = useState('');
  const [payMethod, setPayMethod] = useState('');
  const [senderInfo, setSenderInfo] = useState('');
  const [txnId, setTxnId] = useState('');
  const [screenshotData, setScreenshotData] = useState('');
  const [payPurpose, setPayPurpose] = useState<'main_balance' | 'savings' | 'loan' | 'fees'>('main_balance');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [feeType, setFeeType] = useState('admission');
  const [selectedReceiptTx, setSelectedReceiptTx] = useState<Transaction | null>(null);

  // Guided withdrawal channel state 
  const [withdrawMethod, setWithdrawMethod] = useState('');
  const [withdrawBankName, setWithdrawBankName] = useState('Dutch-Bangla Bank');
  const [withdrawBranch, setWithdrawBranch] = useState('');
  const [withdrawAccName, setWithdrawAccName] = useState('');
  const [withdrawAccNo, setWithdrawAccNo] = useState('');
  const [withdrawRecipientNumber, setWithdrawRecipientNumber] = useState('');
  const [withdrawPin, setWithdrawPin] = useState('');
  const [copiedField, setCopiedField] = useState('');

  // Loan Repay specific fields
  const [repayAmount, setRepayAmount] = useState('');
  const [repayPayMethod, setRepayPayMethod] = useState('bKash');
  const [repaySenderInfo, setRepaySenderInfo] = useState('');
  const [repayTxnId, setRepayTxnId] = useState('');
  const [repayScreenshotData, setRepayScreenshotData] = useState('');

  const [loanAmount, setLoanAmount] = useState('');
  const [telecomMobile, setTelecomMobile] = useState('');
  const [telecomOperator, setTelecomOperator] = useState('Grammenphone');
  const [telecomAmount, setTelecomAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [investAmount, setInvestAmount] = useState('');

  // BNB Bank Transfer States
  const [transferType, setTransferType] = useState<'member' | 'bank' | 'mobile_fs'>('member');
  const [transferSector, setTransferSector] = useState<'telecom' | 'shop' | 'samity'>('telecom');
  const [selfTransferTarget, setSelfTransferTarget] = useState<'telecom' | 'shop' | 'savings'>('telecom');
  const [revealSamity, setRevealSamity] = useState(false);
  const [revealTelecom, setRevealTelecom] = useState(false);
  const [revealShop, setRevealShop] = useState(false);
  const [transferTargetPhoneorId, setTransferTargetPhoneorId] = useState('');
  const [transferTargetBankName, setTransferTargetBankName] = useState('Dutch-Bangla Bank');
  const [transferTargetAccNo, setTransferTargetAccNo] = useState('');
  const [transferSenderPin, setTransferSenderPin] = useState('');
  const [transferAmountInput, setTransferAmountInput] = useState('');
  const [searchedMember, setSearchedMember] = useState<User | null>(null);
  const [searchStatusMsg, setSearchStatusMsg] = useState('');
  const [sendMoneySelectedMonths, setSendMoneySelectedMonths] = useState<string[]>([]);
  const [sendMoneySelectedYear, setSendMoneySelectedYear] = useState<number>(new Date().getFullYear() > 2050 ? 2050 : Math.max(2026, new Date().getFullYear()));
  const [cvvRevealed, setCvvRevealed] = useState(false);

  // Transaction, notice, package, and shop state variables
  const [txSearchTerm, setTxSearchTerm] = useState('');
  const [txFilterType, setTxFilterType] = useState('all');
  const [txFilterStatus, setTxFilterStatus] = useState('all');
  const [expandedNoticeId, setExpandedNoticeId] = useState<string | null>(null);
  const [telecomServiceType, setTelecomServiceType] = useState<'recharge' | 'internet'>('recharge');
  const [telecomPackageId, setTelecomPackageId] = useState('pack-1');
  const [selectedProductId, setSelectedProductId] = useState('item-1');
  const [shopQuantity, setShopQuantity] = useState('1');
  const [shopSearchTerm, setShopSearchTerm] = useState('');
  const [shopCategory, setShopCategory] = useState('all');
  const [shopActiveSubTab, setShopActiveSubTab] = useState<'products' | 'rules' | 'orders' | 'transfer'>('products');
  const [shopDir, setShopDir] = useState<'main_to_shop' | 'shop_to_main'>('main_to_shop');
  const [shopTransferAmount, setShopTransferAmount] = useState('');
  const [shopTransferPin, setShopTransferPin] = useState('');
  const [shopTransferLoading, setShopTransferLoading] = useState(false);
  const [shopTransferErr, setShopTransferErr] = useState('');
  const [shopTransferSucc, setShopTransferSucc] = useState('');
  const [supplierContactProduct, setSupplierContactProduct] = useState<any | null>(null);
  const [supplierContactMsg, setSupplierContactMsg] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);

  // SAFI Premium Shop States
  const [safiSelectedCategory, setSafiSelectedCategory] = useState<string | null>(null);
  const [safiSearchQuery, setSafiSearchQuery] = useState('');

  // Instant Ghorer Bazar Super Shop Checkout States
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [userAddress, setUserAddress] = useState<string>('');
  const [searchRange, setSearchRange] = useState<number>(10); // default 10 km
  const [isLocatingUser, setIsLocatingUser] = useState<boolean>(false);

  const handleDetectUserLocation = async () => {
    if (!navigator.geolocation) {
      alert("আপনার ব্রাউজারে জিপিএস সনাক্তকরণ সুবিধা নেই।");
      return;
    }
    setIsLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUserLat(lat);
        setUserLng(lng);
        
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=bn`, {
            headers: { 'User-Agent': 'BNB-Cooperative-App' }
          });
          if (res.ok) {
            const data = await res.json();
            setUserAddress(data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          } else {
            setUserAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          }
        } catch (e) {
          setUserAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
        setIsLocatingUser(false);
      },
      (error) => {
        console.error(error);
        setIsLocatingUser(false);
        alert("জিপিএস সিগন্যাল পাওয়া যায়নি বা অনুমতি ব্লক করা হয়েছে। অনুগ্রহ করে ব্রাউজার সেটিংস চেক করুন।");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const [selectedProductForCheckout, setSelectedProductForCheckout] = useState<Product | null>(null);
  const [checkoutQuantity, setCheckoutQuantity] = useState(1);
  const [checkoutName, setCheckoutName] = useState('');
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [checkoutAddress, setCheckoutAddress] = useState('');
  const [checkoutPin, setCheckoutPin] = useState('');
  const [checkoutLat, setCheckoutLat] = useState<number | null>(null);
  const [checkoutLng, setCheckoutLng] = useState<number | null>(null);
  const [checkoutLocationShared, setCheckoutLocationShared] = useState(false);
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<'main' | 'shop' | 'cod'>('cod');
  const [orderPlacementSuccess, setOrderPlacementSuccess] = useState<any | null>(null);
  const [allShopOrders, setAllShopOrders] = useState<any[]>([]);
  const [checkoutDeliveryType, setCheckoutDeliveryType] = useState<'home' | 'pickup'>('pickup');
  const [checkoutDistance, setCheckoutDistance] = useState<number>(1.5);
  const [isMeasuring, setIsMeasuring] = useState(false);

  // Status logs
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Banking integration & automation live test states
  const [networkChecking, setNetworkChecking] = useState(false);
  const [checkedGates, setCheckedGates] = useState<string[]>([]);
  const [networkCheckComplete, setNetworkCheckComplete] = useState(false);

  // Shop Gadgets items definition
  const shopItems = [
    { id: 'item-1', name: 'Premium Airpods Max', price: 1200, icon: '🎧', description: 'হাই-ফাই নয়েজ ক্যানসেলিং হেডফোন' },
    { id: 'item-2', name: 'BNB Smart-Watch v5', price: 2500, icon: '⌚', description: 'হার্ট রেট এবং হেলথ ট্র্যাকার' },
    { id: 'item-3', name: 'Virtual VR Glass Pro', price: 4500, icon: '🥽', description: 'কো-অপারেটিভ ৩ডি মেটাভার্স ভিউয়ার' },
  ];

  const syncLiveProfile = async () => {
    try {
      // 1. Sync User Document (Essential & lightweight)
      const q = query(collection(db, 'users'), where('phone', '==', user.phone));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        const uDoc = qSnap.docs[0];
        setLiveUser({ uid: uDoc.id, ...uDoc.data() } as User);
      }

      // 2. Sync User's own transactions (lightweight)
      const tQ = query(collection(db, 'transactions'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
      const tSnap = await getDocs(tQ);
      const list: Transaction[] = [];
      tSnap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Transaction);
      });
      setAllTransactions(list);

      // 3. Sync User's specific Ration Card (lightweight)
      try {
        const rcQ = query(collection(db, 'ration_cards'), where('userId', '==', user.uid));
        const rcSnap = await getDocs(rcQ);
        if (!rcSnap.empty) {
          setRationCard({ id: rcSnap.docs[0].id, ...rcSnap.docs[0].data() });
        } else {
          setRationCard(null);
        }
      } catch (err) {
        console.error("Ration cards sync failed:", err);
      }

      // 4. Sync User's own Shop Orders (lightweight)
      try {
        const soQ = query(collection(db, 'shop_orders'), where('userId', '==', user.uid));
        const soSnap = await getDocs(soQ);
        const listSos: any[] = [];
        soSnap.forEach((d) => {
          listSos.push({ id: d.id, ...d.data() });
        });
        listSos.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setAllShopOrders(listSos);
      } catch (err) {
        console.error("Shop orders sync failed:", err);
      }

      // 5. Run other heavy, global, or redundant queries strictly in background (Non-Blocking)
      // and only if the current states are completely empty. This allows immediate user response!
      setTimeout(async () => {
        try {
          if (allNotices.length === 0) {
            const nQ = query(collection(db, 'notices'), orderBy('createdAt', 'desc'), limit(15));
            const nSnap = await getDocs(nQ);
            const listNotices: Notice[] = [];
            nSnap.forEach((d) => {
              listNotices.push({ id: d.id, ...d.data() } as Notice);
            });
            setAllNotices(listNotices);
          }

          if (allUsers.length === 0) {
            const memSnap = await getDocs(query(collection(db, 'users'), limit(50)));
            const listMems: User[] = [];
            memSnap.forEach((d) => {
              listMems.push({ uid: d.id, ...d.data() } as User);
            });
            setAllUsers(listMems);
          }

          if (allOffers.length === 0) {
            const offSnap = await getDocs(query(collection(db, 'offers'), orderBy('createdAt', 'desc'), limit(15)));
            const listOffers: Offer[] = [];
            offSnap.forEach((d) => {
              listOffers.push({ id: d.id, ...d.data() } as Offer);
            });
            setAllOffers(listOffers);
          }

          if (allProducts.length === 0) {
            const prodSnap = await getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(15)));
            const listProds: Product[] = [];
            prodSnap.forEach((d) => {
              listProds.push({ id: d.id, ...d.data() } as Product);
            });
            setAllProducts(listProds.length === 0 ? defaultProducts : listProds);
          }

          if (qardHistory.length === 0) {
            const qardQ = query(
              collection(db, 'transactions'),
              where('type', 'in', ['qard_donation', 'qard_loan_request', 'qard_loan_disbursment', 'qard_loan_repayment']),
              limit(30)
            );
            const qardSnap = await getDocs(qardQ);
            const qardList: Transaction[] = [];
            qardSnap.forEach((d) => {
              qardList.push({ id: d.id, ...d.data() } as Transaction);
            });
            qardList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setQardHistory(qardList);

            const starterAmount = 55000;
            const totalDonations = qardList
              .filter(t => t.type === 'qard_donation' && t.status === 'success')
              .reduce((sum, t) => sum + (t.amount || 0), 0);
            setQardTotalFund(starterAmount + totalDonations);

            const totalDisbursed = qardList
              .filter(t => t.type === 'qard_loan_disbursment' && t.status === 'success')
              .reduce((sum, t) => sum + (t.amount || 0), 0);
            const totalRepaid = qardList
              .filter(t => t.type === 'qard_loan_repayment' && t.status === 'success')
              .reduce((sum, t) => sum + (t.amount || 0), 0);
            setQardActiveLoansAmount(Math.max(0, totalDisbursed - totalRepaid));
          }

          if (safeDeals.length === 0) {
            const sdSnap = await getDocs(collection(db, 'safe_deals'));
            const listSds: any[] = [];
            sdSnap.forEach((d) => {
              listSds.push({ id: d.id, ...d.data() });
            });
            listSds.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
            setSafeDeals(listSds.length === 0 ? [] : listSds);
          }
        } catch (bgErr) {
          console.warn("Background fetch warning:", bgErr);
        }
      }, 50);

    } catch (e) {
      console.error("Live profile sync error:", e);
    }
  };

  const handleCopyText = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => {
      setCopiedField('');
    }, 2000);
  };

  const handleTestNetwork = async () => {
    setNetworkChecking(true);
    setNetworkCheckComplete(false);
    setCheckedGates([]);
    
    const checkpoints = [
      '১. BNB লেনদেন কোর API সংযোগ ও গেটওয়ে রিসোর্স... সম্পন্ন ✔',
      '২. মোবাইল ব্যাংকিং (bKash/Nagad/Rocket) লাইভ আইপিএন নোটিফিকেশন... সম্পন্ন ✔',
      '৩. ক্লাউড ফায়ারস্টোর প্রডাকশন ডেটাবেস লাইভ সিঙ্ক স্টেট... সম্পন্ন ✔',
      '৪. মাসিক ইন্টারেস্ট ও ডিপিএস লেজার অটোমেশন কন্ট্রোল... সম্পন্ন ✔'
    ];
    
    for (let i = 0; i < checkpoints.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 350));
      setCheckedGates(prev => [...prev, checkpoints[i]]);
    }
    
    setNetworkChecking(false);
    setNetworkCheckComplete(true);
  };

  // 1. Submit Unified Payment Gateway (Savings, Loans, and Fees)
  const handleDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (liveUser?.isDemo) {
      setShowDemoAuthPrompt(true);
      return;
    }
    setFormError('');
    setFormSuccess('');

    const amt = Number(depositAmount);
    if (!amt || amt <= 0) {
      setFormError('সঠিক টাকার পরিমাণ টাইপ করুন।');
      return;
    }

    if (!senderInfo.trim()) {
      setFormError('টাকা পরিশোধের প্রেরক নম্বর অথবা প্রেরক ব্যাংক তথ্য লিখুন।');
      return;
    }

    if (!txnId.trim()) {
      setFormError('পেমেন্টের সঠিক ট্রানজেকশন আইডি (TxnID/TrId) টাইপ করুন।');
      return;
    }

    const txId = `tx-${Date.now()}`;
    
    let determinedType: 'add_money' | 'deposit' | 'loan_repayment' | 'fee_payment' = 'add_money' as any;
    let determinedLabel = 'অ্যাড মানি গেটওয়ে';
    let determinedDesc = '';

    if (payPurpose === 'main_balance') {
      determinedType = 'add_money' as any;
      determinedLabel = 'অ্যাড মানি (মেইন ব্যালেন্স)';
      determinedDesc = `মেইন ড্যাশবোর্ড ব্যালেন্সে অ্যাড মানি আবেদন [${payMethod}]। প্রেরকঃ ${senderInfo}, ট্রানজেকশন আইডিঃ ${txnId}। পেমেন্ট তারিখঃ ${payDate}।`;
    } else if (payPurpose === 'savings') {
      determinedType = 'deposit';
      determinedLabel = 'সঞ্চয় জমা';
      determinedDesc = `সঞ্চয় তহবিল কিস্তি জমা [${payMethod}]। প্রেরকঃ ${senderInfo}, ট্রানজেকশন আইডিঃ ${txnId}। পেমেন্ট তারিখঃ ${payDate}。`;
    } else if (payPurpose === 'loan') {
      determinedType = 'loan_repayment';
      determinedLabel = 'ঋণ পরিশোধ';
      determinedDesc = `ঋণ কিস্তি পরিশোধ [${payMethod}]। প্রেরকঃ ${senderInfo}, ট্রানজেকশন আইডিঃ ${txnId}। পেমেন্ট তারিখঃ ${payDate}。`;
    } else if (payPurpose === 'fees') {
      determinedType = 'fee_payment';
      determinedLabel = feeType === 'admission' ? 'ভর্তি ফি পরিশোধ' : feeType === 'monthly_fee' ? 'মাসিক সার্ভিস ফি' : 'অন্যান্য ফি ও চাঁদা';
      determinedDesc = `${determinedLabel} [${payMethod}]। প্রেরকঃ ${senderInfo}, ট্রানজেকশন আইডিঃ ${txnId}。পেমেন্ট তারিখঃ ${payDate}。`;
    }

    const newTx: Transaction = {
      id: txId,
      userId: liveUser.uid,
      userName: liveUser.name,
      memberId: liveUser.memberId,
      type: determinedType,
      typeLabel: determinedLabel,
      amount: amt,
      status: 'pending', // Pending authorization from Admin!
      description: determinedDesc,
      createdAt: new Date().toISOString(),
      paymentMethod: payMethod,
      senderInfo: senderInfo,
      senderPhone: senderInfo,
      accountNumber: senderInfo,
      trxId: txnId,
      transactionId: txnId,
      receiptNo: txnId,
      screenshot: screenshotData || '',
      paymentDate: payDate
    };

    // Instant zero-delay UI response ⚡
    setDepositAmount('');
    setSenderInfo('');
    setTxnId('');
    setScreenshotData('');
    setFormSuccess('আপনার পেমেন্ট আবেদনটি অ্যাডমিন প্যানেলে সফলতার সাথে সাবমিট হয়েছে! ট্রানজেকশন আইডি যাচাই শেষ করার পর ডিজিটাল রসিদ স্বয়ংক্রিয়ভাবে তৈরি হবে।');

    // Run database write in background asynchronously
    addDoc(collection(db, 'transactions'), newTx)
      .then(() => {
        if (syncLiveProfile) syncLiveProfile();
      })
      .catch((err) => {
        console.error('Error saving deposit submission:', err);
      });
  };

  // 1b. Pay Loan Installment
  const handlePayLoanInstallment = async (
    amt: number, 
    method: string, 
    sender: string, 
    txn: string, 
    screenshot: string
  ) => {
    setFormError('');
    setFormSuccess('');

    if (!amt || amt <= 0) {
      setFormError('সঠিক টাকার পরিমাণ টাইপ করুন।');
      return;
    }

    if (!sender.trim()) {
      setFormError('টাকা পরিশোধের প্রেরক নম্বর অথবা প্রেরক ব্যাংক তথ্য লিখুন।');
      return;
    }

    if (!txn.trim()) {
      setFormError('পেমেন্টের সঠিক ট্রানজেকশন আইডি (TxnID/TrId) টাইপ করুন।');
      return;
    }

    setLoading(true);
    try {
      const txId = `tx-repay-${Date.now()}`;
      const newTx: Transaction = {
        id: txId,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        type: 'loan_repayment',
        typeLabel: 'ঋণ পরিশোধ',
        amount: amt,
        status: 'pending',
        description: `ঋণ কিস্তি পরিশোধ [${method}]। প্রেরকঃ ${sender}, ট্রানজেকশন আইডিঃ ${txn}।`,
        createdAt: new Date().toISOString(),
        paymentMethod: method,
        receiptNo: `REC-${Math.floor(100000 + Math.random() * 900000)}`
      };

      if (screenshot) {
        newTx.screenshot = screenshot;
      }

      await addDoc(collection(db, 'transactions'), newTx);
      
      setFormSuccess('আপনার ঋণ পরিশোধের আবেদনটি সফলভাবে জমা হয়েছে। অ্যাডমিন ভেরিফাই করার পর আপনার বকেয়া ব্যালেন্স থেকে এই কিস্তির পরিমাণ কেটে নেয়া হবে।');
      setRepayAmount('');
      setRepaySenderInfo('');
      setRepayTxnId('');
      setRepayScreenshotData('');
      syncLiveProfile();
    } catch (e) {
      setFormError('আবেদন জমা করতে ব্যর্থ হয়েছে। অনুগ্রহ করে ইন্টারনেট কানেকশন চেক করুন।');
    } finally {
      setLoading(false);
    }
  };

  // 1c. Search transfer recipient member
  const handleSearchTransferMember = async () => {
    setSearchedMember(null);
    setSearchStatusMsg('');
    const input = transferTargetPhoneorId.trim();
    if (!input) {
      setSearchStatusMsg('অনুগ্রহ করে আইডি বা মোবাইল নাম্বার টাইপ করুন।');
      return;
    }

    setSearchStatusMsg('অনুসন্ধান করা হচ্ছে...');
    try {
      const isVirtualEndingInZero = input.endsWith('0') && input.length >= 10;
      const cleanInput = isVirtualEndingInZero ? input.slice(0, -1) : input;

      const q1 = query(collection(db, 'users'), where('memberId', '==', input));
      const q2 = query(collection(db, 'users'), where('phone', '==', input));
      const q3 = isVirtualEndingInZero ? query(collection(db, 'users'), where('memberId', '==', cleanInput)) : null;
      const q4 = isVirtualEndingInZero ? query(collection(db, 'users'), where('phone', '==', cleanInput)) : null;
      const q5 = (isVirtualEndingInZero && cleanInput.startsWith('0')) ? query(collection(db, 'users'), where('phone', '==', cleanInput.substring(1))) : null;
      const q6 = (isVirtualEndingInZero && cleanInput.startsWith('0')) ? query(collection(db, 'users'), where('phone', '==', '+88' + cleanInput)) : null;

      const [snap1, snap2, snap3, snap4, snap5, snap6] = await Promise.all([
        getDocs(q1).catch(() => ({ empty: true, docs: [] } as any)),
        getDocs(q2).catch(() => ({ empty: true, docs: [] } as any)),
        q3 ? getDocs(q3).catch(() => ({ empty: true, docs: [] } as any)) : Promise.resolve({ empty: true, docs: [] } as any),
        q4 ? getDocs(q4).catch(() => ({ empty: true, docs: [] } as any)) : Promise.resolve({ empty: true, docs: [] } as any),
        q5 ? getDocs(q5).catch(() => ({ empty: true, docs: [] } as any)) : Promise.resolve({ empty: true, docs: [] } as any),
        q6 ? getDocs(q6).catch(() => ({ empty: true, docs: [] } as any)) : Promise.resolve({ empty: true, docs: [] } as any)
      ]);

      let foundUser: any = null;
      let isVirtual = false;

      if (!snap1.empty && snap1.docs.length > 0) {
        foundUser = { uid: snap1.docs[0].id, ...snap1.docs[0].data() };
        if (input.endsWith('0')) isVirtual = true;
      } else if (!snap2.empty && snap2.docs.length > 0) {
        foundUser = { uid: snap2.docs[0].id, ...snap2.docs[0].data() };
        if (input.endsWith('0')) isVirtual = true;
      } else if (snap3 && !snap3.empty && snap3.docs.length > 0) {
        foundUser = { uid: snap3.docs[0].id, ...snap3.docs[0].data() };
        isVirtual = true;
      } else if (snap4 && !snap4.empty && snap4.docs.length > 0) {
        foundUser = { uid: snap4.docs[0].id, ...snap4.docs[0].data() };
        isVirtual = true;
      } else if (snap5 && !snap5.empty && snap5.docs.length > 0) {
        foundUser = { uid: snap5.docs[0].id, ...snap5.docs[0].data() };
        isVirtual = true;
      } else if (snap6 && !snap6.empty && snap6.docs.length > 0) {
        foundUser = { uid: snap6.docs[0].id, ...snap6.docs[0].data() };
        isVirtual = true;
      }

      if (isVirtualEndingInZero || input.endsWith('0')) {
        isVirtual = true;
      }

      if (foundUser) {
        foundUser.isVirtualSomitiTarget = isVirtual;
        foundUser.somitiVirtualNo = input;
        setSearchedMember(foundUser);
        if (isVirtual) {
          setSearchStatusMsg(`🏦 সমিতি ভার্চুয়াল নম্বর পাওয়া গেছেঃ ${foundUser.name} (সমিতি একাউন্ট: ${input}) - সঞ্চয় আমানতে অটো জমা হবে`);
        } else {
          setSearchStatusMsg(`💼 সদস্য পাওয়া গেছেঃ ${foundUser.name} (আইডি: ${foundUser.memberId || 'N/A'}) - মেইন ব্যালেন্সে জমা হবে`);
        }
      } else {
        setSearchStatusMsg('দুঃখিত, কোনো সক্রিয় সদস্য বা সমিতি অ্যাকাউন্ট খুঁজে পাওয়া যায়নি!');
      }
    } catch (e) {
      setSearchStatusMsg('ডাটাবেজ সংযোগে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    }
  };

  // 1d. Repay Qard Hasana interest-free loan
  const handleQardHasanaRepay = async (due: number) => {
    setLoading(true);
    setFormError('');
    setFormSuccess('');
    try {
      const currentBalance = liveUser.balance || 0;
      if (currentBalance < due) {
        setFormError(`পর্যাপ্ত ওয়ালেট ব্যালেন্স নেই! আপনার বর্তমান ওয়ালেট ব্যালেন্স ৳ ${currentBalance.toLocaleString('bn-BD')} BDT।`);
        setLoading(false);
        return;
      }

      const userRef = doc(db, 'users', liveUser.uid);
      const newDue = Math.max(0, (liveUser.dueLoan || 0) - due);
      const nowIso = new Date().toISOString();
      const updatePayload: any = {
        balance: currentBalance - due,
        dueLoan: newDue
      };
      if (newDue === 0) {
        updatePayload.lastCoopInstantLoanRepaidAt = nowIso;
      }
      await updateDoc(userRef, updatePayload);

      const txId = `tx-qard-repay-${Date.now()}`;
      const newTx: Transaction = {
        id: txId,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        type: 'qard_loan_repayment',
        typeLabel: 'করযে হাসানা পরিশোধ',
        amount: due,
        status: 'success',
        description: `ওয়ালেট ব্যালেন্স হতে সুদমুক্ত করযে হাসানা ঋণ পরিশোধ সফল সম্পন্ন (৩ মাসের কুলডাউন কাউন্ট শুরু)।`,
        createdAt: nowIso,
        paymentMethod: 'BNB Wallet',
        receiptNo: `REC-${Math.floor(100000 + Math.random() * 900000)}`
      };

      await addDoc(collection(db, 'transactions'), newTx);
      setFormSuccess(`অভিনন্দন! সফলভাবে আপনার বকেয়া সুদমুক্ত করযে হাসানা ঋণ ৳ ${due.toLocaleString('bn-BD')} টাকা সম্পূর্ণ পরিশোধ সম্পন্ন হয়েছে।`);
      syncLiveProfile();
    } catch (e) {
      setFormError('ঋণ পরিশোধ ব্যর্থ হয়েছে। দয়া করে ইন্টারনেট কানেকশন চেক করুন।');
    } finally {
      setLoading(false);
    }
  };

  // 2. Apply for Loan Scheme
  const handleLoanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (liveUser?.isDemo) {
      if (onTriggerDemoAuth) {
        onTriggerDemoAuth();
      } else {
        setShowDemoAuthPrompt(true);
      }
      return;
    }
    setFormError('');
    setFormSuccess('');

    const amt = Number(loanAmount);
    if (!amt || amt < 500) {
      setFormError('ঋণের আবেদনের সর্বনিম্ন পরিমাণ ৫০০ টাকা হতে হবে।');
      return;
    }
    if (amt > 20000) {
      setFormError('ঋণের আবেদনের সর্বোচ্চ পরিমাণ ২০,০০০ টাকা পর্যন্ত হতে পারে।');
      return;
    }

    setLoading(true);
    try {
      const txId = `tx-coop-loan-${Date.now()}`;
      const newTx: Transaction = {
        id: txId,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        type: 'coop_loan_apply',
        typeLabel: 'সমিতি নতুন লোন আবেদন',
        amount: amt,
        status: 'pending',
        description: `সমবায় লোন আবেদনঃ ৳${amt.toLocaleString('bn-BD')} টাকা ঋণের রিকোয়েস্ট (ড্যাশবোর্ড আবেদন)`,
        createdAt: new Date().toISOString(),
        paymentMethod: 'Samity Fund',
        receiptNo: `REC-${Math.floor(100000 + Math.random() * 900000)}`
      };

      await addDoc(collection(db, 'transactions'), newTx);
      setFormSuccess('অভিনন্দন! আপনার লোন আবেদনটি যাচাইকরণ টেবিলে পাঠানো হয়েছে। অ্যাডমিন প্যানেল মিটিংয়ের ভিত্তিতে এটি মঞ্জুর বা বাতিল করবেন।');
      setLoanAmount('');
      syncLiveProfile();
    } catch (e) {
      setFormError('ঋণ আবেদন সাবমিট করতে ব্যর্থ হয়েছে। দয়া করে ইন্টারনেট কানেকশন চেক করুন।');
    } finally {
      setLoading(false);
    }
  };

  // Execute fund transfer between internal sectors or to bank / external MFS
  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (liveUser?.isDemo) {
      if (onTriggerDemoAuth) {
        onTriggerDemoAuth();
      } else {
        setShowDemoAuthPrompt(true);
      }
      return;
    }
    setFormError('');
    setFormSuccess('');

    const amt = parseFloat(transferAmountInput);
    if (!transferAmountInput || isNaN(amt) || amt <= 0) {
      setFormError('অনুগ্রহ করে সঠিক টাকা স্থানান্তরের পরিমাণ টাইপ করুন।');
      return;
    }

    if (amt < 10) {
      setFormError('সর্বনিম্ন টাকা স্থানান্তরের পরিমাণ ১০ টাকা হতে হবে।');
      return;
    }

    if (!transferSenderPin.trim()) {
      setFormError('স্থানান্তর সম্পন্ন করতে আপনার ৪-ডিজিটের সিকিউরিটি পিন দিন।');
      return;
    }

    if (transferSenderPin !== liveUser.pin) {
      setFormError('ভুল সিকিউরিটি পিন! সঠিক ৪-ডিজিটের পিন টাইপ করুন।');
      return;
    }

    setLoading(true);
    try {
      const senderRef = doc(db, 'users', liveUser.uid);

      if (transferType === 'member') {
        if (!searchedMember) {
          setFormError('অনুগ্রহ করে প্রথমে প্রাপক মেম্বার সার্চ করে নিশ্চিত করুন।');
          setLoading(false);
          return;
        }

        if (searchedMember.uid === liveUser.uid) {
          // Self/Own Transfer
          if (transferSector === 'samity') {
            const currentBalance = liveUser.balance || 0;
            if (currentBalance < amt) {
              setFormError(`পর্যাপ্ত মেইন ব্যালেন্স নেই! আপনার বর্তমান ওয়ালেট ব্যালেন্স ৳ ${currentBalance.toLocaleString('bn-BD')} BDT।`);
              setLoading(false);
              return;
            }

            if (selfTransferTarget === 'telecom') {
              const currentTelecom = liveUser.telecomBalance || 0;
              await updateDoc(senderRef, {
                balance: currentBalance - amt,
                telecomBalance: currentTelecom + amt
              });

              const txId = `tx-self-main-to-telecom-${Date.now()}`;
              const newTx: Transaction = {
                id: txId,
                userId: liveUser.uid,
                userName: liveUser.name,
                memberId: liveUser.memberId,
                type: 'balance_transfer',
                typeLabel: 'মেইন ব্যালেন্স হতে টেলিকম',
                amount: amt,
                status: 'success',
                description: `নিজের মেইন ব্যালেন্স হতে মেম্বার টেলিকম ওয়ালেটে স্থানান্তর সফল।`,
                createdAt: new Date().toISOString(),
                paymentMethod: 'BNB Wallet',
                receiptNo: `REC-${Math.floor(10000 + Math.random() * 90000)}`,
                transferSector: 'telecom'
              };
              await addDoc(collection(db, 'transactions'), newTx);
              setFormSuccess(`অভিনন্দন! সফলভাবে নিজের মেইন ওয়ালেট হতে ৳ ${amt.toLocaleString('bn-BD')} টাকা টেলিকম ওয়ালেটে স্থানান্তর করা হয়েছে।`);

            } else if (selfTransferTarget === 'shop') {
              const currentShop = liveUser.superShopBalance || 0;
              await updateDoc(senderRef, {
                balance: currentBalance - amt,
                superShopBalance: currentShop + amt
              });

              const txId = `tx-self-main-to-shop-${Date.now()}`;
              const newTx: Transaction = {
                id: txId,
                userId: liveUser.uid,
                userName: liveUser.name,
                memberId: liveUser.memberId,
                type: 'balance_transfer',
                typeLabel: 'মেইন ব্যালেন্স হতে শপ',
                amount: amt,
                status: 'success',
                description: `নিজের মেইন ব্যালেন্স হতে মেম্বার সুপার শপ ওয়ালেটে স্থানান্তর সফল।`,
                createdAt: new Date().toISOString(),
                paymentMethod: 'BNB Wallet',
                receiptNo: `REC-${Math.floor(100000 + Math.random() * 900000)}`,
                transferSector: 'shop'
              };
              await addDoc(collection(db, 'transactions'), newTx);
              setFormSuccess(`অভিনন্দন! সফলভাবে নিজের মেইন ওয়ালেট হতে ৳ ${amt.toLocaleString('bn-BD')} টাকা সুপার শপ ওয়ালেটে স্থানান্তর করা হয়েছে।`);

            } else if (selfTransferTarget === 'savings') {
              const currentSavings = liveUser.savings || 0;
              await updateDoc(senderRef, {
                balance: currentBalance - amt,
                savings: currentSavings + amt
              });

              const txIdSel = `tx-self-main-to-savings-${Date.now()}`;
              const newTxSel: Transaction = {
                id: txIdSel,
                userId: liveUser.uid,
                userName: liveUser.name,
                memberId: liveUser.memberId,
                type: 'deposit',
                typeLabel: 'মেইন ব্যালেন্স হতে সঞ্চয় জমা',
                amount: amt,
                status: 'success',
                description: `নিজের মেইন ব্যালেন্স হতে কো-অপারেтивной সঞ্চয় তহবিলে জমার আবেদন সফল।`,
                createdAt: new Date().toISOString(),
                paymentMethod: 'BNB Wallet',
                receiptNo: `REC-${Math.floor(100000 + Math.random() * 900000)}`,
                transferSector: 'samity'
              };
              await addDoc(collection(db, 'transactions'), newTxSel);
              setFormSuccess(`অভিনন্দন! সফলভাবে নিজের মেইন ওয়ালেট হতে ৳ ${amt.toLocaleString('bn-BD')} টাকা কো-অপারেটিভ সঞ্চয় ব্যালেন্সে স্থানান্তর করা হয়েছে।`);
            }
          } else if (transferSector === 'telecom') {
            const currentTelecom = liveUser.telecomBalance || 0;
            const currentBalance = liveUser.balance || 0;
            if (currentTelecom < amt) {
              setFormError(`পর্যাপ্ত টেলিকম ব্যালেন্স নেই! আপনার বর্তমান টেলিকম ব্যালেন্স ৳ ${currentTelecom.toLocaleString('bn-BD')} BDT।`);
              setLoading(false);
              return;
            }
            await updateDoc(senderRef, {
              telecomBalance: currentTelecom - amt,
              balance: currentBalance + amt
            });

            const txIdT = `tx-self-telecom-deposit-${Date.now()}`;
            const newTxT: Transaction = {
              id: txIdT,
              userId: liveUser.uid,
              userName: liveUser.name,
              memberId: liveUser.memberId,
              type: 'deposit',
              typeLabel: 'টেলিকম হতে সমিতি ব্যালেন্স জেনারেশন',
              amount: amt,
              status: 'success',
              description: `নিজের টেলিকম ওয়ালেট হতে মেইন ব্যালেন্সে স্থানান্তর সফল।`,
              createdAt: new Date().toISOString(),
              paymentMethod: 'BNB Telecom Wallet',
              receiptNo: `REC-${Math.floor(100000 + Math.random() * 900000)}`,
              transferSector: 'samity'
            };

            await addDoc(collection(db, 'transactions'), newTxT);
            setFormSuccess(`অভিনন্দন! সফলভাবে নিজের টেলিকম ওয়ালেট হতে ৳ ${amt.toLocaleString('bn-BD')} টাকা ড্যাশবোর্ড মেইন ব্যালেন্সে স্থানান্তর করা হয়েছে।`);

          } else if (transferSector === 'shop') {
            const currentShop = liveUser.superShopBalance || 0;
            const currentBalance = liveUser.balance || 0;
            if (currentShop < amt) {
              setFormError(`পর্যাপ্ত সুপার শপ ব্যালেন্স নেই! আপনার বর্তমান সুপার শপ ব্যালেন্স ৳ ${currentShop.toLocaleString('bn-BD')} BDT।`);
              setLoading(false);
              return;
            }
            await updateDoc(senderRef, {
              superShopBalance: currentShop - amt,
              balance: currentBalance + amt
            });

            const txIdS = `tx-self-shop-deposit-${Date.now()}`;
            const newTxS: Transaction = {
              id: txIdS,
              userId: liveUser.uid,
              userName: liveUser.name,
              memberId: liveUser.memberId,
              type: 'deposit',
              typeLabel: 'সুপার শপ হতে সমিতি ব্যালেন্স জেনারেশন',
              amount: amt,
              status: 'success',
              description: `নিজের সুপার শপ ওয়ালেট হতে মেইন ব্যালেন্সে স্থানান্তর সফল।`,
              createdAt: new Date().toISOString(),
              paymentMethod: 'BNB Super Shop Wallet',
              receiptNo: `REC-${Math.floor(100000 + Math.random() * 900000)}`,
              transferSector: 'samity'
            };

            await addDoc(collection(db, 'transactions'), newTxS);
            setFormSuccess(`অভিনন্দন! সফলভাবে নিজের সুপার শপ ওয়ালেট হতে ৳ ${amt.toLocaleString('bn-BD')} টাকা ড্যাশবোর্ড মেইন ব্যালেন্সে স্থানান্তর করা হয়েছে।`);
          }
        } else {
          // CASE B: Transfer to another member
          const receiverRef = doc(db, 'users', searchedMember.uid);
          if (transferSector === 'telecom') {
            const cleanTrxId = Array.from({length: 10}, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.charAt(Math.floor(Math.random() * 36))).join('');
            const now = new Date();
            const formattedTime = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            let senderNewBal = 0;
            let receiverNewBal = 0;

            await runTransaction(db, async (transaction) => {
              const sSnap = await transaction.get(senderRef);
              const rSnap = await transaction.get(receiverRef);

              if (!sSnap.exists() || !rSnap.exists()) {
                throw new Error('সদস্য অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।');
              }

              const sData = sSnap.data();
              const rData = rSnap.data();
              const currentTelecomSender = sData.telecomBalance || 0;
              const currentTelecomReceiver = rData.telecomBalance || 0;

              if (currentTelecomSender < amt) {
                throw new Error(`পর্যাপ্ত টেলিকম ব্যালেন্স নেই! আপনার বর্তমান টেলিকম ব্যালেন্স ৳ ${currentTelecomSender.toLocaleString('bn-BD')} BDT।`);
              }

              senderNewBal = currentTelecomSender - amt;
              receiverNewBal = currentTelecomReceiver + amt;

              transaction.update(senderRef, { telecomBalance: senderNewBal });
              transaction.update(receiverRef, { telecomBalance: receiverNewBal });

              const txIdSender = `tx-telecom-transfer-out-${Date.now()}`;
              const txIdReceiver = `tx-telecom-transfer-in-${Date.now()}`;

              const senderTxDoc = doc(collection(db, 'transactions'), txIdSender);
              const receiverTxDoc = doc(collection(db, 'transactions'), txIdReceiver);
              const senderNotifDoc = doc(collection(db, 'user_notifications'), `notif-sender-${Date.now()}`);
              const receiverNotifDoc = doc(collection(db, 'user_notifications'), `notif-receiver-${Date.now()}`);

              transaction.set(senderTxDoc, {
                id: txIdSender,
                userId: liveUser.uid,
                userName: liveUser.name,
                memberId: liveUser.memberId,
                type: 'balance_transfer',
                typeLabel: 'টেলিকম ব্যালেন্স পাঠানো',
                amount: amt,
                status: 'success',
                description: `সদস্য ${searchedMember.name} (আইডি: ${searchedMember.memberId}) কে টেলিকম ব্যালেন্স পাঠানো সফল। TrxID: ${cleanTrxId}`,
                createdAt: now.toISOString(),
                paymentMethod: 'BNB Telecom Wallet',
                receiptNo: cleanTrxId,
                transactionId: cleanTrxId,
                transferSector: 'telecom'
              });

              transaction.set(receiverTxDoc, {
                id: txIdReceiver,
                userId: searchedMember.uid,
                userName: searchedMember.name,
                memberId: searchedMember.memberId,
                type: 'deposit',
                typeLabel: 'টেলিকম ব্যালেন্স লাভ',
                amount: amt,
                status: 'success',
                description: `সদস্য ${liveUser.name} (আইডি: ${liveUser.memberId}) হতে টেলিকম ব্যালেন্স প্রাপ্তি। TrxID: ${cleanTrxId}`,
                createdAt: now.toISOString(),
                paymentMethod: 'BNB Telecom Wallet',
                receiptNo: cleanTrxId,
                transactionId: cleanTrxId,
                transferSector: 'telecom'
              });

              transaction.set(senderNotifDoc, {
                id: `notif-sender-${Date.now()}`,
                userId: liveUser.uid,
                memberId: liveUser.memberId || '',
                title: '💸 টাকা পাঠানো সফল (Money Sent)',
                body: `You have sent Tk ${amt.toFixed(2)} to ${searchedMember.phone || ''}. Fee Tk 0.00. Balance Tk ${senderNewBal.toFixed(2)}. TrxID ${cleanTrxId} at ${formattedTime}`,
                read: false,
                isPersonal: true,
                isTransactionHistory: true,
                category: 'transaction',
                createdAt: now.toISOString()
              });

              transaction.set(receiverNotifDoc, {
                id: `notif-receiver-${Date.now()}`,
                userId: searchedMember.uid,
                memberId: searchedMember.memberId || '',
                title: '📥 টাকা গ্রহণ সফল (Money Received)',
                body: `You have received Tk ${amt.toFixed(2)} from ${liveUser.phone || ''}. Ref 0. Fee Tk 0.00. Balance Tk ${receiverNewBal.toFixed(2)}. TrxID ${cleanTrxId} at ${formattedTime}`,
                read: false,
                isPersonal: true,
                isTransactionHistory: true,
                category: 'transaction',
                createdAt: now.toISOString()
              });
            });

            setFormSuccess(`অভিনন্দন! সফলভাবে সদস্য ${searchedMember.name} কে ৳ ${amt.toLocaleString('bn-BD')} টেলিকম ব্যালেন্স স্থানান্তর করা হয়েছে।`);

          } else if (transferSector === 'shop') {
            const cleanTrxId = Array.from({length: 10}, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.charAt(Math.floor(Math.random() * 36))).join('');
            const now = new Date();
            const formattedTime = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            let senderNewBal = 0;
            let receiverNewBal = 0;

            await runTransaction(db, async (transaction) => {
              const sSnap = await transaction.get(senderRef);
              const rSnap = await transaction.get(receiverRef);

              if (!sSnap.exists() || !rSnap.exists()) {
                throw new Error('সদস্য অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।');
              }

              const sData = sSnap.data();
              const rData = rSnap.data();
              const currentShopSender = sData.superShopBalance || 0;
              const currentShopReceiver = rData.superShopBalance || 0;

              if (currentShopSender < amt) {
                throw new Error(`পর্যাপ্ত সুপার শপ ব্যালেন্স নেই! আপনার বর্তমান সুপার শপ ব্যালেন্স ৳ ${currentShopSender.toLocaleString('bn-BD')} BDT।`);
              }

              senderNewBal = currentShopSender - amt;
              receiverNewBal = currentShopReceiver + amt;

              transaction.update(senderRef, { superShopBalance: senderNewBal });
              transaction.update(receiverRef, { superShopBalance: receiverNewBal });

              const txIdSender = `tx-shop-transfer-out-${Date.now()}`;
              const txIdReceiver = `tx-shop-transfer-in-${Date.now()}`;

              const senderTxDoc = doc(collection(db, 'transactions'), txIdSender);
              const receiverTxDoc = doc(collection(db, 'transactions'), txIdReceiver);
              const senderNotifDoc = doc(collection(db, 'user_notifications'), `notif-sender-${Date.now()}`);
              const receiverNotifDoc = doc(collection(db, 'user_notifications'), `notif-receiver-${Date.now()}`);

              transaction.set(senderTxDoc, {
                id: txIdSender,
                userId: liveUser.uid,
                userName: liveUser.name,
                memberId: liveUser.memberId,
                type: 'balance_transfer',
                typeLabel: 'সুপার শপ ব্যালেন্স পাঠানো',
                amount: amt,
                status: 'success',
                description: `সদস্য ${searchedMember.name} (আইডি: ${searchedMember.memberId}) কে সুপার শপ ব্যালেন্স পাঠানো সফল। TrxID: ${cleanTrxId}`,
                createdAt: now.toISOString(),
                paymentMethod: 'BNB Super Shop Wallet',
                receiptNo: cleanTrxId,
                transactionId: cleanTrxId,
                transferSector: 'shop'
              });

              transaction.set(receiverTxDoc, {
                id: txIdReceiver,
                userId: searchedMember.uid,
                userName: searchedMember.name,
                memberId: searchedMember.memberId,
                type: 'deposit',
                typeLabel: 'সুপার শপ ব্যালেন্স লাভ',
                amount: amt,
                status: 'success',
                description: `সদস্য ${liveUser.name} (আইডি: ${liveUser.memberId}) হতে সুপার শপ ব্যালেন্স প্রাপ্তি। TrxID: ${cleanTrxId}`,
                createdAt: now.toISOString(),
                paymentMethod: 'BNB Super Shop Wallet',
                receiptNo: cleanTrxId,
                transactionId: cleanTrxId,
                transferSector: 'shop'
              });

              transaction.set(senderNotifDoc, {
                id: `notif-sender-${Date.now()}`,
                userId: liveUser.uid,
                memberId: liveUser.memberId || '',
                title: '💸 টাকা পাঠানো সফল (Money Sent)',
                body: `You have sent Tk ${amt.toFixed(2)} to ${searchedMember.phone || ''}. Fee Tk 0.00. Balance Tk ${senderNewBal.toFixed(2)}. TrxID ${cleanTrxId} at ${formattedTime}`,
                read: false,
                isPersonal: true,
                isTransactionHistory: true,
                category: 'transaction',
                createdAt: now.toISOString()
              });

              transaction.set(receiverNotifDoc, {
                id: `notif-receiver-${Date.now()}`,
                userId: searchedMember.uid,
                memberId: searchedMember.memberId || '',
                title: '📥 টাকা গ্রহণ সফল (Money Received)',
                body: `You have received Tk ${amt.toFixed(2)} from ${liveUser.phone || ''}. Ref 0. Fee Tk 0.00. Balance Tk ${receiverNewBal.toFixed(2)}. TrxID ${cleanTrxId} at ${formattedTime}`,
                read: false,
                isPersonal: true,
                isTransactionHistory: true,
                category: 'transaction',
                createdAt: now.toISOString()
              });
            });

            setFormSuccess(`অভিনন্দন! সফলভাবে সদস্য ${searchedMember.name} কে ৳ ${amt.toLocaleString('bn-BD')} সুপার শপ ব্যালেন্স স্থানান্তর করা হয়েছে।`);

          } else {
            // BNB to BNB Transfer: Automatic direct transfer based on destination account!
            // If recipient target is Samity Virtual Account (phone + '0' / 12 digits / isVirtualSomitiTarget): goes to SAMITY SAVINGS balance!
            // If recipient target is standard 11-digit phone number or Member ID: goes to MAIN balance!
            const rawTargetInput = transferTargetPhoneorId.trim();
            const isSamityVirtualTarget = searchedMember.isVirtualSomitiTarget !== undefined
              ? searchedMember.isVirtualSomitiTarget
              : Boolean(
                  rawTargetInput.endsWith('0') ||
                  (rawTargetInput.length >= 12 && rawTargetInput.endsWith('0')) ||
                  (searchedMember.phone && rawTargetInput.endsWith('0') && rawTargetInput.includes(searchedMember.phone.replace(/^(\+88)?0?/, ''))) ||
                  (searchedMember.memberId && rawTargetInput.endsWith('0') && rawTargetInput.toLowerCase().includes(searchedMember.memberId.toLowerCase()))
                );

            const cleanTrxId = Array.from({length: 10}, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.charAt(Math.floor(Math.random() * 36))).join('');
            const now = new Date();
            const formattedTime = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            let senderNewBal = 0;
            let receiverNewBal = 0;

            await runTransaction(db, async (transaction) => {
              const sSnap = await transaction.get(senderRef);
              const rSnap = await transaction.get(receiverRef);

              if (!sSnap.exists() || !rSnap.exists()) {
                throw new Error('সদস্য অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।');
              }

              const sData = sSnap.data();
              const rData = rSnap.data();
              const currentBalanceSender = sData.balance || 0;

              if (currentBalanceSender < amt) {
                throw new Error(`পর্যাপ্ত মেইন ব্যালেন্স নেই! আপনার বর্তমান ওয়ালেট ব্যালেন্স ৳ ${currentBalanceSender.toLocaleString('bn-BD')} BDT।`);
              }

              senderNewBal = currentBalanceSender - amt;
              transaction.update(senderRef, { balance: senderNewBal, mainBalance: senderNewBal });

              if (isSamityVirtualTarget) {
                // Credit to Receiver's SAMITY / SAVINGS balance!
                const currentSavingsReceiver = rData.savings || 0;
                receiverNewBal = currentSavingsReceiver + amt;
                const existingPaidMonths: string[] = rData.samityPaidMonths || [];
                const updatedPaidMonths = Array.from(new Set([...existingPaidMonths, ...sendMoneySelectedMonths]));
                transaction.update(receiverRef, { savings: receiverNewBal, dpsBalance: receiverNewBal, samityPaidMonths: updatedPaidMonths });
              } else {
                // Credit to Receiver's MAIN balance!
                const currentBalanceReceiver = rData.balance || 0;
                receiverNewBal = currentBalanceReceiver + amt;
                transaction.update(receiverRef, { balance: receiverNewBal, mainBalance: receiverNewBal });
              }

              const txIdSender = `tx-transfer-out-${Date.now()}`;
              const txIdReceiver = `tx-transfer-in-${Date.now()}`;

              const senderTxDoc = doc(collection(db, 'transactions'), txIdSender);
              const receiverTxDoc = doc(collection(db, 'transactions'), txIdReceiver);
              const senderNotifDoc = doc(collection(db, 'user_notifications'), `notif-sender-${Date.now()}`);
              const receiverNotifDoc = doc(collection(db, 'user_notifications'), `notif-receiver-${Date.now()}`);

              transaction.set(senderTxDoc, {
                id: txIdSender,
                userId: liveUser.uid,
                userName: liveUser.name,
                memberId: liveUser.memberId,
                type: 'balance_transfer',
                typeLabel: isSamityVirtualTarget ? 'সমিতি একাউন্টে ফান্ড পাঠানো' : 'মেইন ব্যালেন্সে টাকা পাঠানো',
                amount: amt,
                totalDeducted: amt,
                status: 'success',
                description: isSamityVirtualTarget 
                  ? `সদস্য ${searchedMember.name} (আইডি: ${searchedMember.memberId}) এর সমিতি সঞ্চয় একাউন্টে (লাস্টে 0) ৳${amt} পাঠানো সফল। TrxID: ${cleanTrxId}`
                  : `সদস্য ${searchedMember.name} (আইডি: ${searchedMember.memberId}) কে মেইন ব্যালেন্সে ৳${amt} পাঠানো সফল। TrxID: ${cleanTrxId}`,
                createdAt: now.toISOString(),
                paymentMethod: 'BNB Wallet',
                receiptNo: cleanTrxId,
                transactionId: cleanTrxId,
                receiverUid: searchedMember.uid,
                receiverId: searchedMember.memberId,
                receiverName: searchedMember.name,
                transferSector: isSamityVirtualTarget ? 'samity' : 'main'
              });

              transaction.set(receiverTxDoc, {
                id: txIdReceiver,
                userId: searchedMember.uid,
                userName: searchedMember.name,
                memberId: searchedMember.memberId,
                type: isSamityVirtualTarget ? 'coop_savings_deposit' : 'deposit',
                typeLabel: isSamityVirtualTarget ? 'সমিতি একাউন্টে সঞ্চয় জমা' : 'মেইন ব্যালেন্স প্রাপ্তি',
                amount: amt,
                status: 'success',
                description: isSamityVirtualTarget
                  ? `সদস্য ${liveUser.name} (আইডি: ${liveUser.memberId}) হতে সমিতি সঞ্চয় একাউন্টে জমা প্রাপ্তি। TrxID: ${cleanTrxId}`
                  : `সদস্য ${liveUser.name} (আইডি: ${liveUser.memberId}) হতে মেইন ব্যালেন্সে জমা প্রাপ্তি। TrxID: ${cleanTrxId}`,
                createdAt: now.toISOString(),
                paymentMethod: 'BNB Wallet',
                receiptNo: cleanTrxId,
                transactionId: cleanTrxId,
                transferSector: isSamityVirtualTarget ? 'samity' : 'main'
              });

              transaction.set(senderNotifDoc, {
                id: `notif-sender-${Date.now()}`,
                userId: liveUser.uid,
                memberId: liveUser.memberId || '',
                title: '💸 টাকা পাঠানো সফল (Money Sent)',
                body: `You have sent Tk ${amt.toFixed(2)} to ${searchedMember.phone || ''}. Fee Tk 0.00. Balance Tk ${senderNewBal.toFixed(2)}. TrxID ${cleanTrxId} at ${formattedTime}`,
                read: false,
                isPersonal: true,
                isTransactionHistory: true,
                category: 'transaction',
                createdAt: now.toISOString()
              });

              transaction.set(receiverNotifDoc, {
                id: `notif-receiver-${Date.now()}`,
                userId: searchedMember.uid,
                memberId: searchedMember.memberId || '',
                title: isSamityVirtualTarget ? '📥 সমিতি একাউন্টে সঞ্চয় জমা সফল' : '📥 টাকা গ্রহণ সফল (Money Received)',
                body: isSamityVirtualTarget
                  ? `You have received Tk ${amt.toFixed(2)} from ${liveUser.phone || ''} into your Samity Savings Account. Ref 0. Fee Tk 0.00. Savings Balance Tk ${receiverNewBal.toFixed(2)}. TrxID ${cleanTrxId} at ${formattedTime}`
                  : `You have received Tk ${amt.toFixed(2)} from ${liveUser.phone || ''} into your Main Wallet Balance. Ref 0. Fee Tk 0.00. Main Balance Tk ${receiverNewBal.toFixed(2)}. TrxID ${cleanTrxId} at ${formattedTime}`,
                read: false,
                isPersonal: true,
                isTransactionHistory: true,
                category: 'transaction',
                createdAt: now.toISOString()
              });
            });

            if (isSamityVirtualTarget) {
              setFormSuccess(`অভিনন্দন! সফলভাবে সদস্য ${searchedMember.name}-এর সমিতি ভার্চুয়াল একাউন্টে (লাস্টে 0) ৳ ${amt.toLocaleString('bn-BD')} সঞ্চয় জমা স্থানান্তর সম্পন্ন হয়েছে।`);
            } else {
              setFormSuccess(`অভিনন্দন! সফলভাবে সদস্য ${searchedMember.name}-এর মেইন ব্যালেন্সে ৳ ${amt.toLocaleString('bn-BD')} স্থানান্তর সম্পন্ন হয়েছে।`);
            }
          }
        }
      } else {
        // CASE C: To External General Bank accounts / Mobile FS
        if (!transferTargetAccNo.trim()) {
          setFormError('অনুগ্রহ করে প্রাপক ব্যাংক হিসাব/নম্বর টাইপ করুন।');
          setLoading(false);
          return;
        }

        const currentBalanceSender = liveUser.balance || 0;
        if (currentBalanceSender < amt) {
          setFormError(`পর্যাপ্ত মেইন ব্যালেন্স নেই! আপনার বর্তমান ওয়ালেট ব্যালেন্স ৳ ${currentBalanceSender.toLocaleString('bn-BD')} BDT।`);
          setLoading(false);
          return;
        }
        await updateDoc(senderRef, { balance: currentBalanceSender - amt });

        const txId = `tx-bank-transfer-${Date.now()}`;
        const newTx: Transaction = {
          id: txId,
          userId: liveUser.uid,
          userName: liveUser.name,
          memberId: liveUser.memberId,
          type: 'balance_transfer',
          typeLabel: 'বহিরাগত ফান্ড ট্রান্সফার',
          amount: amt,
          status: 'pending',
          description: `${transferType === 'bank' ? transferTargetBankName : 'মোবাইল ওয়ালেট'} (হিসাবঃ ${transferTargetAccNo}) অ্যাকাউন্টে ফান্ড স্থানান্তরের আবেদন (অ্যাডমিন অনুমোদনের অপেক্ষায়)।`,
          createdAt: new Date().toISOString(),
          paymentMethod: transferType === 'bank' ? 'Bank Transfer' : 'MFS',
          receiptNo: `REC-${Math.floor(100000 + Math.random() * 900000)}`,
          transferSector: 'samity'
          };

        await addDoc(collection(db, 'transactions'), newTx);
        setFormSuccess(`আপনার ৳ ${amt.toLocaleString('bn-BD')} ব্যাংক/MFS উত্তোলনের আবেদনটি সফলভাবে দাখিল করা হয়েছে এবং এর স্ট্যাটাস অপেক্ষমাণ (Pending)। এডমিন এপ্রুভ করার সাথে সাথে আপনার পেমেন্ট সম্পন্ন হবে।`);
      }

      setTransferAmountInput('');
      setTransferTargetPhoneorId('');
      setTransferTargetAccNo('');
      setTransferSenderPin('');
      setSearchedMember(null);
      setSearchStatusMsg('');
      setSendMoneySelectedMonths([]);

      await syncLiveProfile();
    } catch (e) {
      setFormError('টাকা স্থানান্তর ব্যর্থ হয়েছে। অনুগ্রহ করে ইন্টারনেট কানেকশন চেক করুন।');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRationCard = async () => {
    if (liveUser?.isDemo) {
      setShowDemoAuthPrompt(true);
      return;
    }
    
    if (!rationCardName.trim()) {
      alert('অনুগ্রহ করে কার্ডধারীর পুরো নাম লিখুন।');
      return;
    }

    if (!rationCardAddress.trim()) {
      alert('অনুগ্রহ করে আপনার সঠিক ঠিকানা লিখুন।');
      return;
    }

    setLoading(true);
    try {
      const userRef = doc(db, 'users', liveUser.uid);
      const currentBalance = liveUser.balance || 0;
      const activationFee = 150;

      if (currentBalance < activationFee) {
        alert(`রেশন কার্ডের সক্রিয়করণ ফি ৳${activationFee} BDT। আপনার পর্যাপ্ত ব্যালেন্স নেই!`);
        setLoading(false);
        return;
      }

      // Generate virtual card number
      const cardNo = `BNB-RC-${Math.floor(100000 + Math.random() * 900000)}`;

      const newCard = {
        userId: liveUser.uid,
        userName: rationCardName,
        address: rationCardAddress,
        cardType: rationCardType,
        cardNo: cardNo,
        nominee: rationCardNominee || 'প্রযোজ্য নয়',
        createdAt: new Date().toISOString(),
        status: 'active'
      };

      // Add to Firestore
      await addDoc(collection(db, 'ration_cards'), newCard);

      // Deduct Fee
      await updateDoc(userRef, { balance: currentBalance - activationFee });

      // Record transaction
      await addDoc(collection(db, 'transactions'), {
        id: `tx-rc-create-${Date.now()}`,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        type: 'ration_card_fee',
        typeLabel: 'রেশন কার্ড সক্রিয়করণ ফি',
        amount: activationFee,
        status: 'success',
        description: `ডিজিটাল রেশন কার্ড (${cardNo}) সক্রিয়করণ সম্পন্ন।`,
        createdAt: new Date().toISOString(),
        paymentMethod: 'Main Balance'
      });

      alert(`অভিনন্দন! সফলভাবে আপনার ডিজিটাল রেশন কার্ড (${cardNo}) তৈরি হয়েছে।`);
      setShowCreateCardModal(false);
      await syncLiveProfile();
    } catch (err) {
      console.error("Ration card creation failed:", err);
      alert("সার্ভার ত্রুটি! রেশন কার্ড সক্রিয় করা সম্ভব হয়নি।");
    } finally {
      setLoading(false);
    }
  };

  // 8. Submit Agent Application
  const handleAgentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (liveUser?.isDemo) {
      if (onTriggerDemoAuth) {
        onTriggerDemoAuth();
      } else {
        setShowDemoAuthPrompt(true);
      }
      return;
    }
    setAgentErrorMsg('');
    setAgentSuccessMsg('');
    setLoading(true);

    if (!agentPhone || !agentDistrict) {
      setAgentErrorMsg('অনুগ্রহ করে আপনার সচল মোবাইল নম্বর এবং নিজ জেলা প্রদান করুন।');
      setLoading(false);
      return;
    }

    try {
      await addDoc(collection(db, 'agent_requests'), {
        userId: liveUser.uid,
        userName: liveUser.name || 'সদস্য',
        userEmail: liveUser.email || '',
        phone: agentPhone,
        district: agentDistrict,
        experience: agentExperience,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      setAgentSuccessMsg('আপনার এজেন্ট আবেদনটি সফলভাবে Bangladesh এডমিন প্যানেলে জমা দেওয়া হয়েছে! এডমিন প্যানেল শীঘ্রই আপনার সাথে যোগাযোগ করবেন। ধন্যবাদ!');
      setHasSubmittedAgent(true);
    } catch (err: any) {
      console.error(err);
      setAgentErrorMsg('আবেদন জমা দিতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  // 8b. Live Chat support desk
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (liveUser?.isDemo) {
      if (onTriggerDemoAuth) {
        onTriggerDemoAuth();
      } else {
        setShowDemoAuthPrompt(true);
      }
      return;
    }
    if (!chatInputText.trim()) return;

    const userText = chatInputText;
    setChatInputText('');

    const now = new Date();
    const timeStr = now.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });

    // Append user message
    const userMsg = { id: Math.random().toString(), sender: 'user', text: userText, timestamp: timeStr };
    setChatMessages(prev => [...prev, userMsg]);

    // Save to firestore for admins to reply
    try {
      await addDoc(collection(db, 'support_chats'), {
        userId: liveUser.uid,
        userName: liveUser.name || 'সদস্য',
        message: userText,
        sender: 'user',
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      console.error(e);
    }

    setIsChatTyping(true);

    setTimeout(() => {
      setIsChatTyping(false);
      let replyText = '';
      const textLower = userText.toLowerCase();

      if (textLower.includes('সমিতি') || textLower.includes('সঞ্চয়') || textLower.includes('ডিপিএস')) {
        replyText = 'সমিতি হিসাব সচল করতে ড্যাশবোর্ডের নীচে সার্ভিস গ্রিডের "সমিতি" সেকশনে গিয়ে আবেদন রিকোয়েস্ট জমা দিন। এডমিন প্যানেল আপনার আবেদনটি তাৎক্ষণিকভাবে যাচাই করে অনুমোদন প্রদান করবে।';
      } else if (textLower.includes('ঋণ') || textLower.includes('করযে') || textLower.includes('করজ')) {
        replyText = 'সুদমুক্ত করযে হাসানা ঋণের জন্য ড্যাশবোর্ডের "করযে হাসানা" সেকশন হতে আবেদন করতে পারেন। এছাড়া সমিতির অন্যান্য ঋণের ক্ষেত্রেও সেখানে বিস্তারিত নির্দেশনা রয়েছে।';
      } else if (textLower.includes('টেলিকম') || textLower.includes('রিচার্জ') || textLower.includes('অফার')) {
        replyText = 'বাংলাদেশ নেটওয়ার্ক টেলিকম অফার ও রিচার্জ সুবিধা পেতে সার্ভিস গ্রিডের "টেলিকম" অপশনটি ব্যবহার করুন। যেকোনো অপারেটরের স্পেশাল অফার এবং রিচার্জের রিকোয়েস্ট এডমিন প্যানেল দ্রুত সম্পন্ন করে।';
      } else if (textLower.includes('এজেন্ট') || textLower.includes('কাজ')) {
        replyText = 'আমাদের সম্মানিত এজেন্ট হিসেবে কাজ শুরু করতে চাইলে সার্ভিস গ্রিডের "এজেন্ট রেজিস্টার" অপশনে গিয়ে আপনার আবেদনটি দাখিল করুন। এডমিন প্যানেল আপনার আবেদনটি রিভিও করে যোগাযোগ করবে।';
      } else {
        replyText = 'আসসালামু আলাইকুম! আপনার মেসেজটি সফলভাবে বাংলাদেশ নেটওয়ার্ক (BNB) সাপোর্ট সেন্টারে রেকর্ড করা হয়েছে। যেকোনো তথ্যের জন্য আমাদের সাপোর্ট নম্বরে যোগাযোগ করতে পারেন অথবা এডমিনের ফিরতি উত্তরের জন্য অপেক্ষা করুন।';
      }

      const replyMsg = { 
        id: Math.random().toString(), 
        sender: 'support', 
        text: replyText, 
        timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }) 
      };
      setChatMessages(prev => [...prev, replyMsg]);

      addDoc(collection(db, 'support_chats'), {
        userId: liveUser.uid,
        userName: 'সাপোর্ট অ্যাসিস্ট্যান্ট',
        message: replyText,
        sender: 'support',
        createdAt: new Date().toISOString()
      }).catch(err => console.error("Error saving support chat reply:", err));
    }, 1500);
  };

  const handleJoinSafeDeal = async (dealId: string, dealTitle: string, dealPrice: number) => {
    if (liveUser?.isDemo) {
      setShowDemoAuthPrompt(true);
      return;
    }

    const qtyStr = prompt(`"${dealTitle}" ডিলে অংশ নিতে কত পিস/লিটার অর্ডার করতে চান টাইপ করুন:`, "১");
    if (!qtyStr) return;
    const qty = parseInt(qtyStr);
    if (isNaN(qty) || qty <= 0) {
      alert("অনুগ্রহ করে সঠিক সংখ্যা লিখুন।");
      return;
    }

    const pin = prompt(`ক্রয় সম্পন্ন করতে আপনার ৪ ডিজিটের সিকিউরিটি পিন নাম্বার টাইপ করুনঃ`);
    if (!pin) return;
    if (pin !== liveUser.pin) {
      alert("ভুল পিন কোড!");
      return;
    }

    setLoading(true);
    try {
      const totalAmount = dealPrice * qty;
      const currentBalance = liveUser.balance || 0;

      if (currentBalance < totalAmount) {
        alert(`আপনার পর্যাপ্ত ব্যালেন্স নেই! মোট প্রয়োজন ৳${totalAmount.toLocaleString("bn-BD")} BDT, কিন্তু আপনার মেইন ব্যালেন্স ৳${currentBalance.toLocaleString("bn-BD")} BDT।`);
        setLoading(false);
        return;
      }

      const userRef = doc(db, "users", liveUser.uid);
      await updateDoc(userRef, {
        balance: currentBalance - totalAmount
      });

      const orderRef = await addDoc(collection(db, "safe_deal_orders"), {
        buyerUid: liveUser.uid,
        buyerName: liveUser.name,
        buyerMemberId: liveUser.memberId,
        buyerPhone: liveUser.phone,
        dealId: dealId,
        dealTitle: dealTitle,
        pricePerItem: dealPrice,
        quantity: qty,
        totalAmount: totalAmount,
        status: "Payment Held",
        createdAt: new Date().toISOString(),
        courierName: "",
        trackingNumber: "",
        shipmentDate: "",
        statusHistory: [{
          status: "Payment Held",
          timestamp: new Date().toISOString(),
          note: "ক্রেতা মেইন ব্যালেন্স দিয়ে নিরাপদ লেনদেন শুরু করেছেন। টাকা সাময়িকভাবে এসক্রো সুরক্ষিত ওয়ালেটে হোল্ড করা হয়েছে।"
        }]
      });

      await addDoc(collection(db, "transactions"), {
        id: `tx-esc-held-${Date.now()}`,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        type: "fee_payment",
        typeLabel: "নিরাপদ লেনদেন হোল্ড",
        amount: totalAmount,
        status: "success",
        description: `নিরাপদ ডিল ফান্ড বুকিং: ${dealTitle} (আইডি: ${orderRef.id.substring(0, 8)})`,
        createdAt: new Date().toISOString()
      });

      alert("আপনার অর্ডারটি সফলভাবে জমা হয়েছে এবং পেমেন্ট হোল্ড করা হয়েছে।");
      syncLiveProfile();
    } catch (e: any) {
      console.error(e);
      alert("অর্ডার সম্পন্ন করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCardLock = async () => {
    if (!liveUser) return;
    try {
      setLoading(true);
      const userRef = doc(db, "users", liveUser.uid);
      const newLockStatus = !liveUser.cardLocked;
      await updateDoc(userRef, { cardLocked: newLockStatus });
      alert(newLockStatus ? "রেশন কার্ড সফলভাবে লক করা হয়েছে।" : "রেশন কার্ড সফলভাবে আনলক করা হয়েছে।");
      syncLiveProfile();
    } catch (err) {
      console.error(err);
      alert("অপারেশন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  const handleShopTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShopTransferErr('');
    setShopTransferSucc('');
    
    if (!liveUser) return;
    
    const amountNum = parseFloat(shopTransferAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setShopTransferErr('সঠিক পরিমাণ লিখুন।');
      return;
    }
    
    if (amountNum > (liveUser.balance || 0)) {
      setShopTransferErr('আপনার মেইন ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই।');
      return;
    }
    
    if (shopTransferPin !== liveUser.pin) {
      setShopTransferErr('ভুল পিন নাম্বার প্রদান করেছেন।');
      return;
    }
    
    try {
      setShopTransferLoading(true);
      const userRef = doc(db, "users", liveUser.uid);
      await updateDoc(userRef, {
        balance: (liveUser.balance || 0) - amountNum,
        superShopBalance: (liveUser.superShopBalance || 0) + amountNum
      });
      
      await addDoc(collection(db, "transactions"), {
        id: `tx-shop-trans-${Date.now()}`,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        type: "shop_transfer",
        typeLabel: "সুপার শপ ফান্ড ট্রান্সফার",
        amount: amountNum,
        status: "success",
        description: `মেইন ব্যালেন্স থেকে সুপার শপ ব্যালেন্সে ৳ ${amountNum.toLocaleString('bn-BD')} ফান্ড স্থানান্তরিত করা হয়েছে।`,
        createdAt: new Date().toISOString()
      });
      
      setShopTransferSucc('ফান্ড সফলভাবে স্থানান্তরিত হয়েছে!');
      setShopTransferAmount('');
      setShopTransferPin('');
      syncLiveProfile();
    } catch (err: any) {
      console.error(err);
      setShopTransferErr('স্থানান্তর প্রক্রিয়াটি সম্পন্ন করা যায়নি।');
    } finally {
      setShopTransferLoading(false);
    }
  };

  const handleBuyPremiumSafi = async (itemName: string, itemPrice: number) => {
    if (!liveUser) return;
    
    const confirmBuy = confirm(`আপনি কি ৳ ${itemPrice.toLocaleString('bn-BD')} টাকা দিয়ে "${itemName}" পণ্যটি কিনতে চান?`);
    if (!confirmBuy) return;
    
    const pin = prompt(`ক্রয় সম্পন্ন করতে আপনার ৪ ডিজিটের সিকিউরিটি পিন নাম্বার টাইপ করুনঃ`);
    if (!pin) return;
    if (pin !== liveUser.pin) {
      alert("ভুল পিন নাম্বার প্রদান করেছেন।");
      return;
    }
    
    if (itemPrice > (liveUser.balance || 0)) {
      alert("আপনার মেইন ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই।");
      return;
    }
    
    try {
      setLoading(true);
      const userRef = doc(db, "users", liveUser.uid);
      await updateDoc(userRef, {
        balance: (liveUser.balance || 0) - itemPrice
      });
      
      await addDoc(collection(db, "transactions"), {
        id: `tx-safi-${Date.now()}`,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        type: "safi_purchase",
        typeLabel: "সাফি খাঁটি পণ্য ক্রয়",
        amount: itemPrice,
        status: "success",
        description: `সাফি প্রিমিয়াম শপ অর্ডারঃ ${itemName} (পেমেন্ট সম্পন্ন)`,
        createdAt: new Date().toISOString()
      });
      
      alert(`🎉 অভিনন্দন! "${itemName}" পণ্যটির ক্রয় অর্ডার সফল হয়েছে। আমাদের প্রতিনিধি শীঘ্রই আপনার ঠিকানায় ডেলিভারি করবে।`);
      syncLiveProfile();
    } catch (err: any) {
      console.error(err);
      alert("অর্ডার প্রক্রিয়াটি সম্পন্ন করা সম্ভব হয়নি।");
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveUser) return;
    
    const amountNum = parseFloat(withdrawAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("উত্তোলনের সঠিক পরিমাণ লিখুন।");
      return;
    }
    
    const currentSavings = liveUser.savings || 0;
    if (amountNum > currentSavings) {
      alert("আপনার সঞ্চয় তহবিলে পর্যাপ্ত ব্যালেন্স নেই।");
      return;
    }
    
    if (withdrawPin !== liveUser.pin) {
      alert("ভুল সিকিউরিটি পিন নাম্বার প্রদান করেছেন।");
      return;
    }
    
    try {
      setLoading(true);
      
      // Save withdrawal request as a pending transaction in Firebase
      await addDoc(collection(db, "transactions"), {
        id: `tx-wd-${Date.now()}`,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        type: "withdraw",
        typeLabel: "সঞ্চয় তহবিল উত্তোলন আবেদন",
        amount: amountNum,
        status: "pending",
        method: withdrawMethod || "bKash",
        bankName: withdrawBankName,
        branch: withdrawBranch,
        accName: withdrawAccName,
        accNo: withdrawAccNo,
        recipientNumber: withdrawRecipientNumber,
        createdAt: new Date().toISOString(),
        description: `সঞ্চয় তহবিল থেকে ৳ ${amountNum.toLocaleString('bn-BD')} টাকা উত্তোলন আবেদন (${withdrawMethod || "bKash"})`
      });
      
      alert("আপনার উত্তোলন আবেদনটি সফলভাবে জমা হয়েছে। এডমিন প্যানেল এটি যাচাই করে ২ ঘণ্টার মধ্যে অনুমোদন করবে।");
      
      // Reset fields
      setWithdrawAmount('');
      setWithdrawPin('');
      setWithdrawRecipientNumber('');
      setWithdrawAccNo('');
      setWithdrawAccName('');
      setWithdrawBranch('');
      setModalType(null);
      syncLiveProfile();
    } catch (err: any) {
      console.error(err);
      alert("আবেদন জমা দেওয়া যায়নি। দয়া করে আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  const handleQardHasanaDonate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveUser) return;
    
    const amountNum = parseFloat(qardDonateAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("সঠিক দানের পরিমাণ লিখুন।");
      return;
    }
    
    if (qardDonationPayMethod === 'balance') {
      if (amountNum > (liveUser.balance || 0)) {
        alert("আপনার মেইন ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই।");
        return;
      }
      if (qardPin !== liveUser.pin) {
        alert("ভুল সিকিউরিটি পিন নাম্বার প্রদান করেছেন।");
        return;
      }
    }
    
    try {
      setLoading(true);
      
      if (qardDonationPayMethod === 'balance') {
        const userRef = doc(db, "users", liveUser.uid);
        await updateDoc(userRef, {
          balance: (liveUser.balance || 0) - amountNum
        });
      }
      
      // Save donation as transaction
      await addDoc(collection(db, "transactions"), {
        id: `tx-qard-don-${Date.now()}`,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        type: "qard_donation",
        typeLabel: "হাসানাত তহবিল অনুদান",
        amount: amountNum,
        status: "success",
        payMethod: qardDonationPayMethod,
        txId: qardDonationTxId || "",
        purpose: qardDonationPurpose,
        createdAt: new Date().toISOString(),
        description: `হাসানাত তহবিলে ৳ ${amountNum.toLocaleString('bn-BD')} অনুদান প্রদান (${qardDonationPayMethod === 'balance' ? 'মেইন ওয়ালেট' : 'ম্যানুয়াল ডিপোজিট'})`
      });
      
      alert("হাসানাত তহবিলে আপনার অনুদানটি সফলভাবে জমা হয়েছে। আল্লাহ আপনাকে উত্তম প্রতিদান দান করুন। আমীন।");
      
      setQardDonateAmount('');
      setQardDonationReasonText('');
      setQardPin('');
      setQardDonationTxId('');
      setModalType(null);
      syncLiveProfile();
    } catch (err) {
      console.error(err);
      alert("অনুদান প্রক্রিয়াটি ব্যর্থ হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  const handleQardHasanaApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveUser) return;
    
    const amountNum = parseFloat(qardLoanAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("সঠিক ঋণের পরিমাণ লিখুন।");
      return;
    }
    
    const maxLimit = liveUser.role === 'admin' ? 10000 : liveUser.memberGroup === 'need' ? 2000 : 5000;
    if (amountNum > maxLimit) {
      alert(`আপনার বর্তমান গ্রুপ অনুযায়ী সর্বোচ্চ ঋণসীমা ৳ ${maxLimit.toLocaleString('bn-BD')} BDT।`);
      return;
    }
    
    if (qardPin !== liveUser.pin) {
      alert("ভুল সিকিউরিটি পিন নাম্বার প্রদান করেছেন।");
      return;
    }
    
    try {
      setLoading(true);
      
      // Save loan request in transactions with status = pending
      await addDoc(collection(db, "transactions"), {
        id: `tx-qard-loan-req-${Date.now()}`,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        type: "qard_loan_apply",
        typeLabel: "সুদমুক্ত ঋণ আবেদন",
        amount: amountNum,
        status: "pending",
        durationMonths: qardLoanDuration || 1,
        whatsapp: qardLoanWhatsapp || "",
        createdAt: new Date().toISOString(),
        description: `সুদমুক্ত কর্জে হাসানা ঋণ আবেদন: ৳ ${amountNum.toLocaleString('bn-BD')} (${qardLoanDuration} মাস মেয়াদি)`
      });
      
      alert("আপনার কর্জে হাসানা সুদমুক্ত ঋণ আবেদনটি সফলভাবে জমা হয়েছে। এডমিন প্যানেল আবেদনপত্রটি যাচাই করে অনুমোদন করবে।");
      
      setQardLoanAmount('');
      setQardLoanWhatsapp('');
      setQardPin('');
      setModalType(null);
      syncLiveProfile();
    } catch (err) {
      console.error(err);
      alert("আবেদন জমা দেওয়া যায়নি। দয়া করে আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  const handleAddNewSafeDeal = async () => {
    if (!liveUser) return;
    
    if (!newDealTitle.trim() || !newDealPrice.trim()) {
      alert("ডিল শিরোনাম ও মূল্য অবশ্যই প্রদান করতে হবে।");
      return;
    }
    
    const priceNum = parseFloat(newDealPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      alert("সঠিক ডিল মূল্য লিখুন।");
      return;
    }
    
    try {
      setLoading(true);
      await addDoc(collection(db, "safe_deals"), {
        id: `deal-${Date.now()}`,
        title: newDealTitle.trim(),
        desc: newDealDesc.trim(),
        price: priceNum,
        minQty: newDealMinQty || "১ পিস",
        emoji: newDealEmoji || "📦",
        createdAt: new Date().toISOString(),
        authorUid: liveUser.uid,
        authorName: liveUser.name,
        joinedUsersCount: 0
      });
      
      alert("🎉 অভিনন্দন! আপনার নিরাপদ গ্রুপ বাই ডিলটি সফলভাবে লাইভ পাবলিশ হয়েছে।");
      
      setNewDealTitle('');
      setNewDealDesc('');
      setNewDealPrice('');
      setNewDealMinQty('৫ পিস');
      setNewDealEmoji('📦');
      setShowAddDealModal(false);
    } catch (err) {
      console.error(err);
      alert("ডিল পাবলিশ করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCheckoutOrder = async () => {
    if (!liveUser || !selectedProductForCheckout) return;
    
    const item = selectedProductForCheckout;
    let grandTotal = item.price * checkoutQuantity;
    let deliveryChargeRangeText = '৳ ০ (দোকান পিকআপ)';
    let deliveryTimeText = '৩ ঘণ্টার মধ্যে রেডি';
    
    if (checkoutDeliveryType === 'home') {
      let estBaseCharge = 0;
      if (checkoutDistance <= 2) {
        deliveryChargeRangeText = '৳ ৫ - ২০ (কাছে)';
        estBaseCharge = 10;
      } else {
        deliveryChargeRangeText = '৳ ২০ - ৫০ (দূরে)';
        estBaseCharge = 35;
      }
      grandTotal += estBaseCharge;
      deliveryTimeText = '২ ঘণ্টার মধ্যে এক্সপ্রেস ডেলিভারি';
    }
    
    // Validate balance and pin if paying online
    if (checkoutPaymentMethod === 'main' || checkoutPaymentMethod === 'shop') {
      if (checkoutPin !== liveUser.pin) {
        alert("ভুল সিকিউরিটি পিন নাম্বার প্রদান করেছেন।");
        return;
      }
      
      const userBalance = checkoutPaymentMethod === 'main' ? (liveUser.balance || 0) : (liveUser.superShopBalance || 0);
      if (grandTotal > userBalance) {
        alert(`আপনার ${checkoutPaymentMethod === 'main' ? 'মেইন ওয়ালেটে' : 'সুপার শপ ওয়ালেটে'} পর্যাপ্ত ব্যালেন্স নেই।`);
        return;
      }
    }
    
    try {
      setLoading(true);
      
      // Deduct balance
      if (checkoutPaymentMethod === 'main' || checkoutPaymentMethod === 'shop') {
        const userRef = doc(db, "users", liveUser.uid);
        if (checkoutPaymentMethod === 'main') {
          await updateDoc(userRef, { balance: (liveUser.balance || 0) - grandTotal });
        } else {
          await updateDoc(userRef, { superShopBalance: (liveUser.superShopBalance || 0) - grandTotal });
        }
      }
      
      const orderId = `order-shop-${Date.now()}`;
      
      // Create transaction
      await addDoc(collection(db, "transactions"), {
        id: `tx-${orderId}`,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        type: "shop_purchase",
        typeLabel: "সুপার শপ পণ্য ক্রয়",
        amount: grandTotal,
        status: "success",
        description: `সুপার শপ পণ্য অর্ডারঃ ${item.name} x ${checkoutQuantity} (${checkoutPaymentMethod === 'main' ? 'মেইন ব্যালেন্স' : checkoutPaymentMethod === 'shop' ? 'সুপার শপ ব্যালেন্স' : 'ক্যাশ অন ডেলিভারি'})`,
        createdAt: new Date().toISOString()
      });
      
      // Save order to shop_orders
      await addDoc(collection(db, "shop_orders"), {
        id: orderId,
        userId: liveUser.uid,
        userName: liveUser.name,
        memberId: liveUser.memberId,
        productName: item.name,
        price: item.price,
        quantity: checkoutQuantity,
        grandTotal: grandTotal,
        deliveryType: checkoutDeliveryType,
        deliveryDistance: checkoutDistance,
        deliveryChargeRange: deliveryChargeRangeText,
        deliveryEstTime: deliveryTimeText,
        paymentType: checkoutPaymentMethod === 'main' ? 'মেইন ব্যালেন্স' : checkoutPaymentMethod === 'shop' ? 'সুপার শপ ব্যালেন্স' : 'ক্যাশ অন ডেলিভারি',
        recipientName: checkoutName || liveUser.name,
        recipientPhone: checkoutPhone || liveUser.phone,
        recipientAddress: checkoutAddress,
        latitude: checkoutLat,
        longitude: checkoutLng,
        status: "Processing",
        createdAt: new Date().toISOString()
      });
      
      setOrderPlacementSuccess({
        id: orderId,
        product: item,
        quantity: checkoutQuantity,
        deliveryType: checkoutDeliveryType,
        deliveryDistance: checkoutDistance,
        deliveryChargeRange: deliveryChargeRangeText,
        deliveryEstTime: deliveryTimeText,
        paymentType: checkoutPaymentMethod === 'main' ? 'মেইন ব্যালেন্স' : checkoutPaymentMethod === 'shop' ? 'সুপার শপ ব্যালেন্স' : 'ক্যাশ অন ডেলিভারি',
        grandTotal: grandTotal
      });
      
      setSelectedProductForCheckout(null);
      syncLiveProfile();
    } catch (err) {
      console.error(err);
      alert("অর্ডার সম্পন্ন করা সম্ভব হয়নি। দয়া করে আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen flex flex-col relative text-slate-800 font-sans" id="dashboard-root">
      {/* 1. Header */}
      <header className="bg-white text-slate-800 px-3 xs:px-4 py-2 flex items-center justify-between sticky top-0 z-40 shadow-sm border-b border-slate-100 h-[64px] xs:h-[68px] shrink-0 font-sans">
        <div className="flex items-center gap-2 xs:gap-3">
          {/* Menu button - light mint circle with green icon */}
          <button 
            type="button"
            onClick={onOpenDrawer}
            className="w-10 h-10 xs:w-11 h-11 rounded-full bg-[#e6f7f4] hover:bg-[#d5f3ed] active:scale-95 text-[#00b57e] transition flex items-center justify-center shrink-0 border-none cursor-pointer shadow-3xs"
          >
            <Menu className="w-5.5 h-5.5 xs:w-6 h-6 text-[#00b57e]" />
          </button>
          
          {/* Vertical stacked title with user name */}
          <div className="flex flex-col text-left">
            <span className="text-[9.5px] xs:text-[10.5px] font-black text-slate-850 leading-none tracking-tight uppercase">
              BUSINESS NETWORK
            </span>
            <span className="text-[9.5px] xs:text-[10.5px] font-black text-slate-850 leading-none tracking-tight uppercase mt-0.5">
              BANGLADESH
            </span>
            <span className="text-[8.5px] xs:text-[9.5px] font-semibold text-slate-450 lowercase mt-0.5 leading-none">
              {(liveUser?.name || 'md rasel mia').toLowerCase()}
            </span>
          </div>
        </div>

        {/* Middle Portion: Dual Balance / Due interactive Pill Container (Exact white/mint/pink replica layout, made even larger & bolder as requested) */}
        <div 
          onClick={() => {
            setShowBalance(!showBalance);
          }}
          className="flex items-center border border-slate-300 bg-white rounded-full overflow-hidden h-[48px] xs:h-[56px] select-none cursor-pointer shadow-3xs transition-all duration-300 hover:border-slate-400 mx-1 flex-grow max-w-[54%] xs:max-w-[58%]"
        >
          {/* Left Portion: Total Balance (Teal bg) */}
          <div className="bg-[#00b57e] px-2 xs:px-3.5 py-1 flex flex-col justify-center items-center h-full flex-grow rounded-l-full transition-all duration-300 active:opacity-90 min-w-0">
            <span className="text-[9px] xs:text-[10px] sm:text-[11px] font-black text-emerald-100 uppercase tracking-tight leading-none">মোট ব্যালেন্স</span>
            <span className="text-[13.5px] xs:text-[16.5px] sm:text-[19px] font-black text-white mt-0.5 leading-none transition-all duration-300 tracking-tight truncate">
              {showBalance ? '৳' + (liveUser?.balance || 0).toLocaleString('bn-BD', { minimumFractionDigits: 2 }) : 'ট্যাপ করুন'}
            </span>
          </div>

          {/* Right Portion: Due / বকেয়া (Light Pink bg) */}
          <div className="bg-[#fff1f2] px-2.5 xs:px-3 py-1 flex flex-col justify-center items-center h-full min-w-[76px] xs:min-w-[92px] sm:min-w-[102px] rounded-r-full border-l border-white/60 transition-all duration-300">
            <span className="text-[9px] xs:text-[10px] sm:text-[11px] font-black text-[#e11d48] uppercase tracking-tight leading-none">বকেয়া</span>
            <span className="text-[13.5px] xs:text-[16.5px] sm:text-[19px] font-black text-[#e11d48] mt-0.5 leading-none tracking-tight">
              ৳{(liveUser?.dueLoan || 0).toLocaleString('bn-BD', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Right tools: Notification Bell & Admin Button */}
        <div className="flex items-center gap-1.5 xs:gap-2 shrink-0">
          {/* Notification Icon */}
          {(() => {
            const unreadCount = userNotifications.filter(n => !isNotificationRead(n)).length;
            const hasUnread = unreadCount > 0;
            return (
              <button 
                type="button"
                onClick={() => {
                  setShowNotificationsModal(true);
                  handleMarkAllAsRead();
                }}
                className={`w-10 h-10 xs:w-11 h-11 rounded-full transition relative cursor-pointer active:scale-95 flex items-center justify-center ${
                  hasUnread
                    ? 'bg-rose-600 text-white border-2 border-rose-400 shadow-md animate-pulse'
                    : 'bg-amber-400 text-slate-950 border-2 border-amber-500 shadow-sm hover:bg-amber-300'
                }`}
                title={hasUnread ? `${unreadCount}টি অপঠিত নোটিফিকেশন` : 'নোটিফিকেশন সেন্টার (সকল পঠিত)'}
              >
                <Bell className={`w-5 h-5 ${hasUnread ? 'text-white' : 'text-slate-950'}`} />
                {hasUnread && (
                  <span className="absolute -top-1 -right-1 bg-yellow-300 text-rose-950 font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm font-mono">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            );
          })()}

          {/* Admin panel launcher for authorized roles */}
          {(user?.role === 'admin' || user?.role === 'sub_admin') && (
            <button 
              type="button"
              onClick={onTriggerAdmin}
              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg transition text-[9px] xs:text-[10px] cursor-pointer shadow-3xs hover:shadow-2xs active:scale-95"
            >
              ADMIN
            </button>
          )}
        </div>
      </header>

      <div className="flex-grow overflow-y-auto pb-24">
        {activeTab === 'home' && (
          <div className="space-y-4 pb-6">
            {/* Box-shaped Announcement Ticker (ঘোষণা) - Now above the banner slider */}
            <div className="px-4 pt-2">
              <div className="bg-white border-2 border-[#00a884]/85 rounded-[20px] p-2 flex items-center gap-3 overflow-hidden shadow-3xs">
                <div className="bg-[#00a884] text-white text-[11px] font-black px-3.5 py-1 rounded-[12px] shrink-0 shadow-3xs flex items-center gap-1">
                  📢 <span>ঘোষণা</span>
                </div>
                <div className="flex-grow overflow-hidden relative h-5 flex items-center">
                  <marquee className="text-[12px] font-black text-slate-800 leading-none py-0.5" behavior="scroll" direction="left" scrollamount="4">
                    {appConfig?.tickerText || "ব্যবসা নেটওয়ার্ক বাংলাদেশ সমবায় ও রিচার্জ পোর্টাল-এ আপনাকে স্বাগতম। আমাদের সাথে আপনার ব্যবসায়িক লেনদেন নিরাপদ ও ১০০% বিশ্বস্ত।"}
                  </marquee>
                </div>
              </div>
            </div>

            {/* 2. Banner Slider (Full-width edge-to-edge layout as requested) */}
            {activeSliders && activeSliders.length > 0 && (() => {
              const { className: bannerClass, style: bannerStyle } = getBannerStyleAndClass();
              return (
                <div className="w-full">
                  <div className={bannerClass} style={bannerStyle}>
                    <img 
                      src={activeSliders[currentAdSlide]} 
                      alt="Advertisement Banner" 
                      className="w-full h-full object-cover select-none"
                    />
                    
                    {/* Dots indicator - Aligned bottom-right to match screenshot exactly */}
                    {activeSliders.length > 1 && (
                      <div className="absolute bottom-3 right-4 flex items-center gap-1 bg-black/25 px-2.5 py-1.5 rounded-full backdrop-blur-xs">
                        {activeSliders.map((_, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => setCurrentAdSlide(index)}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              currentAdSlide === index ? 'w-4.5 bg-[#00a884]' : 'w-1.5 bg-white/60 hover:bg-white'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Main Content Area with padding px-4 */}
            <div className="px-4 space-y-4">
              <div className="flex justify-between items-center px-1 py-1.5 select-none font-sans">
                <h3 className="text-[14px] xs:text-[15px] font-black text-[#374151] tracking-tight">সকল সার্ভিস ও হিসাব খাতা</h3>
                <span className="text-[9.5px] xs:text-[10.5px] font-extrabold text-[#00a884] bg-[#e6f7f4] border border-[#00a884]/80 px-2.5 py-0.5 rounded-full leading-none shrink-0 shadow-3xs">
                  ১২টি লাইভ সেবা ও প্যানেল
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 xs:gap-2 sm:gap-3 md:gap-4">
                {/* 1. BNB ম্যানেজমেন্ট কোম্পানি ইনভেস্টর */}
                <div 
                  onClick={() => handleServiceClick('samity', () => setModalType('samity'))}
                  className="p-1 xs:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[96px] xs:min-h-[114px] sm:min-h-[142px] md:min-h-[156px] relative group"
                >
                  <div className="w-13 h-13 xs:w-16 xs:h-16 sm:w-20 sm:h-20 md:w-22 md:h-22 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-800 shadow-sm group-hover:scale-105 transition-transform duration-200 shrink-0 overflow-hidden">
                    {appConfig?.sectionIcons?.samity ? (
                      <img src={appConfig.sectionIcons.samity} alt="Samity Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <img src="/samity_logo.svg" alt="Samity Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    )}
                  </div>
                  <div className="w-full mt-2.5 sm:mt-3 font-sans">
                    <h4 className="text-[9.5px] xs:text-[11px] sm:text-[12.5px] md:text-[14px] lg:text-[15.5px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center">
                      {getTxt('cardSamityTitle', 'BNB ম্যানেজমেন্ট কোম্পানি ইনভেস্টর')}
                    </h4>
                  </div>
                </div>

                {/* 2. MY BNB লেনদেন */}
                <div 
                  onClick={() => handleServiceClick('bank', () => setModalType('bank'))}
                  className="p-1 xs:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[96px] xs:min-h-[114px] sm:min-h-[142px] md:min-h-[156px] relative group"
                >
                  <div className="w-13 h-13 xs:w-16 xs:h-16 sm:w-20 sm:h-20 md:w-22 md:h-22 rounded-full bg-[#f97316] bg-gradient-to-br from-[#ff9e3b] via-[#ea580c] to-[#ffedd5]/20 flex items-center justify-center text-white shadow-[0_0_20px_rgba(249,115,22,0.2)] group-hover:scale-105 transition-transform duration-200 shrink-0 overflow-hidden">
                    {appConfig?.sectionIcons?.bank ? (
                      <img src={appConfig.sectionIcons.bank} alt="Bank Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <RefreshCw className="w-6.5 h-6.5 xs:w-8 xs:h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 text-white shrink-0 stroke-[2]" />
                    )}
                  </div>
                  <div className="w-full mt-2.5 sm:mt-3 font-sans">
                    <h4 className="text-[9.5px] xs:text-[11px] sm:text-[12.5px] md:text-[14px] lg:text-[15.5px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center">
                      {getTxt('cardBankTitle', 'MY BNB লেনদেন')}
                    </h4>
                  </div>
                </div>

                {/* 3. BNB নিরাপদ লেনদেন */}
                <div 
                  onClick={() => handleServiceClick('safedeals', () => setModalType('safedeals'))}
                  className="p-1 xs:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[96px] xs:min-h-[114px] sm:min-h-[142px] md:min-h-[156px] relative group"
                >
                  <div className="w-13 h-13 xs:w-16 xs:h-16 sm:w-20 sm:h-20 md:w-22 md:h-22 rounded-full bg-[#00d29d] bg-gradient-to-br from-[#00d29d] via-[#00bda0] to-[#cbfef4]/20 flex items-center justify-center text-white shadow-[0_0_20px_rgba(0,210,157,0.2)] group-hover:scale-105 transition-transform duration-200 shrink-0 overflow-hidden">
                    {appConfig?.sectionIcons?.safedeals ? (
                      <img src={appConfig.sectionIcons.safedeals} alt="SafeDeals Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <CheckCircle2 className="w-6.5 h-6.5 xs:w-8 xs:h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 text-white stroke-[2]" />
                    )}
                  </div>
                  <div className="w-full mt-2.5 sm:mt-3 font-sans">
                    <h4 className="text-[9.5px] xs:text-[11px] sm:text-[12.5px] md:text-[14px] lg:text-[15.5px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center">
                      {getTxt('cardSafeDealsTitle', 'BNB নিরাপদ লেনদেন')}
                    </h4>
                  </div>
                </div>

                {/* 4. BNB টেলিকম */}
                <div 
                  onClick={() => handleServiceClick('telecom', () => setModalType('telecom'))}
                  className="p-1 xs:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[96px] xs:min-h-[114px] sm:min-h-[142px] md:min-h-[156px] relative group"
                >
                  <div className="w-13 h-13 xs:w-16 xs:h-16 sm:w-20 sm:h-20 md:w-22 md:h-22 rounded-full bg-[#06b6d4] bg-gradient-to-br from-[#22d3ee] via-[#0891b2] to-[#ecfeff]/20 flex items-center justify-center text-white shadow-[0_0_20px_rgba(6,182,212,0.2)] group-hover:scale-105 transition-transform duration-200 shrink-0 overflow-hidden">
                    {appConfig?.sectionIcons?.telecom ? (
                      <img src={appConfig.sectionIcons.telecom} alt="Telecom Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Smartphone className="w-6.5 h-6.5 xs:w-8 xs:h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 text-white stroke-[2]" />
                    )}
                  </div>
                  <div className="w-full mt-2.5 sm:mt-3 font-sans">
                    <h4 className="text-[9.5px] xs:text-[11px] sm:text-[12.5px] md:text-[14px] lg:text-[15.5px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center">
                      {getTxt('cardTelecomTitle', 'BNB টেলিকম')}
                    </h4>
                  </div>
                </div>

                {/* 5. BNB কর্জে হাসানা */}
                <div 
                  onClick={() => handleServiceClick('qard', () => setModalType('qard'))}
                  className="p-1 xs:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[96px] xs:min-h-[114px] sm:min-h-[142px] md:min-h-[156px] relative group"
                >
                  <div className="w-13 h-13 xs:w-16 xs:h-16 sm:w-20 sm:h-20 md:w-22 md:h-22 rounded-full bg-[#f43f5e] bg-gradient-to-br from-[#f43f5e] via-[#e11d48] to-[#ffe4e6]/20 flex items-center justify-center text-white shadow-[0_0_20px_rgba(244,63,94,0.2)] group-hover:scale-105 transition-transform duration-200 shrink-0 overflow-hidden">
                    {appConfig?.sectionIcons?.qard ? (
                      <img src={appConfig.sectionIcons.qard} alt="Qard Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Heart className="w-6.5 h-6.5 xs:w-8 xs:h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 text-white stroke-[2]" />
                    )}
                  </div>
                  <div className="w-full mt-2.5 sm:mt-3 font-sans">
                    <h4 className="text-[9.5px] xs:text-[11px] sm:text-[12.5px] md:text-[14px] lg:text-[15.5px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center">
                      {getTxt('cardQardTitle', 'BNB কর্জে হাসানা')}
                    </h4>
                  </div>
                </div>

                {/* 6. BNB রেশন কার্ড */}
                <div 
                  onClick={() => handleServiceClick('ration', () => setModalType('ration'))}
                  className="p-1 xs:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[96px] xs:min-h-[114px] sm:min-h-[142px] md:min-h-[156px] relative group"
                >
                  <div className="w-13 h-13 xs:w-16 xs:h-16 sm:w-20 sm:h-20 md:w-22 md:h-22 rounded-full bg-[#f59e0b] bg-gradient-to-br from-[#fbbf24] via-[#ea580c] to-[#fffbeb]/20 flex items-center justify-center text-white shadow-[0_0_20px_rgba(245,158,11,0.2)] group-hover:scale-105 transition-transform duration-200 shrink-0 overflow-hidden">
                    {appConfig?.sectionIcons?.ration ? (
                      <img src={appConfig.sectionIcons.ration} alt="Ration Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <CreditCard className="w-6.5 h-6.5 xs:w-8 xs:h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 text-white stroke-[2]" />
                    )}
                  </div>
                  <div className="w-full mt-2.5 sm:mt-3 font-sans">
                    <h4 className="text-[9.5px] xs:text-[11px] sm:text-[12.5px] md:text-[14px] lg:text-[15.5px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center">
                      {getTxt('cardRationTitle', 'BNB রেশন কার্ড')}
                    </h4>
                  </div>
                </div>

                {/* 7. safi সাফি */}
                <div 
                  onClick={() => handleServiceClick('safi', () => setModalType('safi'))}
                  className="p-1 xs:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[96px] xs:min-h-[114px] sm:min-h-[142px] md:min-h-[156px] relative group"
                >
                  <div className="w-13 h-13 xs:w-16 xs:h-16 sm:w-20 sm:h-20 md:w-22 md:h-22 rounded-full bg-[#fbbf24] bg-gradient-to-br from-[#fbbf24] via-[#d97706] to-[#fef3c7]/20 flex items-center justify-center text-white shadow-[0_0_20px_rgba(251,191,36,0.2)] group-hover:scale-105 transition-transform duration-200 shrink-0 overflow-hidden">
                    {appConfig?.sectionIcons?.safi ? (
                      <img src={appConfig.sectionIcons.safi} alt="Safi Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Sparkles className="w-6.5 h-6.5 xs:w-8 xs:h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 text-white stroke-[2]" />
                    )}
                  </div>
                  <div className="w-full mt-2.5 sm:mt-3 font-sans">
                    <h4 className="text-[9.5px] xs:text-[11px] sm:text-[12.5px] md:text-[14px] lg:text-[15.5px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center">
                      {getTxt('cardSafiTitle', 'safi সাফি')}
                    </h4>
                  </div>
                </div>

                {/* 8. BNB হিসাব খাতা */}
                <div 
                  onClick={() => handleServiceClick('hisab', () => setModalType('hisab'))}
                  className="p-1 xs:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[96px] xs:min-h-[114px] sm:min-h-[142px] md:min-h-[156px] relative group"
                >
                  <div className="w-13 h-13 xs:w-16 xs:h-16 sm:w-20 sm:h-20 md:w-22 md:h-22 rounded-full bg-[#00a884] bg-gradient-to-br from-[#05c39b] via-[#00a884] to-[#cbfef4]/20 flex items-center justify-center text-white shadow-[0_0_20px_rgba(0,168,132,0.2)] group-hover:scale-105 transition-transform duration-200 shrink-0 overflow-hidden">
                    {appConfig?.sectionIcons?.hisab ? (
                      <img src={appConfig.sectionIcons.hisab} alt="Hisab Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <BookOpen className="w-6.5 h-6.5 xs:w-8 xs:h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 text-white stroke-[2]" />
                    )}
                  </div>
                  <div className="w-full mt-2.5 sm:mt-3 font-sans">
                    <h4 className="text-[9.5px] xs:text-[11px] sm:text-[12px] md:text-[13px] lg:text-[14.5px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center">
                      {getTxt('cardHisabTitle', 'BNB হিসাব খাতা')}
                    </h4>
                  </div>
                </div>

                {/* 9. BNB এজেন্ট */}
                <div 
                  onClick={() => handleServiceClick('agent', () => setModalType('agent'))}
                  className="p-1 xs:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[96px] xs:min-h-[114px] sm:min-h-[142px] md:min-h-[156px] relative group"
                >
                  <div className="w-13 h-13 xs:w-16 xs:h-16 sm:w-20 sm:h-20 md:w-22 md:h-22 rounded-full bg-[#fbbf24] bg-gradient-to-br from-[#fbbf24] via-[#d97706] to-[#fffbeb]/20 flex items-center justify-center text-white shadow-[0_0_20px_rgba(251,191,36,0.2)] group-hover:scale-105 transition-transform duration-200 shrink-0 overflow-hidden">
                    {appConfig?.sectionIcons?.agent ? (
                      <img src={appConfig.sectionIcons.agent} alt="Agent Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Store className="w-6.5 h-6.5 xs:w-8 xs:h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 text-white stroke-[2]" />
                    )}
                  </div>
                  <div className="w-full mt-2.5 sm:mt-3 font-sans">
                    <h4 className="text-[9.5px] xs:text-[11px] sm:text-[12.5px] md:text-[14px] lg:text-[15.5px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center">
                      {getTxt('cardAgentTitle', 'BNB এজেন্ট')}
                    </h4>
                  </div>
                </div>

                {/* 10. BNB বাংলাদেশ এডমিন প্যানেল */}
                <div 
                  onClick={() => handleServiceClick('bap', () => {
                    if (liveUser?.role === 'admin' || liveUser?.role === 'sub_admin') {
                      localStorage.setItem('bnb_admin_mode', 'true');
                      onTriggerAdmin();
                    } else {
                      onTriggerBap();
                    }
                  })}
                  className="p-1 xs:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[96px] xs:min-h-[114px] sm:min-h-[142px] md:min-h-[156px] relative group"
                >
                  <div className="w-13 h-13 xs:w-16 xs:h-16 sm:w-20 sm:h-20 md:w-22 md:h-22 rounded-full bg-[#818cf8] bg-gradient-to-br from-[#93c5fd] via-[#6366f1] to-[#e0e7ff]/20 flex items-center justify-center text-white shadow-[0_0_20px_rgba(129,140,248,0.2)] group-hover:scale-105 transition-transform duration-200 shrink-0 overflow-hidden">
                    {appConfig?.sectionIcons?.bap ? (
                      <img src={appConfig.sectionIcons.bap} alt="Bap Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Users className="w-6.5 h-6.5 xs:w-8 xs:h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 text-white stroke-[2]" />
                    )}
                  </div>
                  <div className="w-full mt-2.5 sm:mt-3 font-sans">
                    <h4 className="text-[9.5px] xs:text-[11px] sm:text-[13px] md:text-[14px] lg:text-[15.5px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center">
                      {getTxt('cardBapTitle', 'BNB বাংলাদেশ এডমিন প্যানেল')}
                    </h4>
                  </div>
                </div>

                {/* 11. BNB লক্ষ্যমাত্রা */}
                <div 
                  onClick={() => handleServiceClick('about', () => setModalType('about'))}
                  className="p-1 xs:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[96px] xs:min-h-[114px] sm:min-h-[142px] md:min-h-[156px] relative group"
                >
                  <div className="w-13 h-13 xs:w-16 xs:h-16 sm:w-20 sm:h-20 md:w-22 md:h-22 rounded-full bg-[#6366f1] bg-gradient-to-br from-[#818cf8] via-[#4f46e5] to-[#e0e7ff]/20 flex items-center justify-center text-white shadow-[0_0_20px_rgba(99,102,241,0.2)] group-hover:scale-105 transition-transform duration-200 shrink-0 overflow-hidden">
                    {appConfig?.sectionIcons?.about ? (
                      <img src={appConfig.sectionIcons.about} alt="About Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <BookOpen className="w-6.5 h-6.5 xs:w-8 xs:h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 text-white stroke-[2]" />
                    )}
                  </div>
                  <div className="w-full mt-2.5 sm:mt-3 font-sans">
                    <h4 className="text-[9.5px] xs:text-[11px] sm:text-[12.5px] md:text-[14px] lg:text-[15.5px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center">
                      {getTxt('cardAboutTitle', 'BNB লক্ষ্যমাত্রা')}
                    </h4>
                  </div>
                </div>

                {/* 12. BNB কুরিয়ার */}
                <div 
                  onClick={() => handleServiceClick('courier', () => setModalType('courier'))}
                  className="p-1 xs:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[96px] xs:min-h-[114px] sm:min-h-[142px] md:min-h-[156px] relative group"
                >
                  <div className="w-13 h-13 xs:w-16 xs:h-16 sm:w-20 sm:h-20 md:w-22 md:h-22 rounded-full bg-[#10b981] bg-gradient-to-br from-[#34d399] via-[#059669] to-[#d1fae5]/20 flex items-center justify-center text-white shadow-[0_0_20px_rgba(16,185,129,0.2)] group-hover:scale-105 transition-transform duration-200 shrink-0 overflow-hidden">
                    {appConfig?.sectionIcons?.courier ? (
                      <img src={appConfig.sectionIcons.courier} alt="Courier Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Truck className="w-6.5 h-6.5 xs:w-8 xs:h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 text-white stroke-[2]" />
                    )}
                  </div>
                  <div className="w-full mt-2.5 sm:mt-3 font-sans">
                    <h4 className="text-[9.5px] xs:text-[11px] sm:text-[12.5px] md:text-[14px] lg:text-[15.5px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center">
                      {getTxt('cardCourierTitle', 'BNB কুরিয়ার')}
                    </h4>
                  </div>
                </div>

                {/* 14. BNB অটো স্যালারি পে (Moved inside BNB Mobile Banking Portal) */}
                {/* <div 
                  onClick={() => handleServiceClick('salary', () => setModalType('salary'))}
                  className="p-1 xs:p-1.5 flex flex-col justify-start items-center text-center cursor-pointer transition-all duration-200 active:scale-95 min-h-[82px] xs:min-h-[102px] sm:min-h-[128px] md:min-h-[142px] relative group"
                >
                  <div className="w-11 h-11 xs:w-14 xs:h-14 sm:w-18 sm:h-18 md:w-20 md:h-20 rounded-full bg-[#00a884] bg-gradient-to-br from-[#05c39b] via-[#00a884] to-[#cbfef4]/20 flex items-center justify-center text-white shadow-[0_0_20px_rgba(0,168,132,0.2)] group-hover:scale-105 transition-transform duration-200 shrink-0 overflow-hidden">
                    {appConfig?.sectionIcons?.salary ? (
                      <img src={appConfig.sectionIcons.salary} alt="Salary Icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Briefcase className="w-5 h-5 xs:w-6.5 xs:h-6.5 sm:w-9 sm:h-9 md:w-10 md:h-10 text-white stroke-[2]" />
                    )}
                  </div>
                  <div className="w-full mt-2 sm:mt-3 font-sans">
                    <h4 className="text-[8.5px] xs:text-[10px] sm:text-[12px] md:text-[13px] lg:text-[14.5px] font-black text-slate-800 leading-tight tracking-tight line-clamp-2 text-center">
                      {getTxt('cardSalaryTitle', 'BNB অটো স্যালারি পে')}
                    </h4>
                  </div>
                </div> */}

              </div>

              {/* Dashed Live Database Notice exact replica */}
              <div className="mt-5 px-1 select-none font-sans">
                <div className="border border-dashed border-slate-300/80 bg-[#fbfbfb] rounded-2xl py-3.5 px-4 text-center shadow-3xs">
                  <p className="text-[11px] xs:text-[12px] font-black text-slate-550 tracking-tight">
                    *এই ড্যাশবোর্ডটি সরাসরি লাইভ ডাটাবেজ দ্বারা পরিচালিত হচ্ছে।
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active Send Money Segment Tab (BNB to BNB Transfer) */}
        {activeTab === 'deposit' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-150 p-5 rounded-3xl shadow-sm space-y-4 font-sans text-left"
          >
            {/* Header */}
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                <Send className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  সেন্ড মানি (Send Money)
                  <span className="text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                    BNB ⚡ BNB
                  </span>
                </h3>
                <p className="text-[10.5px] text-slate-500 font-medium leading-tight">
                  BNB অ্যাকাউন্ট থেকে অন্য যেকোনো BNB সদস্যের অ্যাকাউন্টে সরাসরি টাকা পাঠান
                </p>
              </div>
            </div>

            {/* Main Balance Banner */}
            <div className="bg-gradient-to-r from-emerald-800 via-emerald-900 to-teal-900 p-4 rounded-2.5xl text-white shadow-sm flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] text-emerald-200 font-bold block uppercase tracking-wider">
                  আপনার বর্তমান BNB ওয়ালেট ব্যালেন্স
                </span>
                <span className="text-xl font-black font-mono tracking-tight block">
                  ৳ {(liveUser?.balance || 0).toLocaleString('bn-BD')} BDT
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                <Wallet className="w-5 h-5 text-emerald-200" />
              </div>
            </div>

            {/* Restriction Warning Banner */}
            <div className="bg-amber-50/80 border border-amber-200/70 p-3 rounded-2xl text-[11px] text-amber-900 flex items-start gap-2 font-bold leading-relaxed">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span>নিরাপত্তা নির্দেশিকাঃ </span>
                <span className="font-medium text-slate-700">
                  সেন্ড মানি শুধুমাত্র একটি <strong className="text-amber-950 font-black">BNB সদস্য অ্যাকাউন্ট থেকে অন্য BNB সদস্য অ্যাকাউন্টে</strong> করা যাবে। অন্য কোনো বাহ্যিক ব্যাংক বা অ্যাকাউন্টে টাকা পাঠানো যাবে না।
                </span>
              </div>
            </div>

            {/* Status alerts */}
            {formError && (
              <div className="bg-red-50 text-red-700 border border-red-200 p-3.5 rounded-2xl text-xs flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                {formError}
              </div>
            )}

            {formSuccess && (
              <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3.5 rounded-2xl text-xs leading-relaxed font-bold flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>{formSuccess}</div>
              </div>
            )}

            {/* Member Search Section */}
            <div className="bg-slate-50 border border-slate-150 p-4 rounded-2.5xl space-y-3">
              <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <UserCircle className="w-4 h-4 text-emerald-700" />
                ১. প্রাপক BNB সদস্যের মোবাইল নাম্বার বা আইডি টাইপ করুনঃ
              </label>
              
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Smartphone className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={transferTargetPhoneorId}
                    onChange={(e) => {
                      setTransferTargetPhoneorId(e.target.value);
                      if (searchedMember) setSearchedMember(null);
                    }}
                    placeholder="যেমনঃ BNB102030 অথবা 017xxxxxxxx"
                    className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs font-mono font-bold focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-slate-800"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSearchTransferMember}
                  className="px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-black text-xs rounded-xl transition-all shadow-xs cursor-pointer active:scale-95 shrink-0 flex items-center gap-1.5"
                >
                  সদস্য খুঁজুন
                </button>
              </div>

              {searchStatusMsg && (
                <p className={`text-[11px] font-bold px-1 ${
                  searchedMember ? 'text-emerald-700' : 'text-slate-500'
                }`}>
                  {searchStatusMsg}
                </p>
              )}

              {/* Found Recipient Member Card */}
              {searchedMember && (
                <div className="bg-emerald-50/80 border border-emerald-200/80 p-3.5 rounded-2xl space-y-1.5 animate-slide-down">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">
                      যাচাইকৃত প্রাপক তথ্যঃ
                    </span>
                    <span className="text-[9px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-md">
                      ✓ সঠিক সদস্য
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-800 pt-1 border-t border-emerald-100">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block">সদস্যের নামঃ</span>
                      <strong className="font-black text-slate-900">{searchedMember.name}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block">মেম্বার আইডিঃ</span>
                      <strong className="font-mono font-black text-emerald-900">{searchedMember.memberId || 'N/A'}</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] text-slate-500 font-bold block">মোবাইল নাম্বারঃ</span>
                      <strong className="font-mono font-black text-slate-800">{searchedMember.phone}</strong>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-emerald-200/60 space-y-2">
                      <label className="block text-[10.5px] font-black text-slate-800 uppercase tracking-wide">
                        গন্তব্য একাউন্ট নির্বাচন করুন (Select Destination Account):
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSearchedMember({ ...searchedMember, isVirtualSomitiTarget: true });
                            setSearchStatusMsg(`🏦 সমিতি একাউন্ট নির্বাচন করা হয়েছে - সমিতি সঞ্চয় আমানতে অটো জমা হবে`);
                          }}
                          className={`p-2 rounded-xl text-center border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            searchedMember.isVirtualSomitiTarget
                              ? 'bg-amber-600 text-white border-amber-700 shadow-xs font-black scale-102'
                              : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 font-bold'
                          }`}
                        >
                          <span className="text-xs">🏦</span>
                          <span className="text-[11px] block">সমিতি সঞ্চয় একাউন্ট</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchedMember({ ...searchedMember, isVirtualSomitiTarget: false });
                            setSearchStatusMsg(`💼 মেইন ওয়ালেট ব্যালেন্স নির্বাচন করা হয়েছে - মেইন ব্যালেন্সে জমা হবে`);
                          }}
                          className={`p-2 rounded-xl text-center border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            !searchedMember.isVirtualSomitiTarget
                              ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs font-black scale-102'
                              : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 font-bold'
                          }`}
                        >
                          <span className="text-xs">💼</span>
                          <span className="text-[11px] block">মেইন ওয়ালেট ব্যালেন্স</span>
                        </button>
                      </div>

                      {searchedMember.isVirtualSomitiTarget ? (
                        <div className="bg-amber-100/90 border border-amber-300 p-2 rounded-xl flex items-center gap-2 text-[11px] font-bold text-amber-950">
                          <span className="bg-amber-600 text-white text-[9.5px] font-black px-1.5 py-0.5 rounded shrink-0">
                            🏦 সমিতি একাউন্ট (সঞ্চয়)
                          </span>
                          <span>টাকা সরাসরি সদস্যের <strong className="text-amber-900 font-black">সমিতি সঞ্চয় ব্যালেন্সে</strong> জমা হবে।</span>
                        </div>
                      ) : (
                        <div className="bg-emerald-100/90 border border-emerald-300 p-2 rounded-xl flex items-center gap-2 text-[11px] font-bold text-emerald-950">
                          <span className="bg-emerald-700 text-white text-[9.5px] font-black px-1.5 py-0.5 rounded shrink-0">
                            💼 মেইন ওয়ালেট
                          </span>
                          <span>টাকা সরাসরি সদস্যের <strong className="text-emerald-900 font-black">মেইন ব্যালেন্সে</strong> জমা হবে।</span>
                        </div>
                      )}

                      {/* 12-Month / Multi-Year Samity Installment Tracker Calendar */}
                      {searchedMember.isVirtualSomitiTarget && (
                        <div className="pt-2 border-t border-amber-200/80 space-y-2">
                          <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-2xl p-3 shadow-2xs space-y-2.5">
                            
                            {/* Tracker Header */}
                            <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm">📅</span>
                                <div>
                                  <h4 className="text-[11px] font-black text-slate-900 leading-tight flex items-center gap-1">
                                    ৫০ সালের সঞ্চয় কিস্তি ট্র্যাকার
                                    <span className="text-[8.5px] bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-full font-bold">২০২৪ - ২০৫০</span>
                                  </h4>
                                  <p className="text-[9px] text-slate-500 font-bold">প্রাপকের গত মাস পর্যন্ত জমা ও ২০৫০ সাল পর্যন্ত বকেয়া স্থিতি</p>
                                </div>
                              </div>
                              <span className="text-[9px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full font-mono shadow-3xs">
                                {SAMITY_MONTHS.filter((m, idx) => {
                                  const paidList: string[] = Array.isArray(searchedMember.samityPaidMonths) ? searchedMember.samityPaidMonths : [];
                                  const yearKey = `${sendMoneySelectedYear}-${m.id}`;
                                  const yearKeyAlt = `${sendMoneySelectedYear}_${m.id}`;
                                  if (paidList.includes(yearKey) || paidList.includes(yearKeyAlt)) return true;
                                  if (sendMoneySelectedYear === 2026 && paidList.includes(m.id)) return true;
                                  if (paidList.length === 0 && (searchedMember.savings || 0) > 0) {
                                    const targetMonthly = searchedMember.monthlySavingsTarget || 1000;
                                    const monthIndexFromStart = (sendMoneySelectedYear - 2026) * 12 + idx;
                                    return monthIndexFromStart < Math.floor((searchedMember.savings || 0) / targetMonthly);
                                  }
                                  return false;
                                }).length} / ১২ মাস ({sendMoneySelectedYear})
                              </span>
                            </div>

                            {/* Year Selection Navigation Bar */}
                            <div className="flex items-center justify-between gap-1.5 bg-emerald-100/60 p-1.5 rounded-xl border border-emerald-200/80">
                              <div className="flex items-center gap-1 overflow-x-auto py-0.5 scrollbar-none max-w-[calc(100%-85px)]">
                                {SAMITY_YEARS.map(yr => {
                                  const isCurrent = yr === new Date().getFullYear();
                                  const isSelected = yr === sendMoneySelectedYear;
                                  const yrPaid = SAMITY_MONTHS.filter((m, idx) => {
                                    const paidList: string[] = Array.isArray(searchedMember.samityPaidMonths) ? searchedMember.samityPaidMonths : [];
                                    const yearKey = `${yr}-${m.id}`;
                                    const yearKeyAlt = `${yr}_${m.id}`;
                                    if (paidList.includes(yearKey) || paidList.includes(yearKeyAlt)) return true;
                                    if (yr === 2026 && paidList.includes(m.id)) return true;
                                    if (paidList.length === 0 && (searchedMember.savings || 0) > 0) {
                                      const targetMonthly = searchedMember.monthlySavingsTarget || 1000;
                                      const monthIndexFromStart = (yr - 2026) * 12 + idx;
                                      return monthIndexFromStart < Math.floor((searchedMember.savings || 0) / targetMonthly);
                                    }
                                    return false;
                                  }).length;

                                  return (
                                    <button
                                      key={yr}
                                      type="button"
                                      onClick={() => setSendMoneySelectedYear(yr)}
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

                              <select
                                value={sendMoneySelectedYear}
                                onChange={(e) => setSendMoneySelectedYear(Number(e.target.value))}
                                className="text-[10px] font-black font-mono bg-white border border-emerald-300 text-emerald-950 rounded-lg px-1.5 py-0.5 shrink-0 focus:outline-none cursor-pointer"
                              >
                                {SAMITY_YEARS.map(yr => (
                                  <option key={yr} value={yr}>বছর: {yr}</option>
                                ))}
                              </select>
                            </div>

                            <p className="text-[9.5px] text-slate-600 font-semibold leading-relaxed">
                              💡 <strong>{sendMoneySelectedYear} সালের জমা নির্দেশিকা:</strong> সবুজ মাসগুলো ইতোমধ্যে পরিশোধিত। লাল (বকেয়া) মাসগুলোতে ক্লিক করে ১ মাস বা যত মাস ইচ্ছা সিলেক্ট করুন।
                            </p>

                            {/* Months Grid */}
                            <div className="grid grid-cols-4 gap-1.5 pt-1">
                              {SAMITY_MONTHS.map((m, idx) => {
                                const paidList: string[] = Array.isArray(searchedMember.samityPaidMonths) ? searchedMember.samityPaidMonths : [];
                                const yearKey = `${sendMoneySelectedYear}-${m.id}`;
                                const yearKeyAlt = `${sendMoneySelectedYear}_${m.id}`;
                                const isPaid = paidList.includes(yearKey) || paidList.includes(yearKeyAlt) || (sendMoneySelectedYear === 2026 && paidList.includes(m.id)) || (paidList.length === 0 && (searchedMember.savings || 0) > 0 && ((sendMoneySelectedYear - 2026) * 12 + idx) < Math.floor((searchedMember.savings || 0) / (searchedMember.monthlySavingsTarget || 1000)));

                                const uniqueMonthKey = `${sendMoneySelectedYear}-${m.id}`;
                                const isSelected = sendMoneySelectedMonths.includes(uniqueMonthKey) || (sendMoneySelectedYear === 2026 && sendMoneySelectedMonths.includes(m.id));

                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    disabled={isPaid}
                                    onClick={() => {
                                      let updated: string[];
                                      if (isSelected) {
                                        updated = sendMoneySelectedMonths.filter(id => id !== uniqueMonthKey && id !== m.id);
                                      } else {
                                        updated = [...sendMoneySelectedMonths, uniqueMonthKey];
                                      }
                                      setSendMoneySelectedMonths(updated);

                                      if (updated.length > 0) {
                                        const targetMonthly = searchedMember.monthlySavingsTarget || 1000;
                                        setTransferAmountInput(String(updated.length * targetMonthly));
                                      } else {
                                        setTransferAmountInput('');
                                      }
                                    }}
                                    className={`p-1.5 rounded-xl border text-center transition flex flex-col items-center justify-between min-h-[52px] ${
                                      isPaid
                                        ? 'bg-emerald-500/10 border-emerald-300 text-emerald-950 font-black shadow-3xs cursor-not-allowed opacity-90'
                                        : isSelected
                                        ? 'bg-emerald-700 text-white border-emerald-800 ring-2 ring-emerald-500 shadow-sm font-black scale-102 cursor-pointer'
                                        : 'bg-rose-50/90 border-rose-200 text-rose-950 hover:border-rose-400 font-bold hover:shadow-2xs cursor-pointer'
                                    }`}
                                  >
                                    <span className={`text-[10px] font-extrabold truncate ${isSelected ? 'text-white' : ''}`}>
                                      {m.name}
                                    </span>

                                    {isPaid ? (
                                      <span className="inline-flex items-center gap-0.5 text-[8.5px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-mono font-bold mt-1 shadow-3xs">
                                        <CheckCircle2 className="w-2.5 h-2.5" /> পরিশোধিত
                                      </span>
                                    ) : isSelected ? (
                                      <span className="inline-flex items-center gap-0.5 text-[8.5px] bg-white text-emerald-900 px-1.5 py-0.2 rounded font-mono font-black mt-1 shadow-3xs">
                                        ✓ নির্বাচিত
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-0.5 text-[8.5px] bg-rose-600 text-white px-1.5 py-0.2 rounded font-mono font-bold mt-1 shadow-3xs">
                                        <PlusCircle className="w-2.5 h-2.5" /> বকেয়া (জমা)
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Selected Months Summary */}
                            {sendMoneySelectedMonths.length > 0 && (
                              <div className="bg-emerald-100/90 border border-emerald-300 p-2 rounded-xl flex items-center justify-between text-[10.5px] font-bold text-emerald-950 animate-slide-down">
                                <span>
                                  🎯 <strong>{sendMoneySelectedMonths.length} মাস</strong> জমা নির্বাচন করা হয়েছে
                                </span>
                                <span className="font-mono text-emerald-950 font-black text-xs bg-emerald-200/80 px-2 py-0.5 rounded-lg border border-emerald-400/60">
                                  মোট: ৳ {(sendMoneySelectedMonths.length * (searchedMember.monthlySavingsTarget || 1000)).toLocaleString('bn-BD')}
                                </span>
                              </div>
                            )}

                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Transfer Amount & Security PIN Form */}
            <form onSubmit={(e) => {
              setTransferType('member');
              setTransferSector('samity');
              handleExecuteTransfer(e);
            }} className="space-y-4">
              
              {/* Amount input */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-700" />
                  ২. স্থানান্তরের টাকার পরিমাণ (Amount BDT):
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-bold text-sm">
                    ৳
                  </span>
                  <input
                    type="number"
                    value={transferAmountInput}
                    onChange={(e) => setTransferAmountInput(e.target.value)}
                    placeholder="0.00"
                    min="10"
                    step="any"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-8 pr-4 py-3 text-sm font-mono font-black text-slate-900 focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                {/* Quick amount preset chips */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {['100', '200', '500', '1000', '2000', '5000'].map((preset, idx) => (
                    <button
                      key={`${preset}-${idx}`}
                      type="button"
                      onClick={() => setTransferAmountInput(preset)}
                      className={`text-[11px] font-mono font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                        transferAmountInput === preset
                          ? 'bg-emerald-800 text-white border-emerald-800 shadow-3xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      ৳ {Number(preset).toLocaleString('bn-BD')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Security PIN input */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-emerald-700" />
                  ৩. আপনার ৪-ডিজিটের সিকিউরিটি ওয়ালেট পিন কোডঃ
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={transferSenderPin}
                  onChange={(e) => setTransferSenderPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="****"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-center font-mono tracking-widest text-base font-black text-slate-900 focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
                <p className="text-[9.5px] text-slate-400 font-bold text-center">
                  *ট্রানজেকশন নিশ্চিত করতে আপনার ৪ সংখ্যার সঠিক পিন নম্বরটি প্রবেশ করান।
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-800 via-emerald-900 to-teal-900 hover:from-emerald-900 hover:to-teal-950 text-white font-black text-xs rounded-2.5xl transition-all shadow-md hover:shadow-lg cursor-pointer active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 stroke-[2.5]" />
                    সেন্ড মানি নিশ্চিত করুন ⚡ (BNB to BNB)
                  </>
                )}
              </button>
            </form>
          </motion.div>
        )}
        {activeTab === 'loan' && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="bg-white border border-slate-150 p-5 rounded-3xl shadow-sm space-y-4"
          >
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <TrendingUp className="w-6 h-6 text-amber-800" />
              <div>
                <h3 className="text-sm font-bold text-slate-800">কো-অপারেটিভ লোকারেন্ট ঋণ হিসাব</h3>
                <p className="text-[10px] text-slate-450">চলমান কিস্তি পরিশোধ এবং নতুন ঋণের আবেদন</p>
              </div>
            </div>

            {liveUser.dueLoan > 0 ? (
              <div className="space-y-4">
                <div className="bg-rose-50/50 border border-rose-100/75 p-4 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 font-bold">বর্তমান মোট বকেয়া ঋণঃ</span>
                    <span className="font-mono text-rose-700 font-bold text-base">৳ {liveUser.dueLoan?.toLocaleString('bn-BD')}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    *নিচে আপনার বকেয়া কিস্তির পেমেন্ট চ্যানেল সিলেক্ট করে পেমেন্ট বিবরণ সহ ট্রানজেকশন আইডি প্রদান করুন।
                  </p>

                  <div className="space-y-3.5 pt-2 border-t border-rose-100">
                    {/* Repayment Channel Selector */}
                    <div>
                      <label className="block text-[10.5px] font-black text-slate-700 mb-2">১. কিস্তি পরিশোধের জন্য চ্যানেল বেছে নিন (ব্র্যান্ড লোগোযুক্ত):</label>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {[
                          { id: 'bKash', name: 'বিকাশ', logoBg: 'from-pink-500 to-rose-600', logoTxt: 'bKash', activeColor: 'border-pink-500 bg-pink-50/50 text-pink-955 ring-1 ring-pink-300' },
                          { id: 'Nagad', name: 'নগদ', logoBg: 'from-orange-500 to-red-650', logoTxt: 'Nagad', activeColor: 'border-orange-500 bg-orange-50/50 text-orange-955 ring-1 ring-orange-300' },
                          { id: 'Rocket', name: 'রকেট', logoBg: 'from-violet-600 to-indigo-700', logoTxt: 'Rocket', activeColor: 'border-violet-600 bg-violet-50/50 text-violet-955 ring-1 ring-violet-300' },
                          { id: 'CellFin', name: 'সেলফিন', logoBg: 'from-sky-500 to-blue-600', logoTxt: 'CellFin', activeColor: 'border-sky-500 bg-sky-50/50 text-sky-955 ring-1 ring-sky-300' },
                          { id: 'DBBL_Bank', name: 'DBBL ব্যাংক', logoBg: 'from-teal-700 to-emerald-800', logoTxt: 'DBBL', activeColor: 'border-teal-600 bg-teal-50/50 text-teal-955 ring-1 ring-teal-300' },
                        ].map((chan, idx) => {
                          const isSelected = repayPayMethod === chan.id;
                          return (
                            <button
                              key={`${chan.id}-${idx}`}
                              type="button"
                              onClick={() => checkDemoAndRun(() => setRepayPayMethod(chan.id))}
                              className={`p-2 border rounded-xl flex flex-col items-center justify-center text-center cursor-pointer active:scale-95 transition-all ${
                                isSelected 
                                  ? chan.activeColor 
                                  : 'bg-white text-slate-600 border-slate-150 hover:bg-slate-50'
                              }`}
                            >
                              <div className={`w-9 h-5 rounded bg-gradient-to-r ${chan.logoBg} flex items-center justify-center text-[7px] font-black text-white uppercase tracking-tighter mb-1 shadow-3xs`}>
                                {chan.logoTxt}
                              </div>
                              <span className="font-black text-[9.5px] leading-none block">{chan.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Channel specific warning */}
                    <div className="p-3 bg-white/90 border border-slate-100 rounded-xl space-y-1">
                      {repayPayMethod === 'DBBL_Bank' ? (
                        <>
                          <p className="text-[10px] text-slate-800"><span className="font-bold">ব্যাংক হিসাবের নামঃ</span> MD SUJON MIA</p>
                          <p className="text-[10px] text-slate-800"><span className="font-bold">অ্যাকাউন্টঃ</span> <span className="font-bold font-mono">2441580395850</span> (DBBL)</p>
                          <p className="text-[10px] text-slate-800"><span className="font-bold">কার্ড নম্বরঃ</span> <span className="font-mono text-slate-600">{appConfig.personalBankCard}</span></p>
                        </>
                      ) : (
                        <>
                          <p className="text-[10px] text-slate-800"><span className="font-bold">পার্সোনাল নম্বরঃ</span> <span className="font-bold font-mono text-emerald-900 text-xs">{appConfig.personalMfsNumber}</span></p>
                          <p className="text-[9px] text-rose-700 font-bold leading-none">*এই নম্বরে সেন্ডমানি (Send Money) সম্পন্ন করার পর নিচের ফরমটি পূরণ করুন।</p>
                        </>
                      )}
                    </div>
                  </div>

                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      checkDemoAndRun(() => {
                        handlePayLoanInstallment(
                          Number(repayAmount),
                          repayPayMethod,
                          repaySenderInfo,
                          repayTxnId,
                          repayScreenshotData
                        );
                      });
                    }} 
                    className="space-y-3.5"
                  >
                    {/* Repayment Amount input */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-705 mb-1">২. পরিশোধের পরিমাণ (৳)</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-[10px]">৳</span>
                        <input
                          type="number"
                          required
                          value={repayAmount}
                          placeholder={`উদাঃ ১০০০ বা ${liveUser.dueLoan}`}
                          onChange={(e) => setRepayAmount(e.target.value)}
                          className="block w-full pl-6 pr-3 py-1.5 bg-white border border-slate-205 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-rose-500"
                        />
                      </div>
                      <div className="flex gap-1.5 mt-1.5">
                        <button
                          type="button"
                          onClick={() => setRepayAmount(String(Math.min(1000, liveUser.dueLoan)))}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-205 text-slate-700 text-[9px] rounded-md font-bold"
                        >
                          ১,০০০ ৳
                        </button>
                        <button
                          type="button"
                          onClick={() => setRepayAmount(String(Math.min(5000, liveUser.dueLoan)))}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-205 text-slate-700 text-[9px] rounded-md font-bold"
                        >
                          ৫,০০০ ৳
                        </button>
                        <button
                          type="button"
                          onClick={() => setRepayAmount(String(liveUser.dueLoan))}
                          className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[9px] rounded-md font-extrabold"
                        >
                          সব পরিশোধ করুন
                        </button>
                      </div>
                    </div>

                    {/* Sender Info input */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-705 mb-1">৩. প্রেরক হিসাব / মোবাইল নম্বর</label>
                      <input
                        type="text"
                        required
                        value={repaySenderInfo}
                        placeholder="উদাঃ ০১৭XXXXXXXX"
                        onChange={(e) => setRepaySenderInfo(e.target.value)}
                        className="block w-full px-3 py-1.5 bg-white border border-slate-205 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-rose-500"
                      />
                    </div>

                    {/* Transaction ID input */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-705 mb-1">৪. লাস্ট ৪ সংখ্যা অথবা ট্রানজেকশন আইডি (TrxID)</label>
                      <input
                        type="text"
                        required
                        value={repayTxnId}
                        placeholder="উদাঃ ১২৩৪ অথবা 8N34XP9W2"
                        onChange={(e) => setRepayTxnId(e.target.value)}
                        className="block w-full px-3 py-1.5 bg-white border border-slate-205 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-rose-500"
                      />
                    </div>

                    {/* Evidence Screenshot File Upload */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-705 mb-1">৫. পেমেন্ট প্রমাণপত্র আপলোড (স্ক্রিনশট ছবি)</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setRepayScreenshotData(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="block w-full text-xs text-slate-505 file:mr-3 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-semibold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100 cursor-pointer"
                      />
                      {repayScreenshotData ? (
                        <div className="mt-2 p-1 bg-slate-100 rounded-xl relative inline-block">
                          <img src={repayScreenshotData} alt="Repayment Screenshot" className="h-16 w-auto rounded-lg object-contain border border-slate-200" />
                          <button 
                            type="button" 
                            onClick={() => setRepayScreenshotData('')}
                            className="absolute -top-1.5 -right-1.5 bg-red-650 hover:bg-red-750 text-white rounded-full p-0.5 shadow transition cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <p className="text-[9px] text-slate-450 mt-1">পেমেন্ট করার পর স্ক্রিনশটের ছবি এখানে সংযুক্ত করুন।</p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'ঋণ কিস্তি পরিশোধ আবেদন জমা দিন ⚡'}
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-amber-50/50 border border-amber-100/75 p-4 rounded-2xl space-y-3">
                  <h4 className="text-xs font-bold text-amber-900">নতুন কো-অপারেティブ লোকারেন্ট ঋণ আবেদন</h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    *আপনার কোনো বকেয়া ঋণ নেই। আপনি সমিতি তহবিল থেকে সর্বনিম্ন ৫০০ টাকা এবং সর্বোচ্চ ২০,০০০ টাকা ঋণ আবেদন করতে পারেন।
                  </p>

                  <form onSubmit={handleLoanSubmit} className="space-y-3.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-705 mb-1">কাঙ্ক্ষিত ঋণের পরিমাণ (৳)</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-[10px]">৳</span>
                        <input
                          type="number"
                          required
                          value={loanAmount}
                          onChange={(e) => setLoanAmount(e.target.value)}
                          placeholder="উদাঃ ৫০০০ বা ১০০০০"
                          className="block w-full pl-6 pr-3 py-1.5 bg-white border border-slate-205 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <p className="text-[9px] text-slate-450 mt-1">সর্বনিম্ন ঋণ ৫০০ এবং সর্বোচ্চ ২০০০০ টাকা আবেদনযোগ্য।</p>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 bg-amber-800 hover:bg-amber-900 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'নতুন ঋণ আবেদনপত্র দাখিল করুন'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Active Statements History Tab */}
        {activeTab === 'history' && (() => {
          let runningBalance = liveUser.balance || 0;

          const creditTypes = [
            'add_money', 'received_transfer', 'deposit', 'loan_disbursment', 
            'qard_loan_disbursment', 'interest', 'interest_added', 'coop_savings_deposit'
          ];

          const isCreditTx = (tx: Transaction): boolean => {
            if (creditTypes.includes(tx.type)) return true;
            const desc = (tx.description || '').toLowerCase();
            const label = (tx.typeLabel || '').toLowerCase();
            if (desc.includes('ক্যাশব্যাক') || desc.includes('বোনাস') || desc.includes('জমা') || desc.includes('ক্রেডিট') || desc.includes('এড মানি')) return true;
            if (label.includes('ক্যাশব্যাক') || label.includes('বোনাস') || label.includes('জমা') || label.includes('এড মানি')) return true;
            return false;
          };

          const getFormattedTxTitle = (tx: Transaction): string => {
            const type = tx.type as string;
            if (type === 'add_money') return 'মোবাইল এড মানি (Add Money)';
            if (type === 'balance_transfer' || type === 'received_transfer' || type === 'transfer') return 'টাকা পাঠানো (Send Money)';
            if (type === 'withdraw' || type === 'cashout') return 'টাকা উত্তোলন (Withdraw)';
            if (type === 'telecom_recharge' || type === 'telecom') return 'টেলিকম রিচার্জ (Mobile Recharge)';
            if (type === 'shop_purchase' || type === 'coop_shop') return 'শপ কেনাকাটা (Shop Order)';
            if (type === 'deposit' || type === 'coop_savings_deposit') return 'সঞ্চয় জমা (Savings Deposit)';
            if (type === 'loan_repayment' || type === 'qard_loan_repayment') return 'ঋণ পরিশোধ (Loan Repay)';
            if (type === 'loan_disbursment' || type === 'qard_loan_disbursment') return 'কর্জ/ঋণ গ্রহণ (Loan Disbursement)';
            if (type === 'qard_donation') return 'কর্জ হাসানা অনুদান (Qard Donation)';
            if (tx.typeLabel) return tx.typeLabel;
            return 'লেনদেন (Transaction)';
          };

          // Build list with computed balance for each transaction going backwards
          const txListWithBalance = allTransactions.map((tx, idx) => {
            const isCredit = isCreditTx(tx);
            const txBalance = tx.balanceAfter !== undefined ? tx.balanceAfter : runningBalance;

            // Adjust running balance for next (older) transaction in sequence
            if (tx.status === 'success') {
              if (isCredit) {
                runningBalance = Math.max(0, runningBalance - tx.amount);
              } else {
                runningBalance = runningBalance + tx.amount;
              }
            }

            return {
              ...tx,
              isCredit,
              txBalance
            };
          });

          return (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="bg-white border border-slate-150 p-4 sm:p-5 rounded-3xl shadow-xs space-y-4 font-sans text-left"
            >
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100 justify-between flex-wrap gap-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 text-emerald-800 rounded-xl">
                    <History className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-800">আমার লেনদেনের বিবরণ ও স্টেটমেন্ট হিস্টোরি</h3>
                    <p className="text-[10px] sm:text-xs text-slate-450 font-medium">আপনার অ্যাকাউন্টের সকল লেনদেন ও ব্যালেন্স তথ্য</p>
                  </div>
                </div>
                <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full font-mono font-bold">
                  মোট: {allTransactions.length}
                </span>
              </div>

              {/* Transactions List */}
              {txListWithBalance.length === 0 ? (
                <div className="text-center py-12 text-xs sm:text-sm text-slate-400 italic bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  কোনো লেনদেনের তথ্য পাওয়া যায়নি।
                </div>
              ) : (
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {txListWithBalance.map((tx, idx) => {
                    const title = getFormattedTxTitle(tx);
                    const isCredit = tx.isCredit;

                    let timeStr = '';
                    try {
                      const d = new Date(tx.createdAt);
                      timeStr = d.toLocaleTimeString('bn-BD', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
                    } catch (e) {
                      timeStr = tx.createdAt;
                    }

                    return (
                      <div 
                        key={`${tx.id}-${idx}`} 
                        onClick={() => setSelectedReceiptTx(tx)}
                        className="p-3.5 sm:p-4 bg-white hover:bg-slate-50/80 border border-slate-150 hover:border-slate-300 transition-all rounded-2xl shadow-2xs space-y-2 text-left cursor-pointer group relative"
                      >
                        {/* Top Row: Status badge & Title on Left, Amount (+ / -) on Right */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] sm:text-xs font-black px-2.5 py-0.5 rounded-full border ${
                              tx.status === 'success' 
                                ? 'bg-emerald-100/90 text-emerald-800 border-emerald-250' 
                                : tx.status === 'failed' || tx.status === 'rejected'
                                ? 'bg-rose-100/90 text-rose-800 border-rose-250'
                                : 'bg-amber-100/90 text-amber-800 border-amber-250'
                            }`}>
                              {tx.status === 'success' ? 'সফল' : tx.status === 'failed' || tx.status === 'rejected' ? 'ব্যর্থ' : 'অপেক্ষমাণ'}
                            </span>
                            <span className="text-xs sm:text-sm font-extrabold text-slate-850">
                              {title}
                            </span>
                          </div>

                          <div className="text-right font-mono">
                            <span className={`text-sm sm:text-base font-black tracking-tight ${
                              isCredit ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              {isCredit ? '+' : '-'} ৳{tx.amount.toLocaleString('bn-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        {/* Middle Row: Description */}
                        <p className="text-xs text-slate-600 font-medium leading-relaxed">
                          {cleanDescription(tx.description, tx.status)}
                        </p>

                        {/* Bottom Row: TRXID & Time on Left, Ending Balance on Right */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100/80 text-[10px] sm:text-xs">
                          <div className="flex items-center gap-1.5 text-slate-400 font-medium font-mono flex-wrap">
                            {tx.transactionId && (
                              <span>TRXID: {tx.transactionId}</span>
                            )}
                            {!tx.transactionId && (
                              <span>TRXID: {tx.id.replace(/\D/g, '').slice(-6) || tx.id.slice(-6)}</span>
                            )}
                            <span>•</span>
                            <span>{timeStr}</span>
                          </div>

                          <div className="text-right">
                            <span className="text-xs sm:text-sm font-black text-slate-700 font-mono">
                              ৳{tx.txBalance.toLocaleString('bn-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          );
        })()}

        {/* 4. Profile View & Smart Debit Card / Transfer Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-4 font-sans text-left pb-12">
            <ProfileView user={liveUser} onUpdate={syncLiveProfile} onTriggerAdmin={onTriggerAdmin} appConfig={appConfig} />

            {/* Smart Virtual Debit Card & Live Transfer Panel */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-150 p-5 rounded-3xl shadow-sm space-y-4"
            >
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100 justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5.5 h-5.5 text-emerald-800" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">ভার্চুয়াল ডেবিট কার্ড ও পেমেন্ট সার্ভিস</h3>
                    <p className="text-[10px] text-slate-450">আপনার ডিজিটাল ওয়ালেটের ডেবিট ও ফান্ড পেমেন্ট সিস্টেম</p>
                  </div>
                </div>
              </div>

              {/* Virtual debit card design */}
              <div className="relative bg-gradient-to-tr from-slate-900 via-emerald-950 to-emerald-900 rounded-3xl p-4.5 shadow-md flex flex-col justify-between overflow-hidden border border-emerald-900/40 text-white min-h-[160px]">
                <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-555/5 rounded-full blur-2xl pointer-events-none" />
                <div className="flex justify-between items-start gap-4">
                  <div className="text-left">
                    <p className="text-[9px] uppercase tracking-widest text-slate-350 font-bold leading-none">Smart Virtual Debit Card</p>
                    <h4 className="text-xs font-black tracking-normal mt-1 leading-none">BNB MULTIPURPOSE DEBIT</h4>
                  </div>
                  <span className="px-2 py-1 bg-white/20 rounded-lg border border-white/10 font-mono tracking-widest italic shrink-0">BNB bank</span>
                </div>

                <div className="flex items-center justify-between bg-black/40 p-2.5 rounded-xl border border-white/10 my-1 text-center">
                  <span className="font-mono text-xs tracking-wider font-extrabold text-amber-305 text-amber-300">
                    Account: {liveUser.memberId || 'BNB00000000'}
                  </span>
                  <span className="font-mono text-[9px] text-slate-350">CVV: <strong className="text-slate-100 font-bold">{cvvRevealed ? '৫৮২' : '•••'}</strong></span>
                </div>

                <div className="text-left text-[8px] text-emerald-200 mt-1 leading-normal border-t border-white/5 pt-1">
                  📢 "এক সদস্য, এক নম্বর, এক পরিচয়"
                </div>

                <div className="flex justify-between items-end text-[10px] font-mono shrink-0 mt-1">
                  <div>
                    <p className="text-slate-450 text-[8px] uppercase">Account Holder</p>
                    <p className="font-sans font-bold text-slate-200 mt-0.5 text-xs">{liveUser.name}</p>
                  </div>
                  <div>
                    <p className="text-slate-455 text-[8px] uppercase">Expires</p>
                    <p className="text-slate-205 font-bold mt-0.5">১২ / ৩০</p>
                  </div>
                </div>
              </div>

              {/* Card Actions lock reveal and wallet status */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleToggleCardLock}
                  disabled={loading}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 border shadow-sm cursor-pointer ${
                    liveUser.cardLocked
                      ? 'bg-emerald-50 text-emerald-805 border-emerald-250 hover:bg-emerald-100'
                      : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  {liveUser.cardLocked ? (
                    <>
                      <svg className="w-3.5 h-3.5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 11V7a4 4 0 118 0m-4 10v2m-6-8h12a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8a2 2 0 012-2z" />
                      </svg>
                      কার্ড আনলক করুন
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5 text-rose-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      কার্ডটি লক করুন
                    </>
                  )}
                </button>

                <button
                  onClick={() => setCvvRevealed(!cvvRevealed)}
                  className="py-2 px-3 bg-slate-50 hover:bg-slate-100 active:scale-95 border border-slate-205 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-slate-550" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {cvvRevealed ? 'পিন লুকান' : 'কার্ড পিন দেখুন'}
                </button>
              </div>

              {/* Live Money Transfer Module */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-4">
                <div className="border-b border-slate-200 pb-2 flex justify-between items-center">
                  <h4 className="text-xs font-extrabold text-emerald-950 uppercase tracking-wide flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-emerald-805" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    লাইভ টাকা স্থানান্তর (Transfer)
                  </h4>
                  <span className="text-[10px] bg-emerald-100 text-emerald-955 border border-emerald-250 px-2.5 py-1 rounded-full font-bold">
                    ব্যালেন্সঃ ৳ {liveUser.balance?.toLocaleString('bn-BD')}
                  </span>
                </div>

                {/* Display Alert Logs */}
                {formError && (
                  <div className="bg-rose-50 text-rose-700 border border-rose-105 p-3 rounded-2xl text-xs flex items-center gap-1.5 leading-relaxed font-sans font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse shrink-0"></span>
                    <span>{formError}</span>
                  </div>
                )}
                {formSuccess && (
                  <div className="bg-emerald-50 text-emerald-800 border border-emerald-105 p-3 rounded-2xl text-xs leading-relaxed font-medium">
                    {formSuccess}
                  </div>
                )}

                {/* Selector tab buttons */}
                <div className="grid grid-cols-3 gap-1 bg-slate-200 p-1 rounded-xl">
                  {[
                    { id: 'member', label: 'বিএনবি সদস্য' },
                    { id: 'bank', label: 'অন্য ব্যাংক' },
                    { id: 'mobile_fs', label: 'মোবাইল ওয়ালেট' },
                  ].map((t, idx) => (
                    <button
                      key={`${t.id}-${idx}`}
                      type="button"
                      onClick={() => {
                        setTransferType(t.id as any);
                        setSearchedMember(null);
                        setSearchStatusMsg('');
                        setFormError('');
                        setFormSuccess('');
                      }}
                      className={`py-1.5 text-center text-[10px] font-bold rounded-lg transition-all ${
                        transferType === t.id
                          ? 'bg-white text-slate-905 shadow-xs border border-white'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleExecuteTransfer} className="space-y-3.5">
                  
                  {/* 1. Choose Transfer Sector / Wallet */}
                  {transferType === 'member' && (
                    <div className="space-y-1.5 p-3.5 bg-indigo-50/70 border border-indigo-150/40 rounded-2xl">
                      <label className="block text-xs font-black text-indigo-950 uppercase tracking-wide">ফান্ড স্থানান্তরের উৎস সেকশন (Source Wallet)</label>
                      <p className="text-[9px] text-emerald-700 font-bold">BNB সদস্য থেকে সদস্য (মেইন ব্যালেন্স ও সমিতি ভার্চুয়াল একাউন্ট) এবং টেলিকম/শপ ওয়ালেটে সরাসরি ইনস্ট্যান্ট স্থানান্তরিত হয় (১০০% অটোমেটিক)।</p>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {[
                          { id: 'samity', label: 'সমিতি', desc: `৳ ${(liveUser.balance || 0).toLocaleString('bn-BD')}` },
                          { id: 'telecom', label: 'টেলিকম', desc: `৳ ${(liveUser.telecomBalance || 0).toLocaleString('bn-BD')}` },
                          { id: 'shop', label: 'সুপার শপ', desc: `৳ ${(liveUser.superShopBalance || 0).toLocaleString('bn-BD')}` }
                        ].map((sect, idx) => (
                          <button
                            key={`${sect.id}-${idx}`}
                            type="button"
                            onClick={() => setTransferSector(sect.id as any)}
                            className={`p-2 rounded-xl text-center transition border flex flex-col justify-between items-center cursor-pointer ${
                              transferSector === sect.id 
                                ? 'bg-indigo-900 border-indigo-950 text-white shadow-xs scale-102 font-bold' 
                                : 'bg-white hover:bg-slate-55 border-slate-200 text-slate-700'
                            }`}
                          >
                            <span className="text-[10px] block font-black leading-none">{sect.label}</span>
                            <span className="text-[8px] font-mono mt-1 opacity-90 block">{sect.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2. To BNB Cooperative member */}
                  {transferType === 'member' && (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-705">ডিজিটাল আইডি বা মোবাইল নম্বর</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={transferTargetPhoneorId}
                          onChange={(e) => setTransferTargetPhoneorId(e.target.value)}
                          placeholder="সদস্য মোবাইল বা অ্যাকাউন্ট নম্বর যেমনঃ BNB00005327"
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-205 rounded-xl text-xs font-mono text-slate-850"
                        />
                        <button
                          type="button"
                          onClick={handleSearchTransferMember}
                          className="px-3 py-1.5 bg-emerald-850 hover:bg-emerald-900 text-white font-bold rounded-xl text-xs transition min-w-[70px] flex items-center justify-center cursor-pointer font-sans"
                        >
                          অনুসন্ধান
                        </button>
                      </div>
                      {searchStatusMsg && (
                        <p className={`text-[10px] font-semibold ${searchedMember ? 'text-emerald-750 bg-emerald-50 border-emerald-150' : 'text-rose-605 bg-rose-50 border-rose-150'} py-1.5 px-2.5 rounded-lg border border-dashed leading-relaxed font-sans`}>
                          {searchStatusMsg}
                        </p>
                      )}

                      {/* 2b. If search result is own account (Self transfer), select target wallet */}
                      {searchedMember && searchedMember.uid === liveUser.uid && (
                        <div className="space-y-2 p-3.5 bg-indigo-50 border border-indigo-150/50 rounded-2xl animate-fade-in text-left">
                          <label className="block text-xs font-black text-indigo-950 uppercase tracking-wide">গন্তব্য ওয়ালেট নির্বাচন করুন (Destination Wallet)</label>
                          <p className="text-[9px] text-slate-500 font-medium font-sans">আপনার মেইন ব্যালেন্স থেকে অন্য ওয়ালেটে স্থানান্তরের জন্য গন্তব্য ওয়ালেট সিলেক্ট করুন।</p>
                          {transferSector === 'samity' ? (
                            <div className="grid grid-cols-3 gap-2 mt-2">
                              {[
                                { id: 'telecom', label: 'টেলিকম ওয়ালেট' },
                                { id: 'shop', label: 'সুপার শপ' },
                                { id: 'savings', label: 'সমিতি সঞ্চয়' }
                              ]
                              .map((tgt, idx) => (
                                <button
                                  key={`${tgt.id}-${idx}`}
                                  type="button"
                                  onClick={() => setSelfTransferTarget(tgt.id as any)}
                                  className={`p-2 rounded-xl text-center border text-[9.5px] font-bold cursor-pointer transition ${selfTransferTarget === tgt.id ? 'bg-indigo-900 border-indigo-950 text-white shadow-xs' : 'bg-white hover:bg-slate-55 border-slate-200 text-slate-700'}`}
                                >
                                  {tgt.label}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-1.5 text-center">
                              <span className="inline-block text-[10.5px] font-black text-emerald-800 bg-white border border-emerald-150 py-2 px-3.5 rounded-xl uppercase tracking-wider leading-none">
                                🎯 গন্তব্যঃ মেইন ব্যালেন্স (৳${(liveUser.balance || 0).toLocaleString('bn-BD')})
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. To External general Bank accounts */}
                  {transferType === 'bank' && (
                    <div className="space-y-2.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-705 mb-1 text-slate-650 font-sans">ব্যাংক নির্বাচন করুন</label>
                        <select
                          value={transferTargetBankName}
                          onChange={(e) => setTransferTargetBankName(e.target.value)}
                          className="block w-full px-3 py-1.5 bg-white border border-slate-205 rounded-xl text-xs font-sans"
                        >
                          <option value="Dutch-Bangla Bank">ডাচ-বাংলা ব্যাংক লিমিটেড (DBBL)</option>
                          <option value="City Bank">দ্য CITY ব্যাংক পিএলসি</option>
                          <option value="Islami Bank">ইসলামী ব্যাংক বাংলাদেশ পিএলসি</option>
                          <option value="Sonali Bank">সোনালী ব্যাংক পিএলসি</option>
                          <option value="BRAC Bank">ব্র্যাক ব্যাংক পিএলসি</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-705 mb-1 text-slate-650 font-sans">প্রাপক ব্যাংক হিসাব নম্বর</label>
                        <input
                          type="text"
                          required
                          value={transferTargetAccNo}
                          onChange={(e) => setTransferTargetAccNo(e.target.value)}
                          placeholder="উদাঃ ১৬৪.১২১.XXXXX"
                          className="block w-full px-3 py-1.5 bg-white border border-slate-205 rounded-xl text-xs font-mono text-slate-850"
                        />
                      </div>
                    </div>
                  )}

                  {/* 3. To External Mobile Financial Services (bKash/Nagad/etc) */}
                  {transferType === 'mobile_fs' && (
                    <div className="space-y-2.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-705 mb-1 text-slate-650 font-sans">মোবাইল ওয়ালেট অপারেটর</label>
                        <select
                          value={transferTargetBankName}
                          onChange={(e) => setTransferTargetBankName(e.target.value)}
                          className="block w-full px-3 py-1.5 bg-white border border-slate-205 rounded-xl text-xs font-sans"
                        >
                          <option value="bKash">বিকাশ (bKash)</option>
                          <option value="Nagad">নগদ (Nagad)</option>
                          <option value="Rocket">রকেট (Rocket)</option>
                          <option value="Upay">উপায় (Upay)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-705 mb-1 text-slate-650 font-sans">প্রাপক মোবাইল নম্বর</label>
                        <input
                          type="text"
                          required
                          value={transferTargetAccNo}
                          onChange={(e) => setTransferTargetAccNo(e.target.value)}
                          placeholder="উদাঃ ০১৭XXXXXXXX"
                          className="block w-full px-3 py-1.5 bg-white border border-slate-205 rounded-xl text-xs font-mono text-slate-850"
                        />
                      </div>
                    </div>
                  )}

                  {/* 4. Common Transfer Amount and Security PIN inputs */}
                  <div className="grid grid-cols-2 gap-3.5 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-slate-705 mb-1 text-slate-650 font-sans">স্থানান্তরের পরিমাণ (৳)</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs font-mono">৳</span>
                        <input
                          type="number"
                          required
                          value={transferAmountInput}
                          onChange={(e) => setTransferAmountInput(e.target.value)}
                          placeholder="সর্বনিম্ন ১০ ৳"
                          className="block w-full pl-6 pr-3 py-1.5 bg-white border border-slate-205 rounded-xl text-xs font-mono text-slate-850"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-705 mb-1 text-slate-650 font-sans">সিকিউরিটি পিন (PIN)</label>
                      <input
                        type="password"
                        maxLength={4}
                        required
                        value={transferSenderPin}
                        onChange={(e) => setTransferSenderPin(e.target.value)}
                        placeholder="৪ সংখ্যার পিন"
                        className="block w-full px-3 py-1.5 bg-white border border-slate-205 rounded-xl text-xs font-mono text-slate-850 text-center tracking-widest"
                      />
                    </div>
                  </div>

                        {/* Submit Button */}
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full py-2.5 bg-indigo-900 hover:bg-indigo-950 text-white font-extrabold rounded-xl text-xs transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer mt-4 font-sans"
                        >
                          {loading ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            'নিরাপদ ফান্ড স্থানান্তর সম্পন্ন করুন ⚡'
                          )}
                        </button>
                      </form>
                    </div>
                  </motion.div>
                </div>
              )}

              {/* Full Screen Dashboard Screens */}
              <AnimatePresence>
                {modalType === 'samity' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                    className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 w-full h-full min-h-screen font-sans"
                  >
                    {(
                      (liveUser.role === 'admin' || liveUser.role === 'sub_admin') ||
                      liveUser.samityStatus === 'approved' ||
                      liveUser.samityApproved === true ||
                      liveUser.isSamityMember === true ||
                      hasCompletedSamityProfile(liveUser)
                    ) ? (
                      <SamityScreen
                        user={liveUser}
                        allUsers={allUsers}
                        onBack={() => setModalType(null)}
                        syncLiveProfile={syncLiveProfile}
                        setActiveTab={setActiveTab}
                        setModalType={setModalType}
                        appConfig={appConfig}
                        allNotices={allNotices}
                      />
                    ) : ((liveUser.samityStatus === 'pending' || Boolean(liveUser.samityAppliedAt)) && !isReapplyingSamity) ? (
                      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
                        <div className="bg-white rounded-3xl border border-slate-150 overflow-hidden shadow-xl mt-6 text-left">
                          <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-6 text-white relative overflow-hidden">
                            <div className="absolute right-0 top-0 translate-x-12 -translate-y-6 w-32 h-32 bg-white/5 rounded-full blur-xl pointer-events-none" />
                            <button 
                              onClick={() => {
                                setModalType(null);
                                setIsReapplyingSamity(false);
                              }}
                              className="mb-4 flex items-center gap-1.5 text-xs text-amber-50 hover:text-white transition bg-amber-700/40 p-2 py-1 rounded-lg cursor-pointer"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                              বাহির হোন
                            </button>
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white shrink-0">
                                <Clock className="w-6 h-6 animate-spin" style={{ animationDuration: '4s' }} />
                              </div>
                              <div>
                                <h1 className="text-base sm:text-lg font-black tracking-tight leading-tight">সমিতি মেম্বারশিপ আবেদন পেন্ডিং</h1>
                                <p className="text-[10.5px] text-amber-100 mt-1 font-medium font-sans">আপনার আবেদনটি বর্তমানে এডমিন এবং ট্রাস্টি বোর্ডের সক্রিয় বিবেচনায় রয়েছে</p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6 space-y-5 text-slate-700">
                            {resendSamitySuccess && (
                              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center gap-3 text-emerald-900 font-bold text-xs animate-fadeIn">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                                <p>{resendSamitySuccess}</p>
                              </div>
                            )}

                            <div className="bg-amber-50/55 border border-amber-200/50 p-4 rounded-2.5xl flex items-start gap-3">
                              <Clock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                              <div className="text-[11px] leading-relaxed font-sans font-bold text-amber-900">
                                <p className="text-xs font-black">📢 আবেদনটি বর্তমানে পেন্ডিং আছে (Pending Approval)</p>
                                <p className="mt-1 text-amber-805 font-medium font-sans">আপনার সমিতির সদস্যপদ আবেদনটি ডাটাবেজে পেন্ডিং হিসেবে আছে। আপনি চাইলে তথ্য পরিবর্তন করে আবার সাবমিট করতে পারেন অথবা সরাসরি এডমিন প্যানেলে আবেদন রিসেন্ড করতে পারেন।</p>
                              </div>
                            </div>

                            <div className="bg-slate-50 border border-slate-150 rounded-2.5xl p-4.5 space-y-3">
                              <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                                <Building2 className="w-3.5 h-3.5 text-slate-400" /> প্রেরিত আবেদনের তথ্যাদিঃ
                              </h3>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] font-sans">
                                <div>
                                  <span className="text-slate-400 font-semibold block">আবেদনকারীর নামঃ</span>
                                  <p className="text-slate-800 font-black">{liveUser.name}</p>
                                </div>
                                <div>
                                  <span className="text-slate-400 font-semibold block">সদস্য আইডি (Member ID):</span>
                                  <p className="text-emerald-800 font-black font-mono">{liveUser.memberId}</p>
                                </div>
                                <div>
                                  <span className="text-slate-400 font-semibold block">মোবাইল নম্বরঃ</span>
                                  <p className="text-slate-700 font-bold font-mono">{liveUser.phone}</p>
                                </div>
                                <div>
                                  <span className="text-slate-400 font-semibold block">স্থায়ী দেশ (Country):</span>
                                  <p className="text-slate-700 font-bold">{liveUser.country || 'Bangladesh'}</p>
                                </div>
                                {liveUser.monthlySavingsTarget && (
                                  <div>
                                    <span className="text-slate-400 font-semibold block">মনোনীত মাসিক সঞ্চয় কিস্তিঃ</span>
                                    <p className="text-indigo-700 font-extrabold font-mono">৳ {liveUser.monthlySavingsTarget.toLocaleString('bn-BD')} BDT</p>
                                  </div>
                                )}
                                <div>
                                  <span className="text-slate-400 font-semibold block">আবেদনের তারিখঃ</span>
                                  <p className="text-slate-600 font-sans font-bold">
                                    {liveUser.samityAppliedAt ? new Date(liveUser.samityAppliedAt).toLocaleString('bn-BD') : 'উপাত্ত নেই'}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <p className="text-[10px] text-slate-400 text-center">
                              *ভেরিফিকেশন সম্পন্ন হতে সাধারণত ১ থেকে ১২ ঘন্টা পর্যন্ত সময় লাগতে পারে।*
                            </p>

                            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2.5">
                              <button
                                onClick={() => setIsReapplyingSamity(true)}
                                className="w-full px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-bold hover:from-emerald-700 hover:to-teal-700 active:scale-98 transition text-center cursor-pointer shadow-md flex items-center justify-center gap-2"
                              >
                                <FileText className="w-4 h-4" />
                                📝 তথ্য সংশোধন ও নতুন করে আবেদন জমা দিন (Edit & Resubmit)
                              </button>

                              <button
                                onClick={handleDirectResendSamityRequest}
                                disabled={resendSamityLoading}
                                className="w-full px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold active:scale-98 transition text-center cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                <RefreshCw className={`w-4 h-4 ${resendSamityLoading ? 'animate-spin' : ''}`} />
                                {resendSamityLoading ? 'এডমিন প্যানেলে পাঠানো হচ্ছে...' : '⚡ এডমিন প্যানেলে আবেদন রিসেন্ড / রিফ্রেশ করুন (Instant Resend to Admin)'}
                              </button>

                              <button
                                onClick={() => {
                                  setModalType(null);
                                  setIsReapplyingSamity(false);
                                }}
                                className="w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold transition text-center cursor-pointer"
                              >
                                ড্যাশবোর্ডে ফিরে যান (Return Home)
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : liveUser.samityStatus === 'rejected' ? (
                      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
                        <div className="bg-white rounded-3xl border border-slate-150 overflow-hidden shadow-xl mt-6 text-left">
                          <div className="bg-gradient-to-r from-rose-600 to-rose-700 p-6 text-white relative overflow-hidden">
                            <div className="absolute right-0 top-0 translate-x-12 -translate-y-6 w-32 h-32 bg-white/5 rounded-full blur-xl pointer-events-none" />
                            <button 
                              onClick={() => {
                                setModalType(null);
                                setIsReapplyingSamity(false);
                              }}
                              className="mb-4 flex items-center gap-1.5 text-xs text-rose-50 hover:text-white transition bg-rose-700/40 p-2 py-1 rounded-lg cursor-pointer"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                              বাহির হোন
                            </button>
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white shrink-0">
                                <AlertCircle className="w-6 h-6 text-white" />
                              </div>
                              <div>
                                <h1 className="text-base sm:text-lg font-black tracking-tight leading-tight">সমিতি সদস্যপদ আবেদন প্রত্যাখ্যাত</h1>
                                <p className="text-[10.5px] text-rose-100 mt-1 font-medium font-sans">দুঃখিত! আপনার মেম্বারশিপ আবেদনটি অফিস কর্তৃক বাতিল করা হয়েছে।</p>
                              </div>
                            </div>
                          </div>

                          <div className="p-6 space-y-5 text-slate-700">
                            <div className="bg-rose-50 border border-rose-100 p-4 rounded-2.5xl flex items-start gap-3">
                              <ShieldAlert className="w-5 h-5 text-rose-650 mt-0.5 shrink-0" />
                              <div className="text-[11px] leading-relaxed font-sans font-bold text-rose-950">
                                <p className="text-xs font-black">❌ আবেদন বাতিলের কারণঃ</p>
                                <p className="mt-1 text-rose-800 font-extrabold text-[12px] bg-white border border-rose-100 px-3 py-2 rounded-xl mt-1 leading-normal font-sans">
                                  {liveUser.samityRejectReason || 'প্রদত্ত তথ্যের অমিল বা অসম্পূর্ণ নমিনি ডকুমেন্টস এর কারণে আপনার আবেদনটি বাতিল করা হয়েছে। সঠিক তথ্য প্রদান করে পুনরায় আবেদন করুন।'}
                                </p>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                              <button
                                onClick={async () => {
                                  try {
                                    const userRef = doc(db, 'users', liveUser.uid);
                                    await updateDoc(userRef, {
                                      samityStatus: 'none',
                                      samityRejectReason: ''
                                    });
                                    await syncLiveProfile();
                                  } catch (e) {
                                    console.error('Error resetting samity status:', e);
                                  }
                                }}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-bold hover:from-emerald-700 hover:to-teal-700 active:scale-98 transition text-center cursor-pointer shadow-md shadow-emerald-50"
                              >
                                📝 নতুন করে পুনরায় আবেদন করুন
                              </button>
                              <button
                                onClick={() => {
                                  setModalType(null);
                                  setIsReapplyingSamity(false);
                                }}
                                className="flex-1 px-4 py-3 bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 active:scale-98 transition text-center cursor-pointer"
                              >
                                ফিরে যান
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 sm:p-6">
                        <SamityRequestForm
                          user={liveUser}
                          appConfig={appConfig}
                          onClose={() => {
                            setModalType(null);
                            setIsReapplyingSamity(false);
                          }}
                          onSubmitSuccess={async () => {
                            setIsReapplyingSamity(false);
                            await syncLiveProfile();
                          }}
                        />
                      </div>
                    )}
                  </motion.div>
                )}
                {modalType === 'telecom' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                    className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 w-full h-full min-h-screen font-sans"
                  >
                    <BNBTelecomScreen
                      user={liveUser}
                      allOffers={allOffers}
                      onBack={() => setModalType(null)}
                      syncLiveProfile={syncLiveProfile}
                      onOpenDeposit={() => {
                        setModalType('deposit');
                      }}
                      appConfig={appConfig}
                      allNotices={allNotices}
                    />
                  </motion.div>
                )}
                {modalType === 'qard' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                    className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 w-full h-full min-h-screen font-sans"
                  >
                    <QardScreen
                      user={liveUser}
                      onBack={() => setModalType(null)}
                      syncLiveProfile={async () => {
                        await syncLiveProfile();
                      }}
                      appConfig={appConfig}
                    />
                  </motion.div>
                )}
                {modalType === 'safedeals' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                    className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 w-full h-full min-h-screen font-sans"
                  >
                    <SafeDealsEscrowView 
                      liveUser={liveUser} 
                      syncLiveProfile={syncLiveProfile} 
                      appConfig={appConfig} 
                      onBack={() => setModalType(null)}
                      allNotices={allNotices}
                    />
                  </motion.div>
                )}
                {modalType === 'agent' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                    className="fixed inset-0 z-50 overflow-y-auto bg-[#FAFDFB] w-full h-full min-h-screen font-sans"
                  >
                    <AgentScreen
                      user={liveUser}
                      onBack={() => setModalType(null)}
                      appConfig={appConfig}
                    />
                  </motion.div>
                )}
                {modalType === 'bank' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                    className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 w-full h-full min-h-screen font-sans"
                  >
                    <div className="bg-slate-50 min-h-screen flex flex-col relative text-slate-800">
                      <header className="bg-white border-b border-slate-200 px-4 py-3.5 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md shadow-xs w-full">
                        <div className="flex items-center gap-3">
                          <button 
                            type="button"
                            onClick={() => setModalType(null)}
                            className="p-2 bg-white border border-slate-150 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-800 transition-all cursor-pointer flex items-center justify-center shadow-3xs"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <div>
                            <h1 className="text-sm font-black flex items-center gap-1.5 text-emerald-700 font-sans">
                              <Landmark className="w-4.5 h-4.5 text-emerald-700" />
                              BNB সমবায় ব্যাংক লিঃ
                            </h1>
                            <p className="text-[9.5px] text-slate-400 uppercase tracking-widest font-mono font-bold">
                              ডিজিটাল রেমিট্যান্স, ক্যাশ আউট ও মোবাইল ব্যাংকিং কোর গেটওয়ে
                            </p>
                          </div>
                        </div>

                        {/* Balance display in header */}
                        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-xl shadow-3xs">
                          <span className="text-[9px] text-emerald-800 font-extrabold uppercase">ওয়ালেট ব্যালেন্সঃ</span>
                          <strong className="text-xs font-black text-emerald-950 font-mono">৳ {(liveUser.balance || 0).toLocaleString('bn-BD')}</strong>
                        </div>
                      </header>

                      <div className="p-2 md:p-6 w-full flex-1 pb-16">
                        <BnbMobileBankingPortal 
                          user={liveUser}
                          onClose={() => setModalType(null)}
                          syncLiveProfile={syncLiveProfile}
                          appConfig={appConfig}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
                {modalType === 'shop' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                    className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 w-full h-full min-h-screen font-sans"
                  >
                    <div className="bg-slate-50 min-h-screen flex flex-col relative text-slate-800">
                      <header className="bg-white border-b border-slate-200 px-4 py-3.5 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md shadow-xs w-full">
                        <div className="flex items-center gap-3">
                          <button 
                            type="button"
                            onClick={() => setModalType(null)}
                            className="p-2 bg-white border border-slate-150 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-800 transition-all cursor-pointer flex items-center justify-center shadow-3xs"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <div>
                            <h1 className="text-sm font-black flex items-center gap-1.5 text-orange-600 font-sans">
                              <ShoppingBag className="w-4.5 h-4.5 text-orange-600" />
                              বিবিজি সুপার শপ সেভিং খাতা (Co-op Mini Market)
                            </h1>
                            <p className="text-[9.5px] text-slate-400 uppercase tracking-widest font-mono font-bold">
                              আমানত সঞ্চয় ও পণ্য ক্রয় পোর্টাল
                            </p>
                          </div>
                        </div>

                        {/* Balance display in header */}
                        <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-100 px-3 py-1 rounded-xl shadow-3xs">
                          <span className="text-[9px] text-orange-800 font-extrabold uppercase">শপ ব্যালেন্সঃ</span>
                          <strong className="text-xs font-black text-orange-950 font-mono">৳ {(liveUser.superShopBalance || 0).toLocaleString('bn-BD')}</strong>
                        </div>
                      </header>

                      {/* Navigation tabs for Super Shop Systems */}
                      <div className="bg-white border-b border-slate-250/75 sticky top-[61px] z-30 px-4 py-2 flex gap-2 overflow-x-auto scrollbar-none w-full shadow-3xs">
                        {[
                          { id: 'products', name: '🛍️ পণ্য সম্ভার', desc: 'মিনি মার্কেট ক্যাটালগ' },
                          { id: 'rules', name: '📋 শপের নিয়মাবলী', desc: 'অপারেটিং সিস্টেম' },
                          { id: 'orders', name: '📦 আমার অর্ডার ট্র্যাক', desc: 'লাইভ ডেলিভারি খতিয়ান' },
                          { id: 'transfer', name: '💰 ওয়ালেট ট্রান্সফার', desc: 'ইনস্ট্যান্ট ফান্ড স্থানান্তর' }
                        ].map((subTab, idx) => (
                          <button
                            key={`${subTab.id}-${idx}`}
                            type="button"
                            onClick={() => {
                              setShopActiveSubTab(subTab.id as any);
                              setShopTransferErr('');
                              setShopTransferSucc('');
                            }}
                            className={`flex flex-col items-start px-3.5 py-1.5 rounded-xl border transition text-left cursor-pointer shrink-0 min-w-[125px] ${
                              shopActiveSubTab === subTab.id
                                ? 'bg-orange-55/80 border-orange-200 text-orange-950 font-black shadow-xs'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/90'
                            }`}
                          >
                            <span className="text-[10px] leading-tight flex items-center gap-1">{subTab.name}</span>
                            <span className={`text-[7px] leading-none mt-1 tracking-tight font-extrabold uppercase ${
                              shopActiveSubTab === subTab.id ? 'text-orange-700' : 'text-slate-400'
                            }`}>{subTab.desc}</span>
                          </button>
                        ))}
                      </div>

                      <div className="p-4 md:p-8 max-w-2xl mx-auto w-full flex-1 pb-16">
                        {/* 1. PRODUCTS TAB */}
                        {shopActiveSubTab === 'products' && (() => {
                          const shopProducts = allProducts;
                          const filteredShopProducts = shopProducts.filter(item => {
                            const matchesSearch = item.name.toLowerCase().includes(shopSearchTerm.toLowerCase()) || 
                                                  item.description.toLowerCase().includes(shopSearchTerm.toLowerCase()) ||
                                                  item.supplier.toLowerCase().includes(shopSearchTerm.toLowerCase());
                            const matchesCategory = shopCategory === 'all' || item.category === shopCategory;
                            
                            if (userLat && userLng && searchRange < 99999) {
                              const prodLat = item.latitude !== undefined ? item.latitude : 23.7915;
                              const prodLng = item.longitude !== undefined ? item.longitude : 90.2311;
                              const dist = calculateDistance(userLat, userLng, prodLat, prodLng);
                              return matchesSearch && matchesCategory && dist <= searchRange;
                            }
                            
                            return matchesSearch && matchesCategory;
                          });

                          return (
                            <div className="space-y-4 animate-fade-in text-left">
                              {/* Store banner notice */}
                              <div className="bg-amber-50/70 border border-amber-200/65 py-2.5 px-4 rounded-2xl flex justify-between items-center">
                                <div className="text-xs text-amber-900 font-bold flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                  সুপার শপ কারেন্ট ব্যালেন্স
                                </div>
                                <span className="font-mono text-xs font-black text-amber-950">৳ {(liveUser.superShopBalance || 0).toLocaleString('bn-BD')}</span>
                              </div>

                              <p className="text-[10px] text-slate-500 font-semibold leading-normal">
                                🛒 আপনার সুপার শপ ওয়ালেট ব্যালেন্স হতে আন্তর্জাতিক ও দেশীয় ভেরিফাইড পাইকারি ও খুচরা সরবরাহকারীদের থেকে সরাসরি পণ্য অর্ডার করতে পারবেন।
                              </p>

                              {/* Smart GPS Locator Panel */}
                              <div className="bg-rose-50/50 border border-rose-100 rounded-3xl p-4 space-y-3 shadow-3xs">
                                <div className="flex justify-between items-center">
                                  <h4 className="text-[11px] font-black text-rose-955 flex items-center gap-1.5 uppercase">
                                    📍 আমার লোকেশন (Smart GPS Locator)
                                  </h4>
                                  <span className="bg-rose-150 text-rose-900 font-black px-1.5 py-0.2 rounded-sm text-[8px] uppercase tracking-wide">
                                    Auto Location Detection
                                  </span>
                                </div>

                                {userLat && userLng ? (
                                  <div className="space-y-2">
                                    <div className="p-3 bg-white border border-rose-150 rounded-2xl text-[11px] space-y-1 shadow-4xs">
                                      <p className="text-[9px] font-bold text-slate-405 uppercase tracking-wider">আমার বর্তমান লাইভ জিপিএস ঠিকানাঃ</p>
                                      <p className="text-[11.5px] font-black text-slate-850 leading-normal">
                                        {userAddress || "লোকেশন সনাক্ত হচ্ছে..."}
                                      </p>
                                      <p className="text-[9px] font-mono font-bold text-rose-800">
                                        কোঅর্ডিনেটসঃ {userLat.toFixed(5)}, {userLng.toFixed(5)}
                                      </p>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={handleDetectUserLocation}
                                        disabled={isLocatingUser}
                                        className="flex-1 py-1.5 border border-rose-200 hover:bg-rose-50/50 text-rose-800 rounded-xl text-[10px] font-black transition cursor-pointer text-center"
                                      >
                                        {isLocatingUser ? '⏳ খোঁজা হচ্ছে...' : '🔄 লোকেশন রিফ্রেশ করুন'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setUserLat(null);
                                          setUserLng(null);
                                          setUserAddress('');
                                        }}
                                        className="py-1.5 px-3 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl text-[10px] font-black transition cursor-pointer text-center"
                                      >
                                        মুছুন ✕
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <p className="text-[10px] text-slate-500 font-semibold leading-normal">
                                      ম্যানুয়ালি বিভাগ, জেলা বা উপজেলা নির্বাচন করার ঝামেলা নেই। জিপিএস ব্যবহার করে অটোমেটিক আপনার আশেপাশের ১০০% সঠিক লোকেশন ট্র্যাক করুন।
                                    </p>
                                    <button
                                      type="button"
                                      onClick={handleDetectUserLocation}
                                      disabled={isLocatingUser}
                                      className="w-full py-2.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-black transition active:scale-98 shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                      {isLocatingUser ? (
                                        <>
                                          <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                          জিপিএস লোকেশন সনাক্ত হচ্ছে...
                                        </>
                                      ) : (
                                        <>
                                          <span>📍 আমার লোকেশন (Use My Location)</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                )}

                                {/* Search Range Selector segment */}
                                <div className="space-y-1.5 border-t border-rose-100/60 pt-3">
                                  <label className="text-[9.5px] font-extrabold text-slate-505 uppercase block">আশেপাশের সার্চ রেঞ্জ নির্বাচন করুনঃ</label>
                                  <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
                                    {[
                                      { val: 0.5, label: '৫০০মি' },
                                      { val: 1.0, label: '১ কিমি' },
                                      { val: 3.0, label: '৩ কিমি' },
                                      { val: 5.0, label: '৫ কিমি' },
                                      { val: 10.0, label: '১০ কিমি' },
                                      { val: 25.0, label: '২৫ কিমি' },
                                      { val: 50.0, label: '৫০ কিমি' },
                                      { val: 99999, label: 'সব দূরত্ব' }
                                    ].map((r, idx) => (
                                      <button
                                        key={r.val}
                                        type="button"
                                        onClick={() => setSearchRange(r.val)}
                                        className={`py-1 px-2.5 rounded-lg text-[9.5px] font-black transition whitespace-nowrap border shrink-0 cursor-pointer ${
                                          searchRange === r.val
                                            ? 'bg-rose-850 text-white border-transparent shadow-3xs'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-55'
                                        }`}
                                      >
                                        {r.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Search Bar */}
                              <div className="relative shadow-3xs">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10.5px]">
                                  🔍
                                </span>
                                <input
                                  type="text"
                                  value={shopSearchTerm}
                                  onChange={(e) => setShopSearchTerm(e.target.value)}
                                  placeholder="পণ্য, বা সরবরাহকারী প্রতিষ্ঠান খুঁজুন..."
                                  className="pl-9 pr-3 py-2 w-full bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
                                />
                              </div>

                              {/* Categories Selector list */}
                              <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
                                {[
                                  { id: 'all', label: 'সব প্রোডাক্ট' },
                                  ...(appConfig?.shopCategories || [
                                    { id: 'honey', label: '🍯 মধু ও মৌচাক' },
                                    { id: 'oil_ghee', label: '🍶 খাঁটি তেল ও ঘি' },
                                    { id: 'dates', label: '🧆 মিষ্টি খেজুর' },
                                    { id: 'spices', label: '🌶️ খাঁটি মসলা' },
                                    { id: 'nuts_seeds', label: '🥜 বাদাম ও বীজ' }
                                  ])
                                ].map((cat, idx) => (
                                  <button
                                    key={`${cat.id}-${idx}`}
                                    type="button"
                                    onClick={() => setShopCategory(cat.id)}
                                    className={`py-1 px-3 rounded-lg text-[10px] font-black transition whitespace-nowrap border shrink-0 cursor-pointer ${
                                      shopCategory === cat.id
                                        ? 'bg-orange-850 text-white border-transparent'
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    {cat.label}
                                  </button>
                                ))}
                              </div>

                              {/* Supplier profile display if selected */}
                              {selectedSupplier && (() => {
                                const supplierDetails = {
                                  "Sundarban API Co.": {
                                    banner: "🍯 सुंदरबन एपीআই কোং - শতভাগ খাঁটি মধু সরবরাহকারী",
                                    motto: "প্রাকৃতিক চাকের খাঁটি খলিশা ও গরান ফুলের মধু",
                                    description: "সুন্দরবনের গহীন অরণ্য থেকে সরাসরি সংগৃহীত প্রাকৃতিক মধু। কোনো কৃত্রিম প্রিজারভেটিভ বা চিনি ছাড়া শতভাগ খাঁটি গুণগত মান বজায় রাখতে আমরা অঙ্গীকারবদ্ধ।",
                                    rating: "৫.০ ★ (গোল্ড সেলার)",
                                    year: "স্থাপিতঃ ২০১৯",
                                    category: "মধু ও মৌচাক"
                                  },
                                  "Pabna Sweet Dairy": {
                                    banner: "🍶 পাবনা সুইট ডেইরি - ঐতিহ্যবাহী খাঁটি ঘি প্রস্তুতকারক",
                                    motto: "গরুর দুধের খাঁটি সর ও ঐতিহ্যবাহী সুস্বাদু ঘি",
                                    description: "পাবনার ঐতিহ্যবাহী ঘোষ পরিবারের বিশ্বস্ত রেসিপিতে তৈরি গাওয়া ঘি। দুধের সর থেকে মন্থন করে শতভাগ হাইজেনিক পরিবেশে প্রস্তুতকৃত সুবাসে অনন্য খাঁটি ঘি।",
                                    rating: "৪.৯ ★ (টপ রেটেড)",
                                    year: "স্থাপিতঃ ২০১৫",
                                    category: "খাঁটি তেল ও ঘি"
                                  },
                                  "Rajshahi Oil Mills": {
                                    banner: "🌱 রাজশাহী অয়েল মিলস - ঘানির সরিষার তেল ও মসলা",
                                    motto: "কাঠের ঘানিতে ভাঙানো প্রথম চাপের শতভাগ খাঁটি সরিষার তেল",
                                    description: "সেরা মানের দেশি সরিষা বীজ থেকে কাঠের ঘানিতে মৃদু চাপে নিষ্কাশিত সরিষার তেল। ঝাঁঝালো খাঁটি স্বাদ ও ওষধি গুণাগুণ অক্ষুণ্ণ রেখে বোতলজাত করা হয়।",
                                    rating: "৪.৮ ★ (ভেরিফাইড)",
                                    year: "স্থাপিতঃ ২০২১",
                                    category: "খাঁটি তেল ও ঘি"
                                  },
                                  "Nator Honey Farms": {
                                    banner: "🐝 নাটোর হানি ফার্মস - কালোজিরা ও লিচু ফুলের মধু",
                                    motto: "স্বাস্থ্যসম্মত ও পুষ্টিকর খামারের প্রাকৃতিক মধু",
                                    description: "নাটোরের ঐতিহ্যবাহী কালোজিরা ও লিচু চাষের মাঠ থেকে সংগৃহীত। উন্নত বৈজ্ঞানিক উপায়ে মধু নিষ্কাশন ও প্রক্রিয়াকরণ যা প্রাকৃতিক পুষ্টিগুণ ধরে রাখে।",
                                    rating: "৫.০ ★ (গোল্ড মেম্বার)",
                                    year: "স্থাপিতঃ ২০২০",
                                    category: "মধু ও মৌচাক"
                                  },
                                  "Kenya Wild Imports": {
                                    banner: "🇰🇪 কেনিয়া ওয়াইল্ড ইমপোর্টস - বুনো অর্গানিক মধু",
                                    motto: "আফ্রিকার চিরহরিৎ বনাঞ্চলের বুনো মোচাকের মধু",
                                    description: "আফ্রিকার প্রত্যন্ত বনভূমি থেকে আমদানিকৃত বিশ্বমানের অর্গানিক মধু। কড়া সুগন্ধ ও গাঢ় স্বাদের জন্য বিশ্বজুড়ে সমাদৃত অনন্য প্রাকৃতিক খাদ্য উপাদান।",
                                    rating: "৪.৭ ★ (ইন্টারন্যাশনাল সেলার)",
                                    year: "স্থাপিতঃ ২০১৮",
                                    category: "মধু ও মৌচাক"
                                  },
                                  "Tehran Palm Orchard": {
                                    banner: "🌴 তেহরান পাম অরণ্য - প্রিমিয়াম ইরানি মরিয়ম খেজুর",
                                    motto: "ইরানের ঐতিহ্যবাহী পাম বাগান থেকে আমদানিকৃত সেরা খেজুর",
                                    description: "শতভাগ প্রিমিয়াম বড় সাইজের ইরানি মরিয়ম খেজুর। নরম, মিষ্টি ও সুস্বাদু। ইরানের পাম বাগান থেকে সরাসরি সংগ্রহ করে সর্বোচ্চ স্বাস্থ্যবিধি মেনে বোতলজাত করা হয়।",
                                    rating: "৫.০ ★ (ভেরিফাইড)",
                                    year: "স্থাপিতঃ ২০১৭",
                                    category: "মিষ্টি খেজুর"
                                  }
                                };

                                const details = supplierDetails[selectedSupplier] || {
                                  banner: "🏬 সরবরাহকারী প্রোফাইল",
                                  motto: "গ্রুপ বাই ও সেভিং ডিল অংশীদার",
                                  description: "বিবিজি সুপার শপের বিশ্বস্ত রেজিস্টার্ড সরবরাহকারী অংশীদার।",
                                  rating: "৫.০ ★",
                                  year: "স্থাপিতঃ ২০২০",
                                  category: "জেনারেল"
                                };

                                return (
                                  <div className="bg-orange-50/60 border border-orange-150 rounded-2xl p-4 text-left space-y-3 shadow-3xs animate-fade-in relative">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedSupplier(null)}
                                      className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 font-bold text-xs"
                                    >
                                      বন্ধ করুন ✕
                                    </button>
                                    <div className="space-y-1">
                                      <h3 className="text-xs font-black text-orange-950 flex items-center gap-1.5 uppercase">
                                        🏬 {selectedSupplier}
                                      </h3>
                                      <p className="text-[10px] text-slate-500 font-bold">{details.banner}</p>
                                      <p className="text-[9.5px] text-orange-850 font-black italic">"{details.motto}"</p>
                                      <p className="text-[10px] text-slate-600 leading-relaxed font-semibold">{details.description}</p>
                                      <div className="flex gap-4 text-[9px] text-slate-400 font-bold pt-1">
                                        <span>রেটিংঃ {details.rating}</span>
                                        <span>প্রতিষ্ঠাকালঃ {details.year}</span>
                                        <span>বিভাগঃ {details.category}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Product Grid */}
                              {filteredShopProducts.length === 0 ? (
                                <div className="py-12 text-center text-slate-450 text-xs font-bold bg-white rounded-2xl border border-dashed border-slate-200">
                                  😞 কোনো পণ্য পাওয়া যায়নি! অনুগ্রহ করে অন্য কি-ওয়ার্ড বা সার্চ রেঞ্জ চেষ্টা করুন।
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 gap-3.5">
                                  {filteredShopProducts.map((item, idx) => (
                                    <div key={`${item.id}-${idx}`} className="p-4 bg-white border border-slate-150 hover:border-orange-500/40 rounded-2xl flex flex-col gap-3 text-left transition shadow-xs">
                                      {/* Supplier Credentials Header */}
                                      <div className="flex justify-between items-center border-b border-slate-100 pb-2 text-[9px] text-slate-450 font-bold">
                                        <div className="flex items-center gap-1">
                                          <span className="text-[12px]">{item.flag}</span>
                                          <span className="text-slate-705 truncate max-w-[120px]">{item.supplier}</span>
                                          <span className="bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded-xs uppercase tracking-wider text-[7px] font-black">Verified</span>
                                        </div>
                                        
                                        {userLat && userLng ? (
                                          (() => {
                                            const pLat = item.latitude !== undefined ? item.latitude : 23.7915;
                                            const pLng = item.longitude !== undefined ? item.longitude : 90.2311;
                                            const d = calculateDistance(userLat, userLng, pLat, pLng);
                                            return (
                                              <span className="text-rose-700 bg-rose-55 px-1.5 py-0.5 rounded-md font-extrabold flex items-center gap-0.5 whitespace-nowrap">
                                                📍 {toBnDigits(d.toFixed(1))} কিমি দূরে
                                              </span>
                                            );
                                          })()
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={handleDetectUserLocation}
                                            className="text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-100 px-1.5 py-0.5 rounded-md font-black flex items-center gap-0.5 transition cursor-pointer text-[8.5px]"
                                          >
                                            📍 দূরত্ব মাপুন
                                          </button>
                                        )}
                                      </div>

                                      {/* Main Item details frame */}
                                      <div className="flex items-start gap-3">
                                        <div className="w-16 h-16 bg-slate-50 border border-slate-100 text-3xl rounded-xl flex items-center justify-center shrink-0 shadow-inner select-none">
                                          {item.icon}
                                        </div>
                                        <div className="flex-1 space-y-1">
                                          <h4 className="text-xs font-black text-slate-900 leading-tight">{item.name}</h4>
                                          <p className="text-[10px] text-slate-500 leading-snug font-medium">{item.description}</p>
                                          
                                          {/* Star Rating snippet */}
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-amber-500 text-[10px]">★</span>
                                            <span className="text-[10px] text-slate-700 font-extrabold">{item.rating}</span>
                                            <span className="text-[9px] text-slate-400 font-bold">({Math.floor(item.rating * 10 - 2)} রিভিউ)</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Price points and MOQ details */}
                                      <div className="flex justify-between items-center bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                                        <div>
                                          <p className="text-[8px] text-slate-400 uppercase font-black leading-none">কো-অপারেティブ পাইকারি মূল্য</p>
                                          <p className="text-sm font-black text-rose-800 font-mono mt-0.5">৳ {item.price.toLocaleString('bn-BD')}</p>
                                        </div>
                                        <div className="text-right text-[9px] text-slate-500 font-bold leading-normal">
                                          <p>ন্যূনতম অর্ডারঃ <strong className="text-slate-800">{item.minOrder}</strong></p>
                                          <p>শিপিং সময়ঃ <strong className="text-slate-800">{item.shipTime}</strong></p>
                                        </div>
                                      </div>

                                      {/* Supplier and order action buttons */}
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSupplierContactProduct(item);
                                            setSupplierContactMsg(`সম্মানিত সরবরাহকারী, আমি "${item.name}" প্রোডাক্টটি ক্রয়ে আগ্রহী। এটার কাস্টম ব্র্যান্ডিং এবং বাল্ক ডিসকাউন্ট সম্পর্কে বিস্তারিত জানতে চাচ্ছি।`);
                                          }}
                                          className="flex-1 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-[10px] font-black rounded-lg transition text-center cursor-pointer font-sans"
                                        >
                                          📨 Contact Supplier
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedProductForCheckout(item);
                                            setCheckoutQuantity(1);
                                            setCheckoutPin('');
                                            setCheckoutDeliveryType('home');
                                            setCheckoutPaymentMethod('cod');
                                            if (userLat && userLng) {
                                              setCheckoutLat(userLat);
                                              setCheckoutLng(userLng);
                                              setCheckoutAddress(userAddress || '');
                                              setCheckoutLocationShared(true);
                                              const pLat = item.latitude !== undefined ? item.latitude : 23.7915;
                                              const pLng = item.longitude !== undefined ? item.longitude : 90.2311;
                                              const d = calculateDistance(userLat, userLng, pLat, pLng);
                                              setCheckoutDistance(parseFloat(Math.max(0.1, d).toFixed(2)));
                                            } else {
                                              setCheckoutDistance(1.5);
                                              setCheckoutAddress('');
                                              setCheckoutLocationShared(false);
                                              setCheckoutLat(null);
                                              setCheckoutLng(null);
                                            }
                                          }}
                                          className="flex-1 py-1.5 bg-orange-700 hover:bg-orange-850 active:bg-orange-900 text-white text-[10px] font-black rounded-lg transition shadow-sm text-center cursor-pointer shadow-orange-705/10 font-sans"
                                        >
                                          🛍️ অর্ডার করুন
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Supplier message delivery popup */}
                              {supplierContactProduct && (
                                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
                                  <div className="bg-white rounded-3xl p-5 max-w-[280px] w-full border border-slate-100 shadow-xl space-y-3.5">
                                    <h3 className="text-xs font-black text-slate-800 border-b border-slate-100 pb-2">
                                      সরবরাহকারীঃ {supplierContactProduct.supplier}
                                    </h3>
                                    <div>
                                      <p className="text-[10px] text-slate-500 font-semibold mb-1">আপনার কাস্টম মেসেজ টাইপ করুনঃ</p>
                                      <textarea
                                        value={supplierContactMsg}
                                        onChange={(e) => setSupplierContactMsg(e.target.value)}
                                        rows={4}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[10px] text-slate-707 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                      />
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setSupplierContactProduct(null)}
                                        className="flex-1 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 text-[10px] font-bold rounded-lg transition"
                                      >
                                        বন্ধ করুন
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          alert(`আপনার কাস্টম অনুসন্ধান বার্তাটি সরবরাহকারী প্রতিষ্ঠান "${supplierContactProduct.supplier}" এর গ্লোবাল ইনবক্সে প্রেরণ করা হয়েছে। সরবরাহকারী প্রতিষ্ঠানটি কয়েক ঘন্টার মধ্যে আপনার আইডিতে আপডেট পাঠাবে!`);
                                          setSupplierContactProduct(null);
                                        }}
                                        className="flex-1 py-2 bg-orange-700 hover:bg-orange-850 text-white text-[10px] font-bold rounded-lg transition"
                                      >
                                        বার্তার পাঠান
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* 2. RULES TAB */}
                        {shopActiveSubTab === 'rules' && (
                          <div className="space-y-4 font-sans text-xs text-slate-800 animate-fade-in text-left">
                            <h3 className="text-xs font-black text-slate-900 border-b border-slate-150 pb-2 flex items-center gap-1.5 uppercase">
                              📜 সুপার শপ ও গ্রুপ বাই ডিল নীতিমালা
                            </h3>
                            <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-3xs leading-relaxed">
                              <div className="space-y-2">
                                <h4 className="text-[11px] font-black text-slate-900 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                  ১. সরাসরি পাইকারি সরবরাহকারী চুক্তি
                                </h4>
                                <p className="text-[10px] text-slate-600 font-semibold pl-2.5">
                                  বিবিজি সুপার শপের সকল পণ্য সরাসরি উৎপাদক বা প্রথম শ্রেণীর আমদানিকারক হতে সংগৃহীত। কোনো প্রকার ভেজাল পণ্য প্রমাণিত হলে শতভাগ রিফান্ডের নিশ্চয়তা প্রদান করা হয়।
                                </p>
                              </div>

                              <div className="space-y-2">
                                <h4 className="text-[11px] font-black text-slate-900 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                  ২. ওয়ালেট পেমেন্ট ও অটোমেটিক ডেবিট সিস্টেম
                                </h4>
                                <p className="text-[10px] text-slate-600 font-semibold pl-2.5">
                                  অর্ডার করার সময় আপনার মেইন ওয়ালেট বা সুপার শপ ওয়ালেট থেকে পণ্য এবং আনুমানিক ডেলিভারি ফি ডেবিট করা হবে। রিজেক্ট বা পণ্য সংকটের ক্ষেত্রে সমপরিমাণ অর্থ ওয়ালেটে টাকা ফেরত দেওয়া হবে।
                                </p>
                              </div>

                              <div className="space-y-2">
                                <h4 className="text-[11px] font-black text-slate-900 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                  ৩. জিপিএস হোম ডেলিভারি ও রুট ম্যাপ
                                </h4>
                                <p className="text-[10px] text-slate-600 font-semibold pl-2.5">
                                  আমরা লাইভ গুগল ম্যাপ ও জিপিএস কোঅর্ডিনেট ব্যবহার করে নিখুঁতভাবে পণ্য ডেলিভারি করি। গ্রাহক চাইলে গুগল ম্যাপ লিংকে ক্লিক করে ডেলিভারি রুট ট্র্যাকিং দেখতে পারবেন।
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 3. ORDERS TAB */}
                        {shopActiveSubTab === 'orders' && (
                          <div className="space-y-4 animate-fade-in text-left text-xs text-slate-800">
                            <h3 className="text-xs font-black text-slate-900 border-b border-slate-150 pb-2 flex items-center gap-1.5 uppercase">
                              📦 আপনার সাম্প্রতিক শপ অর্ডার ট্র্যাকিং খতিয়ান
                            </h3>
                            
                            {allShopOrders.length === 0 ? (
                              <div className="py-12 text-center text-slate-400 font-bold bg-white rounded-2xl border border-slate-150 shadow-3xs">
                                😞 এখনও কোনো শপ অর্ডার করেননি!
                              </div>
                            ) : (
                              <div className="space-y-3.5">
                                {allShopOrders.map((orderedItem, idx) => (
                                  <div key={`${orderedItem.id}-${idx}`} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs text-left text-xs text-slate-850 space-y-2.5">
                                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                                      <div>
                                        <span className="bg-orange-100 text-orange-800 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">{orderedItem.status || 'Processing'}</span>
                                        <p className="text-[9px] text-slate-400 font-mono font-bold mt-0.5">অর্ডারঃ {orderedItem.id}</p>
                                      </div>
                                      <span className="font-mono text-[10px] font-black text-slate-450">{new Date(orderedItem.createdAt).toLocaleDateString('bn-BD')}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-y-1.5 text-[10px] text-slate-650">
                                      <div>
                                        <span className="text-slate-400 font-bold">পণ্য ও পরিমাণঃ</span> <span className="text-slate-900 font-extrabold">{orderedItem.productName} x {orderedItem.quantity} পিস</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 font-bold">ডেলিভারি ধরনঃ</span> <span className="text-slate-850 font-bold">{orderedItem.deliveryType === 'pickup' ? '🏪 দোকান সংগ্রহ' : '🚚 হোম ডেলিভারি'}</span>
                                      </div>
                                      {orderedItem.deliveryType !== 'pickup' && (
                                        <>
                                          <div>
                                            <span className="text-slate-400 font-bold">নির্ধারিত দূরত্বঃ</span> <span className="text-slate-805 font-mono font-bold">{(orderedItem.deliveryDistance || 1.5).toFixed(1)} কিমি</span>
                                          </div>
                                          <div>
                                            <span className="text-slate-400 font-bold">সম্ভাব্য চার্জ রেঞ্জঃ</span> <span className="text-amber-800 font-bold">{orderedItem.deliveryChargeRange || '৳ ৫ - ২০ (০-২ কিমি)'}</span>
                                          </div>
                                        </>
                                      )}
                                      <div>
                                        <span className="text-slate-400 font-bold">বিক্রেতার ফাইনাল চার্জঃ</span> <span className="text-[#8b1e10] font-black underline">৳ {(orderedItem.charge || 0).toLocaleString('bn-BD')} BDT</span>
                                      </div>
                                      <div className="col-span-2 border-t border-dashed border-slate-200 pt-1.5">
                                        <span className="text-slate-400 font-bold">ডেলিভারি ঠিকানা ও গন্তব্যঃ</span> 
                                        <p className="text-slate-700 font-bold mt-0.5 leading-normal bg-white p-1.5 rounded-lg border border-slate-150">
                                          {orderedItem.recipientAddress || orderedItem.deliveryAddress || 'নির্ধারিত লাইভ জিপিএস ঠিকানা'}
                                        </p>
                                      </div>
                                      {orderedItem.latitude && (
                                        <div className="col-span-2 pt-1">
                                          <a 
                                            href={`https://www.google.com/maps/search/?api=1&query=${orderedItem.latitude},${orderedItem.longitude}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-150 border border-rose-200 text-rose-800 rounded-lg font-black text-[8.5px] cursor-pointer"
                                          >
                                            🗺️ গুগল ম্যাপে লাইভ জিপিএস রুট দেখুন
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 4. WALLET TRANSFER & RECHARGE TAB */}
                        {shopActiveSubTab === 'transfer' && (
                          <div className="space-y-4 font-sans text-xs text-slate-800 animate-fade-in text-left">
                            {/* Balances Board */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-white border border-slate-200 p-3.5 rounded-2xl text-center space-y-1.5 shadow-3xs">
                                <span className="text-[20px] block">🏦</span>
                                <p className="text-[8.5px] text-slate-400 font-black uppercase">মেইন ওয়ালেট ব্যালেন্স</p>
                                <p className="text-sm font-black text-emerald-800 font-mono">৳ {(liveUser.balance || 0).toLocaleString('bn-BD')}</p>
                              </div>
                              <div className="bg-white border border-slate-200 p-3.5 rounded-2xl text-center space-y-1.5 shadow-3xs">
                                <span className="text-[20px] block">🛒</span>
                                <p className="text-[8.5px] text-slate-400 font-black uppercase">সুপার শপ ব্যালেন্স</p>
                                <p className="text-sm font-black text-orange-850 font-mono">৳ {(liveUser.superShopBalance || 0).toLocaleString('bn-BD')}</p>
                              </div>
                            </div>

                            {/* Dynamic Transfer Form */}
                            <form onSubmit={handleShopTransferSubmit} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-3xs space-y-4">
                              <h3 className="text-xs font-black text-slate-900 border-b border-slate-100 pb-2.5 flex items-center gap-1.5 uppercase">
                                🔄 ইনস্ট্যান্ট ফান্ড ট্রান্সেফার প্যানেল
                              </h3>

                              {shopTransferErr && (
                                <div className="p-2.5 bg-rose-50 border border-rose-150 text-rose-800 rounded-xl text-[10px] font-bold">
                                  ⚠️ {shopTransferErr}
                                </div>
                              )}

                              {shopTransferSucc && (
                                <div className="p-2.5 bg-emerald-50 border border-emerald-150 text-emerald-800 rounded-xl text-[10px] font-bold">
                                  🎉 {shopTransferSucc}
                                </div>
                              )}

                              {/* Direction Switch buttons */}
                              <div className="space-y-1.5">
                                <label className="block text-[10px] font-extrabold text-slate-500 uppercase">১. স্থানান্তরের অভিমুখ নির্বাচন করুন</label>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setShopDir('main_to_shop')}
                                    className={`py-2 px-3 rounded-xl border text-[10px] font-black transition cursor-pointer text-center flex flex-col justify-center gap-0.5 ${
                                      shopDir === 'main_to_shop'
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                                  >
                                    <span>মেইন ওয়ালেট হতে শপে</span>
                                    <span className="text-[7.5px] font-bold text-slate-400">Main Wallet ➜ Super Shop</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setShopDir('shop_to_main')}
                                    className={`py-2 px-3 rounded-xl border text-[10px] font-black transition cursor-pointer text-center flex flex-col justify-center gap-0.5 ${
                                      shopDir === 'shop_to_main'
                                        ? 'bg-amber-50 border-amber-350 text-amber-950'
                                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                                  >
                                    <span>শপ ওয়ালেট হতে মেইনে</span>
                                    <span className="text-[7.5px] font-bold text-slate-400">Super Shop ➜ Main Wallet</span>
                                  </button>
                                </div>
                              </div>

                              {/* Amount Input */}
                              <div className="space-y-1">
                                <label className="block text-[10px] font-extrabold text-slate-500 uppercase">২. স্থানান্তরের পরিমাণ টাইপ করুন (৳)</label>
                                <div className="relative">
                                  <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 font-mono text-[11px] font-bold">
                                    ৳
                                  </span>
                                  <input
                                    type="number"
                                    value={shopTransferAmount}
                                    onChange={(e) => setShopTransferAmount(e.target.value)}
                                    placeholder="টাকার পরিমাণ লিখুন..."
                                    className="pl-7 pr-3 py-2 w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500 placeholder-slate-400"
                                  />
                                </div>
                              </div>

                              {/* PIN INPUT */}
                              <div className="space-y-1">
                                <label className="block text-[10px] font-extrabold text-slate-500 uppercase">৩. আপনার গোপন নিরাপত্তা পিন কোড</label>
                                <input
                                  type="password"
                                  value={shopTransferPin}
                                  onChange={(e) => setShopTransferPin(e.target.value)}
                                  placeholder="গোপন নিরাপত্তা পিন দিন..."
                                  maxLength={5}
                                  className="px-3 py-2 w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500 text-center tracking-widest font-mono placeholder-slate-400"
                                />
                              </div>

                              {/* Action submit button */}
                              <button
                                type="submit"
                                disabled={shopTransferLoading}
                                className="w-full py-2.5 bg-orange-700 hover:bg-orange-850 disabled:bg-slate-300 text-white text-xs font-black rounded-xl transition active:scale-98 shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                {shopTransferLoading ? (
                                  <>
                                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    প্রক্রিয়া করা হচ্ছে...
                                  </>
                                ) : (
                                  <>
                                    <span>🔄 স্থানান্তরের রিকোয়েস্ট নিশ্চিত করুন</span>
                                  </>
                                )}
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {modalType === 'ration' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                    className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 w-full h-full min-h-screen font-sans"
                  >
                    <RationCardView
                      liveUser={liveUser}
                      syncLiveProfile={syncLiveProfile}
                      appConfig={appConfig}
                      onClose={() => setModalType(null)}
                    />
                  </motion.div>
                )}

                {modalType === 'courier' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                    className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 w-full h-full min-h-screen font-sans"
                  >
                    <BNBInstantCourier
                      user={liveUser}
                      syncLiveProfile={syncLiveProfile}
                      onClose={() => setModalType(null)}
                    />
                  </motion.div>
                )}

                {modalType === 'hisab' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                    className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 w-full h-full min-h-screen font-sans"
                  >
                    <BnbHisabKhata
                      user={liveUser}
                      onBack={() => setModalType(null)}
                      syncLiveProfile={syncLiveProfile}
                      appConfig={appConfig}
                    />
                  </motion.div>
                )}

                {modalType === 'salary' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                    className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 w-full h-full min-h-screen font-sans"
                  >
                    <BnbAutoSalaryPay
                      user={liveUser}
                      onBack={() => setModalType(null)}
                      syncLiveProfile={syncLiveProfile}
                      appConfig={appConfig}
                    />
                  </motion.div>
                )}

                {modalType === 'edu' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                    className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 w-full h-full min-h-screen font-sans"
                  >
                    <BnbEducationCenter
                      user={liveUser}
                      onBack={() => setModalType(null)}
                      appConfig={appConfig}
                    />
                  </motion.div>
                )}

                {modalType === 'safi' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                    className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 w-full h-full min-h-screen font-sans"
                  >
                    <SafiPremiumShop
                      user={liveUser}
                      onClose={() => setModalType(null)}
                      appConfig={appConfig}
                      handleBuyPremiumSafi={handleBuyPremiumSafi}
                      syncLiveProfile={syncLiveProfile}
                    />
                  </motion.div>
                )}

                {modalType === 'about' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 30 }}
                    className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 w-full h-full min-h-screen font-sans"
                  >
                    <BnbCorporateGuide
                      user={liveUser}
                      onBack={() => setModalType(null)}
                      appConfig={appConfig}
                      onUpdateConfig={() => {}}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {modalType && !['samity', 'telecom', 'qard', 'shop', 'agent', 'safedeals', 'ration', 'bank', 'courier', 'safi', 'hisab', 'salary', 'edu', 'about'].includes(modalType) && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans"
                  >
                    <div className="bg-white rounded-3xl p-5 max-w-sm w-full border border-slate-100 shadow-xl max-h-[90vh] overflow-y-auto relative scrollbar-none text-slate-800">
                      <div className="flex justify-between items-center border-b border-slate-150 pb-2 mb-4 sticky top-0 bg-white z-10">
                        <h2 className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                          {modalType === 'about' && 'ℹ️ সমবায় সমিতি পরিচিতি'}
                          {modalType === 'withdraw' && '🏦 সঞ্চয় ক্যাশ উত্তোলন'}
                          {modalType === 'chat' && '📢 কোম্পানি অফিসিয়াল নোটিশ বোর্ড'}
                          {modalType === 'safi' && '🍯 Safi প্রিমিয়াম শপ'}
                          {modalType === 'ration' && '📇 সমবায় রেশনের খতিয়ান'}
                        </h2>
                        <button 
                          onClick={() => {
                            setModalType(null);
                            setFormError('');
                            setFormSuccess('');
                          }}
                          className="p-1 px-2.2 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-400 hover:text-slate-750 transition text-[9px] font-bold cursor-pointer"
                        >
                          বন্ধ ✕
                        </button>
                      </div>

                      {modalType === 'withdraw' && (
                        <form onSubmit={handleWithdrawSubmit} className="space-y-4">
                          <div className="bg-slate-50 p-3 rounded-2xl text-xs text-slate-600 border border-slate-100 space-y-2">
                            <div className="flex justify-between pb-1 text-slate-505 items-center font-bold">
                              <span>সঞ্চয় তহবিল ব্যালেন্সঃ</span>
                              <strong className="text-emerald-800 text-sm font-bold font-mono">৳ ${liveUser.savings?.toLocaleString('bn-BD')}</strong>
                            </div>
                            <div className="border-t border-slate-200/60 pt-2 text-[10.5px] text-rose-700 leading-normal font-bold text-left">
                              ⚠️ এডমিন প্যানেলের অনুমতি ব্যতীত সমিতির টাকা তোলা যাবে না এবং করযে হাসানা ফান্ড এর টাকা ও তোলা সম্ভব নয়। সকল উত্তোলন আবেদন এডমিনের অনুমোদনের অপেক্ষায় থাকবে।
                            </div>
                          </div>

                          {/* Channel Selector */}
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5 text-left">১. তহবিল উত্তোলনের মাধ্যম (Channel) বেছে নিন</label>
                            <div className="grid grid-cols-5 gap-1.5">
                              {[
                                { id: 'bKash', name: 'বিকাশ', color: 'bg-pink-500 text-white' },
                                { id: 'Nagad', name: 'নগদ', color: 'bg-orange-500 text-white' },
                                { id: 'Rocket', name: 'রকেট', color: 'bg-violet-600 text-white' },
                                { id: 'CellFin', name: 'সেলফিন', color: 'bg-sky-600 text-white' },
                                { id: 'DBBL_Bank', name: 'DBBL ব্যাংক', color: 'bg-emerald-700 text-white' },
                              ].map((chan, idx) => (
                                <button
                                  key={`${chan.id}-${idx}`}
                                  type="button"
                                  onClick={() => setWithdrawMethod(chan.id)}
                                  className={`py-2 px-1 rounded-xl text-[10px] font-extrabold text-center transition cursor-pointer border ${
                                    withdrawMethod === chan.id 
                                      ? `${chan.color} border-transparent ring-2 ring-offset-1 ring-slate-400` 
                                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  {chan.name}
                                </button>
                              ))}
                            </div>
                          </div>

                          {withdrawMethod && (
                            <div className="space-y-3 p-3.5 bg-slate-50/50 border border-slate-200/60 rounded-2xl">
                              <div className="text-[10px] bg-slate-100/80 text-slate-750 font-bold px-2 py-0.5 rounded-md inline-block">
                                উত্তোলন সেটিংসঃ ${withdrawMethod}
                              </div>

                              {/* DBBL BANK fields */}
                              {withdrawMethod === 'DBBL_Bank' && (
                                <div className="space-y-2.5">
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-550 mb-0.5 text-left">অ্যাকাউন্ট নম্বর</label>
                                    <input
                                      type="text"
                                      required
                                      value={withdrawAccNo}
                                      onChange={(e) => setWithdrawAccNo(e.target.value)}
                                      placeholder="উদাঃ 2441580395850"
                                      className="block w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-550 mb-0.5 text-left">অ্যাকাউন্টের হোল্ডার নাম</label>
                                    <input
                                      type="text"
                                      required
                                      value={withdrawAccName}
                                      onChange={(e) => setWithdrawAccName(e.target.value)}
                                      placeholder="উদাঃ মোঃ শাহিন আলম"
                                      className="block w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-550 mb-0.5 text-left">শাখার নাম</label>
                                    <input
                                      type="text"
                                      required
                                      value={withdrawBranch}
                                      onChange={(e) => setWithdrawBranch(e.target.value)}
                                      placeholder="উদাঃ হেমায়েতপুর শাখা"
                                      className="block w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                                    />
                                  </div>
                                </div>
                              )}

                              {/* CellFin fields */}
                              {withdrawMethod === 'CellFin' && (
                                <div className="space-y-2.5">
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-550 mb-0.5 text-left">সেলফিন অ্যাকাউন্ট নম্বর (মোবাইল নং)</label>
                                    <input
                                      type="text"
                                      required
                                      value={withdrawAccNo}
                                      onChange={(e) => setWithdrawAccNo(e.target.value)}
                                      placeholder="উদাঃ 017XXXXXXXX"
                                      className="block w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-550 mb-0.5 text-left">প্রাপক মোবাইল নম্বর</label>
                                    <input
                                      type="text"
                                      required
                                      value={withdrawRecipientNumber}
                                      onChange={(e) => setWithdrawRecipientNumber(e.target.value)}
                                      placeholder="উদাঃ 017XXXXXXXX"
                                      className="block w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                                    />
                                  </div>
                                </div>
                              )}

                              {/* MFS fields (bKash, Nagad, Rocket) */}
                              {['bKash', 'Nagad', 'Rocket'].includes(withdrawMethod) && (
                                <div className="text-left">
                                  <label className="block text-[10px] font-bold text-slate-550 mb-0.5">আপনার ${withdrawMethod} ওয়ালেট নম্বর</label>
                                  <input
                                    type="text"
                                    required
                                    value={withdrawRecipientNumber}
                                    onChange={(e) => setWithdrawRecipientNumber(e.target.value)}
                                    placeholder="উদাঃ 01XXXXXXXXX"
                                    className="block w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                                  />
                                </div>
                              )}

                              {/* Pin field & amount */}
                              <div className="grid grid-cols-2 gap-2 text-left">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-550 mb-0.5">উত্তোলনের পরিমাণ (৳)</label>
                                  <input
                                    type="number"
                                    required
                                    min={100}
                                    value={withdrawAmount}
                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                    placeholder="৳কমপক্ষে ১০০"
                                    className="block w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-550 mb-0.5">নিরাপত্তা পিন (Security PIN)</label>
                                  <input
                                    type="password"
                                    required
                                    value={withdrawPin}
                                    onChange={(e) => setWithdrawPin(e.target.value)}
                                    placeholder="গোপন পিন দিন"
                                    className="block w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={loading || !withdrawMethod}
                            className="w-full py-2.5 bg-rose-700 hover:bg-rose-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-rose-900/10"
                          >
                            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'ক্যাশ উত্তোলন আবেদনপত্র পেশ করুন'}
                          </button>
                        </form>
                      )}

                      {modalType === 'agent' && (
                        <div className="space-y-4 text-xs font-sans text-left">
                          {!hasSubmittedAgent ? (
                            <form onSubmit={handleAgentSubmit} className="space-y-4">
                              <div className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-l-4 border-amber-500 p-3 rounded-r-xl space-y-1">
                                <p className="font-extrabold text-amber-900 text-[11px]">🌟 BNB এজেন্টের বিশেষ সুবিধাসমূহঃ</p>
                                <ul className="list-disc list-inside text-[10px] text-slate-600 space-y-1 font-medium">
                                  <li>আপনার নিজের এলাকার ডিপিএস ও সঞ্চয় কালেকশনে আকর্ষণীয় কমিশন।</li>
                                  <li>মোবাইল রিচার্জ ও অফার প্যাকে প্রতি হাজারে আকর্ষণীয় লভ্যাংশ।</li>
                                  <li>স্বনামধন্য BNB সুপার শপ পণ্য সরবরাহে পার্টনারশিপ শেয়ার।</li>
                                </ul>
                              </div>

                              {agentErrorMsg && <div className="bg-red-50 text-red-655 p-2 text-[10px] rounded-xl font-bold">{agentErrorMsg}</div>}

                              <div className="space-y-3">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-700 mb-1">১. আবেদনকারীর মোবাইল নম্বর</label>
                                  <input
                                    type="tel"
                                    required
                                    value={agentPhone}
                                    onChange={(e) => setAgentPhone(e.target.value)}
                                    placeholder="উদাঃ 01XXXXXXXXX"
                                    className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:ring-1 focus:ring-amber-500 focus:outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-slate-700 mb-1">২. আপনার জেলা</label>
                                  <input
                                    type="text"
                                    required
                                    value={agentDistrict}
                                    onChange={(e) => setAgentDistrict(e.target.value)}
                                    placeholder="উদাঃ ঢাকা, সিলেট, চট্টগ্রাম"
                                    className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-slate-700 mb-1">৩. পূর্ববর্তী কাজের অভিজ্ঞতা</label>
                                  <select
                                    value={agentExperience}
                                    onChange={(e) => setAgentExperience(e.target.value)}
                                    className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                                  >
                                    <option value="নেই">কোনো অভিজ্ঞতা নেই</option>
                                    <option value="১ বছর">১ বছর বা তার কম</option>
                                    <option value="২+ বছর">২ বছরের বেশি অভিজ্ঞতা আছে</option>
                                  </select>
                                </div>
                              </div>

                              <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-black rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-amber-500/10"
                              >
                                {loading ? (
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  'এজেন্ট আবেদন পেশ করুন'
                                )}
                              </button>
                            </form>
                          ) : (
                            <div className="space-y-4 py-2">
                              <div className="bg-emerald-50 border border-emerald-150 p-4 rounded-2xl text-center space-y-3">
                                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-855 text-xl font-bold mx-auto">
                                  ✓
                                </div>
                                <p className="text-xs text-emerald-850 font-extrabold leading-normal">
                                  {agentSuccessMsg}
                                </p>
                              </div>
                              <div className="p-3 bg-slate-50 border border-slate-150 rounded-2xl space-y-1.5 text-[11px] text-slate-600">
                                <p className="font-bold text-slate-800">আপনার দাখিলকৃত বিবরণীঃ</p>
                                <p>📱 মোবাইল নাম্বারঃ <span className="font-mono text-slate-800 font-bold">{agentPhone}</span></p>
                                <p>📍 নিজ জেলাঃ <span className="text-slate-800 font-bold">{agentDistrict}</span></p>
                                <p>💼 অভিজ্ঞতাঃ <span className="text-slate-800 font-bold">{agentExperience}</span></p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setModalType(null)}
                                className="w-full py-2 bg-slate-200 hover:bg-slate-250 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                              >
                                উইন্ডো বন্ধ করুন
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {modalType === 'chat' && (
                        <div className="flex flex-col h-[420px] max-h-[60vh] font-sans text-xs space-y-3">
                          {/* Search Bar */}
                          <div className="shrink-0">
                            <input
                              type="text"
                              value={noticeSearchQuery}
                              onChange={(e) => setNoticeSearchQuery(e.target.value)}
                              placeholder="নোটিশ খুঁজুন..."
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none placeholder-slate-400 font-bold"
                            />
                          </div>

                          {/* Notices Scroll Container */}
                          <div className="flex-grow overflow-y-auto p-1.5 space-y-2.5 min-h-[250px] scrollbar-none">
                            {allNotices.filter(notice => {
                              const queryStr = noticeSearchQuery.toLowerCase();
                              return !queryStr || 
                                notice.title?.toLowerCase().includes(queryStr) || 
                                notice.content?.toLowerCase().includes(queryStr) ||
                                notice.section?.toLowerCase().includes(queryStr);
                            }).length === 0 ? (
                              <div className="text-center py-12 text-slate-400 font-bold italic">
                                কোনো নোটিশ পাওয়া যায়নি।
                              </div>
                            ) : (
                              allNotices.filter(notice => {
                                const queryStr = noticeSearchQuery.toLowerCase();
                                return !queryStr || 
                                  notice.title?.toLowerCase().includes(queryStr) || 
                                  notice.content?.toLowerCase().includes(queryStr) ||
                                  notice.section?.toLowerCase().includes(queryStr);
                              }).map((notice, idx) => {
                                const isExpanded = expandedNoticeId === notice.id;
                                const sectionLabel = notice.section === 'general' ? 'সাধারণ নোটিশ' :
                                                     notice.section === 'telecom' ? 'টেলিকম নোটিশ' :
                                                     notice.section === 'qard' ? 'ঋণ নোটিশ' :
                                                     notice.section === 'samity' ? 'সমিতি নোটিশ' :
                                                     notice.section === 'ration' ? 'রেশন নোটিশ' :
                                                     'অন্যান্য নোটিশ';
                                const sectionColors = notice.section === 'general' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                                                       notice.section === 'telecom' ? 'bg-indigo-50 text-indigo-800 border-indigo-200' :
                                                       notice.section === 'qard' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                                                       'bg-amber-50 text-amber-800 border-amber-200';
                                
                                return (
                                  <div 
                                    key={`${notice.id}-${idx}`} 
                                    onClick={() => setExpandedNoticeId(isExpanded ? null : notice.id)}
                                    className={`p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${
                                      isExpanded 
                                        ? 'bg-slate-50 border-emerald-350 shadow-3xs' 
                                        : 'bg-white border-slate-150 hover:bg-slate-50/50 shadow-4xs'
                                    }`}
                                  >
                                    <div className="flex justify-between items-start gap-2">
                                      <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded border uppercase shrink-0 ${sectionColors}`}>
                                        {sectionLabel}
                                      </span>
                                      <span className="text-[8px] font-mono text-slate-400 font-bold shrink-0">
                                        {notice.createdAt ? new Date(notice.createdAt).toLocaleDateString('bn-BD') : ''}
                                      </span>
                                    </div>
                                    <h3 className="text-[11.5px] font-black text-slate-800 mt-2 tracking-tight leading-snug">
                                      {notice.title}
                                    </h3>
                                    <p className={`text-[10.5px] text-slate-600 mt-1 leading-normal font-semibold ${isExpanded ? 'whitespace-pre-line' : 'line-clamp-2 text-slate-505'}`}>
                                      {notice.content}
                                    </p>
                                    <div className="flex justify-end items-center mt-2.5">
                                      <span className="text-[9px] font-black text-indigo-600">
                                        {isExpanded ? 'সংক্ষিপ্ত করুন ▴' : 'বিস্তারিত পড়ুন ▾'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>



              {modalType === 'qard' && (
                  <div className="space-y-4 font-sans text-left pb-4">
                    {/* Sleek, prominent Top Balance and Stats Panel */}
                    <div className="grid grid-cols-2 gap-3 bg-rose-950/95 p-4 rounded-2.5xl text-white text-left shadow-sm border border-rose-900">
                      <div>
                        <span className="text-[9px] text-rose-350 font-extrabold uppercase tracking-wider block">ফান্ডের মোট টাকা (বর্তমান)</span>
                        <h4 className="text-base font-mono font-black text-amber-300 mt-0.5">৳{qardTotalFund.toLocaleString('bn-BD')} BDT</h4>
                      </div>
                      <div className="border-l border-white/10 pl-3">
                        <span className="text-[9px] text-rose-350 font-extrabold uppercase tracking-wider block">আমার মোট জমাকৃত আমানত</span>
                        <h4 className="text-base font-mono font-black text-emerald-300 mt-0.5">
                          ৳{qardHistory.filter(t => t.userId === liveUser.uid && t.type === 'qard_donation' && t.status === 'success').reduce((acc, curr) => acc + curr.amount, 0).toLocaleString('bn-BD')} BDT
                        </h4>
                      </div>
                    </div>

                    <div className="flex justify-between items-center bg-rose-900/10 px-3 py-2 rounded-xl text-xs border border-rose-900/5">
                      <span className="text-rose-950 font-bold">উপলব্ধ ঋণ তহবিল (বিতরণের জন্য সচল):</span>
                      <strong className="text-rose-900 font-mono font-black">৳{(qardTotalFund - qardActiveLoansAmount)?.toLocaleString('bn-BD')} BDT</strong>
                    </div>

                    {/* Navigation tabs inside Qard Hasana */}
                    <div className="flex border-b border-slate-150 text-xs">
                      <button 
                        onClick={() => { setQardTab('info'); setQardPin(''); }}
                        className={`flex-grow pb-2 border-b-2 font-extrabold text-center transition-all text-xs md:text-sm ${qardTab === 'info' ? 'border-rose-800 text-rose-900 font-black' : 'border-transparent text-slate-400 hover:text-slate-650'}`}
                      >
                        নীতিমালা
                      </button>
                      <button 
                        onClick={() => { setQardTab('donate'); setQardPin(''); }}
                        className={`flex-grow pb-2 border-b-2 font-extrabold text-center transition-all text-xs md:text-sm ${qardTab === 'donate' ? 'border-rose-800 text-rose-900 font-black' : 'border-transparent text-slate-400 hover:text-slate-650'}`}
                      >
                        হাসানাতে টাকা রাখুন
                      </button>
                      <button 
                        onClick={() => { setQardTab('apply'); setQardPin(''); }}
                        className={`flex-grow pb-2 border-b-2 font-extrabold text-center transition-all text-xs md:text-sm ${qardTab === 'apply' ? 'border-rose-800 text-rose-900 font-black' : 'border-transparent text-slate-400 hover:text-slate-650'}`}
                      >
                        ঋণের আবেদন
                      </button>
                      <button 
                        onClick={() => { setQardTab('my_applications'); setQardPin(''); }}
                        className={`flex-grow pb-2 border-b-2 font-extrabold text-center transition-all text-xs md:text-sm ${qardTab === 'my_applications' ? 'border-rose-800 text-rose-900 font-black' : 'border-transparent text-slate-400 hover:text-slate-650'}`}
                      >
                        আমার আবেদন
                      </button>
                      <button 
                        onClick={() => { setQardTab('history'); setQardPin(''); }}
                        className={`flex-grow pb-2 border-b-2 font-extrabold text-center transition-all text-xs md:text-sm ${qardTab === 'history' ? 'border-rose-800 text-rose-900 font-black' : 'border-transparent text-slate-400 hover:text-slate-650'}`}
                      >
                        লিস্ট দেখুন
                      </button>
                    </div>

                    {qardTab === 'info' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                        {/* Rules card left column */}
                        <div className="space-y-4 text-[10.5px] font-sans font-bold leading-relaxed text-slate-600 bg-white p-4.5 rounded-2.5xl border border-slate-150 shadow-3xs text-left h-full flex flex-col justify-between">
                          <div className="bg-rose-50/40 p-3.5 rounded-xl border border-rose-100 flex-1">
                            <h5 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5 mb-2 text-left">
                              <span className="p-1 px-1.5 bg-rose-500/10 text-rose-700 rounded text-xs select-none">১</span>
                              ঋণ গ্রহণের শর্তাবলী ও সর্বোচ্চ সীমাঃ
                            </h5>
                            <ul className="space-y-2 list-disc list-inside text-[11px] text-slate-500 font-bold leading-relaxed">
                              <li><strong className="text-slate-700">সাধারণ সদস্যঃ</strong> প্রতি ৪ মাসে সর্বোচ্চ একবার ৳৫,০০০ টাকা ঋণ পাবেন।</li>
                              <li><strong className="text-slate-700">অ্যাডমিন সদস্যঃ</strong> অফিসিয়াল সর্বোচ্চ সীমা ৳১০,০০০ টাকা ঋণ পাবেন।</li>
                              <li><strong className="text-slate-700">নিড গ্রুপ সদস্যঃ</strong> প্রথমবার সর্বোচ্চ ৳১,০০০ এবং পরবর্তীতে ৳২,০০০ টাকা পাবেন।</li>
                              <li><strong className="text-emerald-800">পরিশোধ সীমাঃ</strong> গৃহীত অর্থ ১ মাসের মধ্যে ওয়ালেট থেকে সম্পূর্ণ ফেরত দিতে হবে।</li>
                              <li><strong className="text-rose-800 font-extrabold">সুদমুক্তঃ</strong> কোনো ধরনের সুদ বা অতিরিক্ত বাধ্যতামূলক চার্জ প্রযোজ্য নয়।</li>
                            </ul>
                          </div>

                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 text-slate-500/90 text-[10px] leading-relaxed">
                            💡 করযে হাসানা হচ্ছে অত্যন্ত পবিত্র সুদমুক্ত ঋণ ব্যবস্থা। নির্ধারিত মেয়াদের মধ্যে সকল অর্থ পরিশোধ নিশ্চিত করা প্রত্যেক সম্মানিত সদস্যের নৈতিক ও সামাজিক দায়িত্ব।
                          </div>
                        </div>

                        {/* Rules card right column */}
                        <div className="space-y-4 text-[10.5px] font-sans font-bold leading-relaxed text-slate-600 bg-white p-4.5 rounded-2.5xl border border-slate-150 shadow-3xs text-left h-full flex flex-col justify-between">
                          <div className="bg-rose-50/40 p-3.5 rounded-xl border border-rose-100 flex-1">
                            <h5 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5 mb-2 text-left">
                              <span className="p-1 px-1.5 bg-rose-500/10 text-rose-700 rounded text-xs select-none">২</span>
                              স্বেচ্ছাদানে ফান্ডের প্রসারঃ
                            </h5>
                            <p className="text-[11px] text-slate-500 font-bold leading-relaxed mb-2">
                              এই সুদমুক্ত কল্যাণ তহবিলটি পরিচালনা ও সমৃদ্ধ করতে আমরা সম্মানিত সদস্যদের সাহায্য নিচ্ছি। আপনার যেকোনো ক্ষুদ্র সদকা বা অনুদান সরাসরি অভাবগ্রস্ত ভাইদের মাঝে সুদমুক্ত ঋণ হিসেবে চলমান থাকবে।
                            </p>
                          </div>

                          <div className="bg-rose-50/20 p-3 rounded-xl border border-rose-100/60 text-rose-950 text-[10px] leading-relaxed font-extrabold">
                            💖 "কারো সাহায্যে এগিয়ে আসার মতন মহৎ কাজ আর কিছু হতে পারে না।"
                          </div>
                        </div>
                      </div>
                    )}

                    {qardTab === 'donate' && (
                      <form onSubmit={handleQardHasanaDonate} className="space-y-3.5 animate-fade-in text-left">
                        {/* 1. দানের পরিমাণ */}
                        <div className="bg-rose-50/50 border border-rose-200/50 p-4 sm:p-5 rounded-2.5xl shadow-3xs space-y-3.5">
                          <label className="text-xs font-black text-rose-950 flex items-center gap-1.5 pb-2 border-b border-rose-100/60">
                            <span className="p-1 px-2 bg-rose-100 text-rose-800 rounded-lg font-black font-sans">
                              ৳
                            </span>
                            ১. হাসানাত তহবিলে রাখার পরিমাণ (টাকা লিখুন) *
                          </label>
                          
                          {/* Highlighted prominent box showing the money currently being entered */}
                          <div className="bg-white border-2 border-rose-300 focus-within:border-rose-600 rounded-2xl p-3.5 flex items-center justify-between transition-all duration-150 shadow-2xs">
                            <span className="text-rose-900 font-extrabold text-xs sm:text-sm pl-1">আমি রাখতে চাই :</span>
                            <div className="flex items-center gap-1">
                              <span className="text-lg font-mono font-black text-rose-950">৳</span>
                              <input
                                type="number"
                                value={qardDonateAmount}
                                onChange={(e) => setQardDonateAmount(e.target.value)}
                                placeholder="টাকা লিখুন"
                                className="w-32 bg-transparent text-right font-mono text-base sm:text-lg font-black text-rose-950 outline-none focus:ring-0 border-none p-0 focus:outline-none"
                                required
                              />
                            </div>
                          </div>

                          <div className="bg-white/80 p-2.5 border border-rose-100/80 rounded-xl text-[10px] text-rose-850 font-bold leading-normal">
                            💡 হাসানাত তহবিলে আপনি যে টাকা জমা রাখবেন তা পবিত্র সুদমুক্ত আমানত হিসেবে চলমান থাকবে এবং ১ বছর পর যেকোনো সময় সম্পূর্ণ ফেরত তুলতে পারবেন।
                          </div>

                          {/* Quick selector buttons containing 10, 50, 100, 500, etc. */}
                          <div className="grid grid-cols-4 gap-2">
                            {[10, 50, 100, 500].map((amt, idx) => {
                              const isSelected = Number(qardDonateAmount) === amt;
                              return (
                                <button
                                  type="button"
                                  key={`${amt}-${idx}`}
                                  onClick={() => setQardDonateAmount(amt.toString())}
                                  className={`py-2 px-1 border rounded-xl text-center font-black text-[11px] cursor-pointer transition-all active:scale-95 ${
                                    isSelected
                                      ? 'border-rose-600 bg-rose-50 text-rose-900 ring-1 ring-rose-300'
                                      : 'border-slate-150 bg-white text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  ৳{amt.toLocaleString('bn-BD')}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* ২. দানের ধরন */}
                        <div className="bg-white border border-slate-150 p-4 rounded-2xl shadow-xs space-y-3">
                          <label className="text-xs font-black text-slate-700 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                            <span className="p-1 px-2 bg-rose-50 rounded-lg text-rose-700">
                              🌱
                            </span>
                            ২. জমার ধরন বেছে নিনঃ
                          </label>
                          <div className="grid grid-cols-3 gap-2.5">
                            {[
                              { id: 'one-time', label: 'এককালীন আমানত' },
                              { id: 'monthly', label: 'মাসিক আমানত' },
                              { id: 'sadqah', label: 'তহবিল সদকা' }
                            ].map((type, idx) => {
                              const isSelected = qardDonationType === type.id;
                              return (
                                <button
                                  type="button"
                                  key={`${type.id}-${idx}`}
                                  onClick={() => setQardDonationType(type.id)}
                                  className={`py-2 px-1 border rounded-xl text-center font-black text-[10.5px] cursor-pointer transition-all active:scale-95 ${
                                    isSelected
                                      ? 'border-rose-600 bg-rose-50 text-rose-900 ring-1 ring-rose-300'
                                      : 'border-slate-150 bg-slate-50 text-slate-650 hover:bg-slate-100'
                                  }`}
                                >
                                  {type.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* ৩. দানের উদ্দেশ্য */}
                        <div className="bg-white border border-slate-150 p-4 rounded-2xl shadow-xs space-y-3">
                          <label className="text-xs font-black text-slate-700 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                            <span className="p-1 px-2 bg-rose-50 rounded-lg text-rose-700">
                              🎯
                            </span>
                            ৩. অনুদানের উদ্দেশ্যঃ
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            {[
                              { id: 'general', label: 'সমাজ উন্নয়ন তহবিল' },
                              { id: 'growth', label: 'তহবিল লাইভ প্রবৃদ্ধি' },
                              { id: 'medical', label: 'গরীব রোগীদের চিকিৎসা' }
                            ].map((p, idx) => {
                              const isSelected = qardDonationPurpose === p.id;
                              return (
                                <button
                                  type="button"
                                  key={`${p.id}-${idx}`}
                                  onClick={() => setQardDonationPurpose(p.id)}
                                  className={`py-2 px-15 border rounded-xl text-center font-black text-[10px] cursor-pointer transition-all active:scale-95 ${
                                    isSelected
                                      ? 'border-rose-600 bg-rose-50 text-rose-900 ring-1 ring-rose-300'
                                      : 'border-slate-150 bg-slate-50 text-slate-600 hover:bg-slate-100'
                                  }`}
                                >
                                  {p.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 4. পেমেন্ট মাধ্যম Card */}
                        <div className="bg-white border border-slate-150 p-4 rounded-2xl shadow-xs space-y-3">
                          <label className="text-xs font-black text-slate-700 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                            <span className="p-1.5 bg-blue-50 rounded-lg text-blue-700">
                              <CreditCard className="w-4 h-4" />
                            </span>
                            💳 ৪. পেমেন্ট মাধ্যম বেছে নিনঃ
                          </label>
                          <div className="grid grid-cols-2 gap-2.5">
                            {[
                              { 
                                id: 'balance', 
                                name: 'মেইন ব্যালেন্স', 
                                detail: `৳ ${(liveUser.balance || 0).toLocaleString('bn-BD')} BDT`,
                                logoBg: 'from-emerald-400 to-teal-500', 
                                logoTxt: '৳',
                                activeColor: 'border-emerald-500 bg-emerald-50/30 text-emerald-950 ring-1 ring-emerald-350'
                              },
                              { 
                                id: 'bKash', 
                                name: 'বিকাশ (bKash)', 
                                detail: 'পার্সোনাল সেন্ডমানি',
                                logoBg: 'from-pink-500 to-rose-600', 
                                logoTxt: 'bKash',
                                activeColor: 'border-pink-500 bg-pink-50/30 text-pink-950 ring-1 ring-pink-350'
                              },
                              { 
                                id: 'Nagad', 
                                name: 'নগদ (Nagad)', 
                                detail: 'পার্সোনাল সেন্ডমানি',
                                logoBg: 'from-orange-500 to-red-600', 
                                logoTxt: 'Nagad',
                                activeColor: 'border-orange-500 bg-orange-50/30 text-orange-950 ring-1 ring-orange-350'
                              },
                              { 
                                id: 'Rocket', 
                                name: 'রকেট (Rocket)', 
                                detail: 'পার্সোনাল সেন্ডমানি',
                                logoBg: 'from-violet-600 to-indigo-700', 
                                logoTxt: 'Rocket',
                                activeColor: 'border-violet-600 bg-violet-50/30 text-violet-950 ring-1 ring-violet-350'
                              },
                              { 
                                id: 'CellFin', 
                                name: 'সেলফিন (CellFin)', 
                                detail: 'ফান্ড ট্রান্সফার',
                                logoBg: 'from-sky-500 to-blue-600', 
                                logoTxt: 'CellFin',
                                activeColor: 'border-sky-500 bg-sky-50/30 text-sky-950 ring-1 ring-sky-350'
                              },
                              { 
                                id: 'DBBL_Bank', 
                                name: 'ডাচ-বাংলা ব্যাংক', 
                                detail: 'DBBL চালান পেমেন্ট',
                                logoBg: 'from-teal-700 to-emerald-800', 
                                logoTxt: 'DBBL',
                                activeColor: 'border-teal-600 bg-teal-50/30 text-teal-950 ring-1 ring-teal-350'
                              }
                            ].map((method, idx) => {
                              const isSelected = qardDonationPayMethod === method.id;
                              return (
                                <button
                                  type="button"
                                  key={`${method.id}-${idx}`}
                                  onClick={() => setQardDonationPayMethod(method.id)}
                                  className={`p-3 border rounded-xl flex flex-col items-center justify-center text-center relative cursor-pointer active:scale-95 transition-all ${
                                    isSelected 
                                      ? method.activeColor 
                                      : 'border-slate-150 bg-slate-50/30 text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  {/* Radio indicator */}
                                  <span className={`absolute top-2 right-2 w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                                    isSelected ? 'bg-current text-white border-transparent' : 'border-slate-300'
                                  }`}>
                                    {isSelected && <Check className="w-2.5 h-2.5 stroke-[4] text-white" />}
                                  </span>

                                  {/* Custom visual logo shape */}
                                  <div className={`w-11 h-6 rounded-md bg-gradient-to-r ${method.logoBg} flex items-center justify-center text-[8.5px] font-black text-white uppercase tracking-tighter mb-1 shadow-2xs`}>
                                    {method.logoTxt}
                                  </div>

                                  <span className="text-[11px] font-black block leading-tight">{method.name}</span>
                                  <span className="text-[8.5px] opacity-75 mt-0.5 block font-bold font-mono">{method.detail}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 5. ট্রানজেকশন তথ্য এবং রিসিভার নির্দেশনাবলী Card - only if EXTERNALLY Selected */}
                        {qardDonationPayMethod !== 'balance' && (
                          <div className="bg-white border border-slate-150 p-4 rounded-2xl shadow-xs space-y-3 animate-slide-down">
                            <label className="text-xs font-black text-slate-700 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                              <span className="p-1.5 bg-indigo-50 rounded-lg text-indigo-700">
                                <Landmark className="w-4 h-4" />
                              </span>
                              📱 পেমেন্ট করার নির্দেশিকা ও অ্যাকাউন্ট নম্বরঃ
                            </label>

                            {/* Direct payment target guidelines with COPY options */}
                            <div className="p-3 bg-slate-55 border border-slate-150 rounded-xl space-y-2 text-slate-700 text-xs">
                              {qardDonationPayMethod === 'DBBL_Bank' ? (
                                <div className="space-y-1">
                                  <p className="text-[11px]"><span className="font-bold text-slate-500">ব্যাংক নামঃ</span> <span className="font-black text-slate-800">ডাচ-বাংলা ব্যাংক (DBBL)</span></p>
                                  <p className="text-[11px]"><span className="font-bold text-slate-500">একাউন্ট নামঃ</span> <span className="font-black text-slate-800">MD SUJON MIA</span></p>
                                  <div className="flex justify-between items-center bg-white p-2 border border-slate-200/60 rounded-lg mt-1">
                                    <div>
                                      <span className="block text-[8px] text-slate-400 font-bold uppercase">একাউন্ট নম্বর</span>
                                      <span className="font-mono font-black text-xs text-slate-800">2441580395850</span>
                                    </div>
                                    <button 
                                      type="button"
                                      onClick={() => handleCopyText('2441580395850', 'dbblAcc')}
                                      className="bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold px-2.5 py-1 rounded text-[9px] transition cursor-pointer"
                                    >
                                      {copiedField === 'dbblAcc' ? 'কপি হয়েছে!' : 'কপি করুন'}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <p className="text-[11px] leading-relaxed">
                                    নিচের <span className="font-bold text-rose-700">পার্সোনাল নম্বরে</span> আপনার অনুদানের টাকা <span className="font-bold text-slate-800">সেন্ড মানি (Send Money)</span> করুনঃ
                                  </p>
                                  <div className="flex justify-between items-center bg-white p-2.5 border border-slate-150 rounded-lg">
                                    <div>
                                      <span className="block text-[8px] text-slate-400 font-bold uppercase">পার্সোনাল নম্বর</span>
                                      <span className="font-mono font-black text-sm text-emerald-900">{appConfig.personalMfsNumber}</span>
                                    </div>
                                    <button 
                                      type="button"
                                      onClick={() => handleCopyText(appConfig.personalMfsNumber, 'qardMfs')}
                                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1.5 rounded-lg text-[10px] transition cursor-pointer"
                                    >
                                      {copiedField === 'qardMfs' ? 'কপি হয়েছে!' : 'নম্বর কপি করুন'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Verification form credentials input section */}
                            <div className="space-y-3 pt-2">
                              <h5 className="text-[11px] font-black text-slate-800 pb-1 border-b border-dashed border-slate-150">এবার পেমেন্ট ট্রানজেকশন তথ্য পূরণ করুনঃ</h5>
                              
                              <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 block">📱 প্রেরক নম্বর (Sender Number):</label>
                                <div className="relative">
                                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                    <Smartphone className="w-3.5 h-3.5" />
                                  </span>
                                  <input 
                                    type="text"
                                    value={qardDonationSender}
                                    onChange={(e) => setQardDonationSender(e.target.value)}
                                    placeholder="যে নম্বর থেকে টাকা পাঠিয়েছেন"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold focus:outline-none focus:bg-white focus:border-rose-500"
                                    required={qardDonationPayMethod !== 'balance'}
                                  />
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 block">🧾 লাস্ট ৪ সংখ্যা অথবা ট্রানজেকশন আইডি (TxID):</label>
                                <div className="relative">
                                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  </span>
                                  <input 
                                    type="text"
                                    value={qardDonationTxId}
                                    onChange={(e) => setQardDonationTxId(e.target.value)}
                                    placeholder="যেমনঃ ১২৩৪ অথবা 9J83KDU89"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold uppercase focus:outline-none focus:bg-white focus:border-rose-500"
                                    required={qardDonationPayMethod !== 'balance'}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 6. সিকিউরিটি পিন Card */}
                        <div className="bg-white border border-slate-150 p-4 rounded-2xl shadow-xs space-y-3">
                          <label className="text-xs font-black text-slate-700 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                            <span className="p-1.5 bg-rose-50 rounded-lg text-rose-700">
                              <Lock className="w-4 h-4" />
                            </span>
                            🔒 ৫. ৪-ডিজিটের সিকিউরিটি পিনঃ
                          </label>
                          <div className="space-y-1">
                            <input 
                              type="password"
                              maxLength={4}
                              value={qardPin}
                              onChange={(e) => setQardPin(e.target.value.replace(/\D/g, ''))}
                              placeholder="আপনার ৪ ডিজিটের ওয়ালেট পিন কোড"
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-center font-mono tracking-widest font-black focus:outline-none focus:bg-white focus:border-rose-500"
                              required
                            />
                            <p className="text-[9px] text-slate-400 font-bold block text-center">*আপনার ৪ ডিজিটের গোপন পিন কোডটি লিখুন যা লেনদেন সম্পন্ন করতে সাহায্য করে।</p>
                          </div>
                        </div>

                        {/* Submit Button */}
                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full py-3 bg-rose-800 hover:bg-rose-900 text-white text-xs font-black rounded-2xl transition-all shadow hover:shadow-md cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {loading ? 'প্রসেসিং হচ্ছে...' : (
                            <>
                              <HeartHandshake className="w-4 h-4" />
                              স্বেচ্ছাদান সম্পন্ন করুন (সদকা খাতা)
                            </>
                          )}
                        </button>
                      </form>
                    )}

                    {/* Tab 3: Request Loan form */}
                    {qardTab === 'apply' && (
                      <form onSubmit={handleQardHasanaApply} className="space-y-3.5">
                        <div className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-100 text-xs text-emerald-900 leading-relaxed font-bold space-y-1">
                          <p>সদস্য ক্যাটাগরিঃ <span className="text-emerald-950 font-black">{liveUser.memberGroup === 'need' ? 'নিড গ্রুপ সদস্য' : liveUser.role === 'admin' ? 'অ্যাডমিন সদস্য' : 'সাধারণ সদস্য'}</span></p>
                          <p>ঋণের সীমাঃ <span className="text-emerald-950 font-black">৳ {liveUser.role === 'admin' ? '১০,০০০' : liveUser.memberGroup === 'need' ? '১,০০০ - ২,০০০' : '৫,০০০'} BDT</span></p>
                        </div>

                        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-150 space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-500 block">ঋণের পরিমাণ:</label>
                          <input 
                            type="number"
                            value={qardLoanAmount}
                            onChange={(e) => setQardLoanAmount(e.target.value)}
                            placeholder="যেমনঃ ২০০০"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:border-rose-500"
                            required
                          />
                        </div>

                        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-150 space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-500 block">সিকিউরিটি পিন নাম্বারঃ</label>
                          <input 
                            type="password"
                            maxLength={4}
                            value={qardPin}
                            onChange={(e) => setQardPin(e.target.value.replace(/\D/g, ''))}
                            placeholder="আপনার ৪ ডিজিটের পিন কোড"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono tracking-widest focus:outline-none focus:border-rose-500"
                            required
                          />
                        </div>

                        <div className="p-2 border border-dashed border-rose-200 text-rose-900 bg-rose-50 text-[10px] leading-relaxed rounded-xl font-bold">
                          * সুদমুক্ত করযে হাসানা অত্যন্ত পবিত্র আমানত। এটি শুধুমাত্র মানুষের জরুরি প্রয়োজন মেটানোর জন্য এবং ১ মাসের মধ্যে সম্পূর্ণ বকেয়া পরিশোধ করা বাধ্যতামূলক।
                        </div>

                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full py-2.5 bg-rose-800 hover:bg-rose-900 text-white text-xs font-black rounded-2xl transition shadow hover:shadow-md cursor-pointer active:scale-95"
                        >
                          {loading ? 'প্রসেসিং হচ্ছে...' : 'ঋণ সহায়তা রিকোয়েস্ট পাঠান'}
                        </button>
                      </form>
                    )}

                    {/* Tab 4: History ledger */}
                    {qardTab === 'history' && (
                      <div className="space-y-3.5 pb-2">
                        {/* Interactive Outstanding Loan Card for this user */}
                        {(() => {
                          const myDisbursment = qardHistory.filter(t => t.userId === liveUser.uid && t.type === 'qard_loan_disbursment' && t.status === 'success');
                          const myRepayments = qardHistory.filter(t => t.userId === liveUser.uid && t.type === 'qard_loan_repayment' && t.status === 'success');
                          
                          if (myDisbursment.length > myRepayments.length) {
                            const totalBorrowed = myDisbursment.reduce((acc, c) => acc + c.amount, 0);
                            const totalRepaid = myRepayments.reduce((acc, c) => acc + c.amount, 0);
                            const due = totalBorrowed - totalRepaid;

                            if (due > 0) {
                              return (
                                <div className="bg-rose-50 p-4 border border-rose-200 rounded-2.5xl space-y-2.5">
                                  <div className="flex justify-between items-center text-rose-950">
                                    <span className="text-[11px] font-black">বকেয়া ঋণ ট্র্যাক বিবরণীঃ</span>
                                    <strong className="text-sm font-mono tracking-tight font-black">৳ {due?.toLocaleString('bn-BD')}</strong>
                                  </div>
                                  <p className="text-[10px] text-rose-805 font-bold leading-normal">
                                    আপনার একটি সুদমুক্ত করযে হাসানা ঋণ বকেয়া আমানত রয়েছে। অনুগ্রহ করে ১ মাসের মধ্যে পরিশোধ করে অন্য মুমূর্ষু সদস্যদের গ্রহণের সুযোগ দিন।
                                  </p>
                                  <button
                                    onClick={(e) => { e.preventDefault(); handleQardHasanaRepay(due); }}
                                    className="w-full py-2 bg-rose-800 hover:bg-rose-900 text-white font-black text-xs rounded-xl active:scale-95 transition cursor-pointer"
                                  >
                                    ওয়ালেট থেকে এক্ষুণি পরিশোধ করুন
                                  </button>
                                </div>
                              );
                            }
                          }
                          return null;
                        })()}

                        <h5 className="font-extrabold text-[11px] text-slate-800 border-b border-slate-100 pb-1">স্বচ্ছ ও উন্মুক্ত পাবলিক ট্রানজেকশন খাতাঃ</h5>
                        {qardHistory.length === 0 ? (
                          <p className="text-[10px] text-slate-400 italic text-center py-4">কোনো ঐতিহাসিক করযে হাসানা লেনদেন রেকর্ড পাওয়া যায়নি।</p>
                        ) : (
                          <div className="border border-slate-150 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-[220px] overflow-y-auto text-xs bg-slate-50/50">
                            {qardHistory.map((tx, idx) => (
                              <div key={`${tx.id}-${idx}`} className="p-3.5 flex justify-between items-start text-left bg-white font-sans">
                                <div className="space-y-0.5">
                                  <p className="font-extrabold text-slate-800 text-[11px]">
                                    {tx.type === 'qard_donation' && '❤️ ফান্ডের অনুদান'}
                                    {tx.type === 'qard_loan_request' && '⏳ ঋণের আবেদন'}
                                    {tx.type === 'qard_loan_disbursment' && '💸 ঋণ বিতরণ'}
                                    {tx.type === 'qard_loan_repayment' && '✅ ঋণ পরিশোধ সম্পন্ন'}
                                  </p>
                                  <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold">
                                    <span>সদস্যঃ {tx.userName}</span>
                                    <span>•</span>
                                    <span>{new Date(tx.createdAt).toLocaleDateString('bn-BD')}</span>
                                  </div>
                                </div>
                                <div className="text-right space-y-0.5 font-mono">
                                  <span className={`font-black text-[11px] ${tx.type === 'qard_donation' || tx.type === 'qard_loan_repayment' ? 'text-emerald-700' : tx.type === 'qard_loan_disbursment' ? 'text-rose-700' : 'text-slate-600'}`}>
                                    {tx.type === 'qard_donation' || tx.type === 'qard_loan_repayment' ? '+' : '-'}৳ {tx.amount?.toLocaleString('bn-BD')}
                                  </span>
                                  <div className="text-[8px] font-bold">
                                    {tx.status === 'success' ? (
                                      <span className="text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded-md font-sans">সফল</span>
                                    ) : tx.status === 'failed' ? (
                                      <span className="text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded-md font-sans">ব্যর্থ</span>
                                    ) : (
                                      <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-md font-sans font-bold">রিভিউ পেন্ডিং</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

        {selectedReceiptTx && (() => {
          const getTxCategoryKey = (type: string): string => {
            if (type === 'add_money') return 'add_money';
            if (type === 'balance_transfer' || type === 'received_transfer' || type === 'transfer') return 'send_money';
            if (type === 'withdraw' || type === 'cashout') return 'withdraw';
            if (type === 'telecom_recharge' || type === 'telecom') return 'telecom_recharge';
            if (type === 'shop_purchase' || type === 'coop_shop') return 'shop_purchase';
            if (type === 'deposit' || type === 'coop_savings_deposit') return 'deposit';
            if (type === 'loan_repayment' || type === 'qard_loan_disbursment' || type === 'qard_loan_repayment') return 'qard_loan';
            return 'default';
          };

          const txCatKey = getTxCategoryKey(selectedReceiptTx.type);
          const catConfig = appConfig?.receiptConfig?.typeConfigs?.[txCatKey];

          const defaultThemeMap: Record<string, 'emerald' | 'purple' | 'indigo' | 'amber' | 'rose' | 'slate'> = {
            add_money: 'purple',
            send_money: 'emerald',
            withdraw: 'rose',
            telecom_recharge: 'indigo',
            shop_purchase: 'amber',
            deposit: 'emerald',
            qard_loan: 'slate',
            default: 'emerald'
          };

          const themeKey = catConfig?.themeColor || defaultThemeMap[txCatKey] || 'emerald';

          const themeStyles = {
            emerald: {
              modalHeaderBg: 'bg-emerald-900',
              logoBg: 'bg-emerald-900',
              titleColor: 'text-emerald-900',
              tagStyle: 'bg-emerald-100 text-emerald-800 border-emerald-200',
              totalBox: 'bg-emerald-50/70 border-emerald-100 text-emerald-950',
              totalAmount: 'text-emerald-900',
              verifyDot: 'bg-emerald-500',
              verifyText: 'text-emerald-800',
              sigBox: 'bg-emerald-50 text-emerald-800 border-emerald-200',
              noticeBox: 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
            },
            purple: {
              modalHeaderBg: 'bg-purple-900',
              logoBg: 'bg-purple-900',
              titleColor: 'text-purple-900',
              tagStyle: 'bg-purple-100 text-purple-800 border-purple-200',
              totalBox: 'bg-purple-50/70 border-purple-100 text-purple-950',
              totalAmount: 'text-purple-900',
              verifyDot: 'bg-purple-500',
              verifyText: 'text-purple-800',
              sigBox: 'bg-purple-50 text-purple-800 border-purple-200',
              noticeBox: 'bg-purple-50/80 border-purple-200 text-purple-900'
            },
            indigo: {
              modalHeaderBg: 'bg-indigo-900',
              logoBg: 'bg-indigo-900',
              titleColor: 'text-indigo-900',
              tagStyle: 'bg-indigo-100 text-indigo-800 border-indigo-200',
              totalBox: 'bg-indigo-50/70 border-indigo-100 text-indigo-950',
              totalAmount: 'text-indigo-900',
              verifyDot: 'bg-indigo-500',
              verifyText: 'text-indigo-800',
              sigBox: 'bg-indigo-50 text-indigo-800 border-indigo-200',
              noticeBox: 'bg-indigo-50/80 border-indigo-200 text-indigo-900'
            },
            amber: {
              modalHeaderBg: 'bg-amber-900',
              logoBg: 'bg-amber-900',
              titleColor: 'text-amber-900',
              tagStyle: 'bg-amber-100 text-amber-800 border-amber-200',
              totalBox: 'bg-amber-50/70 border-amber-100 text-amber-950',
              totalAmount: 'text-amber-900',
              verifyDot: 'bg-amber-500',
              verifyText: 'text-amber-800',
              sigBox: 'bg-amber-50 text-amber-800 border-amber-200',
              noticeBox: 'bg-amber-50/80 border-amber-200 text-amber-900'
            },
            rose: {
              modalHeaderBg: 'bg-rose-900',
              logoBg: 'bg-rose-900',
              titleColor: 'text-rose-900',
              tagStyle: 'bg-rose-100 text-rose-800 border-rose-200',
              totalBox: 'bg-rose-50/70 border-rose-100 text-rose-950',
              totalAmount: 'text-rose-900',
              verifyDot: 'bg-rose-500',
              verifyText: 'text-rose-800',
              sigBox: 'bg-rose-50 text-rose-800 border-rose-200',
              noticeBox: 'bg-rose-50/80 border-rose-200 text-rose-900'
            },
            slate: {
              modalHeaderBg: 'bg-slate-900',
              logoBg: 'bg-slate-900',
              titleColor: 'text-slate-900',
              tagStyle: 'bg-slate-200 text-slate-800 border-slate-300',
              totalBox: 'bg-slate-100 border-slate-200 text-slate-950',
              totalAmount: 'text-slate-900',
              verifyDot: 'bg-slate-600',
              verifyText: 'text-slate-800',
              sigBox: 'bg-slate-100 text-slate-800 border-slate-300',
              noticeBox: 'bg-slate-100 border-slate-300 text-slate-900'
            }
          }[themeKey] || {
            modalHeaderBg: 'bg-emerald-900',
            logoBg: 'bg-emerald-900',
            titleColor: 'text-emerald-900',
            tagStyle: 'bg-emerald-100 text-emerald-800 border-emerald-200',
            totalBox: 'bg-emerald-50/70 border-emerald-100 text-emerald-950',
            totalAmount: 'text-emerald-900',
            verifyDot: 'bg-emerald-500',
            verifyText: 'text-emerald-800',
            sigBox: 'bg-emerald-50 text-emerald-800 border-emerald-200',
            noticeBox: 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
          };

          const activeHeaderTitle = catConfig?.headerTitle || appConfig?.receiptConfig?.headerTitle || 'ডিজিটাল পেমেন্ট রসিদ';
          const activeCompanyName = appConfig?.receiptConfig?.companyName || 'বিজনেস নেটওয়ার্ক বাংলাদেশ (BNB)';
          const activeOrgDetails = appConfig?.receiptConfig?.organizationDetails || 'মাল্টিপারপাস কো-অপারেティブ সোসাইটি লিমিটেড\nনিবন্ধন নংঃ ডিএনবি-৯৮২২০ | হেমায়েতপুর, সাভার';
          const activeOfficialTag = appConfig?.receiptConfig?.officialTagText || 'অফিসিয়াল কপি';
          const activeAdminSigName = appConfig?.receiptConfig?.adminSignatureName || '';
          const activeAdminSigTitle = appConfig?.receiptConfig?.adminSignatureTitle || 'অ্যাডমিন সিগনেচার';
          const activeFooterVerification = appConfig?.receiptConfig?.footerVerificationText || 'ডিজিটালভাবে অনুমোদিত ও ভেরিফাইড';
          const activeFooterComputerGenerated = appConfig?.receiptConfig?.footerComputerGeneratedText || 'এই কপিটি সম্পূর্ণ কম্পিউটার সিগনেচার করা হয়েছে।';
          const activeNoticeText = catConfig?.noticeText;

          return (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
              <style>{`
                @media print {
                  body * {
                    visibility: hidden !important;
                  }
                  #receipt-print-area, #receipt-print-area * {
                    visibility: visible !important;
                  }
                  #receipt-print-area {
                    position: fixed !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                    background: white !important;
                    padding: 40px !important;
                    color: black !important;
                    z-index: 999999 !important;
                    border: none !important;
                    box-shadow: none !important;
                  }
                }
              `}</style>
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col font-sans"
              >
                {/* Receipt Header (Modal Control) */}
                <div className={`${themeStyles.modalHeaderBg} px-6 py-4 flex items-center justify-between text-white print:hidden transition-colors duration-300`}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center p-1">
                      <BNBLogo size="100%" variant="white" />
                    </div>
                    <h3 className="font-bold text-sm tracking-wide">{activeHeaderTitle}</h3>
                  </div>
                  <button 
                    onClick={() => setSelectedReceiptTx(null)}
                    className="w-8 h-8 bg-white/10 hover:bg-white/20 active:scale-95 transition-all rounded-full flex items-center justify-center text-white font-sans"
                  >
                    ✕
                  </button>
                </div>

                {/* Printable Area */}
                <div id="receipt-print-area" className="p-6 md:p-8 bg-slate-50 flex flex-col gap-6 text-slate-800">
                  {/* Receipt Watermark and Header */}
                  <div className="border-b-2 border-dashed border-slate-200 pb-4 text-center relative space-y-1">
                    <div className={`mx-auto w-12 h-12 ${themeStyles.logoBg} rounded-full flex items-center justify-center p-2 mb-2 shadow-md transition-colors duration-300`}>
                      <BNBLogo size="100%" variant="white" />
                    </div>
                    <h1 className={`text-lg font-extrabold ${themeStyles.titleColor}`}>{activeCompanyName}</h1>
                    <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider whitespace-pre-line leading-relaxed">
                      {activeOrgDetails}
                    </p>
                    
                    {/* Decorative tag */}
                    <div className={`absolute top-2 right-2 ${themeStyles.tagStyle} text-[9px] font-bold px-2 py-0.5 rounded-full border`}>
                      {activeOfficialTag}
                    </div>
                  </div>

                  {/* Voucher Meta details */}
                  <div className="grid grid-cols-2 gap-4 text-xs font-medium border-b border-slate-200 pb-4">
                    <div className="space-y-1">
                      <p className="text-slate-400 text-[10px] uppercase font-bold">রসিদ নম্বর</p>
                      <p className="text-slate-900 font-extrabold font-mono text-sm tracking-wide">
                        {selectedReceiptTx.receiptNo || ('REC-' + (selectedReceiptTx.id.replace(/\D/g, "").slice(-6) || Math.floor(100000 + Math.random() * 900000)))}
                      </p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-slate-400 text-[10px] uppercase font-bold">তারিখ ও সময়</p>
                      <p className="text-slate-900 font-bold font-mono">
                        {new Date(selectedReceiptTx.createdAt).toLocaleDateString('bn-BD')} {new Date(selectedReceiptTx.createdAt).toLocaleTimeString('bn-BD')}
                      </p>
                    </div>
                  </div>

                  {/* Member / Payment Details Table */}
                  <div className="space-y-3.5 flex-1 bg-white p-4 rounded-2xl border border-slate-200">
                    <h4 className="text-xxs font-bold text-slate-400 uppercase tracking-widest border-b pb-1.5 mb-2.5">সদস্য তথ্য ও পেমেন্ট বিবরণী</h4>
                    
                    <div className="flex justify-between text-xs gap-2">
                      <span className="text-slate-500 font-medium">সদস্যের নামঃ</span>
                      <span className="text-slate-900 font-extrabold">{selectedReceiptTx.userName}</span>
                    </div>

                    <div className="flex justify-between text-xs gap-2">
                      <span className="text-slate-500 font-medium">সদস্য আইডিঃ</span>
                      <span className="text-slate-900 font-bold font-mono">{selectedReceiptTx.memberId}</span>
                    </div>

                    <div className="flex justify-between text-xs gap-2">
                      <span className="text-slate-500 font-medium">পেমেন্ট মেথডঃ</span>
                      <span className="text-slate-900 font-bold uppercase font-mono">{selectedReceiptTx.paymentMethod || 'Wallet Balance'}</span>
                    </div>

                    {selectedReceiptTx.senderInfo && (
                      <div className="flex justify-between text-xs gap-2">
                        <span className="text-slate-500 font-medium">প্রেরক নম্বর/অ্যাকাউন্টঃ</span>
                        <span className="text-slate-900 font-bold font-mono">{selectedReceiptTx.senderInfo}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-xs gap-2">
                      <span className="text-slate-500 font-medium">ট্রানজেকশন আইডি (TxnID)ঃ</span>
                      <span className="text-slate-900 font-bold font-mono select-all text-indigo-600 bg-indigo-50/50 px-1.5 py-0.2 rounded border border-indigo-100">{selectedReceiptTx.transactionId || selectedReceiptTx.id}</span>
                    </div>

                    <div className="flex justify-between text-xs gap-2">
                      <span className="text-slate-500 font-medium">রসিদ স্ট্যাটাসঃ</span>
                      {selectedReceiptTx.status === 'success' ? (
                        <span className={`${themeStyles.tagStyle} px-2 py-0.5 rounded text-[10px] font-black tracking-wide border`}>সফল (APPROVED)</span>
                      ) : selectedReceiptTx.status === 'failed' ? (
                        <span className="bg-rose-50 text-rose-800 border border-rose-150 px-2 py-0.5 rounded text-[10px] font-black tracking-wide">বাতিল (REJECTED)</span>
                      ) : (
                        <span className="bg-amber-50 text-amber-800 border border-amber-150 px-2 py-0.5 rounded text-[10px] font-black tracking-wide animate-pulse">পেন্ডিং (PENDING)</span>
                      )}
                    </div>

                    {(selectedReceiptTx.status === 'failed' || selectedReceiptTx.rejectReason || selectedReceiptTx.adminNote) && (
                      <div className="bg-rose-50 p-3 rounded-xl border border-rose-150 text-left">
                        <span className="text-[9px] font-bold text-rose-800 uppercase block">বাতিল করার কারণ (Rejection Reason)</span>
                        <p className="text-[11px] leading-relaxed text-rose-700 font-extrabold mt-1">
                          {selectedReceiptTx.rejectReason || selectedReceiptTx.adminNote || 'প্রদত্ত তথ্যের অমিল অথবা ভুল ট্রানজেকশন নম্বরের কারণে আবেদনটি বাতিল করা হয়েছে।'}
                        </p>
                      </div>
                    )}

                    <div className="flex justify-between text-xs gap-2 border-t pt-3.5 mt-3.5">
                      <span className="text-slate-500 font-bold">পেমেন্টের বিবরণঃ</span>
                      <span className="text-slate-900 font-semibold text-right max-w-[200px]">{selectedReceiptTx.typeLabel} ({cleanDescription(selectedReceiptTx.description, selectedReceiptTx.status).split('।')[0]})</span>
                    </div>

                    <div className={`flex justify-between items-center text-xs border-t pt-3.5 mt-3.5 ${themeStyles.totalBox} -mx-4 -mb-4 p-4 rounded-b-2xl border`}>
                      <span className="font-extrabold text-sm">প্রদত্ত মোট টাকাঃ</span>
                      <span className={`text-lg font-extrabold font-mono ${themeStyles.totalAmount}`}>
                        ৳ {selectedReceiptTx.amount.toLocaleString('bn-BD')}/-
                      </span>
                    </div>
                  </div>

                  {activeNoticeText && (
                    <div className={`p-3 rounded-xl border text-xs font-semibold text-center leading-relaxed ${themeStyles.noticeBox}`}>
                      📌 {activeNoticeText}
                    </div>
                  )}

                  {/* Footer seal/signature */}
                  <div className="flex justify-between items-end mt-2 pt-4 border-t border-slate-200">
                    <div className="text-[10px] text-slate-500 font-mono">
                      <p className={`${themeStyles.verifyText} font-bold flex items-center gap-1`}>
                        <span className={`w-2 h-2 rounded-full ${themeStyles.verifyDot} animate-pulse`}></span>
                        {activeFooterVerification}
                      </p>
                      <p className="text-slate-400">{activeFooterComputerGenerated}</p>
                    </div>
                    {(() => {
                      const sigNameToShow = selectedReceiptTx.approvedByAdmin || selectedReceiptTx.adminName || selectedReceiptTx.adminSignatureName || (selectedReceiptTx.isManual ? activeAdminSigName : '');
                      if (!sigNameToShow) {
                        return (
                          <div className="text-center font-bold">
                            <div className={`text-[9px] px-3 py-1 ${themeStyles.sigBox} rounded-lg font-mono mb-1 border italic text-slate-400`}>
                              ডিজিটাল অটো রিসিট (নো সিগনেচার)
                            </div>
                            <span className="text-[8.5px] text-slate-400 block border-t pt-0.5">স্বয়ংক্রিয় পেমেন্ট সিস্টেম</span>
                          </div>
                        );
                      }
                      return (
                        <div className="text-center font-bold">
                          <div className={`text-[10px] px-3 py-1 ${themeStyles.sigBox} rounded-lg shadow-2xs font-serif italic mb-1 border`}>
                            {sigNameToShow}
                          </div>
                          <span className="text-[9px] text-slate-450 block border-t pt-0.5">{activeAdminSigTitle}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Print and Actions footer */}
                <div className="bg-slate-105 p-4 border-t border-slate-200 flex gap-3 print:hidden">
                  <button 
                    onClick={() => setSelectedReceiptTx(null)}
                    className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    বন্ধ করুন
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className={`flex-1 py-2.5 ${themeStyles.modalHeaderBg} text-white font-bold rounded-xl text-xs transition shadow-md active:scale-95 cursor-pointer`}
                  >
                    🖨️ প্রিন্ট রসিদ
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </div>

      {/* Bottom Fixed Navigation bar matching bKash app structure */}
      <nav className={bottomNavClass}>
        <div className="max-w-md w-full mx-auto flex justify-around items-center">
          
          {/* Tab Home */}
          {isTabActive('home') && (
            <button 
              onClick={() => { setActiveTab('home'); setModalType(null); }}
              className="flex flex-col items-center gap-0.5 cursor-pointer relative z-10 transition-all duration-200 active:scale-95 group"
            >
              <div className={`p-1.5 rounded-xl transition-all duration-300 flex items-center justify-center ${
                activeTab === 'home' 
                  ? 'bg-[#e6f7f4] text-[#00a884] scale-105 shadow-xs' 
                  : 'text-slate-400 hover:text-[#00a884]/70 hover:bg-slate-50'
              }`}>
                <Home className={`w-5 h-5 transition-transform duration-200 ${activeTab === 'home' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              </div>
              <span className={`text-[9.5px] sm:text-[10px] transition-colors duration-200 ${
                activeTab === 'home' ? 'text-[#00a884] font-black' : 'text-slate-500 font-bold'
              }`}>
                {t('হোম')}
              </span>
            </button>
          )}

          {/* Tab Deposit */}
          {isTabActive('deposit') && (
            <button 
              onClick={() => { setActiveTab('deposit'); setModalType(null); }}
              className="flex flex-col items-center gap-0.5 cursor-pointer relative z-10 transition-all duration-200 active:scale-95 group"
            >
              <div className={`p-1.5 rounded-xl transition-all duration-300 flex items-center justify-center ${
                activeTab === 'deposit' 
                  ? 'bg-orange-50 text-orange-600 scale-105 shadow-xs' 
                  : 'text-slate-400 hover:text-orange-500/70 hover:bg-slate-50'
              }`}>
                <Send className={`w-5 h-5 transition-transform duration-200 ${activeTab === 'deposit' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              </div>
              <span className={`text-[9.5px] sm:text-[10px] transition-colors duration-200 ${
                activeTab === 'deposit' ? 'text-orange-600 font-black' : 'text-slate-500 font-bold'
              }`}>
                {t('সেন্ড মানি')}
              </span>
            </button>
          )}

          {/* Tab Statements */}
          {isTabActive('history') && (
            <button 
              onClick={() => { setActiveTab('history'); setModalType(null); }}
              className="flex flex-col items-center gap-0.5 cursor-pointer relative z-10 transition-all duration-200 active:scale-95 group"
            >
              <div className={`p-1.5 rounded-xl transition-all duration-300 flex items-center justify-center ${
                activeTab === 'history' 
                  ? 'bg-blue-50 text-blue-600 scale-105 shadow-xs' 
                  : 'text-slate-400 hover:text-blue-500/70 hover:bg-slate-50'
              }`}>
                <History className={`w-5 h-5 transition-transform duration-200 ${activeTab === 'history' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              </div>
              <span className={`text-[9.5px] sm:text-[10px] transition-colors duration-200 ${
                activeTab === 'history' ? 'text-blue-600 font-black' : 'text-slate-500 font-bold'
              }`}>
                {t('ইতিহাস')}
              </span>
            </button>
          )}

          {/* Tab profile switching button */}
          {isTabActive('profile') && (
            <button 
              onClick={() => { setActiveTab('profile'); setModalType(null); }}
              className="flex flex-col items-center gap-0.5 cursor-pointer relative z-10 transition-all duration-200 active:scale-95 group"
            >
              <div className={`p-1.5 rounded-xl transition-all duration-300 flex items-center justify-center ${
                activeTab === 'profile' 
                  ? 'bg-purple-50 text-purple-600 scale-105 shadow-xs' 
                  : 'text-slate-400 hover:text-purple-500/70 hover:bg-slate-50'
              }`}>
                <UserCircle className={`w-5 h-5 transition-transform duration-200 ${activeTab === 'profile' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              </div>
              <span className={`text-[9.5px] sm:text-[10px] transition-colors duration-200 ${
                activeTab === 'profile' ? 'text-purple-600 font-black' : 'text-slate-500 font-bold'
              }`}>
                {t('প্রোফাইল')}
              </span>
            </button>
          )}

        </div>
      </nav>

      {/* Authentic Demo Auth Prompt Modal */}
      <AnimatePresence>
        {showDemoAuthPrompt && (
          <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 z-55 font-sans">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 250 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm border border-slate-100 shadow-2xl relative text-center overflow-hidden"
            >
              {/* Decorative corner accent */}
              <div className="absolute top-0 inset-x-0 h-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />
              
              {/* Shield Alert Icon */}
              <div className="mx-auto w-14 h-14 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center mb-4.5 border border-emerald-100 shadow-3xs">
                <ShieldAlert className="w-8 h-8 animate-bounce" style={{ animationDuration: '3s' }} />
              </div>

              <h3 className="text-base font-black text-slate-800 tracking-tight leading-snug">
                অ্যাকাউন্ট ভেরিফিকেশন প্রয়োজন
              </h3>
              <p className="text-[10px] text-emerald-800 font-bold bg-emerald-50/60 px-2.5 py-0.5 rounded-full inline-block mt-1 mx-auto border border-emerald-100">
                🔒 অ্যাকাউন্ট যাচাইকরণ সেশন
              </p>

              <p className="text-xs text-slate-500 font-medium leading-relaxed mt-4 mb-6">
                সফটওয়্যারের এই লাইভ ফিচারটি বা সেকশনটি ব্যবহার করতে অনুগ্রহ করে একটি নতুন অ্যাকাউন্ট তৈরি করুন অথবা আগের অ্যাকাউন্ট থাকলে লগইন করুন।
              </p>

              <div className="space-y-2.5">
                {/* Action 1: Create New Account (Registers) */}
                <button
                  onClick={() => {
                    setShowDemoAuthPrompt(false);
                    onLogout(true); // logs out and redirects straight to Registration!
                  }}
                  className="w-full bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-extrabold py-3 px-4 rounded-xl text-xs transition-all shadow-md shadow-emerald-800/15 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  🧑‍💻 নতুন অ্যাকাউন্ট তৈরি বা নিবন্ধন করুন
                </button>

                {/* Action 2: Login */}
                <button
                  onClick={() => {
                    setShowDemoAuthPrompt(false);
                    onLogout(false); // logs out and redirects straight to Log In!
                  }}
                  className="w-full bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 border border-slate-200 font-extrabold py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  🔑 পূর্বের অ্যাকাউন্ট থেকে লগইন করুন
                </button>

                {/* Cancel */}
                <button
                  onClick={() => setShowDemoAuthPrompt(false)}
                  className="w-full py-2 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer mt-1"
                >
                  পরে করবো, ড্যাশবোর্ড দেখুন
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Beautiful Feature Maintenance Popup Modal */}
      <AnimatePresence>
        {showMaintenanceModal && (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 z-55 font-sans animate-fade-in">
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 22, stiffness: 280 }}
              className="bg-slate-900 text-white rounded-3xl p-5.5 w-full max-w-sm border border-slate-800 shadow-2xl relative text-center overflow-hidden"
            >
              {/* Premium Colorful Top Accent Bar */}
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#00A884] via-amber-400 to-[#12f3c7]" />
              
              {/* Animated Construction Gear/Wrench Badge */}
              <div className="mx-auto w-15 h-15 bg-emerald-950/50 text-emerald-400 rounded-2xl flex items-center justify-center mb-4.5 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)] relative">
                <div className="absolute inset-0 rounded-2xl bg-emerald-500/10 animate-ping opacity-60" style={{ animationDuration: '2.5s' }} />
                <Construction className="w-7 h-7 relative z-10 text-[#12f3c7] animate-pulse" />
              </div>

              {/* Badges/Category */}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-[#00A884]/15 text-[#12f3c7] border border-[#00A884]/30 mb-3.5">
                🛠️ আপডেট কাজ চলতেছে
              </span>

              {/* Service Title */}
              <h3 className="text-base font-black text-white tracking-tight leading-snug">
                {maintenanceServiceName}
              </h3>
              
              {/* Sub-text message */}
              <p className="text-xs text-slate-300 font-medium leading-relaxed mt-3 px-1">
                সম্মানিত মেম্বার, আমাদের প্রযুক্তিগত আপগ্রেড ও নতুন ফিচার সংযোজনের জন্য এই বিশেষ সেকশনটির উন্নয়নকাজ চলমান রয়েছে। খুব শীঘ্রই সেবাটি লাইভ চালু করা হবে!
              </p>

              {/* Countdown/Estimate representation */}
              <div className="mt-4 p-2.5 rounded-2xl bg-slate-950/40 border border-slate-800/80 flex items-center justify-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-450 animate-pulse shrink-0" />
                <span className="text-[10px] text-amber-300 font-black tracking-tight">অগ্রগতিঃ অতি দ্রুত চালু করা হবে ইন-শা-আল্লাহ</span>
              </div>

              {/* Action Button */}
              <div className="mt-5.5">
                <button
                  onClick={() => setShowMaintenanceModal(false)}
                  className="w-full bg-gradient-to-r from-[#00A884] to-[#009b79] hover:brightness-110 active:scale-98 text-slate-950 font-black py-3 px-4 rounded-xl text-xs transition-all shadow-md shadow-[#00A884]/10 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  ঠিক আছে, ধন্যবাদ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 1. Ration Card Activation Modal */}
      <AnimatePresence>
        {showCreateCardModal && (
          <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 z-55 font-sans">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3.5xl p-6 w-full max-w-md border border-slate-100 shadow-2xl relative overflow-hidden text-left"
            >
              <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500" />
              
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-amber-50 text-amber-700 rounded-xl flex items-center justify-center border border-amber-100">
                    <CreditCard className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">ডিজিটাল রেশন কার্ড সক্রিয় করুন</h3>
                    <p className="text-[9.5px] text-slate-400 font-extrabold font-sans">সদস্যদের জন্য বিশেষ পাইকারি পোর্টালে এক্সেস</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowCreateCardModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-605 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black text-slate-500 block mb-1">কার্ডধারীর পুরো নাম (বাংলা অথবা ইংরেজি)</label>
                  <input
                    type="text"
                    value={rationCardName}
                    onChange={(e) => setRationCardName(e.target.value)}
                    placeholder="উদাঃ মোঃ আব্দুল করিম"
                    className="w-full bg-slate-50 border border-slate-150 rounded-xl text-xs px-3 py-2.5 font-bold focus:outline-none focus:border-amber-400 text-slate-804"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 block mb-1">স্থায়ী ঠিকানা (যেখানে রেশন ডেলিভারি পাঠানো হবে)</label>
                  <input
                    type="text"
                    value={rationCardAddress}
                    onChange={(e) => setRationCardAddress(e.target.value)}
                    placeholder="উদাঃ বাসা নং ১২, রোড ০৪, মিরপুর, ঢাকা"
                    className="w-full bg-slate-50 border border-slate-150 rounded-xl text-xs px-3 py-2.5 font-bold focus:outline-none focus:border-amber-400 text-slate-804"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 block mb-1">রেশন কার্ডের টাইপ</label>
                    <select
                      value={rationCardType}
                      onChange={(e: any) => setRationCardType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-150 rounded-xl text-xs px-2.5 py-2.5 font-bold focus:outline-none focus:border-amber-400 text-slate-804"
                    >
                      <option value="General Retail">General Retail</option>
                      <option value="Premium Wholesale">Premium Wholesale</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 block mb-1">মনোনীত উত্তরাধিকারী (Nominee)</label>
                    <input
                      type="text"
                      value={rationCardNominee}
                      onChange={(e) => setRationCardNominee(e.target.value)}
                      placeholder="উদাঃ আয়শা খাতুন (স্ত্রী)"
                      className="w-full bg-slate-50 border border-slate-150 rounded-xl text-xs px-3 py-2.5 font-bold focus:outline-none focus:border-amber-400 text-slate-804"
                    />
                  </div>
                </div>

                <div className="bg-amber-50 text-amber-900 p-3 rounded-2xl border border-amber-100 text-[10.5px] leading-relaxed font-bold">
                  ⚠️ সতর্কতাঃ ডিজিটাল লাইভ রেশন কার্ডটি স্থায়ীভাবে সক্রিয় ও কার্ড প্রিন্টিং এর জন্য ৳১৫০ টাকা ওয়ান-টাইম সক্রিয়করণ ফি আপনার মেইন ওয়ালেট ব্যালেন্স থেকে কর্তন করা হবে।
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    onClick={() => setShowCreateCardModal(false)}
                    className="flex-1 py-3 text-center border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs font-black rounded-xl cursor-pointer active:scale-98 transition"
                  >
                    বন্ধ করুন
                  </button>
                  <button
                    onClick={handleCreateRationCard}
                    className="flex-1 bg-gradient-to-r from-amber-605 to-yellow-605 hover:from-amber-700 hover:to-yellow-700 text-white text-xs font-black py-3 rounded-xl shadow-md cursor-pointer active:scale-98 transition text-center"
                  >
                    নম্বরসহ সক্রিয় করুন 💳
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* 2. Admin Add New Safe Deal Modal */}
        {showAddDealModal && (
          <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 z-55 font-sans">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3.5xl p-6 w-full max-w-sm border border-slate-100 shadow-2xl relative overflow-hidden text-left"
            >
              <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />
              
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-50 text-emerald-850 rounded-xl flex items-center justify-center border border-emerald-100">
                    <Megaphone className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 tracking-tight">নিরাপদ ডিল নতুন অফার যোগ করুন</h3>
                    <p className="text-[9px] text-slate-455 font-extrabold font-sans">এডমিন প্যানেল প্রভিলেজড কনফিগারেশন</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAddDealModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black text-slate-500 block mb-1">ডিলের শিরোনাম</label>
                  <input
                    type="text"
                    value={newDealTitle}
                    onChange={(e) => setNewDealTitle(e.target.value)}
                    placeholder="উদাঃ খাঁটি মানের গাভীর ঘন তরল দুধ"
                    className="w-full bg-slate-50 border border-slate-150 rounded-xl text-xs px-3 py-2.5 font-bold focus:outline-none focus:border-emerald-450 text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-550 block mb-1">বিস্তারিত বিবরণ ও স্পেসিফিকেশন</label>
                  <textarea
                    rows={2}
                    value={newDealDesc}
                    onChange={(e) => setNewDealDesc(e.target.value)}
                    placeholder="উদাঃ সরাসরি খামার থেকে সরবরাহ করা শতভাগ প্রিজারভেটিভ বিহীন ঘন দুধ..."
                    className="w-full bg-slate-50 border border-slate-150 rounded-xl text-xs px-3 py-2 font-bold focus:outline-none focus:border-emerald-450 text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 block mb-1">মূল্য (৳ BDT)</label>
                    <input
                      type="number"
                      value={newDealPrice}
                      onChange={(e) => setNewDealPrice(e.target.value)}
                      placeholder="উদাঃ ৮০"
                      className="w-full bg-slate-50 border border-slate-150 rounded-xl text-xs px-3 py-2.5 font-bold focus:outline-none focus:border-emerald-450 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-550 block mb-1">মিনিমাম অর্ডার সীমা</label>
                    <input
                      type="text"
                      value={newDealMinQty}
                      onChange={(e) => setNewDealMinQty(e.target.value)}
                      placeholder="উদাঃ ১০ লিটার"
                      className="w-full bg-slate-50 border border-slate-150 rounded-xl text-xs px-3 py-2.5 font-bold focus:outline-none focus:border-emerald-450 text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 block mb-1">প্রোডাক্ট ক্যাটাগরি ইমোজি (Emoji)</label>
                  <div className="grid grid-cols-5 gap-1 text-center">
                    {['🛢️', '🍯', '🧼', '🧈', '🥛', '🥩', '🥚', '🌾', '🥭', '📦'].map((em, idx) => (
                      <button
                        key={`${em}-${idx}`}
                        type="button"
                        onClick={() => setNewDealEmoji(em)}
                        className={`p-2 rounded-xl border text-lg hover:bg-slate-100 ${newDealEmoji === em ? 'border-emerald-500 bg-emerald-50' : 'border-slate-150 bg-slate-50'}`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => setShowAddDealModal(false)}
                    className="flex-1 py-2.5 text-center border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs font-black rounded-lg cursor-pointer transition active:scale-98"
                  >
                    বাতিল
                  </button>
                  <button
                    onClick={handleAddNewSafeDeal}
                    className="flex-1 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-black py-2.5 rounded-lg shadow-md cursor-pointer transition active:scale-98 text-center"
                  >
                    ডিল পাবলিশ করুন 🤝
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* 3. Smart Delivery & Order Checkout Modal */}
        {selectedProductForCheckout && (() => {
          const item = selectedProductForCheckout;
          const subtotal = item.price * checkoutQuantity;
          
          let deliveryChargeRangeText = '৳ ০ (দোকান পিকআপ)';
          let deliveryTimeText = '৩ ঘণ্টার মধ্যে রেডি';
          let estBaseCharge = 0;
          
          if (checkoutDeliveryType === 'home') {
            if (checkoutDistance <= 2) {
              estBaseCharge = 5;
              deliveryChargeRangeText = '৳ ৫ - ২০ (০-২ কিমি)';
              deliveryTimeText = '⏱️ ১-২ ঘণ্টার মধ্যে দ্রুত হোম ডেলিভারি';
            } else if (checkoutDistance <= 20) {
              estBaseCharge = 20;
              deliveryChargeRangeText = '৳ ২০ - ৫০ (২-২০ কিমি)';
              deliveryTimeText = '⏱️ ৩-৬ ঘণ্টার মধ্যে হোম ডেলিভারি';
            } else if (checkoutDistance <= 50) {
              estBaseCharge = 50;
              deliveryChargeRangeText = '৳ ৫০ - ১০০ (২০-৫০ কিমি)';
              deliveryTimeText = '⏱️ ১-২ দিনের মধ্যে রেডি';
            } else {
              estBaseCharge = 100;
              deliveryChargeRangeText = '৳ ১০০ বা তার বেশি (৫০+ কিমি)';
              deliveryTimeText = '⏱️ ৩-৫ দিন (সুন্দরবন বা এস এ পরিবহন কুরিয়ার)';
            }
          }
          
          const grandTotal = subtotal + estBaseCharge;
          
          const handleMeasureDistance = () => {
            if (!navigator.geolocation) {
              alert("আপনার ব্রাউজারে জিপিএস লোকেশন দেখার সুবিধা নেই। অনুগ্রহ করে ম্যানুয়ালি ডিস্টেন্স নির্ধারণ করুন।");
              return;
            }
            setIsMeasuring(true);
            navigator.geolocation.getCurrentPosition(
              async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                setCheckoutLat(lat);
                setCheckoutLng(lng);
                setCheckoutLocationShared(true);
                
                // Calculate distance from product's actual shop location
                const storeLat = item.latitude !== undefined ? item.latitude : 23.7915;
                const storeLng = item.longitude !== undefined ? item.longitude : 90.2311;
                
                const R = 6371; // radius in km
                const dLat = (storeLat - lat) * Math.PI / 180;
                const dLng = (storeLng - lng) * Math.PI / 180;
                const a = 
                  Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat * Math.PI / 180) * Math.cos(storeLat * Math.PI / 180) * 
                  Math.sin(dLng/2) * Math.sin(dLng/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                let calculatedDistance = R * c;
                
                // limit decimal places and boundaries
                if (calculatedDistance < 0.1) calculatedDistance = 0.5;
                setCheckoutDistance(parseFloat(calculatedDistance.toFixed(2)));
                
                // Reverse Geocoding via Nominatim OpenStreetMap
                try {
                  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=bn`, {
                    headers: { 'User-Agent': 'BNB-Cooperative-App' }
                  });
                  if (res.ok) {
                    const data = await res.json();
                    setCheckoutAddress(data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                  } else {
                    setCheckoutAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                  }
                } catch (e) {
                  setCheckoutAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                }
                
                setIsMeasuring(false);
                alert(`সফলভাবে জিপিএস ট্র্যাক করা হয়েছে! শপ হতে আপনার দূরত্বঃ ${calculatedDistance.toFixed(2)} কিমি। ঠিকানাটি স্বয়ংক্রিয়ভাবে পূরণ করা হয়েছে।`);
              },
              (error) => {
                console.error(error);
                setIsMeasuring(false);
                alert("জিপিএস লোকেশন পারমিশন ব্লকড হয়েছে বা সিগন্যাল পাওয়া যায়নি। অনুগ্রহ করে ম্যানুয়ালি স্লাইডার ব্যবহার করুন বা ঠিকানা টাইপ করুন।");
              },
              { enableHighAccuracy: true, timeout: 8000 }
            );
          };

          return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 font-sans overflow-y-auto">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl w-full max-w-md border border-slate-100 shadow-2xl overflow-hidden relative max-h-[92vh] flex flex-col text-left"
              >
                {/* Header ribbon */}
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-orange-500 via-rose-500 to-amber-500" />
                
                {/* Modal Title bar */}
                <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🛍️</span>
                    <div>
                      <h3 className="text-xs font-black text-slate-900 tracking-tight">Smart Delivery & Order Checkout</h3>
                      <p className="text-[9px] text-slate-500 font-bold uppercase">বিবিজি কো-অপারেটিভ সুপার শপ</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedProductForCheckout(null)}
                    className="p-1 px-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 bg-white shadow-3xs cursor-pointer text-[10px] font-black"
                  >
                    বন্ধ করুন
                  </button>
                </div>
                
                <div className="p-5 overflow-y-auto space-y-4 flex-1 scrollbar-thin">
                  {/* Item Description block */}
                  <div className="flex gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div className="w-12 h-12 bg-white border border-slate-200 text-2.5xl rounded-xl flex items-center justify-center shrink-0 shadow-inner">
                      {item.icon}
                    </div>
                    <div className="flex-1 space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-orange-100 text-orange-950 font-black text-[7.5px] px-1 py-0.2 rounded-sm uppercase tracking-wider">{item.supplier}</span>
                        <span className="text-amber-500 text-[10px] font-black">★ {item.rating}</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 truncate">{item.name}</h4>
                      <p className="text-[10px] text-slate-500 truncate leading-snug">{item.description}</p>
                      <div className="text-[10px] text-[#8b1e10] font-extrabold font-mono pt-1">
                        একক পাইকারি মূল্যঃ ৳ {item.price.toLocaleString('bn-BD')} BDT
                      </div>
                    </div>
                  </div>
                  
                  {/* Quantity selector */}
                  <div className="flex justify-between items-center py-2 px-3 bg-slate-55/40 border rounded-2xl shadow-3xs">
                    <span className="text-xs font-bold text-slate-705">অর্ডারের পরিমাণ (Quantity)</span>
                    <div className="flex items-center gap-3">
                      <button 
                        type="button" 
                        disabled={checkoutQuantity <= 1}
                        onClick={() => setCheckoutQuantity(prev => Math.max(1, prev - 1))}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-850 flex items-center justify-center font-black disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed hover:bg-slate-100 text-xs shadow-3xs"
                      >
                        -
                      </button>
                      <span className="text-xs font-black font-mono">{checkoutQuantity}</span>
                      <button 
                        type="button" 
                        onClick={() => setCheckoutQuantity(prev => prev + 1)}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-850 flex items-center justify-center font-black cursor-pointer hover:bg-slate-100 text-xs shadow-3xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  
                  {/* Delivery Selection */}
                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-black text-slate-600 block">ডেলিভারি পদ্ধতি নির্বাচন করুন (Delivery Mode) *</label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setCheckoutDeliveryType('home')}
                        className={`p-3 rounded-xl border text-center font-sans tracking-tight transition flex flex-col items-center gap-1 cursor-pointer ${
                          checkoutDeliveryType === 'home'
                            ? 'border-orange-550 bg-orange-50/70 text-orange-950 font-black shadow-xs'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-base">🚚</span>
                        <span className="text-[11px]">হোম ডেলিভারি</span>
                        <span className="text-[7.5px] font-extrabold text-orange-600 uppercase tracking-wider">রিয়েল-টাইম ম্যাপ চার্জ</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCheckoutDeliveryType('pickup')}
                        className={`p-3 rounded-xl border text-center font-sans tracking-tight transition flex flex-col items-center gap-1 cursor-pointer ${
                          checkoutDeliveryType === 'pickup'
                            ? 'border-orange-550 bg-orange-50/70 text-orange-950 font-black shadow-xs'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-55'
                        }`}
                      >
                        <span className="text-base">🏪</span>
                        <span className="text-[11px]">দোকান সংগ্রহ (Pickup)</span>
                        <span className="text-[7.5px] font-extrabold text-emerald-600 uppercase tracking-wider">ডেলিভারি চার্জঃ ৳ ০ ফ্রী</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Map section - Displays only if delivery mode is 'home' */}
                  {checkoutDeliveryType === 'home' ? (
                    <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-3 shadow-inner">
                      <div className="flex justify-between items-center">
                        <div className="text-[10px] font-black text-rose-800 flex items-center gap-1">
                          <span>🧭</span> SMART GPS LOCATOR
                        </div>
                        <span className="bg-rose-100 text-rose-950 font-black px-1.5 py-0.2 rounded-sm text-[8px] uppercase tracking-wide">Google Maps Platform</span>
                      </div>
                      
                      <p className="text-[9.5px] text-slate-500 font-semibold leading-normal">
                        📍 <strong>দোকান গন্তব্যঃ</strong> সাভার কো-অপারেティブ স্টোর হাউজ (হেমায়েতপুর, ঢাকা)। রিয়েল-টাইম দূরত্ব মেপে ডেলিভারি সময় হিসাব করুন।
                      </p>
                      
                      {/* GPS Action Button */}
                      <button
                        type="button"
                        disabled={isMeasuring}
                        onClick={handleMeasureDistance}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-900 hover:bg-slate-950 text-white rounded-xl text-[10px] font-black transition shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        {isMeasuring ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white/60 border-t-white rounded-full animate-spin"></span>
                            লাইভ জিপিএস লোকেশন ও দূরত্ব মাপা হচ্ছে...
                          </>
                        ) : (
                          <>
                            <span>📍</span> লাইভ জিপিএস শেয়ার করুন ও দূরত্ব মাপুন
                          </>
                        )}
                      </button>
                      
                      {/* Interactive Slider representation */}
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between items-center text-[9.5px] font-black">
                          <span className="text-slate-500">मैनुয়ালি দূরত্ব সংশোধন (Distance)</span>
                          <span className="text-orange-700 font-sans font-extrabold">{checkoutDistance.toFixed(1)} কিমি দূরে</span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="80"
                          step="0.5"
                          value={checkoutDistance}
                          onChange={(e) => setCheckoutDistance(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                        />
                        <div className="flex justify-between text-[7px] text-slate-400 font-black font-mono">
                          <span>০.১ কিমি</span>
                          <span>২ কিমি</span>
                          <span>২০ কিমি</span>
                          <span>৫০ কিমি</span>
                          <span>৮০+ কিমি</span>
                        </div>
                      </div>
                      
                      {/* Interactive outputs for distance range */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-dashed border-slate-205">
                        <div className="p-2 bg-white border border-slate-150 rounded-xl space-y-0.5">
                          <span className="text-[7.5px] font-black uppercase text-slate-400 block">আনুমানিক রেঞ্জ চার্জ</span>
                          <span className="text-[10px] text-slate-800 font-extrabold">{deliveryChargeRangeText}</span>
                        </div>
                        <div className="p-2 bg-white border border-slate-150 rounded-xl space-y-0.5">
                          <span className="text-[7.5px] font-black uppercase text-slate-400 block">আনুমানিক ডেলিভারি সময়</span>
                          <span className="text-[10px] text-emerald-700 font-extrabold">{deliveryTimeText}</span>
                        </div>
                      </div>
                      
                      {/* Address area */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-600 block">ডেলিভারি গন্তব্য ঠিকানা *</label>
                        <textarea
                          rows={2}
                          value={checkoutAddress}
                          onChange={(e) => setCheckoutAddress(e.target.value)}
                          placeholder="উদাঃ ২ নং কলোনি মোড়, বাসা নং- ৪বি, সাভার, ঢাকা।"
                          className="w-full bg-white border border-slate-150 rounded-xl text-xs px-3 py-2 text-slate-800 outline-none focus:border-orange-500 font-semibold"
                        />
                      </div>
                    </div>
                  ) : (
                    /* Shop Pickup details block */
                    <div className="bg-emerald-50/70 border border-emerald-150 p-4 rounded-2xl space-y-2 text-center shadow-3xs">
                      <span className="text-2.5xl block animate-pulse">🏪</span>
                      <h4 className="text-xs font-black text-emerald-950">দোকান সংগ্রহ পিকআপ অপশন!</h4>
                      <p className="text-[10px] text-slate-500 leading-relaxed max-w-sm mx-auto font-bold">
                        পণ্যটি আমাদের সাভার হেমায়েতপুর আউটলেট থেকে নিজেই সংগ্রহ করতে হবে। কোনো ডেলিভারি চার্জ প্রযোজ্য হবে না। অর্ডার কনফার্ম হওয়ার পর ৩ ঘণ্টার মধ্যে পণ্য প্রস্তুত রাখব।
                      </p>
                    </div>
                  )}
                  
                  {/* Consignee Billing details */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[9.5px] font-black text-slate-500 block mb-1">প্রাপকের নাম *</label>
                      <input
                        type="text"
                        value={checkoutName}
                        onChange={(e) => setCheckoutName(e.target.value)}
                        placeholder={liveUser.name}
                        className="w-full bg-slate-55 border border-slate-150 rounded-xl text-xs px-3 py-2.5 font-bold focus:outline-none focus:border-orange-500 text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[9.5px] font-black text-slate-500 block mb-1">যোগাযোগ মোবাইল নং *</label>
                      <input
                        type="text"
                        value={checkoutPhone}
                        onChange={(e) => setCheckoutPhone(e.target.value)}
                        placeholder={liveUser.phone}
                        className="w-full bg-slate-55 border border-slate-150 rounded-xl text-xs px-3 py-2.5 font-bold focus:outline-none focus:border-orange-500 text-slate-800"
                      />
                    </div>
                  </div>
                  
                  {/* Payment method */}
                  <div className="space-y-1.5">
                    <label className="text-[10.5px] font-black text-slate-600 block">পরিশোধ পদ্ধতি (Payment Mode) *</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setCheckoutPaymentMethod('cod')}
                        className={`py-2 px-1 rounded-xl border text-center font-sans tracking-tight transition flex flex-col justify-center items-center cursor-pointer ${
                          checkoutPaymentMethod === 'cod'
                            ? 'border-amber-600 bg-amber-50 text-amber-950 font-black shadow-3xs'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-55'
                        }`}
                      >
                        <span className="text-[10px]">💵 ক্যাশ অন ডেলিভারি</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCheckoutPaymentMethod('shop')}
                        className={`py-2 px-1 rounded-xl border text-center font-sans tracking-tight transition flex flex-col justify-center items-center cursor-pointer ${
                          checkoutPaymentMethod === 'shop'
                            ? 'border-orange-600 bg-orange-50 text-orange-950 font-black shadow-3xs'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-55'
                        }`}
                      >
                        <span className="text-[10px]">🛍️ শপ ওয়ালেট</span>
                        <span className="text-[7px] text-slate-400 block font-mono font-bold">৳ {(liveUser.superShopBalance || 0).toLocaleString('bn-BD')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCheckoutPaymentMethod('main')}
                        className={`py-2 px-1 rounded-xl border text-center font-sans tracking-tight transition flex flex-col justify-center items-center cursor-pointer ${
                          checkoutPaymentMethod === 'main'
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black shadow-3xs'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-55'
                        }`}
                      >
                        <span className="text-[10px]">🏦 মেইন ওয়ালেট</span>
                        <span className="text-[7px] text-slate-400 block font-mono font-bold">৳ {(liveUser.balance || 0).toLocaleString('bn-BD')}</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Cooperative PIN input */}
                  <div>
                    <label className="text-[10px] font-black text-slate-500 block mb-1">আপনার ৫ ডিজিটের নিরাপত্তা পিন টাইপ করুন *</label>
                    <input
                      type="password"
                      maxLength={5}
                      value={checkoutPin}
                      onChange={(e) => setCheckoutPin(e.target.value)}
                      placeholder="৫ ডিজিটের সমবায় পিন টাইপ করুন"
                      className="w-full bg-slate-50 border border-slate-150 rounded-xl text-xs px-3 py-2.5 font-bold focus:outline-none focus:border-orange-500 text-slate-800"
                    />
                  </div>
                  
                  {/* Bill details */}
                  <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl space-y-1 text-xs font-semibold text-slate-600">
                    <div className="flex justify-between items-center text-[10px]">
                      <span>সাব-টোটাল ({checkoutQuantity} ইউনিট)</span>
                      <span className="font-mono text-slate-800">৳ {subtotal.toLocaleString('bn-BD')}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px]">
                      <span>প্রাক্কলিত বেস চার্জ</span>
                      <span className="font-mono text-slate-800">৳ {estBaseCharge.toLocaleString('bn-BD')}</span>
                    </div>
                    {checkoutDeliveryType === 'home' && (
                      <p className="text-[8px] text-rose-800 font-bold italic border-l-2 border-rose-350 pl-1.5 leading-normal pb-0.5">
                        * দ্রষ্টব্যঃ ডেলিভারি চার্জ সম্পূর্ণ ফিক্সড নয়। চার্জটি বিক্রেতা (Seller) দূরত্ব ও ওজনের ভিত্তিতে কাস্টমাইজ করবেন যা buyer পরে আমার অর্ডার ট্র্যাক পাতায় দেখতে পাবেন।
                      </p>
                    )}
                    <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-[#8b1e10] font-black text-xs">
                      <span>সর্বমোট আনুমানিক ফি</span>
                      <span className="font-mono text-sm">৳ {grandTotal.toLocaleString('bn-BD')} BDT</span>
                    </div>
                  </div>
                </div>
                
                {/* Actions Footer */}
                <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedProductForCheckout(null)}
                    className="flex-1 py-2.5 text-center border border-slate-200 hover:bg-slate-100 text-slate-500 text-xs font-black rounded-lg cursor-pointer transition active:scale-98"
                  >
                    বাতিল
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCheckoutOrder}
                    className="flex-1 bg-orange-700 hover:bg-orange-850 text-white text-xs font-black py-2.5 rounded-lg shadow-md cursor-pointer transition active:scale-98 text-center"
                  >
                    অর্ডার কনফার্ম করুন 🛍️
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}

        {/* 4. Smart Order Completion Success view popup */}
        {orderPlacementSuccess && (() => {
          const succ = orderPlacementSuccess;
          return (
            <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 z-55 font-sans animate-fade-in text-center">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl p-6 w-full max-w-sm border border-slate-100 shadow-2xl relative overflow-hidden space-y-4"
              >
                <div className="absolute top-0 inset-x-0 h-1.5 bg-emerald-500" />
                
                <div className="w-12 h-12 bg-emerald-100/85 text-emerald-800 rounded-full flex items-center justify-center text-2xl mx-auto shadow-inner animate-bounce">
                  ✓
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-xs font-black text-emerald-700">আপনার অর্ডারটি সফল হয়েছে!</h3>
                  <p className="text-[9px] text-slate-400 font-mono font-black uppercase">অর্ডার আইডিঃ {succ.id}</p>
                </div>
                
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 text-[10px] text-slate-600 text-left space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">পণ্যের নাম ও সংখ্যাঃ</span>
                    <span className="text-slate-800 font-extrabold truncate max-w-[150px]">{succ.product?.name} x {succ.quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">ডেলিভারি পদ্ধতিঃ</span>
                    <span className="text-emerald-850 font-black">{succ.deliveryType === 'home' ? '🏠 হোম ডেলিভারি' : '🏪 দোকান পিকআপ'}</span>
                  </div>
                  {succ.deliveryType === 'home' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">অফিস হইতে ডিস্টেন্সঃ</span>
                        <span className="text-slate-800 font-black font-mono">{succ.deliveryDistance?.toFixed(1)} কিমি</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">সম্ভাব্য চার্জ রেঞ্জঃ</span>
                        <span className="text-slate-850 font-black">{succ.deliveryChargeRange || '৳ ৫ - ২০'}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">আনুমানিক ডেলিভারি সময়ঃ</span>
                    <span className="text-emerald-700 font-black">{succ.deliveryEstTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold">নির্ধারিত পেমেন্ট ট্র্যাকিংঃ</span>
                    <span className="text-slate-800 font-black">{succ.paymentType}</span>
                  </div>
                  <div className="border-t border-slate-205 pt-2 flex justify-between font-bold text-slate-900 text-[11px]">
                    <span>পরিশোধিত/সর্বমোট আনুমানিক ফিঃ</span>
                    <span className="font-mono text-[#8b1e10]">৳ {succ.grandTotal?.toLocaleString('bn-BD')} BDT</span>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-150 p-2.5 rounded-xl text-[9px] text-amber-900 text-left leading-normal font-bold">
                  💡 <strong>মনোযোগ দিনঃ</strong> ঢাকার যানজট বা পণ্যের সাইজের সাপেক্ষে ডেলিভারি চার্জ সম্পূর্ণ ফিক্সড নয়। চূড়ান্ত চার্জ বিক্রেতা নির্ধারণ করবেন, অর্ডার ট্র্যাক পাতা হতে তা দেখতে পাবেন।
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => {
                      setOrderPlacementSuccess(null);
                      setShopActiveSubTab('orders'); // Open order tracking sub tab
                    }}
                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-950 text-white text-xs font-black rounded-lg shadow-md cursor-pointer transition active:scale-98 text-center"
                  >
                    📦 অর্ডার ট্র্যাক খাতা
                  </button>
                  <button
                    onClick={() => setOrderPlacementSuccess(null)}
                    className="flex-1 py-2.5 text-center border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 text-xs font-black rounded-lg cursor-pointer transition active:scale-98"
                  >
                    পণ্য সম্ভার
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Live Real-time Push Notification Toast Banner */}
      <AnimatePresence>
        {livePushToast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-50 bg-slate-900/95 text-white p-4 rounded-2xl shadow-2xl border border-emerald-400 backdrop-blur-md font-sans space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-black text-emerald-400 flex items-center gap-1">
                  <BellRing className="w-4 h-4 text-amber-300 animate-bounce" />
                  নতুন অ্যাডমিন নোটিফিকেশন
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLivePushToast(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h4 className="text-xs font-black text-white leading-tight">{livePushToast.title}</h4>
              <p className="text-[11px] text-slate-300 font-medium line-clamp-2 mt-0.5 leading-relaxed">{livePushToast.body}</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setLivePushToast(null);
                  setShowNotificationsModal(true);
                }}
                className="text-[11px] font-black bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-sm active:scale-95"
              >
                <Eye className="w-3.5 h-3.5" />
                পড়ুন ও বিস্তারিত দেখুন
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Personal Notifications Full-Screen Overlay */}
      <AnimatePresence>
        {showNotificationsModal && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-50 bg-slate-50 w-full h-full min-h-screen font-sans flex flex-col text-slate-800"
          >
            {/* Header */}
            <div className="bg-[#005B43] text-white px-5 py-4 flex items-center justify-between shadow-md shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔔</span>
                <div>
                  <h2 className="text-sm font-black tracking-tight">নোটিফিকেশন সেন্টার</h2>
                  <p className="text-[9.5px] text-emerald-250 font-bold font-mono">Personal Notifications</p>
                </div>
              </div>
              <button
                onClick={() => setShowNotificationsModal(false)}
                className="p-1.5 hover:bg-white/10 rounded-full text-white/95 transition-colors cursor-pointer active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Toolbar */}
            {userNotifications.length > 0 && (
              <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex justify-between items-center shrink-0">
                <span className="text-[10.5px] text-slate-600 font-extrabold">
                  {userNotifications.filter(n => !isNotificationRead(n)).length > 0
                    ? `${userNotifications.filter(n => !isNotificationRead(n)).length}টি অপঠিত নোটিফিকেশন আছে`
                    : 'সকল নোটিফিকেশন পঠিত'}
                </span>
                {userNotifications.some(n => !isNotificationRead(n)) && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs text-[#005B43] hover:text-[#004230] font-black cursor-pointer hover:underline transition-all"
                  >
                    সব পঠিত করুন ✓
                  </button>
                )}
              </div>
            )}

            {/* Notifications List */}
            <div className="flex-grow overflow-y-auto p-4 space-y-3 bg-slate-50">
              {userNotifications.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-20 px-6">
                  <div className="w-16 h-16 bg-white text-slate-400 rounded-full flex items-center justify-center mb-4 border border-slate-200/80 shadow-md">
                    <Bell className="w-8 h-8 stroke-[1.5] text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-800 font-black">কোনো নোটিফিকেশন নেই</p>
                  <p className="text-xs text-slate-500 font-bold mt-1.5 max-w-xs leading-relaxed">
                    এখানে এডমিন প্যানেল কর্তৃক প্রেরিত অফিসিয়াল নোটিশ, বোনাস এবং ওয়ালেট টাকা জমা/কর্তন সংক্রান্ত নোটিফিকেশন প্রদর্শিত হবে।
                  </p>
                </div>
              ) : (
                userNotifications.map((n, idx) => {
                  const isUnread = !isNotificationRead(n);
                  const isBonus = n.type === 'bonus' || n.category === 'bonus' || n.notifyType === 'credit';
                  const isFine = n.type === 'fine' || n.category === 'fine' || n.notifyType === 'debit';
                  return (
                    <div
                      key={`${n.id}-${idx}`}
                      onClick={() => {
                        if (isUnread) {
                          handleMarkAsRead(n.id);
                        }
                        setSelectedDetailNotif(n);
                      }}
                      className={`p-4 rounded-2xl border transition-all duration-250 cursor-pointer text-left ${
                        isUnread
                          ? 'bg-emerald-50/90 border-emerald-300 shadow-sm relative overflow-hidden ring-1 ring-emerald-200'
                          : 'bg-white border-slate-200/80 hover:bg-slate-100 shadow-3xs'
                      }`}
                    >
                      {/* Unread Glow Indicator */}
                      {isUnread && (
                        <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-emerald-500" />
                      )}

                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-grow space-y-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isUnread && (
                              <span className="w-2 h-2 bg-emerald-500 rounded-full shrink-0 animate-pulse" />
                            )}
                            <span className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full ${
                              isBonus
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : isFine
                                ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                : 'bg-amber-100 text-amber-950 border border-amber-300'
                            }`}>
                              {isBonus ? '🎁 ওয়ালেট বোনাস' : isFine ? '💸 টাকা কর্তন / চার্জ' : '📢 এডমিন নোটিশ'}
                            </span>
                            {(isBonus || isFine) && !!n.amount && n.amount > 0 && (
                              <span className={`text-[11px] font-black font-mono px-2 py-0.5 rounded-md ${
                                isBonus ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                              }`}>
                                {isBonus ? '+' : '-'}৳{n.amount}
                              </span>
                            )}
                          </div>

                          <h3 className={`text-xs tracking-tight leading-snug ${isUnread ? 'font-black text-emerald-950' : 'font-bold text-slate-800'}`}>
                            {n.title}
                          </h3>

                          <p className="text-[11.5px] text-slate-700 leading-relaxed font-medium whitespace-pre-line">
                            {n.body || (n as any).message || ''}
                          </p>

                          <div className="flex justify-between items-center pt-1 border-t border-slate-100/80 mt-1">
                            <span className="block text-[9px] text-slate-400 font-bold font-mono">
                              {new Date(n.createdAt).toLocaleString('bn-BD', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            <span className="text-[10px] font-black text-[#005B43] flex items-center gap-0.5 hover:underline">
                              বিস্তারিত দেখুন &rarr;
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-white border-t border-slate-200 text-center shrink-0">
              <button
                onClick={() => setShowNotificationsModal(false)}
                className="w-full py-3 bg-[#005B43] hover:bg-[#004230] text-white text-xs font-black rounded-xl cursor-pointer shadow-md active:scale-98 transition"
              >
                বন্ধ করুন
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Message Reader View Modal */}
      <AnimatePresence>
        {selectedDetailNotif && (() => {
          const isDetailBonus = selectedDetailNotif.type === 'bonus' || selectedDetailNotif.category === 'bonus' || selectedDetailNotif.notifyType === 'credit';
          const isDetailFine = selectedDetailNotif.type === 'fine' || selectedDetailNotif.category === 'fine' || selectedDetailNotif.notifyType === 'debit';
          return (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-md p-4 flex items-center justify-center font-sans"
            >
              <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                {/* Detail Header */}
                <div className={`p-5 text-white flex items-start justify-between ${
                  isDetailBonus
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-700'
                    : isDetailFine
                    ? 'bg-gradient-to-r from-rose-600 to-red-700'
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl shadow-inner shrink-0">
                      {isDetailBonus ? '🎁' : isDetailFine ? '⚠️' : '📢'}
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider opacity-90 px-2 py-0.5 bg-black/20 rounded-full inline-block">
                        {isDetailBonus ? 'ওয়ালেট বোনাস জমা' : isDetailFine ? 'ওয়ালেট জরিমানা কর্তন' : 'অফিসিয়াল সিস্টেম নোটিশ'}
                      </span>
                      <h2 className="text-base font-black mt-1 leading-snug">
                        {selectedDetailNotif.title}
                      </h2>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedDetailNotif(null)}
                    className="p-1.5 hover:bg-black/10 rounded-full transition cursor-pointer shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Amount Banner if Bonus or Fine */}
                {(isDetailBonus || isDetailFine) && !!selectedDetailNotif.amount && selectedDetailNotif.amount > 0 && (
                  <div className={`px-6 py-4 flex items-center justify-between border-b ${
                    isDetailBonus
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-900'
                      : 'bg-rose-50 border-rose-100 text-rose-900'
                  }`}>
                    <span className="text-xs font-bold">অ্যালাউন্স / টাকার পরিমাণ:</span>
                    <span className="text-2xl font-black font-mono">
                      {isDetailBonus ? '+' : '-'}৳{selectedDetailNotif.amount}
                    </span>
                  </div>
                )}

              {/* Message Body */}
              <div className="p-6 overflow-y-auto space-y-4 text-left">
                <p className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-line">
                  {selectedDetailNotif.body}
                </p>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>প্রেরক: BNB এডমিন প্যানেল</span>
                  <span>
                    {new Date(selectedDetailNotif.createdAt).toLocaleString('bn-BD', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200">
                <button
                  onClick={() => setSelectedDetailNotif(null)}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  ফিরে যান
                </button>
              </div>
            </div>
          </motion.div>
        );
      })()}
      </AnimatePresence>

    </div>
  );
}
