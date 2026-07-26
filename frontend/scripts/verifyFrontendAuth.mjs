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

/** @param {string} css */
function assertNoImportantInCss(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(withoutComments, /!important/);
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
const clerkUkLocalization = readSrc('i18n/clerkUkLocalization.ts');
const clerkAppearance = readSrc('i18n/clerkAppearance.ts');
const clerkGlobalCss = readFileSync(
  path.join(root, '..', 'src', 'styles', 'clerkGlobal.css'),
  'utf8',
);
const clerkAuthWidget = readSrc('components/ClerkAuthWidget/ClerkAuthWidget.tsx');
const clerkAuthWidgetCss = readSrc('components/ClerkAuthWidget/ClerkAuthWidget.module.css');
const clerkProviderWithRouter = readSrc('auth/ClerkProviderWithRouter.tsx');
const packageJson = JSON.parse(readFileSync(path.join(root, '..', 'package.json'), 'utf8'));

assert.ok(packageJson.dependencies['@clerk/clerk-react'], 'dependency @clerk/clerk-react');
assert.match(authConfig, /getClerkPublishableKey/);
assert.match(authConfig, /isClerkEnabled/);
assert.match(authConfig, /getClerkJwtTemplate/);
assert.match(authConfig, /resolveClerkJwtTemplateForApi/);
assert.match(authConfig, /DEFAULT_CLERK_JWT_TEMPLATE = 'heatcalc-api'/);
assert.match(appTsx, /ClerkProviderWithRouter/);
assert.match(clerkProviderWithRouter, /routerPush/);
assert.match(clerkProviderWithRouter, /routerReplace/);
assert.match(clerkProviderWithRouter, /clerkUkLocalization/);
assert.match(clerkProviderWithRouter, /appearance=\{clerkAppearance\}/);
assert.match(clerkAppearance, /colorModalBackdrop/);
assert.match(clerkUkLocalization, /export const clerkUkLocalization/);
assert.match(clerkUkLocalization, /form_password_incorrect:/);
assert.match(clerkUkLocalization, /form_identifier_not_found:/);
assert.match(clerkAppearance, /socialButtonsBlockButtonText/);
assert.match(clerkAppearance, /colorForeground: 'var\(--text-h\)'/);
assert.match(clerkAppearance, /socialButtonsProviderIcon__github/);
assert.match(clerkAppearance, /'--cl-icon-fill': 'light-dark\(#08060d, #f3f4f6\)'/);
assert.match(clerkAppearance, /backgroundColor: 'light-dark\(#08060d, #f3f4f6\)'/);
assert.doesNotMatch(clerkAppearance, /\bproviderIcon__github:/);
assert.doesNotMatch(clerkAppearance, /socialButtonsBlockButton__github/);
assert.doesNotMatch(clerkAppearance, /GITHUB_MASK_ICON_FILL/);
assert.doesNotMatch(clerkAppearance, /--clerk-github-icon-fill/);
assert.match(clerkAppearance, /formFieldInputShowPasswordButton/);
assert.match(clerkAppearance, /formFieldInputGroup/);
assert.match(clerkAppearance, /formFieldLabel__password/);
assert.match(clerkAppearance, /lastAuthenticationStrategyBadge/);
assert.doesNotMatch(clerkGlobalCss, /ProviderIcon__github/);
assert.doesNotMatch(clerkGlobalCss, /light-dark/);
assertNoImportantInCss(clerkGlobalCss);
assertNoImportantInCss(clerkAuthWidgetCss);
assert.doesNotMatch(clerkAuthWidget, /MutationObserver/);
assert.doesNotMatch(clerkAuthWidget, /CLERK_AUTH_OVERRIDES/);
assert.doesNotMatch(clerkAuthWidget, /applyClerkFormInputStyles/);
assert.match(loginPage, /ClerkAuthWidget/);
assert.match(loginPage, /routing="virtual"/);
assert.doesNotMatch(loginPage, /appearance=\{clerkAppearance\}/);
assert.match(signUpPage, /ClerkAuthWidget/);
assert.match(signUpPage, /routing="virtual"/);
assert.doesNotMatch(signUpPage, /appearance=\{clerkAppearance\}/);
assert.match(authUk, /loginClerkHint:/);
assert.match(authUk, /signUpPasswordHint:/);
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
assert.doesNotMatch(loginPage, /routing="path"/);
assert.doesNotMatch(signUpPage, /path=\{paths\.signUp\}/);
assert.match(signUpPage, /SignUp/);
assert.match(signUpPage, /signInUrl=\{paths\.login\}/);
assert.match(loginPage, /signInUrl=\{paths\.login\}/);
assert.match(loginPage, /signUpUrl=\{paths\.signUp\}/);
assert.match(pathsTs, /signUp: '\/sign-up'/);
assert.match(appRouter, /`\$\{paths\.login\}\/\*`/);
assert.match(appRouter, /`\$\{paths\.signUp\}\/\*`/);
assert.match(appRouter, /SignUpPage/);
assert.match(loginPage, /SignedOut/);
assert.match(signUpPage, /SignedOut/);
assert.match(loginPage, /useAuthRedirectAfterClerk/);
assert.match(signUpPage, /useAuthRedirectAfterClerk/);
assert.match(loginPage, /AuthRedirectShell/);
assert.match(signUpPage, /SignedOut/);
assert.doesNotMatch(loginPage, /fallbackRedirectUrl/);
assert.doesNotMatch(signUpPage, /fallbackRedirectUrl/);
assert.match(authUk, /redirectingAfterLogin:/);

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
