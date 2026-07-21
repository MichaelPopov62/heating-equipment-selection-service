/**
 * Назначение: Корень приложения — справочники (React Query) и SurveySessionProvider.
 */

import { useCallback, useMemo, useState } from 'react';

import { AppErrorBoundary } from './components/AppErrorBoundary/AppErrorBoundary';
import { SharePresentationPage } from './components/SharePresentationPage/SharePresentationPage';
import { AppRoot } from './AppRoot';
import { usePresetLists } from './hooks/usePresetLists';
import { useReferenceData } from './query/useReferenceData';
import { createEmptySurveySessionState } from './surveySession/createEmptySurveySessionState';
import { SurveySessionProvider } from './surveySession/SurveySessionProvider';
import type { AppBootstrapMode } from './surveySession/types';
import { parseShareTokenFromPath } from './utils/parseSharePath';

function App() {
  const shareToken = parseShareTokenFromPath(window.location.pathname);

  if (shareToken) {
    return (
      <AppErrorBoundary>
        <SharePresentationPage shareToken={shareToken} />
      </AppErrorBoundary>
    );
  }

  return <SurveyApp />;
}

/**
 * Редактор анкеты (не публичная ссылка).
 */
function SurveyApp() {
  const [calcEnabled, setCalcEnabled] = useState(false);

  const onBootstrapModeChange = useCallback((mode: AppBootstrapMode) => {
    setCalcEnabled(mode === 'survey');
  }, []);

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

  const initialSessionState = useMemo(() => createEmptySurveySessionState(), []);

  return (
    <AppErrorBoundary>
      <SurveySessionProvider
        initialState={initialSessionState}
        windowPresets={windowPresets}
        calcEnabled={calcEnabled}
      >
        <AppRoot
          onBootstrapModeChange={onBootstrapModeChange}
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
    </AppErrorBoundary>
  );
}

export default App;
