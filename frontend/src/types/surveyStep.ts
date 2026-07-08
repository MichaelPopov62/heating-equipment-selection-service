/**
 * Назначение: Тип шагов мастера анкеты.
 * Описание: Union SurveyCurrentStep; порядок и навигация — constants/surveySteps.ts (SURVEY_STEPS).
 */

export type SurveyCurrentStep =
  | 'object'
  | 'rooms'
  | 'hotWater'
  | 'boiler'
  | 'warmFloor'
  | 'radiators'
  | 'waterHeater'
  | 'hydraulics'
  | 'summary';
