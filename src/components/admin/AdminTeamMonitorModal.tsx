import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  ShieldAlert,
  Ban,
  CheckCircle2,
  X,
  Search,
  Clock,
  Smartphone,
  Users,
  Activity,
  LogOut,
  UserPlus,
  Copy,
  Unlock,
  Crown,
  ExternalLink
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { AdminSessionRecord, User } from '../../types';
import {
  banAdminAccount,
  isAdminAccountRole,
  isSessionCurrentlyOnline,
  isSuperAdminUser,
  isUserAdminCurrentlyOnline,
  kickAdminSession,
  unbanAdminAccount
} from '../../lib/adminAccessControl';
import { getAdminPortalUrl } from '../../config/api';

interface AdminTeamMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  users: User[];
  adminSessions: AdminSessionRecord[];
  onEditUser?: (u: User) => void;
  requestAlert: (title: string, msg: string) => void;
  requestConfirm: (
    title: string,
    msg: string,
    onConfirm: () => void | Promise<void>,
    onCancel?: () => void
  ) => void;
}

const formatDateTimeBn = (iso?: string) => {
  if (!iso) return 'তথ্য নেই';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('bn-BD', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
};

export default function AdminTeamMonitorModal({
  isOpen,
  onClose,
  currentUser,
  users,
  adminSessions,
  onEditUser,
  requestAlert,
  requestConfirm
}: AdminTeamMonitorModalProps) {
  const [activeTab, setActiveTab] = useState<'admins' | 'sessions' | 'banned'>('admins');
  const [searchQuery, setSearchQuery] = useState('');
  const [banTarget, setBanTarget] = useState<User | null>(null);
  const [banReason, setBanReason] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [promoteQuery, setPromoteQuery] = useState('');
  const [promoteRole, setPromoteRole] = useState<'sub_admin' | 'admin'>('sub_admin');

  const adminUsers = useMemo(() => {
    const list = users.filter((u) => isAdminAccountRole(u) && !u.isAdminBanned);
    // Ensure current Super Admin is always visible even if admin_master isn't in users snapshot yet
    if (isSuperAdminUser(currentUser) && !list.some((u) => u.uid === currentUser.uid)) {
      list.unshift(currentUser);
    }
    return list.sort((a, b) => {
      if (isSuperAdminUser(a) && !isSuperAdminUser(b)) return -1;
      if (!isSuperAdminUser(a) && isSuperAdminUser(b)) return 1;
      const aOnline = isUserAdminCurrentlyOnline(a, adminSessions) ? 1 : 0;
      const bOnline = isUserAdminCurrentlyOnline(b, adminSessions) ? 1 : 0;
      return bOnline - aOnline;
    });
  }, [users, currentUser, adminSessions]);

  const bannedAdmins = useMemo(() => {
    return users
      .filter((u) => u.isAdminBanned === true)
      .sort((a, b) => new Date(b.adminBannedAt || 0).getTime() - new Date(a.adminBannedAt || 0).getTime());
  }, [users]);

  const sortedSessions = useMemo(() => {
    return [...adminSessions].sort((a, b) => {
      const aOn = isSessionCurrentlyOnline(a) ? 1 : 0;
      const bOn = isSessionCurrentlyOnline(b) ? 1 : 0;
      if (aOn !== bOn) return bOn - aOn;
      return new Date(b.loginAt || 0).getTime() - new Date(a.loginAt || 0).getTime();
    });
  }, [adminSessions]);

  const onlineAdminUids = useMemo(() => {
    const set = new Set<string>();
    adminUsers.forEach((u) => {
      if (isUserAdminCurrentlyOnline(u, adminSessions)) set.add(u.uid);
    });
    return set;
  }, [adminUsers, adminSessions]);

  const filteredAdmins = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return adminUsers;
    return adminUsers.filter(
      (u) =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.phone || '').toLowerCase().includes(q) ||
        (u.memberId || '').toLowerCase().includes(q)
    );
  }, [adminUsers, searchQuery]);

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedSessions;
    return sortedSessions.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q) ||
        (s.memberId || '').toLowerCase().includes(q) ||
        (s.deviceInfo || '').toLowerCase().includes(q)
    );
  }, [sortedSessions, searchQuery]);

  const filteredBanned = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return bannedAdmins;
    return bannedAdmins.filter(
      (u) =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.phone || '').toLowerCase().includes(q) ||
        (u.memberId || '').toLowerCase().includes(q)
    );
  }, [bannedAdmins, searchQuery]);

  const promoteCandidates = useMemo(() => {
    const q = promoteQuery.trim().toLowerCase();
    if (q.length < 3) return [];
    return users
      .filter(
        (u) =>
          !isAdminAccountRole(u) &&
          !u.isAdminBanned &&
          ((u.name || '').toLowerCase().includes(q) ||
            (u.phone || '').toLowerCase().includes(q) ||
            (u.memberId || '').toLowerCase().includes(q))
      )
      .slice(0, 5);
  }, [users, promoteQuery]);

  const adminDirectLink = getAdminPortalUrl();

  if (!isOpen) return null;

  const handleConfirmBan = async () => {
    if (!banTarget) return;
    setProcessingId(banTarget.uid);
    try {
      await banAdminAccount(banTarget, currentUser, banReason);
      const targetName = banTarget.name || banTarget.phone;
      setBanTarget(null);
      setBanReason('');
      requestAlert(
        '⛔ এডমিন আইডি স্থায়ীভাবে ব্যান করা হয়েছে',
        `${targetName}-এর এডমিন অ্যাক্সেস স্থায়ীভাবে বন্ধ করা হয়েছে এবং চলমান সকল সেশন সাথে সাথে লগআউট করে দেওয়া হয়েছে।`
      );
    } catch (err: any) {
      requestAlert('ত্রুটি', err?.message || 'ব্যান করতে সমস্যা হয়েছে।');
    } finally {
      setProcessingId(null);
    }
  };

  const handleUnban = (u: User) => {
    const restoreRole: 'admin' | 'sub_admin' =
      u.previousAdminRole === 'admin' ? 'admin' : 'sub_admin';
    requestConfirm(
      '🔓 ব্যান প্রত্যাহার করবেন?',
      `আপনি কি "${u.name}" (${u.phone}) এর ওপর থেকে এডমিন ব্যান তুলে দিয়ে পুনরায় ${restoreRole === 'admin' ? 'এডমিন' : 'সাব-এডমিন'} অ্যাক্সেস দিতে চান?`,
      async () => {
        setProcessingId(u.uid);
        try {
          await unbanAdminAccount(u, restoreRole);
          requestAlert('✅ আনব্যান সম্পন্ন', `${u.name}-এর এডমিন অ্যাক্সেস পুনরায় চালু হয়েছে।`);
        } catch (err: any) {
          requestAlert('ত্রুটি', err?.message || 'আনব্যান করতে সমস্যা হয়েছে।');
        } finally {
          setProcessingId(null);
        }
      }
    );
  };

  const handlePromoteMember = (member: User) => {
    requestConfirm(
      'নতুন এডমিন নিয়োগ',
      `"${member.name}" (${member.phone || member.memberId}) কে কি ${promoteRole === 'admin' ? 'এডমিন (Admin)' : 'সাব-এডমিন (Sub-Admin)'} হিসেবে যুক্ত করতে চান?`,
      async () => {
        setProcessingId(member.uid);
        try {
          await updateDoc(doc(db, 'users', member.uid), {
            role: promoteRole,
            isAdminBanned: false,
            subAdminPermissions:
              promoteRole === 'sub_admin'
                ? member.subAdminPermissions && member.subAdminPermissions.length > 0
                  ? member.subAdminPermissions
                  : ['samity', 'telecom', 'shop', 'qard', 'agent']
                : []
          });
          setPromoteQuery('');
          requestAlert('✅ এডমিন যুক্ত হয়েছে', `${member.name} এখন ${promoteRole === 'admin' ? 'এডমিন' : 'সাব-এডমিন'} হিসেবে /admin লিংক থেকে প্রবেশ করতে পারবেন।`);
        } catch (err: any) {
          requestAlert('ত্রুটি', err?.message || 'আপডেট করা যায়নি।');
        } finally {
          setProcessingId(null);
        }
      }
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex flex-col bg-slate-950/75 backdrop-blur-sm">
        <div className="min-h-8 pt-safe shrink-0 bg-[#004a2c] w-full" />

        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 220 }}
          className="flex-1 bg-slate-50 rounded-t-[28px] flex flex-col overflow-hidden font-sans text-slate-900"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#004a2c] via-[#006837] to-slate-900 text-white px-5 py-4 flex items-center justify-between gap-3 shrink-0 shadow-md">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5 text-amber-300" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-black text-white truncate">
                  সুপার এডমিন কন্ট্রোল ও লগইন মনিটর
                </h3>
                <p className="text-[10px] sm:text-xs text-emerald-100/80 font-bold truncate">
                  কে কে এডমিন প্যানেলে লগইন করেছে দেখুন ও যেকোনো এডমিন আইডি ব্যান করুন
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Dedicated /admin Link Box */}
            <div className="bg-gradient-to-r from-emerald-950 to-slate-900 text-white rounded-2xl p-3.5 sm:p-4 border border-emerald-500/30 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-300">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>সরাসরি এডমিন প্যানেল লিংক (শুধু এডমিনদের জন্য)</span>
                </div>
                <p className="text-xs font-mono text-emerald-200 truncate">{adminDirectLink}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      navigator.clipboard.writeText(adminDirectLink);
                      requestAlert('✅ লিংক কপি হয়েছে', `সরাসরি এডমিন লিংক কপি করা হয়েছে:\n${adminDirectLink}`);
                    } catch {
                      requestAlert('এডমিন লিংক', adminDirectLink);
                    }
                  }}
                  className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition active:scale-95"
                >
                  <Copy className="w-3.5 h-3.5" />
                  লিংক কপি
                </button>
                <a
                  href="/admin"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  খুলুন
                </a>
              </div>
            </div>

            {/* 4 Live Summary Boxes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs">
                <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-500">
                  <span>মোট এডমিন</span>
                  <Users className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-xl font-black text-slate-900 mt-1 font-mono">
                  {adminUsers.length} জন
                </div>
                <div className="text-[9.5px] font-bold text-slate-400">সুপার + এডমিন + সাব-এডমিন</div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 shadow-2xs">
                <div className="flex items-center justify-between text-[10px] font-extrabold text-emerald-800">
                  <span>এখন লগইন আছে</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                </div>
                <div className="text-xl font-black text-emerald-950 mt-1 font-mono">
                  {onlineAdminUids.size} জন
                </div>
                <div className="text-[9.5px] font-bold text-emerald-700">লাইভ এডমিন প্যানেলে সক্রিয়</div>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 shadow-2xs">
                <div className="flex items-center justify-between text-[10px] font-extrabold text-indigo-800">
                  <span>মোট লগইন সেশন</span>
                  <Activity className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-xl font-black text-indigo-950 mt-1 font-mono">
                  {sortedSessions.length} বার
                </div>
                <div className="text-[9.5px] font-bold text-indigo-700">এডমিন প্রবেশের রেকর্ড</div>
              </div>

              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 shadow-2xs">
                <div className="flex items-center justify-between text-[10px] font-extrabold text-rose-800">
                  <span>ব্যানকৃত এডমিন</span>
                  <Ban className="w-4 h-4 text-rose-600" />
                </div>
                <div className="text-xl font-black text-rose-950 mt-1 font-mono">
                  {bannedAdmins.length} জন
                </div>
                <div className="text-[9.5px] font-bold text-rose-700">কখনোই ঢুকতে পারবে না</div>
              </div>
            </div>

            {/* Tabs & Search */}
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
              <div className="grid grid-cols-3 gap-1.5 bg-slate-200/80 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('admins')}
                  className={`px-3 py-2 rounded-lg text-[11px] font-black transition cursor-pointer ${
                    activeTab === 'admins'
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-white/60'
                  }`}
                >
                  👥 এডমিন ({adminUsers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('sessions')}
                  className={`px-3 py-2 rounded-lg text-[11px] font-black transition cursor-pointer ${
                    activeTab === 'sessions'
                      ? 'bg-indigo-700 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-white/60'
                  }`}
                >
                  📜 লগইন লগ ({sortedSessions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('banned')}
                  className={`px-3 py-2 rounded-lg text-[11px] font-black transition cursor-pointer ${
                    activeTab === 'banned'
                      ? 'bg-rose-700 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-white/60'
                  }`}
                >
                  ⛔ ব্যান ({bannedAdmins.length})
                </button>
              </div>

              <div className="relative flex-1 sm:max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="নাম, মোবাইল বা আইডি খুঁজুন..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            {/* TAB 1: Active Admins & Ban Controls */}
            {activeTab === 'admins' && (
              <div className="space-y-3">
                {/* Quick Promote Member to Admin/Sub-Admin */}
                <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                      <UserPlus className="w-4 h-4 text-emerald-600" />
                      <span>নতুন এডমিন / সাব-এডমিন যুক্ত করুন</span>
                    </div>
                    <select
                      value={promoteRole}
                      onChange={(e) => setPromoteRole(e.target.value as 'sub_admin' | 'admin')}
                      className="text-[11px] font-black bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1 cursor-pointer"
                    >
                      <option value="sub_admin">🛡️ সাব-এডমিন (Sub-Admin)</option>
                      <option value="admin">🔰 এডমিন (Admin)</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    value={promoteQuery}
                    onChange={(e) => setPromoteQuery(e.target.value)}
                    placeholder="সদস্যের মোবাইল নম্বর, মেম্বার আইডি বা নাম লিখুন..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600"
                  />
                  {promoteCandidates.length > 0 && (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                      {promoteCandidates.map((cand) => (
                        <div key={cand.uid} className="p-2.5 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-900 truncate">{cand.name}</p>
                            <p className="text-[10px] font-mono text-slate-500 truncate">
                              {cand.phone} • {cand.memberId || cand.uid}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={processingId === cand.uid}
                            onClick={() => handlePromoteMember(cand)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] rounded-lg cursor-pointer shrink-0"
                          >
                            + যুক্ত করুন
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Admin Cards List */}
                <div className="space-y-2.5">
                  {filteredAdmins.map((admin) => {
                    const isSuper = isSuperAdminUser(admin);
                    const isOnline = isUserAdminCurrentlyOnline(admin, adminSessions);
                    const activeSessionsForUser = adminSessions.filter(
                      (s) => s.uid === admin.uid && isSessionCurrentlyOnline(s)
                    );
                    const latestSession = adminSessions
                      .filter((s) => s.uid === admin.uid)
                      .sort((a, b) => new Date(b.loginAt || 0).getTime() - new Date(a.loginAt || 0).getTime())[0];

                    return (
                      <div
                        key={admin.uid}
                        className={`bg-white border rounded-2xl p-3.5 shadow-2xs space-y-2.5 ${
                          isOnline ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                                isSuper
                                  ? 'bg-amber-400 text-slate-950'
                                  : isOnline
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {isSuper ? <Crown className="w-5 h-5" /> : (admin.name || 'A').charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                                  {admin.name || 'BNB Admin'}
                                </h4>
                                <span
                                  className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                                    isSuper
                                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                      : admin.role === 'sub_admin'
                                        ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                        : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                                  }`}
                                >
                                  {isSuper
                                    ? '👑 সুপার এডমিন (মেইন)'
                                    : admin.role === 'sub_admin'
                                      ? '🛡️ সাব-এডমিন'
                                      : '🔰 এডমিন'}
                                </span>
                                <span
                                  className={`text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                    isOnline
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                                    }`}
                                  />
                                  {isOnline ? 'এখন অনলাইনে আছেন' : 'অফলাইন'}
                                </span>
                              </div>
                              <p className="text-[11px] font-mono text-slate-600 mt-0.5">
                                📞 {admin.phone || 'N/A'} • ID: {admin.memberId || admin.uid}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50 border border-slate-100 rounded-xl p-2 text-[10px]">
                          <div>
                            <span className="text-slate-400 font-bold block">সর্বশেষ লগইন:</span>
                            <span className="font-black text-slate-700">
                              {formatDateTimeBn(admin.lastAdminLoginAt || latestSession?.loginAt)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-bold block">ডিভাইস / ব্রাউজার:</span>
                            <span className="font-black text-slate-700">
                              {latestSession?.deviceInfo || 'Web / App'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-bold block">মোট লগইন:</span>
                            <span className="font-black text-emerald-700 font-mono">
                              {admin.adminLoginCount ||
                                adminSessions.filter((s) => s.uid === admin.uid).length ||
                                (isOnline ? 1 : 0)}{' '}
                              বার
                            </span>
                          </div>
                        </div>

                        {/* Actions (Protected for Super Admin) */}
                        <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                          {isSuper ? (
                            <span className="text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                              🛡️ মেইন সুপার এডমিন আইডি সম্পূর্ণ সুরক্ষিত (ব্যান করা যাবে না)
                            </span>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap w-full justify-end">
                              {onEditUser && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onEditUser(admin);
                                  }}
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-[10px] rounded-xl cursor-pointer transition"
                                >
                                  ✏️ পারমিশন এডিট
                                </button>
                              )}
                              {activeSessionsForUser.length > 0 && (
                                <button
                                  type="button"
                                  disabled={processingId === admin.uid}
                                  onClick={() => {
                                    requestConfirm(
                                      'সেশন লগআউট করাবেন?',
                                      `"${admin.name}" কে এখনি এডমিন প্যানেল থেকে বের করে দিতে চান?`,
                                      async () => {
                                        setProcessingId(admin.uid);
                                        try {
                                          await Promise.all(
                                            activeSessionsForUser.map((s) =>
                                              kickAdminSession(s.sessionId || s.id, admin.uid, currentUser)
                                            )
                                          );
                                          requestAlert('✅ সেশন বন্ধ', `${admin.name} কে এডমিন প্যানেল থেকে লগআউট করা হয়েছে।`);
                                        } finally {
                                          setProcessingId(null);
                                        }
                                      }
                                    );
                                  }}
                                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] rounded-xl flex items-center gap-1 cursor-pointer transition"
                                >
                                  <LogOut className="w-3 h-3" />
                                  লগআউট করান
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={processingId === admin.uid}
                                onClick={() => {
                                  setBanTarget(admin);
                                  setBanReason('');
                                }}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] rounded-xl flex items-center gap-1 cursor-pointer shadow-sm transition active:scale-95"
                              >
                                <Ban className="w-3 h-3" />
                                স্থায়ীভাবে ব্যান করুন
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: Real-Time Login History */}
            {activeTab === 'sessions' && (
              <div className="space-y-2">
                {filteredSessions.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 text-xs font-bold">
                    এখনও কোনো এডমিন লগইন সেশন রেকর্ড পাওয়া যায়নি।
                  </div>
                ) : (
                  filteredSessions.map((sess) => {
                    const liveNow = isSessionCurrentlyOnline(sess);
                    const matchedUser = users.find((u) => u.uid === sess.uid);
                    const isBannedNow = Boolean(matchedUser?.isAdminBanned || sess.status === 'banned_kicked');

                    return (
                      <div
                        key={sess.id}
                        className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black text-slate-900">{sess.name}</span>
                            <span className="text-[9px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                              {sess.phone || sess.memberId}
                            </span>
                            {isBannedNow ? (
                              <span className="text-[9px] font-black bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                                ⛔ ব্যান ও ব্লকড
                              </span>
                            ) : liveNow ? (
                              <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                এখন প্যানেলে আছেন
                              </span>
                            ) : sess.status === 'kicked' ? (
                              <span className="text-[9px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                                🔌 কিকড আউট
                              </span>
                            ) : (
                              <span className="text-[9px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                ⚪ লগআউট
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap text-[10px] text-slate-500 font-bold">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              লগইন: {formatDateTimeBn(sess.loginAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Smartphone className="w-3 h-3 text-slate-400" />
                              {sess.deviceInfo || 'Web'}
                            </span>
                          </div>
                        </div>

                        {!isSuperAdminUser(matchedUser || ({ uid: sess.uid, phone: sess.phone } as User)) &&
                          !isBannedNow &&
                          matchedUser && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              {liveNow && (
                                <button
                                  type="button"
                                  onClick={() => kickAdminSession(sess.sessionId || sess.id, sess.uid, currentUser)}
                                  className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] rounded-xl cursor-pointer"
                                >
                                  লগআউট
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setBanTarget(matchedUser);
                                  setBanReason('');
                                }}
                                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] rounded-xl cursor-pointer flex items-center gap-1"
                              >
                                <Ban className="w-3 h-3" />
                                ব্যান
                              </button>
                            </div>
                          )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB 3: Permanently Banned Admins */}
            {activeTab === 'banned' && (
              <div className="space-y-2.5">
                {filteredBanned.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-1.5">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                    <p className="text-xs font-black text-slate-700">কোনো ব্যানকৃত এডমিন আইডি নেই</p>
                    <p className="text-[10.5px] font-bold text-slate-400">
                      এখান থেকে ব্যান করা যেকোনো আইডি আর কখনোই এডমিন প্যানেলে প্রবেশ করতে পারবে না।
                    </p>
                  </div>
                ) : (
                  filteredBanned.map((bannedUser) => (
                    <div
                      key={bannedUser.uid}
                      className="bg-rose-50/70 border border-rose-200 rounded-2xl p-3.5 space-y-2 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <ShieldAlert className="w-4 h-4 text-rose-600" />
                            <h4 className="text-xs sm:text-sm font-black text-rose-950">
                              {bannedUser.name}
                            </h4>
                            <span className="text-[9px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-full">
                              ⛔ স্থায়ীভাবে ব্যানড
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-rose-800 mt-0.5">
                            📞 {bannedUser.phone} • ID: {bannedUser.memberId || bannedUser.uid}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={processingId === bannedUser.uid}
                          onClick={() => handleUnban(bannedUser)}
                          className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-black text-[10px] rounded-xl flex items-center gap-1 cursor-pointer shrink-0 transition"
                        >
                          <Unlock className="w-3 h-3" />
                          আনব্যান করুন
                        </button>
                      </div>
                      <div className="text-[10px] font-bold text-rose-800 bg-white/70 border border-rose-100 rounded-xl p-2 space-y-0.5">
                        <p>কারণ: {bannedUser.adminBanReason || 'সুপার এডমিন কর্তৃক এডমিন অ্যাক্সেস বাতিল'}</p>
                        <p className="text-rose-600">
                          ব্যান সময়: {formatDateTimeBn(bannedUser.adminBannedAt)} • ব্যানকারী: {bannedUser.adminBannedBy || 'Super Admin'}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Confirm Permanent Ban Sub-Modal */}
        {banTarget && (
          <div className="fixed inset-0 z-[100000] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-rose-200 overflow-hidden font-sans text-slate-900">
              <div className="bg-rose-600 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ban className="w-5 h-5" />
                  <h4 className="text-sm font-black">এডমিন আইডি স্থায়ী ব্যান নিশ্চিত করুন</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setBanTarget(null)}
                  className="p-1 bg-white/15 hover:bg-white/25 rounded-full cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-xs space-y-1">
                  <p className="font-black text-rose-950">{banTarget.name}</p>
                  <p className="font-mono text-rose-800">
                    {banTarget.phone} • {banTarget.memberId || banTarget.uid}
                  </p>
                  <p className="text-[10.5px] font-bold text-rose-700 pt-1">
                    ব্যান করলে এই আইডি দিয়ে এডমিন প্যানেলে আর কখনোই লগইন বা প্রবেশ করা যাবে না এবং চালু সেশন তাৎক্ষণিক বন্ধ হয়ে যাবে।
                  </p>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">
                    ব্যান করার কারণ (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="যেমন: অননুমোদিত প্রবেশ বা দায়িত্ব থেকে অব্যাহতি"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setBanTarget(null)}
                    className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs rounded-xl cursor-pointer"
                  >
                    বাতিল
                  </button>
                  <button
                    type="button"
                    disabled={processingId === banTarget.uid}
                    onClick={handleConfirmBan}
                    className="py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl cursor-pointer shadow-md"
                  >
                    {processingId === banTarget.uid ? 'ব্যান হচ্ছে...' : '⛔ স্থায়ী ব্যান করুন'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AnimatePresence>
  );
}
