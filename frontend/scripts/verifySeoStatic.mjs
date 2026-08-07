/**
 * Назначение: verify robots.txt и sitemap.xml после build.
 * Запуск: npm run verify:seo (из frontend/)
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const robotsPath = path.join(distDir, 'robots.txt');
const sitemapPath = path.join(distDir, 'sitemap.xml');

assert.ok(existsSync(robotsPath), 'dist/robots.txt должен существовать');
assert.ok(existsSync(sitemapPath), 'dist/sitemap.xml должен существовать');

const robots = readFileSync(robotsPath, 'utf8');
const sitemap = readFileSync(sitemapPath, 'utf8');

assert.doesNotMatch(robots, /^Allow:/m, 'robots.txt: без нестандартных Allow');
assert.match(robots, /^User-agent: \*$/m, 'robots.txt: User-agent *');
assert.match(robots, /^User-agent: GPTBot$/m, 'robots.txt: GPTBot');
assert.match(robots, /^User-agent: Google-Extended$/m, 'robots.txt: Google-Extended');
assert.match(robots, /^Disallow: \/login$/m, 'robots.txt: Disallow /login');
assert.match(robots, /^Disallow: \/s\/$/m, 'robots.txt: Disallow /s/');
assert.match(robots, /^Sitemap: https:\/\//m, 'robots.txt: Sitemap URL');
assert.doesNotMatch(robots, /^Disallow: \/$/m, 'robots.txt: не блокировать корень');

/** Кожен Disallow має йти після User-agent у тому ж блоці (не сиротами в кінці файлу). */
const lines = robots.split('\n').map((line) => line.trim()).filter(Boolean);
let lastWasUserAgent = false;
for (const line of lines) {
  if (line.startsWith('#') || line.startsWith('Sitemap:')) {
    lastWasUserAgent = false;
    continue;
  }
  if (line.startsWith('User-agent:')) {
    lastWasUserAgent = true;
    continue;
  }
  if (line.startsWith('Disallow:')) {
    assert.ok(lastWasUserAgent, `robots.txt: сиротский Disallow без User-agent: ${line}`);
    continue;
  }
  assert.fail(`robots.txt: неизвестная директива: ${line}`);
}

assert.match(sitemap, /^<\?xml version="1\.0"/, 'sitemap.xml: XML declaration');
assert.match(sitemap, /<loc>https:\/\/[^<]+\/<\/loc>/, 'sitemap.xml: главная');
assert.match(sitemap, /<loc>https:\/\/[^<]+\/docs<\/loc>/, 'sitemap.xml: /docs');
assert.match(sitemap, /<loc>https:\/\/[^<]+\/faq<\/loc>/, 'sitemap.xml: /faq');
assert.match(sitemap, /<loc>https:\/\/[^<]+\/privacy<\/loc>/, 'sitemap.xml: /privacy');

const indexPath = path.join(distDir, 'index.html');
assert.ok(existsSync(indexPath), 'dist/index.html должен существовать');
const indexHtml = readFileSync(indexPath, 'utf8');
assert.match(indexHtml, /class="static-start-screen"/, 'index.html: static LCP shell');
assert.match(
  indexHtml,
  /Підбір опалення для дому та квартири/,
  'index.html: static h1 для LCP',
);

console.log('verify:seo — OK');
