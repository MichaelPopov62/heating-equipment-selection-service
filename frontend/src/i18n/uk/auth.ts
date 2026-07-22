/**
 * Назначение: строки автентифікації (UA).
 */

export const authUk = {
  loginTitle: 'Вхід до HeatCalc Pro',
  loginLead:
    'Увійдіть, щоб керувати проєктами клієнтів, зберігати розрахунки на сервері та публікувати посилання.',
  loginRedirect: 'Перейти до входу',
  loginDevTokenLabel: 'Bearer JWT (лише dev/staging)',
  loginDevTokenPlaceholder: 'Вставте JWT для API проєктів',
  loginDevSubmit: 'Увійти з токеном',
  loginDevHint:
    'У production використовуйте провайдера автентифікації (Clerk/Auth0). У dev auth може бути вимкнено на backend.',
  logout: 'Вийти з облікового запису',
  authRequired: 'Потрібен вхід для доступу до цієї сторінки.',
  sessionActive: 'Ви авторизовані',
} as const;
