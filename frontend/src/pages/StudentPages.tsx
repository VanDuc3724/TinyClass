import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ActionModal } from "../components/ActionModal";
import type { ActionRequest } from "../components/ActionModal";
import {
  Avatar,
  Badge,
  EmptyState,
  ErrorNotice,
  Field,
  Icon,
  Loading,
  PageHeader,
  Pagination,
} from "../components/ui";
import { businessToday, dateLabel, instantDateLabel } from "../lib/format";
import { api, query } from "../lib/api";
import { useResource, useUnsavedChanges } from "../lib/hooks";
import type { Student, StudentClass } from "../lib/types";
import GuardianPanel from "./GuardianPanel";
import FilterBar from "../components/FilterBar";

export function StudentListPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "",
    status = params.get("status") || "",
    page = Math.max(0, Number(params.get("page")) || 0);
  const [search, setSearch] = useState(q);
  const resource = useResource(
    useCallback(
      (signal) =>
        api.list<Student>(
          `/students${query({ q, status, page, size: 20 })}`,
          signal,
        ),
      [q, status, page],
    ),
  );
  function filter(values: Record<string, string>) {
    setParams({ q, status, ...values });
  }
  return (
    <>
      <PageHeader
        eyebrow="MỖI BÉ MỘT HÀNH TRÌNH"
        title="Hồ sơ các bé"
        description="Lưu một lần, đồng hành qua nhiều lớp học."
        action={
          <Link to="/teacher/students/new" className="button button-primary">
            <Icon name="plus" />
            Thêm hồ sơ bé
          </Link>
        }
      />
      <section className="panel">
        <FilterBar
          className="inside-panel"
          active={!!(q || status)}
          onReset={() => {
            setSearch("");
            setParams({});
          }}
        >
          <form
            className="search-box"
            onSubmit={(event) => {
              event.preventDefault();
              filter({ q: search, page: "0" });
            }}
          >
            <Icon name="search" />
            <input
              aria-label="Tìm học sinh"
              value={search}
              maxLength={150}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm tên bé hoặc tên gọi ở nhà…"
            />
            <button type="submit" className="text-button">
              Tìm
            </button>
          </form>
          <select
            aria-label="Trạng thái hồ sơ"
            value={status}
            onChange={(event) =>
              filter({ status: event.target.value, page: "0" })
            }
          >
            <option value="">Tất cả hồ sơ</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="ARCHIVED">Đã lưu trữ</option>
          </select>
        </FilterBar>
        <ErrorNotice error={resource.error} retry={resource.reload} />
        {resource.loading && !resource.data ? (
          <Loading />
        ) : (
          resource.data && (
            <>
              {resource.data.data.length ? (
                <div className="table-scroll">
                  <table className="student-table">
                    <thead>
                      <tr>
                        <th>Họ và tên</th>
                        <th>Tên gọi ở nhà</th>
                        <th>Ngày sinh</th>
                        <th>Trạng thái</th>
                        <th>
                          <span className="sr-only">Chi tiết</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {resource.data.data.map((student) => (
                        <tr key={student.id}>
                          <td>
                            <Link
                              className="person-link"
                              to={`/teacher/students/${student.id}`}
                            >
                              <Avatar name={student.fullName} />
                              <strong>{student.fullName}</strong>
                            </Link>
                          </td>
                          <td data-label="Tên gọi ở nhà">
                            {student.preferredName || "—"}
                          </td>
                          <td data-label="Ngày sinh">
                            {dateLabel(student.birthDate)}
                          </td>
                          <td data-label="Trạng thái">
                            <Badge status={student.status} />
                          </td>
                          <td>
                            <Link
                              className="icon-button"
                              to={`/teacher/students/${student.id}`}
                              aria-label={`Xem hồ sơ ${student.fullName}`}
                            >
                              <Icon name="arrow" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title={
                    q || status
                      ? "Chưa tìm thấy hồ sơ phù hợp"
                      : "Làm quen với những người bạn nhỏ"
                  }
                  icon="students"
                  action={
                    q || status ? (
                      <button
                        className="button button-ghost"
                        onClick={() => {
                          setSearch("");
                          setParams({});
                        }}
                      >
                        Xóa bộ lọc
                      </button>
                    ) : (
                      <Link
                        to="/teacher/students/new"
                        className="button button-ghost"
                      >
                        <Icon name="plus" />
                        Thêm hồ sơ đầu tiên
                      </Link>
                    )
                  }
                >
                  {q || status
                    ? "Thử tìm bằng tên khác hoặc đổi bộ lọc."
                    : "Tạo hồ sơ của bé rồi thêm vào một hoặc nhiều lớp, không cần nhập lại."}
                </EmptyState>
              )}
              <Pagination
                meta={resource.data.meta}
                onChange={(value) => filter({ page: String(value) })}
              />
            </>
          )
        )}
      </section>
    </>
  );
}

export function StudentDetailPage() {
  const { id } = useParams();
  const [action, setAction] = useState<ActionRequest | null>(null);
  const [notice, setNotice] = useState("");
  const resource = useResource(
    useCallback(
      async (signal) => {
        const [student, classes] = await Promise.all([
          api.get<Student>(`/students/${id}`, signal),
          api.get<StudentClass[]>(`/students/${id}/classes`, signal),
        ]);
        return { student, classes };
      },
      [id],
    ),
  );
  if (resource.loading && !resource.data) return <Loading />;
  if (!resource.data || resource.error)
    return <ErrorNotice error={resource.error} retry={resource.reload} />;
  const { student, classes } = resource.data;
  function changeStatus() {
    const archive = student.status === "ACTIVE";
    setAction({
      title: archive ? "Lưu trữ hồ sơ bé" : "Khôi phục hồ sơ bé",
      label: archive ? "Lưu trữ hồ sơ" : "Khôi phục",
      description: archive
        ? "Hồ sơ và lịch sử được giữ lại. Bé cần rời các lớp đang tham gia trước khi lưu trữ."
        : "Hồ sơ trở lại hoạt động. Bạn có thể chủ động chọn lớp để bé tham gia.",
      run: (reason) =>
        api.post(`/students/${student.id}/${archive ? "archive" : "restore"}`, {
          version: student.version,
          reason,
        }),
    });
  }
  return (
    <>
      <Link className="back-link" to="/teacher/students">
        ← Tất cả hồ sơ
      </Link>
      <div className="student-profile-heading">
        <Avatar name={student.fullName} large />
        <div>
          <p className="eyebrow">HỒ SƠ HỌC SINH</p>
          <h1>{student.fullName}</h1>
          <p className="muted">
            {student.preferredName
              ? `Ở nhà gọi là ${student.preferredName}`
              : "Mỗi bé một câu chuyện riêng"}
          </p>
        </div>
        <div className="detail-actions">
          {student.status === "ACTIVE" && (
            <Link
              to={`/teacher/students/${id}/edit`}
              className="button button-ghost"
            >
              <Icon name="edit" />
              Chỉnh sửa
            </Link>
          )}
          <button
            type="button"
            className="button button-ghost"
            onClick={changeStatus}
          >
            {student.status === "ACTIVE" ? "Lưu trữ hồ sơ" : "Khôi phục hồ sơ"}
          </button>
        </div>
      </div>
      {notice && (
        <p className="info-notice" role="status">
          {notice}
        </p>
      )}
      <div className="profile-grid">
        <section className="panel details-panel">
          <h2>Đôi điều về bé</h2>
          <dl>
            <div>
              <dt>Họ và tên</dt>
              <dd>{student.fullName}</dd>
            </div>
            <div>
              <dt>Tên gọi ở nhà</dt>
              <dd>{student.preferredName || "Chưa cập nhật"}</dd>
            </div>
            <div>
              <dt>Ngày sinh</dt>
              <dd>{dateLabel(student.birthDate)}</dd>
            </div>
            <div>
              <dt>Trạng thái hồ sơ</dt>
              <dd>
                <Badge status={student.status} />
              </dd>
            </div>
          </dl>
        </section>
        <section className="panel private-note">
          <span className="note-icon">
            <Icon name="lock" />
          </span>
          <h2>Ghi chú riêng của giáo viên</h2>
          <p className="muted">
            Chỉ hiển thị trong không gian quản lý của bạn.
          </p>
          <p className="prose">
            {student.internalNote ||
              "Chưa có ghi chú. Bạn có thể ghi lại sở thích, thói quen và những điều cần quan tâm của bé."}
          </p>
        </section>
      </div>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Các lớp của bé</h2>
            <p className="muted">
              Cùng một hồ sơ, từng chặng đường được giữ lại.
            </p>
          </div>
          <Link className="text-link" to="/teacher/classes">
            Đến danh sách lớp
            <Icon name="arrow" />
          </Link>
        </div>
        {classes.length ? (
          <div className="recent-classes">
            {classes.map((item) => (
              <Link
                className="recent-class"
                to={`/teacher/classes/${item.classId}`}
                key={item.enrollmentId}
              >
                <span className="class-mark">
                  <Icon name="classes" />
                </span>
                <div>
                  <h3>{item.className}</h3>
                  <p>Tham gia từ {instantDateLabel(item.joinedAt)}</p>
                </div>
                <Badge status={item.status} />
                <Icon name="arrow" />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="Chặng đường đầu tiên đang chờ bé" icon="classes">
            Mở một lớp học và chọn “Thêm bé vào lớp” để bắt đầu.
          </EmptyState>
        )}
      </section>
      <GuardianPanel
        studentId={student.id}
        studentActive={student.status === "ACTIVE"}
      />
      {action && (
        <ActionModal
          action={action}
          onClose={() => setAction(null)}
          onSuccess={() => {
            setAction(null);
            setNotice("Đã cập nhật hồ sơ và lưu lịch sử thay đổi.");
            resource.reload();
          }}
        />
      )}
    </>
  );
}

export function StudentFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const classId = /^[a-f0-9-]{36}$/i.test(params.get("classId") || "")
    ? params.get("classId")
    : null;
  const resource = useResource(
    useCallback(
      (signal) =>
        id
          ? api.get<Student>(`/students/${id}`, signal)
          : Promise.resolve(null),
      [id],
    ),
  );
  if (id && resource.loading && !resource.data) return <Loading />;
  if (resource.error)
    return <ErrorNotice error={resource.error} retry={resource.reload} />;
  return (
    <StudentForm
      key={id || "new"}
      student={id ? resource.data : null}
      classId={classId}
    />
  );
}
function StudentForm({
  student,
  classId,
}: {
  student: Student | null;
  classId: string | null;
}) {
  const navigate = useNavigate();
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const canLeave = useUnsavedChanges(dirty);
  const back = student
    ? `/teacher/students/${student.id}`
    : classId
      ? `/teacher/classes/${classId}`
      : "/teacher/students";
  const [today] = useState(businessToday);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const input = {
      fullName: String(values.get("fullName")).trim(),
      preferredName: String(values.get("preferredName") || "").trim() || null,
      birthDate: values.get("birthDate") || null,
      internalNote: String(values.get("internalNote") || "").trim() || null,
      version: student?.version,
    };
    setBusy(true);
    setError(null);
    try {
      const saved = student
        ? await api.patch<Student>(`/students/${student.id}`, input)
        : await api.post<Student>("/students", input);
      setDirty(false);
      navigate(
        classId && !student
          ? `/teacher/classes/${classId}?add=1`
          : `/teacher/students/${saved.id}`,
        { replace: true },
      );
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link
        to={back}
        className="back-link"
        onClick={(event) => {
          if (!canLeave()) event.preventDefault();
        }}
      >
        ← Trở về {classId ? "lớp học" : "hồ sơ"}
      </Link>
      <PageHeader
        eyebrow="LÀM QUEN VỚI MỘT NGƯỜI BẠN NHỎ"
        title={student ? "Chỉnh sửa hồ sơ bé" : "Thêm hồ sơ bé"}
        description="Một hồ sơ dùng chung cho mọi lớp. Tên trùng nhau vẫn có thể là hai bé khác nhau."
      />
      <form
        className="panel editor-panel"
        onSubmit={submit}
        onChange={() => setDirty(true)}
      >
        <ErrorNotice error={error} />
        <fieldset disabled={busy}>
          <div className="form-section-title">
            <span>
              <Icon name="students" />
            </span>
            <div>
              <h2>Thông tin của bé</h2>
              <p className="muted">Chỉ cần họ và tên để bắt đầu.</p>
            </div>
          </div>
          <Field label="Họ và tên bé">
            <input
              name="fullName"
              required
              maxLength={150}
              defaultValue={student?.fullName || ""}
              placeholder="Ví dụ: Nguyễn An Nhiên"
            />
          </Field>
          <div className="form-grid">
            <Field label="Tên gọi ở nhà" optional>
              <input
                name="preferredName"
                maxLength={100}
                defaultValue={student?.preferredName || ""}
                placeholder="Ví dụ: Bông"
              />
            </Field>
            <Field label="Ngày sinh" optional>
              <input
                name="birthDate"
                type="date"
                max={today}
                defaultValue={student?.birthDate || ""}
              />
            </Field>
          </div>
          <Field
            label="Ghi chú riêng"
            optional
            hint="Chỉ giáo viên xem được nội dung này."
          >
            <textarea
              name="internalNote"
              rows={5}
              maxLength={5000}
              defaultValue={student?.internalNote || ""}
              placeholder="Sở thích, thói quen hoặc điều bạn muốn lưu ý khi đồng hành cùng bé…"
            />
          </Field>
        </fieldset>
        {classId && !student && (
          <p className="info-notice">
            Sau khi lưu, bạn sẽ trở về lớp để chọn bé vào danh sách tham gia.
          </p>
        )}
        <div className="form-actions">
          <Link
            className="button button-ghost"
            to={back}
            onClick={(event) => {
              if (busy || !canLeave()) event.preventDefault();
            }}
          >
            Hủy
          </Link>
          <button className="button button-primary" disabled={busy}>
            {busy ? "Đang lưu…" : student ? "Lưu thay đổi" : "Lưu hồ sơ"}
            <Icon name="arrow" />
          </button>
        </div>
      </form>
    </>
  );
}
