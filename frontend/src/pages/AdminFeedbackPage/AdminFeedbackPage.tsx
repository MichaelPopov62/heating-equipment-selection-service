/**
 * Назначение: standalone admin dashboard обращений пользователей.
 */

import { useState } from 'react';
import { Link } from 'react-router';

import { AccountBar } from '../../components/AccountBar/AccountBar';
import { Footer } from '../../components/Footer/Footer';
import { useAdminFeedbackStream } from '../../hooks/useAdminFeedbackStream';
import { adminFeedbackUk as t } from '../../i18n/uk/adminFeedback';
import { useAdminFeedbackStatusMutation } from '../../query/mutations/useAdminFeedbackStatusMutation';
import { useAdminFeedbackQuery } from '../../query/queries/useAdminFeedbackQuery';
import { paths } from '../../routing/paths';
import {
  isAdminFeedbackStatus,
  isAdminFeedbackType,
} from '../../services/parseAdminFeedback';
import type {
  AdminFeedbackItem,
  AdminFeedbackStatus,
  AdminFeedbackType,
} from '../../types/adminFeedback';
import type { AdminFeedbackStreamState } from '../../hooks/useAdminFeedbackStream';
import styles from './AdminFeedbackPage.module.css';

const STATUS_LABELS: Record<AdminFeedbackStatus, string> = {
  new: t.statusNew,
  read: t.statusRead,
  resolved: t.statusResolved,
};

const TYPE_LABELS: Record<AdminFeedbackType, string> = {
  bug: t.typeBug,
  contact: t.typeContact,
};

const STREAM_LABELS: Record<AdminFeedbackStreamState, string> = {
  connecting: t.liveConnecting,
  connected: t.liveConnected,
  reconnecting: t.liveReconnecting,
  unavailable: t.liveUnavailable,
};

/**
 * @param value
 */
function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('uk-UA');
}

/**
 * Разрешает только безопасные HTTP(S)-ссылки.
 *
 * @param value
 */
function safePageUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Карточка одного обращения.
 *
 * @param props
 */
