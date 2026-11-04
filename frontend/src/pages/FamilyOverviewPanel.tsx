import { Link } from "react-router-dom";
import { Badge, EmptyState } from "../components/ui";
import { dateLabel, dateTimeLabel } from "../lib/format";
import type { FamilyDashboard } from "../lib/dashboard";
import { BillingOverviewPanel, UpdatesOverviewPanel } from "./DashboardParts";
import styles from "./DashboardPage.module.css";

export default function FamilyOverviewPanel({
  data,
  onRefresh,
}: {
  data: FamilyDashboard;
  onRefresh: () => void;
}) {
  const root = `/family/children/${data.student.id}`,
    learning = data.learning;
  return (
    <div
      className={styles.familyOverview}
      aria-label="Tổng quan của bé"
      role="region"
    >
      <section className={`panel ${styles.summaryPanel}`}>
        <div className="section-heading">
          <div>
            <h2>Cùng con hôm nay</h2>
            <p className="muted">
              {dateLabel(data.businessDate)} · Giờ Việt Nam
            </p>
          </div>
          <Link className="text-link" to={`${root}/learning`}>
            Mở góc học
          </Link>
        </div>
        <dl className={styles.metrics}>
          <div>
            <dt>Hoạt động đang mở</dt>
            <dd>{learning.availableAssignments}</dd>
            <small>{learning.waitingAssignments} hoạt động chờ mở</small>
          </div>
          <div>
            <dt>Bài bắt buộc còn lại</dt>
            <dd>{learning.remainingItems}</dd>
            <small>Trong các hoạt động bé hiện còn được thực hiện</small>
          </div>
          <div>
            <dt>Buổi học hôm nay</dt>
            <dd>{data.schedule.todaySessionCount}</dd>
          </div>
          <div>
            <dt>Lượt cô đang xem</dt>
            <dd>{data.awaitingReview}</dd>
            <Link to={`${root}/submissions`}>Xem sản phẩm và phản hồi</Link>
          </div>
        </dl>
        {learning.requiredItems > 0 ? (
          <div className={styles.progressSummary}>
            <p>
              {learning.completedItems}/{learning.requiredItems} bài bắt buộc đã
              hoàn thành
            </p>
            <progress
              aria-label="Tiến độ các bài bé còn được thực hiện"
              max={learning.requiredItems}
              value={learning.completedItems}
            />
          </div>
        ) : (
          <p className={styles.previewNote}>
            Chưa có bài bắt buộc đang mở để tính tiến độ. Bé vẫn có thể xem các
            nội dung tham khảo được giao.
          </p>
        )}
        {learning.continueAssignment && (
          <Link
            className={`button button-primary ${styles.continueLink}`}
            to={`${root}/learning/assignments/${learning.continueAssignment.id}`}
          >
            Tiếp tục: {learning.continueAssignment.title}
          </Link>
        )}
        {learning.recentAssignments.length > 0 && (
          <div className={styles.previewList}>
            {learning.recentAssignments.map((item) => (
              <Link
                key={item.id}
                className={styles.previewRow}
                to={`${root}/learning/assignments/${item.id}`}
              >
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.className || "Hoạt động riêng cho bé"}</p>
                  <small>
                    {item.locked
                      ? `Chờ mở · ${dateTimeLabel(item.availableAt)}`
                      : item.completionPercent === null
                        ? "Nội dung tham khảo"
                        : `${item.completedItems}/${item.requiredItems} bài bắt buộc đã xong`}
                  </small>
                </div>
                <span>Xem hoạt động →</span>
              </Link>
            ))}
          </div>
        )}
      </section>
      <div className={styles.columns}>
        <section
          className={`panel ${styles.summaryPanel}`}
          aria-label="Lịch sắp tới"
        >
          <div className="section-heading">
            <div>
              <h2>Lịch sắp tới</h2>
              <p className="muted">
                Tối đa 3 buổi, từ bây giờ đến hết 7 ngày tiếp theo
              </p>
            </div>
            <Link to={`${root}/schedule`} className="text-link">
              Mở lịch học
            </Link>
          </div>
          {data.schedule.upcoming.length ? (
            <div className={styles.previewList}>
              {data.schedule.upcoming.map((session) => (
                <Link
                  className={styles.previewRow}
                  key={session.id}
                  to={`${root}/schedule`}
                >
                  <div>
                    <h3>{session.title || session.className}</h3>
                    <p>{session.className}</p>
                    <small>
                      {dateTimeLabel(session.startsAt)} ·{" "}
                      {session.location || "Địa điểm theo lớp"}
                    </small>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Chưa có buổi sắp học trong khoảng này"
              icon="calendar"
              compact
            >
              Lịch đã hủy không xuất hiện trong các buổi sắp tới.
            </EmptyState>
          )}
        </section>
        <section
          className={`panel ${styles.summaryPanel}`}
          aria-label="Phản hồi gần đây"
        >
          <div className="section-heading">
            <div>
              <h2>Phản hồi gần đây</h2>
              <p className="muted">Các lượt cô đã xem, gồm lịch sử của bé</p>
            </div>
            <Link to={`${root}/submissions`} className="text-link">
              Xem sản phẩm
            </Link>
          </div>
          {data.recentFeedback.length ? (
            <div className={styles.previewList}>
              {data.recentFeedback.map((row) => (
                <Link
                  key={row.id}
                  className={styles.previewRow}
                  to={`${root}/submissions/${row.id}`}
                >
                  <div>
                    <h3>{row.lessonTitle}</h3>
                    <p>{row.assignmentTitle}</p>
                    <small>{dateTimeLabel(row.reviewedAt)}</small>
                  </div>
                  <Badge status={row.status} context="submission" />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Chưa có phản hồi trong lịch sử"
              icon="message"
              compact
            >
              Phản hồi của cô sẽ xuất hiện sau khi xem sản phẩm đã gửi.
            </EmptyState>
          )}
        </section>
      </div>
      <BillingOverviewPanel data={data.billing} child={data.student.id} />
      <section className={`panel ${styles.summaryPanel}`}>
        <div className="section-heading">
          <div>
            <h2>Bảng tin của lớp</h2>
            <p className="muted">
              {data.announcements.unreadCount} thông báo chưa đọc bản hiện tại
            </p>
          </div>
          <Link className="text-link" to={`${root}/announcements`}>
            Mở bảng tin
          </Link>
        </div>
        {data.announcements.recent.length ? (
          <div className={styles.previewList}>
            {data.announcements.recent.map((row) => (
              <Link
                className={styles.previewRow}
                key={row.id}
                to={`${root}/announcements/${row.id}`}
              >
                <div>
                  <h3>{row.title}</h3>
                  <p>{row.className}</p>
                  <small>
                    {row.isRead ? "Đã đọc" : "Chưa đọc"} ·{" "}
                    {dateTimeLabel(row.updatedAt)}
                  </small>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Chưa có thông báo được chia sẻ"
            icon="megaphone"
            compact
          >
            Bảng tin hiển thị theo quyền lớp hiện tại của bé.
          </EmptyState>
        )}
      </section>
      <UpdatesOverviewPanel
        data={data.updates}
        root="/family"
        onRefresh={onRefresh}
      />
    </div>
  );
}
