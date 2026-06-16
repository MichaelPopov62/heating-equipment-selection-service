/**
 * Назначение: Форма шага «Горячее водоснабжение».
 * Описание: Жильцы, температура ГВС, сезон ХВ, точки водоразбора и тропический душ.
 */

import { useMemo } from 'react';
import type { HotWaterFormFixtures, HotWaterFormValue } from '../../types/hotWater';
import styles from './HotWaterForm.module.css';

type Props = {
  value: HotWaterFormValue;
  onChange: (next: HotWaterFormValue) => void;
};

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function HotWaterForm({ value, onChange }: Props) {
  const setResidents = (n: number) =>
    onChange({ ...value, residents: clampInt(n, 0, 20) });

  const setTemp = (key: 'hotWaterC', n: number) =>
    onChange({ ...value, [key]: n });

  const setFixture = (key: keyof HotWaterFormFixtures, n: number) =>
    onChange({
      ...value,
      fixtures: {
        ...value.fixtures,
        [key]: clampInt(n, 0, 30),
      },
    });

  const f = value.fixtures;

  const thermalTotal = useMemo(() => {
    return (
      f.shower +
      f.bath +
      f.sink +
      f.kitchenSink +
      f.dishwasher +
      f.laundrySink +
      f.washingMachine +
      f.bidet
    );
  }, [f]);

  const allPointsTotal = useMemo(() => thermalTotal + f.toilet, [thermalTotal, f.toilet]);

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>Горячее водоснабжение</h2>
      <p className={styles.hint}>
        Тип объекта задаётся на шаге «Объект»: для{' '}
        <strong>квартиры</strong> считается проточный сценарий (мощность от пикового расхода); для{' '}
        <strong>дома</strong> — накопительный (объём бака без суммирования суточной нормы с объёмом
        ванны; мощность для котла — от нагрева бака за время, не от «пролива»).
      </p>

      <div className={styles.row}>
        <div className={`${styles.field} ${styles.checkboxRow}`}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={value.tropicalShower}
              onChange={(e) => onChange({ ...value, tropicalShower: e.target.checked })}
            />
            <span>
              Усиленный («тропический») душ — для дома увеличивает расчётный объём накопительного
              бака на 30&nbsp;%
            </span>
          </label>
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="hw-residents">
            Число человек
          </label>
          <input
            id="hw-residents"
            className={styles.control}
            type="number"
            min={0}
            max={20}
            value={value.residents}
            onChange={(e) => setResidents(Number(e.target.value))}
          />
        </div>
        <div className={styles.field}>
          <span className={styles.label} id="hw-cold-season-label">
            Расчётная температура холодной воды
          </span>
          <div className={styles.seasonChoice} role="group" aria-labelledby="hw-cold-season-label">
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="coldWaterDesignSeason"
                checked={value.coldWaterDesignSeason === 'winter'}
                onChange={() => onChange({ ...value, coldWaterDesignSeason: 'winter' })}
              />
              Зима (+5&nbsp;°C)
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="coldWaterDesignSeason"
                checked={value.coldWaterDesignSeason === 'summer'}
                onChange={() => onChange({ ...value, coldWaterDesignSeason: 'summer' })}
              />
              Лето (+15&nbsp;°C)
            </label>
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="hw-hot">
            ГВ, °C (55…60)
          </label>
          <input
            id="hw-hot"
            className={styles.control}
            type="number"
            min={55}
            max={60}
            step={0.5}
            value={value.hotWaterC}
            onChange={(e) => setTemp('hotWaterC', Number(e.target.value))}
          />
        </div>
      </div>

      <h3 className={styles.subheading}>Точки по помещениям</h3>

      <div className={styles.fixtureSection}>
        <h4 className={styles.fixtureSectionTitle}>Кухня</h4>
        <p className={styles.fixtureSectionHint}>
          Укажите, какие точки водоразбора с горячей водой есть на кухне.
        </p>
        <div className={styles.fixturesGrid}>
          <div className={styles.fixtureField}>
            <label className={styles.label} htmlFor="fx-kitchen-sink">
              Мойка / смеситель
            </label>
            <input
              id="fx-kitchen-sink"
              className={styles.control}
              type="number"
              min={0}
              max={30}
              value={f.kitchenSink}
              onChange={(e) => setFixture('kitchenSink', Number(e.target.value))}
            />
          </div>
          <div className={styles.fixtureField}>
            <label className={styles.label} htmlFor="fx-dishwasher">
              Посудомоечная машина
            </label>
            <input
              id="fx-dishwasher"
              className={styles.control}
              type="number"
              min={0}
              max={30}
              value={f.dishwasher}
              onChange={(e) => setFixture('dishwasher', Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className={styles.fixtureSection}>
        <h4 className={styles.fixtureSectionTitle}>Санузел</h4>
        <p className={styles.fixtureSectionHint}>
          Точки в ванной / совмещённом санузле (можно суммарно по всем санузлам объекта).
        </p>
        <div className={styles.fixturesGrid}>
          <div className={styles.fixtureField}>
            <label className={styles.label} htmlFor="fx-shower">
              Душ
            </label>
            <input
              id="fx-shower"
              className={styles.control}
              type="number"
              min={0}
              max={30}
              value={f.shower}
              onChange={(e) => setFixture('shower', Number(e.target.value))}
            />
          </div>
          <div className={styles.fixtureField}>
            <label className={styles.label} htmlFor="fx-bath">
              Ванна
            </label>
            <input
              id="fx-bath"
              className={styles.control}
              type="number"
              min={0}
              max={30}
              value={f.bath}
              onChange={(e) => setFixture('bath', Number(e.target.value))}
            />
          </div>
          <div className={styles.fixtureField}>
            <label className={styles.label} htmlFor="fx-sink">
              Раковина
            </label>
            <input
              id="fx-sink"
              className={styles.control}
              type="number"
              min={0}
              max={30}
              value={f.sink}
              onChange={(e) => setFixture('sink', Number(e.target.value))}
            />
          </div>
          <div className={styles.fixtureField}>
            <label className={styles.label} htmlFor="fx-toilet">
              Унитаз
            </label>
            <input
              id="fx-toilet"
              className={styles.control}
              type="number"
              min={0}
              max={30}
              value={f.toilet}
              onChange={(e) => setFixture('toilet', Number(e.target.value))}
            />
          </div>
          <div className={styles.fixtureField}>
            <label className={styles.label} htmlFor="fx-bidet">
              Биде
            </label>
            <input
              id="fx-bidet"
              className={styles.control}
              type="number"
              min={0}
              max={30}
              value={f.bidet}
              onChange={(e) => setFixture('bidet', Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className={styles.fixtureSection}>
        <h4 className={styles.fixtureSectionTitle}>Хозблок / техпомещение / прачечная</h4>
        <p className={styles.fixtureSectionHint}>
          Точки в подсобке, котельной, прачечной и т.п.
        </p>
        <div className={styles.fixturesGrid}>
          <div className={styles.fixtureField}>
            <label className={styles.label} htmlFor="fx-laundry">
              Мойка
            </label>
            <input
              id="fx-laundry"
              className={styles.control}
              type="number"
              min={0}
              max={30}
              value={f.laundrySink}
              onChange={(e) => setFixture('laundrySink', Number(e.target.value))}
            />
          </div>
          <div className={styles.fixtureField}>
            <label className={styles.label} htmlFor="fx-washer">
              Стиральная машина
            </label>
            <input
              id="fx-washer"
              className={styles.control}
              type="number"
              min={0}
              max={30}
              value={f.washingMachine}
              onChange={(e) => setFixture('washingMachine', Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className={styles.summary}>
        <h4 className={styles.summaryTitle}>Сводка: количество точек</h4>
        <table className={styles.summaryTable}>
          <tbody>
            <tr>
              <th scope="row">Душ</th>
              <td>{f.shower}</td>
            </tr>
            <tr>
              <th scope="row">Ванна</th>
              <td>{f.bath}</td>
            </tr>
            <tr>
              <th scope="row">Раковина (санузел)</th>
              <td>{f.sink}</td>
            </tr>
            <tr>
              <th scope="row">Унитаз</th>
              <td>{f.toilet}</td>
            </tr>
            <tr>
              <th scope="row">Биде</th>
              <td>{f.bidet}</td>
            </tr>
            <tr>
              <th scope="row">Кухня — мойка / смеситель</th>
              <td>{f.kitchenSink}</td>
            </tr>
            <tr>
              <th scope="row">Кухня — посудомоечная машина</th>
              <td>{f.dishwasher}</td>
            </tr>
            <tr>
              <th scope="row">Мойка (хозблок)</th>
              <td>{f.laundrySink}</td>
            </tr>
            <tr>
              <th scope="row">Стиральная машина (техпомещение)</th>
              <td>{f.washingMachine}</td>
            </tr>
            <tr className={styles.summaryTotal}>
              <th scope="row">Итого точек с расходом ГВ (для расчёта пика)</th>
              <td>{thermalTotal}</td>
            </tr>
            <tr className={styles.summaryTotal}>
              <th scope="row">Всего учтённых точек (с унитазом)</th>
              <td>{allPointsTotal}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
