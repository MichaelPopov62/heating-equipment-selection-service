/**
 * Назначение: базовые конструкции водяного тёплого пола (без финишного покрытия).
 * Описание: usage=underfloor_heating_base — плита, утеплитель, стяжка с трубами, выравнивание.
 * Финиш — отдельно в flooringFinishMaterials.js. Не смешивать с ENVELOPE_PRESETS.
 */

import {
  computeFinishCoveringResistanceM2KW,
  getFlooringFinishMaterialById,
} from './flooringFinishMaterials.js';

/** @typedef {import('../types/shared-types').UnderfloorHeatingAssemblyLayer} UnderfloorHeatingAssemblyLayer */
/** @typedef {import('../types/shared-types').UnderfloorHeatingBasePreset} UnderfloorHeatingBasePreset */
/** @typedef {import('../types/shared-types').FlooringFinishMaterial} FlooringFinishMaterial */

/**
 * Термическое сопротивление одного слоя, м²·K/Вт (R = δ/λ).
 *
 * @param {UnderfloorHeatingAssemblyLayer} layer
 * @returns {number}
 */
export function computeLayerResistanceM2KW(layer) {
  const d = layer.thicknessM;
  const lambda = layer.thermalConductivityWmK;
  if (!(d > 0) || !(lambda > 0)) return 0;
  return d / lambda;
}

/**
 * Rλ,B слоёв базы над плоскостью isHeatingLayer (без финиша), м²·K/Вт.
 *
 * @param {UnderfloorHeatingAssemblyLayer[]} layers
 * @returns {number}
 */
export function computeBaseCoveringResistanceM2KW(layers) {
  const heatingIdx = layers.findIndex((l) => l.isHeatingLayer);
  if (heatingIdx < 0) return 0;
  let sum = 0;
  for (let i = heatingIdx + 1; i < layers.length; i += 1) {
    sum += computeLayerResistanceM2KW(layers[i]);
  }
  return Math.round(sum * 10000) / 10000;
}

/**
 * Составное Rλ,B = база над контуром + финишное покрытие.
 *
 * @param {UnderfloorHeatingBasePreset} base
 * @param {FlooringFinishMaterial} finish
 * @returns {number}
 */
export function computeComposedCoveringResistanceM2KW(base, finish) {
  const baseR = computeBaseCoveringResistanceM2KW(base.layers);
  const finishR = computeFinishCoveringResistanceM2KW(finish);
  return Math.round((baseR + finishR) * 10000) / 10000;
}

/** Гостовая / эталонная база (XPS 30 мм) — дефолт анкеты. */
export const DEFAULT_UFH_BASE_PRESET_ID = 'ufh_base_interstory_screed_65';

/** Миграция устаревших монолитных presetId → base + finish. */
export const LEGACY_MONOLITHIC_UFH_PRESET_MAP = Object.freeze({
  underfloor_heating_glued_pvc_quartz_vinyl_interstory: {
    basePresetId: DEFAULT_UFH_BASE_PRESET_ID,
    finishMaterialId: 'pvc_glue',
  },
  underfloor_heating_floating_quartz_vinyl_interstory: {
    basePresetId: DEFAULT_UFH_BASE_PRESET_ID,
    finishMaterialId: 'pvc_click',
  },
});

/**
 * Сборка межэтажной базы ТП с заданной толщиной XPS под стяжкой.
 *
 * @param {object} args
 * @param {string} args.id
 * @param {string} args.name
 * @param {number} args.xpsThicknessM
 * @returns {UnderfloorHeatingBasePreset}
 */
