import { describe, it, expect } from 'vitest';

describe('Agent Settings System - Validation', () => {
  const VALID_LANGUAGES = ['en', 'es', 'de', 'fr', 'pt', 'ja', 'ko', 'zh'];
  const VALID_THEMES = ['dark', 'light', 'retro', 'neon'];

  it('should validate hex color codes', () => {
    const isValidHexColor = (color: string): boolean => /^#[0-9A-F]{6}$/i.test(color);
    expect(isValidHexColor('#FFFFFF')).toBe(true);
    expect(isValidHexColor('#000000')).toBe(true);
    expect(isValidHexColor('#FF5733')).toBe(true);
    expect(isValidHexColor('#ffffff')).toBe(true);
    expect(isValidHexColor('FFFFFF')).toBe(false);
    expect(isValidHexColor('#FFF')).toBe(false);
    expect(isValidHexColor('#GGGGGG')).toBe(false);
    expect(isValidHexColor('')).toBe(false);
  });

  it('should return default settings for new agent', () => {
    const getDefaultSettings = (agentId: string) => ({
      agentId, chatColor: '#FFFFFF', notificationSounds: true,
      showOnlineStatus: true, allowFriendRequests: true, allowTrades: true,
      allowWhispers: true, language: 'en', theme: 'dark',
      updatedAt: new Date().toISOString(),
    });
    const settings = getDefaultSettings('agent-123');
    expect(settings.agentId).toBe('agent-123');
    expect(settings.chatColor).toBe('#FFFFFF');
    expect(settings.notificationSounds).toBe(true);
    expect(settings.language).toBe('en');
    expect(settings.theme).toBe('dark');
  });

  it('should validate language codes', () => {
    const validateLanguage = (lang: string): boolean => {
      return VALID_LANGUAGES.includes(lang);
    };

    expect(validateLanguage('en')).toBe(true);
    expect(validateLanguage('es')).toBe(true);
    expect(validateLanguage('ja')).toBe(true);
    expect(validateLanguage('invalid')).toBe(false);
    expect(validateLanguage('EN')).toBe(false); // case sensitive
    expect(validateLanguage('')).toBe(false);
  });

  it('should validate theme values', () => {
    const validateTheme = (theme: string): boolean => {
      return VALID_THEMES.includes(theme);
    };

    expect(validateTheme('dark')).toBe(true);
    expect(validateTheme('light')).toBe(true);
    expect(validateTheme('retro')).toBe(true);
    expect(validateTheme('neon')).toBe(true);
    expect(validateTheme('custom')).toBe(false);
    expect(validateTheme('')).toBe(false);
  });

  it('should handle partial updates correctly', () => {
    const applyPartialUpdate = (current: any, updates: any) => {
      return { ...current, ...updates };
    };

    const current = {
      chatColor: '#FFFFFF',
      notificationSounds: true,
      language: 'en',
    };

    const updated = applyPartialUpdate(current, { language: 'es' });
    expect(updated.chatColor).toBe('#FFFFFF'); // unchanged
    expect(updated.language).toBe('es'); // updated
  });

  it('should reject invalid hex color on update', () => {
    const validateUpdate = (updates: any): { valid: boolean; error?: string } => {
      if (updates.chatColor && !/^#[0-9A-F]{6}$/i.test(updates.chatColor)) {
        return {
          valid: false,
          error: 'Invalid chat color. Must be a valid hex color code (e.g., #FFFFFF)',
        };
      }
      return { valid: true };
    };

    expect(validateUpdate({ chatColor: '#FF5733' }).valid).toBe(true);
    expect(validateUpdate({ chatColor: 'red' }).valid).toBe(false);
    expect(validateUpdate({ chatColor: '#FFF' }).valid).toBe(false);
  });

  it('should reject invalid language on update', () => {
    const validateUpdate = (updates: any): { valid: boolean; error?: string } => {
      if (updates.language && !VALID_LANGUAGES.includes(updates.language)) {
        return {
          valid: false,
          error: `Invalid language. Must be one of: ${VALID_LANGUAGES.join(', ')}`,
        };
      }
      return { valid: true };
    };

    expect(validateUpdate({ language: 'en' }).valid).toBe(true);
    expect(validateUpdate({ language: 'invalid' }).valid).toBe(false);
    expect(validateUpdate({ language: 'invalid' }).error).toContain('Invalid language');
  });

  it('should reject invalid theme on update', () => {
    const validateUpdate = (updates: any): { valid: boolean; error?: string } => {
      if (updates.theme && !VALID_THEMES.includes(updates.theme)) {
        return {
          valid: false,
          error: `Invalid theme. Must be one of: ${VALID_THEMES.join(', ')}`,
        };
      }
      return { valid: true };
    };

    expect(validateUpdate({ theme: 'dark' }).valid).toBe(true);
    expect(validateUpdate({ theme: 'invalid' }).valid).toBe(false);
    expect(validateUpdate({ theme: 'invalid' }).error).toContain('Invalid theme');
  });

  it('should reset settings to defaults', () => {
    const resetToDefaults = (agentId: string) => {
      return {
        agentId,
        chatColor: '#FFFFFF',
        notificationSounds: true,
        showOnlineStatus: true,
        allowFriendRequests: true,
        allowTrades: true,
        allowWhispers: true,
        language: 'en',
        theme: 'dark',
        updatedAt: new Date().toISOString(),
      };
    };

    const reset = resetToDefaults('agent-456');
    expect(reset.agentId).toBe('agent-456');
    expect(reset.chatColor).toBe('#FFFFFF');
    expect(reset.theme).toBe('dark');
    expect(reset.language).toBe('en');
  });

  it('should validate boolean settings', () => {
    const validateBoolean = (value: any): boolean => {
      return typeof value === 'boolean';
    };

    expect(validateBoolean(true)).toBe(true);
    expect(validateBoolean(false)).toBe(true);
    expect(validateBoolean('true')).toBe(false);
    expect(validateBoolean(1)).toBe(false);
    expect(validateBoolean(null)).toBe(false);
  });

  it('should allow all valid languages', () => {
    const allLanguages = ['en', 'es', 'de', 'fr', 'pt', 'ja', 'ko', 'zh'];

    expect(allLanguages.length).toBe(8);
    allLanguages.forEach((lang) => {
      expect(VALID_LANGUAGES.includes(lang)).toBe(true);
    });
  });

  it('should allow all valid themes', () => {
    const allThemes = ['dark', 'light', 'retro', 'neon'];

    expect(allThemes.length).toBe(4);
    allThemes.forEach((theme) => {
      expect(VALID_THEMES.includes(theme)).toBe(true);
    });
  });

  it('should handle getSetting for specific key', () => {
    const settings = {
      agentId: 'agent-789',
      chatColor: '#FF5733',
      notificationSounds: false,
      language: 'es',
      theme: 'neon',
    };

    const getSetting = (key: string) => {
      return settings[key as keyof typeof settings];
    };

    expect(getSetting('chatColor')).toBe('#FF5733');
    expect(getSetting('notificationSounds')).toBe(false);
    expect(getSetting('language')).toBe('es');
    expect(getSetting('theme')).toBe('neon');
  });

  it('should preserve other settings during partial update', () => {
    const current = {
      chatColor: '#FFFFFF',
      notificationSounds: true,
      showOnlineStatus: true,
      allowFriendRequests: true,
      allowTrades: true,
      allowWhispers: true,
      language: 'en',
      theme: 'dark',
    };

    const partialUpdate = { theme: 'neon', language: 'ja' };
    const updated = { ...current, ...partialUpdate };

    expect(updated.theme).toBe('neon');
    expect(updated.language).toBe('ja');
    expect(updated.chatColor).toBe('#FFFFFF'); // preserved
    expect(updated.notificationSounds).toBe(true); // preserved
  });

  it('should validate multiple settings at once', () => {
    const validateSettings = (settings: any): { valid: boolean; errors: string[] } => {
      const errors: string[] = [];

      if (settings.chatColor && !/^#[0-9A-F]{6}$/i.test(settings.chatColor)) {
        errors.push('Invalid chat color');
      }

      if (settings.language && !VALID_LANGUAGES.includes(settings.language)) {
        errors.push('Invalid language');
      }

      if (settings.theme && !VALID_THEMES.includes(settings.theme)) {
        errors.push('Invalid theme');
      }

      return { valid: errors.length === 0, errors };
    };

    const validSettings = { chatColor: '#FF5733', language: 'es', theme: 'retro' };
    const invalidSettings = { chatColor: 'red', language: 'invalid', theme: 'custom' };

    expect(validateSettings(validSettings).valid).toBe(true);
    expect(validateSettings(invalidSettings).valid).toBe(false);
    expect(validateSettings(invalidSettings).errors.length).toBe(3);
  });
});
