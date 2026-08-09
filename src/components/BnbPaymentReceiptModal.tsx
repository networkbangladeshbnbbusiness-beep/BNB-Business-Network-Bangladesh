import React, { useRef, useState } from 'react';
import { CheckCircle2, Download, Copy, Check, Share2, X, Send, History, Camera, ShieldCheck, AlertCircle } from 'lucide-react';
import html2canvas from 'html2canvas';

export interface PaymentReceiptData {
  transactionId?: string;
  typeLabel?: string;
  amount: number;
  fee?: number;
  totalAmount?: number;
  status?: 'success' | 'pending' | 'completed' | 'failed';
  
  // Beneficiary / Receiver details
  beneficiaryName?: string;
  beneficiaryAccount?: string; // ID or Account No
  senderPhone?: string;
  beneficiaryBank?: string;
  beneficiaryBranch?: string;
  
  // Extra details
  paymentMethod?: string;
  transactionDate?: string;
  description?: string;
}

interface BnbPaymentReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PaymentReceiptData | null;
  appLogo?: string;
  onNewTransaction?: () => void;
  onViewHistory?: () => void;
}

export const BnbPaymentReceiptModal: React.FC<BnbPaymentReceiptModalProps> = ({
  isOpen,
  onClose,
  data,
  appLogo,
  onNewTransaction,
  onViewHistory
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  if (!isOpen || !data) return null;

  const isSuccess = data.status === 'success' || data.status === 'completed' || !data.status;
  const isPending = data.status === 'pending';
  const isFailed = data.status === 'failed';

  const amountFormatted = (data.amount || 0).toLocaleString('bn-BD');
  const feeFormatted = (data.fee || 0).toLocaleString('bn-BD');
  const totalFormatted = (data.totalAmount || (data.amount + (data.fee || 0))).toLocaleString('bn-BD');

  const displayDate = data.transactionDate || new Date().toLocaleString('bn-BD', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: true
  });

  const handleCopy = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopyAllText = () => {
    const textToCopy = `=== BNB লেনদেন রসিদ ===
ধরন: ${data.typeLabel || 'BNB লেনদেন'}
তারিখ: ${displayDate}
প্রাপক: ${data.beneficiaryName || 'N/A'} (আইডি/একাউন্ট: ${data.beneficiaryAccount || 'N/A'})
মোবাইল নম্বর: ${data.senderPhone || 'N/A'}
পরিমাণ: ৳${data.amount} BDT
চার্জ: ৳${data.fee || 0}
মোট কাটা হয়েছে: ৳${data.totalAmount || data.amount} BDT
ট্রানজেকশন আইডি (TxID): ${data.transactionId || 'N/A'}
স্ট্যাটাস: ${isSuccess ? 'সফল (Success)' : isPending ? 'অপেক্ষমান (Pending)' : 'ব্যর্থ (Failed)'}
স্টোর: Business Network Bangladesh (BNB)`;
    
    navigator.clipboard.writeText(textToCopy);
    setCopiedField('all_text');
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleDownloadImage = async () => {
    if (!receiptRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `BNB-Receipt-${data.transactionId || Date.now()}.png`;
      link.click();
    } catch (err) {
      console.error('Failed to capture receipt PNG image:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden my-auto border border-slate-100 flex flex-col">
        
        {/* Top Floating Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
          title="বন্ধ করুন"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-5 sm:p-6 space-y-4">
          
          {/* Top Status Header */}
          <div className="flex flex-col items-center text-center space-y-2 pt-1">
            <div className="relative">
              <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center border-4 shadow-md ${
                isFailed 
                  ? 'bg-rose-50 border-rose-200 text-rose-600' 
                  : isPending 
                  ? 'bg-amber-50 border-amber-200 text-amber-600' 
                  : 'bg-emerald-50 border-emerald-300 text-emerald-600'
              }`}>
                {isFailed ? (
                  <X className="w-9 h-9 sm:w-11 sm:h-11 stroke-[2.5]" />
                ) : isPending ? (
                  <AlertCircle className="w-9 h-9 sm:w-11 sm:h-11 stroke-[2.5] animate-pulse" />
                ) : (
                  <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 stroke-[2.5]" />
                )}
              </div>
              <span className={`absolute bottom-0 right-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-white flex items-center justify-center ${
                isFailed ? 'bg-rose-500' : isPending ? 'bg-amber-500' : 'bg-emerald-500'
              }`}>
                <ShieldCheck className="w-3 h-3 text-white" />
              </span>
            </div>

            <h2 className={`text-lg sm:text-xl font-black tracking-tight ${
              isFailed ? 'text-rose-700' : isPending ? 'text-amber-800' : 'text-emerald-800'
            }`}>
              {isFailed 
                ? 'লেনদেনটি সম্পন্ন হতে পারেনি!' 
                : isPending 
                ? 'লেনদেন আবেদনটি জমা হয়েছে!' 
                : 'লেনদেনটি সফলভাবে সম্পন্ন হয়েছে!'}
            </h2>

            {/* Camera Notification Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-3xs">
              <Camera className="w-3.5 h-3.5 text-emerald-600" />
              <span>দয়া করে এই রসিদের একটি স্ক্রিনশট বা ছবি সংরক্ষণ করুন</span>
            </div>
          </div>

          {/* Printable / Capturable Receipt Card */}
          <div
            ref={receiptRef}
            className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-3.5 text-slate-800 shadow-3xs select-text"
          >
            {/* Header / Type Badge & Date */}
            <div className="text-center space-y-1">
              <div className="inline-block bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-xs sm:text-sm py-1 px-4 rounded-full shadow-3xs tracking-wide">
                {data.typeLabel || 'BNB TO BNB সেন্ড মানি'}
              </div>
              <div className="text-[11px] sm:text-xs text-slate-500 font-medium">
                তারিখঃ <span className="font-semibold text-slate-700">{displayDate}</span>
              </div>
            </div>

            <div className="border-b border-dashed border-slate-300" />

            {/* Transaction Rows */}
            <div className="space-y-2.5 text-xs sm:text-sm">
              
              {/* Receiver Row */}
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-500 font-medium whitespace-nowrap">প্রাপক (Receiver):</span>
                <div className="text-right font-bold text-slate-900 flex items-center justify-end gap-1 flex-wrap">
                  <span>{data.beneficiaryName || 'BNB সদস্য'}</span>
                  {data.beneficiaryAccount && (
                    <span className="text-slate-500 font-normal text-xs">(আইডি: {data.beneficiaryAccount})</span>
                  )}
                  {data.beneficiaryAccount && (
                    <button
                      onClick={() => handleCopy(data.beneficiaryAccount || '', 'receiver_id')}
                      className="p-1 hover:bg-slate-200 rounded text-slate-500 transition"
                      title="আইডি কপি করুন"
                    >
                      {copiedField === 'receiver_id' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Sender Phone or Beneficiary Phone Row */}
              {data.senderPhone && (
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500 font-medium">মোবাইল নম্বর:</span>
                  <div className="font-bold text-slate-900 flex items-center gap-1 font-mono">
                    <span>{data.senderPhone}</span>
                    <button
                      onClick={() => handleCopy(data.senderPhone || '', 'phone')}
                      className="p-1 hover:bg-slate-200 rounded text-slate-500 transition"
                      title="মোবাইল নম্বর কপি করুন"
                    >
                      {copiedField === 'phone' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Amount Row */}
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-500 font-medium">লেনদেন পরিমাণ (Amount):</span>
                <span className="font-extrabold text-slate-900 font-mono">৳{amountFormatted} BDT</span>
              </div>

              {/* Service Charge Row */}
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-500 font-medium">সার্ভিস চার্জ (Charge):</span>
                <span className="font-bold text-emerald-700">
                  {data.fee && data.fee > 0 ? `৳${feeFormatted} BDT` : '৳০.০০ (ফ্রি)'}
                </span>
              </div>

              {/* Total Deducted Row */}
              <div className="flex justify-between items-center gap-2 pt-1 border-t border-slate-200/60">
                <span className="text-slate-700 font-bold">মোট কেটে নেওয়া হয়েছে:</span>
                <span className="font-black text-slate-900 text-sm sm:text-base font-mono">৳{totalFormatted} BDT</span>
              </div>

            </div>

            <div className="border-b border-dashed border-slate-300" />

            {/* Transaction ID Box with One-Click Copy */}
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap">ট্রানজেকশন আইডি (TxID):</span>
              <div className="bg-emerald-100/80 border border-emerald-300/80 rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-emerald-900 font-mono font-bold text-xs sm:text-sm">
                <span>{data.transactionId || 'SENDBNB-937483'}</span>
                <button
                  onClick={() => handleCopy(data.transactionId || '', 'txid')}
                  className="p-1 hover:bg-emerald-200 rounded text-emerald-800 transition"
                  title="ট্রানজেকশন আইডি কপি করুন"
                >
                  {copiedField === 'txid' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Status Row */}
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">লেনদেন স্ট্যাটাস (Status):</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${
                isFailed 
                  ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                  : isPending 
                  ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}>
                <span>{isFailed ? 'ব্যর্থ (Failed)' : isPending ? 'অপেক্ষমান (Pending)' : 'সফল (Success)'}</span>
              </span>
            </div>

            {/* Footer Brand Seal inside receipt screenshot */}
            <div className="pt-2 text-center border-t border-slate-200/80">
              <div className="flex items-center justify-center space-x-1.5 text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                <span>Business Network Bangladesh (BNB)</span>
                <span>•</span>
                <span>ডিজিটাল লেনদেন সিস্টেম</span>
              </div>
            </div>

          </div>

          {/* Copy All Toast Feedback */}
          {copiedField === 'all_text' && (
            <div className="bg-slate-800 text-white text-xs font-bold py-1.5 px-3 rounded-xl text-center animate-in fade-in zoom-in duration-150">
              ✓ সমস্ত লেনদেন তথ্য ক্লিপবোর্ডে কপি হয়েছে!
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            
            {/* Download & Copy Buttons Row */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleDownloadImage}
                disabled={downloading}
                className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm active:scale-95 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{downloading ? 'ডাউনলোড হচ্ছে...' : 'ছবি ডাউনলোড'}</span>
              </button>

              <button
                onClick={handleCopyAllText}
                className="py-2.5 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs active:scale-95"
              >
                <Copy className="w-4 h-4 text-indigo-600" />
                <span>লেখা কপি করুন</span>
              </button>
            </div>

            {/* Primary Action Buttons (Matching Screenshot) */}
            <button
              onClick={() => {
                onClose();
                if (onNewTransaction) onNewTransaction();
              }}
              className="w-full py-3 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition shadow-3xs active:scale-[0.99]"
            >
              <Send className="w-4 h-4 text-indigo-600" />
              <span>নতুন লেনদেন করুন</span>
            </button>

            <button
              onClick={() => {
                onClose();
                if (onViewHistory) onViewHistory();
              }}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition shadow-sm active:scale-[0.99]"
            >
              <History className="w-4 h-4" />
              <span>লেনদেন খতিয়ান দেখুন</span>
            </button>

          </div>

        </div>

      </div>
    </div>
  );
};
export default BnbPaymentReceiptModal;
