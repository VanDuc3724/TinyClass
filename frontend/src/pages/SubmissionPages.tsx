import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Badge,
  EmptyState,
  ErrorNotice,
  Field,
  Icon,
  Loading,
  PageHeader,
  Pagination,
} from "../components/ui";
import { ActionModal } from "../components/ActionModal";
import type { ActionRequest } from "../components/ActionModal";
import FilterBar from "../components/FilterBar";
import { api, query } from "../lib/api";
import { useResource, useUnsavedChanges } from "../lib/hooks";
import { dateTimeLabel } from "../lib/format";
import { fileUrl, uploadFile } from "../lib/files";
import type { Classroom, Student } from "../lib/types";
import type { ItemProgress, Submission } from "../lib/submissions";
import { completionLabels } from "../lib/learning";
import type { CompletionMode, Lesson } from "../lib/learning";
import { SubmissionBody } from "./SubmissionParts";
import styles from "./Submissions.module.css";

async function choices<T>(path: string, signal: AbortSignal) {
  const result: T[] = [];
  for (let page = 0; ; page++) {
    const response = await api.list<T>(`${path}?page=${page}&size=100`, signal);
    result.push(...response.data);
    if (page + 1 >= response.meta.totalPages) return result;
  }
}
export function ReviewListPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "SUBMITTED",
    classId = params.get("classId") || "",
    studentId = params.get("studentId") || "",
    lessonId = params.get("lessonId") || "",
    page = Math.max(0, Number(params.get("page")) || 0);
  const filter = (values: Record<string, string>) =>
    setParams({ ...Object.fromEntries(params), page: "0", ...values });
  const data = useResource(
    useCallback(
      (signal) =>
        api.list<Submission>(
          `/submissions${query({ status, classId, studentId, lessonId, page, size: 10 })}`,
          signal,
        ),
      [status, classId, studentId, lessonId, page],
    ),
  );
  const options = useResource(
    useCallback(async (signal) => {
      const [classes, students, lessons] = await Promise.all([
        choices<Classroom>("/classes", signal),
        choices<Student>("/students", signal),
        choices<Lesson>("/lessons", signal),
      ]);
      return { classes, students, lessons };
    }, []),
  );
  return (
    <>
      <PageHeader
        eyebrow="ĐỒNG HÀNH CÙNG GIA ĐÌNH"
        title="Sản phẩm của bé"
        description="Xem những khám phá gia đình đã gửi, phản hồi và ghi nhận bước tiến của bé."
        action={
          <button className="button button-ghost" onClick={data.reload}>
            Cập nhật danh sách
          </button>
        }
      />
      <FilterBar
        className={styles.filters}
        active={!!(classId || studentId || lessonId || status !== "SUBMITTED")}
        onReset={() => setParams({ status: "SUBMITTED" })}
      >
        <Field label="Trạng thái sản phẩm">
          <select
            aria-label="Trạng thái sản phẩm"
            value={status}
            onChange={(e) => filter({ status: e.target.value })}
          >
            <option value="SUBMITTED">Chờ cô duyệt</option>
            <option value="CHANGES_REQUESTED">Cần bổ sung</option>
            <option value="ACCEPTED">Đã chấp nhận</option>
            <option value="">Tất cả lượt đã gửi</option>
          </select>
        </Field>
        <select
          aria-label="Lọc lớp sản phẩm"
          value={classId}
          onChange={(e) => filter({ classId: e.target.value })}
        >
          <option value="">Tất cả lớp</option>
          {options.data?.classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Lọc bé gửi sản phẩm"
          value={studentId}
          onChange={(e) => filter({ studentId: e.target.value })}
        >
          <option value="">Tất cả bé</option>
          {options.data?.students.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullName}
            </option>
          ))}
        </select>
        <select
          aria-label="Lọc bài của sản phẩm"
          value={lessonId}
          onChange={(e) => filter({ lessonId: e.target.value })}
        >
          <option value="">Tất cả bài</option>
          {options.data?.lessons.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </FilterBar>
      <ErrorNotice
        error={data.error || options.error}
        retry={() => {
          data.reload();
          options.reload();
        }}
      />
      {data.loading && !data.data ? (
        <Loading />
      ) : (
        data.data && (
          <>
            {data.data.data.length ? (
              <div className={styles.reviewList}>
                {data.data.data.map((submission) => (
                  <Link
                    className={styles.attempt}
                    key={submission.id}
                    to={`/teacher/reviews/${submission.id}`}
                  >
                    <div>
                      <p className="eyebrow">{submission.studentName}</p>
                      <h2>{submission.lessonTitle}</h2>
                      <p className="muted">
                        {submission.className || "Giao riêng"} ·{" "}
                        {submission.assignmentTitle}
                      </p>
                      <p className="muted">
                        Lượt {submission.attemptNumber} ·{" "}
                        {dateTimeLabel(submission.submittedAt)}
                        {submission.late ? " · Gửi sau hạn gợi ý" : ""}
                      </p>
                    </div>
                    <Badge context="submission" status={submission.status} />
                    <Icon name="arrow" />
                  </Link>
                ))}
              </div>
            ) : (
              <section className={`panel ${styles.emptyPanel}`}>
                <EmptyState
                  title={
                    status === "SUBMITTED"
                      ? "Chưa có sản phẩm đang chờ cô"
                      : "Chưa có lượt gửi phù hợp"
                  }
                  icon="check"
                >
                  {status === "SUBMITTED"
                    ? "Khi gia đình gửi sản phẩm cho bài cần duyệt, cô sẽ thấy ở đây. Lưu nháp của gia đình chưa đưa vào hàng đợi."
                    : "Thử đổi trạng thái, lớp, bé hoặc bài trong bộ lọc."}
                </EmptyState>
              </section>
            )}
            <Pagination
              meta={data.data.meta}
              onChange={(value) => filter({ page: String(value) })}
            />
          </>
        )
      )}
    </>
  );
}
export function ReviewDetailPage() {
  const { id } = useParams();
  const resource = useResource(
    useCallback(
      (signal) => api.get<Submission>(`/submissions/${id}`, signal),
      [id],
    ),
  );
  const submission = resource.data;
  return (
    <>
      <Link className="back-link" to="/teacher/reviews">
        ← Về danh sách sản phẩm
      </Link>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading && !submission ? (
        <Loading />
      ) : (
        submission && (
          <>
            <PageHeader
              eyebrow={`SẢN PHẨM CỦA ${submission.studentName.toLocaleUpperCase("vi-VN")}`}
              title={submission.lessonTitle}
              description={`${submission.assignmentTitle} · ${submission.className || "Giao riêng cho bé"}`}
              action={
                <Link
                  className="button button-ghost"
                  to={`/teacher/assignments/${submission.assignmentId}/children/${submission.studentId}`}
                >
                  Xem tiến độ của bé
                </Link>
              }
            />
            <div className={styles.reviewColumns}>
              <div>
                <SubmissionBody submission={submission} teacher />
              </div>
              {submission.status === "SUBMITTED" ? (
                <ReviewForm
                  key={`${submission.id}-${submission.version}`}
                  submission={submission}
                  onReviewed={resource.reload}
                />
              ) : (
                <aside className={`panel ${styles.reviewForm}`}>
                  <h2>Đã lưu phản hồi</h2>
                  <p className="muted">
                    Lượt đã xử lý được giữ nguyên trong lịch sử. Nếu bé đã hoàn
                    thành và cần làm lại, mở yêu cầu tại trang tiến độ của bé.
                  </p>
                  <Link
                    className="text-link"
                    to={`/teacher/assignments/${submission.assignmentId}/children/${submission.studentId}`}
                  >
                    Xem tiến độ và vòng học
                    <Icon name="arrow" />
                  </Link>
                </aside>
              )}
            </div>
          </>
        )
      )}
    </>
  );
}
function ReviewForm({
  submission,
  onReviewed,
}: {
  submission: Submission;
  onReviewed: () => void;
}) {
  const [feedback, setFeedback] = useState(""),
    [audio, setAudio] = useState(""),
    [selected, setSelected] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState<unknown>(null);
  useUnsavedChanges(!done && !!(feedback || audio || selected));
  async function upload() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const file = await uploadFile(selected, "REVIEW_ASSET");
      setAudio(file.id);
      setSelected(null);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const outcome = (event.nativeEvent as SubmitEvent).submitter?.getAttribute(
      "value",
    );
    if (!outcome) return;
    if (outcome === "CHANGES_REQUESTED" && !feedback.trim()) {
      setError(new Error("Ghi nhận xét để gia đình biết cần bổ sung điều gì."));
      return;
    }
    if (selected) {
      setError(
        new Error("Tải tệp phản hồi âm thanh đã chọn lên trước khi lưu."),
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post(`/submissions/${submission.id}/review`, {
        version: submission.version,
        outcome,
        feedbackText: feedback,
        feedbackAudioFileId: audio || null,
      });
      setDone(true);
      onReviewed();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className={`panel ${styles.reviewForm}`} onSubmit={review}>
      <h2>Phản hồi cho gia đình</h2>
      <p className="muted">
        Chấp nhận sẽ đánh dấu bài hoàn thành. Yêu cầu bổ sung giữ lượt này và
        cho phép gia đình gửi lượt mới.
      </p>
      <ErrorNotice error={error} />
      <Field
        label="Nhận xét của cô"
        hint="Bắt buộc khi yêu cầu bổ sung; tối đa 5.000 ký tự."
      >
        <textarea
          name="feedbackText"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          maxLength={5000}
          disabled={busy || done}
          placeholder="Cô ghi nhận điều gì ở sản phẩm của bé?"
          rows={6}
        />
      </Field>
      <Field
        label="Phản hồi âm thanh"
        optional
        hint="MP3/WAV/OGG, tối đa 20 MB."
      >
        <input
          type="file"
          accept=".mp3,.wav,.ogg"
          disabled={busy || done}
          onChange={(e) => setSelected(e.target.files?.[0] || null)}
        />
      </Field>
      {selected && (
        <button
          type="button"
          className="button button-ghost"
          disabled={busy || done}
          onClick={() => void upload()}
        >
          Tải phản hồi âm thanh
        </button>
      )}
      {audio && (
        <audio
          controls
          preload="metadata"
          aria-label="Nghe lại phản hồi âm thanh"
          src={fileUrl(audio)}
        />
      )}
      <div className="form-actions">
        <button
          className="button button-ghost"
          name="outcome"
          value="CHANGES_REQUESTED"
          disabled={busy || done}
        >
          Yêu cầu bổ sung
        </button>
        <button
          className="button button-primary"
          name="outcome"
          value="ACCEPTED"
          disabled={busy || done}
        >
          <Icon name="check" />
          Chấp nhận sản phẩm
        </button>
      </div>
      {done && (
        <p className="info-notice" role="status">
          Đã lưu phản hồi.
        </p>
      )}
    </form>
  );
}

interface ProgressView {
  id: string;
  title: string;
  studentName: string;
  items: {
    id: string;
    title: string;
    completionMode: CompletionMode;
    isRequired: boolean;
    progress: ItemProgress | null;
    canReopen: boolean;
  }[];
}
export function RecipientProgressPage() {
  const { assignment, child } = useParams();
  const data = useResource(
    useCallback(
      (signal) =>
        api.get<ProgressView>(
          `/assignments/${assignment}/students/${child}/progress`,
          signal,
        ),
      [assignment, child],
    ),
  );
  const [action, setAction] = useState<ActionRequest | null>(null);
  return (
    <>
      <Link className="back-link" to={`/teacher/assignments/${assignment}`}>
        ← Về lần giao bài
      </Link>
      <ErrorNotice error={data.error} retry={data.reload} />
      {data.loading && !data.data ? (
        <Loading />
      ) : (
        data.data && (
          <>
            <PageHeader
              eyebrow="THEO DÕI TỪNG BƯỚC NHỎ"
              title={`Tiến độ · ${data.data.studentName}`}
              description={data.data.title}
              action={
                <Link
                  className="button button-ghost"
                  to={`/teacher/reviews?status=&studentId=${child}`}
                >
                  Sản phẩm của bé
                </Link>
              }
            />
            <section className={`panel ${styles.body}`}>
              {data.data.items.map((item) => (
                <div key={item.id} className={styles.reopenRow}>
                  <div>
                    <h3>{item.title}</h3>
                    <p className="muted">
                      {completionLabels[item.completionMode]} ·{" "}
                      {item.isRequired ? "Bắt buộc" : "Tùy chọn"}
                      {item.progress
                        ? ` · Vòng ${item.progress.reviewCycle + 1}`
                        : ""}
                    </p>
                    <Badge status={item.progress?.status || "NOT_STARTED"} />
                  </div>
                  {item.canReopen && item.progress && (
                    <button
                      className="button button-ghost"
                      onClick={() =>
                        setAction({
                          title: "Mở lại yêu cầu",
                          label: "Mở vòng học mới",
                          reasonRequired: true,
                          description:
                            "Tiến độ hiện tại sẽ về đã mở. Sản phẩm và phản hồi cũ được giữ; bé cần xác nhận hoặc được cô duyệt lại trong vòng mới.",
                          run: (reason) =>
                            api.post(
                              `/assignment-items/${item.id}/students/${child}/reopen`,
                              { version: item.progress!.version, reason },
                            ),
                        })
                      }
                    >
                      Mở lại yêu cầu
                    </button>
                  )}
                </div>
              ))}
            </section>
          </>
        )
      )}
      {action && (
        <ActionModal
          action={action}
          onClose={() => setAction(null)}
          onSuccess={() => {
            setAction(null);
            data.reload();
          }}
        />
      )}
    </>
  );
}
export function FamilySubmissionListPage() {
  const { child } = useParams();
  const [page, setPage] = useState(0);
  const resource = useResource(
    useCallback(
      async (signal) => {
        const [profile, list] = await Promise.all([
          api.get<{ fullName: string }>(`/family/children/${child}`, signal),
          api.list<Submission>(
            `/family/children/${child}/submissions?page=${page}&size=10`,
            signal,
          ),
        ]);
        return { profile, list };
      },
      [child, page],
    ),
  );
  return (
    <>
      <Link className="back-link" to={`/family/children/${child}`}>
        ← Về hồ sơ của bé
      </Link>
      <PageHeader
        eyebrow="NHỮNG KHÁM PHÁ ĐƯỢC GIỮ LẠI"
        title="Sản phẩm & phản hồi"
        description={
          resource.data
            ? `Cùng nhìn lại các lượt sản phẩm của ${resource.data.profile.fullName}.`
            : "Lịch sử riêng của bé, gồm sản phẩm và phản hồi của cô."
        }
      />
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading && !resource.data ? (
        <Loading />
      ) : (
        resource.data && (
          <>
            {resource.data.list.data.length ? (
              <div className={styles.reviewList}>
                {resource.data.list.data.map((submission) => (
                  <Link
                    key={submission.id}
                    className={styles.attempt}
                    to={`/family/children/${child}/submissions/${submission.id}`}
                  >
                    <div>
                      <h2>{submission.lessonTitle}</h2>
                      <p className="muted">
                        {submission.assignmentTitle} · Lượt{" "}
                        {submission.attemptNumber} · Vòng{" "}
                        {submission.reviewCycle + 1}
                      </p>
                      <p className="muted">
                        {dateTimeLabel(
                          submission.submittedAt || submission.createdAt,
                        )}
                        {submission.late ? " · Gửi sau hạn gợi ý" : ""}
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
              <EmptyState title="Những sản phẩm nhỏ đang chờ bé" icon="book">
                Mở bài cần cô duyệt trong Góc học của bé, lưu nháp rồi gửi sản
                phẩm cho cô.
              </EmptyState>
            )}
            <Pagination meta={resource.data.list.meta} onChange={setPage} />
          </>
        )
      )}
    </>
  );
}
export function FamilySubmissionDetailPage() {
  const { child, submission } = useParams();
  const data = useResource(
    useCallback(
      (signal) =>
        api.get<Submission>(
          `/family/children/${child}/submissions/${submission}`,
          signal,
        ),
      [child, submission],
    ),
  );
  return (
    <>
      <Link className="back-link" to={`/family/children/${child}/submissions`}>
        ← Về sản phẩm của bé
      </Link>
      <ErrorNotice error={data.error} retry={data.reload} />
      {data.loading && !data.data ? (
        <Loading />
      ) : (
        data.data && (
          <>
            <PageHeader
              eyebrow={`KHÁM PHÁ CỦA ${data.data.studentName.toLocaleUpperCase("vi-VN")}`}
              title={data.data.lessonTitle}
              description={data.data.assignmentTitle}
              action={
                <button className="button button-ghost" onClick={data.reload}>
                  Cập nhật phản hồi
                </button>
              }
            />
            <SubmissionBody submission={data.data} />
            <p className="muted">
              Đây là lịch sử sản phẩm riêng của bé. Việc xem lại lịch sử không
              cấp lại quyền xem bài gốc nếu bé đã rời lớp.
            </p>
          </>
        )
      )}
    </>
  );
}
