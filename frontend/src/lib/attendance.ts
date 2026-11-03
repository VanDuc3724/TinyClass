import { api } from "./api";
import { businessToday } from "./format";
import { addDays } from "./schedule";
export const attendanceStates = [
  "UNMARKED",
  "PRESENT",
  "LATE",
  "ABSENT_EXCUSED",
  "ABSENT_UNEXCUSED",
] as const;
export type AttendanceStatus = (typeof attendanceStates)[number];
export const attendanceLabels: Record<AttendanceStatus, string> = {
  UNMARKED: "Chưa đánh dấu",
  PRESENT: "Có mặt",
  LATE: "Đi muộn",
  ABSENT_EXCUSED: "Nghỉ có phép",
  ABSENT_UNEXCUSED: "Nghỉ chưa báo",
};
export interface AttendanceRow {
  id: string;
  sessionId: string;
  studentName: string;
  classId: string;
  className: string;
  sessionTitle: string;
  startsAt: string;
  endsAt: string;
  sessionStatus: string;
  cancellationReason: string | null;
  isActive: boolean;
  status: AttendanceStatus;
  familyNote: string | null;
  markedAt: string | null;
}
export interface TeacherAttendance extends AttendanceRow {
  studentId: string;
  enrollmentId: string;
  classStatus: string;
  studentStatus: string;
  enrollmentStatus: string;
  note: string | null;
  version: number;
}
export interface FamilyAttendance extends AttendanceRow {
  effective: boolean;
}
export interface AttendanceWorkspace {
  session: {
    id: string;
    classId: string;
    className: string;
    classStatus: string;
    capacity: number | null;
    title: string;
    startsAt: string;
    endsAt: string;
    location: string | null;
    status: string;
    version: number;
    rosterCreatedAt: string | null;
    completedAt: string | null;
    cancellationReason: string | null;
  };
  rows: TeacherAttendance[];
  hasRoster: boolean;
  canEdit: boolean;
  canMarkPresent: boolean;
  canComplete: boolean;
  billingReferences: { id: string; invoiceCode: string; status: string }[];
  counts: Record<AttendanceStatus | "total" | "effectiveTotal", number>;
  eligibleMembers: {
    id: string;
    studentId: string;
    fullName: string;
    enrollmentStatus: string;
    studentStatus: string;
  }[];
}
export interface AttendanceEvent {
  id: string;
  eventType: string;
  statusBefore: AttendanceStatus | null;
  statusAfter: AttendanceStatus;
  familyNote: string | null;
  reason?: string | null;
  createdAt: string;
  actorName: string;
}
export function attendancePeriod(params: URLSearchParams) {
  const valid = (value: string | null) =>
    value &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
      ? value
      : null;
  return {
    from: valid(params.get("from")) || addDays(businessToday(), -29),
    to: valid(params.get("to")) || businessToday(),
  };
}
export async function attendanceChoices<T>(path: string, signal: AbortSignal) {
  const values: T[] = [];
  for (let page = 0; ; page++) {
    const response = await api.list<T>(`${path}?page=${page}&size=100`, signal);
    values.push(...response.data);
    if (page + 1 >= response.meta.totalPages) return values;
  }
}
