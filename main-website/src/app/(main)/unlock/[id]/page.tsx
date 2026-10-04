"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Lock, 
  Unlock as UnlockIcon, 
  Clock, 
  ShieldCheck, 
  History, 
  Zap, 
  Loader2,
  Coins,
  ChevronRight,
  HandMetal,
  DoorOpen,
  DoorClosed,
  Box,
  PackageCheck
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { db, rtdb } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc, onSnapshot, increment, setDoc } from 'firebase/firestore';
import { ref, update, onValue, get } from 'firebase/database';
import { decryptData } from '@/lib/crypto';

// Passenger Extension Pricing Matrix (Indicative railway coach tariff)
const getExtensionPrice = (size: string = 'MEDIUM', hours: number): number => {
  const norm = (size || 'MEDIUM').toUpperCase();
  const rates: Record<string, Record<number, number>> = {
    SMALL: { 0.5: 10, 1: 15, 3: 35 },
    MEDIUM: { 0.5: 15, 1: 25, 3: 55 },
    LARGE: { 0.5: 20, 1: 40, 3: 85 }
  };
  return rates[norm]?.[hours] ?? (rates.MEDIUM[hours] || 25);
};

export default function UnlockPage() {
  const params = useParams();
  const router = useRouter();
  const lockerId = params.id as string;
  const { user, initAuth } = useAuthStore();

  const [lockerData, setLockerData] = useState<any>(null);
  const [unlockCount, setUnlockCount] = useState(0);
  const [doorStatus, setDoorStatus] = useState<'OPEN' | 'CLOSED'>('CLOSED');
  const [doorOpenDuration, setDoorOpenDuration] = useState(0);
  const [itemPresent, setItemPresent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState("00:00:00");
  const [showExtension, setShowExtension] = useState(false);
  const [extending, setExtending] = useState(false);
  const [creditsAwarded, setCreditsAwarded] = useState<number | null>(null);
  const awardTriggered = useRef(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lockerDataRef = useRef<any>(null); // Keep a ref to avoid stale closure in listeners

  useEffect(() => {
    initAuth();
  }, []);

  useEffect(() => {
    lockerDataRef.current = lockerData;
  }, [lockerData]);

  useEffect(() => {
    if (!lockerId) return;

    // 1. Firestore Listener
    const unsubFirestore = onSnapshot(doc(db, "lockers", `locker_${lockerId}`), (snap) => {
      if (!snap.exists()) {
        router.push('/dashboard');
        return;
      }
      const data = snap.data();
      const prevData = lockerDataRef.current;
      
      // PROTECTION LOGIC:
      // Only ignore the cloud if the status remains ACTIVE but the cloud is missing the timer data.
      // If the cloud says AVAILABLE, we MUST listen and end the session correctly.
      if (prevData?.isHardwareActive && data.status === 'ACTIVE' && !data.startTime && prevData.startTime) {
        console.log('[SYNC] Ignoring stale Firestore reset while hardware is active.');
        return;
      }

      setLockerData(data);
      setLoading(false);

      // Detection for early termination (Transition from ACTIVE to AVAILABLE)
      if (data.status === 'AVAILABLE' && prevData?.status === 'ACTIVE' && !awardTriggered.current) {
        awardTriggered.current = true; // Prevent double-awarding
        
        const remaining = (prevData.sessionEnd || 0) - Date.now();
        if (remaining > 60000) {
          const credits = Math.floor(remaining / 60000);
          setCreditsAwarded(credits);
        }
      }
    });

    // 2. ENHANCED RTDB Listener & One-time Fetch (Hardware Brain - Virtual Clock)
    const lockerRef = ref(rtdb, lockerId);

    // One-time fetch for immediate state catch-up on load
    const doInitialSync = async () => {
      const { get: rtdbGet } = await import('firebase/database');
      try {
        const snap = await rtdbGet(lockerRef);
        const data = snap.val();
        if (data && data.unlockCount > 0) {
          console.log('[SYNC] Initial RTDB fetch caught active session.');
          setUnlockCount(data.unlockCount);
          syncVirtualClock(data);
        }
      } catch (e) {
        console.error('[SYNC] Initial fetch failed:', e);
      }
    };
    doInitialSync();

    const syncVirtualClock = async (data: any) => {
      if (data.status === 'ACTIVE') {
        const newUnlockCount = data.unlockCount || 0;
        setUnlockCount(newUnlockCount);

        setLockerData((prev: any) => ({
          ...prev,
          status: 'ACTIVE',
          startTime: data.startTime,
          sessionEnd: data.sessionEnd,
          duration: data.duration || 3600000,
          unlockCount: newUnlockCount,
          isHardwareActive: true 
        }));

        // Bridge to Firestore when hardware provides startTime (first unlock)
        const prevStartTime = lockerDataRef.current?.startTime;
        if ((!prevStartTime || prevStartTime === 0) && data.startTime && data.startTime > 0) {
          console.log('[BRIDGE] First unlock detected — syncing startTime/sessionEnd to Firestore.');
           updateDoc(doc(db, "lockers", `locker_${lockerId}`), {
             startTime: data.startTime,
             sessionEnd: data.sessionEnd,
             status: 'ACTIVE',
             unlockCount: newUnlockCount
           }).catch(err => console.error('[BRIDGE] Sync failed:', err));
        } else if (data.unlockCount > 0 && (!lockerDataRef.current?.unlockCount || lockerDataRef.current.unlockCount === 0)) {
          // Bridge unlockCount even if startTime was already set
          console.log('[BRIDGE] UnlockCount changed — syncing to Firestore.');
          updateDoc(doc(db, "lockers", `locker_${lockerId}`), {
            unlockCount: newUnlockCount,
            startTime: data.startTime || lockerDataRef.current?.startTime,
            sessionEnd: data.sessionEnd || lockerDataRef.current?.sessionEnd,
          }).catch(err => console.error('[BRIDGE] UnlockCount sync failed:', err));
        }
      } else if (data.status === 'AVAILABLE') {
        // Hardware terminated the session — immediately update local state
        const prevLocker = lockerDataRef.current;
        const wasActive = prevLocker?.status === 'ACTIVE' || prevLocker?.isHardwareActive;
        const isForcedOpen = data.lastAction === 'FORCED_OPEN';

        if (wasActive) {
          if (isForcedOpen) {
            console.warn('[SECURITY] FORCED OPEN detected! Session terminated by hardware breach.');
          } else {
            console.info('[HW-SYNC] Hardware termination detected via RTDB. Updating UI immediately.');
          }

          // Award credits for early termination — but NOT for forced open (security breach)
          if (!isForcedOpen && !awardTriggered.current && prevLocker?.sessionEnd) {
            const remaining = prevLocker.sessionEnd - Date.now();
            if (remaining > 60000) {
              awardTriggered.current = true;
              const credits = Math.floor(remaining / 60000);
              setCreditsAwarded(credits);
            }
          }

          // Bridge termination to Firestore
          updateDoc(doc(db, "lockers", `locker_${lockerId}`), {
            status: 'AVAILABLE',
            startTime: null,
            sessionEnd: 0,
            duration: 0,
            currentPin: null,
            encryptedPin: null,
            unlockCount: 0,
            itemPresent: false,
            doorStatus: 'CLOSED',
            doorOpenDuration: 0,
            lastUpdated: Date.now()
          }).catch(err => console.error('[HW-SYNC] Firestore bridge failed:', err));

          // Write security alert for forced-open events
          if (isForcedOpen) {
            const { addDoc, collection: firestoreCollection } = await import('firebase/firestore');
            addDoc(firestoreCollection(db, 'system_logs'), {
              type: 'FORCED_OPEN',
              lockerId: lockerId,
              timestamp: Date.now(),
              message: `Locker #${lockerId} was forced open during an active session`,
              severity: 'CRITICAL',
              acknowledged: false
            }).catch(err => console.error('[SECURITY] Failed to write alert:', err));
          }
        }

        // Always reset local state when RTDB says AVAILABLE
        setUnlockCount(0);
        setLockerData((prev: any) => ({
          ...prev,
          status: 'AVAILABLE',
          startTime: null,
          sessionEnd: 0,
          duration: 0,
          unlockCount: 0,
          isHardwareActive: false
        }));
      }
    };

    const unsubRtdbMain = onValue(lockerRef, async (snap) => {
      const data = snap.val();
      if (!data) return;
      setUnlockCount(data.unlockCount || 0);
      setDoorStatus(data.doorStatus === 'OPEN' ? 'OPEN' : 'CLOSED');
      setDoorOpenDuration(data.doorOpenDuration || 0);
      setItemPresent(data.itemPresent || false);
      syncVirtualClock(data);
    });

    // 3. RTDB Status Listener — Backup bridge for hardware early-termination
    //    This is a secondary safety net. The primary termination handling
    //    is now done inside syncVirtualClock above.
    const unsubRtdbStatus = onValue(ref(rtdb, `${lockerId}/status`), async (snap) => {
      const rtdbStatus = snap.val() as string | null;
      const currentLocker = lockerDataRef.current;
      
      // Hardware terminated early: RTDB is AVAILABLE but local state still shows ACTIVE
      if (rtdbStatus === 'AVAILABLE' && currentLocker?.status === 'ACTIVE') {
        console.info('[HW-SYNC-BACKUP] Status listener detected termination.');
        // Update local state immediately as a backup
        setUnlockCount(0);
        setLockerData((prev: any) => ({
          ...prev,
          status: 'AVAILABLE',
          startTime: null,
          sessionEnd: 0,
          duration: 0,
          unlockCount: 0,
          isHardwareActive: false
        }));
      }
    });

    return () => {
      unsubFirestore();
      unsubRtdbMain();
      unsubRtdbStatus();
    };

  }, [lockerId]);

  // Timer Effect: Prioritizes RTDB/Hardware timings for the live UI
  // Depends on unlockCount so it re-evaluates immediately when the first unlock happens
  useEffect(() => {
    const active = lockerData?.status === 'ACTIVE';
    const hasEnd = lockerData?.sessionEnd && lockerData.sessionEnd > 0;
    
    if (active && hasEnd) {
      if (timerRef.current) clearInterval(timerRef.current);
      
      const runTimer = () => {
        const now = Date.now();
        const diff = lockerData.sessionEnd - now;

        if (diff <= 0) {
          setTimeLeft("00:00:00");
          if (timerRef.current) clearInterval(timerRef.current);
          return;
        }

        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      };

      runTimer();
      timerRef.current = setInterval(runTimer, 1000);
      
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else {
      setTimeLeft("--:--:--");
    }
  }, [lockerData?.sessionEnd, lockerData?.status, lockerData?.startTime, unlockCount]);

  // Format door open duration from ms to readable string
  const formatDoorTime = (ms: number) => {
    if (ms < 1000) return '0s';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
    return `${s}s`;
  };

  const handleExtend = async (hours: number) => {
    setExtending(true);
    const addMs = hours * 3600000;
    const newDuration = (lockerData.duration || 0) + addMs;
    const newEnd = (lockerData.sessionEnd || Date.now()) + addMs;

    try {
      await updateDoc(doc(db, "lockers", `locker_${lockerId}`), {
        duration: newDuration,
        sessionEnd: newEnd
      });
      await update(ref(rtdb, lockerId), {
        duration: newDuration,
        sessionEnd: newEnd
      });
      setShowExtension(false);
    } catch (err) {
      console.error(err);
    } finally {
      setExtending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-gray-400 font-medium tracking-widest uppercase text-xs">Decrypting Signal...</p>
      </div>
    );
  }

  const isLocked = lockerData?.status === 'ACTIVE' && (lockerData?.startTime || unlockCount > 0);
  const isReady = lockerData?.status === 'ACTIVE' && !lockerData?.startTime && unlockCount === 0;
  const isExpired = lockerData?.status === 'AVAILABLE';

  return (
    <div className="container mx-auto px-6 py-8 max-w-2xl">
      <div className="mb-8 text-center md:text-left">
        <h1 className="text-2xl font-black text-white font-outfit uppercase italic tracking-tighter leading-none mb-1">
          Locker Access <span className="text-primary italic">{lockerId}</span>
        </h1>
        <p className="text-gray-600 text-[9px] font-bold uppercase tracking-widest">Digital-Hardware Synchronization System.</p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Module 1: Status & Timer */}
        <div className="glass-panel p-6 rounded-2xl text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-white/5" />
          
          <div className={`p-3 rounded-xl w-14 h-14 mx-auto mb-4 flex items-center justify-center transition-all duration-500 ${
            isLocked ? 'bg-rose-500/10 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.1)]' : 
            isReady ? 'bg-primary/10 text-primary animate-pulse shadow-[0_0_20px_rgba(99,102,241,0.1)]' : 
            'bg-emerald-500/10 text-emerald-500'
          }`}>
            {isLocked ? <Lock className="w-7 h-7" /> : <UnlockIcon className="w-7 h-7" />}
          </div>

          <div className="space-y-0.5 mb-4">
            <div className="text-[8px] font-bold text-gray-600 uppercase tracking-[0.3em] leading-none mb-1.5">Operation Mode</div>
            <div className={`text-xl font-black font-outfit uppercase italic tracking-tight ${
              isLocked ? 'text-rose-500' : isReady ? 'text-primary' : 'text-emerald-500'
            }`}>
              {isLocked ? 'SESSION ACTIVE' : isReady ? 'READY' : 'TERMINATED'}
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="text-[8px] font-bold text-gray-600 uppercase tracking-[0.3em] leading-none mb-1.5">Session Countdown</div>
            <div className="text-4xl font-black text-white font-outfit tracking-tighter">
              {timeLeft}
            </div>
          </div>

          {!isExpired && (
            <button 
              onClick={() => setShowExtension(true)}
              className="mt-6 group flex items-center gap-2 text-primary hover:text-white transition-all text-[8px] font-black uppercase tracking-[0.2em] mx-auto bg-white/5 px-4 py-2 rounded-full border border-white/5 hover:border-primary/30"
            >
              <Clock className="w-3 h-3" /> Extend
            </button>
          )}

          {isReady && (
             <div className="mt-6 pt-5 border-t border-white/5">
                <p className="text-[9px] text-primary font-black uppercase tracking-[0.2em] animate-pulse max-w-[180px] mx-auto leading-relaxed">
                  ENTER PIN TO START
                </p>
             </div>
          )}
        </div>

        {/* Module 2: Access PIN */}
        <div className="glass-panel p-6 rounded-2xl text-center border-primary/20 bg-linear-to-b from-primary/10 to-transparent relative overflow-hidden">
          <div className="absolute -right-6 -top-6 p-10 opacity-5">
             <ShieldCheck className="w-24 h-24 text-primary" />
          </div>
          <h4 className="text-[8px] font-black text-primary uppercase tracking-[0.3em] mb-6">Access Authorization PIN</h4>
          <div className="flex gap-3 justify-center mb-6">
            {(decryptData(lockerData?.encryptedPin || '') || '----').split('').map((char: string, i: number) => (
              <div key={i} className="w-12 h-16 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center text-2xl font-black text-primary font-outfit tracking-tighter shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]">
                {char}
              </div>
            ))}
          </div>
          <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest max-w-[220px] mx-auto leading-relaxed">
            Encrypted session code. <span className="text-gray-400">Restricted for unit {lockerId}.</span>
          </p>
        </div>

        {/* Module 3: Instructions & Telemetry */}
        <div className="glass-panel p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-8 border-white/5">
          <div className="space-y-5">
            <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Operational Flow</h4>
            <div className="space-y-4">
              {[
                { step: 'Locate Unit '+lockerId, desc: 'Find your locker at S3.' },
                { step: 'Input Access PIN', desc: 'Secure keypad verification.' },
                { step: 'Wait for Click', desc: 'Solenoid confirmation.' }
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <span className="text-primary font-black font-outfit text-base">0{i+1}</span>
                  <div>
                    <div className="text-sm text-white font-bold leading-none mb-1.5">{item.step}</div>
                    <div className="text-[10px] text-gray-500 font-medium leading-relaxed">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-center flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-white/5 pt-6 md:pt-0">
              <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.3em] mb-4">Hardware Telemetry</h4>
              <div className="text-5xl font-black text-white font-outfit leading-none mb-3">
                {String(unlockCount).padStart(2, '0')}
              </div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Unlocks</p>

              {/* Door Status */}
              {isLocked && (
                <div className="mt-5 space-y-3 w-full">
                  <div className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                    doorStatus === 'OPEN' 
                      ? 'bg-amber-500/10 border-amber-500/30' 
                      : 'bg-emerald-500/10 border-emerald-500/30'
                  }`}>
                    {doorStatus === 'OPEN' 
                      ? <DoorOpen className="w-3.5 h-3.5 text-amber-400" />
                      : <DoorClosed className="w-3.5 h-3.5 text-emerald-400" />
                    }
                    <span className={`text-[9px] font-black uppercase tracking-widest ${
                      doorStatus === 'OPEN' ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      Door {doorStatus}
                    </span>
                  </div>
                  {doorOpenDuration > 0 && (
                    <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-lg border border-white/5">
                      <Clock className="w-3 h-3 text-gray-500" />
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                        Open: {formatDoorTime(doorOpenDuration)}
                      </span>
                    </div>
                  )}

                  {/* Item Status */}
                  <div 
                    onClick={async () => {
                      try {
                        const lockerRef = ref(rtdb, lockerId);
                        await update(lockerRef, { itemPresent: !itemPresent });
                        console.log("[DEBUG] Manually toggled itemPresent to:", !itemPresent);
                      } catch (err) {
                        console.error("[DEBUG] Failed to toggle itemPresent:", err);
                      }
                    }}
                    title="Click to manually toggle (Debug Override)"
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl border transition-all cursor-pointer hover:bg-white/10 ${
                      itemPresent 
                        ? 'bg-blue-500/10 border-blue-500/30' 
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    {itemPresent 
                      ? <PackageCheck className="w-3.5 h-3.5 text-blue-400" />
                      : <Box className="w-3.5 h-3.5 text-gray-500" />
                    }
                    <span className={`text-[9px] font-black uppercase tracking-widest ${
                      itemPresent ? 'text-blue-400' : 'text-gray-500'
                    }`}>
                      {itemPresent ? 'Item Detected' : 'Box Empty'}
                    </span>
                  </div>
                </div>
              )}

              {!isLocked && (
                <div className="mt-5 flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full border border-white/5 opacity-80">
                   <ShieldCheck className="w-3 h-3 text-primary" />
                   <span className="text-[8px] text-gray-400 font-black uppercase tracking-widest">Hardware Sync Active</span>
                </div>
              )}
          </div>
        </div>

      </div>

      {/* Extension Modal */}
      <AnimatePresence>
        {showExtension && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowExtension(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative glass-panel p-8 rounded-[2rem] max-w-sm w-full border-primary/30"
            >
              <h3 className="text-xl font-black text-white font-outfit uppercase italic mb-1 flex items-center gap-3 tracking-tighter">
                <Clock className="text-primary w-5 h-5" /> Extend Session
              </h3>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-6">
                Locker Rental → Extension → Final Amount
              </p>
              
              <div className="space-y-2.5 mb-6">
                {[
                  { h: 0.5, label: '+30 Minutes', badge: 'Quick Add-on' },
                  { h: 1, label: '+1 Hour', badge: 'Standard Extension' },
                  { h: 3, label: '+3 Hours', badge: 'Journey Extension' },
                ].map(({ h, label, badge }) => {
                  const numLocker = Number(lockerId);
                  const isMed = numLocker === 4 || (numLocker > 6 && numLocker <= 16);
                  const currentSize = lockerData?.size || (numLocker > 16 ? 'Large' : isMed ? 'Medium' : 'Small');
                  const cost = getExtensionPrice(currentSize, h);
                  return (
                    <button
                      key={h}
                      disabled={extending}
                      onClick={() => handleExtend(h)}
                      className="w-full flex justify-between items-center p-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-primary/10 transition-all text-left group"
                    >
                      <div>
                        <div className="text-white font-bold text-xs">{label}</div>
                        <div className="text-[8px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">{badge} • {currentSize}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-primary font-black font-outfit text-sm">₹{cost}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-700 group-hover:text-primary transition-all" />
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[8px] text-gray-500 font-medium text-center mb-6">
                Clean add-on tariff • Zero IoT or maintenance surcharges
              </p>
              <button 
                onClick={() => setShowExtension(false)}
                className="w-full py-1 text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] hover:text-white transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Credit Celebration Overlay */}
      <AnimatePresence>
        {creditsAwarded && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
             <motion.div 
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="glass-panel p-10 rounded-[2.5rem] text-center border-amber-500/50 bg-linear-to-b from-amber-500/20 to-transparent"
            >
              <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-6">
                <Coins className="text-amber-500 w-10 h-10" />
              </div>
              <h2 className="text-3xl font-black text-white font-outfit uppercase italic mb-4 tracking-tighter leading-none">Credits!</h2>
              <p className="text-gray-500 mb-8 max-w-xs mx-auto text-xs font-medium">
                Earned <span className="text-amber-500 font-bold">{creditsAwarded}</span> loyalty credits.
              </p>
              <button 
                onClick={async () => {
                  try {
                    const storedUser = JSON.parse(sessionStorage.getItem("currentUser") || "{}");
                    const targetUid = user?.uid || storedUser?.uid;

                    if (targetUid) {
                      const userRef = doc(db, "users", targetUid);
                      await setDoc(userRef, {
                        credits: increment(creditsAwarded || 0)
                      }, { merge: true });
                    }
                    setCreditsAwarded(null);
                    router.push('/dashboard');
                  } catch (err) {
                    console.error("Claim failed:", err);
                    router.push('/dashboard');
                  }
                }}
                className="w-full bg-linear-to-r from-amber-500 to-orange-600 text-white py-4 rounded-xl text-base font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-amber-500/30"
              >
                CLAIM
              </button>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
