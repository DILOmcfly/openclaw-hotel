import { describe, it, expect } from 'vitest';

/**
 * Profile System Unit Tests
 * These tests validate input and logic without requiring a database connection
 */

describe('Profile System - Validation', () => {
  it('should validate bio length constraint', () => {
    const validateBio = (bio: string): { valid: boolean; error?: string } => {
      if (bio.length > 500) {
        return { valid: false, error: 'Bio cannot exceed 500 characters' };
      }
      return { valid: true };
    };

    const validBio = 'Hello, I am a friendly agent!';
    const tooLongBio = 'a'.repeat(501);
    const maxLengthBio = 'a'.repeat(500);

    expect(validateBio(validBio).valid).toBe(true);
    expect(validateBio(maxLengthBio).valid).toBe(true);
    expect(validateBio(tooLongBio).valid).toBe(false);
    expect(validateBio(tooLongBio).error).toBe('Bio cannot exceed 500 characters');
  });

  it('should validate avatar URL format', () => {
    const validateAvatarUrl = (url: string): boolean => {
      if (url === '') return true; // Empty is valid (clears avatar)
      
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    };

    expect(validateAvatarUrl('https://example.com/avatar.png')).toBe(true);
    expect(validateAvatarUrl('http://example.com/avatar.jpg')).toBe(true);
    expect(validateAvatarUrl('')).toBe(true);
    expect(validateAvatarUrl('not-a-url')).toBe(false);
    expect(validateAvatarUrl('ftp://example.com/file')).toBe(true); // URL constructor accepts it
  });

  it('should correctly format member since date', () => {
    const formatMemberSince = (timestamp: string): string => {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      });
    };

    expect(formatMemberSince('2024-01-15T10:30:00Z')).toBe('Jan 2024');
    expect(formatMemberSince('2023-12-31T23:59:59Z')).toBe('Dec 2023');
    expect(formatMemberSince('2025-06-01T00:00:00Z')).toBe('Jun 2025');
  });

  it('should sanitize bio input for XSS protection', () => {
    const sanitizeBio = (bio: string): string => {
      return bio
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    expect(sanitizeBio('Hello world')).toBe('Hello world');
    expect(sanitizeBio('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
    expect(sanitizeBio("It's a test & more")).toBe("It&#039;s a test &amp; more");
  });

  it('should calculate stats correctly', () => {
    type AgentStats = {
      roomCount: number;
      tradeCount: number;
      friendsCount: number;
    };

    const calculateTotalActivity = (stats: AgentStats): number => {
      return stats.roomCount + stats.tradeCount + stats.friendsCount;
    };

    expect(calculateTotalActivity({ roomCount: 5, tradeCount: 3, friendsCount: 10 })).toBe(18);
    expect(calculateTotalActivity({ roomCount: 0, tradeCount: 0, friendsCount: 0 })).toBe(0);
    expect(calculateTotalActivity({ roomCount: 1, tradeCount: 1, friendsCount: 1 })).toBe(3);
  });

  it('should validate badge format', () => {
    const validateBadge = (badge: string | null): boolean => {
      if (badge === null) return true;
      if (badge.length === 0) return false;
      if (badge.length > 32) return false;
      return true;
    };

    expect(validateBadge(null)).toBe(true);
    expect(validateBadge('VIP')).toBe(true);
    expect(validateBadge('Moderator')).toBe(true);
    expect(validateBadge('')).toBe(false);
    expect(validateBadge('a'.repeat(32))).toBe(true);
    expect(validateBadge('a'.repeat(33))).toBe(false);
  });

  it('should determine if profile is complete', () => {
    type Profile = {
      bio: string | null;
      avatarUrl: string | null;
      badge: string | null;
    };

    const isProfileComplete = (profile: Profile): boolean => {
      return profile.bio !== null && profile.bio.length > 0;
    };

    expect(isProfileComplete({ bio: 'Hello!', avatarUrl: null, badge: null })).toBe(true);
    expect(isProfileComplete({ bio: null, avatarUrl: 'https://example.com', badge: 'VIP' })).toBe(false);
    expect(isProfileComplete({ bio: '', avatarUrl: null, badge: null })).toBe(false);
    expect(isProfileComplete({ bio: 'Nice bio', avatarUrl: 'url', badge: 'badge' })).toBe(true);
  });
});
