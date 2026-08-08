/**
 * Назначение: лёгкий UI cold open — start / resolving / error без survey/projects/calc.
 */

import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';

import { brandUk } from './i18n/uk/brand';
import { paths } from './routing/paths';
import { useAppChrome } from './shell/useAppChrome';
import { AccountBar } from './components/AccountBar/AccountBar';
import { AppBootstrapSkeleton } from './components/AppBootstrapSkeleton/AppBootstrapSkeleton';
import { BootstrapErrorScreen } from './components/BootstrapErrorScreen/BootstrapErrorScreen';
import { DevToolsDock } from './components/DevToolsDock/DevToolsDock';
import { Header } from './components/Header/Header';
import Logo from './components/Logo/Logo';
import { StartScreen } from './components/StartScreen/StartScreen';
import { useDevPanelAccess } from './hooks/useDevPanelAccess';
import styles from './App.module.css';
import type { AppBootstrapMode } from './surveySession/types';

export type StartAppRootProps = {
  bootstrapMode: Extract<AppBootstrapMode, 'start' | 'resolving' | 'error'>;
  onStartNew: () => void;
  onRetryBootstrap: () => void;
};

/**
 * @param props
 */
export function StartAppRoot({
  bootstrapMode,
  onStartNew,
  onRetryBootstrap,
}: StartAppRootProps) {
  const navigate = useNavigate();
  const appChrome = useAppChrome();
  const { showDevToolsDock } = useDevPanelAccess();

  const handleOpenProjects = useCallback(() => {
    void navigate(paths.projects);
  }, [navigate]);

  useEffect(() => {
    if (bootstrapMode !== 'start') return;
    appChrome.registerFooterActions({
      onNewCalculation: onStartNew,
      onOpenProjects: handleOpenProjects,
    });
    return () => {
      appChrome.unregisterFooterActions();
    };
  }, [appChrome, bootstrapMode, handleOpenProjects, onStartNew]);

  const devToolsDock = showDevToolsDock ? <DevToolsDock /> : null;

  if (bootstrapMode === 'resolving') {
    return (
      <>
        <AppBootstrapSkeleton />
        {devToolsDock}
      </>
    );
  }

  if (bootstrapMode === 'error') {
    return (
      <>
        <BootstrapErrorScreen onRetry={onRetryBootstrap} />
        {devToolsDock}
      </>
    );
  }

  return (
    <div className={styles.appContainer}>
      <Header
        logo={<Logo />}
        title={brandUk.name}
        accountSlot={<AccountBar compact />}
        variant="start"
        clientName=""
        onClientNameChange={() => undefined}
        onOpenProjects={handleOpenProjects}
        onSaveProject={() => undefined}
        onExit={() => undefined}
        onCopyPublicLink={() => undefined}
        onPrintPdf={() => undefined}
      />
      <StartScreen onStartNew={onStartNew} />
      {devToolsDock}
    </div>
  );
}
