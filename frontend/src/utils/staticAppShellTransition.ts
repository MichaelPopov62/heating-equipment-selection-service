/** ID оболочки в index.html — overlay до mount React у #root. */
export const STATIC_APP_SHELL_ID = 'static-app-shell';

/** Тривалість fade static shell → React (ms). */
export const STATIC_SHELL_FADE_MS = 220;

/**
 * @returns {HTMLElement | null}
 */
function getStaticAppShell(): HTMLElement | null {
  const shell = document.getElementById(STATIC_APP_SHELL_ID);
  return shell instanceof HTMLElement ? shell : null;
}

/**
 * Видаляє static shell з DOM після fade (або одразу).
 *
 * @param shell — overlay-елемент
 */
function removeStaticAppShell(shell: HTMLElement): void {
  shell.remove();
}

/**
 * Плавно ховає static shell паралельно з mount React; після transition — remove з DOM.
 */
export async function fadeOutStaticShell(): Promise<void> {
  const shell = getStaticAppShell();
  if (!shell) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    removeStaticAppShell(shell);
    return;
  }

  shell.classList.add('static-app-shell--fade-out');
  await waitForOpacityTransition(shell, STATIC_SHELL_FADE_MS);
  removeStaticAppShell(shell);
}

/**
 * Одразу прибирає static shell (без анімації).
 */
export function dismissStaticAppShellImmediately(): void {
  const shell = getStaticAppShell();
  if (shell) removeStaticAppShell(shell);
}

/**
 * @param el — елемент з opacity transition
 * @param fallbackMs — таймаут, якщо transitionend не прийшов
 */
function waitForOpacityTransition(el: HTMLElement, fallbackMs: number): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      el.removeEventListener('transitionend', onTransitionEnd);
      resolve();
    };

    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target === el && event.propertyName === 'opacity') {
        finish();
      }
    };

    el.addEventListener('transitionend', onTransitionEnd);
    window.setTimeout(finish, fallbackMs);
  });
}
