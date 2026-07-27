/**
 * Назначение: форма шага «Гидравлика» в анкете.
 * Описание: разводка, длины; полный расчёт — в модалке (паттерн радиаторов / ГВ).
 */

import { useState } from 'react';

import type { RoomFormValue } from '../../types/rooms';
import type {
  HydraulicsFormValue,
  ParsedHydraulicsView,
} from '../../types/hydraulics';
import type { WiringBranchV3, WiringSystemType } from '../../surveySession/wiringLayoutV3';
import { WIRING_SYSTEM_TYPE_OPTIONS } from '../../utils/wiringSystemTypeLabels';
import { HydraulicsReportDialog } from '../HydraulicsReport/HydraulicsReportDialog';
import { hasHydraulicsReportContent } from '../HydraulicsReport/hasHydraulicsReportContent';
import reportActionsStyles from '../SurveyNavigation/SurveyReportActions.module.css';
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
  hydraulicsReport?: ParsedHydraulicsView | null;
  catalogSource?: 'file' | 'mongo' | null;
  calcLoading?: boolean;
  /** Прокрутка до підсумку гідравліки в сайдбарі «Результати». */
  onBackToResults?: () => void;
};

/**
 * @param rooms — комнаты анкеты
 * @param roomId — id комнаты
 * @returns {string} Отображаемое имя
 */
function resolveRoomLabel(rooms: RoomFormValue[], roomId: string): string {
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return roomId;
  const name = room.name.trim();
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
  hydraulicsReport = null,
  catalogSource = null,
  calcLoading = false,
  onBackToResults,
}: HydraulicsSectionProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const canOpenReport = hasHydraulicsReportContent(hydraulicsReport);

  return (
    <div className={styles.root}>
      <p className={styles.hint}>
        Вкажіть тип розводки, довжину магістралі котел → колектор і підводи колектор →
        радіатор. Δt — для розрахунку витрати радіаторного контуру (може відрізнятися від
        номінального графіка 75/65 або 55/45). Діаметри труб і насос підбираються
        автоматично — повний розрахунок з цінами та ділянками відкривається кнопкою
        «Звіт з гідравліки»; короткий підсумок — у правій колонці.
      </p>

      <fieldset className={styles.wiringFieldset}>
        <legend className={styles.wiringLegend}>Тип розводки системи опалення</legend>
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
                  onChange={() => { onWiringSystemTypeChange(opt.value); }}
                />
                <span className={styles.wiringOptionBody}>
                  <span className={styles.wiringOptionTitleRow}>
                    <span className={styles.wiringOptionTitle}>{opt.label}</span>
                    {opt.recommended ? (
                      <span className={styles.wiringRecommendedBadge}>Рекомендовано</span>
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
        Довжина магістралі котел → колектор, м
        <input
          type="number"
          min={0}
          step={0.5}
          value={value.mainLineLengthM}
          onChange={(e) =>
            { onChange({
              ...value,
              mainLineLengthM: Number(e.target.value) || 0,
            }); }
          }
        />
      </label>

      <label className={styles.field}>
        Δt системи опалення (радіатори), K
        <input
          type="number"
          min={1}
          max={30}
          step={1}
          value={value.deltaTSystemK}
          onChange={(e) =>
            { onChange({
              ...value,
              deltaTSystemK: Number(e.target.value) || 20,
            }); }
          }
        />
      </label>

      <label className={styles.field}>
        Перевага матеріалу труб (опційно)
        <select
          value={value.pipeMaterialPreference}
          onChange={(e) =>
            { onChange({
              ...value,
              pipeMaterialPreference: e.target.value as HydraulicsFormValue['pipeMaterialPreference'],
            }); }
          }
        >
          <option value="">Авто (з каталогу)</option>
          <option value="pex">PEX</option>
          <option value="metal_plastic">Металопластик</option>
          <option value="steel">Сталь</option>
        </select>
      </label>

      {branches.length > 0 ? (
        <div className={styles.branchesBlock}>
          <h4 className={styles.branchesTitle}>
            Підводи колектор → радіатор, м
          </h4>
          {isSequentialWiring(wiringSystemType) ? (
            <p className={styles.branchesHint}>
              Порядок рядків задає послідовність радіаторів на магістралі (від котла
              до дальнього приладу).
            </p>
          ) : null}
          <table className={styles.branchesTable}>
            <thead>
              <tr>
                {isSequentialWiring(wiringSystemType) ? (
                  <th className={styles.colOrder}>Порядок</th>
                ) : null}
                <th>Приміщення</th>
                <th className={styles.colLength}>Довжина, м</th>
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
                          onClick={() => { onBranchReorder(branch.roomId, 'up'); }}
                          aria-label={`Вище: ${resolveRoomLabel(rooms, branch.roomId)}`}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className={styles.orderBtn}
                          disabled={index === branches.length - 1}
                          onClick={() => { onBranchReorder(branch.roomId, 'down'); }}
                          aria-label={`Нижче: ${resolveRoomLabel(rooms, branch.roomId)}`}
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
                        { onBranchLengthChange(
                          branch.roomId,
                          Number(e.target.value) || 0,
                        ); }
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
          Додайте приміщення на кроці «Приміщення», щоб задати довжини підводів до
          радіаторів.
        </p>
      )}

      <div className={reportActionsStyles.reportActions}>
        <div className={reportActionsStyles.reportActionsRow}>
          <button
            type="button"
            className={reportActionsStyles.reportButton}
            disabled={!canOpenReport}
            onClick={() => {
              setReportOpen(true);
            }}
          >
            Звіт з гідравліки
          </button>
          {onBackToResults != null && (
            <button
              type="button"
              className={reportActionsStyles.backButton}
              onClick={onBackToResults}
            >
              Назад до результатів
            </button>
          )}
        </div>
        {calcLoading && (
          <p className={styles.hint} style={{ marginTop: 8 }} role="status">
            Оновлення розрахунку…
          </p>
        )}
        {!canOpenReport && !calcLoading && (
          <p className={styles.hint} style={{ marginTop: 8 }}>
            Звіт з&apos;явиться після авторозрахунку. Заповніть приміщення та огородження,
            задайте довжини розводки.
          </p>
        )}
      </div>

      <HydraulicsReportDialog
        open={reportOpen}
        onClose={() => {
          setReportOpen(false);
        }}
        hydraulics={hydraulicsReport}
        catalogSource={catalogSource}
      />
    </div>
  );
}
