/**
 * Назначение: Тип шагов мастера анкеты.
 * Описание: Union SurveyCurrentStep: object, rooms, hotWater, warmFloor, summary.
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
