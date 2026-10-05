import { NextResponse } from 'next/server';
import { verifyIdentityForRecovery } from '@/lib/recovery/recoveryService';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await verifyIdentityForRecovery(body);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    console.error('Verify identity API error:', error);
    return NextResponse.json({ success: false, message: (error as Error).message || 'Internal server error' }, { status: 500 });
  }
}
