import { describe, it, expect, vi } from 'vitest';
import * as donationsService from '../services/donations.js';

/**
 * Donations System Unit Tests
 * All SQL calls are mocked - no real database connections
 */

describe('Donations System', () => {
  describe('createBox', () => {
    it('should create a donation box with default values', async () => {
      const mockSql = vi.fn().mockResolvedValue([{
        id: 1,
        roomId: 10,
        name: 'Donation Box',
        goal: 0,
        collected: 0,
        message: null,
        createdBy: 'agent1',
        active: true,
        createdAt: new Date(),
      }]);

      const box = await donationsService.createBox(10, 'agent1', 'Donation Box', 0, null, mockSql);
      expect(box.id).toBe(1);
      expect(box.name).toBe('Donation Box');
      expect(box.goal).toBe(0);
      expect(mockSql).toHaveBeenCalledTimes(1);
    });

    it('should create a donation box with custom goal and message', async () => {
      const mockSql = vi.fn().mockResolvedValue([{
        id: 2,
        roomId: 20,
        name: 'Charity Fund',
        goal: 1000,
        collected: 0,
        message: 'Help the cause!',
        createdBy: 'agent2',
        active: true,
        createdAt: new Date(),
      }]);

      const box = await donationsService.createBox(20, 'agent2', 'Charity Fund', 1000, 'Help the cause!', mockSql);
      expect(box.goal).toBe(1000);
      expect(box.message).toBe('Help the cause!');
    });
  });

  describe('donate', () => {
    it('should successfully process a valid donation', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ id: 1, active: true }]) // Box check
        .mockResolvedValueOnce([{ coins: 500 }]) // Balance check
        .mockResolvedValueOnce({ count: 1 }) // Deduct coins
        .mockResolvedValueOnce({ count: 1 }) // Update box
        .mockResolvedValueOnce([{ // Insert donation
          id: 1,
          boxId: 1,
          donorId: 'agent1',
          amount: 100,
          message: null,
          createdAt: new Date(),
        }]);

      const donation = await donationsService.donate(1, 'agent1', 100, null, mockSql);
      expect(donation.amount).toBe(100);
      expect(donation.donorId).toBe('agent1');
      expect(mockSql).toHaveBeenCalledTimes(5);
    });

    it('should reject donation with amount less than 1', async () => {
      const mockSql = vi.fn();
      
      await expect(donationsService.donate(1, 'agent1', 0, null, mockSql))
        .rejects.toThrow('Donation amount must be at least 1 coin');
      expect(mockSql).not.toHaveBeenCalled();
    });

    it('should reject donation to non-existent box', async () => {
      const mockSql = vi.fn().mockResolvedValue([]);

      await expect(donationsService.donate(999, 'agent1', 50, null, mockSql))
        .rejects.toThrow('Donation box not found');
    });

    it('should reject donation to closed box', async () => {
      const mockSql = vi.fn().mockResolvedValue([{ id: 1, active: false }]);

      await expect(donationsService.donate(1, 'agent1', 50, null, mockSql))
        .rejects.toThrow('Donation box is closed');
    });

    it('should reject donation with insufficient coins', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ id: 1, active: true }])
        .mockResolvedValueOnce([{ coins: 20 }]);

      await expect(donationsService.donate(1, 'agent1', 100, null, mockSql))
        .rejects.toThrow('Insufficient coins');
    });

    it('should accept donation with optional message', async () => {
      const mockSql = vi.fn()
        .mockResolvedValueOnce([{ id: 1, active: true }])
        .mockResolvedValueOnce([{ coins: 500 }])
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce([{
          id: 2,
          boxId: 1,
          donorId: 'agent1',
          amount: 50,
          message: 'Good luck!',
          createdAt: new Date(),
        }]);

      const donation = await donationsService.donate(1, 'agent1', 50, 'Good luck!', mockSql);
      expect(donation.message).toBe('Good luck!');
    });
  });

  describe('getBox', () => {
    it('should return box with progress percentage', async () => {
      const mockSql = vi.fn().mockResolvedValue([{
        id: 1,
        roomId: 10,
        name: 'Donation Box',
        goal: 1000,
        collected: 500,
        message: null,
        createdBy: 'agent1',
        active: true,
        createdAt: new Date(),
      }]);

      const box = await donationsService.getBox(1, mockSql);
      expect(box?.progressPercent).toBe(50);
    });

    it('should return 100% when goal is exceeded', async () => {
      const mockSql = vi.fn().mockResolvedValue([{
        id: 1,
        roomId: 10,
        name: 'Donation Box',
        goal: 100,
        collected: 150,
        message: null,
        createdBy: 'agent1',
        active: true,
        createdAt: new Date(),
      }]);

      const box = await donationsService.getBox(1, mockSql);
      expect(box?.progressPercent).toBe(100);
    });

    it('should return 0% when goal is 0', async () => {
      const mockSql = vi.fn().mockResolvedValue([{
        id: 1,
        roomId: 10,
        name: 'Donation Box',
        goal: 0,
        collected: 50,
        message: null,
        createdBy: 'agent1',
        active: true,
        createdAt: new Date(),
      }]);

      const box = await donationsService.getBox(1, mockSql);
      expect(box?.progressPercent).toBe(0);
    });

    it('should return null for non-existent box', async () => {
      const mockSql = vi.fn().mockResolvedValue([]);

      const box = await donationsService.getBox(999, mockSql);
      expect(box).toBeNull();
    });
  });

  describe('getTopDonors', () => {
    it('should return sorted list of top donors', async () => {
      const mockSql = vi.fn().mockResolvedValue([
        { donorId: 'agent1', totalAmount: '500', donationCount: '5' },
        { donorId: 'agent2', totalAmount: '300', donationCount: '3' },
        { donorId: 'agent3', totalAmount: '100', donationCount: '1' },
      ]);

      const donors = await donationsService.getTopDonors(1, 10, mockSql);
      expect(donors).toHaveLength(3);
      expect(donors[0].donorId).toBe('agent1');
      expect(donors[0].totalAmount).toBe('500');
    });

    it('should return empty array when no donations', async () => {
      const mockSql = vi.fn().mockResolvedValue([]);

      const donors = await donationsService.getTopDonors(1, 10, mockSql);
      expect(donors).toHaveLength(0);
    });
  });

  describe('getRoomBoxes', () => {
    it('should return all boxes for a room with progress', async () => {
      const mockSql = vi.fn().mockResolvedValue([
        {
          id: 1,
          roomId: 10,
          name: 'Box 1',
          goal: 100,
          collected: 50,
          message: null,
          createdBy: 'agent1',
          active: true,
          createdAt: new Date(),
        },
        {
          id: 2,
          roomId: 10,
          name: 'Box 2',
          goal: 200,
          collected: 100,
          message: null,
          createdBy: 'agent2',
          active: false,
          createdAt: new Date(),
        },
      ]);

      const boxes = await donationsService.getRoomBoxes(10, mockSql);
      expect(boxes).toHaveLength(2);
      expect(boxes[0].progressPercent).toBe(50);
      expect(boxes[1].progressPercent).toBe(50);
    });

    it('should return empty array for room with no boxes', async () => {
      const mockSql = vi.fn().mockResolvedValue([]);

      const boxes = await donationsService.getRoomBoxes(10, mockSql);
      expect(boxes).toHaveLength(0);
    });
  });

  describe('closeBox', () => {
    it('should close box when owner is correct', async () => {
      const mockSql = vi.fn().mockResolvedValue({ count: 1 });

      await expect(donationsService.closeBox(1, 'agent1', mockSql)).resolves.not.toThrow();
      expect(mockSql).toHaveBeenCalledTimes(1);
    });

    it('should reject close when not owner', async () => {
      const mockSql = vi.fn().mockResolvedValue({ count: 0 });

      await expect(donationsService.closeBox(1, 'agent2', mockSql))
        .rejects.toThrow('Box not found or you are not the owner');
    });
  });

  describe('getAgentDonations', () => {
    it('should return donation history for agent', async () => {
      const mockSql = vi.fn().mockResolvedValue([
        {
          id: 1,
          boxId: 1,
          donorId: 'agent1',
          amount: 100,
          message: 'First donation',
          createdAt: new Date(),
        },
        {
          id: 2,
          boxId: 2,
          donorId: 'agent1',
          amount: 50,
          message: null,
          createdAt: new Date(),
        },
      ]);

      const donations = await donationsService.getAgentDonations('agent1', mockSql);
      expect(donations).toHaveLength(2);
      expect(donations[0].amount).toBe(100);
    });

    it('should return empty array for agent with no donations', async () => {
      const mockSql = vi.fn().mockResolvedValue([]);

      const donations = await donationsService.getAgentDonations('agent1', mockSql);
      expect(donations).toHaveLength(0);
    });
  });

  describe('getGlobalStats', () => {
    it('should return global donation statistics', async () => {
      const mockSql = vi.fn().mockResolvedValue([{
        totalDonated: '5000',
        totalBoxes: '10',
        activeBoxes: '7',
      }]);

      const stats = await donationsService.getGlobalStats(mockSql);
      expect(stats.totalDonated).toBe('5000');
      expect(stats.totalBoxes).toBe('10');
      expect(stats.activeBoxes).toBe('7');
    });

    it('should return zero stats when no boxes exist', async () => {
      const mockSql = vi.fn().mockResolvedValue([{
        totalDonated: '0',
        totalBoxes: '0',
        activeBoxes: '0',
      }]);

      const stats = await donationsService.getGlobalStats(mockSql);
      expect(stats.totalDonated).toBe('0');
      expect(stats.totalBoxes).toBe('0');
    });
  });
});
