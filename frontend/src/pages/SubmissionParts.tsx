import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Badge,
  EmptyState,
  ErrorNotice,
  Field,
  Icon,
  Loading,
  Pagination,
} from "../components/ui";
import { api } from "../lib/api";
import { bytes } from "../lib/files";
import { dateTimeLabel } from "../lib/format";
import { useResource, useUnsavedChanges } from "../lib/hooks";
import { productUrl, responseLabels } from "../lib/submissions";
import type {
  ProductFile,
  Submission,
  SubmissionEvent,
  SubmissionWorkspace,
} from "../lib/submissions";
import { MediaPreview } from "./FilePages";
import styles from "./Submissions.module.css";

export function ProductHistory({ events }: { events: SubmissionEvent[] }) {
  const labels: Record<string, string> = {
    SUBMITTED: "Gia đình gửi sản phẩm",
    ACCEPTED: "Cô chấp nhận sản phẩm",
    CHANGES_REQUESTED: "Cô yêu cầu bổ sung",
    REOPENED: "Cô mở lại yêu cầu",
  };
  if (!events.length) return null;
  return (
    <section className={styles.history}>
      <h3>Lịch sử yêu cầu</h3>
      <ol>
        {events.map((event) => (
          <li key={event.id}>
            <span className={styles.eventDot} />
            <div>
              <strong>{labels[event.eventType] || event.eventType}</strong>
              <p className="muted">
                {dateTimeLabel(event.createdAt)} · {event.actorName} · Vòng{" "}
                {event.reviewCycle + 1}
              </p>
              {event.reason && <p className={styles.text}>{event.reason}</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
export function SubmissionBody({
  submission,
  teacher = false,
}: {
  submission: Submission;
  teacher?: boolean;
}) {
  return (
    <>
      <section className={`panel ${styles.body}`}>
        <div className={styles.heading}>
          <div>
            <h2>
              Lượt {submission.attemptNumber} · Vòng{" "}
              {submission.reviewCycle + 1}
            </h2>
            <p className="muted">
              {submission.submittedByName} ·{" "}
              {dateTimeLabel(submission.submittedAt || submission.createdAt)}
            </p>
          </div>
          <Badge context="submission" status={submission.status} />
        </div>
        {submission.late && (
          <p className={styles.late}>
            <Icon name="clock" />
            Gửi sau hạn gợi ý · Cô vẫn nhận sản phẩm của bé
          </p>
        )}
        {submission.textResponse && (
          <p className={styles.text}>{submission.textResponse}</p>
        )}
        {!!submission.attachments?.length && (
          <div className={styles.mediaGrid}>
            {submission.attachments.map((file) => (
              <article key={file.id}>
                <h3>{file.originalName}</h3>
                <MediaPreview
                  mime={file.mimeType}
                  url={productUrl(submission, file.id, teacher)}
                  name={file.originalName}
                />
                <a
                  className="text-link"
                  href={productUrl(submission, file.id, teacher, "download")}
                >
                  Tải sản phẩm · {bytes(file.sizeBytes)}
                  <Icon name="arrow" />
                </a>
              </article>
            ))}
          </div>
        )}
        {submission.status === "DRAFT" &&
          !submission.textResponse &&
          !submission.attachments?.length && (
            <p className="muted">Bản nháp chưa có nội dung sản phẩm.</p>
          )}
      </section>
      {(submission.feedbackText || submission.feedbackAudioFileId) && (
        <section
          className={`panel ${styles.feedback} ${submission.status === "CHANGES_REQUESTED" ? styles.revision : ""}`}
        >
          <p className="eyebrow">PHẢN HỒI CỦA CÔ</p>
          <h2>
            {submission.status === "ACCEPTED"
              ? "Cô đã ghi nhận bước tiến của bé"
              : "Cùng bé bổ sung nhé"}
          </h2>
          {submission.feedbackText && (
            <p className={styles.text}>{submission.feedbackText}</p>
          )}
          {submission.feedbackAudioFileId && (
            <audio
              aria-label="Nghe phản hồi của cô"
              controls
              preload="metadata"
              src={productUrl(
                submission,
                submission.feedbackAudioFileId,
                teacher,
              )}
            />
          )}
          <p className="muted">
            {submission.reviewedByName} · {dateTimeLabel(submission.reviewedAt)}
          </p>
        </section>
      )}
      <ProductHistory events={submission.events || []} />
    </>
  );
}

export function FamilyProductPanel({
  child,
  item,
  onChanged,
}: {
  child: string;
  item: string;
  onChanged: () => void;
}) {
  const [page, setPage] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [notice, setNotice] = useState("");
  const resource = useResource(
    useCallback(
      (signal) =>
        api.get<SubmissionWorkspace>(
          `/family/children/${child}/assignment-items/${item}/submissions?page=${page}&size=5`,
          signal,
        ),
      [child, item, page],
    ),
  );
  async function create() {
    setBusy(true);
    setError(null);
    try {
      await api.post(
        `/family/children/${child}/assignment-items/${item}/submissions`,
        {},
      );
      resource.reload();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  const data = resource.data;
  function refresh() {
    resource.reload();
    onChanged();
  }
  return (
    <section
      className={`panel ${styles.productPanel}`}
      aria-busy={resource.loading}
    >
      <div className={styles.heading}>
        <div>
          <p className="eyebrow">CÙNG GHI LẠI KHÁM PHÁ</p>
          <h2>Sản phẩm của bé</h2>
          <p className="muted">
            Cô nhận:{" "}
            {data?.allowedResponseTypes
              .map((type) => responseLabels[type] || type)
              .join(", ") || "Đang tải yêu cầu…"}
          </p>
        </div>
        <button
          className="button button-ghost"
          onClick={refresh}
          disabled={busy}
        >
          Cập nhật phản hồi
        </button>
      </div>
      <ErrorNotice
        error={error || resource.error}
        retry={resource.error ? resource.reload : undefined}
      />
      {notice && (
        <p className="info-notice" role="status">
          {notice}
        </p>
      )}
      {resource.loading && !data ? (
        <Loading />
      ) : (
        data && (
          <>
            {data.progress && (
              <p className={styles.progressLabel}>
                <Badge status={data.progress.status} />
                <span>Vòng hiện tại: {data.reviewCycle + 1}</span>
              </p>
            )}
            {data.ownDraft && data.canEdit ? (
              <DraftComposer
                key={data.ownDraft.id}
                initial={data.ownDraft}
                allowed={data.allowedResponseTypes}
                canSubmit={data.progress?.status !== "SUBMITTED"}
                onSaved={() => resource.reload()}
                onSubmitted={() => {
                  setNotice(
                    "Đã gửi sản phẩm cho cô. Gia đình có thể xem lại lượt gửi bên dưới.",
                  );
                  refresh();
                }}
              />
            ) : data.canCreate ? (
              <button
                className="button button-primary"
                disabled={busy}
                onClick={() => void create()}
              >
                <Icon name="plus" />
                {data.submissions.meta.totalElements
                  ? "Tạo lượt gửi mới"
                  : "Tạo bản nháp sản phẩm"}
              </button>
            ) : (
              <p className="muted">
                {data.progress?.status === "SUBMITTED"
                  ? "Sản phẩm đã gửi, mình chờ cô phản hồi nhé. Gia đình không sửa trực tiếp lượt đã gửi."
                  : data.progress?.status === "COMPLETED"
                    ? "Bé đã hoàn thành yêu cầu. Muốn làm lại, gia đình có thể nhờ cô mở vòng mới."
                    : "Bài hiện chỉ xem lại, không nhận nháp hoặc sản phẩm mới."}
              </p>
            )}
            <div className={styles.heading}>
              <h3>Các lượt sản phẩm</h3>
              <Link
                className="text-link"
                to={`/family/children/${child}/submissions`}
              >
                Tất cả sản phẩm của bé
                <Icon name="arrow" />
              </Link>
            </div>
            {data.submissions.data.length ? (
              <div className={styles.attempts}>
                {data.submissions.data.map((submission) => (
                  <Link
                    key={submission.id}
                    className={styles.attempt}
                    to={`/family/children/${child}/submissions/${submission.id}`}
                  >
                    <div>
                      <strong>
                        Lượt {submission.attemptNumber} · Vòng{" "}
                        {submission.reviewCycle + 1}
                      </strong>
                      <p className="muted">
                        {submission.submittedByName} ·{" "}
                        {dateTimeLabel(
                          submission.submittedAt || submission.createdAt,
                        )}
                      </p>
                      {submission.feedbackText && (
                        <p className={styles.preview}>
                          {submission.feedbackText}
                        </p>
                      )}
                    </div>
                    <Badge context="submission" status={submission.status} />
                    <Icon name="arrow" />
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="Giữ lại một khám phá nhỏ của bé" icon="book">
                Lưu nháp trước, kiểm tra sản phẩm rồi chọn gửi cho cô. Chỉ khi
                cô chấp nhận, bài mới được đánh dấu hoàn thành.
              </EmptyState>
            )}
            <Pagination meta={data.submissions.meta} onChange={setPage} />
            <ProductHistory events={data.events} />
          </>
        )
      )}
    </section>
  );
}

function DraftComposer({
  initial,
  allowed,
  canSubmit,
  onSaved,
  onSubmitted,
}: {
  initial: Submission;
  allowed: string[];
  canSubmit: boolean;
  onSaved: () => void;
  onSubmitted: () => void;
}) {
  const [saved, setSaved] = useState(initial),
    [text, setText] = useState(initial.textResponse || ""),
    [attached, setAttached] = useState<ProductFile[]>(
      initial.attachments || [],
    ),
    [selected, setSelected] = useState<File[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [notice, setNotice] = useState("");
  const dirty =
    text !== (saved.textResponse || "") ||
    attached.map((f) => f.id).join() !==
      (saved.attachments || []).map((f) => f.id).join() ||
    selected.length > 0;
  useUnsavedChanges(dirty);
  const extensions: Record<string, string> = {
    IMAGE: ".png,.jpg,.jpeg,.gif,.webp",
    AUDIO: ".mp3,.wav,.ogg",
    VIDEO: ".mp4,.webm",
  };
  const accept = allowed
    .filter((type) => type !== "TEXT")
    .map((type) => extensions[type])
    .filter(Boolean)
    .join(",");
  async function persist(files = attached, current = saved) {
    const updated = await api.patch<Submission>(`/submissions/${saved.id}`, {
      version: current.version,
      textResponse: text,
      fileIds: files.map((f) => f.id),
    });
    setSaved(updated);
    setAttached(updated.attachments);
    onSaved();
    return updated;
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      await persist();
      setNotice("Đã lưu bản nháp. Chưa gửi cho cô.");
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  async function upload() {
    if (
      attached.length + selected.length > 5 ||
      [...attached, ...selected.map((f) => ({ sizeBytes: f.size }))].reduce(
        (sum, f) => sum + f.sizeBytes,
        0,
      ) >
        250 * 1024 * 1024
    ) {
      setError(
        new Error("Chọn tối đa 5 tệp, tổng dung lượng không quá 250 MB."),
      );
      return;
    }
    setBusy(true);
    setError(null);
    setNotice("");
    let next = attached,
      current = saved;
    try {
      for (const file of selected) {
        const body = new FormData();
        body.append("file", file);
        const uploaded = await api.upload<ProductFile>(
          `/family/children/${saved.studentId}/submissions/${saved.id}/files`,
          body,
        );
        next = [...next, uploaded];
        setAttached(next);
        setSelected((previous) => previous.filter((value) => value !== file));
        current = await persist(next, current);
      }
      setNotice(
        "Đã tải tệp và lưu bản nháp. Gia đình kiểm tra rồi gửi cho cô.",
      );
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (selected.length) {
      setError(new Error("Tải các tệp đã chọn lên trước khi gửi sản phẩm."));
      return;
    }
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      const current = await persist();
      await api.post(`/submissions/${saved.id}/submit`, {
        version: current.version,
      });
      onSubmitted();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className={styles.composer} onSubmit={save}>
      <div className={styles.heading}>
        <h3>Bản nháp của gia đình · Lượt {saved.attemptNumber}</h3>
        <Badge context="submission" status="DRAFT" />
      </div>
      <ErrorNotice error={error} />
      {notice && (
        <p className="info-notice" role="status">
          {notice}
        </p>
      )}
      {allowed.includes("TEXT") && (
        <Field
          label="Nội dung sản phẩm"
          hint="Gia đình có thể ghi lại cách bé thực hiện. Tối đa 5.000 ký tự."
        >
          <textarea
            name="textResponse"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={5000}
            disabled={busy}
            rows={5}
            placeholder="Cùng bé kể lại hoạt động hôm nay…"
          />
        </Field>
      )}
      {!!accept && (
        <>
          <Field
            label="Tệp sản phẩm"
            hint="Tối đa 5 tệp/tổng 250 MB. Ảnh 10 MB, âm thanh 20 MB, video 200 MB mỗi tệp."
          >
            <input
              type="file"
              accept={accept}
              multiple
              disabled={busy}
              onChange={(e) => setSelected([...(e.target.files || [])])}
            />
          </Field>
          {selected.length > 0 && (
            <div className={styles.selectedFiles}>
              {selected.map((file, i) => (
                <p key={`${file.name}-${i}`}>
                  {file.name} · {bytes(file.size)}
                </p>
              ))}
              <button
                type="button"
                className="button button-ghost"
                disabled={busy}
                onClick={() => void upload()}
              >
                <Icon name="upload" />
                {busy ? "Đang tải và lưu…" : "Tải tệp lên và lưu nháp"}
              </button>
            </div>
          )}
        </>
      )}
      {attached.length > 0 && (
        <ul className={styles.fileList}>
          {attached.map((file) => (
            <li key={file.id}>
              <Icon name="book" />
              <span>
                {file.originalName}
                <small>{bytes(file.sizeBytes)} · Đã tải lên</small>
              </span>
              <button
                type="button"
                className="icon-button"
                disabled={busy}
                aria-label={`Bỏ tệp ${file.originalName}`}
                onClick={() =>
                  setAttached((previous) =>
                    previous.filter((value) => value.id !== file.id),
                  )
                }
              >
                <Icon name="close" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="muted">
        Lưu nháp để tiếp tục sau. Gửi cho cô sẽ khóa lượt này; nếu cần bổ sung,
        gia đình tạo lượt mới theo phản hồi.
      </p>
      <div className="form-actions">
        <button className="button button-ghost" disabled={busy}>
          {busy ? "Đang lưu…" : "Lưu bản nháp"}
        </button>
        <button
          type="button"
          className="button button-primary"
          disabled={busy || !canSubmit || (!text.trim() && !attached.length)}
          onClick={() => void send()}
        >
          Gửi sản phẩm cho cô
          <Icon name="arrow" />
        </button>
      </div>
    </form>
  );
}
