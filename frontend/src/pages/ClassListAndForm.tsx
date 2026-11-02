import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Badge,
  EmptyState,
  ErrorNotice,
  Field,
  Icon,
  Loading,
  PageHeader,
  Pagination,
} from "../components/ui";
import { api, query } from "../lib/api";
import { useResource, useUnsavedChanges } from "../lib/hooks";
import type { Classroom } from "../lib/types";
import FilterBar from "../components/FilterBar";

export function ClassListPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "",
    status = params.get("status") || "",
    page = Math.max(0, Number(params.get("page")) || 0);
  const [search, setSearch] = useState(q);
  const resource = useResource(
    useCallback(
      (signal) =>
        api.list<Classroom>(
          `/classes${query({ q, status, page, size: 12 })}`,
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
        eyebrow="KHÔNG GIAN GIẢNG DẠY"
        title="Lớp học"
        description="Mỗi lớp nhỏ, một không gian để các bé cùng khám phá."
        action={
          <Link to="/teacher/classes/new" className="button button-primary">
            <Icon name="plus" />
            Tạo lớp học
          </Link>
        }
      />
      <FilterBar
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
            aria-label="Tìm lớp học"
            placeholder="Tìm theo tên lớp…"
            value={search}
            maxLength={150}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button className="text-button" type="submit">
            Tìm
          </button>
        </form>
        <select
          aria-label="Trạng thái lớp"
          value={status}
          onChange={(event) =>
            filter({ status: event.target.value, page: "0" })
          }
        >
          <option value="">Tất cả trạng thái</option>
          <option value="DRAFT">Chuẩn bị</option>
          <option value="ACTIVE">Đang dạy</option>
          <option value="COMPLETED">Đã kết thúc</option>
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
              <div className="class-grid">
                {resource.data.data.map((item, index) => (
                  <Link
                    to={`/teacher/classes/${item.id}`}
                    className={`class-card class-tint-${index % 3}`}
                    key={item.id}
                  >
                    <div className="class-card-top">
                      <span className="class-art">
                        <Icon
                          name={index % 2 ? "leaf" : "book"}
                          width="34"
                          height="34"
                        />
                      </span>
                      <Badge context="class" status={item.status} />
                      <span className="card-decoration" />
                    </div>
                    <div className="class-card-content">
                      <h2>{item.name}</h2>
                      <p className="card-description">
                        {item.description ||
                          "Một không gian nhỏ để cùng bé khám phá mỗi ngày."}
                      </p>
                      <div className="class-meta">
                        <span>
                          <Icon name="students" />
                          {item.activeStudents}
                          {item.capacity ? ` / ${item.capacity}` : ""} bé
                        </span>
                        <span>
                          <Icon name="pin" />
                          {item.location || "Chưa đặt địa điểm"}
                        </span>
                      </div>
                      <div className="class-card-footer">
                        <span>Vào lớp học</span>
                        <Icon name="arrow" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <section className="panel">
                <EmptyState
                  title={
                    q || status
                      ? "Chưa tìm thấy lớp phù hợp"
                      : "Lớp học đầu tiên bắt đầu từ đây"
                  }
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
                        to="/teacher/classes/new"
                        className="button button-primary"
                      >
                        <Icon name="plus" />
                        Tạo lớp đầu tiên
                      </Link>
                    )
                  }
                >
                  {q || status
                    ? "Thử đổi từ khóa hoặc trạng thái lớp."
                    : "Thêm tên lớp, độ tuổi và sĩ số. Bạn có thể cập nhật thêm bất cứ lúc nào."}
                </EmptyState>
              </section>
            )}
            <Pagination
              meta={resource.data.meta}
              onChange={(value) => filter({ page: String(value) })}
            />
          </>
        )
      )}
    </>
  );
}

