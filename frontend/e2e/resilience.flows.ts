import { expect, test } from "@playwright/test";

export function registerResilienceFlows(email: string, password: string) {
  test("lỗi tải màn hình giữ menu, đổi trang và tải lại khôi phục được", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Địa chỉ email").fill(email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL(/\/teacher$/);
    const navigation = page.getByRole("navigation", { name: "Điều hướng chính" });

    await page.route(/\/assets\/NotificationPage-[^/]+\.js(?:\?.*)?$/, (route) =>
      route.abort("failed"),
    );
    await navigation.getByRole("link", { name: "Cập nhật của bạn", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Không thể mở trang này");
    await expect(navigation).toBeVisible();
    await page.screenshot({ path: "test-results/ui-page-error-desktop.png", fullPage: true });

    await navigation.getByRole("link", { name: "Tổng quan", exact: true }).click();
    await expect(page.getByRole("heading", { name: /^Xin chào,/ })).toBeVisible();
    await expect(page.getByText("Không thể mở trang này")).toHaveCount(0);

    await page.unroute(/\/assets\/NotificationPage-[^/]+\.js(?:\?.*)?$/);
    await navigation.getByRole("link", { name: "Cập nhật của bạn", exact: true }).click();
    // React.lazy caches a rejected import for this document; a reload starts a fresh one.
    await page.getByRole("button", { name: "Tải lại trang", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Cập nhật của bạn", exact: true })).toBeVisible();
    await expect(navigation).toBeVisible();
  });

  test("màn hình công khai báo lỗi tải trang và có thể tải lại", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.route(/\/assets\/PasswordPages-[^/]+\.js(?:\?.*)?$/, (route) =>
      route.abort("failed"),
    );
    await page.goto("/forgot-password");
    await expect(page.getByRole("alert")).toContainText("Không thể mở trang này");
    await page.screenshot({ path: "test-results/ui-page-error-mobile.png", fullPage: true });
    await page.unroute(/\/assets\/PasswordPages-[^/]+\.js(?:\?.*)?$/);
    await page.getByRole("button", { name: "Tải lại trang", exact: true }).click();
    await expect(page.getByLabel("Địa chỉ email")).toBeVisible();
    await expect(page.getByText("Không thể mở trang này")).toHaveCount(0);
  });
}
