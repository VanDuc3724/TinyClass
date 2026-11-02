import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

// The provider in these browser tests is local and test-only. No real Google credentials.
export function registerGoogleFlows(
  teacherEmail: string,
  teacherPassword: string,
  childName: string,
) {
  const parentEmail = "qa-parent@gmail.com";
  const parentPassword = "E2e-google-parent-password-2026";

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
  async function selectIdentity(page: Page, value: string) {
    await expect(
      page.getByRole("heading", { name: "Máy chủ OIDC thử nghiệm" }),
    ).toBeVisible();
    await page.getByLabel("Chọn tài khoản thử nghiệm").selectOption(value);
    await page
      .getByRole("button", { name: "Tiếp tục với tài khoản thử nghiệm" })
      .click();
  }
  async function post(request: APIRequestContext, path: string, data: unknown) {
    const csrf = (await (await request.get("/api/v1/auth/csrf")).json()).data;
    return request.post(`/api/v1${path}`, {
      headers: { [csrf.headerName]: csrf.token },
      data,
    });
  }

  test("liên kết Google sau xác thực lại, đăng nhập vẫn giữ cùng giáo viên và dữ liệu", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await login(page, teacherEmail, teacherPassword, "/teacher");
    const original = (await (await page.request.get("/api/v1/auth/me")).json())
      .data;
    await page.goto("/teacher/account");
    await page
      .getByRole("button", { name: "Liên kết Google", exact: true })
      .click();
    await page.getByLabel("Mật khẩu hiện tại").fill("Incorrect-test-password");
    await page.getByRole("button", { name: "Xác nhận mật khẩu" }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    expect((await page.request.get("/api/v1/auth/me")).status()).toBe(200);
    await page.getByLabel("Mật khẩu hiện tại").fill(teacherPassword);
    await page.getByRole("button", { name: "Xác nhận mật khẩu" }).click();
    await selectIdentity(page, "teacher");
    await expect(page).toHaveURL(/\/teacher\/account$/);
    await expect(
      page.getByRole("status").filter({ hasText: "Đã liên kết Google" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Hủy liên kết Google" }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/google-methods-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".sidebar")).not.toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/google-methods-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByLabel("Menu tài khoản", { exact: true }).click();
    await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
    await page.getByRole("button", { name: "Tiếp tục với Google" }).click();
    await selectIdentity(page, "teacher");
    await expect(page).toHaveURL(/\/teacher$/);
    const current = (await (await page.request.get("/api/v1/auth/me")).json())
      .data;
    expect(current.id).toBe(original.id);
    expect(current.role).toBe("TEACHER");
    await page.goto("/teacher/students");
    await expect(
      page.getByRole("link", { name: childName, exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("Google-only nhận lời mời, thêm mật khẩu qua email rồi hủy Google an toàn", async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);
    await login(page, teacherEmail, teacherPassword, "/teacher");
    await page.goto("/teacher/students");
    await page.getByRole("link", { name: childName, exact: true }).click();
    await page.getByRole("button", { name: "Mời phụ huynh" }).click();
    await page.getByLabel("Email phụ huynh").fill(parentEmail);
    await page
      .getByRole("button", { name: "Tạo lời mời", exact: true })
      .click();
    const invitationUrl = await page.getByLabel("Liên kết mời").inputValue();
    const context = await browser.newContext();
    try {
      const parent = await context.newPage();
      const errors: string[] = [];
      parent.on("pageerror", (error) => errors.push(error.message));
      await parent.goto(invitationUrl);
      await parent
        .getByLabel("Họ và tên phụ huynh")
        .fill("Ba Bông (Google demo)");
      await parent.getByRole("button", { name: "Đăng ký với Google" }).click();
      await selectIdentity(parent, "parent");
      await expect(
        parent.getByRole("heading", { name: childName, exact: true }),
      ).toBeVisible();
      expect((await parent.request.get("/api/v1/classes")).status()).toBe(403);
      await expect(
        parent.getByText("Ghi chú nội bộ — hoàn toàn là dữ liệu giả."),
      ).toHaveCount(0);
      await parent.goto("/family/account");
      await expect(
        parent.getByText("Chưa thiết lập mật khẩu", { exact: true }),
      ).toBeVisible();
      await expect(
        parent.getByRole("button", { name: "Hủy liên kết Google" }),
      ).toHaveCount(0);
      const methods = (
        await (await parent.request.get("/api/v1/auth/methods")).json()
      ).data;
      expect(methods.hasPassword).toBe(false);
      expect(
        (
          await post(
            parent.request,
            `/auth/identities/${methods.google.id}/unlink`,
            {},
          )
        ).status(),
      ).toBe(409);
      await parent.screenshot({
        path: "test-results/google-only-parent.png",
        fullPage: true,
      });

      await parent
        .getByRole("button", { name: "Thêm mật khẩu", exact: true })
        .click();
      await expect(
        parent.getByRole("dialog").getByLabel("Mật khẩu hiện tại"),
      ).toHaveCount(0);
      await parent
        .getByRole("button", { name: "Xác thực lại bằng Google" })
        .click();
      await selectIdentity(parent, "parent");
      await expect(parent).toHaveURL(/\/family\/account$/);
      await expect(
        parent
          .getByRole("status")
          .filter({ hasText: "Đã xác thực lại bằng Google" }),
      ).toBeVisible();
      await parent
        .getByRole("button", { name: "Thêm mật khẩu", exact: true })
        .click();
      await expect(
        parent.getByText("Đã gửi liên kết thiết lập mật khẩu", {
          exact: false,
        }),
      ).toBeVisible();
      let setupLink = "";
      await expect
        .poll(async () => {
          const mail = await parent.request.get(
            `http://127.0.0.1:18026/view/latest.txt?query=${encodeURIComponent(`to:${parentEmail}`)}`,
          );
          setupLink =
            (mail.ok() ? await mail.text() : "").match(
              /http:\/\/127\.0\.0\.1:5174\/set-password#[^\s]+/,
            )?.[0] || "";
          return !!setupLink;
        })
        .toBe(true);
      await parent.goto(setupLink);
      await parent
        .getByLabel("Mật khẩu mới", { exact: true })
        .fill(parentPassword);
      await parent.getByLabel("Nhập lại mật khẩu mới").fill(parentPassword);
      await parent
        .getByRole("button", { name: "Thiết lập mật khẩu", exact: true })
        .click();
      await expect(
        parent.getByRole("heading", { name: "Đã thiết lập mật khẩu." }),
      ).toBeVisible();
      expect((await parent.request.get("/api/v1/auth/me")).status()).toBe(401);
      await login(parent, parentEmail, parentPassword, "/family");
      await parent.goto("/family/account");
      await parent
        .getByRole("button", { name: "Hủy liên kết Google", exact: true })
        .click();
      await parent.getByLabel("Mật khẩu hiện tại").fill(parentPassword);
      await parent.getByRole("button", { name: "Xác nhận mật khẩu" }).click();
      await expect(parent).toHaveURL(/\/login$/);
      await login(parent, parentEmail, parentPassword, "/family");
      const finalMethods = (
        await (await parent.request.get("/api/v1/auth/methods")).json()
      ).data;
      expect(finalMethods.hasPassword).toBe(true);
      expect(finalMethods.google).toBeNull();
      await parent.getByLabel("Menu tài khoản", { exact: true }).click();
      await parent
        .getByRole("button", { name: "Đăng xuất", exact: true })
        .click();
      await parent.getByRole("button", { name: "Tiếp tục với Google" }).click();
      await selectIdentity(parent, "parent");
      await expect(
        parent.getByText("Email đã có tài khoản.", { exact: false }),
      ).toBeVisible();
      expect((await parent.request.get("/api/v1/auth/me")).status()).toBe(401);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test("hủy OAuth quay về kết quả rõ ràng và không tạo phiên đăng nhập", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("button", { name: "Tiếp tục với Google" }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/google-login-desktop.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Tiếp tục với Google" }).click();
    await selectIdentity(page, "cancel");
    await expect(
      page.getByText("Bạn đã hủy đăng nhập Google.", { exact: false }),
    ).toBeVisible();
    expect((await page.request.get("/api/v1/auth/me")).status()).toBe(401);
    await page.getByRole("link", { name: "Trở lại để tiếp tục" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
}
