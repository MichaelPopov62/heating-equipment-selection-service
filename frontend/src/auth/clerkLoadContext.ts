/**
 * Назначение: режим завантаження Clerk для AuthProvider.
 */

import { createContext } from 'react';

export type ClerkLoadMode = 'legacy' | 'public' | 'clerk';

/** legacy — без Clerk key; public — key є, SDK ще не завантажено; clerk — ClerkProvider активний. */
export const ClerkLoadContext = createContext<ClerkLoadMode>('legacy');
