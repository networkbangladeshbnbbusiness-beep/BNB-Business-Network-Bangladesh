/**
 * Route and Variant Isolation between User Software and Standalone Admin Software.
 *
 * CRITICAL SECURITY POLICY:
 * - Standard Web builds & User Play Store AAB/APK ALWAYS compile with VITE_APP_VARIANT=user.
 * - The User Software contains ZERO admin routes, buttons, menus, or preview switches.
 * - Dedicated Standalone Admin Software (APK workflow) compiles strictly with VITE_APP_VARIANT=admin.
 */
export function isAdminBuildVariant(): boolean {
  try {
    const variant = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_APP_VARIANT : undefined;
    if (variant === 'admin') return true;
  } catch {}
  return false;
}

/**
 * Strictly true ONLY when running inside the dedicated Standalone Admin build (VITE_APP_VARIANT=admin).
 * Never returns true in User builds regardless of URL path, query string, hostname, or logged-in account.
 */
export function isStandaloneAdminRoute(): boolean {
  return isAdminBuildVariant();
}

/**
 * Detects direct attempts to open an admin URL (/admin, /admin-panel, ?app=admin, #admin, admin.*)
 * inside the User Software so the router/guard immediately blocks access and displays 403 Denied.
 */
export function isAdminAccessBlockedUrl(): boolean {
  if (isAdminBuildVariant()) return false;
  if (typeof window === 'undefined') return false;

  const path = window.location.pathname.toLowerCase();
  const search = window.location.search.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const host = window.location.hostname.toLowerCase();

  let hasAdminQuery = false;
  try {
    const params = new URLSearchParams(search);
    hasAdminQuery = params.get('app') === 'admin' || params.get('admin') === 'true';
  } catch {
    hasAdminQuery = search.includes('app=admin') || search.includes('admin=true');
  }

  return (
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path.startsWith('/admin-panel') ||
    path.startsWith('/admin-software') ||
    hasAdminQuery ||
    hash === '#admin' ||
    hash.startsWith('#/admin') ||
    host.startsWith('admin.')
  );
}
