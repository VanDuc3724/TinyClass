import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, api, apiUrl } from "../lib/api";
import { useResource, useUnsavedChanges } from "../lib/hooks";
import { ErrorNotice, Field, Loading, PageHeader } from "../components/ui";
import {
  emptyContent,
  emptyFace,
  emptyQuestion,
  gameSample,
  gameTypeLabels,
} from "../lib/games";
import type {
  GameContent,
  GameFace,
  GamePair,
  GameQuestion,
  GameType,
  LearningGame,
} from "../lib/games";
import GameAssetPicker from "./GameAssetPicker";
import styles from "./Games.module.css";

type Draft = {
  title: string;
  gameType: GameType;
  instructions: string;
  minAgeMonths: number;
  maxAgeMonths: number;
  content: GameContent;
};
type Picker = { kind: "image" | "audio"; pick: (id: string) => void };
const initial = (): Draft => ({
  title: "",
  gameType: "CHOICE",
  instructions: "Con nghe câu hỏi rồi chọn hình phù hợp nhé.",
  minAgeMonths: 36,
  maxAgeMonths: 72,
  content: emptyContent("CHOICE"),
});
export default function GameEditorPage() {
  const { game } = useParams();
  return <Editor key={game || "new"} id={game} />;
}
function Editor({ id }: { id?: string }) {
  const navigate = useNavigate(),
    [draft, setDraft] = useState<Draft>(initial),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [picker, setPicker] = useState<Picker | null>(null);
  const source = useResource(
    useCallback(
      (signal) =>
        id
          ? api.get<LearningGame>(`/games/${id}`, signal)
          : Promise.resolve(null),
      [id],
    ),
  );
  const initialized = useRef(!id),
    [fingerprint, setFingerprint] = useState(() => JSON.stringify(draft)),
    requestId = useRef(crypto.randomUUID()),
    alive = useRef(true),
    errorArea = useRef<HTMLDivElement>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (source.data && !initialized.current) {
      const g = source.data;
      const next = {
        title: g.title,
        gameType: g.gameType,
        instructions: g.instructions || "",
        minAgeMonths: g.minAgeMonths,
        maxAgeMonths: g.maxAgeMonths,
        content: g.content,
      };
      setFingerprint(JSON.stringify(next));
      setDraft(next);
      initialized.current = true;
    }
  }, [source.data]);
  useEffect(() => {
    const controls = errorArea.current?.closest("form")?.elements;
    const fieldHasFocusTarget =
      error instanceof ApiError &&
      error.fieldErrors.some((field) => controls?.namedItem(field.field));
    // ErrorNotice focuses linked fields; scrolling to the summary would hide that field again.
    if (error && !fieldHasFocusTarget)
      errorArea.current?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
  }, [error]);
  const discard = useUnsavedChanges(
    JSON.stringify(draft) !== fingerprint || !!reason.trim(),
  );
  const published = source.data?.status === "PUBLISHED",
    archived = source.data?.status === "ARCHIVED";
  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function question(index: number, change: (q: GameQuestion) => GameQuestion) {
    setDraft((d) => ({
      ...d,
      content: {
        ...d.content,
        questions: d.content.questions.map((q, i) =>
          i === index ? change(q) : q,
        ),
      },
    }));
  }
  function pair(index: number, change: (p: GamePair) => GamePair) {
    setDraft((d) => ({
      ...d,
      content: {
        ...d.content,
        pairs: d.content.pairs.map((p, i) => (i === index ? change(p) : p)),
      },
    }));
  }
  function selectAsset(kind: "image" | "audio", pick: (id: string) => void) {
    setPicker({ kind, pick });
  }
  function changeType(type: GameType) {
    if (type === draft.gameType) return;
    if (
      !window.confirm(
        "Đổi kiểu trò chơi sẽ thay phần câu hỏi/thẻ đang soạn. Tiếp tục?",
      )
    )
      return;
    setDraft((d) => ({ ...d, gameType: type, content: emptyContent(type) }));
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        ...draft,
        version: source.data?.version,
        reason: reason.trim() || null,
        clientRequestId: id ? undefined : requestId.current,
      };
      const result = id
        ? await api.put<LearningGame>(`/games/${id}`, body)
        : await api.post<LearningGame>("/games", body);
      if (alive.current) {
        setFingerprint(JSON.stringify(draft));
        navigate(`/teacher/games/${result.id}`);
      }
    } catch (failure) {
      if (alive.current) setError(failure);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  function sample() {
    if (
      draft.content.questions.some((q) => q.prompt.trim()) ||
      draft.content.pairs.some((p) => p.left.label.trim())
    ) {
      if (
        !window.confirm(
          "Dùng nội dung gợi ý sẽ thay câu hỏi/thẻ đang soạn. Tiếp tục?",
        )
      )
        return;
    }
    setDraft((d) => ({
      ...d,
      title:
        d.title ||
        {
          CHOICE: "Cùng bé chọn hình",
          MATCH: "Tìm người bạn phù hợp",
          MEMORY: "Vườn trái cây ghi nhớ",
        }[d.gameType],
      content: gameSample(d.gameType),
    }));
  }
  if (id && source.loading && !source.data) return <Loading />;
  if (id && (source.error || !source.data))
    return <ErrorNotice error={source.error} retry={source.reload} />;
  return (
    <div className={styles.editor}>
      <Link
        className="back-link"
        to={id ? `/teacher/games/${id}` : "/teacher/games"}
        onClick={(e) => {
          if (!discard()) e.preventDefault();
        }}
      >
        ← Về kho trò chơi
      </Link>
      <PageHeader
        eyebrow="GÓC SÁNG TẠO CỦA CÔ"
        title={id ? "Chỉnh sửa trò chơi" : "Tạo trò chơi"}
        description="Soạn nội dung ngắn, dùng ảnh và âm thanh để bé dễ khám phá."
      />
      {published && (
        <p className="info-notice">
          Bản cập nhật áp dụng cho lần giao mới. Các lần giao trước giữ nội dung
          và kết quả đã có.
        </p>
      )}
      {archived ? (
        <p className="info-notice">
          Trò chơi đang lưu trữ. Khôi phục trong trang chi tiết để soạn tiếp.
        </p>
      ) : (
        <form onSubmit={save}>
          <section className={`panel ${styles.section}`}>
            <h2>Thông tin trò chơi</h2>
            <Field label="Tên trò chơi">
              <input
                name="title"
                value={draft.title}
                onChange={(e) => change("title", e.target.value)}
                maxLength={200}
                required
                placeholder="Ví dụ: Cùng bé tìm màu sắc"
              />
            </Field>
            <Field label="Kiểu trò chơi">
              <select
                name="gameType"
                value={draft.gameType}
                onChange={(e) => changeType(e.target.value as GameType)}
              >
                {Object.entries(gameTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Hướng dẫn cho bé">
              <textarea
                name="instructions"
                value={draft.instructions}
                onChange={(e) => change("instructions", e.target.value)}
                maxLength={2000}
                rows={3}
              />
            </Field>
            <AssetField
              kind="audio"
              label="Âm thanh hướng dẫn"
              value={draft.content.instructionAudioFileId}
              select={selectAsset}
              change={(value) =>
                setDraft((d) => ({
                  ...d,
                  content: { ...d.content, instructionAudioFileId: value },
                }))
              }
            />
            <div className={styles.formGrid}>
              <Field label="Tuổi gợi ý từ (tháng)">
                <input
                  name="minAgeMonths"
                  type="number"
                  min={0}
                  max={216}
                  value={draft.minAgeMonths}
                  onChange={(e) =>
                    change("minAgeMonths", Number(e.target.value))
                  }
                  required
                />
              </Field>
              <Field label="Đến (tháng)">
                <input
                  name="maxAgeMonths"
                  type="number"
                  min={draft.minAgeMonths}
                  max={216}
                  value={draft.maxAgeMonths}
                  onChange={(e) =>
                    change("maxAgeMonths", Number(e.target.value))
                  }
                  required
                />
              </Field>
            </div>
          </section>
          <section className={`panel ${styles.section}`}>
            <div className={styles.toolbar}>
              <h2>
                {draft.gameType === "CHOICE"
                  ? "Câu hỏi và đáp án"
                  : "Những cặp thẻ của bé"}
              </h2>
              <button
                type="button"
                className="button button-ghost"
                onClick={sample}
              >
                Dùng nội dung gợi ý
              </button>
            </div>
            <p className="muted">
              {draft.gameType === "CHOICE"
                ? "Mỗi câu có 2–4 đáp án và một đáp án đúng. Có thể lưu nháp rồi bổ sung sau."
                : draft.gameType === "MEMORY"
                  ? "Mỗi hình tạo thành hai thẻ giống nhau. Bé lật thẻ để tìm từng cặp."
                  : "Tạo hai mặt tương ứng. Bé chạm thẻ bên trái rồi tìm thẻ phù hợp bên phải."}
            </p>
            {draft.gameType === "CHOICE" ? (
              <>
                {draft.content.questions.map((q, index) => (
                  <article className={styles.question} key={q.id}>
                    <div className={styles.questionHead}>
                      <h3>Câu {index + 1}</h3>
                      <button
                        type="button"
                        className="button button-ghost button-small"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            content: {
                              ...d.content,
                              questions: d.content.questions.filter(
                                (x) => x.id !== q.id,
                              ),
                            },
                          }))
                        }
                        aria-label={`Xóa câu ${index + 1}`}
                      >
                        Xóa câu
                      </button>
                    </div>
                    <Field label={`Nội dung câu ${index + 1}`}>
                      <textarea
                        name={`content.questions[${index}].prompt`}
                        value={q.prompt}
                        onChange={(e) =>
                          question(index, (current) => ({
                            ...current,
                            prompt: e.target.value,
                          }))
                        }
                        maxLength={500}
                        required={published}
                        rows={2}
                      />
                    </Field>
                    <div className={styles.formGrid}>
                      <AssetField
                        kind="image"
                        label={`Ảnh câu ${index + 1}`}
                        value={q.imageFileId}
                        select={selectAsset}
                        change={(value) =>
                          question(index, (current) => ({
                            ...current,
                            imageFileId: value,
                          }))
                        }
                      />
                      <AssetField
                        kind="audio"
                        label={`Âm thanh câu ${index + 1}`}
                        value={q.audioFileId}
                        select={selectAsset}
                        change={(value) =>
                          question(index, (current) => ({
                            ...current,
                            audioFileId: value,
                          }))
                        }
                      />
                    </div>
                    <Field label={`Gợi ý câu ${index + 1}`} optional>
                      <input
                        name={`content.questions[${index}].hint`}
                        value={q.hint || ""}
                        maxLength={300}
                        onChange={(e) =>
                          question(index, (current) => ({
                            ...current,
                            hint: e.target.value,
                          }))
                        }
                      />
                    </Field>
                    <div className={styles.options}>
                      {q.options.map((option, oi) => (
                        <div className={styles.option} key={option.id}>
                          <FaceFields
                            label={`Câu ${index + 1} · Đáp án ${oi + 1}`}
                            name={`content.questions[${index}].options[${oi}]`}
                            face={option}
                            required={published}
                            select={selectAsset}
                            onChange={(value) =>
                              question(index, (current) => ({
                                ...current,
                                options: current.options.map((o) =>
                                  o.id === option.id ? { ...o, ...value } : o,
                                ),
                              }))
                            }
                          />
                          <label className={styles.correct}>
                            <input
                              type="radio"
                              name={`content.questions[${index}].correctOptionId`}
                              value={option.id}
                              checked={q.correctOptionId === option.id}
                              onChange={() =>
                                question(index, (current) => ({
                                  ...current,
                                  correctOptionId: option.id,
                                }))
                              }
                            />
                            Đáp án đúng {oi + 1}
                          </label>
                          {q.options.length > 2 && (
                            <button
                              type="button"
                              className="button button-ghost button-small"
                              onClick={() =>
                                question(index, (current) => {
                                  const options = current.options.filter(
                                    (o) => o.id !== option.id,
                                  );
                                  return {
                                    ...current,
                                    options,
                                    correctOptionId:
                                      current.correctOptionId === option.id
                                        ? options[0].id
                                        : current.correctOptionId,
                                  };
                                })
                              }
                            >
                              Xóa đáp án {oi + 1}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="button button-ghost"
                      disabled={q.options.length >= 4}
                      onClick={() =>
                        question(index, (current) => ({
                          ...current,
                          options: [
                            ...current.options,
                            { id: crypto.randomUUID(), ...emptyFace() },
                          ],
                        }))
                      }
                    >
                      Thêm đáp án cho câu {index + 1}
                    </button>
                  </article>
                ))}
                <button
                  type="button"
                  className="button button-ghost"
                  disabled={draft.content.questions.length >= 12}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      content: {
                        ...d.content,
                        questions: [...d.content.questions, emptyQuestion()],
                      },
                    }))
                  }
                >
                  Thêm câu hỏi
                </button>
              </>
            ) : (
              <>
                {draft.content.pairs.map((p, index) => (
                  <article className={styles.question} key={p.id}>
                    <div className={styles.questionHead}>
                      <h3>Cặp {index + 1}</h3>
                      <button
                        type="button"
                        className="button button-ghost button-small"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            content: {
                              ...d.content,
                              pairs: d.content.pairs.filter(
                                (x) => x.id !== p.id,
                              ),
                            },
                          }))
                        }
                        aria-label={`Xóa cặp ${index + 1}`}
                      >
                        Xóa cặp
                      </button>
                    </div>
                    <div className={styles.formGrid}>
                      <FaceFields
                        label={`Cặp ${index + 1} · ${draft.gameType === "MEMORY" ? "Hình trên thẻ" : "Thẻ bên trái"}`}
                        name={`content.pairs[${index}].left`}
                        face={p.left}
                        required={published}
                        select={selectAsset}
                        onChange={(left) =>
                          pair(index, (current) => ({
                            ...current,
                            left,
                            right:
                              draft.gameType === "MEMORY"
                                ? { ...left }
                                : current.right,
                          }))
                        }
                      />
                      {draft.gameType === "MATCH" && (
                        <FaceFields
                          label={`Cặp ${index + 1} · Thẻ bên phải`}
                          name={`content.pairs[${index}].right`}
                          face={p.right}
                          required={published}
                          select={selectAsset}
                          onChange={(right) =>
                            pair(index, (current) => ({ ...current, right }))
                          }
                        />
                      )}
                    </div>
                  </article>
                ))}
                <button
                  type="button"
                  className="button button-ghost"
                  disabled={draft.content.pairs.length >= 8}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      content: {
                        ...d.content,
                        pairs: [
                          ...d.content.pairs,
                          {
                            id: crypto.randomUUID(),
                            left: emptyFace(),
                            right: emptyFace(),
                          },
                        ],
                      },
                    }))
                  }
                >
                  Thêm cặp thẻ
                </button>
              </>
            )}
          </section>
          {published && (
            <section className={`panel ${styles.section}`}>
              <Field label="Lý do cập nhật">
                <textarea
                  name="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={1000}
                  required
                  rows={2}
                />
              </Field>
            </section>
          )}
          <div ref={errorArea}>
            <ErrorNotice error={error} />
          </div>
          <div className={styles.actions}>
            <button
              type="submit"
              className="button button-primary"
              disabled={busy}
            >
              {busy ? "Đang lưu…" : published ? "Lưu cập nhật" : "Lưu bản nháp"}
            </button>
            <Link
              className="button button-ghost"
              to={id ? `/teacher/games/${id}` : "/teacher/games"}
              onClick={(e) => {
                if (!discard()) e.preventDefault();
              }}
            >
              Quay lại
            </Link>
          </div>
        </form>
      )}
      {picker && (
        <GameAssetPicker
          kind={picker.kind}
          onClose={() => setPicker(null)}
          onPick={(value) => {
            picker.pick(value);
            setPicker(null);
          }}
        />
      )}
    </div>
  );
}
function AssetField({
  kind,
  label,
  value,
  select,
  change,
}: {
  kind: "image" | "audio";
  label: string;
  value: string | null;
  select: (kind: "image" | "audio", pick: (id: string) => void) => void;
  change: (value: string | null) => void;
}) {
  return (
    <div className={styles.asset}>
      {value && kind === "image" && (
        <img src={apiUrl(`/files/${value}/content`)} alt={label} />
      )}
      <button
        type="button"
        className="button button-ghost button-small"
        onClick={() => select(kind, change)}
      >
        {value ? "Thay" : "Chọn"} {label.toLocaleLowerCase("vi-VN")}
      </button>
      {value && (
        <>
          <small>Đã chọn</small>
          <button
            type="button"
            className="button button-ghost button-small"
            aria-label={`Bỏ ${label}`}
            onClick={() => change(null)}
          >
            Bỏ chọn
          </button>
        </>
      )}
    </div>
  );
}
function FaceFields({
  label,
  name,
  face,
  onChange,
  select,
  required,
}: {
  label: string;
  name: string;
  face: GameFace;
  onChange: (face: GameFace) => void;
  select: (kind: "image" | "audio", pick: (id: string) => void) => void;
  required: boolean;
}) {
  return (
    <div>
      <Field label={label}>
        <input
          name={`${name}.label`}
          value={face.label}
          onChange={(e) => onChange({ ...face, label: e.target.value })}
          maxLength={120}
          required={required}
          placeholder="Tên ngắn, có thể thêm emoji"
        />
      </Field>
      <AssetField
        kind="image"
        label={`Ảnh ${label}`}
        value={face.imageFileId}
        select={select}
        change={(value) => onChange({ ...face, imageFileId: value })}
      />
      <AssetField
        kind="audio"
        label={`Âm thanh ${label}`}
        value={face.audioFileId}
        select={select}
        change={(value) => onChange({ ...face, audioFileId: value })}
      />
    </div>
  );
}
