"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useLockerStore, Locker } from '@/store/useLockerStore';
import { useAuthStore } from '@/store/useAuthStore';
import { 
  ArrowLeft, 
  Box, 
  MapPin, 
  Train, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  ShieldCheck,
  Clock
} from 'lucide-react';

const LockerCard = ({ locker, onSelect }: { locker: Locker, onSelect: (l: Locker) => void }) => {
  const isAvailable = locker.status === 'AVAILABLE';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={isAvailable ? { y: -3 } : {}}
      className={`glass-panel p-5 rounded-2xl relative overflow-hidden transition-all duration-300 ${
        isAvailable ? 'hover:border-primary/50 border-white/5' : 'opacity-60 grayscale-[0.5] bg-black/40 border-white/2'
      }`}
    >
      <div className="flex justify-between items-start mb-5">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-outfit text-xl font-black text-white italic">
          {locker.id}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className={`px-2.5 py-1 rounded-full flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest border ${
            isAvailable 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
          }`}>
            <div className={`w-1 h-1 rounded-full ${isAvailable ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            {isAvailable ? 'Available' : 'Occupied'}
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-white/5 text-gray-400 border border-white/5">
            {locker.size || 'Medium'}
          </span>
        </div>
      </div>

      <div className="space-y-0.5 mb-6">
        <div className="text-lg font-black text-white font-outfit leading-none">₹{locker.price}<span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest ml-1">/ hr</span></div>
        <div className="text-[8px] font-bold text-gray-500 uppercase tracking-widest pt-2 flex flex-col gap-1">
          <span className="flex items-center gap-1.5 opacity-80"><ShieldCheck className="w-2.5 h-2.5 text-primary" /> Smart Digital Access</span>
          <span className="flex items-center gap-1.5 opacity-80"><Clock className="w-2.5 h-2.5 text-primary" /> 24/7 Monitoring</span>
        </div>
      </div>

      <button
        onClick={() => isAvailable && onSelect(locker)}
        disabled={!isAvailable}
        className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 uppercase tracking-widest ${
          isAvailable 
            ? 'bg-primary text-white hover:bg-primary-dark shadow-md shadow-primary/20' 
            : 'bg-white/5 text-gray-600 cursor-not-allowed'
        }`}
      >
        {isAvailable ? 'Select Unit' : 'Occupied'}
      </button>
    </motion.div>
  );
};

export default function SelectLockerPage() {
  const router = useRouter();
  const { lockers, loading, initLockers, cleanupExpired } = useLockerStore();
  const { user, initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();
    const unsubscribe = initLockers();
    cleanupExpired();
    return () => unsubscribe && unsubscribe();
  }, []);

  const handleSelect = (locker: Locker) => {
    sessionStorage.setItem("selectedLocker", JSON.stringify(locker));
    router.push('/book/confirm');
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-gray-400 font-medium uppercase tracking-[0.3em] text-xs">Accessing Grid...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-black text-white font-outfit uppercase italic tracking-tighter leading-none mb-1">
              Select Your <span className="text-primary italic">Locker</span>
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              <span className="flex items-center gap-1.5 opacity-80">
                <Train className="w-3 h-3 text-primary" /> Pune Junction
              </span>
              <span className="w-1 h-1 rounded-full bg-white/10" />
              <span className="flex items-center gap-1.5 opacity-80">
                <MapPin className="w-3 h-3 text-primary" /> Coach S3
              </span>
              <span className="w-1 h-1 rounded-full bg-white/10" />
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-black">
                Starting from ₹15/hour
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="bg-white/5 border border-white/5 px-4 py-2 rounded-2xl flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">{lockers.filter(l => l.status === 'AVAILABLE').length} Available</span>
          </div>
          <div className="bg-white/5 border border-white/5 px-4 py-2 rounded-2xl flex items-center gap-2">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">{lockers.filter(l => l.status === 'ACTIVE').length} Occupied</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5">
        {lockers.map((locker) => (
          <LockerCard 
            key={locker.id} 
            locker={locker} 
            onSelect={handleSelect}
          />
        ))}
      </div>

      <div className="mt-16 pt-8 border-t border-white/5 flex justify-center gap-8">
        <div className="flex items-center gap-2 opacity-50">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-[8px] font-black text-white uppercase tracking-[0.3em]">Active Status</span>
        </div>
        <div className="flex items-center gap-2 opacity-50">
          <div className="w-2 h-2 rounded-full bg-rose-400" />
          <span className="text-[8px] font-black text-white uppercase tracking-[0.3em]">Occupied Unit</span>
        </div>
      </div>
    </div>
  );
}
