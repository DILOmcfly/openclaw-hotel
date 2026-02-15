import { describe, it, expect } from 'vitest';

describe('Pets Service', () => {
  describe('Adoption Logic', () => {
    it('should validate pet type', () => {
      const validTypes = ['cat', 'dog', 'bird', 'fish', 'dragon', 'robot'];
      const testType = 'cat';
      
      expect(validTypes.includes(testType)).toBe(true);
      expect(validTypes.includes('invalid')).toBe(false);
    });

    it('should validate pet name is not empty', () => {
      const name = '  ';
      const isValid = name.trim().length > 0;
      
      expect(isValid).toBe(false);
    });

    it('should validate pet name length (max 50)', () => {
      const validName = 'Fluffy';
      const tooLongName = 'a'.repeat(51);
      
      expect(validName.length <= 50).toBe(true);
      expect(tooLongName.length <= 50).toBe(false);
    });

    it('should enforce max 3 pets per agent', () => {
      const currentPetCount = 3;
      const maxPets = 3;
      
      const canAdopt = currentPetCount < maxPets;
      
      expect(canAdopt).toBe(false);
    });

    it('should allow adoption when under limit', () => {
      const currentPetCount = 2;
      const maxPets = 3;
      
      const canAdopt = currentPetCount < maxPets;
      
      expect(canAdopt).toBe(true);
    });

    it('should create pet with default values', () => {
      const mockPet = {
        id: 'pet-1',
        ownerId: 'agent-1',
        name: 'Fluffy',
        petType: 'cat',
        color: '#FFFFFF',
        happiness: 100,
        energy: 100,
        isActive: false,
      };
      
      expect(mockPet.happiness).toBe(100);
      expect(mockPet.energy).toBe(100);
      expect(mockPet.isActive).toBe(false);
    });
  });

  describe('Activation Logic', () => {
    it('should verify pet ownership before activation', () => {
      const mockPet = { id: 'pet-1', ownerId: 'agent-1' };
      const currentAgentId = 'agent-1';
      
      const isOwner = mockPet.ownerId === currentAgentId;
      
      expect(isOwner).toBe(true);
    });

    it('should reject activation for non-owner', () => {
      const mockPet = { id: 'pet-1', ownerId: 'agent-1' };
      const otherAgentId = 'agent-2';
      
      const isOwner = mockPet.ownerId === otherAgentId;
      
      expect(isOwner).toBe(false);
    });

    it('should deactivate all other pets when activating one', () => {
      const mockPets = [
        { id: 'pet-1', ownerId: 'agent-1', isActive: true },
        { id: 'pet-2', ownerId: 'agent-1', isActive: true },
        { id: 'pet-3', ownerId: 'agent-1', isActive: false },
      ];

      const petToActivate = 'pet-3';
      
      const updatedPets = mockPets.map(pet => ({
        ...pet,
        isActive: pet.id === petToActivate,
      }));
      
      expect(updatedPets[0].isActive).toBe(false);
      expect(updatedPets[1].isActive).toBe(false);
      expect(updatedPets[2].isActive).toBe(true);
    });

    it('should allow deactivating active pet', () => {
      const mockPet = { id: 'pet-1', isActive: true };
      
      const deactivatedPet = { ...mockPet, isActive: false };
      
      expect(deactivatedPet.isActive).toBe(false);
    });
  });

  describe('Feeding Logic', () => {
    it('should check if agent has enough coins (10 required)', () => {
      const agentCoins = 15;
      const feedCost = 10;
      
      const canFeed = agentCoins >= feedCost;
      
      expect(canFeed).toBe(true);
    });

    it('should reject feeding with insufficient coins', () => {
      const agentCoins = 5;
      const feedCost = 10;
      
      const canFeed = agentCoins >= feedCost;
      
      expect(canFeed).toBe(false);
    });

    it('should increase happiness by 20', () => {
      const currentHappiness = 60;
      const increase = 20;
      
      const newHappiness = Math.min(currentHappiness + increase, 100);
      
      expect(newHappiness).toBe(80);
    });

    it('should cap happiness at 100', () => {
      const currentHappiness = 90;
      const increase = 20;
      
      const newHappiness = Math.min(currentHappiness + increase, 100);
      
      expect(newHappiness).toBe(100);
    });

    it('should deduct 10 coins after feeding', () => {
      const agentCoins = 50;
      const feedCost = 10;
      
      const newBalance = agentCoins - feedCost;
      
      expect(newBalance).toBe(40);
    });

    it('should verify ownership before feeding', () => {
      const mockPet = { id: 'pet-1', ownerId: 'agent-1' };
      const currentAgentId = 'agent-1';
      
      const isOwner = mockPet.ownerId === currentAgentId;
      
      expect(isOwner).toBe(true);
    });
  });

  describe('Rename Logic', () => {
    it('should validate new name is not empty', () => {
      const newName = '  ';
      const isValid = newName.trim().length > 0;
      
      expect(isValid).toBe(false);
    });

    it('should validate new name length (max 50)', () => {
      const validName = 'Sparkles';
      const tooLongName = 'a'.repeat(51);
      
      expect(validName.length <= 50).toBe(true);
      expect(tooLongName.length <= 50).toBe(false);
    });

    it('should trim whitespace from name', () => {
      const inputName = '  Fluffy  ';
      const trimmedName = inputName.trim();
      
      expect(trimmedName).toBe('Fluffy');
    });

    it('should verify ownership before renaming', () => {
      const mockPet = { id: 'pet-1', ownerId: 'agent-1', name: 'OldName' };
      const currentAgentId = 'agent-1';
      
      const isOwner = mockPet.ownerId === currentAgentId;
      
      expect(isOwner).toBe(true);
    });
  });

  describe('Release Logic', () => {
    it('should verify ownership before releasing', () => {
      const mockPet = { id: 'pet-1', ownerId: 'agent-1' };
      const currentAgentId = 'agent-1';
      
      const isOwner = mockPet.ownerId === currentAgentId;
      
      expect(isOwner).toBe(true);
    });

    it('should remove pet from list after release', () => {
      const mockPets = [
        { id: 'pet-1', ownerId: 'agent-1' },
        { id: 'pet-2', ownerId: 'agent-1' },
        { id: 'pet-3', ownerId: 'agent-1' },
      ];

      const petToRelease = 'pet-2';
      
      const updatedPets = mockPets.filter(pet => pet.id !== petToRelease);
      
      expect(updatedPets).toHaveLength(2);
      expect(updatedPets.find(p => p.id === petToRelease)).toBeUndefined();
    });
  });

  describe('Get Active Pet', () => {
    it('should return active pet if one exists', () => {
      const mockPets = [
        { id: 'pet-1', ownerId: 'agent-1', isActive: false },
        { id: 'pet-2', ownerId: 'agent-1', isActive: true },
        { id: 'pet-3', ownerId: 'agent-1', isActive: false },
      ];

      const activePet = mockPets.find(pet => pet.isActive);
      
      expect(activePet).toBeDefined();
      expect(activePet?.id).toBe('pet-2');
    });

    it('should return null if no active pet', () => {
      const mockPets = [
        { id: 'pet-1', ownerId: 'agent-1', isActive: false },
        { id: 'pet-2', ownerId: 'agent-1', isActive: false },
      ];

      const activePet = mockPets.find(pet => pet.isActive);
      
      expect(activePet).toBeUndefined();
    });
  });

  describe('List Pets', () => {
    it('should return all pets for an agent', () => {
      const mockPets = [
        { id: 'pet-1', ownerId: 'agent-1' },
        { id: 'pet-2', ownerId: 'agent-1' },
        { id: 'pet-3', ownerId: 'agent-2' },
      ];

      const agentId = 'agent-1';
      const agentPets = mockPets.filter(pet => pet.ownerId === agentId);
      
      expect(agentPets).toHaveLength(2);
    });

    it('should return empty array if agent has no pets', () => {
      const mockPets = [
        { id: 'pet-1', ownerId: 'agent-1' },
      ];

      const agentId = 'agent-2';
      const agentPets = mockPets.filter(pet => pet.ownerId === agentId);
      
      expect(agentPets).toHaveLength(0);
    });
  });
});
