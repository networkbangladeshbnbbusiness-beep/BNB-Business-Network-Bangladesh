import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Compass, MapPin, ShieldCheck, Bell, Zap, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { syncUserLocationNow, fetchRealIpAndLocation } from '../lib/locationUtils';

interface LocationPermissionModalProps {
  userId: string;
  onClose: () => void;
  onLocationUpdated?: (locationData: { address: string; ip: string }) => void;
}

export const LocationPermissionModal: React.FC<LocationPermissionModalProps> = ({
  userId,
  onClose,
  onLocationUpdated
}) => {
  const [loading, setLoading] = useState(false);

  const handleTurnOn = () => {
    // Instantly close modal so user feels 0 delay
    onClose();

    // Perform location sync in background non-blockingly with real GPS & IP
    (async () => {
      try {
        const locResult = await syncUserLocationNow(userId);
        if (onLocationUpdated) {
          onLocationUpdated({ address: locResult.address, ip: locResult.ip });
        }
      } catch (err) {
        console.error("Location sync error:", err);
      }
    })();
  };

  const handleDecline = () => {
    // Instantly close modal
    onClose();

    // Record network IP location baseline in background without hardcoded fake coords
    (async () => {
      try {
        const ipData = await fetchRealIpAndLocation();
        const formattedTime = new Date().toLocaleString('bn-BD', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });

        await updateDoc(doc(db, 'users', userId), {
          latitude: ipData.lat,
          longitude: ipData.lng,
          lat: ipData.lat,
          lng: ipData.lng,
          realLat: ipData.lat,
          realLng: ipData.lng,
          fullAddress: ipData.address,
          lastLocation: ipData.address,
          lastLoginIP: ipData.ip,
          locationLastUpdated: formattedTime,
          deviceStatus: 'Online'
        }).catch(() => {});

        if (onLocationUpdated) {
          onLocationUpdated({ address: ipData.address, ip: ipData.ip });
        }
      } catch (err) {
        console.error("Background IP location update error:", err);
      }
    })();
  };

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col bg-slate-900/60 backdrop-blur-sm">
      <div className="h-10 shrink-0 bg-[#004a2c] w-full"></div>
      
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="flex-1 bg-white rounded-t-[32px] flex flex-col overflow-hidden font-sans"
      >
        <div className="bg-[#004a2c] text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Compass className="w-6 h-6 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-black leading-tight">লোকেশন ও নোটিফিকেশন</h3>
              <p className="text-[10px] text-emerald-100/70 font-medium tracking-wider uppercase">Location Accuracy System</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-900 leading-tight">
              অধিকতর নির্ভুল অভিজ্ঞতার জন্য লোকেশন অন করুন
            </h3>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">
              For a better experience, your device will need to use Location Accuracy and live notifications.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-black text-emerald-800 uppercase tracking-widest bg-emerald-50 px-3 py-1.5 rounded-lg inline-block">
              প্রয়োজনীয় পারমিশনসমূহ:
            </h4>

            <div className="space-y-3">
              {/* Item 1 */}
              <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 p-4 rounded-2xl transition hover:border-emerald-200">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                  <MapPin className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h5 className="text-sm font-black text-slate-900">
                    Device location (ডিভাইস লোকেশন)
                  </h5>
                  <p className="text-[11px] text-slate-500 font-medium leading-normal mt-0.5">
                    নিকটস্থ এজেন্ট, পয়েন্ট, রেশন শপ ও কুরিয়ার হাব প্রদর্শন করার জন্য।
                  </p>
                </div>
              </div>

              {/* Item 2 */}
              <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 p-4 rounded-2xl transition hover:border-emerald-200">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h5 className="text-sm font-black text-slate-900">
                    Location Accuracy & Security (নিরাপদ লেনদেন)
                  </h5>
                  <p className="text-[11px] text-slate-500 font-medium leading-normal mt-0.5">
                    Google sensor ও জিপিএস দিয়ে ভেরিফাইড ও নিরাপদ লেনদেন নিশ্চিতকরণ।
                  </p>
                </div>
              </div>

              {/* Item 3 */}
              <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 p-4 rounded-2xl transition hover:border-emerald-200">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                  <Bell className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h5 className="text-sm font-black text-slate-900">
                    Live Alerts (ইনস্ট্যান্ট অ্যালার্ট নোটিফিকেশন)
                  </h5>
                  <p className="text-[11px] text-slate-500 font-medium leading-normal mt-0.5">
                    ক্যাশইন, ক্যাশআউট, ঋণ ও ডিপোজিটের তাৎক্ষণিক লাইভ মেসেজ।
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <p className="text-[11px] text-amber-800 font-bold leading-relaxed">
              <span className="mr-1">💡</span>
              You can change this at any time in location settings. (যেকোনো সময় ডিভাইস সেটিংস থেকে পরিবর্তন করা যাবে।)
            </p>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={handleDecline}
            className="bg-white hover:bg-slate-100 text-slate-600 text-sm font-black py-4 px-4 rounded-2xl border border-slate-200 transition-all active:scale-95 cursor-pointer text-center"
          >
            No, thanks (পরে করুন)
          </button>
          
          <button
            type="button"
            onClick={handleTurnOn}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black py-4 px-4 rounded-2xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-white" />
            <span>Turn on (অনুমতি দিন)</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
