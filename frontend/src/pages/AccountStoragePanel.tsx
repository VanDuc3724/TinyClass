import { useCallback } from "react";
import { Link } from "react-router-dom";
import { Badge, ErrorNotice, Loading } from "../components/ui";
import { api } from "../lib/api";
import { bytes } from "../lib/files";
import type { StorageConnection } from "../lib/files";
import { useResource } from "../lib/hooks";

export default function AccountStoragePanel() {
  const storage = useResource(
    useCallback(
      (signal) => api.get<StorageConnection[]>("/storage-connections", signal),
      [],
    ),
  );
  return (
    <section id="storage" className="panel details-panel account-storage">
      <h2>Lưu trữ</h2>
      <p className="muted">
        Nơi lưu video, ảnh và tài liệu dùng trong bài học.
      </p>
      <ErrorNotice error={storage.error} retry={storage.reload} />
      {storage.loading && !storage.data ? (
        <Loading />
      ) : (
        storage.data?.map((item) => (
          <div className="storage-setting" key={item.id}>
            <div>
              <strong>{item.displayName}</strong>
              <p className="muted">
                {item.isDefault ? "Kho mặc định · " : ""}
                {bytes(item.usedBytes)} / {bytes(item.quotaBytes)}
              </p>
            </div>
            <Badge status={item.status} />
          </div>
        ))
      )}
      <p className="muted">
        Google Drive chưa được triển khai. Đăng nhập bằng Google và kết nối kho
        Drive là hai thiết lập riêng.
      </p>
      <Link className="text-link" to="/teacher/files">
        Quản lý kho tài liệu →
      </Link>
    </section>
  );
}
