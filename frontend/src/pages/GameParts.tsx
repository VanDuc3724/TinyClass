import { useRef, useState } from "react";
import { Icon } from "../components/ui";
import type { GameFace, GameType } from "../lib/games";
import { gameTypeLabels } from "../lib/games";
import styles from "./Games.module.css";

export function Stars({ value }: { value: number }) {
  return (
    <span className={styles.stars} aria-label={`${value} sao`}>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          aria-hidden="true"
          className={n > value ? styles.starEmpty : undefined}
        >
          ★
        </span>
      ))}
    </span>
  );
}
export function GameTypeBadge({ type }: { type: GameType }) {
  return <span className={styles.tag}>{gameTypeLabels[type]}</span>;
}
export function GameStateBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    DRAFT: "Đang soạn",
    PUBLISHED: "Đã xuất bản",
    ARCHIVED: "Đã lưu trữ",
    ACTIVE: "Đang giao",
    REVOKED: "Đã thu hồi",
    IN_PROGRESS: "Đang chơi",
    COMPLETED: "Đã hoàn thành",
    ABANDONED: "Đã dừng",
  };
  return (
    <span
      className={`${styles.tag} ${["ARCHIVED", "REVOKED", "ABANDONED"].includes(status) ? styles.mutedTag : ""}`}
    >
      {labels[status] || status}
    </span>
  );
}
export function FaceContent({
  face,
  media,
}: {
  face: GameFace;
  media: (id: string) => string;
}) {
  return (
    <>
      {face.imageFileId && (
        <img
          src={media(face.imageFileId)}
          alt={face.label || "Hình minh họa"}
        />
      )}
      <span>{face.label}</span>
    </>
  );
}
export function GameAudio({
  id,
  media,
  label = "Nghe âm thanh",
}: {
  id: string | null | undefined;
  media: (id: string) => string;
  label?: string;
}) {
  const player = useRef<HTMLAudioElement>(null),
    [error, setError] = useState(false);
  if (!id) return null;
  return (
    <span className={styles.audio}>
      <audio
        ref={player}
        src={media(id)}
        preload="none"
        onError={() => setError(true)}
      />
      <button
        type="button"
        className="button button-ghost button-small"
        onClick={() => {
          setError(false);
          const el = player.current;
          if (el) {
            el.currentTime = 0;
            void el.play().catch(() => setError(true));
          }
        }}
      >
        <Icon name="message" />
        {label}
      </button>
      {error && <small role="status">Chưa nghe được. Thử lại nhé.</small>}
    </span>
  );
}
