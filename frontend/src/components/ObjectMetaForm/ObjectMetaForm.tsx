/**
 * Назначение: Форма шага «Объект» анкеты.
 * Описание: Тип здания, этажность, наружные стены, фасад, вентиляция, размещение котла и котельная.
 */

import styles from './ObjectMetaForm.module.css';

import {
  DEFAULT_SFTK_INSULATION_PRESET_ID,
} from '../../data/fallbackEnvelopePresets';
import { ROOMS_COUNT_MAX, ROOMS_COUNT_MIN } from '../../types/envelope';
import type {
  BoilerPlacementZone,
  EnvelopePreset,
  FacadeSystem,
  ObjectMetaValue,
  ApartmentStackPosition,
  ObjectType,
  VentilationReserveMode,
} from '../../types/envelope';
import { envelopePresetLabel } from '../../utils/presetLabel';

type Props = {
  value: ObjectMetaValue;
  wallPresets: EnvelopePreset[];
  sftkInsulationPresets: EnvelopePreset[];
  ventilatedInsulationPresets: EnvelopePreset[];
  roofPresets: EnvelopePreset[];
  loadingPresets: boolean;
  presetsError: string | null;
  /** Показать галочку места под БКН (большая квартира). */
  showIndirectDhwSpaceOption?: boolean;
  onChange: (next: ObjectMetaValue) => void;
};

function toIntOrUndefined(x: string): number | undefined {
  const n = Number(x);
  if (!Number.isFinite(n)) return undefined;
  return Math.trunc(n);
}

function clampRoomsCount(n: number): number {
  const t = Number.isFinite(n) ? Math.trunc(n) : ROOMS_COUNT_MIN;
  return Math.max(ROOMS_COUNT_MIN, Math.min(ROOMS_COUNT_MAX, t));
}

