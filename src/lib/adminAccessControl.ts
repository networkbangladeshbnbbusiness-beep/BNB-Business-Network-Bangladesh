import {
  collection,
  doc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { AdminSessionRecord, User } from '../types';

const ADMIN_SESSION_STORAGE_KEY = 'bnb_admin_session_id';

export function isSuperAdminUser(u?: User | null): boolean {
  if (!u) return false;
  if (u.isAdminBanned === true) return false;
  const cleanPhone = (u.phone || '').replace(/\D/g, '');
  const email = (u.email || '').trim().toLowerCase();
  return (
    u.uid === 'admin_master' ||
    (u.role as string) === 'super_admin' ||
    cleanPhone.endsWith('01111222233') ||
    cleanPhone.endsWith('1111222233') ||
    u.phone === '+8801111222233' ||
    email === 'networkbangladeshbnbbusiness@gmail.com' ||
    email === 'networkbangladeshambbusiness@gmail.com'
  );
}

export function isAdminAccountRole(u?: User | null): boolean {
  if (!u) return false;
  const role = (u.role as string) || '';
  return (
    role === 'admin' ||
    role === 'sub_admin' ||
    role === 'super_admin' ||
    u.uid === 'admin_master' ||
    isSuperAdminUser(u)
  );
}

export function getOrCreateAdminSessionId(): string {
  if (typeof window === 'undefined') {
    return `adm_${Date.now()}`;
  }
  try {
    const existing = sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (existing && existing.length > 6) return existing;
    const generated = `adm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, generated);
    return generated;
  } catch {
    return `adm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

import { isAdminBuildVariant } from './adminRoute';
import { Capacitor } from '@capacitor/core';

export function getAdminDeviceSummary(): { deviceInfo: string; platform: string } {
  if (typeof navigator === 'undefined') {
    return { deviceInfo: 'Unknown Device', platform: 'Web' };
  }
  try {
    if (Capacitor.isNativePlatform() || isAdminBuildVariant()) {
      const plat = Capacitor.getPlatform();
      if (plat === 'android' || /Android/i.test(navigator.userAgent || '')) {
        return {
          deviceInfo: 'Android Admin APK • BNB App',
          platform: 'Android APK'
        };
      }
      return {
        deviceInfo: 'BNB Admin Mobile App',
        platform: 'Mobile App'
      };
    }
  } catch {}

  const ua = navigator.userAgent || '';
  let browser = 'Browser';
  if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/Chrome/i.test(ua)) browser = 'Chrome';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Safari/i.test(ua)) browser = 'Safari';

  let os = 'Desktop';
  if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return {
    deviceInfo: `${os} • ${browser}`,
    platform: os
  };
}

export function isSessionCurrentlyOnline(session?: Partial<AdminSessionRecord> | null): boolean {
  if (!session || session.status !== 'online') return false;
  const refTime = session.lastHeartbeatAt || session.loginAt;
  if (!refTime) return false;
  const ts = new Date(refTime).getTime();
  if (isNaN(ts)) return false;
  return Date.now() - ts < 4 * 60 * 1000;
}

export function isUserAdminCurrentlyOnline(u?: User | null, sessions: AdminSessionRecord[] = []): boolean {
  if (!u || u.isAdminBanned) return false;
  const hasLiveSession = sessions.some((s) => s.uid === u.uid && isSessionCurrentlyOnline(s));
  if (hasLiveSession) return true;
  if (!u.isAdminOnline || !u.lastAdminHeartbeatAt) return false;
  const ts = new Date(u.lastAdminHeartbeatAt).getTime();
  return !isNaN(ts) && Date.now() - ts < 4 * 60 * 1000;
}

const ADMIN_API_TOKEN_KEY = 'bnb_admin_api_token';

export function getStoredAdminToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    return sessionStorage.getItem(ADMIN_API_TOKEN_KEY) || localStorage.getItem(ADMIN_API_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function clearStoredAdminToken(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(ADMIN_API_TOKEN_KEY);
    localStorage.removeItem(ADMIN_API_TOKEN_KEY);
  } catch {}
}

export function getAdminAuthHeaders(): Record<string, string> {
  const token = getStoredAdminToken();
  return token ? { Authorization: `Bearer ${token}`, 'x-admin-token': token } : {};
}

export async function registerServerAdminSession(
  adminUser: User,
  pin: string,
  firebaseAuthUid?: string | null
): Promise<{ success: boolean; adminToken?: string; error?: string }> {
  if (!isAdminBuildVariant()) {
    return { success: false, error: 'user_variant_blocked' };
  }
  try {
    const { apiUrl } = await import('../config/api');
    const resp = await fetch(apiUrl('/api/admin/auth/session'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: adminUser.uid,
        phone: adminUser.phone || '',
        email: adminUser.email || '',
        pin,
        firebaseAuthUid: firebaseAuthUid || ''
      })
    });
    const data = await resp.json().catch(() => null);
    if (resp.ok && data?.success && data?.adminToken) {
      try {
        sessionStorage.setItem(ADMIN_API_TOKEN_KEY, data.adminToken);
        localStorage.setItem(ADMIN_API_TOKEN_KEY, data.adminToken);
      } catch {}
      return { success: true, adminToken: data.adminToken };
    }
    return { success: false, error: data?.error || 'session_registration_failed' };
  } catch (e: any) {
    return { success: false, error: e?.message || 'network_error' };
  }
}

