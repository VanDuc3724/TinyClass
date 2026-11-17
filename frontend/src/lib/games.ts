import { api, apiUrl } from "./api";
import type { Page } from "./types";

export type GameType = "CHOICE" | "MATCH" | "MEMORY";
export const gameTypeLabels: Record<GameType, string> = {
  CHOICE: "Chọn hình đúng",
  MATCH: "Ghép cặp",
  MEMORY: "Lật thẻ ghi nhớ",
};
export interface GameFace {
  label: string;
  imageFileId: string | null;
  audioFileId: string | null;
}
export interface GameOption extends GameFace {
  id: string;
}
export interface GameQuestion {
  id: string;
  prompt: string;
  imageFileId: string | null;
  audioFileId: string | null;
  hint: string;
  options: GameOption[];
  correctOptionId: string | null;
}
export interface GamePair {
  id: string;
  left: GameFace;
  right: GameFace;
}
export interface GameContent {
  instructionAudioFileId: string | null;
  questions: GameQuestion[];
  pairs: GamePair[];
}
export interface LearningGame {
  id: string;
  title: string;
  gameType: GameType;
  instructions: string | null;
  minAgeMonths: number;
  maxAgeMonths: number;
  content: GameContent;
  contentRevision: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface GameAssignment {
  id: string;
  gameId: string;
  title: string;
  gameType: GameType;
  targetType: "CLASS" | "STUDENT";
  classId: string | null;
  studentId: string | null;
  className: string | null;
  studentName: string | null;
  availableAt: string;
  dueAt: string | null;
  status: "ACTIVE" | "REVOKED";
  version: number;
  linkedLessonId: string | null;
  linkedCourseId: string | null;
  recipientCount: number;
  revokedCount: number;
  snapshot: Pick<
    LearningGame,
    "gameType" | "title" | "instructions" | "content" | "contentRevision"
  >;
}
export interface FamilyGame {
  id: string;
  title: string;
  gameType: GameType;
  availableAt: string;
  dueAt: string | null;
  className: string | null;
  locked: boolean;
  bestStars: number;
  activeAttemptId: string | null;
}
export interface GameCollection {
  totalStars: number;
  completedAssignments: number;
  badges: { code: string; label: string }[];
}
export interface GameResult {
  id: string;
  gameAssignmentId: string;
  title: string;
  gameType: GameType;
  className: string | null;
  status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  totalSteps: number;
  correctCount: number;
  wrongCount: number;
  moveCount: number;
  hintCount: number;
  stars: number;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number;
}
export interface GameRecipient {
  studentId: string;
  studentName: string;
  revokedAt: string | null;
  revokeReason: string | null;
  attempts: number;
  completedAttempts: number;
  bestStars: number;
  lastCompletedAt: string | null;
}
export interface PlayCard extends GameFace {
  id: string;
  matched: boolean;
}
export interface MemoryCard {
  id: string;
  matched: boolean;
  revealed: boolean;
  face?: GameFace;
}
export interface GameAttempt {
  id: string;
  gameType: GameType;
  title: string;
  instructions: string | null;
  instructionAudioFileId: string | null;
  status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  version: number;
  isPreview: boolean;
  studentId: string | null;
  gameAssignmentId: string | null;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number;
  totalSteps: number;
  correctCount: number;
  wrongCount: number;
  moveCount: number;
  hintCount: number;
  stars: number;
  feedback: "CORRECT" | "TRY_AGAIN" | null;
  hintText: string | null;
  accuracyPercent: number | null;
  questionNumber?: number;
  question?: {
    id: string;
    prompt: string;
    imageFileId: string | null;
    audioFileId: string | null;
    options: GameOption[];
  };
  left?: PlayCard[];
  right?: PlayCard[];
  cards?: MemoryCard[];
  mismatch?: boolean;
}
export interface GameMove {
  clientRequestId: string;
  version: number;
  action: "ANSWER" | "MATCH" | "FLIP" | "HINT";
  optionId?: string;
  leftId?: string;
  rightId?: string;
  cardId?: string;
}
export interface GameFile {
  id: string;
  originalName: string;
  mimeType: string;
  status: string;
  sizeBytes: number;
}
export const emptyFace = (): GameFace => ({
  label: "",
  imageFileId: null,
  audioFileId: null,
});
export function emptyQuestion(): GameQuestion {
  const first = crypto.randomUUID();
  return {
    id: crypto.randomUUID(),
    prompt: "",
    imageFileId: null,
    audioFileId: null,
    hint: "",
    options: [
      { id: first, ...emptyFace() },
      { id: crypto.randomUUID(), ...emptyFace() },
    ],
    correctOptionId: first,
  };
}
export function emptyContent(type: GameType): GameContent {
  return {
    instructionAudioFileId: null,
    questions: type === "CHOICE" ? [emptyQuestion()] : [],
    pairs:
      type === "CHOICE"
        ? []
        : Array.from({ length: 2 }, () => ({
            id: crypto.randomUUID(),
            left: emptyFace(),
            right: emptyFace(),
          })),
  };
}
export function gameSample(type: GameType): GameContent {
  const face = (label: string): GameFace => ({
    label,
    imageFileId: null,
    audioFileId: null,
  });
  if (type === "CHOICE") {
    const examples = [
      [
        "Con chọn hình màu đỏ nhé!",
        ["🔴 Màu đỏ", "🟢 Màu xanh", "🟡 Màu vàng"],
        0,
      ],
      ["Đâu là con mèo?", ["🐰 Thỏ", "🐱 Mèo", "🐶 Chó"], 1],
      [
        "Con tìm nhóm có ba quả táo nhé!",
        ["🍎 Một quả táo", "🍎🍎 Hai quả táo", "🍎🍎🍎 Ba quả táo"],
        2,
      ],
    ] as const;
    return {
      instructionAudioFileId: null,
      pairs: [],
      questions: examples.map(([prompt, labels, correct]) => {
        const options = labels.map((label) => ({
          id: crypto.randomUUID(),
          ...face(label),
        }));
        return {
          id: crypto.randomUUID(),
          prompt,
          imageFileId: null,
          audioFileId: null,
          hint: "Quan sát từng hình và gọi tên cùng người lớn nhé.",
          options,
          correctOptionId: options[correct].id,
        };
      }),
    };
  }
  const examples =
    type === "MEMORY"
      ? [
          ["🍎 Táo", "🍎 Táo"],
          ["🍌 Chuối", "🍌 Chuối"],
          ["🍓 Dâu", "🍓 Dâu"],
          ["🍇 Nho", "🍇 Nho"],
        ]
      : [
          ["🐰 Thỏ", "🥕 Cà rốt"],
          ["🐵 Khỉ", "🍌 Chuối"],
          ["🐱 Mèo", "🐟 Cá"],
        ];
  return {
    instructionAudioFileId: null,
    questions: [],
    pairs: examples.map(([left, right]) => ({
      id: crypto.randomUUID(),
      left: face(left),
      right: face(right),
    })),
  };
}
export async function allGameChoices<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T[]> {
  const result: T[] = [];
  for (let page = 0; page < 100; page++) {
    const data: Page<T> = await api.list<T>(
      `${path}${path.includes("?") ? "&" : "?"}page=${page}&size=100`,
      signal,
    );
    result.push(...data.data);
    if (page + 1 >= data.meta.totalPages) break;
  }
  return result;
}
export function gameTimeInput(iso?: string) {
  return new Date((iso ? Date.parse(iso) : Date.now()) + 7 * 3600000)
    .toISOString()
    .slice(0, 16);
}
export function gameInstant(value: string) {
  return value ? new Date(`${value}:00+07:00`).toISOString() : null;
}

export function gameMedia(
  child: string | undefined,
  assignment: string | undefined,
  id: string,
) {
  return apiUrl(
    child && assignment
      ? `/family/children/${child}/game-assignments/${assignment}/files/${id}/content`
      : `/files/${id}/content`,
  );
}
