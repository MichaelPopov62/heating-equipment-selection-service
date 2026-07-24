/**
 * Назначение: блок контакта публикатора на публичной share (Pro/Marketplace).
 */

import { headerUk } from '../../i18n/uk/header';
import type { SharePublisherPresentation } from '../../types/projectsApi';
import styles from './PublisherContactBlock.module.css';

export type PublisherContactBlockProps = {
  presentation: SharePublisherPresentation;
  className?: string | undefined;
};

/**
 * @param props
 */
export function PublisherContactBlock({ presentation, className }: PublisherContactBlockProps) {
  const title =
    presentation.tier === 'marketplace'
      ? headerUk.publisherContactTitleMarketplace
      : headerUk.publisherContactTitlePro;

  const rootClass = className ? `${styles.block} ${className}` : styles.block;

  return (
    <section className={rootClass} aria-label={title}>
      <h2 className={styles.title}>{title}</h2>
      {presentation.contactName ? (
        <p className={styles.name}>{presentation.contactName}</p>
      ) : null}
      <p className={styles.emailRow}>
        {headerUk.publisherContactEmailLabel}:{' '}
        <a className={styles.emailLink} href={`mailto:${presentation.contactEmail}`}>
          {presentation.contactEmail}
        </a>
      </p>
    </section>
  );
}
