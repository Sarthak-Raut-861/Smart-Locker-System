import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

export async function GET() {
  try {
    const q = query(collection(db, 'emergency_recoveries'), orderBy('createdAt', 'desc'), limit(50));
    const snaps = await getDocs(q);
    const requests = snaps.docs.map(d => ({
      ...d.data(),
      id: d.id,
      // Never expose sensitive temporaryPin or raw hashes in list
      temporaryPin: undefined,
      temporaryPinHash: undefined,
      temporaryPinEncrypted: undefined,
    }));
    return NextResponse.json({ success: true, requests });
  } catch (error: unknown) {
    console.error('Fetch recovery requests API error:', error);
    return NextResponse.json({ success: false, message: (error as Error).message || 'Internal server error' }, { status: 500 });
  }
}
