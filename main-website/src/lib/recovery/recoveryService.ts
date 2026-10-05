import { db } from '@/lib/firebase/config';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  getDocs,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { hashPIN, encryptData } from '@/lib/crypto';
import {
  EmergencyRecoveryRecord,
  RecoveryAuditEvent,
  RecoveryStatus,
  RiskState,
} from './recoveryTypes';
import {
  generateTemporaryPin,
  verifyEmergencyRecoveryCode,
} from './recoveryCrypto';
import {
  getIdentityVerificationProvider,
} from './demoDigiLockerProvider';
import {
  calculateNameSimilarity,
} from './identityProvider';

const RTDB_SECRET = 'ehwg3KYlrxk8jVP5wOQcX4YUZ66IZ1h1aHme2Uu';
const RTDB_URL = 'https://asep-smart-locker-default-rtdb.asia-southeast1.firebasedatabase.app';
const TEMPORARY_PIN_VALIDITY_MS = 5 * 60 * 1000; // 5 minutes default
const MAX_ATTEMPTS = 3;

/**
 * Direct server-side RTDB updater (REST)
 */
async function patchLockerRtdb(lockerId: string, payload: Record<string, unknown>) {
  const url = `${RTDB_URL}/${lockerId}.json?auth=${RTDB_SECRET}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      lastUpdated: Date.now(),
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to update locker RTDB state (status ${res.status})`);
  }
}

/**
 * Fetch current RTDB data for locker
 */
