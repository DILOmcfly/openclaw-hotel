/**
 * Blackjack Service - Card Game Logic
 */

export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export type Card = {
  suit: Suit;
  rank: Rank;
};

export type BlackjackGameStatus = 'active' | 'player_won' | 'dealer_won' | 'push' | 'player_bust' | 'dealer_bust';

export type BlackjackGame = {
  id: string;
  roomId: string;
  playerId: string;
  playerHand: Card[];
  dealerHand: Card[];
  deck: Card[];
  status: BlackjackGameStatus;
  dealerHidden: boolean; // First card face down
  createdAt: Date;
  completedAt: Date | null;
};

// In-memory game storage
const games = new Map<string, BlackjackGame>();

/**
 * Generate unique game ID
 */
function generateGameId(): string {
  return `blackjack-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a shuffled deck of 52 cards
 */
function createDeck(): Card[] {
  const suits: Suit[] = ['♠', '♥', '♦', '♣'];
  const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck: Card[] = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }

  // Shuffle using Fisher-Yates
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

/**
 * Calculate hand value
 * Aces count as 11 unless that busts, then 1
 */
function calculateHandValue(hand: Card[]): number {
  let value = 0;
  let aces = 0;

  for (const card of hand) {
    if (card.rank === 'A') {
      aces++;
      value += 11;
    } else if (['J', 'Q', 'K'].includes(card.rank)) {
      value += 10;
    } else {
      value += parseInt(card.rank, 10);
    }
  }

  // Adjust for aces if bust
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }

  return value;
}

/**
 * Check if hand is a blackjack (21 with 2 cards)
 */
function isBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && calculateHandValue(hand) === 21;
}

/**
 * Create a new blackjack game
 */
export function createGame(roomId: string, playerId: string): BlackjackGame {
  const deck = createDeck();
  
  // Deal initial cards: player gets 2, dealer gets 2 (one hidden)
  const playerHand = [deck.pop()!, deck.pop()!];
  const dealerHand = [deck.pop()!, deck.pop()!];

  const game: BlackjackGame = {
    id: generateGameId(),
    roomId,
    playerId,
    playerHand,
    dealerHand,
    deck,
    status: 'active',
    dealerHidden: true,
    createdAt: new Date(),
    completedAt: null,
  };

  // Check for instant blackjack
  if (isBlackjack(playerHand)) {
    game.status = 'player_won';
    game.dealerHidden = false;
    game.completedAt = new Date();
  }

  games.set(game.id, game);
  return game;
}

/**
 * Player hits (draws a card)
 */
export function hit(gameId: string, playerId: string): BlackjackGame {
  const game = games.get(gameId);
  
  if (!game) {
    throw new Error('Game not found');
  }

  if (game.playerId !== playerId) {
    throw new Error('Not your game');
  }

  if (game.status !== 'active') {
    throw new Error('Game already completed');
  }

  // Draw card
  const card = game.deck.pop();
  if (!card) {
    throw new Error('Deck exhausted');
  }

  game.playerHand.push(card);

  // Check for bust
  const playerValue = calculateHandValue(game.playerHand);
  if (playerValue > 21) {
    game.status = 'player_bust';
    game.dealerHidden = false;
    game.completedAt = new Date();
  }

  return game;
}

/**
 * Player stands (dealer plays)
 */
export function stand(gameId: string, playerId: string): BlackjackGame {
  const game = games.get(gameId);
  
  if (!game) {
    throw new Error('Game not found');
  }

  if (game.playerId !== playerId) {
    throw new Error('Not your game');
  }

  if (game.status !== 'active') {
    throw new Error('Game already completed');
  }

  // Reveal dealer's hidden card
  game.dealerHidden = false;

  // Dealer hits until 17 or higher
  let dealerValue = calculateHandValue(game.dealerHand);
  while (dealerValue < 17) {
    const card = game.deck.pop();
    if (!card) {
      throw new Error('Deck exhausted');
    }
    game.dealerHand.push(card);
    dealerValue = calculateHandValue(game.dealerHand);
  }

  // Determine winner
  const playerValue = calculateHandValue(game.playerHand);

  if (dealerValue > 21) {
    game.status = 'dealer_bust';
  } else if (playerValue > dealerValue) {
    game.status = 'player_won';
  } else if (dealerValue > playerValue) {
    game.status = 'dealer_won';
  } else {
    game.status = 'push';
  }

  game.completedAt = new Date();
  return game;
}

/**
 * Get game state
 */
export function getGameState(gameId: string): BlackjackGame {
  const game = games.get(gameId);
  
  if (!game) {
    throw new Error('Game not found');
  }

  return game;
}

/**
 * Get player's hand value
 */
export function getPlayerValue(gameId: string): number {
  const game = games.get(gameId);
  if (!game) {
    throw new Error('Game not found');
  }
  return calculateHandValue(game.playerHand);
}

/**
 * Get dealer's hand value
 */
export function getDealerValue(gameId: string): number {
  const game = games.get(gameId);
  if (!game) {
    throw new Error('Game not found');
  }
  return calculateHandValue(game.dealerHand);
}
export function clearBlackjackGames() { games.clear(); }
