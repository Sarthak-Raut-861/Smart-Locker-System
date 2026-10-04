"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Clock, 
  CreditCard, 
  Coins, 
  ShieldCheck, 
  Zap,
  CheckCircle,
  Loader2,
  Box,
  Lock as LockIcon
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useLockerStore } from '@/store/useLockerStore';
import { db, rtdb } from '@/lib/firebase/config';
import { collection, doc, runTransaction, getDoc } from 'firebase/firestore';
import { ref, update } from 'firebase/database';
import { encryptData, hashPIN } from '@/lib/crypto';
import { syncHardwareAction } from '@/app/actions/syncHardware';


// Passenger Pricing Engine: Indicative railway coach locker pricing (Min 1 hr, Max 48 hrs)
const getJourneyPackagePrice = (size: string = 'Medium', duration: number): number => {
  const norm = (size || 'Medium').toUpperCase();
  // Milestone Packages (1h, 3h, 6h, 12h, 24h, 48h)
  const milestones: Record<string, Record<number, number>> = {
    SMALL:  { 1: 15, 3: 35, 6: 60, 12: 90,  24: 150, 48: 260 },
    MEDIUM: { 1: 25, 3: 55, 6: 95, 12: 140, 24: 240, 48: 420 },
    LARGE:  { 1: 40, 3: 85, 6: 150, 12: 220, 24: 380, 48: 680 }
  };
  const tier = milestones[norm] || milestones.MEDIUM;
  
  // Clamp duration between min 1 hour and max 48 hours
  const d = Math.min(48, Math.max(1, duration));
  
  // Exact milestone match
  if (tier[d] !== undefined) {
    return tier[d];
  }
  
  // Progressive Bracketed Marginal Algorithm for custom/precision hours
  if (d < 3) {
    const marginal = (tier[3] - tier[1]) / 2; // 1h -> 3h
    return Math.round(tier[1] + (d - 1) * marginal);
  } else if (d < 6) {
    const marginal = (tier[6] - tier[3]) / 3; // 3h -> 6h
    return Math.round(tier[3] + (d - 3) * marginal);
  } else if (d < 12) {
    const marginal = (tier[12] - tier[6]) / 6; // 6h -> 12h
    return Math.round(tier[6] + (d - 6) * marginal);
  } else if (d < 24) {
    const marginal = (tier[24] - tier[12]) / 12; // 12h -> 24h
    return Math.round(tier[12] + (d - 12) * marginal);
  } else {
    const marginal = (tier[48] - tier[24]) / 24; // 24h -> 48h
    return Math.round(tier[24] + (d - 24) * marginal);
  }
};

