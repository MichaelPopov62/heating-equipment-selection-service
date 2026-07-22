/**
 * Назначение: verify конфигурации footer nav (prod SaaS).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const footerNavPath = join(__dirname, '../src/constants/footerNav.ts');
const pathsPath = join(__dirname, '../src/routing/paths.ts');
const footerUkPath = join(__dirname, '../src/i18n/uk/footer.ts');

const footerNavSrc = readFileSync(footerNavPath, 'utf-8');
const pathsSrc = readFileSync(pathsPath, 'utf-8');
const footerUkSrc = readFileSync(footerUkPath, 'utf-8');

/** @type {Array<{ pathKey: string; href: string }>} */
const requiredRoutes = [
  { pathKey: 'docs', href: '/docs' },
  { pathKey: 'faq', href: '/faq' },
  { pathKey: 'privacy', href: '/privacy' },
  { pathKey: 'terms', href: '/terms' },
  { pathKey: 'cookies', href: '/cookies' },
];

for (const { pathKey, href } of requiredRoutes) {
  if (!footerNavSrc.includes(`paths.${pathKey}`)) {
    console.error(`verify:footer-nav — missing paths.${pathKey} in footerNav.ts`);
    process.exit(1);
  }
  if (!pathsSrc.includes(`${pathKey}: '${href}'`) && !pathsSrc.includes(`${pathKey}: "${href}"`)) {
    console.error(`verify:footer-nav — missing path constant ${pathKey} -> ${href}`);
    process.exit(1);
  }
}

const requiredLabels = [
  'newCalculation',
  'projects',
  'documentation',
  'faq',
  'reportBug',
  'privacy',
  'terms',
  'cookies',
];

for (const key of requiredLabels) {
  if (!footerUkSrc.includes(`${key}:`)) {
    console.error(`verify:footer-nav — missing footerUk.links.${key}`);
    process.exit(1);
  }
}

console.log('verify:footer-nav OK');
