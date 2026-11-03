import { apiUrl } from "./api";
import type { Page } from "./types";

export interface NoteFile {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
}
export interface SharedNote {
  id: string;
  title: string;
  body: string;
  observedOn: string;
  authorName: string;
  classId: string | null;
  className: string | null;
  sessionId: string | null;
  sessionTitle: string | null;
  sessionStatus: string | null;
  startsAt: string | null;
  endsAt: string | null;
  sharedAt: string | null;
  updatedAt: string;
  attachments: NoteFile[];
}
export interface TeacherNote extends SharedNote {
  studentId: string;
  studentName: string;
  visibility: "PRIVATE" | "SHARED";
  archivedAt: string | null;
  createdAt: string;
  version: number;
}
export interface ProgressProduct {
  id: string;
  status: string;
  attemptNumber: number;
  reviewCycle: number;
  textResponse: string | null;
  feedbackText: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  submittedByName: string;
  reviewedByName: string | null;
  assignmentId: string;
  assignmentTitle: string;
  lessonTitle: string;
  className: string | null;
  attachmentCount: number;
}
export type ProgressEntry =
  | {
      id: string;
      type: "NOTE";
      occurredAt: string;
      note: SharedNote | TeacherNote;
    }
  | {
      id: string;
      type: "SUBMISSION";
      occurredAt: string;
      submission: ProgressProduct;
    };
export interface ProgressWorkspace {
  student: { id: string; fullName: string; status: string };
  counts: {
    sharedNotes: number;
    privateNotes?: number;
    submittedProducts: number;
    acceptedProducts: number;
  };
  timeline: Page<ProgressEntry>;
}
export interface NoteContexts {
  classes: {
    id: string;
    name: string;
    classStatus: string;
    enrollmentStatus: string;
  }[];
  sessions: {
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    status: string;
  }[];
}
export interface NoteHistory {
  id: string;
  action: string;
  reason: string | null;
  createdAt: string;
  actorName: string;
  changedFields: { before?: Partial<TeacherNote>; after: TeacherNote };
}
export function isTeacherNote(
  note: SharedNote | TeacherNote,
): note is TeacherNote {
  return "visibility" in note;
}
export function noteFileUrl(
  note: string,
  file: string,
  child?: string,
  action = "content",
) {
  return apiUrl(
    `${child ? `/family/children/${child}/notes` : "/student-notes"}/${note}/files/${file}/${action}`,
  );
}
