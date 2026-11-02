import { api } from "./api";
export type GoogleIntent = "LOGIN" | "REGISTER" | "LINK" | "REAUTHENTICATE";
export async function startGoogle(
  intent: GoogleIntent,
  invitationToken?: string,
  displayName?: string,
) {
  const response = await api.post<{ authorizationUrl: string }>(
    "/auth/google/start",
    { intent, invitationToken, displayName },
  );
  if (response.authorizationUrl !== "/api/v1/auth/google/authorize")
    throw new Error("Địa chỉ xác thực chưa hợp lệ. Vui lòng thử lại.");
  window.location.assign(response.authorizationUrl);
}
