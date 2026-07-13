/**
 * Назначение: Тело анкеты (шаги, формы, отчёт).
 * Описание: Все мутации через SurveySession.dispatch и единый pipeline.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';

import { Header } from './components/Header/Header';
import { Footer } from './components/Footer/Footer';
import Logo from './components/Logo/Logo';
import styles from './App.module.css';
import { ObjectMetaForm } from './components/ObjectMetaForm/ObjectMetaForm';
import type { ObjectMetaValue, EnvelopePreset } from './types/envelope';
import { RoomsForm } from './components/RoomsForm/RoomsForm';
import type { RoomFormValue } from './types/rooms';
import { HotWaterForm } from './components/HotWaterForm/HotWaterForm';
import type { HotWaterFormValue } from './types/hotWater';
import { WaterHeaterForm } from './components/WaterHeaterForm/WaterHeaterForm';
import type { WaterHeaterFormValue } from './types/waterHeater';
import {
  getWaterHeaterSchemeOptions,
  isApartmentLargeForIndirectScheme,
} from './utils/waterHeaterSchemeOptions';
import { buildCalcPayloadFromDraft } from './surveySession/buildCalcInputSnapshot';
import { HydraulicsSection } from './components/HydraulicsSection/HydraulicsSection';
import type { HydraulicsFormValue } from './types/hydraulics';
import type { WiringSystemType } from './surveySession/wiringLayoutV3';
import {
  isCalcApiBarStep,
  SURVEY_STEP_NAV_ITEMS,
  surveyStepGlobalMetaTitle,
} from './constants/surveySteps';
import type { SurveyCurrentStep } from './types/surveyStep';
import { useCalcReport } from './hooks/useCalcReport';
import { useSurveySession } from './surveySession/useSurveySession';
import { surveyDraftToSessionSnapshot } from './surveySession/surveyDraftBridge';
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
import {
  isRadiatorConnection,
  RADIATOR_CONNECTION_SURVEY_UI_OPTIONS,
} from './types/radiatorConnection';
import {
  isRadiatorEmitterPreference,
  RADIATOR_EMITTER_PREFERENCE_SURVEY_UI_OPTIONS,
} from './types/radiatorEmitterPreference';
import { WarmFloorSection } from './components/WarmFloorSection/WarmFloorSection';
import { useRoomsOrchestration } from './hooks/useRoomsOrchestration';
import { useSurveyEstimates } from './hooks/useSurveyEstimates';
import { useSurveyProject } from './hooks/useSurveyProject';
import { ProjectsDialog } from './components/ProjectsDialog/ProjectsDialog';
import type { SurveyDraft } from './types/surveyDraft';
import type { UfhModePresetId, UfhModePresetCard } from './types/ufhModePreset';
import type { UnderfloorHeatingBasePreset, FlooringFinishMaterial } from './types/underfloorHeating';
import { useCatalogEquipmentQuery } from './query/queries/useCatalogEquipmentQuery';

const CALC_SCHEME_VALUES: readonly HotWaterBoilerPowerMatchingScheme[] = [
  ...HOT_WATER_BOILER_MATCHING_SCHEME_ENUM,
];

export type AppSurveyContentProps = {
  windowPresets: EnvelopePreset[];
  wallPresets: EnvelopePreset[];
  windowPresetsList: EnvelopePreset[];
  floorPresets: EnvelopePreset[];
  ceilingPresets: EnvelopePreset[];
  roofPresets: EnvelopePreset[];
  sftkInsulationPresets: EnvelopePreset[];
  ventilatedInsulationPresets: EnvelopePreset[];
  insulationPresets: EnvelopePreset[];
  presetsLoading: boolean;
  presetsError: string | null;
  underfloorHeatingBases: UnderfloorHeatingBasePreset[];
  flooringFinishes: FlooringFinishMaterial[];
  underfloorPresetsLoading: boolean;
  ufhModePresets: UfhModePresetCard[];
  ufhModePresetsLoading: boolean;
  ufhModePresetsError: string | null;
};

function isCalcMatchingScheme(
  v: string,
): v is HotWaterBoilerPowerMatchingScheme {
  return (CALC_SCHEME_VALUES as readonly string[]).includes(v);
}

export function AppSurveyContent({
  windowPresets,
  wallPresets,
  windowPresetsList,
  floorPresets,
  ceilingPresets,
  roofPresets,
  sftkInsulationPresets,
  ventilatedInsulationPresets,
  insulationPresets,
  presetsLoading,
  presetsError,
  underfloorHeatingBases,
  flooringFinishes,
  underfloorPresetsLoading,
  ufhModePresets,
  ufhModePresetsLoading,
  ufhModePresetsError,
}: AppSurveyContentProps) {
  const {
    dispatch,
    draft,
    report: calcReport,
    uiPhase,
    calcLoading,
    calcError,
    canAutoCalc,
    setReportFromProject,
    state: sessionState,
  } = useSurveySession();

  const {
    currentStep,
    objectMeta,
    rooms,
    temps,
    hotWaterForm,
    waterHeaterForm,
    waterUnderfloorHeating,
    underfloorDistributionPreset,
    thermalRegimePreset,
    radiatorConnection,
    radiatorEmitterPreference,
    ufhPresetId,
    hydraulicsForm,
    wiringLayoutV3,
  } = draft;

  const draftRef = useRef(draft);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const { catalogSnap, catalogSnapLoading, catalogSnapError, reloadCatalog } =
    useCatalogEquipmentQuery();

  const setCurrentStep = useCallback(
    (step: SurveyCurrentStep) => dispatch({ type: 'SET_CURRENT_STEP', step }),
    [dispatch],
  );

  const setObjectMeta = useCallback(
    (next: ObjectMetaValue | ((prev: ObjectMetaValue) => ObjectMetaValue)) => {
      const objectMetaValue =
        typeof next === 'function'
          ? next(draftRef.current.objectMeta)
          : next;
      if (objectMetaValue === draftRef.current.objectMeta) return;
      dispatch({ type: 'SET_OBJECT_META', objectMeta: objectMetaValue });
    },
    [dispatch],
  );

  const setRooms = useCallback(
    (next: RoomFormValue[] | ((prev: RoomFormValue[]) => RoomFormValue[])) => {
      const roomsNext =
        typeof next === 'function' ? next(draftRef.current.rooms) : next;
      if (roomsNext === draftRef.current.rooms) return;
      dispatch({ type: 'SET_ROOMS', rooms: roomsNext });
    },
    [dispatch],
  );

  const setTemps = useCallback(
    (
      next:
        | { insideC: number; outsideC: number; bathroomAirTempC?: number }
        | ((
            prev: { insideC: number; outsideC: number; bathroomAirTempC?: number },
          ) => { insideC: number; outsideC: number; bathroomAirTempC?: number }),
    ) => {
      const tempsNext =
        typeof next === 'function' ? next(draftRef.current.temps) : next;
      if (tempsNext === draftRef.current.temps) return;
      dispatch({ type: 'SET_TEMPS', temps: tempsNext });
    },
    [dispatch],
  );

  const setHotWaterForm = useCallback(
    (next: HotWaterFormValue | ((prev: HotWaterFormValue) => HotWaterFormValue)) => {
      const formNext =
        typeof next === 'function' ? next(draftRef.current.hotWaterForm) : next;
      if (formNext === draftRef.current.hotWaterForm) return;
      dispatch({ type: 'SET_HOT_WATER_FORM', hotWaterForm: formNext });
    },
    [dispatch],
  );

  const setHydraulicsForm = useCallback(
    (hydraulicsFormValue: HydraulicsFormValue) => {
      if (hydraulicsFormValue === draftRef.current.hydraulicsForm) return;
      dispatch({ type: 'SET_HYDRAULICS_FORM', hydraulicsForm: hydraulicsFormValue });
    },
    [dispatch],
  );

  const setWiringSystemType = useCallback(
    (systemType: WiringSystemType) => {
      if (systemType === draftRef.current.wiringLayoutV3.systemType) return;
      dispatch({ type: 'WIRING_SCHEME_SET', systemType });
    },
    [dispatch],
  );

  const setBranchLength = useCallback(
    (roomId: string, pipeLengthToEquipmentM: number) => {
      const prev = draftRef.current.wiringLayoutV3.branches.find(
        (b) => b.roomId === roomId,
      );
      if (prev?.pipeLengthToEquipmentM === pipeLengthToEquipmentM) return;
      dispatch({
        type: 'WIRING_BRANCH_LENGTH_SET',
        roomId,
        pipeLengthToEquipmentM,
      });
    },
    [dispatch],
  );

  const reorderBranch = useCallback(
    (roomId: string, direction: 'up' | 'down') => {
      dispatch({ type: 'WIRING_BRANCH_REORDER', roomId, direction });
    },
    [dispatch],
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

  const recommendedThermalRegimePreset = useMemo(
    () =>
      recommendedThermalRegimePresetForScheme(
        waterHeaterForm.hotWaterBoilerPowerMatchingScheme,
        objectMeta.objectType,
      ),
    [waterHeaterForm.hotWaterBoilerPowerMatchingScheme, objectMeta.objectType],
  );

  const thermalRegimeTouchedRef = useRef(sessionState.thermalRegimeTouched);

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
      dispatch({
        type: 'SET_THERMAL_REGIME_PRESET',
        preset: recommendedThermalRegimePreset,
      });
    });
  }, [dispatch, recommendedThermalRegimePreset]);

  useRoomsOrchestration({
    objectMeta,
    setObjectMeta,
    setRooms,
    wallPresets,
    floorPresets,
    ceilingPresets,
    roofPresets,
    windowPresets: windowPresetsList,
  });

  const { isRoomsComplete, quickEstimate } = useSurveyEstimates(rooms);

  const buildCalcPayload = useCallback(
    () => buildCalcPayloadFromDraft(draft, windowPresets),
    [draft, windowPresets],
  );

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

  const reportIsStale = uiPhase === 'recalculating';

  const {
    apiHeatLoss,
    apiHotWaterFromReport,
    apiBoilerFromReport,
    apiBoilerKw,
    apiRadiatorsFromReport,
    apiIndirectWhFromReport,
    apiElectricWhFromReport,
    apiUnderfloorHeatingFromReport,
    apiUniboxesFromReport,
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
    (loaded: SurveyDraft) => {
      dispatch({
        type: 'DRAFT_LOADED',
        draft: surveyDraftToSessionSnapshot(loaded),
        lastCalcReport: loaded.lastCalcReport ?? null,
      });
      thermalRegimeTouchedRef.current = true;
    },
    [dispatch],
  );

  /** Смена схемы из подсказок отчёта или формы водонагревателя. */
  const handleWaterHeaterSchemeChange = useCallback(
    (scheme: HotWaterBoilerPowerMatchingScheme) => {
      dispatch({
        type: 'SET_WATER_HEATER_FORM',
        waterHeaterForm: {
          ...waterHeaterForm,
          hotWaterBoilerPowerMatchingScheme: scheme,
          indirectDhwSpaceAvailable:
            objectMeta.objectType === 'apartment' &&
            scheme === SCHEME_BOILER_SINGLE_INDIRECT_SUM
              ? waterHeaterForm.indirectDhwSpaceAvailable
              : false,
        },
      });
    },
    [dispatch, objectMeta.objectType, waterHeaterForm],
  );

  const handleWaterHeaterFormChange = useCallback(
    (next: WaterHeaterFormValue) => {
      dispatch({ type: 'SET_WATER_HEATER_FORM', waterHeaterForm: next });
    },
    [dispatch],
  );

  const handleUfhPresetChange = useCallback(
    (next: UfhModePresetId | null) => {
      dispatch({ type: 'HEATING_EMITTERS_MODE_SET', presetId: next });
    },
    [dispatch],
  );

  const surveyProject = useSurveyProject({
    getDraftParams: () => ({
      currentStep: draft.currentStep,
      objectMeta: draft.objectMeta,
      rooms: draft.rooms,
      temps: draft.temps,
      hotWaterForm: draft.hotWaterForm,
      waterHeaterForm: draft.waterHeaterForm,
      waterUnderfloorHeating: draft.waterUnderfloorHeating,
      underfloorDistributionPreset: draft.underfloorDistributionPreset,
      thermalRegimePreset: draft.thermalRegimePreset,
      radiatorConnection: draft.radiatorConnection,
      radiatorEmitterPreference: draft.radiatorEmitterPreference,
      ufhPresetId: draft.ufhPresetId,
      hydraulicsForm: draft.hydraulicsForm,
      wiringLayoutV3: draft.wiringLayoutV3,
      lastCalcReport: calcReport,
    }),
    applyDraft: applySurveyDraftState,
    buildCalcPayload,
    canRunCalc: canAutoCalc,
    setCalcReport: setReportFromProject,
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

  const showCalcApiBar = isCalcApiBarStep(currentStep);

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
      dispatch({
        type: 'SET_WATER_HEATER_FORM',
        waterHeaterForm: {
          ...waterHeaterForm,
          hotWaterBoilerPowerMatchingScheme: SCHEME_BOILER_MAX_COMBI,
          indirectDhwSpaceAvailable: false,
        },
      });
    });
  }, [
    apartmentLargeForScheme,
    dispatch,
    hotWaterBoilerPowerMatchingScheme,
    objectMeta.objectType,
    waterHeaterForm,
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
              {SURVEY_STEP_NAV_ITEMS.map(({ step, label }) => (
                <li key={step}>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(step)}
                    aria-current={currentStep === step ? 'step' : undefined}
                    className={styles.stepButton}
                  >
                    {label}
                  </button>
                </li>
              ))}
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
              {surveyStepGlobalMetaTitle(currentStep)}
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
                <label className={styles.tempField}>
                  Воздух в санузле, °C
                  <input
                    type="number"
                    min={24}
                    max={35}
                    placeholder="≥24"
                    value={temps.bathroomAirTempC ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      setTemps((prev) => {
                        if (raw === '') {
                          const { bathroomAirTempC: _omit, ...rest } = prev;
                          return rest;
                        }
                        const n = Number(raw);
                        if (!Number.isFinite(n)) return prev;
                        return {
                          ...prev,
                          bathroomAirTempC: Math.max(24, Math.min(35, n)),
                        };
                      });
                    }}
                  />
                </label>
              </div>
            )}
            {currentStep === 'object' && (
              <p className={styles.hint} style={{ marginTop: 8 }}>
                «Воздух в санузле» — расчётная температура воздуха (не теплоноситель), не
                ниже 24 °C. Пусто = max(внутри, 24). Можно задать выше (например 26–28).
              </p>
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
                windowPresets={windowPresetsList}
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
                    dispatch({
                      type: 'SET_THERMAL_REGIME_PRESET',
                      preset: next,
                      touched: true,
                    });
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
                <label
                  className={styles.thermalRegimeLabel}
                  htmlFor="radiator-connection"
                  style={{ marginTop: 16, display: 'block' }}
                >
                  Подводка радиаторов
                </label>
                <select
                  id="radiator-connection"
                  className={styles.thermalRegimeSelect}
                  value={radiatorConnection}
                  onChange={(e) => {
                    if (!isRadiatorConnection(e.target.value)) return;
                    dispatch({
                      type: 'SET_RADIATOR_CONNECTION',
                      connection: e.target.value,
                    });
                  }}
                >
                  {RADIATOR_CONNECTION_SURVEY_UI_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className={styles.hint} style={{ marginTop: 8 }}>
                  Боковая — серии K/Klasik; нижняя — VK/VKP. Фильтрует панельный
                  пул. Тип прибора на весь объект задаётся отдельно. В API:{' '}
                  <code className={styles.inlineCode}>
                    heatingSystem.radiatorConnection
                  </code>
                  .
                </p>
                <label
                  className={styles.thermalRegimeLabel}
                  htmlFor="radiator-emitter-preference"
                  style={{ marginTop: 16, display: 'block' }}
                >
                  Тип радиаторов на объект
                </label>
                <select
                  id="radiator-emitter-preference"
                  className={styles.thermalRegimeSelect}
                  value={radiatorEmitterPreference}
                  onChange={(e) => {
                    if (!isRadiatorEmitterPreference(e.target.value)) return;
                    dispatch({
                      type: 'SET_RADIATOR_EMITTER_PREFERENCE',
                      preference: e.target.value,
                    });
                  }}
                >
                  {RADIATOR_EMITTER_PREFERENCE_SURVEY_UI_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className={styles.hint} style={{ marginTop: 8 }}>
                  Один тип приборов на все помещения (секции или панели). Авто —
                  Two-Pass по объекту. В API:{' '}
                  <code className={styles.inlineCode}>
                    heatingSystem.radiatorEmitterPreference
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
                wiringSystemType={wiringLayoutV3.systemType}
                onWiringSystemTypeChange={setWiringSystemType}
                branches={wiringLayoutV3.branches}
                rooms={rooms}
                onBranchLengthChange={setBranchLength}
                onBranchReorder={reorderBranch}
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
                  dispatch({ type: 'WATER_UFH_FLAG_SET', enabled: v });
                }}
                onDistributionPresetChange={(preset) => {
                  dispatch({ type: 'UFH_DISTRIBUTION_PRESET_SET', preset });
                }}
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
                    dispatch({ type: 'RUN_CALC_MANUAL' });
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
          apiUniboxesFromReport={apiUniboxesFromReport}
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
          reportIsStale={reportIsStale}
          uiPhase={uiPhase}
        />
      </div>

      <Footer version={`v${__APP_VERSION__}`} />
    </div>
  );
}

