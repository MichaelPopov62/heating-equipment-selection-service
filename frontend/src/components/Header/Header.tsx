/**
 * Назначение: клиентская шапка — публичная ссылка и скачивание PDF (без pop-up).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { ShareLinkToast } from '../ShareLinkToast/ShareLinkToast';
import styles from './Header.module.css';

export type HeaderProps = {
  logo?: React.ReactNode;
  title: string;
  /** start — только «Проекты»; survey — полная клиентская панель. */
  variant?: 'start' | 'survey';
  clientName: string;
  onClientNameChange: (value: string) => void;
  projectId?: string | null;
  statusMessage?: string | null;
  statusError?: string | null;
  /** Есть ли отчёт с commercial для PDF. */
  canPrintPdf?: boolean;
  /** Есть ли projectId и отчёт для публикации ссылки. */
  canPublishShare?: boolean;
  /** Публикация публичной ссылки в процессе. */
  shareBusy?: boolean;
  /** Toast «ссылка скопирована» под кнопкой «Ссылка». */
  shareToastOpen?: boolean;
  onDismissShareToast?: () => void;
  onOpenProjects: () => void;
  /** Выход на стартовый экран (без skeleton). */
  onExit: () => void;
  onCopyPublicLink: () => void;
  onPrintPdf: (includeTechnical: boolean) => void;
};

export function Header({
  logo,
  title,
  variant = 'survey',
  clientName,
  onClientNameChange,
  projectId,
  statusMessage,
  statusError,
  canPrintPdf = false,
  canPublishShare = false,
  shareBusy = false,
  shareToastOpen = false,
  onDismissShareToast,
  onOpenProjects,
  onExit,
  onCopyPublicLink,
  onPrintPdf,
}: HeaderProps) {
  const [pdfMenuOpen, setPdfMenuOpen] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);

  const closeMenus = useCallback(() => {
    setPdfMenuOpen(false);
  }, []);

  useEffect(() => {
    if (!pdfMenuOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (target instanceof Node && controlsRef.current?.contains(target)) return;
      setPdfMenuOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPdfMenuOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pdfMenuOpen]);

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
                · <span className={styles.projectId}>проект сохранён</span>
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
        {variant === 'survey' ? (
          <input
            type="text"
            className={styles.clientInput}
            value={clientName}
            onChange={(e) => {
              onClientNameChange(e.target.value);
            }}
            placeholder="Имя клиента"
            maxLength={200}
            autoComplete="off"
            aria-label="Имя клиента"
          />
        ) : null}

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

        {variant === 'survey' ? (
          <>
            <div className={styles.shareLinkWrap}>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={!canPublishShare || shareBusy}
                aria-busy={shareBusy}
                title={
                  shareBusy
                    ? 'Публикация публичной ссылки…'
                    : canPublishShare
                      ? 'Скопировать публичную ссылку на смету'
                      : 'Сначала сохраните проект с расчётом на сервере (Dev) или опубликуйте ссылку'
                }
                onClick={() => {
                  closeMenus();
                  onCopyPublicLink();
                }}
              >
                {shareBusy ? 'Публикация…' : 'Ссылка'}
              </button>
              {onDismissShareToast ? (
                <ShareLinkToast open={shareToastOpen} onDismiss={onDismissShareToast} />
              ) : null}
            </div>

            <div className={styles.menu}>
              <button
                type="button"
                className={
                  pdfMenuOpen
                    ? `${styles.primaryButton} ${styles.menuTriggerActivePrimary}`
                    : styles.primaryButton
                }
                disabled={!canPrintPdf}
                aria-expanded={pdfMenuOpen}
                aria-haspopup="menu"
                onClick={() => {
                  setPdfMenuOpen((v) => !v);
                }}
              >
                PDF / Скачать
              </button>
              {pdfMenuOpen ? (
                <div className={styles.menuPanel} role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onPrintPdf(false);
                      closeMenus();
                    }}
                  >
                    Финансовый итог (PDF)
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onPrintPdf(true);
                      closeMenus();
                    }}
                  >
                    Финансы + технический расчёт (PDF)
                  </button>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className={styles.secondaryButton}
              title="Выйти на стартовый экран"
              onClick={() => {
                closeMenus();
                onExit();
              }}
            >
              Выйти
            </button>
          </>
        ) : null}
      </div>
    </header>
  );
}
