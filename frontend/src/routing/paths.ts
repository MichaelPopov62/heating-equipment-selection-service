/**
 * Назначение: канонические пути SPA (prod SaaS).
 */

export const paths = {
  home: '/',
  login: '/login',
  projects: '/projects',
  docs: '/docs',
  faq: '/faq',
  privacy: '/privacy',
  terms: '/terms',
  cookies: '/cookies',
  share: (token: string) => `/s/${token}`,
} as const;

export type FooterModalId = 'reportBug' | 'contact';

export type FooterActionId = 'newCalculation' | 'openProjects';
