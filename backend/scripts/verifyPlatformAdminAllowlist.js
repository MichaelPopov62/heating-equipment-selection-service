/**
 * Назначение: verify PLATFORM_ADMIN_EMAILS — парсинг и интеграция с resolveUser.
 * Запуск: cd backend && npm run verify:platform-admin
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isPlatformAdminEmail,
  normalizePlatformAdminEmail,
  parsePlatformAdminEmails,
  resetPlatformAdminAllowlistCache,
} from '../src/auth/platformAdminAllowlist.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(__dirname, '..');

/** @param {string} rel */
function readSrc(rel) {
  return readFileSync(join(backendRoot, 'src', rel), 'utf8');
}

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

const resolveUserSrc = readSrc('auth/resolveUser.js');
const allowlistSrc = readSrc('auth/platformAdminAllowlist.js');
const envExample = readFileSync(join(backendRoot, '.env.example'), 'utf8');

tally(logCheck(allowlistSrc.includes('PLATFORM_ADMIN_EMAILS'), 'platformAdminAllowlist — env key'));
tally(logCheck(allowlistSrc.includes('parsePlatformAdminEmails'), 'platformAdminAllowlist — parser export'));
tally(
  logCheck(
    resolveUserSrc.includes("from './platformAdminAllowlist.js'") &&
      resolveUserSrc.includes('isPlatformAdminEmail') &&
      resolveUserSrc.includes("role: 'admin'") &&
      resolveUserSrc.includes('auth.platform_admin.sync'),
    'resolveUser — platform admin import, sync, log',
  ),
);
tally(logCheck(envExample.includes('PLATFORM_ADMIN_EMAILS'), '.env.example — PLATFORM_ADMIN_EMAILS'));

const prevEnv = process.env.PLATFORM_ADMIN_EMAILS;

try {
  resetPlatformAdminAllowlistCache();
  delete process.env.PLATFORM_ADMIN_EMAILS;

  tally(
    logCheck(
      parsePlatformAdminEmails(undefined).size === 0 &&
        parsePlatformAdminEmails('').size === 0 &&
        parsePlatformAdminEmails('  , , ').size === 0,
      'пустая / отсутствующая переменная → пустой Set',
    ),
  );

  const parsed = parsePlatformAdminEmails('popov1ms@i.ua, Romantikzizni@gmail.com ,');
  tally(
    logCheck(
      parsed.size === 2 &&
        parsed.has('popov1ms@i.ua') &&
        parsed.has('romantikzizni@gmail.com'),
      'parse — trim, lowercase, comma-separated',
    ),
  );

  tally(
    logCheck(normalizePlatformAdminEmail('  A@B.COM ') === 'a@b.com', 'normalizePlatformAdminEmail'),
  );
  tally(logCheck(normalizePlatformAdminEmail('') === null, 'normalize — пустая строка → null'));

  process.env.PLATFORM_ADMIN_EMAILS = 'verify-platform@example.com';
  resetPlatformAdminAllowlistCache();
  tally(
    logCheck(
      isPlatformAdminEmail('verify-platform@example.com') &&
        isPlatformAdminEmail('VERIFY-PLATFORM@EXAMPLE.COM') &&
        !isPlatformAdminEmail('other@example.com'),
      'isPlatformAdminEmail — env allowlist',
    ),
  );
} finally {
  resetPlatformAdminAllowlistCache();
  if (prevEnv === undefined) delete process.env.PLATFORM_ADMIN_EMAILS;
  else process.env.PLATFORM_ADMIN_EMAILS = prevEnv;
}

if (failed > 0) {
  console.error(`\nverify:platform-admin — ${failed} проверок провалено`);
  process.exitCode = 1;
} else {
  console.log('\nverify:platform-admin — все проверки пройдены');
}
