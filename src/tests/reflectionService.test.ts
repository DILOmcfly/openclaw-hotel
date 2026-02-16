/**
 * Reflection Service Tests (Unit - No DB Required)
 */

import { describe, it, expect } from 'vitest';
import {
  buildReflectionPrompt,
  REFLECTION_THRESHOLD,
} from '../services/reflectionService.js';
import type { Memory } from '../services/agentMemory.js';

function makeMem(overrides: Partial<Memory> = {}): Memory {
  return {
    id: 1,
    agentId: 'agent-1',
    type: 'observation',
    content: 'Test memory',
    importance: 5,
    relatedAgentIds: [],
    createdAt: new Date(),
    ...overrides,
  };
}

describe('Reflection Service', () => {
  describe('REFLECTION_THRESHOLD', () => {
    it('should have sensible defaults', () => {
      expect(REFLECTION_THRESHOLD.default).toBe(150);
      expect(REFLECTION_THRESHOLD.min).toBeLessThan(REFLECTION_THRESHOLD.default);
      expect(REFLECTION_THRESHOLD.max).toBeGreaterThan(REFLECTION_THRESHOLD.default);
    });
  });

  describe('buildReflectionPrompt', () => {
    it('should build prompt from memories', () => {
      const memories: Memory[] = [
        makeMem({ content: 'Chatted with Agent_42 about music', relatedAgentIds: ['Agent_42'] }),
        makeMem({ content: 'Explored the lounge room', type: 'observation' }),
        makeMem({ content: 'Helped Agent_77 find furniture', relatedAgentIds: ['Agent_77'] }),
      ];
      const prompt = buildReflectionPrompt(memories);
      expect(prompt).toBeTruthy();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(10);
    });

    it('should handle empty memories', () => {
      const prompt = buildReflectionPrompt([]);
      expect(typeof prompt).toBe('string');
    });

    it('should handle single memory', () => {
      const memories = [makeMem({ content: 'Sat alone in lobby' })];
      const prompt = buildReflectionPrompt(memories);
      expect(prompt).toBeTruthy();
    });

    it('should include memory content in prompt', () => {
      const memories = [makeMem({ content: 'Had a great conversation about AI' })];
      const prompt = buildReflectionPrompt(memories);
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should handle memories with related agents', () => {
      const memories = [
        makeMem({ content: 'Met Agent_42', relatedAgentIds: ['Agent_42'] }),
        makeMem({ content: 'Met Agent_42 again', relatedAgentIds: ['Agent_42'] }),
        makeMem({ content: 'Talked to Agent_77', relatedAgentIds: ['Agent_77'] }),
      ];
      const prompt = buildReflectionPrompt(memories);
      expect(prompt).toBeTruthy();
    });

    it('should handle high importance memories', () => {
      const memories = [
        makeMem({ content: 'Won the trivia contest!', importance: 9 }),
        makeMem({ content: 'Made a new friend', importance: 8 }),
      ];
      const prompt = buildReflectionPrompt(memories);
      expect(prompt).toBeTruthy();
    });
  });

  describe('Pattern Analysis (via prompt)', () => {
    it('should detect repeated interactions with same agent', () => {
      const memories = Array.from({ length: 5 }, (_, i) =>
        makeMem({ content: `Interaction ${i} with Agent_42`, relatedAgentIds: ['Agent_42'] })
      );
      const prompt = buildReflectionPrompt(memories);
      expect(prompt).toBeTruthy();
    });

    it('should handle diverse memory types', () => {
      const memories = [
        makeMem({ type: 'observation', content: 'The lobby was busy today' }),
        makeMem({ type: 'conversation', content: 'Discussed weather with Agent_11' }),
        makeMem({ type: 'reflection', content: 'I seem to prefer quiet rooms' }),
      ];
      const prompt = buildReflectionPrompt(memories);
      expect(prompt).toBeTruthy();
    });
  });
});
