import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState, ErrorNotice } from "../components/ui";
import { api } from "../lib/api";
import { dateLabel, dateTimeLabel } from "../lib/format";
import { moneyVnd } from "../lib/tuition";
import { aggregateMoney } from "../lib/dashboard";
import type { BillingOverview, DashboardUpdates } from "../lib/dashboard";
import type { PersonalNotification } from "../lib/communications";
import { refreshNotificationBadge } from "../lib/communications";
import styles from "./DashboardPage.module.css";

export function BillingOverviewPanel({
  data,
  child,
  classId = "",
}: {
  data: BillingOverview;
  child?: string;
  classId?: string;
}) {
  const root = child
    ? `/family/children/${child}/invoices`
    : "/teacher/invoices";
  const filter = classId ? `&classId=${classId}` : "";
  // Four zero metrics say nothing the empty state does not; keep them for any real amount.
  const idle =
    data.openInvoiceCount === 0 &&
    (!!child || BigInt(data.receivedThisMonthVnd) === 0n);
  return (
    <section
      className={`panel ${styles.summaryPanel}`}
      aria-label="Tổng quan học phí"
    >
      <div className="section-heading">
        <div>
          <h2>Học phí cần theo dõi</h2>
          <p className="muted">
            Phiếu đã phát hành còn tiền cần thu, gồm lịch sử lớp đã kết thúc.
          </p>
        </div>
        <Link
          className="text-link"
          to={child ? root : `${root}?collection=OPEN${filter}`}
        >
          {child ? "Xem phiếu của bé" : "Xem phiếu còn phải thu"}
        </Link>
      </div>
      {!idle && (
        <dl className={styles.metrics}>
          <div>
            <dt>{child ? "Còn cần thanh toán" : "Còn phải thu"}</dt>
            <dd>{aggregateMoney(data.outstandingAmountVnd)}</dd>
          </div>
          <div>
            <dt>Phiếu còn phải thu</dt>
            <dd>{data.openInvoiceCount}</dd>
          </div>
          <div>
            <dt>Phiếu quá hạn</dt>
            <dd>{data.overdueInvoiceCount}</dd>
            {!child && (
              <Link to={`${root}?collection=OVERDUE${filter}`}>
                Xem phiếu quá hạn
              </Link>
            )}
          </div>
          {!child && (
            <div>
              <dt>Đã ghi nhận tháng này</dt>
              <dd>{aggregateMoney(data.receivedThisMonthVnd)}</dd>
              <small>
                Từ {dateLabel(data.monthStart)} · theo ngày nhận tiền, bỏ khoản
                đã hủy bản ghi
              </small>
            </div>
          )}
        </dl>
      )}
      {data.dueInvoices.length ? (
        <div className={styles.previewList}>
          {data.dueInvoices.map((invoice) => (
            <Link
              className={styles.previewRow}
              key={invoice.id}
              to={`${root}/${invoice.id}`}
            >
              <div>
                <h3>{invoice.invoiceCode}</h3>
                <p>
                  {child
                    ? invoice.className
                    : `${invoice.studentName} · ${invoice.className}`}
                </p>
                <small>
                  {invoice.dueOn
                    ? `Hạn ${dateLabel(invoice.dueOn)}`
                    : "Chưa đặt hạn thanh toán"}
                </small>
              </div>
              <strong>{moneyVnd(invoice.outstandingAmountVnd)}</strong>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Không có phiếu còn phải thu"
          icon="receipt"
          compact
        >
          Các khoản chưa phát hành hoặc đã hủy không được tính là khoản phải
          thu.
        </EmptyState>
      )}
    </section>
  );
}
export function UpdatesOverviewPanel({
  data,
  root,
  onRefresh,
}: {
  data: DashboardUpdates;
  root: "/teacher" | "/family";
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const navigate = useNavigate();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function open(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const current = await api.post<PersonalNotification>(
        `/notifications/${id}/read`,
        {},
      );
      if (mounted.current) {
        refreshNotificationBadge();
        navigate(current.targetPath);
      }
    } catch (failure) {
      if (mounted.current) {
        setError(failure);
        onRefresh();
        refreshNotificationBadge();
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section
      className={`panel ${styles.summaryPanel}`}
      aria-label="Cập nhật gần đây"
    >
      <div className="section-heading">
        <div>
          <h2>Cập nhật gần đây</h2>
          <p className="muted">
            {data.unreadCount} chưa đọc trong phạm vi đang xem
          </p>
        </div>
        <Link className="text-link" to={`${root}/updates`}>
          Mở hộp cập nhật
        </Link>
      </div>
      <ErrorNotice error={error} />
      {data.recent.length ? (
        <div className={styles.previewList}>
          {data.recent.map((row) => (
            <article className={styles.previewRow} key={row.id}>
              <div>
                <h3>{row.title}</h3>
                <p>
                  {row.studentName}
                  {row.className && ` · ${row.className}`}
                </p>
                <small>
                  {dateTimeLabel(row.createdAt)} ·{" "}
                  {row.readAt ? "Đã đọc" : "Chưa đọc"}
                </small>
              </div>
              <button
                className="button button-ghost"
                disabled={busy}
                onClick={() => open(row.id)}
              >
                Mở cập nhật
              </button>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Chưa có cập nhật để xem" icon="clock" compact>
          Các thay đổi bạn còn quyền đọc sẽ xuất hiện tại đây.
        </EmptyState>
      )}
    </section>
  );
}
