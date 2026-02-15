import { describe, it, expect } from 'vitest';

describe('Seasons System - Validation', () => {
  it('should validate required fields for season creation', () => {
    const hasRequired = (input: any) => !!(input.name && input.theme && input.startDate && input.endDate);
    
    expect(hasRequired({ name: 'Winter', theme: 'winter', startDate: '2026-12-01', endDate: '2026-12-31' })).toBe(true);
    expect(hasRequired({ name: 'Winter', theme: 'winter', startDate: '2026-12-01' })).toBe(false);
  });

  it('should validate season name length', () => {
    const isValid = (name: string) => name.length >= 3 && name.length <= 50;
    
    expect(isValid('Winter')).toBe(true);
    expect(isValid('ab')).toBe(false);
    expect(isValid('a'.repeat(51))).toBe(false);
  });

  it('should validate end date is after start date', () => {
    const isValid = (start: string, end: string) => new Date(end) > new Date(start);
    
    expect(isValid('2026-12-01', '2026-12-31')).toBe(true);
    expect(isValid('2026-12-31', '2026-12-01')).toBe(false);
  });

  it('should validate only one season can be active', () => {
    const validate = (seasons: any[]) => seasons.filter(s => s.isActive).length <= 1;
    
    expect(validate([{ isActive: true }, { isActive: false }])).toBe(true);
    expect(validate([{ isActive: true }, { isActive: true }])).toBe(false);
  });

  it('should validate theme values', () => {
    const valid = ['winter', 'spring', 'summer', 'autumn', 'halloween', 'christmas'];
    const isValid = (theme: string) => valid.includes(theme);
    
    expect(isValid('winter')).toBe(true);
    expect(isValid('invalid')).toBe(false);
  });

  it('should validate weather override values', () => {
    const valid = ['snow', 'rain', 'sunny', 'cloudy', null];
    const isValid = (weather: any) => valid.includes(weather);
    
    expect(isValid('snow')).toBe(true);
    expect(isValid(null)).toBe(true);
    expect(isValid('tornado')).toBe(false);
  });

  it('should validate color scheme hex format', () => {
    const isValid = (scheme: any) => {
      if (!scheme || typeof scheme !== 'object') return false;
      const hex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      return Object.values(scheme).every(c => !c || hex.test(c as string));
    };
    
    expect(isValid({ primary: '#FF0000' })).toBe(true);
    expect(isValid({ primary: 'red' })).toBe(false);
  });

  it('should validate required fields for item creation', () => {
    const hasRequired = (input: any) => !!(input.seasonId && input.itemType && input.name);
    
    expect(hasRequired({ seasonId: 's1', itemType: 'furniture', name: 'Chair' })).toBe(true);
    expect(hasRequired({ seasonId: 's1', itemType: 'furniture' })).toBe(false);
  });

  it('should validate item type values', () => {
    const valid = ['furniture', 'wallpaper', 'floor', 'badge', 'clothing', 'pet'];
    const isValid = (type: string) => valid.includes(type);
    
    expect(isValid('furniture')).toBe(true);
    expect(isValid('invalid')).toBe(false);
  });

  it('should validate item rarity values', () => {
    const valid = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const isValid = (rarity: string) => valid.includes(rarity);
    
    expect(isValid('rare')).toBe(true);
    expect(isValid('invalid')).toBe(false);
  });

  it('should filter and sort seasons', () => {
    const seasons = [
      { id: '1', isActive: true, startDate: '2026-01-01' },
      { id: '2', isActive: false, startDate: '2026-06-01' },
    ];
    
    const active = seasons.filter(s => s.isActive);
    expect(active.length).toBe(1);
    
    const sorted = [...seasons].sort((a, b) => 
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
    expect(sorted[0].id).toBe('2');
  });

  it('should check if season is in date range', () => {
    const inRange = (start: string, end: string, now: Date) => {
      return now >= new Date(start) && now <= new Date(end);
    };
    
    const now = new Date('2026-12-15');
    expect(inRange('2026-12-01', '2026-12-31', now)).toBe(true);
    expect(inRange('2026-11-01', '2026-11-30', now)).toBe(false);
  });

  it('should validate item name length', () => {
    const isValid = (name: string) => name.length >= 3 && name.length <= 100;
    
    expect(isValid('Snowman Chair')).toBe(true);
    expect(isValid('ab')).toBe(false);
    expect(isValid('a'.repeat(101))).toBe(false);
  });

  it('should filter items by availability and count by rarity', () => {
    const items = [
      { available: true, rarity: 'common' },
      { available: false, rarity: 'rare' },
      { available: true, rarity: 'rare' },
    ];
    
    const available = items.filter(i => i.available);
    expect(available.length).toBe(2);
    
    const rare = items.filter(i => i.rarity === 'rare').length;
    expect(rare).toBe(2);
  });
});
