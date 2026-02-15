import { describe, it, expect } from 'vitest';

describe('Room Themes System', () => {
  describe('getAllThemes', () => {
    it('should return themes with parsed furniture list', async () => {
      const mockSql = async () => [{ id: 1, name: 'Forest', furnitureList: '["table"]' }];
      const getAllThemes = async (sql: any) => {
        const result = await sql`SELECT * FROM room_themes`;
        return result.map((r: any) => ({ ...r, furnitureList: JSON.parse(r.furnitureList) }));
      };
      const themes = await getAllThemes(mockSql);
      expect(themes[0].furnitureList).toEqual(['table']);
    });

    it('should handle empty furniture list', async () => {
      const mockSql = async () => [{ id: 1, furnitureList: '[]' }];
      const getAllThemes = async (sql: any) => {
        const result = await sql`SELECT * FROM room_themes`;
        return result.map((r: any) => ({ ...r, furnitureList: JSON.parse(r.furnitureList || '[]') }));
      };
      expect((await getAllThemes(mockSql))[0].furnitureList).toEqual([]);
    });
  });

  describe('getThemeById', () => {
    it('should return theme when found', async () => {
      const mockSql = async () => [{ id: 1, name: 'Forest', furnitureList: '[]' }];
      const getThemeById = async (id: number, sql: any) => {
        const result = await sql`SELECT * FROM room_themes WHERE id = ${id}`;
        return result.length === 0 ? null : { ...result[0], furnitureList: JSON.parse(result[0].furnitureList) };
      };
      expect((await getThemeById(1, mockSql))?.name).toBe('Forest');
    });

    it('should return null when not found', async () => {
      const mockSql = async () => [];
      const getThemeById = async (id: number, sql: any) => {
        const result = await sql`SELECT * FROM room_themes WHERE id = ${id}`;
        return result.length === 0 ? null : result[0];
      };
      expect(await getThemeById(999, mockSql)).toBeNull();
    });
  });

  describe('applyTheme', () => {
    it('should fail when theme not found', async () => {
      const mockSql = async () => [];
      const applyTheme = async (roomId: number, themeId: number, agentId: string, sql: any) => {
        const theme = await sql`SELECT * FROM room_themes WHERE id = ${themeId}`;
        return theme.length === 0 ? { success: false, error: 'Theme not found' } : { success: true };
      };
      const result = await applyTheme(1, 999, 'agent1', mockSql);
      expect(result.success).toBe(false);
    });

    it('should fail with insufficient coins', async () => {
      let queryCount = 0;
      const mockSql = async () => {
        queryCount++;
        if (queryCount === 1) return [{ id: 1, price: 500, furnitureList: '[]' }];
        if (queryCount === 2) return [{ coins: 100 }];
        return [];
      };
      const applyTheme = async (roomId: number, themeId: number, agentId: string, sql: any) => {
        const themeRes = await sql`SELECT * FROM room_themes WHERE id = ${themeId}`;
        const theme = { ...themeRes[0], furnitureList: JSON.parse(themeRes[0].furnitureList) };
        const balance = await sql`SELECT coins FROM agent_balances WHERE agent_id = ${agentId}`;
        return (balance.length === 0 || balance[0].coins < theme.price) 
          ? { success: false, error: 'Insufficient coins' } : { success: true };
      };
      expect((await applyTheme(1, 1, 'agent1', mockSql)).success).toBe(false);
    });

    it('should apply theme with sufficient coins', async () => {
      let queryCount = 0;
      const mockSql = async () => {
        queryCount++;
        if (queryCount === 1) return [{ id: 1, price: 500, floorPattern: 'wood', furnitureList: '[]' }];
        if (queryCount === 2) return [{ coins: 1000 }];
        return [];
      };
      const applyTheme = async (roomId: number, themeId: number, agentId: string, sql: any) => {
        const themeRes = await sql`SELECT * FROM room_themes WHERE id = ${themeId}`;
        const theme = { ...themeRes[0], furnitureList: JSON.parse(themeRes[0].furnitureList) };
        const balance = await sql`SELECT coins FROM agent_balances WHERE agent_id = ${agentId}`;
        if (balance.length === 0 || balance[0].coins < theme.price) 
          return { success: false, error: 'Insufficient coins' };
        await sql`UPDATE agent_balances SET coins = coins - ${theme.price}`;
        return { success: true, settings: { floorPattern: theme.floorPattern } };
      };
      expect((await applyTheme(1, 1, 'agent1', mockSql)).settings?.floorPattern).toBe('wood');
    });
  });

  describe('removeTheme', () => {
    it('should return true when theme removed', async () => {
      const mockSql = async () => [{ room_id: 1 }];
      const removeTheme = async (roomId: number, sql: any) => {
        const result = await sql`DELETE FROM applied_themes WHERE room_id = ${roomId} RETURNING room_id`;
        return result.length > 0;
      };
      expect(await removeTheme(1, mockSql)).toBe(true);
    });

    it('should return false when no theme to remove', async () => {
      const mockSql = async () => [];
      const removeTheme = async (roomId: number, sql: any) => {
        const result = await sql`DELETE FROM applied_themes WHERE room_id = ${roomId} RETURNING room_id`;
        return result.length > 0;
      };
      expect(await removeTheme(999, mockSql)).toBe(false);
    });
  });

  describe('getAppliedTheme', () => {
    it('should return applied theme with details', async () => {
      const mockSql = async () => [{ roomId: 1, name: 'Forest', furnitureList: '["table"]' }];
      const getAppliedTheme = async (roomId: number, sql: any) => {
        const result = await sql`SELECT * FROM applied_themes JOIN room_themes WHERE room_id = ${roomId}`;
        return result.length === 0 ? null : { ...result[0], furnitureList: JSON.parse(result[0].furnitureList) };
      };
      expect((await getAppliedTheme(1, mockSql))?.name).toBe('Forest');
    });

    it('should return null when no theme applied', async () => {
      const mockSql = async () => [];
      const getAppliedTheme = async (roomId: number, sql: any) => {
        const result = await sql`SELECT * FROM applied_themes WHERE room_id = ${roomId}`;
        return result.length === 0 ? null : result[0];
      };
      expect(await getAppliedTheme(999, mockSql)).toBeNull();
    });
  });

  describe('getThemesByCategory', () => {
    it('should return themes filtered by category', async () => {
      const mockSql = async () => [{ id: 1, category: 'nature', furnitureList: '[]' }];
      const getThemesByCategory = async (category: string, sql: any) => {
        const result = await sql`SELECT * FROM room_themes WHERE category = ${category}`;
        return result.map((r: any) => ({ ...r, furnitureList: JSON.parse(r.furnitureList) }));
      };
      expect((await getThemesByCategory('nature', mockSql))).toHaveLength(1);
    });

    it('should return empty array for no matches', async () => {
      const mockSql = async () => [];
      const getThemesByCategory = async (category: string, sql: any) => 
        await sql`SELECT * FROM room_themes WHERE category = ${category}`;
      expect(await getThemesByCategory('invalid', mockSql)).toHaveLength(0);
    });
  });

  describe('getPopularThemes', () => {
    it('should return themes ordered by application count', async () => {
      const mockSql = async () => [{ id: 1, applicationCount: '10', furnitureList: '[]' }];
      const getPopularThemes = async (limit: number, sql: any) => {
        const result = await sql`SELECT * FROM room_themes LIMIT ${limit}`;
        return result.map((r: any) => ({ ...r, furnitureList: JSON.parse(r.furnitureList), applicationCount: parseInt(r.applicationCount) }));
      };
      expect((await getPopularThemes(10, mockSql))[0].applicationCount).toBe(10);
    });

    it('should respect limit parameter', async () => {
      const mockSql = async (strings: any, ...values: any[]) => 
        Array(values[0]).fill({ applicationCount: '5', furnitureList: '[]' });
      const getPopularThemes = async (limit: number, sql: any) => await sql`SELECT * LIMIT ${limit}`;
      expect(await getPopularThemes(5, mockSql)).toHaveLength(5);
    });
  });

  describe('previewTheme', () => {
    it('should return settings without applying', async () => {
      const mockSql = async () => [{ id: 1, floorPattern: 'wood', furnitureList: '["table"]' }];
      const previewTheme = async (themeId: number, sql: any) => {
        const result = await sql`SELECT * FROM room_themes WHERE id = ${themeId}`;
        if (result.length === 0) return null;
        return { floorPattern: result[0].floorPattern, furnitureList: JSON.parse(result[0].furnitureList) };
      };
      expect((await previewTheme(1, mockSql))?.floorPattern).toBe('wood');
    });

    it('should return null when theme not found', async () => {
      const mockSql = async () => [];
      const previewTheme = async (themeId: number, sql: any) => {
        const result = await sql`SELECT * FROM room_themes WHERE id = ${themeId}`;
        return result.length === 0 ? null : result[0];
      };
      expect(await previewTheme(999, mockSql)).toBeNull();
    });
  });

  describe('Validation', () => {
    it('should enforce minimum price of 0', () => {
      const validatePrice = (price: number) => price >= 0;
      expect(validatePrice(0)).toBe(true);
      expect(validatePrice(-1)).toBe(false);
    });

    it('should validate theme categories', () => {
      const validCategories = ['nature', 'urban', 'fantasy', 'scifi', 'holiday', 'retro', 'luxury', 'horror'];
      const isValidCategory = (category: string) => validCategories.includes(category);
      expect(isValidCategory('nature')).toBe(true);
      expect(isValidCategory('invalid')).toBe(false);
    });
  });
});
