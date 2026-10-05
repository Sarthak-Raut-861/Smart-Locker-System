import {
  IdentityVerificationProvider,
  IdentityVerificationRequest,
  IdentityVerificationResult,
  calculateNameSimilarity,
} from './identityProvider';

/**
 * Demo DigiLocker Identity Verification Provider
 *
 * NOTE: This is an explicitly labeled demo provider for local development,
 * testing, and prototype evaluation. It simulates realistic DigiLocker API responses
 * without storing or requiring raw government ID numbers.
 */
export class DemoDigiLockerProvider implements IdentityVerificationProvider {
  id = 'demo-digilocker';
  name = 'Demo DigiLocker Verification';
  isDemo = true;

  async verifyIdentity(request: IdentityVerificationRequest): Promise<IdentityVerificationResult> {
    const refId = `DL_DEMO_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Handle explicit simulation scenario if supplied (for interactive testing / UI selector)
    if (request.simulateScenario === 'FAILED') {
      return {
        success: false,
        provider: this.name,
        referenceId: refId,
        nameMatchConfidence: 0,
        isNameMatch: false,
        timestamp: Date.now(),
        message: 'Demo DigiLocker service simulated an authentication failure or document lookup error.',
        rawStatus: 'REJECTED',
      };
    }

    if (request.simulateScenario === 'MISMATCH') {
      const simulatedMismatchName = 'Vikramaditya Shinde';
      const confidence = calculateNameSimilarity(simulatedMismatchName, request.expectedName);
      return {
        success: true, // Verification service verified the person, but name mismatch will be caught
        provider: this.name,
        referenceId: refId,
        verifiedName: simulatedMismatchName,
        nameMatchConfidence: confidence,
        isNameMatch: confidence >= 0.75,
        timestamp: Date.now(),
        message: `DigiLocker verified document for "${simulatedMismatchName}", which does NOT match the booking owner "${request.expectedName}".`,
        rawStatus: 'MISMATCH',
      };
    }

    // Default or 'MATCH': Verified person matching the submitted passenger name
    const verifiedName = request.passengerName.trim();
    const confidence = calculateNameSimilarity(verifiedName, request.expectedName);
    const isNameMatch = confidence >= 0.75;

    return {
      success: true,
      provider: this.name,
      referenceId: refId,
      verifiedName,
      nameMatchConfidence: confidence,
      isNameMatch,
      timestamp: Date.now(),
      message: isNameMatch
        ? `DigiLocker identity verified successfully. Name match confidence: ${(confidence * 100).toFixed(0)}%.`
        : `DigiLocker identity verified, but name similarity with booking owner is too low (${(confidence * 100).toFixed(0)}%).`,
      rawStatus: isNameMatch ? 'VERIFIED' : 'MISMATCH',
    };
  }
}

/**
 * Production DigiLocker Requester Integration Stub
 * Provides the extension point for live DigiLocker OAuth / Requester Gateway.
 */
export class ProductionDigiLockerProvider implements IdentityVerificationProvider {
  id = 'digilocker';
  name = 'DigiLocker Government ID Gateway';
  isDemo = false;

  private clientId: string | undefined;
  private clientSecret: string | undefined;

  constructor() {
    this.clientId = process.env.DIGILOCKER_CLIENT_ID;
    this.clientSecret = process.env.DIGILOCKER_CLIENT_SECRET;
  }

  async verifyIdentity(_request: IdentityVerificationRequest): Promise<IdentityVerificationResult> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error(
        'DigiLocker production credentials are not configured. Set DIGILOCKER_CLIENT_ID and DIGILOCKER_CLIENT_SECRET.'
      );
    }

    // In a live integration, this would invoke the DigiLocker OAuth / Pull URI / e-Aadhaar XML parser
    // and extract the verified person's canonical name for matching.
    throw new Error('DigiLocker live API is not currently connected to live government endpoint.');
  }
}

export function getIdentityVerificationProvider(preferDemo: boolean = true): IdentityVerificationProvider {
  if (preferDemo || !process.env.DIGILOCKER_CLIENT_ID) {
    return new DemoDigiLockerProvider();
  }
  return new ProductionDigiLockerProvider();
}
