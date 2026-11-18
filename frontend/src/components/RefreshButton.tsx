import { Icon } from "./ui";
import styles from "./RefreshButton.module.css";

const clock = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function RefreshButton({
  label,
  loading,
  onClick,
  updatedAt,
}: {
  label: string;
  loading?: boolean;
  onClick: () => void;
  updatedAt?: string | null;
}) {
  return (
    <div className={styles.refresh}>
      {updatedAt && (
        <time dateTime={updatedAt}>
          Cập nhật lúc {clock.format(new Date(updatedAt))}
        </time>
      )}
      <button
        type="button"
        className="icon-button"
        aria-label={label}
        title={label}
        disabled={loading}
        onClick={onClick}
      >
        <Icon name="refresh" />
      </button>
    </div>
  );
}
