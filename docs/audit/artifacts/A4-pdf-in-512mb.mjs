/**
 * A4 — влезает ли серверный PDF в 512 МБ (лимит Render free).
 * Запускается ВНУТРИ Linux-контейнера с --memory=512m, см. A4-run-docker-512.sh.
 */
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const exe = process.env.PDF_BROWSER_EXECUTABLE ?? '/usr/bin/chromium';
const read = (p) => { try { return Number(execSync(`cat ${p}`, { encoding: 'utf8' }).trim()); } catch { return NaN; } };
const cgCur = () => read('/sys/fs/cgroup/memory.current') / 1048576;
const cgMax = () => read('/sys/fs/cgroup/memory.max') / 1048576;
const cgPeak = () => read('/sys/fs/cgroup/memory.peak') / 1048576;

const N = Number(process.argv[2] ?? 1);
// Балласт — имитация базового RSS реального backend (справочники + Express + Mongoose).
// Замерено локально: 74 МБ после загрузки справочников, 117 МБ после расчёта на 50 комнат.
const BALLAST_MB = Number(process.env.BALLAST_MB ?? 0);
const ballast = [];
for (let i = 0; i < BALLAST_MB; i += 1) { const b = Buffer.alloc(1048576); b.fill(i % 251); ballast.push(b); }
if (BALLAST_MB) console.log(`# балласт (имитация базового RSS backend): ${BALLAST_MB} МБ`);
console.log(`# cgroup memory.max = ${cgMax().toFixed(0)} МБ`);
console.log(`# память cgroup до запуска Chromium: ${cgCur().toFixed(0)} МБ`);
globalThis.__ballastKeepAlive = () => ballast.length;
const html = '<html><head><style>body{font-family:sans-serif}table{border-collapse:collapse}td{border:1px solid #999;padding:4px}</style></head><body>'
  + '<h1>Кошторис</h1>' + '<table>' + '<tr><td>Котел Baxi ECO Home 24</td><td>1 шт</td><td>30 000 грн</td></tr>'.repeat(400) + '</table></body></html>';

let peak = 0;
const mon = setInterval(() => { const c = cgCur(); if (c > peak) peak = c; }, 50);

async function one(i) {
  const t0 = Date.now();
  const browser = await puppeteer.launch({
    executablePath: exe, headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });
  const launched = Date.now() - t0;
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
  const pdf = await page.pdf({ format: 'A4', printBackground: true, timeout: 60000 });
  const total = Date.now() - t0;
  const memDuring = cgCur();
  await browser.close();
  return { i, launched, total, kb: pdf.length / 1024, memDuring };
}

try {
  if (N === 1) {
    console.log('\n## Последовательные рендеры (по одному)');
    console.log('| # | launch мс | всего мс | PDF КБ | память cgroup во время, МБ |');
    console.log('|---|---|---|---|---|');
    for (let i = 1; i <= 3; i += 1) {
      const r = await one(i);
      console.log(`| ${i} | ${r.launched} | ${r.total} | ${r.kb.toFixed(0)} | ${r.memDuring.toFixed(0)} |`);
    }
  } else {
    console.log(`\n## ${N} параллельных рендеров (без семафора — как если бы PDF_MAX_CONCURRENT=${N})`);
    const rs = await Promise.allSettled(Array.from({ length: N }, (_, i) => one(i + 1)));
    console.log('| # | итог | всего мс |');
    console.log('|---|---|---|');
    rs.forEach((r, i) => console.log(r.status === 'fulfilled'
      ? `| ${i + 1} | OK ${r.value.kb.toFixed(0)} КБ | ${r.value.total} |`
      : `| ${i + 1} | ПАДЕНИЕ: ${String(r.reason?.message).slice(0, 90)} | — |`));
    console.log(`# успешно ${rs.filter((r) => r.status === 'fulfilled').length}/${N}`);
  }
} finally {
  clearInterval(mon);
  console.log(`\n# ПИК памяти cgroup: ${Math.max(peak, cgPeak() || 0).toFixed(0)} МБ из ${cgMax().toFixed(0)} МБ доступных`);
}
