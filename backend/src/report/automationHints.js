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
 * @param {import('../types/shared-types.js').HotWaterReport | undefined} args.hotWaterReport
 * @param {string | undefined} args.activeScheme
 * @param {import('../types/shared-types.js').BuildingInput | undefined} [args.building]
 * @param {number | undefined} [args.heatingLoadKw]
 * @param {import('../dhw/types.js').BoilerApplianceRules['apartmentClassification']} [args.apartmentClassification]
 * @returns {import('../types/shared-types.js').MatchingAutomationHint[]}
 */
export function buildMatchingAutomationHints({
  objectType,
  hotWaterReport,
  activeScheme,
  building,
  heatingLoadKw,
  apartmentClassification,
}) {
  /** @type {import('../types/shared-types.js').MatchingAutomationHint[]} */
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
          `Пікова теплова потужність проточного режиму (${peak.toFixed(1)} кВт) висока — для будинку з БКН рекомендується схема «одноконтурний котел + БКН» з сумуванням потужностей опалення та нагрівання бака.`,
        suggestedScheme: SCHEME_BOILER_SINGLE_INDIRECT_SUM,
      });
    }
    if (peak <= 24 && thermalPoints <= 4 && scheme === SCHEME_BOILER_SINGLE_INDIRECT_SUM) {
      hints.push({
        type: 'suggest_combi_budget',
        message:
          'За помірного водорозбору та піку ГВП до ~24 кВт двоконтурний котел за правилом max(опалення, ГВП) часто компактніший і дешевший — звірте з проєктом.',
        suggestedScheme: SCHEME_BOILER_MAX_COMBI,
      });
    }
  }

  if (objectType === 'apartment' && apartmentClassification) {
    const large =
      heatingLoadKw != null
        ? isLargeApartment(building, heatingLoadKw, fx, apartmentClassification)
        : isLargeApartmentByInput(building, fx, apartmentClassification);

    if (!large && scheme === SCHEME_BOILER_SINGLE_INDIRECT_SUM) {
      hints.push({
        type: 'apartment_bkn_small_not_recommended',
        message:
          'Для малих квартир БКН зазвичай надлишковий — розгляньте двоконтурний котел або схему з електробойлером.',
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
          'Для великої квартири з високим піком ГВП може підійти схема «1К + БКН» за наявності місця під бойлер — вкажіть indirectDhwSpaceAvailable.',
        suggestedScheme: SCHEME_BOILER_SINGLE_INDIRECT_SUM,
      });
    }

    if (
      scheme === SCHEME_BOILER_ELECTRIC_SEPARATE &&
      (hotWaterReport.recommendedTankLiters ?? 0) > 0
    ) {
      hints.push({
        type: 'apartment_electric_storage_volume',
        message: `Об’єм електробойлера розраховано за нормою ${hotWaterReport.recommendedTankLiters} л (50 л на мешканця, мінімум 50 л).`,
      });
    }
  }

  return hints;
}
