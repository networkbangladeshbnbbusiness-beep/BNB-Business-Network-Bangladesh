import { useEffect, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';

export type BackHandler = () => boolean;

interface RegisteredHandler {
  id: string;
  handler: BackHandler;
  priority: number;
}

class NavigationManager {
  private handlers: RegisteredHandler[] = [];
  private showExitConfirmCallback: ((show: boolean) => void) | null = null;
  private showExitToastCallback: ((show: boolean) => void) | null = null;
  private isProcessingBack = false;
  private lastHandledTick = 0;
  private lastNativeBackTick = 0;
  private lastPopStateTick = 0;
  private trapArmed = false;
  private backBlocked = false;
  private isIgnoringNextPopState = false;

  constructor() {
    this.armBrowserHistoryTrap();
  }

  public setExitConfirmCallback(cb: ((show: boolean) => void) | null) {
    this.showExitConfirmCallback = cb;
  }

  public setExitToastCallback(cb: ((show: boolean) => void) | null) {
    this.showExitToastCallback = cb;
  }

  /**
   * Blocks or unblocks all back navigation while a payment or transaction is processing.
   */
  public setBackBlocked(blocked: boolean) {
    this.backBlocked = Boolean(blocked);
  }

  public isBackBlocked(): boolean {
    return this.backBlocked;
  }

  /**
   * Single owner of browser history:
   * Arms a single stable 2-step history trap ({ amb_root: true } -> { amb_active: true }).
   */
  public armBrowserHistoryTrap() {
    if (typeof window !== 'undefined' && window.history) {
      try {
        if (!this.trapArmed) {
          const currentPath = window.location.pathname + window.location.search + window.location.hash;
          window.history.replaceState({ amb_root: true }, '', currentPath);
          window.history.pushState({ amb_active: true }, '', currentPath);
          this.trapArmed = true;
        }
      } catch (e) {
        console.warn('History trap arming error:', e);
      }
    }
  }

  /**
   * Resets the browser history trap cleanly (e.g. on login, logout, or returning home from payment result)
   * so the user cannot navigate back to Login after logging in, or back into inner screens after logging out.
   */
  public resetHistoryTrap(targetUrl?: string) {
    if (typeof window !== 'undefined' && window.history) {
      try {
        const url = targetUrl || (window.location.pathname + window.location.search + window.location.hash);
        window.history.replaceState({ amb_root: true }, '', url);
        window.history.pushState({ amb_active: true }, '', url);
        this.trapArmed = true;
      } catch (e) {}
    }
  }

  /**
   * Re-arms the single history trap entry only when popstate popped off amb_active.
   */
  public rearmHistory() {
    if (typeof window !== 'undefined' && window.history) {
      try {
        if (!window.history.state || !window.history.state.amb_active) {
          const currentPath = window.location.pathname + window.location.search + window.location.hash;
          window.history.pushState({ amb_active: true }, '', currentPath);
        }
        this.trapArmed = true;
      } catch (e) {}
    }
  }

  /**
   * Does NOT push duplicate browser history entries; keeps history under single trap ownership.
   */
  public pushNavigationState(_type: string, _id: string) {
    if (!this.trapArmed) {
      this.armBrowserHistoryTrap();
    }
  }

  /**
   * Register a BackHandler in LIFO (stack) order.
   * Priority hierarchy:
   *  95-100: Exit confirmation modal / alert
   *  70-90:  Full modals / Dialogs / Location / PIN prompt / Payment Notice / Drawer
   *  50:     Admin Panel
   *  30-40:  Dashboard modals
   *  25-30:  Sub-views / Internal tabs inside one of 12 sections
   *  18:     Active Service Section close (modalStack pop)
   *  15:     Tab History step-by-step back
   */
  public register(handler: BackHandler, priority = 10): () => void {
    const id = 'h_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    this.handlers.push({ id, handler, priority });
    this.handlers.sort((a, b) => a.priority - b.priority);

    return () => {
      this.unregister(id);
    };
  }

  public unregister(id: string) {
    this.handlers = this.handlers.filter(h => h.id !== id);
  }

  /**
   * Handles browser popstate event (e.g. from Android edge gesture or browser back).
   */
  public handlePopState() {
    if (this.isIgnoringNextPopState) {
      this.isIgnoringNextPopState = false;
      this.rearmHistory();
      return;
    }

    this.rearmHistory();
    const now = Date.now();
    this.lastPopStateTick = now;

    // If native Capacitor backButton already fired in the last 450ms, ignore duplicate popstate
    if (now - this.lastNativeBackTick < 450) {
      return;
    }
    this.handleBack('browser');
  }

  /**
   * Execute global back action.
   * Returns:
   *  true  -> Handled internally (or blocked during transaction processing)
   *  false -> Nothing left to go back to (at Root Home / Standalone Admin root), caller should exit app
   */
  public handleBack(source = 'unknown'): boolean {
    const now = Date.now();

    if (source === 'capacitor' || source === 'native') {
      // If popstate already handled this exact press within 450ms, do not run twice
      if (now - this.lastPopStateTick < 450) {
        this.lastNativeBackTick = now;
        return true;
      }
      this.lastNativeBackTick = now;
    }

    // Debounce rapid duplicate hardware bounce (250ms window)
    if (now - this.lastHandledTick < 250) {
      return true;
    }
    this.lastHandledTick = now;

    // Ignore back completely while payment/transaction is processing
    if (this.backBlocked) {
      return true;
    }

    if (this.isProcessingBack) return true;
    this.isProcessingBack = true;

    try {
      // 1. Iterate through registered handlers in LIFO order (highest priority / last registered first)
      for (let i = this.handlers.length - 1; i >= 0; i--) {
        const item = this.handlers[i];
        try {
          const handled = item.handler();
          if (handled) {
            return true;
          }
        } catch (err) {
          console.error('Error executing back handler:', err);
        }
      }

      // 2. Reached Root (Home Screen): return false so Capacitor backButton can call CapApp.exitApp()
      return this.handleHomeScreenExit(source);
    } finally {
      this.isProcessingBack = false;
    }
  }

  /**
   * Handles root Home Screen back press.
   * Returns false when no exit modal callback overrides it, allowing CapApp.exitApp() on native Android.
   */
  public handleHomeScreenExit(source = 'unknown'): boolean {
    if (this.showExitConfirmCallback && source === 'browser') {
      this.showExitConfirmCallback(true);
      return true;
    }
    return false;
  }
}

export const navigationManager = new NavigationManager();

// Expose globally so Android native MainActivity can invoke directly
if (typeof window !== 'undefined') {
  (window as any).navigationManager = navigationManager;
}

/**
 * React Hook for registering a back handler within any component.
 * Automatically manages mounting and unmounting.
 */
export function useBackHandler(handler: BackHandler, active = true, priority = 10) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!active) return;

    const unregister = navigationManager.register(() => {
      return handlerRef.current();
    }, priority);

    return () => {
      unregister();
    };
  }, [active, priority]);
}

/**
 * React Hook for blocking back navigation while a transaction/payment is submitting.
 */
export function useBackBlock(blocked: boolean) {
  useEffect(() => {
    if (!blocked) return;
    navigationManager.setBackBlocked(true);
    return () => {
      navigationManager.setBackBlocked(false);
    };
  }, [blocked]);
}
