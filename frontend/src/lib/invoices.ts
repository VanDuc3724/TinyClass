import type { Page } from "./types";
import type { TuitionTerms } from "./tuition";

export type InvoiceStatus = "DRAFT" | "ISSUED" | "CANCELLED";
export type PaymentStatus = "UNPAID" | "PARTIAL" | "PAID" | "NO_PAYMENT_DUE";
export interface InvoiceLine {
  id?: string;
  description: string;
  pricingBasis: "PER_SESSION" | "MONTHLY_FIXED" | "FULL_PROGRAM" | "OTHER";
  quantity: number;
  unitPriceVnd: number;
  discountVnd: number;
  amountVnd: number;
  attendanceId?: string | null;
}
export interface InvoiceSummary {
  id: string;
  invoiceCode: string;
  studentName: string;
  className: string;
  pricingMode: TuitionTerms["pricingMode"];
  periodStart: string;
  periodEnd: string;
  dueOn: string | null;
  status: InvoiceStatus;
  totalAmountVnd: number;
  paidAmountVnd: number;
  outstandingAmountVnd: number | null;
  paymentStatus: PaymentStatus | null;
  issuedAt: string | null;
  cancelledAt: string | null;
}
export interface PublicInvoice extends InvoiceSummary {
  publicNote: string | null;
  termsSnapshot: TuitionTerms & {
    effectiveFrom: string;
    effectiveTo: string | null;
  };
  lines: InvoiceLine[];
}
export interface TeacherInvoice extends PublicInvoice {
  enrollmentId: string;
  agreementId: string;
  internalNote: string | null;
  adjustmentReason: string | null;
  cancelReason: string | null;
  version: number;
  reviewKey: string;
  currentPreviewKey: string | null;
  sourceChanged: boolean;
  warnings: string[];
  canEdit: boolean;
  canIssue: boolean;
  canCancel: boolean;
  canRecordPayment: boolean;
}
export interface BillingPreview {
  agreementId: string;
  enrollmentId: string;
  studentName: string;
  className: string;
  periodStart: string;
  periodEnd: string;
  termsSnapshot: PublicInvoice["termsSnapshot"];
  previewKey: string;
  suggestedLines: InvoiceLine[];
  suggestedTotalVnd: number | null;
  warnings: string[];
  candidates: {
    attendanceId: string;
    sessionTitle: string;
    startsAt: string;
    attendanceStatus: string;
    billable: boolean;
    blockedReason: string | null;
  }[];
}
export interface FamilyInvoiceWorkspace {
  student: { id: string; fullName: string };
  invoices: Page<InvoiceSummary>;
}
export interface InvoiceHistory {
  id: string;
  action: string;
  actorName: string;
  createdAt: string;
  reason: string | null;
  changedFields: {
    before: Partial<TeacherInvoice>;
    after: Partial<TeacherInvoice>;
  };
}
