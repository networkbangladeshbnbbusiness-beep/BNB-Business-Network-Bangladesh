export type Language = 'bn' | 'en';

export const translations: Record<Language, Record<string, string>> = {
  bn: {
    // Top Bar & General App
    appTitle: 'বিজনেস নেটওয়ার্ক বাংলাদেশ (BNB)',
    appSubtitle: 'মাল্টিপারপাস কো-অপারেটিভ সোসাইটি লিমিটেড',
    home: 'হোম',
    navHome: 'হোম',
    navSendMoney: 'সেন্ড মানি',
    navAutoAddMoney: 'অটো এড মানি',
    navTransactions: 'লেনদেন',
    navProfile: 'প্রোফাইল',
    dashboard: 'ড্যাশবোর্ড',
    adminPanel: 'এডমিন প্যানেল',
    userView: 'ইউজার ভিউ',
    active: 'একটিভ',
    inactive: 'ইনএকটিভ',
    pending: 'পেন্ডিং',
    approved: 'অনুমোদিত',
    rejected: 'বাতিলকৃত',
    success: 'সফল',
    error: 'ত্রুটি',
    warning: 'সতর্কতা',
    back: 'পিছনে যান',
    close: 'বন্ধ করুন',
    save: 'সংরক্ষণ করুন',
    cancel: 'বাতিল',
    confirm: 'নিশ্চিত করুন',
    delete: 'মুছে ফেলুন',
    edit: 'সম্পাদনা',
    update: 'আপডেট করুন',
    submit: 'দাখিল করুন',
    search: 'খুঁজুন',
    filter: 'ফিল্টার',
    refresh: 'রিফ্রেশ',
    copy: 'কপি করুন',
    copied: 'কপি হয়েছে!',
    loading: 'লোড হচ্ছে...',
    noData: 'কোনো তথ্য পাওয়া যায়নি',
    announcement: 'ঘোষণা',

    // User Profile & Balances
    memberId: 'সদস্য আইডি',
    role: 'পদবী',
    generalMember: 'সাধারণ সদস্য',
    owner: 'ওনার (Owner)',
    shareholder: 'শেয়ার হোল্ডার',
    investor: 'ইনভেস্টর',
    supporter: 'সাপোর্টার',
    mainBalance: 'মেইন ব্যালেন্স',
    samitySavings: 'সমিতি সঞ্চয়',
    telecomBalance: 'টেলিকম ব্যালেন্স',
    superShopBalance: 'সুপার শপ ওয়ালেট',
    dueLoan: 'বকেয়া ঋণ (হাওলাত)',
    lockedBalance: 'লকড ব্যালেন্স',
    pendingBalance: 'পেন্ডিং ব্যালেন্স',
    totalSavings: 'মোট সঞ্চয়',

    // Main Actions
    addMoney: 'টাকা জমা',
    withdrawMoney: 'টাকা উত্তোলন',
    ourInvestments: 'আমাদের ইনভেস্ট',
    investmentsAndPolicies: 'বিনিয়োগ ও পলিসি',

    // Drawer Menu / Settings Items
    profileAndAccount: 'প্রোফাইল ও একাউন্ট',
    securityAndPin: 'সিকিউরিটি ও পিন (SECURITY & PIN)',
    displayAndSystem: 'ডিসপ্লে ও সিস্টেম (DISPLAY & SYSTEM)',
    languageOption: 'ভাষা (Language)',
    languageSubtitle: 'Language (Bangla / English)',
    changeLanguageDesc: 'ডিফল্ট ভাষা নির্বাচন করুন',
    toggleNotifications: 'নোটিফিকেশন অ্যালার্ট (Notifications)',
    toggleNotifSubtitle: 'জরুরি বার্তা ও অ্যালার্ট সেটিংস',
    darkLightMode: 'ডার্ক / লাইট মোড (Dark / Light Mode)',
    darkLightSubtitle: 'চোখের আরামের জন্য ডিসপ্লে থিম',
    helpAndSupport: 'হেল্প ও সাপোর্ট (HELP & SUPPORT)',
    systemInfo: 'সিস্টেম তথ্য (SYSTEM INFORMATION)',
    aboutInitiative: 'আমাদের উদ্যোগ পরিচিতি (ABOUT THE INITIATIVE)',
    lockApp: 'অ্যাপ লক করুন (Lock App)',
    logout: 'লগআউট (Logout)',

    // Language Modal
    selectLanguage: 'অ্যাপের ভাষা নির্বাচন করুন (Select Language)',
    selectLanguageDesc: 'আপনার পছন্দের ভাষা নির্বাচন করুন। পুরো অ্যাপটি তাৎক্ষণিকভাবে সেই ভাষায় পরিবর্তিত হবে।',
    banglaLangName: 'বাংলা (Bengla)',
    englishLangName: 'English (ইংরেজি)',

    // 12 Core Sections
    sec1Name: 'BNB সমবায় / কোম্পানি পোর্টাল',
    sec1Desc: 'সঞ্চয় কিস্তি, ডিভিডেন্ড ও কোম্পানি পোর্টাল',
    sec2Name: 'BNB নিরাপদ লেনদেন / গ্রুপ বাই',
    sec2Desc: 'নিরাপদ এসক্রো ও যৌথ ক্রয়ের সুবিধা',
    sec3Name: 'BNB কর্জে হাসানা / সুদমুক্ত ঋণ',
    sec3Desc: 'জরুরি প্রয়োজনে সুদমুক্ত সমবায় হাওলাত',
    sec4Name: 'BNB লেনদেন / রেমিট্যান্স লাইভ',
    sec4Desc: 'রিয়েলটাইম ব্যালেন্স স্টেটমেন্ট ও ট্রানজেকশন',
    sec5Name: 'safi সাফি / ইন-হাউস ব্র্যান্ড',
    sec5Desc: 'ভেজালমুক্ত প্রিমিয়াম ব্র্যান্ড ও কেনাকাটা',
    sec6Name: 'BNB টেলিকম / রিচার্জ ও অফার',
    sec6Desc: 'মোবাইল রিচার্জ ও অটো ড্রাইভ প্যাক',
    sec7Name: 'BNB সুপার শপ / শপ অর্ডার',
    sec7Desc: 'অর্গানিক ফুড ও নিত্যপ্রয়োজনীয় বাজার',
    sec8Name: 'BNB রেশন কার্ড / ভর্তুকি মডিউল',
    sec8Desc: 'বিশেষ ভর্তুকিযুক্ত ডিজিটাল রেশন সুবিধা',
    sec9Name: 'BNB কুরিয়ার / পার্সেল লজিস্টিকস',
    sec9Desc: 'ইনস্ট্যান্ট পার্সেল ডেলিভারি ও রাইডার',
    sec10Name: 'BNB এজেন্ট / ক্যারিয়ার পোর্টাল',
    sec10Desc: 'সারাদেশে অনুমোদিত এজেন্ট ডিরেক্টরি',
    sec11Name: 'BNB লক্ষ্যমাত্রা / কোম্পানি প্রোফাইল',
    sec11Desc: 'আমাদের মিশন, ভিশন ও করপোরেট গাইড',
    sec12Name: 'BNB বাংলাদেশ এডমিন প্যানেল',
    sec12Desc: 'মাস্টার এডমিন কন্ট্রোল ও অটোমেশন',

    // Common Messages & States
    confirmLogout: 'আপনি কি নিশ্চিত যে লগআউট করতে চান?',
    enterPin: '৪ ডিজিটের পিন কোড দিন',
    wrongPin: 'ভুল পিন কোড! পুনরায় চেষ্টা করুন।',
    actionSuccess: 'কার্যক্রম সফলভাবে সম্পন্ন হয়েছে!',
    networkError: 'ইন্টারনেট সংযোগ নেই। লোকাল ক্যাশ প্রদর্শিত হচ্ছে।',
  },
  en: {
    // Top Bar & General App
    appTitle: 'Business Network Bangladesh (BNB)',
    appSubtitle: 'Multipurpose Co-Operative Society Ltd.',
    home: 'Home',
    navHome: 'Home',
    navSendMoney: 'Send Money',
    navAutoAddMoney: 'Auto Add Money',
    navTransactions: 'Transactions',
    navProfile: 'Profile',
    dashboard: 'Dashboard',
    adminPanel: 'Admin Panel',
    userView: 'User View',
    active: 'Active',
    inactive: 'Inactive',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    back: 'Go Back',
    close: 'Close',
    save: 'Save Changes',
    cancel: 'Cancel',
    confirm: 'Confirm',
    delete: 'Delete',
    edit: 'Edit',
    update: 'Update',
    submit: 'Submit',
    search: 'Search',
    filter: 'Filter',
    refresh: 'Refresh',
    copy: 'Copy',
    copied: 'Copied!',
    loading: 'Loading...',
    noData: 'No records found',
    announcement: 'Announcement',

    // User Profile & Balances
    memberId: 'Member ID',
    role: 'Member Role',
    generalMember: 'General Member',
    owner: 'Owner',
    shareholder: 'Shareholder',
    investor: 'Investor',
    supporter: 'Supporter',
    mainBalance: 'Main Balance',
    samitySavings: 'Samity Savings',
    telecomBalance: 'Telecom Wallet',
    superShopBalance: 'Super Shop Wallet',
    dueLoan: 'Due Loan (Hawlat)',
    lockedBalance: 'Locked Balance',
    pendingBalance: 'Pending Balance',
    totalSavings: 'Total Savings',

    // Main Actions
    addMoney: 'Add Deposit',
    withdrawMoney: 'Withdraw Cash',
    ourInvestments: 'Our Investments',
    investmentsAndPolicies: 'Investments & Policies',

    // Drawer Menu / Settings Items
    profileAndAccount: 'Profile & Account',
    securityAndPin: 'SECURITY & PIN',
    displayAndSystem: 'DISPLAY & SYSTEM',
    languageOption: 'Language (Bangla / English)',
    languageSubtitle: 'Language (Bangla / English)',
    changeLanguageDesc: 'Change default application language',
    toggleNotifications: 'Notifications & Alerts',
    toggleNotifSubtitle: 'Emergency alerts and message settings',
    darkLightMode: 'Dark / Light Mode',
    darkLightSubtitle: 'Display theme for eye comfort',
    helpAndSupport: 'HELP & SUPPORT',
    systemInfo: 'SYSTEM INFORMATION',
    aboutInitiative: 'ABOUT THE INITIATIVE',
    lockApp: 'Lock App',
    logout: 'Logout',

    // Language Modal
    selectLanguage: 'Select App Language',
    selectLanguageDesc: 'Choose your preferred language. The entire application will update instantly.',
    banglaLangName: 'বাংলা (Bangla)',
    englishLangName: 'English',

    // 12 Core Sections
    sec1Name: 'BNB Samity / Investor Portal',
    sec1Desc: 'Savings installment, dividend & corporate portal',
    sec2Name: 'BNB Safe Deals / Group Buy',
    sec2Desc: 'Secure escrow & group buying deals',
    sec3Name: 'BNB Qard Hasana / Interest-Free Loan',
    sec3Desc: 'Emergency interest-free cooperative welfare fund',
    sec4Name: 'MY BNB Live Transactions & Remittance',
    sec4Desc: 'Realtime statement, history & remittance',
    sec5Name: 'Safi Premium Brand Products',
    sec5Desc: 'Pure organic premium products & shop',
    sec6Name: 'BNB Telecom Airtime & Packs',
    sec6Desc: 'Mobile recharge & automated drive packs',
    sec7Name: 'BNB Super Shop & Orders',
    sec7Desc: 'Organic groceries & everyday essentials',
    sec8Name: 'BNB Ration Card System',
    sec8Desc: 'Subsidized digital ration membership card',
    sec9Name: 'BNB Instant Courier & Logistics',
    sec9Desc: 'Instant parcel delivery & rider network',
    sec10Name: 'BNB Agent & Representative Portal',
    sec10Desc: 'Nationwide authorized representative directory',
    sec11Name: 'BNB Target & Corporate Guide',
    sec11Desc: 'Company mission, vision & official guide',
    sec12Name: 'BNB Bangladesh Admin Gateway',
    sec12Desc: 'Master administrative control & automation',

    // Common Messages & States
    confirmLogout: 'Are you sure you want to log out?',
    enterPin: 'Enter 4-digit PIN code',
    wrongPin: 'Incorrect PIN code! Please try again.',
    actionSuccess: 'Operation completed successfully!',
    networkError: 'No internet connection. Displaying cached data.',
  }
};

