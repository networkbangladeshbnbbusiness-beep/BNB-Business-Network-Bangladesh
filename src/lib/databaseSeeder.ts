import { db } from './firebase';
import { doc, getDoc, setDoc, getDocs, collection, deleteDoc } from 'firebase/firestore';
import { User } from '../types';
import { normalizePhoneNumber } from './memberUtils';

export async function restoreAndSeedDatabase() {
  try {
    console.log("[DatabaseSeeder] Checking and restoring previous database records...");

    // 1. Ensure primary admin_master exists and clean up old duplicate admin_user_01
    try {
      // Remove old duplicate admin_user_01 if it exists
      const oldAdminRef = doc(db, 'users', 'admin_user_01');
      const oldSnap = await getDoc(oldAdminRef);
      if (oldSnap.exists()) {
        await deleteDoc(oldAdminRef);
      }
    } catch (e) {}

    const defaultAdmin: User = {
      uid: 'admin_master',
      name: 'Bangladesh BNB Administrator',
      phone: '+8800011112222',
      normalizedPhone: '+8800011112222',
      memberId: 'MAIN_ADMIN',
      pin: '6666',
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
    };

    try {
      const userRef = doc(db, 'users', 'admin_master');
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, defaultAdmin);
      } else {
        const snapData = snap.data();
        if (snapData?.phone !== '+8800011112222' || snapData?.pin !== '6666' || snapData?.memberId !== 'MAIN_ADMIN' || snapData?.role !== 'admin') {
          await setDoc(userRef, {
            phone: '+8800011112222',
            normalizedPhone: '+8800011112222',
            pin: '6666',
            memberId: 'MAIN_ADMIN',
            role: 'admin',
            approved: true
          }, { merge: true });
        }
      }
    } catch (err) {
      // ignore write error
    }

    // 2. Sanitize existing user documents in Firestore: clean up "বেনামী সদস্য" or empty name/phone records, and prevent non-admin accounts from having admin name/role
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      for (const uDoc of usersSnap.docs) {
        if (uDoc.id === 'admin_master') continue;
        const uData = uDoc.data() as User;
        const uName = (uData.name || '').trim();
        const uPhone = (uData.phone || '').trim();
        const normP = normalizePhoneNumber(uPhone);

        const updatesToApply: Partial<User> = {};

        // Ensure non-admin users do not hold admin name, role, or MAIN_ADMIN memberId
        if (uDoc.id !== 'admin_master' && uPhone !== '+8800011112222') {
          if (uData.role === 'admin') {
            updatesToApply.role = 'user';
          }
          if (uData.memberId === 'MAIN_ADMIN') {
            updatesToApply.memberId = 'BNB00000001';
          }
          if (uName === 'BNB National Admin' || uName === 'Bangladesh BNB Administrator' || uPhone === '01618599077' && uName === 'BNB National Admin') {
            updatesToApply.name = 'সম্মানিত সদস্য';
          }
        }

        if (!uName || uName === 'বেনামী সদস্য' || uName === 'অজ্ঞাত মেম্বার') {
          if (!uPhone && !uData.memberId) {
            // Delete completely invalid phoneless/nameless document
            await deleteDoc(doc(db, 'users', uDoc.id));
            continue;
          } else {
            updatesToApply.name = 'সম্মানিত সদস্য';
          }
        }

        if (!uData.normalizedPhone && normP) {
          updatesToApply.normalizedPhone = normP;
        }

        if (Object.keys(updatesToApply).length > 0) {
          await setDoc(doc(db, 'users', uDoc.id), updatesToApply, { merge: true });
        }
      }

      // 2b. Deduplicate users by last 9 phone digits: merge balances into retained account (e.g. BNB00000014) before removing duplicate
      const phoneMap: Record<string, { id: string; memberId: string; createdAt: string; data: User }[]> = {};
      usersSnap.docs.forEach((uDoc) => {
        const uData = uDoc.data() as User;
        if ((uData as any).deleted || (uData as any).isDeleted) return;
        const uPhone = (uData.phone || '').replace(/\D/g, '');
        if (uPhone.length >= 9) {
          const last9 = uPhone.slice(-9);
          if (!phoneMap[last9]) phoneMap[last9] = [];
          phoneMap[last9].push({
            id: uDoc.id,
            memberId: uData.memberId || '',
            createdAt: uData.createdAt || '',
            data: uData
          });
        }
      });

      for (const [last9, list] of Object.entries(phoneMap)) {
        if (list.length > 1) {
          // Sort by member ID serial number ascending (keeps primary account BNB00000014)
          list.sort((a, b) => {
            const numA = parseInt(a.memberId.replace(/\D/g, ''), 10) || 9999999;
            const numB = parseInt(b.memberId.replace(/\D/g, ''), 10) || 9999999;
            return numA - numB;
          });

          const primaryDoc = list[0];
          let mergedBal = Number(primaryDoc.data.balance !== undefined ? primaryDoc.data.balance : primaryDoc.data.mainBalance) || Number(primaryDoc.data.mainBalance) || 0;
          let mergedSavings = Number(primaryDoc.data.savings) || 0;
          let mergedTelecom = Number(primaryDoc.data.telecomBalance) || 0;
          let mergedShop = Number(primaryDoc.data.superShopBalance) || 0;
          let needsPrimaryUpdate = false;

          for (let i = 1; i < list.length; i++) {
            const dup = list[i].data;
            const dupBal = Number(dup.balance !== undefined ? dup.balance : dup.mainBalance) || Number(dup.mainBalance) || 0;
            const dupSavings = Number(dup.savings) || 0;
            const dupTelecom = Number(dup.telecomBalance) || 0;
            const dupShop = Number(dup.superShopBalance) || 0;

            if (dupBal > 0 || dupSavings > 0 || dupTelecom > 0 || dupShop > 0) {
              mergedBal += dupBal;
              mergedSavings += dupSavings;
              mergedTelecom += dupTelecom;
              mergedShop += dupShop;
              needsPrimaryUpdate = true;
            }

            console.log(`[DatabaseSeeder] Safe merging balance (${dupBal} BDT) from duplicate user doc ${list[i].id} into primary ${primaryDoc.id}`);
            await deleteDoc(doc(db, 'users', list[i].id));
          }

          if (needsPrimaryUpdate) {
            await setDoc(doc(db, 'users', primaryDoc.id), {
              balance: mergedBal,
              mainBalance: mergedBal,
              savings: mergedSavings,
              telecomBalance: mergedTelecom,
              superShopBalance: mergedShop,
              updatedAt: new Date().toISOString()
            }, { merge: true });
          }
        }
      }
    } catch (cleanErr) {
      console.warn("[DatabaseSeeder] User sanitization warning:", cleanErr);
    }

    // 3. Ensure App Config settings are seeded
    const configRef = doc(db, 'system_settings', 'app_config');
    const configSnap = await getDoc(configRef);
    if (!configSnap.exists()) {
      await setDoc(configRef, {
        appName: 'Business Network Bangladesh (BNB)',
        appSubtitle: 'ন্যাশনাল কোঅপারেটিভ ও বিজনেস পোর্টাল',
        noticeText: 'BNB ম্যানেজমেন্ট কোম্পানি ইনভেস্টর সাধারণ ফান্ডে স্বাগতম! আপনার অ্যাকাউন্ট এবং ব্যালেন্স সম্পূর্ণ সুরক্ষিত রয়েছে।',
        helpline: '01618599077',
        bKashMerchant: '01618599077',
        nagadMerchant: '01618599077',
        rocketMerchant: '01618599077',
        bankAccountInfo: 'BNB Business Cooperative Ltd, A/C: 1150-201-998877, Islami Bank Bangladesh PLC',
        maintenanceMode: false,
        minDeposit: 100,
        minWithdraw: 500,
        profitRateYearly: 18.5
      });
    }

    // 4. Cache in localStorage for instant offline fallback
    localStorage.setItem('bnb_all_users_backup', JSON.stringify([defaultAdmin]));
    console.log("[DatabaseSeeder] Database successfully restored and synchronized.");
  } catch (e) {
    console.warn("[DatabaseSeeder] Warning during restore/seed:", e);
  }
}

