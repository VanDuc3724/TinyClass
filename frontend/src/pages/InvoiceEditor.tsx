import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Badge,
  EmptyState,
  ErrorNotice,
  Field,
  Loading,
  PageHeader,
} from "../components/ui";
import { api } from "../lib/api";
import { businessToday, dateTimeLabel } from "../lib/format";
import { useResource, useUnsavedChanges } from "../lib/hooks";
import type {
  BillingPreview,
  InvoiceLine,
  TeacherInvoice,
} from "../lib/invoices";
import { moneyVnd, pricingLabels } from "../lib/tuition";
import type { TeacherAgreement } from "../lib/tuition";
import { TermsSummary } from "./TuitionParts";
import styles from "./Invoices.module.css";

interface DraftLine {
  key: string;
  description: string;
  pricingBasis: InvoiceLine["pricingBasis"];
  quantity: string;
  unitPriceVnd: string;
  discountVnd: string;
  attendanceId: string | null;
}
const draftLine = (line?: InvoiceLine): DraftLine => ({
  key: crypto.randomUUID(),
  description: line?.description || "",
  pricingBasis: line?.pricingBasis || "OTHER",
  quantity: String(line?.quantity ?? 1),
  unitPriceVnd: String(line?.unitPriceVnd ?? ""),
  discountVnd: String(line?.discountVnd ?? 0),
  attendanceId: line?.attendanceId || null,
});
function estimated(lines: DraftLine[]) {
  let total = 0n;
  for (const line of lines) {
    if (
      ![line.quantity, line.unitPriceVnd, line.discountVnd].every((value) =>
        /^\d+$/.test(value),
      )
    )
      return null;
    const amount =
      BigInt(line.quantity) * BigInt(line.unitPriceVnd) -
      BigInt(line.discountVnd);
    if (amount < 0n) return null;
    total += amount;
  }
  return total <= 1000000000000n ? Number(total) : null;
}

export default function InvoiceEditorPage() {
  const { invoice } = useParams();
  const [params] = useSearchParams();
  const agreementId = params.get("agreement");
  const [generation, setGeneration] = useState(0);
  const resource = useResource(
    useCallback(
      async (signal) => {
        const saved = invoice
          ? await api.get<TeacherInvoice>(`/invoices/${invoice}`, signal)
          : null;
        const id = saved?.agreementId || agreementId;
        return {
          saved,
          agreement: id
            ? await api.get<TeacherAgreement>(
                `/tuition-agreements/${id}`,
                signal,
              )
            : null,
        };
      },
      [invoice, agreementId],
    ),
  );
  if (resource.loading && !resource.data) return <Loading />;
  if (resource.error || !resource.data)
    return <ErrorNotice error={resource.error} retry={resource.reload} />;
  const { saved, agreement } = resource.data;
  if (!agreement)
    return (
      <>
        <PageHeader
          eyebrow="PHIẾU HỌC PHÍ"
          title="Chọn thỏa thuận để lập phiếu"
        />
        <EmptyState
          title="Bắt đầu từ học phí của bé"
          action={
            <Link className="button button-primary" to="/teacher/classes">
              Chọn lớp học
            </Link>
          }
        >
          Mở lớp → Học phí → chọn bé → Lập phiếu trên thỏa thuận muốn dùng.
        </EmptyState>
      </>
    );
  if (saved && !saved.canEdit)
    return (
      <EmptyState
        title="Phiếu này chỉ được xem lại"
        action={
          <Link
            className="button button-primary"
            to={`/teacher/invoices/${saved.id}`}
          >
            Xem phiếu
          </Link>
        }
      >
        Chỉ phiếu nháp được chỉnh sửa.
      </EmptyState>
    );
  return (
    <InvoiceForm
      key={`${invoice || agreement.id}-${generation}-${saved?.version ?? 0}`}
      agreement={agreement}
      invoice={saved}
      onReload={() => {
        setGeneration((value) => value + 1);
        resource.reload();
      }}
    />
  );
}

