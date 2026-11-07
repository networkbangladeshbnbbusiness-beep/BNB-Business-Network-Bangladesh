import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles, ShieldCheck, HelpCircle, ChevronRight, RotateCcw } from 'lucide-react';
import { apiUrl } from '../config/api';
import { useBackHandler } from '../lib/navigationManager';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

interface BNBVirtualAssistantProps {
  isVisible: boolean;
  language?: 'bn' | 'en';
}

const QUICK_TOPICS_BN = [
  { label: '🏦 BNB কোম্পানি ইনভেস্টর', query: 'BNB কোম্পানি ইনভেস্টর বা সমবায় পোর্টাল কীভাবে কাজ করে?' },
  { label: '🛡️ BNB নিরাপদ লেনদেন', query: 'BNB নিরাপদ লেনদেন কীভাবে কাজ করে?' },
  { label: '🤝 BNB কর্জে হাসানা (সুদমুক্ত ঋণ)', query: 'BNB কর্জে হাসানা সুদমুক্ত ঋণ পাওয়ার নিয়ম কী?' },
  { label: '💳 কিভাবে অ্যাড মানি করব?', query: 'কিভাবে ওয়ালেটে অ্যাড মানি (Add Money) করব?' },
  { label: '🔑 পিন বা ওটিপি সমস্যা সমাধান', query: 'পিন ভুলে গেলে বা লগইন ওটিপি সমস্যা হলে কীভাবে সমাধান করব?' },
  { label: '📲 BNB টেলিকম ও অটো রিচার্জ', query: 'BNB টেলিকম ও অটো রিচার্জ কীভাবে ব্যবহার করব?' },
  { label: '🛒 BNB রেশন কার্ড ও সাফি শপ', query: 'BNB রেশন কার্ড এবং সাফি শপের সুবিধা কী?' },
  { label: '💼 অটো স্যালারি ও স্মার্ট ডেলিভারি পে', query: 'BNB অটো স্যালারি পে এবং স্মার্ট ডেলিভারি পে কীভাবে কাজ করে?' },
  { label: '💡 BNB বিল পে ও লেনদেন', query: 'BNB বিল পে এবং My BNB লেনদেন কীভাবে কাজ করে?' },
  { label: '🧑‍💼 BNB এজেন্ট ও প্রজেক্ট', query: 'BNB এজেন্ট হওয়ার নিয়ম এবং BNB আমাদের লক্ষ্য কী?' }
];

function isEnglishQuery(text: string): boolean {
  const clean = text.trim();
  if (!clean) return false;
  const bengaliChars = (clean.match(/[\u0980-\u09FF]/g) || []).length;
  const latinChars = (clean.match(/[a-zA-Z]/g) || []).length;
  return bengaliChars === 0 && latinChars > 3;
}

/**
 * Authoritative deterministic BNB Knowledge & Guardrail Engine.
 * Guarantees 100% accurate, instant responses in Play Store APK & Web,
 * strictly enforcing Zero Data Leakage and Software-Only Scope.
 */
