/**
 * Назначение: мост навигации ProjectsPage → AppRoot через sessionStorage.
 */

const PENDING_PROJECT_KEY = 'heatcalc:pending-project-load:v1';
const PENDING_CALCULATION_KEY = 'heatcalc:pending-calculation-load:v1';
const PENDING_NEW_PROJECT_KEY = 'heatcalc:pending-new-project:v1';

export type PendingProjectNavigation =
  | { kind: 'project'; projectId: string }
  | { kind: 'calculation'; calculationId: string }
  | { kind: 'newProject' };

/**
 * @param projectId
 */
export function queuePendingProjectLoad(projectId: string): void {
  sessionStorage.setItem(PENDING_PROJECT_KEY, projectId);
  sessionStorage.removeItem(PENDING_NEW_PROJECT_KEY);
}

/**
 * Поставить в очередь «новий проєкт» на головній.
 */
export function queuePendingNewProject(): void {
  sessionStorage.setItem(PENDING_NEW_PROJECT_KEY, '1');
  sessionStorage.removeItem(PENDING_PROJECT_KEY);
}

/**
 * @returns {PendingProjectNavigation | null}
 */
export function consumePendingProjectNavigation(): PendingProjectNavigation | null {
  const newProject = sessionStorage.getItem(PENDING_NEW_PROJECT_KEY);
  if (newProject) {
    sessionStorage.removeItem(PENDING_NEW_PROJECT_KEY);
    return { kind: 'newProject' };
  }

  const projectId = sessionStorage.getItem(PENDING_PROJECT_KEY)?.trim();
  if (projectId) {
    sessionStorage.removeItem(PENDING_PROJECT_KEY);
    return { kind: 'project', projectId };
  }

  const calculationId = sessionStorage.getItem(PENDING_CALCULATION_KEY)?.trim();
  if (calculationId) {
    sessionStorage.removeItem(PENDING_CALCULATION_KEY);
    return { kind: 'calculation', calculationId };
  }

  return null;
}
