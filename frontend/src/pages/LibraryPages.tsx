import { useCallback, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { api, query } from "../lib/api";
import { fileUrl } from "../lib/files";
import type { MediaFile, StorageConnection } from "../lib/files";
import { useResource, useUnsavedChanges } from "../lib/hooks";
import { completionLabels, contentStatus } from "../lib/learning";
import type {
  Block,
  Course,
  CourseLesson,
  Lesson,
  Topic,
} from "../lib/learning";
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
import { onTabListKeyDown } from "../lib/accessibility";
import { ActionModal } from "../components/ActionModal";
import type { ActionRequest } from "../components/ActionModal";
import { MediaPreview, UploadModal } from "./FilePages";
import FilterBar from "../components/FilterBar";

const root = "/teacher/library";
export function LibraryPage() {
  const [params, setParams] = useSearchParams();
  const tab =
    params.get("tab") === "courses"
      ? "courses"
      : params.get("tab") === "topics"
        ? "topics"
        : "lessons";
  const search = params.get("q") || "",
    page = Math.max(0, Number(params.get("page")) || 0),
    status = params.get("status") || "",
    topic = params.get("topicId") || "";
  function filter(values: Record<string, string>) {
    setParams(
      { ...Object.fromEntries(params), page: "0", ...values },
      { replace: true },
    );
  }
  const setPage = (value: number) => filter({ page: String(value) });
  const [editingTopic, setEditingTopic] = useState<Topic | "new" | null>(null);
  const items = useResource(
    useCallback(
      (signal) =>
        tab === "topics"
          ? Promise.resolve(null)
          : api.list<Lesson & Course>(
              `/${tab}${query({ q: search, page, size: 12, status, topicId: topic })}`,
              signal,
            ),
      [tab, search, page, status, topic],
    ),
  );
  const topics = useResource(
    useCallback((signal) => api.get<Topic[]>("/topics", signal), []),
  );
  return (
    <>
      <PageHeader
        eyebrow="MỖI BÀI HỌC, MỘT KHÁM PHÁ"
        title="Thư viện học liệu"
        description="Tổ chức hoạt động theo chủ đề, dùng lại bài trong nhiều khóa và lớp."
        action={
          tab === "topics" ? (
            <button
              className="button button-primary"
              onClick={() => setEditingTopic("new")}
            >
              <Icon name="plus" />
              Thêm chủ đề
            </button>
          ) : (
            <Link className="button button-primary" to={`${root}/${tab}/new`}>
              <Icon name="plus" />
              {tab === "courses" ? "Tạo khóa học" : "Soạn bài học"}
            </Link>
          )
        }
      />
      <div
        className="library-tabs"
        role="tablist"
        aria-label="Loại học liệu"
        onKeyDown={onTabListKeyDown}
      >
        {[
          ["lessons", "Bài học"],
          ["courses", "Khóa học"],
          ["topics", "Chủ đề"],
        ].map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            tabIndex={tab === value ? 0 : -1}
            id={`library-tab-${value}`}
            aria-controls={`library-panel-${value}`}
            onClick={() => {
              setParams({ tab: value });
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <ErrorNotice
        error={items.error || topics.error}
        retry={() => {
          items.reload();
          topics.reload();
        }}
      />
      <div
        id={`library-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`library-tab-${tab}`}
      >
        {tab === "topics" ? (
          topics.loading && !topics.data ? (
            <Loading />
          ) : (
            <section className="panel topic-list">
              {topics.data?.length ? (
                topics.data.map((item) => (
                  <div key={item.id} className="topic-row">
                    <span className="topic-dot" />
                    <div>
                      <strong>{item.name}</strong>
                      <p className="muted">
                        {item.description || "Chưa có mô tả"}
                      </p>
                    </div>
                    <span className="muted">
                      {item.archivedAt ? "Đã lưu trữ" : "Đang sử dụng"}
                    </span>
                    <button
                      className="button button-small button-ghost"
                      onClick={() => setEditingTopic(item)}
                    >
                      Sửa
                    </button>
                  </div>
                ))
              ) : (
                <EmptyState title="Thêm chủ đề đầu tiên">
                  Ví dụ: Màu sắc, Thế giới quanh bé, Làm quen chữ cái.
                </EmptyState>
              )}
            </section>
          )
        ) : (
          <>
            <FilterBar
              active={!!(search || status || topic)}
              onReset={() => setParams({ tab }, { replace: true })}
            >
              <div className="search-field">
                <Icon name="search" />
                <input
                  aria-label="Tìm học liệu"
                  placeholder="Tìm bài hoặc khóa học…"
                  value={search}
                  onChange={(event) => {
                    filter({ q: event.target.value });
                  }}
                />
              </div>
              <select
                aria-label="Trạng thái học liệu"
                value={status}
                onChange={(event) => {
                  filter({ status: event.target.value });
                }}
              >
                <option value="">Mọi trạng thái</option>
                {Object.entries(contentStatus).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {tab === "lessons" && (
                <select
                  aria-label="Lọc chủ đề"
                  value={topic}
                  onChange={(event) => {
                    filter({ topicId: event.target.value });
                  }}
                >
                  <option value="">Mọi chủ đề</option>
                  {topics.data
                    ?.filter((item) => !item.archivedAt)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              )}
            </FilterBar>
            {items.loading && !items.data ? (
              <Loading />
            ) : items.data?.data.length ? (
              <>
                <div className="library-grid">
                  {items.data.data.map((item) => (
                    <Link
                      className="panel library-card"
                      key={item.id}
                      to={`${root}/${tab}/${item.id}`}
                    >
                      <div className="library-card-top">
                        <span className="stat-icon mint">
                          <Icon name="book" />
                        </span>
                        <span
                          className={`content-badge ${item.status.toLowerCase()}`}
                        >
                          {contentStatus[item.status]}
                        </span>
                      </div>
                      <h2>{item.title}</h2>
                      <p className="muted">
                        {item.summary ||
                          item.description ||
                          "Mở để xem nội dung và chuẩn bị cho lớp nhỏ."}
                      </p>
                      <div className="library-card-footer">
                        <span>
                          {item.estimatedMinutes
                            ? `${item.estimatedMinutes} phút`
                            : tab === "courses"
                              ? "Khóa học"
                              : "Hoạt động cho bé"}
                        </span>
                        <Icon name="arrow" />
                      </div>
                    </Link>
                  ))}
                </div>
                <Pagination meta={items.data.meta} onChange={setPage} />
              </>
            ) : (
              <EmptyState
                title={
                  tab === "lessons"
                    ? "Một bài học mới đang chờ"
                    : "Gom những khám phá thành khóa học"
                }
                icon="book"
              >
                {search || status || topic
                  ? "Chưa có học liệu phù hợp bộ lọc."
                  : "Bắt đầu bằng bản nháp, thêm nội dung rồi xuất bản khi sẵn sàng."}
              </EmptyState>
            )}
          </>
        )}
      </div>
      {editingTopic && (
        <TopicModal
          initial={editingTopic}
          onClose={() => setEditingTopic(null)}
          onSaved={() => {
            setEditingTopic(null);
            topics.reload();
          }}
        />
      )}
    </>
  );
}
function TopicModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: Topic | "new";
  onClose: () => void;
  onSaved: () => void;
}) {
  const topic = initial === "new" ? null : initial;
  const [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    const body = {
      name: data.get("name"),
      description: data.get("description"),
      archived: data.get("archived") === "on",
      version: topic?.version,
    };
    try {
      if (topic) await api.patch(`/topics/${topic.id}`, body);
      else await api.post("/topics", body);
      onSaved();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={topic ? "Sửa chủ đề" : "Chủ đề mới"}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit}>
        <ErrorNotice error={error} />
        <Field label="Tên chủ đề">
          <input
            name="name"
            defaultValue={topic?.name}
            maxLength={100}
            required
            disabled={busy}
          />
        </Field>
        <Field label="Mô tả" optional>
          <textarea
            name="description"
            defaultValue={topic?.description || ""}
            maxLength={3000}
            rows={3}
            disabled={busy}
          />
        </Field>
        {topic && (
          <label className="checkbox-field">
            <input
              type="checkbox"
              name="archived"
              defaultChecked={!!topic.archivedAt}
              disabled={busy}
            />
            Lưu trữ chủ đề, giữ các bài đang gắn
          </label>
        )}
        <div className="form-actions">
          <button className="button button-primary" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu chủ đề"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function LessonEditorPage() {
  const { id } = useParams();
  const data = useResource(
    useCallback(
      (signal) =>
        id ? api.get<Lesson>(`/lessons/${id}`, signal) : Promise.resolve(null),
      [id],
    ),
  );
  return data.loading && !data.data ? (
    <Loading />
  ) : data.error ? (
    <ErrorNotice error={data.error} retry={data.reload} />
  ) : (
    <LessonEditor key={id || "new"} initial={data.data} />
  );
}
function LessonEditor({ initial }: { initial: Lesson | null }) {
  const navigate = useNavigate();
  const [blocks, setBlocks] = useState<Block[]>(
    initial?.blocks || [
      {
        type: "TEXT",
        textContent: "",
        fileId: null,
        caption: null,
        altText: null,
      },
    ],
  );
  const [mode, setMode] = useState(
      initial?.defaultCompletionMode || "PARENT_CONFIRM",
    ),
    [responses, setResponses] = useState(
      initial?.defaultResponseTypes || ["TEXT", "IMAGE"],
    );
  const [topics, setTopics] = useState(initial?.topicIds || []),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [uploadFor, setUploadFor] = useState<number | null>(null);
  const mayLeave = useUnsavedChanges(dirty);
  const choices = useResource(
    useCallback(async (signal) => {
      const [topics, files, storage] = await Promise.all([
        api.get<Topic[]>("/topics", signal),
        api.list<MediaFile>("/files?purpose=LESSON_ASSET&size=100", signal),
        api.get<StorageConnection[]>("/storage-connections", signal),
      ]);
      return {
        topics,
        files: files.data.filter((item) => item.status === "READY"),
        storage,
      };
    }, []),
  );
  function updateBlock(index: number, values: Partial<Block>) {
    setDirty(true);
    setBlocks((current) =>
      current.map((item, i) => (i === index ? { ...item, ...values } : item)),
    );
  }
  function move(index: number, direction: number) {
    setDirty(true);
    setBlocks((current) => {
      const next = [...current];
      [next[index], next[index + direction]] = [
        next[index + direction],
        next[index],
      ];
      return next;
    });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    const body = {
      title: data.get("title"),
      summary: data.get("summary"),
      parentGuidance: data.get("guidance"),
      activityInstructions: data.get("activity"),
      estimatedMinutes: data.get("minutes")
        ? Number(data.get("minutes"))
        : null,
      defaultCompletionMode: mode,
      defaultResponseTypes: responses,
      topicIds: topics,
      blocks: blocks.map(({ type, textContent, fileId, caption, altText }) => ({
        type,
        textContent,
        fileId,
        caption,
        altText,
      })),
      version: initial?.version,
      acknowledgeSharedUpdate: data.get("ack") === "on",
    };
    try {
      const saved = initial
        ? await api.put<Lesson>(`/lessons/${initial.id}`, body)
        : await api.post<Lesson>("/lessons", body);
      setDirty(false);
      navigate(`${root}/lessons/${saved.id}`, { replace: true });
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="THÊM MỘT Ý TƯỞNG CHO LỚP NHỎ"
        title={initial ? "Chỉnh sửa bài học" : "Soạn bài học"}
        description="Lưu nháp trước, xuất bản khi nội dung đã sẵn sàng."
      />
      <form
        className="learning-editor"
        onSubmit={submit}
        onChange={() => setDirty(true)}
      >
        <div>
          <section className="panel editor-section">
            <h2>Thông tin bài học</h2>
            <Field label="Tên bài học">
              <input
                name="title"
                maxLength={200}
                required
                defaultValue={initial?.title}
                disabled={busy}
                placeholder="Ví dụ: Khám phá ba màu cơ bản"
              />
            </Field>
            <Field label="Giới thiệu ngắn" optional>
              <textarea
                name="summary"
                maxLength={1000}
                rows={2}
                defaultValue={initial?.summary || ""}
                disabled={busy}
              />
            </Field>
            <Field label="Gợi ý cho gia đình" optional>
              <textarea
                name="guidance"
                maxLength={10000}
                rows={3}
                defaultValue={initial?.parentGuidance || ""}
                disabled={busy}
                placeholder="Chuẩn bị gì, cùng con thực hiện thế nào…"
              />
            </Field>
            <Field label="Hướng dẫn hoạt động" optional>
              <textarea
                name="activity"
                maxLength={20000}
                rows={4}
                defaultValue={initial?.activityInstructions || ""}
                disabled={busy}
              />
            </Field>
          </section>
          <section className="panel editor-section">
            <h2>Nội dung bài học</h2>
            <p className="muted">
              Thêm các khối chữ, video hoặc tài liệu theo thứ tự bé sẽ xem.
            </p>
            {blocks.map((block, index) => (
              <div className="block-editor" key={index}>
                <div className="block-toolbar">
                  <strong>Khối {index + 1}</strong>
                  <select
                    aria-label={`Loại khối ${index + 1}`}
                    value={block.type}
                    disabled={busy}
                    onChange={(event) =>
                      updateBlock(index, {
                        type: event.target.value,
                        fileId: null,
                        textContent: "",
                      })
                    }
                  >
                    {["TEXT", "IMAGE", "VIDEO", "AUDIO", "PDF"].map((type) => (
                      <option value={type} key={type}>
                        {
                          {
                            TEXT: "Nội dung chữ",
                            IMAGE: "Hình ảnh",
                            VIDEO: "Video",
                            AUDIO: "Âm thanh",
                            PDF: "Tài liệu PDF",
                          }[type]
                        }
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Đưa khối ${index + 1} lên`}
                    disabled={busy || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Đưa khối ${index + 1} xuống`}
                    disabled={busy || index === blocks.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Xóa khối ${index + 1}`}
                    disabled={busy}
                    onClick={() => {
                      setBlocks((current) =>
                        current.filter((_, i) => i !== index),
                      );
                      setDirty(true);
                    }}
                  >
                    <Icon name="close" />
                  </button>
                </div>
                {block.type === "TEXT" ? (
                  <Field label={`Nội dung khối ${index + 1}`}>
                    <textarea
                      value={block.textContent || ""}
                      rows={5}
                      maxLength={20000}
                      disabled={busy}
                      onChange={(event) =>
                        updateBlock(index, { textContent: event.target.value })
                      }
                    />
                  </Field>
                ) : (
                  <>
                    <Field label={`Tệp cho khối ${index + 1}`}>
                      <select
                        value={block.fileId || ""}
                        disabled={busy}
                        onChange={(event) =>
                          updateBlock(index, {
                            fileId: event.target.value || null,
                          })
                        }
                      >
                        <option value="">Chọn từ kho tài liệu</option>
                        {choices.data?.files
                          .filter((file) =>
                            block.type === "PDF"
                              ? file.mimeType === "application/pdf"
                              : file.mimeType.startsWith(
                                  `${block.type.toLowerCase()}/`,
                                ),
                          )
                          .map((file) => (
                            <option key={file.id} value={file.id}>
                              {file.originalName}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <button
                      type="button"
                      className="button button-small button-ghost"
                      disabled={busy}
                      onClick={() => setUploadFor(index)}
                    >
                      Tải tệp mới cho khối này
                    </button>
                    <Field label={`Chú thích khối ${index + 1}`} optional>
                      <input
                        value={block.caption || ""}
                        maxLength={500}
                        disabled={busy}
                        onChange={(event) =>
                          updateBlock(index, { caption: event.target.value })
                        }
                      />
                    </Field>
                  </>
                )}
              </div>
            ))}
            <button
              type="button"
              className="button button-ghost"
              disabled={busy || blocks.length >= 50}
              onClick={() => {
                setBlocks((current) => [
                  ...current,
                  {
                    type: "TEXT",
                    textContent: "",
                    fileId: null,
                    caption: null,
                    altText: null,
                  },
                ]);
                setDirty(true);
              }}
            >
              <Icon name="plus" />
              Thêm khối nội dung
            </button>
          </section>
        </div>
        <aside>
          <section className="panel editor-section">
            <h2>Cách học</h2>
            <Field label="Thời lượng dự kiến (phút)" optional>
              <input
                type="number"
                name="minutes"
                min={1}
                max={240}
                defaultValue={initial?.estimatedMinutes || ""}
                disabled={busy}
              />
            </Field>
            <Field label="Cách hoàn thành mặc định">
              <select
                value={mode}
                disabled={busy}
                onChange={(event) => setMode(event.target.value as typeof mode)}
              >
                {Object.entries(completionLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            {mode === "TEACHER_REVIEW" && (
              <fieldset className="choice-fieldset">
                <legend>Loại sản phẩm cho phép</legend>
                {[
                  ["TEXT", "Nội dung chữ"],
                  ["IMAGE", "Ảnh"],
                  ["AUDIO", "Âm thanh"],
                  ["VIDEO", "Video"],
                ].map(([value, label]) => (
                  <label key={value} className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={responses.includes(value)}
                      disabled={busy}
                      onChange={(event) =>
                        setResponses((current) =>
                          event.target.checked
                            ? [...current, value]
                            : current.filter((item) => item !== value),
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
            )}
            <h3>Chủ đề</h3>
            {choices.data?.topics
              .filter((topic) => !topic.archivedAt)
              .map((topic) => (
                <label className="checkbox-field" key={topic.id}>
                  <input
                    type="checkbox"
                    checked={topics.includes(topic.id)}
                    disabled={busy}
                    onChange={(event) =>
                      setTopics((current) =>
                        event.target.checked
                          ? [...current, topic.id]
                          : current.filter((id) => id !== topic.id),
                      )
                    }
                  />
                  {topic.name}
                </label>
              ))}
            {!choices.data?.topics.length && (
              <p className="muted">
                Có thể thêm chủ đề trong Thư viện sau khi lưu bài.
              </p>
            )}
          </section>
          <ErrorNotice
            error={error || choices.error}
            retry={choices.error ? choices.reload : undefined}
          />
          {initial?.status === "PUBLISHED" && (
            <label className="checkbox-field shared-update">
              <input type="checkbox" name="ack" required disabled={busy} />
              Tôi đồng ý cập nhật nội dung ở mọi lớp và lần giao đang dùng bài
              này.
            </label>
          )}
          <div className="editor-save">
            <button
              className="button button-primary button-full"
              disabled={busy}
            >
              {busy
                ? "Đang lưu…"
                : initial?.status === "PUBLISHED"
                  ? "Lưu thay đổi"
                  : "Lưu bản nháp"}
            </button>
            <button
              type="button"
              className="button button-ghost button-full"
              disabled={busy}
              onClick={() => {
                if (mayLeave())
                  navigate(initial ? `${root}/lessons/${initial.id}` : root);
              }}
            >
              Quay lại
            </button>
          </div>
        </aside>
      </form>
      {uploadFor !== null && (
        <UploadModal
          connections={choices.data?.storage || []}
          onClose={() => setUploadFor(null)}
          onUploaded={(file) => {
            updateBlock(uploadFor, { fileId: file.id });
            setUploadFor(null);
            choices.reload();
          }}
        />
      )}
    </>
  );
}
export function CourseEditorPage() {
  const { id } = useParams();
  const data = useResource(
    useCallback(
      (signal) =>
        id ? api.get<Course>(`/courses/${id}`, signal) : Promise.resolve(null),
      [id],
    ),
  );
  return data.loading && !data.data ? (
    <Loading />
  ) : data.error ? (
    <ErrorNotice error={data.error} retry={data.reload} />
  ) : (
    <CourseEditor key={id || "new"} initial={data.data} />
  );
}
function CourseEditor({ initial }: { initial: Course | null }) {
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<CourseLesson[]>(
      initial?.lessons.map((lesson) => ({
        ...lesson,
        isRequired:
          lesson.defaultCompletionMode === "REFERENCE"
            ? false
            : lesson.isRequired,
      })) || [],
    ),
    [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState<unknown>(null);
  const mayLeave = useUnsavedChanges(dirty);
  const choices = useResource(
    useCallback((signal) => api.list<Lesson>("/lessons?size=100", signal), []),
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    const body = {
      title: data.get("title"),
      description: data.get("description"),
      minAgeMonths: data.get("minAge") ? Number(data.get("minAge")) : null,
      maxAgeMonths: data.get("maxAge") ? Number(data.get("maxAge")) : null,
      lessons: lessons.map(({ lessonId, isRequired }) => ({
        lessonId,
        isRequired,
      })),
      version: initial?.version,
      acknowledgeSharedUpdate: data.get("ack") === "on",
    };
    try {
      const saved = initial
        ? await api.put<Course>(`/courses/${initial.id}`, body)
        : await api.post<Course>("/courses", body);
      setDirty(false);
      navigate(`${root}/courses/${saved.id}`, { replace: true });
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  function move(index: number, direction: number) {
    setDirty(true);
    setLessons((current) => {
      const next = [...current];
      [next[index], next[index + direction]] = [
        next[index + direction],
        next[index],
      ];
      return next;
    });
  }
  return (
    <>
      <PageHeader
        eyebrow="MỘT HÀNH TRÌNH NHIỀU KHÁM PHÁ"
        title={initial ? "Chỉnh sửa khóa học" : "Tạo khóa học"}
        description="Sắp xếp những bài học đã có thành một hành trình cho bé."
      />
      <form
        className="learning-editor"
        onSubmit={submit}
        onChange={() => setDirty(true)}
      >
        <div>
          <section className="panel editor-section">
            <h2>Thông tin khóa học</h2>
            <Field label="Tên khóa học">
              <input
                name="title"
                maxLength={200}
                defaultValue={initial?.title}
                required
                disabled={busy}
              />
            </Field>
            <Field label="Giới thiệu khóa học" optional>
              <textarea
                name="description"
                rows={4}
                maxLength={10000}
                defaultValue={initial?.description || ""}
                disabled={busy}
              />
            </Field>
            <div className="form-grid">
              <Field label="Tuổi tối thiểu (tháng)" optional>
                <input
                  type="number"
                  name="minAge"
                  min={0}
                  max={216}
                  defaultValue={initial?.minAgeMonths ?? ""}
                  disabled={busy}
                />
              </Field>
              <Field label="Tuổi tối đa (tháng)" optional>
                <input
                  type="number"
                  name="maxAge"
                  min={0}
                  max={216}
                  defaultValue={initial?.maxAgeMonths ?? ""}
                  disabled={busy}
                />
              </Field>
            </div>
          </section>
          <section className="panel editor-section">
            <h2>Các bài trong khóa</h2>
            <div className="course-add">
              <select
                aria-label="Chọn bài vào khóa"
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
                disabled={busy}
              >
                <option value="">Chọn bài học…</option>
                {choices.data?.data
                  .filter(
                    (item) =>
                      item.status !== "ARCHIVED" &&
                      !lessons.some((lesson) => lesson.lessonId === item.id),
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} · {contentStatus[item.status]}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="button button-ghost"
                disabled={!selected || busy}
                onClick={() => {
                  const lesson = choices.data?.data.find(
                    (item) => item.id === selected,
                  );
                  if (lesson) {
                    setLessons((current) => [
                      ...current,
                      {
                        lessonId: lesson.id,
                        title: lesson.title,
                        status: lesson.status,
                        defaultCompletionMode: lesson.defaultCompletionMode,
                        isRequired:
                          lesson.defaultCompletionMode !== "REFERENCE",
                      },
                    ]);
                    setSelected("");
                    setDirty(true);
                  }
                }}
              >
                Thêm bài
              </button>
            </div>
            {lessons.map((lesson, index) => (
              <div className="course-lesson-row" key={lesson.lessonId}>
                <span className="lesson-order">{index + 1}</span>
                <div>
                  <strong>{lesson.title}</strong>
                  <p className="muted">
                    {contentStatus[lesson.status || "DRAFT"]}
                  </p>
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={lesson.isRequired}
                      disabled={
                        busy || lesson.defaultCompletionMode === "REFERENCE"
                      }
                      onChange={(event) => {
                        setLessons((current) =>
                          current.map((item, i) =>
                            i === index
                              ? { ...item, isRequired: event.target.checked }
                              : item,
                          ),
                        );
                        setDirty(true);
                      }}
                    />
                    Bài bắt buộc
                  </label>
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Đưa bài ${index + 1} lên`}
                    disabled={busy || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Đưa bài ${index + 1} xuống`}
                    disabled={busy || index === lessons.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Bỏ bài ${index + 1}`}
                    disabled={busy}
                    onClick={() => {
                      setLessons((current) =>
                        current.filter((_, i) => i !== index),
                      );
                      setDirty(true);
                    }}
                  >
                    <Icon name="close" />
                  </button>
                </div>
              </div>
            ))}
            {!lessons.length && (
              <p className="muted">
                Chưa có bài. Có thể lưu nháp và bổ sung sau.
              </p>
            )}
          </section>
        </div>
        <aside className="panel editor-section">
          <h2>Sẵn sàng chia sẻ</h2>
          <p className="muted">
            Xuất bản cần ít nhất một bài đã xuất bản. Thay đổi danh sách khóa
            không sửa các lần giao đã tạo.
          </p>
          <ErrorNotice error={error || choices.error} />
          {initial?.status === "PUBLISHED" && (
            <label className="checkbox-field shared-update">
              <input name="ack" type="checkbox" required disabled={busy} />
              Tôi đồng ý cập nhật khóa đang xuất bản.
            </label>
          )}
          <button className="button button-primary button-full" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu khóa học"}
          </button>
          <button
            type="button"
            className="button button-ghost button-full"
            disabled={busy}
            onClick={() => {
              if (mayLeave())
                navigate(
                  initial
                    ? `${root}/courses/${initial.id}`
                    : `${root}?tab=courses`,
                );
            }}
          >
            Quay lại
          </button>
        </aside>
      </form>
    </>
  );
}
export function LessonBody({
  lesson,
  mediaUrl = fileUrl,
}: {
  lesson: Pick<Lesson, "parentGuidance" | "activityInstructions" | "blocks">;
  mediaUrl?: (id: string) => string;
}) {
  return (
    <div className="lesson-body">
      {lesson.parentGuidance && (
        <section className="guidance-box">
          <h2>Cùng gia đình chuẩn bị</h2>
          <p>{lesson.parentGuidance}</p>
        </section>
      )}
      {lesson.blocks?.map((block, index) => (
        <section className="lesson-block" key={block.id || index}>
          {block.type === "TEXT" ? (
            <p>{block.textContent}</p>
          ) : (
            block.fileId && (
              <MediaPreview
                mime={block.mimeType || "application/pdf"}
                url={mediaUrl(block.fileId)}
                name={block.altText || block.originalName || "Học liệu"}
              />
            )
          )}
          {block.caption && <p className="media-caption">{block.caption}</p>}
        </section>
      ))}
      {lesson.activityInstructions && (
        <section className="activity-box">
          <h2>Mình cùng thực hiện nhé</h2>
          <p>{lesson.activityInstructions}</p>
        </section>
      )}
    </div>
  );
}
export function LibraryDetailPage({ type }: { type: "lessons" | "courses" }) {
  const { id } = useParams();
  const data = useResource(
    useCallback(
      (signal) => api.get<Lesson & Course>(`/${type}/${id}`, signal),
      [type, id],
    ),
  );
  const [action, setAction] = useState<ActionRequest | null>(null);
  function act(kind: string, label: string) {
    if (!data.data) return;
    const version = data.data.version;
    setAction({
      title: label,
      label,
      description:
        kind === "publish"
          ? "Xuất bản vào thư viện. Gia đình chỉ xem sau khi bạn tạo lần giao và xuất bản lần giao đó."
          : kind === "archive"
            ? "Ngừng dùng cho lần giao mới. Nội dung đã giao và lịch sử được giữ."
            : "Khôi phục trạng thái trước lưu trữ. Những lần giao cũ vẫn giữ lịch sử.",
      run: (reason) => api.post(`/${type}/${id}/${kind}`, { version, reason }),
    });
  }
  if (data.loading && !data.data) return <Loading />;
  if (!data.data) return <ErrorNotice error={data.error} retry={data.reload} />;
  const item = data.data;
  const actions: ReactNode = (
    <div className="header-actions">
      {item.status === "PUBLISHED" && (
        <Link
          className="button button-primary"
          to={`/teacher/assignments/new?sourceType=${type === "lessons" ? "LESSON" : "COURSE"}&sourceId=${id}`}
        >
          Giao cho gia đình
        </Link>
      )}
      {item.status !== "ARCHIVED" && (
        <Link className="button button-ghost" to={`${root}/${type}/${id}/edit`}>
          <Icon name="edit" />
          Sửa
        </Link>
      )}
      {item.status === "DRAFT" && (
        <button
          className="button button-primary"
          onClick={() => act("publish", "Xuất bản")}
        >
          Xuất bản
        </button>
      )}
      {item.status !== "ARCHIVED" ? (
        <button
          className="button button-ghost"
          onClick={() => act("archive", "Lưu trữ")}
        >
          Lưu trữ
        </button>
      ) : (
        <button
          className="button button-ghost"
          onClick={() => act("restore", "Khôi phục")}
        >
          Khôi phục
        </button>
      )}
    </div>
  );
  return (
    <>
      <Link className="back-link" to={`${root}?tab=${type}`}>
        ← Về thư viện
      </Link>
      <PageHeader
        eyebrow={
          type === "lessons" ? "BÀI HỌC CỦA LỚP NHỎ" : "HÀNH TRÌNH KHÁM PHÁ"
        }
        title={item.title}
        description={item.summary || item.description || undefined}
        action={actions}
      />
      <div className="content-meta">
        <span className={`content-badge ${item.status.toLowerCase()}`}>
          {contentStatus[item.status]}
        </span>
        {type === "lessons" && (
          <span>
            {completionLabels[item.defaultCompletionMode]}
            {item.estimatedMinutes ? ` · ${item.estimatedMinutes} phút` : ""}
          </span>
        )}
      </div>
      {type === "lessons" ? (
        <section className="panel lesson-detail">
          <LessonBody lesson={item} />
        </section>
      ) : (
        <section className="panel course-detail">
          <h2>Các bài trong khóa</h2>
          {item.lessons.length ? (
            item.lessons.map((lesson, index) => (
              <Link
                className="course-lesson-row"
                to={`${root}/lessons/${lesson.lessonId}`}
                key={lesson.lessonId}
              >
                <span className="lesson-order">{index + 1}</span>
                <div>
                  <strong>{lesson.title}</strong>
                  <p className="muted">
                    {lesson.isRequired ? "Bắt buộc" : "Tùy chọn"} ·{" "}
                    {contentStatus[lesson.status || "DRAFT"]}
                  </p>
                </div>
                <Icon name="arrow" />
              </Link>
            ))
          ) : (
            <EmptyState title="Chưa có bài trong khóa">
              Thêm bài học vào bản nháp để tiếp tục.
            </EmptyState>
          )}
        </section>
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
