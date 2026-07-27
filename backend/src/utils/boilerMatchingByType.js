/**
 * Назначение: утилиты подбора котлов по типу технологии и камере сгорания.
 * Описание: Вынесено из matching/boiler.js; фильтрация традиционных и конденсационных линий, расчёт requiredKw по схеме ГВС.
 */

import {
  SCHEME_BOILER_ELECTRIC_SEPARATE,
  SCHEME_BOILER_SINGLE_BUFFER_ELECTRIC,
  SCHEME_BOILER_SINGLE_INDIRECT_SUM,
} from '../../../shared/heatingMatchingSchemes.js';
/**
 * @param {import('../dhw/types.js').BoilerApplianceRules | undefined} boilerRules
 * @returns {import('../dhw/types.js').BoilerApplianceRules}
 */
function resolveBoilerRules(boilerRules) {
  if (boilerRules) return boilerRules;
  throw new Error(
    'boilerMatchingByType: boilerRules обязательны (передайте appliances.byKind.boiler из CalcRuntimeContext).',
  );
}

/**
 * Требуемая мощность котла по схеме ГВС из отопительной части и расчёта горячей воды.
 * @param {import('../types/boiler-types.js').HotWaterBoilerPowerMatchingScheme} scheme
 * @param {number} heatingLoadPartKw
 * @param {number} hwKw
 */
export function requiredKwFromHeatingAndDhw(scheme, heatingLoadPartKw, hwKw) {
  const heat = Number(heatingLoadPartKw) || 0;
  const hw = Number(hwKw) || 0;
  if (
    scheme === SCHEME_BOILER_ELECTRIC_SEPARATE ||
    scheme === SCHEME_BOILER_SINGLE_BUFFER_ELECTRIC
  ) {
    return heat;
  }
  if (scheme === SCHEME_BOILER_SINGLE_INDIRECT_SUM) return heat + hw;
  return Math.max(heat, hw);
}

/**
 * Жёсткий фильтр каталога по числу контуров (после прочих фильтров).
 * @param {import('../catalog/types.js').BoilerCatalogItemNormalized[]} boilers
 * @param {'double' | 'single' | null | undefined} mode
 */
export function filterBoilersByCircuitMode(boilers, mode) {
  if (mode === 'double') {
    return boilers.filter(
      (b) => /** @type {boolean} */ (b.isDoubleCircuit) === true,
    );
  }
  if (mode === 'single') {
    return boilers.filter(
      (b) => /** @type {boolean} */ (b.isDoubleCircuit) === false,
    );
  }
  return boilers;
}

/**
 * Режим фильтра каталога по числу контуров котла (всегда «single» или «double», без null).
 * — БКН (1К + змеевик): только одноконтурные (узел с трёхходовым и т.п.).
 * — Котёл только на отопление + электро ГВС: только одноконтурные.
 * — Двухконтурный комби (включая дом с накопителем в расчёте ГВС): только двухконтурные.
 *
 * @param {object} p
 * @param {import('../types/boiler-types.js').HotWaterBoilerPowerMatchingScheme | undefined} p.scheme
 * @param {'flowThrough' | 'storage' | undefined} [p.dhwSupplyScenario]
 * @returns {'double' | 'single'}
 */
export function resolveBoilerCircuitFilterMode({ scheme, dhwSupplyScenario }) {
  void dhwSupplyScenario;
  if (scheme === SCHEME_BOILER_SINGLE_INDIRECT_SUM) return 'single';
  if (
    scheme === SCHEME_BOILER_ELECTRIC_SEPARATE ||
    scheme === SCHEME_BOILER_SINGLE_BUFFER_ELECTRIC
  ) {
    return 'single';
  }
  return 'double';
}

/**
 * Отопительная нагрузка с запасом для линии «Эффективный» (конденсация).
 * @param {number} heatLossKw
 * @param {import('../dhw/types.js').BoilerApplianceRules} boilerRules
 */
export function heatingLoadKwForCondensingLine(heatLossKw, boilerRules) {
  return Number(heatLossKw) * resolveBoilerRules(boilerRules).matching.condensingHeatingReserveFactor;
}

/**
 * Конденсационная технология котла из каталога (type или тег «condensing»).
 * @param {import('../catalog/types.js').BoilerCatalogItemNormalized | Record<string, unknown>} boiler
 */
export function isCondensingBoiler(boiler) {
  const type = String(
    /** @type {Record<string, unknown>} */ (boiler)?.type ?? '',
  ).toLowerCase();
  if (type.includes('condens')) return true;
  const tags = /** @type {unknown[]} */ (
    /** @type {Record<string, unknown>} */ (boiler).tags ?? []
  );
  if (!Array.isArray(tags)) return false;
  return tags.some((t) => String(t).toLowerCase() === 'condensing');
}

/**
 * Традиционный (не конденсационный) котёл из позиции каталога.
 * @param {import('../catalog/types.js').BoilerCatalogItemNormalized | Record<string, unknown>} boiler
 */
function isTraditionalBoiler(boiler) {
  return !isCondensingBoiler(boiler);
}

