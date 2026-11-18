import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

async function login(page: Page, email: string, password: string, role = "teacher") {
  await page.goto("/login");
  await page.getByLabel("Địa chỉ email").fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${role}$`));
}
async function data<T>(page: Page, path: string): Promise<T> {
  const response = await page.request.get(`/api/v1${path}`);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).data;
}
async function post<T>(page: Page, path: string, body: unknown, expected = 200): Promise<T> {
  const csrf = await data<{ headerName: string; token: string }>(page, "/auth/csrf");
  const response = await page.request.post(`/api/v1${path}`, {
    headers: { [csrf.headerName]: csrf.token },
    data: body,
  });
  expect(response.status(), await response.text()).toBe(expected);
  return (await response.json()).data;
}
const navigation = (page: Page) => page.locator('nav[aria-label="Điều hướng chính"]');
async function currentSection(page: Page, name: string) {
  const link = navigation(page).getByRole("link", { name, exact: true });
  await expect(link).toHaveClass(/\bactive\b/);
  await expect(link).toHaveAttribute("aria-current", "page");
  await expect(navigation(page).locator('a[aria-current="page"]')).toHaveCount(1);
}

export function registerUiNavigationFlows(email: string, password: string) {
  test("điều hướng đánh dấu đúng mục trên trang điểm danh và kết quả trò chơi", async ({ page }) => {
    await login(page, email, password);
    await expect(page.locator(".sidebar").getByRole("link", { name: "Cài đặt" })).toBeInViewport();
    expect(await page.locator(".sidebar").evaluate((sidebar) => sidebar.scrollHeight - sidebar.clientHeight)).toBeLessThanOrEqual(1);
    const dashboard = await data<{ businessDate: string }>(page, "/dashboard");
    const day = (offset: number) => new Date(Date.parse(`${dashboard.businessDate}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
    const sessions = await data<{ id: string; status: string }[]>(page, `/sessions?from=${day(-30)}&to=${day(30)}&size=100`);
    const session = sessions.find((row) => row.status !== "CANCELLED");
    expect(session, "Các luồng lịch/điểm danh trước đó đã tạo buổi học").toBeTruthy();
    await page.goto(`/teacher/sessions/${session!.id}/attendance`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await currentSection(page, "Điểm danh");
    await expect(navigation(page).getByRole("link", { name: "Lịch dạy", exact: true })).not.toHaveAttribute("aria-current", "page");

    const assignments = await data<{ id: string }[]>(page, "/game-assignments?size=1");
    expect(assignments).toHaveLength(1);
    await page.goto(`/teacher/game-assignments/${assignments[0].id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await currentSection(page, "Kho trò chơi");
    await page.goto("/teacher/game-assignments");
    await currentSection(page, "Kho trò chơi");
  });

  test("đổi màn hình chờ lazy rồi cuộn đầu và focus, query/hash giữ vị trí đang làm việc", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 640 });
    await login(page, email, password);
    const main = page.locator("#main-content");
    await expect(page.getByRole("heading", { name: /^Xin chào,/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Học sinh đang học", exact: true })).toBeVisible();
    await expect(main).toBeFocused();
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: "instant" }));
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);

    const chunk = /\/assets\/ClassPages-[^/]+\.js(?:\?.*)?$/;
    let releaseChunk: () => void = () => {};
    const gate = new Promise<void>((resolve) => { releaseChunk = resolve; });
    await page.route(chunk, async (route) => { await gate; await route.continue(); });
    try {
      const requested = page.waitForRequest(chunk);
      await navigation(page).getByRole("link", { name: "Lớp học", exact: true }).click();
      await requested;
      // Router transitions keep the previous screen usable while the next chunk is pending.
      await expect(main.getByRole("heading", { name: /^Xin chào,/ })).toBeVisible();
      await expect(main).not.toBeFocused();
    } finally {
      releaseChunk();
    }
    await expect(page.getByRole("heading", { name: "Lớp học", exact: true })).toBeVisible();
    await expect(page.locator(".class-grid")).toBeVisible();
    await expect(main).toBeFocused();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);

    const search = page.getByLabel("Tìm lớp học", { exact: true });
    await page.evaluate(() => window.scrollTo({ top: 250, behavior: "instant" }));
    const before = await page.evaluate(() => scrollY);
    expect(before).toBeGreaterThan(100);
    await search.evaluate((element: HTMLInputElement) => {
      element.focus({ preventScroll: true });
      element.form!.requestSubmit();
    });
    await expect(page).toHaveURL(/page=0/);
    await expect(search).toBeFocused();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(before);
    await page.evaluate(() => { location.hash = "navigation-check"; });
    await expect(page).toHaveURL(/#navigation-check$/);
    await expect(search).toBeFocused();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(before);

    await page.setViewportSize({ width: 390, height: 844 });
    const menu = page.getByRole("button", { name: "Mở menu", exact: true });
    await menu.click();
    await expect(page.getByRole("dialog", { name: "Điều hướng chính", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
    await menu.click();
    await navigation(page).getByRole("link", { name: "Học sinh", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Hồ sơ các bé", exact: true })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Điều hướng chính", exact: true })).not.toBeVisible();
    await expect(main).toBeFocused();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  });

  test("gia đình giữ mục Bài của con trên chi tiết bài giao và bài học", async ({ page }) => {
    const parentEmail = "ui-learning@example.test";
    await login(page, email, password);
    // Give the existing verified parent a fresh child and direct assignment; older flows revoke their own links.
    const child = await post<{ id: string }>(page, "/students", { fullName: "Bé kiểm thử điều hướng" }, 201);
    const invitation = await post<{ inviteUrl: string }>(page, `/students/${child.id}/guardian-invitations`, { email: parentEmail }, 201);
    const lesson = await post<{ id: string }>(page, "/lessons", {
      title: "Bài học kiểm thử điều hướng",
      defaultCompletionMode: "PARENT_CONFIRM",
      defaultResponseTypes: [],
      topicIds: [],
      blocks: [{ type: "TEXT", textContent: "Cùng bé gọi tên một màu con yêu thích." }],
    }, 201);
    await post(page, `/lessons/${lesson.id}/publish`, { version: 0 });
    const created = await post<{ id: string }>(page, "/assignments", {
      title: "Hoạt động kiểm thử điều hướng",
      sourceType: "LESSON",
      lessonId: lesson.id,
      targetType: "STUDENT",
      studentId: child.id,
      availableAt: new Date(Date.now() - 60_000).toISOString(),
      clientRequestId: randomUUID(),
    }, 201);
    await post(page, `/assignments/${created.id}/publish`, { version: 0 });
    await post(page, "/auth/logout", {});
    await login(page, parentEmail, "Synthetic-learning-parent-2026", "family");
    const token = new URLSearchParams(new URL(invitation.inviteUrl).hash.slice(1)).get("token");
    expect(token).toBeTruthy();
    await post(page, "/guardian-invitations/accept", { token, relationshipLabel: "Mẹ" });
    const childId = child.id, assignmentId = created.id;
    await page.goto(`/family/children/${childId}`);
    await expect(page.getByRole("heading", { name: "Bé kiểm thử điều hướng", exact: true })).toBeVisible();
    await currentSection(page, "Trang chủ");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("navigation", { name: "Điều hướng gia đình", exact: true })
      .getByRole("link", { name: "Trang chủ", exact: true })).toHaveAttribute("aria-current", "page");
    const familyMenu = page.getByRole("button", { name: "Mở menu", exact: true });
    const drawer = page.getByRole("dialog", { name: "Điều hướng chính", exact: true });
    await familyMenu.click();
    await drawer.getByRole("link", { name: "Góc chơi của bé", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/family/children/${childId}/games$`));
    await expect(page.getByRole("heading", { name: "Góc chơi của bé", exact: true })).toBeVisible();
    await expect(drawer).not.toBeVisible();
    await familyMenu.click();
    await drawer.getByRole("link", { name: "Nhận xét & tiến bộ", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/family/children/${childId}/progress$`));
    await expect(page.getByRole("heading", { name: "Hành trình của Bé kiểm thử điều hướng", exact: true })).toBeVisible();
    await expect(drawer).not.toBeVisible();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/family/children/${childId}/learning`);
    await expect(page.getByRole("heading", { name: "Góc học của bé", exact: true })).toBeVisible();
    await currentSection(page, "Bài của con");
    await page.goto(`/family/children/${childId}/learning/assignments/${assignmentId}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await currentSection(page, "Bài của con");
    await page.setViewportSize({ width: 390, height: 844 });
    const bottom = page.getByRole("navigation", { name: "Điều hướng gia đình", exact: true });
    await expect(bottom.getByRole("link", { name: "Bài của con", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(bottom.locator('a[aria-current="page"]')).toHaveCount(1);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const assignment = await data<{ items: { id: string }[] }>(page, `/family/children/${childId}/assignments/${assignmentId}`);
    expect(assignment.items.length).toBeGreaterThan(0);
    await page.goto(`/family/children/${childId}/learning/items/${assignment.items[0].id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(navigation(page)).toBeHidden();
    await expect(page.getByRole("link", { name: "Về góc gia đình", exact: true })).toBeVisible();

    await page.setViewportSize({ width: 320, height: 780 });
    await page.goto(`/family/children/${childId}`);
    await page.getByRole("link", { name: "Mở góc của bé", exact: true }).click();
    await expect(page).toHaveURL(/\/kids$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/kids$/);
    await expect(page.getByRole("heading", { name: "Chào Bé kiểm thử điều hướng!", exact: true })).toBeVisible();
    const choices = page.getByRole("navigation", { name: "Học và chơi" });
    await expect(choices.getByRole("link")).toHaveCount(2);
    for (const link of await choices.getByRole("link").all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(56);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await expect(page.getByRole("navigation", { name: "Điều hướng gia đình" })).toHaveCount(0);
    await page.screenshot({ path: "test-results/child-corner-320.png" });
    await choices.getByRole("link", { name: "Học bài", exact: true }).click();
    await expect(page).toHaveURL(/\/learning\?kid=1$/);
    await expect(page.getByLabel(/menu tài khoản$/i)).toHaveCount(0);
    const activity = page.getByRole("link").filter({ hasText: "Hoạt động kiểm thử điều hướng" });
    await activity.click();
    await expect(page).toHaveURL(/\/learning\/assignments\/[^?]+\?kid=1$/);
    await page.locator(`a[href*="/learning/items/${assignment.items[0].id}"]`).first().click();
    await expect(page).toHaveURL(/\/learning\/items\/[^?]+\?kid=1$/);
    await expect(page.getByRole("heading", { name: "Bài học kiểm thử điều hướng", exact: true })).toBeVisible();
    await expect(page.getByText("Cùng bé gọi tên một màu con yêu thích.", { exact: true })).toBeVisible();
    const confirm = page.getByRole("button", { name: "Xác nhận đã hoàn thành", exact: true });
    await expect(confirm).toBeHidden();
    await page.screenshot({ path: "test-results/child-lesson-320.png" });
    await page.getByText("Nhờ người lớn xác nhận", { exact: true }).click();
    await expect(confirm).toBeDisabled();
    await page.getByRole("checkbox", { name: "Tôi đã cùng bé thực hiện hoạt động này.", exact: true }).check();
    await confirm.click();
    await expect(page.getByRole("heading", { name: "Mình đã hoàn thành hoạt động!", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Về góc học", exact: true }).click();
    await expect(page).toHaveURL(/\/learning\?kid=1$/);
    await page.getByRole("link", { name: "Về góc của bé", exact: true }).click();
    await page.goto(`/family/children/${childId}/invoices`);
    await expect(page).toHaveURL(/\/kids$/);
    await expect(page.getByLabel(/menu tài khoản$/i)).toHaveCount(0);
    const exit = page.getByRole("button", { name: "Về trang phụ huynh", exact: true });
    const gate = page.getByRole("dialog", { name: "Nhờ người lớn xác nhận", exact: true });
    await exit.click();
    await gate.getByRole("button", { name: "Ở lại góc của bé", exact: true }).click();
    await expect(gate).toBeHidden();
    await expect(exit).toBeFocused();
    await exit.click();
    const answer = gate.getByRole("textbox", { name: /^Kết quả của/ });
    const prompt = gate.locator("label");
    const confirmExit = gate.getByRole("button", { name: "Xác nhận", exact: true });
    const sum = (text: string) => {
      const [, first, second] = text.match(/(\d+) \+ (\d+)/)!;
      return String(Number(first) + Number(second));
    };
    const originalPrompt = await prompt.innerText();
    await answer.fill("0");
    await confirmExit.click();
    await expect(gate.getByRole("alert")).toContainText("Vui lòng giải phép tính mới");
    await expect(prompt).not.toHaveText(originalPrompt);
    await expect(answer).toHaveValue("");
    await expect(answer).toBeFocused();
    const secondPrompt = await prompt.innerText();
    await answer.fill(sum(originalPrompt));
    await confirmExit.click();
    await expect(prompt).not.toHaveText(secondPrompt);
    await expect(answer).toHaveValue("");
    await expect(answer).toBeFocused();
    await expect(page).toHaveURL(/\/kids$/);
    await answer.fill(sum(await prompt.innerText()));
    await confirmExit.click();
    await expect(page).toHaveURL(new RegExp(`/family/children/${childId}$`));
    await expect(page.getByLabel(/menu tài khoản$/i)).toBeVisible();

    await page.goto(`/family/children/${randomUUID()}/kids`);
    await expect(page.getByRole("heading", { name: "Góc này chưa mở được" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Học và chơi" })).toHaveCount(0);
  });
}