async function getLockerRtdb(lockerId: string): Promise<Record<string, unknown> | null> {
  const url = `${RTDB_URL}/${lockerId}.json?auth=${RTDB_SECRET}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return await res.json();
}

/**
 * Write a sanitized recovery audit log
 */
export async function logRecoveryAudit(event: RecoveryAuditEvent) {
  try {
    // 1. Write to recovery_audit_logs collection
    const auditRef = collection(db, 'recovery_audit_logs');
    await addDoc(auditRef, {
      ...event,
      createdAt: Date.now(),
    });

    // 2. Also mirror into system_logs for consolidated monitoring
    const sysLogsRef = collection(db, 'system_logs');
    await addDoc(sysLogsRef, {
      type: 'RECOVERY_EVENT',
      subType: event.eventType,
      lockerId: event.lockerId || 'N/A',
      bookingId: event.bookingId,
      timestamp: event.timestamp,
      message: `[${event.actor}] ${event.eventType}: ${event.details || event.result}`,
      severity: event.result === 'FAILURE' ? 'HIGH' : event.result === 'WARNING' ? 'MEDIUM' : 'INFO',
      acknowledged: false,
    });
  } catch (err) {
    console.error('[Recovery Audit Log Failed]', err);
  }
}

interface BookingDoc {
  id?: string;
  lockerId?: string | number;
  userName?: string;
  pnr?: string;
  trainNumber?: string;
  coach?: string;
  seat?: string;
  status?: string;
  pin?: string;
  recoveryCodeHash?: string;
}

/**
 * STEP 1: Verify Booking Details
 */
export async function verifyBookingForRecovery(params: {
  bookingId?: string;
  pnr?: string;
  lockerId?: string | number;
  passengerName: string;
  trainNumber?: string;
  coach?: string;
  seat?: string;
}): Promise<{
  success: boolean;
  requestId?: string;
  booking?: {
    id: string;
    lockerId: string | number;
    userName: string;
    hasRecoveryCode: boolean;
  };
  message: string;
  status: RecoveryStatus;
}> {
  const passengerName = params.passengerName?.trim();
  if (!passengerName) {
    return { success: false, message: 'Passenger name is required.', status: 'DENIED' };
  }

  let bookingData: BookingDoc | null = null;
  let bookingDocId: string = '';

  // 1. Locate booking by Booking ID
  if (params.bookingId?.trim()) {
    const bookingRef = doc(db, 'bookings', params.bookingId.trim());
    const snap = await getDoc(bookingRef);
    if (snap.exists()) {
      bookingData = snap.data() as BookingDoc;
      bookingDocId = snap.id;
    }
  }

  // 2. Locate booking by PNR
  if (!bookingData && params.pnr?.trim()) {
    const pnrQuery = query(collection(db, 'bookings'), where('pnr', '==', params.pnr.trim()), limit(1));
    const snaps = await getDocs(pnrQuery);
    if (!snaps.empty) {
      bookingData = snaps.docs[0].data() as BookingDoc;
      bookingDocId = snaps.docs[0].id;
    }
  }

  // 3. Locate booking by Locker Number
  if (!bookingData && params.lockerId) {
    const rawLockerId = String(params.lockerId).trim().replace(/^locker_/i, '').replace(/^#/i, '');
    const lockerDocRef = doc(db, 'lockers', `locker_${rawLockerId}`);
    const lockerSnap = await getDoc(lockerDocRef);
    if (lockerSnap.exists()) {
      const lData = lockerSnap.data();
      if (lData.bookingId) {
        const bSnap = await getDoc(doc(db, 'bookings', lData.bookingId));
        if (bSnap.exists()) {
          bookingData = bSnap.data() as BookingDoc;
          bookingDocId = bSnap.id;
        }
      }
    }
  }

  // 4. Fallback: Search active bookings matching passenger name
  if (!bookingData && passengerName) {
    try {
      const activeQuery = query(collection(db, 'bookings'), where('status', 'in', ['PAID', 'ACTIVE']), limit(15));
      const snaps = await getDocs(activeQuery);
      for (const d of snaps.docs) {
        const b = d.data() as BookingDoc;
        if (b.userName && calculateNameSimilarity(passengerName, b.userName) >= 0.7) {
          bookingData = b;
          bookingDocId = d.id;
          break;
        }
      }
    } catch (e) {
      console.warn('Active name query fallback:', e);
    }
  }

  if (!bookingData) {
    return {
      success: false,
      message: 'No matching booking found. Please check your Locker Number, Booking ID, or Train PNR.',
      status: 'DENIED',
    };
  }

  // 2. Verify booking is active and within allowed recovery period
  const lockerDocRef = doc(db, 'lockers', `locker_${bookingData.lockerId}`);
  const lockerSnap = await getDoc(lockerDocRef);
  const lockerData = lockerSnap.exists() ? lockerSnap.data() : null;

  if (bookingData.status !== 'PAID' && bookingData.status !== 'ACTIVE') {
    return {
      success: false,
      message: 'This booking is not active. Emergency recovery is only available for active sessions.',
      status: 'DENIED',
    };
  }

  if (lockerData && lockerData.status !== 'ACTIVE') {
    return {
      success: false,
      message: 'The associated locker is not currently active.',
      status: 'DENIED',
    };
  }

  // 3. Name similarity check with booking owner
  const expectedName = bookingData.userName || '';
  const similarity = calculateNameSimilarity(passengerName, expectedName);
  if (similarity < 0.6) {
    return {
      success: false,
      message: `The provided name "${passengerName}" does not match the booking owner on record.`,
      status: 'DENIED',
    };
  }

  // 4. Create Recovery Request record in Firestore
  const requestId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const recoveryRecord: EmergencyRecoveryRecord = {
    id: requestId,
    bookingId: bookingDocId,
    lockerId: String(bookingData.lockerId),
    passengerName,
    pnr: params.pnr || bookingData.pnr || '',
    trainNumber: params.trainNumber || bookingData.trainNumber || '',
    coach: params.coach || bookingData.coach || '',
    seat: params.seat || bookingData.seat || '',
    status: 'VERIFICATION_REQUIRED',
    riskState: 'LOW',
    recoveryCodeVerified: false,
    failedAttempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    createdAt: Date.now(),
    expiresAt: Date.now() + 15 * 60 * 1000, // 15 mins to complete multi-factor verification
    auditTrail: [
      {
        eventType: 'recovery_started',
        timestamp: Date.now(),
        requestId,
        bookingId: bookingDocId,
        lockerId: String(bookingData.lockerId),
        actor: 'PASSENGER',
        result: 'SUCCESS',
        details: 'Booking ownership initially verified against active record.',
      },
    ],
  };

  await setDoc(doc(db, 'emergency_recoveries', requestId), recoveryRecord);
  await logRecoveryAudit(recoveryRecord.auditTrail[0]);

  return {
    success: true,
    requestId,
    booking: {
      id: bookingDocId,
      lockerId: bookingData.lockerId || 'N/A',
      userName: bookingData.userName || '',
      hasRecoveryCode: !!bookingData.recoveryCodeHash,
    },
    message: 'Booking details verified. Please proceed with identity verification.',
    status: 'VERIFICATION_REQUIRED',
  };
}

/**
 * STEP 2: Verify Identity (DigiLocker abstraction / Demo mode)
 */
export async function verifyIdentityForRecovery(params: {
  requestId: string;
  documentType: 'AADHAAR' | 'PAN' | 'PASSPORT';
  documentReference: string; // Last 4 digits only
  simulateScenario?: 'MATCH' | 'MISMATCH' | 'FAILED';
}): Promise<{
  success: boolean;
  message: string;
  status: RecoveryStatus;
  result?: {
    provider: string;
    referenceId: string;
    confidence: number;
  };
}> {
  const reqRef = doc(db, 'emergency_recoveries', params.requestId);
  const snap = await getDoc(reqRef);
  if (!snap.exists()) {
    return { success: false, message: 'Recovery request expired or not found.', status: 'DENIED' };
  }

  const record = snap.data() as EmergencyRecoveryRecord;
  if (record.status === 'BLOCKED' || record.status === 'DENIED') {
    return { success: false, message: 'This recovery request is locked or denied.', status: record.status };
  }

  // Fetch original booking to get canonical owner name
  const bookingRef = doc(db, 'bookings', record.bookingId);
  const bookingSnap = await getDoc(bookingRef);
  const expectedName = (bookingSnap.exists() ? (bookingSnap.data() as BookingDoc).userName : record.passengerName) || '';

  const provider = getIdentityVerificationProvider(true);
  const verificationResult = await provider.verifyIdentity({
    providerId: 'demo-digilocker',
    documentType: params.documentType,
    documentReference: params.documentReference,
    passengerName: record.passengerName,
    expectedName,
    simulateScenario: params.simulateScenario,
  });

  const now = Date.now();
  if (!verificationResult.success || !verificationResult.isNameMatch) {
    const failedAttempts = (record.failedAttempts || 0) + 1;
    const isExceeded = failedAttempts >= record.maxAttempts;
    const nextStatus: RecoveryStatus = isExceeded ? 'MANUAL_REVIEW' : 'VERIFICATION_REQUIRED';
    const nextRisk: RiskState = isExceeded ? 'HIGH' : 'MEDIUM';

    const auditEvent: RecoveryAuditEvent = {
      eventType: 'identity_verification_failed',
      timestamp: now,
      requestId: record.id,
      bookingId: record.bookingId,
      lockerId: record.lockerId,
      actor: 'PASSENGER',
      result: 'FAILURE',
      details: verificationResult.message,
    };

    await updateDoc(reqRef, {
      status: nextStatus,
      riskState: nextRisk,
      failedAttempts,
      auditTrail: [...record.auditTrail, auditEvent],
    });
    await logRecoveryAudit(auditEvent);

    return {
      success: false,
      message: isExceeded
        ? 'Maximum verification attempts exceeded. Your request requires manual station review.'
        : verificationResult.message,
      status: nextStatus,
    };
  }

  // Identity verified and bound to booking
  const auditEvent: RecoveryAuditEvent = {
    eventType: 'identity_verification_passed',
    timestamp: now,
    requestId: record.id,
    bookingId: record.bookingId,
    lockerId: record.lockerId,
    actor: 'PASSENGER',
    result: 'SUCCESS',
    details: `Identity verified via ${verificationResult.provider} (Ref: ${verificationResult.referenceId}). Name match: ${(verificationResult.nameMatchConfidence * 100).toFixed(0)}%.`,
  };

  await updateDoc(reqRef, {
    identityVerification: {
      provider: verificationResult.provider,
      referenceId: verificationResult.referenceId,
      verifiedName: verificationResult.verifiedName,
      nameMatchConfidence: verificationResult.nameMatchConfidence,
      timestamp: now,
      rawStatus: verificationResult.rawStatus,
    },
    auditTrail: [...record.auditTrail, auditEvent],
  });
  await logRecoveryAudit(auditEvent);

  return {
    success: true,
    message: 'Identity verified successfully. Please enter your Emergency Recovery Code.',
    status: 'VERIFICATION_REQUIRED',
    result: {
      provider: verificationResult.provider,
      referenceId: verificationResult.referenceId,
      confidence: verificationResult.nameMatchConfidence,
    },
  };
}

/**
 * STEP 3: Verify Emergency Recovery Code and Issue Temporary PIN
 */
export async function approveRecoveryAndIssuePin(params: {
  requestId: string;
  recoveryCode: string;
}): Promise<{
  success: boolean;
  temporaryPin?: string;
  expiresAt?: number;
  lockerId?: string;
  message: string;
  status: RecoveryStatus;
}> {
  const reqRef = doc(db, 'emergency_recoveries', params.requestId);
  const snap = await getDoc(reqRef);
  if (!snap.exists()) {
    return { success: false, message: 'Recovery request not found.', status: 'DENIED' };
  }

  const record = snap.data() as EmergencyRecoveryRecord;
  if (record.status === 'APPROVED') {
    return {
      success: true,
      lockerId: record.lockerId,
      expiresAt: record.expiresAt,
      message: 'Recovery is already approved.',
      status: 'APPROVED',
    };
  }

  if (record.status === 'BLOCKED' || record.status === 'MANUAL_REVIEW') {
    return {
      success: false,
      message: 'This request requires manual station review and cannot be processed online.',
      status: record.status,
    };
  }

  // Must have passed identity verification first
  if (!record.identityVerification) {
    return {
      success: false,
      message: 'Identity verification must be completed before entering recovery code.',
      status: 'VERIFICATION_REQUIRED',
    };
  }

  // Fetch booking to verify recoveryCodeHash
  const bookingRef = doc(db, 'bookings', record.bookingId);
  const bookingSnap = await getDoc(bookingRef);
  if (!bookingSnap.exists()) {
    return { success: false, message: 'Booking reference not found.', status: 'DENIED' };
  }
  const bookingData = bookingSnap.data() as BookingDoc;

  // Validate recovery code
  const isMatch = verifyEmergencyRecoveryCode(params.recoveryCode, bookingData.recoveryCodeHash || '');
  const now = Date.now();

  if (!isMatch) {
    const failedAttempts = (record.failedAttempts || 0) + 1;
    const isExceeded = failedAttempts >= record.maxAttempts;
    const nextStatus: RecoveryStatus = isExceeded ? 'BLOCKED' : 'VERIFICATION_REQUIRED';
    const nextRisk: RiskState = isExceeded ? 'BLOCKED' : 'HIGH';

    const auditEvent: RecoveryAuditEvent = {
      eventType: 'recovery_code_failed',
      timestamp: now,
      requestId: record.id,
      bookingId: record.bookingId,
      lockerId: record.lockerId,
      actor: 'PASSENGER',
      result: 'FAILURE',
      details: `Invalid recovery code attempt (${failedAttempts}/${record.maxAttempts}).`,
    };

    await updateDoc(reqRef, {
      failedAttempts,
      status: nextStatus,
      riskState: nextRisk,
      auditTrail: [...record.auditTrail, auditEvent],
    });
    await logRecoveryAudit(auditEvent);

    return {
      success: false,
      message: isExceeded
        ? 'Maximum recovery attempts exceeded. Locker recovery has been blocked for security. Please visit station support.'
        : `Invalid Emergency Recovery Code. You have ${record.maxAttempts - failedAttempts} attempt(s) remaining.`,
      status: nextStatus,
    };
  }

  // --- MULTI-FACTOR VERIFICATION SUCCESSFUL ---
  // Generate 4-digit temporary PIN
  const temporaryPin = generateTemporaryPin();
  const temporaryPinHashed = hashPIN(temporaryPin); // SHA-256 for ESP32 comparison
  const temporaryPinEnc = encryptData(temporaryPin); // AES-256 for secure UI reference
  const expiresAt = now + TEMPORARY_PIN_VALIDITY_MS;

  // 1. Fetch current locker hardware state to preserve original PIN & unlock count
  const currentRtdb = await getLockerRtdb(record.lockerId);
  const originalPinHash = currentRtdb?.pin || bookingData.pin;
  const initialUnlockCount = currentRtdb?.unlockCount || 0;

  // 2. Patch EXISTING RTDB `pin` field understood by ESP32 firmware
  // CRITICAL: ESP32 reads `/<lockerId>.json` and validates `hashPIN(enteredPIN) == doc["pin"]`
  await patchLockerRtdb(record.lockerId, {
    pin: temporaryPinHashed,
    recoveryMode: true, // Metadata for backend/UI tracking, transparent to ESP32
  });

  // 3. Update Firestore locker doc with recovery metadata
  const lockerRef = doc(db, 'lockers', `locker_${record.lockerId}`);
  await updateDoc(lockerRef, {
    recoveryActive: true,
    recoveryRequestId: record.id,
    recoveryExpiresAt: expiresAt,
    originalPinHash,
    temporaryPinEncrypted: temporaryPinEnc,
    initialUnlockCount,
  });

  // 4. Update Emergency Recovery Record
  const approvedAuditEvent: RecoveryAuditEvent = {
    eventType: 'recovery_approved',
    timestamp: now,
    requestId: record.id,
    bookingId: record.bookingId,
    lockerId: record.lockerId,
    actor: 'SYSTEM',
    result: 'SUCCESS',
    details: 'Multi-factor verification succeeded. Temporary 5-minute recovery PIN issued.',
  };

  const pinIssuedAuditEvent: RecoveryAuditEvent = {
    eventType: 'temporary_pin_issued',
    timestamp: now,
    requestId: record.id,
    bookingId: record.bookingId,
    lockerId: record.lockerId,
    actor: 'SYSTEM',
    result: 'INFO',
    details: `Temporary PIN issued for Locker #${record.lockerId}. Expires at ${new Date(expiresAt).toLocaleTimeString()}.`,
  };

  await updateDoc(reqRef, {
    status: 'APPROVED',
    riskState: 'LOW',
    recoveryCodeVerified: true,
    temporaryPinHash: temporaryPinHashed,
    temporaryPinEncrypted: temporaryPinEnc,
    expiresAt,
    auditTrail: [...record.auditTrail, approvedAuditEvent, pinIssuedAuditEvent],
  });

  await logRecoveryAudit(approvedAuditEvent);
  await logRecoveryAudit(pinIssuedAuditEvent);

  return {
    success: true,
    temporaryPin,
    expiresAt,
    lockerId: record.lockerId,
    message: 'Recovery approved. Use your temporary PIN on the locker keypad within 5 minutes.',
    status: 'APPROVED',
  };
}

