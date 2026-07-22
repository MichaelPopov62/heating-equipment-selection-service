/**
 * Назначение: оркестратор modals футера.
 */

import { ContactModal } from '../ContactModal/ContactModal';
import { ReportBugModal } from '../ReportBugModal/ReportBugModal';
import { useAppChrome } from '../../shell/useAppChrome';

/**
 * Глобальные modals bug/contact.
 */
export function ModalHost() {
  const { activeModal, closeModal } = useAppChrome();

  return (
    <>
      <ReportBugModal open={activeModal === 'reportBug'} onClose={closeModal} />
      <ContactModal open={activeModal === 'contact'} onClose={closeModal} />
    </>
  );
}
