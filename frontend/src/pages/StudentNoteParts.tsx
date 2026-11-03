import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  ErrorNotice,
  Icon,
  Loading,
  Modal,
  Pagination,
} from "../components/ui";
import { api } from "../lib/api";
import { bytes } from "../lib/files";
import { dateLabel, dateTimeLabel } from "../lib/format";
import { useResource } from "../lib/hooks";
import { isTeacherNote, noteFileUrl } from "../lib/studentNotes";
import type {
  NoteFile,
  NoteHistory,
  ProgressProduct,
  SharedNote,
  TeacherNote,
} from "../lib/studentNotes";
import { MediaPreview } from "./FilePages";
import styles from "./StudentNotes.module.css";

export function NoteCard({
  note,
  child,
  disabled,
  onEdit,
  onState,
  onHistory,
  onPreview,
}: {
  note: SharedNote | TeacherNote;
  child?: string;
  disabled?: boolean;
  onEdit?: (note: TeacherNote) => void;
  onState?: (note: TeacherNote) => void;
  onHistory?: (note: TeacherNote) => void;
  onPreview: (note: SharedNote, file: NoteFile) => void;
}) {
  const managed = !child && isTeacherNote(note) ? note : null;
  return (
    <article className={styles.entry} aria-label={`Nhận xét ${note.title}`}>
      <div className={styles.meta}>
        <span
          className={`${styles.visibility} ${managed?.visibility === "PRIVATE" ? styles.private : styles.shared}`}
        >
          <Icon
            name={managed?.visibility === "PRIVATE" ? "lock" : "eye"}
            width={16}
            height={16}
          />
          {managed?.visibility === "PRIVATE"
            ? "Chỉ cô xem"
            : "Chia sẻ với gia đình"}
        </span>
        {managed?.archivedAt && <Badge status="ARCHIVED" />}
      </div>
      <h2>{note.title}</h2>
      <p className="muted">
        Ghi nhận ngày {dateLabel(note.observedOn)} · {note.authorName}
      </p>
      {(note.className || note.sessionTitle) && (
        <div className={styles.context}>
          {note.className && <span>{note.className}</span>}
          {note.sessionTitle && <span>{note.sessionTitle}</span>}
          {note.sessionStatus === "CANCELLED" && <Badge status="CANCELLED" />}
        </div>
      )}
      <p className={styles.text}>{note.body}</p>
      {note.attachments.length > 0 && (
        <ul className={styles.attachments} aria-label="Tệp của nhận xét">
          {note.attachments.map((file) => (
            <li key={file.id}>
              <Icon name="book" />
              <div className={styles.fileName}>
                <strong>{file.originalName}</strong>
                <small>{bytes(file.sizeBytes)}</small>
              </div>
              <div className={styles.fileActions}>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => onPreview(note, file)}
                >
                  Xem tệp
                </button>
                <a
                  className="text-link"
                  href={noteFileUrl(note.id, file.id, child, "download")}
                >
                  Tải tệp
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.hint}>Cập nhật {dateTimeLabel(note.updatedAt)}</p>
      {managed && (
        <div className={styles.actions}>
          <button
            className="button button-ghost"
            disabled={disabled || !!managed.archivedAt}
            onClick={() => onEdit?.(managed)}
          >
            <Icon name="edit" />
            Chỉnh sửa
          </button>
          <button
            className="text-button"
            disabled={disabled}
            onClick={() => onHistory?.(managed)}
          >
            Lịch sử thay đổi
          </button>
          <button
            className="text-button"
            disabled={disabled}
            onClick={() => onState?.(managed)}
          >
            {managed.archivedAt ? "Khôi phục nhận xét" : "Lưu trữ nhận xét"}
          </button>
        </div>
      )}
    </article>
  );
}
export function ProgressProductCard({
  product,
  child,
  teacher = false,
}: {
  product: ProgressProduct;
  child: string;
  teacher?: boolean;
}) {
  return (
    <article
      className={styles.entry}
      aria-label={`Sản phẩm ${product.lessonTitle}`}
    >
      <div className={styles.meta}>
        <span className={`${styles.visibility} ${styles.product}`}>
          <Icon name="book" width={16} height={16} />
          Sản phẩm đã gửi
        </span>
        <Badge context="submission" status={product.status} />
      </div>
      <h2>{product.lessonTitle}</h2>
      <p className="muted">
        {product.assignmentTitle} · Lượt {product.attemptNumber}, vòng{" "}
        {product.reviewCycle + 1}
      </p>
      <p className="muted">
        {dateTimeLabel(product.submittedAt)} · {product.submittedByName}
      </p>
      {product.className && (
        <div className={styles.context}>
          <span>{product.className}</span>
        </div>
      )}
      {product.textResponse && (
        <p className={styles.text}>{product.textResponse}</p>
      )}
      {product.attachmentCount > 0 && (
        <p className="muted">Có {product.attachmentCount} tệp sản phẩm</p>
      )}
      {product.feedbackText && (
        <div className={styles.feedback}>
          <strong>Lời nhắn của cô</strong>
          <p className={styles.text}>{product.feedbackText}</p>
        </div>
      )}
      <div className={styles.actions}>
        <Link
          className="button button-ghost"
          to={
            teacher
              ? `/teacher/reviews/${product.id}`
              : `/family/children/${child}/submissions/${product.id}`
          }
        >
          Xem sản phẩm và phản hồi
          <Icon name="arrow" />
        </Link>
      </div>
    </article>
  );
}
export function NotePreview({
  note,
  file,
  child,
  onClose,
}: {
  note: SharedNote;
  file: NoteFile;
  child?: string;
  onClose: () => void;
}) {
  return (
    <Modal title={file.originalName} onClose={onClose}>
      <p className="muted">
        {note.title} · {bytes(file.sizeBytes)}
      </p>
      <div className={styles.preview}>
        <MediaPreview
          mime={file.mimeType}
          url={noteFileUrl(note.id, file.id, child)}
          name={file.originalName}
        />
      </div>
      <a
        className="button button-primary"
        href={noteFileUrl(note.id, file.id, child, "download")}
      >
        Tải tệp
        <Icon name="arrow" />
      </a>
    </Modal>
  );
}
export function StudentNoteHistory({
  note,
  onClose,
}: {
  note: TeacherNote;
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const resource = useResource(
    useCallback(
      (signal) =>
        api.list<NoteHistory>(
          `/student-notes/${note.id}/history?page=${page}&size=10`,
          signal,
        ),
      [note.id, page],
    ),
  );
  const labels: Record<string, string> = {
    STUDENT_NOTE_CREATED: "Tạo nhận xét",
    STUDENT_NOTE_UPDATED: "Chỉnh sửa nhận xét",
    STUDENT_NOTE_ARCHIVED: "Lưu trữ nhận xét",
    STUDENT_NOTE_RESTORED: "Khôi phục nhận xét",
  };
  return (
    <Modal title="Lịch sử nhận xét · Chỉ cô xem" onClose={onClose} wide>
      <p className="muted">
        Giữ các phiên bản cũ để đối chiếu. Gia đình chỉ thấy nội dung hiện đang
        được chia sẻ.
      </p>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading && !resource.data ? (
        <Loading />
      ) : (
        resource.data && (
          <>
            <ol className={styles.history}>
              {resource.data.data.map((event) => (
                <li key={event.id}>
                  <strong>{labels[event.action] || "Thay đổi nhận xét"}</strong>
                  <p className="muted">
                    {dateTimeLabel(event.createdAt)} · {event.actorName}
                  </p>
                  {event.reason && <p>{event.reason}</p>}
                  <details>
                    <summary>Xem nội dung trước và sau</summary>
                    {event.changedFields.before?.body && (
                      <NoteSnapshot
                        title="Trước thay đổi"
                        note={event.changedFields.before}
                      />
                    )}
                    <NoteSnapshot
                      title="Sau thay đổi"
                      note={event.changedFields.after}
                    />
                  </details>
                </li>
              ))}
            </ol>
            <Pagination meta={resource.data.meta} onChange={setPage} />
          </>
        )
      )}
    </Modal>
  );
}
function NoteSnapshot({
  title,
  note,
}: {
  title: string;
  note: Partial<TeacherNote>;
}) {
  return (
    <section className={styles.snapshot}>
      <h3>{title}</h3>
      <p>
        <strong>{note.title}</strong> ·{" "}
        {note.visibility === "PRIVATE" ? "Chỉ cô xem" : "Chia sẻ với gia đình"}
        {note.archivedAt ? " · Đã lưu trữ" : ""}
      </p>
      <p className={styles.text}>{note.body}</p>
      {!!note.attachments?.length && (
        <p>
          Tệp: {note.attachments.map((file) => file.originalName).join(", ")}
        </p>
      )}
    </section>
  );
}
