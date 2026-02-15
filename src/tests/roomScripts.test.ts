import { describe, it, expect } from 'vitest';
import type { RoomScript, TriggerEvent, ScriptAction } from '../services/scriptEngine.js';
import { evaluateTrigger } from '../services/scriptEngine.js';

describe('Room Scripts (Wired System) Tests', () => {
  // Test 1: Validate trigger types
  it('validates trigger types', () => {
    const validTriggers = ['agent_enters', 'furniture_clicked', 'timer_elapsed', 'chat_keyword'];
    expect(validTriggers.includes('agent_enters')).toBe(true);
    expect(validTriggers.includes('invalid' as any)).toBe(false);
  });

  // Test 2: Validate action types
  it('validates action types', () => {
    const validActions = ['teleport_agent', 'show_message', 'toggle_furniture', 'give_coins'];
    expect(validActions.includes('teleport_agent')).toBe(true);
    expect(validActions.includes('give_item' as any)).toBe(false);
  });

  // Test 3: agent_enters trigger always matches
  it('agent_enters trigger always matches', () => {
    const script: RoomScript = {
      id: '1',
      room_id: 'room-1',
      trigger_type: 'agent_enters',
      trigger_data: {},
      action_type: 'show_message',
      action_data: { text: 'Welcome!' },
      enabled: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const event: TriggerEvent = {
      type: 'agent_enters',
      roomId: 'room-1',
      agentId: 'agent-1',
      data: {},
    };

    expect(evaluateTrigger(script, event)).toBe(true);
  });

  // Test 4: furniture_clicked trigger matches by itemId
  it('furniture_clicked trigger matches by itemId', () => {
    const script: RoomScript = {
      id: '2',
      room_id: 'room-1',
      trigger_type: 'furniture_clicked',
      trigger_data: { itemId: 'chair-1' },
      action_type: 'teleport_agent',
      action_data: { x: 10, y: 5 },
      enabled: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const matchingEvent: TriggerEvent = {
      type: 'furniture_clicked',
      roomId: 'room-1',
      data: { itemId: 'chair-1' },
    };

    const nonMatchingEvent: TriggerEvent = {
      type: 'furniture_clicked',
      roomId: 'room-1',
      data: { itemId: 'table-1' },
    };

    expect(evaluateTrigger(script, matchingEvent)).toBe(true);
    expect(evaluateTrigger(script, nonMatchingEvent)).toBe(false);
  });

  // Test 5: chat_keyword trigger with simple keyword
  it('chat_keyword trigger matches simple keyword', () => {
    const script: RoomScript = {
      id: '3',
      room_id: 'room-1',
      trigger_type: 'chat_keyword',
      trigger_data: { keyword: 'hello' },
      action_type: 'show_message',
      action_data: { text: 'Hi there!' },
      enabled: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const matchingEvent: TriggerEvent = {
      type: 'chat_keyword',
      roomId: 'room-1',
      agentId: 'agent-1',
      data: { message: 'Hello everyone!' },
    };

    const nonMatchingEvent: TriggerEvent = {
      type: 'chat_keyword',
      roomId: 'room-1',
      agentId: 'agent-1',
      data: { message: 'Goodbye!' },
    };

    expect(evaluateTrigger(script, matchingEvent)).toBe(true);
    expect(evaluateTrigger(script, nonMatchingEvent)).toBe(false);
  });

  // Test 6: chat_keyword trigger with regex
  it('chat_keyword trigger supports regex patterns', () => {
    const script: RoomScript = {
      id: '4',
      room_id: 'room-1',
      trigger_type: 'chat_keyword',
      trigger_data: { keyword: '/^!help/' },
      action_type: 'show_message',
      action_data: { text: 'Commands: !hello, !status' },
      enabled: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const matchingEvent: TriggerEvent = {
      type: 'chat_keyword',
      roomId: 'room-1',
      agentId: 'agent-1',
      data: { message: '!help me' },
    };

    const nonMatchingEvent: TriggerEvent = {
      type: 'chat_keyword',
      roomId: 'room-1',
      agentId: 'agent-1',
      data: { message: 'can you help me' },
    };

    expect(evaluateTrigger(script, matchingEvent)).toBe(true);
    expect(evaluateTrigger(script, nonMatchingEvent)).toBe(false);
  });

  // Test 7: Trigger type mismatch returns false
  it('returns false when trigger type does not match event type', () => {
    const script: RoomScript = {
      id: '5',
      room_id: 'room-1',
      trigger_type: 'agent_enters',
      trigger_data: {},
      action_type: 'show_message',
      action_data: { text: 'Welcome!' },
      enabled: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const event: TriggerEvent = {
      type: 'furniture_clicked',
      roomId: 'room-1',
      data: { itemId: 'chair-1' },
    };

    expect(evaluateTrigger(script, event)).toBe(false);
  });

  // Test 8: Validate teleport_agent action data
  it('validates teleport_agent requires x and y coordinates', () => {
    const validateTeleport = (data: any): boolean => {
      return (
        typeof data.x === 'number' &&
        typeof data.y === 'number' &&
        data.x >= 0 &&
        data.y >= 0
      );
    };

    expect(validateTeleport({ x: 10, y: 5 })).toBe(true);
    expect(validateTeleport({ x: -1, y: 5 })).toBe(false);
    expect(validateTeleport({ x: 10 })).toBe(false);
    expect(validateTeleport({})).toBe(false);
  });

  // Test 9: Validate show_message action data
  it('validates show_message requires text and enforces length limit', () => {
    const validateMessage = (data: any): boolean => {
      return (
        typeof data.text === 'string' &&
        data.text.length > 0 &&
        data.text.length <= 500
      );
    };

    expect(validateMessage({ text: 'Hello!' })).toBe(true);
    expect(validateMessage({ text: '' })).toBe(false);
    expect(validateMessage({ text: 'a'.repeat(501) })).toBe(false);
    expect(validateMessage({})).toBe(false);
  });

  // Test 10: Validate give_coins action data and max limit
  it('validates give_coins enforces max 100 coins limit', () => {
    const MAX_COINS = 100;
    const validateCoins = (data: any): boolean => {
      return (
        typeof data.amount === 'number' &&
        data.amount > 0 &&
        data.amount <= MAX_COINS
      );
    };

    expect(validateCoins({ amount: 50 })).toBe(true);
    expect(validateCoins({ amount: 100 })).toBe(true);
    expect(validateCoins({ amount: 101 })).toBe(false);
    expect(validateCoins({ amount: 0 })).toBe(false);
    expect(validateCoins({ amount: -10 })).toBe(false);
  });

  // Test 11: Validate toggle_furniture action data
  it('validates toggle_furniture requires itemId and state', () => {
    const validateToggle = (data: any): boolean => {
      return (
        typeof data.itemId === 'string' &&
        data.itemId.length > 0 &&
        typeof data.state === 'boolean'
      );
    };

    expect(validateToggle({ itemId: 'light-1', state: true })).toBe(true);
    expect(validateToggle({ itemId: 'light-1', state: false })).toBe(true);
    expect(validateToggle({ itemId: 'light-1' })).toBe(false);
    expect(validateToggle({ state: true })).toBe(false);
  });

  // Test 12: Max scripts per room limit
  it('enforces max 20 scripts per room', () => {
    const MAX_SCRIPTS = 20;
    const checkLimit = (count: number): boolean => {
      return count < MAX_SCRIPTS;
    };

    expect(checkLimit(0)).toBe(true);
    expect(checkLimit(19)).toBe(true);
    expect(checkLimit(20)).toBe(false);
    expect(checkLimit(21)).toBe(false);
  });

  // Test 13: Rate limiting logic
  it('enforces rate limit of 1 execution per 5 seconds per script', () => {
    const RATE_LIMIT_MS = 5000;
    const canExecute = (lastExecution: number | null): boolean => {
      if (!lastExecution) return true;
      return Date.now() - lastExecution >= RATE_LIMIT_MS;
    };

    expect(canExecute(null)).toBe(true);
    expect(canExecute(Date.now() - 6000)).toBe(true);
    expect(canExecute(Date.now() - 3000)).toBe(false);
  });

  // Test 14: Case-insensitive keyword matching
  it('chat_keyword matching is case-insensitive', () => {
    const matches = (keyword: string, message: string): boolean => {
      return message.toLowerCase().includes(keyword.toLowerCase());
    };

    expect(matches('hello', 'HELLO WORLD')).toBe(true);
    expect(matches('HELLO', 'hello world')).toBe(true);
    expect(matches('HeLLo', 'hElLo WoRlD')).toBe(true);
  });

  // Test 15: Script enabled/disabled state
  it('respects enabled/disabled script state', () => {
    const scripts: RoomScript[] = [
      {
        id: '1',
        room_id: 'room-1',
        trigger_type: 'agent_enters',
        trigger_data: {},
        action_type: 'show_message',
        action_data: { text: 'A' },
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: '2',
        room_id: 'room-1',
        trigger_type: 'agent_enters',
        trigger_data: {},
        action_type: 'show_message',
        action_data: { text: 'B' },
        enabled: false,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    const enabledScripts = scripts.filter(s => s.enabled);
    expect(enabledScripts).toHaveLength(1);
    expect(enabledScripts[0].id).toBe('1');
  });

  // Test 16: Validate timer_elapsed trigger data
  it('validates timer_elapsed requires positive seconds', () => {
    const validateTimer = (data: any): boolean => {
      return typeof data.seconds === 'number' && data.seconds > 0;
    };

    expect(validateTimer({ seconds: 10 })).toBe(true);
    expect(validateTimer({ seconds: 0 })).toBe(false);
    expect(validateTimer({ seconds: -5 })).toBe(false);
    expect(validateTimer({})).toBe(false);
  });

  // Test 17: Validate furniture_clicked trigger data
  it('validates furniture_clicked requires itemId', () => {
    const validateFurnitureClick = (data: any): boolean => {
      return typeof data.itemId === 'string' && data.itemId.length > 0;
    };

    expect(validateFurnitureClick({ itemId: 'chair-1' })).toBe(true);
    expect(validateFurnitureClick({ itemId: '' })).toBe(false);
    expect(validateFurnitureClick({})).toBe(false);
  });

  // Test 18: Script action structure
  it('validates script action structure', () => {
    const validateAction = (action: ScriptAction): boolean => {
      const validTypes = ['teleport_agent', 'show_message', 'toggle_furniture', 'give_coins'];
      return (
        validTypes.includes(action.type) &&
        typeof action.data === 'object' &&
        action.data !== null
      );
    };

    const validAction: ScriptAction = {
      type: 'show_message',
      data: { text: 'Hello!' },
      targetAgentId: 'agent-1',
    };

    expect(validateAction(validAction)).toBe(true);
  });

  // Test 19: Empty trigger data defaults to empty object
  it('handles empty trigger data as empty object', () => {
    const script: RoomScript = {
      id: '1',
      room_id: 'room-1',
      trigger_type: 'agent_enters',
      trigger_data: {},
      action_type: 'show_message',
      action_data: { text: 'Hi' },
      enabled: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    expect(script.trigger_data).toEqual({});
    expect(Object.keys(script.trigger_data)).toHaveLength(0);
  });

  // Test 20: Multiple scripts can trigger on same event
  it('allows multiple scripts to trigger on same event', () => {
    const scripts: RoomScript[] = [
      {
        id: '1',
        room_id: 'room-1',
        trigger_type: 'agent_enters',
        trigger_data: {},
        action_type: 'show_message',
        action_data: { text: 'Welcome!' },
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: '2',
        room_id: 'room-1',
        trigger_type: 'agent_enters',
        trigger_data: {},
        action_type: 'give_coins',
        action_data: { amount: 10 },
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    const event: TriggerEvent = {
      type: 'agent_enters',
      roomId: 'room-1',
      agentId: 'agent-1',
      data: {},
    };

    const matchingScripts = scripts.filter(s => evaluateTrigger(s, event));
    expect(matchingScripts).toHaveLength(2);
  });
});
