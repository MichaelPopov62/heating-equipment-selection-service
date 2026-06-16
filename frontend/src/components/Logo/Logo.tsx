/**
 * Назначение: Компонент логотипа.
 * Описание: SVG-иконка IconHomeEco для брендинга в шапке.
 */

import { IconHomeEco } from '@tabler/icons-react';

import styles from './Logo.module.css';

export type LogoProps = {
  size?: number;
};

export default function Logo({ size = 28 }: LogoProps) {
  return (
    <div className={styles.logo} aria-hidden="true">
      <IconHomeEco size={size} stroke={1.8} />
    </div>
  );
}

