/**
 * Назначение: типы справочника recommendations.
 * Описание: TypeScript-декларации нормализованных и разрешённых рекомендаций (REC_*, WARN_*)
 * для JS-модулей; не участвует в рантайме.
 */
export type RecommendationCategory = 'warnings' | 'automationHints';

export interface NormalizedRecommendation {
  code: string;
  schemaVersion: number;
  category: RecommendationCategory;
  equipmentType: string;
  title: string;
  text: string;
}

export interface RecommendationsBundle {
  byCode: Record<string, NormalizedRecommendation>;
  source: 'file' | 'mongo';
}

export interface ResolvedRecommendation {
  code: string;
  category: RecommendationCategory;
  equipmentType: string;
  title: string;
  text: string;
}
