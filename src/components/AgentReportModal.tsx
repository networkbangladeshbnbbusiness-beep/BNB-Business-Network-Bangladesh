import React, { useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle, X, CheckCircle } from "lucide-react";
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface Agent {
  id: string;
  name: string;
}

interface AgentReportModalProps {
  agent: Agent;
  user: any;
  db: any;
  onClose: () => void;
  t: any;
}

export default function AgentReportModal({
  agent,
  user,
  db,
  onClose,
  t,
}: AgentReportModalProps) {
  const [reportReason, setReportReason] = useState<string>('ভুল তথ্য');
  const [reportDetails, setReportDetails] = useState<string>('');
  const [isSubmittingReport, setIsSubmittingReport] = useState<boolean>(false);
  const [reportSuccess, setReportSuccess] = useState<boolean>(false);

  const handleSubmit = async () => {
    if (!reportDetails.trim()) {
      alert('অনুগ্রহ করে অভিযোগের বিবরণ দিন।');
      return;
    }
    setIsSubmittingReport(true);
    try {
      await addDoc(collection(db, 'agent_reports'), {
        agentId: agent.id,
        agentName: agent.name,
        reporterId: user.uid,
        reporterPhone: user.phone || 'Unknown',
        reason: reportReason,
        details: reportDetails,
        createdAt: serverTimestamp(),
      });
      setReportSuccess(true);
    } catch (err: any) {
      alert('Failed to submit report: ' + err.message);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col bg-slate-900/60 backdrop-blur-sm">
      <div className="h-10 shrink-0 bg-[#004a2c] w-full"></div>
      
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="flex-1 bg-white rounded-t-[32px] flex flex-col overflow-hidden font-sans"
      >
        <div className="bg-[#004a2c] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h3 className="text-lg font-black">{t.reportModalTitle}</h3>
              <p className="text-[10px] text-emerald-100/70 font-medium">এজেন্ট: {agent.name}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {reportSuccess ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 space-y-4 text-center">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-emerald-600" />
              </div>
              <div className="space-y-2">
                <h4 className="text-xl font-black text-slate-900">ধন্যবাদ!</h4>
                <p className="text-sm text-slate-600 font-medium leading-relaxed max-w-xs mx-auto">
                  {t.reportSuccessText}
                </p>
              </div>
              <button 
                onClick={onClose}
                className="mt-4 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg shadow-emerald-600/20 transition active:scale-95"
              >
                বন্ধ করুন
              </button>
            </div>
          ) : (
            <>
              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                </div>
                <p className="text-xs text-rose-800 font-bold leading-relaxed">
                  এজেন্ট <span className="text-slate-900 underline underline-offset-2">{agent.name}</span> এর বিরুদ্ধে ভুল বা আপত্তিজনক কার্যক্রমের জন্য রিপোর্ট দাখিল করুন। অভিযোগটি সরাসরি অ্যাডমিন প্যানেলে যাচাই করা হবে।
                </p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">{t.reportReasonLabel}</label>
                  <select 
                    value={reportReason} 
                    onChange={e => setReportReason(e.target.value)} 
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                  >
                    <option value="ভুল তথ্য">ভুল তথ্য / ফেক লোকেশন</option>
                    <option value="খারাপ ব্যবহার">আপত্তিকর বা খারাপ ব্যবহার</option>
                    <option value="অতিরিক্ত ফি">অতিরিক্ত ফি বা লেনদেনে অনিয়ম</option>
                    <option value="ফোন বন্ধ">ফোন কল বা হোয়াটসঅ্যাপে যোগাযোগ করা অসম্ভব</option>
                    <option value="অন্যান্য">অন্যান্য অভিযোগ</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">{t.reportDetailsLabel}</label>
                  <textarea 
                    rows={5} 
                    value={reportDetails} 
                    onChange={e => setReportDetails(e.target.value)} 
                    placeholder="অভিযোগের বিস্তারিত এখানে ব্যাখ্যা করুন..." 
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 focus:bg-white focus:outline-none transition-all resize-none"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={handleSubmit}
                  disabled={isSubmittingReport}
                  className="w-full py-4 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white text-base font-black rounded-2xl shadow-lg shadow-rose-600/20 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmittingReport ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>দাখিল হচ্ছে...</span>
                    </>
                  ) : (
                    <span>{t.submitReportBtn}</span>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
