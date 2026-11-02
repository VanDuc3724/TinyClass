export type CompletionMode = "REFERENCE" | "PARENT_CONFIRM" | "TEACHER_REVIEW";
export interface Topic {
  id: string;
  name: string;
  description: string | null;
  version: number;
  archivedAt: string | null;
}
export interface Block {
  id?: string;
  type: string;
  textContent: string | null;
  fileId: string | null;
  caption: string | null;
  altText: string | null;
  mimeType?: string;
  originalName?: string;
  learnerDownloadAllowed?: boolean;
}
export interface Lesson {
  id: string;
  title: string;
  summary: string | null;
  parentGuidance: string | null;
  activityInstructions: string | null;
  estimatedMinutes: number | null;
  defaultCompletionMode: CompletionMode;
  defaultResponseTypes: string[];
  status: string;
  version: number;
  topicIds: string[];
  blocks: Block[];
  createdAt: string;
}
export interface CourseLesson {
  lessonId: string;
  title?: string;
  status?: string;
  isRequired: boolean;
  defaultCompletionMode?: CompletionMode;
}
export interface Course {
  id: string;
  title: string;
  description: string | null;
  minAgeMonths: number | null;
  maxAgeMonths: number | null;
  status: string;
  version: number;
  lessons: CourseLesson[];
}
export const completionLabels: Record<CompletionMode, string> = {
  REFERENCE: "Tham khảo",
  PARENT_CONFIRM: "Gia đình xác nhận",
  TEACHER_REVIEW: "Giáo viên duyệt sản phẩm",
};
export const contentStatus: Record<string, string> = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đã xuất bản",
  ARCHIVED: "Đã lưu trữ",
};
