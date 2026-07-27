/**
 * Назначение: Карточка-аккордеон одного помещения.
 * Описание: Площадь, высота, этаж, окна, наружные стены, границы и ограждающие конструкции.
 */

import type { Dispatch, SetStateAction } from 'react';
import {
  ROOM_TYPE_UI_OPTIONS,
  isCanonicalRoomType,
  parseCanonicalRoomTypeFromSelect,
} from '../../constants/roomTypes';
import type { EnvelopePreset, ObjectType } from '../../types/envelope';
import type {
  ExternalWallFormValue,
  RoomExteriorLayout,
  RoomFormValue,
  BottomBoundaryType,
  TopBoundaryType,
  UfhTerminalControl,
  WindowFormValue,
  WindowOrientation,
} from '../../types/rooms';
import { UFH_TERMINAL_CONTROL_MAX_AREA_SQM } from '../../types/rooms';
import type {
  FlooringFinishMaterial,
  UnderfloorHeatingBasePreset,
  UfhPipeSpacingMm,
} from '../../types/underfloorHeating';
import {
  DEFAULT_UFH_PIPE_SPACING_MM,
  UFH_PIPE_SPACING_OPTIONS,
} from '../../types/underfloorHeating';
import { DEFAULT_FLOORING_FINISH_ID } from '../../data/fallbackFlooringFinishes';
import { DEFAULT_WINDOW_PRESET_ID } from '../../data/fallbackEnvelopePresets';
import { DEFAULT_UNDERFLOOR_HEATING_BASE_ID } from '../../data/fallbackUnderfloorHeatingPresets';
import { envelopePresetLabel } from '../../utils/presetLabel';
import { flooringFinishLabel, underfloorBasePresetLabel } from '../../utils/underfloorPresetLabel';
import { ORIENTATION_OPTIONS } from '../../utils/roomEnvelopeFields';
import {
  defaultLayoutForRoomType,
  exteriorWallsSectionHint,
  externalWallFieldConfigs,
  inferRoomExteriorLayout,
  patchRoomForLayoutChange,
} from '../../utils/roomExteriorLayout';
import { createDefaultWindowFormValue } from '../../utils/roomWindowDefaults';
import styles from './RoomAccordionItem.module.css';

type RoomAccordionItemProps = {
  room: RoomFormValue;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  maxFloors: 1 | 2 | 3;
  /** Наружные стены объекта (несущий слой + утеплитель) — задаются на шаге «Объект». */
  objectExternalWallsSummary: string;
  windowPresets: EnvelopePreset[];
  floorPresets: EnvelopePreset[];
  ceilingPresets: EnvelopePreset[];
  roofPresets: EnvelopePreset[];
  /** Глобальный флаг водяного ТП из шага «Тёплый пол». */
  waterUnderfloorHeating?: boolean;
  underfloorHeatingBases?: UnderfloorHeatingBasePreset[];
  flooringFinishes?: FlooringFinishMaterial[];
  underfloorPresetsLoading?: boolean;
  /** Квартира: границы задаются на шаге «Объект» (этаж в доме). */
  isApartment?: boolean;
  objectType: ObjectType;
  onChange: Dispatch<SetStateAction<RoomFormValue[]>>;
};

function toNumberOrEmpty(raw: string): number | '' {
  if (raw.trim() === '') return '';
  const n = Number(raw);
  if (!Number.isFinite(n)) return '';
  return n;
}

function nextWindowId(roomId: string, windows: WindowFormValue[]): string {
  const existing = new Set(windows.map((w) => w.id));
  let n = 1;
  let candidate = `win-${roomId}-${n}`;
  while (existing.has(candidate)) {
    n += 1;
    candidate = `win-${roomId}-${n}`;
  }
  return candidate;
}

