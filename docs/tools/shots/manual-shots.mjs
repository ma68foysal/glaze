// Section screenshots for the manual: opens each demo page in headless Edge,
// scrolls the whole page so lazy images load, then crops one section by its
// section id and saves it as a JPEG in ultimate-doc/public/screenshots/section/.
// usage: node manual-shots.mjs [handle ...]   (no args = every job)
// Needs the demo previews running: 9294 Oblique (docs/tools/demo-sync/dev.cmd),
// 9295 Club (theme dev from D:\cracktab\oblique-demo\club on port 9295).
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '..', '..', 'ultimate-doc', 'public', 'screenshots', 'section');
mkdirSync(OUT, { recursive: true });

const O = 'http://127.0.0.1:9294';
const C = 'http://127.0.0.1:9295';
const PDP = `${O}/products/stride-trench`;
// handle: [url, section id ('viewport' = whole screen), optional max height, optional setup js]
const JOBS = {
  'announcement-bar': [O + '/', 'announcement', 0, '', 'header'],
  'kinetic-hero': [O + '/', 'hero'],
  'collection-list': [O + '/', 'categories'],
  'product-tabs': [O + '/', 'edit'],
  'feature-explorer': [O + '/', 'explorer'],
  'manifesto': [O + '/', 'manifesto'],
  'model-spotlight': [O + '/', 'spotlight'],
  'runway': [O + '/', 'runway'],
  'journal': [O + '/', 'journal'],
  'newsletter': [O + '/', 'newsletter'],
  'newsletter-popup': [O + '/', 'viewport', 0, "document.querySelector('[data-k-popup], .k-popup')?.showModal?.(); await new Promise(r => setTimeout(r, 900));"],
  'complete-look': [PDP, 'look'],
  'product-details': [PDP, 'details'],
  'story-steps': [PDP, 'story'],
  'related-products': [PDP, 'related'],
  'recently-viewed': [PDP, 'recently_viewed', 0, "localStorage.setItem('oblique:recent', JSON.stringify(['soft-blazer','cashmere-crew','pleated-wide-trouser','arc-loafer','crescent-bag'])); location.reload(); await new Promise(r => setTimeout(r, 6000));"],
  'contact-hero': [O + '/pages/contact', 'hero'],
  'contact-form': [O + '/pages/contact', 'form'],
  'faq-list': [O + '/pages/contact', 'faq'],
  'store-info': [O + '/pages/contact', 'store'],
  'feature-index': [O + '/pages/features', 'main'],
  'pull-quote': [O + '/pages/about', 'quote'],
  'countdown': [C + '/', 'drop'],
  'scrolling-tapes': [C + '/', 'tapes'],
  'stacked-cards': [C + '/', 'stack', 1400],
};

const want = process.argv.slice(2);
const jobs = Object.entries(JOBS).filter(([h]) => !want.length || want.includes(h));

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9333 + Math.floor(Math.random() * 300);
const profile = mkdtempSync(join(tmpdir(), 'kshots-'));
const edge = spawn(EDGE, ['--headless', '--disable-gpu', '--hide-scrollbars', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const closeEdge = () => { try { spawnSync('taskkill', ['/PID', String(edge.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { edge.kill(); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch {}
}
if (!target) { console.error('no edge target'); closeEdge(); process.exit(1); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (js) => (await send('Runtime.evaluate', { expression: `(async () => { ${js} })()`, awaitPromise: true, returnByValue: true })).result?.result?.value;

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });

let current = '';
for (const [handle, [url, sid, maxH = 1600, setup = '', extend = '']] of jobs) {
  if (url !== current || setup) {
    await send('Page.navigate', { url });
    await sleep(7000);
    // Close the newsletter popup, then walk the page so lazy images load.
    await evaluate(`document.querySelectorAll('dialog[open]').forEach(d => d.close()); for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } scrollTo(0, 0); await new Promise(r => setTimeout(r, 1500));`);
    current = setup ? '' : url;
  }
  if (setup) await evaluate(setup);
  let clip;
  if (sid === 'viewport') {
    clip = { x: 0, y: 0, width: 1440, height: 900, scale: 1 };
    await evaluate('scrollTo(0, 0)');
  } else {
    const rect = await evaluate(`
      const el = document.querySelector('[id^="shopify-section-"][id$="__${sid}"]');
      if (!el) return null;
      el.scrollIntoView({ block: 'start' });
      await new Promise(r => setTimeout(r, 600));
      let r = el.getBoundingClientRect();
      let top = r.top + scrollY, bottom = r.bottom + scrollY;
      ${extend === 'header' ? "const h = document.querySelector('.k-header, header'); if (h) bottom = Math.max(bottom, h.getBoundingClientRect().bottom + scrollY);" : ''}
      return { x: 0, y: top, width: innerWidth, height: bottom - top };`);
    if (!rect || rect.height < 20) { console.error(handle, 'section not found:', sid); continue; }
    clip = { ...rect, height: Math.min(rect.height, maxH), scale: 1 };
  }
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82, clip, captureBeyondViewport: true });
  if (!shot.result) { console.error(handle, 'capture failed'); continue; }
  const file = join(OUT, `${handle}.jpg`);
  writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
  console.log('saved', handle, Math.round(clip.height) + 'px');
}
ws.close();
closeEdge();
process.exit(0);
