export interface User {
  id?: string;
  uid: string;
  name: string;
  phone: string;
  normalizedPhone?: string;
  memberId: string;
  pin: string; // Stored PIN (e.g., 5-digit number)
  pinSet?: boolean;
  isPendingPin?: boolean;
  role: 'user' | 'admin' | 'sub_admin';
  subAdminPermissions?: string[]; // Array of permitted section IDs in Admin Panel
  balance: number; // Deposit-able wallet balance (Samity)
  lockedBalance: number; // Escrow locked balance
  pendingBalance: number; // Escrow pending balance
  telecomBalance?: number; // BNB Telecom balance
  superShopBalance?: number; // BNB Super Shop balance
  savings: number; // Accumulated savings
  dueLoan: number; // User's outstanding loan
  nid?: string;
  nidNumber?: string;
  userName?: string;
  birthReg?: string;
  fatherName?: string;
  motherName?: string;
  gender?: string;
  occupation?: string;
  alternatePhone?: string;
  emergencyPhone?: string;
  nomineeName?: string;
  nomineeRelation?: string;
  nomineePhone?: string;
  nomineeNid?: string;
  createdByUid?: string;
  createdByMemberId?: string;
  createdByMemberName?: string;
  referrerMemberId?: string;
  dob?: string;
  division?: string;
  district?: string;
  thana?: string;
  postOffice?: string;
  country?: string;
  village?: string;
  profilePic?: string;
  phoneChangeCount?: number;
  status?: 'active' | 'inactive';
  approved?: boolean; // Whether the user's account is verified and approved by admin
  membershipApproved?: boolean; // Whether member application is approved
  samityStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  samityApproved?: boolean;
  isSamityMember?: boolean;
  samityAppliedAt?: string;
  samityRejectReason?: string;
  createdAt: string;
  updatedAt?: any;
  cardLocked?: boolean; // Virtual Card Lock State
  hasSetProfile?: boolean; // User profile information has been set (locked for editing)
  nidFrontPic?: string;
  nidBackPic?: string;
  nidFrontUrl?: string;
  nidBackUrl?: string;
  kycStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  memberGroup?: 'general' | 'admin' | 'need'; // Qard Group
  dpsBalance?: number; // Accumulated DPS balance
  profitsBalance?: number; // Shared/Accumulated Co-op Profits
  email?: string; // Optional email for admin logins
  monthlySavingsTarget?: number; // User's custom or selected monthly savings target (min 500)
  biometricsEnabled?: boolean; // Whether physical/virtual biometrics are enabled
  fingerprintType?: 'display' | 'side'; // Preferred fingerprint scanner layout
  biometricCredentialId?: string; // Stored Credential ID for WebAuthn authentication
  isDemo?: boolean; // Whether user is a Guest/Demo preview session
  shares?: number; // Accumulated equity shares (1,000 savings = 1 share)
  lastPaidMonth?: string; // Last month paid for auto-debit (YYYY-MM)
  samityPaidMonths?: string[]; // Array of paid month keys (e.g., ['jan', 'feb', ...]) or numbers
  referredBy?: string; // Member ID or phone who referred this user
  customTelecomPercent?: number; // Personalized telecom recharge commission percentage
  currentDeviceId?: string; // Device ID locked to this account
  requestedDeviceId?: string; // New Device ID requested by the user
  deviceLockBypassed?: boolean; // Whether device lock is bypassed for this user
  deviceChangeRequested?: boolean; // Whether the user requested a device change approval
  deviceChangeRequestedAt?: string; // Timestamp when device change was requested
  isLoggedIn?: boolean; // Active logged in state for real-time zero device force logout
  forceLogoutAt?: string; // Force logout timestamp set by admin to force instant logout
  sessionLoggedInAt?: string; // Session login timestamp on the client side
  bnbCardNumber?: string;
  bnbAccountNumber?: string;
  bnbCardHolderName?: string;
  bnbCardExpiry?: string;
  bnbCardCvv?: string;
  bnbCardStatus?: 'active' | 'inactive';
  bnbCardIssuedAt?: string;
  bnbCardOtpLocked?: boolean;
  savedBnbCards?: SavedBnbCard[];
  latitude?: number;
  longitude?: number;
  fullAddress?: string;
  locationLastUpdated?: string;
  deviceStatus?: 'Online' | 'Offline';
  samitySchemeActive?: boolean;
  samityAutoSavingsActive?: boolean;
  samityDeactivateStatus?: 'pending' | 'approved' | 'rejected' | 'released';
  samityDeactivateReason?: string;
  samityDeactivateRequestedAt?: string;
  canDisableAutoSavings?: boolean; // Admin permission to allow member to turn off auto savings
  allowAutoSavingsToggle?: boolean; // Alias for admin permission
  lastDecSettlementYear?: number; // Track December annual savings return year
  dueMonths?: number;
  lastCoopInstantLoanAt?: string; // Timestamp of last instant 50% coop loan
  lastCoopInstantLoanAmount?: number; // Amount of last instant loan
  lastCoopInstantLoanRepaidAt?: string; // Timestamp when instant loan was fully repaid (cooldown starts from this date)
  lastAutoDeductedMonth?: string; // YYYY-MM string to track monthly auto-deduction
  instantLoanDurationMonths?: number; // Chosen duration (1, 2, or 3 months)
  instantLoanOriginalAmount?: number; // Original instant loan principle
  instantLoanTakenAt?: string; // ISO timestamp when instant loan was disbursed
  isAppLocked?: boolean; // 2nd Step custom Secret App Lock active status
  appLockCode?: string; // Custom 6-12 character/digit secret lock code
  appLockResetRequested?: boolean; // Whether user requested admin to unlock/reset app lock
  appLockResetRequestedAt?: string; // Timestamp of app lock reset request
  appLockResetStatus?: 'pending' | 'approved' | 'rejected'; // Admin approval status for app lock reset
  appLockResetReason?: string; // Optional message or note for unlock request
}

