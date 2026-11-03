import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Icon } from "./ui";
import { api } from "../lib/api";
import { useResource } from "../lib/hooks";
import styles from "../pages/Communications.module.css";

export default function NotificationBell({ root }: { root: string }) {
  const [revision, setRevision] = useState(0);
  const { pathname } = useLocation();
  const resource = useResource(
    useCallback(
      (signal) => {
        void revision;
        void pathname;
        return api.get<{ unreadCount: number }>(
          "/notifications/unread-count",
          signal,
        );
      },
      [revision, pathname],
    ),
  );
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) setRevision((value) => value + 1);
    };
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("tinyclass:notifications-changed", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("tinyclass:notifications-changed", refresh);
    };
  }, []);
  const count = resource.error ? 0 : resource.data?.unreadCount || 0;
  return (
    <Link
      to={`${root}/updates`}
      className={`icon-button ${styles.badgeLink}`}
      aria-label={`Cập nhật${count ? `, ${count} chưa đọc` : ""}`}
      title="Cập nhật của bạn"
    >
      <Icon name="bell" />
      {count > 0 && (
        <span className={styles.badgeCount} aria-hidden="true">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
