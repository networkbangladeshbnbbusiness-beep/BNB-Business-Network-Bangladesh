import React, { useRef, useState } from 'react';
import { 
  Copy, 
  Check, 
  X, 
  ArrowLeft,
  Clock,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface PaymentReceiptData {
  transactionId?: string;
  typeLabel?: string;
  amount: number;
  fee?: number;
  totalAmount?: number;
  status?: 'success' | 'pending' | 'completed' | 'failed' | 'rejected';
  
  // Beneficiary / Receiver / Member details
  beneficiaryName?: string;
  beneficiaryAccount?: string; // ID or Account No
  senderPhone?: string;
  phone?: string;
  userPhone?: string;
  
  // Bank details if applicable
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  branch?: string;
  branchName?: string;
  routingNumber?: string;
  routingNo?: string;
  
  // Extra details
  paymentMethod?: string;
  transactionDate?: string;
  createdAt?: string;
  description?: string;
  adminNotice?: string;
  foreignAmount?: number;
  netForeignAmount?: number;
  foreignCurrency?: string;
  exchangeRate?: number;
  bdtAmount?: number;
  remittanceIncentiveRate?: number;
  remittanceIncentiveAmount?: number;
  remittanceTransferFee?: number;
  totalRemittancePayout?: number;
  beneficiaryBankName?: string;
  beneficiaryAccountNo?: string;
  beneficiaryBranch?: string;
  beneficiaryDistrict?: string;
  beneficiaryPhone?: string;
  beneficiaryRelation?: string;
  grossAmount?: number;
  feeBdt?: number;
  remittanceFee?: number;
}

interface BNBPaymentReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PaymentReceiptData | null;
  appLogo?: string;
  onNewTransaction?: () => void;
  onViewHistory?: () => void;
}

