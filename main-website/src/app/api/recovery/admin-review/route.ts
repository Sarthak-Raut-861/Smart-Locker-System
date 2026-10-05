import { NextResponse } from 'next/server';
import { updateRecoveryReviewStatus } from '@/lib/recovery/recoveryService';

export async function POST(req: Request) {
  try {
    const { requestId, status, notes, adminEmail } = await req.json();
    if (!requestId || !status) {
      return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
    }
    await updateRecoveryReviewStatus(requestId, status, notes || '', adminEmail || 'admin@locknleave.system');
    return NextResponse.json({ success: true, message: `Request updated to ${status}` });
  } catch (error: unknown) {
    console.error('Admin review API error:', error);
    return NextResponse.json({ success: false, message: (error as Error).message || 'Internal server error' }, { status: 500 });
  }
}
