import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import VerificationPrompt from "../auth/VerificationPrompt";
import {
  Avatar,
  Badge,
  EmptyState,
  ErrorNotice,
  Icon,
  Loading,
  PageHeader,
  Pagination,
} from "../components/ui";
import { dateLabel } from "../lib/format";
import { api } from "../lib/api";
import { useResource } from "../lib/hooks";
import FamilyOverviewPanel from "./FamilyOverviewPanel";
import { UpdatesOverviewPanel } from "./DashboardParts";
import type { FamilyDashboard, FamilyHomeOverview } from "../lib/dashboard";

interface Child {
  id: string;
  fullName: string;
  preferredName: string | null;
  birthDate: string | null;
  status: string;
  teacherName: string;
  relationshipLabel: string | null;
}
interface ChildClass {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  status: string;
  enrollmentStatus: string;
  startDate: string | null;
  endDate: string | null;
}
export function FamilyHomePage() {
  const { account } = useAuth();
  const verified = !!account?.emailVerifiedAt;
  const [page, setPage] = useState(0);
  const resource = useResource(
    useCallback(
      async (signal) => {
        if (!verified) return null;
        const [children, summary] = await Promise.all([
          api.list<Child>(`/family/children?page=${page}&size=12`, signal),
          api.get<FamilyHomeOverview>("/family/dashboard", signal),
        ]);
        return { children, summary };
      },
      [page, verified],
    ),
  );
  return (
    <>
      <PageHeader
        eyebrow="CÙNG CON LỚN KHÔN"
        title={`Xin chào, ${account!.displayName}!`}
        description="Chọn hồ sơ của bé để theo dõi lớp học và cùng giáo viên đồng hành."
        action={
          verified && (
            <button
              className="button button-ghost"
              disabled={resource.loading}
              onClick={resource.reload}
            >
              Cập nhật trang chủ
            </button>
          )
        }
      />
      {!verified ? (
        <section className="panel family-verification">
          <VerificationPrompt />
        </section>
      ) : (
        <>
          <ErrorNotice error={resource.error} retry={resource.reload} />
          {resource.loading && !resource.data ? (
            <Loading />
          ) : (
            resource.data && (
              <>
                <p className="info-notice">
                  {resource.data.summary.linkedChildren} hồ sơ bé đang liên kết
                  · Hộp cập nhật bao gồm mọi bé bạn còn quyền xem.
                </p>
                {resource.data.children.data.length ? (
                  <div className="family-child-grid">
                    {resource.data.children.data.map((child) => (
                      <Link
                        className="panel family-child-card"
                        key={child.id}
                        to={`/family/children/${child.id}`}
                      >
                        <Avatar name={child.fullName} large />
                        <h2>{child.fullName}</h2>
                        {child.preferredName && (
                          <p className="muted">
                            Ở nhà gọi là {child.preferredName}
                          </p>
                        )}
                        <p className="muted">Giáo viên: {child.teacherName}</p>
                        <div className="family-card-bottom">
                          <span>{child.relationshipLabel || "Gia đình"}</span>
                          <span className="text-link">
                            Xem lớp của bé
                            <Icon name="arrow" />
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <section className="panel">
                    <EmptyState
                      title="Chờ một lời mời từ giáo viên"
                      icon="students"
                    >
                      Mở liên kết mời giáo viên gửi và nhận lời mời bằng đúng
                      email tài khoản của bạn. Hồ sơ của bé sẽ xuất hiện tại
                      đây.
                    </EmptyState>
                  </section>
                )}
                <Pagination
                  meta={resource.data.children.meta}
                  onChange={setPage}
                />
                <UpdatesOverviewPanel
                  data={resource.data.summary.updates}
                  root="/family"
                  onRefresh={resource.reload}
                />
              </>
            )
          )}
        </>
      )}
    </>
  );
}
export function FamilyChildPage() {
  const { id } = useParams(),
    { account } = useAuth();
  const verified = !!account?.emailVerifiedAt;
  const [page, setPage] = useState(0);
  const resource = useResource(
    useCallback(
      async (signal) => {
        if (!verified) return null;
        const [child, classes, overview] = await Promise.all([
          api.get<Child>(`/family/children/${id}`, signal),
          api.list<ChildClass>(
            `/family/children/${id}/classes?page=${page}&size=12`,
            signal,
          ),
          api.get<FamilyDashboard>(`/family/children/${id}/dashboard`, signal),
        ]);
        return { child, classes, overview };
      },
      [id, page, verified],
    ),
  );
  if (!verified)
    return (
      <section className="panel family-verification">
        <VerificationPrompt />
      </section>
    );
  if (resource.loading && !resource.data) return <Loading />;
  if (resource.error || !resource.data)
    return (
      <>
        <Link to="/family" className="back-link">
          ← Chọn hồ sơ bé
        </Link>
        <ErrorNotice error={resource.error} retry={resource.reload} />
      </>
    );
  const { child, classes, overview } = resource.data;
  return (
    <>
      <Link to="/family" className="back-link">
        ← Chọn bé khác
      </Link>
      <div className="student-profile-heading family-profile-heading">
        <Avatar name={child.fullName} large />
        <div>
          <p className="eyebrow">HÀNH TRÌNH CỦA BÉ</p>
          <h1>{child.fullName}</h1>
          <p className="muted">
            {child.preferredName
              ? `Ở nhà gọi là ${child.preferredName} · `
              : ""}
            Giáo viên: {child.teacherName}
          </p>
        </div>
        <button className="button button-ghost" onClick={resource.reload}>
          Cập nhật thông tin
        </button>
        <nav
          className="family-profile-actions"
          aria-label="Theo dõi hoạt động của bé"
        >
          <Link
            className="button button-ghost"
            to={`/family/children/${id}/announcements`}
          >
            Thông báo lớp
          </Link>
          <Link
            className="button button-ghost"
            to={`/family/children/${id}/invoices`}
          >
            Phiếu học phí
          </Link>
          <Link
            className="button button-ghost"
            to={`/family/children/${id}/tuition`}
          >
            <Icon name="book" />
            Điều kiện học phí
          </Link>
          <Link
            className="button button-ghost"
            to={`/family/children/${id}/progress`}
          >
            <Icon name="leaf" />
            Nhận xét & tiến bộ
          </Link>
          <Link
            className="button button-primary"
            to={`/family/children/${id}/learning`}
          >
            <Icon name="book" />
            Góc học của bé
          </Link>
          <Link
            className="button button-ghost"
            to={`/family/children/${id}/submissions`}
          >
            <Icon name="check" />
            Sản phẩm & phản hồi
          </Link>
          <Link
            className="button button-ghost"
            to={`/family/children/${id}/schedule`}
          >
            <Icon name="calendar" />
            Lịch học của bé
          </Link>
          <Link
            className="button button-ghost"
            to={`/family/children/${id}/attendance`}
          >
            <Icon name="check" />
            Điểm danh của bé
          </Link>
        </nav>
      </div>
      <section className="panel details-panel">
        <h2>Tổng quan của bé</h2>
        <p className="muted">
          Bài học, lịch, phản hồi và học phí theo quyền hiện tại.
        </p>
      </section>
      <FamilyOverviewPanel
        key={child.id}
        data={overview}
        onRefresh={resource.reload}
      />
      <section className="panel details-panel">
        <h2>Đôi điều về bé</h2>
        <dl>
          <div>
            <dt>Họ và tên</dt>
            <dd>{child.fullName}</dd>
          </div>
          <div>
            <dt>Ngày sinh</dt>
            <dd>{dateLabel(child.birthDate)}</dd>
          </div>
          <div>
            <dt>Tên gọi ở nhà</dt>
            <dd>{child.preferredName || "Chưa cập nhật"}</dd>
          </div>
          <div>
            <dt>Trạng thái hồ sơ</dt>
            <dd>
              <Badge status={child.status} />
            </dd>
          </div>
        </dl>
      </section>
      <PageHeader
        eyebrow="ĐỒNG HÀNH MỖI NGÀY"
        title="Lớp học của bé"
        description="Các lớp đã mở và được cấp quyền theo hồ sơ của bé."
      />
      {classes.data.length ? (
        <div className="class-grid">
          {classes.data.map((classroom) => (
            <section
              className="class-card family-class-card"
              key={classroom.id}
            >
              <div className="class-card-top">
                <span className="class-art">
                  <Icon name="book" width="34" height="34" />
                </span>
                <Badge context="class" status={classroom.status} />
              </div>
              <div className="class-card-content">
                <h2>{classroom.name}</h2>
                <p className="prose">
                  {classroom.description ||
                    "Cùng giáo viên khám phá từng điều nhỏ mỗi ngày."}
                </p>
                <div className="class-meta">
                  <span>
                    <Icon name="pin" />
                    {classroom.location || "Giáo viên sẽ thông báo địa điểm"}
                  </span>
                  <span>
                    <Icon name="calendar" />
                    {classroom.startDate
                      ? dateLabel(classroom.startDate)
                      : "Chưa đặt ngày bắt đầu"}
                    {classroom.endDate
                      ? ` – ${dateLabel(classroom.endDate)}`
                      : ""}
                  </span>
                </div>
                <div className="class-card-footer">
                  <Badge status={classroom.enrollmentStatus} />
                </div>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="panel">
          <EmptyState title="Chưa có lớp đang được chia sẻ" icon="classes">
            Lớp sẽ xuất hiện khi giáo viên mở lớp và bé đang tham gia. Nếu cần,
            bạn có thể liên hệ giáo viên để kiểm tra.
          </EmptyState>
        </section>
      )}
      <Pagination meta={classes.meta} onChange={setPage} />
    </>
  );
}
