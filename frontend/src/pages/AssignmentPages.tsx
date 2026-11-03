import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { api } from "../lib/api";
import { useResource } from "../lib/hooks";
import { dateTimeLabel as dateTime } from "../lib/format";
import { completionLabels } from "../lib/learning";
import type { CompletionMode, Course, Lesson } from "../lib/learning";
import type { Classroom, Student } from "../lib/types";
import {
  EmptyState,
  ErrorNotice,
  Field,
  Icon,
  Loading,
  Modal,
  PageHeader,
  Pagination,
} from "../components/ui";
import { ActionModal } from "../components/ActionModal";
import type { ActionRequest } from "../components/ActionModal";

export interface AssignmentItem {
  id: string;
  lessonId: string;
  title: string;
  isRequired: boolean;
  completionMode: CompletionMode;
  allowedResponseTypes: string[];
  progressStatus?: string | null;
}
interface Recipient {
  id: string;
  studentId: string;
  fullName: string;
  revokedAt: string | null;
  revokeReason: string | null;
  completedItems: number;
  requiredItems: number;
}
export interface Assignment {
  id: string;
  title: string;
  sourceType: string;
  targetType: string;
  status: string;
  classId: string | null;
  studentId: string | null;
  className: string | null;
  studentName: string | null;
  availableAt: string | null;
  dueAt: string | null;
  version: number;
  items: AssignmentItem[];
  recipients: Recipient[];
  locked: boolean;
  canInteract: boolean;
  completionPercent: number | null;
  requiredItems: number;
  completedItems: number;
}
function localTime(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
const statusLabels: Record<string, string> = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đã giao",
  REVOKED: "Đã thu hồi",
};

