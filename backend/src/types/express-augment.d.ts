/**
 * @file Расширение Express Request для API проектов.
 */

declare namespace Express {
  interface Request {
    /** Аутентифицированный пользователь (JWT sub) для /api/v1/projects. */
    projectsUser?: {
      sub: string;
    };
  }
}

export {};
