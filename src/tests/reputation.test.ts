import { describe, it, expect, vi } from 'vitest';
import * as reputationService from '../services/reputation.js';

/**
 * Reputation System Unit Tests
 * All SQL operations are mocked - no database connection required
 */

describe('Reputation Service - Trust Levels', () => {
  it('should calculate untrusted level for very negative reputation', () => {
    const trustLevel = reputationService.calculateTrustLevel(-100);
    expect(trustLevel.level).toBe('untrusted');
    expect(trustLevel.score).toBe(0);
    expect(trustLevel.minRequired).toBe(-1000);
  });

  it('should calculate new level for zero reputation', () => {
    const trustLevel = reputationService.calculateTrustLevel(0);
    expect(trustLevel.level).toBe('new');
    expect(trustLevel.score).toBeGreaterThanOrEqual(0);
    expect(trustLevel.score).toBeLessThanOrEqual(100);
  });

  it('should calculate basic level for low positive reputation', () => {
    const trustLevel = reputationService.calculateTrustLevel(25);
    expect(trustLevel.level).toBe('basic');
    expect(trustLevel.minRequired).toBe(1);
    expect(trustLevel.maxRequired).toBe(50);
  });

  it('should calculate trusted level for medium reputation', () => {
    const trustLevel = reputationService.calculateTrustLevel(100);
    expect(trustLevel.level).toBe('trusted');
    expect(trustLevel.minRequired).toBe(51);
  });

  it('should calculate verified level for high reputation', () => {
    const trustLevel = reputationService.calculateTrustLevel(200);
    expect(trustLevel.level).toBe('verified');
    expect(trustLevel.minRequired).toBe(151);
    expect(trustLevel.maxRequired).toBe(300);
  });

  it('should calculate elite level for very high reputation', () => {
    const trustLevel = reputationService.calculateTrustLevel(500);
    expect(trustLevel.level).toBe('elite');
    expect(trustLevel.minRequired).toBe(301);
    expect(trustLevel.maxRequired).toBe(10000);
  });

  it('should return score between 0-100 for all reputation values', () => {
    const scores = [-200, -50, 0, 50, 150, 300, 500];
    scores.forEach(rep => {
      const trustLevel = reputationService.calculateTrustLevel(rep);
      expect(trustLevel.score).toBeGreaterThanOrEqual(0);
      expect(trustLevel.score).toBeLessThanOrEqual(100);
    });
  });
});

describe('Reputation Service - Trade Permissions', () => {
  it('should allow trades for agents with basic level (rep >= 1)', () => {
    expect(reputationService.canTrade(1, 0)).toBe(true);
    expect(reputationService.canTrade(10, 500)).toBe(true);
    expect(reputationService.canTrade(25, 900)).toBe(true);
  });

  it('should block trades for agents with negative reputation', () => {
    expect(reputationService.canTrade(0, 0)).toBe(false);
    expect(reputationService.canTrade(-10, 0)).toBe(false);
    expect(reputationService.canTrade(-50, 100)).toBe(false);
  });

  it('should block high-value trades (>= 1000) for low reputation', () => {
    expect(reputationService.canTrade(25, 1000)).toBe(false);
    expect(reputationService.canTrade(49, 2000)).toBe(false);
  });

  it('should allow high-value trades for basic+ level (rep >= 50)', () => {
    expect(reputationService.canTrade(50, 1000)).toBe(true);
    expect(reputationService.canTrade(75, 1500)).toBe(true);
  });

  it('should block very high-value trades (>= 5000) for mid reputation', () => {
    expect(reputationService.canTrade(100, 5000)).toBe(false);
    expect(reputationService.canTrade(149, 7500)).toBe(false);
  });

  it('should allow very high-value trades for trusted+ level (rep >= 150)', () => {
    expect(reputationService.canTrade(150, 5000)).toBe(true);
    expect(reputationService.canTrade(200, 10000)).toBe(true);
  });
});

