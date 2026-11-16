export type SamityTierKey = 'owner' | 'shareholder' | 'investor' | 'supporter' | 'regular';

export function hasCompletedSamityFormAndRegistration(u: any): boolean {
  if (!u) return false;
  if (u.samityStatus === 'rejected') return false;

  const hasRegistrationApproval = Boolean(
    u.samityApproved === true ||
    u.samityStatus === 'approved' ||
    u.isSamityMember === true
  );

  const hasPaidInstallments = Boolean(
    (Number(u.savings) || 0) > 0 ||
    (Number(u.dpsBalance) || 0) > 0 ||
    (Array.isArray(u.samityPaidMonths) && u.samityPaidMonths.length > 0)
  );

  // Pending applicants without prior approval or paid installments stay in Pending/General until approved
  if (u.samityStatus === 'pending' && !hasRegistrationApproval && !hasPaidInstallments) {
    return false;
  }

  // Must have completed Samity registration/approval OR have active monthly Samity savings/paid months
  return hasRegistrationApproval || hasPaidInstallments;
}

export function getSamityMonthlyRate(u: any): number {
  if (!u) return 0;
  const cat = String(u.memberCategory || u.samityRole || u.memberGroup || '').toLowerCase().trim();
  const rawRate = Number(u.monthlySavingsTarget) || 0;

  if (cat === 'owner' || rawRate >= 5000) return 5000;
  if (cat === 'shareholder' || rawRate >= 3000) return 3000;
  if (cat === 'investor' || rawRate >= 2000) return 2000;
  if (cat === 'supporter' || rawRate >= 1000) return 1000;
  return rawRate > 0 ? rawRate : 0;
}

/**
 * Strictly classifies a user into one of the 4 Samity Investor tiers
 * (owner = 5000/mo, shareholder = 3000/mo, investor = 2000/mo, supporter = 1000/mo)
 * ONLY if they have completed Samity form & registration or actively pay monthly Samity savings.
 * Anyone without completed Samity registration/monthly savings is strictly 'regular' (সাধারণ সদস্য).
 */
export function getSamityMemberTier(u: any): SamityTierKey {
  if (!hasCompletedSamityFormAndRegistration(u)) {
    return 'regular';
  }

  const cat = String(u.memberCategory || u.samityRole || u.memberGroup || '').toLowerCase().trim();
  const rate = Number(u.monthlySavingsTarget) || 0;
  const hasPaidInstallments = Boolean(
    (Number(u.savings) || 0) > 0 ||
    (Number(u.dpsBalance) || 0) > 0 ||
    (Array.isArray(u.samityPaidMonths) && u.samityPaidMonths.length > 0)
  );

  // Explicit regular/general user who hasn't actually paid monthly Samity installments
  if ((cat === 'regular' || cat === 'general') && !hasPaidInstallments) {
    return 'regular';
  }

  // Tier priority by explicit Samity category or monthly payment amount
  if (cat === 'owner' || rate >= 5000) return 'owner';
  if (cat === 'shareholder' || rate >= 3000) return 'shareholder';
  if (cat === 'investor' || rate >= 2000) return 'investor';
  if (cat === 'supporter' || rate >= 1000) return 'supporter';

  // If approved/paying member with legacy 500 rate or unspecified rate and actual savings > 0 -> supporter, else regular
  return hasPaidInstallments ? 'supporter' : 'regular';
}

export function isRegisteredSamityInvestor(u: any): boolean {
  return getSamityMemberTier(u) !== 'regular';
}

export function isSamitySwitchOff(u: any): boolean {
  if (!u) return false;
  return Boolean(
    u.samityAutoSavingsActive === false ||
    u.samityDeactivateStatus === 'self_opted_out' ||
    u.samitySwitchStatus === 'OFF'
  );
}

export function isSamitySwitchOn(u: any): boolean {
  if (!u) return false;
  return Boolean(
    (u.samityAutoSavingsActive === true || u.samitySwitchStatus === 'ON' || u.samityDeactivateStatus === 'active') &&
    isRegisteredSamityInvestor(u) &&
    !isSamitySwitchOff(u)
  );
}
