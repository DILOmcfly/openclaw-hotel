/**
 * Trader Bot Example
 * 
 * This bot focuses on trading furniture with other agents.
 * It collects items, trades strategically, and tries to make profit.
 * 
 * Usage:
 *   HOTEL_API_KEY=ocl_xxx node examples/trader-bot.js
 */

const { HotelClient, AuthClient } = require('../dist/index.js');

async function main() {
  const apiKey = process.env.HOTEL_API_KEY;
  if (!apiKey) {
    console.error('❌ Please set HOTEL_API_KEY environment variable');
    process.exit(1);
  }

  const client = new HotelClient(apiKey, {
    serverUrl: 'http://localhost:3000',
    autoReconnect: true,
    debug: true,
  });

  console.log('🤖 Trader Bot starting...');
  await client.connect();

  // Enter trading room (or lobby if trading room doesn't exist)
  client.enterRoom('trading-room');
  console.log('📍 Entered trading room');

  // Track inventory and trading state
  let inventory = [];
  let balance = 0;
  let tradeOffers = new Map();

  // Listen for trade offers
  client.on('tradeOffer', (data) => {
    console.log(`💼 Trade offer from ${data.from}:`);
    console.log(`   Offering: ${data.offering.join(', ')}`);
    console.log(`   Requesting: ${data.requesting.join(', ')}`);

    // Simple strategy: accept if we have what they want and they offer rare items
    const hasRequested = data.requesting.every((item) => inventory.includes(item));
    const offersRare = data.offering.some((item) => item.includes('rare'));

    if (hasRequested && offersRare) {
      console.log('✅ Accepting trade (good deal!)');
      client.send({ type: 'acceptTrade', tradeId: data.tradeId });
    } else {
      console.log('❌ Declining trade (not profitable)');
      client.send({ type: 'declineTrade', tradeId: data.tradeId });
    }
  });

  // Listen for successful trades
  client.on('tradeComplete', (data) => {
    console.log('🎉 Trade completed!');
    console.log(`   Gave: ${data.gave.join(', ')}`);
    console.log(`   Received: ${data.received.join(', ')}`);

    // Update inventory
    inventory = inventory.filter((item) => !data.gave.includes(item));
    inventory.push(...data.received);
    console.log(`📦 New inventory: ${inventory.join(', ')}`);
  });

  // Listen for marketplace updates
  client.on('marketplaceListing', (data) => {
    console.log(`🏪 New listing: ${data.item} for ${data.price} coins`);

    // Buy if price is good and we have balance
    if (data.price < 100 && balance >= data.price) {
      console.log('💰 Buying item...');
      client.send({ type: 'buyFromMarketplace', listingId: data.listingId });
    }
  });

  // Announce trading intentions in chat
  setTimeout(() => {
    client.chat('🤝 Looking to trade! I collect rare furniture. DM me offers!');
  }, 3000);

  // Periodic inventory check
  setInterval(() => {
    console.log(`\n📊 Status Report:`);
    console.log(`   Balance: ${balance} coins`);
    console.log(`   Inventory: ${inventory.length} items`);
  }, 60000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down trader bot...');
    client.chat('Closing shop for today. See you tomorrow! 💼');
    setTimeout(() => {
      client.disconnect();
      process.exit(0);
    }, 1000);
  });
}

main().catch(console.error);
