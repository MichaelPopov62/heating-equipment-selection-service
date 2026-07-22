/**
 * Назначение: строки модальних вікон (UA).
 */

export const modalsUk = {
  reportBug: {
    title: 'Повідомити про помилку',
    description: 'Опишіть проблему — ми отримаємо повідомлення разом із версією застосунку.',
    messageLabel: 'Опис проблеми',
    messagePlaceholder: 'Що сталося? Кроки відтворення…',
    emailLabel: 'Email (необов\'язково)',
    emailPlaceholder: 'you@example.com',
    submit: 'Надіслати',
    cancel: 'Скасувати',
    success: 'Дякуємо! Повідомлення надіслано.',
    error: 'Не вдалося надіслати. Спробуйте пізніше.',
  },
  contact: {
    title: 'Зворотний зв\'язок',
    description: 'Залиште повідомлення — ми відповімо на вказаний email.',
    nameLabel: 'Ім\'я',
    namePlaceholder: 'Ваше ім\'я',
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.com',
    messageLabel: 'Повідомлення',
    messagePlaceholder: 'Ваше питання або пропозиція…',
    submit: 'Надіслати',
    cancel: 'Скасувати',
    success: 'Дякуємо! Повідомлення надіслано.',
    error: 'Не вдалося надіслати. Спробуйте пізніше.',
  },
} as const;
