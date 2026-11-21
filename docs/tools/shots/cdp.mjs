// Headless Edge over the DevTools protocol: open pages, optionally run a script,
// then save a screenshot. usage: node cdp.mjs <jobs.json>
// jobs.json: [{ "url", "out", "w", "h", "js"?, "jsFile"?, "load"?, "wait"?, "full"?, "motion"? }]
// js runs as an async function body; its return value is printed as JSON.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const jobs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const port = 9333 + Math.floor(Math.random() * 300);
const profile = mkdtempSync(join(tmpdir(), 'kcdp-'));
const edge = spawn(EDGE, ['--headless', '--disable-gpu', '--hide-scrollbars', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Edge starts helper processes; close the whole tree so none keep running (and skewing CPU-sensitive tests).
const closeEdge = () => { try { spawnSync('taskkill', ['/PID', String(edge.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { edge.kill(); } };
process.on('SIGINT', () => { closeEdge(); process.exit(1); });
process.on('SIGTERM', () => { closeEdge(); process.exit(1); });

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

await send('Page.enable');
await send('Runtime.enable');
for (const job of jobs) {
  await send('Emulation.setDeviceMetricsOverride', { width: job.w, height: job.h, deviceScaleFactor: 1, mobile: job.w < 600 });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: job.motion ? 'no-preference' : 'reduce' }] });
  await send('Page.navigate', { url: job.url });
  await sleep(job.load || 6000);
  if (job.jsFile) job.js = readFileSync(job.jsFile, 'utf8');
  if (job.js) {
    const r = await send('Runtime.evaluate', { expression: `(async () => { ${job.js} })()`, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) console.error(job.out, 'js error:', r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
    else if (r.result?.result?.value !== undefined) console.log(job.out, '→', JSON.stringify(r.result.result.value));
  }
  await sleep(job.wait || 1000);
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!job.full });
  writeFileSync(job.out, Buffer.from(shot.result.data, 'base64'));
  console.log('saved', job.out);
}
ws.close();
closeEdge();
process.exit(0);
