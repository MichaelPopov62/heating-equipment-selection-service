/**
 * Назначение: verify интеграции Clerk auth на frontend (PR-7).
 * Me/tier UI — verify:frontend-me (PR-13…PR-16).
 * Запуск: npm run verify:frontend-auth (из frontend/)
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

const authConfig = readSrc('auth/authConfig.ts');
const authProvider = readSrc('auth/AuthProvider.tsx');
const authApiError = readSrc('utils/authApiError.ts');
const appTsx = readSrc('App.tsx');
const projectsAuthToken = readSrc('services/projectsAuthToken.ts');
const projectsAuthHeaders = readSrc('services/projectsAuthHeaders.ts');
const projectsApi = readSrc('services/projectsApi.ts');
const meApi = readSrc('services/meApi.ts');
const loginPage = readSrc('pages/LoginPage/LoginPage.tsx');
const signUpPage = readSrc('pages/SignUpPage/SignUpPage.tsx');
const appRouter = readSrc('routing/AppRouter.tsx');
const pathsTs = readSrc('routing/paths.ts');
const authUk = readSrc('i18n/uk/auth.ts');
const packageJson = JSON.parse(readFileSync(path.join(root, '..', 'package.json'), 'utf8'));

assert.ok(packageJson.dependencies['@clerk/clerk-react'], 'dependency @clerk/clerk-react');
assert.match(authConfig, /getClerkPublishableKey/);
assert.match(authConfig, /isClerkEnabled/);
assert.match(authConfig, /getClerkJwtTemplate/);
assert.match(authConfig, /resolveClerkJwtTemplateForApi/);
assert.match(authConfig, /DEFAULT_CLERK_JWT_TEMPLATE = 'heatcalc-api'/);
assert.match(appTsx, /ClerkProvider/);
assert.match(appTsx, /ukUA/);
assert.match(appTsx, /localization=\{ukUA\}/);
assert.match(authProvider, /useClerkAuth/);
assert.match(authProvider, /resolveClerkJwtTemplateForApi/);
assert.match(authProvider, /getToken\(\{ template: jwtTemplate \}\)/);
assert.doesNotMatch(authProvider, /return await getToken\(\);/);
assert.match(authProvider, /setProjectsAuthTokenGetter/);
assert.match(authApiError, /formatAuthApiErrorMessage/);
assert.match(meApi, /formatAuthApiErrorMessage/);
assert.match(projectsAuthToken, /resolveProjectsBearerToken/);
assert.match(projectsAuthHeaders, /async function getProjectsAuthHeaders/);
assert.match(projectsApi, /await projectsFetchHeaders/);
assert.match(loginPage, /SignIn/);
assert.match(loginPage, /signUpUrl=\{paths\.signUp\}/);
assert.match(loginPage, /signInUrl=\{paths\.login\}/);
assert.match(signUpPage, /SignUp/);
assert.match(signUpPage, /path=\{paths\.signUp\}/);
assert.match(signUpPage, /signInUrl=\{paths\.login\}/);
assert.match(pathsTs, /signUp: '\/sign-up'/);
assert.match(appRouter, /`\$\{paths\.login\}\/\*`/);
assert.match(appRouter, /`\$\{paths\.signUp\}\/\*`/);
assert.match(appRouter, /SignUpPage/);
assert.match(authUk, /signUpTitle:/);
assert.match(authUk, /signUpLead:/);

/** signUpUrl не должен указывать на login (регрессия PR Clerk sign-up). */
assert.doesNotMatch(loginPage, /signUpUrl=\{paths\.login\}/);

/** Зеркало приоритета resolveProjectsBearerToken. */
async function resolveToken(getter, storage, env) {
  if (getter) {
    const fromClerk = await getter();
    if (fromClerk?.trim()) return fromClerk.trim();
  }
  if (storage?.trim()) return storage.trim();
  return env?.trim() || null;
}

assert.equal(await resolveToken(async () => ' clerk-jwt ', null, null), 'clerk-jwt');
assert.equal(await resolveToken(async () => null, 'stored', null), 'stored');
assert.equal(await resolveToken(null, null, 'env-token'), 'env-token');
assert.equal(await resolveToken(null, null, null), null);

console.log('verify:frontend-auth OK');
