"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  History as HistoryIcon, 
  Trash2, 
  Calendar, 
  Clock, 
  IndianRupee,
  Loader2,
  ShieldCheck,
  ReceiptText
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { db } from '@/lib/firebase/config';
import { collection, query, where, onSnapshot, getDocs, deleteDoc, doc } from 'firebase/firestore';

const HistoryCard = ({ entry }: { entry: any }) => {
  const timestamp = entry.startTime || entry.createdAt || entry.timestamp || Date.now();
  const date = new Date(timestamp).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const amount = Number(entry.amount || 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel p-6 rounded-3xl border-white/5 hover:border-primary/30 transition-all group relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-6 opacity-3 shadow-text">
        <ReceiptText className="w-16 h-16 text-white" />
      </div>

      <div className="flex justify-between items-start mb-5 pb-5 border-b border-white/5 relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center font-outfit text-xl font-black text-primary italic">
            {entry.lockerId}
          </div>
          <div>
            <h4 className="text-white font-bold text-sm tracking-tight font-outfit">Pune Junction, Coach S3</h4>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em] mt-2">
              <Calendar className="w-3.5 h-3.5 text-primary/60" /> {date}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold text-gray-700 uppercase tracking-widest leading-none mb-1.5">Amount Paid</div>
          <div className="text-2xl font-black text-white font-outfit tracking-tight">₹{amount.toFixed(0)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 relative z-10">
        <div className="space-y-1">
          <div className="text-[9px] font-black text-gray-700 uppercase tracking-[0.3em]">Total Duration</div>
          <div className="text-xs font-bold text-white tracking-widest uppercase">
            {entry.duration > 300000 ? (entry.duration / 3600000).toFixed(0) : entry.duration} {entry.duration > 300000 ? 'Hours' : 'Hr'}
          </div>
        </div>
        <div className="space-y-1 text-right">
          <div className="text-[9px] font-black text-gray-700 uppercase tracking-[0.3em]">Unit Rate</div>
          <div className="text-xs font-bold text-gray-500 tracking-widest uppercase">₹{entry.rate || 25}/hr</div>
        </div>
      </div>
    </motion.div>
  );
};

export default function HistoryPage() {
  const router = useRouter();
  const { user, initAuth } = useAuthStore();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    initAuth();
  }, []);

  useEffect(() => {
    if (user?.uid) {
      const q = query(
        collection(db, "bookings"),
        where("userId", "==", user.uid)
      );

      const unsub = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        data.sort((a, b) => (b.startTime || 0) - (a.startTime || b.createdAt || 0));
        setHistory(data);
        setLoading(false);
      });

      return () => unsub();
    }
  }, [user?.uid]);

  const handleClearHistory = async () => {
    if (!user?.uid || history.length === 0) return;
    if (!confirm(`Permanently delete all digital receipts?`)) return;

    setClearing(true);
    try {
      const promises = history.map(h => deleteDoc(doc(db, "bookings", h.id)));
      await Promise.all(promises);
    } catch (err) {
      console.error(err);
    } finally {
      setClearing(false);
    }
  };

  if (loading && !user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-gray-400 font-medium tracking-[0.3em] uppercase text-xs">Accessing Archives...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="mb-12">
        <div className="flex justify-between items-start mb-10">
          <div>
            <h1 className="text-3xl font-black text-white font-outfit uppercase italic tracking-tighter leading-none mb-1">
              Storage <span className="text-primary italic">History</span>
            </h1>
            <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest">Digital archives and session receipts.</p>
          </div>

          {history.length > 0 && (
            <button 
              onClick={handleClearHistory}
              disabled={clearing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[10px] font-bold text-rose-500 hover:bg-rose-500 hover:text-white transition-all uppercase tracking-widest group"
            >
              <Trash2 className="w-4 h-4" />
              Clear Records
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <AnimatePresence mode='popLayout'>
            {history.length > 0 ? (
              history.map((entry) => (
                <HistoryCard key={entry.id} entry={entry} />
              ))
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-full glass-panel p-20 rounded-[3rem] text-center border-dashed border-white/5"
              >
                <div className="w-16 h-16 rounded-full bg-white/2 flex items-center justify-center mx-auto mb-6">
                  <HistoryIcon className="w-8 h-8 text-gray-800" />
                </div>
                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest">No archives found</h4>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {history.length > 0 && (
          <div className="mt-16 pt-8 border-t border-white/5 flex flex-col items-center gap-4 text-center">
            <ShieldCheck className="w-6 h-6 text-white/10" />
            <p className="text-[8px] text-gray-700 font-bold uppercase tracking-[0.3em] leading-relaxed">
              Session data is end-to-end encrypted <br /> and stored for your security and records.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
