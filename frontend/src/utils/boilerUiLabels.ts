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
      'Розрахунок для підбору котла: лише опалення з запасом (гаряча вода нагрівається окремим електричним бойлером)',
    dhwPartLabel: 'Розрахункова потужність на гарячу воду (електробойлер, до котла не відноситься)',
    requiredKwLabel: 'Необхідна потужність котла (лише опалення з запасом)',
    condensingRequiredLabel: 'Необхідна потужність (лінія конденсації), лише опалення',
    proposalEconomyTitle: 'Варіант 1 · економ клас — котел під опалення',
    proposalEfficientTitle: 'Варіант 2 · ефективний / конденсаційний — котел під опалення',
  },
  [SCHEME_BOILER_SINGLE_INDIRECT_SUM]: {
    summaryHeadline:
      'Розрахунок для підбору котла: одноконтурний котел з БКН (сума опалення з запасом і потужності нагрівання бака)',
    dhwPartLabel: 'Розрахункова потужність на нагрівання бака БКН (додається до опалення з запасом)',
    requiredKwLabel: 'Необхідна потужність котла (опалення з запасом + нагрівання бака)',
    condensingRequiredLabel: 'Необхідна потужність (лінія конденсації), сума опалення та ГВП',
    proposalEconomyTitle: 'Варіант 1 · економ клас — котел за сумою опалення та БКН',
    proposalEfficientTitle:
      'Варіант 2 · ефективний / конденсаційний — котел за сумою опалення та БКН',
  },
  [SCHEME_BOILER_COMBI_BUFFER_ELECTRIC]: {
    summaryHeadline:
      'Розрахунок для підбору котла: двоконтурний котел (max опалення та піку ГВП) + буферний електробойлер',
    dhwPartLabel:
      'Розрахункова потужність на пік ГВП (котел нагріває проток; враховується в правилі максимуму)',
    requiredKwLabel:
      'Необхідна потужність котла (max опалення з запасом і піку ГВП; буфер — окремо)',
    condensingRequiredLabel:
      'Необхідна потужність (лінія конденсації), max опалення та піку ГВП',
    proposalEconomyTitle:
      'Варіант 1 · економ клас — двоконтурний котел (max) + буферний ЕВН',
    proposalEfficientTitle:
      'Варіант 2 · ефективний / конденсаційний — двоконтурний (max) + буферний ЕВН',
  },
  [SCHEME_BOILER_SINGLE_BUFFER_ELECTRIC]: {
    summaryHeadline:
      'Розрахунок для підбору котла: одноконтурний котел (лише опалення з запасом) + буферний електробойлер',
    dhwPartLabel: 'Розрахункова потужність на гарячу воду (електробойлер, до котла не відноситься)',
    requiredKwLabel: 'Необхідна потужність котла (лише опалення з запасом)',
    condensingRequiredLabel: 'Необхідна потужність (лінія конденсації), лише опалення',
    proposalEconomyTitle: 'Варіант 1 · економ клас — одноконтурний котел + буферний ЕВН',
    proposalEfficientTitle:
      'Варіант 2 · ефективний / конденсаційний — одноконтурний + буферний ЕВН',
  },
  [SCHEME_BOILER_MAX_COMBI]: {
    summaryHeadline:
      'Розрахунок для підбору котла: двоконтурний котел з пріоритетом гарячої води (потужність — не нижче більшого з двох складових)',
    dhwPartLabel: 'Розрахункова потужність на гарячу воду (враховується в правилі максимуму)',
    requiredKwLabel:
      'Необхідна потужність котла (максимум з опалення з запасом і гарячої води)',
    condensingRequiredLabel: 'Необхідна потужність (лінія конденсації), правило максимуму',
    proposalEconomyTitle:
      'Варіант 1 · економ клас — котел під опалення та гарячу воду за правилом максимуму',
    proposalEfficientTitle:
      'Варіант 2 · ефективний / конденсаційний — опалення та гаряча вода за правилом максимуму',
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
        'Варіант 1 · економ клас — двоконтурний котел (max опалення та ГВП)',
      proposalEfficientTitle:
        'Варіант 2 · ефективний / конденсаційний — котел під опалення',
    };
  }
  return base;
}
