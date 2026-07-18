/**
 * Назначение: Типы блока рекомендаций.
 * Описание: Props и вспомогательные типы для RecommendationsBlock и карточек.
 */

import type { ParsedBoilerMatching } from '../utils/parsers/parseBoilerFromReport';
import type { ParsedRadiatorsMatching } from '../utils/parseRadiatorsMatchingFromReport';
import type { ParsedIndirectWaterHeaterMatching } from '../utils/parseIndirectWaterHeaterMatchingFromReport';
import type { ParsedWaterHeaterMatching } from '../utils/parseWaterHeaterMatchingFromReport';
import type { HotWaterBoilerPowerMatchingScheme } from './heatingMatching';
import type { ObjectType } from './envelope';
import type { CatalogEquipmentSnapshot } from '../services/catalog';
import type { ParsedUnderfloorHeating } from './underfloorHeating';
import type { ParsedHydraulicsView } from './hydraulics';
import type { ParsedUniboxesMatching } from '../utils/parseUniboxesMatchingFromReport';
import type { SurveyUiPhase } from '../surveySession/types';
import type { HotWaterFormFixtures } from './hotWater';
import type { ParsedHotWaterReport } from './hotWaterReport';
import type { SurveyCurrentStep } from './surveyStep';

export type QuickEstimate = {
  totalAreaM2: number;
  heatLossKw: number;
  reserveKw: number;
  totalHeatKw: number;
  hotWaterPeakFlowLitersPerSecond: number;
  hotWaterPowerKilowatts: number;
  radiatorsSections: number;
  boilerKw: number;
};

export type ApiHeatLoss = {
  heatLossKw: number;
  reserveKw: number;
  totalHeatKw: number;
} | null;

/** Расчёт ГВС из API — алиас ParsedHotWaterReport для обратной совместимости UI. */
export type ApiHotWater = ParsedHotWaterReport | null;

export type AutomationHint = {
  type: string;
  message: string;
  suggestedScheme?: HotWaterBoilerPowerMatchingScheme;
};

export type RecommendationsBlockProps = {
  className?: string;
  quickEstimate: QuickEstimate;
  apiHeatLoss: ApiHeatLoss;
  apiHotWaterFromReport: ApiHotWater;
  /** Точки водоразбора из анкеты (live) — таблица в «Результатах». */
  hotWaterFixtures: HotWaterFormFixtures;
  waterHeaterScheme: HotWaterBoilerPowerMatchingScheme;
  apiBoilerFromReport: ParsedBoilerMatching | null;
  apiBoilerKw: number | null;
  apiRadiatorsFromReport: ParsedRadiatorsMatching | null;
  apiIndirectWhFromReport: ParsedIndirectWaterHeaterMatching | null;
  apiElectricWhFromReport: ParsedWaterHeaterMatching | null;
  apiUnderfloorHeatingFromReport: ParsedUnderfloorHeating | null;
  apiUniboxesFromReport?: ParsedUniboxesMatching | null;
  /** Підпис агрегату секцій / приладів для RadiatorsSummaryTable. */
  displayedRadiatorSectionsTotal: string;
  apiCatalogSource: 'file' | 'mongo' | null;
  apiAutomationHints: AutomationHint[];
  objectType: ObjectType;
  catalogSnap: CatalogEquipmentSnapshot | null;
  catalogSnapLoading: boolean;
  catalogSnapError: string | null;
  onRetryLoadCatalog: () => void;
  onApplyScheme: (scheme: HotWaterBoilerPowerMatchingScheme) => void;
  apiHydraulicsFromReport?: ParsedHydraulicsView | null;
  calcLoading?: boolean;
  /** Единый флаг устаревания всех секций отчёта (pipeline recalculating). */
  reportIsStale?: boolean;
  uiPhase?: SurveyUiPhase;
  /** Переход на шаг анкеты из inline-ссылок summary-блоков (делегирование клика). */
  onNavigateToSurveyStep?: (step: SurveyCurrentStep) => void;
};