export function ClassFormPage() {
  const { id } = useParams();
  const resource = useResource(
    useCallback(
      (signal) =>
        id
          ? api.get<Classroom>(`/classes/${id}`, signal)
          : Promise.resolve(null),
      [id],
    ),
  );
  if (id && resource.loading && !resource.data) return <Loading />;
  if (resource.error)
    return <ErrorNotice error={resource.error} retry={resource.reload} />;
  return <ClassForm key={id || "new"} classroom={id ? resource.data : null} />;
}
function ClassForm({ classroom }: { classroom: Classroom | null }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [dirty, setDirty] = useState(false);
  const canLeave = useUnsavedChanges(dirty);
  const back = classroom
    ? `/teacher/classes/${classroom.id}`
    : "/teacher/classes";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const optional = (name: string) =>
      String(values.get(name) || "").trim() || null;
    const numeric = (name: string) =>
      optional(name) === null ? null : Number(values.get(name));
    const input = {
      name: values.get("name"),
      description: optional("description"),
      capacity: numeric("capacity"),
      minAgeMonths: numeric("minAgeMonths"),
      maxAgeMonths: numeric("maxAgeMonths"),
      location: optional("location"),
      startDate: optional("startDate"),
      endDate: optional("endDate"),
      version: classroom?.version,
    };
    if (
      input.minAgeMonths !== null &&
      input.maxAgeMonths !== null &&
      input.minAgeMonths > input.maxAgeMonths
    ) {
      setError(
        new Error("Độ tuổi tối đa phải lớn hơn hoặc bằng độ tuổi tối thiểu."),
      );
      return;
    }
    if (input.startDate && input.endDate && input.startDate > input.endDate) {
      setError(new Error("Ngày kết thúc không được trước ngày bắt đầu."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = classroom
        ? await api.patch<Classroom>(`/classes/${classroom.id}`, input)
        : await api.post<Classroom>("/classes", input);
      setDirty(false);
      navigate(`/teacher/classes/${saved.id}`, { replace: true });
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link
        className="back-link"
        to={back}
        onClick={(event) => {
          if (!canLeave()) event.preventDefault();
        }}
      >
        ← Trở về lớp học
      </Link>
      <PageHeader
        eyebrow="CHUẨN BỊ MỘT KHỞI ĐẦU MỚI"
        title={classroom ? "Chỉnh sửa lớp học" : "Tạo lớp học mới"}
        description="Bắt đầu với thông tin cơ bản. Những điều nhỏ còn lại có thể thêm sau."
      />
      <form
        className="panel editor-panel"
        onSubmit={submit}
        onChange={() => setDirty(true)}
      >
        <ErrorNotice error={error} />
        <fieldset disabled={busy}>
          <div className="form-section-title">
            <span>01</span>
            <div>
              <h2>Một cái tên cho lớp nhỏ</h2>
              <p className="muted">
                Thông tin giúp bạn nhận diện và sắp xếp lớp.
              </p>
            </div>
          </div>
          <Field label="Tên lớp">
            <input
              name="name"
              required
              maxLength={150}
              defaultValue={classroom?.name || ""}
              placeholder="Ví dụ: Lớp Mầm Xanh"
            />
          </Field>
          <Field label="Giới thiệu ngắn" optional>
            <textarea
              name="description"
              maxLength={5000}
              rows={3}
              defaultValue={classroom?.description || ""}
              placeholder="Các bé sẽ cùng khám phá những gì trong lớp này?"
            />
          </Field>
          <div className="form-grid">
            <Field
              label="Sĩ số tối đa"
              optional
              hint="Để trống nếu không giới hạn."
            >
              <input
                type="number"
                name="capacity"
                min={1}
                step={1}
                defaultValue={classroom?.capacity ?? ""}
                placeholder="Ví dụ: 10"
              />
            </Field>
            <Field label="Địa điểm" optional>
              <input
                name="location"
                maxLength={300}
                defaultValue={classroom?.location || ""}
                placeholder="Ví dụ: Phòng học tại nhà"
              />
            </Field>
          </div>
          <div className="form-section-title">
            <span>02</span>
            <div>
              <h2>Độ tuổi và thời gian</h2>
              <p className="muted">Các thông tin này đều không bắt buộc.</p>
            </div>
          </div>
          <div className="form-grid">
            <Field label="Tuổi tối thiểu (tháng)" optional>
              <input
                name="minAgeMonths"
                type="number"
                min={0}
                step={1}
                defaultValue={classroom?.minAgeMonths ?? ""}
                placeholder="Ví dụ: 36"
              />
            </Field>
            <Field label="Tuổi tối đa (tháng)" optional>
              <input
                name="maxAgeMonths"
                type="number"
                min={0}
                step={1}
                defaultValue={classroom?.maxAgeMonths ?? ""}
                placeholder="Ví dụ: 60"
              />
            </Field>
            <Field label="Ngày bắt đầu" optional>
              <input
                name="startDate"
                type="date"
                defaultValue={classroom?.startDate || ""}
              />
            </Field>
            <Field label="Ngày kết thúc" optional>
              <input
                name="endDate"
                type="date"
                defaultValue={classroom?.endDate || ""}
              />
            </Field>
          </div>
        </fieldset>
        <div className="form-actions">
          <Link
            to={back}
            className="button button-ghost"
            onClick={(event) => {
              if (busy || !canLeave()) event.preventDefault();
            }}
          >
            Hủy
          </Link>
          <button className="button button-primary" disabled={busy}>
            {busy ? "Đang lưu…" : classroom ? "Lưu thay đổi" : "Tạo lớp học"}
            <Icon name="arrow" />
          </button>
        </div>
      </form>
    </>
  );
}
