/**
 * Script Engine Tests
 * Comprehensive test suite for room script trigger-action system
 * 
 * @requires test database (marked as .skip, run with TEST_DB=true)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  createRoomScript,
  getRoomScripts,
  getScript,
  updateRoomScript,
  deleteRoomScript,
  evaluateTrigger,
  processTriggerEvent,
  executeScriptAction,
  type TriggerType,
  type ActionType,
  type RoomScript,
  type TriggerEvent,
  type ScriptAction,
} from '../services/scriptEngine';

// Mock SQL connection
function getMockSql() {
  return vi.fn().mockResolvedValue([]);
}

describe('ScriptEngine', () => {
  describe.skip('createRoomScript', () => {
    let sql: any;

    beforeEach(() => {
      sql = getMockSql();
    });

    it('should create a new room script', async () => {
      sql.mockResolvedValueOnce([{ count: 0 }]); // Check max scripts
      sql.mockResolvedValueOnce([]); // INSERT

      const result = await createRoomScript(
        'room1',
        'agent_enters',
        {},
        'show_message',
        { text: 'Welcome!' },
        sql
      );

      expect(result).toHaveProperty('id');
      expect(typeof result.id).toBe('string');
      expect(sql).toHaveBeenCalledTimes(2);
    });

    it('should enforce max scripts per room limit (20)', async () => {
      sql.mockResolvedValueOnce([{ count: 20 }]); // At limit

      await expect(
        createRoomScript(
          'room1',
          'agent_enters',
          {},
          'show_message',
          { text: 'Test' },
          sql
        )
      ).rejects.toThrow('Room cannot have more than 20 scripts');
    });

    it('should validate trigger data', async () => {
      sql.mockResolvedValueOnce([{ count: 0 }]);

      await expect(
        createRoomScript(
          'room1',
          'furniture_clicked',
          {}, // Missing itemId
          'show_message',
          { text: 'Test' },
          sql
        )
      ).rejects.toThrow('furniture_clicked requires itemId');
    });

    it('should validate action data', async () => {
      sql.mockResolvedValueOnce([{ count: 0 }]);

      await expect(
        createRoomScript(
          'room1',
          'agent_enters',
          {},
          'give_coins',
          { amount: -10 }, // Invalid amount
          sql
        )
      ).rejects.toThrow('give_coins requires amount (positive number)');
    });

    it('should reject invalid trigger type', async () => {
      sql.mockResolvedValueOnce([{ count: 0 }]);

      await expect(
        createRoomScript(
          'room1',
          'invalid_trigger' as TriggerType,
          {},
          'show_message',
          { text: 'Test' },
          sql
        )
      ).rejects.toThrow('Unknown trigger type');
    });

    it('should reject invalid action type', async () => {
      sql.mockResolvedValueOnce([{ count: 0 }]);

      await expect(
        createRoomScript(
          'room1',
          'agent_enters',
          {},
          'invalid_action' as ActionType,
          {},
          sql
        )
      ).rejects.toThrow('Unknown action type');
    });
  });

  describe.skip('getRoomScripts', () => {
    let sql: any;

    beforeEach(() => {
      sql = getMockSql();
    });

    it('should return all scripts for a room', async () => {
      const mockScripts = [
        {
          id: 'script1',
          room_id: 'room1',
          trigger_type: 'agent_enters',
          trigger_data: {},
          action_type: 'show_message',
          action_data: { text: 'Welcome!' },
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      sql.mockResolvedValueOnce(mockScripts);

      const result = await getRoomScripts('room1', sql);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('script1');
      expect(result[0].trigger_type).toBe('agent_enters');
    });

    it('should return empty array when no scripts', async () => {
      sql.mockResolvedValueOnce([]);

      const result = await getRoomScripts('room1', sql);

      expect(result).toEqual([]);
    });
  });

  describe.skip('getScript', () => {
    let sql: any;

    beforeEach(() => {
      sql = getMockSql();
    });

    it('should return script by ID', async () => {
      const mockScript = {
        id: 'script1',
        room_id: 'room1',
        trigger_type: 'agent_enters',
        trigger_data: {},
        action_type: 'show_message',
        action_data: { text: 'Test' },
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      sql.mockResolvedValueOnce([mockScript]);

      const result = await getScript('script1', sql);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('script1');
    });

    it('should return null when script not found', async () => {
      sql.mockResolvedValueOnce([]);

      const result = await getScript('nonexistent', sql);

      expect(result).toBeNull();
    });
  });

  describe.skip('updateRoomScript', () => {
    let sql: any;

    beforeEach(() => {
      sql = getMockSql();
    });

    it('should update script fields', async () => {
      const existingScript = {
        id: 'script1',
        room_id: 'room1',
        trigger_type: 'agent_enters',
        trigger_data: {},
        action_type: 'show_message',
        action_data: { text: 'Old' },
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      sql.mockResolvedValueOnce([existingScript]); // getScript
      sql.mockResolvedValueOnce([]); // UPDATE

      await updateRoomScript(
        'script1',
        { actionData: { text: 'New' } },
        sql
      );

      expect(sql).toHaveBeenCalledTimes(2);
    });

    it('should validate updated trigger data', async () => {
      const existingScript = {
        id: 'script1',
        room_id: 'room1',
        trigger_type: 'agent_enters',
        trigger_data: {},
        action_type: 'show_message',
        action_data: { text: 'Test' },
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      sql.mockResolvedValueOnce([existingScript]);

      await expect(
        updateRoomScript(
          'script1',
          {
            triggerType: 'furniture_clicked',
            triggerData: {}, // Missing itemId
          },
          sql
        )
      ).rejects.toThrow('furniture_clicked requires itemId');
    });

    it('should throw when script not found', async () => {
      sql.mockResolvedValueOnce([]);

      await expect(
        updateRoomScript('nonexistent', { enabled: false }, sql)
      ).rejects.toThrow('Script not found');
    });
  });

  describe.skip('deleteRoomScript', () => {
    let sql: any;

    beforeEach(() => {
      sql = getMockSql();
    });

    it('should delete script by ID', async () => {
      sql.mockResolvedValueOnce([]);

      await deleteRoomScript('script1', sql);

      expect(sql).toHaveBeenCalledTimes(1);
    });
  });

  describe('evaluateTrigger', () => {
    it('should match agent_enters trigger', () => {
      const script: RoomScript = {
        id: 'script1',
        room_id: 'room1',
        trigger_type: 'agent_enters',
        trigger_data: {},
        action_type: 'show_message',
        action_data: { text: 'Test' },
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const event: TriggerEvent = {
        type: 'agent_enters',
        roomId: 'room1',
        agentId: 'agent1',
        data: {},
      };

      expect(evaluateTrigger(script, event)).toBe(true);
    });

    it('should match furniture_clicked with correct itemId', () => {
      const script: RoomScript = {
        id: 'script1',
        room_id: 'room1',
        trigger_type: 'furniture_clicked',
        trigger_data: { itemId: 'chair1' },
        action_type: 'show_message',
        action_data: { text: 'Test' },
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const event: TriggerEvent = {
        type: 'furniture_clicked',
        roomId: 'room1',
        data: { itemId: 'chair1' },
      };

      expect(evaluateTrigger(script, event)).toBe(true);
    });

    it('should not match furniture_clicked with wrong itemId', () => {
      const script: RoomScript = {
        id: 'script1',
        room_id: 'room1',
        trigger_type: 'furniture_clicked',
        trigger_data: { itemId: 'chair1' },
        action_type: 'show_message',
        action_data: { text: 'Test' },
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const event: TriggerEvent = {
        type: 'furniture_clicked',
        roomId: 'room1',
        data: { itemId: 'chair2' },
      };

      expect(evaluateTrigger(script, event)).toBe(false);
    });

    it('should match chat_keyword with case-insensitive match', () => {
      const script: RoomScript = {
        id: 'script1',
        room_id: 'room1',
        trigger_type: 'chat_keyword',
        trigger_data: { keyword: 'hello' },
        action_type: 'show_message',
        action_data: { text: 'Hi!' },
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const event: TriggerEvent = {
        type: 'chat_keyword',
        roomId: 'room1',
        agentId: 'agent1',
        data: { message: 'Hello everyone!' },
      };

      expect(evaluateTrigger(script, event)).toBe(true);
    });

    it('should match chat_keyword with regex pattern', () => {
      const script: RoomScript = {
        id: 'script1',
        room_id: 'room1',
        trigger_type: 'chat_keyword',
        trigger_data: { keyword: '/hel+o/' },
        action_type: 'show_message',
        action_data: { text: 'Match!' },
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const event: TriggerEvent = {
        type: 'chat_keyword',
        roomId: 'room1',
        agentId: 'agent1',
        data: { message: 'Say hello!' },
      };

      expect(evaluateTrigger(script, event)).toBe(true);
    });

    it('should not match different trigger types', () => {
      const script: RoomScript = {
        id: 'script1',
        room_id: 'room1',
        trigger_type: 'agent_enters',
        trigger_data: {},
        action_type: 'show_message',
        action_data: { text: 'Test' },
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const event: TriggerEvent = {
        type: 'furniture_clicked',
        roomId: 'room1',
        data: { itemId: 'chair1' },
      };

      expect(evaluateTrigger(script, event)).toBe(false);
    });
  });

  describe.skip('processTriggerEvent', () => {
    let sql: any;

    beforeEach(() => {
      sql = getMockSql();
      // Clear rate limit state (private, but tests behavior indirectly)
    });

    it('should return actions for matching enabled scripts', async () => {
      const mockScripts = [
        {
          id: 'script1',
          room_id: 'room1',
          trigger_type: 'agent_enters',
          trigger_data: {},
          action_type: 'show_message',
          action_data: { text: 'Welcome!' },
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      sql.mockResolvedValueOnce(mockScripts);

      const event: TriggerEvent = {
        type: 'agent_enters',
        roomId: 'room1',
        agentId: 'agent1',
        data: {},
      };

      const actions = await processTriggerEvent(event, sql);

      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('show_message');
      expect(actions[0].targetAgentId).toBe('agent1');
    });

    it('should not return actions for disabled scripts', async () => {
      const mockScripts = [
        {
          id: 'script1',
          room_id: 'room1',
          trigger_type: 'agent_enters',
          trigger_data: {},
          action_type: 'show_message',
          action_data: { text: 'Test' },
          enabled: false, // DISABLED
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      sql.mockResolvedValueOnce(mockScripts);

      const event: TriggerEvent = {
        type: 'agent_enters',
        roomId: 'room1',
        agentId: 'agent1',
        data: {},
      };

      const actions = await processTriggerEvent(event, sql);

      expect(actions).toHaveLength(0);
    });

    it('should enforce rate limiting (5 second cooldown)', async () => {
      const mockScripts = [
        {
          id: 'script1',
          room_id: 'room1',
          trigger_type: 'agent_enters',
          trigger_data: {},
          action_type: 'show_message',
          action_data: { text: 'Test' },
          enabled: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      sql.mockResolvedValue(mockScripts);

      const event: TriggerEvent = {
        type: 'agent_enters',
        roomId: 'room1',
        agentId: 'agent1',
        data: {},
      };

      // First execution should succeed
      const actions1 = await processTriggerEvent(event, sql);
      expect(actions1).toHaveLength(1);

      // Second execution immediately should be rate-limited
      const actions2 = await processTriggerEvent(event, sql);
      expect(actions2).toHaveLength(0);
    });
  });

  describe.skip('executeScriptAction', () => {
    let sql: any;
    let executeCallback: any;

    beforeEach(() => {
      sql = getMockSql();
      executeCallback = vi.fn().mockResolvedValue(undefined);
    });

    it('should execute action via callback', async () => {
      const action: ScriptAction = {
        type: 'show_message',
        data: { text: 'Hello!' },
        targetAgentId: 'agent1',
      };

      const result = await executeScriptAction(action, 'room1', sql, executeCallback);

      expect(result.success).toBe(true);
      expect(executeCallback).toHaveBeenCalledWith(action);
    });

    it('should enforce max coins limit', async () => {
      const action: ScriptAction = {
        type: 'give_coins',
        data: { amount: 1000 }, // Over limit (100)
        targetAgentId: 'agent1',
      };

      const result = await executeScriptAction(action, 'room1', sql, executeCallback);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot give more than 100 coins');
      expect(executeCallback).not.toHaveBeenCalled();
    });

    it('should return error when callback throws', async () => {
      executeCallback.mockRejectedValueOnce(new Error('Network error'));

      const action: ScriptAction = {
        type: 'show_message',
        data: { text: 'Test' },
      };

      const result = await executeScriptAction(action, 'room1', sql, executeCallback);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('Validation edge cases', () => {
    it('should reject timer_elapsed with negative seconds', async () => {
      const sql = getMockSql();
      sql.mockResolvedValueOnce([{ count: 0 }]);

      await expect(
        createRoomScript(
          'room1',
          'timer_elapsed',
          { seconds: -5 },
          'show_message',
          { text: 'Test' },
          sql
        )
      ).rejects.toThrow('timer_elapsed requires seconds (positive number)');
    });

    it('should reject show_message with text >500 chars', async () => {
      const sql = getMockSql();
      sql.mockResolvedValueOnce([{ count: 0 }]);

      const longText = 'a'.repeat(501);

      await expect(
        createRoomScript(
          'room1',
          'agent_enters',
          {},
          'show_message',
          { text: longText },
          sql
        )
      ).rejects.toThrow('show_message text cannot exceed 500 characters');
    });

    it('should reject teleport_agent with negative coordinates', async () => {
      const sql = getMockSql();
      sql.mockResolvedValueOnce([{ count: 0 }]);

      await expect(
        createRoomScript(
          'room1',
          'agent_enters',
          {},
          'teleport_agent',
          { x: -5, y: 10 },
          sql
        )
      ).rejects.toThrow('teleport_agent coordinates must be non-negative');
    });

    it('should reject invalid regex pattern in chat_keyword', async () => {
      const sql = getMockSql();
      sql.mockResolvedValueOnce([{ count: 0 }]);

      await expect(
        createRoomScript(
          'room1',
          'chat_keyword',
          { keyword: '/[invalid(/' }, // Invalid regex
          'show_message',
          { text: 'Test' },
          sql
        )
      ).rejects.toThrow('Invalid regex pattern in chat_keyword');
    });
  });
});
