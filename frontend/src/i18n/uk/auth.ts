/**
 * Назначение: строки автентифікації (UA).
 */

export const authUk = {
  loginTitle: 'Вхід до HeatCalc Pro',
  loginLead:
    'Увійдіть, щоб керувати проєктами клієнтів, зберігати розрахунки на сервері та публікувати посилання.',
  signUpTitle: 'Реєстрація в HeatCalc Pro',
  signUpLead:
    'Створіть обліковий запис, щоб зберігати проєкти клієнтів, розрахунки та публічні посилання на кошторис.',
  loginRedirect: 'Перейти до входу',
  loginDevTokenLabel: 'Bearer JWT (лише dev/staging)',
  loginDevTokenPlaceholder: 'Вставте JWT для API проєктів',
  loginDevSubmit: 'Увійти з токеном',
  loginDevHint:
    'У production використовуйте провайдера автентифікації (Clerk/Auth0). У dev auth може бути вимкнено на backend.',
  logout: 'Вийти з облікового запису',
  logoutButton: 'Вийти',
  loginButton: 'Увійти',
  tierFree: 'Free',
  tierPro: 'Pro',
  tierMarketplace: 'Marketplace',
  tierBadgeAria: 'Тариф облікового запису',
  tierDevTitle: 'Dev',
  accountEmailAria: 'Email облікового запису',
  profileLoadError: 'Не вдалося завантажити профіль',
  jwtTemplateError:
    'JWT без email: налаштуйте Clerk JWT template (heatcalc-api) з claim email та VITE_CLERK_JWT_TEMPLATE.',
  authRequired: 'Потрібен вхід для доступу до цієї сторінки.',
  sessionActive: 'Ви авторизовані',
} as const;
