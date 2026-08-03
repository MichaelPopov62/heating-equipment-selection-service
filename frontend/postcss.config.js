/**
 * Назначение: Конфигурация PostCSS.
 * Описание: global-data даёт @custom-media всем CSS-модулям; custom-media раскрывает (--narrow) и т.п.
 */

import postcssGlobalData from '@csstools/postcss-global-data';
import postcssCustomMedia from 'postcss-custom-media';

export default {
  plugins: [
    postcssGlobalData({
      files: ['./src/styles/custom-media.css'],
    }),
    postcssCustomMedia(),
  ],
};
