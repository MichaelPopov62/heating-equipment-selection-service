/**
 * Назначение: Модальный диалог проектов.
 * Описание: Выбор сохранённых проектов и расчётов с сервера, загрузка и удаление.
 */

import type { CalculationListItem, ProjectListItem } from '../../types/projectsApi';
import styles from './ProjectsDialog.module.css';

export type ProjectsDialogProps = {
  open: boolean;
  loading: boolean;
  projects: ProjectListItem[];
  calculations: CalculationListItem[];
  activeProjectId: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onNewProject: () => void;
  onSelectProject: (id: string) => void;
  onSelectCalculation: (calcId: string) => void;
};

export function ProjectsDialog({
  open,
  loading,
  projects,
  calculations,
  activeProjectId,
  onClose,
  onRefresh,
  onNewProject,
  onSelectProject,
  onSelectCalculation,
}: ProjectsDialogProps) {
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
        aria-labelledby="projects-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="projects-dialog-title" className={styles.title}>
          Проекты клиентов
        </h2>
        <div className={styles.toolbar}>
          <button type="button" className={styles.itemButton} onClick={onRefresh}>
            Обновить список
          </button>
          <button type="button" className={styles.itemButton} onClick={onNewProject}>
            Новый проект
          </button>
        </div>
        {loading ? (
          <p className={styles.muted}>Загрузка…</p>
        ) : projects.length === 0 ? (
          <p className={styles.muted}>
            Нет сохранённых проектов. Укажите имя клиента и нажмите «Сохранить → На сервер».
          </p>
        ) : (
          <ul className={styles.list}>
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={styles.itemButton}
                  onClick={() => onSelectProject(p.id)}
                >
                  {p.clientName}
                  <span className={styles.itemMeta}>
                    {p.calculationsCount ?? 0} расчёт(ов) · обновлён{' '}
                    {new Date(p.updatedAt).toLocaleString('ru-RU')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {activeProjectId && calculations.length > 0 ? (
          <section className={styles.calcSection}>
            <h3 className={styles.calcTitle}>Расчёты текущего проекта</h3>
            <ul className={styles.list}>
              {calculations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={styles.itemButton}
                    onClick={() => onSelectCalculation(c.id)}
                  >
                    {c.summary.generatedAt
                      ? new Date(c.summary.generatedAt).toLocaleString('ru-RU')
                      : new Date(c.createdAt).toLocaleString('ru-RU')}
                    <span className={styles.itemMeta}>
                      {c.summary.heatLossKw != null
                        ? `теплопотери ${c.summary.heatLossKw} кВт`
                        : ''}
                      {c.summary.boilerModel ? ` · ${c.summary.boilerModel}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <button type="button" className={`${styles.itemButton} ${styles.closeButton}`} onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
}