export async function revokeServerAdminSession(firebaseAuthUid?: string | null): Promise<void> {
  const token = getStoredAdminToken();
  clearStoredAdminToken();
  if (!token && !firebaseAuthUid) return;
  try {
    const { apiUrl } = await import('../config/api');
    await fetch(apiUrl('/api/admin/auth/logout'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}`, 'x-admin-token': token } : {})
      },
      body: JSON.stringify({ firebaseAuthUid: firebaseAuthUid || '' })
    });
  } catch {}
}

export async function recordAdminLoginSession(adminUser: User): Promise<string> {
  const sessionId = getOrCreateAdminSessionId();
  if (!isAdminBuildVariant() || !adminUser?.uid || adminUser.isAdminBanned) return sessionId;

  const nowIso = new Date().toISOString();
  const { deviceInfo, platform } = getAdminDeviceSummary();
  const resolvedRole = isSuperAdminUser(adminUser)
    ? 'super_admin'
    : (adminUser.role as string) === 'sub_admin'
      ? 'sub_admin'
      : 'admin';

  try {
    await setDoc(
      doc(db, 'admin_sessions', sessionId),
      {
        sessionId,
        uid: adminUser.uid,
        name: adminUser.name || 'Admin',
        phone: adminUser.phone || '',
        memberId: adminUser.memberId || 'MAIN_ADMIN',
        role: resolvedRole,
        status: 'online',
        deviceInfo,
        platform,
        loginAt: nowIso,
        lastHeartbeatAt: nowIso,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('Could not write admin_sessions record:', e);
  }

  try {
    await updateDoc(doc(db, 'users', adminUser.uid), {
      isAdminOnline: true,
      lastAdminLoginAt: nowIso,
      lastAdminHeartbeatAt: nowIso,
      lastAdminSessionId: sessionId,
      adminLoginCount: increment(1)
    });
  } catch (e) {
    if (adminUser.uid === 'admin_master') {
      try {
        await setDoc(
          doc(db, 'users', 'admin_master'),
          {
            uid: 'admin_master',
            name: adminUser.name || 'Bangladesh BNB Administrator',
            phone: adminUser.phone || '+8801111222233',
            memberId: adminUser.memberId || 'BNB00000000',
            role: 'admin',
            isAdminOnline: true,
            lastAdminLoginAt: nowIso,
            lastAdminHeartbeatAt: nowIso,
            lastAdminSessionId: sessionId,
            adminLoginCount: 1
          },
          { merge: true }
        );
      } catch {}
    }
  }

  return sessionId;
}

export async function heartbeatAdminSession(adminUser: User): Promise<void> {
  if (!adminUser?.uid || adminUser.isAdminBanned) return;
  const sessionId = getOrCreateAdminSessionId();
  const nowIso = new Date().toISOString();
  const { deviceInfo, platform } = getAdminDeviceSummary();
  const resolvedRole = isSuperAdminUser(adminUser)
    ? 'super_admin'
    : (adminUser.role as string) === 'sub_admin'
      ? 'sub_admin'
      : 'admin';

  try {
    await setDoc(
      doc(db, 'admin_sessions', sessionId),
      {
        sessionId,
        uid: adminUser.uid,
        name: adminUser.name || 'Admin',
        phone: adminUser.phone || '',
        memberId: adminUser.memberId || 'MAIN_ADMIN',
        role: resolvedRole,
        status: 'online',
        deviceInfo,
        platform,
        lastHeartbeatAt: nowIso,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch {}

  try {
    await updateDoc(doc(db, 'users', adminUser.uid), {
      isAdminOnline: true,
      lastAdminHeartbeatAt: nowIso,
      lastAdminSessionId: sessionId
    });
  } catch {}
}

export async function markAdminSessionOffline(adminUser?: User | null): Promise<void> {
  const sessionId = typeof window !== 'undefined' ? sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY) : null;
  const nowIso = new Date().toISOString();
  if (sessionId) {
    try {
      await updateDoc(doc(db, 'admin_sessions', sessionId), {
        status: 'offline',
        loggedOutAt: nowIso,
        lastHeartbeatAt: nowIso
      });
    } catch {}
    try {
      sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    } catch {}
  }
  if (adminUser?.uid) {
    try {
      await updateDoc(doc(db, 'users', adminUser.uid), {
        isAdminOnline: false,
        lastAdminHeartbeatAt: nowIso
      });
    } catch {}
  }
}

export async function kickAdminSession(sessionId: string, targetUid: string, superAdmin: User): Promise<void> {
  const nowIso = new Date().toISOString();
  try {
    await updateDoc(doc(db, 'admin_sessions', sessionId), {
      status: 'kicked',
      kickedAt: nowIso,
      kickedBy: superAdmin?.name || 'Super Admin'
    });
  } catch {}

  if (targetUid) {
    try {
      await updateDoc(doc(db, 'users', targetUid), {
        isAdminOnline: false,
        forceAdminLogoutAt: nowIso
      });
    } catch {}
  }
}

export async function banAdminAccount(targetUser: User, superAdmin: User, reason?: string): Promise<void> {
  if (!targetUser?.uid || isSuperAdminUser(targetUser)) {
    throw new Error('সুপার এডমিন অ্যাকাউন্ট ব্যান করা সম্ভব নয়।');
  }
  const nowIso = new Date().toISOString();
  const cleanReason = (reason || '').trim() || 'সুপার এডমিন কর্তৃক স্থায়ীভাবে এডমিন প্যানেল অ্যাক্সেস ব্যান করা হয়েছে';

  await updateDoc(doc(db, 'users', targetUser.uid), {
    isAdminBanned: true,
    adminBannedAt: nowIso,
    adminBannedBy: superAdmin?.name || 'Super Admin',
    adminBanReason: cleanReason,
    previousAdminRole: targetUser.role || 'sub_admin',
    role: 'user',
    subAdminPermissions: [],
    isAdminOnline: false,
    forceAdminLogoutAt: nowIso
  });

  try {
    const sessSnap = await getDocs(
      query(collection(db, 'admin_sessions'), where('uid', '==', targetUser.uid))
    );
    if (!sessSnap.empty) {
      const batch = writeBatch(db);
      sessSnap.forEach((d) => {
        batch.update(doc(db, 'admin_sessions', d.id), {
          status: 'banned_kicked',
          kickedAt: nowIso,
          kickedBy: superAdmin?.name || 'Super Admin'
        });
      });
      await batch.commit();
    }
  } catch (e) {
    console.warn('Could not close all banned admin sessions:', e);
  }
}

export async function unbanAdminAccount(
  targetUser: User,
  restoreRole: 'admin' | 'sub_admin' = 'sub_admin'
): Promise<void> {
  if (!targetUser?.uid) return;
  await updateDoc(doc(db, 'users', targetUser.uid), {
    isAdminBanned: false,
    adminBannedAt: '',
    adminBannedBy: '',
    adminBanReason: '',
    role: restoreRole
  });
}
