import { useCallback, useState } from "react";
import {
  Badge,
  EmptyState,
  ErrorNotice,
  Loading,
  Modal,
  Pagination,
} from "../components/ui";
import { api } from "../lib/api";
import { dateTimeLabel } from "../lib/format";
import { useResource } from "../lib/hooks";
import type { InvoiceSummary } from "../lib/invoices";
import { moneyVnd } from "../lib/tuition";
import { paymentMethods } from "../lib/payments";
import type {
  PaymentHistory,
  PublicPayment,
  TeacherPayment,
} from "../lib/payments";
import styles from "./Invoices.module.css";

export function PaymentSummary({
  invoice,
}: {
  invoice: Pick<
    InvoiceSummary,
    "status" | "paidAmountVnd" | "outstandingAmountVnd" | "paymentStatus"
  >;
}) {
  if (typeof invoice.paidAmountVnd !== "number") return null;
  return (
    <div
      className={styles.paymentSummary}
      role="group"
      aria-label="Tình hình thanh toán"
    >
      {invoice.paymentStatus && <Badge status={invoice.paymentStatus} />}
      <dl className={styles.grid}>
        <div>
          <dt>Đã thu</dt>
          <dd>{moneyVnd(invoice.paidAmountVnd)}</dd>
        </div>
        <div>
          <dt>Còn lại</dt>
          <dd>
            {invoice.outstandingAmountVnd === null
              ? invoice.status === "CANCELLED"
                ? "Phiếu đã hủy"
                : "Chưa phát hành"
              : moneyVnd(invoice.outstandingAmountVnd)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
export function PaymentPanel({
  invoiceId,
  child,
  revision = 0,
  pending = false,
  onVoid,
  onRefresh,
}: {
  invoiceId: string;
  child?: string;
  revision?: number;
  pending?: boolean;
  onVoid?: (row: TeacherPayment) => void;
  onRefresh?: () => void;
}) {
  const [page, setPage] = useState(0),
    [history, setHistory] = useState<string | null>(null);
  const base = child
    ? `/family/children/${child}/invoices/${invoiceId}/payments`
    : `/invoices/${invoiceId}/payments`;
  const resource = useResource(
    useCallback(
      (signal) => {
        void revision;
        return api.list<PublicPayment | TeacherPayment>(
          `${base}?page=${page}&size=10`,
          signal,
        );
      },
      [base, page, revision],
    ),
  );
  return (
    <section className={styles.card}>
      <div className={styles.heading}>
        <div>
          <h2>Lịch sử thanh toán</h2>
          <p>Các lần ghi nhận và bản ghi đã điều chỉnh của phiếu.</p>
        </div>
        <button
          className="button button-ghost"
          disabled={resource.loading || pending}
          onClick={onRefresh || resource.reload}
        >
          Cập nhật lịch sử
        </button>
      </div>
      <ErrorNotice
        error={resource.error}
        retry={onRefresh || resource.reload}
      />
      {resource.loading && !resource.data ? (
        <Loading />
      ) : (
        resource.data && (
          <>
            {resource.data.data.length ? (
              resource.data.data.map((row) => {
                const privateRow = !child ? (row as TeacherPayment) : null;
                return (
                  <article
                    className={styles.line}
                    key={row.id}
                    aria-label={`Khoản thu ${moneyVnd(row.amountVnd)} lúc ${dateTimeLabel(row.paidAt)}`}
                  >
                    <div className={styles.heading}>
                      <h3>{moneyVnd(row.amountVnd)}</h3>
                      <Badge status={row.status} />
                    </div>
                    <p>
                      {paymentMethods[row.method]} · {dateTimeLabel(row.paidAt)}
                    </p>
                    {row.publicNote && <p>{row.publicNote}</p>}
                    {row.voidedAt && (
                      <p className="muted">
                        Đã điều chỉnh ngày {dateTimeLabel(row.voidedAt)}; bản
                        này không cộng vào tổng đã thu.
                      </p>
                    )}
                    {privateRow && (
                      <>
                        <p className="muted">
                          Cô ghi nhận: {privateRow.recordedByName} ·{" "}
                          {dateTimeLabel(row.createdAt)}
                        </p>
                        {privateRow.internalNote && (
                          <p className={styles.private}>
                            <strong>Ghi chú riêng của cô</strong>
                            {privateRow.internalNote}
                          </p>
                        )}
                        {privateRow.voidReason && (
                          <p className={styles.private}>
                            <strong>Lý do hủy · chỉ cô xem</strong>
                            {privateRow.voidReason}
                          </p>
                        )}
                        <div className={styles.actions}>
                          {privateRow.canVoid && (
                            <button
                              className="button button-ghost"
                              disabled={pending || resource.loading}
                              onClick={() => onVoid?.(privateRow)}
                            >
                              Hủy bản ghi
                            </button>
                          )}
                          <button
                            className="button button-ghost"
                            disabled={pending || resource.loading}
                            onClick={() => setHistory(row.id)}
                          >
                            Lịch sử khoản thu
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                );
              })
            ) : (
              <EmptyState title="Chưa có khoản tiền được ghi nhận">
                Các khoản đã nhận sẽ hiển thị tại đây.
              </EmptyState>
            )}
            <Pagination meta={resource.data.meta} onChange={setPage} />
          </>
        )
      )}
      {history && (
        <PaymentHistoryModal id={history} onClose={() => setHistory(null)} />
      )}
    </section>
  );
}
function PaymentHistoryModal({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const resource = useResource(
    useCallback(
      (signal) =>
        api.list<PaymentHistory>(
          `/payments/${id}/history?page=${page}&size=10`,
          signal,
        ),
      [id, page],
    ),
  );
  return (
    <Modal title="Lịch sử khoản thu" onClose={onClose}>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Loading />
      ) : (
        resource.data && (
          <>
            {resource.data.data.map((row) => (
              <article key={row.id} className={styles.line}>
                <h3>
                  {row.action === "PAYMENT_RECORDED"
                    ? "Ghi nhận tiền đã nhận"
                    : "Hủy bản ghi nhập sai"}
                </h3>
                <p className="muted">
                  {row.actorName} · {dateTimeLabel(row.createdAt)}
                </p>
                {row.reason && (
                  <p className={styles.private}>
                    <strong>Lý do riêng</strong>
                    {row.reason}
                  </p>
                )}
                {(["before", "after"] as const).map((key) => {
                  const value = row.changedFields[key];
                  return (
                    value?.id && (
                      <details className={styles.details} key={key}>
                        <summary>
                          {key === "before" ? "Trước thay đổi" : "Sau thay đổi"}
                        </summary>
                        <strong>{moneyVnd(value.amountVnd!)}</strong>
                        <p>
                          {paymentMethods[value.method!]} ·{" "}
                          {dateTimeLabel(value.paidAt)}
                        </p>
                        <Badge status={value.status!} />
                        {value.internalNote && (
                          <p className={styles.private}>{value.internalNote}</p>
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
