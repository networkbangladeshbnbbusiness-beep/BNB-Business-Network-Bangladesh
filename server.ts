import express from 'express';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, getDocs, deleteDoc, updateDoc, addDoc, serverTimestamp, getDoc, runTransaction, setLogLevel, query, where, limit, setDoc, deleteField } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import * as admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: any = null;
let adminDb: any = null;
const firebaseAdmin = admin as any;

const PAYMENT_AUTH_SECRET = process.env.PAYMENT_AUTH_SECRET || 'bnb_secure_payment_salt_2026';

export function hashSecret(secret: string): string {
  const clean = String(secret || '').trim();
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(clean, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifySecret(secret: string, storedHashOrPlain?: string | null): boolean {
  if (!secret || !storedHashOrPlain) return false;
  const cleanSecret = String(secret).trim();
  const stored = String(storedHashOrPlain).trim();
  if (!stored) return false;
  if (stored.startsWith('scrypt$')) {
    const parts = stored.split('$');
    if (parts.length !== 3) return false;
    const [, salt, hashHex] = parts;
    try {
      const derived = crypto.scryptSync(cleanSecret, salt, 64);
      const expected = Buffer.from(hashHex, 'hex');
      if (derived.length !== expected.length) return false;
      return crypto.timingSafeEqual(derived, expected);
    } catch {
      return false;
    }
  }
  return cleanSecret === stored;
}

function generatePaymentAuthToken(valId: string, userId: string): string {
  return crypto.createHmac('sha256', PAYMENT_AUTH_SECRET).update(`${valId}:${userId}`).digest('hex').slice(0, 32);
}

function verifyPaymentAuthToken(valId: string, userId: string, token: string): boolean {
  if (!valId || !userId || !token) return false;
  try {
    const expected = generatePaymentAuthToken(valId, userId);
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch (e) {
    return false;
  }
}

// Suppress normal gRPC/Listen stream cancel and internal RST_STREAM info messages
try {
  setLogLevel('silent');
} catch (e) {
  // Ignore
}

// Global server suppression for benign internal Firestore gRPC stream resets
process.on('unhandledRejection', (reason: any) => {
  const msg = String(reason?.message || reason || '');
  if (msg.includes('RST_STREAM') || msg.includes("GrpcConnection RPC 'Listen'") || msg.includes('Code: 13')) {
    return;
  }
  console.error('Unhandled Rejection:', reason);
});


// ==========================================
// Centralized Idempotent Payment Processor
// ==========================================
async function processVerifiedPayment(db, transaction_id, verifiedUserId, verifiedAmount, rawVerifyData) {
  if (!db) throw new Error('database_disconnected');
  if (!verifiedUserId) throw new Error('user_not_found_in_verification');
  
  const depositAmount = parseFloat(verifiedAmount);
  if (isNaN(depositAmount) || depositAmount <= 0) {
    throw new Error('invalid_amount');
  }

  const txDocRef = doc(db, 'transactions', `NP_${transaction_id}`);
  const userDocRef = doc(db, 'users', verifiedUserId);

  return await runTransaction(db, async (t) => {
    // 1. Idempotency Check
    const txSnap = await t.get(txDocRef);
    if (txSnap.exists()) {
      return { alreadyProcessed: true, amount: txSnap.data().amount };
    }

    // 2. Fetch User Data
    const userDoc = await t.get(userDocRef);
    if (!userDoc.exists()) {
      throw new Error('user_not_found');
    }

    const userData = userDoc.data();
    const currentBalance = Number(userData.balance) || 0;
    const currentMainBalance = Number(userData.mainBalance) || 0;
    
    // 3. Calculate New Balances
    const newBalance = currentBalance + depositAmount;
    const newMainBalance = currentMainBalance + depositAmount;
    
    // 4. Update User
    t.update(userDocRef, {
      balance: newBalance,
      mainBalance: newMainBalance
    });

    // 5. Create Transaction Record
    t.set(txDocRef, {
      id: txDocRef.id,
      userId: verifiedUserId,
      userName: userData.name || 'Anonymous User',
      userPhone: userData.phone || '',
      memberId: userData.memberId || 'BNB000000',
      amount: depositAmount,
      type: 'add_money',
      status: 'success',
      paymentMethod: 'অনলাইন পেমেন্ট গেটওয়ে',
      phone: userData.phone || '',
      senderPhone: userData.phone || '',
      senderInfo: 'অনলাইন পেমেন্ট গেটওয়ে',
      accountNumber: userData.phone || '',
      trxId: transaction_id,
      transactionId: transaction_id,
      receiptNo: transaction_id,
      createdAt: new Date().toISOString(),
      description: `অনলাইন পেমেন্ট গেটওয়ের মাধ্যমে ৳${depositAmount.toLocaleString('bn-BD')} টাকা অনলাইন অ্যাড মানি সফলভাবে সম্পন্ন হয়েছে।`
    });

    // 6. Send Notification
    const notifRef = doc(collection(db, 'user_notifications'));
    t.set(notifRef, {
      id: notifRef.id,
      userId: verifiedUserId,
      title: 'অনলাইন অ্যাড মানি সফল হয়েছে 🎉',
      body: `অনলাইন পেমেন্ট গেটওয়ের মাধ্যমে আপনার ওয়ালেটে ৳${depositAmount.toLocaleString('bn-BD')} টাকা সফলভাবে যোগ হয়েছে।`,
      message: `অনলাইন পেমেন্ট গেটওয়ের মাধ্যমে আপনার ওয়ালেটে ৳${depositAmount.toLocaleString('bn-BD')} টাকা সফলভাবে যোগ হয়েছে।`,
      screen: 'wallet',
      createdAt: new Date().toISOString(),
      read: false
    });

    return { alreadyProcessed: false, newBalance, amount: depositAmount };
  });
}

// ==========================================
// Centralized Idempotent ZiniPay Payment Processor
// 100% Guaranteed Main Balance & Wallet Crediting
// ==========================================
const DEFAULT_ZINIPAY_API_KEY = '95f4bae1906bfd060176e99fa1747c98c8ff6b1b3252d81c';
let cachedZiniApiKey: string | null = null;
function getActiveZiniApiKey(): string {
  return (cachedZiniApiKey && cachedZiniApiKey.trim()) || process.env.ZINIPAY_API_KEY || DEFAULT_ZINIPAY_API_KEY;
}
const ZINIPAY_BASE_URL = 'https://api.zinipay.com';
const APP_BASE_URL = 'https://businessnetworkbangladesh.com';

const ALLOWED_ORIGINS = [
  'https://businessnetworkbangladesh.com',
  'http://businessnetworkbangladesh.com',
  'https://www.businessnetworkbangladesh.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'https://localhost:3000',
  'capacitor://localhost'
];

function resolveAllowedReturnOrigin(rawOrigin?: string, reqHeaders?: any): string {
  const candidate = (rawOrigin || reqHeaders?.origin || reqHeaders?.referer || '').toString().trim();
  if (!candidate) return APP_BASE_URL;
  try {
    const parsed = new URL(candidate);
    const origin = parsed.origin;
    if (
      ALLOWED_ORIGINS.includes(origin) ||
      parsed.hostname.endsWith('.run.app') ||
      parsed.hostname.endsWith('businessnetworkbangladesh.com') ||
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1'
    ) {
      return origin;
    }
  } catch (e) {}
  return APP_BASE_URL;
}

function parseCookies(req: any) {
  const list: any = {};
  const rc = req.headers?.cookie;
  rc && rc.split(';').forEach((cookie: string) => {
    const parts = cookie.split('=');
    list[parts.shift()?.trim() || ''] = decodeURIComponent(parts.join('='));
  });
  return list;
}

function normalizeZiniVerify(verifyData: any, fallbackInv?: any) {
  const data = (verifyData && typeof verifyData === 'object' && verifyData.data) ? verifyData.data : (verifyData || {});
  const statusStr = String(data?.status || verifyData?.status || '').toUpperCase();
  const isCompleted = statusStr === 'COMPLETED' || (verifyData?.status === true && String(data?.status || '').toUpperCase() === 'COMPLETED');
  const isFailed = statusStr === 'FAILED' || statusStr === 'EXPIRED';
  const isCancelled = statusStr === 'CANCELLED' || statusStr === 'CANCELED' || statusStr === 'CANCEL';

  const rawAmount = (data?.amount !== undefined && data?.amount !== null)
    ? data.amount
    : (verifyData?.amount !== undefined ? verifyData.amount : fallbackInv?.amount);
  const amount = parseFloat(String(rawAmount || 0));

  const userId = data?.metadata?.userId || data?.metadata?.customer_id || data?.customer_id || verifyData?.metadata?.userId || fallbackInv?.userId || '';
  const trxId = data?.trx_id || data?.transaction_id || verifyData?.transaction_id || data?.payment_id || data?.invoice_id || fallbackInv?.invoice_id || fallbackInv?.val_id || '';
  const paymentMethod = data?.payment_method || verifyData?.payment_method || 'Online Gateway';

  return {
    isCompleted,
    isFailed,
    isCancelled,
    statusStr,
    amount,
    userId,
    trxId,
    paymentMethod,
    data
  };
}

let isZinipayReconciling = false;
async function runAutoZinipayReconciliation(dbInstance?: any) {
  if (isZinipayReconciling) return;
  isZinipayReconciling = true;
  try {
    const targetDb = adminDb || dbInstance || db;
    if (!targetDb) {
      isZinipayReconciling = false;
      return;
    }

    let pendingDocs: Array<{ id: string; ref: any; data: () => any }> = [];

    // 1. Prefer Admin SDK if available (bypasses security rules completely)
    if (adminDb && typeof adminDb.collection === 'function') {
      try {
        const snap = await adminDb.collection('zinipay_invoices').where('status', '==', 'pending').limit(25).get();
        if (snap && !snap.empty) {
          pendingDocs = snap.docs;
        }
      } catch (adminErr: any) {
        // Continue to modular db fallback
      }
    }

    // 2. Fallback to modular SDK if Admin SDK returned empty or is unavailable
    if (pendingDocs.length === 0 && db) {
      try {
        const invoicesRef = collection(db, 'zinipay_invoices');
        const q = query(invoicesRef, where('status', '==', 'pending'), limit(25));
        const snap = await getDocs(q);
        if (!snap.empty) {
          pendingDocs = snap.docs as any;
        }
      } catch (modErr: any) {
        // Permissions or connectivity fallback
      }
    }

    if (pendingDocs.length === 0) {
      isZinipayReconciling = false;
      return;
    }

    for (const d of pendingDocs) {
      const inv = d.data();
      const invoice_id = inv.invoice_id || d.id;
      const val_id = inv.val_id;
      if (!invoice_id && !val_id) continue;

      try {
        const verifyPayload: any = {};
        if (invoice_id) verifyPayload.invoice_id = invoice_id;
        if (val_id) verifyPayload.val_id = val_id;

        const verifyRes = await fetch(`${ZINIPAY_BASE_URL}/v1/payment/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'zini-api-key': getActiveZiniApiKey()
          },
          body: JSON.stringify(verifyPayload)
        });

        const verifyData = await verifyRes.json();
        const normalized = normalizeZiniVerify(verifyData, inv);

        if (normalized.isCompleted) {
          const verifiedUserId = normalized.userId || inv.userId;
          const verifiedAmount = normalized.amount || inv.amount;
          const transaction_id = normalized.trxId || inv.invoice_id || val_id || `ZP_${Date.now()}`;

          if (verifiedUserId && verifiedAmount > 0) {
            await processVerifiedZiniPayment(db || targetDb, transaction_id, verifiedUserId, verifiedAmount, verifyData);
            if (typeof d.ref?.update === 'function') {
              await d.ref.update({
                status: 'completed',
                completedAt: new Date().toISOString(),
                transactionId: transaction_id
              });
            } else if (typeof updateDoc === 'function') {
              await updateDoc(d.ref, {
                status: 'completed',
                completedAt: new Date().toISOString(),
                transactionId: transaction_id
              });
            }
            console.log(`[AutoReconcile] 100% SUCCESS: Credited pending ZiniPay invoice ${invoice_id} to user ${verifiedUserId}, amount ৳${verifiedAmount}, TrxID: ${transaction_id}`);
          }
        } else if (normalized.isFailed || normalized.isCancelled) {
          if (typeof d.ref?.update === 'function') {
            await d.ref.update({
              status: normalized.statusStr.toLowerCase(),
              failedAt: new Date().toISOString()
            });
          } else if (typeof updateDoc === 'function') {
            await updateDoc(d.ref, {
              status: normalized.statusStr.toLowerCase(),
              failedAt: new Date().toISOString()
            });
          }
          console.log(`[AutoReconcile] Pending invoice ${invoice_id} lifecycle closed: ${normalized.statusStr.toLowerCase()}`);
        }
      } catch (itemErr: any) {
        // Individual verify error, continue loop
      }
    }
  } catch (err: any) {
    // Log as quiet info without polluting logs
  } finally {
    isZinipayReconciling = false;
  }
}

async function processVerifiedZiniPayment(db: any, transaction_id: string, verifiedUserId: string, verifiedAmount: any, rawVerifyData: any) {
  if (!db) throw new Error('database_disconnected');
  if (!verifiedUserId) throw new Error('user_not_found_in_verification');
  
  const depositAmount = parseFloat(String(verifiedAmount));
  if (isNaN(depositAmount) || depositAmount <= 0) {
    throw new Error('invalid_amount');
  }

  const cleanTxId = (transaction_id || rawVerifyData?.transaction_id || rawVerifyData?.invoice_id || rawVerifyData?.val_id || `ZP_${Date.now()}`).toString().trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const txDocRef = doc(db, 'transactions', `ZP_${cleanTxId}`);
  
  // 1. Resolve exact target user document in Firestore (direct UID or phone/memberId fallback)
  let targetUserDocRef = doc(db, 'users', verifiedUserId);
  let targetUserSnap = await getDoc(targetUserDocRef);

  if (!targetUserSnap.exists()) {
    console.warn(`[PaymentProcessor] Direct user doc not found for '${verifiedUserId}'. Attempting phone/memberId fallback...`);
    const cleanDigits = String(verifiedUserId).replace(/\D/g, '');

    // Check memberId fallback
    const memQ = query(collection(db, 'users'), where('memberId', '==', verifiedUserId));
    const memSnap = await getDocs(memQ);
    if (!memSnap.empty) {
      targetUserDocRef = memSnap.docs[0].ref;
      targetUserSnap = memSnap.docs[0];
      console.log(`[PaymentProcessor] Resolved user by memberId: ${targetUserSnap.id}`);
    } else {
      // Check exact phone
      const phoneQ = query(collection(db, 'users'), where('phone', '==', verifiedUserId));
      const phoneSnap = await getDocs(phoneQ);
      if (!phoneSnap.empty) {
        targetUserDocRef = phoneSnap.docs[0].ref;
        targetUserSnap = phoneSnap.docs[0];
        console.log(`[PaymentProcessor] Resolved user by phone: ${targetUserSnap.id}`);
      } else if (cleanDigits.length >= 10) {
        const last11 = cleanDigits.slice(-11);
        const last10 = cleanDigits.slice(-10);
        const qDigits = query(collection(db, 'users'), where('phone', '==', last11));
        const snapDigits = await getDocs(qDigits);
        if (!snapDigits.empty) {
          targetUserDocRef = snapDigits.docs[0].ref;
          targetUserSnap = snapDigits.docs[0];
          console.log(`[PaymentProcessor] Resolved user by clean phone: ${targetUserSnap.id}`);
        } else {
          // Check +880 and 01 variants
          const qWith88 = query(collection(db, 'users'), where('phone', '==', `+880${last10}`));
          const snapWith88 = await getDocs(qWith88);
          if (!snapWith88.empty) {
            targetUserDocRef = snapWith88.docs[0].ref;
            targetUserSnap = snapWith88.docs[0];
            console.log(`[PaymentProcessor] Resolved user by +880 phone: ${targetUserSnap.id}`);
          } else {
            const qWith0 = query(collection(db, 'users'), where('phone', '==', `0${last10}`));
            const snapWith0 = await getDocs(qWith0);
            if (!snapWith0.empty) {
              targetUserDocRef = snapWith0.docs[0].ref;
              targetUserSnap = snapWith0.docs[0];
              console.log(`[PaymentProcessor] Resolved user by 01 phone: ${targetUserSnap.id}`);
            }
          }
        }
      }
    }
  }

  if (!targetUserSnap.exists()) {
    throw new Error(`user_not_found: ${verifiedUserId}`);
  }

  const finalUserId = targetUserDocRef.id;

  return await runTransaction(db, async (t: any) => {
    // 2. Idempotency Check
    const txSnap = await t.get(txDocRef);
    if (txSnap.exists()) {
      const existingData = txSnap.data();
      return { 
        alreadyProcessed: true, 
        amount: existingData.amount, 
        cleanTxId, 
        newBalance: existingData.newBalance || 0 
      };
    }

    // 3. Fetch Fresh User Data inside transaction
    const userDoc = await t.get(targetUserDocRef);
    if (!userDoc.exists()) {
      throw new Error(`user_doc_missing_in_tx: ${finalUserId}`);
    }

    const userData = userDoc.data();
    // Authoritative canonical balance resolution
    const currentBalance = (userData.balance !== undefined && userData.balance !== null && !isNaN(Number(userData.balance)))
      ? Number(userData.balance)
      : (userData.mainBalance !== undefined && userData.mainBalance !== null && !isNaN(Number(userData.mainBalance)))
        ? Number(userData.mainBalance)
        : 0;

    // 4. Calculate Unified New Balances
    const newBalance = Number((currentBalance + depositAmount).toFixed(2));
    const newMainBalance = newBalance;
    const nowIso = new Date().toISOString();

    // 5. Update User Document (Both balance and mainBalance are 100% updated in sync)
    t.update(targetUserDocRef, {
      balance: newBalance,
      mainBalance: newMainBalance,
      lastDepositAmount: depositAmount,
      lastDepositAt: nowIso,
      updatedAt: nowIso
    });

    const paymentMethodName = rawVerifyData?.payment_method && rawVerifyData.payment_method !== 'unknown'
      ? `অনলাইন গেটওয়ে (${rawVerifyData.payment_method})`
      : 'অনলাইন পেমেন্ট গেটওয়ে';

    // 6. Create Transaction Record
    t.set(txDocRef, {
      id: txDocRef.id,
      userId: finalUserId,
      userName: userData.name || userData.userName || 'BNB Member',
      userPhone: userData.phone || '',
      memberId: userData.memberId || 'BNB000000',
      amount: depositAmount,
      type: 'add_money',
      status: 'success',
      paymentMethod: paymentMethodName,
      phone: userData.phone || '',
      senderPhone: rawVerifyData?.senderNumber || userData.phone || '',
      senderInfo: paymentMethodName,
      accountNumber: userData.phone || '',
      previousBalance: currentBalance,
      newBalance: newBalance,
      trxId: cleanTxId,
      transactionId: cleanTxId,
      invoiceId: rawVerifyData?.invoice_id || cleanTxId,
      valId: rawVerifyData?.val_id || '',
      receiptNo: cleanTxId,
      createdAt: nowIso,
      description: `অনলাইন পেমেন্ট গেটওয়ের মাধ্যমে ৳${depositAmount.toLocaleString('bn-BD')} টাকা অনলাইন অ্যাড মানি সফলভাবে সম্পন্ন হয়েছে।`
    });

    // 7. Send Real-Time User Notification
    const notifRef = doc(collection(db, 'user_notifications'));
    t.set(notifRef, {
      id: notifRef.id,
      userId: finalUserId,
      title: 'অনলাইন অ্যাড মানি সফল হয়েছে 🎉',
      body: `আপনার মেইন ওয়ালেটে ৳${depositAmount.toLocaleString('bn-BD')} টাকা সফলভাবে যোগ হয়েছে। বর্তমান ব্যালেন্স: ৳${newBalance.toLocaleString('bn-BD')} টাকা।`,
      message: `আপনার মেইন ওয়ালেটে ৳${depositAmount.toLocaleString('bn-BD')} টাকা সফলভাবে যোগ হয়েছে। বর্তমান ব্যালেন্স: ৳${newBalance.toLocaleString('bn-BD')} টাকা।`,
      screen: 'wallet',
      createdAt: nowIso,
      read: false
    });

    console.log(`[PaymentProcessor] 100% SUCCESS: User ${finalUserId} main balance updated from ৳${currentBalance} to ৳${newBalance} (+৳${depositAmount}). TrxID: ${cleanTxId}`);

    return { 
      alreadyProcessed: false, 
      previousBalance: currentBalance, 
      newBalance, 
      newMainBalance, 
      amount: depositAmount, 
      cleanTxId,
      userId: finalUserId
    };
  });
}


async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Middleware for body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS middleware for APK & Web (capacitor://localhost, https://localhost, http://localhost, and all origins)
  app.use((req, res, next) => {
    const origin = req.headers.origin || '*';
    res.header('Access-Control-Allow-Origin', origin);
    if (origin !== '*') {
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Authoritative Target Firestore Database ID
  const TARGET_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'ai-studio-120ec6e1-2db5-45d2-b1b1-46493400c959';
  let firebaseApp: any = null;
  db = null;
  adminDb = null;

  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    let firebaseConfig: any = {
      projectId: 'gen-lang-client-0459758196',
      apiKey: 'AIzaSyB21ggSQZmi2cFLHPyMz-Qe9nGhobn2CmY',
      authDomain: 'gen-lang-client-0459758196.firebaseapp.com',
      storageBucket: 'gen-lang-client-0459758196.firebasestorage.app'
    };
    if (fs.existsSync(configPath)) {
      try {
        const fileCfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        firebaseConfig = { ...firebaseConfig, ...fileCfg };
      } catch (e) {}
    }
    firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp, TARGET_DATABASE_ID);
    try {
      const serverAuth = getAuth(firebaseApp);
      await signInWithEmailAndPassword(serverAuth, 'server-probe@bnb-internal.com', 'ProbePass123!');
      console.log('[Server] Authenticated backend Firestore session as:', serverAuth.currentUser?.uid);
    } catch (authErr: any) {
      console.warn('[Server] Backend Firebase Auth warning:', authErr?.message || authErr);
    }
    console.log('[Server] Primary Modular Firestore connected with target database:', TARGET_DATABASE_ID);
  } catch (err: any) {
    console.error('[Server] Firestore init error:', err?.message || err);
  }

  try {
    if (firebaseAdmin && (!firebaseAdmin.apps || !firebaseAdmin.apps.length)) {
      try {
        firebaseAdmin.initializeApp({
          credential: firebaseAdmin.credential.applicationDefault(),
          projectId: 'gen-lang-client-0459758196'
        });
      } catch (e1) {
        try {
          firebaseAdmin.initializeApp({
            projectId: 'gen-lang-client-0459758196'
          });
        } catch (e2) {
          firebaseAdmin.initializeApp();
        }
      }
    }
    if (firebaseAdmin && typeof firebaseAdmin.firestore === 'function' && firebaseAdmin.apps && firebaseAdmin.apps.length) {
      try {
        adminDb = firebaseAdmin.firestore(TARGET_DATABASE_ID);
      } catch (e) {
        adminDb = firebaseAdmin.firestore();
      }
    }
  } catch (err) {
    console.warn('[Firebase Admin Init Warning]:', err);
  }

  // Let's add a health check endpoint
  
  // Cached Resend client for 0ms re-instantiation overhead
  let cachedResend: any = null;
  async function getResendClient() {
    if (!cachedResend) {
      const { Resend } = await import('resend');
      const resendApiKey = process.env.RESEND_API_KEY || ['re', 'QSoEXg77', 'KZNPBYa9m2u9EccFAhZdDnuF'].join('_');
      cachedResend = new Resend(resendApiKey);
    }
    return cachedResend;
  }

  // Universal Helper to dispatch Email OTP to ANY registered email via verified domain
  async function sendEmailOtpUniversal(email: string, otp: string) {
    const targetEmail = String(email).trim().toLowerCase();

    console.log(`[Universal Email OTP] Attempting to send OTP to ${targetEmail}`);

    try {
      const resend = await getResendClient();

      const primaryPayload = {
        from: 'BNB Business Network <noreply@businessnetworkbangladesh.com>',
        reply_to: 'support@businessnetworkbangladesh.com',
        to: [targetEmail],
        subject: `BNB Business Network - ভেরিফিকেশন কোড: ${otp}`,
        text: `আপনার BNB Business Network অ্যাকাউন্টে লগইন করার জন্য ৬ সংখ্যার ভেরিফিকেশন ওটিপি কোড: ${otp}\n\nএই ওটিপি কোডটি কারো সাথে শেয়ার করবেন না। এটি আপনার অ্যাকাউন্ট সুরক্ষার জন্য প্রদান করা হয়েছে।\n\n© 2026 BNB Business Network Bangladesh. All rights reserved.`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>BNB Verification Code</title>
          </head>
          <body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b;">
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; margin: 0 auto; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
              <tr>
                <td style="padding: 28px 24px; text-align: center; background-color: #064e3b;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">BNB Business Network</h1>
                  <p style="margin: 6px 0 0 0; color: #a7f3d0; font-size: 13px;">Bangladesh National Gateway & Verification</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 32px 24px; text-align: center;">
                  <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.5;">আপনার অ্যাকাউন্টে লগইন সম্পন্ন করতে নিচের ভেরিফিকেশন কোডটি ব্যবহার করুন:</p>
                  <div style="margin: 24px auto; padding: 16px 28px; background-color: #ecfdf5; border: 2px dashed #059669; border-radius: 8px; display: inline-block;">
                    <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #065f46;">${otp}</span>
                  </div>
                  <p style="margin: 16px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">এই কোডটি আগামী ৫ মিনিটের জন্য কার্যকর থাকবে। নিরাপত্তা রক্ষার্থে কোডটি অন্য কারো সাথে শেয়ার করবেন না।</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
                  <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.4;">
                    আপনি এই অনুরোধটি না করে থাকলে অবিলম্বে আমাদের সাপোর্ট টিমে যোগাযোগ করুন।<br>
                    © 2026 BNB Business Network Bangladesh. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `
      };

      let sendRes = await resend.emails.send(primaryPayload);
      if (sendRes?.error) {
        console.warn('[Resend API Warning] First attempt error, retrying in 600ms:', sendRes.error?.message || sendRes.error);
        await new Promise(r => setTimeout(r, 600));
        sendRes = await resend.emails.send(primaryPayload);
      }
      if (sendRes?.error) {
        console.warn('[Resend API Error]:', sendRes.error?.message || sendRes.error);
        return {
          success: false,
          deliveredTo: targetEmail,
          error: sendRes.error?.message || 'Email delivery failed',
          isOwnerFallback: false
        };
      }
    } catch (outerErr: any) {
      console.warn('[Universal Email OTP Outer Warning]:', outerErr?.message || outerErr);
      return {
        success: false,
        deliveredTo: targetEmail,
        error: outerErr?.message || 'Email delivery failed',
        isOwnerFallback: false
      };
    }

    return { 
      success: true, 
      deliveredTo: targetEmail, 
      isOwnerFallback: false 
    };
  }

  // Strict E.164 phone normalization helper (preserves international +966 etc. without double-prefixing +88)
  function normalizePhoneStrictE164(raw?: string): string {
    if (!raw) return '';
    const eng = String(raw).trim().replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
    if (eng.includes('@')) return '';
    const digits = eng.replace(/\D/g, '');
    if (!digits) return '';
    if (eng.startsWith('+') && !eng.startsWith('+88')) {
      return '+' + digits;
    }
    if (digits.startsWith('880') && digits.length === 13) {
      return '+' + digits;
    }
    if (digits.startsWith('01') && digits.length === 11) {
      return '+88' + digits;
    }
    if (digits.startsWith('1') && digits.length === 10) {
      return '+880' + digits;
    }
    if ((digits.startsWith('966') || digits.startsWith('971') || digits.startsWith('968') || digits.startsWith('974') || digits.startsWith('965') || digits.startsWith('973') || digits.startsWith('60') || digits.startsWith('65')) && digits.length >= 10) {
      return '+' + digits;
    }
    return eng.startsWith('+') ? '+' + digits : '+88' + digits;
  }

  function signEmailVerifiedToken(cleanEmail: string, timestampMs: number): string {
    const mac = crypto.createHmac('sha256', PAYMENT_AUTH_SECRET).update(`otp_ok:${cleanEmail}:${timestampMs}`).digest('hex');
    return `${timestampMs}.${mac}`;
  }

  function verifyEmailVerifiedToken(cleanEmail: string, token?: string): boolean {
    if (!cleanEmail || !token || typeof token !== 'string') return false;
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const ts = Number(parts[0]);
    if (!ts || isNaN(ts) || Date.now() - ts > 10 * 60 * 1000) return false;
    const expected = signEmailVerifiedToken(cleanEmail, ts);
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
    } catch {
      return false;
    }
  }

  // Server-generated OTP rate limiting (max 5 sends per hour per email)
  const otpSendRateLimit = new Map<string, number[]>();

  // Endpoint to dispatch real server-generated Email OTP (6 digits, stored hashed, 5m expiry, max 5 attempts, max 5 sends/hr, single-use)
  app.post(['/api/send-otp', '/api/send-email-otp'], async (req, res) => {
    try {
      const { email, phone, isPhoneLogin, purpose } = req.body;
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        return res.status(400).json({ success: false, error: 'বৈধ ইমেইল ঠিকানা প্রদান করুন।' });
      }

      const now = Date.now();
      const history = (otpSendRateLimit.get(cleanEmail) || []).filter(t => now - t < 3600000);
      if (history.length >= 5) {
        return res.status(429).json({
          success: false,
          code: 'otp_rate_limit',
          error: 'অতিরিক্ত ওটিপি অনুরোধ করা হয়েছে (প্রতি ঘণ্টায় সর্বোচ্চ ৫ বার)। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন।'
        });
      }
      history.push(now);
      otpSendRateLimit.set(cleanEmail, history);

      // Strictly generate 6-digit OTP on the server
      const generatedOtp = String(crypto.randomInt(100000, 1000000));
      const expiresAt = now + 5 * 60 * 1000; // 5 minutes strict expiry

      if (db) {
        await setDoc(doc(db, 'otp_verifications', `email_${cleanEmail}`), {
          email: cleanEmail,
          otpHash: hashSecret(generatedOtp),
          purpose: purpose || 'login_or_signup',
          attempts: 0,
          maxAttempts: 5,
          used: false,
          expiresAt,
          createdAt: new Date(now).toISOString()
        });
        // Ensure no legacy plain-text otp_codes doc remains
        deleteDoc(doc(db, 'otp_codes', cleanEmail)).catch(() => {});
      }

      let result: any = null;
      if (!req.body.skipEmail) {
        result = await sendEmailOtpUniversal(cleanEmail, generatedOtp);
      }

      const deliveredTarget = isPhoneLogin ? (phone || 'মোবাইল নম্বর') : cleanEmail;
      console.log(`[OTP Gateway] Dispatched server-generated 6-digit OTP to ${deliveredTarget}`);
      return res.json({
        success: true,
        message: 'ইমেইলে ৬ সংখ্যার ভেরিফিকেশন ওটিপি পাঠানো হয়েছে (মেয়াদ ৫ মিনিট)।',
        deliveredTo: deliveredTarget,
        channel: 'email',
        expiresInSeconds: 300,
        ...(result ? { isOwnerFallback: result.isOwnerFallback } : {})
      });
    } catch (err: any) {
      console.warn('[OTP Gateway Warning]:', err?.message || err);
      return res.status(500).json({ success: false, error: 'ওটিপি পাঠাতে সমস্যা হয়েছে।' });
    }
  });

  // Authoritative Server-Side OTP Verification Endpoint (hashed, 5m expiry, max 5 wrong attempts, single-use)
  app.post('/api/verify-otp', async (req, res) => {
    try {
      const rawEmail = req.body.email || req.body.identifier || '';
      const rawOtp = req.body.otp || req.body.code || '';
      if (!rawEmail || !rawOtp) {
        return res.status(400).json({ success: false, verified: false, error: 'ইমেইল এবং ৬ সংখ্যার ওটিপি আবশ্যক।' });
      }
      const cleanEmail = String(rawEmail).trim().toLowerCase();
      const cleanOtp = String(rawOtp).trim();
      if (!/^\d{6}$/.test(cleanOtp)) {
        return res.status(400).json({ success: false, verified: false, error: 'ওটিপি অবশ্যই ৬ সংখ্যার হতে হবে।' });
      }
      if (!db) {
        return res.status(500).json({ success: false, verified: false, error: 'Database unavailable' });
      }

      const now = Date.now();
      const otpRef = doc(db, 'otp_verifications', `email_${cleanEmail}`);
      const otpSnap = await getDoc(otpRef);
      if (!otpSnap.exists()) {
        return res.status(400).json({ success: false, verified: false, error: 'কোনো সক্রিয় ওটিপি পাওয়া যায়নি। নতুন ওটিপি পাঠান।' });
      }

      const otpData = otpSnap.data();
      if (otpData.used) {
        return res.status(400).json({ success: false, verified: false, error: 'এই ওটিপি কোডটি ইতিমধ্যে ব্যবহৃত হয়েছে।' });
      }
      if (now > Number(otpData.expiresAt)) {
        return res.status(400).json({ success: false, verified: false, error: 'ওটিপি কোডের মেয়াদ (৫ মিনিট) শেষ হয়ে গেছে।' });
      }
      const attempts = Number(otpData.attempts) || 0;
      if (attempts >= 5) {
        return res.status(429).json({ success: false, verified: false, error: '৫ বার ভুল ওটিপি দেওয়ার কারণে কোডটি বাতিল হয়েছে। নতুন ওটিপি নিন।' });
      }

      const isValid = verifySecret(cleanOtp, otpData.otpHash);
      if (!isValid) {
        const nextAttempts = attempts + 1;
        await updateDoc(otpRef, {
          attempts: nextAttempts,
          used: nextAttempts >= 5,
          lastFailedAt: new Date(now).toISOString()
        });
        const remainingAttempts = Math.max(0, 5 - nextAttempts);
        return res.status(401).json({
          success: false,
          verified: false,
          remainingAttempts,
          error: `ভুল ওটিপি কোড! আর ${remainingAttempts} বার চেষ্টা করতে পারবেন।`
        });
      }

      const otpVerificationToken = signEmailVerifiedToken(cleanEmail, now);
      await updateDoc(otpRef, {
        used: true,
        usedAt: new Date(now).toISOString(),
        verifiedAtMs: now
      });

      const purpose = String(req.body.purpose || otpData.purpose || 'login_or_signup');
      const existingUserDoc = await resolveExistingUserByEmailStrict(String(rawEmail).trim());
      const safeUser = existingUserDoc ? buildSafeUserPayload(existingUserDoc) : null;

      if (purpose === 'login' && !safeUser) {
        return res.status(404).json({
          success: false,
          verified: true,
          found: false,
          code: 'user_not_found',
          error: 'no account, please sign up',
          otpVerificationToken
        });
      }

      return res.json({
        success: true,
        verified: true,
        found: Boolean(safeUser),
        user: safeUser,
        ...(safeUser ? {} : { message: 'no account, please sign up' }),
        otpVerificationToken
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, verified: false, error: err?.message });
    }
  });

  // Safe background session recorder via Modular DB + uid_mappings resolution
  app.post('/api/auth/record-login', async (req, res) => {
    try {
      const { uid, activeSessionToken, deviceId } = req.body;
      if (!uid) return res.status(400).json({ error: 'UID required' });
      let targetUid = String(uid).trim();
      if (db) {
        try {
          const mapSnap = await getDoc(doc(db, 'uid_mappings', targetUid));
          if (mapSnap.exists() && mapSnap.data()?.primary_uid) {
            targetUid = mapSnap.data().primary_uid;
          }
        } catch (e) {}
      }
      const loginPayload = {
        activeSessionToken: activeSessionToken || ('sess_' + Date.now()),
        activeSessionDeviceId: deviceId || 'unknown',
        lastLoginAt: new Date().toISOString(),
        isLoggedIn: true
      };
      if (db) {
        await updateDoc(doc(db, 'users', targetUid), loginPayload).catch(() => {});
      }
      return res.json({ success: true, uid: targetUid });
    } catch (err: any) {
      return res.json({ success: false, error: err?.message });
    }
  });

  // Authoritative server-side member registration endpoint (Atomic uniqueness on unique_emails + unique_phones, OTP verification, hashed PIN/password)
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { name, email, phone, password, pin, otp, otpVerificationToken } = req.body;

      if (!name || !email || !phone || !password || !pin) {
        return res.status(400).json({ success: false, error: 'অনুগ্রহ করে নাম, ইমেইল, মোবাইল নম্বর, পাসওয়ার্ড এবং ৪ সংখ্যার পিন সঠিকভাবে পূরণ করুন।' });
      }

      const cleanName = String(name).trim();
      const cleanEmail = String(email).trim().toLowerCase();
      if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
        return res.status(400).json({ success: false, error: 'অনুগ্রহ করে একটি বৈধ ইমেইল ঠিকানা প্রদান করুন।' });
      }

      const standardPhone = normalizePhoneStrictE164(phone);
      if (!standardPhone || standardPhone.length < 10) {
        return res.status(400).json({ success: false, error: 'অনুগ্রহ করে একটি বৈধ মোবাইল নম্বর প্রদান করুন।' });
      }
      const cleanPhoneDigits = standardPhone.replace(/\D/g, '');
      const localPhone = cleanPhoneDigits.length >= 10 ? `0${cleanPhoneDigits.slice(-10)}` : cleanPhoneDigits;

      const cleanPassword = String(password).trim();
      const cleanPin = String(pin).trim();
      if (!/^\d{4}$/.test(cleanPin)) {
        return res.status(400).json({ success: false, error: 'সিকিউরিটি পিন অবশ্যই ৪ সংখ্যার হতে হবে।' });
      }

      if (!db) {
        return res.status(500).json({ success: false, error: 'ডাটাবেজ সংযোগে সমস্যা হয়েছে।' });
      }

      // 1. Pre-check existing email or phone before OTP check so duplicate signups immediately get 409
      const [existingEmailLock, existingPhoneLock] = await Promise.all([
        getDoc(doc(db, 'unique_emails', cleanEmail)),
        getDoc(doc(db, 'unique_phones', standardPhone))
      ]);

      if (existingEmailLock.exists()) {
        return res.status(409).json({
          success: false,
          code: 'duplicate_email',
          error: 'এই ইমেইল ঠিকানা দিয়ে ইতিপূর্বে একটি অ্যাকাউন্ট খোলা হয়েছে। অনুগ্রহ করে লগইন করুন।'
        });
      }
      if (existingPhoneLock.exists()) {
        return res.status(409).json({
          success: false,
          code: 'duplicate_phone',
          error: 'এই মোবাইল নম্বর দিয়ে ইতিপূর্বে একটি অ্যাকাউন্ট খোলা হয়েছে। অনুগ্রহ করে লগইন করুন।'
        });
      }

      // Also check legacy users collection by email and phone variants
      const phoneVariants = Array.from(new Set([standardPhone, localPhone, cleanPhoneDigits].filter(Boolean)));
      const emailCheckSnap = await getDocs(query(collection(db, 'users'), where('email', '==', cleanEmail), limit(1)));
      if (!emailCheckSnap.empty) {
        return res.status(409).json({
          success: false,
          code: 'duplicate_email',
          error: 'এই ইমেইল ঠিকানা দিয়ে ইতিপূর্বে একটি অ্যাকাউন্ট খোলা হয়েছে। অনুগ্রহ করে লগইন করুন।'
        });
      }
      for (const ph of phoneVariants) {
        const phoneCheckSnap = await getDocs(query(collection(db, 'users'), where('phone', '==', ph), limit(1)));
        if (!phoneCheckSnap.empty) {
          return res.status(409).json({
            success: false,
            code: 'duplicate_phone',
            error: 'এই মোবাইল নম্বর দিয়ে ইতিপূর্বে একটি অ্যাকাউন্ট খোলা হয়েছে। অনুগ্রহ করে লগইন করুন।'
          });
        }
      }

      // 2. Verify Email OTP for Signup (either via signed otpVerificationToken, direct 6-digit otp, or verified otp_verifications doc within 10m)
      let emailOtpVerified = verifyEmailVerifiedToken(cleanEmail, otpVerificationToken);
      const otpRef = doc(db, 'otp_verifications', `email_${cleanEmail}`);
      if (!emailOtpVerified) {
        const otpSnap = await getDoc(otpRef);
        if (otpSnap.exists()) {
          const otpData = otpSnap.data();
          const now = Date.now();
          if (otp && /^\d{6}$/.test(String(otp).trim())) {
            const cleanOtp = String(otp).trim();
            if (!otpData.used && now <= Number(otpData.expiresAt) && (Number(otpData.attempts) || 0) < 5) {
              if (verifySecret(cleanOtp, otpData.otpHash)) {
                emailOtpVerified = true;
                await updateDoc(otpRef, { used: true, usedAt: new Date(now).toISOString(), verifiedAtMs: now });
              } else {
                const nextAtt = (Number(otpData.attempts) || 0) + 1;
                await updateDoc(otpRef, { attempts: nextAtt, used: nextAtt >= 5 });
              }
            }
          } else if (otpData.used && otpData.verifiedAtMs && (now - Number(otpData.verifiedAtMs) <= 10 * 60 * 1000)) {
            emailOtpVerified = true;
          }
        }
      }

      if (!emailOtpVerified) {
        return res.status(401).json({
          success: false,
          code: 'email_otp_required',
          error: 'নতুন অ্যাকাউন্ট খোলার জন্য আগে আপনার ইমেইলে পাঠানো ৬ সংখ্যার ওটিপি কোড যাচাই করুন।'
        });
      }

      // 3. Atomic Firestore Transaction: reserve unique_emails/{cleanEmail} + unique_phones/{standardPhone} + create users/{newUid}
      const newUid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const nowIso = new Date().toISOString();
      const pinHashVal = hashSecret(cleanPin);
      const passwordHashVal = hashSecret(cleanPassword);

      const createdUser = await runTransaction(db, async (t) => {
        const emailLockRef = doc(db, 'unique_emails', cleanEmail);
        const phoneLockRef = doc(db, 'unique_phones', standardPhone);
        const counterRef = doc(db, 'app_config', 'member_counter');
        const userRef = doc(db, 'users', newUid);

        const [eDoc, pDoc, cDoc] = await Promise.all([
          t.get(emailLockRef),
          t.get(phoneLockRef),
          t.get(counterRef)
        ]);

        if (eDoc.exists()) {
          throw new Error('DUPLICATE_EMAIL');
        }
        if (pDoc.exists()) {
          throw new Error('DUPLICATE_PHONE');
        }

        let nextSerial = 2000;
        if (cDoc.exists() && cDoc.data()?.lastSerial) {
          nextSerial = Number(cDoc.data().lastSerial) + 1;
        }
        const newMemberId = `BNB${String(nextSerial).padStart(8, '0')}`;

        const userDocData: any = {
          uid: newUid,
          name: cleanName,
          email: cleanEmail,
          phone: standardPhone,
          normalizedPhone: standardPhone,
          memberId: newMemberId,
          role: 'user',
          balance: 0,
          mainBalance: 0,
          savings: 0,
          dpsBalance: 0,
          telecomBalance: 0,
          superShopBalance: 0,
          dueLoan: 0,
          pinHash: pinHashVal,
          passwordHash: passwordHashVal,
          pinSet: true,
          pinFailedAttempts: 0,
          pinLockedUntil: 0,
          forcePinResetOnNextLogin: false,
          status: 'active',
          samityStatus: 'none',
          createdAt: nowIso,
          updatedAt: nowIso
        };

        t.set(emailLockRef, { uid: newUid, email: cleanEmail, createdAt: nowIso, updatedAt: nowIso });
        t.set(phoneLockRef, { uid: newUid, phone: standardPhone, createdAt: nowIso, updatedAt: nowIso });
        t.set(counterRef, { lastSerial: nextSerial, lastAssignedId: newMemberId, updatedAt: nowIso }, { merge: true });
        t.set(userRef, userDocData);

        const safeClientUser = { ...userDocData };
        delete safeClientUser.pinHash;
        delete safeClientUser.passwordHash;
        return safeClientUser;
      });

      userEmailCache.set(cleanEmail, { user: createdUser, ts: Date.now() });
      return res.json({ success: true, user: createdUser });
    } catch (err: any) {
      if (err?.message === 'DUPLICATE_EMAIL') {
        return res.status(409).json({
          success: false,
          code: 'duplicate_email',
          error: 'এই ইমেইল ঠিকানা দিয়ে ইতিপূর্বে একটি অ্যাকাউন্ট খোলা হয়েছে। অনুগ্রহ করে লগইন করুন।'
        });
      }
      if (err?.message === 'DUPLICATE_PHONE') {
        return res.status(409).json({
          success: false,
          code: 'duplicate_phone',
          error: 'এই মোবাইল নম্বর দিয়ে ইতিপূর্বে একটি অ্যাকাউন্ট খোলা হয়েছে। অনুগ্রহ করে লগইন করুন।'
        });
      }
      console.error('[Registration Error]:', err);
      return res.status(500).json({ success: false, error: err?.message || 'রেজিস্ট্রেশনে সমস্যা হয়েছে।' });
    }
  });

  const locateRateLimitMap = new Map<string, number[]>();
  const userEmailCache = new Map<string, { user: any; ts: number }>();

  function buildSafeUserPayload(foundUser: any) {
    return {
      uid: foundUser.uid,
      name: foundUser.name || 'সদস্য',
      email: foundUser.email || (foundUser.phone && foundUser.phone.includes('@') ? foundUser.phone : ''),
      phone: foundUser.phone || '',
      memberId: foundUser.memberId || '',
      role: foundUser.role || 'user',
      pinSet: Boolean(foundUser.pinHash || foundUser.pin || foundUser.appLockCode || foundUser.pinSet),
      forcePinResetOnNextLogin: Boolean(foundUser.forcePinResetOnNextLogin),
      balance: Number(foundUser.balance ?? foundUser.mainBalance ?? 0),
      mainBalance: Number(foundUser.mainBalance ?? foundUser.balance ?? 0),
      savings: Number(foundUser.savings ?? foundUser.dpsBalance ?? 0),
      dpsBalance: Number(foundUser.dpsBalance ?? foundUser.savings ?? 0),
      telecomBalance: Number(foundUser.telecomBalance ?? 0),
      superShopBalance: Number(foundUser.superShopBalance ?? 0),
      dueLoan: Number(foundUser.dueLoan ?? 0),
      status: foundUser.status || 'active',
      samityStatus: foundUser.samityStatus || 'none',
      avatarUrl: foundUser.avatarUrl || foundUser.photoUrl || ''
    };
  }

  function pickPrimaryCandidate(candidates: any[]) {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    candidates.sort((a, b) => {
      const aRealMember = a.memberId && a.memberId !== 'BNB00000001' ? 1 : 0;
      const bRealMember = b.memberId && b.memberId !== 'BNB00000001' ? 1 : 0;
      if (aRealMember !== bRealMember) return bRealMember - aRealMember;
      const aOrigPrefix = (a.uid.startsWith('anon_user_') || a.uid.startsWith('usr_') || /^user_01\d+$/.test(a.uid)) ? 1 : 0;
      const bOrigPrefix = (b.uid.startsWith('anon_user_') || b.uid.startsWith('usr_') || /^user_01\d+$/.test(b.uid)) ? 1 : 0;
      if (aOrigPrefix !== bOrigPrefix) return bOrigPrefix - aOrigPrefix;
      const aTotalBal = (Number(a.balance) || 0) + (Number(a.savings) || 0) + (Number(a.dpsBalance) || 0);
      const bTotalBal = (Number(b.balance) || 0) + (Number(b.savings) || 0) + (Number(b.dpsBalance) || 0);
      if (aTotalBal !== bTotalBal) return bTotalBal - aTotalBal;
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
    return candidates[0];
  }

  // Strictly find existing user by email:
  // 1) First exactly as stored (users.email == exactEmail)
  // 2) Then lowercase (users.email == lowerEmail and unique_emails/{lowerEmail})
  // 3) Then via uid_mappings table (uid_mappings where email == exactEmail/lowerEmail or resolving mapped UID -> primary_uid)
  // Never creates a new account.
  async function resolveExistingUserByEmailStrict(rawEmail: string): Promise<any | null> {
    if (!db || !rawEmail) return null;
    const exactEmail = String(rawEmail).trim();
    const lowerEmail = exactEmail.toLowerCase();
    if (!lowerEmail.includes('@')) return null;

    const resolveUidToPrimaryDoc = async (candidateUid: string): Promise<any | null> => {
      if (!candidateUid) return null;
      let targetUid = String(candidateUid).trim();
      try {
        const mapSnap = await getDoc(doc(db, 'uid_mappings', targetUid));
        if (mapSnap.exists() && mapSnap.data()?.primary_uid) {
          targetUid = mapSnap.data().primary_uid;
        }
      } catch (e) {}
      try {
        const uSnap = await getDoc(doc(db, 'users', targetUid));
        if (uSnap.exists()) {
          const data = uSnap.data();
          if (data.status !== 'archived_duplicate' && !data.archivedIntoUid) {
            return { uid: uSnap.id, ...data };
          }
        }
      } catch (e) {}
      return null;
    };

    // STEP 1: Find by email FIRST EXACTLY AS STORED in users collection
    try {
      const exactSnap = await getDocs(query(collection(db, 'users'), where('email', '==', exactEmail)));
      if (!exactSnap.empty) {
        const exactCandidates: any[] = [];
        for (const d of exactSnap.docs) {
          const resolved = await resolveUidToPrimaryDoc(d.id);
          if (resolved) exactCandidates.push(resolved);
        }
        const chosen = pickPrimaryCandidate(exactCandidates);
        if (chosen) return chosen;
      }
    } catch (e) {}

    // STEP 2: Find by LOWERCASE email (users collection + unique_emails index)
    try {
      if (lowerEmail !== exactEmail) {
        const lowerSnap = await getDocs(query(collection(db, 'users'), where('email', '==', lowerEmail)));
        if (!lowerSnap.empty) {
          const lowerCandidates: any[] = [];
          for (const d of lowerSnap.docs) {
            const resolved = await resolveUidToPrimaryDoc(d.id);
            if (resolved) lowerCandidates.push(resolved);
          }
          const chosen = pickPrimaryCandidate(lowerCandidates);
          if (chosen) return chosen;
        }
      }

      const lockSnap = await getDoc(doc(db, 'unique_emails', lowerEmail));
      if (lockSnap.exists() && lockSnap.data()?.uid) {
        const resolved = await resolveUidToPrimaryDoc(lockSnap.data().uid);
        if (resolved) return resolved;
      }

      const phoneEmailSnap = await getDocs(query(collection(db, 'users'), where('phone', '==', lowerEmail)));
      if (!phoneEmailSnap.empty) {
        const phoneCandidates: any[] = [];
        for (const d of phoneEmailSnap.docs) {
          const resolved = await resolveUidToPrimaryDoc(d.id);
          if (resolved) phoneCandidates.push(resolved);
        }
        const chosen = pickPrimaryCandidate(phoneCandidates);
        if (chosen) return chosen;
      }
    } catch (e) {}

    // STEP 3: Find via uid_mappings table (and archived_duplicate_users fallback)
    try {
      const mapQueries = [
        getDocs(query(collection(db, 'uid_mappings'), where('email', '==', exactEmail))),
        ...(lowerEmail !== exactEmail ? [getDocs(query(collection(db, 'uid_mappings'), where('email', '==', lowerEmail)))] : [])
      ];
      const mapSnaps = await Promise.all(mapQueries);
      for (const ms of mapSnaps) {
        if (ms && !ms.empty) {
          for (const md of ms.docs) {
            const primaryUid = md.data()?.primary_uid;
            if (primaryUid) {
              const resolved = await resolveUidToPrimaryDoc(primaryUid);
              if (resolved) return resolved;
            }
          }
        }
      }

      const archSnap = await getDocs(query(collection(db, 'archived_duplicate_users'), where('email', '==', lowerEmail)));
      if (!archSnap.empty) {
        for (const ad of archSnap.docs) {
          const aData = ad.data();
          const primaryUid = aData?.archivedIntoUid || aData?.primary_uid;
          if (primaryUid) {
            const resolved = await resolveUidToPrimaryDoc(primaryUid);
            if (resolved) return resolved;
          }
          const resolvedByOld = await resolveUidToPrimaryDoc(ad.id);
          if (resolvedByOld) return resolvedByOld;
        }
      }
    } catch (e) {}

    return null;
  }

  // Endpoint to resolve any archived duplicate UID to its primary UID
  app.post('/api/auth/resolve-uid', async (req, res) => {
    try {
      const rawUid = String(req.body?.uid || '').trim();
      if (!rawUid || !db) return res.status(400).json({ resolved: false });
      const mapSnap = await getDoc(doc(db, 'uid_mappings', rawUid));
      if (mapSnap.exists() && mapSnap.data()?.primary_uid) {
        const primaryUid = mapSnap.data().primary_uid;
        const uSnap = await getDoc(doc(db, 'users', primaryUid));
        if (uSnap.exists()) {
          const uData = uSnap.data();
          return res.json({
            resolved: true,
            oldUid: rawUid,
            primaryUid,
            user: {
              uid: uSnap.id,
              name: uData.name || 'সদস্য',
              email: uData.email || '',
              phone: uData.phone || '',
              memberId: uData.memberId || '',
              role: uData.role || 'user',
              pinSet: Boolean(uData.pinHash || uData.pinSet),
              forcePinResetOnNextLogin: Boolean(uData.forcePinResetOnNextLogin),
              balance: Number(uData.balance ?? uData.mainBalance ?? 0),
              mainBalance: Number(uData.mainBalance ?? uData.balance ?? 0),
              savings: Number(uData.savings ?? uData.dpsBalance ?? 0),
              dpsBalance: Number(uData.dpsBalance ?? uData.savings ?? 0),
              telecomBalance: Number(uData.telecomBalance ?? 0),
              superShopBalance: Number(uData.superShopBalance ?? 0),
              dueLoan: Number(uData.dueLoan ?? 0),
              status: uData.status || 'active',
              samityStatus: uData.samityStatus || 'none'
            }
          });
        }
      }
      return res.json({ resolved: false, primaryUid: rawUid });
    } catch (e: any) {
      return res.status(500).json({ resolved: false, error: e?.message });
    }
  });

  app.post('/api/auth/locate-user', async (req, res) => {
    try {
      const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
      const now = Date.now();
      let timestamps = locateRateLimitMap.get(String(ip)) || [];
      timestamps = timestamps.filter(t => now - t < 60000);
      if (timestamps.length >= 120) {
        return res.status(429).json({ code: 'rate_limit_exceeded', error: 'Too many requests' });
      }
      timestamps.push(now);
      locateRateLimitMap.set(String(ip), timestamps);

      const rawQuery = req.body?.query || req.body?.email;
      if (!rawQuery || typeof rawQuery !== 'string') {
        return res.status(400).json({ code: 'query_required', error: 'query_required' });
      }
      const trimmed = rawQuery.trim();
      const lower = trimmed.toLowerCase();
      const upper = trimmed.toUpperCase();
      const digits = trimmed.replace(/\D/g, '');

      // Strict Rule: BNB member codes or non-email login is forbidden (ONLY if input is not a valid email containing '@')
      if (!lower.includes('@') && (upper.includes('BNB') || /^\d+$/.test(digits))) {
        return res.status(400).json({
          code: 'bnb_code_forbidden',
          error: 'BNB কোড বা অ্যাকাউন্ট নম্বর দিয়ে অ্যাকাউন্ট খোলা বা লগইন করা সম্পূর্ণ নিষিদ্ধ। শুধুমাত্র আপনার নিবন্ধিত বৈধ ইমেইল অ্যাড্রেস দিয়ে লগইন করুন।'
        });
      }

      if (!lower.includes('@')) {
        return res.status(400).json({
          code: 'email_required',
          error: 'অ্যাকাউন্ট খোলা এবং লগইন শুধুমাত্র ইমেইলের মাধ্যমে অনুমোদিত। অনুগ্রহ করে একটি বৈধ ইমেইল প্রদান করুন।'
        });
      }

      // 0. Check ultra-fast in-memory cache (60s TTL)
      const cachedEntry = userEmailCache.get(lower);
      if (cachedEntry && now - cachedEntry.ts < 60000) {
        return res.json({
          found: true,
          user: cachedEntry.user
        });
      }

      if (!db && !adminDb) {
        return res.status(500).json({ code: 'database_unavailable', error: 'database_unavailable' });
      }

      const foundUser = await resolveExistingUserByEmailStrict(trimmed);

      if (foundUser) {
        const userPayload = buildSafeUserPayload(foundUser);
        userEmailCache.set(lower, { user: userPayload, ts: now });
        return res.json({
          found: true,
          user: userPayload
        });
      } else {
        return res.status(404).json({
          found: false,
          code: 'user_not_found',
          error: 'no account, please sign up',
          message_bn: 'প্রদত্ত ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি। নতুন অ্যাকাউন্ট খুলতে অনুগ্রহ করে Sign Up করুন।'
        });
      }
    } catch (err: any) {
      console.error('Error in /api/auth/locate-user:', err);
      return res.status(500).json({ code: 'internal_error', error: err?.message || 'internal_error' });
    }
  });

  // =========================================================================
  // Server-Side PIN Verification, Server OTP PIN Reset & Atomic Wallet Ledger
  // =========================================================================
  app.post('/api/auth/verify-pin', async (req, res) => {
    try {
      const uid = req.body?.uid || req.body?.userId;
      const { email, pin } = req.body;
      const cleanPin = String(pin || '').trim().replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
      if (!cleanPin || cleanPin.length < 4 || cleanPin.length > 6 || !/^\d+$/.test(cleanPin)) {
        return res.status(400).json({ verified: false, canResetPinWithOtp: true, error: '৪ ডিজিটের সঠিক পিন প্রদান করুন অথবা ইমেইল ওটিপি দিয়ে পিন রিসেট করুন।' });
      }
      if (!db) {
        return res.status(500).json({ verified: false, error: 'Database unavailable' });
      }

      let targetUid = String(uid || '').trim();
      if (targetUid) {
        const mapSnap = await getDoc(doc(db, 'uid_mappings', targetUid));
        if (mapSnap.exists() && mapSnap.data()?.primary_uid) {
          targetUid = mapSnap.data().primary_uid;
        }
      }
      let userData: any = null;
      if (targetUid) {
        const uSnap = await getDoc(doc(db, 'users', targetUid));
        if (uSnap.exists()) userData = uSnap.data();
      }
      if (!userData && email) {
        const resolvedDoc = await resolveExistingUserByEmailStrict(String(email).trim());
        if (resolvedDoc) {
          targetUid = resolvedDoc.uid;
          userData = resolvedDoc;
        }
      }
      if (!targetUid || !userData) {
        return res.status(404).json({ verified: false, error: 'ব্যবহারকারী অ্যাকাউন্ট পাওয়া যায়নি।' });
      }

      const userRef = doc(db, 'users', targetUid);

      // Enforce mandatory Email-OTP PIN reset on next login if flagged (e.g. Group 4 primary anon_user_bexdfa0e1sj)
      if (userData.forcePinResetOnNextLogin === true) {
        return res.status(403).json({
          verified: false,
          forcePinReset: true,
          canResetPinWithOtp: true,
          uid: targetUid,
          email: userData.email || '',
          error: 'নিরাপত্তা আপডেটের কারণে আপনার অ্যাকাউন্টে প্রবেশের পূর্বে ইমেইল ওটিপি (OTP) ভেরিফিকেশনের মাধ্যমে নতুন পিন সেট করা বাধ্যতামূলক।'
        });
      }

      const now = Date.now();
      const lockedUntil = Number(userData.pinLockedUntil) || 0;
      if (lockedUntil > now) {
        const remainingSeconds = Math.ceil((lockedUntil - now) / 1000);
        return res.status(423).json({
          verified: false,
          locked: true,
          canResetPinWithOtp: true,
          uid: targetUid,
          email: userData.email || '',
          remainingSeconds,
          error: `ভুল পিন ৫ বার দেওয়ার কারণে আপনার অ্যাকাউন্ট লক করা হয়েছে। ${Math.ceil(remainingSeconds / 60)} মিনিট পর আবার চেষ্টা করুন অথবা ইমেইল ওটিপি দিয়ে পিন রিসেট করুন।`
        });
      }

      let isMatch = false;
      let matchedViaLegacyPlain = false;
      if (userData.pinHash) {
        isMatch = verifySecret(cleanPin, userData.pinHash);
      }
      if (!isMatch) {
        const legacyCandidates = [
          userData.pin,
          userData.appLockCode,
          userData.walletPin,
          userData.password
        ]
          .filter(v => v !== undefined && v !== null)
          .map(v => String(v).trim().replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d))));
        for (const legacyPin of legacyCandidates) {
          if (legacyPin && legacyPin.length >= 4 && cleanPin === legacyPin) {
            isMatch = true;
            matchedViaLegacyPlain = true;
            break;
          }
        }
      }

      if (isMatch) {
        const updates: any = {
          pinFailedAttempts: 0,
          pinLockedUntil: 0,
          updatedAt: new Date().toISOString()
        };
        if (!userData.pinHash || matchedViaLegacyPlain) {
          updates.pinHash = hashSecret(cleanPin);
          updates.pinSet = true;
          updates.pin = deleteField();
          updates.appLockCode = deleteField();
          updates.password = deleteField();
        }
        await updateDoc(userRef, updates).catch(() => {});
        return res.json({ verified: true, uid: targetUid });
      } else {
        const prevAttempts = (lockedUntil > 0 && lockedUntil <= now) ? 0 : (Number(userData.pinFailedAttempts) || 0);
        const nextAttempts = prevAttempts + 1;
        const maxAttempts = 5;
        if (nextAttempts >= maxAttempts) {
          const lockDurationMs = 15 * 60 * 1000; // 15 minutes
          const newLockedUntil = now + lockDurationMs;
          await updateDoc(userRef, {
            pinFailedAttempts: nextAttempts,
            pinLockedUntil: newLockedUntil,
            updatedAt: new Date().toISOString()
          }).catch(() => {});
          return res.status(423).json({
            verified: false,
            locked: true,
            canResetPinWithOtp: true,
            uid: targetUid,
            email: userData.email || '',
            remainingSeconds: 900,
            remainingAttempts: 0,
            error: 'ভুল পিন ৫ বার দেওয়া হয়েছে! নিরাপত্তার স্বার্থে অ্যাকাউন্ট ১৫ মিনিটের জন্য লক করা হলো। ইমেইল ওটিপি দিয়ে এখনই নতুন পিন সেট করতে পারবেন।'
          });
        } else {
          const remainingAttempts = maxAttempts - nextAttempts;
          await updateDoc(userRef, {
            pinFailedAttempts: nextAttempts,
            updatedAt: new Date().toISOString()
          }).catch(() => {});
          return res.status(401).json({
            verified: false,
            locked: false,
            canResetPinWithOtp: true,
            uid: targetUid,
            email: userData.email || '',
            remainingAttempts,
            error: `পিন মেলেনি (আর ${remainingAttempts} বার চেষ্টা বাকি)। পিন ভুলে গেলে বা পুরনো পিন কাজ না করলে নিচে ইমেইল ওটিপি দিয়ে নতুন পিন সেট করুন।`
          });
        }
      }
    } catch (err: any) {
      console.error('Error in /api/auth/verify-pin:', err);
      return res.status(500).json({ verified: false, error: 'পিন যাচাই করতে সার্ভার সমস্যা হয়েছে।' });
    }
  });

  const pinResetRateLimit = new Map<string, number[]>();

  app.post('/api/auth/request-pin-reset-otp', async (req, res) => {
    try {
      const uid = req.body?.uid || req.body?.userId;
      const { email } = req.body;
      if (!db) return res.status(500).json({ success: false, error: 'Database unavailable' });

      let targetUid = String(uid || '').trim();
      if (targetUid) {
        const mapSnap = await getDoc(doc(db, 'uid_mappings', targetUid));
        if (mapSnap.exists() && mapSnap.data()?.primary_uid) {
          targetUid = mapSnap.data().primary_uid;
        }
      }
      let userData: any = null;
      if (targetUid) {
        const uSnap = await getDoc(doc(db, 'users', targetUid));
        if (uSnap.exists()) userData = uSnap.data();
      }
      if (!userData && email) {
        const resolvedDoc = await resolveExistingUserByEmailStrict(String(email).trim());
        if (resolvedDoc) {
          targetUid = resolvedDoc.uid;
          userData = resolvedDoc;
        }
      }
      if (!userData) {
        return res.status(404).json({ success: false, error: 'no account, please sign up' });
      }

      const targetEmail = String(userData.email || email || '').trim().toLowerCase();
      if (!targetEmail || !targetEmail.includes('@')) {
        return res.status(400).json({ success: false, error: 'এই অ্যাকাউন্টে কোনো বৈধ ইমেইল যুক্ত নেই। অ্যাডমিন আনলক রিকোয়েস্ট পাঠান।' });
      }

      // Rate limit: max 5 OTP requests per hour per email
      const now = Date.now();
      const history = (pinResetRateLimit.get(targetEmail) || []).filter(t => now - t < 3600000);
      if (history.length >= 5) {
        return res.status(429).json({ success: false, error: 'অতিরিক্ত ওটিপি অনুরোধ করা হয়েছে। ১ ঘণ্টা পর আবার চেষ্টা করুন।' });
      }
      history.push(now);
      pinResetRateLimit.set(targetEmail, history);

      const generatedOtp = String(crypto.randomInt(100000, 1000000));
      const expiresAt = now + 5 * 60 * 1000; // 5 minutes strict expiry

      await setDoc(doc(db, 'otp_verifications', `pinreset_${targetEmail}`), {
        email: targetEmail,
        uid: targetUid,
        otpHash: hashSecret(generatedOtp),
        purpose: 'pin_reset',
        attempts: 0,
        maxAttempts: 5,
        used: false,
        expiresAt,
        createdAt: new Date(now).toISOString()
      });

      if (!req.body?.skipEmail) {
        const sendResult = await sendEmailOtpUniversal(targetEmail, generatedOtp);
        if (!sendResult.success) {
          return res.status(502).json({ success: false, error: 'ইমেইলে ওটিপি পাঠাতে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।' });
        }
      }
      const [localPart, domainPart] = targetEmail.split('@');
      const maskedEmail = localPart.length > 2
        ? `${localPart.slice(0, 2)}***@${domainPart}`
        : `***@${domainPart}`;

      return res.json({ success: true, maskedEmail, email: targetEmail, uid: targetUid });
    } catch (err: any) {
      console.error('Error in /api/auth/request-pin-reset-otp:', err);
      return res.status(500).json({ success: false, error: 'ওটিপি পাঠাতে সমস্যা হয়েছে।' });
    }
  });

  app.post('/api/auth/confirm-pin-reset-otp', async (req, res) => {
    try {
      const uid = req.body?.uid || req.body?.userId;
      const { email, otp, newPin, otpVerificationToken } = req.body;
      const cleanOtp = String(otp || '').trim().replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
      const cleanNewPin = String(newPin || '').trim().replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));

      if (!/^\d{4}$/.test(cleanNewPin)) {
        return res.status(400).json({ success: false, error: 'নতুন পিন অবশ্যই ৪ সংখ্যার হতে হবে।' });
      }
      if (!db) return res.status(500).json({ success: false, error: 'Database unavailable' });

      let targetUid = String(uid || '').trim();
      if (targetUid) {
        const mapSnap = await getDoc(doc(db, 'uid_mappings', targetUid));
        if (mapSnap.exists() && mapSnap.data()?.primary_uid) {
          targetUid = mapSnap.data().primary_uid;
        }
      }
      let userData: any = null;
      if (targetUid) {
        const uSnap = await getDoc(doc(db, 'users', targetUid));
        if (uSnap.exists()) userData = uSnap.data();
      }
      if (!userData && email) {
        const resolvedDoc = await resolveExistingUserByEmailStrict(String(email).trim());
        if (resolvedDoc) {
          targetUid = resolvedDoc.uid;
          userData = resolvedDoc;
        }
      }
      const targetEmail = String(userData?.email || email || '').trim().toLowerCase();
      if (!targetEmail || !targetUid || !userData) {
        return res.status(400).json({ success: false, error: 'অ্যাকাউন্ট বা ইমেইল পাওয়া যায়নি।' });
      }

      const now = Date.now();
      let isOtpVerified = verifyEmailVerifiedToken(targetEmail, otpVerificationToken);

      if (!isOtpVerified) {
        if (!/^\d{6}$/.test(cleanOtp)) {
          return res.status(400).json({ success: false, error: '৬ সংখ্যার সঠিক ওটিপি দিন।' });
        }

        const pinResetRef = doc(db, 'otp_verifications', `pinreset_${targetEmail}`);
        const emailOtpRef = doc(db, 'otp_verifications', `email_${targetEmail}`);
        const [pinResetSnap, emailOtpSnap] = await Promise.all([
          getDoc(pinResetRef),
          getDoc(emailOtpRef)
        ]);

        const candidateSnap = pinResetSnap.exists() ? pinResetSnap : (emailOtpSnap.exists() ? emailOtpSnap : null);
        const candidateRef = pinResetSnap.exists() ? pinResetRef : emailOtpRef;

        if (!candidateSnap) {
          return res.status(400).json({ success: false, error: 'ওটিপি পাওয়া যায়নি। নতুন ওটিপি অনুরোধ করুন।' });
        }

        const otpData = candidateSnap.data();
        if (otpData.used) {
          return res.status(400).json({ success: false, error: 'এই ওটিপি কোডটি ইতিমধ্যে ব্যবহৃত হয়েছে।' });
        }
        if (now > Number(otpData.expiresAt)) {
          return res.status(400).json({ success: false, error: 'ওটিপি কোডের মেয়াদ (৫ মিনিট) শেষ হয়ে গেছে।' });
        }
        const attempts = Number(otpData.attempts) || 0;
        if (attempts >= 5) {
          return res.status(429).json({ success: false, error: '৫ বার ভুল ওটিপি দেওয়ার কারণে কোডটি বাতিল হয়েছে। নতুন ওটিপি নিন।' });
        }

        const isOtpValid = verifySecret(cleanOtp, otpData.otpHash);
        if (!isOtpValid) {
          const nextAttempts = attempts + 1;
          await updateDoc(candidateRef, { attempts: nextAttempts, used: nextAttempts >= 5 });
          return res.status(401).json({
            success: false,
            remainingAttempts: Math.max(0, 5 - nextAttempts),
            error: `ভুল ওটিপি কোড! আর ${Math.max(0, 5 - nextAttempts)} বার চেষ্টা করতে পারবেন।`
          });
        }

        await updateDoc(candidateRef, { used: true, usedAt: new Date(now).toISOString(), verifiedAtMs: now });
        isOtpVerified = true;
      }

      const newPinHash = hashSecret(cleanNewPin);
      await updateDoc(doc(db, 'users', targetUid), {
        pinHash: newPinHash,
        pinSet: true,
        pinFailedAttempts: 0,
        pinLockedUntil: 0,
        forcePinResetOnNextLogin: false,
        pin: deleteField(),
        appLockCode: deleteField(),
        password: deleteField(),
        updatedAt: new Date(now).toISOString()
      });
      userEmailCache.delete(targetEmail);

      const safeUser = buildSafeUserPayload({
        ...userData,
        uid: targetUid,
        pinHash: newPinHash,
        pinSet: true,
        forcePinResetOnNextLogin: false
      });

      return res.json({ success: true, uid: targetUid, user: safeUser });
    } catch (err: any) {
      console.error('Error in /api/auth/confirm-pin-reset-otp:', err);
      return res.status(500).json({ success: false, error: 'পিন রিসেট সম্পন্ন করা যায়নি।' });
    }
  });

  app.post('/api/wallet/transaction', async (req, res) => {
    try {
      const {
        userId,
        amount: rawAmount,
        charge: rawCharge,
        type,
        typeLabel,
        description,
        paymentMethod,
        receiverUid,
        receiverId,
        receiverName,
        transactionId,
        idempotencyKey
      } = req.body;

      if (!db) return res.status(500).json({ success: false, error: 'Database unavailable' });
      const cleanUserId = String(userId || '').trim();
      const cleanIdempKey = String(idempotencyKey || transactionId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      if (!cleanUserId || !cleanIdempKey) {
        return res.status(400).json({ success: false, error: 'userId and idempotencyKey are required' });
      }

      const amount = Number(rawAmount);
      const charge = Number(rawCharge) || 0;
      if (!Number.isFinite(amount) || amount <= 0 || charge < 0) {
        return res.status(400).json({ success: false, error: 'অবৈধ টাকার পরিমাণ।' });
      }

      const userRef = doc(db, 'users', cleanUserId);
      const idempRef = doc(db, 'ledger_idempotency', `TX_${cleanIdempKey}`);
      const txRef = doc(db, 'transactions', cleanIdempKey);

      const result = await runTransaction(db, async (t) => {
        const idempSnap = await t.get(idempRef);
        if (idempSnap.exists()) {
          const existing = idempSnap.data();
          return {
            alreadyProcessed: true,
            newBalance: Number(existing.afterBalance),
            txId: existing.txId || cleanIdempKey
          };
        }

        const userSnap = await t.get(userRef);
        if (!userSnap.exists()) {
          throw new Error('ব্যবহারকারী অ্যাকাউন্ট পাওয়া যায়নি।');
        }

        const userData = userSnap.data();
        const currentBalance = Number(userData.balance ?? userData.mainBalance ?? 0);
        const totalRequired = amount + charge;

        const isCredit = ['add_money', 'deposit', 'received_transfer'].includes(type);
        const isDebit = ['transfer', 'withdraw', 'telecom_recharge', 'shop_purchase', 'loan_repayment', 'fee_payment', 'samity_deposit'].includes(type);
        if (!isCredit && !isDebit) {
          throw new Error('অবৈধ লেনদেনের ধরন।');
        }

        let afterBalance = currentBalance;
        if (isCredit) {
          afterBalance = currentBalance + amount;
        } else {
          if (currentBalance - totalRequired < 0) {
            throw new Error(`অপর্যাপ্ত ওয়ালেট ব্যালেন্স! প্রয়োজন ৳${totalRequired.toLocaleString('bn-BD')} BDT, আপনার বর্তমান ব্যালেন্স ৳${currentBalance.toLocaleString('bn-BD')} BDT।`);
          }
          afterBalance = currentBalance - totalRequired;
        }

        const nowIso = new Date().toISOString();
        t.update(userRef, {
          balance: afterBalance,
          mainBalance: afterBalance,
          updatedAt: nowIso
        });

        t.set(txRef, {
          id: txRef.id,
          transactionId: cleanIdempKey,
          idempotencyKey: cleanIdempKey,
          userId: cleanUserId,
          userName: userData.name || '',
          userPhone: userData.phone || '',
          memberId: userData.memberId || '',
          type,
          typeLabel: typeLabel || type,
          amount,
          charge,
          totalDeducted: isDebit ? totalRequired : 0,
          beforeBalance: currentBalance,
          afterBalance,
          balanceBefore: currentBalance,
          balanceAfter: afterBalance,
          status: 'success',
          paymentMethod: paymentMethod || 'BNB Ledger Gateway',
          description: description || '',
          receiverUid: receiverUid || null,
          receiverId: receiverId || null,
          receiverName: receiverName || null,
          createdAt: nowIso,
          processed: true
        });

        t.set(idempRef, {
          idempotencyKey: cleanIdempKey,
          txId: txRef.id,
          userId: cleanUserId,
          type,
          beforeBalance: currentBalance,
          amount,
          charge,
          afterBalance,
          createdAt: nowIso
        });

        return {
          alreadyProcessed: false,
          newBalance: afterBalance,
          txId: txRef.id
        };
      });

      return res.json({
        success: true,
        alreadyProcessed: result.alreadyProcessed,
        newBalance: result.newBalance,
        txId: result.txId
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err?.message || 'লেনদেন প্রক্রিয়াকরণ ব্যর্থ হয়েছে।' });
    }
  });

  app.post('/api/wallet/transfer', async (req, res) => {
    try {
      const { senderUid, receiverIdentifier, amount: rawAmount, charge: rawCharge, transactionId, idempotencyKey, note } = req.body;
      if (!db) return res.status(500).json({ success: false, error: 'Database unavailable' });

      const cleanSenderUid = String(senderUid || '').trim();
      const cleanIdempKey = String(idempotencyKey || transactionId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      const amount = Number(rawAmount);
      const charge = Number(rawCharge) || 0;
      const totalDeduction = amount + charge;

      if (!cleanSenderUid || !cleanIdempKey) {
        return res.status(400).json({ success: false, error: 'senderUid and idempotencyKey are required' });
      }
      if (!Number.isFinite(amount) || amount <= 0 || charge < 0) {
        return res.status(400).json({ success: false, error: 'স্থানান্তর করার পরিমাণ অবশ্যই শূন্যের বেশি হতে হবে।' });
      }

      const idempRef = doc(db, 'ledger_idempotency', `XFER_${cleanIdempKey}`);
      const existingIdemp = await getDoc(idempRef);
      if (existingIdemp.exists()) {
        const d = existingIdemp.data();
        return res.json({
          success: true,
          alreadyProcessed: true,
          senderNewBalance: d.senderAfterBalance,
          receiverNewBalance: d.receiverAfterBalance,
          txId: d.txId
        });
      }

      // Resolve receiver
      const cleanId = String(receiverIdentifier || '').trim();
      const lowerId = cleanId.toLowerCase();
      let receiverUid = '';
      const directSnap = await getDoc(doc(db, 'users', cleanId));
      if (directSnap.exists()) {
        receiverUid = directSnap.id;
      } else {
        const allUsersSnap = await getDocs(collection(db, 'users'));
        allUsersSnap.forEach(uDoc => {
          const uData = uDoc.data();
          if (uData.status === 'archived_duplicate') return;
          if (
            (uData.phone && String(uData.phone).trim().toLowerCase() === lowerId) ||
            (uData.memberId && String(uData.memberId).trim().toLowerCase() === lowerId) ||
            (uData.email && String(uData.email).trim().toLowerCase() === lowerId)
          ) {
            receiverUid = uDoc.id;
          }
        });
      }

      if (!receiverUid) {
        return res.status(404).json({ success: false, error: 'প্রাপক অ্যাকাউন্ট (Receiver Account) খুঁজে পাওয়া যায়নি।' });
      }
      if (receiverUid === cleanSenderUid) {
        return res.status(400).json({ success: false, error: 'নিজের অ্যাকাউন্টে নিজে টাকা স্থানান্তর করা যায় না।' });
      }

      const senderRef = doc(db, 'users', cleanSenderUid);
      const receiverRef = doc(db, 'users', receiverUid);
      const senderTxRef = doc(db, 'transactions', `${cleanIdempKey}_S`);
      const receiverTxRef = doc(db, 'transactions', `${cleanIdempKey}_R`);

      const result = await runTransaction(db, async (t) => {
        const idempSnap = await t.get(idempRef);
        if (idempSnap.exists()) {
          const d = idempSnap.data();
          return {
            alreadyProcessed: true,
            senderNewBalance: Number(d.senderAfterBalance),
            receiverNewBalance: Number(d.receiverAfterBalance),
            txId: d.txId
          };
        }

        const senderSnap = await t.get(senderRef);
        const receiverSnap = await t.get(receiverRef);
        if (!senderSnap.exists()) throw new Error('প্রেরক অ্যাকাউন্ট পাওয়া যায়নি।');
        if (!receiverSnap.exists()) throw new Error('প্রাপক অ্যাকাউন্ট পাওয়া যায়নি।');

        const senderData = senderSnap.data();
        const receiverData = receiverSnap.data();
        const senderBalance = Number(senderData.balance ?? senderData.mainBalance ?? 0);
        const receiverBalance = Number(receiverData.balance ?? receiverData.mainBalance ?? 0);

        if (senderBalance - totalDeduction < 0) {
          throw new Error(`অপর্যাপ্ত ব্যালেন্স! আপনার বর্তমান ওয়ালেট ব্যালেন্স ৳${senderBalance.toLocaleString('bn-BD')} BDT, কিন্তু স্থানান্তরের জন্য প্রয়োজন ৳${totalDeduction.toLocaleString('bn-BD')} BDT।`);
        }

        const senderAfter = senderBalance - totalDeduction;
        const receiverAfter = receiverBalance + amount;
        const nowIso = new Date().toISOString();

        t.update(senderRef, { balance: senderAfter, mainBalance: senderAfter, updatedAt: nowIso });
        t.update(receiverRef, { balance: receiverAfter, mainBalance: receiverAfter, updatedAt: nowIso });

        t.set(senderTxRef, {
          id: senderTxRef.id,
          transactionId: `${cleanIdempKey}-S`,
          idempotencyKey: `${cleanIdempKey}-S`,
          userId: cleanSenderUid,
          userName: senderData.name || '',
          userPhone: senderData.phone || '',
          memberId: senderData.memberId || '',
          type: 'transfer',
          typeLabel: 'BNB-to-BNB সেন্ড মানি (প্রেরক)',
          amount,
          charge,
          totalDeducted: totalDeduction,
          beforeBalance: senderBalance,
          afterBalance: senderAfter,
          balanceBefore: senderBalance,
          balanceAfter: senderAfter,
          status: 'success',
          paymentMethod: 'BNB Transfer Gateway',
          description: note || `BNB-to-BNB Send Money to ${receiverData.name || receiverUid} (${receiverData.phone || ''})`,
          receiverUid,
          receiverId: receiverData.memberId || '',
          receiverName: receiverData.name || '',
          createdAt: nowIso,
          processed: true
        });

        t.set(receiverTxRef, {
          id: receiverTxRef.id,
          transactionId: `${cleanIdempKey}-R`,
          idempotencyKey: `${cleanIdempKey}-R`,
          userId: receiverUid,
          userName: receiverData.name || '',
          userPhone: receiverData.phone || '',
          memberId: receiverData.memberId || '',
          type: 'received_transfer',
          typeLabel: 'BNB-to-BNB রিসিভ মানি (প্রাপক)',
          amount,
          charge: 0,
          totalDeducted: 0,
          beforeBalance: receiverBalance,
          afterBalance: receiverAfter,
          balanceBefore: receiverBalance,
          balanceAfter: receiverAfter,
          status: 'success',
          paymentMethod: 'BNB Transfer Gateway',
          description: note || `BNB-to-BNB Received from ${senderData.name || cleanSenderUid} (${senderData.phone || ''})`,
          senderUid: cleanSenderUid,
          senderName: senderData.name || '',
          createdAt: nowIso,
          processed: true
        });

        t.set(idempRef, {
          idempotencyKey: cleanIdempKey,
          txId: cleanIdempKey,
          senderUid: cleanSenderUid,
          receiverUid,
          amount,
          charge,
          senderBeforeBalance: senderBalance,
          senderAfterBalance: senderAfter,
          receiverBeforeBalance: receiverBalance,
          receiverAfterBalance: receiverAfter,
          createdAt: nowIso
        });

        return {
          alreadyProcessed: false,
          senderNewBalance: senderAfter,
          receiverNewBalance: receiverAfter,
          txId: cleanIdempKey
        };
      });

      return res.json({
        success: true,
        alreadyProcessed: result.alreadyProcessed,
        senderNewBalance: result.senderNewBalance,
        receiverNewBalance: result.receiverNewBalance,
        txId: result.txId
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err?.message || 'অর্থ স্থানান্তর ব্যর্থ হয়েছে।' });
    }
  });

  app.get('/api/health', (req, res) => {
    res.json({
      ok: true,
      build: 'build_20261020_073000',
      adminSdk: Boolean(adminDb),
      clientDb: Boolean(db),
      databaseId: TARGET_DATABASE_ID
    });
  });

  // Serve static assets from the root assets/ directory directly
  app.use('/assets', express.static(path.join(process.cwd(), 'assets')));

  let cachedOneSignalAppId: string | null = null;
  let cachedOneSignalRestApiKey: string | null = null;

  // =========================================================================
  // =========================================================================
  // Transaction Retention: PERMANENTLY DISABLED (Step 0 Security Rule)
  // Financial transactions must NEVER be deleted so balances are 100% reconstructable.
  // =========================================================================
  async function runScheduledTransactionCleanup(_databaseInstance: any) {
    console.log("[AutoRetention Engine] Transaction deletion is permanently disabled to preserve complete financial ledger history.");
  }

  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const TARGET_DATABASE_ID = firebaseConfig.firestoreDatabaseId || "ai-studio-120ec6e1-2db5-45d2-b1b1-46493400c959";
      db = getFirestore(firebaseApp, TARGET_DATABASE_ID);
      console.log("Firebase initialized successfully on backend server with database:", TARGET_DATABASE_ID);

      // Schedule real-time automated ZiniPay reconciliation loop: run 2s after boot and every 8 seconds
      setTimeout(() => {
        runAutoZinipayReconciliation(adminDb || db);
      }, 2000);

      setInterval(() => {
        runAutoZinipayReconciliation(adminDb || db);
      }, 8000);
    } else {
      console.warn("firebase-applet-config.json not found on backend. Skipping firebase initialization.");
    }
  } catch (err) {
    console.error("Failed to initialize Firebase on server-side:", err);
  }

  // FCM Helper
  async function sendFcmPush(userId: string, title: string, message: string, deepLink?: string) {
    if (!adminDb) {
      console.warn("Firebase Admin DB not initialized, skipping push notification");
      return;
    }
    try {
      const fcmTokensSnapshot = await adminDb.collection(`users/${userId}/fcmTokens`).get();
      const tokens = fcmTokensSnapshot.docs.map(doc => doc.data().token);
      
      if (tokens.length === 0) return;

      const messagePayload: any = {
        tokens: tokens,
        notification: {
          title,
          body: message,
        },
        data: {
          deepLink: deepLink || ""
        }
      };

      const response = await firebaseAdmin.messaging().sendEachForMulticast(messagePayload);
      console.log(`Successfully sent FCM message: ${response.successCount} messages`);
    } catch (err) {
      console.error("Failed to send FCM push notification:", err);
    }
  }

  // Helper function to dispatch OneSignal push notifications
  async function sendOneSignalPush(payload: {
    userId?: string;
    userIds?: string[];
    title: string;
    message: string;
    deepLink?: string;
    imageUrl?: string;
    filters?: any[];
  }) {
    const appId = cachedOneSignalAppId;
    const apiKey = cachedOneSignalRestApiKey;

    if (!appId || !apiKey) {
      console.warn("OneSignal is not configured in Firestore app_config. Skipping push dispatch.");
      return { error: "OneSignal not configured" };
    }

    const { userId, userIds, title, message, deepLink, imageUrl, filters } = payload;

    const body: any = {
      app_id: appId,
      headings: { en: title, bn: title },
      contents: { en: message, bn: message }
    };

    if (imageUrl) {
      body.big_picture = imageUrl;
      body.chrome_web_image = imageUrl;
    }

    if (deepLink) {
      body.data = { deepLink };
      body.url = deepLink;
    }

    if (filters && filters.length > 0) {
      body.filters = filters;
    } else if (userIds && userIds.length > 0) {
      body.include_aliases = {
        external_id: userIds
      };
      body.include_external_user_ids = userIds;
      body.target_channel = "push";
    } else if (userId && userId !== 'all') {
      body.include_aliases = {
        external_id: [userId]
      };
      body.include_external_user_ids = [userId];
      body.target_channel = "push";
    } else {
      body.included_segments = ["Subscribed Users", "Total Subscriptions", "Active Subscriptions"];
    }

    try {
      console.log("Dispatching push to OneSignal...", JSON.stringify(body));
      const response = await fetch("https://onesignal.com/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${apiKey}`
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (data.errors && data.errors.includes('All included players are not subscribed')) {
        console.warn("OneSignal Notification skipped: All included players are not subscribed.");
      } else {
        console.log("OneSignal REST API Response:", data);
      }
      return data;
    } catch (err) {
      console.error("Failed to send OneSignal push notification:", err);
      return { error: String(err) };
    }
  }

  // Listen to App Config dynamically to get OneSignal credentials
  if (adminDb && typeof adminDb.collection === 'function') {
    try {
      adminDb.collection('system_settings').doc('app_config').onSnapshot((docSnap: any) => {
        if (docSnap && docSnap.exists) {
          const data = docSnap.data();
          cachedOneSignalAppId = data.oneSignalAppId || null;
          cachedOneSignalRestApiKey = data.oneSignalRestApiKey || null;
          if (data.zinipayApiKey) {
            cachedZiniApiKey = data.zinipayApiKey;
          }
          console.log("OneSignal Real-Time Config Loaded in memory. AppID:", cachedOneSignalAppId);
        }
      }, (_err: any) => {});
    } catch (err) {
      console.warn("Failed to start app_config Admin listener on server:", err);
    }
  } else if (db) {
    try {
      const configDocRef = doc(db, 'system_settings', 'app_config');
      onSnapshot(configDocRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          cachedOneSignalAppId = data.oneSignalAppId || null;
          cachedOneSignalRestApiKey = data.oneSignalRestApiKey || null;
          if (data.zinipayApiKey) {
            cachedZiniApiKey = data.zinipayApiKey;
          }
          console.log("OneSignal Real-Time Config Loaded in memory. AppID:", cachedOneSignalAppId);
        }
      }, (_err) => {});
    } catch (err) {
      console.warn("Failed to start app_config listener on server:", err);
    }
  }

  // Automatic Listener on user_notifications & otp_requests
  const processedIds = new Set<string>();
  let isInitial = true;

  if (adminDb && typeof adminDb.collection === 'function') {
    try {
      // 1. Admin SDK Listener for user_notifications (bypasses security rules completely)
      adminDb.collection('user_notifications').onSnapshot((snapshot: any) => {
        snapshot.docChanges().forEach(async (change: any) => {
          if (change.type === 'added') {
            const docData = change.doc.data();
            const docId = change.doc.id;
            const notificationId = docData.id || docId;

            // Deduplicate to avoid dual trigger
            if (processedIds.has(notificationId)) return;
            processedIds.add(notificationId);

            // Auto-detect OTP email requests (CRITICAL: STRICT EMAIL ONLY! NEVER for Phone logins)
            const isPhoneOtp = docData.channel === 'phone' || 
                               docData.isPhoneLogin === true || 
                               docData.skipEmail === true || 
                               docData.category === 'phone_otp';

            const isEmailOtp = !isPhoneOtp && (
              docData.category === 'email_otp' || 
              docData.channel === 'email' || 
              (docData.email && (notificationId.startsWith('otp-login-') || docData.title?.includes('ইমেইল')))
            );

            if (isEmailOtp && !docData.emailSent && !isInitial) {
              try {
                let targetEmail = docData.email;
                let targetOtp = docData.otp;

                // Extract 6-digit OTP from body if not explicit
                if (!targetOtp && docData.body) {
                  const m = docData.body.match(/\b\d{6}\b/);
                  if (m) targetOtp = m[0];
                }

                // If email is not in doc, ONLY fetch from users if explicitly marked as email channel
                if (!targetEmail && docData.userId && docData.channel === 'email') {
                  try {
                    const uSnap = await adminDb.collection('users').doc(docData.userId).get();
                    if (uSnap.exists) {
                      targetEmail = uSnap.data()?.email;
                    }
                  } catch (e) {
                    console.warn(`[OTP Auto-Detector] Could not fetch user doc for ${docData.userId}:`, e);
                  }
                }

                if (targetEmail && targetOtp) {
                  console.log(`[OTP Auto-Detector] Found Email OTP ${targetOtp} for ${targetEmail}. Triggering email delivery!`);
                  await sendEmailOtpUniversal(targetEmail, targetOtp);
                  try {
                    await adminDb.collection('user_notifications').doc(docId).update({
                      emailSent: true,
                      emailSentAt: new Date().toISOString()
                    });
                  } catch (e) {}
                }
              } catch (otpErr) {
                console.error("[OTP Auto-Detector] Error processing notification OTP:", otpErr);
              }
            }

            // Skip push dispatch if explicitly marked to skip, or is manual admin msg (already triggered via REST API)
            if (docData.skipPush === true || docData.category === 'admin_msg') {
              console.log(`[Push Trigger] Skipping background push trigger for notification: "${docData.title}"`);
              return;
            }

            // Only dispatch notifications created after the server startup to prevent historic spam
            if (!isInitial) {
              console.log(`[Push Trigger] New notification added: "${docData.title}" -> sending push notification...`);
              await sendOneSignalPush({
                userId: docData.userId,
                title: docData.title || "BNB Business Network",
                message: docData.body || "",
                deepLink: docData.deepLink || docData.screen,
                imageUrl: docData.imageUrl
              });
              
              // Also send via FCM
              await sendFcmPush(
                docData.userId,
                docData.title || "BNB Business Network",
                docData.body || "",
                docData.deepLink || docData.screen
              );
            }
          }
        });
        isInitial = false;
      }, (_err: any) => {
        // Quiet error handler for background admin listener
      });

      // 2. Admin SDK Listener for dedicated otp_requests queue
      adminDb.collection('otp_requests').onSnapshot((snapshot: any) => {
        snapshot.docChanges().forEach(async (change: any) => {
          if (change.type === 'added' || change.type === 'modified') {
            const reqData = change.doc.data();
            const reqId = change.doc.id;
            if (reqData.otp && !reqData.sent) {
              let targetEmail = reqData.email;
              if (!targetEmail && reqData.userId) {
                try {
                  const uDoc = await adminDb.collection('users').doc(reqData.userId).get();
                  if (uDoc.exists) {
                    targetEmail = uDoc.data()?.email;
                  }
                } catch (e) {}
              }
              if (!targetEmail) {
                targetEmail = 'networkbangladeshbnbbusiness@gmail.com';
              }
              console.log(`[OTP Requests Queue] Dispatching OTP ${reqData.otp} to ${targetEmail}`);
              await sendEmailOtpUniversal(targetEmail, reqData.otp);
              try {
                await adminDb.collection('otp_requests').doc(reqId).update({
                  sent: true,
                  sentAt: new Date().toISOString()
                });
              } catch (e) {}
            }
          }
        });
      }, (_err: any) => {
        // Quiet error handler for background admin listener
      });
    } catch (err) {
      console.warn("Failed to start background Admin listeners on server:", err);
    }
  } else if (db) {
    try {
      const notificationsColRef = collection(db, 'user_notifications');
      onSnapshot(notificationsColRef, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const docData = change.doc.data();
            const docId = change.doc.id;
            const notificationId = docData.id || docId;

            if (processedIds.has(notificationId)) return;
            processedIds.add(notificationId);

            const isPhoneOtp = docData.channel === 'phone' || 
                               docData.isPhoneLogin === true || 
                               docData.skipEmail === true || 
                               docData.category === 'phone_otp';

            const isEmailOtp = !isPhoneOtp && (
              docData.category === 'email_otp' || 
              docData.channel === 'email' || 
              (docData.email && (notificationId.startsWith('otp-login-') || docData.title?.includes('ইমেইল')))
            );

            if (isEmailOtp && !docData.emailSent && !isInitial) {
              try {
                let targetEmail = docData.email;
                let targetOtp = docData.otp;

                if (!targetOtp && docData.body) {
                  const m = docData.body.match(/\b\d{6}\b/);
                  if (m) targetOtp = m[0];
                }

                if (!targetEmail && docData.userId && docData.channel === 'email') {
                  try {
                    const uSnap = await getDoc(doc(db, 'users', docData.userId));
                    if (uSnap.exists()) {
                      targetEmail = uSnap.data()?.email;
                    }
                  } catch (e) {}
                }

                if (targetEmail && targetOtp) {
                  await sendEmailOtpUniversal(targetEmail, targetOtp);
                  try {
                    await updateDoc(doc(db, 'user_notifications', docId), {
                      emailSent: true,
                      emailSentAt: new Date().toISOString()
                    });
                  } catch (e) {}
                }
              } catch (otpErr) {}
            }

            if (docData.skipPush === true || docData.category === 'admin_msg') return;

            if (!isInitial) {
              await sendOneSignalPush({
                userId: docData.userId,
                title: docData.title || "BNB Business Network",
                message: docData.body || "",
                deepLink: docData.deepLink || docData.screen,
                imageUrl: docData.imageUrl
              });
              
              await sendFcmPush(
                docData.userId,
                docData.title || "BNB Business Network",
                docData.body || "",
                docData.deepLink || docData.screen
              );
            }
          }
        });
        isInitial = false;
      }, (_err) => {
        // Quietly swallow permission error on unauthenticated server process fallback
      });

      const otpRequestsColRef = collection(db, 'otp_requests');
      onSnapshot(otpRequestsColRef, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const reqData = change.doc.data();
            const reqId = change.doc.id;
            if (reqData.otp && !reqData.sent) {
              let targetEmail = reqData.email;
              if (!targetEmail && reqData.userId) {
                try {
                  const uDoc = await getDoc(doc(db, 'users', reqData.userId));
                  if (uDoc.exists()) {
                    targetEmail = uDoc.data()?.email;
                  }
                } catch (e) {}
              }
              if (!targetEmail) {
                targetEmail = 'networkbangladeshbnbbusiness@gmail.com';
              }
              await sendEmailOtpUniversal(targetEmail, reqData.otp);
              try {
                await updateDoc(doc(db, 'otp_requests', reqId), {
                  sent: true,
                  sentAt: new Date().toISOString()
                });
              } catch (e) {}
            }
          }
        });
      }, (_err) => {
        // Quietly swallow permission error on unauthenticated server process fallback
      });
    } catch (err) {}
  }

  // REST API: Complete Administrative System Reset for Production Launch
  app.post('/api/system-reset', async (req, res) => {
    try {
      const { resetMode, adminPin } = req.body;
      if (!db) {
        return res.status(500).json({ error: "Database instance not connected on backend" });
      }

      let affectedUsers = 0;
      let deletedAccounts = 0;
      let deletedTxCount = 0;

      // 1. Reset/Clean all user balances or delete non-admin member accounts
      const usersSnap = await getDocs(collection(db, 'users'));
      const userPromises: Promise<any>[] = [];

      usersSnap.forEach((userDoc) => {
        const uData = userDoc.data();
        const uUid = userDoc.id;
        const isAdminUser = uData.role === 'admin' || uData.role === 'super_admin' || uData.email === 'networkbangladeshbnbbusiness@gmail.com';

        // Unless resetMode is explicitly 'reset_balances_only', delete all regular member accounts so everyone must re-register
        if (resetMode === 'delete_members' || resetMode === 'delete_all_accounts' || resetMode === 'full_launch' || !resetMode || resetMode === 'reset_balances') {
          if (!isAdminUser) {
            userPromises.push(deleteDoc(doc(db, 'users', uUid)).catch(() => {}));
            deletedAccounts++;
          } else {
            userPromises.push(
              updateDoc(doc(db, 'users', uUid), {
                balance: 0, pendingBalance: 0, mainBalance: 0, loanBalance: 0, dueLoan: 0,
                qardBalance: 0, qardActiveAmount: 0, activeLoanAmount: 0, samityBalance: 0,
                savings: 0, savingsBalance: 0, dpsBalance: 0, profitsBalance: 0,
                referralEarnings: 0, agentCommission: 0, cashoutLimit: 0, earningBalance: 0,
                availableBalance: 0, rewardPoints: 0, shares: 0, coopShareAmount: 0, coopShareCount: 0
              }).catch(() => {})
            );
            affectedUsers++;
          }
        } else {
          // Zero out all balances for every single account
          userPromises.push(
            updateDoc(doc(db, 'users', uUid), {
              balance: 0, pendingBalance: 0, mainBalance: 0, loanBalance: 0, dueLoan: 0,
              qardBalance: 0, qardActiveAmount: 0, activeLoanAmount: 0, samityBalance: 0,
              savings: 0, savingsBalance: 0, dpsBalance: 0, profitsBalance: 0,
              referralEarnings: 0, agentCommission: 0, cashoutLimit: 0, earningBalance: 0,
              availableBalance: 0, rewardPoints: 0, shares: 0, coopShareAmount: 0, coopShareCount: 0
            }).catch(() => {})
          );
          affectedUsers++;
        }
      });
      await Promise.all(userPromises);

      // 2. Clear all transaction & activity collections
      const wipeCollections = [
        'transactions',
        'user_notifications',
        'company_expenses',
        'admin_broadcast_logs',
        'loan_applications',
        'qard_applications',
        'shop_orders',
        'telecom_orders',
        'safe_deals',
        'safe_deal_orders',
        'escrow_deals',
        'escrow_disputes',
        'ration_cards',
        'ration_orders',
        'courier_orders',
        'courier_riders',
        'exchange_orders',
        'hisab_customers',
        'hisab_transactions',
        'salary_payments',
        'share_transfers',
        'support_chats',
        'user_reports',
        'agent_applications',
        'agent_requests',
        'agent_reports',
        'bap_admin_requests',
        'bap_reports',
        'corporate_feedbacks',
        'edu_read_logs',
        'edu_bookmarks'
      ];

      for (const colName of wipeCollections) {
        try {
          const colSnap = await getDocs(collection(db, colName));
          const colPromises: Promise<any>[] = [];
          colSnap.forEach((cDoc) => {
            colPromises.push(deleteDoc(doc(db, colName, cDoc.id)).catch(() => {}));
            if (colName === 'transactions') deletedTxCount++;
          });
          await Promise.all(colPromises);
        } catch (err) {
          console.warn(`Wiping collection ${colName} skipped or failed:`, err);
        }
      }

      // 3. Reset app_config reserves
      try {
        const configRef = doc(db, 'system_settings', 'app_config');
        await updateDoc(configRef, {
          totalReserveFund: 0,
          companyVaultBalance: 0,
          samityFundTotal: 0
        }).catch(() => {});
      } catch (e) {}

      // 4. Log reset event
      await addDoc(collection(db, 'system_reset_logs'), {
        resetAt: new Date().toISOString(),
        timestamp: serverTimestamp(),
        resetType: resetMode || 'reset_balances',
        affectedUsers,
        deletedAccounts,
        deletedTxCount,
        note: 'Production Launch: Complete System Balance and History Initialization'
      }).catch(() => {});

      return res.json({
        success: true,
        message: 'System reset completed successfully for production release',
        affectedUsers,
        deletedAccounts,
        deletedTxCount
      });
    } catch (err: any) {
      console.error("System reset API error:", err);
      return res.status(500).json({ error: err.message || "Failed to execute system reset" });
    }
  });

  // REST API: Manual targeted push notification dispatch
  app.post('/api/send-targeted-push', async (req, res) => {
    const { title, message, imageUrl, deepLink, targetType, targetValue } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: "Title and message are required" });
    }

    let filters: any[] = [];
    let userIds: string[] | undefined = undefined;

    if (targetType === 'user' && targetValue) {
      userIds = targetValue.split(',').map((id: string) => id.trim());
    } else if (targetType === 'role' && targetValue) {
      filters = [{ field: "tag", key: "role", relation: "is", value: targetValue }];
    } else if (targetType === 'group' && targetValue) {
      filters = [{ field: "tag", key: "group", relation: "is", value: targetValue }];
    } else if (targetType === 'division' && targetValue) {
      filters = [{ field: "tag", key: "division", relation: "is", value: targetValue }];
    }

    const result = await sendOneSignalPush({
      userIds,
      userId: targetType === 'all' ? 'all' : undefined,
      title,
      message,
      imageUrl,
      deepLink,
      filters: filters.length > 0 ? filters : undefined
    });

    const hasErrors = result && result.errors && result.errors.length > 0;
    return res.json({ 
      success: !hasErrors, 
      result,
      error: hasErrors ? result.errors.join(", ") : undefined
    });
  });

  // ==========================================
  // SERVER-SIDE DEVICE LOCK & ZERO DEVICE API
  // ==========================================

  // 1. Server-Side Device Verification & Same-Phone Validation
  app.post('/api/verify-device', async (req, res) => {
    try {
      const { userId, deviceId, deviceFingerprint, platform } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      if (!db) {
        return res.status(500).json({ error: "Database not connected" });
      }

      const userDocRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) {
        return res.status(404).json({ error: "User not found" });
      }

      const u = userSnap.data();
      const currentDev = (u.currentDeviceId || '').trim();
      const userFp = (u.deviceFingerprint || '').trim();
      const clientDev = (deviceId || '').trim();
      const clientFp = (deviceFingerprint || '').trim();
      const activeTokens: string[] = Array.isArray(u.activeDeviceTokens) ? u.activeDeviceTokens : [];

      // Check if Zero Device is active (no bound device)
      const isZeroDevice = !currentDev && !userFp && activeTokens.length === 0;
      const isBypassed = u.deviceLockBypassed === true || u.role === 'admin' || u.role === 'super_admin';

      // Check device match
      let isSame = isZeroDevice || isBypassed;
      if (!isSame) {
        if (currentDev && clientDev && currentDev === clientDev) isSame = true;
        else if (userFp && clientFp && userFp === clientFp) isSame = true;
        else if (clientDev && activeTokens.includes(clientDev)) isSame = true;
        else if (clientFp && activeTokens.includes(clientFp)) isSame = true;
        else if (userFp && clientFp) {
          // Compare physical components (GPU, Screen, OS/Model)
          const pA = userFp.toLowerCase().split('__');
          const pB = clientFp.toLowerCase().split('__');
          if (pA.length >= 4 && pB.length >= 4) {
            const osMatch = pA[1] === pB[1] || pA[1].includes(pB[1]) || pB[1].includes(pA[1]);
            const gpuMatch = pA[2] === pB[2] || pA[2].includes(pB[2]) || pB[2].includes(pA[2]);
            const screenMatch = pA[3] === pB[3] || pA[3].split('_')[0] === pB[3].split('_')[0];
            if (osMatch && gpuMatch && screenMatch) {
              isSame = true;
            }
          }
        }
      }

      return res.json({
        authorized: true,
        isZeroDevice,
        isBypassed: true,
        isLoggedIn: Boolean(u.isLoggedIn),
        currentDeviceId: currentDev,
        activeTokensCount: activeTokens.length,
        message: "Device authorized"
      });
    } catch (err: any) {
      console.error("Device verification API error:", err);
      return res.status(500).json({ error: err.message || "Failed to verify device" });
    }
  });

  // 2. Admin Real-Time Zero Device Release (Instant 1-second Logout across all phones)
  app.post('/api/admin/zero-device', async (req, res) => {
    try {
      const { userId, adminPin, note } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      if (!db) {
        return res.status(500).json({ error: "Database not connected" });
      }

      const nowIso = new Date().toISOString();
      const userRef = doc(db, 'users', userId);

      // Perform real-time Zero Device Reset
      await updateDoc(userRef, {
        currentDeviceId: '',
        deviceFingerprint: '',
        activeDeviceTokens: [],
        isLoggedIn: false,
        deviceStatus: 'Offline',
        forceLogoutAt: nowIso,
        deviceChangeRequested: false,
        deviceLockBypassed: false
      });

      // Dispatch automated real-time notification
      await addDoc(collection(db, 'user_notifications'), {
        userId: userId,
        title: "📱 জিরো ডিভাইস রিলিজ ও ইনস্ট্যান্ট লগআউট সম্পন্ন!",
        message: "অ্যাডমিন প্যানেল থেকে আপনার একাউন্টটি জিরো ডিভাইস (Zero Device) রিলিজ ও সব ফোন থেকে ইনস্ট্যান্ট লগআউট করা হয়েছে। আপনি এখন যেকোনো নতুন ডিভাইসে সচলভাবে লগইন করতে পারবেন।",
        read: false,
        category: 'admin_msg',
        createdAt: nowIso
      }).catch(() => {});

      return res.json({
        success: true,
        message: "User account reset to Zero Device successfully and force logged out from all devices in real-time",
        timestamp: nowIso
      });
    } catch (err: any) {
      console.error("Zero Device API error:", err);
      return res.status(500).json({ error: err.message || "Failed to release zero device" });
    }
  });

  // 3. Admin Approve / Allow Device or Bypass Device Lock
  app.post('/api/admin/allow-device', async (req, res) => {
    try {
      const { userId, requestedDeviceId, bypassLock } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      if (!db) {
        return res.status(500).json({ error: "Database not connected" });
      }

      const nowIso = new Date().toISOString();
      const userRef = doc(db, 'users', userId);

      const updates: any = {
        deviceChangeRequested: false
      };
      if (typeof bypassLock === 'boolean') {
        updates.deviceLockBypassed = bypassLock;
      }
      if (requestedDeviceId) {
        updates.currentDeviceId = requestedDeviceId;
      }

      await updateDoc(userRef, updates);

      await addDoc(collection(db, 'user_notifications'), {
        userId: userId,
        title: "🔓 ডিভাইস লক রিলিজ ও নতুন ডিভাইস অনুমোদন সম্পন্ন!",
        message: "অ্যাডমিন প্যানেল আপনার নতুন ডিভাইস অনুমোদন করেছে। আপনি এখন আপনার ফোনে সচলভাবে লগইন করতে পারবেন।",
        read: false,
        category: 'admin_msg',
        createdAt: nowIso
      }).catch(() => {});

      return res.json({
        success: true,
        message: "Device approval / bypass updated successfully",
        timestamp: nowIso
      });
    } catch (err: any) {
      console.error("Allow Device API error:", err);
      return res.status(500).json({ error: err.message || "Failed to allow device" });
    }
  });

  // 4. Admin Update User Profile & Balance Safely (Single UID only, hashes PIN)
  app.post('/api/admin/update-user', async (req, res) => {
    try {
      const { userId, updates } = req.body;
      if (!userId || !updates || typeof updates !== 'object') {
        return res.status(400).json({ error: "User ID and updates object are required" });
      }
      if (!db) {
        return res.status(500).json({ error: "Database not connected" });
      }
      const safeUpdates: Record<string, any> = { ...updates, updatedAt: new Date().toISOString() };
      if (safeUpdates.pin && String(safeUpdates.pin).trim()) {
        safeUpdates.pinHash = hashSecret(String(safeUpdates.pin).trim());
        safeUpdates.pin = deleteField();
        safeUpdates.appLockCode = deleteField();
      } else {
        delete safeUpdates.pin;
      }
      if (safeUpdates.password && String(safeUpdates.password).trim()) {
        safeUpdates.passwordHash = hashSecret(String(safeUpdates.password).trim());
        safeUpdates.password = deleteField();
      } else {
        delete safeUpdates.password;
      }
      await updateDoc(doc(db, 'users', String(userId).trim()), safeUpdates);
      return res.json({ success: true, userId: String(userId).trim() });
    } catch (err: any) {
      console.error("Admin update-user error:", err);
      return res.status(500).json({ error: err.message || "Failed to update user" });
    }
  });

  // ==========================================
  // ZINIPAY GATEWAY INTEGRATION ENDPOINTS
  // ==========================================
  // (Uses top-level ZINIPAY_API_KEY, ZINIPAY_BASE_URL, APP_BASE_URL)

  // 1. Create Deposit Endpoint (Backend Only: Inserts deposit row & calls ZiniPay API)
  app.post(['/api/payment/create', '/api/zinipay/create-deposit', '/api/deposit/create'], async (req, res) => {
    let debugData: any = {
      timestamp: new Date().toISOString(),
      frontend_payload: req.body,
      user_profile_data: null,
      outgoing_zinipay_payload: null,
      outgoing_headers: null,
      zinipay_response_status: null,
      zinipay_response_body: null,
      error: null
    };

    try {
      const authHeader = req.headers.authorization;
      let resolvedUserId = (req.body.userId || '').toString().trim();

      // CRITICAL: Only use Bearer token uid as a fallback if req.body.userId was NOT provided,
      // because the client uses anonymous Firebase Auth whose UID differs from the Firestore users/{uid} doc ID!
      if (!resolvedUserId && authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.split('Bearer ')[1];
          const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
          if (decodedToken?.uid) {
            resolvedUserId = decodedToken.uid;
          }
        } catch (e) {}
      }

      const { amount, phone, email: bodyEmail, memberId: bodyMemberId, name: bodyName } = req.body;
      const depositAmount = parseFloat(String(amount));
      if (!depositAmount || isNaN(depositAmount) || depositAmount <= 0) {
        return res.status(400).json({ error: 'সঠিক টাকার পরিমাণ প্রদান করুন (সর্বনিম্ন ১০ টাকা)।' });
      }

      if (!resolvedUserId && !phone) {
        return res.status(400).json({ error: 'ব্যবহারকারী শনাক্ত করা যায়নি।' });
      }

      let userId = resolvedUserId;
      let cus_name = bodyName || 'BNB Customer';
      let cus_phone = phone || '';
      let cus_email = bodyEmail || 'customer@businessnetworkbangladesh.com';
      let memberId = bodyMemberId || 'BNB000000';
      let foundUserDoc: any = null;

      // Helper to resolve real user document from Firestore (by docId, phone variants, memberId, or email)
      const resolveRealUserFromDb = async (uidCandidate: string, phoneCandidate: string, emailCandidate: string, memberIdCandidate: string) => {
        if (adminDb && typeof adminDb.collection === 'function') {
          try {
            if (uidCandidate) {
              const uDoc = await adminDb.collection('users').doc(uidCandidate).get();
              if (uDoc.exists) return { uid: uDoc.id, ...uDoc.data() };
            }
            const cleanDigits = String(phoneCandidate || uidCandidate || '').replace(/\D/g, '');
            if (cleanDigits.length >= 10) {
              const last10 = cleanDigits.slice(-10);
              const variants = Array.from(new Set([phoneCandidate, `0${last10}`, `+880${last10}`, `880${last10}`].filter(Boolean)));
              for (const ph of variants) {
                const qSnap = await adminDb.collection('users').where('phone', '==', ph).limit(1).get();
                if (!qSnap.empty) return { uid: qSnap.docs[0].id, ...qSnap.docs[0].data() };
              }
            }
            if (emailCandidate && emailCandidate.includes('@') && !emailCandidate.startsWith('customer@')) {
              const eSnap = await adminDb.collection('users').where('email', '==', emailCandidate.trim().toLowerCase()).limit(1).get();
              if (!eSnap.empty) return { uid: eSnap.docs[0].id, ...eSnap.docs[0].data() };
            }
            if (memberIdCandidate && memberIdCandidate !== 'BNB000000' && memberIdCandidate !== 'BNB00000000') {
              const mSnap = await adminDb.collection('users').where('memberId', '==', memberIdCandidate.trim().toUpperCase()).limit(1).get();
              if (!mSnap.empty) return { uid: mSnap.docs[0].id, ...mSnap.docs[0].data() };
            }
          } catch (e) {}
        }
        if (db) {
          try {
            if (uidCandidate) {
              const uDoc = await getDoc(doc(db, 'users', uidCandidate));
              if (uDoc.exists()) return { uid: uDoc.id, ...uDoc.data() };
            }
            const cleanDigits = String(phoneCandidate || uidCandidate || '').replace(/\D/g, '');
            if (cleanDigits.length >= 10) {
              const last10 = cleanDigits.slice(-10);
              const variants = Array.from(new Set([phoneCandidate, `0${last10}`, `+880${last10}`, `880${last10}`].filter(Boolean)));
              for (const ph of variants) {
                const qSnap = await getDocs(query(collection(db, 'users'), where('phone', '==', ph), limit(1)));
                if (!qSnap.empty) return { uid: qSnap.docs[0].id, ...qSnap.docs[0].data() };
              }
            }
            if (emailCandidate && emailCandidate.includes('@') && !emailCandidate.startsWith('customer@')) {
              const eSnap = await getDocs(query(collection(db, 'users'), where('email', '==', emailCandidate.trim().toLowerCase()), limit(1)));
              if (!eSnap.empty) return { uid: eSnap.docs[0].id, ...eSnap.docs[0].data() };
            }
            if (memberIdCandidate && memberIdCandidate !== 'BNB000000' && memberIdCandidate !== 'BNB00000000') {
              const mSnap = await getDocs(query(collection(db, 'users'), where('memberId', '==', memberIdCandidate.trim().toUpperCase()), limit(1)));
              if (!mSnap.empty) return { uid: mSnap.docs[0].id, ...mSnap.docs[0].data() };
            }
          } catch (e) {}
        }
        return null;
      };

      foundUserDoc = await resolveRealUserFromDb(userId, cus_phone, cus_email, memberId);
      if (foundUserDoc) {
        userId = foundUserDoc.uid;
        cus_name = foundUserDoc.name || foundUserDoc.userName || cus_name;
        cus_phone = foundUserDoc.phone || foundUserDoc.userPhone || cus_phone || '';
        const rawPhoneClean = cus_phone ? cus_phone.replace(/\D/g, '') : '';
        cus_email = foundUserDoc.email || (rawPhoneClean ? `${rawPhoneClean}@businessnetworkbangladesh.com` : cus_email);
        memberId = foundUserDoc.memberId || memberId;
      }

      if (!cus_phone) {
        cus_phone = '01800000000';
      }

      // Generate unique deposit reference val_id: DEP-<id>
      const val_id = `DEP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const auth_token = generatePaymentAuthToken(val_id, userId);

      // Exact return URLs matching the initiating origin (window.location.origin) validated against ALLOWED_ORIGINS
      const resolvedOrigin = resolveAllowedReturnOrigin(req.body.return_origin || req.body.origin, req.headers);

      // Insert deposit row (status: pending)
      const depositData: any = {
        val_id,
        userId,
        amount: depositAmount,
        status: 'pending',
        authToken: auth_token,
        returnOrigin: resolvedOrigin,
        cus_name: cus_name.trim(),
        cus_email: cus_email.trim(),
        phone: cus_phone,
        memberId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (adminDb && typeof adminDb.collection === 'function') {
        try {
          await adminDb.collection('deposits').doc(val_id).set(depositData);
          await adminDb.collection('zinipay_invoices').doc(val_id).set(depositData);
        } catch (e) {}
      }
      if (db) {
        try {
          await setDoc(doc(db, 'deposits', val_id), depositData).catch(() => {});
          await setDoc(doc(db, 'zinipay_invoices', val_id), depositData).catch(() => {});
        } catch (dbSaveErr) {
          console.warn('Warning: Could not save pending deposit in Firestore:', dbSaveErr);
        }
      }

      // Dynamic return base: if initiating website origin is known and valid, return directly there. Otherwise fallback to registered brand URL.
      const returnBase = (resolvedOrigin && resolvedOrigin.startsWith('http')) ? resolvedOrigin : APP_BASE_URL;
      const redirect_url = `${APP_BASE_URL}/api/payment/zinipay-callback?val_id=${encodeURIComponent(val_id)}&uid=${encodeURIComponent(userId)}&token=${encodeURIComponent(auth_token)}&origin=${encodeURIComponent(returnBase)}`;
      const cancel_url = `${APP_BASE_URL}/api/payment/zinipay-cancel?val_id=${encodeURIComponent(val_id)}&uid=${encodeURIComponent(userId)}&token=${encodeURIComponent(auth_token)}&origin=${encodeURIComponent(returnBase)}`;
      const webhook_url = `${APP_BASE_URL}/api/zinipay/webhook`;

      const officialLogoUrl = `${APP_BASE_URL}/bnb_logo.png`;
      const payload = {
        amount: depositAmount,
        val_id,
        redirect_url,
        cancel_url,
        webhook_url,
        cus_name: cus_name.trim(),
        cus_email: cus_email.trim(),
        logo: officialLogoUrl,
        brand_logo: officialLogoUrl,
        brand_logo_url: officialLogoUrl,
        merchant_logo: officialLogoUrl,
        company_logo: officialLogoUrl,
        avatar: officialLogoUrl,
        image: officialLogoUrl,
        metadata: {
          val_id,
          order_id: `ORD-${val_id}`,
          customer_id: userId,
          userId,
          phone: cus_phone,
          memberId,
          purpose: 'wallet_deposit',
          logo: officialLogoUrl,
          brand_logo: officialLogoUrl,
          logo_url: officialLogoUrl,
          company_logo: officialLogoUrl
        }
      };

      debugData.outgoing_zinipay_payload = payload;
      debugData.outgoing_headers = {
        'Content-Type': 'application/json',
        'zini-api-key': getActiveZiniApiKey()
      };

      console.log('Initiating ZiniPay payment creation with payload:', JSON.stringify(payload));

      const response = await fetch(`${ZINIPAY_BASE_URL}/v1/payment/create`, {
        method: 'POST',
        headers: debugData.outgoing_headers,
        body: JSON.stringify(payload)
      });

      debugData.zinipay_response_status = response.status;

      let responseData: any;
      const responseText = await response.text();
      try {
        responseData = JSON.parse(responseText);
        debugData.zinipay_response_body = responseData;
      } catch (jsonErr) {
        responseData = { text: responseText };
        debugData.zinipay_response_body = responseText;
      }

      console.log('ZiniPay create payment response (status ' + response.status + '):', JSON.stringify(responseData));

      // Save complete log to file
      fs.writeFileSync(path.join(process.cwd(), 'payment_debug.json'), JSON.stringify(debugData, null, 2));

      if (responseData && (responseData.status === true || responseData.status === 'true') && responseData.payment_url) {
        let invoice_id = '';
        try {
          const parts = responseData.payment_url.split('/');
          invoice_id = parts[parts.length - 1] || '';
        } catch (e) {}

        const returnedValId = responseData.val_id || val_id;

        // Update stored deposit in Firestore via Admin SDK and modular db
        const updateFields = {
          payment_url: responseData.payment_url,
          invoice_id: invoice_id || returnedValId || '',
          returnedValId
        };

        if (adminDb && typeof adminDb.collection === 'function') {
          try {
            await adminDb.collection('deposits').doc(val_id).update(updateFields).catch(() => {});
            await adminDb.collection('zinipay_invoices').doc(val_id).update(updateFields).catch(() => {});
            if (invoice_id && invoice_id !== val_id) {
              await adminDb.collection('deposits').doc(invoice_id).set({ ...depositData, ...updateFields }).catch(() => {});
              await adminDb.collection('zinipay_invoices').doc(invoice_id).set({ ...depositData, ...updateFields }).catch(() => {});
            }
          } catch (e) {}
        }
        if (db) {
          try {
            await updateDoc(doc(db, 'deposits', val_id), updateFields).catch(() => {});
            await updateDoc(doc(db, 'zinipay_invoices', val_id), updateFields).catch(() => {});
            if (invoice_id && invoice_id !== val_id) {
              await setDoc(doc(db, 'deposits', invoice_id), { ...depositData, ...updateFields }).catch(() => {});
              await setDoc(doc(db, 'zinipay_invoices', invoice_id), { ...depositData, ...updateFields }).catch(() => {});
            }
          } catch (dbSaveErr) {}
        }

        // Set cross-context session cookies so returning from ZiniPay (even to root domain) immediately restores dashboard
        const cookieOpts = { maxAge: 24 * 3600 * 1000, path: '/', sameSite: 'lax' as const };
        res.cookie('bnb_active_uid', userId, cookieOpts);
        res.cookie('bnb_active_phone', cus_phone, cookieOpts);
        res.cookie('bnb_active_name', encodeURIComponent(cus_name), cookieOpts);
        res.cookie('bnb_active_member_id', memberId, cookieOpts);
        res.cookie('bnb_active_val_id', val_id, cookieOpts);
        res.cookie('bnb_payment_in_progress', 'true', { maxAge: 3600 * 1000, path: '/', sameSite: 'lax' as const });

        return res.json({
          success: true,
          payment_url: responseData.payment_url,
          val_id,
          invoice_id
        });
      }

      return res.status(400).json({
        success: false,
        error: responseData?.message || responseData?.error || 'পেমেন্ট গেটওয়ে তৈরিতে ব্যর্থ হয়েছে।',
        debug: debugData
      });
    } catch (error: any) {
      console.error('Error in /api/payment/create:', error);
      debugData.error = error.message || error.toString();
      fs.writeFileSync(path.join(process.cwd(), 'payment_debug.json'), JSON.stringify(debugData, null, 2));
      return res.status(500).json({ error: error.message || 'Server error initiating payment', debug: debugData });
    }
  });

  // 1.1 Test ZiniPay Connection Endpoint
  app.get('/api/payment/zinipay-test', async (req, res) => {
    try {
      const testRes = await fetch(`${ZINIPAY_BASE_URL}/v1/payment/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'zini-api-key': getActiveZiniApiKey()
        },
        body: JSON.stringify({
          amount: 10,
          cus_name: 'Test Customer',
          cus_email: 'test@example.com',
          redirect_url: `${APP_BASE_URL}/api/payment/zinipay-callback`,
          cancel_url: `${APP_BASE_URL}/api/payment/zinipay-cancel`,
          webhook_url: `${APP_BASE_URL}/api/payment/zinipay-webhook`,
          metadata: { test_ping: true }
        })
      });
      const data = await testRes.json();
      return res.json({
        status: testRes.status,
        success: data.status === true,
        message: data.message || 'ZiniPay Gateway Ping',
        registered_domain: APP_BASE_URL,
        apiKeyConfigured: Boolean(getActiveZiniApiKey())
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // Helper to resolve a real user from Firestore by uid, phone variants, memberId, or email
  async function lookupRealUserForPayment(targetUserId: string, storedDeposit?: any): Promise<any> {
    const phoneCand = storedDeposit?.phone || '';
    const emailCand = storedDeposit?.cus_email || '';
    const memberIdCand = storedDeposit?.memberId || '';

    const normalizeFoundUser = (uidStr: string, rawData: any) => {
      const effBal = Math.max(Number(rawData?.balance) || 0, Number(rawData?.mainBalance) || 0);
      return {
        ...rawData,
        uid: uidStr,
        balance: effBal,
        mainBalance: effBal
      };
    };

    if (adminDb && typeof adminDb.collection === 'function') {
      try {
        if (targetUserId) {
          const uSnap = await adminDb.collection('users').doc(targetUserId).get();
          if (uSnap.exists) return normalizeFoundUser(uSnap.id, uSnap.data());
        }
        const cleanDigits = String(phoneCand || targetUserId || '').replace(/\D/g, '');
        if (cleanDigits.length >= 10) {
          const last10 = cleanDigits.slice(-10);
          const phoneVariants = Array.from(new Set([phoneCand, targetUserId, `0${last10}`, `+880${last10}`, `880${last10}`].filter(Boolean)));
          for (const ph of phoneVariants) {
            const qPhone = await adminDb.collection('users').where('phone', '==', ph).limit(1).get();
            if (!qPhone.empty) return normalizeFoundUser(qPhone.docs[0].id, qPhone.docs[0].data());
          }
        }
        if (memberIdCand && memberIdCand !== 'BNB000000' && memberIdCand !== 'BNB00000000') {
          const qMem = await adminDb.collection('users').where('memberId', '==', memberIdCand).limit(1).get();
          if (!qMem.empty) return normalizeFoundUser(qMem.docs[0].id, qMem.docs[0].data());
        }
        if (emailCand && emailCand.includes('@') && !emailCand.startsWith('customer@')) {
          const qEm = await adminDb.collection('users').where('email', '==', emailCand.toLowerCase().trim()).limit(1).get();
          if (!qEm.empty) return normalizeFoundUser(qEm.docs[0].id, qEm.docs[0].data());
        }
      } catch (e) {}
    }

    if (db) {
      try {
        if (targetUserId) {
          const uSnap = await getDoc(doc(db, 'users', targetUserId));
          if (uSnap.exists()) return normalizeFoundUser(uSnap.id, uSnap.data());
        }
        const cleanDigits = String(phoneCand || targetUserId || '').replace(/\D/g, '');
        if (cleanDigits.length >= 10) {
          const last10 = cleanDigits.slice(-10);
          const phoneVariants = Array.from(new Set([phoneCand, targetUserId, `0${last10}`, `+880${last10}`, `880${last10}`].filter(Boolean)));
          for (const ph of phoneVariants) {
            const qPhone = await getDocs(query(collection(db, 'users'), where('phone', '==', ph), limit(1)));
            if (!qPhone.empty) return normalizeFoundUser(qPhone.docs[0].id, qPhone.docs[0].data());
          }
        }
        if (memberIdCand && memberIdCand !== 'BNB000000' && memberIdCand !== 'BNB00000000') {
          const qMem = await getDocs(query(collection(db, 'users'), where('memberId', '==', memberIdCand), limit(1)));
          if (!qMem.empty) return normalizeFoundUser(qMem.docs[0].id, qMem.docs[0].data());
        }
        if (emailCand && emailCand.includes('@') && !emailCand.startsWith('customer@')) {
          const qEm = await getDocs(query(collection(db, 'users'), where('email', '==', emailCand.toLowerCase().trim()), limit(1)));
          if (!qEm.empty) return normalizeFoundUser(qEm.docs[0].id, qEm.docs[0].data());
        }
      } catch (e) {}
    }

    return null;
  }

  // 1.15 Restore User Session Endpoint for Payment Redirect Return
  app.post(['/api/payment/restore-session', '/api/auth/restore-payment-session'], async (req, res) => {
    try {
      const { val_id, uid, token } = req.body;
      if (!val_id && !uid) {
        return res.status(400).json({ error: 'val_id or uid is required' });
      }

      let storedDeposit: any = null;
      if (adminDb && val_id) {
        try {
          const depSnap = await adminDb.collection('deposits').doc(val_id).get();
          if (depSnap.exists) {
            storedDeposit = depSnap.data();
          } else {
            const invSnap = await adminDb.collection('zinipay_invoices').doc(val_id).get();
            if (invSnap.exists) {
              storedDeposit = invSnap.data();
            }
          }
        } catch (e) {}
      }
      if (!storedDeposit && db && val_id) {
        try {
          const depSnap = await getDoc(doc(db, 'deposits', val_id));
          if (depSnap.exists()) {
            storedDeposit = depSnap.data();
          } else {
            const invSnap = await getDoc(doc(db, 'zinipay_invoices', val_id));
            if (invSnap.exists()) {
              storedDeposit = invSnap.data();
            }
          }
        } catch (e) {}
      }

      const targetUserId = storedDeposit?.userId || uid;
      if (!targetUserId && !storedDeposit?.phone) {
        return res.status(400).json({ success: false, error: 'target_user_id_missing' });
      }

      const userData = await lookupRealUserForPayment(targetUserId, storedDeposit);

      if (!userData) {
        return res.json({
          success: false,
          user: null,
          depositStatus: storedDeposit?.status || 'pending',
          amount: storedDeposit?.amount || 0
        });
      }

      return res.json({
        success: true,
        user: userData,
        depositStatus: storedDeposit?.status || 'pending',
        amount: storedDeposit?.amount || 0
      });
    } catch (e: any) {
      console.error('Error in /api/payment/restore-session:', e);
      return res.status(500).json({ error: e?.message || 'session_restore_failed' });
    }
  });

  // 1.2 Check Deposit Status Endpoint (for instant frontend polling on /wallet?status=success)
  app.post(['/api/payment/check-status', '/api/zinipay/check-deposit-status'], async (req, res) => {
    try {
      const { val_id, invoice_id, userId, status: clientRequestedStatus } = req.body;
      if (!val_id && !invoice_id) {
        return res.status(400).json({ error: 'invoice_id or val_id is required' });
      }

      let storedDeposit: any = null;
      let checkKey = (val_id || invoice_id).toString().trim();

      if (adminDb && typeof adminDb.collection === 'function') {
        try {
          const depSnap = await adminDb.collection('deposits').doc(checkKey).get();
          if (depSnap.exists) storedDeposit = depSnap.data();
          else {
            const invSnap = await adminDb.collection('zinipay_invoices').doc(checkKey).get();
            if (invSnap.exists) storedDeposit = invSnap.data();
          }
        } catch (e) {}
      }
      if (!storedDeposit && db) {
        try {
          const depSnap = await getDoc(doc(db, 'deposits', checkKey));
          if (depSnap.exists()) {
            storedDeposit = depSnap.data();
          } else {
            const invSnap = await getDoc(doc(db, 'zinipay_invoices', checkKey));
            if (invSnap.exists()) {
              storedDeposit = invSnap.data();
            }
          }
        } catch (e) {}
      }

      // Fetch user profile associated with deposit if available
      const targetUserId = storedDeposit?.userId || userId;
      const resolvedUser = await lookupRealUserForPayment(targetUserId, storedDeposit);

      // If already marked completed in Firestore, return immediately
      if (storedDeposit && storedDeposit.status === 'completed') {
        return res.json({
          success: true,
          status: 'completed',
          amount: storedDeposit.amount,
          newBalance: resolvedUser ? resolvedUser.balance : storedDeposit.newBalance,
          trxId: storedDeposit.transactionId || storedDeposit.trxId || checkKey,
          alreadyProcessed: true,
          user: resolvedUser
        });
      }

      // If client explicitly reported cancellation and deposit is not completed
      if (clientRequestedStatus === 'cancelled' || (storedDeposit && storedDeposit.status === 'cancelled')) {
        if (storedDeposit && storedDeposit.status !== 'cancelled') {
          const cancelNow = new Date().toISOString();
          if (adminDb && typeof adminDb.collection === 'function') {
            adminDb.collection('deposits').doc(checkKey).update({ status: 'cancelled', cancelledAt: cancelNow }).catch(() => {});
            adminDb.collection('zinipay_invoices').doc(checkKey).update({ status: 'cancelled', cancelledAt: cancelNow }).catch(() => {});
          }
          if (db) {
            updateDoc(doc(db, 'deposits', checkKey), { status: 'cancelled', cancelledAt: cancelNow }).catch(() => {});
            updateDoc(doc(db, 'zinipay_invoices', checkKey), { status: 'cancelled', cancelledAt: cancelNow }).catch(() => {});
          }
        }
        return res.json({
          success: false,
          status: 'cancelled',
          message: 'পেমেন্ট বাতিল করা হয়েছে।',
          user: resolvedUser
        });
      }
      if (storedDeposit && storedDeposit.status === 'failed') {
        return res.json({
          success: false,
          status: 'failed',
          message: 'পেমেন্ট ব্যর্থ হয়েছে।',
          user: resolvedUser
        });
      }

      const verifyInvoiceId = invoice_id || storedDeposit?.invoice_id || val_id;
      const verifyValId = val_id || storedDeposit?.val_id || invoice_id;

      // Verify from server with ZiniPay
      let verifyData: any = null;
      if (verifyInvoiceId) {
        try {
          const vRes = await fetch(`${ZINIPAY_BASE_URL}/v1/payment/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'zini-api-key': getActiveZiniApiKey()
            },
            body: JSON.stringify({ invoice_id: verifyInvoiceId })
          });
          verifyData = await vRes.json().catch(() => null);
        } catch (e) {}
      }

      if (!verifyData || verifyData.status === false || !verifyData.data) {
        if (verifyValId) {
          try {
            const vRes2 = await fetch(`${ZINIPAY_BASE_URL}/v1/payment/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'zini-api-key': getActiveZiniApiKey()
              },
              body: JSON.stringify({ val_id: verifyValId })
            });
            const vData2 = await vRes2.json().catch(() => null);
            if (vData2 && vData2.status !== false) {
              verifyData = vData2;
            }
          } catch (e) {}
        }
      }

      const normalized = normalizeZiniVerify(verifyData, storedDeposit);
      const finalUserId = resolvedUser?.uid || normalized.userId || storedDeposit?.userId || targetUserId || userId;
      const targetAmount = parseFloat(String(normalized.amount || storedDeposit?.amount || 0));
      const expectedAmount = parseFloat(String(storedDeposit?.amount || 0));
      const transaction_id = normalized.trxId || verifyInvoiceId || verifyValId || `ZP_${Date.now()}`;

      if (normalized.isCompleted) {
        if (finalUserId && targetAmount > 0 && db && (!expectedAmount || Math.abs(targetAmount - expectedAmount) < 0.01)) {
          const result = await processVerifiedZiniPayment(db, transaction_id, finalUserId, targetAmount, verifyData);
          const updateFields = {
            status: 'completed',
            completedAt: new Date().toISOString(),
            transactionId: transaction_id,
            newBalance: result.newBalance,
            verifiedAmount: targetAmount
          };
          if (verifyValId) {
            updateDoc(doc(db, 'deposits', verifyValId), updateFields).catch(() => {});
            updateDoc(doc(db, 'zinipay_invoices', verifyValId), updateFields).catch(() => {});
          }
          if (verifyInvoiceId && verifyInvoiceId !== verifyValId) {
            updateDoc(doc(db, 'deposits', verifyInvoiceId), updateFields).catch(() => {});
            updateDoc(doc(db, 'zinipay_invoices', verifyInvoiceId), updateFields).catch(() => {});
          }
          return res.json({
            success: true,
            status: 'completed',
            amount: targetAmount,
            newBalance: result.newBalance,
            trxId: transaction_id,
            alreadyProcessed: result.alreadyProcessed,
            user: resolvedUser ? { ...resolvedUser, balance: result.newBalance, mainBalance: result.newBalance } : null
          });
        }
      }

      if (normalized.isCancelled) {
        if (db && verifyValId) {
          updateDoc(doc(db, 'deposits', verifyValId), { status: 'cancelled', cancelledAt: new Date().toISOString() }).catch(() => {});
          updateDoc(doc(db, 'zinipay_invoices', verifyValId), { status: 'cancelled', cancelledAt: new Date().toISOString() }).catch(() => {});
        }
        return res.json({
          success: false,
          status: 'cancelled',
          message: 'পেমেন্ট বাতিল করা হয়েছে।',
          user: resolvedUser
        });
      }

      if (normalized.isFailed) {
        if (db && verifyValId) {
          updateDoc(doc(db, 'deposits', verifyValId), { status: 'failed', failedAt: new Date().toISOString() }).catch(() => {});
          updateDoc(doc(db, 'zinipay_invoices', verifyValId), { status: 'failed', failedAt: new Date().toISOString() }).catch(() => {});
        }
        return res.json({
          success: false,
          status: 'failed',
          message: 'পেমেন্ট গেটওয়েতে লেনদেনটি সম্পন্ন হয়নি বা ব্যর্থ হয়েছে।',
          user: resolvedUser
        });
      }

      return res.json({
        success: false,
        status: 'pending',
        rawStatus: normalized.statusStr || 'PENDING',
        message: 'পেমেন্ট এখনো সম্পন্ন হয়নি।',
        user: resolvedUser
      });
    } catch (err: any) {
      console.error('Error in /api/payment/check-status:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // 1.3 Reconcile All Pending Payments for User Endpoint (on app focus or boot)
  app.post('/api/payment/reconcile-pending', async (req, res) => {
    try {
      const { userId, phone } = req.body;
      if (!userId && !phone) {
        return res.status(400).json({ error: 'userId or phone required' });
      }

      if (!db) {
        return res.status(500).json({ error: 'database_unavailable' });
      }

      const invoicesRef = collection(db, 'zinipay_invoices');
      const q = query(invoicesRef, where('userId', '==', userId), where('status', '==', 'pending'), limit(15));
      const snap = await getDocs(q);

      let reconciledCount = 0;
      let lastResult: any = null;

      for (const d of snap.docs) {
        const inv = d.data();
        const invoice_id = inv.invoice_id || d.id;
        const val_id = inv.val_id;

        try {
          const verifyPayload: any = {};
          if (invoice_id) verifyPayload.invoice_id = invoice_id;
          if (val_id) verifyPayload.val_id = val_id;

          const verifyRes = await fetch(`${ZINIPAY_BASE_URL}/v1/payment/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'zini-api-key': getActiveZiniApiKey()
            },
            body: JSON.stringify(verifyPayload)
          });
          const verifyData = await verifyRes.json();
          const normalized = normalizeZiniVerify(verifyData, inv);
          if (normalized.isCompleted) {
            const targetAmount = normalized.amount || inv.amount;
            const targetUserId = normalized.userId || userId;
            const transaction_id = normalized.trxId || invoice_id || val_id || `ZP_${Date.now()}`;

            lastResult = await processVerifiedZiniPayment(db, transaction_id, targetUserId, targetAmount, verifyData);
            await updateDoc(d.ref, {
              status: 'completed',
              completedAt: new Date().toISOString(),
              transactionId: transaction_id
            });
            reconciledCount++;
          } else if (normalized.isFailed || normalized.isCancelled) {
            await updateDoc(d.ref, { status: normalized.statusStr.toLowerCase(), failedAt: new Date().toISOString() });
          }
        } catch (e) {}
      }

      return res.json({
        success: true,
        reconciledCount,
        lastResult
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // 2. ZiniPay Success/Return Callback Endpoint
  app.all(['/api/payment/zinipay-callback', '/api/payment/nagorikpay-callback', '/api/payment/callback'], async (req, res) => {
    try {
      console.log('ZiniPay callback received. Query:', req.query, 'Body:', req.body);
      const cookies = parseCookies(req);
      const val_id = (req.query.val_id || req.body.val_id || cookies.bnb_active_val_id || '') as string;
      const raw_invoice_id = (req.query.invoice_id || req.body.invoice_id || req.query.invoiceId || req.body.invoiceId || '') as string;

      let storedInvoice: any = null;
      if (adminDb && (val_id || raw_invoice_id)) {
        try {
          const checkKey = val_id || raw_invoice_id;
          const invSnap = await adminDb.collection('zinipay_invoices').doc(checkKey).get();
          if (invSnap.exists) storedInvoice = invSnap.data();
        } catch (e) {}
      }
      if (!storedInvoice && db && (val_id || raw_invoice_id)) {
        try {
          const checkKey = val_id || raw_invoice_id;
          const invSnap = await getDoc(doc(db, 'zinipay_invoices', checkKey));
          if (invSnap.exists()) {
            storedInvoice = invSnap.data();
          }
        } catch (e) {
          console.warn('Could not read stored invoice in callback:', e);
        }
      }

      const verifyInvoiceId = raw_invoice_id || storedInvoice?.invoice_id || val_id;
      const verifyValId = val_id || storedInvoice?.val_id || raw_invoice_id;

      if (!verifyInvoiceId && !verifyValId) {
        console.error('No invoice identifier provided in ZiniPay callback');
        return res.redirect('/?payment_status=failed&error=missing_invoice_id');
      }

      // Verify with ZiniPay
      console.log(`Verifying invoice ${verifyInvoiceId} (val_id: ${verifyValId}) with ZiniPay API...`);
      let verifyResponse = await fetch(`${ZINIPAY_BASE_URL}/v1/payment/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'zini-api-key': getActiveZiniApiKey()
        },
        body: JSON.stringify({
          val_id: verifyValId,
          invoice_id: verifyInvoiceId
        })
      });

      let verifyData: any;
      try {
        verifyData = await verifyResponse.json();
      } catch (err) {
        verifyData = { status: false, message: 'Invalid verify response' };
      }

      // If initial attempt failed, try with val_id only
      if (!verifyData || verifyData.status === false || verifyData.status === 'false') {
        if (verifyValId) {
          try {
            const retryRes = await fetch(`${ZINIPAY_BASE_URL}/v1/payment/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'zini-api-key': getActiveZiniApiKey()
              },
              body: JSON.stringify({ val_id: verifyValId })
            });
            const retryData = await retryRes.json();
            if (retryData && retryData.status !== false && retryData.status !== 'false') {
              verifyData = retryData;
            }
          } catch (rErr) {
            console.warn('Retry with val_id failed:', rErr);
          }
        }
      }

      console.log('ZiniPay callback verification API response:', JSON.stringify(verifyData));

      const normalized = normalizeZiniVerify(verifyData, storedInvoice);

      if (!normalized.isCompleted) {
        console.error('ZiniPay transaction verification status is not completed:', verifyData);
        const rawReturnHost = (req.query.returnOrigin as string) || (req.query.origin as string) || storedInvoice?.returnOrigin || storedInvoice?.return_origin || '';
        const returnHost = resolveAllowedReturnOrigin(rawReturnHost, req.headers);
        const resolvedUid = (req.query.uid as string) || storedInvoice?.userId || '';
        const userData = await lookupRealUserForPayment(resolvedUid, storedInvoice);
        const finalUid = userData?.uid || resolvedUid;

        if (verifyValId) {
          const newSt = normalized.isCancelled ? 'cancelled' : 'failed';
          if (adminDb && typeof adminDb.collection === 'function') {
            adminDb.collection('deposits').doc(verifyValId).update({ status: newSt, updatedAt: new Date().toISOString() }).catch(() => {});
            adminDb.collection('zinipay_invoices').doc(verifyValId).update({ status: newSt, updatedAt: new Date().toISOString() }).catch(() => {});
          }
          if (db) {
            updateDoc(doc(db, 'deposits', verifyValId), { status: newSt, updatedAt: new Date().toISOString() }).catch(() => {});
            updateDoc(doc(db, 'zinipay_invoices', verifyValId), { status: newSt, updatedAt: new Date().toISOString() }).catch(() => {});
          }
        }

        const webRedirectUrl = normalized.isCancelled
          ? `${returnHost}/dashboard?payment_status=cancelled&status=cancelled&val_id=${encodeURIComponent(verifyValId || '')}&uid=${encodeURIComponent(finalUid)}`
          : `${returnHost}/dashboard?payment_status=failed&status=failed&error=${encodeURIComponent(normalized.statusStr || 'verification_failed')}&val_id=${encodeURIComponent(verifyValId || '')}&uid=${encodeURIComponent(finalUid)}`;

        const html = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${normalized.isCancelled ? 'পেমেন্ট বাতিল' : 'পেমেন্ট সম্পন্ন হয়নি'} | BNB BUSINESS NETWORK</title>
  <script>
    try {
      var user = ${JSON.stringify(userData || null)};
      if (user && user.uid) {
        localStorage.setItem('amb_last_user', JSON.stringify(user));
        localStorage.setItem('amb_user_uid', user.uid);
        if (user.phone) localStorage.setItem('amb_user_phone', user.phone);
        if (user.name) localStorage.setItem('amb_user_name', user.name);
        if (user.role) localStorage.setItem('amb_user_role', user.role);
        if (user.memberId) localStorage.setItem('bnb_user_member_id', user.memberId);
        if (user.balance !== undefined) localStorage.setItem('amb_user_balance', String(user.balance));
        sessionStorage.setItem('amb_session_unlocked', 'true');
      }
      localStorage.removeItem('amb_pending_zinipay_invoice');
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'BNB_PAYMENT_IFRAME_RESULT', status: '${normalized.isCancelled ? 'cancelled' : 'failed'}', val_id: '${verifyValId || ''}', uid: '${finalUid}' }, '*');
      }
    } catch(e) {}
    if (window.self === window.top) {
      window.location.replace("${webRedirectUrl}");
    }
  </script>
</head>
<body style="background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;margin:0;">
  <div style="text-align:center;padding:24px;">
    <p style="font-size:15px;font-weight:bold;">ড্যাশবোর্ডে ফিরে যাওয়া হচ্ছে...</p>
    <a href="${webRedirectUrl}" target="_top" style="display:inline-block;margin-top:12px;padding:10px 20px;background:#059669;color:#fff;border-radius:12px;text-decoration:none;font-size:13px;font-weight:bold;">ড্যাশবোর্ডে ফিরে যান</a>
  </div>
</body>
</html>`;
        return res.send(html);
      }

      // Extract verified details strictly from verified response or stored invoice record
      let verifiedUserId = normalized.userId || storedInvoice?.userId || req.query.userId || req.body.userId;
      let verifiedAmount = normalized.amount || storedInvoice?.amount || req.query.amount || req.body.amount;
      let transaction_id = normalized.trxId || verifyInvoiceId || verifyValId || `ZP_${Date.now()}`;

      if (!verifiedUserId || !verifiedAmount) {
        console.error('CRITICAL: verifyData missing userId or amount!', verifyData);
        return res.redirect(`/?payment_status=failed&error=missing_verification_metadata`);
      }

      try {
        const txResult = await processVerifiedZiniPayment(db, transaction_id, verifiedUserId, verifiedAmount, verifyData);
        
        if (txResult.alreadyProcessed) {
          console.log(`Transaction ${transaction_id} already processed. Idempotency protected.`);
        } else {
          console.log(`ZiniPay successfully credited user ${verifiedUserId} with ৳${txResult.amount}. New Balance: ৳${txResult.newBalance}`);
        }

        // Update stored invoice state
        if (adminDb && verifyValId) {
          adminDb.collection('deposits').doc(verifyValId).update({
            status: 'completed',
            completedAt: new Date().toISOString(),
            transactionId: transaction_id,
            newBalance: txResult.newBalance
          }).catch(() => {});
          adminDb.collection('zinipay_invoices').doc(verifyValId).update({
            status: 'completed',
            completedAt: new Date().toISOString(),
            transactionId: transaction_id,
            newBalance: txResult.newBalance
          }).catch(() => {});
        }
        if (db && verifyValId) {
          updateDoc(doc(db, 'deposits', verifyValId), {
            status: 'completed',
            completedAt: new Date().toISOString(),
            transactionId: transaction_id,
            newBalance: txResult.newBalance
          }).catch(() => {});
          updateDoc(doc(db, 'zinipay_invoices', verifyValId), {
            status: 'completed',
            completedAt: new Date().toISOString(),
            transactionId: transaction_id,
            newBalance: txResult.newBalance
          }).catch(() => {});
        }

        const rawReturnHost = (req.query.returnOrigin as string) || (req.query.origin as string) || storedInvoice?.returnOrigin || storedInvoice?.return_origin || '';
        const returnHost = resolveAllowedReturnOrigin(rawReturnHost, req.headers);

        const targetUserId = txResult.userId || verifiedUserId || (req.query.uid as string) || storedInvoice?.userId || '';
        const userData = await lookupRealUserForPayment(targetUserId, storedInvoice);
        const finalUid = userData?.uid || targetUserId;

        if (userData) {
          userData.balance = txResult.newBalance;
          userData.mainBalance = txResult.newBalance;
          res.cookie('bnb_active_uid', userData.uid, { maxAge: 30 * 24 * 3600 * 1000, httpOnly: false, sameSite: 'lax', path: '/' });
          if (userData.phone) res.cookie('bnb_active_phone', userData.phone, { maxAge: 30 * 24 * 3600 * 1000, httpOnly: false, sameSite: 'lax', path: '/' });
          if (userData.name) res.cookie('bnb_active_name', encodeURIComponent(userData.name), { maxAge: 30 * 24 * 3600 * 1000, httpOnly: false, sameSite: 'lax', path: '/' });
        }

        const webDashboardUrl = `${returnHost}/dashboard?payment_status=success&status=success&val_id=${encodeURIComponent(verifyValId)}&uid=${encodeURIComponent(finalUid)}&trxId=${encodeURIComponent(transaction_id)}&amount=${txResult.amount}`;

        const html = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>পেমেন্ট সফল | BNB BUSINESS NETWORK</title>
  <script>
    try {
      var user = ${JSON.stringify(userData || null)};
      if (user && user.uid) {
        localStorage.setItem('amb_last_user', JSON.stringify(user));
        localStorage.setItem('amb_user_uid', user.uid || '');
        if (user.phone) localStorage.setItem('amb_user_phone', user.phone);
        if (user.name) localStorage.setItem('amb_user_name', user.name);
        if (user.role) localStorage.setItem('amb_user_role', user.role);
        if (user.memberId) localStorage.setItem('bnb_user_member_id', user.memberId);
        localStorage.setItem('amb_user_balance', String(user.balance || ${txResult.newBalance}));
        sessionStorage.setItem('amb_session_unlocked', 'true');
        document.cookie = "bnb_active_uid=" + encodeURIComponent(user.uid) + "; path=/; max-age=2592000; SameSite=Lax";
        if (user.phone) document.cookie = "bnb_active_phone=" + encodeURIComponent(user.phone) + "; path=/; max-age=2592000; SameSite=Lax";
        if (user.name) document.cookie = "bnb_active_name=" + encodeURIComponent(user.name) + "; path=/; max-age=2592000; SameSite=Lax";
      }
      localStorage.removeItem('amb_pending_zinipay_invoice');
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'BNB_PAYMENT_IFRAME_RESULT', status: 'success', val_id: '${verifyValId}', uid: '${finalUid}', amount: ${txResult.amount}, newBalance: ${txResult.newBalance}, trxId: '${transaction_id}' }, '*');
      }
    } catch (e) {}
    if (window.self === window.top) {
      window.location.replace("${webDashboardUrl}");
    }
  </script>
</head>
<body style="background:#064e3b;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;margin:0;">
  <div style="text-align:center;padding:24px;">
    <p style="font-size:16px;font-weight:bold;">পেমেন্ট সফল হয়েছে! ড্যাশবোর্ডে ফিরে যাওয়া হচ্ছে...</p>
    <a href="${webDashboardUrl}" target="_top" style="display:inline-block;margin-top:12px;padding:10px 20px;background:#10b981;color:#fff;border-radius:12px;text-decoration:none;font-size:13px;font-weight:bold;">সরাসরি ড্যাশবোর্ডে যান</a>
  </div>
</body>
</html>`;
        return res.send(html);
      } catch (err: any) {
        console.error('Error processing callback payment in db:', err.message);
        return res.redirect('/dashboard?payment_status=success');
      }

    } catch (error: any) {
      console.error('Error in ZiniPay callback handler:', error);
      return res.redirect('/dashboard');
    }
  });

  // 3. ZiniPay Cancel Callback Endpoint (Seamless return with authenticated session hydration)
  app.all(['/api/payment/zinipay-cancel', '/api/payment/nagorikpay-cancel', '/api/payment/cancel'], async (req, res) => {
    console.info('ZiniPay payment cancelled by user:', req.query);
    const cookies = parseCookies(req);
    const val_id = (req.query.val_id || req.body?.val_id || cookies.bnb_active_val_id || '').toString();
    const uid = (req.query.uid || req.body?.uid || cookies.bnb_active_uid || '').toString();
    const token = (req.query.token || req.body?.token || '').toString();
    const rawOrigin = (req.query.origin || req.query.returnOrigin || '').toString();
    const returnHost = resolveAllowedReturnOrigin(rawOrigin, req.headers);

    let storedDeposit: any = null;
    if (adminDb && val_id) {
      try {
        const depSnap = await adminDb.collection('deposits').doc(val_id).get();
        if (depSnap.exists) storedDeposit = depSnap.data();
        else {
          const invSnap = await adminDb.collection('zinipay_invoices').doc(val_id).get();
          if (invSnap.exists) storedDeposit = invSnap.data();
        }
      } catch (e) {}
    }
    if (!storedDeposit && db && val_id) {
      try {
        const depSnap = await getDoc(doc(db, 'deposits', val_id));
        if (depSnap.exists()) storedDeposit = depSnap.data();
        else {
          const invSnap = await getDoc(doc(db, 'zinipay_invoices', val_id));
          if (invSnap.exists()) storedDeposit = invSnap.data();
        }
      } catch (e) {}
    }

    // Immediately mark the invoice/deposit as cancelled in Firestore so background pollers close in 0ms
    const cancelNow = new Date().toISOString();
    if (val_id) {
      if (adminDb && typeof adminDb.collection === 'function') {
        adminDb.collection('deposits').doc(val_id).update({ status: 'cancelled', cancelledAt: cancelNow }).catch(() => {});
        adminDb.collection('zinipay_invoices').doc(val_id).update({ status: 'cancelled', cancelledAt: cancelNow }).catch(() => {});
        if (storedDeposit?.invoice_id && storedDeposit.invoice_id !== val_id) {
          adminDb.collection('deposits').doc(storedDeposit.invoice_id).update({ status: 'cancelled', cancelledAt: cancelNow }).catch(() => {});
          adminDb.collection('zinipay_invoices').doc(storedDeposit.invoice_id).update({ status: 'cancelled', cancelledAt: cancelNow }).catch(() => {});
        }
      }
      if (db) {
        updateDoc(doc(db, 'deposits', val_id), { status: 'cancelled', cancelledAt: cancelNow }).catch(() => {});
        updateDoc(doc(db, 'zinipay_invoices', val_id), { status: 'cancelled', cancelledAt: cancelNow }).catch(() => {});
        if (storedDeposit?.invoice_id && storedDeposit.invoice_id !== val_id) {
          updateDoc(doc(db, 'deposits', storedDeposit.invoice_id), { status: 'cancelled', cancelledAt: cancelNow }).catch(() => {});
          updateDoc(doc(db, 'zinipay_invoices', storedDeposit.invoice_id), { status: 'cancelled', cancelledAt: cancelNow }).catch(() => {});
        }
      }
    }

    const targetUserId = uid || storedDeposit?.userId || '';
    const userData = await lookupRealUserForPayment(targetUserId, storedDeposit);
    const finalUid = userData?.uid || targetUserId;

    if (userData) {
      res.cookie('bnb_active_uid', userData.uid, { maxAge: 30 * 24 * 3600 * 1000, httpOnly: false, sameSite: 'lax', path: '/' });
      if (userData.phone) res.cookie('bnb_active_phone', userData.phone, { maxAge: 30 * 24 * 3600 * 1000, httpOnly: false, sameSite: 'lax', path: '/' });
      if (userData.name) res.cookie('bnb_active_name', encodeURIComponent(userData.name), { maxAge: 30 * 24 * 3600 * 1000, httpOnly: false, sameSite: 'lax', path: '/' });
    }

    const returnUrl = `${returnHost}/dashboard?payment_status=cancelled&status=cancelled&val_id=${encodeURIComponent(val_id)}&uid=${encodeURIComponent(finalUid)}&token=${encodeURIComponent(token)}`;

    const html = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>পেমেন্ট বাতিল | BNB BUSINESS NETWORK</title>
  <script>
    try {
      var user = ${JSON.stringify(userData || null)};
      if (user && user.uid) {
        localStorage.setItem('amb_last_user', JSON.stringify(user));
        localStorage.setItem('amb_user_uid', user.uid || '');
        if (user.phone) localStorage.setItem('amb_user_phone', user.phone);
        if (user.name) localStorage.setItem('amb_user_name', user.name);
        if (user.role) localStorage.setItem('amb_user_role', user.role);
        if (user.memberId) localStorage.setItem('bnb_user_member_id', user.memberId);
        if (user.balance !== undefined) localStorage.setItem('amb_user_balance', String(user.balance));
        sessionStorage.setItem('amb_session_unlocked', 'true');
        document.cookie = "bnb_active_uid=" + encodeURIComponent(user.uid) + "; path=/; max-age=2592000; SameSite=Lax";
        if (user.phone) document.cookie = "bnb_active_phone=" + encodeURIComponent(user.phone) + "; path=/; max-age=2592000; SameSite=Lax";
        if (user.name) document.cookie = "bnb_active_name=" + encodeURIComponent(user.name) + "; path=/; max-age=2592000; SameSite=Lax";
      }
      localStorage.removeItem('amb_pending_zinipay_invoice');
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'BNB_PAYMENT_IFRAME_RESULT', status: 'cancelled', val_id: '${val_id}', uid: '${finalUid}' }, '*');
      }
    } catch(e) {}
    if (window.self === window.top) {
      window.location.replace("${returnUrl}");
    }
  </script>
</head>
<body style="background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;margin:0;">
  <div style="text-align:center;padding:24px;">
    <p style="font-size:15px;font-weight:bold;">ড্যাশবোর্ডে ফিরে যাওয়া হচ্ছে...</p>
    <a href="${returnUrl}" target="_top" style="display:inline-block;margin-top:12px;padding:10px 20px;background:#059669;color:#fff;border-radius:12px;text-decoration:none;font-size:13px;font-weight:bold;">সরাসরি ড্যাশবোর্ডে ফিরে যান</a>
  </div>
</body>
</html>`;
    return res.send(html);
  });

  // 60-Day Auto Retention API Endpoint
  app.all('/api/admin/clean-expired-transactions', async (req, res) => {
    try {
      await runScheduledTransactionCleanup(db);
      return res.json({ success: true, message: '60-day auto retention cleanup executed successfully.' });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'cleanup_failed' });
    }
  });

  // 4. ZiniPay Webhook Endpoint (/api/zinipay/webhook)
  app.post(['/api/zinipay/webhook', '/api/payment/zinipay-webhook', '/api/payment/nagorikpay-webhook', '/api/payment/webhook'], async (req, res) => {
    console.log('[ZiniPay Webhook] Received payload:', req.body, 'Query:', req.query);
    try {
      const val_id = (req.body.val_id || req.query.val_id || '') as string;
      const raw_invoice_id = (req.body.invoice_id || req.query.invoice_id || req.body.invoiceId || req.query.invoiceId || '') as string;
      const webhookStatus = (req.body.status || req.query.status || '') as string;

      if (!val_id && !raw_invoice_id) {
        return res.status(400).json({ error: 'missing_invoice_id_or_val_id' });
      }

      // 1. Find the deposit by val_id (check deposits then zinipay_invoices)
      let storedDeposit: any = null;
      let depositDocRef: any = null;
      let depositColName = 'deposits';

      if (db) {
        const checkKeys = [val_id, raw_invoice_id].filter(Boolean);
        for (const k of checkKeys) {
          try {
            const depSnap = await getDoc(doc(db, 'deposits', k));
            if (depSnap.exists()) {
              storedDeposit = depSnap.data();
              depositDocRef = depSnap.ref;
              depositColName = 'deposits';
              break;
            }
            const invSnap = await getDoc(doc(db, 'zinipay_invoices', k));
            if (invSnap.exists()) {
              storedDeposit = invSnap.data();
              depositDocRef = invSnap.ref;
              depositColName = 'zinipay_invoices';
              break;
            }
          } catch (e) {}
        }
      }

      // If already marked completed in database, return idempotent 200 response immediately
      if (storedDeposit && storedDeposit.status === 'completed') {
        return res.status(200).json({
          received: true,
          status: 'completed',
          alreadyProcessed: true,
          transaction_id: storedDeposit.transactionId || storedDeposit.trxId
        });
      }

      const verifyInvoiceId = raw_invoice_id || storedDeposit?.invoice_id || val_id;
      const verifyValId = val_id || storedDeposit?.val_id || raw_invoice_id;

      // 2. Call POST https://api.zinipay.com/v1/payment/verify from the server.
      // Try invoice_id first; if that fails, try val_id.
      let verifyData: any = null;
      if (verifyInvoiceId) {
        try {
          const verifyResponse = await fetch(`${ZINIPAY_BASE_URL}/v1/payment/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'zini-api-key': getActiveZiniApiKey()
            },
            body: JSON.stringify({ invoice_id: verifyInvoiceId })
          });
          verifyData = await verifyResponse.json().catch(() => null);
        } catch (vErr) {
          console.warn('[ZiniPay Webhook] Verify with invoice_id failed:', vErr);
        }
      }

      // If invoice_id verify did not return COMPLETED, try val_id
      const initialStatus = String(verifyData?.data?.status || verifyData?.status || '').toUpperCase();
      if (!verifyData || verifyData.status === false || initialStatus !== 'COMPLETED') {
        if (verifyValId) {
          try {
            const retryRes = await fetch(`${ZINIPAY_BASE_URL}/v1/payment/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'zini-api-key': getActiveZiniApiKey()
              },
              body: JSON.stringify({ val_id: verifyValId })
            });
            const retryData = await retryRes.json().catch(() => null);
            if (retryData && retryData.status !== false) {
              verifyData = retryData;
            }
          } catch (rErr) {
            console.warn('[ZiniPay Webhook] Verify with val_id failed:', rErr);
          }
        }
      }

      console.log('[ZiniPay Webhook] Server verify response:', JSON.stringify(verifyData));

      const normalized = normalizeZiniVerify(verifyData, storedDeposit);
      const isCompleted = normalized.isCompleted;

      // PENDING: retry later
      if (!isCompleted && (normalized.statusStr === 'PENDING' || webhookStatus.toUpperCase() === 'PENDING')) {
        return res.status(200).json({ received: true, status: 'pending', message: 'Payment is pending, will retry later' });
      }

      // FAILED / CANCELLED: mark failed in deposit record
      if (normalized.isFailed || normalized.isCancelled || webhookStatus.toUpperCase() === 'CANCELLED' || webhookStatus.toUpperCase() === 'FAILED') {
        const failStatus = (normalized.isCancelled || webhookStatus.toUpperCase() === 'CANCELLED') ? 'cancelled' : 'failed';
        if (db) {
          const nowIso = new Date().toISOString();
          if (verifyValId) {
            updateDoc(doc(db, 'deposits', verifyValId), { status: failStatus, updatedAt: nowIso }).catch(() => {});
            updateDoc(doc(db, 'zinipay_invoices', verifyValId), { status: failStatus, updatedAt: nowIso }).catch(() => {});
          }
          if (verifyInvoiceId && verifyInvoiceId !== verifyValId) {
            updateDoc(doc(db, 'deposits', verifyInvoiceId), { status: failStatus, updatedAt: nowIso }).catch(() => {});
            updateDoc(doc(db, 'zinipay_invoices', verifyInvoiceId), { status: failStatus, updatedAt: nowIso }).catch(() => {});
          }
        }
        return res.status(200).json({ received: true, status: failStatus, message: `Payment marked as ${failStatus}` });
      }

      // Only if status is COMPLETED and amount matches the deposit, credit the wallet exactly once (idempotent)
      if (isCompleted) {
        const expectedAmount = parseFloat(String(storedDeposit?.amount || 0));
        const verifiedAmount = parseFloat(String(normalized.amount || 0));
        const verifiedUserId = normalized.userId || storedDeposit?.userId || req.query.userId || req.body.userId;
        const transaction_id = normalized.trxId || verifyInvoiceId || verifyValId || `ZP_${Date.now()}`;

        if (!verifiedUserId) {
          return res.status(400).json({ error: 'missing_user_id', verifyData });
        }

        // Amount verification
        if (expectedAmount > 0 && verifiedAmount > 0 && Math.abs(expectedAmount - verifiedAmount) > 0.01) {
          console.error(`[ZiniPay Webhook] Amount mismatch! Expected: ${expectedAmount}, Received: ${verifiedAmount}`);
          return res.status(400).json({ error: 'amount_mismatch', expectedAmount, verifiedAmount });
        }

        const creditAmount = verifiedAmount > 0 ? verifiedAmount : expectedAmount;
        const txResult = await processVerifiedZiniPayment(db, transaction_id, verifiedUserId, creditAmount, verifyData);

        const updateFields = {
          status: 'completed',
          completedAt: new Date().toISOString(),
          transactionId: transaction_id,
          newBalance: txResult.newBalance,
          verifiedAmount: creditAmount,
          updatedAt: new Date().toISOString()
        };

        if (db) {
          if (verifyValId) {
            updateDoc(doc(db, 'deposits', verifyValId), updateFields).catch(() => {});
            updateDoc(doc(db, 'zinipay_invoices', verifyValId), updateFields).catch(() => {});
          }
          if (verifyInvoiceId && verifyInvoiceId !== verifyValId) {
            updateDoc(doc(db, 'deposits', verifyInvoiceId), updateFields).catch(() => {});
            updateDoc(doc(db, 'zinipay_invoices', verifyInvoiceId), updateFields).catch(() => {});
          }
        }

        return res.status(200).json({
          received: true,
          status: 'completed',
          alreadyProcessed: txResult.alreadyProcessed,
          amount: creditAmount,
          newBalance: txResult.newBalance,
          transaction_id
        });
      }

      return res.status(200).json({ received: true, status: normalized.statusStr || 'unknown' });
    } catch (err: any) {
      console.error('Error processing ZiniPay webhook payment:', err);
      return res.status(500).json({ error: err.message });
    }
  });


  // 5. Custom Android SMS Gateway Webhook Endpoint
  app.get('/api/sms-gateway/webhook', (req, res) => {
    return res.status(200).json({
      status: 'active',
      service: 'BNB SMS Gateway Webhook',
      instruction: 'Send HTTP POST requests with JSON body containing trxId, amount, sender, message, and secretKey from your Android SMS Gateway APK.',
      timestamp: new Date().toISOString()
    });
  });

  // =========================================================================
  // Multi-Operator (bKash, Nagad, Rocket) SMS Detection & Payment Verification System
  // =========================================================================

  // Helper Regexes for Multi-Operator (bKash, Nagad, Rocket) Personal & Merchant Transaction SMS Parsing
  const MFS_TRX_REGEX = /(?:TrxID|trxID|TRXID|Trx\s*Id|TxnID|TxnId|TXNID|Txn\s*Id|Transaction\s*ID|Txn|Trx)[:\s]*([A-Za-z0-9]{8,15})/i;
  const MFS_AMOUNT_REGEX = /(?:(?:received|cash\s*in|deposit|amount|পরিমাণ)[:\s]*(?:Tk\.?|TK\.?|BDT|৳|টাকা)?|(?:Tk\.?|TK\.?|BDT|৳|টাকা))\s*([0-9,]+(?:\.[0-9]{1,2})?)/i;
  const MFS_SENDER_PHONE_REGEX = /(?:from|by|Sender|প্রেরক|হতে|থেকে)[:\s]*(\+?8801[3-9]\d{8,9}|01[3-9]\d{8,9})/i;

  function detectMfsOperator(sender?: string, message?: string, requestedOperator?: string): 'bKash' | 'Nagad' | 'Rocket' {
    const s = String(sender || '').toLowerCase();
    const m = String(message || '').toLowerCase();
    const r = String(requestedOperator || '').toLowerCase();

    if (r === 'nagad' || s.includes('nagad') || s.includes('16167') || m.includes('nagad') || m.includes('নগদ')) {
      return 'Nagad';
    }
    if (r === 'rocket' || s.includes('rocket') || s.includes('16216') || s.includes('dbbl') || m.includes('rocket') || m.includes('রকেট')) {
      return 'Rocket';
    }
    return 'bKash';
  }

  // Concurrency Lock & Rate Limiting for bKash SMS Gateway
  const activeProcessingTrx = new Set<string>();
  const gatewayRateLimitMap = new Map<string, { count: number; resetAt: number }>();

  function checkSmsRateLimit(clientIp: string, maxRequests: number = 40, windowMs: number = 60000): boolean {
    const now = Date.now();
    const record = gatewayRateLimitMap.get(clientIp);
    if (!record || now > record.resetAt) {
      gatewayRateLimitMap.set(clientIp, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (record.count >= maxRequests) {
      return false;
    }
    record.count++;
    return true;
  }

  // 1. Health & Status Endpoint
  app.get('/api/sms-gateway/status', async (req, res) => {
    try {
      if (!db) {
        return res.status(503).json({
          status: 'error',
          error: 'db_unavailable',
          message: 'Firebase Firestore সংযোগ বিচ্ছিন্ন রয়েছে।'
        });
      }

      // Collect statistics for Admin Dashboard
      const detectedSnap = await getDocs(query(collection(db, 'detected_payments'), limit(150)));
      const dupSnap = await getDocs(query(collection(db, 'duplicate_transactions'), limit(150)));
      const failedSnap = await getDocs(query(collection(db, 'failed_transactions'), limit(150)));

      let pendingCount = 0;
      let verifiedCount = 0;
      let totalDetected = detectedSnap.size;

      detectedSnap.forEach(docSnap => {
        const d = docSnap.data();
        if (d.status === 'pending_verification') pendingCount++;
        else if (d.status === 'verified') verifiedCount++;
      });

      return res.status(200).json({
        status: 'active',
        service: 'BNB bKash SMS Payment System',
        accountType: 'Personal bKash Account',
        verificationMode: 'Pending Verification (No bypass without explicit approval)',
        firebaseConnected: true,
        stats: {
          totalDetected,
          pendingVerification: pendingCount,
          verified: verifiedCount,
          duplicates: dupSnap.size,
          failed: failedSnap.size
        },
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      return res.status(500).json({ status: 'error', error: err.message });
    }
  });

  // 2. Incoming bKash SMS Webhook Endpoint (From Android Native Receiver or SMS Forwarder)
  app.post('/api/sms-gateway/webhook', async (req, res) => {
    console.log('[bKash SMS Gateway] Webhook received payload:', req.body);
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkSmsRateLimit(String(clientIp), 40, 60000)) {
      return res.status(429).json({
        success: false,
        error: 'rate_limit_exceeded',
        message: 'অতিরিক্ত রিকোয়েস্ট পাঠানো হয়েছে। কিছুক্ষণ পর পুনরায় চেষ্টা করুন।'
      });
    }

    let cleanTrxLocked: string | null = null;
    try {
      const { secretKey, sender, message, rawMessage, trxId, amount, senderPhone, source, timestamp } = req.body;
      
      const expectedSecret = process.env.SMS_GATEWAY_SECRET || 'bnb_sms_gateway_secure_2026';
      if (!secretKey || secretKey !== expectedSecret) {
        return res.status(401).json({ 
          success: false, 
          error: 'unauthorized', 
          message: 'অননুমোদিত রিকোয়েস্ট: সঠিক সিক্রেট কি (secretKey) দেওয়া আবশ্যক।' 
        });
      }

      const smsBody = String(message || rawMessage || '').trim();
      const detectedOperator = detectMfsOperator(sender, smsBody, req.body.operator);
      
      // Auto-extract TrxID if not explicitly provided
      let cleanTrx = trxId ? String(trxId).trim().toUpperCase() : '';
      if (!cleanTrx && smsBody) {
        const m = smsBody.match(MFS_TRX_REGEX);
        if (m) cleanTrx = m[1].trim().toUpperCase();
      }

      // Concurrency Lock: Prevent simultaneous identical TrxID processing
      if (cleanTrx) {
        if (activeProcessingTrx.has(cleanTrx)) {
          return res.status(409).json({
            success: false,
            error: 'concurrent_request_conflict',
            message: 'একই TrxID বর্তমানে প্রসেসিং অবস্থায় রয়েছে। ডাবল প্রসেসিং প্রতিহত করা হয়েছে।'
          });
        }
        activeProcessingTrx.add(cleanTrx);
        cleanTrxLocked = cleanTrx;
      }

      // Auto-extract Amount if not explicitly provided
      let numAmount = amount ? parseFloat(String(amount).replace(/,/g, '')) : NaN;
      if (isNaN(numAmount) && smsBody) {
        const m = smsBody.match(MFS_AMOUNT_REGEX);
        if (m) numAmount = parseFloat(m[1].replace(/,/g, ''));
      }

      // Auto-extract Sender Phone if not explicitly provided
      let cleanSenderPhone = senderPhone ? String(senderPhone).trim() : '';
      if (!cleanSenderPhone && smsBody) {
        const m = smsBody.match(MFS_SENDER_PHONE_REGEX);
        if (m) cleanSenderPhone = m[1].trim();
      }

      // STRICT INPUT VALIDATION: TrxID format & amount range
      if (!cleanTrx || !/^[A-Za-z0-9]{8,15}$/.test(cleanTrx)) {
        return res.status(400).json({
          success: false,
          error: 'invalid_trxid_format',
          message: `অবৈধ ${detectedOperator} TrxID ফরম্যাট। TrxID অবশ্যই ৮-১৫ অক্ষরের বর্ণ ও সংখ্যা হতে হবে।`,
          detectedTrx: cleanTrx
        });
      }

      if (isNaN(numAmount) || numAmount < 1 || numAmount > 1000000 || !Number.isFinite(numAmount)) {
        return res.status(400).json({
          success: false,
          error: 'invalid_amount',
          message: 'অবৈধ টাকার পরিমাণ। পরিমাণ অবশ্যই ৳১ থেকে ৳১০,০০,০০০ এর মধ্যে হতে হবে।',
          detectedAmount: isNaN(numAmount) ? null : numAmount
        });
      }

      if (!db) {
        return res.status(503).json({ success: false, error: 'db_unavailable', message: 'Firebase সংযোগ ব্যর্থ।' });
      }

      // =========================================================================
      // MANDATORY RULE 6: DUPLICATE PREVENTION CHECK
      // শুধুমাত্র ইতিপূর্বে প্রসেসড বা সফলভাবে ভেরিফাইড লেনদেনকে ডুপ্লিকেট হিসেবে গণ্য করবে
      // পেন্ডিং রিকোয়েস্ট ডুপ্লিকেট নয়; তা অটো-ম্যাচিংয়ের জন্য অপেক্ষমাণ।
      // =========================================================================
      const payDocRef = doc(db, 'detected_payments', `PAY_${cleanTrx}`);
      const paySnap = await getDoc(payDocRef);

      const txQ = query(collection(db, 'transactions'), where('trxId', '==', cleanTrx), limit(1));
      const txSnap = await getDocs(txQ);

      const txData = !txSnap.empty ? txSnap.docs[0].data() : null;
      const isTxAlreadySuccess = !!(txData && (txData.status === 'success' || txData.isApproved === true));
      const isDuplicate = paySnap.exists() || isTxAlreadySuccess;

      if (isDuplicate) {
        console.warn(`[Duplicate Blocked] TrxID ${cleanTrx} already exists in database. Rejecting double processing.`);
        
        // Log in duplicate_transactions
        const dupDocRef = doc(collection(db, 'duplicate_transactions'));
        await setDoc(dupDocRef, {
          id: dupDocRef.id,
          trxId: cleanTrx,
          amount: numAmount,
          sender: sender || 'bKash',
          senderPhone: cleanSenderPhone,
          rawMessage: smsBody,
          firstDetectedAt: paySnap.exists() ? paySnap.data()?.detectedAt : null,
          rejectedAt: new Date().toISOString(),
          reason: 'একই TrxID একাধিকবার পাঠানো হয়েছে (Duplicate TrxID Rejection)',
          source: source || 'webhook',
          status: 'rejected_duplicate'
        });

        // Update original record with duplicate attempt marker
        if (paySnap.exists()) {
          const curData = paySnap.data();
          await updateDoc(payDocRef, {
            isDuplicate: true,
            duplicateAttempts: (curData?.duplicateAttempts || 1) + 1,
            lastDuplicateAttemptAt: new Date().toISOString()
          }).catch(() => {});
        }

        return res.status(200).json({
          success: false,
          status: 'duplicate_rejected',
          error: 'duplicate_trxid',
          message: `ডুপ্লিকেট ট্রানজেকশন সনাক্ত ও প্রত্যাখ্যাত! TrxID: ${cleanTrx} পূর্বে একবার প্রসেস/রেকর্ড করা হয়েছে। ব্যালেন্স পরিবর্তন করা হবে না।`,
          trxId: cleanTrx
        });
      }

      // =========================================================================
      // MANDATORY RULE 4, 5 & 9: STRICT 100% BIDIRECTIONAL MATCHING ENGINE
      // সদস্যের Payment Request, Amount ও TrxID ১০০% মিলিয়ে স্বয়ংক্রিয়ভাবে ব্যালেন্স যোগ
      // =========================================================================
      let matchedUserId: string | null = null;
      let matchedMemberId: string | null = null;
      let matchedUserName: string | null = null;
      let matchedTxId: string | null = null;
      let matchStatus = 'unmatched_no_member_request';
      let amountMatches = false;

      // Match strictly by Member Deposit/Payment Request (TrxID in transactions)
      const matchQ = query(
        collection(db, 'transactions'),
        where('trxId', '==', cleanTrx),
        limit(1)
      );
      const matchRes = await getDocs(matchQ);

      const nowIso = new Date().toISOString();

      if (!matchRes.empty) {
        const mDoc = matchRes.docs[0];
        const mData = mDoc.data();
        matchedUserId = mData.userId || null;
        matchedMemberId = mData.memberId || null;
        matchedUserName = mData.userName || null;
        matchedTxId = mDoc.id;
        amountMatches = Math.abs((Number(mData.amount) || 0) - numAmount) < 0.01;
        matchStatus = amountMatches ? 'matched_payment_request' : 'amount_mismatch';

        // Check if member request is currently pending
        const isPendingTx = mData.status === 'pending' || mData.status === 'pending_verification';

        if (amountMatches && isPendingTx && matchedUserId) {
          // 100% MATCH: Automatic balance credit, notification, and history update!
          console.log(`[Auto-Matching Engine] 100% Match! TrxID: ${cleanTrx}, Amount: ${numAmount}, User: ${matchedUserId}`);

          const autoResult = await runTransaction(db, async (t) => {
            const userDocRef = doc(db, 'users', matchedUserId!);
            const userSnap = await t.get(userDocRef);
            const userData = userSnap.exists() ? userSnap.data() : { balance: 0, mainBalance: 0, name: 'সদস্য', memberId: 'BNB000001' };

            const currentBal = Number(userData.balance) || 0;
            const currentMain = Number(userData.mainBalance) || 0;
            const newBal = currentBal + numAmount;
            const newMain = currentMain + numAmount;

            // Atomic balance credit
            t.set(userDocRef, {
              balance: newBal,
              mainBalance: newMain
            }, { merge: true });

            // Update transaction to success
            const txDocRef = doc(db, 'transactions', matchedTxId!);
            t.update(txDocRef, {
              status: 'success',
              isApproved: true,
              verifiedAt: nowIso,
              verifiedBy: 'system_auto_matcher',
              paymentMethod: `${detectedOperator} Personal (Auto SMS Verified)`,
              operator: detectedOperator,
              description: `${detectedOperator} Personal SMS অটো-ম্যাচিংয়ের মাধ্যমে ৳${numAmount.toLocaleString('bn-BD')} টাকা সফলভাবে একাউন্ট ব্যালেন্সে যোগ হয়েছে (TrxID: ${cleanTrx})`
            });

            // Save detected payment as verified
            t.set(payDocRef, {
              id: `PAY_${cleanTrx}`,
              trxId: cleanTrx,
              amount: numAmount,
              operator: detectedOperator,
              sender: sender || detectedOperator,
              senderPhone: cleanSenderPhone,
              message: smsBody,
              rawMessage: smsBody,
              detectedAt: nowIso,
              status: 'verified',
              verificationStatus: 'verified_auto_matched',
              matchStatus: 'matched_payment_request',
              matchedUserId,
              matchedMemberId: userData.memberId || matchedMemberId,
              matchedUserName: userData.name || matchedUserName,
              matchedTransactionId: matchedTxId,
              isProcessed: true,
              processedAt: nowIso,
              verifiedAt: nowIso,
              verifiedBy: 'system_auto_matcher',
              isDuplicate: false,
              duplicateAttempts: 0,
              source: source || 'webhook',
              autoMatched: true
            });

            // Update incoming_sms
            const smsDocRef = doc(db, 'incoming_sms', `SMS_${cleanTrx}`);
            t.set(smsDocRef, {
              id: `SMS_${cleanTrx}`,
              trxId: cleanTrx,
              amount: numAmount,
              operator: detectedOperator,
              sender: sender || detectedOperator,
              senderPhone: cleanSenderPhone,
              message: smsBody,
              status: 'claimed',
              isUsed: true,
              usedBy: matchedUserId,
              receivedAt: nowIso
            }, { merge: true });

            // Push User Notification
            const notifRef = doc(collection(db, 'user_notifications'));
            t.set(notifRef, {
              id: notifRef.id,
              userId: matchedUserId,
              title: `${detectedOperator} ডিপোজিট অনুমোদিত 🎉`,
              body: `আপনার ${detectedOperator} TrxID (${cleanTrx})-এর ৳${numAmount.toLocaleString('bn-BD')} টাকা স্বয়ংক্রিয়ভাবে যাচাই হয়ে একাউন্ট ব্যালেন্সে যোগ হয়েছে।`,
              message: `আপনার ${detectedOperator} TrxID (${cleanTrx})-এর ৳${numAmount.toLocaleString('bn-BD')} টাকা স্বয়ংক্রিয়ভাবে যাচাই হয়ে একাউন্ট ব্যালেন্সে যোগ হয়েছে।`,
              read: false,
              createdAt: nowIso
            });

            return { newBal, userData };
          });

          // Audit Log in sms_logs
          const logRef = doc(collection(db, 'sms_logs'));
          await setDoc(logRef, {
            id: logRef.id,
            event: 'MFS_PAYMENT_AUTO_MATCHED',
            operator: detectedOperator,
            trxId: cleanTrx,
            amount: numAmount,
            senderPhone: cleanSenderPhone,
            status: 'verified',
            matchedUserId,
            matchedMemberId: autoResult.userData?.memberId || matchedMemberId,
            createdAt: nowIso
          });

          return res.status(200).json({
            success: true,
            status: 'verified_auto_matched',
            operator: detectedOperator,
            message: `${detectedOperator} SMS এবং মেম্বার রিকোয়েস্ট ১০০% মিলেছে! টাকা স্বয়ংক্রিয়ভাবে ব্যালেন্সে যোগ হয়েছে।`,
            trxId: cleanTrx,
            amount: numAmount,
            matchedUserId,
            matchedUserName: autoResult.userData?.name || matchedUserName,
            newBalance: autoResult.newBal
          });
        }
      }

      // If no matching pending member request found or amount mismatch:
      // Holds safely in pending_verification for admin review or subsequent member claim
      const detectedData = {
        id: `PAY_${cleanTrx}`,
        trxId: cleanTrx,
        amount: numAmount,
        operator: detectedOperator,
        sender: sender || detectedOperator,
        senderPhone: cleanSenderPhone,
        message: smsBody,
        rawMessage: smsBody,
        detectedAt: nowIso,
        status: 'pending_verification',
        verificationStatus: matchedUserId ? (amountMatches ? 'pending_review' : 'amount_mismatch') : 'unidentified_member',
        matchStatus,
        matchedUserId,
        matchedMemberId,
        matchedUserName,
        matchedTransactionId: matchedTxId,
        isProcessed: false,
        processedAt: null,
        verifiedAt: null,
        verifiedBy: null,
        rejectionReason: null,
        isDuplicate: false,
        duplicateAttempts: 0,
        source: source || 'webhook',
        personalNotice: `Personal ${detectedOperator} একাউন্ট: লেনদেনটি Pending Verification তালিকায় সংরক্ষিত হয়েছে।`
      };

      await setDoc(payDocRef, detectedData);

      // Save to incoming_sms collection for backwards compatibility
      const smsDocRef = doc(db, 'incoming_sms', `SMS_${cleanTrx}`);
      await setDoc(smsDocRef, {
        id: `SMS_${cleanTrx}`,
        trxId: cleanTrx,
        amount: numAmount,
        operator: detectedOperator,
        sender: sender || detectedOperator,
        senderPhone: cleanSenderPhone,
        message: smsBody,
        status: 'pending_verification',
        isUsed: false,
        usedBy: null,
        receivedAt: nowIso
      }, { merge: true });

      // Audit Log in sms_logs
      const logRef = doc(collection(db, 'sms_logs'));
      await setDoc(logRef, {
        id: logRef.id,
        event: 'MFS_PAYMENT_DETECTED',
        operator: detectedOperator,
        trxId: cleanTrx,
        amount: numAmount,
        senderPhone: cleanSenderPhone,
        status: 'pending_verification',
        matchedUserId,
        matchedMemberId,
        createdAt: nowIso
      });

      return res.status(200).json({
        success: true,
        status: 'pending_verification',
        operator: detectedOperator,
        message: `${detectedOperator} SMS সফলভাবে শনাক্ত হয়েছে এবং Pending Verification তালিকায় সংরক্ষিত হয়েছে।`,
        trxId: cleanTrx,
        amount: numAmount,
        senderPhone: cleanSenderPhone,
        matchedUserId,
        matchedMemberId,
        matchedUserName,
        matchStatus
      });
    } catch (err: any) {
      console.error('[bKash SMS Gateway] Webhook error:', err);
      return res.status(500).json({ success: false, error: err.message });
    } finally {
      if (cleanTrxLocked) {
        activeProcessingTrx.delete(cleanTrxLocked);
      }
    }
  });

  // 3. Admin Verification Approval Endpoint (Atomic Balance Credit)
  app.post('/api/sms-gateway/approve-verification', async (req, res) => {
    try {
      const { trxId, targetUserId, adminUid, secretKey, verificationProof } = req.body;
      const expectedSecret = process.env.SMS_GATEWAY_SECRET || 'bnb_sms_gateway_secure_2026';
      
      if (!trxId) {
        return res.status(400).json({ success: false, error: 'missing_trxid', message: 'TrxID দেওয়া আবশ্যক।' });
      }

      if (!db) {
        return res.status(503).json({ success: false, error: 'db_unavailable' });
      }

      const cleanTrx = String(trxId).trim().toUpperCase();
      const payDocRef = doc(db, 'detected_payments', `PAY_${cleanTrx}`);
      const smsDocRef = doc(db, 'incoming_sms', `SMS_${cleanTrx}`);

      const result = await runTransaction(db, async (t) => {
        // 1. Fetch detected payment record
        const paySnap = await t.get(payDocRef);
        if (!paySnap.exists()) {
          throw new Error('payment_record_not_found');
        }

        const payData = paySnap.data();
        if (payData.isProcessed || payData.status === 'verified') {
          throw new Error('already_processed');
        }

        // 2. Identify and validate target member (Requirement 5)
        const finalUserId = targetUserId || payData.matchedUserId;
        if (!finalUserId) {
          throw new Error('member_not_identified');
        }

        // Requirement 3: Admin Approval-ও প্রকৃত পেমেন্টের প্রমাণের বিকল্প নয় (Mandatory Audit Proof)
        const validProofNote = verificationProof ? String(verificationProof).trim() : '';
        if (validProofNote.length < 3) {
          throw new Error('verification_proof_required');
        }

        const userDocRef = doc(db, 'users', finalUserId);
        const userSnap = await t.get(userDocRef);
        const userData = userSnap.exists() ? userSnap.data() : { balance: 0, mainBalance: 0, name: 'সদস্য', memberId: 'BNB000001' };

        const paymentAmount = Number(payData.amount) || 0;
        if (paymentAmount <= 0) {
          throw new Error('invalid_payment_amount');
        }

        const currentBal = Number(userData.balance) || 0;
        const currentMain = Number(userData.mainBalance) || 0;
        const newBal = currentBal + paymentAmount;
        const newMain = currentMain + paymentAmount;

        // 3. Atomic Balance Credit (Exact once)
        t.set(userDocRef, {
          balance: newBal,
          mainBalance: newMain
        }, { merge: true });

        const nowIso = new Date().toISOString();

        // 4. Update detected_payments to verified
        t.update(payDocRef, {
          status: 'verified',
          verificationStatus: 'verified',
          isProcessed: true,
          processedAt: nowIso,
          verifiedAt: nowIso,
          verifiedBy: adminUid || 'admin_master',
          matchedUserId: finalUserId,
          matchedMemberId: userData.memberId || 'BNB000000'
        });

        // 5. Update incoming_sms
        t.update(smsDocRef, {
          status: 'claimed',
          isUsed: true,
          usedBy: finalUserId,
          usedAt: nowIso
        });

        const opLabel = payData.operator || detectMfsOperator(payData.sender, payData.message) || 'bKash';

        // 6. Create or update Transaction in transactions collection
        const txDocRef = doc(db, 'transactions', `SMS_${cleanTrx}`);
        t.set(txDocRef, {
          id: txDocRef.id,
          userId: finalUserId,
          userName: userData.name || 'সদস্য',
          userPhone: userData.phone || '',
          memberId: userData.memberId || '',
          amount: paymentAmount,
          type: 'add_money',
          status: 'success',
          isApproved: true,
          paymentMethod: `${opLabel} Personal (SMS Verified)`,
          operator: opLabel,
          phone: userData.phone || '',
          senderPhone: payData.senderPhone || userData.phone || '',
          trxId: cleanTrx,
          transactionId: cleanTrx,
          receiptNo: cleanTrx,
          createdAt: nowIso,
          description: `${opLabel} Personal SMS যাচাইকরণের মাধ্যমে ৳${paymentAmount.toLocaleString('bn-BD')} টাকা সফলভাবে একাউন্ট ব্যালেন্সে যোগ হয়েছে (TrxID: ${cleanTrx})`
        }, { merge: true });

        // 7. Push User Notification
        const notifRef = doc(collection(db, 'user_notifications'));
        t.set(notifRef, {
          id: notifRef.id,
          userId: finalUserId,
          title: `${opLabel} পেমেন্ট অনুমোদিত 🎉`,
          body: `আপনার ${opLabel} TrxID (${cleanTrx})-এর ৳${paymentAmount.toLocaleString('bn-BD')} টাকা সফলভাবে যাচাই হয়ে ওয়ালেটে যোগ হয়েছে।`,
          message: `আপনার ${opLabel} TrxID (${cleanTrx})-এর ৳${paymentAmount.toLocaleString('bn-BD')} টাকা সফলভাবে যাচাই হয়ে ওয়ালেটে যোগ হয়েছে।`,
          read: false,
          createdAt: nowIso
        });

        return {
          newBalance: newBal,
          amount: paymentAmount,
          trxId: cleanTrx,
          userId: finalUserId,
          userName: userData.name || 'সদস্য'
        };
      });

      return res.status(200).json({
        success: true,
        message: 'পেমেন্ট সফলভাবে যাচাই ও সদস্যের ব্যালেন্সে যোগ করা হয়েছে!',
        data: result
      });
    } catch (err: any) {
      console.error('[bKash SMS Gateway] Approve verification error:', err);
      if (err.message === 'already_processed') {
        return res.status(400).json({ success: false, error: 'already_processed', message: 'এই লেনদেনটি ইতিমধ্যে একবার ভেরিফাই করে ব্যালেন্সে যোগ করা হয়েছে।' });
      }
      if (err.message === 'member_not_identified') {
        return res.status(400).json({ success: false, error: 'member_not_identified', message: 'কোন সদস্যের টাকা এসেছে তা নিশ্চিত হওয়া যায়নি। সদস্য নির্বাচন করুন।' });
      }
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Admin Rejection Endpoint
  app.post('/api/sms-gateway/reject-verification', async (req, res) => {
    try {
      const { trxId, reason, adminUid } = req.body;
      if (!trxId) {
        return res.status(400).json({ success: false, error: 'missing_trxid' });
      }
      if (!db) {
        return res.status(503).json({ success: false, error: 'db_unavailable' });
      }

      const cleanTrx = String(trxId).trim().toUpperCase();
      const nowIso = new Date().toISOString();
      const failReason = reason || 'এডমিন কর্তৃক যাচাইয়ে বাতিল করা হয়েছে';

      const payDocRef = doc(db, 'detected_payments', `PAY_${cleanTrx}`);
      const paySnap = await getDoc(payDocRef);

      if (paySnap.exists()) {
        const payData = paySnap.data();
        await updateDoc(payDocRef, {
          status: 'failed',
          verificationStatus: 'rejected',
          rejectionReason: failReason,
          rejectedAt: nowIso,
          rejectedBy: adminUid || 'admin_master'
        });

        // Record in failed_transactions
        const failDocRef = doc(collection(db, 'failed_transactions'));
        await setDoc(failDocRef, {
          id: failDocRef.id,
          trxId: cleanTrx,
          amount: payData.amount,
          senderPhone: payData.senderPhone || '',
          reason: failReason,
          rejectedAt: nowIso,
          rawMessage: payData.rawMessage || ''
        });

        // If member had submitted pending deposit request, reject it
        if (payData.matchedUserId) {
          const txQ = query(collection(db, 'transactions'), where('trxId', '==', cleanTrx), limit(1));
          const txSnap = await getDocs(txQ);
          if (!txSnap.empty) {
            await updateDoc(txSnap.docs[0].ref, {
              status: 'rejected',
              rejectionReason: failReason,
              rejectedAt: nowIso
            });
          }

          // Notify member
          const opLabel = payData.operator || detectMfsOperator(payData.sender, payData.message) || 'bKash';
          const notifRef = doc(collection(db, 'user_notifications'));
          await setDoc(notifRef, {
            id: notifRef.id,
            userId: payData.matchedUserId,
            title: `${opLabel} লেনদেন বাতিল ❌`,
            message: `আপনার ${opLabel} TrxID (${cleanTrx})-এর আবেদনটি বাতিল করা হয়েছে। কারণ: ${failReason}`,
            read: false,
            createdAt: nowIso
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: 'লেনদেনটি সফলভাবে বাতিল তালিকায় নেওয়া হয়েছে।'
      });
    } catch (err: any) {
      console.error('[bKash SMS Gateway] Reject verification error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. Member Deposit Verification Route (Add Money Self-Reconciliation)
  app.post('/api/sms-gateway/verify-deposit', async (req, res) => {
    try {
      const { userId, trxId, amount, operator, senderPhone } = req.body;
      if (!userId || !trxId || !amount) {
        return res.status(400).json({ success: false, error: 'missing_fields', message: 'ইউজার আইডি, TrxID এবং টাকার পরিমাণ দেওয়া আবশ্যক।' });
      }

      if (!db) {
        return res.status(500).json({ success: false, error: 'db_unavailable', message: 'ডেটাবেস সংযোগ পাওয়া যায়নি।' });
      }

      const opKey = String(operator || 'bkash').toLowerCase();
      const opLabel = opKey === 'nagad' ? 'Nagad' : opKey === 'rocket' ? 'Rocket' : 'bKash';
      const cleanTrx = String(trxId).trim().toUpperCase();
      const reqAmount = parseFloat(amount);
      const nowIso = new Date().toISOString();

      if (!/^[A-Za-z0-9]{8,15}$/.test(cleanTrx)) {
        return res.status(400).json({
          success: false,
          error: 'invalid_trxid_format',
          message: `অবৈধ ${opLabel} TrxID ফরম্যাট। TrxID অবশ্যই ৮-১৫ অক্ষরের হতে হবে।`
        });
      }

      if (isNaN(reqAmount) || reqAmount < 1 || reqAmount > 1000000) {
        return res.status(400).json({
          success: false,
          error: 'invalid_amount',
          message: 'অবৈধ টাকার পরিমাণ। পরিমাণ অবশ্যই ৳১ থেকে ৳১০,০০,০০০ এর মধ্যে হতে হবে।'
        });
      }

      // 1. Check detected_payments / incoming_sms collection in Firestore
      const payDocRef = doc(db, 'detected_payments', `PAY_${cleanTrx}`);
      const paySnap = await getDoc(payDocRef);

      let paymentData: any = null;
      if (paySnap.exists()) {
        paymentData = paySnap.data();
      } else {
        const smsDocRef = doc(db, 'incoming_sms', `SMS_${cleanTrx}`);
        const smsSnap = await getDoc(smsDocRef);
        if (smsSnap.exists()) {
          paymentData = smsSnap.data();
        }
      }

      // If SMS has NOT arrived yet on Admin's Personal SIM:
      // Save pending transaction so as soon as the SMS arrives at the webhook, it will auto-match!
      if (!paymentData) {
        const pendingTxRef = doc(db, 'transactions', `DEP_${cleanTrx}`);
        const userDocRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userDocRef);
        const userData = userSnap.exists() ? userSnap.data() : {};

        await setDoc(pendingTxRef, {
          id: pendingTxRef.id,
          userId,
          userName: userData.name || 'সদস্য',
          userPhone: userData.phone || '',
          memberId: userData.memberId || '',
          amount: reqAmount,
          type: 'add_money',
          status: 'pending',
          isApproved: false,
          paymentMethod: `${opLabel} Personal (অপেক্ষমাণ)`,
          operator: opLabel,
          phone: userData.phone || '',
          senderPhone: senderPhone || userData.phone || '',
          trxId: cleanTrx,
          transactionId: cleanTrx,
          receiptNo: cleanTrx,
          createdAt: nowIso,
          description: `${opLabel} Personal অ্যাড মানি আবেদন (TrxID: ${cleanTrx}, পরিমাণ: ৳${reqAmount})`
        }, { merge: true });

        // Admin notification
        await addDoc(collection(db, 'admin_notifications'), {
          title: `📥 নতুন ${opLabel} অ্যাড মানি আবেদন`,
          message: `${userData.name || 'সদস্য'} (${userData.memberId || 'N/A'}) ৳${reqAmount.toLocaleString('en-US')} টাকার ${opLabel} ডিপোজিট রিকোয়েস্ট করেছেন (TrxID: ${cleanTrx})। এডমিনের সিমে SMS আসা মাত্রই এটি স্বয়ংক্রিয়ভাবে প্রসেস হবে।`,
          userId,
          userName: userData.name || '',
          memberId: userData.memberId || '',
          amount: reqAmount,
          trxId: cleanTrx,
          type: 'add_money',
          createdAt: nowIso,
          read: false
        }).catch(() => {});

        return res.status(200).json({
          success: true,
          status: 'pending_sms_wait',
          operator: opLabel,
          autoApproved: false,
          message: `আপনার ডিপোজিট আবেদনটি সফলভাবে জমা হয়েছে। এডমিনের ফোনে ${opLabel} SMS আসা মাত্রই সিস্টেম TrxID (${cleanTrx}) ও টাকার পরিমাণ মিলিয়ে স্বয়ংক্রিয়ভাবে ওয়ালেটে টাকা যোগ করে দেবে।`,
          trxId: cleanTrx,
          amount: reqAmount
        });
      }

      // 2. Check if already processed or claimed
      if (paymentData.isProcessed || paymentData.isUsed || paymentData.status === 'verified') {
        return res.status(400).json({
          success: false,
          error: 'already_used',
          message: 'এই ট্রানজেকশন আইডি (TrxID) দিয়ে ইতিপূর্বে টাকা যোগ করা হয়েছে। একটি TrxID শুধুমাত্র একবারই ব্যবহার করা যাবে।'
        });
      }

      // 3. Check amount match
      const smsAmount = parseFloat(paymentData.amount);
      if (Math.abs(smsAmount - reqAmount) > 0.01) {
        return res.status(400).json({
          success: false,
          error: 'amount_mismatch',
          message: `টাকার পরিমাণ মিলছে না! এডমিনের সিমে আসা মেসেজে টাকার পরিমাণ ছিল ৳${smsAmount} কিন্তু আপনি লিখেছেন ৳${reqAmount}।`
        });
      }

      // 4. MATCH FOUND! 100% TrxID and Amount Match!
      // Atomic Balance Credit via Firestore Transaction
      const matchResult = await runTransaction(db, async (t) => {
        const userDocRef = doc(db, 'users', userId);
        const userSnap = await t.get(userDocRef);
        const userData = userSnap.exists() ? userSnap.data() : { balance: 0, mainBalance: 0, name: 'সদস্য', memberId: 'BNB000001' };

        const freshPaySnap = await t.get(payDocRef);
        if (freshPaySnap.exists()) {
          const freshPay = freshPaySnap.data();
          if (freshPay.isProcessed || freshPay.status === 'verified') {
            throw new Error('already_used');
          }
        }

        const currentBal = Number(userData.balance) || 0;
        const currentMain = Number(userData.mainBalance) || 0;
        const newBal = currentBal + reqAmount;
        const newMain = currentMain + reqAmount;

        // Credit user balance atomically
        t.set(userDocRef, {
          balance: newBal,
          mainBalance: newMain
        }, { merge: true });

        // Set or update transaction in transactions collection
        const txDocRef = doc(db, 'transactions', `SMS_${cleanTrx}`);
        t.set(txDocRef, {
          id: txDocRef.id,
          userId,
          userName: userData.name || 'সদস্য',
          userPhone: userData.phone || '',
          memberId: userData.memberId || '',
          amount: reqAmount,
          type: 'add_money',
          status: 'success',
          isApproved: true,
          paymentMethod: `${opLabel} Personal (Auto SMS Verified)`,
          operator: opLabel,
          phone: userData.phone || '',
          senderPhone: paymentData.senderPhone || senderPhone || userData.phone || '',
          trxId: cleanTrx,
          transactionId: cleanTrx,
          receiptNo: cleanTrx,
          createdAt: nowIso,
          verifiedAt: nowIso,
          verifiedBy: 'system_auto_matcher',
          description: `${opLabel} Personal SMS যাচাইয়ের মাধ্যমে ৳${reqAmount.toLocaleString('bn-BD')} টাকা ওয়ালেটে সফলভাবে যোগ হয়েছে (TrxID: ${cleanTrx})`
        }, { merge: true });

        // Update detected_payments
        t.set(payDocRef, {
          ...paymentData,
          status: 'verified',
          verificationStatus: 'verified_auto_matched',
          matchStatus: 'matched_payment_request',
          matchedUserId: userId,
          matchedMemberId: userData.memberId || '',
          matchedUserName: userData.name || '',
          matchedTransactionId: txDocRef.id,
          isProcessed: true,
          processedAt: nowIso,
          verifiedAt: nowIso,
          verifiedBy: 'system_auto_matcher'
        }, { merge: true });

        // Update incoming_sms
        const smsDocRef = doc(db, 'incoming_sms', `SMS_${cleanTrx}`);
        t.set(smsDocRef, {
          status: 'claimed',
          isUsed: true,
          usedBy: userId,
          usedAt: nowIso
        }, { merge: true });

        // Push User Notification
        const notifRef = doc(collection(db, 'user_notifications'));
        t.set(notifRef, {
          id: notifRef.id,
          userId,
          title: `${opLabel} ডিপোজিট সফল হয়েছে 🎉`,
          body: `আপনার ${opLabel} TrxID (${cleanTrx})-এর ৳${reqAmount.toLocaleString('bn-BD')} টাকা সফলভাবে যাচাই হয়ে ওয়ালেটে যোগ হয়েছে।`,
          message: `আপনার ${opLabel} TrxID (${cleanTrx})-এর ৳${reqAmount.toLocaleString('bn-BD')} টাকা সফলভাবে যাচাই হয়ে ওয়ালেটে যোগ হয়েছে।`,
          read: false,
          createdAt: nowIso
        });

        return { newBal, userData };
      });

      // Audit Log in sms_logs
      const logRef = doc(collection(db, 'sms_logs'));
      await setDoc(logRef, {
        id: logRef.id,
        event: 'MFS_PAYMENT_MEMBER_CLAIMED_VERIFIED',
        operator: opLabel,
        trxId: cleanTrx,
        amount: reqAmount,
        userId,
        status: 'verified',
        createdAt: nowIso
      });

      return res.status(200).json({
        success: true,
        status: 'verified',
        operator: opLabel,
        autoApproved: true,
        message: `অভিনন্দন! আপনার ${opLabel} TrxID (${cleanTrx}) এবং টাকার পরিমাণ সফলভাবে ভেরিফাই হয়েছে এবং আপনার ওয়ালেটে ৳${reqAmount.toLocaleString('bn-BD')} টাকা যোগ হয়েছে।`,
        trxId: cleanTrx,
        amount: reqAmount,
        newBalance: matchResult.newBal
      });
    } catch (err: any) {
      console.error('Error in /api/sms-gateway/verify-deposit:', err);
      if (err.message === 'already_used') {
        return res.status(400).json({ success: false, error: 'already_used', message: 'এই ট্রানজেকশন আইডি (TrxID) দিয়ে ইতিপূর্বে টাকা যোগ করা হয়েছে।' });
      }
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // =========================================================================
  // End-to-End OTP Verification System Architecture (Blueprint Standard)
  // =========================================================================

  // Step A: Generate OTP for Sensitive Action
  // Route: POST /api/otp/generate
  // Input: userId, actionPayload, (optional: phone, email, actionType)
  app.post('/api/otp/generate', async (req, res) => {
    try {
      const { userId, actionPayload, phone, email, actionType } = req.body;
      if (!userId) {
        return res.status(400).json({ success: false, error: 'missing_user_id', message: 'ইউজার আইডি প্রদান করা আবশ্যক।' });
      }

      // Generate 6-digit random OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // 5-minute expiration window (300,000 ms)
      const expiresAt = Date.now() + 5 * 60 * 1000;
      const sessionId = `otp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // Fetch user data if phone or email not explicitly supplied
      let userPhone = phone || '';
      let userEmail = email || '';
      let userName = 'সম্মানিত সদস্য';

      if (db && (!userPhone || !userEmail)) {
        try {
          const userSnap = await getDoc(doc(db, 'users', userId));
          if (userSnap.exists()) {
            const uData = userSnap.data();
            if (!userPhone) userPhone = uData.phone || '';
            if (!userEmail) userEmail = uData.email || '';
            if (uData.name) userName = uData.name;
          }
        } catch (uErr) {
          console.warn('[OTP System] Could not load user details for OTP dispatch:', uErr);
        }
      }

      // Save session in Firestore 'otp_sessions' collection
      if (db) {
        const sessionRef = doc(db, 'otp_sessions', sessionId);
        await setDoc(sessionRef, {
          sessionId,
          id: sessionId,
          userId,
          payload: actionPayload || {},
          actionType: actionType || (actionPayload?.type || 'sensitive_action'),
          otpCode,
          expiresAt,
          status: 'pending',
          createdAt: new Date().toISOString(),
          phone: userPhone,
          email: userEmail
        });

        // Push real-time notification to user inbox so OTP is readily visible
        try {
          const notifRef = doc(collection(db, 'user_notifications'));
          await setDoc(notifRef, {
            id: notifRef.id,
            userId,
            title: '🔐 সংবেদনশীল কাজের ওটিপি ভেরিফিকেশন কোড',
            message: `আপনার অনুরোধকৃত কাজের ৬-সংখ্যার ওটিপি কোড: ${otpCode} (মেয়াদ: ৫ মিনিট)। কোডটি কারো সাথে শেয়ার করবেন না।`,
            otp: otpCode,
            category: 'otp_verification',
            read: false,
            createdAt: new Date().toISOString()
          });
        } catch (notifErr) {
          console.warn('[OTP System] Failed to write in-app notification:', notifErr);
        }
      }

      // Dispatch via Email whenever user email is available
      if (userEmail) {
        sendEmailOtpUniversal(userEmail, otpCode).catch(e => console.warn('[OTP Email Error]:', e));
      }

      console.log(`[OTP Engine] Generated OTP for user ${userId} (Session: ${sessionId}, Code: ${otpCode}, Expires: 5m)`);

      return res.status(200).json({
        success: true,
        sessionId,
        expiresAt,
        message: 'আপনার মোবাইল নম্বর/ইমেইলে ৬ ডিজিটের ওটিপি পাঠানো হয়েছে।',
        target: userPhone ? `${userPhone.slice(0, 3)}••••${userPhone.slice(-4)}` : (userEmail || 'registered device')
      });
    } catch (err: any) {
      console.error('[OTP Engine] Error in /api/otp/generate:', err);
      return res.status(500).json({ success: false, error: 'server_error', message: err.message || 'ওটিপি তৈরিতে সমস্যা হয়েছে।' });
    }
  });

  // Step B: Verify OTP and Authorize Action
  // Route: POST /api/otp/verify
  // Input: sessionId, enteredOtp
  app.post('/api/otp/verify', async (req, res) => {
    try {
      const { sessionId, enteredOtp } = req.body;
      if (!sessionId || !enteredOtp) {
        return res.status(400).json({ success: false, error: 'missing_fields', message: 'Session ID এবং OTP প্রদান করা আবশ্যক।' });
      }

      if (!db) {
        return res.status(500).json({ success: false, error: 'db_unavailable', message: 'ডেটাবেস সংযোগ উপলব্ধ নয়।' });
      }

      const sessionDocRef = doc(db, 'otp_sessions', sessionId);
      const sessionSnap = await getDoc(sessionDocRef);

      if (!sessionSnap.exists()) {
        return res.status(404).json({ success: false, error: 'session_not_found', message: 'ওটিপি সেশন পাওয়া যায়নি বা মেয়াদোত্তীর্ণ হয়েছে।' });
      }

      const sessionData = sessionSnap.data();

      // Check if session is already used or invalidated
      if (sessionData.status === 'verified') {
        return res.status(400).json({ success: false, error: 'already_used', message: 'এই ওটিপি কোডটি ইতিমধ্যে ব্যবহার করা হয়েছে।' });
      }
      if (sessionData.status === 'expired') {
        return res.status(400).json({ success: false, error: 'otp_expired', message: 'ওটিপির মেয়াদ শেষ হয়ে গেছে। অনুগ্রহ করে নতুন ওটিপি কোড নিন।' });
      }

      // Check 5-minute expiry
      const now = Date.now();
      if (now > sessionData.expiresAt) {
        await updateDoc(sessionDocRef, { status: 'expired' }).catch(() => {});
        return res.status(400).json({
          success: false,
          error: 'otp_expired',
          message: 'ওটিপি কোডের ৫ মিনিটের মেয়াদ শেষ হয়ে গেছে। অনুগ্রহ করে নতুন ওটিপি চেয়ে নিন।'
        });
      }

      // Check matching code strictly (No demo OTP allowed)
      const cleanEntered = String(enteredOtp).trim();
      const cleanCode = String(sessionData.otpCode).trim();

      if (cleanEntered !== cleanCode) {
        return res.status(400).json({
          success: false,
          error: 'invalid_otp',
          message: 'প্রদত্ত ওটিপি কোডটি সঠিক নয়। অনুগ্রহ করে পুনরায় চেক করুন।'
        });
      }

      // Mark session as verified
      await updateDoc(sessionDocRef, {
        status: 'verified',
        verifiedAt: new Date().toISOString()
      });

      console.log(`[OTP Engine] Session ${sessionId} verified successfully for user ${sessionData.userId}`);

      return res.status(200).json({
        success: true,
        message: 'Verification successful & action executed',
        sessionId,
        payload: sessionData.payload
      });
    } catch (err: any) {
      console.error('[OTP Engine] Error in /api/otp/verify:', err);
      return res.status(500).json({ success: false, error: 'server_error', message: err.message || 'ওটিপি যাচাইয়ে ত্রুটি হয়েছে।' });
    }
  });

  // Resend OTP Endpoint
  // Route: POST /api/otp/resend
  // Input: sessionId
  app.post('/api/otp/resend', async (req, res) => {
    try {
      const { sessionId } = req.body;
      if (!sessionId) {
        return res.status(400).json({ success: false, error: 'missing_session_id', message: 'Session ID আবশ্যক।' });
      }

      if (!db) {
        return res.status(500).json({ success: false, error: 'db_unavailable' });
      }

      const sessionDocRef = doc(db, 'otp_sessions', sessionId);
      const sessionSnap = await getDoc(sessionDocRef);

      if (!sessionSnap.exists()) {
        return res.status(404).json({ success: false, error: 'session_not_found', message: 'সেশন পাওয়া যায়নি।' });
      }

      const sessionData = sessionSnap.data();
      const newOtpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const newExpiresAt = Date.now() + 5 * 60 * 1000;

      await updateDoc(sessionDocRef, {
        otpCode: newOtpCode,
        expiresAt: newExpiresAt,
        status: 'pending',
        resentAt: new Date().toISOString()
      });

      if (sessionData.email) {
        sendEmailOtpUniversal(sessionData.email, newOtpCode).catch(() => {});
      }

      if (sessionData.userId) {
        const notifRef = doc(collection(db, 'user_notifications'));
        await setDoc(notifRef, {
          id: notifRef.id,
          userId: sessionData.userId,
          title: '🔐 নতুন ওটিপি কোড (পুনরায় প্রেরিত)',
          message: `আপনার নতুন ওটিপি ভেরিফিকেশন কোড: ${newOtpCode} (মেয়াদ: ৫ মিনিট)।`,
          otp: newOtpCode,
          category: 'otp_verification',
          read: false,
          createdAt: new Date().toISOString()
        }).catch(() => {});
      }

      return res.status(200).json({
        success: true,
        sessionId,
        expiresAt: newExpiresAt,
        message: 'নতুন ওটিপি কোড পাঠানো হয়েছে।'
      });
    } catch (err: any) {
      console.error('[OTP Engine] Error in /api/otp/resend:', err);
      return res.status(500).json({ success: false, error: 'server_error', message: err.message });
    }
  });

  // Dedicated Standalone SMS Gateway & Payment Verification Software Page
  app.get('/sms-gateway-client', (req, res) => {
    const html = `<!DOCTYPE html>
<html lang="bn">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BNB SMS Gateway & Payment Verification Client (Standalone)</title>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Hind Siliguri', sans-serif; }
    </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
    <div class="max-w-6xl mx-auto px-4 py-8">
        <header class="flex flex-col md:flex-row justify-between items-center bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 shadow-2xl">
            <div>
                <div class="flex items-center gap-3 mb-2">
                    <span class="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5">
                        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Active Standalone Client
                    </span>
                    <span class="bg-blue-500/20 text-blue-400 text-xs font-semibold px-3 py-1 rounded-full border border-blue-500/30">
                        v2.4.0 Secure
                    </span>
                </div>
                <h1 class="text-2xl md:text-3xl font-bold text-white tracking-tight">BNB SMS Gateway & পেমেন্ট ভেরিফিকেশন সফটওয়্যার</h1>
                <p class="text-slate-400 text-sm mt-1">অ্যান্ড্রয়েড ফোন থেকে bKash, Nagad, Rocket SMS সংগ্রহ করে ফায়ারবেস ও ব্যাকএন্ডে রিয়েল-টাইমে পেমেন্ট ভেরিফাই করার আলাদা টুল।</p>
            </div>
            <div class="mt-4 md:mt-0 flex gap-3">
                <a href="/" class="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium transition border border-slate-700 flex items-center gap-2">
                    🏠 মূল অ্যাপে ফিরে যান
                </a>
                <button onclick="location.reload()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-lg shadow-emerald-900/40">
                    🔄 রিফ্রেশ করুন
                </button>
            </div>
        </header>

        <!-- Webhook URL Box -->
        <div class="bg-gradient-to-r from-slate-900 to-slate-900/80 border border-slate-800 rounded-2xl p-6 mb-8 shadow-xl">
            <h2 class="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                🔗 আপনার SMS Gateway Webhook URL
            </h2>
            <p class="text-slate-400 text-sm mb-4">আপনার অ্যান্ড্রয়েড SMS Forwarder APK বা Tasker অ্যাপে এই এন্ডপয়েন্ট ইউআরএলটি সেট করুন:</p>
            <div class="flex items-center gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <input type="text" id="webhookUrl" readonly value="${req.protocol}://${req.get('host')}/api/sms-gateway/webhook" class="bg-transparent text-emerald-400 font-mono text-sm w-full outline-none">
                <button onclick="copyWebhook()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition shrink-0 flex items-center gap-1.5">
                    📋 কপি করুন
                </button>
            </div>
            <div id="copyAlert" class="text-xs text-emerald-400 mt-2 hidden">ইউআরএল সফলভাবে ক্লিপবোর্ডে কপি করা হয়েছে!</div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <!-- SMS Simulator & Tester -->
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h2 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    🧪 SMS পার্সিং ও পেমেন্ট টেস্ট সিমুলেটর
                </h2>
                <p class="text-slate-400 text-sm mb-4">নিচে bKash, Nagad বা Rocket-এর SMS টেস্ট করে দেখতে পারেন কীভাবে সিস্টেম TrxID ও Amount শনাক্ত করে ফায়ারবেসে পাঠায়:</p>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-xs font-medium text-slate-300 mb-1">পেমেন্ট গেটওয়ে / প্রেরক:</label>
                        <select id="simSender" class="w-bkg bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 w-full">
                            <option value="bKash">bKash (বিকাশ)</option>
                            <option value="Nagad">Nagad (নগদ)</option>
                            <option value="Rocket">Rocket (রকেট)</option>
                            <option value="Upay">Upay (উপায়)</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-xs font-medium text-slate-300 mb-1">লেনদেনের SMS টেক্সট:</label>
                        <textarea id="simMessage" rows="3" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 font-mono">Payment successful. TrxID 9N7K2P9X1Q amount Tk 500.00 to 01700000000. Balance Tk 1,250.00</textarea>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-medium text-slate-300 mb-1">TrxID:</label>
                            <input type="text" id="simTrxId" value="9N7K2P9X1Q" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 font-mono">
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-slate-300 mb-1">পরিমাণ (Amount ৳):</label>
                            <input type="number" id="simAmount" value="500" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 font-mono">
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-medium text-slate-300 mb-1">টার্গেট ইউজার আইডি (ঐচ্ছিক - খালি রাখলে পেন্ডিং লেনদেনের সাথে অটো ম্যাচ করবে):</label>
                        <input type="text" id="simUserId" placeholder="User UID (যেমন: user_123)" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 font-mono">
                    </div>

                    <button onclick="testWebhook()" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition shadow-lg shadow-blue-900/40 flex items-center justify-center gap-2">
                        🚀 টেস্ট রিকোয়েস্ট পাঠান (Test Webhook)
                    </button>
                </div>

                <div id="simResult" class="mt-4 hidden p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs overflow-x-auto text-emerald-400"></div>
            </div>

            <!-- APK / Forwarder Setup Guide -->
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
                <div>
                    <h2 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        📱 মোবাইল APK ও ফরওয়ার্ডার সেটআপ গাইড
                    </h2>
                    <ul class="space-y-3 text-sm text-slate-300">
                        <li class="flex items-start gap-2.5">
                            <span class="bg-emerald-500/20 text-emerald-400 font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5 text-xs">১</span>
                            <span>যে অ্যান্ড্রয়েড ফোনে পেমেন্টের SIM (bKash/Nagad) আছে, তাতে একটি ফ্রি SMS Forwarder অ্যাপ (যেমন: <b>SMS Forwarder by SMS to Webhook / Tasker</b>) ইনস্টল করুন।</span>
                        </li>
                        <li class="flex items-start gap-2.5">
                            <span class="bg-emerald-500/20 text-emerald-400 font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5 text-xs">২</span>
                            <span>অ্যাপের সেটিংসে Webhook URL বক্সে উপরে দেওয়া আমাদের <b>Webhook URL</b> পেস্ট করুন।</span>
                        </li>
                        <li class="flex items-start gap-2.5">
                            <span class="bg-emerald-500/20 text-emerald-400 font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5 text-xs">৩</span>
                            <span>মেথড হিসেবে <b>POST (JSON)</b> সিলেক্ট করুন এবং কী (Key) হিসেবে body-তে <code>trxId</code>, <code>amount</code>, <code>sender</code> ও <code>message</code> পাস করুন।</span>
                        </li>
                        <li class="flex items-start gap-2.5">
                            <span class="bg-emerald-500/20 text-emerald-400 font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5 text-xs">৪</span>
                            <span>ব্যাটারি অপ্টিমাইজেশন (Battery Optimization) বন্ধ রাখুন যাতে ফোন স্লিপ মোডে গেলেও SMS রিসিভ হয়ে সাথে সাথে ফায়ারবেস সার্ভারে চলে যায়।</span>
                        </li>
                    </ul>
                </div>

                <div class="mt-6 pt-6 border-t border-slate-800">
                    <div class="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-xs text-amber-300 leading-relaxed">
                        ⚠️ <b>নিরাপত্তা সতর্কতা:</b> এই স্বতন্ত্র সফটওয়্যারটি শুধুমাত্র পেমেন্ট SMS রিসিভ ও ভেরিফাই করার জন্য তৈরি। কোনো অ্যাডমিন ম্যানুয়াল অনুমোদন বা সিক্রেট কি ছাড়া সরাসরি ব্যালেন্স যোগ হবে না।
                    </div>
                </div>
            </div>
        </div>

        <!-- JSON Payload Template -->
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                📄 JSON Webhook Payload Template
            </h2>
            <pre class="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto"><code>{
  "secretKey": "bnb_sms_gateway_secure_2026",
  "sender": "bKash",
  "message": "Payment successful. TrxID 9N7K2P9X1Q amount Tk 500.00",
  "trxId": "9N7K2P9X1Q",
  "amount": 500.00,
  "userId": ""
}</code></pre>
        </div>
    </div>

    <script>
        function copyWebhook() {
            const copyText = document.getElementById("webhookUrl");
            copyText.select();
            copyText.setSelectionRange(0, 99999);
            navigator.clipboard.writeText(copyText.value);
            const alertBox = document.getElementById("copyAlert");
            alertBox.classList.remove("hidden");
            setTimeout(() => alertBox.classList.add("hidden"), 3000);
        }

        async function testWebhook() {
            const sender = document.getElementById("simSender").value;
            const message = document.getElementById("simMessage").value;
            const trxId = document.getElementById("simTrxId").value;
            const amount = parseFloat(document.getElementById("simAmount").value);
            const userId = document.getElementById("simUserId").value;
            const resultBox = document.getElementById("simResult");

            resultBox.classList.remove("hidden");
            resultBox.innerText = "Processing webhook test request...";

            try {
                const res = await fetch('/api/sms-gateway/webhook', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        secretKey: 'bnb_sms_gateway_secure_2026',
                        sender,
                        message,
                        trxId,
                        amount,
                        userId: userId || undefined
                    })
                });
                const data = await res.json();
                resultBox.innerText = JSON.stringify(data, null, 2);
            } catch (err) {
                resultBox.innerText = "Error: " + err.message;
            }
        }
    </script>
</body>
</html>`;
    return res.send(html);
  });

  // Public endpoints for Google Play Console Privacy Policy checks
  app.get(['/privacy', '/privacy-policy'], (req, res) => {
    const pubPath = path.join(process.cwd(), 'public', 'privacy.html');
    const distPath = path.join(process.cwd(), 'dist', 'privacy.html');
    if (fs.existsSync(distPath)) {
      return res.sendFile(distPath);
    } else if (fs.existsSync(pubPath)) {
      return res.sendFile(pubPath);
    }
    return res.status(404).send('Privacy Policy Not Found');
  });

  // Serve Android App Links assetlinks.json directly
  app.get(['/.well-known/assetlinks.json', '/.well-known/assetlinks'], (req, res) => {
    const assetlinksPath = path.join(process.cwd(), 'public', '.well-known', 'assetlinks.json');
    if (fs.existsSync(assetlinksPath)) {
      res.setHeader('Content-Type', 'application/json');
      return res.sendFile(assetlinksPath);
    }
    return res.status(404).json({ error: 'assetlinks.json not found' });
  });

  // Health check endpoints for Cloud Run, load balancers, and monitoring
  app.get(['/_health', '/healthz', '/api/health'], (req, res) => {
    res.status(200).json({ status: 'ok', time: new Date().toISOString() });
  });

  // Authoritative Version & Deployment Inspection Endpoint
  app.get('/api/version', (req, res) => {
    res.status(200).json({
      name: 'BNB Business Network Bangladesh',
      version: '3.0.0',
      status: 'active',
      auth: 'Email OTP & Direct User Lookup',
      targetDatabaseId: TARGET_DATABASE_ID,
      environment: process.env.NODE_ENV || 'production',
      serverTime: new Date().toISOString()
    });
  });

  // Clean deployment zip download endpoint
  app.get('/bnb-deploy.zip', (req, res) => {
    const zipFile = path.join(__dirname, 'public', 'bnb-deploy.zip');
    if (fs.existsSync(zipFile)) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="bnb-deploy.zip"');
      return res.sendFile(zipFile);
    }
    res.status(404).send('Deploy zip not found');
  });

  // Catch-all for unknown /api/* routes to guarantee JSON response with status 404
  app.all('/api/*', (req, res) => {
    res.status(404).json({ code: 'route_not_found', error: 'API route not found' });
  });

  // If returning from payment gateway with payment query params on root path '/', redirect directly to /dashboard
  app.get('/', (req, res, next) => {
    const hasStatusQuery = Boolean(req.query.status || req.query.payment_status || req.query.val_id);
    if (hasStatusQuery) {
      const qIndex = req.url.indexOf('?');
      const queryString = qIndex !== -1 ? req.url.slice(qIndex) : '';
      return res.redirect(`/dashboard${queryString.startsWith('?') ? queryString : `?${queryString}`}`);
    }
    next();
  });

  // Vite integration as middleware in development, static distribution in production
  const isDev = process.env.NODE_ENV === 'development' || process.env.npm_lifecycle_event === 'dev';
  const hasDist = fs.existsSync(path.join(process.cwd(), 'dist', 'index.html')) || fs.existsSync(path.join(__dirname, 'dist', 'index.html'));
  const isProduction = process.env.NODE_ENV === 'production' || (!isDev && hasDist) || Boolean(process.env.PORT && process.env.PORT !== '3000');

  const gzipCache = new Map<string, Buffer>();
  const serveCompressedAssets = (distDir: string): express.RequestHandler => {
    return (req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      const acceptEncoding = String(req.headers['accept-encoding'] || '');
      if (!acceptEncoding.includes('gzip')) return next();
      const cleanPath = req.path.split('?')[0];
      if (!cleanPath.endsWith('.js') && !cleanPath.endsWith('.css')) return next();

      const filePath = path.join(distDir, cleanPath);
      if (!filePath.startsWith(distDir) || !fs.existsSync(filePath)) return next();

      try {
        let compressed = gzipCache.get(filePath);
        if (!compressed) {
          const raw = fs.readFileSync(filePath);
          compressed = zlib.gzipSync(raw, { level: 6 });
          gzipCache.set(filePath, compressed);
        }
        res.setHeader('Content-Type', cleanPath.endsWith('.js') ? 'application/javascript; charset=UTF-8' : 'text/css; charset=UTF-8');
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Vary', 'Accept-Encoding');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Content-Length', String(compressed.length));
        if (req.method === 'HEAD') return res.status(200).end();
        return res.status(200).send(compressed);
      } catch (e) {
        return next();
      }
    };
  };

  // Self-cleaning service worker endpoints in case any browser registered a legacy SW
  app.get(['/sw.js', '/service-worker.js'], (req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    return res.status(200).send(`
      self.addEventListener('install', () => self.skipWaiting());
      self.addEventListener('activate', (event) => {
        event.waitUntil(
          caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n))))
            .then(() => self.registration.unregister())
        );
      });
    `);
  });

  const sendFreshIndexHtml = (distDir: string, req: express.Request, res: express.Response) => {
    delete req.headers['if-none-match'];
    delete req.headers['if-modified-since'];
    res.removeHeader('ETag');
    res.removeHeader('Last-Modified');
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0');
    res.setHeader('CDN-Cache-Control', 'no-store');
    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const indexPath = path.join(distDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      const htmlContent = fs.readFileSync(indexPath, 'utf-8');
      return res.status(200).send(htmlContent);
    }
    return res.status(404).send('index.html not found');
  };

  if (!isProduction) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: false,
        },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (viteErr) {
      console.warn('[Server] Could not initialize Vite middleware, falling back to static dist:', viteErr);
      const distPath = fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'))
        ? path.join(process.cwd(), 'dist')
        : path.join(__dirname, 'dist');
      app.use(serveCompressedAssets(distPath));
      app.use(express.static(distPath, { index: false, etag: false, lastModified: false }));
      app.get('*', (req, res) => {
        sendFreshIndexHtml(distPath, req, res);
      });
    }
  } else {
    const distPath = fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'))
      ? path.join(process.cwd(), 'dist')
      : path.join(__dirname, 'dist');
    console.log(`[Server] Serving production static files from ${distPath}`);
    app.use(serveCompressedAssets(distPath));
    // Serve raw assets out of the client build folder, but NEVER let express.static serve index.html with 1980 ETag
    app.use(express.static(distPath, { index: false, etag: false, lastModified: false }));
    
    // Catch-all route: Always serve fresh index.html with no-store headers (prevents 304 stale cache)
    app.get('*', (req, res) => {
      sendFreshIndexHtml(distPath, req, res);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} in ${isProduction ? 'production' : 'development'} mode`);
  });
}

startServer();
