with open('src/App.tsx', 'r') as f:
    content = f.read()

target1 = """          if (targetOrigin && targetOrigin.startsWith('http') && typeof window !== 'undefined') {
            try {
              const currentHost = window.location.hostname;
              const targetUrl = new URL(targetOrigin);
              if (targetUrl.hostname !== currentHost && !currentHost.includes('localhost') && !targetUrl.hostname.includes('businessnetworkbangladesh.com')) {
                const newSearch = cleanSearch.replace(/[?&]origin=[^&]+/, '');
                const targetFull = `${targetOrigin.replace(/\\/$/, '')}/payment/result${newSearch ? (newSearch.startsWith('?') ? newSearch : `?${newSearch}`) : ''}`;
                window.location.replace(targetFull);
                return;
              }
            } catch (e) {}
          }"""

replacement1 = """          if (targetOrigin && targetOrigin.startsWith('http') && typeof window !== 'undefined') {
            try {
              const currentHost = window.location.hostname;
              const targetUrl = new URL(targetOrigin);
              if (targetUrl.hostname !== currentHost) {
                const newSearch = cleanSearch.replace(/[?&]origin=[^&]+/, '');
                const targetFull = `${targetOrigin.replace(/\\/$/, '')}/dashboard${newSearch ? (newSearch.startsWith('?') ? newSearch : `?${newSearch}`) : ''}`;
                window.location.replace(targetFull);
                return;
              }
            } catch (e) {}
          }"""

target2 = """    window.addEventListener('bnb_payment_completed_on_return', handlePaymentCompletedOnReturn);"""

replacement2 = """    window.addEventListener('bnb_payment_completed_on_return', handlePaymentCompletedOnReturn);

    // Global listener: 100% Guaranteed return to dashboard from payment or website back
    const handleForceReturnToDashboard = () => {
      try {
        localStorage.removeItem('amb_zinipay_redirect_active');
        localStorage.removeItem('amb_pending_zinipay_invoice');
      } catch (e) {}
      sessionStorage.setItem('amb_session_unlocked', 'true');
      setIsLocked(false);
      setShowSplash(false);
      setIsRestoringPaymentSession(false);
      setActiveTab('home');
      setTabHistory(['home']);
      setSelectedAction(null);
      setDrawerOpen(false);
      if (typeof window !== 'undefined') {
        try {
          window.history.replaceState({ amb_root: true }, '', '/dashboard');
        } catch (e) {}
      }
      try {
        window.dispatchEvent(new CustomEvent('bnb_reveal_dashboard_balance'));
      } catch (e) {}
    };
    window.addEventListener('bnb_force_return_to_dashboard', handleForceReturnToDashboard);"""

target3 = """    return () => {
      window.removeEventListener('bnb_payment_cancelled_or_failed', handleInAppPaymentCancelledOrFailed);
      window.removeEventListener('bnb_payment_completed_on_return', handlePaymentCompletedOnReturn);"""

replacement3 = """    return () => {
      window.removeEventListener('bnb_payment_cancelled_or_failed', handleInAppPaymentCancelledOrFailed);
      window.removeEventListener('bnb_payment_completed_on_return', handlePaymentCompletedOnReturn);
      window.removeEventListener('bnb_force_return_to_dashboard', handleForceReturnToDashboard);"""

target4 = """  // Fallback to permanent device-bound user backup if available
  try {
    const deviceBound = getDeviceBoundUser();
    if (deviceBound && !isCorruptedFallbackUser(deviceBound)) {
      const effectiveBal = getEffectiveBalance(deviceBound);
      return {
        ...deviceBound,
        balance: effectiveBal,
        mainBalance: effectiveBal
      };
    }
  } catch (e) {}"""

replacement4 = """  // Fallback to permanent device-bound user backup if available
  try {
    const deviceBound = getDeviceBoundUser();
    if (deviceBound && !isCorruptedFallbackUser(deviceBound)) {
      const effectiveBal = getEffectiveBalance(deviceBound);
      return {
        ...deviceBound,
        balance: effectiveBal,
        mainBalance: effectiveBal
      };
    }
  } catch (e) {}

  // Fallback to active payment cookie / URL query param on payment return
  try {
    let cookieUid = '';
    if (typeof document !== 'undefined') {
      const mUid = document.cookie.match(/(?:^|;\\s*)bnb_active_uid=([^;]*)/);
      if (mUid) cookieUid = decodeURIComponent(mUid[1]);
    }
    let queryUid = '';
    if (typeof window !== 'undefined' && window.location.search) {
      const sp = new URLSearchParams(window.location.search.replace(/\\?/g, '&'));
      queryUid = sp.get('uid') || '';
    }
    const resolvedUid = (!isFakeOrTemporaryUid(queryUid) ? queryUid : '') || (!isFakeOrTemporaryUid(cookieUid) ? cookieUid : '');
    if (resolvedUid) {
      const storedBal = Number(localStorage.getItem('amb_user_balance') || '0');
      const storedPhone = localStorage.getItem('amb_user_phone') || '';
      const storedName = localStorage.getItem('amb_user_name') || 'BNB Member';
      return {
        uid: resolvedUid,
        phone: storedPhone,
        name: storedName,
        role: 'user',
        memberId: localStorage.getItem('bnb_user_member_id') || 'BNB000000',
        balance: storedBal,
        mainBalance: storedBal
      } as User;
    }
  } catch (e) {}"""

print("Target 1 found:", target1 in content)
print("Target 2 found:", target2 in content)
print("Target 3 found:", target3 in content)
print("Target 4 found:", target4 in content)

if target1 in content and target2 in content and target3 in content and target4 in content:
    content = content.replace(target1, replacement1, 1)
    content = content.replace(target2, replacement2, 1)
    content = content.replace(target3, replacement3, 1)
    content = content.replace(target4, replacement4, 1)
    with open('src/App.tsx', 'w') as f:
        f.write(content)
    print("ALL TARGETS APPLIED SUCCESSFULLY")
else:
    print("FAILED TO APPLY ALL TARGETS")
