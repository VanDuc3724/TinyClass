import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ErrorNotice, Field, Modal } from "../components/ui";
import { api } from "../lib/api";
import { businessLocal } from "../lib/schedule";
import { dateTimeLabel } from "../lib/format";
import { useUnsavedChanges } from "../lib/hooks";
import { moneyVnd } from "../lib/tuition";
import type { TeacherInvoice } from "../lib/invoices";
import { paymentInstant, paymentMethods } from "../lib/payments";
import type { TeacherPayment } from "../lib/payments";
import styles from "./Invoices.module.css";

function usePaymentError(error: unknown) {
  const anchor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) {
      anchor.current?.scrollIntoView({ block: "start" });
      anchor.current?.focus({ preventScroll: true });
    }
  }, [error]);
  return anchor;
}
export function RecordPaymentModal({
  invoice,
  onClose,
  onSaved,
  onReload,
}: {
  invoice: TeacherInvoice;
  onClose: () => void;
  onSaved: () => void;
  onReload: () => void;
}) {
  const [key] = useState(() => crypto.randomUUID());
  const [initialDate] = useState(() =>
    businessLocal(new Date().toISOString()).slice(0, 16),
  );
  const [amount, setAmount] = useState(""),
    [method, setMethod] = useState(""),
    [date, setDate] = useState(initialDate);
  const [publicNote, setPublicNote] = useState(""),
    [internalNote, setInternalNote] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const anchor = usePaymentError(error);
  const discard = useUnsavedChanges(
    !!amount ||
      !!method ||
      date !== initialDate ||
      !!publicNote ||
      !!internalNote,
  );
  function close() {
    if (!busy && discard()) onClose();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.postIdempotent(
        `/invoices/${invoice.id}/payments`,
        {
          invoiceVersion: invoice.version,
          amountVnd: Number(amount),
          method,
          paidAt: paymentInstant(date),
          publicNote: publicNote.trim() || null,
          internalNote: internalNote.trim() || null,
        },
        key,
      );
      onSaved();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Ghi nhận thanh toán" onClose={close} busy={busy}>
      <p className="muted">
        Ghi lại khoản tiền cô đã nhận từ gia đình cho phiếu{" "}
        {invoice.invoiceCode}.
      </p>
      <p className={styles.total}>
        <small>Số còn lại trước lần ghi này</small>
        {moneyVnd(invoice.outstandingAmountVnd ?? 0)}
      </p>
      <form onSubmit={submit}>
        <div ref={anchor} tabIndex={-1}>
          <ErrorNotice error={error} />
        </div>
        <Field label="Số tiền đã nhận (VND)">
          <input
            name="amountVnd"
            type="number"
            required
            min="1"
            max={invoice.outstandingAmountVnd ?? 0}
            step="1"
            disabled={busy}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Phương thức nhận tiền">
          <select
            name="method"
            required
            disabled={busy}
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            <option value="">Chọn phương thức…</option>
            {Object.entries(paymentMethods).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Thời điểm nhận tiền"
          hint="Giờ Việt Nam; có thể ghi khoản nhận trước kỳ học."
        >
          <input
            name="paidAt"
            type="datetime-local"
            required
            min="1900-01-01T00:00"
            max={initialDate}
            disabled={busy}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Ghi chú gửi gia đình" optional>
          <textarea
            name="publicNote"
            maxLength={1000}
            rows={2}
            disabled={busy}
            value={publicNote}
            onChange={(e) => setPublicNote(e.target.value)}
          />
        </Field>
        <Field label="Ghi chú riêng của cô" optional>
          <textarea
            name="internalNote"
            maxLength={1000}
            rows={2}
            disabled={busy}
            value={internalNote}
            onChange={(e) => setInternalNote(e.target.value)}
          />
        </Field>
        {!!error && (
          <button
            type="button"
            className="button button-ghost"
            disabled={busy}
            onClick={() => {
              if (discard()) onReload();
            }}
          >
            Đóng và cập nhật số liệu
          </button>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="button button-ghost"
            disabled={busy}
            onClick={close}
          >
            Quay lại
          </button>
          <button className="button button-primary" disabled={busy}>
            {busy ? "Đang ghi nhận…" : "Lưu khoản đã nhận"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function VoidPaymentModal({
  payment,
  invoice,
  onClose,
  onSaved,
  onReload,
}: {
  payment: TeacherPayment;
  invoice: TeacherInvoice;
  onClose: () => void;
  onSaved: () => void;
  onReload: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const anchor = usePaymentError(error);
  const discard = useUnsavedChanges(!!reason);
  function close() {
    if (!busy && discard()) onClose();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/payments/${payment.id}/void`, {
        version: payment.version,
        invoiceVersion: invoice.version,
        reason: reason.trim(),
      });
      onSaved();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Hủy bản ghi nhập sai" onClose={close} busy={busy}>
      <p>
        Khoản {moneyVnd(payment.amountVnd)} nhận lúc{" "}
        {dateTimeLabel(payment.paidAt)} sẽ được loại khỏi tổng đã thu. Nội dung
        gốc và lý do điều chỉnh được giữ lại.
      </p>
      <form onSubmit={submit}>
        <div ref={anchor} tabIndex={-1}>
          <ErrorNotice error={error} />
        </div>
        <Field label="Lý do hủy bản ghi">
          <textarea
            name="reason"
            required
            maxLength={1000}
            rows={3}
            disabled={busy}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        {!!error && (
          <button
            type="button"
            className="button button-ghost"
            disabled={busy}
            onClick={() => {
              if (discard()) onReload();
            }}
          >
            Đóng và cập nhật số liệu
          </button>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="button button-ghost"
            disabled={busy}
            onClick={close}
          >
            Quay lại
          </button>
          <button className="button button-primary" disabled={busy}>
            {busy ? "Đang lưu…" : "Xác nhận hủy bản ghi"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
