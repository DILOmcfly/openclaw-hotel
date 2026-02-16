// @ts-nocheck - TODO: fix type errors
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PoolClient } from 'pg';
import {
  submitRating,
  getRoomAverageRating,
  getRoomReviews,
  getAgentRating,
  deleteRating
} from '../services/rating.js';

// Mock SQL client
const mockSql = {
  query: vi.fn(),
  release: vi.fn(),
} as unknown as PoolClient;

describe('Rating Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('submitRating', () => {
    it('should create a new rating', async () => {
      const mockResult = {
        rows: [{
          id: 'rating-1',
          room_id: 'room-1',
          agent_id: 'agent-1',
          rating: 5,
          review_text: 'Great room!',
          created_at: new Date()
        }]
      };
      (mockSql.query as any).mockResolvedValueOnce(mockResult);

      const result = await submitRating('room-1', 'agent-1', 5, 'Great room!', mockSql);

      expect(result.rating).toBe(5);
      expect(result.reviewText).toBe('Great room!');
      expect(mockSql.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO room_ratings'),
        expect.arrayContaining(['room-1', 'agent-1', 5, 'Great room!'])
      );
    });

    it('should reject ratings outside 1-5 range', async () => {
      await expect(submitRating('room-1', 'agent-1', 0, undefined, mockSql))
        .rejects.toThrow('Rating must be between 1 and 5');
      
      await expect(submitRating('room-1', 'agent-1', 6, undefined, mockSql))
        .rejects.toThrow('Rating must be between 1 and 5');
    });

    it('should sanitize and truncate review text', async () => {
      const longText = 'a'.repeat(1000);
      const mockResult = {
        rows: [{
          id: 'rating-1',
          room_id: 'room-1',
          agent_id: 'agent-1',
          rating: 4,
          review_text: 'a'.repeat(500),
          created_at: new Date()
        }]
      };
      (mockSql.query as any).mockResolvedValueOnce(mockResult);

      await submitRating('room-1', 'agent-1', 4, longText, mockSql);

      expect(mockSql.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([expect.any(String), 'room-1', 'agent-1', 4, 'a'.repeat(500)])
      );
    });

    it('should handle empty review text', async () => {
      const mockResult = {
        rows: [{
          id: 'rating-1',
          room_id: 'room-1',
          agent_id: 'agent-1',
          rating: 3,
          review_text: null,
          created_at: new Date()
        }]
      };
      (mockSql.query as any).mockResolvedValueOnce(mockResult);

      const result = await submitRating('room-1', 'agent-1', 3, '', mockSql);

      expect(result.reviewText).toBeNull();
    });
  });

  describe('getRoomAverageRating', () => {
    it('should return average rating and count', async () => {
      const mockResult = {
        rows: [{
          avg_rating: '4.50',
          rating_count: '10'
        }]
      };
      (mockSql.query as any).mockResolvedValueOnce(mockResult);

      const result = await getRoomAverageRating('room-1', mockSql);

      expect(result.avgRating).toBe(4.5);
      expect(result.ratingCount).toBe(10);
      expect(result.roomId).toBe('room-1');
    });

    it('should handle rooms with no ratings', async () => {
      const mockResult = {
        rows: [{
          avg_rating: '0.00',
          rating_count: '0'
        }]
      };
      (mockSql.query as any).mockResolvedValueOnce(mockResult);

      const result = await getRoomAverageRating('room-1', mockSql);

      expect(result.avgRating).toBe(0);
      expect(result.ratingCount).toBe(0);
    });

    it('should throw error for non-existent room', async () => {
      const mockResult = { rows: [] };
      (mockSql.query as any).mockResolvedValueOnce(mockResult);

      await expect(getRoomAverageRating('nonexistent', mockSql))
        .rejects.toThrow('Room not found');
    });
  });

  describe('getRoomReviews', () => {
    it('should return reviews with agent names', async () => {
      const mockResult = {
        rows: [
          {
            id: 'rating-1',
            room_id: 'room-1',
            agent_id: 'agent-1',
            rating: 5,
            review_text: 'Amazing!',
            created_at: new Date(),
            agent_name: 'Alice'
          },
          {
            id: 'rating-2',
            room_id: 'room-1',
            agent_id: 'agent-2',
            rating: 4,
            review_text: 'Pretty good',
            created_at: new Date(),
            agent_name: 'Bob'
          }
        ]
      };
      (mockSql.query as any).mockResolvedValueOnce(mockResult);

      const result = await getRoomReviews('room-1', 20, mockSql);

      expect(result).toHaveLength(2);
      expect(result[0].agentName).toBe('Alice');
      expect(result[0].rating).toBe(5);
      expect(result[1].agentName).toBe('Bob');
    });

    it('should respect limit parameter', async () => {
      const mockResult = { rows: [] };
      (mockSql.query as any).mockResolvedValueOnce(mockResult);

      await getRoomReviews('room-1', 5, mockSql);

      expect(mockSql.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['room-1', 5])
      );
    });
  });

  describe('getAgentRating', () => {
    it('should return user rating for a room', async () => {
      const mockResult = {
        rows: [{
          id: 'rating-1',
          room_id: 'room-1',
          agent_id: 'agent-1',
          rating: 5,
          review_text: 'Love it!',
          created_at: new Date()
        }]
      };
      (mockSql.query as any).mockResolvedValueOnce(mockResult);

      const result = await getAgentRating('room-1', 'agent-1', mockSql);

      expect(result).not.toBeNull();
      expect(result?.rating).toBe(5);
      expect(result?.reviewText).toBe('Love it!');
    });

    it('should return null if no rating exists', async () => {
      const mockResult = { rows: [] };
      (mockSql.query as any).mockResolvedValueOnce(mockResult);

      const result = await getAgentRating('room-1', 'agent-1', mockSql);

      expect(result).toBeNull();
    });
  });

  describe('deleteRating', () => {
    it('should delete a rating by ID', async () => {
      const mockResult = { rowCount: 1 };
      (mockSql.query as any).mockResolvedValueOnce(mockResult);

      await deleteRating('rating-1', mockSql);

      expect(mockSql.query).toHaveBeenCalledWith(
        'DELETE FROM room_ratings WHERE id = $1',
        ['rating-1']
      );
    });
  });
});
