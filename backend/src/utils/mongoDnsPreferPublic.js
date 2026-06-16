/**
 * Назначение: обход ошибок DNS SRV при подключении к MongoDB Atlas.
 * Описание: Перед mongoose.connect задаёт публичные DNS-серверы для mongodb+srv://; отключение — MONGODB_DISABLE_PUBLIC_DNS=1.
 */
import dns from 'node:dns';

/** @returns {boolean} */
function mongoUriLikelyUsesSrv(uri) {
  const u = typeof uri === 'string' ? uri.trim().toLowerCase() : '';
  return u.startsWith('mongodb+srv://');
}

/**
 * Вызывать перед первым подключением к MongoDB, если URI может использовать SRV.
 * @param {string} [uriHint] — необязательно; если не передан и в env только обычный mongodb://, DNS не трогаем при opt-in режиме.
 */
export function applyMongoFriendlyDnsForUri(uriHint) {
  if (process.env.MONGODB_DISABLE_PUBLIC_DNS === '1') return;

  if (uriHint != null && !mongoUriLikelyUsesSrv(uriHint)) return;

  const raw = process.env.MONGODB_DNS_SERVERS?.trim();
  const servers = raw
    ? raw.split(',').map((s) => s.trim()).filter(Boolean)
    : ['8.8.8.8', '1.1.1.1', '8.8.4.4'];

  if (servers.length === 0) return;

  try {
    dns.setServers(servers);
    if (typeof dns.setDefaultResultOrder === 'function') {
      dns.setDefaultResultOrder('ipv4first');
    }
  } catch {
    // не ломаем запуск приложения
  }
}

/**
 * Если в конфиге есть хотя бы один mongodb+srv URI — включаем публичные DNS до connect.
 * @param {string[]} urisToTry
 */
export function applyMongoFriendlyDnsIfSrvInCandidates(urisToTry) {
  if (!Array.isArray(urisToTry) || urisToTry.length === 0) return;
  const need = urisToTry.some((u) => mongoUriLikelyUsesSrv(String(u ?? '')));
  if (need) applyMongoFriendlyDnsForUri('mongodb+srv://');
}
