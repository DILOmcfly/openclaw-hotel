/**
 * Unit tests for src/ai/chatService.ts
 *
 * Strategy:
 *  - Mock `fs` (readFileSync) so the module loads with a fake API key.
 *  - Stub `globalThis.fetch` per-test to control Gemini responses.
 *  - Use exported helpers clearRateLimit / clearAllRateLimits to reset state.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Hoisted mock — must be declared before any imports that pull in chatService
vi.mock('fs', () => ({
  readFileSync: vi.fn(() => 'test-gemini-api-key-abc123'),
}));

import {
  generateChatMessage,
  clearRateLimit,
  clearAllRateLimits,
} from '../ai/chatService.js';
import type { Personality } from '../ai/personalities.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockPersonality: Personality = {
  name: 'TestBot',
  traits: ['friendly', 'helpful'],
  systemPrompt: 'You are TestBot, a friendly assistant in OpenClaw Hotel.',
  greetings: ['Hello!', 'Hi there!'],
  topics: ['testing', 'unit tests'],
  responseStyle: {
    temperature: 0.7,
    maxTokens: 80,
    tone: 'neutral',
  },
};

/** Builds a well-formed Gemini API response body */
function makeGeminiResponse(text: string) {
  return {
    candidates: [
      {
        content: {
          parts: [{ text }],
        },
      },
    ],
  };
}

/** Returns a mock Response-like object with a successful Gemini payload */
function okFetch(text: string): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => makeGeminiResponse(text),
  } as unknown as Response;
}

/** Returns a mock Response-like object with an HTTP error */
function errFetch(status = 500, statusText = 'Internal Server Error'): Response {
  return {
    ok: false,
    status,
    statusText,
    json: async () => ({}),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearAllRateLimits();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateChatMessage — AI response', () => {
  it('returns the AI-generated text on a successful Gemini call', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(okFetch('Hello from AI!'));
    const result = await generateChatMessage('agent-1', mockPersonality);
    expect(result).toBe('Hello from AI!');
  });

  it('trims surrounding whitespace from the AI response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(okFetch('  trimmed response  '));
    const result = await generateChatMessage('agent-2', mockPersonality);
    expect(result).toBe('trimmed response');
  });

  it('truncates responses longer than 100 characters to 97 chars + "..."', async () => {
    const longText = 'X'.repeat(120);
    vi.mocked(fetch).mockResolvedValueOnce(okFetch(longText));
    const result = await generateChatMessage('agent-3', mockPersonality);
    expect(result.length).toBe(100);
    expect(result.endsWith('...')).toBe(true);
  });

  it('does NOT truncate a response that is exactly 100 characters', async () => {
    const exactText = 'Y'.repeat(100);
    vi.mocked(fetch).mockResolvedValueOnce(okFetch(exactText));
    const result = await generateChatMessage('agent-4', mockPersonality);
    expect(result.length).toBe(100);
    expect(result.endsWith('...')).toBe(false);
  });

  it('does NOT truncate a response shorter than 100 characters', async () => {
    const shortText = 'Short.';
    vi.mocked(fetch).mockResolvedValueOnce(okFetch(shortText));
    const result = await generateChatMessage('agent-5', mockPersonality);
    expect(result).toBe('Short.');
  });
});

describe('generateChatMessage — personality integration', () => {
  it('includes the personality systemPrompt in the request body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(okFetch('ok'));
    await generateChatMessage('agent-p1', mockPersonality, 'lobby context');

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    const promptText: string = body.contents[0].parts[0].text;

    expect(promptText).toContain(mockPersonality.systemPrompt);
  });

  it('includes the context string in the request body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(okFetch('ok'));
    await generateChatMessage('agent-p2', mockPersonality, 'standing near the pool');

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    const promptText: string = body.contents[0].parts[0].text;

    expect(promptText).toContain('standing near the pool');
  });

  it('sends correct temperature from personality.responseStyle', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(okFetch('ok'));
    await generateChatMessage('agent-p3', mockPersonality);

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);

    expect(body.generationConfig.temperature).toBe(mockPersonality.responseStyle.temperature);
  });

  it('sends correct maxOutputTokens from personality.responseStyle', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(okFetch('ok'));
    await generateChatMessage('agent-p4', mockPersonality);

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);

    expect(body.generationConfig.maxOutputTokens).toBe(mockPersonality.responseStyle.maxTokens);
  });

  it('uses the default context when none is provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(okFetch('ok'));
    await generateChatMessage('agent-p5', mockPersonality);

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    const promptText: string = body.contents[0].parts[0].text;

    expect(promptText).toContain('OpenClaw Hotel');
  });
});

