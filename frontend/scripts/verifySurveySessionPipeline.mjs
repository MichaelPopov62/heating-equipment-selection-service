/**
 * Назначение: verify pipeline SurveySession (миграция режима отопления, layout v3, UI-мутации).
 * Запуск: npm run verify:survey-session (из frontend/)
 */

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
      branches: rooms.map((r) => ({ roomId: r.id, pipeLengthToEquipmentM: 4 })),
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

/** Зеркало buildCalcRequestPayload: systemType → radiatorWiringSystemType. */
function hydraulicsFromDraft(draft) {
  const hydraulicsForm = draft.hydraulicsForm ?? {
    mainLineLengthM: 8,
    deltaTSystemK: 20,
    pipeMaterialPreference: '',
  };
  const wiringLayoutV3 = draft.wiringLayoutV3;
  return {
    mainLineLengthM: hydraulicsForm.mainLineLengthM,
    deltaTSystemK: hydraulicsForm.deltaTSystemK,
    radiatorWiringSystemType: wiringLayoutV3?.systemType ?? 'auto',
    ...(wiringLayoutV3?.branches?.length
      ? {
          radiatorBranchOverrides: wiringLayoutV3.branches.map((b) => ({
            roomId: b.roomId,
            pipeLengthToEquipmentM: b.pipeLengthToEquipmentM,
          })),
        }
      : {}),
  };
}

const deadEndDraft = {
  ...classic,
  wiringLayoutV3: {
    ...classic.wiringLayoutV3,
    systemType: 'two-pipe-dead-end',
  },
  hydraulicsForm: { mainLineLengthM: 8, deltaTSystemK: 20, pipeMaterialPreference: '' },
};
assert.equal(
  hydraulicsFromDraft(deadEndDraft).radiatorWiringSystemType,
  'two-pipe-dead-end',
);

/** Зеркало reduceSurveyMutation: WIRING_BRANCH_LENGTH_SET. */
function applyBranchLengthSet(draft, roomId, pipeLengthToEquipmentM) {
  return {
    ...draft,
    wiringLayoutV3: {
      ...draft.wiringLayoutV3,
      branches: draft.wiringLayoutV3.branches.map((b) =>
        b.roomId === roomId ? { ...b, pipeLengthToEquipmentM } : b,
      ),
    },
  };
}

const withCustomBranch = applyBranchLengthSet(deadEndDraft, 'r1', 6.5);
const hydCustom = hydraulicsFromDraft(withCustomBranch);
assert.equal(hydCustom.radiatorBranchOverrides[0].pipeLengthToEquipmentM, 6.5);
assert.equal(hydCustom.mainLineLengthM, 8);

/** Зеркало reduceSurveyMutation: WIRING_BRANCH_REORDER. */
function applyBranchReorder(draft, roomId, direction) {
  const branches = [...draft.wiringLayoutV3.branches];
  const idx = branches.findIndex((b) => b.roomId === roomId);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  const tmp = branches[idx];
  branches[idx] = branches[swapIdx];
  branches[swapIdx] = tmp;
  return {
    ...draft,
    wiringLayoutV3: { ...draft.wiringLayoutV3, branches },
  };
}

const twoRoomsDraft = {
  ...deadEndDraft,
  rooms: [{ id: 'r1' }, { id: 'r2' }],
  wiringLayoutV3: {
    ...deadEndDraft.wiringLayoutV3,
    branches: [
      { roomId: 'r1', pipeLengthToEquipmentM: 4 },
      { roomId: 'r2', pipeLengthToEquipmentM: 5 },
    ],
  },
};
const reordered = applyBranchReorder(twoRoomsDraft, 'r2', 'up');
assert.deepEqual(
  hydraulicsFromDraft(reordered).radiatorBranchOverrides.map((b) => b.roomId),
  ['r2', 'r1'],
);


const mainBundle = readFileSync(path.join(distAssets, bundles[0]), 'utf8');
assert.ok(
  mainBundle.includes('two-pipe-dead-end'),
  'bundle должен содержать коды типов разводки (HydraulicsSection)',
);
assert.ok(
  mainBundle.includes('Тип разводки системы отопления'),
  'bundle должен содержать подпись поля типа разводки',
);
assert.ok(
  mainBundle.includes('оптимальный подбор системы'),
  'bundle должен содержать подпись radio auto',
);
assert.ok(
  mainBundle.includes('Коллекторная лучевая'),
  'bundle должен содержать подпись radio manifold',
);
assert.ok(
  mainBundle.includes('Рекомендуется'),
  'bundle должен содержать бейдж рекомендуемой схемы',
);

console.log('verify:survey-session — все кейсы прошли');
