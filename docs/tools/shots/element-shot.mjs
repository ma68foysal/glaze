// Screenshot elements on a live demo store page, using the kept Edge profile.
// usage: node element-shot.mjs <url> <out-dir> <name=css-selector> [...]   (mobile: append @mobile to name)
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [url, out, ...pairs] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9333 + Math.floor(Math.random() * 300);
const profile = join(process.env.LOCALAPPDATA || tmpdir(), 'oblique-shots-profile');
const edge = spawn(EDGE, ['--headless', '--hide-scrollbars', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const close = () => { try { spawnSync('taskkill', ['/PID', String(edge.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let t; for (let i = 0; i < 50 && !t; i++) { await sleep(200); try { t = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((x) => x.type === 'page'); } catch {} }
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pend = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (js) => (await send('Runtime.evaluate', { expression: `(async () => { ${js} })()`, awaitPromise: true, returnByValue: true })).result?.result?.value;
let lastMobile = null;
for (const pair of pairs) {
  const [rawName, sel] = pair.split('=');
  const mobile = rawName.endsWith('@mobile'); const name = rawName.replace('@mobile', '');
  if (mobile !== lastMobile) {
    await send('Emulation.setDeviceMetricsOverride', mobile ? { width: 390, height: 844, deviceScaleFactor: 2, mobile: true } : { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url }); await sleep(7000);
    await ev(`document.querySelectorAll('dialog[open]').forEach(d => d.close()); const s = document.createElement('style'); s.textContent = 'dialog.k-popup, .k-modal__scrim, .k-totop { display: none !important; } .shopify-section-group-header-group { position: relative !important; }'; document.head.append(s); for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 100)); } await new Promise(r => setTimeout(r, 1500));`);
    lastMobile = mobile;
  }
  const r = await ev(`const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; el.scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 500)); const b = el.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height, html: el.outerHTML.slice(0, 400) };`);
  if (!r || r.h < 2) { console.log(name, 'NOT FOUND or empty', sel, r && r.html); continue; }
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: r.x, y: r.y, width: r.w, height: Math.min(r.h, 1400), scale: 1 }, captureBeyondViewport: true });
  writeFileSync(join(out, name + '.png'), Buffer.from(shot.result.data, 'base64')); console.log('saved', name, Math.round(r.w) + 'x' + Math.round(r.h));
}
ws.close(); close(); process.exit(0);
