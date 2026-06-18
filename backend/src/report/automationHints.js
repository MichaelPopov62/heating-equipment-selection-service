/**
 * Назначение: подсказки автоматизации схем котёл/ГВС.
 * Описание: Формирует массив matchingAutomationHints для meta отчёта на основе типа объекта, пиковой мощности ГВС и активной схемы подбора котла. Предлагает альтернативные схемы (БКН, электробойлер, max-комби). Вызывается из buildReport.js.
 */

import {
  SCHEME_BOILER_ELECTRIC_SEPARATE,
  SCHEME_BOILER_MAX_COMBI,
  SCHEME_BOILER_SINGLE_INDIRECT_SUM,
} from '../../../shared/heatingMatchingSchemes.js';
import {
  isLargeApartment,
  isLargeApartmentByInput,
} from '../utils/apartmentMatching.js';

/**
 * @param {object} args
 * @param {'apartment' | 'house'} args.objectType
 * @param {import('../types/shared-types').HotWaterReport | undefined} args.hotWaterReport
 * @param {string | undefined} args.activeScheme
 * @param {import('../types/shared-types').BuildingInput | undefined} [args.building]
 * @param {number | undefined} [args.heatingLoadKw]
 * @param {import('../dhw/types').BoilerApplianceRules['apartmentClassification']} [args.apartmentClassification]
 * @returns {import('../types/shared-types').MatchingAutomationHint[]}
 */
export function buildMatchingAutomationHints({
  objectType,
  hotWaterReport,
  activeScheme,
  building,
  heatingLoadKw,
  apartmentClassification,
} = {}) {
  /** @type {import('../types/shared-types').MatchingAutomationHint[]} */
  const hints = [];
  if (!hotWaterReport) return hints;

  const peak = Number(hotWaterReport.peakThermalPowerKw);
  const fx = hotWaterReport.fixtures ?? {};
  const thermalPoints =
    (fx.shower ?? 0) + (fx.bath ?? 0) + (fx.sink ?? 0) + (fx.kitchenSink ?? 0);

  const scheme = activeScheme ?? SCHEME_BOILER_MAX_COMBI;

  if (objectType === 'house' && hotWaterReport.dhwSupplyScenario === 'storage') {
    if (peak > 30 && scheme === SCHEME_BOILER_MAX_COMBI) {
      hints.push({
        type: 'suggest_single_indirect_sum',
        message:
          `Пиковая тепловая мощность проточного режима (${peak.toFixed(1)} кВт) высокая — для дома с БКН рекомендуется схема «одноконтурный котёл + БКН» с суммированием мощностей отопления и нагрева бака.`,
        suggestedScheme: SCHEME_BOILER_SINGLE_INDIRECT_SUM,
      });
    }
    if (peak <= 24 && thermalPoints <= 4 && scheme === SCHEME_BOILER_SINGLE_INDIRECT_SUM) {
      hints.push({
        type: 'suggest_combi_budget',
        message:
          'При умеренном водоразборе и пике ГВС до ~24 кВт двухконтурный котёл по правилу max(отопление, ГВС) часто компактнее и дешевле — сверьте с проектом.',
        suggestedScheme: SCHEME_BOILER_MAX_COMBI,
      });
    }
  }

  if (objectType === 'apartment') {
    const large =
      heatingLoadKw != null
        ? isLargeApartment(building, heatingLoadKw, fx, apartmentClassification)
        : isLargeApartmentByInput(building, fx, apartmentClassification);

    if (!large && scheme === SCHEME_BOILER_SINGLE_INDIRECT_SUM) {
      hints.push({
        type: 'apartment_bkn_small_not_recommended',
        message:
          'Для малых квартир БКН обычно избыточен — рассмотрите двухконтурный котёл или схему с электробойлером.',
        suggestedScheme: SCHEME_BOILER_MAX_COMBI,
      });
    }

    if (
      large &&
      scheme === SCHEME_BOILER_MAX_COMBI &&
      hotWaterReport.dhwSupplyScenario === 'flowThrough' &&
      peak > 20
    ) {
      hints.push({
        type: 'apartment_suggest_bkn_large',
        message:
          'Для большой квартиры с высоким пиком ГВС может подойти схема «1К + БКН» при наличии места под бойлер — укажите indirectDhwSpaceAvailable.',
        suggestedScheme: SCHEME_BOILER_SINGLE_INDIRECT_SUM,
      });
    }

    if (
      scheme === SCHEME_BOILER_ELECTRIC_SEPARATE &&
      (hotWaterReport.recommendedTankLiters ?? 0) > 0
    ) {
      hints.push({
        type: 'apartment_electric_storage_volume',
        message: `Объём электробойлера рассчитан по норме ${hotWaterReport.recommendedTankLiters} л (50 л на проживающего, минимум 50 л).`,
      });
    }
  }

  return hints;
}
