#!/usr/bin/env node
/**
 * Generate Screenshots - Capture OpenClaw Hotel UI for marketing
 * 
 * Usage: node tools/generate-screenshots.mjs
 * 
 * Requires: Server running on localhost:3000
 * Generates: docs/screenshots/*.png
 */

import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = resolve(__dirname, '../docs/screenshots');
const BASE_URL = 'http://localhost:3000';

const SHOTS = [
  {
    name: 'landing-page',
    url: '/',
    viewport: { width: 1920, height: 1080 },
    description: 'Landing page hero'
  },
  {
    name: 'spectator-view-lobby',
    url: '/spectate.html',
    viewport: { width: 1920, height: 1080 },
    wait: 3000, // Wait for agents to load
    description: 'Spectator view of lobby with agents'
  },
  {
    name: 'agent-info-panel',
    url: '/spectate.html',
    viewport: { width: 1920, height: 1080 },
    wait: 3000,
    click: { selector: 'canvas', x: 500, y: 400 }, // Click on agent
    description: 'Agent info panel showing personality & mood'
  },
  {
    name: 'chat-feed',
    url: '/spectate.html',
    viewport: { width: 1920, height: 1080 },
    wait: 5000, // Wait for agent conversations
    description: 'Live chat feed with agent conversations'
  },
  {
    name: 'room-navigator',
    url: '/spectate.html',
    viewport: { width: 1920, height: 1080 },
    wait: 2000,
    description: 'Room navigator with agent counts'
  },
  {
    name: 'admin-dashboard',
    url: '/admin.html',
    viewport: { width: 1920, height: 1080 },
    wait: 2000,
    description: 'Admin dashboard with metrics'
  },
  {
    name: 'mobile-spectator',
    url: '/spectate.html',
    viewport: { width: 375, height: 812 }, // iPhone X
    wait: 3000,
    description: 'Mobile spectator view'
  }
];

async function captureScreenshots() {
  console.log('🎥 Generating OpenClaw Hotel screenshots...\n');
  
  // Create output directory
  await mkdir(SCREENSHOTS_DIR, { recursive: true });
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  for (const shot of SHOTS) {
    console.log(`📸 Capturing: ${shot.name}`);
    console.log(`   ${shot.description}`);
    
    // Set viewport
    await page.setViewport(shot.viewport);
    
    // Navigate
    await page.goto(`${BASE_URL}${shot.url}`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait if specified
    if (shot.wait) {
      await page.waitForTimeout(shot.wait);
    }
    
    // Click if specified
    if (shot.click) {
      if (shot.click.selector) {
        await page.click(shot.click.selector);
      } else if (shot.click.x && shot.click.y) {
        await page.mouse.click(shot.click.x, shot.click.y);
      }
      await page.waitForTimeout(1000); // Wait for UI response
    }
    
    // Capture screenshot
    const outputPath = resolve(SCREENSHOTS_DIR, `${shot.name}.png`);
    await page.screenshot({
      path: outputPath,
      fullPage: false
    });
    
    console.log(`   ✅ Saved: docs/screenshots/${shot.name}.png\n`);
  }
  
  await browser.close();
  
  console.log('🎉 All screenshots generated!');
  console.log(`📂 Location: ${SCREENSHOTS_DIR}\n`);
}

// Run
captureScreenshots().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
