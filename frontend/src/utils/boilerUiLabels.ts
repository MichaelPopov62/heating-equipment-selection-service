/**
 * Назначение: Подписи UI схем подбора котла.
 * Описание: Человекочитаемые названия HotWaterBoilerPowerMatchingScheme для форм.
 */

import type { ObjectType } from '../types/envelope';
import {
  SCHEME_BOILER_COMBI_BUFFER_ELECTRIC,
  SCHEME_BOILER_ELECTRIC_SEPARATE,
  SCHEME_BOILER_MAX_COMBI,
  SCHEME_BOILER_SINGLE_BUFFER_ELECTRIC,
  SCHEME_BOILER_SINGLE_INDIRECT_SUM,
  type HotWaterBoilerPowerMatchingScheme,
} from '../types/heatingMatching';

type BoilerBaseLabels = {
  summaryHeadline: string;
  dhwPartLabel: string;
  requiredKwLabel: string;
  condensingRequiredLabel: string;
  proposalEconomyTitle: string;
  proposalEfficientTitle: string;
};

const BOILER_UI_LABELS: Record<HotWaterBoilerPowerMatchingScheme, BoilerBaseLabels> = {
  [SCHEME_BOILER_ELECTRIC_SEPARATE]: {
    summaryHeadline:
      'Расчёт для подбора котла: только отопление с запасом (горячая вода нагревается отдельным электрическим бойлером)',
    dhwPartLabel: 'Расчётная мощность на горячую воду (электробойлер, к котлу не относится)',
    requiredKwLabel: 'Требуемая мощность котла (только отопление с запасом)',
    condensingRequiredLabel: 'Требуемая мощность (линия конденсации), только отопление',
    proposalEconomyTitle: 'Вариант 1 · эконом класс — котёл под отопление',
    proposalEfficientTitle: 'Вариант 2 · эффективный / конденсационный — котёл под отопление',
  },
  [SCHEME_BOILER_SINGLE_INDIRECT_SUM]: {
    summaryHeadline:
      'Расчёт для подбора котла: одноконтурный котёл с БКН (сумма отопления с запасом и мощности нагрева бака)',
    dhwPartLabel: 'Расчётная мощность на нагрев бака БКН (суммируется с отоплением с запасом)',
    requiredKwLabel: 'Требуемая мощность котла (отопление с запасом + нагрев бака)',
    condensingRequiredLabel: 'Требуемая мощность (линия конденсации), сумма отопления и ГВС',
    proposalEconomyTitle: 'Вариант 1 · эконом класс — котёл по сумме отопления и БКН',
    proposalEfficientTitle:
      'Вариант 2 · эффективный / конденсационный — котёл по сумме отопления и БКН',
  },
  [SCHEME_BOILER_COMBI_BUFFER_ELECTRIC]: {
    summaryHeadline:
      'Расчёт для подбора котла: двухконтурный котёл (max отопления и пика ГВС) + буферный электробойлер',
    dhwPartLabel:
      'Расчётная мощность на пик ГВС (котёл греет проток; учитывается в правиле максимума)',
    requiredKwLabel:
      'Требуемая мощность котла (max отопления с запасом и пика ГВС; буфер — отдельно)',
    condensingRequiredLabel:
      'Требуемая мощность (линия конденсации), max отопления и пика ГВС',
    proposalEconomyTitle:
      'Вариант 1 · эконом класс — двухконтурный котёл (max) + буферный ЭВН',
    proposalEfficientTitle:
      'Вариант 2 · эффективный / конденсационный — двухконтурный (max) + буферный ЭВН',
  },
  [SCHEME_BOILER_SINGLE_BUFFER_ELECTRIC]: {
    summaryHeadline:
      'Расчёт для подбора котла: одноконтурный котёл (только отопление с запасом) + буферный электробойлер',
    dhwPartLabel: 'Расчётная мощность на горячую воду (электробойлер, к котлу не относится)',
    requiredKwLabel: 'Требуемая мощность котла (только отопление с запасом)',
    condensingRequiredLabel: 'Требуемая мощность (линия конденсации), только отопление',
    proposalEconomyTitle: 'Вариант 1 · эконом класс — одноконтурный котёл + буферный ЭВН',
    proposalEfficientTitle:
      'Вариант 2 · эффективный / конденсационный — одноконтурный + буферный ЭВН',
  },
  [SCHEME_BOILER_MAX_COMBI]: {
    summaryHeadline:
      'Расчёт для подбора котла: двухконтурный котёл с приоритетом горячей воды (мощность — не ниже большего из двух слагаемых)',
    dhwPartLabel: 'Расчётная мощность на горячую воду (учитывается в правиле максимума)',
    requiredKwLabel:
      'Требуемая мощность котла (максимум из отопления с запасом и горячей воды)',
    condensingRequiredLabel: 'Требуемая мощность (линия конденсации), правило максимума',
    proposalEconomyTitle:
      'Вариант 1 · эконом класс — котёл под отопление и горячую воду по правилу максимума',
    proposalEfficientTitle:
      'Вариант 2 · эффективный / конденсационный — отопление и горячая вода по правилу максимума',
  },
};

/** Повертає набір UI-підписів для схеми котла. */
export function getBoilerUiLabels(
  scheme: HotWaterBoilerPowerMatchingScheme,
  objectType?: ObjectType,
): BoilerBaseLabels {
  const base = BOILER_UI_LABELS[scheme];
  // Особливий випадок: квартира + max-комбі → свої підписи для пропозицій.
  if (scheme === SCHEME_BOILER_MAX_COMBI && objectType === 'apartment') {
    return {
      ...base,
      proposalEconomyTitle:
        'Вариант 1 · эконом класс — двухконтурный котёл (max отопления и ГВС)',
      proposalEfficientTitle:
        'Вариант 2 · эффективный / конденсационный — котёл под отопление',
    };
  }
  return base;
}
