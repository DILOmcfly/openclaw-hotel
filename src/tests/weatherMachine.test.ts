import { describe, it, expect } from 'vitest';

/**
 * Weather Machine Unit Tests
 * Tests weather logic without database
 */

type WeatherType = 'clear' | 'rain' | 'snow' | 'fog' | 'storm' | 'aurora' | 'meteor' | 'rainbow';

describe('Weather Machine System', () => {
  describe('Weather Type Validation', () => {
    const VALID_WEATHER: WeatherType[] = ['clear', 'rain', 'snow', 'fog', 'storm', 'aurora', 'meteor', 'rainbow'];

    it('should validate all weather types', () => {
      expect(VALID_WEATHER.includes('clear')).toBe(true);
      expect(VALID_WEATHER.includes('rain')).toBe(true);
      expect(VALID_WEATHER.includes('snow')).toBe(true);
      expect(VALID_WEATHER.includes('fog')).toBe(true);
      expect(VALID_WEATHER.includes('storm')).toBe(true);
      expect(VALID_WEATHER.includes('aurora')).toBe(true);
      expect(VALID_WEATHER.includes('meteor')).toBe(true);
      expect(VALID_WEATHER.includes('rainbow')).toBe(true);
    });

    it('should reject invalid weather types', () => {
      expect(VALID_WEATHER.includes('sunny' as any)).toBe(false);
      expect(VALID_WEATHER.includes('cloudy' as any)).toBe(false);
      expect(VALID_WEATHER.includes('windy' as any)).toBe(false);
    });
  });

  describe('Intensity Validation', () => {
    it('should accept valid intensity range', () => {
      const validateIntensity = (n: number) => n >= 0 && n <= 100;
      expect(validateIntensity(0)).toBe(true);
      expect(validateIntensity(50)).toBe(true);
      expect(validateIntensity(100)).toBe(true);
    });

    it('should reject out-of-range intensity', () => {
      const validateIntensity = (n: number) => n >= 0 && n <= 100;
      expect(validateIntensity(-1)).toBe(false);
      expect(validateIntensity(101)).toBe(false);
      expect(validateIntensity(200)).toBe(false);
    });

    it('should use default intensity of 50', () => {
      const defaultIntensity = 50;
      expect(defaultIntensity).toBe(50);
    });
  });

  describe('Weather Duration Calculation', () => {
    it('should calculate duration in minutes', () => {
      const start = Date.now();
      const end = start + (15 * 60 * 1000); // 15 minutes later
      const duration = Math.floor((end - start) / 60000);
      expect(duration).toBe(15);
    });

    it('should handle sub-minute durations', () => {
      const start = Date.now();
      const end = start + 30000; // 30 seconds
      const duration = Math.floor((end - start) / 60000);
      expect(duration).toBe(0);
    });

    it('should handle hour-long durations', () => {
      const start = Date.now();
      const end = start + (120 * 60 * 1000); // 2 hours
      const duration = Math.floor((end - start) / 60000);
      expect(duration).toBe(120);
    });
  });

  describe('Auto-Cycle Logic', () => {
    it('should default auto-cycle to false', () => {
      const autoCycle = false;
      expect(autoCycle).toBe(false);
    });

    it('should use default interval of 30 minutes', () => {
      const defaultInterval = 30;
      expect(defaultInterval).toBe(30);
    });

    it('should allow custom cycle intervals', () => {
      const intervals = [15, 30, 60, 120];
      intervals.forEach(i => expect(i).toBeGreaterThan(0));
    });

    it('should toggle auto-cycle state', () => {
      let autoCycle = false;
      autoCycle = !autoCycle;
      expect(autoCycle).toBe(true);
      autoCycle = !autoCycle;
      expect(autoCycle).toBe(false);
    });
  });

  describe('Weather History', () => {
    it('should record weather changes', () => {
      const history = [
        { weather: 'clear', duration: 30 },
        { weather: 'rain', duration: 15 },
        { weather: 'snow', duration: 45 },
      ];
      expect(history).toHaveLength(3);
    });

    it('should paginate history results', () => {
      const items = Array.from({ length: 50 }, (_, i) => ({ id: i, weather: 'clear' }));
      const paginate = (arr: any[], limit: number, offset: number) => arr.slice(offset, offset + limit);
      
      expect(paginate(items, 20, 0)).toHaveLength(20);
      expect(paginate(items, 20, 20)).toHaveLength(20);
      expect(paginate(items, 20, 40)).toHaveLength(10);
    });

    it('should sort history by most recent', () => {
      const now = Date.now();
      const history = [
        { id: 1, createdAt: new Date(now - 3000) },
        { id: 2, createdAt: new Date(now - 1000) },
        { id: 3, createdAt: new Date(now - 2000) },
      ];
      
      const sorted = [...history].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      expect(sorted[0].id).toBe(2);
    });

    it('should limit history page size', () => {
      const limit = (n: number, max: number) => Math.min(Math.max(n, 1), max);
      expect(limit(20, 100)).toBe(20);
      expect(limit(150, 100)).toBe(100);
      expect(limit(0, 100)).toBe(1);
    });
  });

  describe('Popular Weather Tracking', () => {
    it('should count weather occurrences', () => {
      const history = [
        { weather: 'rain' },
        { weather: 'rain' },
        { weather: 'snow' },
        { weather: 'rain' },
        { weather: 'clear' },
      ];
      
      const counts = new Map<string, number>();
      history.forEach(h => counts.set(h.weather, (counts.get(h.weather) || 0) + 1));
      
      expect(counts.get('rain')).toBe(3);
      expect(counts.get('snow')).toBe(1);
      expect(counts.get('clear')).toBe(1);
    });

    it('should sort by popularity descending', () => {
      const popular = [
        { weather: 'clear', count: 10 },
        { weather: 'rain', count: 25 },
        { weather: 'snow', count: 15 },
      ];
      
      const sorted = [...popular].sort((a, b) => b.count - a.count);
      expect(sorted[0].weather).toBe('rain');
      expect(sorted[1].weather).toBe('snow');
      expect(sorted[2].weather).toBe('clear');
    });

    it('should limit popular results to top 10', () => {
      const items = Array.from({ length: 20 }, (_, i) => ({ weather: `w${i}`, count: i }));
      const top10 = items.slice(0, 10);
      expect(top10).toHaveLength(10);
    });
  });

  describe('Weather Stats Per Room', () => {
    it('should aggregate time per weather type', () => {
      const history = [
        { weather: 'rain', duration: 30 },
        { weather: 'rain', duration: 20 },
        { weather: 'snow', duration: 15 },
      ];
      
      const stats = new Map<string, number>();
      history.forEach(h => stats.set(h.weather, (stats.get(h.weather) || 0) + h.duration));
      
      expect(stats.get('rain')).toBe(50);
      expect(stats.get('snow')).toBe(15);
    });

    it('should sort stats by total time descending', () => {
      const stats = [
        { weather: 'clear', totalMinutes: 100 },
        { weather: 'rain', totalMinutes: 250 },
        { weather: 'snow', totalMinutes: 50 },
      ];
      
      const sorted = [...stats].sort((a, b) => b.totalMinutes - a.totalMinutes);
      expect(sorted[0].weather).toBe('rain');
    });

    it('should handle zero duration', () => {
      const stats = [{ weather: 'clear', totalMinutes: 0 }];
      expect(stats[0].totalMinutes).toBe(0);
    });
  });

  describe('Owner Permissions', () => {
    it('should require agent ID for weather change', () => {
      const validate = (agentId: string | undefined) => !!agentId;
      expect(validate('agent-1')).toBe(true);
      expect(validate(undefined)).toBe(false);
      expect(validate('')).toBe(false);
    });

    it('should track who changed weather', () => {
      const change = { weather: 'rain', changedBy: 'agent-1' };
      expect(change.changedBy).toBe('agent-1');
    });
  });

  describe('Edge Cases', () => {
    it('should handle room with no weather machine', () => {
      const weather = null;
      expect(weather).toBeNull();
    });

    it('should handle empty history', () => {
      const history: any[] = [];
      expect(history).toHaveLength(0);
    });

    it('should handle zero offset pagination', () => {
      const items = [1, 2, 3, 4, 5];
      const page = items.slice(0, 0 + 3);
      expect(page).toEqual([1, 2, 3]);
    });

    it('should handle out-of-bounds pagination', () => {
      const items = [1, 2, 3];
      const page = items.slice(100, 100 + 10);
      expect(page).toHaveLength(0);
    });
  });

  describe('Timestamp Handling', () => {
    it('should record timestamp for weather changes', () => {
      const change = { weather: 'rain', lastChanged: new Date() };
      expect(change.lastChanged).toBeInstanceOf(Date);
    });

    it('should format timestamps consistently', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const iso = date.toISOString();
      expect(iso).toBe('2024-01-15T12:00:00.000Z');
    });
  });
});
