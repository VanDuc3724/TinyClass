import { useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import {
  Badge,
  EmptyState,
  ErrorNotice,
  Icon,
  Loading,
  PageHeader,
} from "../components/ui";
import { api } from "../lib/api";
import { useResource } from "../lib/hooks";
import { dateLabel, dateTimeLabel } from "../lib/format";
import type { Classroom } from "../lib/types";
import styles from "./DashboardPage.module.css";

interface Dashboard {
  classOptions: Pick<Classroom, "id" | "name" | "status">[];
  classId: string | null;
  businessDate: string;
  students: number;
  activeClasses: number;
  publishedLessons: number;
  publishedAssignments: number;
  recentClasses: Pick<Classroom, "id" | "name" | "status" | "activeStudents">[];
  activity: {
    id: string;
    title: string;
    type: "LESSON" | "ASSIGNMENT";
    publishedAt: string;
    className: string | null;
  }[];
}
export default function DashboardPage() {
  const { account } = useAuth();
  const [params, setParams] = useSearchParams(),
    classId = params.get("classId") || "";
  const resource = useResource(
    useCallback(
      (signal) =>
        api.get<Dashboard>(
          `/dashboard${classId ? `?classId=${encodeURIComponent(classId)}` : ""}`,
          signal,
        ),
      [classId],
    ),
  );
  const data = resource.data;
  const selectedClass = data?.classOptions.find((c) => c.id === classId);
  return (
    <>
      <PageHeader
        eyebrow="GÓC GIÁO VIÊN"
        title={`Xin chào, ${account!.displayName}!`}
        description="Cùng chuẩn bị một ngày nhiều khám phá cho lớp nhỏ."
        action={
          <Link className="button button-primary" to="/teacher/classes/new">
            <Icon name="plus" />
            Tạo lớp học
          </Link>
        }
      />
      <div className={styles.scopeRow}>
        <div>
          <h2>Tổng quan lớp học</h2>
          <p className="muted">
            {data
              ? `${dateLabel(data.businessDate)} · ${selectedClass?.name || "Tất cả lớp học"}`
              : "Số liệu lớp học của bạn"}
          </p>
        </div>
        <label className={styles.scopeSelect}>
          <span>Phạm vi thống kê</span>
          <select
            aria-label="Phạm vi thống kê"
            value={classId}
            disabled={!data && !resource.error}
            onChange={(e) =>
              setParams(e.target.value ? { classId: e.target.value } : {})
            }
          >
            <option value="">Tất cả lớp học</option>
            {!data && classId && (
              <option value={classId}>Đang tải lớp đã chọn…</option>
            )}
            {data?.classOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.error && classId && (
        <Link className="text-link" to="/teacher">
          Về tất cả lớp học
          <Icon name="arrow" />
        </Link>
      )}
      {resource.loading && !data ? (
        <Loading />
      ) : (
        data && (
          <div aria-busy={resource.loading}>
            <div className={styles.stats}>
              {(
                [
                  {
                    label: "Học sinh đang học",
                    value: data.students,
                    icon: "students",
                    tone: "purple",
                    note: "Bé đang tham gia lớp đang dạy",
                  },
                  {
                    label: "Lớp đang dạy",
                    value: data.activeClasses,
                    icon: "classes",
                    tone: "green",
                    note: classId
                      ? "Trong lớp đã chọn"
                      : "Sẵn sàng đón các bé mỗi ngày",
                  },
                  {
                    label: "Lần giao bài",
                    value: data.publishedAssignments,
                    icon: "arrow",
                    tone: "pink",
                    note: "Đã xuất bản, chưa thu hồi",
                  },
                  {
                    label: classId ? "Bài đã chia sẻ" : "Bài đã xuất bản",
                    value: data.publishedLessons,
                    icon: "book",
                    tone: "blue",
                    note: classId
                      ? "Bài riêng biệt đã giao cho lớp"
                      : "Trong thư viện của bạn",
                  },
                ] as const
              ).map((stat) => (
                <section
                  className={styles.statCard}
                  key={stat.label}
                  aria-label={stat.label}
                >
                  <span className={`${styles.statIcon} ${styles[stat.tone]}`}>
                    <Icon name={stat.icon} width="28" height="28" />
                  </span>
                  <span className={styles.statLabel}>{stat.label}</span>
                  <strong>{stat.value.toLocaleString("vi-VN")}</strong>
                  <p>{stat.note}</p>
                </section>
              ))}
            </div>
            <p className={styles.scopeNote}>
              Mỗi bé chỉ được tính một lần trong số học sinh.{" "}
              {classId
                ? "Học liệu chỉ tính các lần giao trực tiếp cho lớp đã chọn."
                : "Học liệu gồm toàn bộ thư viện và các lần giao bài của bạn."}
            </p>
            <div className={styles.columns}>
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <h2>Hoạt động hôm nay</h2>
                    <p className="muted">
                      Những bài học và hoạt động bạn vừa chia sẻ
                    </p>
                  </div>
                  <span className={styles.todayTag}>Hôm nay</span>
                </div>
                {data.activity.length ? (
                  <div className={styles.activityList}>
                    {data.activity.map((item) => (
                      <Link
                        className={styles.activity}
                        key={`${item.type}-${item.id}`}
                        to={
                          item.type === "LESSON"
                            ? `/teacher/library/lessons/${item.id}`
                            : `/teacher/assignments/${item.id}`
                        }
                      >
                        <span
                          className={`${styles.thumbnail} ${item.type === "LESSON" ? styles.purple : styles.pink}`}
                        >
                          <Icon
                            name={item.type === "LESSON" ? "book" : "arrow"}
                            width="28"
                            height="28"
                          />
                        </span>
                        <div>
                          <span className={styles.activityType}>
                            {item.type === "LESSON"
                              ? "BÀI HỌC MỚI"
                              : "GIAO BÀI"}
                          </span>
                          <h3>{item.title}</h3>
                          <p>
                            {item.className ||
                              (item.type === "LESSON"
                                ? "Thư viện học liệu"
                                : "Hoạt động riêng cho bé")}
                          </p>
                          <time dateTime={item.publishedAt}>
                            {dateTimeLabel(item.publishedAt)}
                          </time>
                        </div>
                        <Icon name="arrow" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="Hôm nay đang chờ những khám phá mới"
                    icon="book"
                  >
                    {classId
                      ? "Chưa có bài được xuất bản cho lớp này hôm nay. Bạn có thể giao một hoạt động từ thư viện."
                      : "Bạn chưa xuất bản bài học hay giao bài hôm nay. Bắt đầu từ những thao tác nhanh bên cạnh."}
                  </EmptyState>
                )}
              </section>
              <aside className={`panel ${styles.quickActions}`}>
                <div className="section-heading">
                  <div>
                    <h2>Thao tác nhanh</h2>
                    <p className="muted">Sẵn sàng cho những giờ học vui</p>
                  </div>
                </div>
                {(
                  [
                    [
                      "Tạo bài học",
                      "Chuẩn bị một khám phá mới",
                      "book",
                      "purple",
                      "/teacher/library/lessons/new",
                    ],
                    [
                      "Thêm học liệu",
                      "Video, hình ảnh và tài liệu",
                      "upload",
                      "pink",
                      "/teacher/files?upload=1",
                    ],
                    [
                      "Giao bài cho lớp",
                      "Chia sẻ hoạt động cùng gia đình",
                      "arrow",
                      "blue",
                      `/teacher/assignments/new${classId && selectedClass?.status === "ACTIVE" ? `?classId=${classId}` : ""}`,
                    ],
                  ] as const
                ).map(([title, description, icon, tone, to]) => (
                  <Link className={styles.quickAction} key={title} to={to}>
                    <span className={`${styles.actionIcon} ${styles[tone]}`}>
                      <Icon name={icon} />
                    </span>
                    <div>
                      <strong>{title}</strong>
                      <p>{description}</p>
                    </div>
                    <Icon name="arrow" />
                  </Link>
                ))}
                <div className={styles.tip}>
                  <Icon name="leaf" />
                  <p>
                    Một hoạt động nhỏ mỗi ngày giúp bé tự tin khám phá thế giới.
                  </p>
                </div>
              </aside>
            </div>
            <section className={`panel ${styles.classesPanel}`}>
              <div className="section-heading">
                <div>
                  <h2>{selectedClass ? "Lớp đang xem" : "Lớp học của bạn"}</h2>
                  <p className="muted">
                    {selectedClass
                      ? "Theo dõi danh sách bé và quản lý lớp"
                      : "Những lớp được tạo gần đây"}
                  </p>
                </div>
                <Link className="text-link" to="/teacher/classes">
                  Xem tất cả
                  <Icon name="arrow" />
                </Link>
              </div>
              {data.recentClasses.length ? (
                <div className={styles.classList}>
                  {data.recentClasses.map((item) => (
                    <Link
                      className={styles.classRow}
                      key={item.id}
                      to={`/teacher/classes/${item.id}`}
                    >
                      <span className={`${styles.actionIcon} ${styles.purple}`}>
                        <Icon name="classes" />
                      </span>
                      <div>
                        <h3>{item.name}</h3>
                        <p>{item.activeStudents} bé đang tham gia</p>
                      </div>
                      <Badge context="class" status={item.status} />
                      <Icon name="arrow" />
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Một lớp học mới đang chờ bạn"
                  action={
                    <Link
                      className="button button-ghost"
                      to="/teacher/classes/new"
                    >
                      <Icon name="plus" />
                      Tạo lớp đầu tiên
                    </Link>
                  }
                >
                  Bắt đầu bằng tên lớp, rồi thêm những gương mặt nhỏ thân quen.
                </EmptyState>
              )}
            </section>
          </div>
        )
      )}
    </>
  );
}
