import { useCallback, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ActionModal } from "../components/ActionModal";
import {
  Badge,
  EmptyState,
  ErrorNotice,
  Field,
  Loading,
  PageHeader,
  Pagination,
} from "../components/ui";
import { api, query } from "../lib/api";
import { dateLabel } from "../lib/format";
import { useResource } from "../lib/hooks";
import type {
  FamilyInvoiceWorkspace,
  InvoiceSummary,
  PublicInvoice,
  TeacherInvoice,
} from "../lib/invoices";
import { moneyVnd } from "../lib/tuition";
import {
  InvoiceContent,
  InvoiceHistoryModal,
  IssueInvoiceModal,
} from "./InvoiceParts";
import styles from "./Invoices.module.css";
import { PaymentPanel, PaymentSummary } from "./PaymentParts";
import { RecordPaymentModal, VoidPaymentModal } from "./PaymentForms";
import type { TeacherPayment } from "../lib/payments";

function InvoiceCard({ invoice, to }: { invoice: InvoiceSummary; to: string }) {
  return (
    <article
      className={styles.card}
      aria-label={`Phiếu ${invoice.invoiceCode}`}
    >
      <div className={styles.heading}>
        <div>
          <h2>
            <Link to={to}>{invoice.invoiceCode}</Link>
          </h2>
          <p>
            {invoice.studentName} · {invoice.className}
          </p>
        </div>
        <Badge status={invoice.status} />
      </div>
      <p>
        Kỳ {dateLabel(invoice.periodStart)} – {dateLabel(invoice.periodEnd)}
      </p>
      <p className={styles.total}>
        <small>Tổng phiếu</small>
        {moneyVnd(invoice.totalAmountVnd)}
      </p>
      <PaymentSummary invoice={invoice} />
      <Link className="button button-ghost" to={to}>
        Xem phiếu {invoice.invoiceCode}
      </Link>
    </article>
  );
}
export function InvoiceListPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") || "",
    collection = params.get("collection") || "",
    page = Math.max(0, Number(params.get("page")) || 0),
    enrollment = params.get("enrollmentId") || "",
    classId = params.get("classId") || "",
    student = params.get("studentId") || "";
  const resource = useResource(
    useCallback(
      (signal) =>
        api.list<InvoiceSummary>(
          `/invoices${query({ status, collection, page, size: 20, enrollmentId: enrollment, classId, studentId: student })}`,
          signal,
        ),
      [status, collection, page, enrollment, classId, student],
    ),
  );
  function change(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  }
  return (
    <>
      <PageHeader
        eyebrow="QUẢN LÝ HỌC PHÍ"
        title="Phiếu học phí"
        description="Chuẩn bị khoản thu, kiểm tra rồi phát hành cho gia đình."
        action={
          <Link className="button button-primary" to="/teacher/invoices/new">
            Lập phiếu mới
          </Link>
        }
      />
      <div className={styles.toolbar}>
        <Field label="Tình hình thu phí">
          <select
            value={collection}
            onChange={(e) => change("collection", e.target.value)}
          >
            <option value="">Tất cả</option>
            <option value="OPEN">Còn phải thu</option>
            <option value="OVERDUE">Quá hạn và còn tiền</option>
            <option value="SETTLED">Đã đủ / không cần thu</option>
          </select>
        </Field>
        <Field label="Trạng thái phiếu">
          <select
            value={status}
            onChange={(e) => change("status", e.target.value)}
          >
            <option value="">Tất cả</option>
            <option value="DRAFT">Bản nháp</option>
            <option value="ISSUED">Đã phát hành</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>
        </Field>
        <div className={styles.actions}>
          {(enrollment || classId || student) && (
            <Link className="button button-ghost" to="/teacher/invoices">
              Bỏ lọc theo bé/lớp
            </Link>
          )}
          <button className="button button-ghost" onClick={resource.reload}>
            Cập nhật danh sách
          </button>
        </div>
      </div>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Loading />
      ) : (
        resource.data && (
          <>
            {resource.data.data.length ? (
              <div className={styles.stack}>
                {resource.data.data.map((invoice) => (
                  <InvoiceCard
                    key={invoice.id}
                    invoice={invoice}
                    to={`/teacher/invoices/${invoice.id}`}
                  />
                ))}
              </div>
            ) : (
              <EmptyState title="Chưa có phiếu trong danh sách" icon="book">
                Chọn thỏa thuận của bé để xem trước và tạo phiếu nháp.
              </EmptyState>
            )}
            <Pagination
              meta={resource.data.meta}
              onChange={(value) => change("page", String(value))}
            />
          </>
        )
      )}
    </>
  );
}
export function InvoiceDetailPage() {
  const { invoice } = useParams();
  return <InvoiceDetail key={invoice} id={invoice!} />;
}
function InvoiceDetail({ id }: { id: string }) {
  const resource = useResource(
    useCallback(
      (signal) => api.get<TeacherInvoice>(`/invoices/${id}`, signal),
      [id],
    ),
  );
  const [action, setAction] = useState<"issue" | "cancel" | "history" | null>(
    null,
  );
  const [recording, setRecording] = useState(false),
    [voiding, setVoiding] = useState<TeacherPayment | null>(null),
    [paymentRevision, setPaymentRevision] = useState(0);
  if (resource.loading && !resource.data) return <Loading />;
  if (!resource.data || resource.error)
    return <ErrorNotice error={resource.error} retry={resource.reload} />;
  const invoice = resource.data;
  function refresh() {
    setAction(null);
    setRecording(false);
    setVoiding(null);
    setPaymentRevision((value) => value + 1);
    resource.reload();
  }
  return (
    <>
      <Link
        className="back-link"
        to={`/teacher/invoices?enrollmentId=${invoice.enrollmentId}`}
      >
        ← Danh sách phiếu của bé
      </Link>
      <PageHeader
        eyebrow="PHIẾU HỌC PHÍ"
        title={invoice.invoiceCode}
        description="Số tiền và điều kiện được giữ theo từng phiếu."
        action={
          <button className="button button-ghost" onClick={refresh}>
            Cập nhật phiếu
          </button>
        }
      />
      <div className={styles.actions}>
        {invoice.canRecordPayment && (
          <button
            className="button button-primary"
            disabled={resource.loading}
            onClick={() => setRecording(true)}
          >
            Ghi nhận thanh toán
          </button>
        )}
        {invoice.canEdit && (
          <Link
            className="button button-ghost"
            to={`/teacher/invoices/${id}/edit`}
          >
            Sửa phiếu nháp
          </Link>
        )}
        {invoice.canIssue && (
          <button
            className="button button-primary"
            disabled={resource.loading}
            onClick={() => setAction("issue")}
          >
            Phát hành phiếu
          </button>
        )}
        {invoice.canCancel && (
          <button
            className="button button-ghost"
            disabled={resource.loading}
            onClick={() => setAction("cancel")}
          >
            Hủy phiếu
          </button>
        )}
        <button
          className="button button-ghost"
          disabled={resource.loading}
          onClick={() => setAction("history")}
        >
          Lịch sử phiếu
        </button>
      </div>
      {invoice.status === "ISSUED" && invoice.paidAmountVnd > 0 && (
        <p className={styles.information}>
          Phiếu đang có khoản thu hợp lệ nên chưa thể hủy. Nếu nhập sai, cô điều
          chỉnh bản ghi tương ứng kèm lý do.
        </p>
      )}
      {invoice.sourceChanged && (
        <p className={styles.warning}>
          Nguồn tính phí đã thay đổi.{" "}
          {invoice.canEdit
            ? "Chỉnh sửa và kiểm tra lại gợi ý trước khi phát hành."
            : "Phiếu đã phát hành giữ nguyên số tiền. Cô cần đối chiếu dữ liệu mới trước khi quyết định điều chỉnh."}
        </p>
      )}
      {invoice.warnings.map((warning) => (
        <p className={styles.information} key={warning}>
          {warning}
        </p>
      ))}
      <div className={styles.stack}>
        <InvoiceContent invoice={invoice} teacher />
        <PaymentPanel
          invoiceId={id}
          revision={paymentRevision}
          pending={resource.loading}
          onVoid={setVoiding}
          onRefresh={refresh}
        />
      </div>
      {recording && (
        <RecordPaymentModal
          invoice={invoice}
          onClose={() => setRecording(false)}
          onSaved={refresh}
          onReload={refresh}
        />
      )}
      {voiding && (
        <VoidPaymentModal
          invoice={invoice}
          payment={voiding}
          onClose={() => setVoiding(null)}
          onSaved={refresh}
          onReload={refresh}
        />
      )}
      {action === "issue" && (
        <IssueInvoiceModal
          invoice={invoice}
          onClose={() => setAction(null)}
          onSaved={refresh}
        />
      )}
      {action === "cancel" && (
        <ActionModal
          action={{
            title: "Hủy phiếu học phí",
            description: `Phiếu ${invoice.invoiceCode} được giữ lại; các buổi đang giữ/tính sẽ được giải phóng để lập phiếu đúng. Hủy phiếu không ghi nhận hoàn tiền.`,
            label: "Xác nhận hủy phiếu",
            reasonRequired: true,
            run: (reason) =>
              api.post(`/invoices/${id}/cancel`, {
                version: invoice.version,
                reason,
              }),
          }}
          onClose={() => setAction(null)}
          onSuccess={refresh}
        />
      )}
      {action === "history" && (
        <InvoiceHistoryModal invoice={id} onClose={() => setAction(null)} />
      )}
    </>
  );
}
export function FamilyInvoiceListPage() {
  const { child } = useParams();
  return <FamilyInvoices key={child} child={child!} />;
}
function FamilyInvoices({ child }: { child: string }) {
  const [page, setPage] = useState(0);
  const resource = useResource(
    useCallback(
      (signal) =>
        api.get<FamilyInvoiceWorkspace>(
          `/family/children/${child}/invoices?page=${page}&size=10`,
          signal,
        ),
      [child, page],
    ),
  );
  if (resource.loading && !resource.data) return <Loading />;
  if (!resource.data || resource.error)
    return <ErrorNotice error={resource.error} retry={resource.reload} />;
  const data = resource.data;
  return (
    <>
      <Link className="back-link" to={`/family/children/${child}/tuition`}>
        ← Điều kiện học phí của bé
      </Link>
      <PageHeader
        eyebrow={`CÙNG GIA ĐÌNH ${data.student.fullName.toLocaleUpperCase("vi-VN")}`}
        title="Phiếu học phí"
        description="Các phiếu cô đã phát hành cho bé và lịch sử phiếu đã hủy."
        action={
          <button className="button button-ghost" onClick={resource.reload}>
            Cập nhật phiếu
          </button>
        }
      />
      {data.invoices.data.length ? (
        <div className={styles.stack}>
          {data.invoices.data.map((invoice) => (
            <InvoiceCard
              key={invoice.id}
              invoice={invoice}
              to={`/family/children/${child}/invoices/${invoice.id}`}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="Cô chưa phát hành phiếu học phí" icon="book">
          Các phiếu đã chia sẻ sẽ hiện tại đây.
        </EmptyState>
      )}
      <Pagination meta={data.invoices.meta} onChange={setPage} />
    </>
  );
}
export function FamilyInvoiceDetailPage() {
  const { child, invoice } = useParams();
  return (
    <FamilyInvoiceDetail
      key={`${child}-${invoice}`}
      child={child!}
      id={invoice!}
    />
  );
}
function FamilyInvoiceDetail({ child, id }: { child: string; id: string }) {
  const [paymentRevision, setPaymentRevision] = useState(0);
  const resource = useResource(
    useCallback(
      (signal) =>
        api.get<PublicInvoice>(
          `/family/children/${child}/invoices/${id}`,
          signal,
        ),
      [child, id],
    ),
  );
  if (resource.loading && !resource.data) return <Loading />;
  if (!resource.data || resource.error)
    return <ErrorNotice error={resource.error} retry={resource.reload} />;
  const invoice = resource.data;
  function refresh() {
    setPaymentRevision((value) => value + 1);
    resource.reload();
  }
  return (
    <>
      <Link className="back-link" to={`/family/children/${child}/invoices`}>
        ← Phiếu học phí của bé
      </Link>
      <PageHeader
        eyebrow="PHIẾU HỌC PHÍ CỦA BÉ"
        title={invoice.invoiceCode}
        description="Liên hệ cô nếu gia đình cần làm rõ khoản thu trên phiếu."
        action={
          <button className="button button-ghost" onClick={refresh}>
            Cập nhật phiếu
          </button>
        }
      />
      <div className={styles.stack}>
        <InvoiceContent invoice={invoice} />
        <PaymentPanel
          invoiceId={id}
          child={child}
          revision={paymentRevision}
          pending={resource.loading}
          onRefresh={refresh}
        />
      </div>
    </>
  );
}
