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
import { postCalc } from './services/calc.ts';
import { buildCalcRequestPayload } from './services/buildCalcRequestPayload';
import { buildSurveyCalcInputKey } from './utils/surveyCalcInputKey';
import type { CalcReportJson } from './types/calcApi';
import type { SurveyCurrentStep } from './types/surveyStep';
import { useCalcReport } from './hooks/useCalcReport';
import { RecommendationsBlock } from './components/RecommendationsBlock/RecommendationsBlock';
import {
  HOT_WATER_BOILER_POWER_MATCHING_SCHEME_OPTIONS,
  SCHEME_BOILER_COMBI_BUFFER_ELECTRIC,
  SCHEME_BOILER_ELECTRIC_SEPARATE,
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
  SCHEME_BOILER_MAX_COMBI,
  SCHEME_BOILER_ELECTRIC_SEPARATE,
  SCHEME_BOILER_SINGLE_INDIRECT_SUM,
  SCHEME_BOILER_COMBI_BUFFER_ELECTRIC,
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

  const [
    hotWaterBoilerPowerMatchingScheme,
    setHotWaterBoilerPowerMatchingScheme,
  ] = useState<HotWaterBoilerPowerMatchingScheme>(SCHEME_BOILER_MAX_COMBI);

  const apartmentLargeForScheme = useMemo(() => {
    if (objectMeta.objectType !== 'apartment') return false;
    const totalArea = rooms.reduce((s, r) => s + (Number(r.areaM2) || 0), 0);
    const bathRooms = rooms.filter((r) => {
      const t = String(r.type ?? '').toLowerCase();
      return t === 'bathroom' || t.includes('сануз');
    }).length;
    const fx = hotWaterForm.fixtures;
    const bathPoints = (fx.bath ?? 0) + (fx.shower ?? 0);
    return totalArea > 50 || Math.max(bathRooms, bathPoints) >= 2;
  }, [objectMeta.objectType, rooms, hotWaterForm.fixtures]);

  /** Схема для API — нормализация БКН в малой квартире выполняется на бэкенде. */
  const hotWaterBoilerSchemeForCalc = hotWaterBoilerPowerMatchingScheme;

  const boilerSchemeSelectOptions = useMemo(
    () =>
      objectMeta.objectType === 'apartment' && !apartmentLargeForScheme
        ? HOT_WATER_BOILER_POWER_MATCHING_SCHEME_OPTIONS.filter(
            (o) => o.value !== SCHEME_BOILER_SINGLE_INDIRECT_SUM,
          )
        : HOT_WATER_BOILER_POWER_MATCHING_SCHEME_OPTIONS,
    [objectMeta.objectType, apartmentLargeForScheme],
  );

  const [waterUnderfloorHeating, setWaterUnderfloorHeating] = useState(false);
  const [underfloorDistributionPreset, setUnderfloorDistributionPreset] =
    useState<UfhDistributionPreset>('auto');

  const recommendedThermalRegimePreset = useMemo(
    () =>
      recommendedThermalRegimePresetForScheme(
        hotWaterBoilerPowerMatchingScheme,
        objectMeta.objectType,
      ),
    [hotWaterBoilerPowerMatchingScheme, objectMeta.objectType],
  );

  const [thermalRegimePreset, setThermalRegimePreset] =
    useState<HeatingThermalRegimePreset>(recommendedThermalRegimePreset);

  const thermalRegimeTouchedRef = useRef(false);

  const thermalRegimeRecommendationHintText = useMemo(
    () =>
      thermalRegimeRecommendationHint(
        hotWaterBoilerPowerMatchingScheme,
        objectMeta.objectType,
        thermalRegimePreset,
      ),
    [hotWaterBoilerPowerMatchingScheme, objectMeta.objectType, thermalRegimePreset],
  );

  useEffect(() => {
    if (thermalRegimeTouchedRef.current) return;
    queueMicrotask(() => {
      setThermalRegimePreset(recommendedThermalRegimePreset);
    });
  }, [recommendedThermalRegimePreset]);

  const [ufhPresetId, setUfhPresetId] = useState<UfhModePresetId | null>(null);

  const {
    ufhModePresets,
    ufhModePresetsLoading,
    ufhModePresetsError,
  } = useUfhModePresetsLoader();

  const handleUfhPresetChange = useCallback((next: UfhModePresetId | null) => {
    setUfhPresetId(next);
    if (next != null) {
      setWaterUnderfloorHeating(true);
    }
    setCalcReport(null);
  }, []);

  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [calcReport, setCalcReport] = useState<CalcReportJson | null>(null);
  const calcSeqRef = useRef(0);

  /** Смена схемы подбора: сброс отчёта + рекомендуемый график (через recommendedThermalRegimePreset). */
  const handleBoilerMatchingSchemeChange = useCallback(
    (scheme: HotWaterBoilerPowerMatchingScheme) => {
      setCalcReport(null);
      setHotWaterBoilerPowerMatchingScheme(scheme);
    },
    [],
  );

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

  const {
    apiHeatLoss,
    apiHotWaterFromReport,
    apiBoilerFromReport,
    apiBoilerKw,
    apiRadiatorsFromReport,
    apiIndirectWhFromReport,
    apiElectricWhFromReport,
    apiUnderfloorHeatingFromReport,
    displayedRadiatorSectionsTotal,
    apiCatalogSource,
    apiAutomationHints,
  } = useCalcReport(
    calcReport,
    isCalcMatchingScheme,
    quickEstimate.radiatorsSections,
  );

  const buildCalcPayload = useCallback(
    () =>
      buildCalcRequestPayload({
        rooms,
        temps,
        objectMeta,
        hotWaterForm,
        hotWaterBoilerPowerMatchingScheme: hotWaterBoilerSchemeForCalc,
        windowPresets,
        waterUnderfloorHeating,
        underfloorDistributionPreset,
        thermalRegimePreset,
        ufhPresetId,
      }),
    [
      hotWaterBoilerSchemeForCalc,
      hotWaterForm,
      objectMeta,
      rooms,
      temps,
      windowPresets,
      waterUnderfloorHeating,
      underfloorDistributionPreset,
      thermalRegimePreset,
      ufhPresetId,
    ],
  );

  const applySurveyDraftState = useCallback((draft: SurveyDraft) => {
    setCurrentStep(draft.currentStep);
    setObjectMeta(draft.objectMeta);
    setRooms(migrateRoomEnvelopeFields(migrateLegacyRoomTypes(draft.rooms)));
    setTemps({ ...draft.temps });
    setHotWaterForm(structuredClone(draft.hotWaterForm));
    if (isCalcMatchingScheme(draft.hotWaterBoilerPowerMatchingScheme)) {
      setHotWaterBoilerPowerMatchingScheme(
        draft.hotWaterBoilerPowerMatchingScheme,
      );
    }
    setWaterUnderfloorHeating(draft.waterUnderfloorHeating);
    setUnderfloorDistributionPreset(
      draft.underfloorDistributionPreset ?? 'auto',
    );
    setUfhPresetId(draft.ufhPresetId ?? null);
    setThermalRegimePreset(draft.thermalRegimePreset);
    thermalRegimeTouchedRef.current = true;
    setCalcReport(draft.lastCalcReport ?? null);
    setCalcError(null);
  }, []);

  const runApiCalc = useCallback(async () => {
    const seq = (calcSeqRef.current += 1);
    setCalcLoading(true);
    setCalcError(null);
    try {
      const data = await postCalc(buildCalcPayload());
      // Защита от гонок: если пришёл устаревший ответ — игнорируем.
      if (seq !== calcSeqRef.current) return;
      setCalcReport(data.report);
    } catch (e: unknown) {
      if (seq !== calcSeqRef.current) return;
      setCalcReport(null);
      setCalcError(e instanceof Error ? e.message : 'Ошибка расчёта');
    } finally {
      if (seq === calcSeqRef.current) {
        setCalcLoading(false);
      }
    }
  }, [buildCalcPayload]);

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

  const surveyProject = useSurveyProject({
    getDraftParams: () => ({
      currentStep,
      objectMeta,
      rooms,
      temps,
      hotWaterForm,
      hotWaterBoilerPowerMatchingScheme,
      waterUnderfloorHeating,
      underfloorDistributionPreset,
      thermalRegimePreset,
      ufhPresetId,
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

  const calcInputKey = useMemo(
    () =>
      buildSurveyCalcInputKey({
        temps,
        objectMeta,
        hotWaterBoilerPowerMatchingScheme: hotWaterBoilerSchemeForCalc,
        hotWaterForm,
        rooms,
        waterUnderfloorHeating,
        underfloorDistributionPreset,
        thermalRegimePreset,
        ufhPresetId,
      }),
    [
      hotWaterBoilerSchemeForCalc,
      hotWaterForm,
      objectMeta,
      rooms,
      temps,
      waterUnderfloorHeating,
      underfloorDistributionPreset,
      thermalRegimePreset,
      ufhPresetId,
    ],
  );

  // Автопересчёт через API (дебаунс), чтобы клиенту не нужна была кнопка.
  useEffect(() => {
    if (!canAutoCalc) return;
    const t = window.setTimeout(() => {
      void runApiCalc();
    }, 700);
    return () => window.clearTimeout(t);
  }, [canAutoCalc, calcInputKey, runApiCalc]);

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
                    ? 'Котёл и связка с горячей водой'
                    : currentStep === 'warmFloor'
                      ? 'Тёплый пол и низкотемпературный контур'
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
                showIndirectDhwSpaceOption={
                  objectMeta.objectType === 'apartment' &&
                  apartmentLargeForScheme
                }
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
                Выберите, как котёл связан с горячей водой: это определяет
                формулу требуемой мощности котла.
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
              <div className={styles.boilerHotWaterSchemeBlock}>
                <label
                  className={styles.boilerHotWaterSchemeLabel}
                  htmlFor="hot-water-boiler-scheme"
                >
                  Сценарий подбора мощности котла относительно горячей воды
                </label>
                <select
                  id="hot-water-boiler-scheme"
                  className={styles.boilerHotWaterSchemeSelect}
                  value={hotWaterBoilerSchemeForCalc}
                  onChange={(e) => {
                    handleBoilerMatchingSchemeChange(
                      e.target.value as HotWaterBoilerPowerMatchingScheme,
                    );
                  }}
                >
                  {boilerSchemeSelectOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className={styles.hint} style={{ marginTop: 10 }}>
                  Поле отправляется в запросе как{' '}
                  <code className={styles.inlineCode}>
                    heatingSystem.hotWaterBoilerPowerMatchingScheme
                  </code>
                  .
                </p>
                <label
                  className={styles.boilerHotWaterSchemeLabel}
                  htmlFor="thermal-regime-preset"
                >
                  Режим графика отопления (подача / обратка, пресет под тип
                  котла)
                </label>
                <select
                  id="thermal-regime-preset"
                  className={styles.boilerHotWaterSchemeSelect}
                  value={thermalRegimePreset}
                  onChange={(e) => {
                    const next = e.target.value as HeatingThermalRegimePreset;
                    thermalRegimeTouchedRef.current = true;
                    setThermalRegimePreset(next);
                    setCalcReport(null);
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
                  setCalcReport(null);
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
          onApplyScheme={handleBoilerMatchingSchemeChange}
        />
      </div>

      <Footer version={`v${__APP_VERSION__}`} />
    </div>
  );
}

export default App;
