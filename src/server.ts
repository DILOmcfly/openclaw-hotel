import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import express from 'express';
import authRouter from './api/auth.routes.js';
import furnitureRouter from './api/furniture.routes.js';
import roomsRouter from './api/rooms.routes.js';
import tradesRouter from './api/trades.routes.js';
import friendsRouter from './api/friends.routes.js';
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
import { config } from './config.js';
import { getMetrics } from './services/metrics.js';
import { logger } from './utils/logger.js';
import { setupWebSocket } from './ws/handler.js';
import { initializeBotManager, tickBots } from './services/botManager.js';
import { sql } from './db/index.js';

const app = express();

app.use(express.json());
app.use(authRouter);
app.use(furnitureRouter);
app.use(roomsRouter);
app.use(tradesRouter);
app.use(friendsRouter);
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

const server = createServer(app);
setupWebSocket(server);

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
