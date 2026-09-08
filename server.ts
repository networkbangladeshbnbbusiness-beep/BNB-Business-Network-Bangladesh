import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, getDocs, deleteDoc, updateDoc, addDoc, serverTimestamp, getDoc, runTransaction } from 'firebase/firestore';
import admin from 'firebase-admin';


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
      paymentMethod: 'NagorikPay Gateway',
      phone: userData.phone || '',
      senderPhone: userData.phone || '',
      senderInfo: 'NagorikPay Gateway',
      accountNumber: userData.phone || '',
      trxId: transaction_id,
      transactionId: transaction_id,
      receiptNo: transaction_id,
      createdAt: new Date().toISOString(),
      description: `NagorikPay পেমেন্ট গেটওয়ের মাধ্যমে ৳${depositAmount.toLocaleString('bn-BD')} টাকা অনলাইন অ্যাড মানি সফলভাবে সম্পন্ন হয়েছে।`
    });

    // 6. Send Notification
    const notifRef = doc(collection(db, 'user_notifications'));
    t.set(notifRef, {
      id: notifRef.id,
      userId: verifiedUserId,
      title: 'অনলাইন অ্যাড মানি সফল হয়েছে 🎉',
      body: `নাগরিকপে গেটওয়ের মাধ্যমে আপনার ওয়ালেটে ৳${depositAmount.toLocaleString('bn-BD')} টাকা সফলভাবে যোগ হয়েছে।`,
      message: `নাগরিকপে গেটওয়ের মাধ্যমে আপনার ওয়ালেটে ৳${depositAmount.toLocaleString('bn-BD')} টাকা সফলভাবে যোগ হয়েছে।`,
      screen: 'wallet',
      createdAt: new Date().toISOString(),
      read: false
    });

    return { alreadyProcessed: false, newBalance, amount: depositAmount };
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Middleware for body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Initialize Firebase Admin for server-side operations
  let adminDb: any = null;
  const firebaseAdmin = admin as any;
  try {
    if (firebaseAdmin && (!firebaseAdmin.apps || !firebaseAdmin.apps.length)) {
      if (firebaseAdmin.credential && typeof firebaseAdmin.credential.applicationDefault === 'function') {
        try {
          firebaseAdmin.initializeApp({
            credential: firebaseAdmin.credential.applicationDefault()
          });
        } catch {
          firebaseAdmin.initializeApp();
        }
      } else if (typeof firebaseAdmin.initializeApp === 'function') {
        firebaseAdmin.initializeApp();
      }
    }
    if (firebaseAdmin && typeof firebaseAdmin.firestore === 'function' && firebaseAdmin.apps && firebaseAdmin.apps.length) {
      adminDb = firebaseAdmin.firestore();
    }
  } catch (err) {
    // Graceful fallback if firebase-admin credentials are not present in container
  }

  // Let's add a health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', appName: 'BNB Business Network Bangladesh' });
  });

  // Serve static assets from the root assets/ directory directly
  app.use('/assets', express.static(path.join(process.cwd(), 'assets')));

  // Firebase Setup on Server Side (for listeners)
  let firebaseApp: any = null;
  let db: any = null;
  let cachedOneSignalAppId: string | null = null;
  let cachedOneSignalRestApiKey: string | null = null;

  // =========================================================================
  // Automated 60-Day Transaction Retention & Firestore Optimization Engine
  // =========================================================================
  const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

  async function runScheduledTransactionCleanup(databaseInstance: any) {
    if (!databaseInstance) return;
    try {
      const cutoffTime = Date.now() - SIXTY_DAYS_MS;
      console.log("[AutoRetention Engine] Running scheduled cleanup for transactions older than 60 days...");
      
      const txCollectionRef = collection(databaseInstance, 'transactions');
      const snapshot = await getDocs(txCollectionRef);
      let deletedTxCount = 0;
      
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        let txTime = 0;
        if (data.createdAt?.toMillis) {
          txTime = data.createdAt.toMillis();
        } else if (data.createdAt?.toDate) {
          txTime = data.createdAt.toDate().getTime();
        } else if (typeof data.createdAt === 'number') {
          txTime = data.createdAt;
        } else if (typeof data.createdAt === 'string') {
          txTime = new Date(data.createdAt).getTime();
        }
        
        // STRICT SAFETY GATE:
        // Only delete if timestamp is valid positive number AND strictly older than 60 full days
        if (txTime > 0 && txTime < cutoffTime) {
          await deleteDoc(doc(databaseInstance, 'transactions', docSnap.id)).catch(err => {
            console.warn("[AutoRetention Engine] Could not delete expired doc " + docSnap.id + ":", err);
          });
          deletedTxCount++;
        }
      }
      
      if (deletedTxCount > 0) {
        console.log("[AutoRetention Engine] Successfully deleted " + deletedTxCount + " expired transactions (>60 days). Users balance and permanent account records remain 100% intact.");
      } else {
        console.log("[AutoRetention Engine] Cleanup check complete. No transactions exceeded the 60-day threshold.");
      }
    } catch (err: any) {
      console.error("[AutoRetention Engine] Error during scheduled cleanup:", err?.message || err);
    }
  }


  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      firebaseApp = initializeApp(firebaseConfig);
      const TARGET_DATABASE_ID = "ai-studio-120ec6e1-2db5-45d2-b1b1-46493400c959";
      db = getFirestore(firebaseApp, TARGET_DATABASE_ID);
      console.log("Firebase initialized successfully on backend server with database:", TARGET_DATABASE_ID);
      // Schedule auto-retention cleanup: run 15s after boot and every 24 hours
      setTimeout(() => {
        runScheduledTransactionCleanup(db);
      }, 15000);

      setInterval(() => {
        runScheduledTransactionCleanup(db);
      }, 24 * 60 * 60 * 1000);



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
  if (db) {
    try {
      const configDocRef = doc(db, 'system_settings', 'app_config');
      onSnapshot(configDocRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          cachedOneSignalAppId = data.oneSignalAppId || null;
          cachedOneSignalRestApiKey = data.oneSignalRestApiKey || null;
          console.log("OneSignal Real-Time Config Loaded in memory. AppID:", cachedOneSignalAppId);
        }
      }, (err) => {
        console.warn("Error listening to app_config in server:", err);
      });
    } catch (err) {
      console.error("Failed to start app_config listener on server:", err);
    }
  }

  // Automatic Listener on user_notifications Firestore collection
  const processedIds = new Set<string>();
  let isInitial = true;

  if (db) {
    try {
      const notificationsColRef = collection(db, 'user_notifications');
      onSnapshot(notificationsColRef, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const docData = change.doc.data();
            const docId = change.doc.id;
            const notificationId = docData.id || docId;

            // Deduplicate to avoid dual trigger
            if (processedIds.has(notificationId)) return;
            processedIds.add(notificationId);

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
      }, (err) => {
        console.warn("Error listening to user_notifications in server:", err);
      });
    } catch (err) {
      console.error("Failed to start user_notifications background listener on server:", err);
    }
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
        authorized: isSame,
        isZeroDevice,
        isBypassed,
        isLoggedIn: Boolean(u.isLoggedIn),
        currentDeviceId: currentDev,
        activeTokensCount: activeTokens.length,
        message: isSame ? "Device authorized" : "Account locked to another physical device"
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

  // ==========================================
  // NAGORIKPAY GATEWAY INTEGRATION ENDPOINTS
  // ==========================================

  // 1. Create Payment Proxy Endpoint
  app.post('/api/payment/create', async (req, res) => {
    let debugData: any = {
      timestamp: new Date().toISOString(),
      frontend_payload: req.body,
      user_profile_data: null,
      outgoing_nagorikpay_payload: null,
      outgoing_headers: null,
      nagorikpay_response_status: null,
      nagorikpay_response_body: null,
      error: null
    };

    try {
      const { amount, userId, phone } = req.body;
      if (!amount || !userId) {
        debugData.error = 'amount and userId are required.';
        fs.writeFileSync(path.join(process.cwd(), 'payment_debug.json'), JSON.stringify(debugData, null, 2));
        return res.status(400).json({ error: 'amount and userId are required.' });
      }

      let baseDomain = '';
      if (req.headers.origin) {
        baseDomain = req.headers.origin as string;
      } else if (req.headers.referer) {
        try {
          const refUrl = new URL(req.headers.referer as string);
          baseDomain = `${refUrl.protocol}//${refUrl.host}`;
        } catch (e) {
          const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
          const host = req.headers['x-forwarded-host'] || req.headers.host;
          baseDomain = `${protocol}://${host}`;
        }
      } else {
        const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        baseDomain = `${protocol}://${host}`;
      }

      let cus_name = 'BNB Customer';
      let cus_phone = phone || '';
      let cus_email = 'customer@bnbbusiness.com';

      if (db) {
        try {
                const userDocRef = doc(db, 'users', userId);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            cus_name = userData.name || userData.userName || cus_name;
            cus_phone = userData.phone || userData.userPhone || cus_phone || '';
            cus_email = userData.email || cus_email;
            debugData.user_profile_data = {
              fetched_name: userData.name || userData.userName || null,
              fetched_phone: userData.phone || userData.userPhone || null,
              fetched_email: userData.email || null
            };
          } else {
            debugData.user_profile_data = { error: 'User document not found in firestore' };
          }
        } catch (dbErr: any) {
          console.error('Error fetching user details for NagorikPay payment initialization:', dbErr);
          debugData.user_profile_data = { error: dbErr.message || 'Firestore getDoc exception' };
        }
      } else {
        debugData.user_profile_data = { error: 'Firestore db object is not defined on server' };
      }

      if (!cus_phone) {
        cus_phone = '01800000000';
      }

      const payload = {
        amount: parseFloat(amount),
        cus_name: cus_name,
        cus_phone: cus_phone,
        cus_email: cus_email,
        success_url: `${baseDomain}/api/payment/nagorikpay-callback?userId=${userId}&amount=${amount}`,
        cancel_url: `${baseDomain}/api/payment/nagorikpay-cancel?userId=${userId}&amount=${amount}`,
        webhook_url: `${baseDomain}/api/payment/nagorikpay-webhook?userId=${userId}&amount=${amount}`,
        metadata: {
          userId,
          amount,
          phone: cus_phone
        }
      };

      debugData.outgoing_nagorikpay_payload = payload;
      debugData.outgoing_headers = {
        'Content-Type': 'application/json',
        'api_key': 'vk5JYpiHRbSG7QYfMDeOdMQddh2L54jmhtAGki1dFea9yrmVjD'
      };

      console.log('Initiating NagorikPay payment creation with payload:', JSON.stringify(payload));

      const response = await fetch('https://secure-pay.nagorikpay.com/api/payment/create', {
        method: 'POST',
        headers: debugData.outgoing_headers,
        body: JSON.stringify(payload)
      });

      debugData.nagorikpay_response_status = response.status;

      let responseData: any;
      const responseText = await response.text();
      try {
        responseData = JSON.parse(responseText);
        debugData.nagorikpay_response_body = responseData;
      } catch (jsonErr) {
        responseData = { text: responseText };
        debugData.nagorikpay_response_body = responseText;
      }

      console.log('NagorikPay create payment response:', JSON.stringify(responseData));

      // Save complete log to file
      fs.writeFileSync(path.join(process.cwd(), 'payment_debug.json'), JSON.stringify(debugData, null, 2));

      if (responseData && (responseData.status === true || responseData.status === 'true' || responseData.status === 'success' || responseData.status === 1 || responseData.status === '1' || responseData.payment_url)) {
        const paymentUrl = responseData.payment_url || responseData.redirect_url || responseData.url || responseData.checkout_url;
        if (paymentUrl) {
          return res.json({ success: true, payment_url: paymentUrl });
        }
      }

      return res.status(400).json({
        success: false,
        error: responseData?.message || responseData?.error || 'Failed to create payment on NagorikPay',
        debug: debugData
      });
    } catch (error: any) {
      console.error('Error in /api/payment/create:', error);
      debugData.error = error.message || error.toString();
      fs.writeFileSync(path.join(process.cwd(), 'payment_debug.json'), JSON.stringify(debugData, null, 2));
      return res.status(500).json({ error: error.message || 'Server error initiating payment', debug: debugData });
    }
  });

  // 2. NagorikPay Success Callback Endpoint
  app.all('/api/payment/nagorikpay-callback', async (req, res) => {
    try {
      
      const transaction_id = req.query.transaction_id || req.body.transaction_id || req.query.invoice_id || req.body.invoice_id;
      
      if (!transaction_id) {
        console.error('No transaction_id provided in callback');
        return res.redirect('/?payment_status=failed&error=missing_transaction_id');
      }

      // Verify with NagorikPay
      const verifyResponse = await fetch('https://secure-pay.nagorikpay.com/api/payment/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': 'vk5JYpiHRbSG7QYfMDeOdMQddh2L54jmhtAGki1dFea9yrmVjD',
          'API-KEY': 'vk5JYpiHRbSG7QYfMDeOdMQddh2L54jmhtAGki1dFea9yrmVjD'
        },
        body: JSON.stringify({ transaction_id })
      });

      const verifyData: any = await verifyResponse.json();
      console.log('NagorikPay callback verification API response:', JSON.stringify(verifyData));

      const statusUpper = String(verifyData?.status || '').toUpperCase();
      const isVerified = verifyData?.status === true || verifyData?.status === 'true' || statusUpper === 'TRUE' || statusUpper === 'SUCCESS' || statusUpper === 'APPROVED';

      if (!isVerified) {
        console.error('NagorikPay transaction verification failed:', verifyData);
        return res.redirect(`/?payment_status=failed&error=verification_failed`);
      }

      // Extract verified details strictly from gateway response (NOT url)
      let verifiedUserId = verifyData?.metadata?.userId || verifyData?.meta_data?.userId || verifyData?.userId || verifyData?.user_id || verifyData?.cus_id || req.query.userId || req.body.userId;
      let verifiedAmount = verifyData?.metadata?.amount || verifyData?.meta_data?.amount || verifyData?.amount || verifyData?.payment_amount || verifyData?.total_amount || req.query.amount || req.body.amount;

      // If missing, we MUST fail according to the strict rule (No guessing from URL)
      if (!verifiedUserId || !verifiedAmount) {
         console.error('CRITICAL: verifyData missing userId or amount!', verifyData);
         return res.redirect(`/?payment_status=failed&error=missing_verification_metadata`);
      }

      try {
        const txResult = await processVerifiedPayment(db, transaction_id, verifiedUserId, verifiedAmount, verifyData);
        
        if (txResult.alreadyProcessed) {
          console.log(`Transaction ${transaction_id} already processed via callback. Idempotency protected.`);
        } else {
          console.log(`Callback successfully credited user ${verifiedUserId} with ৳${txResult.amount}. New Balance: ৳${txResult.newBalance}`);
        }
        return res.redirect(`/?payment_status=success&amount=${txResult.amount}`);
      } catch (err: any) {
        console.error('Error processing callback payment:', err.message);
        return res.redirect(`/?payment_status=failed&error=${encodeURIComponent(err.message || 'processing_failed')}`);
      }

    } catch (error: any) {
      console.error('Error in /api/payment/nagorikpay-callback:', error);
      return res.redirect(`/?payment_status=failed&error=${encodeURIComponent(error.message || 'callback_error')}`);
    }
  });

  // 3. NagorikPay Cancel Callback Endpoint
  app.all('/api/payment/nagorikpay-cancel', (req, res) => {
    console.log('NagorikPay payment cancelled by user:', req.query, 'Body:', req.body);
    return res.redirect('/?payment_status=cancelled');
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

  // 4. NagorikPay Webhook Endpoint
  app.post('/api/payment/nagorikpay-webhook', async (req, res) => {
    console.log('NagorikPay payment webhook received:', req.body);
    try {
      
      // NagorikPay webhook might send transaction_id directly in the body
      const transaction_id = req.body.transaction_id || req.body.invoice_id || req.body.trx_id;

      if (!transaction_id) {
         return res.status(400).json({ error: 'missing_transaction_id' });
      }

      // Verify with NagorikPay (always re-verify webhook payloads to avoid spoofing)
      const verifyResponse = await fetch('https://secure-pay.nagorikpay.com/api/payment/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': 'vk5JYpiHRbSG7QYfMDeOdMQddh2L54jmhtAGki1dFea9yrmVjD',
          'API-KEY': 'vk5JYpiHRbSG7QYfMDeOdMQddh2L54jmhtAGki1dFea9yrmVjD'
        },
        body: JSON.stringify({ transaction_id })
      });

      const verifyData: any = await verifyResponse.json();
      console.log('NagorikPay webhook verification API response:', JSON.stringify(verifyData));

      const statusUpper = String(verifyData?.status || '').toUpperCase();
      const isVerified = verifyData?.status === true || verifyData?.status === 'true' || statusUpper === 'TRUE' || statusUpper === 'SUCCESS' || statusUpper === 'APPROVED';

      if (!isVerified) {
        return res.status(400).json({ error: 'verification_failed' });
      }

      // Extract verified details strictly from gateway response
      let verifiedUserId = verifyData?.metadata?.userId || verifyData?.meta_data?.userId || verifyData?.userId || verifyData?.user_id || verifyData?.cus_id || req.query.userId || req.body.userId;
      let verifiedAmount = verifyData?.metadata?.amount || verifyData?.meta_data?.amount || verifyData?.amount || verifyData?.payment_amount || verifyData?.total_amount || req.query.amount || req.body.amount;

      if (!verifiedUserId || !verifiedAmount) {
         return res.status(400).json({ error: 'missing_verification_metadata', verifyData });
      }

      const txResult = await processVerifiedPayment(db, transaction_id, verifiedUserId, verifiedAmount, verifyData);
      
      if (txResult.alreadyProcessed) {
        console.log(`Webhook ignored transaction ${transaction_id} as it was already processed.`);
      } else {
        console.log(`Webhook successfully credited user ${verifiedUserId} with ৳${txResult.amount}.`);
      }
      
      return res.status(200).json({ received: true, status: 'processed', transaction_id });
    } catch (err: any) {
      console.error('Error processing webhook payment:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // Vite integration as middleware depending on environment
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Serve raw assets out of the client build folder
    app.use(express.static(distPath));
    
    // Catch-all route: Send any index requests or custom deep-links
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
