import { useCallback, useEffect, useRef, useState } from "react";
import { api, apiUrl, query } from "../lib/api";
import type { GameFile } from "../lib/games";
import { useResource } from "../lib/hooks";
import {
  EmptyState,
  ErrorNotice,
  Field,
  Loading,
  Modal,
  Pagination,
} from "../components/ui";
import styles from "./Games.module.css";

export default function GameAssetPicker({
  kind,
  onPick,
  onClose,
}: {
  kind: "image" | "audio";
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState(""),
    [searchTerm, setSearchTerm] = useState(""),
    [page, setPage] = useState(0),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (search.trim() === searchTerm) return;
    const timer = window.setTimeout(() => {
      setSearchTerm(search.trim());
      setPage(0);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, searchTerm]);
  const data = useResource(
    useCallback(
      (signal) =>
        api.list<GameFile>(
          `/files${query({ purpose: "LESSON_ASSET", mediaType: kind, status: "READY", q: searchTerm, page, size: 12 })}`,
          signal,
        ),
      [kind, searchTerm, page],
    ),
  );
  const available = data.data?.data || [];
  async function upload() {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const result = await api.upload<GameFile>(
        "/files?purpose=LESSON_ASSET&learnerDownloadAllowed=false",
        body,
      );
      if (alive.current) {
        if (!result.mimeType.startsWith(kind + "/"))
          throw Error("Chọn đúng loại ảnh hoặc âm thanh.");
        onPick(result.id);
      }
    } catch (failure) {
      if (alive.current) setError(failure);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <Modal
      title={
        kind === "image"
          ? "Chọn ảnh cho trò chơi"
          : "Chọn âm thanh cho trò chơi"
      }
      onClose={onClose}
      busy={busy}
      wide
    >
      <p className="muted">
        Chọn học liệu trong kho của cô hoặc tải một tệp mới.
      </p>
      <Field label="Tìm trong kho">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tên tài liệu"
        />
      </Field>
      <ErrorNotice error={data.error} retry={data.reload} />
      {data.loading && !data.data ? (
        <Loading />
      ) : available.length ? (
        <>
          <div className={styles.assetGrid}>
            {available.map((f) => (
              <button
                type="button"
                className={styles.assetChoice}
                key={f.id}
                onClick={() => onPick(f.id)}
                aria-label={`Dùng ${f.originalName}`}
              >
                {kind === "image" && (
                  <img
                    src={apiUrl(`/files/${f.id}/content`)}
                    alt=""
                    loading="lazy"
                  />
                )}
                <strong>{f.originalName}</strong>
                <small>{Math.ceil(f.sizeBytes / 1024)} KB</small>
              </button>
            ))}
          </div>
          {data.data && <Pagination meta={data.data.meta} onChange={setPage} />}
        </>
      ) : data.data && !data.error ? (
        <EmptyState title="Chưa có tệp phù hợp">
          Bạn có thể tải tệp bên dưới.
        </EmptyState>
      ) : null}
      <div className={styles.section}>
        <Field label={kind === "image" ? "Tải ảnh mới" : "Tải âm thanh mới"}>
          <input
            type="file"
            accept={
              kind === "image"
                ? "image/png,image/jpeg,image/gif,image/webp"
                : "audio/mpeg,audio/ogg,audio/wav,.wav"
            }
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={busy}
          />
        </Field>
        <ErrorNotice error={error} />
        <button
          type="button"
          className="button button-primary"
          onClick={upload}
          disabled={!file || busy}
        >
          {busy ? "Đang tải…" : "Tải lên và chọn"}
        </button>
      </div>
    </Modal>
  );
}
