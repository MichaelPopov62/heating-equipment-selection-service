/**
 * Назначение: форма шага «Гидравлика» в анкете.
 * Описание: геометрия разводки, тип схемы, длины магистрали и подводов к радиаторам.
 */

import type { RoomFormValue } from '../../types/rooms';
import type { HydraulicsFormValue } from '../../types/hydraulics';
import type { WiringBranchV3, WiringSystemType } from '../../surveySession/wiringLayoutV3';
import { WIRING_SYSTEM_TYPE_OPTIONS } from '../../utils/wiringSystemTypeLabels';
import styles from './HydraulicsSection.module.css';

type HydraulicsSectionProps = {
  value: HydraulicsFormValue;
  onChange: (next: HydraulicsFormValue) => void;
  wiringSystemType: WiringSystemType;
  onWiringSystemTypeChange: (systemType: WiringSystemType) => void;
  branches: WiringBranchV3[];
  rooms: RoomFormValue[];
  onBranchLengthChange: (roomId: string, pipeLengthToEquipmentM: number) => void;
  onBranchReorder: (roomId: string, direction: 'up' | 'down') => void;
};

/**
 * @param rooms — комнаты анкеты
 * @param roomId — id комнаты
 * @returns {string} Отображаемое имя
 */
function resolveRoomLabel(rooms: RoomFormValue[], roomId: string): string {
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return roomId;
  const name = room.name?.trim();
  return name || roomId;
}

/**
 * @param systemType — тип разводки
 * @returns {boolean} Нужен ли порядок радиаторов на магистрали
 */
function isSequentialWiring(systemType: WiringSystemType): boolean {
  return systemType === 'two-pipe-dead-end' || systemType === 'two-pipe-pass';
}

export function HydraulicsSection({
  value,
  onChange,
  wiringSystemType,
  onWiringSystemTypeChange,
  branches,
  rooms,
  onBranchLengthChange,
  onBranchReorder,
}: HydraulicsSectionProps) {
  return (
    <div className={styles.root}>
      <p className={styles.hint}>
        Укажите тип разводки, длину магистрали котёл → коллектор и подводы коллектор →
        радиатор. Δt — для расчёта расхода радиаторного контура (может отличаться от
        номинального графика 75/65 или 55/45). Диаметры труб и насос подбираются
        автоматически — результаты смотрите в правой колонке «Гидравлика — рекомендуемое
        решение».
      </p>

      <fieldset className={styles.wiringFieldset}>
        <legend className={styles.wiringLegend}>Тип разводки системы отопления</legend>
        <div className={styles.wiringOptions} role="presentation">
          {WIRING_SYSTEM_TYPE_OPTIONS.map((opt) => {
            const inputId = `wiring-system-${opt.value}`;
            const isSelected = wiringSystemType === opt.value;
            return (
              <label
                key={opt.value}
                htmlFor={inputId}
                className={`${styles.wiringOption} ${isSelected ? styles.wiringOptionSelected : ''}`}
              >
                <input
                  id={inputId}
                  className={styles.wiringRadio}
                  type="radio"
                  name="wiringSystemType"
                  value={opt.value}
                  checked={isSelected}
                  onChange={() => onWiringSystemTypeChange(opt.value)}
                />
                <span className={styles.wiringOptionBody}>
                  <span className={styles.wiringOptionTitleRow}>
                    <span className={styles.wiringOptionTitle}>{opt.label}</span>
                    {opt.recommended ? (
                      <span className={styles.wiringRecommendedBadge}>Рекомендуется</span>
                    ) : null}
                  </span>
                  <span className={styles.wiringOptionDesc}>{opt.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className={styles.field}>
        Длина магистрали котёл → коллектор, м
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

      {branches.length > 0 ? (
        <div className={styles.branchesBlock}>
          <h4 className={styles.branchesTitle}>
            Подводы коллектор → радиатор, м
          </h4>
          {isSequentialWiring(wiringSystemType) ? (
            <p className={styles.branchesHint}>
              Порядок строк задаёт последовательность радиаторов на магистрали (от котла
              к дальнему прибору).
            </p>
          ) : null}
          <table className={styles.branchesTable}>
            <thead>
              <tr>
                {isSequentialWiring(wiringSystemType) ? (
                  <th className={styles.colOrder}>Порядок</th>
                ) : null}
                <th>Помещение</th>
                <th className={styles.colLength}>Длина, м</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch, index) => (
                <tr key={branch.roomId}>
                  {isSequentialWiring(wiringSystemType) ? (
                    <td className={styles.colOrder}>
                      <div className={styles.orderControls}>
                        <button
                          type="button"
                          className={styles.orderBtn}
                          disabled={index === 0}
                          onClick={() => onBranchReorder(branch.roomId, 'up')}
                          aria-label={`Выше: ${resolveRoomLabel(rooms, branch.roomId)}`}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className={styles.orderBtn}
                          disabled={index === branches.length - 1}
                          onClick={() => onBranchReorder(branch.roomId, 'down')}
                          aria-label={`Ниже: ${resolveRoomLabel(rooms, branch.roomId)}`}
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                  ) : null}
                  <td>{resolveRoomLabel(rooms, branch.roomId)}</td>
                  <td className={styles.colLength}>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      className={styles.branchInput}
                      value={branch.pipeLengthToEquipmentM}
                      onChange={(e) =>
                        onBranchLengthChange(
                          branch.roomId,
                          Number(e.target.value) || 0,
                        )
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={styles.branchesEmpty}>
          Добавьте помещения на шаге «Помещения», чтобы задать длины подводов к
          радиаторам.
        </p>
      )}
    </div>
  );
}
