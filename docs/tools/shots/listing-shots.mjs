// Theme Store listing screenshots: the home page of each preset's demo store,
// desktop 2000x2496 (1000x1248 at 2x) and mobile 750x1334 (375x667 at 2x).
// Uses the same kept Edge profile as manual-shots.mjs; a locked store opens on
// its password page and the script waits until you have typed the password.
// usage: node listing-shots.mjs [oblique|club|hush ...]
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '..', 'listing');
mkdirSync(OUT, { recursive: true });
const STORES = {
  oblique: 'https://oblique-theme.myshopify.com',
  club: 'https://oblique-club-vrjg1qy6.myshopify.com',
  hush: 'https://oblique-hush-jqtqsh01.myshopify.com',
};
const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(STORES);
const VIEWS = [
  ['desktop', { width: 1000, height: 1248, deviceScaleFactor: 2, mobile: false }],
  ['mobile', { width: 375, height: 667, deviceScaleFactor: 2, mobile: true }],
];

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9333 + Math.floor(Math.random() * 300);
const profile = join(process.env.LOCALAPPDATA || tmpdir(), 'oblique-shots-profile');
mkdirSync(profile, { recursive: true });
const edge = spawn(EDGE, ['--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--window-size=1100,1000', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const closeEdge = () => { try { spawnSync('taskkill', ['/PID', String(edge.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { edge.kill(); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (path, method = 'GET') => (await fetch(`http://127.0.0.1:${port}${path}`, { method })).json();

let target;
for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await api('/json')).find((t) => t.type === 'page'); } catch {} }
if (!target) { console.error('no edge target'); closeEdge(); process.exit(1); }

// Unlock any store still on its password page.
const tabs = [];
for (const k of want) tabs.push(await api(`/json/new?${STORES[k]}/`, 'PUT'));
let clear = 0;
for (let i = 0; ; i++) {
  await sleep(2000);
  const list = await api('/json');
  const locked = tabs.filter((t) => (list.find((l) => l.id === t.id)?.url || '/password').includes('/password'));
  clear = locked.length ? 0 : clear + 1;
  if (clear >= 3) break;
  if (i % 15 === 0) console.log('waiting for the storefront password on:', locked.map((t) => new URL(t.url || 'http://x').host).join(', '));
  if (i > 450) { console.error('gave up waiting for unlock'); closeEdge(); process.exit(1); }
}
for (const t of tabs) await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`);

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (js) => (await send('Runtime.evaluate', { expression: `(async () => { ${js} })()`, awaitPromise: true, returnByValue: true })).result?.result?.value;
await send('Page.enable');

for (const k of want) {
  for (const [view, metrics] of VIEWS) {
    await send('Emulation.setDeviceMetricsOverride', metrics);
    await send('Emulation.setTouchEmulationEnabled', { enabled: metrics.mobile });
    await send('Page.navigate', { url: STORES[k] + '/' });
    await sleep(8000);
    // Load lazy images, return to the top, then hide the timed popup and back-to-top button.
    await evaluate(`for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise(r => setTimeout(r, 350)); } scrollTo(0, 0); await new Promise(r => setTimeout(r, 6000)); await Promise.all([...document.images].filter(i => i.getBoundingClientRect().top < innerHeight).map(i => Promise.race([i.decode().catch(() => {}), new Promise(r => setTimeout(r, 4000))])));
      const st = document.createElement('style'); st.textContent = 'dialog.k-popup, .k-modal__scrim, .k-totop, .k-cursor { display: none !important; }'; document.head.append(st);
      document.querySelectorAll('dialog[open]').forEach(d => d.close()); await new Promise(r => setTimeout(r, 1200));`);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const file = join(OUT, `${k}-${view}.png`);
    writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
    console.log('saved', file);
  }
}
ws.close();
closeEdge();
process.exit(0);
