/**
 * Назначение: Стартовый экран при первом входе (Start State).
 * Описание: CTA — новый расчёт и проекты (JSON — только DevPanel).
 */

import { useEffect, useRef } from 'react';

import Logo from '../Logo/Logo';
import { Footer } from '../Footer/Footer';
import styles from './StartScreen.module.css';

export type StartScreenProps = {
  onStartNew: () => void;
  onOpenProjects: () => void;
};

/**
 * @param props
 */
export function StartScreen({
  onStartNew,
  onOpenProjects,
}: StartScreenProps) {
  const startRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    startRef.current?.focus();
  }, []);

  return (
    <div className={styles.root}>
      <main className={styles.main} aria-labelledby="start-screen-title">
        <div className={styles.hero}>
          <Logo size={44} />
          <h1 id="start-screen-title" className={styles.title}>
            Подбор отопления для дома и квартиры
          </h1>
          <p className={styles.lead}>
            Заполните анкету объекта — сервис рассчитает теплопотери, подберёт котёл,
            радиаторы, ГВС и гидравлику по каталогу оборудования.
          </p>
        </div>

        <div className={styles.actions}>
          <button
            ref={startRef}
            type="button"
            className={styles.primaryButton}
            onClick={onStartNew}
          >
            Начать новый расчёт
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onOpenProjects}
          >
            Открыть проект
          </button>
        </div>
      </main>

      <Footer version={`v${__APP_VERSION__}`} />
    </div>
  );
}