export function ObjectMetaForm({
  value,
  wallPresets,
  sftkInsulationPresets,
  ventilatedInsulationPresets,
  roofPresets,
  loadingPresets,
  presetsError,
  showIndirectDhwSpaceOption = false,
  onChange,
}: Props) {
  const selectedWallPreset =
    wallPresets.find((p) => p.id === value.externalWalls.presetId) ?? null;
  const thicknessOptions = selectedWallPreset?.thicknessOptionsMm ?? null;
  const facadeSystem: FacadeSystem = value.externalWalls.facadeSystem ?? 'none';

  const activeInsulationPresets =
    facadeSystem === 'sftk'
      ? sftkInsulationPresets
      : facadeSystem === 'ventilated'
        ? ventilatedInsulationPresets
        : [];

  const selectedInsulationPreset =
    activeInsulationPresets.find((p) => p.id === value.externalWalls.insulationPresetId) ??
    null;
  const insulationThicknessOptions = selectedInsulationPreset?.thicknessOptionsMm ?? null;

  const patchExternalWalls = (patch: Partial<ObjectMetaValue['externalWalls']>) => {
    onChange({
      ...value,
      externalWalls: { ...value.externalWalls, ...patch },
    });
  };

  const onFacadeSystemChange = (next: FacadeSystem) => {
    if (next === 'none') {
      patchExternalWalls({
        facadeSystem: 'none',
        insulationPresetId: undefined,
        insulationThicknessMm: undefined,
      });
      return;
    }
    if (next === 'sftk') {
      patchExternalWalls({
        facadeSystem: 'sftk',
        insulationPresetId:
          sftkInsulationPresets[0]?.id ?? DEFAULT_SFTK_INSULATION_PRESET_ID,
        insulationThicknessMm: value.externalWalls.insulationThicknessMm ?? 100,
      });
      return;
    }
    patchExternalWalls({
      facadeSystem: 'ventilated',
      insulationPresetId:
        value.externalWalls.insulationPresetId &&
        ventilatedInsulationPresets.some(
          (p) => p.id === value.externalWalls.insulationPresetId,
        )
          ? value.externalWalls.insulationPresetId
          : (ventilatedInsulationPresets[0]?.id ?? undefined),
      insulationThicknessMm: value.externalWalls.insulationThicknessMm ?? 100,
    });
  };

  return (
    <div className={styles.formGrid}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="objectType">
          Тип объекта
        </label>
        <select
          id="objectType"
          className={styles.control}
          value={value.objectType}
          onChange={(e) => {
            const objectType = e.target.value as ObjectType;
            if (objectType === 'apartment') {
              onChange({
                objectType,
                apartmentStackPosition: value.apartmentStackPosition ?? 'middle_floor',
                floors: value.floors,
                roomsCount: value.roomsCount,
                externalWalls: value.externalWalls,
                roofPresetId: value.roofPresetId,
                ventilationReserveMode: value.ventilationReserveMode,
              });
              return;
            }
            onChange({
              ...value,
              objectType,
              boilerPlacementZone: value.boilerPlacementZone ?? 'kitchen',
            });
          }}
        >
          <option value="house">Дом</option>
          <option value="apartment">Квартира</option>
        </select>
      </div>

      {value.objectType === 'apartment' && (
        <div className={`${styles.field} ${styles.fullWidth}`}>
          <label className={styles.label} htmlFor="apartmentStackPosition">
            Этаж квартиры в доме
          </label>
          <select
            id="apartmentStackPosition"
            className={styles.control}
            value={value.apartmentStackPosition ?? 'middle_floor'}
            onChange={(e) =>
              onChange({
                ...value,
                apartmentStackPosition: e.target.value as ApartmentStackPosition,
              })
            }
          >
            <option value="first_floor">Первый (снизу подвал / холод)</option>
            <option value="middle_floor">Средний (между соседями)</option>
            <option value="last_floor">Последний (сверху чердак / кровля)</option>
          </select>
          <p className={styles.hint}>
            Задаёт нижнюю и верхнюю границы помещений: пол и потолок в теплопотерях считаются
            только там, где за границей холодная зона.
          </p>
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="floors">
          Этажность объекта
        </label>
        <select
          id="floors"
          className={styles.control}
          value={value.floors}
          onChange={(e) =>
            onChange({
              ...value,
              floors: (toIntOrUndefined(e.target.value) ?? 1) as 1 | 2 | 3,
            })
          }
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="roomsCount">
          Количество помещений ({ROOMS_COUNT_MIN}…{ROOMS_COUNT_MAX})
        </label>
        <input
          id="roomsCount"
          className={styles.control}
          type="number"
          min={ROOMS_COUNT_MIN}
          max={ROOMS_COUNT_MAX}
          step={1}
          value={value.roomsCount}
          onChange={(e) =>
            onChange({
              ...value,
              roomsCount: clampRoomsCount(Number(e.target.value)),
            })
          }
        />
      </div>

      <div className={`${styles.field} ${styles.fullWidth}`}>
        <label className={styles.label} htmlFor="ventilationReserveMode">
          Вентиляция и проветривание
        </label>
        <select
          id="ventilationReserveMode"
          className={styles.control}
          value={value.ventilationReserveMode ?? 'natural'}
          onChange={(e) =>
            onChange({
              ...value,
              ventilationReserveMode: e.target.value as VentilationReserveMode,
            })
          }
        >
          <option value="natural">
            Естественная вентиляция / ручное проветривание (kVent 1,3)
          </option>
          <option value="recuperation">
            Приточно-вытяжная с рекуператором (kVent 1,1)
          </option>
        </select>
        <div className={styles.hint}>
          Запас к теплопотерям через ограждения по каждому помещению; учитывается при подборе котла
          и радиаторов.
        </div>
      </div>

      {value.objectType === 'house' && (
        <>
          <div className={`${styles.field} ${styles.fullWidth}`}>
            <label className={styles.label} htmlFor="boilerPlacementZone">
              Планируемая установка котла
            </label>
            <select
              id="boilerPlacementZone"
              className={styles.control}
              value={value.boilerPlacementZone ?? 'kitchen'}
              onChange={(e) =>
                onChange({
                  ...value,
                  boilerPlacementZone: e.target.value as BoilerPlacementZone,
                })
              }
            >
              <option value="kitchen">Кухня (настенный)</option>
              <option value="living_zone">Жилая зона (настенный)</option>
              <option value="boiler_room">Выделенная котельная / топочная</option>
            </select>
            <div className={styles.hint}>
              Напольные котлы подбираются только при выборе котельной и объёме не менее 7,5 м³
              (комната «Котельная» в списке помещений или площадь и высота ниже).
            </div>
          </div>

          {value.boilerPlacementZone === 'boiler_room' && (
            <>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="boilerRoomAreaM2">
                  Площадь котельной, м²
                </label>
                <input
                  id="boilerRoomAreaM2"
                  className={styles.control}
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={value.boilerRoomAreaM2 ?? ''}
                  onChange={(e) => {
                    const v = e.target.value === '' ? undefined : Number(e.target.value);
                    onChange({ ...value, boilerRoomAreaM2: v });
                  }}
                  placeholder="например, 3.5"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="ceilingHeightM">
                  Высота потолка котельной, м
                </label>
                <input
                  id="ceilingHeightM"
                  className={styles.control}
                  type="number"
                  min={2.2}
                  max={6}
                  step={0.1}
                  value={value.ceilingHeightM ?? ''}
                  onChange={(e) => {
                    const v = e.target.value === '' ? undefined : Number(e.target.value);
                    onChange({ ...value, ceilingHeightM: v });
                  }}
                  placeholder="не менее 2,2"
                />
              </div>
            </>
          )}
        </>
      )}

      {value.objectType === 'apartment' && showIndirectDhwSpaceOption && (
        <div className={`${styles.field} ${styles.fullWidth}`}>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={value.indirectDhwSpaceAvailable === true}
              onChange={(e) =>
                onChange({
                  ...value,
                  indirectDhwSpaceAvailable: e.target.checked,
                })
              }
            />
            <span>
              Есть техпомещение или ниша под бойлер косвенного нагрева (БКН)
            </span>
          </label>
          <div className={styles.hint}>
            Для больших квартир доступна схема «1К + БКН» при наличии места под
            накопительный бойлер.
          </div>
        </div>
      )}

      <div className={`${styles.field} ${styles.fullWidth}`}>
        <label className={styles.label} htmlFor="wallPresetId">
          Несущая стена (без утеплителя)
        </label>
        <select
          id="wallPresetId"
          className={styles.control}
          value={wallPresets.length === 0 ? '' : value.externalWalls.presetId}
          onChange={(e) => patchExternalWalls({ presetId: e.target.value })}
          disabled={loadingPresets || wallPresets.length === 0}
        >
          {loadingPresets ? (
            <option value="">Загрузка…</option>
          ) : wallPresets.length === 0 ? (
            <option value="">Нет пресетов для стен</option>
          ) : (
            wallPresets.map((p) => (
              <option key={p.id} value={p.id}>
                {envelopePresetLabel(p)}
              </option>
            ))
          )}
        </select>
        {presetsError ? (
          <div className={styles.hint}>{presetsError}</div>
        ) : (
          <div className={styles.hint}>
            Пресеты несущего слоя — из справочника API (`/api/v1/presets/envelope`, kind=wall).
          </div>
        )}
      </div>

      <div className={`${styles.field} ${styles.fullWidth}`}>
        <label className={styles.label} htmlFor="wallThicknessMm">
          Толщина несущей стены, мм
        </label>
        <input
          id="wallThicknessMm"
          className={styles.control}
          type="number"
          inputMode="numeric"
          min={50}
          max={2000}
          step={10}
          value={value.externalWalls.thicknessMm ?? ''}
          onChange={(e) => {
            const next = e.target.value === '' ? undefined : Number(e.target.value);
            patchExternalWalls({ thicknessMm: next });
          }}
          placeholder={
            thicknessOptions && thicknessOptions.length > 0
              ? `например, ${thicknessOptions[0]}`
              : 'например, 300'
          }
        />
        {thicknessOptions && thicknessOptions.length > 0 && (
          <div className={styles.hint}>
            Типовые толщины: {thicknessOptions.join(', ')} мм.
          </div>
        )}
      </div>

      <div className={`${styles.field} ${styles.fullWidth}`}>
        <label className={styles.label} htmlFor="facadeSystem">
          Утепление фасада
        </label>
        <select
          id="facadeSystem"
          className={styles.control}
          value={facadeSystem}
          onChange={(e) => onFacadeSystemChange(e.target.value as FacadeSystem)}
        >
          <option value="none">Без утеплителя</option>
          <option value="sftk">СФТК (мокрый фасад) — ППС 16Ф</option>
          <option value="ventilated">Открытый / вентилируемый фасад — минвата</option>
        </select>
        <div className={styles.hint}>
          Пенополистирол допустим только в СФТК (слой защищён штукатуркой). В открытом виде — только
          минеральная вата (СП 50.13330).
        </div>
      </div>

      {facadeSystem !== 'none' && (
        <>
          <div className={`${styles.field} ${styles.fullWidth}`}>
            <label className={styles.label} htmlFor="insulationPresetId">
              {facadeSystem === 'sftk' ? 'Утеплитель СФТК' : 'Минеральная вата'}
            </label>
            <select
              id="insulationPresetId"
              className={styles.control}
              value={
                activeInsulationPresets.length === 0
                  ? ''
                  : (value.externalWalls.insulationPresetId ?? '')
              }
              onChange={(e) => patchExternalWalls({ insulationPresetId: e.target.value })}
              disabled={loadingPresets || activeInsulationPresets.length === 0}
            >
              {activeInsulationPresets.length === 0 ? (
                <option value="">Нет пресетов утеплителя</option>
              ) : (
                activeInsulationPresets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {envelopePresetLabel(p)}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className={`${styles.field} ${styles.fullWidth}`}>
            <label className={styles.label} htmlFor="insulationThicknessMm">
              Толщина утеплителя, мм
            </label>
            <input
              id="insulationThicknessMm"
              className={styles.control}
              type="number"
              inputMode="numeric"
              min={30}
              max={300}
              step={10}
              value={value.externalWalls.insulationThicknessMm ?? ''}
              onChange={(e) => {
                const next = e.target.value === '' ? undefined : Number(e.target.value);
                patchExternalWalls({ insulationThicknessMm: next });
              }}
              placeholder={
                insulationThicknessOptions && insulationThicknessOptions.length > 0
                  ? `например, ${insulationThicknessOptions[0]}`
                  : 'например, 100'
              }
            />
            {insulationThicknessOptions && insulationThicknessOptions.length > 0 && (
              <div className={styles.hint}>
                Типовые толщины: {insulationThicknessOptions.join(', ')} мм.
              </div>
            )}
          </div>
        </>
      )}

      <div className={`${styles.field} ${styles.fullWidth}`}>
        <label className={styles.label} htmlFor="roofPresetId">
          Кровля по умолчанию (пресет)
        </label>
        <select
          id="roofPresetId"
          className={styles.control}
          value={roofPresets.length === 0 ? '' : (value.roofPresetId ?? '')}
          onChange={(e) => onChange({ ...value, roofPresetId: e.target.value })}
          disabled={loadingPresets || roofPresets.length === 0}
        >
          {loadingPresets ? (
            <option value="">Загрузка…</option>
          ) : roofPresets.length === 0 ? (
            <option value="">Нет пресетов для кровли</option>
          ) : (
            <>
              <option value="">Не учитывать кровлю</option>
              {roofPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {envelopePresetLabel(p)}
                </option>
              ))}
            </>
          )}
        </select>
        <div className={styles.hint}>
          Используется как значение по умолчанию для комнат с верхней границей «Кровля (мансарда)»,
          если в комнате не выбран свой пресет.
        </div>
      </div>

      <div className={`${styles.field} ${styles.fullWidth}`}>
        <div className={styles.hint}>
          U наружной стены: несущий слой + утеплитель (если выбран) по слоям; β по ориентации — в
          расчёте помещений.
        </div>
      </div>
    </div>
  );
}
