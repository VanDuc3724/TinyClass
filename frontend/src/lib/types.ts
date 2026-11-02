export interface Account {
  id: string;
  email: string;
  displayName: string;
  role: "TEACHER" | "PARENT";
  status: string;
  emailVerifiedAt: string | null;
}
export interface Page<T> {
  data: T[];
  meta: {
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
  };
}
export interface Classroom {
  id: string;
  name: string;
  description: string | null;
  minAgeMonths: number | null;
  maxAgeMonths: number | null;
  capacity: number | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED";
  activeStudents: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface Student {
  id: string;
  fullName: string;
  preferredName: string | null;
  birthDate: string | null;
  internalNote: string | null;
  status: "ACTIVE" | "ARCHIVED";
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface Enrollment {
  id: string;
  classId: string;
  studentId: string;
  studentName: string;
  preferredName: string | null;
  birthDate: string | null;
  status: "ACTIVE" | "WITHDRAWN" | "COMPLETED";
  joinedAt: string;
  statusChangedAt: string;
  endedAt: string | null;
  note: string | null;
  version: number;
}
export interface StudentClass {
  enrollmentId: string;
  classId: string;
  className: string;
  classStatus: string;
  status: string;
  joinedAt: string;
  endedAt: string | null;
}
export interface History {
  id: string;
  action: string;
  changedFields: Record<string, unknown>;
  reason: string | null;
  createdAt: string;
}
