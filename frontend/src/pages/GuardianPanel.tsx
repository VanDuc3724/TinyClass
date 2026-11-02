import { useCallback, useState } from "react";
import type { FormEvent } from "react";
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
  Modal,
  Pagination,
} from "../components/ui";
import { timeLabel } from "../lib/format";
import { api } from "../lib/api";
import { useResource } from "../lib/hooks";

interface Invitation {
  id: string;
  invitedEmail: string;
  status: string;
  expiresAt: string;
  version: number;
}
interface Guardian {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  relationshipLabel: string | null;
  status: string;
  linkedAt: string;
  version: number;
}
interface Created {
  invitation: Invitation;
  inviteUrl: string;
}
export default function GuardianPanel({
  studentId,
  studentActive,
}: {
  studentId: string;
  studentActive: boolean;
}) {
  const [inviting, setInviting] = useState(false),
    [action, setAction] = useState<ActionRequest | null>(null);
  const [guardianPage, setGuardianPage] = useState(0),
    [invitationPage, setInvitationPage] = useState(0),
    [notice, setNotice] = useState("");
  const resource = useResource(
    useCallback(
      async (signal) => {
        const [guardians, invitations] = await Promise.all([
          api.list<Guardian>(
            `/students/${studentId}/guardians?page=${guardianPage}&size=10`,
            signal,
          ),
          api.list<Invitation>(
            `/students/${studentId}/guardian-invitations?page=${invitationPage}&size=10`,
            signal,
          ),
        ]);
        return { guardians, invitations };
      },
      [studentId, guardianPage, invitationPage],
    ),
  );
  function revokeGuardian(guardian: Guardian) {
    setAction({
      title: "Thu hồi liên kết gia đình",
      label: "Thu hồi liên kết",
      reasonRequired: true,
      description: `${guardian.displayName} sẽ không còn truy cập hồ sơ và lớp của bé này. Quyền với các bé khác của phụ huynh được giữ nguyên.`,
      run: (reason) =>
        api.post(`/student-guardians/${guardian.id}/revoke`, {
          version: guardian.version,
          reason,
        }),
    });
  }
  function revokeInvitation(invitation: Invitation) {
    setAction({
      title: "Thu hồi lời mời",
      label: "Thu hồi lời mời",
      description: `Liên kết mời gửi đến ${invitation.invitedEmail} sẽ không thể dùng để nhận quyền với bé.`,
      run: (reason) =>
        api.post(`/guardian-invitations/${invitation.id}/revoke`, {
          version: invitation.version,
          reason,
        }),
    });
  }
  return (
    <section className="panel guardian-panel">
      <div className="section-heading">
        <div>
          <h2>Gia đình đồng hành</h2>
          <p className="muted">
            Cấp quyền cho đúng người giám hộ và quản lý từng lời mời.
          </p>
        </div>
        {studentActive && (
          <button
            className="button button-primary"
            onClick={() => setInviting(true)}
          >
            <Icon name="plus" />
            Mời phụ huynh
          </button>
        )}
      </div>
      {notice && (
        <div className="panel-inset">
          <p className="info-notice" role="status">
            {notice}
          </p>
        </div>
      )}
      <div className="panel-inset">
        <ErrorNotice error={resource.error} retry={resource.reload} />
      </div>
      {resource.loading && !resource.data ? (
        <Loading />
      ) : (
        resource.data && (
          <>
            <div className="panel-subheading">
              <h3>Người giám hộ đã liên kết</h3>
            </div>
            {resource.data.guardians.data.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Phụ huynh</th>
                      <th>Mối quan hệ</th>
                      <th>Trạng thái</th>
                      <th>
                        <span className="sr-only">Thao tác</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {resource.data.guardians.data.map((guardian) => (
                      <tr key={guardian.id}>
                        <td>
                          <span className="person-link">
                            <Avatar name={guardian.displayName} />
                            <span>
                              <strong>{guardian.displayName}</strong>
                              <small>{guardian.email}</small>
                            </span>
                          </span>
                        </td>
                        <td>{guardian.relationshipLabel || "Phụ huynh"}</td>
                        <td>
                          <Badge status={guardian.status} />
                        </td>
                        <td>
                          {guardian.status === "ACTIVE" && (
                            <button
                              className="text-button"
                              onClick={() => revokeGuardian(guardian)}
                            >
                              Thu hồi liên kết
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Chưa có gia đình được kết nối" icon="students">
                Tạo lời mời, sao chép liên kết và gửi cho người giám hộ của bé.
              </EmptyState>
            )}
            <Pagination
              meta={resource.data.guardians.meta}
              onChange={setGuardianPage}
            />
            <div className="panel-subheading">
              <h3>Lịch sử lời mời</h3>
              <span className="muted">
                Lời mời mới thay thế lời mời chưa nhận của cùng email.
              </span>
            </div>
            {resource.data.invitations.data.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Email nhận</th>
                      <th>Hết hiệu lực</th>
                      <th>Trạng thái</th>
                      <th>
                        <span className="sr-only">Thao tác</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {resource.data.invitations.data.map((invitation) => (
                      <tr key={invitation.id}>
                        <td>{invitation.invitedEmail}</td>
                        <td>{timeLabel(invitation.expiresAt)}</td>
                        <td>
                          <Badge status={invitation.status} />
                        </td>
                        <td>
                          {invitation.status === "PENDING" && (
                            <button
                              className="text-button"
                              onClick={() => revokeInvitation(invitation)}
                            >
                              Thu hồi lời mời
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted panel-inset">Chưa có lời mời nào.</p>
            )}
            <Pagination
              meta={resource.data.invitations.meta}
              onChange={setInvitationPage}
            />
          </>
        )
      )}
      {inviting && (
        <InviteModal
          studentId={studentId}
          onClose={() => setInviting(false)}
          onCreated={resource.reload}
        />
      )}
      {action && (
        <ActionModal
          action={action}
          onClose={() => setAction(null)}
          onSuccess={() => {
            setAction(null);
            setNotice("Đã thu hồi và lưu lịch sử thay đổi.");
            resource.reload();
          }}
        />
      )}
    </section>
  );
}
function InviteModal({
  studentId,
  onClose,
  onCreated,
}: {
  studentId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [created, setCreated] = useState<Created | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [notice, setNotice] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email")).trim();
    setBusy(true);
    setError(null);
    try {
      setCreated(
        await api.post<Created>(`/students/${studentId}/guardian-invitations`, {
          email,
        }),
      );
      onCreated();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(created!.inviteUrl);
      setNotice(
        "Đã sao chép. Bạn có thể gửi riêng liên kết này cho phụ huynh.",
      );
    } catch {
      setNotice("Hãy chọn và sao chép liên kết trong ô bên dưới.");
    }
  }
  return (
    <Modal title="Mời gia đình đồng hành" onClose={onClose} busy={busy}>
      <ErrorNotice error={error} />
      {created ? (
        <>
          <p className="muted">
            Lời mời dành cho <strong>{created.invitation.invitedEmail}</strong>,
            có hiệu lực đến {timeLabel(created.invitation.expiresAt)}.
          </p>
          <Field label="Liên kết mời">
            <input
              type="text"
              readOnly
              value={created.inviteUrl}
              onFocus={(event) => event.currentTarget.select()}
            />
          </Field>
          <p className="muted">
            Gửi riêng liên kết này cho đúng người nhận. Phụ huynh cần xác minh
            email trước khi được xem hồ sơ bé.
          </p>
          {notice && (
            <p className="info-notice" role="status">
              {notice}
            </p>
          )}
          <div className="form-actions">
            <button className="button button-ghost" onClick={onClose}>
              Đóng
            </button>
            <button className="button button-primary" onClick={copy}>
              Sao chép liên kết
              <Icon name="arrow" />
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={submit}>
          <p className="muted">
            Nhập email phụ huynh sẽ dùng để đăng nhập. Bạn sẽ nhận liên kết để
            chủ động gửi lời mời.
          </p>
          <Field label="Email phụ huynh">
            <input
              type="email"
              name="email"
              autoComplete="off"
              required
              maxLength={254}
              disabled={busy}
              placeholder="phuhuynh@example.com"
            />
          </Field>
          <div className="form-actions">
            <button
              type="button"
              className="button button-ghost"
              disabled={busy}
              onClick={onClose}
            >
              Hủy
            </button>
            <button className="button button-primary" disabled={busy}>
              {busy ? "Đang tạo…" : "Tạo lời mời"}
              <Icon name="arrow" />
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
