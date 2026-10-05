export interface IdentityVerificationRequest {
  providerId: 'demo-digilocker' | 'digilocker';
  documentType: 'AADHAAR' | 'PAN' | 'PASSPORT';
  documentReference: string; // Last 4 digits or mock token — never raw Aadhaar
  passengerName: string;
  expectedName: string;
  simulateScenario?: 'MATCH' | 'MISMATCH' | 'FAILED';
}

export interface IdentityVerificationResult {
  success: boolean;
  provider: string;
  referenceId: string;
  verifiedName?: string;
  nameMatchConfidence: number; // 0 to 1
  isNameMatch: boolean;
  timestamp: number;
  message: string;
  rawStatus: 'VERIFIED' | 'MISMATCH' | 'REJECTED' | 'ERROR';
}

export interface IdentityVerificationProvider {
  id: string;
  name: string;
  isDemo: boolean;
  verifyIdentity(request: IdentityVerificationRequest): Promise<IdentityVerificationResult>;
}

/**
 * Standard name normalizer for robust Indian name matching (handles case, spacing, initials)
 */
export function normalizeName(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates string similarity ratio (0 to 1) using Levenshtein distance
 */
export function calculateNameSimilarity(a: string, b: string): number {
  const normA = normalizeName(a);
  const normB = normalizeName(b);

  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;
  if (normA.includes(normB) || normB.includes(normA)) return 0.9;

  // Simple token overlap check (for initials and order of names)
  const tokensA = new Set(normA.split(' '));
  const tokensB = new Set(normB.split(' '));
  let intersection = 0;
  tokensA.forEach(t => { if (tokensB.has(t)) intersection++; });
  const tokenScore = (2 * intersection) / (tokensA.size + tokensB.size);
  if (tokenScore >= 0.7) return tokenScore;

  // Levenshtein metric
  const matrix: number[][] = [];
  for (let i = 0; i <= normA.length; i++) matrix[i] = [i];
  for (let j = 0; j <= normB.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= normA.length; i++) {
    for (let j = 1; j <= normB.length; j++) {
      const cost = normA[i - 1] === normB[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const maxLen = Math.max(normA.length, normB.length);
  const dist = matrix[normA.length][normB.length];
  return Math.max(0, 1 - dist / maxLen);
}
