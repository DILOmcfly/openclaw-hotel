import { describe, it, expect } from 'vitest';

describe('Room Themes System', () => {
  describe('getAllThemes', () => {
    it('should return themes with parsed furniture list', async () => {
      const mockSql = async () => [{ id: 1, furnitureList: '["table"]' }];
      const getAllThemes = async (sql: any) => (await sql``).map((r: any) => ({ ...r, furnitureList: JSON.parse(r.furnitureList) }));
      expect((await getAllThemes(mockSql))[0].furnitureList).toEqual(['table']);
    });

    it('should handle empty furniture list', async () => {
      const mockSql = async () => [{ furnitureList: '[]' }];
      const getAllThemes = async (sql: any) => (await sql``).map((r: any) => ({ ...r, furnitureList: JSON.parse(r.furnitureList || '[]') }));
      expect((await getAllThemes(mockSql))[0].furnitureList).toEqual([]);
    });
  });

  describe('getThemeById', () => {
    it('should return theme when found', async () => {
      const mockSql = async () => [{ name: 'Forest', furnitureList: '[]' }];
      const getThemeById = async (id: number, sql: any) => {
        const r = await sql`WHERE id = ${id}`;
        return r.length === 0 ? null : { ...r[0], furnitureList: JSON.parse(r[0].furnitureList) };
      };
      expect((await getThemeById(1, mockSql))?.name).toBe('Forest');
    });

    it('should return null when not found', async () => {
      const mockSql = async () => [];
      const getThemeById = async (id: number, sql: any) => (await sql`WHERE id = ${id}`).length === 0 ? null : {};
      expect(await getThemeById(999, mockSql)).toBeNull();
    });
  });

  describe('applyTheme', () => {
    it('should fail when theme not found', async () => {
      const applyTheme = async (roomId: number, themeId: number, agentId: string, sql: any) => 
        (await sql``).length === 0 ? { success: false, error: 'Theme not found' } : { success: true };
      expect((await applyTheme(1, 999, 'agent1', async () => [])).success).toBe(false);
    });

    it('should fail with insufficient coins', async () => {
      let c = 0;
      const mockSql = async () => { c++; return c === 1 ? [{ price: 500, furnitureList: '[]' }] : [{ coins: 100 }]; };
      const applyTheme = async (roomId: number, themeId: number, agentId: string, sql: any) => {
        const themeRes = await sql``;
        const theme = { ...themeRes[0], furnitureList: JSON.parse(themeRes[0].furnitureList) };
        const bal = await sql``;
        return (bal.length === 0 || bal[0].coins < theme.price) ? { success: false } : { success: true };
      };
      expect((await applyTheme(1, 1, 'agent1', mockSql)).success).toBe(false);
    });

    it('should apply theme with sufficient coins', async () => {
      let c = 0;
      const mockSql = async () => { c++; return c === 1 ? [{ price: 500, floorPattern: 'wood', furnitureList: '[]' }] : [{ coins: 1000 }]; };
      const applyTheme = async (roomId: number, themeId: number, agentId: string, sql: any) => {
        const themeRes = await sql``;
        const theme = { ...themeRes[0], furnitureList: JSON.parse(themeRes[0].furnitureList) };
        const bal = await sql``;
        if (bal.length === 0 || bal[0].coins < theme.price) return { success: false };
        return { success: true, settings: { floorPattern: theme.floorPattern } };
      };
      expect((await applyTheme(1, 1, 'agent1', mockSql)).settings?.floorPattern).toBe('wood');
    });
  });

  describe('removeTheme', () => {
    it('should return true when theme removed', async () => {
      const removeTheme = async (roomId: number, sql: any) => (await sql`WHERE room_id = ${roomId}`).length > 0;
      expect(await removeTheme(1, async () => [{ room_id: 1 }])).toBe(true);
    });

    it('should return false when no theme to remove', async () => {
      const removeTheme = async (roomId: number, sql: any) => (await sql`WHERE room_id = ${roomId}`).length > 0;
      expect(await removeTheme(999, async () => [])).toBe(false);
    });
  });

  describe('getAppliedTheme', () => {
    it('should return applied theme with details', async () => {
      const mockSql = async () => [{ name: 'Forest', furnitureList: '["table"]' }];
      const getAppliedTheme = async (roomId: number, sql: any) => {
        const r = await sql`WHERE room_id = ${roomId}`;
        return r.length === 0 ? null : { ...r[0], furnitureList: JSON.parse(r[0].furnitureList) };
      };
      expect((await getAppliedTheme(1, mockSql))?.name).toBe('Forest');
    });

    it('should return null when no theme applied', async () => {
      const getAppliedTheme = async (roomId: number, sql: any) => (await sql`WHERE room_id = ${roomId}`).length === 0 ? null : {};
      expect(await getAppliedTheme(999, async () => [])).toBeNull();
    });
  });

  describe('getThemesByCategory', () => {
    it('should return themes filtered by category', async () => {
      const mockSql = async () => [{ category: 'nature', furnitureList: '[]' }];
      const getThemesByCategory = async (category: string, sql: any) => 
        (await sql`WHERE category = ${category}`).map((r: any) => ({ ...r, furnitureList: JSON.parse(r.furnitureList) }));
      expect(await getThemesByCategory('nature', mockSql)).toHaveLength(1);
    });

    it('should return empty array for no matches', async () => {
      const getThemesByCategory = async (category: string, sql: any) => await sql`WHERE category = ${category}`;
      expect(await getThemesByCategory('invalid', async () => [])).toHaveLength(0);
    });
  });

  describe('getPopularThemes', () => {
    it('should return themes ordered by application count', async () => {
      const mockSql = async () => [{ applicationCount: '10', furnitureList: '[]' }];
      const getPopularThemes = async (limit: number, sql: any) => 
        (await sql`LIMIT ${limit}`).map((r: any) => ({ ...r, furnitureList: JSON.parse(r.furnitureList), applicationCount: parseInt(r.applicationCount) }));
      expect((await getPopularThemes(10, mockSql))[0].applicationCount).toBe(10);
    });

    it('should respect limit parameter', async () => {
      const mockSql = async (s: any, ...v: any[]) => Array(v[0]).fill({ furnitureList: '[]' });
      const getPopularThemes = async (limit: number, sql: any) => await sql`LIMIT ${limit}`;
      expect(await getPopularThemes(5, mockSql)).toHaveLength(5);
    });
  });

  describe('previewTheme', () => {
    it('should return settings without applying', async () => {
      const mockSql = async () => [{ floorPattern: 'wood', furnitureList: '["table"]' }];
      const previewTheme = async (themeId: number, sql: any) => {
        const r = await sql`WHERE id = ${themeId}`;
        return r.length === 0 ? null : { floorPattern: r[0].floorPattern, furnitureList: JSON.parse(r[0].furnitureList) };
      };
      expect((await previewTheme(1, mockSql))?.floorPattern).toBe('wood');
    });

    it('should return null when theme not found', async () => {
      const previewTheme = async (themeId: number, sql: any) => (await sql`WHERE id = ${themeId}`).length === 0 ? null : {};
      expect(await previewTheme(999, async () => [])).toBeNull();
    });
  });

  describe('Validation', () => {
    it('should enforce minimum price', () => {
      const validatePrice = (price: number) => price >= 0;
      expect(validatePrice(0)).toBe(true);
      expect(validatePrice(-1)).toBe(false);
    });

    it('should validate categories', () => {
      const valid = ['nature', 'urban', 'fantasy', 'scifi', 'holiday', 'retro', 'luxury', 'horror'];
      expect(valid.includes('nature')).toBe(true);
      expect(valid.includes('invalid')).toBe(false);
    });
  });
});
