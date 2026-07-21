/**
 * Назначение: флаг панели разработчика (не для клиентского UI).
 */

/**
 * DevPanel монтируется только в DEV или при явном VITE_DEV_TOOLS=1.
 */
export function isDevToolsEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  return import.meta.env.VITE_DEV_TOOLS === '1';
}
