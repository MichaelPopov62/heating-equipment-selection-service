/**
 * A4 — цена PDF: Chromium на запрос, память, поведение при 10 параллельных.
 * Запуск (из корня; на macOS нужен путь к Chrome):
 *   PDF_BROWSER_EXECUTABLE="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 *   LOG_LEVEL=error node docs/audit/artifacts/A4-bench-pdf.mjs
 * Аргументы: [сколько последовательных] [сколько параллельных]
 */
import { execSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { loadCalcRuntimeContextFromFiles } from '../../../backend/scripts/fixtures/calcRuntimeContextFromFiles.js';
import { buildReport } from '../../../backend/src/report/public.js';
import { validateAndNormalizeInput } from '../../../backend/src/api/validate.js';
import { buildShareSnapshot } from '../../../backend/src/projects/buildShareSnapshot.js';
import { buildEstimatePdfHtml } from '../../../backend/src/projects/buildEstimatePdfHtml.js';
import { renderPdfFromHtml } from '../../../backend/src/projects/renderPdfFromHtml.js';

const WALL='wall_gas_concrete_d500', WIN='window_pvc_double_chamber_3_glass', UFH='ufh_base_interstory_screed_65';
function buildInput(n,{ufhShare=1/3}={}){const rooms=[],env=[];
for(let i=1;i<=n;i+=1){const id=`r${i}`,a=12+(i%17);const u=ufhShare>0&&i%Math.max(1,Math.round(1/ufhShare))===0;
rooms.push({id,name:`K${i}`,type:'гостиная',floor:1,topBoundary:'heated',bottomBoundary:'unheated',areaM2:a,heightM:2.7,roomExteriorLayout:'facade',
...(u?{underfloorHeating:{enabled:true,basePresetId:UFH,finishMaterialId:'ceramic_tile',pipeSpacingMm:150}}:{})});
env.push({kind:'wall',roomId:id,construction:'наружная стена',presetId:WALL,areaM2:10,orientation:'N'},
{kind:'window',roomId:id,construction:'окно',presetId:WIN,areaM2:2.1,orientation:'N',openingWidthMm:1400,openingHeightMm:1500},
{kind:'floor',roomId:id,construction:'пол',presetId:'floor_concrete_uninsulated',areaM2:a});}
const any=rooms.some(r=>r.underfloorHeating);
return{building:{temps:{insideC:20,outsideC:-22},objectMeta:{objectType:'house',floors:1,roomsCount:Math.min(n,50),
ventilationReserveMode:'natural',boilerPlacementZone:'kitchen',externalWalls:{presetId:WALL,thicknessMm:375,facadeSystem:'none'}},rooms,envelopeElements:env},
heatingSystem:{supplyC:75,returnC:65,insideC:20,thermalRegimePreset:'traditional_dt50_75_65',
...(any?{waterUnderfloorHeating:true,ufhPresetId:'ufh_mixed_radiators'}:{}),
hotWaterBoilerPowerMatchingScheme:'maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw'},
hotWater:{residents:4,coldWaterDesignSeason:'winter',hotWaterC:60,tropicalShower:false,fixtures:{shower:2,sink:2,kitchenSink:1,bath:1,toilet:2}},
hydraulics:{mainLineLengthM:12,deltaTSystemK:20}};}

/**
 * Внешний сэмплер: пишет в файл «кол-во chrome-процессов<TAB>суммарный RSS КБ» каждые 100 мс.
 * Отдельный процесс — чтобы НЕ блокировать event loop node во время рендера
 * (блокирующий execSync рвёт CDP-соединение puppeteer и даёт ложный PDF_RENDER_TIMEOUT).
 */
function startSampler(outFile) {
  fs.writeFileSync(outFile, '');
  const p = spawn('/bin/sh', ['-c',
    `while :; do ps -Ao rss,comm | grep -iE 'chrome|chromium' | grep -vi grep | awk '{n+=1; s+=$1} END {print n+0"\t"s+0}' >> ${outFile}; sleep 0.1; done`],
    { stdio: 'ignore', detached: true });
  return p;
}
function readSamplerPeak(outFile) {
  const lines = fs.readFileSync(outFile, 'utf8').trim().split('\n').filter(Boolean);
  let maxProc = 0, maxRss = 0;
  for (const l of lines) {
    const [n, rss] = l.split('\t').map(Number);
    if (n > maxProc) maxProc = n;
    if (rss > maxRss) maxRss = rss;
  }
  return { maxProc, maxRssMb: maxRss / 1024, samples: lines.length };
}

/** Суммарный RSS всех процессов Chrome/Chromium, МБ (разовый замер, вне рендера). */
function chromeRssMb() {
  try {
    const out = execSync(
      "ps -Ao rss,comm | grep -iE 'chrome|chromium' | grep -vi grep | awk '{s+=$1} END {print s+0}'",
      { encoding: 'utf8', shell: '/bin/sh' },
    ).trim();
    return Number(out) / 1024;
  } catch { return NaN; }
}
function chromeProcCount() {
  try {
    return Number(execSync("ps -Ao comm | grep -icE 'chrome|chromium' || true", { encoding: 'utf8', shell: '/bin/sh' }).trim());
  } catch { return NaN; }
}

const SEQ = Number(process.argv[2] ?? 5);
const PAR = Number(process.argv[3] ?? 10);

const ctx = await loadCalcRuntimeContextFromFiles();
const input = validateAndNormalizeInput(buildInput(20), ctx);
const report = await buildReport({ input, ctx });
const snapshot = buildShareSnapshot({ clientName: 'Тест A4', label: 'audit', report });
const html = buildEstimatePdfHtml(snapshot, { includeTechnical: true });
console.log(`# HTML сметы (20 комнат, includeTechnical=1): ${(Buffer.byteLength(html)/1024).toFixed(0)} КБ`);
console.log(`# shareSnapshot JSON: ${(Buffer.byteLength(JSON.stringify(snapshot))/1024).toFixed(1)} КБ`);
console.log(`# полный CalcReport JSON: ${(Buffer.byteLength(JSON.stringify(report))/1024).toFixed(1)} КБ`);
console.log(`# PDF_MAX_CONCURRENT=${process.env.PDF_MAX_CONCURRENT ?? '(дефолт 2)'} PDF_QUEUE_WAIT_MS=${process.env.PDF_QUEUE_WAIT_MS ?? '(дефолт 15000)'}`);
console.log(`# chrome-процессов до старта: ${chromeProcCount()}, их RSS ${chromeRssMb().toFixed(0)} МБ`);
console.log('');

console.log('## Последовательные рендеры (каждый = свой puppeteer.launch)');
console.log('| # | мс | PDF КБ | chrome-процессов во время | RSS chrome во время, МБ | RSS node, МБ |');
console.log('|---|---|---|---|---|---|');
const seqTimes = [];
for (let i = 1; i <= SEQ; i += 1) {
  const f = `/tmp/a4-pdf-seq-${i}.tsv`;
  const sampler = startSampler(f);
  const t0 = performance.now();
  const buf = await renderPdfFromHtml(html);
  const ms = performance.now() - t0;
  try { process.kill(-sampler.pid); } catch { /* ignore */ }
  const pk = readSamplerPeak(f);
  seqTimes.push(ms);
  console.log(`| ${i} | ${ms.toFixed(0)} | ${(buf.byteLength/1024).toFixed(0)} | ${pk.maxProc} | ${pk.maxRssMb.toFixed(0)} | ${(process.memoryUsage().rss/1048576).toFixed(0)} |`);
}
const sorted = [...seqTimes].sort((a,b)=>a-b);
console.log(`\n# медиана последовательного рендера: ${sorted[Math.floor(sorted.length/2)].toFixed(0)} мс\n`);

console.log(`## ${PAR} параллельных запросов PDF (PDF_MAX_CONCURRENT по умолчанию 2)`);
const fpar = '/tmp/a4-pdf-par.tsv';
const samplerPar = startSampler(fpar);
const t0 = performance.now();
const results = await Promise.allSettled(
  Array.from({ length: PAR }, async (_, i) => {
    const s = performance.now();
    const buf = await renderPdfFromHtml(html);
    return { i, ms: performance.now() - s, kb: buf.byteLength / 1024 };
  }),
);
const totalMs = performance.now() - t0;
try { process.kill(-samplerPar.pid); } catch { /* ignore */ }
const pkPar = readSamplerPeak(fpar);
console.log('| # | итог | мс от подачи запроса |');
console.log('|---|---|---|');
results.forEach((r, i) => {
  if (r.status === 'fulfilled') console.log(`| ${i} | OK ${r.value.kb.toFixed(0)} КБ | ${r.value.ms.toFixed(0)} |`);
  else console.log(`| ${i} | ОТКАЗ ${r.reason?.code ?? r.reason?.message} (HTTP ${r.reason?.statusCode ?? '?'}) | — |`);
});
const ok = results.filter((r) => r.status === 'fulfilled').length;
console.log(`\n# успешно ${ok}/${PAR}, отказов ${PAR-ok}; общее время ${(totalMs/1000).toFixed(1)} с`);
console.log(`# пик: chrome-процессов ${pkPar.maxProc}, суммарный RSS chrome ${pkPar.maxRssMb.toFixed(0)} МБ, RSS node ${(process.memoryUsage().rss/1048576).toFixed(0)} МБ (${pkPar.samples} сэмплов)`);
