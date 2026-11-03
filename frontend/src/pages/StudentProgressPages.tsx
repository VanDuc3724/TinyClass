import { useCallback, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ActionModal } from "../components/ActionModal";
import type { ActionRequest } from "../components/ActionModal";
import {
  Badge,
  EmptyState,
  ErrorNotice,
  Icon,
  Loading,
  PageHeader,
  Pagination,
} from "../components/ui";
import { api, query } from "../lib/api";
import { useResource } from "../lib/hooks";
import type {
  NoteFile,
  ProgressWorkspace,
  SharedNote,
  TeacherNote,
} from "../lib/studentNotes";
import StudentNoteEditor from "./StudentNoteEditor";
import {
  NoteCard,
  NotePreview,
  ProgressProductCard,
  StudentNoteHistory,
} from "./StudentNoteParts";
import styles from "./StudentNotes.module.css";

export default function StudentProgressPage({
  family = false,
}: {
  family?: boolean;
}) {
  const { child } = useParams();
  const [params, setParams] = useSearchParams();
  const type = ["ALL", "NOTE", "SUBMISSION"].includes(params.get("type") || "")
    ? params.get("type")!
    : "ALL";
  const rawPage = Number(params.get("page") || 0),
    page = Number.isSafeInteger(rawPage) && rawPage >= 0 ? rawPage : 0,
    archived = !family && params.get("archived") === "true";
  const url = `${family ? `/family/children/${child}` : `/students/${child}`}/progress${query({ type, archived: archived ? "true" : undefined, page, size: 20 })}`;
  const resource = useResource(
    useCallback((signal) => api.get<ProgressWorkspace>(url, signal), [url]),
  );
  const [editor, setEditor] = useState<{
      child: string;
      note?: TeacherNote;
      revision: number;
    } | null>(null),
    [history, setHistory] = useState<{
      child: string;
      note: TeacherNote;
    } | null>(null);
  const [preview, setPreview] = useState<{
      child: string;
      note: SharedNote;
      file: NoteFile;
    } | null>(null),
    [action, setAction] = useState<{
      child: string;
      request: ActionRequest;
    } | null>(null),
    [notice, setNotice] = useState<{ child: string; message: string } | null>(
      null,
    );
  const data = resource.data;
  function filter(patch: Record<string, string>) {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    );
    next.delete("page");
    setParams(next);
  }
  function changeState(note: TeacherNote) {
    const archive = !note.archivedAt;
    setAction({
      child: child!,
      request: {
        title: archive
          ? "Lưu trữ nhận xét"
          : note.visibility === "SHARED"
            ? "Khôi phục và chia sẻ lại"
            : "Khôi phục nhận xét",
        label: archive ? "Lưu trữ nhận xét" : "Xác nhận khôi phục",
        reasonRequired: true,
        description: archive
          ? "Nhận xét và tệp sẽ ngừng hiển thị với gia đình. Lịch sử được giữ để cô xem lại."
          : note.visibility === "SHARED"
            ? "Khôi phục sẽ chia sẻ lại nội dung hiện tại và toàn bộ tệp với gia đình còn liên kết với bé."
            : "Nhận xét trở về danh sách riêng, chỉ cô xem được.",
        run: (reason) =>
          api.post(
            `/student-notes/${note.id}/${archive ? "archive" : "restore"}`,
            { version: note.version, reason },
          ),
      },
    });
  }
  return (
    <>
      <Link
        className="back-link"
        to={family ? `/family/children/${child}` : `/teacher/students/${child}`}
      >
        ← Về hồ sơ bé
      </Link>
      <PageHeader
        eyebrow="TỪNG BƯỚC LỚN KHÔN"
        title={
          data
            ? `Hành trình của ${data.student.fullName}`
            : "Nhận xét và tiến bộ"
        }
        description="Những ghi nhận của cô và sản phẩm trên hành trình học của bé."
        action={
          !family &&
          data && (
            <button
              className="button button-primary"
              disabled={resource.loading || data.student.status !== "ACTIVE"}
              onClick={() => setEditor({ child: child!, revision: 0 })}
            >
              <Icon name="plus" />
              Viết nhận xét
            </button>
          )
        }
      />
      {notice && notice.child === child && (
        <p className={styles.notice} role="status">
          {notice.message}
        </p>
      )}
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading && !data ? (
        <Loading />
      ) : (
        data && (
          <>
            {data.student.status !== "ACTIVE" && (
              <p className={styles.information}>
                Hồ sơ bé đã lưu trữ. Các ghi nhận được giữ để xem lại.
              </p>
            )}
            <div className={styles.summary} aria-label="Tổng hợp hành trình">
              <section className={styles.stat}>
                <p>Nhận xét chia sẻ</p>
                <strong>{data.counts.sharedNotes}</strong>
                <small>
                  {!family && data.counts.privateNotes !== undefined
                    ? `${data.counts.privateNotes} nhận xét chỉ cô xem`
                    : "Các ghi nhận đang được cô chia sẻ"}
                </small>
              </section>
              <section className={styles.stat}>
                <p>Sản phẩm đã gửi</p>
                <strong>{data.counts.submittedProducts}</strong>
                <small>Theo từng lượt gia đình gửi</small>
              </section>
              <section className={styles.stat}>
                <p>Được cô chấp nhận</p>
                <strong>{data.counts.acceptedProducts}</strong>
                <small>Theo từng lượt được cô duyệt</small>
              </section>
            </div>
            <div className={styles.toolbar}>
              <div
                className={styles.tabs}
                role="group"
                aria-label="Loại ghi nhận"
              >
                {(
                  [
                    ["ALL", "Tất cả"],
                    ["NOTE", "Nhận xét"],
                    ["SUBMISSION", "Sản phẩm"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    className={`button button-ghost ${type === value ? styles.selected : ""}`}
                    aria-pressed={type === value}
                    onClick={() => filter({ type: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="button button-ghost"
                disabled={resource.loading}
                onClick={resource.reload}
              >
                Cập nhật hành trình
              </button>
            </div>
            {!family && (
              <label className={styles.archiveFilter}>
                <input
                  type="checkbox"
                  checked={archived}
                  onChange={(event) =>
                    filter({ archived: event.target.checked ? "true" : "" })
                  }
                />
                Bao gồm nhận xét lưu trữ
              </label>
            )}
            {data.timeline.data.length ? (
              <ol
                className={styles.timeline}
                aria-label="Dòng thời gian của bé"
              >
                {data.timeline.data.map((entry) => (
                  <li key={`${entry.type}:${entry.id}`}>
                    {entry.type === "NOTE" ? (
                      <NoteCard
                        note={entry.note}
                        child={family ? child : undefined}
                        disabled={resource.loading}
                        onEdit={(note) =>
                          setEditor({ child: child!, note, revision: 0 })
                        }
                        onState={changeState}
                        onHistory={(note) =>
                          setHistory({ child: child!, note })
                        }
                        onPreview={(note, file) =>
                          setPreview({ child: child!, note, file })
                        }
                      />
                    ) : (
                      <ProgressProductCard
                        product={entry.submission}
                        child={child!}
                        teacher={!family}
                      />
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <section className="panel">
                <EmptyState
                  icon="leaf"
                  title={
                    type === "SUBMISSION"
                      ? "Chưa có sản phẩm đã gửi"
                      : type === "NOTE"
                        ? "Chưa có nhận xét trong mục này"
                        : "Những ghi nhận đầu tiên đang chờ bé"
                  }
                >
                  {family
                    ? "Nhận xét cô chia sẻ và sản phẩm đã gửi sẽ xuất hiện tại đây."
                    : "Viết một nhận xét về điều cô quan sát được, hoặc xem lại sản phẩm gia đình đã gửi."}
                </EmptyState>
              </section>
            )}
            <Pagination
              meta={data.timeline.meta}
              onChange={(value) => {
                const next = new URLSearchParams(params);
                next.set("page", String(value));
                setParams(next);
              }}
            />
          </>
        )
      )}
      {!family && data && editor && editor.child === child && (
        <StudentNoteEditor
          key={`${child}:${editor.note?.id || "new"}:${editor.revision}`}
          child={child!}
          name={data.student.fullName}
          note={editor.note}
          onClose={() => setEditor(null)}
          onSaved={(note) => {
            setEditor(null);
            setNotice({
              child: child!,
              message:
                note.visibility === "SHARED"
                  ? "Đã lưu và chia sẻ nhận xét với gia đình."
                  : "Đã lưu nhận xét chỉ cô xem.",
            });
            filter({ type: "NOTE" });
            resource.reload();
          }}
          onRebase={(note) =>
            setEditor((current) => ({
              child: child!,
              note,
              revision: (current?.revision || 0) + 1,
            }))
          }
        />
      )}
      {!family && data && history && history.child === child && (
        <StudentNoteHistory
          note={history.note}
          onClose={() => setHistory(null)}
        />
      )}
      {data && preview && preview.child === child && (
        <NotePreview
          note={preview.note}
          file={preview.file}
          child={family ? child : undefined}
          onClose={() => setPreview(null)}
        />
      )}
      {!family && data && action && action.child === child && (
        <ActionModal
          action={action.request}
          onClose={() => setAction(null)}
          onSuccess={() => {
            setAction(null);
            setNotice({
              child: child!,
              message: "Đã cập nhật trạng thái nhận xét.",
            });
            resource.reload();
          }}
        />
      )}
      {!family && data && (
        <p className={styles.hint}>
          <Badge status={data.student.status} /> · Nhận xét riêng và lịch sử sửa
          chỉ cô xem được. Lưu trữ nhận xét giữ dữ liệu để đối chiếu.
        </p>
      )}
    </>
  );
}
