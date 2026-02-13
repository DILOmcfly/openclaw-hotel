import { Application, Container } from 'pixi.js';
import { parseHeightmap, TileMap } from './renderer/TileMap.js';

const DEMO_MAP = `
xxxx00000
xxxx00000
xxx000000
xx0000000
x00000000
000000000
000000000
000000000
000000000
`.trim();

async function init() {
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: '#1a1a2e',
    antialias: true,
  });

  const appEl = document.getElementById('app');
  if (!appEl) throw new Error('Missing #app element');
  appEl.appendChild(app.canvas);

  const world = new Container();
  world.position.set(app.screen.width / 2, app.screen.height / 3);
  app.stage.addChild(world);

  const heightmap = parseHeightmap(DEMO_MAP);
  const tileMap = new TileMap(heightmap, world);
  tileMap.render();

  // Click → grid coords
  app.canvas.addEventListener('click', (e: MouseEvent) => {
    const localX = e.clientX - world.position.x;
    const localY = e.clientY - world.position.y;
    const tile = tileMap.getTileAt(localX, localY);
    if (tile) {
      console.log(`Tile clicked: (${tile.gridX}, ${tile.gridY})`);
    }
  });

  console.log('OpenClaw Hotel client ready');
}

init().catch(console.error);
