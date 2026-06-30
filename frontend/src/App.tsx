/**
 * Назначение: Корень приложения — загрузчики справочников и SurveySessionProvider.
 */

import { useMemo } from 'react';

import { AppSurveyContent } from './AppSurveyContent';
import { useEnvelopePresetsLoader } from './hooks/useEnvelopePresetsLoader';
import { usePresetLists } from './hooks/usePresetLists';
import { useUfhModePresetsLoader } from './hooks/useUfhModePresetsLoader';
import { useUnderfloorHeatingPresetsLoader } from './hooks/useUnderfloorHeatingPresetsLoader';
import { createInitialSurveySessionState } from './surveySession/createInitialSurveySessionState';
import { SurveySessionProvider } from './surveySession/SurveySessionProvider';

function App() {
  const { envelopePresets, presetsLoading, presetsError } =
    useEnvelopePresetsLoader();

  const { underfloorHeatingBases, flooringFinishes, underfloorPresetsLoading } =
    useUnderfloorHeatingPresetsLoader();

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

  const {
    ufhModePresets,
    ufhModePresetsLoading,
    ufhModePresetsError,
  } = useUfhModePresetsLoader();

  const initialSessionState = useMemo(() => createInitialSurveySessionState(), []);

  return (
    <SurveySessionProvider
      initialState={initialSessionState}
      windowPresets={windowPresets}
    >
      <AppSurveyContent
        windowPresets={windowPresets}
        wallPresets={wallPresets}
        windowPresetsList={windowPresets}
        floorPresets={floorPresets}
        ceilingPresets={ceilingPresets}
        roofPresets={roofPresets}
        sftkInsulationPresets={sftkInsulationPresets}
        ventilatedInsulationPresets={ventilatedInsulationPresets}
        insulationPresets={insulationPresets}
        presetsLoading={presetsLoading}
        presetsError={presetsError}
        underfloorHeatingBases={underfloorHeatingBases}
        flooringFinishes={flooringFinishes}
        underfloorPresetsLoading={underfloorPresetsLoading}
        ufhModePresets={ufhModePresets}
        ufhModePresetsLoading={ufhModePresetsLoading}
        ufhModePresetsError={ufhModePresetsError}
      />
    </SurveySessionProvider>
  );
}

export default App;
