import { useCallback, useState } from "react";
import {
  Badge,
  ErrorNotice,
  Loading,
  Modal,
  Pagination,
} from "../components/ui";
import { api } from "../lib/api";
import { dateLabel, dateTimeLabel } from "../lib/format";
import { useResource } from "../lib/hooks";
import type {
  InvoiceHistory,
  InvoiceLine,
  PublicInvoice,
  TeacherInvoice,
} from "../lib/invoices";
import { moneyVnd } from "../lib/tuition";
import { TermsSummary } from "./TuitionParts";
import { PaymentSummary } from "./PaymentParts";
import styles from "./Invoices.module.css";

export function InvoiceLines({ lines }: { lines: InvoiceLine[] }) {
  return (
    <div>
      {lines.map((line, index) => (
        <div className={styles.line} key={line.id || index}>
          <div className={styles.heading}>
            <h3>{line.description}</h3>
            <strong>{moneyVnd(line.amountVnd)}</strong>
          </div>
          <p className="muted">
            {line.quantity} × {moneyVnd(line.unitPriceVnd)}
            {line.discountVnd > 0
              ? ` · Giảm ${moneyVnd(line.discountVnd)}`
              : ""}
          </p>
        </div>
      ))}
    </div>
  );
}
export function InvoiceContent({
  invoice,
  teacher = false,
}: {
  invoice: PublicInvoice | TeacherInvoice;
  teacher?: boolean;
}) {
  const privateRow = teacher ? (invoice as TeacherInvoice) : null;
  return (
    <>
      <section className={styles.card}>
        <div className={styles.heading}>
          <div>
            <h2>{invoice.studentName}</h2>
            <p>{invoice.className}</p>
          </div>
          <Badge status={invoice.status} />
        </div>
        <p>
          Kỳ: {dateLabel(invoice.periodStart)} – {dateLabel(invoice.periodEnd)}
        </p>
        <p className="muted">
          Hạn thanh toán:{" "}
          {invoice.dueOn ? dateLabel(invoice.dueOn) : "Chưa đặt"}
        </p>
        <InvoiceLines lines={invoice.lines} />
        {!invoice.lines.length && (
          <p className="muted">Phiếu nháp chưa có dòng tiền.</p>
        )}
        <p className={styles.total}>
          <small>Tổng phiếu</small>
          {moneyVnd(invoice.totalAmountVnd)}
        </p>
        <PaymentSummary invoice={invoice} />
        {invoice.publicNote && <p className="prose">{invoice.publicNote}</p>}
        {invoice.issuedAt && (
          <p className="muted">Phát hành: {dateTimeLabel(invoice.issuedAt)}</p>
        )}
        {invoice.cancelledAt && (
          <p className={styles.warning}>
            Phiếu đã hủy ngày {dateTimeLabel(invoice.cancelledAt)}. Số tiền trên
            được giữ để đối chiếu lịch sử.
          </p>
        )}
        {privateRow?.internalNote && (
          <p className={styles.private}>
            <strong>Ghi chú riêng của cô</strong>
            {privateRow.internalNote}
          </p>
        )}
        {privateRow?.adjustmentReason && (
          <p className={styles.private}>
            <strong>Lý do điều chỉnh khoản thu</strong>
            {privateRow.adjustmentReason}
          </p>
        )}
        {privateRow?.cancelReason && (
          <p className={styles.private}>
            <strong>Lý do hủy · chỉ cô xem</strong>
            {privateRow.cancelReason}
          </p>
        )}
      </section>
      <section className={styles.card}>
        <details className={styles.details}>
          <summary>Điều kiện dùng khi lập phiếu</summary>
          <TermsSummary terms={invoice.termsSnapshot} />
          <p className="muted">
            Hiệu lực tại lúc lập:{" "}
            {dateLabel(invoice.termsSnapshot.effectiveFrom)} –{" "}
            {invoice.termsSnapshot.effectiveTo
              ? dateLabel(invoice.termsSnapshot.effectiveTo)
              : "Chưa đặt ngày cuối"}
            .
          </p>
        </details>
      </section>
    </>
  );
}
const historyLabels: Record<string, string> = {
  INVOICE_CREATED: "Tạo phiếu nháp",
  INVOICE_UPDATED: "Chỉnh sửa nháp",
  INVOICE_ISSUED: "Phát hành cho gia đình",
  INVOICE_CANCELLED: "Hủy phiếu",
  PAYMENT_RECORDED: "Ghi nhận thanh toán",
  PAYMENT_VOIDED: "Hủy bản ghi nhập sai",
};
export function InvoiceHistoryModal({
  invoice,
  onClose,
}: {
  invoice: string;
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const resource = useResource(
    useCallback(
      (signal) =>
        api.list<InvoiceHistory>(
          `/invoices/${invoice}/history?page=${page}&size=10`,
          signal,
        ),
      [invoice, page],
    ),
  );
  return (
    <Modal title="Lịch sử phiếu học phí" onClose={onClose} wide>
      <p className="muted">Nội dung trước/sau và lý do chỉ giáo viên xem.</p>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Loading />
      ) : (
        resource.data && (
          <>
            {resource.data.data.map((row) => (
              <article className={styles.line} key={row.id}>
                <h3>{historyLabels[row.action] || "Thay đổi phiếu"}</h3>
                <p className="muted">
                  {row.actorName} · {dateTimeLabel(row.createdAt)}
                </p>
                {row.reason && (
                  <p className={styles.private}>
                    <strong>Lý do</strong>
                    {row.reason}
                  </p>
                )}
                {(["before", "after"] as const).map((key) => {
                  const value = row.changedFields[key];
                  return (
                    value?.invoiceCode && (
                      <details key={key} className={styles.details}>
                        <summary>
                          {key === "before" ? "Trước thay đổi" : "Sau thay đổi"}
                        </summary>
                        <Badge status={value.status!} />
                        <p>
                          {value.invoiceCode} · {dateLabel(value.periodStart!)}{" "}
                          – {dateLabel(value.periodEnd!)}
                        </p>
                        <InvoiceLines lines={value.lines || []} />
                        <p className={styles.total}>
                          {moneyVnd(value.totalAmountVnd || 0)}
                        </p>
                        <PaymentSummary invoice={value as TeacherInvoice} />
                        {value.internalNote && (
                          <p className={styles.private}>
                            <strong>Ghi chú riêng của cô</strong>
                            {value.internalNote}
                          </p>
                        )}
                        {value.adjustmentReason && (
                          <p className={styles.private}>
                            <strong>Lý do điều chỉnh</strong>
                            {value.adjustmentReason}
                          </p>
                        )}
                      </details>
                    )
                  );
                })}
              </article>
            ))}
            <Pagination meta={resource.data.meta} onChange={setPage} />
          </>
        )
      )}
    </Modal>
  );
}
export function IssueInvoiceModal({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: TeacherInvoice;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/invoices/${invoice.id}/issue`, {
        version: invoice.version,
        reviewKey: invoice.reviewKey,
      });
      onSaved();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Phát hành phiếu học phí" busy={busy} onClose={onClose}>
      <p>
        Gia đình được liên kết với {invoice.studentName} sẽ xem được phiếu{" "}
        {invoice.invoiceCode} và các dòng tiền. Sau phát hành, nội dung phiếu
        được giữ nguyên.
      </p>
      <p className={styles.total}>
        <small>Tổng phiếu</small>
        {moneyVnd(invoice.totalAmountVnd)}
      </p>
      <ErrorNotice error={error} />
      <div className="form-actions">
        <button
          className="button button-ghost"
          disabled={busy}
          onClick={onClose}
        >
          Quay lại
        </button>
        <button
          className="button button-primary"
          disabled={busy}
          onClick={submit}
        >
          {busy ? "Đang phát hành…" : "Xác nhận phát hành"}
        </button>
      </div>
    </Modal>
  );
}
