/**
 * Призначення: короткий підпис пропозиції котла для summary / рекомендації.
 * Опис: Модель · кВт · ціна (без companion ЕВН/БКН).
 */

import type { BoilerProposalView } from '../BoilerProposalCard/BoilerProposalCard';
import { formatKw, formatPriceUah } from '../../utils/format';

/**
 * @param proposal
 * @returns рядок або null
 */
export function formatBoilerProposalShortLabel(
  proposal: BoilerProposalView | null | undefined,
): string | null {
  if (proposal == null) return null;
  const parts: string[] = [proposal.model];
  if (Number.isFinite(proposal.totalNominalKw)) {
    parts.push(`${formatKw(proposal.totalNominalKw, 1)} кВт`);
  }
  if (proposal.estimatedTotalPrice != null) {
    parts.push(`${formatPriceUah(proposal.estimatedTotalPrice)} грн`);
  }
  return parts.join(' · ');
}
