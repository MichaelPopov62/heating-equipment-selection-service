/**
 * Назначение: страница проектов (prod SaaS, /projects).
 */

import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { AccountBar } from '../../components/AccountBar/AccountBar';
import { Footer } from '../../components/Footer/Footer';
import { ProjectTransferDialog } from '../../components/ProjectTransferDialog/ProjectTransferDialog';
import { useProjectBundleTransfer } from '../../hooks/useProjectBundleTransfer';
import { projectsUk } from '../../i18n/uk/projects';
import { useMeQuery } from '../../query/queries/useMeQuery';
import { useProjectsListQuery } from '../../query/queries/useProjectsListQuery';
import { paths } from '../../routing/paths';
import { isDevToolsBuildEnabled } from '../../utils/isDevToolsEnabled';
import {
  queuePendingNewProject,
  queuePendingProjectLoad,
} from '../../utils/pendingProjectNavigation';
import styles from './ProjectsPage.module.css';

/** Действия toolbar / списка — одна dispatch-функция. */
type ProjectsPageAction =
  | { type: 'refresh' }
  | { type: 'newProject' }
  | { type: 'openSurvey' }
  | { type: 'openTransferDialog' }
  | { type: 'closeTransferDialog' }
  | { type: 'openProject'; projectId: string };

/**
 * Список проектов клиентов с переходом в анкету.
 */
export function ProjectsPage() {
  const navigate = useNavigate();
  const { user: meUser } = useMeQuery();
  const isAdmin = meUser?.role === 'admin';
  const showExportInTransfer = isDevToolsBuildEnabled();
  const { projectList, projectsLoading, refetch } = useProjectsListQuery({ enabled: true });
  const [transferOpen, setTransferOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const notifyStatus = useCallback((message: string | null, error: string | null) => {
    setStatusMessage(message);
    setStatusError(error);
    if (message) {
      window.setTimeout(() => {
        setStatusMessage(null);
      }, 5000);
    }
  }, []);

  const {
    fileInputRef,
    handleFileInputChange,
    requestImport,
    sendProjectBundle,
    importBusy,
    exportBusy,
  } = useProjectBundleTransfer({
    onImportSuccess: async () => {
      await refetch();
      setTransferOpen(false);
    },
    onStatus: notifyStatus,
  });

  const handlePageAction = useCallback(
    (action: ProjectsPageAction) => {
      switch (action.type) {
        case 'refresh':
          void refetch();
          break;
        case 'newProject':
          queuePendingNewProject();
          void navigate(paths.home);
          break;
        case 'openSurvey':
          void navigate(paths.home);
          break;
        case 'openTransferDialog':
          setTransferOpen(true);
          break;
        case 'closeTransferDialog':
          setTransferOpen(false);
          break;
        case 'openProject':
          queuePendingProjectLoad(action.projectId);
          void navigate(paths.home);
          break;
        default: {
          const _exhaustive: never = action;
          void _exhaustive;
        }
      }
    },
    [navigate, refetch],
  );

  const handleImportFromDialog = useCallback(() => {
    requestImport();
  }, [requestImport]);

  const handleExportFromDialog = useCallback(
    (projectId: string, clientName: string) => {
      void sendProjectBundle({ projectId, clientName });
    },
    [sendProjectBundle],
  );

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.backRow}>
          <Link to={paths.home} className={styles.backLink}>
            ← {projectsUk.backHome}
          </Link>
        </div>
        <h1 className={styles.title}>{projectsUk.title}</h1>
        <AccountBar className={styles.accountBar} />
        {isAdmin ? (
          <p className={styles.adminHint}>{projectsUk.adminAllProjectsHint}</p>
        ) : null}
        {statusMessage ? <p className={styles.statusOk}>{statusMessage}</p> : null}
        {statusError ? <p className={styles.statusErr}>{statusError}</p> : null}
        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              handlePageAction({ type: 'refresh' });
            }}
          >
            {projectsUk.refresh}
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={() => {
              handlePageAction({ type: 'newProject' });
            }}
          >
            {projectsUk.newProject}
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              handlePageAction({ type: 'openSurvey' });
            }}
          >
            {projectsUk.openSurvey}
          </button>
          {isAdmin ? (
            <button
              type="button"
              className={styles.button}
              onClick={() => {
                handlePageAction({ type: 'openTransferDialog' });
              }}
            >
              {projectsUk.transferProject}
            </button>
          ) : null}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className={styles.hiddenFileInput}
          onChange={handleFileInputChange}
        />

        <ProjectTransferDialog
          open={transferOpen}
          loading={projectsLoading}
          projects={projectList}
          showExportSection={showExportInTransfer}
          showOwnerInExportList={isAdmin}
          importBusy={importBusy}
          exportBusy={exportBusy}
          onClose={() => {
            handlePageAction({ type: 'closeTransferDialog' });
          }}
          onImportClick={handleImportFromDialog}
          onExportProject={handleExportFromDialog}
        />

        {projectsLoading ? (
          <p className={styles.muted}>{projectsUk.loading}</p>
        ) : projectList.length === 0 ? (
          <p className={styles.muted}>{projectsUk.empty}</p>
        ) : (
          <ul className={styles.list}>
            {projectList.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={styles.itemButton}
                  onClick={() => {
                    handlePageAction({ type: 'openProject', projectId: p.id });
                  }}
                >
                  {p.clientName}
                  {isAdmin && p.ownerEmail ? (
                    <span className={styles.itemOwner}>
                      {projectsUk.owner}: {p.ownerEmail}
                    </span>
                  ) : null}
                  <span className={styles.itemMeta}>
                    {p.calculationsCount ?? 0} {projectsUk.calculations} · {projectsUk.updated}{' '}
                    {new Date(p.updatedAt).toLocaleString('uk-UA')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer variant="app" />
    </div>
  );
}
