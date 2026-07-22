/**
 * Назначение: подвал HeatCalc Pro (prod SaaS, UA).
 */

import { Link, useNavigate } from 'react-router-dom';

import {
  FOOTER_LINK_GROUPS,
  FOOTER_SHARE_PRODUCT_LINKS,
} from '../../constants/footerNav';
import { getGithubUrl } from '../../constants/siteEnv';
import { brandUk } from '../../i18n/uk/brand';
import { footerUk } from '../../i18n/uk/footer';
import { paths } from '../../routing/paths';
import type { FooterActionId } from '../../routing/paths';
import { useAppChrome } from '../../shell/useAppChrome';
import type { FooterVariant } from '../../shell/appChromeContext';
import Logo from '../Logo/Logo';
import { FooterContacts, FooterLinkGroup } from './FooterLinkGroup';
import styles from './Footer.module.css';

export type FooterProps = {
  variant?: FooterVariant;
};

/**
 * @param props
 */
export function Footer({ variant = 'app' }: FooterProps) {
  const navigate = useNavigate();
  const chrome = useAppChrome();
  const githubUrl = getGithubUrl();

  const handleAction = (actionId: FooterActionId) => {
    if (actionId === 'newCalculation') {
      if (chrome.onNewCalculation) {
        chrome.onNewCalculation();
      } else {
        void navigate(paths.home);
      }
      return;
    }

    if (chrome.onOpenProjects) {
      chrome.onOpenProjects();
    } else {
      void navigate(paths.projects);
    }
  };

  const productLinks =
    variant === 'share'
      ? FOOTER_SHARE_PRODUCT_LINKS
      : (FOOTER_LINK_GROUPS.find((g) => g.id === 'product')?.links ?? []);

  const helpLinks = FOOTER_LINK_GROUPS.find((g) => g.id === 'help')?.links ?? [];
  const legalLinks = FOOTER_LINK_GROUPS.find((g) => g.id === 'legal')?.links ?? [];

  return (
    <footer className={styles.footer} role="contentinfo">
      <div className={styles.inner}>
        <div className={styles.brandBlock}>
          <Link to={paths.home} className={styles.brand}>
            <div className={styles.logoSlot}>
              <Logo size={34} />
            </div>
            <div className={styles.brandTitles}>
              <h2 className={styles.brandName}>{brandUk.name}</h2>
            </div>
          </Link>
        </div>

        <div className={styles.columns}>
          {variant === 'app' ? (
            <FooterLinkGroup
              title={footerUk.groups.product}
              links={productLinks}
              onAction={handleAction}
            />
          ) : (
            <FooterLinkGroup title={footerUk.groups.product} links={productLinks} />
          )}
          <FooterLinkGroup title={footerUk.groups.help} links={helpLinks} />
          <FooterLinkGroup title={footerUk.groups.legal} links={legalLinks} />
          <FooterContacts githubUrl={githubUrl} />
        </div>

        <div className={styles.meta}>
          <p className={styles.copyright}>{brandUk.copyright}</p>
          <p className={styles.versionLine}>
            {footerUk.versionLabel} {__APP_VERSION__}
          </p>
          <p className={styles.buildLine}>
            {footerUk.buildLabel} {__APP_BUILD_DATE__}
          </p>
          <p className={styles.disclaimer}>{brandUk.disclaimer}</p>
        </div>
      </div>
    </footer>
  );
}
