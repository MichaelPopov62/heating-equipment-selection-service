/**
 * Назначение: понятные сообщения об ошибках auth API (Clerk JWT template).
 */

const JWT_EMAIL_HINT =
  'Налаштуйте Clerk JWT template (наприклад heatcalc-api): claim email = {{user.primary_email_address}}, aud = AUTH_AUDIENCE на backend, VITE_CLERK_JWT_TEMPLATE у frontend.';

/**
 * @param message — текст из error.message API
 * @returns {string}
 */
export function formatAuthApiErrorMessage(message: string): string {
  if (/JWT без claim email/i.test(message) || /claim email/i.test(message)) {
    return JWT_EMAIL_HINT;
  }
  return message;
}
