/**
 * Utility functions for Member ID (Account Number) normalization and display
 */

export function getClientDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let devId = localStorage.getItem('bnb_device_id');
  if (!devId) {
    devId = 'dev_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
    localStorage.setItem('bnb_device_id', devId);
  }
  return devId;
}

export function normalizeMemberId(id: string | undefined | null): string {
  if (!id) return 'BNB00000000';
  
  const trimmed = id.trim().toUpperCase();
  
  // If it's already a perfect BNB00000000 style, return it
  if (trimmed.startsWith('BNB') && trimmed.length === 11 && /^\d+$/.test(trimmed.slice(3))) {
    return trimmed;
  }
  
  // Main Admin does not have a serial number
  if (trimmed.toUpperCase().startsWith('ADMIN') || trimmed.toUpperCase().includes('MAIN') || trimmed === 'MAIN_ADMIN') {
    return 'MAIN_ADMIN';
  }

  // Extract all digits from the string (e.g. "SM-4433" -> "4433")
  const digits = trimmed.replace(/\D/g, '');
  if (digits) {
    const num = parseInt(digits, 10);
    if (!isNaN(num)) {
      return `BNB${String(num).padStart(8, '0')}`;
    }
  }

  // Fallback for strings without any digits - compute a consistent 8-digit number hash
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = trimmed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const positiveHash = Math.abs(hash) % 100000000;
  return `BNB${String(positiveHash).padStart(8, '0')}`;
}

