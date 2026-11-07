import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, updateDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import fs from 'fs';

const configPath = './firebase-applet-config.json';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const firebaseConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, config.firestoreDatabaseId || '(default)');

async function updateAdminPin() {
  console.log("Updating admin PIN to 0008 in Firestore...");

  // 1. Update admin_master document
  const adminRef = doc(db, 'users', 'admin_master');
  try {
    const adminSnap = await getDoc(adminRef);
    if (adminSnap.exists()) {
      await updateDoc(adminRef, {
        pin: '0008',
        appLockCode: '0008',
        walletPin: '0008',
        securityPin: '0008'
      });
      console.log("Updated users/admin_master pin to 0008");
    } else {
      await setDoc(adminRef, {
        uid: 'admin_master',
        name: 'Bangladesh BNB Administrator',
        phone: '+8801111222233',
        normalizedPhone: '+8801111222233',
        memberId: 'MAIN_ADMIN',
        pin: '0008',
        role: 'admin',
        balance: 0,
        savings: 0,
        telecomBalance: 0,
        superShopBalance: 0,
        dueLoan: 0,
        lockedBalance: 0,
        pendingBalance: 0,
        createdAt: new Date().toISOString(),
        approved: true,
        samityStatus: 'approved'
      });
      console.log("Created users/admin_master doc with pin 0008");
    }
  } catch (err) {
    console.error("Error updating admin_master doc:", err);
  }

  // 2. Query users with phone '+8801111222233'
  try {
    const q = query(collection(db, 'users'), where('phone', '==', '+8801111222233'));
    const qSnap = await getDocs(q);
    for (const d of qSnap.docs) {
      await updateDoc(d.ref, {
        pin: '0008',
        appLockCode: '0008',
        walletPin: '0008',
        securityPin: '0008'
      });
      console.log(`Updated user ${d.id} pin to 0008`);
    }
  } catch (err) {
    console.error("Error updating phone query users:", err);
  }

  // 3. Update app_config
  try {
    const configRef = doc(db, 'system_settings', 'app_config');
    await setDoc(configRef, {
      adminPin: '0008',
      masterPin: '0008'
    }, { merge: true });
    console.log("Updated system_settings/app_config pin to 0008");
  } catch (err) {
    console.error("Error updating app_config:", err);
  }

  console.log("Done updating PIN!");
  process.exit(0);
}

updateAdminPin();
