/**
 * Назначение: JSON-LD за маршрутом SPA (FAQPage на /faq тощо).
 */

import { useMemo } from 'react';
import { useLocation } from 'react-router';

import { JsonLd } from './JsonLd';
import { buildJsonLdSchemasForPath } from './jsonLdSchemas';

/**
 * Оновлює Schema.org JSON-LD при зміні pathname.
 */
export function JsonLdBoundary() {
  const { pathname } = useLocation();

  const schemas = useMemo(
    () => buildJsonLdSchemasForPath(pathname),
    [pathname],
  );

  return <JsonLd schemas={schemas} />;
}
