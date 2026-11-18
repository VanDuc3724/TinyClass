import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";

export function registerUiStateFlows(email: string, password: string) {
  async function login(page: Page) {
    await page.goto("/login");
    await page.getByLabel("Địa chỉ email").fill(email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL(/\/teacher$/);
  }

  test("ô tìm lớp và học sinh theo đúng bộ lọc khi Back và Forward", async ({ page }) => {
    await login(page);
    for (const [path, label] of [
      ["classes", "Tìm lớp học"],
      ["students", "Tìm học sinh"],
    ]) {
      await page.goto(`/teacher/${path}`);
      const search = page.getByRole("textbox", { name: label, exact: true });
      await search.fill("ui-history-a");
      await search.press("Enter");
      await expect(page).toHaveURL(/q=ui-history-a/);
      await search.fill("ui-history-b");
      await search.press("Enter");
      await expect(page).toHaveURL(/q=ui-history-b/);

      await page.goBack();
      await expect(page).toHaveURL(/q=ui-history-a/);
      await expect(search).toHaveValue("ui-history-a");
      await search.fill("ui-history-unsent-draft");
      await page.goForward();
      await expect(page).toHaveURL(/q=ui-history-b/);
      await expect(search).toHaveValue("ui-history-b");
      await page.goBack();
      await expect(page).toHaveURL(/q=ui-history-a/);
      await expect(search).toHaveValue("ui-history-a");
    }
  });

  test("xác nhận bỏ bản nháp giữ focus trên trang và trong hộp thoại", async ({ page }) => {
    await login(page);
    await page.goto("/teacher/classes/new");
    const name = page.getByLabel("Tên lớp", { exact: true });
    const back = page.getByRole("link", { name: /Trở về lớp học/ });
    const confirm = page.getByRole("dialog", { name: "Bỏ thay đổi chưa lưu?" });
    await name.fill("Bản nháp chưa lưu");
    await back.press("Enter");
    await expect(confirm.getByRole("button", { name: "Tiếp tục chỉnh sửa" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(confirm).toHaveCount(0);
    await expect(back).toBeFocused();
    await expect(name).toHaveValue("Bản nháp chưa lưu");
    await back.click();
    await confirm.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
    await expect(page).toHaveURL(/\/teacher\/classes$/);
    await expect(page.getByRole("heading", { name: "Lớp học", exact: true })).toBeVisible();
    await expect(confirm).toHaveCount(0);

    await page.goto("/teacher/announcements");
    await page.getByRole("button", { name: "Soạn thông báo", exact: true }).click();
    const editor = page.getByRole("dialog", { name: "Soạn thông báo" });
    const title = editor.getByRole("textbox", { name: "Tiêu đề" });
    await title.fill("Thông báo chưa lưu");
    await page.keyboard.press("Escape");
    await expect(confirm).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(title).toHaveValue("Thông báo chưa lưu");
    await expect(title).toBeFocused();
    await page.keyboard.press("Escape");
    await confirm.getByRole("button", { name: "Bỏ thay đổi", exact: true }).click();
    await expect(editor).toHaveCount(0);
    await expect(confirm).toHaveCount(0);
  });

  test("lỗi tải thư viện và bộ chọn tệp không bị hiển thị như kho rỗng", async ({ page }) => {
    await login(page);
    const fail = (route: Route) => route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ code: "TEST_UNAVAILABLE", message: "Lỗi tải giả lập cho kiểm thử." }),
    });
    const lessons = /\/api\/v1\/lessons(?:\?|$)/;
    const topics = /\/api\/v1\/topics(?:\?|$)/;
    await page.route(lessons, fail);
    await page.route(topics, fail);
    await page.goto("/teacher/library");
    await expect(page.getByRole("alert")).toContainText("Lỗi tải giả lập");
    await expect(page.getByText("Đang tải dữ liệu…", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Một bài học mới đang chờ", exact: true })).toHaveCount(0);
    await page.getByRole("tab", { name: "Chủ đề", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Lỗi tải giả lập");
    await expect(page.getByRole("heading", { name: "Thêm chủ đề đầu tiên", exact: true })).toHaveCount(0);
    await page.unroute(lessons, fail);
    await page.unroute(topics, fail);
    await page.getByRole("button", { name: "Thử lại", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);

    const files = /\/api\/v1\/files(?:\?|$)/;
    await page.route(files, fail);
    await page.goto("/teacher/games/new");
    await page.getByRole("button", { name: "Chọn ảnh câu 1", exact: true }).click();
    const picker = page.getByRole("dialog");
    await expect(picker.getByRole("alert")).toContainText("Lỗi tải giả lập");
    await expect(picker.getByRole("heading", { name: "Chưa có tệp phù hợp", exact: true })).toHaveCount(0);
    await page.unroute(files, fail);
    await picker.getByRole("button", { name: "Thử lại", exact: true }).click();
    await expect(picker.getByRole("alert")).toHaveCount(0);
    await picker.getByRole("button", { name: "Đóng", exact: true }).click();
  });

  test("lỗi tên trò chơi từ máy chủ giữ bản nhập và đưa focus về trường lỗi", async ({ page }) => {
    await login(page);
    await page.goto("/teacher/games/new");
    const title = page.getByRole("textbox", { name: "Tên trò chơi", exact: true });
    // Whitespace passes native required validation; the server rejects it as blank.
    await title.fill("   ");
    await page.getByRole("button", { name: "Lưu bản nháp", exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(title).toHaveValue("   ");
    await expect(title).toHaveAttribute("aria-invalid", "true");
    await expect(title).toBeFocused();
    await expect(title).toBeInViewport();
    expect(await title.evaluate((input) =>
      (input.getAttribute("aria-describedby") || "").split(/\s+/).some((id) =>
        !!document.getElementById(id)?.textContent?.trim(),
      ),
    )).toBe(true);
  });
}
