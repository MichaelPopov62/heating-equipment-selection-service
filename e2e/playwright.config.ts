/**
 * Назначение: конфигурация прогона персон и регрессий HeatCalc.
 * Описание: два таргета — local (vite preview + backend) и prod (живой стенд).
 * Выбор через переменную TARGET. По умолчанию local.
 */
import { defineConfig, devices } from '@playwright/test';

const TARGET = process.env.TARGET ?? 'local';

const BASE_URL =
  TARGET === 'prod'
    ? 'https://heatcalc-mp62.vercel.app'
    : TARGET === 'staging'
      ? 'https://heatcalc-staging-mp62.vercel.app'
      : (process.env.BASE_URL ?? 'http://localhost:5173');

export default defineConfig({
  testDir: '.',
  outputDir: './.artifacts/test-results',
  timeout: 120_000,
  expect: { timeout: 15_000 },

  // Персоны — это замер проходимости, а не поиск флейков.
  // Повтор скрыл бы нестабильность вроде BUG-11, которую надо видеть.
  retries: 0,
  workers: TARGET === 'prod' ? 1 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: './.artifacts/report', open: 'never' }],
    ['json', { outputFile: './.artifacts/results.json' }],
  ],

  use: {
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 800 },
    locale: 'uk-UA',
    timezoneId: 'Europe/Kyiv',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      testMatch: /personas\.spec\.ts/,
      use: { ...devices['iPhone 13'] },
    },
  ],
});
