/**
 * A4 — пиковая память buildReport (важно для лимита 512 МБ на Render free).
 * Запуск: LOG_LEVEL=error node docs/audit/artifacts/A4-bench-memory.mjs [комнат]
 */
import { performance } from 'node:perf_hooks';
import { loadCalcRuntimeContextFromFiles } from '../../../backend/scripts/fixtures/calcRuntimeContextFromFiles.js';
import { buildReport } from '../../../backend/src/report/public.js';
import { validateAndNormalizeInput } from '../../../backend/src/api/validate.js';
const WALL='wall_gas_concrete_d500', WIN='window_pvc_double_chamber_3_glass', UFH='ufh_base_interstory_screed_65';
function buildInput(n,{ufhShare=1/3,declared}={}){const rooms=[],env=[];
for(let i=1;i<=n;i+=1){const id=`r${i}`,a=12+(i%17);const u=ufhShare>0&&i%Math.max(1,Math.round(1/ufhShare))===0;
rooms.push({id,name:`K${i}`,type:'гостиная',floor:1,topBoundary:'heated',bottomBoundary:'unheated',areaM2:a,heightM:2.7,roomExteriorLayout:'facade',
...(u?{underfloorHeating:{enabled:true,basePresetId:UFH,finishMaterialId:'ceramic_tile',pipeSpacingMm:150}}:{})});
env.push({kind:'wall',roomId:id,construction:'наружная стена',presetId:WALL,areaM2:10,orientation:'N'},
{kind:'window',roomId:id,construction:'окно',presetId:WIN,areaM2:2.1,orientation:'N',openingWidthMm:1400,openingHeightMm:1500},
{kind:'floor',roomId:id,construction:'пол',presetId:'floor_concrete_uninsulated',areaM2:a});}
const any=rooms.some(r=>r.underfloorHeating);
return{building:{temps:{insideC:20,outsideC:-22},objectMeta:{objectType:'house',floors:1,roomsCount:declared??Math.min(n,50),
ventilationReserveMode:'natural',boilerPlacementZone:'kitchen',externalWalls:{presetId:WALL,thicknessMm:375,facadeSystem:'none'}},rooms,envelopeElements:env},
heatingSystem:{supplyC:75,returnC:65,insideC:20,thermalRegimePreset:'traditional_dt50_75_65',
...(any?{waterUnderfloorHeating:true,ufhPresetId:'ufh_mixed_radiators'}:{}),
hotWaterBoilerPowerMatchingScheme:'maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw'},
hotWater:{residents:4,coldWaterDesignSeason:'winter',hotWaterC:60,tropicalShower:false,fixtures:{shower:2,sink:2,kitchenSink:1,bath:1,toilet:2}},
hydraulics:{mainLineLengthM:12,deltaTSystemK:20}};}

const n = Number(process.argv[2] ?? 1600);
const ctx = await loadCalcRuntimeContextFromFiles();
const base = process.memoryUsage();
console.log(`# базовый RSS процесса после загрузки справочников: ${(base.rss/1048576).toFixed(0)} МБ, heapUsed ${(base.heapUsed/1048576).toFixed(0)} МБ`);
let peak = 0;
const mon = setInterval(() => { const m = process.memoryUsage().rss; if (m > peak) peak = m; }, 5);
const raw = buildInput(n, { declared: 50 });
const input = validateAndNormalizeInput(raw, ctx);
const t0 = performance.now();
const rep = await buildReport({ input, ctx });
const ms = performance.now() - t0;
const json = JSON.stringify(rep);
const after = process.memoryUsage();
clearInterval(mon);
console.log(`# комнат=${n} тело запроса ${(Buffer.byteLength(JSON.stringify(raw))/1024).toFixed(0)} КБ`);
console.log(`# buildReport ${ms.toFixed(0)} мс`);
console.log(`# JSON отчёта ${(Buffer.byteLength(json)/1048576).toFixed(1)} МБ`);
console.log(`# RSS после: ${(after.rss/1048576).toFixed(0)} МБ; пик RSS за время расчёта (сэмплинг 5 мс, врёт при блокировке loop): ${(peak/1048576).toFixed(0)} МБ`);
console.log(`# heapUsed после: ${(after.heapUsed/1048576).toFixed(0)} МБ, heapTotal ${(after.heapTotal/1048576).toFixed(0)} МБ`);