/**
 * STEP 4: Check Recovery Status / Enforce Expiration & Usage
 */
export async function syncRecoveryState(requestId: string): Promise<{
  status: RecoveryStatus;
  isExpired: boolean;
  isUsed: boolean;
  temporaryPin?: string;
  expiresAt?: number;
  lockerId?: string;
}> {
  const reqRef = doc(db, 'emergency_recoveries', requestId);
  const snap = await getDoc(reqRef);
  if (!snap.exists()) {
    return { status: 'DENIED', isExpired: true, isUsed: false };
  }

  const record = snap.data() as EmergencyRecoveryRecord;
  const now = Date.now();

  if (record.status !== 'APPROVED') {
    return {
      status: record.status,
      isExpired: record.expiresAt ? now > record.expiresAt : false,
      isUsed: record.status === 'USED',
      lockerId: record.lockerId,
    };
  }

  // Check if hardware locker was unlocked
  const lockerRef = doc(db, 'lockers', `locker_${record.lockerId}`);
  const lockerSnap = await getDoc(lockerRef);
  const lockerData = lockerSnap.exists() ? lockerSnap.data() : null;

  const currentRtdb = await getLockerRtdb(record.lockerId);
  const currentUnlockCount = currentRtdb?.unlockCount || 0;
  const initialUnlockCount = lockerData?.initialUnlockCount || 0;

  // Has the user unlocked the locker using the temporary PIN?
  if (currentUnlockCount > initialUnlockCount) {
    // Locker was opened! Complete recovery lifecycle.
    const usedAuditEvent: RecoveryAuditEvent = {
      eventType: 'recovery_used',
      timestamp: now,
      requestId: record.id,
      bookingId: record.bookingId,
      lockerId: record.lockerId,
      actor: 'PASSENGER',
      result: 'SUCCESS',
      details: 'Passenger successfully accessed locker via temporary recovery PIN.',
    };

    await updateDoc(reqRef, {
      status: 'USED',
      usedAt: now,
      auditTrail: [...record.auditTrail, usedAuditEvent],
    });

    // Revert RTDB PIN back to original or clear recovery mode
    if (lockerData?.originalPinHash) {
      await patchLockerRtdb(record.lockerId, {
        pin: lockerData.originalPinHash,
        recoveryMode: false,
      });
    }

    await updateDoc(lockerRef, {
      recoveryActive: false,
      recoveryExpiresAt: null,
      recoveryRequestId: null,
    });

    await logRecoveryAudit(usedAuditEvent);

    return {
      status: 'USED',
      isExpired: false,
      isUsed: true,
      lockerId: record.lockerId,
    };
  }

  // Check if PIN expired
  if (now > record.expiresAt) {
    const expiredAuditEvent: RecoveryAuditEvent = {
      eventType: 'recovery_expired',
      timestamp: now,
      requestId: record.id,
      bookingId: record.bookingId,
      lockerId: record.lockerId,
      actor: 'SYSTEM',
      result: 'WARNING',
      details: 'Temporary recovery PIN 5-minute validity window expired.',
    };

    await updateDoc(reqRef, {
      status: 'EXPIRED',
      auditTrail: [...record.auditTrail, expiredAuditEvent],
    });

    // Revert RTDB PIN back so expired temporary PIN can no longer be used
    if (lockerData?.originalPinHash) {
      await patchLockerRtdb(record.lockerId, {
        pin: lockerData.originalPinHash,
        recoveryMode: false,
      });
    }

    await updateDoc(lockerRef, {
      recoveryActive: false,
      recoveryExpiresAt: null,
      recoveryRequestId: null,
    });

    await logRecoveryAudit(expiredAuditEvent);

    return {
      status: 'EXPIRED',
      isExpired: true,
      isUsed: false,
      lockerId: record.lockerId,
    };
  }

  return {
    status: 'APPROVED',
    isExpired: false,
    isUsed: false,
    expiresAt: record.expiresAt,
    lockerId: record.lockerId,
  };
}