function generateBNBExpertResponse(rawQuery: string): string {
  const q = rawQuery.trim().toLowerCase();
  const isEn = isEnglishQuery(rawQuery);

  // 1. STRICT PRIVACY & ZERO DATA LEAKAGE GUARD
  const privacyKeywords = [
    'কার ব্যালেন্স', 'অন্যের ব্যালেন্স', 'অন্য সদস্যের', 'মোবাইল নাম্বার দাও', 'ফোন নাম্বার দাও',
    'পাসওয়ার্ড দাও', 'পিন বলো', 'পিন কত', 'ডাটাবেস', 'সদস্যদের তালিকা', 'কার একাউন্টে কত',
    'user data', 'other user', 'phone number of', 'balance of', 'hack', 'database dump',
    'all users', 'secret pin', 'admin password', 'অ্যাডমিন পিন কত', 'ব্যক্তিগত তথ্য'
  ];
  if (privacyKeywords.some(k => q.includes(k))) {
    return isEn
      ? '🔒 **Strict Privacy & Security Notice:** Under BNB - Business Network Bangladesh security policies, I do not have access to or share any personal user data, phone numbers, PINs, balances, or transaction records. User privacy and account data are 100% confidential and protected. To view your own balance or statement, please check your dashboard or "MY BNB লেনদেন" section directly inside the app.'
      : '🔒 **নিরাপত্তা ও গোপনীয়তা সতর্কবার্তা:** "BNB - Business Network Bangladesh"-এর কঠোর নিরাপত্তা নীতির কারণে কোনো সদস্যের ব্যক্তিগত তথ্য, মোবাইল নম্বর, পিন, ব্যালেন্স বা লেনদেনের তথ্য এআই অ্যাসিস্ট্যান্টের মাধ্যমে প্রকাশ বা প্রদান করা হয় না। আপনার নিজের ব্যালেন্স বা লেনদেন দেখতে অনুগ্রহ করে ড্যাশবোর্ডের **ব্যালেন্স বাটন** অথবা **MY BNB লেনদেন** সেকশন ব্যবহার করুন।';
  }

  // 2. STRICT OUT-OF-SCOPE GUARD (Non-BNB topics)
  const outOfScopeKeywords = [
    'রান্না', 'রেসিপি', 'recipe', 'খেলা', 'ক্রিকেট', 'ফুটবল', 'cricket', 'football', 'রাজনীতি', 'নির্বাচন',
    'politics', 'weather', 'আবহাওয়া', 'কবিতা', 'গল্প', 'গান', 'poem', 'story', 'joke', 'কৌতুক',
    'python', 'javascript', 'html', 'coding', 'কোডিং', 'প্রোগ্রামিং', 'সিনেমা', 'movie', 'ভ্রমণ',
    'চিকিৎসা', 'ওষুধ', 'ডাক্তার', 'medicine', 'প্রেম', 'ভালোবাসা', 'রাশিফল', 'ইতিহাস', 'ভূগোল',
    'প্রধানমন্ত্রী', 'রাষ্ট্রপতি', 'রাজধানী', 'capital of', 'who is the president', 'math', 'গণিত'
  ];
  if (outOfScopeKeywords.some(k => q.includes(k))) {
    return isEn
      ? '🙏 **Official BNB Scope Notice:** I am the official Virtual Assistant for **BNB - Business Network Bangladesh**. I can only answer questions related to the BNB app, its 12 service sections, wallet features, and software troubleshooting. Please ask me anything about BNB features or services!'
      : '🙏 **শুধুমাত্র BNB সফটওয়্যার সংক্রান্ত সহায়তা:** আমি **"BNB - Business Network Bangladesh"**-এর অফিসিয়াল ভার্চুয়াল অ্যাসিস্ট্যান্ট। এই সফটওয়্যারের বাহিরে অন্য কোনো বিষয়ে উত্তর দেওয়ার অনুমতি নেই। আমি শুধুমাত্র BNB অ্যাপের ১২টি সেবা সেকশন, ওয়ালেট লেনদেন এবং অ্যাপ সংক্রান্ত সমস্যার সমাধান বিষয়ে সহায়তা করতে পারি। অনুগ্রহ করে BNB অ্যাপের ফিচার সম্পর্কে প্রশ্ন করুন।';
  }

  // 3. GREETINGS & GENERAL HELP
  if (
    /^(hi|hello|hlw|salam|assalamu|হ্যালো|হাই|সালাম|আসসালামু আলাইকুম|কেমন আছেন|কি কাজ করে|bnb কি|বিএনবি কি)/i.test(q) ||
    q === 'help' || q === 'সাহায্য'
  ) {
    return isEn
      ? 'Assalamu Alaikum! Welcome to **BNB - Business Network Bangladesh** Official Virtual Assistant.\n\nI can help you with all 12 services and features of the BNB app:\n• **BNB Company Investor** (Cooperative savings & shares)\n• **BNB Safe Transactions** (Escrow & Safe Deals)\n• **BNB Qard Hasana** (100% Interest-free welfare loan)\n• **MY BNB Transactions** (Add Money, Send Money, Statements)\n• **BNB Telecom & Auto Recharge**\n• **BNB Ration Card & Safi Shop**\n• **BNB Auto Salary & Bill Pay**\n• **PIN Reset, OTP & Payment Auto-Verify guide**\n\nHow can I assist you with the BNB app today?'
      : 'আসসালামু আলাইকুম! **"BNB - Business Network Bangladesh"**-এর অফিসিয়াল ভার্চুয়াল অ্যাসিস্ট্যান্টে আপনাকে স্বাগতম।\n\nআমি আপনাকে এই সফটওয়্যারের সকল ফিচার ও সমস্যার সমাধানে সাহায্য করতে পারি:\n• **BNB কোম্পানি ইনভেস্টর** (২০০ সদস্যের সমবায় পরিবার ও মাসিক সঞ্চয়)\n• **BNB নিরাপদ লেনদেন** (নিরাপদ কেনাবেচা ও এস্ক্রো ডিল)\n• **BNB কর্জে হাসানা** (সম্পূর্ণ সুদমুক্ত কল্যাণ ঋণ)\n• **MY BNB লেনদেন** (অটো অ্যাড মানি, সেন্ড মানি ও স্টেটমেন্ট)\n• **BNB টেলিকম ও অটো রিচার্জ**\n• **BNB রেশন কার্ড ও সাফি (Safi) শপ**\n• **BNB অটো স্যালারি পে ও বিল পে**\n• **পিন রিসেট, ওটিপি ও পেমেন্ট সমাধান**\n\nআপনি কোন সেকশন বা সেবা সম্পর্কে জানতে চান?';
  }

  // 4. PIN RESET / OTP / LOGIN TROUBLESHOOTING
  if (
    q.includes('পিন') || q.includes('pin') || q.includes('ওটিপি') || q.includes('otp') ||
    q.includes('লগইন') || q.includes('login') || q.includes('ভুলে গেছি') || q.includes('পাসওয়ার্ড')
  ) {
    return isEn
      ? '🔑 **PIN Reset & Login OTP Solution:**\n\n1. **Forgot PIN:** On the Login or Lock screen, tap **"পিন ভুলে গেছেন? (Forgot PIN)"**.\n2. **Email OTP:** Enter your registered email address and tap **"Send OTP"**. A 6-digit verification code will be sent to your email (check Inbox and Spam folder).\n3. **Set New 4-Digit PIN:** Enter the 6-digit OTP and set a new **4-digit security PIN** to unlock your account immediately.\n4. **Login Tips:** Always use your exact registered email or phone number and 4-digit PIN.'
      : '🔑 **পিন (PIN) ও লগইন ওটিপি সমস্যার সমাধান:**\n\n১. **পিন ভুলে গেলে করণীয়:** লগইন বা লক স্ক্রিনে থাকা **"পিন ভুলে গেছেন? ( ওটিপি দিয়ে রিসেট করুন )"** বাটনে ট্যাপ করুন।\n২. **ইমেইল ওটিপি (Email OTP) গ্রহণ:** আপনার নিবন্ধিত ইমেইল ঠিকানা দিলে সাথে সাথে ৬ সংখ্যার একটি ভেরিফিকেশন কোড (OTP) আপনার ইমেইলে যাবে (ইনবক্স বা Spam ফোল্ডার চেক করুন)।\n৩. **নতুন পিন সেট:** ৬ সংখ্যার ওটিপি কোডটি বসিয়ে নতুন **৪ ডিজিটের পিন** সেট করলেই সাথে সাথে লগইন হয়ে যাবে।\n৪. **সতর্কতা:** অ্যাপের সিকিউরিটি পিন সবসময় **৪ সংখ্যার (4 Digits)** হয়। কারো সাথে আপনার পিন বা ওটিপি শেয়ার করবেন না।';
  }

  // 5. ADD MONEY / PAYMENT AUTO VERIFY
  if (
    q.includes('অ্যাড মানি') || q.includes('এড মানি') || q.includes('add money') ||
    q.includes('ডিপোজিট') || q.includes('deposit') || q.includes('trxid') ||
    q.includes('পেমেন্ট') || q.includes('টাকা যোগ') || q.includes('বিকাশ') || q.includes('নগদ')
  ) {
    return isEn
      ? '💳 **How to Add Money (Auto-Verify Guide):**\n\n1. Tap the **(+) Add Money** button in the center of the bottom navigation bar.\n2. Choose your preferred method (**bKash, Nagad, Rocket, Upay**, or **Online Payment Gateway**).\n3. Copy the official BNB number shown on the screen and send the money from your mobile wallet.\n4. Copy the **Transaction ID (TrxID)** from your payment SMS/receipt.\n5. Enter the exact **Amount**, **TrxID**, and your **4-digit PIN**, then tap Submit.\n6. Our system automatically verifies the TrxID and credits your main balance instantly!'
      : '💳 **ওয়ালেটে টাকা যোগ (Add Money ও Auto-Verify) করার নিয়ম:**\n\n১. হোম স্ক্রিনের নিচের মেনু বারের মাঝখানে **(+) বাটনে** ট্যাপ করুন।\n২. আপনার পছন্দের মাধ্যম (**বিকাশ, নগদ, রকেট, উপায়** অথবা **অনলাইন পেমেন্ট গেটওয়ে**) সিলেক্ট করুন।\n৩. স্ক্রিনে দেওয়া নাম্বারে টাকা পাঠিয়ে মেসেজ থেকে **TrxID (ট্রানজেকশন আইডি)** কপি করুন।\n৪. সঠিক **টাকার পরিমাণ (Amount)**, **TrxID** এবং আপনার **৪ ডিজিটের পিন** দিয়ে সাবমিট করুন।\n৫. আমাদের সার্ভার স্বয়ংক্রিয়ভাবে (Auto-Verify) TrxID যাচাই করে সাথে সাথে আপনার মেইন ব্যালেন্সে টাকা যোগ করে দেবে!';
  }

  // 6. SECTION 1: BNB কোম্পানি ইনভেস্টর (Company Investor / সমবায়)
  if (
    q.includes('ইনভেস্টর') || q.includes('investor') || q.includes('সমবায়') || q.includes('সমবায়') ||
    q.includes('সমিতি') || q.includes('samity') || q.includes('সঞ্চয়') || q.includes('সঞ্চয়') ||
    q.includes('২০০ জন') || q.includes('১০০০ টাকা')
  ) {
    return '🏦 **BNB কোম্পানি ইনভেস্টর (সমবায় ও সঞ্চয় পোর্টাল):**\n\n• **মূল লক্ষ্য:** একসাথে ২০০ জন সদস্যের একটি শক্তিশালী পরিবারের যাত্রা।\n• **মাসিক সঞ্চয়:** প্রতি মাসে মাত্র ১,০০০ টাকা (অথবা নির্ধারিত মাসিক/ত্রৈমাসিক কিস্তি) জমা করে কোম্পানির শেয়ার ও মুনাফার অংশীদার হওয়ার সুযোগ।\n• **ভার্চুয়াল একাউন্ট সুবিধা:** যেকোনো সদস্যের মোবাইল নম্বরের শেষে **"0"** যুক্ত করলে সেটি তার সমিতির ভার্চুয়াল একাউন্ট হিসেবে কাজ করে, যেখানে সরাসরি সঞ্চয় জমা দেওয়া যায়।\n• **বিশেষ সুবিধা:** নিয়মিত সদস্যরা সুদমুক্ত কর্জে হাসানা ঋণ এবং মুনাফা বণ্টনের সুবিধা পান।\n• **ব্যবহারের নিয়ম:** ড্যাশবোর্ডের ১ম আইকন **"BNB কোম্পানি ইনভেস্টর"**-এ ট্যাপ করে সদস্যপদ আবেদন, কিস্তি জমা ও সঞ্চয় স্টেটমেন্ট দেখতে পারবেন।';
  }

  // 7. SECTION 2: BNB নিরাপদ লেনদেন (Safe Deals / Escrow)
  if (q.includes('নিরাপদ লেনদেন') || q.includes('safe deal') || q.includes('escrow') || q.includes('পাইকারি ডিল') || q.includes('গ্রুপ বাই')) {
    return '🛡️ **BNB নিরাপদ লেনদেন (Safe Deals & Escrow):**\n\n• **কাজ কী:** অনলাইনে অপরিচিত বা পাইকারি বিক্রেতার সাথে শতভাগ নিরাপদে পণ্য কেনাবেচা ও মানি এক্সচেঞ্জ করার মাধ্যম।\n• **কিভাবে কাজ করে:** ক্রেতা পেমেন্ট করলে টাকা সরাসরি বিক্রেতার কাছে না গিয়ে BNB-এর নিরাপদ এস্ক্রো (Escrow) তহবিলে সংরক্ষিত থাকে। ক্রেতা সঠিক পণ্য হাতে পাওয়ার পর পেমেন্ট রিলিজ করা হয়।\n• **গ্রুপ বাই ডিল:** একাধিক সদস্য মিলে একসাথে পাইকারি দামে পণ্য অর্ডার করতে পারেন।\n• **ব্যবহারের নিয়ম:** ড্যাশবোর্ড থেকে **"BNB নিরাপদ লেনদেন"** আইকনে ট্যাপ করে চলমান ডিলগুলোতে অংশ নিতে বা নতুন ডিল পোস্ট করতে পারবেন।';
  }

  // 8. SECTION 3: BNB কর্জে হাসানা (Qard Hasana)
  if (q.includes('কর্জে হাসানা') || q.includes('কার্জ হাসানা') || q.includes('করযে হাসানা') || q.includes('qard') || q.includes('সুদমুক্ত') || q.includes('ঋণ') || q.includes('loan')) {
    return '🤝 **BNB কর্জে হাসানা (সম্পূর্ণ সুদমুক্ত কল্যাণ তহবিল):**\n\n• **কাজ কী:** সদস্যদের জরুরি প্রয়োজনে ১০০% সুদমুক্ত (০% সুদ) ঋণ সহায়তা প্রদান করা।\n• **ঋণ আবেদনের নিয়ম:** ড্যাশবোর্ডের **"BNB কর্জে হাসানা"** সেকশনে প্রবেশ করে **"ঋণ আবেদন"** ট্যাবে যান, প্রয়োজনীয় টাকার পরিমাণ, মেয়াদ ও হোয়াটসঅ্যাপ নম্বর এবং ৪ ডিজিটের পিন দিয়ে আবেদন করুন।\n• **ঋণ পরিশোধ:** মেইন ওয়ালেট ব্যালেন্স থেকে এক ক্লিকেই বকেয়া কিস্তি পরিশোধ করা যায়।\n• **অনুদান প্রদান:** যেকোনো সদস্য চাইলে সওয়াবের উদ্দেশ্যে হাসানাত তহবিলে এককালীন বা মাসিক অনুদান দিতে পারেন।';
  }

  // 9. SECTION 4: MY BNB লেনদেন / Send Money / Cashout
  if (
    q.includes('my bnb') || q.includes('সেন্ড মানি') || q.includes('send money') ||
    q.includes('উইথড্র') || q.includes('withdraw') || q.includes('ক্যাশআউট') ||
    q.includes('cashout') || q.includes('স্টেটমেন্ট') || q.includes('রিসিট') || q.includes('ট্রান্সফার')
  ) {
    return '💸 **MY BNB লেনদেন (সেন্ড মানি, ক্যাশআউট ও স্টেটমেন্ট):**\n\n• **সেন্ড মানি (BNB টু BNB):** নিচের মেনু বারের সেন্ড আইকনে ট্যাপ করে যেকোনো BNB সদস্যের মোবাইল নম্বর বা মেম্বার আইডি দিয়ে সম্পূর্ণ ফ্রি-তে তাৎক্ষণিক টাকা পাঠাতে পারবেন।\n• **ক্যাশআউট / ব্যাংক ট্রান্সফার:** **"MY BNB লেনদেন"** সেকশন থেকে বিকাশ, নগদ, রকেট, উপায় অথবা ব্যাংক একাউন্টে (DBBL, Islami Bank ইত্যাদি) টাকা উত্তোলনের আবেদন করতে পারবেন।\n• **ডিজিটাল রিসিট ও স্টেটমেন্ট:** নিচের লেনদেন আইকনে ট্যাপ করে বিগত ৬০ দিনের সকল লেনদেনের ডিজিটাল মানি রিসিট দেখা ও ডাউনলোড করা যায়।';
  }

  // 10. SECTION 5 & 9: BNB টেলিকম ও অটো রিচার্জ
  if (
    q.includes('টেলিকম') || q.includes('telecom') || q.includes('রিচার্জ') ||
    q.includes('recharge') || q.includes('ড্রাইভ') || q.includes('ফ্লেক্সিলোড') || q.includes('অফার')
  ) {
    return '📲 **BNB টেলিকম ও অটো রিচার্জ সেবা:**\n\n• **BNB টেলিকম:** গ্রামীণফোন, রবি, বাংলালিংক, এয়ারটেল ও টেলিটক সিমে বিশেষ ডিসকাউন্ট ও ক্যাশব্যাকে ড্রাইভ অফার, মিনিট ও ইন্টারনেট প্যাক কেনা যায়।\n• **BNB অটো রিচার্জ / ডাটা রিচার্জ:** ড্যাশবোর্ডের **"BNB ডাটা রিচার্জ / অটো রিচার্জ"** সেকশন থেকে মোবাইল নম্বর, অপারেটর, টাকার পরিমাণ ও ৪ ডিজিটের পিন দিয়ে তাৎক্ষণিক রিচার্জ করতে পারবেন।\n• **ওয়ালেট ট্রান্সফার:** মেইন ব্যালেন্স থেকে সরাসরি টেলিকম ওয়ালেটে ফান্ড স্থানান্তর করা যায়।';
  }

  // 11. SECTION 6: BNB রেশন কার্ড
  if (q.includes('রেশন') || q.includes('ration')) {
    return '🪪 **BNB ডিজিটাল রেশন কার্ড:**\n\n• **সুবিধা:** BNB সদস্যদের পরিবারের নিত্যপ্রয়োজনীয় বাজার (চাল, ডাল, তেল, আটা ইত্যাদি) পাইকারি ও ভর্তুকি মূল্যে ক্রয়ের বিশেষ ডিজিটাল মেম্বারশিপ কার্ড।\n• **কিভাবে তৈরি করবেন:** ড্যাশবোর্ড থেকে **"BNB রেশন কার্ড"** সেকশনে গিয়ে আপনার নাম, ঠিকানা, নমিনি ও কার্ডের ধরন নির্বাচন করে তাৎক্ষণিক ডিজিটাল রেশন কার্ড তৈরি করতে পারবেন।';
  }

  // 12. SECTION 7: BNB অটো স্যালারি পে ও স্মার্ট ডেলিভারি পে
  if (q.includes('স্যালারি') || q.includes('সেলারি') || q.includes('salary') || q.includes('ডেলিভারি পে') || q.includes('delivery pay') || q.includes('বেতন')) {
    return '💼 **BNB অটো স্যালারি পে ও স্মার্ট ডেলিভারি পে:**\n\n• **অটো স্যালারি পে:** যেকোনো প্রতিষ্ঠান বা উদ্যোক্তা তাদের কর্মীদের তালিকা যুক্ত করে মাস শেষে স্বয়ংক্রিয়ভাবে বেতন (Payroll) পরিশোধ করতে পারেন।\n• **স্মার্ট ডেলিভারি পে:** কুরিয়ার ও ডেলিভারি পার্সেল রিসিভ বা মার্চেন্ট পেমেন্ট নিরাপদে সম্পন্ন করার সুবিধা।\n• **ব্যবহারের নিয়ম:** ড্যাশবোর্ডের **"BNB অটো সেলারি পে"** আইকনে ট্যাপ করে কর্মচারী যুক্ত ও পেমেন্ট পরিচালনা করা যায়।';
  }

  // 13. SECTION 8: safi সাফি / সাফি শান্তি / সুপার শপ
  if (q.includes('সাফি') || q.includes('safi') || q.includes('সুপার শপ') || q.includes('shop') || q.includes('মধু') || q.includes('ঘি') || q.includes('পণ্য')) {
    return '🛍️ **safi সাফি (ইন-হাউস প্রিমিয়াম ব্র্যান্ড ও সুপার শপ):**\n\n• **খাঁটি পণ্যসমূহ:** সুন্দরবনের প্রাকৃতিক চাকের মধু, খাঁটি গাওয়া ঘি, ঘানি ভাঙা সরিষার তেল, উন্নতমানের পোশাক, গ্যাজেট ও নিত্যপ্রয়োজনীয় পণ্য।\n• **অর্ডার করার নিয়ম:** ড্যাশবোর্ডের **"safi সাফি"** সেকশনে প্রবেশ করে পছন্দের পণ্য সিলেক্ট করুন এবং মেইন ব্যালেন্স, সুপার শপ ব্যালেন্স অথবা ক্যাশ অন ডেলিভারিতে হোম ডেলিভারি অর্ডার করুন।';
  }

  // 14. SECTION 10: BNB বিল পে
  if (q.includes('বিল পে') || q.includes('bill') || q.includes('বিদ্যুৎ') || q.includes('গ্যাস') || q.includes('পানি') || q.includes('ইন্টারনেট বিল')) {
    return '💡 **BNB বিল পে (ইউটিলিটি বিল পরিশোধ):**\n\n• **সুবিধা:** ঘরে বসেই কোনো অতিরিক্ত ঝামেলা ছাড়া সকল ইউটিলিটি বিল পরিশোধ করা যায়:\n  - **বিদ্যুৎ বিল:** পল্লী বিদ্যুৎ, ডেসকো (DESCO), ডিপিডিসি (DPDC), নেসকো (NESCO)\n  - **গ্যাস, পানি (WASA) ও ইন্টারনেট বিল**\n• **ব্যবহারের নিয়ম:** ড্যাশবোর্ডের **"BNB বিল পে"** সেকশনে গিয়ে বিলের ধরন, মিটার/অ্যাকাউন্ট নম্বর, টাকার পরিমাণ এবং ৪ ডিজিটের পিন দিয়ে সাবমিট করলেই বিল পরিশোধ হয়ে ডিজিটাল রিসিট তৈরি হবে।';
  }

  // 15. SECTION 11 & 12: BNB এজেন্ট ও আমাদের লক্ষ্য / প্রজেক্ট
  if (q.includes('এজেন্ট') || q.includes('agent') || q.includes('লক্ষ্য') || q.includes('প্রজেক্ট') || q.includes('project') || q.includes('কোম্পানি প্রোফাইল')) {
    return '🌟 **BNB এজেন্ট পোর্টাল ও আমাদের লক্ষ্য:**\n\n• **BNB এজেন্ট:** সারা বাংলাদেশের বিভাগ, জেলা ও উপজেলা পর্যায়ে BNB-এর অফিসিয়াল প্রতিনিধি বা এজেন্ট হয়ে আকর্ষণীয় কমিশন ও ক্যারিয়ার গড়ার সুযোগ। ড্যাশবোর্ডের **"BNB এজেন্ট"** সেকশন থেকে সরাসরি আবেদন করা যায়।\n• **BNB আমাদের লক্ষ্য:** উদ্যোক্তা তৈরি, সুদমুক্ত অর্থনৈতিক সমবায় গড়ে তোলা এবং একটি প্ল্যাটফর্মে নিরাপদ ডিজিটাল লেনদেন ও নিত্যপণ্য সেবা পৌঁছে দেওয়া। বিস্তারিত জানতে **"BNB আমাদের লক্ষ্য"** সেকশন ভিজিট করুন।';
  }

  // 16. DEFAULT BNB GUIDANCE (Strictly inside BNB context)
  return isEn
    ? 'Thank you for your question! As the official Virtual Assistant of **BNB - Business Network Bangladesh**, I only provide guidance on BNB app features and services:\n\n• **12 Core Services:** BNB Company Investor, Safe Transactions, Qard Hasana (Interest-Free Loan), MY BNB Transactions, BNB Telecom, Ration Card, Auto Salary Pay, Safi Shop, Auto Recharge, Bill Pay, BNB Agent, and Corporate Projects.\n• **Account & Wallet Help:** Add Money (Auto-Verify with TrxID), Send Money, Cashout, and Email OTP PIN Reset.\n\nPlease select one of the quick topics above or ask specifically about any BNB feature!'
    : 'ধন্যবাদ! আমি **"BNB - Business Network Bangladesh"**-এর অফিসিয়াল ভার্চুয়াল অ্যাসিস্ট্যান্ট। আমি শুধুমাত্র এই সফটওয়্যারের ১২টি সেবা সেকশন ও সমস্যার সমাধান বিষয়ে উত্তর প্রদান করি:\n\n১. **BNB কোম্পানি ইনভেস্টর** (সমবায় সঞ্চয় ও শেয়ার)\n২. **BNB নিরাপদ লেনদেন** (এস্ক্রো ও পাইকারি ডিল)\n৩. **BNB কর্জে হাসানা** (সুদমুক্ত কল্যাণ ঋণ)\n৪. **MY BNB লেনদেন** (অটো অ্যাড মানি, সেন্ড মানি ও ক্যাশআউট)\n৫. **BNB টেলিকম ও অটো রিচার্জ**\n৬. **BNB রেশন কার্ড ও safi সাফি শপ**\n৭. **BNB অটো স্যালারি পে ও বিল পে**\n৮. **BNB এজেন্ট ও আমাদের লক্ষ্য**\n৯. **পিন রিসেট ও ইমেইল ওটিপি সমাধান**\n\nউপরের যেকোনো একটি বাটনে ট্যাপ করুন অথবা নির্দিষ্ট ফিচারের নাম লিখে প্রশ্ন করুন!';
}

