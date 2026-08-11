import React, { useEffect, useState, useRef } from 'react';
import { ensureAuth, db, handleFirestoreError, OperationType, auth } from './lib/firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, setDoc, limit, onSnapshot } from 'firebase/firestore';
import { User, AppConfig } from './types';
import { loadAppConfig, DEFAULT_CONFIG } from './lib/config';
import { executeHistoryRetentionCleanup } from './lib/retentionCleanup';
import { normalizeMemberId, findUserInFirestoreByPhone, convertBengaliToEnglishDigits } from './lib/memberUtils';
import { restoreAndSeedDatabase } from './lib/databaseSeeder';
import LoginScreen from './components/LoginScreen';
import LockScreen from './components/LockScreen';
import SetAppLockModal from './components/SetAppLockModal';
import Dashboard from './components/Dashboard';
import DrawerMenu from './components/DrawerMenu';
import AdminPanel from './components/AdminPanel';
import BapSystem from './components/BapSystem';
import SplashVideo from './components/SplashVideo';
import { BNBLogo } from './components/BNBLogo';
import MaintenanceScreen from './components/MaintenanceScreen';
import ForceUpdateScreen from './components/ForceUpdateScreen';
import DeviceLockScreen from './components/DeviceLockScreen';
import { NotificationPrompt } from './components/NotificationPrompt';
import { NotificationBanner } from './components/NotificationBanner';
import { LocationPermissionModal } from './components/LocationPermissionModal';
import { syncUserLocationNow } from './lib/locationUtils';
import { setupFCM } from './lib/fcm';
import { ShieldCheck, ShieldAlert, X, RefreshCw, Lock, LogOut, Eye, EyeOff, AlertCircle, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const rememberedPhone = localStorage.getItem('bnb_user_phone');
    const rememberedUid = localStorage.getItem('bnb_user_uid');
    if (rememberedPhone && rememberedUid) {
      return {
        uid: rememberedUid,
        name: localStorage.getItem('bnb_user_name') || 'সদস্য',
        phone: rememberedPhone,
        memberId: localStorage.getItem('bnb_user_member_id') || 'BNB00000000',
        role: (localStorage.getItem('bnb_user_role') as any) || 'user',
        balance: Number(localStorage.getItem('bnb_user_balance') || '0'),
        savings: Number(localStorage.getItem('bnb_user_savings') || '0'),
        telecomBalance: Number(localStorage.getItem('bnb_user_telecom_balance') || '0'),
        superShopBalance: Number(localStorage.getItem('bnb_user_super_shop_balance') || '0'),
        dueLoan: Number(localStorage.getItem('bnb_user_due_loan') || '0'),
        createdAt: new Date().toISOString(),
        status: 'active',
        samityStatus: (localStorage.getItem('bnb_user_samity_status') as any) || 'none'
      };
    }
    return null;
  });
  const [isLocked, setIsLocked] = useState(() => {
    return !!localStorage.getItem('bnb_user_phone');
  });
  const [showSetLockModal, setShowSetLockModal] = useState(false);
  const [authUid, setAuthUid] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig>(() => {
    try {
      const cached = localStorage.getItem('bnb_app_config');
      if (cached) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(cached) };
      }
    } catch (e) {
      console.warn("Failed to parse cached appConfig", e);
    }
    return DEFAULT_CONFIG;
  });
  const [preferRegister, setPreferRegister] = useState(false);
  const [adminBypassed, setAdminBypassed] = useState(false);
    const CURRENT_APP_VERSION = "2.0";

  // Unique client-side device identifier for device-locking
  const [deviceId] = useState(() => {
    let devId = localStorage.getItem('bnb_device_id');
    if (!devId) {
      devId = 'dev_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
      localStorage.setItem('bnb_device_id', devId);
    }
    return devId;
  });


  // Real-time synchronization of the app configuration settings
  useEffect(() => {
    restoreAndSeedDatabase();
    const configRef = doc(db, 'system_settings', 'app_config');
    const unsub = onSnapshot(configRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as AppConfig;
        setAppConfig(prev => ({ ...prev, ...data }));
        try {
          localStorage.setItem('bnb_app_config', JSON.stringify({ ...DEFAULT_CONFIG, ...data }));
        } catch (e) {
          console.error("Failed to cache real-time appConfig", e);
        }
      }
    }, (err) => {
      console.warn("Real-time AppConfig snapshot error:", err);
    });
    return () => unsub();
  }, []);

  // Automated Configurable History Retention Cleanup
  useEffect(() => {
    const retentionDays = appConfig?.historyRetentionDays ?? 365;
    const lastRunRaw = localStorage.getItem('bnb_last_retention_cleanup');
    let shouldRun = true;

    if (lastRunRaw) {
      try {
        const lastRun = JSON.parse(lastRunRaw);
        const hoursSinceLastRun = (Date.now() - new Date(lastRun.executedAt).getTime()) / (1000 * 60 * 60);
        // Throttle background cleanup to run at most once every 12 hours unless period changed
        if (hoursSinceLastRun < 12 && lastRun.days === retentionDays) {
          shouldRun = false;
        }
      } catch (e) {
        shouldRun = true;
      }
    }

    if (shouldRun) {
      executeHistoryRetentionCleanup(retentionDays).then(res => {
        if (res.totalDeleted > 0) {
          console.log(`[RetentionSystem] Successfully auto-purged ${res.totalDeleted} expired records older than ${retentionDays} days.`);
        }
      }).catch(err => {
        console.warn("[RetentionSystem] Background retention cleanup error:", err);
      });
    }
  }, [appConfig?.historyRetentionDays]);

  // Client-Side OneSignal Push Notification Setup & Initialization
  useEffect(() => {
    if (appConfig?.oneSignalAppId) {
      try {
        const OneSignal = (window as any).OneSignal || [];
        if (typeof OneSignal.push === 'function') {
          OneSignal.push(() => {
            OneSignal.init({
              appId: appConfig.oneSignalAppId,
              allowLocalhostAsSecureOrigin: true,
              welcomeNotification: {
                disable: false,
                title: "BNB Business Network",
                message: "মোবাইল পুশ নোটিফিকেশন সফলভাবে চালু হয়েছে! 🔔"
              }
            }).then(() => {
              console.log("OneSignal initialized on client side with app ID:", appConfig.oneSignalAppId);
              
              // Automatically register/prompt the user for notification permissions
              try {
                if (OneSignal.Notifications && typeof OneSignal.Notifications.requestPermission === 'function') {
                  OneSignal.Notifications.requestPermission();
                } else if (typeof OneSignal.registerForPushNotifications === 'function') {
                  OneSignal.registerForPushNotifications();
                }
              } catch (permErr) {
                console.warn("OneSignal permission request failed:", permErr);
              }

              // Login the user to OneSignal with their Firebase UID to allow targeted push!
              if (currentUser?.uid) {
                if (typeof OneSignal.login === 'function') {
                  OneSignal.login(currentUser.uid).then(() => {
                    console.log("OneSignal user logged in with External ID:", currentUser.uid);
                    
                    // Set tags for targeted filtering (e.g. role, group, division)
                    if (OneSignal.User && typeof OneSignal.User.addTags === 'function') {
                      OneSignal.User.addTags({
                        uid: currentUser.uid,
                        phone: currentUser.phone || '',
                        role: currentUser.role || 'user',
                        group: currentUser.group || 'all',
                        division: currentUser.division || ''
                      });
                      console.log("OneSignal user tags updated.");
                    }
                  }).catch((err: any) => {
                    console.warn("OneSignal login error:", err);
                  });
                }
              } else {
                // If logged out, log out from OneSignal too to avoid cross-device push mixing
                if (typeof OneSignal.logout === 'function') {
                  OneSignal.logout();
                }
              }
            }).catch((err: any) => {
              console.warn("OneSignal.init error:", err);
            });
          });
        }
      } catch (err) {
        console.error("Failed to run OneSignal client initialization:", err);
      }
    }
  }, [appConfig?.oneSignalAppId, currentUser?.uid, currentUser?.role, currentUser?.group, currentUser?.division]);

  // Language & Theme Global States
  const [appLanguage, setAppLanguage] = useState(() => {
    return localStorage.getItem('bnb_lang') || 'bn';
  });
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('bnb_dark_mode') === 'true';
  });

  // Apply Tailwind class-based dark mode state
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleLanguageChange = (lang: string) => {
    setAppLanguage(lang);
    localStorage.setItem('bnb_lang', lang);
  };

  const handleThemeToggle = () => {
    const nextVal = !darkMode;
    setDarkMode(nextVal);
    localStorage.setItem('bnb_dark_mode', String(nextVal));
  };

  // Layout states
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [bapOpen, setBapOpen] = useState(false);
  const [showAdminPinModal, setShowAdminPinModal] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminError, setAdminError] = useState('');

  const [activeTab, setActiveTab] = useState('home');
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [showDemoAuthPrompt, setShowDemoAuthPrompt] = useState(false);
  const [foregroundNotification, setForegroundNotification] = useState<{title: string, body: string} | null>(null);
  const [showExitToast, setShowExitToast] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(() => {
    return sessionStorage.getItem('bnb_fresh_login_location_needed') === 'true';
  });
  const lastBackPressRef = useRef<number>(0);

  // Browser/device Back-Button Gesture history synchronization system
  const pushedViewsRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    // Keep dashboard_home state in history when on the main Dashboard and logged in
    if (currentUser && !isLocked) {
      const isAnyOpen = drawerOpen || showAdminPinModal || adminOpen || bapOpen || selectedAction || (window as any).bnb_modal_open;
      if (!isAnyOpen) {
        if (window.history.state?.appView !== 'dashboard_home') {
          window.history.pushState({ appView: 'dashboard_home' }, '');
        }
      }
    }
  }, [currentUser, isLocked, drawerOpen, showAdminPinModal, adminOpen, bapOpen, selectedAction]);

  useEffect(() => {
    // 1. Drawer open/close tracker
    if (drawerOpen && !pushedViewsRef.current.drawerOpen) {
      pushedViewsRef.current.drawerOpen = true;
      window.history.pushState({ appView: 'drawer' }, '');
    } else if (!drawerOpen && pushedViewsRef.current.drawerOpen) {
      pushedViewsRef.current.drawerOpen = false;
      if (window.history.state?.appView === 'drawer') {
        window.history.back();
      }
    }
  }, [drawerOpen]);

  useEffect(() => {
    // 2. Admin Pin Modal open/close tracker
    if (showAdminPinModal && !pushedViewsRef.current.showAdminPinModal) {
      pushedViewsRef.current.showAdminPinModal = true;
      window.history.pushState({ appView: 'admin_pin' }, '');
    } else if (!showAdminPinModal && pushedViewsRef.current.showAdminPinModal) {
      pushedViewsRef.current.showAdminPinModal = false;
      if (window.history.state?.appView === 'admin_pin') {
        window.history.back();
      }
    }
  }, [showAdminPinModal]);

  useEffect(() => {
    // 3. Admin panel open/close tracker
    if (adminOpen && !pushedViewsRef.current.adminOpen) {
      pushedViewsRef.current.adminOpen = true;
      window.history.pushState({ appView: 'admin_panel' }, '');
    } else if (!adminOpen && pushedViewsRef.current.adminOpen) {
      pushedViewsRef.current.adminOpen = false;
      if (window.history.state?.appView === 'admin_panel') {
        window.history.back();
      }
    }
  }, [adminOpen]);

  useEffect(() => {
    // 4. Bap system open/close tracker
    if (bapOpen && !pushedViewsRef.current.bapOpen) {
      pushedViewsRef.current.bapOpen = true;
      window.history.pushState({ appView: 'bap_system' }, '');
    } else if (!bapOpen && pushedViewsRef.current.bapOpen) {
      pushedViewsRef.current.bapOpen = false;
      if (window.history.state?.appView === 'bap_system') {
        window.history.back();
      }
    }
  }, [bapOpen]);

  useEffect(() => {
    // 5. Selected Action Section open/close tracker
    if (selectedAction && !pushedViewsRef.current.selectedAction) {
      pushedViewsRef.current.selectedAction = true;
      window.history.pushState({ appView: 'selected_action', action: selectedAction }, '');
    } else if (!selectedAction && pushedViewsRef.current.selectedAction) {
      pushedViewsRef.current.selectedAction = false;
      if (window.history.state?.appView === 'selected_action') {
        window.history.back();
      }
    }
  }, [selectedAction]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      let handled = false;
      
      // Close the view if it popped to a state that does not match this view
      if (drawerOpen && state?.appView !== 'drawer') {
        setDrawerOpen(false);
        pushedViewsRef.current.drawerOpen = false;
        handled = true;
      }
      if (showAdminPinModal && state?.appView !== 'admin_pin') {
        setShowAdminPinModal(false);
        pushedViewsRef.current.showAdminPinModal = false;
        handled = true;
      }
      if (adminOpen && state?.appView !== 'admin_panel') {
        if (localStorage.getItem('bnb_admin_mode') === 'false') {
          setAdminOpen(false);
          pushedViewsRef.current.adminOpen = false;
          handled = true;
        } else {
          handled = true;
        }
      }
      if (bapOpen && state?.appView !== 'bap_system') {
        setBapOpen(false);
        pushedViewsRef.current.bapOpen = false;
        handled = true;
      }
      if (selectedAction && state?.appView !== 'selected_action') {
        setSelectedAction(null);
        pushedViewsRef.current.selectedAction = false;
        handled = true;
      }
      if ((window as any).bnb_modal_open) {
        handled = true;
      }

      // If nothing is open, we are on the main Dashboard
      if (!handled && currentUser && !isLocked) {
        const now = Date.now();
        if (now - lastBackPressRef.current < 2000) {
          // Allow exit: do not re-push the dashboard state, let history proceed or close
          setShowExitToast(false);
        } else {
          // First back tap: prevent exit, show warning toast, restore home state
          lastBackPressRef.current = now;
          setShowExitToast(true);
          setTimeout(() => setShowExitToast(false), 2000);
          window.history.pushState({ appView: 'dashboard_home' }, '');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [drawerOpen, showAdminPinModal, adminOpen, bapOpen, selectedAction, currentUser, isLocked]);

  // Global Soft Keyboard scroll and overlap fix for mobile devices
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
        document.body.classList.add('keyboard-active');
        
        // Scroll target to viewport center after a short layout-settling delay
        setTimeout(() => {
          if (document.activeElement === target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      setTimeout(() => {
        const active = document.activeElement;
        if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'SELECT' && active.tagName !== 'TEXTAREA')) {
          document.body.classList.remove('keyboard-active');
        }
      }, 150);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  // Auto-lock on visibility change removed to prevent double PIN prompts in iframe preview environments

  const convertBengaliToEnglishDigits = (input: string): string => {
    const bDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return input.split('').map(c => {
      const idx = bDigits.indexOf(c);
      return idx !== -1 ? String(idx) : c;
    }).join('');
  };

  const autoPromoteAndReturnUser = async (user: User): Promise<User> => {
    let changed = false;
    const updatedUser = { ...user };

    // Normalize memberId to the new BNB0000XXXX style
    const normalizedId = normalizeMemberId(updatedUser.memberId);
    if (updatedUser.memberId !== normalizedId) {
      updatedUser.memberId = normalizedId;
      changed = true;
    }

    // Always determine true effective balance from balance or mainBalance without defaulting to zero if valid
    const effectiveBal = Number(updatedUser.balance !== undefined && updatedUser.balance !== null ? updatedUser.balance : (updatedUser as any).mainBalance) || Number((updatedUser as any).mainBalance) || 0;
    if (updatedUser.balance !== effectiveBal || (updatedUser as any).mainBalance !== effectiveBal) {
      updatedUser.balance = effectiveBal;
      (updatedUser as any).mainBalance = effectiveBal;
      changed = true;
    }

    if (updatedUser.savings === undefined || updatedUser.savings === null) { updatedUser.savings = 0; changed = true; }
    if (updatedUser.telecomBalance === undefined || updatedUser.telecomBalance === null) { updatedUser.telecomBalance = 0; changed = true; }
    if (updatedUser.superShopBalance === undefined || updatedUser.superShopBalance === null) { updatedUser.superShopBalance = 0; changed = true; }
    if (updatedUser.dpsBalance === undefined || updatedUser.dpsBalance === null) { updatedUser.dpsBalance = 0; changed = true; }
    if (updatedUser.profitsBalance === undefined || updatedUser.profitsBalance === null) { updatedUser.profitsBalance = 0; changed = true; }
    if (updatedUser.dueLoan === undefined || updatedUser.dueLoan === null) { updatedUser.dueLoan = 0; changed = true; }

    const cleanPhone = updatedUser.phone?.replace(/\D/g, '') || '';
    const isDeveloper = cleanPhone.endsWith('00011112222') || cleanPhone.endsWith('11112222') || updatedUser.phone === '+8800011112222' || updatedUser.uid === 'admin_master';
    if (isDeveloper && updatedUser.role !== 'admin') {
      updatedUser.role = 'admin';
      changed = true;
    }

    const isRealUser = updatedUser.phone && 
      !updatedUser.phone.includes('01700000000') && 
      !updatedUser.name?.toLowerCase().includes('demo') && 
      !updatedUser.name?.includes('ডেমো') && 
      !updatedUser.name?.toLowerCase().includes('guest') && 
      !updatedUser.name?.includes('গেস্ট') && 
      !updatedUser.memberId?.includes('DEMO');

    if (isRealUser && updatedUser.isDemo !== false) {
      updatedUser.isDemo = false;
      changed = true;
    }

    // Retain Samity status only if explicitly approved or admin
    if (
      updatedUser.role === 'admin' ||
      updatedUser.role === 'sub_admin'
    ) {
      if (updatedUser.samityStatus !== 'approved') {
        updatedUser.samityStatus = 'approved';
        changed = true;
      }
    }

    if (changed) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          role: updatedUser.role || 'user',
          memberId: updatedUser.memberId,
          balance: updatedUser.balance,
          mainBalance: updatedUser.balance,
          savings: updatedUser.savings,
          telecomBalance: updatedUser.telecomBalance,
          superShopBalance: updatedUser.superShopBalance,
          dpsBalance: updatedUser.dpsBalance,
          profitsBalance: updatedUser.profitsBalance,
          dueLoan: updatedUser.dueLoan,
          isDemo: updatedUser.isDemo ?? false
        });
        console.log("Successfully synchronized user profile and balances in Firestore for user:", user.uid);
      } catch (e) {
        console.error("User profile balance update in Firestore failed:", e);
      }
    }
    return updatedUser;
  };

  useEffect(() => {
    async function initSession() {
      try {
        // Load dynamic configuration settings
        const config = await loadAppConfig();
        setAppConfig(config);
        try {
          localStorage.setItem('bnb_app_config', JSON.stringify(config));
        } catch (e) {
          console.error("Failed to cache appConfig", e);
        }

        // 1. Ensure authenticated user uid exists anonymously
        const authUser = await ensureAuth();
        if (authUser) {
          setAuthUid(authUser.uid);

          // 2. Check for locally remembered session details or auto-login the first available profile
          const rememberedPhone = localStorage.getItem('bnb_user_phone');
          const rememberedUid = localStorage.getItem('bnb_user_uid');
          
          if (rememberedPhone) {
            // Retrieve actual details from Firestore under saved UID first, or fall back to authUID
            const targetUid = rememberedUid || authUser.uid;
            const userRef = doc(db, 'users', targetUid);
            let userSnap;
            try {
              userSnap = await getDoc(userRef);
            } catch (err: any) {
              if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
                handleFirestoreError(err, OperationType.GET, `users/${targetUid}`);
              } else {
                throw err;
              }
            }

            if (userSnap && userSnap.exists()) {
              const userData = userSnap.data() as User;
              const finalUserData = await autoPromoteAndReturnUser(userData);
              localStorage.setItem('bnb_user_uid', finalUserData.uid);
              setCurrentUser(finalUserData);
              if (finalUserData.role === 'admin' || finalUserData.role === 'sub_admin') {
                if (localStorage.getItem('bnb_admin_mode') !== 'false') {
                  localStorage.setItem('bnb_admin_mode', 'true');
                  setAdminOpen(true);
                }
              }
            } else {
              // Trigger final fallback querying by multi-format phone search
              let matchedUser = null;
              try {
                matchedUser = await findUserInFirestoreByPhone(rememberedPhone);
              } catch (err: any) {
                if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
                  handleFirestoreError(err, OperationType.LIST, 'users');
                } else {
                  console.error("Session init phone match error:", err);
                }
              }
              if (matchedUser) {
                const finalUserData = await autoPromoteAndReturnUser(matchedUser.user);
                localStorage.setItem('bnb_user_uid', matchedUser.docId);
                setCurrentUser(finalUserData);
                if (finalUserData.role === 'admin' || finalUserData.role === 'sub_admin') {
                  if (localStorage.getItem('bnb_admin_mode') !== 'false') {
                    localStorage.setItem('bnb_admin_mode', 'true');
                    setAdminOpen(true);
                  }
                }
              } else {
                // Cache stale, clean up
                localStorage.removeItem('bnb_user_phone');
                localStorage.removeItem('bnb_user_uid');
                setCurrentUser(null);
                setIsLocked(false);
              }
            }
          } else {
            setCurrentUser(null);
            setIsLocked(false);
          }
        }
      } catch (err) {
        console.error("Session initialization failed:", err);
      } finally {
        setLoading(false);
      }
    }
    initSession();
  }, []);

  // Real-time synchronization of the active logged-in user profile document
  useEffect(() => {
    if (!currentUser?.uid) return;
    
    // Setup FCM
    setupFCM(currentUser.uid, (notification) => {
      setForegroundNotification(notification);
      setTimeout(() => setForegroundNotification(null), 5000);
    });

    const userDocRef = doc(db, 'users', currentUser.uid);
    const unsub = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const uData = snap.data() as User;
        const normalized = normalizeMemberId(uData.memberId);
        if (uData.memberId !== normalized) {
          uData.memberId = normalized;
        }

        // ⚡ Real-time Instant Force Logout & Zero Device Check (< 1s execution)
        const isForceLoggedOut = 
          currentUser.role !== 'admin' && !currentUser.deviceLockBypassed && (
            uData.isLoggedIn === false ||
            (uData.currentDeviceId === '' && currentUser.currentDeviceId !== '') ||
            (uData.currentDeviceId && uData.currentDeviceId !== '' && currentUser.currentDeviceId && uData.currentDeviceId !== currentUser.currentDeviceId) ||
            (uData.forceLogoutAt && (!currentUser.sessionLoggedInAt || new Date(uData.forceLogoutAt).getTime() >= new Date(currentUser.sessionLoggedInAt).getTime()))
          );

        if (isForceLoggedOut) {
          console.log("⚡ Real-time single-device / zero-device force logout triggered for user:", currentUser.uid);
          handleDirectLogout();
          alert("⚠️ এই একাউন্টটি অন্য একটি ডিভাইসে সক্রিয় করা হয়েছে অথবা এডমিন প্যানেল থেকে ডিভাইস জিরো (Release) করা হয়েছে! একই সাথে একাধিক ডিভাইসে একাউন্ট চালানো নিষেধ। নিরাপত্তা স্বার্থে এই ডিভাইসটি লগআউট করা হলো।");
          return;
        }

        const effectiveBal = Number(uData.balance !== undefined && uData.balance !== null ? uData.balance : (uData as any).mainBalance) || Number((uData as any).mainBalance) || 0;
        uData.balance = effectiveBal;
        (uData as any).mainBalance = effectiveBal;

        setCurrentUser((prev) => {
          if (!prev) return null;
          return { ...prev, ...uData, uid: snap.id };
        });
      }
    }, (err) => {
      console.error("Real-time App user document snapshot error:", err);
    });

    return () => unsub();
  }, [currentUser?.uid]);

  // Real-time Agent Live Geolocation Auto-Update
  useEffect(() => {
    if (!currentUser?.uid) return;

    let watchId: number | null = null;

    const startLocationTracking = () => {
      if (!navigator.geolocation) return;

      // watchPosition tracks real-time location updates automatically for all app users
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const updateObj = {
              latitude,
              longitude,
              lat: latitude,
              lng: longitude,
              realLat: latitude,
              realLng: longitude,
              hasRealGPS: true,
              lastSeen: 'Active Now',
              lastSeenAt: new Date().toISOString(),
              isOnline: true
            };

            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, updateObj).catch(() => {});

            // Also update in 'agents' collection
            const agentRef = doc(db, 'agents', currentUser.uid);
            await updateDoc(agentRef, updateObj).catch(() => {});

            // Also update in 'bap_agents'
            const bapAgentRef = doc(db, 'bap_agents', currentUser.uid);
            await updateDoc(bapAgentRef, updateObj).catch(() => {});

            // Also update in 'agent_requests'
            const reqRef = doc(db, 'agent_requests', currentUser.uid);
            await updateDoc(reqRef, updateObj).catch(() => {});

          } catch (e) {
            console.error("Error auto-updating live location:", e);
          }
        },
        (error) => {
          console.warn("Continuous geolocation tracking failed:", error);
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );
    };

    startLocationTracking();

    // Clean up watch and mark offline
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      const userRef = doc(db, 'users', currentUser.uid);
      updateDoc(userRef, { isOnline: false }).catch(() => {});
      const agentRef = doc(db, 'agents', currentUser.uid);
      updateDoc(agentRef, { lastSeen: 'Offline', isOnline: false }).catch(() => {});
      const bapAgentRef = doc(db, 'bap_agents', currentUser.uid);
      updateDoc(bapAgentRef, { lastSeen: 'Offline', isOnline: false }).catch(() => {});
    };
  }, [currentUser?.uid, currentUser?.role]);

  // Automatically register device ID if not already set on user document in Firestore
  useEffect(() => {
    if (currentUser && !currentUser.currentDeviceId && currentUser.uid) {
      const registerDevice = async () => {
        try {
          await updateDoc(doc(db, 'users', currentUser.uid), {
            currentDeviceId: deviceId
          });
        } catch (err) {
          console.error("Failed to automatically register device ID:", err);
        }
      };
      registerDevice();
    }
  }, [currentUser?.uid, currentUser?.currentDeviceId, deviceId]);

  // Real-time Device Status tracking (Online/Offline)
  useEffect(() => {
    if (!currentUser?.uid || isLocked) return;

    const setOnline = async () => {
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          deviceStatus: 'Online'
        });
      } catch (err) {
        console.error("Failed to update status to Online in Firestore:", err);
      }
    };
    setOnline();

    const setOffline = () => {
      if (currentUser?.uid) {
        updateDoc(doc(db, 'users', currentUser.uid), {
          deviceStatus: 'Offline'
        }).catch((err) => console.error("Failed to update status to Offline:", err));
      }
    };

    window.addEventListener('beforeunload', setOffline);
    return () => {
      window.removeEventListener('beforeunload', setOffline);
      setOffline();
    };
  }, [currentUser?.uid, isLocked]);

  // Periodic background location auto-update (Last Location System - Overwrites previous record)
  useEffect(() => {
    if (!currentUser?.uid || isLocked) return;

    const runLocationUpdate = async () => {
      try {
        const locRes = await syncUserLocationNow(currentUser.uid);
        localStorage.setItem('bnb_location_permission_granted', 'true');
        if (locRes && locRes.address) {
          setCurrentUser(prev => prev ? {
            ...prev,
            lastLocation: locRes.address,
            fullAddress: locRes.address,
            lastLoginIP: locRes.ip
          } : null);
        }
      } catch (err) {
        console.warn("Location update error:", err);
      }
    };

    runLocationUpdate();
    // Background timer to refresh location every 90 seconds
    const interval = setInterval(runLocationUpdate, 90000);
    return () => clearInterval(interval);
  }, [currentUser?.uid, isLocked]);

  // Handle caching of current user properties reactively to prevent any flicker/white screen on entry
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('bnb_user_phone', currentUser.phone || '');
      localStorage.setItem('bnb_user_uid', currentUser.uid || '');
      localStorage.setItem('bnb_user_name', currentUser.name || '');
      localStorage.setItem('bnb_user_role', currentUser.role || 'user');
      localStorage.setItem('bnb_user_member_id', currentUser.memberId || '');
      localStorage.setItem('bnb_user_balance', String(currentUser.balance || 0));
      localStorage.setItem('bnb_user_savings', String(currentUser.savings || 0));
      localStorage.setItem('bnb_user_telecom_balance', String(currentUser.telecomBalance || 0));
      localStorage.setItem('bnb_user_super_shop_balance', String(currentUser.superShopBalance || 0));
      localStorage.setItem('bnb_user_due_loan', String(currentUser.dueLoan || 0));
    } else {
      localStorage.removeItem('bnb_user_phone');
      localStorage.removeItem('bnb_user_uid');
      localStorage.removeItem('bnb_user_name');
      localStorage.removeItem('bnb_user_role');
      localStorage.removeItem('bnb_user_member_id');
      localStorage.removeItem('bnb_user_balance');
      localStorage.removeItem('bnb_user_savings');
      localStorage.removeItem('bnb_user_telecom_balance');
      localStorage.removeItem('bnb_user_super_shop_balance');
      localStorage.removeItem('bnb_user_due_loan');
    }
  }, [currentUser]);

  const handleLoginSuccess = async (userData: User) => {
    const finalUserData = await autoPromoteAndReturnUser(userData);
    setCurrentUser(finalUserData);
    setPreferRegister(false);
    localStorage.setItem('bnb_user_phone', finalUserData.phone);
    localStorage.setItem('bnb_user_uid', finalUserData.uid);
    if (finalUserData.isAppLocked) {
      setIsLocked(true);
    } else {
      setIsLocked(false);
    }
    const cleanPhone = finalUserData.phone?.replace(/\D/g, '') || '';
    const isAdminAccount = (finalUserData.role === 'admin' || finalUserData.uid === 'admin_master') && 
                           (cleanPhone.endsWith('00011112222') || cleanPhone.endsWith('11112222') || finalUserData.uid === 'admin_master');
    if (isAdminAccount) {
      localStorage.setItem('bnb_admin_mode', 'true');
      setAdminOpen(true);
    }
    // Trigger Location Permission Modal on fresh login
    sessionStorage.setItem('bnb_fresh_login_location_needed', 'true');
    setShowLocationModal(true);
  };

  const [isMandatoryLockOnLogout, setIsMandatoryLockOnLogout] = useState(false);
  const [isLoggingOutLock, setIsLoggingOutLock] = useState(false);
  const [logoutTargetToRegister, setLogoutTargetToRegister] = useState(false);

  const handleLogout = (toRegister = false) => {
    if (!currentUser) {
      handleDirectLogout(toRegister);
      return;
    }

    setLogoutTargetToRegister(toRegister);
    setIsMandatoryLockOnLogout(true);
    setShowSetLockModal(true);
    setDrawerOpen(false);
  };

  const handleDirectLogout = (toRegister = false) => {
    const uid = currentUser?.uid;
    const isOwnerDevice = !currentUser?.currentDeviceId || currentUser.currentDeviceId === deviceId;

    // 1. Immediately reset UI state and local storage for bullet-speed instant logout
    localStorage.removeItem('bnb_user_phone');
    localStorage.removeItem('bnb_user_uid');
    localStorage.removeItem('bnb_admin_mode');
    sessionStorage.removeItem('bnb_fresh_login_location_needed');
    
    setCurrentUser(null);
    setIsLocked(false);
    setIsLoggingOutLock(false);
    setIsMandatoryLockOnLogout(false);
    setAdminOpen(false);
    setActiveTab('home');
    setPreferRegister(toRegister);
    setShowLocationModal(false);

    // 2. Perform background cleanup non-blockingly if this device is the active device
    if (uid && isOwnerDevice) {
      updateDoc(doc(db, 'users', uid), {
        deviceStatus: 'Offline',
        isLoggedIn: false,
        currentDeviceId: '',
        deviceChangeRequested: false,
        deviceLockBypassed: false
      }).catch(err => console.error("Failed to update status on logout:", err));
    }
    if (auth.currentUser) {
      signOut(auth).catch(err => console.error("SignOut error:", err));
    }
  };

  const handleAdminPinAttempt = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');

    const cleanInput = convertBengaliToEnglishDigits(adminPinInput).trim();
    const userPinClean = currentUser?.pin ? convertBengaliToEnglishDigits(String(currentUser.pin)).trim() : '';

    const cleanPhone = currentUser?.phone?.replace(/\D/g, '') || '';
    const isSecretAdminPhone = 
      cleanPhone.endsWith('00011112222') ||
      cleanPhone.endsWith('11112222') ||
      currentUser?.phone === '+8800011112222' ||
      currentUser?.uid === 'admin_master';

    if (!isSecretAdminPhone) {
      setAdminError('অ্যাক্সেস সংরক্ষিত! অ্যাডমিন প্যানেল শুধুমাত্র অফিশিয়াল এডমিন নম্বর (+8800011112222) দিয়ে লগইনকৃত একাউন্টে অনুমোদিত।');
      setAdminPinInput('');
      setAdminBypassed(false);
      return;
    }

    // Valid PIN: strictly "6666" or custom appConfig.adminPin
    const isMasterPin = cleanInput === '6666' || 
                        (appConfig?.adminPin && cleanInput === convertBengaliToEnglishDigits(String(appConfig.adminPin)).trim());

    if (isMasterPin || (userPinClean && cleanInput === userPinClean)) {
      if (currentUser && currentUser.role !== 'admin') {
        try {
          await updateDoc(doc(db, 'users', currentUser.uid), { role: 'admin' });
        } catch (err) {
          console.error("Failed to promote user to admin in attempt:", err);
        }
        setCurrentUser(prev => prev ? { ...prev, role: 'admin' } : null);
      }
      localStorage.setItem('bnb_admin_mode', 'true');
      setAdminOpen(true);
      setShowAdminPinModal(false);
      setAdminPinInput('');
    } else {
      setAdminError('ভুল অ্যাডমিন সিকিউরিটি পিন! এডমিন প্যানেলে প্রবেশের জন্য সঠিক পিন (6666) দিন।');
      setAdminPinInput('');
      setAdminBypassed(false);
    }
  };

  const handleOpenAdmin = () => {
    const cleanPhone = currentUser?.phone?.replace(/\D/g, '') || '';
    const isSecretAdminPhone = 
      cleanPhone.endsWith('00011112222') ||
      cleanPhone.endsWith('11112222') ||
      currentUser?.phone === '+8800011112222' ||
      currentUser?.uid === 'admin_master';

    if (!isSecretAdminPhone) {
      alert('অ্যাক্সেস সংরক্ষিত! অ্যাডমিন প্যানেল শুধুমাত্র অফিশিয়াল এডমিন নম্বর (+8800011112222) দিয়ে লগইনকৃত একাউন্টে অনুমোদিত।');
      return;
    }

    localStorage.setItem('bnb_admin_mode', 'true');
    setAdminOpen(true);
  };



  const isDevOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'sub_admin';
  const isDeviceLocked = !!currentUser && 
    !!currentUser.currentDeviceId && 
    currentUser.currentDeviceId.trim() !== '' &&
    currentUser.currentDeviceId !== deviceId && 
    !currentUser.deviceLockBypassed && 
    currentUser.role !== 'admin';

  const showMaintenance = !!currentUser && !isLocked && appConfig.maintenanceMode && !adminBypassed && !isDevOrAdmin;
  const showUpdate = !!currentUser && !isLocked && !showMaintenance && appConfig.forceUpdateActive && !adminBypassed && !isDevOrAdmin && (() => {
    try {
      const cur = parseFloat(CURRENT_APP_VERSION);
      const min = parseFloat(appConfig.minAppVersion || "2.0");
      return cur < min;
    } catch (e) {
      return CURRENT_APP_VERSION !== (appConfig.minAppVersion || "2.0");
    }
  })();

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-800 antialiased selection:bg-emerald-100 selection:text-emerald-900 ${darkMode ? 'dark bg-slate-950 text-slate-100' : ''}`}>
      

      {showMaintenance ? (
        <MaintenanceScreen 
          appConfig={appConfig} 
          currentUser={currentUser} 
          onBypassAdmin={() => {
            setAdminBypassed(true);
            setShowAdminPinModal(true);
          }} 
        />
      ) : showUpdate ? (
        <ForceUpdateScreen 
          appConfig={appConfig} 
          currentUser={currentUser} 
          onBypassAdmin={() => {
            setAdminBypassed(true);
            setShowAdminPinModal(true);
          }} 
        />
      ) : (
        <>
          {/* Route Switch Control */}
          {isDeviceLocked ? (
            <div key="device-locked">
              <DeviceLockScreen 
                user={currentUser} 
                deviceId={deviceId} 
                onLogout={handleLogout} 
              />
            </div>
          ) : bapOpen && currentUser ? (
            <div key="bap-mode">
              <BapSystem 
                currentUser={currentUser} 
                onBack={() => setBapOpen(false)} 
                appLanguage={appLanguage}
                darkMode={darkMode}
              />
            </div>
          ) : adminOpen && currentUser ? (
            <div key="admin-mode">
              <AdminPanel 
                currentUser={currentUser} 
                onBack={() => {
                  setAdminOpen(false);
                }} 
                appConfig={appConfig}
                onChangeConfig={(newConfig) => {
                  setAppConfig(newConfig);
                  try {
                    localStorage.setItem('bnb_app_config', JSON.stringify(newConfig));
                  } catch (e) {
                    console.error("Failed to cache updated config", e);
                  }
                }}
                appLanguage={appLanguage}
                darkMode={darkMode}
                
              />
            </div>
          ) : currentUser && isLocked ? (
            <div key="locked-screen">
              <LockScreen 
                user={currentUser} 
                onUnlock={() => {
                  setIsLocked(false);
                  setIsLoggingOutLock(false);
                }} 
                onLogout={() => {
                  setIsLoggingOutLock(false);
                  handleDirectLogout();
                }} 
                isLogoutMode={isLoggingOutLock}
                onCancelLogout={() => {
                  setIsLocked(false);
                  setIsLoggingOutLock(false);
                }}
                appConfig={appConfig}
                appLanguage={appLanguage}
                onLanguageChange={handleLanguageChange}
                darkMode={darkMode}
              />
            </div>
          ) : currentUser ? (
            <div key="dashboard-mode" className="min-h-screen">
              <Dashboard 
                user={currentUser} 
                onLogout={handleLogout} 
                onOpenDrawer={() => setDrawerOpen(true)}
                onTriggerAdmin={handleOpenAdmin}
                onTriggerBap={() => setBapOpen(true)}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                selectedAction={selectedAction}
                setSelectedAction={setSelectedAction}
                appConfig={appConfig}
                onTriggerDemoAuth={() => setShowDemoAuthPrompt(true)}
                appLanguage={appLanguage}
                onLanguageChange={handleLanguageChange}
                darkMode={darkMode}
                onThemeToggle={handleThemeToggle}
              />

              {/* Slide drawer menu overlay */}
              <DrawerMenu 
                isOpen={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                user={currentUser}
                onLogout={handleLogout}
                onOpenAdmin={() => { setDrawerOpen(false); setTimeout(handleOpenAdmin, 150); }}
                onSelectTab={(tab) => { setActiveTab(tab); }}
                onSelectAction={(actionName) => setSelectedAction(actionName)}
                onTriggerDemoAuth={() => setShowDemoAuthPrompt(true)}
                onLock={() => {
                  if (currentUser?.isAppLocked) {
                    setIsLocked(true);
                  } else {
                    setShowSetLockModal(true);
                  }
                }}
                appLanguage={appLanguage}
                onLanguageChange={handleLanguageChange}
                darkMode={darkMode}
                onThemeToggle={handleThemeToggle}
                appConfig={appConfig}
              />

              {/* Custom Secret App Lock Setup Modal */}
              {currentUser && (
                <SetAppLockModal
                  isOpen={showSetLockModal}
                  onClose={() => {
                    setShowSetLockModal(false);
                    setIsMandatoryLockOnLogout(false);
                  }}
                  user={currentUser}
                  isMandatoryOnLogout={isMandatoryLockOnLogout}
                  onLockSuccess={(secretCode) => {
                    setCurrentUser(prev => prev ? { ...prev, isAppLocked: true, appLockCode: secretCode } : null);
                    setShowSetLockModal(false);
                    if (isMandatoryLockOnLogout) {
                      setIsMandatoryLockOnLogout(false);
                      handleDirectLogout();
                    } else {
                      setIsLocked(true);
                    }
                  }}
                  appLanguage={appLanguage}
                />
              )}
            </div>
          ) : (
            <div key="login-mode" className="bg-white min-h-screen">
              <LoginScreen 
                authUid={authUid} 
                onLoginSuccess={handleLoginSuccess} 
                initialRegistering={preferRegister}
                appConfig={appConfig}
                appLanguage={appLanguage}
                onLanguageChange={handleLanguageChange}
                darkMode={darkMode}
                onThemeToggle={handleThemeToggle}
              />
            </div>
          )}

          {/* Mandatory Logout uses SetAppLockModal directly with 2-step password confirmation */}

          {showAdminPinModal && (
            <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-55 p-4 backdrop-blur-xs font-sans text-slate-800">
              <div 
                className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-sm border border-slate-100"
              >
                <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-amber-450" />
                    <span className="font-bold text-sm">অ্যাডমিন এনরোলমেন্ট গেটওয়ে</span>
                  </div>
                  <button 
                    onClick={() => { setShowAdminPinModal(false); setAdminError(''); setAdminPinInput(''); setAdminBypassed(false); }}
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleAdminPinAttempt} className="p-6 space-y-4">
                  {adminError && (
                    <div className="bg-red-50 text-red-650 border border-red-100 p-3 rounded-2xl text-xs flex items-center gap-2 font-medium">
                      <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />
                      {adminError}
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-slate-550 leading-relaxed mb-3">
                      প্রবেশ করতে সিকিউরিটি পিন দিন। এডমিন প্যানেলের সিকিউরিটি পিন: <strong className="font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded leading-none text-xs">6666</strong> (এডমিন নম্বর: +8800011112222)
                    </p>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">৪ ডিজিটের সিকিউরিটি পিন</label>
                    <input
                      type="password"
                      required
                      maxLength={4}
                      value={adminPinInput}
                      onChange={(e) => {
                        const converted = convertBengaliToEnglishDigits(e.target.value);
                        setAdminPinInput(converted.replace(/\D/g, ''));
                      }}
                      placeholder="••••"
                      className="block w-full py-3 bg-slate-50 border border-slate-205 rounded-xl text-center text-xl font-mono tracking-widest text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                    />
                  </div>

                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => { setShowAdminPinModal(false); setAdminError(''); setAdminPinInput(''); setAdminBypassed(false); }}
                      className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      বাতিল
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1 shadow-md active:scale-98"
                    >
                      যাচাই করুন
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Authentic Demo Auth Prompt Modal for Demo users */}
          <AnimatePresence>
            {showDemoAuthPrompt && (
              <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 z-55 font-sans text-slate-800">
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 250 }}
                  className="bg-white rounded-3xl p-6 w-full max-w-sm border border-slate-100 shadow-2xl relative text-center overflow-hidden"
                >
                  {/* Decorative corner accent */}
                  <div className="absolute top-0 inset-x-0 h-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />
                  
                  {/* Shield Alert Icon */}
                  <div className="mx-auto w-14 h-14 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center mb-4.5 border border-emerald-100 shadow-3xs animate-bounce" style={{ animationDuration: '3s' }}>
                    <ShieldAlert className="w-8 h-8 text-emerald-700" />
                  </div>

                  <h3 className="text-base font-black text-slate-800 tracking-tight leading-snug">
                    অ্যাকাউন্ট ভেরিফিকেশন প্রয়োজন
                  </h3>
                  <p className="text-[10px] text-emerald-800 font-bold bg-emerald-50/60 px-2.5 py-0.5 rounded-full inline-block mt-1 mx-auto border border-emerald-100">
                    🔒 অ্যাকাউন্ট যাচাইকরণ সেশন
                  </p>

                  <p className="text-xs text-slate-550 font-medium leading-relaxed mt-4 mb-6">
                    সফটওয়্যারের এই লাইভ ফিচারটি বা সেকশনটি ব্যবহার করতে অনুগ্রহ করে একটি নতুন অ্যাকাউন্ট তৈরি করুন অথবা আগের অ্যাকাউন্ট থাকলে লগইন করুন।
                  </p>

                  <div className="space-y-2.5">
                    {/* Action 1: Create New Account */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowDemoAuthPrompt(false);
                        handleLogout(true); // logs out and redirects straight to Registration!
                      }}
                      className="w-full bg-emerald-850 hover:bg-emerald-900 active:bg-emerald-950 text-white font-extrabold py-3 px-4 rounded-xl text-xs transition-all shadow-md shadow-emerald-800/15 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                    >
                      🧑‍💻 নতুন অ্যাকাউন্ট তৈরি বা নিবন্ধন করুন
                    </button>

                    {/* Action 2: Login */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowDemoAuthPrompt(false);
                        handleLogout(false); // logs out and redirects straight to Log In!
                      }}
                      className="w-full bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 border border-slate-200 font-bold py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                    >
                      🔑 পূর্বের অ্যাকাউন্ট থেকে লগইন করুন
                    </button>

                    {/* Cancel */}
                    <button
                      type="button"
                      onClick={() => setShowDemoAuthPrompt(false)}
                      className="w-full py-2 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer mt-1"
                    >
                      ফিরে যান
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {currentUser && !isLocked && !showMaintenance && !showUpdate && (
            <NotificationPrompt appConfig={appConfig} userId={currentUser.uid} />
          )}

          {currentUser && showLocationModal && (
            <LocationPermissionModal
              userId={currentUser.uid}
              onClose={() => {
                sessionStorage.removeItem('bnb_fresh_login_location_needed');
                setShowLocationModal(false);
              }}
              onLocationUpdated={(locData) => {
                setCurrentUser(prev => prev ? {
                  ...prev,
                  lastLocation: locData.address,
                  fullAddress: locData.address,
                  lastLoginIP: locData.ip
                } : null);
              }}
            />
          )}

          {foregroundNotification && (
            <NotificationBanner 
              notification={foregroundNotification} 
              onClose={() => setForegroundNotification(null)} 
            />
          )}

          <AnimatePresence>
            {showExitToast && (
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-slate-900/95 text-white px-5 py-3 rounded-2xl text-xs font-bold shadow-xl border border-slate-800 backdrop-blur-md flex items-center gap-2.5 whitespace-nowrap select-none pointer-events-none"
              >
                <span>📱</span>
                <span>অ্যাপ থেকে বের হতে আবার ব্যাক চাপুন</span>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

    </div>
  );
}
