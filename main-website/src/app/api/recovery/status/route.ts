import { NextResponse } from 'next/server';
import { syncRecoveryState } from '@/lib/recovery/recoveryService';

export async function POST(req: Request) {
  try {
    const { requestId } = await req.json();
    if (!requestId) {
      return NextResponse.json({ success: false, message: 'Request ID is required' }, { status: 400 });
    }
    const result = await syncRecoveryState(requestId);
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    console.error('Recovery status sync API error:', error);
    return NextResponse.json({ success: false, message: (error as Error).message || 'Internal server error' }, { status: 500 });
  }
}
