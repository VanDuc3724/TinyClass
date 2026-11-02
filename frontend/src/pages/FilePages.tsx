import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { api, query } from "../lib/api";
import { bytes, fileUrl, uploadFile } from "../lib/files";
import type { MediaFile, StorageConnection } from "../lib/files";
import { useResource } from "../lib/hooks";
import { instantDateLabel } from "../lib/format";
import {
  EmptyState,
  ErrorNotice,
  Field,
  Icon,
  ImagePreview,
  Loading,
  Modal,
  PageHeader,
  Pagination,
} from "../components/ui";

export function MediaPreview({
  mime,
  url,
  name,
}: {
  mime: string;
  url: string;
  name: string;
}) {
  if (mime.startsWith("video/"))
    return (
      <video
        className="media-preview"
        aria-label={name}
        controls
        preload="metadata"
        src={url}
      />
    );
  if (mime.startsWith("audio/"))
    return (
      <audio
        className="media-audio"
        aria-label={name}
        controls
        preload="metadata"
        src={url}
      />
    );
  if (mime.startsWith("image/"))
    return <ImagePreview className="media-preview" src={url} alt={name} />;
  if (mime === "application/pdf")
    return <iframe className="pdf-preview" src={url} title={`Xem ${name}`} />;
  return <p className="muted">Chưa có bản xem trước cho định dạng này.</p>;
}
export default function FileLibraryPage() {
  const [params] = useSearchParams();
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    [upload, setUpload] = useState(params.get("upload") === "1");
  const [selected, setSelected] = useState<MediaFile | null>(null),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  const files = useResource(
    useCallback(
      (signal) =>
        api.list<MediaFile>(
          `/files${query({ q: search, page, size: 12 })}`,
          signal,
        ),
      [search, page],
    ),
  );
  const storage = useResource(
    useCallback(
      (signal) => api.get<StorageConnection[]>("/storage-connections", signal),
      [],
    ),
  );
  function reload() {
    files.reload();
    storage.reload();
  }
  async function changePolicy(file: MediaFile) {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.patch<MediaFile>(`/files/${file.id}/policy`, {
        version: file.version,
        learnerDownloadAllowed: !file.learnerDownloadAllowed,
      });
      setSelected(updated);
      files.reload();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  const local = storage.data?.find((item) => item.provider === "LOCAL");
  return (
    <>
      <PageHeader
        eyebrow="CHUẨN BỊ NHỮNG ĐIỀU THÚ VỊ"
        title="Kho tài liệu"
        description="Video, ảnh và tài liệu của lớp nhỏ, sẵn sàng dùng trong bài học."
        action={
          <button
            className="button button-primary"
            onClick={() => setUpload(true)}
          >
            <Icon name="plus" />
            Tải tệp lên
          </button>
        }
      />
      {local && (
        <div className="storage-banner">
          <span className="stat-icon mint">
            <Icon name="book" />
          </span>
          <div>
            <strong>{local.displayName}</strong>
            <p className="muted">
              Đã dùng {bytes(local.usedBytes)} / {bytes(local.quotaBytes)} · Kho
              mặc định
            </p>
          </div>
          <span className="pill">Riêng tư</span>
        </div>
      )}
      <ErrorNotice error={files.error || storage.error} retry={reload} />
      <div className="list-toolbar">
        <div className="search-field">
          <Icon name="search" />
          <input
            aria-label="Tìm tài liệu"
            placeholder="Tìm theo tên tệp…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
        </div>
        <span className="muted">{files.data?.meta.totalElements ?? 0} tệp</span>
      </div>
      {files.loading && !files.data ? (
        <Loading />
      ) : (
        files.data &&
        (files.data.data.length ? (
          <>
            <div className="file-grid">
              {files.data.data.map((file) => (
                <button
                  className="file-card"
                  key={file.id}
                  onClick={() => {
                    setSelected(file);
                    setError(null);
                  }}
                >
                  <div
                    className={`file-art ${file.mimeType.startsWith("image/") ? "file-image" : ""}`}
                  >
                    {file.mimeType.startsWith("image/") &&
                    file.status === "READY" ? (
                      <ImagePreview src={fileUrl(file.id)} alt="" />
                    ) : (
                      <>
                        <Icon
                          name={
                            file.mimeType.startsWith("video/") ? "eye" : "book"
                          }
                          width="36"
                          height="36"
                        />
                        <span>
                          {file.mimeType.split("/")[1]?.toUpperCase()}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="file-card-body">
                    <h2>{file.originalName}</h2>
                    <p>
                      {bytes(file.sizeBytes)} ·{" "}
                      {instantDateLabel(file.createdAt)}
                    </p>
                    <span
                      className={`file-policy ${file.learnerDownloadAllowed ? "is-allowed" : ""}`}
                    >
                      {file.status !== "READY"
                        ? "Chưa sẵn sàng"
                        : file.learnerDownloadAllowed
                          ? "Cho phép gia đình tải"
                          : "Gia đình chỉ xem"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
            <Pagination meta={files.data.meta} onChange={setPage} />
          </>
        ) : (
          <EmptyState
            title="Tủ tài liệu đang chờ bạn"
            icon="book"
            action={
              <button
                className="button button-ghost"
                onClick={() => setUpload(true)}
              >
                Tải tệp đầu tiên
              </button>
            }
          >
            Tải một video, ảnh hoặc PDF để chuẩn bị bài học đầu tiên.
          </EmptyState>
        ))
      )}
      {upload && (
        <UploadModal
          connections={storage.data || []}
          onClose={() => setUpload(false)}
          onUploaded={() => {
            setUpload(false);
            setPage(0);
            reload();
          }}
        />
      )}
      {selected && (
        <Modal
          title={selected.originalName}
          onClose={() => {
            setSelected(null);
            setError(null);
          }}
          busy={busy}
        >
          <ErrorNotice error={error} />
          {selected.status === "READY" ? (
            <MediaPreview
              mime={selected.mimeType}
              url={fileUrl(selected.id)}
              name={selected.originalName}
            />
          ) : (
            <p className="info-notice">
              Tệp chưa sẵn sàng. Hãy tải bản mới hoặc thử lại sau.
            </p>
          )}
          <p className="muted">
            {bytes(selected.sizeBytes)} ·{" "}
            {selected.provider === "LOCAL"
              ? "Máy chủ TinyClass"
              : "Google Drive"}
          </p>
          {selected.purpose === "LESSON_ASSET" &&
            selected.status === "READY" && (
              <div className="policy-editor">
                <p>
                  Quyền tải áp dụng cho mọi bài học dùng tệp này. Gia đình vẫn
                  cần được giao bài để truy cập.
                </p>
                <button
                  className="button button-ghost"
                  disabled={busy}
                  onClick={() => void changePolicy(selected)}
                >
                  {selected.learnerDownloadAllowed
                    ? "Chuyển sang chỉ xem"
                    : "Cho phép gia đình tải"}
                </button>
              </div>
            )}
          {selected.status === "READY" && (
            <a
              className="button button-primary"
              href={fileUrl(selected.id, "download")}
            >
              Tải bản gốc
            </a>
          )}
        </Modal>
      )}
    </>
  );
}
export function UploadModal({
  connections,
  onClose,
  onUploaded,
}: {
  connections: StorageConnection[];
  onClose: () => void;
  onUploaded: (file: MediaFile) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [chosen, setChosen] = useState<File | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chosen) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      onUploaded(
        await uploadFile(
          chosen,
          "LESSON_ASSET",
          data.get("allowed") === "on",
          String(data.get("connection") || "") || undefined,
        ),
      );
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Thêm tài liệu mới" onClose={onClose} busy={busy}>
      <form onSubmit={submit}>
        <ErrorNotice error={error} />
        <Field label="Tệp tài liệu">
          <input
            type="file"
            required
            disabled={busy}
            accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.mp3,.wav,.ogg,.mp4,.webm"
            onChange={(event) => setChosen(event.target.files?.[0] || null)}
          />
        </Field>
        {chosen && (
          <p className="muted">
            {chosen.name} · {bytes(chosen.size)}
          </p>
        )}
        <p className="field-hint">
          Ảnh tối đa 10 MB · âm thanh 20 MB · PDF 50 MB · video 200 MB.
        </p>
        <Field label="Nơi lưu">
          <select name="connection" disabled={busy}>
            {connections
              .filter((item) => item.status === "CONNECTED")
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.displayName}
                </option>
              ))}
            {!connections.length && <option value="">Máy chủ TinyClass</option>}
            <option disabled>Google Drive — chưa kết nối</option>
          </select>
        </Field>
        <label className="checkbox-field">
          <input name="allowed" type="checkbox" disabled={busy} />
          <span>Cho phép gia đình tải tệp khi được giao bài</span>
        </label>
        <p className="muted">
          Tải lên kho chưa chia sẻ tệp với gia đình. Bạn sẽ chọn tài liệu khi
          soạn bài.
        </p>
        <div className="form-actions">
          <button
            className="button button-ghost"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Hủy
          </button>
          <button className="button button-primary" disabled={busy || !chosen}>
            {busy ? "Đang tải lên…" : "Lưu tài liệu"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
