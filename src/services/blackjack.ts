/**
 * Blackjack Service - Agent card game against the house
 */

export type Card = {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
};

export type BlackjackGame = {
  id: number;
  agentId: string;
  bet: number;
  playerHand: Card[];
  dealerHand: Card[];
  deck: Card[];
  status: 'playing' | 'player_bust' | 'dealer_bust' | 'player_win' | 'dealer_win' | 'push' | 'blackjack';
  payout: number;
  createdAt: Date;
};

export type BlackjackStats = {
  agentId: string;
  gamesPlayed: number;
  gamesWon: number;
  totalWagered: number;
  totalWon: number;
  blackjacks: number;
  biggestWin: number;
};

/** Create a shuffled deck of 52 cards */
export function createDeck(): Card[] {
  const suits: Card['suit'][] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks: Card['rank'][] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck: Card[] = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }

  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

/** Calculate hand value with ace logic (ace = 1 or 11) */
export function calculateHandValue(hand: Card[]): number {
  let value = 0;
  let aces = 0;

  for (const card of hand) {
    if (card.rank === 'A') {
      aces++;
      value += 11;
    } else if (['J', 'Q', 'K'].includes(card.rank)) {
      value += 10;
    } else {
      value += parseInt(card.rank);
    }
  }

  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }

  return value;
}

/** Start a new blackjack game */
export async function newGame(agentId: string, bet: number, sql: any): Promise<BlackjackGame> {
  if (bet < 1) throw new Error('Bet must be at least 1 coin');

  const balance = await sql`SELECT coins FROM agent_balances WHERE agent_id = ${agentId}`;
  if (balance.length === 0 || balance[0].coins < bet) throw new Error('Insufficient balance');

  await sql`UPDATE agent_balances SET coins = coins - ${bet} WHERE agent_id = ${agentId}`;

  const deck = createDeck();
  const playerHand = [deck.pop()!, deck.pop()!];
  const dealerHand = [deck.pop()!, deck.pop()!];

  const playerValue = calculateHandValue(playerHand);
  const dealerValue = calculateHandValue(dealerHand);

  let status: BlackjackGame['status'] = 'playing';
  let payout = 0;

  if (playerValue === 21 && playerHand.length === 2) {
    if (dealerValue === 21 && dealerHand.length === 2) {
      status = 'push';
      payout = bet;
    } else {
      status = 'blackjack';
      payout = Math.floor(bet * 2.5);
    }
    await sql`UPDATE agent_balances SET coins = coins + ${payout} WHERE agent_id = ${agentId}`;
  }

  const result = await sql`
    INSERT INTO blackjack_games (agent_id, bet, player_hand, dealer_hand, deck, status, payout)
    VALUES (${agentId}, ${bet}, ${JSON.stringify(playerHand)}, ${JSON.stringify(dealerHand)}, 
            ${JSON.stringify(deck)}, ${status}, ${payout})
    RETURNING id, agent_id AS "agentId", bet, player_hand AS "playerHand", 
              dealer_hand AS "dealerHand", deck, status, payout, created_at AS "createdAt"
  `;

  await updateStats(agentId, bet, payout, status, sql);
  return parseGame(result[0]);
}

/** Hit - draw another card */
export async function hit(gameId: number, sql: any): Promise<BlackjackGame> {
  const game = await getGame(gameId, sql);
  if (game.status !== 'playing') throw new Error('Game already finished');

  const deck = game.deck;
  const playerHand = [...game.playerHand, deck.pop()!];
  const playerValue = calculateHandValue(playerHand);

  const status = playerValue > 21 ? 'player_bust' : 'playing';
  const payout = 0;

  const result = await sql`
    UPDATE blackjack_games 
    SET player_hand = ${JSON.stringify(playerHand)}, deck = ${JSON.stringify(deck)}, 
        status = ${status}, payout = ${payout}
    WHERE id = ${gameId}
    RETURNING id, agent_id AS "agentId", bet, player_hand AS "playerHand",
              dealer_hand AS "dealerHand", deck, status, payout, created_at AS "createdAt"
  `;

  if (status === 'player_bust') await updateStats(game.agentId, 0, 0, status, sql);

  return parseGame(result[0]);
}

