/**
 * Назначение: побудова Schema.org JSON-LD для публічних сторінок.
 */

import { brandUk } from '../i18n/uk/brand';
import { startScreenUk } from '../i18n/uk/startScreen';
import { staticPagesUk } from '../i18n/uk/staticPages';
import { getSiteOrigin, getSupportEmail } from '../constants/siteEnv';

/** Базовий @context для всіх схем. */
const SCHEMA_CONTEXT = 'https://schema.org';

/**
 * @param origin — абсолютний origin без trailing slash
 * @returns {Record<string, unknown>}
 */
export function buildOrganizationSchema(origin: string): Record<string, unknown> {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'Organization',
    name: brandUk.name,
    url: origin,
    email: getSupportEmail(),
    description: brandUk.tagline,
  };
}

/**
 * @param origin — абсолютний origin без trailing slash
 * @returns {Record<string, unknown>}
 */
export function buildWebSiteSchema(origin: string): Record<string, unknown> {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'WebSite',
    name: brandUk.name,
    url: origin,
    description: brandUk.tagline,
    inLanguage: 'uk-UA',
  };
}

/**
 * @param origin — абсолютний origin без trailing slash
 * @returns {Record<string, unknown>}
 */
export function buildWebApplicationSchema(origin: string): Record<string, unknown> {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'WebApplication',
    name: brandUk.name,
    url: origin,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Web',
    description: startScreenUk.lead,
    inLanguage: 'uk-UA',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'UAH',
    },
  };
}

/**
 * @param origin — абсолютний origin без trailing slash
 * @returns {Record<string, unknown>}
 */
export function buildFaqPageSchema(origin: string): Record<string, unknown> {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'FAQPage',
    mainEntity: staticPagesUk.faq.items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
    url: `${origin}/faq`,
  };
}

/**
 * Схеми для головної (статичний HTML + SPA fallback).
 * @returns {Record<string, unknown>[]}
 */
export function buildHomeJsonLdSchemas(): Record<string, unknown>[] {
  const origin = getSiteOrigin();
  return [
    buildOrganizationSchema(origin),
    buildWebSiteSchema(origin),
    buildWebApplicationSchema(origin),
  ];
}

/**
 * Схеми за маршрутом SPA.
 * @param pathname — location.pathname
 * @returns {Record<string, unknown>[]}
 */
export function buildJsonLdSchemasForPath(pathname: string): Record<string, unknown>[] {
  const origin = getSiteOrigin();
  const normalized = pathname.endsWith('/') && pathname.length > 1
    ? pathname.slice(0, -1)
    : pathname;

  if (normalized === '/') {
    return buildHomeJsonLdSchemas();
  }

  const schemas: Record<string, unknown>[] = [
    buildOrganizationSchema(origin),
    buildWebSiteSchema(origin),
  ];

  if (normalized === '/faq') {
    schemas.push(buildFaqPageSchema(origin));
  }

  return schemas;
}
