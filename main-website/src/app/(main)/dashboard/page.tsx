"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Box, 
  History, 
  PlusCircle, 
  ArrowRight, 
  Unlock, 
  Coins, 
  Clock, 
  Wallet,
  ShieldCheck,
  Loader2,
  Trash2,
  Lock as LockIcon
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useLockerStore } from '@/store/useLockerStore';
import { db, rtdb } from '@/lib/firebase/config';
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc } from 'firebase/firestore';
import { ref, update } from 'firebase/database';
import { decryptData } from '@/lib/crypto';

const StatCard = ({ title, value, icon: Icon, colorClass, suffix = "" }: any) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="glass-panel p-7 rounded-2xl group transition-all hover:border-white/20 border border-white/5 bg-white/[0.03] backdrop-blur-xl"
  >
    <div className="flex justify-between items-start mb-3">
      <span className="text-[12px] font-bold text-gray-500 uppercase tracking-widest">{title}</span>
      <Icon className={`w-6 h-6 ${colorClass}`} />
    </div>
    <div className="text-4xl font-bold text-white font-outfit tracking-tight">
      {suffix}{value}
    </div>
  </motion.div>
);

const ActiveLockerCard = ({ locker, onUnlock }: any) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!locker.sessionEnd) {
      setTimeLeft("Ready to Start");
      return;
    }

    const timer = setInterval(() => {
      const remaining = locker.sessionEnd - Date.now();
      if (remaining <= 0) {
        setTimeLeft("Session Expired");
        clearInterval(timer);
      } else {
        const expiryDate = new Date(locker.sessionEnd);
        setTimeLeft(`Expires: ${expiryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [locker.sessionEnd]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onUnlock(locker)}
      className="active-box p-6 rounded-2xl flex justify-between items-center cursor-pointer transition-all border border-white/10 bg-white/[0.03] backdrop-blur-md hover:scale-[1.01] hover:border-primary group"
    >
      <div className="flex flex-col gap-1.5">
        <div className="text-white font-bold text-lg font-outfit">Locker {locker.id}</div>
        <div className="text-sm text-gray-500 font-medium leading-relaxed">
          Pin: <strong className="text-primary tracking-[0.3em] font-black text-base font-outfit">{decryptData(locker.encryptedPin || '') || '----'}</strong><br />
          <span className={locker.sessionEnd ? "text-gray-500" : "text-primary"}>{timeLeft}</span>
        </div>
      </div>

      <div className="bg-primary/10 text-primary px-8 py-2.5 rounded-full font-bold text-sm transition-all group-hover:bg-primary group-hover:text-white">
        View
      </div>
    </motion.div>
  );
};

export default function UserDashboard() {
  const router = useRouter();
  const { user, initAuth, loading: authLoading } = useAuthStore();
  const { lockers, initLockers } = useLockerStore();

  const [activeBookings, setActiveBookings] = useState<any[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [loading, setLoading] = useState(true);

  // LEGACY LOGIC: Auto-Expire Lockers Watcher
  useEffect(() => {
    const autoExpireLockers = async () => {
      try {
        const now = Date.now();
        const snapshot = await getDocs(collection(db, "lockers"));
        
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          if (data.status === "ACTIVE" && data.sessionEnd && data.sessionEnd <= now) {
            console.log(`[Auto-Expire] Releasing locker ${docSnap.id}...`);
            
            // 1. Reset Firestore
            await updateDoc(doc(db, "lockers", docSnap.id), {
              status: "AVAILABLE",
              userId: null,
              sessionEnd: null,
              startTime: null,
              currentPin: null,
              encryptedPin: null,
              bookingId: null
            });

            // 2. Sync to RTDB
            const lockerId = docSnap.id.replace("locker_", "");
            await update(ref(rtdb, lockerId), {
              status: "AVAILABLE",
              pin: null,
              sessionEnd: 0,
              startTime: 0
            });
          }
        }
      } catch (err) {
        console.error("Auto-expire failed:", err);
      }
    };

    const interval = setInterval(autoExpireLockers, 3000); // Further reduced to 3s for ultra-low latency
    autoExpireLockers(); // Initial run
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    initAuth();
    const unsubLockers = initLockers();

    if (user?.uid) {
      const q = query(collection(db, "lockers"), where("userId", "==", user.uid), where("status", "==", "ACTIVE"));
      const unsubActive = onSnapshot(q, (snap) => {
        const active = snap.docs.map(doc => ({ id: doc.id.replace('locker_', ''), firestoreId: doc.id, ...doc.data() }));
        setActiveBookings(active);
        setLoading(false);
      });

      const hq = query(collection(db, "bookings"), where("userId", "==", user.uid));
      getDocs(hq).then(snap => {
        let total = 0;
        snap.forEach(d => total += (d.data().amount || 0));
        setTotalSpent(total);
      });

      return () => {
        unsubLockers && unsubLockers();
        unsubActive();
      };
    }
  }, [user?.uid]);

  const availableCount = lockers.filter(l => l.status === 'AVAILABLE').length;

  if (authLoading || (loading && !user)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-gray-400 font-medium tracking-[0.3em] uppercase text-xs">Accessing Cockpit...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1240px] mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-white font-outfit mb-2">
          Hi, {user?.name || 'Explorer'}! 👋
        </h1>
        <p className="text-gray-400 text-lg">Here's what's happening with your lockers today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <StatCard 
          title="Active Bookings" 
          value={activeBookings.length} 
          icon={Clock} 
          colorClass="text-primary" 
        />
        <StatCard 
          title="Available Lockers" 
          value={availableCount} 
          icon={Unlock} 
          colorClass="text-emerald-400" 
        />
        <StatCard 
          title="Total Spent" 
          value={totalSpent.toFixed(2)} 
          suffix="₹"
          icon={Wallet} 
          colorClass="text-amber-500" 
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <motion.button
          whileHover={{ scale: 1.01, translateY: -3 }}
          onClick={() => router.push('/book/select')}
          className="p-6 rounded-2xl bg-primary text-white group text-left shadow-lg shadow-primary/20 relative overflow-hidden"
        >
          <div className="flex justify-between items-center mb-4">
            <PlusCircle className="w-8 h-8 text-white/40" />
            <ArrowRight className="w-5 h-5 text-white group-hover:translate-x-2 transition-transform" />
          </div>
          <h3 className="text-xl font-bold text-white mb-0.5 font-outfit">New Booking</h3>
          <p className="text-white/70 text-sm font-medium">Reserve storage instantly</p>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.01, translateY: -3 }}
          onClick={() => router.push('/dashboard/history')}
          className="glass-panel p-6 rounded-2xl group text-left border-white/10 bg-white/[0.05] hover:border-white/20 transition-all"
        >
          <div className="flex justify-between items-center mb-4">
            <History className="w-8 h-8 text-primary/40" />
            <ArrowRight className="w-5 h-5 text-primary group-hover:translate-x-2 transition-transform" />
          </div>
          <h3 className="text-xl font-bold text-white mb-0.5 font-outfit">Records</h3>
          <p className="text-gray-400 text-sm font-medium">Digital archives & history</p>
        </motion.button>
      </div>

      <div>
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3 font-outfit">
          <Box className="w-6 h-6 text-primary" />
          Your Active Lockers
        </h3>

        <div className="space-y-4">
          <AnimatePresence mode='popLayout'>
            {activeBookings.length > 0 ? (
              activeBookings.map((locker) => (
                <ActiveLockerCard 
                  key={locker.id} 
                  locker={locker} 
                  onUnlock={(l: any) => router.push(`/unlock/${l.id}`)}
                />
              ))
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-panel py-20 rounded-[2rem] text-center border-dashed border-white/10"
              >
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
                  <Box className="w-8 h-8 text-gray-700" />
                </div>
                <h4 className="text-lg font-bold text-white mb-2">No Active Bookings</h4>
                <p className="text-gray-500 font-medium">Your booked lockers will appear here.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