function InvoiceForm({
  agreement,
  invoice,
  onReload,
}: {
  agreement: TeacherAgreement;
  invoice: TeacherInvoice | null;
  onReload: () => void;
}) {
  const navigate = useNavigate();
  const [requestId] = useState(() => crypto.randomUUID());
  const [initialFrom] = useState(
    () =>
      invoice?.periodStart ||
      [agreement.effectiveFrom, businessToday().slice(0, 8) + "01"]
        .sort()
        .at(-1)!,
  );
  const [initialTo] = useState(() => {
    if (invoice) return invoice.periodEnd;
    if (agreement.pricingMode === "FULL_PROGRAM")
      return agreement.effectiveTo || "";
    const today = businessToday();
    const monthEnd = new Date(
      Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0, 12),
    )
      .toISOString()
      .slice(0, 10);
    return [
      agreement.pricingMode === "MONTHLY_FIXED" ? monthEnd : today,
      agreement.effectiveTo || "2200-12-31",
    ].sort()[0];
  });
  const [from, setFrom] = useState(initialFrom),
    [to, setTo] = useState(initialTo),
    [due, setDue] = useState(invoice?.dueOn || "");
  const [initialLines] = useState(() => (invoice?.lines || []).map(draftLine));
  const [lines, setLines] = useState(initialLines);
  const [publicNote, setPublicNote] = useState(invoice?.publicNote || ""),
    [internalNote, setInternalNote] = useState(invoice?.internalNote || ""),
    [adjustment, setAdjustment] = useState(invoice?.adjustmentReason || ""),
    [reason, setReason] = useState("");
  const [preview, setPreview] = useState<BillingPreview | null>(null),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  const [linesTouched, setLinesTouched] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const dirty =
    linesTouched ||
    from !== initialFrom ||
    to !== initialTo ||
    due !== (invoice?.dueOn || "") ||
    publicNote !== (invoice?.publicNote || "") ||
    internalNote !== (invoice?.internalNote || "") ||
    adjustment !== (invoice?.adjustmentReason || "") ||
    !!reason;
  const discard = useUnsavedChanges(dirty);
  useEffect(() => {
    const guard = (event: MouseEvent) => {
      const link =
        event.target instanceof Element
          ? (event.target.closest("a[href]") as HTMLAnchorElement | null)
          : null;
      if (
        link &&
        dirty &&
        link.origin === location.origin &&
        link.pathname !== location.pathname &&
        !window.confirm("Bạn có thay đổi chưa lưu. Rời biểu mẫu này?")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", guard, true);
    return () => document.removeEventListener("click", guard, true);
  }, [dirty]);
  useEffect(() => {
    if (error) {
      anchor.current?.scrollIntoView({ block: "start" });
      anchor.current?.focus({ preventScroll: true });
    }
  }, [error]);
  async function loadPreview() {
    if (busy) return;
    if (!from || !to) {
      setError(new Error("Chọn đủ ngày đầu và ngày cuối kỳ để xem gợi ý."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<BillingPreview>("/billing/previews", {
        agreementId: agreement.id,
        periodStart: from,
        periodEnd: to,
        invoiceId: invoice?.id || null,
      });
      setPreview(result);
      if (!invoice && !linesTouched && !lines.length)
        setLines(result.suggestedLines.map(draftLine));
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  function useSuggestions() {
    if (!preview || busy) return;
    if (
      linesTouched &&
      !window.confirm(
        "Thay các dòng đang nhập bằng gợi ý mới? Ghi chú của cô được giữ lại.",
      )
    )
      return;
    setLines(preview.suggestedLines.map(draftLine));
    setLinesTouched(true);
  }
  function updateLine(index: number, key: keyof DraftLine, value: string) {
    setLinesTouched(true);
    setLines((current) =>
      current.map((line, i) =>
        i === index ? { ...line, [key]: value } : line,
      ),
    );
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !preview) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        clientRequestId: requestId,
        agreementId: agreement.id,
        version: invoice?.version ?? null,
        periodStart: from,
        periodEnd: to,
        dueOn: due || null,
        previewKey: preview.previewKey,
        lines: lines.map((line) => ({
          description: line.description.trim(),
          pricingBasis: line.pricingBasis,
          quantity: Number(line.quantity),
          unitPriceVnd: Number(line.unitPriceVnd),
          discountVnd: Number(line.discountVnd),
          attendanceId: line.attendanceId,
        })),
        publicNote: publicNote.trim() || null,
        internalNote: internalNote.trim() || null,
        adjustmentReason: adjustment.trim() || null,
        reason: reason.trim() || null,
      };
      const saved = invoice
        ? await api.put<TeacherInvoice>(`/invoices/${invoice.id}`, body)
        : await api.post<TeacherInvoice>("/invoices", body);
      navigate(`/teacher/invoices/${saved.id}`, { replace: true });
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  const total = estimated(lines),
    needsAdjustment = lines.some(
      (line) => line.pricingBasis === "OTHER" || Number(line.discountVnd) > 0,
    );
  const back = invoice
    ? `/teacher/invoices/${invoice.id}`
    : `/teacher/enrollments/${agreement.enrollmentId}/tuition`;
  const blocked =
    preview?.candidates.filter((candidate) => !candidate.billable) || [];
  return (
    <>
      <Link className="back-link" to={back}>
        ← {invoice ? "Chi tiết phiếu" : "Học phí của bé"}
      </Link>
      <PageHeader
        eyebrow={agreement.className}
        title={
          invoice
            ? `Sửa nháp · ${invoice.invoiceCode}`
            : `Lập phiếu · ${agreement.studentName}`
        }
        description="Kiểm tra gợi ý, chỉnh khoản thu rồi lưu nháp trước khi phát hành."
      />
      <div ref={anchor} tabIndex={-1} className={styles.errorAnchor}>
        <ErrorNotice error={error} />
      </div>
      {!!error && (
        <div className={styles.actions}>
          <button
            className="button button-ghost"
            disabled={busy}
            onClick={() => {
              if (discard()) onReload();
            }}
          >
            Tải lại dữ liệu đã lưu
          </button>
          <Link
            className="button button-ghost"
            to={`/teacher/invoices?enrollmentId=${agreement.enrollmentId}`}
          >
            Đối chiếu danh sách phiếu
          </Link>
        </div>
      )}
      <form onSubmit={submit}>
        <fieldset className={styles.fieldset} disabled={busy}>
          <section className={styles.card}>
            <div className={styles.heading}>
              <div>
                <h2>Kỳ lập phiếu</h2>
                <p>
                  {pricingLabels[agreement.pricingMode]} ·{" "}
                  {agreement.studentName}
                </p>
              </div>
            </div>
            <div className={styles.grid}>
              <Field label="Ngày đầu kỳ">
                <input
                  type="date"
                  required
                  min={agreement.effectiveFrom}
                  max={agreement.effectiveTo || "2200-12-31"}
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setPreview(null);
                  }}
                />
              </Field>
              <Field label="Ngày cuối kỳ">
                <input
                  type="date"
                  required
                  min={from || agreement.effectiveFrom}
                  max={agreement.effectiveTo || "2200-12-31"}
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setPreview(null);
                  }}
                />
              </Field>
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                className="button button-primary"
                onClick={loadPreview}
              >
                {busy
                  ? "Đang kiểm tra…"
                  : preview
                    ? "Kiểm tra lại nguồn"
                    : "Xem trước khoản thu"}
              </button>
              {preview && (
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={useSuggestions}
                >
                  Dùng các dòng gợi ý
                </button>
              )}
            </div>
            <p className="muted">
              Khoảng gồm cả hai ngày. Hệ thống không tự chia phí tháng theo ngày
              và không tự ghi nhận tiền đã thu.
            </p>
            {preview?.warnings.map((warning) => (
              <p className={styles.warning} key={warning}>
                {warning}
              </p>
            ))}
            {blocked.length > 0 && (
              <details className={styles.details}>
                <summary>Các buổi chưa được tính ({blocked.length})</summary>
                {blocked.map((row) => (
                  <div className={styles.blocked} key={row.attendanceId}>
                    <strong>{row.sessionTitle}</strong>
                    <small>{dateTimeLabel(row.startsAt)}</small>
                    <Badge status={row.attendanceStatus} />
                    <small>{row.blockedReason}</small>
                  </div>
                ))}
              </details>
            )}
            {preview && (
              <details className={styles.details}>
                <summary>Điều kiện đang dùng</summary>
                <TermsSummary terms={preview.termsSnapshot} />
              </details>
            )}
          </section>
          <section className={`${styles.card} ${styles.stack}`}>
            <div className={styles.heading}>
              <div>
                <h2>Các khoản trên phiếu</h2>
                <p>
                  Đơn giá theo nguồn được giữ; cô có thể giảm trừ hoặc thêm
                  khoản khác với lý do.
                </p>
              </div>
            </div>
            {!lines.length && (
              <p className="muted">
                Chưa có dòng tiền. Xem gợi ý hoặc thêm khoản thủ công; có thể
                lưu nháp trống để chuẩn bị.
              </p>
            )}
            {lines.map((line, index) => (
              <section
                className={styles.line}
                key={line.key}
                aria-label={`Dòng khoản thu ${index + 1}`}
              >
                <div className={styles.heading}>
                  <h3>
                    Dòng {index + 1} ·{" "}
                    {line.pricingBasis === "OTHER"
                      ? "Khoản thủ công"
                      : "Theo thỏa thuận"}
                  </h3>
                  <button
                    type="button"
                    className="button button-ghost"
                    aria-label={`Bỏ dòng ${index + 1}`}
                    onClick={() => {
                      setLinesTouched(true);
                      setLines((current) =>
                        current.filter((row) => row.key !== line.key),
                      );
                    }}
                  >
                    Bỏ dòng
                  </button>
                </div>
                <Field label={`Nội dung dòng ${index + 1}`}>
                  <input
                    required
                    maxLength={300}
                    value={line.description}
                    onChange={(e) =>
                      updateLine(index, "description", e.target.value)
                    }
                  />
                </Field>
                <div className={styles.lineGrid}>
                  <Field label={`Số lượng dòng ${index + 1}`}>
                    <input
                      type="number"
                      required
                      min="1"
                      max="10000"
                      step="1"
                      readOnly={line.pricingBasis !== "OTHER"}
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(index, "quantity", e.target.value)
                      }
                    />
                  </Field>
                  <Field label={`Đơn giá dòng ${index + 1} (VND)`}>
                    <input
                      type="number"
                      required
                      min="0"
                      max="1000000000000"
                      step="1"
                      readOnly={line.pricingBasis !== "OTHER"}
                      value={line.unitPriceVnd}
                      onChange={(e) =>
                        updateLine(index, "unitPriceVnd", e.target.value)
                      }
                    />
                  </Field>
                  <Field label={`Giảm trừ dòng ${index + 1} (VND)`}>
                    <input
                      type="number"
                      required
                      min="0"
                      max="1000000000000"
                      step="1"
                      value={line.discountVnd}
                      onChange={(e) =>
                        updateLine(index, "discountVnd", e.target.value)
                      }
                    />
                  </Field>
                </div>
              </section>
            ))}
            <button
              type="button"
              className="button button-ghost"
              disabled={lines.length >= 100}
              onClick={() => {
                setLinesTouched(true);
                setLines((current) => [...current, draftLine()]);
              }}
            >
              Thêm khoản thủ công
            </button>
            <p className={styles.total}>
              <small>Tổng dự kiến</small>
              {total === null
                ? "Kiểm tra số lượng, giá và giảm trừ"
                : moneyVnd(total)}
            </p>
            <Field
              label="Lý do điều chỉnh khoản thu"
              optional={!needsAdjustment}
              hint="Chỉ cô xem; cần khi giảm trừ hoặc thêm khoản thủ công."
            >
              <textarea
                rows={3}
                maxLength={1000}
                required={needsAdjustment}
                value={adjustment}
                onChange={(e) => setAdjustment(e.target.value)}
              />
            </Field>
          </section>
          <section className={styles.card}>
            <h2>Thông tin thêm</h2>
            <Field
              label="Hạn thanh toán"
              optional
              hint="Chọn độc lập với kỳ học; có thể trước kỳ khi cô thu trước."
            >
              <input
                type="date"
                min="1900-01-01"
                max="2200-12-31"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </Field>
            <Field label="Ghi chú gửi gia đình" optional>
              <textarea
                rows={3}
                maxLength={5000}
                value={publicNote}
                onChange={(e) => setPublicNote(e.target.value)}
              />
            </Field>
            <Field label="Ghi chú riêng của cô" optional>
              <textarea
                rows={3}
                maxLength={5000}
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
              />
            </Field>
            {invoice && (
              <Field label="Lý do sửa phiếu">
                <textarea
                  required
                  rows={2}
                  maxLength={1000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
            )}
          </section>
          <div className="form-actions">
            <Link className="button button-ghost" to={back}>
              Quay lại
            </Link>
            <button
              className="button button-primary"
              disabled={!preview || busy}
            >
              {busy ? "Đang lưu…" : "Lưu phiếu nháp"}
            </button>
          </div>
        </fieldset>
      </form>
    </>
  );
}
