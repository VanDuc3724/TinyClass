import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useResource } from "../lib/hooks";
import type { FamilyGame, GameCollection, GameResult } from "../lib/games";
import { dateTimeLabel } from "../lib/format";
import {
  EmptyState,
  ErrorNotice,
  Icon,
  Loading,
  PageHeader,
  Pagination,
} from "../components/ui";
import { GameTypeBadge, Stars } from "./GameParts";
import styles from "./Games.module.css";

function FamilyGameCards({
  games,
  child,
}: {
  games: FamilyGame[];
  child: string;
}) {
  return (
    <div className={styles.grid}>
      {games.map((g) => (
        <article className={`panel ${styles.tile}`} key={g.id}>
          <div className={styles.typeIcon}>
            <Icon name="game" />
          </div>
          <GameTypeBadge type={g.gameType} />
          <h2>{g.title}</h2>
          {g.className && <p>{g.className}</p>}
          {g.locked ? (
            <p>Mở lúc {dateTimeLabel(g.availableAt)}</p>
          ) : (
            <>
              <Stars value={g.bestStars} />
              {g.dueAt && (
                <p className="muted">
                  Gợi ý chơi trước {dateTimeLabel(g.dueAt)}
                </p>
              )}
              <Link
                className="button button-primary"
                to={`/family/children/${child}/games/${g.id}/play`}
              >
                {g.activeAttemptId ? "Chơi tiếp" : "Cùng bé chơi"}
              </Link>
            </>
          )}
        </article>
      ))}
    </div>
  );
}
export function FamilyGamesPage() {
  const { child } = useParams();
  return <FamilyGames key={child} child={child!} />;
}
function FamilyGames({ child }: { child: string }) {
  const [page, setPage] = useState(0),
    [historyPage, setHistoryPage] = useState(0);
  const data = useResource(
    useCallback(
      async (signal) => {
        const [profile, games, collection] = await Promise.all([
          api.get<{ fullName: string }>(`/family/children/${child}`, signal),
          api.list<FamilyGame>(
            `/family/children/${child}/games?page=${page}&size=12`,
            signal,
          ),
          api.get<GameCollection>(
            `/family/children/${child}/games/collection`,
            signal,
          ),
        ]);
        return { profile, games, collection };
      },
      [child, page],
    ),
  );
  const history = useResource(
    useCallback(
      (signal) =>
        api.list<GameResult>(
          `/family/children/${child}/games/history?page=${historyPage}&size=10`,
          signal,
        ),
      [child, historyPage],
    ),
  );
  const refresh = () => {
    data.reload();
    history.reload();
  };
  return (
    <>
      <Link className="back-link" to={`/family/children/${child}`}>
        ← Về hồ sơ bé
      </Link>
      <PageHeader
        eyebrow="MỖI NGÀY MỘT KHÁM PHÁ"
        title="Góc chơi của bé"
        description={
          data.data
            ? `Cùng ${data.data.profile.fullName} quan sát, ghép hình và ghi nhớ qua những trò chơi cô chuẩn bị.`
            : "Những hoạt động nhỏ để gia đình cùng bé khám phá."
        }
        action={
          <button
            className="button button-ghost"
            onClick={refresh}
            disabled={data.loading}
          >
            Cập nhật góc chơi
          </button>
        }
      />
      <p className="info-notice">
        Gia đình cùng bé đọc lời hướng dẫn và chọn nhịp chơi phù hợp. Có thể
        dừng để nghỉ rồi quay lại chơi tiếp.
      </p>
      <ErrorNotice error={data.error} retry={refresh} />
      {data.loading && !data.data ? (
        <Loading />
      ) : (
        data.data && (
          <>
            <section
              className={`panel ${styles.collection}`}
              aria-label="Bộ sưu tập của bé"
            >
              <h2>Những ngôi sao nhỏ</h2>
              <p>
                <strong>{data.data.collection.totalStars} sao</strong> · Đã khám
                phá {data.data.collection.completedAssignments} trò chơi
              </p>
              <p className="muted">
                Mỗi lần giao giữ số sao tốt nhất của bé. Chơi lại để luyện tập
                và tìm thêm niềm vui.
              </p>
              <div className={styles.tags}>
                {data.data.collection.badges.map((b) => (
                  <span className={styles.badge} key={b.code}>
                    <Icon name="leaf" />
                    {b.label}
                  </span>
                ))}
              </div>
            </section>
            {data.data.games.data.length ? (
              <FamilyGameCards games={data.data.games.data} child={child} />
            ) : (
              <EmptyState title="Cô đang chuẩn bị trò chơi" icon="game">
                Trò chơi xuất hiện khi cô giao cho bé hoặc lớp của bé.
              </EmptyState>
            )}
            <Pagination meta={data.data.games.meta} onChange={setPage} />
            <section className={`panel ${styles.section}`}>
              <h2>Những lần đã cùng nhau khám phá</h2>
              <ErrorNotice error={history.error} retry={history.reload} />
              {history.loading && !history.data ? (
                <Loading />
              ) : history.data?.data.length ? (
                <>
                  <ul
                    className={styles.historyList}
                    aria-label="Lịch sử lượt chơi hoàn thành"
                  >
                    {history.data.data.map((r) => (
                      <li className={styles.historyItem} key={r.id}>
                        <div className={styles.historyTitle}>
                          <strong>{r.title}</strong>
                          <GameTypeBadge type={r.gameType} />
                        </div>
                        <div className={styles.historyCompleted}>
                          <span className={styles.historyLabel}>Hoàn thành</span>
                          <time dateTime={r.completedAt!}>
                            {dateTimeLabel(r.completedAt!)}
                          </time>
                        </div>
                        <div className={styles.historyScore}>
                          <span className={styles.historyLabel}>Sao</span>
                          <Stars value={r.stars} />
                        </div>
                      </li>
                    ))}
                  </ul>
                  <Pagination
                    meta={history.data.meta}
                    onChange={setHistoryPage}
                  />
                </>
              ) : (
                !history.error && (
                  <p className="muted">
                    Những ngôi sao đầu tiên sẽ xuất hiện sau khi bé hoàn thành
                    một lượt chơi.
                  </p>
                )
              )}
            </section>
          </>
        )
      )}
    </>
  );
}
export function LinkedGamesPanel({
  child,
  assignment,
  item,
}: {
  child: string;
  assignment?: string;
  item?: string;
}) {
  const data = useResource(
    useCallback(
      (signal) =>
        api.get<FamilyGame[]>(
          `/family/children/${child}/${item ? `assignment-items/${item}` : `assignments/${assignment}`}/games`,
          signal,
        ),
      [child, assignment, item],
    ),
  );
  if (data.error) return <ErrorNotice error={data.error} retry={data.reload} />;
  if (!data.data?.length) return null;
  return (
    <section className={`panel ${styles.linked}`}>
      <h2>Cùng bé chơi thêm</h2>
      <p className="muted">
        Những trò chơi cô gắn với nội dung này. Kết quả được lưu trong góc chơi
        của bé.
      </p>
      <FamilyGameCards games={data.data} child={child} />
    </section>
  );
}