/**
 * Фильтр каталога: линия «Эконом» — только не конденсационные аппараты.
 * @param {import('../catalog/types.js').BoilerCatalogItemNormalized[]} boilers
 */
export function filterBoilersForEconomyLine(boilers) {
  return boilers.filter((b) => isTraditionalBoiler(b));
}

/**
 * Фильтр каталога: линия «Эффективный» — только конденсационные аппараты.
 * @param {import('../catalog/types.js').BoilerCatalogItemNormalized[]} boilers
 */
export function filterBoilersForEfficientLine(boilers) {
  return boilers.filter((b) => isCondensingBoiler(b));
}

/**
 * Соответствие котла предпочтению камеры (турбо / атмосферный).
 * @param {'turbo' | 'atmospheric' | undefined} preferred
 * @param {Record<string, unknown>} boiler
 */
export function matchesCombustionTypePreference(preferred, boiler) {
  if (!preferred) return true;
  const ct = String(boiler?.combustionType ?? '').toLowerCase();
  if (!ct) return true;
  return ct === preferred;
}

/**
 * Рекомендации по эксплуатации конденсационной линии (график, без избыточного номинала).
 * @param {number} reserveFactorTraditional множитель запаса на линии «Эконом» (например 1.15)
 * @param {import('../dhw/types.js').BoilerApplianceRules} boilerRules
 * @returns {import('../types/boiler-types.js').BoilerMatchingRecommendation[]}
 */
export function buildCondensingBoilerMatchingRecommendations(
  reserveFactorTraditional,
  boilerRules,
) {
  const rules = resolveBoilerRules(boilerRules);
  return [
    {
      type: 'condensing_low_temp_graph',
      message:
        'Конденсаційний котел: стійка конденсація та високий ККД зазвичай досягаються, коли температура звороту нижча за точку роси димових газів (орієнтовно близько 55 °C). Проєктуйте контур опалення під низькотемпературний графік подачі/звороту, наприклад 55/45 °C або 50/30 °C.',
    },
    {
      type: 'condensing_avoid_oversizing',
      message: `Лінія підбору «Ефективний» (конденсаційні апарати): опалювальне навантаження рахується з запасом ×${rules.matching.condensingHeatingReserveFactor} замість ×${reserveFactorTraditional} — надлишковий номінал підвищує тактування та погіршує ефективність і ресурс теплообмінника.`,
    },
  ];
}

/**
 * Подсказка про каскад для традиционной линии (общий подбор / эконом), если одна машина и мощность > 30 кВт.
 * @param {number} requiredKw
 * @param {import('../dhw/types.js').BoilerApplianceRules} boilerRules
 * @returns {import('../types/boiler-types.js').BoilerMatchingRecommendation | null}
 */
export function buildTraditionalCascadeHint(requiredKw, boilerRules) {
  const req = Number(requiredKw);
  const minKw = resolveBoilerRules(boilerRules).matching.cascadeHintMinKw;
  if (!(req > minKw)) return null;
  return {
    type: 'cascade_hint',
    message:
      `Потрібна потужність понад ${minKw} кВт: на практиці часто застосовують каскад із двох і більше котлів для резервування та модуляції.`,
    suggestedSplitKw: [req / 2, req / 2].map((x) => Number(x.toFixed(1))),
  };
}

/**
 * Подсказка про каскад для конденсационной линии подбора.
 * @param {number} requiredKwCondensing
 * @param {import('../dhw/types.js').BoilerApplianceRules} boilerRules
 * @returns {import('../types/boiler-types.js').BoilerMatchingRecommendation | null}
 */
export function buildCondensingCascadeHint(requiredKwCondensing, boilerRules) {
  const req = Number(requiredKwCondensing);
  const minKw = resolveBoilerRules(boilerRules).matching.cascadeHintMinKw;
  if (!(req > minKw)) return null;
  return {
    type: 'cascade_hint_condensing',
    message:
      `За лінією конденсаційного підбору потрібна потужність понад ${minKw} кВт: розгляньте каскад для модуляції та резервування.`,
    suggestedSplitKw: [req / 2, req / 2].map((x) => Number(x.toFixed(1))),
  };
}

/**
 * Тексты к заметкам карточки предложения по камере сгорания.
 * @param {import('../catalog/types.js').BoilerCatalogItemNormalized | Record<string, unknown>} boiler
 * @returns {string[]}
 */
export function chimneyNotesForBoilerCombustionType(boiler) {
  /** @type {string[]} */
  const notes = [];
  if (String(boiler.combustionType ?? '') === 'atmospheric') {
    notes.push(
      'Атмосферний котел: потрібен димоход з природною тягою, відповідність нормам безпеки.',
    );
  }
  if (String(boiler.combustionType ?? '') === 'turbo') {
    notes.push(
      'Турбований котел: типовий коаксіальний димоход через зовнішню стіну (за паспортом).',
    );
  }
  return notes;
}

/**
 * Заметка про слив конденсата для конденсационного котла.
 */
export function condensingDrainNoteText() {
  return 'Конденсаційний котел: необхідний організований злив конденсату в каналізацію (за інструкцією виробника: сифон, нейтралізація за потреби).';
}
