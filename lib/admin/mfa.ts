export type MfaFactorType = "totp" | "webauthn";

export type MfaChallenge = {
  userId: string;
  factorType: MfaFactorType;
  challengeId: string;
  expiresAt: number;
};

export interface AdminMfaProvider {
  createChallenge(userId: string, factorType: MfaFactorType): Promise<MfaChallenge>;
  verifyChallenge(challenge: MfaChallenge, response: string): Promise<boolean>;
}

export function isMfaRequiredForRole(role: "owner" | "admin" | "editor" | "viewer") {
  return role === "owner" || role === "admin";
}

export const mfaProductionGate = "MFA architecture exists but MFA is currently not enforced. TODO: connect and verify a production MFA provider before opening additional production tenant access.";
