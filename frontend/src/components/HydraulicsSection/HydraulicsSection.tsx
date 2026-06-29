/**
 * Назначение: форма шага «Гидравлика» в анкете.
 * Описание: Геометрия разводки без ручного ввода диаметров.
 */

import type { HydraulicsFormValue } from '../../types/hydraulics';
import styles from './HydraulicsSection.module.css';

type HydraulicsSectionProps = {
  value: HydraulicsFormValue;
  onChange: (next: HydraulicsFormValue) => void;
};

export function HydraulicsSection({ value, onChange }: HydraulicsSectionProps) {
  return (
    <div className={styles.root}>
      <p className={styles.hint}>
        Укажите длину магистрали и Δt для расчёта расхода радиаторного контура (может отличаться
        от номинального графика 75/65 или 55/45). Диаметры труб и насос подбираются автоматически
        — результаты смотрите в правой колонке «Гидравлика — рекомендуемое решение».
      </p>
      <label className={styles.field}>
        Длина магистрали котёл → распределитель, м
        <input
          type="number"
          min={0}
          step={0.5}
          value={value.mainLineLengthM}
          onChange={(e) =>
            onChange({
              ...value,
              mainLineLengthM: Number(e.target.value) || 0,
            })
          }
        />
      </label>
      <label className={styles.field}>
        Δt системы отопления (радиаторы), K
        <input
          type="number"
          min={1}
          max={30}
          step={1}
          value={value.deltaTSystemK}
          onChange={(e) =>
            onChange({
              ...value,
              deltaTSystemK: Number(e.target.value) || 20,
            })
          }
        />
      </label>
      <label className={styles.field}>
        Предпочтение материала труб (опционально)
        <select
          value={value.pipeMaterialPreference}
          onChange={(e) =>
            onChange({
              ...value,
              pipeMaterialPreference: e.target.value as HydraulicsFormValue['pipeMaterialPreference'],
            })
          }
        >
          <option value="">Авто (из каталога)</option>
          <option value="pex">PEX</option>
          <option value="metal_plastic">Металлопластик</option>
          <option value="steel">Сталь</option>
        </select>
      </label>
    </div>
  );
}
