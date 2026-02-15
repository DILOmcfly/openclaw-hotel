import { describe, it, expect, vi } from 'vitest';
import * as notificationsService from '../services/notifications.js';
import type { NotificationType } from '../services/notifications.js';

/**
 * Notification System Unit Tests
 * All SQL queries are mocked - NO real database connections
 */

describe('Notifications Service - Mocked SQL', () => {
  
  it('should create a single notification', async () => {
    const mockSql = vi.fn().mockResolvedValue([{
      id: 1,
      agentId: 'agent-123',
      type: 'friend',
      title: 'New Friend Request',
      body: 'Agent-456 wants to be your friend',
      read: false,
      actionUrl: '/friends',
      createdAt: new Date('2024-02-15T10:00:00Z'),
    }]);

    const result = await notificationsService.create(
      'agent-123',
      'friend',
      'New Friend Request',
      'Agent-456 wants to be your friend',
      '/friends',
      mockSql
    );

    expect(result.id).toBe(1);
    expect(result.agentId).toBe('agent-123');
    expect(result.type).toBe('friend');
    expect(result.title).toBe('New Friend Request');
    expect(result.read).toBe(false);
  });

  it('should create bulk notifications for multiple agents', async () => {
    const mockSql = vi.fn().mockResolvedValue([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);

    const count = await notificationsService.createBulk(
      ['agent-1', 'agent-2', 'agent-3'],
      'system',
      'Server Maintenance',
      'Server will restart in 10 minutes',
      null,
      mockSql
    );

    expect(count).toBe(3);
  });

  it('should return 0 when creating bulk with empty agent list', async () => {
    const mockSql = vi.fn();

    const count = await notificationsService.createBulk(
      [],
      'system',
      'Test',
      'Test',
      null,
      mockSql
    );

    expect(count).toBe(0);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('should get unread notifications for an agent', async () => {
    const mockSql = vi.fn().mockResolvedValue([
      {
        id: 1,
        agentId: 'agent-123',
        type: 'trade',
        title: 'Trade Offer',
        body: 'New trade offer received',
        read: false,
        actionUrl: '/trades/1',
        createdAt: new Date('2024-02-15T12:00:00Z'),
      },
      {
        id: 2,
        agentId: 'agent-123',
        type: 'achievement',
        title: 'Achievement Unlocked',
        body: 'You unlocked "First Trade"',
        read: false,
        actionUrl: '/achievements',
        createdAt: new Date('2024-02-15T11:00:00Z'),
      },
    ]);

    const result = await notificationsService.getUnread('agent-123', mockSql);

    expect(result.length).toBe(2);
    expect(result[0].read).toBe(false);
    expect(result[1].read).toBe(false);
  });

  it('should get all notifications with pagination', async () => {
    const mockSql = vi.fn().mockResolvedValue([
      {
        id: 1,
        agentId: 'agent-123',
        type: 'friend',
        title: 'Friend Request',
        body: 'New friend request',
        read: true,
        actionUrl: '/friends',
        createdAt: new Date('2024-02-15T10:00:00Z'),
      },
    ]);

    const result = await notificationsService.getAll('agent-123', 10, 0, false, mockSql);

    expect(result.length).toBe(1);
    expect(mockSql).toHaveBeenCalled();
  });

  it('should get only unread notifications when unreadOnly is true', async () => {
    const mockSql = vi.fn().mockResolvedValue([
      {
        id: 2,
        agentId: 'agent-123',
        type: 'gift',
        title: 'Gift Received',
        body: 'You received a gift!',
        read: false,
        actionUrl: '/inventory',
        createdAt: new Date('2024-02-15T11:00:00Z'),
      },
    ]);

    const result = await notificationsService.getAll('agent-123', 10, 0, true, mockSql);

    expect(result.length).toBe(1);
    expect(result[0].read).toBe(false);
  });

  it('should mark a notification as read', async () => {
    const mockSql = vi.fn().mockResolvedValue([{ id: 1 }]);

    const success = await notificationsService.markRead(1, 'agent-123', mockSql);

    expect(success).toBe(true);
    expect(mockSql).toHaveBeenCalled();
  });

  it('should return false when marking non-existent notification', async () => {
    const mockSql = vi.fn().mockResolvedValue([]);

    const success = await notificationsService.markRead(999, 'agent-123', mockSql);

    expect(success).toBe(false);
  });

  it('should mark all notifications as read', async () => {
    const mockSql = vi.fn().mockResolvedValue([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);

    const count = await notificationsService.markAllRead('agent-123', mockSql);

    expect(count).toBe(3);
  });

  it('should return 0 when marking all read with no unread notifications', async () => {
    const mockSql = vi.fn().mockResolvedValue([]);

    const count = await notificationsService.markAllRead('agent-123', mockSql);

    expect(count).toBe(0);
  });

  it('should delete old notifications (older than 30 days)', async () => {
    const mockSql = vi.fn().mockResolvedValue([
      { id: 1 },
      { id: 2 },
    ]);

    const count = await notificationsService.deleteOld(mockSql);

    expect(count).toBe(2);
    expect(mockSql).toHaveBeenCalled();
  });

  it('should get unread count for an agent', async () => {
    const mockSql = vi.fn().mockResolvedValue([{ count: '5' }]);

    const count = await notificationsService.getUnreadCount('agent-123', mockSql);

    expect(count).toBe(5);
  });

  it('should return 0 unread count when agent has no notifications', async () => {
    const mockSql = vi.fn().mockResolvedValue([{ count: '0' }]);

    const count = await notificationsService.getUnreadCount('agent-123', mockSql);

    expect(count).toBe(0);
  });

  it('should handle all notification types correctly', async () => {
    const types: NotificationType[] = ['trade', 'bid', 'gift', 'achievement', 'level_up', 'friend', 'guild', 'system', 'event', 'quest'];

    for (const type of types) {
      const mockSql = vi.fn().mockResolvedValue([{
        id: 1,
        agentId: 'agent-123',
        type,
        title: `Test ${type}`,
        body: `Test notification for ${type}`,
        read: false,
        actionUrl: null,
        createdAt: new Date(),
      }]);

      const result = await notificationsService.create(
        'agent-123',
        type,
        `Test ${type}`,
        `Test notification for ${type}`,
        null,
        mockSql
      );

      expect(result.type).toBe(type);
    }
  });

  it('should create notification with null title and body', async () => {
    const mockSql = vi.fn().mockResolvedValue([{
      id: 1,
      agentId: 'agent-123',
      type: 'system',
      title: null,
      body: null,
      read: false,
      actionUrl: null,
      createdAt: new Date(),
    }]);

    const result = await notificationsService.create(
      'agent-123',
      'system',
      null,
      null,
      null,
      mockSql
    );

    expect(result.title).toBeNull();
    expect(result.body).toBeNull();
    expect(result.actionUrl).toBeNull();
  });

  it('should handle pagination offset correctly', async () => {
    const mockSql = vi.fn().mockResolvedValue([
      {
        id: 11,
        agentId: 'agent-123',
        type: 'friend',
        title: 'Friend Request',
        body: 'Page 2 notification',
        read: false,
        actionUrl: '/friends',
        createdAt: new Date(),
      },
    ]);

    const result = await notificationsService.getAll('agent-123', 10, 10, false, mockSql);

    expect(result.length).toBe(1);
    expect(result[0].id).toBe(11);
  });

  it('should create notification with action URL', async () => {
    const mockSql = vi.fn().mockResolvedValue([{
      id: 1,
      agentId: 'agent-123',
      type: 'trade',
      title: 'Trade Complete',
      body: 'Your trade was successful',
      read: false,
      actionUrl: '/trades/123/details',
      createdAt: new Date(),
    }]);

    const result = await notificationsService.create(
      'agent-123',
      'trade',
      'Trade Complete',
      'Your trade was successful',
      '/trades/123/details',
      mockSql
    );

    expect(result.actionUrl).toBe('/trades/123/details');
  });

  it('should handle level_up notification type', async () => {
    const mockSql = vi.fn().mockResolvedValue([{
      id: 1,
      agentId: 'agent-123',
      type: 'level_up',
      title: 'Level Up!',
      body: 'You reached level 10',
      read: false,
      actionUrl: '/profile',
      createdAt: new Date(),
    }]);

    const result = await notificationsService.create(
      'agent-123',
      'level_up',
      'Level Up!',
      'You reached level 10',
      '/profile',
      mockSql
    );

    expect(result.type).toBe('level_up');
    expect(result.title).toBe('Level Up!');
  });

  it('should handle quest notification type', async () => {
    const mockSql = vi.fn().mockResolvedValue([{
      id: 1,
      agentId: 'agent-123',
      type: 'quest',
      title: 'Quest Complete',
      body: 'You completed "First Steps"',
      read: false,
      actionUrl: '/quests',
      createdAt: new Date(),
    }]);

    const result = await notificationsService.create(
      'agent-123',
      'quest',
      'Quest Complete',
      'You completed "First Steps"',
      '/quests',
      mockSql
    );

    expect(result.type).toBe('quest');
  });

  it('should handle event notification type', async () => {
    const mockSql = vi.fn().mockResolvedValue([{
      id: 1,
      agentId: 'agent-123',
      type: 'event',
      title: 'Event Starting',
      body: 'Valentine\'s Day event begins now!',
      read: false,
      actionUrl: '/events/valentine',
      createdAt: new Date(),
    }]);

    const result = await notificationsService.create(
      'agent-123',
      'event',
      'Event Starting',
      'Valentine\'s Day event begins now!',
      '/events/valentine',
      mockSql
    );

    expect(result.type).toBe('event');
    expect(result.body).toContain('Valentine');
  });
});
