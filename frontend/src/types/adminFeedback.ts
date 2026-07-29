/**
 * Назначение: строгие DTO административного API обратной связи.
 */

export type AdminFeedbackType = 'bug' | 'contact';

export type AdminFeedbackStatus = 'new' | 'read' | 'resolved';

export type AdminFeedbackItem = {
  id: string;
  type: AdminFeedbackType;
  status: AdminFeedbackStatus;
  message: string;
  email?: string;
  name?: string;
  pageUrl?: string;
  appVersion?: string;
  buildId?: string;
  ownerSub?: string;
  createdAt: string;
  updatedAt: string;
  readAt?: string;
  resolvedAt?: string;
};

export type AdminFeedbackListParams = {
  limit: number;
  cursor?: string;
  status?: AdminFeedbackStatus;
  type?: AdminFeedbackType;
};

export type AdminFeedbackListResponse = {
  ok: true;
  items: AdminFeedbackItem[];
  nextCursor: string | null;
  limit: number;
};

export type AdminFeedbackUpdateResponse = {
  ok: true;
  feedback: AdminFeedbackItem;
};
