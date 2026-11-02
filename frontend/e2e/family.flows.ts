import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

export function registerFamilyFlows(
  teacherEmail: string,
  teacherPassword: string,
  childName: string,
  className: string,
) {
  const parentEmail = "ui-mother@example.test",
    parentPassword = "E2e-parent-password-2026";
  const secondChildName = "Em của Bông (demo)";
  let firstChildId = "",
    secondChildId = "";
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
  async function mailLink(request: APIRequestContext, path: string) {
    let result = "";
    await expect
      .poll(async () => {
        const response = await request.get(
          `http://127.0.0.1:18026/view/latest.txt?query=${encodeURIComponent(`to:${parentEmail}`)}`,
        );
        const text = response.ok() ? await response.text() : "";
        result =
          text.match(
            new RegExp(`http://127\\.0\\.0\\.1:5174/${path}#[^\\s]+`),
          )?.[0] || "";
        return !!result;
      })
      .toBe(true);
    return result;
  }

  test("mời phụ huynh, đăng ký, xác minh qua SMTP và chỉ xem đúng hồ sơ con", async ({
    page,
    browser,
  }) => {
    await login(page, teacherEmail, teacherPassword, "/teacher");
    await page.goto("/teacher/students");
    await page.getByRole("link", { name: childName, exact: true }).click();
    firstChildId = page.url().split("/").pop()!;
    await page.getByRole("button", { name: "Mời phụ huynh" }).click();
    await page.getByLabel("Email phụ huynh").fill(parentEmail);
    await page
      .getByRole("button", { name: "Tạo lời mời", exact: true })
      .click();
    const invitationUrl = await page.getByLabel("Liên kết mời").inputValue();
    await expect(
      page.getByRole("dialog").getByText(parentEmail, { exact: true }),
    ).toBeVisible();
    await page.getByRole("dialog").getByLabel("Đóng", { exact: true }).click();
    const parentContext = await browser.newContext();
    try {
      const parent = await parentContext.newPage();
      await parent.goto(invitationUrl);
      await expect(parent.getByText(childName, { exact: true })).toHaveCount(0);
      await parent.getByLabel("Họ và tên phụ huynh").fill("Mẹ Bông (demo)");
      await parent.getByLabel("Địa chỉ email").fill(parentEmail);
      await parent.getByLabel("Mật khẩu").fill(parentPassword);
      await parent
        .getByRole("button", { name: "Tạo tài khoản phụ huynh" })
        .click();
      await expect(
        parent.getByRole("heading", { name: "Xác minh email để tiếp tục" }),
      ).toBeVisible();
      expect(
        (await parent.request.get("/api/v1/family/children")).status(),
      ).toBe(403);
      await parent.goto(await mailLink(parent.request, "verify-email"));
      await parent
        .getByRole("button", { name: "Xác minh email", exact: true })
        .click();
      await expect(
        parent.getByRole("heading", { name: "Email đã được xác minh." }),
      ).toBeVisible();
      await parent.getByRole("link", { name: "Tiếp tục lời mời" }).click();
      await parent.getByLabel("Mối quan hệ với bé").fill("Mẹ");
      await parent
        .getByRole("button", { name: "Nhận lời mời", exact: true })
        .click();
      await expect(
        parent.getByRole("heading", { name: childName, exact: true }),
      ).toBeVisible();
      await expect(
        parent.getByRole("heading", { name: className, exact: true }),
      ).toBeVisible();
      await expect(
        parent.getByText("Ghi chú nội bộ — hoàn toàn là dữ liệu giả."),
      ).toHaveCount(0);
      expect(
        (await parent.request.get(`/api/v1/students/${firstChildId}`)).status(),
      ).toBe(403);
      const familyData = await (
        await parent.request.get("/api/v1/family/children")
      ).json();
      expect(familyData.data).toHaveLength(1);
      expect(familyData.data[0].internalNote).toBeUndefined();
      await parent.screenshot({
        path: "test-results/family-parent-desktop.png",
        fullPage: true,
      });
      await page.reload();
      await expect(
        page.getByText("Mẹ Bông (demo)", { exact: true }),
      ).toBeVisible();
      await page
        .locator(".guardian-panel")
        .screenshot({ path: "test-results/teacher-guardians.png" });
    } finally {
      await parentContext.close();
    }
  });

  test("một phụ huynh có hai bé, thu hồi một liên kết không mất quyền với bé còn lại", async ({
    page,
    browser,
  }) => {
    await login(page, teacherEmail, teacherPassword, "/teacher");
    const studentResponse = await post(page.request, "/students", {
      fullName: secondChildName,
      internalNote: "Không chia sẻ ghi chú này",
    });
    expect(studentResponse.status()).toBe(201);
    secondChildId = (await studentResponse.json()).data.id;
    const invitationResponse = await post(
      page.request,
      `/students/${secondChildId}/guardian-invitations`,
      { email: parentEmail },
    );
    expect(invitationResponse.status()).toBe(201);
    const invitationUrl = (await invitationResponse.json()).data.inviteUrl;
    const parentContext = await browser.newContext();
    try {
      const parent = await parentContext.newPage();
      await login(parent, parentEmail, parentPassword, "/family");
      await parent.goto(invitationUrl);
      await parent
        .getByRole("button", { name: "Nhận lời mời", exact: true })
        .click();
      await expect(
        parent.getByRole("heading", { name: secondChildName, exact: true }),
      ).toBeVisible();
      await parent.goto("/family");
      await expect(
        parent.getByRole("heading", { name: childName, exact: true }),
      ).toBeVisible();
      await expect(
        parent.getByRole("heading", { name: secondChildName, exact: true }),
      ).toBeVisible();
      await page.goto(`/teacher/students/${firstChildId}`);
      await page
        .getByRole("button", { name: "Thu hồi liên kết", exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByLabel("Lý do")
        .fill("Kiểm thử thu hồi riêng một bé");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Thu hồi liên kết", exact: true })
        .click();
      await expect(
        page
          .locator(".guardian-panel")
          .getByText("Đã thu hồi", { exact: true }),
      ).toBeVisible();
      await parent.goto(`/family/children/${firstChildId}`);
      await expect(parent.getByRole("alert")).toBeVisible();
      expect(
        (
          await parent.request.get(`/api/v1/family/children/${firstChildId}`)
        ).status(),
      ).toBe(404);
      await parent.goto(`/family/children/${secondChildId}`);
      await expect(
        parent.getByRole("heading", { name: secondChildName, exact: true }),
      ).toBeVisible();
      await parent.goto("/family");
      await expect(
        parent.getByRole("heading", { name: childName, exact: true }),
      ).toHaveCount(0);
      await expect(
        parent.getByRole("heading", { name: secondChildName, exact: true }),
      ).toBeVisible();
    } finally {
      await parentContext.close();
    }
  });

  test("khôi phục mật khẩu qua email làm hết phiên cũ và đăng nhập được bằng mật khẩu mới", async ({
    page,
    browser,
  }) => {
    const oldContext = await browser.newContext();
    try {
      const old = await oldContext.newPage();
      await login(old, parentEmail, parentPassword, "/family");
      await page.goto("/forgot-password");
      await page.getByLabel("Địa chỉ email").fill(parentEmail);
      await page
        .getByRole("button", { name: "Gửi hướng dẫn khôi phục" })
        .click();
      await expect(page.getByRole("status")).toContainText(
        "Nếu email có tài khoản",
      );
      await page.goto(await mailLink(page.request, "reset-password"));
      const newPassword = "E2e-updated-parent-password-2026";
      await page.getByLabel("Mật khẩu mới", { exact: true }).fill(newPassword);
      await page.getByLabel("Nhập lại mật khẩu mới").fill(newPassword);
      await page.getByRole("button", { name: "Lưu mật khẩu mới" }).click();
      await expect(
        page.getByRole("heading", { name: "Đã cập nhật mật khẩu." }),
      ).toBeVisible();
      expect((await old.request.get("/api/v1/auth/me")).status()).toBe(401);
      await login(page, parentEmail, newPassword, "/family");
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator(".sidebar")).not.toBeInViewport();
      await expect(
        page.getByRole("heading", { name: secondChildName, exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: "test-results/family-mobile.png",
        fullPage: true,
      });
    } finally {
      await oldContext.close();
    }
  });

  test("lời mời bị thu hồi không còn mở đăng ký và không lộ tên bé", async ({
    page,
    browser,
  }) => {
    await login(page, teacherEmail, teacherPassword, "/teacher");
    await page.goto(`/teacher/students/${secondChildId}`);
    await page.getByRole("button", { name: "Mời phụ huynh" }).click();
    await page
      .getByLabel("Email phụ huynh")
      .fill("revoked-invite@example.test");
    await page
      .getByRole("button", { name: "Tạo lời mời", exact: true })
      .click();
    const invitationUrl = await page.getByLabel("Liên kết mời").inputValue();
    await page.getByRole("dialog").getByLabel("Đóng", { exact: true }).click();
    const row = page
      .getByRole("row")
      .filter({ hasText: "revoked-invite@example.test" });
    await row
      .getByRole("button", { name: "Thu hồi lời mời", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Thu hồi lời mời", exact: true })
      .click();
    await expect(row.getByText("Đã thu hồi", { exact: true })).toBeVisible();
    const guestContext = await browser.newContext();
    try {
      const guest = await guestContext.newPage();
      await guest.goto(invitationUrl);
      await expect(
        guest.getByText("Lời mời không còn hiệu lực", { exact: false }),
      ).toBeVisible();
      await expect(
        guest.getByText(secondChildName, { exact: true }),
      ).toHaveCount(0);
      await expect(
        guest.getByRole("button", { name: "Tạo tài khoản phụ huynh" }),
      ).toHaveCount(0);
    } finally {
      await guestContext.close();
    }
  });
}
