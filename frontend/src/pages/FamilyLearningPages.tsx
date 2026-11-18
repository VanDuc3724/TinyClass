import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { LinkedGamesPanel } from "./FamilyGamePages";
import { Link, useLocation, useParams } from "react-router-dom";
import { api, apiUrl } from "../lib/api";
import { childModeLink, useChildMode, useParentAccess } from "../lib/childMode";
import { useResource } from "../lib/hooks";
import { completionLabels } from "../lib/learning";
import type { Block, CompletionMode, Lesson } from "../lib/learning";
import {
  Badge,
  EmptyState,
  ErrorNotice,
  Icon,
  Loading,
  PageHeader,
  Pagination,
} from "../components/ui";
import { LessonBody } from "./LibraryPages";
import { MediaPreview } from "./FilePages";
import { dateTimeLabel as dateTime } from "../lib/format";
import type { Assignment } from "./AssignmentPages";
import { FamilyProductPanel } from "./SubmissionParts";
import styles from "./FamilyLearningPages.module.css";

export function FamilyLearningPage() {
  const { child } = useParams();
  const kid = useChildMode();
  const [page, setPage] = useState(0);
  const childHeading = useRef<HTMLDivElement>(null);
  const data = useResource(
    useCallback(
      async (signal) => {
        const [profile, assignments] = await Promise.all([
          kid ? null : api.get<{ fullName: string }>(`/family/children/${child}`, signal),
          api.list<Assignment>(
            `/family/children/${child}/assignments?page=${page}&size=12`,
            signal,
          ),
        ]);
        return { profile, assignments };
      },
      [child, page, kid],
    ),
    { refreshOnVisible: true },
  );
  if (kid) {
    const assignments = data.data?.assignments;
    const entries = assignments?.data ?? [];
    const ready = entries.filter((item) => !item.locked && item.completionPercent !== 100);
    const completed = entries.filter((item) => !item.locked && item.completionPercent === 100);
    const waiting = entries.filter((item) => item.locked);
    function changePage(next: number) {
      setPage(next);
      childHeading.current?.focus();
    }
    return (
      <>
        <div ref={childHeading} tabIndex={-1}>
          <PageHeader title="Bài của bé" description={ready.length ? "Chọn một bài để học nhé." : undefined} />
        </div>
        <ErrorNotice error={data.error} retry={data.reload} />
        {data.loading && !assignments ? <Loading text="Đang tìm bài của bé…" /> : null}
        {assignments && (
          <>
            {ready.length ? (
              <div className={styles.list}>
                {ready.map((item) => <ChildAssignmentCard key={item.id} assignment={item} child={child!} />)}
              </div>
            ) : (
              <section className={`panel ${styles.lessonPanel}`}>
                <h2>{completed.length ? "Bé đã làm xong các bài trên trang này!" : "Chưa có bài mới để học"}</h2>
                <p>{waiting.length ? "Bé quay lại khi cô mở bài nhé." : "Bé có thể về góc của bé để chơi."}</p>
              </section>
            )}
            {completed.length > 0 && (
              <details className={styles.details}>
                <summary><Icon name="check" /> Bài đã làm <Icon name="chevron" /></summary>
                <div className={styles.list}>
                  {completed.map((item) => <ChildAssignmentCard key={item.id} assignment={item} child={child!} />)}
                </div>
              </details>
            )}
            {waiting.length > 0 && (
              <details className={styles.details}>
                <summary><Icon name="clock" /> Bài sắp mở <Icon name="chevron" /></summary>
                <ul className={styles.waiting}>
                  {waiting.map((item) => (
                    <li key={item.id}><strong>{item.title}</strong><span>Mở lúc {dateTime(item.availableAt)}</span></li>
                  ))}
                </ul>
              </details>
            )}
            {assignments.meta.totalPages > 1 && (
              <div className={styles.paging}>
                <button type="button" className="button button-ghost" disabled={page === 0} onClick={() => changePage(page - 1)}>Trang trước</button>
                <button type="button" className="button button-ghost" disabled={page + 1 >= assignments.meta.totalPages} onClick={() => changePage(page + 1)}>Trang sau</button>
              </div>
            )}
          </>
        )}
      </>
    );
  }
  return (
    <>
      <Link className="back-link" to={`/family/children/${child}`}>
        ← Về hồ sơ của bé
      </Link>
      <PageHeader
        eyebrow="MỖI NGÀY MỘT KHÁM PHÁ"
        title="Góc học của bé"
        description={
          data.data?.profile
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
                      <Badge
                        status={
                          item.locked
                            ? "UPCOMING"
                            : item.completionPercent === 100
                              ? "COMPLETED"
                              : "OPENED"
                        }
                        label={
                          item.locked
                            ? "Chờ mở bài"
                            : item.completionPercent === 100
                              ? "Đã hoàn thành"
                              : "Cùng con thực hiện"
                        }
                      />
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

function ChildAssignmentCard({ assignment, child }: { assignment: Assignment; child: string }) {
  const completed = assignment.completionPercent === 100;
  return (
    <Link
      className={styles.card}
      to={childModeLink(`/family/children/${child}/learning/assignments/${assignment.id}`, true)}
    >
      <span className={styles.cardIcon}><Icon name={completed ? "check" : "book"} /></span>
      <span className={styles.cardText}>
        <strong>{assignment.title}</strong>
        <span>{completed ? "Xem lại" : assignment.completedItems > 0 ? "Học tiếp" : "Mở bài"}</span>
      </span>
      <Icon name="arrow" />
    </Link>
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
            aria-label={`Tiến độ hoàn thành ${assignment.title}`}
          />
        </>
      )}
    </div>
  );
}
export function FamilyAssignmentPage() {
  const { child, assignment } = useParams();
  const kid = useChildMode();
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
  if (kid) {
    const learning = `/family/children/${child}/learning`;
    const next = item.items.find((lesson) => lesson.progressStatus !== "COMPLETED") ?? item.items[0];
    const lessonLink = (id: string) => childModeLink(`${learning}/items/${id}`, true);
    return (
      <>
        <PageHeader title={item.title} />
        <ErrorNotice error={data.error} retry={data.reload} />
        {item.locked ? (
          <section className={`panel ${styles.lessonPanel}`}>
            <h2>Bài này chưa mở</h2>
            <p>Mở lúc {dateTime(item.availableAt)}.</p>
          </section>
        ) : next ? (
          <>
            <Link className={`button button-primary ${styles.primary}`} to={lessonLink(next.id)}>
              <Icon name="book" />
              <span>{next.title === item.title ? "Mở bài" : next.title}</span>
              <Icon name="arrow" />
            </Link>
            {item.items.length > 1 && (
              <details className={styles.details}>
                <summary><Icon name="book" /> Các bài trong nhóm <Icon name="chevron" /></summary>
                <ol className={styles.steps}>
                  {item.items.map((lesson) => (
                    <li key={lesson.id}>
                      <Link className={styles.step} to={lessonLink(lesson.id)}>
                        <Icon name={lesson.progressStatus === "COMPLETED" ? "check" : "book"} />
                        <span>{lesson.title}</span>
                        <Icon name="arrow" />
                      </Link>
                    </li>
                  ))}
                </ol>
              </details>
            )}
            {item.canInteract && <LinkedGamesPanel child={child!} assignment={assignment!} />}
          </>
        ) : null}
        <Link className={`button button-ghost ${styles.secondary}`} to={childModeLink(learning, true)}>
          Về danh sách bài
        </Link>
      </>
    );
  }
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
          {item.canInteract && (
            <LinkedGamesPanel child={child!} assignment={assignment!} />
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
  progress: { status: string; reopenReason?: string | null } | null;
}
export function FamilyLessonPage() {
  const { child, item } = useParams();
  return <LessonReader key={`${child}-${item}`} child={child!} item={item!} />;
}

function LessonReader({ child, item }: { child: string; item: string }) {
  const kid = useChildMode();
  const { hash } = useLocation();
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
  const product = useRef<HTMLDivElement>(null);
  const productOpen = !kid && data.data?.completionMode === "TEACHER_REVIEW" && hash === "#san-pham";
  useEffect(() => {
    if (!productOpen) return;
    const frame = requestAnimationFrame(() => {
      product.current?.scrollIntoView({ block: "start" });
      product.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [productOpen]);

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
  if (data.loading && !data.data) return <Loading text={kid ? "Đang mở bài…" : "Đang mở hoạt động…"} />;
  if (!data.data) return <ErrorNotice error={data.error} retry={data.reload} />;
  const lesson = data.data;
  const media = (id: string, action = "content") =>
    apiUrl(
      `/family/children/${child}/assignment-items/${item}/files/${id}/${action}`,
    );
  const confirmation = (
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
        type="button"
        className="button button-primary"
        disabled={busy || !confirmed || data.loading}
        onClick={() => void confirm()}
      >
        {busy ? "Đang xác nhận…" : "Xác nhận đã hoàn thành"}
      </button>
    </>
  );
  if (kid) {
    return (
      <ChildLesson
        child={child}
        item={item}
        lesson={lesson}
        media={media}
        confirmation={confirmation}
        error={error || data.error}
        onRetry={data.error ? data.reload : undefined}
        confirmed={confirmed}
      />
    );
  }
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
        {lesson.canInteract && <LinkedGamesPanel child={child!} item={item!} />}
        <ErrorNotice error={error} />
        {lesson.progress?.reopenReason &&
          lesson.progress.status !== "COMPLETED" && (
            <p className="info-notice" role="status">
              Cô đã mở vòng học mới: {lesson.progress.reopenReason}
            </p>
          )}
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
            {lesson.canInteract ? confirmation : (
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
      {lesson.completionMode === "TEACHER_REVIEW" && (
        <div ref={product} id="san-pham" className={styles.productAnchor} tabIndex={-1}>
          <FamilyProductPanel child={child} item={item} onChanged={data.reload} />
        </div>
      )}
    </>
  );
}

function ChildLesson({
  child, item, lesson, media, confirmation, error, onRetry, confirmed,
}: {
  child: string;
  item: string;
  lesson: FamilyItem;
  media: (id: string, action?: string) => string;
  confirmation: ReactNode;
  error: unknown;
  onRetry?: () => void;
  confirmed: boolean;
}) {
  const learning = `/family/children/${child}/learning`;
  const requestParentAccess = useParentAccess();
  const done = lesson.progress?.status === "COMPLETED";
  const submitted = lesson.progress?.status === "SUBMITTED";
  const needsConfirmation = !done && lesson.canInteract && lesson.completionMode === "PARENT_CONFIRM";
  const needsProduct = !done && !submitted && lesson.canInteract && lesson.completionMode === "TEACHER_REVIEW";
  const canContinue = !needsConfirmation && !needsProduct;
  const success = useRef<HTMLDivElement>(null);
  const course = useResource(useCallback(
    (signal) => canContinue
      ? api.get<Assignment>(`/family/children/${child}/assignments/${lesson.assignmentId}`, signal)
      : Promise.resolve(null),
    [canContinue, child, lesson.assignmentId],
  ));
  const currentIndex = course.data?.items.findIndex((step) => step.id === item) ?? -1;
  const next = currentIndex >= 0
    ? course.data?.items.slice(currentIndex + 1).find((step) => step.progressStatus !== "COMPLETED")
    : undefined;
  const downloads = lesson.blocks.filter((block) => block.fileId && block.learnerDownloadAllowed);
  const adultNotes = lesson.parentGuidance || (!done && lesson.progress?.reopenReason) || downloads.length > 0;
  useEffect(() => {
    if (done && confirmed) success.current?.focus();
  }, [done, confirmed]);

  return (
    <>
      <PageHeader title={lesson.title} description={lesson.summary || undefined} />
      <ErrorNotice error={error} retry={onRetry} />
      <section className={`panel ${styles.lessonPanel}`} aria-label="Nội dung bài học">
        {lesson.blocks.map((block, index) => (
          <div className={styles.lessonBlock} key={block.id || index}>
            {block.type === "TEXT" ? <p>{block.textContent}</p> : (
              block.fileId && <ChildMedia block={block} url={media(block.fileId)} />
            )}
            {block.caption && <p className={styles.caption}>{block.caption}</p>}
          </div>
        ))}
        {lesson.activityInstructions && (
          <section className={styles.instructions}>
            <h2>Cùng làm nhé</h2>
            <p>{lesson.activityInstructions}</p>
          </section>
        )}
      </section>
      {done && (
        <div className={styles.success} role="status" ref={success} tabIndex={-1}>
          <Icon name="check" width={28} height={28} />
          <h2>Mình đã hoàn thành hoạt động!</h2>
        </div>
      )}
      {submitted && <p className="info-notice" role="status">Bài đã gửi. Mình chờ cô xem nhé.</p>}
      {needsConfirmation && (
        <details className={`${styles.details} ${styles.confirm}`}>
          <summary><Icon name="check" /> Nhờ người lớn xác nhận <Icon name="chevron" /></summary>
          <div className={styles.adultBody}>
            <p>Người lớn xác nhận sau khi đã cùng bé làm xong bài.</p>
            {confirmation}
          </div>
        </details>
      )}
      {needsProduct && (
        <button
          type="button"
          className={`button button-primary ${styles.primary}`}
          onClick={() => requestParentAccess(`${learning}/items/${item}#san-pham`)}
        >
          <Icon name="upload" /> Gửi bài cùng người lớn
        </button>
      )}
      {canContinue && (course.loading ? (
        <p className="muted" role="status">Đang tìm bài tiếp theo…</p>
      ) : (
        <Link className={`button button-primary ${styles.primary}`} to={childModeLink(next ? `${learning}/items/${next.id}` : learning, true)}>
          <Icon name={next ? "arrow" : "book"} />
          {next ? "Bài tiếp theo" : "Về góc học"}
        </Link>
      ))}
      {!canContinue && (
        <Link className={`button button-ghost ${styles.secondary}`} to={childModeLink(`${learning}/assignments/${lesson.assignmentId}`, true)}>
          Về bài học
        </Link>
      )}
      {lesson.canInteract && <LinkedGamesPanel child={child} item={item} />}
      {adultNotes && (
        <details className={styles.details}>
          <summary>Thông tin cho người lớn <Icon name="chevron" /></summary>
          <div className={styles.adultBody}>
            {lesson.parentGuidance && <p>{lesson.parentGuidance}</p>}
            {!done && lesson.progress?.reopenReason && <p>Cô đã mở lại bài. {lesson.progress.reopenReason}</p>}
            {downloads.map((block, index) => (
              <a key={block.id || index} className="button button-ghost" href={media(block.fileId!, "download")}>
                {block.originalName || "Tải tài liệu"}
              </a>
            ))}
          </div>
        </details>
      )}
    </>
  );
}

function ChildMedia({ block, url }: { block: Block; url: string }) {
  const player = useRef<HTMLMediaElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const mime = block.mimeType || "application/pdf";
  const name = block.altText || block.originalName || "Học liệu";
  const video = mime.startsWith("video/");
  if (!video && !mime.startsWith("audio/")) return <MediaPreview mime={mime} url={url} name={name} />;
  const mediaProps = {
    src: url, controls: true, preload: "metadata", "aria-label": name,
    onPlay: () => { setPlaying(true); setFailed(false); },
    onPause: () => setPlaying(false), onEnded: () => setPlaying(false),
    onError: () => { setPlaying(false); setFailed(true); },
  };
  function press() {
    if (!player.current) return;
    if (playing) player.current.pause();
    else {
      if (failed) player.current.load();
      void player.current.play().catch(() => setFailed(true));
    }
  }
  return (
    <div className={styles.media}>
      {video
        ? <video {...mediaProps} ref={(node) => { player.current = node; }} className="media-preview" playsInline />
        : <audio {...mediaProps} ref={(node) => { player.current = node; }} className="media-audio" />}
      <button type="button" className={`button button-primary ${styles.mediaPlay}`} onClick={press}>
        {playing ? "Tạm dừng" : failed ? "Phát lại" : video ? "Xem video" : "Nghe âm thanh"}
      </button>
      {failed && <p className={styles.caption} role="status">Chưa phát được. Bé nhờ người lớn giúp nhé.</p>}
    </div>
  );
}
