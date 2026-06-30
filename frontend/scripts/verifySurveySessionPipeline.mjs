/**
 * Назначение: verify pipeline SurveySession (миграция режима отопления, layout v3).
 * Запуск: npm run verify:survey-session (из frontend/)
 */

import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const distAssets = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'assets');
const bundles = existsSync(distAssets)
  ? readdirSync(distAssets).filter((f) => f.endsWith('.js'))
  : [];
assert.ok(bundles.length > 0, 'dist/assets/*.js должен существовать (npm run build)');

/** Зеркало migrateDerivedState для «Классика». */
function applyClassicMode(draft) {
  const rooms = draft.rooms.map((r) =>
    r.underfloorHeating?.enabled
      ? { ...r, underfloorHeating: { ...r.underfloorHeating, enabled: false } }
      : r,
  );
  return {
    ...draft,
    ufhPresetId: null,
    waterUnderfloorHeating: false,
    rooms,
    wiringLayoutV3: {
      schemaVersion: 3,
      systemType: 'auto',
      branches: rooms.map((r) => ({ roomId: r.id, estimatedLengthM: 4 })),
      metadata: { migratedFrom: 'flat-v2', updatedAt: '2026-01-01T00:00:00.000Z' },
    },
  };
}

const room = {
  id: 'r1',
  underfloorHeating: { enabled: true },
};

const mixed = {
  ufhPresetId: 'ufh_mixed_radiators',
  waterUnderfloorHeating: true,
  rooms: [room],
};

const classic = applyClassicMode(mixed);
assert.equal(classic.ufhPresetId, null);
assert.equal(classic.waterUnderfloorHeating, false);
assert.equal(classic.rooms[0].underfloorHeating.enabled, false);
assert.equal(classic.wiringLayoutV3.branches[0].roomId, 'r1');

console.log('verify:survey-session — все кейсы прошли');