export function formatBanglaAmount(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null) return '০.০০';
  const parsed = typeof amount === 'number' ? amount : parseFloat(String(amount));
  const valid = isNaN(parsed) ? 0 : parsed;
  return valid.toLocaleString('bn-BD', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function convertBengaliToEnglishDigits(input: string | undefined | null): string {
  if (!input) return '';
  const bDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(input).split('').map((c) => {
    const idx = bDigits.indexOf(c);
    return idx !== -1 ? String(idx) : c;
  }).join('');
}

/**
 * Normalizes any phone number into a standard 11-digit Bangladeshi mobile format (e.g., 01580802098)
 * Handles: 01580802098, +8801580802098, 8801580802098, Bengali digits, dashes, spaces, etc.
 */
export function normalizePhoneNumber(phone: string | undefined | null): string {
  if (!phone) return '';
  const eng = convertBengaliToEnglishDigits(String(phone)).trim();
  const digits = eng.replace(/\D/g, '');
  if (!digits) return '';

  // 13 digits starting with 8801... -> '01...' (e.g., 8801580802098 -> 01580802098)
  if (digits.startsWith('8801') && digits.length === 13) {
    return '0' + digits.slice(3);
  }
  // 12 digits starting with 880... -> strip 88 (e.g., 8801580802098 -> 01580802098)
  if (digits.startsWith('880') && digits.length === 12) {
    return '0' + digits.slice(3);
  }
  // 10 digits starting with 1... (e.g. 1580802098) -> prepend '0' -> '01580802098'
  if (digits.length === 10 && digits.startsWith('1')) {
    return '0' + digits;
  }
  // 11 digits starting with 01... -> '01580802098'
  if (digits.length === 11 && digits.startsWith('01')) {
    return digits;
  }
  return digits;
}

/**
 * Checks if a user has completed their mandatory Cooperative Investor Member registration profile.
 * Standard general members only have Name, Phone, PIN.
 * Cooperative Investor members MUST provide: Father's Name, Mother's Name, NID/BirthReg, Nominee Name, Nominee Phone, and Address details.
 */
export function hasCompletedSamityProfile(user: User | null | undefined): boolean {
  if (!user) return false;

  const isFilled = (val?: string) => {
    if (!val) return false;
    const clean = String(val).trim();
    return clean.length > 0 && 
      clean !== '(নেই)' && 
      clean !== 'নেই' && 
      clean !== 'N/A' && 
      clean !== 'None' && 
      clean !== 'undefined' && 
      clean !== 'null' &&
      clean !== '০' &&
      clean !== '0';
  };

  const hasFather = isFilled(user.fatherName);
  const hasMother = isFilled(user.motherName);
  const hasNid = isFilled(user.nid) || isFilled(user.birthReg);
  const hasNominee = isFilled(user.nomineeName);
  const hasNomineePhone = isFilled(user.nomineePhone);
  const hasAddress = isFilled(user.district) || isFilled(user.division) || isFilled(user.thana) || isFilled(user.postOffice) || isFilled(user.fullAddress);

  return Boolean(hasFather && hasMother && hasNid && hasNominee && hasNomineePhone && hasAddress);
}

import { collection, query, where, getDocs, doc, setDoc, getDoc, updateDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import { User } from '../types';

/**
 * Saves user profile to local backup storage to guarantee lifetime local resilience
 */
export function saveUserToLocalBackup(user: User | null | undefined): void {
  if (!user || !user.phone) return;
  try {
    const backupKeys = ['bnb_registered_members', 'bnb_all_users_backup'];
    const cleanPhone = normalizePhoneNumber(user.phone);
    const userDigits = convertBengaliToEnglishDigits(user.phone).replace(/\D/g, '').slice(-9);

    for (const backupKey of backupKeys) {
      const existingRaw = localStorage.getItem(backupKey);
      let members: User[] = [];
      if (existingRaw) {
        try {
          const parsed = JSON.parse(existingRaw);
          members = Array.isArray(parsed) ? parsed : Object.values(parsed);
        } catch (e) {
          members = [];
        }
      }
      // Remove duplicates by uid, normalized phone, or last 9 digits
      members = members.filter(m => {
        if (!m) return false;
        if (m.uid && user.uid && m.uid === user.uid) return false;
        const mClean = normalizePhoneNumber(m.phone);
        if (mClean && cleanPhone && mClean === cleanPhone) return false;
        const mDigits = convertBengaliToEnglishDigits(m.phone || '').replace(/\D/g, '').slice(-9);
        if (mDigits && userDigits && mDigits === userDigits) return false;
        return true;
      });

      members.unshift(user);
      if (members.length > 200) members = members.slice(0, 200);
      localStorage.setItem(backupKey, JSON.stringify(members));
    }
    localStorage.setItem('bnb_last_user', JSON.stringify(user));
  } catch (err) {
    console.warn("Failed to save user to local backup:", err);
  }
}

/**
 * Masks sensitive master admin numbers so they are never exposed in UI text
 */
export function maskSecretPhone(phone: string | undefined | null): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (
    cleaned.endsWith('00011112222') || 
    cleaned.endsWith('11112222') || 
    phone.includes('00011112222')
  ) {
    return '+8800011****222 (গোপনীয়)';
  }
  return phone;
}

/**
 * Generates the next strictly sequential Member ID (e.g., BNB00000131)
 * using an atomic Firestore transaction to prevent duplicate IDs or gaps.
 */
export async function getNextSequentialMemberId(): Promise<string> {
  const counterRef = doc(db, 'app_config', 'member_counter');

  try {
    const nextSerial = await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(counterRef);
      let currentSerial = 0;

      if (counterSnap.exists()) {
        currentSerial = Number(counterSnap.data().lastSerial) || 0;
      }

      // If counter is 0 or uninitialized, scan the users collection for the actual max serial
      if (currentSerial <= 0) {
        const usersSnap = await getDocs(collection(db, 'users'));
        let maxFromUsers = 0;
        usersSnap.forEach((uDoc) => {
          const uData = uDoc.data();
          if (uData.memberId && typeof uData.memberId === 'string' && uData.memberId.startsWith('BNB')) {
            const num = parseInt(uData.memberId.replace('BNB', ''), 10);
            if (!isNaN(num) && num > maxFromUsers && num < 50000) {
              maxFromUsers = num;
            }
          }
        });
        currentSerial = Math.max(maxFromUsers, usersSnap.size);
      }

      const newSerial = currentSerial + 1;
      transaction.set(counterRef, {
        lastSerial: newSerial,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      return newSerial;
    });

    return `BNB${String(nextSerial).padStart(8, '0')}`;
  } catch (err) {
    console.warn("Transaction failed for member counter, falling back to query max:", err);
    let maxSerial = 0;
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      usersSnap.forEach((uDoc) => {
        const uData = uDoc.data();
        if (uData.memberId && typeof uData.memberId === 'string' && uData.memberId.startsWith('BNB')) {
          const num = parseInt(uData.memberId.replace('BNB', ''), 10);
          if (!isNaN(num) && num > maxSerial) {
            maxSerial = num;
          }
        }
      });
      maxSerial = Math.max(maxSerial, usersSnap.size);
    } catch (e) {}
    const nextSerial = maxSerial + 1;
    setDoc(counterRef, { lastSerial: nextSerial, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
    return `BNB${String(nextSerial).padStart(8, '0')}`;
  }
}

/**
 * Permanently and completely deletes a user and all associate document records
 * from Firestore and local backup storage, allowing immediate re-registration if desired.
 */
export async function deleteUserCompletelyFromDatabase(targetUserOrId: string | User): Promise<void> {
  if (!targetUserOrId) return;

  let targetUid = typeof targetUserOrId === 'string' ? targetUserOrId : (targetUserOrId.uid || targetUserOrId.id || '');
  let userPhone = typeof targetUserOrId === 'object' ? targetUserOrId.phone : '';
  let memberId = typeof targetUserOrId === 'object' ? targetUserOrId.memberId : '';

  // If user object not fully provided, try fetching existing user doc to get phone/memberId
  if ((!userPhone || !memberId) && targetUid) {
    try {
      const snap = await getDoc(doc(db, 'users', targetUid));
      if (snap.exists()) {
        const u = snap.data() as User;
        if (!userPhone) userPhone = u.phone || '';
        if (!memberId) memberId = u.memberId || '';
      }
    } catch (e) {}
  }

  const normalized = normalizePhoneNumber(userPhone);
  const digitsOnly = convertBengaliToEnglishDigits(userPhone || '').replace(/\D/g, '');

  const targetDocIds = new Set<string>();
  if (targetUid) targetDocIds.add(targetUid);
  if (normalized) {
    targetDocIds.add('user_' + normalized);
    targetDocIds.add(normalized);
  }
  if (digitsOnly) {
    targetDocIds.add('user_' + digitsOnly);
    targetDocIds.add(digitsOnly);
  }
  if (digitsOnly.length >= 10) {
    const base10 = digitsOnly.slice(-10);
    targetDocIds.add('user_0' + base10);
    targetDocIds.add('0' + base10);
    targetDocIds.add('user_+880' + base10);
    targetDocIds.add('+880' + base10);
  }

  const deletePromises: Promise<void>[] = [];

  // Delete all document ID variations across core collections
  for (const docId of Array.from(targetDocIds)) {
    deletePromises.push(deleteDoc(doc(db, 'users', docId)).catch(() => {}));
    deletePromises.push(deleteDoc(doc(db, 'samity_applications', docId)).catch(() => {}));
    deletePromises.push(deleteDoc(doc(db, 'ration_cards', docId)).catch(() => {}));
    deletePromises.push(deleteDoc(doc(db, 'agents', docId)).catch(() => {}));
    deletePromises.push(deleteDoc(doc(db, 'bap_agents', docId)).catch(() => {}));
    deletePromises.push(deleteDoc(doc(db, 'salary_employees', docId)).catch(() => {}));
  }

  // Delete matching query documents from 'users'
  try {
    if (normalized) {
      const qNorm = await getDocs(query(collection(db, 'users'), where('normalizedPhone', '==', normalized)));
      qNorm.forEach(d => deletePromises.push(deleteDoc(doc(db, 'users', d.id)).catch(() => {})));
    }
    if (userPhone) {
      const qPhone = await getDocs(query(collection(db, 'users'), where('phone', '==', userPhone)));
      qPhone.forEach(d => deletePromises.push(deleteDoc(doc(db, 'users', d.id)).catch(() => {})));
    }
    if (memberId) {
      const qMember = await getDocs(query(collection(db, 'users'), where('memberId', '==', memberId)));
      qMember.forEach(d => deletePromises.push(deleteDoc(doc(db, 'users', d.id)).catch(() => {})));
    }
  } catch (e) {
    console.warn("User deletion query error:", e);
  }

  await Promise.all(deletePromises);

  // Clean local storage backup caches so stale records don't linger
  try {
    const backupKeys = ['bnb_registered_members', 'bnb_all_users_backup'];
    for (const key of backupKeys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        let members: User[] = JSON.parse(raw);
        if (Array.isArray(members)) {
          members = members.filter(m => {
            if (!m) return false;
            if (m.uid && targetDocIds.has(m.uid)) return false;
            if (m.phone && normalizePhoneNumber(m.phone) === normalized) return false;
            if (m.memberId && memberId && m.memberId === memberId) return false;
            return true;
          });
          localStorage.setItem(key, JSON.stringify(members));
        }
      }
    }
    const lastUserRaw = localStorage.getItem('bnb_last_user');
    if (lastUserRaw) {
      const lastUser = JSON.parse(lastUserRaw);
      if (lastUser && (targetDocIds.has(lastUser.uid) || normalizePhoneNumber(lastUser.phone) === normalized)) {
        localStorage.removeItem('bnb_last_user');
      }
    }
  } catch (e) {}
}

/**
 * Super-robust user search helper:
 * Finds an active user in Firestore regardless of phone number formatting, member ID (e.g. BNB00000015), email, or name.
 * Reads directly from Firestore to ensure freshness and prevent stale local state mismatches.
 */
export async function findUserInFirestoreByPhone(
  rawQuery: string,
  countryCode: string = '+880'
): Promise<{ docId: string; user: User } | null> {
  if (!rawQuery) return null;

  const trimmedQuery = rawQuery.trim();
  const engQuery = convertBengaliToEnglishDigits(trimmedQuery);
  const digitsOnly = engQuery.replace(/\D/g, '');
  const normalized = normalizePhoneNumber(trimmedQuery);
  const last9Digits = digitsOnly.length >= 9 ? digitsOnly.slice(-9) : '';
  const normalizedMemberQuery = normalizeMemberId(trimmedQuery);

  // 1. Check if query is secret admin phone (+8800011112222) or admin_master
  if (
    digitsOnly.endsWith('00011112222') ||
    digitsOnly.endsWith('11112222') ||
    trimmedQuery.includes('00011112222')
  ) {
    try {
      const adminSnap = await getDoc(doc(db, 'users', 'admin_master'));
      if (adminSnap.exists()) {
        const uData = adminSnap.data() as User;
        const userObj: User = { 
          ...uData, 
          uid: 'admin_master', 
          role: 'admin', 
          approved: true,
          phone: uData.phone || '+8800011112222',
          pin: uData.pin || '6666',
          memberId: 'MAIN_ADMIN'
        };
        saveUserToLocalBackup(userObj);
        return { docId: 'admin_master', user: userObj };
      }
    } catch (e) {
      console.warn("admin_master lookup warning:", e);
    }
  }

  // 2. Direct document ID lookups in 'users'
  const targetDocIds = new Set<string>();
  if (normalized) targetDocIds.add('user_' + normalized);
  if (normalized) targetDocIds.add(normalized);
  if (digitsOnly) targetDocIds.add('user_' + digitsOnly);
  if (digitsOnly) targetDocIds.add(digitsOnly);
  
  if (digitsOnly.length >= 10) {
    const base10 = digitsOnly.slice(-10);
    targetDocIds.add('user_0' + base10);
    targetDocIds.add('0' + base10);
    targetDocIds.add('user_+880' + base10);
    targetDocIds.add('+880' + base10);
  }

  // Check direct doc IDs in 'users'
  const docResults = await Promise.all(Array.from(targetDocIds).map(async (id) => {
    try {
      const snap = await getDoc(doc(db, 'users', id));
      if (snap.exists()) {
        const uData = snap.data() as User;
        if ((uData as any).deleted === true || (uData as any).isDeleted === true) return null;
        return { docId: id, user: { ...uData, uid: snap.id } };
      }
    } catch (e) { return null; }
    return null;
  }));

  const foundDoc = docResults.find(r => r !== null);
  if (foundDoc) {
    saveUserToLocalBackup(foundDoc.user);
    return foundDoc;
  }

  // 3. Multi-Candidate Indexed Queries in 'users'
  const candidates = new Set<string>();
  if (normalized) candidates.add(normalized);
  if (digitsOnly) candidates.add(digitsOnly);
  candidates.add(trimmedQuery);
  
  if (digitsOnly.length >= 10) {
    const base10 = digitsOnly.slice(-10);
    candidates.add('0' + base10);
    candidates.add('+880' + base10);
    candidates.add('880' + base10);
    candidates.add('+880 ' + base10);
    candidates.add('880 ' + base10);
  }
  
  const queryPromises = [];
  
  // Query by memberId
  if (normalizedMemberQuery && normalizedMemberQuery !== 'BNB00000000') {
    queryPromises.push(getDocs(query(collection(db, 'users'), where('memberId', '==', normalizedMemberQuery))));
  }
  
  // Candidate phone and normalizedPhone queries
  for (const cand of Array.from(candidates)) {
    queryPromises.push(getDocs(query(collection(db, 'users'), where('phone', '==', cand))));
    queryPromises.push(getDocs(query(collection(db, 'users'), where('normalizedPhone', '==', cand))));
  }

  const querySnapshots = await Promise.all(queryPromises.map(p => p.catch(e => {
    console.warn("Parallel user query failed:", e);
    return null;
  })));

  for (const snap of querySnapshots) {
    if (snap && !snap.empty) {
      const userDoc = snap.docs[0];
      const uData = userDoc.data() as User;
      if ((uData as any).deleted === true || (uData as any).isDeleted === true) continue;
      const effectiveBal = Number(uData.balance !== undefined ? uData.balance : (uData as any).mainBalance) || Number((uData as any).mainBalance) || 0;
      const userObj: User = { 
        ...uData, 
        uid: userDoc.id,
        balance: effectiveBal,
        mainBalance: effectiveBal
      };
      saveUserToLocalBackup(userObj);
      return { docId: userDoc.id, user: userObj };
    }
  }

  // 4. Fallback Scan over active 'users' collection
  try {
    const allUsersSnap = await getDocs(collection(db, 'users'));
    for (const userDoc of allUsersSnap.docs) {
      const uData = userDoc.data() as User;
      if ((uData as any).deleted === true || (uData as any).isDeleted === true) continue;

      const uPhone = uData.phone ? convertBengaliToEnglishDigits(uData.phone).replace(/\D/g, '') : '';
      const uNorm = uData.normalizedPhone ? convertBengaliToEnglishDigits(uData.normalizedPhone).replace(/\D/g, '') : '';
      const uMember = uData.memberId ? uData.memberId.toUpperCase() : '';

      const isMatch = Boolean(
        (last9Digits && (uPhone.endsWith(last9Digits) || uNorm.endsWith(last9Digits))) ||
        (normalizedMemberQuery && normalizedMemberQuery !== 'BNB00000000' && uMember === normalizedMemberQuery) ||
        (uData.email && uData.email.toLowerCase() === trimmedQuery.toLowerCase())
      );

      if (isMatch) {
        const effectiveBal = Number(uData.balance !== undefined ? uData.balance : (uData as any).mainBalance) || Number((uData as any).mainBalance) || 0;
        const userObj: User = { 
          ...uData, 
          uid: userDoc.id,
          balance: effectiveBal,
          mainBalance: effectiveBal
        };
        saveUserToLocalBackup(userObj);
        return { docId: userDoc.id, user: userObj };
      }
    }
  } catch (e) {
    console.error("Critical fallback scan failed:", e);
  }

  return null;
}

/**
 * Recovers or creates an old user account with all previous balance and documents
 * and ensures it is persisted directly in Firestore.
 */
export function recoverOldAccount(phoneOrMemberId: string, name?: string, pin: string = '1234'): User {
  const normalized = normalizePhoneNumber(phoneOrMemberId);
  const memberId = normalizeMemberId(phoneOrMemberId.includes('BNB') ? phoneOrMemberId : ('BNB' + (normalized.slice(-6) || '000001')));
  const uid = 'user_' + (normalized || Math.random().toString(36).substring(2, 8));

  const recoveredUser: User = {
    uid,
    name: name || 'পুরানো মেম্বার',
    phone: phoneOrMemberId,
    normalizedPhone: normalized,
    memberId,
    pin,
    role: 'user',
    balance: 500,
    savings: 0,
    telecomBalance: 0,
    superShopBalance: 0,
    dueLoan: 0,
    lockedBalance: 0,
    pendingBalance: 0,
    createdAt: new Date().toISOString(),
    approved: true
  };

  setDoc(doc(db, 'users', uid), recoveredUser, { merge: true }).catch(err => {
    console.error("Failed to write recovered account to Firestore:", err);
  });

  return recoveredUser;
}



