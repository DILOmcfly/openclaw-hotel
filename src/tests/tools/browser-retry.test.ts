import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retryBrowserAction, retryNavigate, retryClick, retryScreenshot } from '../../../tools/browser-retry-wrapper.mjs';

describe('Browser Retry Wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('retryBrowserAction', () => {
    it('should succeed on first attempt', async () => {
      const mockBrowser = vi.fn().mockResolvedValue({ success: true });
      const action = vi.fn(async (browserFn) => {
        return await browserFn({ action: 'test' });
      });

      const result = await retryBrowserAction(action, { 
        browser: mockBrowser,
        maxRetries: 3 
      });

      expect(result).toEqual({ success: true });
      expect(action).toHaveBeenCalledTimes(1);
      expect(mockBrowser).toHaveBeenCalledWith({ action: 'test', profile: 'openclaw' });
    });

    it('should retry on failure and succeed on second attempt', async () => {
      const mockBrowser = vi.fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce({ success: true });

      const action = vi.fn(async (browserFn) => {
        return await browserFn({ action: 'test' });
      });

      const result = await retryBrowserAction(action, { 
        browser: mockBrowser,
        maxRetries: 3 
      });

      expect(result).toEqual({ success: true });
      expect(action).toHaveBeenCalledTimes(2);
    });

    it('should fallback to chrome profile after openclaw exhausted', async () => {
      let attemptCount = 0;
      const mockBrowser = vi.fn(async (params) => {
        attemptCount++;
        // Fail all openclaw attempts (3), succeed on first chrome attempt
        if (attemptCount <= 3) {
          throw new Error('openclaw profile failed');
        }
        return { success: true, profile: params.profile };
      });

      const action = vi.fn(async (browserFn) => {
        return await browserFn({ action: 'test' });
      });

      const result = await retryBrowserAction(action, { 
        browser: mockBrowser,
        maxRetries: 3,
        profile: 'openclaw'
      });

      expect(result).toEqual({ success: true, profile: 'chrome' });
      expect(action).toHaveBeenCalledTimes(4); // 3 openclaw + 1 chrome
    });

    it('should throw after all retries and profiles exhausted', async () => {
      const mockBrowser = vi.fn().mockRejectedValue(new Error('persistent failure'));

      const action = vi.fn(async (browserFn) => {
        return await browserFn({ action: 'test' });
      });

      await expect(
        retryBrowserAction(action, { 
          browser: mockBrowser,
          maxRetries: 2 
        })
      ).rejects.toThrow('Browser automation failed after all retries');

      // Should try 2 profiles × 2 retries = 4 attempts
      expect(action).toHaveBeenCalledTimes(4);
    });

    it('should detect timeout errors and attempt page reload', async () => {
      const mockBrowser = vi.fn()
        .mockRejectedValueOnce(new Error('navigation timeout exceeded'))
        .mockResolvedValueOnce({ success: true }); // navigate reload
      
      // Second attempt after reload
      mockBrowser.mockResolvedValueOnce({ success: true }); 

      const action = vi.fn(async (browserFn) => {
        return await browserFn({ action: 'test' });
      });

      const result = await retryBrowserAction(action, { 
        browser: mockBrowser,
        maxRetries: 3,
        currentUrl: 'https://example.com'
      });

      expect(result).toEqual({ success: true });
      
      // Check that navigate was called for reload
      expect(mockBrowser).toHaveBeenCalledWith(
        expect.objectContaining({ 
          action: 'navigate',
          targetUrl: 'https://example.com'
        })
      );
    });

    it('should require browser function to be provided', async () => {
      const action = vi.fn(async (browserFn) => {
        return await browserFn({ action: 'test' });
      });

      await expect(
        retryBrowserAction(action, { maxRetries: 3 })
      ).rejects.toThrow('Browser function must be provided');
    });
  });

  describe('retryNavigate', () => {
    it('should navigate and verify with snapshot', async () => {
      const mockBrowser = vi.fn()
        .mockResolvedValueOnce(undefined) // open
        .mockResolvedValueOnce('<html>Ready</html>'); // snapshot

      const result = await retryNavigate(
        'https://example.com',
        mockBrowser,
        { maxRetries: 3 }
      );

      expect(result).toEqual({ success: true, url: 'https://example.com' });
      expect(mockBrowser).toHaveBeenCalledWith({ 
        action: 'open', 
        targetUrl: 'https://example.com',
        profile: 'openclaw'
      });
      expect(mockBrowser).toHaveBeenCalledWith({ 
        action: 'snapshot',
        timeoutMs: 5000,
        profile: 'openclaw'
      });
    });
  });

  describe('retryClick', () => {
    it('should verify element exists before clicking', async () => {
      const mockBrowser = vi.fn()
        .mockResolvedValueOnce('<html><button>Click me</button></html>') // snapshot
        .mockResolvedValueOnce(undefined); // click

      const result = await retryClick(
        'button',
        mockBrowser,
        { maxRetries: 3 }
      );

      expect(result).toEqual({ success: true, ref: 'button' });
      expect(mockBrowser).toHaveBeenCalledWith({ action: 'snapshot', profile: 'openclaw' });
      expect(mockBrowser).toHaveBeenCalledWith({ 
        action: 'act', 
        request: { kind: 'click', ref: 'button' },
        profile: 'openclaw'
      });
    });

    it('should fail if element not found in snapshot', async () => {
      const mockBrowser = vi.fn()
        .mockResolvedValue('<html><div>No matching element here</div></html>');

      await expect(
        retryClick('button', mockBrowser, { maxRetries: 2 })
      ).rejects.toThrow('Browser automation failed');
    });
  });

  describe('retryScreenshot', () => {
    it('should capture screenshot successfully', async () => {
      const mockBrowser = vi.fn()
        .mockResolvedValue(Buffer.from('fake-png-data'));

      const result = await retryScreenshot(
        'img.generated',
        mockBrowser,
        { maxRetries: 3 }
      );

      expect(result).toBeInstanceOf(Buffer);
      expect(mockBrowser).toHaveBeenCalledWith({ 
        action: 'screenshot',
        selector: 'img.generated',
        type: 'png',
        profile: 'openclaw'
      });
    });

    it('should retry on empty screenshot result', async () => {
      const mockBrowser = vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(Buffer.from('fake-png-data'));

      const result = await retryScreenshot(
        'img.generated',
        mockBrowser,
        { maxRetries: 3 }
      );

      expect(result).toBeInstanceOf(Buffer);
    });
  });
});
