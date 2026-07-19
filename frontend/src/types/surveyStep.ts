/**
 * Назначение: Тип шагов мастера анкеты.
 * Описание: Union SurveyCurrentStep; порядок и навигация — constants/surveySteps.ts
 * (SURVEY_STEPS: object → … → technicalResult → dataReference → financialResult).
 */

export type SurveyCurrentStep =
  | 'object'
  | 'warmFloor'
  | 'rooms'
  | 'hotWater'
  | 'boiler'
  | 'radiators'
  | 'waterHeater'
  | 'hydraulics'
  | 'technicalResult'
  | 'dataReference'
  | 'financialResult';
