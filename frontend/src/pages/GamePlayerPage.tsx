import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, api } from "../lib/api";
import { useBeforeUnload, useResource } from "../lib/hooks";
import { trapDialogFocus } from "../lib/accessibility";
import { childModeLink, useChildMode } from "../lib/childMode";
import { gameMedia } from "../lib/games";
import type { GameAttempt, GameMove } from "../lib/games";
import { ActionModal } from "../components/ActionModal";
import type { ActionRequest } from "../components/ActionModal";
import { Badge, ErrorNotice, Icon, Loading } from "../components/ui";
import { FaceContent, GameAudio, GameTypeBadge, Stars } from "./GameParts";
import styles from "./Games.module.css";

function nextMove(attempt: GameAttempt, left: string | null) {
  if (attempt.gameType === "MATCH")
    return left ? "Tìm thẻ ghép bên phải." : "Chọn một thẻ bên trái.";
  if (attempt.gameType === "MEMORY")
    return !attempt.mismatch &&
      attempt.cards?.some((card) => card.revealed && !card.matched)
      ? "Lật thêm một thẻ."
      : "Lật một thẻ.";
  return "Chạm vào thẻ con chọn.";
}

export default function GamePlayerPage() {
  const { game, child, assignment } = useParams();
  return (
    <Player
      key={`${game || ""}-${child || ""}-${assignment || ""}`}
      game={game}
      child={child}
      assignment={assignment}
    />
  );
}
function Player({
  game,
  child,
  assignment,
}: {
  game?: string;
  child?: string;
  assignment?: string;
}) {
  const navigate = useNavigate(),
    kidMode = useChildMode(),
    dialog = useRef<HTMLDialogElement>(null),
    gameHeading = useRef<HTMLHeadingElement>(null),
    questionHeading = useRef<HTMLHeadingElement>(null),
    resultHeading = useRef<HTMLHeadingElement>(null),
    alive = useRef(false),
    serial = useRef(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID()),
    [override, setOverride] = useState<GameAttempt | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [fatal, setFatal] = useState(false),
    [left, setLeft] = useState<string | null>(null),
    [hiddenVersion, setHiddenVersion] = useState(-1),
    [pending, setPending] = useState(false),
    [action, setAction] = useState<ActionRequest | null>(null);
  const pendingMove = useRef<{ attempt: string; body: GameMove } | null>(null);
  useBeforeUnload(pending);
  const started = useResource(
    useCallback(
      (signal) =>
        api.post<GameAttempt>(
          game
            ? `/games/${game}/preview-attempts`
            : `/family/children/${child}/game-assignments/${assignment}/attempts`,
          { clientRequestId: requestId },
          signal,
        ),
      [game, child, assignment, requestId],
    ),
  );
  const attempt =
      started.data &&
      (override?.id === started.data.id ? override : started.data),
    media = (id: string) => gameMedia(child, assignment, id);
  const exitLabel = game ? "Thoát chơi thử" : "Rời góc chơi",
    returnLabel = game ? "Về trang trò chơi" : "Về góc chơi";
  function exitGame() {
    navigate(
      game
        ? `/teacher/games/${game}`
        : childModeLink(`/family/children/${child}/games`, kidMode),
    );
  }
  function exit() {
    if (!pending) {
      exitGame();
      return;
    }
    setAction({
      title: `${exitLabel}?`,
      description: "Lần chọn vừa rồi chưa lưu xong.",
      label: exitLabel,
      cancelLabel: "Ở lại",
      showReason: false,
      run: async () => exitGame(),
    });
  }
  useEffect(() => {
    alive.current = true;
    const el = dialog.current,
      previous = document.body.style.overflow;
    gameHeading.current?.setAttribute("autofocus", "");
    el?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      alive.current = false;
      el?.close();
      document.body.style.overflow = previous;
    };
  }, []);
  useEffect(() => {
    gameHeading.current?.focus({ preventScroll: true });
  }, [requestId]);
  useEffect(() => {
    if (!attempt?.mismatch) return;
    const timer = window.setTimeout(
      () => setHiddenVersion(attempt.version),
      1100,
    );
    return () => window.clearTimeout(timer);
  }, [attempt?.id, attempt?.version, attempt?.mismatch]);
  useEffect(() => {
    if (kidMode && attempt?.status === "COMPLETED")
      resultHeading.current?.focus();
  }, [attempt?.status, kidMode]);
  useEffect(() => {
    if (kidMode && attempt?.question?.id) questionHeading.current?.focus();
  }, [attempt?.question?.id, kidMode]);
  async function move(input?: Omit<GameMove, "clientRequestId" | "version">) {
    if (!attempt || serial.current || fatal) return;
    const next = pendingMove.current || {
      attempt: attempt.id,
      body: {
        ...input!,
        clientRequestId: crypto.randomUUID(),
        version: attempt.version,
      },
    };
    if (!input && !pendingMove.current) return;
    pendingMove.current = next;
    setPending(true);
    serial.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<GameAttempt>(
        `/game-attempts/${next.attempt}/moves`,
        next.body,
      );
      if (alive.current) {
        setOverride(result);
        setLeft(null);
        pendingMove.current = null;
        setPending(false);
      }
    } catch (failure) {
      if (!alive.current) return;
      if (failure instanceof ApiError) {
        pendingMove.current = null;
        setPending(false);
        if ([401, 403, 404].includes(failure.status)) {
          setFatal(true);
          setOverride(null);
        } else if (failure.status === 409) {
          try {
            setOverride(
              await api.get<GameAttempt>(`/game-attempts/${next.attempt}`),
            );
            setLeft(null);
          } catch (refreshError) {
            if (
              refreshError instanceof ApiError &&
              [401, 403, 404].includes(refreshError.status)
            )
              setFatal(true);
          }
        }
      }
      setError(failure);
    } finally {
      serial.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function replay() {
    if (!attempt || serial.current || pending) return;
    serial.current = true;
    setBusy(true);
    setError(null);
    try {
      if (attempt.status === "IN_PROGRESS")
        await api.post(`/game-attempts/${attempt.id}/abandon`, {
          version: attempt.version,
        });
      if (alive.current) {
        setLeft(null);
        setHiddenVersion(-1);
        setOverride(null);
        setRequestId(crypto.randomUUID());
      }
    } catch (failure) {
      if (alive.current) {
        setError(failure);
        if (
          failure instanceof ApiError &&
          [401, 403, 404].includes(failure.status)
        )
          setFatal(true);
      }
    } finally {
      serial.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function requestRestart() {
    setAction({
      title: "Bắt đầu lại?",
      description: kidMode
        ? "Chơi tiếp hoặc quay về đầu trò chơi."
        : "Lượt đang chơi sẽ dừng để bắt đầu một lượt mới.",
      label: "Bắt đầu lại",
      cancelLabel: "Chơi tiếp",
      cancelPrimary: kidMode,
      cancelIcon: kidMode ? "play" : undefined,
      confirmIcon: kidMode ? "refresh" : undefined,
      showReason: false,
      run: replay,
    });
  }
  const mismatchVisible =
      !!attempt?.mismatch && hiddenVersion !== attempt.version,
    disabled = busy || pending || mismatchVisible,
    failure = started.error || error,
    unavailable =
      fatal ||
      (kidMode &&
        started.error instanceof ApiError &&
        [401, 403, 404].includes(started.error.status)),
    feedback = left ? null : attempt?.feedback,
    showInstructionAudio = kidMode && !attempt?.question?.audioFileId;
  const player = (
    <dialog
      ref={dialog}
      className={`${styles.player} ${kidMode ? styles.kidPlayer : ""}`}
      onKeyDown={trapDialogFocus}
      aria-labelledby="game-play-title"
      onCancel={(e) => {
        e.preventDefault();
        exit();
      }}
    >
      <div className={styles.playerInner}>
        <header className={styles.playHeader}>
          {!kidMode && (
            <span>{game ? "Không gian chơi thử của cô" : "Cùng bé khám phá"}</span>
          )}
          <button className="button button-ghost" onClick={exit}>
            {kidMode && <span aria-hidden="true">←</span>}
            {exitLabel} {!kidMode && <Icon name="close" />}
          </button>
        </header>
        <div className={styles.playTitle}>
          <h1 id="game-play-title" ref={gameHeading} tabIndex={-1}>
            {attempt?.title || "Mở trò chơi của bé"}
          </h1>
          {game && <p>Lượt chơi thử được lưu riêng để cô kiểm tra nội dung.</p>}
        </div>
        {kidMode ? (
          failure && !unavailable ? (
            <div className={`error-notice ${styles.kidError}`} role="alert">
              <p>Chưa tải được. Bé thử lại nhé.</p>
              <button
                className="button button-primary"
                disabled={busy || started.loading}
                onClick={() => {
                  if (pendingMove.current) void move();
                  else {
                    setError(null);
                    started.reload();
                  }
                }}
              >
                Thử lại
              </button>
            </div>
          ) : null
        ) : (
          <>
            <ErrorNotice error={started.error} retry={started.reload} />
            <ErrorNotice
              error={error}
              retry={
                !fatal
                  ? () => (pendingMove.current ? void move() : started.reload())
                  : undefined
              }
            />
          </>
        )}
        {unavailable ? (
          <section className={`panel ${styles.ending}`}>
            <h2>Trò chơi hiện chưa thể mở</h2>
            {kidMode ? (
              <p>Bé có thể chọn trò khác.</p>
            ) : (
              <p>
                Quyền của bé hoặc lần giao đã thay đổi. Gia đình quay về góc chơi
                để xem những hoạt động đang có nhé.
              </p>
            )}
            <button className="button button-primary" onClick={exit}>
              {returnLabel}
            </button>
          </section>
        ) : started.loading && !started.data ? (
          <Loading
            text={kidMode ? "Đang mở trò chơi…" : "Đang mở những khám phá nhỏ…"}
          />
        ) : (
          attempt && (
            <>
              {!kidMode && (
                <div className={styles.tags}>
                  <GameTypeBadge type={attempt.gameType} />
                  {attempt.isPreview && (
                    <Badge label="Chơi thử" />
                  )}
                </div>
              )}
              {attempt.status === "COMPLETED" ? (
                <section
                  className={`panel ${styles.ending}`}
                  aria-label="Kết quả lượt chơi"
                >
                  <Stars value={attempt.stars} />
                  <h2 ref={resultHeading} tabIndex={kidMode ? -1 : undefined}>
                    {kidMode ? "Bé làm được rồi!" : "Mình đã khám phá xong rồi!"}
                  </h2>
                  {!kidMode && (
                    <>
                      <p>Cảm ơn bé đã kiên nhẫn quan sát và thử sức.</p>
                      <p>
                        {attempt.correctCount} / {attempt.totalSteps} bước hoàn
                        thành · {attempt.moveCount} lần chọn
                      </p>
                    </>
                  )}
                  <div className={styles.actions}>
                    {kidMode && (
                      <button className="button button-primary" onClick={exit}>
                        Về góc chơi <Icon name="arrow" />
                      </button>
                    )}
                    <button
                      className={`button ${kidMode ? "button-ghost" : "button-primary"}`}
                      disabled={busy}
                      onClick={() => void replay()}
                    >
                      Chơi lại lần nữa
                    </button>
                    {!kidMode && (
                      <button className="button button-ghost" onClick={exit}>
                        {returnLabel}
                      </button>
                    )}
                  </div>
                </section>
              ) : attempt.status === "ABANDONED" ? (
                <section className={`panel ${styles.ending}`}>
                  <h2>Lượt chơi đã dừng</h2>
                  <p>Bé có thể bắt đầu một lượt mới khi sẵn sàng.</p>
                  <button
                    className="button button-primary"
                    disabled={busy}
                    onClick={() => void replay()}
                  >
                    Bắt đầu lượt mới
                  </button>
                </section>
              ) : (
                <>
                  {!kidMode && (
                    <>
                      {attempt.instructions && (
                        <p className="info-notice">{attempt.instructions}</p>
                      )}
                      <GameAudio
                        id={attempt.instructionAudioFileId}
                        media={media}
                        label="Nghe hướng dẫn"
                      />
                    </>
                  )}
                  <progress
                    className={styles.playProgress}
                    value={attempt.correctCount}
                    max={attempt.totalSteps}
                    aria-label="Tiến độ trò chơi"
                  />
                  <p className={styles.progressText}>
                    {attempt.correctCount} / {attempt.totalSteps}{" "}
                    {kidMode ? "đã xong" : "bước khám phá"}
                  </p>
                  <section
                    className={`panel ${styles.playPanel}`}
                    aria-label="Bàn chơi"
                  >
                    {kidMode && (
                      <>
                        <p
                          className={`${styles.kidPrompt} ${feedback === "CORRECT" ? styles.kidSuccess : ""}`}
                          role="status"
                        >
                          {feedback === "CORRECT" && <Icon name="check" />}
                          <span>
                            {feedback === "CORRECT" && "Đúng rồi! "}
                            {feedback === "TRY_AGAIN" && "Thử lại nhé! "}
                            {mismatchVisible
                              ? "Hai thẻ chưa giống nhau."
                              : nextMove(attempt, left)}
                          </span>
                        </p>
                        {attempt.hintText && (
                          <p className={styles.hint} role="status">
                            {attempt.hintText}
                          </p>
                        )}
                        {showInstructionAudio && (
                          <GameAudio
                            id={attempt.instructionAudioFileId}
                            media={media}
                            label="Nghe cách chơi"
                          />
                        )}
                      </>
                    )}
                    {attempt.gameType === "CHOICE" && attempt.question && (
                      <>
                        <h2 ref={questionHeading} tabIndex={-1}>
                          {attempt.question.prompt}
                        </h2>
                        {attempt.question.imageFileId && (
                          <img
                            className={styles.promptImage}
                            src={media(attempt.question.imageFileId)}
                            alt="Hình cho câu hỏi"
                          />
                        )}
                        <GameAudio
                          key={attempt.question.id}
                          id={attempt.question.audioFileId}
                          media={media}
                          label="Nghe câu hỏi"
                        />
                        <div className={styles.choices}>
                          {attempt.question.options.map((o) => (
                            <div className={styles.cardCell} key={o.id}>
                              <button
                                className={styles.cardButton}
                                disabled={disabled}
                                onClick={() =>
                                  void move({
                                    action: "ANSWER",
                                    optionId: o.id,
                                  })
                                }
                              >
                                <FaceContent face={o} media={media} />
                              </button>
                              <GameAudio
                                id={o.audioFileId}
                                media={media}
                                label={`Nghe ${o.label}`}
                              />
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {attempt.gameType === "MATCH" && (
                      <>
                        {!kidMode && (
                          <h2>Chọn một thẻ bên trái rồi tìm bạn bên phải nhé!</h2>
                        )}
                        <div className={styles.matchGrid}>
                          <div className={styles.matchColumn}>
                            <h3>{kidMode ? "1. Chọn thẻ" : "Thẻ bên trái"}</h3>
                            {attempt.left?.map((c) => (
                              <div className={styles.cardCell} key={c.id}>
                                <button
                                  aria-pressed={left === c.id}
                                  className={`${styles.cardButton} ${c.matched ? styles.matched : left === c.id ? styles.selected : ""}`}
                                  disabled={disabled || c.matched}
                                  onClick={() => setLeft(c.id)}
                                >
                                  <FaceContent face={c} media={media} />
                                  {c.matched && <Icon name="check" />}
                                </button>
                                <GameAudio
                                  id={c.audioFileId}
                                  media={media}
                                  label={`Nghe ${c.label}`}
                                />
                              </div>
                            ))}
                          </div>
                          <div className={styles.matchColumn}>
                            <h3>{kidMode ? "2. Tìm bạn" : "Bạn của thẻ"}</h3>
                            {attempt.right?.map((c) => (
                              <div className={styles.cardCell} key={c.id}>
                                <button
                                  className={`${styles.cardButton} ${c.matched ? styles.matched : ""}`}
                                  disabled={disabled || c.matched || !left}
                                  onClick={() =>
                                    void move({
                                      action: "MATCH",
                                      leftId: left!,
                                      rightId: c.id,
                                    })
                                  }
                                >
                                  <FaceContent face={c} media={media} />
                                  {c.matched && <Icon name="check" />}
                                </button>
                                <GameAudio
                                  id={c.audioFileId}
                                  media={media}
                                  label={`Nghe ${c.label}`}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                    {attempt.gameType === "MEMORY" && (
                      <>
                        {!kidMode && <h2>Tìm hai hình giống nhau nhé!</h2>}
                        <div className={styles.memoryGrid}>
                          {attempt.cards?.map((c, index) => {
                            const visible =
                              c.matched ||
                              (c.revealed &&
                                (!attempt.mismatch ||
                                  hiddenVersion !== attempt.version));
                            return (
                              <div className={styles.cardCell} key={c.id}>
                                <button
                                  aria-label={`Thẻ ${index + 1}${visible && c.face ? `: ${c.face.label}` : ""}${c.matched ? " đã ghép" : ""}`}
                                  className={`${styles.cardButton} ${c.matched ? styles.matched : visible ? "" : styles.hiddenCard}`}
                                  disabled={
                                    disabled ||
                                    c.matched ||
                                    (visible && c.revealed)
                                  }
                                  onClick={() =>
                                    void move({ action: "FLIP", cardId: c.id })
                                  }
                                >
                                  {visible && c.face ? (
                                    <FaceContent face={c.face} media={media} />
                                  ) : (
                                     <Icon name="cards" />
                                  )}
                                </button>
                                {visible && c.face && (
                                  <GameAudio
                                    id={c.face.audioFileId}
                                    media={media}
                                    label={`Nghe ${c.face.label}`}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </section>
                  {kidMode ? (
                    <details className={styles.kidHelp}>
                      <summary>
                        Cần giúp? <Icon name="chevron" />
                      </summary>
                      {attempt.instructions && <p>{attempt.instructions}</p>}
                      <div className={styles.actions}>
                        {!showInstructionAudio && (
                          <GameAudio
                            id={attempt.instructionAudioFileId}
                            media={media}
                            label="Nghe hướng dẫn"
                          />
                        )}
                        <button
                          className="button button-ghost"
                          disabled={disabled}
                          onClick={() => void move({ action: "HINT" })}
                        >
                          Gợi ý cho con
                        </button>
                        <button
                          className="button button-ghost"
                          disabled={busy || pending}
                           onClick={requestRestart}
                        >
                           <Icon name="refresh" /> Bắt đầu lại
                        </button>
                      </div>
                      <p className="muted">
                        Trò chơi tự lưu. Bé có thể nghỉ rồi chơi tiếp.
                      </p>
                    </details>
                  ) : (
                    <>
                      <p className={styles.feedback} aria-live="polite">
                        {attempt.feedback === "CORRECT"
                          ? "Con tìm được rồi, mình tiếp tục nhé!"
                          : attempt.feedback === "TRY_AGAIN"
                            ? "Mình quan sát và thử lại nhé!"
                            : "Con chọn một thẻ để bắt đầu nhé."}
                      </p>
                      {attempt.hintText && (
                        <p className={styles.hint} role="status">
                          {attempt.hintText}
                        </p>
                      )}
                      <div className={styles.actions}>
                        <button
                          className="button button-ghost"
                          disabled={disabled}
                          onClick={() => void move({ action: "HINT" })}
                        >
                          Gợi ý cho con
                        </button>
                        <button
                          className="button button-ghost"
                          disabled={busy || pending}
                           onClick={requestRestart}
                        >
                          Bắt đầu lại
                        </button>
                        <small className="muted">
                          Lượt chơi tự lưu sau mỗi lần chọn.
                        </small>
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )
        )}
      </div>
    </dialog>
  );
  return (
    <>
      {player}
      {action && (
        <ActionModal
          action={action}
          onClose={() => setAction(null)}
          onSuccess={() => setAction(null)}
        />
      )}
    </>
  );
}
