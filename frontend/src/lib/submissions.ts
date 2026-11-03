import { apiUrl } from "./api";
import type { Page } from "./types";
export interface ProductFile {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
}
export interface ItemProgress {
  id: string;
  status: string;
  reviewCycle: number;
  version: number;
  parentConfirmedAt: string | null;
  teacherAcceptedAt: string | null;
  completedAt: string | null;
}
export interface SubmissionEvent {
  id: string;
  eventType: string;
  reviewCycle: number;
  reason: string | null;
  createdAt: string;
  actorName: string;
}
export interface Submission {
  id: string;
  assignmentItemId: string;
  studentId: string;
  assignmentId: string;
  attemptNumber: number;
  reviewCycle: number;
  submittedBy: string;
  submittedByName: string;
  textResponse: string | null;
  status: string;
  version: number;
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
  feedbackText: string | null;
  feedbackAudioFileId: string | null;
  dueAt: string | null;
  late: boolean;
  assignmentTitle: string;
  lessonTitle: string;
  studentName: string;
  className: string | null;
  currentCycle: number;
  progressStatus: string;
  attachments: ProductFile[];
  events: SubmissionEvent[];
  progress: ItemProgress | null;
}
export interface SubmissionWorkspace {
  allowedResponseTypes: string[];
  reviewCycle: number;
  progress: ItemProgress | null;
  canCreate: boolean;
  canEdit: boolean;
  ownDraft: Submission | null;
  submissions: Page<Submission>;
  events: SubmissionEvent[];
}
export const responseLabels: Record<string, string> = {
  TEXT: "Chữ",
  IMAGE: "Ảnh",
  AUDIO: "Âm thanh",
  VIDEO: "Video",
};
export function productUrl(
  submission: Submission,
  file: string,
  teacher = false,
  action = "content",
) {
  return apiUrl(
    `${teacher ? "" : `/family/children/${submission.studentId}`}/submissions/${submission.id}/files/${file}/${action}`,
  );
}
