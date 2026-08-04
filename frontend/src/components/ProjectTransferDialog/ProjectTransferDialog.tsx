/**
 * Назначение: модалка admin-переноса проєктів (import JSON / export зі списку).
 * Описание: один UI без N кнопок у рядках списку /projects.
 */

import { projectsUk } from '../../i18n/uk/projects';
import type { ProjectListItem } from '../../types/projectsApi';
import styles from './ProjectTransferDialog.module.css';

export type ProjectTransferDialogProps = {
  open: boolean;
  loading: boolean;
  projects: ProjectListItem[];
  showExportSection: boolean;
  showOwnerInExportList: boolean;
  importBusy: boolean;
  exportBusy: boolean;
  onClose: () => void;
  /** Імпорт — одразу file picker (без списку проєктів). */
  onImportClick: () => void;
  onExportProject: (projectId: string, clientName: string) => void;
};

/**
 * @param props
 */
export function ProjectTransferDialog({
  open,
  loading,
  projects,
  showExportSection,
  showOwnerInExportList,
  importBusy,
  exportBusy,
  onClose,
  onImportClick,
  onExportProject,
}: ProjectTransferDialogProps) {
  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-transfer-dialog-title"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <h2 id="project-transfer-dialog-title" className={styles.title}>
          {projectsUk.transferDialogTitle}
        </h2>

        <section className={styles.section} aria-labelledby="transfer-import-title">
          <h3 id="transfer-import-title" className={styles.sectionTitle}>
            {projectsUk.transferImportSection}
          </h3>
          <p className={styles.sectionHint}>{projectsUk.transferImportHint}</p>
          <button
            type="button"
            className={styles.primaryAction}
            disabled={importBusy}
            onClick={onImportClick}
          >
            {importBusy ? projectsUk.importBusy : projectsUk.transferImportPickFile}
          </button>
        </section>

        {showExportSection ? (
          <section className={styles.section} aria-labelledby="transfer-export-title">
            <h3 id="transfer-export-title" className={styles.sectionTitle}>
              {projectsUk.transferExportSection}
            </h3>
            <p className={styles.sectionHint}>{projectsUk.transferExportHint}</p>
            {loading ? (
              <p className={styles.muted}>{projectsUk.loading}</p>
            ) : projects.length === 0 ? (
              <p className={styles.muted}>{projectsUk.empty}</p>
            ) : (
              <ul className={styles.list}>
                {projects.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={styles.itemButton}
                      disabled={exportBusy}
                      onClick={() => {
                        onExportProject(p.id, p.clientName);
                      }}
                    >
                      {p.clientName}
                      {showOwnerInExportList && p.ownerEmail ? (
                        <span className={styles.itemOwner}>
                          {projectsUk.owner}: {p.ownerEmail}
                        </span>
                      ) : null}
                      <span className={styles.itemMeta}>
                        {p.calculationsCount ?? 0} {projectsUk.calculations} ·{' '}
                        {projectsUk.updated}{' '}
                        {new Date(p.updatedAt).toLocaleString('uk-UA')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        <button type="button" className={styles.closeButton} onClick={onClose}>
          {projectsUk.transferClose}
        </button>
      </div>
    </div>
  );
}
