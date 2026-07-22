/**
 * Назначение: оболочка SurveyApp с session provider для home и projects.
 */

import { useCallback, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { AppErrorBoundary } from '../components/AppErrorBoundary/AppErrorBoundary';
import { AppRoot } from '../AppRoot';
import { usePresetLists } from '../hooks/usePresetLists';
import { useReferenceData } from '../query/useReferenceData';
import { createEmptySurveySessionState } from '../surveySession/createEmptySurveySessionState';
import { SurveySessionProvider } from '../surveySession/SurveySessionProvider';
import type { AppBootstrapMode } from '../surveySession/types';
import { paths } from './paths';

export type SurveyAppShellProps = {
  children?: React.ReactNode;
};

/**
 * @param props — optional nested route (ProjectsPage)
 */
export function SurveyAppShell({ children }: SurveyAppShellProps) {
  const location = useLocation();
  const isHome = location.pathname === paths.home;
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
        {children ?? (
          isHome ? (
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
          ) : null
        )}
      </SurveySessionProvider>
    </AppErrorBoundary>
  );
}
