import { CapacitorHttp } from '@capacitor/core';
import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { apiUrl } from '../config/api';
import { convertBengaliToEnglishDigits } from './memberUtils';

export interface SendOtpOptions {
  email: string;
  otp: string;
  userName?: string;
  phone?: string;
  memberId?: string;
  userId?: string;
  reason?: 'login' | 'forgot_password' | 'verification';
}

export function buildOtpEmailHtml(otp: string, userName = 'সম্মানিত সদস্য', reason = 'login'): string {
  const reasonText = reason === 'forgot_password'
    ? 'আপনার পাসওয়ার্ড রিসেট করার জন্য'
    : 'আপনার অ্যাকাউন্টে লগইন করার জন্য';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>BNB Verification Code</title>
    </head>
    <body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; margin: 0 auto; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <tr>
          <td style="padding: 28px 24px; text-align: center; background-color: #064e3b;">
            <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">BNB Business Network</h1>
            <p style="margin: 6px 0 0 0; color: #a7f3d0; font-size: 13px;">Bangladesh National Gateway & Verification</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 32px 24px; text-align: center;">
            <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #0f172a;">প্রিয় ${userName},</p>
            <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.5;">${reasonText} নিচের ৬-সংখ্যার সিকিউরিটি ভেরিফিকেশন ওটিপি (OTP) কোডটি ব্যবহার করুন:</p>
            <div style="margin: 16px auto; padding: 16px 28px; background-color: #ecfdf5; border: 2px dashed #059669; border-radius: 12px; display: inline-block;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #065f46;">${otp}</span>
            </div>
            <p style="margin: 20px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">
              এই ওটিপি কোডটি আগামী <b style="color: #0f172a;">৫ মিনিটের জন্য</b> কার্যকর থাকবে। নিরাপত্তা স্বার্থে কোডটি কারো সাথে শেয়ার করবেন না।
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.4;">
              আপনি যদি এই অনুরোধটি না করে থাকেন, তবে এটি এড়িয়ে চলুন অথবা অবিলম্বে সাপোর্ট টিমে যোগাযোগ করুন।<br>
              © 2026 BNB Business Network Bangladesh. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Dispatches an authentic 6-digit Email OTP via secure server proxy
 * and persists the verification record in Firestore ('email_otps/{email}')
 * so verification works 100% reliably across multiple server instances.
 */
export async function sendEmailOtpDirect(options: SendOtpOptions): Promise<{ success: boolean; deliveredTo: string; otp?: string; error?: string }> {
  const { email, otp, userName = 'সম্মানিত সদস্য', phone = '', memberId = '', userId = '', reason = 'login' } = options;
  const targetEmail = String(email || '').trim().toLowerCase();

  if (!targetEmail || !targetEmail.includes('@')) {
    return { success: false, deliveredTo: '', error: 'বৈধ ইমেইল ঠিকানা পাওয়া যায়নি।' };
  }

  let effectiveOtp = String(otp || '').trim();
  if (!/^\d{6}$/.test(effectiveOtp)) {
    try {
      const rand = new Uint32Array(1);
      crypto.getRandomValues(rand);
      effectiveOtp = String(100000 + (rand[0] % 900000));
    } catch {
      effectiveOtp = String(Math.floor(100000 + Math.random() * 900000));
    }
  }

  const now = Date.now();
  const expiresAt = now + 5 * 60 * 1000;

  // Persist to Firestore email_otps/{targetEmail} so multi-instance Cloud Run verification never loses state
  try {
    await setDoc(doc(db, 'email_otps', targetEmail), {
      email: targetEmail,
      otp: effectiveOtp,
      purpose: reason,
      userId: userId || '',
      attempts: 0,
      used: false,
      expiresAt,
      createdAt: new Date(now).toISOString()
    });
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[Firestore email_otps save warning]:', e);
    }
  }

  const payload = {
    email: targetEmail,
    otp: effectiveOtp,
    userName,
    name: userName,
    phone,
    accountNumber: memberId,
    memberId,
    userId,
    channel: 'email',
    purpose: reason,
    reason,
    skipEmail: false
  };

  const candidateUrls = Array.from(
    new Set([
      apiUrl('/api/send-email-otp'),
      apiUrl('/api/send-otp'),
      'https://businessnetworkbangladesh.com/api/send-email-otp',
      'https://businessnetworkbangladesh.com/api/send-otp'
    ])
  );

  for (const url of candidateUrls) {
    try {
      if (typeof (window as any)?.Capacitor !== 'undefined' && CapacitorHttp?.post) {
        const res = await CapacitorHttp.post({
          url,
          headers: { 'Content-Type': 'application/json' },
          data: payload
        });
        if (res.status >= 200 && res.status < 300 && res.data?.success !== false) {
          return { success: true, deliveredTo: targetEmail, otp: effectiveOtp };
        }
        if (res.status === 429) {
          return { success: false, deliveredTo: '', error: res.data?.error || 'অতিরিক্ত ওটিপি অনুরোধ করা হয়েছে।' };
        }
      }
    } catch (capErr) {
      if (import.meta.env.DEV) {
        console.warn('[CapacitorHttp Backend Warning]:', capErr);
      }
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        return { success: true, deliveredTo: targetEmail, otp: effectiveOtp };
      }
      if (res.status === 429) {
        return { success: false, deliveredTo: '', error: data?.error || 'অতিরিক্ত ওটিপি অনুরোধ করা হয়েছে।' };
      }
    } catch (fetchErr) {
      if (import.meta.env.DEV) {
        console.warn('[Fetch Backend OTP Warning]:', fetchErr);
      }
    }
  }

  return { success: false, deliveredTo: '', error: 'ওটিপি পাঠাতে সমস্যা হয়েছে।' };
}

