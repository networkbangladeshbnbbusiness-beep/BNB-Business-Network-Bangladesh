import { messaging, db } from './firebase';
import { getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';

export const setupFCM = async (
  userId: string,
  onNotification: (notification: { title: string; body: string }) => void
) => {
  if (!messaging || !userId || typeof window === 'undefined') return;

  // Web Push Service Worker registration is unsupported inside native Capacitor WebView containers
  try {
    if (Capacitor.isNativePlatform()) return;
  } catch {}

  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

  try {
    const supported = await isSupported().catch(() => false);
    if (!supported) return;

    if (Notification.permission === 'denied') return;

    const permission =
      Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission().catch(() => 'denied');

    if (permission === 'granted') {
      // Pre-check that /firebase-messaging-sw.js responds with JavaScript (never text/html)
      const swCheck = await fetch('/firebase-messaging-sw.js', { method: 'GET', cache: 'no-store' }).catch(() => null);
      const contentType = swCheck?.headers?.get('content-type') || '';
      if (!swCheck || !swCheck.ok || contentType.includes('text/html')) {
        return;
      }

      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/firebase-cloud-messaging-push-scope'
      });

      const token = await getToken(messaging, {
        serviceWorkerRegistration: registration
      });

      if (token) {
        await setDoc(doc(db, 'users', userId, 'fcmTokens', token), {
          userId,
          token,
          updatedAt: new Date().toISOString()
        });
      }
    }
  } catch (error: any) {
    const msg = String(error?.message || error || '');
    if (
      msg.includes('failed-service-worker-registration') ||
      msg.includes('unsupported-browser') ||
      msg.includes('permission-blocked') ||
      msg.includes('AbortError') ||
      msg.includes('Registration failed')
    ) {
      return;
    }
    console.warn('FCM setup skipped:', msg);
  }

  try {
    onMessage(messaging, (payload) => {
      onNotification({
        title: payload.notification?.title || 'New Notification',
        body: payload.notification?.body || ''
      });
    });
  } catch {}
};
