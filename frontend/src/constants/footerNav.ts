/**
 * Назначение: SSOT конфигурации ссылок футера (UA, prod SaaS).
 */

import { footerUk } from '../i18n/uk/footer';
import { paths } from '../routing/paths';
import type { FooterActionId, FooterModalId } from '../routing/paths';

export type FooterInternalLink = {
  kind: 'internal';
  label: string;
  href: string;
};

export type FooterExternalLink = {
  kind: 'external';
  label: string;
  href: string;
};

export type FooterMailtoLink = {
  kind: 'mailto';
  label: string;
  email: string;
};

export type FooterActionLink = {
  kind: 'action';
  label: string;
  actionId: FooterActionId;
};

export type FooterModalLink = {
  kind: 'modal';
  label: string;
  modalId: FooterModalId;
};

export type FooterLink =
  | FooterInternalLink
  | FooterExternalLink
  | FooterMailtoLink
  | FooterActionLink
  | FooterModalLink;

export type FooterLinkGroup = {
  id: 'product' | 'help' | 'legal';
  title: string;
  links: FooterLink[];
};

/** Колонки футера (variant app / public). */
export const FOOTER_LINK_GROUPS: FooterLinkGroup[] = [
  {
    id: 'product',
    title: footerUk.groups.product,
    links: [
      { kind: 'action', label: footerUk.links.newCalculation, actionId: 'newCalculation' },
      { kind: 'action', label: footerUk.links.projects, actionId: 'openProjects' },
    ],
  },
  {
    id: 'help',
    title: footerUk.groups.help,
    links: [
      { kind: 'internal', label: footerUk.links.documentation, href: paths.docs },
      { kind: 'internal', label: footerUk.links.faq, href: paths.faq },
      { kind: 'modal', label: footerUk.links.reportBug, modalId: 'reportBug' },
      { kind: 'modal', label: footerUk.links.contact, modalId: 'contact' },
    ],
  },
  {
    id: 'legal',
    title: footerUk.groups.legal,
    links: [
      { kind: 'internal', label: footerUk.links.privacy, href: paths.privacy },
      { kind: 'internal', label: footerUk.links.terms, href: paths.terms },
      { kind: 'internal', label: footerUk.links.cookies, href: paths.cookies },
    ],
  },
];

/** Колонка «Продукт» для share (без проектов). */
export const FOOTER_SHARE_PRODUCT_LINKS: FooterLink[] = [
  { kind: 'internal', label: footerUk.links.home, href: paths.home },
];
