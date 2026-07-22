/**
 * Назначение: layout статичних сторінок (docs, faq, legal).
 */

import { Link } from 'react-router-dom';

import { Footer } from '../Footer/Footer';
import { footerUk } from '../../i18n/uk/footer';
import { paths } from '../../routing/paths';
import type { FooterVariant } from '../../shell/appChromeContext';
import styles from './StaticPageLayout.module.css';

export type StaticPageLayoutProps = {
  title: string;
  lastUpdated?: string;
  intro?: string;
  children: React.ReactNode;
  footerVariant?: FooterVariant;
};

/**
 * @param props
 */
export function StaticPageLayout({
  title,
  lastUpdated,
  intro,
  children,
  footerVariant = 'public',
}: StaticPageLayoutProps) {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Link to={paths.home} className={styles.backLink}>
          ← {footerUk.links.home}
        </Link>
        <h1 className={styles.title}>{title}</h1>
        {lastUpdated ? (
          <p className={styles.updated}>Оновлено: {lastUpdated}</p>
        ) : null}
        {intro ? <p className={styles.intro}>{intro}</p> : null}
        {children}
      </main>
      <Footer variant={footerVariant} />
    </div>
  );
}
