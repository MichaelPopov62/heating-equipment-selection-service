/**
 * Назначение: модальное окно «Повідомити про помилку».
 */

import { useCallback, useState } from 'react';

import { modalsUk } from '../../i18n/uk/modals';
import { submitFeedback } from '../../services/feedbackApi';
import { ModalDialog } from '../ModalDialog/ModalDialog';
import modalDialogStyles from '../ModalDialog/ModalDialog.module.css';

export type ReportBugModalProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * @param props
 */
export function ReportBugModal({ open, onClose }: ReportBugModalProps) {
  const t = modalsUk.reportBug;
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');

  const resetAndClose = useCallback(() => {
    setMessage('');
    setEmail('');
    setStatus('idle');
    onClose();
  }, [onClose]);

  const onSubmit = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setStatus('idle');
    void (async () => {
      try {
        await submitFeedback({
          type: 'bug',
          message: trimmed,
          ...(email.trim() ? { email: email.trim() } : {}),
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
  }, [message, email, busy, resetAndClose]);

  return (
    <ModalDialog open={open} title={t.title} description={t.description} onClose={resetAndClose}>
      {status === 'ok' ? <p className={modalDialogStyles.statusOk}>{t.success}</p> : null}
      {status === 'err' ? <p className={modalDialogStyles.statusErr}>{t.error}</p> : null}
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
          maxLength={200}
          autoComplete="email"
        />
      </label>
      <div className={modalDialogStyles.actions}>
        <button type="button" className={modalDialogStyles.primary} disabled={busy || !message.trim()} onClick={onSubmit}>
          {t.submit}
        </button>
        <button type="button" className={modalDialogStyles.secondary} onClick={resetAndClose}>
          {t.cancel}
        </button>
      </div>
    </ModalDialog>
  );
}
