/**
 * Назначение: Тип шагов мастера анкеты.
 * Описание: Union SurveyCurrentStep; порядок и навигация — constants/surveySteps.ts
 * (SURVEY_STEPS: object → warmFloor → rooms → … → summary).
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
  | 'summary';
