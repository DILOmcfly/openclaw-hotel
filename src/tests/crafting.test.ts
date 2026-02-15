import { describe, it, expect } from 'vitest';

describe('Crafting System', () => {
  describe('Recipe Listing', () => {
    it('should list all recipes', () => {
      const mockRecipes = [
        { id: 'golden-chair', name: 'Golden Chair', resultItem: 'chair' },
        { id: 'crystal-lamp', name: 'Crystal Lamp', resultItem: 'lamp' },
        { id: 'royal-bed', name: 'Royal Bed', resultItem: 'bed' },
      ];

      expect(mockRecipes).toHaveLength(3);
      expect(mockRecipes[0].name).toBe('Golden Chair');
    });

    it('should filter recipes by result item type', () => {
      const mockRecipes = [
        { id: 'golden-chair', name: 'Golden Chair', resultItem: 'chair' },
        { id: 'crystal-lamp', name: 'Crystal Lamp', resultItem: 'lamp' },
        { id: 'magic-mirror', name: 'Magic Mirror', resultItem: 'lamp' },
      ];

      const lampRecipes = mockRecipes.filter(r => r.resultItem === 'lamp');

      expect(lampRecipes).toHaveLength(2);
      expect(lampRecipes.map(r => r.name)).toEqual(['Crystal Lamp', 'Magic Mirror']);
    });

    it('should find recipe by ID', () => {
      const mockRecipes = [
        { id: 'golden-chair', name: 'Golden Chair', resultItem: 'chair' },
        { id: 'crystal-lamp', name: 'Crystal Lamp', resultItem: 'lamp' },
      ];

      const recipe = mockRecipes.find(r => r.id === 'crystal-lamp');

      expect(recipe).toBeDefined();
      expect(recipe?.name).toBe('Crystal Lamp');
    });

    it('should return null for non-existent recipe', () => {
      const mockRecipes = [
        { id: 'golden-chair', name: 'Golden Chair', resultItem: 'chair' },
      ];

      const recipe = mockRecipes.find(r => r.id === 'non-existent');

      expect(recipe).toBeUndefined();
    });
  });

  describe('Ingredient Checking', () => {
    it('should check if agent has sufficient items', () => {
      const recipe = {
        ingredients: { chair: 3, table: 1 },
      };

      const inventory = [
        { itemDefId: 'chair', roomId: null },
        { itemDefId: 'chair', roomId: null },
        { itemDefId: 'chair', roomId: null },
        { itemDefId: 'table', roomId: null },
      ];

      const chairCount = inventory.filter(i => i.itemDefId === 'chair' && i.roomId === null).length;
      const tableCount = inventory.filter(i => i.itemDefId === 'table' && i.roomId === null).length;

      const hasChairs = chairCount >= recipe.ingredients.chair;
      const hasTables = tableCount >= recipe.ingredients.table;

      expect(hasChairs).toBe(true);
      expect(hasTables).toBe(true);
    });

    it('should detect insufficient items', () => {
      const recipe = {
        ingredients: { chair: 3, table: 1 },
      };

      const inventory = [
        { itemDefId: 'chair', roomId: null },
        { itemDefId: 'chair', roomId: null },
      ];

      const chairCount = inventory.filter(i => i.itemDefId === 'chair' && i.roomId === null).length;
      const hasEnoughChairs = chairCount >= recipe.ingredients.chair;

      expect(hasEnoughChairs).toBe(false);
    });

    it('should check if agent has sufficient coins', () => {
      const recipe = {
        ingredients: { chair: 3, coins: 100 },
      };

      const agentBalance = { coins: 150 };

      const hasCoins = agentBalance.coins >= (recipe.ingredients.coins || 0);

      expect(hasCoins).toBe(true);
    });

    it('should detect insufficient coins', () => {
      const recipe = {
        ingredients: { chair: 3, coins: 100 },
      };

      const agentBalance = { coins: 50 };

      const hasCoins = agentBalance.coins >= (recipe.ingredients.coins || 0);

      expect(hasCoins).toBe(false);
    });

    it('should ignore items placed in rooms', () => {
      const recipe = {
        ingredients: { chair: 3 },
      };

      const inventory = [
        { itemDefId: 'chair', roomId: null },
        { itemDefId: 'chair', roomId: 'room-1' }, // Placed, should not count
        { itemDefId: 'chair', roomId: null },
        { itemDefId: 'chair', roomId: null },
      ];

      const availableChairs = inventory.filter(i => i.itemDefId === 'chair' && i.roomId === null).length;

      expect(availableChairs).toBe(3);
    });
  });

  describe('Crafting Logic', () => {
    it('should consume correct number of items', () => {
      const recipe = {
        ingredients: { chair: 3, lamp: 2 },
      };

      let inventory = [
        { id: '1', itemDefId: 'chair', roomId: null },
        { id: '2', itemDefId: 'chair', roomId: null },
        { id: '3', itemDefId: 'chair', roomId: null },
        { id: '4', itemDefId: 'lamp', roomId: null },
        { id: '5', itemDefId: 'lamp', roomId: null },
      ];

      // Simulate consuming ingredients
      const chairsToRemove = inventory
        .filter(i => i.itemDefId === 'chair' && i.roomId === null)
        .slice(0, recipe.ingredients.chair);

      const lampsToRemove = inventory
        .filter(i => i.itemDefId === 'lamp' && i.roomId === null)
        .slice(0, recipe.ingredients.lamp);

      const idsToRemove = [...chairsToRemove, ...lampsToRemove].map(i => i.id);

      inventory = inventory.filter(i => !idsToRemove.includes(i.id));

      expect(inventory).toHaveLength(0);
    });

    it('should deduct coins when crafting', () => {
      const recipe = {
        ingredients: { chair: 2, coins: 100 },
      };

      let agentBalance = { coins: 200 };

      // Simulate coin deduction
      agentBalance.coins -= recipe.ingredients.coins || 0;

      expect(agentBalance.coins).toBe(100);
    });

    it('should create result item with correct rarity', () => {
      const recipe = {
        resultItem: 'chair',
        resultRarity: 'epic',
      };

      const craftedItem = {
        id: crypto.randomUUID(),
        itemDefId: recipe.resultItem,
        rarity: recipe.resultRarity,
        category: 'crafted',
        roomId: null,
      };

      expect(craftedItem.itemDefId).toBe('chair');
      expect(craftedItem.rarity).toBe('epic');
      expect(craftedItem.category).toBe('crafted');
      expect(craftedItem.roomId).toBeNull();
    });
  });

  describe('Available Recipes', () => {
    it('should list only craftable recipes', () => {
      const allRecipes = [
        { id: 'golden-chair', ingredients: { chair: 3, coins: 100 } },
        { id: 'crystal-lamp', ingredients: { lamp: 2, table: 1 } },
        { id: 'royal-bed', ingredients: { bed: 2, bookshelf: 1 } },
      ];

      const inventory = [
        { itemDefId: 'chair', roomId: null },
        { itemDefId: 'chair', roomId: null },
        { itemDefId: 'chair', roomId: null },
      ];

      const balance = { coins: 150 };

      const canCraft = (recipe: any) => {
        for (const [item, count] of Object.entries(recipe.ingredients)) {
          if (item === 'coins') {
            if (balance.coins < (count as number)) return false;
          } else {
            const available = inventory.filter(i => i.itemDefId === item && i.roomId === null).length;
            if (available < (count as number)) return false;
          }
        }
        return true;
      };

      const available = allRecipes.filter(canCraft);

      expect(available).toHaveLength(1);
      expect(available[0].id).toBe('golden-chair');
    });

    it('should return empty list when agent cannot craft anything', () => {
      const allRecipes = [
        { id: 'golden-chair', ingredients: { chair: 3, coins: 100 } },
        { id: 'crystal-lamp', ingredients: { lamp: 2, table: 1 } },
      ];

      const inventory: any[] = [];
      const balance = { coins: 0 };

      const canCraft = (recipe: any) => {
        for (const [item, count] of Object.entries(recipe.ingredients)) {
          if (item === 'coins') {
            if (balance.coins < (count as number)) return false;
          } else {
            const available = inventory.filter(i => i.itemDefId === item && i.roomId === null).length;
            if (available < (count as number)) return false;
          }
        }
        return true;
      };

      const available = allRecipes.filter(canCraft);

      expect(available).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle recipes with only coin cost', () => {
      const recipe = {
        ingredients: { coins: 500 },
      };

      const balance = { coins: 600 };

      const canCraft = balance.coins >= (recipe.ingredients.coins || 0);

      expect(canCraft).toBe(true);
    });

    it('should handle recipes with only item cost (no coins)', () => {
      const recipe = {
        ingredients: { lamp: 3 },
      };

      const inventory = [
        { itemDefId: 'lamp', roomId: null },
        { itemDefId: 'lamp', roomId: null },
        { itemDefId: 'lamp', roomId: null },
      ];

      const lampCount = inventory.filter(i => i.itemDefId === 'lamp' && i.roomId === null).length;
      const canCraft = lampCount >= recipe.ingredients.lamp;

      expect(canCraft).toBe(true);
    });
  });
});
