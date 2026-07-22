/**
 * Назначение: страница FAQ.
 */

import { StaticPageLayout } from '../../components/StaticPageLayout/StaticPageLayout';
import staticPageStyles from '../../components/StaticPageLayout/StaticPageLayout.module.css';
import { staticPagesUk } from '../../i18n/uk/staticPages';

/**
 * @returns JSX
 */
export function FaqPage() {
  const content = staticPagesUk.faq;

  return (
    <StaticPageLayout title={content.title}>
      {content.items.map((item) => (
        <article key={item.q} className={staticPageStyles.faqItem}>
          <h2 className={staticPageStyles.faqQuestion}>{item.q}</h2>
          <p className={staticPageStyles.faqAnswer}>{item.a}</p>
        </article>
      ))}
    </StaticPageLayout>
  );
}
