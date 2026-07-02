/**
 * Назначение: Корень приложения — справочники (React Query) и SurveySessionProvider.
 */

import { useMemo } from 'react';

import { AppSurveyContent } from './AppSurveyContent';
import { usePresetLists } from './hooks/usePresetLists';
import { useReferenceData } from './query/useReferenceData';
import { createInitialSurveySessionState } from './surveySession/createInitialSurveySessionState';
import { SurveySessionProvider } from './surveySession/SurveySessionProvider';

function App() {
  const {
    envelopePresets,
    presetsLoading,
    presetsError,
    underfloorHeatingBases,
    flooringFinishes,
    underfloorPresetsLoading,
    ufhModePresets,
    ufhModePresetsLoading,
    ufhModePresetsError,
  } = useReferenceData();

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