/**
 * Reads the currently stored language preference from localStorage.
 */
export function getStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'bn';
  const saved = localStorage.getItem('amb_app_language') || localStorage.getItem('bnb_app_lang');
  return saved === 'en' ? 'en' : 'bn';
}

/**
 * Updates stored language and notifies the application via custom window event.
 */
export function setStoredLanguage(lang: Language): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('amb_app_language', lang);
  localStorage.setItem('bnb_app_lang', lang);
  window.dispatchEvent(new CustomEvent('bnb-language-change', { detail: { lang } }));
}

/**
 * Helper to fetch translation string by key with optional parameter substitution.
 */
export function t(key: string, lang: Language = getStoredLanguage(), params?: Record<string, string>): string {
  const dict = translations[lang] || translations.bn;
  let val = dict[key] || translations.bn[key] || key;
  if (params) {
    Object.keys(params).forEach((pKey) => {
      val = val.replace(new RegExp(`{${pKey}}`, 'g'), params[pKey]);
    });
  }
  return val;
}

// Dynamic text mapping for status badges, transaction types, & announcements
const DYNAMIC_MAPPINGS: Record<string, { bn: string; en: string }> = {
  // Statuses
  'পেন্ডিং': { bn: 'পেন্ডিং', en: 'Pending' },
  'অনুমোদিত': { bn: 'অনুমোদিত', en: 'Approved' },
  'বাতিল': { bn: 'বাতিল', en: 'Rejected' },
  'বাতিলকৃত': { bn: 'বাতিলকৃত', en: 'Rejected' },
  'সফল': { bn: 'সফল', en: 'Success' },
  'একটিভ': { bn: 'একটিভ', en: 'Active' },
  'সক্রিয়': { bn: 'সক্রিয়', en: 'Active' },
  'নিষ্ক্রিয়': { bn: 'নিষ্ক্রিয়', en: 'Inactive' },

  // Balances & Categories
  'মেইন ব্যালেন্স': { bn: 'মেইন ব্যালেন্স', en: 'Main Balance' },
  'সমিতি সঞ্চয়': { bn: 'সমিতি সঞ্চয়', en: 'Samity Savings' },
  'টেলিকম ব্যালেন্স': { bn: 'টেলিকম ব্যালেন্স', en: 'Telecom Wallet' },
  'সুপার শপ ব্যালেন্স': { bn: 'সুপার শপ ব্যালেন্স', en: 'Super Shop Wallet' },
  'বকেয়া ঋণ': { bn: 'বকেয়া ঋণ', en: 'Due Loan' },
  'হাওলাত': { bn: 'হাওলাত', en: 'Hawlat' },
  'ক্যাশআউট': { bn: 'ক্যাশআউট', en: 'Cashout' },
  'টাকা জমা': { bn: 'টাকা জমা', en: 'Add Money' },
  'উত্তোলন': { bn: 'উত্তোলন', en: 'Withdrawal' },
  'মোবাইল রিচার্জ': { bn: 'মোবাইল রিচার্জ', en: 'Mobile Recharge' },

  // Default Announcements
  'BNB কো-অপারেটিভ পোর্টালে স্বাগতম। আপনার সঞ্চয় ও মেম্বারশিপ সম্পর্কিত যে কোনো সহায়তার জন্য আমাদের হেল্পলাইনে যোগাযোগ করুন।': {
    bn: 'BNB কো-অপারেটিভ পোর্টালে স্বাগতম। আপনার সঞ্চয় ও মেম্বারশিপ সম্পর্কিত যে কোনো সহায়তার জন্য আমাদের হেল্পলাইনে যোগাযোগ করুন।',
    en: 'Welcome to BNB Cooperative Portal. Contact our helpline for any assistance regarding your savings and membership.'
  },
  'BNB এজেন্ট ও প্রতিনিধি পোর্টাল ডিরেক্টরিতে স্বাগতম। নিকটস্থ এজেন্টদের লাইভ লোকেশন দেখুন ও যোগাযোগ করুন।': {
    bn: 'BNB এজেন্ট ও প্রতিনিধি পোর্টাল ডিরেক্টরিতে স্বাগতম। নিকটস্থ এজেন্টদের লাইভ লোকেশন দেখুন ও যোগাযোগ করুন।',
    en: 'Welcome to BNB Agent & Representative Directory. View live location and contact nearby agents.'
  }
};

/**
 * Dynamic text translator for database values, notifications, & status strings.
 */
export function translateDynamicText(text: string | null | undefined, lang: Language): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (DYNAMIC_MAPPINGS[trimmed]) {
    return DYNAMIC_MAPPINGS[trimmed][lang];
  }
  return trimmed;
}
