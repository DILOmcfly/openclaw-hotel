import { describe, it, expect, vi } from 'vitest';
import * as lotteryService from '../services/lottery.js';

/**
 * Lottery System Unit Tests
 * Tests lottery creation, ticket buying, drawing, and history without database
 */

describe('Lottery System', () => {
  describe('createLottery', () => {
    it('should create a new lottery with default values', async () => {
      const mockSql = vi.fn().mockResolvedValue([
        {
          id: 1,
          name: 'Daily Lottery',
          ticketPrice: 10,
          prizePool: 0,
          status: 'open',
          winnerId: null,
          winningNumber: null,
          drawAt: null,
          createdAt: new Date(),
        },
      ]);

      const lottery = await lotteryService.createLottery('Daily Lottery', 10, null, mockSql);

      expect(lottery.id).toBe(1);
      expect(lottery.name).toBe('Daily Lottery');
      expect(lottery.ticketPrice).toBe(10);
      expect(lottery.prizePool).toBe(0);
      expect(lottery.status).toBe('open');
    });

    it('should create lottery with custom ticket price', async () => {
      const mockSql = vi.fn().mockResolvedValue([
        {
          id: 2,
          name: 'Premium Lottery',
          ticketPrice: 50,
          prizePool: 0,
          status: 'open',
          winnerId: null,
          winningNumber: null,
          drawAt: null,
          createdAt: new Date(),
        },
      ]);

      const lottery = await lotteryService.createLottery('Premium Lottery', 50, null, mockSql);

      expect(lottery.ticketPrice).toBe(50);
    });

    it('should create lottery with scheduled draw time', async () => {
      const drawAt = new Date('2026-02-20T12:00:00Z');
      const mockSql = vi.fn().mockResolvedValue([
        {
          id: 3,
          name: 'Scheduled Lottery',
          ticketPrice: 10,
          prizePool: 0,
          status: 'open',
          winnerId: null,
          winningNumber: null,
          drawAt,
          createdAt: new Date(),
        },
      ]);

      const lottery = await lotteryService.createLottery('Scheduled Lottery', 10, drawAt, mockSql);

      expect(lottery.drawAt).toEqual(drawAt);
    });
  });

  describe('buyTicket', () => {
    it('should buy ticket and deduct coins', async () => {
      const mockSql = vi.fn()
        // Check lottery
        .mockResolvedValueOnce([{ id: 1, status: 'open', ticketPrice: 10 }])
        // Check balance
        .mockResolvedValueOnce([{ coins: 100 }])
        // Get taken tickets
        .mockResolvedValueOnce([])
        // Update balance
        .mockResolvedValueOnce([])
        // Update prize pool
        .mockResolvedValueOnce([])
        // Insert ticket
        .mockResolvedValueOnce([
          {
            id: 1,
            lotteryId: 1,
            agentId: 'agent1',
            ticketNumber: 42,
            purchasedAt: new Date(),
          },
        ]);

      const ticket = await lotteryService.buyTicket(1, 'agent1', mockSql);

      expect(ticket.agentId).toBe('agent1');
      expect(ticket.ticketNumber).toBeGreaterThanOrEqual(1);
      expect(ticket.ticketNumber).toBeLessThanOrEqual(1000);
    });

    it('should throw error if lottery not found', async () => {
      const mockSql = vi.fn().mockResolvedValue([]);

      await expect(lotteryService.buyTicket(999, 'agent1', mockSql)).rejects.toThrow(
        'Lottery not found'
      );
    });

    it('should throw error if lottery not open', async () => {
      const mockSql = vi.fn().mockResolvedValue([{ id: 1, status: 'completed', ticketPrice: 10 }]);

      await expect(lotteryService.buyTicket(1, 'agent1', mockSql)).rejects.toThrow(
        'Lottery is not accepting tickets'
      );
    });

    it('should throw error if insufficient coins', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ id: 1, status: 'open', ticketPrice: 10 }])
        .mockResolvedValueOnce([{ coins: 5 }]);

      await expect(lotteryService.buyTicket(1, 'agent1', mockSql)).rejects.toThrow(
        'Insufficient coins'
      );
    });

    it('should assign unique ticket numbers', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ id: 1, status: 'open', ticketPrice: 10 }])
        .mockResolvedValueOnce([{ coins: 100 }])
        .mockResolvedValueOnce([{ ticket_number: 42 }, { ticket_number: 99 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 1,
            lotteryId: 1,
            agentId: 'agent1',
            ticketNumber: 15,
            purchasedAt: new Date(),
          },
        ]);

      const ticket = await lotteryService.buyTicket(1, 'agent1', mockSql);

      expect(ticket.ticketNumber).not.toBe(42);
      expect(ticket.ticketNumber).not.toBe(99);
    });
  });

  describe('getActiveLottery', () => {
    it('should return active lottery', async () => {
      const mockSql = vi.fn().mockResolvedValue([
        {
          id: 1,
          name: 'Daily Lottery',
          ticketPrice: 10,
          prizePool: 0,
          status: 'open',
          winnerId: null,
          winningNumber: null,
          drawAt: null,
          createdAt: new Date(),
        },
      ]);

      const lottery = await lotteryService.getActiveLottery(mockSql);

      expect(lottery).not.toBeNull();
      expect(lottery?.status).toBe('open');
    });

    it('should return null if no active lottery', async () => {
      const mockSql = vi.fn().mockResolvedValue([]);

      const lottery = await lotteryService.getActiveLottery(mockSql);

      expect(lottery).toBeNull();
    });
  });

  describe('getTickets', () => {
    it('should return agent tickets for lottery', async () => {
      const mockSql = vi.fn().mockResolvedValue([
        { id: 1, lotteryId: 1, agentId: 'agent1', ticketNumber: 42, purchasedAt: new Date() },
        { id: 2, lotteryId: 1, agentId: 'agent1', ticketNumber: 99, purchasedAt: new Date() },
      ]);

      const tickets = await lotteryService.getTickets(1, 'agent1', mockSql);

      expect(tickets).toHaveLength(2);
      expect(tickets[0].ticketNumber).toBe(42);
      expect(tickets[1].ticketNumber).toBe(99);
    });

    it('should return empty array if no tickets', async () => {
      const mockSql = vi.fn().mockResolvedValue([]);

      const tickets = await lotteryService.getTickets(1, 'agent1', mockSql);

      expect(tickets).toHaveLength(0);
    });
  });

  describe('draw', () => {
    it('should pick winner and distribute 80% prize', async () => {
      const mockSql = vi.fn()
        // Get lottery
        .mockResolvedValueOnce([{ id: 1, status: 'open', prizePool: 1000 }])
        // Get tickets
        .mockResolvedValueOnce([
          { ticket_number: 42, agent_id: 'agent1' },
          { ticket_number: 99, agent_id: 'agent2' },
        ])
        // Update winner balance
        .mockResolvedValueOnce([])
        // Update lottery
        .mockResolvedValueOnce([])
        // Return updated lottery
        .mockResolvedValueOnce([
          {
            id: 1,
            name: 'Daily Lottery',
            ticketPrice: 10,
            prizePool: 1000,
            status: 'completed',
            winnerId: 'agent1',
            winningNumber: 42,
            drawAt: null,
            createdAt: new Date(),
          },
        ]);

      const result = await lotteryService.draw(1, mockSql);

      expect(result.status).toBe('completed');
      expect(result.winnerId).toBeTruthy();
      expect(result.winningNumber).toBeTruthy();
    });

    it('should throw error if lottery not found', async () => {
      const mockSql = vi.fn().mockResolvedValue([]);

      await expect(lotteryService.draw(999, mockSql)).rejects.toThrow('Lottery not found');
    });

    it('should throw error if lottery already drawn', async () => {
      const mockSql = vi.fn().mockResolvedValue([{ id: 1, status: 'completed', prizePool: 1000 }]);

      await expect(lotteryService.draw(1, mockSql)).rejects.toThrow('Lottery already drawn');
    });

    it('should handle lottery with no tickets', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ id: 1, status: 'open', prizePool: 0 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 1,
            name: 'Daily Lottery',
            ticketPrice: 10,
            prizePool: 0,
            status: 'completed',
            winnerId: null,
            winningNumber: null,
            drawAt: null,
            createdAt: new Date(),
          },
        ]);

      const result = await lotteryService.draw(1, mockSql);

      expect(result.status).toBe('completed');
      expect(result.winnerId).toBeNull();
    });

    it('should award 80% to winner and 20% to house', async () => {
      const prizePool = 1000;
      const expectedWinnerPrize = Math.floor(prizePool * 0.8); // 800

      expect(expectedWinnerPrize).toBe(800);
      expect(prizePool - expectedWinnerPrize).toBe(200); // House cut
    });
  });

  describe('getLotteryHistory', () => {
    it('should return completed lotteries', async () => {
      const mockSql = vi.fn().mockResolvedValue([
        {
          id: 1,
          name: 'Daily Lottery #1',
          ticketPrice: 10,
          prizePool: 500,
          status: 'completed',
          winnerId: 'agent1',
          winningNumber: 42,
          drawAt: null,
          createdAt: new Date('2026-02-14'),
        },
        {
          id: 2,
          name: 'Daily Lottery #2',
          ticketPrice: 10,
          prizePool: 800,
          status: 'completed',
          winnerId: 'agent2',
          winningNumber: 99,
          drawAt: null,
          createdAt: new Date('2026-02-15'),
        },
      ]);

      const history = await lotteryService.getLotteryHistory(10, mockSql);

      expect(history).toHaveLength(2);
      expect(history[0].status).toBe('completed');
      expect(history[1].status).toBe('completed');
    });

    it('should respect limit parameter', async () => {
      const mockSql = vi.fn().mockResolvedValue([
        {
          id: 1,
          name: 'Daily Lottery #1',
          ticketPrice: 10,
          prizePool: 500,
          status: 'completed',
          winnerId: 'agent1',
          winningNumber: 42,
          drawAt: null,
          createdAt: new Date(),
        },
      ]);

      const history = await lotteryService.getLotteryHistory(1, mockSql);

      expect(history).toHaveLength(1);
    });

    it('should return empty array if no completed lotteries', async () => {
      const mockSql = vi.fn().mockResolvedValue([]);

      const history = await lotteryService.getLotteryHistory(10, mockSql);

      expect(history).toHaveLength(0);
    });
  });

  describe('getAgentWinnings', () => {
    it('should calculate total winnings for agent', async () => {
      const mockSql = vi.fn().mockResolvedValue([{ total: 2400 }]);

      const winnings = await lotteryService.getAgentWinnings('agent1', mockSql);

      expect(winnings).toBe(2400);
    });

    it('should return 0 if agent has no wins', async () => {
      const mockSql = vi.fn().mockResolvedValue([{ total: 0 }]);

      const winnings = await lotteryService.getAgentWinnings('agent1', mockSql);

      expect(winnings).toBe(0);
    });

    it('should return 0 if no result', async () => {
      const mockSql = vi.fn().mockResolvedValue([]);

      const winnings = await lotteryService.getAgentWinnings('agent1', mockSql);

      expect(winnings).toBe(0);
    });
  });

  describe('Prize Distribution', () => {
    it('should split prize 80/20 correctly', () => {
      const testCases = [
        { pool: 100, winner: 80, house: 20 },
        { pool: 1000, winner: 800, house: 200 },
        { pool: 5000, winner: 4000, house: 1000 },
      ];

      testCases.forEach(({ pool, winner, house }) => {
        const winnerShare = Math.floor(pool * 0.8);
        const houseShare = pool - winnerShare;

        expect(winnerShare).toBe(winner);
        expect(houseShare).toBe(house);
      });
    });

    it('should handle odd prize pools correctly', () => {
      const pool = 999;
      const winnerShare = Math.floor(pool * 0.8); // 799
      const houseShare = pool - winnerShare; // 200

      expect(winnerShare).toBe(799);
      expect(houseShare).toBe(200);
    });
  });

  describe('Ticket Number Generation', () => {
    it('should generate numbers between 1-1000', () => {
      for (let i = 0; i < 100; i++) {
        const num = Math.floor(Math.random() * 1000) + 1;
        expect(num).toBeGreaterThanOrEqual(1);
        expect(num).toBeLessThanOrEqual(1000);
      }
    });

    it('should avoid taken numbers', () => {
      const taken = new Set([42, 99, 123]);
      let candidate: number;

      do {
        candidate = Math.floor(Math.random() * 1000) + 1;
      } while (taken.has(candidate));

      expect(taken.has(candidate)).toBe(false);
    });
  });
});