/** Stand - dealer plays, determine winner */
export async function stand(gameId: number, sql: any): Promise<BlackjackGame> {
  const game = await getGame(gameId, sql);
  if (game.status !== 'playing') throw new Error('Game already finished');

  let deck = game.deck;
  let dealerHand = game.dealerHand;
  const playerValue = calculateHandValue(game.playerHand);

  while (calculateHandValue(dealerHand) < 17) {
    dealerHand = [...dealerHand, deck.pop()!];
  }

  const dealerValue = calculateHandValue(dealerHand);
  let status: BlackjackGame['status'];
  let payout = 0;

  if (dealerValue > 21) {
    status = 'dealer_bust';
    payout = game.bet * 2;
  } else if (playerValue > dealerValue) {
    status = 'player_win';
    payout = game.bet * 2;
  } else if (dealerValue > playerValue) {
    status = 'dealer_win';
  } else {
    status = 'push';
    payout = game.bet;
  }

  if (payout > 0) await sql`UPDATE agent_balances SET coins = coins + ${payout} WHERE agent_id = ${game.agentId}`;

  const result = await sql`
    UPDATE blackjack_games
    SET dealer_hand = ${JSON.stringify(dealerHand)}, deck = ${JSON.stringify(deck)},
        status = ${status}, payout = ${payout}
    WHERE id = ${gameId}
    RETURNING id, agent_id AS "agentId", bet, player_hand AS "playerHand",
              dealer_hand AS "dealerHand", deck, status, payout, created_at AS "createdAt"
  `;

  await updateStats(game.agentId, 0, payout, status, sql);
  return parseGame(result[0]);
}

/** Get game by ID */
export async function getGame(gameId: number, sql: any): Promise<BlackjackGame> {
  const result = await sql`
    SELECT id, agent_id AS "agentId", bet, player_hand AS "playerHand",
           dealer_hand AS "dealerHand", deck, status, payout, created_at AS "createdAt"
    FROM blackjack_games WHERE id = ${gameId}
  `;
  if (result.length === 0) throw new Error('Game not found');
  return parseGame(result[0]);
}

/** Get agent stats */
export async function getStats(agentId: string, sql: any): Promise<BlackjackStats> {
  const result = await sql`
    SELECT agent_id AS "agentId", games_played AS "gamesPlayed", games_won AS "gamesWon",
           total_wagered AS "totalWagered", total_won AS "totalWon", blackjacks, biggest_win AS "biggestWin"
    FROM blackjack_stats WHERE agent_id = ${agentId}
  `;
  return result.length === 0
    ? { agentId, gamesPlayed: 0, gamesWon: 0, totalWagered: 0, totalWon: 0, blackjacks: 0, biggestWin: 0 }
    : result[0];
}

// Helper functions
function parseGame(row: any): BlackjackGame {
  return {
    ...row,
    playerHand: JSON.parse(row.playerHand),
    dealerHand: JSON.parse(row.dealerHand),
    deck: JSON.parse(row.deck),
  };
}

async function updateStats(agentId: string, wager: number, won: number, status: string, sql: any) {
  const isWin = ['dealer_bust', 'player_win', 'blackjack'].includes(status);
  const isBlackjack = status === 'blackjack';
  await sql`
    INSERT INTO blackjack_stats (agent_id, games_played, games_won, total_wagered, total_won, blackjacks, biggest_win)
    VALUES (${agentId}, 1, ${isWin ? 1 : 0}, ${wager}, ${won}, ${isBlackjack ? 1 : 0}, ${won})
    ON CONFLICT (agent_id) DO UPDATE SET
      games_played = blackjack_stats.games_played + 1,
      games_won = blackjack_stats.games_won + ${isWin ? 1 : 0},
      total_wagered = blackjack_stats.total_wagered + ${wager},
      total_won = blackjack_stats.total_won + ${won},
      blackjacks = blackjack_stats.blackjacks + ${isBlackjack ? 1 : 0},
      biggest_win = GREATEST(blackjack_stats.biggest_win, ${won})
  `;
}
