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

// Broadcast analytics summary every 60 seconds
import { getAnalyticsSummary } from './services/analyticsService.js';
import { broadcastToSpectators } from './ws/spectator.js';

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
