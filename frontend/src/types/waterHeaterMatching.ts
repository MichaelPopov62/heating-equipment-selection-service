/**
 * Назначение: Типы UI подбора водонагревателя из отчёта.
 * Описание: Discriminated union для карточки БКН / электробойлера без дублирующих пропсов.
 */

import type { ParsedIndirectWaterHeaterMatching } from '../utils/parseIndirectWaterHeaterMatchingFromReport';
import type { ParsedWaterHeaterMatching } from '../utils/parseWaterHeaterMatchingFromReport';

export type WaterHeaterProposalCardProps =
  | {
      kind: 'indirect';
      title: string;
      titleDomId: string;
      data: ParsedIndirectWaterHeaterMatching;
    }
  | {
      kind: 'electric';
      title: string;
      titleDomId: string;
      data: ParsedWaterHeaterMatching;
    };

export type WaterHeaterMatchingPreviewIdPrefix = 'wh-report';
