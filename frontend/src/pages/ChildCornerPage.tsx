import { useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import VerificationPrompt from "../auth/VerificationPrompt";
import { Avatar, ErrorNotice, Icon, Loading } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { childModeLink } from "../lib/childMode";
import { useResource } from "../lib/hooks";
import styles from "./ChildCornerPage.module.css";

export default function ChildCornerPage() {
  const { child } = useParams();
  const { account } = useAuth();
  const verified = Boolean(account?.emailVerifiedAt);
  const profile = `/family/children/${child}`;
  const resource = useResource(
    useCallback(
      (signal) =>
        verified
          ? api.get<{ fullName: string; preferredName: string | null }>(
              profile,
              signal,
            )
          : Promise.resolve(null),
      [profile, verified],
    ),
  );

  if (!verified) {
    return (
      <section className="panel family-verification">
        <VerificationPrompt />
      </section>
    );
  }
  if (resource.loading && !resource.data)
    return <Loading text="Đang mở góc của bé…" />;
  if (!resource.data || resource.error) {
    const unavailable =
      resource.error instanceof ApiError &&
      [403, 404].includes(resource.error.status);
    return (
      <section className={styles.welcome}>
        <h1>{unavailable ? "Góc này chưa mở được" : "Chưa mở được góc của bé"}</h1>
        {!unavailable && <ErrorNotice error={resource.error} retry={resource.reload} />}
      </section>
    );
  }

  return (
    <>
      <header className={styles.welcome}>
        <Avatar name={resource.data.fullName} large />
        <h1>
          Chào {resource.data.preferredName?.trim() || resource.data.fullName}!
        </h1>
      </header>
      <nav className={styles.choices} aria-label="Học và chơi">
        <Link className={styles.learn} to={childModeLink(`${profile}/learning`, true)}>
          <Icon name="book" width={36} height={36} />
          Học bài
        </Link>
        <Link className={styles.play} to={childModeLink(`${profile}/games`, true)}>
          <Icon name="game" width={36} height={36} />
          Chơi
        </Link>
      </nav>
    </>
  );
}
