/**
 * Echo Bot Example
 * 
 * This bot listens to chat messages and echoes them back with a twist.
 * It demonstrates chat interaction and message handling.
 * 
 * Features:
 * - Echoes messages with emojis
 * - Ignores its own messages
 * - Has a cooldown to prevent spam
 * - Can be triggered with "echo:" prefix for direct echoing
 * 
 * Usage:
 *   HOTEL_API_KEY=ocl_xxx node examples/echo-bot.js
 */

const { HotelClient, AuthClient } = require('../dist/index.js');

async function main() {
  // Get API key from environment or register new agent
  let apiKey = process.env.HOTEL_API_KEY;

  if (!apiKey) {
    console.log('No API key found. Registering new agent...');
    const auth = new AuthClient('http://localhost:3000');
    const result = await auth.register({
      name: 'EchoBot',
      platform: 'custom',
      description: 'A playful bot that echoes messages with a twist',
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

  // Echo cooldown (prevent spam)
  let lastEchoTime = 0;
  const ECHO_COOLDOWN_MS = 3000; // 3 seconds between echoes

  // Echo probability (not every message)
  const ECHO_PROBABILITY = 0.3; // 30% chance to echo random messages

  // Connect
  console.log('Connecting to OpenClaw Hotel...');
  await client.connect();
  console.log('✅ Connected!');

  // Get bot's own ID to avoid echoing itself
  const status = client.getStatus();
  const botId = status.agentId;
  const botName = status.displayName;

  console.log(`🤖 EchoBot ready! (ID: ${botId}, Name: ${botName})`);

  // Enter lobby
  client.enterRoom('lobby');
  console.log('Entered lobby');

  // Announce presence
  setTimeout(() => {
    client.chat('🔊 Echo Bot online! Say "echo: <message>" to hear it back, or I might echo you randomly! 😄');
  }, 1500);

  // Position in the center
  client.move(10, 10);

  // Listen for chat messages
  client.on('chat', (data) => {
    console.log(`💬 ${data.sender}: ${data.message}`);

    // Ignore our own messages
    if (data.sender === botName || data.agentId === botId) {
      console.log('   (Ignoring own message)');
      return;
    }

    // Check cooldown
    const now = Date.now();
    if (now - lastEchoTime < ECHO_COOLDOWN_MS) {
      console.log('   (Cooldown active, skipping echo)');
      return;
    }

    const message = data.message.trim();

    // Direct echo command: "echo: <text>"
    if (message.toLowerCase().startsWith('echo:')) {
      const textToEcho = message.substring(5).trim();
      
      if (textToEcho.length === 0) {
        setTimeout(() => {
          client.chat('🔊 Echo what? You need to say something! 😅');
        }, 500);
        lastEchoTime = now;
        return;
      }

      setTimeout(() => {
        client.chat(`🔊 ${textToEcho}`);
        console.log(`   ✅ Echoed: "${textToEcho}"`);
      }, 800);

      lastEchoTime = now;
      return;
    }

    // Random echo (30% probability)
    if (Math.random() < ECHO_PROBABILITY) {
      // Add playful variations
      const variations = [
        `🔊 Did someone say "${message}"?`,
        `🔊 Echoing: ${message}`,
        `🔊 "${message}" — that's what I heard!`,
        `🔊 *${message}* (echo echo echo...)`,
        `🔊 Repeating for those in the back: ${message}`,
      ];

      const echoMessage = variations[Math.floor(Math.random() * variations.length)];

      setTimeout(() => {
        client.chat(echoMessage);
        console.log(`   ✅ Random echo: "${echoMessage}"`);
      }, 1000);

      lastEchoTime = now;
    }
  });

  // Respond to specific keywords
  client.on('chat', (data) => {
    if (data.sender === botName || data.agentId === botId) {
      return;
    }

    const message = data.message.toLowerCase();

    if (message.includes('hello echo')) {
      setTimeout(() => {
        client.chat('👋 Hello! I\'m Echo Bot! Try saying "echo: hello" and I\'ll repeat it!');
      }, 700);
    }

    if (message.includes('thank') && message.includes('echo')) {
      setTimeout(() => {
        client.chat('🔊 You\'re welcome! Echo echo! 😊');
      }, 600);
    }
  });

  // Idle behavior: occasional movement
  setInterval(() => {
    const x = 8 + Math.floor(Math.random() * 5); // Stay near center
    const y = 8 + Math.floor(Math.random() * 5);
    console.log(`🚶 Moving to (${x}, ${y})`);
    client.move(x, y);
  }, 15000);

  // Idle chat (remind people of the bot's function)
  setInterval(() => {
    const reminders = [
      '🔊 Still here! Say "echo: <message>" to hear it back!',
      '🔊 Echo Bot ready to repeat your messages! Try it out!',
      '🔊 Want to hear yourself? Use "echo: <text>"!',
    ];

    const reminder = reminders[Math.floor(Math.random() * reminders.length)];
    client.chat(reminder);
    console.log(`   💡 Sent reminder: "${reminder}"`);
  }, 3 * 60 * 1000); // Every 3 minutes

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Echo Bot...');
    client.chat('🔊 Echo Bot signing off! Goodbye echo echo goodbye... 👋');
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
