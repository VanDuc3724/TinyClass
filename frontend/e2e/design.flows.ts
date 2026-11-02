import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

async function login(
  page: Page,
  email: string,
  password: string,
  root: string,
) {
  await page.goto("/login");
  await page.getByLabel("Địa chỉ email").fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${root}$`));
}
async function post(request: APIRequestContext, path: string, data: unknown) {
  const csrf = (await (await request.get("/api/v1/auth/csrf")).json()).data;
  return request.post(`/api/v1${path}`, {
    headers: { [csrf.headerName]: csrf.token },
    data,
  });
}
async function ready(page: Page) {
  await expect(
    page.getByText("Đang tải dữ liệu…", { exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('16px "Nunito"'))).toBe(
    true,
  );
}
async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}
export function registerDesignFlows(
  email: string,
  password: string,
  childName: string,
  className: string,
) {
  test("dashboard dùng dữ liệu cùng lớp, đủ sáu breakpoint và các trang không tràn ngang", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    await login(page, email, password, "/teacher");
    await expect(
      page.getByRole("region", { name: "Học sinh đang học", exact: true }),
    ).toBeVisible();
    const all = (await (await page.request.get("/api/v1/dashboard")).json())
      .data;
    const selected = all.classOptions.find(
      (c: { name: string }) => c.name === className,
    );
    await page
      .getByLabel("Phạm vi thống kê", { exact: true })
      .selectOption(selected.id);
    await expect(page).toHaveURL(new RegExp(`classId=${selected.id}`));
    const scoped = (
      await (
        await page.request.get(`/api/v1/dashboard?classId=${selected.id}`)
      ).json()
    ).data;
    await expect(
      page
        .getByRole("region", { name: "Học sinh đang học", exact: true })
        .locator("strong"),
    ).toHaveText(String(scoped.students));
    await expect(
      page
        .getByRole("region", { name: "Bài đã chia sẻ", exact: true })
        .locator("strong"),
    ).toHaveText(String(scoped.publishedLessons));
    await page.reload();
    await expect(
      page.getByLabel("Phạm vi thống kê", { exact: true }),
    ).toHaveValue(selected.id);
    await page
      .getByRole("region", { name: "Bài đã chia sẻ", exact: true })
      .waitFor();
    await page.getByLabel("Phạm vi thống kê", { exact: true }).selectOption("");
    await page
      .getByRole("region", { name: "Bài đã xuất bản", exact: true })
      .waitFor();
    await ready(page);
    for (const width of [320, 375, 768, 1024, 1280, 1536]) {
      await page.setViewportSize({ width, height: 1000 });
      await fits(page);
      if (width >= 1200) {
        await expect(page.locator(".sidebar")).toBeVisible();
        expect(
          Math.round((await page.locator(".sidebar").boundingBox())!.width),
        ).toBe(264);
      } else
        await expect(
          page.getByRole("button", { name: "Mở menu" }),
        ).toBeVisible();
      await page.screenshot({
        path: `test-results/design-dashboard-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
    for (const width of [375, 1280]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const route of [
        "classes",
        "students",
        "files",
        "library",
        "assignments",
        "account",
        "classes/new",
        "students/new",
        "library/lessons/new",
        "library/courses/new",
        "assignments/new",
      ]) {
        await page.goto(`/teacher/${route}`);
        await expect(page.locator("main h1")).toBeVisible();
        await ready(page);
        await fits(page);
        await expect(page.getByRole("alert")).toHaveCount(0);
        if (!route.includes("/"))
          await page.screenshot({
            path: `test-results/design-${route}-${width}.png`,
            fullPage: true,
            animations: "disabled",
          });
      }
    }
    expect(runtimeErrors).toEqual([]);
  });

  test("drawer giữ focus, Escape trả focus, tự đóng khi desktop; tabs và retry dùng bàn phím", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await login(page, email, password, "/teacher");
    const trigger = page.getByRole("button", { name: "Mở menu" });
    await trigger.click();
    const drawer = page.getByRole("dialog", { name: "Điều hướng chính" });
    await expect(drawer).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe(
      "hidden",
    );
    await drawer.getByRole("link", { name: "Cài đặt", exact: true }).focus();
    await page.keyboard.press("Tab");
    expect(
      await drawer.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
    await trigger.click();
    await page.setViewportSize({ width: 1280, height: 1000 });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
    await page.getByLabel("Menu tài khoản", { exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Đăng xuất", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByLabel("Menu tài khoản", { exact: true }),
    ).toBeFocused();
    await expect(
      page.getByRole("button", { name: "Đăng xuất", exact: true }),
    ).not.toBeVisible();
    await page.goto("/teacher/library");
    await page.getByRole("tab", { name: "Bài học", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("tab", { name: "Khóa học", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("End");
    await expect(
      page.getByRole("tab", { name: "Chủ đề", exact: true }),
    ).toBeFocused();
    await page
      .getByRole("button", { name: "Thêm chủ đề", exact: true })
      .click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Thêm chủ đề", exact: true }),
    ).toBeFocused();
    await page.route("**/api/v1/classes?*", (route) => route.abort());
    await page.goto("/teacher/classes");
    await expect(page.getByRole("alert")).toBeVisible();
    await page.unroute("**/api/v1/classes?*");
    await page.getByRole("button", { name: "Thử lại", exact: true }).click();
    await expect(
      page.getByRole("link", { name: className, exact: false }),
    ).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.setViewportSize({ width: 375, height: 900 });
    await page.getByRole("button", { name: "Bộ lọc", exact: true }).click();
    await page
      .getByLabel("Trạng thái lớp", { exact: true })
      .selectOption("ACTIVE");
    await page.getByRole("link", { name: className, exact: false }).click();
    await expect(
      page.getByRole("heading", { name: className, exact: true }),
    ).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/status=ACTIVE/);
    await page.getByRole("button", { name: /^Bộ lọc/ }).click();
    await expect(
      page.getByLabel("Trạng thái lớp", { exact: true }),
    ).toHaveValue("ACTIVE");
    await page.getByRole("button", { name: "Xóa bộ lọc", exact: true }).click();
    await expect(
      page.getByLabel("Trạng thái lớp", { exact: true }),
    ).toHaveValue("");
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.route("**/api/v1/files/*/content", (route) => route.abort());
    await page.goto("/teacher/files");
    await expect(
      page.getByRole("img", { name: "Không tải được ảnh", exact: true }),
    ).toBeVisible();
    await page.unroute("**/api/v1/files/*/content");
    await fits(page);
    await page.screenshot({
      path: "test-results/design-image-fallback.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.goto("/teacher/classes");
    await page.setViewportSize({ width: 768, height: 500 });
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    await fits(page);
    await page.screenshot({
      path: "test-results/design-zoom-200.png",
      fullPage: true,
      animations: "disabled",
    });
  });

  test("gia đình đổi bé không hiện bài cũ, thanh dưới và góc học dùng được ở 320px", async ({
    page,
    browser,
  }) => {
    const parentEmail = "ui-learning@example.test",
      parentPassword = "Synthetic-learning-parent-2026";
    const secondName = "Bé thứ hai (dữ liệu kiểm thử thiết kế)";
    await login(page, email, password, "/teacher");
    const first = (
      await (await page.request.get("/api/v1/students?size=100")).json()
    ).data.find((s: { fullName: string }) => s.fullName === childName);
    const created = await post(page.request, "/students", {
      fullName: secondName,
    });
    expect(created.status()).toBe(201);
    const second = (await created.json()).data;
    const invited = await post(
      page.request,
      `/students/${second.id}/guardian-invitations`,
      { email: parentEmail },
    );
    expect(invited.status()).toBe(201);
    const inviteUrl = (await invited.json()).data.inviteUrl;
    const context = await browser.newContext({
      viewport: { width: 320, height: 780 },
      reducedMotion: "reduce",
    });
    try {
      const parent = await context.newPage();
      await login(parent, parentEmail, parentPassword, "/family");
      await parent.goto(inviteUrl);
      await parent
        .getByRole("button", { name: "Nhận lời mời", exact: true })
        .click();
      await expect(parent).toHaveURL(
        new RegExp(`/family/children/${second.id}$`),
      );
      await parent
        .getByLabel("Chọn bé", { exact: true })
        .selectOption(first.id);
      await parent
        .getByRole("navigation", { name: "Điều hướng gia đình" })
        .getByRole("link", { name: "Bài của con", exact: true })
        .click();
      await expect(
        parent.getByRole("heading", { name: "Góc học của bé", exact: true }),
      ).toBeVisible();
      await expect(
        parent.getByText("Cùng con tìm ba màu (demo)", { exact: true }),
      ).toBeVisible();
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await parent.route(
        `**/api/v1/family/children/${second.id}/assignments?*`,
        async (route) => {
          await gate;
          await route.continue();
        },
        { times: 1 },
      );
      try {
        await parent
          .getByLabel("Chọn bé", { exact: true })
          .selectOption(second.id);
        await expect(parent).toHaveURL(
          new RegExp(`/children/${second.id}/learning$`),
        );
        await expect(
          parent.getByText("Cùng con tìm ba màu (demo)", { exact: true }),
        ).toHaveCount(0);
      } finally {
        release();
      }
      await expect(
        parent.getByRole("heading", {
          name: "Những khám phá đang được chuẩn bị",
          exact: true,
        }),
      ).toBeVisible();
      await fits(parent);
      await ready(parent);
      await parent.screenshot({
        path: "test-results/design-family-switch-320.png",
        fullPage: true,
        animations: "disabled",
      });
      await parent.locator("footer").scrollIntoViewIfNeeded();
      const footer = (await parent.locator("footer").boundingBox())!,
        bottom = (await parent
          .getByRole("navigation", { name: "Điều hướng gia đình" })
          .boundingBox())!;
      expect(footer.y + footer.height).toBeLessThanOrEqual(bottom.y + 1);
      await parent
        .getByLabel("Chọn bé", { exact: true })
        .selectOption(first.id);
      await parent.getByRole("link", { name: /Cùng con tìm ba màu/ }).click();
      await parent.getByRole("link", { name: /Khám phá màu sắc/ }).click();
      await expect(
        parent.getByRole("heading", {
          name: "Khám phá màu sắc (demo)",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        parent.getByRole("link", { name: "Về góc gia đình", exact: true }),
      ).toBeVisible();
      await expect(parent.locator("video")).toHaveAttribute("controls", "");
      await fits(parent);
      await ready(parent);
      await parent.screenshot({
        path: "test-results/design-family-lesson-320.png",
        fullPage: true,
        animations: "disabled",
      });
    } finally {
      await context.close();
    }
  });
}
