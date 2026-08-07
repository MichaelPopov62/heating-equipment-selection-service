/**
 * Назначение: verify HTTP-слоя GET /api/v1/me, Account UI и share publisher (PR-13…PR-15).
 * Запуск: npm run verify:frontend-me (из frontend/)
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

/** @param {string} rel */
function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

/** @param {string} rel */
function readMaybe(rel) {
  try {
    return readFileSync(path.join(root, rel), 'utf8');
  } catch {
    return null;
  }
}

/** @param {string} dir */
function collectSourceFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(full));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const meApiTypes = readSrc('types/meApi.ts');
const parseMeResponse = readSrc('services/parseMeResponse.ts');
const meApi = readSrc('services/meApi.ts');
const useMeQuery = readSrc('query/queries/useMeQuery.ts');
const queryKeys = readSrc('query/queryKeys.ts');
const authProvider = readSrc('auth/AuthProvider.tsx');
const clerkAuthProviderInner = readSrc('auth/ClerkAuthProviderInner.tsx');
const publicAuthProvider = readSrc('auth/PublicAuthProviderInner.tsx');
const authMeCacheSync = readSrc('auth/useAuthMeCacheSync.ts');
const authUk = readSrc('i18n/uk/auth.ts');
const accountBar = readSrc('components/AccountBar/AccountBar.tsx');
const tierBadge = readSrc('components/SubscriptionTierBadge/SubscriptionTierBadge.tsx');
const header = readSrc('components/Header/Header.tsx');
const appRoot = readSrc('AppRoot.tsx');
const projectsPage = readSrc('pages/ProjectsPage/ProjectsPage.tsx');
const authSessionBar = readMaybe('components/AuthSessionBar/AuthSessionBar.tsx');
const meQuerySubscriber = readMaybe('query/MeQuerySubscriber.tsx');

assert.match(meApiTypes, /export type UserRole/);
assert.match(meApiTypes, /export type SubscriptionTier/);
assert.match(meApiTypes, /export type MeUser/);
assert.match(meApiTypes, /export type MeOkResponse/);

assert.match(parseMeResponse, /export function parseMeOkResponse/);
assert.match(meApi, /export async function fetchMe/);
assert.match(meApi, /export class MeApiError/);
assert.match(meApi, /getProjectsAuthHeaders/);

assert.match(useMeQuery, /export function useMeQuery/);
assert.match(useMeQuery, /isMeQueryEnabled/);
assert.match(clerkAuthProviderInner, /useLayoutEffect/);
assert.match(clerkAuthProviderInner, /clerkSessionReady/);
assert.match(clerkAuthProviderInner, /isMeQueryEnabled/);
assert.match(clerkAuthProviderInner, /!clerkSessionReady/);
assert.match(publicAuthProvider, /isMeQueryEnabled: false/);
assert.match(useMeQuery, /staleTime: ME_STALE_MS/);
assert.match(useMeQuery, /statusCode === 401/);

assert.match(queryKeys, /me: \['me', 'profile'\]/);

assert.match(authProvider, /useAuthMeCacheSync/);
assert.match(clerkAuthProviderInner, /refreshMeProfile/);
assert.match(clerkAuthProviderInner, /clearMeProfile/);

assert.match(authMeCacheSync, /invalidateQueries/);
assert.match(authMeCacheSync, /removeQueries/);

assert.match(authUk, /loginButton: 'Увійти'/);
assert.match(authUk, /tierFree/);
assert.match(authUk, /tierPro/);
assert.match(authUk, /tierMarketplace/);

assert.match(accountBar, /export function AccountBar/);
assert.match(accountBar, /useMeQuery/);
assert.match(accountBar, /authUk\.loginButton/);
assert.match(accountBar, /SubscriptionTierBadge/);
assert.match(accountBar, /meUser\.email/);
assert.doesNotMatch(accountBar, /decodeJwtPayload/);

assert.match(tierBadge, /export function SubscriptionTierBadge/);

assert.match(header, /accountSlot\?: ReactNode/);
assert.match(header, /styles\.accountSlot/);

assert.match(appRoot, /accountSlot: <AccountBar compact \/>/);
assert.match(projectsPage, /AccountBar/);
assert.doesNotMatch(projectsPage, /AuthSessionBar/);

assert.equal(authSessionBar, null, 'AuthSessionBar удалён (миграция на AccountBar)');
assert.equal(meQuerySubscriber, null, 'MeQuerySubscriber удалён (AccountBar потребляет useMeQuery)');

const parsePublicShare = readSrc('services/parsePublicShare.ts');
const publisherBlock = readSrc('components/PublisherContactBlock/PublisherContactBlock.tsx');
const sharePage = readSrc('components/SharePresentationPage/SharePresentationPage.tsx');
const projectsApiTypes = readSrc('types/projectsApi.ts');
const headerUk = readSrc('i18n/uk/header.ts');

assert.match(parsePublicShare, /export function parseSharePublisherPresentation/);
assert.match(parsePublicShare, /export function parsePublicSharePayload/);
assert.match(projectsApiTypes, /export type SharePublisherPresentation/);
assert.match(publisherBlock, /export function PublisherContactBlock/);
assert.match(sharePage, /PublisherContactBlock/);
assert.match(header, /sharePublisherHint/);
assert.match(headerUk, /sharePublisherHintPro/);
assert.match(headerUk, /publisherContactTitlePro/);

/** @type {RegExp[]} */
const forbiddenSubscriptionGatePatterns = [
  /subscription.*403/i,
  /canAccess.*subscription/i,
  /tier.*disabled.*calc/i,
];

for (const filePath of collectSourceFiles(root)) {
  const content = readFileSync(filePath, 'utf8');
  const rel = path.relative(root, filePath);
  for (const pattern of forbiddenSubscriptionGatePatterns) {
    assert.doesNotMatch(
      content,
      pattern,
      `${rel} не должен содержать subscription-gate: ${pattern}`,
    );
  }
}

console.log('verify:frontend-me OK');
