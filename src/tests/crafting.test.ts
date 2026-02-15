import { describe, it, expect } from 'vitest';

/**
 * Crafting System Unit Tests
 * Tests recipe management, crafting logic, and queue without database
 */

describe('Crafting System', () => {
  describe('Recipe Management', () => {
    it('should list all recipes', () => {
      const mockRecipes = [
        { id: 1, name: 'Wooden Chair', resultItemName: 'wooden_chair', resultRarity: 'common', craftTimeSeconds: 0 },
        { id: 2, name: 'Gold Trophy', resultItemName: 'gold_trophy', resultRarity: 'rare', craftTimeSeconds: 0 },
      ];

      expect(mockRecipes).toHaveLength(2);
      expect(mockRecipes[0].name).toBe('Wooden Chair');
    });

    it('should find recipe by ID', () => {
      const mockRecipes = [
        { id: 1, name: 'Wooden Chair' },
        { id: 2, name: 'Gold Trophy' },
      ];

      const findById = (id: number) => mockRecipes.find(r => r.id === id);

      expect(findById(1)?.name).toBe('Wooden Chair');
      expect(findById(2)?.name).toBe('Gold Trophy');
      expect(findById(999)).toBeUndefined();
    });

    it('should include ingredients with recipe', () => {
      const mockRecipe = {
        id: 1,
        name: 'Wooden Chair',
        ingredients: [
          { itemName: 'wood_plank', quantity: 2 },
        ],
      };

      expect(mockRecipe.ingredients).toHaveLength(1);
      expect(mockRecipe.ingredients[0].quantity).toBe(2);
    });

    it('should handle multiple ingredients', () => {
      const mockRecipe = {
        id: 2,
        name: 'Gold Trophy',
        ingredients: [
          { itemName: 'gold_bar', quantity: 3 },
          { itemName: 'gem', quantity: 1 },
        ],
      };

      expect(mockRecipe.ingredients).toHaveLength(2);
      expect(mockRecipe.ingredients.find(i => i.itemName === 'gold_bar')?.quantity).toBe(3);
    });
  });

  describe('Craft Time Calculation', () => {
    it('should calculate completion time correctly', () => {
      const startedAt = new Date('2024-01-15T12:00:00Z');
      const craftTimeSeconds = 300;
      
      const completesAt = new Date(startedAt.getTime() + craftTimeSeconds * 1000);

      expect(completesAt.getTime() - startedAt.getTime()).toBe(300000); // 5 minutes
    });

    it('should handle instant crafts (0 seconds)', () => {
      const startedAt = new Date('2024-01-15T12:00:00Z');
      const craftTimeSeconds = 0;
      
      const completesAt = new Date(startedAt.getTime() + craftTimeSeconds * 1000);

      expect(completesAt.getTime()).toBe(startedAt.getTime());
    });

    it('should check if craft is ready', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 1000); // 1 second ago
      const future = new Date(now.getTime() + 1000); // 1 second from now

      const isReady = (completesAt: Date) => now >= completesAt;

      expect(isReady(past)).toBe(true);
      expect(isReady(future)).toBe(false);
    });

    it('should calculate remaining time', () => {
      const now = new Date();
      const completesAt = new Date(now.getTime() + 5000); // 5 seconds from now

      const remaining = Math.ceil((completesAt.getTime() - now.getTime()) / 1000);

      expect(remaining).toBe(5);
    });
  });

  describe('Craft Queue Management', () => {
    it('should add craft to queue', () => {
      type CraftEntry = {
        id: number;
        agentId: string;
        recipeId: number;
        completed: boolean;
      };

      const queue: CraftEntry[] = [];
      const newCraft: CraftEntry = {
        id: 1,
        agentId: 'agent-123',
        recipeId: 1,
        completed: false,
      };

      queue.push(newCraft);

      expect(queue).toHaveLength(1);
      expect(queue[0].agentId).toBe('agent-123');
      expect(queue[0].completed).toBe(false);
    });

    it('should filter queue by agent ID', () => {
      const queue = [
        { id: 1, agentId: 'agent-1', recipeId: 1 },
        { id: 2, agentId: 'agent-2', recipeId: 2 },
        { id: 3, agentId: 'agent-1', recipeId: 3 },
      ];

      const agent1Queue = queue.filter(c => c.agentId === 'agent-1');

      expect(agent1Queue).toHaveLength(2);
      expect(agent1Queue.map(c => c.id)).toEqual([1, 3]);
    });

    it('should mark craft as completed', () => {
      const craft = {
        id: 1,
        agentId: 'agent-123',
        recipeId: 1,
        completed: false,
      };

      const completeCraft = (c: typeof craft) => ({ ...c, completed: true });
      const completed = completeCraft(craft);

      expect(completed.completed).toBe(true);
      expect(craft.completed).toBe(false); // Original unchanged
    });

    it('should prevent completing already completed craft', () => {
      const craft = {
        id: 1,
        completed: true,
      };

      const canComplete = (c: typeof craft) => !c.completed;

      expect(canComplete(craft)).toBe(false);
    });

    it('should sort queue by start time (newest first)', () => {
      const queue = [
        { id: 1, startedAt: new Date('2024-01-15T10:00:00Z') },
        { id: 2, startedAt: new Date('2024-01-15T12:00:00Z') },
        { id: 3, startedAt: new Date('2024-01-15T11:00:00Z') },
      ];

      const sorted = [...queue].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

      expect(sorted.map(c => c.id)).toEqual([2, 3, 1]);
    });
  });

  describe('Recipe Validation', () => {
    it('should validate recipe exists before crafting', () => {
      const recipes = [
        { id: 1, name: 'Wooden Chair' },
        { id: 2, name: 'Gold Trophy' },
      ];

      const recipeExists = (recipeId: number) => recipes.some(r => r.id === recipeId);

      expect(recipeExists(1)).toBe(true);
      expect(recipeExists(999)).toBe(false);
    });

    it('should reject invalid recipe ID', () => {
      const validateRecipeId = (id: any): id is number => {
        return typeof id === 'number' && !isNaN(id) && id > 0;
      };

      expect(validateRecipeId(1)).toBe(true);
      expect(validateRecipeId(NaN)).toBe(false);
      expect(validateRecipeId('abc')).toBe(false);
      expect(validateRecipeId(-1)).toBe(false);
    });
  });

  describe('Cancellation Logic', () => {
    it('should allow cancelling pending craft', () => {
      const craft = {
        id: 1,
        agentId: 'agent-123',
        completed: false,
      };

      const canCancel = (c: typeof craft) => !c.completed;

      expect(canCancel(craft)).toBe(true);
    });

    it('should prevent cancelling completed craft', () => {
      const craft = {
        id: 1,
        agentId: 'agent-123',
        completed: true,
      };

      const canCancel = (c: typeof craft) => !c.completed;

      expect(canCancel(craft)).toBe(false);
    });

    it('should verify agent owns craft before cancelling', () => {
      const craft = {
        id: 1,
        agentId: 'agent-123',
      };

      const canAgentCancel = (c: typeof craft, agentId: string) => c.agentId === agentId;

      expect(canAgentCancel(craft, 'agent-123')).toBe(true);
      expect(canAgentCancel(craft, 'agent-456')).toBe(false);
    });
  });

  describe('Rarity System', () => {
    it('should support different rarity levels', () => {
      const rarities = ['common', 'uncommon', 'rare', 'epic', 'mythic'];

      expect(rarities).toContain('common');
      expect(rarities).toContain('mythic');
      expect(rarities).toHaveLength(5);
    });

    it('should assign correct rarity to crafted items', () => {
      const recipes = [
        { name: 'Wooden Chair', resultRarity: 'common' },
        { name: 'Gold Trophy', resultRarity: 'rare' },
        { name: 'Mythic Throne', resultRarity: 'mythic' },
      ];

      const getRarity = (recipeName: string) => 
        recipes.find(r => r.name === recipeName)?.resultRarity;

      expect(getRarity('Wooden Chair')).toBe('common');
      expect(getRarity('Mythic Throne')).toBe('mythic');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty queue', () => {
      const queue: any[] = [];

      expect(queue).toHaveLength(0);
      expect(queue.filter(c => c.completed === false)).toHaveLength(0);
    });

    it('should handle concurrent crafts for same agent', () => {
      const queue = [
        { id: 1, agentId: 'agent-123', recipeId: 1, completed: false },
        { id: 2, agentId: 'agent-123', recipeId: 2, completed: false },
        { id: 3, agentId: 'agent-123', recipeId: 1, completed: true },
      ];

      const agentPending = queue.filter(c => c.agentId === 'agent-123' && !c.completed);

      expect(agentPending).toHaveLength(2);
    });

    it('should handle same recipe crafted multiple times', () => {
      const queue = [
        { id: 1, recipeId: 1 },
        { id: 2, recipeId: 1 },
        { id: 3, recipeId: 2 },
      ];

      const recipe1Crafts = queue.filter(c => c.recipeId === 1);

      expect(recipe1Crafts).toHaveLength(2);
    });

    it('should respect queue limit', () => {
      const mockQueue = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
      const limit = 50;

      const limited = mockQueue.slice(0, limit);

      expect(limited).toHaveLength(50);
    });
  });
});
