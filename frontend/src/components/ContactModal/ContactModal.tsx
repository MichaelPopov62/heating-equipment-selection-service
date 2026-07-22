/**
 * Назначение: модальное окно «Зворотний зв'язок».
 */

import { useCallback, useState } from 'react';

import { modalsUk } from '../../i18n/uk/modals';
import { submitFeedback } from '../../services/feedbackApi';
import { ModalDialog } from '../ModalDialog/ModalDialog';
import modalDialogStyles from '../ModalDialog/ModalDialog.module.css';

export type ContactModalProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * @param props
 */
export function ContactModal({ open, onClose }: ContactModalProps) {
  const t = modalsUk.contact;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');

  const resetAndClose = useCallback(() => {
    setName('');
    setEmail('');
    setMessage('');
    setStatus('idle');
    onClose();
  }, [onClose]);

  const onSubmit = useCallback(() => {
    const trimmed = message.trim();
    const emailTrimmed = email.trim();
    if (!trimmed || !emailTrimmed || busy) return;
    setBusy(true);
    setStatus('idle');
    void (async () => {
      try {
        await submitFeedback({
          type: 'contact',
          message: trimmed,
          email: emailTrimmed,
          ...(name.trim() ? { name: name.trim() } : {}),
          pageUrl: window.location.href,
          appVersion: __APP_VERSION__,
          buildId: __APP_BUILD_ID__,
        });
        setStatus('ok');
        setTimeout(resetAndClose, 1200);
      } catch {
        setStatus('err');
      } finally {
        setBusy(false);
      }
    })();
  }, [name, email, message, busy, resetAndClose]);

  return (
    <ModalDialog open={open} title={t.title} description={t.description} onClose={resetAndClose}>
      {status === 'ok' ? <p className={modalDialogStyles.statusOk}>{t.success}</p> : null}
      {status === 'err' ? <p className={modalDialogStyles.statusErr}>{t.error}</p> : null}
      <label className={modalDialogStyles.field}>
        <span className={modalDialogStyles.label}>{t.nameLabel}</span>
        <input
          type="text"
          className={modalDialogStyles.input}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
          placeholder={t.namePlaceholder}
          maxLength={120}
          autoComplete="name"
        />
      </label>
      <label className={modalDialogStyles.field}>
        <span className={modalDialogStyles.label}>{t.emailLabel}</span>
        <input
          type="email"
          className={modalDialogStyles.input}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
          }}
          placeholder={t.emailPlaceholder}
          required
          maxLength={200}
          autoComplete="email"
        />
      </label>
      <label className={modalDialogStyles.field}>
        <span className={modalDialogStyles.label}>{t.messageLabel}</span>
        <textarea
          className={modalDialogStyles.textarea}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
          }}
          placeholder={t.messagePlaceholder}
          required
          maxLength={4000}
        />
      </label>
      <div className={modalDialogStyles.actions}>
        <button
          type="button"
          className={modalDialogStyles.primary}
          disabled={busy || !message.trim() || !email.trim()}
          onClick={onSubmit}
        >
          {t.submit}
        </button>
        <button type="button" className={modalDialogStyles.secondary} onClick={resetAndClose}>
          {t.cancel}
        </button>
      </div>
    </ModalDialog>
  );
}
