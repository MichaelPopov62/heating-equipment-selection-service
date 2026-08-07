/**
 * Назначение: генерация robots.txt и sitemap.xml в public/ перед сборкой.
 * Описание: origin из VITE_SITE_URL (Vercel) или production fallback.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(frontendRoot, 'public');
const envPath = path.join(frontendRoot, '.env');

const PRODUCTION_ORIGIN = 'https://heatcalc-mp62.vercel.app';

/** Публичные маршруты для sitemap (без auth и share). */
const PUBLIC_PATHS = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
  { loc: '/docs', changefreq: 'monthly', priority: '0.7' },
  { loc: '/faq', changefreq: 'monthly', priority: '0.7' },
  { loc: '/privacy', changefreq: 'yearly', priority: '0.3' },
  { loc: '/terms', changefreq: 'yearly', priority: '0.3' },
  { loc: '/cookies', changefreq: 'yearly', priority: '0.3' },
];

/**
 * @returns {Record<string, string>}
 */
function loadDotEnv() {
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * @returns {string}
 */
function resolveSiteOrigin() {
  const fromProcess = process.env.VITE_SITE_URL?.trim();
  if (fromProcess) return fromProcess.replace(/\/$/, '');

  const fromDotEnv = loadDotEnv().VITE_SITE_URL?.trim();
  if (fromDotEnv) return fromDotEnv.replace(/\/$/, '');

  return PRODUCTION_ORIGIN;
}

/**
 * @param {string} origin
 * @returns {string}
 */
function buildRobotsTxt(origin) {
  return `# HeatCalc Pro — ${origin}
User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: PerplexityBot
Allow: /

Disallow: /login
Disallow: /sign-up
Disallow: /projects
Disallow: /admin/
Disallow: /s/

Sitemap: ${origin}/sitemap.xml
`;
}

/**
 * @param {string} origin
 * @returns {string}
 */
function buildSitemapXml(origin) {
  const urls = PUBLIC_PATHS.map(
    ({ loc, changefreq, priority }) => `  <url>
    <loc>${origin}${loc}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`,
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

const origin = resolveSiteOrigin();
const robotsPath = path.join(publicDir, 'robots.txt');
const sitemapPath = path.join(publicDir, 'sitemap.xml');

writeFileSync(robotsPath, buildRobotsTxt(origin), 'utf8');
writeFileSync(sitemapPath, buildSitemapXml(origin), 'utf8');

console.log(`generateSeoStatic: ${origin}`);
console.log(`  → ${robotsPath}`);
console.log(`  → ${sitemapPath}`);
