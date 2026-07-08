/**
 * Назначение: телеметрия compat-миграций черновика (freeze до релиза).
 * Описание: console.warn только в DEV; при нулевых срабатываниях за месяц — удалить compat-слой.
 */

/**
 * @param scope — идентификатор миграции (RoomTypes, ExternalWalls, …)
 * @param detail — дополнительный контекст
 */
export function warnCompatMigration(scope: string, detail?: string): void {
  if (!import.meta.env.DEV) return;
  if (detail != null && detail !== '') {
    console.warn(`[survey-compat] ${scope}: ${detail}`);
  } else {
    console.warn(`[survey-compat] ${scope}`);
  }
}