function buildInterstoryUfhBasePreset({ id, name, xpsThicknessM }) {
  const xpsMm = Math.round(xpsThicknessM * 1000);
  return {
    id,
    name,
    description:
      `Водяной тёплый пол в стяжке 65 мм над плитой перекрытия; XPS ${xpsMm} мм под контуром. Финиш выбирается отдельно.`,
    usage: 'underfloor_heating_base',
    bottomBoundary: 'heated',
    layers: [
      {
        name: 'Железобетонная плита перекрытия',
        thicknessM: 0.15,
        thermalConductivityWmK: 1.74,
        isHeatingLayer: false,
      },
      {
        name: 'Теплоизоляция (XPS)',
        thicknessM: xpsThicknessM,
        thermalConductivityWmK: 0.034,
        isHeatingLayer: false,
      },
      {
        name: 'Стяжка ТП с трубами',
        thicknessM: 0.065,
        thermalConductivityWmK: 1.4,
        isHeatingLayer: true,
      },
      {
        name: 'Самовыровнивающийся слой',
        thicknessM: 0.005,
        thermalConductivityWmK: 1.1,
        isHeatingLayer: false,
      },
    ],
  };
}

/** @type {UnderfloorHeatingBasePreset[]} */
export const UNDERFLOOR_HEATING_BASE_PRESETS = [
  buildInterstoryUfhBasePreset({
    id: DEFAULT_UFH_BASE_PRESET_ID,
    name: 'Межэтажная основа (ГОСТ): плита + XPS 30 мм + стяжка ТП 65 мм',
    xpsThicknessM: 0.03,
  }),
  buildInterstoryUfhBasePreset({
    id: 'ufh_base_interstory_screed_65_xps50',
    name: 'Межэтажная основа: плита + XPS 50 мм + стяжка ТП 65 мм',
    xpsThicknessM: 0.05,
  }),
  buildInterstoryUfhBasePreset({
    id: 'ufh_base_interstory_screed_65_xps80',
    name: 'Межэтажная основа: плита + XPS 80 мм + стяжка ТП 65 мм',
    xpsThicknessM: 0.08,
  }),
  buildInterstoryUfhBasePreset({
    id: 'ufh_base_interstory_screed_65_xps100',
    name: 'Межэтажная основа: плита + XPS 100 мм + стяжка ТП 65 мм',
    xpsThicknessM: 0.1,
  }),
].map((preset) => ({
  ...preset,
  baseCoveringResistanceM2KW: computeBaseCoveringResistanceM2KW(preset.layers),
}));

/**
 * @param {string} basePresetId
 * @returns {UnderfloorHeatingBasePreset | null}
 */
export function getUnderfloorHeatingBasePresetById(basePresetId) {
  if (!basePresetId) return null;
  return (
    UNDERFLOOR_HEATING_BASE_PRESETS.find((p) => p.id === basePresetId) ?? null
  );
}

/**
 * Разрешает base + finish из комнаты (с миграцией legacy presetId).
 *
 * @param {{ enabled?: boolean, presetId?: string, basePresetId?: string, finishMaterialId?: string }} ufh
 * @returns {{ basePresetId: string, finishMaterialId: string } | null}
 */
export function resolveUnderfloorHeatingComposition(ufh) {
  if (!ufh || ufh.enabled !== true) return null;

  let basePresetId =
    typeof ufh.basePresetId === 'string' ? ufh.basePresetId.trim() : '';
  let finishMaterialId =
    typeof ufh.finishMaterialId === 'string' ? ufh.finishMaterialId.trim() : '';

  const legacyId = typeof ufh.presetId === 'string' ? ufh.presetId.trim() : '';
  if ((!basePresetId || !finishMaterialId) && legacyId) {
    const mapped =
      /** @type {Record<string, { basePresetId: string, finishMaterialId: string }>} */ (
        LEGACY_MONOLITHIC_UFH_PRESET_MAP
      )[legacyId];
    if (mapped) {
      basePresetId = mapped.basePresetId;
      finishMaterialId = mapped.finishMaterialId;
    }
  }

  if (!basePresetId || !finishMaterialId) return null;
  const base = getUnderfloorHeatingBasePresetById(basePresetId);
  const finish = getFlooringFinishMaterialById(finishMaterialId);
  if (!base || !finish) return null;

  return { basePresetId, finishMaterialId, base, finish };
}
