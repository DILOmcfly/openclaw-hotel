import { defineConfig, type Plugin } from 'vite';

// Pixi.js is loaded via importmap in index.html from CDN.
// In dev mode, Vite transforms TS but can't resolve bare "pixi.js".
// This plugin rewrites the import to the CDN URL so Vite passes it through.
function pixiCdnPlugin(): Plugin {
  const PIXI_CDN = 'https://cdn.jsdelivr.net/npm/pixi.js@8.6.6/dist/pixi.min.mjs';
  return {
    name: 'pixi-cdn',
    enforce: 'pre',
    resolveId(source) {
      if (source === 'pixi.js') {
        return { id: PIXI_CDN, external: true };
      }
    },
  };
}

export default defineConfig({
  root: '.',
  plugins: [pixiCdnPlugin()],
});