export const BNBPaymentReceiptModal: React.FC<BNBPaymentReceiptModalProps> = ({
  isOpen,
  onClose,
  data,
  appLogo,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const isPending = data?.status === 'pending';
  const isFailed = data?.status === 'failed' || data?.status === 'rejected';
  const isSuccess = data?.status === 'success' || data?.status === 'completed' || (data && !isPending && !isFailed);

  const amountNum = Number(data?.amount || 0);
  const feeNum = Number(data?.fee || 0);
  const totalNum = Number(data?.totalAmount || (amountNum + feeNum));

  const amountFormatted = amountNum.toFixed(2);
  const feeFormatted = feeNum.toFixed(2);
  const totalFormatted = totalNum.toFixed(2);

  const displayPhone = data?.senderPhone || data?.phone || data?.userPhone || '01600664081';
  const receiverName = data?.beneficiaryName || data?.accountName || 'Md rasel mia';
  const receiverId = data?.beneficiaryAccount || 'BNB00000001';
  const txId = data?.transactionId || 'DJDOVRAY8U';

  const rawDate = data?.transactionDate || data?.createdAt;
  const displayDate = rawDate 
    ? (new Date(rawDate).toString() !== 'Invalid Date' 
        ? new Date(rawDate).toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          }) 
        : rawDate)
    : new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });

  const logoSrc = appLogo || '/logo.png';

  // Generate Serialized text for clipboard copy
  const generateSerializedReceiptText = () => {
    const statusText = isPending 
      ? 'অপেক্ষমাণ (Pending)' 
      : isSuccess 
        ? 'সফল (Success / Approved)' 
        : 'বাতিল (Rejected / Failed)';

    let lines: string[] = [
      '🧾 লেনদেন রসিদ (BNB Digital Network)',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `গ্রাহক (Receiver): ${receiverName} (আইডি: ${receiverId})`,
      `মোবাইল নম্বর: ${displayPhone}`,
      `লেনদেন পরিমাণ (Amount): ৳${amountFormatted} BDT`,
      `সার্ভিস চার্জ (Charge): ${feeNum > 0 ? `৳${feeFormatted} BDT` : '৳0.00 (ফ্রি)'}`,
      `মোট কেটে নেওয়া হয়েছে: ৳${totalFormatted} BDT`,
      `ট্রানজেকশন আইডি (TxID): ${txId}`,
      `লেনদেন স্ট্যাটাস (Status): ${statusText}`,
      `তারিখ: ${displayDate}`,
      'BUSINESS NETWORK BANGLADESH (BNB) • ডিজিটাল লেনদেন সীমিত',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    ];

    return lines.join('\n');
  };

  const handleCopy = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopyAllText = () => {
    const textToCopy = generateSerializedReceiptText();
    navigator.clipboard.writeText(textToCopy);
    setCopiedField('all_text');
    setTimeout(() => setCopiedField(null), 3000);
  };

  return (
    <AnimatePresence>
      {isOpen && data && (
        <div className="fixed inset-0 z-[100000] flex flex-col bg-slate-900/60 backdrop-blur-sm">
          {/* Notification Clear Space (Top margin) */}
          <div className="h-5 sm:h-7 shrink-0 bg-[#004a2c] w-full"></div>

          <motion.div 
            initial={{ y: "100%" }} 
            animate={{ y: 0 }} 
            exit={{ y: "100%" }} 
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="flex-1 bg-white rounded-t-[28px] flex flex-col overflow-hidden text-left"
          >
            {/* Header */}
            <div className="bg-[#004a2c] text-white px-5 py-2.5 sm:py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-white/10 rounded-xl">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">লেনদেন রসিদ</h3>
                  <p className="text-[9px] text-emerald-200 uppercase tracking-widest font-bold">Transaction Receipt</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Body - Vertically centered & balanced to fit on one screen */}
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col">
              <div className="my-auto w-full max-w-md mx-auto space-y-3">
                {/* 1. Official Logo & Header Heading */}
                <div className="text-center space-y-1.5">
                  <div className="flex justify-center">
                    <img 
                      src={logoSrc} 
                      alt="BNB Official Logo" 
                      className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/app_icon.png';
                      }}
                    />
                  </div>

                  <h2 className="text-lg sm:text-xl font-black text-[#004a2c] tracking-tight leading-tight">
                    {isPending 
                      ? 'লেনদেন আবেদনটি জমা হয়েছে!' 
                      : isFailed 
                        ? 'লেনদেন আবেদনটি বাতিল হয়েছে!' 
                        : 'লেনদেন সফলভাবে সম্পন্ন হয়েছে!'}
                  </h2>

                  <div className="flex justify-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#004a2c] text-white rounded-full text-[10px] sm:text-[11px] font-bold font-mono shadow-xs">
                      <Clock className="w-3 h-3 text-emerald-200" />
                      <span>তারিখ: {displayDate}</span>
                    </div>
                  </div>
                </div>

                {/* 2. THE RECEIPT CONTAINER */}
                <div 
                  ref={receiptRef}
                  className="border-2 border-emerald-700/25 rounded-3xl px-4 py-3 bg-slate-50/70 space-y-1.5 text-xs sm:text-sm font-sans w-full shadow-xs"
                >
                  {/* Row 1: Receiver */}
                  <div className="flex justify-between items-center py-1 border-b border-emerald-100/80 gap-2">
                    <span className="font-bold text-slate-500 text-[11px] shrink-0">গ্রাহক (Receiver):</span>
                    <div className="font-black text-slate-900 text-right flex items-center justify-end gap-1 min-w-0">
                      <span className="truncate">{receiverName}</span>
                      {receiverId && (
                        <span className="text-[10px] font-mono font-bold text-slate-500 shrink-0">({receiverId})</span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopy(`${receiverName} ${receiverId}`, 'receiver')}
                        className="p-1 hover:bg-emerald-100 rounded text-emerald-600 transition cursor-pointer shrink-0"
                      >
                        {copiedField === 'receiver' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Mobile Number */}
                  <div className="flex justify-between items-center py-1 border-b border-emerald-100/80 gap-2">
                    <span className="font-bold text-slate-500 text-[11px] shrink-0">মোবাইল নম্বর:</span>
                    <div className="font-mono font-black text-slate-900 flex items-center gap-1 text-xs sm:text-sm">
                      <span>{displayPhone}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(displayPhone, 'phone')}
                        className="p-1 hover:bg-emerald-100 rounded text-emerald-600 transition cursor-pointer"
                      >
                        {copiedField === 'phone' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Row 3: Amount */}
                  <div className="flex justify-between items-center py-1 border-b border-emerald-100/80 gap-2">
                    <span className="font-bold text-slate-500 text-[11px] shrink-0">লেনদেন পরিমাণ (Amount):</span>
                    <span className="font-mono font-black text-slate-900 text-sm sm:text-base">
                      ৳{amountFormatted} BDT
                    </span>
                  </div>

                  {/* Row 4: Service Charge */}
                  <div className="flex justify-between items-center py-1 border-b border-emerald-100/80 gap-2">
                    <span className="font-bold text-slate-500 text-[11px] shrink-0">সার্ভিস চার্জ (Charge):</span>
                    <span className="font-extrabold text-emerald-700 text-xs sm:text-sm">
                      {feeNum > 0 ? `৳${feeFormatted} BDT` : '৳0.00 (ফ্রি)'}
                    </span>
                  </div>

                  {/* Row 5: Total Deducted */}
                  <div className="flex justify-between items-center py-1 border-b border-dashed border-emerald-200 gap-2">
                    <span className="font-black text-slate-900 text-[11px] shrink-0">মোট পরিশোধিত:</span>
                    <span className="font-mono font-black text-[#004a2c] text-base sm:text-lg">
                      ৳{totalFormatted} BDT
                    </span>
                  </div>

                  {/* Row 6: TxID Box */}
                  <div className="flex justify-between items-center py-1 gap-2">
                    <span className="font-bold text-slate-500 text-[11px] shrink-0">ট্রানজেকশন আইডি (TxID):</span>
                    <div className="bg-white border border-emerald-200 rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-emerald-800 font-mono font-black text-xs shadow-2xs">
                      <span className="truncate max-w-[140px] sm:max-w-none">{txId}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(txId, 'txid')}
                        className="p-0.5 hover:bg-emerald-50 rounded text-emerald-600 transition cursor-pointer shrink-0"
                      >
                        {copiedField === 'txid' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Row 7: Status */}
                  <div className="flex justify-between items-center py-1 gap-2">
                    <span className="font-bold text-slate-500 text-[11px] shrink-0">লেনদেন স্ট্যাটাস (Status):</span>
                    <span
                      className={`px-3 py-0.5 rounded-full text-[11px] font-black border ${
                        isPending
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : isSuccess
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-rose-50 text-rose-800 border-rose-300'
                      }`}
                    >
                      {isPending ? 'অপেক্ষমাণ (Pending)' : isSuccess ? 'সফল (Success)' : 'বাতিল (Failed)'}
                    </span>
                  </div>

                  {/* Brand Footer */}
                  <div className="pt-1.5 text-center border-t border-dashed border-emerald-200 text-[9.5px] font-bold text-emerald-700 uppercase tracking-wider leading-snug">
                    BUSINESS NETWORK BANGLADESH (BNB) • ডিজিটাল লেনদেন রসিদ
                  </div>
                </div>

                {/* Action Buttons (Side-by-side 2 columns on all screens) */}
                <div className="grid grid-cols-2 gap-2.5 w-full pt-0.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="py-2.5 sm:py-3 bg-[#004a2c]/10 hover:bg-[#004a2c]/15 text-[#004a2c] border border-[#004a2c]/20 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>ফিরে যান</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyAllText}
                    className="py-2.5 sm:py-3 bg-[#004a2c] hover:bg-[#003a22] text-white rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 transition shadow-md shadow-emerald-900/20 cursor-pointer active:scale-98"
                  >
                    {copiedField === 'all_text' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedField === 'all_text' ? 'কপি হয়েছে!' : 'লেখা কপি করুন'}</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default BNBPaymentReceiptModal;

