import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import fs from 'fs';

// Dev-only endpoint: the in-game HUD-layout COPY button POSTs the layout JSON
// here so it lands in a file on the dev machine (hud-layout-dump.json) — no
// clipboard needed, which is unreliable on iOS over plain-http LAN testing.
function hudLayoutDump() {
  return {
    name: 'hud-layout-dump',
    configureServer(server) {
      server.middlewares.use('/__hudlayout', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('POST only'); return; }
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
          try {
            fs.writeFileSync('hud-layout-dump.json', body);
            res.statusCode = 200; res.setHeader('Access-Control-Allow-Origin', '*'); res.end('ok');
          } catch (e) { res.statusCode = 500; res.end(String(e)); }
        });
      });
    },
  };
}

// HTTPS is REQUIRED on iPhone Safari for DeviceOrientationEvent
// (tilt steer) to be allowed — even on the local LAN.  basicSsl
// generates a self-signed cert on first run; the phone will show a
// "connection not private" warning, tap Advanced → Continue once.
// Set DUI_HTTP=1 to disable the self-signed HTTPS plugin and serve
// over plain http:// (handy for iPhone testing when you don't need
// tilt-steer / DeviceOrientationEvent).
const useHttp = process.env.DUI_HTTP === '1';

export default defineConfig({
  base: './',
  plugins: useHttp ? [hudLayoutDump()] : [basicSsl(), hudLayoutDump()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: { manualChunks: { phaser: ['phaser'] } }
    }
  },
  server: {
    host: true,
    port: 3000,
    // HMR (hot-reload) DISABLED for phone testing.  Vite's HMR client
    // force-reloads the page whenever its websocket to the dev server drops &
    // reconnects — a brief phone Wi-Fi blip / momentary background / dep
    // re-optimization / file save all trigger it, mid-edit, with the
    // "connection to the server was lost" message.  That was resetting the game
    // during layout editing.  With HMR off, the page reloads ONLY when YOU
    // reload it — so you pull in new code on your own schedule.  Re-enable by
    // deleting this line (or set `hmr: true`) when you want live auto-reload.
    hmr: false
  }
});