/**
 * Support / Admin Review helper
 */
export async function updateRecoveryReviewStatus(
  requestId: string,
  newStatus: 'APPROVED' | 'DENIED' | 'BLOCKED',
  notes: string,
  adminEmail: string
) {
  const reqRef = doc(db, 'emergency_recoveries', requestId);
  const snap = await getDoc(reqRef);
  if (!snap.exists()) throw new Error('Recovery request not found.');
  const record = snap.data() as EmergencyRecoveryRecord;

  const eventType = newStatus === 'APPROVED' ? 'recovery_approved' : newStatus === 'BLOCKED' ? 'recovery_blocked' : 'recovery_denied';
  const auditEvent: RecoveryAuditEvent = {
    eventType,
    timestamp: Date.now(),
    requestId,
    bookingId: record.bookingId,
    lockerId: record.lockerId,
    actor: 'ADMIN',
    result: newStatus === 'APPROVED' ? 'SUCCESS' : 'WARNING',
    details: `Admin (${adminEmail}) set status to ${newStatus}. Notes: ${notes}`,
  };

  await updateDoc(reqRef, {
    status: newStatus,
    adminNotes: notes,
    reviewedBy: adminEmail,
    reviewedAt: Date.now(),
    auditTrail: [...record.auditTrail, auditEvent],
  });

  await logRecoveryAudit(auditEvent);
}