/**
 * Universal Email OTP Verification:
 * 1. Verifies via backend (/api/verify-otp) first.
 * 2. If backend hits a different Cloud Run container instance (in-memory store miss) or is unreachable,
 *    verifies against Firestore 'email_otps/{cleanEmail}'.
 */
export async function verifyEmailOtpUniversal(
  email: string,
  otpInput: string,
  purpose: string = 'login'
): Promise<{
  verified: boolean;
  user?: any;
  otpVerificationToken?: string;
  code?: string;
  error?: string;
}> {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanOtp = convertBengaliToEnglishDigits(String(otpInput || '')).trim();

  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { verified: false, error: 'ইমেইল ঠিকানা পাওয়া যায়নি।' };
  }
  if (!/^\d{6}$/.test(cleanOtp)) {
    return { verified: false, error: 'ওটিপি কোড অবশ্যই ৬ সংখ্যার হতে হবে।' };
  }

  // 1. Try server /api/verify-otp first
  try {
    const verifyRes = await fetch(apiUrl('/api/verify-otp'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        otp: cleanOtp,
        purpose
      })
    });
    const verifyData = await verifyRes.json().catch(() => null);
    if (verifyRes.ok && verifyData?.verified) {
      updateDoc(doc(db, 'email_otps', cleanEmail), {
        used: true,
        usedAt: new Date().toISOString()
      }).catch(() => {});
      return {
        verified: true,
        user: verifyData.user || null,
        otpVerificationToken: verifyData.otpVerificationToken || ''
      };
    }
    if (verifyData?.code === 'user_not_found') {
      return {
        verified: false,
        code: 'user_not_found',
        error: verifyData.error || 'এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি।'
      };
    }
  } catch (e) {
    // Fall through to Firestore email_otps check
  }

  // 2. Fallback to Firestore email_otps/{cleanEmail} (handles multi-instance Cloud Run or offline route)
  try {
    const otpRef = doc(db, 'email_otps', cleanEmail);
    const otpSnap = await getDoc(otpRef);
    if (otpSnap.exists()) {
      const otpData = otpSnap.data() || {};
      const now = Date.now();
      if (otpData.used) {
        return { verified: false, error: 'এই ওটিপি কোডটি ইতিমধ্যে ব্যবহৃত হয়েছে।' };
      }
      if (otpData.expiresAt && now > Number(otpData.expiresAt)) {
        return { verified: false, error: 'ওটিপি কোডের মেয়াদ (৫ মিনিট) শেষ হয়ে গেছে। অনুগ্রহ করে নতুন ওটিপি পাঠান।' };
      }
      const attempts = Number(otpData.attempts) || 0;
      if (attempts >= 5) {
        return { verified: false, error: '৫ বার ভুল ওটিপি দেওয়ার কারণে কোডটি বাতিল হয়েছে। নতুন ওটিপি নিন।' };
      }
      if (String(otpData.otp || '').trim() === cleanOtp) {
        await updateDoc(otpRef, {
          used: true,
          usedAt: new Date(now).toISOString()
        }).catch(() => {});
        return { verified: true };
      } else {
        const nextAttempts = attempts + 1;
        await updateDoc(otpRef, {
          attempts: nextAttempts,
          used: nextAttempts >= 5
        }).catch(() => {});
        return {
          verified: false,
          error: `ভুল ওটিপি কোড! আর ${Math.max(0, 5 - nextAttempts)} বার চেষ্টা করতে পারবেন।`
        };
      }
    }
  } catch (fsErr) {
    if (import.meta.env.DEV) {
      console.warn('[Firestore email_otps verify warning]:', fsErr);
    }
  }

  return {
    verified: false,
    error: 'প্রদত্ত ওটিপি কোডটি সঠিক নয় বা মেয়াদ শেষ হয়েছে। অনুগ্রহ করে সঠিক ৬ সংখ্যার কোড দিন।'
  };
}
