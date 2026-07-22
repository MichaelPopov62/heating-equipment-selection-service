/**
 * Назначение: страница документации.
 */

import { StaticPageLayout } from '../../components/StaticPageLayout/StaticPageLayout';
import staticPageStyles from '../../components/StaticPageLayout/StaticPageLayout.module.css';
import { staticPagesUk } from '../../i18n/uk/staticPages';

/**
 * @returns JSX
 */
export function DocsPage() {
  const content = staticPagesUk.docs;

  return (
    <StaticPageLayout title={content.title} intro={content.intro}>
      {content.sections.map((section) => (
        <section key={section.heading} className={staticPageStyles.section}>
          <h2 className={staticPageStyles.sectionTitle}>{section.heading}</h2>
          <p className={staticPageStyles.sectionBody}>{section.body}</p>
        </section>
      ))}
    </StaticPageLayout>
  );
}