function FeedbackCard({
  item,
  pending,
  onStatusChange,
}: {
  item: AdminFeedbackItem;
  pending: boolean;
  onStatusChange: (status: AdminFeedbackStatus) => void;
}) {
  const pageUrl = safePageUrl(item.pageUrl);

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${styles[item.type]}`}>{TYPE_LABELS[item.type]}</span>
          <span className={`${styles.badge} ${styles[item.status]}`}>
            {STATUS_LABELS[item.status]}
          </span>
        </div>
        <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
      </div>

      <p className={styles.message}>{item.message}</p>

      <dl className={styles.meta}>
        {item.name ? (
          <>
            <dt>{t.owner}</dt>
            <dd>{item.name}</dd>
          </>
        ) : null}
        {item.email ? (
          <>
            <dt>Email</dt>
            <dd>{item.email}</dd>
          </>
        ) : null}
        {item.ownerSub ? (
          <>
            <dt>{t.ownerSub}</dt>
            <dd className={styles.mono}>{item.ownerSub}</dd>
          </>
        ) : null}
        {item.pageUrl ? (
          <>
            <dt>{t.page}</dt>
            <dd>
              {pageUrl ? (
                <a href={pageUrl} target="_blank" rel="noreferrer">
                  {item.pageUrl}
                </a>
              ) : (
                item.pageUrl
              )}
            </dd>
          </>
        ) : null}
        {item.appVersion || item.buildId ? (
          <>
            <dt>{t.version}</dt>
            <dd>
              {[item.appVersion, item.buildId].filter(Boolean).join(' · ')}
            </dd>
          </>
        ) : null}
        <dt>{t.updated}</dt>
        <dd>{formatDate(item.updatedAt)}</dd>
      </dl>

      <label className={styles.statusControl}>
        <span>{t.changeStatus}</span>
        <select
          value={item.status}
          disabled={pending}
          onChange={(event) => {
            if (isAdminFeedbackStatus(event.target.value)) {
              onStatusChange(event.target.value);
            }
          }}
        >
          <option value="new">{t.statusNew}</option>
          <option value="read">{t.statusRead}</option>
          <option value="resolved">{t.statusResolved}</option>
        </select>
      </label>
    </article>
  );
}

/**
 * Страница административной обработки feedback.
 */
export function AdminFeedbackPage() {
  const [status, setStatus] = useState<AdminFeedbackStatus | ''>('');
  const [type, setType] = useState<AdminFeedbackType | ''>('');
  const filters = {
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
  };
  const feedbackQuery = useAdminFeedbackQuery(filters);
  const statusMutation = useAdminFeedbackStatusMutation();
  const { streamState, toastMessage, dismissToast } = useAdminFeedbackStream();
  const newCount = feedbackQuery.items.filter((item) => item.status === 'new').length;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.topRow}>
          <Link to={paths.home} className={styles.backLink}>
            ← {t.backHome}
          </Link>
          <AccountBar />
        </div>

        <div className={styles.headingRow}>
          <h1>{t.title}</h1>
          <span className={styles.newCount} aria-label={`${t.newBadge}: ${newCount}`}>
            {t.newBadge}: {newCount}
          </span>
        </div>

        <div className={styles.toolbar}>
          <label>
            <span>{t.filterStatus}</span>
            <select
              value={status}
              onChange={(event) => {
                const value = event.target.value;
                if (value === '' || isAdminFeedbackStatus(value)) setStatus(value);
              }}
            >
              <option value="">{t.allStatuses}</option>
              <option value="new">{t.statusNew}</option>
              <option value="read">{t.statusRead}</option>
              <option value="resolved">{t.statusResolved}</option>
            </select>
          </label>
          <label>
            <span>{t.filterType}</span>
            <select
              value={type}
              onChange={(event) => {
                const value = event.target.value;
                if (value === '' || isAdminFeedbackType(value)) setType(value);
              }}
            >
              <option value="">{t.allTypes}</option>
              <option value="bug">{t.typeBug}</option>
              <option value="contact">{t.typeContact}</option>
            </select>
          </label>
          <button
            type="button"
            className={styles.refreshButton}
            disabled={feedbackQuery.isFetching}
            onClick={() => {
              void feedbackQuery.refetch();
            }}
          >
            {t.refresh}
          </button>
          <span className={`${styles.streamState} ${styles[streamState]}`}>
            {STREAM_LABELS[streamState]}
          </span>
        </div>

        {feedbackQuery.error ? (
          <p className={styles.error} role="alert">
            {feedbackQuery.error.message}
          </p>
        ) : null}
        {statusMutation.error instanceof Error ? (
          <p className={styles.error} role="alert">
            {statusMutation.error.message}
          </p>
        ) : null}

        {feedbackQuery.isLoading ? (
          <p className={styles.muted} aria-live="polite">
            {t.loading}
          </p>
        ) : feedbackQuery.items.length === 0 ? (
          <p className={styles.muted}>{t.empty}</p>
        ) : (
          <div className={styles.list}>
            {feedbackQuery.items.map((item) => (
              <FeedbackCard
                key={item.id}
                item={item}
                pending={
                  statusMutation.isPending && statusMutation.variables.id === item.id
                }
                onStatusChange={(nextStatus) => {
                  statusMutation.mutate({ id: item.id, status: nextStatus });
                }}
              />
            ))}
          </div>
        )}

        {feedbackQuery.hasNextPage ? (
          <button
            type="button"
            className={styles.loadMore}
            disabled={feedbackQuery.isFetchingNextPage}
            onClick={() => {
              void feedbackQuery.fetchNextPage();
            }}
          >
            {feedbackQuery.isFetchingNextPage ? t.loadingMore : t.loadMore}
          </button>
        ) : null}
      </main>

      {toastMessage ? (
        <div className={styles.toast} role="status" aria-live="polite">
          <span>{toastMessage}</span>
          <button type="button" onClick={dismissToast} aria-label={t.dismissToast}>
            ×
          </button>
        </div>
      ) : null}
      <Footer variant="app" />
    </div>
  );
}
