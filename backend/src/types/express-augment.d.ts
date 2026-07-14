/**
 * @file Расширение Express Request для API проектов.
 */

import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    /** UUID запроса из middleware в index.js. */
    requestId?: string;
    /** Аутентифицированный пользователь (JWT sub) для /api/v1/projects. */
    projectsUser?: {
      sub: string;
    };
  }
}

export {};
