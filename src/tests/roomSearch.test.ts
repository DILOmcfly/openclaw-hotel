import { describe, it, expect, vi } from 'vitest';
import { addTag, removeTag, getTagsByRoom, searchByTag, getPopularTags, setDescription, getDescription, searchRooms } from '../services/roomSearch.js';

describe('Room Search - Tag Management', () => {
  it('should add a valid tag to a room', async () => {
    const mockSql = vi.fn().mockResolvedValueOnce([{ count: '3' }]).mockResolvedValueOnce([{ room_id: 'room1', tag: 'gaming' }]);
    const result = await addTag('room1', 'gaming', 'user1', mockSql as any);
    expect(result.success).toBe(true);
    expect(mockSql).toHaveBeenCalledTimes(2);
  });

  it('should reject tag longer than 20 characters', async () => {
    const mockSql = vi.fn();
    const result = await addTag('room1', 'a'.repeat(21), 'user1', mockSql as any);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Tag must be 1-20 characters');
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('should reject empty tag', async () => {
    const mockSql = vi.fn();
    const result = await addTag('room1', '', 'user1', mockSql as any);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Tag must be 1-20 characters');
  });

  it('should enforce maximum 10 tags per room', async () => {
    const mockSql = vi.fn().mockResolvedValueOnce([{ count: '10' }]);
    const result = await addTag('room1', 'newtag', 'user1', mockSql as any);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Maximum 10 tags per room');
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it('should remove a tag successfully', async () => {
    const mockSql = vi.fn().mockResolvedValueOnce([]);
    const result = await removeTag('room1', 'gaming', mockSql as any);
    expect(result.success).toBe(true);
  });

  it('should get all tags for a room', async () => {
    const mockSql = vi.fn().mockResolvedValueOnce([
      { roomId: 'room1', tag: 'gaming', createdBy: 'user1', createdAt: '2025-01-01' },
      { roomId: 'room1', tag: 'roleplay', createdBy: 'user1', createdAt: '2025-01-02' },
    ]);
    const tags = await getTagsByRoom('room1', mockSql as any);
    expect(tags).toHaveLength(2);
    expect(tags[0].tag).toBe('gaming');
  });

  it('should find rooms by tag', async () => {
    const mockSql = vi.fn().mockResolvedValueOnce([{ roomId: 'room1' }, { roomId: 'room2' }]);
    const roomIds = await searchByTag('gaming', mockSql as any);
    expect(roomIds).toEqual(['room1', 'room2']);
  });

  it('should return popular tags', async () => {
    const mockSql = vi.fn().mockResolvedValueOnce([
      { tag: 'gaming', count: '15' },
      { tag: 'roleplay', count: '10' },
    ]);
    const tags = await getPopularTags(10, mockSql as any);
    expect(tags).toHaveLength(2);
    expect(tags[0]).toEqual({ tag: 'gaming', count: 15 });
  });
});

describe('Room Search - Descriptions', () => {
  it('should set room description successfully', async () => {
    const mockSql = vi.fn().mockResolvedValueOnce([]);
    const result = await setDescription('room1', 'A fun place', 'This is a detailed description', 'No spam', mockSql as any);
    expect(result.success).toBe(true);
  });

  it('should reject short_desc over 200 characters', async () => {
    const mockSql = vi.fn();
    const result = await setDescription('room1', 'a'.repeat(201), 'desc', 'rules', mockSql as any);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Short description must be <= 200 characters');
  });

  it('should reject long_desc over 2000 characters', async () => {
    const mockSql = vi.fn();
    const result = await setDescription('room1', 'short', 'a'.repeat(2001), 'rules', mockSql as any);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Long description must be <= 2000 characters');
  });

  it('should reject rules over 500 characters', async () => {
    const mockSql = vi.fn();
    const result = await setDescription('room1', 'short', 'long', 'a'.repeat(501), mockSql as any);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Rules must be <= 500 characters');
  });

  it('should get room description', async () => {
    const mockSql = vi.fn().mockResolvedValueOnce([
      { roomId: 'room1', shortDesc: 'A fun place', longDesc: 'Detailed', rules: 'No spam', updatedAt: '2025-01-01' },
    ]);
    const desc = await getDescription('room1', mockSql as any);
    expect(desc).not.toBeNull();
    expect(desc?.shortDesc).toBe('A fun place');
  });

  it('should return null for non-existent description', async () => {
    const mockSql = vi.fn().mockResolvedValueOnce([]);
    const desc = await getDescription('room999', mockSql as any);
    expect(desc).toBeNull();
  });
});

describe('Room Search - Full-Text Search', () => {
  it('should search rooms by name', async () => {
    const mockSql = vi.fn()
      .mockResolvedValueOnce([{ roomId: 'room1', roomName: 'Gaming Lounge', ownerName: 'Alice' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const results = await searchRooms('gaming', mockSql as any);
    expect(results).toHaveLength(1);
    expect(results[0].matchType).toBe('name');
  });

  it('should search rooms by description', async () => {
    const mockSql = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ roomId: 'room2', roomName: 'Chill Room', ownerName: 'Bob' }])
      .mockResolvedValueOnce([]);
    const results = await searchRooms('chill', mockSql as any);
    expect(results).toHaveLength(1);
    expect(results[0].matchType).toBe('description');
  });

  it('should search rooms by tags', async () => {
    const mockSql = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ roomId: 'room3', roomName: 'RP Zone', ownerName: 'Charlie' }]);
    const results = await searchRooms('roleplay', mockSql as any);
    expect(results).toHaveLength(1);
    expect(results[0].matchType).toBe('tag');
  });

  it('should deduplicate results from multiple sources', async () => {
    const mockSql = vi.fn()
      .mockResolvedValueOnce([{ roomId: 'room1', roomName: 'Gaming Lounge', ownerName: 'Alice' }])
      .mockResolvedValueOnce([{ roomId: 'room1', roomName: 'Gaming Lounge', ownerName: 'Alice' }])
      .mockResolvedValueOnce([]);
    const results = await searchRooms('gaming', mockSql as any);
    expect(results).toHaveLength(1);
  });
});
