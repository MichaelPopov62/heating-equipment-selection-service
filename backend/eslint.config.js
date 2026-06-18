/**
 * Назначение: конфигурация ESLint для backend.
 * Описание: Правила no-unused-vars и no-restricted-imports для границ доменных модулей через public.js.
 */
import js from '@eslint/js';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.node },
    rules: {
      // Параметры вида `_next` — намеренно не используются (сигнатура middleware Express).
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Runtime-границы: доменные модули импортируют только через */public.js
    files: ['src/**/*.js'],
    ignores: [
      'src/models/**',
      'src/matching/**',
      'src/catalog/**',
      'src/reference/**',
      'src/report/**',
      'src/api/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/models/Boiler.js',
                '**/models/Radiator.js',
                '**/models/WaterHeater.js',
                '**/models/Pipe.js',
                '**/models/IndirectWaterHeater.js',
                '**/models/productSchemas.js',
                '**/models/Product.js',
                '**/models/Project.js',
                '**/models/Calculation.js',
              ],
              message:
                'Модели runtime: import из models/public.js. Discriminators — только scripts/.',
            },
            {
              group: [
                '**/matching/internal/**',
                '**/matching/radiators.js',
                '**/matching/index.js',
                '**/matching/boiler.js',
                '**/matching/waterHeater.js',
              ],
              message: 'Подбор: import из matching/public.js (matchEquipment).',
            },
            {
              group: [
                '**/catalog/loadCatalog.js',
                '**/catalog/validateCatalog.js',
              ],
              message: 'Каталог: import из catalog/public.js.',
            },
            {
              group: ['**/reference/configCache.js'],
              message: 'Справочники: import из reference/public.js.',
            },
            {
              group: ['**/report/buildReport.js'],
              message: 'Отчёт: import из report/public.js.',
            },
            {
              group: ['**/api/routes.js', '**/api/projectsRoutes.js'],
              message: 'HTTP: import из api/public.js.',
            },
          ],
        },
      ],
    },
  },
  {
    // Calc-пайплайн: справочники только через CalcRuntimeContext, без legacy sync-кэшей.
    files: ['src/logic/**', 'src/api/validate.js', 'src/utils/**', 'src/matching/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/dhw/referenceCache.js', '**/ufh/ufhPresetsCache.js'],
              message:
                'Legacy sync-кэш удалён — передайте срезы из CalcRuntimeContext (ctx.recommendations, ctx.appliances, …).',
            },
          ],
        },
      ],
    },
  },
]);
