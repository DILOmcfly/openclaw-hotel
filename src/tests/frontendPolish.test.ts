/**
 * T-350/T-351/T-352 Frontend Polish Tests
 * Verifies structural integrity of HTML/JS changes without a DOM environment.
 * Tests read the actual source files to ensure features are present.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const CLIENT_DIR = join(process.cwd(), 'client');

function readClient(filename: string): string {
  return readFileSync(join(CLIENT_DIR, filename), 'utf8');
}

// ── T-350: Sidebar Rooms Tab ─────────────────────────────────────────────────

describe('T-350: Sidebar Rooms Tab', () => {
  let spectateHtml: string;
  let spectateJs: string;

  beforeAll(() => {
    spectateHtml = readClient('spectate.html');
    spectateJs   = readClient('js/spectate.js');
  });

  it('pane-rooms div exists in spectate.html', () => {
    expect(spectateHtml).toContain('id="pane-rooms"');
  });

  it('tab-rooms button exists', () => {
    expect(spectateHtml).toContain('id="tab-rooms"');
  });

  it('sidebarRoomsList element exists', () => {
    expect(spectateHtml).toContain('id="sidebarRoomsList"');
  });

  it('sidebar-room-row CSS class is styled', () => {
    expect(spectateHtml).toContain('.sidebar-room-row');
  });

  it('sidebar-rooms-header CSS class is styled', () => {
    expect(spectateHtml).toContain('.sidebar-rooms-header');
  });

  it('loadSidebarRooms function defined in spectate.js', () => {
    expect(spectateJs).toContain('function loadSidebarRooms');
  });

  it('switchSidebarTab calls loadSidebarRooms for rooms tab', () => {
    expect(spectateJs).toContain("if (tab === 'rooms')");
    expect(spectateJs).toContain('loadSidebarRooms()');
  });

  it('loadSidebarRooms fetches from spectate/rooms API', () => {
    expect(spectateJs).toContain('/api/spectate/rooms');
  });

  it('sidebar-room-row renders current room indicator', () => {
    expect(spectateJs).toContain('current-room');
    expect(spectateJs).toContain('HERE');
  });

  it('sidebar rooms refresh button exists in HTML', () => {
    expect(spectateHtml).toContain('loadSidebarRooms()');
  });
});

// ── T-351: Landing Page Live Stats ──────────────────────────────────────────

describe('T-351: Landing Page Live Stats', () => {
  let landingHtml: string;

  beforeAll(() => {
    landingHtml = readClient('landing.html');
  });

  it('statAgents element exists', () => {
    expect(landingHtml).toContain('id="statAgents"');
  });

  it('statRooms element exists', () => {
    expect(landingHtml).toContain('id="statRooms"');
  });

  it('statSpectators element exists', () => {
    expect(landingHtml).toContain('id="statSpectators"');
  });

  it('live-stats container exists', () => {
    expect(landingHtml).toContain('class="live-stats"');
  });

  it('live-dot-sm pulsing indicator exists', () => {
    expect(landingHtml).toContain('live-dot-sm');
  });

  it('fetchLandingStats JavaScript is present', () => {
    expect(landingHtml).toContain('fetchLandingStats');
  });

  it('stats fetched from /api/spectate/stats', () => {
    expect(landingHtml).toContain('/api/spectate/stats');
  });

  it('stats auto-refresh every 30 seconds', () => {
    expect(landingHtml).toContain('POLL_INTERVAL');
    expect(landingHtml).toContain('30_000');
  });

  it('live-stats CSS is defined', () => {
    expect(landingHtml).toContain('.live-stats {');
  });

  it('livePulse animation is defined for the dot', () => {
    expect(landingHtml).toContain('livePulse');
  });
});

// ── T-352: Share Button in Room Toolbar ─────────────────────────────────────

describe('T-352: Share Button in Room Toolbar', () => {
  let spectateHtml: string;
  let spectateJs: string;

  beforeAll(() => {
    spectateHtml = readClient('spectate.html');
    spectateJs   = readClient('js/spectate.js');
  });

  it('share-room-btn exists in room-toolbar', () => {
    expect(spectateHtml).toContain('class="share-room-btn"');
  });

  it('share button calls shareRoom()', () => {
    expect(spectateHtml).toContain('onclick="shareRoom()"');
  });

  it('share-room-btn CSS is defined', () => {
    expect(spectateHtml).toContain('.share-room-btn {');
  });

  it('shareRoom function exists in spectate.js', () => {
    expect(spectateJs).toContain('function shareRoom');
  });

  it('shareRoom sets room URL param', () => {
    expect(spectateJs).toContain("url.searchParams.set('room', currentRoomId)");
  });

  it('shareRoom copies to clipboard', () => {
    expect(spectateJs).toContain('navigator.clipboard.writeText');
  });

  it('shareRoom shows toast feedback', () => {
    expect(spectateJs).toContain('showShareToast');
  });
});
