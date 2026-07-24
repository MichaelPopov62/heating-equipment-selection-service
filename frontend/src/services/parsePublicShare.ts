/**
 * Назначение: strict-парсинг PublicSharePayload (в т.ч. publisherPresentation).
 */

import type { PublicSharePayload, SharePublisherPresentation } from '../types/projectsApi';
import { isRecord } from '../utils/jsonGuards';

/**
 * @param value
 * @returns {SharePublisherPresentation | undefined}
 */
export function parseSharePublisherPresentation(
  value: unknown,
): SharePublisherPresentation | undefined {
  if (!isRecord(value)) return undefined;

  const tier = value.tier;
  if (tier !== 'pro' && tier !== 'marketplace') return undefined;

  const contactEmail = value.contactEmail;
  if (typeof contactEmail !== 'string' || !contactEmail.trim()) return undefined;

  const presentation: SharePublisherPresentation = {
    tier,
    contactEmail: contactEmail.trim(),
  };

  if (typeof value.contactName === 'string' && value.contactName.trim()) {
    presentation.contactName = value.contactName.trim();
  }

  return presentation;
}

/**
 * @param node
 * @returns {PublicSharePayload}
 */
export function parsePublicSharePayload(node: unknown): PublicSharePayload {
  if (!isRecord(node)) {
    throw new Error('Некорректный ответ публичной ссылки');
  }

  const shareToken = node.shareToken;
  const clientName = node.clientName;
  const publishedAt = node.publishedAt;

  if (typeof shareToken !== 'string' || !shareToken.trim()) {
    throw new Error('Некорректный shareToken');
  }
  if (typeof clientName !== 'string' || !clientName.trim()) {
    throw new Error('Некорректный clientName');
  }
  if (typeof publishedAt !== 'string' || !publishedAt.trim()) {
    throw new Error('Некорректный publishedAt');
  }
  if (node.schemaVersion !== 1) {
    throw new Error('Неподдерживаемая schemaVersion');
  }
  if (!('commercial' in node)) {
    throw new Error('Нет commercial в публичной ссылке');
  }

  const matching = isRecord(node.matching) ? node.matching : {};
  const calculations = isRecord(node.calculations) ? node.calculations : {};

  /** @type {PublicSharePayload} */
  const payload: PublicSharePayload = {
    shareToken: shareToken.trim(),
    schemaVersion: 1,
    clientName: clientName.trim(),
    publishedAt: publishedAt.trim(),
    commercial: node.commercial,
    matching,
    calculations,
  };

  if (typeof node.label === 'string' && node.label.trim()) {
    payload.label = node.label.trim();
  }
  if (node.objectType === 'house' || node.objectType === 'apartment') {
    payload.objectType = node.objectType;
  }
  if (typeof node.reportGeneratedAt === 'string' && node.reportGeneratedAt.trim()) {
    payload.reportGeneratedAt = node.reportGeneratedAt.trim();
  }
  if (node.catalogSource === 'file' || node.catalogSource === 'mongo') {
    payload.catalogSource = node.catalogSource;
  }
  if (node.temps !== undefined) {
    payload.temps = node.temps;
  }
  if (Array.isArray(node.warnings)) {
    payload.warnings = node.warnings.filter((w): w is string => typeof w === 'string');
  }

  const publisherPresentation = parseSharePublisherPresentation(node.publisherPresentation);
  if (publisherPresentation) {
    payload.publisherPresentation = publisherPresentation;
  }

  return payload;
}

/**
 * @param data
 * @returns {{ ok: true; share: PublicSharePayload }}
 */
export function parsePublicShareResponse(data: unknown): { ok: true; share: PublicSharePayload } {
  if (!isRecord(data) || data.ok !== true || !('share' in data)) {
    throw new Error('Некорректный ответ публичной ссылки');
  }

  return {
    ok: true,
    share: parsePublicSharePayload(data.share),
  };
}
