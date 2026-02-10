import { describe, it, expect } from 'vitest';
import { mfaService } from './mfa.service';

describe('MFA Service', () => {
  // ─────────────────────────────────────────
  // MFA ROLE REQUIREMENTS
  // ─────────────────────────────────────────
  describe('isMfaRequired', () => {
    it('should require MFA for OWNER role', () => {
      expect(mfaService.isMfaRequired('OWNER')).toBe(true);
    });

    it('should require MFA for ADMIN role', () => {
      expect(mfaService.isMfaRequired('ADMIN')).toBe(true);
    });

    it('should NOT require MFA for MANAGER role', () => {
      expect(mfaService.isMfaRequired('MANAGER')).toBe(false);
    });

    it('should NOT require MFA for CASHIER role', () => {
      expect(mfaService.isMfaRequired('CASHIER')).toBe(false);
    });

    it('should NOT require MFA for BARTENDER role', () => {
      expect(mfaService.isMfaRequired('BARTENDER')).toBe(false);
    });

    it('should NOT require MFA for DOORMAN role', () => {
      expect(mfaService.isMfaRequired('DOORMAN')).toBe(false);
    });

    it('should NOT require MFA for RRPP role', () => {
      expect(mfaService.isMfaRequired('RRPP')).toBe(false);
    });

    it('should NOT require MFA for unknown roles', () => {
      expect(mfaService.isMfaRequired('UNKNOWN')).toBe(false);
    });
  });
});

describe('MFA Enforcement Logic', () => {
  // ─────────────────────────────────────────
  // MFA SETUP REQUIRED DETECTION
  // ─────────────────────────────────────────
  describe('MFA Setup Required Detection', () => {
    it('should detect mfaSetupRequired for OWNER without MFA', () => {
      const user = { role: 'OWNER', mfaEnabled: false };
      const roleRequiresMfa = mfaService.isMfaRequired(user.role);
      const mfaSetupRequired = roleRequiresMfa && !user.mfaEnabled;

      expect(mfaSetupRequired).toBe(true);
    });

    it('should detect mfaSetupRequired for ADMIN without MFA', () => {
      const user = { role: 'ADMIN', mfaEnabled: false };
      const roleRequiresMfa = mfaService.isMfaRequired(user.role);
      const mfaSetupRequired = roleRequiresMfa && !user.mfaEnabled;

      expect(mfaSetupRequired).toBe(true);
    });

    it('should NOT require setup for OWNER with MFA enabled', () => {
      const user = { role: 'OWNER', mfaEnabled: true };
      const roleRequiresMfa = mfaService.isMfaRequired(user.role);
      const mfaSetupRequired = roleRequiresMfa && !user.mfaEnabled;

      expect(mfaSetupRequired).toBe(false);
    });

    it('should NOT require setup for CASHIER without MFA', () => {
      const user = { role: 'CASHIER', mfaEnabled: false };
      const roleRequiresMfa = mfaService.isMfaRequired(user.role);
      const mfaSetupRequired = roleRequiresMfa && !user.mfaEnabled;

      expect(mfaSetupRequired).toBe(false);
    });
  });

  // ─────────────────────────────────────────
  // MFA VERIFICATION REQUIRED
  // ─────────────────────────────────────────
  describe('MFA Verification Required Detection', () => {
    it('should require verification when MFA is enabled', () => {
      const user = { role: 'OWNER', mfaEnabled: true };
      const mfaVerificationRequired = user.mfaEnabled;

      expect(mfaVerificationRequired).toBe(true);
    });

    it('should NOT require verification when MFA is disabled', () => {
      const user = { role: 'CASHIER', mfaEnabled: false };
      const mfaVerificationRequired = user.mfaEnabled;

      expect(mfaVerificationRequired).toBe(false);
    });
  });

  // ─────────────────────────────────────────
  // TOKEN MFA VERIFIED STATUS
  // ─────────────────────────────────────────
  describe('Token MFA Verified Status', () => {
    function calculateMfaVerified(role: string, mfaEnabled: boolean): boolean {
      const roleRequiresMfa = mfaService.isMfaRequired(role);
      const mfaSetupRequired = roleRequiresMfa && !mfaEnabled;
      const mfaVerificationRequired = mfaEnabled;

      // Token is verified only if neither setup nor verification is required
      return !mfaSetupRequired && !mfaVerificationRequired;
    }

    it('should NOT be verified for OWNER without MFA setup', () => {
      expect(calculateMfaVerified('OWNER', false)).toBe(false);
    });

    it('should NOT be verified for OWNER with MFA enabled (needs verification)', () => {
      expect(calculateMfaVerified('OWNER', true)).toBe(false);
    });

    it('should be verified for CASHIER without MFA', () => {
      expect(calculateMfaVerified('CASHIER', false)).toBe(true);
    });

    it('should NOT be verified for CASHIER with MFA enabled (needs verification)', () => {
      expect(calculateMfaVerified('CASHIER', true)).toBe(false);
    });

    it('should be verified for BARTENDER without MFA', () => {
      expect(calculateMfaVerified('BARTENDER', false)).toBe(true);
    });
  });
});
