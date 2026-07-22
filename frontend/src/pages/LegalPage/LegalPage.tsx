/**
 * Назначение: legal-сторінки (privacy, terms, cookies).
 */

import { StaticPageLayout } from '../../components/StaticPageLayout/StaticPageLayout';
import staticPageStyles from '../../components/StaticPageLayout/StaticPageLayout.module.css';
import { staticPagesUk } from '../../i18n/uk/staticPages';

export type LegalPageKind = 'privacy' | 'terms' | 'cookies';

export type LegalPageProps = {
  kind: LegalPageKind;
};

/**
 * @param props
 */
export function LegalPage({ kind }: LegalPageProps) {
  const content = staticPagesUk[kind];

  return (
    <StaticPageLayout title={content.title} lastUpdated={content.lastUpdated}>
      {content.sections.map((section) => (
        <section key={section.heading} className={staticPageStyles.section}>
          <h2 className={staticPageStyles.sectionTitle}>{section.heading}</h2>
          <p className={staticPageStyles.sectionBody}>{section.body}</p>
        </section>
      ))}
    </StaticPageLayout>
  );
}
