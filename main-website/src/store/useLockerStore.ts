"use client";

import { create } from 'zustand';
import { db, rtdb } from '@/lib/firebase/config';
import { collection, onSnapshot, doc, updateDoc, getDocs } from 'firebase/firestore';
import { ref, update } from 'firebase/database';

export interface Locker {
  id: string; 
  firestoreId: string;
  status: 'AVAILABLE' | 'ACTIVE';
  price: number;
  size: string;
}

interface LockerStore {
  lockers: Locker[];
  loading: boolean;
  initLockers: () => () => void;
  cleanupExpiredLocker: (firestoreId: string) => Promise<void>;
  cleanupExpired: () => Promise<void>;
}

export const useLockerStore = create<LockerStore>((set, get) => ({
  lockers: Array.from({ length: 20 }, (_, i) => {
    const id = i + 1;
    let size = 'Medium';
    let price = 25;
    if (id === 4) {
      size = 'Medium';
      price = 25;
    } else if (id <= 6) {
      size = 'Small';
      price = 15;
    } else if (id > 16) {
      size = 'Large';
      price = 40;
    }
    return {
      id: String(id),
      firestoreId: `locker_${id}`,
      status: 'AVAILABLE' as const,
      size,
      price
    };
  }),
  loading: true,

  initLockers: () => {
    // Immediate listener for real-time grid updates
    return onSnapshot(collection(db, "lockers"), (snapshot) => {
      const now = Date.now();
      const updatedStatuses: Record<string, 'ACTIVE' | 'AVAILABLE'> = {};
      const metaOverrides: Record<string, { size?: string; price?: number }> = {};

      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const id = docSnap.id.replace('locker_', '');
        if (data.size || data.price) {
          metaOverrides[id] = { size: data.size, price: data.price };
        }
        
        if (data.status === 'ACTIVE') {
          let sessionEnd = data.sessionEnd;
          if (!sessionEnd && data.startTime && data.duration) {
            sessionEnd = data.startTime + data.duration;
          }

          const isExpired = sessionEnd && sessionEnd > 0 && sessionEnd <= now;
          const isAbandoned = data.status === 'ACTIVE' && data.startTime === null && data.lastUpdated && (now - data.lastUpdated > 120 * 60 * 1000); // 2 hr grace period — user may be walking to locker

          if (isExpired || isAbandoned) {
            get().cleanupExpiredLocker(docSnap.id);
            updatedStatuses[id] = 'AVAILABLE';
          } else {
            updatedStatuses[id] = 'ACTIVE';
          }
        } else {
          updatedStatuses[id] = 'AVAILABLE';
        }
      });

      set(state => ({
        lockers: state.lockers.map(l => ({
          ...l,
          size: metaOverrides[l.id]?.size || l.size,
          price: metaOverrides[l.id]?.price || l.price,
          status: updatedStatuses[l.id] || 'AVAILABLE'
        })),
        loading: false
      }));
    });
  },

  cleanupExpiredLocker: async (firestoreId: string) => {
    const numericId = firestoreId.replace('locker_', '');
    try {
      // Check if item is left behind via RTDB
      const { get } = await import('firebase/database');
      const rtdbSnap = await get(ref(rtdb, numericId));
      const rtdbData = rtdbSnap.val();
      const itemPresent = rtdbData?.itemPresent || false;

      // Keep user info if item is left behind
      let firestoreUpdate: any = {
        status: "AVAILABLE",
        lastUpdated: Date.now(),
        startTime: null,
        duration: 0,
        currentPin: null,
      };

      if (itemPresent) {
        // Keep userId and sessionEnd to calculate time left behind
        firestoreUpdate.itemLeftBehind = true;
      } else {
        firestoreUpdate.userId = null;
        firestoreUpdate.sessionEnd = 0;
        firestoreUpdate.itemLeftBehind = false;
      }

      await updateDoc(doc(db, "lockers", firestoreId), firestoreUpdate);

      let rtdbUpdate: any = {
        status: "AVAILABLE",
        pin: null,
        startTime: 0,
        duration: 0,
        unlockCount: 0,
      };
      
      if (!itemPresent) {
         rtdbUpdate.sessionEnd = 0;
      }
      await update(ref(rtdb, numericId), rtdbUpdate);
    } catch (err) {
      console.error("Cleanup error:", err);
    }
  },

  cleanupExpired: async () => {
    const now = Date.now();
    try {
      const snapshot = await getDocs(collection(db, "lockers"));
      snapshot.forEach(async (docSnap) => {
        const data = docSnap.data();
        const isExpired = data.sessionEnd && data.sessionEnd > 0 && data.sessionEnd <= now;
        const isAbandoned = data.status === "ACTIVE" && data.startTime === null && data.lastUpdated && (now - data.lastUpdated > 120 * 60 * 1000); // 2 hr grace period
        if (data.status === "ACTIVE" && (isExpired || isAbandoned)) {
          await get().cleanupExpiredLocker(docSnap.id);
        }
      });
    } catch (err) {
      console.error("Batch cleanup error:", err);
    }
  }
}));
