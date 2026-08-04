/**
 * Назначение: verify политики DevPanel (staging + admin, production без Dev).
 * Запуск: npm run verify:dev-panel (из frontend/)
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

/** @param {string} rel */
function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

const isDevTools = readSrc('utils/isDevToolsEnabled.ts');
const useDevPanel = readSrc('hooks/useDevPanelAccess.ts');
const appRoot = readSrc('AppRoot.tsx');
const deployDoc = readFileSync(
  path.join(root, '..', '..', 'docs', 'deployment-architecture.md'),
  'utf8',
);

assert.match(isDevTools, /VITE_APP_ENV === 'staging'/);
assert.match(isDevTools, /user\?\.role === 'admin'/);
assert.match(isDevTools, /isDevToolsBuildEnabled/);
assert.match(useDevPanel, /useDevPanelAccess/);
assert.match(useDevPanel, /canShowDevPanelForUser/);
assert.match(appRoot, /useDevPanelAccess/);
assert.doesNotMatch(appRoot, /\bisDevToolsEnabled\b/);

const prodEnvBlock = deployDoc.match(/Production:\r?\n\r?\n```env\r?\n([\s\S]*?)```/);
assert.ok(prodEnvBlock?.[1], 'deployment-architecture: блок Production env');
assert.doesNotMatch(
  prodEnvBlock[1],
  /^VITE_DEV_TOOLS=1/m,
  'production env block must not set VITE_DEV_TOOLS=1',
);
assert.match(deployDoc, /VITE_APP_ENV.*staging/i);

console.log('verify:dev-panel OK');
