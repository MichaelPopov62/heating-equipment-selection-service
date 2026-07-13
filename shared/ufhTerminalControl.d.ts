/**
 * Назначение: типы выбора терминала петли ТП (коллектор / унибокс).
 */

export type UfhTerminalControl = 'collector' | 'unibox';

export declare const UFH_TERMINAL_CONTROL_MAX_AREA_SQM: 20;

export declare function isUfhTerminalControl(
  raw: unknown,
): raw is UfhTerminalControl;

export declare function resolveUfhTerminalControl(
  raw: unknown,
  roomAreaM2: number,
): UfhTerminalControl;
