/**
 * Room Editor
 * Visual drag-drop editor for creating custom room layouts
 */

export interface RoomLayout {
  roomId: string;
  roomName: string;
  heightmap: string;
  dimensions: { width: number; height: number };
  floorType: string;
  wallColor: string;
  createdBy: string;
}

export type TileValue = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';

export class RoomEditor {
  private container!: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  
  private currentLayout: RoomLayout | null = null;
  private grid: TileValue[][] = [];
  private selectedTile: TileValue = '0';
  private isPainting: boolean = false;
  private isErasing: boolean = false;
  
  private readonly TILE_SIZE = 32;
  private readonly MIN_SIZE = 10;
  private readonly MAX_SIZE = 50;

  private readonly TILE_COLORS: Record<TileValue, string> = {
    '0': '#f0e6d2', // Floor (walkable)
    '1': '#8b7355', // Wall
    '2': '#d4af37', // Elevated floor (+1)
    '3': '#c9a966', // Elevated floor (+2)
    '4': '#b8965f', // Elevated floor (+3)
    '5': '#a67c52', // Elevated floor (+4)
    '6': '#9b6b47', // Elevated floor (+5)
    '7': '#8a5a42', // Elevated floor (+6)
    '8': '#6d4c3a', // Elevated floor (+7)
    '9': '#4a3326', // Elevated floor (+8)
  };

  private readonly TILE_LABELS: Record<TileValue, string> = {
    '0': 'Floor',
    '1': 'Wall',
    '2': '+1 Height',
    '3': '+2 Height',
    '4': '+3 Height',
    '5': '+4 Height',
    '6': '+5 Height',
    '7': '+6 Height',
    '8': '+7 Height',
    '9': '+8 Height',
  };

  constructor() {
    this.initUI();
    this.attachEventListeners();
  }

