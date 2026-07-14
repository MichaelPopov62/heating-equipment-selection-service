/**
 * Назначение: Форма списка помещений.
 * Описание: Добавление и удаление комнат, сводка наружных стен и передача пресетов в аккордеоны.
 */

import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useMemo, useState } from 'react';

import type { EnvelopePreset, ObjectMetaValue } from '../../types/envelope';
import type {
  FlooringFinishMaterial,
  UnderfloorHeatingBasePreset,
} from '../../types/underfloorHeating';
import { formatExternalWallsSummary } from '../../utils/externalWallsSummary';
import {
  type RoomFormValue,
} from '../../types/rooms';

import { RoomAccordionItem } from './RoomAccordionItem.tsx';
import styles from './RoomsForm.module.css';

type Props = {
  value: RoomFormValue[];
  maxFloors: 1 | 2 | 3;
  objectMeta: ObjectMetaValue;
  wallPresets: EnvelopePreset[];
  insulationPresets: EnvelopePreset[];
  windowPresets: EnvelopePreset[];
  floorPresets: EnvelopePreset[];
  ceilingPresets: EnvelopePreset[];
  roofPresets: EnvelopePreset[];
  waterUnderfloorHeating?: boolean;
  underfloorHeatingBases?: UnderfloorHeatingBasePreset[];
  flooringFinishes?: FlooringFinishMaterial[];
  underfloorPresetsLoading?: boolean;
  onChange: Dispatch<SetStateAction<RoomFormValue[]>>;
};

export function RoomsForm({
  value,
  maxFloors,
  objectMeta,
  wallPresets,
  insulationPresets,
  windowPresets,
  floorPresets,
  ceilingPresets,
  roofPresets,
  waterUnderfloorHeating = false,
  underfloorHeatingBases = [],
  flooringFinishes = [],
  underfloorPresetsLoading = false,
  onChange,
}: Props) {
  const objectExternalWallsSummary = formatExternalWallsSummary(
    objectMeta,
    wallPresets,
    insulationPresets,
  );
  const allIds = useMemo(() => value.map((r) => r.id), [value]);
  // Стартуем со "все свернуты" и больше не авто-открываем комнаты.
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- синхронная подрезка openIds при смене списка комнат */
    setOpenIds((prev) => {
      const next = new Set<string>();
      for (const id of allIds) if (prev.has(id)) next.add(id);
      return next;
    });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [allIds]);

  const toggleAccordion = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyFirstRoomSettings = () => {
    const r0 = value[0];
    if (!r0) return;
    onChange((prev) =>
      prev.map((r, idx) =>
        idx === 0
          ? r
          : {
              ...r,
              floor: r0.floor,
              topBoundaryType: r0.topBoundaryType,
              bottomBoundaryType: r0.bottomBoundaryType,
              floorPresetId: r0.floorPresetId,
              ceilingPresetId: r0.ceilingPresetId,
              roofPresetId: r0.roofPresetId,
              externalWall1: { ...r0.externalWall1 },
              externalWall2: { ...r0.externalWall2 },
              ...(r0.roomExteriorLayout !== undefined
                ? { roomExteriorLayout: r0.roomExteriorLayout }
                : {}),
              ceilingAreaM2: r0.ceilingAreaM2,
              roofAreaM2: r0.roofAreaM2,
              windows: r0.windows.map((w, wi) => ({
                ...w,
                id: `win-${r.id}-${wi + 1}`,
              })),
              ...(r0.underfloorHeating
                ? { underfloorHeating: { ...r0.underfloorHeating } }
                : {}),
            },
      ),
    );
  };

  return (
    <div className={styles.root}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>Помещения</h2>
        {value.length > 1 && (
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.smallButton}
              onClick={copyFirstRoomSettings}
            >
              Скопировать из первой комнаты
            </button>
          </div>
        )}
      </div>
      <div className={styles.grid}>
        {value.map((room, index) => (
          <RoomAccordionItem
            key={room.id}
            room={room}
            index={index}
            isOpen={openIds.has(room.id)}
            onToggle={() => { toggleAccordion(room.id); }}
            maxFloors={maxFloors}
            objectExternalWallsSummary={objectExternalWallsSummary}
            windowPresets={windowPresets}
            floorPresets={floorPresets}
            ceilingPresets={ceilingPresets}
            roofPresets={roofPresets}
            waterUnderfloorHeating={waterUnderfloorHeating}
            underfloorHeatingBases={underfloorHeatingBases}
            flooringFinishes={flooringFinishes}
            underfloorPresetsLoading={underfloorPresetsLoading}
            isApartment={objectMeta.objectType === 'apartment'}
            objectType={objectMeta.objectType}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  );
}
