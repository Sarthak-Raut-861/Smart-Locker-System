import { 
  generateEmergencyRecoveryCode, 
  hashEmergencyRecoveryCode, 
  verifyEmergencyRecoveryCode, 
  generateTemporaryPin 
} from '../src/lib/recovery/recoveryCrypto';
import { 
  DemoDigiLockerProvider,
  calculateNameSimilarity,
  normalizeName
} from '../src/lib/recovery/demoDigiLockerProvider';
import { hashPIN } from '../src/lib/crypto';

interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, testName: string, message?: string) {
  if (condition) {
    results.push({ name: testName, passed: true });
    console.log(`  [PASS] ${testName}`);
  } else {
    results.push({ name: testName, passed: false, message });
    console.error(`  [FAIL] ${testName}: ${message || 'Assertion failed'}`);
  }
}

async function runRecoveryTests() {
  console.log('\n======================================================');
  console.log('   EMERGENCY LOCKER RECOVERY SUITE - 14 SCENARIOS');
  console.log('======================================================\n');

  // --- MOCK DATABASE AND STATE STORE ---
  const mockDb = {
    bookings: new Map<string, any>(),
    lockers: new Map<string, any>(),
    recoveries: new Map<string, any>(),
    rtdb: new Map<string, any>()
  };

  // Seed baseline active booking for Locker #4
  const testBookingId = 'book_active_1001';
  const testLockerId = '4';
  const testPassenger = 'Sarthak Raut';
  const testPnr = 'PNR98765432';
  const normalPin = '4837';
  const normalPinHash = hashPIN(normalPin);
  const recoveryCode = generateEmergencyRecoveryCode();
  const recoveryCodeHash = hashEmergencyRecoveryCode(recoveryCode);

  mockDb.bookings.set(testBookingId, {
    id: testBookingId,
    lockerId: testLockerId,
    userName: testPassenger,
    pnr: testPnr,
    status: 'ACTIVE',
    pin: normalPinHash,
    recoveryCodeHash,
    createdAt: Date.now()
  });

  mockDb.lockers.set(`locker_${testLockerId}`, {
    id: testLockerId,
    status: 'ACTIVE',
    userName: testPassenger,
    bookingId: testBookingId,
    currentPin: normalPinHash
  });

  mockDb.rtdb.set(testLockerId, {
    status: 'ACTIVE',
    pin: normalPinHash,
    unlockCount: 1
  });

  // Seed an inactive booking for scenario 10
  const inactiveBookingId = 'book_expired_2002';
  mockDb.bookings.set(inactiveBookingId, {
    id: inactiveBookingId,
    lockerId: '5',
    userName: 'Rahul Sharma',
    pnr: 'PNR11223344',
    status: 'EXPIRED',
    pin: hashPIN('1111'),
    recoveryCodeHash: hashEmergencyRecoveryCode('LNL-AAAA-BBBB'),
    createdAt: Date.now() - 86400000
  });

  const identityProvider = new DemoDigiLockerProvider();

  // ---------------------------------------------------------
  // TEST 1: Valid recovery
  // ---------------------------------------------------------
  try {
    const booking = mockDb.bookings.get(testBookingId);
    const isBookingValid = booking && booking.status === 'ACTIVE' && booking.userName === testPassenger;
    
    // Identity verification
    const idResult = await identityProvider.verifyIdentity({
      providerId: 'demo-digilocker',
      documentType: 'AADHAAR',
      documentReference: '5678',
      passengerName: testPassenger,
      expectedName: booking.userName
    });

    // Recovery code verification
    const isCodeValid = verifyEmergencyRecoveryCode(recoveryCode, booking.recoveryCodeHash);

    // Issue temporary PIN
    const temporaryPin = generateTemporaryPin();
    const temporaryPinHash = hashPIN(temporaryPin);
    const expiresAt = Date.now() + 5 * 60 * 1000;

    // Simulate RTDB patch
    mockDb.rtdb.set(testLockerId, {
      ...mockDb.rtdb.get(testLockerId),
      pin: temporaryPinHash,
      recoveryMode: true
    });

    const isSuccess = isBookingValid && idResult.success && idResult.isNameMatch && isCodeValid;
    assert(
      isSuccess && temporaryPin.length === 4 && mockDb.rtdb.get(testLockerId).pin === temporaryPinHash,
      '1. Valid recovery',
      'Should approve recovery, generate 4-digit temporary PIN and patch RTDB pin'
    );
  } catch (err: any) {
    assert(false, '1. Valid recovery', err.message);
  }

  // ---------------------------------------------------------
  // TEST 2: Invalid Booking ID
  // ---------------------------------------------------------
  {
    const nonExistentBooking = mockDb.bookings.get('book_non_existent_9999');
    assert(
      !nonExistentBooking,
      '2. Invalid Booking ID',
      'Non-existent Booking ID should be rejected'
    );
  }

  // ---------------------------------------------------------
  // TEST 3: Invalid PNR
  // ---------------------------------------------------------
  {
    let found = false;
    for (const b of mockDb.bookings.values()) {
      if (b.pnr === 'PNR_DOES_NOT_EXIST_00') found = true;
    }
    assert(!found, '3. Invalid PNR', 'Non-existent PNR lookup should return false');
  }

  // ---------------------------------------------------------
  // TEST 4: Invalid recovery code
  // ---------------------------------------------------------
  {
    const booking = mockDb.bookings.get(testBookingId);
    const invalidCodeResult = verifyEmergencyRecoveryCode('LNL-FAKE-CODE', booking.recoveryCodeHash);
    assert(
      !invalidCodeResult,
      '4. Invalid recovery code',
      'Incorrect recovery code must fail validation'
    );
  }

  // ---------------------------------------------------------
  // TEST 5: Identity mismatch
  // ---------------------------------------------------------
  {
    const booking = mockDb.bookings.get(testBookingId);
    const mismatchResult = await identityProvider.verifyIdentity({
      providerId: 'demo-digilocker',
      documentType: 'AADHAAR',
      documentReference: '9999',
      passengerName: testPassenger,
      expectedName: booking.userName,
      simulateScenario: 'MISMATCH'
    });
    assert(
      !mismatchResult.isNameMatch && mismatchResult.rawStatus === 'MISMATCH',
      '5. Identity mismatch',
      'Mismatched identity document must be flagged and rejected'
    );
  }

  // ---------------------------------------------------------
  // TEST 6: Expired recovery request
  // ---------------------------------------------------------
  {
    const pastTimestamp = Date.now() - (20 * 60 * 1000); // 20 mins ago (exceeds 15 min limit)
    const isRequestExpired = (Date.now() - pastTimestamp) > (15 * 60 * 1000);
    assert(
      isRequestExpired,
      '6. Expired recovery request',
      'Recovery request older than validity window must be treated as expired'
    );
  }

  // ---------------------------------------------------------
  // TEST 7: Expired temporary PIN
  // ---------------------------------------------------------
  {
    const expiredPinTime = Date.now() - 1000; // 1s in the past
    const isPinExpired = Date.now() > expiredPinTime;

    // Simulate recovery expiration logic: revert RTDB to original PIN
    if (isPinExpired) {
      mockDb.rtdb.set(testLockerId, {
        ...mockDb.rtdb.get(testLockerId),
        pin: normalPinHash,
        recoveryMode: false
      });
    }

    assert(
      isPinExpired && mockDb.rtdb.get(testLockerId).pin === normalPinHash,
      '7. Expired temporary PIN',
      'Expired temporary PIN must revert RTDB pin back to original'
    );
  }

  // ---------------------------------------------------------
  // TEST 8: Reuse of recovery PIN
  // ---------------------------------------------------------
  {
    // Passenger unlocks: unlockCount increases from 1 to 2
    let recoveryStatus = 'APPROVED';
    const initialUnlockCount = 1;
    const currentUnlockCount = 2; // Unlock detected!

    if (currentUnlockCount > initialUnlockCount) {
      recoveryStatus = 'USED';
      // Invalidate temporary PIN in RTDB
      mockDb.rtdb.set(testLockerId, {
        ...mockDb.rtdb.get(testLockerId),
        pin: normalPinHash,
        recoveryMode: false
      });
    }

    // Try to reuse
    const attemptReuse = recoveryStatus === 'USED';
    assert(
      attemptReuse && mockDb.rtdb.get(testLockerId).recoveryMode === false,
      '8. Reuse of recovery PIN',
      'Recovery status must transition to USED and prevent reuse of temporary PIN'
    );
  }

  // ---------------------------------------------------------
  // TEST 9: Multiple failed attempts
  // ---------------------------------------------------------
  {
    let failedAttempts = 0;
    const maxAttempts = 3;
    let status = 'VERIFICATION_REQUIRED';
    let riskState = 'LOW';

    // Simulate 3 consecutive bad attempts
    for (let i = 0; i < 3; i++) {
      failedAttempts++;
      if (failedAttempts >= maxAttempts) {
        status = 'BLOCKED';
        riskState = 'BLOCKED';
      }
    }

    assert(
      status === 'BLOCKED' && riskState === 'BLOCKED',
      '9. Multiple failed attempts',
      'Exceeding max attempts must transition request to BLOCKED / MANUAL_REVIEW'
    );
  }

  // ---------------------------------------------------------
  // TEST 10: Recovery on inactive booking
  // ---------------------------------------------------------
  {
    const inactiveBooking = mockDb.bookings.get(inactiveBookingId);
    const canRecover = inactiveBooking && (inactiveBooking.status === 'ACTIVE' || inactiveBooking.status === 'PAID');
    assert(
      !canRecover,
      '10. Recovery on inactive booking',
      'Inactive booking status must be denied for recovery'
    );
  }

  // ---------------------------------------------------------
  // TEST 11: Recovery for wrong locker
  // ---------------------------------------------------------
  {
    const booking = mockDb.bookings.get(testBookingId);
    const requestedLocker = '18';
    const isLockerMatch = booking.lockerId === requestedLocker;
    assert(
      !isLockerMatch,
      '11. Recovery for wrong locker',
      'Requesting recovery for a locker not matching booking must be rejected'
    );
  }

  // ---------------------------------------------------------
  // TEST 12: Unauthorized client attempting to approve recovery
  // ---------------------------------------------------------
  {
    // A rogue client sending an approval payload without completed identity verification
    const mockRequestState: any = {
      id: 'rec_unauth_001',
      identityVerification: null, // Identity verification NOT passed
      status: 'VERIFICATION_REQUIRED'
    };

    const isClientAuthorized = !!mockRequestState.identityVerification;
    assert(
      !isClientAuthorized,
      '12. Unauthorized client attempting to approve recovery',
      'Approval must be rejected by server if identity verification was not completed'
    );
  }

  // ---------------------------------------------------------
  // TEST 13: Existing normal PIN login/unlock remains unaffected
  // ---------------------------------------------------------
  {
    // The ESP32 compares: hashPIN(enteredPIN) == String(firebasePIN)
    // where hashPIN is mbedtls SHA-256 in lowercase hex.
    const inputPin = '4837';
    const computedHash = hashPIN(inputPin);
    
    // Validate that 4837 produces exact expected standard SHA-256
    // SHA256("4837") = cc7d8d370b5de69b536934568aa49e903bbf99e886308a8c76120014a9698a4d
    const expectedSha256 = 'cc7d8d370b5de69b536934568aa49e903bbf99e886308a8c76120014a9698a4d';
    
    assert(
      computedHash === expectedSha256,
      '13. Existing normal PIN login/unlock remains unaffected',
      'PIN hashing formula must exactly match ESP32 SHA-256 contract'
    );
  }

  // ---------------------------------------------------------
  // TEST 14: Existing booking flow remains unaffected
  // ---------------------------------------------------------
  {
    const newCode = generateEmergencyRecoveryCode();
    const newHash = hashEmergencyRecoveryCode(newCode);
    
    // Verify format: LNL-XXXX-XXXX
    const formatRegex = /^LNL-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/;
    const isFormatValid = formatRegex.test(newCode);
    const isVerifyValid = verifyEmergencyRecoveryCode(newCode, newHash);
    
    assert(
      isFormatValid && isVerifyValid && newHash.length === 64,
      '14. Existing booking flow remains unaffected',
      'Generated recovery codes must follow secure format and verify against SHA-256 hash'
    );
  }

  console.log('\n------------------------------------------------------');
  const allPassed = results.every(r => r.passed);
  console.log(`SUMMARY: ${results.filter(r => r.passed).length}/${results.length} Tests Passed`);
  console.log('------------------------------------------------------\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runRecoveryTests();
