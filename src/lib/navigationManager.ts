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
  private trapArmed = false;

  constructor() {
    this.armBrowserHistoryTrap();
  }

  public setExitConfirmCallback(cb: (show: boolean) => void) {
    this.showExitConfirmCallback = cb;
  }

  public setExitToastCallback(cb: (show: boolean) => void) {
    this.showExitToastCallback = cb;
  }

  /**
   * Arm the browser history trap with a stable 2-step state:
   * Base state { amb_root: true } -> Active state { amb_active: true }
   * When Android back gesture or browser back occurs, popstate fires and we immediately re-arm.
   */
  public armBrowserHistoryTrap() {
    if (typeof window !== 'undefined' && window.history) {
      try {
        if (!this.trapArmed) {
          window.history.replaceState({ amb_root: true }, '');
          window.history.pushState({ amb_active: true }, '');
          this.trapArmed = true;
        }
      } catch (e) {
        console.warn('History trap arming error:', e);
      }
    }
  }

  /**
   * Re-arms history state on gesture pop
   */
  public rearmHistory() {
    if (typeof window !== 'undefined' && window.history) {
      try {
        window.history.pushState({ amb_active: true }, '');
      } catch (e) {}
    }
  }

  /**
   * Pushes a history entry for section or tab navigation
   */
  public pushNavigationState(type: string, id: string) {
    if (typeof window !== 'undefined' && window.history) {
      try {
        window.history.pushState({ bnb_nav: type, id, ts: Date.now() }, '');
      } catch (e) {}
    }
  }

  /**
   * Register a BackHandler in LIFO (stack) order.
   * Priority can be used if higher priority handlers should run first.
   * Priority hierarchy:
   *  95-100: Exit confirmation modal / alert
   *  70-90:  Full modals / Dialogs / Location / PIN prompt / Drawer
   *  30-40:  Sub-views / Sections (one of 12 sections)
   *  15-20:  Tab History (step-by-step)
   *  10:     Default fallback
   */
  public register(handler: BackHandler, priority = 10): () => void {
    const id = 'h_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    this.handlers.push({ id, handler, priority });
    // Sort by priority ascending so highest priority is at the end of the array (LIFO)
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
    this.rearmHistory();
    const now = Date.now();
    // If native back button fired in the last 400ms, ignore duplicate popstate
    if (now - this.lastNativeBackTick < 400) {
      return;
    }
    this.handleBack('browser');
  }

  /**
   * Execute global back action.
   * Returns:
   *  true -> Handled internally (modal closed, subpage returned, tab switched, or exit confirmation shown)
   *  false -> Root exit confirmed
   */
  public handleBack(source = 'unknown'): boolean {
    const now = Date.now();

    if (source === 'capacitor' || source === 'native') {
      this.lastNativeBackTick = now;
    }

    // Debounce rapid duplicate hardware vibrations / bounce (250ms window)
    if (now - this.lastHandledTick < 250) {
      return true;
    }
    this.lastHandledTick = now;

    if (this.isProcessingBack) return true;
    this.isProcessingBack = true;

    try {
      // 1. Iterate through registered handlers in LIFO order (highest priority / last registered first)
      for (let i = this.handlers.length - 1; i >= 0; i--) {
        const item = this.handlers[i];
        try {
          const handled = item.handler();
          if (handled) {
            // Handled by active sub-modal, tab, or sub-page!
            return true;
          }
        } catch (err) {
          console.error('Error executing back handler:', err);
        }
      }

      // 2. If we reach here, we are on the Root Home Screen with no modals or sections open
      return this.handleHomeScreenExit();
    } finally {
      this.isProcessingBack = false;
    }
  }

  /**
   * Handles root Home Screen back press:
   * Displays the "অ্যাপ থেকে বের হতে চান?" confirmation modal.
   * The app will ONLY close if the user explicitly confirms "হ্যাঁ".
   */
  public handleHomeScreenExit(): boolean {
    if (this.showExitConfirmCallback) {
      this.showExitConfirmCallback(true);
      return true;
    }

    // Fallback if no modal callback registered
    return true;
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
