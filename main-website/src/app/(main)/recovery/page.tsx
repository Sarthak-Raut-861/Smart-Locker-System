"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldAlert, 
  KeyRound, 
  Train, 
  UserCheck, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Lock, 
  ArrowRight, 
  ArrowLeft, 
  Loader2, 
  HelpCircle,
  FileCheck,
  Building2,
  RefreshCw,
  PhoneCall,
  Sparkles,
  ShieldCheck
} from 'lucide-react';

type RecoveryStep = 
  | 'BOOKING_LOOKUP' 
  | 'IDENTITY_VERIFY' 
  | 'RECOVERY_CODE' 
  | 'APPROVED' 
  | 'MANUAL_REVIEW' 
  | 'COMPLETED';

export default function EmergencyRecoveryPage() {
  const [step, setStep] = useState<RecoveryStep>('BOOKING_LOOKUP');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Booking Details
  const [bookingId, setBookingId] = useState('');
  const [pnr, setPnr] = useState('');
  const [passengerName, setPassengerName] = useState('');
  const [coach, setCoach] = useState('');
  const [seat, setSeat] = useState('');

  // Recovery Session State from Server
  const [requestId, setRequestId] = useState<string | null>(null);
  const [lockerId, setLockerId] = useState<string | null>(null);
  const [bookingDetails, setBookingDetails] = useState<any>(null);

  // Step 2: Identity Verification
  const [documentType, setDocumentType] = useState<'AADHAAR' | 'PAN' | 'PASSPORT'>('AADHAAR');
  const [documentLast4, setDocumentLast4] = useState('');
  const [demoScenario, setDemoScenario] = useState<'MATCH' | 'MISMATCH' | 'FAILED'>('MATCH');
  const [identityVerified, setIdentityVerified] = useState(false);
  const [identityRefId, setIdentityRefId] = useState<string | null>(null);

  // Step 3: Emergency Recovery Code
  const [recoveryCode, setRecoveryCode] = useState('');

  // Step 4: Approved State & Live Temporary PIN
  const [temporaryPin, setTemporaryPin] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(300);

  // Manual Review State
  const [reviewReason, setReviewReason] = useState<string>('');

  // Timer countdown for temporary PIN
  useEffect(() => {
    if (step !== 'APPROVED' || !expiresAt) return;

    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setRemainingSeconds(diff);

      if (diff <= 0) {
        clearInterval(interval);
        setError('Temporary PIN has expired. For security, please re-authenticate or contact station support.');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [step, expiresAt]);

  // Real-time polling to check if passenger opened the locker with the temporary PIN
  useEffect(() => {
    if (step !== 'APPROVED' || !requestId) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/recovery/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId }),
        });
        const data = await res.json();
        if (data.isUsed) {
          setStep('COMPLETED');
          clearInterval(pollInterval);
        } else if (data.isExpired) {
          setError('Your temporary recovery PIN expired after 5 minutes.');
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error('Status sync error:', err);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [step, requestId]);

  // STEP 1 HANDLER: Verify Booking Details
  const handleVerifyBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passengerName.trim()) {
      setError('Please provide the passenger full name.');
      return;
    }
    if (!bookingId.trim() && !pnr.trim()) {
      setError('Please enter either a Booking ID or Train PNR.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/recovery/verify-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: bookingId.trim(),
          pnr: pnr.trim(),
          passengerName: passengerName.trim(),
          coach: coach.trim(),
          seat: seat.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to verify booking ownership.');
      }

      setRequestId(data.requestId);
      setLockerId(String(data.booking.lockerId));
      setBookingDetails(data.booking);
      setStep('IDENTITY_VERIFY');
    } catch (err: any) {
      setError(err.message || 'Booking ownership verification failed.');
    } finally {
      setLoading(false);
    }
  };

  // STEP 2 HANDLER: Verify Identity (DigiLocker Provider)
  const handleVerifyIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/recovery/verify-identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          documentType,
          documentReference: documentLast4.trim() || '1234',
          simulateScenario: demoScenario,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.status === 'MANUAL_REVIEW' || data.status === 'BLOCKED') {
          setReviewReason(data.message);
          setStep('MANUAL_REVIEW');
          return;
        }
        throw new Error(data.message || 'Identity verification failed.');
      }

      setIdentityVerified(true);
      setIdentityRefId(data.result?.referenceId);
      setStep('RECOVERY_CODE');
    } catch (err: any) {
      setError(err.message || 'Identity verification check failed.');
    } finally {
      setLoading(false);
    }
  };

  // STEP 3 HANDLER: Complete Recovery with Recovery Code
  const handleCompleteRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestId) return;
    if (!recoveryCode.trim()) {
      setError('Please enter your Emergency Recovery Code (e.g. LNL-XXXX-XXXX).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/recovery/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          recoveryCode: recoveryCode.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.status === 'MANUAL_REVIEW' || data.status === 'BLOCKED') {
          setReviewReason(data.message);
          setStep('MANUAL_REVIEW');
          return;
        }
        throw new Error(data.message || 'Recovery authorization failed.');
      }

      setTemporaryPin(data.temporaryPin);
      setExpiresAt(data.expiresAt);
      setLockerId(data.lockerId);
      setStep('APPROVED');
    } catch (err: any) {
      setError(err.message || 'Recovery code validation failed.');
    } finally {
      setLoading(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen py-16 px-4 md:px-6 relative z-10 flex flex-col justify-center items-center">
      {/* Background ambient accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-4">
            <ShieldAlert className="w-3.5 h-3.5" /> Emergency Protocol
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white font-outfit uppercase italic tracking-tight mb-2">
            Recover <span className="text-primary italic">My Locker</span>
          </h1>
          <p className="text-gray-400 text-sm max-w-md mx-auto leading-relaxed">
            Lost your phone? Verify your identity and ownership to issue an immediate temporary unlock PIN.
          </p>
        </div>

        {/* Multi-step progress indicators */}
        {step !== 'APPROVED' && step !== 'COMPLETED' && step !== 'MANUAL_REVIEW' && (
          <div className="flex items-center justify-between mb-8 px-4 max-w-md mx-auto">
            <div className={`flex items-center gap-2 text-xs font-bold ${step === 'BOOKING_LOOKUP' ? 'text-primary' : 'text-gray-500'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${step === 'BOOKING_LOOKUP' ? 'bg-primary text-white' : 'bg-white/10 text-gray-400'}`}>1</span>
              <span>Booking</span>
            </div>
            <div className="h-[2px] w-12 bg-white/10" />
            <div className={`flex items-center gap-2 text-xs font-bold ${step === 'IDENTITY_VERIFY' ? 'text-primary' : 'text-gray-500'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${step === 'IDENTITY_VERIFY' ? 'bg-primary text-white' : 'bg-white/10 text-gray-400'}`}>2</span>
              <span>Identity</span>
            </div>
            <div className="h-[2px] w-12 bg-white/10" />
            <div className={`flex items-center gap-2 text-xs font-bold ${step === 'RECOVERY_CODE' ? 'text-primary' : 'text-gray-500'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${step === 'RECOVERY_CODE' ? 'bg-primary text-white' : 'bg-white/10 text-gray-400'}`}>3</span>
              <span>Recovery Code</span>
            </div>
          </div>
        )}

        {/* Main Card */}
        <div className="glass-panel p-8 md:p-10 rounded-[2rem] border-white/10 shadow-2xl relative overflow-hidden backdrop-blur-2xl">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-start gap-3"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>{error}</div>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {/* STEP 1: BOOKING LOOKUP */}
            {step === 'BOOKING_LOOKUP' && (
              <motion.form 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleVerifyBooking}
                className="space-y-4"
              >
                <div className="text-left mb-6">
                  <h2 className="text-xl font-black text-white font-outfit uppercase italic leading-none mb-1">
                    1. Confirm Active Booking
                  </h2>
                  <p className="text-gray-400 text-xs">
                    Enter the passenger details recorded during locker reservation.
                  </p>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold text-gray-300 uppercase tracking-wider ml-1">
                    Passenger Name *
                  </label>
                  <input
                    type="text"
                    value={passengerName}
                    onChange={(e) => setPassengerName(e.target.value)}
                    placeholder="e.g. Sarthak Raut"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-bold text-gray-300 uppercase tracking-wider ml-1">
                      Booking ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={bookingId}
                      onChange={(e) => setBookingId(e.target.value)}
                      placeholder="book_174..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                    />
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-bold text-gray-300 uppercase tracking-wider ml-1">
                      Train PNR (Alternative)
                    </label>
                    <input
                      type="text"
                      value={pnr}
                      onChange={(e) => setPnr(e.target.value)}
                      placeholder="e.g. PNR84729103"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-bold text-gray-300 uppercase tracking-wider ml-1">
                      Coach (Optional)
                    </label>
                    <input
                      type="text"
                      value={coach}
                      onChange={(e) => setCoach(e.target.value)}
                      placeholder="e.g. S3"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/50 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-bold text-gray-300 uppercase tracking-wider ml-1">
                      Seat (Optional)
                    </label>
                    <input
                      type="text"
                      value={seat}
                      onChange={(e) => setSeat(e.target.value)}
                      placeholder="e.g. 42"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/50 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-4 bg-primary hover:bg-primary/90 text-white py-4 rounded-xl text-sm font-bold uppercase tracking-widest transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Verify Booking Details <ArrowRight className="w-4 h-4" /></>}
                </button>
              </motion.form>
            )}

            {/* STEP 2: IDENTITY VERIFICATION (DIGILOCKER ABSTRACTION) */}
            {step === 'IDENTITY_VERIFY' && (
              <motion.form 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleVerifyIdentity}
                className="space-y-5"
              >
                <div className="text-left mb-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-white font-outfit uppercase italic leading-none">
                      2. Verify Identity
                    </h2>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Locker #{lockerId}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs mt-1">
                    Verify government identity matching booking owner <strong>{bookingDetails?.userName}</strong>.
                  </p>
                </div>

                {/* Production-Ready DigiLocker Abstraction Banner */}
                <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-4 text-left">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                      <Building2 className="w-4 h-4 text-indigo-400" />
                      DigiLocker Integration
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Demo Identity Verification
                    </span>
                  </div>
                  <p className="text-gray-400 text-[11px] leading-relaxed">
                    Production architecture binds government-verified ID to the booking owner. Choose a test scenario below to simulate the verification flow.
                  </p>
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-gray-300 uppercase tracking-wider ml-1">
                    Document Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['AADHAAR', 'PAN', 'PASSPORT'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setDocumentType(type)}
                        className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${
                          documentType === type 
                            ? 'bg-primary/20 text-primary border-primary/40' 
                            : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold text-gray-300 uppercase tracking-wider ml-1">
                    Last 4 Digits of ID
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={documentLast4}
                    onChange={(e) => setDocumentLast4(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white placeholder:text-gray-600 text-center tracking-[0.5em] font-mono focus:outline-none focus:border-primary/50 transition-all"
                  />
                  <p className="text-[10px] text-gray-500 ml-1">
                    For privacy, LockNLeave never stores full government document numbers.
                  </p>
                </div>

                {/* Demo Scenario Selector for Evaluators */}
                <div className="bg-white/5 border border-white/5 rounded-xl p-3 text-left">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                    Test Mode Simulation Scenario
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setDemoScenario('MATCH')}
                      className={`px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                        demoScenario === 'MATCH'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-white/5 text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      Verified Match
                    </button>
                    <button
                      type="button"
                      onClick={() => setDemoScenario('MISMATCH')}
                      className={`px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                        demoScenario === 'MISMATCH'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-white/5 text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      Name Mismatch
                    </button>
                    <button
                      type="button"
                      onClick={() => setDemoScenario('FAILED')}
                      className={`px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                        demoScenario === 'FAILED'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-white/5 text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      Lookup Failure
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('BOOKING_LOOKUP')}
                    className="w-1/3 bg-white/5 hover:bg-white/10 text-gray-400 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-2/3 bg-primary hover:bg-primary/90 text-white py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Verify Identity <ArrowRight className="w-3.5 h-3.5" /></>}
                  </button>
                </div>
              </motion.form>
            )}

            {/* STEP 3: RECOVERY CREDENTIAL CODE */}
            {step === 'RECOVERY_CODE' && (
              <motion.form 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleCompleteRecovery}
                className="space-y-5"
              >
                <div className="text-left mb-4">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold mb-1">
                    <CheckCircle2 className="w-4 h-4" /> Identity Verified: {bookingDetails?.userName}
                  </div>
                  <h2 className="text-xl font-black text-white font-outfit uppercase italic leading-none">
                    3. Emergency Recovery Code
                  </h2>
                  <p className="text-gray-400 text-xs mt-1">
                    Enter the secure credential provided when your locker was booked.
                  </p>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold text-gray-300 uppercase tracking-wider ml-1">
                    Recovery Code (Format: LNL-XXXX-XXXX)
                  </label>
                  <input
                    type="text"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                    placeholder="LNL-7K4P-92XM"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-base font-mono font-bold text-center tracking-[0.2em] text-indigo-300 placeholder:text-gray-600 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all uppercase"
                    required
                  />
                  <p className="text-[10px] text-gray-500 ml-1">
                    This unpredictable code was generated during your booking confirmation.
                  </p>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-left flex items-start gap-2.5">
                  <KeyRound className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-200/90 leading-tight">
                    For high-security anti-tamper compliance, entering 3 incorrect codes will lock recovery for station TTE manual review.
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('IDENTITY_VERIFY')}
                    className="w-1/3 bg-white/5 hover:bg-white/10 text-gray-400 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-2/3 bg-emerald-500 hover:bg-emerald-600 text-white py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Authorize Recovery <ShieldCheck className="w-4 h-4" /></>}
                  </button>
                </div>
              </motion.form>
            )}

            {/* STEP 4: APPROVED STATE & TEMPORARY PIN DISPLAY */}
            {step === 'APPROVED' && (
              <motion.div 
                key="approved"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Recovery Approved
                  </span>
                  <h2 className="text-2xl md:text-3xl font-black text-white font-outfit uppercase italic mt-3 leading-tight">
                    Temporary PIN Issued
                  </h2>
                  <p className="text-gray-400 text-xs mt-1">
                    Enter this PIN on your locker touchscreen keypad immediately.
                  </p>
                </div>

                {/* Prominent Locker and PIN Box */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative">
                  <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/5">
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Target Locker</span>
                    <span className="text-lg font-black text-white font-outfit uppercase">Locker #{lockerId}</span>
                  </div>

                  <div className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.3em] mb-2">
                    Temporary Recovery PIN
                  </div>
                  <div className="text-6xl font-black text-primary font-outfit tracking-[0.25em] py-2">
                    {temporaryPin || '••••'}
                  </div>

                  {/* Countdown Timer */}
                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-center gap-2 text-xs font-bold font-mono">
                    <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                    <span className="text-gray-400">Valid for:</span>
                    <span className={remainingSeconds < 60 ? 'text-rose-400 text-sm font-black' : 'text-amber-400 text-sm font-black'}>
                      {formatTimer(remainingSeconds)}
                    </span>
                  </div>
                </div>

                {/* Strict Warning */}
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 text-left flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-rose-200/90 leading-tight">
                    <strong className="text-rose-400 font-bold block mb-0.5">Critical Security Rule</strong>
                    Do NOT share this PIN with anyone. The PIN automatically expires in 5 minutes and will immediately self-invalidate upon first unlock.
                  </div>
                </div>

                <div className="text-[11px] text-gray-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                  <span>Waiting for keypad unlock entry on Locker #{lockerId}...</span>
                </div>
              </motion.div>
            )}

            {/* STEP 5: MANUAL REVIEW / BLOCKED */}
            {step === 'MANUAL_REVIEW' && (
              <motion.div 
                key="manual_review"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
                  <ShieldAlert className="w-8 h-8" />
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    Manual Verification Required
                  </span>
                  <h2 className="text-2xl font-black text-white font-outfit uppercase italic mt-3 leading-tight">
                    Locker Access Restricted
                  </h2>
                  <p className="text-gray-400 text-xs mt-1 max-w-sm mx-auto">
                    {reviewReason || 'Additional verification is required. Locker access has not been granted automatically.'}
                  </p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">
                    Next Steps for Passenger:
                  </h4>
                  <ul className="text-xs text-gray-400 space-y-2 list-disc pl-4">
                    <li>Contact the railway coach TTE or station master on duty.</li>
                    <li>Present valid physical government identification (Aadhaar / Voter ID / Passport).</li>
                    <li>Support helpline staff can verify your booking status via Request Reference: <strong className="text-white font-mono">{requestId || 'N/A'}</strong>.</li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <Link
                    href="/contact"
                    className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                  >
                    Contact Helpline
                  </Link>
                  <button
                    onClick={() => {
                      setStep('BOOKING_LOOKUP');
                      setError(null);
                    }}
                    className="flex-1 bg-primary hover:bg-primary/90 text-white py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                  >
                    Try Again
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 6: COMPLETED */}
            {step === 'COMPLETED' && (
              <motion.div 
                key="completed"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                  <ShieldCheck className="w-8 h-8" />
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Recovery Completed
                  </span>
                  <h2 className="text-2xl font-black text-white font-outfit uppercase italic mt-3 leading-tight">
                    Locker Unlocked Successfully
                  </h2>
                  <p className="text-gray-400 text-xs mt-1">
                    Your locker was opened using the temporary PIN. The emergency recovery request has now been finalized.
                  </p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                  <p className="text-xs text-gray-400 leading-relaxed">
                    The temporary recovery PIN has been securely retired. Standard session rules remain in effect.
                  </p>
                </div>

                <Link
                  href="/"
                  className="block w-full bg-primary hover:bg-primary/90 text-white py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-primary/20"
                >
                  Return to Home
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Support Footer note */}
        <div className="mt-8 text-center text-xs text-gray-500 flex items-center justify-center gap-4">
          <Link href="/help" className="hover:text-white transition-colors">Help Center</Link>
          <span>&bull;</span>
          <Link href="/contact" className="hover:text-white transition-colors">24/7 Helpline</Link>
          <span>&bull;</span>
          <Link href="/terms" className="hover:text-white transition-colors">Security Policy</Link>
        </div>
      </div>
    </div>
  );
}
