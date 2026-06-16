/**
 * Назначение: типы, связанные с котлами (анкета, подбор, отчёт).
 * Описание: Единая точка для JSDoc import('../types/boiler-types') в matching и utils; схемы ГВС, proposal и matching.boiler.
 */

import type { BoilerCatalogItemNormalized, BoilerMountingType } from '../catalog/types';

/** Камера котла: турбированный или атмосферная тяга. */
export type BoilerCombustionType = 'turbo' | 'atmospheric';

/**
 * Как учитывать горячую воду при подборе номинальной мощности котла.
 * По умолчанию на сервере — первый вариант (двухконтурный котёл, приоритет горячей воды).
 */
export type HotWaterBoilerPowerMatchingScheme =
  /** max(теплопотери×запас, расчётная мощность на горячую воду), без суммирования — типично двухконтурный котёл. */
  | 'maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw'
  /** Котёл только по отоплению×запас; горячую воду греет отдельный электрический накопитель. */
  | 'heatingLoadWithReserveOnlySeparateElectricStorageWaterHeater'
  /** Одноконтурный котёл + БКН: сумма отопления с запасом и мощности нагрева бака. */
  | 'singleCircuitBoilerWithIndirectTankHeatingPlusTankPowerKw'
  /** Двухконтурный котёл + буферный электробойлер: max(отопление×запас, пик ГВС); объём бака — буферный. */
  | 'combiBoilerWithBufferElectricStorage'
  /** Одноконтурный котёл + буферный электробойлер: котёл только по отоплению с запасом. */
  | 'singleCircuitBoilerWithBufferElectricStorage';

/** Переключение контура котла при оптимизации для квартиры (1К+электро → 2К). */
export interface BoilerCircuitFallbackReport {
  from: 'single';
  to: 'double';
  reason: 'no_single_in_catalog';
  /** Схема, по которой фактически подобран котёл. */
  effectiveScheme: HotWaterBoilerPowerMatchingScheme;
  /** Минимальный номинал 1К в каталоге после фильтров, кВт (для пояснений). */
  smallestSingleMaxKw?: number;
}

export interface BoilerMatchingRecommendation {
  type: string;
  message: string;
  suggestedSplitKw?: number[];
}

/** Составляющие расчётной мощности для карточки подбора котла (UI и контракт API). */
export interface BoilerEquipmentProposalPowerBreakdown {
  /** Отопление с коэффициентом запаса для линии карточки (основная/эконом — как отчёт heatingLoadKw; «Эффективный» — heatingLoadKwCondensing). */
  heatingLoadKw: number;
  /** Расчётная тепловая мощность ГВС из блока расчёта (совпадает с matching.boiler.hotWaterPowerKw). */
  hotWaterPowerKw: number;
}

/** Разбивка суммы связки котёл + ГВС-оборудование для UI. */
export interface EquipmentBundlePriceBreakdown {
  boilerPrice?: number;
  waterHeaterPrice?: number;
  indirectWaterHeaterPrice?: number;
}

/** Сопутствующее ГВС-оборудование в карточке варианта (электробойлер или БКН). */
export interface EquipmentBundleCompanion {
  role: 'water_heater' | 'indirect_water_heater';
  model: string;
  brand?: string;
  volumeLiters?: number;
  price?: number;
}

/** Структурированное «техническое предложение» по котлу (одиночный или каскад). */
export interface BoilerEquipmentProposal {
  kind: 'single' | 'cascade';
  /** Короткий заголовок для UI (например «Каскадная котельная»). */
  headline: string;
  model: string;
  unitsCount: number;
  unitMaxPowerKw: number;
  /** Суммарный номинал по паспорту: unitsCount × unitMaxPowerKw. */
  totalNominalKw: number;
  /** Требуемая мощность котла по расчёту подбора, кВт. */
  requiredKw: number;
  /** Отопление и ГВС для подписей «из них…»; сумма может не совпадать с requiredKw при формуле max(...) или только отопление. */
  powerRequirementBreakdown: BoilerEquipmentProposalPowerBreakdown;
  /** Для одиночного котла может считаться от минимальной модуляции (powerKw.min) и отопительной базы (не от номинала max/requiredKw); для каскада — по суммарному номиналу и requiredKw. Ограничение сверху 150 %. */
  nominalReservePercent: number;
  /** Ветка подбора: эконом (традиционный) или эффективный (конденсационный). */
  tier?: 'economy' | 'efficient';
  /** Ориентировочная сумма за все единицы, если в каталоге задана price. */
  estimatedTotalPrice?: number;
  /** Сумма котла и сопутствующего ГВС-оборудования (электробойлер и/или БКН), если есть цены в каталоге. */
  equipmentBundleTotalPrice?: number;
  /** Разбивка equipmentBundleTotalPrice по позициям. */
  equipmentBundlePriceBreakdown?: EquipmentBundlePriceBreakdown;
  /** Электробойлер и/или БКН, входящие в связку с котлом. */
  equipmentBundleCompanions?: EquipmentBundleCompanion[];
  mountingType?: BoilerMountingType;
  connectionDiameters?: string[];
  advantages: string[];
  notes: string[];
}

