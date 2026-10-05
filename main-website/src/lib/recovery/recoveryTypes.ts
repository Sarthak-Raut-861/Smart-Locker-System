export type RecoveryStatus =
  | 'PENDING'
  | 'VERIFICATION_REQUIRED'
  | 'APPROVED'
  | 'DENIED'
  | 'EXPIRED'
  | 'USED'
  | 'BLOCKED'
  | 'MANUAL_REVIEW';

export type RiskState = 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';

export interface RecoveryAuditEvent {
  eventType:
    | 'recovery_started'
    | 'booking_verified'
    | 'identity_verification_started'
    | 'identity_verification_passed'
    | 'identity_verification_failed'
    | 'recovery_code_verified'
    | 'recovery_code_failed'
    | 'recovery_approved'
    | 'temporary_pin_issued'
    | 'recovery_expired'
    | 'recovery_used'
    | 'recovery_denied'
    | 'recovery_blocked'
    | 'manual_review_required';
  timestamp: number;
  requestId: string;
  bookingId: string;
  lockerId?: string;
  actor: 'PASSENGER' | 'SYSTEM' | 'ADMIN';
  result: 'SUCCESS' | 'FAILURE' | 'WARNING' | 'INFO';
  details?: string;
}

export interface EmergencyRecoveryRecord {
  id: string; // rec_...
  bookingId: string;
  lockerId: string;
  passengerName: string;
  pnr?: string;
  trainNumber?: string;
  coach?: string;
  seat?: string;
  
  status: RecoveryStatus;
  riskState: RiskState;
  
  identityVerification?: {
    provider: string;
    referenceId: string;
    verifiedName?: string;
    nameMatchConfidence: number;
    timestamp: number;
    rawStatus: string;
  };
  
  recoveryCodeVerified: boolean;
  failedAttempts: number;
  maxAttempts: number;
  
  temporaryPin?: string; // Stored only in transit / server-side response; never logged in plain text audit
  temporaryPinHash?: string; // SHA-256
  temporaryPinEncrypted?: string; // AES-256
  
  createdAt: number;
  expiresAt: number; // 5 min default window for temporary PIN
  usedAt?: number;
  denialReason?: string;
  
  auditTrail: RecoveryAuditEvent[];
}
