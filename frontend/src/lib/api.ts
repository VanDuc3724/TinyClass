import type { Page } from "./types";

interface Csrf {
  headerName: string;
  token: string;
}
interface ApiFailure {
  code?: string;
  message?: string;
  fieldErrors?: { field: string; message: string }[];
  traceId?: string;
}
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: { field: string; message: string }[];
  readonly traceId?: string;
  constructor(status: number, failure: ApiFailure) {
    super(failure.message || "Không thể hoàn tất yêu cầu. Vui lòng thử lại.");
    this.status = status;
    this.code = failure.code || "REQUEST_FAILED";
    this.fieldErrors = failure.fieldErrors || [];
    this.traceId = failure.traceId;
  }
}
const base = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(
  /\/$/,
  "",
);
let csrf: Promise<Csrf> | undefined;
export function clearCsrf() {
  csrf = undefined;
}
async function csrfToken(): Promise<Csrf> {
  if (!csrf) {
    csrf = fetch(`${base}/auth/csrf`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (response.status === 401)
          window.dispatchEvent(new Event("tinyclass:session-expired"));
        if (!response.ok)
          throw new Error(
            "Không thể chuẩn bị phiên làm việc. Vui lòng tải lại trang.",
          );
        return (await response.json()).data as Csrf;
      })
      .catch((error) => {
        clearCsrf();
        throw error;
      });
  }
  return csrf;
}
async function send<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const multipart = body instanceof FormData;
  if (body !== undefined && !multipart)
    headers["Content-Type"] = "application/json";
  if (method !== "GET") {
    const token = await csrfToken();
    headers[token.headerName] = token.token;
  }
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers,
      credentials: "include",
      cache: "no-store",
      signal,
      body:
        body === undefined
          ? undefined
          : multipart
            ? body
            : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new Error(
      "Không thể kết nối với TinyClass. Vui lòng kiểm tra kết nối rồi thử lại.",
    );
  }
  if (!response.ok) {
    const failure = (await response.json().catch(() => ({}))) as ApiFailure;
    if (
      response.status === 401 &&
      failure.code !== "INVALID_CREDENTIALS" &&
      path !== "/auth/login" &&
      path !== "/auth/me"
    ) {
      clearCsrf();
      window.dispatchEvent(new Event("tinyclass:session-expired"));
    }
    if (response.status === 403) clearCsrf();
    throw new ApiError(response.status, failure);
  }
  return response.json() as Promise<T>;
}
export const api = {
  async upload<T>(
    path: string,
    body: FormData,
    signal?: AbortSignal,
  ): Promise<T> {
    return (await send<{ data: T }>(path, "POST", body, signal)).data;
  },
  async get<T>(path: string, signal?: AbortSignal): Promise<T> {
    return (await send<{ data: T }>(path, "GET", undefined, signal)).data;
  },
  list<T>(path: string, signal?: AbortSignal): Promise<Page<T>> {
    return send<Page<T>>(path, "GET", undefined, signal);
  },
  async post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    return (await send<{ data: T }>(path, "POST", body, signal)).data;
  },
  async patch<T>(path: string, body: unknown): Promise<T> {
    return (await send<{ data: T }>(path, "PATCH", body)).data;
  },
  async put<T>(path: string, body: unknown): Promise<T> {
    return (await send<{ data: T }>(path, "PUT", body)).data;
  },
};
export function apiUrl(path: string) {
  return `${base}${path}`;
}
export function query(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return `?${params.toString()}`;
}