export interface BoilerMatchingReport {
  heatLossKw: number;
  reserveFactor: number;
  hotWaterPowerKw: number;
  /** Отопительная нагрузка с коэффициентом запаса (кВт), без добавления мощности горячей воды к котлу при отдельном электробойлере. */
  heatingLoadKw: number;
  /** Применённая схема учёта горячей воды для подбора котла. */
  hotWaterBoilerPowerMatchingScheme: HotWaterBoilerPowerMatchingScheme;
  /**
   * Фактическая схема подбора, если отличается от запрошенной (оптимизация квартиры: 1К+электро → 2К).
   */
  effectiveHotWaterBoilerPowerMatchingScheme?: HotWaterBoilerPowerMatchingScheme;
  /** Детали переключения single → double для квартиры. */
  circuitFallback?: BoilerCircuitFallbackReport;
  /**
   * Расчётная требуемая мощность котла для основной линии подбора по схеме hotWaterBoilerPowerMatchingScheme.
   * Для схемы singleCircuitBoilerWithIndirectTankHeatingPlusTankPowerKw может быть не ниже каталожного
   * specs.minSourcePowerKw выбранного БКН (после pickIndirectWaterHeater).
   */
  requiredKw: number;
  /** Коэффициент запаса на отопление для поля heatingLoadKwCondensing и альтернативной связки «1К + БКН» (конденсация). */
  condensingHeatingReserveFactor: number;
  /**
   * Отопительная нагрузка × condensingHeatingReserveFactor; база для поля requiredKwForCondensingLine и для расчёта proposalEfficient
   * при схеме «1К + БКН» (сумма с hotWaterPowerKw). При heatingLoadWithReserveOnlySeparateElectricStorageWaterHeater proposalEfficient
   * использует heatingLoadKw (запас как у основной линии), а не эту величину.
   */
  heatingLoadKwCondensing: number;
  /**
   * То же семейство формулы requiredKw для схемы пользователя, но отопительная часть считается с heatingLoadKwCondensing.
   * При singleCircuitBoilerWithIndirectTankHeatingPlusTankPowerKw возможна нижняя граница по minSourcePowerKw БКН.
   */
  requiredKwForCondensingLine: number;
  selected: BoilerCatalogItemNormalized | null;
  warnings: string[];
  /** Сообщения из справочника recommendations (MongoDB / JSON) по code. */
  resolvedRecommendations?: import('../recommendations/types').ResolvedRecommendation[];
  recommendations: BoilerMatchingRecommendation[];
  /** Готовый блок для карточки «Рекомендуемое решение» в UI (как прежде — общий минимально подходящий по каталогу). */
  proposal?: BoilerEquipmentProposal | null;
  /**
   * Альтернативный «Эконом»: традиционный (не конденсационный) котёл из множества после фильтра по контурам, как основная линия;
   * proposalEconomy.requiredKw совпадает с корневым requiredKw отчёта (та же формула ГВС/отопления), чтобы сравнивать номинал с потребностью системы.
   */
  proposalEconomy?: BoilerEquipmentProposal | null;
  /**
   * Альтернатива «Эффективный»: конденсационный одноконтурный котёл из пула после фильтра камеры.
   * — При singleCircuitBoilerWithIndirectTankHeatingPlusTankPowerKw: порог как «1К + БКН» — сумма heatingLoadKwCondensing и hotWaterPowerKw,
   *   возможно не ниже minSourcePowerKw выбранного БКН.
   * — При heatingLoadWithReserveOnlySeparateElectricStorageWaterHeater: тот же порог, что у основной линии (heatingLoadKw = отопление×запас),
   *   без добавления ГВС и без БКН.
   * Подсказка cascade_hint_condensing после одиночного подбора согласуется с proposalEfficient.requiredKw.
   */
  proposalEfficient?: BoilerEquipmentProposal | null;
  /** Учитывался фильтр по типу сгорания при подборе. */
  combustionTypeFilterApplied?: BoilerCombustionType | null;
}
