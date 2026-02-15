/**
 * GamePanel.ts
 * Mini-games interface for OpenClaw Hotel
 */

export type GameType = 'dice' | 'coinflip' | 'rps' | 'tictactoe';
export type GameStatus = 'waiting' | 'active' | 'completed';
export type TicTacToeCell = 'X' | 'O' | null;

export class GamePanel {
  private container!: HTMLElement;
  private currentGameId: string | null = null;
  private currentGameType: GameType | null = null;
  
  private onCreateGame?: (gameType: GameType) => void;
  private onJoinGame?: (gameId: string) => void;
  private onMakeMove?: (gameId: string, move: number | string) => void;

  constructor() {
    this.createUI();
  }

  private createUI(): void {
    const existing = document.getElementById('game-panel');
    if (existing) {
      existing.remove();
    }

    const container = document.createElement('div');
    container.id = 'game-panel';
    container.className = 'game-panel hidden';
    container.innerHTML = `
      <div class="panel-header">
        <h3>🎮 Mini-Games</h3>
        <button class="panel-close" id="game-panel-close">×</button>
      </div>
      
      <div class="game-content">
        <!-- Game Selection -->
        <div class="game-selection" id="game-selection">
          <h4>Choose a Game</h4>
          <div class="game-types">
            <button class="game-type-btn" data-game="dice">
              <span class="game-icon">🎲</span>
              <span class="game-name">Dice Roll</span>
            </button>
            <button class="game-type-btn" data-game="coinflip">
              <span class="game-icon">🪙</span>
              <span class="game-name">Coin Flip</span>
            </button>
            <button class="game-type-btn" data-game="rps">
              <span class="game-icon">✊</span>
              <span class="game-name">Rock Paper Scissors</span>
            </button>
            <button class="game-type-btn" data-game="tictactoe">
              <span class="game-icon">⭕</span>
              <span class="game-name">Tic-Tac-Toe</span>
            </button>
          </div>
        </div>

        <!-- Active Game View -->
        <div class="game-active hidden" id="game-active">
          <div class="game-info">
            <h4 id="game-title">Game</h4>
            <p id="game-status">Waiting...</p>
          </div>
          
          <!-- Dice Game -->
          <div class="game-controls dice-controls hidden" id="dice-controls">
            <button class="btn-primary game-action-btn" id="dice-roll-btn">
              🎲 Roll Dice
            </button>
            <div class="game-result hidden" id="dice-result">
              <div class="dice-animation" id="dice-animation">🎲</div>
              <p class="result-text" id="dice-result-text"></p>
            </div>
          </div>

          <!-- Coin Flip Game -->
          <div class="game-controls coin-controls hidden" id="coin-controls">
            <div class="coin-choices">
              <button class="btn-primary game-action-btn" data-choice="heads">
                🪙 Heads
              </button>
              <button class="btn-primary game-action-btn" data-choice="tails">
                🪙 Tails
              </button>
            </div>
            <div class="game-result hidden" id="coin-result">
              <div class="coin-animation" id="coin-animation">🪙</div>
              <p class="result-text" id="coin-result-text"></p>
            </div>
          </div>

          <!-- RPS Game -->
          <div class="game-controls rps-controls hidden" id="rps-controls">
            <div class="rps-choices">
              <button class="btn-primary game-action-btn" data-choice="rock">
                ✊ Rock
              </button>
              <button class="btn-primary game-action-btn" data-choice="paper">
                ✋ Paper
              </button>
              <button class="btn-primary game-action-btn" data-choice="scissors">
                ✌️ Scissors
              </button>
            </div>
            <div class="game-result hidden" id="rps-result">
              <div class="rps-animation">
                <span id="my-choice">?</span>
                <span class="vs-text">VS</span>
                <span id="opponent-choice">?</span>
              </div>
              <p class="result-text" id="rps-result-text"></p>
            </div>
          </div>

          <!-- Tic-Tac-Toe Game -->
          <div class="game-controls tictactoe-controls hidden" id="tictactoe-controls">
            <p class="turn-indicator" id="tictactoe-turn">Waiting for opponent...</p>
            <div class="tictactoe-grid" id="tictactoe-grid">
              <button class="tictactoe-cell" data-cell="0"></button>
              <button class="tictactoe-cell" data-cell="1"></button>
              <button class="tictactoe-cell" data-cell="2"></button>
              <button class="tictactoe-cell" data-cell="3"></button>
              <button class="tictactoe-cell" data-cell="4"></button>
              <button class="tictactoe-cell" data-cell="5"></button>
              <button class="tictactoe-cell" data-cell="6"></button>
              <button class="tictactoe-cell" data-cell="7"></button>
              <button class="tictactoe-cell" data-cell="8"></button>
            </div>
            <div class="game-result hidden" id="tictactoe-result">
              <p class="result-text" id="tictactoe-result-text"></p>
            </div>
          </div>

          <button class="btn-secondary" id="game-back-btn">Back to Menu</button>
        </div>
      </div>
    `;

    document.body.appendChild(container);
    this.container = container;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    // Close button
    const closeBtn = document.getElementById('game-panel-close');
    closeBtn?.addEventListener('click', () => this.hide());

    // Game type selection
    const gameTypeBtns = document.querySelectorAll('.game-type-btn');
    gameTypeBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const gameType = (e.currentTarget as HTMLElement).dataset.game as GameType;
        this.createGame(gameType);
      });
    });

    // Dice roll
    const diceRollBtn = document.getElementById('dice-roll-btn');
    diceRollBtn?.addEventListener('click', () => {
      if (this.currentGameId) {
        this.playDiceRoll();
      }
    });

    // Coin flip choices
    const coinBtns = document.querySelectorAll('#coin-controls .game-action-btn');
    coinBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const choice = (e.currentTarget as HTMLElement).dataset.choice as string;
        if (this.currentGameId) {
          this.playCoinFlip(choice);
        }
      });
    });

    // RPS choices
    const rpsBtns = document.querySelectorAll('#rps-controls .game-action-btn');
    rpsBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const choice = (e.currentTarget as HTMLElement).dataset.choice as string;
        if (this.currentGameId) {
          this.playRPS(choice);
        }
      });
    });

    // Tic-Tac-Toe cells
    const tictactoeCells = document.querySelectorAll('.tictactoe-cell');
    tictactoeCells.forEach((cell) => {
      cell.addEventListener('click', (e) => {
        const cellIndex = parseInt((e.currentTarget as HTMLElement).dataset.cell as string, 10);
        if (this.currentGameId) {
          this.playTicTacToe(cellIndex);
        }
      });
    });

    // Back button
    const backBtn = document.getElementById('game-back-btn');
    backBtn?.addEventListener('click', () => {
      this.resetToSelection();
    });
  }

  private createGame(gameType: GameType): void {
    this.currentGameType = gameType;
    this.onCreateGame?.(gameType);
  }

  private playDiceRoll(): void {
    if (this.currentGameId) {
      // Trigger move (auto-roll)
      this.onMakeMove?.(this.currentGameId, 1);
    }
  }

  private playCoinFlip(choice: string): void {
    if (this.currentGameId) {
      this.onMakeMove?.(this.currentGameId, choice);
    }
  }

  private playRPS(choice: string): void {
    if (this.currentGameId) {
      // Show my choice immediately
      const myChoiceEl = document.getElementById('my-choice');
      if (myChoiceEl) {
        const emoji = choice === 'rock' ? '✊' : choice === 'paper' ? '✋' : '✌️';
        myChoiceEl.textContent = emoji;
      }

      this.onMakeMove?.(this.currentGameId, choice);
    }
  }

  private playTicTacToe(cellIndex: number): void {
    if (this.currentGameId) {
      this.onMakeMove?.(this.currentGameId, cellIndex);
    }
  }

  private resetToSelection(): void {
    this.currentGameId = null;
    this.currentGameType = null;

    document.getElementById('game-selection')?.classList.remove('hidden');
    document.getElementById('game-active')?.classList.add('hidden');

    // Hide all game controls
    document.getElementById('dice-controls')?.classList.add('hidden');
    document.getElementById('coin-controls')?.classList.add('hidden');
    document.getElementById('rps-controls')?.classList.add('hidden');
    document.getElementById('tictactoe-controls')?.classList.add('hidden');

    // Hide all results
    document.getElementById('dice-result')?.classList.add('hidden');
    document.getElementById('coin-result')?.classList.add('hidden');
    document.getElementById('rps-result')?.classList.add('hidden');
    document.getElementById('tictactoe-result')?.classList.add('hidden');

    // Reset Tic-Tac-Toe board
    const cells = document.querySelectorAll('.tictactoe-cell');
    cells.forEach((cell) => {
      (cell as HTMLElement).textContent = '';
      (cell as HTMLElement).disabled = false;
    });
  }

  /**
   * Called when game is created
   */
  public gameCreated(gameId: string, gameType: GameType): void {
    this.currentGameId = gameId;
    this.currentGameType = gameType;

    // Switch to active game view
    document.getElementById('game-selection')?.classList.add('hidden');
    document.getElementById('game-active')?.classList.remove('hidden');

    // Show appropriate controls
    const titleEl = document.getElementById('game-title');
    const statusEl = document.getElementById('game-status');

    if (gameType === 'dice') {
      titleEl!.textContent = '🎲 Dice Roll';
      statusEl!.textContent = 'Roll to get 1-6!';
      document.getElementById('dice-controls')?.classList.remove('hidden');
    } else if (gameType === 'coinflip') {
      titleEl!.textContent = '🪙 Coin Flip';
      statusEl!.textContent = 'Pick heads or tails!';
      document.getElementById('coin-controls')?.classList.remove('hidden');
    } else if (gameType === 'rps') {
      titleEl!.textContent = '✊ Rock Paper Scissors';
      statusEl!.textContent = 'Make your choice!';
      document.getElementById('rps-controls')?.classList.remove('hidden');
    } else if (gameType === 'tictactoe') {
      titleEl!.textContent = '⭕ Tic-Tac-Toe';
      statusEl!.textContent = 'Waiting for opponent...';
      document.getElementById('tictactoe-controls')?.classList.remove('hidden');
    }
  }

  /**
   * Update Tic-Tac-Toe board display
   */
  public updateTicTacToeBoard(board: TicTacToeCell[], currentTurn: string | undefined, myId: string): void {
    const cells = document.querySelectorAll('.tictactoe-cell');
    cells.forEach((cell, index) => {
      const cellEl = cell as HTMLElement;
      cellEl.textContent = board[index] || '';
      cellEl.disabled = !!board[index];
    });

    const turnEl = document.getElementById('tictactoe-turn');
    if (turnEl && currentTurn) {
      const isMyTurn = currentTurn === myId;
      const symbol = isMyTurn ? 'X' : 'O';
      turnEl.textContent = isMyTurn ? `Your turn (${symbol})` : `Opponent's turn`;
    }
  }

  /**
   * Show game result
   */
  public showResult(result: any): void {
    if (!result || !this.currentGameType) return;

    if (this.currentGameType === 'dice' && result.dice) {
      const resultEl = document.getElementById('dice-result');
      const textEl = document.getElementById('dice-result-text');
      const animEl = document.getElementById('dice-animation');

      resultEl?.classList.remove('hidden');
      animEl!.textContent = `🎲 ${result.dice.roll}`;
      textEl!.textContent = `You rolled a ${result.dice.roll}!`;

      // Hide roll button
      document.getElementById('dice-roll-btn')?.classList.add('hidden');
    } else if (this.currentGameType === 'coinflip' && result.coinflip) {
      const resultEl = document.getElementById('coin-result');
      const textEl = document.getElementById('coin-result-text');
      const animEl = document.getElementById('coin-animation');

      resultEl?.classList.remove('hidden');
      const emoji = result.coinflip.result === 'heads' ? '🪙 H' : '🪙 T';
      animEl!.textContent = emoji;
      textEl!.textContent = `Result: ${result.coinflip.result}!`;

      // Hide choice buttons
      const coinBtns = document.querySelectorAll('#coin-controls .game-action-btn');
      coinBtns.forEach((btn) => (btn as HTMLElement).classList.add('hidden'));
    } else if (this.currentGameType === 'rps' && result.rps) {
      const resultEl = document.getElementById('rps-result');
      const textEl = document.getElementById('rps-result-text');
      const opponentChoiceEl = document.getElementById('opponent-choice');

      const opponentEmoji =
        result.rps.opponentChoice === 'rock'
          ? '✊'
          : result.rps.opponentChoice === 'paper'
          ? '✋'
          : '✌️';

      opponentChoiceEl!.textContent = opponentEmoji;
      resultEl?.classList.remove('hidden');
      textEl!.textContent = `Result: ${this.getRPSResult(result.rps)}`;

      // Hide choice buttons
      const rpsBtns = document.querySelectorAll('#rps-controls .game-action-btn');
      rpsBtns.forEach((btn) => (btn as HTMLElement).classList.add('hidden'));
    } else if (this.currentGameType === 'tictactoe' && result.tictactoe) {
      const resultEl = document.getElementById('tictactoe-result');
      const textEl = document.getElementById('tictactoe-result-text');

      resultEl?.classList.remove('hidden');
      
      if (result.tictactoe.draw) {
        textEl!.textContent = "It's a draw!";
      } else {
        textEl!.textContent = 'Game Over!';
      }

      // Disable all cells
      const cells = document.querySelectorAll('.tictactoe-cell');
      cells.forEach((cell) => ((cell as HTMLElement).disabled = true));
    }
  }

  private getRPSResult(rps: any): string {
    const { hostChoice, opponentChoice } = rps;
    if (hostChoice === opponentChoice) return 'Draw!';

    const wins: Record<string, string> = {
      rock: 'scissors',
      paper: 'rock',
      scissors: 'paper',
    };

    return wins[hostChoice] === opponentChoice ? 'You win!' : 'You lose!';
  }

  public show(): void {
    this.container.classList.remove('hidden');
    this.resetToSelection();
  }

  public hide(): void {
    this.container.classList.add('hidden');
    this.resetToSelection();
  }

  public setOnCreateGame(callback: (gameType: GameType) => void): void {
    this.onCreateGame = callback;
  }

  public setOnMakeMove(callback: (gameId: string, move: number | string) => void): void {
    this.onMakeMove = callback;
  }
}