export function AssignmentListPage() {
  const [page, setPage] = useState(0);
  const data = useResource(
    useCallback(
      (signal) =>
        api.list<Assignment>(`/assignments?page=${page}&size=12`, signal),
      [page],
    ),
  );
  return (
    <>
      <PageHeader
        eyebrow="CÙNG GIA ĐÌNH ĐỒNG HÀNH"
        title="Giao bài"
        description="Chọn nội dung và người nhận, đặt thời điểm mở rồi chia sẻ với gia đình."
        action={
          <Link className="button button-primary" to="/teacher/assignments/new">
            <Icon name="plus" />
            Tạo lần giao
          </Link>
        }
      />
      <ErrorNotice error={data.error} retry={data.reload} />
      {data.loading && !data.data ? (
        <Loading />
      ) : (
        data.data && (
          <>
            {data.data.data.length ? (
              <div className="library-grid">
                {data.data.data.map((item) => (
                  <Link
                    className="panel library-card"
                    key={item.id}
                    to={`/teacher/assignments/${item.id}`}
                  >
                    <div className="library-card-top">
                      <span className="stat-icon sand">
                        <Icon name="book" />
                      </span>
                      <span className="content-badge">
                        {statusLabels[item.status]}
                      </span>
                    </div>
                    <h2>{item.title}</h2>
                    <p className="muted">
                      {item.className || item.studentName} ·{" "}
                      {item.sourceType === "COURSE" ? "Khóa học" : "Bài học"}
                    </p>
                    <p className="muted">Mở: {dateTime(item.availableAt)}</p>
                    <div className="library-card-footer">
                      <span>Chi tiết lần giao</span>
                      <Icon name="arrow" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="Một hoạt động nhỏ cho gia đình" icon="book">
                Tạo bản nháp từ bài hoặc khóa đã xuất bản. Chỉ khi xuất bản lần
                giao, gia đình mới được cấp quyền.
              </EmptyState>
            )}
            <Pagination meta={data.data.meta} onChange={setPage} />
          </>
        )
      )}
    </>
  );
}
export function AssignmentCreatePage() {
  const [params] = useSearchParams(),
    navigate = useNavigate();
  const [source, setSource] = useState(
      params.get("sourceType") === "COURSE" ? "COURSE" : "LESSON",
    ),
    [sourceId, setSourceId] = useState(params.get("sourceId") || ""),
    [target, setTarget] = useState("CLASS"),
    [targetId, setTargetId] = useState(params.get("classId") || "");
  const [requestId] = useState(() => crypto.randomUUID()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const choices = useResource(
    useCallback(async (signal) => {
      const [lessons, courses, classes, students] = await Promise.all([
        api.list<Lesson>("/lessons?status=PUBLISHED&size=100", signal),
        api.list<Course>("/courses?status=PUBLISHED&size=100", signal),
        api.list<Classroom>("/classes?status=ACTIVE&size=100", signal),
        api.list<Student>("/students?status=ACTIVE&size=100", signal),
      ]);
      return {
        lessons: lessons.data,
        courses: courses.data,
        classes: classes.data,
        students: students.data,
      };
    }, []),
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const saved = await api.post<Assignment>("/assignments", {
        title: data.get("title"),
        sourceType: source,
        lessonId: source === "LESSON" ? sourceId : null,
        courseId: source === "COURSE" ? sourceId : null,
        targetType: target,
        classId: target === "CLASS" ? targetId : null,
        studentId: target === "STUDENT" ? targetId : null,
        availableAt: data.get("available")
          ? new Date(String(data.get("available"))).toISOString()
          : null,
        dueAt: data.get("due")
          ? new Date(String(data.get("due"))).toISOString()
          : null,
        clientRequestId: requestId,
      });
      navigate(`/teacher/assignments/${saved.id}`, { replace: true });
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="MỘT LỜI MỜI KHÁM PHÁ"
        title="Tạo lần giao"
        description="Mỗi lần giao có danh sách người nhận và tiến độ riêng."
      />
      <form
        className="panel editor-section assignment-create"
        onSubmit={submit}
      >
        <ErrorNotice
          error={error || choices.error}
          retry={choices.error ? choices.reload : undefined}
        />
        <Field label="Tên lần giao">
          <input
            name="title"
            required
            maxLength={200}
            disabled={busy}
            placeholder="Ví dụ: Cùng con khám phá màu sắc"
          />
        </Field>
        <div className="form-grid">
          <Field label="Nguồn học liệu">
            <select
              value={source}
              disabled={busy}
              onChange={(event) => {
                setSource(event.target.value);
                setSourceId("");
              }}
            >
              <option value="LESSON">Một bài học</option>
              <option value="COURSE">Một khóa học</option>
            </select>
          </Field>
          <Field label={source === "LESSON" ? "Chọn bài học" : "Chọn khóa học"}>
            <select
              value={sourceId}
              required
              disabled={busy || choices.loading}
              onChange={(event) => setSourceId(event.target.value)}
            >
              <option value="">Chọn học liệu đã xuất bản</option>
              {(source === "LESSON"
                ? choices.data?.lessons
                : choices.data?.courses
              )?.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="form-grid">
          <Field label="Giao cho">
            <select
              value={target}
              disabled={busy}
              onChange={(event) => {
                setTarget(event.target.value);
                setTargetId("");
              }}
            >
              <option value="CLASS">Một lớp học</option>
              <option value="STUDENT">Riêng một bé</option>
            </select>
          </Field>
          <Field label={target === "CLASS" ? "Lớp nhận bài" : "Bé nhận bài"}>
            <select
              value={targetId}
              required
              disabled={busy || choices.loading}
              onChange={(event) => setTargetId(event.target.value)}
            >
              <option value="">Chọn người nhận</option>
              {target === "CLASS"
                ? choices.data?.classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))
                : choices.data?.students.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.fullName}
                    </option>
                  ))}
            </select>
          </Field>
        </div>
        <div className="form-grid">
          <Field label="Mở bài lúc">
            <input
              name="available"
              type="datetime-local"
              required
              defaultValue={localTime()}
              disabled={busy}
            />
          </Field>
          <Field label="Hạn gợi ý" optional>
            <input name="due" type="datetime-local" disabled={busy} />
          </Field>
        </div>
        <p className="info-notice">
          Danh sách bài được sao chép vào bản nháp. Các bé trong lớp được chốt
          khi xuất bản; bé vào lớp sau chỉ nhận bài cũ khi bạn chọn cấp thêm.
        </p>
        <div className="form-actions">
          <Link className="button button-ghost" to="/teacher/assignments">
            Quay lại
          </Link>
          <button
            className="button button-primary"
            disabled={busy || choices.loading}
          >
            {busy ? "Đang tạo…" : "Tạo bản nháp"}
          </button>
        </div>
      </form>
    </>
  );
}
export function AssignmentDetailPage() {
  const { id } = useParams();
  const data = useResource(
    useCallback(
      (signal) => api.get<Assignment>(`/assignments/${id}`, signal),
      [id],
    ),
  );
  return data.loading && !data.data ? (
    <Loading />
  ) : !data.data ? (
    <ErrorNotice error={data.error} retry={data.reload} />
  ) : (
    <AssignmentDetail
      key={`${id}:${data.data.version}`}
      initial={data.data}
      reload={data.reload}
    />
  );
}
function AssignmentDetail({
  initial,
  reload,
}: {
  initial: Assignment;
  reload: () => void;
}) {
  const [items, setItems] = useState(initial.items),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [action, setAction] = useState<ActionRequest | null>(null),
    [grant, setGrant] = useState(false);
  const draft = initial.status === "DRAFT";
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api.put(`/assignments/${initial.id}`, {
        version: initial.version,
        title: data.get("title"),
        availableAt: data.get("available")
          ? new Date(String(data.get("available"))).toISOString()
          : null,
        dueAt: data.get("due")
          ? new Date(String(data.get("due"))).toISOString()
          : null,
        items: items.map(
          ({ id, isRequired, completionMode, allowedResponseTypes }) => ({
            id,
            isRequired,
            completionMode,
            allowedResponseTypes,
          }),
        ),
      });
      reload();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  function act(kind: "publish" | "revoke") {
    setAction({
      title: kind === "publish" ? "Xuất bản lần giao" : "Thu hồi lần giao",
      label: kind === "publish" ? "Xuất bản và giao bài" : "Thu hồi bài",
      description:
        kind === "publish"
          ? "Chia sẻ đúng các bài và yêu cầu đã lưu. Với lớp học, các bé đang tham gia sẽ được cấp quyền trong cùng lượt xuất bản."
          : "Gia đình ngừng truy cập bài/tệp của lần giao này. Lịch sử tiến độ được giữ.",
      reasonRequired: kind === "revoke",
      run: (reason) =>
        api.post(`/assignments/${initial.id}/${kind}`, {
          version: initial.version,
          reason,
        }),
    });
  }
  return (
    <>
      <Link className="back-link" to="/teacher/assignments">
        ← Về danh sách giao bài
      </Link>
      <PageHeader
        eyebrow="ĐỒNG HÀNH CÙNG GIA ĐÌNH"
        title={initial.title}
        description={`Mở bài: ${dateTime(initial.availableAt)} · Hạn gợi ý: ${dateTime(initial.dueAt)}`}
        action={
          <div className="header-actions">
            {draft && (
              <button
                className="button button-primary"
                onClick={() => act("publish")}
              >
                Xuất bản lần giao
              </button>
            )}
            {initial.status === "PUBLISHED" && (
              <>
                <button
                  className="button button-ghost"
                  onClick={() => act("revoke")}
                >
                  Thu hồi lần giao
                </button>
                {initial.classId && (
                  <button
                    className="button button-primary"
                    onClick={() => setGrant(true)}
                  >
                    Cấp thêm bé
                  </button>
                )}
              </>
            )}
          </div>
        }
      />
      <div className="content-meta">
        <span className="content-badge">{statusLabels[initial.status]}</span>
        <span>
          {initial.sourceType === "COURSE" ? "Khóa học" : "Bài học"} ·{" "}
          {initial.targetType === "CLASS" ? "Giao theo lớp" : "Giao riêng"}
        </span>
      </div>
      <form onSubmit={save} className="panel editor-section">
        <h2>Các bài và yêu cầu hoàn thành</h2>
        <ErrorNotice error={error} />
        {draft && (
          <>
            <Field label="Tên lần giao">
              <input
                name="title"
                defaultValue={initial.title}
                required
                maxLength={200}
                disabled={busy}
              />
            </Field>
            <div className="form-grid">
              <Field label="Mở bài lúc">
                <input
                  name="available"
                  type="datetime-local"
                  defaultValue={
                    initial.availableAt ? localTime(initial.availableAt) : ""
                  }
                  required
                  disabled={busy}
                />
              </Field>
              <Field label="Hạn gợi ý" optional>
                <input
                  name="due"
                  type="datetime-local"
                  defaultValue={initial.dueAt ? localTime(initial.dueAt) : ""}
                  disabled={busy}
                />
              </Field>
            </div>
          </>
        )}
        {items.map((item, index) => (
          <div className="assignment-item-config" key={item.id}>
            <div className="course-lesson-row">
              <span className="lesson-order">{index + 1}</span>
              <div>
                <Link
                  className="text-link"
                  to={`/teacher/library/lessons/${item.lessonId}`}
                >
                  {item.title}
                </Link>
                {draft ? (
                  <>
                    <Field label={`Hoàn thành bài ${index + 1}`}>
                      <select
                        value={item.completionMode}
                        disabled={busy}
                        onChange={(event) =>
                          setItems((current) =>
                            current.map((row, i) =>
                              i === index
                                ? {
                                    ...row,
                                    completionMode: event.target
                                      .value as CompletionMode,
                                    isRequired:
                                      event.target.value === "REFERENCE"
                                        ? false
                                        : row.isRequired,
                                  }
                                : row,
                            ),
                          )
                        }
                      >
                        {Object.entries(completionLabels).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    </Field>
                    <label className="checkbox-field">
                      <input
                        type="checkbox"
                        checked={item.isRequired}
                        disabled={busy || item.completionMode === "REFERENCE"}
                        onChange={(event) =>
                          setItems((current) =>
                            current.map((row, i) =>
                              i === index
                                ? { ...row, isRequired: event.target.checked }
                                : row,
                            ),
                          )
                        }
                      />
                      Bài bắt buộc
                    </label>
                    {item.completionMode === "TEACHER_REVIEW" && (
                      <div className="response-options">
                        {[
                          ["TEXT", "Chữ"],
                          ["IMAGE", "Ảnh"],
                          ["AUDIO", "Âm thanh"],
                          ["VIDEO", "Video"],
                        ].map(([value, label]) => (
                          <label className="checkbox-field" key={value}>
                            <input
                              type="checkbox"
                              checked={item.allowedResponseTypes.includes(
                                value,
                              )}
                              disabled={busy}
                              onChange={(event) =>
                                setItems((current) =>
                                  current.map((row, i) =>
                                    i === index
                                      ? {
                                          ...row,
                                          allowedResponseTypes: event.target
                                            .checked
                                            ? [
                                                ...row.allowedResponseTypes,
                                                value,
                                              ]
                                            : row.allowedResponseTypes.filter(
                                                (type) => type !== value,
                                              ),
                                        }
                                      : row,
                                  ),
                                )
                              }
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="muted">
                    {completionLabels[item.completionMode]} ·{" "}
                    {item.isRequired ? "Bắt buộc" : "Tùy chọn"}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
        {draft && (
          <div className="form-actions">
            <p className="muted">Lưu yêu cầu trước khi xuất bản.</p>
            <button className="button button-primary" disabled={busy}>
              {busy ? "Đang lưu…" : "Lưu bản nháp"}
            </button>
          </div>
        )}
      </form>
      <section className="panel editor-section">
        <h2>Người nhận</h2>
        {initial.recipients.length ? (
          <div className="recipient-list">
            {initial.recipients.map((recipient) => (
              <div key={recipient.id} className="topic-row">
                <div>
                  <strong>{recipient.fullName}</strong>
                  <p className="muted">
                    {recipient.revokedAt
                      ? recipient.revokeReason || "Đã thu hồi"
                      : "Đang có quyền"}
                  </p>
                </div>
                {!recipient.revokedAt && (
                  <span className="muted">
                    {recipient.requiredItems
                      ? `${recipient.completedItems}/${recipient.requiredItems} bài hoàn thành`
                      : "Nội dung tham khảo"}
                  </span>
                )}
                <Link
                  className="text-link"
                  to={`/teacher/assignments/${initial.id}/children/${recipient.studentId}`}
                >
                  Xem tiến độ
                  <Icon name="arrow" />
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Danh sách sẽ được chốt khi xuất bản lần giao.</p>
        )}
      </section>
      {action && (
        <ActionModal
          action={action}
          onClose={() => setAction(null)}
          onSuccess={() => {
            setAction(null);
            reload();
          }}
        />
      )}
      {grant && (
        <GrantModal
          assignment={initial}
          onClose={() => setGrant(false)}
          onSaved={() => {
            setGrant(false);
            reload();
          }}
        />
      )}
    </>
  );
}
function GrantModal({
  assignment,
  onClose,
  onSaved,
}: {
  assignment: Assignment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const choices = useResource(
    useCallback(
      (signal) =>
        api.list<{ studentId: string; studentName: string; status: string }>(
          `/classes/${assignment.classId}/enrollments?size=100`,
          signal,
        ),
      [assignment.classId],
    ),
  );
  const [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await api.post(`/assignments/${assignment.id}/recipients`, {
        version: assignment.version,
        studentIds: selected,
        reason: data.get("reason"),
      });
      onSaved();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  const eligible = choices.data?.data.filter(
    (item) =>
      item.status === "ACTIVE" &&
      !assignment.recipients.some(
        (recipient) =>
          recipient.studentId === item.studentId && !recipient.revokedAt,
      ),
  );
  return (
    <Modal title="Cấp bài cũ cho bé" onClose={onClose} busy={busy}>
      <form onSubmit={submit}>
        <ErrorNotice error={error || choices.error} />
        {choices.loading ? (
          <Loading />
        ) : eligible?.length ? (
          eligible.map((item) => (
            <label className="checkbox-field" key={item.studentId}>
              <input
                type="checkbox"
                checked={selected.includes(item.studentId)}
                disabled={busy}
                onChange={(event) =>
                  setSelected((current) =>
                    event.target.checked
                      ? [...current, item.studentId]
                      : current.filter((id) => id !== item.studentId),
                  )
                }
              />
              {item.studentName}
            </label>
          ))
        ) : (
          <p className="muted">Các bé đang tham gia đã được cấp bài này.</p>
        )}
        <Field label="Lý do cấp thêm">
          <textarea
            name="reason"
            rows={3}
            required
            maxLength={1000}
            disabled={busy}
          />
        </Field>
        <div className="form-actions">
          <button
            className="button button-primary"
            disabled={busy || !selected.length}
          >
            Cấp quyền xem bài
          </button>
        </div>
      </form>
    </Modal>
  );
}
