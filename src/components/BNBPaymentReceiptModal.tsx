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
          <div className="h-10 shrink-0 bg-[#004a2c] w-full"></div>

          <motion.div 
            initial={{ y: "100%" }} 
            animate={{ y: 0 }} 
            exit={{ y: "100%" }} 
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="flex-1 bg-white rounded-t-[32px] flex flex-col overflow-hidden text-left"
          >
            {/* Header */}
            <div className="bg-[#004a2c] text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">লেনদেন রসিদ</h3>
                  <p className="text-[10px] text-emerald-200 uppercase tracking-widest font-bold">Transaction Receipt</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition cursor-pointer">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Receipt Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 1. Official Logo & Header Heading */}
              <div className="text-center space-y-4">
                {/* Centered Official Logo */}
                <div className="flex justify-center">
                  <img 
                    src={logoSrc} 
                    alt="BNB Official Logo" 
                    className="w-24 h-24 sm:w-32 sm:h-32 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/app_icon.png';
                    }}
                  />
                </div>

                {/* Heading in green text */}
                <h2 className="text-xl sm:text-2xl font-black text-[#004a2c] tracking-tight leading-tight">
                  {isPending 
                    ? 'লেনদেন আবেদনটি জমা হয়েছে!' 
                    : isFailed 
                      ? 'লেনদেন আবেদনটি বাতিল হয়েছে!' 
                      : 'লেনদেন সফলভাবে সম্পন্ন হয়েছে!'}
                </h2>

                {/* Date & Time Pill Badge */}
                <div className="flex justify-center">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-full text-[11px] font-bold font-mono">
                    <Clock className="w-3.5 h-3.5" />
                    <span>তারিখ: {displayDate}</span>
                  </div>
                </div>
              </div>

              {/* 2. THE RECEIPT CONTAINER */}
              <div 
                ref={receiptRef}
                className="border-2 border-emerald-100 rounded-[2rem] p-6 bg-slate-50/50 space-y-4 text-sm sm:text-base font-sans max-w-lg mx-auto w-full"
              >
                {/* Row 1: Receiver */}
                <div className="flex justify-between items-center py-2 border-b border-emerald-100/60 gap-3">
                  <span className="font-bold text-slate-500 text-xs uppercase tracking-wider">গ্রাহক (Receiver)</span>
                  <div className="font-black text-slate-900 text-right flex items-center justify-end gap-1.5 min-w-0">
                    <span className="truncate">{receiverName}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(`${receiverName} ${receiverId}`, 'receiver')}
                      className="p-1 hover:bg-emerald-100 rounded text-emerald-600 transition cursor-pointer shrink-0"
                    >
                      {copiedField === 'receiver' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Row 2: Mobile Number */}
                <div className="flex justify-between items-center py-2 border-b border-emerald-100/60 gap-3">
                  <span className="font-bold text-slate-500 text-xs uppercase tracking-wider">মোবাইল নম্বর</span>
                  <div className="font-mono font-black text-slate-900 flex items-center gap-1.5">
                    <span>{displayPhone}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(displayPhone, 'phone')}
                      className="p-1 hover:bg-emerald-100 rounded text-emerald-600 transition cursor-pointer"
                    >
                      {copiedField === 'phone' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Row 3: Amount */}
                <div className="flex justify-between items-center py-2 border-b border-emerald-100/60 gap-3">
                  <span className="font-bold text-slate-500 text-xs uppercase tracking-wider">লেনদেন পরিমাণ</span>
                  <span className="font-mono font-black text-slate-900 text-lg">
                    ৳{amountFormatted} BDT
                  </span>
                </div>

                {/* Row 4: Service Charge */}
                <div className="flex justify-between items-center py-2 border-b border-emerald-100/60 gap-3">
                  <span className="font-bold text-slate-500 text-xs uppercase tracking-wider">চার্জ (Charge)</span>
                  <span className="font-extrabold text-emerald-700">
                    {feeNum > 0 ? `৳${feeFormatted} BDT` : '৳0.00 (ফ্রি)'}
                  </span>
                </div>

                {/* Row 5: Total Deducted */}
                <div className="flex justify-between items-center py-2 border-b border-emerald-100/60 gap-3">
                  <span className="font-black text-slate-900 text-xs uppercase tracking-wider">মোট পরিশোধিত</span>
                  <span className="font-mono font-black text-[#004a2c] text-xl">
                    ৳{totalFormatted} BDT
                  </span>
                </div>

                {/* Row 6: TxID Box */}
                <div className="flex justify-between items-center py-2 gap-3">
                  <span className="font-bold text-slate-500 text-xs uppercase tracking-wider">ট্রানজেকশন আইডি</span>
                  <div className="bg-white border border-emerald-100 rounded-xl px-3 py-1.5 flex items-center gap-2 text-emerald-800 font-mono font-black text-sm shadow-sm">
                    <span>{txId}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(txId, 'txid')}
                      className="p-1 hover:bg-emerald-50 rounded text-emerald-600 transition cursor-pointer"
                    >
                      {copiedField === 'txid' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Status */}
                <div className="pt-2 text-center border-t border-emerald-100/60 text-[10px] sm:text-xs font-bold text-emerald-600 uppercase tracking-widest leading-relaxed">
                  BUSINESS NETWORK BANGLADESH (BNB)
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto w-full pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-sm font-black flex items-center justify-center gap-2.5 transition cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span>ফিরে যান</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyAllText}
                  className="py-4 bg-[#004a2c] hover:bg-[#003a22] text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2.5 transition shadow-lg shadow-emerald-900/20 cursor-pointer"
                >
                  {copiedField === 'all_text' ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  <span>রসিদ কপি করুন</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default BNBPaymentReceiptModal;