export interface ExchangeOrder {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorPhone: string;
  acceptorId?: string;
  acceptorName?: string;
  acceptorPhone?: string;
  status: 'pending' | 'accepted' | 'waiting_payment' | 'payment_sent' | 'payment_received' | 'second_payment_pending' | 'completed' | 'cancelled' | 'expired' | 'disputed';
  giveMethod: string;
  takeMethod: string;
  amount: number;
  rate: number;
  charge: number;
  createdAt: string;
  timerStartedAt?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  userName: string;
  memberId: string;
  type: 'deposit' | 'add_money' | 'loan_repayment' | 'loan_disbursment' | 'coop_loan_apply' | 'interest' | 'telecom_recharge' | 'shop_purchase' | 'utility' | 'fee_payment' | 'balance_transfer' | 'received_transfer' | 'withdraw' | 'qard_donation' | 'qard_loan_request' | 'qard_loan_disbursment' | 'qard_loan_repayment' | 'money_exchange' | 'qard_withdrawal' | 'coop_savings_deposit';
  typeLabel: string; // Bengali label of type
  amount: number;
  status: 'pending' | 'success' | 'failed';
  description: string;
  createdAt: string;
  paymentMethod?: string;  // bKash, Nagad, Rocket, CellFin, DBBL Bank
  senderInfo?: string;     // Sender number or sender account name
  transactionId?: string;  // Transaction TXN ID
  screenshot?: string;     // Base64-encoded image proof of payment
  paymentDate?: string;    // Placed payment date (YYYY-MM-DD)
  receiptNo?: string;      // Auto generated receipt number, e.g. REC-1718290333
  receiverUid?: string;    // Receiver's UID for pending transfers
  receiverId?: string;     // Receiver's Member ID for pending transfers
  receiverName?: string;   // Receiver's display name
  transferSector?: 'telecom' | 'shop' | 'samity'; // Transfer sector choice
  docId?: string;          // Real Firestore document ID for updates/deletes
  loanDuration?: number;   // Duration of loan in months
  whatsappNumber?: string; // WhatsApp number for loan request
  monthlyRepayAmount?: number; // Repayment amount they wish to pay per month
  adminNotice?: string;    // Custom notice from admin (e.g. pending/reject reason)
  userComment?: string;    // User comment or feedback
  category?: string;       // Category marker (e.g. coop_instant_auto_loan)
  rechargeCommission?: number; // Calculated commission during transaction submission
  rechargeCashback?: number; // Calculated cashback for specific amount rules
  balanceAfter?: number;   // Balance after transaction execution
  balanceBefore?: number;  // Balance before transaction execution
  userPhone?: string;
  senderPhone?: string;
  phone?: string;
  accountNumber?: string;
  phoneNumber?: string;
  trxId?: string;
  rejectReason?: string;
  processedAt?: string;
  approvedAt?: string;
  totalDeducted?: number;
  charge?: number;
  approvedCashback?: number;
  extraCommission?: number;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  section?: 'general' | 'telecom' | 'safe_deal' | 'samity' | 'bank' | 'shop';
  createdAt: string;
}

