/**
 * Centralized API configuration and URL resolver.
 * Ensures seamless operation across Web and Android Capacitor (Play Store app / APK).
 */
import { Capacitor } from '@capacitor/core';

export const APP_BASE_URL = 'https://businessnetworkbangladesh.com';
export const DEFAULT_PRODUCTION_SERVER_URL = APP_BASE_URL;

/**
 * Checks if running inside native mobile container (Capacitor APK, WebView, or installed app).
 * In native software, the device does NOT run a local Node.js backend.
 */
export function isStrictNative(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Capacitor core official check
  try {
    if (Capacitor.isNativePlatform()) return true;
    const platform = Capacitor.getPlatform();
    if (platform === 'android' || platform === 'ios') return true;
  } catch (e) {}

  // 2. Global Capacitor object
  if (Boolean((window as any).Capacitor?.isNativePlatform?.())) return true;
  if ((window as any).Capacitor?.getPlatform?.() === 'android' || (window as any).Capacitor?.getPlatform?.() === 'ios') return true;

  // 3. Native protocols (Capacitor or file scheme)
  const proto = window.location.protocol;
  if (proto === 'capacitor:' || proto === 'file:' || proto === 'ionic:') return true;

  // 4. Capacitor Android standard origin is https://localhost (with no dev port 3000 or 5173)
  const host = window.location.hostname;
  const port = window.location.port;
  if ((host === 'localhost' || host === '127.0.0.1') && proto === 'https:') {
    return true;
  }

  // 5. Mobile user-agent with localhost or empty host (APK WebView asset container)
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent : '').toLowerCase();
  const isMobile = /android|iphone|ipad|ipod/i.test(ua);
  const isWebView = ua.includes('wv') || (ua.includes('android') && (ua.includes('version/') || !ua.includes('chrome')));
  if ((host === 'localhost' || host === '127.0.0.1' || !host) && (isMobile || isWebView)) {
    return true;
  }

  return false;
}

export function isNativeOrLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  return isStrictNative() || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

export function getApiBaseUrl(): string {
  // If explicitly overridden via Vite env
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : null;
  if (metaEnv?.VITE_API_BASE_URL) {
    return String(metaEnv.VITE_API_BASE_URL).replace(/\/$/, '');
  }

  // If injected into window
  if (typeof window !== 'undefined' && (window as any).BNB_API_BASE_URL) {
    return String((window as any).BNB_API_BASE_URL).replace(/\/$/, '');
  }

  // CRITICAL: On Mobile Software / Native App, NEVER use localhost!
  // Mobile devices don't run Node.js backend. Always point to production server!
  if (isStrictNative()) {
    return APP_BASE_URL;
  }

  // Running on Web / Browser
  if (typeof window !== 'undefined' && window.location.origin) {
    const origin = window.location.origin.replace(/\/$/, '');
    const host = window.location.hostname;
    
    // If running on local machine in development
    if (host === 'localhost' || host === '127.0.0.1') {
      const port = window.location.port;
      // In desktop browser dev server (port 3000 or 5173), use local origin
      if (port === '3000' || port === '5173') {
        return origin;
      }
      // On mobile or unknown port, fallback to production backend
      return APP_BASE_URL;
    }

    if (origin.startsWith('http')) {
      return origin;
    }
  }

  return APP_BASE_URL;
}

export function apiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const base = getApiBaseUrl();
  return `${base}${cleanEndpoint}`;
}

export function getReturnOrigin(): string {
  if (isStrictNative()) {
    return APP_BASE_URL;
  }
  if (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http')) {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return APP_BASE_URL;
    }
    return window.location.origin.replace(/\/$/, '');
  }
  return APP_BASE_URL;
}
