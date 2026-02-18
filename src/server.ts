import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import express from 'express';

// Prevent uncaught errors from crashing the server
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT]', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED]', reason instanceof Error ? reason.message : reason);
});
import authRouter from './api/auth.routes.js';
import agentAuthRouter from './api/agentAuth.routes.js';
import furnitureRouter from './api/furniture.routes.js';
import roomsRouter from './api/rooms.routes.js';
import tradesRouter from './api/trades.routes.js';
import friendsRouter from './api/friends.routes.js';
import relationshipsRouter from './api/relationships.routes.js';
import profileRouter from './api/profile.routes.js';
import directMessagesRouter from './api/directMessages.routes.js';
import achievementsRouter from './api/achievements.routes.js';
import notificationsRouter from './api/notifications.routes.js';
import economyRouter from './api/economy.routes.js';
import economyDashboardRouter from './api/economyDashboard.routes.js';
import adminRouter from './api/admin.routes.js';
import navigatorRouter from './api/navigator.routes.js';
import moderationToolsRouter from './api/moderationTools.routes.js';
import gamesRouter from './api/games.routes.js';
import botsRouter from './api/bots.routes.js';
import leaderboardRouter from './api/leaderboard.routes.js';
import appearanceRouter from './api/appearance.routes.js';
import roomTemplatesRouter from './api/roomTemplates.routes.js';
import ratingRouter from './api/rating.routes.js';
import spectatorRouter from './api/spectator.routes.js';
import directoryRouter from './api/directory.routes.js';
import inventoryRouter from './api/inventory.routes.js';
import roomPermissionsRouter from './api/roomPermissions.routes.js';
import marketplaceRouter from './api/marketplace.routes.js';
import teleportRouter from './api/teleport.routes.js';
import petsRouter from './api/pets.routes.js';
import agentStatusRouter from './api/agentStatus.routes.js';
import eventsRouter from './api/events.routes.js';
import competitiveEventsRouter from './api/competitiveEvents.routes.js';
import rollersRouter from './api/rollers.routes.js';
import pollsRouter from './api/polls.routes.js';
import puzzlesRouter from './api/puzzles.routes.js';
import jukeboxRouter from './api/jukebox.routes.js';
import giftsRouter from './api/gifts.routes.js';
import stackingRouter from './api/stacking.routes.js';
import photosRouter from './api/photos.routes.js';
import activityLogRouter from './api/activityLog.routes.js';
import atmosphereRouter from './api/atmosphere.routes.js';
import warpZonesRouter from './api/warpZones.routes.js';
import titlesRouter from './api/titles.routes.js';
import roomQueueRouter from './api/roomQueue.routes.js';
import floorPatternsRouter from './api/floorPatterns.routes.js';
import wallItemsRouter from './api/wallItems.routes.js';
import guildsRouter from './api/guilds.routes.js';
import alliancesRouter from './api/alliances.routes.js';
import tradeHistoryRouter from './api/tradeHistory.routes.js';
import announcementsRouter from './api/announcements.routes.js';
import roomAnalyticsRouter from './api/roomAnalytics.routes.js';
import itemRarityRouter from './api/itemRarity.routes.js';
import seasonsRouter from './api/seasons.routes.js';
import reportsRouter from './api/reports.routes.js';
import mailRouter from './api/mail.routes.js';
import furniturePresetsRouter from './api/furniturePresets.routes.js';
import favoritesRouter from './api/favorites.routes.js';
import agentSettingsRouter from './api/agentSettings.routes.js';
import agentBiosRouter from './api/agentBios.routes.js';
import chatHistoryRouter from './api/chatHistory.routes.js';
import roomSearchRouter from './api/roomSearch.routes.js';
import reputationRouter from './api/reputation.routes.js';
import craftingRouter from './api/crafting.routes.js';
import dailyChallengesRouter from './api/dailyChallenges.routes.js';
import luckyWheelRouter from './api/luckyWheel.routes.js';
import auctionsRouter from './api/auctions.routes.js';
import cardsRouter from './api/cards.routes.js';
import contestsRouter from './api/contests.routes.js';
import streaksRouter from './api/streaks.routes.js';
import stickersRouter from './api/stickers.routes.js';
import slotsRouter from './api/slots.routes.js';
import agentJournalRouter from './api/agentJournal.routes.js';
import questsRouter from './api/quests.routes.js';
import achievementsV2Router from './api/achievementsV2.routes.js';
import roomSafetyRouter from './api/roomSafety.routes.js';
import personalityRouter from './api/personality.routes.js';
import levelingRouter from './api/leveling.routes.js';
import badgesRouter from './api/badges.routes.js';
import roomReviewsRouter from './api/roomReviews.routes.js';
import roomPlaylistsRouter from './api/roomPlaylists.routes.js';
import minimapRouter from './api/minimap.routes.js';
import roomCalendarRouter from './api/roomCalendar.routes.js';
import blackjackRouter from './api/blackjack.routes.js';
import connectFourRouter from './api/connectFour.routes.js';
import roomCodesRouter from './api/roomCodes.routes.js';
import emoteReactionsRouter from './api/emoteReactions.routes.js';
import socialGraphRouter from './api/socialGraph.routes.js';
import roomTagsRouter from './api/roomTags.routes.js';
import roomChallengesRouter from './api/roomChallenges.routes.js';
import roomLeaderboardsRouter from './api/roomLeaderboards.routes.js';
import agentSkillsRouter from './api/agentSkills.routes.js';
import lotteryRouter from './api/lottery.routes.js';
import dailyCalendarRouter from './api/dailyCalendar.routes.js';
import bookmarksRouter from './api/bookmarks.routes.js';
import roomShopsRouter from './api/roomShops.routes.js';
import rpsRouter from './api/rps.routes.js';
import agentProfilesRouter from './api/agentProfiles.routes.js';
import whispersRouter from './api/whispers.routes.js';
import treasureHuntRouter from './api/treasureHunt.routes.js';
import diceRouter from './api/dice.routes.js';
import roomThemesRouter from './api/roomThemes.routes.js';
import tradingCardsRouter from './api/tradingCards.routes.js';
import triviaRouter from './api/trivia.routes.js';
import donationsRouter from './api/donations.routes.js';
import wardrobeRouter from './api/wardrobe.routes.js';
import visitorLogRouter from './api/visitorLog.routes.js';
import soundboardRouter from './api/soundboard.routes.js';
import fortunesRouter from './api/fortunes.routes.js';
import timeCapsulesRouter from './api/timeCapsules.routes.js';
import karmaRouter from './api/karma.routes.js';
import weatherMachineRouter from './api/weatherMachine.routes.js';
import mentorshipRouter from './api/mentorship.routes.js';
import wishlistsRouter from './api/wishlists.routes.js';
import guestbookRouter from './api/guestbook.routes.js';
import ttsRouter from './api/tts.routes.js';
import roomScriptsRouter from './api/roomScripts.routes.js';
import analyticsRouter from './api/analytics.routes.js';
import simulateRouter from './api/simulate.routes.js';
import { resourceMonitorRouter } from './monitoring/resourceMonitor.js';
import { config } from './config.js';
import { getMetrics, getHistoricalMetrics } from './services/metrics.js';
import { logger } from './utils/logger.js';
import { setupWebSocket } from './ws/handler.js';
import { setupSpectatorWebSocket } from './ws/spectator.js';
import { initializeBotManager, tickBots } from './services/botManager.js';
import { sql } from './db/index.js';

