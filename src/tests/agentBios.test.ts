import { describe, it, expect } from 'vitest';

describe('Agent Bio System - Validation', () => {
  const MAX_BIO_LENGTH = 1000;
  const MAX_SKILLS = 10;
  const MAX_SKILL_LENGTH = 30;

  it('should validate bio length', () => {
    const validateBio = (bio: string): { valid: boolean; error?: string } => {
      if (bio.length > MAX_BIO_LENGTH) {
        return { valid: false, error: `Bio must be ${MAX_BIO_LENGTH} characters or less` };
      }
      return { valid: true };
    };

    expect(validateBio('Short bio').valid).toBe(true);
    expect(validateBio('a'.repeat(1000)).valid).toBe(true);
    expect(validateBio('a'.repeat(1001)).valid).toBe(false);
    expect(validateBio('a'.repeat(1001)).error).toContain('1000 characters or less');
  });

  it('should validate URL format', () => {
    const isValidUrl = (url: string): boolean => {
      if (!url) return true; // Empty is OK
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    };

    expect(isValidUrl('')).toBe(true);
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://github.com/user')).toBe(true);
    expect(isValidUrl('not-a-url')).toBe(false);
    expect(isValidUrl('ftp://invalid.com')).toBe(false);
  });

  it('should validate skills array length', () => {
    const validateSkills = (skills: string[]): { valid: boolean; error?: string } => {
      if (skills.length > MAX_SKILLS) {
        return { valid: false, error: `Maximum ${MAX_SKILLS} skills allowed` };
      }
      return { valid: true };
    };

    expect(validateSkills(['TypeScript', 'React']).valid).toBe(true);
    expect(validateSkills(Array(10).fill('Skill')).valid).toBe(true);
    expect(validateSkills(Array(11).fill('Skill')).valid).toBe(false);
    expect(validateSkills(Array(11).fill('Skill')).error).toContain('Maximum 10 skills');
  });

  it('should validate individual skill length', () => {
    const validateSkillLength = (skill: string): { valid: boolean; error?: string } => {
      if (skill.length > MAX_SKILL_LENGTH) {
        return { valid: false, error: `Each skill must be ${MAX_SKILL_LENGTH} characters or less` };
      }
      return { valid: true };
    };

    expect(validateSkillLength('TypeScript').valid).toBe(true);
    expect(validateSkillLength('a'.repeat(30)).valid).toBe(true);
    expect(validateSkillLength('a'.repeat(31)).valid).toBe(false);
  });

  it('should validate all skills in array', () => {
    const validateAllSkills = (skills: string[]): { valid: boolean; error?: string } => {
      if (skills.length > MAX_SKILLS) {
        return { valid: false, error: `Maximum ${MAX_SKILLS} skills allowed` };
      }
      for (const skill of skills) {
        if (skill.length > MAX_SKILL_LENGTH) {
          return { valid: false, error: `Each skill must be ${MAX_SKILL_LENGTH} characters or less` };
        }
      }
      return { valid: true };
    };

    expect(validateAllSkills(['TypeScript', 'React', 'Node.js']).valid).toBe(true);
    expect(validateAllSkills(['TypeScript', 'a'.repeat(31)]).valid).toBe(false);
    expect(validateAllSkills(Array(11).fill('Skill')).valid).toBe(false);
  });

  it('should handle partial social link updates', () => {
    const current = { website: 'https://example.com', github: '', twitter: '', discord: '' };
    const updates = { github: 'https://github.com/user' };
    const merged = { ...current, ...updates };

    expect(merged.website).toBe('https://example.com');
    expect(merged.github).toBe('https://github.com/user');
    expect(merged.twitter).toBe('');
    expect(merged.discord).toBe('');
  });

  it('should validate all social links', () => {
    const validateSocialLinks = (links: any): { valid: boolean; errors: string[] } => {
      const errors: string[] = [];
      const isValidUrl = (url: string): boolean => {
        if (!url) return true;
        try {
          const parsed = new URL(url);
          return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
          return false;
        }
      };

      if (links.website && !isValidUrl(links.website)) errors.push('Invalid website URL');
      if (links.github && !isValidUrl(links.github)) errors.push('Invalid GitHub URL');
      if (links.twitter && !isValidUrl(links.twitter)) errors.push('Invalid Twitter URL');
      if (links.discord && !isValidUrl(links.discord)) errors.push('Invalid Discord URL');

      return { valid: errors.length === 0, errors };
    };

    const validLinks = {
      website: 'https://example.com',
      github: 'https://github.com/user',
      twitter: 'https://twitter.com/user',
      discord: 'https://discord.gg/server',
    };
    const invalidLinks = {
      website: 'not-a-url',
      github: 'invalid',
      twitter: 'ftp://invalid.com',
      discord: 'bad-url',
    };

    expect(validateSocialLinks(validLinks).valid).toBe(true);
    expect(validateSocialLinks(invalidLinks).valid).toBe(false);
    expect(validateSocialLinks(invalidLinks).errors.length).toBe(4);
  });

  it('should return empty defaults for new agent', () => {
    const getDefaultBio = (agentId: string) => ({
      agentId,
      bio: '',
      website: '',
      github: '',
      twitter: '',
      discord: '',
      favoriteRoom: '',
      joinReason: '',
      skills: [],
      updatedAt: new Date().toISOString(),
    });

    const bio = getDefaultBio('agent-123');
    expect(bio.agentId).toBe('agent-123');
    expect(bio.bio).toBe('');
    expect(bio.skills).toEqual([]);
    expect(bio.website).toBe('');
  });

  it('should handle empty string URLs as valid', () => {
    const isValidUrl = (url: string): boolean => {
      if (!url) return true;
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    };

    expect(isValidUrl('')).toBe(true);
    expect(isValidUrl('https://example.com')).toBe(true);
  });

  it('should validate specific URL error messages', () => {
    const validateUrl = (url: string, field: string): { valid: boolean; error?: string } => {
      if (!url) return { valid: true };
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return { valid: false, error: `Invalid ${field} URL` };
        }
        return { valid: true };
      } catch {
        return { valid: false, error: `Invalid ${field} URL` };
      }
    };

    expect(validateUrl('https://github.com', 'GitHub').valid).toBe(true);
    expect(validateUrl('invalid', 'GitHub').valid).toBe(false);
    expect(validateUrl('invalid', 'GitHub').error).toBe('Invalid GitHub URL');
  });

  it('should preserve existing bio data on partial update', () => {
    const current = {
      agentId: 'agent-456',
      bio: 'Hello world',
      website: 'https://example.com',
      github: '',
      twitter: '',
      discord: '',
      favoriteRoom: 'room-1',
      joinReason: 'To have fun',
      skills: ['TypeScript'],
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const linksUpdate = { github: 'https://github.com/user' };
    const updated = { ...current, ...linksUpdate };

    expect(updated.bio).toBe('Hello world');
    expect(updated.github).toBe('https://github.com/user');
    expect(updated.skills).toEqual(['TypeScript']);
    expect(updated.favoriteRoom).toBe('room-1');
  });

  it('should handle maximum valid bio length', () => {
    const bio = 'a'.repeat(1000);
    const validateBio = (text: string) => text.length <= MAX_BIO_LENGTH;

    expect(validateBio(bio)).toBe(true);
    expect(bio.length).toBe(1000);
  });

  it('should handle maximum valid skills array', () => {
    const skills = Array(10).fill('Skill');
    const validateSkills = (arr: string[]) => arr.length <= MAX_SKILLS;

    expect(validateSkills(skills)).toBe(true);
    expect(skills.length).toBe(10);
  });

  it('should handle maximum valid skill length', () => {
    const skill = 'a'.repeat(30);
    const validateSkill = (text: string) => text.length <= MAX_SKILL_LENGTH;

    expect(validateSkill(skill)).toBe(true);
    expect(skill.length).toBe(30);
  });
});
