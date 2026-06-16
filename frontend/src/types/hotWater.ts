/**
 * Назначение: Типы формы ГВС.
 * Описание: Жильцы, сезон ХВ, температура и точки водоразбора fixtures.
 */

export type HotWaterFormFixtures = {
  shower: number;
  bath: number;
  sink: number;
  toilet: number;
  kitchenSink: number;
  dishwasher: number;
  laundrySink: number;
  washingMachine: number;
  bidet: number;
};

export type HotWaterFormValue = {
  residents: number;
  coldWaterDesignSeason: 'winter' | 'summer';
  hotWaterC: number;
  tropicalShower: boolean;
  fixtures: HotWaterFormFixtures;
};
