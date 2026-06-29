/**
 * Назначение: Главный контейнер анкеты подбора оборудования.
 * Описание: Управляет шагами мастера, состоянием полей, автопересчётом, проектами и отображением блока рекомендаций.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Header } from './components/Header/Header';
import { Footer } from './components/Footer/Footer';
import Logo from './components/Logo/Logo';
import styles from './App.module.css';
import { ObjectMetaForm } from './components/ObjectMetaForm/ObjectMetaForm';
import type { ObjectMetaValue } from './types/envelope';
import { RoomsForm } from './components/RoomsForm/RoomsForm';
import type { RoomFormValue } from './types/rooms';
import type { UfhDistributionPreset } from './types/ufhDistribution';
import { HotWaterForm } from './components/HotWaterForm/HotWaterForm';
import type { HotWaterFormValue } from './types/hotWater';
import { WaterHeaterForm } from './components/WaterHeaterForm/WaterHeaterForm';
import type { WaterHeaterFormValue } from './types/waterHeater';
import { createDefaultWaterHeaterFormValue } from './utils/waterHeaterFormDefaults';
import {
  getWaterHeaterSchemeOptions,
  isApartmentLargeForIndirectScheme,
} from './utils/waterHeaterSchemeOptions';
import { buildCalcRequestPayload } from './services/buildCalcRequestPayload';
import { HydraulicsSection } from './components/HydraulicsSection/HydraulicsSection';
import {
  DEFAULT_HYDRAULICS_FORM,
  type HydraulicsFormValue,
} from './types/hydraulics';
import { buildSurveyCalcInputKey } from './utils/surveyCalcInputKey';
import type { SurveyCurrentStep } from './types/surveyStep';
import { useCalcReport } from './hooks/useCalcReport';
import { useSurveyCalcRunner } from './hooks/useSurveyCalcRunner';
import { RecommendationsBlock } from './components/RecommendationsBlock/RecommendationsBlock';
import {
  HOT_WATER_BOILER_MATCHING_SCHEME_ENUM,
  SCHEME_BOILER_MAX_COMBI,
  SCHEME_BOILER_SINGLE_INDIRECT_SUM,
  type HotWaterBoilerPowerMatchingScheme,
} from './types/heatingMatching';
import {
  HEATING_THERMAL_REGIME_OPTIONS,
  recommendedThermalRegimePresetForScheme,
  thermalRegimeRecommendationHint,
  type HeatingThermalRegimePreset,
} from './types/heatingThermalRegime';
import { WarmFloorSection } from './components/WarmFloorSection/WarmFloorSection';
import { useUfhModePresetsLoader } from './hooks/useUfhModePresetsLoader';
import type { UfhModePresetId } from './types/ufhModePreset';
import { useRoomsOrchestration } from './hooks/useRoomsOrchestration';
import { useCatalogEquipmentLoader } from './hooks/useCatalogEquipmentLoader';
import { useEnvelopePresetsLoader } from './hooks/useEnvelopePresetsLoader';
import { useUnderfloorHeatingPresetsLoader } from './hooks/useUnderfloorHeatingPresetsLoader';
import { usePresetLists } from './hooks/usePresetLists';
import { useSurveyEstimates } from './hooks/useSurveyEstimates';
import { useSurveyProject } from './hooks/useSurveyProject';
import { ProjectsDialog } from './components/ProjectsDialog/ProjectsDialog';
import type { SurveyDraft } from './types/surveyDraft';
import { migrateLegacyRoomTypes } from './utils/migrateLegacyRoomTypes';
import {
  createDefaultExternalWall,
  migrateRoomEnvelopeFields,
  totalExternalWallAreaM2,
} from './utils/roomEnvelopeFields';
import { createDefaultWindowFormValue } from './utils/roomWindowDefaults';

const CALC_SCHEME_VALUES: readonly HotWaterBoilerPowerMatchingScheme[] = [
  ...HOT_WATER_BOILER_MATCHING_SCHEME_ENUM,
];

function isCalcMatchingScheme(
  v: string,
): v is HotWaterBoilerPowerMatchingScheme {
  return (CALC_SCHEME_VALUES as readonly string[]).includes(v);
}

function App() {
  // Текущий шаг анкеты/расчета (пока минимальный каркас для UI-навигации).
  const [currentStep, setCurrentStep] = useState<SurveyCurrentStep>('object');

  const { envelopePresets, presetsLoading, presetsError } =
    useEnvelopePresetsLoader();

  const { underfloorHeatingBases, flooringFinishes, underfloorPresetsLoading } =
    useUnderfloorHeatingPresetsLoader();

  const { catalogSnap, catalogSnapLoading, catalogSnapError, reloadCatalog } =
    useCatalogEquipmentLoader();

  const {
    wallPresets,
    windowPresets,
    floorPresets,
    ceilingPresets,
    roofPresets,
    sftkInsulationPresets,
    ventilatedInsulationPresets,
    insulationPresets,
  } = usePresetLists(envelopePresets);

  const [objectMeta, setObjectMeta] = useState<ObjectMetaValue>({
    objectType: 'house',
    apartmentStackPosition: 'middle_floor',
    floors: 1,
    roomsCount: 1,
    externalWalls: {
      presetId: 'wall_gas_concrete_d500',
      thicknessMm: 300,
      facadeSystem: 'none',
    },
    roofPresetId: 'roof_concrete_insulated_flat',
    boilerPlacementZone: 'kitchen',
    ventilationReserveMode: 'natural',
  });

  const [rooms, setRooms] = useState<RoomFormValue[]>(() =>
    migrateRoomEnvelopeFields(
      migrateLegacyRoomTypes([
        {
          id: 'r1',
          name: 'Комната 1',
          type: 'помещение',
          floor: 1,
          topBoundaryType: 'heated',
          bottomBoundaryType: 'unheated',
          areaM2: '',
          heightM: 2.7,
          floorPresetId: '',
          ceilingPresetId: '',
          roofPresetId: '',
          externalWall1: createDefaultExternalWall(),
          externalWall2: createDefaultExternalWall(),
          ceilingAreaM2: '',
          roofAreaM2: '',
          windows: [createDefaultWindowFormValue('r1', 1)],
        },
      ]),
    ),
  );

  const [temps, setTemps] = useState<{ insideC: number; outsideC: number }>({
    insideC: 20,
    outsideC: -5,
  });

  const [hotWaterForm, setHotWaterForm] = useState<HotWaterFormValue>(() => ({
    residents: 0,
    coldWaterDesignSeason: 'winter',
    hotWaterC: 60,
    tropicalShower: false,
    fixtures: {
      shower: 0,
      bath: 0,
      sink: 0,
      toilet: 0,
      kitchenSink: 0,
      dishwasher: 0,
      laundrySink: 0,
      washingMachine: 0,
      bidet: 0,
    },
  }));

  const [waterHeaterForm, setWaterHeaterForm] = useState<WaterHeaterFormValue>(
    createDefaultWaterHeaterFormValue,
  );

  const apartmentLargeForScheme = useMemo(
    () =>
      isApartmentLargeForIndirectScheme(
        objectMeta.objectType,
        rooms,
        hotWaterForm.fixtures,
      ),
    [objectMeta.objectType, rooms, hotWaterForm.fixtures],
  );

  const [waterUnderfloorHeating, setWaterUnderfloorHeating] = useState(false);
  const [underfloorDistributionPreset, setUnderfloorDistributionPreset] =
    useState<UfhDistributionPreset>('auto');

  const recommendedThermalRegimePreset = useMemo(
    () =>
      recommendedThermalRegimePresetForScheme(
        waterHeaterForm.hotWaterBoilerPowerMatchingScheme,
        objectMeta.objectType,
      ),
    [waterHeaterForm.hotWaterBoilerPowerMatchingScheme, objectMeta.objectType],
  );

  const [thermalRegimePreset, setThermalRegimePreset] =
    useState<HeatingThermalRegimePreset>(recommendedThermalRegimePreset);

  const thermalRegimeTouchedRef = useRef(false);

  const thermalRegimeRecommendationHintText = useMemo(
    () =>
      thermalRegimeRecommendationHint(
        waterHeaterForm.hotWaterBoilerPowerMatchingScheme,
        objectMeta.objectType,
        thermalRegimePreset,
      ),
    [
      waterHeaterForm.hotWaterBoilerPowerMatchingScheme,
      objectMeta.objectType,
      thermalRegimePreset,
    ],
  );

  useEffect(() => {
    if (thermalRegimeTouchedRef.current) return;
    queueMicrotask(() => {
      setThermalRegimePreset(recommendedThermalRegimePreset);
    });
  }, [recommendedThermalRegimePreset]);

  const [ufhPresetId, setUfhPresetId] = useState<UfhModePresetId | null>(null);
  const [hydraulicsForm, setHydraulicsForm] = useState<HydraulicsFormValue>(
    () => ({ ...DEFAULT_HYDRAULICS_FORM }),
  );

  const {
    ufhModePresets,
    ufhModePresetsLoading,
    ufhModePresetsError,
  } = useUfhModePresetsLoader();

  useRoomsOrchestration({
    objectMeta,
    setObjectMeta,
    setRooms,
    wallPresets,
    floorPresets,
    ceilingPresets,
    roofPresets,
    windowPresets,
  });

  const { isRoomsComplete, quickEstimate } = useSurveyEstimates(rooms);

  const buildCalcPayload = useCallback(
    () =>
      buildCalcRequestPayload({
        rooms,
        temps,
        objectMeta,
        hotWaterForm,
        waterHeaterForm,
        windowPresets,
        waterUnderfloorHeating,
        underfloorDistributionPreset,
        thermalRegimePreset,
        ufhPresetId,
        hydraulicsForm,
      }),
    [
      waterHeaterForm,
      hotWaterForm,
      objectMeta,
      rooms,
      temps,
      windowPresets,
      waterUnderfloorHeating,
      underfloorDistributionPreset,
      thermalRegimePreset,
      ufhPresetId,
      hydraulicsForm,
    ],
  );

  const canAutoCalc = useMemo(() => {
    if (!isRoomsComplete) return false;
    // Нужен хотя бы один элемент ограждения, иначе API вернёт VALIDATION_ERROR (minItems: 1).
    return rooms.some((r) => {
      if (totalExternalWallAreaM2(r) > 0) return true;
      if (r.topBoundaryType === 'roof') {
        const roofArea = typeof r.roofAreaM2 === 'number' ? r.roofAreaM2 : 0;
        if (roofArea > 0) return true;
      }
      if (r.topBoundaryType === 'unheated') {
        const ceilingArea =
          typeof r.ceilingAreaM2 === 'number' ? r.ceilingAreaM2 : 0;
        if (ceilingArea > 0) return true;
      }
      return (r.windows ?? []).some((w) => {
        const wMm = typeof w.openingWidthMm === 'number' ? w.openingWidthMm : 0;
        const hMm =
          typeof w.openingHeightMm === 'number' ? w.openingHeightMm : 0;
        return wMm > 0 && hMm > 0;
      });
    });
  }, [isRoomsComplete, rooms]);

  /** Почему не уходит fetch на /api/v1/calc (тогда в Network пусто). */
  const autoCalcBlockedReason = useMemo(() => {
    if (!isRoomsComplete) {
      return 'У каждого помещения задайте площадь и высоту числом больше 0 — иначе запрос к API не отправляется.';
    }
    if (!canAutoCalc) {
      return 'Нет данных для теплопотерь: укажите площадь наружной стены (№1 или №2) или окно с шириной/высотой проёма, либо потолок/кровлю (по верхней границе). Пока этого нет, автозапрос к серверу отключён.';
    }
    return null;
  }, [canAutoCalc, isRoomsComplete]);

  const calcInputKey = useMemo(
    () =>
      buildSurveyCalcInputKey({
        temps,
        objectMeta,
        waterHeaterForm,
        hotWaterForm,
        rooms,
        waterUnderfloorHeating,
        underfloorDistributionPreset,
        thermalRegimePreset,
        ufhPresetId,
        hydraulicsForm,
      }),
    [
      waterHeaterForm,
      hotWaterForm,
      objectMeta,
      rooms,
      temps,
      waterUnderfloorHeating,
      underfloorDistributionPreset,
      thermalRegimePreset,
      ufhPresetId,
      hydraulicsForm,
    ],
  );

  const {
    calcLoading,
    calcError,
    calcReport,
    setCalcReport,
    beginDraftInitialization,
    endDraftInitialization,
    restoreCalcReport,
    runApiCalc,
    scheduleFreshCalc,
  } = useSurveyCalcRunner({
    buildCalcPayload,
    canAutoCalc,
    calcInputKey,
  });

  const {
    apiHeatLoss,
    apiHotWaterFromReport,
    apiBoilerFromReport,
    apiBoilerKw,
    apiRadiatorsFromReport,
    apiIndirectWhFromReport,
    apiElectricWhFromReport,
    apiUnderfloorHeatingFromReport,
    apiHydraulicsFromReport,
    displayedRadiatorSectionsTotal,
    apiCatalogSource,
    apiAutomationHints,
  } = useCalcReport(
    calcReport,
    isCalcMatchingScheme,
    quickEstimate.radiatorsSections,
  );

  const applySurveyDraftState = useCallback(
    (draft: SurveyDraft) => {
      beginDraftInitialization();
      setCurrentStep(draft.currentStep);
      setObjectMeta(draft.objectMeta);
      setRooms(structuredClone(draft.rooms));
      setTemps({ ...draft.temps });
      setHotWaterForm(structuredClone(draft.hotWaterForm));
      setWaterHeaterForm(structuredClone(draft.waterHeaterForm));
      setWaterUnderfloorHeating(draft.waterUnderfloorHeating);
      setUnderfloorDistributionPreset(
        draft.underfloorDistributionPreset ?? 'auto',
      );
      setUfhPresetId(draft.ufhPresetId ?? null);
      setThermalRegimePreset(draft.thermalRegimePreset);
      thermalRegimeTouchedRef.current = true;
      setHydraulicsForm(
        draft.hydraulicsForm
          ? structuredClone(draft.hydraulicsForm)
          : { ...DEFAULT_HYDRAULICS_FORM },
      );
      restoreCalcReport(null);
      queueMicrotask(() => {
        endDraftInitialization();
        scheduleFreshCalc();
      });
    },
    [beginDraftInitialization, endDraftInitialization, restoreCalcReport, scheduleFreshCalc],
  );

  /** Смена схемы из подсказок отчёта или формы водонагревателя. */
  const handleWaterHeaterSchemeChange = useCallback(
    (scheme: HotWaterBoilerPowerMatchingScheme) => {
      setWaterHeaterForm((prev) => ({
        ...prev,
        hotWaterBoilerPowerMatchingScheme: scheme,
        indirectDhwSpaceAvailable:
          objectMeta.objectType === 'apartment' &&
          scheme === SCHEME_BOILER_SINGLE_INDIRECT_SUM
            ? prev.indirectDhwSpaceAvailable
            : false,
      }));
    },
    [objectMeta.objectType],
  );

  const handleWaterHeaterFormChange = useCallback((next: WaterHeaterFormValue) => {
    setWaterHeaterForm(next);
  }, []);

  const handleUfhPresetChange = useCallback((next: UfhModePresetId | null) => {
    setUfhPresetId(next);
    if (next != null) {
      setWaterUnderfloorHeating(true);
    }
  }, []);

  const surveyProject = useSurveyProject({
    getDraftParams: () => ({
      currentStep,
      objectMeta,
      rooms,
      temps,
      hotWaterForm,
      waterHeaterForm,
      waterUnderfloorHeating,
      underfloorDistributionPreset,
      thermalRegimePreset,
      ufhPresetId,
      hydraulicsForm,
      lastCalcReport: calcReport,
    }),
    applyDraft: applySurveyDraftState,
    buildCalcPayload,
    canRunCalc: canAutoCalc,
    setCalcReport,
  });

  const {
    clientName,
    setClientName,
    projectId,
    statusMessage,
    statusError,
    fileInputRef,
    projectsOpen,
    setProjectsOpen,
    projectsLoading,
    projectList,
    calculations,
    saveToFile,
    saveToServer,
    openFilePicker,
    handleFileSelected,
    exportTextFile,
    exportShare,
    exportLink,
    openProjectsPanel,
    loadProjectById,
    loadCalculationById,
    startNewProject,
    refreshProjectList,
  } = surveyProject;

  const showCalcApiBar =
    currentStep !== 'object' &&
    [
      'rooms',
      'hotWater',
      'boiler',
      'warmFloor',
      'radiators',
      'waterHeater',
      'hydraulics',
      'summary',
    ].includes(currentStep);

  const { hotWaterBoilerPowerMatchingScheme } = waterHeaterForm;

  // Если схема стала недоступна (малая квартира) — сброс на max-комби.
  useEffect(() => {
    const allowed = getWaterHeaterSchemeOptions(
      objectMeta.objectType,
      apartmentLargeForScheme,
    ).map((o) => o.value);
    if (allowed.includes(hotWaterBoilerPowerMatchingScheme)) {
      return;
    }
    queueMicrotask(() => {
      setWaterHeaterForm((prev) => ({
        ...prev,
        hotWaterBoilerPowerMatchingScheme: SCHEME_BOILER_MAX_COMBI,
        indirectDhwSpaceAvailable: false,
      }));
    });
  }, [
    apartmentLargeForScheme,
    hotWaterBoilerPowerMatchingScheme,
    objectMeta.objectType,
  ]);

  return (
    <div className={styles.appContainer}>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={(e) => {
          void handleFileSelected(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <Header
        logo={<Logo />}
        title="HeatCalc Pro"
        clientName={clientName}
        onClientNameChange={setClientName}
        projectId={projectId}
        statusMessage={statusMessage}
        statusError={statusError}
        onOpenFile={openFilePicker}
        onSaveFile={saveToFile}
        onSaveServer={() => void saveToServer(false)}
        onSaveServerWithCalc={() => void saveToServer(true)}
        onExportText={exportTextFile}
        onExportShare={() => void exportShare()}
        onExportLink={() => void exportLink()}
        onOpenProjects={openProjectsPanel}
      />
      <ProjectsDialog
        open={projectsOpen}
        loading={projectsLoading}
        projects={projectList}
        calculations={calculations}
        activeProjectId={projectId}
        onClose={() => setProjectsOpen(false)}
        onRefresh={() => void refreshProjectList()}
        onNewProject={startNewProject}
        onSelectProject={(id) => void loadProjectById(id)}
        onSelectCalculation={(id) => void loadCalculationById(id)}
      />

      <div className={styles.layoutBody}>
        <aside className={styles.navigationSteps}>
          <nav aria-label="Этапы анкеты">
            {/* Навигация по шагам (пока без роутинга) */}
            <ul className={styles.stepList}>
              <li>
                <button
                  type="button"
                  onClick={() => setCurrentStep('object')}
                  aria-current={currentStep === 'object' ? 'step' : undefined}
                  className={styles.stepButton}
                >
                  Объект
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setCurrentStep('rooms')}
                  aria-current={currentStep === 'rooms' ? 'step' : undefined}
                  className={styles.stepButton}
                >
                  Помещения
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setCurrentStep('hotWater')}
                  aria-current={currentStep === 'hotWater' ? 'step' : undefined}
                  className={styles.stepButton}
                >
                  Горячая вода
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setCurrentStep('boiler')}
                  aria-current={currentStep === 'boiler' ? 'step' : undefined}
                  className={styles.stepButton}
                >
                  Котёл
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setCurrentStep('warmFloor')}
                  aria-current={
                    currentStep === 'warmFloor' ? 'step' : undefined
                  }
                  className={styles.stepButton}
                >
                  Тёплый пол
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setCurrentStep('radiators')}
                  aria-current={
                    currentStep === 'radiators' ? 'step' : undefined
                  }
                  className={styles.stepButton}
                >
                  Радиаторы
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setCurrentStep('waterHeater')}
                  aria-current={
                    currentStep === 'waterHeater' ? 'step' : undefined
                  }
                  className={styles.stepButton}
                >
                  Водонагреватель
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setCurrentStep('hydraulics')}
                  aria-current={
                    currentStep === 'hydraulics' ? 'step' : undefined
                  }
                  className={styles.stepButton}
                >
                  Гидравлика
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setCurrentStep('summary')}
                  aria-current={currentStep === 'summary' ? 'step' : undefined}
                  className={styles.stepButton}
                >
                  Итог
                </button>
              </li>
            </ul>
          </nav>
        </aside>

        <main className={styles.mainColumn}>
          {/* Секция с общими коэффициентами */}
          <section
            className={styles.globalMeta}
            aria-labelledby="global-meta-title"
          >
            {/* Инпуты для города и материалов */}
            <h2 id="global-meta-title">
              {currentStep === 'rooms'
                ? 'Параметры помещений'
                : currentStep === 'hotWater'
                  ? 'Объект и горячая вода'
                  : currentStep === 'boiler'
                    ? 'Котёл: температурный график отопления'
                    : currentStep === 'waterHeater'
                      ? 'Водонагреватель и сценарий ГВС'
                      : currentStep === 'warmFloor'
                      ? 'Тёплый пол и низкотемпературный контур'
                      : currentStep === 'hydraulics'
                        ? 'Гидравлика и разводка'
                        : 'Параметры объекта'}
            </h2>
            {currentStep === 'object' && (
              <ObjectMetaForm
                value={objectMeta}
                wallPresets={wallPresets}
                sftkInsulationPresets={sftkInsulationPresets}
                ventilatedInsulationPresets={ventilatedInsulationPresets}
                roofPresets={roofPresets}
                loadingPresets={presetsLoading}
                presetsError={presetsError}
                onChange={setObjectMeta}
              />
            )}

            {currentStep === 'hotWater' && (
              <p className={styles.hint} style={{ marginTop: 8 }}>
                Тип объекта:{' '}
                <strong>
                  {objectMeta.objectType === 'apartment' ? 'Квартира' : 'Дом'}
                </strong>
                , этажность {objectMeta.floors}, комнат по плану:{' '}
                {objectMeta.roomsCount}. Нормы расхода воды на человека и
                коэффициент одновременности берутся из справочника бэкенда (по
                типу объекта).
              </p>
            )}

            {currentStep === 'boiler' && (
              <p className={styles.hint} style={{ marginTop: 8 }}>
                Задайте радиаторный график подачи/обратки. Сценарий горячей воды
                и подбор БКН/электробойлера — на шаге «Водонагреватель».
              </p>
            )}

            {currentStep === 'waterHeater' && (
              <p className={styles.hint} style={{ marginTop: 8 }}>
                Выберите стратегию ГВС: от этого зависят подбор бойлера
                косвенного нагрева или электронакопителя и формула мощности
                котла. Изменения пересчитываются автоматически.
              </p>
            )}

            {currentStep === 'warmFloor' && (
              <p className={styles.hint} style={{ marginTop: 8 }}>
                Отметьте наличие водяного тёплого пола — для конденсационного
                контура это типичный партнёр низкотемпературной подачи.
              </p>
            )}

            {/* Температуры (MVP): относятся к объекту */}
            {currentStep === 'object' && (
              <div className={styles.tempRow}>
                <label className={styles.tempField}>
                  Внутри, °C
                  <input
                    type="number"
                    value={temps.insideC}
                    onChange={(e) =>
                      setTemps((prev) => ({
                        ...prev,
                        insideC: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label className={styles.tempField}>
                  Снаружи, °C
                  <input
                    type="number"
                    value={temps.outsideC}
                    onChange={(e) =>
                      setTemps((prev) => ({
                        ...prev,
                        outsideC: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              </div>
            )}
          </section>

          {/* Основная рабочая область */}
          <section className={styles.workArea}>
            {currentStep === 'rooms' && (
              <RoomsForm
                value={rooms}
                maxFloors={objectMeta.floors}
                objectMeta={objectMeta}
                wallPresets={wallPresets}
                insulationPresets={insulationPresets}
                windowPresets={windowPresets}
                floorPresets={floorPresets}
                ceilingPresets={ceilingPresets}
                roofPresets={roofPresets}
                waterUnderfloorHeating={waterUnderfloorHeating}
                underfloorHeatingBases={underfloorHeatingBases}
                flooringFinishes={flooringFinishes}
                underfloorPresetsLoading={underfloorPresetsLoading}
                onChange={setRooms}
              />
            )}
            {currentStep === 'hotWater' && (
              <HotWaterForm value={hotWaterForm} onChange={setHotWaterForm} />
            )}

            {currentStep === 'boiler' && (
              <div className={styles.thermalRegimeBlock}>
                <label
                  className={styles.thermalRegimeLabel}
                  htmlFor="thermal-regime-preset"
                >
                  Режим графика отопления (подача / обратка, пресет под тип
                  котла)
                </label>
                <select
                  id="thermal-regime-preset"
                  className={styles.thermalRegimeSelect}
                  value={thermalRegimePreset}
                  onChange={(e) => {
                    const next = e.target.value as HeatingThermalRegimePreset;
                    thermalRegimeTouchedRef.current = true;
                    setThermalRegimePreset(next);
                  }}
                >
                  {HEATING_THERMAL_REGIME_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {thermalRegimeRecommendationHintText != null && (
                  <p className={styles.hint} role="status">
                    {thermalRegimeRecommendationHintText}
                  </p>
                )}
                <p className={styles.hint} style={{ marginTop: 10 }}>
                  Радиаторный контур: <strong>75/65</strong> (традиционный
                  котёл) или <strong>55/45</strong> (конденсационный). Контур
                  тёплого пола (45/35 или 40/30) задаётся отдельно по финишу
                  покрытия на шаге «Помещения». В API:{' '}
                  <code className={styles.inlineCode}>
                    heatingSystem.thermalRegimePreset
                  </code>
                  .
                </p>
              </div>
            )}

            {currentStep === 'waterHeater' && (
              <WaterHeaterForm
                value={waterHeaterForm}
                onChange={handleWaterHeaterFormChange}
                objectType={objectMeta.objectType}
                apartmentLarge={apartmentLargeForScheme}
                hotWaterForm={hotWaterForm}
                hotWaterReport={apiHotWaterFromReport}
                calcLoading={calcLoading}
                indirectMatching={apiIndirectWhFromReport}
                electricMatching={apiElectricWhFromReport}
              />
            )}

            {currentStep === 'hydraulics' && (
              <HydraulicsSection
                value={hydraulicsForm}
                onChange={setHydraulicsForm}
              />
            )}

            {currentStep === 'warmFloor' && (
              <WarmFloorSection
                waterUnderfloorHeating={waterUnderfloorHeating}
                underfloorDistributionPreset={underfloorDistributionPreset}
                ufhModePresets={ufhModePresets}
                ufhModePresetsLoading={ufhModePresetsLoading}
                ufhModePresetsError={ufhModePresetsError}
                ufhPresetId={ufhPresetId}
                onUfhPresetChange={handleUfhPresetChange}
                onWaterUnderfloorChange={(v) => {
                  setWaterUnderfloorHeating(v);
                  if (!v) setUfhPresetId(null);
                }}
                onDistributionPresetChange={setUnderfloorDistributionPreset}
              />
            )}

            {showCalcApiBar && (
              <div className={styles.calcApiBar}>
                {autoCalcBlockedReason != null ? (
                  <p className={styles.calcApiBarWarn}>
                    {autoCalcBlockedReason}
                  </p>
                ) : (
                  <p className={styles.calcApiBarWarn}>
                    Запрос <code>POST /api/v1/calc</code> уходит на тот же хост,
                    что и страница (в dev — прокси Vite → порт 3001). Во вкладке
                    Network выберите фильтр «Fetch/XHR» и при необходимости
                    включите «Сохранять журнал».
                  </p>
                )}
                <button
                  type="button"
                  className={styles.calcButton}
                  disabled={!canAutoCalc || calcLoading}
                  onClick={() => {
                    void runApiCalc();
                  }}
                >
                  {calcLoading ? 'Расчёт…' : 'Отправить расчёт на сервер'}
                </button>
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              {calcLoading && <div className={styles.hint}>Расчёт…</div>}
              {calcError && (
                <div style={{ marginTop: 8, color: 'crimson' }}>
                  {calcError}
                </div>
              )}
              {import.meta.env.DEV && calcReport != null && (
                <details style={{ marginTop: 8 }}>
                  <summary>Показать отчёт (JSON)</summary>
                  <pre
                    style={{
                      maxHeight: 320,
                      overflow: 'auto',
                      background: '#0b0f14',
                      color: '#d7e0ea',
                      padding: 12,
                      borderRadius: 8,
                    }}
                  >
                    {JSON.stringify(calcReport, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </section>
        </main>

        <RecommendationsBlock
          className={styles.calculationResults}
          quickEstimate={quickEstimate}
          apiHeatLoss={apiHeatLoss}
          apiHotWaterFromReport={apiHotWaterFromReport}
          apiBoilerFromReport={apiBoilerFromReport}
          apiBoilerKw={apiBoilerKw}
          apiRadiatorsFromReport={apiRadiatorsFromReport}
          apiIndirectWhFromReport={apiIndirectWhFromReport}
          apiElectricWhFromReport={apiElectricWhFromReport}
          apiUnderfloorHeatingFromReport={apiUnderfloorHeatingFromReport}
          displayedRadiatorSectionsTotal={displayedRadiatorSectionsTotal}
          apiCatalogSource={apiCatalogSource}
          apiAutomationHints={apiAutomationHints}
          objectType={objectMeta.objectType}
          catalogSnap={catalogSnap}
          catalogSnapLoading={catalogSnapLoading}
          catalogSnapError={catalogSnapError}
          onRetryLoadCatalog={() => void reloadCatalog()}
          onApplyScheme={handleWaterHeaterSchemeChange}
          apiHydraulicsFromReport={apiHydraulicsFromReport}
          calcLoading={calcLoading}
        />
      </div>

      <Footer version={`v${__APP_VERSION__}`} />
    </div>
  );
}

export default App;