const app = express();

app.use(express.json());

// Serve static files from client directory
// HTML files: no-cache (always fresh), JS/CSS/assets: 1 year (immutable)
app.use(express.static(join(import.meta.dirname, '..', 'client'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      // HTML must always be re-validated (content changes)
      res.setHeader('Cache-Control', 'no-cache');
    } else if (filePath.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/)) {
      // Static assets: cache aggressively (1 year)
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));
// Serve static assets (sprites, etc.) with aggressive caching
app.use('/assets', express.static(join(import.meta.dirname, '..', 'public/assets'), {
  maxAge: '1y',
  immutable: true,
}));

// === PUBLIC ROUTES (no auth required) ===
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/ready', async (_req, res) => {
  try {
    // Check database connection
    await sql`SELECT 1`;
    res.json({
      status: 'ready',
      database: 'connected',
    });
  } catch (error) {
    logger.error('Readiness check failed', { error });
    res.status(503).json({
      status: 'not ready',
      database: 'disconnected',
    });
  }
});

app.get('/metrics', (_req, res) => {
  res.json(getMetrics());
});

app.get('/metrics/history', (_req, res) => {
  res.json(getHistoricalMetrics());
});

// Feedback endpoint
app.post('/api/feedback', async (req, res) => {
  try {
    const { feedback, room, roomId, userAgent, timestamp, path, referrer } = req.body;

    if (!feedback || typeof feedback !== 'string') {
      return res.status(400).json({ error: 'Invalid feedback' });
    }

    // Ensure data directory exists
    const dataDir = join(import.meta.dirname, '..', 'data');
    if (!existsSync(dataDir)) {
      await mkdir(dataDir, { recursive: true });
    }

    // Append feedback to JSONL file
    const feedbackPath = join(dataDir, 'feedback.jsonl');
    const feedbackEntry = JSON.stringify({
      feedback: feedback.substring(0, 1000), // Limit length
      room: room || 'unknown',
      roomId: roomId || null,
      userAgent: userAgent || 'unknown',
      timestamp: timestamp || new Date().toISOString(),
      path: path || '/spectate',
      referrer: referrer || null,
    }) + '\n';

    await appendFile(feedbackPath, feedbackEntry, 'utf8');
    logger.info('Feedback received', { room, length: feedback.length });

    res.json({ success: true, message: 'Feedback received' });
  } catch (error) {
    logger.error('Feedback error', { error });
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// Analytics pageview endpoint
app.post('/api/analytics/pageview', async (req, res) => {
  try {
    const { path, referrer, userAgent, timestamp, viewport } = req.body;

    // Ensure data directory exists
    const dataDir = join(import.meta.dirname, '..', 'data');
    if (!existsSync(dataDir)) {
      await mkdir(dataDir, { recursive: true });
    }

    // Append analytics to JSONL file
    const analyticsPath = join(dataDir, 'analytics.jsonl');
    const analyticsEntry = JSON.stringify({
      path: path || '/spectate',
      referrer: referrer || null,
      userAgent: userAgent || 'unknown',
      timestamp: timestamp || new Date().toISOString(),
      viewport: viewport || null,
    }) + '\n';

    await appendFile(analyticsPath, analyticsEntry, 'utf8');

    res.json({ success: true });
  } catch (error) {
    logger.error('Analytics error', { error });
    // Don't fail the request - analytics should be non-blocking
    res.json({ success: true });
  }
});

// Serve static HTML pages
app.get('/', (_req, res) => {
  res.type('html').send(readFileSync(join(import.meta.dirname, '..', 'client', 'landing.html'), 'utf8'));
});

app.get('/spectate', (_req, res) => {
  res.type('html').send(readFileSync(join(import.meta.dirname, '..', 'client', 'spectate.html'), 'utf8'));
});

app.get('/directory', (_req, res) => {
  res.type('html').send(readFileSync(join(import.meta.dirname, '..', 'client', 'directory.html'), 'utf8'));
});

app.get('/admin', (_req, res) => {
  res.type('html').send(readFileSync(join(import.meta.dirname, '..', 'client', 'admin.html'), 'utf8'));
});

app.get('/monitoring', (_req, res) => {
  res.type('html').send(readFileSync(join(import.meta.dirname, '..', 'client', 'monitoring.html'), 'utf8'));
});

app.get('/api-docs', (_req, res) => {
  res.type('html').send(readFileSync(join(import.meta.dirname, '..', 'client', 'api-docs.html'), 'utf8'));
});

app.get('/leaderboard', (_req, res) => {
  res.type('html').send(readFileSync(join(import.meta.dirname, '..', 'client', 'leaderboard.html'), 'utf8'));
});

// Public API routes (no auth required)
app.use(resourceMonitorRouter);
app.use(spectatorRouter);
app.use(directoryRouter);
app.use(simulateRouter);
app.use(analyticsRouter); // Moved here: leaderboard is public for spectators
app.use(authRouter);
app.use(agentAuthRouter);
app.use(furnitureRouter);
app.use(roomsRouter);
app.use(tradesRouter);
app.use(friendsRouter);
app.use(relationshipsRouter);
app.use(profileRouter);
app.use(directMessagesRouter);
app.use(achievementsRouter);
app.use(notificationsRouter);
app.use(economyRouter);
app.use(economyDashboardRouter);
app.use(adminRouter);
app.use('/api/navigator', navigatorRouter);
app.use('/api/moderation', moderationToolsRouter);
app.use(gamesRouter);
app.use(botsRouter);
app.use(leaderboardRouter);
app.use(appearanceRouter);
app.use('/api/templates', roomTemplatesRouter);
app.use('/api/rooms', ratingRouter);
app.use(directoryRouter);
app.use('/api/inventory', inventoryRouter);
app.use(roomPermissionsRouter);
app.use('/api/marketplace', marketplaceRouter);
app.use(teleportRouter);
app.use(petsRouter);
app.use(agentStatusRouter);
app.use(agentSettingsRouter);
app.use(agentBiosRouter);
app.use(eventsRouter);
app.use(competitiveEventsRouter);
app.use(rollersRouter);
app.use(pollsRouter);
app.use(puzzlesRouter);
app.use(jukeboxRouter);
app.use(giftsRouter);
app.use(stackingRouter);
app.use(photosRouter);
app.use(activityLogRouter);
app.use(atmosphereRouter);
app.use(warpZonesRouter);
app.use(titlesRouter);
app.use(roomQueueRouter);
app.use(floorPatternsRouter);
app.use(wallItemsRouter);
app.use(guildsRouter);
app.use(alliancesRouter);
app.use(tradeHistoryRouter);
app.use(announcementsRouter);
app.use(roomAnalyticsRouter);
app.use(itemRarityRouter);
app.use(seasonsRouter);
app.use(reportsRouter);
app.use(mailRouter);
app.use(furniturePresetsRouter);
app.use(favoritesRouter);
app.use(chatHistoryRouter);
app.use(roomSearchRouter);
app.use(reputationRouter);
app.use(craftingRouter);
app.use(dailyChallengesRouter);
app.use(luckyWheelRouter);
app.use(auctionsRouter);
app.use(contestsRouter);
app.use(cardsRouter);
app.use(streaksRouter);
app.use(stickersRouter);
app.use(slotsRouter);
app.use(agentJournalRouter);
app.use(blackjackRouter);
app.use(connectFourRouter);
app.use(questsRouter);
app.use(achievementsV2Router);
app.use(roomSafetyRouter);
app.use('/api/agents', personalityRouter);
app.use(levelingRouter);
app.use(badgesRouter);
app.use(roomReviewsRouter);
app.use(roomPlaylistsRouter);
app.use(minimapRouter);
app.use(roomCalendarRouter);
app.use(roomCodesRouter);
app.use(emoteReactionsRouter);
app.use(socialGraphRouter);
app.use(roomTagsRouter);
app.use(roomChallengesRouter);
app.use(roomLeaderboardsRouter);
app.use(agentSkillsRouter);
app.use(lotteryRouter);
app.use(dailyCalendarRouter);
app.use(bookmarksRouter);
app.use(roomShopsRouter);
app.use(rpsRouter);
app.use(agentProfilesRouter);
app.use(whispersRouter);
app.use(treasureHuntRouter);
app.use(diceRouter);
app.use(roomThemesRouter);
app.use(tradingCardsRouter);
app.use(triviaRouter);
app.use(donationsRouter);
app.use(wardrobeRouter);
app.use(visitorLogRouter);
app.use(soundboardRouter);
app.use(fortunesRouter);
app.use(timeCapsulesRouter);
app.use(karmaRouter);
app.use(weatherMachineRouter);
app.use(mentorshipRouter);
app.use(wishlistsRouter);
app.use(guestbookRouter);
app.use(ttsRouter);
app.use(roomScriptsRouter);
app.use(analyticsRouter);
app.use(simulateRouter);

// (public routes moved to top of middleware chain)

// (spectate + directory routes moved to top)

const server = createServer(app);
setupWebSocket(server);
setupSpectatorWebSocket(server);

// Initialize bot manager
initializeBotManager(sql).catch((err) => {
  logger.error('Failed to initialize bot manager', { error: err });
});

// Tick bots every 5 seconds
setInterval(() => {
  tickBots(sql).catch((err) => {
    logger.error('Bot tick error', { error: err });
  });
}, 5000);

// Start room hopping service (agents explore rooms autonomously)
import * as roomHoppingService from './services/RoomHoppingService.js';
const ROOM_HOPPING_ENABLED = process.env.ROOM_HOPPING_ENABLED !== 'false';
const ROOM_HOPPING_INTERVAL_MS = parseInt(process.env.ROOM_HOPPING_INTERVAL_MS || '300000', 10); // Default: 5 minutes

if (ROOM_HOPPING_ENABLED) {
  roomHoppingService.startLoop(
    {
      enabled: true,
      intervalMs: ROOM_HOPPING_INTERVAL_MS,
      hopProbability: 0.3, // 30% chance per tick
      preferActiveRooms: true,
    },
    sql
  );
  logger.info('Room hopping service started', { intervalMs: ROOM_HOPPING_INTERVAL_MS });
}

// Start continuous simulation service (agents act autonomously)
import * as simulationService from './services/SimulationService.js';
import { broadcastToRoom } from './ws/handler.js';
const SIMULATION_ENABLED = process.env.SIMULATION_ENABLED !== 'false';
const SIMULATION_INTERVAL_MS = parseInt(process.env.SIMULATION_INTERVAL_MS || '60000', 10); // Default: 60 seconds
const SIMULATION_ACTION_PROBABILITY = parseFloat(process.env.SIMULATION_ACTION_PROBABILITY || '0.5'); // Default: 50%

if (SIMULATION_ENABLED) {
  // Ensure agents are placed in rooms on startup (cold start recovery)
  (async () => {
    try {
      const presenceCount = await sql`SELECT COUNT(*)::int AS cnt FROM presence`;
      if (presenceCount[0].cnt === 0) {
        logger.info('[ColdStart] No agents in rooms — seeding presence from DB agents...');
        const agents = await sql`SELECT id FROM agents LIMIT 10`;
        const rooms = await sql`SELECT id FROM rooms LIMIT 5`;
        if (agents.length > 0 && rooms.length > 0) {
          for (let i = 0; i < agents.length; i++) {
            const roomId = rooms[i % rooms.length].id;
            const x = 1 + Math.floor(Math.random() * 14);
            const y = 1 + Math.floor(Math.random() * 14);
            try {
              await sql`
                INSERT INTO presence (agent_id, room_id, x, y)
                VALUES (${agents[i].id}, ${roomId}, ${x}, ${y})
              `;
            } catch (e) { logger.error(`[ColdStart] Insert failed for agent ${agents[i].id} room ${roomId}:`, { error: String(e) }); }
          }
          logger.info(`[ColdStart] Placed ${agents.length} agents into ${rooms.length} rooms`);
        }
      }
    } catch (e) {
      logger.error('[ColdStart] Failed to seed presence:', { error: String(e) });
    }
  })();

  simulationService.startLoop(
    {
      enabled: true,
      tickIntervalMs: SIMULATION_INTERVAL_MS,
      actionProbability: SIMULATION_ACTION_PROBABILITY,
    },
    sql,
    broadcastToRoom
  );
  logger.info('Continuous simulation service started', {
    intervalMs: SIMULATION_INTERVAL_MS,
    actionProbability: SIMULATION_ACTION_PROBABILITY,
  });
}

// Simulation metrics endpoint
app.get('/api/simulation/metrics', (_req, res) => {
  const metrics = simulationService.getMetrics();
  res.json({
    success: true,
    data: metrics,
  });
});

// Broadcast analytics summary every 60 seconds
import { getAnalyticsSummary } from './services/analyticsService.js';
import { broadcastToSpectators } from './ws/spectator.js';

// ── Achievement WS broadcast ─────────────────────────────────────────────────
// When an achievement is awarded, find the agent's current room and broadcast
// agent.achievement to spectators watching that room.
import { achievementEvents } from './services/achievements.js';
achievementEvents.on('awarded', async (data: {
  agentId: string;
  achievement: { achievementId: string; name: string; description: string; icon: string; awardedAt: string };
}) => {
  try {
    const rows = await sql`
      SELECT room_id FROM presence WHERE agent_id = ${data.agentId} LIMIT 1
    `;
    if (rows.length > 0 && rows[0].room_id) {
      broadcastToSpectators(rows[0].room_id, {
        type: 'agent.achievement',
        agentId: data.agentId,
        achievement: data.achievement,
      });
    }
  } catch (err) {
    // Best-effort broadcast — don't crash
  }
});

setInterval(async () => {
  try {
    const summary = await getAnalyticsSummary(sql);
    
    // Broadcast to all connected spectators (broadcast to all rooms)
    const { spectatorsByRoom } = await import('./ws/spectator.js');
    for (const [roomId, spectators] of spectatorsByRoom.entries()) {
      if (spectators.size > 0) {
        for (const ws of spectators) {
          if (ws.readyState === 1) { // WebSocket.OPEN
            ws.send(JSON.stringify({
              type: 'analytics.update',
              summary,
            }));
          }
        }
      }
    }
  } catch (error) {
    logger.error('Analytics broadcast error', { error });
  }
}, 60000); // Every 60 seconds

server.listen(config.port, config.host, () => {
  logger.info('Server started', {
    host: config.host,
    port: config.port,
    url: `http://${config.host}:${config.port}`,
  });
});

export { app, server };
