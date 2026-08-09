import React, { useState, useRef } from 'react';
import { ArrowLeft, RefreshCw, ExternalLink, ShieldCheck } from 'lucide-react';
import { User } from '../types';

interface BapSystemProps {
  currentUser: User;
  onBack: () => void;
  appLanguage?: string;
  darkMode?: boolean;
}

export default function BapSystem({ 
  currentUser, 
  onBack,
  appLanguage = 'bn',
  darkMode = false
}: BapSystemProps) {
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const integrationUrl = "https://ais-pre-a75du2ag4r7g4jke5fwivz-539338463826.asia-southeast1.run.app";

  const handleRefresh = () => {
    if (iframeRef.current) {
      setLoading(true);
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  const handleOpenNewTab = () => {
    window.open(integrationUrl, '_blank');
  };

  return (
    <div className={`h-screen flex flex-col bg-[#F8FAFC] ${darkMode ? 'dark:bg-slate-900' : ''}`} id="bap-integration-root">
      {/* Top Header Panel */}
      <header className="bg-white border-b border-indigo-50/50 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shrink-0 shadow-3xs dark:bg-slate-800 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.3]" />
          </button>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="bg-[#00897B] text-white text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded shadow-2xs">INTEGRATED</span>
              <h1 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-1.5 tracking-tight">
                বাংলাদেশ এডমিন প্যানেল
              </h1>
            </div>
            <p className="text-[10px] text-[#00897B] font-black mt-0.5 dark:text-teal-400">সরাসরি সংযুক্ত অনলাইন সফটওয়্যার পোর্টাল</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh Action */}
          <button
            onClick={handleRefresh}
            title="Reload"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700 rounded-lg transition"
          >
            <RefreshCw className="w-4.5 h-4.5" />
          </button>

          {/* Open External Action */}
          <button
            onClick={handleOpenNewTab}
            title="Open in New Tab"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700 rounded-lg transition"
          >
            <ExternalLink className="w-4.5 h-4.5" />
          </button>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 relative w-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 dark:bg-slate-900/90 z-10 gap-3">
            <div className="relative flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
              <ShieldCheck className="absolute w-5 h-5 text-teal-600 animate-pulse" />
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 font-sans">বাংলাদেশ এডমিন প্যানেল লোড হচ্ছে...</p>
              <p className="text-[10px] text-slate-400 mt-1 font-sans">দয়া করে কিছু মুহূর্ত অপেক্ষা করুন</p>
            </div>
          </div>
        )}

        <iframe 
          ref={iframeRef}
          src={integrationUrl}
          title="Bangladesh Admin Panel"
          className="w-full h-full border-none"
          allow="camera; microphone; geolocation; clipboard-read; clipboard-write"
          onLoad={() => setLoading(false)}
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
}
