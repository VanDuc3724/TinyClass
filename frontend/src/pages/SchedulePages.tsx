import { useCallback, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ActionModal } from "../components/ActionModal";
import type { ActionRequest } from "../components/ActionModal";
import {
  Badge,
  EmptyState,
  ErrorNotice,
  Icon,
  Loading,
  Modal,
  PageHeader,
  Pagination,
} from "../components/ui";
import FilterBar from "../components/FilterBar";
import { api, query } from "../lib/api";
import { businessToday, dateLabel, dateTimeLabel } from "../lib/format";
import { useResource } from "../lib/hooks";
import {
  addDays,
  businessLocal,
  scheduleClasses,
  sessionHours,
  weekStart,
} from "../lib/schedule";
import type { ScheduleHistory, TeachingSession } from "../lib/schedule";
import { SessionCard, SessionForm, WeekBar } from "./ScheduleParts";
import styles from "./Schedule.module.css";

export function CalendarPage({ family = false }: { family?: boolean }) {
  const { child } = useParams();
  const [params, setParams] = useSearchParams();
  const start = weekStart(params.get("week") || businessToday()),
    classId = params.get("classId") || "",
    status = family ? "" : params.get("status") || "",
    page = Math.max(0, Number(params.get("page")) || 0);
  const filter = (values: Record<string, string>) =>
    setParams({ ...Object.fromEntries(params), page: "0", ...values });
  const data = useResource(
    useCallback(
      (signal) =>
        api.list<TeachingSession>(
          `${family ? `/family/children/${child}` : ""}/sessions${query({ from: start, to: addDays(start, 6), classId, status, page, size: 50 })}`,
          signal,
        ),
      [family, child, start, classId, status, page],
    ),
  );
  const options = useResource(
    useCallback(
      async (signal) => {
        const [classes, profile] = await Promise.all([
          scheduleClasses(
            family ? `/family/children/${child}/classes` : "/classes",
            signal,
          ),
          family
            ? api.get<{ fullName: string }>(`/family/children/${child}`, signal)
            : Promise.resolve(null),
        ]);
        return { classes, name: profile?.fullName };
      },
      [family, child],
    ),
  );
  const groups = new Map<string, TeachingSession[]>();
  data.data?.data.forEach((session) => {
    const day = businessLocal(session.startsAt).slice(0, 10);
    groups.set(day, [...(groups.get(day) || []), session]);
  });
  const classSelect = (
    <select
      aria-label="Lọc lớp trong lịch"
      value={classId}
      onChange={(event) => filter({ classId: event.target.value })}
    >
      <option value="">Tất cả lớp{family ? " của bé" : " học"}</option>
      {options.data?.classes.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
  return (
    <>
      {family && (
        <Link className="back-link" to={`/family/children/${child}`}>
          ← Về hồ sơ của bé
        </Link>
      )}
      <PageHeader
        eyebrow={family ? "CÙNG BÉ ĐẾN LỚP" : "NHỮNG GIỜ HỌC ĐANG CHỜ"}
        title={family ? "Lịch học của bé" : "Lịch dạy"}
        description={
          family
            ? `Theo dõi các buổi học${options.data?.name ? ` của ${options.data.name}` : ""}, địa điểm và thay đổi từ cô.`
            : "Sắp xếp những buổi học nhỏ, giữ thời gian cho từng lớp."
        }
        action={
          !family ? (
            <Link
              className="button button-primary"
              to={`/teacher/schedule/new${query({ classId, date: start })}`}
            >
              <Icon name="plus" />
              Thêm buổi học
            </Link>
          ) : (
            <button
              className="button button-ghost"
              onClick={() => {
                data.reload();
                options.reload();
              }}
            >
              Cập nhật lịch
            </button>
          )
        }
      />
      {family ? (
        (!!classId || (options.data?.classes.length || 0) > 1) && (
          <div className={styles.familyFilter}>{classSelect}</div>
        )
      ) : (
        <FilterBar
          className={styles.filters}
          active={!!(classId || status)}
          onReset={() => filter({ classId: "", status: "" })}
        >
          {classSelect}
          {!family && (
            <select
              aria-label="Trạng thái buổi học"
              value={status}
              onChange={(event) => filter({ status: event.target.value })}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="SCHEDULED">Theo lịch</option>
              <option value="CANCELLED">Đã hủy</option>
              <option value="COMPLETED">Đã hoàn thành</option>
            </select>
          )}
          {!family && classId && (
            <Link
              className="button button-ghost"
              to={`/teacher/classes/${classId}/schedule-rules`}
            >
              Lịch tuần của lớp
            </Link>
          )}
        </FilterBar>
      )}
      <WeekBar
        start={start}
        onChange={(day) => filter({ week: weekStart(day) })}
      />
      <ErrorNotice
        error={data.error || options.error}
        retry={() => {
          data.reload();
          options.reload();
        }}
      />
      {data.loading && !data.data ? (
        <Loading text="Đang mở lịch tuần…" />
      ) : (
        data.data && (
          <div aria-busy={data.loading}>
            {data.data.data.length ? (
              [...groups].map(([day, sessions]) => (
                <section className={styles.dayGroup} key={day}>
                  <div className={styles.dayHeading}>
                    <h2>
                      {new Date(`${day}T00:00:00Z`).toLocaleDateString(
                        "vi-VN",
                        { weekday: "long", timeZone: "UTC" },
                      )}{" "}
                      · {dateLabel(day)}
                    </h2>
                  </div>
                  <div className={styles.sessionGrid}>
                    {sessions.map((session) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        teacher={!family}
                      />
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <section className={`panel ${styles.emptyPanel}`}>
                <EmptyState
                  title="Tuần này chưa có buổi phù hợp"
                  icon="calendar"
                >
                  {family
                    ? "Cô sẽ cập nhật lịch cho lớp của bé. Có thể chuyển tuần hoặc chọn lớp khác để xem."
                    : "Chọn lớp để đặt lịch tuần và sinh buổi, hoặc thêm một buổi học riêng."}
                </EmptyState>
              </section>
            )}
            <Pagination
              meta={data.data.meta}
              onChange={(value) => filter({ page: String(value) })}
            />
          </div>
        )
      )}
    </>
  );
}

export function NewSessionPage() {
  const [params] = useSearchParams(),
    navigate = useNavigate();
  const classes = useResource(
    useCallback((signal) => scheduleClasses("/classes", signal), []),
  );
  return (
    <>
      <Link className="back-link" to="/teacher/schedule">
        ← Về lịch dạy
      </Link>
      <PageHeader
        eyebrow="THÊM MỘT GIỜ HỌC VUI"
        title="Tạo buổi học riêng"
        description="Buổi riêng giữ lịch độc lập với lịch lặp của lớp."
      />
      <ErrorNotice error={classes.error} retry={classes.reload} />
      {classes.loading ? (
        <Loading />
      ) : (
        classes.data && (
          <section className={`panel ${styles.detailPanel} ${styles.form}`}>
            <SessionForm
              classes={classes.data}
              initialClass={params.get("classId") || undefined}
              initialDate={params.get("date") || undefined}
              onClose={() => navigate("/teacher/schedule")}
              onSaved={(session) =>
                navigate(`/teacher/schedule/sessions/${session.id}`)
              }
            />
          </section>
        )
      )}
    </>
  );
}

export function SessionDetailPage() {
  const { id } = useParams();
  const [editing, setEditing] = useState(false),
    [notice, setNotice] = useState(""),
    [historyPage, setHistoryPage] = useState(0),
    [action, setAction] = useState<ActionRequest | null>(null);
  const data = useResource(
    useCallback(
      (signal) => api.get<TeachingSession>(`/sessions/${id}`, signal),
      [id],
    ),
  );
  const history = useResource(
    useCallback(
      (signal) =>
        api.list<ScheduleHistory>(
          `/sessions/${id}/history?page=${historyPage}&size=10`,
          signal,
        ),
      [id, historyPage],
    ),
  );
  const reload = () => {
    data.reload();
    history.reload();
  };
  if (!data.data)
    return (
      <>
        <Link className="back-link" to="/teacher/schedule">
          ← Về lịch dạy
        </Link>
        {data.loading ? (
          <Loading />
        ) : (
          <ErrorNotice error={data.error} retry={data.reload} />
        )}
      </>
    );
  const session = data.data;
  return (
    <>
      <Link
        className="back-link"
        to={`/teacher/schedule${query({ classId: session.classId, week: businessLocal(session.startsAt).slice(0, 10) })}`}
      >
        ← Về tuần của buổi học
      </Link>
      <PageHeader
        eyebrow={session.className}
        title={session.title}
        description={`${dateLabel(businessLocal(session.startsAt).slice(0, 10))} · ${sessionHours(session)} · Giờ Việt Nam`}
      />
      <ErrorNotice error={data.error} retry={data.reload} />
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}
      <div className={styles.actions}>
        <Link
          className="button button-primary"
          to={`/teacher/sessions/${session.id}/attendance`}
        >
          <Icon name="check" />
          Điểm danh
        </Link>
        {session.canEdit && (
          <button
            className="button button-primary"
            onClick={() => setEditing(true)}
          >
            <Icon name="edit" />
            Đổi buổi học
          </button>
        )}
        {session.canCancel && (
          <button
            className="button button-ghost"
            onClick={() =>
              setAction({
                title: "Hủy buổi học",
                description:
                  "Giữ buổi trong lịch với trạng thái đã hủy. Lý do này được chia sẻ với gia đình; sinh lại lịch tuần không tạo lại buổi này.",
                label: "Xác nhận hủy buổi",
                reasonRequired: true,
                run: (reason) =>
                  api.post(`/sessions/${session.id}/cancel`, {
                    version: session.version,
                    reason,
                  }),
              })
            }
          >
            Hủy buổi học
          </button>
        )}
        <Link
          className="button button-ghost"
          to={`/teacher/classes/${session.classId}/schedule-rules`}
        >
          Lịch tuần của lớp
        </Link>
      </div>
      <div className={styles.detailColumns}>
        <section className={`panel ${styles.detailPanel}`}>
          <h2>Thông tin buổi học</h2>
          <dl>
            <div>
              <dt>Trạng thái</dt>
              <dd>
                <Badge status={session.status} />
              </dd>
            </div>
            <div>
              <dt>Lớp học</dt>
              <dd>
                <Link
                  className="text-link"
                  to={`/teacher/classes/${session.classId}`}
                >
                  {session.className}
                </Link>
              </dd>
            </div>
            <div>
              <dt>Địa điểm</dt>
              <dd>{session.location || "Chưa đặt địa điểm"}</dd>
            </div>
            <div>
              <dt>Nguồn lịch</dt>
              <dd>
                {session.scheduleRuleId
                  ? session.isManualOverride
                    ? "Từ lịch tuần · Đã chỉnh riêng"
                    : "Từ lịch tuần của lớp"
                  : "Buổi riêng"}
              </dd>
            </div>
            {session.cancellationReason && (
              <div>
                <dt>Lý do hủy, chia sẻ với gia đình</dt>
                <dd>{session.cancellationReason}</dd>
              </div>
            )}
            <div>
              <dt>Kế hoạch riêng của cô</dt>
              <dd>{session.lessonPlan || "Chưa ghi kế hoạch cho buổi này."}</dd>
            </div>
          </dl>
          {!session.canEdit && session.status !== "CANCELLED" && (
            <p className={styles.hint}>
              Buổi đã bắt đầu, có danh sách điểm danh hoặc lớp đã kết thúc; giờ
              và kế hoạch hiện tại được giữ lại.
            </p>
          )}
        </section>
        <section className={`panel ${styles.detailPanel}`}>
          <h2>Lịch sử thay đổi</h2>
          <ErrorNotice error={history.error} retry={history.reload} />
          {history.loading && !history.data ? (
            <Loading />
          ) : (
            history.data && (
              <>
                <ol className={styles.history}>
                  {history.data.data.map((event) => (
                    <li key={event.id}>
                      <strong>
                        {(
                          {
                            SESSION_CREATED: "Tạo buổi học",
                            SESSION_UPDATED: "Điều chỉnh buổi học",
                            SESSION_CANCELLED: "Hủy buổi học",
                            SESSION_ROSTER_CREATED: "Chốt danh sách điểm danh",
                            SESSION_COMPLETED: "Hoàn thành buổi học",
                            SESSION_ATTENDANCE_REOPENED:
                              "Mở lại để hoàn thiện điểm danh",
                          } as Record<string, string>
                        )[event.action] || "Cập nhật buổi học"}
                      </strong>
                      <p className="muted">{dateTimeLabel(event.createdAt)}</p>
                      {event.reason && <p>{event.reason}</p>}
                      {event.action === "SESSION_UPDATED" &&
                        event.changedFields.before?.startsAt &&
                        event.changedFields.after?.startsAt && (
                          <p>
                            {dateTimeLabel(event.changedFields.before.startsAt)}{" "}
                            →{" "}
                            {dateTimeLabel(event.changedFields.after.startsAt)}
                          </p>
                        )}
                    </li>
                  ))}
                </ol>
                <Pagination
                  meta={history.data.meta}
                  onChange={setHistoryPage}
                />
              </>
            )
          )}
        </section>
      </div>
      {editing && (
        <SessionEditor
          session={session}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setNotice("Đã đổi buổi học. Lịch tuần gốc vẫn được giữ.");
            reload();
          }}
        />
      )}
      {action && (
        <ActionModal
          action={action}
          onClose={() => setAction(null)}
          onSuccess={() => {
            setAction(null);
            setNotice("Đã hủy buổi và giữ lại lý do trong lịch sử.");
            reload();
          }}
        />
      )}
    </>
  );
}

function SessionEditor({
  session,
  onClose,
  onSaved,
}: {
  session: TeachingSession;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  return (
    <Modal
      title="Điều chỉnh riêng buổi học"
      busy={busy}
      onClose={() => {
        if (
          !dirty ||
          window.confirm("Bạn có thay đổi chưa lưu. Rời biểu mẫu này?")
        )
          onClose();
      }}
    >
      <SessionForm
        classes={[
          {
            id: session.classId,
            name: session.className,
            status: session.classStatus || "ACTIVE",
            location: session.location,
          },
        ]}
        session={session}
        onClose={onClose}
        onSaved={onSaved}
        onBusyChange={setBusy}
        onDirtyChange={setDirty}
      />
    </Modal>
  );
}
