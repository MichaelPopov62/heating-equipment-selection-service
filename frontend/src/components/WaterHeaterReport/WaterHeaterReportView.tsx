/**
 * Назначение: Контент модалки подбора водонагревателя.
 * Описание: Карточки БКН / ЭВН через WaterHeaterMatchingPreview.
 */

import type { ParsedIndirectWaterHeaterMatching } from '../../utils/parseIndirectWaterHeaterMatchingFromReport';
import type { ParsedWaterHeaterMatching } from '../../utils/parseWaterHeaterMatchingFromReport';
import { WaterHeaterMatchingPreview } from '../WaterHeaterMatchingPreview/WaterHeaterMatchingPreview';

export type WaterHeaterReportViewProps = {
  indirect: ParsedIndirectWaterHeaterMatching | null;
  electric: ParsedWaterHeaterMatching | null;
};

/**
 * @param props
 */
export function WaterHeaterReportView({
  indirect,
  electric,
}: WaterHeaterReportViewProps) {
  return (
    <WaterHeaterMatchingPreview
      idPrefix="wh-report"
      indirect={indirect}
      electric={electric}
      sectionTitle="Результат подбора"
    />
  );
}
