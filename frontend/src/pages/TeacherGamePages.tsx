import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { api, query } from "../lib/api";
import { useRefreshOnVisible, useResource } from "../lib/hooks";
import { useUnsavedChanges } from "../lib/unsavedChanges";
import {
  allGameChoices,
  gameInstant,
  gameTimeInput,
  gameTypeLabels,
} from "../lib/games";
import type {
  GameAssignment,
  GameRecipient,
  GameResult,
  LearningGame,
} from "../lib/games";
import type { Classroom, Student } from "../lib/types";
import { dateTimeLabel } from "../lib/format";
import FilterBar from "../components/FilterBar";
import { RefreshButton } from "../components/RefreshButton";
import {
  Badge,
  EmptyState,
  ErrorNotice,
  Field,
  Icon,
  Loading,
  Modal,
  PageHeader,
  Pagination,
} from "../components/ui";
import { GameStateBadge, GameTypeBadge, Stars } from "./GameParts";
import styles from "./Games.module.css";

export function TeacherGamesPage() {
  const [params, setParams] = useSearchParams(),
    q = params.get("q") || "",
    status = params.get("status") || "",
    type = params.get("gameType") || "",
    page = Math.max(0, Number(params.get("page")) || 0);
  const data = useResource(
    useCallback(
      (signal) =>
        api.list<LearningGame>(
          `/games${query({ q, status, gameType: type, page, size: 12 })}`,
          signal,
        ),
      [q, status, type, page],
    ),
    { refreshOnVisible: true },
  );
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: key === "q" });
  }
  return (
    <>
      <PageHeader
        eyebrow="HỌC QUA NHỮNG KHÁM PHÁ NHỎ"
        title="Kho trò chơi"
        description="Soạn, chơi thử và giao những hoạt động phù hợp với lớp nhỏ."
        action={
          <Link className="button button-primary" to="/teacher/games/new">
            <Icon name="plus" />
            Tạo trò chơi
          </Link>
        }
      />
      <div className={styles.toolbar}>
        <Link className="text-link" to="/teacher/game-assignments">
          Xem các lần giao và kết quả →
        </Link>
      </div>
      <FilterBar
        active={!!(q || status || type)}
        onReset={() => setParams(new URLSearchParams())}
      >
        <Field label="Tìm trò chơi">
          <span className="search-field">
            <Icon name="search" />
            <input
              type="search"
              value={q}
              onChange={(e) => filter("q", e.target.value)}
              placeholder="Tên trò chơi"
            />
          </span>
        </Field>
        <Field label="Trạng thái trò chơi">
          <select
            aria-label="Trạng thái trò chơi"
            value={status}
            onChange={(e) => filter("status", e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="DRAFT">Đang soạn</option>
            <option value="PUBLISHED">Đã xuất bản</option>
            <option value="ARCHIVED">Đã lưu trữ</option>
          </select>
        </Field>
        <Field label="Loại trò chơi">
          <select
            aria-label="Loại trò chơi"
            value={type}
            onChange={(e) => filter("gameType", e.target.value)}
          >
            <option value="">Tất cả loại</option>
            {Object.entries(gameTypeLabels).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </FilterBar>
      <ErrorNotice error={data.error} retry={data.reload} />
      {data.loading && !data.data ? (
        <Loading />
      ) : data.data?.data.length ? (
        <>
          <div className={styles.grid}>
            {data.data.data.map((game) => (
              <article className={`panel ${styles.tile}`} key={game.id}>
                <div className={styles.typeIcon}>
                  <Icon name="game" />
                </div>
                <div className={styles.tags}>
                  <GameTypeBadge type={game.gameType} />
                  <GameStateBadge status={game.status} />
                </div>
                <h2>{game.title}</h2>
                <p>
                  {game.instructions ||
                    "Hoạt động nhỏ để bé cùng gia đình khám phá."}
                </p>
                <small className="muted">
                  Gợi ý {game.minAgeMonths}–{game.maxAgeMonths} tháng · Bản{" "}
                  {game.contentRevision}
                </small>
                <div className={styles.actions}>
                  <Link
                    className="text-link"
                    to={`/teacher/games/${game.id}`}
                  >
                    Xem trò chơi <Icon name="arrow" />
                  </Link>
                  {game.status !== "ARCHIVED" && (
                    <Link
                      className="button button-ghost"
                      to={`/teacher/games/${game.id}/preview`}
                    >
                      Chơi thử
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
          <Pagination
            meta={data.data.meta}
            onChange={(p) => filter("page", String(p))}
          />
        </>
      ) : (
        !data.error && (
          <EmptyState title="Chưa có trò chơi trong bộ lọc này" icon="game">
            Tạo trò chơi đầu tiên hoặc chọn lại bộ lọc.
          </EmptyState>
        )
      )}
    </>
  );
}
export function TeacherGameDetailPage() {
  const { game } = useParams(),
    navigate = useNavigate();
  const data = useResource(
    useCallback(
      (signal) => api.get<LearningGame>(`/games/${game}`, signal),
      [game],
    ),
  );
  const [action, setAction] = useState<
      "publish" | "archive" | "restore" | null
    >(null),
    [assign, setAssign] = useState(false);
  if (data.loading && !data.data) return <Loading />;
  if (!data.data) return <ErrorNotice error={data.error} retry={data.reload} />;
  const g = data.data,
    count =
      g.gameType === "CHOICE"
        ? g.content.questions.length
        : g.content.pairs.length;
  return (
    <>
      <Link className="back-link" to="/teacher/games">
        ← Kho trò chơi
      </Link>
      <PageHeader
        eyebrow="SÁNG TẠO CÙNG CÔ"
        title={g.title}
        description={
          g.instructions || "Cô có thể bổ sung hướng dẫn trước khi giao."
        }
      />
      <ErrorNotice error={data.error} retry={data.reload} />
      <section className={`panel ${styles.section}`}>
        <div className={styles.tags}>
          <GameTypeBadge type={g.gameType} />
          <GameStateBadge status={g.status} />
          <Badge label={`${count} ${g.gameType === "CHOICE" ? "câu hỏi" : "cặp thẻ"}`} />
          <Badge label={`Bản nội dung ${g.contentRevision}`} />
        </div>
        <p className="muted">
          Tuổi gợi ý {g.minAgeMonths}–{g.maxAgeMonths} tháng. Cô chọn nội dung
          theo nhu cầu thực tế của bé.
        </p>
        <div className={styles.actions}>
          {g.status !== "ARCHIVED" && (
            <>
              <Link
                className="button button-ghost"
                to={`/teacher/games/${g.id}/edit`}
              >
                Chỉnh sửa
              </Link>
              <Link
                className="button button-ghost"
                to={`/teacher/games/${g.id}/preview`}
              >
                Chơi thử
              </Link>
            </>
          )}
          {g.status === "DRAFT" && (
            <button
              className="button button-primary"
              onClick={() => setAction("publish")}
            >
              Xuất bản trò chơi
            </button>
          )}
          {g.status === "PUBLISHED" && (
            <button
              className="button button-primary"
              onClick={() => setAssign(true)}
            >
              Giao trò chơi
            </button>
          )}
          {g.status === "ARCHIVED" ? (
            <button
              className="button button-ghost"
              onClick={() => setAction("restore")}
            >
              Khôi phục trò chơi
            </button>
          ) : (
            <button
              className="button button-ghost"
              onClick={() => setAction("archive")}
            >
              Lưu trữ trò chơi
            </button>
          )}
          <Link
            className="text-link"
            to={`/teacher/game-assignments?gameId=${g.id}`}
          >
            Lần giao và kết quả →
          </Link>
        </div>
      </section>
      <section className={`panel ${styles.section}`}>
        <h2>Nội dung đã soạn</h2>
        {g.gameType === "CHOICE"
          ? g.content.questions.map((q, index) => (
              <article className={styles.question} key={q.id}>
                <h3>
                  Câu {index + 1}: {q.prompt || "Chưa nhập lời hỏi"}
                </h3>
                <ul>
                  {q.options.map((o) => (
                    <li key={o.id}>
                      {o.label || "Chưa nhập đáp án"}
                      {q.correctOptionId === o.id ? " · Đáp án đúng" : ""}
                    </li>
                  ))}
                </ul>
                {q.hint && <p className="muted">Gợi ý: {q.hint}</p>}
              </article>
            ))
          : g.content.pairs.map((p, index) => (
              <article className={styles.question} key={p.id}>
                <h3>Cặp {index + 1}</h3>
                <p>
                  {p.left?.label || "Chưa nhập thẻ"} ↔{" "}
                  {p.right?.label || "Chưa nhập thẻ"}
                </p>
              </article>
            ))}
        {count === 0 && (
          <EmptyState title="Cô đang chuẩn bị nội dung">
            Chỉnh sửa để thêm câu hỏi hoặc cặp thẻ.
          </EmptyState>
        )}
      </section>
      {action && (
        <GameActionDialog
          title={
            action === "publish"
              ? "Xuất bản trò chơi"
              : action === "archive"
                ? "Lưu trữ trò chơi"
                : "Khôi phục trò chơi"
          }
          requireReason={action === "archive"}
          onClose={() => setAction(null)}
          onSubmit={async (reason) => {
            await api.post(`/games/${g.id}/${action}`, {
              version: g.version,
              reason: reason || null,
            });
            setAction(null);
            data.reload();
          }}
        >
          <p>
            {action === "publish"
              ? "Sau khi xuất bản, cô có thể giao trò chơi cho lớp hoặc từng bé."
              : action === "archive"
                ? "Các lần giao trước vẫn giữ nội dung của mình. Cô có thể thu hồi từng lần giao để dừng quyền chơi."
                : "Trò chơi sẽ trở lại trạng thái trước khi lưu trữ."}
          </p>
        </GameActionDialog>
      )}
      {assign && (
        <GameAssignDialog
          game={g}
          onClose={() => setAssign(false)}
          onCreated={(id) => {
            setAssign(false);
            navigate(`/teacher/game-assignments/${id}`);
          }}
        />
      )}
    </>
  );
}
export function TeacherGameAssignmentsPage() {
  const [params, setParams] = useSearchParams(),
    page = Math.max(0, Number(params.get("page")) || 0),
    gameId = params.get("gameId") || "";
  const navigate = useNavigate(),
    [creating, setCreating] = useState(false);
  const data = useResource(
    useCallback(
      (signal) =>
        api.list<GameAssignment>(
          `/game-assignments${query({ gameId, page, size: 12 })}`,
          signal,
        ),
      [gameId, page],
    ),
  );
  return (
    <>
      <Link className="back-link" to="/teacher/games">
        ← Kho trò chơi
      </Link>
      <PageHeader
        eyebrow="ĐỒNG HÀNH CÙNG GIA ĐÌNH"
        title="Trò chơi đã giao"
        description="Theo dõi từng lần giao, cấp quyền có chủ đích và xem kết quả của bé."
        action={
          <button
            className="button button-primary"
            onClick={() => setCreating(true)}
          >
            Giao trò chơi
          </button>
        }
      />
      <ErrorNotice error={data.error} retry={data.reload} />
      {data.loading && !data.data ? (
        <Loading />
      ) : data.data?.data.length ? (
        <>
          <div className={styles.grid}>
            {data.data.data.map((a) => (
              <article key={a.id} className={`panel ${styles.tile}`}>
                <div className={styles.tags}>
                  <GameTypeBadge type={a.gameType} />
                  <GameStateBadge status={a.status} />
                </div>
                <h2>{a.title}</h2>
                <p>{a.className || a.studentName || "Hoạt động riêng"}</p>
                <p>Mở: {dateTimeLabel(a.availableAt)}</p>
                <Link
                  className="button button-ghost"
                  to={`/teacher/game-assignments/${a.id}`}
                >
                  Xem kết quả
                </Link>
              </article>
            ))}
          </div>
          <Pagination
            meta={data.data.meta}
            onChange={(p) => {
              const next = new URLSearchParams(params);
              next.set("page", String(p));
              setParams(next);
            }}
          />
        </>
      ) : (
        !data.error && (
          <EmptyState title="Chưa có lần giao trò chơi" icon="game">
            Xuất bản trò chơi rồi chọn lớp hoặc bé để bắt đầu.
          </EmptyState>
        )
      )}
      {creating && (
        <GameAssignDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            navigate(`/teacher/game-assignments/${id}`);
          }}
        />
      )}
    </>
  );
}
export function TeacherGameResultsPage() {
  const { assignment } = useParams(),
    [page, setPage] = useState(0),
    [revoke, setRevoke] = useState(false),
    [grant, setGrant] = useState(false),
    [child, setChild] = useState<GameRecipient | null>(null);
  const source = useResource(
    useCallback(
      (signal) =>
        api.get<GameAssignment>(`/game-assignments/${assignment}`, signal),
      [assignment],
    ),
  );
  const results = useResource(
    useCallback(
      (signal) =>
        api.list<GameRecipient>(
          `/game-assignments/${assignment}/results?page=${page}&size=20`,
          signal,
        ),
      [assignment, page],
    ),
  );
  const refresh = () => {
    source.reload();
    results.reload();
  };
  useRefreshOnVisible(refresh, !source.loading && !results.loading);
  if (source.loading && !source.data) return <Loading />;
  if (!source.data)
    return <ErrorNotice error={source.error} retry={source.reload} />;
  const a = source.data;
  return (
    <>
      <Link className="back-link" to="/teacher/game-assignments">
        ← Các lần giao trò chơi
      </Link>
      <PageHeader
        eyebrow="MỖI BÉ MỘT HÀNH TRÌNH"
        title={a.title}
        description={`${a.className || a.studentName || "Hoạt động riêng"} · Mở ${dateTimeLabel(a.availableAt)}`}
        action={
          <RefreshButton
            label="Cập nhật kết quả"
            onClick={refresh}
            updatedAt={results.updatedAt}
            loading={source.loading || results.loading}
          />
        }
      />
      <ErrorNotice error={source.error} retry={refresh} />
      <section className={`panel ${styles.section}`}>
        <div className={styles.tags}>
          <GameTypeBadge type={a.gameType} />
          <GameStateBadge status={a.status} />
          <Badge label={`Bản nội dung ${a.snapshot.contentRevision}`} />
        </div>
        <p>
          {a.recipientCount} bé đã được giao · {a.revokedCount} quyền đã thu
          hồi.
        </p>
        <p className="muted">
          Lần giao giữ nội dung lúc cô giao. Các lượt chơi thử không tính vào
          kết quả của bé.
        </p>
        <div className={styles.actions}>
          <Link className="text-link" to={`/teacher/games/${a.gameId}`}>
            Mở mẫu trò chơi →
          </Link>
          {a.status === "ACTIVE" && (
            <>
              <button
                className="button button-ghost"
                onClick={() => setGrant(true)}
              >
                Thêm/cấp lại quyền
              </button>
              <button
                className="button button-ghost"
                onClick={() => setRevoke(true)}
              >
                Thu hồi lần giao
              </button>
            </>
          )}
        </div>
      </section>
      <ErrorNotice error={results.error} retry={results.reload} />
      {results.loading && !results.data ? (
        <Loading />
      ) : results.data?.data.length ? (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className="sr-only">Kết quả trò chơi theo bé</caption>
              <thead>
                <tr>
                  <th>Bé</th>
                  <th>Quyền chơi</th>
                  <th>Lượt đã xong</th>
                  <th>Sao tốt nhất</th>
                  <th>Hoàn thành gần nhất</th>
                  <th>Lịch sử</th>
                </tr>
              </thead>
              <tbody>
                {results.data.data.map((r) => (
                  <tr key={r.studentId}>
                    <td>
                      <strong>{r.studentName}</strong>
                      <small>{r.attempts} lượt đã bắt đầu</small>
                    </td>
                    <td>
                      {r.revokedAt
                        ? "Đã thu hồi"
                        : "Theo quyền lớp/bé hiện tại"}
                    </td>
                    <td>{r.completedAttempts}</td>
                    <td>
                      <Stars value={r.bestStars} />
                    </td>
                    <td>
                      {r.lastCompletedAt
                        ? dateTimeLabel(r.lastCompletedAt)
                        : "Chưa có"}
                    </td>
                    <td>
                      <button
                        className="button button-ghost button-small"
                        onClick={() => setChild(r)}
                      >
                        Xem lượt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={results.data.meta} onChange={setPage} />
        </>
      ) : (
        !results.error && (
          <EmptyState title="Chưa có bé trong lần giao này">
            Cô có thể thêm thành viên đủ quyền từ lớp đã chọn.
          </EmptyState>
        )
      )}
      {revoke && (
        <GameActionDialog
          title="Thu hồi lần giao trò chơi"
          requireReason
          onClose={() => setRevoke(false)}
          onSubmit={async (reason) => {
            await api.post(`/game-assignments/${a.id}/revoke`, {
              version: a.version,
              reason,
            });
            setRevoke(false);
            refresh();
          }}
        >
          <p>
            Gia đình sẽ dừng quyền chơi và xem nội dung của lần giao này. Kết
            quả đã hoàn thành được giữ trong lịch sử.
          </p>
        </GameActionDialog>
      )}
      {grant && (
        <GameGrantDialog
          assignment={a}
          onClose={() => setGrant(false)}
          onDone={() => {
            setGrant(false);
            refresh();
          }}
        />
      )}
      {child && (
        <GameAttemptHistoryDialog
          assignment={a.id}
          child={child}
          onClose={() => setChild(null)}
        />
      )}
    </>
  );
}
export function GameActionDialog({
  title,
  requireReason = false,
  children,
  onClose,
  onSubmit,
}: {
  title: string;
  requireReason?: boolean;
  children?: React.ReactNode;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    discard = useUnsavedChanges(!!reason);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(reason.trim());
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={title}
      onClose={() => discard(onClose)}
      busy={busy}
    >
      <form onSubmit={submit}>
        {children}
        {requireReason && (
          <Field label="Lý do">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              maxLength={1000}
              rows={3}
            />
          </Field>
        )}
        <ErrorNotice error={error} />
        <div className={styles.actions}>
          <button
            className="button button-primary"
            type="submit"
            disabled={busy}
          >
            {busy ? "Đang xử lý…" : "Xác nhận"}
          </button>
          <button
            className="button button-ghost"
            type="button"
            disabled={busy}
            onClick={() => discard(onClose)}
          >
            Quay lại
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function GameAssignDialog({
  game,
  onClose,
  onCreated,
}: {
  game?: LearningGame;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [gameId, setGameId] = useState(game?.id || ""),
    [title, setTitle] = useState(game?.title || ""),
    [target, setTarget] = useState<"CLASS" | "STUDENT">("CLASS"),
    [targetId, setTargetId] = useState(""),
    [available, setAvailable] = useState(gameTimeInput),
    [due, setDue] = useState(""),
    [linked, setLinked] = useState<"NONE" | "LESSON" | "COURSE">("NONE"),
    [linkedId, setLinkedId] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [requestId] = useState(() => crypto.randomUUID());
  const discard = useUnsavedChanges(!!targetId || !!title || !!linkedId);
  const choices = useResource(
    useCallback(async (signal) => {
      const [games, classes, students, lessons, courses] = await Promise.all([
        allGameChoices<LearningGame>("/games?status=PUBLISHED", signal),
        allGameChoices<Classroom>("/classes?status=ACTIVE", signal),
        allGameChoices<Student>("/students?status=ACTIVE", signal),
        allGameChoices<{ id: string; title: string }>(
          "/lessons?status=PUBLISHED",
          signal,
        ),
        allGameChoices<{ id: string; title: string }>(
          "/courses?status=PUBLISHED",
          signal,
        ),
      ]);
      return { games, classes, students, lessons, courses };
    }, []),
  );
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<GameAssignment>("/game-assignments", {
        clientRequestId: requestId,
        gameId,
        title,
        targetType: target,
        classId: target === "CLASS" ? targetId : null,
        studentId: target === "STUDENT" ? targetId : null,
        availableAt: gameInstant(available),
        dueAt: gameInstant(due),
        linkedLessonId: linked === "LESSON" ? linkedId : null,
        linkedCourseId: linked === "COURSE" ? linkedId : null,
      });
      onCreated(result.id);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Giao trò chơi"
      onClose={() => discard(onClose)}
      busy={busy}
      wide
    >
      <ErrorNotice error={choices.error} retry={choices.reload} />
      {choices.loading && !choices.data ? (
        <Loading />
      ) : (
        choices.data && (
          <form onSubmit={submit}>
            <Field label="Trò chơi đã xuất bản">
              <select
                value={gameId}
                onChange={(e) => {
                  setGameId(e.target.value);
                  setTitle(
                    choices.data?.games.find((g) => g.id === e.target.value)
                      ?.title || "",
                  );
                }}
                required
                disabled={!!game}
              >
                <option value="">Chọn trò chơi</option>
                {choices.data.games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title} · {gameTypeLabels[g.gameType]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tên lần giao">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={200}
              />
            </Field>
            <div className={styles.formGrid}>
              <Field label="Giao cho">
                <select
                  value={target}
                  onChange={(e) => {
                    setTarget(e.target.value as "CLASS" | "STUDENT");
                    setTargetId("");
                  }}
                >
                  <option value="CLASS">Cả lớp</option>
                  <option value="STUDENT">Riêng một bé</option>
                </select>
              </Field>
              <Field
                label={
                  target === "CLASS" ? "Lớp nhận trò chơi" : "Bé nhận trò chơi"
                }
              >
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  required
                >
                  <option value="">
                    Chọn {target === "CLASS" ? "lớp" : "bé"}
                  </option>
                  {target === "CLASS"
                    ? choices.data.classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))
                    : choices.data.students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.fullName}
                        </option>
                      ))}
                </select>
              </Field>
            </div>
            <div className={styles.formGrid}>
              <Field label="Mở lúc (giờ Việt Nam)">
                <input
                  type="datetime-local"
                  value={available}
                  onChange={(e) => setAvailable(e.target.value)}
                  required
                />
              </Field>
              <Field label="Hạn gợi ý (giờ Việt Nam)" optional>
                <input
                  type="datetime-local"
                  value={due}
                  min={available}
                  onChange={(e) => setDue(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Gắn với nội dung học">
              <select
                value={linked}
                onChange={(e) => {
                  setLinked(e.target.value as typeof linked);
                  setLinkedId("");
                }}
              >
                <option value="NONE">Trò chơi riêng</option>
                <option value="LESSON">Một bài học</option>
                <option value="COURSE">Một khóa học</option>
              </select>
            </Field>
            {linked !== "NONE" && (
              <Field
                label={
                  linked === "LESSON"
                    ? "Bài học liên quan"
                    : "Khóa học liên quan"
                }
              >
                <select
                  value={linkedId}
                  onChange={(e) => setLinkedId(e.target.value)}
                  required
                >
                  <option value="">Chọn nội dung đã xuất bản</option>
                  {(linked === "LESSON"
                    ? choices.data.lessons
                    : choices.data.courses
                  ).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <p className="info-notice">
              Bé nhận bản nội dung hiện tại. Tiến độ trò chơi được theo dõi
              riêng; yêu cầu xác nhận hoặc nộp sản phẩm của bài học vẫn do cô
              đặt.
            </p>
            <ErrorNotice error={error} />
            <div className={styles.actions}>
              <button
                className="button button-primary"
                disabled={busy}
                type="submit"
              >
                {busy ? "Đang giao…" : "Giao cho gia đình"}
              </button>
              <button
                className="button button-ghost"
                type="button"
                disabled={busy}
                onClick={() => discard(onClose)}
              >
                Quay lại
              </button>
            </div>
          </form>
        )
      )}
    </Modal>
  );
}
function GameGrantDialog({
  assignment,
  onClose,
  onDone,
}: {
  assignment: GameAssignment;
  onClose: () => void;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    discard = useUnsavedChanges(selected.length > 0 || !!reason);
  const options = useResource(
    useCallback(
      async (signal) =>
        assignment.classId
          ? (
              await allGameChoices<{
                studentId: string;
                studentName: string;
                status: string;
              }>(`/classes/${assignment.classId}/enrollments`, signal)
            )
              .filter((e) => e.status === "ACTIVE")
              .map((e) => ({ id: e.studentId, name: e.studentName }))
          : assignment.studentId
            ? [
                {
                  id: assignment.studentId,
                  name: assignment.studentName || "Bé được giao",
                },
              ]
            : [],
      [assignment.classId, assignment.studentId, assignment.studentName],
    ),
  );
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !selected.length) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/game-assignments/${assignment.id}/recipients`, {
        version: assignment.version,
        studentIds: selected,
        reason,
      });
      onDone();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Thêm hoặc cấp lại quyền chơi"
      onClose={() => discard(onClose)}
      busy={busy}
    >
      <p>Chọn bé hiện đủ quyền trong lớp/đích của lần giao này.</p>
      <ErrorNotice error={options.error} retry={options.reload} />
      {options.loading && !options.data ? (
        <Loading />
      ) : (
        <form onSubmit={submit}>
          <div className={styles.checks}>
            {options.data?.map((o) => (
              <label key={o.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(o.id)}
                  onChange={(e) =>
                    setSelected((s) =>
                      e.target.checked
                        ? [...s, o.id]
                        : s.filter((id) => id !== o.id),
                    )
                  }
                />
                {o.name}
              </label>
            ))}
          </div>
          <Field label="Lý do cấp quyền">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              maxLength={1000}
              rows={3}
            />
          </Field>
          <ErrorNotice error={error} />
          <button
            className="button button-primary"
            disabled={busy || !selected.length}
            type="submit"
          >
            {busy ? "Đang lưu…" : "Cấp quyền cho bé đã chọn"}
          </button>
        </form>
      )}
    </Modal>
  );
}
function GameAttemptHistoryDialog({
  assignment,
  child,
  onClose,
}: {
  assignment: string;
  child: GameRecipient;
  onClose: () => void;
}) {
  const [page, setPage] = useState(0),
    data = useResource(
      useCallback(
        (signal) =>
          api.list<GameResult>(
            `/game-assignments/${assignment}/students/${child.studentId}/results?page=${page}&size=10`,
            signal,
          ),
        [assignment, child.studentId, page],
      ),
    );
  return (
    <Modal title={`Lượt chơi · ${child.studentName}`} onClose={onClose} wide>
      <ErrorNotice error={data.error} retry={data.reload} />
      {data.loading && !data.data ? (
        <Loading />
      ) : data.data?.data.length ? (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Thời điểm</th>
                  <th>Trạng thái</th>
                  <th>Đúng / tổng</th>
                  <th>Sai / gợi ý</th>
                  <th>Thời gian lượt</th>
                  <th>Sao</th>
                </tr>
              </thead>
              <tbody>
                {data.data.data.map((r) => (
                  <tr key={r.id}>
                    <td>{dateTimeLabel(r.startedAt)}</td>
                    <td>
                      <GameStateBadge status={r.status} />
                    </td>
                    <td>
                      {r.correctCount}/{r.totalSteps}
                    </td>
                    <td>
                      {r.wrongCount} / {r.hintCount}
                    </td>
                    <td>{r.durationSeconds}s</td>
                    <td>
                      <Stars value={r.stars} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={data.data.meta} onChange={setPage} />
        </>
      ) : (
        !data.error && (
          <EmptyState title="Bé chưa có lượt chơi">
            Kết quả xuất hiện sau khi gia đình bắt đầu hoạt động.
          </EmptyState>
        )
      )}
    </Modal>
  );
}
