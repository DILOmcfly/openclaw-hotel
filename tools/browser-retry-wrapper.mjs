#!/usr/bin/env node

/**
 * Browser Retry Wrapper — Robust Browser Automation with Fallback Chain
 * 
 * Implements retry logic with exponential backoff and profile fallback.
 * Unblocks T-ASSETS by making browser automation resilient.
 * 
 * Features:
 * - 3 retry attempts with exponential backoff (1s, 3s, 9s)
 * - Auto-detect timeout errors → reload page
 * - Fallback chain: openclaw profile → chrome extension → error
 * - Detailed error logging
 * 
 * Usage:
 *   import { retryBrowserAction } from './tools/browser-retry-wrapper.mjs';
 *   
 *   const result = await retryBrowserAction(
 *     async (browserFn) => {
 *       await browserFn({ action: 'open', targetUrl: 'https://example.com' });
 *       return await browserFn({ action: 'screenshot' });
 *     },
 *     { maxRetries: 3, profile: 'openclaw' }
 *   );
 */

import fs from 'fs';
import path from 'path';

const TIMEOUT_ERRORS = [
  'timeout',
  'timed out',
  'navigation timeout',
  'waiting for',
  'element not found',
  'connection refused',
  'ECONNREFUSED'
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Check if error is timeout-related
 */
function isTimeoutError(error) {
  const message = error?.message?.toLowerCase() || '';
  return TIMEOUT_ERRORS.some(pattern => message.includes(pattern));
}

/**
 * Log browser failure for debugging
 */
function logFailure(attempt, profile, error, url) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    attempt,
    profile,
    error: error.message,
    url,
    stack: error.stack?.split('\n').slice(0, 3).join('\n')
  };
  
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const logPath = path.join(logDir, 'browser-failures.jsonl');
  fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
}

/**
 * Retry browser action with exponential backoff and profile fallback
 * 
 * @param {Function} action - Async function that receives browserFn and executes browser actions
 * @param {Object} options - Configuration options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {string} options.profile - Initial browser profile ('openclaw' or 'chrome', default: 'openclaw')
 * @param {Function} options.browser - Browser function to use (injected for testing)
 * @param {string} options.currentUrl - Current page URL for reload (optional)
 * @returns {Promise<any>} - Action result
 * @throws {Error} - If all retries + fallbacks fail
 */
export async function retryBrowserAction(action, options = {}) {
  const {
    maxRetries = 3,
    profile = 'openclaw',
    browser = null, // Will be injected in tests or real usage
    currentUrl = null
  } = options;
  
  if (!browser) {
    throw new Error('Browser function must be provided via options.browser');
  }
  
  const profiles = profile === 'chrome' ? ['chrome', 'openclaw'] : ['openclaw', 'chrome'];
  
  for (const currentProfile of profiles) {
    console.log(`\n[Browser Retry] Trying profile: ${currentProfile}`);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Browser Retry] Attempt ${attempt}/${maxRetries} with ${currentProfile}...`);
        
        // Create profile-specific browser function
        const browserWithProfile = (params) => {
          return browser({ ...params, profile: currentProfile });
        };
        
        // Execute action
        const result = await action(browserWithProfile);
        
        console.log(`[Browser Retry] ✓ Success with ${currentProfile} on attempt ${attempt}`);
        return result;
        
      } catch (error) {
        console.error(`[Browser Retry] ✗ Attempt ${attempt} failed: ${error.message}`);
        
        // Log failure
        logFailure(attempt, currentProfile, error, currentUrl);
        
        // If last attempt with this profile, try next profile
        if (attempt === maxRetries) {
          console.log(`[Browser Retry] All retries exhausted for ${currentProfile}`);
          break;
        }
        
        // Calculate exponential backoff: 1s, 3s, 9s
        const delayMs = Math.pow(3, attempt - 1) * 1000;
        console.log(`[Browser Retry] Waiting ${delayMs}ms before retry...`);
        await sleep(delayMs);
        
        // If timeout error, try to reload page
        if (isTimeoutError(error) && currentUrl) {
          try {
            console.log(`[Browser Retry] Timeout detected, reloading page: ${currentUrl}`);
            await browser({ 
              action: 'navigate', 
              targetUrl: currentUrl,
              profile: currentProfile 
            });
            await sleep(2000); // Wait for page load
          } catch (reloadError) {
            console.error(`[Browser Retry] Page reload failed: ${reloadError.message}`);
          }
        }
      }
    }
  }
  
  // All profiles and retries failed
  const errorMessage = [
    'Browser automation failed after all retries and fallbacks.',
    `Profiles tried: ${profiles.join(' → ')}`,
    `Retries per profile: ${maxRetries}`,
    'Check logs/browser-failures.jsonl for details.',
    '',
    'Alternatives:',
    '- Use Puter.js image generator (tools/puter-image-generator/)',
    '- Attach Chrome extension tab (profile=chrome)',
    '- Ask Diego to check browser control status'
  ].join('\n');
  
  throw new Error(errorMessage);
}

/**
 * Helper: Retry browser navigation with verification
 */
export async function retryNavigate(url, browser, options = {}) {
  return retryBrowserAction(
    async (browserFn) => {
      await browserFn({ action: 'open', targetUrl: url });
      
      // Wait for page load (look for common ready indicators)
      try {
        await browserFn({ 
          action: 'snapshot',
          timeoutMs: 5000
        });
      } catch (err) {
        // Snapshot timeout acceptable, page might still be usable
        console.warn('[Browser Retry] Snapshot timeout after navigate, continuing...');
      }
      
      return { success: true, url };
    },
    { ...options, currentUrl: url, browser }
  );
}

/**
 * Helper: Retry element interaction with verification
 */
export async function retryClick(ref, browser, options = {}) {
  return retryBrowserAction(
    async (browserFn) => {
      // Snapshot first to verify element exists
      const snapshot = await browserFn({ action: 'snapshot' });
      
      if (typeof snapshot === 'string' && !snapshot.includes(ref)) {
        throw new Error(`Element not found in snapshot: ${ref}`);
      }
      
      // Click
      await browserFn({ 
        action: 'act', 
        request: { kind: 'click', ref } 
      });
      
      return { success: true, ref };
    },
    { ...options, browser }
  );
}

/**
 * Helper: Retry screenshot capture
 */
export async function retryScreenshot(selector, browser, options = {}) {
  return retryBrowserAction(
    async (browserFn) => {
      const result = await browserFn({ 
        action: 'screenshot',
        selector,
        type: 'png'
      });
      
      if (!result) {
        throw new Error('Screenshot returned empty result');
      }
      
      return result;
    },
    { ...options, browser }
  );
}

// CLI usage (for testing)
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Browser Retry Wrapper loaded successfully.');
  console.log('Usage: import { retryBrowserAction } from "./tools/browser-retry-wrapper.mjs"');
  console.log('\nExample:');
  console.log('  const result = await retryBrowserAction(');
  console.log('    async (browser) => {');
  console.log('      await browser({ action: "open", targetUrl: "https://example.com" });');
  console.log('      return await browser({ action: "screenshot" });');
  console.log('    },');
  console.log('    { maxRetries: 3, browser: yourBrowserFunction }');
  console.log('  );');
}
