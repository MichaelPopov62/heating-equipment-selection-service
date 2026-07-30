/**
 * Назначение: статическая проверка frontend admin feedback dashboard.
 * Запуск: npm run verify:admin-feedback (из frontend/).
 */

import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

/**
 * @param {string} relativePath
 * @returns {Promise<string>}
 */
function readSource(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

const [
  api,
  parser,
  stream,
  streamHook,
  listQuery,
  mutation,
  page,
  router,
  accountBar,
  adminRoute,
  translations,
] = await Promise.all([
  readSource('services/adminFeedbackApi.ts'),
  readSource('services/parseAdminFeedback.ts'),
  readSource('services/adminFeedbackStream.ts'),
  readSource('hooks/useAdminFeedbackStream.ts'),
  readSource('query/queries/useAdminFeedbackQuery.ts'),
  readSource('query/mutations/useAdminFeedbackStatusMutation.ts'),
  readSource('pages/AdminFeedbackPage/AdminFeedbackPage.tsx'),
  readSource('routing/AppRouter.tsx'),
  readSource('components/AccountBar/AccountBar.tsx'),
  readSource('auth/AdminRoute.tsx'),
  readSource('i18n/uk/adminFeedback.ts'),
]);

assert.match(api, /listAdminFeedback/);
assert.match(api, /updateAdminFeedbackStatus/);
assert.match(parser, /parseAdminFeedbackListResponse/);
assert.match(parser, /parseAdminFeedbackUpdateResponse/);
assert.match(parser, /!data\.nextCursor\.trim\(\)/);
assert.match(listQuery, /useInfiniteQuery/);
assert.match(listQuery, /getNextPageParam/);
assert.match(mutation, /useMutation/);
assert.match(stream, /apiUrl\('\/api\/v1\/admin\/feedback\/stream'\)/);
assert.match(stream, /getProjectsAuthHeaders/);
assert.match(streamHook, /AbortController/);
assert.match(streamHook, /invalidateQueries/);
assert.match(streamHook, /MAX_RECONNECT_DELAY_MS/);
assert.match(page, /aria-live="polite"/);
assert.match(page, /newCount/);
assert.match(router, /AdminRoute/);
assert.match(router, /paths\.adminFeedback/);
assert.match(adminRoute, /useMeQuery/);
assert.match(adminRoute, /user\?\.role !== 'admin'/);
assert.match(accountBar, /meUser\.role === 'admin'/);
assert.match(translations, /ownerSub: 'Ідентифікатор користувача'/);
assert.doesNotMatch(page, />Owner sub</);

for (const source of [stream, streamHook, page]) {
  assert.doesNotMatch(source, /\bEventSource\b/);
  assert.doesNotMatch(source, /\bWebSocket\b/);
  assert.doesNotMatch(source, /\bNotification\b/);
}

console.log('verify:admin-feedback OK');