// Inner component that uses useSearchParams (must be inside Suspense)
function BookingConfirmInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, initAuth } = useAuthStore();
  const { cleanupExpiredLocker } = useLockerStore();

  // Temporarily bypass Razorpay payment gateway for testing
  const isBypassActive = true; // process.env.NEXT_PUBLIC_BYPASS_PAYMENT === 'true' || searchParams.get('bypass') === 'true';

  const [selectedLocker, setSelectedLocker] = useState<any>(null);
  const [duration, setDuration] = useState(1); // Hours
  const [useCredits, setUseCredits] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [generatedPin, setGeneratedPin] = useState('');
  const [pricing, setPricing] = useState<any>(null);
  const [leftBehindTime, setLeftBehindTime] = useState<number>(0);
  const [leftBehindPenalty, setLeftBehindPenalty] = useState<number>(0);

  useEffect(() => {
    initAuth();
    const stored = sessionStorage.getItem("selectedLocker");
    if (stored) {
      setSelectedLocker(JSON.parse(stored));
    } else {
      // Fallback: QR code scan passes ?id=N — pre-select that locker
      const qrId = searchParams.get('id');
      if (qrId) {
        const numId = Number(qrId);
        const isMed = numId === 4 || (numId > 6 && numId <= 16);
        const isLarge = numId > 16;
        const lockerFromQR = {
          id: qrId,
          firestoreId: `locker_${qrId}`,
          status: 'AVAILABLE',
          price: isLarge ? 40 : isMed ? 25 : 15,
          size: isLarge ? 'Large' : isMed ? 'Medium' : 'Small'
        };
        setSelectedLocker(lockerFromQR);
        sessionStorage.setItem("selectedLocker", JSON.stringify(lockerFromQR));
      } else {
        router.push('/book/select');
        return;
      }
    }

    // Fetch dynamic pricing
    getDoc(doc(db, "settings", "pricing")).then(snap => {
      if (snap.exists()) setPricing(snap.data());
    });
  }, [searchParams, router]);

  useEffect(() => {
    if (user && selectedLocker) {
      getDoc(doc(db, "lockers", selectedLocker.firestoreId)).then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.itemLeftBehind && data.userId === user.uid && data.sessionEnd) {
            const now = Date.now();
            const msDiff = now - data.sessionEnd;
            if (msDiff > 0) {
              setLeftBehindTime(msDiff);
              const hoursLeftBehind = msDiff / (1000 * 60 * 60);
              const rate = selectedLocker.price || 25;
              setLeftBehindPenalty(Math.ceil(hoursLeftBehind * rate));
            }
          }
        }
      });
    }
  }, [user, selectedLocker]);

  const calculateSubtotal = () => {
    if (!selectedLocker) return 0;
    const basePlanPrice = getJourneyPackagePrice(selectedLocker.size, duration);
    const planStr = duration === 0.5 ? "30min" : `${duration}hr`;
    
    let baseRate = basePlanPrice;
    if (pricing && pricing[planStr] && pricing._surgeActive) {
      baseRate = pricing[planStr];
    } else if (pricing?._surgeActive && pricing?.multiplier) {
      baseRate = Math.round(basePlanPrice * pricing.multiplier);
    }
    
    return baseRate + leftBehindPenalty;
  };

  const subtotal = calculateSubtotal();
  const creditDiscount = useCredits ? Math.min((user?.credits || 0) / 10, subtotal) : 0;
  const total = subtotal - creditDiscount;

  const processBookingSuccess = async (paymentId?: string) => {
    if (!user || !selectedLocker) return;
    setLoading(true);
    console.log("[Booking] Initializing for Locker:", selectedLocker.id);

    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    const pinHash = hashPIN(pin); // For Hardware Comparison (SHA-256)
    const pinEncrypted = encryptData(pin); // For UI Retrieval (AES-256)

    const bookingId = `book_${Date.now()}`;

    try {
      console.log("[Booking] Starting Firestore transaction...");
      await runTransaction(db, async (transaction) => {
        const lockerDocRef = doc(db, "lockers", selectedLocker.firestoreId);
        const lockerSnap = await transaction.get(lockerDocRef);
        
        if (lockerSnap.exists() && lockerSnap.data().status === 'ACTIVE') {
          throw new Error("Locker is already taken.");
        }

          transaction.set(lockerDocRef, {
            status: 'ACTIVE',
            userId: user.uid,
            userName: user.name,
            startTime: null,
            lastUpdated: Date.now(),
            duration: duration * 60 * 60 * 1000,
            sessionEnd: null,
            currentPin: pinHash, 
            encryptedPin: pinEncrypted,
            bookingId: bookingId,
            itemLeftBehind: false, // Clear left-behind state
            itemPresent: false, // Reset item detection
            doorStatus: 'CLOSED', // Reset door status
            doorOpenDuration: 0 // Reset door open duration
          }, { merge: true });

        const bookingRef = doc(collection(db, "bookings"), bookingId);
        transaction.set(bookingRef, {
          id: bookingId,
          userId: user.uid,
          userName: user.name,
          userContact: user.email || "N/A",
          lockerId: selectedLocker.id,
          amount: total,
          duration: duration,
          status: 'PAID',
          createdAt: Date.now(),
          pin: pinHash,
          encryptedPin: pinEncrypted,
          paymentId: paymentId || null
        });

        if (useCredits && (user?.credits || 0) > 0) {
          const creditsToDeduct = Math.ceil(creditDiscount * 10);
          const userRef = doc(db, "users", user.uid);
          transaction.update(userRef, {
            credits: (user.credits || 0) - creditsToDeduct
          });
        }
      });

      console.log("[Booking] Firestore success. Finalizing UI and Hardware Sync (Server-Side)...");
      
      // Trigger Server Action in background
      syncHardwareAction(String(selectedLocker.id), {
        status: "ACTIVE",
        pin: pinHash,
        sessionEnd: 0,
        startTime: 0,
        duration: duration * 60 * 60 * 1000,
        unlockCount: 0,
        itemPresent: false,
        doorStatus: "CLOSED",
        doorOpenDuration: 0
      });

      // Instant transition
      setGeneratedPin(pin);
      setIsSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error("[Booking Error]", err);
      alert(err.message || "Booking failed. Please try again.");
      setLoading(false); // Only stop loading if failed, on success it will transition
    } 
  };

  const handlePayment = async () => {
    if (!user || !selectedLocker) return;
    
    if (total <= 0) {
      // Free or covered entirely by credits
      await processBookingSuccess();
      return;
    }

    // Check if bypass payment is enabled for testing
    if (isBypassActive) {
      console.log("[Payment Bypass] Bypassing Razorpay payment gateway for testing");
      await processBookingSuccess(`test_bypass_${Date.now()}`);
      return;
    }

    setLoading(true);
    
    try {
      // Check if Razorpay SDK is loaded (loaded via Script component at page level)
      if (!(window as any).Razorpay) {
        alert('Razorpay is not available. Please disable any ad blockers and refresh the page.');
        setLoading(false);
        return;
      }

      // Create order
      const orderRes = await fetch('/api/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: total })
      });
      
      if (!orderRes.ok) {
        const errText = await orderRes.text();
        let errMsg = 'Failed to create payment order';
        try {
          const errData = JSON.parse(errText);
          if (errData.error) errMsg = `Server Error: ${errData.error}`;
        } catch(e) {
          errMsg = `Server Error ${orderRes.status}: ${errText.substring(0, 50)}`;
        }
        throw new Error(errMsg);
      }
      
      const orderData = await orderRes.json();

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '', // Needs to be set in env
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Smart Locker System',
        description: `Locker Booking: ${selectedLocker.id}`,
        order_id: orderData.id,
        handler: async function (response: any) {
          try {
            // Verify payment on backend
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            if (!verifyRes.ok) {
              const errData = await verifyRes.json();
              throw new Error(errData.error || 'Payment verification failed');
            }

            // Payment succeeded and verified, finalize booking
            await processBookingSuccess(response.razorpay_payment_id);
          } catch (error: any) {
            alert(`Payment verification failed: ${error.message}`);
            setLoading(false);
          }
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
        },
        theme: {
          color: '#6366f1' // Primary color matching UI
        },
        modal: {
          ondismiss: function() {
            setLoading(false);
          }
        }
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.open();
      
    } catch (error: any) {
      console.error("[Payment Init Error]", error);
      alert(error.message || 'Payment initialization failed');
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="glass-panel p-10 md:p-12 rounded-[2.5rem] max-w-md w-full text-center relative overflow-hidden shadow-2xl"
        >
          <div className="absolute top-0 left-0 w-full h-1.5 bg-linear-to-r from-emerald-500 to-primary" />
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="text-emerald-500 w-10 h-10" />
          </div>
          <h2 className="text-3xl font-black text-white mb-3 font-outfit uppercase italic leading-none">Locker Reserved!</h2>
          <p className="text-gray-500 text-sm mb-8 font-medium">Scan the station QR and use this PIN to access your locker.</p>
          
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-8 relative">
             <div className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mb-3">Access PIN</div>
             <div className="text-6xl font-black text-primary tracking-[0.2em] font-outfit">{generatedPin}</div>
          </div>

          <button 
            onClick={() => router.push('/dashboard')}
            className="bg-primary hover:bg-primary/90 text-white w-full py-4 rounded-xl text-base font-bold uppercase tracking-widest transition-all shadow-lg shadow-primary/20"
          >
            Go to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-12 max-w-2xl">
      <div className="mb-10 text-center md:text-left">
        <button 
          onClick={() => router.back()}
          className="group inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          Change Locker
        </button>
        <h1 className="text-3xl font-black text-white font-outfit uppercase italic tracking-tighter leading-none">
          Complete Your <span className="text-primary italic">Booking</span>
        </h1>
      </div>

      <div className="glass-panel overflow-hidden rounded-3xl border-white/5 shadow-2xl">
        {/* Section 1: Locker Info */}
        <div className="p-8 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Box className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white font-outfit uppercase italic leading-none mb-1">Locker #{(selectedLocker?.id) || '--'}</h3>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{selectedLocker?.size || 'Medium'} Tier</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-primary font-black text-2xl font-outfit leading-none mb-1">₹{selectedLocker?.price || 25}/hr</div>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Indicative Base</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/2 p-4 rounded-xl border border-white/5">
              <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-primary" /> Station
              </div>
              <div className="text-white text-sm font-bold">Pune Junction</div>
            </div>
            <div className="bg-white/2 p-4 rounded-xl border border-white/5">
              <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                 <div className="w-1 h-1 rounded-full bg-primary" /> Coach
              </div>
              <div className="text-white text-sm font-bold">S3</div>
            </div>
          </div>
        </div>

        {/* Section 2: Duration */}
        <div className="p-8 border-b border-white/5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> Journey Duration Package
              </h3>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-1">Starting from ₹15/hour • Min 1 hr, Max 48 hrs</p>
            </div>
            <span className="text-primary font-bold text-xs">{duration} {duration === 1 ? 'Hour' : 'Hours'}</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
            {[1, 3, 6, 12, 24, 48].map((h) => {
              const packagePrice = getJourneyPackagePrice(selectedLocker?.size, h);
              return (
                <button
                  key={h}
                  onClick={() => setDuration(h)}
                  className={`py-3 rounded-xl text-center transition-all ${
                    duration === h 
                    ? 'bg-primary text-white shadow-[0_5px_20px_rgba(99,102,241,0.3)] scale-[1.02]' 
                    : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300'
                  }`}
                >
                  <div className="text-xs font-black uppercase tracking-widest">{h >= 24 ? `${h}h (${h/24}D)` : `${h}h`}</div>
                  <div className={`text-[9px] font-bold mt-0.5 ${duration === h ? 'text-white/80' : 'text-gray-500'}`}>
                    ₹{packagePrice}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="bg-white/2 rounded-xl p-3 flex items-center justify-between border border-white/5">
            <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest ml-1">Precision Adjust (1 – 48 hrs)</span>
            <input 
              type="number" 
              min={1}
              max={48}
              step={1}
              value={duration}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (!isNaN(val)) {
                  setDuration(Math.min(48, Math.max(1, Math.round(val))));
                }
              }}
              className="w-16 bg-black/40 border border-white/10 rounded-lg py-1.5 text-center text-white font-black text-sm outline-hidden focus:border-primary/50 transition-colors"
            />
          </div>
        </div>

        {/* Section 3: Summary & Pay */}
        <div className="p-8 bg-linear-to-b from-transparent to-white/[0.02]">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" /> Order Summary
          </h3>
          
          {isBypassActive && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center mb-4">
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 animate-pulse">
                <Zap className="w-3.5 h-3.5 fill-amber-400" /> Payment Gateway Paused (Bypass Active)
              </span>
            </div>
          )}
          
          <div className="space-y-4 mb-8">
            <div className="flex justify-between text-xs font-bold uppercase tracking-wide">
              <div>
                <span className="text-gray-400">Locker Rental ({duration === 0.5 ? '30m' : `${duration}h`} • {selectedLocker?.size || 'Medium'})</span>
                <span className="block text-[8px] text-gray-600 font-normal mt-0.5">Hardware, sensors & encrypted PIN included</span>
              </div>
              <span className="text-white">₹{(subtotal - leftBehindPenalty).toFixed(2)}</span>
            </div>

            {leftBehindPenalty > 0 && (
              <div className="flex justify-between text-xs font-bold uppercase tracking-wide text-amber-500">
                <span className="">Unpaid Duration (Item Left)</span>
                <span className="">+₹{leftBehindPenalty.toFixed(2)}</span>
              </div>
            )}
            
            <div className={`p-4 rounded-xl border transition-all ${
              useCredits ? 'bg-amber-500/10 border-amber-500/30' : 'bg-white/2 border-white/5'
            }`}>
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                  <Coins className={`w-3.5 h-3.5 ${useCredits ? 'text-amber-400' : 'text-gray-600'}`} />
                  <span className={`text-[10px] font-black uppercase tracking-widest ${useCredits ? 'text-white' : 'text-gray-500'}`}>Redeem Credits</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={useCredits}
                  onChange={(e) => setUseCredits(e.target.checked)}
                  disabled={!user?.credits}
                  className="w-4 h-4 rounded-sm accent-amber-500 cursor-pointer"
                />
              </div>
              <div className="flex justify-between items-end mt-2">
                <span className="text-[10px] text-gray-600 font-bold tracking-tight">Available: <span className="text-amber-500/80">{user?.credits || 0}</span> <span className="text-[8px] opacity-50">(10:1 ratio)</span></span>
                {useCredits && (
                  <span className="text-amber-400 font-black text-xs">−₹{creditDiscount.toFixed(2)}</span>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest block mb-0.5">Total Payable</span>
                <span className="text-4xl font-black text-white font-outfit tracking-tighter leading-none">₹{total.toFixed(2)}</span>
              </div>
              <button 
                onClick={handlePayment}
                disabled={loading}
                className={isBypassActive
                  ? "bg-amber-500 hover:bg-amber-600 text-black px-10 py-4 rounded-xl text-base font-black uppercase tracking-widest transition-all active:scale-95 shadow-[0_10px_30px_rgba(245,158,11,0.3)] flex items-center justify-center gap-3 disabled:opacity-50 group"
                  : "bg-primary hover:bg-primary/90 text-white px-10 py-4 rounded-xl text-base font-black uppercase tracking-widest transition-all active:scale-95 shadow-[0_10px_30px_rgba(99,102,241,0.3)] flex items-center justify-center gap-3 disabled:opacity-50 group"
                }
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    {isBypassActive ? 'Bypass & Book' : 'Checkout'} 
                    <Zap className={`w-4 h-4 group-hover:scale-125 transition-transform ${isBypassActive ? 'fill-black' : 'fill-white'}`} />
                  </>
                )}
              </button>
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-center gap-4">
             <div className="flex items-center gap-2 opacity-40">
                <ShieldCheck className="w-3.5 h-3.5 text-white" />
                <span className="text-[8px] text-white font-bold uppercase tracking-widest">Secure 256-bit SSL</span>
             </div>
             <div className="w-1 h-1 rounded-full bg-white/10" />
             <div className="flex items-center gap-2 opacity-40">
                <LockIcon className="w-3.5 h-3.5 text-white" />
                <span className="text-[8px] text-white font-bold uppercase tracking-widest">End-to-End Encrypted</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Wrap in Suspense — required because useSearchParams() needs it during SSR
export default function BookingConfirmPage() {
  return (
    <>
      {/* Load Razorpay checkout script at page level for reliability */}
      <Script
        id="razorpay-checkout-js"
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />
      <Suspense fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      }>
        <BookingConfirmInner />
      </Suspense>
    </>
  );
}
