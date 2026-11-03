export interface Announcement {
  id: string;
  classId: string;
  className: string;
  title: string;
  body?: string;
  excerpt?: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  revision: number;
  version?: number;
  publishedAt: string | null;
  updatedAt: string;
  archivedAt?: string | null;
  isRead?: boolean;
  canEdit?: boolean;
  canPublish?: boolean;
  canArchive?: boolean;
}
export interface PersonalNotification {
  id: string;
  type: string;
  title: string;
  studentId: string;
  studentName: string;
  classId: string | null;
  className: string | null;
  createdAt: string;
  readAt: string | null;
  targetPath: string;
}
export const refreshNotificationBadge = () =>
  window.dispatchEvent(new Event("tinyclass:notifications-changed"));
