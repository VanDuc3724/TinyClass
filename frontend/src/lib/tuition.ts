import type { Page } from "./types";

export const pricingLabels = {
  PER_SESSION: "Theo buổi",
  MONTHLY_FIXED: "Cố định theo tháng",
  FULL_PROGRAM: "Trọn khóa",
};
export const timingLabels = {
  AT_PERIOD_START: "Đầu kỳ",
  AT_PERIOD_END: "Cuối kỳ",
  UPFRONT: "Đóng trước",
};
export const absenceLabels = {
  KEEP_AGREED_AMOUNT: "Giữ mức đã thỏa thuận",
  MANUAL_ADJUSTMENT: "Cô điều chỉnh khi chốt kỳ",
};
export interface TuitionTerms {
  pricingMode: keyof typeof pricingLabels;
  collectionTiming: keyof typeof timingLabels;
  sessionUnitPriceVnd: number | null;
  monthlyAmountVnd: number | null;
  programTotalVnd: number | null;
  programLabel: string | null;
  expectedSessions: number | null;
  chargeExcusedAbsence: boolean | null;
  chargeUnexcusedAbsence: boolean | null;
  fixedFeeAbsenceRule: keyof typeof absenceLabels | null;
  publicTerms: string | null;
}
export interface TuitionPolicy extends TuitionTerms {
  id: string;
  version: number;
  internalNote: string | null;
  updatedAt: string;
}
export interface PublicAgreement extends TuitionTerms {
  id: string;
  classId: string;
  className: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: "ACTIVE" | "ENDED" | "CANCELLED";
  periodState: "CURRENT" | "UPCOMING" | "ENDED" | "CANCELLED";
  updatedAt: string;
  cancelledAt: string | null;
}
export interface TeacherAgreement extends PublicAgreement {
  billedThrough: string | null;
  hasInvoices: boolean;
  enrollmentId: string;
  studentId: string;
  studentName: string;
  version: number;
  sourceType: "POLICY" | "CUSTOM";
  sourcePolicyVersion: number | null;
  internalNote: string | null;
  changeReason: string | null;
  replacementId: string | null;
  canReplace: boolean;
  canEnd: boolean;
  canCancel: boolean;
}
export interface PolicyWorkspace {
  classroom: {
    id: string;
    name: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
  };
  policy: TuitionPolicy | null;
  canEdit: boolean;
}
export interface EnrollmentWorkspace {
  enrollment: {
    id: string;
    classId: string;
    className: string;
    classStatus: string;
    classStartDate: string | null;
    classEndDate: string | null;
    studentId: string;
    studentName: string;
    studentStatus: string;
    status: string;
    joinedAt: string;
  };
  policy: TuitionPolicy | null;
  canCreate: boolean;
  businessDate: string;
  agreements: Page<TeacherAgreement>;
}
export interface FamilyTuitionWorkspace {
  student: { id: string; fullName: string; status: string };
  businessDate: string;
  agreements: Page<PublicAgreement>;
}
export interface TuitionHistory {
  id: string;
  actorName: string;
  action: string;
  reason: string | null;
  createdAt: string;
  changedFields: {
    before: Partial<TeacherAgreement>;
    after: Partial<TeacherAgreement>;
  };
}
export const moneyVnd = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

export function tuitionChangeMinimum(
  agreement: TeacherAgreement,
  today: string,
) {
  let next = "";
  if (agreement.billedThrough) {
    const date = new Date(`${agreement.billedThrough}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    next = date.toISOString().slice(0, 10);
  }
  return [today, agreement.effectiveFrom, next].sort().at(-1)!;
}
