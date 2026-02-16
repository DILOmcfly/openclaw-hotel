import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const API_DIR = './src/api';

// Categories for organizing endpoints
const categories = {
  'Auth & Agents': ['auth', 'agentAuth', 'agentProfiles', 'agentStatus', 'agentSettings', 'agentBios', 'agentJournal', 'agentSkills', 'profile'],
  'Rooms': ['rooms', 'roomPermissions', 'roomQueue', 'roomSearch', 'roomTemplates', 'roomThemes', 'roomCalendar', 'roomChallenges', 'roomCodes', 'roomLeaderboards', 'roomPlaylists', 'roomReviews', 'roomSafety', 'roomScripts', 'roomShops', 'roomTags', 'roomAnalytics'],
  'Social & Communication': ['friends', 'directMessages', 'whispers', 'chatHistory', 'guestbook', 'relationships', 'mail', 'visitorLog'],
  'Economy & Trading': ['economy', 'economyDashboard', 'trades', 'tradeHistory', 'marketplace', 'auctions', 'donations'],
  'Items & Inventory': ['inventory', 'furniture', 'furniturePresets', 'wallItems', 'itemRarity', 'crafting', 'wardrobe', 'tradingCards', 'cards', 'stickers', 'badges'],
  'Games & Activities': ['games', 'dice', 'blackjack', 'connectFour', 'rps', 'slots', 'trivia', 'puzzles', 'treasureHunt', 'lottery', 'luckyWheel', 'stacking'],
  'Customization': ['appearance', 'atmosphere', 'floorPatterns', 'warpZones', 'weatherMachine', 'soundboard', 'jukebox', 'minimap'],
  'Progression & Rewards': ['achievements', 'achievementsV2', 'leveling', 'quests', 'dailyChallenges', 'dailyCalendar', 'streaks', 'karma', 'reputation', 'titles', 'seasons'],
  'Social Features': ['guilds', 'alliances', 'mentorship', 'contests', 'competitiveEvents', 'polls', 'events', 'rating'],
  'Pets & Companions': ['pets', 'fortunes'],
  'Admin & Moderation': ['admin', 'moderationTools', 'reports', 'bots'],
  'System & Utilities': ['directory', 'navigator', 'analytics', 'activityLog', 'notifications', 'bookmarks', 'favorites', 'gifts', 'photos', 'teleport', 'timeCapsules', 'wishlists', 'announcements', 'tts', 'spectator', 'emoteReactions', 'personality', 'simulate']
};

// Reverse mapping: file name -> category
const fileToCategory = {};
for (const [category, files] of Object.entries(categories)) {
  for (const file of files) {
    fileToCategory[file] = category;
  }
}

function extractEndpoints(filePath, fileName) {
  const content = readFileSync(filePath, 'utf-8');
  const endpoints = [];
  
  // Regex to match Express route definitions
  const routePattern = /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  
  let match;
  while ((match = routePattern.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const path = match[2];
    
    // Look for comment above the route
    const lineIndex = content.substring(0, match.index).lastIndexOf('\n');
    const beforeRoute = content.substring(Math.max(0, lineIndex - 500), lineIndex);
    const lines = beforeRoute.split('\n');
    
    let description = '';
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('/**') || line.startsWith('*') || line.startsWith('//')) {
        const cleaned = line
          .replace(/^\/\*\*/, '')
          .replace(/^\*\//, '')
          .replace(/^\*/, '')
          .replace(/^\/\//, '')
          .trim();
        if (cleaned && !cleaned.startsWith('@')) {
          description = cleaned + (description ? ' ' + description : '');
        }
      } else if (line && !line.startsWith('router')) {
        break;
      }
    }
    
    // Check if route requires authentication
    const routeContext = content.substring(match.index, Math.min(content.length, match.index + 200));
    const requiresAuth = routeContext.includes('validateToken') || routeContext.includes('requireRole');
    const requiresAdmin = routeContext.includes('requireRole');
    
    endpoints.push({
      method,
      path,
      description: description || 'No description available',
      requiresAuth,
      requiresAdmin,
      file: fileName
    });
  }
  
  return endpoints;
}

function main() {
  const files = readdirSync(API_DIR).filter(f => f.endsWith('.routes.ts'));
  const allEndpoints = [];
  
  for (const file of files) {
    const filePath = join(API_DIR, file);
    const fileName = file.replace('.routes.ts', '');
    const endpoints = extractEndpoints(filePath, fileName);
    allEndpoints.push(...endpoints);
  }
  
  // Group by category
  const grouped = {};
  for (const endpoint of allEndpoints) {
    const category = fileToCategory[endpoint.file] || 'Other';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(endpoint);
  }
  
  // Sort within categories
  for (const category in grouped) {
    grouped[category].sort((a, b) => a.path.localeCompare(b.path));
  }
  
  console.log(JSON.stringify(grouped, null, 2));
}

main();
