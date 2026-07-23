/**
 * @file Расширение Express Request для API проектов и auth middleware.
 */

import type { AuthUser } from './auth.js';
import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    /** UUID запроса из middleware в index.js. */
    requestId?: string;
    /** Аутентифицированный пользователь системы (AuthUser). */
    user?: AuthUser;
  }
}

export {};
