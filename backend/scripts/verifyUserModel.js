/**
 * Назначение: проверка схемы Mongoose-модели User (auth Фаза 1).
 * Запуск: cd backend && npm run verify:user-model
 */
import { SUBSCRIPTION_TIERS, USER_ROLES } from '../src/auth/authorizationPolicy.js';
import { User } from '../src/models/User.js';
import { User as UserFromPublic } from '../src/models/public.js';

/** @param {boolean} ok @param {string} label */
function logCheck(ok, label) {
  console.log(ok ? 'OK' : 'FAIL', '—', label);
  return ok;
}

let failed = 0;

/** @param {boolean} ok */
function tally(ok) {
  if (!ok) failed += 1;
}

const schema = User.schema;
const paths = schema.paths;

tally(logCheck(UserFromPublic === User, 'models/public.js реэкспортирует User'));
tally(logCheck(schema.options.collection === 'users', 'collection = users'));
tally(logCheck(paths.authProvider?.instance === 'String', 'authProvider: String'));
tally(
  logCheck(
    Array.isArray(paths.authProvider?.enumValues) &&
      paths.authProvider.enumValues.includes('clerk') &&
      paths.authProvider.enumValues.includes('auth0'),
    'authProvider enum clerk | auth0',
  ),
);
tally(logCheck(paths.providerUserId?.isRequired === true, 'providerUserId обязателен'));
tally(logCheck(paths.email?.isRequired === true, 'email обязателен'));
tally(logCheck(paths.emailVerified?.isRequired === true, 'emailVerified обязателен'));
tally(logCheck(paths.name?.isRequired !== true, 'name опционален'));
tally(logCheck(paths.role?.defaultValue === 'user', "role default 'user'"));
tally(
  logCheck(
    Array.isArray(paths.role?.enumValues) &&
      paths.role.enumValues.includes('user') &&
      paths.role.enumValues.includes('admin'),
    'role enum user | admin',
  ),
);
tally(
  logCheck(
    Array.isArray(paths.role?.enumValues) &&
      paths.role.enumValues.length === USER_ROLES.length &&
      USER_ROLES.every((r) => paths.role.enumValues.includes(r)),
    'role enum === authorizationPolicy.USER_ROLES (SSOT)',
  ),
);
tally(logCheck(paths.subscription?.defaultValue === 'free', "subscription default 'free'"));
tally(
  logCheck(
    Array.isArray(paths.subscription?.enumValues) &&
      paths.subscription.enumValues.includes('free') &&
      paths.subscription.enumValues.includes('pro') &&
      paths.subscription.enumValues.includes('marketplace'),
    'subscription enum free | pro | marketplace',
  ),
);
tally(
  logCheck(
    Array.isArray(paths.subscription?.enumValues) &&
      paths.subscription.enumValues.length === SUBSCRIPTION_TIERS.length &&
      SUBSCRIPTION_TIERS.every((t) => paths.subscription.enumValues.includes(t)),
    'subscription enum === authorizationPolicy.SUBSCRIPTION_TIERS (SSOT)',
  ),
);

/** @type {Array<[Record<string, number>, { unique?: boolean }]>} */
const indexes = schema.indexes();
const compoundUnique = indexes.some(
  ([fields, options]) =>
    fields.authProvider === 1 &&
    fields.providerUserId === 1 &&
    options?.unique === true,
);
tally(
  logCheck(
    compoundUnique,
    'unique index { authProvider: 1, providerUserId: 1 }',
  ),
);

const emailIndex = indexes.some(([fields]) => fields.email === 1);
tally(logCheck(emailIndex, 'index { email: 1 }'));

if (failed > 0) {
  console.error(`\nverify:user-model — ${failed} проверок провалено`);
  process.exitCode = 1;
} else {
  console.log('\nverify:user-model — все проверки пройдены');
}
