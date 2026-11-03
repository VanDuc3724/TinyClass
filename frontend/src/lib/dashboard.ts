import type { PersonalNotification, Announcement } from "./communications";
import type { TeachingSession } from "./schedule";

export interface DashboardUpdates {
  unreadCount: number;
  recent: PersonalNotification[];
}
export interface DueInvoice {
  id: string;
  invoiceCode: string;
  studentName: string;
  className: string;
  dueOn: string | null;
  totalAmountVnd: number;
  paidAmountVnd: number;
  outstandingAmountVnd: number;
}
export interface BillingOverview {
  openInvoiceCount: number;
  overdueInvoiceCount: number;
  outstandingAmountVnd: string;
  receivedThisMonthVnd: string;
  monthStart: string;
  dueInvoices: DueInvoice[];
}
export interface LearningPreview {
  id: string;
  title: string;
  className: string | null;
  locked?: boolean;
  availableAt?: string;
  requiredItems: number;
  completedItems: number;
  completionPercent: number | null;
}
export interface FamilyDashboard {
  student: { id: string; fullName: string };
  businessDate: string;
  learning: {
    availableAssignments: number;
    waitingAssignments: number;
    requiredItems: number;
    completedItems: number;
    remainingItems: number;
    continueAssignment: LearningPreview | null;
    recentAssignments: LearningPreview[];
  };
  schedule: { todaySessionCount: number; upcoming: TeachingSession[] };
  billing: BillingOverview;
  announcements: { unreadCount: number; recent: Announcement[] };
  updates: DashboardUpdates;
  awaitingReview: number;
  recentFeedback: {
    id: string;
    lessonTitle: string;
    assignmentTitle: string;
    className: string | null;
    status: string;
    reviewedAt: string;
  }[];
}
export interface FamilyHomeOverview {
  businessDate: string;
  linkedChildren: number;
  updates: DashboardUpdates;
}
export function aggregateMoney(value: string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(BigInt(value));
}