export interface AdminBroadcastLog {
  id: string;
  docId?: string;
  actionType: 'bonus' | 'fine' | 'notice';
  targetType: 'all' | 'single';
  targetUserName: string;
  targetUserPhone?: string;
  targetUserId?: string;
  amount: number;
  title: string;
  message: string;
  sentBy?: string;
  status?: string;
  createdAt: string;
}

export interface Offer {
  id: string;
  docId?: string;
  title: string;
  operator: string; // GP, Robi, Airtel, Banglalink, Teletalk, Skitto, Brilliant, Alaap
  category: 'internet' | 'minute' | 'bundle';
  validity: string;
  price: number;
  regularPrice?: number;
  commission?: number; // Commission amount in ৳
  isHot: boolean;
  createdAt: string;
}

export interface BapReport {
  id: string;
  accusedName: string;
  accusedPhone: string;
  accusedPhoto?: string;
  type: 'fraud' | 'late_payment' | 'warning' | 'suspicious';
  details: string;
  proofScreenshot?: string;
  createdAt: string;
  reporterName: string;
  reporterId: string;
  groupName: string;
  status?: 'pending' | 'solved';
  editHistory?: { editedAt: string; previousDetails: string; editedBy: string }[];
  auditLogs?: string[];
}

export interface BapGroup {
  id: string;
  name: string;
  link: string;
  category: string;
  adminsInfo: string;
  memberCount: number;
  foundedDate: string;
  status: 'pending' | 'verified' | 'rejected';
  verificationId?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface BapAdminRequest {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  groupName: string;
  details: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface ReceiptTypeConfig {
  themeColor?: 'emerald' | 'purple' | 'indigo' | 'amber' | 'rose' | 'slate';
  headerTitle?: string;
  badgeText?: string;
  noticeText?: string;
}

export interface ReceiptConfig {
  headerTitle?: string;
  companyName?: string;
  organizationDetails?: string;
  officialTagText?: string;
  adminSignatureName?: string;
  adminSignatureTitle?: string;
  footerVerificationText?: string;
  footerComputerGeneratedText?: string;
  typeConfigs?: {
    add_money?: ReceiptTypeConfig;
    send_money?: ReceiptTypeConfig;
    withdraw?: ReceiptTypeConfig;
    telecom_recharge?: ReceiptTypeConfig;
    shop_purchase?: ReceiptTypeConfig;
    deposit?: ReceiptTypeConfig;
    qard_loan?: ReceiptTypeConfig;
    [key: string]: ReceiptTypeConfig | undefined;
  };
}

export interface CompanyFundAccount {
  id: string;
  accountName: string; // e.g. "আমার একাউন্ট (আব্দুল্লাহ)", "বউয়ের একাউন্ট", "ভাইয়ের একাউন্ট", "ইসলামী ব্যাংক"
  accountType?: string; // e.g. "ব্যক্তিগত", "ব্যাংক", "বিকাশ", "নগদ", "রকেট", "ক্যাশ হাতে"
  accountDetails?: string; // e.g. "AC: 1234567890", "মোবাইল: 01700000000"
  amount: number;
  note?: string;
  updatedAt?: string;
}

export interface QardRuleItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  isWarning?: boolean;
}

export interface QardVerificationNotice {
  title: string;
  body: string;
  warningNote?: string;
}

export interface QardEligibilityConfig {
  requiredActiveDays: number;
  requiredBnbTxVolume: number;
  trackerTitle?: string;
  trackerSubtitle?: string;
}

export interface QardCoopInstantLoanConfig {
  enabled: boolean;
  percentage: number;
  maxDurationMonths: number;
  cooldownDays: number;
  title?: string;
  description?: string;
  takeStartDay?: number; // Start day of month for loan taking (default 1)
  takeEndDay?: number;   // End day of month for loan taking (default 25)
  autoDeductStartDay?: number; // Start day of month for auto deduction (default 1)
  autoDeductEndDay?: number;   // End day of month for auto deduction (default 9)
  month1Ratio?: number; // 1st installment % for 3 months (default 40)
  month2Ratio?: number; // 2nd installment % for 3 months (default 35)
  month3Ratio?: number; // 3rd installment % for 3 months (default 25)
}

export interface QardConfig {
  rulesTitle?: string;
  rulesSubtitle?: string;
  rulesList?: QardRuleItem[];
  verificationNotice?: QardVerificationNotice;
  eligibilityConfig?: QardEligibilityConfig;
  minLoanAmount?: number;
  maxLoanAmount?: number;
  maxDurationMonths?: number;
  coopInstantLoanConfig?: QardCoopInstantLoanConfig;
}

export interface SamityFineTier {
  id: string;
  fromDay: number;
  toDay: number;
  rangeLabel: string;
  fineText: string;
  fineAmount: number;
  bgClass?: string;
  isDaily?: boolean;
}

export interface SamityPolicyConfig {
  policyTitle?: string;
  policySubTitle?: string;
  schemeStatusNote?: string;
  fixedAmountTitle?: string;
  fixedAmountNote?: string;
  penaltyTitle?: string;
  penaltyTiers?: SamityFineTier[];
  customRules?: string[];
  pausePenaltyUntil15th?: boolean;
  penaltyExemptionUntilDay?: number;
  penaltyExemptionNote?: string;
}

export interface AppConfig {
  allowProfileSelfEdit?: boolean; // Whether members are allowed to edit/update their own profile info
  phoneChangeConfig?: {
    enabled?: boolean;
    freeDaysAfterRegistration?: number;
    freeAttempts?: number;
    feeIncrement?: number;
    maxFee?: number;
  };
  telecomReportResetAt?: string;
  manualApprovalEnabled?: boolean;
  autoApproveSomiti?: boolean;
  autoApproveSamity?: boolean;
  autoApproveDeviceLocks?: boolean;
  autoApprovePhoneChange?: boolean;
  autoApproveAgentRequests?: boolean;
  autoApproveSamityTxs?: boolean;
  allowManualAgentLocation?: boolean;
  historyRetentionDays?: number; // Configurable History Retention Period (e.g. 30, 90, 180, 365)
  sectionNotices?: Record<string, string>;
  receiptConfig?: ReceiptConfig;
  appName: string;
  personalMfsNumber: string;
  personalBankCard: string;
  supportPhone: string;
  telecomHelplinePhone?: string;
  telecomHelplineFacebook?: string;
  telecomHelplineNotice?: string;
  samityTerms: string;
  samityPolicyConfig?: SamityPolicyConfig;
  tickerText: string;
  noticeText?: string;
  initialCompanyFund?: number;
  samityTicker?: string;
  qardTicker?: string;
  qardConfig?: QardConfig;
  telecomTicker?: string;
  safiTicker?: string;
  escrowTicker?: string;
  rationTicker?: string;
  agentTicker?: string;
  courierTicker?: string;
  gatewayTicker?: string;
  exchangeRatePerThousand: number;
  exchangeRateSaudi?: number;
  // NEW FIELDS
  addMoneyBankCashbackPerThousand?: number;
  sendMoneyMobileBankFlatCharge?: number;
  sendMoneyMobileBankServiceChargePerThousand?: number;
  sendMoneyBankFlatCharge?: number;
  sendMoneyBankServiceChargePerThousand?: number;
  internationalExchangeRate?: number;
  companyReserveFund?: number; // Company Gross Starting Reserve Capital
  companyFundAccounts?: CompanyFundAccount[]; // Detailed account breakdown (e.g. spouse, brother, personal, bank)
  masterFundAccounts?: any[]; // Master Fund detailed account breakdown
  manualFundAdjustments?: Record<string, number>; // Manual overrides/adjustments for company fund balance modules
  // END NEW FIELDS
  logoUrl?: string;
  serviceStatus?: Record<string, boolean>;
  dashboardBanners?: { id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[];
  qardBanners?: { id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[];
  samityBanners?: { id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[];
  telecomBanners?: { id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[];
  moneyExchangeBanners?: { id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[];
  rationBanners?: { id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[];
  safiBanners?: { id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[];
  agentBanners?: { id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[];
  courierBanners?: { id: number; tag: string; title: string; description: string; bgGradient: string; image: string; }[];
  rationMaxSelectLimit?: number;
  rationTitleText?: string;
  rationTotalItemsText?: string;
  escrowCoverUrl?: string;
  mobileRechargePercent?: number;
  alaapRechargePercent?: number;
  brilliantRechargePercent?: number;
  rechargeCashbackRules?: { id?: string; amount: number; cashback: number; operator?: string }[];
  telecomDefaultSlabs?: { amount: number; cashback: number }[];
  telecomOperatorCashbacks?: Record<string, { slab1: number; slab2: number; slab3: number; slab4: number }>;
  mfsBkashNumber?: string;
  mfsBkashActive?: boolean;
  mfsNagadNumber?: string;
  mfsNagadActive?: boolean;
  mfsRocketNumber?: string;
  mfsRocketActive?: boolean;
  mfsUpayNumber?: string;
  mfsUpayActive?: boolean;
  paymentBanks?: {
    id: string;
    name: string;
    acronym: string;
    branch: string;
    routingNum: string;
    holder: string;
    accNum: string;
    visaNum?: string;
    active: boolean;
    bgClass?: string;
    textClass?: string;
    logoBgClass?: string;
    isInternational?: boolean;
    isMobileBank?: boolean;
    qrCodeUrl?: string;
    iban?: string;
  }[];
  bnbToBnbFreeActive?: boolean;
  bnbToBnbMinLimit?: number;
  bnbToBnbMaxLimit?: number;
  billPayActive?: boolean;
  billPayFeePercent?: number;
  salaryPayActive?: boolean;
  salaryPayFee?: number;
  remittanceRates?: Record<string, number>;
  shopCategories?: { id: string; label: string; }[];
  telecomCategories?: { id: string; label: string; }[];
  telecomServicesConfig?: Record<string, {
    title: string;
    icon?: string;
    subtitle?: string;
    isActive?: boolean;
    cashbackPercent?: number;
  }>;
  moneyExchangeRatesConfig?: {
    enabled?: boolean;
    noticeText?: string;
    flatFee?: number;
    rates?: {
      countryCode: string;
      countryName: string;
      currencyCode: string;
      flagEmoji?: string;
      bdtRate: number;
      minAmount?: number;
      maxAmount?: number;
      cashback?: number;
    }[];
  };
  coopLoanInterestRate?: number;
  remittanceFeePercent?: number;
  globalTexts?: Record<string, string>;
  tickerTextEn?: string; // English translation ticker
  maintenanceMode?: boolean;
  maintenanceTitle?: string;
  maintenanceDescription?: string;
  maintenanceEstimatedTime?: string;
  maintenanceAnimationUrl?: string;
  maintenanceLogoUrl?: string;
  maintenanceBgUrl?: string;
  forceUpdateActive?: boolean;
  minAppVersion?: string;
  latestAppVersion?: string;
  downloadLink?: string;
  updateTitle?: string;
  updateDescription?: string;
  safiProductOverrides?: Record<string, { 
    price: number; 
    stock: string; 
    name?: string; 
    desc?: string; 
    brand?: string; 
    image?: string; 
    emoji?: string; 
  }>;
  sliders?: string[];
  oneSignalAppId?: string;
  oneSignalRestApiKey?: string;
  sectionIcons?: Record<string, string>;
  bnbToBnbIconUrl?: string;
  softwareIntegrations?: Record<string, {
    sectionKey: string;
    softwareName: string;
    apiEndpoint: string;
    authToken?: string;
    webhookUrl?: string;
    requestMethod?: string;
    contentType?: string;
    customHeaders?: Record<string, string>;
    mappedFields?: Record<string, string>;
    isActive: boolean;
    lastUpdated?: string;
  }>;
  corporateGuide?: {
    rules: string;
    futurePlans: string;
    mission: string;
    feedback: string;
  };
  bannerHeightType?: 'thin' | 'medium' | 'thick' | 'custom' | '16:9' | '21:9' | '32:9';
  bannerHeightValue?: number; // Custom height in pixels (e.g. 100 to 400)
  bottomNavHeightType?: 'thin' | 'medium' | 'thick';
  bottomNavTabs?: string[]; // list of active tab keys (e.g. ['home', 'deposit', 'history', 'profile'])
  gridColsCount?: number; // 2, 3, 4, 5 columns
  gridIconSize?: 'small' | 'medium' | 'large' | 'custom';
  gridIconSizeValue?: number; // Icon size diameter in pixels
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  icon: string;
  description: string;
  rating: number;
  minOrder: string;
  supplier: string;
  flag: string;
  shipTime: string;
  createdAt?: string;
  imageUrl?: string;
  oldPrice?: number;
  latitude?: number;
  longitude?: number;
  shopAddress?: string;
}

export interface UserNotification {
  id: string;
  docId?: string;
  userId: string;
  memberId: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  isPersonal?: boolean;
  isAdminBroadcast?: boolean;
  isTransactionHistory?: boolean;
  category?: string;
  notifyType?: 'info' | 'credit' | 'debit';
  amount?: number;
  type?: 'bonus' | 'fine' | 'notice' | 'general';
}

export interface PaymentMethod {
  id: string;
  methodName: string; // e.g., 'bKash', 'Nagad', 'DBBL'
  accountName: string;
  accountNumber: string;
  type: 'mfs' | 'bank'; // Mobile Financial Service or Bank
  active: boolean;
}

export interface SavedBnbCard {
  id: string;
  name: string; // e.g. "ভাইয়ের কার্ড"
  cardNumber: string;
  expiry: string; // MM/YY
  cvv: string;
}

export const SAMITY_MONTHS = [
  { id: 'jan', monthNum: 1, name: 'জানুয়ারি', short: 'Jan' },
  { id: 'feb', monthNum: 2, name: 'ফেব্রুয়ারি', short: 'Feb' },
  { id: 'mar', monthNum: 3, name: 'মার্চ', short: 'Mar' },
  { id: 'apr', monthNum: 4, name: 'এপ্রিল', short: 'Apr' },
  { id: 'may', monthNum: 5, name: 'মে', short: 'May' },
  { id: 'jun', monthNum: 6, name: 'জুন', short: 'Jun' },
  { id: 'jul', monthNum: 7, name: 'জুলাই', short: 'Jul' },
  { id: 'aug', monthNum: 8, name: 'আগস্ট', short: 'Aug' },
  { id: 'sep', monthNum: 9, name: 'সেপ্টেম্বর', short: 'Sep' },
  { id: 'oct', monthNum: 10, name: 'অক্টোবর', short: 'Oct' },
  { id: 'nov', monthNum: 11, name: 'নভেম্বর', short: 'Nov' },
  { id: 'dec', monthNum: 12, name: 'ডিসেম্বর', short: 'Dec' },
];

export const SAMITY_YEARS = Array.from({ length: 2050 - 2026 + 1 }, (_, i) => 2026 + i);

export interface PhoneChangeRequest {
  id: string;
  userId: string;
  userName: string;
  memberId?: string;
  currentPhone: string;
  newPhone: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  processedAt?: string;
  rejectionReason?: string;
}



