import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

export function registerCommunicationFlows(
  teacherEmail: string,
  teacherPassword: string,
) {
  const parentEmail = "ui-learning@example.test",
    parentPassword = "Synthetic-learning-parent-2026";
  const childName = "Khánh Vy (bảng tin demo)",
    otherName = "Minh Khuê (bảng tin demo)";
  const initialTitle = "Chuẩn bị hoạt động ngày mai (bảng tin demo)",
    finalTitle = "Đồ dùng đã cập nhật (bảng tin demo)";
  const privateReason =
    "Lý do riêng TC024: cô đổi hoạt động sau khi kiểm tra vật liệu.";
  let classroom = "",
    child = "",
    other = "",
    enrollment = "",
    guardian = "",
    announcement = "";
  const teacherPath = () => `/teacher/announcements/${announcement}`;
  const familyPath = () =>
    `/family/children/${child}/announcements/${announcement}`;
  async function login(page: Page, parent = false) {
    page.setDefaultTimeout(15_000);
    await page.goto("/login");
    await page
      .getByLabel("Địa chỉ email")
      .fill(parent ? parentEmail : teacherEmail);
    await page
      .getByLabel("Mật khẩu", { exact: true })
      .fill(parent ? parentPassword : teacherPassword);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL(parent ? /\/family$/ : /\/teacher$/);
  }
  async function write(
    request: APIRequestContext,
    path: string,
    body: unknown,
    method = "POST",
  ) {
    const token = (await (await request.get("/api/v1/auth/csrf")).json()).data;
    return request.fetch(`/api/v1${path}`, {
      method,
      headers: { [token.headerName]: token.token },
      data: body,
    });
  }
  async function get(page: Page, path: string) {
    const r = await page.request.get(`/api/v1${path}`);
    expect(r.status()).toBe(200);
    return (await r.json()).data;
  }
  async function capture(page: Page, name: string, modal = false) {
    await page.evaluate(() => document.fonts.ready);
    if (modal)
      await page
        .getByRole("dialog")
        .evaluate((element) => element.scrollIntoView({ block: "center" }));
    else await page.evaluate(() => scrollTo(0, 0));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/communications-${name}.png`,
      fullPage: !modal,
      animations: "disabled",
    });
  }
  test("bảng tin giữ nháp khi mất phản hồi, đăng một lần và gia đình mở từ cập nhật rồi đánh dấu đọc", async ({
    page,
    browser,
  }) => {
    test.setTimeout(110_000);
    await login(page);
    const context = await browser.newContext(),
      parent = await context.newPage();
    try {
      await login(parent, true);
      for (const [index, name] of [childName, otherName].entries()) {
        let r = await write(page.request, "/classes", {
          name: `Lớp ${index ? "Sao Nhỏ" : "Mây Hồng"} (bảng tin demo)`,
          capacity: 5,
        });
        expect(r.status()).toBe(201);
        const c = (await r.json()).data.id;
        expect(
          (
            await write(page.request, `/classes/${c}/activate`, { version: 0 })
          ).status(),
        ).toBe(200);
        r = await write(page.request, "/students", { fullName: name });
        const id = (await r.json()).data.id;
        r = await write(page.request, `/classes/${c}/enrollments`, {
          studentId: id,
        });
        const e = (await r.json()).data.id;
        if (!index) {
          classroom = c;
          child = id;
          enrollment = e;
        } else other = id;
        r = await write(page.request, `/students/${id}/guardian-invitations`, {
          email: parentEmail,
        });
        expect(r.status()).toBe(201);
        const invite = (await r.json()).data,
          token = new URLSearchParams(
            new URL(invite.inviteUrl).hash.slice(1),
          ).get("token");
        expect(
          (
            await write(parent.request, "/guardian-invitations/accept", {
              token,
              relationshipLabel: "Gia đình",
            })
          ).status(),
        ).toBe(200);
      }
      guardian = (await get(page, `/students/${child}/guardians`)).find(
        (r: { email: string }) => r.email === parentEmail,
      ).id;
      await page.goto(`/teacher/announcements?classId=${classroom}`);
      await page
        .getByRole("button", { name: "Soạn thông báo", exact: true })
        .click();
      const modal = page.getByRole("dialog");
      await modal
        .getByRole("textbox", { name: "Tiêu đề", exact: true })
        .fill(initialTitle);
      await modal
        .getByRole("textbox", { name: "Nội dung", exact: true })
        .fill(
          "Gia đình chuẩn bị bình nước và mũ.\nCô cùng bé làm hoạt động ngoài trời.",
        );
      await page.setViewportSize({ width: 375, height: 812 });
      await capture(page, "editor-375", true);
      const routePath = "**/api/v1/announcements";
      let initialKey = "";
      await page.route(routePath, async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        initialKey = route.request().postDataJSON().clientRequestId;
        const actual = await route.fetch();
        expect(actual.status()).toBe(201);
        announcement = (await actual.json()).data.id;
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Phản hồi lưu nháp đang gián đoạn trong kiểm thử.",
          }),
        });
      });
      await modal
        .getByRole("button", { name: "Lưu bản nháp", exact: true })
        .click();
      await expect(modal.getByRole("alert")).toContainText("đang gián đoạn");
      await expect(
        modal.getByRole("textbox", { name: "Tiêu đề", exact: true }),
      ).toHaveValue(initialTitle);
      await capture(page, "response-loss-375", true);
      await page.unroute(routePath);
      const request = page.waitForRequest(
        (r) =>
          r.method() === "POST" && r.url().endsWith("/api/v1/announcements"),
      );
      await modal
        .getByRole("button", { name: "Lưu bản nháp", exact: true })
        .click();
      expect((await request).postDataJSON().clientRequestId).toBe(initialKey);
      await expect(modal).toHaveCount(0);
      await parent.goto(`/family/children/${child}/announcements`);
      await expect(parent.getByRole("article")).toHaveCount(0);
      await page
        .getByRole("article")
        .filter({ hasText: initialTitle })
        .getByRole("link", { name: "Xem thông báo", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Đăng cho gia đình", exact: true })
        .click();
      await expect(
        page
          .getByText("Đã xuất bản", { exact: true })
          .or(page.getByText("Đã đăng", { exact: true })),
      ).toBeVisible();
      expect(
        (
          await write(page.request, `/announcements/${announcement}/publish`, {
            version: 0,
          })
        ).status(),
      ).toBe(200);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await capture(page, "teacher-published-desktop");
      await parent.setViewportSize({ width: 375, height: 812 });
      await parent.goto("/family/updates");
      const row = parent.getByRole("article").filter({ hasText: childName });
      await expect(row).toHaveCount(1);
      await capture(parent, "family-updates-375");
      await row
        .getByRole("button", { name: "Xem cập nhật", exact: true })
        .click();
      await expect(parent).toHaveURL(
        new RegExp(`/announcements/${announcement}$`),
      );
      await expect(
        parent.getByRole("heading", { name: initialTitle, exact: true }),
      ).toBeVisible();
      await parent
        .getByRole("button", { name: "Đánh dấu đã đọc", exact: true })
        .click();
      await expect(
        parent.getByText("Đã đọc bản hiện tại", { exact: true }),
      ).toBeVisible();
      await capture(parent, "family-read-375");
      expect(
        (
          await get(
            parent,
            `/family/children/${child}/announcements/${announcement}`,
          )
        ).isRead,
      ).toBe(true);
      await parent.getByLabel("Chọn bé", { exact: true }).selectOption(other);
      await expect(parent).toHaveURL(
        new RegExp(`/children/${other}/announcements$`),
      );
      await expect(parent.getByRole("article")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
  test("chỉnh sửa bảng tin giữ nội dung qua 503 và 409, bản mới cần đọc lại và lý do chỉ cô xem", async ({
    page,
    browser,
  }) => {
    test.setTimeout(100_000);
    await login(page);
    const context = await browser.newContext(),
      parent = await context.newPage();
    try {
      await login(parent, true);
      await page.goto(teacherPath());
      await page
        .getByRole("button", { name: "Chỉnh sửa thông báo", exact: true })
        .click();
      const modal = page.getByRole("dialog");
      await modal
        .getByRole("textbox", { name: "Tiêu đề", exact: true })
        .fill(finalTitle);
      await modal
        .getByRole("textbox", { name: "Nội dung", exact: true })
        .fill("Gia đình mang giấy màu thay cho hộp vật liệu.");
      await modal
        .getByRole("textbox", { name: /^Lý do chỉnh sửa/ })
        .fill(privateReason);
      const routePath = `**/api/v1/announcements/${announcement}`;
      await page.route(routePath, (route) =>
        route.request().method() === "PUT"
          ? route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({
                message: "Dịch vụ sửa thông báo đang gián đoạn.",
              }),
            })
          : route.continue(),
      );
      await modal
        .getByRole("button", { name: "Lưu thay đổi", exact: true })
        .click();
      await expect(modal.getByRole("alert")).toContainText("gián đoạn");
      await expect(
        modal.getByRole("textbox", { name: "Tiêu đề", exact: true }),
      ).toHaveValue(finalTitle);
      await page.unroute(routePath);
      let current = await get(page, `/announcements/${announcement}`);
      expect(
        (
          await write(
            page.request,
            `/announcements/${announcement}`,
            {
              version: current.version,
              title: "Bản sửa từ cửa sổ khác",
              body: "Nội dung đã thay đổi ở cửa sổ khác.",
              reason: "Lý do riêng cửa sổ khác TC024.",
            },
            "PUT",
          )
        ).status(),
      ).toBe(200);
      await parent.goto(familyPath());
      await expect(
        parent.getByRole("button", { name: "Đánh dấu đã đọc", exact: true }),
      ).toBeVisible();
      await modal
        .getByRole("button", { name: "Lưu thay đổi", exact: true })
        .click();
      await expect(modal.getByRole("alert")).toContainText("đã thay đổi");
      await expect(
        modal.getByRole("textbox", { name: "Nội dung", exact: true }),
      ).toHaveValue("Gia đình mang giấy màu thay cho hộp vật liệu.");
      await page.setViewportSize({ width: 375, height: 812 });
      await capture(page, "stale-editor-375", true);
      page.once("dialog", (dialog) => dialog.accept());
      await modal
        .getByRole("button", { name: "Đóng và cập nhật", exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          name: "Bản sửa từ cửa sổ khác",
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Chỉnh sửa thông báo", exact: true })
        .click();
      await modal
        .getByRole("textbox", { name: "Tiêu đề", exact: true })
        .fill(finalTitle);
      await modal
        .getByRole("textbox", { name: "Nội dung", exact: true })
        .fill("Gia đình mang giấy màu thay cho hộp vật liệu.");
      await modal
        .getByRole("textbox", { name: /^Lý do chỉnh sửa/ })
        .fill(privateReason);
      await modal
        .getByRole("button", { name: "Lưu thay đổi", exact: true })
        .click();
      await expect(modal).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: finalTitle, exact: true }),
      ).toBeVisible();
      await parent
        .getByRole("button", { name: "Đánh dấu đã đọc", exact: true })
        .click();
      await expect(parent.getByRole("alert")).toContainText("đã được cập nhật");
      await parent.setViewportSize({ width: 375, height: 812 });
      await capture(parent, "family-stale-read-375");
      await parent
        .getByRole("button", { name: "Cập nhật thông báo", exact: true })
        .click();
      await expect(
        parent.getByRole("heading", { name: finalTitle, exact: true }),
      ).toBeVisible();
      await parent
        .getByRole("button", { name: "Đánh dấu đã đọc", exact: true })
        .click();
      await expect(
        parent.getByText("Đã đọc bản hiện tại", { exact: true }),
      ).toBeVisible();
      expect(await parent.getByRole("main").innerText()).not.toContain(
        privateReason,
      );
      const dto = await get(
        parent,
        `/family/children/${child}/announcements/${announcement}`,
      );
      expect(dto.revision).toBe(3);
      expect(JSON.stringify(dto)).not.toMatch(
        /version|requestHash|reason|canEdit/,
      );
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page
        .getByRole("button", { name: "Lịch sử thông báo", exact: true })
        .click();
      await expect(
        page.getByRole("dialog").getByText(privateReason, { exact: false }),
      ).toBeVisible();
      await capture(page, "teacher-history-desktop", true);
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Đóng", exact: true })
        .click();
      current = await get(page, `/announcements/${announcement}`);
      expect(current.revision).toBe(3);
    } finally {
      await context.close();
    }
  });
  test("lưu trữ ẩn bảng tin và cập nhật, rời lớp hoặc thu hồi liên kết chặn đường dẫn cũ", async ({
    page,
    browser,
  }) => {
    test.setTimeout(100_000);
    await login(page);
    const context = await browser.newContext(),
      parent = await context.newPage();
    try {
      await login(parent, true);
      await parent.goto(familyPath());
      await expect(
        parent.getByRole("heading", { name: finalTitle, exact: true }),
      ).toBeVisible();
      await page.goto(teacherPath());
      await page
        .getByRole("button", { name: "Lưu trữ thông báo", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("textbox", { name: /^Lý do lưu trữ/ })
        .fill("Lý do riêng TC024: thông tin đã hết hiệu lực.");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Xác nhận lưu trữ", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByText("Đã lưu trữ", { exact: true })).toBeVisible();
      await page.setViewportSize({ width: 1440, height: 1000 });
      await capture(page, "teacher-archived-desktop");
      await parent
        .getByRole("button", { name: "Cập nhật thông báo", exact: true })
        .click();
      await expect(parent.getByRole("main").getByRole("alert")).toBeVisible();
      await expect(
        parent.getByRole("heading", { name: finalTitle, exact: true }),
      ).toHaveCount(0);
      await parent.setViewportSize({ width: 320, height: 780 });
      await capture(parent, "family-archived-320");
      await parent.goto("/family/updates");
      await expect(
        parent.getByRole("article").filter({ hasText: childName }),
      ).toHaveCount(0);
      let r = await write(page.request, "/announcements", {
        clientRequestId: crypto.randomUUID(),
        classId: classroom,
        title: "Thông báo kiểm tra quyền lớp",
        body: "Nội dung công khai kiểm tra rời lớp.",
      });
      expect(r.status()).toBe(201);
      const a = (await r.json()).data;
      expect(
        (
          await write(page.request, `/announcements/${a.id}/publish`, {
            version: 0,
          })
        ).status(),
      ).toBe(200);
      await parent.goto(`/family/children/${child}/announcements/${a.id}`);
      await expect(
        parent.getByRole("heading", { name: a.title, exact: true }),
      ).toBeVisible();
      const members = await get(page, `/classes/${classroom}/enrollments`);
      let member = members.find((e: { id: string }) => e.id === enrollment);
      expect(
        (
          await write(
            page.request,
            `/enrollments/${enrollment}`,
            {
              version: member.version,
              status: "WITHDRAWN",
              reason: "Dừng lớp bảng tin kiểm thử.",
            },
            "PATCH",
          )
        ).status(),
      ).toBe(200);
      await parent
        .getByRole("button", { name: "Cập nhật thông báo", exact: true })
        .click();
      await expect(parent.getByRole("main").getByRole("alert")).toBeVisible();
      await capture(parent, "family-withdrawn-320");
      expect(
        (await get(parent, "/notifications")).filter(
          (n: { studentId: string }) => n.studentId === child,
        ),
      ).toHaveLength(0);
      member = (await get(page, `/classes/${classroom}/enrollments`)).find(
        (e: { id: string }) => e.id === enrollment,
      );
      expect(
        (
          await write(
            page.request,
            `/enrollments/${enrollment}`,
            {
              version: member.version,
              status: "ACTIVE",
              reason: "Trở lại để kiểm tra thu hồi liên kết.",
            },
            "PATCH",
          )
        ).status(),
      ).toBe(200);
      await parent.reload();
      await expect(
        parent.getByRole("heading", { name: a.title, exact: true }),
      ).toBeVisible();
      const link = (await get(page, `/students/${child}/guardians`)).find(
        (g: { id: string }) => g.id === guardian,
      );
      expect(
        (
          await write(page.request, `/student-guardians/${guardian}/revoke`, {
            version: link.version,
            reason: "Thu hồi liên kết kiểm thử bảng tin.",
          })
        ).status(),
      ).toBe(200);
      await parent
        .getByRole("button", { name: "Cập nhật thông báo", exact: true })
        .click();
      await expect(parent.getByRole("main").getByRole("alert")).toBeVisible();
      await expect(
        parent.getByRole("heading", { name: a.title, exact: true }),
      ).toHaveCount(0);
      await capture(parent, "family-revoked-320");
    } finally {
      await context.close();
    }
  });
}
