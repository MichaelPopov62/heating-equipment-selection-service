/**
 * Назначение: Clerk UI + FAPI errors — SSOT локализации HeatCalc Pro (uk-UA).
 * Базовый пакет @clerk/localizations/ukUA неполный (void 0 → English longMessage).
 */

import { ukUA } from '@clerk/localizations';

/**
 * Локализация Clerk: merge ukUA + override ключей sign-in/sign-up и unstable__errors.
 */
export const clerkUkLocalization = {
  ...ukUA,
  formButtonPrimary: 'Продовжити',
  formButtonPrimary__verify: 'Підтвердити',
  formFieldInputPlaceholder__emailAddress: 'name@example.com',
  formFieldInputPlaceholder__password: 'Введіть пароль',
  formFieldInputPlaceholder__signUpPassword: 'Мінімум 8 символів',
  identityPreviewEditButton__emailAddress: 'Змінити',
  identityPreviewEditButton__identifier: 'Змінити',
  /** Бейдж «Останнє використання» на OAuth — не показуємо */
  lastAuthenticationStrategy: '',
  signIn: {
    ...ukUA.signIn,
    accountSwitcher: {
      action__addAccount: 'Додати акаунт',
      action__signOutAll: 'Вийти з усіх акаунтів',
      subtitle: 'Оберіть акаунт для продовження.',
      title: 'Оберіть акаунт',
    },
    alternativeMethods: {
      ...ukUA.signIn?.alternativeMethods,
      actionText: 'Немає доступу до цих методів?',
      subtitle: 'Виникли проблеми? Спробуйте інший спосіб входу.',
    },
    forgotPassword: {
      ...ukUA.signIn?.forgotPassword,
      subtitle: 'Щоб скинути пароль',
      subtitle_email: 'Спочатку введіть код, надісланий на вашу пошту',
      subtitle_phone: 'Спочатку введіть код, надісланий на ваш телефон',
      title: 'Скидання пароля',
    },
    resetPassword: {
      ...ukUA.signIn?.resetPassword,
      requiredMessage:
        'З міркувань безпеки потрібно встановити новий пароль.',
    },
  },
  signUp: {
    ...ukUA.signUp,
    start: {
      ...ukUA.signUp?.start,
      actionLink__use_email: 'Використовувати пошту',
      actionLink__use_phone: 'Використовувати номер телефону',
    },
  },
  unstable__errors: {
    ...ukUA.unstable__errors,
    captcha_invalid:
      'Не пройдено перевірку безпеки. Оновіть сторінку та спробуйте знову.',
    captcha_unavailable:
      'Перевірку безпеки тимчасово недоступно. Оновіть сторінку.',
    form_code_incorrect: 'Невірний код. Спробуйте ще раз або надішліть новий.',
    form_identifier_exists__email_address:
      'Акаунт з цією поштою вже існує. Увійдіть або використайте іншу адресу.',
    form_identifier_exists__phone_number:
      'Номер телефону вже використовується. Спробуйте інший.',
    form_identifier_exists__username:
      "Ім'я користувача вже зайняте. Оберіть інше.",
    form_identifier_not_found:
      'Акаунт з цією адресою не знайдено. Перевірте пошту або зареєструйтесь.',
    form_param_format_invalid__email_address:
      'Невірний формат пошти. Приклад: name@example.com',
    form_param_type_invalid__email_address:
      'Введіть адресу електронної пошти.',
    form_password_compromised__sign_in:
      'Пароль небезпечний. Скиньте пароль для захисту акаунта.',
    form_password_incorrect:
      'Невірний пароль. Перевірте Caps Lock і регістр літер, потім натисніть «Продовжити».',
    form_password_length_too_short:
      'Пароль занадто короткий. Потрібно щонайменше {{minimum_length}} символів.',
    form_password_or_identifier_incorrect:
      'Невірна пошта або пароль. Перевірте дані та спробуйте ще раз.',
    form_password_pwned__sign_in:
      'Пароль скомпрометовано. Скиньте пароль через «Забули пароль?».',
    form_password_untrusted__sign_in:
      'Пароль може бути скомпрометованим. Увійдіть іншим способом і змініть пароль.',
    form_password_validation_failed: 'Невірний пароль.',
  },
};
