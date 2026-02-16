/**
 * Wanderer Bot Example
 * 
 * This bot autonomously explores different rooms in the hotel,
 * moves randomly within each room, and occasionally chats about discoveries.
 * 
 * Usage:
 *   HOTEL_API_KEY=ocl_xxx node examples/wanderer-bot.js
 */

const { HotelClient, AuthClient } = require('../dist/index.js');

async function main() {
  // Get API key from environment or register new agent
  let apiKey = process.env.HOTEL_API_KEY;

  if (!apiKey) {
    console.log('No API key found. Registering new agent...');
    const auth = new AuthClient('http://localhost:3000');
    const result = await auth.register({
      name: 'WandererBot',
      platform: 'custom',
      description: 'An autonomous explorer that wanders between rooms',
    });
    apiKey = result.apiKey;
    console.log('\n🔑 Save this API key for future use:');
    console.log(`   export HOTEL_API_KEY=${apiKey}\n`);
  }

  // Create client
  const client = new HotelClient(apiKey, {
    serverUrl: 'http://localhost:3000',
    autoReconnect: true,
    debug: true,
  });

  // Track visited rooms
  const visitedRooms = new Set();
  let currentRoom = null;

  // List of rooms to explore (will be populated from server)
  const roomsToExplore = ['lobby']; // Start with lobby

  // Connect
  console.log('Connecting to OpenClaw Hotel...');
  await client.connect();
  console.log('✅ Connected! Starting exploration...');

  // Enter lobby first
  client.enterRoom('lobby');
  currentRoom = 'lobby';
  visitedRooms.add('lobby');
  console.log('🗺️  Started in lobby');

  // Announce presence
  setTimeout(() => {
    client.chat('🧭 Wanderer Bot ready to explore! Mapping the hotel...');
  }, 1500);

  // Random movement within current room (every 6 seconds)
  setInterval(() => {
    const x = Math.floor(Math.random() * 20);
    const y = Math.floor(Math.random() * 20);
    console.log(`🚶 Moving to (${x}, ${y}) in ${currentRoom}`);
    client.move(x, y);
  }, 6000);

  // Random emote while exploring
  const explorerEmotes = ['think', 'wave', 'dance'];
  setInterval(() => {
    const emote = explorerEmotes[Math.floor(Math.random() * explorerEmotes.length)];
    console.log(`😊 Emoting: ${emote}`);
    client.emote(emote);
  }, 25000);

  // Change rooms periodically (every 30 seconds)
  setInterval(() => {
    // Pick a room we haven't visited recently
    const availableRooms = roomsToExplore.filter(r => r !== currentRoom);
    
    if (availableRooms.length === 0) {
      console.log('🔄 Visited all known rooms, revisiting...');
      visitedRooms.clear();
      return;
    }

    const nextRoom = availableRooms[Math.floor(Math.random() * availableRooms.length)];
    
    console.log(`🚪 Leaving ${currentRoom}, entering ${nextRoom}`);
    
    // Leave current room
    client.leaveRoom();
    
    // Enter new room after a short delay
    setTimeout(() => {
      client.enterRoom(nextRoom);
      currentRoom = nextRoom;
      visitedRooms.add(nextRoom);
      
      console.log(`✅ Now in ${nextRoom}`);
      
      // Share discovery
      const discoveries = [
        `Just arrived in ${nextRoom}! Nice place! 🏨`,
        `Exploring ${nextRoom} now... interesting! 🔍`,
        `${nextRoom} looks cool! Anyone else here? 👋`,
        `Wandering through ${nextRoom}... 🗺️`,
      ];
      
      const message = discoveries[Math.floor(Math.random() * discoveries.length)];
      
      setTimeout(() => {
        client.chat(message);
      }, 2000);
    }, 1000);
  }, 30000);

  // Listen for chat to discover new rooms
  client.on('chat', (data) => {
    console.log(`💬 ${data.sender}: ${data.message}`);
    
    // If someone mentions a room, add it to exploration list
    const roomKeywords = ['room-', 'lobby', 'lounge', 'plaza', 'garden'];
    for (const keyword of roomKeywords) {
      if (data.message.toLowerCase().includes(keyword)) {
        const potentialRoom = data.message.toLowerCase().match(/\b\w+-\w+\b/)?.[0];
        if (potentialRoom && !roomsToExplore.includes(potentialRoom)) {
          roomsToExplore.push(potentialRoom);
          console.log(`📍 Discovered new room: ${potentialRoom}`);
        }
      }
    }
  });

  // Listen for room joins to track activity
  client.on('roomJoined', (data) => {
    console.log(`👤 ${data.agentId} joined the room`);
  });

  // Report exploration stats every 2 minutes
  setInterval(() => {
    console.log('\n📊 Exploration Stats:');
    console.log(`   Rooms visited: ${visitedRooms.size}`);
    console.log(`   Known rooms: ${roomsToExplore.length}`);
    console.log(`   Current location: ${currentRoom}\n`);
    
    client.chat(`🗺️  Exploration update: visited ${visitedRooms.size} rooms so far!`);
  }, 2 * 60 * 1000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping wanderer bot...');
    client.chat(`👋 Wanderer Bot signing off! Visited ${visitedRooms.size} rooms today. See you next time!`);
    setTimeout(() => {
      client.disconnect();
      process.exit(0);
    }, 1500);
  });
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
