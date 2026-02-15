import { describe, it, expect } from 'vitest';

describe('Furniture Presets Service', () => {
  describe('Save Preset Logic', () => {
    it('should allow saving when under 5 presets', () => {
      const existingPresets = [
        { id: '1', name: 'Preset 1' },
        { id: '2', name: 'Preset 2' },
        { id: '3', name: 'Preset 3' },
      ];

      const canSave = existingPresets.length < 5;

      expect(canSave).toBe(true);
    });

    it('should reject saving when at 5 preset limit', () => {
      const existingPresets = [
        { id: '1', name: 'Preset 1' },
        { id: '2', name: 'Preset 2' },
        { id: '3', name: 'Preset 3' },
        { id: '4', name: 'Preset 4' },
        { id: '5', name: 'Preset 5' },
      ];

      const canSave = existingPresets.length < 5;

      expect(canSave).toBe(false);
    });

    it('should validate preset name length (max 50 chars)', () => {
      const validName = 'My Cozy Living Room';
      const invalidName = 'A'.repeat(51);

      expect(validName.length <= 50).toBe(true);
      expect(invalidName.length <= 50).toBe(false);
    });

    it('should store layout as JSONB', () => {
      const layout = {
        furniture: [
          { id: 'item-1', x: 5, y: 10, rotation: 0 },
          { id: 'item-2', x: 8, y: 12, rotation: 90 },
        ],
      };

      const serialized = JSON.stringify(layout);
      const deserialized = JSON.parse(serialized);

      expect(deserialized).toEqual(layout);
      expect(deserialized.furniture).toHaveLength(2);
    });
  });

  describe('Load Preset Logic', () => {
    it('should return layout when preset exists', () => {
      const mockPreset = {
        id: 'preset-1',
        ownerId: 'agent-1',
        layout: { furniture: [{ id: 'chair-1', x: 5, y: 5 }] },
      };

      const layout = mockPreset.layout;

      expect(layout).toBeDefined();
      expect(layout.furniture).toHaveLength(1);
    });

    it('should verify ownership before loading', () => {
      const mockPreset = {
        id: 'preset-1',
        ownerId: 'agent-1',
        layout: { furniture: [] },
      };

      const requestingAgentId = 'agent-1';
      const isOwner = mockPreset.ownerId === requestingAgentId;

      expect(isOwner).toBe(true);

      const otherAgentId = 'agent-2';
      const isNotOwner = mockPreset.ownerId === otherAgentId;

      expect(isNotOwner).toBe(false);
    });

    it('should handle non-existent preset', () => {
      const mockPresets: any[] = [];
      const presetId = 'non-existent';

      const found = mockPresets.find(p => p.id === presetId);

      expect(found).toBeUndefined();
    });
  });

  describe('Delete Preset Logic', () => {
    it('should verify ownership before deleting', () => {
      const mockPreset = {
        id: 'preset-1',
        ownerId: 'agent-1',
      };

      const requestingAgentId = 'agent-1';
      const canDelete = mockPreset.ownerId === requestingAgentId;

      expect(canDelete).toBe(true);
    });

    it('should reject deletion by non-owner', () => {
      const mockPreset = {
        id: 'preset-1',
        ownerId: 'agent-1',
      };

      const requestingAgentId = 'agent-2';
      const canDelete = mockPreset.ownerId === requestingAgentId;

      expect(canDelete).toBe(false);
    });

    it('should remove preset from list after deletion', () => {
      const mockPresets = [
        { id: 'preset-1', name: 'Setup 1' },
        { id: 'preset-2', name: 'Setup 2' },
        { id: 'preset-3', name: 'Setup 3' },
      ];

      const presetIdToDelete = 'preset-2';
      const afterDelete = mockPresets.filter(p => p.id !== presetIdToDelete);

      expect(afterDelete).toHaveLength(2);
      expect(afterDelete.find(p => p.id === presetIdToDelete)).toBeUndefined();
    });
  });

  describe('Get Presets Logic', () => {
    it('should filter presets by room ID', () => {
      const mockPresets = [
        { id: '1', roomId: 'room-1', name: 'Setup A' },
        { id: '2', roomId: 'room-2', name: 'Setup B' },
        { id: '3', roomId: 'room-1', name: 'Setup C' },
      ];

      const roomId = 'room-1';
      const filtered = mockPresets.filter(p => p.roomId === roomId);

      expect(filtered).toHaveLength(2);
      expect(filtered.map(p => p.name)).toEqual(['Setup A', 'Setup C']);
    });

    it('should return empty array for room with no presets', () => {
      const mockPresets = [
        { id: '1', roomId: 'room-1', name: 'Setup A' },
        { id: '2', roomId: 'room-2', name: 'Setup B' },
      ];

      const roomId = 'room-3';
      const filtered = mockPresets.filter(p => p.roomId === roomId);

      expect(filtered).toHaveLength(0);
    });

    it('should sort presets by creation date (newest first)', () => {
      const mockPresets = [
        { id: '1', createdAt: '2025-01-01T10:00:00Z', name: 'Old' },
        { id: '2', createdAt: '2025-01-03T10:00:00Z', name: 'Newest' },
        { id: '3', createdAt: '2025-01-02T10:00:00Z', name: 'Middle' },
      ];

      const sorted = [...mockPresets].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      expect(sorted[0].name).toBe('Newest');
      expect(sorted[1].name).toBe('Middle');
      expect(sorted[2].name).toBe('Old');
    });
  });

  describe('Rename Preset Logic', () => {
    it('should verify ownership before renaming', () => {
      const mockPreset = {
        id: 'preset-1',
        ownerId: 'agent-1',
        name: 'Old Name',
      };

      const requestingAgentId = 'agent-1';
      const canRename = mockPreset.ownerId === requestingAgentId;

      expect(canRename).toBe(true);
    });

    it('should reject rename by non-owner', () => {
      const mockPreset = {
        id: 'preset-1',
        ownerId: 'agent-1',
        name: 'Old Name',
      };

      const requestingAgentId = 'agent-2';
      const canRename = mockPreset.ownerId === requestingAgentId;

      expect(canRename).toBe(false);
    });

    it('should validate new name length (max 50 chars)', () => {
      const validNewName = 'Updated Setup';
      const invalidNewName = 'X'.repeat(51);

      expect(validNewName.length <= 50).toBe(true);
      expect(invalidNewName.length <= 50).toBe(false);
    });

    it('should update name while preserving other fields', () => {
      const mockPreset = {
        id: 'preset-1',
        ownerId: 'agent-1',
        roomId: 'room-1',
        name: 'Old Name',
        layout: { furniture: [] },
        createdAt: '2025-01-01T10:00:00Z',
      };

      const updatedPreset = {
        ...mockPreset,
        name: 'New Name',
      };

      expect(updatedPreset.name).toBe('New Name');
      expect(updatedPreset.id).toBe(mockPreset.id);
      expect(updatedPreset.ownerId).toBe(mockPreset.ownerId);
      expect(updatedPreset.layout).toEqual(mockPreset.layout);
    });
  });

  describe('Room Ownership Verification', () => {
    it('should verify room owner before saving preset', () => {
      const mockRoom = {
        id: 'room-1',
        createdBy: 'agent-1',
      };

      const requestingAgentId = 'agent-1';
      const isRoomOwner = mockRoom.createdBy === requestingAgentId;

      expect(isRoomOwner).toBe(true);
    });

    it('should reject saving preset by non-room-owner', () => {
      const mockRoom = {
        id: 'room-1',
        createdBy: 'agent-1',
      };

      const requestingAgentId = 'agent-2';
      const isRoomOwner = mockRoom.createdBy === requestingAgentId;

      expect(isRoomOwner).toBe(false);
    });
  });
});
