import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Icon } from "./ui";
import { api } from "../lib/api";
import { useResource } from "../lib/hooks";
import styles from "../pages/Communications.module.css";

// Navigation, focus and visibility often fire together; one count request covers them.
const MIN_REFRESH_MS = 15_000;

export default function NotificationBell({ root }: { root: string }) {
  const [revision, setRevision] = useState(0);
  const lastRequest = useRef(0);
  const { pathname } = useLocation();
  const resource = useResource(
    useCallback(
      (signal) => {
        void revision;
        lastRequest.current = Date.now();
        return api.get<{ unreadCount: number }>(
          "/notifications/unread-count",
          signal,
        );
      },
      [revision],
    ),
  );
  const refresh = useCallback((force: boolean) => {
    if (
      !force &&
      (document.hidden || Date.now() - lastRequest.current < MIN_REFRESH_MS)
    )
      return;
    setRevision((value) => value + 1);
  }, []);
  useEffect(() => {
    void pathname;
    refresh(false);
  }, [pathname, refresh]);
  useEffect(() => {
    const soft = () => refresh(false);
    const forced = () => refresh(true);
    const interval = window.setInterval(soft, 60_000);
    window.addEventListener("focus", soft);
    document.addEventListener("visibilitychange", soft);
    window.addEventListener("tinyclass:notifications-changed", forced);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", soft);
      document.removeEventListener("visibilitychange", soft);
      window.removeEventListener("tinyclass:notifications-changed", forced);
    };
  }, [refresh]);
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
