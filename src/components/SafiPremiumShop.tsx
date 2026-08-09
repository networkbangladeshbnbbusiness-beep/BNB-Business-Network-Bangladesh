import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Search, ShoppingCart, ShoppingBag, Home, User, Tag, 
  Trash2, Plus, Minus, CheckCircle, Volume2, ArrowRight,
  Sparkles, Award, Heart, HelpCircle, Star, ShieldCheck, Phone
} from 'lucide-react';
import { User as UserType, AppConfig } from '../types';
import { db } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';

interface SafiPremiumShopProps {
  user: UserType;
  onClose: () => void;
  appConfig: AppConfig;
  handleBuyPremiumSafi: (itemName: string, itemPrice: number) => Promise<void>;
  syncLiveProfile: () => void;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  emoji: string;
  brand: string;
}

export default function SafiPremiumShop({ 
  user, 
  onClose, 
  appConfig, 
  handleBuyPremiumSafi,
  syncLiveProfile 
}: SafiPremiumShopProps) {
  const isUrl = (str: string) => {
    if (!str) return false;
    return str.startsWith('http://') || str.startsWith('https://') || str.startsWith('data:image/');
  };

  // Navigation tabs: 'home' | 'shop' | 'vacation_sale' | 'cart' | 'account'
  const [activeTab, setActiveTab] = useState<'home' | 'shop' | 'vacation_sale' | 'cart' | 'account'>('home');

  const pushedTabRef = React.useRef<string>('home');

  useEffect(() => {
    if (activeTab !== 'home') {
      if (pushedTabRef.current !== activeTab) {
        pushedTabRef.current = activeTab;
        window.history.pushState({ dashboardModal: 'safi', safiTab: activeTab }, '');
      }
    } else {
      pushedTabRef.current = 'home';
    }
  }, [activeTab]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (state && state.dashboardModal === 'safi') {
        const targetTab = state.safiTab || 'home';
        if (activeTab !== targetTab) {
          pushedTabRef.current = targetTab;
          setActiveTab(targetTab);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [activeTab]);
  const [safiSearchQuery, setSafiSearchQuery] = useState('');
  const [safiSelectedCategory, setSafiSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [successOrder, setSuccessOrder] = useState<string | null>(null);
  const [isVoiceOn, setIsVoiceOn] = useState(false);
  const [pinNumber, setPinNumber] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [address, setAddress] = useState('বাসা/গ্রাম: , ডাকঘর: , থানা: , জেলা: ');
  const [phone, setPhone] = useState(user.phone || '');
  const [checkoutType, setCheckoutType] = useState<'single' | 'cart'>('cart');
  const [singleItemToBuy, setSingleItemToBuy] = useState<any>(null);

  const defaultSafiCategories = [
    { 
      id: 'weddings_events', 
      name: 'Weddings & Events', 
      nameBn: 'বিয়ে ও অনুষ্ঠান', 
      image: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=150&auto=format&fit=crop&q=60' 
    },
    { 
      id: 'jewelry_accessories', 
      name: 'Jewelry & Accessories', 
      nameBn: 'গহনা ও অলংকার', 
      image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=150&auto=format&fit=crop&q=60' 
    },
    { 
      id: 'manicure', 
      name: 'Manicure', 
      nameBn: 'নখ ও রূপচর্চা', 
      image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=150&auto=format&fit=crop&q=60' 
    },
    { 
      id: 'clothing_fashion', 
      name: 'Dresses', 
      nameBn: 'পোশাক', 
      image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=150&auto=format&fit=crop&q=60' 
    },
    { 
      id: 'cosmetics_lifestyle', 
      name: 'Beauty', 
      nameBn: 'সৌন্দর্য ও প্রসাধন', 
      image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=150&auto=format&fit=crop&q=60' 
    },
    { 
      id: 'tech_gadgets', 
      name: 'Tops & Tees', 
      nameBn: 'টপস ও টি-শার্ট', 
      image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=150&auto=format&fit=crop&q=60' 
    },
    { 
      id: 'muslim_clothing', 
      name: 'Muslim clothing', 
      nameBn: 'মুসলিম পোশাক', 
      image: 'https://images.unsplash.com/photo-1583391265517-35bbadd01209?w=150&auto=format&fit=crop&q=60' 
    }
  ];

  const [safiCategories, setSafiCategories] = useState<any[]>(defaultSafiCategories);

  // Authentic AliExpress & Safi products
  const defaultSafiProducts = [
    {
      id: 'sf_oil',
      category: 'food_grocery',
      name: 'Safi কাঠের ঘানি ভাঙা সর্ষের তৈল',
      price: 295,
      desc: '১ লিটার বোতল, শতভাগ বিশুদ্ধ সরিষার বীজ থেকে প্রস্তুত',
      emoji: '🛢️',
      badge: 'Best Pure',
      sale: true,
      soldCount: '১২K+ বিক্রি',
      rating: '৪.৯',
      reviews: '৪৫০',
      discountText: '৳৩০ ছাড় ৳৪০০ ক্রয়ে',
      brand: 'Safi Pure',
      stock: '১২০ পিস',
      image: ''
    },
    {
      id: 'sf_honey_wild',
      category: 'food_grocery',
      name: 'Safi প্রিমিয়াম খাঁটি ফুলের মধু',
      price: 650,
      desc: '৫০০ গ্রাম প্যাক, সুন্দরবনের প্রাকৃতিক চাক হতে সংগৃহীত',
      emoji: '🍯',
      badge: 'Organic',
      sale: true,
      soldCount: '৮K+ বিক্রি',
      rating: '৫.০',
      reviews: '৯২০',
      discountText: '৳৫০ ছাড় ৳৫০০ ক্রয়ে',
      brand: 'Safi Organics',
      stock: '৪৫ পিস',
      image: ''
    },
    {
      id: 'sf_ghee',
      category: 'food_grocery',
      name: 'Safi প্রিমিয়াম গাওয়া ঘি (Pure Cow Ghee)',
      price: 420,
      desc: '২৫০ গ্রাম বয়াম, traditional ও খাঁটি পদ্ধতিতে তৈরি',
      emoji: '🧈',
      badge: 'Traditional',
      sale: true,
      soldCount: '৫K+ বিক্রি',
      rating: '৪.৯',
      reviews: '৮৯০',
      discountText: '৳৩০ ছাড় ৳৪০০ ক্রয়ে',
      brand: 'Safi Dairy',
      stock: '৬০ পিস',
      image: ''
    },
    {
      id: 'sf_honey_black',
      category: 'food_grocery',
      name: 'Safi প্রিমিয়াম কালোজিরা মধু',
      price: 550,
      desc: '৫০০ গ্রাম প্রিমিয়াম গ্লাস জার, নাটোর ও সিরাজগঞ্জের বিশ্বস্ত কালোজিরা ফুলের মধু',
      emoji: '🐝',
      badge: 'Organic',
      sale: false,
      soldCount: '৩K+ বিক্রি',
      rating: '৪.৮',
      reviews: '৩৫০',
      discountText: 'সীমিত অফার',
      brand: 'Safi Organics',
      stock: '৮৫ পিস',
      image: ''
    },
    {
      id: 'sf_rice_chinigura',
      category: 'food_grocery',
      name: 'Safi সুগন্ধি চিনিগুঁড়া চাল',
      price: 145,
      desc: '১ কেজি এয়ারটাইট প্যাক, দিনাজপুর থেকে সংগৃহীত সুগন্ধি পোলাও চাল',
      emoji: '🌾',
      badge: 'Super Food',
      sale: true,
      soldCount: '১৫K+ বিক্রি',
      rating: '৪.৮',
      reviews: '১.১K',
      discountText: 'সেরা অফার',
      brand: 'Safi Foods',
      stock: '২০০ কেজি',
      image: ''
    },
    {
      id: 'sf_darjeeling_tea',
      category: 'food_grocery',
      name: 'Safi প্রিমিয়াম দার্জিলিং ব্ল্যাক টি',
      price: 250,
      desc: '২০০ গ্রাম লাক্সারি টিন ক্যান, বাগানের তরতাজা প্রথম চাপের প্রিমিয়াম চা পাতা',
      emoji: '🍵',
      badge: 'Luxury',
      sale: false,
      soldCount: '২K+ বিক্রি',
      rating: '৪.৯',
      reviews: '১৫০',
      discountText: 'সেরা লিজেন্ড',
      brand: 'Safi Brew',
      stock: '১৫০ পিস',
      image: ''
    },
    {
      id: 'sf_sharee',
      category: 'clothing_fashion',
      name: 'Safi ঐতিহ্যবাহী টাঙ্গাইলের সুতি শাড়ি',
      price: 1450,
      desc: '১০০% পিওর সুতা দিয়ে কারিগরদের তাঁতে বোনা আকর্ষণীয় ডিজাইনের শাড়ি',
      emoji: '👘',
      badge: 'Handloom',
      sale: true,
      soldCount: '৪৫০ বিক্রি',
      rating: '৪.৭',
      reviews: '৪০',
      discountText: '৳১০০ ছাড়',
      brand: 'Safi Weaves',
      stock: '২৫ পিস',
      image: ''
    },
    {
      id: 'sf_panjabi',
      category: 'clothing_fashion',
      name: 'Safi প্রিমিয়াম সেমি-ফিটেড পাঞ্জাবি',
      price: 1250,
      desc: 'লিলেন ও সুতি ব্লেন্ডের আরামদায়ক পাঞ্জাবি, মেটাল বোতাম ও এমব্রয়ডারি ওয়ার্ক',
      emoji: '🧥',
      badge: 'Classic',
      sale: true,
      soldCount: '৮৫০ বিক্রি',
      rating: '৪.৮',
      reviews: '১িও',
      discountText: 'ঈদ অফার',
      brand: 'Safi Fits',
      stock: '৪০ পিস',
      image: ''
    },
    {
      id: 'sf_tshirt',
      category: 'clothing_fashion',
      name: 'Safi আরামদায়ক ক্যাজুয়াল টি-শার্ট',
      price: 290,
      desc: '১৬০ GSM প্রি-শ্রাঙ্ক কটন, অত্যন্ত আরামদায়ক ও ট্রেন্ডি কমফোর্ট ফিট টি-শার্ট',
      emoji: '👕',
      badge: 'Trendy',
      sale: true,
      soldCount: '৩K+ বিক্রি',
      rating: '৪.৬',
      reviews: '১২০',
      discountText: 'কমফোর্ট',
      brand: 'Safi Casuals',
      stock: '১১০ পিস',
      image: ''
    },
    {
      id: 'sf_trouser',
      category: 'clothing_fashion',
      name: 'Safi স্পোর্টস ট্রাউজার (Comfort Fit)',
      price: 450,
      desc: 'ব্রেথেবল ফেব্রিক, ৪-ওয়ে স্ট্রেচেবল ওয়ার্কআউট ও ট্রাভেল জগার্স',
      emoji: '👖',
      badge: 'Activewear',
      sale: false,
      soldCount: '১.২K+ বিক্রি',
      rating: '৪.৭',
      reviews: '৮৫',
      discountText: 'স্পোর্টস',
      brand: 'Safi Sports',
      stock: '৮০ পিস',
      image: ''
    },
    {
      id: 'sf_lungi',
      category: 'clothing_fashion',
      name: 'Safi এক্সক্লুসিভ ৮.৫ হাত সুতি লুঙ্গি',
      price: 370,
      desc: 'আসল সুতি সুতা দিয়ে তৈরি অত্যন্ত আরামদায়ক ও স্থায়ী ঐতিহ্যবাহী দেশি লুঙ্গি',
      emoji: '🧣',
      badge: 'Desi',
      sale: true,
      soldCount: '৪K+ বিক্রি',
      rating: '৪.৮',
      reviews: '২৩০',
      discountText: 'আরামদায়ক',
      brand: 'Safi Weaves',
      stock: '৯৫ পিস',
      image: ''
    },
    {
      id: 'sf_adapter',
      category: 'tech_gadgets',
      name: 'Safi ফাস্ট চার্জিং এডাপ্টার ২০ ওয়াট',
      price: 390,
      desc: 'PD Type-C ফাস্ট চার্জিং ৩.০ পোর্ট, মাল্টি-লেয়ার প্রটেকশন ও থার্মাল কন্ট্রোল',
      emoji: '🔌',
      badge: 'FastCharge',
      sale: true,
      soldCount: '২K+ বিক্রি',
      rating: '৪.৭',
      reviews: '৯৫',
      discountText: 'সেভ পাওয়ার',
      brand: 'Safi Tech',
      stock: '৭৫ পিস',
      image: ''
    },
    {
      id: 'sf_cable',
      category: 'tech_gadgets',
      name: 'Safi ২-ইন-১ মাল্টি ডাটা ক্যাবল',
      price: 150,
      desc: '১.২ মিটার নাইলন ব্রেইডেড টেকসই ক্যাবল, Type-C এবং Micro-USB চার্জিং',
      emoji: '🎗️',
      badge: 'Durable',
      sale: true,
      soldCount: '৬K+ বিক্রি',
      rating: '৪.৬',
      reviews: '১৮০',
      discountText: 'মাল্টি',
      brand: 'Safi Tech',
      stock: '১২০ পিস',
      image: ''
    },
    {
      id: 'sf_powerbank',
      category: 'tech_gadgets',
      name: 'Safi ১০,০০০ mAh পাওয়ার ব্যাংক',
      price: 1250,
      desc: 'ডুয়াল ইউএসবি আউটপুট, ডিজিটাল ডিসপ্লে ইন্টিগ্রেটেড স্লিম পাওয়ার ব্যাংক',
      emoji: '🔋',
      badge: 'Backup',
      sale: false,
      soldCount: '৭০০ বিক্রি',
      rating: '৪.৭',
      reviews: '৫০',
      discountText: 'লং লাইফ',
      brand: 'Safi Power',
      stock: '৩০ পিস',
      image: ''
    },
    {
      id: 'sf_earbuds',
      category: 'tech_gadgets',
      name: 'Safi ওয়েরলেস ব্লুটুথ ৫.৩ ইয়ারবাডস',
      price: 990,
      desc: 'HIFI সাউন্ড কোয়ালিটি, ৪ ঘন্টা একটানা প্লেব্যাক ও সুপার বেস সমৃদ্ধ',
      emoji: '🎧',
      badge: 'ANC Hifi',
      sale: true,
      soldCount: '৫K+ বিক্রি',
      rating: '৪.৮',
      reviews: '৩৪০',
      discountText: '৳১০০ ক্যাশব্যাক',
      brand: 'Safi Audio',
      stock: '৪৫ পিস',
      image: ''
    },
    {
      id: 'sf_otg',
      category: 'tech_gadgets',
      name: 'Safi ইউনিভার্সাল মেটাল ওটিজি কানেক্টর',
      price: 85,
      desc: 'Type-C টু USB ৩.০ কনভার্টার, হাই স্পিড ডাটা ট্রান্সফার মেটালিক বডি',
      emoji: '⚙️',
      badge: 'HighSpeed',
      sale: false,
      soldCount: '১.৮K+ বিক্রি',
      rating: '৪.৭',
      reviews: '১১০',
      discountText: 'টাইপ-সি',
      brand: 'Safi Tech',
      stock: '১৫০ পিস',
      image: ''
    },
    {
      id: 'sf_soap',
      category: 'cosmetics_lifestyle',
      name: 'Safi হস্তনির্মিত নিম ও তুলসী সাবান',
      price: 140,
      desc: '১৫০ গ্রাম বার, নিম এবং তুলসী পাতার নির্যাসযুক্ত ন্যাচারাল গ্লিসারিন সাবান',
      emoji: '🧼',
      badge: 'Handmade',
      sale: true,
      soldCount: '৩K+ বিক্রি',
      rating: '৪.৯',
      reviews: '২৪০',
      discountText: 'হার্বাল কেয়ার',
      brand: 'Safi Herbs',
      stock: '১১০ পিস',
      image: ''
    },
    {
      id: 'sf_hair_oil',
      category: 'cosmetics_lifestyle',
      name: 'Safi অর্গানিক herbal হেয়ার অয়েল',
      price: 190,
      desc: '১০০ মিলি বোতল, আমলকী ও জবা ফুলের নির্যাসযুক্ত ও পুষ্টিকর herbal অয়েল',
      emoji: '🧴',
      badge: 'Natural',
      sale: true,
      soldCount: '১.৫K+ বিক্রি',
      rating: '৪.৮',
      reviews: '১৩০',
      discountText: 'চুল পড়া রোধ',
      brand: 'Safi Herbs',
      stock: '৬৫ পিস',
      image: ''
    },
    {
      id: 'sf_aloe_gel',
      category: 'cosmetics_lifestyle',
      name: 'Safi ফ্রেশ অ্যালোভেরা সুদিং জেল',
      price: 180,
      desc: '১৫০ মিলি জার, প্রাকৃতিক অ্যালোভেরা নির্যাসের জাদুকরী স্কিন ময়শ্চারাইজার',
      emoji: '🧪',
      badge: 'Organic',
      sale: true,
      soldCount: '২K+ বিক্রি',
      rating: '৪.৮',
      reviews: '১৪০',
      discountText: 'ময়শ্চারাইজ',
      brand: 'Safi Skin',
      stock: '৮০ পিস',
      image: ''
    },
    {
      id: 'sf_chandan_pack',
      category: 'cosmetics_lifestyle',
      name: 'Safi প্রিমিয়াম চন্দন ফেসপ্যাক',
      price: 120,
      desc: '১০০ গ্রাম রিফিল প্যাক, আসল মহীশূর চন্দন কাঠের গুঁড়া মিশ্রিত স্কিন গ্লোয়িং ফর্মুলা',
      emoji: '🌸',
      badge: 'Glow Skin',
      sale: true,
      soldCount: '৪K+ বিক্রি',
      rating: '৪.৯',
      reviews: '৩১০',
      discountText: 'ব্রাইটনেস',
      brand: 'Safi Skin',
      stock: '১০০ পিস',
      image: ''
    }
  ];

  const [safiProducts, setSafiProducts] = useState<any[]>([]);
  const [safiLoading, setSafiLoading] = useState(true);

  // Admin and Add/Edit states
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  
  // Form values
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('tech_gadgets');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdDesc, setNewProdDesc] = useState('');
  const [newProdImage, setNewProdImage] = useState('');
  const [newProdBrand, setNewProdBrand] = useState('Safi Tech');
  const [newProdStock, setNewProdStock] = useState('১০০ পিস');
  const [newProdEmoji, setNewProdEmoji] = useState('📦');
  const [newProdBadge, setNewProdBadge] = useState('Choice');

  // Category management states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [newCatId, setNewCatId] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatNameBn, setNewCatNameBn] = useState('');
  const [newCatImage, setNewCatImage] = useState('');

  // Image file helper for Base64 conversion
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>, target: 'product' | 'category') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        if (target === 'product') {
          setNewProdImage(base64);
        } else {
          setNewCatImage(base64);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    // Real-time listener for safi_categories
    const unsubCats = onSnapshot(collection(db, 'safi_categories'), async (snapshot) => {
      if (snapshot.empty) {
        try {
          for (const item of defaultSafiCategories) {
            await setDoc(doc(db, 'safi_categories', item.id), item);
          }
        } catch (err) {
          console.error("Failed seeding safi categories:", err);
        }
      } else {
        const list: any[] = [];
        snapshot.forEach(docSnap => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        setSafiCategories(list);
      }
    });

    return () => unsubCats();
  }, []);

  useEffect(() => {
    // Real-time listener for safi_products
    const unsubscribe = onSnapshot(collection(db, 'safi_products'), async (snapshot) => {
      const containsOldProduct = !snapshot.empty && snapshot.docs.some(doc => doc.id === 'sf_cable_240w' || doc.id === 'sf_comica_mic' || doc.id === 'sf_wedding_sharee');
      if (snapshot.empty || containsOldProduct) {
        // Clear and Seed initial organic products!
        setSafiLoading(true);
        try {
          if (!snapshot.empty) {
            for (const docSnap of snapshot.docs) {
              await deleteDoc(doc(db, 'safi_products', docSnap.id));
            }
          }
          for (const item of defaultSafiProducts) {
            await setDoc(doc(db, 'safi_products', item.id), item);
          }
        } catch (err) {
          console.error("Failed seeding safi products:", err);
        }
        setSafiLoading(false);
      } else {
        const list: any[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          const override = appConfig.safiProductOverrides?.[docSnap.id];
          list.push({
            ...data,
            id: docSnap.id,
            price: override?.price !== undefined ? override.price : data.price,
            stock: override?.stock !== undefined ? override.stock : data.stock,
            name: override?.name !== undefined ? override.name : data.name,
            desc: override?.desc !== undefined ? override.desc : data.desc,
            brand: override?.brand !== undefined ? override.brand : data.brand,
            image: override?.image || (override?.emoji ? '' : data.image || ''),
            emoji: override?.emoji || data.emoji,
          });
        });
        setSafiProducts(list);
        setSafiLoading(false);
      }
    });

    return () => unsubscribe();
  }, [appConfig.safiProductOverrides]);

  // CRUD actions
  const handleAddSafiProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName || !newProdPrice) {
      alert('অনুগ্রহ করে নাম এবং মূল্য প্রদান করুন।');
      return;
    }
    try {
      const id = 'sf_custom_' + Date.now();
      const productObj = {
        id,
        name: newProdName,
        category: newProdCategory,
        price: Number(newProdPrice),
        desc: newProdDesc,
        image: newProdImage || 'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=300&auto=format&fit=crop&q=60',
        emoji: newProdEmoji,
        badge: newProdBadge,
        brand: newProdBrand,
        stock: newProdStock,
        sale: false,
        soldCount: '০ বিক্রি',
        rating: '৫.০',
        reviews: '০',
        discountText: 'নতুন পণ্য'
      };
      await setDoc(doc(db, 'safi_products', id), productObj);
      setShowAddProductModal(false);
      // Reset form
      setNewProdName('');
      setNewProdPrice('');
      setNewProdDesc('');
      setNewProdImage('');
      setNewProdBrand('Safi Tech');
      setNewProdStock('১০০ পিস');
    } catch (err: any) {
      alert('ত্রুটিঃ ' + err.message);
    }
  };

  const handleUpdateSafiProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    try {
      const productObj = {
        name: newProdName,
        category: newProdCategory,
        price: Number(newProdPrice),
        desc: newProdDesc,
        image: newProdImage,
        emoji: newProdEmoji,
        badge: newProdBadge,
        brand: newProdBrand,
        stock: newProdStock
      };
      await updateDoc(doc(db, 'safi_products', editingProduct.id), productObj);
      setShowEditProductModal(false);
      setEditingProduct(null);
    } catch (err: any) {
      alert('ত্রুটিঃ ' + err.message);
    }
  };

  const handleDeleteSafiProduct = async (id: string) => {
    if (!window.confirm('আপনি কি নিশ্চিতভাবে এই পণ্যটি ডিলিট করতে চান?')) return;
    try {
      await deleteDoc(doc(db, 'safi_products', id));
    } catch (err: any) {
      alert('ত্রুটিঃ ' + err.message);
    }
  };

  // Category CRUD actions
  const handleAddSafiCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatId || !newCatNameBn) {
      alert('অনুগ্রহ করে ক্যাটাগরি আইডি এবং বাংলা নাম লিখুন।');
      return;
    }
    try {
      const normalizedId = newCatId.trim().toLowerCase().replace(/\s+/g, '_');
      const catObj = {
        id: normalizedId,
        name: newCatName || newCatNameBn,
        nameBn: newCatNameBn,
        image: newCatImage || 'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=150&auto=format&fit=crop&q=60'
      };
      await setDoc(doc(db, 'safi_categories', normalizedId), catObj);
      
      // Reset
      setNewCatId('');
      setNewCatName('');
      setNewCatNameBn('');
      setNewCatImage('');
      setEditingCategory(null);
    } catch (err: any) {
      alert('ত্রুটিঃ ' + err.message);
    }
  };

  const handleUpdateSafiCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    try {
      const catObj = {
        name: newCatName || newCatNameBn,
        nameBn: newCatNameBn,
        image: newCatImage || 'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=150&auto=format&fit=crop&q=60'
      };
      await updateDoc(doc(db, 'safi_categories', editingCategory.id), catObj);
      setEditingCategory(null);
      setNewCatId('');
      setNewCatName('');
      setNewCatNameBn('');
      setNewCatImage('');
    } catch (err: any) {
      alert('ত্রুটিঃ ' + err.message);
    }
  };

  const handleDeleteSafiCategory = async (id: string) => {
    if (!window.confirm('আপনি কি নিশ্চিতভাবে এই ক্যাটাগরি ডিলিট করতে চান?')) return;
    try {
      await deleteDoc(doc(db, 'safi_categories', id));
      // Reset filtering if current category is deleted
      if (safiSelectedCategory === id) {
        setSafiSelectedCategory(null);
      }
    } catch (err: any) {
      alert('ত্রুটিঃ ' + err.message);
    }
  };

  // TTS Voice Assistance feature for uneducated members
  const speakVoiceGuide = (text: string) => {
    try {
      if ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
        window.speechSynthesis.cancel();
        const Utterance = (window as any).SpeechSynthesisUtterance;
        if (!Utterance) return;
        const utterance = new Utterance(text);
        utterance.lang = 'bn-BD';
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
        setIsVoiceOn(true);
        utterance.onend = () => setIsVoiceOn(false);
      } else {
        alert("দুঃখিত, আপনার ব্রাউজারে স্পিচ সাপোর্ট নেই।");
      }
    } catch (err) {
      console.warn("Speech synthesis error:", err);
      setIsVoiceOn(false);
    }
  };

  const handleVoiceButtonClick = () => {
    if (isVoiceOn) {
      window.speechSynthesis.cancel();
      setIsVoiceOn(false);
    } else {
      const textToSpeak = "সাফি প্রিমিয়াম শপে আপনাকে স্বাগতম। পণ্য কেনার জন্য সরাসরি পিন নাম্বার দিন, অথবা কার্টে পণ্য যোগ করে একসাথে অর্ডার করুন। কোনো সাহায্যের জন্য আমাদের সাথে যোগাযোগ করতে পারেন।";
      speakVoiceGuide(textToSpeak);
    }
  };

  // Add item to Cart
  const addToCart = (product: any) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map((item, idx) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, {
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        image: product.image,
        emoji: product.emoji,
        brand: product.brand
      }]);
    }
    // Simple alert in Bengali for instant confirmation
    const text = `সফলভাবে "${product.name}" কার্টে যোগ করা হয়েছে।`;
    speakVoiceGuide(text);
  };

  // Remove item or update quantity
  const updateQuantity = (id: string, change: number) => {
    setCart(cart.map((item, idx) => {
      if (item.id === id) {
        const newQty = item.quantity + change;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  // Total calculation
  const getSubTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };
  const deliveryCharge = 50; // Simple flat delivery
  const getGrandTotal = () => {
    return getSubTotal() + (getSubTotal() > 0 ? deliveryCharge : 0);
  };

  // Trigger Checkout Confirmation with PIN
  const handleInitiateCheckout = (type: 'single' | 'cart', item?: any) => {
    if (type === 'single') {
      setSingleItemToBuy(item);
    }
    setCheckoutType(type);
    setShowPinModal(true);
    setPinNumber('');
    speakVoiceGuide("অর্ডারটি নিশ্চিত করতে আপনার চার সংখ্যার সিকিউরিটি পিন নাম্বারটি দিন।");
  };

  // Process the Checkout
  const handleConfirmOrder = async () => {
    if (!pinNumber) {
      alert("পিন নাম্বার প্রদান করুন।");
      return;
    }
    if (pinNumber !== user.pin) {
      alert("ভুল পিন নাম্বার প্রদান করেছেন।");
      speakVoiceGuide("দুঃখিত, ভুল পিন নাম্বার দেওয়া হয়েছে। আবার চেষ্টা করুন।");
      return;
    }

    const orderAmount = checkoutType === 'single' ? singleItemToBuy.price : getGrandTotal();
    
    if (orderAmount > (user.balance || 0)) {
      alert("আপনার মেইন ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই।");
      speakVoiceGuide("আপনার ব্যালেন্স পর্যাপ্ত নয়। ওয়ালেটে টাকা রিচার্জ করুন।");
      return;
    }

    const orderItemsText = checkoutType === 'single' 
      ? singleItemToBuy.name 
      : cart.map((item, idx) => `${item.name} (${item.quantity} পিস)`).join(', ');

    try {
      setCheckoutLoading(true);
      
      // 1. Deduct balance in Firebase
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        balance: (user.balance || 0) - orderAmount
      });

      // 2. Add Transaction Log
      const transactionId = `tx-safi-${Date.now()}`;
      await addDoc(collection(db, "transactions"), {
        id: transactionId,
        userId: user.uid,
        userName: user.name,
        memberId: user.memberId,
        type: "safi_purchase",
        typeLabel: "সাফি প্রিমিয়াম ই-কমার্স অর্ডার",
        amount: orderAmount,
        status: "success",
        description: `সাফি প্রফেশনাল অর্ডার: [${orderItemsText}]. ডেলিভারি ঠিকানা: ${address}, মোবাইল: ${phone}`,
        createdAt: new Date().toISOString()
      });

      // Clear Cart if cart checkout
      if (checkoutType === 'cart') {
        setCart([]);
      }
      
      setShowPinModal(false);
      setSuccessOrder(transactionId);
      syncLiveProfile();
      
      const successMsg = "অভিনন্দন! আপনার অর্ডারটি সফলভাবে গৃহিত হয়েছে। আমাদের প্রতিনিধি দ্রুত আপনার ঠিকানায় পণ্য পৌঁছে দেবে।";
      speakVoiceGuide(successMsg);
    } catch (error) {
      console.error(error);
      alert("অর্ডার করার সময় কোনো ত্রুটি ঘটেছে। অনুগ্রহ করে আবার চেষ্টা করুন।");
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Product Filter Logic
  const filteredProducts = safiProducts.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(safiSearchQuery.toLowerCase()) || 
                          product.desc.toLowerCase().includes(safiSearchQuery.toLowerCase()) ||
                          product.brand.toLowerCase().includes(safiSearchQuery.toLowerCase());
    const matchesCategory = !safiSelectedCategory || product.category === safiSelectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 bg-[#f8fafc] w-full h-full min-h-screen font-sans flex flex-col text-slate-800"
    >
      {/* 1. Header Area matching the screenshot perfectly */}
      <div className="bg-[#1e1e2d] text-white px-4 py-3 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => {
              if (activeTab !== 'home') {
                window.history.back();
              } else {
                onClose();
              }
            }}
            className="p-1 px-3 bg-white/10 hover:bg-white/20 active:scale-95 transition rounded-lg text-xs font-black cursor-pointer border border-white/5"
          >
            ← ব্যাক
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-base">🍯</span>
            <span className="text-xs sm:text-sm font-black tracking-wide">SAFI প্রিমিয়াম শপ</span>
          </div>
        </div>

        {/* Balance Display */}
        <div className="flex items-center gap-1.5 bg-[#ffffff15] border border-white/10 px-2.5 py-1 rounded-xl">
          <span className="text-[10px] text-slate-300 font-bold">ব্যালেন্স:</span>
          <span className="text-xs font-mono font-black text-amber-400">৳ {(user.balance || 0).toLocaleString('bn-BD')}</span>
        </div>
      </div>

      {/* 2. Scrollable Body Area */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 max-w-lg mx-auto w-full pb-20">
        
        {/* Notice/Marquee Bar */}
        <div className="bg-white border-2 border-amber-600/85 rounded-full px-2.5 py-1 flex items-center gap-2.5 overflow-hidden shadow-xs max-w-xl mx-auto w-full shrink-0">
          <div className="bg-amber-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shrink-0 shadow-3xs flex items-center gap-1">
            <span>ঘোষণা</span>
          </div>
          <div className="flex-grow overflow-hidden relative">
            <marquee className="text-[11px] font-extrabold text-slate-850 leading-none py-0.5" behavior="scroll" direction="left" scrollamount="4">
              {appConfig?.safiTicker || "প্রিমিয়াম Safi ব্র্যান্ডের শতভাগ খাঁটি পণ্য সম্ভার! আমাদের নিজস্ব তত্ত্বাবধানে প্রস্তুতকৃত ভেজালমুক্ত প্রিমিয়াম পণ্যসমূহ সরাসরি মেইন ব্যালেন্স থেকে সহজেই ক্রয় করুন।"}
            </marquee>
          </div>
        </div>

        {/* 3. Search Bar / Voice Assistance button */}
        <div className="flex gap-2 shrink-0">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
              🔍
            </span>
            <input
              type="text"
              value={safiSearchQuery}
              onChange={(e) => setSafiSearchQuery(e.target.value)}
              placeholder="Safi ব্র্যান্ডের পণ্য খুঁজুন..."
              className="pl-8.5 pr-3 py-2 w-full bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-3xs"
            />
            {safiSearchQuery && (
              <button 
                type="button"
                onClick={() => setSafiSearchQuery('')}
                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-650 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
          
          {/* Simple Voice assistance helper */}
          <button
            type="button"
            onClick={handleVoiceButtonClick}
            className={`p-2.5 rounded-2xl flex items-center justify-center transition active:scale-95 shadow-3xs border ${
              isVoiceOn 
                ? 'bg-rose-50 border-rose-300 text-rose-600 animate-pulse' 
                : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
            }`}
            title="গাইড শুনুন (Voice Guide)"
          >
            <Volume2 className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Render Tab Screens */}
        <AnimatePresence mode="wait">
          {successOrder ? (
            <motion.div 
              key="success-screen"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white border border-emerald-100 rounded-3xl p-6 text-center space-y-4 shadow-sm"
            >
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-emerald-800">অর্ডার সফলভাবে সম্পন্ন হয়েছে!</h3>
                <p className="text-xs text-slate-500 font-bold">অর্ডার ট্র্যাকিং আইডি: {successOrder}</p>
              </div>
              <p className="text-xs text-slate-650 leading-relaxed bg-slate-50 p-3 rounded-2xl font-semibold">
                আপনার মেইন ব্যালেন্স থেকে টাকা কেটে নেওয়া হয়েছে। আমাদের একজন কুরিয়ার প্রতিনিধি আপনার সাথে খুব শীঘ্রই যোগাযোগ করে পণ্যটি পৌঁছে দেবেন।
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSuccessOrder(null);
                    setActiveTab('account');
                  }}
                  className="flex-1 bg-[#1e1e2d] hover:bg-black text-white text-xs font-black py-2.5 rounded-xl cursor-pointer transition active:scale-95"
                >
                  অর্ডার হিস্টোরি দেখুন
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSuccessOrder(null);
                    setActiveTab('home');
                  }}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black py-2.5 rounded-xl cursor-pointer transition active:scale-95"
                >
                  আরও কেনাকাটা করুন
                </button>
              </div>
            </motion.div>
          ) : activeTab === 'home' ? (
            // ================= HOME TAB =================
            <motion.div 
              key="home-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Category Grid Section Header */}
              <div className="flex justify-between items-center px-1">
                <h4 className="text-[12px] font-black text-slate-800 uppercase tracking-wider">পণ্য ক্যাটাগরি সমূহ</h4>
                <div className="flex items-center gap-1.5">
                  {(user?.role === 'admin' || user?.role === 'sub_admin') && (
                    <button
                      type="button"
                      onClick={() => setShowCategoryModal(true)}
                      className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[9px] font-black active:scale-95 transition"
                    >
                      ⚙️ ক্যাটাগরি ম্যানেজ
                    </button>
                  )}
                  <span className="text-[9.5px] text-slate-400 font-bold">{safiCategories.length}টি বিভাগ</span>
                </div>
              </div>

              {/* Replica Circle Categories matching screenshot */}
              <div className="grid grid-cols-4 gap-y-3.5 gap-x-2">
                {safiCategories.map((cat, idx) => (
                  <button
                    key={`${cat.id}-${idx}`}
                    type="button"
                    onClick={() => {
                      setSafiSelectedCategory(cat.id);
                      setActiveTab('shop');
                      speakVoiceGuide(`${cat.nameBn} ক্যাটাগরি ফিল্টার করা হয়েছে।`);
                    }}
                    className="flex flex-col items-center text-center space-y-1.5 focus:outline-none group cursor-pointer"
                  >
                    <div className="w-13.5 h-13.5 rounded-full overflow-hidden border-2 border-slate-100 hover:border-amber-500 hover:scale-105 active:scale-95 transition-all duration-200 shadow-3xs flex items-center justify-center bg-white">
                      <img 
                        src={cat.image} 
                        alt={cat.name} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <span className="text-[9.5px] font-extrabold text-slate-800 leading-tight tracking-tight line-clamp-2 max-w-[70px] group-hover:text-amber-700">
                      {cat.nameBn}
                    </span>
                  </button>
                ))}
              </div>

              {/* Popular Products Header */}
              <div className="flex justify-between items-center px-1 pt-2 border-t border-slate-100">
                <h4 className="text-[12px] font-black text-slate-800 uppercase tracking-wider">জনপ্রিয় পণ্যসমূহ</h4>
                <button 
                  type="button"
                  onClick={() => {
                    setSafiSelectedCategory(null);
                    setActiveTab('shop');
                  }}
                  className="text-[10px] text-amber-600 font-black hover:underline cursor-pointer"
                >
                  সবগুলো দেখুন
                </button>
              </div>

              {/* 2-Column Popular Items Grid (as requested!) */}
              <div className="grid grid-cols-2 gap-2.5">
                {safiProducts.slice(0, 6).map((product, idx) => (
                  <div 
                    key={`${product.id}-${idx}`} 
                    className="bg-white border border-slate-150/80 rounded-2xl overflow-hidden flex flex-col justify-between shadow-3xs hover:shadow-sm hover:border-amber-300 transition-all duration-200 relative group"
                  >
                    {/* Badge and Sale tags */}
                    <div className="absolute top-1.5 left-1.5 z-10 flex flex-col gap-1">
                      {product.badge && (
                        <span className="text-[7.5px] bg-red-600 text-white font-black px-1.5 py-0.5 rounded-md uppercase tracking-wide shadow-2xs">
                          {product.badge}
                        </span>
                      )}
                      {product.sale && (
                        <span className="text-[7.5px] bg-amber-500 text-slate-900 font-black px-1.5 py-0.5 rounded-md uppercase tracking-wide shadow-2xs">
                          Sale
                        </span>
                      )}
                    </div>

                    {/* Image Area */}
                    <div className="w-full aspect-square bg-slate-100 overflow-hidden relative flex items-center justify-center">
                      {isUrl(product.image) ? (
                        <img 
                          src={product.image} 
                          alt={product.name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-amber-50 to-orange-100 flex flex-col items-center justify-center gap-2 group-hover:scale-105 transition-transform duration-300 select-none">
                          <span className="text-4xl drop-shadow-sm">{product.emoji || '📦'}</span>
                        </div>
                      )}
                    </div>

                    {/* Content Details */}
                    <div className="p-2.5 flex-1 flex flex-col justify-between text-left space-y-1.5">
                      <div className="space-y-0.5">
                        <span className="text-[8px] text-amber-700 bg-amber-50 px-1 py-0.2 rounded font-extrabold uppercase inline-block">
                          {product.brand}
                        </span>
                        <h4 className="font-extrabold text-[10px] text-slate-900 leading-tight line-clamp-2">
                          {product.name}
                        </h4>
                        
                        {/* Rating & Sold count */}
                        <div className="flex items-center gap-1 text-[8.5px] text-slate-500 font-bold pt-0.5">
                          <span className="text-amber-500">★</span>
                          <span>{product.rating}</span>
                          <span className="text-slate-350">•</span>
                          <span>{product.soldCount}</span>
                        </div>

                        {/* Extra Discount Tag */}
                        {product.discountText && (
                          <div className="text-[8px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded inline-block mt-1">
                            % {product.discountText}
                          </div>
                        )}
                      </div>

                      {/* Buy Section */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs sm:text-sm font-black text-slate-900">৳{product.price}</span>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => addToCart(product)}
                            className="bg-amber-100 hover:bg-amber-200 text-amber-800 p-1.5 rounded-lg active:scale-90 transition cursor-pointer"
                            title="কার্টে যোগ করুন"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInitiateCheckout('single', product)}
                            className="bg-[#1e1e2d] hover:bg-black text-white font-black text-[9px] py-1 px-2.5 rounded-lg active:scale-90 transition cursor-pointer"
                          >
                            কিনুন
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : activeTab === 'shop' ? (
            // ================= SHOP TAB =================
            <motion.div 
              key="shop-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3 text-left"
            >
              {/* Filter Display Bar */}
              <div className="flex items-center justify-between bg-white border border-slate-200 p-2.5 rounded-2xl shadow-3xs">
                <div className="flex items-center gap-2">
                  <span className="text-base">🛍️</span>
                  <div>
                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
                      {safiSelectedCategory ? safiCategories.find(c => c.id === safiSelectedCategory)?.nameBn : 'সকল ক্যাটাগরির পণ্য'}
                    </h4>
                    <p className="text-[8.5px] text-slate-450 font-bold">{filteredProducts.length}টি পণ্য পাওয়া গেছে</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {(user.role === 'admin' || user.role === 'sub_admin') && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProduct(null);
                        setNewProdName('');
                        setNewProdCategory('tech_gadgets');
                        setNewProdPrice('');
                        setNewProdDesc('');
                        setNewProdImage('');
                        setNewProdBrand('Safi Tech');
                        setNewProdStock('১০০ পিস');
                        setNewProdEmoji('📦');
                        setNewProdBadge('Choice');
                        setShowAddProductModal(true);
                      }}
                      className="text-[9.5px] bg-[#057A55] hover:bg-emerald-800 text-white font-black py-1 px-2.5 rounded-lg transition active:scale-95 cursor-pointer shadow-3xs"
                    >
                      + নতুন পণ্য
                    </button>
                  )}
                  {safiSelectedCategory && (
                    <button
                      type="button"
                      onClick={() => setSafiSelectedCategory(null)}
                      className="text-[9px] bg-slate-100 hover:bg-slate-250 text-slate-700 font-black py-1 px-2 rounded-lg transition active:scale-95 cursor-pointer"
                    >
                      রিসেট ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Horizontal Category selector for quick access */}
              <div className="flex gap-1.5 overflow-x-auto py-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setSafiSelectedCategory(null)}
                  className={`px-3 py-1.5 rounded-xl text-[9px] font-extrabold whitespace-nowrap transition cursor-pointer shrink-0 ${
                    !safiSelectedCategory 
                      ? 'bg-amber-600 text-white' 
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  সব পণ্য
                </button>
                {safiCategories.map((cat, idx) => (
                  <button
                    key={`${cat.id}-${idx}`}
                    type="button"
                    onClick={() => setSafiSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-extrabold whitespace-nowrap transition cursor-pointer shrink-0 ${
                      safiSelectedCategory === cat.id 
                        ? 'bg-amber-600 text-white' 
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    {cat.nameBn}
                  </button>
                ))}
              </div>

              {/* Full Product Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {filteredProducts.map((product, idx) => (
                  <div 
                    key={`${product.id}-${idx}`} 
                    className="bg-white border border-slate-150/80 rounded-2xl overflow-hidden flex flex-col justify-between shadow-3xs hover:shadow-sm transition duration-200 relative group"
                  >
                    <div className="absolute top-1.5 left-1.5 z-10 flex flex-col gap-1">
                      {product.badge && (
                        <span className="text-[7px] bg-red-600 text-white font-black px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                          {product.badge}
                        </span>
                      )}
                    </div>

                    {(user.role === 'admin' || user.role === 'sub_admin') && (
                      <div className="absolute top-1.5 right-1.5 z-15 flex gap-1 bg-black/40 backdrop-blur-xs p-1 rounded-lg">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingProduct(product);
                            setNewProdName(product.name);
                            setNewProdCategory(product.category);
                            setNewProdPrice(product.price.toString());
                            setNewProdDesc(product.desc);
                            setNewProdImage(product.image);
                            setNewProdBrand(product.brand);
                            setNewProdStock(product.stock);
                            setNewProdEmoji(product.emoji || '📦');
                            setNewProdBadge(product.badge || '');
                            setShowEditProductModal(true);
                          }}
                          className="text-[8px] bg-amber-500 hover:bg-amber-600 text-white font-black px-1.5 py-0.5 rounded-md transition cursor-pointer"
                        >
                          এডিট
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSafiProduct(product.id);
                          }}
                          className="text-[8px] bg-rose-600 hover:bg-rose-700 text-white font-black px-1.5 py-0.5 rounded-md transition cursor-pointer"
                        >
                          মুছুন
                        </button>
                      </div>
                    )}

                    <div className="w-full aspect-square bg-slate-100 overflow-hidden relative flex items-center justify-center">
                      {isUrl(product.image) ? (
                        <img 
                          src={product.image} 
                          alt={product.name} 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-amber-50 to-orange-100 flex flex-col items-center justify-center gap-2 select-none">
                          <span className="text-4xl drop-shadow-sm">{product.emoji || '📦'}</span>
                        </div>
                      )}
                    </div>

                    <div className="p-2 flex-1 flex flex-col justify-between text-left space-y-1">
                      <div>
                        <span className="text-[7.5px] text-amber-800 font-extrabold">
                          {product.brand}
                        </span>
                        <h4 className="font-extrabold text-[9.5px] text-slate-900 leading-tight line-clamp-2">
                          {product.name}
                        </h4>
                        <div className="flex items-center gap-1 text-[8px] text-slate-500 font-bold pt-0.5">
                          <span className="text-amber-500">★</span>
                          <span>{product.rating}</span>
                          <span>•</span>
                          <span>{product.soldCount}</span>
                        </div>
                      </div>

                      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-1">
                        <span className="font-mono text-xs font-black text-slate-900">৳{product.price}</span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => addToCart(product)}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-700 p-1.5 rounded-lg active:scale-90 transition cursor-pointer"
                          >
                            <ShoppingCart className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInitiateCheckout('single', product)}
                            className="bg-[#1e1e2d] hover:bg-black text-white font-black text-[8px] py-1 px-1.5 rounded-lg cursor-pointer"
                          >
                            কিনুন
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {filteredProducts.length === 0 && (
                  <div className="col-span-2 p-8 text-center space-y-2 bg-white rounded-3xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold">দুঃখিত, এই ক্যাটাগরিতে কোনো পণ্য পাওয়া যায়নি।</p>
                    <button 
                      type="button"
                      onClick={() => setSafiSelectedCategory(null)}
                      className="text-[10px] font-black text-amber-600 underline cursor-pointer"
                    >
                      সব পণ্য দেখুন
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ) : activeTab === 'vacation_sale' ? (
            // ================= VACATION SALE TAB =================
            <motion.div 
              key="vacation-sale-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Promo Banner */}
              <div className="bg-gradient-to-r from-red-600 to-amber-500 text-white rounded-2xl p-4 text-left relative overflow-hidden shadow-sm">
                <div className="absolute right-0 bottom-0 opacity-15 text-7xl translate-x-4 translate-y-4 font-black">
                  SALE
                </div>
                <span className="bg-white/25 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                  Limited Offer
                </span>
                <h3 className="text-base font-black leading-tight mt-1">ভ্যাকেশন ধামাকা অফার!</h3>
                <p className="text-[10px] text-white/90 font-bold leading-normal mt-0.5">
                  সাফি ইন-হাউস ব্র্যান্ডের বিশেষ আইটেমগুলোতে পাচ্ছেন অবিশ্বাস্য ছাড়! সরাসরি মেইন ওয়ালেট থেকে কিনুন।
                </p>
                {/* Visual Timer */}
                <div className="mt-3.5 flex items-center gap-1.5 text-[9px] font-black">
                  <span className="bg-white/15 px-2 py-1 rounded-md">২৩ ঘন্টা</span>
                  <span>:</span>
                  <span className="bg-white/15 px-2 py-1 rounded-md">৪৫ মিনিট</span>
                  <span>:</span>
                  <span className="bg-white/15 px-2 py-1 rounded-md">৫৮ সেকেন্ড বাকি</span>
                </div>
              </div>

              {/* Sale Items Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {safiProducts.filter(p => p.sale).map((product, idx) => (
                  <div 
                    key={`${product.id}-${idx}`} 
                    className="bg-white border-2 border-red-100 rounded-2xl overflow-hidden flex flex-col justify-between shadow-3xs relative group"
                  >
                    <div className="absolute top-1.5 left-1.5 z-10">
                      <span className="text-[8px] bg-red-600 text-white font-black px-2 py-0.5 rounded-md uppercase tracking-wide flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5" /> {product.discountText ? 'অফার' : 'ছাড়'}
                      </span>
                    </div>

                    <div className="w-full aspect-square bg-slate-100 overflow-hidden relative">
                      <img 
                        src={product.image} 
                        alt={product.name} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    <div className="p-2.5 flex-1 flex flex-col justify-between text-left space-y-1.5">
                      <div>
                        <span className="text-[7.5px] text-red-600 bg-red-50 px-1 py-0.2 rounded font-black uppercase inline-block">
                          {product.brand}
                        </span>
                        <h4 className="font-extrabold text-[10px] text-slate-900 leading-tight line-clamp-2">
                          {product.name}
                        </h4>
                        
                        <div className="text-[8px] font-black text-slate-500 bg-slate-50 p-1 rounded inline-block mt-1">
                          🔥 {product.soldCount}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-red-50 flex items-center justify-between gap-1">
                        <div className="flex flex-col">
                          <span className="text-[7.5px] text-slate-400 line-through">৳{product.price + 80}</span>
                          <span className="font-mono text-xs sm:text-sm font-black text-red-600">৳{product.price}</span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => addToCart(product)}
                            className="bg-red-50 hover:bg-red-100 text-red-700 p-1.5 rounded-lg cursor-pointer"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInitiateCheckout('single', product)}
                            className="bg-red-600 hover:bg-red-700 text-white font-black text-[9px] py-1 px-2 rounded-lg cursor-pointer"
                          >
                            কিনুন
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : activeTab === 'cart' ? (
            // ================= CART TAB =================
            <motion.div 
              key="cart-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4 text-left animate-fade-in"
            >
              <div className="flex items-center gap-2 px-1">
                <ShoppingCart className="w-5 h-5 text-amber-700" />
                <h4 className="text-sm font-black text-slate-800">আপনার শপিং কার্ট</h4>
              </div>

              {cart.length === 0 ? (
                <div className="p-10 text-center space-y-3 bg-white rounded-3xl border border-slate-150">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-450">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                  <p className="text-xs text-slate-500 font-bold">আপনার কার্টটি এখন খালি আছে।</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('home')}
                    className="bg-[#1e1e2d] text-white font-black text-xs px-5 py-2 rounded-xl transition active:scale-95 cursor-pointer"
                  >
                    কেনাকাটা করতে ফিরে যান
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Cart Items List */}
                  <div className="space-y-2.5">
                    {cart.map((item, idx) => (
                      <div key={`${item.id}-${idx}`} className="bg-white border border-slate-200 rounded-2xl p-3 flex gap-3 shadow-3xs relative overflow-hidden">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 overflow-hidden shrink-0">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <h4 className="font-extrabold text-[10.5px] text-slate-900 leading-tight truncate">{item.name}</h4>
                            <p className="text-[8.5px] text-amber-700 font-extrabold">{item.brand}</p>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="font-mono text-xs font-black text-slate-800">৳{item.price}</span>
                            
                            {/* Quantity Controls */}
                            <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-1.5 py-0.5 bg-slate-50">
                              <button 
                                type="button"
                                onClick={() => updateQuantity(item.id, -1)}
                                className="text-slate-500 hover:text-slate-800 p-0.5 cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-[10px] font-black font-mono w-4 text-center">{item.quantity}</span>
                              <button 
                                type="button"
                                onClick={() => updateQuantity(item.id, 1)}
                                className="text-slate-500 hover:text-slate-800 p-0.5 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="absolute top-3 right-3 text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Delivery Address Details */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3">
                    <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" /> ডেলিভারি তথ্য (ভুল সংশোধন করুন)
                    </h4>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[8.5px] font-black text-slate-500 mb-0.5">মোবাইল নম্বরঃ</label>
                        <input 
                          type="text" 
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 focus:outline-none"
                          placeholder="আপনার সচল মোবাইল নম্বর"
                        />
                      </div>
                      <div>
                        <label className="block text-[8.5px] font-black text-slate-500 mb-0.5">পূর্ণাঙ্গ ডেলিভারি ঠিকানাঃ</label>
                        <textarea 
                          rows={2}
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 focus:outline-none resize-none"
                          placeholder="গ্রাম, ইউনিয়ন, উপজেলা, জেলা"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Pricing Summary */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5">
                    <div className="flex justify-between text-xs font-bold text-slate-600">
                      <span>পণ্যের মোট দাম:</span>
                      <span className="font-mono">৳{getSubTotal()}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-slate-600">
                      <span>হোম ডেলিভারি ফি:</span>
                      <span className="font-mono">৳{deliveryCharge}</span>
                    </div>
                    <div className="border-t border-slate-100 pt-2 flex justify-between text-xs font-black text-slate-850">
                      <span>সর্বমোট পরিশোধযোগ্য পরিমাণ:</span>
                      <span className="font-mono text-amber-950 text-sm">৳{getGrandTotal()}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleInitiateCheckout('cart')}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black text-xs py-3 rounded-2xl cursor-pointer transition active:scale-95 flex items-center justify-center gap-2 mt-2"
                    >
                      <span>অর্ডার প্লেস করুন (৳{getGrandTotal()})</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            // ================= ACCOUNT TAB =================
            <motion.div 
              key="account-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4 text-left"
            >
              {/* Profile Card */}
              <div className="bg-gradient-to-br from-[#1e1e2d] to-[#2d2d44] text-white rounded-3xl p-5 relative overflow-hidden shadow-sm">
                <div className="absolute right-0 top-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl" />
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center text-xl font-black text-white shadow-md">
                    {user.name ? user.name[0] : 'U'}
                  </div>
                  <div>
                    <h4 className="font-black text-sm">{user.name}</h4>
                    <p className="text-[9.5px] text-slate-300 font-bold">মেম্বার আইডি: {user.memberId}</p>
                    <p className="text-[9.5px] text-emerald-400 font-bold">স্ট্যাটাস: রেজিস্টার্ড মেম্বার</p>
                  </div>
                </div>
              </div>

              {/* Order Status Timeline Tracker */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <ShoppingBag className="w-4.5 h-4.5 text-amber-700" /> আপনার সাফি অর্ডার ট্র্যাকিং
                </h4>
                
                {/* Visual steps */}
                <div className="space-y-4 pl-3.5 relative before:absolute before:left-1 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-slate-100">
                  <div className="relative pl-5">
                    <div className="absolute left-0 top-1 w-2.5 h-2.5 rounded-full bg-amber-500 -translate-x-[3.25px]" />
                    <p className="text-[10px] font-black text-slate-800">অর্ডার ভেরিফিকেশন সম্পন্ন</p>
                    <p className="text-[8.5px] text-slate-400 font-bold">আপনার ওয়ালেট থেকে পেমেন্ট কেটে নেওয়া হয়েছে</p>
                  </div>
                  <div className="relative pl-5">
                    <div className="absolute left-0 top-1 w-2.5 h-2.5 rounded-full bg-slate-300 -translate-x-[3.25px]" />
                    <p className="text-[10px] font-black text-slate-450">কুরিয়ারের মাধ্যমে পাঠানো হচ্ছে (পেন্ডিং)</p>
                    <p className="text-[8.5px] text-slate-400 font-bold">পণ্যটি প্যাকিং করে প্রতিনিধিদের নিকট হস্তান্তর করা হবে</p>
                  </div>
                  <div className="relative pl-5">
                    <div className="absolute left-0 top-1 w-2.5 h-2.5 rounded-full bg-slate-300 -translate-x-[3.25px]" />
                    <p className="text-[10px] font-black text-slate-450">ডেলিভারি সফল (পেন্ডিং)</p>
                    <p className="text-[8.5px] text-slate-400 font-bold">আপনার ঠিকানায় পণ্য পৌঁছালে ওটিপি দিন</p>
                  </div>
                </div>
              </div>

              {/* Quick support options */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-black text-slate-800">সহযোগিতা ও তথ্য</h4>
                <div className="space-y-2">
                  <a 
                    href="tel:01700000000" 
                    className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl hover:bg-slate-100 transition text-slate-800 text-xs font-bold"
                  >
                    <span className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-emerald-600" /> হটলাইন কাস্টমার কেয়ার
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </a>
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-[10px] font-bold text-amber-900 leading-normal">
                    💡 **সহজ নিয়ম:** আপনি যেকোনো পণ্য ক্রয় বা অর্ডার করলে, সরাসরি মেইন ব্যালেন্স থেকে মূল্য কেটে নেওয়া হবে। ডেলিভারি সংক্রান্ত সমস্যায় সরাসরি কল করুন। অশিক্ষিত মেম্বারদের জন্য স্পিচ বাটন দেওয়া আছে, যা চেপে অডিও নির্দেশাবলী শোনা যাবে।
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* 4. PIN Password Popup Modal */}
      <AnimatePresence>
        {showPinModal && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-4 text-left shadow-xl"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  🛡️ পিন নাম্বার ভেরিফিকেশন
                </h4>
                <button 
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-3 text-center">
                  <p className="text-[10px] text-amber-900 font-extrabold leading-normal">
                    সাফি প্রিমিয়াম শপ অর্ডার পেমেন্ট গেটওয়ে
                  </p>
                  <p className="text-sm font-mono font-black text-amber-950 mt-1">
                    মোট টাকা: ৳ {checkoutType === 'single' ? singleItemToBuy?.price : getGrandTotal()}
                  </p>
                </div>

                <div className="space-y-1 text-center">
                  <label className="text-[10px] font-black text-slate-500">আপনার ৪-ডিজিটের গোপন পিন নাম্বার দিনঃ</label>
                  <input 
                    type="password"
                    maxLength={4}
                    value={pinNumber}
                    onChange={(e) => setPinNumber(e.target.value)}
                    className="w-28 mx-auto px-3.5 py-2.5 text-center border-2 border-slate-200 focus:border-amber-500 rounded-2xl font-mono text-base tracking-[0.6em] font-black focus:outline-none shadow-3xs"
                    placeholder="••••"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={checkoutLoading || pinNumber.length !== 4}
                onClick={handleConfirmOrder}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black text-xs py-3 rounded-2xl transition cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 shadow-md"
              >
                {checkoutLoading ? 'প্রক্রিয়াধীন...' : 'অর্ডার নিশ্চিত করুন'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Product Modal */}
      <AnimatePresence>
        {showAddProductModal && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl p-5 space-y-4 text-left shadow-xl my-8"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  🛍️ নতুন সাফি পণ্য যোগ করুন
                </h4>
                <button 
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <form onSubmit={handleAddSafiProduct} className="space-y-3.5 text-xs">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500">পণ্যের নাম (বাংলায়):</label>
                  <input
                    type="text"
                    required
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-amber-500 focus:bg-white focus:outline-none"
                    placeholder="যেমনঃ সাফি প্রিমিয়াম খাঁটি ঘি"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500">ক্যাটাগরি:</label>
                    <select
                      value={newProdCategory}
                      onChange={(e) => setNewProdCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    >
                      {safiCategories.map((cat, idx) => (
                        <option key={`${cat.id}-${idx}`} value={cat.id}>{cat.nameBn}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500">মূল্য (৳ BDT):</label>
                    <input
                      type="number"
                      required
                      value={newProdPrice}
                      onChange={(e) => setNewProdPrice(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-amber-500 focus:bg-white focus:outline-none"
                      placeholder="যেমনঃ ৪সাফি"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500">পণ্যের বিবরণ:</label>
                  <textarea
                    value={newProdDesc}
                    onChange={(e) => setNewProdDesc(e.target.value)}
                    className="w-full h-16 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-amber-500 focus:bg-white focus:outline-none resize-none"
                    placeholder="পণ্যের গুণাবলী ও বৈশিষ্ট্য লিখুন..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500">পণ্যের ছবি (গ্যালারি বা URL):</label>
                  <div className="flex flex-col gap-1.5">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageFileChange(e, 'product')}
                      className="w-full text-[10px] text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[9px] file:font-black file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 transition cursor-pointer"
                    />
                    <input
                      type="text"
                      value={newProdImage}
                      onChange={(e) => setNewProdImage(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-amber-500 focus:bg-white focus:outline-none"
                      placeholder="অথবা সরাসরি ইমেজ লিংক (URL) লিখুন..."
                    />
                  </div>
                  {newProdImage && (
                    <div className="mt-1 flex items-center gap-2">
                      <img src={newProdImage} alt="Preview" className="w-10 h-10 object-cover rounded-lg border border-slate-200" referrerPolicy="no-referrer" />
                      <span className="text-[9px] text-slate-400 font-bold overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px]">সংযুক্ত ছবি প্রিভিউ</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500">ব্র্যান্ড:</label>
                    <input
                      type="text"
                      value={newProdBrand}
                      onChange={(e) => setNewProdBrand(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                      placeholder="Safi Foods"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500">স্টক পরিমাণ:</label>
                    <input
                      type="text"
                      value={newProdStock}
                      onChange={(e) => setNewProdStock(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                      placeholder="যেমনঃ ৮৫ পিস"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500">ইমোজি:</label>
                    <input
                      type="text"
                      value={newProdEmoji}
                      onChange={(e) => setNewProdEmoji(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-center text-lg"
                      placeholder="🍯"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500">ব্যাজ / অফার:</label>
                    <input
                      type="text"
                      value={newProdBadge}
                      onChange={(e) => setNewProdBadge(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                      placeholder="Choice / New"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#057A55] hover:bg-emerald-800 text-white font-extrabold text-xs py-3 rounded-2xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md mt-2"
                >
                  পণ্যটি যোগ করুন
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Product Modal */}
      <AnimatePresence>
        {showEditProductModal && editingProduct && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl p-5 space-y-4 text-left shadow-xl my-8"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  ✏️ সাফি পণ্য পরিবর্তন করুন
                </h4>
                <button 
                  type="button"
                  onClick={() => setShowEditProductModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <form onSubmit={handleUpdateSafiProduct} className="space-y-3.5 text-xs">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500">পণ্যের নাম (বাংলায়):</label>
                  <input
                    type="text"
                    required
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-amber-500 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500">ক্যাটাগরি:</label>
                    <select
                      value={newProdCategory}
                      onChange={(e) => setNewProdCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    >
                      {safiCategories.map((cat, idx) => (
                        <option key={`${cat.id}-${idx}`} value={cat.id}>{cat.nameBn}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500">মূল্য (৳ BDT):</label>
                    <input
                      type="number"
                      required
                      value={newProdPrice}
                      onChange={(e) => setNewProdPrice(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-amber-500 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500">পণ্যের বিবরণ:</label>
                  <textarea
                    value={newProdDesc}
                    onChange={(e) => setNewProdDesc(e.target.value)}
                    className="w-full h-16 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-amber-500 focus:bg-white focus:outline-none resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500">পণ্যের ছবি (গ্যালারি বা URL):</label>
                  <div className="flex flex-col gap-1.5">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageFileChange(e, 'product')}
                      className="w-full text-[10px] text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[9px] file:font-black file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 transition cursor-pointer"
                    />
                    <input
                      type="text"
                      value={newProdImage}
                      onChange={(e) => setNewProdImage(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-amber-500 focus:bg-white focus:outline-none text-xs"
                      placeholder="অথবা সরাসরি ইমেজ লিংক (URL) লিখুন..."
                    />
                  </div>
                  {newProdImage && (
                    <div className="mt-1 flex items-center gap-2">
                      <img src={newProdImage} alt="Preview" className="w-10 h-10 object-cover rounded-lg border border-slate-200" referrerPolicy="no-referrer" />
                      <span className="text-[9px] text-slate-400 font-bold overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px]">সংযুক্ত ছবি প্রিভিউ</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500">ব্র্যান্ড:</label>
                    <input
                      type="text"
                      value={newProdBrand}
                      onChange={(e) => setNewProdBrand(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500">স্টক পরিমাণ:</label>
                    <input
                      type="text"
                      value={newProdStock}
                      onChange={(e) => setNewProdStock(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500">ইমোজি:</label>
                    <input
                      type="text"
                      value={newProdEmoji}
                      onChange={(e) => setNewProdEmoji(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-center text-lg"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500">ব্যাজ / অফার:</label>
                    <input
                      type="text"
                      value={newProdBadge}
                      onChange={(e) => setNewProdBadge(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs py-3 rounded-2xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md mt-2"
                >
                  পণ্য তথ্য পরিবর্তন করুন
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Management Modal */}
      <AnimatePresence>
        {showCategoryModal && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-3xl p-5 space-y-4 text-left shadow-xl my-8 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  ⚙️ সাফি পণ্য ক্যাটাগরি ম্যানেজার
                </h4>
                <button 
                  type="button"
                  onClick={() => {
                    setShowCategoryModal(false);
                    setEditingCategory(null);
                    setNewCatId('');
                    setNewCatName('');
                    setNewCatNameBn('');
                    setNewCatImage('');
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Form to Add / Edit */}
              <form onSubmit={editingCategory ? handleUpdateSafiCategory : handleAddSafiCategory} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                <h5 className="text-[11px] font-black text-amber-700 uppercase">
                  {editingCategory ? '✏️ ক্যাটাগরি সংশোধন করুন' : '➕ নতুন ক্যাটাগরি যোগ করুন'}
                </h5>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500">ক্যাটাগরি আইডি (ইংরেজি):</label>
                    <input
                      type="text"
                      required
                      disabled={!!editingCategory}
                      value={newCatId}
                      onChange={(e) => setNewCatId(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl disabled:bg-slate-100 focus:outline-none"
                      placeholder="যেমন: cosmetics"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500">ইংরেজি নাম (Name):</label>
                    <input
                      type="text"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:outline-none"
                      placeholder="যেমন: Cosmetics"
                    />
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <label className="block text-[10px] font-bold text-slate-500">বাংলা নাম (আবশ্যিক):</label>
                  <input
                    type="text"
                    required
                    value={newCatNameBn}
                    onChange={(e) => setNewCatNameBn(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:outline-none"
                    placeholder="যেমন: কসমেটিকস ও প্রসাধন"
                  />
                </div>

                <div className="space-y-1 text-xs">
                  <label className="block text-[10px] font-bold text-slate-500">ক্যাটাগরি লোগো/ছবি (গ্যালারি বা URL):</label>
                  <div className="flex flex-col gap-1.5">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageFileChange(e, 'category')}
                      className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 transition cursor-pointer"
                    />
                    <input
                      type="text"
                      value={newCatImage}
                      onChange={(e) => setNewCatImage(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:outline-none text-[11px]"
                      placeholder="অথবা সরাসরি ইমেজ লিংক (URL) লিখুন..."
                    />
                  </div>
                  {newCatImage && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <img src={newCatImage} alt="Preview" className="w-10 h-10 object-cover rounded-full border border-amber-100 animate-fade-in" referrerPolicy="no-referrer" />
                      <span className="text-[9px] text-slate-400 font-bold">আইকন প্রিভিউ</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  {editingCategory && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategory(null);
                        setNewCatId('');
                        setNewCatName('');
                        setNewCatNameBn('');
                        setNewCatImage('');
                      }}
                      className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-[10px] font-extrabold transition cursor-pointer"
                    >
                      সংশোধন বাতিল
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10px] font-extrabold transition cursor-pointer"
                  >
                    {editingCategory ? 'ক্যাটাগরি সেভ করুন' : 'নতুন ক্যাটাগরি যোগ করুন'}
                  </button>
                </div>
              </form>

              {/* List of Existing Categories */}
              <div className="space-y-2">
                <h5 className="text-[11px] font-black text-slate-700 uppercase">বিদ্যমান ক্যাটাগরি তালিকা ({safiCategories.length}টি)</h5>
                <div className="divide-y divide-slate-100 max-h-[220px] overflow-y-auto scrollbar-thin border border-slate-150 rounded-2xl">
                  {safiCategories.map((cat, idx) => (
                    <div key={`${cat.id}-${idx}`} className="flex items-center justify-between p-2.5 bg-white hover:bg-slate-50 transition text-xs">
                      <div className="flex items-center gap-2.5 text-left">
                        <img 
                          src={cat.image || 'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=150&auto=format&fit=crop&q=60'} 
                          alt={cat.nameBn} 
                          className="w-8 h-8 rounded-full object-cover border border-slate-200" 
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <span className="font-extrabold text-slate-800 block leading-none">{cat.nameBn}</span>
                          <span className="text-[9px] text-slate-400 font-mono">ID: {cat.id}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategory(cat);
                            setNewCatId(cat.id);
                            setNewCatName(cat.name || '');
                            setNewCatNameBn(cat.nameBn);
                            setNewCatImage(cat.image || '');
                          }}
                          className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition text-[10px] font-black cursor-pointer"
                          title="এডিট"
                        >
                          ✏️ এডিট
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSafiCategory(cat.id)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition text-[10px] font-black cursor-pointer"
                          title="ডিলিট"
                        >
                          🗑️ মুছুন
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Footer Navigation matching the screenshot perfectly */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-150 z-40 shrink-0 shadow-[0_-2px_10px_rgba(0,0,0,0.03)]">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center w-12 py-1 transition cursor-pointer ${
              activeTab === 'home' ? 'text-rose-600 scale-105 font-black' : 'text-slate-450 hover:text-slate-700 font-bold'
            }`}
          >
            <Home className="w-5 h-5 mb-0.5" />
            <span className="text-[9px]">Home</span>
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab('shop')}
            className={`flex flex-col items-center justify-center w-12 py-1 transition cursor-pointer ${
              activeTab === 'shop' ? 'text-rose-600 scale-105 font-black' : 'text-slate-450 hover:text-slate-700 font-bold'
            }`}
          >
            <Search className="w-5 h-5 mb-0.5" />
            <span className="text-[9px]">Shop</span>
          </button>

          {/* Central VACATION SALE pill button */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('vacation_sale');
              speakVoiceGuide("ভ্যাকেশন সেলে আপনাকে স্বাগতম। বিশেষ ছাড়ের পণ্যগুলো দেখুন।");
            }}
            className={`px-4 py-1 rounded-full text-[9px] font-black transition-all active:scale-95 cursor-pointer shadow-3xs flex items-center gap-1 ${
              activeTab === 'vacation_sale' 
                ? 'bg-rose-600 text-white animate-pulse' 
                : 'bg-amber-400 hover:bg-amber-500 text-slate-900'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>VACATION SALE</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cart')}
            className={`flex flex-col items-center justify-center w-12 py-1 transition cursor-pointer relative ${
              activeTab === 'cart' ? 'text-rose-600 scale-105 font-black' : 'text-slate-450 hover:text-slate-700 font-bold'
            }`}
          >
            <ShoppingCart className="w-5 h-5 mb-0.5" />
            <span className="text-[9px]">Cart</span>
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[8px] font-black h-4 w-4 rounded-full flex items-center justify-center border-2 border-white">
                {cart.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('account')}
            className={`flex flex-col items-center justify-center w-12 py-1 transition cursor-pointer ${
              activeTab === 'account' ? 'text-rose-600 scale-105 font-black' : 'text-slate-450 hover:text-slate-700 font-bold'
            }`}
          >
            <User className="w-5 h-5 mb-0.5" />
            <span className="text-[9px]">Account</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
