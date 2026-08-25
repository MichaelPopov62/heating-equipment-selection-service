/**
 * A4 — честная цена ОДНОГО headless Chromium в памяти.
 * Меряем два независимых способа:
 *  (1) пофайлово ps rss по процессам chrome (сумма завышена — общие страницы фреймворка считаются много раз);
 *  (2) дельта свободной физической памяти системы по vm_stat (реальная цена для машины).
 * Запуск: PDF_BROWSER_EXECUTABLE=... node docs/audit/artifacts/A4-bench-pdf-memory.mjs
 */
import { execSync } from 'node:child_process';
import puppeteer from '../../../backend/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

const PAGE_BYTES = Number(execSync("vm_stat | head -1 | grep -o '[0-9]*'", { shell: '/bin/sh', encoding: 'utf8' }).trim());
function freeMb() {
  const out = execSync('vm_stat', { encoding: 'utf8', shell: '/bin/sh' });
  const g = (re) => Number((out.match(re) ?? [0, 0])[1]);
  const free = g(/Pages free:\s+(\d+)/);
  const spec = g(/Pages speculative:\s+(\d+)/);
  return ((free + spec) * PAGE_BYTES) / 1048576;
}
function chromeProcs() {
  const out = execSync("ps -Ao pid,rss,comm | grep -iE 'chrome|chromium' | grep -vi grep || true", { encoding: 'utf8', shell: '/bin/sh' });
  return out.trim().split('\n').filter(Boolean).map((l) => {
    const m = l.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);
    return m ? { pid: Number(m[1]), rssMb: Number(m[2]) / 1024, comm: m[3] } : null;
  }).filter(Boolean);
}

const exe = process.env.PDF_BROWSER_EXECUTABLE;
console.log(`# executable: ${exe}`);
console.log(`# chrome-процессов ДО: ${chromeProcs().length}`);
const free0 = freeMb();
console.log(`# свободная физпамять ДО: ${free0.toFixed(0)} МБ`);

const t0 = Date.now();
const browser = await puppeteer.launch({
  executablePath: exe, headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
});
const launchMs = Date.now() - t0;
const page = await browser.newPage();
await page.setContent('<html><body><h1>A4</h1>' + '<p>строка</p>'.repeat(500) + '</body></html>', { waitUntil: 'networkidle0' });
await page.pdf({ format: 'A4', printBackground: true });
await new Promise((r) => setTimeout(r, 800));

const procs = chromeProcs();
const free1 = freeMb();
console.log(`\n# launch: ${launchMs} мс`);
console.log(`# chrome-процессов ВО ВРЕМЯ: ${procs.length}`);
console.log('| pid | RSS МБ | процесс |');
console.log('|---|---|---|');
for (const p of procs.sort((a, b) => b.rssMb - a.rssMb).slice(0, 12)) {
  console.log(`| ${p.pid} | ${p.rssMb.toFixed(0)} | ${p.comm.slice(0, 60)} |`);
}
console.log(`\n# (1) сумма ps RSS всех chrome-процессов: ${procs.reduce((s, p) => s + p.rssMb, 0).toFixed(0)} МБ (ЗАВЫШЕНО: общие страницы считаются многократно)`);
console.log(`# (2) дельта свободной физпамяти системы: ${(free0 - free1).toFixed(0)} МБ — реальная цена одного headless Chromium`);
await browser.close();
await new Promise((r) => setTimeout(r, 1200));
console.log(`# свободная физпамять ПОСЛЕ close(): ${freeMb().toFixed(0)} МБ, chrome-процессов ${chromeProcs().length}`);
