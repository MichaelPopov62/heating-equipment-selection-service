/**
 * Назначение: група посилань футера.
 */

import { Link } from 'react-router-dom';

import type { FooterLink } from '../../constants/footerNav';
import { getSupportEmail, getSupportPhone } from '../../constants/siteEnv';
import { footerUk } from '../../i18n/uk/footer';
import { paths } from '../../routing/paths';
import type { FooterActionId, FooterModalId } from '../../routing/paths';
import { useAppChrome } from '../../shell/useAppChrome';
import styles from './Footer.module.css';

export type FooterLinkGroupProps = {
  title: string;
  links: FooterLink[];
  onAction?: ((actionId: FooterActionId) => void) | undefined;
};

/**
 * @param props
 */
export function FooterLinkGroup({ title, links, onAction }: FooterLinkGroupProps) {
  const chrome = useAppChrome();

  return (
    <nav aria-label={title}>
      <h3 className={styles.groupTitle}>{title}</h3>
      <ul className={styles.linkList}>
        {links.map((link) => (
          <li key={`${link.kind}-${link.label}`}>
            <FooterLinkItem link={link} onAction={onAction} openModal={chrome.openModal} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

type FooterLinkItemProps = {
  link: FooterLink;
  onAction?: ((actionId: FooterActionId) => void) | undefined;
  openModal: (id: FooterModalId) => void;
};

/**
 * @param props
 */
function FooterLinkItem({ link, onAction, openModal }: FooterLinkItemProps) {
  if (link.kind === 'internal') {
    return (
      <Link to={link.href} className={styles.linkAnchor}>
        {link.label}
      </Link>
    );
  }

  if (link.kind === 'external') {
    return (
      <a
        href={link.href}
        className={styles.linkAnchor}
        target="_blank"
        rel="noopener noreferrer"
      >
        {link.label}
      </a>
    );
  }

  if (link.kind === 'mailto') {
    return (
      <a href={`mailto:${link.email}`} className={styles.linkAnchor}>
        {link.label}
      </a>
    );
  }

  if (link.kind === 'modal') {
    return (
      <button
        type="button"
        className={styles.linkButton}
        onClick={() => {
          openModal(link.modalId);
        }}
      >
        {link.label}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={styles.linkButton}
      onClick={() => {
        if (onAction) {
          onAction(link.actionId);
          return;
        }
        if (link.actionId === 'openProjects') {
          window.location.assign(paths.projects);
          return;
        }
        window.location.assign(paths.home);
      }}
    >
      {link.label}
    </button>
  );
}

export type FooterContactsProps = {
  githubUrl: string | null;
};

/**
 * @param props
 */
export function FooterContacts({ githubUrl }: FooterContactsProps) {
  const email = getSupportEmail();
  const phone = getSupportPhone();
  const phoneHref = phone.replace(/\s/g, '');

  return (
    <nav aria-label={footerUk.groups.contacts}>
      <h3 className={styles.groupTitle}>{footerUk.groups.contacts}</h3>
      <ul className={styles.linkList}>
        <li>
          <a href={`mailto:${email}`} className={styles.linkAnchor}>
            {email}
          </a>
        </li>
        <li>
          <a href={`tel:${phoneHref}`} className={styles.linkAnchor}>
            {phone}
          </a>
        </li>
        {githubUrl ? (
          <li>
            <a
              href={githubUrl}
              className={styles.linkAnchor}
              target="_blank"
              rel="noopener noreferrer"
            >
              {footerUk.links.github}
            </a>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