describe('generateChatMessage — fallback behavior', () => {
  it('returns a non-empty string when fetch throws (network error)', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));
    const result = await generateChatMessage('fb-agent-1', mockPersonality);
    expect(result).toBeTypeOf('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns a non-empty string when Gemini returns HTTP 500', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(errFetch(500));
    const result = await generateChatMessage('fb-agent-2', mockPersonality);
    expect(result).toBeTypeOf('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns a non-empty string when Gemini returns HTTP 429', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(errFetch(429, 'Too Many Requests'));
    const result = await generateChatMessage('fb-agent-3', mockPersonality);
    expect(result).toBeTypeOf('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('falls back when response has no candidates array', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ candidates: null }),
    } as unknown as Response);
    const result = await generateChatMessage('fb-agent-4', mockPersonality);
    expect(result).toBeTypeOf('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('falls back when candidates array is empty', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ candidates: [] }),
    } as unknown as Response);
    const result = await generateChatMessage('fb-agent-5', mockPersonality);
    expect(result).toBeTypeOf('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('falls back when candidates[0].content is missing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ candidates: [{}] }),
    } as unknown as Response);
    const result = await generateChatMessage('fb-agent-6', mockPersonality);
    expect(result).toBeTypeOf('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('falls back when content.parts is missing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ candidates: [{ content: {} }] }),
    } as unknown as Response);
    const result = await generateChatMessage('fb-agent-7', mockPersonality);
    expect(result).toBeTypeOf('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('falls back when response.json() throws', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new Error('JSON parse error');
      },
    } as unknown as Response);
    const result = await generateChatMessage('fb-agent-8', mockPersonality);
    expect(result).toBeTypeOf('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('generateChatMessage — rate limiting', () => {
  it('calls the API on the first request (not rate-limited)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(okFetch('first call'));
    const result = await generateChatMessage('rl-agent-1', mockPersonality);
    expect(result).toBe('first call');
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it('skips the API on the second consecutive request (rate-limited)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(okFetch('first call'));
    await generateChatMessage('rl-agent-2', mockPersonality);

    // Second call — should be rate-limited, fetch must NOT be called again
    const second = await generateChatMessage('rl-agent-2', mockPersonality);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(second).toBeTypeOf('string');
    expect(second.length).toBeGreaterThan(0);
  });

  it('does NOT set the rate limit when the API call fails', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('API down'))
      .mockResolvedValueOnce(okFetch('retry works'));

    await generateChatMessage('rl-agent-3', mockPersonality);
    const result = await generateChatMessage('rl-agent-3', mockPersonality);

    expect(result).toBe('retry works');
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it('does NOT set the rate limit when the API returns a non-OK status', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(errFetch(503))
      .mockResolvedValueOnce(okFetch('second attempt'));

    await generateChatMessage('rl-agent-4', mockPersonality);
    const result = await generateChatMessage('rl-agent-4', mockPersonality);

    expect(result).toBe('second attempt');
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it('rate limits are independent between different agents', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(okFetch('response for A'))
      .mockResolvedValueOnce(okFetch('response for B'));

    await generateChatMessage('agent-A', mockPersonality);
    const resultB = await generateChatMessage('agent-B', mockPersonality);

    expect(resultB).toBe('response for B');
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it('clearRateLimit removes the limit for a specific agent', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(okFetch('before clear'))
      .mockResolvedValueOnce(okFetch('after clear'));

    await generateChatMessage('clear-agent', mockPersonality);
    clearRateLimit('clear-agent');

    const result = await generateChatMessage('clear-agent', mockPersonality);
    expect(result).toBe('after clear');
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it('clearRateLimit only removes the specified agent', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(okFetch('A response'))
      .mockResolvedValueOnce(okFetch('B response after clear'));

    await generateChatMessage('clear-only-A', mockPersonality);
    await generateChatMessage('keep-B', mockPersonality);
    clearRateLimit('clear-only-A');

    // A should be unblocked
    vi.mocked(fetch).mockResolvedValueOnce(okFetch('A second call'));
    const resultA = await generateChatMessage('clear-only-A', mockPersonality);
    expect(resultA).toBe('A second call');

    // B should still be rate-limited
    const resultB = await generateChatMessage('keep-B', mockPersonality);
    expect(resultB).toBeTypeOf('string'); // fallback, fetch not called again for B
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3); // A×2, B×1
  });

  it('clearAllRateLimits allows every agent to call the API again', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(okFetch('A1'))
      .mockResolvedValueOnce(okFetch('B1'))
      .mockResolvedValueOnce(okFetch('A2'))
      .mockResolvedValueOnce(okFetch('B2'));

    await generateChatMessage('all-A', mockPersonality);
    await generateChatMessage('all-B', mockPersonality);
    clearAllRateLimits();

    const resultA = await generateChatMessage('all-A', mockPersonality);
    const resultB = await generateChatMessage('all-B', mockPersonality);

    expect(resultA).toBe('A2');
    expect(resultB).toBe('B2');
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(4);
  });
});

describe('generateChatMessage — edge cases', () => {
  it('handles an empty string as agentId', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(okFetch('response'));
    const result = await generateChatMessage('', mockPersonality);
    expect(result).toBeTypeOf('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles an empty context string', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(okFetch('context ok'));
    const result = await generateChatMessage('edge-agent-1', mockPersonality, '');
    expect(result).toBe('context ok');
  });

  it('handles a personality with very high temperature', async () => {
    const hotPersonality: Personality = {
      ...mockPersonality,
      responseStyle: { temperature: 2.0, maxTokens: 80, tone: 'wild' },
    };
    vi.mocked(fetch).mockResolvedValueOnce(okFetch('wild response'));
    const result = await generateChatMessage('edge-agent-2', hotPersonality);
    expect(result).toBe('wild response');
  });

  it('handles a personality with very low maxTokens', async () => {
    const tinyPersonality: Personality = {
      ...mockPersonality,
      responseStyle: { temperature: 0.5, maxTokens: 1, tone: 'brief' },
    };
    vi.mocked(fetch).mockResolvedValueOnce(okFetch('k'));
    const result = await generateChatMessage('edge-agent-3', tinyPersonality);
    expect(result).toBe('k');
  });

  it('always returns a string — never throws', async () => {
    // Simulate every possible failure at once
    vi.mocked(fetch).mockImplementationOnce(() => {
      throw new TypeError('fetch is not a function');
    });
    await expect(
      generateChatMessage('edge-agent-4', mockPersonality)
    ).resolves.toBeTypeOf('string');
  });
});