describe('Reputation Service - Database Operations (Mocked)', () => {
  it('should add upvote event and return correct points', async () => {
    const mockSql = vi.fn()
      .mockResolvedValueOnce([{
        id: 1,
        agentId: 'agent123',
        givenBy: 'agent456',
        eventType: 'upvote',
        points: 5,
        reason: null,
        createdAt: new Date(),
      }])
      .mockResolvedValueOnce([]);

    const event = await reputationService.addEvent('agent123', 'upvote', 'agent456', null, mockSql);
    expect(event.points).toBe(5);
    expect(event.eventType).toBe('upvote');
    expect(mockSql).toHaveBeenCalledTimes(2); // insert event + update aggregate
  });

  it('should add trade_success event with correct points', async () => {
    const mockSql = vi.fn()
      .mockResolvedValueOnce([{
        id: 2,
        agentId: 'agent789',
        givenBy: null,
        eventType: 'trade_success',
        points: 10,
        reason: 'Completed trade #123',
        createdAt: new Date(),
      }])
      .mockResolvedValueOnce([]);

    const event = await reputationService.addEvent('agent789', 'trade_success', null, 'Completed trade #123', mockSql);
    expect(event.points).toBe(10);
    expect(event.reason).toBe('Completed trade #123');
  });

  it('should add negative event (scam) with correct points', async () => {
    const mockSql = vi.fn()
      .mockResolvedValueOnce([{
        id: 3,
        agentId: 'badagent',
        givenBy: 'reporter',
        eventType: 'scam',
        points: -50,
        reason: 'Scammed in trade',
        createdAt: new Date(),
      }])
      .mockResolvedValueOnce([]);

    const event = await reputationService.addEvent('badagent', 'scam', 'reporter', 'Scammed in trade', mockSql);
    expect(event.points).toBe(-50);
    expect(event.eventType).toBe('scam');
  });

  it('should get reputation for existing agent', async () => {
    const mockSql = vi.fn().mockResolvedValue([{
      agentId: 'agent123',
      reputation: 75,
      positiveCount: 10,
      negativeCount: 2,
      updatedAt: new Date(),
    }]);

    const rep = await reputationService.getReputation('agent123', mockSql);
    expect(rep.reputation).toBe(75);
    expect(rep.positiveCount).toBe(10);
    expect(rep.negativeCount).toBe(2);
  });

  it('should return default reputation for new agent', async () => {
    const mockSql = vi.fn().mockResolvedValue([]);

    const rep = await reputationService.getReputation('newagent', mockSql);
    expect(rep.reputation).toBe(0);
    expect(rep.positiveCount).toBe(0);
    expect(rep.negativeCount).toBe(0);
    expect(rep.agentId).toBe('newagent');
  });

  it('should get reputation history with pagination', async () => {
    const mockSql = vi.fn().mockResolvedValue([
      { id: 5, agentId: 'agent123', eventType: 'upvote', points: 5, createdAt: new Date() },
      { id: 4, agentId: 'agent123', eventType: 'helpful', points: 15, createdAt: new Date() },
    ]);

    const history = await reputationService.getReputationHistory('agent123', 20, 0, mockSql);
    expect(history.length).toBe(2);
    expect(history[0].id).toBe(5);
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it('should get leaderboard sorted by reputation', async () => {
    const mockSql = vi.fn().mockResolvedValue([
      { agentId: 'top1', reputation: 500, positiveCount: 50, negativeCount: 0, updatedAt: new Date() },
      { agentId: 'top2', reputation: 350, positiveCount: 40, negativeCount: 5, updatedAt: new Date() },
      { agentId: 'top3', reputation: 200, positiveCount: 25, negativeCount: 3, updatedAt: new Date() },
    ]);

    const leaderboard = await reputationService.getLeaderboard(10, mockSql);
    expect(leaderboard.length).toBe(3);
    expect(leaderboard[0].agentId).toBe('top1');
    expect(leaderboard[0].reputation).toBeGreaterThan(leaderboard[1].reputation);
  });
});

describe('Reputation Service - Edge Cases', () => {
  it('should handle exactly at threshold boundaries', () => {
    expect(reputationService.calculateTrustLevel(1).level).toBe('basic');
    expect(reputationService.calculateTrustLevel(50).level).toBe('basic');
    expect(reputationService.calculateTrustLevel(51).level).toBe('trusted');
    expect(reputationService.calculateTrustLevel(150).level).toBe('trusted');
    expect(reputationService.calculateTrustLevel(151).level).toBe('verified');
  });

  it('should handle trade value exactly at thresholds', () => {
    expect(reputationService.canTrade(49, 999)).toBe(true);
    expect(reputationService.canTrade(49, 1000)).toBe(false);
    expect(reputationService.canTrade(149, 4999)).toBe(true);
    expect(reputationService.canTrade(149, 5000)).toBe(false);
  });
});
