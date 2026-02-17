/**
 * T-332: Bundle Size Optimization Tests
 * Verifies that the optimizations are in place:
 * 1. PixiJS is NOT loaded at page head (lazy-loaded on room entry)
 * 2. spectate.html references external JS file
 * 3. spectate.js contains the lazy loader function
 * 4. Server has cache headers configured for static assets
 * 5. spectate.html file size is reduced vs baseline
 */
import { readFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';

const PROJECT_ROOT = join(import.meta.dirname, '..', '..');
const CLIENT_DIR = join(PROJECT_ROOT, 'client');
const SRC_DIR = join(PROJECT_ROOT, 'src');

describe('T-332: Bundle Size Optimization', () => {

  describe('spectate.html optimizations', () => {
    const htmlPath = join(CLIENT_DIR, 'spectate.html');
    let htmlContent: string;

    it('spectate.html exists', () => {
      expect(existsSync(htmlPath)).toBe(true);
      htmlContent = readFileSync(htmlPath, 'utf8');
    });

    it('PixiJS is NOT loaded in <head> (lazy-loaded instead)', () => {
      htmlContent = htmlContent || readFileSync(htmlPath, 'utf8');
      // Should NOT have blocking PixiJS script in head
      expect(htmlContent).not.toMatch(/<script\s+src="[^"]*pixi\.min\.js"[^>]*><\/script>/);
    });

    it('references external spectate.js (not inline JS block)', () => {
      htmlContent = htmlContent || readFileSync(htmlPath, 'utf8');
      expect(htmlContent).toMatch(/src="\/js\/spectate\.js"/);
    });

    it('spectate.js has defer attribute for non-blocking load', () => {
      htmlContent = htmlContent || readFileSync(htmlPath, 'utf8');
      expect(htmlContent).toMatch(/spectate\.js"[^>]*defer/);
    });

    it('spectate.html file size < 60KB (was 120KB)', () => {
      const stats = statSync(htmlPath);
      const sizeKB = stats.size / 1024;
      // Should be well under 60KB after extraction (was 120KB)
      expect(sizeKB).toBeLessThan(60);
    });

    it('spectate.html line count < 2000 (was 4016 with inline JS)', () => {
      htmlContent = htmlContent || readFileSync(htmlPath, 'utf8');
      const lineCount = htmlContent.split('\n').length;
      expect(lineCount).toBeLessThan(2000);
    });

    it('does not contain large inline <script> block', () => {
      htmlContent = htmlContent || readFileSync(htmlPath, 'utf8');
      // Count lines between <script> and </script> tags
      // The remaining script (if any) should be very small
      const inlineScriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>/g) || [];
      const totalInlineJS = inlineScriptMatch.join('').length;
      // After extraction, inline JS should be minimal (< 500 chars)
      expect(totalInlineJS).toBeLessThan(500);
    });
  });

  describe('spectate.js external file', () => {
    const jsPath = join(CLIENT_DIR, 'js', 'spectate.js');
    let jsContent: string;

    it('client/js/spectate.js exists', () => {
      expect(existsSync(jsPath)).toBe(true);
      jsContent = readFileSync(jsPath, 'utf8');
    });

    it('contains loadPixiJS() lazy loader function', () => {
      jsContent = jsContent || readFileSync(jsPath, 'utf8');
      expect(jsContent).toContain('function loadPixiJS()');
    });

    it('lazy loader creates <script> element dynamically', () => {
      jsContent = jsContent || readFileSync(jsPath, 'utf8');
      expect(jsContent).toContain("createElement('script')");
    });

    it('lazy loader uses PixiJS CDN URL', () => {
      jsContent = jsContent || readFileSync(jsPath, 'utf8');
      expect(jsContent).toContain('pixi.js/7.3.2/pixi.min.js');
    });

    it('enterRoom function awaits loadPixiJS() before initPixiApp() call', () => {
      jsContent = jsContent || readFileSync(jsPath, 'utf8');
      // Find the enterRoom function body
      const enterRoomIdx = jsContent.indexOf('async function enterRoom(');
      expect(enterRoomIdx).toBeGreaterThan(-1);
      // Extract a reasonable chunk of the enterRoom function (~3KB after the definition)
      const enterRoomBody = jsContent.slice(enterRoomIdx, enterRoomIdx + 3000);
      // Within enterRoom: loadPixiJS() call must come before initPixiApp()
      const loadPixiRelIdx = enterRoomBody.indexOf('await loadPixiJS()');
      const initPixiRelIdx = enterRoomBody.indexOf('initPixiApp()');
      expect(loadPixiRelIdx).toBeGreaterThan(-1);
      expect(initPixiRelIdx).toBeGreaterThan(-1);
      expect(loadPixiRelIdx).toBeLessThan(initPixiRelIdx);
    });

    it('contains main spectator logic (fetchRooms, enterRoom)', () => {
      jsContent = jsContent || readFileSync(jsPath, 'utf8');
      expect(jsContent).toContain('fetchRooms');
      expect(jsContent).toContain('enterRoom');
    });

    it('does not double-load PixiJS (checks window.PIXI first)', () => {
      jsContent = jsContent || readFileSync(jsPath, 'utf8');
      expect(jsContent).toContain('window.PIXI');
    });

    it('spectate.js file size < 80KB (should be ~73KB)', () => {
      const stats = statSync(jsPath);
      const sizeKB = stats.size / 1024;
      expect(sizeKB).toBeLessThan(80);
    });
  });

  describe('server.ts cache headers', () => {
    const serverPath = join(SRC_DIR, 'server.ts');
    let serverContent: string;

    it('server.ts exists', () => {
      expect(existsSync(serverPath)).toBe(true);
      serverContent = readFileSync(serverPath, 'utf8');
    });

    it('has Cache-Control header for JS assets (1 year immutable)', () => {
      serverContent = serverContent || readFileSync(serverPath, 'utf8');
      expect(serverContent).toContain('max-age=31536000');
      expect(serverContent).toContain('immutable');
    });

    it('HTML files served with no-cache header', () => {
      serverContent = serverContent || readFileSync(serverPath, 'utf8');
      expect(serverContent).toContain('no-cache');
      expect(serverContent).toContain('.html');
    });

    it('public/assets served with long-term caching', () => {
      serverContent = serverContent || readFileSync(serverPath, 'utf8');
      // maxAge: '1y' or similar in the assets static handler
      expect(serverContent).toMatch(/maxAge.*1y|1y.*maxAge/);
    });

    it('setHeaders is configured for the client static middleware', () => {
      serverContent = serverContent || readFileSync(serverPath, 'utf8');
      expect(serverContent).toContain('setHeaders');
    });
  });

  describe('bundle size summary', () => {
    it('total reduction: spectate.html should save ~72KB vs baseline 120KB', () => {
      const htmlPath = join(CLIENT_DIR, 'spectate.html');
      const stats = statSync(htmlPath);
      // Was 120KB, now should be ~48KB = 60% reduction
      const sizeKB = stats.size / 1024;
      expect(sizeKB).toBeLessThan(60);
      expect(sizeKB).toBeGreaterThan(20); // Sanity check: shouldn't be empty
    });

    it('initial page load saves ~700KB (PixiJS not loaded at start)', () => {
      // This is validated by checking PixiJS is NOT in spectate.html head
      const htmlPath = join(CLIENT_DIR, 'spectate.html');
      const htmlContent = readFileSync(htmlPath, 'utf8');
      // No blocking PixiJS in head
      const headMatch = htmlContent.match(/<head>([\s\S]*?)<\/head>/);
      if (headMatch) {
        expect(headMatch[1]).not.toContain('pixi.min.js');
      }
    });
  });
});
