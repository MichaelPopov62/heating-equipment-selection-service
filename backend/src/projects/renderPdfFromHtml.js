/**
 * Назначение: HTML → PDF через Chromium (puppeteer-core).
 * Описание: PDF_BROWSER_EXECUTABLE (Docker/apt) или bundled Chrome из пакета puppeteer.
 */

import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { acquirePdfRenderSlot } from './pdfRenderSemaphore.js';

/**
 * @returns {number}
 */
function renderTimeoutMs() {
  const n = Number(process.env.PDF_RENDER_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30_000;
}

/**
 * @returns {Promise<string>}
 */
async function resolveBrowserExecutable() {
  const fromEnv = process.env.PDF_BROWSER_EXECUTABLE?.trim();
  if (fromEnv) {
    if (!fs.existsSync(fromEnv)) {
      /** @type {Error & import('../types/shared-types.js').AppErrorLike} */
      const err = new Error(`Chromium не найден: ${fromEnv}`);
      err.statusCode = 503;
      err.code = 'PDF_BROWSER_MISSING';
      throw err;
    }
    return fromEnv;
  }

  try {
    const full = await import('puppeteer');
    const path =
      typeof full.executablePath === 'function' ? full.executablePath() : null;
    if (path && fs.existsSync(path)) return path;
  } catch {
    // пакет puppeteer опционален в минимальном образе
  }

  const candidates = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  /** @type {Error & import('../types/shared-types.js').AppErrorLike} */
  const err = new Error(
    'Не найден Chromium для PDF. Задайте PDF_BROWSER_EXECUTABLE или установите puppeteer.',
  );
  err.statusCode = 503;
  err.code = 'PDF_BROWSER_MISSING';
  throw err;
}

/**
 * @param {string} html
 * @returns {Promise<Buffer>}
 */
export async function renderPdfFromHtml(html) {
  const release = await acquirePdfRenderSlot();
  const timeout = renderTimeoutMs();
  /** @type {import('puppeteer-core').Browser | null} */
  let browser = null;

  try {
    const executablePath = await resolveBrowserExecutable();
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--font-render-hinting=none',
      ],
      timeout,
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(timeout);
    await page.setContent(html, { waitUntil: 'networkidle0', timeout });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '10mm', bottom: '12mm', left: '10mm' },
      timeout,
    });
    return Buffer.from(pdf);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (
      /** @type {{ code?: string }} */ (e).code === 'PDF_BROWSER_MISSING'
    ) {
      throw e;
    }
    /** @type {Error & import('../types/shared-types.js').AppErrorLike} */
    const err = new Error(`Не удалось сформировать PDF: ${msg}`);
    err.statusCode = 503;
    err.code =
      /timeout/i.test(msg) ? 'PDF_RENDER_TIMEOUT' : 'PDF_RENDER_FAILED';
    throw err;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ignore
      }
    }
    release();
  }
}
