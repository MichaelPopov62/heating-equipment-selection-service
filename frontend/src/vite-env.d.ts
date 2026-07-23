/**
 * Назначение: Декларации типов среды Vite.
 * Описание: Подключение vite/client и глобальные константы сборки.
 */

/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __APP_BUILD_DATE__: string;
declare const __APP_BUILD_ID__: string;

interface ImportMetaEnv {
  readonly VITE_SUPPORT_EMAIL?: string;
  readonly VITE_SUPPORT_PHONE?: string;
  readonly VITE_GITHUB_URL?: string;
  readonly VITE_BUG_REPORT_URL?: string;
  readonly VITE_AUTH_REQUIRED?: string;
  readonly VITE_AUTH_LOGIN_URL?: string;
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
  readonly VITE_CLERK_JWT_TEMPLATE?: string;
  readonly VITE_PROJECTS_BEARER_TOKEN?: string;
  readonly VITE_DEV_TOOLS?: string;
  readonly VITE_BUILD_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
