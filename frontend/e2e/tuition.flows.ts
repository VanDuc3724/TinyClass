import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

export function registerTuitionFlows(
  teacherEmail: string,
  teacherPassword: string,
) {
  const parentEmail = "ui-learning@example.test",
    parentPassword = "Synthetic-learning-parent-2026";
  const childName = "Minh Anh (học phí demo)",
    otherName = "Gia Hân (học phí demo)",
    className = "Lớp Hoa Nhỏ (học phí demo)";
  const privateNote = "Riêng TC020: trao đổi nội bộ cùng gia đình.",
    publicTerms = "Gia đình báo nghỉ trước giờ học để cô chuẩn bị.";
  let classId = "",
    child = "",
    otherChild = "",
    enrollment = "",
    otherEnrollment = "",
    guardian = "",
    current = "";
  const teacherPath = () => `/teacher/enrollments/${enrollment}/tuition`;
  const day = (offset = 0) =>
    new Date(Date.now() + offset * 86400000).toLocaleDateString("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
    });
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
    const csrf = (await (await request.get("/api/v1/auth/csrf")).json()).data;
    return request.fetch(`/api/v1${path}`, {
      method,
      headers: { [csrf.headerName]: csrf.token },
      data: body,
    });
  }
  async function workspace(page: Page) {
    return (
      await (
        await page.request.get(
          `/api/v1/enrollments/${enrollment}/tuition-agreements`,
        )
      ).json()
    ).data;
  }
  async function capture(
    page: Page,
    name: string,
    center?: ReturnType<Page["getByRole"]>,
  ) {
    await page.evaluate(() => document.fonts.ready);
    if (center)
      await center.evaluate((element) =>
        element.scrollIntoView({ block: "center" }),
      );
    else await page.evaluate(() => scrollTo(0, 0));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/tuition-${name}.png`,
      fullPage: !center,
      animations: "disabled",
    });
  }
  async function policyEdit(page: Page, mode: string, amount: string) {
    await page
      .getByRole("button", { name: "Chỉnh sửa chính sách", exact: true })
      .click();
    const modal = page.getByRole("dialog");
    await modal
      .getByRole("combobox", { name: "Cách tính học phí", exact: true })
      .selectOption(mode);
    await modal
      .getByRole("spinbutton", {
        name: new RegExp(
          "^" +
            (mode === "MONTHLY_FIXED"
              ? "Mức phí mỗi tháng"
              : "Tổng phí trọn khóa"),
        ),
      })
      .fill(amount);
    await modal
      .getByRole("combobox", { name: "Quy tắc khi bé nghỉ", exact: true })
      .selectOption("MANUAL_ADJUSTMENT");
    if (mode === "FULL_PROGRAM") {
      await modal
        .getByLabel("Tên khóa tính phí", { exact: true })
        .fill("Khám phá mùa hè (demo)");
      await modal.getByLabel(/^Số buổi dự kiến/).fill("24");
    }
    await modal
      .getByLabel("Lý do thay đổi")
      .fill("Cô cập nhật mức mặc định cho thỏa thuận mới.");
    await modal
      .getByRole("button", { name: "Lưu chính sách", exact: true })
      .click();
    await expect(modal).toHaveCount(0);
  }

  test("học phí cô đặt ba cách tính, sao chép và mức riêng; lưu lại sau mất phản hồi không tạo trùng", async ({
    page,
    browser,
  }) => {
    test.setTimeout(110_000);
    const runtime: string[] = [];
    page.on("pageerror", (error) => runtime.push(error.message));
    await login(page);
    let response = await write(page.request, "/classes", {
      name: className,
      capacity: 6,
    });
    expect(response.status()).toBe(201);
    classId = (await response.json()).data.id;
    expect(
      (
        await write(page.request, `/classes/${classId}/activate`, {
          version: 0,
        })
      ).status(),
    ).toBe(200);
    const context = await browser.newContext(),
      parent = await context.newPage();
    try {
      await login(parent, true);
      for (const name of [childName, otherName]) {
        response = await write(page.request, "/students", { fullName: name });
        expect(response.status()).toBe(201);
        const id = (await response.json()).data.id;
        if (name === childName) child = id;
        else otherChild = id;
        response = await write(
          page.request,
          `/classes/${classId}/enrollments`,
          { studentId: id },
        );
        expect(response.status()).toBe(201);
        if (name === childName) enrollment = (await response.json()).data.id;
        else otherEnrollment = (await response.json()).data.id;
        response = await write(
          page.request,
          `/students/${id}/guardian-invitations`,
          { email: parentEmail },
        );
        expect(response.status()).toBe(201);
        const invitation = (await response.json()).data;
        const token = new URLSearchParams(
          new URL(invitation.inviteUrl).hash.slice(1),
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
    } finally {
      await context.close();
    }
    guardian = (
      await (
        await page.request.get(`/api/v1/students/${child}/guardians`)
      ).json()
    ).data.find((link: { email: string }) => link.email === parentEmail).id;
    await page.goto(`/teacher/classes/${classId}`);
    await page.getByRole("tab", { name: "Học sinh" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("tab", { name: "Thông tin lớp" }),
    ).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("End");
    await expect(
      page.getByRole("tab", { name: "Học phí", exact: true }),
    ).toBeFocused();
    await page
      .getByRole("button", { name: "Thiết lập học phí", exact: true })
      .click();
    let modal = page.getByRole("dialog");
    await modal
      .getByRole("combobox", { name: "Cách tính học phí", exact: true })
      .selectOption("PER_SESSION");
    await modal
      .getByRole("combobox", { name: "Thời điểm thu dự kiến", exact: true })
      .selectOption("AT_PERIOD_END");
    await modal
      .getByRole("spinbutton", { name: /^Đơn giá mỗi buổi/ })
      .fill("100000");
    await modal
      .getByRole("combobox", { name: "Bé nghỉ có phép", exact: true })
      .selectOption("false");
    await modal
      .getByRole("combobox", { name: "Bé nghỉ chưa báo", exact: true })
      .selectOption("true");
    await modal.getByLabel(/^Điều kiện chia sẻ với gia đình/).fill(publicTerms);
    await modal
      .getByLabel(/^Ghi chú riêng của cô/)
      .fill("Chính sách riêng TC020");
    await modal
      .getByRole("button", { name: "Lưu chính sách", exact: true })
      .click();
    await expect(modal).toHaveCount(0);
    await capture(page, "class-policy-desktop");
    await page
      .getByRole("link", { name: `Học phí của ${childName}`, exact: true })
      .click();
    await page
      .getByRole("button", { name: "Thêm thỏa thuận", exact: true })
      .click();
    modal = page.getByRole("dialog");
    await expect(
      modal.getByRole("combobox", { name: "Nguồn điều kiện", exact: true }),
    ).toHaveValue("POLICY");
    await modal.getByLabel(/^Ghi chú riêng của cô/).fill(privateNote);
    const createPath = `**/api/v1/enrollments/${enrollment}/tuition-agreements`;
    await page.route(createPath, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const actual = await route.fetch();
      expect(actual.status()).toBe(201);
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          code: "SYNTHETIC_RESPONSE_LOSS",
          message: "Kết nối thử nghiệm bị gián đoạn sau khi lưu.",
        }),
      });
    });
    await modal
      .getByRole("button", { name: "Lưu và chia sẻ điều kiện", exact: true })
      .click();
    await expect(modal.getByRole("alert")).toContainText(
      "Kết nối thử nghiệm bị gián đoạn",
    );
    await expect(modal.getByLabel(/^Ghi chú riêng của cô/)).toHaveValue(
      privateNote,
    );
    await capture(page, "draft-response-loss", modal.getByRole("alert"));
    await page.unroute(createPath);
    await modal
      .getByRole("button", { name: "Lưu và chia sẻ điều kiện", exact: true })
      .click();
    await expect(modal).toHaveCount(0);
    let data = await workspace(page);
    expect(data.agreements.meta.totalElements).toBe(1);
    current = data.agreements.data[0].id;
    await capture(page, "teacher-agreement-desktop");
    await page.goto(`/teacher/enrollments/${otherEnrollment}/tuition`);
    await page
      .getByRole("button", { name: "Thêm thỏa thuận", exact: true })
      .click();
    modal = page.getByRole("dialog");
    await modal
      .getByRole("combobox", { name: "Nguồn điều kiện", exact: true })
      .selectOption("CUSTOM");
    await modal
      .getByRole("spinbutton", { name: /^Đơn giá mỗi buổi/ })
      .fill("77000");
    await modal
      .getByRole("button", { name: "Lưu và chia sẻ điều kiện", exact: true })
      .click();
    await expect(modal).toHaveCount(0);
    await page.goto(`/teacher/classes/${classId}?tab=tuition`);
    await policyEdit(page, "MONTHLY_FIXED", "1200000");
    await expect(page.getByText(/1\.200\.000/).first()).toBeVisible();
    await policyEdit(page, "FULL_PROGRAM", "3000000");
    await expect(
      page.getByText("Khám phá mùa hè (demo)", { exact: true }),
    ).toBeVisible();
    data = await workspace(page);
    expect(data.agreements.data[0].sessionUnitPriceVnd).toBe(100000);
    expect(data.agreements.data[0].pricingMode).toBe("PER_SESSION");
    await page.setViewportSize({ width: 375, height: 812 });
    await capture(page, "class-policy-mobile-375");
    expect(runtime).toEqual([]);
  });

  test("học phí giữ bản nháp khi xung đột; thay mức theo ngày, kết thúc, hủy và đối chiếu lịch sử", async ({
    page,
  }) => {
    test.setTimeout(100_000);
    await login(page);
    await page.goto(teacherPath());
    await page
      .getByRole("button", { name: "Thay mức học phí", exact: true })
      .click();
    let modal = page.getByRole("dialog");
    await modal
      .getByRole("combobox", { name: "Nguồn điều kiện", exact: true })
      .selectOption("POLICY");
    await modal
      .getByLabel("Ngày bắt đầu áp dụng", { exact: true })
      .fill(day(1));
    await modal
      .getByLabel("Lý do thay đổi")
      .fill("Bản nháp TC020 cần được giữ khi có thay đổi khác.");
    const policy = (await workspace(page)).policy;
    const terms = { ...policy, programTotalVnd: 3100000 };
    expect(
      (
        await write(
          page.request,
          `/classes/${classId}/tuition-policy`,
          {
            version: policy.version,
            terms,
            internalNote: policy.internalNote,
            reason: "Cập nhật từ cửa sổ khác.",
          },
          "PUT",
        )
      ).status(),
    ).toBe(200);
    await modal
      .getByRole("button", { name: "Lưu và chia sẻ điều kiện", exact: true })
      .click();
    await expect(modal.getByRole("alert")).toBeVisible();
    await expect(modal.getByLabel("Lý do thay đổi")).toHaveValue(
      "Bản nháp TC020 cần được giữ khi có thay đổi khác.",
    );
    await capture(page, "stale-policy-draft", modal.getByRole("alert"));
    page.once("dialog", (dialog) => dialog.accept());
    await modal
      .getByRole("button", { name: "Đóng và cập nhật dữ liệu", exact: true })
      .click();
    await expect(modal).toHaveCount(0);
    expect((await workspace(page)).agreements.meta.totalElements).toBe(1);
    await page
      .getByRole("button", { name: "Thay mức học phí", exact: true })
      .click();
    modal = page.getByRole("dialog");
    await modal
      .getByRole("spinbutton", { name: /^Đơn giá mỗi buổi/ })
      .fill("125000");
    await modal
      .getByLabel("Ngày bắt đầu áp dụng", { exact: true })
      .fill(day(1));
    await modal.getByLabel("Lý do thay đổi").fill("Đổi mức từ ngày mai TC020.");
    await modal
      .getByRole("button", { name: "Lưu và chia sẻ điều kiện", exact: true })
      .click();
    await expect(modal).toHaveCount(0);
    let data = await workspace(page);
    expect(
      data.agreements.data.find((row: { id: string }) => row.id === current)
        .effectiveTo,
    ).toBe(day());
    await page
      .getByRole("button", { name: "Thay mức học phí", exact: true })
      .click();
    modal = page.getByRole("dialog");
    await modal
      .getByRole("spinbutton", { name: /^Đơn giá mỗi buổi/ })
      .fill("130000");
    await modal
      .getByLabel("Lý do thay đổi")
      .fill("Sửa mức trước ngày bắt đầu TC020.");
    await modal
      .getByRole("button", { name: "Lưu và chia sẻ điều kiện", exact: true })
      .click();
    await expect(modal).toHaveCount(0);
    data = await workspace(page);
    expect(
      data.agreements.data.find(
        (row: { sessionUnitPriceVnd: number }) =>
          row.sessionUnitPriceVnd === 125000,
      ).status,
    ).toBe("CANCELLED");
    const upcoming = page.getByRole("article").filter({ hasText: /130\.000/ });
    await upcoming
      .getByRole("button", { name: "Kết thúc hiệu lực", exact: true })
      .click();
    modal = page.getByRole("dialog");
    await modal.getByLabel("Ngày cuối áp dụng", { exact: true }).fill(day(10));
    await modal
      .getByLabel("Lý do", { exact: true })
      .fill("Chốt ngày cuối áp dụng trong tương lai TC020.");
    await modal
      .getByRole("button", { name: "Xác nhận kết thúc", exact: true })
      .click();
    await expect(modal).toHaveCount(0);
    await upcoming
      .getByRole("button", { name: "Hủy điều kiện", exact: true })
      .click();
    modal = page.getByRole("dialog");
    await modal
      .getByLabel("Lý do", { exact: true })
      .fill("Gia đình đổi kế hoạch trước khi mức mới áp dụng TC020.");
    await modal
      .getByRole("button", { name: "Xác nhận hủy điều kiện", exact: true })
      .click();
    await expect(modal).toHaveCount(0);
    await upcoming
      .getByRole("button", { name: "Lịch sử thay đổi", exact: true })
      .click();
    modal = page.getByRole("dialog");
    await expect(
      modal.getByText(
        "Gia đình đổi kế hoạch trước khi mức mới áp dụng TC020.",
      ),
    ).toBeVisible();
    await modal.getByText("Sau thay đổi", { exact: true }).first().click();
    await capture(page, "teacher-history-desktop", modal);
    await modal.getByRole("button", { name: "Đóng", exact: true }).click();
    await page.setViewportSize({ width: 320, height: 780 });
    await capture(page, "teacher-history-mobile-320");
  });

  test("học phí gia đình xem đúng bé, giữ lịch sử sau rời lớp và mất quyền sau thu hồi liên kết", async ({
    page,
    browser,
  }) => {
    test.setTimeout(100_000);
    await login(page, true);
    const context = await browser.newContext(),
      teacher = await context.newPage();
    try {
      await login(teacher);
      await page.goto(`/family/children/${child}`);
      await page
        .getByRole("main")
        .getByRole("link", { name: "Điều kiện học phí", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Điều kiện học phí", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(publicTerms, { exact: true }).first(),
      ).toBeVisible();
      const body = await page.getByRole("main").innerText();
      expect(body).not.toContain(privateNote);
      expect(body).not.toContain("TC020");
      expect(body).not.toContain("3.100.000");
      expect(body).not.toContain("77.000");
      await expect(
        page.getByRole("button", { name: "Thay mức học phí", exact: true }),
      ).toHaveCount(0);
      const family = (
        await (
          await page.request.get(
            `/api/v1/family/children/${child}/tuition-agreements`,
          )
        ).json()
      ).data;
      expect(family.agreements.meta.totalElements).toBe(3);
      for (const row of family.agreements.data) {
        expect(row).not.toHaveProperty("internalNote");
        expect(row).not.toHaveProperty("sourcePolicyVersion");
        expect(row).not.toHaveProperty("version");
      }
      await capture(page, "family-desktop");
      await page.setViewportSize({ width: 375, height: 812 });
      await capture(page, "family-mobile-375");
      await page
        .getByLabel("Chọn bé", { exact: true })
        .selectOption(otherChild);
      await expect(page).toHaveURL(
        new RegExp(`/children/${otherChild}/tuition$`),
      );
      await expect(page.getByText(/77\.000/).first()).toBeVisible();
      await expect(page.getByText(/130\.000/)).toHaveCount(0);
      await page.getByLabel("Chọn bé", { exact: true }).selectOption(child);
      await expect(page.getByText(/130\.000/).first()).toBeVisible();
      const membership = (
        await (
          await teacher.request.get(`/api/v1/classes/${classId}/enrollments`)
        ).json()
      ).data.find((row: { id: string }) => row.id === enrollment);
      expect(
        (
          await write(
            teacher.request,
            `/enrollments/${enrollment}`,
            {
              version: membership.version,
              status: "WITHDRAWN",
              reason: "Gia đình dừng tham gia — kiểm thử học phí.",
            },
            "PATCH",
          )
        ).status(),
      ).toBe(200);
      await page.getByRole("button", { name: "Cập nhật", exact: true }).click();
      await expect(page.getByText(/100\.000/).first()).toBeVisible();
      await page.setViewportSize({ width: 320, height: 780 });
      await capture(page, "family-withdrawn-320");
      const links = (
        await (
          await teacher.request.get(`/api/v1/students/${child}/guardians`)
        ).json()
      ).data;
      const link = links.find((row: { id: string }) => row.id === guardian);
      expect(
        (
          await write(
            teacher.request,
            `/student-guardians/${guardian}/revoke`,
            {
              version: link.version,
              reason: "Thu hồi liên kết kiểm thử TC020.",
            },
          )
        ).status(),
      ).toBe(200);
      await page.getByRole("button", { name: "Cập nhật", exact: true }).click();
      await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
      await expect(page.getByRole("article")).toHaveCount(0);
      expect(
        (
          await page.request.get(
            `/api/v1/family/children/${child}/tuition-agreements`,
          )
        ).status(),
      ).toBe(404);
      await capture(page, "family-revoked-320");
    } finally {
      await context.close();
    }
  });
}
