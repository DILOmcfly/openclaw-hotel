import { describe, expect, it } from 'vitest';
import { processCommand } from '../services/chatCommands.js';

const mockContext = {
  roomId: 'room-123',
  agentName: 'TestAgent',
  getOnlineCount: () => 5,
};

describe('chatCommands', () => {
  it('returns null for non-command messages', () => {
    const result = processCommand('hello world', mockContext);
    expect(result).toBeNull();
  });

  it('returns null for messages without slash', () => {
    const result = processCommand('just a message', mockContext);
    expect(result).toBeNull();
  });

  it('/help returns list of available commands', () => {
    const result = processCommand('/help', mockContext);
    
    expect(result).not.toBeNull();
    expect(result?.type).toBe('system');
    expect(result?.message).toContain('/help');
    expect(result?.message).toContain('/me');
    expect(result?.message).toContain('/roll');
    expect(result?.message).toContain('/time');
    expect(result?.message).toContain('/roominfo');
    expect(result?.message).toContain('/online');
    expect(result?.message).toContain('/flip');
    expect(result?.message).toContain('/shrug');
    expect(result?.message).toContain('/tableflip');
    expect(result?.message).toContain('/unflip');
  });

  it('/me with action returns action message', () => {
    const result = processCommand('/me waves hello', mockContext);
    
    expect(result).not.toBeNull();
    expect(result?.type).toBe('action');
    expect(result?.message).toBe('* TestAgent waves hello');
  });

  it('/me without action returns usage message', () => {
    const result = processCommand('/me', mockContext);
    
    expect(result).not.toBeNull();
    expect(result?.type).toBe('system');
    expect(result?.message).toContain('Usage');
  });

  it('/roll without args rolls d6', () => {
    const result = processCommand('/roll', mockContext);
    
    expect(result).not.toBeNull();
    expect(result?.type).toBe('broadcast');
    expect(result?.message).toContain('TestAgent');
    expect(result?.message).toContain('d6');
    expect(result?.message).toMatch(/got \d+/);
  });

  it('/roll with valid sides rolls specified die', () => {
    const result = processCommand('/roll 20', mockContext);
    
    expect(result).not.toBeNull();
    expect(result?.type).toBe('broadcast');
    expect(result?.message).toContain('d20');
  });

  it('/roll with sides > 100 returns error', () => {
    const result = processCommand('/roll 101', mockContext);
    
    expect(result).not.toBeNull();
    expect(result?.type).toBe('system');
    expect(result?.message).toContain('Maximum');
    expect(result?.message).toContain('100');
  });

  it('/roll with invalid number returns error', () => {
    const result = processCommand('/roll abc', mockContext);
    
    expect(result).not.toBeNull();
    expect(result?.type).toBe('system');
    expect(result?.message).toContain('Invalid');
  });

  it('/roll with sides < 2 returns error', () => {
    const result = processCommand('/roll 1', mockContext);
    
    expect(result).not.toBeNull();
    expect(result?.type).toBe('system');
    expect(result?.message).toContain('Invalid');
  });

  it('/time returns server time', () => {
    const result = processCommand('/time', mockContext);
    
    expect(result).not.toBeNull();
    expect(result?.type).toBe('system');
    expect(result?.message).toContain('Server time');
    expect(result?.message).toMatch(/\d{4}-\d{2}-\d{2}/); // ISO date format
  });

  it('/roominfo returns system message', () => {
    const result = processCommand('/roominfo', mockContext);
    
    expect(result).not.toBeNull();
    expect(result?.type).toBe('system');
    expect(result?.message).toBeTruthy();
  });

  it('/online returns online count', () => {
    const result = processCommand('/online', mockContext);
    
    expect(result).not.toBeNull();
    expect(result?.type).toBe('system');
    expect(result?.message).toContain('5');
    expect(result?.message).toContain('Online');
  });

  it('/flip returns heads or tails', () => {
    const result = processCommand('/flip', mockContext);
    
    expect(result).not.toBeNull();
    expect(result?.type).toBe('broadcast');
    expect(result?.message).toContain('TestAgent');
    expect(result?.message).toContain('coin');
    expect(result?.message).toMatch(/(heads|tails)/);
  });

  it('/shrug returns shrug emoji', () => {
    const result = processCommand('/shrug', mockContext);
    
    expect(result).not.toBeNull();
    expect(result?.type).toBe('broadcast');
    expect(result?.message).toContain('¯\\_(ツ)_/¯');
    expect(result?.message).toContain('TestAgent');
  });

  it('/tableflip returns tableflip emoji', () => {
    const result = processCommand('/tableflip', mockContext);
    
    expect(result).not.toBeNull();
    expect(result?.type).toBe('broadcast');
    expect(result?.message).toContain('(╯°□°)╯︵ ┻━┻');
    expect(result?.message).toContain('TestAgent');
  });

  it('/unflip returns unflip emoji', () => {
    const result = processCommand('/unflip', mockContext);
    
    expect(result).not.toBeNull();
    expect(result?.type).toBe('broadcast');
    expect(result?.message).toContain('┬─┬ノ( º _ ºノ)');
    expect(result?.message).toContain('TestAgent');
  });

  it('unknown command returns error message', () => {
    const result = processCommand('/unknown', mockContext);
    
    expect(result).not.toBeNull();
    expect(result?.type).toBe('system');
    expect(result?.message).toContain('Unknown command');
    expect(result?.message).toContain('/unknown');
    expect(result?.message).toContain('/help');
  });

  it('command is case-insensitive', () => {
    const result = processCommand('/HELP', mockContext);
    
    expect(result).not.toBeNull();
    expect(result?.type).toBe('system');
    expect(result?.message).toContain('Available commands');
  });

  it('handles extra whitespace in commands', () => {
    const result = processCommand('  /help  ', mockContext);
    
    expect(result).not.toBeNull();
    expect(result?.type).toBe('system');
  });

  it('handles commands with multiple spaces in args', () => {
    const result = processCommand('/me   does    something', mockContext);
    
    expect(result).not.toBeNull();
    expect(result?.type).toBe('action');
    expect(result?.message).toContain('does');
    expect(result?.message).toContain('something');
  });
});
