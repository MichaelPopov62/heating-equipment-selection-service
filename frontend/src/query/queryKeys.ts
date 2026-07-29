/**
 * Назначение: единый реестр ключей React Query.
 */

import type { AdminFeedbackStatus, AdminFeedbackType } from '../types/adminFeedback';

export const queryKeys = {
  me: ['me', 'profile'] as const,
  envelopePresets: ['presets', 'envelope'] as const,
  underfloorHeatingPresets: ['presets', 'underfloor-heating'] as const,
  ufhModePresets: ['presets', 'ufh-modes'] as const,
  catalog: ['catalog'] as const,
  calc: (inputKey: string) => ['calc', inputKey] as const,
  calcRoot: ['calc'] as const,
  projects: (params?: { search?: string; limit?: number; skip?: number }) =>
    ['projects', 'list', params ?? {}] as const,
  projectCalculations: (projectId: string) =>
    ['projects', projectId, 'calculations'] as const,
  adminFeedbackRoot: ['admin', 'feedback'] as const,
  adminFeedback: (filters: {
    status?: AdminFeedbackStatus;
    type?: AdminFeedbackType;
    limit: number;
  }) => ['admin', 'feedback', 'list', filters] as const,
};
