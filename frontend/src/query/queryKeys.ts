/**
 * Назначение: единый реестр ключей React Query.
 */

export const queryKeys = {
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
};
