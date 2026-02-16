import { describe, it, expect, vi } from 'vitest';
import type { Sql } from 'postgres';
import {
  createPoll,
  vote,
  getPollResults,
  getActivePolls,
  closePoll,
} from '../services/polls.js';

/**
 * Polls System Unit Tests
 * All tests use mocked SQL - no database required
 */

describe('Polls System - Validation & Logic', () => {
  it('should validate question length (max 200 chars)', async () => {
    const mockSql = vi.fn() as unknown as Sql;
    const longQuestion = 'a'.repeat(201);
    const validQuestion = 'a'.repeat(200);

    await expect(
      createPoll('room1', 'agent1', longQuestion, ['A', 'B'], 60, mockSql)
    ).rejects.toThrow('Question must be 200 characters or less');

    // Valid question should pass validation
    mockSql.mockResolvedValueOnce([{
      id: 'poll1',
      roomId: 'room1',
      creatorId: 'agent1',
      question: validQuestion,
      options: ['A', 'B'],
      expiresAt: new Date(),
      closed: false,
      createdAt: new Date(),
    }]);

    await expect(
      createPoll('room1', 'agent1', validQuestion, ['A', 'B'], 60, mockSql)
    ).resolves.toBeDefined();
  });

  it('should require non-empty question', async () => {
    const mockSql = vi.fn() as unknown as Sql;

    await expect(
      createPoll('room1', 'agent1', '', ['A', 'B'], 60, mockSql)
    ).rejects.toThrow('Question is required');

    await expect(
      createPoll('room1', 'agent1', '   ', ['A', 'B'], 60, mockSql)
    ).rejects.toThrow('Question is required');
  });

  it('should enforce minimum 2 options', async () => {
    const mockSql = vi.fn() as unknown as Sql;

    await expect(
      createPoll('room1', 'agent1', 'Question?', ['A'], 60, mockSql)
    ).rejects.toThrow('At least 2 options are required');

    await expect(
      createPoll('room1', 'agent1', 'Question?', [], 60, mockSql)
    ).rejects.toThrow('At least 2 options are required');
  });

  it('should enforce maximum 6 options', async () => {
    const mockSql = vi.fn() as unknown as Sql;
    const tooManyOptions = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

    await expect(
      createPoll('room1', 'agent1', 'Question?', tooManyOptions, 60, mockSql)
    ).rejects.toThrow('Maximum 6 options allowed');
  });

  it('should reject empty option text', async () => {
    const mockSql = vi.fn() as unknown as Sql;

    await expect(
      createPoll('room1', 'agent1', 'Question?', ['A', ''], 60, mockSql)
    ).rejects.toThrow('All options must have text');

    await expect(
      createPoll('room1', 'agent1', 'Question?', ['A', '  '], 60, mockSql)
    ).rejects.toThrow('All options must have text');
  });

  it('should create poll with valid inputs', async () => {
    const mockSql = vi.fn() as unknown as Sql;
    const now = new Date();

    mockSql.mockResolvedValueOnce([{
      id: 'poll-123',
      roomId: 'room1',
      creatorId: 'agent1',
      question: 'Favorite color?',
      options: ['Red', 'Blue', 'Green'],
      expiresAt: new Date(now.getTime() + 60000),
      closed: false,
      createdAt: now,
    }]);

    const poll = await createPoll(
      'room1',
      'agent1',
      'Favorite color?',
      ['Red', 'Blue', 'Green'],
      60,
      mockSql
    );

    expect(poll).toBeDefined();
    expect(poll.id).toBe('poll-123');
    expect(poll.question).toBe('Favorite color?');
    expect(poll.options).toEqual(['Red', 'Blue', 'Green']);
  });

  it('should prevent duplicate votes from same agent', async () => {
    const mockSql = vi.fn() as unknown as Sql;

    // First call: get poll
    mockSql.mockResolvedValueOnce([{
      id: 'poll1',
      options: ['A', 'B'],
      closed: false,
      expiresAt: new Date(Date.now() + 10000),
    }]);

    // Second call: check existing vote (found)
    mockSql.mockResolvedValueOnce([{ poll_id: 'poll1' }]);

    await expect(
      vote('poll1', 'agent1', 0, mockSql)
    ).rejects.toThrow('You have already voted on this poll');
  });

  it('should allow voting on valid poll', async () => {
    const mockSql = vi.fn() as unknown as Sql;

    // First call: get poll
    mockSql.mockResolvedValueOnce([{
      id: 'poll1',
      options: ['A', 'B', 'C'],
      closed: false,
      expiresAt: new Date(Date.now() + 10000),
    }]);

    // Second call: check existing vote (none found)
    mockSql.mockResolvedValueOnce([]);

    // Third call: insert vote
    mockSql.mockResolvedValueOnce([]);

    await expect(
      vote('poll1', 'agent1', 1, mockSql)
    ).resolves.toBeUndefined();
  });

  it('should reject vote on closed poll', async () => {
    const mockSql = vi.fn() as unknown as Sql;

    mockSql.mockResolvedValueOnce([{
      id: 'poll1',
      options: ['A', 'B'],
      closed: true,
      expiresAt: null,
    }]);

    await expect(
      vote('poll1', 'agent1', 0, mockSql)
    ).rejects.toThrow('Poll is closed');
  });

  it('should reject vote on expired poll', async () => {
    const mockSql = vi.fn() as unknown as Sql;

    mockSql.mockResolvedValueOnce([{
      id: 'poll1',
      options: ['A', 'B'],
      closed: false,
      expiresAt: new Date(Date.now() - 1000), // expired
    }]);

    await expect(
      vote('poll1', 'agent1', 0, mockSql)
    ).rejects.toThrow('Poll has expired');
  });

  it('should reject invalid option index', async () => {
    const mockSql = vi.fn() as unknown as Sql;

    mockSql.mockResolvedValueOnce([{
      id: 'poll1',
      options: ['A', 'B'],
      closed: false,
      expiresAt: null,
    }]);

    await expect(
      vote('poll1', 'agent1', 5, mockSql)
    ).rejects.toThrow('Invalid option index');

    mockSql.mockResolvedValueOnce([{
      id: 'poll1',
      options: ['A', 'B'],
      closed: false,
      expiresAt: null,
    }]);

    await expect(
      vote('poll1', 'agent1', -1, mockSql)
    ).rejects.toThrow('Invalid option index');
  });

  it('should calculate poll results correctly', async () => {
    const mockSql = vi.fn() as unknown as Sql;

    // First call: get poll
    mockSql.mockResolvedValueOnce([{
      id: 'poll1',
      question: 'Best framework?',
      options: ['React', 'Vue', 'Angular'],
      closed: false,
      expiresAt: null,
    }]);

    // Second call: get vote counts
    mockSql.mockResolvedValueOnce([
      { option_index: 0, count: 5 },
      { option_index: 1, count: 3 },
      { option_index: 2, count: 1 },
    ]);

    const results = await getPollResults('poll1', mockSql);

    expect(results.options).toHaveLength(3);
    expect(results.options[0].votes).toBe(5);
    expect(results.options[1].votes).toBe(3);
    expect(results.options[2].votes).toBe(1);
    expect(results.totalVotes).toBe(9);
    expect(results.winner).toBe(0); // React wins
  });

  it('should handle tie in poll results (no winner)', async () => {
    const mockSql = vi.fn() as unknown as Sql;

    mockSql.mockResolvedValueOnce([{
      id: 'poll1',
      question: 'Tied poll',
      options: ['A', 'B'],
      closed: false,
      expiresAt: null,
    }]);

    // Tied votes
    mockSql.mockResolvedValueOnce([
      { option_index: 0, count: 3 },
      { option_index: 1, count: 3 },
    ]);

    const results = await getPollResults('poll1', mockSql);

    expect(results.totalVotes).toBe(6);
    expect(results.winner).toBeNull(); // No clear winner
  });

  it('should handle poll with no votes', async () => {
    const mockSql = vi.fn() as unknown as Sql;

    mockSql.mockResolvedValueOnce([{
      id: 'poll1',
      question: 'No votes poll',
      options: ['A', 'B', 'C'],
      closed: false,
      expiresAt: null,
    }]);

    mockSql.mockResolvedValueOnce([]); // no votes

    const results = await getPollResults('poll1', mockSql);

    expect(results.totalVotes).toBe(0);
    expect(results.winner).toBeNull();
    expect(results.options.every(opt => opt.votes === 0)).toBe(true);
  });

  it('should only allow creator to close poll', async () => {
    const mockSql = vi.fn() as unknown as Sql;

    mockSql.mockResolvedValueOnce([{
      id: 'poll1',
      creatorId: 'creator-123',
      closed: false,
    }]);

    await expect(
      closePoll('poll1', 'other-agent', mockSql)
    ).rejects.toThrow('Only the poll creator can close it');
  });

  it('should allow creator to close poll', async () => {
    const mockSql = vi.fn() as unknown as Sql;

    mockSql.mockResolvedValueOnce([{
      id: 'poll1',
      creatorId: 'creator-123',
      closed: false,
    }]);

    mockSql.mockResolvedValueOnce([]); // update

    await expect(
      closePoll('poll1', 'creator-123', mockSql)
    ).resolves.toBeUndefined();
  });

  it('should reject closing already closed poll', async () => {
    const mockSql = vi.fn() as unknown as Sql;

    mockSql.mockResolvedValueOnce([{
      id: 'poll1',
      creatorId: 'creator-123',
      closed: true,
    }]);

    await expect(
      closePoll('poll1', 'creator-123', mockSql)
    ).rejects.toThrow('Poll is already closed');
  });

  it('should filter active polls correctly', async () => {
    const mockSql = vi.fn() as unknown as Sql;
    const now = new Date();

    mockSql.mockResolvedValueOnce([
      {
        id: 'poll1',
        roomId: 'room1',
        creatorId: 'agent1',
        question: 'Active poll',
        options: ['A', 'B'],
        expiresAt: new Date(now.getTime() + 10000),
        closed: false,
        createdAt: now,
      },
    ]);

    const polls = await getActivePolls('room1', mockSql);

    expect(polls).toHaveLength(1);
    expect(polls[0].question).toBe('Active poll');
  });
});
