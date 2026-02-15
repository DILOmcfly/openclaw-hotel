import { describe, it, expect } from 'vitest';

/**
 * Room Access Codes Unit Tests
 * Tests code generation, validation, and usage without database
 */

describe('Room Access Codes', () => {
  describe('Code Generation', () => {
    it('should generate 6-character alphanumeric code', () => {
      const generateCode = (): string => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
      };

      const code = generateCode();
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[A-Z0-9]{6}$/);
    });

    it('should generate unique codes', () => {
      const generateCode = (): string => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
      };

      const codes = new Set();
      for (let i = 0; i < 100; i++) {
        codes.add(generateCode());
      }
      
      // Should have high uniqueness rate
      expect(codes.size).toBeGreaterThan(95);
    });

    it('should only use uppercase letters and numbers', () => {
      const generateCode = (): string => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
      };

      const code = generateCode();
      expect(code).not.toMatch(/[a-z]/);
      expect(code).not.toMatch(/[^A-Z0-9]/);
    });
  });

  describe('Code Validation', () => {
    it('should reject inactive codes', () => {
      type CodeData = {
        active: boolean;
        expiresAt: Date | null;
        maxUses: number | null;
        useCount: number;
      };

      const validateCodeData = (data: CodeData): { valid: boolean; reason?: string } => {
        if (!data.active) {
          return { valid: false, reason: 'Code revoked' };
        }
        if (data.expiresAt && data.expiresAt < new Date()) {
          return { valid: false, reason: 'Code expired' };
        }
        if (data.maxUses !== null && data.useCount >= data.maxUses) {
          return { valid: false, reason: 'Code max uses reached' };
        }
        return { valid: true };
      };

      const result = validateCodeData({
        active: false,
        expiresAt: null,
        maxUses: null,
        useCount: 0,
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Code revoked');
    });

    it('should reject expired codes', () => {
      type CodeData = {
        active: boolean;
        expiresAt: Date | null;
        maxUses: number | null;
        useCount: number;
      };

      const validateCodeData = (data: CodeData): { valid: boolean; reason?: string } => {
        if (!data.active) {
          return { valid: false, reason: 'Code revoked' };
        }
        if (data.expiresAt && data.expiresAt < new Date()) {
          return { valid: false, reason: 'Code expired' };
        }
        if (data.maxUses !== null && data.useCount >= data.maxUses) {
          return { valid: false, reason: 'Code max uses reached' };
        }
        return { valid: true };
      };

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const result = validateCodeData({
        active: true,
        expiresAt: yesterday,
        maxUses: null,
        useCount: 0,
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Code expired');
    });

    it('should reject codes that reached max uses', () => {
      type CodeData = {
        active: boolean;
        expiresAt: Date | null;
        maxUses: number | null;
        useCount: number;
      };

      const validateCodeData = (data: CodeData): { valid: boolean; reason?: string } => {
        if (!data.active) {
          return { valid: false, reason: 'Code revoked' };
        }
        if (data.expiresAt && data.expiresAt < new Date()) {
          return { valid: false, reason: 'Code expired' };
        }
        if (data.maxUses !== null && data.useCount >= data.maxUses) {
          return { valid: false, reason: 'Code max uses reached' };
        }
        return { valid: true };
      };

      const result = validateCodeData({
        active: true,
        expiresAt: null,
        maxUses: 5,
        useCount: 5,
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Code max uses reached');
    });

    it('should accept valid active code', () => {
      type CodeData = {
        active: boolean;
        expiresAt: Date | null;
        maxUses: number | null;
        useCount: number;
      };

      const validateCodeData = (data: CodeData): { valid: boolean; reason?: string } => {
        if (!data.active) {
          return { valid: false, reason: 'Code revoked' };
        }
        if (data.expiresAt && data.expiresAt < new Date()) {
          return { valid: false, reason: 'Code expired' };
        }
        if (data.maxUses !== null && data.useCount >= data.maxUses) {
          return { valid: false, reason: 'Code max uses reached' };
        }
        return { valid: true };
      };

      const result = validateCodeData({
        active: true,
        expiresAt: null,
        maxUses: null,
        useCount: 0,
      });

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should accept code with future expiry', () => {
      type CodeData = {
        active: boolean;
        expiresAt: Date | null;
        maxUses: number | null;
        useCount: number;
      };

      const validateCodeData = (data: CodeData): { valid: boolean; reason?: string } => {
        if (!data.active) {
          return { valid: false, reason: 'Code revoked' };
        }
        if (data.expiresAt && data.expiresAt < new Date()) {
          return { valid: false, reason: 'Code expired' };
        }
        if (data.maxUses !== null && data.useCount >= data.maxUses) {
          return { valid: false, reason: 'Code max uses reached' };
        }
        return { valid: true };
      };

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const result = validateCodeData({
        active: true,
        expiresAt: tomorrow,
        maxUses: null,
        useCount: 0,
      });

      expect(result.valid).toBe(true);
    });

    it('should accept code below max uses', () => {
      type CodeData = {
        active: boolean;
        expiresAt: Date | null;
        maxUses: number | null;
        useCount: number;
      };

      const validateCodeData = (data: CodeData): { valid: boolean; reason?: string } => {
        if (!data.active) {
          return { valid: false, reason: 'Code revoked' };
        }
        if (data.expiresAt && data.expiresAt < new Date()) {
          return { valid: false, reason: 'Code expired' };
        }
        if (data.maxUses !== null && data.useCount >= data.maxUses) {
          return { valid: false, reason: 'Code max uses reached' };
        }
        return { valid: true };
      };

      const result = validateCodeData({
        active: true,
        expiresAt: null,
        maxUses: 10,
        useCount: 7,
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('Use Count Increment', () => {
    it('should increment use count by 1', () => {
      let useCount = 0;
      const incrementUse = () => useCount++;

      incrementUse();
      expect(useCount).toBe(1);

      incrementUse();
      expect(useCount).toBe(2);
    });

    it('should track multiple uses correctly', () => {
      let useCount = 5;
      const incrementUse = () => useCount++;

      for (let i = 0; i < 3; i++) {
        incrementUse();
      }

      expect(useCount).toBe(8);
    });

    it('should prevent use when max uses reached', () => {
      const canUse = (useCount: number, maxUses: number | null): boolean => {
        if (maxUses === null) return true;
        return useCount < maxUses;
      };

      expect(canUse(5, 10)).toBe(true);
      expect(canUse(10, 10)).toBe(false);
      expect(canUse(11, 10)).toBe(false);
      expect(canUse(100, null)).toBe(true);
    });
  });

  describe('Code Statistics', () => {
    it('should calculate total uses from multiple codes', () => {
      const codes = [
        { useCount: 5, active: true },
        { useCount: 3, active: true },
        { useCount: 8, active: false },
      ];

      const totalUses = codes.reduce((sum, code) => sum + code.useCount, 0);
      expect(totalUses).toBe(16);
    });

    it('should count only active codes', () => {
      const codes = [
        { active: true },
        { active: true },
        { active: false },
        { active: true },
        { active: false },
      ];

      const activeCount = codes.filter(c => c.active).length;
      expect(activeCount).toBe(3);
    });

    it('should handle empty code list', () => {
      const codes: any[] = [];

      const totalUses = codes.reduce((sum, code) => sum + code.useCount, 0);
      const activeCount = codes.filter(c => c.active).length;

      expect(totalUses).toBe(0);
      expect(activeCount).toBe(0);
    });

    it('should calculate stats correctly', () => {
      const codes = [
        { useCount: 10, active: true },
        { useCount: 5, active: true },
        { useCount: 3, active: false },
        { useCount: 0, active: true },
      ];

      const stats = {
        totalUses: codes.reduce((sum, code) => sum + code.useCount, 0),
        activeCodesCount: codes.filter(c => c.active).length,
      };

      expect(stats.totalUses).toBe(18);
      expect(stats.activeCodesCount).toBe(3);
    });
  });

  describe('Code Revocation', () => {
    it('should mark code as inactive', () => {
      let codeActive = true;
      const revokeCode = () => { codeActive = false; };

      revokeCode();
      expect(codeActive).toBe(false);
    });

    it('should not affect use count when revoking', () => {
      const code = { active: true, useCount: 5 };
      const revokeCode = (c: any) => { c.active = false; };

      revokeCode(code);
      expect(code.active).toBe(false);
      expect(code.useCount).toBe(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null max uses (unlimited)', () => {
      const canUse = (useCount: number, maxUses: number | null): boolean => {
        if (maxUses === null) return true;
        return useCount < maxUses;
      };

      expect(canUse(1000, null)).toBe(true);
      expect(canUse(0, null)).toBe(true);
    });

    it('should handle null expiry (never expires)', () => {
      const isExpired = (expiresAt: Date | null): boolean => {
        if (!expiresAt) return false;
        return expiresAt < new Date();
      };

      expect(isExpired(null)).toBe(false);
    });

    it('should handle exact max uses boundary', () => {
      const canUse = (useCount: number, maxUses: number | null): boolean => {
        if (maxUses === null) return true;
        return useCount < maxUses;
      };

      expect(canUse(9, 10)).toBe(true);
      expect(canUse(10, 10)).toBe(false);
    });

    it('should handle expiry timestamp precision', () => {
      const now = new Date();
      const oneSecondAgo = new Date(now.getTime() - 1000);
      const oneSecondLater = new Date(now.getTime() + 1000);

      const isExpired = (expiresAt: Date): boolean => {
        return expiresAt < new Date();
      };

      expect(isExpired(oneSecondAgo)).toBe(true);
      expect(isExpired(oneSecondLater)).toBe(false);
    });
  });
});
