import { Capacitor } from '@capacitor/core';

const STUDIO_USER_PREVIEW_KEY = 'bnb_studio_user_preview';

/**
 * True ONLY when built with VITE_APP_VARIANT=admin (used exclusively by the dedicated Admin APK workflow).
 * Standard Web builds & User Play Store AAB/APK ALWAYS compile with VITE_APP_VARIANT=user.
 */
export function isAdminBuildVariant(): boolean {
  try {
    const variant = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_APP_VARIANT : undefined;
    if (variant === 'admin') return true;
  } catch {}
  return false;
}

/**
 * True ONLY in the AI Studio workspace/dev preview host (never in APK, never on production domains).
 */
export function isAiStudioDevHost(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (Capacitor.isNativePlatform()) return false;
  } catch {}
  const host = window.location.hostname.toLowerCase();
  return (
    host.startsWith('ais-dev-') ||
    host === 'localhost' ||
    host === '127.0.0.1'
  );
}

/**
 * True ONLY when an authenticated admin inside AI Studio Preview switches to User Dashboard preview.
 */
export function isStudioUserPreviewActive(): boolean {
  if (!isAiStudioDevHost()) return false;
  try {
    return sessionStorage.getItem(STUDIO_USER_PREVIEW_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setStudioUserPreviewActive(active: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (active && isAiStudioDevHost()) {
      sessionStorage.setItem(STUDIO_USER_PREVIEW_KEY, 'true');
    } else {
      sessionStorage.removeItem(STUDIO_USER_PREVIEW_KEY);
    }
  } catch {}
}

/**
 * Route isolation between User Software and Standalone Admin Software.
 * - Dedicated Admin APK builds (VITE_APP_VARIANT=admin) ALWAYS run as Standalone Admin Software.
 * - Standard Native Play Store User AAB/APK builds NEVER expose the Admin Panel.
 * - Explicit user mode (?app=user, /user, or studio user preview) loads User Software.
 * - Dedicated /admin paths (on dev & production) always load the Admin Panel Login.
 * - AI Studio Preview / Dev environment (ais-dev-* / localhost) defaults to Admin Panel Login.
 */
export function isStandaloneAdminRoute(): boolean {
  if (isAdminBuildVariant()) {
    return true;
  }

  if (typeof window === 'undefined') return false;

  try {
    if (Capacitor.isNativePlatform()) return false;
  } catch {}

  if (isStudioUserPreviewActive()) {
    return false;
  }

  const path = window.location.pathname.toLowerCase();
  const search = window.location.search.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const host = window.location.hostname.toLowerCase();

  if (
    search.includes('app=user') ||
    search.includes('user=true') ||
    path === '/user' ||
    path.startsWith('/user/')
  ) {
    return false;
  }

  if (
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path.startsWith('/admin-panel') ||
    path.startsWith('/admin-software') ||
    search.includes('app=admin') ||
    search.includes('admin=true') ||
    hash === '#admin' ||
    host.startsWith('admin.')
  ) {
    return true;
  }

  if (isAiStudioDevHost()) {
    return true;
  }

  return false;
}
