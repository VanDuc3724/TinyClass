import { api, apiUrl } from "./api";
export interface MediaFile {
  id: string;
  storageConnectionId: string;
  provider: string;
  purpose: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  learnerDownloadAllowed: boolean;
  version: number;
  createdAt: string;
}
export interface StorageConnection {
  id: string;
  provider: string;
  displayName: string;
  status: string;
  isDefault: boolean;
  usedBytes: number;
  quotaBytes: number;
}
export function bytes(value: number) {
  return value >= 1024 ** 3
    ? `${(value / 1024 ** 3).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} GB`
    : value >= 1024 ** 2
      ? `${(value / 1024 ** 2).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`
      : `${Math.ceil(value / 1024).toLocaleString("vi-VN")} KB`;
}
export async function uploadFile(
  file: File,
  purpose = "LESSON_ASSET",
  allowed = false,
  connection?: string,
) {
  const body = new FormData();
  body.append("file", file);
  body.append("purpose", purpose);
  body.append("learnerDownloadAllowed", String(allowed));
  if (connection) body.append("storageConnectionId", connection);
  return api.upload<MediaFile>("/files", body);
}
export function fileUrl(id: string, action = "content") {
  return apiUrl(`/files/${id}/${action}`);
}