  private initUI(): void {
    // Editor panel already exists in UIManager, we'll populate it here
    this.container = document.getElementById('room-editor-content')!;
    if (!this.container) {
      console.error('[RoomEditor] Container #room-editor-content not found');
      return;
    }

    this.container.innerHTML = `
      <div class="editor-controls">
        <div class="control-group">
          <label>Width</label>
          <input type="number" id="editor-width" min="${this.MIN_SIZE}" max="${this.MAX_SIZE}" value="15" step="1">
        </div>
        <div class="control-group">
          <label>Height</label>
          <input type="number" id="editor-height" min="${this.MIN_SIZE}" max="${this.MAX_SIZE}" value="15" step="1">
        </div>
        <div class="control-group">
          <button class="btn-secondary" id="editor-resize">Resize Grid</button>
          <button class="btn-secondary" id="editor-clear">Clear All</button>
        </div>
      </div>

      <div class="editor-palette">
        <h4>Tile Palette</h4>
        <div class="palette-grid" id="palette-grid">
          ${Object.entries(this.TILE_LABELS).map(([value, label]) => `
            <div class="palette-tile ${value === '0' ? 'selected' : ''}" 
                 data-tile-value="${value}"
                 style="background-color: ${this.TILE_COLORS[value as TileValue]}">
              <span class="tile-label">${label}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="editor-canvas-wrapper">
        <div class="editor-toolbar">
          <button class="btn-tool" id="tool-paint" title="Paint (P)">
            <span class="icon">🖌️</span>
          </button>
          <button class="btn-tool" id="tool-erase" title="Erase (E)">
            <span class="icon">🧹</span>
          </button>
          <button class="btn-tool" id="tool-fill" title="Fill (F)">
            <span class="icon">🪣</span>
          </button>
        </div>
        <canvas id="room-editor-canvas" width="800" height="600"></canvas>
      </div>

      <div class="editor-actions">
        <button class="btn-secondary" id="editor-cancel">Cancel</button>
        <button class="btn-primary" id="editor-save">Save Layout</button>
      </div>
    `;

    this.canvas = document.getElementById('room-editor-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
  }

  private attachEventListeners(): void {
    // Palette selection
    const palette = document.getElementById('palette-grid');
    palette?.addEventListener('click', (e) => {
      const tile = (e.target as HTMLElement).closest('.palette-tile') as HTMLElement;
      if (tile) {
        palette.querySelectorAll('.palette-tile').forEach(t => t.classList.remove('selected'));
        tile.classList.add('selected');
        this.selectedTile = tile.dataset.tileValue as TileValue;
      }
    });

    // Canvas drawing
    this.canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
    this.canvas.addEventListener('mouseup', () => this.handleCanvasMouseUp());
    this.canvas.addEventListener('mouseleave', () => this.handleCanvasMouseUp());

    // Toolbar buttons
    document.getElementById('tool-paint')?.addEventListener('click', () => {
      this.isPainting = true;
      this.isErasing = false;
    });

    document.getElementById('tool-erase')?.addEventListener('click', () => {
      this.isPainting = false;
      this.isErasing = true;
    });

    document.getElementById('tool-fill')?.addEventListener('click', () => {
      this.isPainting = false;
      this.isErasing = false;
      // Fill tool handled in canvas click
    });

    // Grid controls
    document.getElementById('editor-resize')?.addEventListener('click', () => this.handleResize());
    document.getElementById('editor-clear')?.addEventListener('click', () => this.handleClear());

    // Actions
    document.getElementById('editor-save')?.addEventListener('click', () => this.handleSave());
    document.getElementById('editor-cancel')?.addEventListener('click', () => this.handleCancel());

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (this.container.closest('.hidden')) return; // Editor not visible
      
      if (e.key === 'p' || e.key === 'P') {
        this.isPainting = true;
        this.isErasing = false;
      } else if (e.key === 'e' || e.key === 'E') {
        this.isErasing = true;
        this.isPainting = false;
      }
    });
  }

  private handleCanvasMouseDown(e: MouseEvent): void {
    const { x, y } = this.getGridCoords(e);
    if (x < 0 || y < 0 || y >= this.grid.length || x >= this.grid[0].length) return;

    if (this.isErasing) {
      this.grid[y][x] = '0'; // Reset to floor
    } else {
      this.grid[y][x] = this.selectedTile;
    }

    this.isPainting = true;
    this.render();
  }

  private handleCanvasMouseMove(e: MouseEvent): void {
    if (!this.isPainting) return;

    const { x, y } = this.getGridCoords(e);
    if (x < 0 || y < 0 || y >= this.grid.length || x >= this.grid[0].length) return;

    if (this.isErasing) {
      this.grid[y][x] = '0';
    } else {
      this.grid[y][x] = this.selectedTile;
    }

    this.render();
  }

  private handleCanvasMouseUp(): void {
    this.isPainting = false;
  }

  private getGridCoords(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    
    return {
      x: Math.floor(canvasX / this.TILE_SIZE),
      y: Math.floor(canvasY / this.TILE_SIZE),
    };
  }

  private handleResize(): void {
    const widthInput = document.getElementById('editor-width') as HTMLInputElement;
    const heightInput = document.getElementById('editor-height') as HTMLInputElement;
    
    const width = Math.max(this.MIN_SIZE, Math.min(this.MAX_SIZE, parseInt(widthInput.value) || 15));
    const height = Math.max(this.MIN_SIZE, Math.min(this.MAX_SIZE, parseInt(heightInput.value) || 15));

    this.initGrid(width, height);
    this.render();
  }

  private handleClear(): void {
    if (!confirm('Clear all tiles? This cannot be undone.')) return;
    
    this.grid = this.grid.map(row => row.map(() => '0'));
    this.render();
  }

  private handleSave(): void {
    if (!this.currentLayout) return;

    const heightmap = this.grid.map(row => row.join('')).join('|');
    
    if (this.onSave) {
      this.onSave(heightmap);
    }
  }

  private handleCancel(): void {
    if (this.onCancel) {
      this.onCancel();
    }
  }

  private initGrid(width: number, height: number): void {
    this.grid = Array(height).fill(null).map(() => Array(width).fill('0'));
    
    // Adjust canvas size
    this.canvas.width = width * this.TILE_SIZE;
    this.canvas.height = height * this.TILE_SIZE;
  }

  private parseHeightmap(heightmap: string): void {
    const rows = heightmap.split('|');
    this.grid = rows.map(row => row.split('') as TileValue[]);
    
    // Adjust canvas size
    if (this.grid.length > 0) {
      const width = this.grid[0].length;
      const height = this.grid.length;
      this.canvas.width = width * this.TILE_SIZE;
      this.canvas.height = height * this.TILE_SIZE;
    }
  }

  private render(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw grid
    for (let y = 0; y < this.grid.length; y++) {
      for (let x = 0; x < this.grid[y].length; x++) {
        const tile = this.grid[y][x];
        
        // Fill tile
        this.ctx.fillStyle = this.TILE_COLORS[tile];
        this.ctx.fillRect(
          x * this.TILE_SIZE,
          y * this.TILE_SIZE,
          this.TILE_SIZE,
          this.TILE_SIZE
        );

        // Border
        this.ctx.strokeStyle = '#999';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(
          x * this.TILE_SIZE,
          y * this.TILE_SIZE,
          this.TILE_SIZE,
          this.TILE_SIZE
        );

        // Tile value (small text)
        if (tile !== '0') {
          this.ctx.fillStyle = '#333';
          this.ctx.font = '10px monospace';
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          this.ctx.fillText(
            tile,
            x * this.TILE_SIZE + this.TILE_SIZE / 2,
            y * this.TILE_SIZE + this.TILE_SIZE / 2
          );
        }
      }
    }
  }

  /**
   * Load existing room layout
   */
  public async loadLayout(roomId: string, token: string): Promise<void> {
    try {
      const response = await fetch(`/api/rooms/${roomId}/layout`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load layout: ${response.statusText}`);
      }

      const layout: RoomLayout = await response.json();
      this.currentLayout = layout;

      // Update dimension inputs
      const widthInput = document.getElementById('editor-width') as HTMLInputElement;
      const heightInput = document.getElementById('editor-height') as HTMLInputElement;
      widthInput.value = layout.dimensions.width.toString();
      heightInput.value = layout.dimensions.height.toString();

      // Parse and render heightmap
      this.parseHeightmap(layout.heightmap);
      this.render();

      console.log('[RoomEditor] Layout loaded:', layout);
    } catch (error) {
      console.error('[RoomEditor] Failed to load layout:', error);
      alert('Failed to load room layout. Please try again.');
    }
  }

  /**
   * Create new empty layout
   */
  public createNew(roomId: string, roomName: string, width: number = 15, height: number = 15): void {
    this.currentLayout = {
      roomId,
      roomName,
      heightmap: '',
      dimensions: { width, height },
      floorType: 'default',
      wallColor: '#cccccc',
      createdBy: '',
    };

    const widthInput = document.getElementById('editor-width') as HTMLInputElement;
    const heightInput = document.getElementById('editor-height') as HTMLInputElement;
    widthInput.value = width.toString();
    heightInput.value = height.toString();

    this.initGrid(width, height);
    this.render();
  }

  // Callbacks
  public onSave?: (heightmap: string) => void;
  public onCancel?: () => void;
}
