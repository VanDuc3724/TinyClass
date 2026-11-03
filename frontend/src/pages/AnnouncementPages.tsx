import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import VerificationPrompt from "../auth/VerificationPrompt";
import {
  Badge,
  EmptyState,
  ErrorNotice,
  Field,
  Loading,
  Modal,
  PageHeader,
  Pagination,
} from "../components/ui";
import { api } from "../lib/api";
import { useResource, useUnsavedChanges } from "../lib/hooks";
import { dateTimeLabel } from "../lib/format";
import type { Announcement } from "../lib/communications";
import { refreshNotificationBadge } from "../lib/communications";
import styles from "./Communications.module.css";

interface ClassChoice {
  id: string;
  name: string;
  status: string;
}
function useEditorError(error: unknown) {
  const anchor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) {
      anchor.current?.scrollIntoView({ block: "start" });
      anchor.current?.focus({ preventScroll: true });
    }
  }, [error]);
  return anchor;
}
function useClasses(enabled: boolean) {
  return useResource(
    useCallback(
      async (signal) => {
        const rows: ClassChoice[] = [];
        if (enabled)
          for (let page = 0; ; page++) {
            const r = await api.list<ClassChoice>(
              `/classes?page=${page}&size=100`,
              signal,
            );
            rows.push(...r.data);
            if (page + 1 >= r.meta.totalPages) break;
          }
        return rows;
      },
      [enabled],
    ),
  );
}
export function AnnouncementListPage({ family = false }: { family?: boolean }) {
  const { child } = useParams(),
    { account } = useAuth();
  const [query, setQuery] = useSearchParams(),
    [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState(""),
    [search, setSearch] = useState("");
  const classroom = query.get("classId") || "";
  const enabled = !family || !!account?.emailVerifiedAt;
  const classes = useClasses(!family);
  const base = family
    ? `/family/children/${child}/announcements`
    : "/announcements";
  const root = family
    ? `/family/children/${child}/announcements`
    : "/teacher/announcements";
  const resource = useResource(
    useCallback(
      (signal) =>
        enabled
          ? api.list<Announcement>(
              `${base}?classId=${classroom}&status=${status}&q=${encodeURIComponent(search)}&page=${page}&size=12`,
              signal,
            )
          : Promise.resolve(null),
      [enabled, base, classroom, status, search, page],
    ),
  );
  return (
    <>
      <PageHeader
        eyebrow={family ? "CÙNG LỚP CỦA BÉ" : "KẾT NỐI VỚI GIA ĐÌNH"}
        title="Thông báo lớp"
        description={
          family
            ? "Những thông tin cô chia sẻ trong các lớp bé đang được xem."
            : "Soạn nháp, đăng cho gia đình và lưu lại các lần cập nhật."
        }
        action={
          !family && (
            <button
              className="button button-primary"
              onClick={() => setCreating(true)}
            >
              Soạn thông báo
            </button>
          )
        }
      />
      {!enabled ? (
        <VerificationPrompt />
      ) : (
        <>
          <div className={styles.filters}>
            {!family && (
              <>
                <Field label="Lọc theo lớp">
                  <select
                    value={classroom}
                    onChange={(e) => {
                      setQuery(
                        e.target.value ? { classId: e.target.value } : {},
                      );
                      setPage(0);
                    }}
                  >
                    <option value="">Tất cả lớp</option>
                    {classes.data?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Trạng thái thông báo">
                  <select
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="">Tất cả</option>
                    <option value="DRAFT">Bản nháp</option>
                    <option value="PUBLISHED">Đã đăng</option>
                    <option value="ARCHIVED">Đã lưu trữ</option>
                  </select>
                </Field>
                <Field label="Tìm tiêu đề">
                  <input
                    value={search}
                    maxLength={150}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(0);
                    }}
                  />
                </Field>
              </>
            )}
            <button
              className="button button-ghost"
              disabled={resource.loading}
              onClick={resource.reload}
            >
              Cập nhật bảng tin
            </button>
          </div>
          <ErrorNotice
            error={resource.error || classes.error}
            retry={resource.reload}
          />
          {resource.loading && !resource.data ? (
            <Loading />
          ) : (
            resource.data && (
              <div className={styles.list}>
                {resource.data.data.length ? (
                  resource.data.data.map((row) => (
                    <article key={row.id} className={styles.card}>
                      <div className={styles.heading}>
                        <h2>{row.title}</h2>
                        {row.status ? (
                          <Badge status={row.status} />
                        ) : (
                          <span
                            className={
                              row.isRead ? styles.readLabel : "text-link"
                            }
                          >
                            {row.isRead ? "Đã đọc" : "Chưa đọc"}
                          </span>
                        )}
                      </div>
                      <p>{row.className}</p>
                      {row.excerpt && (
                        <p className={styles.body}>{row.excerpt}</p>
                      )}
                      <p className="muted">
                        {row.publishedAt
                          ? `Đăng: ${dateTimeLabel(row.publishedAt)}`
                          : "Bản nháp, chỉ cô xem"}{" "}
                        · Cập nhật: {dateTimeLabel(row.updatedAt)}
                      </p>
                      <Link
                        to={`${root}/${row.id}`}
                        className="button button-ghost"
                      >
                        Xem thông báo
                      </Link>
                    </article>
                  ))
                ) : (
                  <EmptyState title="Chưa có thông báo trong mục này">
                    {family
                      ? "Thông báo được đăng của lớp sẽ xuất hiện tại đây."
                      : "Cô có thể soạn nháp trước khi chia sẻ cho gia đình."}
                  </EmptyState>
                )}
                <Pagination meta={resource.data.meta} onChange={setPage} />
              </div>
            )
          )}
        </>
      )}
      {creating && (
        <AnnouncementEditor
          choices={classes.data || []}
          initialClass={classroom}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            resource.reload();
          }}
          onReload={() => {
            setCreating(false);
            resource.reload();
          }}
        />
      )}
    </>
  );
}
export function AnnouncementDetailPage({
  family = false,
}: {
  family?: boolean;
}) {
  const { child, announcement } = useParams(),
    { account } = useAuth();
  const enabled = !family || !!account?.emailVerifiedAt;
  const base = family
    ? `/family/children/${child}/announcements/${announcement}`
    : `/announcements/${announcement}`;
  const back = family
    ? `/family/children/${child}/announcements`
    : "/teacher/announcements";
  const resource = useResource(
    useCallback(
      (signal) =>
        enabled ? api.get<Announcement>(base, signal) : Promise.resolve(null),
      [enabled, base],
    ),
  );
  const [editing, setEditing] = useState(false),
    [archiving, setArchiving] = useState(false),
    [history, setHistory] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const row = resource.data;
  function refresh() {
    setEditing(false);
    setArchiving(false);
    setError(null);
    resource.reload();
    refreshNotificationBadge();
  }
  async function action(name: "publish" | "read") {
    if (!row || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(
        `${base}/${name}`,
        name === "read" ? { revision: row.revision } : { version: row.version },
      );
      refresh();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  if (!enabled) return <VerificationPrompt />;
  if (resource.loading && !row) return <Loading />;
  if (resource.error || !row)
    return <ErrorNotice error={resource.error} retry={refresh} />;
  const pending = busy || resource.loading;
  return (
    <>
      <Link to={back} className="text-link">
        ← Bảng tin lớp
      </Link>
      <PageHeader
        eyebrow={row.className}
        title={row.title}
        action={
          <button
            className="button button-ghost"
            disabled={pending}
            onClick={refresh}
          >
            Cập nhật thông báo
          </button>
        }
      />
      <ErrorNotice error={error} />
      <section className={styles.card}>
        <div className={styles.heading}>
          {row.status ? (
            <Badge status={row.status} />
          ) : (
            <span className={row.isRead ? styles.readLabel : "text-link"}>
              {row.isRead ? "Đã đọc bản hiện tại" : "Chưa đọc bản hiện tại"}
            </span>
          )}
          <span className="muted">Cập nhật {dateTimeLabel(row.updatedAt)}</span>
        </div>
        {row.publishedAt && (
          <p className="muted">
            Đăng lần đầu {dateTimeLabel(row.publishedAt)} · Bản công bố{" "}
            {row.revision}
          </p>
        )}
        <p className={styles.body}>{row.body}</p>
        <div className={styles.actions}>
          {family ? (
            !row.isRead && (
              <button
                className="button button-primary"
                disabled={pending}
                onClick={() => action("read")}
              >
                Đánh dấu đã đọc
              </button>
            )
          ) : (
            <>
              {row.canEdit && (
                <button
                  className="button button-ghost"
                  disabled={pending}
                  onClick={() => setEditing(true)}
                >
                  Chỉnh sửa thông báo
                </button>
              )}
              {row.canPublish && (
                <button
                  className="button button-primary"
                  disabled={pending}
                  onClick={() => action("publish")}
                >
                  Đăng cho gia đình
                </button>
              )}
              {row.canArchive && (
                <button
                  className="button button-ghost"
                  disabled={pending}
                  onClick={() => setArchiving(true)}
                >
                  Lưu trữ thông báo
                </button>
              )}
              <button
                className="button button-ghost"
                disabled={pending}
                onClick={() => setHistory(true)}
              >
                Lịch sử thông báo
              </button>
            </>
          )}
        </div>
      </section>
      {editing && (
        <AnnouncementEditor
          row={row}
          onClose={() => setEditing(false)}
          onSaved={refresh}
          onReload={refresh}
        />
      )}
      {archiving && (
        <ArchiveAnnouncement
          row={row}
          onClose={() => setArchiving(false)}
          onSaved={refresh}
        />
      )}
      {history && (
        <AnnouncementHistory id={row.id} onClose={() => setHistory(false)} />
      )}
    </>
  );
}
function AnnouncementEditor({
  row,
  choices = [],
  initialClass = "",
  onClose,
  onSaved,
  onReload,
}: {
  row?: Announcement;
  choices?: ClassChoice[];
  initialClass?: string;
  onClose: () => void;
  onSaved: () => void;
  onReload: () => void;
}) {
  const [key] = useState(() => crypto.randomUUID());
  const [classId, setClassId] = useState(row?.classId || initialClass),
    [title, setTitle] = useState(row?.title || ""),
    [body, setBody] = useState(row?.body || ""),
    [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const anchor = useEditorError(error);
  const discard = useUnsavedChanges(
    title !== (row?.title || "") ||
      body !== (row?.body || "") ||
      !!reason ||
      classId !== (row?.classId || initialClass),
  );
  function close() {
    if (!busy && discard()) onClose();
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (row)
        await api.put(`/announcements/${row.id}`, {
          version: row.version,
          title: title.trim(),
          body: body.trim(),
          reason: reason.trim(),
        });
      else
        await api.post("/announcements", {
          clientRequestId: key,
          classId,
          title: title.trim(),
          body: body.trim(),
        });
      onSaved();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={row ? "Chỉnh sửa thông báo" : "Soạn thông báo"}
      onClose={close}
      busy={busy}
    >
      {row?.status === "PUBLISHED" && (
        <p>Gia đình sẽ thấy bản mới và cần đọc lại sau khi cô lưu.</p>
      )}
      <form onSubmit={save}>
        <div ref={anchor} tabIndex={-1}>
          <ErrorNotice error={error} />
        </div>
        {!row && (
          <Field label="Lớp nhận thông báo">
            <select
              required
              disabled={busy}
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="">Chọn lớp…</option>
              {choices
                .filter((c) => ["DRAFT", "ACTIVE"].includes(c.status))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </Field>
        )}
        <Field label="Tiêu đề">
          <input
            required
            disabled={busy}
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label="Nội dung">
          <textarea
            required
            disabled={busy}
            rows={8}
            maxLength={10000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </Field>
        {row && (
          <Field label="Lý do chỉnh sửa" hint="Chỉ cô xem trong lịch sử.">
            <textarea
              required
              disabled={busy}
              rows={2}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        )}
        {!!error && (
          <button
            type="button"
            className="button button-ghost"
            disabled={busy}
            onClick={() => {
              if (discard()) onReload();
            }}
          >
            Đóng và cập nhật
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
            {busy ? "Đang lưu…" : row ? "Lưu thay đổi" : "Lưu bản nháp"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function ArchiveAnnouncement({
  row,
  onClose,
  onSaved,
}: {
  row: Announcement;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const anchor = useEditorError(error);
  const discard = useUnsavedChanges(!!reason);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/announcements/${row.id}/archive`, {
        version: row.version,
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
    <Modal
      title="Lưu trữ thông báo"
      busy={busy}
      onClose={() => {
        if (!busy && discard()) onClose();
      }}
    >
      <p>
        Thông báo được giữ trong lịch sử của cô và ngừng hiển thị cho gia đình.
      </p>
      <form onSubmit={save}>
        <div ref={anchor} tabIndex={-1}>
          <ErrorNotice error={error} />
        </div>
        <Field label="Lý do lưu trữ" hint="Chỉ cô xem.">
          <textarea
            required
            disabled={busy}
            rows={3}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <div className="form-actions">
          <button className="button button-primary" disabled={busy}>
            Xác nhận lưu trữ
          </button>
        </div>
      </form>
    </Modal>
  );
}
interface History {
  id: string;
  action: string;
  actorName: string;
  reason: string | null;
  createdAt: string;
  changedFields: {
    before: Partial<Announcement>;
    after: Partial<Announcement>;
  };
}
function AnnouncementHistory({
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
        api.list<History>(
          `/announcements/${id}/history?page=${page}&size=10`,
          signal,
        ),
      [id, page],
    ),
  );
  const labels: Record<string, string> = {
    ANNOUNCEMENT_CREATED: "Tạo bản nháp",
    ANNOUNCEMENT_PUBLISHED: "Đăng cho gia đình",
    ANNOUNCEMENT_UPDATED: "Chỉnh sửa nội dung",
    ANNOUNCEMENT_ARCHIVED: "Lưu trữ thông báo",
  };
  return (
    <Modal title="Lịch sử thông báo" onClose={onClose}>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Loading />
      ) : (
        resource.data && (
          <>
            {resource.data.data.map((event) => (
              <article className={styles.card} key={event.id}>
                <h3>{labels[event.action] || event.action}</h3>
                <p className="muted">
                  {event.actorName} · {dateTimeLabel(event.createdAt)}
                </p>
                {event.reason && <p>Lý do riêng: {event.reason}</p>}
                {(["before", "after"] as const).map(
                  (key) =>
                    event.changedFields[key]?.id && (
                      <details key={key}>
                        <summary>
                          {key === "before" ? "Trước thay đổi" : "Sau thay đổi"}
                        </summary>
                        <h4>{event.changedFields[key].title}</h4>
                        <p className={styles.body}>
                          {event.changedFields[key].body}
                        </p>
                      </details>
                    ),
                )}
              </article>
            ))}
            <Pagination meta={resource.data.meta} onChange={setPage} />
          </>
        )
      )}
    </Modal>
  );
}
