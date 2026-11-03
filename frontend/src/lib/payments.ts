export const paymentMethods = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
  OTHER: "Khác",
};
export interface PublicPayment {
  id: string;
  amountVnd: number;
  method: keyof typeof paymentMethods;
  paidAt: string;
  status: "RECORDED" | "VOIDED";
  publicNote: string | null;
  createdAt: string;
  voidedAt: string | null;
}
export interface TeacherPayment extends PublicPayment {
  invoiceId: string;
  invoiceCode: string;
  recordedByName: string;
  internalNote: string | null;
  version: number;
  voidReason: string | null;
  voidedByName: string | null;
  canVoid: boolean;
}
export interface PaymentHistory {
  id: string;
  action: string;
  actorName: string;
  reason: string | null;
  createdAt: string;
  changedFields: {
    before: Partial<TeacherPayment>;
    after: Partial<TeacherPayment>;
  };
}
export function paymentInstant(local: string) {
  return new Date(
    `${local.length === 16 ? local + ":00" : local}+07:00`,
  ).toISOString();
}
