import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

export function registerScheduleFlows(
  teacherEmail: string,
  teacherPassword: string,
) {
  const parentEmail = "ui-learning@example.test",
    parentPassword = "Synthetic-learning-parent-2026";
  const className = "Lớp Ánh Dương (lịch demo)",
    childName = "Minh Anh (lịch demo)",
    otherName = "Minh Khang (lịch demo)",
    privatePlan = "Kế hoạch riêng của cô, không chia sẻ với gia đình.";
  let classId = "",
    childId = "",
    otherChild = "",
    enrollmentId = "",
    guardianId = "",
    ruleId = "",
    base = "",
    firstSession = "",
    secondSession = "",
    manualSession = "";
  function plus(date: string, amount: number) {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + amount);
    return d.toISOString().slice(0, 10);
  }
  function nextMonday() {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const day = new Date(`${today}T00:00:00Z`).getUTCDay();
    return plus(today, day === 1 ? 7 : (8 - day) % 7 || 7);
  }
  async function login(
    page: Page,
    email = teacherEmail,
    password = teacherPassword,
    role = "teacher",
  ) {
    await page.goto("/login");
    await page.getByLabel("Địa chỉ email").fill(email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${role}$`));
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
  const range = (from = base, to = plus(base, 20)) =>
    `?from=${from}&to=${to}&classId=${classId}&size=100`;
  async function sessions(page: Page) {
    const response = await page.request.get(`/api/v1/sessions${range()}`);
    expect(response.status()).toBe(200);
    return (await response.json()).data;
  }
  async function capture(page: Page, name: string, viewport = false) {
    await page.evaluate(() => document.fonts.ready);
    await expect(
      page.getByRole("button", { name: "Đang kiểm tra…", exact: true }),
    ).toHaveCount(0);
    if (/^family-(week|cancelled)/.test(name))
      await page
        .getByRole("article")
        .first()
        .evaluate((element) => element.scrollIntoView({ block: "center" }));
    if (viewport && (await page.getByRole("dialog").count())) {
      const preview = page.getByRole("region", {
        name: "Xem trước thay đổi lịch",
        exact: true,
      });
      if (await preview.count())
        await preview.evaluate((element) =>
          element.scrollIntoView({ block: "center" }),
        );
    }
    if (!viewport) await page.evaluate(() => scrollTo(0, 0));
    await page.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.blur(),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/schedule-${name}.png`,
      fullPage: !viewport,
      animations: "disabled",
    });
  }
  async function generateThroughUi(page: Page, expected: number) {
    await page
      .getByRole("button", { name: "Sinh buổi học", exact: true })
      .click();
    const modal = page.getByRole("dialog");
    await modal.getByLabel("Từ ngày", { exact: true }).fill(base);
    await modal.getByLabel("Đến ngày", { exact: true }).fill(plus(base, 20));
    await modal.getByRole("button", { name: "Xem trước các buổi" }).click();
    await expect(
      modal.getByRole("region", { name: "Xem trước thay đổi lịch" }),
    ).toContainText(`${expected} buổi tạo mới`);
    await modal.getByRole("button", { name: "Xác nhận sinh lịch" }).click();
    await expect(modal).not.toBeVisible();
    await expect(page.getByRole("status")).toContainText(
      `Đã tạo ${expected} buổi`,
    );
  }

  test("cô tạo lịch tuần, xem trước và sinh lại không trùng; lịch hiển thị desktop/mobile", async ({
    page,
    browser,
  }) => {
    test.setTimeout(100_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    base = nextMonday();
    await login(page);
    let response = await write(page.request, "/classes", {
      name: className,
      location: "Phòng học Hoa Nắng",
      capacity: 8,
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
    const parentContext = await browser.newContext();
    const parent = await parentContext.newPage();
    try {
      await login(parent, parentEmail, parentPassword, "family");
      for (const name of [childName, otherName]) {
        response = await write(page.request, "/students", { fullName: name });
        expect(response.status()).toBe(201);
        const id = (await response.json()).data.id;
        if (name === childName) childId = id;
        else otherChild = id;
        response = await write(
          page.request,
          `/students/${id}/guardian-invitations`,
          { email: parentEmail },
        );
        expect(response.status()).toBe(201);
        const invitation = (await response.json()).data,
          token = new URLSearchParams(
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
      response = await write(page.request, `/classes/${classId}/enrollments`, {
        studentId: childId,
      });
      expect(response.status()).toBe(201);
      enrollmentId = (await response.json()).data.id;
      const links = (
        await (
          await page.request.get(`/api/v1/students/${childId}/guardians`)
        ).json()
      ).data;
      guardianId = links.find(
        (link: { email: string }) => link.email === parentEmail,
      ).id;
    } finally {
      await parentContext.close();
    }
    await page.goto(`/teacher/classes/${classId}`);
    await page.getByRole("link", { name: "Lịch tuần", exact: true }).click();
    await page
      .getByRole("button", { name: "Thêm lịch tuần", exact: true })
      .click();
    let modal = page.getByRole("dialog");
    await modal.getByLabel("Ngày trong tuần").selectOption("1");
    await modal.getByLabel("Giờ bắt đầu", { exact: true }).fill("09:00");
    await modal.getByLabel("Giờ kết thúc", { exact: true }).fill("10:00");
    await modal.getByLabel("Có hiệu lực từ ngày").fill(base);
    await modal.getByLabel("Ngày kết thúc").fill(plus(base, 20));
    await modal
      .getByRole("button", { name: "Tạo lịch tuần", exact: true })
      .click();
    await expect(modal).not.toBeVisible();
    await expect(
      page.getByText("09:00 – 10:00", { exact: true }),
    ).toBeVisible();
    ruleId = (
      await (
        await page.request.get(`/api/v1/classes/${classId}/schedule-rules`)
      ).json()
    ).data[0].id;
    await page
      .getByRole("button", { name: "Sinh buổi học", exact: true })
      .click();
    modal = page.getByRole("dialog");
    await modal.getByLabel("Từ ngày", { exact: true }).fill(base);
    await modal.getByLabel("Đến ngày", { exact: true }).fill(plus(base, 20));
    await modal.getByRole("button", { name: "Xem trước các buổi" }).click();
    await expect(
      modal.getByRole("region", { name: "Xem trước thay đổi lịch" }),
    ).toContainText("3 buổi tạo mới");
    expect((await sessions(page)).length).toBe(0);
    await capture(page, "generate-preview-1440", true);
    await modal.getByRole("button", { name: "Xác nhận sinh lịch" }).click();
    await expect(modal).not.toBeVisible();
    await generateThroughUi(page, 0);
    const rows = await sessions(page);
    expect(rows.length).toBe(3);
    expect(rows[0].startsAt).toBe(`${base}T02:00:00Z`);
    firstSession = rows[0].id;
    secondSession = rows[1].id;
    await page
      .getByRole("link", { name: "Xem lịch của lớp", exact: true })
      .click();
    await page.getByLabel("Tuần có ngày").fill(base);
    await expect(
      page.getByText("09:00 – 10:00", { exact: true }),
    ).toBeVisible();
    await capture(page, "teacher-week-1440");
    await page.setViewportSize({ width: 375, height: 900 });
    await capture(page, "teacher-week-375");
    expect(errors).toEqual([]);
  });

  test("cô xác nhận trùng giờ, đổi riêng và đổi lịch tuần giữ ngoại lệ; hủy buổi không bị sinh lại", async ({
    page,
  }) => {
    test.setTimeout(100_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await login(page);
    await page.goto(`/teacher/schedule/new?classId=${classId}&date=${base}`);
    await page
      .getByLabel("Tên buổi học", { exact: true })
      .fill("Khám phá cùng cô (buổi riêng)");
    await page.getByLabel("Bắt đầu", { exact: true }).fill(`${base}T09:30`);
    await page.getByLabel("Kết thúc", { exact: true }).fill(`${base}T10:30`);
    await page.getByLabel("Kế hoạch riêng của cô").fill(privatePlan);
    await page.getByRole("button", { name: "Xem trước buổi học" }).click();
    await expect(
      page.getByRole("heading", { name: "Có 1 cặp buổi trùng giờ" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Xác nhận tạo buổi" }),
    ).toBeDisabled();
    await capture(page, "conflict-preview-1440");
    await page
      .getByLabel("Tôi đã xem các buổi trùng giờ và xác nhận lưu ngoại lệ.")
      .check();
    await page.getByLabel("Kết thúc", { exact: true }).fill(`${base}T10:45`);
    await expect(
      page.getByRole("heading", { name: "Xem trước thay đổi", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Xem trước buổi học" }).click();
    await expect(
      page.getByLabel(
        "Tôi đã xem các buổi trùng giờ và xác nhận lưu ngoại lệ.",
      ),
    ).not.toBeChecked();
    await page
      .getByLabel("Tôi đã xem các buổi trùng giờ và xác nhận lưu ngoại lệ.")
      .check();
    await page.getByRole("button", { name: "Xác nhận tạo buổi" }).click();
    await expect(page).toHaveURL(/\/teacher\/schedule\/sessions\//);
    manualSession = page.url().split("/").at(-1)!;
    await expect(page.getByText(privatePlan, { exact: true })).toBeVisible();
    await page.goto(`/teacher/schedule/sessions/${firstSession}`);
    await page.setViewportSize({ width: 375, height: 900 });
    await page
      .getByRole("button", { name: "Đổi buổi học", exact: true })
      .click();
    const modal = page.getByRole("dialog");
    await modal.getByLabel("Bắt đầu", { exact: true }).fill(`${base}T11:00`);
    await modal.getByLabel("Kết thúc", { exact: true }).fill(`${base}T12:00`);
    await modal
      .getByLabel("Lý do đổi buổi")
      .fill("Gia đình thống nhất chuyển sang 11 giờ.");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.keyboard.press("Escape");
    await expect(modal).toBeVisible();
    await expect(modal.getByLabel("Bắt đầu", { exact: true })).toHaveValue(
      `${base}T11:00`,
    );
    await modal.getByRole("button", { name: "Xem trước buổi học" }).click();
    await capture(page, "change-session-375", true);
    await modal.getByRole("button", { name: "Xác nhận đổi buổi" }).click();
    await expect(modal).not.toBeVisible();
    await expect(
      page.getByText("Từ lịch tuần · Đã chỉnh riêng", { exact: true }),
    ).toBeVisible();
    await page.goto(`/teacher/classes/${classId}/schedule-rules`);
    await generateThroughUi(page, 0);
    await page.getByRole("button", { name: /Sửa lịch Thứ Hai 09:00/ }).click();
    const ruleModal = page.getByRole("dialog");
    await ruleModal.getByLabel("Giờ bắt đầu", { exact: true }).fill("13:00");
    await ruleModal.getByLabel("Giờ kết thúc", { exact: true }).fill("14:00");
    await ruleModal.getByLabel("Áp dụng thay đổi từ ngày").fill(base);
    await ruleModal
      .getByRole("button", { name: "Xem trước thay đổi", exact: true })
      .click();
    await expect(
      ruleModal.getByRole("region", { name: "Xem trước thay đổi lịch" }),
    ).toContainText("2 buổi đổi");
    await capture(page, "rule-change-375", true);
    await ruleModal
      .getByRole("button", { name: "Lưu thay đổi lịch tuần" })
      .click();
    await expect(ruleModal).not.toBeVisible();
    const rows = await sessions(page);
    expect(
      rows.find((row: { id: string }) => row.id === firstSession).startsAt,
    ).toBe(`${base}T04:00:00Z`);
    expect(
      rows.find((row: { id: string }) => row.id === secondSession).startsAt,
    ).toBe(`${plus(base, 7)}T06:00:00Z`);
    await page.goto(`/teacher/schedule/sessions/${secondSession}`);
    await page
      .getByRole("button", { name: "Hủy buổi học", exact: true })
      .click();
    const cancel = page.getByRole("dialog");
    await cancel
      .getByLabel("Lý do", { exact: true })
      .fill("Cô nghỉ buổi này, gia đình theo dõi lịch mới.");
    await cancel.getByRole("button", { name: "Xác nhận hủy buổi" }).click();
    await expect(cancel).not.toBeVisible();
    await expect(page.getByText("Đã hủy", { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await capture(page, "cancelled-detail-1440");
    const generated = await write(
      page.request,
      `/classes/${classId}/sessions/generate`,
      { from: base, to: plus(base, 20) },
    );
    expect(generated.status()).toBe(200);
    expect((await generated.json()).data.created).toBe(0);
    expect((await sessions(page)).length).toBe(4);
    expect(
      (
        await (
          await page.request.get(`/api/v1/classes/${classId}/schedule-rules`)
        ).json()
      ).data[0].id,
    ).toBe(ruleId);
    expect(errors).toEqual([]);
  });

  test("gia đình xem đúng giờ Việt Nam ở timezone khác, đổi bé và mất lịch sau rời lớp hoặc thu hồi liên kết", async ({
    page,
    browser,
  }) => {
    test.setTimeout(100_000);
    await login(page);
    const context = await browser.newContext({
      viewport: { width: 375, height: 900 },
      timezoneId: "America/Los_Angeles",
    });
    const parent = await context.newPage();
    const errors: string[] = [];
    parent.on("pageerror", (error) => errors.push(error.message));
    try {
      await login(parent, parentEmail, parentPassword, "family");
      await parent.goto(`/family/children/${childId}`);
      await parent
        .getByRole("navigation", { name: "Điều hướng gia đình" })
        .getByRole("link", { name: "Lịch học", exact: true })
        .click();
      await expect(parent).toHaveURL(
        new RegExp(`/children/${childId}/schedule$`),
      );
      await parent.getByLabel("Tuần có ngày").fill(base);
      await expect(
        parent.getByRole("heading", { name: "Lịch học của bé", exact: true }),
      ).toBeVisible();
      await expect(
        parent.getByText("09:30 – 10:45", { exact: true }),
      ).toBeVisible();
      await expect(
        parent.getByText("11:00 – 12:00", { exact: true }),
      ).toBeVisible();
      await expect(parent.getByText(privatePlan, { exact: true })).toHaveCount(
        0,
      );
      const response = await parent.request.get(
        `/api/v1/family/children/${childId}/sessions${range()}`,
      );
      expect(response.status()).toBe(200);
      const publicData = await response.json();
      expect(publicData.meta.totalElements).toBe(4);
      expect(JSON.stringify(publicData)).not.toMatch(
        /lessonPlan|scheduleRuleId|requestHash|version/,
      );
      await capture(parent, "family-week-375", true);
      await parent
        .getByLabel("Chọn bé", { exact: true })
        .selectOption(otherChild);
      await expect(parent).toHaveURL(
        new RegExp(`/children/${otherChild}/schedule$`),
      );
      await expect(
        parent.getByText("Tuần này chưa có buổi phù hợp", { exact: true }),
      ).toBeVisible();
      await expect(
        parent.getByText("Khám phá cùng cô (buổi riêng)", { exact: true }),
      ).toHaveCount(0);
      await expect(
        parent.getByText(
          `Theo dõi các buổi học của ${otherName}, địa điểm và thay đổi từ cô.`,
          { exact: true },
        ),
      ).toBeVisible();
      await parent.goto(
        `/family/children/${childId}/schedule?week=${plus(base, 7)}`,
      );
      await parent.setViewportSize({ width: 320, height: 900 });
      await expect(parent.getByText("Đã hủy", { exact: true })).toBeVisible();
      await expect(
        parent.getByText(
          "Lý do hủy: Cô nghỉ buổi này, gia đình theo dõi lịch mới.",
          { exact: true },
        ),
      ).toBeVisible();
      await capture(parent, "family-cancelled-320", true);
      expect(
        (
          await write(
            page.request,
            `/enrollments/${enrollmentId}`,
            {
              version: 0,
              status: "WITHDRAWN",
              reason: "Gia đình dừng lớp thử nghiệm.",
            },
            "PATCH",
          )
        ).status(),
      ).toBe(200);
      await parent
        .getByRole("button", { name: "Cập nhật lịch", exact: true })
        .click();
      await expect(
        parent.getByText("Tuần này chưa có buổi phù hợp", { exact: true }),
      ).toBeVisible();
      await expect(parent.getByText("Đã hủy", { exact: true })).toHaveCount(0);
      expect(
        (
          await parent.request.get(
            `/api/v1/family/children/${childId}/sessions${range()}`,
          )
        ).status(),
      ).toBe(404);
      expect(
        (
          await write(page.request, `/student-guardians/${guardianId}/revoke`, {
            version: 0,
            reason: "Thu hồi liên kết kiểm thử.",
          })
        ).status(),
      ).toBe(200);
      await parent
        .getByRole("button", { name: "Cập nhật lịch", exact: true })
        .click();
      await expect(parent.getByRole("alert")).toBeVisible();
      await expect(
        parent.getByText("Khám phá cùng cô (buổi riêng)", { exact: true }),
      ).toHaveCount(0);
      await capture(parent, "family-access-revoked-320", true);
      expect(
        (
          await parent.request.get(`/api/v1/sessions/${manualSession}`)
        ).status(),
      ).toBe(403);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
