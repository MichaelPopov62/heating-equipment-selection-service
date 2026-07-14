/**
 * Назначение: Компонент шапки приложения.
 * Описание: Имя клиента, меню сохранения/экспорта и действия с проектами и расчётами.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import styles from './Header.module.css';

export type HeaderMenuId = 'save' | 'export';

export type HeaderProps = {
  logo?: React.ReactNode;
  title: string;
  clientName: string;
  onClientNameChange: (value: string) => void;
  projectId?: string | null;
  statusMessage?: string | null;
  statusError?: string | null;
  onOpenFile: () => void;
  onSaveFile: () => void;
  onSaveServer: () => void;
  onSaveServerWithCalc: () => void;
  onExportText: () => void;
  onExportShare: () => void;
  onExportLink: () => void;
  onOpenProjects: () => void;
};

export function Header({
  logo,
  title,
  clientName,
  onClientNameChange,
  projectId,
  statusMessage,
  statusError,
  onOpenFile,
  onSaveFile,
  onSaveServer,
  onSaveServerWithCalc,
  onExportText,
  onExportShare,
  onExportLink,
  onOpenProjects,
}: HeaderProps) {
  const [openMenu, setOpenMenu] = useState<HeaderMenuId | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);

  const closeMenus = useCallback(() => { setOpenMenu(null); }, []);

  const toggleMenu = useCallback((id: HeaderMenuId) => {
    setOpenMenu((prev) => (prev === id ? null : id));
  }, []);

  useEffect(() => {
    if (!openMenu) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (target instanceof Node && controlsRef.current?.contains(target)) return;
      setOpenMenu(null);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenu]);

  const runMenuAction = useCallback(
    (action: () => void) => {
      action();
      closeMenus();
    },
    [closeMenus],
  );

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <div className={styles.logoSlot} aria-hidden={logo ? undefined : 'true'}>
          {logo ?? <div className={styles.logoMark} aria-hidden="true" />}
        </div>
        <div className={styles.titles}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>
            Сервис расчёта и подбора отопительного оборудования
            {projectId ? (
              <>
                {' '}
                · <span className={styles.projectId}>проект {projectId.slice(-6)}</span>
              </>
            ) : null}
          </p>
          {statusMessage ? (
            <p className={styles.statusOk} role="status">
              {statusMessage}
            </p>
          ) : null}
          {statusError ? (
            <p className={styles.statusErr} role="alert">
              {statusError}
            </p>
          ) : null}
        </div>
      </div>

      <div ref={controlsRef} className={styles.controls} aria-label="Панель управления">
        <input
          type="text"
          className={styles.clientInput}
          value={clientName}
          onChange={(e) => { onClientNameChange(e.target.value); }}
          placeholder="Имя клиента"
          maxLength={200}
          autoComplete="off"
          aria-label="Имя клиента"
        />

        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => {
            closeMenus();
            onOpenFile();
          }}
        >
          Открыть
        </button>

        <div className={styles.menu}>
          <button
            type="button"
            className={`${styles.secondaryButton} ${openMenu === 'save' ? styles.menuTriggerActive : ''}`}
            aria-expanded={openMenu === 'save'}
            aria-haspopup="menu"
            onClick={() => { toggleMenu('save'); }}
          >
            Сохранить
          </button>
          {openMenu === 'save' ? (
            <div className={styles.menuPanel} role="menu">
              <button type="button" role="menuitem" onClick={() => { runMenuAction(onSaveFile); }}>
                В файл (JSON)
              </button>
              <button type="button" role="menuitem" onClick={() => { runMenuAction(onSaveServer); }}>
                На сервер
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => { runMenuAction(onSaveServerWithCalc); }}
              >
                На сервер + расчёт
              </button>
            </div>
          ) : null}
        </div>

        <div className={styles.menu}>
          <button
            type="button"
            className={
              openMenu === 'export'
                ? `${styles.primaryButton} ${styles.menuTriggerActivePrimary}`
                : styles.secondaryButton
            }
            aria-expanded={openMenu === 'export'}
            aria-haspopup="menu"
            onClick={() => { toggleMenu('export'); }}
          >
            Экспорт
          </button>
          {openMenu === 'export' ? (
            <div className={styles.menuPanel} role="menu">
              <button type="button" role="menuitem" onClick={() => { runMenuAction(onExportText); }}>
                Текстовый файл
              </button>
              <button type="button" role="menuitem" onClick={() => { runMenuAction(onExportShare); }}>
                Поделиться…
              </button>
              <button type="button" role="menuitem" onClick={() => { runMenuAction(onExportLink); }}>
                Ссылка (копировать)
              </button>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => {
            closeMenus();
            onOpenProjects();
          }}
        >
          Проекты
        </button>
      </div>
    </header>
  );
}
