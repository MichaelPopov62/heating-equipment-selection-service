/**
 * Назначение: Стартовый экран при первом входе (Start State, UA).
 */

import { useEffect, useRef } from 'react';

import { startScreenUk } from '../../i18n/uk/startScreen';
import Logo from '../Logo/Logo';
import { Footer } from '../Footer/Footer';
import styles from './StartScreen.module.css';

export type StartScreenProps = {
  onStartNew: () => void;
};

/**
 * @param props
 */
export function StartScreen({ onStartNew }: StartScreenProps) {
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
            {startScreenUk.title}
          </h1>
          <p className={styles.lead}>{startScreenUk.lead}</p>
        </div>

        <div className={styles.actions}>
          <button
            ref={startRef}
            type="button"
            className={styles.primaryButton}
            onClick={onStartNew}
          >
            {startScreenUk.startNew}
          </button>
        </div>
      </main>

      <Footer variant="app" />
    </div>
  );
}
