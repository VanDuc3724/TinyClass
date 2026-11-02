import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, apiUrl } from "../lib/api";
import { useResource } from "../lib/hooks";
import { completionLabels } from "../lib/learning";
import type { CompletionMode, Lesson } from "../lib/learning";
import {
  EmptyState,
  ErrorNotice,
  Icon,
  Loading,
  PageHeader,
  Pagination,
} from "../components/ui";
import { LessonBody } from "./LibraryPages";
import { dateTimeLabel as dateTime } from "../lib/format";
import type { Assignment } from "./AssignmentPages";

export function FamilyLearningPage() {
  const { child } = useParams();
  const [page, setPage] = useState(0);
  const data = useResource(
    useCallback(
      async (signal) => {
        const [profile, assignments] = await Promise.all([
          api.get<{ fullName: string }>(`/family/children/${child}`, signal),
          api.list<Assignment>(
            `/family/children/${child}/assignments?page=${page}&size=12`,
            signal,
          ),
        ]);
        return { profile, assignments };
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
        eyebrow="MỖI NGÀY MỘT KHÁM PHÁ"
        title="Góc học của bé"
        description={
          data.data
            ? `Cùng ${data.data.profile.fullName} khám phá những hoạt động cô đã chuẩn bị.`
            : "Bài học được giáo viên chia sẻ riêng cho bé."
        }
      />
      <ErrorNotice error={data.error} retry={data.reload} />
      {data.loading && !data.data ? (
        <Loading />
      ) : (
        data.data && (
          <>
            {data.data.assignments.data.length ? (
              <div className="library-grid">
                {data.data.assignments.data.map((item) => (
                  <Link
                    className="panel library-card"
                    key={item.id}
                    to={`/family/children/${child}/learning/assignments/${item.id}`}
                  >
                    <div className="library-card-top">
                      <span className="stat-icon mint">
                        <Icon name={item.locked ? "clock" : "book"} />
                      </span>
                      <span className="content-badge">
                        {item.locked
                          ? "Chờ mở bài"
                          : item.completionPercent === 100
                            ? "Đã hoàn thành"
                            : "Cùng con thực hiện"}
                      </span>
                    </div>
                    <h2>{item.title}</h2>
                    <p className="muted">
                      {item.className || "Hoạt động riêng cho bé"}
                    </p>
                    {item.locked ? (
                      <p className="muted">
                        Mở lúc {dateTime(item.availableAt)}
                      </p>
                    ) : (
                      <Progress assignment={item} />
                    )}
                    <div className="library-card-footer">
                      <span>
                        {item.locked ? "Xem thời gian mở" : "Mở hoạt động"}
                      </span>
                      <Icon name="arrow" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="Những khám phá đang được chuẩn bị" icon="leaf">
                Khi giáo viên giao bài cho bé, hoạt động sẽ hiện ở đây.
              </EmptyState>
            )}
            <Pagination meta={data.data.assignments.meta} onChange={setPage} />
          </>
        )
      )}
    </>
  );
}
function Progress({ assignment }: { assignment: Assignment }) {
  return (
    <div className="learning-progress">
      {assignment.completionPercent === null ? (
        <span>Nội dung tham khảo</span>
      ) : (
        <>
          <div>
            <span>
              {assignment.completedItems}/{assignment.requiredItems} bài bắt
              buộc
            </span>
            <strong>{assignment.completionPercent}%</strong>
          </div>
          <progress
            max={100}
            value={assignment.completionPercent}
            aria-label="Tiến độ hoàn thành"
          />
        </>
      )}
    </div>
  );
}
export function FamilyAssignmentPage() {
  const { child, assignment } = useParams();
  const data = useResource(
    useCallback(
      (signal) =>
        api.get<Assignment>(
          `/family/children/${child}/assignments/${assignment}`,
          signal,
        ),
      [child, assignment],
    ),
  );
  if (data.loading && !data.data) return <Loading />;
  if (!data.data) return <ErrorNotice error={data.error} retry={data.reload} />;
  const item = data.data;
  return (
    <>
      <Link className="back-link" to={`/family/children/${child}/learning`}>
        ← Về góc học của bé
      </Link>
      <PageHeader
        eyebrow="CÙNG CON TỪNG BƯỚC NHỎ"
        title={item.title}
        description={`Mở bài: ${dateTime(item.availableAt)}${item.dueAt ? ` · Hạn gợi ý: ${dateTime(item.dueAt)}` : ""}`}
      />
      {item.locked ? (
        <section className="panel editor-section">
          <EmptyState title="Mình chờ đến giờ khám phá nhé" icon="clock">
            Hoạt động mở lúc {dateTime(item.availableAt)}. Nội dung và tài liệu
            sẽ xuất hiện khi đến giờ.
          </EmptyState>
        </section>
      ) : (
        <section className="panel editor-section">
          <Progress assignment={item} />
          {!item.canInteract && (
            <p className="info-notice">
              Lớp đã kết thúc. Gia đình có thể xem lại các hoạt động được giữ
              trong lịch sử.
            </p>
          )}
          {item.items.map((lesson, index) => (
            <Link
              key={lesson.id}
              className="course-lesson-row"
              to={`/family/children/${child}/learning/items/${lesson.id}`}
            >
              <span className="lesson-order">
                {lesson.progressStatus === "COMPLETED" ? (
                  <Icon name="check" />
                ) : (
                  index + 1
                )}
              </span>
              <div>
                <strong>{lesson.title}</strong>
                <p className="muted">
                  {completionLabels[lesson.completionMode]} ·{" "}
                  {lesson.isRequired ? "Bắt buộc" : "Tùy chọn"}
                </p>
              </div>
              <Icon name="arrow" />
            </Link>
          ))}
        </section>
      )}
    </>
  );
}
interface FamilyItem extends Lesson {
  assignmentId: string;
  completionMode: CompletionMode;
  isRequired: boolean;
  canInteract: boolean;
  progress: { status: string } | null;
}
export function FamilyLessonPage() {
  const { child, item } = useParams();
  const data = useResource(
    useCallback(
      (signal) =>
        api.post<FamilyItem>(
          `/family/children/${child}/assignment-items/${item}/open`,
          {},
          signal,
        ),
      [child, item],
    ),
  );
  const [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await api.post(
        `/family/children/${child}/assignment-items/${item}/confirm`,
        {},
      );
      data.reload();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  if (data.loading && !data.data) return <Loading text="Đang mở hoạt động…" />;
  if (!data.data) return <ErrorNotice error={data.error} retry={data.reload} />;
  const lesson = data.data;
  const media = (id: string, action = "content") =>
    apiUrl(
      `/family/children/${child}/assignment-items/${item}/files/${id}/${action}`,
    );
  return (
    <>
      <Link
        className="back-link"
        to={`/family/children/${child}/learning/assignments/${lesson.assignmentId}`}
      >
        ← Về danh sách hoạt động
      </Link>
      <PageHeader
        eyebrow="CÙNG CON KHÁM PHÁ"
        title={lesson.title}
        description={lesson.summary || undefined}
      />
      <section className="panel lesson-detail">
        <LessonBody lesson={lesson} mediaUrl={(id) => media(id)} />
        {lesson.blocks.some(
          (block) => block.fileId && block.learnerDownloadAllowed,
        ) && (
          <div className="download-list">
            <h2>Tài liệu được phép tải</h2>
            {lesson.blocks
              .filter((block) => block.fileId && block.learnerDownloadAllowed)
              .map((block, index) => (
                <a
                  key={index}
                  className="button button-ghost"
                  href={media(block.fileId!, "download")}
                >
                  {block.originalName || "Tải tài liệu"}
                </a>
              ))}
          </div>
        )}
      </section>
      <section className="panel editor-section completion-panel">
        <ErrorNotice error={error} />
        {lesson.progress?.status === "COMPLETED" ? (
          <div className="completed-message" role="status">
            <Icon name="check" />
            <div>
              <h2>Mình đã hoàn thành hoạt động!</h2>
              <p>Cảm ơn gia đình đã cùng bé khám phá.</p>
            </div>
          </div>
        ) : lesson.completionMode === "PARENT_CONFIRM" ? (
          <>
            <h2>Cùng ghi lại bước nhỏ hôm nay</h2>
            <p className="muted">
              Xác nhận sau khi gia đình đã cùng bé thực hiện hoạt động. Việc mở
              hoặc phát video chưa đánh dấu hoàn thành.
            </p>
            {lesson.canInteract ? (
              <>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    disabled={busy}
                  />
                  Tôi đã cùng bé thực hiện hoạt động này.
                </label>
                <button
                  className="button button-primary"
                  disabled={busy || !confirmed}
                  onClick={() => void confirm()}
                >
                  {busy ? "Đang xác nhận…" : "Xác nhận đã hoàn thành"}
                </button>
              </>
            ) : (
              <p className="info-notice">Lớp đã kết thúc, hiện chỉ xem lại.</p>
            )}
          </>
        ) : (
          <p className="muted">
            {lesson.completionMode === "REFERENCE"
              ? "Đây là nội dung tham khảo, gia đình có thể cùng bé xem theo nhịp riêng."
              : "Hoạt động hoàn thành khi giáo viên duyệt sản phẩm của bé."}
          </p>
        )}
      </section>
    </>
  );
}
