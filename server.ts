import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, getDocs, deleteDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import admin from 'firebase-admin';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for body parsing
  app.use(express.json());

  // Initialize Firebase Admin for server-side operations
  let adminDb: any = null;
  const firebaseAdmin = admin as any;
  try {
    if (!firebaseAdmin || !firebaseAdmin.apps || !firebaseAdmin.apps.length) {
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.applicationDefault()
      });
    }
    adminDb = firebaseAdmin.firestore();
  } catch (err) {
    console.error("Failed to initialize Firebase Admin (this is expected in some environments):", err);
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

  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      firebaseApp = initializeApp(firebaseConfig);
      const TARGET_DATABASE_ID = "ai-studio-120ec6e1-2db5-45d2-b1b1-46493400c959";
      db = getFirestore(firebaseApp, TARGET_DATABASE_ID);
      console.log("Firebase initialized successfully on backend server with database:", TARGET_DATABASE_ID);
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
