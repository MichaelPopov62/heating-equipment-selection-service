/**
 * Назначение: оркестратор серверного PDF сметы (HTML → Buffer + filename).
 */

import { buildEstimatePdfHtml } from './buildEstimatePdfHtml.js';
import {
  buildContentDispositionAttachment,
  buildEstimatePdfFilename,
} from './pdfFilename.js';
import { renderPdfFromHtml } from './renderPdfFromHtml.js';

/**
 * @param {import('../types/shared-types.js').ProjectShareSnapshot | Record<string, unknown>} snapshot
 * @param {{ includeTechnical?: boolean }} [opts]
 * @returns {Promise<{ buffer: Buffer, filename: string, contentDisposition: string, bytes: number }>}
 */
export async function renderEstimatePdf(snapshot, opts = {}) {
  const html = buildEstimatePdfHtml(snapshot, {
    includeTechnical: opts.includeTechnical === true,
  });
  const buffer = await renderPdfFromHtml(html);
  const clientName =
    snapshot && typeof snapshot === 'object' && 'clientName' in snapshot
      ? String(/** @type {{ clientName?: unknown }} */ (snapshot).clientName ?? '')
      : '';
  const label =
    snapshot && typeof snapshot === 'object' && 'label' in snapshot
      ? /** @type {{ label?: unknown }} */ (snapshot).label
      : undefined;
  const filename = buildEstimatePdfFilename({
    clientName,
    label: label != null ? String(label) : null,
  });
  return {
    buffer,
    filename,
    contentDisposition: buildContentDispositionAttachment(filename),
    bytes: buffer.byteLength,
  };
}
