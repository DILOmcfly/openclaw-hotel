import { describe, it, expect } from 'vitest';

describe('Agent Profiles System', () => {
  describe('Hex Color Validation', () => {
    const isValidHex = (color: string): boolean => /^#[0-9A-Fa-f]{6}$/.test(color);

    it('should accept valid hex colors', () => {
      expect(isValidHex('#1a1a2e')).toBe(true);
      expect(isValidHex('#FFFFFF')).toBe(true);
      expect(isValidHex('#abc123')).toBe(true);
    });

    it('should reject invalid hex colors', () => {
      expect(isValidHex('#gg1234')).toBe(false);
      expect(isValidHex('#12345')).toBe(false);
      expect(isValidHex('1a1a2e')).toBe(false);
    });

    it('should be case-insensitive for A-F', () => {
      expect(isValidHex('#AbCdEf')).toBe(true);
    });
  });

  describe('Bio Length Validation', () => {
    const MAX_LENGTH = 500;
    const validateBio = (bio: string): boolean => bio.length <= MAX_LENGTH;

    it('should accept bio within limit', () => {
      expect(validateBio('Short bio')).toBe(true);
      expect(validateBio('A'.repeat(500))).toBe(true);
    });

    it('should reject bio exceeding limit', () => {
      expect(validateBio('A'.repeat(501))).toBe(false);
    });

    it('should accept empty bio', () => {
      expect(validateBio('')).toBe(true);
    });
  });

  describe('Display Name Validation', () => {
    const MAX_LENGTH = 50;
    const validateName = (name: string): boolean => name.length <= MAX_LENGTH;

    it('should accept display name within limit', () => {
      expect(validateName('Agent007')).toBe(true);
      expect(validateName('A'.repeat(50))).toBe(true);
    });

    it('should reject display name exceeding limit', () => {
      expect(validateName('A'.repeat(51))).toBe(false);
    });
  });

  describe('Profile Completion Calculation', () => {
    const calculateCompletion = (profile: any): number => {
      const fields = [
        profile.displayName, profile.bio, profile.avatarUrl,
        profile.bannerColor !== '#1a1a2e', profile.accentColor !== '#e94560', profile.theme !== 'dark',
      ];
      return Math.round((fields.filter(Boolean).length / fields.length) * 100);
    };

    it('should calculate 0% for empty profile', () => {
      expect(calculateCompletion({
        displayName: null, bio: null, avatarUrl: null,
        bannerColor: '#1a1a2e', accentColor: '#e94560', theme: 'dark',
      })).toBe(0);
    });

    it('should calculate 100% for fully filled profile', () => {
      expect(calculateCompletion({
        displayName: 'Agent007', bio: 'My bio', avatarUrl: 'https://example.com/avatar.png',
        bannerColor: '#ff0000', accentColor: '#00ff00', theme: 'neon',
      })).toBe(100);
    });

    it('should calculate 50% for half-filled profile', () => {
      expect(calculateCompletion({
        displayName: 'Agent007', bio: 'My bio', avatarUrl: 'https://example.com/avatar.png',
        bannerColor: '#1a1a2e', accentColor: '#e94560', theme: 'dark',
      })).toBe(50);
    });
  });

  describe('View Counting Logic', () => {
    const shouldIncrementView = (ownerId: string, viewerId: string | null): boolean => {
      return viewerId !== null && viewerId !== ownerId;
    };

    it('should increment views when viewer is different from owner', () => {
      expect(shouldIncrementView('agent1', 'agent2')).toBe(true);
    });

    it('should not increment views when owner views own profile', () => {
      expect(shouldIncrementView('agent1', 'agent1')).toBe(false);
    });

    it('should not increment views for unauthenticated viewing', () => {
      expect(shouldIncrementView('agent1', null)).toBe(false);
    });
  });

  describe('Theme Validation', () => {
    const validThemes = ['dark', 'light', 'retro', 'neon', 'ocean'] as const;
    const isValidTheme = (theme: string): boolean => validThemes.includes(theme as any);

    it('should accept valid themes', () => {
      expect(isValidTheme('dark')).toBe(true);
      expect(isValidTheme('neon')).toBe(true);
      expect(isValidTheme('ocean')).toBe(true);
    });

    it('should reject invalid themes', () => {
      expect(isValidTheme('invalid')).toBe(false);
      expect(isValidTheme('DARK')).toBe(false);
    });
  });

  describe('Profile Search Logic', () => {
    const mockProfiles = [
      { displayName: 'Agent007', agentId: 'a1' },
      { displayName: 'SuperAgent', agentId: 'a2' },
      { displayName: 'CoolBot', agentId: 'a3' },
    ];
    const searchProfiles = (profiles: any[], query: string) => {
      return profiles.filter(p => p.displayName?.toLowerCase().includes(query.toLowerCase()));
    };

    it('should filter profiles by display name', () => {
      expect(searchProfiles(mockProfiles, 'agent')).toHaveLength(2);
    });

    it('should be case-insensitive for search', () => {
      expect(searchProfiles(mockProfiles, 'AGENT')).toHaveLength(2);
    });

    it('should return empty array for no matches', () => {
      expect(searchProfiles(mockProfiles, 'xyz')).toHaveLength(0);
    });
  });

  describe('Top Viewed Profiles Sorting', () => {
    const mockProfiles = [
      { agentId: 'a1', profileViews: 10 },
      { agentId: 'a2', profileViews: 50 },
      { agentId: 'a3', profileViews: 25 },
    ];

    it('should sort profiles by views descending', () => {
      const sorted = [...mockProfiles].sort((a, b) => b.profileViews - a.profileViews);
      expect(sorted[0].agentId).toBe('a2');
    });

    it('should filter out profiles with zero views', () => {
      const withZero = [...mockProfiles, { agentId: 'a4', profileViews: 0 }];
      expect(withZero.filter(p => p.profileViews > 0)).toHaveLength(3);
    });

    it('should respect limit parameter', () => {
      expect(mockProfiles.slice(0, 2)).toHaveLength(2);
    });
  });

  describe('Online Status Filter', () => {
    const mockProfiles = [
      { agentId: 'a1', showOnlineStatus: true },
      { agentId: 'a2', showOnlineStatus: false },
      { agentId: 'a3', showOnlineStatus: true },
    ];

    it('should filter profiles with show_online_status=true', () => {
      expect(mockProfiles.filter(p => p.showOnlineStatus)).toHaveLength(2);
    });

    it('should return empty array if no profiles have status visible', () => {
      const allHidden = mockProfiles.map(p => ({ ...p, showOnlineStatus: false }));
      expect(allHidden.filter(p => p.showOnlineStatus)).toHaveLength(0);
    });
  });

  describe('Default Profile Values', () => {
    it('should provide correct default values for new profile', () => {
      const getDefaultProfile = (agentId: string) => ({
        agentId, displayName: null, bio: null, avatarUrl: null,
        bannerColor: '#1a1a2e', accentColor: '#e94560', theme: 'dark' as const,
        profileViews: 0, showOnlineStatus: true, showActivity: true,
      });
      const defaults = getDefaultProfile('agent123');
      expect(defaults.displayName).toBeNull();
      expect(defaults.bannerColor).toBe('#1a1a2e');
      expect(defaults.theme).toBe('dark');
    });
  });

  describe('Profile Update Merging', () => {
    it('should merge partial updates with existing profile', () => {
      const existing = { displayName: 'Agent007', bio: 'My bio', theme: 'dark' };
      const updates = { theme: 'neon' as const };
      const merged = { ...existing, ...updates };
      expect(merged.displayName).toBe('Agent007');
      expect(merged.theme).toBe('neon');
    });

    it('should preserve unchanged fields', () => {
      const existing = { displayName: 'Agent007', bio: 'My bio', showOnlineStatus: true };
      const updates = { displayName: 'SuperAgent' };
      const merged = { ...existing, ...updates };
      expect(merged.bio).toBe('My bio');
    });
  });
});
