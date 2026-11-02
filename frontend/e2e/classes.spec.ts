import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { registerFamilyFlows } from "./family.flows";
import { registerGoogleFlows } from "./google.flows";
import { registerLearningFlows } from "./learning.flows";
import { registerDesignFlows } from "./design.flows";

const email = "ui-teacher@example.test";
const password = "E2e-synthetic-password-2026";
const childName = "Nguyễn An Nhiên (demo)";
const className = "Mầm Xanh (demo)";
test.describe.configure({ mode: "serial" });
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Địa chỉ email").fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/teacher$/);
}

test("khởi tạo giáo viên, đăng nhập, tải lại và đăng xuất bằng session thật", async ({
  page,
}) => {
  await page.goto("/setup");
  await page.getByLabel("Tên giáo viên").fill("Cô Lan (dữ liệu kiểm thử)");
  await page.getByLabel("Địa chỉ email").fill(email);
  await page.getByLabel("Mật khẩu").fill(password);
  await page
    .getByLabel("Mã khởi tạo")
    .fill("e2e-only-setup-key-0123456789-abcdef");
  await page.getByRole("button", { name: "Tạo không gian của tôi" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Xin chào, Cô Lan (dữ liệu kiểm thử)!" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Một lớp học mới đang chờ bạn" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Xin chào, Cô Lan (dữ liệu kiểm thử)!" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Một lớp học mới đang chờ bạn" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-empty-desktop.png",
    fullPage: true,
  });
  await page.getByLabel("Menu tài khoản", { exact: true }).click();
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect((await page.request.get("/api/v1/classes")).status()).toBe(401);
});

test("tạo lớp, thêm hồ sơ, rời/quay lại và đọc lịch sử bằng API thật", async ({
  page,
}) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  await login(page);
  await page.goto("/teacher/classes/new");
  await page.getByLabel("Tên lớp", { exact: true }).fill(className);
  await page
    .getByLabel("Giới thiệu ngắn")
    .fill("Lớp khám phá màu sắc và những điều nhỏ xung quanh bé.");
  await page.getByLabel("Sĩ số tối đa").fill("2");
  await page.getByLabel("Địa điểm").fill("Phòng học thử nghiệm");
  await page.getByLabel("Tuổi tối thiểu").fill("36");
  await page.getByLabel("Tuổi tối đa").fill("60");
  await page.getByRole("button", { name: "Tạo lớp học", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: className, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mở lớp", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Mở lớp", exact: true })
    .click();
  await expect(
    page.locator(".class-detail-hero").getByText("Đang dạy", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Thêm bé vào lớp", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Tạo hồ sơ mới" })
    .click();
  await page.getByLabel("Họ và tên bé").fill(childName);
  await page.getByLabel("Tên gọi ở nhà").fill("Bông");
  await page.getByLabel("Ngày sinh").fill("2022-04-08");
  await page
    .getByLabel("Ghi chú riêng")
    .fill("Ghi chú nội bộ — hoàn toàn là dữ liệu giả.");
  await page.getByRole("button", { name: "Lưu hồ sơ" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Thêm vào lớp", exact: true })
    .click();
  const row = page.getByRole("row").filter({ hasText: childName });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Rời lớp", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Lý do")
    .fill("Gia đình tạm nghỉ — kiểm thử");
  await page.getByRole("button", { name: "Xác nhận rời lớp" }).click();
  await expect(row.getByText("Đã rời lớp")).toBeVisible();
  await row.getByRole("button", { name: "Quay lại", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Lý do")
    .fill("Bé quay lại — kiểm thử");
  await page.getByRole("button", { name: "Xác nhận quay lại" }).click();
  await expect(row.getByText("Đang hoạt động")).toBeVisible();
  await row.getByRole("button", { name: `Lịch sử của ${childName}` }).click();
  await expect(
    page.getByRole("dialog").getByText("Gia đình tạm nghỉ — kiểm thử"),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("Bé quay lại — kiểm thử"),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Đóng", exact: true })
    .click();
  await page.reload();
  await expect(row).toBeVisible();
  await page.screenshot({
    path: "test-results/class-desktop.png",
    fullPage: true,
  });
  expect(runtimeErrors).toEqual([]);
});

test("điều hướng mobile 390px, hồ sơ riêng và hết phiên quay về đăng nhập", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.getByRole("button", { name: "Mở menu" }).click();
  await page.getByRole("link", { name: "Học sinh", exact: true }).click();
  await page.getByRole("link", { name: childName, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: childName, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Ghi chú nội bộ — hoàn toàn là dữ liệu giả."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/student-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 360, height: 780 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const token = (await (await page.request.get("/api/v1/auth/csrf")).json())
    .data;
  await page.request.post("/api/v1/auth/logout", {
    headers: { [token.headerName]: token.token },
    data: {},
  });
  await page.getByRole("button", { name: "Mở menu" }).click();
  await page.getByRole("link", { name: "Lớp học", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByText("Phiên làm việc đã kết thúc. Vui lòng đăng nhập lại."),
  ).toBeVisible();
});

registerFamilyFlows(email, password, childName, className);
registerGoogleFlows(email, password, childName);
registerLearningFlows(email, password, childName, className);
registerDesignFlows(email, password, childName, className);
