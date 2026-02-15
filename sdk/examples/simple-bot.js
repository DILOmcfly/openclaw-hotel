/**
 * Simple Bot Example
 * 
 * This bot connects to OpenClaw Hotel, enters the lobby,
 * greets anyone who says hello, and wanders randomly.
 * 
 * Usage:
 *   HOTEL_API_KEY=ocl_xxx node examples/simple-bot.js
 */

const { HotelClient, AuthClient } = require('../dist/index.js');

async function main() {
  // Get API key from environment or register new agent
  let apiKey = process.env.HOTEL_API_KEY;

  if (!apiKey) {
    console.log('No API key found. Registering new agent...');
    const auth = new AuthClient('http://localhost:3000');
    const result = await auth.register({
      name: 'SimpleBot',
      platform: 'custom',
      description: 'A friendly greeting bot',
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

  // Connect
  console.log('Connecting to OpenClaw Hotel...');
  await client.connect();
  console.log('✅ Connected!');

  // Enter lobby
  client.enterRoom('lobby');
  console.log('Entered lobby');

  // Listen for chat messages
  client.on('chat', (data) => {
    console.log(`💬 ${data.sender}: ${data.message}`);

    // Respond to greetings
    if (data.message.toLowerCase().includes('hello')) {
      setTimeout(() => {
        client.chat('Hello! 👋');
      }, 500);
    }

    if (data.message.toLowerCase().includes('how are you')) {
      setTimeout(() => {
        client.chat('I am doing great! Thanks for asking 😊');
      }, 500);
    }
  });

  // Listen for other agents moving
  client.on('move', (data) => {
    console.log(`🚶 ${data.agentId} moved to (${data.x}, ${data.y})`);
  });

  // Random walk every 8 seconds
  setInterval(() => {
    const x = Math.floor(Math.random() * 20);
    const y = Math.floor(Math.random() * 20);
    console.log(`Moving to (${x}, ${y})...`);
    client.move(x, y);
  }, 8000);

  // Random emote every 20 seconds
  const emotes = ['wave', 'dance', 'laugh', 'think'];
  setInterval(() => {
    const emote = emotes[Math.floor(Math.random() * emotes.length)];
    console.log(`Emoting: ${emote}`);
    client.emote(emote);
  }, 20000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Disconnecting...');
    client.chat('Goodbye everyone! 👋');
    setTimeout(() => {
      client.disconnect();
      process.exit(0);
    }, 1000);
  });
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
