// ============================================================
// OpenClaw Hotel — Spectator Client
// External file: cached separately by browser (v1.0)
// Lazy-loads PixiJS only when entering a room (saves ~700KB on initial page load)
// ============================================================

/** Load PixiJS 7 lazily (only when needed for room rendering) */
let _pixiLoadPromise = null;
function loadPixiJS() {
  if (window.PIXI) return Promise.resolve();
  if (_pixiLoadPromise) return _pixiLoadPromise;
  _pixiLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.3.2/pixi.min.js';
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'no-referrer';
    script.onload = resolve;
    script.onerror = () => reject(new Error('[OpenClaw] Failed to load PixiJS from CDN'));
    document.head.appendChild(script);
  });
  return _pixiLoadPromise;
}

    // ============================================================
    // OpenClaw Hotel — Spectator Client (PixiJS WebGL)
    // ============================================================
    const API = window.location.origin;
    const WS_URL = API.replace('http', 'ws');

    // State
    let currentRoomId = null;
    let currentRoomName = '';
    let roomsList = []; // For mobile swipe navigation
    let ws = null;
    let agents = new Map(); // agentId -> { name, x, y, targetX, targetY, direction, sprite, graphics, bubble }
    let chatMessages = [];
    let chatFeedMessages = [];
    const MAX_CHAT_FEED_MESSAGES = 50;

    // Mobile & Performance
    const isMobile = navigator.maxTouchPoints > 0;
    const isLowEnd = navigator.hardwareConcurrency <= 4 || isMobile;
    let particleReduction = isMobile ? 0.3 : 1.0; // Reduce particles on mobile
    let renderScale = isLowEnd ? 0.75 : 1.0; // Lower resolution on low-end devices

    // Touch state
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartDist = 0;
    let currentZoom = 1.0;
    let panX = 0;
    let panY = 0;
    let selectedAgent = null;

    // FPS tracking & throttling
    let fpsFrames = [];
    let fpsVisible = false;
    let lastSortTime = 0;
    const SORT_THROTTLE_MS = isLowEnd ? 33 : 16; // 30 FPS on low-end, 60 FPS on desktop

    // ===== UI STATE HELPERS =====
    function showLoading(text = 'Loading...', subtext = 'Please wait') {
      const overlay = document.getElementById('loadingOverlay');
      const textEl = document.getElementById('loadingText');
      const subtextEl = document.getElementById('loadingSubtext');
      
      textEl.textContent = text;
      subtextEl.textContent = subtext;
      overlay.classList.remove('hidden');
    }

    function hideLoading() {
      const overlay = document.getElementById('loadingOverlay');
      overlay.classList.add('hidden');
    }

    function showError(message, autoHideDuration = 5000) {
      const toast = document.getElementById('errorToast');
      const messageEl = document.getElementById('errorMessage');
      
      messageEl.textContent = message;
      toast.classList.add('show');

      if (autoHideDuration > 0) {
        setTimeout(() => {
          hideError();
        }, autoHideDuration);
      }
    }

    function hideError() {
      const toast = document.getElementById('errorToast');
      toast.classList.remove('show');
    }

    function showSkeletonRooms() {
      const roomList = document.getElementById('roomList');
      roomList.innerHTML = `
        <div class="skeleton-room">
          <div class="skeleton-line"></div>
          <div class="skeleton-line medium"></div>
          <div class="skeleton-line short"></div>
        </div>
        <div class="skeleton-room">
          <div class="skeleton-line"></div>
          <div class="skeleton-line medium"></div>
          <div class="skeleton-line short"></div>
        </div>
        <div class="skeleton-room">
          <div class="skeleton-line"></div>
          <div class="skeleton-line medium"></div>
          <div class="skeleton-line short"></div>
        </div>
      `;
    }

    // PixiJS App & Containers
    let app = null;
    let worldContainer = null;
    let floorContainer = null;
    let wallContainer = null;
    let contentContainer = null; // Furniture + agents (sorted by depth)
    let tooltipContainer = null; // T-341: shared hover tooltip (stage-level)

    // Tile dimensions (isometric)
    const TILE_W = 64;
    const TILE_H = 32;
    const ROOM_SIZE = 16;

    // ===== SPRITE LOADER =====
    const spriteTextures = {};
    let spritesLoaded = false;

    const SPRITE_NAMES = [
      'floor_wood', 'floor_carpet', 'floor_stone',
      'wall_brick', 'wall_wood', 'wall_stone', 'window',
      'sofa', 'table', 'chair', 'lamp', 'plant', 'bookshelf',
      'computer', 'tv', 'rug', 'painting', 'fridge', 'bed', 'door',
      'coffee_table', 'lounge_chair', 'side_table', 'desk', 'coatrack', 'radio', 'speaker'
    ];

    async function loadSprites() {
      const promises = SPRITE_NAMES.map(name => new Promise((resolve) => {
        PIXI.Texture.fromURL('/assets/sprites/' + name + '.png')
          .then(texture => {
            spriteTextures[name] = texture;
            resolve();
          })
          .catch(() => {
            console.warn('Failed to load sprite:', name);
            resolve();
          });
      }));
      await Promise.all(promises);
      spritesLoaded = true;
      console.log('[Sprites] Loaded:', Object.keys(spriteTextures).length, 'PixiJS textures');
    }

    // Load sprites immediately
    loadSprites();

    // ===== ROOM LAYOUTS =====
    const ROOM_LAYOUTS = {
      'default': {
        size: 12,
        floor: [
          'wwwwwwwwwwww',
          'wwwwwwwwwwww',
          'wwwcccccwwww',
          'wwwcccccwwww',
          'wwwcccccwwww',
          'wwwcccccwwww',
          'wwwcccccwwww',
          'wwwwwwwwwwww',
          'wwwwwwwwwwww',
          'wwwwwwwwwwww',
          'wwwwwwwwwwww',
          'wwwwwwwwwwww',
        ],
        furniture: [
          ['sofa', 2, 3, 0.38],
          ['rug', 3, 3, 0.28],
          ['coffee_table', 3, 4, 0.5],
          ['lounge_chair', 4, 3, 0.45],
          ['sofa', 2, 7, 0.38],
          ['rug', 3, 7, 0.28],
          ['coffee_table', 3, 8, 0.5],
          ['tv', 5, 5, 0.65],
          ['side_table', 5, 4, 0.55],
          ['bookshelf', 3, 1, 0.45],
          ['bookshelf', 4, 1, 0.45],
          ['desk', 8, 1, 0.45],
          ['computer', 8, 1, 0.8],
          ['chair', 8, 2, 0.65],
          ['fridge', 10, 1, 0.4],
          ['plant', 1, 1, 0.7],
          ['plant', 1, 10, 0.7],
          ['plant', 10, 10, 0.7],
          ['lamp', 1, 5, 0.55],
          ['lamp', 10, 5, 0.55],
          ['coatrack', 10, 9, 0.55],
          ['radio', 6, 1, 0.8],
          ['speaker', 7, 1, 0.6],
        ],
        wallWindows: [
          { side: 'back', pos: 4 },
          { side: 'back', pos: 7 },
          { side: 'left', pos: 3 },
          { side: 'left', pos: 7 },
        ]
      },
      'chill': {
        size: 10,
        floor: [
          'cccccccccc',
          'cccccccccc',
          'ccwwwwwwcc',
          'ccwwwwwwcc',
          'ccwwwwwwcc',
          'ccwwwwwwcc',
          'cccccccccc',
          'cccccccccc',
          'cccccccccc',
          'cccccccccc',
        ],
        furniture: [
          ['sofa', 3, 3, 0.38],
          ['sofa', 3, 5, 0.38],
          ['coffee_table', 4, 4, 0.5],
          ['rug', 4, 3, 0.32],
          ['rug', 4, 5, 0.32],
          ['bookshelf', 1, 1, 0.45],
          ['lounge_chair', 2, 2, 0.45],
          ['lamp', 1, 2, 0.55],
          ['speaker', 7, 1, 0.6],
          ['radio', 8, 1, 0.8],
          ['plant', 1, 8, 0.7],
          ['plant', 8, 8, 0.7],
          ['plant', 8, 1, 0.6],
          ['lamp', 8, 5, 0.55],
        ],
        wallWindows: [
          { side: 'back', pos: 3 },
          { side: 'back', pos: 6 },
          { side: 'left', pos: 4 },
          { side: 'left', pos: 7 },
        ],
      },
      'arena': {
        size: 14,
        floor: [
          'ssssssssssssss',
          'ssssssssssssss',
          'ssssccccccssss',
          'sssccccccccsss',
          'ssccccccccccss',
          'ssccccccccccss',
          'ssccccccccccss',
          'ssccccccccccss',
          'ssccccccccccss',
          'ssccccccccccss',
          'sssccccccccsss',
          'ssssccccccssss',
          'ssssssssssssss',
          'ssssssssssssss',
        ],
        furniture: [
          ['chair', 2, 2, 0.55],
          ['chair', 2, 11, 0.55],
          ['chair', 11, 2, 0.55],
          ['chair', 11, 11, 0.55],
          ['sofa', 1, 5, 0.35],
          ['sofa', 1, 8, 0.35],
          ['sofa', 12, 5, 0.35],
          ['sofa', 12, 8, 0.35],
          ['tv', 6, 1, 0.65],
          ['computer', 7, 1, 0.7],
          ['lamp', 1, 1, 0.55],
          ['lamp', 1, 12, 0.55],
          ['lamp', 12, 1, 0.55],
          ['lamp', 12, 12, 0.55],
          ['plant', 6, 12, 0.6],
          ['plant', 7, 12, 0.6],
        ],
        wallWindows: [
          { side: 'back', pos: 3 },
          { side: 'back', pos: 6 },
          { side: 'back', pos: 9 },
          { side: 'left', pos: 3 },
          { side: 'left', pos: 6 },
          { side: 'left', pos: 9 },
        ]
      }
    };

    // ===== ISOMETRIC HELPERS =====
    function isoToScreen(x, y) {
      const offsetX = app.screen.width * 0.45;
      const offsetY = 80;
      return {
        sx: offsetX + (x - y) * (TILE_W / 2),
        sy: offsetY + (x + y) * (TILE_H / 2)
      };
    }

    // ===== PIXI GRAPHICS CREATION =====
    function createIsoTileGraphics(tileType) {
      const graphics = new PIXI.Graphics();
      const floorMap = { 'w': 'floor_wood', 'c': 'floor_carpet', 's': 'floor_stone' };
      const spriteName = floorMap[tileType] || 'floor_wood';
      const texture = spriteTextures[spriteName];

      if (texture) {
        // Create sprite for textured tile
        const sprite = new PIXI.Sprite(texture);
        sprite.width = TILE_W;
        sprite.height = TILE_H;
        sprite.anchor.set(0.5, 0);
        return sprite;
      } else {
        // Fallback: colored diamond
        const colors = { 'w': 0x8B6914, 'c': 0x8B4513, 's': 0x696969 };
        graphics.beginFill(colors[tileType] || 0x8B6914);
        graphics.moveTo(0, 0);
        graphics.lineTo(TILE_W/2, TILE_H/2);
        graphics.lineTo(0, TILE_H);
        graphics.lineTo(-TILE_W/2, TILE_H/2);
        graphics.closePath();
        graphics.endFill();
        graphics.lineStyle(0.5, 0x000000, 0.15);
        graphics.moveTo(0, 0);
        graphics.lineTo(TILE_W/2, TILE_H/2);
        graphics.lineTo(0, TILE_H);
        graphics.lineTo(-TILE_W/2, TILE_H/2);
        graphics.closePath();
        return graphics;
      }
    }

    function createWallGraphics(side, hasWindow) {
      const graphics = new PIXI.Graphics();
      const WALL_H = 56;
      const hw = TILE_W / 2;
      const hh = TILE_H / 2;

      if (side === 'back') {
        // Back wall parallelogram
        const x0 = 0, y0 = 0;
        const x1 = hw, y1 = hh;
        const x2 = hw, y2 = hh - WALL_H;
        const x3 = 0, y3 = -WALL_H;

        // Gradient fill
        const canvas = document.createElement('canvas');
        canvas.width = hw;
        canvas.height = WALL_H;
        const ctx = canvas.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, 0, WALL_H);
        g.addColorStop(0, '#c4b096');
        g.addColorStop(0.1, '#c4b496');
        g.addColorStop(0.9, '#c0b090');
        g.addColorStop(1, '#8a7a64');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, hw, WALL_H);

        const texture = PIXI.Texture.from(canvas);
        graphics.beginTextureFill({ texture });
        graphics.drawPolygon([x0, y0, x1, y1, x2, y2, x3, y3]);
        graphics.endFill();

        // Baseboard
        graphics.beginFill(0x6a5a44);
        graphics.drawPolygon([x0, y0, x1, y1, x1, y1-5, x0, y0-5]);
        graphics.endFill();

        // Crown molding
        graphics.beginFill(0xd4c4a8);
        graphics.drawPolygon([x3, y3, x2, y2, x2, y2+4, x3, y3+4]);
        graphics.endFill();

        // Outline
        graphics.lineStyle(1, 0x5a4a34);
        graphics.drawPolygon([x0, y0, x1, y1, x2, y2, x3, y3, x0, y0]);

        // Window
        if (hasWindow) {
          const ww = hw * 0.55, wh = WALL_H * 0.45;
          const wy_off = WALL_H * 0.2;
          const wx_off = hw * 0.15;
          const w0x = x3 + wx_off, w0y = y3 + wy_off;
          const w1x = w0x + ww, w1y = w0y + ww * (hh/hw);
          const w2x = w1x, w2y = w1y + wh;
          const w3x = w0x, w3y = w0y + wh;

          graphics.beginFill(0x7a6844);
          graphics.drawPolygon([w0x, w0y, w1x, w1y, w2x, w2y, w3x, w3y]);
          graphics.endFill();

          graphics.beginFill(0xa8d4e8);
          graphics.drawPolygon([w0x+2, w0y+1, w1x-2, w1y+1, w2x-2, w2y-1, w3x+2, w3y-1]);
          graphics.endFill();

          graphics.lineStyle(1.5, 0x7a6844);
          const mY0=(w0y+w3y)/2, mY1=(w1y+w2y)/2;
          graphics.moveTo(w0x+2, mY0).lineTo(w1x-2, mY1);
          const mX0=(w0x+w1x)/2, mXb=(w3x+w2x)/2;
          graphics.moveTo(mX0, (w0y+w1y)/2+1).lineTo(mXb, (w3y+w2y)/2-1);
        }
      } else {
        // Left wall
        const x0 = 0, y0 = 0;
        const x1 = -hw, y1 = hh;
        const x2 = -hw, y2 = hh - WALL_H;
        const x3 = 0, y3 = -WALL_H;

        const canvas = document.createElement('canvas');
        canvas.width = hw;
        canvas.height = WALL_H;
        const ctx = canvas.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, 0, WALL_H);
        g.addColorStop(0, '#b8a48c');
        g.addColorStop(0.1, '#b4a088');
        g.addColorStop(0.9, '#b09c84');
        g.addColorStop(1, '#a89880');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, hw, WALL_H);

        const texture = PIXI.Texture.from(canvas);
        graphics.beginTextureFill({ texture });
        graphics.drawPolygon([x0, y0, x1, y1, x2, y2, x3, y3]);
        graphics.endFill();

        graphics.beginFill(0x5a4a34);
        graphics.drawPolygon([x0, y0, x1, y1, x1, y1-5, x0, y0-5]);
        graphics.endFill();

        graphics.beginFill(0xc4b498);
        graphics.drawPolygon([x3, y3, x2, y2, x2, y2+4, x3, y3+4]);
        graphics.endFill();

        graphics.lineStyle(1, 0x4a3a24);
        graphics.drawPolygon([x0, y0, x1, y1, x2, y2, x3, y3, x0, y0]);

        if (hasWindow) {
          const ww = hw * 0.55, wh = WALL_H * 0.45;
          const wy_off = WALL_H * 0.2;
          const wx_off = hw * 0.15;
          const w0x = x3 - wx_off, w0y = y3 + wy_off;
          const w1x = w0x - ww, w1y = w0y + ww * (hh/hw);
          const w2x = w1x, w2y = w1y + wh;
          const w3x = w0x, w3y = w0y + wh;

          graphics.beginFill(0x7a6844);
          graphics.drawPolygon([w0x, w0y, w1x, w1y, w2x, w2y, w3x, w3y]);
          graphics.endFill();

          graphics.beginFill(0xa8d4e8);
          graphics.drawPolygon([w0x-2, w0y+1, w1x+2, w1y+1, w2x+2, w2y-1, w3x-2, w3y-1]);
          graphics.endFill();

          graphics.lineStyle(1.5, 0x7a6844);
          const mY0=(w0y+w3y)/2, mY1=(w1y+w2y)/2;
          graphics.moveTo(w0x-2, mY0).lineTo(w1x+2, mY1);
          const mX0=(w0x+w1x)/2, mXb=(w3x+w2x)/2;
          graphics.moveTo(mX0, (w0y+w1y)/2+1).lineTo(mXb, (w3y+w2y)/2-1);
        }
      }

      return graphics;
    }

    function createAgentGraphics(agent) {
      const container = new PIXI.Container();
      const bodyH = 42;
      const bodyW = 22;
      const headR = 11;

      // Shadow
      const shadow = new PIXI.Graphics();
      shadow.beginFill(0x000000, 0.25);
      shadow.drawEllipse(0, 2, 14, 6);
      shadow.endFill();
      container.addChild(shadow);

      // Body parts
      const body = new PIXI.Graphics();
      
      // Shoes
      body.beginFill(0x333333);
      body.drawRect(-6, -2, 5, 4);
      body.drawRect(1, -2, 5, 4);
      body.endFill();

      // Legs
      body.beginFill(0x2a4494);
      body.drawRect(-5, -12, 4, 12);
      body.drawRect(1, -12, 4, 12);
      body.endFill();

      // Shirt
      const color = parseInt((agent.color || '#61dafb').replace('#', ''), 16);
      body.beginFill(color);
      body.drawRect(-bodyW/2, -bodyH + 8, bodyW, bodyH/2 + 2);
      body.endFill();

      // Arms
      body.beginFill(color);
      body.drawRect(-bodyW/2 - 3, -bodyH + 10, 4, 16);
      body.drawRect(bodyW/2 - 1, -bodyH + 10, 4, 16);
      body.endFill();

      // Hands
      body.beginFill(0xffd5b0);
      body.drawRect(-bodyW/2 - 3, -bodyH + 26, 4, 4);
      body.drawRect(bodyW/2 - 1, -bodyH + 26, 4, 4);
      body.endFill();

      // Head
      body.beginFill(0xffd5b0);
      body.drawCircle(0, -bodyH - headR + 10, headR);
      body.endFill();
      body.lineStyle(1, 0xd4a580);
      body.drawCircle(0, -bodyH - headR + 10, headR);

      // Hair
      const hairColor = parseInt((agent.hairColor || '#4a3728').replace('#', ''), 16);
      body.beginFill(hairColor);
      body.arc(0, -bodyH - headR + 6, headR + 1, Math.PI, Math.PI * 2);
      body.drawRect(-headR - 1, -bodyH - headR + 6, headR * 2 + 2, 5);
      body.endFill();

      // Eyes
      body.beginFill(0x333333);
      body.drawRect(-4, -bodyH - headR + 9, 3, 3);
      body.drawRect(2, -bodyH - headR + 9, 3, 3);
      body.endFill();

      container.addChild(body);

      // Name tag
      const tagBg = new PIXI.Graphics();
      const nameText = new PIXI.Text(agent.name, {
        fontFamily: '"Courier New", monospace',
        fontSize: 11,
        fontWeight: 'bold',
        fill: 0xffffff
      });
      nameText.anchor.set(0.5, 0);
      const nameW = nameText.width + 12;
      const tagY = -bodyH - headR - 14;

      tagBg.beginFill(0x000000, 0.75);
      tagBg.drawRoundedRect(-nameW/2, tagY, nameW, 18, 4);
      tagBg.endFill();
      tagBg.beginFill(color);
      tagBg.drawRect(-nameW/2, tagY, 3, 18);
      tagBg.endFill();

      nameText.position.set(2, tagY + 4);
      container.addChild(tagBg);
      container.addChild(nameText);

      // Make agent clickable + hoverable
      container.interactive = true;
      container.buttonMode = true;
      container.cursor = 'pointer';
      container.on('pointerdown', () => {
        showAgentInfo(agent.id);
      });

      // T-341: Hover tooltip
      container.on('pointerover', (e) => {
        const pos = e.data.global;
        showTooltip(agent, pos.x, pos.y);
      });
      container.on('pointermove', (e) => {
        if (tooltipContainer && tooltipContainer.visible) {
          const pos = e.data.global;
          showTooltip(agent, pos.x, pos.y);
        }
      });
      container.on('pointerout', () => hideTooltip());

      return container;
    }

    function createChatBubble(message) {
      const container = new PIXI.Container();
      const text = new PIXI.Text(message.substring(0, 35), {
        fontFamily: 'sans-serif',
        fontSize: 12,
        fill: 0x333333,
        wordWrap: true,
        wordWrapWidth: 180
      });

      const padding = 8;
      const bubbleW = Math.min(text.width + padding * 2, 220);
      const bubbleH = text.height + padding * 2;

      const bubble = new PIXI.Graphics();
      bubble.beginFill(0xffffff);
      bubble.drawRoundedRect(-bubbleW/2, -100, bubbleW, bubbleH, 10);
      bubble.endFill();

      // Arrow
      bubble.beginFill(0xffffff);
      bubble.moveTo(-5, -100 + bubbleH);
      bubble.lineTo(0, -100 + bubbleH + 8);
      bubble.lineTo(5, -100 + bubbleH);
      bubble.closePath();
      bubble.endFill();

      text.anchor.set(0.5, 0);
      text.position.set(0, -100 + padding);

      container.addChild(bubble);
      container.addChild(text);
      container.alpha = 0;

      return container;
    }

    // ===== EMOTE VISUAL EFFECTS (T-338) =====
    const EMOTE_EMOJI_MAP = {
      dance: '💃', wave: '👋', laugh: '😂', clap: '👏',
      sad: '😢', angry: '😠', love: '❤️', cool: '😎',
      happy: '😊', wink: '😉', surprised: '😲', think: '🤔',
    };

    function getEmoteEmoji(emote) {
      if (!emote) return '✨';
      const lower = String(emote).toLowerCase();
      return EMOTE_EMOJI_MAP[lower] || '✨';
    }

    /**
     * Show a floating emoji above an agent sprite (T-338)
     * @param {Object} agentObj - agent entry from agents Map
     * @param {string} emote    - emote name (e.g. 'dance', 'wave')
     */
    function showEmoteEffect(agentObj, emote) {
      if (!window.PIXI || !contentContainer || !agentObj || !agentObj.sprite) return;

      const emoji = getEmoteEmoji(emote);

      // Create floating text
      const fx = new PIXI.Text(emoji, { fontSize: 22, fontFamily: 'sans-serif' });
      fx.anchor.set(0.5, 1);
      // Position above the agent head (y offset ~-80px from sprite centre)
      fx.position.set(agentObj.sprite.x, agentObj.sprite.y - 80);
      fx.alpha = 1;
      fx.zIndex = 9999;
      contentContainer.addChild(fx);

      // Animate: float up + fade over 1.8s using PIXI.Ticker
      let elapsed = 0;
      const DURATION = 1800; // ms
      const RISE = 45; // px to rise
      const startY = fx.position.y;

      const ticker = PIXI.Ticker.shared;
      function onTick(delta) {
        elapsed += delta * (1000 / 60); // approx ms (60fps base)
        const t = Math.min(elapsed / DURATION, 1);
        fx.position.y = startY - RISE * t;
        fx.alpha = 1 - t;
        if (t >= 1) {
          ticker.remove(onTick);
          if (fx.parent) fx.parent.removeChild(fx);
          fx.destroy();
        }
      }
      ticker.add(onTick);
    }

    // ===== AGENT HOVER TOOLTIP (T-341) =====
    const MOOD_EMOJIS = {
      happy: '😊', excited: '🤩', curious: '🤔', bored: '😑',
      sad: '😢', angry: '😠', playful: '😄', calm: '😌', neutral: '😐',
    };

    /** Build/rebuild the shared tooltip graphics for a given agent */
    function buildTooltip(agent) {
      if (!tooltipContainer) return;
      tooltipContainer.removeChildren();

      const mood = agent.mood || 'neutral';
      const moodEmoji = MOOD_EMOJIS[mood] || '😐';
      const statusIcon = agent.status && AGENT_STATUS_ICONS[agent.status]
        ? AGENT_STATUS_ICONS[agent.status] + ' '
        : '';
      const lastMsg = agent.lastMessage
        ? (agent.lastMessage.length > 40 ? agent.lastMessage.slice(0, 40) + '…' : agent.lastMessage)
        : null;

      // Build text lines
      const lines = [
        `${moodEmoji} ${agent.name}`,
        ...(agent.status ? [`${statusIcon}${agent.status}`] : []),
        ...(lastMsg ? [`💬 "${lastMsg}"`] : []),
      ];

      const PAD = 8;
      const LINE_H = 18;
      const tooltipW = 200;
      const tooltipH = lines.length * LINE_H + PAD * 2;

      // Background
      const bg = new PIXI.Graphics();
      bg.beginFill(0x1a1a2e, 0.92);
      bg.lineStyle(1, 0x4a90e2, 0.8);
      bg.drawRoundedRect(0, 0, tooltipW, tooltipH, 6);
      bg.endFill();
      tooltipContainer.addChild(bg);

      // Text lines
      lines.forEach((line, i) => {
        const t = new PIXI.Text(line, {
          fontFamily: '"Courier New", monospace',
          fontSize: i === 0 ? 13 : 11,
          fontWeight: i === 0 ? 'bold' : 'normal',
          fill: i === 0 ? 0xffffff : 0xbbbbcc,
          wordWrap: true,
          wordWrapWidth: tooltipW - PAD * 2,
        });
        t.position.set(PAD, PAD + i * LINE_H);
        tooltipContainer.addChild(t);
      });
    }

    /** Show tooltip for an agent sprite at given canvas coords */
    function showTooltip(agent, canvasX, canvasY) {
      if (!tooltipContainer || !window.PIXI) return;
      buildTooltip(agent);
      // Position: offset slightly above-right of cursor
      const W = 210;
      const H = tooltipContainer.height || 60;
      const stageW = app ? app.renderer.width / (window.devicePixelRatio || 1) : 800;
      const stageH = app ? app.renderer.height / (window.devicePixelRatio || 1) : 600;
      let tx = canvasX + 12;
      let ty = canvasY - H - 8;
      if (tx + W > stageW) tx = canvasX - W - 12;
      if (ty < 0) ty = canvasY + 12;
      tooltipContainer.position.set(tx, ty);
      tooltipContainer.visible = true;
    }

    /** Hide the tooltip */
    function hideTooltip() {
      if (tooltipContainer) tooltipContainer.visible = false;
    }

    // ===== ROOM RENDERING =====
    function initPixiApp() {
      const container = document.getElementById('isoCanvas');
      
      if (app) {
        app.destroy(true, { children: true, texture: true, baseTexture: true });
      }

      app = new PIXI.Application({
        width: container.clientWidth,
        height: container.clientHeight,
        backgroundColor: 0x0f1923,
        antialias: false, // Crisp pixel art
        resolution: (window.devicePixelRatio || 1) * renderScale,
        autoDensity: true
      });

      container.appendChild(app.view);

      // Create layer containers
      worldContainer = new PIXI.Container();
      floorContainer = new PIXI.Container();
      wallContainer = new PIXI.Container();
      contentContainer = new PIXI.Container();
      contentContainer.sortableChildren = true; // Enable z-index sorting

      worldContainer.addChild(floorContainer);
      worldContainer.addChild(wallContainer);
      worldContainer.addChild(contentContainer);
      app.stage.addChild(worldContainer);

      // T-341: Tooltip container — stage-level so it's always on top
      tooltipContainer = new PIXI.Container();
      tooltipContainer.visible = false;
      tooltipContainer.zIndex = 99999;
      app.stage.addChild(tooltipContainer);

      // Apply initial zoom and pan
      worldContainer.scale.set(currentZoom);
      worldContainer.position.set(panX, panY);

      // Add touch event handlers
      setupTouchControls(container);

      // Start game loop
      app.ticker.add(gameLoop);

      console.log('[PixiJS] Initialized WebGL renderer (mobile:', isMobile, ', scale:', renderScale, ')');
    }

    function drawRoom() {
      if (!app) return;

      // Clear containers
      floorContainer.removeChildren();
      wallContainer.removeChildren();
      contentContainer.removeChildren();

      // Select layout
      const roomNameLower = (currentRoomName || '').toLowerCase();
      const layoutKey = roomNameLower.includes('chill') ? 'chill'
        : roomNameLower.includes('arena') ? 'arena'
        : 'default';
      const layout = ROOM_LAYOUTS[layoutKey];
      const size = layout.size;

      // Window positions
      const backWindows = new Set(layout.wallWindows.filter(w => w.side === 'back').map(w => w.pos));
      const leftWindows = new Set(layout.wallWindows.filter(w => w.side === 'left').map(w => w.pos));

      // === 1. Walls ===
      for (let x = 0; x < size; x++) {
        const { sx, sy } = isoToScreen(x, 0);
        const wall = createWallGraphics('back', backWindows.has(x));
        wall.position.set(sx, sy);
        wallContainer.addChild(wall);
      }
      for (let y = 0; y < size; y++) {
        const { sx, sy } = isoToScreen(0, y);
        const wall = createWallGraphics('left', leftWindows.has(y));
        wall.position.set(sx, sy);
        wallContainer.addChild(wall);
      }

      // === 2. Floor ===
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          const tileType = layout.floor[y]?.[x] || 'w';
          if (tileType === ' ') continue;
          const { sx, sy } = isoToScreen(x, y);
          const tile = createIsoTileGraphics(tileType);
          tile.position.set(sx, sy);
          floorContainer.addChild(tile);
        }
      }

      // === 3. Furniture ===
      for (const [spriteName, fx, fy, scale] of layout.furniture) {
        const texture = spriteTextures[spriteName];
        if (!texture) continue;

        const sprite = new PIXI.Sprite(texture);
        const { sx, sy } = isoToScreen(fx, fy);
        sprite.width = sprite.texture.width * scale;
        sprite.height = sprite.texture.height * scale;
        sprite.anchor.set(0.5, 1);
        sprite.position.set(sx, sy + TILE_H/2);
        sprite.zIndex = fx + fy; // Depth sorting
        contentContainer.addChild(sprite);
      }

      // === 4. Agents ===
      for (const agent of agents.values()) {
        if (!agent.sprite) {
          agent.sprite = createAgentGraphics(agent);
          agent.bubble = createChatBubble('');
          agent.sprite.addChild(agent.bubble);
        }
        const { sx, sy } = isoToScreen(agent.x, agent.y);
        agent.sprite.position.set(sx, sy);
        agent.sprite.zIndex = agent.x + agent.y; // Depth sorting
        contentContainer.addChild(agent.sprite);
      }

      // Sort by z-index
      contentContainer.sortChildren();

      console.log('[PixiJS] Room drawn with', contentContainer.children.length, 'objects');
    }

    // ===== GAME LOOP (Movement Interpolation) =====
    let lastTime = Date.now();
    function gameLoop(delta) {
      const now = Date.now();
      const dt = (now - lastTime) / 1000; // Delta time in seconds
      lastTime = now;

      // FPS tracking
      fpsFrames.push(now);
      fpsFrames = fpsFrames.filter(t => now - t < 1000);
      if (fpsVisible) {
        document.getElementById('fpsCounter').textContent = 'FPS: ' + fpsFrames.length;
      }

      // Interpolate agent positions
      for (const agent of agents.values()) {
        if (agent.targetX !== undefined && agent.targetY !== undefined) {
          // Lerp towards target over 500ms (0.5s)
          const lerpSpeed = 2.0; // Reaches target in ~0.5s
          agent.x += (agent.targetX - agent.x) * lerpSpeed * dt;
          agent.y += (agent.targetY - agent.y) * lerpSpeed * dt;

          // Snap when very close
          if (Math.abs(agent.x - agent.targetX) < 0.01) agent.x = agent.targetX;
          if (Math.abs(agent.y - agent.targetY) < 0.01) agent.y = agent.targetY;

          // Update sprite position
          if (agent.sprite) {
            const { sx, sy } = isoToScreen(agent.x, agent.y);
            agent.sprite.position.set(sx, sy);
            agent.sprite.zIndex = agent.x + agent.y;
          }
        }

        // Fade out chat bubble after 5s
        if (agent.bubble && agent.lastMessageTime) {
          const elapsed = now - agent.lastMessageTime;
          if (elapsed < 300) {
            agent.bubble.alpha = Math.min(1, elapsed / 300);
          } else if (elapsed > 4700) {
            agent.bubble.alpha = Math.max(0, 1 - (elapsed - 4700) / 300);
          } else {
            agent.bubble.alpha = 1;
          }
        }
      }

      // Re-sort depth (throttled on low-end devices for better FPS)
      if (now - lastSortTime >= SORT_THROTTLE_MS) {
        contentContainer.sortChildren();
        lastSortTime = now;
      }
    }

    // ===== ROOM LIST =====
    async function fetchRooms() {
      try {
        showSkeletonRooms(); // Show skeleton while loading
        const res = await fetch(API + '/api/spectate/rooms');
        
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}: ${res.statusText}`);
        }
        
        const data = await res.json();
        roomsList = data.rooms || []; // Store for swipe navigation
        allRooms = [...roomsList]; // Store for filtering
        renderRoomList(roomsList);
        
        // Clear search input when refreshing
        const searchInput = document.getElementById('roomSearchInput');
        if (searchInput) {
          searchInput.value = '';
        }
      } catch (err) {
        console.error('Failed to fetch rooms:', err);
        showError(`Failed to load rooms: ${err.message || 'Network error'}`);
        document.getElementById('roomList').innerHTML = '<div class="empty-state">⚠️ Failed to load rooms. Check your connection.</div>';
        roomsList = []; // Reset on error
        allRooms = [];
      }
    }

    async function fetchStats() {
      try {
        const res = await fetch(API + '/api/spectate/stats');
        
        if (!res.ok) {
          throw new Error(`Stats fetch failed: ${res.status}`);
        }
        
        const data = await res.json();
        document.getElementById('totalAgents').textContent = data.totalAgents || 0;
        document.getElementById('totalSpectators').textContent = data.totalSpectators || 0;
        document.getElementById('activeRooms').textContent = data.activeRooms || 0;
      } catch (err) {
        console.error('Failed to fetch stats:', err);
        // Don't show error toast for stats (non-critical)
      }
    }

    // Helper function to get room theme icon based on name
    function getRoomIcon(roomName) {
      const name = roomName.toLowerCase();
      if (name.includes('lobby') || name.includes('main') || name.includes('entrance')) return '🏨';
      if (name.includes('trading') || name.includes('trade') || name.includes('market')) return '💼';
      if (name.includes('garden') || name.includes('park') || name.includes('nature')) return '🌳';
      if (name.includes('arcade') || name.includes('game') || name.includes('play')) return '🎮';
      if (name.includes('library') || name.includes('study') || name.includes('book')) return '📚';
      if (name.includes('chill') || name.includes('lounge') || name.includes('relax')) return '🛋️';
      if (name.includes('arena') || name.includes('battle') || name.includes('combat')) return '⚔️';
      if (name.includes('cafe') || name.includes('coffee') || name.includes('restaurant')) return '☕';
      if (name.includes('pool') || name.includes('swim') || name.includes('beach')) return '🏊';
      if (name.includes('gym') || name.includes('fitness') || name.includes('sport')) return '💪';
      if (name.includes('art') || name.includes('gallery') || name.includes('museum')) return '🎨';
      if (name.includes('music') || name.includes('concert') || name.includes('band')) return '🎵';
      if (name.includes('office') || name.includes('work') || name.includes('meeting')) return '💻';
      return '🏠'; // Default
    }

    // Helper function to get room size (can be extracted from room data or estimated)
    function getRoomSize(room) {
      // If room has explicit size data, use it
      if (room.width && room.height) {
        return `${room.width}×${room.height}`;
      }
      // Otherwise, use default or estimate from room type
      const name = room.name.toLowerCase();
      if (name.includes('arena') || name.includes('large')) return '14×14';
      if (name.includes('chill') || name.includes('small')) return '10×10';
      return '12×12'; // Default
    }

    function renderRoomList(rooms) {
      const list = document.getElementById('roomList');
      if (rooms.length === 0) {
        list.innerHTML = '<div class="empty-state">No rooms available yet. Create one via the API!</div>';
        return;
      }

      // Sort by agent count (most populated first)
      const sortedRooms = [...rooms].sort((a, b) => (b.agentCount || 0) - (a.agentCount || 0));

      list.innerHTML = sortedRooms.map((room, index) => {
        const isActive = room.id === currentRoomId;
        const icon = getRoomIcon(room.name);
        const size = getRoomSize(room);
        const agentCount = room.agentCount || 0;
        const animationDelay = index * 0.05; // Stagger by 50ms
        
        return `
          <div class="room-card ${isActive ? 'active' : ''}" 
               style="animation-delay: ${animationDelay}s;"
               onclick="enterRoom('${room.id}', '${room.name.replace(/'/g, "\\'")}')">
            <div class="room-card-header">
              <div class="room-icon">${icon}</div>
              <div class="room-info">
                <div class="room-name">
                  ${escapeHtml(room.name)}
                  <span class="room-size">${size}</span>
                </div>
                <div class="room-desc">${escapeHtml(room.description || 'A virtual space for AI agents')}</div>
              </div>
            </div>
            <div class="room-meta">
              <span class="agent-badge">👥 ${agentCount} agent${agentCount !== 1 ? 's' : ''}</span>
              <span>👁 ${room.spectatorCount || 0} watching</span>
            </div>
          </div>
        `;
      }).join('');
    }

    // Filter rooms based on search input
    let allRooms = []; // Store all rooms for filtering
    
    function filterRooms() {
      const searchInput = document.getElementById('roomSearchInput');
      const query = searchInput.value.toLowerCase().trim();
      const list = document.getElementById('roomList');
      
      if (query === '') {
        // Show all rooms
        renderRoomList(allRooms);
      } else {
        // Filter rooms by name or description
        const filtered = allRooms.filter(room => 
          room.name.toLowerCase().includes(query) || 
          (room.description && room.description.toLowerCase().includes(query))
        );
        
        if (filtered.length === 0) {
          list.innerHTML = `<div class="empty-state">🔍 No rooms found matching "${escapeHtml(query)}"</div>`;
        } else {
          renderRoomList(filtered);
        }
      }
    }

    // Refresh rooms with animation
    async function refreshRooms() {
      const refreshBtn = document.querySelector('.refresh-btn');
      refreshBtn.classList.add('spinning');
      
      try {
        await fetchRooms();
      } finally {
        setTimeout(() => {
          refreshBtn.classList.remove('spinning');
        }, 600);
      }
    }

    // ===== ENTER ROOM =====
    async function enterRoom(roomId, roomName) {
      try {
        showLoading(`Entering ${roomName}...`, 'Loading room data');
        
        currentRoomId = roomId;
        currentRoomName = roomName || '';
        agents.clear();
        chatMessages = [];

        // Initialize audio system if not already done
        if (!audioContext) {
          initAudioSystem();
        }

        // Start ambient sound if enabled
        if (audioEnabled && audioContext) {
          if (audioContext.state === 'suspended') {
            audioContext.resume();
          }
          startAmbientHum();
        }

        // Switch view with fade-in transition
        const roomView = document.getElementById('roomView');
        roomView.classList.remove('fade-out'); // Clear any previous fade-out
        document.getElementById('roomSelector').classList.add('hidden');
        roomView.classList.add('active');
        document.getElementById('roomTitle').textContent = roomName;
        
        // Trigger fade-in after layout (next frame)
        requestAnimationFrame(() => {
          roomView.classList.add('fade-in');
        });

        // Clear chat
        document.getElementById('chatMessages').innerHTML = '';
        document.getElementById('agentList').innerHTML = '<h4>Agents in Room</h4>';
        document.getElementById('chatFeedMessages').innerHTML = '';
        chatFeedMessages = [];

        // Show live chat feed
        document.getElementById('liveChatFeed').style.display = 'flex';

        addChatMessage('System', `You are now spectating "${roomName}"`, true);

        // Load PixiJS lazily (first time only, then cached in memory)
        await loadPixiJS();
        // Initialize PixiJS renderer
        initPixiApp();

        // Fetch room state
        const res = await fetch(API + '/api/spectate/rooms/' + roomId);
        
        if (!res.ok) {
          throw new Error(`Room fetch failed: ${res.status} ${res.statusText}`);
        }
        
        const data = await res.json();
        
        if (data.agents && data.agents.length > 0) {
          for (const a of data.agents) {
            const x = a.x ?? Math.floor(Math.random() * 10) + 1;
            const y = a.y ?? Math.floor(Math.random() * 10) + 1;
            agents.set(a.id, {
              id: a.id,
              name: a.displayName || 'Agent',
              x: x,
              y: y,
              targetX: x,
              targetY: y,
              direction: a.direction || 2,
              color: getAgentColor(a.id),
              hairColor: getHairColor(a.id),
              sprite: null,
              bubble: null
            });
          }
          updateAgentList();
          addChatMessage('System', `${agents.size} agents in room`, true);
        } else {
          addChatMessage('System', 'No agents currently in room', true);
        }
        
        hideLoading();
      } catch (err) {
        console.error('Failed to enter room:', err);
        hideLoading();
        showError(`Failed to enter room: ${err.message || 'Network error'}`);
        
        // Return to room selector
        setTimeout(() => {
          leaveRoom();
        }, 2000);
      }

      // Draw room
      setTimeout(drawRoom, 100);

      // Connect WebSocket
      connectWS(roomId);
      addChatMessage('System', 'Watching for agent activity...', true);
    }

    function leaveRoom() {
      const roomView = document.getElementById('roomView');
      
      // Stop ambient sound
      stopAmbientHum();
      
      // Trigger fade-out transition
      roomView.classList.remove('fade-in');
      roomView.classList.add('fade-out');
      
      // Hide live chat feed
      document.getElementById('liveChatFeed').style.display = 'none';
      
      // Wait for transition to complete (400ms)
      setTimeout(() => {
        if (ws) { ws.close(); ws = null; }
        hideTooltip(); // T-341: hide any visible tooltip
        if (app) {
          app.destroy(true, { children: true, texture: true });
          app = null;
          tooltipContainer = null; // T-341: reset tooltip ref
        }
        currentRoomId = null;
        agents.clear();

        document.getElementById('roomSelector').classList.remove('hidden');
        roomView.classList.remove('active', 'fade-out');

        // Re-render room list to update "currently viewing" indicator
        fetchRooms();
        fetchStats();
      }, 400);
    }

    // ===== WEBSOCKET WITH RESILIENCE =====
    let reconnectDelay = 1000; // Start at 1s
    const MAX_RECONNECT_DELAY = 30000; // Cap at 30s
    let pingInterval = null;
    let reconnectTimeout = null;

    function connectWS(roomId) {
      if (ws) {
        clearInterval(pingInterval);
        ws.close();
      }

      updateConnectionStatus('connecting');

      ws = new WebSocket(WS_URL + '/ws/spectate?roomId=' + roomId);

      ws.onopen = () => {
        console.log('[WS] Connected to room:', roomId);
        addChatMessage('System', '🔗 Connected to room', true);
        updateConnectionStatus('connected');
        
        // Reset reconnect delay on successful connection
        reconnectDelay = 1000;
        
        // Start ping/pong heartbeat (every 30s)
        clearInterval(pingInterval);
        pingInterval = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ type: 'ping' }));
            } catch (err) {
              console.error('[WS] Ping failed:', err);
            }
          }
        }, 30000);
        
        // Request full state sync after reconnection
        if (ws && ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ type: 'requestState' }));
          } catch (err) {
            console.error('[WS] State sync request failed:', err);
          }
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleWSMessage(msg);
        } catch (err) {
          console.error('[WS] Parse error:', err);
        }
      };

      ws.onclose = (event) => {
        console.log('[WS] Disconnected', event.code, event.reason);
        clearInterval(pingInterval);
        updateConnectionStatus('disconnected');
        
        // Don't show "Disconnected" message on clean closes (user navigated away)
        if (event.code !== 1000) {
          addChatMessage('System', '🔌 Connection lost', true);
        }
        
        // Reconnect with exponential backoff
        if (currentRoomId && event.code !== 1000) {
          const delay = Math.min(reconnectDelay, MAX_RECONNECT_DELAY);
          const seconds = Math.round(delay / 1000);
          
          if (event.code === 1006) {
            showError(`Server unavailable. Reconnecting in ${seconds}s...`, delay);
          } else {
            showError(`Connection lost. Reconnecting in ${seconds}s...`, delay);
          }
          
          updateConnectionStatus('reconnecting', seconds);
          
          clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(() => {
            if (currentRoomId) {
              connectWS(currentRoomId);
              // Increase delay for next attempt (exponential backoff)
              reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
            }
          }, delay);
        }
      };

      ws.onerror = (err) => {
        console.error('[WS] Error:', err);
        updateConnectionStatus('error');
        showError('WebSocket error. Check your network connection.');
        addChatMessage('System', '⚠️ Connection error', true);
      };
    }

    function updateConnectionStatus(status, reconnectSeconds = null) {
      const indicator = document.getElementById('connectionIndicator');
      if (!indicator) return;
      
      indicator.className = 'connection-indicator';
      
      switch (status) {
        case 'connected':
          indicator.classList.add('connected');
          indicator.title = 'Connected to server';
          break;
        case 'connecting':
          indicator.classList.add('connecting');
          indicator.title = 'Connecting...';
          break;
        case 'reconnecting':
          indicator.classList.add('reconnecting');
          indicator.title = reconnectSeconds 
            ? `Reconnecting in ${reconnectSeconds}s...` 
            : 'Reconnecting...';
          break;
        case 'disconnected':
        case 'error':
          indicator.classList.add('disconnected');
          indicator.title = 'Disconnected from server';
          break;
      }
    }

    function handleWSMessage(msg) {
      switch (msg.type) {
        case 'room.state':
          if (msg.agents) {
            agents.clear();
            for (const a of msg.agents) {
              const x = a.x || Math.floor(Math.random() * 12) + 2;
              const y = a.y || Math.floor(Math.random() * 12) + 2;
              agents.set(a.id, {
                id: a.id,
                name: a.displayName || a.name || 'Agent',
                x: x,
                y: y,
                targetX: x,
                targetY: y,
                direction: a.direction || 0,
                color: getAgentColor(a.id),
                hairColor: getHairColor(a.id),
                sprite: null,
                bubble: null
              });
            }
            updateAgentList();
            drawRoom();
          }
          break;

        case 'agent.join':
          const x = msg.x || Math.floor(Math.random() * 10) + 1;
          const y = msg.y || Math.floor(Math.random() * 10) + 1;
          agents.set(msg.agentId, {
            id: msg.agentId,
            name: msg.displayName || 'Agent',
            x: x,
            y: y,
            targetX: x,
            targetY: y,
            direction: 0,
            color: getAgentColor(msg.agentId),
            hairColor: getHairColor(msg.agentId),
            sprite: null,
            bubble: null
          });
          addChatMessage('System', `🤖 ${msg.displayName || 'Agent'} entered the room`, true);
          updateAgentList();
          drawRoom();
          break;

        case 'agent.leave':
          const leaving = agents.get(msg.agentId);
          if (leaving && leaving.sprite) {
            contentContainer.removeChild(leaving.sprite);
          }
          agents.delete(msg.agentId);
          addChatMessage('System', `👋 ${leaving?.name || 'Agent'} left the room`, true);
          updateAgentList();
          break;

        case 'agent.move':
        case 'agent.moved':
          const mover = agents.get(msg.agentId);
          if (mover) {
            // Check if this is actual movement (not just rotation)
            const hasMoved = mover.targetX !== msg.x || mover.targetY !== msg.y;
            
            mover.targetX = msg.x;
            mover.targetY = msg.y;
            mover.direction = msg.rotation || msg.direction || mover.direction;
            
            // Play whoosh sound on movement
            if (hasMoved) {
              playWhooshSound();
              setAgentStatus(msg.agentId, 'moving'); // T-340 status badge
            }
          }
          break;

        case 'agent.chat':
        case 'chat.message':
        case 'message.new':
          const chatter = agents.get(msg.agentId);
          const chatText = msg.message || msg.text || msg.content || '';
          if (chatter) {
            chatter.lastMessage = chatText;
            chatter.lastMessageTime = Date.now();
            
            // Update bubble
            if (chatter.bubble) {
              chatter.sprite.removeChild(chatter.bubble);
            }
            chatter.bubble = createChatBubble(chatText);
            chatter.sprite.addChild(chatter.bubble);
            setAgentStatus(msg.agentId, 'chat'); // T-340 status badge
          }
          addChatMessage(
            msg.displayName || chatter?.name || 'Agent',
            chatText
          );
          break;

        case 'agent.action':
          addChatMessage('System', `✨ ${msg.displayName || 'Agent'}: ${msg.action}`, true);
          break;

        // ===== ACTIVITY FEED EVENTS (T-337) =====
        case 'furniture_use': {
          const agent = agents.get(msg.agentId);
          addActivityEvent('furniture_use', msg.agentId, {
            agentName: msg.displayName || agent?.name,
            furnitureName: msg.furnitureName || msg.furniture || msg.itemName,
          });
          setAgentStatus(msg.agentId, 'furniture'); // T-340 status badge
          break;
        }

        case 'game_invite': {
          const inviter = agents.get(msg.agentId);
          const invitee = agents.get(msg.targetId);
          addActivityEvent('game_invite', msg.agentId, {
            agentName: msg.displayName || inviter?.name,
            targetName: msg.targetDisplayName || invitee?.name || msg.targetId,
            game: msg.game || msg.gameType || 'TicTacToe',
          });
          // Also add to chat as system msg for visibility
          addChatMessage('System', `🎮 ${msg.displayName || inviter?.name || 'Agent'} invited ${msg.targetDisplayName || invitee?.name || 'someone'} to play ${msg.game || 'a game'}!`, true);
          setAgentStatus(msg.agentId, 'game'); // T-340 status badge
          break;
        }

        case 'trade_offer': {
          const trader = agents.get(msg.agentId);
          const tradee = agents.get(msg.targetId);
          addActivityEvent('trade_offer', msg.agentId, {
            agentName: msg.displayName || trader?.name,
            targetName: msg.targetDisplayName || tradee?.name || msg.targetId,
          });
          // Also add to chat
          addChatMessage('System', `💱 ${msg.displayName || trader?.name || 'Agent'} offered a trade to ${msg.targetDisplayName || tradee?.name || 'someone'}`, true);
          setAgentStatus(msg.agentId, 'trade'); // T-340 status badge
          break;
        }

        case 'emote': {
          const emoteAgent = agents.get(msg.agentId);
          const emoteValue = msg.emote || msg.action;
          // Activity feed entry
          addActivityEvent('emote', msg.agentId, {
            agentName: msg.displayName || emoteAgent?.name,
            emote: emoteValue,
          });
          // Visual floating emoji above sprite (T-338)
          if (emoteAgent) {
            showEmoteEffect(emoteAgent, emoteValue);
          }
          setAgentStatus(msg.agentId, 'emote'); // T-340 status badge
          break;
        }

        case 'room.update':
          if (msg.agentCount !== undefined) {
            document.getElementById('roomAgentCount').textContent = msg.agentCount;
          }
          if (msg.spectatorCount !== undefined) {
            document.getElementById('roomSpectatorCount').textContent = msg.spectatorCount;
          }
          break;

        case 'spectator.connected':
          console.log('[WS] Spectator connected, room:', msg.roomId);
          break;

        case 'pong':
          break;

        default:
          console.log('[WS] Unknown message type:', msg.type, msg);
      }
    }

    // ===== SIDEBAR TABS (T-337) =====
    function switchSidebarTab(tab) {
      // Deactivate all tabs and panes
      document.querySelectorAll('.sidebar-tab').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
      // Activate selected
      const tabEl = document.getElementById('tab-' + tab);
      const paneEl = document.getElementById('pane-' + tab);
      if (tabEl) tabEl.classList.add('active');
      if (paneEl) paneEl.classList.add('active');
      // Badge: clear activity count when opening the feed
      if (tab === 'activity') {
        const badge = document.getElementById('activityBadge');
        if (badge) badge.style.display = 'none';
        _activityUnread = 0;
      }
    }

    // ===== ACTIVITY FEED (T-337) =====
    let activityEvents = [];
    const MAX_ACTIVITY_EVENTS = 50;
    let _activityUnread = 0;

    const ACTIVITY_CONFIG = {
      furniture_use: {
        icon: '🪑',
        cls:  'furniture',
        label: (msg) => `used ${msg.furnitureName || 'furniture'}`,
      },
      game_invite: {
        icon: '🎮',
        cls:  'game',
        label: (msg) => `invited ${msg.targetName || 'someone'} to play ${msg.game || 'a game'}`,
      },
      trade_offer: {
        icon: '💱',
        cls:  'trade',
        label: (msg) => `offered a trade to ${msg.targetName || 'another agent'}`,
      },
      emote: {
        icon: '🎭',
        cls:  'emote',
        label: (msg) => `performed emote: ${msg.emote || msg.action || '✨'}`,
      },
      move: {
        icon: '🚶',
        cls:  'system',
        label: (msg) => `moved to (${msg.x ?? '?'}, ${msg.y ?? '?'})`,
      },
    };

    function addActivityEvent(type, agentId, extra = {}) {
      const cfg = ACTIVITY_CONFIG[type];
      if (!cfg) return;

      const agent = agents.get(agentId) || { name: extra.agentName || 'Agent' };
      const entry = {
        type,
        agentId,
        agentName: agent.name,
        icon: cfg.icon,
        cls: cfg.cls,
        description: cfg.label({ ...extra, agentId }),
        timestamp: Date.now(),
      };

      activityEvents.unshift(entry);
      if (activityEvents.length > MAX_ACTIVITY_EVENTS) {
        activityEvents = activityEvents.slice(0, MAX_ACTIVITY_EVENTS);
      }

      renderActivityFeed();

      // Badge on chat tab if activity pane not visible
      const actPane = document.getElementById('pane-activity');
      if (!actPane || !actPane.classList.contains('active')) {
        _activityUnread++;
        let badge = document.getElementById('activityBadge');
        if (!badge) {
          const tabEl = document.getElementById('tab-activity');
          if (tabEl) {
            badge = document.createElement('span');
            badge.id = 'activityBadge';
            badge.style.cssText = 'display:inline-block;background:#f4a261;color:#000;border-radius:10px;font-size:10px;padding:1px 5px;margin-left:4px;font-weight:700;';
            tabEl.appendChild(badge);
          }
        }
        if (badge) {
          badge.style.display = 'inline-block';
          badge.textContent = _activityUnread > 9 ? '9+' : _activityUnread;
        }
      }
    }

    function renderActivityFeed() {
      const feed = document.getElementById('activityFeed');
      if (!feed) return;

      if (activityEvents.length === 0) {
        feed.innerHTML = `
          <div class="activity-empty">
            <div class="activity-empty-icon">📡</div>
            <div>Waiting for agent activity…</div>
          </div>`;
        return;
      }

      // Rebuild only if changed (avoid thrashing)
      const fragment = document.createDocumentFragment();
      for (const ev of activityEvents) {
        const div = document.createElement('div');
        div.className = `activity-entry ${ev.cls}`;
        const timeStr = new Date(ev.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        div.innerHTML = `
          <div class="activity-icon">${escapeHtml(ev.icon)}</div>
          <div class="activity-body">
            <div class="activity-agent">${escapeHtml(ev.agentName)}</div>
            <div class="activity-desc">${escapeHtml(ev.description)}</div>
            <div class="activity-ts">${timeStr}</div>
          </div>`;
        fragment.appendChild(div);
      }
      feed.innerHTML = '';
      feed.appendChild(fragment);
    }

    // ===== CHAT =====
    function addChatMessage(sender, text, isSystem = false) {
      const container = document.getElementById('chatMessages');
      const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      const div = document.createElement('div');
      div.className = 'chat-msg' + (isSystem ? ' system' : '');
      div.innerHTML = `
        <div class="sender">${sender}</div>
        <div class="text">${escapeHtml(text)}</div>
        <div class="time">${time}</div>
      `;
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;

      while (container.children.length > 100) {
        container.removeChild(container.firstChild);
      }

      // Play ping sound for non-system messages
      if (!isSystem) {
        playPingSound();
      }

      // Also add to live chat feed
      addChatFeedMessage(sender, text, isSystem);
    }

    function addChatFeedMessage(sender, text, isSystem = false) {
      const container = document.getElementById('chatFeedMessages');
      if (!container) return;

      const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      const div = document.createElement('div');
      div.className = 'chat-feed-message' + (isSystem ? ' chat-feed-system' : '');
      div.innerHTML = `
        <div>
          <span class="chat-feed-agent-name">[${escapeHtml(sender)}]:</span>
          <span>${escapeHtml(text)}</span>
        </div>
        <span class="chat-feed-timestamp">${time}</span>
      `;
      
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;

      // Keep only last 50 messages
      chatFeedMessages.push({ sender, text, time, isSystem });
      if (chatFeedMessages.length > MAX_CHAT_FEED_MESSAGES) {
        chatFeedMessages.shift();
        if (container.firstChild) {
          container.removeChild(container.firstChild);
        }
      }
    }

    function toggleChatFeed() {
      const feed = document.getElementById('liveChatFeed');
      feed.classList.toggle('minimized');
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // ===== AGENT STATUS BADGES (T-340) =====
    const AGENT_STATUS_ICONS = {
      chat:       '💬',
      furniture:  '🪑',
      game:       '🎮',
      trade:      '💱',
      emote:      '🎭',
      moving:     '🚶',
    };
    const STATUS_CLEAR_DELAY = 5000; // ms — status auto-clears after 5s

    /** Set agent status and schedule auto-clear */
    function setAgentStatus(agentId, status) {
      const agent = agents.get(agentId);
      if (!agent) return;
      // Clear any pending timer
      if (agent._statusTimer) clearTimeout(agent._statusTimer);
      agent.status = status;
      agent._statusTimer = setTimeout(() => {
        const a = agents.get(agentId);
        if (a && a.status === status) {
          delete a.status;
          delete a._statusTimer;
          updateAgentList();
        }
      }, STATUS_CLEAR_DELAY);
      updateAgentList();
    }

    // ===== AGENT LIST =====
    function updateAgentList() {
      const list = document.getElementById('agentList');
      let html = '<h4>Agents in Room (' + agents.size + ')</h4>';
      for (const [id, agent] of agents) {
        const badge = agent.status && AGENT_STATUS_ICONS[agent.status]
          ? `<span class="agent-status-badge" title="${agent.status}">${AGENT_STATUS_ICONS[agent.status]}</span>`
          : '';
        html += `<div class="agent-item" style="cursor: pointer;" onclick="showAgentInfo('${id}')">
          <div class="agent-dot" style="background:${agent.color}"></div>
          <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(agent.name)}</span>
          ${badge}
        </div>`;
      }
      list.innerHTML = html;
      document.getElementById('roomAgentCount').textContent = agents.size;
    }

    // ===== AGENT INFO PANEL =====
    async function showAgentInfo(agentId) {
      const panel = document.getElementById('agentInfoPanel');
      const agent = agents.get(agentId);
      
      if (!agent) {
        console.error('Agent not found:', agentId);
        return;
      }

      // Show panel immediately with loading state
      panel.classList.add('active');
      
      // Set basic info
      document.getElementById('agentInfoName').textContent = agent.name;
      document.getElementById('agentInfoBio').innerHTML = '<div class="loading-spinner-small"></div>';
      document.getElementById('personalityTraits').innerHTML = '<div class="loading-spinner-small"></div>';
      document.getElementById('agentRelationships').innerHTML = '<div class="loading-spinner-small"></div>';
      document.getElementById('agentActivity').innerHTML = '<div class="loading-spinner-small"></div>';

      try {
        // Single unified spectator endpoint — no auth required, returns all public data
        const profileRes = await fetch(`${API}/api/spectate/agents/${agentId}`);
        if (!profileRes.ok) {
          throw new Error(`Agent profile fetch failed: ${profileRes.status}`);
        }
        const data = await profileRes.json();

        // Update name with emoji based on personality archetype
        const emoji = getArchetypeEmoji(data.personality?.archetype);
        document.getElementById('agentInfoName').textContent = `${emoji} ${data.displayName || agent.name}`;

        // Update mood
        const moodEmoji = getMoodEmoji(data.mood || 'neutral');
        const moodText = capitalize(data.mood || 'Neutral');
        document.getElementById('moodEmoji').textContent = moodEmoji;
        document.getElementById('moodText').textContent = moodText;

        // Update bio + platform badge
        const platformBadge = data.platform ? `<span class="platform-badge">${data.platform}</span>` : '';
        document.getElementById('agentInfoBio').innerHTML =
          `${platformBadge}${escapeHtml(data.bio || 'No bio available.')}`;

        // Update personality traits (OCEAN)
        const pd = data.personality;
        if (pd) {
          const traits = [
            { name: 'Openness (Curiosity)',       value: pd.curiosity    || 50 },
            { name: 'Conscientiousness',           value: pd.conscientiousness || 50 },
            { name: 'Extraversion (Sociability)', value: pd.sociability  || 50 },
            { name: 'Agreeableness (Generosity)', value: pd.generosity   || 50 },
            { name: 'Neuroticism (Volatility)',   value: pd.volatility   || 50 },
          ];

          let traitsHtml = '';
          for (const trait of traits) {
            const pct = Math.round(trait.value);
            traitsHtml += `
              <div class="personality-trait">
                <div class="trait-label">
                  <span>${escapeHtml(trait.name)}</span>
                  <span>${pct}%</span>
                </div>
                <div class="trait-bar">
                  <div class="trait-fill" style="width: ${pct}%"></div>
                </div>
              </div>
            `;
          }
          if (pd.archetype) {
            traitsHtml += `<div class="agent-archetype">Archetype: <strong>${escapeHtml(pd.archetype)}</strong></div>`;
          }
          document.getElementById('personalityTraits').innerHTML = traitsHtml;
        } else {
          document.getElementById('personalityTraits').innerHTML =
            '<div style="color:#888;font-size:13px;">Personality data not available</div>';
        }

        // Update relationships (real friends data from API)
        const friends = data.friends;
        if (friends && friends.count > 0) {
          let friendsHtml = `<div class="friends-count">🤝 ${friends.count} friend${friends.count !== 1 ? 's' : ''}</div>`;
          if (friends.topFriends && friends.topFriends.length > 0) {
            friendsHtml += '<div class="friends-list">';
            for (const f of friends.topFriends) {
              friendsHtml += `<div class="friend-item">• ${escapeHtml(f.name)}</div>`;
            }
            if (friends.count > 3) {
              friendsHtml += `<div class="friend-item" style="color:#888;">...and ${friends.count - 3} more</div>`;
            }
            friendsHtml += '</div>';
          }
          document.getElementById('agentRelationships').innerHTML = friendsHtml;
        } else {
          document.getElementById('agentRelationships').innerHTML =
            '<div style="color:#888;font-size:13px;">No friends yet</div>';
        }

        // Update recent activity (real data + current room context)
        const activityItems = [];

        // Always show "currently in this room"
        activityItems.push({
          icon: '📍',
          text: `Spectating in "${escapeHtml(currentRoomName)}"`,
          time: 'Now',
        });

        // Show last message if available
        if (agent.lastMessage) {
          activityItems.push({
            icon: '💬',
            text: `Said: "${escapeHtml(truncate(agent.lastMessage, 35))}"`,
            time: 'Recently',
          });
        }

        // Add server-side activity logs
        if (data.recentActivity && data.recentActivity.length > 0) {
          for (const act of data.recentActivity.slice(0, 3)) {
            activityItems.push({
              icon: getActivityIcon(act.type),
              text: escapeHtml(act.description),
              time: formatRelativeTime(act.timestamp),
            });
          }
        }

        // Add stats summary if available
        const stats = data.stats;
        if (stats && Object.keys(stats).length > 0) {
          const statsHtml = [
            stats.messagesSent   ? `💬 ${stats.messagesSent} messages` : null,
            stats.roomsVisited   ? `🚪 ${stats.roomsVisited} rooms visited` : null,
            stats.tradesCompleted ? `🔄 ${stats.tradesCompleted} trades` : null,
            stats.gamesWon       ? `🏆 ${stats.gamesWon} games won` : null,
          ].filter(Boolean).join(' · ');
          if (statsHtml) {
            activityItems.push({ icon: '📊', text: statsHtml, time: '' });
          }
        }

        document.getElementById('agentActivity').innerHTML = activityItems.map(item => `
          <div class="activity-item">
            <div>${item.icon} ${item.text}</div>
            ${item.time ? `<div class="activity-time">${item.time}</div>` : ''}
          </div>
        `).join('');

      } catch (error) {
        console.error('Failed to load agent info:', error);
        document.getElementById('personalityTraits').innerHTML =
          '<div class="error-message">Failed to load personality</div>';
        document.getElementById('agentInfoBio').innerHTML =
          '<div class="error-message">Failed to load profile</div>';
        document.getElementById('agentRelationships').innerHTML = '';
        document.getElementById('agentActivity').innerHTML = '';
      }
    }

    function closeAgentInfo() {
      document.getElementById('agentInfoPanel').classList.remove('active');
    }

    function getArchetypeEmoji(archetype) {
      const emojis = {
        'explorer': '🧭',
        'socialite': '🎭',
        'competitor': '🏆',
        'helper': '💝',
        'rebel': '⚡',
        'leader': '👑',
        'analyst': '🔬',
        'artist': '🎨',
      };
      return emojis[archetype?.toLowerCase()] || '🤖';
    }

    function getMoodEmoji(mood) {
      const emojis = {
        'happy': '😊',
        'sad': '😢',
        'excited': '🤩',
        'busy': '😤',
        'away': '🌙',
        'neutral': '😐',
        'angry': '😠',
        'sleepy': '😴',
        'creative': '💡',
        'social': '🎉',
      };
      return emojis[mood?.toLowerCase()] || '😐';
    }

    function capitalize(str) {
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function truncate(str, maxLen) {
      return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
    }

    /** Map activity event type to an emoji icon */
    function getActivityIcon(type) {
      const icons = {
        chat: '💬', move: '🚶', trade: '🔄', emote: '🎭',
        join: '🚪', leave: '👋', game: '🎮', friend: '🤝',
        craft: '⚒️', buy: '🛍️', achievement: '🏆',
      };
      return icons[type] || '📌';
    }

    /** Format ISO timestamp as relative "2h ago", "3d ago", etc. */
    function formatRelativeTime(isoString) {
      if (!isoString) return '';
      try {
        const diff = Date.now() - new Date(isoString).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
      } catch {
        return '';
      }
    }

    // ===== COLORS =====
    const AGENT_COLORS = ['#61dafb', '#ff6b6b', '#4caf50', '#ffd93d', '#a855f7', '#f97316', '#ec4899', '#14b8a6'];
    const HAIR_COLORS = ['#4a3728', '#1a1a1a', '#8B4513', '#D4A017', '#C0392B', '#2C3E50', '#7B3F00', '#E8D5B7'];
    function getAgentColor(id) {
      let hash = 0;
      for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i);
      return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
    }
    function getHairColor(id) {
      let hash = 0;
      for (let i = 0; i < id.length; i++) hash = ((hash << 3) + hash) + id.charCodeAt(i);
      return HAIR_COLORS[Math.abs(hash) % HAIR_COLORS.length];
    }

    // ===== TOUCH CONTROLS =====
    function setupTouchControls(container) {
      // Make agent sprites interactive
      contentContainer.interactive = true;
      contentContainer.on('pointerdown', (e) => {
        if (!isMobile) return;
        const localPos = e.data.getLocalPosition(contentContainer);
        
        // Check if tapped on an agent
        for (const agent of agents.values()) {
          if (agent.sprite) {
            const dist = Math.hypot(
              localPos.x - agent.sprite.x,
              localPos.y - agent.sprite.y
            );
            if (dist < 50) {
              showAgentProfile(agent);
              return;
            }
          }
        }
      });

      // Swipe for room navigation (future feature)
      let swipeStartX = 0;
      container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
          swipeStartX = e.touches[0].clientX;
        } else if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          touchStartDist = Math.hypot(dx, dy);
        }
      }, { passive: true });

      container.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
          // Pan
          const dx = e.touches[0].clientX - touchStartX;
          const dy = e.touches[0].clientY - touchStartY;
          panX += dx * 0.5;
          panY += dy * 0.5;
          worldContainer.position.set(panX, panY);
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
          // Pinch to zoom
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.hypot(dx, dy);
          const scale = dist / touchStartDist;
          currentZoom = Math.max(0.5, Math.min(2.5, currentZoom * scale));
          worldContainer.scale.set(currentZoom);
          touchStartDist = dist;
        }
      }, { passive: true });

      container.addEventListener('touchend', (e) => {
        // Detect swipe for room navigation
        if (e.changedTouches.length === 1) {
          const endX = e.changedTouches[0].clientX;
          const swipeDist = endX - swipeStartX;
          
          if (Math.abs(swipeDist) > 100 && currentRoomId && roomsList.length > 1) {
            // Find current room index
            const currentIndex = roomsList.findIndex(r => r.id === currentRoomId);
            if (currentIndex !== -1) {
              let nextIndex;
              if (swipeDist > 0) {
                // Swipe right → previous room
                nextIndex = currentIndex === 0 ? roomsList.length - 1 : currentIndex - 1;
              } else {
                // Swipe left → next room
                nextIndex = currentIndex === roomsList.length - 1 ? 0 : currentIndex + 1;
              }
              
              const nextRoom = roomsList[nextIndex];
              console.log('[Touch] Swipe navigation:', nextRoom.name);
              leaveRoom();
              setTimeout(() => {
                enterRoom(nextRoom.id, nextRoom.name);
              }, 450); // Wait for fade-out transition
            }
          }
        }
      }, { passive: true });

      // Double-tap to toggle FPS
      let lastTap = 0;
      container.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTap < 300) {
          toggleFPS();
        }
        lastTap = now;
      }, { passive: true });
    }

    // ===== MOBILE UI HELPERS =====
    function toggleChat() {
      const sidebar = document.querySelector('.chat-sidebar');
      sidebar.classList.toggle('expanded');
    }

    function showAgentProfile(agent) {
      const profile = document.getElementById('agentProfile');
      const profileName = document.getElementById('profileName');
      const profileContent = document.getElementById('profileContent');
      
      profileName.textContent = agent.name;
      profileContent.innerHTML = `
        <p><strong>Position:</strong> (${Math.round(agent.x)}, ${Math.round(agent.y)})</p>
        <p><strong>Color:</strong> <span style="color:${agent.color}">${agent.color}</span></p>
        <p><strong>Last Message:</strong> ${agent.lastMessage || 'None'}</p>
        <p><strong>Agent ID:</strong> ${agent.id}</p>
      `;
      
      profile.classList.add('active');
      selectedAgent = agent;
    }

    function closeAgentProfile() {
      document.getElementById('agentProfile').classList.remove('active');
      selectedAgent = null;
    }

    function toggleFPS() {
      fpsVisible = !fpsVisible;
      const counter = document.getElementById('fpsCounter');
      if (fpsVisible) {
        counter.classList.add('active');
      } else {
        counter.classList.remove('active');
      }
    }

    // ===== ONBOARDING =====
    function showOnboarding() {
      const overlay = document.getElementById('onboardingOverlay');
      overlay.classList.add('active');
    }

    function dismissOnboarding() {
      const overlay = document.getElementById('onboardingOverlay');
      const dontShowAgain = document.getElementById('dontShowAgain').checked;
      
      overlay.classList.remove('active');
      
      if (dontShowAgain) {
        localStorage.setItem('openclaw-hotel-onboarding-dismissed', 'true');
      }
    }

    function checkFirstVisit() {
      const dismissed = localStorage.getItem('openclaw-hotel-onboarding-dismissed');
      if (!dismissed) {
        // Show after a brief delay for better UX
        setTimeout(() => {
          showOnboarding();
        }, 800);
      }
    }

    // ===== FEEDBACK WIDGET =====
    function openFeedbackModal() {
      document.getElementById('feedbackModal').classList.add('active');
      document.getElementById('feedbackTextarea').focus();
    }

    function closeFeedbackModal() {
      document.getElementById('feedbackModal').classList.remove('active');
      document.getElementById('feedbackTextarea').value = '';
    }

    async function submitFeedback() {
      const textarea = document.getElementById('feedbackTextarea');
      const feedback = textarea.value.trim();
      
      if (!feedback) {
        showError('Please enter some feedback');
        return;
      }

      const submitBtn = document.querySelector('.feedback-submit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';

      try {
        const response = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            feedback,
            room: currentRoomName || 'Room Selector',
            roomId: currentRoomId || null,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            path: window.location.pathname,
            referrer: document.referrer || null,
          }),
        });

        if (response.ok) {
          closeFeedbackModal();
          showSuccessToast();
        } else {
          showError('Failed to send feedback. Please try again.');
        }
      } catch (error) {
        console.error('Feedback error:', error);
        showError('Network error. Please check your connection.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Feedback';
      }
    }

    function showSuccessToast() {
      const toast = document.getElementById('successToast');
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }

    // ===== ANALYTICS =====
    async function trackPageview() {
      try {
        await fetch('/api/analytics/pageview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: window.location.pathname,
            referrer: document.referrer || null,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
            },
          }),
        });
      } catch (error) {
        console.error('Analytics error:', error);
        // Silently fail - don't disrupt user experience
      }
    }

    // Track pageview on load
    trackPageview();

    // ===== AMBIENT AUDIO SYSTEM =====
    let audioContext = null;
    let ambientOscillator = null;
    let ambientGain = null;
    let masterGain = null;
    let audioEnabled = false;
    let currentVolume = 0.5;

    // Initialize audio system (lazy-loaded on first user interaction)
    function initAudioSystem() {
      if (audioContext) return; // Already initialized

      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Master gain (volume control)
        masterGain = audioContext.createGain();
        masterGain.connect(audioContext.destination);
        masterGain.gain.value = currentVolume;

        console.log('[Audio] System initialized');
      } catch (error) {
        console.error('[Audio] Failed to initialize:', error);
        showError('Audio not supported in this browser', 3000);
      }
    }

    // Start ambient background hum
    function startAmbientHum() {
      if (!audioContext || ambientOscillator) return;

      try {
        // Create low-frequency oscillator for ambient hum
        ambientOscillator = audioContext.createOscillator();
        ambientGain = audioContext.createGain();

        // Very low frequency (40 Hz) for deep ambient sound
        ambientOscillator.type = 'sine';
        ambientOscillator.frequency.value = 40;

        // Very quiet (0.03 = 3% volume)
        ambientGain.gain.value = 0.03;

        // Add slight frequency variation for organic feel
        const lfo = audioContext.createOscillator();
        const lfoGain = audioContext.createGain();
        lfo.frequency.value = 0.1; // Slow variation
        lfoGain.gain.value = 2; // ±2 Hz variation
        lfo.connect(lfoGain);
        lfoGain.connect(ambientOscillator.frequency);
        lfo.start();

        // Connect to master gain
        ambientOscillator.connect(ambientGain);
        ambientGain.connect(masterGain);

        // Start with fade-in
        ambientGain.gain.setValueAtTime(0, audioContext.currentTime);
        ambientGain.gain.linearRampToValueAtTime(0.03, audioContext.currentTime + 2);
        
        ambientOscillator.start();
        console.log('[Audio] Ambient hum started');
      } catch (error) {
        console.error('[Audio] Failed to start ambient hum:', error);
      }
    }

    // Stop ambient hum
    function stopAmbientHum() {
      if (!ambientOscillator) return;

      try {
        // Fade out
        ambientGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1);
        
        setTimeout(() => {
          if (ambientOscillator) {
            ambientOscillator.stop();
            ambientOscillator.disconnect();
            ambientOscillator = null;
          }
          if (ambientGain) {
            ambientGain.disconnect();
            ambientGain = null;
          }
        }, 1000);

        console.log('[Audio] Ambient hum stopped');
      } catch (error) {
        console.error('[Audio] Failed to stop ambient hum:', error);
      }
    }

    // Play ping sound (chat message)
    function playPingSound() {
      if (!audioContext || !audioEnabled) return;

      try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        // Pleasant notification tone (E6 = 1318.51 Hz)
        oscillator.frequency.value = 1318.51;
        oscillator.type = 'sine';

        // Quick envelope (attack-decay)
        const now = audioContext.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.15, now + 0.01); // Attack
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2); // Decay

        oscillator.connect(gainNode);
        gainNode.connect(masterGain);

        oscillator.start(now);
        oscillator.stop(now + 0.2);
      } catch (error) {
        console.error('[Audio] Failed to play ping:', error);
      }
    }

    // Play whoosh sound (agent movement)
    function playWhooshSound() {
      if (!audioContext || !audioEnabled) return;

      try {
        const now = audioContext.currentTime;
        
        // Create noise buffer for whoosh effect
        const bufferSize = audioContext.sampleRate * 0.3; // 300ms
        const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        // Generate pink noise (more natural than white noise)
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        }

        const source = audioContext.createBufferSource();
        source.buffer = buffer;

        // Filter to make it sound like wind/movement
        const filter = audioContext.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 800; // Cut low frequencies
        filter.Q.value = 0.5;

        const gainNode = audioContext.createGain();
        
        // Envelope (fade in/out)
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.08, now + 0.05); // Quick attack
        gainNode.gain.linearRampToValueAtTime(0.05, now + 0.15); // Sustain
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3); // Fade out

        source.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(masterGain);

        source.start(now);
      } catch (error) {
        console.error('[Audio] Failed to play whoosh:', error);
      }
    }

    // Toggle audio on/off
    function toggleAudio() {
      if (!audioContext) {
        initAudioSystem();
      }

      audioEnabled = !audioEnabled;
      
      const button = document.getElementById('audioButton');
      button.textContent = audioEnabled ? '🔊' : '🔇';
      button.classList.toggle('muted', !audioEnabled);
      button.title = audioEnabled ? 'Mute ambient sound' : 'Unmute ambient sound';

      if (audioEnabled) {
        // Resume audio context (required by browser autoplay policy)
        if (audioContext.state === 'suspended') {
          audioContext.resume();
        }
        startAmbientHum();
        console.log('[Audio] Enabled');
      } else {
        stopAmbientHum();
        console.log('[Audio] Disabled');
      }

      // Save preference
      localStorage.setItem('openclaw-audio-enabled', audioEnabled ? 'true' : 'false');
    }

    // Update volume
    function updateVolume(value) {
      currentVolume = value / 100;
      
      if (masterGain) {
        masterGain.gain.value = currentVolume;
      }

      // Update UI
      document.getElementById('volumeValue').textContent = value + '%';
      document.getElementById('volumeSlider').style.setProperty('--volume-percent', value + '%');

      // Save preference
      localStorage.setItem('openclaw-audio-volume', value);
    }

    // Load audio preferences from localStorage
    function loadAudioPreferences() {
      const savedEnabled = localStorage.getItem('openclaw-audio-enabled');
      const savedVolume = localStorage.getItem('openclaw-audio-volume');

      // Default: muted (browser autoplay policy)
      audioEnabled = savedEnabled === 'true';

      if (savedVolume !== null) {
        const volume = parseInt(savedVolume, 10);
        document.getElementById('volumeSlider').value = volume;
        updateVolume(volume);
      }

      // Update button state
      const button = document.getElementById('audioButton');
      button.textContent = audioEnabled ? '🔊' : '🔇';
      button.classList.toggle('muted', !audioEnabled);
      button.title = audioEnabled ? 'Mute ambient sound' : 'Unmute ambient sound';
    }

    // ===== THEME TOGGLE =====
    function toggleTheme() {
      const body = document.body;
      const button = document.getElementById('themeToggle');
      const isLightMode = body.classList.toggle('light-mode');
      
      // Update button icon
      button.textContent = isLightMode ? '☀️' : '🌙';
      button.title = isLightMode ? 'Switch to dark mode' : 'Switch to light mode';
      
      // Save preference to localStorage
      localStorage.setItem('openclaw-theme', isLightMode ? 'light' : 'dark');
      
      console.log('[Theme] Switched to', isLightMode ? 'light' : 'dark', 'mode');
    }

    // Load theme preference from localStorage
    function loadThemePreference() {
      const savedTheme = localStorage.getItem('openclaw-theme');
      const button = document.getElementById('themeToggle');
      
      // Default: dark mode
      const isLightMode = savedTheme === 'light';
      
      if (isLightMode) {
        document.body.classList.add('light-mode');
        button.textContent = '☀️';
        button.title = 'Switch to dark mode';
      } else {
        button.textContent = '🌙';
        button.title = 'Switch to light mode';
      }
      
      console.log('[Theme] Loaded preference:', savedTheme || 'dark (default)');
    }

    // ===== INIT =====
    document.getElementById('backBtn').addEventListener('click', leaveRoom);
    
    // FPS counter toggle
    document.getElementById('fpsCounter').addEventListener('click', toggleFPS);
    
    // Mobile chat header toggle
    if (isMobile) {
      document.querySelector('.chat-header').addEventListener('click', toggleChat);
    }

    // ===== KEYBOARD NAVIGATION (T-342) =====
    const PAN_STEP = 40; // pixels per keypress
    const ZOOM_STEP = 0.15;
    const ZOOM_MIN = 0.4;
    const ZOOM_MAX = 3.0;

    document.addEventListener('keydown', (e) => {
      // Ignore when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        // ── Pan with arrow keys ──
        case 'ArrowLeft':
          if (app && worldContainer) { panX += PAN_STEP; worldContainer.position.set(panX, panY); e.preventDefault(); }
          break;
        case 'ArrowRight':
          if (app && worldContainer) { panX -= PAN_STEP; worldContainer.position.set(panX, panY); e.preventDefault(); }
          break;
        case 'ArrowUp':
          if (app && worldContainer) { panY += PAN_STEP; worldContainer.position.set(panX, panY); e.preventDefault(); }
          break;
        case 'ArrowDown':
          if (app && worldContainer) { panY -= PAN_STEP; worldContainer.position.set(panX, panY); e.preventDefault(); }
          break;

        // ── Zoom with + / - (and = as alias for +) ──
        case '+':
        case '=':
          if (app && worldContainer) {
            currentZoom = Math.min(ZOOM_MAX, currentZoom + ZOOM_STEP);
            worldContainer.scale.set(currentZoom);
            e.preventDefault();
          }
          break;
        case '-':
          if (app && worldContainer) {
            currentZoom = Math.max(ZOOM_MIN, currentZoom - ZOOM_STEP);
            worldContainer.scale.set(currentZoom);
            e.preventDefault();
          }
          break;

        // ── Reset zoom to 1 with 0 ──
        case '0':
          if (app && worldContainer) {
            currentZoom = 1.0;
            panX = 0; panY = 0;
            worldContainer.scale.set(currentZoom);
            worldContainer.position.set(panX, panY);
            e.preventDefault();
          }
          break;

        // ── Escape → leave room ──
        case 'Escape':
          if (currentRoomId) { leaveRoom(); e.preventDefault(); }
          break;

        // ── Number keys 1-9 → jump to room N (sorted by activity) ──
        default:
          if (e.key >= '1' && e.key <= '9' && !currentRoomId) {
            const idx = parseInt(e.key, 10) - 1;
            if (roomsList[idx]) {
              enterRoom(roomsList[idx].id, roomsList[idx].name);
              e.preventDefault();
            }
          }
      }
    });

    // Handle window resize
    window.addEventListener('resize', () => {
      if (app && currentRoomId) {
        const container = document.getElementById('isoCanvas');
        app.renderer.resize(container.clientWidth, container.clientHeight);
        drawRoom();
      }
    });

    // Initial load
    loadThemePreference(); // Load saved theme setting
    loadAudioPreferences(); // Load saved audio settings
    fetchRooms();
    fetchStats();
    checkFirstVisit(); // Check if we should show onboarding

    setInterval(fetchStats, 10000);
    setInterval(() => { if (!currentRoomId) fetchRooms(); }, 15000);

    console.log('[OpenClaw Hotel] Spectator mode loaded with PixiJS WebGL + Ambient Audio');
