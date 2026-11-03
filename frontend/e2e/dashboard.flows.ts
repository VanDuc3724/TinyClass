import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

export function registerDashboardFlows(
  teacherEmail: string,
  teacherPassword: string,
) {
  const parentEmail = "ui-learning@example.test",
    parentPassword = "Synthetic-learning-parent-2026";
  const childName = "Bảo Ngọc (tổng quan demo)",
    otherName = "Gia Hân (tổng quan demo)";
  const activityTitle = "Khám phá màu sắc (tổng quan demo)";
  let classroom = "",
    secondClass = "",
    child = "",
    other = "",
    enrollment = "",
    guardian = "",
    invoiceId = "";
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
    key?: string,
  ) {
    const token = (await (await request.get("/api/v1/auth/csrf")).json()).data;
    return request.fetch(`/api/v1${path}`, {
      method,
      headers: {
        [token.headerName]: token.token,
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      data: body,
    });
  }
  async function get(page: Page, path: string) {
    const r = await page.request.get(`/api/v1${path}`);
    expect(r.status()).toBe(200);
    return (await r.json()).data;
  }
  async function capture(page: Page, name: string) {
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => scrollTo(0, 0));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/dashboard-${name}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
  const billing = (page: Page) =>
    page.getByRole("region", { name: "Tổng quan học phí", exact: true });
  async function createInvoice(
    page: Page,
    enrollmentId: string,
    amount: number,
    due: string,
  ) {
    let r = await write(
      page.request,
      `/enrollments/${enrollmentId}/tuition-agreements`,
      {
        clientRequestId: crypto.randomUUID(),
        source: "CUSTOM",
        terms: {
          pricingMode: "PER_SESSION",
          collectionTiming: "UPFRONT",
          sessionUnitPriceVnd: 100000,
          chargeExcusedAbsence: false,
          chargeUnexcusedAbsence: true,
        },
        effectiveFrom: day(),
      },
    );
    expect(r.status()).toBe(201);
    const agreementId = (await r.json()).data.id;
    r = await write(page.request, "/billing/previews", {
      agreementId,
      periodStart: day(),
      periodEnd: day(),
    });
    expect(r.status()).toBe(200);
    const preview = (await r.json()).data;
    r = await write(page.request, "/invoices", {
      clientRequestId: crypto.randomUUID(),
      agreementId,
      periodStart: day(),
      periodEnd: day(),
      dueOn: due,
      previewKey: preview.previewKey,
      lines: [
        {
          description: "Học phí đối chiếu tổng quan",
          pricingBasis: "OTHER",
          quantity: 1,
          unitPriceVnd: amount,
          discountVnd: 0,
        },
      ],
      adjustmentReason: "Lý do riêng tổng quan: mức thu kiểm thử.",
      internalNote: "Ghi chú riêng tổng quan không chia sẻ.",
    });
    expect(r.status()).toBe(201);
    const invoice = (await r.json()).data;
    r = await write(page.request, `/invoices/${invoice.id}/issue`, {
      version: 0,
      reviewKey: invoice.reviewKey,
    });
    expect(r.status()).toBe(200);
    return (await r.json()).data;
  }
  async function assign(
    page: Page,
    title: string,
    mode: string,
    future = false,
  ) {
    let r = await write(page.request, "/lessons", {
      title,
      defaultCompletionMode: mode,
      defaultResponseTypes: mode === "TEACHER_REVIEW" ? ["TEXT"] : [],
      topicIds: [],
      blocks: [
        {
          type: "TEXT",
          textContent: "Hoạt động thực hành được chia sẻ cho gia đình.",
        },
      ],
    });
    expect(r.status()).toBe(201);
    const lesson = (await r.json()).data;
    expect(
      (
        await write(page.request, `/lessons/${lesson.id}/publish`, {
          version: 0,
        })
      ).status(),
    ).toBe(200);
    r = await write(page.request, "/assignments", {
      title,
      sourceType: "LESSON",
      lessonId: lesson.id,
      targetType: "CLASS",
      classId: classroom,
      availableAt: new Date(
        Date.now() + (future ? 86400000 : -60000),
      ).toISOString(),
      clientRequestId: crypto.randomUUID(),
    });
    expect(r.status()).toBe(201);
    const a = (await r.json()).data;
    r = await write(page.request, `/assignments/${a.id}/publish`, {
      version: 0,
    });
    expect(r.status()).toBe(200);
    return (await r.json()).data;
  }
  test("tổng quan cô hiển thị tiền đúng lớp, điều hướng phiếu quá hạn và giữ số liệu khi tải lại lỗi", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    await login(page);
    const context = await browser.newContext(),
      parent = await context.newPage();
    try {
      await login(parent, true);
      for (const [index, name] of [childName, otherName].entries()) {
        let r = await write(page.request, "/classes", {
          name: `Lớp ${index ? "Cầu Vồng" : "Lá Non"} (tổng quan demo)`,
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
        expect(r.status()).toBe(201);
        const id = (await r.json()).data.id;
        r = await write(page.request, `/classes/${c}/enrollments`, {
          studentId: id,
        });
        expect(r.status()).toBe(201);
        const e = (await r.json()).data.id;
        if (!index) {
          classroom = c;
          child = id;
          enrollment = e;
        } else {
          secondClass = c;
          other = id;
        }
        r = await write(page.request, `/students/${id}/guardian-invitations`, {
          email: parentEmail,
        });
        expect(r.status()).toBe(201);
        const invitation = (await r.json()).data;
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
        const invoice = await createInvoice(
          page,
          e,
          index ? 900000 : 800000,
          day(index ? 0 : -1),
        );
        if (!index) {
          invoiceId = invoice.id;
          expect(
            (
              await write(
                page.request,
                `/invoices/${invoice.id}/payments`,
                {
                  invoiceVersion: invoice.version,
                  amountVnd: 500000,
                  method: "CASH",
                  paidAt: new Date(Date.now() - 60000).toISOString(),
                  internalNote: "Ghi chú riêng khoản thu tổng quan.",
                },
                "POST",
                crypto.randomUUID(),
              )
            ).status(),
          ).toBe(201);
        }
      }
      guardian = (await get(page, `/students/${child}/guardians`)).find(
        (g: { email: string }) => g.email === parentEmail,
      ).id;
      await assign(page, activityTitle, "PARENT_CONFIRM");
      await assign(
        page,
        "Hoạt động chờ mở (tổng quan demo)",
        "PARENT_CONFIRM",
        true,
      );
      const review = await assign(
        page,
        "Hoạt động đã được góp ý (tổng quan demo)",
        "TEACHER_REVIEW",
      );
      let r = await write(
        parent.request,
        `/family/children/${child}/assignment-items/${review.items[0].id}/submissions`,
        {},
      );
      expect(r.status()).toBe(201);
      const submission = (await r.json()).data;
      expect(
        (
          await write(
            parent.request,
            `/submissions/${submission.id}`,
            {
              version: 0,
              textResponse: "Gia đình gửi hoạt động tổng quan.",
              fileIds: [],
            },
            "PATCH",
          )
        ).status(),
      ).toBe(200);
      expect(
        (
          await write(parent.request, `/submissions/${submission.id}/submit`, {
            version: 1,
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await write(page.request, `/submissions/${submission.id}/review`, {
            version: 2,
            outcome: "ACCEPTED",
            feedbackText: "Bé đã hoàn thành hoạt động.",
          })
        ).status(),
      ).toBe(200);
      r = await write(page.request, "/announcements", {
        clientRequestId: crypto.randomUUID(),
        classId: classroom,
        title: "Bảng tin tổng quan của bé",
        body: "Gia đình chuẩn bị giấy màu cho buổi tới.",
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
      expect(
        (
          await write(page.request, "/sessions", {
            clientRequestId: crypto.randomUUID(),
            classId: classroom,
            title: "Buổi khám phá sắp tới",
            startsAt: `${day(1)}T09:00:00+07:00`,
            endsAt: `${day(1)}T10:00:00+07:00`,
            preview: false,
            allowConflicts: false,
          })
        ).status(),
      ).toBe(201);
      await page.goto(`/teacher?classId=${classroom}`);
      await expect(
        billing(page)
          .getByText(/300\.000/)
          .first(),
      ).toBeVisible();
      await expect(billing(page).getByText(/500\.000/)).toBeVisible();
      const scoped = await get(page, `/dashboard?classId=${classroom}`);
      expect(scoped.billing.openInvoiceCount).toBe(1);
      expect(scoped.billing.overdueInvoiceCount).toBe(1);
      await capture(page, "teacher-scoped-desktop");
      await billing(page)
        .getByRole("link", { name: "Xem phiếu quá hạn", exact: true })
        .click();
      await expect(page).toHaveURL(
        new RegExp(`collection=OVERDUE.*classId=${classroom}`),
      );
      await expect(
        page.getByRole("combobox", { name: "Tình hình thu phí", exact: true }),
      ).toHaveValue("OVERDUE");
      await expect(
        page.getByRole("link", { name: new RegExp(`Xem phiếu`) }),
      ).toHaveCount(1);
      await page.goBack();
      await expect(
        page.getByLabel("Phạm vi thống kê", { exact: true }),
      ).toHaveValue(classroom);
      await page
        .getByLabel("Phạm vi thống kê", { exact: true })
        .selectOption(secondClass);
      await expect(
        billing(page)
          .getByText(/900\.000/)
          .first(),
      ).toBeVisible();
      await expect(billing(page).getByText(/300\.000/)).toHaveCount(0);
      await page
        .getByLabel("Phạm vi thống kê", { exact: true })
        .selectOption(classroom);
      await expect(
        billing(page)
          .getByText(/300\.000/)
          .first(),
      ).toBeVisible();
      await page.setViewportSize({ width: 375, height: 812 });
      await capture(page, "teacher-scoped-375");
      const routePath = `**/api/v1/dashboard?classId=${classroom}`;
      await page.route(routePath, (route) =>
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Dịch vụ tổng quan đang gián đoạn trong kiểm thử.",
          }),
        }),
      );
      await page
        .getByRole("button", { name: "Cập nhật tổng quan", exact: true })
        .click();
      await expect(page.getByRole("main").getByRole("alert")).toContainText(
        "gián đoạn",
      );
      await expect(
        billing(page)
          .getByText(/300\.000/)
          .first(),
      ).toBeVisible();
      await capture(page, "teacher-retry-375");
      await page.unroute(routePath);
      await page.getByRole("button", { name: "Thử lại", exact: true }).click();
      await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
      await page.goto(`/teacher?classId=${crypto.randomUUID()}`);
      await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
      await expect(billing(page)).toHaveCount(0);
      await page
        .getByRole("link", { name: "Về tất cả lớp học", exact: true })
        .click();
      await expect(billing(page)).toBeVisible();
    } finally {
      await context.close();
    }
  });
  test("tổng quan gia đình tiếp tục đúng bài, cập nhật tiến độ và đổi bé bỏ nội dung cũ", async ({
    browser,
  }) => {
    test.setTimeout(100_000);
    const context = await browser.newContext({
        timezoneId: "America/Los_Angeles",
      }),
      parent = await context.newPage();
    try {
      await login(parent, true);
      await parent.setViewportSize({ width: 375, height: 812 });
      await expect(
        parent.getByRole("region", { name: "Cập nhật gần đây", exact: true }),
      ).toBeVisible();
      await capture(parent, "family-home-375");
      await parent.setViewportSize({ width: 1440, height: 1000 });
      await parent.goto(`/family/children/${child}`);
      await expect(
        parent.getByRole("heading", { name: childName, exact: true }),
      ).toBeVisible();
      await expect(
        billing(parent)
          .getByText(/300\.000/)
          .first(),
      ).toBeVisible();
      await expect(
        parent.getByRole("link", {
          name: `Tiếp tục: ${activityTitle}`,
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        parent.getByRole("heading", {
          name: "Buổi khám phá sắp tới",
          exact: true,
        }),
      ).toBeVisible();
      expect(
        (await get(parent, `/family/children/${child}/dashboard`)).businessDate,
      ).toBe(day());
      await capture(parent, "family-child-desktop");
      await parent.setViewportSize({ width: 375, height: 812 });
      expect(
        (await parent
          .getByRole("heading", { name: childName, exact: true })
          .boundingBox())!.width,
      ).toBeGreaterThan(140);
      await capture(parent, "family-child-375");
      await parent
        .getByRole("link", { name: `Tiếp tục: ${activityTitle}`, exact: true })
        .click();
      await parent
        .getByRole("link", {
          name: new RegExp(activityTitle.replace(/[()]/g, "\\$&")),
        })
        .click();
      await parent
        .getByLabel("Tôi đã cùng bé thực hiện hoạt động này.", { exact: true })
        .check();
      await parent
        .getByRole("button", { name: "Xác nhận đã hoàn thành", exact: true })
        .click();
      await expect(
        parent.getByRole("heading", {
          name: "Mình đã hoàn thành hoạt động!",
          exact: true,
        }),
      ).toBeVisible();
      await parent.goto(`/family/children/${child}`);
      await expect(
        parent.getByRole("link", {
          name: `Tiếp tục: ${activityTitle}`,
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(
        parent.getByRole("progressbar", {
          name: "Tiến độ các bài bé còn được thực hiện",
          exact: true,
        }),
      ).toHaveAttribute("value", "2");
      await parent.getByLabel("Chọn bé", { exact: true }).selectOption(other);
      await expect(
        parent.getByRole("heading", { name: otherName, exact: true }),
      ).toBeVisible();
      await expect(
        billing(parent)
          .getByText(/900\.000/)
          .first(),
      ).toBeVisible();
      await expect(
        parent.getByText(activityTitle, { exact: true }),
      ).toHaveCount(0);
      await expect(parent.getByRole("progressbar")).toHaveCount(0);
      await parent.setViewportSize({ width: 320, height: 780 });
      expect(
        (await parent
          .getByRole("heading", { name: otherName, exact: true })
          .boundingBox())!.width,
      ).toBeGreaterThan(140);
      await capture(parent, "family-other-child-320");
      expect(await parent.getByRole("main").innerText()).not.toContain(
        "Ghi chú riêng",
      );
      await parent.getByLabel("Chọn bé", { exact: true }).selectOption(child);
      await expect(
        parent.getByRole("heading", { name: childName, exact: true }),
      ).toBeVisible();
      await expect(
        billing(parent)
          .getByText(/300\.000/)
          .first(),
      ).toBeVisible();
      await parent
        .getByRole("region", { name: "Cập nhật gần đây", exact: true })
        .getByRole("button", { name: "Mở cập nhật", exact: true })
        .first()
        .click();
      await expect(parent).toHaveURL(
        new RegExp(`/family/children/${child}/schedule$`),
      );
      await parent.goBack();
      await expect(billing(parent)).toBeVisible();
    } finally {
      await context.close();
    }
  });
  test("tổng quan sau rời lớp giữ phí và phản hồi, thu hồi liên kết bỏ toàn bộ dữ liệu bé", async ({
    page,
    browser,
  }) => {
    test.setTimeout(100_000);
    await login(page);
    const context = await browser.newContext(),
      parent = await context.newPage();
    try {
      await login(parent, true);
      await parent.goto(`/family/children/${child}`);
      await expect(billing(parent)).toBeVisible();
      const member = (
        await get(page, `/classes/${classroom}/enrollments`)
      ).find((e: { id: string }) => e.id === enrollment);
      expect(
        (
          await write(
            page.request,
            `/enrollments/${enrollment}`,
            {
              version: member.version,
              status: "WITHDRAWN",
              reason: "Dừng lớp kiểm thử tổng quan.",
            },
            "PATCH",
          )
        ).status(),
      ).toBe(200);
      await parent
        .getByRole("button", { name: "Cập nhật thông tin", exact: true })
        .click();
      await expect(
        billing(parent)
          .getByText(/300\.000/)
          .first(),
      ).toBeVisible();
      await expect(
        parent
          .getByRole("region", { name: "Phản hồi gần đây", exact: true })
          .getByRole("heading", {
            name: "Hoạt động đã được góp ý (tổng quan demo)",
            exact: true,
          }),
      ).toBeVisible();
      await expect(
        parent
          .getByRole("region", { name: "Phản hồi gần đây", exact: true })
          .getByText("Đã chấp nhận", { exact: true }),
      ).toBeVisible();
      await expect(
        parent.getByRole("heading", {
          name: "Buổi khám phá sắp tới",
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(
        parent.getByRole("heading", {
          name: "Bảng tin tổng quan của bé",
          exact: true,
        }),
      ).toHaveCount(0);
      const after = await get(parent, `/family/children/${child}/dashboard`);
      expect(after.learning.availableAssignments).toBe(0);
      expect(after.billing.outstandingAmountVnd).toBe("300000");
      expect(after.recentFeedback).toHaveLength(1);
      await parent.setViewportSize({ width: 320, height: 780 });
      await capture(parent, "family-withdrawn-320");
      const c = await get(page, `/classes/${classroom}`);
      expect(
        (
          await write(page.request, `/classes/${classroom}/archive`, {
            version: c.version,
            reason: "Lưu trữ lớp kiểm thử tổng quan.",
          })
        ).status(),
      ).toBe(200);
      await page.goto(`/teacher?classId=${classroom}`);
      await expect(
        billing(page)
          .getByText(/300\.000/)
          .first(),
      ).toBeVisible();
      await expect(
        page
          .getByRole("region", { name: "Học sinh đang học", exact: true })
          .locator("strong"),
      ).toHaveText("0");
      await capture(page, "teacher-archived-desktop");
      const g = (await get(page, `/students/${child}/guardians`)).find(
        (row: { id: string }) => row.id === guardian,
      );
      expect(
        (
          await write(page.request, `/student-guardians/${guardian}/revoke`, {
            version: g.version,
            reason: "Thu hồi liên kết kiểm thử tổng quan.",
          })
        ).status(),
      ).toBe(200);
      await parent
        .getByRole("button", { name: "Cập nhật thông tin", exact: true })
        .click();
      await expect(parent.getByRole("main").getByRole("alert")).toBeVisible();
      await expect(
        parent.getByRole("region", { name: "Tổng quan của bé", exact: true }),
      ).toHaveCount(0);
      await expect(billing(parent)).toHaveCount(0);
      await capture(parent, "family-revoked-320");
      expect(
        (
          await parent.request.get(`/api/v1/family/children/${child}/dashboard`)
        ).status(),
      ).toBe(404);
      await parent.goto("/family");
      await expect(
        parent.getByRole("link", {
          name: new RegExp(otherName.replace(/[()]/g, "\\$&")),
        }),
      ).toBeVisible();
      await expect(
        parent.getByRole("link", {
          name: new RegExp(childName.replace(/[()]/g, "\\$&")),
        }),
      ).toHaveCount(0);
      expect(
        (await page.request.get(`/api/v1/invoices/${invoiceId}`)).status(),
      ).toBe(200);
    } finally {
      await context.close();
    }
  });
}
