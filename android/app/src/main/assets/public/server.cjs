var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_vite = require("vite");
var import_app = require("firebase/app");
var import_firestore = require("firebase/firestore");
var import_firebase_admin = __toESM(require("firebase-admin"), 1);
async function processVerifiedPayment(db, transaction_id, verifiedUserId, verifiedAmount, rawVerifyData) {
  if (!db) throw new Error("database_disconnected");
  if (!verifiedUserId) throw new Error("user_not_found_in_verification");
  const depositAmount = parseFloat(verifiedAmount);
  if (isNaN(depositAmount) || depositAmount <= 0) {
    throw new Error("invalid_amount");
  }
  const txDocRef = (0, import_firestore.doc)(db, "transactions", `NP_${transaction_id}`);
  const userDocRef = (0, import_firestore.doc)(db, "users", verifiedUserId);
  return await (0, import_firestore.runTransaction)(db, async (t) => {
    const txSnap = await t.get(txDocRef);
    if (txSnap.exists()) {
      return { alreadyProcessed: true, amount: txSnap.data().amount };
    }
    const userDoc = await t.get(userDocRef);
    if (!userDoc.exists()) {
      throw new Error("user_not_found");
    }
    const userData = userDoc.data();
    const currentBalance = Number(userData.balance) || 0;
    const currentMainBalance = Number(userData.mainBalance) || 0;
    const newBalance = currentBalance + depositAmount;
    const newMainBalance = currentMainBalance + depositAmount;
    t.update(userDocRef, {
      balance: newBalance,
      mainBalance: newMainBalance
    });
    t.set(txDocRef, {
      id: txDocRef.id,
      userId: verifiedUserId,
      userName: userData.name || "Anonymous User",
      userPhone: userData.phone || "",
      memberId: userData.memberId || "BNB000000",
      amount: depositAmount,
      type: "add_money",
      status: "success",
      paymentMethod: "NagorikPay Gateway",
      phone: userData.phone || "",
      senderPhone: userData.phone || "",
      senderInfo: "NagorikPay Gateway",
      accountNumber: userData.phone || "",
      trxId: transaction_id,
      transactionId: transaction_id,
      receiptNo: transaction_id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      description: `NagorikPay \u09AA\u09C7\u09AE\u09C7\u09A8\u09CD\u099F \u0997\u09C7\u099F\u0993\u09AF\u09BC\u09C7\u09B0 \u09AE\u09BE\u09A7\u09CD\u09AF\u09AE\u09C7 \u09F3${depositAmount.toLocaleString("bn-BD")} \u099F\u09BE\u0995\u09BE \u0985\u09A8\u09B2\u09BE\u0987\u09A8 \u0985\u09CD\u09AF\u09BE\u09A1 \u09AE\u09BE\u09A8\u09BF \u09B8\u09AB\u09B2\u09AD\u09BE\u09AC\u09C7 \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7\u0964`
    });
    const notifRef = (0, import_firestore.doc)((0, import_firestore.collection)(db, "user_notifications"));
    t.set(notifRef, {
      id: notifRef.id,
      userId: verifiedUserId,
      title: "\u0985\u09A8\u09B2\u09BE\u0987\u09A8 \u0985\u09CD\u09AF\u09BE\u09A1 \u09AE\u09BE\u09A8\u09BF \u09B8\u09AB\u09B2 \u09B9\u09DF\u09C7\u099B\u09C7 \u{1F389}",
      body: `\u09A8\u09BE\u0997\u09B0\u09BF\u0995\u09AA\u09C7 \u0997\u09C7\u099F\u0993\u09AF\u09BC\u09C7\u09B0 \u09AE\u09BE\u09A7\u09CD\u09AF\u09AE\u09C7 \u0986\u09AA\u09A8\u09BE\u09B0 \u0993\u09DF\u09BE\u09B2\u09C7\u099F\u09C7 \u09F3${depositAmount.toLocaleString("bn-BD")} \u099F\u09BE\u0995\u09BE \u09B8\u09AB\u09B2\u09AD\u09BE\u09AC\u09C7 \u09AF\u09CB\u0997 \u09B9\u09DF\u09C7\u099B\u09C7\u0964`,
      message: `\u09A8\u09BE\u0997\u09B0\u09BF\u0995\u09AA\u09C7 \u0997\u09C7\u099F\u0993\u09AF\u09BC\u09C7\u09B0 \u09AE\u09BE\u09A7\u09CD\u09AF\u09AE\u09C7 \u0986\u09AA\u09A8\u09BE\u09B0 \u0993\u09DF\u09BE\u09B2\u09C7\u099F\u09C7 \u09F3${depositAmount.toLocaleString("bn-BD")} \u099F\u09BE\u0995\u09BE \u09B8\u09AB\u09B2\u09AD\u09BE\u09AC\u09C7 \u09AF\u09CB\u0997 \u09B9\u09DF\u09C7\u099B\u09C7\u0964`,
      screen: "wallet",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      read: false
    });
    return { alreadyProcessed: false, newBalance, amount: depositAmount };
  });
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = Number(process.env.PORT) || 3e3;
  app.use(import_express.default.json());
  app.use(import_express.default.urlencoded({ extended: true }));
  let adminDb = null;
  const firebaseAdmin = import_firebase_admin.default;
  try {
    if (firebaseAdmin && (!firebaseAdmin.apps || !firebaseAdmin.apps.length)) {
      if (firebaseAdmin.credential && typeof firebaseAdmin.credential.applicationDefault === "function") {
        try {
          firebaseAdmin.initializeApp({
            credential: firebaseAdmin.credential.applicationDefault()
          });
        } catch {
          firebaseAdmin.initializeApp();
        }
      } else if (typeof firebaseAdmin.initializeApp === "function") {
        firebaseAdmin.initializeApp();
      }
    }
    if (firebaseAdmin && typeof firebaseAdmin.firestore === "function" && firebaseAdmin.apps && firebaseAdmin.apps.length) {
      adminDb = firebaseAdmin.firestore();
    }
  } catch (err) {
  }
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", appName: "BNB Business Network Bangladesh" });
  });
  app.use("/assets", import_express.default.static(import_path.default.join(process.cwd(), "assets")));
  let firebaseApp = null;
  let db = null;
  let cachedOneSignalAppId = null;
  let cachedOneSignalRestApiKey = null;
  try {
    const configPath = import_path.default.resolve(process.cwd(), "firebase-applet-config.json");
    if (import_fs.default.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(import_fs.default.readFileSync(configPath, "utf8"));
      firebaseApp = (0, import_app.initializeApp)(firebaseConfig);
      const TARGET_DATABASE_ID = "ai-studio-120ec6e1-2db5-45d2-b1b1-46493400c959";
      db = (0, import_firestore.getFirestore)(firebaseApp, TARGET_DATABASE_ID);
      console.log("Firebase initialized successfully on backend server with database:", TARGET_DATABASE_ID);
    } else {
      console.warn("firebase-applet-config.json not found on backend. Skipping firebase initialization.");
    }
  } catch (err) {
    console.error("Failed to initialize Firebase on server-side:", err);
  }
  async function sendFcmPush(userId, title, message, deepLink) {
    if (!adminDb) {
      console.warn("Firebase Admin DB not initialized, skipping push notification");
      return;
    }
    try {
      const fcmTokensSnapshot = await adminDb.collection(`users/${userId}/fcmTokens`).get();
      const tokens = fcmTokensSnapshot.docs.map((doc2) => doc2.data().token);
      if (tokens.length === 0) return;
      const messagePayload = {
        tokens,
        notification: {
          title,
          body: message
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
  async function sendOneSignalPush(payload) {
    const appId = cachedOneSignalAppId;
    const apiKey = cachedOneSignalRestApiKey;
    if (!appId || !apiKey) {
      console.warn("OneSignal is not configured in Firestore app_config. Skipping push dispatch.");
      return { error: "OneSignal not configured" };
    }
    const { userId, userIds, title, message, deepLink, imageUrl, filters } = payload;
    const body = {
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
    } else if (userId && userId !== "all") {
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
      if (data.errors && data.errors.includes("All included players are not subscribed")) {
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
  if (db) {
    try {
      const configDocRef = (0, import_firestore.doc)(db, "system_settings", "app_config");
      (0, import_firestore.onSnapshot)(configDocRef, (snapshot) => {
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
  const processedIds = /* @__PURE__ */ new Set();
  let isInitial = true;
  if (db) {
    try {
      const notificationsColRef = (0, import_firestore.collection)(db, "user_notifications");
      (0, import_firestore.onSnapshot)(notificationsColRef, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === "added") {
            const docData = change.doc.data();
            const docId = change.doc.id;
            const notificationId = docData.id || docId;
            if (processedIds.has(notificationId)) return;
            processedIds.add(notificationId);
            if (docData.skipPush === true || docData.category === "admin_msg") {
              console.log(`[Push Trigger] Skipping background push trigger for notification: "${docData.title}"`);
              return;
            }
            if (!isInitial) {
              console.log(`[Push Trigger] New notification added: "${docData.title}" -> sending push notification...`);
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
      }, (err) => {
        console.warn("Error listening to user_notifications in server:", err);
      });
    } catch (err) {
      console.error("Failed to start user_notifications background listener on server:", err);
    }
  }
  app.post("/api/system-reset", async (req, res) => {
    try {
      const { resetMode, adminPin } = req.body;
      if (!db) {
        return res.status(500).json({ error: "Database instance not connected on backend" });
      }
      let affectedUsers = 0;
      let deletedAccounts = 0;
      let deletedTxCount = 0;
      const usersSnap = await (0, import_firestore.getDocs)((0, import_firestore.collection)(db, "users"));
      const userPromises = [];
      usersSnap.forEach((userDoc) => {
        const uData = userDoc.data();
        const uUid = userDoc.id;
        const isAdminUser = uData.role === "admin" || uData.role === "super_admin" || uData.email === "networkbangladeshbnbbusiness@gmail.com";
        if (resetMode === "delete_members" || resetMode === "delete_all_accounts" || resetMode === "full_launch" || !resetMode || resetMode === "reset_balances") {
          if (!isAdminUser) {
            userPromises.push((0, import_firestore.deleteDoc)((0, import_firestore.doc)(db, "users", uUid)).catch(() => {
            }));
            deletedAccounts++;
          } else {
            userPromises.push(
              (0, import_firestore.updateDoc)((0, import_firestore.doc)(db, "users", uUid), {
                balance: 0,
                pendingBalance: 0,
                mainBalance: 0,
                loanBalance: 0,
                dueLoan: 0,
                qardBalance: 0,
                qardActiveAmount: 0,
                activeLoanAmount: 0,
                samityBalance: 0,
                savings: 0,
                savingsBalance: 0,
                dpsBalance: 0,
                profitsBalance: 0,
                referralEarnings: 0,
                agentCommission: 0,
                cashoutLimit: 0,
                earningBalance: 0,
                availableBalance: 0,
                rewardPoints: 0,
                shares: 0,
                coopShareAmount: 0,
                coopShareCount: 0
              }).catch(() => {
              })
            );
            affectedUsers++;
          }
        } else {
          userPromises.push(
            (0, import_firestore.updateDoc)((0, import_firestore.doc)(db, "users", uUid), {
              balance: 0,
              pendingBalance: 0,
              mainBalance: 0,
              loanBalance: 0,
              dueLoan: 0,
              qardBalance: 0,
              qardActiveAmount: 0,
              activeLoanAmount: 0,
              samityBalance: 0,
              savings: 0,
              savingsBalance: 0,
              dpsBalance: 0,
              profitsBalance: 0,
              referralEarnings: 0,
              agentCommission: 0,
              cashoutLimit: 0,
              earningBalance: 0,
              availableBalance: 0,
              rewardPoints: 0,
              shares: 0,
              coopShareAmount: 0,
              coopShareCount: 0
            }).catch(() => {
            })
          );
          affectedUsers++;
        }
      });
      await Promise.all(userPromises);
      const wipeCollections = [
        "transactions",
        "user_notifications",
        "company_expenses",
        "admin_broadcast_logs",
        "loan_applications",
        "qard_applications",
        "shop_orders",
        "telecom_orders",
        "safe_deals",
        "safe_deal_orders",
        "escrow_deals",
        "escrow_disputes",
        "ration_cards",
        "ration_orders",
        "courier_orders",
        "courier_riders",
        "exchange_orders",
        "hisab_customers",
        "hisab_transactions",
        "salary_payments",
        "share_transfers",
        "support_chats",
        "user_reports",
        "agent_applications",
        "agent_requests",
        "agent_reports",
        "bap_admin_requests",
        "bap_reports",
        "corporate_feedbacks",
        "edu_read_logs",
        "edu_bookmarks"
      ];
      for (const colName of wipeCollections) {
        try {
          const colSnap = await (0, import_firestore.getDocs)((0, import_firestore.collection)(db, colName));
          const colPromises = [];
          colSnap.forEach((cDoc) => {
            colPromises.push((0, import_firestore.deleteDoc)((0, import_firestore.doc)(db, colName, cDoc.id)).catch(() => {
            }));
            if (colName === "transactions") deletedTxCount++;
          });
          await Promise.all(colPromises);
        } catch (err) {
          console.warn(`Wiping collection ${colName} skipped or failed:`, err);
        }
      }
      try {
        const configRef = (0, import_firestore.doc)(db, "system_settings", "app_config");
        await (0, import_firestore.updateDoc)(configRef, {
          totalReserveFund: 0,
          companyVaultBalance: 0,
          samityFundTotal: 0
        }).catch(() => {
        });
      } catch (e) {
      }
      await (0, import_firestore.addDoc)((0, import_firestore.collection)(db, "system_reset_logs"), {
        resetAt: (/* @__PURE__ */ new Date()).toISOString(),
        timestamp: (0, import_firestore.serverTimestamp)(),
        resetType: resetMode || "reset_balances",
        affectedUsers,
        deletedAccounts,
        deletedTxCount,
        note: "Production Launch: Complete System Balance and History Initialization"
      }).catch(() => {
      });
      return res.json({
        success: true,
        message: "System reset completed successfully for production release",
        affectedUsers,
        deletedAccounts,
        deletedTxCount
      });
    } catch (err) {
      console.error("System reset API error:", err);
      return res.status(500).json({ error: err.message || "Failed to execute system reset" });
    }
  });
  app.post("/api/send-targeted-push", async (req, res) => {
    const { title, message, imageUrl, deepLink, targetType, targetValue } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: "Title and message are required" });
    }
    let filters = [];
    let userIds = void 0;
    if (targetType === "user" && targetValue) {
      userIds = targetValue.split(",").map((id) => id.trim());
    } else if (targetType === "role" && targetValue) {
      filters = [{ field: "tag", key: "role", relation: "is", value: targetValue }];
    } else if (targetType === "group" && targetValue) {
      filters = [{ field: "tag", key: "group", relation: "is", value: targetValue }];
    } else if (targetType === "division" && targetValue) {
      filters = [{ field: "tag", key: "division", relation: "is", value: targetValue }];
    }
    const result = await sendOneSignalPush({
      userIds,
      userId: targetType === "all" ? "all" : void 0,
      title,
      message,
      imageUrl,
      deepLink,
      filters: filters.length > 0 ? filters : void 0
    });
    const hasErrors = result && result.errors && result.errors.length > 0;
    return res.json({
      success: !hasErrors,
      result,
      error: hasErrors ? result.errors.join(", ") : void 0
    });
  });
  app.post("/api/payment/create", async (req, res) => {
    let debugData = {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
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
        debugData.error = "amount and userId are required.";
        import_fs.default.writeFileSync(import_path.default.join(process.cwd(), "payment_debug.json"), JSON.stringify(debugData, null, 2));
        return res.status(400).json({ error: "amount and userId are required." });
      }
      let baseDomain = "";
      if (req.headers.origin) {
        baseDomain = req.headers.origin;
      } else if (req.headers.referer) {
        try {
          const refUrl = new URL(req.headers.referer);
          baseDomain = `${refUrl.protocol}//${refUrl.host}`;
        } catch (e) {
          const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
          const host = req.headers["x-forwarded-host"] || req.headers.host;
          baseDomain = `${protocol}://${host}`;
        }
      } else {
        const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
        const host = req.headers["x-forwarded-host"] || req.headers.host;
        baseDomain = `${protocol}://${host}`;
      }
      let cus_name = "BNB Customer";
      let cus_phone = phone || "";
      let cus_email = "customer@bnbbusiness.com";
      if (db) {
        try {
          const userDocRef = (0, import_firestore.doc)(db, "users", userId);
          const userDoc = await (0, import_firestore.getDoc)(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            cus_name = userData.name || userData.userName || cus_name;
            cus_phone = userData.phone || userData.userPhone || cus_phone || "";
            cus_email = userData.email || cus_email;
            debugData.user_profile_data = {
              fetched_name: userData.name || userData.userName || null,
              fetched_phone: userData.phone || userData.userPhone || null,
              fetched_email: userData.email || null
            };
          } else {
            debugData.user_profile_data = { error: "User document not found in firestore" };
          }
        } catch (dbErr) {
          console.error("Error fetching user details for NagorikPay payment initialization:", dbErr);
          debugData.user_profile_data = { error: dbErr.message || "Firestore getDoc exception" };
        }
      } else {
        debugData.user_profile_data = { error: "Firestore db object is not defined on server" };
      }
      if (!cus_phone) {
        cus_phone = "01800000000";
      }
      const payload = {
        amount: parseFloat(amount),
        cus_name,
        cus_phone,
        cus_email,
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
        "Content-Type": "application/json",
        "api_key": "vk5JYpiHRbSG7QYfMDeOdMQddh2L54jmhtAGki1dFea9yrmVjD"
      };
      console.log("Initiating NagorikPay payment creation with payload:", JSON.stringify(payload));
      const response = await fetch("https://secure-pay.nagorikpay.com/api/payment/create", {
        method: "POST",
        headers: debugData.outgoing_headers,
        body: JSON.stringify(payload)
      });
      debugData.nagorikpay_response_status = response.status;
      let responseData;
      const responseText = await response.text();
      try {
        responseData = JSON.parse(responseText);
        debugData.nagorikpay_response_body = responseData;
      } catch (jsonErr) {
        responseData = { text: responseText };
        debugData.nagorikpay_response_body = responseText;
      }
      console.log("NagorikPay create payment response:", JSON.stringify(responseData));
      import_fs.default.writeFileSync(import_path.default.join(process.cwd(), "payment_debug.json"), JSON.stringify(debugData, null, 2));
      if (responseData && (responseData.status === true || responseData.status === "true" || responseData.status === "success" || responseData.status === 1 || responseData.status === "1" || responseData.payment_url)) {
        const paymentUrl = responseData.payment_url || responseData.redirect_url || responseData.url || responseData.checkout_url;
        if (paymentUrl) {
          return res.json({ success: true, payment_url: paymentUrl });
        }
      }
      return res.status(400).json({
        success: false,
        error: responseData?.message || responseData?.error || "Failed to create payment on NagorikPay",
        debug: debugData
      });
    } catch (error) {
      console.error("Error in /api/payment/create:", error);
      debugData.error = error.message || error.toString();
      import_fs.default.writeFileSync(import_path.default.join(process.cwd(), "payment_debug.json"), JSON.stringify(debugData, null, 2));
      return res.status(500).json({ error: error.message || "Server error initiating payment", debug: debugData });
    }
  });
  app.all("/api/payment/nagorikpay-callback", async (req, res) => {
    try {
      const transaction_id = req.query.transaction_id || req.body.transaction_id || req.query.invoice_id || req.body.invoice_id;
      if (!transaction_id) {
        console.error("No transaction_id provided in callback");
        return res.redirect("/?payment_status=failed&error=missing_transaction_id");
      }
      const verifyResponse = await fetch("https://secure-pay.nagorikpay.com/api/payment/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": "vk5JYpiHRbSG7QYfMDeOdMQddh2L54jmhtAGki1dFea9yrmVjD",
          "API-KEY": "vk5JYpiHRbSG7QYfMDeOdMQddh2L54jmhtAGki1dFea9yrmVjD"
        },
        body: JSON.stringify({ transaction_id })
      });
      const verifyData = await verifyResponse.json();
      console.log("NagorikPay callback verification API response:", JSON.stringify(verifyData));
      const statusUpper = String(verifyData?.status || "").toUpperCase();
      const isVerified = verifyData?.status === true || verifyData?.status === "true" || statusUpper === "TRUE" || statusUpper === "SUCCESS" || statusUpper === "APPROVED";
      if (!isVerified) {
        console.error("NagorikPay transaction verification failed:", verifyData);
        return res.redirect(`/?payment_status=failed&error=verification_failed`);
      }
      let verifiedUserId = verifyData?.metadata?.userId || verifyData?.meta_data?.userId || verifyData?.userId || verifyData?.user_id || verifyData?.cus_id || req.query.userId || req.body.userId;
      let verifiedAmount = verifyData?.metadata?.amount || verifyData?.meta_data?.amount || verifyData?.amount || verifyData?.payment_amount || verifyData?.total_amount || req.query.amount || req.body.amount;
      if (!verifiedUserId || !verifiedAmount) {
        console.error("CRITICAL: verifyData missing userId or amount!", verifyData);
        return res.redirect(`/?payment_status=failed&error=missing_verification_metadata`);
      }
      try {
        const txResult = await processVerifiedPayment(db, transaction_id, verifiedUserId, verifiedAmount, verifyData);
        if (txResult.alreadyProcessed) {
          console.log(`Transaction ${transaction_id} already processed via callback. Idempotency protected.`);
        } else {
          console.log(`Callback successfully credited user ${verifiedUserId} with \u09F3${txResult.amount}. New Balance: \u09F3${txResult.newBalance}`);
        }
        return res.redirect(`/?payment_status=success&amount=${txResult.amount}`);
      } catch (err) {
        console.error("Error processing callback payment:", err.message);
        return res.redirect(`/?payment_status=failed&error=${encodeURIComponent(err.message || "processing_failed")}`);
      }
    } catch (error) {
      console.error("Error in /api/payment/nagorikpay-callback:", error);
      return res.redirect(`/?payment_status=failed&error=${encodeURIComponent(error.message || "callback_error")}`);
    }
  });
  app.all("/api/payment/nagorikpay-cancel", (req, res) => {
    console.log("NagorikPay payment cancelled by user:", req.query, "Body:", req.body);
    return res.redirect("/?payment_status=cancelled");
  });
  app.post("/api/payment/nagorikpay-webhook", async (req, res) => {
    console.log("NagorikPay payment webhook received:", req.body);
    try {
      const transaction_id = req.body.transaction_id || req.body.invoice_id || req.body.trx_id;
      if (!transaction_id) {
        return res.status(400).json({ error: "missing_transaction_id" });
      }
      const verifyResponse = await fetch("https://secure-pay.nagorikpay.com/api/payment/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": "vk5JYpiHRbSG7QYfMDeOdMQddh2L54jmhtAGki1dFea9yrmVjD",
          "API-KEY": "vk5JYpiHRbSG7QYfMDeOdMQddh2L54jmhtAGki1dFea9yrmVjD"
        },
        body: JSON.stringify({ transaction_id })
      });
      const verifyData = await verifyResponse.json();
      console.log("NagorikPay webhook verification API response:", JSON.stringify(verifyData));
      const statusUpper = String(verifyData?.status || "").toUpperCase();
      const isVerified = verifyData?.status === true || verifyData?.status === "true" || statusUpper === "TRUE" || statusUpper === "SUCCESS" || statusUpper === "APPROVED";
      if (!isVerified) {
        return res.status(400).json({ error: "verification_failed" });
      }
      let verifiedUserId = verifyData?.metadata?.userId || verifyData?.meta_data?.userId || verifyData?.userId || verifyData?.user_id || verifyData?.cus_id || req.query.userId || req.body.userId;
      let verifiedAmount = verifyData?.metadata?.amount || verifyData?.meta_data?.amount || verifyData?.amount || verifyData?.payment_amount || verifyData?.total_amount || req.query.amount || req.body.amount;
      if (!verifiedUserId || !verifiedAmount) {
        return res.status(400).json({ error: "missing_verification_metadata", verifyData });
      }
      const txResult = await processVerifiedPayment(db, transaction_id, verifiedUserId, verifiedAmount, verifyData);
      if (txResult.alreadyProcessed) {
        console.log(`Webhook ignored transaction ${transaction_id} as it was already processed.`);
      } else {
        console.log(`Webhook successfully credited user ${verifiedUserId} with \u09F3${txResult.amount}.`);
      }
      return res.status(200).json({ received: true, status: "processed", transaction_id });
    } catch (err) {
      console.error("Error processing webhook payment:", err);
      return res.status(500).json({ error: err.message });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