export function RoomAccordionItem({
  room,
  index,
  isOpen,
  onToggle,
  maxFloors,
  objectExternalWallsSummary,
  windowPresets,
  floorPresets,
  ceilingPresets,
  roofPresets,
  waterUnderfloorHeating = false,
  underfloorHeatingBases = [],
  flooringFinishes = [],
  underfloorPresetsLoading = false,
  isApartment = false,
  objectType,
  onChange,
}: RoomAccordionItemProps) {
  const btnId = `room-acc-btn-${room.id}`;
  const panelId = `room-acc-panel-${room.id}`;
  const roomLayout = inferRoomExteriorLayout(room);
  const wallFieldConfigs = externalWallFieldConfigs(roomLayout, objectType);

  const updateRoom = (patch: Partial<RoomFormValue>) => {
    onChange((prev) =>
      prev.map((r) => (r.id === room.id ? { ...r, ...patch } : r)),
    );
  };

  const defaultBaseId =
    underfloorHeatingBases.find((p) => p.id === DEFAULT_UNDERFLOOR_HEATING_BASE_ID)?.id ??
    underfloorHeatingBases[0]?.id ??
    DEFAULT_UNDERFLOOR_HEATING_BASE_ID;

  const defaultFinishId =
    flooringFinishes.find((m) => m.id === DEFAULT_FLOORING_FINISH_ID)?.id ??
    flooringFinishes[0]?.id ??
    DEFAULT_FLOORING_FINISH_ID;

  const ufhEnabled = room.underfloorHeating?.enabled === true;
  const resolvedBaseId = underfloorHeatingBases.some(
    (p) => p.id === room.underfloorHeating?.basePresetId,
  )
    ? (room.underfloorHeating?.basePresetId ?? defaultBaseId)
    : defaultBaseId;

  const resolvedFinishId = flooringFinishes.some(
    (m) => m.id === room.underfloorHeating?.finishMaterialId,
  )
    ? (room.underfloorHeating?.finishMaterialId ?? defaultFinishId)
    : defaultFinishId;

  const resolvedPipeSpacing: UfhPipeSpacingMm =
    room.underfloorHeating?.pipeSpacingMm === 100
    || room.underfloorHeating?.pipeSpacingMm === 150
    || room.underfloorHeating?.pipeSpacingMm === 200
      ? room.underfloorHeating.pipeSpacingMm
      : DEFAULT_UFH_PIPE_SPACING_MM;

  const resolvedFurnitureArea = room.underfloorHeating?.furnitureOccupiedAreaM2 ?? '';
  const roomAreaNum = typeof room.areaM2 === 'number' ? room.areaM2 : Number(room.areaM2);
  const showUfhTerminalControl =
    Number.isFinite(roomAreaNum)
    && roomAreaNum > 0
    && roomAreaNum <= UFH_TERMINAL_CONTROL_MAX_AREA_SQM;
  const resolvedTerminalControl: UfhTerminalControl =
    showUfhTerminalControl && room.underfloorHeating?.ufhTerminalControl === 'unibox'
      ? 'unibox'
      : 'collector';

  const setUnderfloorEnabled = (enabled: boolean) => {
    if (!enabled) {
      updateRoom({
        underfloorHeating: {
          enabled: false,
          basePresetId: resolvedBaseId,
          finishMaterialId: resolvedFinishId,
          pipeSpacingMm: resolvedPipeSpacing,
          furnitureOccupiedAreaM2: resolvedFurnitureArea,
          ...(resolvedTerminalControl === 'unibox'
            ? { ufhTerminalControl: 'unibox' as const }
            : {}),
        },
      });
      return;
    }
    updateRoom({
      underfloorHeating: {
        enabled: true,
        basePresetId: resolvedBaseId || defaultBaseId,
        finishMaterialId: resolvedFinishId || defaultFinishId,
        pipeSpacingMm: resolvedPipeSpacing,
        furnitureOccupiedAreaM2: resolvedFurnitureArea,
        ...(resolvedTerminalControl === 'unibox'
          ? { ufhTerminalControl: 'unibox' as const }
          : {}),
      },
    });
  };

  const patchUnderfloor = (patch: {
    basePresetId?: string;
    finishMaterialId?: string;
    pipeSpacingMm?: UfhPipeSpacingMm;
    furnitureOccupiedAreaM2?: number | '';
    ufhTerminalControl?: UfhTerminalControl;
  }) => {
    const nextTerminal =
      patch.ufhTerminalControl !== undefined
        ? patch.ufhTerminalControl
        : resolvedTerminalControl;
    updateRoom({
      underfloorHeating: {
        enabled: true,
        basePresetId: patch.basePresetId ?? resolvedBaseId,
        finishMaterialId: patch.finishMaterialId ?? resolvedFinishId,
        pipeSpacingMm: patch.pipeSpacingMm ?? resolvedPipeSpacing,
        furnitureOccupiedAreaM2:
          patch.furnitureOccupiedAreaM2 !== undefined
            ? patch.furnitureOccupiedAreaM2
            : resolvedFurnitureArea,
        ...(nextTerminal === 'unibox' ? { ufhTerminalControl: 'unibox' as const } : {}),
      },
    });
  };

  const updateWindowAt = (index: number, patch: Partial<WindowFormValue>) => {
    onChange((prev) =>
      prev.map((r) =>
        r.id === room.id
          ? {
              ...r,
              windows: r.windows.map((w, i) =>
                i === index ? { ...w, ...patch } : w,
              ),
            }
          : r,
      ),
    );
  };

  const removeWindowAt = (index: number) => {
    onChange((prev) =>
      prev.map((r) =>
        r.id === room.id
          ? { ...r, windows: r.windows.filter((_, i) => i !== index) }
          : r,
      ),
    );
  };

  const updateExternalWall = (
    slot: 'externalWall1' | 'externalWall2',
    patch: Partial<ExternalWallFormValue>,
  ) => {
    onChange((prev) =>
      prev.map((r) =>
        r.id === room.id ? { ...r, [slot]: { ...r[slot], ...patch } } : r,
      ),
    );
  };

  const addWindow = () => {
    onChange((prev) =>
      prev.map((r) => {
        if (r.id !== room.id) return r;
        const wins = r.windows;
        const defaultPresetId =
          windowPresets.find((p) => p.id === DEFAULT_WINDOW_PRESET_ID)?.id ??
          windowPresets[0]?.id ??
          DEFAULT_WINDOW_PRESET_ID;
        const next = createDefaultWindowFormValue(r.id, wins.length + 1, defaultPresetId);
        next.id = nextWindowId(r.id, wins);
        return { ...r, windows: [...wins, next] };
      }),
    );
  };

  return (
    <article className={styles.card} aria-label={`Приміщення ${index + 1}`}>
      <button
        id={btnId}
        type="button"
        className={styles.accHeader}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <div className={styles.accHeaderLeft}>
          <div className={styles.cardTitle}>
            Приміщення {index + 1}
            {room.name.trim() ? ` — ${room.name.trim()}` : ''}
          </div>
          <div className={styles.cardMeta}>
            Тип: {room.type} ·{' '}
            {typeof room.areaM2 === 'number' ? `${room.areaM2} м²` : '— м²'} ·{' '}
            {typeof room.heightM === 'number' ? `${room.heightM} м` : '— м'} ·
            ID: {room.id}
          </div>
        </div>
        <div className={styles.accHeaderRight}>
          {isOpen ? 'Згорнути' : 'Відкрити'}
        </div>
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={btnId}
        hidden={!isOpen}
        className={styles.accPanel}
      >
        <div className={styles.formGrid}>
          {/* Название */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`name-${room.id}`}>
              Назва
            </label>
            <input
              id={`name-${room.id}`}
              className={styles.control}
              value={room.name}
              onChange={(e) => { updateRoom({ name: e.target.value }); }}
              placeholder={`Кімната ${index + 1}`}
            />
          </div>

          {/* Тип */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`type-${room.id}`}>
              Тип
            </label>
            <select
              id={`type-${room.id}`}
              className={styles.control}
              value={isCanonicalRoomType(room.type) ? room.type : 'помещение'}
              onChange={(e) => {
                const nextType = parseCanonicalRoomTypeFromSelect(e.target.value);
                if (nextType == null) return;
                const suggestedLayout = defaultLayoutForRoomType(nextType);
                const currentLayout = inferRoomExteriorLayout(room);
                const patch: Partial<RoomFormValue> = { type: nextType };
                if (currentLayout !== suggestedLayout) {
                  Object.assign(
                    patch,
                    patchRoomForLayoutChange(suggestedLayout, room.externalWall2),
                  );
                }
                updateRoom(patch);
              }}
            >
              {ROOM_TYPE_UI_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Этаж */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`floor-${room.id}`}>
              Поверх
            </label>
            <select
              id={`floor-${room.id}`}
              className={styles.control}
              value={room.floor}
              onChange={(e) => { updateRoom({ floor: Number(e.target.value) as 1 | 2 | 3 }); }}
            >
              {([1, 2, 3] as const)
                .filter((f) => f <= maxFloors)
                .map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
            </select>
          </div>

          {/* Границы по вертикали */}
          {isApartment ? (
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <div className={styles.label}>Межі (квартира в будинку)</div>
              <p className={styles.hint}>
                Верх: {room.topBoundaryType === 'heated' ? 'теплий контур' : 'холод / горище'} · Низ:{' '}
                {room.bottomBoundaryType === 'heated' ? 'теплий контур' : 'холод / підвал'}.
                Змінюється на кроці «Об&apos;єкт» — «Поверх квартири в будинку».
              </p>
            </div>
          ) : (
            <>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`bottom-boundary-${room.id}`}>
                  Нижня межа
                </label>
                <select
                  id={`bottom-boundary-${room.id}`}
                  className={styles.control}
                  value={room.bottomBoundaryType}
                  onChange={(e) =>
                    { updateRoom({ bottomBoundaryType: e.target.value as BottomBoundaryType }); }
                  }
                >
                  <option value="heated">Знизу тепле (стать не враховувати)</option>
                  <option value="unheated">Знизу холод / підвал (стать)</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`top-boundary-${room.id}`}>
                  Верхня межа
                </label>
                <select
                  id={`top-boundary-${room.id}`}
                  className={styles.control}
                  value={room.topBoundaryType}
                  onChange={(e) =>
                    { updateRoom({ topBoundaryType: e.target.value as TopBoundaryType }); }
                  }
                >
                  <option value="heated">Зверху тепле приміщення (стелю не враховувати)</option>
                  <option value="unheated">Зверху холодна зона / горище (стеля)</option>
                  <option value="roof">Покрівля (мансарда)</option>
                </select>
              </div>
            </>
          )}

          {/* Площадь */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`area-${room.id}`}>
              Площа, м²
            </label>
            <input
              id={`area-${room.id}`}
              className={styles.control}
              type="number"
              min={0.1}
              step={0.1}
              value={room.areaM2}
              onChange={(e) =>
                { updateRoom({ areaM2: toNumberOrEmpty(e.target.value) }); }
              }
            />
          </div>

          {/* Высота */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`height-${room.id}`}>
              Висота, м
            </label>
            <input
              id={`height-${room.id}`}
              className={styles.control}
              type="number"
              min={1.8}
              step={0.05}
              value={room.heightM}
              onChange={(e) =>
                { updateRoom({ heightM: toNumberOrEmpty(e.target.value) }); }
              }
            />
          </div>

          {/* Положение относительно наружного контура */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`room-layout-${room.id}`}>
              Розташування приміщення
            </label>
            <select
              id={`room-layout-${room.id}`}
              className={styles.control}
              value={roomLayout}
              onChange={(e) => {
                const nextLayout = e.target.value as RoomExteriorLayout;
                updateRoom(patchRoomForLayoutChange(nextLayout, room.externalWall2));
              }}
            >
              <option value="facade">На фасаді (одна зовнішня стіна)</option>
              <option value="corner">Кутове / торцеве (дві зовнішні стіни)</option>
              <option value="internal">
                {objectType === 'apartment'
                  ? 'Внутрішнє (стіна в загальний коридор під\'їзду)'
                  : 'Внутрішнє (стіна в холодний коридор / тамбур)'}
              </option>
            </select>
          </div>

          {/* Наружные стены — тип и утеплитель задаются на шаге «Объект» */}
          <div className={`${styles.field} ${styles.fullWidth}`}>
            <div className={styles.label}>Зовнішні стіни (об&apos;єкт)</div>
            <div className={styles.hint}>{objectExternalWallsSummary}</div>
            <div className={styles.hint}>
              {exteriorWallsSectionHint(roomLayout, objectType)}
            </div>
          </div>

          {waterUnderfloorHeating ? (
            <div className={`${styles.floorUfhRow} ${styles.fullWidth}`}>
              <div
                className={
                  ufhEnabled
                    ? `${styles.field} ${styles.floorFieldWithUfh}`
                    : styles.field
                }
              >
                <label className={styles.label} htmlFor={`floorPresetId-${room.id}`}>
                  Підлога (огородження)
                </label>
                <select
                  id={`floorPresetId-${room.id}`}
                  className={styles.control}
                  value={floorPresets.length === 0 ? '' : room.floorPresetId}
                  onChange={(e) => { updateRoom({ floorPresetId: e.target.value }); }}
                  disabled={floorPresets.length === 0}
                >
                  {floorPresets.length === 0 ? (
                    <option value="">Немає пресетів</option>
                  ) : (
                    floorPresets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {envelopePresetLabel(p)}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className={styles.ufhColumn}>
                <div className={styles.fieldGroupTitle}>Водяна тепла підлога</div>
                <label className={styles.checkboxRow} htmlFor={`ufh-enabled-${room.id}`}>
                  <input
                    id={`ufh-enabled-${room.id}`}
                    type="checkbox"
                    checked={ufhEnabled}
                    onChange={(e) => { setUnderfloorEnabled(e.target.checked); }}
                  />
                  <span>Тепла підлога в цьому приміщенні</span>
                </label>
                {ufhEnabled ? (
                  <div className={styles.ufhFieldsGrid}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor={`ufh-base-${room.id}`}>
                      Основа ТП (перекриття + стяжка)
                    </label>
                    <select
                      id={`ufh-base-${room.id}`}
                      className={styles.control}
                      value={
                        underfloorPresetsLoading || underfloorHeatingBases.length === 0
                          ? ''
                          : resolvedBaseId
                      }
                      onChange={(e) => { patchUnderfloor({ basePresetId: e.target.value }); }}
                      disabled={underfloorPresetsLoading || underfloorHeatingBases.length === 0}
                    >
                      {underfloorPresetsLoading ? (
                        <option value="">Завантаження…</option>
                      ) : underfloorHeatingBases.length === 0 ? (
                        <option value="">Немає баз ТП</option>
                      ) : (
                        underfloorHeatingBases.map((p) => (
                          <option key={p.id} value={p.id}>
                            {underfloorBasePresetLabel(p)}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor={`ufh-finish-${room.id}`}>
                      Фінішне покриття
                    </label>
                    <select
                      id={`ufh-finish-${room.id}`}
                      className={styles.control}
                      value={
                        underfloorPresetsLoading || flooringFinishes.length === 0
                          ? ''
                          : resolvedFinishId
                      }
                      onChange={(e) => { patchUnderfloor({ finishMaterialId: e.target.value }); }}
                      disabled={underfloorPresetsLoading || flooringFinishes.length === 0}
                    >
                      {underfloorPresetsLoading ? (
                        <option value="">Завантаження…</option>
                      ) : flooringFinishes.length === 0 ? (
                        <option value="">Немає покриттів</option>
                      ) : (
                        flooringFinishes.map((m) => (
                          <option key={m.id} value={m.id}>
                            {flooringFinishLabel(m)} (T max {m.maxSurfaceTemperatureCelsius} °C)
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor={`ufh-spacing-${room.id}`}>
                      Бажаний крок укладки, мм
                    </label>
                    <select
                      id={`ufh-spacing-${room.id}`}
                      className={styles.control}
                      value={resolvedPipeSpacing}
                      onChange={(e) =>
                        { patchUnderfloor({
                          pipeSpacingMm: Number(e.target.value) as UfhPipeSpacingMm,
                        }); }
                      }
                    >
                      {UFH_PIPE_SPACING_OPTIONS.map((mm) => (
                        <option key={mm} value={mm}>
                          {mm} мм{mm === 150 ? ' (стандарт)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label
                      className={styles.label}
                      htmlFor={`ufh-furniture-${room.id}`}
                      title="Вкажіть площу великих меблів, під якими не буде укладатися тепла підлога. Це захистить меблі від перегріву та дозволить точніше розрахувати крок труби."
                    >
                      Площа, зайнята меблями (без ніжок / низька посадка), S<sub>meb</sub> (м²)
                    </label>
                    <input
                      id={`ufh-furniture-${room.id}`}
                      className={styles.control}
                      type="number"
                      min={0}
                      step={0.1}
                      value={resolvedFurnitureArea}
                      onChange={(e) =>
                        { patchUnderfloor({
                          furnitureOccupiedAreaM2: toNumberOrEmpty(e.target.value),
                        }); }
                      }
                    />
                  </div>
                  {showUfhTerminalControl && (
                    <div className={`${styles.field} ${styles.fullWidth}`}>
                      <span className={styles.label} id={`ufh-terminal-${room.id}-label`}>
                        Регулювання контуру ТП (площа ≤ {UFH_TERMINAL_CONTROL_MAX_AREA_SQM} м²)
                      </span>
                      <div
                        className={styles.control}
                        role="radiogroup"
                        aria-labelledby={`ufh-terminal-${room.id}-label`}
                      >
                        <label>
                          <input
                            type="radio"
                            name={`ufh-terminal-${room.id}`}
                            checked={resolvedTerminalControl === 'collector'}
                            onChange={() =>
                              { patchUnderfloor({ ufhTerminalControl: 'collector' }); }
                            }
                          />{' '}
                          Колектор теплої підлоги
                        </label>
                        <label>
                          <input
                            type="radio"
                            name={`ufh-terminal-${room.id}`}
                            checked={resolvedTerminalControl === 'unibox'}
                            onChange={() =>
                              { patchUnderfloor({ ufhTerminalControl: 'unibox' }); }
                            }
                          />{' '}
                          Унібокс (локальний регулятор)
                        </label>
                      </div>
                      <div className={styles.hint}>
                        Унібокс — для однієї петлі малої зони; не займає вихід колектора ТП.
                      </div>
                    </div>
                  )}
                  <div className={`${styles.hint} ${styles.fullWidth}`}>
                    Вкажіть площу великих меблів, під якими не буде укладатися тепла підлога.
                    Це захистить меблі від перегріву та дозволить точніше розрахувати крок труби.
                  </div>
                  <div className={`${styles.hint} ${styles.fullWidth}`}>
                    Окремо від «Підлога (огородження)»: Rλ,B = основа над контуром + фініш (кераміка,
                    вініл, ламінат). Ліміт температури поверхні задається покриттям.
                  </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className={styles.field}>
              <label className={styles.label} htmlFor={`floorPresetId-${room.id}`}>
                Підлога (огородження)
              </label>
              <select
                id={`floorPresetId-${room.id}`}
                className={styles.control}
                value={floorPresets.length === 0 ? '' : room.floorPresetId}
                onChange={(e) => { updateRoom({ floorPresetId: e.target.value }); }}
                disabled={floorPresets.length === 0}
              >
                {floorPresets.length === 0 ? (
                  <option value="">Немає пресетів</option>
                ) : (
                  floorPresets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {envelopePresetLabel(p)}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          {/* Потолок (только если сверху холодно) */}
          {room.topBoundaryType === 'unheated' && (
            <div className={styles.envelopeSection}>
              <div className={styles.fieldGroupTitle}>Стеля</div>
              <div className={styles.envelopeFieldsRow}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`ceilingPresetId-${room.id}`}>
                    Стеля (пресет)
                  </label>
                  <select
                    id={`ceilingPresetId-${room.id}`}
                    className={styles.control}
                    value={ceilingPresets.length === 0 ? '' : room.ceilingPresetId}
                    onChange={(e) => { updateRoom({ ceilingPresetId: e.target.value }); }}
                    disabled={ceilingPresets.length === 0}
                  >
                    {ceilingPresets.length === 0 ? (
                      <option value="">Немає пресетів</option>
                    ) : (
                      ceilingPresets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {envelopePresetLabel(p)}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`ceiling-area-${room.id}`}>
                    Площа стелі, м²
                  </label>
                  <input
                    id={`ceiling-area-${room.id}`}
                    className={styles.control}
                    type="number"
                    min={0}
                    step={0.1}
                    value={room.ceilingAreaM2}
                    onChange={(e) => { updateRoom({ ceilingAreaM2: toNumberOrEmpty(e.target.value) }); }}
                    placeholder="наприклад, 20"
                  />
                </div>
              </div>
              <div className={styles.hint}>
                Використовуйте площу стелі/перекриття, через яку йдуть втрати (над нею холодно).
              </div>
            </div>
          )}

          {/* Кровля (только для мансарды) */}
          {room.topBoundaryType === 'roof' && (
            <div className={styles.envelopeSection}>
              <div className={styles.fieldGroupTitle}>Покрівля</div>
              <div className={styles.envelopeFieldsRow}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`roofPresetId-${room.id}`}>
                    Покрівля (пресет)
                  </label>
                  <select
                    id={`roofPresetId-${room.id}`}
                    className={styles.control}
                    value={roofPresets.length === 0 ? '' : room.roofPresetId}
                    onChange={(e) => { updateRoom({ roofPresetId: e.target.value }); }}
                    disabled={roofPresets.length === 0}
                  >
                    {roofPresets.length === 0 ? (
                      <option value="">Немає пресетів</option>
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
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`roof-area-${room.id}`}>
                    Площа скатів покрівлі (за поверхнею), м²
                  </label>
                  <input
                    id={`roof-area-${room.id}`}
                    className={styles.control}
                    type="number"
                    min={0}
                    step={0.1}
                    value={room.roofAreaM2}
                    onChange={(e) => { updateRoom({ roofAreaM2: toNumberOrEmpty(e.target.value) }); }}
                    placeholder="наприклад, 18.5"
                  />
                </div>
              </div>
              <div className={styles.hint}>
                Для мансарди вкажіть площу нахилених скатів (а не площу підлоги).
              </div>
            </div>
          )}

          {/* Наружные / коридорные стены (СП 60.13330: до двух ориентированных фасадных сторон) */}
          {wallFieldConfigs.map(({ slot, label, hint, placeholder }) => (
            <div key={slot} className={`${styles.fieldGroup} ${styles.fullWidth}`}>
              <div className={styles.fieldGroupTitle}>{label}</div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`${slot}-area-${room.id}`}>
                    Площа, м²
                  </label>
                  <input
                    id={`${slot}-area-${room.id}`}
                    className={styles.control}
                    type="number"
                    min={0}
                    step={0.1}
                    value={room[slot].areaM2}
                    onChange={(e) =>
                      { updateExternalWall(slot, { areaM2: toNumberOrEmpty(e.target.value) }); }
                    }
                    placeholder={placeholder}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`${slot}-or-${room.id}`}>
                    Орієнтація
                  </label>
                  <select
                    id={`${slot}-or-${room.id}`}
                    className={styles.control}
                    value={room[slot].orientation}
                    onChange={(e) =>
                      { updateExternalWall(slot, {
                        orientation: e.target.value as WindowOrientation,
                      }); }
                    }
                  >
                    {ORIENTATION_OPTIONS.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={styles.hint}>{hint}</div>
            </div>
          ))}
        </div>

        {/* Окна */}
        <div className={styles.hint} style={{ marginTop: 12 }}>
          Вікна задаються окремими рядками: ширина прорізу потрібна для правила «радіатор ≥ 70% ширини вікна».
          Для <strong>різних типів або розмірів</strong> натисніть «Додати вікно», а не збільшуйте поле
          «К-сть» — воно лише для однакових копій одного вікна.
        </div>
        <div className={styles.formGrid} style={{ marginTop: 8 }}>
          <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
            <button type="button" className={styles.control} onClick={addWindow}>
              Додати вікно
            </button>
          </div>
          {room.windows.length === 0 ? (
            <div className={styles.hint} style={{ gridColumn: '1 / -1' }}>
              Вікна не додано.
            </div>
          ) : (
            room.windows.map((w, wi) => {
              const resolvedWindowPresetId = windowPresets.some((p) => p.id === w.presetId)
                ? w.presetId
                : (windowPresets[0]?.id ?? DEFAULT_WINDOW_PRESET_ID);
              const windowCount =
                typeof w.count === 'number' && w.count > 1 ? w.count : null;
              return (
              <div
                key={`${room.id}-win-row-${wi}`}
                className={styles.windowCard}
                style={{ gridColumn: '1 / -1' }}
              >
                <h4 className={styles.windowCardTitle}>
                  Вікно {wi + 1}
                  {w.id ? ` (${w.id})` : ''}
                </h4>
                <div className={styles.formGrid}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor={`win-preset-${room.id}-${wi}`}>
                      Тип вікна
                    </label>
                    <select
                      id={`win-preset-${room.id}-${wi}`}
                      className={styles.control}
                      value={resolvedWindowPresetId}
                      onChange={(e) => { updateWindowAt(wi, { presetId: e.target.value }); }}
                    >
                      {windowPresets.length === 0 ? (
                        <option value={DEFAULT_WINDOW_PRESET_ID}>
                          ПВХ двокамерне (офлайн-довідник)
                        </option>
                      ) : (
                        windowPresets.map((p) => (
                          <option key={p.id} value={p.id}>
                            {envelopePresetLabel(p)}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor={`win-w-${room.id}-${wi}`}>
                      Ширина, мм
                    </label>
                    <input
                      id={`win-w-${room.id}-${wi}`}
                      className={styles.control}
                      type="number"
                      min={200}
                      step={1}
                      value={w.openingWidthMm}
                      onChange={(e) =>
                        { updateWindowAt(wi, { openingWidthMm: toNumberOrEmpty(e.target.value) }); }
                      }
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor={`win-h-${room.id}-${wi}`}>
                      Висота, мм
                    </label>
                    <input
                      id={`win-h-${room.id}-${wi}`}
                      className={styles.control}
                      type="number"
                      min={200}
                      step={1}
                      value={w.openingHeightMm}
                      onChange={(e) =>
                        { updateWindowAt(wi, { openingHeightMm: toNumberOrEmpty(e.target.value) }); }
                      }
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor={`win-or-${room.id}-${wi}`}>
                      Орієнтація
                    </label>
                    <select
                      id={`win-or-${room.id}-${wi}`}
                      className={styles.control}
                      value={w.orientation}
                      onChange={(e) =>
                        { updateWindowAt(wi, { orientation: e.target.value as WindowOrientation }); }
                      }
                    >
                      {ORIENTATION_OPTIONS.map((o) => (
                        <option key={o.code} value={o.code}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor={`win-count-${room.id}-${wi}`}>
                      К-сть однакових
                    </label>
                    <input
                      id={`win-count-${room.id}-${wi}`}
                      className={styles.control}
                      type="number"
                      min={1}
                      step={1}
                      value={w.count}
                      onChange={(e) => { updateWindowAt(wi, { count: toNumberOrEmpty(e.target.value) }); }}
                    />
                    {windowCount != null && (
                      <p className={styles.windowCountHint}>
                        {windowCount} копії з одним типом і розмірами. Інший тип — кнопка «Додати вікно».
                      </p>
                    )}
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label} htmlFor={`win-remove-${room.id}-${wi}`}>
                      &nbsp;
                    </label>
                    <button
                      id={`win-remove-${room.id}-${wi}`}
                      type="button"
                      className={styles.control}
                      onClick={() => { removeWindowAt(wi); }}
                    >
                      Видалити вікно
                    </button>
                  </div>
                </div>
              </div>
              );
            })
          )}
        </div>

        {room.topBoundaryType === 'roof' && (
          <div className={styles.hint}>
            Для мансарди верхня межа враховується як покрівля (скати), а не як стеля.
          </div>
        )}
      </div>
    </article>
  );
}
