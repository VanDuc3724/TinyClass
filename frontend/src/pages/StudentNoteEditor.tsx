import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ErrorNotice, Field, Icon, Modal } from "../components/ui";
import { api, ApiError, query } from "../lib/api";
import { bytes, fileUrl, uploadFile } from "../lib/files";
import { businessToday, dateTimeLabel } from "../lib/format";
import { useResource, useUnsavedChanges } from "../lib/hooks";
import type { NoteContexts, NoteFile, TeacherNote } from "../lib/studentNotes";
import { MediaPreview } from "./FilePages";
import styles from "./StudentNotes.module.css";

export default function StudentNoteEditor({
  child,
  name,
  note,
  onClose,
  onSaved,
  onRebase,
}: {
  child: string;
  name: string;
  note?: TeacherNote;
  onClose: () => void;
  onSaved: (note: TeacherNote) => void;
  onRebase: (note: TeacherNote) => void;
}) {
  const [clientRequestId] = useState(() => crypto.randomUUID());
  const [title, setTitle] = useState(note?.title || ""),
    [body, setBody] = useState(note?.body || ""),
    [on, setOn] = useState(note?.observedOn || businessToday());
  const [visibility, setVisibility] = useState<"PRIVATE" | "SHARED">(
      note?.visibility || "PRIVATE",
    ),
    [classId, setClassId] = useState(note?.classId || ""),
    [sessionId, setSessionId] = useState(note?.sessionId || "");
  const [attached, setAttached] = useState<NoteFile[]>(note?.attachments || []),
    [preview, setPreview] = useState<string | null>(null),
    [reason, setReason] = useState("");
  const [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState("");
  const errorAnchor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!error || (error instanceof ApiError && error.fieldErrors.length))
      return;
    errorAnchor.current?.scrollIntoView({ block: "start" });
    errorAnchor.current?.focus({ preventScroll: true });
  }, [error]);
  const dirty =
    title !== (note?.title || "") ||
    body !== (note?.body || "") ||
    on !== (note?.observedOn || businessToday()) ||
    visibility !== (note?.visibility || "PRIVATE") ||
    classId !== (note?.classId || "") ||
    sessionId !== (note?.sessionId || "") ||
    attached.map((file) => file.id).join() !==
      (note?.attachments || []).map((file) => file.id).join() ||
    !!reason;
  const confirmDiscard = useUnsavedChanges(dirty);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(on) ? on : businessToday();
  const contexts = useResource(
    useCallback(
      (signal) =>
        api.get<NoteContexts>(
          `/students/${child}/note-contexts${query({ on: date, classId })}`,
          signal,
        ),
      [child, date, classId],
    ),
  );
  const locked = busy || !!uploading;
  function close() {
    if (!locked && confirmDiscard()) onClose();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (locked) return;
    setBusy(true);
    setError(null);
    const fields = {
      title: title.trim(),
      body: body.trim(),
      observedOn: on,
      visibility,
      classId: classId || null,
      sessionId: sessionId || null,
      fileIds: attached.map((file) => file.id),
    };
    try {
      onSaved(
        note
          ? await api.patch<TeacherNote>(`/student-notes/${note.id}`, {
              ...fields,
              version: note.version,
              reason: reason.trim(),
            })
          : await api.post<TeacherNote>(`/students/${child}/notes`, {
              ...fields,
              clientRequestId,
            }),
      );
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  async function upload(values: File[]) {
    if (!values.length) return;
    if (attached.length + values.length > 5) {
      setError(
        new Error(
          "Mỗi nhận xét tối đa 5 tệp. Gỡ bớt tệp hoặc chọn ít tệp hơn.",
        ),
      );
      return;
    }
    if (
      attached.reduce((total, file) => total + file.sizeBytes, 0) +
        values.reduce((total, file) => total + file.size, 0) >
      250 * 1024 * 1024
    ) {
      setError(new Error("Tổng tệp của một nhận xét tối đa 250 MB."));
      return;
    }
    setError(null);
    try {
      for (const value of values) {
        setUploading(value.name);
        const file = await uploadFile(value, "NOTE_ASSET");
        setAttached((current) => [...current, file]);
      }
    } catch (failure) {
      setError(failure);
    } finally {
      setUploading("");
    }
  }
  async function rebase() {
    if (!note || !confirmDiscard()) return;
    setBusy(true);
    setError(null);
    try {
      onRebase(await api.get<TeacherNote>(`/student-notes/${note.id}`));
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${note ? "Chỉnh sửa nhận xét" : "Viết nhận xét"} · ${name}`}
      onClose={close}
      busy={locked}
      wide
    >
      {note?.archivedAt ? (
        <>
          <p className={styles.information}>
            Nhận xét đã lưu trữ. Khôi phục từ dòng thời gian trước khi chỉnh
            sửa.
          </p>
          <button className="button button-ghost" onClick={close}>
            Đóng
          </button>
        </>
      ) : (
        <form onSubmit={submit}>
          <div ref={errorAnchor} tabIndex={-1}>
            <ErrorNotice error={error} />
          </div>
          <Field label="Phạm vi nhận xét">
            <select
              value={visibility}
              disabled={locked}
              onChange={(event) =>
                setVisibility(event.target.value as "PRIVATE" | "SHARED")
              }
            >
              <option value="PRIVATE">Chỉ cô xem</option>
              <option value="SHARED">Chia sẻ với gia đình</option>
            </select>
          </Field>
          <p className={styles.information}>
            {visibility === "PRIVATE"
              ? "Nội dung và toàn bộ tệp chỉ cô xem được. Gia đình không thấy nhận xét này."
              : "Gia đình được liên kết với bé sẽ xem và tải toàn bộ tệp của nhận xét này. Các phiên bản riêng trước đây vẫn chỉ cô xem."}
          </p>
          <div className={styles.editorFields}>
            <Field label="Tiêu đề" optional>
              <input
                maxLength={200}
                value={title}
                disabled={locked}
                placeholder="Nhận xét của cô"
                onChange={(event) => setTitle(event.target.value)}
              />
            </Field>
            <Field label="Ngày ghi nhận">
              <input
                type="date"
                required
                min="1900-01-01"
                max={businessToday()}
                value={on}
                disabled={locked}
                onChange={(event) => {
                  setOn(event.target.value);
                  setSessionId("");
                }}
              />
            </Field>
          </div>
          <Field
            label="Nội dung nhận xét"
            hint="Ghi những điều cô quan sát được và gợi ý gia đình có thể cùng con thực hiện."
          >
            <textarea
              required
              rows={7}
              maxLength={10000}
              value={body}
              disabled={locked}
              onChange={(event) => setBody(event.target.value)}
            />
          </Field>
          <div className={styles.editorFields}>
            <Field label="Lớp liên quan" optional>
              <select
                value={classId}
                disabled={locked || !contexts.data}
                onChange={(event) => {
                  setClassId(event.target.value);
                  setSessionId("");
                }}
              >
                <option value="">Nhận xét chung về bé</option>
                {classId &&
                  !contexts.data?.classes.some(
                    (item) => item.id === classId,
                  ) && (
                    <option value={classId}>
                      {note?.className || "Lớp đã chọn"}
                    </option>
                  )}
                {contexts.data?.classes.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                    {item.enrollmentStatus === "WITHDRAWN"
                      ? " · Đã rời lớp"
                      : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Buổi liên quan" optional>
              <select
                value={sessionId}
                disabled={locked || !classId || !contexts.data}
                onChange={(event) => setSessionId(event.target.value)}
              >
                <option value="">Không gắn buổi cụ thể</option>
                {sessionId &&
                  !contexts.data?.sessions.some(
                    (item) => item.id === sessionId,
                  ) && (
                    <option value={sessionId}>
                      {note?.sessionTitle || "Buổi đã chọn"}
                    </option>
                  )}
                {contexts.data?.sessions.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.title} · {dateTimeLabel(item.startsAt)}
                    {item.status === "CANCELLED" ? " · Đã hủy" : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className={styles.hint}>
            Buổi học chỉ hiện khi đã bắt đầu, đúng ngày ghi nhận và phù hợp thời
            gian bé tham gia. Bỏ lớp/buổi nếu đây là nhận xét chung.
          </p>
          <ErrorNotice error={contexts.error} retry={contexts.reload} />
          <section
            className={styles.editorFiles}
            aria-label="Tệp đính kèm nhận xét"
          >
            <h3>Tệp đính kèm</h3>
            <p>
              Ảnh, PDF, âm thanh hoặc video · Tối đa 5 tệp, tổng 250 MB. Tệp
              được xem theo phạm vi nhận xét.
            </p>
            <Field label="Thêm tệp nhận xét" optional>
              <input
                type="file"
                multiple
                accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.mp3,.wav,.ogg,.mp4,.webm"
                disabled={locked || attached.length >= 5}
                onChange={(event) => {
                  const values = Array.from(event.currentTarget.files || []);
                  event.currentTarget.value = "";
                  void upload(values);
                }}
              />
            </Field>
            {uploading && (
              <p role="status" className={styles.information}>
                Đang tải {uploading}…
              </p>
            )}
            <ul className={styles.attachments}>
              {attached.map((file) => (
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
                      onClick={() =>
                        setPreview(preview === file.id ? null : file.id)
                      }
                    >
                      {preview === file.id ? "Đóng xem trước" : "Xem trước"}
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      disabled={locked}
                      onClick={() => {
                        setAttached((current) =>
                          current.filter((item) => item.id !== file.id),
                        );
                        if (preview === file.id) setPreview(null);
                      }}
                    >
                      Gỡ tệp
                    </button>
                  </div>
                  {preview === file.id && (
                    <div className={styles.preview}>
                      <MediaPreview
                        mime={file.mimeType}
                        url={fileUrl(file.id)}
                        name={file.originalName}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
          {note && (
            <Field
              label="Lý do chỉnh sửa"
              hint="Chỉ cô xem, được giữ trong lịch sử."
            >
              <textarea
                required
                rows={2}
                maxLength={1000}
                value={reason}
                disabled={locked}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
          )}
          <div className="form-actions">
            {note && (
              <button
                type="button"
                className="text-button"
                disabled={locked}
                onClick={() => void rebase()}
              >
                Tải lại bản mới
              </button>
            )}
            <button
              type="button"
              className="button button-ghost"
              disabled={locked}
              onClick={close}
            >
              Hủy
            </button>
            <button className="button button-primary" disabled={locked}>
              {busy
                ? "Đang lưu…"
                : visibility === "SHARED"
                  ? note
                    ? "Lưu và chia sẻ"
                    : "Chia sẻ nhận xét"
                  : "Lưu chỉ cô xem"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
