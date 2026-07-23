/**
 * Назначение: проверка схемы Mongoose-модели User (auth Фаза 1).
 * Запуск: cd backend && npm run verify:user-model
 */
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
tally(logCheck(paths.subscription?.defaultValue === 'free', "subscription default 'free'"));

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
