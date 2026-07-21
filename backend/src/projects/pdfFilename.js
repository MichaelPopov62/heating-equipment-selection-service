/**
 * Назначение: санитизация имени файла PDF-сметы.
 */

/**
 * @param {string} raw
 * @returns {string}
 */
function sanitizeSegment(raw) {
  const s = String(raw ?? '')
    .trim()
    .replace(/[<>:"/\\|?*]/g, '_')
    .split('')
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return code < 32 ? '_' : ch;
    })
    .join('')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return s.slice(0, 80) || 'document';
}

/**
 * @param {{ clientName?: string, label?: string | null }} meta
 * @returns {string}
 */
export function buildEstimatePdfFilename(meta) {
  const client = sanitizeSegment(meta.clientName || 'Клиент');
  const label = meta.label != null && String(meta.label).trim()
    ? sanitizeSegment(String(meta.label))
    : null;
  return label ? `Смета_${client}_${label}.pdf` : `Смета_${client}.pdf`;
}

/**
 * RFC 5987 Content-Disposition для кириллицы.
 *
 * @param {string} filename
 * @returns {string}
 */
export function buildContentDispositionAttachment(filename) {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_');
  const encoded = encodeURIComponent(filename).replace(/['()]/g, escape);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
