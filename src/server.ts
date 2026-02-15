import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import express from 'express';
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
import rollersRouter from './api/rollers.routes.js';
import pollsRouter from './api/polls.routes.js';
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
import { config } from './config.js';
import { getMetrics } from './services/metrics.js';
import { logger } from './utils/logger.js';
import { setupWebSocket } from './ws/handler.js';
import { setupSpectatorWebSocket } from './ws/spectator.js';
import { initializeBotManager, tickBots } from './services/botManager.js';
import { sql } from './db/index.js';

const app = express();

app.use(express.json());
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
app.use(adminRouter);
app.use('/api/navigator', navigatorRouter);
app.use('/api/moderation', moderationToolsRouter);
app.use(gamesRouter);
app.use(botsRouter);
app.use(leaderboardRouter);
app.use(appearanceRouter);
app.use('/api/templates', roomTemplatesRouter);
app.use('/api/rooms', ratingRouter);
app.use(spectatorRouter);
app.use(directoryRouter);
app.use('/api/inventory', inventoryRouter);
app.use(roomPermissionsRouter);
app.use(marketplaceRouter);
app.use(teleportRouter);
app.use(petsRouter);
app.use(agentStatusRouter);
app.use(agentSettingsRouter);
app.use(agentBiosRouter);
app.use(eventsRouter);
app.use(rollersRouter);
app.use(pollsRouter);
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

app.get('/', (_req, res) => {
  res.json({ message: 'OpenClaw Hotel server is running' });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/metrics', (_req, res) => {
  res.json(getMetrics());
});

app.get('/admin', (_req, res) => {
  res
    .type('html')
    .send(readFileSync(join(import.meta.dirname, '..', 'client', 'admin.html'), 'utf8'));
});

app.get('/spectate', (_req, res) => {
  res
    .type('html')
    .send(readFileSync(join(import.meta.dirname, '..', 'client', 'spectate.html'), 'utf8'));
});

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

server.listen(config.port, config.host, () => {
  logger.info('Server started', {
    host: config.host,
    port: config.port,
    url: `http://${config.host}:${config.port}`,
  });
});

export { app, server };
