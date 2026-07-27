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
      const {
        insulationPresetId: _insulationPresetId,
        insulationThicknessMm: _insulationThicknessMm,
        ...wallsWithoutInsulation
      } = value.externalWalls;
      void _insulationPresetId;
      void _insulationThicknessMm;
      onChange({
        ...value,
        externalWalls: { ...wallsWithoutInsulation, facadeSystem: 'none' },
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
    const defaultVentilatedInsulationId = ventilatedInsulationPresets[0]?.id;
    const ventilatedInsulationPresetId =
      value.externalWalls.insulationPresetId
      && ventilatedInsulationPresets.some(
        (p) => p.id === value.externalWalls.insulationPresetId,
      )
        ? value.externalWalls.insulationPresetId
        : defaultVentilatedInsulationId;
    patchExternalWalls({
      facadeSystem: 'ventilated',
      insulationThicknessMm: value.externalWalls.insulationThicknessMm ?? 100,
      ...(ventilatedInsulationPresetId !== undefined
        ? { insulationPresetId: ventilatedInsulationPresetId }
        : {}),
    });
  };

  return (
    <div className={styles.formGrid}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="objectType">
          Тип об&apos;єкта
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
                ...(value.ventilationReserveMode !== undefined
                  ? { ventilationReserveMode: value.ventilationReserveMode }
                  : {}),
                ...(value.roofPresetId !== undefined
                  ? { roofPresetId: value.roofPresetId }
                  : {}),
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
          <option value="house">Будинок</option>
          <option value="apartment">Квартира</option>
        </select>
      </div>

      {value.objectType === 'apartment' && (
        <div className={`${styles.field} ${styles.fullWidth}`}>
          <label className={styles.label} htmlFor="apartmentStackPosition">
            Поверх квартири в будинку
          </label>
          <select
            id="apartmentStackPosition"
            className={styles.control}
            value={value.apartmentStackPosition ?? 'middle_floor'}
            onChange={(e) =>
              { onChange({
                ...value,
                apartmentStackPosition: e.target.value as ApartmentStackPosition,
              }); }
            }
          >
            <option value="first_floor">Перший (знизу підвал / холод)</option>
            <option value="middle_floor">Середній (між сусідами)</option>
            <option value="last_floor">Останній (зверху горище / покрівля)</option>
          </select>
          <p className={styles.hint}>
            Задає нижню та верхню межі приміщень: підлога та стеля в тепловтратах враховуються
            лише там, де за межею холодна зона.
          </p>
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="floors">
          Поверховість об&apos;єкта
        </label>
        <select
          id="floors"
          className={styles.control}
          value={value.floors}
          onChange={(e) =>
            { onChange({
              ...value,
              floors: (toIntOrUndefined(e.target.value) ?? 1) as 1 | 2 | 3,
            }); }
          }
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="roomsCount">
          Кількість приміщень ({ROOMS_COUNT_MIN}…{ROOMS_COUNT_MAX})
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
            { onChange({
              ...value,
              roomsCount: clampRoomsCount(Number(e.target.value)),
            }); }
          }
        />
      </div>

      <div className={`${styles.field} ${styles.fullWidth}`}>
        <label className={styles.label} htmlFor="ventilationReserveMode">
          Вентиляція та провітрювання
        </label>
        <select
          id="ventilationReserveMode"
          className={styles.control}
          value={value.ventilationReserveMode ?? 'natural'}
          onChange={(e) =>
            { onChange({
              ...value,
              ventilationReserveMode: e.target.value as VentilationReserveMode,
            }); }
          }
        >
          <option value="natural">
            Природна вентиляція / ручне провітрювання (kVent 1,3)
          </option>
          <option value="recuperation">
            Припливно-витяжна з рекуператором (kVent 1,1)
          </option>
        </select>
        <div className={styles.hint}>
          Запас до тепловтрат через огороження по кожному приміщенню; враховується при підборі котла
          та радіаторів.
        </div>
      </div>

      {value.objectType === 'house' && (
        <>
          <div className={`${styles.field} ${styles.fullWidth}`}>
            <label className={styles.label} htmlFor="boilerPlacementZone">
              Заплановане встановлення котла
            </label>
            <select
              id="boilerPlacementZone"
              className={styles.control}
              value={value.boilerPlacementZone ?? 'kitchen'}
              onChange={(e) =>
                { onChange({
                  ...value,
                  boilerPlacementZone: e.target.value as BoilerPlacementZone,
                }); }
              }
            >
              <option value="kitchen">Кухня (настінний)</option>
              <option value="living_zone">Житлова зона (настінний)</option>
              <option value="boiler_room">Окрема котельня / топочна</option>
            </select>
            <div className={styles.hint}>
              Напольні котли підбираються лише при виборі котельні та об&apos;ємі не менше 7,5 м³
              (приміщення «Котельня» в списку приміщень або площа й висота нижче).
            </div>
          </div>

          {value.boilerPlacementZone === 'boiler_room' && (
            <>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="boilerRoomAreaM2">
                  Площа котельні, м²
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
                    if (v !== undefined) {
                      onChange({ ...value, boilerRoomAreaM2: v });
                      return;
                    }
                    const { boilerRoomAreaM2: _omit, ...rest } = value;
                    void _omit;
                    onChange(rest);
                  }}
                  placeholder="наприклад, 3.5"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="ceilingHeightM">
                  Висота стелі котельні, м
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
                    if (v !== undefined) {
                      onChange({ ...value, ceilingHeightM: v });
                      return;
                    }
                    const { ceilingHeightM: _omit, ...rest } = value;
                    void _omit;
                    onChange(rest);
                  }}
                  placeholder="не менше 2,2"
                />
              </div>
            </>
          )}
        </>
      )}

      <div className={`${styles.field} ${styles.fullWidth}`}>
        <label className={styles.label} htmlFor="wallPresetId">
          Несуча стіна (без утеплювача)
        </label>
        <select
          id="wallPresetId"
          className={styles.control}
          value={wallPresets.length === 0 ? '' : value.externalWalls.presetId}
          onChange={(e) => { patchExternalWalls({ presetId: e.target.value }); }}
          disabled={loadingPresets || wallPresets.length === 0}
        >
          {loadingPresets ? (
            <option value="">Завантаження…</option>
          ) : wallPresets.length === 0 ? (
            <option value="">Немає пресетів для стін</option>
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
            Пресети несучого шару — з довідника API (`/api/v1/presets/envelope`, kind=wall).
          </div>
        )}
      </div>

      <div className={`${styles.field} ${styles.fullWidth}`}>
        <label className={styles.label} htmlFor="wallThicknessMm">
          Товщина несучої стіни, мм
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
            if (next !== undefined) {
              patchExternalWalls({ thicknessMm: next });
              return;
            }
            const { thicknessMm: _omit, ...wallsWithout } = value.externalWalls;
            void _omit;
            onChange({ ...value, externalWalls: wallsWithout });
          }}
          placeholder={
            thicknessOptions && thicknessOptions.length > 0
              ? `наприклад, ${thicknessOptions[0]}`
              : 'наприклад, 300'
          }
        />
        {thicknessOptions && thicknessOptions.length > 0 && (
          <div className={styles.hint}>
            Типові товщини: {thicknessOptions.join(', ')} мм.
          </div>
        )}
      </div>

      <div className={`${styles.field} ${styles.fullWidth}`}>
        <label className={styles.label} htmlFor="facadeSystem">
          Утеплення фасаду
        </label>
        <select
          id="facadeSystem"
          className={styles.control}
          value={facadeSystem}
          onChange={(e) => { onFacadeSystemChange(e.target.value as FacadeSystem); }}
        >
          <option value="none">Без утеплювача</option>
          <option value="sftk">СФТК (мокрий фасад) — ППС 16Ф</option>
          <option value="ventilated">Відкритий / вентильований фасад — мінвата</option>
        </select>
        <div className={styles.hint}>
          Пінополістирол допустимий лише в СФТК (шар захищений штукатуркою). У відкритому вигляді — лише
          мінеральна вата (СП 50.13330).
        </div>
      </div>

      {facadeSystem !== 'none' && (
        <>
          <div className={`${styles.field} ${styles.fullWidth}`}>
            <label className={styles.label} htmlFor="insulationPresetId">
              {facadeSystem === 'sftk' ? 'Утеплювач СФТК' : 'Мінеральна вата'}
            </label>
            <select
              id="insulationPresetId"
              className={styles.control}
              value={
                activeInsulationPresets.length === 0
                  ? ''
                  : (value.externalWalls.insulationPresetId ?? '')
              }
              onChange={(e) => { patchExternalWalls({ insulationPresetId: e.target.value }); }}
              disabled={loadingPresets || activeInsulationPresets.length === 0}
            >
              {activeInsulationPresets.length === 0 ? (
                <option value="">Немає пресетів утеплювача</option>
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
              Товщина утеплювача, мм
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
                if (next !== undefined) {
                  patchExternalWalls({ insulationThicknessMm: next });
                  return;
                }
                const { insulationThicknessMm: _omit, ...wallsWithout } = value.externalWalls;
                void _omit;
                onChange({ ...value, externalWalls: wallsWithout });
              }}
              placeholder={
                insulationThicknessOptions && insulationThicknessOptions.length > 0
                  ? `наприклад, ${insulationThicknessOptions[0]}`
                  : 'наприклад, 100'
              }
            />
            {insulationThicknessOptions && insulationThicknessOptions.length > 0 && (
              <div className={styles.hint}>
                Типові товщини: {insulationThicknessOptions.join(', ')} мм.
              </div>
            )}
          </div>
        </>
      )}

      <div className={`${styles.field} ${styles.fullWidth}`}>
        <label className={styles.label} htmlFor="roofPresetId">
          Покрівля за замовчуванням (пресет)
        </label>
        <select
          id="roofPresetId"
          className={styles.control}
          value={roofPresets.length === 0 ? '' : (value.roofPresetId ?? '')}
          onChange={(e) => { onChange({ ...value, roofPresetId: e.target.value }); }}
          disabled={loadingPresets || roofPresets.length === 0}
        >
          {loadingPresets ? (
            <option value="">Завантаження…</option>
          ) : roofPresets.length === 0 ? (
            <option value="">Немає пресетів для покрівлі</option>
          ) : (
            <>
              <option value="">Не враховувати покрівлю</option>
              {roofPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {envelopePresetLabel(p)}
                </option>
              ))}
            </>
          )}
        </select>
        <div className={styles.hint}>
          Використовується як значення за замовчуванням для кімнат з верхньою межею «Покрівля (мансарда)»,
          якщо в кімнаті не обрано свій пресет.
        </div>
      </div>

      <div className={`${styles.field} ${styles.fullWidth}`}>
        <div className={styles.hint}>
          U зовнішньої стіни: несучий шар + утеплювач (якщо обрано) по шарах; β за орієнтацією — у
          розрахунку приміщень.
        </div>
      </div>
    </div>
  );
}
