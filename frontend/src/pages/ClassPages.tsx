import { useCallback, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ActionModal } from "../components/ActionModal";
import type { ActionRequest } from "../components/ActionModal";
import {
  Avatar,
  Badge,
  EmptyState,
  ErrorNotice,
  Icon,
  Loading,
  Modal,
  Pagination,
} from "../components/ui";
import { onTabListKeyDown } from "../lib/accessibility";
import { dateLabel, instantDateLabel, timeLabel } from "../lib/format";
import { api, query } from "../lib/api";
import { useResource } from "../lib/hooks";
import type { Classroom, Enrollment, History, Student } from "../lib/types";
export { ClassFormPage, ClassListPage } from "./ClassListAndForm";

export function ClassDetailPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState("students");
  const [page, setPage] = useState(0);
  const [adding, setAdding] = useState(false);
  const [history, setHistory] = useState<Enrollment | null>(null);
  const [action, setAction] = useState<ActionRequest | null>(null);
  const [notice, setNotice] = useState("");
  const classroom = useResource(
    useCallback((signal) => api.get<Classroom>(`/classes/${id}`, signal), [id]),
  );
  const members = useResource(
    useCallback(
      (signal) =>
        api.list<Enrollment>(
          `/classes/${id}/enrollments?page=${page}&size=20`,
          signal,
        ),
      [id, page],
    ),
  );
  function refresh() {
    classroom.reload();
    members.reload();
  }
  function closeAdd() {
    setAdding(false);
    if (params.get("add")) setParams({}, { replace: true });
  }
  if (classroom.loading && !classroom.data) return <Loading />;
  if (!classroom.data || classroom.error)
    return <ErrorNotice error={classroom.error} retry={classroom.reload} />;
  const item = classroom.data;
  const editable = item.status === "DRAFT" || item.status === "ACTIVE";
  function classAction(
    kind: string,
    title: string,
    description: string,
    label: string,
  ) {
    setAction({
      title,
      description,
      label,
      run: (reason) =>
        api.post(`/classes/${item.id}/${kind}`, {
          version: item.version,
          reason,
        }),
    });
  }
  function changeMember(enrollment: Enrollment, status: string) {
    const returning = status === "ACTIVE";
    setAction({
      title: returning ? "Đón bé quay lại lớp" : "Cho bé rời lớp",
      label: returning ? "Xác nhận quay lại" : "Xác nhận rời lớp",
      reasonRequired: true,
      description: returning
        ? `${enrollment.studentName} sẽ tham gia lại lớp nếu còn chỗ. Những lần cấp quyền nội dung đã thu hồi không được tự động khôi phục.`
        : `${enrollment.studentName} sẽ không còn trong danh sách đang tham gia. Hồ sơ và lịch sử của bé được giữ lại.`,
      run: (reason) =>
        api.patch(`/enrollments/${enrollment.id}`, {
          version: enrollment.version,
          status,
          reason,
        }),
    });
  }
  return (
    <>
      <Link to="/teacher/classes" className="back-link">
        ← Tất cả lớp học
      </Link>
      <section className="class-detail-hero">
        <span className="detail-class-icon">
          <Icon name="book" width="38" height="38" />
        </span>
        <div className="detail-hero-text">
          <Badge context="class" status={item.status} />
          <h1>{item.name}</h1>
          <p>
            <Icon name="students" />
            {item.activeStudents}
            {item.capacity ? ` / ${item.capacity}` : ""} bé đang tham gia
            <span>·</span>
            <Icon name="pin" />
            {item.location || "Chưa đặt địa điểm"}
          </p>
        </div>
        <div className="detail-actions">
          {item.status !== "ARCHIVED" && (
            <Link
              to={`/teacher/classes/${id}/edit`}
              className="button button-ghost"
            >
              <Icon name="edit" />
              Chỉnh sửa
            </Link>
          )}
          {item.status === "DRAFT" && (
            <button
              className="button button-primary"
              onClick={() =>
                classAction(
                  "activate",
                  "Mở lớp học",
                  "Lớp chuyển sang hoạt động. Bạn vẫn có thể thêm bé và chỉnh sửa thông tin.",
                  "Mở lớp",
                )
              }
            >
              Mở lớp
              <Icon name="arrow" />
            </button>
          )}
          {item.status === "ARCHIVED" ? (
            <button
              className="button button-primary"
              onClick={() =>
                classAction(
                  "restore",
                  "Khôi phục lớp học",
                  "Lớp trở về trạng thái trước khi lưu trữ. Những dữ liệu đã có vẫn được giữ nguyên.",
                  "Khôi phục",
                )
              }
            >
              Khôi phục lớp
            </button>
          ) : (
            <details className="action-menu">
              <summary aria-label="Thao tác khác">•••</summary>
              <div>
                {item.status === "ACTIVE" && (
                  <button
                    onClick={() =>
                      classAction(
                        "complete",
                        "Kết thúc lớp học",
                        "Các bé đang tham gia được đánh dấu hoàn thành. Lớp sẽ không nhận thêm thành viên.",
                        "Kết thúc lớp",
                      )
                    }
                  >
                    Kết thúc lớp
                  </button>
                )}
                <button
                  onClick={() =>
                    classAction(
                      "archive",
                      "Lưu trữ lớp học",
                      "Lớp được cất vào mục lưu trữ. Dữ liệu và lịch sử không bị xóa; có thể khôi phục sau.",
                      "Lưu trữ lớp",
                    )
                  }
                >
                  Lưu trữ lớp
                </button>
              </div>
            </details>
          )}
        </div>
      </section>
      {notice && (
        <p className="info-notice" role="status">
          {notice}
        </p>
      )}
      <div
        className="tabs"
        role="tablist"
        aria-label="Nội dung lớp"
        onKeyDown={onTabListKeyDown}
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "students"}
          tabIndex={tab === "students" ? 0 : -1}
          aria-controls="class-students"
          id="tab-students"
          onClick={() => setTab("students")}
        >
          Học sinh<span>{item.activeStudents}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "info"}
          tabIndex={tab === "info" ? 0 : -1}
          aria-controls="class-info"
          id="tab-info"
          onClick={() => setTab("info")}
        >
          Thông tin lớp
        </button>
      </div>
      {tab === "students" ? (
        <section
          className="panel"
          role="tabpanel"
          id="class-students"
          aria-labelledby="tab-students"
        >
          <div className="section-heading">
            <div>
              <h2>Những gương mặt nhỏ</h2>
              <p className="muted">
                Danh sách tham gia và lịch sử rời lớp của các bé.
              </p>
            </div>
            {editable && (
              <button
                className="button button-primary"
                onClick={() => setAdding(true)}
              >
                <Icon name="plus" />
                Thêm bé vào lớp
              </button>
            )}
          </div>
          <ErrorNotice error={members.error} retry={members.reload} />
          {members.loading ? (
            <Loading />
          ) : (
            members.data && (
              <>
                {members.data.data.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Học sinh</th>
                          <th>Ngày sinh</th>
                          <th>Trạng thái</th>
                          <th>Tham gia từ</th>
                          <th>
                            <span className="sr-only">Thao tác</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.data.data.map((member) => (
                          <tr key={member.id}>
                            <td>
                              <Link
                                className="person-link"
                                to={`/teacher/students/${member.studentId}`}
                              >
                                <Avatar name={member.studentName} />
                                <span>
                                  <strong>{member.studentName}</strong>
                                  {member.preferredName && (
                                    <small>{member.preferredName}</small>
                                  )}
                                </span>
                              </Link>
                            </td>
                            <td>{dateLabel(member.birthDate)}</td>
                            <td>
                              <Badge status={member.status} />
                            </td>
                            <td>{instantDateLabel(member.joinedAt)}</td>
                            <td>
                              <div className="row-actions">
                                <button
                                  type="button"
                                  className="icon-button"
                                  aria-label={`Lịch sử của ${member.studentName}`}
                                  onClick={() => setHistory(member)}
                                >
                                  <Icon name="clock" />
                                </button>
                                {editable && (
                                  <button
                                    type="button"
                                    className="text-button"
                                    onClick={() =>
                                      changeMember(
                                        member,
                                        member.status === "ACTIVE"
                                          ? "WITHDRAWN"
                                          : "ACTIVE",
                                      )
                                    }
                                  >
                                    {member.status === "ACTIVE"
                                      ? "Rời lớp"
                                      : "Quay lại"}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    title="Lớp đang chờ những người bạn nhỏ"
                    icon="students"
                    action={
                      editable && (
                        <button
                          className="button button-ghost"
                          onClick={() => setAdding(true)}
                        >
                          <Icon name="plus" />
                          Thêm bé đầu tiên
                        </button>
                      )
                    }
                  >
                    Chọn hồ sơ có sẵn hoặc tạo hồ sơ bé để bắt đầu.
                  </EmptyState>
                )}
                <Pagination meta={members.data.meta} onChange={setPage} />
              </>
            )
          )}
        </section>
      ) : (
        <section
          className="panel details-panel"
          role="tabpanel"
          id="class-info"
          aria-labelledby="tab-info"
        >
          <h2>Thông tin lớp học</h2>
          <p className="prose">
            {item.description || "Chưa có giới thiệu cho lớp này."}
          </p>
          <dl>
            <div>
              <dt>Độ tuổi phù hợp</dt>
              <dd>
                {item.minAgeMonths !== null || item.maxAgeMonths !== null
                  ? `${item.minAgeMonths ?? "Không giới hạn"} – ${item.maxAgeMonths ?? "không giới hạn"} tháng`
                  : "Chưa cập nhật"}
              </dd>
            </div>
            <div>
              <dt>Sĩ số tối đa</dt>
              <dd>
                {item.capacity ? `${item.capacity} bé` : "Không giới hạn"}
              </dd>
            </div>
            <div>
              <dt>Ngày bắt đầu</dt>
              <dd>{dateLabel(item.startDate)}</dd>
            </div>
            <div>
              <dt>Ngày kết thúc</dt>
              <dd>{dateLabel(item.endDate)}</dd>
            </div>
            <div>
              <dt>Địa điểm</dt>
              <dd>{item.location || "Chưa cập nhật"}</dd>
            </div>
          </dl>
        </section>
      )}
      {(adding || params.get("add") === "1") && editable && (
        <EnrollmentPicker
          classId={item.id}
          existing={new Set(members.data?.data.map((m) => m.studentId))}
          onClose={closeAdd}
          onSuccess={() => {
            closeAdd();
            setNotice("Đã thêm bé vào lớp.");
            refresh();
          }}
        />
      )}
      {action && (
        <ActionModal
          action={action}
          onClose={() => setAction(null)}
          onSuccess={() => {
            setNotice("Đã cập nhật và lưu lịch sử thay đổi.");
            setAction(null);
            refresh();
          }}
        />
      )}
      {history && (
        <EnrollmentHistory
          enrollment={history}
          onClose={() => setHistory(null)}
        />
      )}
    </>
  );
}

function EnrollmentPicker({
  classId,
  existing,
  onClose,
  onSuccess,
}: {
  classId: string;
  existing: Set<string>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null),
    [error, setError] = useState<unknown>(null);
  const resource = useResource(
    useCallback(
      (signal) =>
        api.list<Student>(
          `/students${query({ q, status: "ACTIVE", page, size: 8 })}`,
          signal,
        ),
      [q, page],
    ),
  );
  async function add(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/classes/${classId}/enrollments`, { studentId: id });
      onSuccess();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusyId(null);
    }
  }
  return (
    <Modal title="Thêm bé vào lớp" onClose={onClose} busy={!!busyId} wide>
      <p className="muted">
        Chọn hồ sơ đã có để không tạo lại thông tin của bé.
      </p>
      <ErrorNotice
        error={error || resource.error}
        retry={resource.error ? resource.reload : undefined}
      />
      <form
        className="search-box"
        onSubmit={(event) => {
          event.preventDefault();
          setQ(search);
          setPage(0);
        }}
      >
        <Icon name="search" />
        <input
          aria-label="Tìm hồ sơ bé"
          placeholder="Tìm theo tên hoặc tên gọi ở nhà…"
          maxLength={150}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button type="submit" className="text-button">
          Tìm
        </button>
      </form>
      {resource.loading && !resource.data ? (
        <Loading />
      ) : (
        resource.data && (
          <>
            {resource.data.data.length ? (
              <div className="picker-list">
                {resource.data.data.map((student) => (
                  <div key={student.id}>
                    <Avatar name={student.fullName} />
                    <span>
                      <strong>{student.fullName}</strong>
                      <small>
                        {student.preferredName || dateLabel(student.birthDate)}
                      </small>
                    </span>
                    <button
                      className="button button-small button-ghost"
                      disabled={!!busyId || existing.has(student.id)}
                      onClick={() => add(student.id)}
                    >
                      {existing.has(student.id)
                        ? "Đã có trong lớp"
                        : busyId === student.id
                          ? "Đang thêm…"
                          : "Thêm vào lớp"}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Chưa có hồ sơ phù hợp" icon="students">
                Thêm một hồ sơ mới rồi chọn bé vào lớp.
              </EmptyState>
            )}
            <Pagination meta={resource.data.meta} onChange={setPage} />
          </>
        )
      )}
      <div className="modal-bottom-link">
        <span>Chưa có hồ sơ của bé?</span>
        <Link
          to={`/teacher/students/new?classId=${classId}`}
          className="text-link"
        >
          Tạo hồ sơ mới
          <Icon name="arrow" />
        </Link>
      </div>
    </Modal>
  );
}
function EnrollmentHistory({
  enrollment,
  onClose,
}: {
  enrollment: Enrollment;
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  const resource = useResource(
    useCallback(
      (signal) =>
        api.list<History>(
          `/enrollments/${enrollment.id}/history?page=${page}&size=20`,
          signal,
        ),
      [enrollment.id, page],
    ),
  );
  const names: Record<string, string> = {
    ACTIVE: "Đang tham gia",
    WITHDRAWN: "Đã rời lớp",
    COMPLETED: "Đã hoàn thành",
  };
  return (
    <Modal title={`Hành trình của ${enrollment.studentName}`} onClose={onClose}>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading && !resource.data ? (
        <Loading />
      ) : (
        resource.data && (
          <>
            <ol className="timeline">
              {resource.data.data.map((event) => (
                <li key={event.id}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>
                      {event.action === "ENROLLMENT_CREATED"
                        ? "Tham gia lớp"
                        : `${names[String(event.changedFields.from)] || "Cập nhật"} → ${names[String(event.changedFields.to)] || "Đã thay đổi"}`}
                    </strong>
                    <small>{timeLabel(event.createdAt)}</small>
                    {event.reason && <p>{event.reason}</p>}
                  </div>
                </li>
              ))}
            </ol>
            <Pagination meta={resource.data.meta} onChange={setPage} />
          </>
        )
      )}
    </Modal>
  );
}
