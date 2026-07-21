/**
 * Назначение: Тело анкеты (шаги, формы, отчёт).
 * Описание: Все мутации через SurveySession.dispatch и единый pipeline.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';

import { Header } from './components/Header/Header';
import type { HeaderProps } from './components/Header/Header';
import { Footer } from './components/Footer/Footer';
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
import { useSurveyStepNavigation } from './hooks/useSurveyStepNavigation';
import { HydraulicsSection } from './components/HydraulicsSection/HydraulicsSection';
import type { HydraulicsFormValue } from './types/hydraulics';
import type { WiringSystemType } from './surveySession/wiringLayoutV3';
import {
  SURVEY_STEP_NAV_ITEMS,
  surveyStepGlobalMetaTitle,
} from './constants/surveySteps';
import { RESULTS_SECTION_IDS } from './constants/surveyResultsSections';
import type { SurveyCurrentStep } from './types/surveyStep';
import { useCalcReport } from './hooks/useCalcReport';
import { useSurveySession } from './surveySession/useSurveySession';
import { RecommendationsBlock } from './components/RecommendationsBlock/RecommendationsBlock';
import { CatalogEquipmentReference } from './components/CatalogEquipmentReference/CatalogEquipmentReference';
import { FinancialSummaryTable } from './components/FinancialSummary/FinancialSummaryTable';
import {
  HOT_WATER_BOILER_MATCHING_SCHEME_ENUM,
  SCHEME_BOILER_MAX_COMBI,
  SCHEME_BOILER_SINGLE_INDIRECT_SUM,
  type HotWaterBoilerPowerMatchingScheme,
} from './types/heatingMatching';
import {
  recommendedThermalRegimePresetForScheme,
  thermalRegimeRecommendationHint,
} from './types/heatingThermalRegime';
import { BoilerSurveyForm } from './components/BoilerSurveyForm/BoilerSurveyForm';
import { RadiatorsSurveyForm } from './components/RadiatorsSurveyForm/RadiatorsSurveyForm';
import { WarmFloorSection } from './components/WarmFloorSection/WarmFloorSection';
import { useRoomsOrchestration } from './hooks/useRoomsOrchestration';
import { useSurveyEstimates } from './hooks/useSurveyEstimates';
import type { UfhModePresetId, UfhModePresetCard } from './types/ufhModePreset';
import type { UnderfloorHeatingBasePreset, FlooringFinishMaterial } from './types/underfloorHeating';
import { useCatalogEquipmentQuery } from './query/queries/useCatalogEquipmentQuery';

const CALC_SCHEME_VALUES: readonly HotWaterBoilerPowerMatchingScheme[] = [
  ...HOT_WATER_BOILER_MATCHING_SCHEME_ENUM,
];

export type AppSurveyContentProps = {
  projectChrome: HeaderProps;
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
  projectChrome,
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
    (step: SurveyCurrentStep) => { dispatch({ type: 'SET_CURRENT_STEP', step }); },
    [dispatch],
  );

  const { mainColumnRef, navigateToSurveyStep, navigateToResultsSection } =
    useSurveyStepNavigation({
      setCurrentStep,
    });

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

  const { quickEstimate } = useSurveyEstimates(rooms);

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
    apiCommercialBomFromReport,
    displayedRadiatorSectionsTotal,
    apiCatalogSource,
    apiAutomationHints,
  } = useCalcReport(
    calcReport,
    isCalcMatchingScheme,
    quickEstimate.radiatorsSections,
    ufhPresetId,
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
      <Header {...projectChrome} variant="survey" />

      <div className={styles.layoutBody}>
        <aside className={styles.navigationSteps}>
          <nav aria-label="Этапы анкеты">
            {/* Навигация по шагам (пока без роутинга) */}
            <ul className={styles.stepList}>
              {SURVEY_STEP_NAV_ITEMS.map(({ step, label }) => (
                <li key={step}>
                  <button
                    type="button"
                    onClick={() => { setCurrentStep(step); }}
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

        <main ref={mainColumnRef} className={styles.mainColumn}>
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
                Задайте график подачи/обратки радиаторного контура (пресет под
                тип котла). Подводка и тип приборов — на шаге «Радиаторы».
                Сценарий ГВС и подбор БКН/электробойлера — на шаге
                «Водонагреватель».
              </p>
            )}

            {currentStep === 'radiators' && (
              <p className={styles.hint} style={{ marginTop: 8 }}>
                Подводка (боковая / нижняя) фильтрует панельный пул; тип
                приборов задаётся один на весь объект. График 75/65 или 55/45 —
                на шаге «Котёл».
              </p>
            )}

            {currentStep === 'waterHeater' && (
              <p className={styles.hint} style={{ marginTop: 8 }}>
                Выберите стратегию ГВС: от этого зависят подбор бойлера
                косвенного нагрева или электронакопителя и формула мощности
                котла. Изменения пересчитываются автоматически.
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
                      { setTemps((prev) => ({
                        ...prev,
                        insideC: Number(e.target.value),
                      })); }
                    }
                  />
                </label>
                <label className={styles.tempField}>
                  Снаружи, °C
                  <input
                    type="number"
                    value={temps.outsideC}
                    onChange={(e) =>
                      { setTemps((prev) => ({
                        ...prev,
                        outsideC: Number(e.target.value),
                      })); }
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
              <HotWaterForm
                value={hotWaterForm}
                onChange={setHotWaterForm}
                hotWaterReport={apiHotWaterFromReport}
                calcLoading={calcLoading}
                onBackToResults={() => {
                  navigateToResultsSection(RESULTS_SECTION_IDS.hotWater);
                }}
              />
            )}

            {currentStep === 'boiler' && (
              <BoilerSurveyForm
                thermalRegimePreset={thermalRegimePreset}
                onThermalRegimeChange={(preset) => {
                  thermalRegimeTouchedRef.current = true;
                  dispatch({
                    type: 'SET_THERMAL_REGIME_PRESET',
                    preset,
                    touched: true,
                  });
                }}
                thermalRegimeRecommendationHintText={
                  thermalRegimeRecommendationHintText
                }
                ufhOnlyMode={ufhPresetId === 'ufh_only'}
                boilerMatching={apiBoilerFromReport}
                objectType={objectMeta.objectType}
                catalogSource={apiCatalogSource}
                calcLoading={calcLoading}
                onBackToResults={() => {
                  navigateToResultsSection(RESULTS_SECTION_IDS.boiler);
                }}
              />
            )}

            {currentStep === 'radiators' && (
              <RadiatorsSurveyForm
                radiatorConnection={radiatorConnection}
                radiatorEmitterPreference={radiatorEmitterPreference}
                onConnectionChange={(connection) => {
                  dispatch({
                    type: 'SET_RADIATOR_CONNECTION',
                    connection,
                  });
                }}
                onPreferenceChange={(preference) => {
                  dispatch({
                    type: 'SET_RADIATOR_EMITTER_PREFERENCE',
                    preference,
                  });
                }}
                radiatorsDisabledReason={
                  ufhPresetId === 'ufh_only'
                    ? 'Режим «только тёплый пол» (ufh_only): подбор радиаторов на сервере пропускается. Значения подводки и типа приборов сохраняются в черновике и уходят в heatingSystem, но на matching.radiators не влияют, пока выбран этот режим.'
                    : null
                }
                radiatorsMatching={apiRadiatorsFromReport}
                calcLoading={calcLoading}
                onBackToResults={() => {
                  navigateToResultsSection(RESULTS_SECTION_IDS.radiators);
                }}
              />
            )}

            {currentStep === 'waterHeater' && (
              <WaterHeaterForm
                value={waterHeaterForm}
                onChange={handleWaterHeaterFormChange}
                objectType={objectMeta.objectType}
                apartmentLarge={apartmentLargeForScheme}
                hotWaterForm={hotWaterForm}
                calcLoading={calcLoading}
                indirectMatching={apiIndirectWhFromReport}
                electricMatching={apiElectricWhFromReport}
                onBackToResults={() => {
                  navigateToResultsSection(RESULTS_SECTION_IDS.waterHeater);
                }}
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
                hydraulicsReport={apiHydraulicsFromReport}
                catalogSource={apiCatalogSource}
                calcLoading={calcLoading}
                onBackToResults={() => {
                  navigateToResultsSection(RESULTS_SECTION_IDS.hydraulics);
                }}
              />
            )}

            {currentStep === 'technicalResult' && (
              <RecommendationsBlock
                quickEstimate={quickEstimate}
                apiHeatLoss={apiHeatLoss}
                apiHotWaterFromReport={apiHotWaterFromReport}
                hotWaterFixtures={hotWaterForm.fixtures}
                waterHeaterScheme={waterHeaterForm.hotWaterBoilerPowerMatchingScheme}
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
                onApplyScheme={handleWaterHeaterSchemeChange}
                apiHydraulicsFromReport={apiHydraulicsFromReport}
                calcLoading={calcLoading}
                reportIsStale={reportIsStale}
                uiPhase={uiPhase}
                onNavigateToSurveyStep={navigateToSurveyStep}
              />
            )}

            {currentStep === 'dataReference' && (
              <CatalogEquipmentReference
                snapshot={catalogSnap}
                loading={catalogSnapLoading}
                error={catalogSnapError}
                onRetry={() => {
                  void reloadCatalog();
                }}
              />
            )}

            {currentStep === 'financialResult' && (
              <FinancialSummaryTable
                commercial={apiCommercialBomFromReport}
                calcLoading={calcLoading}
                reportIsStale={reportIsStale}
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
                underfloorHeatingReport={apiUnderfloorHeatingFromReport}
                uniboxesReport={apiUniboxesFromReport}
                hydraulicsPumps={apiHydraulicsFromReport?.proposal?.pumps ?? null}
                onBackToResults={() => {
                  navigateToResultsSection(RESULTS_SECTION_IDS.warmFloor);
                }}
              />
            )}

            <div style={{ marginTop: 16 }}>
              {calcLoading && <div className={styles.hint}>Расчёт…</div>}
              {calcError && (
                <div style={{ marginTop: 8, color: 'crimson' }}>
                  {calcError}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>

      <Footer version={`v${__APP_VERSION__}`} />
    </div>
  );
}

