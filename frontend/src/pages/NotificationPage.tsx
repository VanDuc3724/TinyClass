import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import VerificationPrompt from "../auth/VerificationPrompt";
import {
  EmptyState,
  ErrorNotice,
  Field,
  Loading,
  PageHeader,
  Pagination,
} from "../components/ui";
import { api } from "../lib/api";
import { useResource } from "../lib/hooks";
import { dateTimeLabel } from "../lib/format";
import { refreshNotificationBadge } from "../lib/communications";
import type { PersonalNotification } from "../lib/communications";
import styles from "./Communications.module.css";

export default function NotificationPage() {
  const { account } = useAuth(),
    navigate = useNavigate();
  const enabled = account?.role === "TEACHER" || !!account?.emailVerifiedAt;
  const [status, setStatus] = useState(""),
    [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const resource = useResource(
    useCallback(
      (signal) =>
        enabled
          ? api.list<PersonalNotification>(
              `/notifications?status=${status}&page=${page}&size=12`,
              signal,
            )
          : Promise.resolve(null),
      [enabled, page, status],
    ),
  );
  async function read(row: PersonalNotification, open: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const current = await api.post<PersonalNotification>(
        `/notifications/${row.id}/read`,
        {},
      );
      refreshNotificationBadge();
      if (open) navigate(current.targetPath);
      else resource.reload();
    } catch (failure) {
      setError(failure);
      resource.reload();
      refreshNotificationBadge();
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="TIN MỚI TRONG TINYCLASS"
        title="Cập nhật của bạn"
        description="Bài học, phản hồi, lịch học và học phí trong phạm vi bạn được xem."
        action={
          <button
            className="button button-ghost"
            disabled={resource.loading || busy}
            onClick={() => {
              resource.reload();
              refreshNotificationBadge();
            }}
          >
            Cập nhật danh sách
          </button>
        }
      />
      {!enabled ? (
        <VerificationPrompt />
      ) : (
        <>
          <div className={styles.filters}>
            <Field label="Lọc cập nhật">
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">Tất cả</option>
                <option value="UNREAD">Chưa đọc</option>
                <option value="READ">Đã đọc</option>
              </select>
            </Field>
          </div>
          <ErrorNotice
            error={error || resource.error}
            retry={resource.reload}
          />
          {resource.loading && !resource.data ? (
            <Loading />
          ) : (
            resource.data && (
              <div className={styles.list}>
                {resource.data.data.length ? (
                  resource.data.data.map((row) => (
                    <article
                      className={`${styles.card} ${!row.readAt ? styles.unread : ""}`}
                      key={row.id}
                    >
                      <div className={styles.heading}>
                        <h2>{row.title}</h2>
                        <span
                          className={
                            row.readAt ? styles.readLabel : "text-link"
                          }
                        >
                          {row.readAt ? "Đã đọc" : "Chưa đọc"}
                        </span>
                      </div>
                      <p>
                        {row.studentName}
                        {row.className && ` · ${row.className}`}
                      </p>
                      <p className="muted">{dateTimeLabel(row.createdAt)}</p>
                      <div className={styles.actions}>
                        <button
                          className="button button-primary"
                          disabled={busy || resource.loading}
                          onClick={() => read(row, true)}
                        >
                          Xem cập nhật
                        </button>
                        {!row.readAt && (
                          <button
                            className="button button-ghost"
                            disabled={busy || resource.loading}
                            onClick={() => read(row, false)}
                          >
                            Đánh dấu đã đọc
                          </button>
                        )}
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyState title="Chưa có cập nhật trong mục này">
                    Những thay đổi bạn được xem sẽ xuất hiện tại đây.
                  </EmptyState>
                )}
                <Pagination meta={resource.data.meta} onChange={setPage} />
              </div>
            )
          )}
        </>
      )}
    </>
  );
}
