/**
 * Назначение: страница проектов (prod SaaS, /projects).
 */

import { Link, useNavigate } from 'react-router-dom';

import { AuthSessionBar } from '../../components/AuthSessionBar/AuthSessionBar';
import { Footer } from '../../components/Footer/Footer';
import { projectsUk } from '../../i18n/uk/projects';
import { useProjectsListQuery } from '../../query/queries/useProjectsListQuery';
import { paths } from '../../routing/paths';
import {
  queuePendingNewProject,
  queuePendingProjectLoad,
} from '../../utils/pendingProjectNavigation';
import styles from './ProjectsPage.module.css';

/**
 * Список проектов клиентов с переходом в анкету.
 */
export function ProjectsPage() {
  const navigate = useNavigate();
  const { projectList, projectsLoading, refetch } = useProjectsListQuery({ enabled: true });

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.backRow}>
          <Link to={paths.home} className={styles.backLink}>
            ← {projectsUk.backHome}
          </Link>
        </div>
        <h1 className={styles.title}>{projectsUk.title}</h1>
        <AuthSessionBar className={styles.sessionBar} />
        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              void refetch();
            }}
          >
            {projectsUk.refresh}
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={() => {
              queuePendingNewProject();
              void navigate(paths.home);
            }}
          >
            {projectsUk.newProject}
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              void navigate(paths.home);
            }}
          >
            {projectsUk.openSurvey}
          </button>
        </div>

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
                    queuePendingProjectLoad(p.id);
                    void navigate(paths.home);
                  }}
                >
                  {p.clientName}
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