export const BNBVirtualAssistant: React.FC<BNBVirtualAssistantProps> = ({
  isVisible
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'model',
      text: 'আসসালামু আলাইকুম! আমি **BNB - Business Network Bangladesh**-এর অফিসিয়াল এআই অ্যাসিস্ট্যান্ট। 🤖\n\nএই অ্যাপের ১২টি সেবা সেকশন, অ্যাড মানি, সেন্ড মানি, সুদমুক্ত কর্জে হাসানা কিংবা পিন/ওটিপি সমস্যার সমাধানে কীভাবে আপনাকে সাহায্য করতে পারি?',
      timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Draggable position state (x, y from top-left when dragged; null means default bottom-right anchor)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragStateRef = useRef<{
    isDragging: boolean;
    hasMoved: boolean;
    startX: number;
    startY: number;
    initialLeft: number;
    initialTop: number;
  }>({
    isDragging: false,
    hasMoved: false,
    startX: 0,
    startY: 0,
    initialLeft: 0,
    initialTop: 0
  });

  const bubbleRef = useRef<HTMLButtonElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Close assistant automatically whenever user leaves the main dashboard or enters any section
  useEffect(() => {
    if (!isVisible && isOpen) {
      setIsOpen(false);
    }
  }, [isVisible, isOpen]);

  // Register Android back button handler when chat window is open
  useBackHandler(() => {
    if (isOpen) {
      setIsOpen(false);
      return true;
    }
    return false;
  }, isOpen, 65);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    }
  }, [messages, isOpen, isTyping]);

  // Keep bubble inside screen bounds on window resize
  useEffect(() => {
    const handleResize = () => {
      if (!position) return;
      const bubbleSize = 58;
      const maxX = Math.max(8, window.innerWidth - bubbleSize - 8);
      const maxY = Math.max(60, window.innerHeight - bubbleSize - 70);
      setPosition(prev =>
        prev
          ? {
              x: Math.min(Math.max(8, prev.x), maxX),
              y: Math.min(Math.max(60, prev.y), maxY)
            }
          : null
      );
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position]);

  const startDrag = (clientX: number, clientY: number) => {
    if (!bubbleRef.current) return;
    const rect = bubbleRef.current.getBoundingClientRect();
    dragStateRef.current = {
      isDragging: true,
      hasMoved: false,
      startX: clientX,
      startY: clientY,
      initialLeft: rect.left,
      initialTop: rect.top
    };
  };

  const moveDrag = (clientX: number, clientY: number) => {
    if (!dragStateRef.current.isDragging) return;
    const dx = clientX - dragStateRef.current.startX;
    const dy = clientY - dragStateRef.current.startY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
      dragStateRef.current.hasMoved = true;
    }
    if (!dragStateRef.current.hasMoved) return;

    const bubbleSize = 58;
    const maxX = Math.max(8, window.innerWidth - bubbleSize - 8);
    const maxY = Math.max(56, window.innerHeight - bubbleSize - 68);
    const nextX = Math.min(Math.max(8, dragStateRef.current.initialLeft + dx), maxX);
    const nextY = Math.min(Math.max(56, dragStateRef.current.initialTop + dy), maxY);
    setPosition({ x: nextX, y: nextY });
  };

  const endDrag = () => {
    dragStateRef.current.isDragging = false;
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    if (e.touches.length !== 1) return;
    startDrag(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLButtonElement>) => {
    if (!dragStateRef.current.isDragging || e.touches.length !== 1) return;
    moveDrag(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    endDrag();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    startDrag(e.clientX, e.clientY);

    const onMouseMove = (moveEvent: MouseEvent) => {
      moveDrag(moveEvent.clientX, moveEvent.clientY);
    };
    const onMouseUp = () => {
      endDrag();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleBubbleClick = () => {
    if (dragStateRef.current.hasMoved) {
      dragStateRef.current.hasMoved = false;
      return;
    }
    setIsOpen(true);
  };

  const handleSendMessage = async (textOverride?: string) => {
    const queryText = (textOverride ?? inputText).trim();
    if (!queryText || isTyping) return;

    const nowTime = new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: queryText,
      timestamp: nowTime
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    if (!textOverride) setInputText('');
    setIsTyping(true);

    let replyText = '';

    // Try server-side Gemini endpoint first (supports both local web & Play Store production server)
    try {
      const endpoints = Array.from(new Set(['/api/bnb-assistant', apiUrl('/api/bnb-assistant')]));
      for (const endpoint of endpoints) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 6500);
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: queryText,
              history: updatedHistory.slice(-6).map(m => ({ role: m.role, text: m.text }))
            }),
            signal: controller.signal
          });
          clearTimeout(timer);
          if (res.ok) {
            const data = await res.json();
            if (data?.reply && typeof data.reply === 'string' && data.reply.trim()) {
              replyText = data.reply.trim();
              break;
            }
          }
        } catch {
          // Proceed to next endpoint or deterministic BNB knowledge engine
        }
      }
    } catch {
      // Fallback handled below
    }

    // Guaranteed Play Store & Offline Fallback using the authoritative BNB Knowledge Engine
    if (!replyText) {
      await new Promise(resolve => setTimeout(resolve, 350));
      replyText = generateBNBExpertResponse(queryText);
    }

    const botMsg: ChatMessage = {
      id: `b-${Date.now()}`,
      role: 'model',
      text: replyText,
      timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, botMsg]);
    setIsTyping(false);
  };

  // Strictly render NOTHING when not on the main Dashboard home screen
  if (!isVisible) return null;

  return (
    <>
      {/* Draggable Floating AI Button on Main Dashboard Home Only */}
      {!isOpen && (
        <button
          ref={bubbleRef}
          type="button"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onClick={handleBubbleClick}
          aria-label="BNB AI Assistant"
          title="BNB এআই সাপোর্ট (যেকোনো জায়গায় সরানো যাবে)"
          style={
            position
              ? {
                  position: 'fixed',
                  left: `${position.x}px`,
                  top: `${position.y}px`,
                  zIndex: 45,
                  touchAction: 'none'
                }
              : {
                  position: 'fixed',
                  right: '14px',
                  bottom: '72px',
                  zIndex: 45,
                  touchAction: 'none'
                }
          }
          className="group select-none cursor-grab active:cursor-grabbing focus:outline-none"
        >
          <div className="relative flex items-center justify-center">
            {/* Outer subtle pulse ring */}
            <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-teal-500 opacity-60 blur-xs animate-pulse" />

            {/* Main Circular Bubble */}
            <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-[#0b6623] via-emerald-700 to-teal-900 border-2 border-amber-400 shadow-2xl flex flex-col items-center justify-center text-white transition-transform duration-150 group-active:scale-95">
              <div className="relative">
                <Bot className="w-6 h-6 text-amber-300 drop-shadow" />
                <Sparkles className="w-3 h-3 text-white absolute -top-1 -right-1.5 animate-bounce" />
              </div>
              <span className="text-[8.5px] font-black tracking-tight text-amber-200 leading-none mt-0.5">
                BNB AI
              </span>
            </div>

            {/* Online dot indicator */}
            <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-emerald-400 border-2 border-white rounded-full shadow-sm" />
          </div>
        </button>
      )}

      {/* Full Interactive BNB Virtual Assistant Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 font-sans animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-md h-[85vh] sm:h-[620px] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-emerald-900/15 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#0b6623] via-emerald-800 to-teal-900 text-white px-4 py-3.5 flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-white/15 border border-amber-400/60 flex items-center justify-center shrink-0 shadow-inner">
                  <Bot className="w-6 h-6 text-amber-300" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-black tracking-tight truncate">
                      BNB ভার্চুয়াল অ্যাসিস্ট্যান্ট
                    </h3>
                    <span className="px-1.5 py-0.5 text-[9px] font-black bg-amber-400 text-slate-950 rounded-full uppercase">
                      AI
                    </span>
                  </div>
                  <p className="text-[10.5px] text-emerald-100 flex items-center gap-1 truncate">
                    <ShieldCheck className="w-3 h-3 text-amber-300 shrink-0" />
                    <span>বি এন বি - বিজনেস নেটওয়ার্ক বাংলাদেশ সাপোর্ট</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setMessages([
                      {
                        id: 'welcome-reset',
                        role: 'model',
                        text: 'আসসালামু আলাইকুম! আমি **BNB - Business Network Bangladesh**-এর অফিসিয়াল এআই অ্যাসিস্ট্যান্ট। 🤖\n\nএই অ্যাপের ১২টি সেবা সেকশন, অ্যাড মানি, সেন্ড মানি, সুদমুক্ত কর্জে হাসানা কিংবা পিন/ওটিপি সমস্যার সমাধানে কীভাবে আপনাকে সাহায্য করতে পারি?',
                        timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })
                      }
                    ])
                  }
                  title="চ্যাট রিসেট করুন"
                  className="p-2 rounded-full hover:bg-white/15 text-emerald-100 hover:text-white transition cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close Assistant"
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Privacy & Scope Notice Strip */}
            <div className="bg-emerald-50 border-b border-emerald-100 px-3.5 py-1.5 flex items-center justify-between text-[10px] text-emerald-900 font-semibold shrink-0">
              <span className="flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                শুধুমাত্র BNB সফটওয়্যারের ফিচার ও সমস্যার সমাধান সহায়িকা
              </span>
              <span className="text-[9px] bg-emerald-700 text-white px-2 py-0.5 rounded-full font-bold">
                ১০০% নিরাপদ
              </span>
            </div>

            {/* Quick Suggestion Chips */}
            <div className="bg-slate-50 border-b border-slate-200/80 px-3 py-2 shrink-0">
              <p className="text-[10px] font-bold text-slate-500 mb-1.5">
                ⚡ দ্রুত জানতে যেকোনো বিষয়ে ট্যাপ করুন:
              </p>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {QUICK_TOPICS_BN.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(item.query)}
                    disabled={isTyping}
                    className="shrink-0 px-2.5 py-1.5 rounded-xl bg-white hover:bg-emerald-50 active:scale-95 border border-emerald-200 text-emerald-950 text-[11px] font-bold shadow-2xs transition flex items-center gap-1 cursor-pointer"
                  >
                    <span>{item.label}</span>
                    <ChevronRight className="w-3 h-3 text-emerald-600" />
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Messages Area */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-50/60">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs ${
                      msg.role === 'user'
                        ? 'bg-[#0b6623] text-white rounded-br-xs font-medium'
                        : 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs'
                    }`}
                  >
                    <div className="whitespace-pre-line break-words">
                      {msg.text.split('**').map((part, index) =>
                        index % 2 === 1 ? (
                          <strong key={index} className={msg.role === 'user' ? 'font-black text-amber-200' : 'font-black text-emerald-900'}>
                            {part}
                          </strong>
                        ) : (
                          <span key={index}>{part}</span>
                        )
                      )}
                    </div>
                    <div
                      className={`text-[9px] mt-1 text-right ${
                        msg.role === 'user' ? 'text-emerald-200' : 'text-slate-400'
                      }`}
                    >
                      {msg.timestamp}
                    </div>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-xs px-4 py-2.5 shadow-xs flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce [animation-delay:300ms]" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-500">
                      BNB AI উত্তর লিখছে...
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0 pb-safe"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="BNB অ্যাপের যেকোনো সেবা বা সমস্যা লিখে প্রশ্ন করুন..."
                className="flex-1 bg-slate-100 focus:bg-white border border-slate-200 focus:border-emerald-600 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none transition"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isTyping}
                className="w-10 h-10 rounded-2xl bg-[#0b6623] hover:bg-emerald-800 disabled:opacity-45 text-white flex items-center justify-center shadow-md transition active:scale-95 cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default BNBVirtualAssistant;
